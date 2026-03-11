# Memory Context Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `memory_context_pack`, a read-only MCP tool that assembles compact, token-budgeted memory context from existing search results.

**Architecture:** Keep the feature inside the current SQLite + FTS5 MCP server. Add a small context-pack assembly helper in `src/database.ts`, expose it through one new tool, and document the workflow in README and roadmap docs.

**Tech Stack:** TypeScript, MCP SDK, better-sqlite3, Vitest

---

## Tasks

1. Add new shared types for context-pack args/result payloads.
2. Implement context-pack assembly in `src/database.ts` using existing search results plus direct internal record reads.
3. Add `src/tools/context-pack.ts` and register `memory_context_pack` in the MCP server.
4. Add focused Vitest coverage for structured output, filtering, truncation, ranking order, empty results, and access-count invariants.
5. Update `README.md` and `docs/ROADMAP.md`.
6. Run `npm run mcp:generate`, `npm run mcp:validate`, `npm run check`, `npm test`, and `npm run build`.
7. Sync `dist/` into `C:\Users\allan\.local\mcp\omni-memory-mcp\dist`.
8. Smoke test the deployed runtime by calling `memory_context_pack`.
9. Record project memory and commit the completed work.
