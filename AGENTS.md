# Omni Memory MCP - Agent Guidelines

Universal memory MCP server for multi-agent AI workflows. Uses SQLite + FTS5 for 100% local, offline-capable memory storage and retrieval.

## Core Priorities

1. Cross-agent compatibility is a core requirement (OpenCode, Codex, Cursor).
2. Documentation and project memory must stay synchronized after meaningful changes.
3. Memory-tool failures must not block core engineering tasks in this repository.

## Cross-Agent Compatibility Policy

- Canonical MCP source of truth: `config/mcp/servers.json`
- Always keep generated adapters current in `config/mcp/generated/`
- OpenCode must be treated as multi-dialect:
  - `array.npx`
  - `string-args.npx`
  - `array.fallback-dist` (tries `npx`, falls back to local `dist/index.js`)
- Default OpenCode generated config (`opencode.<platform>.json`) should remain aligned with fallback profile.

## Documentation and Memory Sync Policy

For every meaningful project change:

1. Update docs (`README.md`, `docs/*`) for behavior/config/compatibility changes.
2. Add/update Omni Memory entry with:
   - what changed,
   - why,
   - assumptions/constraints,
   - next steps.
3. If Omni Memory write fails in this project, continue the work and report the failure explicitly.

## Publish Ownership Policy

- Package publish ownership is user-side by default.
- Agent default behavior: prepare release artifacts only (version bump, changelog/docs sync, tarball via `npm pack`).
- Do not attempt `npm publish` unless the user explicitly asks in that same step and confirms credentials/token are ready.
- If publish is attempted and fails due to auth/scope/token, record this as process memory and fall back to handoff for user-side publish.

## Supabase MCP Auth Note

- Before any write operation in Supabase MCP, ensure auth session is active with:
  - `codex mcp login supabase`
- Symptom of missing/expired auth is write failure despite reachable MCP endpoint.
- If reads work but writes fail with read-only/auth errors, re-run Supabase MCP login and re-test with a small write query.

## Project Structure

```
src/
├── index.ts           # MCP server entry point
├── database.ts        # SQLite + FTS5 operations
├── types.ts           # TypeScript interfaces
└── tools/             # MCP tools (add, get, update, delete, list, search)
tests/
└── *.test.ts          # Vitest unit tests
```

## Commands

```bash
npm install            # Install dependencies
npm run build          # Build TypeScript
npm run dev            # Watch mode
npm run check          # Type check only
npm run start          # Run server
npm test               # Run all tests
npx vitest run tests/database.test.ts  # Single test file
npx vitest run -t "pattern"            # Tests matching pattern
```

## Code Style

### TypeScript
- **Target**: ES2022, **Module**: Node16 (ESM), **Strict**: enabled
- Add `.js` extension for local imports

### Naming
| Type | Convention | Example |
|------|------------|---------|
| Files | `kebab-case.ts` | `database.ts`, `add.ts` |
| Variables/functions | `camelCase` | `addMemory`, `searchResults` |
| Classes | `PascalCase` | `MemoryDatabase` |
| Interfaces/Types | `PascalCase` | `Memory`, `MemoryArea` |
| Constants | `UPPER_SNAKE_CASE` | `DATA_DIR` |

### Imports (ordered)
1. Node.js built-ins (`path`, `fs`, `os`)
2. External packages (`@modelcontextprotocol/sdk`, `zod`, `better-sqlite3`)
3. Local imports with `.js` extension

### Types & Formatting
- No `any` - use explicit types or `unknown` with guards
- Use `readonly` for immutable data
- Use union types for limited options
- Indentation: 2 spaces, Semicolons: required, Double quotes

### Error Handling
```typescript
// Database errors
catch (error) {
  throw new Error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
}

// MCP tool errors
catch (error: unknown) {
  return {
    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
    isError: true,
  };
}
```

### MCP Tool Pattern (Zod validation)
```typescript
import { z } from "zod";
import { addMemory } from "../database.js";

export const schema = {
  content: z.string().describe("Content to store"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional(),
  project: z.string().optional(),
  tags: z.array(z.string()).optional(),
};

export const handler = async ({ content, area, project, tags }) => {
  try {
    const result = addMemory({ content, area, project, tags });
    return { content: [{ type: "text" as const, text: `Added: ${result.id}` }] };
  } catch (error: unknown) {
    return {
      content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
};
```

## Database Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  area TEXT DEFAULT 'general',
  project TEXT,
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE memories_fts USING fts5(content, project, tags, content='memories', content_rowid='rowid');
```

## Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryDatabase } from "../src/database.js";

describe("MemoryDatabase", () => {
  let db: MemoryDatabase;
  beforeEach(() => { db = new MemoryDatabase(":memory:"); });
  afterEach(() => { db.close(); });

  it("should add a memory", () => {
    const id = db.add("test content", "general", "project");
    expect(id).toBeDefined();
  });
});
```

## Key Reminders

1. **No `any`** - Use explicit types or `unknown` with type guards
2. **ESM only** - `import/export` with `.js` extension for locals
3. **Sync DB** - `better-sqlite3` is synchronous, no async/await for DB
4. **Console.error for logs** - stdout is MCP protocol
5. Run release/change gate before completion:
   - `npm run mcp:generate`
   - `npm run mcp:validate`
   - `npm run check`
   - `npm run build`
   - `npm test` (or document exact environment limitation)
6. Keep version metadata consistent across package/docs/runtime-facing surfaces.
