# Memory Context Pack Design

> Approved design for `memory_context_pack` in `omni-memory-mcp`.

## Goal

Add a compact, read-only MCP tool that assembles prompt-friendly memory context from the existing SQLite + FTS5 retrieval path.

## Chosen Approach

Use a single public tool, `memory_context_pack`, built on top of the current `memory_search` ranking behavior. The tool returns compact text for immediate agent use and structured metadata for clients that want deterministic fields.

## Why This Approach

- Preserves the current local-first MCP architecture.
- Reuses existing ranking and search logic instead of creating a second retrieval path.
- Solves the immediate prompt-assembly problem without broadening the product into code indexing, embeddings, or HTTP APIs.

## Rejected Alternatives

### Separate compression API

Rejected for v1 because it adds surface area before there is a clear second use case outside prompt assembly.

### Broader `th0th`-style expansion

Rejected because it would pull `omni-memory-mcp` toward a different product: semantic code search, provider management, and multi-service orchestration.

### Internal-only search refinement

Rejected because it improves ranking but does not provide the new workflow agents actually need: "give me a compact context pack right now".

## Behavioral Notes

- The tool is read-only and must not increment `access_count`.
- Excerpts come from stored memory content, not full document reads via `memory_get`.
- The tool prefers more short excerpts over fewer long excerpts.
- `truncated=true` when the tool shortens or omits any result to stay within budget.
