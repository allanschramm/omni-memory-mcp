import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("upsertMemory (API)", () => {
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

  it("creates a new memory when no candidate exists", () => {
    const result = dbModule.upsertMemory({
      name: "Coding preferences",
      content: "Use strict TypeScript",
      project: "proj-a",
    });

    const created = dbModule.getMemory(result.id!);

    expect(result.action).toBe("created");
    expect(created?.name).toBe("Coding preferences");
  });

  it("updates an existing memory when one normalized name match exists", () => {
    const existing = dbModule.addMemory({
      name: "Coding Preferences",
      content: "Old content",
      project: "proj-a",
    });

    const result = dbModule.upsertMemory({
      name: " coding   preferences ",
      content: "Updated content",
      project: "proj-a",
      metadata: null,
    });

    const updated = dbModule.getMemory(existing.id);

    expect(result.action).toBe("updated");
    expect(result.id).toBe(existing.id);
    expect(updated?.content).toBe("Updated content");
  });

  it("does not update memories from a different project", () => {
    dbModule.addMemory({
      name: "Coding preferences",
      content: "Project A",
      project: "proj-a",
    });

    const result = dbModule.upsertMemory({
      name: "Coding preferences",
      content: "Project B",
      project: "proj-b",
    });

    expect(result.action).toBe("created");
  });

  it("returns ambiguity and writes nothing when multiple candidates match", () => {
    dbModule.addMemory({
      name: "Coding preferences",
      content: "one",
      project: undefined,
    });
    dbModule.addMemory({
      name: " coding   preferences ",
      content: "two",
      project: undefined,
    });

    const before = dbModule.listMemories({ limit: 10 }).length;
    const result = dbModule.upsertMemory({
      name: "Coding preferences",
      content: "new",
    });
    const after = dbModule.listMemories({ limit: 10 }).length;

    expect(result.action).toBe("ambiguous");
    expect(result.candidates).toHaveLength(2);
    expect(after).toBe(before);
  });

  it("falls back to create when name and match_name are missing", () => {
    const result = dbModule.upsertMemory({
      content: "Unnamed note",
      project: "proj-a",
    });

    const created = dbModule.getMemory(result.id!);

    expect(result.action).toBe("created");
    expect(created?.name).toBeNull();
  });

  it("supports allow_create=false when no candidate exists", () => {
    const result = dbModule.upsertMemory({
      name: "Missing canonical note",
      content: "Should not create",
      project: "proj-a",
      allow_create: false,
    });

    expect(result.action).toBe("skipped");
    expect(dbModule.listMemories({ limit: 10 })).toHaveLength(0);
  });

  it("preserves metadata null clearing when updating through upsert", () => {
    const existing = dbModule.addMemory({
      name: "Canonical preference",
      content: "Old content",
      project: "proj-a",
      metadata: { source: "seed" },
    });

    const result = dbModule.upsertMemory({
      name: "Canonical preference",
      content: "New content",
      project: "proj-a",
      metadata: null,
    });

    const updated = dbModule.getMemory(existing.id);

    expect(result.action).toBe("updated");
    expect(result.id).toBe(existing.id);
    expect(updated?.project).toBe("proj-a");
    expect(updated?.metadata).toBeNull();
  });
});
