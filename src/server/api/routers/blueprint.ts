import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { BlueprintAnalyzer } from "@/server/services/BlueprintAnalyzer";

export const blueprintRouter = createTRPCRouter({
  extractText: publicProcedure
    .input(
      z.object({
        fileContent: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const analyzer = new BlueprintAnalyzer();

      // Create a File-like object from the input
      const file = new File([input.fileContent], input.fileName, {
        type: input.fileType,
      });

      try {
        const text = await analyzer.extractText(file);
        return { success: true, text };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  analyzeBlueprint: publicProcedure
    .input(
      z.object({
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const analyzer = new BlueprintAnalyzer();

      try {
        const results = await analyzer.generateAllOptions(
          await analyzer.analyzeCurrentState(input.content),
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
      const analyzer = new BlueprintAnalyzer();
      // Simple test to verify API connection
      await analyzer.analyzeCurrentState("Test content for API connection");
      return { success: true, message: "API connection successful" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});
