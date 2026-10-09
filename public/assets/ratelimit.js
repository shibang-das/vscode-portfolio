/* ────────────────────────────────────────────────────────────────
   ratelimit.js — the chat credit system, as four real rate limiters.

   The assistant spends a credit per question. Rather than a counter
   that only ever goes down, credits come back the way a real API hands
   out quota — and you can switch which algorithm is doing it, because
   the four behave visibly differently once you start burning credits.

     token bucket    steady drip, bursts allowed up to capacity
     leaky bucket    steady drain, bursts smoothed into a queue
     fixed window    all credits back at once on the hour boundary
     sliding log     each credit returns exactly one window after use

   All four share one interface so assistant.js never branches on which
   is active:

     available()      whole credits spendable right now
     tryConsume()     spend one, false if empty
     grant(n)         hand back n credits (Knight Run reward)
     msUntilNext()    ms until available() grows, null if already full
     describe()       {label, blurb} for the UI
     save() / load()  localStorage round-trip

   `now` is injected so the behaviour is testable without waiting a
   real minute for a refill.
   ──────────────────────────────────────────────────────────────── */

const RateLimit = (() => {
  const CAPACITY = 10;            // credits a visitor holds at most
  const REFILL_MS = 45_000;       // one credit back every 45s
  const WINDOW_MS = CAPACITY * REFILL_MS;   // 7m30s — a full refill cycle
  const KEY = 'devbox.ratelimit';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /* ── 1. token bucket ──────────────────────────────────────────
     Tokens accrue continuously and pool up to capacity. Spend them
     as fast as you like; the bucket is what lets a quiet visitor
     burst through ten questions at once. */
  function tokenBucket() {
    let tokens = CAPACITY, last = 0;
    return {
      id: 'token-bucket',
      label: 'token bucket',
      blurb: 'Tokens drip in at a fixed rate and pool up to capacity, so an idle visitor can burst.',
      sync(now) {
        if (!last) { last = now; return; }
        tokens = Math.min(CAPACITY, tokens + (now - last) / REFILL_MS);
        last = now;
      },
      available() { return Math.floor(tokens); },
      tryConsume() {
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
      },
      grant(n) { tokens = Math.min(CAPACITY, tokens + n); },
      msUntilNext(now) {
        if (tokens >= CAPACITY) return null;
        const frac = tokens - Math.floor(tokens);
        return Math.ceil((1 - frac) * REFILL_MS);
      },
      state() { return { tokens, last }; },
      restore(s) { tokens = clamp(+s.tokens || 0, 0, CAPACITY); last = +s.last || 0; }
    };
  }

  /* ── 2. leaky bucket ──────────────────────────────────────────
     The mirror image: requests fill a bucket that drains at a fixed
     rate. Same throughput as the token bucket over time, but the
     burst is smoothed — you cannot bank idle time. */
  function leakyBucket() {
    let level = 0, last = 0;
    return {
      id: 'leaky-bucket',
      label: 'leaky bucket',
      blurb: 'Requests fill a bucket that drains at a fixed rate — bursts are smoothed, never banked.',
      sync(now) {
        if (!last) { last = now; return; }
        level = Math.max(0, level - (now - last) / REFILL_MS);
        last = now;
      },
      available() { return Math.floor(CAPACITY - level); },
      tryConsume() {
        if (level + 1 > CAPACITY) return false;
        level += 1;
        return true;
      },
      grant(n) { level = Math.max(0, level - n); },
      msUntilNext(now) {
        if (level <= 0) return null;
        const frac = level - Math.floor(level);
        return Math.ceil((frac || 1) * REFILL_MS);
      },
      state() { return { level, last }; },
      restore(s) { level = clamp(+s.level || 0, 0, CAPACITY); last = +s.last || 0; }
    };
  }

  /* ── 3. fixed window counter ──────────────────────────────────
     Cheapest to run and the easiest to game: everything resets on
     the window boundary, so a visitor can spend ten at 7:29 and ten
     more at 7:31. Kept honest here by showing the reset clock. */
  function fixedWindow() {
    let count = 0, windowStart = 0;
    const startOf = now => Math.floor(now / WINDOW_MS) * WINDOW_MS;
    return {
      id: 'fixed-window',
      label: 'fixed window',
      blurb: 'A counter per clock window. Cheap, but twice the limit can land either side of a boundary.',
      sync(now) {
        const w = startOf(now);
        if (w !== windowStart) { windowStart = w; count = 0; }
      },
      available() { return Math.max(0, CAPACITY - count); },
      tryConsume() {
        if (count >= CAPACITY) return false;
        count += 1;
        return true;
      },
      grant(n) { count = Math.max(0, count - n); },
      msUntilNext(now) {
        if (count <= 0) return null;
        return Math.max(0, windowStart + WINDOW_MS - now);
      },
      state() { return { count, windowStart }; },
      restore(s) { count = clamp(+s.count || 0, 0, CAPACITY); windowStart = +s.windowStart || 0; }
    };
  }

  /* ── 4. sliding window log ────────────────────────────────────
     Keeps a timestamp per request and counts what falls inside the
     trailing window. Exact — no boundary to exploit — at the cost of
     storing every hit. Credits return one at a time, each exactly a
     window after the request that spent it. */
  function slidingLog() {
    let log = [];
    return {
      id: 'sliding-log',
      label: 'sliding log',
      blurb: 'One timestamp per request, counted over a trailing window. Exact, at the cost of storing every hit.',
      sync(now) { log = log.filter(t => now - t < WINDOW_MS); },
      available() { return Math.max(0, CAPACITY - log.length); },
      tryConsume(now) {
        if (log.length >= CAPACITY) return false;
        log.push(now);
        return true;
      },
      grant(n) { log.splice(0, n); },
      msUntilNext(now) {
        if (!log.length) return null;
        return Math.max(0, log[0] + WINDOW_MS - now);
      },
      state() { return { log }; },
      restore(s) { log = Array.isArray(s.log) ? s.log.map(Number).filter(Number.isFinite).slice(-CAPACITY) : []; }
    };
  }

  const ALGOS = [tokenBucket, leakyBucket, fixedWindow, slidingLog];

  /* ── public wrapper ───────────────────────────────────────────
     Holds the active algorithm, keeps the clock in one place, and
     persists per-algorithm state so switching back and forth does
     not hand out free credits. */
  function create(now = () => Date.now()) {
    const made = ALGOS.map(f => f());
    const byId = Object.fromEntries(made.map(a => [a.id, a]));
    let active = made[0];

    const sync = () => active.sync(now());

    const api = {
      ids: made.map(a => a.id),
      list: () => made.map(a => ({ id: a.id, label: a.label, blurb: a.blurb })),

      get id() { return active.id; },
      describe() { return { id: active.id, label: active.label, blurb: active.blurb }; },

      available() { sync(); return active.available(); },
      tryConsume() { sync(); return active.tryConsume(now()); },
      grant(n) { sync(); active.grant(n); api.save(); },
      msUntilNext() { sync(); return active.msUntilNext(now()); },
      capacity: CAPACITY,

      use(id) {
        if (!byId[id] || id === active.id) return false;
        active = byId[id];
        sync(); api.save();
        return true;
      },

      save() {
        try {
          localStorage.setItem(KEY, JSON.stringify({
            active: active.id,
            states: Object.fromEntries(made.map(a => [a.id, a.state()]))
          }));
        } catch { /* private mode — the session still works, it just won't persist */ }
      },

      load() {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
        if (!saved) return api;
        for (const a of made) if (saved.states && saved.states[a.id]) a.restore(saved.states[a.id]);
        if (byId[saved.active]) active = byId[saved.active];
        sync();
        return api;
      }
    };
    return api;
  }

  return { create, CAPACITY, REFILL_MS, WINDOW_MS };
})();

if (typeof module !== 'undefined') module.exports = RateLimit;
