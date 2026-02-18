# Omni Memory MCP - Agent Guidelines

Universal memory MCP server for multi-agent AI workflows. Uses SQLite + FTS5 for 100% local, offline-capable memory storage and retrieval.

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
5. Run `npm run check && npm run build && npm test` before committing
