/**
 * memory_search tool - Full-text search across memories
 */

import { z } from "zod";
import { searchMemories } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  query: z.string().describe("Search query"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Filter by area"),
  project: z.string().optional().describe("Filter by project"),
  limit: z.number().min(1).max(50).optional().describe("Max results (default: 10, max: 50)"),
};

export const handler: ToolCallback<typeof schema> = async ({ query, area, project, limit }) => {
  try {
    const results = searchMemories({ query, area, project, limit });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No memories found matching: "${query}"`,
          },
        ],
      };
    }

    const resultsText = results
      .map((m, i) => {
        const score = `(${(m.score * 100).toFixed(0)}%)`;
        const projectTag = m.project ? ` [${m.project}]` : "";
        const preview = m.content.length > 200 ? m.content.substring(0, 200) + "..." : m.content;
        return `${i + 1}. ${score} [${m.area}]${projectTag}\n   ID: ${m.id}\n   ${preview}`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${results.length} memories for "${query}":\n\n${resultsText}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
