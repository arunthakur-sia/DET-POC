import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getProject,
  getUserProjects,
  createProject,
  updateProject,
  uploadDocumentToStorage,
  downloadDocumentFromStorage,
  type Project,
  type StoredDocument,
} from "@/lib/supabase";

const MermaidDiagram = dynamic(() => import("@/components/MermaidDiagram"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center text-sm" style={{ color: "#94A3B8" }}>
      Loading diagram\u2026
    </div>
  ),
});
import type {
  OptimizationResults,
  ProcessWithDiagnosis,
  DiagnosisQuickWin,
  ProcessAnalysis,
  StepOptimizationClassification,
} from "@/server/services/ProcessOptimizer";
import { CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Local types

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

// Component

export default function ProcessOptimizerPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t, isRTL } = useLanguage();
  const router = useRouter();
  const { projectId } = router.query as { projectId?: string };

  // Project persistence state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) void router.replace("/login");
  }, [user, authLoading, router]);

  // Load existing project on mount
  useEffect(() => {
    if (!projectId || !user) return;
    setProjectLoading(true);
    // Reset ALL state so a previous project never bleeds into the new one
    setStagedFiles([]);
    setProcessedFiles([]);
    setStoredDocuments([]);
    setAllProcesses([]);
    setSelectedProcessIdx(0);
    setProcessOptimizations({});
    setProcessSops({});
    setProcessPhases({});
    setProcessImpacts({});
    setProcessQuickWinSelections({});
    setProcessCriteria({});
    setCurrentProject(null);
    getProject(projectId)
      .then((proj) => {
        if (!proj) return;
        setCurrentProject(proj);
        if (Array.isArray(proj.processes) && proj.processes.length > 0) {
          setAllProcesses(proj.processes as ProcessWithDiagnosis[]);
          setSelectedProcessIdx(0);
        }
        if (proj.optimizations) setProcessOptimizations(proj.optimizations as Record<number, OptimizationResults>);
        if (proj.sops) setProcessSops(proj.sops as Record<number, string>);
        if (proj.phases) setProcessPhases(proj.phases as Record<number, 1 | 2 | 3>);
        if (proj.impacts) setProcessImpacts(proj.impacts as Record<number, ImpactAnalysis | null>);
        if (proj.quick_win_selections) {
          setProcessQuickWinSelections(proj.quick_win_selections as Record<number, Record<number, boolean>>);
        }
        if (proj.criteria) setProcessCriteria(proj.criteria as Record<number, string>);
        if (Array.isArray(proj.documents) && proj.documents.length > 0) {
          setStoredDocuments(proj.documents);
        }
      })
      .catch(console.error)
      .finally(() => setProjectLoading(false));
  }, [projectId, user]);

  // Debounced save to Supabase
  const saveProject = useCallback(
    (updates: Parameters<typeof updateProject>[1]) => {
      if (!currentProject) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(() => {
        updateProject(currentProject.id, updates)
          .then(() => {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          })
          .catch(() => setSaveStatus("error"));
      }, 800);
    },
    [currentProject],
  );

  // Multi-process state
  const [allProcesses, setAllProcesses] = useState<ProcessWithDiagnosis[]>([]);
  const [selectedProcessIdx, setSelectedProcessIdx] = useState<number>(0);

  const [processOptimizations, setProcessOptimizations] = useState<Record<number, OptimizationResults>>({});
  const [processQuickWinSelections, setProcessQuickWinSelections] = useState<Record<number, Record<number, boolean>>>({});
  const [processSops, setProcessSops] = useState<Record<number, string>>({});
  const [processCriteria, setProcessCriteria] = useState<Record<number, string>>({});
  const [processPhases, setProcessPhases] = useState<Record<number, 1 | 2 | 3>>({});
  const [processImpacts, setProcessImpacts] = useState<Record<number, ImpactAnalysis | null>>({});

  // Projects sidebar state
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserProjects(user.id).then(setUserProjects).catch(console.error);
  }, [user]);

  // UI state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);
  const [storedDocuments, setStoredDocuments] = useState<StoredDocument[]>([]);
  const [newProcessName, setNewProcessName] = useState("");
  const [isCreatingProcess, setIsCreatingProcess] = useState(false);
  const [error, setError] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSop, setIsGeneratingSop] = useState(false);
  const [selectedStepCardId, setSelectedStepCardId] = useState<string | null>(null);
  const [showBoilerplate, setShowBoilerplate] = useState(false);
  const [boilerplateCopied, setBoilerplateCopied] = useState(false);
  const [guidedMode, setGuidedMode] = useState(true);

  // Derived state
  const selectedProcess = allProcesses.length > 0 ? (allProcesses[selectedProcessIdx] ?? null) : null;
  const currentPhase = processPhases[selectedProcessIdx] ?? 1;
  const currentOptimization = processOptimizations[selectedProcessIdx] ?? null;
  const currentSop = processSops[selectedProcessIdx] ?? "";
  const currentImpact = processImpacts[selectedProcessIdx] ?? null;
  const currentSelections = processQuickWinSelections[selectedProcessIdx] ?? {};
  const currentCriteria = processCriteria[selectedProcessIdx] ?? "";

  // Mutations
  const extractAndDiagnoseAllMutation = api.processOptimizer.extractAndDiagnoseAll.useMutation();
  const optimizeForProcessMutation = api.processOptimizer.optimizeForProcess.useMutation();
  const generateSopMutation = api.processOptimizer.generateSOP.useMutation();

  const isProcessing = extractAndDiagnoseAllMutation.isPending;

  // Helpers
  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  };

  const parseTimeSaving = (text: string | undefined): number => {
    if (!text) return 0;
    const match = /(\d+(\.\d+)?)\s*(day|days|working day|working days)/i.exec(text);
    if (match?.[1]) return parseFloat(match[1]);
    return 0;
  };

  const simulateImpact = (selected: DiagnosisQuickWin[], proc: ProcessAnalysis): ImpactAnalysis => {
    const metadata = proc.documentMetadata;
    // activitiesTable is the source of truth for step count and individual step durations
    const activitiesTable = metadata?.activitiesTable ?? [];

    // Step count: prefer activitiesTableCount (PDF source of truth) > activitiesTable.length > processSteps
    const currentTotalSteps =
      metadata?.activitiesTableCount ??
      (activitiesTable.length > 0 ? activitiesTable.length : proc.processSteps.length);

    // Duration: sum actual times from activitiesTable when available; fall back to leadTimes
    const currentDuration = activitiesTable.length > 0
      ? activitiesTable.reduce((sum, a) => sum + (a.actualTime ?? 0), 0)
      : Object.values(proc.leadTimes ?? {}).reduce((a, b) => a + (b ?? 0), 0);

    // Helper: look up step duration using multiple fallback strategies
    const getStepTime = (stepId: string, stepName: string): number => {
      // 1. Activities table by ID (most accurate)
      const actById = activitiesTable.find((a) => a.id === stepId);
      if (actById?.actualTime) return actById.actualTime;
      // 2. Activities table by name
      const actByName = activitiesTable.find((a) => a.name?.toLowerCase() === stepName.toLowerCase());
      if (actByName?.actualTime) return actByName.actualTime;
      // 3. leadTimes by ID
      if (proc.leadTimes?.[stepId]) return proc.leadTimes[stepId];
      // 4. Find processStep by name, then use its leadTime
      const step = proc.processSteps.find((s) => s.name.toLowerCase() === stepName.toLowerCase());
      if (step) return proc.leadTimes?.[step.id] ?? 0;
      return 0;
    };

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
      if (!nodes.length) return proc.processSteps.filter((s) => s.name.toLowerCase().includes("approve")).length;
      return nodes.filter((n) => n.type === "gateway" || n.name.toLowerCase().includes("approve")).length;
    })();

    let timeSaved = 0;
    let stepsRemoved = 0;
    selected.forEach((q) => {
      if (q.category === "Removal") {
        const stepTime = getStepTime(q.stepId, q.stepName);
        stepsRemoved += 1;
        timeSaved += stepTime;
      } else if (q.category === "Consolidation") {
        stepsRemoved += 1;
        // Prefer estimated time saving from quickWin; fall back to the time of the merged step
        const estimated = parseTimeSaving(q.estimatedTimeSaving);
        timeSaved += estimated > 0 ? estimated : getStepTime(q.stepId, q.stepName) * 0.3;
      } else if (q.category === "Parallelization") {
        const stepTime = getStepTime(q.stepId, q.stepName);
        timeSaved += stepTime * 0.5;
      } else {
        timeSaved += parseTimeSaving(q.estimatedTimeSaving);
      }
    });

    const optimizedDuration = Math.max(0, currentDuration - timeSaved);
    const timeReduction = Math.max(0, timeSaved);
    const timeReductionPercent = currentDuration > 0
      ? Math.round((timeReduction / currentDuration) * 100)
      : timeReduction > 0 ? 100 : 0;

    return {
      comparison: {
        current: { totalSteps: currentTotalSteps, totalDuration: currentDuration, departmentHandoffs: currentHandoffs, approvalLayers },
        optimized: { totalSteps: Math.max(0, currentTotalSteps - stepsRemoved), totalDuration: optimizedDuration, departmentHandoffs: currentHandoffs, approvalLayers },
        improvements: { stepReduction: stepsRemoved, timeReduction, timeReductionPercent },
      },
      appliedChanges: selected.map((q) => ({
        changeDescription: q.suggestion,
        impact: q.estimatedTimeSaving ? `Saved ${q.estimatedTimeSaving}` : "N/A",
        performedBy: q.performedBy,
      })),
    };
  };

  const buildCriteriaFromQuickWins = (quickWins: DiagnosisQuickWin[], selections: Record<number, boolean>): string => {
    const selected = quickWins.filter((_, i) => selections[i]);
    const lines: string[] = [];
    selected.forEach((q) => {
      if (q.category === "Removal") {
        // Include stepId so the deterministic removal handler can match exactly by ID
        const idSuffix = q.stepId && q.stepId !== q.stepName ? ` (step ID: ${q.stepId})` : "";
        lines.push(`Remove "${q.stepName}"${idSuffix}`);
      } else if (q.category === "Consolidation" && q.steps && q.steps.length > 1 && q.consolidationSuggestion) {
        lines.push(`Merge steps "${q.steps.join('" and "')}" into a single step: "${q.consolidationSuggestion}". Keep the earliest step's position in the flow.`);
      } else {
        lines.push(q.suggestion);
      }
    });
    return lines.map((l) => `- ${l}`).join("\n");
  };

  // Handlers

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const maxSize = 10 * 1024 * 1024;
    const valid = acceptedFiles.filter((f) => {
      if (f.size > maxSize) { setError(`"${f.name}" is too large (max 10 MB).`); return false; }
      return true;
    });
    if (valid.length === 0) return;

    const existingKeys = new Set([
      ...stagedFiles.map((file) => `${file.name}:${file.size}`),
      ...storedDocuments.map((doc) => `${doc.name}:${doc.size}`),
    ]);
    const uniqueFiles = valid.filter((file) => !existingKeys.has(`${file.name}:${file.size}`));
    if (uniqueFiles.length === 0) {
      setError("These files have already been uploaded for this project.");
      return;
    }

    if (!user || !currentProject) {
      setError(t("uploadFirst"));
      return;
    }

    setSaveStatus("saving");
    try {
      const uploaded = await Promise.allSettled(
        uniqueFiles.map((file) => uploadDocumentToStorage(user.id, currentProject.id, file)),
      );

      const successfulUploads = uploaded
        .filter((result): result is PromiseFulfilledResult<StoredDocument> => result.status === "fulfilled")
        .map((result) => result.value);

      if (successfulUploads.length === 0) {
        setError("Failed to upload files. Please try again.");
        setSaveStatus("error");
        return;
      }

      const nextStoredDocuments = [...storedDocuments, ...successfulUploads];
      await updateProject(currentProject.id, { documents: nextStoredDocuments });
      setStoredDocuments(nextStoredDocuments);
      setStagedFiles((prev) => [...prev, ...uniqueFiles]);

      const failedCount = uploaded.length - successfulUploads.length;
      setError(failedCount > 0 ? `${failedCount} file(s) could not be uploaded.` : "");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload files");
      setSaveStatus("error");
    }
  }, [currentProject, stagedFiles, storedDocuments, user, t]);

  const removeStagedFile = (idx: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const readFileContent = async (file: File): Promise<string> => {
    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      return btoa(binaryString);
    }
    return file.text();
  };

  // Create a named process in the DB immediately (before uploads)
  const handleCreateProcess = async () => {
    if (!user || !newProcessName.trim()) return;
    setIsCreatingProcess(true);
    setError("");
    try {
      const proj = await createProject(user.id, newProcessName.trim(), null, []);
      setCurrentProject(proj);
      setUserProjects((prev) => [proj, ...prev]);
      setNewProcessName("");
      void router.replace(`/process-optimizer?projectId=${proj.id}`, undefined, { shallow: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create process");
    } finally {
      setIsCreatingProcess(false);
    }
  };

  // Run (or re-run) diagnosis.
  // isReRun=true  -> use ALL processedFiles + storedDocuments (via storage) + stagedFiles
  // isReRun=false -> use only stagedFiles, append to existing diagnosis
  const handleRunDiagnosis = async (isReRun = false) => {
    // When re-running after page reload, in-memory processedFiles may be empty —
    // download originals from Supabase Storage first.
    let inMemoryFiles = [...processedFiles];
    if (isReRun && inMemoryFiles.length === 0 && storedDocuments.length > 0 && user && currentProject) {
      const downloaded = await Promise.all(storedDocuments.map((d) => downloadDocumentFromStorage(d)));
      inMemoryFiles = downloaded.filter((f): f is File => f !== null);
    }

    let persistedFiles: File[] = [];
    if (!isReRun && stagedFiles.length === 0 && storedDocuments.length > 0 && user && currentProject) {
      const downloaded = await Promise.all(storedDocuments.map((d) => downloadDocumentFromStorage(d)));
      persistedFiles = downloaded.filter((f): f is File => f !== null);
    }

    const toProcess = isReRun
      ? [...inMemoryFiles, ...stagedFiles]
      : stagedFiles.length > 0
        ? [...stagedFiles]
        : persistedFiles;
    if (toProcess.length === 0) {
      setError("Please upload at least one document to run diagnosis.");
      return;
    }
    setError("");

    try {
      const allResults: ProcessWithDiagnosis[] = [];
      for (const file of toProcess) {
        const fileContent = await readFileContent(file);
        const result = await extractAndDiagnoseAllMutation.mutateAsync({
          fileContent,
          fileName: file.name,
          fileType: file.type,
        });
        if (result.success && result.processes) {
          allResults.push(...result.processes);
        } else if (!result.success) {
          setError(result.error ?? `Failed to process "${file.name}"`);
        }
      }

      if (allResults.length > 0) {
        const phases: Record<number, 1 | 2 | 3> = {};
        allResults.forEach((_, i) => { phases[i] = 1; });
        const newStoredDocs = [...storedDocuments];

        if (isReRun) {
          setAllProcesses(allResults);
          setProcessPhases(phases);
          setProcessOptimizations({});
          setProcessImpacts({});
          setProcessSops({});
          setProcessQuickWinSelections({});
          setProcessCriteria({});
          setSelectedProcessIdx(0);
          setStoredDocuments(newStoredDocs);
          if (currentProject) {
            void updateProject(currentProject.id, {
              processes: allResults, phases,
              optimizations: {}, sops: {}, impacts: {},
              quick_win_selections: {}, criteria: {},
              documents: newStoredDocs,
            });
          }
        } else {
          setStoredDocuments(newStoredDocs);
          setAllProcesses((prev) => {
            const merged = [...prev, ...allResults];
            const mergedPhases: Record<number, 1 | 2 | 3> = {};
            merged.forEach((_, i) => { mergedPhases[i] = processPhases[i] ?? 1; });
            setProcessPhases(mergedPhases);
            setSelectedProcessIdx(prev.length);
            if (currentProject) {
              void updateProject(currentProject.id, {
                processes: merged, phases: mergedPhases,
                documents: newStoredDocs,
              });
            }
            return merged;
          });
        }

        setProcessedFiles(toProcess);
        setStagedFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => { void onDrop(acceptedFiles); },
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    multiple: true,
  });

  const toggleQuickWin = (qIdx: number) => {
    setProcessQuickWinSelections((prev) => {
      const nextSelections = {
        ...prev,
        [selectedProcessIdx]: {
          ...(prev[selectedProcessIdx] ?? {}),
          [qIdx]: !(prev[selectedProcessIdx]?.[qIdx] ?? false),
        },
      };
      saveProject({ quick_win_selections: nextSelections });
      return nextSelections;
    });
  };

  const updateSelectedProcessPhase = (phase: 1 | 2 | 3) => {
    const newPhases = { ...processPhases, [selectedProcessIdx]: phase };
    setProcessPhases(newPhases);
    saveProject({ phases: newPhases });
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
        if (guidedCriteria) criteria = guidedCriteria + (criteria ? `\n${criteria}` : "");
      }
      const result = await optimizeForProcessMutation.mutateAsync({
        analysisJson: JSON.stringify(selectedProcess.analysis),
        optimizationCriteria: criteria,
      });
      if (result.success && result.results) {
        const newOptimizations = { ...processOptimizations, [selectedProcessIdx]: result.results };
        setProcessOptimizations(newOptimizations);
        const selected = quickWins.filter((_, i) => currentSelections[i]);
        const impact = simulateImpact(selected, selectedProcess.analysis);
        const newImpacts = { ...processImpacts, [selectedProcessIdx]: impact };
        setProcessImpacts(newImpacts);
        const newPhases = { ...processPhases, [selectedProcessIdx]: 2 as const };
        setProcessPhases(newPhases);
        saveProject({ optimizations: newOptimizations, impacts: newImpacts, phases: newPhases });
      } else {
        setError(result.error ?? "Failed to optimize process");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to optimize process");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSOP = async () => {
    if (!selectedProcess || !currentOptimization) return;
    try {
      setIsGeneratingSop(true);
      const selectedQuickWins = (selectedProcess.diagnosis.quickWins ?? []).filter((_, i) => currentSelections[i]);
      // Prefer the optimized process as the source of truth for content and metadata
      const optimizedProcess = currentOptimization.optimization?.optimizedProcess;
      const effectiveMetadata =
        optimizedProcess?.documentMetadata ?? selectedProcess.analysis.documentMetadata;
      const sop = await generateSopMutation.mutateAsync({
        originalContent: optimizedProcess
          ? JSON.stringify(optimizedProcess)
          : JSON.stringify(selectedProcess.analysis),
        processName: selectedProcess.analysis.processName,
        optimizedMermaid: currentOptimization.optimizedMermaid,
        appliedChanges: selectedQuickWins.map((qw) => ({
          changeDescription: qw.suggestion,
          impact: qw.estimatedTimeSaving ? `Saved ${qw.estimatedTimeSaving}` : undefined,
          affectedDepartment: undefined,
          performedBy: qw.performedBy,
        })),
        impactAnalysis: currentImpact ?? undefined,
        processId: effectiveMetadata?.processId,
        processOwner: effectiveMetadata?.processOwner,
        department: effectiveMetadata?.department,
        section: effectiveMetadata?.section,
        documentMetadata: effectiveMetadata,
        diagnosis: selectedProcess.diagnosis,
      });
      if (sop.success) {
        const newSops = { ...processSops, [selectedProcessIdx]: sop.markdown ?? "" };
        setProcessSops(newSops);
        const newPhases = { ...processPhases, [selectedProcessIdx]: 3 as const };
        setProcessPhases(newPhases);
        saveProject({ sops: newSops, phases: newPhases });
      } else {
        setError(sop.error ?? "Failed to generate SOP");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate SOP document");
    } finally {
      setIsGeneratingSop(false);
    }
  };

  // Batch run across multiple projects — runs diagnosis+optimization in parallel
  const handleBatchRun = async () => {
    if (!user) return;
    const selectedIds = selectedProjectIds;
    if (selectedIds.size === 0) return;
    setIsBatchRunning(true);
    setError("");
    setBatchProgress("Fetching latest project data…");

    // Always fetch fresh data from the DB so we don't miss processes diagnosed
    // during this session (in-memory state isn't synced back into userProjects).
    let freshProjects: Project[];
    try {
      freshProjects = await getUserProjects(user.id);
      // For the currently open project, prefer the richer in-memory allProcesses.
      freshProjects = freshProjects.map((p) =>
        p.id === currentProject?.id && allProcesses.length > 0
          ? { ...p, processes: allProcesses as unknown[] }
          : p,
      );
      setUserProjects(freshProjects);
    } catch {
      freshProjects = userProjects;
    }

    const projectsToRun = freshProjects.filter((p) => selectedIds.has(p.id));
    if (projectsToRun.length === 0) {
      setIsBatchRunning(false);
      setBatchProgress("");
      setSelectedProjectIds(new Set());
      return;
    }

    setBatchProgress(`Running ${projectsToRun.length} project(s) in parallel…`);

    // Process all selected projects in parallel.
    await Promise.allSettled(
      projectsToRun.map(async (proj) => {
        try {
          let processes = (proj.processes ?? []) as ProcessWithDiagnosis[];

          // ── Step 1: run diagnosis if the project has documents but no processes ──
          if (processes.length === 0 && (proj.documents ?? []).length > 0) {
            const downloaded = await Promise.all(
              proj.documents.map((d) => downloadDocumentFromStorage(d)),
            );
            const files = downloaded.filter((f): f is File => f !== null);
            const diagResults: ProcessWithDiagnosis[] = [];
            for (const file of files) {
              try {
                const fileContent = await readFileContent(file);
                const res = await extractAndDiagnoseAllMutation.mutateAsync({
                  fileContent,
                  fileName: file.name,
                  fileType: file.type,
                });
                if (res.success && res.processes) diagResults.push(...res.processes);
              } catch (err) {
                console.error(`Batch diagnosis failed for "${file.name}" in "${proj.name}":`, err);
              }
            }
            if (diagResults.length > 0) {
              processes = diagResults;
              const phases: Record<number, 1 | 2 | 3> = {};
              diagResults.forEach((_, i) => { phases[i] = 1; });
              await updateProject(proj.id, { processes: diagResults, phases });
              setUserProjects((prev) =>
                prev.map((p) => p.id === proj.id ? { ...p, processes: diagResults, phases } : p),
              );
            }
          }

          if (processes.length === 0) return; // nothing to optimize

          // ── Step 2: run optimization for any unoptimized processes ──────────
          const existing = proj.optimizations ?? {};
          const newOpts: Record<string, OptimizationResults> = Object.fromEntries(
            Object.entries(existing).map(([k, v]) => [k, v as OptimizationResults]),
          );

          await Promise.allSettled(
            processes.map(async (proc, i) => {
              if (!proc || existing[String(i)]) return;
              try {
                const result = await optimizeForProcessMutation.mutateAsync({
                  analysisJson: JSON.stringify(proc.analysis),
                  optimizationCriteria: "",
                });
                if (result.success && result.results) newOpts[String(i)] = result.results;
              } catch (err) {
                console.error(`Batch optimization failed for process ${i} in "${proj.name}":`, err);
              }
            }),
          );

          await updateProject(proj.id, { optimizations: newOpts });
          setUserProjects((prev) =>
            prev.map((p) => p.id === proj.id ? { ...p, optimizations: newOpts } : p),
          );
        } catch (err) {
          console.error(`Batch run failed for "${proj.name}":`, err);
        }
      }),
    );

    setIsBatchRunning(false);
    setBatchProgress("");
    setSelectedProjectIds(new Set());
  };

  // Render helpers

  const renderNavSidebar = () => (
    <div
      className="h-full w-72 flex-shrink-0 overflow-y-auto det-sidebar-border"
      style={{ background: "var(--sf-surface)", borderInlineEnd: "1px solid var(--sf-border)" }}
    >
      {/* DET logo block */}
      <div className="flex flex-col gap-2 border-b px-5 py-4" style={{ borderColor: "var(--sf-border)" }}>
        <Image
          src="/assets/dubai-det-flag-logo.svg"
          alt="Dubai Department of Economy and Tourism"
          width={140}
          height={48}
          className="h-12 w-auto"
          priority
        />
        <div className="mt-0.5">
          <div className="text-sm font-bold" style={{ color: "var(--sf-text)" }}>
            {lang === "ar" ? "منصة التميز التشغيلي" : "Process Excellence"}
          </div>
          {/* Language + theme toggles */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="det-lang-toggle"
              title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
            >
              {lang === "en" ? "العربية" : "English"}
            </button>
          </div>
        </div>
      </div>

      {saveStatus !== "idle" && (
        <div className="mx-3 mt-3 rounded-lg border px-2 py-1.5 text-xs" style={{
          background: saveStatus === "saving" ? "rgba(201,168,76,0.10)" : saveStatus === "saved" ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.08)",
          borderColor: saveStatus === "saving" ? "rgba(201,168,76,0.35)" : saveStatus === "saved" ? "rgba(5,150,105,0.35)" : "rgba(220,38,38,0.25)",
          color: saveStatus === "saving" ? "var(--det-gold)" : saveStatus === "saved" ? "#065f46" : "#dc2626",
        }}>
          {saveStatus === "saving" && t("saving")}
          {saveStatus === "saved" && t("saved")}
          {saveStatus === "error" && t("saveFailed")}
        </div>
      )}

      <nav className="px-3 pt-3">
        <Link href="/dashboard" className="det-nav-item">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {t("dashboard")}
        </Link>
      </nav>

      <div className="mt-3 flex flex-col">
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-faint)" }}>
            {t("processesCount")} ({userProjects.length})
          </span>
          {userProjects.length > 0 && (
            <button
              onClick={() => setSelectedProjectIds(selectedProjectIds.size === userProjects.length ? new Set() : new Set(userProjects.map((p) => p.id)))}
              className="text-[10px] transition hover:opacity-75"
              style={{ color: "var(--det-navy-light)" }}
            >
              {selectedProjectIds.size === userProjects.length ? t("deselectAll") : t("selectAll")}
            </button>
          )}
        </div>

        <div className="flex max-h-[48vh] flex-col gap-1 overflow-y-auto px-2">
          {userProjects.map((proj) => {
            const optCount = Object.keys(proj.optimizations ?? {}).length;
            const isActive = proj.id === currentProject?.id;
            const isChecked = selectedProjectIds.has(proj.id);
            return (
              <div
                key={proj.id}
                className="flex items-start gap-2 rounded-lg border px-2 py-2 transition"
                style={{
                  borderColor: isActive ? "var(--det-navy-light)" : "var(--sf-border)",
                  background: isActive ? "rgba(27,55,100,0.08)" : "var(--sf-surface)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setSelectedProjectIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(proj.id)) next.delete(proj.id);
                    else next.add(proj.id);
                    return next;
                  })}
                  className="mt-0.5 h-3 w-3 flex-shrink-0"
                  style={{ accentColor: "var(--det-navy)" }}
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => void router.push(`/process-optimizer?projectId=${proj.id}`)}>
                  <div className="truncate text-xs font-semibold leading-tight" style={{ color: "var(--sf-text)" }}>{proj.name}</div>
                  {optCount > 0 && (
                    <div className="mt-0.5 text-[10px]" style={{ color: "var(--sf-text-muted)" }}>
                      {optCount} optimised
                    </div>
                  )}
                </button>
              </div>
            );
          })}
          {userProjects.length === 0 && (
            <p className="px-2 py-2 text-[10px]" style={{ color: "var(--sf-text-faint)" }}>No processes yet</p>
          )}
        </div>

        {selectedProjectIds.size > 0 && (
          <div className="px-3 pt-2">
            <button
              onClick={() => void handleBatchRun()}
              disabled={isBatchRunning}
              className="sf-button-primary w-full rounded-lg py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBatchRunning ? batchProgress || `${t("run")}…` : `${t("run")} ${selectedProjectIds.size}`}
            </button>
          </div>
        )}

        <div className="px-2 pt-3" style={{ borderTop: "1px solid var(--sf-border)" }}>
          <Link href="/process-optimizer" className="det-nav-item">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("newProcess")}
          </Link>
        </div>
      </div>

      <div className="mt-3 border-t px-2 py-3" style={{ borderColor: "var(--sf-border)" }}>
        <button onClick={() => void signOut().then(() => router.replace("/"))}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition" style={{ color: "var(--sf-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sf-text-muted)")}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t("signOut")}
        </button>
        <div className="mt-2 truncate px-3 text-[10px]" style={{ color: "var(--sf-text-faint)" }}>{user?.email}</div>
      </div>
    </div>
  );

  const renderProcessPanel = () => {
    const hasDiagnosedDocuments = processedFiles.length > 0 || allProcesses.length > 0;
    const availableFileCount = stagedFiles.length > 0
      ? storedDocuments.length + stagedFiles.length
      : storedDocuments.length;

    return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Upload Area */}
      <div className="p-4" style={{ borderBottom: "1px solid var(--sf-border)" }}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>{t("uploadDocuments")}</h2>

        <div {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${isDragActive ? "" : ""} ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
          style={{
            borderColor: isDragActive ? "var(--det-navy-light)" : "var(--sf-border)",
            background: isDragActive ? "rgba(27,55,100,0.06)" : "transparent",
          }}>
          <input {...getInputProps()} />
          <svg className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--sf-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>{isDragActive ? "Drop files here\u2026" : t("dragDrop")}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--sf-text-faint)" }}>{t("fileHint")}</p>
        </div>

        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                {t("pending")} ({stagedFiles.length})
              </span>
              <button onClick={() => setStagedFiles([])} className="text-[10px] transition" style={{ color: "var(--sf-text-faint)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sf-text-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sf-text-faint)")}>
                {t("clearAll")}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {stagedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)" }}>
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--sf-text)" }}>{f.name}</span>
                  <span className="flex-shrink-0 text-[10px]" style={{ color: "var(--sf-text-faint)" }}>{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeStagedFile(i)} className="flex-shrink-0 transition" style={{ color: "var(--sf-text-faint)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sf-text-faint)")}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3">
              {hasDiagnosedDocuments ? (
                <button onClick={() => void handleRunDiagnosis(true)} disabled={isProcessing}
                  className="sf-button-primary w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t("reDiagnosing")}
                    </span>
                  ) : `${t("reDiagnosis")} (${availableFileCount})`}
                </button>
              ) : (
                <button onClick={() => void handleRunDiagnosis(false)} disabled={isProcessing}
                  className="sf-button-primary w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t("diagnosing")}
                    </span>
                  ) : `${t("runDiagnosis")} (${availableFileCount})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Persisted uploaded files + diagnosis action (when no new staged files) */}
        {(processedFiles.length > 0 || storedDocuments.length > 0) && stagedFiles.length === 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                {hasDiagnosedDocuments ? t("diagnosedLabel") : t("uploadedLabel")} ({processedFiles.length || storedDocuments.length})
              </span>
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {(processedFiles.length > 0 ? processedFiles.map((f) => ({ name: f.name })) : storedDocuments).map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(27,55,100,0.06)", border: "1px solid rgba(27,55,100,0.20)" }}>
                  <svg className="h-3 w-3 flex-shrink-0" style={{ color: "var(--det-navy-light)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--sf-text)" }}>{f.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => void handleRunDiagnosis(hasDiagnosedDocuments)} disabled={isProcessing}
              className="sf-button-primary w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {isProcessing ? (hasDiagnosedDocuments ? t("reDiagnosing") : t("diagnosing")) : (hasDiagnosedDocuments ? t("reDiagnosis") : t("runDiagnosis"))}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626" }}>
            {error}
          </div>
        )}
      </div>

      {/* Diagnosed Processes list */}
      {allProcesses.length > 0 && (
        <div className="flex flex-col">
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--sf-border)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              {allProcesses.length} Process{allProcesses.length !== 1 ? "es" : ""} Diagnosed
            </span>
          </div>
          {allProcesses.map((proc, idx) => {
            const isSelected = idx === selectedProcessIdx;
            const isOptimized = Boolean(processOptimizations[idx]);
            const classification = proc.diagnosis.automationClassification?.primaryClassification;
            const stepCount = proc.analysis.documentMetadata?.activitiesTableCount ?? proc.analysis.processSteps.length;
            return (
              <button key={idx} onClick={() => setSelectedProcessIdx(idx)}
                className="w-full px-4 py-3 text-left transition-colors"
                style={{
                  borderLeft: isSelected ? "3px solid var(--det-navy-light)" : "3px solid transparent",
                  background: isSelected ? "rgba(27,55,100,0.07)" : undefined,
                  borderBottom: "1px solid var(--sf-border)",
                }}>
                <p className="truncate text-sm font-medium" style={{ color: isSelected ? "var(--det-navy-light)" : "var(--sf-text)" }}>
                  {proc.analysis.processName}
                </p>
                {proc.analysis.documentMetadata?.processId && (
                  <p className="mt-0.5 truncate font-mono text-[10px]" style={{ color: "var(--sf-text-faint)" }}>{proc.analysis.documentMetadata.processId}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--sf-surface-alt)", color: "var(--sf-text-muted)" }}>{stepCount} steps</span>
                  {(() => {
                    const sc = proc.diagnosis.stepClassifications;
                    if (!sc || sc.length === 0) return null;
                    const counts: Partial<Record<string, number>> = {};
                    sc.forEach(s => { counts[s.classification] = (counts[s.classification] ?? 0) + 1; });
                    const styles: Record<string, { bg: string; color: string; dot: string }> = {
                      "AI Agent":            { bg: "#D1FAE5", color: "#065f46",  dot: "#10B981" },
                      "Classical RPA":       { bg: "#DBEAFE", color: "#1e40af",  dot: "#3B82F6" },
                      "Manual Optimization": { bg: "#FEF3C7", color: "#92400e",  dot: "#F59E0B" },
                      "As-Is":               { bg: "#F1F5F9", color: "#475569",  dot: "#94A3B8" },
                    };
                    return (["AI Agent", "Classical RPA", "Manual Optimization", "As-Is"] as const)
                      .filter(p => counts[p])
                      .map(p => {
                        const st = styles[p]!;
                        return (
                          <span key={p} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: st.bg, color: st.color }}>
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: st.dot }} />
                            {p} {counts[p]}
                          </span>
                        );
                      });
                  })()}
                  {isOptimized && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(27,55,100,0.12)", color: "var(--det-navy-mid)" }}>Optimised</span>}
                  {processSops[idx] && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(5,150,105,0.10)", color: "#065f46" }}>SOP Ready</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  };

  const renderPhaseNav = () => (
    <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--sf-surface)", borderBottom: "1px solid var(--sf-border)", boxShadow: "0 4px 12px rgba(28,79,122,0.06)" }}>
      <div className="flex items-center gap-5 text-sm">
        <button onClick={() => updateSelectedProcessPhase(1)}
          className="flex items-center gap-1.5 font-medium transition"
          style={{ color: currentPhase >= 1 ? "var(--det-navy-light)" : "var(--sf-text-faint)" }}>
          <span>1. {t("phase1")}</span>
          {currentPhase >= 1 && selectedProcess && <CheckCircleIcon className="h-4 w-4" style={{ color: "#059669" }} />}
        </button>
        <span style={{ color: "var(--sf-text-faint)" }}>{"\u2500\u2500\u25ba"}</span>
        <button onClick={() => { if (currentOptimization) updateSelectedProcessPhase(2); }}
          disabled={!currentOptimization}
          className="flex items-center gap-1.5 font-medium transition disabled:cursor-not-allowed"
          style={{ color: currentPhase >= 2 ? "var(--det-navy-light)" : "var(--sf-text-faint)" }}>
          <span>2. {t("phase2")}</span>
          {currentOptimization && <CheckCircleIcon className="h-4 w-4" style={{ color: "#059669" }} />}
        </button>
        <span style={{ color: "var(--sf-text-faint)" }}>{"\u2500\u2500\u25ba"}</span>
        <button onClick={() => { if (currentSop) updateSelectedProcessPhase(3); }}
          disabled={!currentSop}
          className="flex items-center gap-1.5 font-medium transition disabled:cursor-not-allowed"
          style={{ color: currentPhase >= 3 ? "var(--det-navy-light)" : "var(--sf-text-faint)" }}>
          <span>3. {t("phase3")}</span>
          {currentSop ? <CheckCircleIcon className="h-4 w-4" style={{ color: "#059669" }} /> : <LockClosedIcon className="h-4 w-4" style={{ color: "var(--sf-text-faint)" }} />}
        </button>
      </div>
      {selectedProcess && (
        <span className="mx-4 min-w-0 flex-1 truncate text-center text-xs" style={{ color: "var(--det-gold)" }}>
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
    const totalSteps = metadata?.activitiesTableCount ?? analysis.processSteps.length;
    const totalDuration = Object.values(analysis.leadTimes ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    const hasDiscrepancy = metadata?.stepCountDiscrepancy ?? false;

    return (
      <div className="p-5">
        <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--sf-text)" }}>{t("diagnosisReport")}</h3>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="det-card rounded-lg p-3">
            <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Process</div>
            <div className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>{analysis.processName}</div>
            {metadata?.processId && <div className="font-mono text-xs" style={{ color: "var(--sf-text-faint)" }}>{metadata.processId}</div>}
          </div>
          <div className="det-card rounded-lg p-3">
            <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Total Steps</div>
            <div className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
              {totalSteps}
              {metadata?.flowchartBoxCount !== undefined && metadata.flowchartBoxCount !== totalSteps && (
                <span className={`ml-1 text-xs ${hasDiscrepancy ? "text-amber-600" : ""}`} style={hasDiscrepancy ? undefined : { color: "var(--sf-text-faint)" }}>(Flowchart: {metadata.flowchartBoxCount})</span>
              )}
            </div>
            {hasDiscrepancy && <div className="text-xs text-amber-600">\u26a0\ufe0f Mismatch</div>}
          </div>
          <div className="det-card rounded-lg p-3">
            <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Duration (days)</div>
            <div className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>{totalDuration || "\u2014"}</div>
          </div>
          <div className="det-card rounded-lg p-3">
            <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Process Owner</div>
            <div className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>{metadata?.processOwner ?? "N/A"}</div>
            {metadata?.department && <div className="text-xs" style={{ color: "var(--sf-text-faint)" }}>{metadata.department}</div>}
          </div>
        </div>

        {(metadata?.kpis?.length ?? 0) > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>Process KPIs</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {metadata?.kpis?.map((kpi, i) => (
                <div key={i} className="det-card rounded-lg p-3">
                  <div className="text-sm font-medium" style={{ color: "var(--sf-text-muted)" }}>{kpi.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>Current Process Flow</h4>
          {currentMermaid.trim() ? (
            <div className="det-card rounded-lg p-4">
              <MermaidDiagram key={`diag-${selectedProcessIdx}`} chart={currentMermaid} id={`diag-${selectedProcessIdx}`} />
            </div>
          ) : (
            <div className="rounded-lg p-4 text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>No diagram data available for this process.</div>
          )}
        </div>

        {report.bottlenecks?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>Identified Bottlenecks</h4>
            <div className="space-y-2">
              {report.bottlenecks.map((b, i) => (
                <div key={i} className="rounded-lg p-3 text-sm" style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.20)" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold" style={{ color: "#dc2626" }}>{b.stepId}</span>
                    <span className="font-semibold" style={{ color: "var(--sf-text)" }}>{"\u2014"} {b.stepName}</span>
                  </div>
                  <div className="mt-1.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                    {b.reason}{" "}
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${b.impact === "High" ? "text-red-700" : b.impact === "Medium" ? "text-amber-700" : ""}`}
                      style={{ background: b.impact === "High" ? "#fee2e2" : b.impact === "Medium" ? "#fef3c7" : "var(--sf-surface-alt)", color: b.impact === "Low" ? "var(--sf-text-muted)" : undefined }}>
                      {b.impact} Impact
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--sf-text-faint)" }}>Utilization: {b.timingIssue.utilizationPercent}% ({b.timingIssue.actualTime} / {b.timingIssue.availableTime} days)</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-md mb-3 font-semibold" style={{ color: "var(--sf-text)" }}>
            Step-Level Optimization Classification
          </h4>
          {(() => {
            const stepClassifications: StepOptimizationClassification[] = report.stepClassifications ?? [];
            if (stepClassifications.length === 0) {
              return (
                <div className="rounded-lg p-3 text-sm" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)", color: "var(--sf-text-muted)" }}>
                  Step classifications are not available for this process. Re-run diagnosis to generate them.
                </div>
              );
            }
            const getConfig = (c: StepOptimizationClassification["classification"]) => {
              if (c === "AI Agent") return { bg: "#D1FAE5", color: "#065f46", bar: "#10B981", dot: "#059669" };
              if (c === "Classical RPA") return { bg: "#DBEAFE", color: "#1e40af", bar: "#3B82F6", dot: "#2563EB" };
              if (c === "As-Is") return { bg: "#F1F5F9", color: "#475569", bar: "#94A3B8", dot: "#64748b" };
              return { bg: "#FEF3C7", color: "#92400e", bar: "#F59E0B", dot: "#D97706" };
            };
            const counts: Record<StepOptimizationClassification["classification"], number> = { "AI Agent": 0, "Classical RPA": 0, "Manual Optimization": 0, "As-Is": 0 };
            stepClassifications.forEach((s) => { counts[s.classification] = (counts[s.classification] ?? 0) + 1; });

            const activeStep = stepClassifications.find((s) => s.stepId === selectedStepCardId) ?? null;
            const activeCfg = activeStep ? getConfig(activeStep.classification) : null;
            const activeRelatedQuickWins = activeStep ? (report.quickWins?.filter((q) => q.stepId === activeStep.stepId) ?? []) : [];
            const activeIsBottleneck = activeStep ? report.bottlenecks?.some((b) => b.stepId === activeStep.stepId) : false;

            const getClassificationRationale = (classification: StepOptimizationClassification["classification"]): { signals: string[] } => {
              if (classification === "AI Agent") return {
                signals: [
                  "Inputs are unstructured — documents, free-text, or context-dependent data that can't be processed by fixed rules",
                  "Decision-making requires contextual judgment, interpretation, or nuanced reasoning",
                  "Output quality depends on language understanding rather than deterministic logic",
                  "A rule-engine approach would require hundreds of branches and still miss edge cases",
                ],
              };
              if (classification === "Classical RPA") return {
                signals: [
                  "Step operates on structured, predictable data — forms, spreadsheets, or system fields",
                  "Logic follows deterministic, unchanging rules with no ambiguity or edge-case judgment",
                  "Actions are high-volume and repetitive, executed identically every time",
                  "Correct output is always derivable from input without interpretation",
                ],
              };
              if (classification === "As-Is") return {
                signals: [
                  "Step is already efficient — minimal waste, delay, or rework observed",
                  "Human oversight here adds genuine value that automation would degrade",
                  "Automation complexity would outweigh any time or quality gains",
                  "Low frequency or volume makes investment in change unwarranted",
                ],
              };
              return {
                signals: [
                  "Step has clear inefficiencies but human judgment or relationships are inherent to its purpose",
                  "Structured human interaction, approval, or accountability cannot be removed",
                  "Process redesign, better tooling, or templates can reduce effort without full automation",
                  "Automation is not yet viable; manual throughput can be substantially improved",
                ],
              };
            };

            const getAfterDescription = (classification: StepOptimizationClassification["classification"]): { action: string; outcome: string } => {
              if (classification === "AI Agent") return {
                action: "Deploy an AI agent to handle this step autonomously — processing unstructured inputs, applying contextual judgment, and generating outputs without manual intervention.",
                outcome: "Significant reduction in handling time, elimination of human error on judgment-heavy tasks, 24/7 availability, and consistent decision quality.",
              };
              if (classification === "Classical RPA") return {
                action: "Implement a software robot to execute this step — reading structured inputs from systems, applying fixed business rules, and writing outputs automatically.",
                outcome: "Near-zero manual effort, faster cycle time, full audit trail, and elimination of data-entry errors.",
              };
              if (classification === "As-Is") return {
                action: "No change required — this step is already well-designed and efficient.",
                outcome: "Retain as-is; no optimization or automation is warranted at this stage.",
              };
              return {
                action: "Redesign the step for efficiency — streamline the workflow, reduce approval layers, consolidate handoffs, and provide better tooling or templates to the human executor.",
                outcome: "Reduced elapsed time through process simplification, clearer ownership, and removal of unnecessary wait cycles.",
              };
            };

            const getBoilerplate = (step: StepOptimizationClassification): string => {
              const sn = step.stepName;
              const sid = step.stepId;

              if (step.classification === "AI Agent") {
                return `// AI Agent: ${sn} (${sid})
// Starter config — fill in TODOs before deploying

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_input",
    description: "Read and parse the step's input document or data",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Document path or system ref" },
      },
      required: ["source"],
    },
  },
  {
    name: "query_registry",
    description: "Retrieve entity data from the relevant registry or database",
    input_schema: {
      type: "object",
      properties: {
        entityId: { type: "string" },
        fields:   { type: "array", items: { type: "string" } },
      },
      required: ["entityId"],
    },
  },
  {
    name: "validate_rules",
    description: "Validate payload against configured business rules",
    input_schema: {
      type: "object",
      properties: {
        data:      { type: "object" },
        ruleSetId: { type: "string" },
      },
      required: ["data", "ruleSetId"],
    },
  },
  {
    name: "write_output",
    description: "Persist structured output to the target system",
    input_schema: {
      type: "object",
      properties: {
        target:  { type: "string" },
        payload: { type: "object" },
      },
      required: ["target", "payload"],
    },
  },
  {
    name: "notify_stakeholders",
    description: "Send notifications to relevant parties",
    input_schema: {
      type: "object",
      properties: {
        recipients: { type: "array", items: { type: "string" } },
        subject:    { type: "string" },
        body:       { type: "string" },
      },
      required: ["recipients", "subject", "body"],
    },
  },
];

const SYSTEM_PROMPT = \`
You are an autonomous AI agent for the "${sn}" step.
Process all inputs, apply business rules, and produce structured outputs.
Escalate to a human only when confidence is below 70% or an edge case arises.
Log every decision with a brief rationale.
\`;

async function runAgent(input: Record<string, unknown>) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: JSON.stringify(input, null, 2) },
  ];

  // Agentic loop
  while (true) {
    const res = await client.messages.create({
      model:      "claude-opus-4-8",
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") break;

    const toolResults = await Promise.all(
      res.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map(async (b) => ({
          type:        "tool_result" as const,
          tool_use_id: b.id,
          content:     JSON.stringify(await dispatchTool(b.name, b.input)),
        }))
    );
    messages.push({ role: "user", content: toolResults });
  }
  return messages;
}

async function dispatchTool(name: string, input: unknown): Promise<unknown> {
  // TODO: implement each handler against your real systems
  switch (name) {
    case "read_input":          return { status: "ok", data: {} };
    case "query_registry":      return { status: "ok", entity: {} };
    case "validate_rules":      return { valid: true, errors: [] };
    case "write_output":        return { success: true, recordId: "NEW_ID" };
    case "notify_stakeholders": return { sent: true };
    default: throw new Error(\`Unknown tool: \${name}\`);
  }
}`;
              }

              if (step.classification === "Classical RPA") {
                return `// Classical RPA Bot: ${sn} (${sid})
// Starter config — replace all CAPS placeholders before deploying

export const BOT_CONFIG = {
  name:            "${sid}_Bot",
  trigger:         "event-driven",   // "scheduled" | "event-driven" | "manual"
  schedule:         null,            // cron e.g. "0 8 * * 1-5" = weekdays at 08:00
  retryPolicy:     { maxAttempts: 3, backoffMs: 5_000 },
  auditLog:         true,
  notifyOnFailure: "PROCESS_OWNER_EMAIL",
};

export const WORKFLOW = [
  {
    id:     "open_app",
    action: "navigate",
    params: { url: "TARGET_SYSTEM_URL", waitForSelector: "#MAIN_CONTENT" },
  },
  {
    id:     "read_input",
    action: "extract_data",
    params: { source: "INPUT_QUEUE_OR_FORM", format: "structured_json" },
  },
  {
    id:     "validate",
    action: "apply_rules",
    params: {
      rules: [
        // TODO: replace with your actual field validations
        { field: "requestId",   required: true },
        { field: "requestDate", type: "date" },
        { field: "amount",      type: "number", min: 0 },
      ],
    },
  },
  {
    id:     "transform",
    action: "map_fields",
    params: {
      // TODO: map source fields to output fields (JSONPath notation)
      mapping: {
        "output.field1": "$.input.sourceField1",
        "output.field2": "$.input.sourceField2",
      },
    },
  },
  {
    id:     "write_output",
    action: "submit",
    params: {
      target:           "OUTPUT_SYSTEM_URL",
      createAuditEntry: true,
      attachScreenshot: true,
    },
  },
  {
    id:     "notify",
    action: "send_email",
    params: {
      template:   "completion_notification",
      recipients: ["STAKEHOLDER_EMAIL"],
    },
  },
  {
    id:         "on_error",
    action:     "escalate",
    runOnError: true,
    params: {
      escalateTo:        "PROCESS_OWNER_EMAIL",
      includeScreenshot: true,
    },
  },
];`;
              }

              if (step.classification === "Manual Optimization") {
                return `# SOP: ${sn}
# Process ID: ${sid}
# Version: 1.0  |  Status: DRAFT  |  Owner: [ROLE / TEAM]

---

## 1. Purpose
[One sentence — what this step achieves and why it matters in the overall process]

## 2. Trigger & Frequency
- **Triggered by:** [upstream step completion / system event / scheduled run]
- **Frequency:** [daily / per-request / weekly]
- **Target duration:** [X min]  ← optimised from current [Y min]

## 3. Prerequisites
Before starting, confirm all items:
- [ ] Input document / data available at [LOCATION / SYSTEM]
- [ ] Access to [SYSTEM NAME] confirmed
- [ ] Upstream step [PREV_STEP_ID] marked complete

## 4. Instructions

| # | Action | Decision / Rule | Expected Output |
|---|--------|-----------------|-----------------|
| 1 | Open [SYSTEM] and load the relevant record | — | Record displayed |
| 2 | Validate all required fields are present | Missing field → request re-submission | Validated record |
| 3 | Apply business logic: [describe rule] | If X → do Y, else do Z | Processed result |
| 4 | Record outcome / update status | — | Audit entry created |
| 5 | Notify the next step owner | — | Handoff confirmed |

## 5. Quality Checklist
- [ ] All mandatory fields completed and verified
- [ ] Data cross-checked against source system
- [ ] Required approvals obtained (if applicable)
- [ ] Downstream team / system notified
- [ ] Transaction logged in audit trail

## 6. Escalation Matrix

| Condition | Escalate To | Within |
|-----------|-------------|--------|
| Cannot complete in target time | [MANAGER ROLE] | [X hrs] |
| Data discrepancy found | [DATA OWNER] | Immediately |
| System unavailable | IT Helpdesk | 30 min |

## 7. KPIs to Track

| Metric | Current Baseline | Optimised Target |
|--------|-----------------|------------------|
| Cycle time | [X min] | [Y min] |
| Error / rework rate | [X%] | < [Y%] |
| First-pass yield | [X%] | > [Y%] |`;
              }

              // As-Is
              return `// As-Is: ${sn} (${sid})
// This step is already well-optimised — no automation change required.

/*
  Recommended actions:
  1. Formalise the current process as a reference SOP (see Manual template).
  2. Add lightweight monitoring to catch KPI drift early.
  3. Re-evaluate in the next optimisation cycle (quarterly recommended).
     Flag for automation if volume grows > 20% or error rate increases.
*/

export const MONITORING_CONFIG = {
  stepId:   "${sid}",
  stepName: "${sn}",
  kpis: [
    { metric: "cycle_time_minutes", alertIfAbove: 0  /* TODO: set baseline */ },
    { metric: "error_rate_percent", alertIfAbove: 0  /* TODO: set baseline */ },
    { metric: "daily_volume",       alertIfAbove: 0  /* TODO: set threshold */ },
  ],
  reviewCadence: "quarterly",
};`;
            };

            return (
              <>
                {/* Summary badges */}
                <div className="mb-4 flex flex-wrap gap-3">
                  {(["AI Agent", "Classical RPA", "Manual Optimization", "As-Is"] as const).map((pathway) => {
                    const cfg = getConfig(pathway);
                    const count = counts[pathway];
                    return (
                      <div key={pathway} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: cfg.bg, borderColor: cfg.bar + "55" }}>
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{pathway}</span>
                        <span className="rounded-full px-1.5 py-0.5 text-xs font-bold" style={{ background: "rgba(0,0,0,0.08)", color: cfg.color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Step cards grid — clicking opens a modal */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {stepClassifications.map((sc, i) => {
                    const cfg = getConfig(sc.classification);
                    const isActive = selectedStepCardId === sc.stepId;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setSelectedStepCardId(sc.stepId); setShowBoilerplate(false); }}
                        className="w-full rounded-lg border p-3 text-left transition-all hover:shadow-md"
                        style={{
                          background: isActive ? cfg.bg : "var(--sf-surface)",
                          borderColor: isActive ? cfg.bar : "var(--sf-border)",
                          cursor: "pointer",
                        }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block font-mono text-[10px] font-semibold" style={{ color: "var(--det-navy-light)" }}>{sc.stepId}</span>
                            <span className="block truncate text-xs font-semibold leading-tight" style={{ color: "var(--sf-text)" }} title={sc.stepName}>{sc.stepName}</span>
                          </div>
                          <span className="flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color }}>{sc.classification}</span>
                        </div>
                        <div className="mb-2">
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: "var(--sf-text-faint)" }}>Confidence</span>
                            <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{sc.confidenceScore}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sf-border)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${sc.confidenceScore}%`, background: cfg.bar }} />
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>{sc.reason}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Modal popup */}
                {activeStep && activeCfg && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                    onClick={() => { setSelectedStepCardId(null); setShowBoilerplate(false); }}
                  >
                    <div
                      className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
                      style={{ background: "var(--sf-surface)", border: `2px solid ${activeCfg.bar}55`, maxHeight: "85vh", overflowY: "auto" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal header */}
                      <div className="flex items-start justify-between gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--sf-border)", background: activeCfg.bg }}>
                        <div className="min-w-0">
                          <span className="block font-mono text-xs font-semibold" style={{ color: activeCfg.color }}>{activeStep.stepId}</span>
                          <span className="block text-base font-bold leading-snug" style={{ color: "var(--sf-text)" }}>{activeStep.stepName}</span>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: activeCfg.dot, color: "#fff" }}>{activeStep.classification}</span>
                          <button
                            onClick={() => { setSelectedStepCardId(null); setShowBoilerplate(false); }}
                            className="rounded-full p-1 transition hover:opacity-70"
                            style={{ color: "var(--sf-text-muted)" }}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="px-6 pt-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span style={{ color: "var(--sf-text-muted)" }}>Confidence score</span>
                          <span className="font-bold" style={{ color: activeCfg.color }}>{activeStep.confidenceScore}%</span>
                        </div>
                        <div className="mb-1 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sf-border)" }}>
                          <div className="h-full rounded-full" style={{ width: `${activeStep.confidenceScore}%`, background: activeCfg.bar }} />
                        </div>
                      </div>

                      {/* Classification Rationale */}
                      <div className="px-6 pb-4 pt-2">
                        <div
                          className="rounded-xl p-4"
                          style={{ background: activeCfg.bg, border: `1px solid ${activeCfg.bar}44` }}
                        >
                          <div className="mb-2.5 flex items-center gap-2">
                            <svg className="h-3.5 w-3.5 flex-shrink-0" style={{ color: activeCfg.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.344.346a3.001 3.001 0 00-.877 2.119V19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-.535c0-.795-.316-1.558-.877-2.12l-.344-.344z" />
                            </svg>
                            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: activeCfg.color }}>
                              Why {activeStep.classification}?
                            </span>
                          </div>
                          {activeStep.reason && (
                            <p className="mb-3 text-xs leading-relaxed font-medium" style={{ color: activeCfg.color }}>
                              {activeStep.reason}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {getClassificationRationale(activeStep.classification).signals.map((signal, si) => (
                              <div key={si} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: activeCfg.color, opacity: 0.85 }}>
                                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ background: activeCfg.bar }} />
                                {signal}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Before / After columns */}
                      <div className="grid grid-cols-1 gap-0 px-6 py-4 md:grid-cols-2 md:gap-6">
                        {/* BEFORE */}
                        <div className="pb-4 md:pb-0" style={{ borderBottom: "1px solid var(--sf-border)" }}>
                          <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(220,38,38,0.10)", color: "#dc2626" }}>Before</span>
                            <span className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>Current State</span>
                          </div>
                          <div className="space-y-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                            <div className="rounded-lg p-3" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)" }}>
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#dc2626" }}>How It Works Today</div>
                              <p className="text-xs leading-relaxed">{activeStep.currentStateDescription}</p>
                            </div>
                            {activeIsBottleneck && (
                              <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>
                                Identified as a bottleneck
                              </div>
                            )}
                            {activeRelatedQuickWins.length > 0 && (
                              <div>
                                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-faint)" }}>Quick wins flagged</div>
                                {activeRelatedQuickWins.map((qw, qi) => (
                                  <div key={qi} className="mb-1 rounded-lg px-3 py-1.5 text-xs" style={{ background: "rgba(201,168,76,0.12)", color: "var(--det-gold)" }}>{qw.suggestion}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AFTER */}
                        <div className="pt-4 md:pt-0">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: activeCfg.bg, color: activeCfg.color }}>After</span>
                            <span className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>Post-Implementation</span>
                          </div>
                          <div className="space-y-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                            {(() => {
                              const afterDesc = getAfterDescription(activeStep.classification);
                              return (
                                <>
                                  <div className="rounded-lg p-3" style={{ background: "var(--sf-surface-alt)", border: `1px solid ${showBoilerplate ? activeCfg.bar : "var(--sf-border)"}` }}>
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: activeCfg.color }}>Implementation</div>
                                      {(activeStep.classification === "AI Agent" || activeStep.classification === "Classical RPA") && (
                                        <button
                                          type="button"
                                          onClick={() => setShowBoilerplate(!showBoilerplate)}
                                          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80"
                                          style={{ background: activeCfg.bg, color: activeCfg.color, border: `1px solid ${activeCfg.bar}55` }}
                                        >
                                          {showBoilerplate ? (
                                            <>
                                              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                              Hide template
                                            </>
                                          ) : (
                                            <>
                                              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16M4 9h16M4 15h16" /></svg>
                                              Get starter code
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs leading-relaxed">{afterDesc.action}</p>
                                  </div>
                                  <div className="rounded-lg p-3" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)" }}>
                                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: activeCfg.color }}>Expected Outcome</div>
                                    <p className="text-xs leading-relaxed">{afterDesc.outcome}</p>
                                  </div>
                                  <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: activeCfg.bg, color: activeCfg.color }}>
                                    Pathway: {activeStep.classification}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Boilerplate panel — only for code-based pathways */}
                      {showBoilerplate && (activeStep.classification === "AI Agent" || activeStep.classification === "Classical RPA") && (
                        <div className="border-t px-6 pb-6 pt-4" style={{ borderColor: activeCfg.bar + "44" }}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: activeCfg.color }}>Starter Boilerplate</span>
                              <span className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold" style={{ background: activeCfg.bg, color: activeCfg.color }}>
                                typescript
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(getBoilerplate(activeStep)).then(() => {
                                  setBoilerplateCopied(true);
                                  setTimeout(() => setBoilerplateCopied(false), 2000);
                                });
                              }}
                              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                              style={{ background: activeCfg.bg, color: activeCfg.color, border: `1px solid ${activeCfg.bar}55` }}
                            >
                              {boilerplateCopied ? (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <pre
                            className="overflow-auto rounded-xl p-4 font-mono text-xs leading-relaxed"
                            style={{ background: "#0f172a", color: "#e2e8f0", maxHeight: "360px", tabSize: 2 }}
                          >
                            <code>{getBoilerplate(activeStep)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="mb-6">
          <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>
            Quick Win Opportunities
            {quickWins.length > 0 && <span className="ml-2 text-sm font-normal" style={{ color: "var(--sf-text-faint)" }}>{"\u2014"} select items below then click &quot;Apply Optimizations&quot;</span>}
          </h4>
          {quickWins.length === 0 ? (
            <div className="rounded-lg p-3 text-sm" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)", color: "var(--sf-text-muted)" }}>No quick wins identified.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)" }}>
              <table className="text-left text-sm">
                <thead className="text-xs" style={{ background: "var(--sf-surface-alt)", color: "var(--sf-text-muted)" }}>
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
                <tbody style={{ color: "var(--sf-text)" }}>
                  {quickWins.map((q, qi) => (
                    <tr key={qi} className="transition-colors" style={{ borderBottom: "1px solid var(--sf-border)" }}>
                      <td className="px-3 py-3">
                        <input type="checkbox" style={{ accentColor: "var(--det-navy)" }} checked={Boolean(currentSelections[qi])} onChange={() => toggleQuickWin(qi)} />
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: "var(--sf-text)" }}>{q.suggestion}</td>
                      <td className="px-3 py-3"><span className="font-mono text-xs font-semibold" style={{ color: "var(--det-navy-light)" }}>{q.stepId}</span></td>
                      <td className="px-3 py-3 text-sm" style={{ color: "var(--sf-text)" }}>{q.stepName}</td>
                      <td className="px-3 py-3"><span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(27,55,100,0.10)", color: "var(--det-navy-mid)" }}>{q.performedBy ?? "\u2014"}</span></td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs" style={{ color: "var(--sf-text-muted)" }}>{q.effort}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: q.impact === "High" ? "#fee2e2" : q.impact === "Medium" ? "#fef3c7" : "var(--sf-surface-alt)", color: q.impact === "High" ? "#dc2626" : q.impact === "Medium" ? "#d97706" : "var(--sf-text-muted)" }}>
                          {q.impact}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "var(--sf-text-muted)" }}>{q.estimatedTimeSaving}</td>
                      <td className="px-3 py-3 text-xs" style={{ color: "var(--sf-text-muted)" }}>{q.category}</td>
                      <td className="px-3 py-3">
                        {q.bestPractice?.trim() ? (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(5,150,105,0.10)", color: "#065f46" }}>{q.bestPractice}</span>
                        ) : <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>{"\u2014"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <details className="mb-4">
          <summary className="cursor-pointer text-xs" style={{ color: "var(--det-navy-light)" }}>Show diagnosis JSON (debug)</summary>
          <div className="mt-2 rounded-lg p-2" style={{ background: "var(--sf-surface-alt)", border: "1px solid var(--sf-border)" }}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => void copyToClipboard(JSON.stringify(selectedProcess.diagnosis, undefined, 2))}
                className="rounded border px-2 py-1 text-xs transition" style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}>Copy</button>
            </div>
            <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre-wrap" style={{ color: "var(--sf-text-muted)" }}>{JSON.stringify(selectedProcess.diagnosis, undefined, 2)}</pre>
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
      <div className="p-5" style={{ borderTop: "1px solid var(--sf-border)", background: "var(--sf-surface-alt)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-md font-semibold" style={{ color: "var(--sf-text)" }}>
            Run Optimization for: <span className="font-normal" style={{ color: "var(--det-navy-light)" }}>{selectedProcess.analysis.processName}</span>
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <button className="rounded-l border px-3 py-1 text-xs transition"
              style={guidedMode ? { background: "var(--det-navy)", color: "#fff", borderColor: "var(--det-navy)" } : { color: "var(--sf-text-muted)", background: "var(--sf-surface)", borderColor: "var(--sf-border)" }}
              onClick={() => setGuidedMode(true)}>{t("guided")}</button>
            <button className="rounded-r border px-3 py-1 text-xs transition"
              style={!guidedMode ? { background: "var(--det-navy)", color: "#fff", borderColor: "var(--det-navy)" } : { color: "var(--sf-text-muted)", background: "var(--sf-surface)", borderColor: "var(--sf-border)" }}
              onClick={() => setGuidedMode(false)}>{t("custom")}</button>
          </div>
        </div>

        {guidedMode && (
          <p className="mb-3 text-xs" style={{ color: "var(--sf-text-muted)" }}>
            {hasSelections ? `${Object.values(currentSelections).filter(Boolean).length} quick win(s) selected above will be applied.` : "Select quick wins from the table above to apply them."}
          </p>
        )}

        {!guidedMode && (
          <>
            <textarea value={currentCriteria}
              onChange={(e) => {
                const nextCriteria = { ...processCriteria, [selectedProcessIdx]: e.target.value };
                setProcessCriteria(nextCriteria);
                saveProject({ criteria: nextCriteria });
              }}
              placeholder="Custom optimization instructions. Be specific and surgical."
              className="w-full rounded-lg border p-3 text-sm focus:outline-none"
              style={{ background: "var(--sf-surface)", borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--det-navy-light)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              rows={5} />
            <div className="mt-1 text-xs" style={{ color: "var(--sf-text-faint)" }}>
              Example: <code>Remove &quot;Manual Review&quot;</code> or <code>Merge &quot;Validate Request&quot; and &quot;Verify Details&quot;</code>
            </div>
          </>
        )}

        <div className="mt-4">
          <button onClick={handleOptimizeProcess}
            disabled={isGenerating || (guidedMode && !hasSelections) || (!guidedMode && currentCriteria.trim().length === 0)}
            className="sf-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            {isGenerating ? t("optimizing") : t("applyOptimizations")}
          </button>
        </div>
      </div>
    );
  };

  const renderOptimizationResults = () => {
    if (!currentOptimization) return null;
    return (
      <div className="p-5">
        <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--sf-text)" }}>{t("optimizationResults")}</h3>
        <div className="mb-8 flex flex-col gap-8">
          <div>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>As-Is</h4>
            <div className="det-card rounded-lg p-4">
              <MermaidDiagram chart={currentOptimization.currentMermaid} id={`opt-current-${selectedProcessIdx}`} />
            </div>
          </div>
          <div>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>To-Be</h4>
            <div className="det-card rounded-lg p-4">
              <MermaidDiagram chart={currentOptimization.optimizedMermaid} id={`opt-optimized-${selectedProcessIdx}`} />
            </div>
          </div>
        </div>
        {currentImpact && (
          <div className="mb-6 rounded-xl p-4" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)" }}>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "var(--sf-text)" }}>Optimization Impact</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "rgba(27,55,100,0.06)", border: "1px solid rgba(27,55,100,0.20)" }}>
                <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Time Saved</div>
                <div className="text-base font-semibold" style={{ color: "var(--sf-text)" }}>
                  {currentImpact.comparison.improvements.timeReduction} days ({currentImpact.comparison.improvements.timeReductionPercent}%)
                </div>
              </div>
              <div className="det-card rounded-lg p-3">
                <div className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Steps</div>
                <div className="text-base font-semibold" style={{ color: "var(--sf-text)" }}>
                  {currentImpact.comparison.current.totalSteps} {"\u2192"} {currentImpact.comparison.optimized.totalSteps}
                </div>
              </div>
            </div>
            {currentImpact.appliedChanges.length > 0 && (
              <div className="mt-4">
                <h5 className="mb-1 text-sm font-semibold" style={{ color: "var(--sf-text)" }}>Applied Changes</h5>
                <ul className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                  {currentImpact.appliedChanges.map((c, i) => (
                    <li key={i} className="ml-4 list-disc">
                      <CheckCircleIcon className="mr-1 inline h-3 w-3" style={{ color: "#059669" }} />
                      {c.changeDescription}{c.impact ? ` - ${c.impact}` : ""}{c.performedBy ? ` | ${c.performedBy}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <button onClick={handleGenerateSOP} disabled={isGeneratingSop}
          className="sf-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
          {isGeneratingSop ? t("generatingSop") : t("generateSop")}
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
            <h2 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>{t("updatedSop")}</h2>
            <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>{selectedProcess?.analysis.processName}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => updateSelectedProcessPhase(2)}
              className="rounded-xl border px-4 py-2 text-sm transition" style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}>{t("back")}</button>
            <button onClick={() => void copyToClipboard(currentSop)}
              className="rounded-xl border px-4 py-2 text-sm transition" style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}>{t("copy")}</button>
            <a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(currentSop)}`} download="updated-sop.md"
              className="sf-button-primary rounded-xl px-4 py-2 text-sm font-semibold">{t("download")}</a>
          </div>
        </div>
        <div className="prose prose-sm max-w-none rounded-xl p-8" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            h1: ({ ...props }) => <h1 className="mb-4 text-3xl font-bold" style={{ color: "var(--sf-text)" }} {...props} />,
            h2: ({ ...props }) => <h2 className="mt-6 mb-3 text-2xl font-semibold" style={{ color: "var(--sf-text)" }} {...props} />,
            h3: ({ ...props }) => <h3 className="mt-4 mb-2 text-xl font-semibold" style={{ color: "var(--sf-text)" }} {...props} />,
            p: ({ ...props }) => <p className="mb-3 leading-relaxed" style={{ color: "var(--sf-text-muted)" }} {...props} />,
            ul: ({ ...props }) => <ul className="mb-4 ml-6 list-disc space-y-1" style={{ color: "var(--sf-text-muted)" }} {...props} />,
            ol: ({ ...props }) => <ol className="mb-4 ml-6 list-decimal space-y-1" style={{ color: "var(--sf-text-muted)" }} {...props} />,
            li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
            table: ({ ...props }) => <div className="my-4 overflow-x-auto"><table className="min-w-full divide-y" style={{ borderColor: "var(--sf-border)" }} {...props} /></div>,
            thead: ({ ...props }) => <thead style={{ background: "var(--sf-surface-alt)" }} {...props} />,
            th: ({ ...props }) => <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: "var(--sf-text-muted)" }} {...props} />,
            td: ({ ...props }) => <td className="border px-4 py-2 text-sm" style={{ color: "var(--sf-text-muted)", borderColor: "var(--sf-border)" }} {...props} />,
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) return <code className="rounded px-1.5 py-0.5 font-mono text-sm" style={{ background: "rgba(27,55,100,0.08)", color: "var(--det-navy-light)" }} {...props}>{children}</code>;
              const match = /language-(\w+)/.exec(className ?? "");
              if (match?.[1] === "mermaid") {
                const chartContent = Array.isArray(children) ? children.join("") : typeof children === "string" ? children : "";
                return <div className="my-4"><MermaidDiagram chart={chartContent.replace(/\n$/, "")} /></div>;
              }
              return <pre className="my-4 overflow-x-auto rounded p-4" style={{ background: "var(--sf-surface-alt)" }}><code className={className} {...props}>{children}</code></pre>;
            },
            blockquote: ({ ...props }) => <blockquote className="my-4 border-l-4 pl-4 italic" style={{ borderColor: "var(--det-navy-light)", color: "var(--sf-text-muted)" }} {...props} />,
            hr: ({ ...props }) => <hr className="my-6" style={{ borderColor: "var(--sf-border)" }} {...props} />,
          }}>
            {currentSop}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  // Main render

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sf-bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--det-navy-light)" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Process Excellence Platform | DET</title>
        <meta name="description" content="AI-Powered Process Optimization — Department of Economy and Tourism" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen overflow-hidden" style={{ background: "var(--sf-bg)" }}>
        {/* Left nav sidebar */}
        {renderNavSidebar()}

        {/* Process list panel - only shown when a project is active */}
        {projectId && (
          <div className="h-full w-80 flex-shrink-0 overflow-y-auto" style={{ background: "var(--sf-surface)", borderRight: "1px solid var(--sf-border)" }}>
            {renderProcessPanel()}
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-x-hidden">
          {projectLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--det-navy-light)" }} />
                <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>{t("loadingProcess")}</p>
              </div>
            </div>
          ) : !projectId ? (
            // Create new process form
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="w-full max-w-md">
                <div className="mb-6 text-center">
                  <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(27,55,100,0.10)" }}>
                    <svg className="h-7 w-7" style={{ color: "var(--det-navy-light)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>{t("createNewProcess")}</h1>
                  <p className="mt-1 text-sm" style={{ color: "var(--sf-text-muted)" }}>{t("createNewProcessSub")}</p>
                </div>

                <div className="rounded-2xl p-6" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--sf-text)" }}>{t("processNameLabel")}</label>
                  <input
                    type="text"
                    value={newProcessName}
                    onChange={(e) => setNewProcessName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleCreateProcess(); }}
                    placeholder={t("processNamePlaceholder")}
                    className="mb-4 w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
                    style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)", background: "var(--sf-surface)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--det-navy-light)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                    autoFocus
                  />
                  {error && (
                    <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626" }}>{error}</div>
                  )}
                  <button
                    onClick={() => void handleCreateProcess()}
                    disabled={isCreatingProcess || !newProcessName.trim()}
                    className="sf-button-primary w-full rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
                   {isCreatingProcess ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {t("creating")}
                      </span>
                    ) : t("createProcess")}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedProcess ? (
            <>
              {renderPhaseNav()}
              <div className="flex-1 overflow-y-auto">
                {currentPhase === 3 ? renderSopPhase() : (
                  <>
                    {currentPhase === 1 && <>{renderDiagnosis()}{renderOptimizationControls()}</>}
                    {currentPhase === 2 && <>{renderOptimizationResults()}{!currentOptimization && renderOptimizationControls()}</>}
                    {isGenerating && (
                      <div className="p-8 text-center">
                        <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--det-navy-light)" }}></div>
                        <p style={{ color: "var(--sf-text-muted)" }}>{t("applyingOpts")}</p>
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
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--det-navy-light)" }}></div>
                    <p style={{ color: "var(--sf-text-muted)" }}>{t("diagnosingDocs")}</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--sf-text-faint)" }}>{t("aiExtracting")}</p>
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed p-8" style={{ borderColor: "var(--sf-border)" }}>
                    <svg className="mx-auto mb-4 h-12 w-12" style={{ color: "var(--sf-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p style={{ color: "var(--sf-text-muted)" }}>{t("uploadAndDiagnose")}</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--sf-text-faint)" }}>{isRTL ? t("useRightPanel") : t("useLeftPanel")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && !projectId && null /* error shown inline for create form */}
      {error && projectId && (
        <div className="fixed right-4 top-4 max-w-sm rounded-xl px-4 py-3"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <p className="text-sm">{error}</p>
          <button onClick={() => setError("")} className="mt-1 text-xs opacity-70 underline hover:opacity-100">Dismiss</button>
        </div>
      )}
    </>
  );
}
