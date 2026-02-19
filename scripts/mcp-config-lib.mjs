import fs from "node:fs";
import path from "node:path";

const SUPPORTED_CLIENTS = ["opencode", "codex", "cursor"];
const SUPPORTED_PLATFORMS = ["windows", "posix"];

export function readCanonicalConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

export function validateCanonicalConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object") {
    errors.push("Config must be an object.");
    return errors;
  }

  if (typeof config.version !== "number") {
    errors.push("`version` must be a number.");
  }

  if (!Array.isArray(config.servers) || config.servers.length === 0) {
    errors.push("`servers` must be a non-empty array.");
    return errors;
  }

  for (const [index, server] of config.servers.entries()) {
    const prefix = `servers[${index}]`;
    if (!server || typeof server !== "object") {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(server.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    }
    if (server.transport !== "local") {
      errors.push(`${prefix}.transport must be "local" for MVP.`);
    }
    if (!isNonEmptyString(server.command)) {
      errors.push(`${prefix}.command must be a non-empty string.`);
    }
    if (!Array.isArray(server.args) || server.args.some((v) => !isNonEmptyString(v))) {
      errors.push(`${prefix}.args must be an array of strings.`);
    }
    if (server.env && !isStringRecord(server.env)) {
      errors.push(`${prefix}.env must be an object with string values.`);
    }
    if (typeof server.enabled !== "boolean") {
      errors.push(`${prefix}.enabled must be a boolean.`);
    }
    if (server.timeoutMs !== undefined && (!Number.isInteger(server.timeoutMs) || server.timeoutMs <= 0)) {
      errors.push(`${prefix}.timeoutMs must be a positive integer when provided.`);
    }
  }

  return errors;
}

export function generateAll(config, { platform = "all" } = {}) {
  const platforms = platform === "all" ? SUPPORTED_PLATFORMS : [platform];
  const output = {};
  for (const currentPlatform of platforms) {
    if (!SUPPORTED_PLATFORMS.includes(currentPlatform)) {
      throw new Error(`Unsupported platform "${currentPlatform}".`);
    }
    output[currentPlatform] = {
      opencode: adaptOpenCode(config, currentPlatform),
      codex: adaptCodex(config, currentPlatform),
      cursor: adaptCursor(config, currentPlatform),
    };
  }
  return output;
}

export function validateGenerated(client, generatedConfig) {
  if (!SUPPORTED_CLIENTS.includes(client)) {
    return [`Unknown client "${client}".`];
  }

  const errors = [];
  if (!generatedConfig || typeof generatedConfig !== "object") {
    return ["Generated config must be an object."];
  }

  if (client === "opencode") {
    const mcp = generatedConfig.mcp;
    if (!mcp || typeof mcp !== "object") {
      errors.push("OpenCode config must contain `mcp` object.");
      return errors;
    }
    for (const [id, entry] of Object.entries(mcp)) {
      if (!entry || typeof entry !== "object") {
        errors.push(`mcp.${id} must be an object.`);
        continue;
      }
      if (entry.type !== "local") {
        errors.push(`mcp.${id}.type must be \"local\".`);
      }
      if (!Array.isArray(entry.command) || entry.command.some((v) => !isNonEmptyString(v))) {
        errors.push(`mcp.${id}.command must be an array of strings.`);
      }
      if (entry.environment !== undefined && !isStringRecord(entry.environment)) {
        errors.push(`mcp.${id}.environment must be a string map.`);
      }
      if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
        errors.push(`mcp.${id}.enabled must be boolean when provided.`);
      }
      if (entry.timeout !== undefined && (!Number.isInteger(entry.timeout) || entry.timeout <= 0)) {
        errors.push(`mcp.${id}.timeout must be a positive integer when provided.`);
      }
    }
    return errors;
  }

  const mcpServers = generatedConfig.mcpServers;
  if (!mcpServers || typeof mcpServers !== "object") {
    errors.push(`${client} config must contain \`mcpServers\` object.`);
    return errors;
  }

  for (const [id, entry] of Object.entries(mcpServers)) {
    if (!entry || typeof entry !== "object") {
      errors.push(`mcpServers.${id} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(entry.command)) {
      errors.push(`mcpServers.${id}.command must be a string.`);
    }
    if (!Array.isArray(entry.args) || entry.args.some((v) => !isNonEmptyString(v))) {
      errors.push(`mcpServers.${id}.args must be an array of strings.`);
    }
    if (entry.env !== undefined && !isStringRecord(entry.env)) {
      errors.push(`mcpServers.${id}.env must be a string map.`);
    }
  }
  return errors;
}

export function writeGeneratedFiles(generated, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [platform, clients] of Object.entries(generated)) {
    for (const [client, data] of Object.entries(clients)) {
      const filename = `${client}.${platform}.json`;
      const outputPath = path.join(outDir, filename);
      fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    }
  }
}

function adaptOpenCode(config, platform) {
  const mcp = {};
  for (const server of config.servers) {
    const env = resolveEnvForPlatform(server.env ?? {}, platform);
    mcp[server.id] = {
      type: "local",
      command: [server.command, ...server.args],
      environment: env,
      enabled: server.enabled,
      timeout: server.timeoutMs,
    };
  }
  return { mcp };
}

function adaptCodex(config, platform) {
  const mcpServers = {};
  for (const server of config.servers) {
    mcpServers[server.id] = {
      command: server.command,
      args: [...server.args],
      env: resolveEnvForPlatform(server.env ?? {}, platform),
    };
  }
  return { mcpServers };
}

function adaptCursor(config, platform) {
  const mcpServers = {};
  for (const server of config.servers) {
    mcpServers[server.id] = {
      command: server.command,
      args: [...server.args],
      env: resolveEnvForPlatform(server.env ?? {}, platform),
    };
  }
  return { mcpServers };
}

function resolveEnvForPlatform(env, platform) {
  const defaultHome = platform === "windows" ? "C:\\Users\\your-user" : "/home/your-user";
  const resolved = {};
  for (const [key, value] of Object.entries(env)) {
    const replaced = String(value).replaceAll("${HOME}", defaultHome);
    resolved[key] = platform === "windows" ? replaced.replaceAll("/", "\\") : replaced;
  }
  return resolved;
}

function isStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
