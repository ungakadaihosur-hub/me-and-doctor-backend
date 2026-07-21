Me & Doctor — Backend (Phase 1 MVP)
Express + Supabase backend for the Me & Doctor (Clinic OS) product — a true clinic operating system for solo doctors and small clinics with one assistant.
Setup
npm install
cp .env.example .env   # fill in Supabase, MSG91, Wati, Razorpay values
Create a new, dedicated Supabase project for Me & Doctor.
Run the migrations in order in the Supabase SQL editor: 001_init.sql → 002_patient_profile_and_followups.sql → 003_full_phase1_mvp.sql.
Deploy this repo to a new, dedicated Railway service (do not share infra with other "Me &" products).
Point WATI_* and RAZORPAY_* env vars at the existing shared accounts (reused, not new accounts, per the locked decision).
Structure
packages/auth-core — MSG91 OTP + Supabase-compatible session issuance, nested inside this repo (Railway only builds repo contents, same pattern as Me & Coach)
src/routes/auth.js — send-otp / verify-otp / dev-login, supplies this product's single-role resolveClaims (doctor only, no branching)
src/routes/clinic.js — Clinic Settings (doctor/clinic identity, registration number, fee, timings, logo, prescription header)
src/routes/patients.js — registration, search (name/mobile/today's token), and the complete patient timeline in one call
src/routes/visits.js — chief complaint, diagnosis, notes, follow-up date (auto-creates reminders), visit status
src/routes/prescriptions.js — medicines, advice, printable PDF, WhatsApp share
src/routes/queue.js — waiting / in_consultation / completed / cancelled
src/routes/billing.js — itemized fees, discount, payment status/method, invoice number
src/routes/dashboard.js — today's stats in one call
src/routes/reports.js — daily collection/patient trend, pending payments list
src/routes/webhooks.js — Razorpay payment.captured handler
src/cron/reminders.js — daily 8am job sending due follow-up reminders via Wati
migrations/ — run in numeric order; full schema + RLS policies (every table scoped by clinic_id from the JWT)
Phase 1 MVP — complete
This backend implements the full approved Phase 1 MVP:
Patients: full registration (name, mobile, gender, DOB/age, address, blood group, allergies, chronic conditions, emergency contact, notes), search by name/mobile/today's-token-number
Patient Timeline: GET /api/patients/:id returns the doctor's complete digital memory in one call — visits, prescriptions, bills, and follow-up history together
Visits: chief complaint, diagnosis, clinical notes, follow-up date (auto-creates the reminders row), visit status (completed/cancelled)
Prescriptions: medicines (free-text), advice, printable PDF (uses Clinic Settings' registration number + custom prescription header when set), WhatsApp share wired and ready (activates once a Wati template is approved)
Queue: waiting → in_consultation → completed, plus cancelled
Billing: itemized consultation fee + other charges − discount = total, payment status (pending/paid), payment method (cash/UPI/card/razorpay), invoice number
Dashboard: today's patients, walk-ins, completed visits, upcoming follow-ups, pending payments, today's revenue, recent patients — one GET /api/dashboard call
Reports: GET /api/reports/daily (7-day patient/collection trend) and GET /api/reports/pending-payments
Clinic Settings: doctor name, qualification, registration number, clinic name/address/phone, consultation fee, timings, logo URL, prescription header
Notes / deliberately out of scope
These remain out of Phase 1 by explicit decision, not oversight — revisit only if beta feedback demands it:
Staff/Assistant role — single doctor login only, no multi-user RBAC
Appointment booking — walk-in queue only, no scheduled appointments
Offline-first — requires network connectivity
ABDM compliance — not requested by target doctors yet
Multi-location — one clinic per doctor account
Also: prescriptions.medicines is free-text JSONB (no drug database) — enables "repeat last prescription" as a simple copy. Dev-login route is double-gated (NODE_ENV + DEV_LOGIN_ENABLED) and returns 404 in any other configuration.
