-- Switches login from MSG91 SMS OTP to Supabase's own Auth (magic
-- link email). Architecture stays the same (Postgres + RLS) — only the
-- identity mechanism changes: doctors are now linked to a real
-- auth.users row instead of being looked up by phone.

-- ── Doctors: link to Supabase Auth ─────────────────────────────────
alter table doctors add column auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table doctors alter column phone drop not null;
alter table doctors drop constraint if exists doctors_phone_key;

-- ── Helper: resolves the calling user's clinic_id from their auth
--    session, without needing a custom JWT claim. SECURITY DEFINER so
--    the SELECT inside it bypasses RLS on `doctors` — without this,
--    every policy that calls current_clinic_id() would recurse into
--    doctors' own RLS policy, which would try to call
--    current_clinic_id() again.
create or replace function current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from doctors where auth_user_id = auth.uid() limit 1;
$$;

-- ── Replace every RLS policy: custom JWT claim -> current_clinic_id() ──
drop policy if exists clinic_isolation on clinics;
create policy clinic_isolation on clinics
  for all using (id = current_clinic_id());

drop policy if exists doctor_isolation on doctors;
create policy doctor_isolation on doctors
  for all using (auth_user_id = auth.uid());

drop policy if exists patients_isolation on patients;
create policy patients_isolation on patients
  for all using (clinic_id = current_clinic_id());

drop policy if exists visits_isolation on visits;
create policy visits_isolation on visits
  for all using (clinic_id = current_clinic_id());

drop policy if exists prescriptions_isolation on prescriptions;
create policy prescriptions_isolation on prescriptions
  for all using (clinic_id = current_clinic_id());

drop policy if exists queue_isolation on queue_tokens;
create policy queue_isolation on queue_tokens
  for all using (clinic_id = current_clinic_id());

drop policy if exists billing_isolation on visit_billing;
create policy billing_isolation on visit_billing
  for all using (clinic_id = current_clinic_id());

drop policy if exists reminders_isolation on reminders;
create policy reminders_isolation on reminders
  for all using (clinic_id = current_clinic_id());

drop policy if exists daily_counters_isolation on daily_counters;
create policy daily_counters_isolation on daily_counters
  for all using (clinic_id = current_clinic_id());

drop policy if exists clinic_counters_isolation on clinic_counters;
create policy clinic_counters_isolation on clinic_counters
  for all using (clinic_id = current_clinic_id());
