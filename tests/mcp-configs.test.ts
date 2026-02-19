import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateAll,
  readCanonicalConfig,
  validateCanonicalConfig,
  validateGenerated,
} from "../scripts/mcp-config-lib.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const canonicalPath = path.join(rootDir, "config", "mcp", "servers.json");

describe("MCP config generation", () => {
  it("validates canonical config", () => {
    const config = readCanonicalConfig(canonicalPath);
    expect(validateCanonicalConfig(config)).toEqual([]);
  });

  it("generates valid configs for all clients and platforms", () => {
    const config = readCanonicalConfig(canonicalPath);
    const generated = generateAll(config, { platform: "all" });

    for (const clients of Object.values(generated)) {
      expect(validateGenerated("opencode", clients.opencode)).toEqual([]);
      expect(validateGenerated("codex", clients.codex)).toEqual([]);
      expect(validateGenerated("cursor", clients.cursor)).toEqual([]);
    }
  });

  it("uses client-specific field mappings", () => {
    const config = readCanonicalConfig(canonicalPath);
    const generated = generateAll(config, { platform: "windows" });
    const opencodeServer = generated.windows.opencode.mcp["omni-memory"];
    const codexServer = generated.windows.codex.mcpServers["omni-memory"];

    expect(Array.isArray(opencodeServer.command)).toBe(true);
    expect(opencodeServer.environment.OMNI_MEMORY_DIR).toContain("C:\\Users\\");
    expect(codexServer.command).toBe("npx");
    expect(Array.isArray(codexServer.args)).toBe(true);
    expect(codexServer.env.OMNI_MEMORY_DIR).toContain("C:\\Users\\");
  });
});
