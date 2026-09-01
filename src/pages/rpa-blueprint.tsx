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
  StepOptimizationClassification,
} from "@/server/services/ProcessOptimizer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Derive trigger type from step name/context
function deriveTriggerType(step: StepOptimizationClassification): "Scheduled" | "Event-driven" {
  const name = step.stepName.toLowerCase();
  const desc = (step.currentStateDescription ?? "").toLowerCase();
  const combined = `${name} ${desc}`;
  if (/daily|weekly|monthly|periodic|batch|scheduled|nightly/.test(combined)) return "Scheduled";
  if (/submit|trigger|receiv|initiati|request|form|upload|notify|alert/.test(combined)) return "Event-driven";
  return "Event-driven";
}

// Derive input/output fields from SIPOC + step name
function deriveStepIO(step: StepOptimizationClassification, proc: ProcessWithDiagnosis): { input: string; output: string } {
  const activity = proc.analysis?.documentMetadata?.activitiesTable?.find(
    (a) => a.id === step.stepId || a.name?.toLowerCase() === step.stepName?.toLowerCase(),
  );
  const sipoc = proc.analysis?.documentMetadata?.sipoc;

  // Try to get input from activity's systemUsed or SIPOC inputs
  const input = activity?.systemUsed
    ? `Data from ${activity.systemUsed}`
    : sipoc?.inputs?.slice(0, 1).join(", ") ?? "Process data / documents";

  const output =
    sipoc?.outputs?.slice(0, 1).join(", ") ??
    `Processed ${step.stepName.toLowerCase()} result`;

  return { input, output };
}

// Estimate bot dev effort based on RPA step count + step complexity
function estimateBotEffort(rpaStepCount: number): { tier: "Low" | "Medium" | "High"; weeks: string } {
  if (rpaStepCount <= 3) return { tier: "Low", weeks: "1–2 weeks" };
  if (rpaStepCount <= 7) return { tier: "Medium", weeks: "3–5 weeks" };
  return { tier: "High", weeks: "6–10 weeks" };
}

// Tool recommendation based on process characteristics
function recommendTool(proc: ProcessWithDiagnosis): { name: string; rationale: string; logo: string }[] {
  const systems = (proc.analysis?.documentMetadata?.activitiesTable ?? [])
    .map((a) => (a.systemUsed ?? "").toLowerCase())
    .filter(Boolean);
  const description = (proc.analysis?.documentMetadata?.description ?? "").toLowerCase();
  const combined = systems.join(" ") + " " + description;

  const tools: { name: string; rationale: string; logo: string }[] = [];

  if (/sharepoint|teams|office|excel|outlook|microsoft|365/.test(combined)) {
    tools.push({
      name: "Microsoft Power Automate",
      rationale: "Native integration with Microsoft 365, SharePoint, and Teams — no complex connectors needed.",
      logo: "PA",
    });
  }
  if (/sap|oracle|desktop|gui|legacy|citrix|java/.test(combined) || tools.length === 0) {
    tools.push({
      name: "UiPath",
      rationale: "Industry-leading enterprise RPA for document processing, GUI automation, and complex orchestration.",
      logo: "UI",
    });
  }
  if (/enterprise|large.scale|audit|compliance|bank|finance|government/.test(combined)) {
    tools.push({
      name: "Blue Prism",
      rationale: "Strong audit trails, enterprise-grade security, and governance — well-suited for regulated government processes.",
      logo: "BP",
    });
  }

  // Always include at least one tool
  if (tools.length === 0) {
    tools.push({
      name: "UiPath",
      rationale: "Recommended as the default enterprise RPA platform with broad system integration support.",
      logo: "UI",
    });
  }
  return tools.slice(0, 2);
}

