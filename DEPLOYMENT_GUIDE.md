# CUE v2.0 — Safe Deployment Guide

This guide ensures you can safely deploy the v2.0 hardening features and hybrid billing logic without damaging your existing production database or causing downtime.

---

## Phase 1: Safe Database Migration

We have implemented strict RLS, atomic rate-limiters, and sequence generation. We must apply this safely to your Supabase project.

1. **Backup Your Production DB (Optional but recommended):**
   * Go to your Supabase Dashboard → **Database** → **Backups** and trigger a manual backup if your plan supports it.
2. **Execute the Hardening Script:**
   * Open Supabase Dashboard → **SQL Editor**.
   * Open the file `supabase-v2-hardening.sql` in your local project and copy all of its contents.
   * Paste it into a new query in the SQL Editor.
   * Click **Run**.
   * *Why this is safe:* The script uses `CREATE OR REPLACE` and `INSERT ... ON CONFLICT DO NOTHING`. It has been specifically designed to run on top of your existing v1 schema without deleting any rows (unless they violate new strict constraints, which we planned for). We also explicitly handle the `next_prompt_id` sequence by querying the maximum ID currently in your `prompts` table, preventing any ID collision errors.

---

## Phase 2: Deploying the Edge Functions

We've added three critical backend functions that must run on Supabase's Edge Network: `autofill-metadata`, `dodo-webhook`, and the newly created `clerk-webhook`.

1. **Open your local terminal** in your project root (`C:\Users\Akarsh\Desktop\Cue_Final_build`).
2. **Link your project (if not already linked):**
   ```bash
   npx supabase link --project-ref [YOUR_SUPABASE_PROJECT_REF]
   ```
3. **Deploy the functions:**
   ```bash
   npx supabase functions deploy autofill-metadata
   npx supabase functions deploy create-checkout
   npx supabase functions deploy dodo-webhook
   npx supabase functions deploy clerk-webhook
   ```
4. **Set the server-side secrets in Supabase:**
   (Run these one by one in your terminal)
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   
   # Dodo Webhook & API Key
   npx supabase secrets set DODO_PAYMENTS_API_KEY=sk_live_...
   npx supabase secrets set DODO_WEBHOOK_SECRET=whsec_...
   
   # Hybrid Billing Product IDs
   npx supabase secrets set DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_TEAM_LIFETIME=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL=prod_...
   npx supabase secrets set DODO_PRODUCT_ID_TEAM_ANNUAL=prod_...
   
   # Clerk Webhook Secret
   npx supabase secrets set CLERK_WEBHOOK_SECRET=whsec_...
   ```

---

## Phase 3: Webhook Configurations

### 1. Clerk Webhook (DPDP Compliance - Data Erasure)
We implemented a `delete_user_cascade` function to wipe user data when they delete their account. The edge function is now ready.
* Go to the **Clerk Dashboard** → **Webhooks**.
* Click **Add Endpoint**.
* Set the Endpoint URL to: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/clerk-webhook`
* Under "Message Filtering", check only `user.deleted`.
* Create the endpoint, copy the **Signing Secret**, and set it via the Supabase CLI (`CLERK_WEBHOOK_SECRET`) as shown in Phase 2.

### 2. Dodo Payments Webhook (Hybrid Billing)
* Go to the **Dodo Dashboard** → **Developers** → **Webhooks**.
* Click **Add Webhook**.
* Set the Endpoint URL to: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/dodo-webhook`
* Select these events: 
  * `payment.succeeded`
  * `subscription.active`
  * `subscription.renewed`
  * `subscription.canceled`
  * `subscription.past_due`
  * `refund.succeeded`
* Copy the webhook secret and set it as `DODO_WEBHOOK_SECRET`.

---

## Phase 4: Vercel Frontend Deployment

1. **Environment Variables:**
   In your Vercel Dashboard → Settings → Environment Variables, ensure the following are set:
   * `VITE_CLERK_PUBLISHABLE_KEY`
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
   * `VITE_SENTRY_DSN`
2. **Push to GitHub / Deploy:**
   * Commit the changes and push them to your repository (`main` or `Alok_working` branch).
   * Vercel will automatically build and deploy.
3. **CSP Validation:**
   * The CSP header in `vercel.json` is set to `Content-Security-Policy-Report-Only`. This is completely safe—it will **not** block any scripts or break Clerk, but will instead report policy violations to your browser console. 
   * Monitor your site for a few days to ensure no unexpected scripts are caught by the policy. Once verified, you can change it to strict enforcement by removing `-Report-Only`.

Everything is now safely isolated, resilient, and ready for global scaling.
