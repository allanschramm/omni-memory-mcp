import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("fallbackSearch (API)", () => {
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

  it("matches out-of-order words across indexed fields", () => {
    dbModule.addMemory({ name: "M1", content: "a configuracao do meu opencode eh legal", area: "general" });
    dbModule.addMemory({ name: "M2", content: "apenas opencode aqui", area: "general" });

    const results = dbModule.fallbackSearch({ query: "opencode configuracao" });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("M1");
    expect(results[0].explanation).toContain("content");
  });

  it("matches fallback queries by memory name", () => {
    dbModule.addMemory({ name: "OpenCode setup", content: "notes", area: "general" });

    const results = dbModule.fallbackSearch({ query: "OpenCode setup" });

    expect(results).toHaveLength(1);
    expect(results[0].explanation).toContain("name");
  });

  it("matches fallback queries by tags", () => {
    dbModule.addMemory({
      name: "Adapter docs",
      content: "compatibility notes",
      area: "general",
      tags: ["cursor", "opencode"],
    });

    const results = dbModule.fallbackSearch({ query: "opencode" });

    expect(results).toHaveLength(1);
    expect(results[0].explanation).toContain("tags");
  });
});
