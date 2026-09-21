#!/usr/bin/env node
/**
 * Fail if any plugin doc names an MCP tool the Lincx MCP no longer registers.
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
    if (allowed.has(qualified)) continue;
    if (!known.has(tool)) offenders.push(`${at}: ${qualified} — not a registered tool`);
  }

  for (const [, ident] of line.matchAll(BACKTICKED_RE)) {
    // `list_` and `zone_` are wildcard prose, not tools; a bare word is not tool-like.
    if (ident.endsWith('_') || !ident.includes('_')) continue;
    if (NOT_TOOLS.has(ident) || !TOOL_PREFIXES.some((p) => ident.startsWith(p))) continue;
    scanned++;
    if (!known.has(ident)) offenders.push(`${at}: \`${ident}\` — not a registered tool`);
  }

  return { offenders, scanned };
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
  eq(hits('`mcp__claude_ai_Lincx__save_template_version`'), 0, 'allowlisted ref');
  eq(hits('all `list_` tools take `network_id` over `start_date`'), 0, 'wildcard and field names');
}

selfTest();

const offenders = [];
let scanned = 0;

for (const file of walk(join(repoRoot, 'plugins'))) {
  const where = relative(repoRoot, file);
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
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
  console.error(`✘ ${offenders.length} stale MCP tool reference(s):\n${offenders.map((o) => `  ${o}`).join('\n')}`);
  process.exit(1);
}

console.log(`✔ ${scanned} tool references across plugins/ all resolve to ${known.size} registered tools`);
