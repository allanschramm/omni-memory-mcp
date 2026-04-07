import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("memory_prune", () => {
  let dbModule: typeof import("../src/database.js");
  let toolModule: typeof import("../src/tools/prune.js");

  beforeEach(async () => {
    vi.resetModules();
    process.env.OMNI_MEMORY_DB = ":memory:";
    dbModule = await import("../src/database.js");
    toolModule = await import("../src/tools/prune.js");
    dbModule.resetDatabase();
  });

  afterEach(() => {
    dbModule.closeDatabase();
    delete process.env.OMNI_MEMORY_DB;
  });

  it("identifies memories for pruning without deleting them in dry_run", async () => {
    // Seed memories
    // 1. Fresh memory (score ~ 0)
    dbModule.addMemory({
      name: "Fresh memory",
      content: "Fresh content",
    });

    // 2. Old memory (score < 0)
    // We need to manipulate the database directly to set an old created_at
    const db = (dbModule as any).getDatabase();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    db.prepare("INSERT INTO memories (id, name, content, created_at) VALUES (?, ?, ?, ?)").run(
        "old-id", "Old memory", "Old content", oldDate
    );

    // threshold_score = 0
    // Fresh memory should have score 0
    // Old memory should have score ~ -1.0

    const response = await toolModule.handler({ dry_run: true, threshold_score: 0 });
    const result = JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");

    expect(response.isError).toBeUndefined();
    expect(result.pruned_count).toBe(1);
    expect(result.details[0].name).toBe("Old memory");

    // Verify it's still in the DB
    const memories = dbModule.listMemories({ limit: 10 });
    expect(memories.some(m => m.name === "Old memory")).toBe(true);
  });

  it("deletes memories below threshold when dry_run is false", async () => {
    // Seed memories
    dbModule.addMemory({
      name: "Fresh memory",
      content: "Fresh content",
    });

    const db = (dbModule as any).getDatabase();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("INSERT INTO memories (id, name, content, created_at) VALUES (?, ?, ?, ?)").run(
        "old-id", "Old memory", "Old content", oldDate
    );

    const response = await toolModule.handler({ dry_run: false, threshold_score: 0 });
    const result = JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");

    expect(response.isError).toBeUndefined();
    expect(result.pruned_count).toBe(1);

    // Verify it's deleted from the DB
    const memories = dbModule.listMemories({ limit: 10 });
    expect(memories.some(m => m.name === "Old memory")).toBe(false);
    expect(memories.some(m => m.name === "Fresh memory")).toBe(true);
  });

  it("preserves old but frequently accessed memories", async () => {
    const db = (dbModule as any).getDatabase();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    // 10 days old, but accessed 20 times.
    // Penalty: 10 * 0.1 = 1.0
    // Bonus: 20 * 0.05 = 1.0
    // Score should be 0
    db.prepare("INSERT INTO memories (id, name, content, created_at, access_count, accessed_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        "active-old-id", "Active old memory", "Content", oldDate, 20, new Date().toISOString()
    );

    const response = await toolModule.handler({ dry_run: false, threshold_score: -0.1 });
    const result = JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");

    expect(result.pruned_count).toBe(0);
    const memories = dbModule.listMemories({ limit: 10 });
    expect(memories.some(m => m.name === "Active old memory")).toBe(true);
  });

  it("returns error response when pruneMemories fails", async () => {
    vi.spyOn(dbModule, "pruneMemories").mockImplementation(() => {
      throw new Error("Database error");
    });

    const response = await toolModule.handler({ threshold_score: 0 });

    expect(response.isError).toBe(true);
    expect(response.content[0].type === "text" && response.content[0].text).toContain("Failed to prune memories: Database error");
  });
});
