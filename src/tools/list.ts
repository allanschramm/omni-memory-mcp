/**
 * memory_list tool - List memories with filters
 */

import { z } from "zod";
import { listMemories } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Filter by area"),
  project: z.string().optional().describe("Filter by project"),
  tag: z.string().optional().describe("Filter by tag"),
  limit: z.number().min(1).max(100).optional().describe("Max results (default: 50, max: 100)"),
};

export const handler: ToolCallback<typeof schema> = async ({ area, project, tag, limit }) => {
  try {
    const memories = listMemories({ area, project, tag, limit });

    if (memories.length === 0) {
      const filters = [];
      if (area) filters.push(`area=${area}`);
      if (project) filters.push(`project=${project}`);
      if (tag) filters.push(`tag=${tag}`);
      
      const filterText = filters.length > 0 ? ` with filters: ${filters.join(", ")}` : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `No memories found${filterText}`,
          },
        ],
      };
    }

    const memoriesText = memories
      .map((m, i) => {
        const projectTag = m.project ? ` [${m.project}]` : "";
        const tags = m.tags.length > 0 ? ` #${m.tags.join(" #")}` : "";
        const preview = m.content.length > 150 ? m.content.substring(0, 150) + "..." : m.content;
        return `${i + 1}. [${m.area}]${projectTag}${tags}\n   ID: ${m.id}\n   ${preview}`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${memories.length} memories:\n\n${memoriesText}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to list memories: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
