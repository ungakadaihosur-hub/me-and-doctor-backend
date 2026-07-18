const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

router.get('/today', async (req, res) => {
  const { start, end } = todayRange();

  const { data, error } = await req.supabase
    .from('queue_tokens')
    .select('*, patients(name, phone)')
    .eq('clinic_id', req.clinicId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('token_number', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/token', async (req, res) => {
  const { patient_id } = req.body;
  const { start, end } = todayRange();

  const { count, error: countError } = await req.supabase
    .from('queue_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', req.clinicId)
    .gte('created_at', start)
    .lte('created_at', end);

  if (countError) return res.status(500).json({ error: countError.message });

  const { data, error } = await req.supabase
    .from('queue_tokens')
    .insert({
      clinic_id: req.clinicId,
      patient_id: patient_id || null,
      token_number: (count || 0) + 1,
      status: 'waiting',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/token/:id', async (req, res) => {
  const { status } = req.body;
  if (!['waiting', 'in_consultation', 'done'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  const { data, error } = await req.supabase
    .from('queue_tokens')
    .update({ status })
    .eq('id', req.params.id)
    .eq('clinic_id', req.clinicId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
