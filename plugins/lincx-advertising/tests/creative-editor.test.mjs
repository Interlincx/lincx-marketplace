import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(resolve(here, '..', 'skills', 'creative-editor', 'SKILL.md'), 'utf8');
// a missing heading fails loudly instead of slicing the wrong text; no `to` = to the end of the file
const section = (from, to) => {
  const a = skill.indexOf(from);
  const b = to === undefined ? skill.length : skill.indexOf(to);
  assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
  return skill.slice(a, b);
};

test('create: advertiser, CAG read, duplicate check, then confirmation', () => {
  const create = section('## Create checklist', '## Update checklist');
  const at = (s) => create.indexOf(s);
  assert.ok(at('get_advertiser') > -1, 'resolves the advertiser');
  assert.ok(at('get_creative_asset_group') > at('get_advertiser'), 'reads the CAG fields');
  assert.ok(at('list_creatives') > at('get_creative_asset_group'), 'duplicate check');
  assert.ok(at('explicit confirmation') > at('list_creatives'), 'confirmation after the reads');
});

test('update: read, count the ads using it, then confirmation', () => {
  const update = section('## Update checklist', '## Reading the result');
  const at = (s) => update.indexOf(s);
  assert.ok(at('get_creative`') > -1, 'reads the creative');
  assert.ok(at('list_ads') > at('get_creative`'), 'counts the ads that show it');
  assert.ok(at('explicit confirmation') > at('list_ads'), 'confirmation after the count');
});

test('copy and URLs come from the user, never made up', () => {
  assert.match(section('## What a creative holds', '## Create checklist'), /never make it up/);
  assert.match(section('## What you never do'), /Make up ad copy, a click URL or an image URL/);
  assert.match(skill, /already hosted/);
});

test('the ad count leaves archived ads out', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /'archived'/);
  assert.match(update, /\*\*non-archived\*\* ads/);
});

test('enum is a list of allowed values, not a type', () => {
  const holds = section('## What a creative holds', '## Create checklist');
  assert.match(holds, /a field with an `enum` array takes exactly one of those values/);
  assert.doesNotMatch(holds, /one of a fixed list \(`enum`\)/);
});

test('every refusal text the tools return is mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['MAY have been created/applied', 'most likely applied', 'field problem(s)', 'url must be an http(s) URL', 'url has an unbalanced {{macro}}', 'did not apply', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden', 'Nothing to change']) assert.ok(results.includes(text), text);
});

test('update: counts ads network-wide, test creatives included, and re-reads on the confirming turn', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /\*\*whole network\*\*/);
  assert.match(update, /'testCreatives'/);
  assert.doesNotMatch(update, /list_ads\(\{ network_id, advertiserId/);
  assert.ok(update.indexOf('On the confirming turn, re-read') > update.indexOf('explicit confirmation'), 're-read after the confirmation, before the write');
});

test('the new tool results are mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['changed since it was read', "doesn't pass `{{clickId}}`"]) assert.ok(results.includes(text), text);
});
