import { useState } from "react";
import type {
  ProcessWithDiagnosis,
  StepOptimizationClassification,
  DiagnosisBottleneck,
  DiagnosisQuickWin,
  AutomationPathway,
} from "@/server/services/ProcessOptimizer";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EnrichedStep {
  id: string;
  name: string;
  nameArabic?: string;
  performedBy: string;
  department?: string;
  actualTime: number;
  actualTimeUnit: string;
  availableTime: number;
  availableTimeUnit: string;
  systemUsed?: string;
  utilizationPercent: number | null;
  classification: StepOptimizationClassification | null;
  bottleneck: DiagnosisBottleneck | null;
  quickWins: DiagnosisQuickWin[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PATHWAY_COLORS: Record<AutomationPathway, { bg: string; text: string; border: string }> = {
  "AI Agent": { bg: "rgba(0, 51, 28,0.09)", text: "#00331c", border: "rgba(0, 51, 28,0.25)" },
  "Classical RPA": { bg: "rgba(26,158,143,0.09)", text: "#0d7a6e", border: "rgba(26,158,143,0.25)" },
  "Manual Optimization": { bg: "rgba(201,168,76,0.12)", text: "#8a6b18", border: "rgba(201,168,76,0.25)" },
  "As-Is": { bg: "rgba(100,116,139,0.08)", text: "#475569", border: "rgba(100,116,139,0.2)" },
};

// ─── Computation ────────────────────────────────────────────────────────────

export function computeEnrichedSteps(proc: ProcessWithDiagnosis): EnrichedStep[] {
  const activitiesTable = proc.analysis?.documentMetadata?.activitiesTable ?? [];
  const processSteps = proc.analysis?.processSteps ?? [];
  const stepClassifications = proc.diagnosis?.stepClassifications ?? [];
  const bottlenecks = proc.diagnosis?.bottlenecks ?? [];
  const quickWins = proc.diagnosis?.quickWins ?? [];

  const matchClassification = (stepId: string, stepName: string): StepOptimizationClassification | null =>
    stepClassifications.find(
      (sc) => sc.stepId === stepId || sc.stepName.toLowerCase() === stepName.toLowerCase(),
    ) ?? null;

  const matchBottleneck = (stepId: string, stepName: string): DiagnosisBottleneck | null =>
    bottlenecks.find(
      (b) => b.stepId === stepId || b.stepName.toLowerCase() === stepName.toLowerCase(),
    ) ?? null;

  const matchQuickWins = (stepId: string, stepName: string): DiagnosisQuickWin[] =>
    quickWins.filter(
      (qw) =>
        qw.stepId === stepId ||
        (qw.stepName ?? "").toLowerCase() === stepName.toLowerCase(),
    );

  if (activitiesTable.length > 0) {
    return activitiesTable.map((step) => {
      const util =
        step.availableTime > 0
          ? Math.round((step.actualTime / step.availableTime) * 100)
          : null;
      return {
        id: step.id,
        name: step.name,
        nameArabic: step.nameArabic,
        performedBy: step.performedBy,
        department: step.department,
        actualTime: step.actualTime,
        actualTimeUnit: step.actualTimeUnit,
        availableTime: step.availableTime,
        availableTimeUnit: step.availableTimeUnit,
        systemUsed: step.systemUsed,
        utilizationPercent: util,
        classification: matchClassification(step.id, step.name),
        bottleneck: matchBottleneck(step.id, step.name),
        quickWins: matchQuickWins(step.id, step.name),
      };
    });
  }

  // Fallback to processSteps when activitiesTable is absent
  return processSteps.map((step) => ({
    id: step.id,
    name: step.name,
    nameArabic: undefined,
    performedBy: step.role,
    department: step.department,
    actualTime: step.leadTime ?? 0,
    actualTimeUnit: "hrs",
    availableTime: 0,
    availableTimeUnit: "hrs",
    systemUsed: step.systemUsed ? "System" : undefined,
    utilizationPercent: null,
    classification: matchClassification(step.id, step.name),
    bottleneck: matchBottleneck(step.id, step.name),
    quickWins: matchQuickWins(step.id, step.name),
  }));
}

// ─── StepCard ───────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: EnrichedStep; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const hasBottleneck = step.bottleneck !== null;
  const impactColor =
    step.bottleneck?.impact === "High"
      ? "#dc2626"
      : step.bottleneck?.impact === "Medium"
        ? "#d97706"
        : "#16a34a";

  const pathwayCfg = step.classification
    ? PATHWAY_COLORS[step.classification.classification]
    : null;

  const util = step.utilizationPercent;
  const utilColor =
    util !== null
      ? util > 90
        ? "#dc2626"
        : util > 70
          ? "#d97706"
          : "#16a34a"
      : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${hasBottleneck ? `${impactColor}40` : "var(--sf-border-soft)"}`,
        background: "var(--sf-surface-muted)",
      }}
    >
      {/* Collapsed row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Step number badge */}
        <span
          className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--hr-navy)", color: "#fff" }}
        >
          {index}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {step.id && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--sf-border)",
                  color: "var(--sf-text-muted)",
                  fontSize: "0.65rem",
                }}
              >
                {step.id}
              </span>
            )}
            <span
              className="text-sm font-semibold truncate"
              style={{ color: "var(--sf-text)" }}
            >
              {step.name}
            </span>
            {step.nameArabic && (
              <span
                className="text-xs italic hidden sm:inline"
                style={{ color: "var(--sf-text-faint)" }}
              >
                {step.nameArabic}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            {step.performedBy && (
              <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                👤 {step.performedBy}
              </span>
            )}
            {step.department && (
              <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                🏢 {step.department}
              </span>
            )}
            {step.systemUsed && (
              <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                💻 {step.systemUsed}
              </span>
            )}
            {step.actualTime > 0 && (
              <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                ⏱ {step.actualTime} {step.actualTimeUnit}
              </span>
            )}
          </div>
        </div>

        {/* Right badges */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {hasBottleneck && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: `${impactColor}14`, color: impactColor }}
            >
              ⚠ {step.bottleneck!.impact}
            </span>
          )}
          {step.quickWins.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: "rgba(22,163,74,0.08)",
                color: "#16a34a",
              }}
            >
              {step.quickWins.length} win{step.quickWins.length !== 1 ? "s" : ""}
            </span>
          )}
          {pathwayCfg && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold hidden md:inline-flex"
              style={{ background: pathwayCfg.bg, color: pathwayCfg.text }}
            >
              {step.classification!.classification}
            </span>
          )}
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--sf-text-faint)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-3 space-y-4"
          style={{ borderTop: "1px solid var(--sf-border-soft)" }}
        >
          {/* All fields grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Step ID", value: step.id ?? "—" },
              { label: "Performed By", value: step.performedBy ?? "—" },
              { label: "Department", value: step.department ?? "—" },
              {
                label: "Actual Time",
                value: step.actualTime > 0 ? `${step.actualTime} ${step.actualTimeUnit}` : "—",
              },
              {
                label: "Available Time",
                value: step.availableTime > 0 ? `${step.availableTime} ${step.availableTimeUnit}` : "—",
              },
                { label: "System Used", value: step.systemUsed ?? "Manual / None" },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-lg p-2.5"
                style={{
                  background: "var(--sf-surface)",
                  border: "1px solid var(--sf-border-soft)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  {f.label}
                </p>
                <p
                  className="mt-0.5 text-sm font-semibold truncate"
                  style={{ color: "var(--sf-text)" }}
                >
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* Utilization bar */}
          {util !== null && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  Utilisation ({step.actualTime} / {step.availableTime} {step.actualTimeUnit})
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: utilColor ?? "var(--sf-text)" }}
                >
                  {util}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--sf-border)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(util, 100)}%`,
                    background: utilColor ?? "var(--hr-teal)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Automation classification */}
          {step.classification && pathwayCfg && (
            <div
              className="rounded-xl p-3"
              style={{
                background: pathwayCfg.bg,
                border: `1px solid ${pathwayCfg.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold" style={{ color: pathwayCfg.text }}>
                  {step.classification.classification}
                </span>
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{ background: pathwayCfg.border, color: pathwayCfg.text }}
                >
                  {step.classification.confidenceScore}% confidence
                </span>
              </div>
              {step.classification.currentStateDescription && (
                <p className="text-xs mb-1" style={{ color: "var(--sf-text-muted)" }}>
                  {step.classification.currentStateDescription}
                </p>
              )}
              {step.classification.reason && (
                <p
                  className="text-xs italic"
                  style={{ color: "var(--sf-text-faint)" }}
                >
                  {step.classification.reason}
                </p>
              )}
            </div>
          )}

          {/* Bottleneck */}
          {step.bottleneck && (
            <div
              className="rounded-xl p-3"
              style={{
                background: `${impactColor}08`,
                border: `1px solid ${impactColor}33`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold" style={{ color: impactColor }}>
                  ⚠ Bottleneck — {step.bottleneck.impact} Impact
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                {step.bottleneck.reason}
              </p>
              {step.bottleneck.timingIssue?.utilizationPercent > 0 && (
                <p
                  className="mt-1 text-xs font-semibold"
                  style={{ color: impactColor }}
                >
                  Utilisation: {step.bottleneck.timingIssue.utilizationPercent}% &mdash;{" "}
                  {step.bottleneck.timingIssue.actualTime} / {step.bottleneck.timingIssue.availableTime} days
                </p>
              )}
            </div>
          )}

          {/* Quick wins */}
          {step.quickWins.length > 0 && (
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wide mb-2"
                style={{ color: "var(--sf-text-muted)" }}
              >
                Improvement Opportunities
              </h4>
              <ul className="space-y-2">
                {step.quickWins.map((qw, i) => (
                  <li
                    key={i}
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(22,163,74,0.06)",
                      border: "1px solid rgba(22,163,74,0.22)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span
                        className="text-xs font-semibold flex-1"
                        style={{ color: "var(--sf-text)" }}
                      >
                        {qw.suggestion}
                      </span>
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-0.5 font-bold"
                        style={{
                          background: "rgba(22,163,74,0.1)",
                          color: "#16a34a",
                          fontSize: "0.6rem",
                        }}
                      >
                        {qw.category}
                      </span>
                    </div>
                    <div
                      className="flex flex-wrap gap-3 text-xs"
                      style={{ color: "var(--sf-text-faint)" }}
                    >
                      <span>
                        Effort:{" "}
                        <strong style={{ color: "var(--sf-text-muted)" }}>{qw.effort}</strong>
                      </span>
                      <span>
                        Impact:{" "}
                        <strong style={{ color: "var(--sf-text-muted)" }}>{qw.impact}</strong>
                      </span>
                      {qw.estimatedTimeSaving && (
                        <span style={{ color: "var(--hr-teal)", fontWeight: 600 }}>
                          ⏱ {qw.estimatedTimeSaving}
                        </span>
                      )}
                      {qw.bestPractice && (
                        <span
                          className="rounded px-1.5 py-0.5 font-bold"
                          style={{
                            background: "rgba(0, 51, 28,0.08)",
                            color: "var(--hr-navy)",
                            fontSize: "0.6rem",
                          }}
                        >
                          {qw.bestPractice}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StepLevelView (main export) ────────────────────────────────────────────

export function StepLevelView({ process: proc }: { process: ProcessWithDiagnosis }) {
  const steps = computeEnrichedSteps(proc);

  if (steps.length === 0) {
    return (
      <div
        className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed"
        style={{ borderColor: "var(--sf-border)" }}
      >
        <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
          No step-level data available for this process.
        </p>
      </div>
    );
  }

  const bottleneckCount = steps.filter((s) => s.bottleneck !== null).length;
  const quickWinCount = steps.reduce((sum, s) => sum + s.quickWins.length, 0);
  const classifiedCount = steps.filter((s) => s.classification !== null).length;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold" style={{ color: "var(--sf-text-muted)" }}>
          {steps.length} step{steps.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-3 text-xs">
          {bottleneckCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#dc2626" }}>
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{ background: "#dc2626" }}
              />
              {bottleneckCount} bottleneck{bottleneckCount !== 1 ? "s" : ""}
            </span>
          )}
          {quickWinCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#16a34a" }}>
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{ background: "#16a34a" }}
              />
              {quickWinCount} quick win{quickWinCount !== 1 ? "s" : ""}
            </span>
          )}
          {classifiedCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: "var(--sf-text-faint)" }}>
              {classifiedCount} / {steps.length} classified
            </span>
          )}
        </div>
        <span
          className="ml-auto text-xs"
          style={{ color: "var(--sf-text-faint)" }}
        >
          Click a step to expand all fields
        </span>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <StepCard key={step.id || String(idx)} step={step} index={idx + 1} />
        ))}
      </div>
    </div>
  );
}
