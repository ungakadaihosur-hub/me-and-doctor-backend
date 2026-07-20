const express = require('express');
const authCore = require('@me-and/auth-core');
const { adminClient } = require('../db');

const router = express.Router();

/**
 * Looks up (or creates, on first login) the clinic row for this
 * phone number and returns the claims embedded in the session JWT.
 * Single-user-per-clinic for MVP, so phone is the account key.
 */

router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  try {
    await authCore.sendOtp(phone);
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function resolveClaims(phone) {
  const { data: existingDoctor, error: findErr } = await adminClient
    .from('doctors')
    .select('clinic_id')
    .eq('phone', phone)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existingDoctor) return { clinic_id: existingDoctor.clinic_id };

  const { data: newClinic, error: clinicErr } = await adminClient
    .from('clinics')
    .insert({ doctor_name: '', clinic_name: '', phone })
    .select('id')
    .single();

  if (clinicErr) throw clinicErr;

  const { error: doctorErr } = await adminClient
    .from('doctors')
    .insert({ phone, clinic_id: newClinic.id });

  if (doctorErr) throw doctorErr;

  return { clinic_id: newClinic.id };
}
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });
  try {
    const { verified } = await authCore.verifyOtp(phone, otp);
    if (!verified) return res.status(401).json({ error: 'invalid_otp' });

    const session = await authCore.createSession(phone, resolveClaims);
    if (!session) return res.status(500).json({ error: 'session_failed' });

    res.json({ token: session.token, claims: session.claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Dev-only bypass so pilot testing isn't blocked on MSG91 setup.
 * Flip DEV_LOGIN_ENABLED to false (or remove it) in Railway before
 * real pilot launch — 404s in any other configuration.
 */
router.post('/dev-login', async (req, res) => {
  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
    return res.status(404).end();
  }
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  try {
    const session = await authCore.createSession(phone, resolveClaims);
    if (!session) return res.status(500).json({ error: 'session_failed' });
    res.json({ token: session.token, claims: session.claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
