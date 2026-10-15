/* ────────────────────────────────────────────────────────────────
   src/index.js — the Worker behind the portfolio.

   Static files are served by Cloudflare from the assets binding; this
   code only runs for paths the assets do not cover, which in practice
   means POST /api/chat.

   That endpoint holds the Groq API key as an environment secret and
   forwards to Groq's free tier, so the browser never sees a key. Same
   origin as the site, so there is no CORS to configure.

   Groq rather than Gemini for one reason: Gemini's free tier geofences
   by caller location, and a Worker egresses from whichever Cloudflare
   edge is nearest the visitor — so it answered
   FAILED_PRECONDITION: User location is not supported. Groq has no
   such restriction, is free without a card, and is faster.

   Environment (Worker → Settings → Variables and Secrets):
     GROQ_KEY  secret, required — console.groq.com key, free tier
     VIEWS     KV namespace, optional — backs the view counter; without
               it /api/views reports 503 and the UI hides the number
     MODEL     text,   optional — tried first, then known-good
               fallbacks, then whatever /v1/models reports as live

   No paid features anywhere: no streaming, no KV, no durable objects.
   When the free quota runs out Groq returns 429, this returns 429,
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

/* Model ids are retired without warning — both of the ones this started
   with were gone inside a release. Rather than hardcode a list that
   rots, ask the provider what the key can actually call, and remember
   it for the life of the isolate. */
let discovered = null;

const UNSUITABLE = /whisper|tts|embed|guard|moderation|vision|audio/i;

async function discoverModel(env) {
  if (discovered) return discovered;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${env.GROQ_KEY}` }
    });
    if (!res.ok) return null;
    const list = (await res.json())?.data;
    if (!Array.isArray(list)) return null;

    /* Anything that is not a chat model would fail the same way a dead
       id does, so filter those out rather than discovering a
       speech-to-text model and calling it hopefully. */
    const chat = list
      .map(m => m && m.id)
      .filter(id => typeof id === 'string' && !UNSUITABLE.test(id));
    if (!chat.length) return null;

    /* Prefer an instruction-tuned general model; fall back to whatever
       is left rather than giving up. */
    discovered = chat.find(id => /llama|qwen|gemma|mixtral|gpt/i.test(id)) || chat[0];
    return discovered;
  } catch {
    return null;
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

/* ── view counter ─────────────────────────────────────────────
   Backed by Workers KV. The count is deliberately approximate:
   read-modify-write races mean simultaneous visitors can collapse
   into one increment, and KV reads are eventually consistent. A
   Durable Object would be exact, but for a number on a status bar
   that is the wrong trade — this costs nothing and never blocks the
   page.

   Absent binding is a normal state, not an error: without VIEWS the
   endpoint reports unavailable and the UI simply shows nothing. */
const VIEWS_KEY = 'site:views';

async function views(request, env) {
  if (!env.VIEWS) return json({ error: 'not configured' }, 503);

  const current = Number(await env.VIEWS.get(VIEWS_KEY)) || 0;
  if (request.method === 'GET') return json({ views: current });

  /* One increment per visitor session — the client holds that flag,
     since the alternative is storing IPs, which is a privacy cost for
     a vanity number. Still rate-limited so the endpoint cannot be
     used to inflate the count in a loop. */
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip, Date.now())) return json({ views: current }, 200);

  const next = current + 1;
  await env.VIEWS.put(VIEWS_KEY, String(next));
  return json({ views: next });
}

async function chat(request, env) {
  if (!env.GROQ_KEY) return json({ error: 'not configured' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip, Date.now())) return json({ error: 'rate limited' }, 429);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const question = String(body.question || '').slice(0, MAX_QUESTION).trim();
  if (!question) return json({ error: 'empty question' }, 400);

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const messages = [
    { role: 'system', content: String(body.system || '').slice(0, 20000) },
    ...history
      .filter(m => m && typeof m.text === 'string')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text.slice(0, 1000) })),
    { role: 'user', content: question }
  ];

  /* Model ids get retired, and a retired id answers 404. Try the
     configured model first, then known-good fallbacks, and report what
     actually served. */
  const candidates = [env.MODEL, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
    .filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);

  /* JSON mode is the most fragile part of the request — a model that
     does not support it rejects the whole call — so it is a flag that
     can be dropped on a retry. The system prompt asks for the shape in
     words too, so an unconstrained answer still parses. */
  const buildPayload = (model, strict) => JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 400,
    ...(strict ? { response_format: { type: 'json_object' } } : {})
  });

  let upstream, served, detail = '';
  for (const candidate of candidates) {
    for (const strict of [true, false]) {
      try {
        upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.GROQ_KEY}`
          },
          body: buildPayload(candidate, strict)
        });
      } catch {
        return json({ error: 'upstream unreachable' }, 502);
      }
      if (upstream.ok) { served = strict ? candidate : candidate + ' (no json mode)'; break; }

      /* Keep the upstream's own message. "model X does not exist" or
         "json_object not supported" names the fault in one line, where
         a bare status code sends you looking in the wrong place. */
      detail = (await upstream.text().catch(() => '')).slice(0, 300);
      if (upstream.status !== 400) break;      // only a rejected request is worth re-shaping
    }
    if (upstream.ok) break;
    if (upstream.status !== 404) break;        // only a missing model is worth another candidate
  }

  /* Every candidate was a dead id. Ask the provider for a live one and
     try that before giving up — this is the case that otherwise needs a
     redeploy every time a model is retired. */
  if (upstream && upstream.status === 404) {
    const found = await discoverModel(env);
    if (found && !candidates.includes(found)) {
      candidates.push(found);
      try {
        upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_KEY}` },
          body: buildPayload(found, true)
        });
        if (upstream.ok) served = found + ' (discovered)';
        else detail = (await upstream.text().catch(() => '')).slice(0, 300);
      } catch {
        return json({ error: 'upstream unreachable' }, 502);
      }
    }
  }

  if (!upstream || !upstream.ok) {
    const status = upstream ? upstream.status : 502;
    return json({ error: 'upstream ' + status, tried: candidates, detail: detail || undefined }, status);
  }

  const data = await upstream.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return json({ error: 'empty completion' }, 502);

  /* Without json mode the model may wrap the object in prose or a code
     fence, so take the outermost braces rather than trusting the whole
     string to parse. */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const slice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    try { parsed = JSON.parse(slice); } catch { return json({ error: 'unparseable completion' }, 502); }
  }

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

    if (pathname === '/api/views') {
      if (request.method !== 'GET' && request.method !== 'POST')
        return json({ error: 'GET or POST only' }, 405);
      return views(request, env);
    }

    /* Anything else is the site itself. The assets binding handles
       hashing, caching and content types; falling through to it keeps
       this Worker out of the hot path for every normal page load. */
    return env.ASSETS.fetch(request);
  }
};
