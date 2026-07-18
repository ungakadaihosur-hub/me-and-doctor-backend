const express = require('express');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const { withClinicAuth } = require('../middleware/auth');

const router = express.Router();
router.use(withClinicAuth);

router.post('/', async (req, res) => {
  const { patient_id, visit_id, medicines } = req.body;
  if (!patient_id || !Array.isArray(medicines)) {
    return res.status(400).json({ error: 'patient_id_and_medicines_required' });
  }

  const { data, error } = await req.supabase
    .from('prescriptions')
    .insert({
      clinic_id: req.clinicId,
      patient_id,
      visit_id: visit_id || null,
      medicines,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Powers the "1-click repeat last prescription" MVP hook
router.get('/last', async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id_required' });

  const { data, error } = await req.supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'no_previous_prescription' });
  res.json(data);
});

// Generates a simple PDF prescription and returns it as a stream
router.get('/:id/pdf', async (req, res) => {
  const { data: rx, error } = await req.supabase
    .from('prescriptions')
    .select('*, patients(name, age, gender), clinics(clinic_name, doctor_name, qualification, clinic_address)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error || !rx) return res.status(404).json({ error: 'not_found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=prescription-${rx.id}.pdf`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(16).text(rx.clinics.clinic_name, { align: 'center' });
  doc.fontSize(10).text(`${rx.clinics.doctor_name} — ${rx.clinics.qualification}`, { align: 'center' });
  doc.text(rx.clinics.clinic_address, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Patient: ${rx.patients.name}  (${rx.patients.age || '-'} / ${rx.patients.gender || '-'})`);
  doc.text(`Date: ${new Date(rx.created_at).toLocaleDateString()}`);
  doc.moveDown();

  rx.medicines.forEach((m, i) => {
    doc.text(`${i + 1}. ${m.name} — ${m.dosage || ''} — ${m.frequency || ''} — ${m.duration || ''}`);
  });

  doc.end();
});

// Shares the prescription PDF link over WhatsApp via Wati
router.post('/:id/share', async (req, res) => {
  const { data: rx, error } = await req.supabase
    .from('prescriptions')
    .select('*, patients(name, phone)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error || !rx) return res.status(404).json({ error: 'not_found' });
  if (!rx.patients.phone) return res.status(400).json({ error: 'patient_has_no_phone' });

  try {
    const pdfUrl = `${process.env.PUBLIC_BASE_URL}/api/prescriptions/${rx.id}/pdf`;

    await axios.post(
      `${process.env.WATI_BASE_URL}/api/v1/sendTemplateMessage`,
      {
        whatsappNumber: rx.patients.phone,
        template_name: 'prescription_share',
        parameters: [{ name: 'pdf_link', value: pdfUrl }],
      },
      { headers: { Authorization: `Bearer ${process.env.WATI_API_KEY}` } }
    );

    res.json({ shared: true });
  } catch (err) {
    console.error('wati share failed:', err.message);
    res.status(502).json({ error: 'whatsapp_share_failed' });
  }
});

module.exports = router;
