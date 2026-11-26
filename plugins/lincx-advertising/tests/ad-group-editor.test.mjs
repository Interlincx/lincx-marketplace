import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(resolve(here, '..', 'skills', 'ad-group-editor', 'SKILL.md'), 'utf8');
// a missing heading fails loudly instead of slicing the wrong text; no `to` = to the end of the file
const section = (from, to) => {
  const a = skill.indexOf(from);
  const b = to === undefined ? skill.length : skill.indexOf(to);
  assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
  return skill.slice(a, b);
};

test('create: campaign, CAG, zones, duplicate check, free-radical warning, then confirmation', () => {
  const create = section('## Create checklist', '## Update checklist');
  const at = (s) => create.indexOf(s);
  assert.ok(at('get_campaign') > -1, 'resolves the campaign');
  assert.ok(at('list_creative_asset_groups') > at('get_campaign'), 'picks the CAG');
  assert.ok(at('get_zone') > at('list_creative_asset_groups'), 'checks the zones');
  assert.ok(at('list_ad_groups') > at('get_zone'), 'duplicate check');
  assert.ok(at('free radical') > -1, 'warns about an untargeted group');
  assert.ok(at('explicit confirmation') > at('free radical'), 'confirmation after everything');
});

test('update: read, reach before, confirmation, reach after', () => {
  const update = section('## Update checklist', '## Reading the result');
  const at = (s) => update.indexOf(s);
  assert.ok(at('get_ad_group`') > -1, 'reads the group');
  assert.ok(at('get_ad_group_zone_reach') > at('get_ad_group`'), 'reach before');
  assert.ok(at('explicit confirmation') > at('get_ad_group_zone_reach'), 'confirmation after the reads');
  assert.ok(update.lastIndexOf('get_ad_group_zone_reach') > at('explicit confirmation'), 'reach after the write');
});

test('allowUntargeted is only ever passed on the user\'s explicit ask', () => {
  assert.match(section('## Update checklist', '## Reading the result'), /pass it only when the user asked for exactly that/);
  assert.match(section('## What you never do'), /Pass `allowUntargeted` without the user asking/);
});

test('a long zone list is never echoed', () => {
  assert.match(skill, /never echo the whole list/);
});

test('update: switching on an untargeted group is a free radical the user confirms, and the WARNING is repeated', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /enabled with no whitelisted zone/);
  assert.ok(update.indexOf('enabled with no whitelisted zone') < update.indexOf('explicit confirmation'), 'warned before the confirmation');
  assert.match(update, /repeat any WARNING/);
  assert.match(section('## Reading the result', '## What you never do'), /WARNING that the group targets no zone/);
});

test('an enabled untargeted group needs allowUntargeted on create and enable', () => {
  assert.match(section('## Create checklist', '## Update checklist'), /enabled group with no zones is refused unless `allowUntargeted: true`/);
  assert.match(section('## Update checklist', '## Reading the result'), /Switching on a group with none is refused unless `allowUntargeted: true`/);
});

test('every refusal text the tools return is mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['MAY have been created/applied', 'most likely applied', 'targeting lists changed since they were read', 'targeting problem', "could not read the network's event keys", 'is edited with addZoneIds', 'is edited with addExceptZoneIds', 'zone lists changed since they were read', 'in both add and remove', 'not a Lincx targeting key', 'changed since it was read', 'duplicate items', "could not read the network's zones", 'does not show', 'is a free radical', 'makes it a free radical', 'outside its flight window', 'is switched off', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden', 'Nothing to change']) assert.ok(results.includes(text), text);
});

test('targeting keys: the reference is read first, zones stay on the zone fields', () => {
  const t = section('## Targeting keys beyond zones', '## Create checklist');
  assert.match(t, /\$\{CLAUDE_PLUGIN_ROOT\}\/references\/targeting-keys\.md/);
  assert.match(t, /never edited through `params`/);
  const update = section('## Update checklist', '## Reading the result');
  assert.ok(update.indexOf('targeting-keys.md') > -1, 'the update checklist names the reference');
  assert.ok(update.indexOf('targeting-keys.md') < update.indexOf('explicit confirmation'), 'reference before the confirmation');
  assert.match(update, /get_event_stats_keys/);
  assert.ok(update.lastIndexOf('explain_serve') > update.indexOf('explicit confirmation'), 'explain_serve after the write');
});

test('targeting keys: allowNewKeys and set are gated', () => {
  const never = section('## What you never do');
  assert.match(never, /Pass `allowNewKeys` without a confirmed source/);
  assert.match(never, /Build a `set` from memory/);
  assert.doesNotMatch(never, /other targeting keys/, 'targeting is no longer sent to the UI');
});

test('targeting keys: an MCP without params says so, and the reach shift is not read as lost reach', () => {
  assert.match(section('## Targeting keys beyond zones', '## Create checklist'), /has no `params` input .*lincx-mcp#197/);
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /not lost reach/);
  assert.match(update, /`valuesTotal` greater than the `values` shown/);
  assert.match(update, /can't be rebuilt from the proposal/);
  assert.match(update, /an `excludes` condition \(a blacklist\) works with no source/);
  assert.match(update, /goes live immediately everywhere the group serves/);
  assert.match(update, /repeat a schedule from the confirmed proposal/);
});

test('targeting keys: event-only fields are not request keys; slot blocks are soft', async () => {
  const { readFileSync } = await import('node:fs');
  const ref = readFileSync(resolve(here, '..', 'references', 'targeting-keys.md'), 'utf8');
  assert.match(ref, /`siteId`, `channelId`, `experienceId`, `site` or `zone` are \*\*not\*\* request keys/);
  assert.doesNotMatch(ref, /request fields such as `vertical`, `renderMode`, `siteId`/);
  assert.match(ref, /they are \*\*soft\*\*/);
  assert.match(ref, /a tag sending `adFeedCount`/);
  assert.match(ref, /With no count set the default is 1/);
  assert.match(ref, /`requires` \(a whitelist\)/);
  assert.match(ref, /`excludes` \(a blacklist\) means visits carrying a listed value are blocked, and visits without the key pass/);
  assert.match(ref, /a zone's `dataAttributesDefault`, which supplies it/);
  assert.match(ref, /Knowing the key exists is not the same as knowing a whitelist can match/);
  assert.match(section('## Update checklist', '## Reading the result'), /Event fields such as `siteId` are not request keys: to target one site, channel or experience exactly, use its zones/);
  assert.doesNotMatch(skill, /target zones or `channelType` instead/, 'channelType is never a stand-in for an exact target');
});

test('reference: one channelType row, and channelType is a category, not a channel', () => {
  const ref = readFileSync(resolve(here, '..', 'references', 'targeting-keys.md'), 'utf8');
  assert.equal(ref.match(/^\| `channelType` \|/gm).length, 1);
  assert.match(ref, /`channelType` is a category: it also takes in every other zone/);
});
