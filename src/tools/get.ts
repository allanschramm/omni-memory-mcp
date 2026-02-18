/**
 * memory_get tool - Retrieve a memory by ID
 */

import { z } from "zod";
import { getMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  id: z.string().describe("The memory ID to retrieve"),
};

export const handler: ToolCallback<typeof schema> = async ({ id }) => {
  try {
    const memory = getMemory(id);

    if (!memory) {
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

    const tags = memory.tags.length > 0 ? `\nTags: ${memory.tags.join(", ")}` : "";
    const project = memory.project ? `\nProject: ${memory.project}` : "";

    return {
      content: [
        {
          type: "text" as const,
          text: `ID: ${memory.id}\nArea: ${memory.area}${project}${tags}\nCreated: ${memory.created_at}\nUpdated: ${memory.updated_at}\n\n${memory.content}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to get memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
