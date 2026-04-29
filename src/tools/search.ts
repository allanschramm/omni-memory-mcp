/**
 * memory_search tool - Full-text search across memories
 */

import { z } from "zod";
import { searchMemories } from "../database.js";
import type { ToolCallback } from "./index.js";
import { handleToolError } from "./utils.js";

export const schema = {
  query: z.string().describe("Search query"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Filter by area"),
  project: z.string().optional().describe("Filter by project"),
  limit: z.number().min(1).max(50).optional().describe("Max results (default: 10, max: 50)"),
  enableAdvancedSyntax: z.boolean().optional().describe("Enable FTS5 boolean and wildcard advanced syntax"),
  search_mode: z.enum(["balanced", "exact", "broad"]).optional().describe("Ranking mode (default: balanced)"),
};

export const handler: ToolCallback<typeof schema> = async ({ query, area, project, limit, enableAdvancedSyntax, search_mode }) => {
  try {
    const results = searchMemories({ query, area, project, limit, enableAdvancedSyntax, search_mode });

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
        const title = m.name ? m.name : "Unnamed Memory";
        const tags = m.tags && m.tags.length ? ` {Tags: ${m.tags.join(",")}}` : "";
        return `${i + 1}. ${score} [${m.area}]${projectTag}\n   ID: ${m.id}\n   Name: ${title}${tags}\n   Match: ${m.explanation}\n   Accessed: ${m.accessed_at || "Never"} (${m.access_count} times)`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${results.length} memories for "${query}".\nNote: To read the full content of a memory, use 'memory_get' with the ID.\n\n${resultsText}`,
        },
      ],
    };
  } catch (error) {
    return handleToolError("Search failed", error);
  }
};
