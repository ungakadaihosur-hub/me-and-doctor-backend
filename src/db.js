const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  !SUPABASE_URL && 'SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'SUPABASE_ANON_KEY',
  !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean);

if (missing.length) {
  // Without this check, @supabase/supabase-js throws a bare
  // "supabaseUrl is required" at import time, which crashes the
  // whole process the moment any route file requires ./db —
  // including src/middleware/auth.js. This is almost certainly
  // what's happening on Railway right now: one or more of these
  // vars isn't set (or is misnamed) in the Railway service's
  // Variables tab, so check the names match exactly.
  throw new Error(
    `Missing required env var(s): ${missing.join(', ')}. Set these in Railway > your service > Variables, matching .env.example exactly.`
  );
}

/**
 * Admin client - bypasses RLS. Use only for webhooks/cron jobs
 * where there is no logged-in user context.
 */
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Per-request RLS-scoped client. Pass the caller's own JWT
 * (minted by @me-and/auth-core) so Postgres RLS policies apply
 * using the clinic_id claim embedded in the token.
 */
function scopedClient(userToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${userToken}` },
    },
  });
}

module.exports = { adminClient, scopedClient };
