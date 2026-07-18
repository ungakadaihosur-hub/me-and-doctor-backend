const { requireSession } = require('@me-and/auth-core');
const { scopedClient } = require('../db');

/**
 * Wraps auth-core's requireSession and additionally attaches
 * req.supabase - an RLS-scoped client for this doctor's clinic_id.
 */
function withClinicAuth(req, res, next) {
  requireSession(req, res, () => {
    req.supabase = scopedClient(req.userToken);
    req.clinicId = req.claims.clinic_id;
    next();
  });
}

module.exports = { withClinicAuth };
