#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  generateAll,
  readCanonicalConfig,
  validateCanonicalConfig,
  validateGenerated,
  writeGeneratedFiles,
} from "./mcp-config-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultConfigPath = path.join(rootDir, "config", "mcp", "servers.json");
const defaultOutDir = path.join(rootDir, "config", "mcp", "generated");

const args = process.argv.slice(2);
const platform = readArgValue(args, "--platform") ?? "all";
const configPath = readArgValue(args, "--config") ?? defaultConfigPath;
const outDir = readArgValue(args, "--out") ?? defaultOutDir;

const config = readCanonicalConfig(configPath);
const canonicalErrors = validateCanonicalConfig(config);
if (canonicalErrors.length > 0) {
  fail([
    "Canonical config validation failed:",
    ...canonicalErrors.map((error) => `- ${error}`),
  ]);
}

const generated = generateAll(config, { platform });
for (const [currentPlatform, clients] of Object.entries(generated)) {
  const opencodeDefaultErrors = validateGenerated("opencode", clients.opencode, {
    platform: currentPlatform,
    profileName: "default",
  });
  if (opencodeDefaultErrors.length > 0) {
    fail([
      `Generated config validation failed for opencode/${currentPlatform}/default:`,
      ...opencodeDefaultErrors.map((error) => `- ${error}`),
    ]);
  }

  for (const [profileName, output] of Object.entries(clients.opencodeProfiles)) {
    const profileErrors = validateGenerated("opencode", output, {
      platform: currentPlatform,
      profileName,
    });
    if (profileErrors.length > 0) {
      fail([
        `Generated config validation failed for opencode/${currentPlatform}/${profileName}:`,
        ...profileErrors.map((error) => `- ${error}`),
      ]);
    }
  }

  const codexErrors = validateGenerated("codex", clients.codex);
  if (codexErrors.length > 0) {
    fail([
      `Generated config validation failed for codex/${currentPlatform}:`,
      ...codexErrors.map((error) => `- ${error}`),
    ]);
  }

  const cursorErrors = validateGenerated("cursor", clients.cursor);
  if (cursorErrors.length > 0) {
    fail([
      `Generated config validation failed for cursor/${currentPlatform}:`,
      ...cursorErrors.map((error) => `- ${error}`),
    ]);
  }
}

writeGeneratedFiles(generated, outDir);
console.log(`Generated MCP configs in ${outDir}`);

function readArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || index === argv.length - 1) {
    return null;
  }
  return argv[index + 1];
}

function fail(lines) {
  for (const line of lines) {
    console.error(line);
  }
  process.exit(1);
}
