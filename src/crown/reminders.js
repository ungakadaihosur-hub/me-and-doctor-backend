const cron = require('node-cron');
const axios = require('axios');
const { adminClient } = require('../db');

/**
 * Sends a single reminder via the existing Wati account and logs
 * the message_id + delivery_status back onto the reminders row.
 */
async function sendReminder(reminder) {
  const templateName = reminder.type === 'follow_up' ? 'follow_up_reminder' : 'refill_reminder';

  const res = await axios.post(
    `${process.env.WATI_BASE_URL}/api/v1/sendTemplateMessage`,
    {
      whatsappNumber: reminder.patients.phone,
      template_name: templateName,
      parameters: [{ name: 'patient_name', value: reminder.patients.name }],
    },
    { headers: { Authorization: `Bearer ${process.env.WATI_API_KEY}` } }
  );

  const messageId = res.data?.messageId || null;

  await adminClient
    .from('reminders')
    .update({ wati_message_id: messageId, delivery_status: 'sent' })
    .eq('id', reminder.id);

  return { sent: true, messageId };
}

/**
 * Runs daily: finds reminders due today that haven't been sent yet,
 * and sends them. A capped one-time auto-escalation can be layered
 * on later by checking delivery_status + a follow-up window.
 */
function startReminderCron() {
  cron.schedule('0 8 * * *', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const { data: dueReminders, error } = await adminClient
      .from('reminders')
      .select('*, patients(name, phone)')
      .eq('send_date', today)
      .is('wati_message_id', null);

    if (error) {
      console.error('reminder cron query failed:', error.message);
      return;
    }

    for (const reminder of dueReminders || []) {
      try {
        await sendReminder(reminder);
      } catch (err) {
        console.error(`reminder ${reminder.id} send failed:`, err.message);
      }
    }
  });
}

module.exports = { startReminderCron, sendReminder };
