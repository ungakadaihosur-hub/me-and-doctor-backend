const express = require('express');
const { sendOtp, verifyOtp, verifyWidgetToken, createSession } = require('@me-and/auth-core');
const { adminClient } = require('../db');

const router = express.Router();

/**
 * The app's own phone fields (doctors, patients) only ever collect a
 * bare 10-digit number — there's no country-code input anywhere in the
 * UI. MSG91, however, returns the verified identifier WITH the country
 * code (e.g. "919xxxxxxxxx"), since that's what's needed to actually
 * route the SMS. Without stripping it back down here, every widget
 * login would fail to match any existing doctor row and 404 as
 * "no_clinic_for_phone" — which looks like a wrong-OTP error from the
 * frontend, even though the OTP itself was correct.
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Per-product claims resolver for auth-core.
 * Single role for MVP: 'doctor'. No branching logic needed.
 */
async function resolveClaims(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const { data: doctor, error } = await adminClient
    .from('doctors')
    .select('id, clinic_id')
    .eq('phone', phone)
    .maybeSingle();

  if (error || !doctor) return null;

  return {
    id: doctor.id,
    clinic_id: doctor.clinic_id,
    role: 'doctor',
  };
}

router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone_required' });

  try {
    const result = await sendOtp(phone);
    res.json(result);
  } catch (err) {
    console.error('send-otp failed:', err.message);
    res.status(502).json({ error: 'otp_send_failed' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'phone_and_otp_required' });

  try {
    const { verified } = await verifyOtp(phone, otp);
    if (!verified) return res.status(401).json({ error: 'invalid_otp' });

    const session = await createSession(phone, resolveClaims);
    if (!session) return res.status(404).json({ error: 'no_clinic_for_phone' });

    res.json({ token: session.token, claims: session.claims });
  } catch (err) {
    console.error('verify-otp failed:', err.message);
    res.status(502).json({ error: 'otp_verify_failed' });
  }
});

/**
 * Client-side MSG91 OTP Widget flow: the frontend talks to MSG91 directly
 * to send/verify the OTP and gets back an access-token. That token is
 * sent here, re-verified server-side (mandatory — never trust the
 * client's word alone), and only then is a session minted.
 */
router.post('/verify-widget-token', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'access_token_required' });

  try {
    const { verified, phone } = await verifyWidgetToken(accessToken);
    if (!verified || !phone) return res.status(401).json({ error: 'invalid_widget_token' });

    const session = await createSession(phone, resolveClaims);
    if (!session) return res.status(404).json({ error: 'no_clinic_for_phone' });

    res.json({ token: session.token, claims: session.claims });
  } catch (err) {
    console.error('verify-widget-token failed:', err.message);
    res.status(502).json({ error: 'widget_token_verify_failed' });
  }
});

/**
 * Dev-only OTP bypass. Triple-gated, never active in production:
 *   1. NODE_ENV must not be 'production'
 *   2. DEV_LOGIN_ENABLED must be exactly 'true'
 *   3. Caller must send the matching DEV_LOGIN_SECRET header
 * Any single one of these being correctly set (e.g. NODE_ENV=production
 * on Railway) is enough to kill this route — but since #1 and #2 depend
 * on env vars that are easy to leave misconfigured, #3 is the real
 * backstop: DEV_LOGIN_SECRET is unset by default, so this route 404s
 * out of the box even if the other two are wrong.
 */
router.post('/dev-login', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const enabled = process.env.DEV_LOGIN_ENABLED === 'true';
  const configuredSecret = process.env.DEV_LOGIN_SECRET;
  const suppliedSecret = req.headers['x-dev-login-secret'];
  const secretMatches = !!configuredSecret && suppliedSecret === configuredSecret;

  if (isProd || !enabled || !secretMatches) {
    return res.status(404).json({ error: 'not_found' });
  }

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone_required' });

  const session = await createSession(phone, resolveClaims);
  if (!session) return res.status(404).json({ error: 'no_clinic_for_phone' });

  res.json({ token: session.token, claims: session.claims });
});

module.exports = router;
