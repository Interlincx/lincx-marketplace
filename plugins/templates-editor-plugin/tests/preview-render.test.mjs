import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPreview, synthesizeMockAds, substituteTokens } from '../scripts/preview-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'simple-template');

test('substituteTokens replaces {{field}} tokens from a flat record', () => {
  const out = substituteTokens('<h1>{{headline}}</h1>', { headline: 'Hi' });
  assert.equal(out, '<h1>Hi</h1>');
});

test('substituteTokens leaves unknown tokens as empty string', () => {
  const out = substituteTokens('<p>{{missing}}</p>', {});
  assert.equal(out, '<p></p>');
});

test('substituteTokens HTML-escapes substituted values by default', () => {
  const out = substituteTokens('<p>{{body}}</p>', { body: '<script>x</script>' });
  assert.equal(out, '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('substituteTokens does not escape url-typed tokens marked via {{& field}}', () => {
  const out = substituteTokens('<a href="{{&clickUrl}}">x</a>', { clickUrl: 'https://example.com?a=1&b=2' });
  assert.equal(out, '<a href="https://example.com?a=1&b=2">x</a>');
});

test('synthesizeMockAds generates 2 placeholders from a CAG schema', () => {
  const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
  const ads = synthesizeMockAds(schema, 2);
  assert.equal(ads.length, 2);
  for (const ad of ads) {
    assert.ok(typeof ad.headline === 'string' && ad.headline.length > 0);
    assert.ok(typeof ad.body === 'string' && ad.body.length > 0);
    assert.ok(/^https?:\/\//.test(ad.clickUrl));
  }
});

test('renderPreview writes preview.html matching the fixture exactly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const html = readFileSync(join(fixtures, 'template.html'), 'utf8');
    const css = readFileSync(join(fixtures, 'template.css'), 'utf8');
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const mockAds = JSON.parse(readFileSync(join(fixtures, 'mock-ads.json'), 'utf8'));
    const previewPath = join(dir, 'preview.html');

    const result = renderPreview({ html, css, cagSchema: schema, mockAds, previewPath });
    assert.equal(result.ok, true);
    assert.equal(result.usedFallback, false);

    const actual = readFileSync(previewPath, 'utf8').trim();
    const expected = readFileSync(join(fixtures, 'expected-preview.html'), 'utf8').trim();
    assert.equal(actual, expected);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('renderPreview falls back to synthesized ads when mockAds shape is invalid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const html = readFileSync(join(fixtures, 'template.html'), 'utf8');
    const css = readFileSync(join(fixtures, 'template.css'), 'utf8');
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const previewPath = join(dir, 'preview.html');

    const result = renderPreview({ html, css, cagSchema: schema, mockAds: [{ notAField: 1 }], previewPath });
    assert.equal(result.ok, true);
    assert.equal(result.usedFallback, true);
    assert.ok(existsSync(previewPath));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('renderPreview returns ok:false when html source is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-render-'));
  try {
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const result = renderPreview({ html: null, css: '', cagSchema: schema, mockAds: [], previewPath: join(dir, 'preview.html') });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'MISSING_HTML');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hostBackground paints the publisher page behind a transparent widget; unset keeps the default look (#10)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-host-'));
  try {
    const schema = JSON.parse(readFileSync(join(fixtures, 'cag-schema.json'), 'utf8'));
    const args = { html: '<div>{{headline}}</div>', css: '', cagSchema: schema, mockAds: [] };
    renderPreview({ ...args, previewPath: join(dir, 'a.html'), hostBackground: 'rgb(10, 20, 30)' });
    const host = readFileSync(join(dir, 'a.html'), 'utf8');
    assert.match(host, /body \{ margin: 0; padding: 16px; background: #0a141e; \}/);
    assert.doesNotMatch(host, /background: white/);
    renderPreview({ ...args, previewPath: join(dir, 'b.html'), hostBackground: 'not-a-colour' });
    assert.match(readFileSync(join(dir, 'b.html'), 'utf8'), /background: #f4f4f4;[\s\S]*background: white/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
