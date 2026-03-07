# Omni Memory MCP

Universal memory MCP server for multi-agent workflows.  
100% local with SQLite + FTS5.

## npm Package

- Package: `@sharkdyt/omni-memory-mcp`
- npm: `https://www.npmjs.com/package/@sharkdyt/omni-memory-mcp`
- Current `latest`: `1.0.6`

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
- **Progressive Disclosure:** Searches return metadata and summaries instead of full text to prevent LLM context overflow.
- **Active Forgetting Tracking:** Read actions (`memory_get`) increment `access_count` and update `accessed_at`.
- CRUD operations (`memory_add`, `memory_upsert`, `memory_get`, `memory_update`, `memory_delete`, `memory_list`, `memory_search`)
- Context optimization tools (`memory_prune`)
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
  "name": "User typescript preferences",
  "content": "User prefers TypeScript with strict mode",
  "area": "preferences",
  "project": "my-project",
  "tags": ["typescript", "coding-style"],
  "metadata": {
    "source": "conversation setup"
  }
}
```

Use `memory_add` for clearly new, one-off memories.

### `memory_upsert`

```json
{
  "name": "User typescript preferences",
  "content": "User prefers TypeScript with strict mode",
  "project": "my-project",
  "tags": ["typescript", "coding-style"],
  "allow_create": true
}
```

*Note: `memory_upsert` is intentionally conservative. It uses normalized `name + project` matching, updates only when there is one clear candidate, and refuses to write when the match is ambiguous.*
*Use `memory_upsert` before `memory_add` for durable facts, preferences, and evolving project memory.*

### `memory_get`

*Note: Fetching a memory via `memory_get` registers an access (increments `access_count` and updates `accessed_at`), indicating the memory is actively used.*

```json
{
  "id": "abc123"
}
```

### `memory_update`

```json
{
  "id": "abc123",
  "name": "Updated typescript preferences",
  "content": "Updated content",
  "project": null,
  "metadata": null,
  "tags": ["new-tag"]
}
```
*Use `null` for `project` or `metadata` to clear those values.*

### `memory_delete`

```json
{
  "id": "abc123"
}
```

### `memory_list`

*Note: Enforces Progressive Disclosure. It returns only IDs, Names, and metadata. You must call `memory_get` with the specific ID to read the full content.*

```json
{
  "area": "snippets",
  "project": "my-project",
  "tag": "important",
  "limit": 20
}
```

### `memory_search`

*Note: Enforces Progressive Disclosure. It returns only IDs, Names, and metadata. You must call `memory_get` with the specific ID to read the full content.*

```json
{
  "query": "typescript configuration",
  "project": "my-project",
  "limit": 10,
  "enableAdvancedSyntax": false,
  "search_mode": "balanced"
}
```

*Note: `enableAdvancedSyntax` allows FTS5 boolean logic (e.g. `"typescript" AND "react" NOT "vue"`) but requires a strictly valid FTS5 query or it will throw an error.*
*Note: `search_mode` tunes ranking only. `balanced` is the default, `exact` boosts exact title matches harder, and `broad` is more permissive for content-heavy results.*
*Search results include a compact `Match:` explanation showing which indexed fields contributed to the result.*

### `memory_stats`

```json
{}
```
*Returns total memories, size on disk, breakdown by project and area, plus local upsert metrics such as `memory_upsert_created` and `memory_upsert_updated`.*

### `memory_prune`

*Note: Cleans up memories that have decayed below a specific score dynamically calculated based on `created_at`, `accessed_at`, and `access_count`.*

```json
{
  "threshold_score": 0,
  "dry_run": true
}
```
*Always use `dry_run: true` first to see how many and which memories would be pruned before running the destructible cleanup.*

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
