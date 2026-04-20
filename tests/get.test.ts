import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("memory_get tool", () => {
  let dbModule: typeof import("../src/database.js");
  let toolModule: typeof import("../src/tools/get.js");

  beforeEach(async () => {
    vi.resetModules();
    process.env.OMNI_MEMORY_DB = ":memory:";
    dbModule = await import("../src/database.js");
    toolModule = await import("../src/tools/get.js");
    dbModule.resetDatabase();
  });

  afterEach(() => {
    dbModule.closeDatabase();
    delete process.env.OMNI_MEMORY_DB;
  });

  it("successfully retrieves a memory with all fields", async () => {
    const { id } = dbModule.addMemory({
      name: "Test Memory",
      content: "This is a test memory content",
      area: "testing",
      project: "test-project",
      tags: ["tag1", "tag2"],
    });

    const response = await toolModule.handler({ id });

    expect(response.isError).toBeUndefined();
    expect(response.content[0].type).toBe("text");
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain(`ID: ${id}`);
    expect(text).toContain("Area: testing");
    expect(text).toContain("Project: test-project");
    expect(text).toContain("Tags: tag1, tag2");
    expect(text).toContain("This is a test memory content");
  });

  it("successfully retrieves a memory without project or tags", async () => {
    const { id } = dbModule.addMemory({
      name: "Minimal Memory",
      content: "Minimal content",
      area: "general",
    });

    const response = await toolModule.handler({ id });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain(`ID: ${id}`);
    expect(text).not.toContain("Project:");
    expect(text).not.toContain("Tags:");
    expect(text).toContain("Minimal content");
  });

  it("returns an error when memory is not found", async () => {
    const response = await toolModule.handler({ id: "non-existent-id" });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe("Memory not found: non-existent-id");
  });

  it("returns an error when getMemory throws", async () => {
    vi.spyOn(dbModule, "getMemory").mockImplementation(() => {
      throw new Error("Database malfunction");
    });

    const response = await toolModule.handler({ id: "any-id" });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Failed to get memory: Database malfunction");
  });
});
