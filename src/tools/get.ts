/**
 * memory_get tool - Retrieve a memory by ID
 */

import { z } from "zod";
import { getMemory } from "../database.js";
import type { ToolCallback } from "./index.js";
import { handleToolError, makeErrorResponse } from "./utils.js";

export const schema = {
  id: z.string().describe("The memory ID to retrieve"),
};

export const handler: ToolCallback<typeof schema> = async ({ id }) => {
  try {
    const memory = getMemory(id);

    if (!memory) {
      return makeErrorResponse(`Memory not found: ${id}`);
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
    return handleToolError("Failed to get memory", error);
  }
};
