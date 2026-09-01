import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) void router.replace("/dashboard");
  }, [user, loading, router]);

  const features = [
    {
      title: t("feature1Title"),
      description: t("feature1Desc"),
      icon: (
        <svg className="h-6 w-6" style={{ color: "var(--hr-navy)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: t("feature2Title"),
      description: t("feature2Desc"),
      icon: (
        <svg className="h-6 w-6" style={{ color: "var(--hr-navy)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: t("feature3Title"),
      description: t("feature3Desc"),
      icon: (
        <svg className="h-6 w-6" style={{ color: "var(--hr-navy)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>ARIA – SIA Partners</title>
        <meta
          name="description"
          content="ARIA | Internal process improvement platform for SIA Partners"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen flex-col" style={{ background: "var(--sf-bg)" }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,0.97)",
            borderBottom: "1px solid var(--sf-border)",
            backdropFilter: "blur(14px)",
            boxShadow: "var(--sf-shadow-sm)",
          }}
        >
          {/* SIA Partners brand top bar */}
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 55%, var(--hr-gold) 100%)" }}
          />

          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Image
                src="/assets/sia-logo.png"
                alt="SIA Partners"
                width={150}
                height={52}
                className="h-11 w-auto"
              />
            </div>

            {/* Nav + actions */}
            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-7 md:flex">
                {[
                  [t("platformCapabilities"), "#features"],
                  [t("about"), "#about"],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className="text-sm font-medium transition-colors"
                    style={{ color: "var(--sf-text-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sf-text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sf-text-muted)")}
                  >
                    {label}
                  </a>
                ))}
              </nav>

              {/* Language toggle */}
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="hr-lang-toggle"
                title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
              >
                {lang === "en" ? "العربية" : "English"}
              </button>


            </div>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-28 text-center">
          {/* Decorative orbs */}
          <div
            className="pointer-events-none absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(0,162,163,0.09) 0%, transparent 65%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(10, 21, 30,0.09) 0%, transparent 65%)" }}
          />

          {/* Badge */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{
              background: "rgba(0,162,163,0.12)",
              border: "1px solid rgba(0,162,163,0.30)",
              color: "var(--hr-gold)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--hr-gold)" }} />
            {t("badge")}
          </div>

          {/* Headline */}
          <h1
            className="mb-4 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl"
            style={{ color: "var(--sf-text)" }}
          >
            {t("heroHeadline")}
            <br />
            <span style={{ color: "var(--hr-navy-light)" }}>{t("heroPlatform")}</span>
          </h1>

          <p
            className="mb-10 max-w-xl text-lg leading-relaxed md:text-xl"
            style={{ color: "var(--sf-text-muted)" }}
          >
            {t("heroDesc")}
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="sf-button-primary inline-flex items-center gap-2.5 rounded-xl px-9 py-3.5 text-base font-semibold shadow-xl"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {t("openPlatform")}
            </Link>
            <a
              href="#about"
              className="hr-button-ghost inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-medium"
            >
              {t("learnMore")}
              <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

        </section>

        {/* ── FEATURES ────────────────────────────────────────────────── */}
        <section id="features" className="px-6 py-20" style={{ background: "var(--sf-surface)" }}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p
                className="mb-2 text-xs font-semibold tracking-widest uppercase"
                style={{ color: "var(--hr-gold)" }}
              >
                {t("featuresEyebrow")}
              </p>
              <h2 className="text-3xl font-bold" style={{ color: "var(--sf-text)" }}>
                {t("featuresHeading")}
              </h2>
              <p className="mt-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                {t("featuresSub")}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "var(--sf-bg)",
                    border: "1px solid var(--sf-border)",
                    boxShadow: "var(--sf-shadow-sm)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--sf-shadow-lg)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--sf-shadow-sm)";
                  }}
                >
                  {/* Gold top bar on hover */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: "linear-gradient(90deg, var(--hr-gold), var(--hr-gold-light))" }}
                  />
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(10, 21, 30,0.08)",
                      border: "1px solid rgba(10, 21, 30,0.15)",
                    }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-base font-bold" style={{ color: "var(--sf-text)" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>
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
              className="overflow-hidden rounded-3xl"
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
                boxShadow: "var(--sf-shadow)",
              }}
            >
              <div
                className="h-1"
                style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 50%, var(--hr-gold) 100%)" }}
              />

              <div className="p-10 md:p-14">
                <div className="flex flex-col items-center gap-10 text-center md:flex-row md:text-start">
                  <div className="flex-1">
                    <p
                      className="mb-2 text-xs font-semibold tracking-widest uppercase"
                      style={{ color: "var(--hr-gold)" }}
                    >
                      {t("aboutEyebrow")}
                    </p>
                    <h2 className="mb-4 text-2xl font-bold md:text-3xl" style={{ color: "var(--sf-text)" }}>
                      {t("aboutHeading")}
                    </h2>
                    <p className="text-sm leading-loose" style={{ color: "var(--sf-text-muted)" }}>
                      {t("aboutBody")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-center gap-4">
                    <Image
                      src="/assets/sia-logo.png"
                      alt="SIA Partners"
                      width={148}
                      height={60}
                      className="h-16 w-auto opacity-90"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <footer
          className="px-6 py-8"
          style={{
            background: "#ffffff",
            borderTop: "1px solid var(--sf-border)",
          }}
        >
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-start">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/sia-logo.png"
                alt="SIA Partners"
                width={88}
                height={30}
                className="h-7 w-auto opacity-80"
              />
            </div>
            <p className="text-xs" style={{ color: "var(--sf-text-faint)" }}>
              {t("copyright", { year: new Date().getFullYear() })}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
