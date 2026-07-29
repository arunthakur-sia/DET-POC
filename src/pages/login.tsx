import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("demo@smartflow.com");
  const [password, setPassword] = useState("SmartFlow@2024");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) void router.replace("/dashboard");
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      void router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In – Process Excellence Platform | Hafeet Rail</title>
        <meta name="description" content="تسجيل الدخول | Sign in to the Hafeet Rail Process Excellence Platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4"
        style={{ background: "var(--sf-bg)" }}
      >
        {/* Top gradient bar */}
        <div
          className="fixed top-0 left-0 right-0 z-50 h-1"
          style={{ background: "linear-gradient(90deg, var(--hr-navy) 0%, var(--hr-navy-mid) 55%, var(--hr-gold) 100%)" }}
        />

        {/* Top-right controls */}
        <div className="fixed top-4 end-5 z-50 flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="hr-lang-toggle"
            title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            {lang === "en" ? "العربية" : "English"}
          </button>

        </div>

        {/* Decorative orbs */}
        <div
          className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 68%)" }}
        />
        <div
          className="pointer-events-none fixed -bottom-20 -right-20 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(27,55,100,0.10) 0%, transparent 68%)" }}
        />

        {/* Logo cluster */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/assets/hafeet-rail-logo.png"
            alt="Hafeet Rail"
            width={180}
            height={64}
            className="h-16 w-auto"
          />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl"
          style={{
            background: "var(--sf-surface)",
            border: "1px solid var(--sf-border)",
            boxShadow: "var(--sf-shadow-lg)",
          }}
        >
          {/* Card header */}
          <div
            className="px-8 py-7"
            style={{
              background: "linear-gradient(135deg, var(--hr-navy) 0%, var(--hr-navy-mid) 100%)",
            }}
          >
            <h1 className="text-xl font-bold text-white">{t("loginTitle")}</h1>
            <p className="mt-1 text-xs" style={{ color: "rgba(201,168,76,0.90)" }}>
              {t("loginDeptLine")}
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  {t("emailLabel")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="sf-input w-full rounded-lg px-4 py-3 text-sm"
                  placeholder={t("emailPlaceholder")}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--hr-navy-light)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  {t("passwordLabel")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="sf-input w-full rounded-lg px-4 py-3 text-sm"
                  placeholder={t("passwordPlaceholder")}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--hr-navy-light)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.25)",
                    color: "#dc2626",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="sf-button-primary mt-2 w-full rounded-lg py-3 text-sm font-bold tracking-wide shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t("signingIn")}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    {t("signIn")}
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm transition"
            style={{ color: "var(--sf-text-faint)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sf-text-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sf-text-faint)")}
          >
            <svg className="h-3.5 w-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("backHome")}
          </Link>
        </div>
      </div>
    </>
  );
}
