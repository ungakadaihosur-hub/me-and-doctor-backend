const { requireSession } = require('@me-and/auth-core');
const { scopedClient } = require('../db');

/**
 * Wraps auth-core's requireSession and additionally attaches
 * req.supabase (an RLS-scoped client) and req.clinicId.
 *
 * clinic_id used to arrive as a custom claim on our own hand-minted
 * JWT. Now that Supabase Auth mints the session (magic link email),
 * the token only carries Supabase's native claims (sub/email/role) —
 * so clinic_id is resolved here with one extra lookup against the
 * doctor's own row (RLS-scoped to their own auth_user_id, so this is
 * safe and can only ever return their own clinic).
 */
function withClinicAuth(req, res, next) {
  requireSession(req, res, async () => {
    req.supabase = scopedClient(req.userToken);

    const { data: doctor, error } = await req.supabase
      .from('doctors')
      .select('clinic_id')
      .eq('auth_user_id', req.claims.sub)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    if (!doctor) {
      // A valid, logged-in Supabase user who hasn't completed clinic
      // onboarding yet — not an auth failure, just nowhere to route
      // clinic-scoped data. The frontend's axios interceptor sends
      // them to /onboarding on seeing this specific error code.
      return res.status(403).json({ error: 'no_clinic_for_user' });
    }

    req.clinicId = doctor.clinic_id;
    next();
  });
}

module.exports = { withClinicAuth };
