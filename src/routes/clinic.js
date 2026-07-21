const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

const CLINIC_FIELDS = [
  'doctor_name', 'qualification', 'clinic_name', 'clinic_address', 'phone',
  'registration_number', 'consultation_fee', 'clinic_timings', 'logo_url', 'prescription_header',
];

function pick(body, fields) {
  return fields.reduce((acc, f) => {
    if (body[f] !== undefined) acc[f] = body[f];
    return acc;
  }, {});
}

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase
    .from('clinics')
    .select('*')
    .eq('id', req.clinicId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/', async (req, res) => {
  const fields = pick(req.body, CLINIC_FIELDS);

  const { data, error } = await req.supabase
    .from('clinics')
    .update(fields)
    .eq('id', req.clinicId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
