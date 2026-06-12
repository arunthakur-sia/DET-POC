import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserProjects, updateProject, type Project } from "@/lib/supabase";
import type {
  ProcessWithDiagnosis,
  AutomationPathway,
} from "@/server/services/ProcessOptimizer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseToHours(text: string | undefined): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const dayMatch = /(\d+(?:\.\d+)?)\s*(?:working\s+)?day/.exec(lower);
  const hourMatch = /(\d+(?:\.\d+)?)\s*hour/.exec(lower);
  const minMatch = /(\d+(?:\.\d+)?)\s*min/.exec(lower);
  if (dayMatch?.[1]) return parseFloat(dayMatch[1]) * 8;
  if (hourMatch?.[1]) return parseFloat(hourMatch[1]);
  if (minMatch?.[1]) return parseFloat(minMatch[1]) / 60;
  return 0;
}

function potentialHours(proc: ProcessWithDiagnosis): number {
  return (proc.diagnosis?.quickWins ?? []).reduce(
    (s, qw) => s + parseToHours(qw.estimatedTimeSaving),
    0,
  );
}

function getComplexityScore(proc: ProcessWithDiagnosis): number {
  const handoffs = proc.diagnosis?.processMetrics?.departmentHandoffs ?? 0;
  const approvals = proc.diagnosis?.processMetrics?.approvalLayers ?? 0;
  const steps = (proc.analysis?.processSteps ?? []).length;
  return handoffs * 2 + approvals * 2 + Math.floor(steps / 5);
}

