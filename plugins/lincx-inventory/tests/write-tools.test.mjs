import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, '..', 'skills');
const WRITE_TOOLS = ['create_zone', 'update_zone'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

const writers = [...walk(skillsRoot)]
  .map((file) => ({ file, src: readFileSync(file, 'utf8') }))
  .filter(({ src }) => WRITE_TOOLS.some((t) => src.includes(`\`${t}`)));

const editor = readFileSync(join(skillsRoot, 'zone-editor', 'SKILL.md'), 'utf8');
const section = (from, to) => editor.slice(editor.indexOf(from), editor.indexOf(to));

test('only the zone-editor skill names a zone write tool', () => {
  assert.deepEqual(writers.map(({ file }) => file).filter((f) => !f.includes(`${join('zone-editor', 'SKILL.md')}`)), []);
});

test('every file naming a zone write tool states the confirmation rule', () => {
  for (const { file, src } of writers) assert.match(src, /explicit confirmation/i, file);
});

test('the create checklist checks for a duplicate and confirms before writing', () => {
  const create = section('## Create checklist', '## Update checklist');
  assert.ok(create.indexOf('list_zones') > -1, 'duplicate check');
  assert.ok(create.indexOf('explicit confirmation') > create.indexOf('list_zones'), 'confirmation after the duplicate check');
});

test('the update checklist reads the zone, then confirms, before the write', () => {
  const update = section('## Update checklist', '## Reading the result');
  const at = (s) => update.indexOf(s);
  assert.ok(at('get_zone`') > -1, 'reads the zone');
  assert.ok(at('explicit confirmation') > at('get_zone`'), 'confirmation after the read');
  assert.ok(at('get_zone_eligible_ad_groups') > -1, 'eligibility read on a template/CAG change');
});

test('a write that may have landed is re-read, never retried blind', () => {
  assert.match(section('## Reading the result', '## What you never do'), /Never retry blind/);
});
