import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProjects, deleteProject, type Project } from "@/lib/supabase";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      // silently fail – user will see empty state
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadProjects();
  }, [user, loadProjects]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this process? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Failed to delete process.");
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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#F0F4F8" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Processes – SmartFlow</title>
        <meta name="description" content="SmartFlow process dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        className="flex min-h-screen flex-col"
        style={{ background: "var(--sf-bg)" }}
      >
        {/* ── Top Navigation ─────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,0.94)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 18px rgba(28, 79, 122, 0.06)",
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            {/* Logos */}
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/assets/dubai-det-flag-logo.svg"
                alt="Dubai Economy and Tourism"
                width={132}
                height={44}
                className="h-11 w-auto"
              />
            </Link>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <span className="hidden text-sm sm:block" style={{ color: "#64748B" }}>
                {user?.email}
              </span>
              <button
                onClick={() => void handleSignOut()}
                className="rounded border px-4 py-2 text-sm transition"
                style={{ borderColor: "#CBD5E1", color: "#475569" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; e.currentTarget.style.color = "#1E293B"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.color = "#475569"; }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* ── Page title ────────────────────────────────────────────────────── */}
        <div
          className="px-6 py-6"
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid var(--sf-border)",
          }}
        >
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-bold" style={{ color: "#1E293B" }}>My Processes</h1>
            <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
              All your process analysis & optimisation runs, isolated to your account.
            </p>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {/* Actions row */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search processes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border py-2.5 pl-9 pr-4 text-sm outline-none transition"
                style={{
                  background: "#FFFFFF",
                  borderColor: "#bfd5ea",
                  color: "#1E293B",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3aa6e8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#bfd5ea")}
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
              New Process
            </Link>
          </div>

          {/* ── Project grid ──────────────────────────────────────────── */}
          {fetching ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "#00DECC" }} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasSearch={!!searchQuery} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => void handleDelete(project.id)}
                  deleting={deletingId === project.id}
                />
              ))}
            </div>
          )}
        </main>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer
          className="mt-auto px-6 py-5 text-center text-xs"
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid var(--sf-border)",
            color: "#94A3B8",
          }}
        >
          © {new Date().getFullYear()} Dubai Department of Economy and Tourism
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
}: {
  project: Project;
  onDelete: () => void;
  deleting: boolean;
}) {
  const processCount = Array.isArray(project.processes)
    ? project.processes.length
    : 0;
  const sopCount = Object.keys(project.sops ?? {}).length;
  const optCount = Object.keys(project.optimizations ?? {}).length;

  const status =
    sopCount > 0
      ? { label: "SOP Ready", color: "#d97706", bg: "#fef3c7" }
      : optCount > 0
        ? { label: "Optimised", color: "#7c3aed", bg: "#ede9fe" }
        : processCount > 0
          ? { label: "Diagnosed", color: "#059669", bg: "#d1fae5" }
          : { label: "Empty", color: "#6b7280", bg: "#f3f4f6" };

  const updatedAt = new Date(project.updated_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="group relative flex flex-col rounded-2xl transition hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--sf-border)",
        boxShadow: "0 12px 24px rgba(28, 79, 122, 0.08)",
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 rounded-t-2xl" style={{ background: "linear-gradient(90deg, #00DECC 0%, #56D8FF 100%)" }} />

      <div className="flex flex-1 flex-col p-5">
        {/* Status badge + menu */}
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
            className="rounded p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
            title="Delete process"
          >
            {deleting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Title */}
        <h3 className="mb-1 text-base font-semibold line-clamp-2" style={{ color: "#1E293B" }}>
          {project.name}
        </h3>
        {project.file_name && (
          <p className="mb-3 font-mono text-xs" style={{ color: "#94A3B8" }}>
            {project.file_name}
          </p>
        )}

        {/* Stats */}
        <div className="mt-auto flex items-center gap-3 text-xs" style={{ color: "#94A3B8" }}>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {processCount} process{processCount !== 1 ? "es" : ""}
          </span>
          <span style={{ color: "#E2E8F0" }}>|</span>
          <span>{updatedAt}</span>
        </div>
      </div>

      {/* Open button */}
      <div className="px-5 py-3" style={{ borderTop: "1px solid #F1F5F9" }}>
        <Link
          href={`/process-optimizer?projectId=${project.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition hover:bg-slate-50"
          style={{ color: "#475569" }}
        >
          <span>Open Process</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center"
      style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}
    >
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "#F1F5F9" }}
      >
        <svg className="h-8 w-8" style={{ color: "#CBD5E1" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </div>
      {hasSearch ? (
        <p style={{ color: "#64748B" }}>No processes match your search.</p>
      ) : (
        <>
          <p className="font-medium" style={{ color: "#1E293B" }}>No processes yet</p>
          <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
            Click <strong style={{ color: "#1E293B" }}>New Process</strong> to upload and analyse your first process document.
          </p>
          <Link
            href="/process-optimizer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "#00DECC", color: "#0a151e" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Process
          </Link>
        </>
      )}
    </div>
  );
}
