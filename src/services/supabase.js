import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUCKET_PHOTOS = import.meta.env.VITE_SUPABASE_BUCKET_PHOTOS || 'campaign-photos';
const BUCKET_PORTRAITS = import.meta.env.VITE_SUPABASE_BUCKET_PORTRAITS || 'generated-portraits';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ---------------------------------------------------------------------------
// Local-storage mock backend — used automatically whenever Supabase env vars
// are missing so the whole app keeps working in local/dev/demo mode.
// ---------------------------------------------------------------------------

const LS_REGISTRATIONS = 'crystal_diwali_registrations';
const LS_PORTRAITS = 'crystal_diwali_portraits';

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore quota / private-mode errors — app should not crash
  }
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Saves a registration row. Returns { id, mock } or throws a friendly Error. */
export async function saveRegistration(payload) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('registrations')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error('DB_REGISTRATION_FAILED');
    return { id: data.id, mock: false };
  }

  const rows = readLocal(LS_REGISTRATIONS);
  const row = { id: uid(), ...payload };
  rows.push(row);
  writeLocal(LS_REGISTRATIONS, rows);
  return { id: row.id, mock: true };
}

/** Saves a portrait row linked to a registration id. */
export async function savePortrait(payload) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('portraits')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error('DB_PORTRAIT_FAILED');
    return { id: data.id, mock: false };
  }

  const rows = readLocal(LS_PORTRAITS);
  const row = { id: uid(), ...payload };
  rows.push(row);
  writeLocal(LS_PORTRAITS, rows);
  return { id: row.id, mock: true };
}

/** Uploads a blob to Supabase Storage; falls back to a local object URL. */
export async function uploadPhoto(blob, path, bucket = BUCKET_PHOTOS) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });
    if (error) throw new Error('STORAGE_UPLOAD_FAILED');
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
  // Mock: keep the image only in-memory for this session.
  return URL.createObjectURL(blob);
}

export async function uploadOriginalPhoto(blob, path) {
  return uploadPhoto(blob, path, BUCKET_PHOTOS);
}

export async function uploadGeneratedPortrait(blob, path) {
  return uploadPhoto(blob, path, BUCKET_PORTRAITS);
}

/** Fetches all registrations joined with their portraits for the admin dashboard. */
export async function fetchAdminData() {
  if (isSupabaseConfigured) {
    const [{ data: registrations, error: e1 }, { data: portraits, error: e2 }] = await Promise.all([
      supabase.from('registrations').select('*').order('created_at', { ascending: false }),
      supabase.from('portraits').select('*').order('created_at', { ascending: false }),
    ]);
    if (e1 || e2) throw new Error('DB_FETCH_FAILED');
    return { registrations: registrations || [], portraits: portraits || [], mock: false };
  }

  return {
    registrations: readLocal(LS_REGISTRATIONS),
    portraits: readLocal(LS_PORTRAITS),
    mock: true,
  };
}

export function subscribeToRealtimeUpdates(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('admin-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'portraits' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}


/**
 * Real number of generated portraits (0 if unavailable). Uses the optional
 * `get_portrait_count()` SQL function from supabase_schema.sql so the public
 * (anon) key can read a COUNT without being able to read any rows.
 */
export async function fetchPortraitCount() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('get_portrait_count');
      if (!error && Number.isFinite(Number(data))) return Number(data);
    } catch {
      /* ignore */
    }
    return 0;
  }
  return readLocal(LS_PORTRAITS).length;
}
