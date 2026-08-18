# CUE v2.0 Setup — Action Required

This document outlines the manual steps you must perform in your external dashboards (Supabase, Clerk, Dodo, Vercel) before launching the CUE application.

## 1. Supabase Hardening Migration
Before pushing any code to production, you must execute the v2 database migrations.

**Action items:**
1. Open your **Supabase Dashboard** → **SQL Editor**.
2. Run the full contents of `supabase-v2-hardening.sql`. This adds the new idempotency tables, atomic rate limiters, sequence generators, and the Turnstile / User Deletion tables.
3. *Optional but recommended:* Run this first in a separate staging project before applying it to your main production project.

## 2. Clerk Webhooks Setup (DPDP Compliance)
We implemented a `delete_user_cascade` function in Supabase to wipe user data when they delete their account.

**Action items:**
1. Go to the **Clerk Dashboard** → **Webhooks**.
2. Add a new endpoint for the event `user.deleted`.
3. Point this webhook to a new Supabase Edge Function (or backend route) that invokes `supabase.rpc('delete_user_cascade', { p_user_id: user.id })`. 
*(Note: You will need to scaffold a quick edge function or endpoint to handle this webhook payload).*

## 3. Dodo Payments Setup
We have updated the Dodo webhook integration to support both **Annual Subscriptions** and **One-time Lifetime** payments.

**Action items:**
1. In the **Dodo Dashboard**, ensure you have four products configured:
   - Individual (Lifetime) - One-time
   - Team (Lifetime) - One-time
   - Individual (Annual) - Subscription
   - Team (Annual) - Subscription
2. Register your Supabase Edge Function URL as the webhook endpoint: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/dodo-webhook`
3. Select the webhook events: `payment.succeeded`, `subscription.active`, `subscription.renewed`, `subscription.canceled`, `refund.succeeded`, `subscription.past_due`.
4. Copy the webhook secret and add it to your Supabase edge function secrets:
   ```bash
   npx supabase secrets set DODO_WEBHOOK_SECRET=whsec_...
   ```
5. **Mandatory Test:** Before going live, make a test purchase using Dodo's test card to ensure the webhook successfully updates the `user_profiles.plan` to `'cue_plus'`.

## 4. Environment Variables
Ensure all API keys are correctly deployed across your platforms.

**Action items:**
1. **Vercel:** Add `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SENTRY_DSN` to your production environment variables in the Vercel dashboard.
2. **Supabase Edge Functions:** Set the server-side secrets using the CLI:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase secrets set DODO_PAYMENTS_API_KEY=sk_live_...
   npx supabase secrets set DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_TEAM_LIFETIME=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_TEAM_ANNUAL=prod_...
   ```

## 5. Security & CSP Validation (Vercel)
We updated `vercel.json` to deploy your Content Security Policy (CSP) in **Report-Only** mode to avoid accidentally breaking the Clerk login modal.

**Action items:**
1. Monitor your browser console in production for 48 hours.
2. If there are no blocked scripts or iframe errors from Clerk or Cloudflare, update `vercel.json` by changing `"Content-Security-Policy-Report-Only"` back to `"Content-Security-Policy"` to strictly enforce it.
