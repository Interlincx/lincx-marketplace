// Deterministic restyle helpers for lincx-template-playbook, ported from Interlincx/lincx-site-fit (lib/map.js,
// site-tokens.js, color.js, fonts.js, token-block.js, css-checks.js, wire.js). No dependencies: the model reads the
// site into site-tokens.json; everything after that is decided here, not by the model.

// ── colour ──────────────────────────────────────────────────────────────────

const NAMED = { white: '#ffffff', black: '#000000' };

/** Lowercase #rrggbb, or null when transparent / not a colour this file understands (hex, rgb[a], white, black). */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m && [3, 4, 6, 8].includes(m[1].length)) {
    const h = m[1].length <= 4 ? m[1].replace(/./g, (d) => d + d) : m[1];
    if (h.length === 8 && parseInt(h.slice(6), 16) === 0) return null;
    return `#${h.slice(0, 6)}`;
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean);
  if (p.length < 3 || p.length > 4) return null;
  const ch = p.slice(0, 3).map((x) => Math.round(Math.min(255, Math.max(0, x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x)))));
  if (ch.some(Number.isNaN)) return null;
  if (p[3] !== undefined && parseFloat(p[3]) === 0) return null;
  return `#${ch.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex) {
  const lin = (b) => { const s = b / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

/** WCAG 2 contrast ratio; NaN when either side is not a colour. */
export function contrastRatio(a, b) {
  const [x, y] = [parseColor(a), parseColor(b)];
  if (!x || !y) return NaN;
  const [la, lb] = [luminance(x), luminance(y)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function bestTextOn(background) {
  const w = contrastRatio('#ffffff', background);
  return Number.isNaN(w) ? null : w >= contrastRatio('#000000', background) ? '#ffffff' : '#000000';
}

/** Sass-style darken: 12 points lower HSL lightness. */
export function darken(color) {
  const hex = parseColor(color);
  if (!hex) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const L = Math.max(0, l - 0.12);
  const c = (1 - Math.abs(2 * L - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = L - c / 2;
  const sector = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return `#${sector.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export const MIN_CONTRAST = 4.5;

// ── site tokens (what the model writes after reading the publisher's site) ───

const KINDS = {
  colour: [(v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v), 'a #rrggbb colour'],
  text: [(v) => typeof v === 'string' && v.trim() !== '', 'a non-empty string'],
  positive: [(v) => Number.isFinite(v) && v > 0, 'a number > 0'],
  nonNegative: [(v) => Number.isFinite(v) && v >= 0, 'a number >= 0'],
  weight: [(v) => Number.isFinite(v) && v >= 1 && v <= 1000, 'a font weight from 1 to 1000'],
  transform: [(v) => ['none', 'uppercase', 'lowercase', 'capitalize'].includes(v), 'one of none|uppercase|lowercase|capitalize'],
};

export const SITE_TOKEN_SCHEMA = {
  fontBody: { family: 'text', sizePx: 'positive', lineHeight: 'positive' },
  fontHeading: { family: 'text', weight: 'weight' },
  colorText: { value: 'colour' },
  colorBackground: { value: 'colour' },
  colorHeading: { value: 'colour' },
  colorLink: { value: 'colour' },
  colorAccent: { value: 'colour' },
  cta: { background: 'colour', text: 'colour', radiusPx: 'nonNegative', fontWeight: 'weight', textTransform: 'transform', paddingYPx: 'nonNegative', paddingXPx: 'nonNegative', label: 'text' },
  radiusPx: { value: 'nonNegative' },
  spacingUnitPx: { value: 'nonNegative' },
  contentMaxWidthPx: { value: 'positive' },
};

const CONFIDENCES = ['high', 'low', 'missing'];
const show = (v) => JSON.stringify(v) ?? String(v);

