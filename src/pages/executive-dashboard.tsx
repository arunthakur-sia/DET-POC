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

function potentialHoursForProcess(proc: ProcessWithDiagnosis): number {
  return (proc.diagnosis?.quickWins ?? []).reduce(
    (sum, qw) => sum + parseToHours(qw.estimatedTimeSaving),
    0,
  );
}

function getComplexityTier(proc: ProcessWithDiagnosis): "Low" | "Medium" | "High" {
  const handoffs = proc.diagnosis?.processMetrics?.departmentHandoffs ?? 0;
  const approvals = proc.diagnosis?.processMetrics?.approvalLayers ?? 0;
  const steps = (proc.analysis?.processSteps ?? []).length;
  const score = handoffs * 2 + approvals * 2 + Math.floor(steps / 5);
  if (score >= 8) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function getDepartment(proc: ProcessWithDiagnosis): string {
  return (
    proc.analysis?.documentMetadata?.department ??
    proc.analysis?.departments?.[0] ??
    "—"
  );
}

function getOwner(proc: ProcessWithDiagnosis): string {
  return (
    proc.analysis?.documentMetadata?.processOwner ??
    proc.analysis?.processOwners?.[0]?.role ??
    "—"
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PATHWAY_COLORS: Record<
  AutomationPathway,
  { stroke: string; bg: string; text: string }
> = {
  "AI Agent": { stroke: "#1b3764", bg: "rgba(27,55,100,0.09)", text: "#1b3764" },
  "Classical RPA": { stroke: "#1a9e8f", bg: "rgba(26,158,143,0.09)", text: "#0d7a6e" },
  "Manual Optimization": { stroke: "#c9a84c", bg: "rgba(201,168,76,0.12)", text: "#8a6b18" },
};

const ALL_PATHWAYS: AutomationPathway[] = [
  "AI Agent",
  "Classical RPA",
  "Manual Optimization",
];

// ─── Flat process model ───────────────────────────────────────────────────────

interface FlatProcess {
  projectId: string;
  projectName: string;
  process: ProcessWithDiagnosis;
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({
  counts,
  total,
}: {
  counts: Record<AutomationPathway, number>;
  total: number;
}) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const sw = 18;
  const circ = 2 * Math.PI * r;

  const bands = ALL_PATHWAYS.map((p) => ({ pathway: p, value: counts[p] }));
  let cumDeg = 0;

  if (total === 0) {
    return (
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sf-border)" strokeWidth={sw} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fill="var(--sf-text-faint)">
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sf-border)" strokeWidth={sw} />

      {bands.map(({ pathway, value }) => {
        if (value === 0) return null;
        const frac = value / total;
        const dash = frac * circ;
        const startDeg = cumDeg;
        cumDeg += frac * 360;
        return (
          <circle
            key={pathway}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={PATHWAY_COLORS[pathway].stroke}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${circ - dash}`}
            transform={`rotate(${startDeg - 90} ${cx} ${cy})`}
          />
        );
      })}

      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="var(--sf-text)"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="var(--sf-text-muted)"
        letterSpacing="0.6"
      >
        PROCESSES
      </text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();
  const isDark = theme === "dark";

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [aedRate, setAedRate] = useState(200);

  // Filters
  const [filterPathway, setFilterPathway] = useState<AutomationPathway | "All">("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [filterComplexity, setFilterComplexity] = useState<"All" | "Low" | "Medium" | "High">("All");

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

  const allDepartments = useMemo(() => {
    const s = new Set(
      flatProcesses.map((fp) => getDepartment(fp.process)).filter((d) => d !== "—"),
    );
    return ["All", ...Array.from(s).sort()];
  }, [flatProcesses]);

  const allOwners = useMemo(() => {
    const s = new Set(
      flatProcesses.map((fp) => getOwner(fp.process)).filter((o) => o !== "—"),
    );
    return ["All", ...Array.from(s).sort()];
  }, [flatProcesses]);

  const filtered = useMemo<FlatProcess[]>(() => {
    return flatProcesses.filter((fp) => {
      const pathway =
        fp.process.diagnosis?.automationClassification?.primaryClassification;
      if (filterPathway !== "All" && pathway !== filterPathway) return false;
      if (filterDept !== "All" && getDepartment(fp.process) !== filterDept) return false;
      if (filterOwner !== "All" && getOwner(fp.process) !== filterOwner) return false;
      if (
        filterComplexity !== "All" &&
        getComplexityTier(fp.process) !== filterComplexity
      )
        return false;
      return true;
    });
  }, [flatProcesses, filterPathway, filterDept, filterOwner, filterComplexity]);

  const agg = useMemo(() => {
    let totalHours = 0;
    const pathwayCounts: Record<AutomationPathway, number> = {
      "AI Agent": 0,
      "Classical RPA": 0,
      "Manual Optimization": 0,
    };
    flatProcesses.forEach((fp) => {
      const proc = fp.process;
      if (!proc?.diagnosis) return;
      totalHours += potentialHoursForProcess(proc);
      const pw = proc.diagnosis.automationClassification?.primaryClassification;
      if (pw && pw in pathwayCounts) pathwayCounts[pw]++;
    });
    const roundedHours = Math.round(totalHours);
    const costAed = Math.round(totalHours * aedRate);
    const fteEquivalent = totalHours > 0 ? (totalHours / 2080).toFixed(1) : "0.0";
    return {
      totalProcesses: flatProcesses.length,
      totalHours: roundedHours,
      costAed,
      fteEquivalent,
      pathwayCounts,
    };
  }, [flatProcesses, aedRate]);

  const pctOf = (count: number) =>
    agg.totalProcesses > 0 ? Math.round((count / agg.totalProcesses) * 100) : 0;

  const fmtAed = (n: number) =>
    n >= 1_000_000
      ? `AED ${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `AED ${(n / 1_000).toFixed(0)}K`
        : `AED ${n}`;

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

  const complexityColor = (c: "Low" | "Medium" | "High") =>
    c === "High" ? "#dc2626" : c === "Medium" ? "#d97706" : "#16a34a";

  return (
    <>
      <Head>
        <title>Executive Dashboard – Process Excellence | DET</title>
        <meta
          name="description"
          content="Portfolio-level automation intelligence for DET process transformation programme"
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
                Executive Dashboard
              </span>
            </div>

            <div className="flex items-center gap-2.5">
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
          {/* Title row */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
                Portfolio Intelligence
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                Full automation opportunity across all diagnosed processes ·{" "}
                <strong style={{ color: "var(--sf-text)" }}>{agg.totalProcesses}</strong>{" "}
                {agg.totalProcesses === 1 ? "process" : "processes"} in portfolio
              </p>
            </div>
            {/* AED rate configurator */}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)" }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                Cost rate
              </span>
              <input
                type="number"
                min={50}
                max={5000}
                step={10}
                value={aedRate}
                onChange={(e) => setAedRate(Number(e.target.value))}
                className="sf-input w-20 rounded-lg px-2 py-1 text-right text-xs font-semibold"
              />
              <span className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                AED / hr
              </span>
            </div>
          </div>

          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--det-navy-light)" }}
              />
            </div>
          ) : (
            <>
              {/* ── KPI Cards ───────────────────────────────────────── */}
              <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    {
                      label: "Total Processes",
                      value: agg.totalProcesses.toLocaleString(),
                      sub: "portfolio scope",
                      accent: "var(--det-navy)",
                      icon: (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      ),
                    },
                    {
                      label: "Potential Hours Saved",
                      value: `${agg.totalHours.toLocaleString()} hrs`,
                      sub: "across portfolio",
                      accent: "var(--det-teal)",
                      icon: (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    {
                      label: "Potential Cost Saving",
                      value: fmtAed(agg.costAed),
                      sub: `at ${aedRate} AED / hr`,
                      accent: "var(--det-gold)",
                      icon: (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    {
                      label: "FTE Equivalent Freed",
                      value: agg.fteEquivalent,
                      sub: "full-time equivalent",
                      accent: "#7c3aed",
                      icon: (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ),
                    },
                  ] as const
                ).map((card, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-5"
                    style={{
                      background: "var(--sf-surface)",
                      border: "1px solid var(--sf-border)",
                      boxShadow: "var(--sf-shadow-sm)",
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--sf-text-muted)" }}
                      >
                        {card.label}
                      </span>
                      <span style={{ color: card.accent }}>{card.icon}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
                      {card.value}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sf-text-faint)" }}>
                      {card.sub}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Pathway Distribution ────────────────────────────── */}
              <div
                className="mb-8 rounded-2xl p-6"
                style={{
                  background: "var(--sf-surface)",
                  border: "1px solid var(--sf-border)",
                  boxShadow: "var(--sf-shadow-sm)",
                }}
              >
                <h2
                  className="mb-5 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  Pathway Distribution — click a pathway to drill through
                </h2>

                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  {/* Donut */}
                  <div className="flex-shrink-0">
                    <DonutChart counts={agg.pathwayCounts} total={agg.totalProcesses} />
                  </div>

                  {/* Pathway tiles */}
                  <div className="flex flex-1 flex-col gap-2.5">
                    {ALL_PATHWAYS.map((pathway) => {
                      const count = agg.pathwayCounts[pathway];
                      const pct = pctOf(count);
                      const cfg = PATHWAY_COLORS[pathway];
                      return (
                        <Link
                          key={pathway}
                          href={`/pathway-drilldown?pathway=${encodeURIComponent(pathway)}`}
                          className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150"
                          style={{ background: cfg.bg }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLAnchorElement).style.outline = `1.5px solid ${cfg.stroke}`)
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLAnchorElement).style.outline = "none")
                          }
                        >
                          <span
                            className="h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ background: cfg.stroke }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: cfg.text }}
                              >
                                {pathway}
                              </span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: cfg.text }}
                              >
                                {pct}%
                              </span>
                            </div>
                            <div
                              className="h-1.5 w-full overflow-hidden rounded-full"
                              style={{ background: "var(--sf-border)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: cfg.stroke }}
                              />
                            </div>
                          </div>
                          <span
                            className="w-8 text-right text-xs font-semibold"
                            style={{ color: "var(--sf-text-faint)" }}
                          >
                            {count}
                          </span>
                          <svg
                            className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ color: cfg.stroke }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Filter Bar ──────────────────────────────────────── */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {(
                  [
                    {
                      label: "Pathway",
                      value: filterPathway,
                      options: ["All", ...ALL_PATHWAYS],
                      set: (v: string) =>
                        setFilterPathway(v as AutomationPathway | "All"),
                    },
                    {
                      label: "Department",
                      value: filterDept,
                      options: allDepartments,
                      set: setFilterDept,
                    },
                    {
                      label: "Owner",
                      value: filterOwner,
                      options: allOwners,
                      set: setFilterOwner,
                    },
                    {
                      label: "Complexity",
                      value: filterComplexity,
                      options: ["All", "Low", "Medium", "High"],
                      set: (v: string) =>
                        setFilterComplexity(
                          v as "All" | "Low" | "Medium" | "High",
                        ),
                    },
                  ] as const
                ).map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--sf-text-muted)" }}
                    >
                      {f.label}
                    </span>
                    <select
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      className="sf-input rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {(filterPathway !== "All" ||
                  filterDept !== "All" ||
                  filterOwner !== "All" ||
                  filterComplexity !== "All") && (
                  <button
                    onClick={() => {
                      setFilterPathway("All");
                      setFilterDept("All");
                      setFilterOwner("All");
                      setFilterComplexity("All");
                    }}
                    className="text-xs underline"
                    style={{ color: "var(--sf-text-faint)" }}
                  >
                    Clear filters
                  </button>
                )}
                <span
                  className="ml-auto text-xs"
                  style={{ color: "var(--sf-text-faint)" }}
                >
                  {filtered.length} of {agg.totalProcesses} shown
                </span>
              </div>

              {/* ── Process Table ───────────────────────────────────── */}
              {filtered.length === 0 ? (
                <div
                  className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed"
                  style={{ borderColor: "var(--sf-border)" }}
                >
                  <p className="text-sm" style={{ color: "var(--sf-text-faint)" }}>
                    No processes match the current filters
                  </p>
                </div>
              ) : (
                <div
                  className="overflow-x-auto rounded-2xl"
                  style={{
                    background: "var(--sf-surface)",
                    border: "1px solid var(--sf-border)",
                    boxShadow: "var(--sf-shadow-sm)",
                  }}
                >
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr
                        style={{ borderBottom: "1px solid var(--sf-border)" }}
                      >
                        {[
                          "Process",
                          "Project",
                          "Pathway",
                          "Department",
                          "Owner",
                          "Complexity",
                          "Potential Saving",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "var(--sf-text-muted)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((fp, i) => {
                        const proc = fp.process;
                        const pathway =
                          proc.diagnosis?.automationClassification
                            ?.primaryClassification;
                        const dept = getDepartment(proc);
                        const owner = getOwner(proc);
                        const complexity = getComplexityTier(proc);
                        const hours = potentialHoursForProcess(proc);
                        const cfg = pathway ? PATHWAY_COLORS[pathway] : null;

                        return (
                          <tr
                            key={`${fp.projectId}-${proc.processIndex}`}
                            style={{
                              borderBottom:
                                i < filtered.length - 1
                                  ? "1px solid var(--sf-border-soft)"
                                  : "none",
                            }}
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/process-optimizer?projectId=${fp.projectId}`}
                                className="font-medium hover:underline"
                                style={{ color: "var(--det-navy)" }}
                              >
                                {proc.analysis?.processName ?? "Unnamed"}
                              </Link>
                            </td>
                            <td
                              className="max-w-[140px] truncate px-4 py-3 text-xs"
                              style={{ color: "var(--sf-text-muted)" }}
                            >
                              {fp.projectName}
                            </td>
                            <td className="px-4 py-3">
                              {cfg ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                                  style={{
                                    color: cfg.text,
                                    background: cfg.bg,
                                  }}
                                >
                                  {pathway}
                                </span>
                              ) : (
                                <span
                                  className="text-xs"
                                  style={{ color: "var(--sf-text-faint)" }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              className="px-4 py-3 text-xs"
                              style={{ color: "var(--sf-text-muted)" }}
                            >
                              {dept}
                            </td>
                            <td
                              className="px-4 py-3 text-xs"
                              style={{ color: "var(--sf-text-muted)" }}
                            >
                              {owner}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: complexityColor(complexity) }}
                              >
                                {complexity}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-xs font-semibold"
                              style={{ color: "var(--det-teal)" }}
                            >
                              {hours > 0 ? `${Math.round(hours)} hrs` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer
          className="mt-auto px-6 py-5"
          style={{
            background: "var(--sf-surface)",
            borderTop: "1px solid var(--sf-border)",
          }}
        >
          <p className="mx-auto max-w-7xl text-xs" style={{ color: "var(--sf-text-faint)" }}>
            * Potential savings are calculated from all quick-win recommendations per diagnosed process. AED cost savings are estimates based on the configured hourly rate. FTE equivalent assumes 2,080 working hours per year.
          </p>
        </footer>
      </div>
    </>
  );
}
