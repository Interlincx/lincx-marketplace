#!/usr/bin/env node
// CLI over restyle-lib.mjs, used by lincx-template-playbook so the restyle is decided by code, not by the model.
//   baseline  --type <type> [--dir <dir>]                       the bundled baseline: its paths, and with --dir the files copied there plus cag-schema.json (session shape)
//   cag-check --type <type> --cag client-cag.json               does the client's CAG carry the baseline's fields (missing / retyped / extra)
//   restyle   --baseline <type> --tokens site-tokens.json [--css baseline.css] [--out styles.css] [--report report.md]   --css defaults to the bundled styles.css
//   check     --html <file> --css <file>                       CSS scope findings (wrapper class, unscoped selectors, global names)
//   wall      --probe probe.json                               { status, title, html, visibleTextLength } → { walled, reason }
//   name      --prefix <p> --client <id> --url <url> --widget <w> --version <v>   deterministic template name
//   plan-save --existing templates.json --desired desired.json  create | patch | none | stop
// Prints JSON on stdout; exits 1 with a message on stderr when a step refuses.
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cagDiff, cagSessionSchema, cssScopeProblems, detectWall, planSave, renderReport, restyle, siteSlug, templateName } from './restyle-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// In the plugin the adapters sit under the skill; in a portable skill build they sit next to scripts/.
const adaptersDir = [join(here, '../skills/lincx-template-playbook/adapters'), join(here, '../adapters')].find(existsSync);
// The baselines ship with the skill, so nothing is read from a network.
const baselinesDir = [join(here, '../skills/lincx-template-playbook/references/baselines'), join(here, '../references/baselines')].find(existsSync);
const baselineDir = (type) => {
  const dir = baselinesDir && join(baselinesDir, String(type));
  if (!dir || !existsSync(join(dir, 'template.html'))) throw new Error(`no bundled baseline "${type}" (have: offer-wall, listicle); use full-build.md`);
  return dir;
};

function parse(argv) {
  const args = {};
  for (let i = 1; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw new Error(`expected --option value pairs, got ${argv[i] ?? 'nothing'}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
const need = (args, ...names) => names.forEach((n) => { if (!args[n]) throw new Error(`missing --${n}`); });
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function run(argv) {
  const [cmd] = argv;
  const a = parse(argv);
  switch (cmd) {
    case 'baseline': {
      need(a, 'type');
      const dir = baselineDir(a.type);
      const files = ['template.html', 'styles.css', 'cag.json', 'mock-ads.json'];
      if (!a.dir) return { dir, files: files.map((f) => join(dir, f)) };
      mkdirSync(a.dir, { recursive: true });
      for (const f of ['template.html', 'styles.css']) copyFileSync(join(dir, f), join(a.dir, f));
      writeFileSync(join(a.dir, 'cag-schema.json'), `${JSON.stringify(cagSessionSchema(json(join(dir, 'cag.json'))), null, 2)}\n`);
      copyFileSync(join(dir, 'mock-ads.json'), join(a.dir, 'mock-ads.json'));
      return { dir: a.dir, files: [...files.filter((f) => f !== 'cag.json'), 'cag-schema.json'].map((f) => join(a.dir, f)) };
    }
    case 'cag-check': {
      need(a, 'type', 'cag');
      return cagDiff(json(join(baselineDir(a.type), 'cag.json')), json(a.cag));
    }
    case 'restyle': {
      need(a, 'baseline', 'tokens');
      const adapterPath = adaptersDir && join(adaptersDir, `${a.baseline}.json`);
      if (!adapterPath || !existsSync(adapterPath)) throw new Error(`no adapter for baseline "${a.baseline}" (have: offer-wall, listicle); read its token block and ask`);
      const { css, report, fontImport } = restyle({ siteTokens: json(a.tokens), adapter: json(adapterPath), baselineCss: readFileSync(a.css ?? join(baselineDir(a.baseline), 'styles.css'), 'utf8') });
      if (a.out) writeFileSync(a.out, css);
      const text = renderReport(report);
      if (a.report) writeFileSync(a.report, `${text}\n`);
      return { out: a.out ?? null, fontImport, report: text, css: a.out ? undefined : css };
    }
    case 'check': {
      need(a, 'html', 'css');
      const findings = cssScopeProblems(readFileSync(a.html, 'utf8'), readFileSync(a.css, 'utf8'));
      return { ok: findings.length === 0, findings };
    }
    case 'wall': need(a, 'probe'); return detectWall(json(a.probe));
    case 'name': {
      need(a, 'prefix', 'client', 'url', 'widget', 'version');
      return { name: templateName({ namePrefix: a.prefix, clientId: a.client, slug: siteSlug(a.url), widget: a.widget, version: a.version }) };
    }
    case 'plan-save': need(a, 'existing', 'desired'); return planSave({ existing: json(a.existing), desired: json(a.desired) });
    default: throw new Error(`unknown command ${JSON.stringify(cmd)}; use baseline | cag-check | restyle | check | wall | name | plan-save`);
  }
}

// realpath: a skill folder under a symlinked path (macOS /var → /private/var) would otherwise print nothing.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); } catch (e) { console.error(`✖ ${e.message}`); process.exit(1); }
}
