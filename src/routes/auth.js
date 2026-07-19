const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

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
  const { doctor_name, qualification, clinic_name, clinic_address, phone } = req.body;

  const { data, error } = await req.supabase
    .from('clinics')
    .update({ doctor_name, qualification, clinic_name, clinic_address, phone })
    .eq('id', req.clinicId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
