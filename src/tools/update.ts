/**
 * memory_update tool - Update an existing memory
 */

import { z } from "zod";
import { updateMemory, getMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  id: z.string().describe("The memory ID to update"),
  content: z.string().optional().describe("New content (optional)"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("New area (optional)"),
  project: z.string().nullable().optional().describe("New project (optional, null to clear)"),
  tags: z.array(z.string()).optional().describe("New tags (optional)"),
};

export const handler: ToolCallback<typeof schema> = async ({ id, content, area, project, tags }) => {
  try {
    // Check if memory exists
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

    const result = updateMemory({ id, content, area, project: project ?? undefined, tags });

    if (result.changes === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No changes made to memory: ${id}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Memory updated successfully\nID: ${id}\nChanges: ${result.changes}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to update memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
