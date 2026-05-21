import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserProjects, type Project } from "@/lib/supabase";
import type {
  ProcessWithDiagnosis,
  AutomationPathway,
  DiagnosisQuickWin,
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

function getTimeline(effort: "Low" | "Medium" | "High"): string {
  switch (effort) {
    case "Low":    return "1–2 weeks";
    case "Medium": return "4–6 weeks";
    case "High":   return "8–12 weeks";
  }
}

// ─── DET Internal Frameworks (static reference data) ─────────────────────────

interface DETFramework {
  name: string;
  tag: string;
  description: string;
  isInternal: boolean;
}

const DET_FRAMEWORKS: DETFramework[] = [
  {
    name: "Dubai Government Excellence Programme (DGEP)",
    tag: "Excellence",
    description: "National framework for government performance and service quality improvement.",
    isInternal: false,
  },
  {
    name: "Dubai Digital Strategy",
    tag: "Digital",
    description: "Smart transformation and digital-first service delivery principles for Dubai government entities.",
    isInternal: false,
  },
  {
    name: "Lean Process Improvement",
    tag: "Lean",
    description: "Identify and eliminate muda (waste): waiting, over-processing, unnecessary transport, and defects.",
    isInternal: true,
  },
  {
    name: "Six Sigma DMAIC",
    tag: "Six Sigma",
    description: "Define → Measure → Analyse → Improve → Control. Reduce variation and defect rates in high-volume processes.",
    isInternal: true,
  },
  {
    name: "Process Excellence Toolkit — DET Internal",
    tag: "Internal",
    description: "DET's internal guide for process review, owner assignment, and SOP publication.",
    isInternal: true,
  },
];

// Match a quickWin's bestPractice string to a framework label
function mapBestPractice(bp: string | undefined): string | null {
  if (!bp) return null;
  const lower = bp.toLowerCase();
  if (lower.includes("lean"))       return "Lean";
  if (lower.includes("six sigma"))  return "Six Sigma";
  if (lower.includes("5s"))         return "Lean";
  if (lower.includes("kaizen"))     return "Lean";
  if (lower.includes("dmaic"))      return "Six Sigma";
  if (lower.includes("dgep"))       return "Excellence";
  return null;
}

// ─── Effort/Impact quadrant helpers ──────────────────────────────────────────

type Quadrant = "Quick Win" | "Strategic" | "Fill-in" | "Defer";

function getQuadrant(qw: DiagnosisQuickWin): Quadrant {
  const lowEffort = qw.effort === "Low";
  const highImpact = qw.impact === "High";
  if (lowEffort && highImpact)   return "Quick Win";
  if (!lowEffort && highImpact)  return "Strategic";
  if (lowEffort && !highImpact)  return "Fill-in";
  return "Defer";
}

const QUADRANT_CONFIG: Record<Quadrant, { label: string; color: string; bg: string; description: string; position: string }> = {
  "Quick Win":  { label: "Quick Wins",  color: "#16a34a", bg: "rgba(22,163,74,0.08)",   description: "Low effort · High impact — do first", position: "top-0 left-0" },
  "Strategic":  { label: "Strategic",   color: "#1b3764", bg: "rgba(27,55,100,0.09)",   description: "High effort · High impact — plan carefully", position: "top-0 right-0" },
  "Fill-in":    { label: "Fill-ins",    color: "#c9a84c", bg: "rgba(201,168,76,0.10)",  description: "Low effort · Low impact — when capacity allows", position: "bottom-0 left-0" },
  "Defer":      { label: "Defer",       color: "#dc2626", bg: "rgba(220,38,38,0.07)",   description: "High effort · Low impact — question return on investment", position: "bottom-0 right-0" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatProcess {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
}

// ─── Effort/Impact Matrix ─────────────────────────────────────────────────────

function EffortImpactMatrix({ quickWins }: { quickWins: DiagnosisQuickWin[] }) {
  if (quickWins.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
        No quick-win recommendations available.
      </p>
    );
  }

  const grouped: Record<Quadrant, DiagnosisQuickWin[]> = {
    "Quick Win": [],
    "Strategic": [],
    "Fill-in":   [],
    "Defer":     [],
  };
  quickWins.forEach((qw) => grouped[getQuadrant(qw)].push(qw));

  return (
    <div>
      {/* Axis labels */}
      <div className="relative mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>
          Low Effort →
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>
          High Effort
        </span>
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {(["Quick Win", "Strategic", "Fill-in", "Defer"] as Quadrant[]).map((q) => {
          const cfg = QUADRANT_CONFIG[q];
          const items = grouped[q];
          const isTopRow = q === "Quick Win" || q === "Strategic";
          return (
            <div
              key={q}
              className="rounded-xl p-3"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  {isTopRow ? "↑ High impact" : "↓ Low impact"}
                </span>
              </div>
              <p className="mb-2 text-xs italic" style={{ color: "var(--sf-text-faint)" }}>
                {cfg.description}
              </p>
              {items.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  None
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((qw, i) => {
                    const bpTag = mapBestPractice(qw.bestPractice);
                    return (
                      <li key={i} className="rounded-lg p-2" style={{ background: "var(--sf-surface)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex-1 text-xs font-medium" style={{ color: "var(--sf-text)" }}>
                            {qw.stepName}
                          </span>
                          <span
                            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs"
                            style={{ background: cfg.bg, color: cfg.color, fontSize: "0.6rem", fontWeight: 700 }}
                          >
                            {qw.category}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                          {qw.suggestion}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          {qw.estimatedTimeSaving && (
                            <span className="font-semibold" style={{ color: "var(--det-teal)" }}>
                              ⏱ {qw.estimatedTimeSaving}
                            </span>
                          )}
                          <span style={{ color: "var(--sf-text-faint)" }}>
                            Timeline: {getTimeline(qw.effort)}
                          </span>
                          {bpTag && (
                            <span
                              className="rounded px-1.5 py-0.5 font-semibold"
                              style={{
                                fontSize: "0.6rem",
                                background: "rgba(27,55,100,0.08)",
                                color: "var(--det-navy)",
                              }}
                            >
                              {bpTag}
                            </span>
                          )}
                          {qw.performedBy && (
                            <span style={{ color: "var(--sf-text-faint)" }}>
                              Owner: {qw.performedBy}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Process Workbench Card ───────────────────────────────────────────────────

function WorkbenchCard({ fp }: { fp: FlatProcess }) {
  const [expanded, setExpanded] = useState(false);
  const proc = fp.process;
  const pathway = proc.diagnosis?.automationClassification?.primaryClassification;
  const bottlenecks = proc.diagnosis?.bottlenecks ?? [];
  const quickWins = proc.diagnosis?.quickWins ?? [];
  const priorityActions = proc.diagnosis?.priorityActions ?? [];
  const dept = getDepartment(proc);
  const owner = getOwner(proc);

  const totalPotentialHrs = quickWins.reduce(
    (s, qw) => s + parseToHours(qw.estimatedTimeSaving),
    0,
  );

  const highBottlenecks = bottlenecks.filter((b) => b.impact === "High");

  return (
    <div
      className="rounded-2xl"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
    >
      {/* Gold accent bar */}
      <div
        className="h-0.5 rounded-t-2xl"
        style={{
          background:
            "linear-gradient(90deg, var(--det-navy) 0%, var(--det-gold) 100%)",
        }}
      />

      {/* Collapsed header */}
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold" style={{ color: "var(--sf-text)" }}>
              {proc.analysis?.processName ?? "Unnamed Process"}
            </span>
            {pathway && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background:
                    pathway === "Manual Optimization"
                      ? "rgba(201,168,76,0.12)"
                      : pathway === "Classical RPA"
                        ? "rgba(26,158,143,0.09)"
                        : "rgba(27,55,100,0.09)",
                  color:
                    pathway === "Manual Optimization"
                      ? "#8a6b18"
                      : pathway === "Classical RPA"
                        ? "#0d7a6e"
                        : "#1b3764",
                }}
              >
                {pathway}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>
            {fp.projectName}
            {dept !== "—" && ` · ${dept}`}
            {owner !== "—" && ` · ${owner}`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {highBottlenecks.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: "rgba(220,38,38,0.08)",
                color: "#dc2626",
              }}
            >
              {highBottlenecks.length} critical
            </span>
          )}
          {totalPotentialHrs > 0 && (
            <span className="text-xs font-semibold" style={{ color: "var(--det-teal)" }}>
              {Math.round(totalPotentialHrs)} hrs
            </span>
          )}
          <svg
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--sf-text-faint)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="space-y-6 px-5 pb-6"
          style={{ borderTop: "1px solid var(--sf-border-soft)" }}
        >
          {/* ── Pain Points ── */}
          {bottlenecks.length > 0 && (
            <section className="pt-4">
              <h3
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--sf-text-muted)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "#dc2626" }}
                />
                Current Pain Points
              </h3>
              <ul className="space-y-2">
                {bottlenecks.map((b, i) => {
                  const impactColor =
                    b.impact === "High"
                      ? "#dc2626"
                      : b.impact === "Medium"
                        ? "#d97706"
                        : "#16a34a";
                  const util = b.timingIssue?.utilizationPercent ?? 0;
                  return (
                    <li
                      key={i}
                      className="rounded-xl p-3"
                      style={{
                        background: "var(--sf-surface-muted)",
                        border: "1px solid var(--sf-border-soft)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                            {b.stepName}
                          </p>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                            {b.reason}
                          </p>
                        </div>
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ color: impactColor, background: `${impactColor}14` }}
                        >
                          {b.impact}
                        </span>
                      </div>
                      {util > 0 && (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                              Utilisation
                            </span>
                            <span className="text-xs font-semibold" style={{ color: impactColor }}>
                              {util}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 overflow-hidden rounded-full"
                            style={{ background: "var(--sf-border)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(util, 100)}%`,
                                background: impactColor,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Effort / Impact Matrix ── */}
          {quickWins.length > 0 && (
            <section>
              <h3
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--sf-text-muted)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--det-teal)" }}
                />
                Improvement Recommendations — Effort vs. Impact
              </h3>
              <EffortImpactMatrix quickWins={quickWins} />
            </section>
          )}

          {/* ── Priority Actions with Timeline ── */}
          {priorityActions.length > 0 && (
            <section>
              <h3
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--sf-text-muted)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--det-gold)" }}
                />
                Priority Owner Actions
              </h3>
              <ol className="space-y-2">
                {priorityActions.map((pa) => (
                  <li
                    key={pa.order}
                    className="flex gap-3 rounded-xl p-3"
                    style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: "var(--det-gold)", color: "#1b3764" }}
                    >
                      {pa.order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                        {pa.action}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                        {pa.rationale}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Process Metrics Summary ── */}
          {proc.diagnosis?.processMetrics && (
            <section>
              <h3
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--sf-text-muted)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--det-navy)" }}
                />
                Process Metrics
              </h3>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {[
                  { label: "Current Duration", value: proc.diagnosis.processMetrics.totalDuration },
                  {
                    label: "Dept. Handoffs",
                    value: String(proc.diagnosis.processMetrics.departmentHandoffs ?? 0),
                  },
                  {
                    label: "Approval Layers",
                    value: String(proc.diagnosis.processMetrics.approvalLayers ?? 0),
                  },
                  {
                    label: "Quick Wins",
                    value: `${quickWins.length} identified`,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}
                  >
                    <p className="text-sm font-bold" style={{ color: "var(--sf-text)" }}>
                      {m.value}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── CTA to full optimizer ── */}
          <div className="flex items-center justify-between pt-1">
            <Link
              href={`/process-optimizer?projectId=${fp.projectId}`}
              className="sf-button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              Open in Process Optimizer
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
              Apply optimisations &amp; generate revised SOP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ label: string; value: AutomationPathway | "All" }> = [
  { label: "All Pathways", value: "All" },
  { label: "Manual Optimization", value: "Manual Optimization" },
  { label: "AI Agent", value: "AI Agent" },
  { label: "Classical RPA", value: "Classical RPA" },
];

export default function ManualWorkbench() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();
  const isDark = theme === "dark";

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [pathwayFilter, setPathwayFilter] = useState<AutomationPathway | "All">(
    "Manual Optimization",
  );

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

  const flatProcesses = useMemo<FlatProcess[]>(() => {
    return projects.flatMap((proj) =>
      (Array.isArray(proj.processes) ? proj.processes : []).map((p) => ({
        projectId: proj.id,
        projectName: proj.name,
        process: p as ProcessWithDiagnosis,
      })),
    );
  }, [projects]);

  const filtered = useMemo<FlatProcess[]>(() => {
    if (pathwayFilter === "All") return flatProcesses;
    return flatProcesses.filter(
      (fp) =>
        fp.process.diagnosis?.automationClassification?.primaryClassification ===
        pathwayFilter,
    );
  }, [flatProcesses, pathwayFilter]);

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
        <title>Manual & Lean Workbench – Process Excellence | DET</title>
        <meta
          name="description"
          content="Lean and Six Sigma improvement recommendations for DET processes not suited to automation"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: isDark ? "rgba(22,38,60,0.97)" : "rgba(255,255,255,0.97)",
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
              <Link href="/dashboard">
                <Image
                  src="/assets/dubai-det-flag-logo.svg"
                  alt="Dubai Economy and Tourism"
                  width={110}
                  height={36}
                  className="h-9 w-auto"
                />
              </Link>
              <div
                className="hidden h-5 w-px sm:block"
                style={{ background: "var(--sf-border)" }}
              />
              <span
                className="hidden text-xs font-semibold sm:block"
                style={{ color: "var(--sf-text-muted)" }}
              >
                Manual &amp; Lean Workbench
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/executive-dashboard"
                className="det-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Portfolio
              </Link>
              <Link
                href="/dashboard"
                className="det-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                My Processes
              </Link>
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="det-lang-toggle"
              >
                {lang === "en" ? "العربية" : "English"}
              </button>
              <button
                onClick={toggleTheme}
                className="det-theme-toggle"
                aria-label="Toggle colour scheme"
              >
                {isDark ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
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
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
              Manual &amp; Lean Optimization Workbench
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Structured Lean / Six Sigma improvement recommendations for
              processes not suited to automation. No process is left behind.
            </p>
          </div>

          {/* Pathway filter tabs */}
          <div className="mb-6 flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: "var(--sf-border)" }}>
            {FILTER_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setPathwayFilter(value)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background:
                    pathwayFilter === value
                      ? "var(--det-navy)"
                      : "var(--sf-surface)",
                  color:
                    pathwayFilter === value ? "#fff" : "var(--sf-text-muted)",
                  border: `1px solid ${pathwayFilter === value ? "var(--det-navy)" : "var(--sf-border)"}`,
                }}
              >
                {label}
                {value !== "All" && (
                  <span className="ml-1.5 opacity-70">
                    (
                    {
                      flatProcesses.filter(
                        (fp) =>
                          fp.process.diagnosis?.automationClassification
                            ?.primaryClassification === value,
                      ).length
                    }
                    )
                  </span>
                )}
              </button>
            ))}
          </div>

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--det-navy-light)" }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
              style={{ borderColor: "var(--sf-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No{" "}
                {pathwayFilter !== "All" ? <strong>{pathwayFilter}</strong> : ""}{" "}
                processes found in your portfolio
              </p>
              <Link
                href="/dashboard"
                className="sf-button-primary rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Upload &amp; Diagnose Processes
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                {filtered.length} {filtered.length === 1 ? "process" : "processes"} — click to expand
                recommendations
              </p>
              {filtered.map((fp) => (
                <WorkbenchCard
                  key={`${fp.projectId}-${fp.process.processIndex}`}
                  fp={fp}
                />
              ))}
            </div>
          )}

          {/* ── DET Framework References ── */}
          <section className="mt-12">
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
                boxShadow: "var(--sf-shadow-sm)",
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                <div
                  className="h-4 w-1 rounded-full"
                  style={{ background: "var(--det-gold)" }}
                />
                <h2
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  Relevant DET Frameworks &amp; Best Practices
                </h2>
              </div>
              <p className="mb-5 mt-1 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                Reference materials for process excellence and lean transformation
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DET_FRAMEWORKS.map((fw) => (
                  <div
                    key={fw.name}
                    className="rounded-xl p-4"
                    style={{
                      background: "var(--sf-surface-muted)",
                      border: "1px solid var(--sf-border-soft)",
                    }}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-bold"
                        style={{
                          background: fw.isInternal
                            ? "rgba(27,55,100,0.09)"
                            : "rgba(201,168,76,0.12)",
                          color: fw.isInternal ? "var(--det-navy)" : "#8a6b18",
                          fontSize: "0.6rem",
                        }}
                      >
                        {fw.isInternal ? "DET Internal" : "External"}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: "rgba(26,158,143,0.09)",
                          color: "var(--det-teal)",
                          fontSize: "0.6rem",
                        }}
                      >
                        {fw.tag}
                      </span>
                    </div>
                    <p
                      className="mb-1 text-sm font-semibold leading-snug"
                      style={{ color: "var(--sf-text)" }}
                    >
                      {fw.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                      {fw.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer
          className="mt-auto px-6 py-5"
          style={{
            background: "var(--sf-surface)",
            borderTop: "1px solid var(--sf-border)",
          }}
        >
          <p className="mx-auto max-w-7xl text-xs" style={{ color: "var(--sf-text-faint)" }}>
            Recommendations are AI-generated based on uploaded process documents. Timeline estimates are heuristic: Low effort ≈ 1–2 weeks · Medium ≈ 4–6 weeks · High ≈ 8–12 weeks. Always validate with process owners before implementing changes.
          </p>
        </footer>
      </div>
    </>
  );
}
