# MCP Compatibility Matrix

This project defines one canonical config and generates client-specific MCP configs.

## Canonical Source

- File: `config/mcp/servers.json`
- Generated output directory: `config/mcp/generated`
- Generate all: `npm run mcp:generate`
- Validate all: `npm run mcp:validate`

## Field Mapping

| Canonical field | OpenCode | Codex | Cursor |
| --- | --- | --- | --- |
| `id` | `mcp.<id>` | `mcpServers.<id>` | `mcpServers.<id>` |
| `transport` | `type` | n/a (local command implied) | n/a (local command implied) |
| `command` + `args` | `command: [command, ...args]` | `command` + `args` | `command` + `args` |
| `env` | `environment` | `env` | `env` |
| `enabled` | `enabled` | n/a | n/a |
| `timeoutMs` | `timeout` | n/a | n/a |

## Important Dialect Differences

- OpenCode local MCP uses:
  - `command` as an array
  - `environment` (not `env`)
- Codex/Cursor use:
  - `command` as string
  - `args` as array
  - `env` object

## Platform Output

Generator emits both platform variants:

- `*.windows.json`
- `*.posix.json`

`OMNI_MEMORY_DIR` is expanded from `${HOME}` in canonical config:

- Windows: `C:\\Users\\your-user\\.omni-memory`
- POSIX: `/home/your-user/.omni-memory`

## Release Gate Recommendation

Run before release:

```bash
npm run mcp:validate
npm test
```
