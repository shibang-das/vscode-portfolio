/* ────────────────────────────────────────────────────────────────
   assistant.js — résumé assistant.
   Answers come from Gemini when llm.js has an endpoint configured, and
   from the local intent index otherwise — or whenever the call fails,
   so the panel never breaks. Either way the answer opens the matching
   file in the editor on the left.
   A query budget mirrors a real rate limit; running out unlocks the
   Knight Run mini-game, which can win the budget back.
   ──────────────────────────────────────────────────────────────── */

const Assistant = (() => {
  const QUOTA_KEY = 'devbox.quota';
  const START_QUOTA = 10;
  let quota = START_QUOTA;
  let els = {}, busy = false, gameMounted = false, gameManual = false;
  let history = [];   // last few turns, for LLM follow-up questions

  /* ── intent index ─────────────────────────────────────────── */
  const INTENTS = [
    {
      k: ['hi', 'hello', 'hey', 'who', 'about you', 'about him', 'about shibang', 'yourself',
          'introduce', 'bio', 'summary', 'background'],
      w: 0.9,
      a: () => `<p>I'm <b>Shibang Das</b> — a backend engineer currently interning at <b>Joveo</b>, building Java/Spring Boot microservices on AWS with Kafka and PostgreSQL.</p>
        <p>BTech + MTech from <b>IIT (BHU) Varanasi</b> (CPI 8.41). Outside work: Codeforces Expert, LeetCode Knight, and a national-level chess player.</p>`,
      open: 'about'
    },
    {
      k: ['hire', 'hiring', 'recruit', 'open to work', 'looking for', 'opportunit', 'opening',
          'vacancy', 'notice period', 'relocat', 'full time', 'full-time', 'join us', 'offer',
          'can i hire', 'are you available', 'availab'],
      w: 1.4,
      a: () => `<p>Yes — open to backend and full-stack roles. Currently a Backend Intern at <b>Joveo</b> (Java, Spring Boot, Kafka, AWS), graduating from <b>IIT (BHU) Varanasi</b>.</p>
        <p>Best route is email: <span class="kv">${PROFILE.email}</span> — or <a href="${PROFILE.linkedin}" target="_blank" rel="noreferrer">LinkedIn</a>, or <span class="kv">${PROFILE.phone}</span>. The résumé is at the bottom of the sidebar.</p>`,
      open: 'contact'
    },
    {
      k: ['experience', 'work', 'job', 'role', 'career', 'company', 'intern', 'employment', 'joveo', 'tredence', 'datacurve', 'neuronexus'],
      a: q => {
        const hit = EXPERIENCE.find(e => q.includes(e.company.toLowerCase().split(' ')[0]));
        if (hit) return `<p><b>${hit.company}</b> — ${hit.role} <span class="kv">(${hit.period})</span></p><ul>${hit.points.map(p => `<li>${p}</li>`).join('')}</ul>`;
        return `<p>Four roles so far, most recent first:</p><ul>${EXPERIENCE.map(e => `<li><b>${e.company}</b> — ${e.role} <span class="kv">${e.period}</span></li>`).join('')}</ul><p>Ask me about any one of them by name.</p>`;
      },
      open: 'experience'
    },
    {
      k: ['project', 'built', 'build', 'bookloom', 'chessgo', 'side project', 'portfolio'],
      a: () => `<p>Two shipped side projects:</p><ul>${PROJECTS.map(p => `<li><b>${p.name}</b> — ${p.kind}. <span class="kv">${p.stack.slice(0, 4).join(', ')}</span></li>`).join('')}</ul>
        <p>At work the bigger ones were Joveo's Unified Analytics latency rework and Tredence's semantic-extraction pipeline.</p>`,
      open: 'projects'
    },
    {
      k: ['skill', 'stack', 'tech', 'language', 'framework', 'tool', 'know', 'java', 'python', 'c++', 'spring', 'kafka', 'sql', 'database'],
      a: () => `<p>Core stack:</p><ul>${SKILLS.slice(0, 4).map(g => `<li><b>${g.group}</b> — <span class="kv">${g.items.join(', ')}</span></li>`).join('')}</ul>
        <p>Strongest in backend services and algorithms; comfortable but not specialised in frontend.</p>`,
      open: 'skills'
    },
    {
      k: ['achievement', 'rating', 'codeforces', 'leetcode', 'competitive', 'rank', 'contest', 'hackercup', 'kickstart', 'award'],
      a: () => `<ul>
        <li><b>Codeforces Expert</b> — max 1708, handle <span class="kv">clowntk</span></li>
        <li><b>LeetCode Knight</b> — max 1977, handle <span class="kv">ShibangDS</span></li>
        <li><b>Meta HackerCup 2024</b> — global rank 1269, Round 2</li>
        <li><b>Google Kickstart</b> — global rank 1437, Farewell Round A</li>
        <li><b>Flipkart GRiD 6.0</b> — Level 2 out of 4.8 lakh entrants</li>
        <li><b>1500+</b> DSA problems solved</li></ul>`,
      open: 'achievements'
    },
    {
      k: ['education', 'college', 'university', 'degree', 'iit', 'bhu', 'cpi', 'gpa', 'study', 'graduate'],
      a: () => `<p><b>${EDUCATION.school}</b><br>${EDUCATION.degree}<br><span class="kv">${EDUCATION.period} · ${EDUCATION.detail}</span></p>
        <p>Mechanical on paper, backend in practice — the CS came from competitive programming and shipping.</p>`,
      open: 'about'
    },
    {
      k: ['contact', 'reach', 'email', 'talk', 'connect', 'phone', 'linkedin', 'get in touch', 'mail'],
      a: () => `<p>Easiest route is email: <span class="kv">${PROFILE.email}</span></p>
        <p>Also on <a href="${PROFILE.linkedin}" target="_blank" rel="noreferrer">LinkedIn</a> and reachable at <span class="kv">${PROFILE.phone}</span>. The contact form on <b>contact.sh</b> works too.</p>`,
      open: 'contact'
    },
    {
      k: ['chess', 'hobb', 'fun', 'outside work', 'interest', 'knight', 'mini-game', 'free time'],
      a: () => `<p>Chess, seriously — national level and Inter-IIT, U14 in 2015-16 and U17 in 2016-17, 2000+ across formats.</p>
        <p>There's a Knight Run mini-game hidden in this panel; it appears when the query budget runs out.</p>`
    },
    {
      k: ['resume', 'cv', 'download', 'pdf'],
      a: () => `<p>Here it is — <a href="${PROFILE.resume}" target="_blank" rel="noopener">open the PDF</a> or <a href="${PROFILE.resume}" download>download it</a>. The same two buttons live at the bottom of the sidebar.</p>`,
      open: 'resume'
    },
    {
      k: ['latency', 'performance', 'optimis', 'optimiz', 'analytics', 'unified'],
      a: () => `<p>At Joveo I worked on <b>Unified Analytics</b>, the main revenue product. Several widgets were slow under real traffic; the fix was query-level — reshaping the SQL, trimming what the endpoint carried, and streamlining processing rather than adding cache layers on top of a bad plan.</p>`,
      open: 'experience'
    },
    {
      k: ['theme', 'dark', 'light', 'colour', 'color', 'site', 'website', 'made', 'how did you'],
      a: () => `<p>This workbench is plain JavaScript — no framework, no build step. Six themes live in the palette panel (⌘ rail, right side), and everything is keyboard-driven.</p>
        <p class="kv">Try Ctrl+K, or Ctrl+` + '`' + ` for the terminal.</p>`,
      open: 'readme'
    }
  ];

  const FALLBACK = `<p>I only know what's in the résumé index — try asking about <b>experience</b>, <b>projects</b>, <b>skills</b>, <b>achievements</b>, <b>education</b>, <b>resume</b> or <b>contact</b>.</p>`;

  const SUGGESTIONS = [
    'Who is Shibang?',
    'Tell me about the work at Joveo',
    'What has he built?',
    'What are the competitive ratings?',
    'How do I get in touch?'
  ];

  /* ── matching ─────────────────────────────────────────────── */
  /* Substring scoring on its own is too blunt: "can I hire you for
     software engineer roles?" scores 'hire' (contact) and 'role'
     (experience) equally, and the tie goes to whichever intent is
     declared first. So: match on word boundaries, weight multi-word
     phrases above single words, and let an intent carry a weight for
     the cases where two readings are genuinely close. */
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function scoreIntent(q, intent) {
    let s = 0, hits = 0;
    for (const k of intent.k) {
      const phrase = k.includes(' ');
      /* Single words take a short suffix so 'role' catches 'roles' and
         'optimis' catches 'optimised'. Phrases are matched whole, so
         'about you' does not fire on "about your experience". Keywords
         ending in punctuation ('c++') skip the boundary entirely. */
      const head = /^\w/.test(k) ? '\\b' : '';
      const tail = !/\w$/.test(k) ? '' : phrase ? '\\b' : '[a-z]{0,3}\\b';
      const re = new RegExp(head + escapeRe(k) + tail, 'i');
      if (!re.test(q)) continue;
      hits++;
      s += phrase ? k.length * 2.5 : k.length;
    }
    if (!hits) return 0;
    if (hits > 1) s *= 1.15;                    // several signals beat one
    return s * (intent.w || 1);
  }

  function match(raw) {
    const q = raw.toLowerCase();
    let best = null, bestScore = 0;
    for (const it of INTENTS) {
      const s = scoreIntent(q, it);
      if (s > bestScore) { bestScore = s; best = it; }
    }
    return bestScore > 0 ? best : null;
  }

  /* ── rendering ────────────────────────────────────────────── */
  function bubble(role, html) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    wrap.innerHTML = `<span class="av">${role === 'user' ? 'you' : '◆'}</span><div class="bubble">${html}</div>`;
    els.body.appendChild(wrap);
    els.body.scrollTop = els.body.scrollHeight;
    return wrap;
  }

  function welcome() {
    els.body.innerHTML = `
      <div class="as-welcome">
        <h4>Ask about my work</h4>
        <p>${LLM.enabled()
            ? 'Ask anything about the résumé — experience, projects, skills, ratings, contact.'
            : 'An offline index of the résumé — experience, projects, skills, ratings, contact.'}</p>
        <div class="as-sugs">${SUGGESTIONS.map(s => `<button class="as-sug">${s}</button>`).join('')}
          <button class="as-sug as-sug-game" id="asSugGame">▶ Play Knight Run <span class="dim-inline">(no budget needed)</span></button>
        </div>
      </div>`;
    els.body.querySelectorAll('.as-sug:not(.as-sug-game)').forEach(b =>
      b.addEventListener('click', () => send(b.textContent)));
    const gameSug = els.body.querySelector('#asSugGame');
    if (gameSug) gameSug.addEventListener('click', toggleGamePanel);
  }

  function updateQuota() {
    const forced = quota <= 0;
    els.quota.textContent = quota > 0
      ? `${quota} ${quota === 1 ? 'query' : 'queries'} left`
      : 'out of queries — beat Knight Run';
    localStorage.setItem(QUOTA_KEY, quota);
    els.send.disabled = forced;
    els.input.disabled = forced;
    els.input.placeholder = quota > 0
      ? 'Ask about my work, stack, or ratings…'
      : 'Budget spent — score 10 in Knight Run for 5 more.';
    els.playBtn.classList.toggle('active', forced || gameManual);
    refreshGame();
  }

  function refreshGame() {
    const forced = quota <= 0;
    const show = forced || gameManual;
    els.game.classList.toggle('hidden', !show);
    els.gBack.classList.toggle('hidden', !gameManual || forced);
    if (show && !gameMounted) {
      gameMounted = true;
      KnightRun.mount(els.canvas,
        { score: els.gScore, best: els.gBest, hint: els.gHint },
        n => { quota += n; updateQuota(); bubble('assistant', `<p class="dim-inline"><span class="ok">+${n} queries</span> unlocked by playing Knight Run.</p>`); });
    }
  }

  function toggleGamePanel() {
    gameManual = !gameManual;
    updateQuota();
  }

  function backToChat() {
    if (quota <= 0) { bubble('assistant', '<p class="err">Score 10 to unlock more queries first.</p>'); return; }
    gameManual = false;
    updateQuota();
  }

  /* ── send loop ────────────────────────────────────────────── */

  /* Open the file the answer is about, so the editor on the left tracks
     the conversation. 'resume' is a PDF, not an editor view — the bubble
     carries its own links, so there is nothing to open. */
  function reveal(id) {
    if (!id || id === 'resume') return;
    if (!FILES.some(f => f.id === id)) return;
    App.openFile(id);
  }

  function localAnswer(q) {
    const intent = match(q);
    return {
      html: intent ? (typeof intent.a === 'function' ? intent.a(q.toLowerCase()) : intent.a) : FALLBACK,
      open: intent ? intent.open : null
    };
  }

  async function send(text) {
    const q = (text || els.input.value).trim();
    if (!q || busy) return;
    if (quota <= 0) { bubble('assistant', '<p class="err">Query budget spent — beat Knight Run for more.</p>'); return; }

    // if (els.body.querySelector('.as-welcome')) els.body.innerHTML = '';
    els.input.value = '';
    els.input.style.height = 'auto';
    bubble('user', escapeHtml(q));
    quota--; updateQuota();

    busy = true; els.send.disabled = true;
    const t = bubble('assistant', `<span class="typing"><i></i><i></i><i></i></span>`);
    const started = performance.now();

    /* Gemini when it is configured and reachable; the local index whenever
       it is not — quota exhausted, offline, timeout. The visitor never sees
       the difference beyond answer quality. */
    let reply = null;
    if (LLM.enabled()) {
      const res = await LLM.ask(q, history);
      if (res) reply = { html: LLM.render(res.answer), open: res.open, text: res.answer };
    }
    if (!reply) reply = localAnswer(q);

    history.push({ role: 'user', text: q });
    history.push({ role: 'assistant', text: reply.text || stripTags(reply.html) });
    if (history.length > 12) history.splice(0, history.length - 12);

    const wait = Math.max(0, 420 + Math.random() * 380 - (performance.now() - started));
    setTimeout(() => {
      t.querySelector('.bubble').innerHTML = reply.html;
      reveal(reply.open);
      els.body.scrollTop = els.body.scrollHeight;
      busy = false; els.send.disabled = quota <= 0;
    }, wait);
  }

  const stripTags = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  return {
    init() {
      els = {
        body: document.getElementById('asBody'),
        input: document.getElementById('asInput'),
        send: document.getElementById('asSend'),
        quota: document.getElementById('asQuota'),
        reset: document.getElementById('asReset'),
        game: document.getElementById('asGame'),
        canvas: document.getElementById('gCanvas'),
        gScore: document.getElementById('gScore'),
        gBest: document.getElementById('gBest'),
        gHint: document.getElementById('gHint'),
        gBack: document.getElementById('gBack'),
        playBtn: document.getElementById('asPlayGame')
      };
      const stored = localStorage.getItem(QUOTA_KEY);
      quota = stored === null ? START_QUOTA : Math.max(0, +stored);

      welcome(); updateQuota();

      els.send.addEventListener('click', () => send());
      els.reset.addEventListener('click', () => { history = []; welcome(); bubble('assistant', '<p class="dim-inline">Started a new chat.</p>'); });
      els.playBtn.addEventListener('click', toggleGamePanel);
      els.gBack.addEventListener('click', backToChat);
      els.input.addEventListener('input', () => {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(110, els.input.scrollHeight) + 'px';
      });
      els.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        e.stopPropagation();
      });
    },
    ask(q) { send(q); },
    focus() { if (quota > 0) els.input.focus(); },
    gameVisible() { return !els.game.classList.contains('hidden'); },
    playGame() { if (!gameManual && quota > 0) toggleGamePanel(); },
    stopGame() { if (gameManual) toggleGamePanel(); }
  };
})();
