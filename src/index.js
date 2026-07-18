require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinic');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const prescriptionRoutes = require('./routes/prescriptions');
const queueRoutes = require('./routes/queue');
const billingRoutes = require('./routes/billing');
const reminderRoutes = require('./routes/reminders');
const webhookRoutes = require('./routes/webhooks');
const { startReminderCron } = require('./cron/reminders');

const app = express();

// Razorpay webhook needs the raw body for signature verification,
// so it's mounted BEFORE the json() body parser.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reminders', reminderRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Me & Doctor backend listening on port ${PORT}`);
  startReminderCron();
});
