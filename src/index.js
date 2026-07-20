require('dotenv/config');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.js');
const clinicRoutes = require('./routes/clinic.js');
const patientsRoutes = require('./routes/patients.js');
const visitsRoutes = require('./routes/visits.js');
const prescriptionRoutes = require('./routes/prescription.js');
const queueRoutes = require('./routes/queue.js');
const billingRoutes = require('./routes/billing.js');
const remindersRoutes = require('./routes/reminders.js');
const webhooksRoutes = require('./routes/webhooks.js');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/webhooks', webhooksRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Me & Doctor API listening on :${port}`));
