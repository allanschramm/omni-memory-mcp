# Omni Memory MCP

Universal memory MCP server for multi-agent workflows.  
100% local with SQLite + FTS5.

## npm Package

- Package: `@sharkdyt/omni-memory-mcp`
- npm: `https://www.npmjs.com/package/@sharkdyt/omni-memory-mcp`
- Current `latest`: `1.0.0`

## Project Memory

This project does not keep local `memory-bank/` files.
Operational context is stored through Omni Memory itself.

## Why this exists

- Keep AI memory local (no cloud dependency)
- Reuse the same memory across tools/agents
- Search fast with SQLite FTS5

## Features

- Local-first storage (SQLite)
- Full-text search with FTS5
- MCP-native tools
- CRUD operations (`memory_add`, `memory_get`, `memory_update`, `memory_delete`, `memory_list`, `memory_search`)
- Organization by `area`, `project`, and `tags`

## Quick Start (Most Newbie Friendly)

You do **not** need to set a path to `dist/index.js` if you use `npx`.

Use this in your MCP client config:

```json
{
  "mcpServers": {
    "omni-memory": {
      "command": "npx",
      "args": ["-y", "@sharkdyt/omni-memory-mcp"],
      "env": {
        "OMNI_MEMORY_DIR": "~/.omni-memory"
      }
    }
  }
}
```

This is the easiest setup because:
- No manual clone path
- No manual build path
- Works after npm registry publish

## Path Guide (Relative vs Absolute)

If you prefer running from local source (`dist/index.js`), use an **absolute path**.

- Relative path example (can break): `./dist/index.js`
- Absolute path example (recommended): full path to file on disk

Why relative paths break:
- Many MCP clients resolve paths from their own process working directory, not from your config file directory.

### Absolute path examples

Linux:

```json
{
  "command": "node",
  "args": ["/home/your-user/.local/mcp/omni-memory-mcp/dist/index.js"]
}
```

macOS:

```json
{
  "command": "node",
  "args": ["/Users/your-user/.local/mcp/omni-memory-mcp/dist/index.js"]
}
```

Windows:

```json
{
  "command": "node",
  "args": ["C:\\Users\\your-user\\.local\\mcp\\omni-memory-mcp\\dist\\index.js"]
}
```

Note:
- `~` is convenient, but not every client expands it consistently on Windows. Absolute paths are safer.

## Install from Source (Local Dev)

```bash
git clone https://github.com/allanschramm/omni-memory-mcp.git
cd omni-memory-mcp
npm install
npm run build
```

Then configure your MCP client with `node` + absolute path to `dist/index.js`.

## Tools

### `memory_add`

```json
{
  "content": "User prefers TypeScript with strict mode",
  "area": "preferences",
  "project": "my-project",
  "tags": ["typescript", "coding-style"]
}
```

### `memory_get`

```json
{
  "id": "abc123"
}
```

### `memory_update`

```json
{
  "id": "abc123",
  "content": "Updated content",
  "tags": ["new-tag"]
}
```

### `memory_delete`

```json
{
  "id": "abc123"
}
```

### `memory_list`

```json
{
  "area": "snippets",
  "project": "my-project",
  "tag": "important",
  "limit": 20
}
```

### `memory_search`

```json
{
  "query": "typescript configuration",
  "project": "my-project",
  "limit": 10
}
```

## Memory Areas

| Area | Description |
| --- | --- |
| `general` | General notes |
| `snippets` | Code snippets and patterns |
| `solutions` | Problem-solution pairs |
| `preferences` | User/team preferences |

## Data Storage

Default directory:

```text
~/.omni-memory/
|- omni-memory.db
|- omni-memory.db-wal
`- omni-memory.db-shm
```

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `OMNI_MEMORY_DIR` | `~/.omni-memory` | Data storage directory |
| `OMNI_MEMORY_DB` | `{OMNI_MEMORY_DIR}/omni-memory.db` | SQLite DB file path |

## Development

```bash
npm install
npm run check
npm run build
npm test
```

Extra commands:

```bash
npm run dev    # watch mode
npm run start  # run server from dist/
```

## Publish to npm

Checklist:

```bash
npm whoami
npm run check
npm test
npm pack
npm publish --access public
```

Notes:
- Package name is scoped: `@sharkdyt/omni-memory-mcp`
- `publishConfig.access=public` is already configured in `package.json`

## License

Apache 2.0. See `LICENSE`.
