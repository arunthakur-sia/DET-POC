import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// This route is only for development seed — creates the demo user and runs the migration
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const results: Record<string, string> = {};

  // ─── 1. Run migration via Management API ────────────────────────────────────
  // Extract project ref from the URL
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = rawUrl.replace("https://", "").replace(".supabase.co", "");

  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS public.projects (
      id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name          TEXT        NOT NULL,
      description   TEXT,
      file_name     TEXT,
      processes     JSONB       NOT NULL DEFAULT '[]'::jsonb,
      optimizations JSONB       NOT NULL DEFAULT '{}'::jsonb,
      sops          JSONB       NOT NULL DEFAULT '{}'::jsonb,
      phases        JSONB       NOT NULL DEFAULT '{}'::jsonb,
      impacts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
    DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

    CREATE POLICY "Users can view their own projects"
      ON public.projects FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users can create their own projects"
      ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update their own projects"
      ON public.projects FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users can delete their own projects"
      ON public.projects FOR DELETE USING (auth.uid() = user_id);

    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
    CREATE TRIGGER trg_projects_updated_at
      BEFORE UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  `;

  try {
    const mgmtRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: migrationSQL }),
      },
    );
    results.migration = mgmtRes.ok ? "applied" : `management API ${mgmtRes.status} – run migration.sql manually in dashboard`;
  } catch {
    results.migration = "management API unavailable – run migration.sql manually in dashboard";
  }

  // ─── 2. Create demo user ──────────────────────────────────────────────────
  const email = "demo@smartflow.com";
  const password = "SmartFlow@2024";

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const alreadyExists = existing?.users?.some((u) => u.email === email);

  if (alreadyExists) {
    results.user = "already exists";
    return res.status(200).json({ ...results, email });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return res.status(500).json({ ...results, error: error.message });
  }

  return res.status(200).json({
    ...results,
    message: "Demo user created",
    email,
    userId: data.user?.id,
  });
}
