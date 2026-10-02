#!/usr/bin/env node
/**
 * Fail if any plugin doc names an MCP tool the Lincx MCP no longer registers, or
 * still assumes an active network (the org MCP needs `network_id` on every business
 * tool call — issue #12).
 *
 * The per-plugin version of this check validated against a per-plugin snapshot that
 * nothing could refresh (see issue #8), so removed tools stayed "known" and passed.
 * One snapshot, one checker, every plugin.
 *
 * Usage: node scripts/check-mcp-tool-refs.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(readFileSync(join(repoRoot, 'mcp-tools.json'), 'utf8'));
const known = new Set(snapshot.tools);
const allowed = new Set(Object.keys(snapshot.knownUnresolved ?? {}));

// Configurable threshold. Default 90 days; override with MCP_SNAPSHOT_MAX_AGE_DAYS.
const MAX_AGE_DAYS = Number(process.env.MCP_SNAPSHOT_MAX_AGE_DAYS ?? 90);

// Tokens that look like tool names but are field/dimension/metric names — never tools.
const NOT_TOOLS = new Set([
  'campaign_id', 'advertiser_id', 'zone_id', 'site_id', 'creative_id',
  'network_id', 'publisher_id', 'channel_id', 'ad_group_id',
  'fill_rate', 'delta_pct', 'delta_abs', 'current_volume', 'volume_floor',
  'campaign_daily', 'advertiser_daily', 'zone_daily',
  'auth_token', 'access_token', 'refresh_token',
  'start_date', 'end_date',
]);

// Verb prefixes the MCP actually uses. `create_`/`explain_` are here because
// create_analysis and explain_serve were both invisible to the old prefix list.
const TOOL_PREFIXES = ['list_', 'get_', 'auth_', 'network_', 'report_', 'create_', 'explain_', 'render_', 'zone_load_'];

// `some_tool` and `some_tool({ ... })` in backticks, plus mcp__<server>__<tool> refs.
const BACKTICKED_RE = /`([a-z][a-z0-9_]*)\s*[`(]/g;
// The server segment can contain hyphens — the live prefix is `mcp__claude_ai_lincx-mcp__`.
const QUALIFIED_RE = /(mcp__[A-Za-z0-9_-]+?__([a-z][a-z0-9_]*))\b/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'node_modules') continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

/** Stale tool references in one line of markdown, plus how many refs it looked at. */
function scanLine(line, at) {
  const offenders = [];
  let scanned = 0;

  for (const [, qualified, tool] of line.matchAll(QUALIFIED_RE)) {
    scanned++;
    if (allowed.has(qualified) || allowed.has(tool)) continue;
    if (!known.has(tool)) offenders.push(`${at}: ${qualified} — not a registered tool`);
  }

  for (const [, ident] of line.matchAll(BACKTICKED_RE)) {
    // `list_` and `zone_` are wildcard prose, not tools; a bare word is not tool-like.
    if (ident.endsWith('_') || !ident.includes('_')) continue;
    if (NOT_TOOLS.has(ident) || !TOOL_PREFIXES.some((p) => ident.startsWith(p))) continue;
    scanned++;
    if (allowed.has(ident)) continue;
    if (!known.has(ident)) offenders.push(`${at}: \`${ident}\` — not a registered tool`);
  }

  return { offenders, scanned };
}

// Tools that work without a network: auth and the network catalog itself.
const NETWORK_FREE = ['auth_', 'network_'];
// The old session-scoped rule. "there is no active network" is the new rule, so it passes.
const ACTIVE_NETWORK_RE = /Never pass `networkId`|session-scoped|(?<!no )active network|offer to switch/i;

