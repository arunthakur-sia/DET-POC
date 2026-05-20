import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserProjects, deleteProject, type Project } from "@/lib/supabase";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isDark = theme === "dark";

  // Auth guard
  useEffect(() => {
    if (!loading && !user) void router.replace("/login");
  }, [user, loading, router]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const data = await getUserProjects(user.id);
      setProjects(data);
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadProjects();
  }, [user, loadProjects]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert(t("failedDelete"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    void router.replace("/");
  };

  const filtered = projects.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.file_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading || (!user && !loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sf-bg)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--det-navy-light)" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Processes – Process Excellence Platform | DET</title>
        <meta name="description" content="DET Process Excellence Dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>

        {/* ── Top Navigation ─────────────────────────────────────────── */}
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
            style={{ background: "linear-gradient(90deg, var(--det-navy) 0%, var(--det-navy-mid) 55%, var(--det-gold) 100%)" }}
          />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/assets/dubai-det-flag-logo.svg"
                alt="Dubai Economy and Tourism"
                width={110}
                height={36}
                className="h-9 w-auto"
              />
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-2.5">
              <span
                className="hidden truncate text-xs sm:block max-w-[200px]"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {user?.email}
              </span>

              {/* Language toggle */}
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="det-lang-toggle"
                title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
              >
                {lang === "en" ? "العربية" : "English"}
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="det-theme-toggle"
                title={isDark ? "Light mode" : "Dark mode"}
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
                onClick={() => void handleSignOut()}
                className="det-button-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {/* Page heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--sf-text)" }}>
              {t("myProcesses")}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              {t("myProcessesSub")}
            </p>
          </div>

          {/* Actions row */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative max-w-sm flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rtl:left-auto rtl:right-3"
                style={{ color: "var(--sf-text-faint)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sf-input w-full rounded-lg py-2.5 pl-9 pr-4 text-sm rtl:pl-4 rtl:pr-9"
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--det-navy-light)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
            </div>

            {/* New process button */}
            <Link
              href="/process-optimizer"
              className="sf-button-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("newProcess")}
            </Link>
          </div>

          {/* ── Project grid ──────────────────────────────────────────── */}
          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--det-navy-light)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasSearch={!!searchQuery} t={t} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => void handleDelete(project.id)}
                  deleting={deletingId === project.id}
                  t={t}
                />
              ))}
            </div>
          )}
        </main>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer
          className="mt-auto px-6 py-5"
          style={{ background: "var(--sf-surface)", borderTop: "1px solid var(--sf-border)" }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
              {t("copyright", { year: new Date().getFullYear() })}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDelete,
  deleting,
  t,
}: {
  project: Project;
  onDelete: () => void;
  deleting: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const processCount = Array.isArray(project.processes) ? project.processes.length : 0;
  const sopCount = Object.keys(project.sops ?? {}).length;
  const optCount = Object.keys(project.optimizations ?? {}).length;

  const status =
    sopCount > 0
      ? { label: t("statusSopReady"), color: "#b45309", bg: "rgba(217,119,6,0.10)" }
      : optCount > 0
        ? { label: t("statusOptimised"), color: "#1b3764", bg: "rgba(27,55,100,0.10)" }
        : processCount > 0
          ? { label: t("statusDiagnosed"), color: "#065f46", bg: "rgba(5,150,105,0.10)" }
          : { label: t("statusEmpty"), color: "#6b7280", bg: "rgba(107,114,128,0.08)" };

  const updatedAt = new Date(project.updated_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="group relative flex flex-col rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        boxShadow: "var(--sf-shadow-sm)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--sf-shadow)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--sf-shadow-sm)"; }}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, var(--det-navy) 0%, var(--det-navy-mid) 55%, var(--det-gold) 100%)" }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Status badge + delete */}
        <div className="mb-3 flex items-start justify-between">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {status.label}
          </span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded p-1 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
            style={{ color: "var(--sf-text-faint)" }}
            title={t("delete")}
          >
            {deleting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Title */}
        <h3 className="mb-1 line-clamp-2 text-base font-semibold" style={{ color: "var(--sf-text)" }}>
          {project.name}
        </h3>
        {project.file_name && (
          <p className="mb-3 font-mono text-xs" style={{ color: "var(--sf-text-faint)" }}>
            {project.file_name}
          </p>
        )}

        {/* Stats */}
        <div className="mt-auto flex items-center gap-3 text-xs" style={{ color: "var(--sf-text-faint)" }}>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {processCount} {t("processesLabel")}
          </span>
          <span style={{ color: "var(--sf-border)" }}>·</span>
          <span>{updatedAt}</span>
        </div>
      </div>

      {/* Open CTA */}
      <div className="px-5 py-3" style={{ borderTop: "1px solid var(--sf-border-soft)" }}>
        <Link
          href={`/process-optimizer?projectId=${project.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition"
          style={{ color: "var(--det-navy)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(27,55,100,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
        >
          <span>{t("openProcess")}</span>
          <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch,
  t,
}: {
  hasSearch: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center"
      style={{ borderColor: "var(--sf-border)", background: "var(--sf-surface)" }}
    >
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "rgba(27,55,100,0.07)", border: "1px solid var(--sf-border)" }}
      >
        <svg className="h-8 w-8" style={{ color: "var(--sf-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </div>
      {hasSearch ? (
        <p style={{ color: "var(--sf-text-muted)" }}>{t("noMatchSearch")}</p>
      ) : (
        <>
          <p className="font-semibold" style={{ color: "var(--sf-text)" }}>{t("noProcessesTitle")}</p>
          <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--sf-text-muted)" }}>
            {t("noProcessesBody")}
          </p>
          <Link
            href="/process-optimizer"
            className="sf-button-primary mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("newProcess")}
          </Link>
        </>
      )}
    </div>
  );
}
