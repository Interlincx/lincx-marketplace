#!/usr/bin/env node
/**
 * Build a self-contained copy of every plugin skill into dist/skills/<name>/, for
 * agents that load Agent Skills (SKILL.md folders) but not Claude Code plugins:
 * ChatGPT / Codex, Grok, Gemini CLI, GitHub Copilot, Cursor.
 *
 * In the plugins a skill can lean on files outside its own folder: lincx-reports'
 * `_shared/`, or `${CLAUDE_PLUGIN_ROOT}/references|scripts`. Another host only gets
 * the skill folder, so the build copies those files in and rewrites
 * `${CLAUDE_PLUGIN_ROOT}/` to a path relative to the skill. Commands and hooks
 * are not copied; they only exist in Claude Code.
 *
 * Exits non-zero if a built skill breaks the spec or still references something
 * outside its folder.
 *
 * Usage: node scripts/build-portable-skills.mjs [outDir]
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] ?? join(repoRoot, 'dist/skills'));

// Plugin-level dirs a skill reaches through ${CLAUDE_PLUGIN_ROOT}/.
const PLUGIN_ROOT_DIRS = ['references', 'scripts'];

// Agent Skills spec (agentskills.io): lowercase-hyphen name matching its folder, ≤ 64 chars;
// description ≤ 1024 chars.
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  return Object.fromEntries(
    m[1].split('\n').map((l) => l.match(/^([a-z-]+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim()]),
  );
}

// Backticked file paths into the bundle: `_shared/x.md`, `references/y.md`, `scripts/z.mjs`.
// Time zones (`America/Denver`), MIME types and other repos' paths aren't bundle files.
const PATH_RE = /`([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]*)`/g;
const isCheckablePath = (p) => /^(_shared|references|scripts)\/.*\.[a-z]+$/.test(p) && !/example-N/.test(p);

function build(skillDir, pluginDir, dest) {
  cpSync(skillDir, dest, { recursive: true });

  // lincx-reports: sibling `_shared/` sits next to the skill folders.
  const shared = join(dirname(skillDir), '_shared');
  if (existsSync(shared)) cpSync(shared, join(dest, '_shared'), { recursive: true });

  for (const file of walk(dest)) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('${CLAUDE_PLUGIN_ROOT}/')) continue;
    let out = text.replaceAll('${CLAUDE_PLUGIN_ROOT}/', '');
    // `node scripts/x.mjs` would otherwise resolve against the user's project.
    if (file === join(dest, 'SKILL.md')) {
      out = out.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n> Paths like \`references/…\` and \`scripts/…\` are relative to this skill's folder, not the working directory.\n`);
    }
    writeFileSync(file, out);
    for (const d of PLUGIN_ROOT_DIRS) {
      if (text.includes(`\${CLAUDE_PLUGIN_ROOT}/${d}`) && !existsSync(join(dest, d))) {
        // check-plugin.mjs lints the Claude plugin layout; meaningless inside a skill.
        cpSync(join(pluginDir, d), join(dest, d), { recursive: true, filter: (src) => !src.endsWith('check-plugin.mjs') });
      }
    }
  }
}

function check(dest, name) {
  const problems = [];
  const fm = frontmatter(readFileSync(join(dest, 'SKILL.md'), 'utf8'));
  if (!fm) return [`${name}: SKILL.md has no frontmatter`];
  if (fm.name !== name) problems.push(`${name}: frontmatter name "${fm.name}" must match folder`);
  if (!NAME_RE.test(fm.name ?? '') || fm.name.length > 64) problems.push(`${name}: name must be lowercase-hyphen, ≤ 64 chars`);
  if (!fm.description) problems.push(`${name}: missing description`);
  else if (fm.description.length > 1024) problems.push(`${name}: description is ${fm.description.length} chars (max 1024)`);

  for (const file of walk(dest)) {
    if (!file.endsWith('.md')) continue;
    const at = relative(dest, file);
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('CLAUDE_PLUGIN_ROOT')) problems.push(`${name}/${at}:${i + 1}: CLAUDE_PLUGIN_ROOT left`);
      if (/mcp__[A-Za-z0-9_-]+__/.test(line)) problems.push(`${name}/${at}:${i + 1}: host-specific mcp__ tool prefix`);
      for (const [, p] of line.matchAll(PATH_RE)) {
        if (!isCheckablePath(p)) continue;
        // Skills cite files relative to the skill root; a few cite them relative to the doc itself.
        if (!existsSync(join(dest, p)) && !existsSync(join(dirname(file), p))) {
          problems.push(`${name}/${at}:${i + 1}: \`${p}\` is not inside the skill`);
        }
      }
    });
  }
  return problems;
}

rmSync(outDir, { recursive: true, force: true });

const problems = [];
const built = [];
const pluginsDir = join(repoRoot, 'plugins');
for (const plugin of readdirSync(pluginsDir)) {
  const skillsDir = join(pluginsDir, plugin, 'skills');
  if (!existsSync(skillsDir)) continue;
  for (const name of readdirSync(skillsDir)) {
    const skillDir = join(skillsDir, name);
    if (!existsSync(join(skillDir, 'SKILL.md'))) continue;
    const dest = join(outDir, name);
    if (built.includes(name)) problems.push(`${name}: skill name used by more than one plugin`);
    build(skillDir, join(pluginsDir, plugin), dest);
    problems.push(...check(dest, name));
    built.push(name);
  }
}

if (!built.length) problems.push('built no skills at all — plugins/*/skills/*/SKILL.md not found');

if (problems.length) {
  console.error(`✘ ${problems.length} portability problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}

console.log(`✔ ${built.length} portable skills in ${relative(repoRoot, outDir) || outDir}: ${built.join(', ')}`);
