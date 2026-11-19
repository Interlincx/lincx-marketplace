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
  for (const text of ['MAY have been created/applied', 'most likely applied', 'zone lists changed since they were read', 'changed since it was read', 'duplicate items', "could not read the network's zones", 'does not show', 'is a free radical', 'makes it a free radical', 'outside its flight window', 'is switched off', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden', 'Nothing to change']) assert.ok(results.includes(text), text);
});
