# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vite plugin that turns a folder of SVG icons into consumable icons **and** ships an
interactive preview/management UI. Two independent delivery tracks (configured
separately, at least one required):

- **font track** (`font.dir`): SVGs → an icon font (`.woff2/.woff/.eot` + CSS) via
  [`fantasticon`](https://github.com/tancredi/fantasticon). Consumed as CSS classes (`class="icon-home"`).
- **svg track** (`svg.dir`): SVGs → a single `<symbol>` sprite. Consumed as `<use href="#icon-home">` or inlined.

Orthogonal to the tracks are two **consumption modes** (`mode`, mutually exclusive):

- `class` (default): `import 'virtual:supericon'` is a side-effect that injects the font `<link>` and/or sprite.
- `import`: `import { IconHome } from 'virtual:supericon'` yields tree-shakeable component exports; `import 'virtual:supericon/register'` runs the one-time side-effect init. Also emits a `.d.ts` (`dts` option).

## Working style

Follow the `andrej-karpathy-skills:karpathy-guidelines` skill: surgical changes (touch only
what the request needs, match existing style), simplicity first (least code, nothing
speculative), surface assumptions and tradeoffs before coding, and verify against explicit
success criteria. Note this repo has no test suite — verify via the demo app or `dev:client`.

## Commands

This is a pnpm workspace (`demo` is the only sub-package). The plugin builds in **two halves**:

```bash
# Develop the plugin: node half (tsup --watch) + client UI (vite serve) together
pnpm dev

# Build both halves → dist/index.js (node) + dist/client (UI)
pnpm build

# Individual halves
pnpm dev:node      # tsup watch, src/node/index.ts → dist/index.js (ESM + dts)
pnpm dev:client    # vite serve src/client (the preview UI in isolation)
pnpm build:node
pnpm build:client

# The demo app (consumes the plugin via workspace:*)
pnpm dev:demo      # or: pnpm run -C demo dev
pnpm build:demo
```

There is **no test suite and no lint script**. TypeScript is checked implicitly by
`tsup --dts` / `vue-tsc` during builds. Formatting is Prettier (`.prettierrc`).

`svg-font-repair-lab/` is a standalone experimentation sandbox, not part of the build.

## Architecture

### Two-process build, and how the halves connect

- **Node half** (`src/node/`) is bundled by tsup to `dist/index.js` — this is the plugin.
- **Client half** (`src/client/`, Vue 3) is bundled by Vite to `dist/client` — this is the UI.
- At runtime the plugin serves `dist/client` statically via `sirv`. The path constant is
  `DIR_CLIENT` in `src/dir.ts` (`../dist/client` relative to the bundled node file).
- `src/client/vite.config.ts` applies `superIcon` to *itself* using the demo's icons, so the
  UI can be developed standalone (`pnpm dev:client`) against real data.

### Plugin lifecycle (`src/node/index.ts` — the single source of truth)

`superIcon(options)` returns one Vite plugin (`enforce: 'pre'`). Order matters:

1. **`config`**: resolves `font.dir`/`svg.dir` (through Vite aliases, see `alias.ts`),
   clears the cache dir, and constructs `fontsGenerator` / `spriteGenerator`. The cache/output
   dir is always `node_modules/.supericon` (`distDir`), **not** the Vite build output.
2. **`resolveId` / `load`**: implements the virtual modules. `load` branches on `isImport` and
   generates **client JS source as strings** (helpers like `fontLinkSnippet`, `spriteFetchSnippet`,
   `spriteInlineSnippet` at the top of the file). Dev references assets via `/@fs/...`; build
   uses `this.emitFile` + `import.meta.ROLLUP_FILE_URL_*`.
3. **`generateBundle`** (build only): tree-shakes the sprite. It scans every output chunk for
   `#id` references and emits only the `<symbol>`s actually used, overwriting the placeholder
   asset. `spriteRef != null` (not the mode) gates this.

### Virtual modules (`src/node/constants.ts`)

- `virtual:supericon` → `\0virtual-supericon` — the public entry (barrel in import mode).
- `virtual:supericon/register` → `\0virtual-supericon-register` — the side-effect init.

### Generators

- `fontsGenerator.ts` — wraps `fantasticon`. `getTagsFromPath` derives grouping tags from the
  icon's subdirectory (also reused by the sprite generator).
- `spriteGenerator.ts` — runs `svgo` per icon, namespaces internal ids per-symbol to avoid
  cross-icon id/color bleed, and wraps symbols via `wrapSprite` (shared by dev write + build overwrite).
- `importMode.ts` — `buildIconMetas` merges both tracks and detects global name conflicts;
  `toExportName` maps ids to `IconHome`-style names; `generateBarrel` / `generateDts` emit the import-mode outputs. Export names must be **globally unique across directories** in import mode.

### Dev server & preview UI wiring

- `configureServer` (dev only) mounts the UI at `<base>__supericon` (`CLIENT_URL`), watches
  **only `.svg` files** under the source dirs (debounced), regenerates, and pushes updates.
- Plugin↔UI talk over Vite's WebSocket. `rpc.ts` sends `vite-plugin-supericon:update` events;
  the client subscribes via `vite-hot-client` (`src/client/logic/getHot.ts`). The UI can also
  send `vite-plugin-supericon:save` back to persist an edited/repaired SVG (path-guarded to the source dirs).

### Client UI (`src/client/`)

Vue 3 + `naive-ui` + Tailwind v4. `logic/` holds composable state/actions (search, theme,
copy, save, svg repair in `utils/svg/`); `views/` holds the page sections; `components/` holds
reusable widgets.

## Conventions & gotchas

- **`src/node/index1.ts` is dead/legacy** — an earlier plugin implementation, not imported
  anywhere and not built. Edit `index.ts`; ignore or delete `index1.ts`, don't sync changes into it.
- Deprecated options: top-level `srcDir`/`name` are mapped to the font track with a runtime
  warning. New code should use `font: { dir, name }`. Prefer `font.dir` / `svg.dir`.
- Comments in the node code are predominantly in Chinese and describe non-obvious dev/build
  divergences — read them before changing the load/emit paths.
- Dependencies pin exact versions through pnpm **catalogs** (`pnpm-workspace.yaml`), referenced
  as `catalog:dev` / `catalog:frontend` / `catalog:prod` in `package.json`. Add/upgrade deps in the catalog.
- `spec.md`, `TODO-node.md`, and `docs/product-direction.md` document design intent for the
  node rework and import mode; consult them for the "why" behind current behavior.
