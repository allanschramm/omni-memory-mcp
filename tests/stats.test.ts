import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getStats (API)", () => {
    let dbModule: any;

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

        const stats = dbModule.getStats();

        // Total count
        expect(stats.total_memories).toBe(4);

        // Areas count
        expect(stats.by_area).toEqual({
            solutions: 2,
            preferences: 1,
            general: 1
        });

        // Project count
        expect(stats.by_project).toEqual({
            "proj-X": 2,
            "proj-Y": 1,
            "unassigned": 1
        });

        // Total size should exist and be a number (database file size)
        expect(typeof stats.total_size_bytes).toBe("number");
    });
});
