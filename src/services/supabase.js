import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BUCKET_POSTERS =
  import.meta.env.VITE_SUPABASE_BUCKET_POSTERS || 'posters';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_URL.includes('your-project')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Local-storage mock backend
// ---------------------------------------------------------------------------

const LS_SUBMISSIONS = 'crystal_kgr-t_submissions';

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
    // Ignore localStorage errors
  }
}

function uid() {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Upload generated poster
// ---------------------------------------------------------------------------

export async function uploadGeneratedPoster(blob, path) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.storage
      .from(BUCKET_POSTERS)
      .upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Poster upload failed:', error);
      throw new Error('STORAGE_UPLOAD_FAILED');
    }

    const { data } = supabase.storage
      .from(BUCKET_POSTERS)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // Local/demo fallback
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Save campaign submission metadata
// ---------------------------------------------------------------------------

export async function saveSubmission(payload) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('campaign_submissions')
      .insert([payload]);

    if (error) {
      console.error('Submission save failed:', error);
      throw new Error('DB_SUBMISSION_FAILED');
    }

    return {
      mock: false,
    };
  }

  // Local/demo fallback
  const rows = readLocal(LS_SUBMISSIONS);

  const row = {
    id: uid(),
    created_at: new Date().toISOString(),
    ...payload,
  };

  rows.push(row);
  writeLocal(LS_SUBMISSIONS, rows);

  return {
    id: row.id,
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// Optional submission count
// ---------------------------------------------------------------------------

export async function fetchPortraitCount() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc(
        'get_submission_count'
      );

      if (!error && Number.isFinite(Number(data))) {
        return Number(data);
      }
    } catch {
      // Ignore count errors
    }

    return 0;
  }

  return readLocal(LS_SUBMISSIONS).length;
}
export async function fetchAdminData() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('campaign_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin data fetch failed:', error);
      throw new Error('DB_FETCH_FAILED');
    }

    return {
      submissions: data || [],
      mock: false,
    };
  }

  return {
    submissions: readLocal(LS_SUBMISSIONS),
    mock: true,
  };
}
export function subscribeToRealtimeUpdates(onChange) {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const channel = supabase
    .channel('campaign-submissions-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'campaign_submissions',
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}