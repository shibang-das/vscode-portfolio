/* ────────────────────────────────────────────────────────────────
   ratelimit.js — the chat credit meter.

   The assistant spends a credit per question, and credits come back
   the way a real API hands out quota: a token bucket. Tokens accrue
   continuously and pool up to capacity, so a visitor who has been
   reading for a minute can still fire off four questions in a row —
   which is exactly what someone skimming a portfolio does — and only
   then gets throttled.

   The alternatives all read worse here. A leaky bucket refuses to bank
   idle time, so patience earns nothing. A fixed window hands back
   everything at a boundary, so the visitor who runs out one second
   early waits the full window staring at a wall. A sliding log is
   exact but recovers slowest, returning each credit a full window
   after the request that spent it.

   This is pacing, not protection: it is localStorage, and anyone can
   clear it. The limit that actually guards the Gemini quota lives
   server-side in src/index.js, where a visitor cannot reach it.

   `now` is injected rather than read inside the bucket, so refill
   behaviour is testable without waiting on real time.
   ──────────────────────────────────────────────────────────────── */

const RateLimit = (() => {
  const CAPACITY = 10;            // credits a visitor holds at most
  const REFILL_MS = 45_000;       // one credit back every 45s
  const KEY = 'devbox.ratelimit';

  function create(now = () => Date.now()) {
    let tokens = CAPACITY;
    let last = 0;

    /* Accrue whatever the wall clock owes us since the last touch.
       Everything else reads state only after calling this. */
    function sync() {
      const t = now();
      if (!last) { last = t; return; }
      tokens = Math.min(CAPACITY, tokens + (t - last) / REFILL_MS);
      last = t;
    }

    const api = {
      capacity: CAPACITY,
      refillMs: REFILL_MS,
      label: 'token bucket',

      available() { sync(); return Math.floor(tokens); },

      tryConsume() {
        sync();
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
      },

      grant(n) { sync(); tokens = Math.min(CAPACITY, tokens + n); api.save(); },

      /* ms until available() grows by one, or null when already full */
      msUntilNext() {
        sync();
        if (tokens >= CAPACITY) return null;
        const frac = tokens - Math.floor(tokens);
        return Math.ceil((1 - frac) * REFILL_MS);
      },

      save() {
        try { localStorage.setItem(KEY, JSON.stringify({ tokens, last })); }
        catch { /* private mode — the session works, it just won't persist */ }
      },

      load() {
        let s;
        try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
        if (s) {
          tokens = Math.min(CAPACITY, Math.max(0, +s.tokens || 0));
          last = +s.last || 0;
        }
        sync();
        return api;
      }
    };
    return api;
  }

  return { create, CAPACITY, REFILL_MS };
})();

if (typeof module !== 'undefined') module.exports = RateLimit;
