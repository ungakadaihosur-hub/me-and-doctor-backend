const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.get('/', async (req, res) => {
  const { q } = req.query;
  let query = req.supabase.from('patients').select('*').eq('clinic_id', req.clinicId);

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { name, phone, age, gender } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });

  const { data, error } = await req.supabase
    .from('patients')
    .insert({ clinic_id: req.clinicId, name, phone, age, gender })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/:id', async (req, res) => {
  const { data: patient, error: patientError } = await req.supabase
    .from('patients')
    .select('*')
    .eq('id', req.params.id)
    .eq('clinic_id', req.clinicId)
    .maybeSingle();

  if (patientError) return res.status(500).json({ error: patientError.message });
  if (!patient) return res.status(404).json({ error: 'not_found' });

  const { data: visits, error: visitsError } = await req.supabase
    .from('visits')
    .select('*')
    .eq('patient_id', req.params.id)
    .order('visit_date', { ascending: false })
    .limit(3);

  if (visitsError) return res.status(500).json({ error: visitsError.message });

  res.json({ ...patient, recent_visits: visits });
});

module.exports = router;
