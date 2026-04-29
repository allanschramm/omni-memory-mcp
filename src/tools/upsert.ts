/**
 * memory_upsert tool - Add or update a memory conservatively
 */

import { z } from "zod";
import { upsertMemory } from "../database.js";
import type { ToolCallback } from "./index.js";
import { handleToolError } from "./utils.js";

export const schema = {
  name: z.string().optional().describe("Summary or title of the memory"),
  match_name: z.string().optional().describe("Optional stable name to use for matching instead of name"),
  content: z.string().describe("The content to store in memory"),
  area: z.enum(["general", "snippets", "solutions", "preferences"]).optional().describe("Memory area (default: general)"),
  project: z.string().nullable().optional().describe("Project identifier for organization"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
  metadata: z.record(z.unknown()).nullable().optional().describe("Graph relationships or extra properties"),
  allow_create: z.boolean().optional().describe("If false, do not create a new memory when no match is found"),
};

export const handler: ToolCallback<typeof schema> = async ({
  name,
  match_name,
  content,
  area,
  project,
  tags,
  metadata,
  allow_create,
}) => {
  try {
    const result = upsertMemory({
      name,
      match_name,
      content,
      area,
      project,
      tags,
      metadata,
      allow_create,
    });

    if (result.action === "ambiguous") {
      const candidates = (result.candidates ?? [])
        .map((candidate, index) => `${index + 1}. ID: ${candidate.id}\n   Name: ${candidate.name ?? "Unnamed Memory"}\n   Project: ${candidate.project ?? "None"}`)
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Upsert skipped because the match is ambiguous.\nRefine the name or update a specific memory manually.\n\n${candidates}`,
          },
        ],
      };
    }

    if (result.action === "updated") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Memory updated via upsert\nID: ${result.id}\nChanges: ${result.changes ?? 0}`,
          },
        ],
      };
    }

    if (result.action === "created") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Memory created via upsert\nID: ${result.id}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: "Upsert skipped because no matching memory was found and creation is disabled.",
        },
      ],
    };
  } catch (error) {
    return handleToolError("Failed to upsert memory", error);
  }
};