function getComplexityTier(score: number): "Low" | "Medium" | "High" {
  if (score >= 8) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function getDepartment(proc: ProcessWithDiagnosis): string {
  return proc.analysis?.documentMetadata?.department ?? proc.analysis?.departments?.[0] ?? "—";
}

function getOwner(proc: ProcessWithDiagnosis): string {
  return (
    proc.analysis?.documentMetadata?.processOwner ??
    proc.analysis?.processOwners?.[0]?.role ??
    "—"
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PATHWAYS: AutomationPathway[] = [
  "AI Agent",
  "Classical RPA",
  "Manual Optimization",
  "As-Is",
];

const PATHWAY_COLORS: Record<
  AutomationPathway,
  { stroke: string; bg: string; text: string }
> = {
  "AI Agent": { stroke: "#1b3764", bg: "rgba(27,55,100,0.09)", text: "#1b3764" },
  "Classical RPA": { stroke: "#1a9e8f", bg: "rgba(26,158,143,0.09)", text: "#0d7a6e" },
  "Manual Optimization": {
    stroke: "#c9a84c",
    bg: "rgba(201,168,76,0.12)",
    text: "#8a6b18",
  },
  "As-Is": { stroke: "#64748b", bg: "rgba(100,116,139,0.08)", text: "#475569" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatProcess {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 flex-shrink-0 text-xs" style={{ color: "var(--sf-text-muted)" }}>
        {label}
      </span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--sf-border)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(score, 100)}%`, background: color }}
        />
      </div>
      <span className="w-7 text-right text-xs font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ─── Process Card ─────────────────────────────────────────────────────────────

function ProcessCard({
  fp,
  onOverride,
}: {
  fp: FlatProcess;
  onOverride: (fp: FlatProcess, newPathway: AutomationPathway) => Promise<void>;
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [saving, setSaving] = useState(false);

  const proc = fp.process;
  const pathway =
    proc.diagnosis?.automationClassification?.primaryClassification ?? "Manual Optimization";
  const cfg = PATHWAY_COLORS[pathway];
  const scores = proc.diagnosis?.automationClassification?.pathwayScores;
  const keyFactors = proc.diagnosis?.automationClassification?.keyFactors ?? [];
  const hours = potentialHours(proc);
  const complexityScore = getComplexityScore(proc);
  const complexity = getComplexityTier(complexityScore);
  const dept = getDepartment(proc);
  const owner = getOwner(proc);

  const complexityColor =
    complexity === "High" ? "#dc2626" : complexity === "Medium" ? "#d97706" : "#16a34a";

  const handleOverrideSelect = async (newPathway: AutomationPathway) => {
    if (newPathway === pathway) {
      setShowOverride(false);
      return;
    }
    setSaving(true);
    try {
      await onOverride(fp, newPathway);
    } finally {
      setSaving(false);
      setShowOverride(false);
    }
  };

  return (
    <div
      className="flex flex-col rounded-2xl"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
    >
      {/* Accent bar */}
      <div
        className="h-0.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${cfg.stroke} 0%, var(--det-gold) 100%)` }}
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/process-optimizer?projectId=${fp.projectId}`}
              className="block truncate text-base font-bold hover:underline"
              style={{ color: "var(--sf-text)" }}
            >
              {proc.analysis?.processName ?? "Unnamed Process"}
            </Link>
            <p className="mt-0.5 text-xs truncate" style={{ color: "var(--sf-text-faint)" }}>
              {fp.projectName}
            </p>
          </div>
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: cfg.bg, color: cfg.text }}
          >
            {pathway}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>
          {dept !== "—" && (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {dept}
            </span>
          )}
          {owner !== "—" && (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {owner}
            </span>
          )}
          <span
            className="flex items-center gap-1 font-semibold"
            style={{ color: complexityColor }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {complexity} complexity (score: {complexityScore})
          </span>
        </div>

        {/* Rationale: key factors */}
        {keyFactors.length > 0 && (
          <div>
            <p
              className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--sf-text-muted)" }}
            >
              Classification rationale
            </p>
            <ul className="space-y-1">
              {keyFactors.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--sf-text)" }}>
                  <span className="mt-0.5 flex-shrink-0 text-base leading-none" style={{ color: cfg.stroke }}>
                    ·
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pathway scores */}
        {scores && (
          <div className="space-y-1.5">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--sf-text-muted)" }}
            >
              Pathway scores
            </p>
            <ScoreBar label="AI Agent" score={scores.aiAgent} color="#1b3764" />
            <ScoreBar label="Classical RPA" score={scores.classicalRpa} color="#1a9e8f" />
            <ScoreBar label="Manual Optim." score={scores.manualOptimization} color="#c9a84c" />
          </div>
        )}

        {/* Estimated saving */}
        <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(26,158,143,0.07)", border: "1px solid rgba(26,158,143,0.12)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
            Potential time saving
          </span>
          <span className="text-sm font-bold" style={{ color: "var(--det-teal)" }}>
            {hours > 0 ? `${Math.round(hours)} hrs` : "—"}
          </span>
        </div>

        {/* Override control */}
        <div className="relative">
          {showOverride ? (
            <div
              className="rounded-xl p-3"
              style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border)" }}
            >
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--sf-text)" }}>
                Re-classify as:
              </p>
              <div className="flex flex-col gap-1.5">
                {ALL_PATHWAYS.map((pw) => {
                  const c = PATHWAY_COLORS[pw];
                  const isCurrent = pw === pathway;
                  return (
                    <button
                      key={pw}
                      onClick={() => void handleOverrideSelect(pw)}
                      disabled={saving || isCurrent}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all"
                      style={{
                        background: isCurrent ? c.bg : "transparent",
                        color: c.text,
                        border: `1px solid ${isCurrent ? c.stroke : "transparent"}`,
                        opacity: isCurrent ? 1 : 0.8,
                        cursor: isCurrent ? "default" : "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent)
                          (e.currentTarget as HTMLButtonElement).style.background = c.bg;
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent)
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ background: c.stroke }}
                      />
                      {pw}
                      {isCurrent && (
                        <span className="ml-auto text-xs opacity-60">(current)</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowOverride(false)}
                className="mt-2 text-xs underline"
                style={{ color: "var(--sf-text-faint)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowOverride(true)}
              className="det-button-ghost flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Override Classification
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(fps: FlatProcess[], pathway: string) {
  const headers = [
    "Process Name",
    "Project",
    "Pathway",
    "Department",
    "Owner",
    "Complexity Tier",
    "Complexity Score",
    "Potential Saving (hrs)",
    "AI Agent Score",
    "RPA Score",
    "Manual Score",
    "Confidence %",
    "Key Factors",
  ];

  const escape = (v: string | number) =>
    `"${String(v).replace(/"/g, '""')}"`;

  const rows = fps.map((fp) => {
    const proc = fp.process;
    const scores = proc.diagnosis?.automationClassification?.pathwayScores;
    const cs = getComplexityScore(proc);
    return [
      escape(proc.analysis?.processName ?? ""),
      escape(fp.projectName),
      escape(proc.diagnosis?.automationClassification?.primaryClassification ?? ""),
      escape(getDepartment(proc)),
      escape(getOwner(proc)),
      escape(getComplexityTier(cs)),
      cs,
      Math.round(potentialHours(proc)),
      scores?.aiAgent ?? "",
      scores?.classicalRpa ?? "",
      scores?.manualOptimization ?? "",
      proc.diagnosis?.automationClassification?.confidenceScore ?? "",
      escape((proc.diagnosis?.automationClassification?.keyFactors ?? []).join("; ")),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DET_${pathway.replace(/\s+/g, "_")}_processes.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PathwayDrilldown() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const rawPathway = router.query.pathway;
  const pathway = (
    Array.isArray(rawPathway) ? rawPathway[0] : rawPathway
  ) as AutomationPathway | undefined;

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) void router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    getUserProjects(user.id)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [user]);

  // Flatten processes from all projects
  const flatProcesses = useMemo<FlatProcess[]>(() => {
    return projects.flatMap((proj) =>
      (Array.isArray(proj.processes) ? proj.processes : []).map((p) => ({
        projectId: proj.id,
        projectName: proj.name,
        process: p as ProcessWithDiagnosis,
      })),
    );
  }, [projects]);

  // Filter by current pathway
  const filtered = useMemo<FlatProcess[]>(() => {
    if (!pathway) return flatProcesses;
    return flatProcesses.filter(
      (fp) =>
        fp.process.diagnosis?.automationClassification?.primaryClassification ===
        pathway,
    );
  }, [flatProcesses, pathway]);

  const avgPotentialHrs =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, fp) => s + potentialHours(fp.process), 0) /
            filtered.length,
        )
      : 0;

  // Override handler: update diagnosis in Supabase and local state
  const handleOverride = useCallback(
    async (fp: FlatProcess, newPathway: AutomationPathway) => {
      const proj = projects.find((p) => p.id === fp.projectId);
      if (!proj) return;

      const updatedProcesses = (
        proj.processes as ProcessWithDiagnosis[]
      ).map((p) => {
        if (p.processIndex === fp.process.processIndex) {
          return {
            ...p,
            diagnosis: {
              ...p.diagnosis,
              automationClassification: {
                ...p.diagnosis.automationClassification,
                primaryClassification: newPathway,
              },
            },
          };
        }
        return p;
      });

      await updateProject(fp.projectId, { processes: updatedProcesses });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === fp.projectId ? { ...p, processes: updatedProcesses } : p,
        ),
      );
    },
    [projects],
  );

  const cfg = pathway ? PATHWAY_COLORS[pathway] : null;

  if (authLoading || (!user && !authLoading)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--sf-bg)" }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--det-navy-light)" }}
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {pathway ? `${pathway} — Pathway Drill-Through` : "Pathway Drill-Through"} | DET
        </title>
        <meta name="description" content="Per-pathway process list with ROI projections and classification override" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>
        {/* ── Print-only header ─────────────────────────────────────── */}
        <div className="hidden print:block print:mb-6">
          <p className="text-lg font-bold">
            DET Process Excellence — {pathway ?? "All Pathways"}
          </p>
          <p className="text-sm text-gray-500">
            Exported on {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>

        {/* ── Header ────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50 print:hidden"
          style={{
            background: "rgba(255,255,255,0.97)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(14px)",
            boxShadow: "var(--sf-shadow-sm)",
          }}
        >
          <div
            className="h-0.5"
            style={{
              background:
                "linear-gradient(90deg, var(--det-navy) 0%, var(--det-navy-mid) 55%, var(--det-gold) 100%)",
            }}
          />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-3">
              <Link href="/executive-dashboard">
                <Image
                  src="/assets/dubai-det-flag-logo.svg"
                  alt="DET"
                  width={110}
                  height={36}
                  className="h-9 w-auto"
                />
              </Link>
              <div
                className="hidden h-5 w-px sm:block"
                style={{ background: "var(--sf-border)" }}
              />
              {cfg && pathway && (
                <span
                  className="hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex"
                  style={{ background: cfg.bg, color: cfg.text }}
                >
                  {pathway}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/executive-dashboard"
                className="det-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                ← Portfolio
              </Link>
              {filtered.length > 0 && pathway && (
                <>
                  <button
                    onClick={() => downloadCSV(filtered, pathway)}
                    className="det-button-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="det-button-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print PDF
                  </button>
                </>
              )}
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="det-lang-toggle"
              >
                {lang === "en" ? "العربية" : "English"}
              </button>
              <button
                onClick={() =>
                  void signOut().then(() => void router.replace("/"))
                }
                className="det-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ──────────────────────────────────────────────────── */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {/* Page header */}
          <div className="mb-6">
            {pathway && cfg ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: cfg.stroke }}
                  />
                  <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
                    {pathway}
                  </h1>
                </div>
                <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "process" : "processes"} assigned to
                  this pathway
                  {avgPotentialHrs > 0 &&
                    ` · avg. ${avgPotentialHrs} hrs potential saving each`}
                </p>
              </>
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
                Pathway Drill-Through
              </h1>
            )}
          </div>

          {/* Pathway selector (if no valid pathway in URL) */}
          {!pathway && (
            <div
              className="mb-8 rounded-2xl p-6"
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
              }}
            >
              <p className="mb-4 text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                Select a pathway to drill through:
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                {ALL_PATHWAYS.map((pw) => {
                  const c = PATHWAY_COLORS[pw];
                  return (
                    <Link
                      key={pw}
                      href={`/pathway-drilldown?pathway=${encodeURIComponent(pw)}`}
                      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition"
                      style={{ background: c.bg, color: c.text }}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: c.stroke }}
                      />
                      {pw}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--det-navy-light)" }}
              />
            </div>
          ) : filtered.length === 0 && pathway ? (
            <div
              className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
              style={{ borderColor: "var(--sf-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No processes classified as <strong>{pathway}</strong>
              </p>
              <Link
                href="/executive-dashboard"
                className="sf-button-primary rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Back to Portfolio
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((fp) => (
                <ProcessCard
                  key={`${fp.projectId}-${fp.process.processIndex}`}
                  fp={fp}
                  onOverride={handleOverride}
                />
              ))}
            </div>
          )}
        </main>

        <footer
          className="mt-auto px-6 py-5 print:hidden"
          style={{
            background: "var(--sf-surface)",
            borderTop: "1px solid var(--sf-border)",
          }}
        >
          <p className="mx-auto max-w-7xl text-xs" style={{ color: "var(--sf-text-faint)" }}>
            Classification overrides are persisted immediately. Use the Process Optimizer to re-run diagnosis and update recommendations.
          </p>
        </footer>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
