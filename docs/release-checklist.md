# Release and Change Checklist

Use this checklist for any meaningful change (feature, bugfix, config change, compatibility update, release prep).

## 1) Code and Config

- [ ] Code changes are complete and scoped.
- [ ] MCP config generation logic is updated when behavior/compatibility changes.
- [ ] Canonical config (`config/mcp/servers.json`) reflects current defaults.

## 2) Verification

- [ ] `npm run mcp:generate`
- [ ] `npm run mcp:validate`
- [ ] `npm run check`
- [ ] `npm test` (or document environment limitation with exact error)

## 3) Documentation Sync

- [ ] `README.md` updated for any behavior/config/API changes.
- [ ] `docs/mcp-compatibility-matrix.md` updated for cross-client compatibility changes.
- [ ] Generated file names and usage instructions are current.

## 4) Omni Memory Sync

- [ ] Add/update Omni Memory entry for the project (`project=omni-memory-mcp`).
- [ ] Entry includes:
  - what changed,
  - why,
  - assumptions/constraints,
  - next steps (if any).
- [ ] Use tags that aid retrieval (`release`, `compatibility`, `process`, etc.).

## 5) Final Sanity

- [ ] No stale/conflicting guidance remains in docs.
- [ ] Important decisions are discoverable in both docs and Omni Memory.
