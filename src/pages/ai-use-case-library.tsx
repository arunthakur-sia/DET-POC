import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserProjects, type Project } from "@/lib/supabase";
import type { ProcessWithDiagnosis } from "@/server/services/ProcessOptimizer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const activitiesTable = proc.analysis?.documentMetadata?.activitiesTable ?? [];
  return (proc.diagnosis?.quickWins ?? []).reduce((sum, qw) => {
    if (qw.category === "Removal" || qw.category === "Parallelization") {
      const entry =
        activitiesTable.find((a) => a.id === qw.stepId) ??
        activitiesTable.find((a) => a.name?.toLowerCase() === qw.stepName?.toLowerCase());
      if (entry?.actualTime) {
        const unit = (entry.actualTimeUnit ?? "").toLowerCase();
        const hrs = unit.includes("day") ? entry.actualTime * 8
          : unit.includes("min") ? entry.actualTime / 60
          : entry.actualTime;
        return sum + (qw.category === "Parallelization" ? hrs * 0.5 : hrs);
      }
    }
    return sum + parseToHours(qw.estimatedTimeSaving);
  }, 0);
}

function getComplexityTier(proc: ProcessWithDiagnosis): "Low" | "Medium" | "High" {
  const handoffs = proc.diagnosis?.processMetrics?.departmentHandoffs ?? 0;
  const approvals = proc.diagnosis?.processMetrics?.approvalLayers ?? 0;
  const meta = proc.analysis?.documentMetadata;
  const steps =
    meta?.activitiesTableCount ??
    (meta?.activitiesTable?.length ?? (proc.analysis?.processSteps ?? []).length);
  const score = handoffs * 2 + approvals * 2 + Math.floor(steps / 5);
  if (score >= 8) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function getROITier(hrs: number): "High" | "Medium" | "Low" {
  if (hrs >= 80) return "High";
  if (hrs >= 20) return "Medium";
  return "Low";
}

function getReadiness(proc: ProcessWithDiagnosis): "High" | "Medium" | "Low" {
  const score = proc.diagnosis?.automationClassification?.confidenceScore ?? 0;
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getDepartment(proc: ProcessWithDiagnosis): string {
  return proc.analysis?.documentMetadata?.department ?? proc.analysis?.departments?.[0] ?? "—";
}

// Derive what the agent does from process metadata + AI Agent step classifications
function deriveAgentDescription(proc: ProcessWithDiagnosis): string {
  const desc = proc.analysis?.documentMetadata?.description;
  const purpose = proc.analysis?.documentMetadata?.purpose;
  const keyFactors = proc.diagnosis?.automationClassification?.keyFactors ?? [];
  const aiSteps = (proc.diagnosis?.stepClassifications ?? [])
    .filter((s) => s.classification === "AI Agent")
    .map((s) => s.currentStateDescription ?? s.stepName)
    .slice(0, 3);

  if (desc) return desc;
  if (purpose) return purpose;
  if (aiSteps.length > 0)
    return `Automates: ${aiSteps.join("; ")}. ` +
      (keyFactors.length > 0 ? `Driven by: ${keyFactors.slice(0, 2).join(", ")}.` : "");
  return keyFactors.length > 0
    ? `Intelligent automation covering: ${keyFactors.join(", ")}.`
    : `AI Agent automation of ${proc.analysis?.processName ?? "this process"}.`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCaseEntry {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
  potentialHrs: number;
  roiTier: "High" | "Medium" | "Low";
  complexityTier: "Low" | "Medium" | "High";
  readiness: "High" | "Medium" | "Low";
  department: string;
  agentDescription: string;
  aiStepCount: number;
  totalStepCount: number;
  dataInputs: string[];
  dataOutputs: string[];
  technologyFit: string[];
}

function buildUseCases(projects: Project[]): UseCaseEntry[] {
  const entries: UseCaseEntry[] = [];
  for (const proj of projects) {
    const processes = Array.isArray(proj.processes) ? proj.processes : [];
    for (const p of processes) {
      const proc = p as ProcessWithDiagnosis;
      const primary = proc.diagnosis?.automationClassification?.primaryClassification;
      const scores = proc.diagnosis?.automationClassification?.pathwayScores;
      const aiScore = scores?.aiAgent ?? 0;
      // Show if classified as AI Agent OR has meaningful AI Agent score
      if (primary !== "AI Agent" && aiScore < 40) continue;

      const hrs = potentialHours(proc);
      const sipoc = proc.analysis?.documentMetadata?.sipoc;
      const aiSteps = (proc.diagnosis?.stepClassifications ?? []).filter(
        (s) => s.classification === "AI Agent",
      );
      const totalSteps =
        proc.analysis?.documentMetadata?.activitiesTableCount ??
        proc.analysis?.documentMetadata?.activitiesTable?.length ??
        proc.analysis?.processSteps?.length ?? 0;

      entries.push({
        projectId: proj.id,
        projectName: proj.name,
        process: proc,
        potentialHrs: Math.round(hrs),
        roiTier: getROITier(hrs),
        complexityTier: getComplexityTier(proc),
        readiness: getReadiness(proc),
        department: getDepartment(proc),
        agentDescription: deriveAgentDescription(proc),
        aiStepCount: aiSteps.length,
        totalStepCount: totalSteps,
        dataInputs: sipoc?.inputs ?? sipoc?.suppliers ?? [],
        dataOutputs: sipoc?.outputs ?? sipoc?.customers ?? [],
        technologyFit: proc.diagnosis?.automationClassification?.keyFactors ?? [],
      });
    }
  }
  return entries;
}

// ─── Tier badge colours ────────────────────────────────────────────────────────

const ROI_COLORS: Record<"High" | "Medium" | "Low", { bg: string; color: string }> = {
  High:   { bg: "rgba(22,163,74,0.10)",  color: "#15803d" },
  Medium: { bg: "rgba(234,179,8,0.12)",  color: "#a16207" },
  Low:    { bg: "rgba(100,116,139,0.10)", color: "#475569" },
};
const COMPLEXITY_COLORS: Record<"Low" | "Medium" | "High", { bg: string; color: string }> = {
  Low:    { bg: "rgba(22,163,74,0.10)",   color: "#15803d" },
  Medium: { bg: "rgba(234,179,8,0.12)",  color: "#a16207" },
  High:   { bg: "rgba(220,38,38,0.10)",  color: "#b91c1c" },
};
const READINESS_COLORS: Record<"High" | "Medium" | "Low", { bg: string; color: string }> = {
  High:   { bg: "rgba(10, 21, 30,0.10)",  color: "#0a151e" },
  Medium: { bg: "rgba(0,162,163,0.12)", color: "#0a6b6b" },
  Low:    { bg: "rgba(100,116,139,0.10)", color: "#475569" },
};

// ─── 2×2 Matrix ───────────────────────────────────────────────────────────────

const MATRIX_QUADRANTS = [
  {
    key: "quick-bet",
    label: "Quick Bets",
    sub: "Low Complexity · High ROI",
    roi: "High" as const,
    complexity: "Low" as const,
    bg: "rgba(22,163,74,0.07)",
    border: "rgba(22,163,74,0.20)",
    color: "#15803d",
    position: "bottom-left",
    description: "Automate now — highest return for lowest effort",
  },
  {
    key: "strategic-bet",
    label: "Strategic Bets",
    sub: "High Complexity · High ROI",
    roi: "High" as const,
    complexity: "High" as const,
    bg: "rgba(10, 21, 30,0.07)",
    border: "rgba(10, 21, 30,0.20)",
    color: "#0a151e",
    position: "bottom-right",
    description: "Invest carefully — transformative but needs programme sponsorship",
  },
  {
    key: "low-priority",
    label: "Low Priority",
    sub: "Low Complexity · Low–Medium ROI",
    roi: "Low" as const,
    complexity: "Low" as const,
    bg: "rgba(0,162,163,0.08)",
    border: "rgba(0,162,163,0.20)",
    color: "#0a6b6b",
    position: "top-left",
    description: "Consider when capacity allows — incremental gains",
  },
  {
    key: "approach-caution",
    label: "Approach with Caution",
    sub: "High Complexity · Low–Medium ROI",
    roi: "Low" as const,
    complexity: "High" as const,
    bg: "rgba(220,38,38,0.06)",
    border: "rgba(220,38,38,0.15)",
    color: "#b91c1c",
    position: "top-right",
    description: "Re-evaluate — high cost, limited return",
  },
];

function UseCaseMatrix({ useCases }: { useCases: UseCaseEntry[] }) {
  const placed: Record<string, UseCaseEntry[]> = {
    "quick-bet": [],
    "strategic-bet": [],
    "low-priority": [],
    "approach-caution": [],
  };

  for (const uc of useCases) {
    const isHighROI = uc.roiTier === "High";
    const isLowComplexity = uc.complexityTier === "Low";
    if (isHighROI && isLowComplexity) placed["quick-bet"]!.push(uc);
    else if (isHighROI && !isLowComplexity) placed["strategic-bet"]!.push(uc);
    else if (!isHighROI && isLowComplexity) placed["low-priority"]!.push(uc);
    else placed["approach-caution"]!.push(uc);
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full" style={{ background: "var(--hr-navy)" }} />
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
          Savings vs. Complexity Matrix
        </h2>
      </div>
      <p className="mb-4 ml-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
        Each dot represents one AI Agent use case. Position reflects estimated ROI vs. implementation complexity.
      </p>

      {/* Axis labels */}
      <div className="relative">
        {/* Y axis label */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-xs font-semibold"
          style={{ color: "var(--sf-text-faint)", transformOrigin: "center" }}>
          ↑ Higher Savings
        </div>

        <div className="ml-6">
          {/* Top axis labels */}
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>Low Complexity</span>
            <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>High Complexity →</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MATRIX_QUADRANTS.map((q) => {
              const items = placed[q.key] ?? [];
              return (
                <div
                  key={q.key}
                  className="min-h-36 rounded-xl p-3"
                  style={{ background: q.bg, border: `1px solid ${q.border}` }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: q.color }}>{q.label}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: q.bg, color: q.color, border: `1px solid ${q.border}` }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <p className="mb-2 text-xs italic" style={{ color: "var(--sf-text-faint)", fontSize: "0.62rem" }}>
                    {q.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {items.map((uc, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--sf-surface)", color: "var(--sf-text)", border: "1px solid var(--sf-border-soft)", fontSize: "0.65rem" }}
                        title={`${uc.potentialHrs} hrs potential savings`}
                      >
                        {uc.process.analysis?.processName ?? "Unnamed"}
                      </span>
                    ))}
                    {items.length === 0 && (
                      <span className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>None</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Use Case Card ─────────────────────────────────────────────────────────────

function UseCaseCard({ uc, aedRate }: { uc: UseCaseEntry; aedRate: number }) {
  const [expanded, setExpanded] = useState(false);
  const proc = uc.process;
  const costAed = Math.round(uc.potentialHrs * aedRate);

  const fmtAed = (n: number) =>
    n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `AED ${(n / 1_000).toFixed(0)}K`
    : `AED ${n}`;

  const aiSteps = (proc.diagnosis?.stepClassifications ?? []).filter(
    (s) => s.classification === "AI Agent",
  );
  const sipoc = proc.analysis?.documentMetadata?.sipoc;

  return (
    <div
      className="rounded-2xl"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
    >
      {/* Navy accent bar */}
      <div
        className="h-0.5 rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 60%, var(--hr-teal) 100%)" }}
      />

      {/* Header row (always visible) */}
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
            {/* ROI Badge */}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: ROI_COLORS[uc.roiTier].bg, color: ROI_COLORS[uc.roiTier].color }}
            >
              {uc.roiTier} ROI
            </span>
            {/* Complexity Badge */}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: COMPLEXITY_COLORS[uc.complexityTier].bg, color: COMPLEXITY_COLORS[uc.complexityTier].color }}
            >
              {uc.complexityTier} Complexity
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>
            {uc.projectName}
            {uc.department !== "—" && ` · ${uc.department}`}
            {uc.aiStepCount > 0 && ` · ${uc.aiStepCount} AI-ready steps`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {/* Readiness */}
          <span
            className="hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:block"
            style={{ background: READINESS_COLORS[uc.readiness].bg, color: READINESS_COLORS[uc.readiness].color }}
          >
            {uc.readiness} Readiness
          </span>
          {uc.potentialHrs > 0 && (
            <span className="text-sm font-bold" style={{ color: "var(--hr-teal)" }}>
              {uc.potentialHrs} hrs
            </span>
          )}
          <svg
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--sf-text-faint)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          className="space-y-5 px-5 pb-6"
          style={{ borderTop: "1px solid var(--sf-border-soft)" }}
        >
          {/* ── What the Agent Does ── */}
          <section className="pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-navy)" }} />
              What the Agent Does
            </h3>
            <p className="rounded-xl p-3 text-sm leading-relaxed" style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)", color: "var(--sf-text)" }}>
              {uc.agentDescription}
            </p>
          </section>

          {/* ── Process Linkage ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-teal)" }} />
              Processes Replaced / Augmented
            </h3>
            <div className="rounded-xl p-3" style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                {proc.analysis?.processName}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: `${uc.totalStepCount} total steps`, color: "var(--sf-text-faint)" },
                  { label: `${uc.aiStepCount} AI-automatable`, color: "var(--hr-navy)" },
                  { label: `${proc.diagnosis?.processMetrics?.departmentHandoffs ?? 0} dept. handoffs`, color: "var(--sf-text-faint)" },
                ].map((b) => (
                  <span key={b.label} className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border-soft)", color: b.color }}>
                    {b.label}
                  </span>
                ))}
              </div>
              {aiSteps.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {aiSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--hr-navy)" }} />
                      <span><strong>{s.stepName}</strong>{s.currentStateDescription ? ` — ${s.currentStateDescription}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Data Inputs / Outputs ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-gold)" }} />
              Data Inputs &amp; Outputs
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl p-3" style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                <p className="mb-2 text-xs font-bold" style={{ color: "var(--sf-text-muted)" }}>↓ Inputs</p>
                {(sipoc?.inputs?.length ?? uc.dataInputs.length) > 0 ? (
                  <ul className="space-y-0.5">
                    {(sipoc?.inputs ?? uc.dataInputs).map((inp, i) => (
                      <li key={i} className="text-xs" style={{ color: "var(--sf-text)" }}>• {inp}</li>
                    ))}
                    {(sipoc?.suppliers ?? []).filter(s => !sipoc?.inputs?.includes(s)).map((s, i) => (
                      <li key={`sup-${i}`} className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Supplier: {s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>Not specified</p>
                )}
              </div>
              <div className="rounded-xl p-3" style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                <p className="mb-2 text-xs font-bold" style={{ color: "var(--sf-text-muted)" }}>↑ Outputs</p>
                {(sipoc?.outputs?.length ?? uc.dataOutputs.length) > 0 ? (
                  <ul className="space-y-0.5">
                    {(sipoc?.outputs ?? uc.dataOutputs).map((out, i) => (
                      <li key={i} className="text-xs" style={{ color: "var(--sf-text)" }}>• {out}</li>
                    ))}
                    {(sipoc?.customers ?? []).filter(c => !sipoc?.outputs?.includes(c)).map((c, i) => (
                      <li key={`cust-${i}`} className="text-xs" style={{ color: "var(--sf-text-muted)" }}>Customer: {c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>Not specified</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Technology Fit ── */}
          {uc.technologyFit.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#6366f1" }} />
                Technology Fit Factors
              </h3>
              <div className="flex flex-wrap gap-2">
                {uc.technologyFit.map((f, i) => (
                  <span key={i} className="rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{ background: "rgba(10, 21, 30,0.07)", color: "var(--hr-navy)", border: "1px solid rgba(10, 21, 30,0.15)" }}>
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Estimated ROI ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
              Estimated ROI
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Potential Hours Saved", value: `${uc.potentialHrs} hrs/yr` },
                { label: "Cost Saving Estimate", value: fmtAed(costAed) },
                { label: "AI Readiness Score", value: `${proc.diagnosis?.automationClassification?.confidenceScore ?? 0}/100` },
                { label: "AI-Automatable Steps", value: `${uc.aiStepCount} / ${uc.totalStepCount}` },
              ].map((m) => (
                <div key={m.label} className="rounded-xl p-3 text-center"
                  style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--sf-text)" }}>{m.value}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>{m.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <div className="flex items-center justify-between pt-1">
            <Link
              href={`/process-optimizer?projectId=${uc.projectId}`}
              className="sf-button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              Open in Process Optimizer
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIUseCaseLibrary() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [aedRate] = useState(200);

  // Filters
  const [filterDept, setFilterDept] = useState("All");
  const [filterROI, setFilterROI] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [filterReadiness, setFilterReadiness] = useState<"All" | "High" | "Medium" | "Low">("All");

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

  const allUseCases = useMemo(() => buildUseCases(projects), [projects]);

  const allDepartments = useMemo(() => {
    const s = new Set(allUseCases.map((u) => u.department).filter((d) => d !== "—"));
    return ["All", ...Array.from(s).sort()];
  }, [allUseCases]);

  const filtered = useMemo(() => {
    return allUseCases.filter((uc) => {
      if (filterDept !== "All" && uc.department !== filterDept) return false;
      if (filterROI !== "All" && uc.roiTier !== filterROI) return false;
      if (filterReadiness !== "All" && uc.readiness !== filterReadiness) return false;
      return true;
    });
  }, [allUseCases, filterDept, filterROI, filterReadiness]);

  const handleExport = () => {
    const catalogue = allUseCases.map((uc) => ({
      processName: uc.process.analysis?.processName ?? "Unnamed",
      projectName: uc.projectName,
      department: uc.department,
      roiTier: uc.roiTier,
      complexityTier: uc.complexityTier,
      readiness: uc.readiness,
      potentialHoursSaved: uc.potentialHrs,
      estimatedCostSavingAED: Math.round(uc.potentialHrs * aedRate),
      aiReadinessScore: uc.process.diagnosis?.automationClassification?.confidenceScore ?? 0,
      aiAutomatableSteps: uc.aiStepCount,
      totalSteps: uc.totalStepCount,
      agentDescription: uc.agentDescription,
      dataInputs: uc.dataInputs,
      dataOutputs: uc.dataOutputs,
      technologyFitFactors: uc.technologyFit,
    }));
    const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), useCases: catalogue }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-ai-use-case-catalogue-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sf-bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--hr-navy-light)" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AI Use Case Library – Agentic Pathway | SIA Partners</title>
        <meta name="description" content="Curated AI Agent use cases mapped to SIA Partners processes with savings vs. complexity positioning" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>
        {/* ── Header ── */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,0.97)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(14px)",
            boxShadow: "var(--sf-shadow-sm)",
          }}
        >
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 55%, var(--hr-teal) 100%)" }} />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Image src="/assets/sia-logo.svg" alt="SIA Partners" width={94} height={36} className="h-9 w-auto" />
              </Link>
              <div className="hidden h-5 w-px sm:block" style={{ background: "var(--sf-border)" }} />
              <span className="hidden text-xs font-semibold sm:block" style={{ color: "var(--sf-text-muted)" }}>
                AI Use Case Library
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/executive-dashboard" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">Portfolio</Link>
              <Link href="/rpa-blueprint" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">RPA Blueprint</Link>
              <Link href="/manual-workbench" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">Lean Workbench</Link>
              <Link href="/dashboard" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">My Processes</Link>
              <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="hr-lang-toggle">
                {lang === "en" ? "العربية" : "English"}
              </button>
              <button onClick={() => void signOut().then(() => void router.replace("/"))} className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">
                {t("signOut")}
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {/* Title + export */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>AI Use Case Library</h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                AI Agent opportunities from your processes — mapped to savings vs. complexity to identify quick wins and strategic bets.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={allUseCases.length === 0}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: "var(--hr-navy)", color: "#fff" }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Catalogue
            </button>
          </div>

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--hr-navy-light)" }} />
            </div>
          ) : allUseCases.length === 0 ? (
            <div
              className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
              style={{ borderColor: "var(--sf-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No AI Agent use cases found. Upload and diagnose processes to identify AI opportunities.
              </p>
              <Link href="/dashboard" className="sf-button-primary rounded-lg px-4 py-2 text-sm font-semibold">
                Upload &amp; Diagnose Processes
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "AI Use Cases", value: String(allUseCases.length) },
                  { label: "Avg. Readiness Score", value: `${Math.round(allUseCases.reduce((s, u) => s + (u.process.diagnosis?.automationClassification?.confidenceScore ?? 0), 0) / (allUseCases.length || 1))}/100` },
                  { label: "Total Potential Hours", value: `${allUseCases.reduce((s, u) => s + u.potentialHrs, 0)} hrs` },
                  {
                    label: "Quick Bets",
                    value: String(allUseCases.filter((u) => u.roiTier === "High" && u.complexityTier === "Low").length),
                  },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl p-3 text-center"
                    style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", boxShadow: "var(--sf-shadow-sm)" }}>
                    <p className="text-xl font-bold" style={{ color: "var(--sf-text)" }}>{m.value}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Matrix */}
              <UseCaseMatrix useCases={allUseCases} />

              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--sf-text-muted)" }}>Filter:</span>

                {/* Dept filter */}
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", color: "var(--sf-text)" }}
                >
                  {allDepartments.map((d) => (
                    <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>
                  ))}
                </select>

                {/* ROI filter */}
                {(["All", "High", "Medium", "Low"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setFilterROI(tier)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: filterROI === tier ? "var(--hr-navy)" : "var(--sf-surface)",
                      color: filterROI === tier ? "#fff" : "var(--sf-text-muted)",
                      border: `1px solid ${filterROI === tier ? "var(--hr-navy)" : "var(--sf-border)"}`,
                    }}
                  >
                    {tier === "All" ? "All ROI" : `${tier} ROI`}
                  </button>
                ))}

                {/* Readiness filter */}
                {(["All", "High", "Medium", "Low"] as const).map((tier) => (
                  <button
                    key={`r-${tier}`}
                    onClick={() => setFilterReadiness(tier)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: filterReadiness === tier ? "rgba(10, 21, 30,0.12)" : "var(--sf-surface)",
                      color: filterReadiness === tier ? "var(--hr-navy)" : "var(--sf-text-muted)",
                      border: `1px solid ${filterReadiness === tier ? "var(--hr-navy)" : "var(--sf-border)"}`,
                    }}
                  >
                    {tier === "All" ? "All Readiness" : `${tier} Ready`}
                  </button>
                ))}
              </div>

              {/* Use case cards */}
              <div>
                <p className="mb-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  {filtered.length} use case{filtered.length !== 1 ? "s" : ""} — click to expand
                </p>
                {filtered.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-2xl" style={{ border: "2px dashed var(--sf-border)" }}>
                    <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>No use cases match the current filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((uc) => (
                      <UseCaseCard
                        key={`${uc.projectId}-${uc.process.processIndex}`}
                        uc={uc}
                        aedRate={aedRate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
