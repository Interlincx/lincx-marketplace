import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One table for every editor skill. Per skill:
 *   order   — [from, to, [tokens…]]: each token is in the section, in this order
 *   has     — [from, to, [string | RegExp…]]: each is in the section
 *   lacks   — [from, to, [RegExp…]]: none is in the section
 *   results — refusal texts the tools return, each mapped under "Reading the result"
 * `from` undefined = the whole skill; `to` undefined = to the end of the file.
 */
const CREATE = '## Create checklist';
const UPDATE = '## Update checklist';
const RENAME = '## Rename checklist';
const RESULTS = '## Reading the result';
const NEVER = '## What you never do';
const COMMON_RESULTS = ['MAY have been created/applied', 'most likely applied', 'Nothing to change', 'belongs to network', 'is not in network', 'is archived', 'not found', 'Forbidden'];

const SPECS = {
  'advertiser-editor': {
    order: [
      [CREATE, RENAME, ['list_advertisers', 'explicit confirmation']],
      [RENAME, RESULTS, ['get_advertiser', 'auth_status', 'may lose access', 'explicit confirmation']],
    ],
    has: [
      ['## Setting up a new advertiser end to end', CREATE, ['`campaign-editor`', '`creative-editor`', '`ad-group-editor`', '`ad-editor`', 'Never chain several writes from one confirmation']],
      [CREATE, RENAME, ['**active** (not archived)']],
      [RENAME, RESULTS, ['ignoring the advertiser being renamed']],
    ],
    // the build order names the other editors, not their tools
    lacks: [['## Setting up a new advertiser end to end', CREATE, [/`(create|update)_/]]],
    results: ['already named', "could not read the network's advertisers"],
  },
  'campaign-editor': {
    order: [
      [CREATE, UPDATE, ['get_advertiser', 'list_campaigns', 'explicit confirmation']],
      [UPDATE, RESULTS, ['get_campaign', 'list_ad_groups', 'explicit confirmation']],
    ],
    has: [
      ['## Dates', CREATE, ['UTC', 'inclusive', '`null` removes a bound']],
      [CREATE, UPDATE, ["case doesn't matter"]],
      [UPDATE, RESULTS, [/fields: \[[^\]]*'params\.zoneId'/, 'every enabled ad group with no `params.zoneId`', "Don't work out from your own clock", 'to stop a campaign that starts today, use `enabled: false`']],
      [NEVER, undefined, ['no zone targeting']],
    ],
    results: ['did not apply', 'dateStart must be on or before dateEnd', 'is after dateEnd', 'is already past'],
  },
  'ad-group-editor': {
    order: [
      [CREATE, UPDATE, ['get_campaign', 'list_creative_asset_groups', 'get_zone', 'list_ad_groups']],
      [CREATE, UPDATE, ['free radical', 'explicit confirmation']],
      [UPDATE, RESULTS, ['get_ad_group`', 'get_ad_group_zone_reach', 'explicit confirmation']],
      [UPDATE, RESULTS, ['enabled with no whitelisted zone', 'explicit confirmation']],
    ],
    has: [
      [CREATE, UPDATE, ['enabled group with no zones is refused unless `allowUntargeted: true`']],
      [UPDATE, RESULTS, ['pass it only when the user asked for exactly that', 'repeat any WARNING', 'Switching on a group with none is refused unless `allowUntargeted: true`']],
      [RESULTS, NEVER, ['WARNING that the group targets no zone']],
      [NEVER, undefined, ['Pass `allowUntargeted` without the user asking']],
      [undefined, undefined, ['never echo the whole list']],
    ],
    results: ['zone lists changed since they were read', 'changed since it was read', 'duplicate items', "could not read the network's zones", 'does not show', 'is a free radical', 'makes it a free radical', 'outside its flight window', 'is switched off'],
    extra(section) {
      const update = section(UPDATE, RESULTS);
      assert.ok(update.lastIndexOf('get_ad_group_zone_reach') > update.indexOf('explicit confirmation'), 'reach is read again after the write');
    },
  },
  'ad-editor': {
    order: [
      [CREATE, UPDATE, ['get_ad_group`', 'list_creatives', 'get_ad_group_zone_reach', 'list_ads', 'explicit confirmation']],
      [CREATE, UPDATE, ['get_ad_group`', 'get_campaign']],
      [UPDATE, RESULTS, ['get_ad`', 'explicit confirmation']],
      [UPDATE, RESULTS, ['get_ad_group_zone_reach', 'explicit confirmation']],
      // a creative swap reads the group's CAG first
      [UPDATE, RESULTS, ['`get_ad_group` with the ad', 'list_creatives']],
    ],
    has: [
      ['## Prices are money', CREATE, ['exact number the user gave', 'Never infer, round, convert or carry a price over', 'Repeat every price back', 'greater than 0', 'cpc 1000, cpa 10000']],
      [CREATE, UPDATE, ['free radical']],
      [UPDATE, RESULTS, ['minTrafficAllocation', '`null` removes a price', "testCreativesStatus: 'on'", 'swapping the creative of an enabled ad?** `get_ad_group_zone_reach', 'usually dropped for good']],
      [NEVER, undefined, ['Invent, round or reuse a price', 'Create or switch on an ad without saying where it will serve']],
    ],
    lacks: [
      [RESULTS, NEVER, [/already allocate 100%/]],
      [undefined, undefined, [/re-enabling does not bring it back/]],
    ],
    results: ['did not apply', 'Sum of ads traffic allocations within AdGroup should be equal or lower than 100%', 'changed since it was read', 'WARNING that the ad group targets no zone', 'Test creatives are on', 'was dropped', 'pick another creative'],
  },
  'creative-editor': {
    order: [
      [CREATE, UPDATE, ['get_advertiser', 'get_creative_asset_group', 'list_creatives', 'explicit confirmation']],
      [UPDATE, RESULTS, ['get_creative`', 'list_ads', 'explicit confirmation', 'On the confirming turn, re-read']],
    ],
    has: [
      ['## What a creative holds', CREATE, ['never make it up', 'a field with an `enum` array takes exactly one of those values']],
      [UPDATE, RESULTS, ["'archived'", '**non-archived** ads', '**whole network**', "'testCreatives'"]],
      [NEVER, undefined, ['Make up ad copy, a click URL or an image URL']],
      [undefined, undefined, ['already hosted']],
    ],
    lacks: [
      ['## What a creative holds', CREATE, [/one of a fixed list \(`enum`\)/]],
      [UPDATE, RESULTS, [/list_ads\(\{ network_id, advertiserId/]],
    ],
    results: ['field problem(s)', 'url must be an http(s) URL', 'url has an unbalanced {{macro}}', 'did not apply', 'changed since it was read', "doesn't pass `{{clickId}}`"],
  },
};

const here = dirname(fileURLToPath(import.meta.url));

for (const [name, spec] of Object.entries(SPECS)) {
  const skill = readFileSync(resolve(here, '..', 'skills', name, 'SKILL.md'), 'utf8');
  // a missing heading fails loudly instead of slicing the wrong text
  const section = (from, to) => {
    const a = from === undefined ? 0 : skill.indexOf(from);
    const b = to === undefined ? skill.length : skill.indexOf(to);
    assert.ok(a > -1 && b > a, `section ${from} → ${to ?? 'end'}`);
    return skill.slice(a, b);
  };
  const found = (text, what) => (what instanceof RegExp ? what.test(text) : text.includes(what));

  test(`${name}: reads come before the confirmation, in order`, () => {
    for (const [from, to, tokens] of spec.order) {
      const text = section(from, to);
      let last = -1;
      for (const token of tokens) {
        const at = text.indexOf(token);
        assert.ok(at > last, `${from}: "${token}" is missing or out of order in [${tokens.join(' → ')}]`);
        last = at;
      }
    }
    spec.extra?.(section);
  });

  test(`${name}: the entity's own rules are stated`, () => {
    for (const [from, to, items] of spec.has) for (const item of items) assert.ok(found(section(from, to), item), `${from ?? 'skill'}: ${item}`);
    for (const [from, to, items] of spec.lacks ?? []) for (const item of items) assert.ok(!found(section(from, to), item), `${from ?? 'skill'}: must not say ${item}`);
  });

  test(`${name}: every refusal text the tools return is mapped`, () => {
    const results = section(RESULTS, NEVER);
    for (const text of [...COMMON_RESULTS, ...spec.results]) assert.ok(results.includes(text), text);
  });
}
