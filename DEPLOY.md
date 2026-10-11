# Deploying — Cloudflare Workers

The repo is a Worker with static assets:

```
public/        the site — index.html + assets/, served by Cloudflare's asset layer
src/index.js   the Worker — only runs for POST /api/chat, everything else falls through
wrangler.jsonc the config that ties the two together
```

Cloudflare builds and deploys on every push to the connected branch. The free
plan covers all of it with no card.

**Nothing here can generate a bill.** The Groq key is free-tier only and needs no
card. The Workers free plan has no overage billing. When either limit is hit the
assistant falls back to its offline index.

> Gemini was the original upstream and had to go: its free tier geofences by
> caller location, and a Worker egresses from whichever Cloudflare edge is
> nearest the visitor — so it answered `FAILED_PRECONDITION: User location is
> not supported`. Groq has no such restriction and is faster.

## 1. Connect the repo

<https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Import a
repository** → pick `vscode-portfolio`.

Leave the build command empty. The deploy command should be the default
`npx wrangler deploy` — if the project was created earlier with something else
(`npx wrangler preview` will fail with *"missing a `previews` block"*), fix it
under **Settings → Build → Deploy command**.

Live at `https://vscode-portfolio.<subdomain>.workers.dev`.

## 2. Add the Groq key

Without this the site still works — the assistant just answers from its offline
keyword index instead of Gemini.

1. Get a key at <https://console.groq.com/keys> → sign in → **Create API Key**.
   Free tier, no card. Copy it; never commit it.
2. Worker → **Settings** → **Variables and Secrets** → **Add**:
   - `GROQ_KEY` — type **Secret** — the key
   - `MODEL` — type **Text**, optional — tried first, then known-good
     fallbacks (`llama-3.3-70b-versatile`, then `llama-3.1-8b-instant`).
     Current ids: <https://console.groq.com/docs/models>
3. **Redeploy** (Deployments → latest → Retry). Variables only reach the Worker
   on a fresh deploy.

Or from the terminal: `npx wrangler secret put GROQ_KEY`.

If you previously set `GEMINI_KEY`, delete it — it is no longer read.

## 3. Check it

Open the site, press `Ctrl+I`, and ask something the keyword index could never
answer — *"would he be a good fit for a payments team?"*. A specific, reasoned
answer means the model is live; a generic list of topics means it fell back.

If it fell back, open DevTools → Network → the `/api/chat` call:

| Status | Cause |
|---|---|
| 404 | Worker not handling the route — check `main` and `name` in `wrangler.jsonc` |
| 503 | `GROQ_KEY` missing — add it, then redeploy |
| 429 | Rate limit, yours or Google's — expected under load, harmless |
| 400 | Request rejected — the response carries the upstream `detail` naming the field |
| 404 | No model matched. The response lists what it `tried`; pick a current id from <https://console.groq.com/docs/models> and set `MODEL` |

The Worker rate-limits to 8 requests per minute per IP and caps questions at 500
characters, so a stranger cannot drain the free quota.

## Local development

```
npx wrangler dev
```

Serves `public/` with the Worker at `/api/chat`. Put `GROQ_KEY=...` in a
`.dev.vars` file — it is gitignored. Without wrangler, opening
`public/index.html` directly also works; the API call 404s and the offline index
answers.

## Turning the AI off

Delete `GROQ_KEY` and redeploy, or set `ENDPOINT = ''` in
[`public/assets/llm.js`](public/assets/llm.js). Either way the assistant reverts
to the offline index with no other changes.
