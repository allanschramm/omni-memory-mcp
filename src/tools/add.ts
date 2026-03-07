/**
 * memory_add tool - Add a memory to the store
 */

import { z } from "zod";
import { addMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  name: z.string().optional().describe("Summary or title of the memory"),
  content: z.string().describe("The content to store in memory"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Memory area (default: general)"),
  project: z.string().optional().describe("Project identifier for organization"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
  metadata: z.record(z.unknown()).optional().describe("Graph relationships or extra properties"),
};

export const handler: ToolCallback<typeof schema> = async ({ name, content, area, project, tags, metadata }) => {
  try {
    const result = addMemory({ name, content, area, project, tags, metadata });

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
