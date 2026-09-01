import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserProjects, type Project } from "@/lib/supabase";
import type {
  ProcessWithDiagnosis,
  DiagnosisQuickWin,
  DiagnosisBottleneck,
} from "@/server/services/ProcessOptimizer";
import { StepLevelView } from "@/components/StepLevelView";

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

// ─── SIA Partners Internal Frameworks — step-level reference data ─────────────

interface HRFramework {
  tag: string;
  name: string;
  description: string;
  howToApply: string;
  isInternal: boolean;
}

const HR_FRAMEWORKS: Record<string, HRFramework> = {
  "Lean": {
    tag: "Lean",
    name: "Lean Process Improvement",
    description: "Identify and eliminate muda (waste): waiting, over-processing, unnecessary transport, and defects.",
    howToApply: "Map the value stream for this step. Ask: does this step directly add value for the end customer? If not, target it for elimination or minimization. Document current vs. target state.",
    isInternal: true,
  },
  "Six Sigma": {
    tag: "Six Sigma",
    name: "Six Sigma DMAIC",
    description: "Define → Measure → Analyse → Improve → Control. Reduce variation and defect rates in high-volume processes.",
    howToApply: "Define the defect for this step, measure the current error or rework rate, analyse the root cause using fishbone or 5-Why, implement the fix, and set a control plan (e.g. checklist or SLA monitoring).",
    isInternal: true,
  },
  "Excellence": {
    tag: "Excellence",
    name: "Rail Operations Excellence Programme (ROEP)",
    description: "Framework for rail operator performance and service quality improvement.",
    howToApply: "Benchmark this step against rail industry best practice metrics. Document a baseline KPI and set a target improvement aligned with ROEP Level 4 service quality standards.",
    isInternal: false,
  },
  "Digital": {
    tag: "Digital",
    name: "SIA Partners Digital Strategy",
    description: "Smart transformation and digital-first service delivery principles for SIA Partners operations.",
    howToApply: "Assess whether this step can be delivered digitally or via self-service. Prioritise API-driven, mobile-accessible, or proactive service alternatives aligned with the SIA Partners Digital Strategy.",
    isInternal: false,
  },
  "Internal": {
    tag: "Internal",
    name: "Process Excellence Toolkit — SIA Partners Internal",
    description: "SIA Partners' internal guide for process review, owner assignment, and SOP publication.",
    howToApply: "Use the SIA Partners Process Excellence Toolkit to assign a step owner, set a review cadence, and ensure this step is reflected in the current published SOP with the correct RACI mapping.",
    isInternal: true,
  },
};

