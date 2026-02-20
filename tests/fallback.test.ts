import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("fallbackSearch (API)", () => {
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

    it("should fallback to LIKE search correctly with out-of-order words", () => {
        dbModule.addMemory({ content: "a configuracao do meu opencode eh legal", area: "general" });
        dbModule.addMemory({ content: "apenas opencode aqui", area: "general" });

        // Query words are out of order compared to the stored memory
        // The current fallback uses LIKE '%opencode configuracao%' which will match 0.
        // We expect it to split and use LIKE '%opencode%' AND LIKE '%configuracao%', matching 1.
        const resultsFallback = dbModule.fallbackSearch({ query: "opencode configuracao" });

        expect(resultsFallback.length).toBe(1);
        expect(resultsFallback[0].content).toContain("configuracao do meu opencode");
    });
});
