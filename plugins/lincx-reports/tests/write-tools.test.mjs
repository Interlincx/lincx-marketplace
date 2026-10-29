import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, '..', 'skills');
const WRITE_TOOLS = ['create_dimension_set', 'add_dimensions_to_set'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

const mentions = (src) => WRITE_TOOLS.filter((t) => src.includes(`\`${t}`));
const writers = [...walk(skillsRoot)].map((file) => ({ file, src: readFileSync(file, 'utf8') })).filter(({ src }) => mentions(src).length);

test('the write tools are referenced somewhere', () => {
  assert.ok(writers.length >= 2, `expected the builder skill and mcp-call-patterns, got ${writers.length}`);
});

test('every file naming a write tool states the confirmation rule and the review-every-set step', () => {
  const offenders = [];
  for (const { file, src } of writers) {
    if (!/explicit confirmation/i.test(src)) offenders.push(`${file}: no "explicit confirmation" rule`);
    if (!/every set/i.test(src)) offenders.push(`${file}: no "every set" review step`);
  }
  assert.equal(offenders.length, 0, offenders.join('\n'));
});

test('the builder checklist loads the catalog and reviews it before any write tool', () => {
  const src = readFileSync(join(skillsRoot, 'lincx-report-builder', 'SKILL.md'), 'utf8');
  const checklist = src.slice(src.indexOf('## Checklist'), src.indexOf('## Naming'));
  const at = (s) => checklist.indexOf(s);
  assert.ok(at('list_dimension_sets') > -1, 'checklist loads the catalog');
  assert.ok(at('Review every set') > at('list_dimension_sets'), 'review comes after the catalog load');
  const firstWrite = Math.min(...WRITE_TOOLS.map(at).filter((i) => i > -1));
  assert.ok(firstWrite > at('Review every set'), 'first write tool comes after the review');
  assert.match(checklist, /explicit confirmation/i);
  assert.match(checklist, /allowNewDimensions/);
});

test('only the builder and the shared call patterns name a write tool', () => {
  const allowed = ['lincx-report-builder', '_shared'];
  const strays = writers.map(({ file }) => file).filter((f) => !allowed.some((a) => f.includes(`${a}/`) || f.includes(`${a}\\`)));
  assert.deepEqual(strays, []);
});
