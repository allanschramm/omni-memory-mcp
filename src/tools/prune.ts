/**
 * memory_prune tool - Cleanup decayed memories
 */

import { z } from "zod";
import { pruneMemories } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {
    threshold_score: z.number().optional().describe("Score threshold below which memories are pruned (default 0)"),
    dry_run: z.boolean().optional().describe("If true, calculates which memories would be pruned without deleting them"),
};

export const handler: ToolCallback<typeof schema> = async ({ threshold_score, dry_run }) => {
    try {
        const result = pruneMemories({ threshold_score, dry_run });

        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text" as const,
                    text: `Failed to prune memories: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
};
