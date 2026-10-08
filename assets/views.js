/* ────────────────────────────────────────────────────────────────
   views.js — one renderer per "file". Each returns an HTML string.
   ──────────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = t => `<span class="chip">${esc(t)}</span>`;

/* a small "comment banner" that opens every view — mimics a source header
   without copying anyone's layout */
function banner(comment, sub) {
  return `<div class="v-banner rv"><span class="cmt">// ${esc(comment)}</span>${sub ? `<span class="cmt dim">// ${esc(sub)}</span>` : ''}</div>`;
}

const VIEWS = {

  /* ── home.tsx ─────────────────────────────────────────────── */
  home() {
    return `
    ${banner('entry point', 'press Ctrl K for the command palette')}
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker rv d1">const engineer = {</p>
        <h1 class="hero-name rv d2">${esc(PROFILE.name)}</h1>
        <p class="hero-role rv d3">
          <span class="kw">role</span><span class="pun">:</span>
          <span class="str">"${esc(PROFILE.role)}"</span><span class="pun">,</span>
          <span class="kw">at</span><span class="pun">:</span>
          <span class="str">"${esc(PROFILE.company)}"</span>
        </p>
        <p class="hero-blurb rv d4">${esc(PROFILE.blurb[0])}</p>
        <div class="hero-tags rv d5">
          ${['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'AWS', 'C++'].map(chip).join('')}
        </div>
        <div class="hero-actions rv d6">
          <button class="btn primary" data-open="projects">See the work</button>
          <button class="btn" data-open="contact">Get in touch</button>
          <button class="btn ghost" data-action="downloadResume">Résumé ↓</button>
        </div>
        <p class="hero-hint rv d7"><kbd>Ctrl</kbd><kbd>\`</kbd> opens a real terminal — try <code>whoami</code>.</p>
      </div>
      <div class="hero-side rv d3">
        <div class="id-card">
          <div class="id-face"><span class="id-initials">SD</span><span class="id-pulse"></span></div>
          <div class="id-rows">
            ${PROFILE.facts.map(f => `<div class="id-row"><span>${esc(f.k)}</span><b>${esc(f.v)}</b></div>`).join('')}
          </div>
          <div class="id-strip"><span></span><span></span><span></span></div>
        </div>
      </div>
    </section>

    <div class="stat-strip rv d7">
      ${[['1708', 'Codeforces peak'], ['1977', 'LeetCode peak'], ['1500+', 'problems solved'], ['4', 'engineering roles']]
        .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}
    </div>`;
  },

  /* ── about.md ─────────────────────────────────────────────── */
  about() {
    return `
    ${banner('about.md', 'rendered markdown')}
    <article class="md rv">
      <h1># Who I am</h1>
      ${PROFILE.blurb.map(p => `<p>${esc(p)}</p>`).join('')}

      <h2>## Education</h2>
      <div class="edu-card">
        <div class="edu-l"><b>${esc(EDUCATION.school)}</b><span>${esc(EDUCATION.degree)}</span><small>${esc(EDUCATION.detail)}</small></div>
        <span class="period">${esc(EDUCATION.period)}</span>
      </div>

      <h2>## How I work</h2>
      <ul class="md-list">
        <li><b>Measure, then move.</b> The latency wins at Joveo came out of reading query plans, not rewriting frameworks.</li>
        <li><b>Correctness first.</b> Years of competitive programming make the edge cases the first thing I reach for, not the last.</li>
        <li><b>Follow the data.</b> ATS→CRM sync taught me that most backend bugs are really data-mapping bugs wearing a disguise.</li>
      </ul>

      <h2>## Outside the editor</h2>
      <p>National-level and Inter-IIT chess — U14 in 2015-16, U17 in 2016-17, 2000+ rating across formats. It is the same game as debugging: find the forcing line, then verify it before you commit.</p>

      <blockquote>Currently open to backend and distributed-systems roles. <a href="#" data-open="contact">Say hello →</a></blockquote>
    </article>`;
  },

  /* ── experience.ts ────────────────────────────────────────── */
  experience() {
    return `
    ${banner('experience.ts', `${EXPERIENCE.length} roles, most recent first`)}
    <div class="timeline">
      ${EXPERIENCE.map((e, i) => `
        <article class="tl-item rv d${Math.min(i + 1, 7)}">
          <span class="tl-node ${e.current ? 'live' : ''}"></span>
          <header class="tl-head">
            <div>
              <h3>${esc(e.company)}${e.current ? '<i class="live-dot" title="current">●</i>' : ''}</h3>
              <p class="tl-role">${esc(e.role)}</p>
            </div>
            <span class="period">${esc(e.period)}</span>
          </header>
          <p class="tl-tag">${esc(e.tag)}</p>
          <ul class="tl-points">${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        </article>`).join('')}
    </div>`;
  },

  /* ── projects.json ────────────────────────────────────────── */
  projects() {
    return `
    ${banner('projects.json', 'things built end to end')}
    <div class="proj-grid">
      ${PROJECTS.map((p, i) => `
        <article class="proj rv d${i + 2}" style="--acc:${p.accent}">
          <div class="proj-top">
            <h3>${esc(p.name)}</h3>
            <span class="proj-kind">${esc(p.kind)}</span>
          </div>
          <ul class="proj-points">${p.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="proj-stack">${p.stack.map(chip).join('')}</div>
          <div class="proj-foot">
            ${p.links.length
              ? p.links.map(l => `<a class="ghost-btn sm" href="${esc(l.href)}" target="_blank" rel="noreferrer">${esc(l.label)} ↗</a>`).join('')
              : '<span class="muted-note">source available on request</span>'}
          </div>
        </article>`).join('')}
    </div>

    <h3 class="sub-h rv">Also shipped at work</h3>
    <div class="mini-grid rv">
      ${[
        ['Unified Analytics latency', 'Query + payload rework across several high-traffic widgets on Joveo’s revenue product.'],
        ['ATS ⇄ CRM sync', 'Job and apply-URL pipelines feeding full-funnel candidate tracking.'],
        ['Semantic extraction pipeline', 'FastAPI + LangGraph turning raw text into RDF triples and ontologies at Tredence.'],
        ['Real-time chat widget', 'Socket.io backend connecting users to support in under a second.']
      ].map(([t, d]) => `<div class="mini"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}
    </div>`;
  },

  /* ── skills.yaml ──────────────────────────────────────────── */
  skills() {
    return `
    ${banner('skills.yaml', 'grouped, honestly weighted')}
    <div class="skills-wrap">
      <div class="skill-groups">
        ${SKILLS.map((g, i) => `
          <section class="skill-group rv d${Math.min(i + 1, 7)}">
            <h4><span class="yml-key">${esc(g.group.toLowerCase().replace(/[^a-z]+/g, '_'))}</span><span class="pun">:</span></h4>
            <div class="chips">${g.items.map(chip).join('')}</div>
          </section>`).join('')}
      </div>
      <aside class="prof-panel rv d3">
        <h4>self-assessment</h4>
        ${PROFICIENCY.map(p => `
          <div class="prof">
            <div class="prof-l"><span>${esc(p.label)}</span><b>${p.pct}</b></div>
            <div class="bar"><i style="width:${p.pct}%;background:${p.color}"></i></div>
          </div>`).join('')}
        <p class="muted-note">Numbers are a feel, not a benchmark. The ratings on <a href="#" data-open="achievements">achievements.log</a> are the measured ones.</p>
      </aside>
    </div>`;
  },

  /* ── achievements.log ─────────────────────────────────────── */
  achievements() {
    const stamp = ['2025-11-02', '2025-08-19', '2025-06-30', '2024-10-13', '2023-04-08', '2024-09-21', '2017-01-15'];
    return `
    ${banner('achievements.log', 'tail -f')}
    <div class="log">
      ${ACHIEVEMENTS.map((a, i) => `
        <div class="log-line rv d${Math.min(i + 1, 7)}">
          <span class="log-time">${stamp[i] || '····-··-··'}</span>
          <span class="log-lvl ${a.level}">${a.level === 'ok' ? 'PASS' : a.level === 'warn' ? 'NOTE' : 'INFO'}</span>
          <span class="log-icon">${a.icon}</span>
          <span class="log-msg"><b>${esc(a.title)}</b> — ${esc(a.detail)}</span>
        </div>`).join('')}
      <div class="log-line"><span class="log-time">now</span><span class="log-lvl ok">PASS</span><span class="log-icon">→</span><span class="log-msg">7 records, 0 errors. <span class="cursor-blk"></span></span></div>
    </div>
    <div class="rating-cards rv">
      <a class="rating" href="${PROFILE.codeforces}" target="_blank" rel="noreferrer" style="--acc:#2dd4bf">
        <span class="rating-plat">Codeforces</span><b>1708</b><span class="rating-tier">Expert · clowntk</span>
      </a>
      <a class="rating" href="${PROFILE.leetcode}" target="_blank" rel="noreferrer" style="--acc:#f5a524">
        <span class="rating-plat">LeetCode</span><b>1977</b><span class="rating-tier">Knight · ShibangDS</span>
      </a>
      <div class="rating" style="--acc:#a78bfa">
        <span class="rating-plat">Chess</span><b>2000+</b><span class="rating-tier">National · Inter-IIT</span>
      </div>
    </div>`;
  },

  /* ── contact.sh ───────────────────────────────────────────── */
  contact() {
    return `
    ${banner('contact.sh', 'the form actually sends — or falls back to your mail client')}
    <div class="contact-wrap">
      <form class="cform rv" id="contactForm" novalidate>
        <div class="cf-row">
          <label for="cfName"><span class="cmt">// your name</span></label>
          <input id="cfName" name="name" placeholder="Ada Lovelace" autocomplete="name" />
        </div>
        <div class="cf-row">
          <label for="cfEmail"><span class="cmt">// your email</span></label>
          <input id="cfEmail" name="email" type="email" placeholder="ada@example.com" autocomplete="email" />
        </div>
        <div class="cf-row">
          <label for="cfMsg"><span class="cmt">// message</span></label>
          <textarea id="cfMsg" name="message" rows="6" placeholder="Hi Shibang — we're hiring backend engineers…"></textarea>
        </div>
        <div class="cf-foot">
          <button type="submit" class="btn primary" id="cfSend">Send message</button>
          <button type="button" class="btn ghost" data-action="copyEmail">Copy email</button>
        </div>
        <p class="cf-status" id="cfStatus"></p>
      </form>

      <aside class="cchannels rv d3">
        <h4>direct channels</h4>
        ${LINKS.map(l => `
          <a class="cchan" href="${esc(l.href)}" ${l.href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>
            <span class="cchan-ico">${esc(l.icon)}</span>
            <span class="cchan-body"><b>${esc(l.label)}</b><small>${esc(l.value)}</small></span>
            <span class="cchan-arrow">↗</span>
          </a>`).join('')}
        <div class="panel-sep"></div>
        <p class="muted-note">Fastest reply is email. I read LinkedIn in batches.</p>
      </aside>
    </div>`;
  },

  /* ── README.md ────────────────────────────────────────────── */
  readme() {
    return `
    ${banner('README.md', 'how this thing is built')}
    <article class="md rv">
      <h1># devbox</h1>
      <p>A workbench-shaped portfolio. No framework, no build step — three script files, one stylesheet, and a stubborn amount of keyboard handling.</p>

      <h2>## What works</h2>
      <ul class="md-list">
        <li><b>File tree + tabs</b> — every section is a "file"; open, close, reorder your attention.</li>
        <li><b>Terminal</b> — a real command loop. <code>help</code>, <code>whoami</code>, <code>cat experience.ts</code>, <code>theme moss</code>, <code>neofetch</code>.</li>
        <li><b>Command palette</b> — <kbd>Ctrl</kbd><kbd>K</kbd> for files, <code>&gt;</code> for commands.</li>
        <li><b>Assistant</b> — an offline index of my résumé with a query budget. Run out and you get a chess-runner instead.</li>
        <li><b>Six themes</b>, editor zoom, resizable panes, full keyboard control, and a mobile layout that drops the chrome.</li>
      </ul>

      <h2>## Stack</h2>
      <div class="chips">${['Vanilla JS', 'CSS custom properties', 'Canvas 2D', 'localStorage', 'Zero dependencies'].map(chip).join('')}</div>

      <h2>## Run it</h2>
      <pre class="code"><span class="cmt"># any static server works</span>
npx serve .
<span class="cmt"># or</span>
python -m http.server 5173</pre>

      <blockquote>Built by ${esc(PROFILE.name)}. If it gave you an idea, go build the idea.</blockquote>
    </article>`;
  }
};
