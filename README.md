# S-CUBUS Fee Portal

A deployable, multi-user version of the admission fee calculator: counselors log in, calculate and
save a student's admission with a live-computed fee/installment breakdown, and can generate a
signed PDF fee summary that's kept on file. The owner gets an additional dashboard across every
counselor and batch.

## What's already set up

- **Database & auth**: Supabase project `scubus-fee-portal` (id `dqgwafdihafcttynfaea`), in your
  `s-cubus career private limited` org, region `ap-south-1` (Mumbai).
  - Tables: `batches` (all 24 fee-master rows seeded), `admissions`, `profiles`.
  - `admissions_computed` view does all the fee/GST/installment math in SQL (mirrors
    `lib/fee-calc.ts` exactly, so the app and the database always agree).
  - Row-level security: a counselor can only see/edit their own admissions; the owner (the account
    signed up with `director@scubus.com`) sees and manages everything.
  - Storage bucket `fee-receipts` (private) holds a durable copy of every signed PDF, at
    `<counselor_id>/<admission_id>.pdf`.
  - A trigger auto-creates a `profiles` row (role `owner` or `counselor`) whenever someone signs up.

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

`npm audit` flags a transitive `postcss` advisory bundled inside Next.js 14's own build tooling
(build-time only, not something an end user can trigger through this app). Fixing it requires a
Next.js major-version upgrade, which I didn't do blindly to avoid breaking the App Router APIs used
here — worth revisiting later.
