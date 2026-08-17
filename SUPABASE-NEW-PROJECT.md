# CUE — Naya Supabase project setup (step-by-step)

**Kul time: ~5 minutes.** Har step end mein "verify" hai — us se tumhe pata chalega ki sahi hua ya nahi.

---

## Step 1 — Naya Supabase project banao

1. https://supabase.com/dashboard pe jao
2. **New project** dabao
3. Fill karo:
   - **Name:** `cue-alok` (ya jo bhi tumhe pasand)
   - **Database Password:** Supabase generate button dabao → password apne password manager mein save karo (mujhe nahi chahiye)
   - **Region:** `Mumbai` ya `Singapore` (India ke liye tez)
4. **Create new project** dabao — ~1 minute lagega. Green ✓ dikhne ka wait karo.

**Verify:** Dashboard mein project ka naam upar dikhne lage aur "healthy" status ho.

---

## Step 2 — Schema banao (poora DB ek shot mein)

1. Dashboard mein left sidebar → **SQL Editor** icon (`</>` jaisa) dabao
2. **+ New query** dabao
3. Is repo ki file `supabase-full-setup.sql` **poori copy karo** aur editor mein paste kar do
4. Neeche right corner mein **Run** button dabao (ya `Ctrl+Enter`)

**Verify:** Neeche success message dikhega ("Success. No rows returned"). Left sidebar → **Table Editor** kholo → tumhe `prompts` aur `prompt_contents` dono tables dikhne chahiye.

*Kya hua:* Tables ban gaye, saare columns (tags, description, code, use_case, component_type included), storage bucket `cue-media` ban gaya, aur RLS policies laga di gayi (anon read + write allowed for local testing).

---

## Step 3 — Frontend ko naye Supabase se connect karo

Sabse tez cheez.

1. Supabase Dashboard mein left sidebar → **⚙️ Settings** (bottom) → **API**
2. Do values dikhengi — dono copy karke bhejo ya khud paste karo:

| Yeh copy karo | Yaha paste karo |
|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | Is repo ki `.env` file → line 15 (`VITE_SUPABASE_URL=`) |
| **anon public** key (bada `eyJ...` string) | Is repo ki `.env` file → line 18 (`VITE_SUPABASE_ANON_KEY=`) |

**Exact jagah `.env` file mein clearly marker hai:**

```
# 👇  REPLACE THESE TWO LINES WITH YOUR NEW SUPABASE PROJECT'S VALUES
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# ☝️  REPLACE THESE TWO LINES
```

3. Save karo.

**Verify:** Ye do lines badli hui hain aur file save hai.

---

## Step 4 — Dev server restart karo (naya `.env` load karne ke liye)

Terminal mein:

1. Jo dev server chal raha hai use `Ctrl+C` se stop karo
2. `npm run dev` chalao

**Verify:** Terminal mein `VITE ... ready` message aaye, browser mein `http://localhost:5173/` khule aur homepage dikhe.

---

## Step 5 — Test karo

1. Sign in karo (admin email se)
2. `#/admin` pe jao
3. Prompt paste karo, **✨ Auto-fill metadata** dabao (autofill wale kaam ke liye Anthropic key `supabase/.env` mein pehle se hai — kuch nahi karna)
4. Fields fill karo, **Add to library** dabao

**Verify:** Save success ka toast aaye, count `16 → 17` ho jaye. Homepage pe wapas jao — naya item card grid mein dikhega. ✅

---

## Common issues

| Symptom | Fix |
|---|---|
| Save pe "Failed to fetch" | `.env` restart nahi kiya — Step 4 repeat karo |
| Save pe "permission denied" ya "RLS" error | Step 2 wapas run karo — RLS policies apply nahi hui hongi |
| Autofill kaam nahi kar raha | `supabase/.env` mein Anthropic key hai kya check karo (yeh unchanged rehni chahiye) |
| Homepage khaali (0 resources) | Normal hai — seed data code se aata hai, refresh karo |
| Video upload 413 | Storage bucket `cue-media` file_size_limit check karo (Step 2 ne 25MB set kiya — badhana ho toh Dashboard → Storage → Buckets → cue-media → Edit) |

---

## Kya kya nahi karna

- ❌ Database password mujhe mat bhejo — sirf tumhare paas rakho
- ❌ Anthropic key change mat karo (`supabase/.env` mein hai) — Supabase project se koi relation nahi
- ❌ Purane Supabase (partner ke) ka data delete/touch mat karo — woh alag project hai, kuch nahi hoga
- ❌ Frontend `.env` mein Anthropic key mat daalna — woh sirf `supabase/.env` mein rehni chahiye

---

## Baad mein (jab production ke liye kaam karna ho)

Current RLS policies **open** hain (anyone can read + write). Local testing ke liye theek. Deploy karne se pehle:
- Writes ko `authenticated` role tak restrict karo (Clerk JWT check with)
- Ya specific admin emails ka whitelist
- Bataana, migration file bana dunga
