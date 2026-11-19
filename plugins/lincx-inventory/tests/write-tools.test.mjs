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
  const update = section('## Update checklist', '## Forced ads and ad groups');
  const at = (s) => update.indexOf(s);
  assert.ok(at('get_zone`') > -1, 'reads the zone');
  assert.ok(at('explicit confirmation') > at('get_zone`'), 'confirmation after the read');
  assert.ok(at('get_zone_eligible_ad_groups') > -1, 'eligibility read on a template/CAG change');
});

test('a write that may have landed is re-read, never retried blind', () => {
  assert.match(section('## Reading the result', '## What you never do'), /Never retry blind/);
});

test('forced checks run before the update proposal, which is confirmed once, in 1-based slots', () => {
  const update = section('## Update checklist', '## Forced ads and ad groups');
  const forced = section('## Forced ads and ad groups', '## Reading the result');
  const at = (s) => update.indexOf(s);
  assert.ok(at('**Read the zone** with `get_zone`') > -1, 'reads the zone');
  assert.ok(at('forced-ads section') > at('**Read the zone** with `get_zone`'), 'forced checks after the read');
  assert.ok(at('**Show current → proposed**') > at('forced-ads section'), 'proposal after the forced checks');
  assert.ok(at('explicit confirmation') > at('**Show current → proposed**'), 'confirmation after the proposal');
  assert.match(update, /Segment ids change on every zone save/);
  assert.ok(forced.includes('explain_serve'), 'forced eligibility check');
  assert.ok(!forced.includes('explicit confirmation'), 'the forced section has no second confirm/write step');
  assert.match(forced, /return to the Update checklist/);
  assert.match(forced, /1-based/);
  assert.match(forced, /replaces the zone's/, 'a segment override is explained');
});

test('the forced eligibility check branches on verdict, and settings-only edits skip it', () => {
  const forced = section('## Forced ads and ad groups', '## Reading the result');
  for (const v of ['`eligible`', '`conditional`', '`excluded`']) assert.ok(forced.includes(v), v);
  assert.match(forced, /never on `eligible`/, 'the eligible boolean is false for conditional results too');
  assert.match(forced, /A removal \(`null`\) needs no check/);
  assert.match(forced, /With an `adGroupId`[^\n]*get_zone_eligible_ad_groups/, 'a forced ad group is checked for a live ad that serves');
  assert.match(forced, /`offers\.conditionalLive` > 0/, 'a group whose live ads are all conditional still fills the slot on their visits');
  assert.match(forced, /stored 0-based position: say slot N\+1/, 'upstream slot numbers are 0-based');
  assert.match(section('## Update checklist', '## Forced ads and ad groups'), /no eligibility check/, 'feed size / explore / experience alone');
});
