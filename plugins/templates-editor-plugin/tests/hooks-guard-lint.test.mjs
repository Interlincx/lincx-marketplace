import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baselineIds, decide } from '../hooks/guard-template-write.mjs';
import { lintHtml, lintCss } from '../hooks/lint-template-edit.mjs';

const md = readFileSync(new URL('../skills/lincx-template-playbook/baselines.md', import.meta.url), 'utf8');
const baselines = baselineIds(md);

test('baselineIds reads the registry', () => {
  assert.deepEqual([...baselines].sort(), ['ts86dt', 'u1cfwr', 'u7clvm'].sort());
});

test('baseline write asks, with the baseline warning', () => {
  const d = decide({ id: 'u1cfwr' }, { baselines });
  assert.equal(d.decision, 'ask');
  assert.match(d.reason, /BASELINE/);
});

test('other direct write still asks, without the baseline warning', () => {
  const d = decide({ id: 'zzz999' }, { baselines });
  assert.equal(d.decision, 'ask');
  assert.doesNotMatch(d.reason, /BASELINE/);
});

test('create_template (no id) asks without claiming zones are affected', () => {
  const d = decide({ name: 'x' }, { baselines });
  assert.equal(d.decision, 'ask');
  assert.doesNotMatch(d.reason, /zone/);
});

test('lintHtml flags a sponsor link without data-lincx-cta only', () => {
  assert.equal(lintHtml('<a href="{{ url }}">x</a>').length, 1);
  assert.equal(lintHtml('<a href="{{ url }}" data-lincx-cta>x</a><a href="/terms">t</a>').length, 0);
  assert.equal(lintHtml('<a href="{{url}}" data-lincx-cta-name="cta">x</a>').length, 1);
});

test('lintCss ignores tokens and the overrides block', () => {
  assert.equal(lintCss('.a{color:#fff}').length, 1);
  assert.equal(lintCss('#add-btn{display:block}\n#cafe{margin:0}\n/* brand #ff0000 */').length, 0);
  assert.equal(lintCss(':root{--c:#fff}\n.a{color:var(--c)}\n/* CLIENT OVERRIDES: x */\n.a{color:#000}').length, 0);
});

test('lintCss reports scoping and unbalanced token values, advisory only (#5, #6)', () => {
  const html = '<div class="w-wrap"></div>';
  assert.deepEqual(lintCss('.w-wrap { --a: #111; }\n.w-wrap b { margin: 0 }', html), []);
  const scoped = lintCss('.w-wrap { --a: 1px; } p { margin: 0 } @keyframes spin { from { opacity: 0 } }', html);
  assert.equal(scoped.length, 1);
  assert.match(scoped[0], /2 scoping problem\(s\): bare tag selector "p".*@keyframes/);
  assert.match(lintCss('.w-wrap { --f: "open; }', html).join(), /unbalanced quotes or brackets: --f/);
  assert.deepEqual(lintCss('p { margin: 0 }'), [], 'no html given: scope check skipped');
});
