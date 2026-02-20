#!/usr/bin/env node
/**
 * Omni Memory MCP Server
 * Universal memory for multi-agent AI workflows.
 * 100% local with SQLite + FTS5.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { schema as addSchema, handler as addHandler } from "./tools/add.js";
import { schema as getSchema, handler as getHandler } from "./tools/get.js";
import { schema as updateSchema, handler as updateHandler } from "./tools/update.js";
import { schema as deleteSchema, handler as deleteHandler } from "./tools/delete.js";
import { schema as listSchema, handler as listHandler } from "./tools/list.js";
import { schema as searchSchema, handler as searchHandler } from "./tools/search.js";
import { schema as statsSchema, handler as statsHandler } from "./tools/stats.js";

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version dynamically from package.json to stay in sync
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

// Create MCP server
const server = new McpServer({
  name: "omni-memory-mcp",
  version: packageJson.version || "1.0.0",
});

// Register tools
server.tool(
  "memory_add",
  "Add a memory to the universal memory store. Memories can be searched and retrieved later.",
  addSchema,
  addHandler
);

server.tool(
  "memory_get",
  "Retrieve a specific memory by its ID.",
  getSchema,
  getHandler
);

server.tool(
  "memory_update",
  "Update an existing memory's content, area, project, or tags.",
  updateSchema,
  updateHandler
);

server.tool(
  "memory_delete",
  "Delete a memory by its ID.",
  deleteSchema,
  deleteHandler
);

server.tool(
  "memory_list",
  "List memories with optional filters by area, project, or tag.",
  listSchema,
  listHandler
);

server.tool(
  "memory_search",
  "Full-text search across all memories using FTS5.",
  searchSchema,
  searchHandler
);

server.tool(
  "memory_stats",
  "Get statistics about the Omni Memory database, including total memories, size on disk, and counts by area and project.",
  statsSchema,
  statsHandler
);

// Graceful shutdown
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[Omni Memory MCP] Fatal error:", error);
  process.exit(1);
});
