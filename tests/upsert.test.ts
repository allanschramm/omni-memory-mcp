import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type DatabaseModule = Awaited<typeof import("../src/database.js")>;

describe("upsertMemory (API)", () => {
  let dbModule: DatabaseModule;

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

  it("creates a canonical memory when no match exists", () => {
    const result = dbModule.upsertMemory({
      content: "Use strict TypeScript in this repo",
      name: "ts-style",
      area: "preferences",
      project: "omni-memory-mcp",
      tags: ["typescript"],
    });

    expect(result.action).toBe("created");
    expect(result.id).toBeTruthy();
    expect(result.matched_name).toBe("ts-style");

    const memory = dbModule.getMemory(result.id!);
    expect(memory?.name).toBe("ts-style");
    expect(memory?.content).toContain("strict TypeScript");
  });

  it("updates an existing canonical memory using match_name", () => {
    const initial = dbModule.upsertMemory({
      content: "Initial canonical note",
      name: "repo-guidance",
      project: "omni-memory-mcp",
    });

    const updated = dbModule.upsertMemory({
      content: "Updated canonical note",
      match_name: "repo-guidance",
      area: "solutions",
      project: "omni-memory-mcp",
      tags: ["canonical"],
    });

    expect(updated.action).toBe("updated");
    expect(updated.id).toBe(initial.id);

    const memory = dbModule.getMemory(initial.id!);
    expect(memory?.content).toBe("Updated canonical note");
    expect(memory?.area).toBe("solutions");
    expect(memory?.tags).toEqual(["canonical"]);
    expect(memory?.name).toBe("repo-guidance");
  });

  it("scopes canonical matches by project", () => {
    const first = dbModule.upsertMemory({
      content: "Project A note",
      name: "shared-key",
      project: "project-a",
    });

    const second = dbModule.upsertMemory({
      content: "Project B note",
      name: "shared-key",
      project: "project-b",
    });

    expect(first.id).not.toBe(second.id);
    expect(dbModule.listMemories({ limit: 10 })).toHaveLength(2);
  });

  it("returns not_found when allow_create is false and nothing matches", () => {
    const result = dbModule.upsertMemory({
      content: "Should not be created",
      match_name: "missing-key",
      allow_create: false,
      project: "omni-memory-mcp",
    });

    expect(result.action).toBe("not_found");
    expect(result.id).toBeNull();
    expect(dbModule.listMemories({ limit: 10 })).toHaveLength(0);
  });
});
