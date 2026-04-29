/**
 * Utility functions for MCP tools
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates a standardized error response for MCP tools.
 */
export function makeErrorResponse(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    isError: true,
  };
}

/**
 * Handles caught errors in tool handlers by formatting them into a standardized response.
 */
export function handleToolError(prefix: string, error: unknown): CallToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return makeErrorResponse(`${prefix}: ${errorMessage}`);
}
