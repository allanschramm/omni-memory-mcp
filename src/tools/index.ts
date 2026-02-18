/**
 * Tools index - Export all MCP tools
 */

import type { ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolCallback<T extends ZodRawShape> = (args: {
  [K in keyof T]: T[K]["_type"];
}) => Promise<CallToolResult>;

export { schema as addSchema, handler as addHandler } from "./add.js";
export { schema as getSchema, handler as getHandler } from "./get.js";
export { schema as updateSchema, handler as updateHandler } from "./update.js";
export { schema as deleteSchema, handler as deleteHandler } from "./delete.js";
export { schema as listSchema, handler as listHandler } from "./list.js";
export { schema as searchSchema, handler as searchHandler } from "./search.js";
