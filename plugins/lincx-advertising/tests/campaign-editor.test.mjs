import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(resolve(here, '..', 'skills', 'campaign-editor', 'SKILL.md'), 'utf8');
// a missing heading fails loudly instead of slicing the wrong text; no `to` = to the end of the file
const section = (from, to) => {
  const a = skill.indexOf(from);
  const b = to === undefined ? skill.length : skill.indexOf(to);
  assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
  return skill.slice(a, b);
};

test('create: advertiser, duplicate check, then confirmation', () => {
  const create = section('## Create checklist', '## Update checklist');
  const at = (s) => create.indexOf(s);
  assert.ok(at('get_advertiser') > -1, 'resolves the advertiser');
  assert.ok(at('list_campaigns') > at('get_advertiser'), 'duplicate check');
  assert.ok(at('explicit confirmation') > at('list_campaigns'), 'confirmation after the duplicate check');
});

test('update: read, blast radius, then confirmation', () => {
  const update = section('## Update checklist', '## Reading the result');
  const at = (s) => update.indexOf(s);
  assert.ok(at('get_campaign') > -1, 'reads the campaign');
  assert.ok(at('list_ad_groups') > at('get_campaign'), 'counts the ad groups it reaches');
  assert.ok(at('explicit confirmation') > at('list_ad_groups'), 'confirmation after the count');
});

test('dates are UTC with an inclusive end, and null clears', () => {
  const dates = section('## Dates', '## Create checklist');
  assert.match(dates, /UTC/);
  assert.match(dates, /inclusive/);
  assert.match(dates, /`null` removes a bound/);
});

test('the duplicate check ignores case', () => {
  assert.match(section('## Create checklist', '## Update checklist'), /case doesn't matter/);
});

test('every refusal text the tools return is mapped', () => {
  const results = section('## Reading the result', '## What you never do');
  for (const text of ['MAY have been created/applied', 'most likely applied', 'did not apply', 'dateStart must be on or before dateEnd', 'is after dateEnd', 'is already past', 'Nothing to change', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden']) assert.ok(results.includes(text), text);
});

test('update: enabling names the untargeted ad groups', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /fields: \[[^\]]*'params\.zoneId'/);
  assert.match(update, /every enabled ad group with no `params\.zoneId`/);
  assert.match(section('## What you never do'), /no zone targeting/);
});

test('update: serving-now comes from the tools, not the model clock', () => {
  const update = section('## Update checklist', '## Reading the result');
  assert.match(update, /Don't work out from your own clock/);
  assert.match(update, /to stop a campaign that starts today, use `enabled: false`/);
});
