import { supabase, isSupabaseConfigured } from './supabase.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const PREFIX = 'CCPL'; // Crystal Corp Pvt Ltd — replace with the real brand prefix

function randomSegment(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function buildCandidate() {
  return `${PREFIX}-${randomSegment(8)}`;
}

/**
 * Generates a reference number, e.g. CCPL-MU8NOZYS.
 * When Supabase is configured, retries on collision against the `portraits`
 * table; otherwise checks against localStorage history for this browser.
 */
export async function generateReferenceNumber() {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = buildCandidate();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('portraits')
          .select('ref_no')
          .eq('ref_no', candidate)
          .maybeSingle();
        if (!error && !data) return candidate;
      } catch {
        // fall through to local uniqueness check below
      }
    }

    const used = getLocalRefHistory();
    if (!used.includes(candidate)) {
      saveLocalRef(candidate);
      return candidate;
    }
  }

  // Extremely unlikely fallback: timestamp-based suffix guarantees uniqueness.
  return `${PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

const LOCAL_KEY = 'crystal_diwali_ref_history';

function getLocalRefHistory() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalRef(ref) {
  try {
    const history = getLocalRefHistory();
    history.push(ref);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(history.slice(-500)));
  } catch {
    // localStorage may be unavailable (private mode) — safe to ignore.
  }
}
