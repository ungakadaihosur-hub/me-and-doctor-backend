const authCore = require('@me-and/auth-core');
const { scopedClient } = require('../db');

if (typeof authCore.requireSession !== 'function') {
  // withClinicAuth would silently end up undefined and Express would
  // fail with a generic "Router.use() requires a middleware function"
  // in whichever route file happens to import this first — this check
  // turns that into a message that actually names the real problem.
  throw new Error(
    'requireSession is not a function — @me-and/auth-core did not load ' +
    'correctly. Check Railway\'s BUILD log (not the runtime/deploy log) ' +
    'for confirmation that "packages/auth-core" was installed, and make ' +
    'sure that folder is actually committed to your repo (not gitignored).'
  );
}

const { requireSession } = authCore;

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