/** { ok, errors }. Every group needs confidence + source; a `missing` group has null values. */
export function validateSiteTokens(tokens) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) return { ok: false, errors: ['site tokens: expected an object'] };
  const errors = [];
  for (const [name, fields] of Object.entries(SITE_TOKEN_SCHEMA)) {
    const t = tokens[name];
    if (!t || typeof t !== 'object') { errors.push(`${name}: required, expected an object`); continue; }
    if (!CONFIDENCES.includes(t.confidence)) errors.push(`${name}.confidence: expected one of ${CONFIDENCES.join('|')}, got ${show(t.confidence)}`);
    const missing = t.confidence === 'missing';
    const sourceOk = typeof t.source === 'string' ? t.source.trim() !== '' : missing && t.source === null;
    if (!sourceOk) errors.push(`${name}.source: expected a non-empty string, got ${show(t.source)}`);
    for (const [field, kind] of Object.entries(fields)) {
      const v = t[field];
      if (missing) { if (v !== null) errors.push(`${name}.${field}: must be null when confidence is missing, got ${show(v)}`); continue; }
      if (v === undefined || v === null) { errors.push(`${name}.${field}: required when confidence is ${show(t.confidence)}`); continue; }
      const [check, expected] = KINDS[kind];
      if (!check(v)) errors.push(`${name}.${field}: expected ${expected}, got ${show(v)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── values spliced into CSS ──────────────────────────────────────────────────

const UNSAFE_VALUE = /[;{}<>\\\n\r\f]|\/\*|\*\//;
const CLOSERS = { ')': '(', ']': '[' };

/** False for a value that could end or escape the declaration, the block or the <style>. */
export function isSafeValue(value) {
  const v = String(value);
  if (UNSAFE_VALUE.test(v)) return false;
  const open = [];
  let quote = null;
  for (const ch of v) {
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') open.push(ch);
    else if (CLOSERS[ch] && open.pop() !== CLOSERS[ch]) return false;
  }
  return quote === null && open.length === 0;
}

// ── fonts ────────────────────────────────────────────────────────────────────

const SANS = ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'];
const SERIF = ['Georgia', 'Times New Roman', 'Times', 'serif'];
// [publisher family, stand-in Google family or 'sans-serif'|'serif', why]
export const SUBSTITUTES = [
  ['Gotham', 'Montserrat', 'geometric'], ['Gotham Rounded', 'Nunito', 'rounded'], ['Proxima Nova', 'Montserrat', 'geometric'],
  ['Avenir', 'Nunito Sans', 'geometric'], ['Avenir Next', 'Nunito Sans', 'geometric'], ['Brandon Grotesque', 'Josefin Sans', 'geometric'],
  ['Futura', 'Jost', 'revival'], ['Futura PT', 'Jost', 'revival'], ['Circular', 'DM Sans', 'geometric'], ['Graphik', 'Inter', 'grotesque'],
  ['Franklin Gothic', 'Libre Franklin', 'revival'], ['Helvetica Neue', 'sans-serif', 'neutral'], ['Helvetica', 'sans-serif', 'neutral'],
  ['Arial', 'sans-serif', 'neutral'], ['Georgia', 'serif', 'installed'],
];
const GENERIC = new Set(['sans-serif', 'serif', 'system-ui', '-apple-system', 'monospace', 'cursive', 'ui-sans-serif', 'ui-serif']);
const squash = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SAFE_NAME = /^[\p{L}\p{N} ._&+-]+$/u;
const GOOGLE_FONTS_IMPORT = /^@import url\((['"]?)https:\/\/fonts\.googleapis\.com\/css2\?[^'"()\s<>{}]+\1\);$/;

const formatStack = (list) => list.map((f) => (/^-?[A-Za-z][A-Za-z-]*$/.test(f) ? f : `"${f}"`)).join(', ');

/** { stack, importFamily, reason }. importFamily is null when nothing needs loading (generic/system/installed). */
export function resolveFont(family) {
  const f = String(family ?? '').trim();
  if (!f || !SAFE_NAME.test(f)) return { stack: formatStack(SANS), importFamily: null, reason: `unusable family ${show(family)}, system sans stack` };
  if (GENERIC.has(f.toLowerCase())) return { stack: formatStack(f.toLowerCase().includes('serif') && !f.toLowerCase().includes('sans') ? SERIF : SANS), importFamily: null, reason: 'generic family' };
  const sub = SUBSTITUTES.find(([from]) => squash(from) === squash(f));
  if (sub) {
    const [, to, why] = sub;
    if (to === 'sans-serif') return { stack: formatStack(SANS), importFamily: null, reason: `${f} → system sans (${why})` };
    if (to === 'serif') return { stack: formatStack(SERIF), importFamily: null, reason: `${f} → system serif (${why})` };
    return { stack: formatStack([to, ...SANS]), importFamily: to, reason: `${f} is licensed; stand-in ${to} (${why})` };
  }
  // ponytail: no Google Fonts metadata here, so the family is assumed to exist there; the preview must show it loading.
  return { stack: formatStack([f, ...SANS]), importFamily: f, reason: `${f} assumed on Google Fonts (not verified)` };
}

/** One Google Fonts css2 @import for the families, or null. Weights are the ones the token block uses. */
export function buildFontImport(fonts, italic = false) {
  const byFamily = new Map();
  for (const { family, weights } of fonts) {
    if (!family) continue;
    const set = byFamily.get(family) ?? new Set();
    weights.filter(Number.isFinite).forEach((w) => set.add(w));
    byFamily.set(family, set);
  }
  if (!byFamily.size) return null;
  const parts = [...byFamily].map(([fam, ws]) => {
    const list = [...ws].sort((a, b) => a - b);
    if (!list.length) return `family=${fam.replace(/ /g, '+')}`;
    const axis = italic ? `ital,wght@${[0, 1].flatMap((i) => list.map((w) => `${i},${w}`)).join(';')}` : `wght@${list.join(';')}`;
    return `family=${fam.replace(/ /g, '+')}:${axis}`;
  });
  const line = `@import url(https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap);`;
  if (!GOOGLE_FONTS_IMPORT.test(line)) throw new Error(`fontImport is not a single Google Fonts css2 @import line: ${line}`);
  return line;
}

// ── CSS scanning (no parser dependency) ──────────────────────────────────────

/** Replace comments with spaces (same length) so offsets stay valid. */
function blank(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Top-level-or-nested blocks as { prelude, start, end, body, depth, parent } (start/end = offsets of the braces). */
function scanBlocks(css) {
  const src = blank(css);
  const blocks = [];
  const stack = [];
  let quote = null, paren = 0, from = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === ';' && paren === 0) from = i + 1;
    else if (ch === '{' && paren === 0) {
      const b = { prelude: src.slice(from, i).trim(), start: i, end: -1, depth: stack.length, parent: stack.at(-1) ?? null };
      blocks.push(b); stack.push(b); from = i + 1;
    } else if (ch === '}' && paren === 0) {
      const b = stack.pop();
      if (b) { b.end = i; b.body = css.slice(b.start + 1, i); }
      from = i + 1;
    }
  }
  return blocks.filter((b) => b.end !== -1);
}

/** Custom-property declarations of the first top-level rule whose selector is exactly `.wrapper`. */
function tokenDeclarations(css, wrapper) {
  const block = scanBlocks(css).find((b) => b.depth === 0 && b.prelude === `.${wrapper}`);
  if (!block) return [];
  const decls = [];
  const src = blank(css);
  let i = block.start + 1, quote = null, paren = 0, from = i;
  const flush = (to) => {
    const text = src.slice(from, to);
    const m = /^(\s*(--[\w-]+)\s*:\s*)([\s\S]*?)\s*$/.exec(text);
    if (m) decls.push({ prop: m[2], value: m[3], start: from + m[1].length, end: from + m[1].length + m[3].length });
  };
  for (; i < block.end; i++) {
    const ch = src[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === ';' && paren === 0) { flush(i); from = i + 1; }
  }
  flush(block.end);
  return decls;
}

export function readTokenBlock(css, wrapper) {
  return Object.fromEntries(tokenDeclarations(css, wrapper).map((d) => [d.prop, d.value]));
}

/** Rewrites token values in place; throws on a token the block doesn't declare or an unsafe value. */
export function replaceTokenValues(css, wrapper, values) {
  const decls = tokenDeclarations(css, wrapper);
  const known = new Set(decls.map((d) => d.prop));
  for (const [prop, value] of Object.entries(values)) {
    if (!known.has(prop)) throw new Error(`token ${prop} is not declared in the .${wrapper} token block`);
    if (!isSafeValue(value)) throw new Error(`token ${prop} value ${show(value)} contains one of ; { } < > \\ /* */, a line break, or unbalanced quotes or brackets`);
  }
  let out = css;
  for (const d of decls.slice().reverse()) if (Object.hasOwn(values, d.prop)) out = out.slice(0, d.start) + String(values[d.prop]).trim() + out.slice(d.end);
  return out;
}

function spliceLeadingImport(css, fontImport) {
  const m = /^\s*@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/.exec(css);
  if (!m) return fontImport ? `${fontImport}\n${css}` : css;
  return fontImport ? fontImport + css.slice(m[0].length) : css.slice(m[0].length).trimStart();
}

// ── mapping ──────────────────────────────────────────────────────────────────

function read(siteTokens, path) {
  const [head, field] = path.split('.');
  const node = siteTokens?.[head];
  if (!node) return { confidence: 'missing', value: null };
  return { confidence: node.confidence, value: field ? node[field] : node.value };
}

const COLOUR_PATHS = Object.entries(SITE_TOKEN_SCHEMA).flatMap(([n, f]) => Object.entries(f).filter(([, k]) => k === 'colour').map(([k]) => (k === 'value' ? n : `${n}.${k}`)));
const FONT_GROUPS = { 'fontBody.family': 'fontBody', 'fontHeading.family': 'fontHeading' };

function format(value, from, unit) {
  if (value == null) return null;
  if (COLOUR_PATHS.includes(from)) return parseColor(value);
  if (typeof value === 'number') return Number.isFinite(value) ? `${Math.round(value * 1000) / 1000}${unit ?? ''}` : null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

/**
 * Site tokens → baseline token values through the adapter, plus the font @import and one report entry per decision.
 * Report kinds: mapped, derived, kept-baseline, contrast-adjusted, unmapped, font, not-in-baseline.
 * Adapter tokens absent from `baselineValues` are skipped and reported: the adapter is the site-fit starter's, and the
 * baseline in Lincx may have drifted from it.
 */
export function mapTokens({ siteTokens, adapter, baselineValues = {}, baselineCss = '' }) {
  const report = [];
  const values = {};
  const mapped = new Set();
  const targets = Object.entries(adapter.tokens ?? {}).filter(([token]) => {
    if (Object.hasOwn(baselineValues, token)) return true;
    report.push({ kind: 'not-in-baseline', token });
    return false;
  });
  const keep = (token, from, reason) => report.push({ kind: 'kept-baseline', token, from, value: baselineValues[token], reason });
  const current = (token) => values[token] ?? baselineValues[token];
  const numbersFrom = (path) => targets.filter(([, t]) => t.from === path).map(([tk]) => Number.parseFloat(current(tk))).filter(Number.isFinite);
  const blockWeights = () => [...String(baselineCss).matchAll(/font-weight\s*:\s*var\(\s*(--[\w-]+)/g)].map((m) => Number.parseFloat(current(m[1]))).filter(Number.isFinite);
  const weights = {
    fontBody: () => [400, 700, ...numbersFrom('cta.fontWeight'), ...blockWeights()],
    fontHeading: () => [...numbersFrom('fontHeading.weight'), ...blockWeights()],
  };

  const fontTargets = [];
  for (const [token, { from, unit, derive }] of targets) {
    if (FONT_GROUPS[from]) { fontTargets.push([token, from]); continue; }
    const { confidence, value } = read(siteTokens, from);
    if (confidence !== 'high') { keep(token, from, `confidence ${confidence ?? 'missing'}`); continue; }
    const out = format(value, from, unit);
    if (out == null) { keep(token, from, 'no usable value'); continue; }
    mapped.add(token);
    if (derive === undefined) { values[token] = out; report.push({ kind: 'mapped', token, from, value: out }); continue; }
    if (derive !== 'darken' || !COLOUR_PATHS.includes(from)) throw new Error(`adapter target ${token} cannot derive ${show(derive)} from ${from}`);
    values[token] = darken(out);
    report.push({ kind: 'derived', token, from, value: values[token], reason: `${derive} ${out}` });
  }

  const fonts = {};
  const imports = [];
  for (const [token, from] of fontTargets) {
    const group = FONT_GROUPS[from];
    const site = siteTokens?.[group];
    if (site?.confidence !== 'high' || !site.family) {
      keep(token, from, site?.confidence === 'high' ? 'no usable value' : `confidence ${site?.confidence ?? 'missing'}`);
      continue; // the baseline's own @import (if any) stays in place
    }
    if (!fonts[group]) {
      fonts[group] = resolveFont(site.family);
      imports.push({ family: fonts[group].importFamily, weights: weights[group]() });
      report.push({ kind: 'font', from: group, value: fonts[group].stack, reason: fonts[group].reason });
    }
    values[token] = fonts[group].stack;
    mapped.add(token);
    report.push({ kind: 'mapped', token, from, value: fonts[group].stack });
  }

  const siteBg = parseColor(siteTokens?.colorBackground?.value);
  for (const [token, { from, on }] of targets) {
    if (typeof on !== 'string') continue;
    const text = parseColor(current(token));
    const onValue = current(on);
    const opaque = parseColor(onValue) !== null;
    const background = opaque ? parseColor(onValue) : siteBg ?? '#ffffff';
    const fromSite = mapped.has(token) || mapped.has(on) || (!opaque && siteBg !== null);
    if (!fromSite || !text) continue;
    const ratio = contrastRatio(text, background);
    if (ratio >= MIN_CONTRAST - 1e-9) continue;
    values[token] = bestTextOn(background);
    report.push({ kind: 'contrast-adjusted', token, from, value: values[token], reason: `${text} ${ratio.toFixed(2)}:1 on ${background}` });
  }
  (adapter.unmapped ?? []).forEach((path) => report.push({ kind: 'unmapped', from: path }));
  const italic = /^\s*@import\s+url\([^)]*\bital\b/.test(baselineCss);
  return { values, fontImport: buildFontImport(imports, italic), report };
}

/** Applies mapTokens' output to the baseline css. Returns { css, report, fontImport }. */
export function restyle({ siteTokens, adapter, baselineCss }) {
  const check = validateSiteTokens(siteTokens);
  if (!check.ok) throw new Error(`site tokens are invalid: ${check.errors.join('; ')}`);
  const baselineValues = readTokenBlock(baselineCss, adapter.wrapper);
  if (!Object.keys(baselineValues).length) throw new Error(`no token block found: expected a top-level .${adapter.wrapper} rule with --custom properties`);
  const { values, fontImport, report } = mapTokens({ siteTokens, adapter, baselineValues, baselineCss });
  if (fontImport != null && !GOOGLE_FONTS_IMPORT.test(fontImport)) throw new Error('fontImport is not a Google Fonts css2 import');
  const css = spliceLeadingImport(replaceTokenValues(baselineCss, adapter.wrapper, values), fontImport);
  return { css, report, fontImport };
}

const LINE = {
  mapped: (e) => `mapped ${e.token} ← ${e.from} = ${e.value}`,
  derived: (e) => `derived ${e.token} = ${e.value} (${e.reason})`,
  'kept-baseline': (e) => `kept ${e.token} = ${e.value} (${e.reason}; ${e.from})`,
  'contrast-adjusted': (e) => `contrast-adjusted ${e.token} → ${e.value} (${e.reason}, needs ${MIN_CONTRAST}:1)`,
  font: (e) => `font ${e.from}: ${e.value} (${e.reason})`,
  unmapped: (e) => `unmapped ${e.from} (no baseline token for it)`,
  'not-in-baseline': (e) => `skipped ${e.token}: adapter token not in this baseline's token block`,
};

export function renderReport(report) {
  return report.map((e) => `- ${LINE[e.kind](e)}`).join('\n');
}

// ── CSS scope checks ─────────────────────────────────────────────────────────

/** First class of the single non-script/style element child of <body>, or null. */
export function deriveWrapperClass(html) {
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) ?? [null, html])[1]
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').trim();
  const roots = [];
  let depth = 0;
  for (const m of body.matchAll(/<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>/gi)) {
    const [, close, tag, attrs, self] = m;
    if (/^(br|hr|img|input|meta|link|source)$/i.test(tag) || self) { if (depth === 0) roots.push(attrs); continue; }
    if (close) { depth--; continue; }
    if (depth === 0) roots.push(attrs);
    depth++;
  }
  if (roots.length !== 1) return null;
  const cls = /\bclass\s*=\s*["']([^"']*)["']/.exec(roots[0])?.[1].trim();
  return cls ? cls.split(/\s+/)[0] : null;
}

