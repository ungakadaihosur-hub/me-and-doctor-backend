const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.get('/pending-payments', async (req, res) => {
  const { data, error } = await req.supabase
    .from('visit_billing')
    .select('*, visits(visit_date, patient_id, patients(name, phone))')
    .eq('clinic_id', req.clinicId)
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Daily Collection + Daily Patients trend over the last N days
// (reuses visits/visit_billing already being collected — no new tables).
router.get('/daily', async (req, res) => {
  const days = Number(req.query.days) || 7;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [visits, billing] = await Promise.all([
    req.supabase.from('visits').select('visit_date').eq('clinic_id', req.clinicId).gte('visit_date', start.toISOString()),
    req.supabase.from('visit_billing').select('amount, created_at').eq('clinic_id', req.clinicId).gte('created_at', start.toISOString()),
  ]);

  if (visits.error) return res.status(500).json({ error: visits.error.message });
  if (billing.error) return res.status(500).json({ error: billing.error.message });

  const byDay = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { date: key, patients: 0, collection: 0 };
  }

  (visits.data || []).forEach((v) => {
    const key = v.visit_date.slice(0, 10);
    if (byDay[key]) byDay[key].patients += 1;
  });

  (billing.data || []).forEach((b) => {
    const key = b.created_at.slice(0, 10);
    if (byDay[key]) byDay[key].collection += Number(b.amount);
  });

  res.json(Object.values(byDay));
});

module.exports = router;
