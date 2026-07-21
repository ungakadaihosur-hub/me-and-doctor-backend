-- Phase 1.1 — closes real MVP gaps identified in the gap analysis.
-- No architecture change: additive columns only, same tables.

alter table patients
  add column address text,
  add column blood_group text,
  add column allergies text,
  add column chronic_conditions text;

alter table visits
  add column diagnosis text,
  add column follow_up_date date;

alter table visit_billing
  add column payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  add column invoice_number int;

-- Simple per-clinic incrementing invoice number, mirrors the existing
-- queue_tokens daily-counter pattern already used in the queue route.
create sequence if not exists invoice_seq;

-- Helpful index for the new Doctor Dashboard's "upcoming follow-ups" query
create index if not exists idx_visits_follow_up on visits(follow_up_date) where follow_up_date is not null;
