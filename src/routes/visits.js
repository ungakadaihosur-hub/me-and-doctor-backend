const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.post('/', async (req, res) => {
  const { patient_id, soap_notes, vitals } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id_required' });

  const { data, error } = await req.supabase
    .from('visits')
    .insert({
      clinic_id: req.clinicId,
      patient_id,
      visit_date: new Date().toISOString(),
      soap_notes: soap_notes || null,
      vitals: vitals || {},
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/patient/:patientId', async (req, res) => {
  const { data, error } = await req.supabase
    .from('visits')
    .select('*')
    .eq('patient_id', req.params.patientId)
    .order('visit_date', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
