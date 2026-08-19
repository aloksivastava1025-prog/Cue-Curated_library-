# clerk-webhook — deployment guide

Receives `user.deleted` events from Clerk and cascades the deletion
across all CUE tables (DPDP right-to-erasure).

---

## Prerequisites (one-time)

1. **Run the SQL migration first:**
   [`supabase-migration-delete-user-cascade.sql`](../../../supabase-migration-delete-user-cascade.sql)
   — installs the `delete_user_cascade(text)` RPC.

2. **Install Supabase CLI** if you don't have it:
   ```
   npm install -g supabase
   ```

---

## Deploy

From the repo root:

```
supabase login          # opens browser, one-time
supabase link --project-ref rkinvrdjbmoozjzmqshn
supabase functions deploy clerk-webhook
```

The last command uploads this folder and prints the live URL:
```
https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/clerk-webhook
```
Copy that URL — you'll paste it into Clerk in the next step.

---

## Set secrets

**Supabase Dashboard → Edge Functions → your project → Manage secrets:**

| Name                          | Where to get it |
|-------------------------------|-----------------|
| `CLERK_WEBHOOK_SECRET`        | Clerk Dashboard → Webhooks → your endpoint → **Signing Secret** (starts with `whsec_`) |
| `SUPABASE_SERVICE_ROLE_KEY`   | Supabase Dashboard → Project Settings → API → **service_role** key (⚠️ never expose to client) |

`SUPABASE_URL` is set automatically by Supabase — no need to add manually.

---

## Register in Clerk

1. [dashboard.clerk.com](https://dashboard.clerk.com) → your CUE app → **Webhooks** → **Add Endpoint**
2. **URL:** paste the Supabase function URL from above
3. **Message Filtering:** check ONLY `user.deleted`
4. **Create**
5. Copy the **Signing Secret** shown → add it as `CLERK_WEBHOOK_SECRET` in Supabase (previous step)

---

## Test

**Clerk Dashboard → Webhooks → your endpoint → Testing tab:**

1. Pick `user.deleted`
2. Click **Send Event**
3. Check response — should be 200 with `{"received":true,"action":"deleted"}`
4. Check Supabase logs: **Edge Functions → clerk-webhook → Logs** — should show structured JSON log with the event

If signature verification fails (401), the `CLERK_WEBHOOK_SECRET` in
Supabase secrets does not match Clerk's signing secret — re-copy from
Clerk and re-set the secret.

---

## What it does

On a real `user.deleted` event:

1. Verifies the svix signature (rejects if invalid)
2. Extracts the Clerk user_id
3. Calls `delete_user_cascade(user_id)` RPC in Postgres
4. That function:
   - Deletes rows in `prompt_bookmarks`, `prompt_likes` by user_id
   - Deletes rows in `waitlist_emails`, `monthly_waitlist`, `feedback_messages` by email
   - Anonymizes `feedback` rows (message kept, email nulled)
   - Deletes the row in `user_profiles`
5. Logs structured JSON for audit

---

## Other event types

`user.created` and `user.updated` are received with 200 OK so the
webhook stays green in Clerk's dashboard, but they don't trigger any
action yet. Add them later if you want automatic user_profile sync on
signup (Option B in the pricing / auth discussion).
