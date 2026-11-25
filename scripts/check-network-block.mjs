#!/usr/bin/env node
/**
 * The `## Network` section is copied into every skill that calls a business tool,
 * so a skill stays self-contained (the portable build ships one folder per skill).
 * This is the one source for its wording: a skill whose copy differs fails here.
 *
 * Usage: node scripts/check-network-block.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const NETWORK_BLOCK = `## Network

Every MCP business tool requires \`network_id\`. There is no active network, and \`auth_status\` does not tell you which one to use.

- **Take it from the conversation.** Use the network the user named, or the one already used earlier in this conversation. Map a name to its ID with \`network_list\`.
- **None in the conversation yet:** show \`network_list\` and ask. Never guess, and never default to the first one.
- **Keep it** until the user explicitly asks to switch to another network. Never switch on your own, not even after an error.
- **Name it in the answer** (\`network <network_id>\`), so a wrong network is visible.
`;

const pluginsDir = join(repoRoot, 'plugins');
const drifted = [];
let seen = 0;
for (const plugin of readdirSync(pluginsDir)) {
  const skillsDir = join(pluginsDir, plugin, 'skills');
  if (!existsSync(skillsDir)) continue;
  for (const skill of readdirSync(skillsDir)) {
    const file = join(skillsDir, skill, 'SKILL.md');
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    if (!/^## Network$/m.test(src)) continue;
    seen++;
    if (!src.includes(NETWORK_BLOCK)) drifted.push(relative(repoRoot, file));
  }
}

if (!seen) drifted.push('no skill has a "## Network" section — the matcher is broken');
if (drifted.length) {
  console.error(`✘ the Network section differs from scripts/check-network-block.mjs in:\n${drifted.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`✔ ${seen} skills carry the same Network section`);
