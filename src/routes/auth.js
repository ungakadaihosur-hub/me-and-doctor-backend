const express = require('express');
const { requireSession } = require('@me-and/auth-core');
const { adminClient } = require('../db');

const router = express.Router();

/**
 * Doctor onboarding. The person arriving here already has a valid
 * Supabase session (they clicked the magic link email and landed back
 * in the app) — requireSession confirms that. This endpoint's only job
 * is creating the clinic + doctor rows and linking them to that
 * session's auth_user_id.
 *
 * Uses adminClient (bypasses RLS) rather than an RLS-scoped client:
 * current_clinic_id() would return null for a brand-new user (no
 * doctors row exists yet), so an RLS-scoped INSERT would be rejected
 * by the same policies that protect everyone else's data — this is
 * the one legitimate place that needs to bypass that.
 */
router.post('/onboard', requireSession, async (req, res) => {
  const { doctor_name, qualification, clinic_name, clinic_address } = req.body;

  if (!doctor_name || !clinic_name) {
    return res.status(400).json({ error: 'doctor_name_and_clinic_name_required' });
  }

  const authUserId = req.claims.sub;

  const { data: existingDoctor } = await adminClient
    .from('doctors')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existingDoctor) {
    return res.status(409).json({ error: 'doctor_already_exists' });
  }

  const { data: clinic, error: clinicError } = await adminClient
    .from('clinics')
    .insert({ doctor_name, qualification: qualification || null, clinic_name, clinic_address: clinic_address || null })
    .select()
    .single();

  if (clinicError) return res.status(500).json({ error: clinicError.message });

  const { data: doctor, error: doctorError } = await adminClient
    .from('doctors')
    .insert({ clinic_id: clinic.id, auth_user_id: authUserId })
    .select()
    .single();

  if (doctorError) {
    // Roll back the orphaned clinic row rather than leaving a
    // clinic with no doctor attached to it.
    await adminClient.from('clinics').delete().eq('id', clinic.id);
    return res.status(500).json({ error: doctorError.message });
  }

  res.status(201).json({ clinic, doctor });
});

module.exports = router;
