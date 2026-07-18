const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.post('/', async (req, res) => {
  const { visit_id, amount, payment_mode, upi_qr_ref } = req.body;
  if (!visit_id || amount == null) {
    return res.status(400).json({ error: 'visit_id_and_amount_required' });
  }

  const { data, error } = await req.supabase
    .from('visit_billing')
    .insert({ clinic_id: req.clinicId, visit_id, amount, payment_mode, upi_qr_ref })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/summary', async (req, res) => {
  const { range = 'day' } = req.query;
  const now = new Date();
  let start;

  if (range === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  }

  const { data, error } = await req.supabase
    .from('visit_billing')
    .select('amount, payment_mode, created_at')
    .eq('clinic_id', req.clinicId)
    .gte('created_at', start.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const total = data.reduce((sum, row) => sum + Number(row.amount), 0);
  res.json({ range, total, count: data.length, rows: data });
});

module.exports = router;
