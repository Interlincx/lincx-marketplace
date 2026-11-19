import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(resolve(here, '..', 'skills', 'advertiser-editor', 'SKILL.md'), 'utf8');
// a missing heading fails loudly instead of slicing the wrong text; no `to` = to the end of the file
const section = (from, to) => {
  const a = skill.indexOf(from);
  const b = to === undefined ? skill.length : skill.indexOf(to);
  assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
  return skill.slice(a, b);
};

test('create: duplicate check, then confirmation', () => {
  const create = section('## Create checklist', '## Rename checklist');
  assert.ok(create.indexOf('list_advertisers') > -1, 'duplicate check');
  assert.ok(create.indexOf('explicit confirmation') > create.indexOf('list_advertisers'), 'confirmation after the duplicate check');
});

test('rename: read, owner warning, then confirmation', () => {
  const rename = section('## Rename checklist', '## Reading the result');
  const at = (s) => rename.indexOf(s);
  assert.ok(at('get_advertiser') > -1, 'reads the advertiser');
  assert.ok(at('auth_status') > at('get_advertiser'), 'compares the owner with the caller');
  assert.ok(at('may lose access') > -1, 'says what the owner change costs');
  assert.ok(at('explicit confirmation') > at('may lose access'), 'confirmation after the owner warning');
});

test('the build order names the other editors, not their tools', () => {
  const order = section('## Setting up a new advertiser end to end', '## Create checklist');
  for (const s of ['campaign-editor', 'creative-editor', 'ad-group-editor', 'ad-editor']) assert.match(order, new RegExp(`\`${s}\``), s);
  assert.doesNotMatch(order, /`(create|update)_/, 'no other entity write tool named here');
  assert.match(order, /Never chain several writes from one confirmation/);
});

test('the duplicate check matches the tool: active only, and never the advertiser being renamed', () => {
  assert.match(section('## Create checklist', '## Rename checklist'), /\*\*active\*\* \(not archived\)/);
  assert.match(section('## Rename checklist', '## Reading the result'), /ignoring the advertiser being renamed/);
});

test('every refusal text the tools return is mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['MAY have been created/applied', 'most likely applied', 'already named', 'Nothing to change', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden', 'could not read the network\'s advertisers']) assert.ok(results.includes(text), text);
});
