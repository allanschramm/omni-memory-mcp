/**
 * memory_delete tool - Delete a memory by ID
 */

import { z } from "zod";
import { deleteMemory, getMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  id: z.string().describe("The memory ID to delete"),
};

export const handler: ToolCallback<typeof schema> = async ({ id }) => {
  try {
    // Check if memory exists first
    const existing = getMemory(id);
    if (!existing) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Memory not found: ${id}`,
          },
        ],
        isError: true,
      };
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
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
