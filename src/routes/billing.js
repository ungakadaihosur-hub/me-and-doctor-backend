const express = require('express');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.post('/', async (req, res) => {
  const {
    visit_id, amount, payment_mode, upi_qr_ref, payment_status,
    consultation_fee, other_charges, discount,
  } = req.body;

  if (!visit_id) return res.status(400).json({ error: 'visit_id_required' });

  // Itemized flow: consultation_fee + other_charges - discount = total.
  // Simple flow: `amount` passed directly, unchanged from Phase 1.1.
  const hasItemized = consultation_fee != null;
  const total = hasItemized
    ? Number(consultation_fee) + Number(other_charges || 0) - Number(discount || 0)
    : amount;

  if (total == null) return res.status(400).json({ error: 'amount_or_consultation_fee_required' });

  const { count } = await req.supabase
    .from('visit_billing')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', req.clinicId);

  const { data, error } = await req.supabase
    .from('visit_billing')
    .insert({
      clinic_id: req.clinicId,
      visit_id,
      amount: total,
      consultation_fee: consultation_fee ?? null,
      other_charges: other_charges ?? 0,
      discount: discount ?? 0,
      payment_mode,
      upi_qr_ref,
      payment_status: payment_status || (payment_mode === 'razorpay' ? 'pending' : 'paid'),
      invoice_number: (count || 0) + 1,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', async (req, res) => {
  const { payment_status, payment_mode } = req.body;

  const { data, error } = await req.supabase
    .from('visit_billing')
    .update({ payment_status, payment_mode })
    .eq('id', req.params.id)
    .eq('clinic_id', req.clinicId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
    .select('id, amount, consultation_fee, other_charges, discount, payment_mode, payment_status, invoice_number, created_at')
    .eq('clinic_id', req.clinicId)
    .gte('created_at', start.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const total = data.reduce((sum, row) => sum + Number(row.amount), 0);
  res.json({ range, total, count: data.length, rows: data });
});

module.exports = router;
