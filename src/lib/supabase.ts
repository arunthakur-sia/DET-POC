import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Database types ────────────────────────────────────────────────────────

export type StoredDocument = {
  name: string;
  size: number;
  type: string;
  storagePath: string;
  uploadedAt: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  file_name: string | null;
  // JSONB columns – keys are always serialised to strings by JSON
  processes: unknown[];
  optimizations: Record<string, unknown>;
  sops: Record<string, string>;
  phases: Record<string, number>;
  impacts: Record<string, unknown>;
  quick_win_selections: Record<string, Record<string, boolean>>;
  criteria: Record<string, string>;
  documents: StoredDocument[];
  created_at: string;
  updated_at: string;
};

// ─── Project helpers ───────────────────────────────────────────────────────

export async function getUserProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as Project[]) ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const response = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (response.error) throw response.error;
  return response.data as Project | null;
}

export async function createProject(
  userId: string,
  name: string,
  fileName: string | null,
  processes: unknown[],
): Promise<Project> {
  const response = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      file_name: fileName,
      processes,
      optimizations: {},
      sops: {},
      phases: {},
      impacts: {},
      quick_win_selections: {},
      criteria: {},
    })
    .select()
    .single();

  if (response.error) throw response.error;
  return response.data as Project;
}

export async function updateProject(
  id: string,
  updates: {
    name?: string;
    processes?: unknown[];
    optimizations?: Record<string | number, unknown>;
    sops?: Record<string | number, string>;
    phases?: Record<string | number, number>;
    impacts?: Record<string | number, unknown>;
    quick_win_selections?: Record<string | number, Record<string | number, boolean>>;
    criteria?: Record<string | number, string>;
    documents?: StoredDocument[];
  },
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ─── Storage helpers ───────────────────────────────────────────────────────

const BUCKET = "process-documents";

/**
 * Upload a File to Supabase Storage and return its metadata.
 * Files are stored at: {userId}/{projectId}/{timestamp}-{filename}
 */
export async function uploadDocumentToStorage(
  userId: string,
  projectId: string,
  file: File,
): Promise<StoredDocument> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${projectId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });
  if (error) throw error;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Download a previously stored document from Supabase Storage.
 * Returns a File object ready for re-processing.
 */
export async function downloadDocumentFromStorage(
  doc: StoredDocument,
): Promise<File | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(doc.storagePath);
  if (error || !data) return null;
  return new File([data], doc.name, { type: doc.type });
}
