import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("updateMemory (API)", () => {
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

  it("clears project when null is provided", () => {
    const created = dbModule.addMemory({
      name: "Project memory",
      content: "content",
      area: "general",
      project: "omni-memory-mcp",
    });

    const result = dbModule.updateMemory({ id: created.id, project: null });
    const updated = dbModule.getMemory(created.id);

    expect(result.changes).toBe(1);
    expect(updated?.project).toBeNull();
  });

  it("clears metadata when null is provided", () => {
    const created = dbModule.addMemory({
      name: "Metadata memory",
      content: "content",
      area: "general",
      metadata: { source: "test" },
    });

    const result = dbModule.updateMemory({ id: created.id, metadata: null });
    const updated = dbModule.getMemory(created.id);

    expect(result.changes).toBe(1);
    expect(updated?.metadata).toBeNull();
  });
});
