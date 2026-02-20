import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("searchMemories (API)", () => {
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

    it("should support FTS5 boolean syntax when enableAdvancedSyntax is true", () => {
        dbModule.addMemory({ content: "typescript is rigorous", area: "general" });
        dbModule.addMemory({ content: "python is dynamic", area: "general" });
        dbModule.addMemory({ content: "typescript and python are cool", area: "general" });

        const resultsAnd = dbModule.searchMemories({ query: "typescript AND rigorous", enableAdvancedSyntax: true });

        // Debugging what FTS5 actually returned
        if (resultsAnd.length !== 1) {
            console.log("FTS5 returned unexpected matches for 'typescript AND rigorous':", resultsAnd.map((r: any) => r.content));
        }

        expect(resultsAnd.length).toBe(1);
        expect(resultsAnd[0].content).toContain("typescript is rigorous");

        const resultsQuotes = dbModule.searchMemories({ query: '"typescript" NOT "dynamic"', enableAdvancedSyntax: true });

        // "typescript is rigorous" matches, "typescript and python are cool" matches.
        // "python is dynamic" should NOT match. So we expect 2 results.
        expect(resultsQuotes.length).toBe(2);

        expect(() => {
            dbModule.searchMemories({ query: '"unclosed', enableAdvancedSyntax: true });
        }).toThrow();
    });
});
