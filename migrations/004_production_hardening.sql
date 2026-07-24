-- Phase 1 MVP completion — additive columns + one status-value migration only.
-- No architecture change: same tables, same RLS policies (clinic_id scoping
-- already covers every new column since RLS is row-level, not column-level).

-- Patient Registration: remaining fields
alter table patients
  add column date_of_birth date,
  add column emergency_contact text,
  add column notes text;

-- Visit Workflow: Chief Complaint + Visit Status
alter table visits
  add column chief_complaint text,
  add column status text not null default 'completed' check (status in ('completed', 'cancelled'));

-- Prescription: general Advice, separate from the per-medicine fields
alter table prescriptions
  add column advice text;

-- Queue: rename 'done' -> 'completed' for clarity, add 'cancelled'
alter table queue_tokens drop constraint queue_tokens_status_check;
update queue_tokens set status = 'completed' where status = 'done';
alter table queue_tokens add constraint queue_tokens_status_check
  check (status in ('waiting', 'in_consultation', 'completed', 'cancelled'));

-- Billing: itemized breakdown. `amount` remains the authoritative total
-- (existing dashboard/report queries already sum it) — when the new
-- itemized fields are supplied, the API computes amount = consultation_fee
-- + other_charges - discount; the simple single-amount flow still works
-- unchanged for anyone not using the itemized fields.
alter table visit_billing
  add column consultation_fee numeric,
  add column other_charges numeric default 0,
  add column discount numeric default 0;

alter table visit_billing drop constraint visit_billing_payment_mode_check;
alter table visit_billing add constraint visit_billing_payment_mode_check
  check (payment_mode in ('cash', 'upi', 'card', 'razorpay'));

-- Clinic Settings: remaining fields
alter table clinics
  add column registration_number text,
  add column consultation_fee numeric,
  add column clinic_timings text,
  add column logo_url text,
  add column prescription_header text;

-- Indexes for the new search-by-token and reports use cases
create index if not exists idx_queue_token_number on queue_tokens(clinic_id, token_number, created_at);
create index if not exists idx_billing_payment_status on visit_billing(clinic_id, payment_status);
