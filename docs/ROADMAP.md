# Roadmap

## Near Term

1. Keep the MCP memory core small, local-first, and cross-client compatible.
2. Improve prompt assembly on top of the existing SQLite + FTS5 store.
3. Add small read-only context helpers before adding heavier retrieval systems.

## Active Direction

The current roadmap favors token-budgeted memory context assembly over a broader expansion into code indexing, vector search, or multi-service orchestration.

Recent addition:

- `memory_context_pack`: compact, prompt-friendly memory retrieval built on the current search pipeline.

## Deferred Work

These are intentionally deferred until the current MCP memory core proves insufficient:

- Vector or hybrid semantic retrieval
- Codebase indexing
- Knowledge graph relationships
- Separate HTTP APIs or multi-process architecture
- Provider-managed embeddings

## Guiding Principle

Add the smallest durable feature that makes agents more useful without weakening the repository's core guarantees:

- local-first data ownership
- MCP-native workflows
- progressive disclosure
- low operational overhead
