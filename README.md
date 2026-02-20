# Omni Memory MCP

Universal memory MCP server for multi-agent workflows.  
100% local with SQLite + FTS5.

## npm Package

- Package: `@sharkdyt/omni-memory-mcp`
- npm: `https://www.npmjs.com/package/@sharkdyt/omni-memory-mcp`
- Current `latest`: `1.0.4`

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
- Diagnostic tools (`memory_stats`)
- Organization by `area`, `project`, and `tags`
- Shared long-term memory across multiple projects and multiple coding agents/clients
- Canonical MCP config + client adapters (OpenCode, Codex, Cursor)

## Cross-Client MCP Standard

This project keeps one canonical MCP config and generates client-specific files.

Canonical source:

- `config/mcp/servers.json`

Generate adapters:

```bash
npm run mcp:generate
```

Validate adapters:

```bash
npm run mcp:validate
```

Generated files:

- `config/mcp/generated/opencode.windows.json`
- `config/mcp/generated/opencode.posix.json`
- `config/mcp/generated/opencode.windows.array.npx.json`
- `config/mcp/generated/opencode.windows.string-args.npx.json`
- `config/mcp/generated/opencode.windows.array.fallback-dist.json`
- `config/mcp/generated/opencode.posix.array.npx.json`
- `config/mcp/generated/opencode.posix.string-args.npx.json`
- `config/mcp/generated/opencode.posix.array.fallback-dist.json`
- `config/mcp/generated/codex.windows.json`
- `config/mcp/generated/codex.posix.json`
- `config/mcp/generated/cursor.windows.json`
- `config/mcp/generated/cursor.posix.json`

Compatibility matrix:

- `docs/mcp-compatibility-matrix.md`

## Quick Start (Most Newbie Friendly)

If your MCP client supports `command` + `args` + `env`, use:

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

### OpenCode compatibility profiles

OpenCode support can vary by client version and environment.  
This repository now generates three OpenCode profiles for each platform:

- `array.npx`: `command` as array (`["npx","-y","@sharkdyt/omni-memory-mcp"]`)
- `string-args.npx`: `command` as string + `args`
- `array.fallback-dist`: shell command that tries `npx` and falls back to local `dist/index.js`

Recommended default for OpenCode:

- `config/mcp/generated/opencode.<platform>.json` (this points to `array.fallback-dist`)

If you prefer explicit profile selection, copy one of:

- `config/mcp/generated/opencode.<platform>.array.npx.json`
- `config/mcp/generated/opencode.<platform>.string-args.npx.json`
- `config/mcp/generated/opencode.<platform>.array.fallback-dist.json`

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

## OpenCode / Codex / Cursor

Instead of writing each config by hand, generate client-specific adapters:

```bash
npm run mcp:generate
```

Then copy the generated file for your client/platform from `config/mcp/generated/`.

### OpenCode troubleshooting priority

1. Use `opencode.<platform>.json` first (default fallback profile).
2. If your OpenCode build prefers native `npx` only, try `opencode.<platform>.array.npx.json`.
3. If your OpenCode build requires `command` string + `args`, use `opencode.<platform>.string-args.npx.json`.

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
  "limit": 10,
  "enableAdvancedSyntax": false
}
```

*Note: `enableAdvancedSyntax` allows FTS5 boolean logic (e.g. `"typescript" AND "react" NOT "vue"`) but requires a strictly valid FTS5 query or it will throw an error.*

### `memory_stats`

```json
{}
```
*Returns total memories, size on disk, and breakdown by project and area.*

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

## Documentation and Memory Hygiene

For every meaningful project change, keep both sources of truth updated:

1. Repository docs (`README.md`, `docs/*`, compatibility/config docs) must reflect current behavior.
2. Omni Memory must receive a concise project memory entry with:
   - what changed,
   - why it changed,
   - constraints/assumptions,
   - next steps (if any).

Minimum release/update gate:

1. `npm run mcp:generate`
2. `npm run mcp:validate`
3. `npm run check`
4. Update docs for any behavior/config change
5. Add/update important project memory in Omni Memory

Operational checklist:

- `docs/release-checklist.md`

## License

Apache 2.0. See `LICENSE`.
