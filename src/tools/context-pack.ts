/**
 * memory_context_pack tool - Compact context assembly for agent prompts
 */

import { z } from "zod";
import { createMemoryContextPack } from "../database.js";
import type { ToolCallback } from "./index.js";
import { handleToolError } from "./utils.js";

export const schema = {
  query: z.string().describe("Search query used to assemble the context pack"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Filter by area"),
  project: z.string().optional().describe("Filter by project"),
  tag: z.string().optional().describe("Filter by tag"),
  max_tokens: z.number().min(200).max(8000).optional().describe("Maximum estimated token budget (default: 1200)"),
  max_memories: z.number().min(1).max(20).optional().describe("Maximum memories to include (default: 5)"),
  search_mode: z.enum(["balanced", "exact", "broad"]).optional().describe("Ranking mode (default: balanced)"),
};

export const handler: ToolCallback<typeof schema> = async ({ query, area, project, tag, max_tokens, max_memories, search_mode }) => {
  try {
    const result = createMemoryContextPack({
      query,
      area,
      project,
      tag,
      max_tokens,
      max_memories,
      search_mode,
    });

    const text = result.count === 0
      ? `Context pack for "${query}"\n\nNo matching memories found.`
      : [
          `Built context pack for "${query}".`,
          `Included ${result.count} memories using ~${result.estimated_tokens}/${result.max_tokens} estimated tokens.`,
          result.truncated
            ? "Some results were shortened or omitted to stay within budget."
            : "No truncation was required.",
          "",
          result.memories.map((memory, index) => {
            const title = memory.name || "Unnamed Memory";
            const projectLabel = memory.project ? ` [${memory.project}]` : "";
            const tags = memory.tags.length > 0 ? ` #${memory.tags.join(" #")}` : "";

            return [
              `${index + 1}. ${title}${projectLabel}`,
              `   ID: ${memory.id}`,
              `   Area: ${memory.area}${tags}`,
              `   Match: ${memory.explanation} (${(memory.score * 100).toFixed(0)}%)`,
              `   Excerpt: ${memory.excerpt || "(empty memory)"}`,
            ].join("\n");
          }).join("\n\n"),
        ].join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
      structuredContent: result as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return handleToolError("Failed to build context pack", error);
  }
};
