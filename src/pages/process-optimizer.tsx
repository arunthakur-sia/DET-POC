import Head from "next/head";
import Image from "next/image";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/utils/api";
import MermaidDiagram from "@/components/MermaidDiagram";
import type {
  OptimizationResults,
  ProcessWithDiagnosis,
  DiagnosisQuickWin,
  ProcessAnalysis,
} from "@/server/services/ProcessOptimizer";
import { CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Local types ──────────────────────────────────────────────────────────────

interface ImpactAnalysis {
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
    performedBy?: string;
  }>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProcessOptimizerPage() {
  // ── Multi-process state ───────────────────────────────────────────────────
  const [allProcesses, setAllProcesses] = useState<ProcessWithDiagnosis[]>([]);
  const [selectedProcessIdx, setSelectedProcessIdx] = useState<number>(0);

  // Per-process state (keyed by processIndex)
  const [processOptimizations, setProcessOptimizations] = useState<
    Record<number, OptimizationResults>
  >({});
  const [processQuickWinSelections, setProcessQuickWinSelections] = useState<
    Record<number, Record<number, boolean>>
  >({});
  const [processSops, setProcessSops] = useState<Record<number, string>>({});
  const [processCriteria, setProcessCriteria] = useState<
    Record<number, string>
  >({});
  const [processPhases, setProcessPhases] = useState<
    Record<number, 1 | 2 | 3>
  >({});
  const [processImpacts, setProcessImpacts] = useState<
    Record<number, ImpactAnalysis | null>
  >({});

  // ── UI state ──────────────────────────────────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSop, setIsGeneratingSop] = useState(false);
  const [guidedMode, setGuidedMode] = useState(true);

  // ── Derived state ─────────────────────────────────────────────────────────
  const selectedProcess =
    allProcesses.length > 0 ? (allProcesses[selectedProcessIdx] ?? null) : null;
  const currentPhase = processPhases[selectedProcessIdx] ?? 1;
  const currentOptimization = processOptimizations[selectedProcessIdx] ?? null;
  const currentSop = processSops[selectedProcessIdx] ?? "";
  const currentImpact = processImpacts[selectedProcessIdx] ?? null;
  const currentSelections = processQuickWinSelections[selectedProcessIdx] ?? {};
  const currentCriteria = processCriteria[selectedProcessIdx] ?? "";

  // ── Mutations ─────────────────────────────────────────────────────────────
  const extractAndDiagnoseAllMutation =
    api.processOptimizer.extractAndDiagnoseAll.useMutation();
  const optimizeForProcessMutation =
    api.processOptimizer.optimizeForProcess.useMutation();
  const generateSopMutation = api.processOptimizer.generateSOP.useMutation();

  const isProcessing = extractAndDiagnoseAllMutation.isPending;
  const isBusy = isProcessing || isGenerating;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };

  const parseTimeSaving = (text: string | undefined): number => {
    if (!text) return 0;
    const match =
      /(\d+(\.\d+)?)\s*(day|days|working day|working days)/i.exec(text);
    if (match?.[1]) return parseFloat(match[1]);
    return 0;
  };

  const simulateImpact = (
    selected: DiagnosisQuickWin[],
    proc: ProcessAnalysis,
  ): ImpactAnalysis => {
    const currentTotalSteps = proc.processSteps.length;
    const currentDuration = Object.values(proc.leadTimes ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
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
          ? 100
          : 0;

    return {
      comparison: {
        current: {
          totalSteps: currentTotalSteps,
          totalDuration: currentDuration,
          departmentHandoffs: currentHandoffs,
          approvalLayers,
        },
        optimized: {
          totalSteps: Math.max(0, currentTotalSteps - stepsRemoved),
          totalDuration: optimizedDuration,
          departmentHandoffs: currentHandoffs,
          approvalLayers,
        },
        improvements: { stepReduction: stepsRemoved, timeReduction, timeReductionPercent },
      },
      appliedChanges: selected.map((q) => ({
        changeDescription: q.suggestion,
        impact: q.estimatedTimeSaving ? `Saved ${q.estimatedTimeSaving}` : "N/A",
        performedBy: q.performedBy,
      })),
    };
  };

  const buildCriteriaFromQuickWins = (
    quickWins: DiagnosisQuickWin[],
    selections: Record<number, boolean>,
  ): string => {
    const selected = quickWins.filter((_, i) => selections[i]);
    const lines: string[] = [];
    selected.forEach((q) => {
      if (q.category === "Removal") {
        lines.push(`Remove "${q.stepName}"`);
      } else if (
        q.category === "Consolidation" &&
        q.steps &&
        q.steps.length > 1 &&
        q.consolidationSuggestion
      ) {
        lines.push(
          `Merge steps "${q.steps.join('" and "')}" into a single step: "${q.consolidationSuggestion}". Keep the earliest step's position in the flow.`,
        );
      } else {
        lines.push(q.suggestion);
      }
    });
    return lines.map((l) => `- ${l}`).join("\n");
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(
          `File too large. Please upload a file smaller than 10 MB. Current size: ${(file.size / 1024 / 1024).toFixed(1)} MB`,
        );
        return;
      }

      setUploadedFile(file);
      setError("");
      // Reset per-process state on new upload
      setAllProcesses([]);
      setSelectedProcessIdx(0);
      setProcessOptimizations({});
      setProcessQuickWinSelections({});
      setProcessSops({});
      setProcessCriteria({});
      setProcessPhases({});
      setProcessImpacts({});

      const processFile = async () => {
        try {
          let fileContent: string;
          if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
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
            fileContent = await file.text();
          }

          const result = await extractAndDiagnoseAllMutation.mutateAsync({
            fileContent,
            fileName: file.name,
            fileType: file.type,
          });

          if (result.success && result.processes && result.processes.length > 0) {
            setAllProcesses(result.processes);
            setSelectedProcessIdx(0);
            const phases: Record<number, 1 | 2 | 3> = {};
            result.processes.forEach((_, i) => {
              phases[i] = 1;
            });
            setProcessPhases(phases);
          } else if (!result.success) {
            setError(result.error ?? "Failed to process document");
          } else {
            setError(
              "No processes found in this document. Please check the file.",
            );
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      };

      void processFile();
    },
    [extractAndDiagnoseAllMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    multiple: false,
  });

  const toggleQuickWin = (qIdx: number) => {
    setProcessQuickWinSelections((prev) => ({
      ...prev,
      [selectedProcessIdx]: {
        ...(prev[selectedProcessIdx] ?? {}),
        [qIdx]: !(prev[selectedProcessIdx]?.[qIdx] ?? false),
      },
    }));
  };

  const handleOptimizeProcess = async () => {
    if (!selectedProcess) return;

    setIsGenerating(true);
    setError("");

    try {
      const quickWins = selectedProcess.diagnosis.quickWins ?? [];
      let criteria = currentCriteria.trim();

      if (guidedMode) {
        const guidedCriteria = buildCriteriaFromQuickWins(quickWins, currentSelections);
        if (guidedCriteria) {
          criteria = guidedCriteria + (criteria ? `\n${criteria}` : "");
        }
      }

      const result = await optimizeForProcessMutation.mutateAsync({
        analysisJson: JSON.stringify(selectedProcess.analysis),
        optimizationCriteria: criteria,
      });

      if (result.success && result.results) {
        setProcessOptimizations((prev) => ({
          ...prev,
          [selectedProcessIdx]: result.results,
        }));

        // Compute impact
        const selected = quickWins.filter((_, i) => currentSelections[i]);
        const impact = simulateImpact(selected, selectedProcess.analysis);
        setProcessImpacts((prev) => ({ ...prev, [selectedProcessIdx]: impact }));

        setProcessPhases((prev) => ({
          ...prev,
          [selectedProcessIdx]: 2,
        }));
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
    if (!selectedProcess || !currentOptimization) return;

    try {
      setIsGeneratingSop(true);

      const selectedQuickWins = (
        selectedProcess.diagnosis.quickWins ?? []
      ).filter((_, i) => currentSelections[i]);

      const sop = await generateSopMutation.mutateAsync({
        originalContent: JSON.stringify(selectedProcess.analysis),
        processName: selectedProcess.analysis.processName,
        optimizedMermaid: currentOptimization.optimizedMermaid,
        appliedChanges: selectedQuickWins.map((qw) => ({
          changeDescription: qw.suggestion,
          impact: qw.estimatedTimeSaving
            ? `Saved ${qw.estimatedTimeSaving}`
            : undefined,
          affectedDepartment: undefined,
          performedBy: qw.performedBy,
        })),
        impactAnalysis: currentImpact ?? undefined,
        processId: selectedProcess.analysis.documentMetadata?.processId,
        processOwner: selectedProcess.analysis.documentMetadata?.processOwner,
        department: selectedProcess.analysis.documentMetadata?.department,
        section: selectedProcess.analysis.documentMetadata?.section,
        documentMetadata: selectedProcess.analysis.documentMetadata,
        diagnosis: selectedProcess.diagnosis,
      });

      if (sop.success) {
        setProcessSops((prev) => ({
          ...prev,
          [selectedProcessIdx]: sop.markdown ?? "",
        }));
        setProcessPhases((prev) => ({
          ...prev,
          [selectedProcessIdx]: 3,
        }));
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

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderNavSidebar = () => (
    <div className="w-56 flex-shrink-0 bg-gray-100 p-5">
      <div className="mb-8">
        <Image src="/assets/sia.png" alt="SIA Logo" width={120} height={32} />
      </div>
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

  const renderProcessPanel = () => (
    <div className="flex flex-col gap-0 overflow-y-auto">
      {/* Upload Area */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Upload Document
        </h2>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed border-cyan-500 p-5 text-center ${
            isDragActive ? "bg-cyan-50" : ""
          } ${isBusy ? "pointer-events-none opacity-70" : ""}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-sm text-gray-600">Drop here…</p>
          ) : (
            <div>
              <p className="mb-1 text-sm text-gray-600">
                Drag &amp; drop or click to upload
              </p>
              <p className="text-xs text-gray-400">PDF or TXT · max 10 MB</p>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="mt-3 rounded border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-cyan-500"></div>
              <span>Extracting &amp; diagnosing all processes…</span>
            </div>
          </div>
        )}

        {uploadedFile && !isProcessing && (
          <div className="mt-3 rounded border bg-gray-50 p-2 text-xs text-gray-600">
            <span className="font-medium">{uploadedFile.name}</span>
            &nbsp;·&nbsp;
            {(uploadedFile.size / 1024).toFixed(0)} KB
          </div>
        )}
      </div>

      {/* Process List */}
      {allProcesses.length > 0 && (
        <div className="flex flex-col gap-0">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {allProcesses.length} Process{allProcesses.length !== 1 ? "es" : ""}{" "}
            Found
          </div>
          {allProcesses.map((proc, idx) => {
            const isSelected = idx === selectedProcessIdx;
            const isOptimized = Boolean(processOptimizations[idx]);
            const phase = processPhases[idx] ?? 1;
            const classification =
              proc.diagnosis.automationClassification?.primaryClassification;
            const stepCount =
              proc.analysis.documentMetadata?.activitiesTableCount ??
              proc.analysis.processSteps.length;

            return (
              <button
                key={idx}
                onClick={() => setSelectedProcessIdx(idx)}
                className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-l-4 border-l-cyan-600 bg-cyan-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${isSelected ? "text-cyan-800" : "text-gray-800"}`}
                    >
                      {proc.analysis.processName}
                    </p>
                    {proc.analysis.documentMetadata?.processId && (
                      <p className="mt-0.5 truncate font-mono text-xs text-gray-400">
                        {proc.analysis.documentMetadata.processId}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        {stepCount} steps
                      </span>
                      {phase >= 1 && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                          Diagnosed
                        </span>
                      )}
                      {classification && (
                        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-xs text-cyan-700">
                          {classification}
                        </span>
                      )}
                      {isOptimized && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">
                          Optimized
                        </span>
                      )}
                      {processSops[idx] && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          SOP Ready
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-cyan-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPhaseNav = () => (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
      <div className="flex items-center gap-5 text-sm">
        <button
          onClick={() =>
            setProcessPhases((prev) => ({
              ...prev,
              [selectedProcessIdx]: 1,
            }))
          }
          className={`flex items-center gap-1.5 ${currentPhase >= 1 ? "text-cyan-700 font-medium" : "text-gray-400"}`}
        >
          <span>1. Diagnose</span>
          {currentPhase >= 1 && selectedProcess && (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          )}
        </button>
        <span className="text-gray-300">──►</span>
        <button
          onClick={() => {
            if (currentOptimization) {
              setProcessPhases((prev) => ({
                ...prev,
                [selectedProcessIdx]: 2,
              }));
            }
          }}
          disabled={!currentOptimization}
          className={`flex items-center gap-1.5 ${currentPhase >= 2 ? "text-cyan-700 font-medium" : "text-gray-400"} disabled:cursor-not-allowed`}
        >
          <span>2. Optimize</span>
          {currentOptimization && (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          )}
        </button>
        <span className="text-gray-300">──►</span>
        <button
          onClick={() => {
            if (currentSop) {
              setProcessPhases((prev) => ({
                ...prev,
                [selectedProcessIdx]: 3,
              }));
            }
          }}
          disabled={!currentSop}
          className={`flex items-center gap-1.5 ${currentPhase >= 3 ? "text-cyan-700 font-medium" : "text-gray-400"} disabled:cursor-not-allowed`}
        >
          <span>3. Generate SOP</span>
          {currentSop ? (
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          ) : (
            <LockClosedIcon className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
      {selectedProcess && (
        <span className="truncate text-xs text-gray-400">
          {selectedProcess.analysis.processName}
        </span>
      )}
    </div>
  );

  const renderDiagnosis = () => {
    if (!selectedProcess) return null;
    const { analysis, diagnosis, currentMermaid } = selectedProcess;
    const report = diagnosis;
    const quickWins = report.quickWins ?? [];
    const metadata = analysis.documentMetadata;
    const totalSteps =
      metadata?.activitiesTableCount ?? analysis.processSteps.length;
    const totalDuration = Object.values(analysis.leadTimes ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    const hasDiscrepancy = metadata?.stepCountDiscrepancy ?? false;
    const classification = report.automationClassification;

    const classificationTone =
      classification.primaryClassification === "AI Agent"
        ? "bg-emerald-100 text-emerald-800"
        : classification.primaryClassification === "Classical RPA"
          ? "bg-blue-100 text-blue-800"
          : "bg-amber-100 text-amber-800";

    const hybridLabels = [
      classification.hybridFlags.aiAgent ? "AI Agent" : undefined,
      classification.hybridFlags.classicalRpa ? "Classical RPA" : undefined,
      classification.hybridFlags.manualOptimization
        ? "Manual Optimization"
        : undefined,
    ].filter((v): v is string => Boolean(v));

    return (
      <div className="p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          Process Diagnosis Report
        </h3>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">Process</div>
            <div className="text-sm font-semibold text-gray-800">
              {analysis.processName}
            </div>
            {metadata?.processId && (
              <div className="font-mono text-xs text-gray-400">
                {metadata.processId}
              </div>
            )}
          </div>
          <div className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">Total Steps</div>
            <div className="text-sm font-semibold text-gray-800">
              {totalSteps}
              {metadata?.flowchartBoxCount !== undefined &&
                metadata.flowchartBoxCount !== totalSteps && (
                  <span
                    className={`ml-1 text-xs ${hasDiscrepancy ? "text-amber-600" : "text-gray-400"}`}
                  >
                    (Flowchart: {metadata.flowchartBoxCount})
                  </span>
                )}
            </div>
            {hasDiscrepancy && (
              <div className="text-xs text-amber-600">⚠️ Mismatch</div>
            )}
          </div>
          <div className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">Duration (days)</div>
            <div className="text-sm font-semibold text-gray-800">
              {totalDuration || "—"}
            </div>
          </div>
          <div className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">Process Owner</div>
            <div className="text-sm font-semibold text-gray-800">
              {metadata?.processOwner ?? "N/A"}
            </div>
            {metadata?.department && (
              <div className="text-xs text-gray-400">{metadata.department}</div>
            )}
          </div>
        </div>

        {/* Automation Classification */}
        <div className="mb-6 rounded border border-cyan-200 bg-cyan-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="text-md font-semibold text-gray-800">
              Automation Pathway Classification
            </h4>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${classificationTone}`}>
              {classification.primaryClassification}
            </span>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
              Confidence: {classification.confidenceScore}%
            </span>
          </div>

          <div className="mb-3 h-2 overflow-hidden rounded bg-gray-200">
            <div
              className="h-full rounded bg-cyan-600"
              style={{ width: `${classification.confidenceScore}%` }}
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-gray-500">AI Agent Score</div>
              <div className="text-base font-semibold text-gray-800">
                {classification.pathwayScores.aiAgent}
              </div>
            </div>
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-gray-500">Classical RPA Score</div>
              <div className="text-base font-semibold text-gray-800">
                {classification.pathwayScores.classicalRpa}
              </div>
            </div>
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-gray-500">Manual Optimization Score</div>
              <div className="text-base font-semibold text-gray-800">
                {classification.pathwayScores.manualOptimization}
              </div>
            </div>
          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Hybrid Flags
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {hybridLabels.length > 0 ? (
              hybridLabels.map((label) => (
                <span
                  key={label}
                  className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No hybrid pathways flagged.</span>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Key Factors
            </div>
            {classification.keyFactors.length > 0 ? (
              <ul className="space-y-1 text-sm text-gray-700">
                {classification.keyFactors.map((factor, i) => (
                  <li key={i} className="ml-4 list-disc">
                    {factor}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No key factors provided.</p>
            )}
          </div>
        </div>

        {/* KPIs */}
        {(metadata?.kpis?.length ?? 0) > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Process KPIs
            </h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {metadata?.kpis?.map((kpi, i) => (
                <div key={i} className="rounded border bg-white p-3">
                  <div className="text-sm font-medium text-gray-700">
                    {kpi.name}
                  </div>
                  <div className="text-base font-semibold text-cyan-700">
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
          <h4 className="text-md mb-2 font-semibold text-gray-800">
            Current Process Flow
          </h4>
          {currentMermaid.trim() ? (
            <div className="rounded border bg-white p-4">
              <MermaidDiagram
                key={`diag-${selectedProcessIdx}`}
                chart={currentMermaid}
                id={`diag-${selectedProcessIdx}`}
              />
            </div>
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              No diagram data available for this process.
            </div>
          )}
        </div>

        {/* Bottlenecks */}
        {report.bottlenecks?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Identified Bottlenecks
            </h4>
            <div className="space-y-2">
              {report.bottlenecks.map((b, i) => (
                <div
                  key={i}
                  className="rounded border border-red-200 bg-red-50 p-3 text-sm"
                >
                  <span className="font-mono text-xs text-red-700">
                    {b.stepId}
                  </span>{" "}
                  — <strong>{b.stepName}</strong>
                  <div className="mt-1 text-gray-700">
                    {b.reason}{" "}
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${b.impact === "High" ? "bg-red-200 text-red-800" : b.impact === "Medium" ? "bg-amber-200 text-amber-800" : "bg-gray-200 text-gray-700"}`}
                    >
                      {b.impact} Impact
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Utilization: {b.timingIssue.utilizationPercent}% (
                    {b.timingIssue.actualTime} / {b.timingIssue.availableTime}{" "}
                    days)
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
            {quickWins.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                — select items below then click &quot;Apply Optimizations&quot;
              </span>
            )}
          </h4>
          {quickWins.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">
              No quick wins identified.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-3">Select</th>
                    <th className="min-w-[280px] px-3 py-3">Suggestion</th>
                    <th className="min-w-[110px] px-3 py-3">Step ID</th>
                    <th className="min-w-[160px] px-3 py-3">Step</th>
                    <th className="min-w-[160px] px-3 py-3">Performed By</th>
                    <th className="px-3 py-3 whitespace-nowrap">Effort</th>
                    <th className="px-3 py-3 whitespace-nowrap">Impact</th>
                    <th className="min-w-[110px] px-3 py-3">Time Saving</th>
                    <th className="min-w-[120px] px-3 py-3">Category</th>
                    <th className="min-w-[160px] px-3 py-3">Methodology</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quickWins.map((q, qi) => (
                    <tr
                      key={qi}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 appearance-none rounded border border-gray-300 checked:bg-cyan-600"
                          checked={Boolean(currentSelections[qi])}
                          onChange={() => toggleQuickWin(qi)}
                        />
                      </td>
                      <td className="px-3 py-3">{q.suggestion}</td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-gray-600">
                          {q.stepId}
                        </span>
                      </td>
                      <td className="px-3 py-3">{q.stepName}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {q.performedBy ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        {q.effort}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        {q.impact}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {q.estimatedTimeSaving}
                      </td>
                      <td className="px-3 py-3 text-xs">{q.category}</td>
                      <td className="px-3 py-3">
                        {q.bestPractice?.trim() ? (
                          <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
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

        {/* Debug */}
        <details className="mb-4">
          <summary className="cursor-pointer text-xs text-cyan-600 hover:text-cyan-800">
            Show diagnosis JSON (debug)
          </summary>
          <div className="mt-2 rounded border bg-white p-2">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() =>
                  void copyToClipboard(
                    JSON.stringify(selectedProcess.diagnosis, undefined, 2),
                  )
                }
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
            <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre-wrap text-gray-700">
              {JSON.stringify(selectedProcess.diagnosis, undefined, 2)}
            </pre>
          </div>
        </details>
      </div>
    );
  };

  const renderOptimizationControls = () => {
    if (!selectedProcess) return null;
    const quickWins = selectedProcess.diagnosis.quickWins ?? [];
    const hasSelections = quickWins.some((_, i) => currentSelections[i]);

    return (
      <div className="border-t border-gray-200 bg-gray-50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-md font-semibold text-gray-800">
            Run Optimization for:{" "}
            <span className="font-normal text-cyan-700">
              {selectedProcess.analysis.processName}
            </span>
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <button
              className={`rounded-l border px-3 py-1 text-xs ${guidedMode ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
              onClick={() => setGuidedMode(true)}
            >
              Guided
            </button>
            <button
              className={`rounded-r border px-3 py-1 text-xs ${!guidedMode ? "border-cyan-600 bg-cyan-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
              onClick={() => setGuidedMode(false)}
            >
              Custom
            </button>
          </div>
        </div>

        {guidedMode && (
          <p className="mb-3 text-xs text-gray-500">
            {hasSelections
              ? `${Object.values(currentSelections).filter(Boolean).length} quick win(s) selected above will be applied.`
              : "Select quick wins from the table above to apply them."}
          </p>
        )}

        {!guidedMode && (
          <>
            <textarea
              value={currentCriteria}
              onChange={(e) =>
                setProcessCriteria((prev) => ({
                  ...prev,
                  [selectedProcessIdx]: e.target.value,
                }))
              }
              placeholder="Custom optimization instructions. Be specific and surgical."
              className="w-full rounded border border-gray-300 p-3 text-sm focus:border-cyan-500 focus:outline-none"
              rows={5}
            />
            <div className="mt-1 text-xs text-gray-400">
              Example: <code>Remove &quot;Manual Review&quot;</code> or{" "}
              <code>
                Merge &quot;Validate Request&quot; and &quot;Verify
                Details&quot;
              </code>
            </div>
          </>
        )}

        <div className="mt-4">
          <button
            onClick={handleOptimizeProcess}
            disabled={
              isGenerating ||
              (guidedMode && !hasSelections) ||
              (!guidedMode && currentCriteria.trim().length === 0)
            }
            className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isGenerating ? "Optimizing…" : "Apply Optimizations"}
          </button>
        </div>
      </div>
    );
  };

  const renderOptimizationResults = () => {
    if (!currentOptimization) return null;

    return (
      <div className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          Optimization Results
        </h3>

        <div className="mb-8 flex flex-col gap-8">
          <div>
            <h4 className="text-md mb-2 font-semibold text-gray-800">As-Is</h4>
            <div className="rounded border bg-white p-4">
              <MermaidDiagram
                chart={currentOptimization.currentMermaid}
                id={`opt-current-${selectedProcessIdx}`}
              />
            </div>
          </div>
          <div>
            <h4 className="text-md mb-2 font-semibold text-gray-800">To-Be</h4>
            <div className="rounded border bg-white p-4">
              <MermaidDiagram
                chart={currentOptimization.optimizedMermaid}
                id={`opt-optimized-${selectedProcessIdx}`}
              />
            </div>
          </div>
        </div>

        {/* Impact */}
        {currentImpact && (
          <div className="mb-6 rounded border bg-white p-4">
            <h4 className="text-md mb-2 font-semibold text-gray-800">
              Optimization Impact
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Time Saved</div>
                <div className="text-base font-semibold text-gray-800">
                  {currentImpact.comparison.improvements.timeReduction} days (
                  {currentImpact.comparison.improvements.timeReductionPercent}%)
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Steps</div>
                <div className="text-base font-semibold text-gray-800">
                  {currentImpact.comparison.current.totalSteps} →{" "}
                  {currentImpact.comparison.optimized.totalSteps}
                </div>
              </div>
            </div>
            {currentImpact.appliedChanges.length > 0 && (
              <div className="mt-4">
                <h5 className="mb-1 text-sm font-semibold text-gray-800">
                  Applied Changes
                </h5>
                <ul className="text-sm text-gray-700">
                  {currentImpact.appliedChanges.map((c, i) => (
                    <li key={i} className="ml-4 list-disc">
                      <CheckCircleIcon className="mr-1 inline h-3 w-3 text-emerald-600" />
                      {c.changeDescription}
                      {c.impact ? ` — ${c.impact}` : ""}
                      {c.performedBy ? ` · ${c.performedBy}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleGenerateSOP}
          disabled={isGeneratingSop}
          className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isGeneratingSop ? "Generating SOP…" : "Generate Updated SOP"}
        </button>
      </div>
    );
  };

  const renderSopPhase = () => {
    if (!currentSop) return null;

    return (
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Updated SOP Document
            </h2>
            <p className="text-sm text-gray-500">
              {selectedProcess?.analysis.processName}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() =>
                setProcessPhases((prev) => ({
                  ...prev,
                  [selectedProcessIdx]: 2,
                }))
              }
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={() => void copyToClipboard(currentSop)}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Copy
            </button>
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(currentSop)}`}
              download="updated-sop.md"
              className="rounded bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              Download
            </a>
          </div>
        </div>

        <div className="prose prose-sm max-w-none rounded-lg border bg-white p-8 shadow-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
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
                const match = /language-(\w+)/.exec(className ?? "");
                if (match?.[1] === "mermaid") {
                  const chartContent = Array.isArray(children)
                    ? children.join("")
                    : typeof children === "string"
                      ? children
                      : "";
                  return (
                    <div className="my-4">
                      <MermaidDiagram
                        chart={chartContent.replace(/\n$/, "")}
                      />
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
            {currentSop}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>SmartFlow</title>
        <meta
          name="description"
          content="AI-Powered Multi-Process Optimization Tool"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen overflow-x-hidden bg-gray-50">
        {/* Left nav sidebar */}
        {renderNavSidebar()}

        {/* Process list panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          {renderProcessPanel()}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-x-hidden">
          {selectedProcess ? (
            <>
              {renderPhaseNav()}
              <div className="flex-1 overflow-y-auto">
                {currentPhase === 3 ? (
                  renderSopPhase()
                ) : (
                  <>
                    {currentPhase === 1 && (
                      <>
                        {renderDiagnosis()}
                        {renderOptimizationControls()}
                      </>
                    )}
                    {currentPhase === 2 && (
                      <>
                        {renderOptimizationResults()}
                        {!currentOptimization && renderOptimizationControls()}
                      </>
                    )}
                    {/* Show busy spinner when optimizing */}
                    {isGenerating && (
                      <div className="p-8 text-center">
                        <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-500"></div>
                        <p className="text-gray-600">Applying optimizations…</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="max-w-sm text-center">
                {isProcessing ? (
                  <>
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
                    <p className="text-gray-600">
                      Extracting and diagnosing all processes…
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      Using Claude Opus for comprehensive extraction
                    </p>
                  </>
                ) : allProcesses.length === 0 ? (
                  <>
                    <div className="mb-4 rounded-lg border-2 border-dashed border-gray-300 p-8">
                      <svg
                        className="mx-auto mb-4 h-12 w-12 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-gray-500">
                        Upload a process document to get started
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        Supports PDF and TXT files with single or multiple
                        processes
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">
                    Select a process from the left panel to view its diagnosis
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => window.history.back()}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        >
          ← Back
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 max-w-sm rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError("")}
            className="mt-1 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