/** Calls written as `tool({ … })` (any line span) that omit network_id, plus old-rule wording. */
function scanNetwork(text, where) {
  const offenders = [];
  const lineAt = (i) => text.slice(0, i).split('\n').length;
  for (const m of text.matchAll(/\b([a-z][a-z0-9_]*)\(\{/g)) {
    const tool = m[1];
    if (!known.has(tool) && !allowed.has(tool)) continue;
    if (NETWORK_FREE.some((p) => tool.startsWith(p))) continue;
    let depth = 0;
    let j = m.index + tool.length + 1;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}' && --depth === 0) break;
    }
    const body = text.slice(m.index + tool.length + 2, j);
    if (body.trim() === '...' || body.trim() === '…') continue; // placeholder, not a call shape
    if (!/\bnetwork_id\b/.test(body)) offenders.push(`${where}:${lineAt(m.index)}: ${tool}({ … }) without network_id`);
  }
  text.split('\n').forEach((line, i) => {
    if (ACTIVE_NETWORK_RE.test(line)) offenders.push(`${where}:${i + 1}: assumes an active network — network_id comes from the conversation`);
  });
  return offenders;
}

// The matchers are the whole check, so they get verified on every run — a regex that
// silently stops matching would otherwise report a clean scan over nothing.
function selfTest() {
  const hits = (line) => scanLine(line, 'x:1').offenders.length;
  const eq = (actual, expected, what) => {
    if (actual !== expected) {
      console.error(`✘ self-test: ${what} — expected ${expected}, got ${actual}`);
      process.exit(1);
    }
  };
  eq(hits('use `network_switch` now'), 1, 'removed tool in backticks');
  eq(hits('call `create_analysis({ zoneId })`'), 1, 'removed tool in call form');
  eq(hits('call `get_zone_report({ id })`'), 0, 'live tool in call form');
  // The live server prefix has a hyphen in it, which a [A-Za-z0-9_] server segment can't cross.
  eq(hits('`mcp__claude_ai_lincx-mcp__get_widget`'), 1, 'qualified ref, hyphenated server');
  eq(hits('`mcp__claude_ai_lincx-mcp__get_zone`'), 0, 'qualified ref to a live tool');
  eq(hits('`save_template_version`'), 0, 'allowlisted bare ref');
  eq(hits('all `list_` tools take `network_id` over `start_date`'), 0, 'wildcard and field names');

  const net = (text) => scanNetwork(text, 'x').length;
  eq(net('`get_zone_ads({ zoneId, debug: true })`'), 1, 'business call without network_id');
  eq(net('get_zone_ads({ network_id, zoneId,\n  geo: { state: "TX" } })'), 0, 'multi-line call with network_id');
  eq(net('`auth_status({})` then `network_list({ limit: 5 })`'), 0, 'network-free tools');
  eq(net('- Never pass `networkId` — it is session-scoped upstream.'), 1, 'old rule wording');
  eq(net('Every tool takes `network_id` — there is no active network.'), 0, 'new rule wording');
}

selfTest();

const offenders = [];
let scanned = 0;

for (const file of walk(join(repoRoot, 'plugins'))) {
  const where = relative(repoRoot, file);
  const text = readFileSync(file, 'utf8');
  offenders.push(...scanNetwork(text, where));
  text.split('\n').forEach((line, i) => {
    const r = scanLine(line, `${where}:${i + 1}`);
    offenders.push(...r.offenders);
    scanned += r.scanned;
  });
}

const ageDays = (Date.now() - Date.parse(snapshot.generatedAt)) / 86_400_000;
if (!Number.isFinite(ageDays)) {
  offenders.push(`mcp-tools.json: generatedAt is not parseable: ${snapshot.generatedAt}`);
} else if (ageDays > MAX_AGE_DAYS) {
  offenders.push(`mcp-tools.json: ${ageDays.toFixed(1)} days old (limit ${MAX_AGE_DAYS}) — run \`node scripts/sync-mcp-tools.mjs\``);
}

if (!scanned) {
  console.error('✘ scanned no tool references at all — the matcher is broken, not the docs');
  process.exit(1);
}

if (offenders.length) {
  console.error(`✘ ${offenders.length} MCP reference problem(s):\n${offenders.map((o) => `  ${o}`).join('\n')}`);
  process.exit(1);
}

console.log(`✔ ${scanned} tool references across plugins/ all resolve to ${known.size} registered tools`);
