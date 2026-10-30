import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cagDiff, cagSessionSchema, cssScopeProblems } from '../scripts/restyle-lib.mjs';
import { run } from '../scripts/restyle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '../skills/lincx-template-playbook');
const TYPES = ['offer-wall', 'listicle'];
const FILES = ['template.html', 'styles.css', 'cag.json', 'mock-ads.json', 'SOURCE.md'];
const dir = (t) => join(skill, 'references/baselines', t);
const text = (t, f) => readFileSync(join(dir(t), f), 'utf8');

test('every bundled baseline has all its files', () => {
  for (const t of TYPES) for (const f of FILES) assert.ok(existsSync(join(dir(t), f)), `${t}/${f} missing`);
});

test('each bundled file still matches the sha256 in its SOURCE.md', () => {
  for (const t of TYPES) {
    const listed = [...text(t, 'SOURCE.md').matchAll(/`([a-z.-]+)` sha256 `([0-9a-f]{64})`/g)];
    assert.deepEqual(listed.map((m) => m[1]).sort(), ['cag.json', 'mock-ads.json', 'styles.css', 'template.html'], `${t}: hashes listed`);
    for (const [, file, hash] of listed) {
      assert.equal(createHash('sha256').update(readFileSync(join(dir(t), file))).digest('hex'), hash, `${t}/${file} changed without a new version and hash`);
    }
  }
});

test('the bundled html and css pass the scope check and their adapter wrapper is in the css', () => {
  for (const t of TYPES) {
    const adapter = JSON.parse(readFileSync(join(skill, 'adapters', `${t}.json`), 'utf8'));
    assert.deepEqual(cssScopeProblems(text(t, 'template.html'), text(t, 'styles.css')), [], t);
    assert.ok(text(t, 'styles.css').includes(adapter.wrapper), `${t}: wrapper ${adapter.wrapper}`);
  }
});

test('cag.json carries the fields the adapter says the template expects', () => {
  for (const t of TYPES) {
    const adapter = JSON.parse(readFileSync(join(skill, 'adapters', `${t}.json`), 'utf8'));
    assert.deepEqual(cagSessionSchema(JSON.parse(text(t, 'cag.json'))).fields.map((f) => f.name), adapter.cagFields, t);
  }
});

test('baselines.md lists each bundled type with a path that exists, and the carousel as not bundled', () => {
  const md = readFileSync(join(skill, 'baselines.md'), 'utf8');
  for (const t of TYPES) assert.ok(md.includes(`\`references/baselines/${t}/\``), t);
  assert.match(md, /\| carousel \| v1 \| not bundled/);
});

test('baseline copies the bundle and writes a session-shaped schema, with no network input', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'bl-')), 'work');
  const { files } = run(['baseline', '--type', 'listicle', '--dir', out]);
  assert.equal(files.length, 4);
  assert.equal(readFileSync(join(out, 'template.html'), 'utf8'), text('listicle', 'template.html'));
  const schema = JSON.parse(readFileSync(join(out, 'cag-schema.json'), 'utf8'));
  assert.ok(schema.fields.length > 0 && schema.fields.every((f) => f.name && f.type));
  assert.ok(Array.isArray(JSON.parse(readFileSync(join(out, 'mock-ads.json'), 'utf8')).ads));
  assert.throws(() => run(['baseline', '--type', 'carousel']), /no bundled baseline "carousel"/);
});

test('restyle uses the bundled css when --css is not given', () => {
  const tokens = join(here, 'fixtures/restyle/site-tokens-good.json');
  const out = run(['restyle', '--baseline', 'listicle', '--tokens', tokens]);
  assert.match(out.css, /--lstcl-/);
  assert.equal(out.css.includes(text('listicle', 'styles.css')), false, 'restyled, so not identical to the baseline');
});

test('cag-check: a CAG with every field passes; missing and retyped fields fail; extra fields are fine', () => {
  const cag = JSON.parse(text('offer-wall', 'cag.json'));
  const withExtra = structuredClone(cag);
  withExtra.fieldsOrder.push('extra_field');
  withExtra.fields.properties.extra_field = { type: 'string' };
  assert.deepEqual(cagDiff(cag, withExtra), { ok: true, missing: [], retyped: [], extra: ['extra_field'] });

  const broken = structuredClone(cag);
  delete broken.fields.properties.headline;
  broken.fieldsOrder = broken.fieldsOrder.filter((n) => n !== 'headline');
  broken.fields.properties.src.type = 'string';
  const diff = cagDiff(cag, broken);
  assert.equal(diff.ok, false);
  assert.deepEqual(diff.missing, ['headline']);
  assert.deepEqual(diff.retyped, [{ name: 'src', baseline: 'image', client: 'string' }]);

  const file = join(mkdtempSync(join(tmpdir(), 'cag-')), 'client.json');
  writeFileSync(file, JSON.stringify(broken));
  assert.equal(run(['cag-check', '--type', 'offer-wall', '--cag', file]).ok, false);
});

test('the playbook flow does not fetch a baseline from a network', () => {
  const skillMd = readFileSync(join(skill, 'SKILL.md'), 'utf8');
  const flow = skillMd.slice(skillMd.indexOf('## Baseline flow'), skillMd.indexOf('## Verify'));
  assert.doesNotMatch(flow, /Check the network|Fetch the baseline/i);
  assert.match(skillMd, /do not call `get_template` for a baseline/);
});

test('the portable build keeps both the plugin references and the bundled baselines, and restyle runs from it', () => {
  const out = mkdtempSync(join(tmpdir(), 'portable-'));
  execFileSync('node', [join(here, '../../../scripts/build-portable-skills.mjs'), out], { stdio: 'pipe' });
  const built = join(out, 'lincx-template-playbook');
  for (const f of ['references/CHECKLIST.md', 'references/baselines/offer-wall/template.html', 'references/baselines/listicle/cag.json']) assert.ok(existsSync(join(built, f)), f);
  const tokens = join(here, 'fixtures/restyle/site-tokens-good.json');
  const res = JSON.parse(execFileSync('node', [join(built, 'scripts/restyle.mjs'), 'restyle', '--baseline', 'offer-wall', '--tokens', tokens], { encoding: 'utf8' }));
  assert.match(res.css, /--ow-/);
});
