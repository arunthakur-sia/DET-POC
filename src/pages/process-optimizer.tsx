import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
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
    // Reset file state so files from a previous project don't bleed into this one
    setStagedFiles([]);
    setProcessedFiles([]);
    setStoredDocuments([]);
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
          setStoredDocuments(proj.documents as StoredDocument[]);
        }
      })
      .catch(console.error)
      .finally(() => setProjectLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isBusy = isProcessing || isGenerating;

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
    const currentTotalSteps = proc.processSteps.length;
    const currentDuration = Object.values(proc.leadTimes ?? {}).reduce((a, b) => a + (b ?? 0), 0);
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
        const step = proc.processSteps.find((s) => s.id === q.stepId);
        if (step) { stepsRemoved += 1; timeSaved += proc.leadTimes?.[step.id] ?? 0; }
      } else if (q.category === "Consolidation") {
        stepsRemoved += 1; timeSaved += parseTimeSaving(q.estimatedTimeSaving);
      } else if (q.category === "Parallelization") {
        const step = proc.processSteps.find((s) => s.id === q.stepId);
        timeSaved += (step ? (proc.leadTimes?.[step.id] ?? 0) : 0) * 0.5;
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
        lines.push(`Remove "${q.stepName}"`);
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
      setError("Create or open a project before uploading files.");
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
  }, [currentProject, stagedFiles, storedDocuments, user]);

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
    onDrop,
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
      const sop = await generateSopMutation.mutateAsync({
        originalContent: JSON.stringify(selectedProcess.analysis),
        processName: selectedProcess.analysis.processName,
        optimizedMermaid: currentOptimization.optimizedMermaid,
        appliedChanges: selectedQuickWins.map((qw) => ({
          changeDescription: qw.suggestion,
          impact: qw.estimatedTimeSaving ? `Saved ${qw.estimatedTimeSaving}` : undefined,
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

  // Batch run across multiple projects
  const handleBatchRun = async () => {
    const projectsToRun = userProjects.filter((p) => selectedProjectIds.has(p.id));
    if (projectsToRun.length === 0) return;
    setIsBatchRunning(true);
    setError("");
    let firstProjectId: string | null = null;

    for (const proj of projectsToRun) {
      const processes = (proj.processes ?? []) as ProcessWithDiagnosis[];
      if (processes.length === 0) continue;
      const existing = (proj.optimizations ?? {}) as Record<string, unknown>;
      const newOpts: Record<string, OptimizationResults> = Object.fromEntries(
        Object.entries(existing).map(([k, v]) => [k, v as OptimizationResults]),
      );
      for (let i = 0; i < processes.length; i++) {
        const proc = processes[i];
        if (!proc || existing[String(i)]) continue;
        setBatchProgress(`"${proj.name}" \u2014 process ${i + 1}/${processes.length}`);
        try {
          const result = await optimizeForProcessMutation.mutateAsync({
            analysisJson: JSON.stringify(proc.analysis),
            optimizationCriteria: "",
          });
          if (result.success && result.results) newOpts[String(i)] = result.results;
        } catch (err) {
          console.error(`Batch: failed process ${i} in "${proj.name}":`, err);
        }
      }
      await updateProject(proj.id, { optimizations: newOpts });
      setUserProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, optimizations: newOpts } : p)));
      if (!firstProjectId) firstProjectId = proj.id;
    }

    setIsBatchRunning(false);
    setBatchProgress("");
    setSelectedProjectIds(new Set());
    if (firstProjectId) void router.push(`/process-optimizer?projectId=${firstProjectId}`);
  };

  // Render helpers

  const renderNavSidebar = () => (
    <div className="h-full w-72 flex-shrink-0 overflow-y-auto border-r" style={{ background: "#f8fbff", borderColor: "var(--sf-border)" }}>
      <div className="flex flex-col gap-3 border-b px-5 py-5" style={{ borderColor: "var(--sf-border)" }}>
        <div className="rounded-3xl border px-4 py-4" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fcff 100%)", borderColor: "#cfe0f2", boxShadow: "0 10px 24px rgba(28, 79, 122, 0.1)" }}>
          <div className="flex items-center justify-center">
            <Image
              src="/assets/dubai-det-flag-logo.svg"
              alt="Dubai Department of Economy and Tourism"
              width={188}
              height={60}
              className="h-14 w-auto max-w-[190px]"
              priority
            />
          </div>
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide" style={{ color: "#16324a" }}>SmartFlow AI</div>
          <div className="mt-0.5 text-xs" style={{ color: "#5f7a92" }}>Process Excellence Platform</div>
        </div>
      </div>

      {saveStatus !== "idle" && (
        <div className="mx-3 mt-3 rounded border px-2 py-1 text-xs" style={{
          background: saveStatus === "saving" ? "#fff7e8" : saveStatus === "saved" ? "#ecfdf5" : "#fef2f2",
          borderColor: saveStatus === "saving" ? "#fcd34d" : saveStatus === "saved" ? "#6ee7b7" : "#fca5a5",
          color: saveStatus === "saving" ? "#92400e" : saveStatus === "saved" ? "#065f46" : "#b91c1c",
        }}>
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
        </div>
      )}

      <nav className="px-3 pt-3">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-sky-50" style={{ color: "#36526b" }}>
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Dashboard
        </Link>
      </nav>

      <div className="mt-3 flex flex-col">
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#7c97ad" }}>
            Processes ({userProjects.length})
          </span>
          {userProjects.length > 0 && (
            <button
              onClick={() => setSelectedProjectIds(selectedProjectIds.size === userProjects.length ? new Set() : new Set(userProjects.map((p) => p.id)))}
              className="text-[10px] transition hover:opacity-75"
              style={{ color: "#2e9fda" }}
            >
              {selectedProjectIds.size === userProjects.length ? "Deselect All" : "Select All"}
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
                className="flex items-start gap-2 rounded-lg border px-2 py-2 transition hover:bg-sky-50"
                style={{
                  borderColor: isActive ? "#7ad2ff" : "#d7e5f5",
                  background: isActive ? "#eef8ff" : "#ffffff",
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
                  className="mt-0.5 h-3 w-3 flex-shrink-0 accent-cyan-500"
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => void router.push(`/process-optimizer?projectId=${proj.id}`)}>
                  <div className="truncate text-xs font-semibold leading-tight" style={{ color: "#1f3f5b" }}>{proj.name}</div>
                  {optCount > 0 && (
                    <div className="mt-0.5 text-[10px]" style={{ color: "#6d88a0" }}>
                      {optCount} optimised
                    </div>
                  )}
                </button>
              </div>
            );
          })}
          {userProjects.length === 0 && (
            <p className="px-2 py-2 text-[10px]" style={{ color: "#7c97ad" }}>No processes yet</p>
          )}
        </div>

        {selectedProjectIds.size > 0 && (
          <div className="px-3 pt-2">
            <button
              onClick={() => void handleBatchRun()}
              disabled={isBatchRunning}
              className="sf-button-primary w-full rounded-lg py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBatchRunning ? batchProgress || "Running..." : `Run ${selectedProjectIds.size} Process${selectedProjectIds.size > 1 ? "es" : ""}`}
            </button>
          </div>
        )}

        <div className="px-2 pt-3" style={{ borderTop: "1px solid var(--sf-border)" }}>
          <Link href="/process-optimizer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-sky-50" style={{ color: "#36526b" }}>
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Process
          </Link>
        </div>
      </div>

      <div className="mt-3 border-t px-2 py-3" style={{ borderColor: "var(--sf-border)" }}>
        <button onClick={() => void signOut().then(() => router.replace("/"))}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-sky-50" style={{ color: "#5f7a92" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
        <div className="mt-2 truncate px-3 text-[10px]" style={{ color: "#90a8bb" }}>{user?.email}</div>
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
      <div className="p-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>Upload Documents</h2>

        <div {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${isDragActive ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-400 hover:bg-slate-50"} ${isProcessing ? "pointer-events-none opacity-60" : ""}`}>
          <input {...getInputProps()} />
          <svg className="mx-auto mb-2 h-6 w-6" style={{ color: "#CBD5E1" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs" style={{ color: "#64748B" }}>{isDragActive ? "Drop files here\u2026" : "Drag & drop or click"}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "#94A3B8" }}>PDF or TXT | multiple files | max 10 MB each</p>
        </div>

        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                Pending ({stagedFiles.length})
              </span>
              <button onClick={() => setStagedFiles([])} className="text-[10px] transition" style={{ color: "#94A3B8" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}>
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {stagedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-slate-50">
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "#334155" }}>{f.name}</span>
                  <span className="flex-shrink-0 text-[10px]" style={{ color: "#94A3B8" }}>{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeStagedFile(i)} className="flex-shrink-0 transition" style={{ color: "#CBD5E1" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#CBD5E1")}>
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
                  className="w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "#00DECC", color: "#0a151e" }}>
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Re-diagnosing\u2026
                    </span>
                  ) : `Re-run Diagnosis (${availableFileCount} files)`}
                </button>
              ) : (
                <button onClick={() => void handleRunDiagnosis(false)} disabled={isProcessing}
                  className="w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "#00DECC", color: "#0a151e" }}>
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Diagnosing\u2026
                    </span>
                  ) : `Run Diagnosis (${availableFileCount} file${availableFileCount !== 1 ? "s" : ""})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Persisted uploaded files + diagnosis action (when no new staged files) */}
        {(processedFiles.length > 0 || storedDocuments.length > 0) && stagedFiles.length === 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                {hasDiagnosedDocuments ? "Diagnosed" : "Uploaded"} ({processedFiles.length || storedDocuments.length})
              </span>
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {(processedFiles.length > 0 ? processedFiles.map((f) => ({ name: f.name })) : storedDocuments).map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(0,222,204,0.06)", border: "1px solid rgba(0,222,204,0.2)" }}>
                  <svg className="h-3 w-3 flex-shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "#334155" }}>{f.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => void handleRunDiagnosis(hasDiagnosedDocuments)} disabled={isProcessing}
              className="w-full rounded-xl py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "#F0FDF9", border: "1px solid #99F6E4", color: "#0D9488" }}>
              {isProcessing ? (hasDiagnosedDocuments ? "Re-diagnosing\u2026" : "Diagnosing\u2026") : (hasDiagnosedDocuments ? "Re-run Diagnosis" : "Run Diagnosis")}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
            {error}
          </div>
        )}
      </div>

      {/* Diagnosed Processes list */}
      {allProcesses.length > 0 && (
        <div className="flex flex-col">
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
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
                className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? "border-l-2 border-teal-500" : "border-l-2 border-transparent hover:bg-slate-50"}`}
                style={{ background: isSelected ? "rgba(0,222,204,0.08)" : undefined, borderBottom: "1px solid #F1F5F9" }}>
                <p className={`truncate text-sm font-medium ${isSelected ? "text-teal-600" : ""}`} style={isSelected ? undefined : { color: "#334155" }}>
                  {proc.analysis.processName}
                </p>
                {proc.analysis.documentMetadata?.processId && (
                  <p className="mt-0.5 truncate font-mono text-[10px]" style={{ color: "#94A3B8" }}>{proc.analysis.documentMetadata.processId}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "#F1F5F9", color: "#475569" }}>{stepCount} steps</span>
                  {classification && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,222,204,0.15)", color: "#00DECC" }}>{classification}</span>
                  )}
                  {isOptimized && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "#EDE9FE", color: "#6D28D9" }}>Optimised</span>}
                  {processSops[idx] && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "#D1FAE5", color: "#065F46" }}>SOP Ready</span>}
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
    <div className="flex items-center justify-between px-5 py-3" style={{ background: "#FFFFFF", borderBottom: "1px solid var(--sf-border)", boxShadow: "0 6px 16px rgba(28, 79, 122, 0.05)" }}>
      <div className="flex items-center gap-5 text-sm">
        <button onClick={() => updateSelectedProcessPhase(1)}
          className={`flex items-center gap-1.5 ${currentPhase >= 1 ? "text-teal-600 font-medium" : ""}`}
          style={currentPhase >= 1 ? undefined : { color: "#94A3B8" }}>
          <span>1. Diagnose</span>
          {currentPhase >= 1 && selectedProcess && <CheckCircleIcon className="h-4 w-4 text-emerald-500" />}
        </button>
        <span style={{ color: "#CBD5E1" }}>{"\u2500\u2500\u25ba"}</span>
        <button onClick={() => { if (currentOptimization) updateSelectedProcessPhase(2); }}
          disabled={!currentOptimization}
          className={`flex items-center gap-1.5 ${currentPhase >= 2 ? "text-teal-600 font-medium" : ""} disabled:cursor-not-allowed`}
          style={currentPhase >= 2 ? undefined : { color: "#94A3B8" }}>
          <span>2. Optimize</span>
          {currentOptimization && <CheckCircleIcon className="h-4 w-4 text-emerald-500" />}
        </button>
        <span style={{ color: "#CBD5E1" }}>{"\u2500\u2500\u25ba"}</span>
        <button onClick={() => { if (currentSop) updateSelectedProcessPhase(3); }}
          disabled={!currentSop}
          className={`flex items-center gap-1.5 ${currentPhase >= 3 ? "text-teal-600 font-medium" : ""} disabled:cursor-not-allowed`}
          style={currentPhase >= 3 ? undefined : { color: "#94A3B8" }}>
          <span>3. Generate SOP</span>
          {currentSop ? <CheckCircleIcon className="h-4 w-4 text-emerald-500" /> : <LockClosedIcon className="h-4 w-4" style={{ color: "#CBD5E1" }} />}
        </button>
      </div>
      {selectedProcess && (
        <span className="truncate text-xs" style={{ color: "#94A3B8" }}>{selectedProcess.analysis.processName}</span>
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
    const classification = report.automationClassification;
    const classificationTone = classification.primaryClassification === "AI Agent" ? "text-emerald-700" : classification.primaryClassification === "Classical RPA" ? "text-blue-700" : "text-amber-700";
    const classificationBg = classification.primaryClassification === "AI Agent" ? "#D1FAE5" : classification.primaryClassification === "Classical RPA" ? "#DBEAFE" : "#FEF3C7";
    const hybridLabels = [
      classification.hybridFlags.aiAgent ? "AI Agent" : undefined,
      classification.hybridFlags.classicalRpa ? "Classical RPA" : undefined,
      classification.hybridFlags.manualOptimization ? "Manual Optimization" : undefined,
    ].filter((v): v is string => Boolean(v));

    return (
      <div className="p-5">
        <h3 className="mb-4 text-lg font-semibold" style={{ color: "#1E293B" }}>Process Diagnosis Report</h3>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            <div className="text-xs" style={{ color: "#64748B" }}>Process</div>
            <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{analysis.processName}</div>
            {metadata?.processId && <div className="font-mono text-xs" style={{ color: "#94A3B8" }}>{metadata.processId}</div>}
          </div>
          <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            <div className="text-xs" style={{ color: "#64748B" }}>Total Steps</div>
            <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>
              {totalSteps}
              {metadata?.flowchartBoxCount !== undefined && metadata.flowchartBoxCount !== totalSteps && (
                <span className={`ml-1 text-xs ${hasDiscrepancy ? "text-amber-600" : ""}`} style={hasDiscrepancy ? undefined : { color: "#94A3B8" }}>(Flowchart: {metadata.flowchartBoxCount})</span>
              )}
            </div>
            {hasDiscrepancy && <div className="text-xs text-amber-600">\u26a0\ufe0f Mismatch</div>}
          </div>
          <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            <div className="text-xs" style={{ color: "#64748B" }}>Duration (days)</div>
            <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{totalDuration || "\u2014"}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            <div className="text-xs" style={{ color: "#64748B" }}>Process Owner</div>
            <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{metadata?.processOwner ?? "N/A"}</div>
            {metadata?.department && <div className="text-xs" style={{ color: "#94A3B8" }}>{metadata.department}</div>}
          </div>
        </div>

        <div className="mb-6 rounded border p-4" style={{ background: "#F0FDF9", borderColor: "#99F6E4" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="text-md font-semibold" style={{ color: "#1E293B" }}>Automation Pathway Classification</h4>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${classificationTone}`} style={{ background: classificationBg }}>{classification.primaryClassification}</span>
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: "#F1F5F9", color: "#475569" }}>Confidence: {classification.confidenceScore}%</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded" style={{ background: "#E2E8F0" }}>
            <div className="h-full rounded" style={{ background: "#00DECC", width: `${classification.confidenceScore}%` }} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <div className="text-xs" style={{ color: "#64748B" }}>AI Agent Score</div>
              <div className="text-base font-semibold" style={{ color: "#1E293B" }}>{classification.pathwayScores.aiAgent}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <div className="text-xs" style={{ color: "#64748B" }}>Classical RPA Score</div>
              <div className="text-base font-semibold" style={{ color: "#1E293B" }}>{classification.pathwayScores.classicalRpa}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <div className="text-xs" style={{ color: "#64748B" }}>Manual Optimization Score</div>
              <div className="text-base font-semibold" style={{ color: "#1E293B" }}>{classification.pathwayScores.manualOptimization}</div>
            </div>
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>Hybrid Flags</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {hybridLabels.length > 0 ? hybridLabels.map((label) => (
              <span key={label} className="rounded px-2 py-1 text-xs font-medium" style={{ background: "#F1F5F9", color: "#475569" }}>{label}</span>
            )) : <span className="text-sm" style={{ color: "#94A3B8" }}>No hybrid pathways flagged.</span>}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>Key Factors</div>
            {classification.keyFactors.length > 0 ? (
              <ul className="space-y-1 text-sm" style={{ color: "#475569" }}>
                {classification.keyFactors.map((factor, i) => <li key={i} className="ml-4 list-disc">{factor}</li>)}
              </ul>
            ) : <p className="text-sm" style={{ color: "#94A3B8" }}>No key factors provided.</p>}
          </div>
        </div>

        {(metadata?.kpis?.length ?? 0) > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>Process KPIs</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {metadata?.kpis?.map((kpi, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <div className="text-sm font-medium" style={{ color: "#475569" }}>{kpi.name}</div>
                  <div className="text-base font-semibold" style={{ color: "#00BFAD" }}>{kpi.target}</div>
                  {kpi.formula && <div className="text-xs" style={{ color: "#94A3B8" }}>Formula: {kpi.formula}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>Current Process Flow</h4>
          {currentMermaid.trim() ? (
            <div className="rounded-lg p-4" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <MermaidDiagram key={`diag-${selectedProcessIdx}`} chart={currentMermaid} id={`diag-${selectedProcessIdx}`} />
            </div>
          ) : (
            <div className="rounded-lg p-4 text-sm" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>No diagram data available for this process.</div>
          )}
        </div>

        {report.bottlenecks?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>Identified Bottlenecks</h4>
            <div className="space-y-2">
              {report.bottlenecks.map((b, i) => (
                <div key={i} className="rounded-lg p-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold" style={{ color: "#DC2626" }}>{b.stepId}</span>
                    <span className="font-semibold" style={{ color: "#1E293B" }}>{"\u2014"} {b.stepName}</span>
                  </div>
                  <div className="mt-1.5 text-sm" style={{ color: "#475569" }}>
                    {b.reason}{" "}
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${b.impact === "High" ? "text-red-700" : b.impact === "Medium" ? "text-amber-700" : ""}`}
                      style={{ background: b.impact === "High" ? "#FEE2E2" : b.impact === "Medium" ? "#FEF3C7" : "#F1F5F9", color: b.impact === "Low" ? "#64748B" : undefined }}>
                      {b.impact} Impact
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "#64748B" }}>Utilization: {b.timingIssue.utilizationPercent}% ({b.timingIssue.actualTime} / {b.timingIssue.availableTime} days)</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>
            Quick Win Opportunities
            {quickWins.length > 0 && <span className="ml-2 text-sm font-normal" style={{ color: "#94A3B8" }}>{"\u2014"} select items below then click &quot;Apply Optimizations&quot;</span>}
          </h4>
          {quickWins.length === 0 ? (
            <div className="rounded-lg p-3 text-sm" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#64748B" }}>No quick wins identified.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <table className="text-left text-sm">
                <thead className="text-xs" style={{ background: "#F8FAFC", color: "#64748B" }}>
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
                <tbody className="divide-y divide-slate-100" style={{ color: "#334155" }}>
                  {quickWins.map((q, qi) => (
                    <tr key={qi} className="transition-colors hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <input type="checkbox" className="h-4 w-4 accent-teal-500" checked={Boolean(currentSelections[qi])} onChange={() => toggleQuickWin(qi)} />
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: "#1E293B" }}>{q.suggestion}</td>
                      <td className="px-3 py-3"><span className="font-mono text-xs font-semibold" style={{ color: "#00BFAD" }}>{q.stepId}</span></td>
                      <td className="px-3 py-3 text-sm" style={{ color: "#334155" }}>{q.stepName}</td>
                      <td className="px-3 py-3"><span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>{q.performedBy ?? "\u2014"}</span></td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs" style={{ color: "#64748B" }}>{q.effort}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: q.impact === "High" ? "#FEE2E2" : q.impact === "Medium" ? "#FEF3C7" : "#F1F5F9", color: q.impact === "High" ? "#DC2626" : q.impact === "Medium" ? "#D97706" : "#64748B" }}>
                          {q.impact}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#64748B" }}>{q.estimatedTimeSaving}</td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#64748B" }}>{q.category}</td>
                      <td className="px-3 py-3">
                        {q.bestPractice?.trim() ? (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#D1FAE5", color: "#065F46" }}>{q.bestPractice}</span>
                        ) : <span className="text-xs" style={{ color: "#CBD5E1" }}>{"\u2014"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <details className="mb-4">
          <summary className="cursor-pointer text-xs text-cyan-600 hover:text-cyan-800">Show diagnosis JSON (debug)</summary>
          <div className="mt-2 rounded-lg p-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => void copyToClipboard(JSON.stringify(selectedProcess.diagnosis, undefined, 2))}
                className="rounded border px-2 py-1 text-xs transition hover:bg-slate-100" style={{ borderColor: "#E2E8F0", color: "#64748B" }}>Copy</button>
            </div>
            <pre className="max-h-80 overflow-auto text-[11px] whitespace-pre-wrap" style={{ color: "#475569" }}>{JSON.stringify(selectedProcess.diagnosis, undefined, 2)}</pre>
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
      <div className="p-5" style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-md font-semibold" style={{ color: "#1E293B" }}>
            Run Optimization for: <span className="font-normal" style={{ color: "#00BFAD" }}>{selectedProcess.analysis.processName}</span>
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <button className={`rounded-l border px-3 py-1 text-xs ${guidedMode ? "text-[#0a151e] border-[#00DECC]" : "border-slate-300"}`}
              style={guidedMode ? { background: "#00DECC" } : { color: "#64748B", background: "#FFFFFF" }} onClick={() => setGuidedMode(true)}>Guided</button>
            <button className={`rounded-r border px-3 py-1 text-xs ${!guidedMode ? "text-[#0a151e] border-[#00DECC]" : "border-slate-300"}`}
              style={!guidedMode ? { background: "#00DECC" } : { color: "#64748B", background: "#FFFFFF" }} onClick={() => setGuidedMode(false)}>Custom</button>
          </div>
        </div>

        {guidedMode && (
          <p className="mb-3 text-xs" style={{ color: "#64748B" }}>
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
              className="w-full rounded-lg border p-3 text-sm focus:outline-none" style={{ background: "#FFFFFF", borderColor: "#CBD5E1", color: "#1E293B" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00DECC")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
              rows={5} />
            <div className="mt-1 text-xs" style={{ color: "#94A3B8" }}>
              Example: <code>Remove &quot;Manual Review&quot;</code> or <code>Merge &quot;Validate Request&quot; and &quot;Verify Details&quot;</code>
            </div>
          </>
        )}

        <div className="mt-4">
          <button onClick={handleOptimizeProcess}
            disabled={isGenerating || (guidedMode && !hasSelections) || (!guidedMode && currentCriteria.trim().length === 0)}
            className="sf-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            {isGenerating ? "Optimizing\u2026" : "Apply Optimizations"}
          </button>
        </div>
      </div>
    );
  };

  const renderOptimizationResults = () => {
    if (!currentOptimization) return null;
    return (
      <div className="p-5">
        <h3 className="mb-3 text-lg font-semibold" style={{ color: "#1E293B" }}>Optimization Results</h3>
        <div className="mb-8 flex flex-col gap-8">
          <div>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>As-Is</h4>
            <div className="rounded-lg p-4" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <MermaidDiagram chart={currentOptimization.currentMermaid} id={`opt-current-${selectedProcessIdx}`} />
            </div>
          </div>
          <div>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>To-Be</h4>
            <div className="rounded-lg p-4" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <MermaidDiagram chart={currentOptimization.optimizedMermaid} id={`opt-optimized-${selectedProcessIdx}`} />
            </div>
          </div>
        </div>
        {currentImpact && (
          <div className="mb-6 rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            <h4 className="text-md mb-2 font-semibold" style={{ color: "#1E293B" }}>Optimization Impact</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "#F0FDF9", border: "1px solid #99F6E4" }}>
                <div className="text-xs" style={{ color: "#64748B" }}>Time Saved</div>
                <div className="text-base font-semibold" style={{ color: "#1E293B" }}>
                  {currentImpact.comparison.improvements.timeReduction} days ({currentImpact.comparison.improvements.timeReductionPercent}%)
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="text-xs" style={{ color: "#64748B" }}>Steps</div>
                <div className="text-base font-semibold" style={{ color: "#1E293B" }}>
                  {currentImpact.comparison.current.totalSteps} {"\u2192"} {currentImpact.comparison.optimized.totalSteps}
                </div>
              </div>
            </div>
            {currentImpact.appliedChanges.length > 0 && (
              <div className="mt-4">
                <h5 className="mb-1 text-sm font-semibold" style={{ color: "#1E293B" }}>Applied Changes</h5>
                <ul className="text-sm" style={{ color: "#475569" }}>
                  {currentImpact.appliedChanges.map((c, i) => (
                    <li key={i} className="ml-4 list-disc">
                      <CheckCircleIcon className="mr-1 inline h-3 w-3 text-emerald-500" />
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
          {isGeneratingSop ? "Generating SOP\u2026" : "Generate Updated SOP"}
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
            <h2 className="text-2xl font-bold" style={{ color: "#1E293B" }}>Updated SOP Document</h2>
            <p className="text-sm" style={{ color: "#64748B" }}>{selectedProcess?.analysis.processName}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => updateSelectedProcessPhase(2)}
              className="rounded-xl border px-4 py-2 text-sm transition hover:bg-slate-100" style={{ borderColor: "#E2E8F0", color: "#475569" }}>{"\u2190"} Back</button>
            <button onClick={() => void copyToClipboard(currentSop)}
              className="rounded-xl border px-4 py-2 text-sm transition hover:bg-slate-100" style={{ borderColor: "#E2E8F0", color: "#475569" }}>Copy</button>
            <a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(currentSop)}`} download="updated-sop.md"
              className="sf-button-primary rounded-xl px-4 py-2 text-sm font-semibold">Download</a>
          </div>
        </div>
        <div className="prose prose-sm max-w-none rounded-xl p-8" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            h1: ({ ...props }) => <h1 className="mb-4 text-3xl font-bold" style={{ color: "#1E293B" }} {...props} />,
            h2: ({ ...props }) => <h2 className="mt-6 mb-3 text-2xl font-semibold" style={{ color: "#1E293B" }} {...props} />,
            h3: ({ ...props }) => <h3 className="mt-4 mb-2 text-xl font-semibold" style={{ color: "#1E293B" }} {...props} />,
            p: ({ ...props }) => <p className="mb-3 leading-relaxed" style={{ color: "#475569" }} {...props} />,
            ul: ({ ...props }) => <ul className="mb-4 ml-6 list-disc space-y-1" style={{ color: "#475569" }} {...props} />,
            ol: ({ ...props }) => <ol className="mb-4 ml-6 list-decimal space-y-1" style={{ color: "#475569" }} {...props} />,
            li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
            table: ({ ...props }) => <div className="my-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200" {...props} /></div>,
            thead: ({ ...props }) => <thead style={{ background: "#F8FAFC" }} {...props} />,
            th: ({ ...props }) => <th className="px-4 py-2 text-left text-sm font-semibold" style={{ color: "#64748B" }} {...props} />,
            td: ({ ...props }) => <td className="border border-slate-200 px-4 py-2 text-sm" style={{ color: "#475569" }} {...props} />,
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) return <code className="rounded px-1.5 py-0.5 font-mono text-sm" style={{ background: "rgba(0,222,204,0.1)", color: "#00BFAD" }} {...props}>{children}</code>;
              const match = /language-(\w+)/.exec(className ?? "");
              if (match?.[1] === "mermaid") {
                const chartContent = Array.isArray(children) ? children.join("") : typeof children === "string" ? children : "";
                return <div className="my-4"><MermaidDiagram chart={chartContent.replace(/\n$/, "")} /></div>;
              }
              return <pre className="my-4 overflow-x-auto rounded bg-gray-50 p-4"><code className={className} {...props}>{children}</code></pre>;
            },
            blockquote: ({ ...props }) => <blockquote className="my-4 border-l-4 border-cyan-500 pl-4 italic" style={{ color: "#475569" }} {...props} />,
            hr: ({ ...props }) => <hr className="my-6 border-gray-300" {...props} />,
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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>SmartFlow</title>
        <meta name="description" content="AI-Powered Multi-Process Optimization Tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen overflow-hidden" style={{ background: "var(--sf-bg)" }}>
        {/* Left nav sidebar */}
        {renderNavSidebar()}

        {/* Process list panel - only shown when a project is active */}
        {projectId && (
          <div className="h-full w-80 flex-shrink-0 overflow-y-auto" style={{ background: "#ffffff", borderRight: "1px solid var(--sf-border)" }}>
            {renderProcessPanel()}
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-x-hidden">
          {projectLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }} />
                <p className="text-sm" style={{ color: "#64748B" }}>Loading process\u2026</p>
              </div>
            </div>
          ) : !projectId ? (
            // Create new process form
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="w-full max-w-md">
                <div className="mb-6 text-center">
                  <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(0,222,204,0.12)" }}>
                    <svg className="h-7 w-7" style={{ color: "#00DECC" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold" style={{ color: "#1E293B" }}>Create New Process</h1>
                  <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Give your process a name to get started</p>
                </div>

                <div className="rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "#334155" }}>Process Name</label>
                  <input
                    type="text"
                    value={newProcessName}
                    onChange={(e) => setNewProcessName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleCreateProcess(); }}
                    placeholder="e.g. Vendor Onboarding, License Renewal\u2026"
                    className="mb-4 w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
                    style={{ borderColor: "#E2E8F0", color: "#1E293B" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#00DECC")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
                    autoFocus
                  />
                  {error && (
                    <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>{error}</div>
                  )}
                  <button
                    onClick={() => void handleCreateProcess()}
                    disabled={isCreatingProcess || !newProcessName.trim()}
                    className="w-full rounded-xl py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: "#00DECC", color: "#0a151e" }}>
                    {isCreatingProcess ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating\u2026
                      </span>
                    ) : "Create Process"}
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
                        <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }}></div>
                        <p style={{ color: "#64748B" }}>Applying optimizations\u2026</p>
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
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }}></div>
                    <p style={{ color: "#475569" }}>Diagnosing documents\u2026</p>
                    <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>AI is extracting and diagnosing all processes</p>
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed p-8" style={{ borderColor: "#E2E8F0" }}>
                    <svg className="mx-auto mb-4 h-12 w-12" style={{ color: "#CBD5E1" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p style={{ color: "#64748B" }}>Upload documents and run diagnosis to get started</p>
                    <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>Use the panel on the left to upload files</p>
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
          style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <p className="text-sm">{error}</p>
          <button onClick={() => setError("")} className="mt-1 text-xs opacity-70 underline hover:opacity-100">Dismiss</button>
        </div>
      )}
    </>
  );
}
