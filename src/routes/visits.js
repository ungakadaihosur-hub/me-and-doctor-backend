const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.post('/', async (req, res) => {
  const { patient_id, chief_complaint, soap_notes, diagnosis, vitals, follow_up_date, status } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id_required' });

  const { data, error } = await req.supabase
    .from('visits')
    .insert({
      clinic_id: req.clinicId,
      patient_id,
      visit_date: new Date().toISOString(),
      chief_complaint: chief_complaint || null,
      soap_notes: soap_notes || null,
      diagnosis: diagnosis || null,
      vitals: vitals || {},
      follow_up_date: follow_up_date || null,
      status: status || 'completed',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Missing link fixed in Phase 1.1: creating a visit with a follow-up
  // date actually creates the reminder row the cron job depends on.
  if (follow_up_date) {
    const { error: reminderError } = await req.supabase.from('reminders').insert({
      clinic_id: req.clinicId,
      patient_id,
      type: 'follow_up',
      send_date: follow_up_date,
    });
    if (reminderError) console.error('follow-up reminder insert failed:', reminderError.message);
  }

  res.status(201).json(data);
});

router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  const { data, error } = await req.supabase
    .from('visits')
    .update({ status })
    .eq('id', req.params.id)
    .eq('clinic_id', req.clinicId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
