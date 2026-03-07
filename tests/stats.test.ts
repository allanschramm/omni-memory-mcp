import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type DatabaseModule = Awaited<typeof import("../src/database.js")>;

describe("getStats (API)", () => {
    let dbModule: DatabaseModule;

    beforeEach(async () => {
        vi.resetModules();
        process.env.OMNI_MEMORY_DB = ":memory:";
        dbModule = await import("../src/database.js");
        dbModule.resetDatabase();
    });

    afterEach(() => {
        if (dbModule) dbModule.closeDatabase();
        delete process.env.OMNI_MEMORY_DB;
    });

    it("should return aggregated stats including total size, areas, and projects", () => {
        dbModule.addMemory({ content: "Content A", area: "solutions", project: "proj-X" });
        dbModule.addMemory({ content: "Content B", area: "solutions", project: "proj-X" });
        dbModule.addMemory({ content: "Content C", area: "preferences", project: "proj-Y" });
        dbModule.addMemory({ content: "Content D", area: "general" }); // no project
        dbModule.upsertMemory({ content: "Canonical content", name: "shared-rule", project: "proj-X" });
        dbModule.upsertMemory({ content: "Canonical content updated", match_name: "shared-rule", project: "proj-X" });

        const stats = dbModule.getStats();

        // Total count
        expect(stats.total_memories).toBe(5);

        // Areas count
        expect(stats.by_area).toEqual({
            solutions: 2,
            preferences: 1,
            general: 2
        });

        // Project count
        expect(stats.by_project).toEqual({
            "proj-X": 3,
            "proj-Y": 1,
            "unassigned": 1
        });

        expect(stats.event_counts).toEqual({
            memory_upsert_created: 1,
            memory_upsert_updated: 1
        });

        // Total size should exist and be a number (database file size)
        expect(typeof stats.total_size_bytes).toBe("number");
    });
});
