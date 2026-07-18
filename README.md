# Me & Doctor — Backend (Phase 1 MVP)

Express + Supabase backend for the Me & Doctor (Clinic OS) product, following the locked PRD and backend spec.

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase, MSG91, Wati, Razorpay values
```

1. Create a **new, dedicated Supabase project** for Me & Doctor.
2. Run `migrations/001_init.sql` in the Supabase SQL editor.
3. Deploy this repo to a **new, dedicated Railway service** (do not share infra with other "Me &" products).
4. Point `WATI_*` and `RAZORPAY_*` env vars at the **existing** shared accounts (reused, not new accounts, per the locked decision).

## Structure

- `packages/auth-core` — MSG91 OTP + Supabase-compatible session issuance, nested inside this repo (Railway only builds repo contents, same pattern as Me & Coach)
- `src/routes/auth.js` — send-otp / verify-otp / dev-login, supplies this product's single-role `resolveClaims` (doctor only, no branching)
- `src/routes/clinic.js`, `patients.js`, `visits.js`, `prescriptions.js`, `queue.js`, `billing.js`, `reminders.js` — one file per domain, matching the backend spec
- `src/routes/webhooks.js` — Razorpay `payment.captured` handler
- `src/cron/reminders.js` — daily 8am job sending due follow-up/refill reminders via Wati
- `migrations/001_init.sql` — full schema + RLS policies (every table scoped by `clinic_id` from the JWT)

## Notes

- MVP is single-user per clinic (doctor-only login) — no Staff/Assistant role yet (planned for V1.1)
- One clinic per doctor account — no multi-location support in this schema
- `prescriptions.medicines` is free-text JSONB (no drug database) — enables "repeat last prescription" as a simple copy
- Dev-login route is double-gated (`NODE_ENV` + `DEV_LOGIN_ENABLED`) and returns 404 in any other configuration
