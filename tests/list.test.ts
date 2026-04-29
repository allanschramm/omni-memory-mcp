import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("memory_list tool", () => {
  let dbModule: typeof import("../src/database.js");
  let toolModule: typeof import("../src/tools/list.js");

  beforeEach(async () => {
    vi.resetModules();
    process.env.OMNI_MEMORY_DB = ":memory:";
    dbModule = await import("../src/database.js");
    toolModule = await import("../src/tools/list.js");
    dbModule.resetDatabase();
  });

  afterEach(() => {
    dbModule.closeDatabase();
    delete process.env.OMNI_MEMORY_DB;
  });

  it("successfully lists memories with no filters", async () => {
    dbModule.addMemory({
      name: "Memory 1",
      content: "Content 1",
      area: "general",
    });
    dbModule.addMemory({
      name: "Memory 2",
      content: "Content 2",
      area: "solutions",
    });

    const response = await toolModule.handler({});

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Found 2 memories");
    expect(text).toContain("Memory 1");
    expect(text).toContain("Memory 2");
    expect(text).toContain("[general]");
    expect(text).toContain("[solutions]");
  });

  it("filters by area", async () => {
    dbModule.addMemory({
      name: "General Memory",
      content: "Content",
      area: "general",
    });
    dbModule.addMemory({
      name: "Solution Memory",
      content: "Content",
      area: "solutions",
    });

    const response = await toolModule.handler({ area: "solutions" });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Found 1 memories");
    expect(text).toContain("Solution Memory");
    expect(text).not.toContain("General Memory");
  });

  it("filters by project", async () => {
    dbModule.addMemory({
      name: "Project A Memory",
      content: "Content",
      area: "general",
      project: "project-a",
    });
    dbModule.addMemory({
      name: "Project B Memory",
      content: "Content",
      area: "general",
      project: "project-b",
    });

    const response = await toolModule.handler({ project: "project-a" });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Found 1 memories");
    expect(text).toContain("Project A Memory");
    expect(text).not.toContain("Project B Memory");
    expect(text).toContain("[project-a]");
  });

  it("filters by tag", async () => {
    dbModule.addMemory({
      name: "Tag 1 Memory",
      content: "Content",
      area: "general",
      tags: ["tag1", "shared"],
    });
    dbModule.addMemory({
      name: "Tag 2 Memory",
      content: "Content",
      area: "general",
      tags: ["tag2", "shared"],
    });

    const response = await toolModule.handler({ tag: "tag1" });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Found 1 memories");
    expect(text).toContain("Tag 1 Memory");
    expect(text).not.toContain("Tag 2 Memory");
    expect(text).toContain("#tag1");
  });

  it("respects the limit parameter", async () => {
    for (let i = 1; i <= 5; i++) {
      dbModule.addMemory({
        name: `Memory ${i}`,
        content: "Content",
        area: "general",
      });
    }

    const response = await toolModule.handler({ limit: 2 });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Found 2 memories");
    // Should be the most recent ones (5 and 4) since listMemories orders by created_at DESC
    expect(text).toContain("Memory 5");
    expect(text).toContain("Memory 4");
    expect(text).not.toContain("Memory 3");
  });

  it("returns no memories found message without filters", async () => {
    const response = await toolModule.handler({});

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("No memories found");
  });

  it("returns no memories found message with filters", async () => {
    const response = await toolModule.handler({ area: "preferences", project: "non-existent" });

    expect(response.isError).toBeUndefined();
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("No memories found with filters: area=preferences, project=non-existent");
  });

  it("verifies formatting of result entries", async () => {
    const { id } = dbModule.addMemory({
      name: "Full Memory",
      content: "Content",
      area: "solutions",
      project: "my-project",
      tags: ["important", "test"],
    });

    const response = await toolModule.handler({});

    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("1. [solutions] [my-project] #important #test");
    expect(text).toContain(`   ID: ${id}`);
    expect(text).toContain("   Name: Full Memory");
    expect(text).toContain("   Accessed: Never (0 times)");
  });

  it("handles unnamed memories", async () => {
    dbModule.addMemory({
      content: "Content",
      area: "general",
    });

    const response = await toolModule.handler({});
    const text = (response.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Name: Unnamed Memory");
  });

  it("returns an error when listMemories throws", async () => {
    vi.spyOn(dbModule, "listMemories").mockImplementation(() => {
      throw new Error("List failed");
    });

    const response = await toolModule.handler({});

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Failed to list memories: List failed");
  });
});
