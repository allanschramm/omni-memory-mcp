/**
 * memory_delete tool - Delete a memory by ID
 */

import { z } from "zod";
import { deleteMemory, getMemory } from "../database.js";
import type { ToolCallback } from "./index.js";
import { handleToolError, makeErrorResponse } from "./utils.js";

export const schema = {
  id: z.string().describe("The memory ID to delete"),
};

export const handler: ToolCallback<typeof schema> = async ({ id }) => {
  try {
    // Check if memory exists first
    const existing = getMemory(id);
    if (!existing) {
      return makeErrorResponse(`Memory not found: ${id}`);
    }

    const result = deleteMemory(id);

    return {
      content: [
        {
          type: "text" as const,
          text: `Memory deleted successfully\nID: ${id}`,
        },
      ],
    };
  } catch (error) {
    return handleToolError("Failed to delete memory", error);
  }
};