function mapBestPractice(bp: string | undefined): string | null {
  if (!bp) return null;
  const lower = bp.toLowerCase();
  if (lower.includes("lean"))       return "Lean";
  if (lower.includes("six sigma"))  return "Six Sigma";
  if (lower.includes("5s"))         return "Lean";
  if (lower.includes("kaizen"))     return "Lean";
  if (lower.includes("dmaic"))      return "Six Sigma";
  if (lower.includes("roep"))       return "Excellence";
  if (lower.includes("digital"))    return "Digital";
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

const QUADRANT_CONFIG: Record<Quadrant, { label: string; color: string; bg: string; description: string }> = {
  "Quick Win":  { label: "Quick Wins",  color: "#16a34a", bg: "rgba(22,163,74,0.08)",  description: "Low effort · High impact — implement first" },
  "Strategic":  { label: "Strategic",   color: "#0a151e", bg: "rgba(10, 21, 30,0.09)",  description: "High effort · High impact — plan carefully" },
  "Fill-in":    { label: "Fill-ins",    color: "#00a2a3", bg: "rgba(0,162,163,0.10)", description: "Low effort · Low impact — when capacity allows" },
  "Defer":      { label: "Defer",       color: "#dc2626", bg: "rgba(220,38,38,0.07)",  description: "High effort · Low impact — question ROI" },
};

// ─── Revised Flow Step ────────────────────────────────────────────────────────

interface RevisedFlowStep {
  stepName: string;
  action: "Remove" | "Merge" | "Parallelize" | "Simplify";
  reason: string;
  owner: string;
  timeline: string;
  frameworkTag: string | null;
}

const ACTION_CONFIG: Record<RevisedFlowStep["action"], { color: string; bg: string; icon: string }> = {
  Remove:      { color: "#b91c1c", bg: "rgba(220,38,38,0.09)",  icon: "✕" },
  Merge:       { color: "#077c84", bg: "rgba(29,233,182,0.09)", icon: "⊕" },
  Parallelize: { color: "#0a151e", bg: "rgba(10, 21, 30,0.09)",  icon: "⇉" },
  Simplify:    { color: "#a16207", bg: "rgba(234,179,8,0.10)",  icon: "↓" },
};

function buildRevisedFlow(proc: ProcessWithDiagnosis): RevisedFlowStep[] {
  const qws = proc.diagnosis?.quickWins ?? [];
  const activitiesTable = proc.analysis?.documentMetadata?.activitiesTable ?? [];
  const processSteps = proc.analysis?.processSteps ?? [];

  const stepMap = new Map<string, RevisedFlowStep>();
  for (const qw of qws) {
    const action: RevisedFlowStep["action"] | null =
      qw.category === "Removal" ? "Remove"
      : qw.category === "Consolidation" ? "Merge"
      : qw.category === "Parallelization" ? "Parallelize"
      : qw.category === "Simplification" ? "Simplify"
      : null;
    if (!action) continue;
    stepMap.set(qw.stepName, {
      stepName: qw.stepName,
      action,
      reason: qw.suggestion,
      owner: qw.performedBy,
      timeline: getTimeline(qw.effort),
      frameworkTag: mapBestPractice(qw.bestPractice),
    });
  }

  const allStepNames =
    activitiesTable.length > 0
      ? activitiesTable.map((a) => a.name)
      : processSteps.map((s) => s.name);

  const result: RevisedFlowStep[] = [];
  for (const name of allStepNames) {
    const matched = stepMap.get(name);
    if (matched) result.push(matched);
  }
  for (const [, item] of stepMap) {
    if (!result.find((r) => r.stepName === item.stepName)) result.push(item);
  }
  return result;
}

// ─── Step Improvement Card (inline framework reference) ───────────────────────

function StepImprovementCard({ qw }: { qw: DiagnosisQuickWin }) {
  const [showFramework, setShowFramework] = useState(false);
  const fwTag = mapBestPractice(qw.bestPractice);
  const fw = fwTag ? HR_FRAMEWORKS[fwTag] : null;
  const quadrant = getQuadrant(qw);
  const qc = QUADRANT_CONFIG[quadrant];
  const isQuickWin = quadrant === "Quick Win";

  return (
    <li className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--sf-border-soft)" }}>
      <div className="p-3" style={{ background: "var(--sf-surface-muted)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--sf-text)" }}>{qw.stepName}</span>
              <span className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                style={{ background: qc.bg, color: qc.color, fontSize: "0.6rem" }}>
                {qc.label}
              </span>
              {isQuickWin && (
                <span className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{ background: "rgba(22,163,74,0.12)", color: "#15803d", fontSize: "0.6rem" }}>
                  ⚡ Quick Win
                </span>
              )}
            </div>
            <p className="text-xs leading-snug" style={{ color: "var(--sf-text-muted)" }}>{qw.suggestion}</p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {qw.estimatedTimeSaving && (
              <span className="text-xs font-bold" style={{ color: "var(--hr-teal)" }}>⏱ {qw.estimatedTimeSaving}</span>
            )}
            <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
              {getTimeline(qw.effort)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded px-1.5 py-0.5 text-xs"
            style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border-soft)", color: "var(--sf-text-faint)", fontSize: "0.65rem" }}>
            Effort: {qw.effort}
          </span>
          <span className="rounded px-1.5 py-0.5 text-xs"
            style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border-soft)", color: "var(--sf-text-faint)", fontSize: "0.65rem" }}>
            Impact: {qw.impact}
          </span>
          {qw.performedBy && (
            <span className="text-xs" style={{ color: "var(--sf-text-faint)", fontSize: "0.65rem" }}>
              Owner: {qw.performedBy}
            </span>
          )}
          {fw && (
            <button
              onClick={() => setShowFramework((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold transition-all"
              style={{
                background: showFramework ? "rgba(10, 21, 30,0.12)" : "rgba(10, 21, 30,0.06)",
                color: "var(--hr-navy)",
                border: "1px solid rgba(10, 21, 30,0.18)",
                fontSize: "0.65rem",
              }}
              title="Click to view step-level framework guidance"
            >
              {fw.isInternal ? "🏛" : "📋"} {fw.tag}
              <svg className={`h-2.5 w-2.5 transition-transform ${showFramework ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Step-level framework guidance panel */}
      {fw && showFramework && (
        <div
          className="px-3 py-3"
          style={{
            background: fw.isInternal ? "rgba(10, 21, 30,0.04)" : "rgba(0,162,163,0.05)",
            borderTop: `1px solid ${fw.isInternal ? "rgba(10, 21, 30,0.12)" : "rgba(0,162,163,0.18)"}`,
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-xs font-bold"
              style={{
                background: fw.isInternal ? "rgba(10, 21, 30,0.09)" : "rgba(0,162,163,0.12)",
                color: fw.isInternal ? "var(--hr-navy)" : "#0a6b6b",
                fontSize: "0.6rem",
              }}
            >
              {fw.isInternal ? "SIA Partners Internal" : "External Framework"}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--sf-text)" }}>{fw.name}</span>
          </div>
          <p className="mb-2 text-xs leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>
            {fw.description}
          </p>
          <div className="rounded-lg p-2" style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border-soft)" }}>
            <p className="mb-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--hr-navy)", fontSize: "0.6rem" }}>
              How to Apply to This Step
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>
              {fw.howToApply}
            </p>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Revised Process Flow Panel ────────────────────────────────────────────────

function RevisedFlowPanel({ steps }: { steps: RevisedFlowStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>
        No specific step-level changes derived — see improvement recommendations above.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const cfg = ACTION_CONFIG[step.action];
        const fw = step.frameworkTag ? HR_FRAMEWORKS[step.frameworkTag] : null;
        return (
          <div key={i} className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: cfg.color, color: "#fff" }}
            >
              {cfg.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--sf-text)" }}>{step.stepName}</span>
                <span className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, fontSize: "0.6rem" }}>
                  {step.action}
                </span>
                {fw && (
                  <span className="rounded px-1.5 py-0.5 text-xs font-semibold"
                    style={{ background: "rgba(10, 21, 30,0.07)", color: "var(--hr-navy)", fontSize: "0.6rem" }}>
                    {fw.tag}
                  </span>
                )}
              </div>
              <p className="text-xs leading-snug" style={{ color: "var(--sf-text-muted)" }}>{step.reason}</p>
              <div className="mt-1 flex items-center gap-3" style={{ color: "var(--sf-text-faint)", fontSize: "0.65rem" }}>
                {step.owner && <span className="text-xs">Owner: {step.owner}</span>}
                <span className="text-xs">Timeline: {step.timeline}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Effort/Impact Matrix (with step-level framework inline) ──────────────────

function EffortImpactMatrix({
  quickWins,
  wasteFilter,
}: {
  quickWins: DiagnosisQuickWin[];
  wasteFilter: WasteCategory;
}) {
  const visibleWins =
    wasteFilter === "All" ? quickWins : quickWins.filter((qw) => qw.category === wasteFilter);

  if (quickWins.length === 0) {
    return <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>No improvement recommendations available.</p>;
  }
  if (visibleWins.length === 0) {
    return <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>No steps match the selected waste category.</p>;
  }

  const grouped: Record<Quadrant, DiagnosisQuickWin[]> = {
    "Quick Win": [], "Strategic": [], "Fill-in": [], "Defer": [],
  };
  visibleWins.forEach((qw) => grouped[getQuadrant(qw)].push(qw));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>Low Effort →</span>
        <span className="text-xs font-semibold" style={{ color: "var(--sf-text-faint)" }}>High Effort</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["Quick Win", "Strategic", "Fill-in", "Defer"] as Quadrant[]).map((q) => {
          const cfg = QUADRANT_CONFIG[q];
          const items = grouped[q];
          const isHighImpact = q === "Quick Win" || q === "Strategic";
          return (
            <div key={q} className="rounded-xl p-3"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  {isHighImpact ? "↑ High impact" : "↓ Low impact"}
                </span>
              </div>
              <p className="mb-2 text-xs italic" style={{ color: "var(--sf-text-faint)", fontSize: "0.62rem" }}>
                {cfg.description}
              </p>
              {items.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>None</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((qw, i) => <StepImprovementCard key={i} qw={qw} />)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatProcess {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
}

type WasteCategory = "All" | "Removal" | "Consolidation" | "Simplification" | "Parallelization";

const LEAN_FILTERS: Array<{ label: string; value: WasteCategory; lean: string }> = [
  { label: "All Processes",   value: "All",             lean: "" },
  { label: "Waste Removal",   value: "Removal",         lean: "Eliminate non-value steps" },
  { label: "Consolidation",   value: "Consolidation",   lean: "Combine redundant activities" },
  { label: "Simplification",  value: "Simplification",  lean: "Streamline complexity" },
  { label: "Parallelisation", value: "Parallelization", lean: "Improve throughput" },
];

// ─── Workbench Card ────────────────────────────────────────────────────────────

function WorkbenchCard({ fp, wasteFilter }: { fp: FlatProcess; wasteFilter: WasteCategory }) {
  const [expanded, setExpanded] = useState(false);
  const proc = fp.process;
  const bottlenecks = proc.diagnosis?.bottlenecks ?? [];
  const quickWins = proc.diagnosis?.quickWins ?? [];
  const priorityActions = proc.diagnosis?.priorityActions ?? [];
  const dept = getDepartment(proc);
  const owner = getOwner(proc);

  const activitiesTable = proc.analysis?.documentMetadata?.activitiesTable ?? [];
  const totalPotentialHrs = quickWins.reduce((s, qw) => {
    if (qw.category === "Removal" || qw.category === "Parallelization") {
      const entry =
        activitiesTable.find((a) => a.id === qw.stepId) ??
        activitiesTable.find((a) => a.name?.toLowerCase() === qw.stepName?.toLowerCase());
      if (entry?.actualTime) {
        const unit = (entry.actualTimeUnit ?? "").toLowerCase();
        const hrs = unit.includes("day") ? entry.actualTime * 8
          : unit.includes("min") ? entry.actualTime / 60
          : entry.actualTime;
        return s + (qw.category === "Parallelization" ? hrs * 0.5 : hrs);
      }
    }
    return s + parseToHours(qw.estimatedTimeSaving);
  }, 0);

  const highBottlenecks = bottlenecks.filter((b: DiagnosisBottleneck) => b.impact === "High");
  const revisedFlowSteps = useMemo(() => buildRevisedFlow(proc), [proc]);

  return (
    <div className="rounded-2xl"
      style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", boxShadow: "var(--sf-shadow-sm)" }}>
      <div className="h-0.5 rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-gold) 100%)" }} />

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
            {quickWins.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>
                {quickWins.length} improvement{quickWins.length !== 1 ? "s" : ""}
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
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
              {highBottlenecks.length} critical
            </span>
          )}
          {totalPotentialHrs > 0 && (
            <span className="text-xs font-semibold" style={{ color: "var(--hr-teal)" }}>
              {Math.round(totalPotentialHrs)} hrs
            </span>
          )}
          <svg className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--sf-text-faint)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-6 px-5 pb-6" style={{ borderTop: "1px solid var(--sf-border-soft)" }}>

          {/* 1 · Current Pain Points */}
          {bottlenecks.length > 0 && (
            <section className="pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />
                Current Pain Points
              </h3>
              <ul className="space-y-2">
                {bottlenecks.map((b: DiagnosisBottleneck, i: number) => {
                  const ic = b.impact === "High" ? "#dc2626" : b.impact === "Medium" ? "#d97706" : "#16a34a";
                  const util = b.timingIssue?.utilizationPercent ?? 0;
                  return (
                    <li key={i} className="rounded-xl p-3"
                      style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>{b.stepName}</p>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>{b.reason}</p>
                        </div>
                        <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ color: ic, background: `${ic}14` }}>{b.impact}</span>
                      </div>
                      {util > 0 && (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>Utilisation</span>
                            <span className="text-xs font-semibold" style={{ color: ic }}>{util}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--sf-border)" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, background: ic }} />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* 2 · Suggested Improvements (step-level framework refs) */}
          {quickWins.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-teal)" }} />
                Suggested Improvements — Effort vs. Impact
              </h3>
              <p className="mb-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                Each step card includes an applicable framework tag. Click the tag to expand step-level implementation guidance (Lean, Six Sigma, or SIA Partners framework).
              </p>
              <EffortImpactMatrix quickWins={quickWins} wasteFilter={wasteFilter} />
            </section>
          )}

          {/* 3 · Revised Process Flow Suggestion */}
          {revisedFlowSteps.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-gold)" }} />
                Revised Process Flow Suggestion
              </h3>
              <p className="mb-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                Proposed changes per step — remove, merge, parallelise, or simplify — with assigned owner and delivery timeline.
              </p>
              <RevisedFlowPanel steps={revisedFlowSteps} />
            </section>
          )}

          {/* 4 · Priority Owner Actions */}
          {priorityActions.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-navy)" }} />
                Priority Owner Actions
              </h3>
              <ol className="space-y-2">
                {priorityActions.map((pa) => (
                  <li key={pa.order} className="flex gap-3 rounded-xl p-3"
                    style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: "var(--hr-gold)", color: "#0a151e" }}>
                      {pa.order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>{pa.action}</p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>{pa.rationale}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 5 · Process Metrics */}
          {proc.diagnosis?.processMetrics && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-navy)" }} />
                Process Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Current Duration", value: proc.diagnosis.processMetrics.totalDuration },
                  { label: "Dept. Handoffs", value: String(proc.diagnosis.processMetrics.departmentHandoffs ?? 0) },
                  { label: "Approval Layers", value: String(proc.diagnosis.processMetrics.approvalLayers ?? 0) },
                  { label: "Improvements", value: `${quickWins.length} identified` },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl p-3 text-center"
                    style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--sf-text)" }}>{m.value}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>{m.label}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6 · Step-Level Detail */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hr-teal)" }} />
              Step-Level Detail
            </h3>
            <StepLevelView process={proc} />
          </section>

          {/* CTA */}
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

export default function ManualWorkbench() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [wasteFilter, setWasteFilter] = useState<WasteCategory>("All");

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
    const manualProcesses = flatProcesses.filter((fp) => {
      const primary = fp.process.diagnosis?.automationClassification?.primaryClassification;
      const scores = fp.process.diagnosis?.automationClassification?.pathwayScores;
      const manualScore = scores?.manualOptimization ?? 0;
      const hasQW = (fp.process.diagnosis?.quickWins ?? []).length > 0;
      return primary === "Manual Optimization" || manualScore >= 30 || hasQW;
    });
    if (wasteFilter === "All") return manualProcesses;
    return manualProcesses.filter((fp) =>
      (fp.process.diagnosis?.quickWins ?? []).some((qw) => qw.category === wasteFilter),
    );
  }, [flatProcesses, wasteFilter]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sf-bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--hr-navy-light)" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manual &amp; Lean Workbench – Process Excellence | SIA Partners</title>
        <meta name="description"
          content="Lean and Six Sigma improvement recommendations for SIA Partners processes not suited to automation" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>
        {/* ── Header ── */}
        <header className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,0.97)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(14px)",
            boxShadow: "var(--sf-shadow-sm)",
          }}>
          <div className="h-0.5"
            style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 55%, var(--hr-gold) 100%)" }} />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Image src="/assets/sia-logo.png" alt="SIA Partners" width={110} height={36} className="h-9 w-auto" />
              </Link>
              <div className="hidden h-5 w-px sm:block" style={{ background: "var(--sf-border)" }} />
              <span className="hidden text-xs font-semibold sm:block" style={{ color: "var(--sf-text-muted)" }}>
                Manual &amp; Lean Workbench
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/executive-dashboard" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">Portfolio</Link>
              <Link href="/ai-use-case-library" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">AI Use Cases</Link>
              <Link href="/rpa-blueprint" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">RPA Blueprint</Link>
              <Link href="/dashboard" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">My Processes</Link>
              <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="hr-lang-toggle">
                {lang === "en" ? "العربية" : "English"}
              </button>
              <button
                onClick={() => void signOut().then(() => void router.replace("/"))}
                className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
              Manual &amp; Lean Optimization Workbench
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Structured improvement recommendations for processes not suited to automation. Framework guidance (Lean, Six Sigma, SIA Partners Digital) is provided at the <strong>step level</strong> — click any framework tag to expand step-specific implementation blueprints.
            </p>
          </div>

          {/* Filter bar */}
          {!fetching && (
            <div className="mb-5 flex flex-wrap gap-2">
              {LEAN_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setWasteFilter(f.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: wasteFilter === f.value ? "var(--hr-navy)" : "var(--sf-surface)",
                    color: wasteFilter === f.value ? "#fff" : "var(--sf-text-muted)",
                    border: `1px solid ${wasteFilter === f.value ? "var(--hr-navy)" : "var(--sf-border)"}`,
                  }}
                >
                  {f.label}
                  {f.lean && <span className="ml-1.5 hidden opacity-60 sm:inline">{f.lean}</span>}
                </button>
              ))}
            </div>
          )}

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--hr-navy-light)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
              style={{ borderColor: "var(--sf-border)" }}>
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No processes matching{" "}
                {wasteFilter !== "All" ? <strong>{wasteFilter}</strong> : "the current"}{" "}filter found
              </p>
              {wasteFilter !== "All" && (
                <button onClick={() => setWasteFilter("All")} className="text-xs font-semibold underline"
                  style={{ color: "var(--hr-teal)" }}>
                  Clear filter
                </button>
              )}
              <Link href="/dashboard" className="sf-button-primary rounded-lg px-4 py-2 text-sm font-semibold">
                Upload &amp; Diagnose Processes
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                {filtered.length} {filtered.length === 1 ? "process" : "processes"} — click to expand recommendations
              </p>
              {filtered.map((fp) => (
                <WorkbenchCard
                  key={`${fp.projectId}-${fp.process.processIndex}`}
                  fp={fp}
                  wasteFilter={wasteFilter}
                />
              ))}
            </div>
          )}
        </main>

        <footer className="mt-auto px-6 py-5"
          style={{ background: "var(--sf-surface)", borderTop: "1px solid var(--sf-border)" }}>
          <p className="mx-auto max-w-7xl text-xs" style={{ color: "var(--sf-text-faint)" }}>
            Recommendations are AI-generated based on uploaded process documents. Framework guidance is provided at step level to support direct application of Lean, Six Sigma, and SIA Partners Digital Strategy principles. Timeline estimates are heuristic: Low effort ≈ 1–2 weeks · Medium ≈ 4–6 weeks · High ≈ 8–12 weeks. Always validate with process owners before implementing changes.
          </p>
        </footer>
      </div>
    </>
  );
}
