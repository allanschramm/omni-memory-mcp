/**
 * memory_upsert tool - Create or update a canonical memory
 */

import { z } from "zod";
import { upsertMemory } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
  content: z.string().describe("The content to store in the canonical memory"),
  name: z.string().optional().describe("Canonical memory name"),
  match_name: z.string().optional().describe("Stable key used to match an existing canonical memory"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Memory area (default: general)"),
  project: z.string().optional().describe("Project identifier for organization"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
  allow_create: z.boolean().optional().describe("Whether to create a new canonical memory when no match is found (default: true)"),
};

export const handler: ToolCallback<typeof schema> = async ({
  content,
  name,
  match_name,
  area,
  project,
  tags,
  allow_create,
}) => {
  try {
    const result = upsertMemory({
      content,
      name,
      match_name,
      area,
      project,
      tags,
      allow_create,
    });

    if (result.action === "not_found") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Canonical memory not found\nMatch: ${result.matched_name ?? "(none)"}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Canonical memory ${result.action}\nID: ${result.id}\nMatch: ${result.matched_name ?? "(none)"}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to upsert memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};
