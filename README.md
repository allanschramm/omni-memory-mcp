# Omni Memory MCP

Universal memory for multi-agent AI workflows. 100% local with SQLite + FTS5.

## Features

- **100% Local** - All data stored locally in SQLite, no cloud dependencies
- **Full-Text Search** - FTS5-powered search across all memories
- **Multi-Agent** - Share memories between OpenCode, Claude Code, Codex CLI, and more
- **CRUD Operations** - Complete create, read, update, delete API
- **Project Organization** - Organize memories by project
- **Tagging System** - Add tags for easy categorization
- **Memory Areas** - Four areas: general, snippets, solutions, preferences

## Installation

```bash
# Clone the repository
git clone https://github.com/allanschramm/omni-memory-mcp.git
cd omni-memory-mcp

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "omni-memory": {
      "command": "node",
      "args": ["~/.local/mcp/omni-memory-mcp/dist/index.js"],
      "env": {
        "OMNI_MEMORY_DIR": "~/.omni-memory"
      }
    }
  }
}
```

### Claude Code

Add to Claude Code configuration:

```json
{
  "mcpServers": {
    "omni-memory": {
      "command": "node",
      "args": ["~/.local/mcp/omni-memory-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### memory_add

Add a memory to the store.

```json
{
  "content": "User prefers TypeScript with strict mode",
  "area": "preferences",
  "project": "my-project",
  "tags": ["typescript", "coding-style"]
}
```

### memory_get

Retrieve a specific memory by ID.

```json
{
  "id": "abc123"
}
```

### memory_update

Update an existing memory.

```json
{
  "id": "abc123",
  "content": "Updated content",
  "tags": ["new-tag"]
}
```

### memory_delete

Delete a memory by ID.

```json
{
  "id": "abc123"
}
```

### memory_list

List memories with optional filters.

```json
{
  "area": "snippets",
  "project": "my-project",
  "tag": "important",
  "limit": 20
}
```

### memory_search

Full-text search across all memories.

```json
{
  "query": "typescript configuration",
  "project": "my-project",
  "limit": 10
}
```

## Memory Areas

| Area | Description |
|------|-------------|
| `general` | General memories and notes |
| `snippets` | Code snippets and patterns |
| `solutions` | Problem-solution pairs |
| `preferences` | User preferences and settings |

## Data Storage

All data is stored in `~/.omni-memory/`:

```
~/.omni-memory/
├── omni-memory.db      # SQLite database
├── omni-memory.db-wal  # Write-ahead log
└── omni-memory.db-shm  # Shared memory
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OMNI_MEMORY_DIR` | `~/.omni-memory` | Data storage directory |
| `OMNI_MEMORY_DB` | `{OMNI_MEMORY_DIR}/omni-memory.db` | SQLite database path |

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run check
```

## Architecture

```
┌─────────────────────────────────────────┐
│         MCP Client (OpenCode/etc)       │
└──────────────┬──────────────────────────┘
               │ stdio
┌──────────────▼──────────────────────────┐
│      Omni Memory MCP Server (TS)        │
│  ┌─────────────────────────────────┐    │
│  │  Tools: add, get, update,      │    │
│  │  delete, list, search          │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  SQLite + FTS5                  │    │
│  │  (better-sqlite3)              │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Comparison

| Feature | Omni Memory | Mem0 | AgentZero |
|---------|-------------|------|-----------|
| **Local-first** | ✅ | Partial | ✅ |
| **Zero dependencies** | ✅ SQLite only | ChromaDB | FAISS |
| **No LLM required** | ✅ | ❌ | ❌ |
| **MCP native** | ✅ | Partial | ❌ |
| **Full-text search** | ✅ FTS5 | ❌ | ❌ |

## License

Apache 2.0 - See [LICENSE](LICENSE)
