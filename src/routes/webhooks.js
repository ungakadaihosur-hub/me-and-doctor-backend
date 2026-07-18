const express = require('express');
const crypto = require('crypto');
const { adminClient } = require('../db');

const router = express.Router();

// Razorpay webhook - expects raw body for signature verification.
// Mounted with express.raw() in index.js for this specific route.
router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: 'invalid_signature' });
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const visitBillingId = payment.notes?.visit_billing_id;

    if (visitBillingId) {
      const { error } = await adminClient
        .from('visit_billing')
        .update({ payment_mode: 'razorpay' })
        .eq('id', visitBillingId);

      if (error) console.error('failed to mark billing paid:', error.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;
