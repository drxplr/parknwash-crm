# Park n Wash CRM

React + TypeScript + Vite + Tailwind frontend with Supabase Auth and shared, workspace-scoped persistence. No Vercel is used.

## Run

Use Node.js 24 and pnpm 11. Copy `.env.example` to `.env.local`, fill in the project URL and **publishable** key, then run `pnpm install`, `pnpm dev`. `pnpm test` runs behavior tests; `pnpm build` checks TypeScript and builds `dist/`.

Production builds default to cloud mode and show a configuration error if connection details are missing. `VITE_CRM_MODE=demo` explicitly enables fictional fixtures and browser-local demo storage; never enter real customer data in that mode.

## Connected mode

- Supabase email/password login, tab-scoped session storage, no public signup UI. Email links are hidden until `VITE_EMAIL_AUTH_ENABLED=true` and custom SMTP is configured and verified.
- Workspace data stays in memory, not localStorage or published assets. Sign-out clears the in-memory workspace. A failed connection never loads sample customers.
- Normalized tables are read in a consistent snapshot. Changes use a transactional RPC with a workspace revision; stale writes fail instead of overwriting another editor. Staff collisions roll back the entire booking/history batch.
- Viewer/editor/admin permissions are enforced in the database. Pending access grants are tied to confirmed Auth accounts and consumed once; removing membership does not silently re-enroll the account.
- Calendar day/week/list, region and staff filters, booking details/rescheduling/payment status, customers and fleets, vehicle histories, notes, global search, Messages and configurable services/tariffs/staff remain available.
- New workspaces start without fabricated customers, staff, services or prices. Add staff and services in Settings, then customers and vehicles. A vehicle size and corresponding tariff are required before a new booking can be quoted.
- Dates use Europe/Zurich. Messages are prepared for manual WhatsApp sending; opening WhatsApp does not mark anything sent. Wash reminders require explicit opt-in and pause when a future booking exists.
- Team changes are checked every 20 seconds. Updates show a reload prompt so an open draft is not overwritten. Revoked workspace access clears the loaded workspace on the next successful check.

## Source and publishing

The public frontend repository is `https://github.com/drxplr/parknwash-crm`. Backend migrations and private import preparation stay in the original private project. The public repository contains frontend source and fictional test fixtures only.

GitHub Pages builds the frontend from `main` with GitHub Actions. Repository variables supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; these values are public frontend configuration. A service-role key, secret key, database password, client export, invitation list or customer spreadsheet must never be included.

The Supabase schema/RPC contract must already exist before using this frontend. Its private setup notes and migrations are under `supabase/` in the original project. Do not copy that project's folder recursively into a public repository.

## Pilot limits

Real customer imports require reviewed mapping/counts and an authenticated round-trip test first. The original Numbers file and local candidates have not been imported. Payment status is an internal record, not payment-provider reconciliation. Manually marked messages are operator assertions, not WhatsApp delivery receipts. The frontend has no built-in invitation sender, password-reset flow without SMTP, or team-role management UI yet.
