#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

const errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

const manifestPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
check(existsSync(manifestPath), `missing: ${manifestPath}`);
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(typeof m.name === 'string' && m.name.length > 0, 'plugin.json: name required');
  check(typeof m.version === 'string' && m.version.length > 0, 'plugin.json: version required');
  check(typeof m.description === 'string' && m.description.length > 0, 'plugin.json: description required');
}

// Every skill folder needs a SKILL.md whose frontmatter name matches the folder, and a
// golden file — globbed, so adding a skill never edits this list.
const skillsDir = join(pluginRoot, 'skills');
// folders only: a stray file such as .DS_Store is not a skill
const skills = existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
check(skills.length > 0, 'no skills/ folders');
for (const s of skills) {
  const file = join(skillsDir, s, 'SKILL.md');
  if (!existsSync(file)) { errors.push(`missing: skills/${s}/SKILL.md`); continue; }
  const name = readFileSync(file, 'utf8').match(/^---\nname: (.+)$/m)?.[1];
  check(name === s, `skills/${s}/SKILL.md: frontmatter name "${name}" must match the folder`);
  check(existsSync(join(pluginRoot, 'tests', 'golden', `${s}.md`)), `missing: tests/golden/${s}.md`);
}

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log(`✔ plugin structure ok (${skills.length} skill${skills.length === 1 ? '' : 's'})`);
