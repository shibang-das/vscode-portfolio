# Assistant proxy — zero-cost setup

The portfolio's assistant works with no backend at all: `assets/assistant.js`
answers from a local intent index. This worker is optional — it swaps that
index for Gemini while keeping the API key out of the browser.

**Nothing here can generate a bill.** The AI Studio key is free-tier only and
has no billing account attached; the Cloudflare Workers free plan needs no card.
When either limit is hit you get a `429`, and the site silently falls back to
the offline index.

## 1. Get a free Gemini key

1. Go to <https://aistudio.google.com/apikey> and sign in.
2. **Create API key** → pick a *new* project, not one with billing enabled.
3. Copy the key. Do not commit it anywhere.

Free tier is per-minute and per-day request limits. No card, no overage.

## 2. Deploy the worker

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Worker**.
   The free plan (100k requests/day) is the default; no card required.
2. Name it something like `portfolio-assistant`, deploy the placeholder.
3. **Edit code** → paste the contents of `gemini-proxy.js` → **Deploy**.
4. **Settings → Variables and Secrets**:
   - `GEMINI_KEY` — type **Secret** — your AI Studio key
   - `ALLOW_ORIGIN` — type **Text** — the exact origin of the site,
     e.g. `https://shibangdas.github.io` (no trailing slash)
   - `MODEL` — type **Text**, optional — defaults to `gemini-2.0-flash`
5. Copy the worker URL: `https://portfolio-assistant.<subdomain>.workers.dev`

## 3. Point the site at it

In [`assets/llm.js`](../assets/llm.js), set:

```js
const ENDPOINT = 'https://portfolio-assistant.<subdomain>.workers.dev';
```

That URL is public by design — it is a proxy, not a key. `ALLOW_ORIGIN` and the
per-IP rate limit (8 requests/minute, in `gemini-proxy.js`) are what stop a
stranger from spending your free quota.

## Local development

`ALLOW_ORIGIN` must match wherever you're serving from, so for local testing
either set it to `http://localhost:8000` temporarily, or just leave `ENDPOINT`
empty — the offline index keeps working.

## Turning it off

Blank out `ENDPOINT`. The assistant reverts to the offline index with no other
changes. Delete the worker in the Cloudflare dashboard and revoke the key in AI
Studio if you want it gone entirely.
