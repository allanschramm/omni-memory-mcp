import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("LIKE wildcard security fix verification", () => {
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

  it("should treat % as a literal after fix", () => {
    dbModule.addMemory({ name: "Match Percent", content: "This has 100% discount", area: "general" });
    dbModule.addMemory({ name: "Normal", content: "This has no special chars", area: "general" });

    // Searching for "%" should now only match what literally has a %
    const resultsAll = dbModule.fallbackSearch({ query: "%" });
    // If fixed, it should only match "Match Percent"
    expect(resultsAll.length).toBe(1);
    expect(resultsAll[0].name).toBe("Match Percent");
  });

  it("should treat _ as a literal after fix", () => {
    dbModule.addMemory({ name: "Match Underscore", content: "variable_name", area: "general" });
    dbModule.addMemory({ name: "Normal", content: "variablename", area: "general" });

    const results = dbModule.fallbackSearch({ query: "v_r" });
    // "v_r" should NOT match "variablename" if _ is escaped
    expect(results.some(r => r.name === "Normal")).toBe(false);
    expect(results.length).toBe(0); // neither should match "v_r" literally
  });

  it("should match literal _ if it exists", () => {
    dbModule.addMemory({ name: "Match Underscore", content: "variable_name", area: "general" });
    const results = dbModule.fallbackSearch({ query: "e_n" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Match Underscore");
  });
});
