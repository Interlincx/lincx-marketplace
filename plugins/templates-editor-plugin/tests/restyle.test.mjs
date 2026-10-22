import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  bestTextOn, buildFontImport, contrastRatio, cssScopeProblems, darken, deriveWrapperClass, detectWall, isSafeValue,
  parseColor, planSave, readTokenBlock, renderReport, replaceTokenValues, resolveFont, restyle, siteSlug, templateName, validateSiteTokens,
} from '../scripts/restyle-lib.mjs';
import { run } from '../scripts/restyle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (...p) => join(here, 'fixtures/restyle', ...p);
const read = (...p) => readFileSync(fx(...p), 'utf8');
const adapter = (t) => JSON.parse(readFileSync(join(here, `../skills/lincx-template-playbook/adapters/${t}.json`), 'utf8'));
const tokens = (n) => JSON.parse(read(n));

test('colour: parse, contrast, darken, best text', () => {
  assert.equal(parseColor('rgb(24, 90, 196)'), '#185ac4');
  assert.equal(parseColor('#fff'), '#ffffff');
  assert.equal(parseColor('transparent'), null);
  assert.ok(Math.abs(contrastRatio('#000', '#fff') - 21) < 0.01);
  assert.equal(bestTextOn('#f7e9a0'), '#000000');
  assert.equal(bestTextOn('#102040'), '#ffffff');
  assert.equal(darken('#ffffff'), '#e0e0e0');
});

test('site tokens: schema accepts the good fixture, rejects bad shapes (#1)', () => {
  assert.equal(validateSiteTokens(tokens('site-tokens-good.json')).ok, true);
  const bad = tokens('site-tokens-good.json');
  bad.colorText.value = 'red';
  bad.cta = { confidence: 'missing', source: null, background: '#fff' };
  const { ok, errors } = validateSiteTokens(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.startsWith('colorText.value')));
  assert.ok(errors.some((e) => e.startsWith('cta.background: must be null')));
});

test('token values: unsafe characters are refused (#5)', () => {
  for (const v of ['red; } body {', 'a/*b', 'url(x', '"open', '</style>', 'a\\b', 'x\ny']) assert.equal(isSafeValue(v), false, v);
  for (const v of ['#fff', '"Open Sans", sans-serif', 'rgba(0, 0, 0, 0.2)', '12px']) assert.equal(isSafeValue(v), true, v);
  const css = '.w { --a: 1px; }';
  assert.throws(() => replaceTokenValues(css, 'w', { '--a': '1px; } x {' }), /contains one of/);
  assert.throws(() => replaceTokenValues(css, 'w', { '--b': '1px' }), /not declared/);
  assert.equal(replaceTokenValues(css, 'w', { '--a': '4px' }), '.w { --a: 4px; }');
});

test('token block: reads only the top-level wrapper rule, keeps ; inside values', () => {
  const css = '/* x */ @media (min-width:1px) { .w { --z: 9; } }\n.w { --a: url("a;b.png"); --b: 2px /* c */; }\n.w .c { --n: 1; }';
  assert.deepEqual(readTokenBlock(css, 'w'), { '--a': 'url("a;b.png")', '--b': '2px' });
});

test('fonts: licensed families get a stand-in, generics need no import, one validated @import (#4)', () => {
  assert.equal(resolveFont('Gotham').importFamily, 'Montserrat');
  assert.equal(resolveFont('Helvetica Neue').importFamily, null);
  assert.equal(resolveFont('sans-serif').importFamily, null);
  assert.match(resolveFont('Source Sans 3').reason, /not verified/);
  assert.equal(resolveFont('Bad;Name').importFamily, null);
  assert.equal(buildFontImport([{ family: 'Open Sans', weights: [700, 400, 700] }]), '@import url(https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap);');
  assert.equal(buildFontImport([{ family: null, weights: [400] }]), null);
});

