import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(resolve(here, '..', 'skills', 'ad-editor', 'SKILL.md'), 'utf8');
// a missing heading fails loudly instead of slicing the wrong text; no `to` = to the end of the file
const section = (from, to) => {
  const a = skill.indexOf(from);
  const b = to === undefined ? skill.length : skill.indexOf(to);
  assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
  return skill.slice(a, b);
};

test('create: group, creative, reach, duplicate check, then confirmation', () => {
  const create = section('## Create checklist', '## Update checklist');
  const at = (s) => create.indexOf(s);
  assert.ok(at('get_ad_group`') > -1, 'reads the group');
  assert.ok(at('list_creatives') > at('get_ad_group`'), 'picks the creative');
  assert.ok(at('get_ad_group_zone_reach') > at('list_creatives'), 'says where it will serve');
  assert.ok(at('list_ads') > at('get_ad_group_zone_reach'), 'duplicate check');
  assert.ok(at('explicit confirmation') > at('list_ads'), 'confirmation after the reads');
});

test('update: read, then confirmation; switch-off warns about minTrafficAllocation', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.ok(update.indexOf('explicit confirmation') > update.indexOf('get_ad`'), 'confirmation after the read');
  assert.match(update, /minTrafficAllocation/);
});

test('prices: the user\'s exact value, repeated back, never invented', () => {
  const prices = section('## Prices are money', '## Create checklist');
  assert.match(prices, /exact number the user gave/);
  assert.match(prices, /Never infer, round, convert or carry a price over/);
  assert.match(prices, /Repeat every price back/);
  assert.match(section('## What you never do'), /Invent, round or reuse a price/);
});

test('create reads the campaign, and both create and switch-on say where the ad serves', () => {
  const create = section('## Create checklist', '## Update checklist');
  assert.ok(create.indexOf('get_campaign') > create.indexOf('get_ad_group`'), 'campaign read after the group');
  assert.match(create, /free radical/);
  const update = section('## Update checklist', '## Reading the result');
  assert.ok(update.indexOf('get_ad_group_zone_reach') > -1 && update.indexOf('get_ad_group_zone_reach') < update.indexOf('explicit confirmation'), 'reach before confirming a switch-on');
  assert.match(section('## What you never do'), /Create or switch on an ad without saying where it will serve/);
});

test('a creative swap reads the group\'s CAG first', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.ok(update.indexOf('`get_ad_group` with the ad') > -1 && update.indexOf('`get_ad_group` with the ad') < update.indexOf('list_creatives'));
});

test('prices: > 0, the sanity caps, and null removes', () => {
  const prices = section('## Prices are money', '## Create checklist');
  assert.match(prices, /greater than 0/);
  assert.match(prices, /cpc 1000, cpa 10000/);
  assert.match(section('## Update checklist', '## Reading the result'), /`null` removes a price/);
});

test('every refusal text the tools return is mapped, with the real traffic-allocation message', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['MAY have been created/applied', 'most likely applied', 'did not apply', 'Sum of ads traffic allocations within AdGroup should be equal or lower than 100%', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden', 'Nothing to change']) assert.ok(results.includes(text), text);
  assert.doesNotMatch(results, /already allocate 100%/);
});

test('update: test creatives, the reach step on a swap, and a softened allocation note', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /testCreativesStatus: 'on'/);
  assert.match(update, /swapping the creative of an enabled ad\?\*\* `get_ad_group_zone_reach/);
  assert.match(update, /usually dropped for good/);
  assert.doesNotMatch(skill, /re-enabling does not bring it back/);
});

test('the new tool results are mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['changed since it was read', 'WARNING that the ad group targets no zone', 'Test creatives are on', 'was dropped', 'pick another creative']) assert.ok(results.includes(text), text);
});
