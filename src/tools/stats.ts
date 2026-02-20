/**
 * memory_stats tool - Get statistics about the Omni Memory database
 */

import { z } from "zod";
import { getStats } from "../database.js";
import type { ToolCallback } from "./index.js";

export const schema = {};

export const handler: ToolCallback<typeof schema> = async () => {
    try {
        const stats = getStats();

        const formatBytes = (bytes: number) => {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const areasList = Object.entries(stats.by_area)
            .map(([area, count]) => `  - ${area}: ${count}`)
            .join("\n");

        const projectsList = Object.entries(stats.by_project)
            .map(([project, count]) => `  - ${project}: ${count}`)
            .join("\n");

        const text = `Omni Memory Database Statistics:
Total Memories: ${stats.total_memories}
Total Size on Disk: ${stats.total_size_bytes > 0 ? formatBytes(stats.total_size_bytes) : "Unknown (Memory DB)"}

By Area:
${areasList || "  (None)"}

By Project:
${projectsList || "  (None)"}`;

        return {
            content: [
                {
                    type: "text" as const,
                    text,
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text" as const,
                    text: `Failed to retrieve stats: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
};