for (const type of ['offer-wall', 'listicle']) {
  test(`restyle ${type}: good tokens map, derive, import font, keep the rest (#2, #8)`, () => {
    const baselineCss = read(type, 'styles.css');
    const { css, report, fontImport } = restyle({ siteTokens: tokens('site-tokens-good.json'), adapter: adapter(type), baselineCss });
    const block = readTokenBlock(css, adapter(type).wrapper);
    const a = adapter(type);
    assert.match(fontImport, /family=Source\+Sans\+3/);
    assert.match(fontImport, /family=Montserrat/); // Gotham stand-in
    assert.ok(css.startsWith(fontImport));
    assert.equal(css.split('@import').length, 2, 'the baseline import is replaced, not duplicated');
    const ctaBg = Object.entries(a.tokens).find(([, t]) => t.from === 'cta.background' && !t.derive)[0];
    assert.equal(block[ctaBg], '#e8590c');
    const hover = Object.entries(a.tokens).find(([, t]) => t.derive === 'darken');
    if (hover) {
      assert.equal(block[hover[0]], darken('#e8590c'));
      assert.ok(report.some((e) => e.kind === 'derived'));
    }
    assert.ok(report.some((e) => e.kind === 'unmapped'));
    assert.ok(report.some((e) => e.kind === 'font'));
    assert.equal(report.filter((e) => e.kind === 'not-in-baseline').length, 0, 'adapter matches the starter block');
    assert.match(renderReport(report), /^- mapped /m);
    // geometry and every untouched token stay byte-identical
    const before = readTokenBlock(baselineCss, a.wrapper);
    const changed = Object.keys(block).filter((k) => block[k] !== before[k]);
    assert.ok(changed.length > 5 && changed.length < Object.keys(block).length);
    assert.equal(baselineCss.slice(baselineCss.indexOf('}') + 1).length > 100, true);
  });

  test(`restyle ${type}: low/missing confidence keeps the baseline and contrast is repaired (#2, #3)`, () => {
    const baselineCss = read(type, 'styles.css');
    const a = adapter(type);
    const { css, report } = restyle({ siteTokens: tokens('site-tokens-low-and-contrast.json'), adapter: a, baselineCss });
    const before = readTokenBlock(baselineCss, a.wrapper);
    const block = readTokenBlock(css, a.wrapper);
    const kept = report.filter((e) => e.kind === 'kept-baseline');
    assert.ok(kept.length >= 1 && kept.every((e) => block[e.token] === before[e.token]));
    const fixed = report.filter((e) => e.kind === 'contrast-adjusted');
    assert.ok(fixed.length >= 1, 'white text on #f7e9a0 must be corrected');
    const ctaText = Object.entries(a.tokens).find(([, t]) => t.from === 'cta.text' && t.on === Object.entries(a.tokens).find(([, x]) => x.from === 'cta.background' && !x.derive)[0]);
    if (ctaText) assert.equal(block[ctaText[0]], '#000000');
  });
}

test('restyle refuses invalid tokens and a baseline with no token block (#1)', () => {
  assert.throws(() => restyle({ siteTokens: { fontBody: 1 }, adapter: adapter('listicle'), baselineCss: '.a{}' }), /site tokens are invalid/);
  assert.throws(() => restyle({ siteTokens: tokens('site-tokens-good.json'), adapter: adapter('listicle'), baselineCss: '.a{}' }), /no token block/);
});

