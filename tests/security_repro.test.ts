import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("listMemories security (reproduction)", () => {
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

  it("should not match accidental wildcards in tags", () => {
    dbModule.addMemory({
      content: "Memory 1",
      tags: ["foo_bar"],
    });
    dbModule.addMemory({
      content: "Memory 2",
      tags: ["fooxbar"],
    });

    // If unescaped, "foo_bar" LIKE "%"foo_bar"%" will match both because _ is a wildcard
    // However, the code uses %"${args.tag}"%

    // Let's try searching for "foo_bar"
    const results1 = dbModule.listMemories({ tag: "foo_bar" });
    // In unescaped version, this might match both "foo_bar" and "fooxbar"

    // Let's try searching for "%"
    const results2 = dbModule.listMemories({ tag: "%" });
    // In unescaped version, this will match any memory with at least one tag

    expect(results1.length).toBe(1);
    expect(results1[0].tags).toContain("foo_bar");

    expect(results2.length).toBe(0); // Should match nothing if it's looking for literal %
  });
});
