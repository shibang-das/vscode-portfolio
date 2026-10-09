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
     MODEL       text,   optional — defaults to gemini-2.0-flash

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

  const model = env.MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: String(body.system || '').slice(0, 20000) }] },
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              open: {
                type: 'string',
                enum: ['home', 'about', 'experience', 'projects', 'skills',
                       'achievements', 'contact', 'readme', 'resume', 'none']
              }
            },
            required: ['answer', 'open']
          }
        }
      })
    });
  } catch {
    return json({ error: 'upstream unreachable' }, 502);
  }

  if (!upstream.ok) return json({ error: 'upstream ' + upstream.status }, upstream.status);

  const data = await upstream.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return json({ error: 'empty completion' }, 502);

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return json({ error: 'unparseable completion' }, 502); }

  return json({
    answer: String(parsed.answer || ''),
    open: parsed.open && parsed.open !== 'none' ? parsed.open : null
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
