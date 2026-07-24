const jwt = require('jsonwebtoken');

/**
 * Express middleware: verifies the bearer token and attaches
 * `req.claims` for downstream RLS-scoped Supabase calls.
 *
 * Since login moved from a custom MSG91-verified session to Supabase's
 * own Auth (magic link email), the tokens arriving here are minted by
 * Supabase itself — not by this backend. They're still signed with the
 * same SUPABASE_JWT_SECRET, so verification here is unchanged; only
 * the claims shape differs (native Supabase claims: sub/email/role,
 * no custom clinic_id — that's now resolved server-side via the
 * `current_clinic_id()` Postgres function, see withClinicAuth).
 */
function requireSession(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    req.claims = decoded;
    req.userToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { requireSession };
