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

test('ad-level targeting: reference, the group read beside it, conditions after', () => {
  const t = section('## Ad-level targeting', '## Create checklist');
  assert.match(t, /\$\{CLAUDE_PLUGIN_ROOT\}\/references\/targeting-keys\.md/);
  assert.match(t, /run \*\*after\*\* the ad group's/);
  assert.match(t, /has no `params` input .*lincx-mcp#197/);
  const update = section('## Update checklist', '## Reading the result');
  assert.ok(update.indexOf('targeting-keys.md') > -1, 'the update checklist names the reference');
  assert.ok(update.indexOf('targeting-keys.md') < update.indexOf('explicit confirmation'), 'reference before the confirmation');
  assert.match(update, /`get_ad_group`\): show the group's rule/);
  assert.match(update, /get_event_stats_keys/);
  assert.ok(update.lastIndexOf('conditions') > update.indexOf('explicit confirmation'), 'conditions read after the write');
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['targeting problem', 'not a Lincx targeting key', 'in both add and remove', "could not read the network's event keys", "could not read the network's zones", 'not in ad group … zone whitelist', "in ad group …'s blacklist", "the group's list replaces the ad's"]) assert.ok(results.includes(text), text);
  const never = section('## What you never do');
  assert.match(never, /Pass `allowNewKeys` without a confirmed source/);
  assert.doesNotMatch(never, /ad-level targeting/);
});

test('ad-level targeting: a capped condition list, the unreported keys, and dropping the ad\'s last zone', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /`valuesTotal` greater than the `values` shown/);
  assert.match(update, /can't be rebuilt from the proposal/);
  assert.match(update, /the reference lists the few request keys it never reports/);
  assert.match(update, /Removing the ad's last `params.zoneId` under a group with no zones makes the ad a free radical/);
  assert.match(update, /unless the ad has its own `params.zoneId`/);
  assert.match(section('## Reading the result', '## What you never do'), /An input validation error on `params` \/ `exceptParams`/);
});

test('ad-level targeting: effective eligibility from the top level, hard vs default zone limits', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /read the top-level `verdict` and `conditions` back/);
  assert.match(update, /`excludedByDefault`\) is a valid target/);
  assert.doesNotMatch(update, /read the `offer` `conditions` back/);
});

test('ad-level targeting: a blacklist condition needs no source; a zone default is a source', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /an `excludes` condition \(a blacklist\) works with no source/);
  assert.match(update, /`get_zone` shows a listed value in the `dataAttributesDefault` of a zone the entity can still reach after the edit/);
  assert.match(update, /say no matching traffic is verified before asking for confirmation/);
});

test('channelType is never offered as a stand-in for an exact site / channel target', () => {
  assert.doesNotMatch(skill, /target zones or `channelType` instead/);
  assert.match(section('## Update checklist', '## Reading the result'), /offer it only when the user wants the whole category/);
});
