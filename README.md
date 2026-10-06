# lincx-marketplace

A [Claude Code](https://claude.com/claude-code) plugin marketplace for Lincx. Install these plugins in any Claude Code surface — the CLI (`claude`), the Claude desktop app, the VS Code / JetBrains extensions, or the web app — and get Lincx-specific workflows on top of your everyday coding session.

## What's in this marketplace

| Plugin | What it does |
|---|---|
| **`templates-editor-plugin`** *(unlisted, see below)* | Build and adjust Lincx ad templates (HTML + Mustache + CSS) from Claude Code. Pulls templates via the Lincx MCP, gives you a live preview loop, and ships a save path that paste-drops a versioned artifact today and will push via a Lincx write tool once one lands. Ships with a reference library (production checklist, pattern snippets, anti-patterns, and 8 canonical example templates) that guides the LLM to write on-pattern code. |
| **`lincx-reports`** | Manager-friendly reports over the Lincx MCP — campaign performance, revenue summary, creative anomalies. Read-only, with a fixed four-part output contract so every answer is auditable. |
| **`lincx-inventory`** | Inventory queries over Lincx config — exhaustive zone-targeting rollups with a live/off breakdown per ad group, plus a geo- and time-aware zone serving check that explains why an offer is or isn't in the `get_zone_ads` debug pool. |
| **`lincx-analysis`** | Zone tier analysis. The platform's deterministic engine computes the tiers, ranks and risk flags; Claude writes the rationale, justifications and next actions on top. Skips the server-side LLM pass entirely, so the analysis prompt is a markdown file you can edit instead of a deploy. |

More plugins will land here — this is the single place to install every Lincx-specific Claude Code plugin we ship.

---

## Requirements

- **Claude Code** installed (CLI, desktop, or IDE extension). Get it at <https://claude.com/claude-code>.
- **Node** on your `PATH` (stdlib only — no `npm install` needed).
- **Lincx MCP** connected to your Claude session — this is what the plugins talk to for reads (`get_template`, `get_creative_asset_group`, `get_zone_ads`, etc.). Run `/mcp` inside Claude Code to confirm it's up.
- `git` on your machine (for the local-install flows below).

---

## Install — for end users (published version)

Install the marketplace and a plugin from any Claude Code session:

```
/plugin marketplace add Interlincx/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

Same commands work in the CLI, the desktop apps, the IDE extensions, and the web app — anywhere Claude Code runs.

**Updating:** to pull the latest version of an installed plugin:

```
/plugin update lincx-reports@lincx-marketplace
/reload-plugins
```

**Uninstalling:**

```
/plugin uninstall lincx-reports@lincx-marketplace
/reload-plugins
```

---

## Install — for development (from this repo, locally)

Use this when you're working on the marketplace or want to try the plugin before publishing.

### Option A — local marketplace path (recommended for dev)

```
/plugin marketplace add /absolute/path/to/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

This reads the marketplace manifest at `.claude-plugin/marketplace.json` and installs the plugin from the `plugins/` dir. Edits to the plugin dir are picked up after `/reload-plugins`.

### Option B — direct symlink

Even faster iteration — skip the marketplace and symlink the plugin dir straight into Claude Code's plugin path:

```bash
mkdir -p ~/.claude/plugins/
ln -s /absolute/path/to/lincx-marketplace/plugins/templates-editor-plugin \
      ~/.claude/plugins/templates-editor-plugin
```

Then in any Claude Code session:

```
/reload-plugins
```

Changes to the linked dir are live after each `/reload-plugins`. Useful when you're editing the plugin itself.

### Option C — clone + add as marketplace

If you want to keep a local clone but share it across machines:

```bash
git clone https://github.com/Interlincx/lincx-marketplace.git ~/code/lincx-marketplace
```

Then in Claude Code:

```
/plugin marketplace add ~/code/lincx-marketplace
/plugin install lincx-reports@lincx-marketplace
/reload-plugins
```

Pull updates with `git pull` in the clone, then `/reload-plugins`.

---

## Install on other agents (ChatGPT, Codex, Grok, Gemini, Copilot)

The skills follow the open [Agent Skills](https://agentskills.io) format: a folder with a `SKILL.md`. Other agents can load them too. Get self-contained copies from the latest release (no Node needed):

```bash
curl -fsSL -o lincx-skills.zip https://github.com/Interlincx/lincx-marketplace/releases/latest/download/lincx-skills.zip
rm -rf dist/skills && mkdir -p dist/skills && unzip -o lincx-skills.zip -d dist/skills
```

Or build them from a clone:

```
node scripts/build-portable-skills.mjs   # writes dist/skills/<skill-name>/
```

Each folder carries every file it references: `_shared/` for the reports, and `references/` plus `scripts/` for the template editor. It also names MCP tools without a host prefix. The build fails if any skill would break outside Claude Code.

Every agent needs two things: the skill folders, and the **Lincx MCP** at `https://mcp.lincx.com/mcp` (OAuth sign-in on first use). Without the MCP the skills have no tools to call. The steps below install everything; to install fewer, copy only the folders you want. Run them from the root of this repo after the build.

### Codex CLI

```bash
mkdir -p ~/.agents/skills && cp -R dist/skills/* ~/.agents/skills/   # or <project>/.agents/skills/
codex mcp add lincx --url https://mcp.lincx.com/mcp
codex mcp login lincx                                                 # browser OAuth
```

Restart `codex` and run `/mcp` to confirm `lincx` is connected.

### Gemini CLI

```bash
mkdir -p ~/.gemini/skills && cp -R dist/skills/* ~/.gemini/skills/   # or <project>/.gemini/skills/
gemini mcp add --transport http lincx https://mcp.lincx.com/mcp
```

Start `gemini` and run `/mcp auth lincx` to sign in.

### GitHub Copilot (VS Code agent mode / Copilot CLI)

```bash
mkdir -p .github/skills && cp -R dist/skills/* .github/skills/      # or ~/.copilot/skills/
```

Add the server to `.vscode/mcp.json`, then press **Start** above it in VS Code and sign in:

```json
{
  "servers": {
    "lincx": { "type": "http", "url": "https://mcp.lincx.com/mcp" }
  }
}
```

### Grok Build

```bash
mkdir -p ~/.agents/skills && cp -R dist/skills/* ~/.agents/skills/   # or <project>/.agents/skills/
```

Add `https://mcp.lincx.com/mcp` as an HTTP server with `grok mcp add` (`grok mcp add --help` shows the flags). Run `grok inspect` to confirm the skills and the server were found.

### ChatGPT (web / desktop)

1. **Settings → Apps → Advanced settings**, turn on **Developer mode**.
2. **Settings → Apps → Create connector**. Name: `Lincx`. MCP Server URL: `https://mcp.lincx.com/mcp`. Authentication: **OAuth**. Tick the trust box and save, then sign in.
3. Create a **Project**. Paste the skill's `SKILL.md` into the project instructions, and upload the files it cites (`_shared/*.md`, `references/*.md`) as project files.
4. In a chat inside that project, enable the Lincx connector and ask your question.

### OpenAI API

```bash
cd dist/skills && zip -r lincx-reports.zip lincx-reports    # one zip per skill
```

Upload each zip with `POST /v1/skills`, and pass the MCP as a tool: `{"type": "mcp", "server_label": "lincx", "server_url": "https://mcp.lincx.com/mcp"}`.

### Grok chat, or any other chat app

Paste `SKILL.md` and the files it cites into the project or custom instructions. This only works if the app lets you add `https://mcp.lincx.com/mcp` as a custom MCP connector. Without it, the model has no Lincx tools.

### Staying up to date

Every release is a `v*` tag. Its release carries two files at stable URLs:

- `https://github.com/Interlincx/lincx-marketplace/releases/latest/download/manifest.json`: `{ "version": "v1.2.0", "skills": { "<name>": { "sha256": "…" } } }`
- `https://github.com/Interlincx/lincx-marketplace/releases/latest/download/lincx-skills.zip`: every skill folder at the zip root

For a bot (e.g. Grok Bot), give it this instruction once:

> Daily, fetch the Lincx `manifest.json` URL above. If `version` differs from the one you last installed, download `lincx-skills.zip` and reinstall each skill whose `sha256` changed. Remove skills that are no longer listed. Then remember the new `version` and each skill's `sha256`.

To watch without polling the manifest, the release feed is `https://github.com/Interlincx/lincx-marketplace/releases.atom`.

Limits outside Claude Code:
- Slash commands (`/zone-targeted`, `/zone-serving-check`) and hooks aren't bundled. Ask for the task in plain words and the skill description triggers the skill.
- `lincx-reports` is a router over three sibling skills, so install all four together.
- The template editor (`editing-lincx-templates`) is not built until its MCP tools ship, see below.

---

## Using `templates-editor-plugin`

> **Unlisted until its MCP tools ship (#13).** The plugin depends on `get_template_preview_bundle` and `save_template_version`, which the Lincx MCP doesn't expose yet. So loading a template for preview and saving back to Lincx don't work. It is removed from `.claude-plugin/marketplace.json`, so `/plugin install` can't find it, and from the portable build. The code stays in `plugins/templates-editor-plugin/`. Devs can still try it with the symlink flow (Option B, pointing at `plugins/templates-editor-plugin`). Re-list it by adding its entry back to `marketplace.json` once the tools are live.
>
> If you already installed it, remove it: `/plugin uninstall templates-editor-plugin@lincx-marketplace`, then `/reload-plugins`. Once the marketplace refreshes, `/plugin update` can't find the plugin, so the broken install would otherwise stay in place.

Once installed, you'll have these slash commands available in any Claude Code session where the Lincx MCP is connected:

| Command | What it does |
|---|---|
| `/lincx-template-edit <templateId>` | Pull an existing template from Lincx, set up a working copy in your current project, open the live preview |
| `/lincx-template-new <name>` | Start a new template from scratch; pick a CAG; author with Claude using the reference library |
| `/lincx-template-save` | Save the current session. Today: writes a versioned single-file artifact (`<htmlDir>/versions/vN.html`, CSS inlined) for pasting into Lincx. Tomorrow: pushes via the Lincx MCP write tool automatically once it ships — no config change on your side |
| `/lincx-template-load-ads <zoneId>` | Load real ads from a Lincx zone to use as preview mock data instead of synthesized placeholders |
| `/lincx-template-preview-toggle` | Pause / resume automatic preview rendering for the current session |
| `/lincx-template-refresh-schema` | Re-fetch and cache the CAG schema for each active template (use after CAG changes) |

### Typical workflow

1. `cd` to any project where you want the template files to live.
2. Start Claude Code (CLI, desktop, or editor extension).
3. Confirm the Lincx MCP is connected: `/mcp`.
4. `/lincx-template-edit <templateId>` (adjust existing) or `/lincx-template-new <name>` (from scratch).
5. Claude asks where to put `html` / `css` files — pick sensible paths under the current project.
6. Chat with Claude to make changes. Every edit triggers the hook, which regenerates `preview.html` next to your files. The browser opens on the first preview of the session; refresh the tab after each change.
7. `/lincx-template-save` when done. Paste the artifact into Lincx (today) or the save will push via MCP (when that tool ships).

Session state lives in `./.lincx-session.json` in the directory you ran Claude Code from. Safe to commit or gitignore — your call.

### Before you use it on real work

The plugin's LLM behavior is shaped by the files under `plugins/templates-editor-plugin/references/`:

- `CHECKLIST.md` — the production checklist every template must follow
- `patterns.md` — copy-paste-ready pattern snippets
- `anti-patterns.md` — severity-ordered list of things the LLM must not do
- `patterns/example-1/` … `patterns/example-8/` — real production templates the LLM consults as concrete illustrations

If you fork this marketplace for your own team, swap the examples under `patterns/` for your own production templates and adjust the top-level docs to match your conventions. The skill refuses to author non-trivial templates when `patterns/` is empty, so there's no risk of it freelancing without reference material.

---

## Development

If you want to contribute to a plugin or run its tests:

```
cd plugins/templates-editor-plugin
npm test
```

This runs the Node unit tests, a shell fixture for the PostToolUse hook, and a structural lint of the plugin layout. No install needed — stdlib only.

Across all plugins, one check catches skill docs that still name an MCP tool the Lincx MCP no longer registers:

```
node scripts/check-mcp-tool-refs.mjs
```

It reads `mcp-tools.json` at the root — the single snapshot of what lincx-mcp registers, shared by every plugin. Refresh it after an MCP release:

```
node scripts/sync-mcp-tools.mjs              # over `gh api`, no checkout needed
node scripts/sync-mcp-tools.mjs ../lincx-mcp # or from a local clone
```

`knownUnresolved` in that file records references that are deliberately left alone, each with the reason.

To check that every skill still works outside Claude Code, run `node scripts/build-portable-skills.mjs`. It exits non-zero on a spec violation or on a reference that points outside the skill.

Plugin architecture docs, the full design spec, and the implementation plan live under `docs/superpowers/`. The `todo.md` at the root tracks deferred items (most notable: upgrading the local preview renderer to full Mustache).

---

## Publishing

The marketplace is published at [Interlincx/lincx-marketplace](https://github.com/Interlincx/lincx-marketplace). It is public, so the `/plugin marketplace add Interlincx/lincx-marketplace` flow in the "for end users" section works from any Claude Code session.

To ship skill changes to other agents, tag `main` after merging:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

`.github/workflows/release-skills.yml` runs every plugin's tests and builds the skills plus `manifest.json`. It then creates the GitHub Release with `lincx-skills.zip` and `manifest.json` attached. A failing test means no release. The release also runs `check-mcp-tool-refs.mjs`, which fails once `mcp-tools.json` is more than 90 days old; run `node scripts/sync-mcp-tools.mjs` before tagging if it is. Bump the minor version for skill changes, and the major version when a skill is removed or renamed.

---

## Feedback

Issues and PRs welcome. For Lincx-specific context or questions about the templates domain, contact the template team directly.
