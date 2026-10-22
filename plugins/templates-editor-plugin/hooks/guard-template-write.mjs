#!/usr/bin/env node
// PreToolUse hook — gate direct template writes (create_template, update_template_content).
//  - Target is a registered baseline → ask the user to confirm editing the baseline itself.
//  - Any other direct write → ask (it is live on every zone using the template).
// update_template_content takes { network_id, id, html, css }; create_template has no id.
// Reads the hook payload on stdin. Fails open: an unreadable payload never blocks.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.CLAUDE_PLUGIN_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');

/** Template IDs (the "Baseline template ID" column) of the rows in baselines.md. */
export function baselineIds(md) {
  const ids = new Set();
  let col = -1;
  for (const line of md.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const header = cells.indexOf('Baseline template ID');
    if (header !== -1) { col = header; continue; }
    if (col !== -1 && cells.length > col && /^[a-z0-9]{4,}$/i.test(cells[col]) && !/^-+$/.test(cells[col])) ids.add(cells[col]);
  }
  return ids;
}

export function decide(input, { baselines }) {
  const templateId = input.id;
  if (templateId && baselines.has(templateId)) {
    return { decision: 'ask', reason: `Template ${templateId} is a BASELINE. Baselines are cloned per client, not edited; this write is live for every client cloned from it. Confirm only if you mean to improve the baseline itself.` };
  }
  if (!templateId) {
    return { decision: 'ask', reason: 'Creating a new template directly in Lincx. Confirm only if you asked for a direct write rather than a session save.' };
  }
  return { decision: 'ask', reason: `Direct write to template ${templateId} goes live immediately on every zone using it. Confirm only if you asked for a direct write rather than a session save.` };
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')).tool_input ?? {}; } catch { return; }
  const mdPath = join(root, 'skills/lincx-template-playbook/baselines.md');
  const baselines = existsSync(mdPath) ? baselineIds(readFileSync(mdPath, 'utf8')) : new Set();
  const { decision, reason } = decide(input, { baselines });
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
