# CUE — Setup Guide

Everything you need to do once, in order, to enable the new admin panel + AI autofill + redesigned detail modal.

---

## Step 1 — Run SQL migrations in Supabase

Go to Supabase Dashboard → your project → **SQL Editor** → **New query**, then run each of these once. Safe to re-run.

### 1a. Add `tags` and `description` columns

Paste this into the SQL editor and click **Run**:

```sql
alter table public.prompts
  add column if not exists tags        jsonb not null default '[]'::jsonb,
  add column if not exists description text;

create index if not exists prompts_tags_idx on public.prompts using gin (tags);
```

### 1b. Add `code` column (for the new Code/Prompt tabs in the modal)

```sql
alter table public.prompts
  add column if not exists code text;
```

Both migration files also exist in this repo at:
- `supabase-migration-tags-description.sql`
- `supabase-migration-code-column.sql`

---

## Step 2 — Put your Anthropic API key in Supabase (secret)

**Do NOT put the API key in the frontend `.env` or any `VITE_*` variable — those are exposed to the browser.**

The edge function runs on Supabase's cloud, so the key ultimately lives in Supabase secrets. Easiest workflow: keep the key in a gitignored local file, then push it to Supabase with one command.

### 2a. Get your Anthropic API key

1. Go to https://console.anthropic.com/settings/keys
2. Click **Create Key**
3. Copy the key (starts with `sk-ant-api03-...`) — you only see it once

### 2b. Paste it into the local (gitignored) file

Open `supabase/.env` and replace the placeholder:

```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_ACTUAL_KEY_HERE
```

`supabase/.env` is already in `.gitignore`, so this file never enters git. `supabase/.env.example` (the template without the real key) stays committed as a hint for future contributors.

### 2c. Push it to Supabase (one command)

```bash
supabase secrets set --env-file ./supabase/.env
```

This uploads every KEY=value in the file as a Supabase secret. Re-run this any time you rotate the key.

**Alternative — Dashboard (no CLI):** Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** → **Add new secret** → name `ANTHROPIC_API_KEY`, value = your key.

---

## Step 3 — Deploy the autofill edge function

The edge function lives at `supabase/functions/autofill-metadata/index.ts` in this repo. Deploy it once (redeploy any time you edit it).

### 3a. Install Supabase CLI (if you don't have it)

```bash
npm install -g supabase
```

### 3b. Link your local project to the Supabase project (first time only)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is in the Supabase Dashboard URL:
`https://supabase.com/dashboard/project/**YOUR_PROJECT_REF**/...`

### 3c. Deploy the function

```bash
supabase functions deploy autofill-metadata
```

You should see something like:
```
Deployed Function autofill-metadata on project ...
```

---

## Step 4 — Test it

1. Restart the dev server (if it's running): `Ctrl+C`, then `npm run dev`
2. Open the app, sign in with an admin email (one of the two in `src/pages/Admin.jsx`)
3. Go to `#/admin`
4. Paste a component prompt (5–20 lines) into the **Prompt / Code** textarea
5. Click **✨ Auto-fill metadata**
6. A preview modal opens — check the fields you want to apply, click **Apply selected**
7. Fill any remaining fields, add a Code snippet if you have one, click **Add to library**
8. Go back to `#/` and click the new card — you should see the two-column detail modal with **Code / Prompt** tabs and a copy button on each.

---

## Environment variables (frontend)

The frontend `.env` still needs the same variables it already has — nothing new to add:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Do NOT put the Anthropic key here.** Anything prefixed `VITE_` is exposed to the browser — a leaked LLM key lets anyone burn your credit.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `AI failed: ANTHROPIC_API_KEY not configured` | Secret not set | Redo Step 2b, then redeploy the function (Step 3c) |
| `AI failed: Anthropic API error 401` | Invalid or expired API key | Regenerate the key in Anthropic Console, update the secret, redeploy |
| Autofill button greyed out | Prompt textarea is empty | Paste at least a few lines of prompt content |
| `column "tags" does not exist` in the app | Migration 1a not run | Run the SQL in Step 1a |
| `column "code" does not exist` | Migration 1b not run | Run the SQL in Step 1b |
| Modal shows old ugly layout | Vite cached old build | Hard reload the browser (`Ctrl+Shift+R`) |
| Categories in admin don't persist as a "new" one | You need to run Step 1a first (tags column) | See above |

---

## Security notes

- **The Anthropic API key never touches the browser.** It lives only as a Supabase secret; the edge function reads it via `Deno.env.get("ANTHROPIC_API_KEY")` and calls Anthropic server-to-server. Even if someone opens DevTools, the key is not there.
- **AI cannot modify or delete any content.** The edge function's response schema whitelists only 6 metadata fields (`title, category, tags, description, stack, tier`) — there is no field for it to touch `prompt`, `code`, `id`, media, or status. The admin then reviews every field before applying.
- **Premium items stay locked.** The redesigned modal paywall hides both `code` and `prompt` behind a purchase or subscription — the values are not sent to the browser for premium items until purchase is verified.
