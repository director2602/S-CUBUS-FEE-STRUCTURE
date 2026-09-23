# S-CUBUS Fee Portal

A deployable, multi-user version of the admission fee calculator: counselors log in, calculate and
save a student's admission with a live-computed fee/installment breakdown, and can generate a
signed PDF fee summary that's kept on file. The owner gets an additional dashboard across every
counselor and batch.

## What's already set up

- **Database & auth**: Supabase project `scubus-fee-portal` (id `dqgwafdihafcttynfaea`), in your
  `s-cubus career private limited` org, region `ap-south-1` (Mumbai).
  - Tables: `batches` (the fee master — owner-editable, see below), `admissions`, `payments`
    (individual installment records), `profiles`.
  - `admissions_computed` view does all the fee/GST/installment math in SQL (mirrors
    `lib/fee-calc.ts` exactly, so the app and the database always agree), and now also sums each
    admission's logged `payments` into `total_paid` / `outstanding` / `billing_status`.
  - Row-level security: a counselor can only see/edit their own admissions and their payments; the
    owner (the account signed up with `director@scubus.com`) sees and manages everything.
  - Storage bucket `fee-receipts` (private) holds a durable copy of every signed PDF, at
    `<counselor_id>/<admission_id>.pdf`.
  - A trigger auto-creates a `profiles` row (role `owner` or `counselor`) whenever someone signs up.
- **Editing a saved admission**: the owner can edit any admission's details from its "Edit" link;
  a counselor can edit their own. Editing an admission never touches the `batches` fee master.
- **Revising the fee master**: the owner-only `/fee-structure` page edits `batches` directly.
  Because every admission stores its own effective reg/tuition/kit fee and scholarship % at save
  time (a frozen snapshot, never `null`), changing a batch's fee here only affects *new* admissions
  going forward — it never rewrites what an existing student already agreed to.
- **Installment tracking**: from any admission's page (`/admissions/[id]`), a counselor can log each
  installment as it's actually paid (stage, amount, date, mode, note) via the Payments panel, and
  edit or delete a logged payment later if it was entered wrong. The amount entered at admission
  time is the opening balance; every payment logged afterwards adds on top of it, so `total_paid` /
  `outstanding` / billing status always reflect the real running total — not just what was typed
  once at save time.
- **Printing an invoice**: every counselor can print any admission they can see as a clean invoice
  from its "Print invoice" link (`/admissions/[id]/invoice` → browser print).
- **Owner dashboard**: `/dashboard` has summary KPIs, revenue-by-batch and per-counselor rollups,
  plus a full filterable ledger of every admission — filter by counselor, batch group, billing
  status, admission date range, or free-text search; sort any column; expand a row for every
  calculator field (fee components, GST, installments, payment modes, PDC numbers, remarks,
  signature status); select rows to see a live payable/paid/outstanding total for just that
  selection; and export the filtered or selected rows to CSV.

## What you need to do once

1. **Get the owner login.** Open the deployed app's `/login` page, switch to "Create the owner
   account", and sign up with `director@scubus.com` and a password of your choice. Because that
   email is hard-coded as the owner in the database trigger, you'll land as owner automatically —
   no separate setup needed.
2. **Enable "Invite counselor" (optional but recommended).** That feature needs your Supabase
   project's `service_role` secret key, which is never exposed through any automated tool for
   security reasons — you have to copy it yourself:
   - Supabase dashboard → this project → Settings → API → `service_role` key → copy it.
   - Add it as an environment variable named `SUPABASE_SERVICE_ROLE_KEY` on your hosting provider
     (Render: Service → Environment). Never put it in `NEXT_PUBLIC_*` or commit it to git.
   - Until you do this, the rest of the app works fine — only "Invite counselor" will show an error
     telling you the key is missing.

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already
filled in and safe to expose publicly (that's how Supabase's client-side auth is designed to work).
`SUPABASE_SERVICE_ROLE_KEY` is the one secret — see step 2 above.

## Local development

```bash
npm install
cp .env.example .env.local   # already has the right URL/anon key
npm run dev
```

## Deploying

This is a standard Next.js 14 (App Router) app — deploys anywhere that runs Node 18+:

1. Push this folder to a GitHub repository (I couldn't do this step myself — this Claude session
   has no linked GitHub account, so I can't create or push to a repo on your behalf).
2. On Render: New → Web Service → connect that repo → Build command `npm run build`, Start
   command `npm start`, Node runtime. Add the three environment variables above.
3. If you'd rather I finish the deployment myself: connect a GitHub account to this Claude session
   (or give me push access to an empty repo you create) and let me know — I'll push this code and
   create the Render service in one go.

## Data model notes

- `admissions.reg_fee_override` / `tuition_fee_override` / `kit_fee_override` let a counselor
  override any batch default for a specific student (e.g. the "Special Student" case) — `null`
  means "use the batch default."
- "Kit fee" combines module cost + technology charges + uniform cost into one line, per your
  request.
- The 3-installment schedule matches the original sheets: registration upfront, 40% of the
  remaining balance before batch commencement, the rest split evenly across month 2 and month 4 —
  with the last installment absorbing any rounding so it always reconciles to exactly zero.
- Signing a PDF (`/admissions/[id]`) stores the signature image, signer name, timestamp and a
  Supabase Storage path on the `admissions` row, so "who signed, when, and a copy of what they
  signed" is always retrievable — not just downloaded once and forgotten.

## Known limitation

`npm audit` flags advisories in Next.js 14.2.x itself (cache poisoning, SSRF in Server Actions,
DoS, plus a build-time-only `postcss` issue). Next has stopped backporting fixes to the 14.x line
for these — a fix needs a major-version jump to Next 15/16, which changes the App Router cookie
APIs (`cookies()` becomes async) used throughout this app's auth. That's a real migration, not a
patch bump, so I didn't do it silently alongside unrelated feature work. Since this app sits behind
login for S-CUBUS staff only (no public write-heavy Server Actions beyond the counselor invite
form, and no user-controlled rewrites), the practical exposure is low, but it's worth scheduling a
dedicated Next 15/16 upgrade + regression pass rather than leaving it indefinitely.
