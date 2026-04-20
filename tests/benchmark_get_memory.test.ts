import { afterEach, beforeEach, describe, it, vi } from "vitest";

describe("Benchmark: getMemory", () => {
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

  it("measures performance of getMemory", () => {
    const { id } = dbModule.addMemory({
      name: "Test Memory",
      content: "This is some test content for benchmarking.",
      area: "general",
      tags: ["test", "benchmark"]
    });

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      dbModule.getMemory(id);
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`[BENCHMARK] getMemory iterations: ${iterations}`);
    console.log(`[BENCHMARK] Total duration: ${duration.toFixed(2)}ms`);
    console.log(`[BENCHMARK] Average duration: ${(duration / iterations).toFixed(4)}ms`);
  });
});
