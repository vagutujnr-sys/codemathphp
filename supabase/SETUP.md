# Invoicing and client workspace

The new React workspace is served at `/invoicing`. It replaces the non-functional client PIN screen at `/portal` with a redirect to the shared sign-in page. Both admins and clients use a permanent, unique **six-digit numeric PIN**; this implementation does not use OTPs.

## Supabase setup

1. Create or select the Supabase project and set the application environment variables from `.env.example`. The publishable/anon key may be used by the browser; never expose the service-role key there.
2. Install the Supabase CLI, link the project, and apply the migrations:

   ```text
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Set the Edge Function secrets. Use independently generated, high-entropy values for the three secrets and keep `PIN_FINGERPRINT_SECRET` stable: changing it without re-fingerprinting existing accounts would break duplicate-PIN detection.

   ```text
   supabase secrets set PIN_RATE_LIMIT_SECRET=... PIN_FINGERPRINT_SECRET=... PIN_ADMIN_BOOTSTRAP_SECRET=... PIN_LOGIN_ALLOWED_ORIGINS=https://codemathphp.co.za,http://localhost:5173
   ```

   `PIN_LOGIN_ALLOWED_ORIGINS` is used by both PIN sign-in and account-management functions. For local-network testing, include the development computer's current origin (currently `http://172.20.10.14:5173`); update it if the computer's LAN address changes.

4. Deploy both functions:

   ```text
   supabase functions deploy pin-login --no-verify-jwt
   supabase functions deploy manage-pin-user --no-verify-jwt
   ```

   Both functions verify access within their handlers, so the gateway-level JWT check must be disabled for PIN sign-in and the one-time bootstrap request to work.

5. Create the first admin through the `manage-pin-user` function's `bootstrap_admin` action, with the `x-bootstrap-key` header set to `PIN_ADMIN_BOOTSTRAP_SECRET` and the explicitly chosen six-digit `pin` in the JSON body:

   ```text
   curl.exe -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/manage-pin-user -H "apikey: YOUR_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -H "x-bootstrap-key: YOUR_PIN_ADMIN_BOOTSTRAP_SECRET" -d "{\"action\":\"bootstrap_admin\",\"display_name\":\"System Administrator\",\"pin\":\"YOUR_SIX_DIGIT_PIN\"}"
   ```

   The response contains the PIN once. Save it, then remove `PIN_ADMIN_BOOTSTRAP_SECRET` from the Edge Function secrets immediately. The bootstrap action refuses to create another admin once one exists.

6. Create `.env` from `.env.example`, fill in the Supabase project URL and publishable/anon key, and run the application. Do not put `SUPABASE_SERVICE_ROLE_KEY` or any Edge Function secret in the frontend environment.

## Included workflows

- Admin overview with invoice counts, billings, collections and outstanding balances.
- Separate administrator workspace (`/invoicing`) and full-screen staff point of sale (`/pos`); clerks are redirected to the POS and cannot access administrator sections.
- Administrator-created clerk accounts with explicitly assigned, unique six-digit PINs. Create clerk access from the administrator's **Staff access** section.
- Client directory, explicitly assigned unique PINs for client account creation and reset, service catalogue management and invoice creation from services or custom line items.
- Invoice details open on their own route; administrative forms open in dialogs.
- Administrators can permanently delete invoices after confirmation; deleting an invoice also removes its line items and payment receipts and invalidates its public share link.
- Invoice settings let admins add and configure payment methods, instructions for each method, and independent special notes. Only active methods are offered in the POS; the selected method's instructions appear on the private and public invoice views.
- Staff can share tokenized public invoice links; clients can view and print/save their invoices without signing in. The share token grants access to the invoice, so share it only with its intended recipient.
- Invoice status management, partial/full payment recording, unique numbered receipts and browser printing.
- Client portal with its own invoices/receipts, projects, progress, updates and shared links/resources.
- Admins and clients can use private, real-time chat with image, audio, and video attachments (up to 50 MB), recorded voice notes, swipe-to-reply, and read receipts. The chat has an immersive, mobile-friendly conversation view and supports voice-only WebRTC calls; clients can access only their own conversation and administrators can switch between client conversations. Voice calls require HTTPS, microphone permission, and Realtime signaling policies from the chat media/voice-call migration. A TURN service may be needed for calls across restrictive networks.
- In-app activity notifications use browser system notifications while the workspace is open on a secure HTTPS origin (localhost is also supported). Users must enable notification permission in the workspace or chat conversation area. Incoming messages, client invoices/payments, and project updates are announced through Supabase Realtime; the activity-notifications migration adds the required tables to the Realtime publication. These are not Web Push notifications and do not arrive after the app/browser is closed.
- Admins can attach up to five private progress screenshots (up to 10 MB each) to a project update; signed image links are available only to the assigned client and administrators.
- Admins can attach up to five private progress screenshots (up to 10 MB each) to a project update; signed image links are available only to the assigned client and administrators.
- Supabase Row Level Security policies restricting records to an administrator or the client's own account.
- Clerk RLS policies permit invoice-related client, service, invoice and payment access only; project, service-management and staff-management actions remain administrator-only.
- Failed PIN attempts are recorded against an HMAC of the connecting IP; eight failed attempts in a 15-minute window trigger a 15-minute block. PINs are bcrypt-hashed in the database and fingerprinted with a server-only HMAC to enforce uniqueness.

Six-digit PINs are intentionally a convenience credential, not strong authentication. They are permanent and guessable, so the login function limits repeated attempts. Do not reuse these PINs for email, banking or other accounts, and do not store highly sensitive documents in the client area.

## Import the existing PHP system

The one-time importer reads the old JSON files locally and sends their records directly to Supabase. It does not print invoice or client details. First run the database migration, then use a local shell with the service-role key **only in its environment**:

```text
node scripts/import-legacy-invoicing.mjs
```

The importer uses `legacy_import_key` columns to make repeated imports safe. It imports configured clients, services, invoice line items, historical invoice totals and payment details, and creates a legacy receipt record for each invoice already marked paid. Unpaid historical invoices are imported as sent because the PHP system did not store a send-state audit log. Verify the imported counts and sample records in Supabase before retiring the PHP pages. The legacy files remain in `invoicing/` as the source data until that verification is complete.

## Deployment note

The application route is `/invoicing`, but the current repository also contains the old `invoicing/index.php`. Configure the web host to route `/invoicing` to the React application before switching production traffic, and keep the existing PHP/JSON source backed up until import verification is complete. The old PHP files are deliberately not deleted by this change.
