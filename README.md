# ts-lib-boilerplate

## Agent Summary

When scaffolding or migrating a TypeScript library project, apply the following stack and conventions. Prefer lean config, functional minimalism, and correctness over convenience. When in doubt, do less.

### Stack

| Concern | Tool | Notes |
|---|---|---|
| Package manager | **pnpm** | Use `pnpm@latest`. Enable corepack. |
| Bundler | **tsdown** | ESM-first, Rolldown-backed. Migrate from tsup with `tsdown migrate`. |
| Lint + Format | **Biome** | Replaces ESLint + Prettier. Single `biome.json`. |
| Type checking | **tsc** | Two configs: `tsconfig.json` (dev) and `tsconfig.build.json` (build). |
| Testing | **Vitest** | Configure to test compiled `dist/` output, not raw TS. |
| Dead code | **Knip** | Run in CI as a hard gate: `knip --max-issues 0`. |
| Release | **Release Please** | Conventional Commits → auto Release PR → auto publish. |
| Docs | **TypeDoc** | With `typedoc-plugin-markdown`. Output to `docs/`. |
| Agent context | **`CLAUDE.md`** | At repo root. Describe structure, scripts, and conventions. |

### Required Files

```
.
├── CLAUDE.md                     # Agent orientation file
├── biome.json                    # Lint + format config
├── knip.json                     # Dead code config (often optional)
├── package.json                  # Scripts must use standard names (see below)
├── release-please-config.json    # Release automation config
├── tsconfig.json                 # Dev tsconfig (includes tests + root config files)
├── tsconfig.build.json           # Build tsconfig (src/ only, composite: true)
├── tsdown.config.ts              # Bundler config
├── typedoc.json                  # Docs config
└── vitest.config.ts              # Test config
```

### Standard `package.json` Scripts

```json
{
  "scripts": {
    "dev":       "tsdown --watch",
    "build":     "tsdown",
    "typecheck": "tsc --noEmit",
    "lint":      "biome check .",
    "format":    "biome format . --write",
    "test":      "vitest run",
    "test:watch":"vitest",
    "knip":      "knip",
    "docs":      "typedoc",
    "release":   "changeset publish"
  }
}
```

### Standard `package.json` Exports Field

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"]
}
```

### GitHub Workflows

Three workflow files, no more:

```
.github/workflows/
  ci.yml       # PR gate: typecheck, lint, knip, test
  release.yml  # push to main: build + Release Please publish
  docs.yml     # on release tag: typedoc → GitHub Pages
```

### `CLAUDE.md` Minimal Contents

- Project purpose and public API entry point
- Any non-obvious conventions or constraints

---

## Human Explanation

### Why This Stack

The JS/TS ecosystem has been consolidating around Rust-backed tools that do more with less configuration. The old pattern — Rollup + Babel + ESLint + Prettier + Jest, each with its own config file — has been largely superseded. The new pattern is fewer, faster tools with sensible defaults.

---

### Package Manager: pnpm

pnpm is the library-author standard in 2025–2026. Vercel, Vue core, and Prisma have all migrated to it. Its key advantage over npm isn't just speed — it's **phantom dependency prevention**: pnpm enforces that you can only import packages you've explicitly declared in `package.json`. If your library builds under pnpm, it'll build for your consumers too. That's a correctness guarantee npm and Yarn don't give you.

**Why not Bun?** Bun is faster (~4-5× over pnpm on cold installs) and compelling as an all-in-one runtime. It's used in production at Anthropic for Claude Code. But for *library publishing specifically*, correctness matters more than install speed, and Bun has two friction points: ~95% Node.js API compatibility (so occasional surprises with native addons or obscure packages), and its lockfile format is incompatible with pnpm/npm/yarn. When retrofitting old projects especially, pnpm is the safer, lower-friction migration.

**Setup quirks:**
- Enable via corepack: `corepack enable && corepack prepare pnpm@latest --activate`
- Add `"packageManager": "pnpm@x.y.z"` to `package.json` — this pins the version for everyone
- If a legacy package has hoisting issues, add `.npmrc` with `shamefully-hoist=true` as a last resort (avoid if possible)
- Run `pnpm store prune` occasionally; the global store grows over time

---

### Bundler: tsdown

tsdown is the successor to tsup, built by the void(0) team (Vite, Vitest, Rolldown, Oxc). The important differences:

- **ESM-first**: tsup was CJS-first with ESM bolted on; tsdown gets ESM output right out of the box including file extensions in imports
- **`isolatedDeclarations`**: Uses TypeScript 5.5's `--isolated-declarations` flag for faster, more correct `.d.ts` generation via Oxc
- **Rolldown plugins**: Uses Rolldown's plugin API instead of esbuild's, giving you access to the Rollup plugin ecosystem
- Built-in workspace mode (`--workspace`) for monorepos

tsup is still fine for existing projects — tsdown even ships a `tsdown migrate` command to convert tsup configs automatically. For new projects, start with tsdown.

**Minimal `tsdown.config.ts`:**
```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [], // auto-detected from package.json dependencies
})
```

**Quirk:** tsdown does not yet support custom `tsconfig` path selection (a tsup feature). If you have a non-standard tsconfig name, use the `tsconfig` field — but check the current docs as this is actively evolving.

---

### Linting + Formatting: Biome

Biome replaces both ESLint and Prettier in a single Rust-backed tool with a single config file. It's effectively instant. The tradeoff is that it has fewer rules than ESLint's plugin ecosystem — but for a library, you rarely need the long tail of ESLint plugins.

**Minimal `biome.json`:**
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

**Quirk:** Biome's formatter is opinionated and not fully compatible with Prettier's output. On brownfield projects, run `biome format . --write` once and commit the diff cleanly before enabling it in CI — otherwise every PR will show formatting noise.

**Quirk:** If you have an existing `.eslintrc` or `.prettierrc`, Biome can import them: `biome migrate eslint` and `biome migrate prettier`.

---

### Type Checking: Two tsconfigs

The two-config pattern is now standard practice. The reason: your dev environment needs to typecheck test files and root-level config files (like `vitest.config.ts`), but your build should only compile `src/`.

**`tsconfig.json`** (dev, IDE, Vitest):
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedDeclarations": true,
    "skipLibCheck": true
  },
  "include": ["src", "test", "*.config.ts"]
}
```

