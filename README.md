# ts-lib-boilerplate

A minimal TypeScript library boilerplate.

## Stack

| Concern | Tool |
|---|---|
| Package manager | pnpm |
| Bundler | tsdown (ESM + CJS) |
| Lint + Format | Biome |
| Type checking | tsc |
| Testing | Vitest |
| Dead code | Knip |
| Release | Release Please |
| Docs | TypeDoc |

## Setup

```sh
corepack enable
pnpm install
```

## Scripts

```sh
pnpm build        # compile to dist/
pnpm dev          # watch mode
pnpm typecheck    # tsc without emit
pnpm lint         # biome check
pnpm format       # biome format --write
pnpm test         # vitest (requires build first)
pnpm knip         # dead code check
pnpm run docs     # generate TypeDoc to docs/
```

## Release

Uses [Release Please](https://github.com/googleapis/release-please). Write commits in [Conventional Commits](https://www.conventionalcommits.org/) format — Release Please opens and maintains a release PR automatically. Merging it publishes to npm.

Requires an `NPM_TOKEN` secret set in GitHub → Settings → Secrets → Actions.
