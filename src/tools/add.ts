/**
 * memory_add tool - Add a memory to the store
 */

import { z } from "zod";
import { addMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  content: z.string().describe("The content to store in memory"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Memory area (default: general)"),
  project: z.string().optional().describe("Project identifier for organization"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
};

export const handler: ToolCallback<typeof schema> = async ({ content, area, project, tags }) => {
  try {
    const result = addMemory({ content, area, project, tags });

    return {
      content: [
        {
          type: "text" as const,
          text: `Memory added successfully\nID: ${result.id}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to add memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
