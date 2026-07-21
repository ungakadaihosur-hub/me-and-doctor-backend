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

router.get('/', async (req, res) => {
  const { start, end } = todayRange();
  const todayDate = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    todayVisits, todayTokens, completedTokens, todayBilling,
    pendingBilling, recentPatients, upcomingFollowUps,
  ] = await Promise.all([
    req.supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('clinic_id', req.clinicId).gte('created_at', start).lte('created_at', end),
    // No appointment booking exists in this MVP, so every token issued
    // today is by definition a walk-in.
    req.supabase.from('queue_tokens').select('id', { count: 'exact', head: true })
      .eq('clinic_id', req.clinicId).gte('created_at', start).lte('created_at', end),
    req.supabase.from('queue_tokens').select('id', { count: 'exact', head: true })
      .eq('clinic_id', req.clinicId).eq('status', 'completed').gte('created_at', start).lte('created_at', end),
    req.supabase.from('visit_billing').select('amount')
      .eq('clinic_id', req.clinicId).gte('created_at', start).lte('created_at', end),
    req.supabase.from('visit_billing').select('amount')
      .eq('clinic_id', req.clinicId).eq('payment_status', 'pending'),
    req.supabase.from('patients').select('id, name, phone, created_at')
      .eq('clinic_id', req.clinicId).order('created_at', { ascending: false }).limit(5),
    req.supabase.from('visits').select('id, follow_up_date, patients(name, phone)')
      .eq('clinic_id', req.clinicId).gte('follow_up_date', todayDate).lte('follow_up_date', in7Days)
      .order('follow_up_date', { ascending: true }),
  ]);

  const todayRevenue = (todayBilling.data || []).reduce((sum, r) => sum + Number(r.amount), 0);
  const pendingAmount = (pendingBilling.data || []).reduce((sum, r) => sum + Number(r.amount), 0);

  res.json({
    today_patient_count: todayVisits.count || 0,
    walk_ins_today: todayTokens.count || 0,
    completed_visits_today: completedTokens.count || 0,
    today_revenue: todayRevenue,
    pending_payments_count: (pendingBilling.data || []).length,
    pending_payments_amount: pendingAmount,
    recent_patients: recentPatients.data || [],
    upcoming_follow_ups: upcomingFollowUps.data || [],
  });
});

module.exports = router;
