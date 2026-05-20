import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("demo@smartflow.ae");
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
        <title>Sign In – SmartFlow</title>
        <meta name="description" content="Sign in to SmartFlow" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        className="flex min-h-screen flex-col items-center justify-center p-4"
        style={{
          background: "var(--sf-bg)",
        }}
      >
        {/* Decorative light blobs */}
        <div
          className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(0,222,204,0.3) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none fixed -bottom-20 -right-20 h-80 w-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(0,134,200,0.2) 0%, transparent 70%)" }}
        />

        {/* Logos */}
        <div className="mb-8 flex items-center justify-center">
          <Image
            src="/assets/dubai-det-flag-logo.svg"
            alt="Dubai Economy and Tourism"
            width={156}
            height={52}
            className="h-13 w-auto"
          />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-md rounded-2xl px-8 py-10"
          style={{
            background: "#FFFFFF",
            border: "1px solid var(--sf-border)",
            boxShadow: "0 18px 36px rgba(28, 79, 122, 0.12)",
          }}
        >
          <h1 className="mb-1 text-center text-2xl font-bold" style={{ color: "#1E293B" }}>SmartFlow AI</h1>
          <p className="mb-8 text-center text-sm" style={{ color: "#64748B" }}>
            Process Excellence Platform
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "#475569" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition"
                style={{
                  background: "#FFFFFF",
                  borderColor: "#bfd5ea",
                  color: "#1E293B",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3aa6e8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#bfd5ea")}
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "#475569" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition"
                style={{
                  background: "#FFFFFF",
                  borderColor: "#bfd5ea",
                  color: "#1E293B",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3aa6e8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#bfd5ea")}
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="sf-button-primary mt-2 w-full rounded-lg py-3 text-base font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm transition" style={{ color: "#94A3B8" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
