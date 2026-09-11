# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Readest is a cross-platform ebook reader built as a **Next.js 16 + Tauri v2** hybrid app, distributed as a pnpm workspace monorepo. The same React UI runs on:

- **Web** — Next.js + Cloudflare Workers (OpenNext) at web.readest.com
- **Desktop** — Windows / macOS / Linux via Tauri v2
- **Mobile** — Android / iOS via Tauri v2 mobile
- **Side surfaces** — `apps/readest-app/extension/send-to-readest` (browser extension) and `apps/readest-app/extensions/windows-thumbnail` (Windows shell extension)

The architecture is documented in depth under [`apps/readest-app/docs/`](apps/readest-app/docs/):

- [`architecture.md`](apps/readest-app/docs/architecture.md) — process boundaries, client/server split, external services
- [`code-layout.md`](apps/readest-app/docs/code-layout.md) — which directories are server-side, client-side, or mixed
- [`testing.md`](apps/readest-app/docs/testing.md) — test tiers, configs, and conventions

## Workspace layout

| Path                         | Purpose                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `apps/readest-app/`          | The Next.js + Tauri app (frontend + native shell + docs)      |
| `apps/readest-calibre-plugin/` | Companion Calibre plugin                                     |
| `apps/readest.koplugin/`     | KOReader plugin (Lua + embedded Rust `localsend-bin` helper)  |
| `packages/*`                 | Vendored git submodules (foliate-js, tauri, tauri-plugins, simplecc-wasm, js-mdict, qcms, swift-rs, tao) |
| `data/`                      | Screenshots and design assets                                 |
| `docker/`                    | Dockerfiles for containerized builds                          |
| `fastlane/`                  | Fastlane metadata for App Store / Play Store                  |

`apps/readest-app/CLAUDE.md` is a symlink to `apps/readest-app/AGENTS.md`, which is the **canonical agent guide** for app-level work (commands, source layout, design system rules, skill routing). **Read it before making changes inside `apps/readest-app/`.**

## Common commands (run from repo root)

```bash
# Setup
pnpm install
pnpm --filter @readest/readest-app setup-vendors   # copies vendor dist libs to public/

# Development
pnpm tauri            # passthrough to `tauri` CLI in apps/readest-app (desktop/mobile)
pnpm dev-web          # Web-only dev server (no Rust compilation)
pnpm tauri dev        # Desktop dev with Tauri (compiles Rust backend)

# Build
pnpm tauri build                  # Desktop production build
pnpm tauri android build          # Android
pnpm tauri ios build              # iOS

# Test (delegated to apps/readest-app; see apps/readest-app/docs/testing.md)
pnpm test             # Unit tests (vitest + jsdom)
pnpm test:lua         # koplugin busted tests
pnpm lint             # Biome + tsgo
pnpm lint:lua         # koplugin LuaJIT syntax check
pnpm format           # Biome format (root)
pnpm format:check     # Biome format check
pnpm fmt:check        # Rust `cargo fmt --check` (src-tauri)
pnpm clippy:check     # Rust `cargo clippy` (src-tauri)
```

## Git worktrees

Always use `pnpm worktree:new <branch|pr-number>` from the root to create worktrees. Never run `git worktree add` directly — the script handles submodule init, dependency install, `.env` copying, vendor assets, and Tauri gen symlinks that are required for lint and tests to pass.

```bash
pnpm worktree:new feat/my-feature   # New branch from origin/main
pnpm worktree:new 3837              # Checkout PR #3837 with push access to fork
```

## Backend integrations (Next.js routes)

The Next.js layer under `apps/readest-app` is the same code on all clients. On the web target it is deployed as a Cloudflare Worker (via `@opennextjs/cloudflare` + `wrangler.toml`); on Tauri targets the routes still exist but most clients hit the production deployment over HTTPS. External services include Supabase (auth + Postgres), S3/R2 (storage), Stripe (billing), OpenAI/Ollama (AI), DeepL/Google/Azure/Yandex (translation), Google Books/Open Library/Hardcover (metadata), OPDS/Calibre (catalogs), Wiktionary/StarDict (dictionaries), Readwise, Edge TTS, and Apple/Google IAP.

## App-level rules (delegate to apps/readest-app/AGENTS.md)

The app directory carries its own agent guide (`apps/readest-app/AGENTS.md`, symlinked as `CLAUDE.md`). It defines:

- App-specific test commands, source layout, and path aliases
- Verification done-conditions (`pnpm test`, `pnpm lint`, `pnpm fmt:check`, `pnpm clippy:check`, `pnpm test:rust`, Lua checks for `apps/readest.koplugin`, etc.)
- TypeScript rules (no `any`, strict mode, ES2022)
- Test-first development expectations
- Design system conventions, E-ink overlay rules, safe-area insets, TTS engine selection
- Implementation-scope guardrails ("write the minimum code that solves the requested problem")
- Skill-routing table for product / engineering / design / QA workflows

When working inside `apps/readest-app/`, follow that file. It supersedes this root guide for app-internal work.

## Companion surfaces

- **`apps/readest-calibre-plugin/`** — Calibre integration plugin (separate package).
- **`apps/readest.koplugin/`** — KOReader plugin (Lua + a standalone Rust crate at `apps/readest.koplugin/native/localsend-bin`). Its verification rules are tracked separately in the app agent guide under `lint:lua`, `test:lua`, and the `koplugin_rust_lint` CI job.

## License

Readest is AGPL-3.0-or-later (see [`LICENSE`](LICENSE)). Vendored libraries retain their own licenses; see the README's attribution section.
