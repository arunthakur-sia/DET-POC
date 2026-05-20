import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { ProcessOptimizer } from "@/server/services/ProcessOptimizer";
import type {
  ProcessDocumentMetadata,
  ProcessDiagnosis,
  ProcessAnalysis,
} from "@/server/services/ProcessOptimizer";

export const processOptimizerRouter = createTRPCRouter({
  // Combined endpoint: PDF → Extract + Analyze + Diagnose in ONE Claude API call
  // This is 3-4x faster than separate calls
  extractAndDiagnose: publicProcedure
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
        const result = await optimizer.extractAndDiagnosePDF(
          input.fileContent,
          input.fileName,
          input.fileType,
        );
        return {
          success: true,
          extractedText: result.extractedText,
          analysis: result.analysis,
          diagnosis: result.diagnosis,
          currentMermaid: result.currentMermaid,
        };
      } catch (error) {
        console.error("[extractAndDiagnose] Error:", error);
        if (error instanceof Error) {
          console.error("[extractAndDiagnose] Stack:", error.stack);
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  diagnose: publicProcedure
    .input(
      z.object({
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();
      try {
        const analysis = await optimizer.analyzeProcess(input.content);
        const diagnosis = await optimizer.diagnoseProcess(analysis);
        const currentMermaid =
          await optimizer.createCurrentProcessDiagram(analysis);
        return { success: true, analysis, diagnosis, currentMermaid };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
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
  generateSOP: publicProcedure
    .input(
      z.object({
        originalContent: z.string(),
        processName: z.string(),
        optimizedMermaid: z.string(),
        appliedChanges: z
          .array(
            z.object({
              changeDescription: z.string(),
              impact: z.string().optional(),
              affectedDepartment: z.string().optional(),
              performedBy: z.string().optional(),
            }),
          )
          .default([]),
        impactAnalysis: z.unknown().optional(),
        processId: z.string().optional(),
        processOwner: z.string().optional(),
        department: z.string().optional(),
        section: z.string().optional(),
        documentMetadata: z.unknown().optional(),
        diagnosis: z.unknown().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();
      try {
        const markdown = await optimizer.generateSOPDocument({
          processName: input.processName,
          originalContent: input.originalContent,
          optimizedMermaid: input.optimizedMermaid,
          appliedChanges: input.appliedChanges,
          impactAnalysis: input.impactAnalysis,
          processId: input.processId,
          processOwner: input.processOwner,
          department: input.department,
          section: input.section,
          documentMetadata: input.documentMetadata as
            | ProcessDocumentMetadata
            | undefined,
          diagnosis: input.diagnosis as ProcessDiagnosis | undefined,
        });
        return { success: true, markdown };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // ─── Multi-process: extract all processes + parallel diagnosis ────────────
  extractAndDiagnoseAll: publicProcedure
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
        const result = await optimizer.extractAndDiagnoseAllProcesses(
          input.fileContent,
          input.fileName,
          input.fileType,
        );
        return { success: true as const, processes: result.processes };
      } catch (error) {
        console.error("[extractAndDiagnoseAll] Error:", error);
        return {
          success: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // ─── Optimize a specific process by its serialized analysis ──────────────
  optimizeForProcess: publicProcedure
    .input(
      z.object({
        analysisJson: z.string(),
        optimizationCriteria: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const optimizer = new ProcessOptimizer();
      try {
        const analysis = JSON.parse(input.analysisJson) as ProcessAnalysis;
        const optimization = await optimizer.optimizeProcess(
          analysis,
          input.optimizationCriteria,
        );
        const [currentMermaid, optimizedMermaid] = await Promise.all([
          optimizer.createCurrentProcessDiagram(analysis),
          optimizer.createOptimizedProcessDiagram(optimization),
        ]);
        const results = {
          currentAnalysis: analysis,
          currentMermaid,
          optimization,
          optimizedMermaid,
        };
        return { success: true as const, results };
      } catch (error) {
        console.error("[optimizeForProcess] Error:", error);
        return {
          success: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

});