**`tsconfig.build.json`** (tsdown, declaration emit):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src"]
}
```

**Key options explained:**
- `moduleResolution: "bundler"` — the correct setting when using a bundler like tsdown; enables `allowImportingTsExtensions` and resolves the way modern bundlers do
- `isolatedDeclarations: true` — TypeScript 5.5+. Requires each exported symbol to have an explicit type annotation, enabling fast parallel `.d.ts` generation. Will surface errors you didn't know you had.
- `noUncheckedIndexedAccess: true` — array indexing returns `T | undefined`, not `T`. Catches a huge class of runtime bugs.

---

### Dead Code: Knip

Knip builds a complete module graph of your project and finds: unused files, unused exports, unused `package.json` dependencies, and missing dependencies (things you import transitively but don't declare). ESLint catches unused variables *within* a file; Knip catches unused exports *across* the whole project.

Run it periodically during development and as a hard gate in CI.

**Minimal `knip.json`** (often not needed — Knip auto-detects most setups):
```json
{
  "entry": ["src/index.ts"],
  "ignore": ["**/*.test.ts"]
}
```

**Quirk:** Knip can have false positives for re-exported types used only by consumers (not within the project). Use `// knip-ignore` comments or the `ignoreDependencies` config key for known exceptions.

---

### Release Automation: Release Please

Release Please watches your commits on `main`, maintains a "Release PR" that accumulates version bumps and changelog entries, and publishes when you merge it. The only discipline required is writing **Conventional Commits** (e.g., `feat: add X`, `fix: correct Y`, `chore: update deps`).

**Workflow summary:**
1. You commit with conventional messages to `main`
2. Release Please bot opens/updates a "Release vX.Y.Z" PR automatically
3. You review the generated changelog and version bump
4. Merging the PR triggers publish to npm

**`release-please-config.json`:**
```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

**`.github/workflows/release.yml` skeleton:**
```yaml
name: Release
on:
  push:
    branches: [main]
permissions:
  contents: write
  pull-requests: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/release-please-action@v4
        id: release
        with:
          config-file: release-please-config.json
      - if: ${{ steps.release.outputs.release_created }}
        run: |
          corepack enable
          pnpm install --frozen-lockfile
          pnpm build
          pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Why not Changesets?** Changesets requires an explicit `npx changeset` step per PR, which is better for team workflows where multiple people contribute to a release. For solo library work, Release Please's commit-message-driven approach has zero per-PR overhead. If you ever move to a monorepo with multiple publishers, revisit Changesets.

---

### Documentation: TypeDoc

TypeDoc reads your exports and TSDoc comments and generates an API reference site. Minimal config needed for most libraries.

**`typedoc.json`:**
```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs",
  "plugin": ["typedoc-plugin-markdown"],
  "excludePrivate": true,
  "excludeInternal": true,
  "readme": "README.md"
}
```

Use `typedoc-plugin-markdown` if you want to embed docs in a VitePress or Astro site. Use the default HTML theme for standalone GitHub Pages docs.

**Quirk:** TypeDoc follows your `tsconfig.json`, not `tsconfig.build.json`. Make sure your `tsconfig.json` includes the right paths or TypeDoc will miss things.

---

### CI Workflow: `ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: corepack enable
      - uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: pnpm-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm knip --max-issues 0
      - run: pnpm test
      - run: pnpm build
```

**Notes:**
- Cache key is the lockfile hash — cache invalidates on any dependency change
- Run `typecheck` and `lint` before `test` to fail fast on the cheapest checks
- `pnpm build` at the end confirms the output is producible, even if tests pass on raw TS

---

### CLAUDE.md Template

```markdown
# [Project Name]

## Purpose
[One sentence: what this library does and who it's for]

## Entry Point
`src/index.ts` — all public exports are re-exported from here.

## Commands
- `pnpm build` — compile to `dist/` (ESM + CJS + types)
- `pnpm dev` — watch mode
- `pnpm test` — run Vitest
- `pnpm typecheck` — tsc without emit
- `pnpm lint` — Biome check
- `pnpm knip` — dead code check
- `pnpm docs` — generate TypeDoc to `docs/`

## Structure
- `src/` — source TypeScript
- `dist/` — compiled output (gitignored, generated by build)
- `test/` — Vitest tests
- `docs/` — generated TypeDoc (gitignored)

## Conventions
- All public types must be explicitly annotated (isolatedDeclarations)
- Tests run against compiled dist/, not raw src/
- Commits follow Conventional Commits for Release Please automation
- No default exports — named exports only

## Non-obvious things
[Add anything an agent would likely get wrong]
```