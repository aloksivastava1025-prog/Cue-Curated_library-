# Message to forward to your partner

Copy the block below and send it to your partner (WhatsApp / email / DM — jaisa comfortable).

---

## 📋 Copy-paste this to partner

> Hey — I'm setting up my own Supabase project for local testing so I can iterate on the CUE admin without touching the main DB. I need one quick read-only export of the current data. **Nothing gets changed on your side** — this is a `SELECT` query only, no writes, no deletes.
>
> **Do this (2 minutes):**
>
> 1. Open the CUE Supabase project → **SQL Editor** (`</>` icon in the left sidebar)
> 2. Click **+ New query**
> 3. Paste this SQL:
>
> ```sql
> select jsonb_build_object(
>   'prompts',  (select coalesce(jsonb_agg(row_to_json(p) order by p.created_at), '[]'::jsonb) from public.prompts p),
>   'contents', (select coalesce(jsonb_agg(row_to_json(c)),                       '[]'::jsonb) from public.prompt_contents c)
> ) as export;
> ```
>
> 4. Click **Run** (or `Ctrl+Enter`)
> 5. In the results panel, click the cell in the `export` column — a big JSON blob will appear
> 6. Copy the whole thing (there'll be a copy icon), or click **Download CSV**
> 7. Send it back to me (paste in chat, or attach the `.csv` file)
>
> That's it. No write access needed, no service_role key sharing — you're just reading data you own.

---

## Why this is safe for partner to run

- **Read-only** — `select` only, no `update` / `delete` / `insert`
- **No credentials leave their machine** — no keys, tokens, or connection strings needed
- **No structural changes** — doesn't touch schema, RLS, indexes
- **Doesn't lock the tables** — takes milliseconds, other requests keep working

If they're paranoid, they can wrap it in a transaction that rolls back — but there's literally nothing to roll back since it's just a SELECT.

---

## What comes back

A single JSON object like this (real values instead of dots):

```json
{
  "prompts": [
    { "id": "cue001", "title": "Sentence Wobble — Pinned Reveal", "category": "…", "tier": "free", "thumb_src": "https://…", "hover_src": "https://…", "created_at": "…", "…" },
    { "id": "cue002", "title": "Cyberpunk Portrait Hero", "…" }
  ],
  "contents": [
    { "prompt_id": "cue001", "content": "You are a designer. Build a…" },
    { "prompt_id": "cue002", "content": "…" }
  ]
}
```

- `prompts` — the 16 items (title, category, tier, media URLs, tags, etc.)
- `contents` — the actual prompt text for each item (kept in a separate table)

---

## When they send it back to you

Save the JSON to a file at the project root as `partner-export.json`. Then tell me — I'll:

1. Read the JSON
2. Write an insert script that pushes every item into **your** new Supabase project (using the anon key already in `.env`)
3. Run it once → your homepage jumps from 0 → 16 items
4. Delete `partner-export.json` (it's gitignored so it never touches the repo either)

---

## About media (videos, thumbnails)

The `thumb_src` / `hover_src` URLs in the export point to partner's **Supabase storage bucket**. That bucket is public, so those URLs will keep working from your new project **as long as partner doesn't delete the bucket or the files**.

- **Short term:** you're fine — no media re-upload needed
- **Long term (safety):** ask partner not to delete the `cue-media` bucket, OR download all files and re-upload to your bucket. I can write a re-upload script when you're ready — not urgent for testing.

---

## Alternative — CSV format (if partner prefers)

If JSON feels weird, they can do this instead (two separate downloads):

```sql
-- Query 1
select * from public.prompts order by created_at;
-- After running, click "Download CSV" in the results panel → save as prompts.csv

-- Query 2
select * from public.prompt_contents;
-- Download CSV → save as prompt_contents.csv
```

Send both CSVs — same result, I'll process them.
