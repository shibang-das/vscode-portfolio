/* ────────────────────────────────────────────────────────────────
   terminal.js — a small but real command loop.
   Everything here also has a UI equivalent; the terminal is the
   fast path, not a gimmick.
   ──────────────────────────────────────────────────────────────── */

const Term = (() => {
  let out, input, history = [], hIdx = -1;

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const write = html => {
    const d = document.createElement('div');
    d.innerHTML = html;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  };
  const line = (s = '') => write(s);

  const COMMANDS = {
    help: {
      desc: 'list every command',
      run() {
        line('<span class="hl">available commands</span>');
        Object.keys(COMMANDS).sort().forEach(c =>
          line(`  <span class="acc">${c.padEnd(12)}</span><span class="dim">${COMMANDS[c].desc}</span>`));
        line('');
        line('<span class="dim">tip: tab completes, ↑/↓ walks history</span>');
      }
    },
    whoami: {
      desc: 'short bio',
      run() {
        line(`<span class="acc">${PROFILE.name}</span> — ${PROFILE.role} @ ${PROFILE.company}`);
        line(`<span class="dim">${PROFILE.location}</span>`);
        line('');
        PROFILE.facts.forEach(f => line(`  <span class="warn">${f.k.padEnd(9)}</span>${esc(f.v)}`));
      }
    },
    ls: {
      desc: 'list workspace files',
      run() {
        line('<span class="dim">src/</span>');
        FILES.filter(f => f.dir).forEach(f => line(`  <span class="acc">${f.name}</span>`));
        FILES.filter(f => !f.dir).forEach(f => line(`<span class="acc">${f.name}</span>`));
      }
    },
    cat: {
      desc: 'print a file summary  (cat experience.ts)',
      run(args) {
        const target = (args[0] || '').toLowerCase();
        const f = FILES.find(x => x.name.toLowerCase() === target || x.id === target);
        if (!f) return line(`<span class="err">cat: ${esc(args[0] || '')}: no such file</span>`);
        SUMMARIES[f.id]().forEach(line);
        line(`<span class="dim">— open it with:</span> <span class="acc">open ${f.name}</span>`);
      }
    },
    open: {
      desc: 'open a file in the editor',
      run(args) {
        const target = (args[0] || '').toLowerCase();
        const f = FILES.find(x => x.name.toLowerCase() === target || x.id === target);
        if (!f) return line(`<span class="err">open: ${esc(args[0] || '')}: no such file</span>`);
        App.openFile(f.id);
        line(`<span class="ok">opened</span> ${f.name}`);
      }
    },
    exp:      { desc: 'work experience', run: () => SUMMARIES.experience().forEach(line) },
    projects: { desc: 'shipped projects', run: () => SUMMARIES.projects().forEach(line) },
    skills:   { desc: 'technical skills', run: () => SUMMARIES.skills().forEach(line) },
    stats:    { desc: 'competitive programming ratings', run: () => SUMMARIES.achievements().forEach(line) },
    contact: {
      desc: 'contact details',
      run() {
        LINKS.forEach(l => line(`  <span class="warn">${l.label.padEnd(11)}</span>${l.href.startsWith('http')
          ? `<a href="${l.href}" target="_blank" rel="noreferrer">${esc(l.value)}</a>` : esc(l.value)}`));
      }
    },
    resume: {
      desc: 'download the résumé',
      run() { App.downloadResume(); line('<span class="ok">→</span> requesting Shibang_Das_Resume.pdf'); }
    },
    theme: {
      desc: 'switch colour scheme  (theme moss)',
      run(args) {
        if (!args[0]) {
          line('<span class="dim">usage: theme &lt;name&gt;</span>');
          return THEMES.forEach(t => line(`  <span class="acc">${t.id.padEnd(8)}</span><span class="dim">${t.label}</span>`));
        }
        const t = THEMES.find(x => x.id === args[0].toLowerCase());
        if (!t) return line(`<span class="err">theme: unknown scheme '${esc(args[0])}'</span>`);
        App.setTheme(t.id);
        line(`<span class="ok">theme →</span> ${t.label}`);
      }
    },
    ask: {
      desc: 'send a question to the assistant',
      run(args) {
        if (!args.length) return line('<span class="dim">usage: ask what did you build at joveo</span>');
        App.openAssistant(true);
        Assistant.ask(args.join(' '));
        line('<span class="ok">→</span> sent to the assistant panel');
      }
    },
    ratelimit: {
      desc: 'show the chat credit meter',
      run() {
        const c = Assistant.credits();
        line(`<span class="hl">credit meter</span> — <span class="acc">${c.left}</span><span class="dim">/${c.of} credits</span>`);
        line(`<span class="warn">policy</span>    ${c.label} · 1 credit per 45s, pools to ${c.of}`);
        line(`<span class="warn">refill</span>    ${c.nextMs === null ? '<span class="dim">full</span>' : '+1 in ' + Math.ceil(c.nextMs / 1000) + 's'}`);
        line('');
        line('<span class="dim">out of credits? score 10 in Knight Run for 5 back —</span> <span class="acc">game</span>');
      }
    },
    game: {
      desc: 'play Knight Run in the assistant panel',
      run() {
        App.openAssistant(true);
        Assistant.playGame();
        line('<span class="ok">→</span> Knight Run — click or space to jump');
      }
    },
    neofetch: {
      desc: 'system card',
      run() {
        const art = [
          '   ______   ', '  / ____ \\  ', ' | |    | | ',
          ' | |____| | ', '  \\______/  ', '            '
        ];
        const info = [
          `<span class="acc">shibang</span>@<span class="acc">devbox</span>`,
          `<span class="dim">──────────────────────</span>`,
          `<span class="warn">role</span>      ${PROFILE.role} @ ${PROFILE.company}`,
          `<span class="warn">stack</span>     Java · Spring Boot · Kafka`,
          `<span class="warn">school</span>    IIT (BHU) Varanasi`,
          `<span class="warn">rating</span>    CF 1708 · LC 1977`
        ];
        art.forEach((a, i) => line(`<span class="acc">${esc(a)}</span> ${info[i] || ''}`));
      }
    },
    date: { desc: 'current time (IST)', run: () => line(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST') },
    echo: { desc: 'print arguments', run: a => line(esc(a.join(' '))) },
    banner: {
      desc: 'ascii nameplate',
      run() {
        [' ____  _     _ _                    ',
         '/ ___|| |__ (_) |__   __ _ _ __   __ _',
         '\\___ \\| \'_ \\| | \'_ \\ / _` | \'_ \\ / _` |',
         ' ___) | | | | | |_) | (_| | | | | (_| |',
         '|____/|_| |_|_|_.__/ \\__,_|_| |_|\\__, |',
         '                                 |___/ '].forEach(l => line(`<span class="acc">${esc(l)}</span>`));
      }
    },
    sudo: {
      desc: 'nice try',
      run(a) {
        if (a.join(' ').includes('hire')) return line('<span class="ok">permission granted.</span> email: <span class="acc">' + PROFILE.email + '</span>');
        line('<span class="err">shibang is not in the sudoers file. This incident has been reported.</span>');
      }
    },
    clear: { desc: 'clear the screen', run: () => { out.innerHTML = ''; } },
    exit:  { desc: 'close the panel', run: () => App.toggleTerminal(false) }
  };

  /* compact text summaries reused by cat/exp/projects/... */
  const SUMMARIES = {
    home: () => [`<span class="hl">${PROFILE.name}</span> — ${PROFILE.tagline}`, `<span class="dim">${PROFILE.blurb[0]}</span>`],
    about: () => PROFILE.blurb.map(b => `<span class="dim">${esc(b)}</span>`),
    experience: () => EXPERIENCE.flatMap(e => [
      `<span class="acc">${e.company}</span> <span class="dim">— ${e.role} · ${e.period}</span>`,
      ...e.points.map(p => `  <span class="dim">·</span> ${esc(p)}`), ''
    ]),
    projects: () => PROJECTS.flatMap(p => [
      `<span class="acc">${p.name}</span> <span class="dim">— ${p.kind}</span>`,
      `  <span class="dim">${p.stack.join(' · ')}</span>`,
      ...p.points.map(x => `  <span class="dim">·</span> ${esc(x)}`), ''
    ]),
    skills: () => SKILLS.map(g => `<span class="warn">${g.group.padEnd(14)}</span><span class="dim">${g.items.join(', ')}</span>`),
    achievements: () => ACHIEVEMENTS.map(a => `<span class="ok">✓</span> <span class="hl">${a.title}</span> <span class="dim">— ${a.detail}</span>`),
    contact: () => LINKS.map(l => `<span class="warn">${l.label.padEnd(11)}</span><span class="dim">${l.value}</span>`),
    readme: () => ['<span class="dim">A workbench-shaped portfolio. Vanilla JS, zero dependencies.</span>']
  };

  function exec(raw) {
    const cmd = raw.trim();
    write(`<div style="margin-top:6px"><span class="term-prompt"><b>shibang</b>@devbox<i>:~$</i></span> <span class="hl">${esc(cmd)}</span></div>`);
    if (!cmd) return;
    history.unshift(cmd); hIdx = -1;
    const [name, ...args] = cmd.split(/\s+/);
    const c = COMMANDS[name.toLowerCase()];
    if (!c) {
      line(`<span class="err">${esc(name)}: command not found</span>`);
      const near = Object.keys(COMMANDS).find(k => k.startsWith(name[0]));
      if (near) line(`<span class="dim">did you mean </span><span class="acc">${near}</span><span class="dim">? type </span><span class="acc">help</span>`);
      return;
    }
    c.run(args);
  }

  return {
    init() {
      out = document.getElementById('termOut');
      input = document.getElementById('termInput');

      this.greet();

      input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { exec(input.value); input.value = ''; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx < history.length - 1) input.value = history[++hIdx]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx > 0 ? input.value = history[--hIdx] : (hIdx = -1, input.value = ''); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const p = input.value.trim().toLowerCase();
          const m = Object.keys(COMMANDS).filter(k => k.startsWith(p));
          if (m.length === 1) input.value = m[0] + ' ';
          else if (m.length > 1) line('<span class="dim">' + m.join('  ') + '</span>');
        }
        else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) { line('^C'); input.value = ''; }
        else if (e.key === 'Escape') { input.blur(); }
      });
      document.getElementById('termBody').addEventListener('click', e => {
        if (!window.getSelection().toString() && e.target.tagName !== 'A') input.focus();
      });
    },
    greet() {
      out.innerHTML = '';
      line(`<span class="acc">devbox</span> <span class="dim">shell · v1.0 · ${new Date().getFullYear()}</span>`);
      line(`<span class="dim">Type </span><span class="warn">help</span><span class="dim"> for commands, </span><span class="warn">whoami</span><span class="dim"> for the short version.</span>`);
      line('');
    },
    run: exec,
    focus() { input && input.focus(); },
    clear() { out.innerHTML = ''; },
    commandNames() { return Object.keys(COMMANDS); }
  };
})();
