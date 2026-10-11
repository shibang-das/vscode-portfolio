/* ────────────────────────────────────────────────────────────────
   src/index.js — the Worker behind the portfolio.

   Static files are served by Cloudflare from the assets binding; this
   code only runs for paths the assets do not cover, which in practice
   means POST /api/chat.

   That endpoint holds the Google AI Studio key as an environment
   secret and forwards to Gemini's free tier, so the browser never sees
   a key. Same origin as the site, so there is no CORS to configure.

   Environment (Worker → Settings → Variables and Secrets):
     GEMINI_KEY  secret, required — AI Studio key, free tier only
     MODEL       text,   optional — tried first, then known-good
                 fallbacks; list what your key can call with
                 GET /v1beta/models and the same key header

   No paid features anywhere: no streaming, no KV, no durable objects.
   When the free quota runs out Google returns 429, this returns 429,
   and public/assets/llm.js falls back to the offline index.
   ──────────────────────────────────────────────────────────────── */

const MAX_QUESTION = 500;        // characters
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;        // per IP, per minute

const hits = new Map();          // in-memory; resets when the isolate recycles

function rateLimited(ip, now) {
  const seen = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);
  if (hits.size > 5000) hits.clear();          // crude cap, keeps memory flat
  return seen.length > MAX_PER_WINDOW;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

async function chat(request, env) {
  if (!env.GEMINI_KEY) return json({ error: 'not configured' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip, Date.now())) return json({ error: 'rate limited' }, 429);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const question = String(body.question || '').slice(0, MAX_QUESTION).trim();
  if (!question) return json({ error: 'empty question' }, 400);

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const contents = [
    ...history
      .filter(m => m && typeof m.text === 'string')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 1000) }] })),
    { role: 'user', parts: [{ text: question }] }
  ];

  /* Model ids get retired, and a retired id answers 404 — which used
     to surface as a bare "upstream 404" with no hint that the name was
     the problem. Try the configured model first, then known-good
     fallbacks, and report what actually served. */
  const candidates = [env.MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash']
    .filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);

  /* The REST API types are an enum — OBJECT/STRING uppercase. The SDKs
     accept lowercase and quietly normalise it; v1beta answers 400.
     Structured output is also the most fragile part of the request, so
     it is built separately and can be dropped on a retry. */
  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      answer: { type: 'STRING' },
      open: {
        type: 'STRING',
        enum: ['home', 'about', 'experience', 'projects', 'skills',
               'achievements', 'contact', 'readme', 'resume', 'none']
      }
    },
    required: ['answer', 'open']
  };

  const buildPayload = structured => JSON.stringify({
    systemInstruction: { parts: [{ text: String(body.system || '').slice(0, 20000) }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 400,
      responseMimeType: 'application/json',
      ...(structured ? { responseSchema: SCHEMA } : {})
    }
  });

  let upstream, served, detail = '';
  for (const candidate of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`;

    /* Ask for a schema first; if the model rejects the request outright,
       try it once more as plain JSON. The prompt already describes the
       shape, so an unschema'd answer still parses — losing the
       guarantee beats losing the feature. */
    for (const structured of [true, false]) {
      try {
        upstream = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
          body: buildPayload(structured)
        });
      } catch {
        return json({ error: 'upstream unreachable' }, 502);
      }
      if (upstream.ok) { served = structured ? candidate : candidate + ' (no schema)'; break; }

      /* Keep Google's own message — "models/x is not found for API
         version v1beta" names the fault in one line, where a bare status
         code sends you looking in the wrong place. */
      detail = (await upstream.text().catch(() => '')).slice(0, 300);
      if (upstream.status !== 400) break;      // only a rejected request is worth re-shaping
    }
    if (upstream.ok) break;
    if (upstream.status !== 404) break;        // only a missing model is worth another candidate
  }

  if (!upstream || !upstream.ok) {
    const status = upstream ? upstream.status : 502;
    return json({
      error: 'upstream ' + status,
      tried: candidates,
      detail: detail || undefined
    }, status);
  }

  const data = await upstream.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return json({ error: 'empty completion' }, 502);

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return json({ error: 'unparseable completion' }, 502); }

  return json({
    answer: String(parsed.answer || ''),
    open: parsed.open && parsed.open !== 'none' ? parsed.open : null,
    model: served
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/chat') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return chat(request, env);
    }

    /* Anything else is the site itself. The assets binding handles
       hashing, caching and content types; falling through to it keeps
       this Worker out of the hot path for every normal page load. */
    return env.ASSETS.fetch(request);
  }
};
