import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

// SIA Blueprint Builder colour palette
// Dark navy: #173044  |  Mid navy: #244861  |  Teal accent: #00DECC  |  White: #FFFFFF

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      void router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <>
      <Head>
        <title>SmartFlow AI – Dubai Economy &amp; Tourism</title>
        <meta
          name="description"
          content="Internal process improvement platform for Dubai Department of Economy and Tourism"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        className="flex min-h-screen flex-col"
        style={{
          fontFamily: "var(--font-sans)",
          background: "var(--sf-bg)",
        }}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,0.94)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 6px 14px rgba(28, 79, 122, 0.06)",
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-5">
              <Image
                src="/assets/white-dubai-gov.svg"
                alt="Dubai Government"
                width={160}
                height={56}
                className="h-14 w-auto"
              />
              <div
                className="hidden h-10 w-px sm:block"
                style={{ backgroundColor: "#E2E8F0" }}
              />
              <Image
                src="/assets/dubai-det-flag-logo.svg"
                alt="Dubai Economy and Tourism"
                width={160}
                height={56}
                className="hidden h-14 w-auto sm:block"
              />
            </div>

            <nav className="hidden items-center gap-8 md:flex">
              {["Features", "About"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "#475569" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1E293B")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
          {/* Decorative blurred circles */}
          <div
            className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, rgba(0,222,204,0.25) 0%, transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, rgba(0,134,200,0.2) 0%, transparent 70%)" }}
          />

          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl" style={{ color: "#1E293B" }}>
            Process Improvement,
            <br />
            <span
              className="relative"
              style={{ color: "#00BFAD" }}
            >
              Built for Government Teams
            </span>
          </h1>

          <p
            className="mb-10 max-w-xl text-lg md:text-xl"
            style={{ color: "#475569" }}
          >
            Upload your current process, identify where time is being lost,
            and generate an updated SOP your teams can use immediately.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="sf-button-primary inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold shadow-xl"
            >
              Open Platform
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#about"
              className="inline-flex items-center gap-2 rounded-xl border px-8 py-3.5 text-base font-medium transition-all hover:bg-slate-100"
              style={{
                borderColor: "#CBD5E1",
                color: "#334155",
              }}
            >
              Learn More
            </a>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────────────── */}
        <section
          id="features"
          className="px-6 py-20"
          style={{ background: "#FFFFFF" }}
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p
                className="mb-2 text-xs font-semibold tracking-widest uppercase"
                style={{ color: "#00BFAD" }}
              >
                Platform Capabilities
              </p>
              <h2 className="text-3xl font-bold" style={{ color: "#1E293B" }}>
                One workspace for analysis, redesign, and SOP delivery
              </h2>
              <p className="mt-3 text-sm" style={{ color: "#64748B" }}>
                Start with the current process document and finish with a clear, updated operating procedure.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid var(--sf-border)",
                    boxShadow: "0 10px 24px rgba(28, 79, 122, 0.08)",
                  }}
                >
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: "rgba(0,222,204,0.12)", border: "1px solid rgba(0,222,204,0.25)" }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-base font-semibold" style={{ color: "#1E293B" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ───────────────────────────────────────────────────── */}
        <section id="about" className="px-6 py-20" style={{ background: "var(--sf-bg-soft)" }}>
          <div className="mx-auto max-w-4xl">
            <div
              className="rounded-3xl p-10 md:p-14"
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--sf-border)",
                boxShadow: "0 18px 30px rgba(28, 79, 122, 0.08)",
              }}
            >
              <div className="flex flex-col items-center gap-8 text-center md:flex-row md:text-left">
                <div className="flex-1">
                  <p
                    className="mb-2 text-xs font-semibold tracking-widest uppercase"
                    style={{ color: "#00BFAD" }}
                  >
                    About
                  </p>
                  <h2 className="mb-4 text-2xl font-bold md:text-3xl" style={{ color: "#1E293B" }}>
                    Designed for Dubai Economy &amp; Tourism operations
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
                    SmartFlow is used internally to review service processes,
                    highlight bottlenecks, and apply practical improvements.
                    Teams can move from process review to a publishable SOP in one flow.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Image
                    src="/assets/dubai-det-flag-logo.svg"
                    alt="Dubai Economy and Tourism"
                    width={140}
                    height={56}
                    className="h-14 w-auto opacity-90"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <footer
          className="px-6 py-8"
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid var(--sf-border)",
          }}
        >
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 text-center md:flex-row md:justify-between md:text-left">
            <div className="flex items-center gap-4">
              <Image
                src="/assets/white-dubai-gov.svg"
                alt="Dubai Government"
                width={90}
                height={30}
                className="h-7 w-auto"
              />
              <span
                className="hidden h-4 w-px sm:block"
                style={{ backgroundColor: "#E2E8F0" }}
              />
              <Image
                src="/assets/dubai-det-flag-logo.svg"
                alt="Dubai Economy and Tourism"
                width={90}
                height={30}
                className="hidden h-7 w-auto sm:block"
              />
            </div>
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              © {new Date().getFullYear()} Dubai Department of Economy and Tourism. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Feature data ──────────────────────────────────────────────────────────────

const features = [
  {
    title: "Process Diagnosis",
    description:
      "Upload a PDF or text process note. SmartFlow maps the steps, flags delays, and gives you a structured baseline of the current process.",
    icon: (
      <svg className="h-6 w-6" style={{ color: "#00BFAD" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Smart Optimisation",
    description:
      "Choose quick wins or set your own improvement criteria. The platform generates a revised process flow and shows expected impact before rollout.",
    icon: (
      <svg className="h-6 w-6" style={{ color: "#00BFAD" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "SOP Generation",
    description:
      "Create a clean SOP draft from the approved changes, ready for review, download, and handover to the owning team.",
    icon: (
      <svg className="h-6 w-6" style={{ color: "#00BFAD" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];
