#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');

const errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

// plugin.json
const manifestPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
check(existsSync(manifestPath), `missing: ${manifestPath}`);
if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(typeof m.name === 'string' && m.name.length > 0, 'plugin.json: name required');
  check(typeof m.version === 'string' && m.version.length > 0, 'plugin.json: version required');
  check(typeof m.description === 'string' && m.description.length > 0, 'plugin.json: description required');
}

// references
for (const p of [
  'references/README.md',
  'references/CHECKLIST.md',
  'references/patterns.md',
  'references/anti-patterns.md',
  'references/rendering-convention.md',
  'references/patterns/README.md',
]) check(existsSync(join(pluginRoot, p)), `missing reference: ${p}`);

// each example dir must carry the three standard files
for (const dir of [
  'references/patterns/example-1',
  'references/patterns/example-2',
  'references/patterns/example-3',
  'references/patterns/example-4',
  'references/patterns/example-5',
  'references/patterns/example-6',
  'references/patterns/example-7',
  'references/patterns/example-8',
]) {
  for (const file of ['template.html', 'styles.css', 'notes.md']) {
    check(existsSync(join(pluginRoot, dir, file)), `missing ${dir}/${file}`);
  }
}

// commands
for (const p of [
  'commands/lincx-template-new.md',
  'commands/lincx-template-edit.md',
  'commands/lincx-template-save.md',
  'commands/lincx-template-load-ads.md',
  'commands/lincx-template-preview-toggle.md',
  'commands/lincx-template-refresh-schema.md',
]) check(existsSync(join(pluginRoot, p)), `missing command: ${p}`);

// skill
for (const f of ['editing-lincx-templates/SKILL.md', 'lincx-template-playbook/SKILL.md', 'lincx-template-playbook/baselines.md', 'lincx-template-playbook/full-build.md', 'lincx-template-playbook/site-tokens.md', 'lincx-template-playbook/adapters/offer-wall.json', 'lincx-template-playbook/adapters/listicle.json', ...['offer-wall', 'listicle'].flatMap((t) => ['template.html', 'styles.css', 'cag.json', 'mock-ads.json', 'SOURCE.md'].map((f) => `lincx-template-playbook/references/baselines/${t}/${f}`))]) {
  check(existsSync(join(pluginRoot, 'skills', f)), `missing skill file: ${f}`);
}

// restyle scripts, and every adapter must point at the token block of a wrapper and name site tokens the schema knows
for (const f of ['scripts/restyle.mjs', 'scripts/restyle-lib.mjs']) check(existsSync(join(pluginRoot, f)), `missing script: ${f}`);
{
  const { SITE_TOKEN_SCHEMA } = await import('./restyle-lib.mjs');
  const known = new Set(Object.entries(SITE_TOKEN_SCHEMA).flatMap(([n, fs]) => Object.keys(fs).map((k) => (k === 'value' ? n : `${n}.${k}`))));
  for (const t of ['offer-wall', 'listicle']) {
    const p = join(pluginRoot, 'skills/lincx-template-playbook/adapters', `${t}.json`);
    if (!existsSync(p)) continue;
    const a = JSON.parse(readFileSync(p, 'utf8'));
    check(typeof a.wrapper === 'string' && a.wrapper, `adapters/${t}.json: wrapper required`);
    for (const [tok, def] of Object.entries(a.tokens ?? {})) {
      check(known.has(def.from), `adapters/${t}.json: ${tok} reads unknown site token "${def.from}"`);
      if (def.on) check(Object.hasOwn(a.tokens, def.on), `adapters/${t}.json: ${tok} is held against ${def.on}, which is not an adapter token`);
    }
    for (const u of a.unmapped ?? []) check(known.has(u), `adapters/${t}.json: unmapped "${u}" is not a site token`);
  }
}

// hook
const hookJson = join(pluginRoot, 'hooks/hooks.json');
const hookSh = join(pluginRoot, 'hooks/post-edit-preview.sh');
check(existsSync(hookJson), 'missing hooks/hooks.json');
check(existsSync(hookSh), 'missing hooks/post-edit-preview.sh');
if (existsSync(hookSh)) {
  const mode = statSync(hookSh).mode;
  check((mode & 0o111) !== 0, 'hooks/post-edit-preview.sh is not executable (chmod +x)');
}

if (errors.length) {
  for (const e of errors) console.error('✖', e);
  process.exit(1);
}
console.log('✔ plugin structure ok');
