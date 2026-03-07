import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("searchMemories (API)", () => {
  let dbModule: typeof import("../src/database.js");

  beforeEach(async () => {
    vi.resetModules();
    process.env.OMNI_MEMORY_DB = ":memory:";
    dbModule = await import("../src/database.js");
    dbModule.resetDatabase();
  });

  afterEach(() => {
    dbModule.closeDatabase();
    delete process.env.OMNI_MEMORY_DB;
  });

  it("supports FTS5 boolean syntax when enableAdvancedSyntax is true", () => {
    dbModule.addMemory({ name: "Rigorous", content: "typescript is rigorous", area: "general" });
    dbModule.addMemory({ name: "Dynamic", content: "python is dynamic", area: "general" });
    dbModule.addMemory({ name: "Cool", content: "typescript and python are cool", area: "general" });

    const resultsAnd = dbModule.searchMemories({ query: "typescript AND rigorous", enableAdvancedSyntax: true });
    expect(resultsAnd).toHaveLength(1);
    expect(resultsAnd[0].name).toBe("Rigorous");

    const resultsQuotes = dbModule.searchMemories({
      query: "\"typescript\" NOT \"dynamic\"",
      enableAdvancedSyntax: true,
    });
    expect(resultsQuotes).toHaveLength(2);

    expect(() => {
      dbModule.searchMemories({ query: "\"unclosed", enableAdvancedSyntax: true });
    }).toThrow("Invalid FTS5 advanced syntax");
  });

  it("ranks exact title matches above body-only matches", () => {
    dbModule.addMemory({ name: "typescript configuration", content: "misc note", area: "general" });
    dbModule.addMemory({ name: "General note", content: "deep typescript configuration guide", area: "general" });

    const results = dbModule.searchMemories({ query: "typescript configuration" });

    expect(results[0].name).toBe("typescript configuration");
    expect(results[0].explanation).toContain("name");
  });

  it("lightly boosts frequently accessed memories in close matches", () => {
    const first = dbModule.addMemory({ name: "alpha", content: "search ranking baseline", area: "general" });
    const second = dbModule.addMemory({ name: "beta", content: "search ranking baseline", area: "general" });

    dbModule.getMemory(second.id);
    dbModule.getMemory(second.id);

    const results = dbModule.searchMemories({ query: "search ranking baseline" });

    expect(results[0].id).toBe(second.id);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});