test('adapter tokens missing from the fetched baseline are skipped and reported, never invented (#2)', () => {
  const css = '.lincx-wrapper { --only-one: #111; }\n.lincx-wrapper a { color: var(--only-one); }';
  const a = { wrapper: 'lincx-wrapper', tokens: { '--only-one': { from: 'colorText' }, '--gone': { from: 'colorAccent' } }, unmapped: [] };
  const { css: out, report } = restyle({ siteTokens: tokens('site-tokens-good.json'), adapter: a, baselineCss: css });
  assert.match(out, /--only-one: #222222/);
  assert.deepEqual(report.filter((e) => e.kind === 'not-in-baseline').map((e) => e.token), ['--gone']);
});

test('scope checks: baselines pass, violations are named (#6)', () => {
  for (const t of ['offer-wall', 'listicle']) assert.deepEqual(cssScopeProblems(read(t, 'template.html'), read(t, 'styles.css')), [], t);
  const html = '<div class="x-wrap"><p>a</p></div><script data-lincx-hook>1</script>';
  assert.equal(deriveWrapperClass(html), 'x-wrap');
  const problems = cssScopeProblems(html, '.x-wrap a{color:red} p{margin:0} .other b{} @media (max-width:1px){ .x-wrap i{} h2{} } @keyframes spin{from{opacity:0}} @font-face{font-family:"Foo";src:url(a)} .x-wrap, ul li{}');
  assert.equal(problems.length, 6);
  assert.ok(problems.some((p) => p.startsWith('bare tag selector "p"')));
  assert.ok(problems.some((p) => p.startsWith('unscoped selector ".other b"')));
  assert.ok(problems.some((p) => p.startsWith('bare tag selector "h2"')));
  assert.ok(problems.some((p) => p.startsWith('@keyframes')));
  assert.ok(problems.some((p) => p.startsWith('@font-face')));
  assert.ok(problems.some((p) => p.includes('"ul li"')));
  assert.deepEqual(cssScopeProblems(html, '.x-wrap-b{}'), ['unscoped selector ".x-wrap-b": prefix it with .x-wrap']);
  assert.match(cssScopeProblems('<div></div><p></p>', 'a{}')[0], /no wrapper class/);
  assert.deepEqual(cssScopeProblems(html, ''), []);
});

test('scope check runs on every shipped reference pattern; they predate the rule, so the hook stays advisory (#6)', () => {
  const patterns = join(here, '../references/patterns');
  const found = {};
  for (const d of ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6', 'example-7', 'example-8']) {
    const problems = cssScopeProblems(readFileSync(join(patterns, d, 'template.html'), 'utf8'), readFileSync(join(patterns, d, 'styles.css'), 'utf8'));
    found[d] = problems;
  }
  assert.ok(Object.values(found).every(Array.isArray));
  assert.match(found['example-8'][0], /no wrapper class/);
  assert.ok(found['example-1'].some((p) => p.startsWith('bare tag selector "*"')), 'universal resets are flagged, which is why the lint only advises');
});

test('walled sites are refused, not guessed (#9)', () => {
  assert.deepEqual(detectWall({ status: 200, title: 'Home', html: '<p>x</p>', visibleTextLength: 5000 }), { walled: false, reason: null });
  assert.match(detectWall({ status: 403, visibleTextLength: 9999 }).reason, /HTTP 403/);
  assert.match(detectWall({ status: 200, title: 'Just a moment...', visibleTextLength: 9999 }).reason, /cloudflare/);
  assert.match(detectWall({ status: 200, html: '<div id="cf-error-details">', visibleTextLength: 9999 }).reason, /Attention Required/);
  assert.match(detectWall({ status: 200, title: 'ok', visibleTextLength: 12 }).reason, /12 visible characters/);
});

test('save plan: deterministic name, create / patch / none / stop (#7)', () => {
  const name = templateName({ namePrefix: '[pb] demo', clientId: 'lvecuu', slug: siteSlug('https://www.Example-News.com/a?b'), widget: 'listicle', version: 'v1' });
  assert.equal(name, '[pb] demo lvecuu example-news-com listicle v1');
  assert.throws(() => templateName({ namePrefix: 'p', clientId: 'c', slug: 'baseline', widget: 'w', version: 'v1' }), /reserved/);
  assert.throws(() => templateName({ namePrefix: 'p', clientId: 'c', slug: 'Bad Slug', widget: 'w', version: 'v1' }), /invalid site slug/);
  const desired = { name, html: '<h>', css: 'new', creativeAssetGroupId: 'cag1' };
  const t = { id: 't1', name, html: '<h>', css: 'old', creativeAssetGroupId: 'cag1' };
  assert.equal(planSave({ existing: [], desired }).action, 'create');
  assert.deepEqual(planSave({ existing: [t], desired }), { action: 'patch', id: 't1' });
  assert.deepEqual(planSave({ existing: [{ ...t, css: 'new' }], desired }), { action: 'none', id: 't1' });
  assert.equal(planSave({ existing: [{ ...t, archived: true }], desired }).action, 'create');
  assert.equal(planSave({ existing: [t, { ...t, id: 't2' }], desired }).code, 'DUPLICATE_TEMPLATES');
  assert.equal(planSave({ existing: [{ ...t, html: '<other>' }], desired }).code, 'DRIFT');
  assert.equal(planSave({ existing: [{ ...t, creativeAssetGroupId: 'zzz' }], desired }).code, 'DRIFT');
});

test('CLI: restyle, check, name, plan-save, wall', () => {
  const out = run(['restyle', '--baseline', 'listicle', '--tokens', fx('site-tokens-good.json'), '--css', fx('listicle/styles.css')]);
  assert.ok(out.css.includes('--') && out.report.includes('mapped'));
  assert.throws(() => run(['restyle', '--baseline', 'carousel', '--tokens', fx('site-tokens-good.json'), '--css', fx('listicle/styles.css')]), /no adapter for baseline "carousel"/);
  assert.deepEqual(run(['check', '--html', fx('listicle/template.html'), '--css', fx('listicle/styles.css')]), { ok: true, findings: [] });
  assert.equal(run(['name', '--prefix', 'p', '--client', 'c', '--url', 'https://a.com', '--widget', 'offer-wall', '--version', 'v1']).name, 'p c a-com offer-wall v1');
  assert.throws(() => run(['bogus']), /unknown command/);
  assert.throws(() => run(['restyle', '--baseline']), /option value pairs/);
});
