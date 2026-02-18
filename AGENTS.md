# Omni Memory MCP - Agent Guidelines

Guidelines for agentic coding agents working on this MCP server project.

## Project Overview

Universal memory MCP server for multi-agent AI workflows. Uses SQLite + FTS5 for 100% local, offline-capable memory storage and retrieval.

```
~/.local/mcp/omni-memory-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── database.ts        # SQLite + FTS5 operations
│   ├── types.ts           # TypeScript interfaces
│   └── tools/
│       ├── add.ts         # memory_add tool
│       ├── get.ts         # memory_get tool
│       ├── update.ts      # memory_update tool
│       ├── delete.ts      # memory_delete tool
│       ├── list.ts        # memory_list tool
│       └── search.ts      # memory_search tool (FTS5)
├── tests/
│   └── *.test.ts          # Vitest unit tests
├── dist/                  # Compiled JavaScript
└── package.json
```

## Build Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Type check without emitting
npm run check

# Run server
npm start

# Run all tests
npm test

# Run single test file
npx vitest run tests/database.test.ts

# Run tests matching pattern
npx vitest run -t "memory_add"
```

## Code Style

### TypeScript Configuration

- **Target**: ES2022
- **Module**: Node16 with ESM
- **Strict mode**: Enabled
- **Source**: `src/` → Output: `dist/`

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (source) | `kebab-case.ts` | `database.ts`, `memory-add.ts` |
| Files (tests) | `kebab-case.test.ts` | `database.test.ts` |
| Variables | `camelCase` | `memoryId`, `searchResults` |
| Functions | `camelCase` | `addMemory()`, `searchMemories()` |
| Classes | `PascalCase` | `MemoryDatabase`, `MemoryServer` |
| Interfaces | `PascalCase` | `Memory`, `AddMemoryArgs` |
| Types | `PascalCase` | `MemoryArea`, `SearchResult` |
| Constants | `UPPER_SNAKE_CASE` | `DATA_DIR`, `DEFAULT_LIMIT` |

### Imports

```typescript
// Node.js built-ins first
import { join } from "path";
import { spawn } from "child_process";

// External packages second
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Database from "better-sqlite3";

// Local imports last (use .js extension for ESM)
import { Memory, AddMemoryArgs } from "./types.js";
import { addMemory, searchMemories } from "./database.js";
```

### Formatting

- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Double quotes for strings, single quotes inside strings
- **Trailing commas**: ES5 compatible (objects, arrays)
- **Max line length**: 100 characters (soft limit)

### Types

```typescript
// Prefer explicit types over `any`
// Use union types for limited options
type MemoryArea = "general" | "snippets" | "solutions" | "preferences";

// Use optional properties for optional fields
interface Memory {
  id: string;
  content: string;
  area: MemoryArea;
  project?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// Use readonly for immutable data
interface SearchResult {
  readonly memory: Memory;
  readonly score: number;
}
```

### Error Handling

```typescript
// Use typed errors with messages
try {
  const result = database.prepare("SELECT * FROM memories").all();
  return result;
} catch (error) {
  throw new Error(`Failed to query memories: ${error instanceof Error ? error.message : String(error)}`);
}

// For MCP tools, return error responses
catch (error: unknown) {
  return {
    content: [
      {
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    ],
    isError: true,
  };
}
```

### MCP Tool Pattern

```typescript
// Use Zod for input validation
server.tool(
  "memory_add",
  "Add a memory to the store",
  {
    content: z.string().describe("The content to store"),
    project: z.string().optional().describe("Project identifier"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  },
  async ({ content, project, tags }) => {
    try {
      const id = await addMemory(content, project, tags);
      return {
        content: [{ type: "text", text: `Memory added: ${id}` }],
      };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);
```

## Database Schema

```sql
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    area TEXT DEFAULT 'general',
    project TEXT,
    tags TEXT,  -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
    content, project, tags,
    content='memories',
    content_rowid='rowid'
);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OMNI_MEMORY_DIR` | `~/.omni-memory` | Data storage directory |
| `OMNI_MEMORY_DB` | `{OMNI_MEMORY_DIR}/omni-memory.db` | SQLite database path |

## Testing

```bash
# Run all tests
npm test

# Run single test file
npx vitest run tests/database.test.ts

# Run with coverage
npx vitest run --coverage

# Watch mode
npx vitest watch
```

### Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryDatabase } from "../src/database.js";

describe("MemoryDatabase", () => {
  let db: MemoryDatabase;

  beforeEach(() => {
    db = new MemoryDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("should add a memory", () => {
    const id = db.add("test content", "general", "test-project");
    expect(id).toBeDefined();
  });
});
```

## Important Reminders

1. **No `any` types** - Use explicit types or `unknown` with type guards
2. **ESM only** - Use `import/export` syntax, add `.js` extension in imports
3. **Keep tools simple** - Each tool does one thing well
4. **Errors are typed** - Always use `error instanceof Error` before accessing `.message`
5. **Database is synchronous** - `better-sqlite3` is sync, no async/await needed for DB ops
6. **Console.error for logs** - MCP uses stdout for protocol, logs go to stderr
7. **No Python bridge needed** - Pure TypeScript implementation
8. **Test before commit** - Run `npm run build && npm test` before pushing

## Pre-commit Checklist

```bash
npm run check     # Type check
npm run build     # Build
npm test          # Run tests
```
