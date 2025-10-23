import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ProcessOptimizer } from "@/server/services/ProcessOptimizer";

export const processOptimizerRouter = createTRPCRouter({
  extractText: publicProcedure
    .input(
      z.object({
        fileContent: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();

      try {
        const text = await optimizer.extractTextFromBase64(
          input.fileContent,
          input.fileName,
          input.fileType,
        );
        return { success: true, text };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  analyzeProcess: publicProcedure
    .input(
      z.object({
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();

      try {
        const analysis = await optimizer.analyzeProcess(input.content);
        return { success: true, analysis };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  optimizeProcess: publicProcedure
    .input(
      z.object({
        content: z.string(),
        optimizationCriteria: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();

      try {
        const results = await optimizer.generateOptimizationResults(
          input.content,
          input.optimizationCriteria,
        );
        return { success: true, results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  testConnection: publicProcedure.query(async () => {
    try {
      const optimizer = new ProcessOptimizer();
      // Simple test to verify API connection
      await optimizer.analyzeProcess("Test content for API connection");
      return { success: true, message: "API connection successful" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});
