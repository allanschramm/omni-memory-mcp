#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  generateAll,
  readCanonicalConfig,
  validateCanonicalConfig,
  validateGenerated,
} from "./mcp-config-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultConfigPath = path.join(rootDir, "config", "mcp", "servers.json");
const args = process.argv.slice(2);
const platform = readArgValue(args, "--platform") ?? "all";
const configPath = readArgValue(args, "--config") ?? defaultConfigPath;

const config = readCanonicalConfig(configPath);
const canonicalErrors = validateCanonicalConfig(config);
if (canonicalErrors.length > 0) {
  fail([
    "Canonical config validation failed:",
    ...canonicalErrors.map((error) => `- ${error}`),
  ]);
}

const generated = generateAll(config, { platform });
const generationErrors = [];
for (const [currentPlatform, clients] of Object.entries(generated)) {
  const opencodeDefaultErrors = validateGenerated("opencode", clients.opencode, {
    platform: currentPlatform,
    profileName: "default",
  });
  for (const error of opencodeDefaultErrors) {
    generationErrors.push(`opencode/${currentPlatform}/default: ${error}`);
  }

  for (const [profileName, output] of Object.entries(clients.opencodeProfiles)) {
    const errors = validateGenerated("opencode", output, {
      platform: currentPlatform,
      profileName,
    });
    for (const error of errors) {
      generationErrors.push(`opencode/${currentPlatform}/${profileName}: ${error}`);
    }
  }

  const codexErrors = validateGenerated("codex", clients.codex);
  for (const error of codexErrors) {
    generationErrors.push(`codex/${currentPlatform}: ${error}`);
  }

  const cursorErrors = validateGenerated("cursor", clients.cursor);
  for (const error of cursorErrors) {
    generationErrors.push(`cursor/${currentPlatform}: ${error}`);
  }
}

if (generationErrors.length > 0) {
  fail([
    "Generated config validation failed:",
    ...generationErrors.map((error) => `- ${error}`),
  ]);
}

console.log("MCP config validation passed.");

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
