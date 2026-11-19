import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Rules every editor skill in this plugin shares. A skill names its own entity's
 * write tools and no other's — the build order points at the other skills by name —
 * so each write tool has exactly one skill gating it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(here, '..', 'skills');
const WRITE_RE = /`((?:create|update)_[a-z_]+)/g;

// folders only: a stray file such as .DS_Store is not a skill
const skills = readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
  .map(({ name }) => ({ name, src: readFileSync(join(skillsRoot, name, 'SKILL.md'), 'utf8') }));
// exact token: `create_ad` must not match `create_advertiser` / `create_ad_group`
const names = (src, tool) => new RegExp(`\`${tool}[\`(]`).test(src);
const writersOf = (tool) => skills.filter(({ src }) => names(src, tool)).map(({ name }) => name);
const allWriteTools = [...new Set(skills.flatMap(({ src }) => [...src.matchAll(WRITE_RE)].map((m) => m[1])))];

test('the plugin has skills and they name write tools', () => {
  assert.ok(skills.length > 0);
  assert.ok(allWriteTools.length > 0, 'no create_/update_ tool named anywhere — the matcher is broken');
});

test('a write tool name never matches a longer one', () => {
  assert.ok(names('`create_advertiser`', 'create_advertiser'));
  assert.ok(!names('`create_advertiser`', 'create_ad'));
  assert.ok(!names('`create_ad_group({ network_id })`', 'create_ad'));
  assert.ok(names('`create_ad({ network_id })`', 'create_ad'));
});

test('each write tool is gated by exactly one skill', () => {
  for (const tool of allWriteTools) assert.equal(writersOf(tool).length, 1, `${tool}: ${writersOf(tool).join(', ')}`);
});

for (const { name, src } of skills) {
  test(`${name}: the shared rules are stated`, () => {
    assert.match(src, /## Network/, 'network section');
    assert.match(src, /Never guess, and never default to the first one/, 'never pick a network');
    assert.match(src, /explicit confirmation/i, 'confirmation rule');
    assert.match(src, /most recent message/, 'confirmation must be in the latest message');
    assert.match(src, /Never retry blind/, 'a write that may have landed is re-read');
    assert.match(src, /doesn't offer it yet and stop/, 'stops when the tool is missing');
    assert.match(src, /## What you never do/, 'never-do section');
  });
}
