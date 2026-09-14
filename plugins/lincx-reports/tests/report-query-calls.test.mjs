import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

// report_query's real input schema (strict — anything else is rejected by the MCP).
// This MCP has no active network: every business tool requires network_id.
const ALLOWED = new Set(['network_id', 'dimensionSetId', 'startDate', 'endDate', 'groupBy', 'filter', 'timezone', 'raw', 'testMode']);
const REQUIRED = ['network_id', 'dimensionSetId', 'startDate', 'endDate'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

const docs = [...walk(join(pluginRoot, 'skills')), ...walk(join(pluginRoot, 'tests', 'golden'))];

/** Body of every `report_query({ ... })` in `src`, braces balanced. */
function calls(src, tool = 'report_query') {
  const out = [];
  let i = src.indexOf(`${tool}({`);
  while (i !== -1) {
    const start = i + `${tool}(`.length;
    let depth = 0;
    let j = start;
    for (; j < src.length; j++) {
      if (src[j] === '{' || src[j] === '[') depth++;
      else if (src[j] === '}' || src[j] === ']') depth--;
      if (depth === 0) break;
    }
    out.push(src.slice(start + 1, j));
    i = src.indexOf(`${tool}({`, j);
  }
  return out;
}

/** Top-level keys of an object-literal body: drop nested {…}/[…] and strings, split on commas. */
function topLevelKeys(body) {
  let flat = body.replace(/"[^"]*"/g, '""');
  let prev;
  do { prev = flat; flat = flat.replace(/\{[^{}]*\}|\[[^[\]]*\]/g, ''); } while (flat !== prev);
  return flat.split(',').map((p) => p.split(':')[0].trim()).filter(Boolean);
}

test('topLevelKeys ignores nested object/array contents', () => {
  assert.deepEqual(
    topLevelKeys(' dimensionSetId, groupBy: ["date", "x"], filter: { zone: "a, b" }, timezone: "America/Denver" '),
    ['dimensionSetId', 'groupBy', 'filter', 'timezone'],
  );
});

test('every report_query call in skills/goldens uses only real parameters', () => {
  const offenders = [];
  let seen = 0;
  for (const file of docs) {
    for (const body of calls(readFileSync(file, 'utf8'))) {
      seen++;
      const keys = topLevelKeys(body);
      const bad = keys.filter((k) => !ALLOWED.has(k));
      const missing = REQUIRED.filter((k) => !keys.includes(k));
      if (bad.length || missing.length) {
        offenders.push(`${relative(pluginRoot, file)}: report_query({${body}}) — unknown [${bad}] missing [${missing}]`);
      }
    }
  }
  assert.ok(seen > 0, 'expected at least one report_query call in the docs');
  assert.equal(offenders.length, 0, offenders.join('\n'));
});

const NETWORK_SCOPED = ['list_dimension_sets', 'get_dimension_set', 'get_zone_report', 'get_event_stats_keys'];

test('every network-scoped tool call passes network_id', () => {
  const offenders = [];
  let seen = 0;
  for (const file of docs) {
    const src = readFileSync(file, 'utf8');
    for (const tool of NETWORK_SCOPED) {
      // Zero-arg form (`tool()`) can't carry network_id at all — the schema requires it.
      if (new RegExp(`\\b${tool}\\(\\s*\\)`).test(src)) offenders.push(`${relative(pluginRoot, file)}: ${tool}() — network_id is required`);
      for (const body of calls(src, tool)) {
        seen++;
        if (!topLevelKeys(body).includes('network_id')) offenders.push(`${relative(pluginRoot, file)}: ${tool}({${body}})`);
      }
    }
  }
  assert.ok(seen > 0, 'expected at least one network-scoped tool call in the docs');
  assert.equal(offenders.length, 0, offenders.join('\n'));
});

test('every skill that calls report_query points at the dimension check', () => {
  const offenders = [];
  for (const file of walk(join(pluginRoot, 'skills'))) {
    if (file.includes(`${join('skills', '_shared')}`)) continue;
    const src = readFileSync(file, 'utf8');
    if (src.includes('report_query({') && !src.includes('_shared/dimension-discovery.md')) {
      offenders.push(relative(pluginRoot, file));
    }
  }
  assert.equal(offenders.length, 0, `missing dimension-check reference:\n${offenders.join('\n')}`);
});
