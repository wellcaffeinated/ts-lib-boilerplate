# Tooling

- Runtime: **Bun** — use `bun` instead of `node`, `ts-node`, `npx`, etc.
- Tests: `bun test`
- Build: `bun run build` (pkgroll → `dist/`)
- Format: `bun run format` (Prettier — no semis, 2-space indent, single quotes)

## Bun notes

- Bun auto-loads `.env`, no dotenv needed
- Prefer `Bun.file` over `node:fs` read/write
