import Head from "next/head";
import Image from "next/image";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/utils/api";
import MermaidDiagram from "@/components/MermaidDiagram";
import type { OptimizationResults } from "@/server/services/ProcessOptimizer";
import type {
  ProcessDiagnosis,
  DiagnosisQuickWin,
  ProcessAnalysis,
} from "@/server/services/ProcessOptimizer";
import { CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ProcessOptimizer() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [optimizationCriteria, setOptimizationCriteria] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<OptimizationResults | null>(null);
  const [error, setError] = useState<string>("");
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3>(1);
  const [diagnosis, setDiagnosis] = useState<{
    analysis: ProcessAnalysis | null;
    currentMermaid: string;
    report: ProcessDiagnosis | null;
    timestamp?: string;
  }>({ analysis: null, currentMermaid: "", report: null });
  const [selectedQuickWinIds, setSelectedQuickWinIds] = useState<
    Record<number, boolean>
  >({});
  const [guidedMode, setGuidedMode] = useState<boolean>(true);
  const [sopMarkdown, setSopMarkdown] = useState<string>("");
  const [isGeneratingSop, setIsGeneratingSop] = useState<boolean>(false);
  const [impactAnalysis, setImpactAnalysis] = useState<{
    comparison: {
      current: {
        totalSteps: number;
        totalDuration: number;
        departmentHandoffs: number;
        approvalLayers: number;
      };
      optimized: {
        totalSteps: number;
        totalDuration: number;
        departmentHandoffs: number;
        approvalLayers: number;
      };
      improvements: {
        stepReduction: number;
        timeReduction: number;
        timeReductionPercent: number;
      };
    };
    appliedChanges: Array<{
      changeDescription: string;
      impact: string;
      affectedDepartment?: string;
    }>;
  } | null>(null);
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };

  // removed unused helper

  // Use combined endpoint for faster processing (single API call instead of 2-3)
  const extractAndDiagnoseMutation =
    api.processOptimizer.extractAndDiagnose.useMutation();
  const optimizeProcessMutation =
    api.processOptimizer.optimizeProcess.useMutation();
  const generateSopMutation = api.processOptimizer.generateSOP.useMutation();
  const isProcessing = extractAndDiagnoseMutation.isPending;
  const isBusy = isProcessing || isGenerating;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError(
          `File size too large. Please upload a file smaller than 10MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        );
        return;
      }

      setUploadedFile(file);
      setError("");

      const processFile = async () => {
        try {
          let fileContent: string;
          if (file.type === "application/pdf") {
            // For PDF files, convert to base64 to preserve binary data
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // Use chunked approach to avoid "Maximum call stack size exceeded" error
            const chunkSize = 8192;
            let binaryString = "";
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, i + chunkSize);
              binaryString += String.fromCharCode.apply(
                null,
                Array.from(chunk),
              );
            }
            fileContent = btoa(binaryString);
          } else {
            // For text files, use text content
            fileContent = await file.text();
          }

          // Use combined endpoint - single API call for extraction + analysis + diagnosis
          const result = await extractAndDiagnoseMutation.mutateAsync({
            fileContent,
            fileName: file.name,
            fileType: file.type,
          });

          if (
            result.success &&
            "extractedText" in result &&
            result.analysis &&
            result.diagnosis
          ) {
            setExtractedText(String(result.extractedText ?? ""));
            setDiagnosis({
              analysis: result.analysis,
              currentMermaid: String(result.currentMermaid ?? ""),
              report: result.diagnosis,
              timestamp: new Date().toISOString(),
            });
            setCurrentPhase(1);
          } else {
            setError(result.error ?? "Failed to process document");
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      };

      void processFile();
    },
    [extractAndDiagnoseMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    multiple: false,
  });

  const renderPhaseNav = () => (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
      <div className="flex items-center gap-6 text-sm">
        <div
          className={`flex items-center gap-2 ${currentPhase >= 1 ? "text-cyan-700" : "text-gray-400"}`}
        >
          <span>1. Diagnose</span>
          {diagnosis.report ? (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          ) : null}
        </div>
        <div className="text-gray-300">──►</div>
        <div
          className={`flex items-center gap-2 ${currentPhase >= 2 ? "text-cyan-700" : "text-gray-400"}`}
        >
          <span>2. Optimize</span>
          {results ? (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          ) : null}
        </div>
        <div className="text-gray-300">──►</div>
        <div
          className={`flex items-center gap-2 ${currentPhase >= 3 ? "text-cyan-700" : "text-gray-400"}`}
        >
          <span>3. Generate SOP</span>
          {sopMarkdown ? (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          ) : (
            <LockClosedIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {diagnosis.timestamp
          ? `Last diagnosis: ${new Date(diagnosis.timestamp).toLocaleString()}`
          : ""}
      </div>
    </div>
  );

  const toggleQuickWin = (idx: number) => {
    setSelectedQuickWinIds((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const buildInstructionsFromQuickWins = (
    quickWins: DiagnosisQuickWin[],
  ): {
    instructions: string[];
    appliedChanges: Array<{
      changeDescription: string;
      impact: string;
      affectedDepartment?: string;
    }>;
  } => {
    const selected = quickWins.filter((_, i) => selectedQuickWinIds[i]);
    const instructions: string[] = [];
    const appliedChanges: Array<{
      changeDescription: string;
      impact: string;
      affectedDepartment?: string;
    }> = [];
    selected.forEach((q) => {
      if (q.category === "Removal") {
        instructions.push(`Remove "${q.stepName}"`);
      } else if (
        q.category === "Consolidation" &&
        q.steps &&
        q.steps.length > 1 &&
        q.consolidationSuggestion
      ) {
        instructions.push(
          `Merge steps "${q.steps.join('" and "')}" into a single step: "${q.consolidationSuggestion}". Keep the earliest step's position in the flow.`,
        );
      } else {
        instructions.push(q.suggestion);
      }
      appliedChanges.push({
        changeDescription: q.suggestion,
        impact: q.estimatedTimeSaving
          ? `Saved ${q.estimatedTimeSaving}`
          : "N/A",
      });
    });
    return { instructions, appliedChanges };
  };

  const parseTimeSaving = (text: string | undefined): number => {
    if (!text) return 0;
    const match = /(\d+(\.\d+)?)\s*(day|days|working day|working days)/i.exec(
      text,
    );
    if (match?.[1]) return parseFloat(match[1]);
    return 0;
  };

  const simulateImpact = (
    selected: DiagnosisQuickWin[],
    proc: ProcessAnalysis,
  ) => {
    const currentTotalSteps = proc.processSteps.length;
    const currentDuration =
      Object.values(proc.leadTimes ?? {}).reduce((a, b) => a + (b ?? 0), 0) ||
      0;
    const currentHandoffs = (() => {
      const nodes = proc.nodes ?? [];
      const edges = proc.edges ?? [];
      if (!nodes.length || !edges.length) return 0;
      const idToDept = new Map(nodes.map((n) => [n.id, n.department]));
      return edges.reduce((count, e) => {
        const from = idToDept.get(e.from);
        const to = idToDept.get(e.to);
        return count + (from && to && from !== to ? 1 : 0);
      }, 0);
    })();
    const approvalLayers = (() => {
      const nodes = proc.nodes ?? [];
      if (!nodes.length) {
        return proc.processSteps.filter((s) =>
          s.name.toLowerCase().includes("approve"),
        ).length;
      }
      return nodes.filter(
        (n) => n.type === "gateway" || n.name.toLowerCase().includes("approve"),
      ).length;
    })();

    let timeSaved = 0;
    let stepsRemoved = 0;
    selected.forEach((q) => {
      if (q.category === "Removal") {
        const step = proc.processSteps.find((s) => s.id === q.stepId);
        if (step) {
          stepsRemoved += 1;
          timeSaved += proc.leadTimes?.[step.id] ?? 0;
        }
      } else if (q.category === "Consolidation") {
        stepsRemoved += 1;
        timeSaved += parseTimeSaving(q.estimatedTimeSaving);
      } else if (q.category === "Parallelization") {
        const step = proc.processSteps.find((s) => s.id === q.stepId);
        const base = step ? (proc.leadTimes?.[step.id] ?? 0) : 0;
        timeSaved += base * 0.5;
      } else {
        timeSaved += parseTimeSaving(q.estimatedTimeSaving);
      }
    });

    const optimizedDuration = Math.max(0, currentDuration - timeSaved);
    const timeReduction = Math.max(0, timeSaved);
    const timeReductionPercent =
      currentDuration > 0
        ? Math.round((timeReduction / currentDuration) * 100)
        : timeReduction > 0
          ? 100 // If we save time but baseline was 0, technically it's 100% improvement relative to the known blockage
          : 0;

    return {
      comparison: {
        current: {
          totalSteps: currentTotalSteps,
          totalDuration: currentDuration,
          departmentHandoffs: currentHandoffs,
          approvalLayers: approvalLayers,
        },
        optimized: {
          totalSteps: Math.max(0, currentTotalSteps - stepsRemoved),
          totalDuration: optimizedDuration,
          departmentHandoffs: currentHandoffs,
          approvalLayers: approvalLayers,
        },
        improvements: {
          stepReduction: stepsRemoved,
          timeReduction,
          timeReductionPercent,
        },
      },
    };
  };

  const handleOptimizeProcess = async () => {
    if (!extractedText) return;

    setIsGenerating(true);
    setError("");

    try {
      // Build criteria from guided selections if applicable
      let criteria = optimizationCriteria.trim();
      let appliedChangesLocal:
        | Array<{
            changeDescription: string;
            impact: string;
            affectedDepartment?: string;
          }>
        | undefined;
      if (guidedMode && diagnosis.report) {
        const { instructions, appliedChanges } = buildInstructionsFromQuickWins(
          diagnosis.report.quickWins ?? [],
        );
        if (instructions.length > 0) {
          criteria =
            instructions.map((ins) => `- ${ins}`).join("\n") +
            (criteria ? `\n${criteria}` : "");
        }
        appliedChangesLocal = appliedChanges;
      }

      const result = await optimizeProcessMutation.mutateAsync({
        content: extractedText,
        optimizationCriteria: criteria,
      });

      if (result.success) {
        setResults(result.results ?? null);
        // Compute impact analysis if we have diagnosis + selections
        if (diagnosis.analysis && diagnosis.report) {
          const selected = (diagnosis.report.quickWins ?? []).filter(
            (_q, i) => selectedQuickWinIds[i],
          );
          const impact = simulateImpact(selected, diagnosis.analysis);
          setImpactAnalysis({
            ...impact,
            appliedChanges:
              appliedChangesLocal ??
              selected.map((q) => ({
                changeDescription: q.suggestion,
                impact: q.estimatedTimeSaving
                  ? `Saved ${q.estimatedTimeSaving}`
                  : "N/A",
              })),
          });
        }
        setCurrentPhase(2);
      } else {
        setError(result.error ?? "Failed to optimize process");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to optimize process",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSOP = async () => {
    if (!diagnosis.analysis || !results) return;
    try {
      setIsGeneratingSop(true);

      // Get quick wins with best practice references
      const selectedQuickWins = (diagnosis.report?.quickWins ?? []).filter(
        (_, i) => selectedQuickWinIds[i],
      );

      const sop = await generateSopMutation.mutateAsync({
        originalContent: extractedText,
        processName: diagnosis.analysis.processName,
        optimizedMermaid: results.optimizedMermaid,
        appliedChanges: selectedQuickWins.map((qw) => ({
          changeDescription: qw.suggestion,
          impact: qw.estimatedTimeSaving
            ? `Saved ${qw.estimatedTimeSaving}`
            : undefined,
          affectedDepartment: undefined,
          performedBy: qw.performedBy,
        })),
        impactAnalysis: impactAnalysis ?? undefined,
        processId: diagnosis.analysis.documentMetadata?.processId,
        processOwner: diagnosis.analysis.documentMetadata?.processOwner,
        department: diagnosis.analysis.documentMetadata?.department,
        section: diagnosis.analysis.documentMetadata?.section,
        documentMetadata: diagnosis.analysis.documentMetadata,
        diagnosis: diagnosis.report,
      });
      if (sop.success) {
        setSopMarkdown(sop.markdown ?? "");
        setCurrentPhase(3); // Navigate to Phase 3
      } else {
        setError(sop.error ?? "Failed to generate SOP");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate SOP document",
      );
    } finally {
      setIsGeneratingSop(false);
    }
  };

  const renderSidebar = () => (
    <div className="w-56 bg-gray-100 p-5">
      {/* Logo */}
      <div className="mb-8">
        <Image src="/assets/sia.png" alt="SIA Logo" width={120} height={32} />
      </div>

      {/* Navigation */}
      <div className="mb-2 flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-200">
        <div className="flex items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="mr-2"
          >
            <path
              d="M7.68335 1.53C7.71257 1.47097 7.7577 1.42129 7.81365 1.38655C7.86961 1.35181 7.93416 1.3334 8.00002 1.3334C8.06588 1.3334 8.13043 1.35181 8.18639 1.38655C8.24234 1.42129 8.28747 1.47097 8.31669 1.53L9.85669 4.64933C9.95814 4.85465 10.1079 5.03223 10.2931 5.16697C10.4783 5.30167 10.6934 5.38941 10.92 5.42267L14.364 5.92667C14.4293 5.93612 14.4906 5.96365 14.541 6.00613C14.5914 6.04862 14.629 6.10437 14.6494 6.16707C14.6698 6.22978 14.6722 6.29694 14.6564 6.36096C14.6406 6.42498 14.6072 6.48333 14.56 6.52933L12.0694 8.95467C11.9051 9.11473 11.7822 9.31232 11.7112 9.53042C11.6403 9.74852 11.6234 9.98059 11.662 10.2067L12.25 13.6333C12.2615 13.6986 12.2545 13.7657 12.2297 13.8271C12.2049 13.8885 12.1633 13.9417 12.1097 13.9807C12.0561 14.0196 11.9927 14.0427 11.9266 14.0473C11.8605 14.0519 11.7945 14.0378 11.736 14.0067L8.65735 12.388C8.4545 12.2815 8.22881 12.2258 7.99997 12.2258C7.77113 12.2258 7.54544 12.2815 7.34259 12.388L4.26402 14.0067C4.20557 14.0376 4.13962 14.0515 4.07365 14.0468C4.00769 14.0421 3.94437 14.019 3.89088 13.9801C3.8374 13.9413 3.79591 13.8881 3.77112 13.8268C3.74634 13.7655 3.73926 13.6985 3.75069 13.6333L4.33802 10.2073C4.37682 9.98116 4.36001 9.74893 4.28905 9.5307C4.21808 9.31246 4.09509 9.11477 3.93069 8.95467L1.44002 6.53C1.39242 6.48402 1.35868 6.4256 1.34266 6.36138C1.32664 6.29717 1.32898 6.22975 1.34941 6.16679C1.36983 6.10384 1.40753 6.04789 1.4582 6.00532C1.50888 5.96275 1.57049 5.93527 1.63602 5.926L5.07935 5.42267C5.30619 5.38967 5.52161 5.30204 5.70708 5.16733C5.89254 5.03261 6.04249 4.85485 6.14402 4.64933L7.68335 1.53Z"
              stroke="#020817"
              strokeWidth="1.33333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-gray-700">SmartFlow</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12L10 8L6 4"
            stroke="#020817"
            strokeWidth="1.33333"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );

  const renderUploadSection = () => (
    <div className="border-r border-gray-200 p-5">
      <h2 className="mb-4 text-lg font-bold text-gray-800">SmartFlow</h2>

      <div className="mb-6">
        <h3 className="text-md mb-3 font-semibold text-gray-800">
          Upload Process Document
        </h3>

        <div
          {...getRootProps()}
          className={`file-upload-area cursor-pointer rounded-lg border-2 border-dashed border-cyan-500 p-8 text-center ${
            isDragActive ? "bg-cyan-50" : "bg-cyan-25"
          } ${isBusy ? "pointer-events-none opacity-70" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="text-gray-600">
            {isDragActive ? (
              <p>Drop the file here...</p>
            ) : (
              <div>
                <p className="mb-2">Add collections or drag and drop files</p>
                <p className="text-sm text-gray-500">
                  PDF or TXT files only (max 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {isProcessing && (
          <div className="mt-3 rounded border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
            <div className="flex items-center">
              <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-cyan-500"></div>
              <span>Analyzing document (extraction + diagnosis)...</span>
            </div>
          </div>
        )}

        {uploadedFile && (
          <div className="mt-4 rounded border bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              <strong>File:</strong> {uploadedFile.name}
            </p>
            <p className="text-sm text-gray-500">
              <strong>Size:</strong> {(uploadedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}

        {extractedText && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              Extracted Content Preview
            </h4>
            <div className="content-preview max-h-40 overflow-y-auto rounded border bg-gray-50 p-3">
              <pre className="text-xs whitespace-pre-wrap text-gray-700">
                {extractedText.slice(0, 1000)}
                {extractedText.length > 1000 && "..."}
              </pre>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-cyan-600 hover:text-cyan-800">
                View full extracted content
              </summary>
              <div className="mt-2 rounded border bg-white p-2">
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={() => void copyToClipboard(extractedText)}
                    className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
                <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre-wrap text-gray-700">
                  {extractedText}
                </pre>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Optimization criteria moved to Phase 2 (Custom mode) to avoid duplication */}
    </div>
  );

  const renderPhase1 = () => {
    if (!diagnosis.analysis || !diagnosis.report) return null;
    const report = diagnosis.report;
    const analysis = diagnosis.analysis;
    const quickWins = report.quickWins ?? [];
    const totalSteps = analysis.processSteps.length;
    const totalDuration =
      Object.values(analysis.leadTimes ?? {}).reduce(
        (a, b) => a + (b ?? 0),
        0,
      ) || 0;
    const metadata = analysis.documentMetadata;
    const hasStepCountDiscrepancy = metadata?.stepCountDiscrepancy ?? false;
    const flowchartBoxCount = metadata?.flowchartBoxCount;
    const activitiesTableCount = metadata?.activitiesTableCount ?? totalSteps;

    return (
      <div className="p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          Process Diagnosis Report
        </h3>
        {/* Summary Card */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">Process</div>
            <div className="text-base font-semibold text-gray-800">
              {analysis.processName}
            </div>
            {metadata?.processId && (
              <div className="text-xs text-gray-400">{metadata.processId}</div>
            )}
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">Total Steps</div>
            <div className="text-base font-semibold text-gray-800">
              {activitiesTableCount}
              {flowchartBoxCount !== undefined &&
                flowchartBoxCount !== activitiesTableCount && (
                  <span
                    className={`ml-2 text-xs ${hasStepCountDiscrepancy ? "text-amber-600" : "text-gray-400"}`}
                  >
                    (Flowchart: {flowchartBoxCount})
                  </span>
                )}
            </div>
            {hasStepCountDiscrepancy && (
              <div className="mt-1 text-xs text-amber-600">
                ⚠️ Flowchart/table mismatch
              </div>
            )}
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">
              Estimated Duration (days)
            </div>
            <div className="text-base font-semibold text-gray-800">
              {totalDuration}
            </div>
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">Process Owner</div>
            <div className="text-base font-semibold text-gray-800">
              {metadata?.processOwner ?? "N/A"}
            </div>
            {metadata?.department && (
              <div className="text-xs text-gray-400">{metadata.department}</div>
            )}
          </div>
        </div>

        {/* KPI and SIPOC Summary */}
        {(metadata?.kpis?.length ?? 0) > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Process KPIs
            </h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {metadata?.kpis?.map((kpi, idx) => (
                <div key={idx} className="rounded border bg-white p-3">
                  <div className="text-sm font-medium text-gray-700">
                    {kpi.name}
                  </div>
                  <div className="text-lg font-semibold text-cyan-700">
                    {kpi.target}
                  </div>
                  {kpi.formula && (
                    <div className="text-xs text-gray-400">
                      Formula: {kpi.formula}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Diagram */}
        <div className="mb-6">
          <h4 className="text-md mb-3 font-semibold text-gray-800">
            Current Process Flow Diagram
          </h4>
          {diagnosis.currentMermaid &&
          diagnosis.currentMermaid.trim() !== "" ? (
            <div className="mb-4 rounded border bg-white p-4">
              <MermaidDiagram
                key={`phase1-current-${diagnosis.timestamp ?? "default"}`}
                chart={diagnosis.currentMermaid}
                id="phase1-current"
              />
            </div>
          ) : (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              No diagram data available. The process might not have a structured
              flowchart representation in the source document.
            </div>
          )}
        </div>

        {/* Bottlenecks */}
        {report.bottlenecks && report.bottlenecks.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Identified Bottlenecks
            </h4>
            <div className="space-y-2">
              {report.bottlenecks.map((b, i) => (
                <div
                  key={i}
                  className="rounded border border-red-200 bg-red-50 p-3"
                >
                  <div className="text-sm">
                    <strong>Step ID:</strong>{" "}
                    <span className="font-mono text-xs">{b.stepId}</span>
                    {" — "}
                    <strong>Step:</strong> {b.stepName}
                  </div>
                  <div className="text-sm">
                    <strong>Issue:</strong> {b.reason}
                  </div>
                  <div className="text-sm">
                    <strong>Impact:</strong> {b.impact}
                  </div>
                  <div className="text-sm">
                    <strong>Timing:</strong> {b.timingIssue.utilizationPercent}%
                    utilization
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Wins */}
        <div className="mb-6">
          <h4 className="text-md mb-2 font-semibold text-gray-800">
            Quick Win Opportunities
          </h4>
          {quickWins.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">
              No quick wins identified.
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Select</th>
                    <th className="min-w-[300px] px-4 py-3">Suggestion</th>
                    <th className="min-w-[140px] px-4 py-3">Step ID</th>
                    <th className="min-w-[180px] px-4 py-3">Step</th>
                    <th className="min-w-[180px] px-4 py-3">Performed By</th>
                    <th className="px-4 py-3 whitespace-nowrap">Effort</th>
                    <th className="px-4 py-3 whitespace-nowrap">Impact</th>
                    <th className="min-w-[120px] px-4 py-3">Time Saving</th>
                    <th className="min-w-[140px] px-4 py-3">Category</th>
                    <th className="min-w-[180px] px-4 py-3">Methodology</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quickWins.map((q, idx) => (
                    <tr
                      key={idx}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 appearance-none rounded border border-gray-300 ring-0 transition-all outline-none checked:bg-cyan-600 checked:ring-0"
                            checked={Boolean(selectedQuickWinIds[idx])}
                            onChange={() => toggleQuickWin(idx)}
                          />
                        </label>
                      </td>
                      <td className="px-4 py-3">{q.suggestion}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-700">
                          {q.stepId}
                        </span>
                      </td>
                      <td className="px-4 py-3">{q.stepName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {q.performedBy ?? "Unassigned"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {q.effort}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {q.impact}
                      </td>
                      <td className="px-4 py-3">{q.estimatedTimeSaving}</td>
                      <td className="px-4 py-3">{q.category}</td>
                      <td className="px-4 py-3">
                        {q.bestPractice && q.bestPractice.trim() !== "" ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            {q.bestPractice}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debug: Diagnosis JSON and Mermaid */}
        <details className="mb-4">
          <summary className="cursor-pointer text-xs text-cyan-600 hover:text-cyan-800">
            Show diagnosis JSON (debug)
          </summary>
          <div className="mt-2 rounded border bg-white p-2">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() =>
                  void copyToClipboard(
                    JSON.stringify(diagnosis.report ?? {}, undefined, 2),
                  )
                }
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
            <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre-wrap text-gray-700">
              {JSON.stringify(diagnosis.report ?? {}, undefined, 2)}
            </pre>
          </div>
        </details>

        <details className="mb-6">
          <summary className="cursor-pointer text-xs text-cyan-600 hover:text-cyan-800">
            Show raw Mermaid (current, debug)
          </summary>
          <div className="mt-2 rounded border bg-white p-2">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => void copyToClipboard(diagnosis.currentMermaid)}
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
            <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre text-gray-700">
              {diagnosis.currentMermaid}
            </pre>
          </div>
        </details>
      </div>
    );
  };

  const renderPhase2Controls = () => {
    if (!diagnosis.analysis || !diagnosis.report) return null;
    return (
      <div className="border-b border-gray-200 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-md font-semibold text-gray-800">
            Phase 2: Optimize
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              className={`rounded-l border px-3 py-1 ${guidedMode ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
              onClick={() => setGuidedMode(true)}
            >
              Guided
            </button>
            <button
              className={`rounded-r border px-3 py-1 ${!guidedMode ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
              onClick={() => setGuidedMode(false)}
            >
              Custom
            </button>
          </div>
        </div>

        {!guidedMode && (
          <>
            <textarea
              value={optimizationCriteria}
              onChange={(e) => setOptimizationCriteria(e.target.value)}
              placeholder="Additional instructions (optional). Be specific and surgical."
              className="w-full rounded border border-gray-300 p-3 text-sm focus:border-cyan-500 focus:outline-none"
              rows={6}
            />
            <div className="mt-2 text-xs text-gray-500">
              Example:
              <pre className="mt-1 rounded bg-gray-50 p-2">
                {`- Remove "Manual Review"
- Merge steps "Validate Request" and "Verify Details" into "Auto Validation"
- Add dependency from "Approve" to "Notify" with label "Approved"`}
              </pre>
            </div>
          </>
        )}

        {guidedMode && diagnosis.report?.quickWins && (
          <div className="mt-2 text-sm text-gray-600">
            Using your selected quick wins above to construct precise
            instructions.
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={handleOptimizeProcess}
            disabled={
              isGenerating ||
              (guidedMode &&
                !(diagnosis.report?.quickWins ?? []).some(
                  (_, i) => selectedQuickWinIds[i],
                )) ||
              (!guidedMode && optimizationCriteria.trim().length === 0)
            }
            className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isGenerating ? "Optimizing..." : "Apply Optimizations"}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (isBusy) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-500"></div>
          <p className="text-gray-600">
            {isProcessing
              ? "Analyzing document..."
              : "Applying optimizations..."}
          </p>
        </div>
      );
    }

    if (!results) {
      // If we have Phase 1, show its UI; otherwise show placeholder
      if (diagnosis.report && diagnosis.analysis) {
        return renderPhase1();
      } else {
        return (
          <div className="p-8">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Output</h3>
            <div className="rounded border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-cyan-800">
                Upload a process document to run automatic diagnosis.
              </p>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          Process Optimization Results (Phase 2)
        </h3>

        {/* Stacked diagrams */}
        <div className="mb-8 flex flex-col gap-8">
          <div>
            <h4 className="text-md mb-3 font-semibold text-gray-800">As-Is</h4>
            <div className="mb-4 rounded border bg-white p-4">
              <MermaidDiagram
                chart={results.currentMermaid}
                id="current-process"
              />
            </div>
          </div>
          <div>
            <h4 className="text-md mb-3 font-semibold text-gray-800">To-Be</h4>
            <div className="mb-4 rounded border bg-white p-4">
              <MermaidDiagram
                chart={results.optimizedMermaid}
                id="optimized-process"
              />
            </div>
          </div>
        </div>

        {/* Optimization Impact Analysis */}
        {impactAnalysis && (
          <div className="mb-6 rounded border bg-white p-4">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Optimization Impact Analysis
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Time Saved</div>
                <div className="text-base font-semibold text-gray-800">
                  {impactAnalysis.comparison.improvements.timeReduction} days (
                  {impactAnalysis.comparison.improvements.timeReductionPercent}
                  %)
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Steps Reduced</div>
                <div className="text-base font-semibold text-gray-800">
                  {impactAnalysis.comparison.current.totalSteps} →{" "}
                  {impactAnalysis.comparison.optimized.totalSteps}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <h5 className="mb-1 text-sm font-semibold text-gray-800">
                Applied Changes
              </h5>
              <ul className="text-sm text-gray-700">
                {impactAnalysis.appliedChanges.map((c, i) => (
                  <li key={i} className="ml-4 list-disc">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                      {c.changeDescription}
                    </span>
                    {c.impact ? ` — Impact: ${c.impact}` : ""}
                    {c.affectedDepartment
                      ? ` — Dept: ${c.affectedDepartment}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions Phase 3 */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerateSOP}
            disabled={!results || isGeneratingSop}
            className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isGeneratingSop
              ? "Generating SOP..."
              : "Generate Updated SOP Document"}
          </button>
          {/* Refine Optimization button hidden as requested */}
        </div>
      </div>
    );
  };

  const renderPhase3 = () => {
    if (!sopMarkdown) return null;

    return (
      <div className="p-8">
        {/* Header with actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Updated SOP Document
            </h2>
            <p className="text-sm text-gray-500">
              Standard Operating Procedure - Process Optimization
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentPhase(2)}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ← Back to Optimization
            </button>
            <button
              onClick={() => void copyToClipboard(sopMarkdown)}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Copy to Clipboard
            </button>
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(sopMarkdown)}`}
              download="updated-sop.md"
              className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              Download as Markdown
            </a>
          </div>
        </div>

        {/* Rendered Markdown Content */}
        <div className="prose prose-sm max-w-none rounded-lg border bg-white p-8 shadow-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom styling for markdown elements
              h1: ({ ...props }) => (
                <h1
                  className="mb-4 text-3xl font-bold text-gray-900"
                  {...props}
                />
              ),
              h2: ({ ...props }) => (
                <h2
                  className="mt-6 mb-3 text-2xl font-semibold text-gray-800"
                  {...props}
                />
              ),
              h3: ({ ...props }) => (
                <h3
                  className="mt-4 mb-2 text-xl font-semibold text-gray-800"
                  {...props}
                />
              ),
              h4: ({ ...props }) => (
                <h4
                  className="mt-3 mb-2 text-lg font-semibold text-gray-700"
                  {...props}
                />
              ),
              p: ({ ...props }) => (
                <p className="mb-3 leading-relaxed text-gray-700" {...props} />
              ),
              ul: ({ ...props }) => (
                <ul
                  className="mb-4 ml-6 list-disc space-y-1 text-gray-700"
                  {...props}
                />
              ),
              ol: ({ ...props }) => (
                <ol
                  className="mb-4 ml-6 list-decimal space-y-1 text-gray-700"
                  {...props}
                />
              ),
              li: ({ ...props }) => (
                <li className="leading-relaxed" {...props} />
              ),
              table: ({ ...props }) => (
                <div className="my-4 overflow-x-auto">
                  <table
                    className="min-w-full divide-y divide-gray-300 border"
                    {...props}
                  />
                </div>
              ),
              thead: ({ ...props }) => (
                <thead className="bg-gray-50" {...props} />
              ),
              th: ({ ...props }) => (
                <th
                  className="border px-4 py-2 text-left text-sm font-semibold text-gray-900"
                  {...props}
                />
              ),
              td: ({ ...props }) => (
                <td
                  className="border px-4 py-2 text-sm text-gray-700"
                  {...props}
                />
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code
                      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-cyan-700"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                // Block code - check if it's mermaid
                const match = /language-(\w+)/.exec(className ?? "");
                const language = match?.[1];
                if (language === "mermaid") {
                  const chartContent = Array.isArray(children)
                    ? children.join("")
                    : typeof children === "string"
                      ? children
                      : "";
                  return (
                    <div className="my-4">
                      <MermaidDiagram chart={chartContent.replace(/\n$/, "")} />
                    </div>
                  );
                }
                return (
                  <pre className="my-4 overflow-x-auto rounded bg-gray-50 p-4">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              blockquote: ({ ...props }) => (
                <blockquote
                  className="my-4 border-l-4 border-cyan-500 pl-4 text-gray-700 italic"
                  {...props}
                />
              ),
              hr: ({ ...props }) => (
                <hr className="my-6 border-gray-300" {...props} />
              ),
            }}
          >
            {sopMarkdown}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>SmartFlow</title>
        <meta
          name="description"
          content="AI-Powered Process Optimization Tool"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen overflow-x-hidden bg-gray-50">
        {renderSidebar()}

        <div className="flex flex-1 overflow-x-hidden">
          {currentPhase < 3 && (
            <div className="w-80">{renderUploadSection()}</div>
          )}
          <div className="flex-1 overflow-x-hidden">
            {renderPhaseNav()}
            {currentPhase === 3 ? (
              renderPhase3()
            ) : (
              <>
                {!results && currentPhase < 3 && renderPhase2Controls()}
                {renderResults()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => window.history.back()}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        >
          ← Back to Home
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message fixed top-4 right-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </>
  );
}
