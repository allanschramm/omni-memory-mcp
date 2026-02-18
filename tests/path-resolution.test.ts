import { describe, it, expect } from "vitest";
import { homedir } from "os";
import { isAbsolute } from "path";
import { normalizeUserPath, resolveStoragePaths } from "../src/database.js";

describe("Path resolution", () => {
  it("expands '~' to home directory", () => {
    const resolvedPath = normalizeUserPath("~");
    expect(resolvedPath).toBe(homedir());
  });

  it("expands '~/folder' to home directory", () => {
    const resolvedPath = normalizeUserPath("~/omni-memory");
    expect(resolvedPath.startsWith(homedir())).toBe(true);
    expect(resolvedPath.includes("omni-memory")).toBe(true);
  });

  it("converts relative path to absolute path", () => {
    const resolvedPath = normalizeUserPath("./relative-db");
    expect(isAbsolute(resolvedPath)).toBe(true);
  });

  it("resolves storage paths with OMNI_MEMORY_DIR", () => {
    const previousDir = process.env.OMNI_MEMORY_DIR;
    const previousDb = process.env.OMNI_MEMORY_DB;

    process.env.OMNI_MEMORY_DIR = "~/custom-memory-dir";
    delete process.env.OMNI_MEMORY_DB;

    const { dataDir, dbPath } = resolveStoragePaths();
    expect(dataDir.startsWith(homedir())).toBe(true);
    expect(dbPath.includes("omni-memory.db")).toBe(true);

    if (previousDir === undefined) {
      delete process.env.OMNI_MEMORY_DIR;
    } else {
      process.env.OMNI_MEMORY_DIR = previousDir;
    }

    if (previousDb === undefined) {
      delete process.env.OMNI_MEMORY_DB;
    } else {
      process.env.OMNI_MEMORY_DB = previousDb;
    }
  });
});
