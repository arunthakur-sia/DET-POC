-- ============================================================
-- SmartFlow AI – Supabase Migration
-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/mvkmfddwzhfqwiwhegal/sql
-- ============================================================

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  file_name   TEXT,
  processes   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  optimizations JSONB     NOT NULL DEFAULT '{}'::jsonb,
  sops        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  phases      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  impacts     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- RLS Policies – users only see/change their own rows
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Documents column – stores metadata of original uploaded files
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- Workflow state columns – store in-progress user choices so a
-- project can be reopened at the same diagnosis/optimization/SOP state
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS quick_win_selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- Supabase Storage bucket for original process documents
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- Create private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-documents', 'process-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if re-running
DROP POLICY IF EXISTS "Users can upload their own process documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own process documents"    ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own process documents"  ON storage.objects;

-- RLS: files are stored at {userId}/{projectId}/{filename}
CREATE POLICY "Users can upload their own process documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'process-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own process documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'process-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own process documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'process-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Seed: Create a demo user (run ONCE via Supabase Auth API or
-- use the snippet below in the Supabase SQL Editor)
-- Email:    demo@smartflow.com
-- Password: SmartFlow@2024
-- ============================================================
-- NOTE: Supabase Auth users cannot be inserted directly via SQL.
-- Use the Supabase Dashboard > Authentication > Users > "Add user"
-- OR call the signup endpoint once from your browser:
--
--   POST https://ytirbjkxooboydytivlr.supabase.co/auth/v1/signup
--   { "email": "demo@smartflow.com", "password": "SmartFlow@2024" }
--
-- You can also use the seed API route added to the app:
--   GET /api/seed-demo-user  (only works in development)
-- ============================================================