// Generate backlog user stories from RPA steps
function generateUserStories(
  rpaSteps: StepOptimizationClassification[],
  proc: ProcessWithDiagnosis,
): Array<{ id: string; story: string; acceptanceCriteria: string[]; effort: "S" | "M" | "L" }> {
  return rpaSteps.map((step, i) => {
    const trigger = deriveTriggerType(step);
    const io = deriveStepIO(step, proc);
    const stepDesc = step.currentStateDescription ?? step.reason ?? step.stepName;

    return {
      id: `RPA-${String(i + 1).padStart(3, "0")}`,
      story: `As an RPA bot, I need to ${step.stepName.toLowerCase()} ${
        trigger === "Scheduled" ? "on a scheduled basis" : "when triggered by an event"
      } so that ${stepDesc.slice(0, 80).toLowerCase()}.`,
      acceptanceCriteria: [
        `Bot reads input from: ${io.input}`,
        `Bot produces output to: ${io.output}`,
        `Trigger type: ${trigger}`,
        `Error handling: log exceptions and notify process owner`,
        `Audit trail: each execution logged with timestamp and status`,
      ],
      effort: i < 2 ? "S" : i < 5 ? "M" : "L",
    };
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RPABlueprintEntry {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
  department: string;
  owner: string;
  rpaSteps: StepOptimizationClassification[];
  botEffort: { tier: "Low" | "Medium" | "High"; weeks: string };
  recommendedTools: { name: string; rationale: string; logo: string }[];
  userStories: Array<{ id: string; story: string; acceptanceCriteria: string[]; effort: "S" | "M" | "L" }>;
  confidenceScore: number;
}

function buildBlueprints(projects: Project[]): RPABlueprintEntry[] {
  const entries: RPABlueprintEntry[] = [];
  for (const proj of projects) {
    const processes = Array.isArray(proj.processes) ? proj.processes : [];
    for (const p of processes) {
      const proc = p as ProcessWithDiagnosis;
      const primary = proc.diagnosis?.automationClassification?.primaryClassification;
      const scores = proc.diagnosis?.automationClassification?.pathwayScores;
      const rpaScore = scores?.classicalRpa ?? 0;
      if (primary !== "Classical RPA" && rpaScore < 40) continue;

      const rpaSteps = (proc.diagnosis?.stepClassifications ?? []).filter(
        (s) => s.classification === "Classical RPA",
      );
      // If no step-level RPA steps, include the process anyway if process-level classified
      const effort = estimateBotEffort(rpaSteps.length || 1);

      entries.push({
        projectId: proj.id,
        projectName: proj.name,
        process: proc,
        department: getDepartment(proc),
        owner: getOwner(proc),
        rpaSteps,
        botEffort: effort,
        recommendedTools: recommendTool(proc),
        userStories: generateUserStories(rpaSteps, proc),
        confidenceScore: proc.diagnosis?.automationClassification?.confidenceScore ?? 0,
      });
    }
  }
  return entries;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const EFFORT_COLORS: Record<"Low" | "Medium" | "High", { bg: string; color: string }> = {
  Low:    { bg: "rgba(22,163,74,0.10)",  color: "#15803d" },
  Medium: { bg: "rgba(234,179,8,0.12)",  color: "#a16207" },
  High:   { bg: "rgba(220,38,38,0.10)",  color: "#b91c1c" },
};

const STORY_EFFORT_LABEL: Record<"S" | "M" | "L", string> = {
  S: "1–2 pts",
  M: "3–5 pts",
  L: "8–13 pts",
};

const TRIGGER_COLORS: Record<"Scheduled" | "Event-driven", { bg: string; color: string }> = {
  "Scheduled":    { bg: "rgba(99,102,241,0.10)", color: "#4338ca" },
  "Event-driven": { bg: "rgba(29,233,182,0.10)", color: "#077c84" },
};

// ─── Step Decomposition Table ─────────────────────────────────────────────────

function StepDecompositionTable({ rpaSteps, proc }: { rpaSteps: StepOptimizationClassification[]; proc: ProcessWithDiagnosis }) {
  if (rpaSteps.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>
        No step-level RPA classifications found. Process was classified as RPA at the process level.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--sf-border-soft)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "var(--sf-surface-muted)", borderBottom: "1px solid var(--sf-border-soft)" }}>
            {["#", "Step / Bot Action", "Trigger", "Input", "Output", "Dev Effort"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--sf-text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rpaSteps.map((step, i) => {
            const trigger = deriveTriggerType(step);
            const io = deriveStepIO(step, proc);
            const tc = TRIGGER_COLORS[trigger];
            return (
              <tr
                key={step.stepId ?? i}
                style={{ borderBottom: "1px solid var(--sf-border-soft)", background: i % 2 === 0 ? "var(--sf-surface)" : "var(--sf-surface-muted)" }}
              >
                <td className="px-3 py-2.5 font-mono font-bold" style={{ color: "var(--sf-text-faint)", fontSize: "0.65rem" }}>
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold" style={{ color: "var(--sf-text)" }}>{step.stepName}</p>
                  {step.currentStateDescription && (
                    <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--sf-text-muted)", fontSize: "0.65rem" }}>
                      {step.currentStateDescription.slice(0, 100)}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: tc.bg, color: tc.color, fontSize: "0.65rem" }}>
                    {trigger}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>{io.input}</td>
                <td className="px-3 py-2.5 text-xs" style={{ color: "var(--sf-text-muted)" }}>{io.output}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: "rgba(29,233,182,0.09)", color: "#077c84", fontSize: "0.65rem" }}>
                    {i < 2 ? "Low" : i < 5 ? "Med" : "High"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── RPA Blueprint Card ────────────────────────────────────────────────────────

function RPABlueprintCard({ entry }: { entry: RPABlueprintEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "tools" | "roadmap">("steps");
  const proc = entry.process;
  const ec = EFFORT_COLORS[entry.botEffort.tier];

  return (
    <div
      className="rounded-2xl"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
    >
      {/* Teal accent bar */}
      <div className="h-0.5 rounded-t-2xl" style={{ background: "linear-gradient(90deg, var(--hr-teal) 0%, #0a151e 100%)" }} />

      {/* Header */}
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
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={ec}
            >
              {entry.botEffort.tier} Effort · {entry.botEffort.weeks}
            </span>
            {entry.rpaSteps.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(29,233,182,0.09)", color: "#077c84" }}>
                {entry.rpaSteps.length} RPA step{entry.rpaSteps.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>
            {entry.projectName}
            {entry.department !== "—" && ` · ${entry.department}`}
            {entry.owner !== "—" && ` · ${entry.owner}`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="hidden text-xs font-semibold sm:block" style={{ color: "var(--sf-text-faint)" }}>
            Confidence: {entry.confidenceScore}/100
          </span>
          <svg
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--sf-text-faint)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="space-y-5 px-5 pb-6"
          style={{ borderTop: "1px solid var(--sf-border-soft)" }}
        >
          {/* Process classification summary */}
          <div className="mt-4 rounded-xl p-4" style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>Primary Classification</p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--hr-teal)" }}>
                  Classical RPA — Rule-Based Deterministic Automation
                </p>
              </div>
              <div className="ml-auto">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full overflow-hidden" style={{ background: "var(--sf-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${entry.confidenceScore}%`, background: "var(--hr-teal)" }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--hr-teal)" }}>{entry.confidenceScore}%</span>
                </div>
              </div>
            </div>
            {(proc.diagnosis?.automationClassification?.keyFactors ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {proc.diagnosis?.automationClassification?.keyFactors.map((f, i) => (
                  <span key={i} className="rounded-lg px-2 py-0.5 text-xs"
                    style={{ background: "rgba(29,233,182,0.08)", color: "#077c84", border: "1px solid rgba(29,233,182,0.18)" }}>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1" style={{ borderBottom: "1px solid var(--sf-border-soft)" }}>
            {([
              { key: "steps" as const, label: "Step Decomposition" },
              { key: "tools" as const, label: "Tool Recommendation" },
              { key: "roadmap" as const, label: `Roadmap (${entry.userStories.length} stories)` },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  color: activeTab === tab.key ? "var(--hr-teal)" : "var(--sf-text-muted)",
                  borderBottom: activeTab === tab.key ? "2px solid var(--hr-teal)" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Step Decomposition ── */}
          {activeTab === "steps" && (
            <div>
              <p className="mb-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                Rule-based, deterministic logic only — no LLM dependency in the automation.
              </p>
              <StepDecompositionTable rpaSteps={entry.rpaSteps} proc={proc} />
            </div>
          )}

          {/* ── Tab: Tool Recommendation ── */}
          {activeTab === "tools" && (
            <div className="space-y-3">
              {entry.recommendedTools.map((tool) => (
                <div key={tool.name} className="flex items-start gap-4 rounded-xl p-4"
                  style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black"
                    style={{ background: "rgba(29,233,182,0.12)", color: "var(--hr-teal)" }}
                  >
                    {tool.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" style={{ color: "var(--sf-text)" }}>{tool.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>{tool.rationale}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-xl p-3" style={{ background: "rgba(10, 21, 30,0.05)", border: "1px solid rgba(10, 21, 30,0.12)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--hr-navy)" }}>Estimated Bot Development Effort</p>
                <p className="mt-1 text-sm font-bold" style={{ color: "var(--sf-text)" }}>
                  {entry.botEffort.tier} · {entry.botEffort.weeks}
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--sf-text-muted)" }}>
                    ({entry.rpaSteps.length} automated steps to develop)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* ── Tab: Roadmap (User Stories) ── */}
          {activeTab === "roadmap" && (
            <div className="space-y-3">
              {entry.userStories.length === 0 ? (
                <p className="text-xs italic" style={{ color: "var(--sf-text-faint)" }}>
                  No step-level RPA steps to generate user stories from. Define step-level classifications to generate a backlog.
                </p>
              ) : (
                entry.userStories.map((us) => (
                  <div key={us.id} className="rounded-xl p-4"
                    style={{ background: "var(--sf-surface-muted)", border: "1px solid var(--sf-border-soft)" }}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-bold" style={{ color: "var(--hr-teal)" }}>{us.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-xs font-semibold"
                          style={{ background: "rgba(29,233,182,0.09)", color: "#077c84", fontSize: "0.65rem" }}>
                          {STORY_EFFORT_LABEL[us.effort]}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: "var(--sf-text)" }}>{us.story}</p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--sf-text-muted)" }}>Acceptance Criteria:</p>
                      {us.acceptanceCriteria.map((ac, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                          <span className="mt-0.5 flex-shrink-0">✓</span>
                          <span>{ac}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center justify-between pt-1">
            <Link
              href={`/process-optimizer?projectId=${entry.projectId}`}
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

export default function RPABlueprint() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterDept, setFilterDept] = useState("All");
  const [filterEffort, setFilterEffort] = useState<"All" | "Low" | "Medium" | "High">("All");

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

  const allBlueprints = useMemo(() => buildBlueprints(projects), [projects]);

  const allDepartments = useMemo(() => {
    const s = new Set(allBlueprints.map((b) => b.department).filter((d) => d !== "—"));
    return ["All", ...Array.from(s).sort()];
  }, [allBlueprints]);

  const filtered = useMemo(() => {
    return allBlueprints.filter((b) => {
      if (filterDept !== "All" && b.department !== filterDept) return false;
      if (filterEffort !== "All" && b.botEffort.tier !== filterEffort) return false;
      return true;
    });
  }, [allBlueprints, filterDept, filterEffort]);

  const handleExport = () => {
    const data = allBlueprints.map((b) => ({
      processName: b.process.analysis?.processName ?? "Unnamed",
      projectName: b.projectName,
      department: b.department,
      owner: b.owner,
      botDevelopmentEffort: b.botEffort,
      confidenceScore: b.confidenceScore,
      recommendedTools: b.recommendedTools.map((t) => t.name),
      rpaStepCount: b.rpaSteps.length,
      steps: b.rpaSteps.map((s) => ({
        id: s.stepId,
        name: s.stepName,
        triggerType: deriveTriggerType(s),
        ...deriveStepIO(s, b.process),
      })),
      userStories: b.userStories,
    }));
    const blob = new Blob(
      [JSON.stringify({ exportDate: new Date().toISOString(), blueprints: data }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-rpa-blueprints-${new Date().toISOString().slice(0, 10)}.json`;
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
        <title>RPA Blueprint – Classical Automation Pathway | SIA Partners</title>
        <meta name="description" content="Task-level RPA blueprints with bot logic, trigger conditions, and tool compatibility for SIA Partners process automation" />
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
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, var(--hr-teal) 0%, var(--hr-navy) 100%)" }} />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Image src="/assets/sia-logo.png" alt="SIA Partners" width={110} height={36} className="h-9 w-auto" />
              </Link>
              <div className="hidden h-5 w-px sm:block" style={{ background: "var(--sf-border)" }} />
              <span className="hidden text-xs font-semibold sm:block" style={{ color: "var(--sf-text-muted)" }}>
                RPA Blueprint
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/executive-dashboard" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">Portfolio</Link>
              <Link href="/ai-use-case-library" className="hr-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium">AI Use Cases</Link>
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
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>RPA Blueprint</h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                Task-level breakdown for each RPA process — bot logic, trigger conditions, tool compatibility, and backlog-ready user stories.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={allBlueprints.length === 0}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
              style={{ background: "var(--hr-teal)", color: "#fff" }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Blueprints
            </button>
          </div>

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--hr-teal)" }} />
            </div>
          ) : allBlueprints.length === 0 ? (
            <div
              className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
              style={{ borderColor: "var(--sf-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                No RPA-classified processes found. Upload and diagnose processes to generate RPA blueprints.
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
                  { label: "RPA Processes", value: String(allBlueprints.length) },
                  { label: "Total RPA Steps", value: String(allBlueprints.reduce((s, b) => s + b.rpaSteps.length, 0)) },
                  { label: "Total User Stories", value: String(allBlueprints.reduce((s, b) => s + b.userStories.length, 0)) },
                  { label: "Avg. Confidence Score", value: `${Math.round(allBlueprints.reduce((s, b) => s + b.confidenceScore, 0) / (allBlueprints.length || 1))}/100` },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl p-3 text-center"
                    style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", boxShadow: "var(--sf-shadow-sm)" }}>
                    <p className="text-xl font-bold" style={{ color: "var(--sf-text)" }}>{m.value}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--sf-text-muted)" }}>Filter:</span>
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
                {(["All", "Low", "Medium", "High"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setFilterEffort(tier)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: filterEffort === tier ? "var(--hr-teal)" : "var(--sf-surface)",
                      color: filterEffort === tier ? "#fff" : "var(--sf-text-muted)",
                      border: `1px solid ${filterEffort === tier ? "var(--hr-teal)" : "var(--sf-border)"}`,
                    }}
                  >
                    {tier === "All" ? "All Effort" : `${tier} Effort`}
                  </button>
                ))}
              </div>

              {/* Blueprint cards */}
              <div>
                <p className="mb-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                  {filtered.length} blueprint{filtered.length !== 1 ? "s" : ""} — click to expand
                </p>
                {filtered.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-2xl" style={{ border: "2px dashed var(--sf-border)" }}>
                    <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>No blueprints match the current filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((entry) => (
                      <RPABlueprintCard
                        key={`${entry.projectId}-${entry.process.processIndex}`}
                        entry={entry}
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
