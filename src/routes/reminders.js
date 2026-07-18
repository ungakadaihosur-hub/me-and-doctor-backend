const express = require('express');
const { withClinicAuth } = require('../middleware/auth');
const { sendReminder } = require('../cron/reminders');

const router = express.Router();
router.use(withClinicAuth);

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase
    .from('reminders')
    .select('*, patients(name, phone)')
    .eq('clinic_id', req.clinicId)
    .order('send_date', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/resend', async (req, res) => {
  const { data: reminder, error } = await req.supabase
    .from('reminders')
    .select('*, patients(name, phone)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error || !reminder) return res.status(404).json({ error: 'not_found' });

  try {
    const result = await sendReminder(reminder);
    res.json(result);
  } catch (err) {
    console.error('manual resend failed:', err.message);
    res.status(502).json({ error: 'resend_failed' });
  }
});

module.exports = router;
