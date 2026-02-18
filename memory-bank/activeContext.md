# Active Context

## Current Focus
- Keep docs and release metadata aligned with the published npm package.

## Recent Changes
- Added robust path normalization and home expansion in `src/database.ts`.
- Added packaging metadata and publish scripts in `package.json`.
- Rewrote `README.md` with beginner-first setup via `npx` and path examples.
- Added path resolution tests (`tests/path-resolution.test.ts`).
- Added `.npm-cache/` and `*.tgz` to `.gitignore`.
- Ran full publish pipeline (`prepublishOnly`) successfully up to auth gate.
- Updated package scope from `@allanschramm` to `@sharkdyt` because `@allanschramm` scope was not found on npm.
- Successfully published `@sharkdyt/omni-memory-mcp@1.0.0` to npm.

## Next Steps
- Keep docs/version notes in sync for future npm releases.
- Tag and release from GitHub when preparing `1.0.1+`.
