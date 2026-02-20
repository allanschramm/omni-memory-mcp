import fs from "node:fs";
import path from "node:path";

const SUPPORTED_CLIENTS = ["opencode", "codex", "cursor"];
const SUPPORTED_PLATFORMS = ["windows", "posix"];
const SUPPORTED_OPENCODE_DIALECTS = ["array", "string-args"];
const OPENCODE_FALLBACK_PROFILE = "array.fallback-dist";

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

  const opencodeProfiles = config.profiles?.opencode;
  if (opencodeProfiles !== undefined) {
    if (!opencodeProfiles || typeof opencodeProfiles !== "object" || Array.isArray(opencodeProfiles)) {
      errors.push("`profiles.opencode` must be an object when provided.");
      return errors;
    }

    if (opencodeProfiles.enableDialects !== undefined) {
      if (
        !Array.isArray(opencodeProfiles.enableDialects) ||
        opencodeProfiles.enableDialects.length === 0 ||
        opencodeProfiles.enableDialects.some((dialect) => !SUPPORTED_OPENCODE_DIALECTS.includes(dialect))
      ) {
        errors.push(
          "`profiles.opencode.enableDialects` must be a non-empty array with values from: array, string-args."
        );
      }
    }

    if (
      opencodeProfiles.enableFallbackDist !== undefined &&
      typeof opencodeProfiles.enableFallbackDist !== "boolean"
    ) {
      errors.push("`profiles.opencode.enableFallbackDist` must be a boolean when provided.");
    }

    if (opencodeProfiles.enableFallbackDist === true) {
      if (!isAbsoluteWindowsPath(opencodeProfiles.distPathWindows)) {
        errors.push(
          "`profiles.opencode.distPathWindows` must be an absolute Windows path when fallback is enabled."
        );
      }
      if (!isAbsolutePosixPath(opencodeProfiles.distPathPosix)) {
        errors.push("`profiles.opencode.distPathPosix` must be an absolute POSIX path when fallback is enabled.");
      }
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
    const opencodeProfiles = adaptOpenCodeProfiles(config, currentPlatform);
    output[currentPlatform] = {
      opencode: selectDefaultOpenCodeProfile(opencodeProfiles),
      opencodeProfiles,
      codex: adaptCodex(config, currentPlatform),
      cursor: adaptCursor(config, currentPlatform),
    };
  }
  return output;
}

export function validateGenerated(client, generatedConfig, options = {}) {
  if (!SUPPORTED_CLIENTS.includes(client)) {
    return [`Unknown client "${client}".`];
  }

  const platform = options.platform;
  const profileName = options.profileName;
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
      const hasArrayCommand = Array.isArray(entry.command) && entry.command.every((v) => isNonEmptyString(v));
      const hasStringCommandWithArgs =
        isNonEmptyString(entry.command) &&
        Array.isArray(entry.args) &&
        entry.args.every((v) => isNonEmptyString(v));

      if (!hasArrayCommand && !hasStringCommandWithArgs) {
        errors.push(
          `mcp.${id} must use either command as string + args array, or command as array of strings.`
        );
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

      if (profileName === OPENCODE_FALLBACK_PROFILE) {
        if (!Array.isArray(entry.command) || entry.command.length < 3) {
          errors.push(`mcp.${id}.command must be shell-based command array for fallback profile.`);
          continue;
        }

        const [shell, shellArg, commandText] = entry.command;
        if (platform === "windows") {
          if (shell !== "cmd" || shellArg?.toLowerCase() !== "/c") {
            errors.push(`mcp.${id}.command must start with ["cmd","/c", ...] on Windows fallback profile.`);
          }
        }
        if (platform === "posix") {
          if (shell !== "sh" || shellArg !== "-lc") {
            errors.push(`mcp.${id}.command must start with ["sh","-lc", ...] on POSIX fallback profile.`);
          }
        }
        if (typeof commandText !== "string" || !commandText.includes("|| node ")) {
          errors.push(`mcp.${id}.command must include fallback operator and node dist execution.`);
        }
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
    writeJsonFile(outDir, `codex.${platform}.json`, clients.codex);
    writeJsonFile(outDir, `cursor.${platform}.json`, clients.cursor);
    writeJsonFile(outDir, `opencode.${platform}.json`, clients.opencode);

    for (const [profileName, data] of Object.entries(clients.opencodeProfiles)) {
      writeJsonFile(outDir, `opencode.${platform}.${profileName}.json`, data);
    }
  }
}

function adaptOpenCodeProfiles(config, platform) {
  const settings = readOpenCodeSettings(config);
  const profiles = {};

  for (const dialect of settings.enableDialects) {
    if (dialect === "array") {
      profiles["array.npx"] = adaptOpenCodeArray(config, platform);
      continue;
    }
    if (dialect === "string-args") {
      profiles["string-args.npx"] = adaptOpenCodeStringArgs(config, platform);
    }
  }

  if (settings.enableFallbackDist) {
    const distPath = platform === "windows" ? settings.distPathWindows : settings.distPathPosix;
    profiles[OPENCODE_FALLBACK_PROFILE] = adaptOpenCodeFallbackDist(config, platform, distPath);
  }

  return profiles;
}

function selectDefaultOpenCodeProfile(opencodeProfiles) {
  if (opencodeProfiles[OPENCODE_FALLBACK_PROFILE]) {
    return opencodeProfiles[OPENCODE_FALLBACK_PROFILE];
  }
  if (opencodeProfiles["array.npx"]) {
    return opencodeProfiles["array.npx"];
  }
  if (opencodeProfiles["string-args.npx"]) {
    return opencodeProfiles["string-args.npx"];
  }

  throw new Error("No OpenCode profile was generated. Check canonical opencode profile settings.");
}

function adaptOpenCodeArray(config, platform) {
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

function adaptOpenCodeStringArgs(config, platform) {
  const mcp = {};
  for (const server of config.servers) {
    const env = resolveEnvForPlatform(server.env ?? {}, platform);
    mcp[server.id] = {
      type: "local",
      command: server.command,
      args: [...server.args],
      environment: env,
      enabled: server.enabled,
      timeout: server.timeoutMs,
    };
  }
  return { mcp };
}

function adaptOpenCodeFallbackDist(config, platform, distPath) {
  const mcp = {};
  for (const server of config.servers) {
    const env = resolveEnvForPlatform(server.env ?? {}, platform);
    const npxCommand = [server.command, ...server.args].join(" ");
    const fallbackCommand =
      platform === "windows"
        ? ["cmd", "/c", `${npxCommand} || node ${distPath}`]
        : ["sh", "-lc", `${npxCommand} || node ${distPath}`];

    mcp[server.id] = {
      type: "local",
      command: fallbackCommand,
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

function readOpenCodeSettings(config) {
  const profile = config.profiles?.opencode ?? {};

  return {
    enableDialects: profile.enableDialects ?? ["array", "string-args"],
    enableFallbackDist: profile.enableFallbackDist ?? true,
    distPathWindows: profile.distPathWindows ?? "C:\\Users\\your-user\\.local\\mcp\\omni-memory-mcp\\dist\\index.js",
    distPathPosix: profile.distPathPosix ?? "/home/your-user/.local/mcp/omni-memory-mcp/dist/index.js",
  };
}

function writeJsonFile(outDir, filename, data) {
  const outputPath = path.join(outDir, filename);
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function isAbsoluteWindowsPath(value) {
  return isNonEmptyString(value) && (/^[A-Za-z]:\\/.test(value) || value.startsWith("\\\\"));
}

function isAbsolutePosixPath(value) {
  return isNonEmptyString(value) && value.startsWith("/");
}
