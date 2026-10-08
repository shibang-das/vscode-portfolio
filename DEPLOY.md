# Deploying — Cloudflare Pages

The site is static files plus one Pages Function. Cloudflare Pages serves both
on the same origin, rebuilds on every push to the connected branch, and the
free plan covers all of it with no card.

**Nothing here can generate a bill.** The Google AI Studio key is free-tier only
and has no billing account attached. The Pages free plan has no overage billing.
When either limit is hit the assistant falls back to its offline index.

## 1. Connect the repo

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages**
   → **Connect to Git**.
2. Authorise GitHub, pick `vscode-portfolio`.
3. Build settings — there is no build step:
   - **Framework preset**: None
   - **Build command**: *leave empty*
   - **Build output directory**: `/`
4. **Save and Deploy**.

Live in about a minute at `https://<project>.pages.dev`. Every push to the
production branch redeploys automatically; pushes to other branches get their
own preview URL.

## 2. Add the Gemini key

Without this the site still works — the assistant just answers from its offline
keyword index instead of Gemini.

1. Get a key at <https://aistudio.google.com/apikey> → **Create API key** →
   pick a project with **no billing account**. Copy it; never commit it.
2. Pages project → **Settings** → **Variables and secrets** → **Add**:
   - `GEMINI_KEY` — type **Secret** — the key
   - `MODEL` — type **Text**, optional — defaults to `gemini-2.0-flash`
3. **Redeploy** (Deployments → latest → Retry deployment). Environment variables
   only reach the function on a fresh deploy.

The function is [`functions/api/chat.js`](functions/api/chat.js), served at
`/api/chat`. It rate-limits to 8 requests per minute per IP and caps questions
at 500 characters, so a stranger cannot drain the free quota.

## 3. Check it

Open the site, hit `Ctrl+I`, ask something the keyword index would get wrong —
"what would he bring to a payments team?". A specific, reasoned answer means
Gemini is live; a list of keywords-and-topics means it fell back.

If it fell back, open DevTools → Network → the `/api/chat` call:

| Status | Cause |
|---|---|
| 404 | Function not deployed — check `functions/api/chat.js` is committed and the output directory is `/` |
| 503 | `GEMINI_KEY` missing — add it, then redeploy |
| 429 | Rate limit (yours or Google's) — expected under load, harmless |
| 400 | Bad model name in `MODEL` |

## Local development

`npx wrangler pages dev .` serves the site with the function at `/api/chat`
(put `GEMINI_KEY` in a local `.dev.vars` file, which is gitignored). Or just
open `index.html` — the call 404s and the offline index answers.

## Turning the AI off

Delete `GEMINI_KEY` and redeploy, or set `ENDPOINT = ''` in
[`assets/llm.js`](assets/llm.js). Either way the assistant reverts to the
offline index with no other changes.
