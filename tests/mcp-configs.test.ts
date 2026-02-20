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

    for (const [platform, clients] of Object.entries(generated)) {
      expect(validateGenerated("opencode", clients.opencode, { profileName: "default", platform })).toEqual([]);

      for (const [profileName, profileConfig] of Object.entries(clients.opencodeProfiles)) {
        expect(validateGenerated("opencode", profileConfig, { profileName, platform })).toEqual([]);
      }

      expect(validateGenerated("codex", clients.codex)).toEqual([]);
      expect(validateGenerated("cursor", clients.cursor)).toEqual([]);
    }
  });

  it("uses client-specific field mappings and OpenCode profiles", () => {
    const config = readCanonicalConfig(canonicalPath);
    const generated = generateAll(config, { platform: "windows" });
    const opencodeDefaultServer = generated.windows.opencode.mcp["omni-memory"];
    const opencodeArrayServer = generated.windows.opencodeProfiles["array.npx"].mcp["omni-memory"];
    const opencodeStringArgsServer = generated.windows.opencodeProfiles["string-args.npx"].mcp["omni-memory"];
    const opencodeFallbackServer = generated.windows.opencodeProfiles["array.fallback-dist"].mcp["omni-memory"];
    const codexServer = generated.windows.codex.mcpServers["omni-memory"];

    expect(Array.isArray(opencodeDefaultServer.command)).toBe(true);
    expect(opencodeDefaultServer.environment.OMNI_MEMORY_DIR).toContain("C:\\Users\\");
    expect(Array.isArray(opencodeArrayServer.command)).toBe(true);
    expect(opencodeStringArgsServer.command).toBe("npx");
    expect(Array.isArray(opencodeStringArgsServer.args)).toBe(true);
    expect(Array.isArray(opencodeFallbackServer.command)).toBe(true);
    expect(opencodeFallbackServer.command[0]).toBe("cmd");
    expect(opencodeFallbackServer.command[2]).toContain("|| node ");
    expect(codexServer.command).toBe("npx");
    expect(Array.isArray(codexServer.args)).toBe(true);
    expect(codexServer.env.OMNI_MEMORY_DIR).toContain("C:\\Users\\");
  });
});
