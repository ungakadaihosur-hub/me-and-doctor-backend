const axios = require('axios');
const jwt = require('jsonwebtoken');

const MSG91_BASE = 'https://control.msg91.com/api/v5';

/**
 * Send OTP to a phone number via MSG91.
 */
async function sendOtp(phone) {
  const res = await axios.post(
    `${MSG91_BASE}/otp`,
    { mobile: phone, template_id: process.env.MSG91_TEMPLATE_ID },
    { headers: { authkey: process.env.MSG91_AUTH_KEY } }
  );
  return { success: true, requestId: res.data?.request_id || null };
}

/**
 * Verify OTP with MSG91.
 */
async function verifyOtp(phone, otp) {
  const res = await axios.get(`${MSG91_BASE}/otp/verify`, {
    params: { mobile: phone, otp },
    headers: { authkey: process.env.MSG91_AUTH_KEY },
  });
  const ok = res.data?.type === 'success';
  return { verified: ok, raw: res.data };
}

/**
 * Mint a Supabase-compatible session JWT.
 * `resolveClaims(phone)` is supplied per-product and returns the
 * product-specific claims object (e.g. { clinic_id, role: 'doctor' }).
 */
async function createSession(phone, resolveClaims) {
  const claims = await resolveClaims(phone);
  if (!claims) return null;

  const payload = {
    sub: claims.id || phone,
    phone,
    role: 'authenticated',
    ...claims,
  };

  const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
    expiresIn: '30d',
  });

  return { token, claims };
}

/**
 * Express middleware: verifies the bearer token and attaches
 * `req.claims` for downstream RLS-scoped Supabase calls.
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

module.exports = { sendOtp, verifyOtp, createSession, requireSession };