/** Findings for: no wrapper class, unscoped selectors, bare tag selectors, global @keyframes / @font-face names. */
export function cssScopeProblems(html, css) {
  if (!css.trim()) return [];
  const wrapper = deriveWrapperClass(html);
  if (!wrapper) return ['the outermost container has no wrapper class: add a unique class and prefix every CSS selector with it'];
  const out = [];
  const blocks = scanBlocks(css);
  const inKeyframes = (b) => { for (let p = b.parent; p; p = p.parent) if (/^@(-\w+-)?keyframes\b/i.test(p.prelude)) return true; return false; };
  for (const b of blocks) {
    const p = b.prelude;
    if (/^@(-\w+-)?keyframes\b/i.test(p)) { if (!p.includes(wrapper)) out.push(`@keyframes name "${p.replace(/^@\S+\s*/, '')}" is global: prefix it with ${wrapper}`); continue; }
    if (/^@font-face$/i.test(p)) {
      const fam = /font-family\s*:\s*([^;]+)/i.exec(b.body)?.[1].trim().replace(/['"]/g, '');
      if (fam && !fam.includes(wrapper)) out.push(`@font-face font-family "${fam}" is global: prefix it with ${wrapper}`);
      continue;
    }
    if (p.startsWith('@') || !p || inKeyframes(b)) continue;
    for (const sel of splitSelectors(p)) {
      if (new RegExp(`^\\.${escapeRe(wrapper)}(?![\\w-])`).test(sel)) continue;
      out.push(`${/^[a-z*]/i.test(sel) ? 'bare tag selector' : 'unscoped selector'} "${sel}": prefix it with .${wrapper}`);
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function splitSelectors(prelude) {
  const parts = [];
  let depth = 0, from = 0;
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { parts.push(prelude.slice(from, i)); from = i + 1; }
  }
  parts.push(prelude.slice(from));
  return parts.map((s) => s.trim()).filter(Boolean);
}

// ── walled sites ─────────────────────────────────────────────────────────────

const CHALLENGES = [
  { reason: 'cloudflare: Just a moment...', title: /^\s*just a moment\b/i, dom: /window\._cf_chl_opt\b|\bid=["']?challenge-(?:stage|form)\b/ },
  { reason: 'cloudflare: Attention Required!', title: /^\s*attention required\b/i, dom: /\bid=["']?cf-error-details\b/ },
];
const MIN_VISIBLE_CHARS = 200;

/** { walled, reason }: refuse to read tokens from a challenge page, an error status or a near-empty page. */
export function detectWall({ status, title = '', html = '', visibleTextLength } = {}) {
  if (status >= 400 && status < 600) return { walled: true, reason: `HTTP ${status}` };
  for (const c of CHALLENGES) {
    if (c.title.test(title)) return { walled: true, reason: c.reason };
    if (c.dom.test(html)) return { walled: true, reason: `${c.reason} (recognised from the DOM)` };
  }
  if (!(visibleTextLength >= MIN_VISIBLE_CHARS)) return { walled: true, reason: `${visibleTextLength} visible characters (under ${MIN_VISIBLE_CHARS})` };
  return { walled: false, reason: null };
}

// ── save plan (find by name, then create / patch css / nothing) ──────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<prefix> <client> <site-slug> <widget> <version>`: the same inputs always give the same name. */
export function templateName({ namePrefix, clientId, slug, widget, version }) {
  if (!SLUG.test(slug ?? '')) throw new Error(`invalid site slug ${show(slug)}: expected [a-z0-9] runs joined by -`);
  if (slug === 'baseline') throw new Error('site slug "baseline" is reserved');
  return `${namePrefix} ${clientId} ${slug} ${widget} ${version}`;
}

export function siteSlug(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * existing: templates from list_templates in the network (full objects for the matches). desired: { name, html, css,
 * creativeAssetGroupId }. Returns { action: 'create' | 'patch' | 'none' | 'stop', ... }.
 * 'stop' = duplicate names or drift (html / CAG changed): a run patches only the css, so a human decides.
 */
export function planSave({ existing, desired }) {
  const matches = (existing ?? []).filter((t) => t?.name === desired.name && !t.archived);
  if (matches.length > 1) return { action: 'stop', code: 'DUPLICATE_TEMPLATES', reason: `${matches.length} non-archived templates are named "${desired.name}" (${matches.map((t) => t.id).join(', ')}); archive the extras by hand`, ids: matches.map((t) => t.id) };
  const t = matches[0];
  if (!t) return { action: 'create' };
  for (const field of ['html', 'creativeAssetGroupId']) {
    if (t[field] !== desired[field]) return { action: 'stop', code: 'DRIFT', reason: `template "${t.name}" (${t.id}) ${field} differs from the baseline copy; a run patches only the css`, id: t.id };
  }
  return t.css === desired.css ? { action: 'none', id: t.id } : { action: 'patch', id: t.id };
}
