#!/usr/bin/env node
/**
 * Regenerate mcp-tools.json — the list of tools the Lincx MCP actually registers.
 *
 * Usage:
 *   node scripts/sync-mcp-tools.mjs              # fetch from GitHub (needs `gh` auth)
 *   node scripts/sync-mcp-tools.mjs ../lincx-mcp # read a local checkout instead
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Interlincx/lincx-mcp';
const TOOLS_DIR = 'src/tools';

// Multi-line: authTools.js / networkTools.js put the name on the line after `registerTool(`.
const REGISTER_RE = /registerTool\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;

const gh = (path) => execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 << 20 });

function fromGitHub() {
  const names = JSON.parse(gh(`repos/${REPO}/contents/${TOOLS_DIR}`)).map((e) => e.name);
  return names
    .filter(isSource)
    .map((n) => Buffer.from(JSON.parse(gh(`repos/${REPO}/contents/${TOOLS_DIR}/${n}`)).content, 'base64').toString('utf8'));
}

function fromCheckout(root) {
  const dir = join(resolve(root), ...TOOLS_DIR.split('/'));
  return readdirSync(dir).filter(isSource).map((n) => readFileSync(join(dir, n), 'utf8'));
}

// lincx-mcp dropped TypeScript in db72b566 — accept both so this keeps working either way.
const isSource = (name) => (name.endsWith('.js') || name.endsWith('.ts')) && !name.endsWith('.test.js') && !name.endsWith('.test.ts');

const sources = process.argv[2] ? fromCheckout(process.argv[2]) : fromGitHub();

const tools = new Set();
for (const src of sources) for (const m of src.matchAll(REGISTER_RE)) tools.add(m[1]);

// A partial scrape would quietly mark live tools as dead, so refuse to write one.
if (tools.size < 40) {
  console.error(`✘ only found ${tools.size} tools — scrape looks broken, refusing to overwrite the snapshot`);
  process.exit(1);
}

const target = join(repoRoot, 'mcp-tools.json');
const existing = JSON.parse(readFileSync(target, 'utf8'));
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: `${REPO}/${TOOLS_DIR}`,
  tools: [...tools].sort(),
  knownUnresolved: existing.knownUnresolved,
};
writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`✔ wrote ${tools.size} tool names → ${target}`);
