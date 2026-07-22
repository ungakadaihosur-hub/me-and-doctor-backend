const express = require('express');
const { sendOtp, verifyOtp, verifyWidgetToken, createSession } = require('@me-and/auth-core');
const { adminClient } = require('../db');

const router = express.Router();

/**
 * Per-product claims resolver for auth-core.
 * Single role for MVP: 'doctor'. No branching logic needed.
 */
async function resolveClaims(phone) {
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
 * Dev-only OTP bypass, double-gated, never active in production.
 * Mirrors the same pattern used in Me & Coach's backend.
 */
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_LOGIN_ENABLED !== 'true') {
    return res.status(404).json({ error: 'not_found' });
  }

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone_required' });

  const session = await createSession(phone, resolveClaims);
  if (!session) return res.status(404).json({ error: 'no_clinic_for_phone' });

  res.json({ token: session.token, claims: session.claims });
});

module.exports = router;
