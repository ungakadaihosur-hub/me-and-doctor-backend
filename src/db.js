const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
