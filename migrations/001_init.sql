-- Me & Doctor (Clinic OS) — Phase 1 MVP schema
-- One clinic per doctor account. Single role: doctor. No multi-location, no drug_master table.

create extension if not exists "uuid-ossp";

create table clinics (
  id uuid primary key default uuid_generate_v4(),
  doctor_name text not null,
  qualification text,
  clinic_name text not null,
  clinic_address text,
  phone text,
  created_at timestamptz not null default now()
);

create table doctors (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  phone text unique not null,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  phone text,
  age int,
  gender text,
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_date timestamptz not null default now(),
  soap_notes text,
  vitals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table prescriptions (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  medicines jsonb not null default '[]'::jsonb, -- [{name, dosage, frequency, duration}]
  shared_via text check (shared_via in ('pdf','whatsapp','both')),
  created_at timestamptz not null default now()
);

create table queue_tokens (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  token_number int not null,
  status text not null default 'waiting' check (status in ('waiting','in_consultation','done')),
  created_at timestamptz not null default now()
);

create table visit_billing (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  amount numeric not null,
  payment_mode text check (payment_mode in ('cash','upi','razorpay')),
  upi_qr_ref text,
  created_at timestamptz not null default now()
);

create table reminders (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  type text not null check (type in ('follow_up','refill')),
  send_date date not null,
  wati_message_id text,
  delivery_status text,
  created_at timestamptz not null default now()
);

-- Indexes for common lookups
create index idx_patients_clinic on patients(clinic_id);
create index idx_visits_patient on visits(patient_id);
create index idx_prescriptions_patient on prescriptions(patient_id);
create index idx_queue_clinic_created on queue_tokens(clinic_id, created_at);
create index idx_billing_clinic_created on visit_billing(clinic_id, created_at);
create index idx_reminders_send_date on reminders(send_date);

-- RLS: every table scoped by clinic_id matching the JWT custom claim
-- minted by @me-and/auth-core (claims.clinic_id).

alter table clinics enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table visits enable row level security;
alter table prescriptions enable row level security;
alter table queue_tokens enable row level security;
alter table visit_billing enable row level security;
alter table reminders enable row level security;

create policy clinic_isolation on clinics
  for all using (id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy doctor_isolation on doctors
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy patients_isolation on patients
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy visits_isolation on visits
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy prescriptions_isolation on prescriptions
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy queue_isolation on queue_tokens
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy billing_isolation on visit_billing
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);

create policy reminders_isolation on reminders
  for all using (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);
