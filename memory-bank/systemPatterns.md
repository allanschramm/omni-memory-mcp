# System Patterns

## Architecture
- MCP stdio server in TypeScript.
- SQLite database with FTS5 virtual table.
- Tools layer: add/get/update/delete/list/search.

## Data Patterns
- `memories` table as source of truth.
- FTS sync through SQLite triggers.
- Area/project/tag filters applied in list/search.

## Configuration Pattern
- Resolve storage paths from env with precedence:
  1) `OMNI_MEMORY_DB`
  2) `OMNI_MEMORY_DIR` + default db name
- Normalize relative paths and expand `~`.
