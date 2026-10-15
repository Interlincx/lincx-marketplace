#!/usr/bin/env node
// PostToolUse hook — advisory lint of an edited template html/css that is tracked in .lincx-session.json.
// Findings go back to Claude as additionalContext; never blocks.
//  - html: a sponsor link (href contains a Mustache tag) without data-lincx-cta
//  - css:  colour literals outside token declarations and the CLIENT OVERRIDES block
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findEntryByPath, readSessionState } from '../scripts/session-state.mjs';

export function lintHtml(html) {
  const bad = (html.match(/<a\b[^>]*>/gi) ?? []).filter((a) => /href\s*=\s*["'][^"']*\{\{/.test(a) && !/data-lincx-cta(?=[\s>=\/])/.test(a));
  return bad.length ? [`${bad.length} sponsor link(s) missing data-lincx-cta (required markup)`] : [];
}

export function lintCss(css) {
  const cut = css.search(/\/\*\s*CLIENT OVERRIDES/i);
  const body = cut === -1 ? css : css.slice(0, cut);
  // Only value positions count: `: ... #hex` or a colour function, not ID selectors, comments or token declarations.
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[\w-]+\s*:[^;}]*/g, '');
  const n = stripped.split('\n').filter((l) => /:[^;{}]*(#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\()/i.test(l)).length;
  return n ? [`${n} hardcoded colour line(s) outside token declarations and the CLIENT OVERRIDES block (ignore if they come from the baseline)`] : [];
}

function main() {
  let path;
  try { path = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path; } catch { return; }
  if (!path) return;
  let state;
  try { state = readSessionState(join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.lincx-session.json')); } catch { return; }
  const entry = state && findEntryByPath(state, path);
  if (!entry) return;
  const isHtml = entry.htmlPath === path;
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return; }
  const findings = isHtml ? lintHtml(text) : lintCss(text);
  if (!findings.length) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `lincx template lint (${path}): ${findings.join('; ')}` },
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
