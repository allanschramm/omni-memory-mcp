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
| `command` + `args` | profile-dependent (`command[]` or `command` + `args`) | `command` + `args` | `command` + `args` |
| `env` | `environment` | `env` | `env` |
| `enabled` | `enabled` | n/a | n/a |
| `timeoutMs` | `timeout` | n/a | n/a |

## OpenCode Profiles

Generated per platform:

- `opencode.<platform>.array.npx.json`
- `opencode.<platform>.string-args.npx.json`
- `opencode.<platform>.array.fallback-dist.json`
- `opencode.<platform>.json` (default alias; points to `array.fallback-dist`)

Profile behavior:

- `array.npx`: uses OpenCode `command` as array (`[command, ...args]`)
- `string-args.npx`: uses OpenCode `command` string + `args`
- `array.fallback-dist`: shell wrapper that tries `npx` first and falls back to `node <absolute-dist-path>`

## Important Dialect Differences

- OpenCode uses `mcp.<id>.environment` (not `env`)
- Codex/Cursor use `mcpServers.<id>.env`
- OpenCode command shape may vary by version; profiles above cover both known dialects

## Platform Output

Generator emits both platform variants:

- `*.windows.json`
- `*.posix.json`

`OMNI_MEMORY_DIR` is expanded from `${HOME}` in canonical config:

- Windows: `C:\\Users\\your-user\\.omni-memory`
- POSIX: `/home/your-user/.omni-memory`

Fallback `dist` paths come from `config/mcp/servers.json`:

- `profiles.opencode.distPathWindows`
- `profiles.opencode.distPathPosix`

## Release Gate Recommendation

Run before release:

```bash
npm run mcp:validate
npm test
```
