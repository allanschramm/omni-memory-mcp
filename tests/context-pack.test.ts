import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("memory_context_pack", () => {
  let dbModule: typeof import("../src/database.js");
  let toolModule: typeof import("../src/tools/context-pack.js");

  beforeEach(async () => {
    vi.resetModules();
    process.env.OMNI_MEMORY_DB = ":memory:";
    dbModule = await import("../src/database.js");
    toolModule = await import("../src/tools/context-pack.js");
    dbModule.resetDatabase();
  });

  afterEach(() => {
    dbModule.closeDatabase();
    delete process.env.OMNI_MEMORY_DB;
  });

  it("returns text plus structured metadata for matching memories", async () => {
    dbModule.addMemory({
      name: "TypeScript strict mode",
      content: "Enable strict mode and noUncheckedIndexedAccess for safer configs.",
      area: "preferences",
      project: "repo-a",
      tags: ["typescript", "config"],
    });

    const response = await toolModule.handler({ query: "strict mode", max_tokens: 400, max_memories: 3 });
    const structured = response.structuredContent as { count: number; memories: Array<{ name: string | null }> };

    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain("Built context pack for \"strict mode\".");
    expect(structured.count).toBe(1);
    expect(structured.memories[0].name).toBe("TypeScript strict mode");
  });

  it("respects project, area, and tag filters", () => {
    dbModule.addMemory({
      name: "TS config",
      content: "TypeScript repo settings",
      area: "solutions",
      project: "repo-a",
      tags: ["important", "typescript"],
    });
    dbModule.addMemory({
      name: "Wrong project",
      content: "TypeScript repo settings",
      area: "solutions",
      project: "repo-b",
      tags: ["important", "typescript"],
    });
    dbModule.addMemory({
      name: "Wrong area",
      content: "TypeScript repo settings",
      area: "general",
      project: "repo-a",
      tags: ["important", "typescript"],
    });

    const result = dbModule.createMemoryContextPack({
      query: "TypeScript repo settings",
      project: "repo-a",
      area: "solutions",
      tag: "important",
      max_memories: 5,
      max_tokens: 500,
    });

    expect(result.count).toBe(1);
    expect(result.memories[0].name).toBe("TS config");
  });

  it("respects max_memories and preserves search ranking order", () => {
    dbModule.addMemory({
      name: "typescript configuration",
      content: "misc note",
      area: "general",
    });
    dbModule.addMemory({
      name: "General note",
      content: "deep typescript configuration guide",
      area: "general",
    });
    dbModule.addMemory({
      name: "Extra note",
      content: "typescript configuration backup details",
      area: "general",
    });

    const result = dbModule.createMemoryContextPack({
      query: "typescript configuration",
      max_memories: 2,
      max_tokens: 600,
    });

    expect(result.count).toBe(2);
    expect(result.memories[0].name).toBe("typescript configuration");
    expect(result.truncated).toBe(true);
  });

  it("respects max_tokens and truncates excerpts deterministically", () => {
    dbModule.addMemory({
      name: "Long memory",
      content: "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega ".repeat(8),
      area: "general",
    });

    const result = dbModule.createMemoryContextPack({
      query: "alpha beta gamma",
      max_memories: 1,
      max_tokens: 200,
    });

    expect(result.count).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.estimated_tokens).toBeLessThanOrEqual(200);
    expect(result.memories[0].excerpt.endsWith("…")).toBe(true);
  });

  it("returns an empty non-error result when there are no matches", async () => {
    const response = await toolModule.handler({ query: "no match anywhere" });
    const structured = response.structuredContent as { count: number; memories: unknown[] };

    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain("No matching memories found.");
    expect(structured.count).toBe(0);
    expect(structured.memories).toEqual([]);
  });

  it("does not mutate access_count", () => {
    dbModule.addMemory({
      name: "Access invariant",
      content: "This memory should stay unread.",
      area: "general",
    });

    const before = dbModule.listMemories({ limit: 10 });
    dbModule.createMemoryContextPack({
      query: "stay unread",
      max_memories: 1,
      max_tokens: 300,
    });
    const after = dbModule.listMemories({ limit: 10 });

    expect(before[0].access_count).toBe(0);
    expect(after[0].access_count).toBe(0);
  });
});
