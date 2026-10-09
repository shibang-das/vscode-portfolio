/* ────────────────────────────────────────────────────────────────
   app.js — the workbench shell.
   Owns: boot, file tree, tabs, editor, menus, palette, rail panels,
   themes, zoom, resizers, status bar, contact form, toasts.
   ──────────────────────────────────────────────────────────────── */

/* Drop a Formspree (or any POST) endpoint here to receive messages.
   Leave empty and the form composes a pre-filled mail instead. */
const FORM_ENDPOINT = '';

const App = (() => {
  const LS = {
    theme: 'devbox.theme', zoom: 'devbox.zoom',
    side: 'devbox.sidew', tabs: 'devbox.tabs'
  };

  let openTabs = ['home'];
  let activeId = 'home';
  let activePanel = 'explorer';
  let sidebarOn = true;
  let assistantOn = false;
  let zoom = 1;

  /* ── DOM refs ─────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const grid = () => $('bodyGrid');

  /* ── toasts ───────────────────────────────────────────────── */
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 240); }, 2600);
  }

  /* ── themes & zoom ────────────────────────────────────────── */
  function setTheme(id, quiet) {
    if (!THEMES.some(t => t.id === id)) return;
    document.documentElement.dataset.theme = id;
    localStorage.setItem(LS.theme, id);
    $('stTheme').textContent = id;
    renderThemes();
    if (!quiet) toast('Theme: ' + THEMES.find(t => t.id === id).label);
  }
  function cycleTheme() {
    const i = THEMES.findIndex(t => t.id === document.documentElement.dataset.theme);
    setTheme(THEMES[(i + 1) % THEMES.length].id);
  }
  function setZoom(z) {
    zoom = Math.min(1.6, Math.max(0.75, +z.toFixed(2)));
    document.documentElement.style.setProperty('--zoom', zoom);
    localStorage.setItem(LS.zoom, zoom);
    const el = $('zoomVal'); if (el) el.textContent = Math.round(zoom * 100) + '%';
  }

  /* ── file tree ────────────────────────────────────────────── */
  function renderTree() {
    const tree = $('fileTree');
    const dirs = [...new Set(FILES.filter(f => f.dir).map(f => f.dir))];
    let html = '';
    dirs.forEach(d => {
      html += `<div class="tree-dir" data-dir="${d}"><span class="caret">▾</span>${d}/</div>`;
      html += FILES.filter(f => f.dir === d).map(fileRow).join('');
    });
    html += FILES.filter(f => !f.dir).map(f => fileRow(f, true)).join('');
    tree.innerHTML = html;

    tree.querySelectorAll('.tree-file').forEach(b =>
      b.addEventListener('click', () => openFile(b.dataset.id)));
    tree.querySelectorAll('.tree-dir').forEach(d =>
      d.addEventListener('click', () => {
        d.classList.toggle('closed');
        const hide = d.classList.contains('closed');
        FILES.filter(f => f.dir === d.dataset.dir).forEach(f => {
          const el = tree.querySelector(`.tree-file[data-id="${f.id}"]`);
          if (el) el.classList.toggle('hidden', hide);
        });
      }));
  }
  function fileRow(f, root) {
    return `<button class="tree-file ${root ? '' : 'nested'} ${f.id === activeId ? 'active' : ''}" data-id="${f.id}">
      <span class="fico" style="color:${f.color}">${f.icon}</span>${f.name}
      ${openTabs.includes(f.id) ? '<span class="dot"></span>' : ''}</button>`;
  }

  /* ── tabs ─────────────────────────────────────────────────── */
  function renderTabs() {
    const bar = $('tabbar');
    bar.innerHTML = openTabs.map(id => {
      const f = FILES.find(x => x.id === id);
      return `<button class="tab ${id === activeId ? 'active' : ''}" data-id="${id}" role="tab">
        <span class="fico" style="color:${f.color}">${f.icon}</span>${f.name}
        <span class="x" data-close="${id}" title="Close">×</span></button>`;
    }).join('') + `<span class="tabbar-actions">
        <button class="icon-btn xs" data-action="closeAll" title="Close all tabs">⌫</button>
      </span>`;

    bar.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', e => {
        if (e.target.dataset.close) { closeTab(e.target.dataset.close); return; }
        openFile(t.dataset.id);
      });
      t.addEventListener('auxclick', e => { if (e.button === 1) closeTab(t.dataset.id); });
    });
    bar.querySelector('[data-action="closeAll"]').addEventListener('click', closeAll);
  }

  function openFile(id, quiet) {
    if (!FILES.some(f => f.id === id)) return;
    if (!openTabs.includes(id)) openTabs.push(id);
    activeId = id;
    localStorage.setItem(LS.tabs, JSON.stringify({ openTabs, activeId }));
    if (location.hash.slice(1) !== id) {
      history.replaceState(null, '', '#' + id);   // shareable deep link
    }
    renderTabs(); renderTree(); renderEditor();
    if (window.innerWidth <= 860) grid().classList.remove('side-open');
    if (!quiet) $('editorScroll').scrollTop = 0;
  }

  function closeTab(id) {
    const i = openTabs.indexOf(id);
    if (i < 0) return;
    openTabs.splice(i, 1);
    if (!openTabs.length) { openTabs = ['home']; activeId = 'home'; }
    else if (activeId === id) activeId = openTabs[Math.max(0, i - 1)];
    localStorage.setItem(LS.tabs, JSON.stringify({ openTabs, activeId }));
    renderTabs(); renderTree(); renderEditor();
  }
  function closeAll() {
    openTabs = ['home']; activeId = 'home';
    renderTabs(); renderTree(); renderEditor();
    toast('All tabs closed');
  }

  /* ── editor ───────────────────────────────────────────────── */
  function renderEditor() {
    const f = FILES.find(x => x.id === activeId);
    const ed = $('editor');
    ed.innerHTML = VIEWS[activeId] ? VIEWS[activeId]() : '<p class="muted-note">File not found.</p>';

    $('breadcrumb').innerHTML =
      `<span>~</span><span class="sep">/</span><span>shibang-das</span>` +
      (f.dir ? `<span class="sep">/</span><span>${f.dir}</span>` : '') +
      `<span class="sep">/</span><b>${f.name}</b><span class="sep">·</span><span>${f.lang}</span>`;
    $('stFile').textContent = f.name;
    document.title = `${f.name} — ${PROFILE.name}`;
    $('tbTitle').textContent = `${f.name} — shibang-das — devbox`;

    wireEditorActions(ed);
    requestAnimationFrame(() => { paintGutter(); paintMinimap(); });
  }

  function wireEditorActions(scope) {
    scope.querySelectorAll('[data-open]').forEach(b =>
      b.addEventListener('click', e => { e.preventDefault(); openFile(b.dataset.open); }));
    const form = scope.querySelector('#contactForm');
    if (form) wireContactForm(form);
  }

  function paintGutter() {
    const h = $('editor').scrollHeight;
    const lines = Math.max(30, Math.ceil(h / 22.8));
    $('gutter').textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  }
  function paintMinimap() {
    const mm = $('minimap');
    if (!mm || getComputedStyle(mm).display === 'none') return;
    const blocks = Array.from($('editor').querySelectorAll('h1,h2,h3,h4,p,li,.chip,.stat,.log-line'));
    mm.innerHTML = blocks.slice(0, 120).map(b => {
      const w = Math.min(100, 20 + (b.textContent.length % 70));
      const hi = /H[1-4]/.test(b.tagName);
      return `<i class="${hi ? 'hi' : ''}" style="width:${hi ? 70 : w}%"></i>`;
    }).join('');
  }

  /* ── side panels / rail ───────────────────────────────────── */
  const RAIL = [
    { id: 'explorer', title: 'workspace', label: 'Explorer', svg: '<path d="M3 7h6l2 3h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
    { id: 'search', title: 'search', label: 'Search', svg: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>' },
    { id: 'themes', title: 'appearance', label: 'Appearance', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>' },
    { id: 'links', title: 'channels', label: 'Links', svg: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>' }
  ];

  function renderRail() {
    $('rail').innerHTML = RAIL.map(r =>
      `<button data-panel="${r.id}" title="${r.label}" aria-label="${r.label}" class="${r.id === activePanel ? 'active' : ''}">
         <svg viewBox="0 0 24 24" class="i">${r.svg}</svg></button>`).join('') +
      `<span class="spacer"></span>
       <button data-action="assistant" title="Assistant (Ctrl+I)" aria-label="Assistant">
         <svg viewBox="0 0 24 24" class="i"><path d="M12 3l2.2 5.3L20 10l-5.8 1.7L12 17l-2.2-5.3L4 10l5.8-1.7z"/></svg></button>
       <button data-action="shortcuts" title="Keyboard shortcuts" aria-label="Shortcuts">
         <svg viewBox="0 0 24 24" class="i"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/></svg></button>`;

    $('rail').querySelectorAll('[data-panel]').forEach(b =>
      b.addEventListener('click', () => showPanel(b.dataset.panel)));
  }

  function showPanel(id) {
    if (activePanel === id && sidebarOn && window.innerWidth > 860) { toggleSidebar(false); return; }
    activePanel = id;
    sidebarOn = true;
    grid().classList.remove('side-off');
    if (window.innerWidth <= 860) grid().classList.add('side-open');
    document.querySelectorAll('.side-panel').forEach(p =>
      p.classList.toggle('hidden', p.dataset.panel !== id));
    $('sidePanelTitle').textContent = RAIL.find(r => r.id === id).title;
    renderRail();
    if (id === 'search') setTimeout(() => $('sideSearch').focus(), 60);
  }

  function toggleSidebar(force) {
    sidebarOn = force === undefined ? !sidebarOn : force;
    if (window.innerWidth <= 860) {
      grid().classList.toggle('side-open', sidebarOn);
    } else {
      grid().classList.toggle('side-off', !sidebarOn);
    }
    renderRail();
  }

  function renderThemes() {
    const list = $('themeList');
    if (!list) return;
    const cur = document.documentElement.dataset.theme;
    list.innerHTML = THEMES.map(t =>
      `<button class="theme-opt ${t.id === cur ? 'active' : ''}" data-theme="${t.id}">
        <span class="tsw">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span>${t.label}</button>`).join('');
    list.querySelectorAll('[data-theme]').forEach(b =>
      b.addEventListener('click', () => setTheme(b.dataset.theme)));
  }

  function renderLinks() {
    $('linkList').innerHTML = LINKS.map(l =>
      `<a class="cchan" href="${l.href}" ${l.href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>
        <span class="cchan-ico">${l.icon}</span>
        <span class="cchan-body"><b>${l.label}</b><small>${l.value}</small></span>
        <span class="cchan-arrow">↗</span></a>`).join('') +
      `<div class="panel-sep"></div>
       <button class="ghost-btn" data-action="copyEmail">copy email address</button>
       <div style="height:6px"></div>
       <button class="ghost-btn" data-action="downloadResume">download résumé</button>`;
  }

  /* ── workspace search ─────────────────────────────────────── */
  const SEARCH_INDEX = (() => {
    const rows = [];
    const push = (fileId, title, text) => rows.push({ fileId, title, text });
    push('home', PROFILE.name, PROFILE.blurb.join(' ') + ' ' + PROFILE.tagline);
    push('about', 'about.md', PROFILE.blurb.join(' ') + ' ' + EDUCATION.school + ' ' + EDUCATION.degree + ' chess');
    EXPERIENCE.forEach(e => push('experience', e.company + ' — ' + e.role, e.points.join(' ') + ' ' + e.tag + ' ' + e.period));
    PROJECTS.forEach(p => push('projects', p.name, p.points.join(' ') + ' ' + p.stack.join(' ')));
    SKILLS.forEach(g => push('skills', g.group, g.items.join(', ')));
    ACHIEVEMENTS.forEach(a => push('achievements', a.title, a.detail));
    LINKS.forEach(l => push('contact', l.label, l.value));
    push('readme', 'README.md', 'vanilla js zero dependency terminal palette themes canvas');
    return rows;
  })();

  function runSearch(q) {
    const box = $('searchResults');
    const term = q.trim().toLowerCase();
    if (term.length < 2) { box.innerHTML = '<p class="panel-note">Type at least two characters.</p>'; return; }
    const hits = SEARCH_INDEX.filter(r => (r.title + ' ' + r.text).toLowerCase().includes(term)).slice(0, 20);
    if (!hits.length) { box.innerHTML = `<p class="panel-note">No matches for “${q}”.</p>`; return; }
    box.innerHTML = hits.map(h => {
      const i = h.text.toLowerCase().indexOf(term);
      const snippet = i < 0 ? h.text.slice(0, 70) : h.text.slice(Math.max(0, i - 26), i + 54);
      const marked = snippet.replace(new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
      return `<button class="sr" data-goto="${h.fileId}"><b>${h.title}</b><span>…${marked}…</span></button>`;
    }).join('');
    box.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => openFile(b.dataset.goto)));
  }

  /* ── command palette ──────────────────────────────────────── */
  let palSel = 0, palItems = [];

  function paletteCommands() {
    return [
      { icon: '⌘', label: 'Toggle terminal', sub: 'Ctrl `', run: () => toggleTerminal() },
      { icon: '⌘', label: 'Toggle sidebar', sub: 'Ctrl B', run: () => toggleSidebar() },
      { icon: '◆', label: 'Open assistant', sub: 'Ctrl I', run: () => openAssistant(true) },
      { icon: '▶', label: 'Play Knight Run', sub: 'mini-game', run: () => { openAssistant(true); Assistant.playGame(); } },
      ...Assistant.algorithms().map(a => ({
        icon: '⟳', label: 'Credit refill: ' + a.label, sub: a.id,
        run: () => { openAssistant(true); Assistant.setAlgorithm(a.id); }
      })),
      { icon: '⎈', label: 'Cycle colour theme', sub: 'Ctrl Shift T', run: cycleTheme },
      ...THEMES.map(t => ({ icon: '◑', label: 'Theme: ' + t.label, sub: t.id, run: () => setTheme(t.id) })),
      { icon: '↓', label: 'Download résumé', sub: 'pdf', run: downloadResume },
      { icon: '✂', label: 'Copy email address', sub: PROFILE.email, run: copyEmail },
      { icon: '+', label: 'Zoom in', sub: 'Ctrl +', run: () => setZoom(zoom + 0.1) },
      { icon: '−', label: 'Zoom out', sub: 'Ctrl −', run: () => setZoom(zoom - 0.1) },
      { icon: '↺', label: 'Reset zoom', sub: 'Ctrl 0', run: () => setZoom(1) },
      { icon: '✕', label: 'Close all tabs', sub: '', run: closeAll },
      { icon: '⌨', label: 'Keyboard shortcuts', sub: '?', run: () => openOverlay('shortcutsOverlay') },
      ...Term.commandNames().map(c => ({ icon: '$', label: 'Run: ' + c, sub: 'terminal', run: () => { toggleTerminal(true); Term.run(c); } }))
    ];
  }

  function openPalette(prefix) {
    openOverlay('paletteOverlay');
    const inp = $('palInput');
    inp.value = prefix || '';
    inp.focus();
    filterPalette();
  }

  function filterPalette() {
    const raw = $('palInput').value;
    const cmdMode = raw.startsWith('>');
    const q = (cmdMode ? raw.slice(1) : raw).trim().toLowerCase();
    $('palSigil').textContent = cmdMode ? '>' : '›';

    const source = cmdMode
      ? paletteCommands()
      : FILES.map(f => ({ icon: f.icon, label: f.name, sub: f.dir ? f.dir + '/' : 'root', run: () => openFile(f.id) }))
          .concat(paletteCommands().slice(0, 4));

    palItems = source.filter(it => fuzzy(it.label.toLowerCase() + ' ' + (it.sub || '').toLowerCase(), q));
    palSel = 0;
    const list = $('palList');
    list.innerHTML = palItems.length
      ? palItems.map((it, i) =>
          `<button class="pal-item ${i === 0 ? 'sel' : ''}" data-i="${i}">
            <span class="pi-ico">${it.icon}</span>${it.label}<span class="pi-sub">${it.sub || ''}</span></button>`).join('')
      : `<div class="pal-empty">No matches. Try <kbd>&gt;</kbd> for commands.</div>`;
    list.querySelectorAll('.pal-item').forEach(b =>
      b.addEventListener('click', () => { const it = palItems[+b.dataset.i]; closeOverlays(); it.run(); }));
  }

  function fuzzy(hay, needle) {
    if (!needle) return true;
    let i = 0;
    for (const ch of needle) { i = hay.indexOf(ch, i); if (i < 0) return false; i++; }
    return true;
  }

  function movePalette(d) {
    if (!palItems.length) return;
    palSel = (palSel + d + palItems.length) % palItems.length;
    const items = $('palList').querySelectorAll('.pal-item');
    items.forEach((b, i) => b.classList.toggle('sel', i === palSel));
    items[palSel].scrollIntoView({ block: 'nearest' });
  }

  /* ── overlays ─────────────────────────────────────────────── */
  function openOverlay(id) { closeOverlays(); $(id).classList.remove('hidden'); }
  function closeOverlays() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    $('menuPop').classList.add('hidden');
  }

  /* ── menus ────────────────────────────────────────────────── */
  const MENUS = {
    File: [
      { label: 'Open home.tsx', key: 'Ctrl 1', run: () => openFile('home') },
      { label: 'Go to file…', key: 'Ctrl K', run: () => openPalette('') },
      { sep: true },
      { label: 'Download résumé', key: '', run: () => downloadResume() },
      { label: 'Copy email address', key: '', run: () => copyEmail() },
      { sep: true },
      { label: 'Close tab', key: 'Ctrl W', run: () => closeTab(activeId) },
      { label: 'Close all tabs', key: '', run: closeAll }
    ],
    View: [
      { label: 'Toggle sidebar', key: 'Ctrl B', run: () => toggleSidebar() },
      { label: 'Toggle terminal', key: 'Ctrl `', run: () => toggleTerminal() },
      { label: 'Toggle assistant', key: 'Ctrl I', run: () => openAssistant() },
      { sep: true },
      { label: 'Zoom in', key: 'Ctrl +', run: () => setZoom(zoom + 0.1) },
      { label: 'Zoom out', key: 'Ctrl −', run: () => setZoom(zoom - 0.1) },
      { label: 'Reset zoom', key: 'Ctrl 0', run: () => setZoom(1) },
      { sep: true },
      { label: 'Appearance…', key: '', run: () => showPanel('themes') }
    ],
    Go: FILES.map((f, i) => ({ label: f.name, key: i < 8 ? 'Ctrl ' + (i + 1) : '', run: () => openFile(f.id) })),
    Terminal: [
      { label: 'New terminal', key: 'Ctrl `', run: () => { toggleTerminal(true); Term.greet(); } },
      { label: 'Clear terminal', key: 'Ctrl L', run: () => Term.clear() },
      { sep: true },
      { label: 'Run: whoami', key: '', run: () => { toggleTerminal(true); Term.run('whoami'); } },
      { label: 'Run: neofetch', key: '', run: () => { toggleTerminal(true); Term.run('neofetch'); } },
      { label: 'Run: help', key: '', run: () => { toggleTerminal(true); Term.run('help'); } }
    ],
    Help: [
      { label: 'Keyboard shortcuts', key: '?', run: () => openOverlay('shortcutsOverlay') },
      { label: 'About this build', key: '', run: () => openFile('readme') },
      { sep: true },
      { label: 'Email Shibang', key: '', run: () => location.href = 'mailto:' + PROFILE.email },
      { label: 'LinkedIn ↗', key: '', run: () => window.open(PROFILE.linkedin, '_blank', 'noreferrer') }
    ]
  };

  function renderMenubar() {
    $('menubar').innerHTML = Object.keys(MENUS).map(m => `<button data-menu="${m}">${m}</button>`).join('');
    $('menubar').querySelectorAll('[data-menu]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); showMenu(b.dataset.menu, b); }));
  }

  function showMenu(name, anchor) {
    const pop = $('menuPop');
    if (!pop.classList.contains('hidden') && pop.dataset.menu === name) { pop.classList.add('hidden'); return; }
    pop.dataset.menu = name;
    pop.innerHTML = MENUS[name].map((it, i) => it.sep
      ? '<div class="menu-sep"></div>'
      : `<button class="menu-item" data-i="${i}">${it.label}${it.key ? `<span class="mk">${it.key}</span>` : ''}</button>`).join('');
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left, innerWidth - 240) + 'px';
    pop.style.top = r.bottom + 4 + 'px';
    pop.classList.remove('hidden');
    pop.querySelectorAll('.menu-item').forEach(b =>
      b.addEventListener('click', () => { pop.classList.add('hidden'); MENUS[name][+b.dataset.i].run(); }));
  }

  function compactMenu(anchor) {
    const pop = $('menuPop');
    const all = Object.entries(MENUS).flatMap(([k, v]) => [{ head: k }, ...v.filter(x => !x.sep)]);
    pop.dataset.menu = '__compact';
    pop.innerHTML = all.map((it, i) => it.head
      ? `<div class="menu-sep"></div><div class="mk" style="padding:4px 10px;font-size:10px;letter-spacing:.14em;text-transform:uppercase">${it.head}</div>`
      : `<button class="menu-item" data-i="${i}">${it.label}</button>`).join('');
    const r = anchor.getBoundingClientRect();
    pop.style.left = '8px';
    pop.style.top = r.bottom + 4 + 'px';
    pop.style.maxHeight = '70vh';
    pop.style.overflowY = 'auto';
    pop.classList.remove('hidden');
    pop.querySelectorAll('.menu-item').forEach(b =>
      b.addEventListener('click', () => { pop.classList.add('hidden'); all[+b.dataset.i].run(); }));
  }

  /* ── terminal / assistant toggles ─────────────────────────── */
  function toggleTerminal(force) {
    const t = $('terminal');
    const show = force === undefined ? t.classList.contains('collapsed') : force;
    t.classList.toggle('collapsed', !show);
    if (show) setTimeout(() => Term.focus(), 40);
  }

  function openAssistant(force) {
    assistantOn = force === undefined ? !assistantOn : force;
    $('assistant').classList.toggle('hidden', !assistantOn);
    $('stAssistant').style.color = assistantOn ? 'var(--acc)' : '';
    if (assistantOn) setTimeout(() => Assistant.focus(), 60);
  }

  /* ── actions ──────────────────────────────────────────────── */
  async function downloadResume() {
    // Verify the file is actually there before promising a download.
    try {
      const r = await fetch(PROFILE.resume, { method: 'HEAD' });
      if (!r.ok) throw new Error('missing');
    } catch {
      toast('Résumé PDF not found — drop it in at /' + PROFILE.resume, 'err');
      return;
    }
    const a = document.createElement('a');
    a.href = PROFILE.resume;
    a.download = PROFILE.resume;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Downloading ' + PROFILE.resume);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      toast('Copied ' + PROFILE.email, 'ok');
    } catch {
      prompt('Copy the address:', PROFILE.email);
    }
  }

  /* ── contact form ─────────────────────────────────────────── */
  function wireContactForm(form) {
    const status = form.querySelector('#cfStatus');
    const btn = form.querySelector('#cfSend');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const message = form.elements.message.value.trim();

      if (!name || !email || !message) return fail('All three fields are required.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email address looks off.');

      btn.disabled = true; btn.textContent = 'Sending…';
      status.className = 'cf-status'; status.textContent = '';

      if (!FORM_ENDPOINT) {
        // No backend configured — hand off to the visitor's mail client.
        const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
        location.href = `mailto:${PROFILE.email}?subject=${encodeURIComponent('Portfolio message from ' + name)}&body=${body}`;
        done('Opened your mail client — hit send there.');
        return;
      }
      try {
        const r = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        if (!r.ok) throw new Error('bad status ' + r.status);
        form.reset();
        done('Message sent. I usually reply within a day.');
      } catch (err) {
        fail('Could not send — email me directly at ' + PROFILE.email + '.');
      }

      function done(msg) {
        status.className = 'cf-status ok'; status.textContent = msg;
        btn.disabled = false; btn.textContent = 'Send message';
        toast('Message ready', 'ok');
      }
    });

    function fail(msg) {
      status.className = 'cf-status err'; status.textContent = msg;
      btn.disabled = false; btn.textContent = 'Send message';
      toast(msg, 'err');
      return false;
    }
  }

  /* ── resizers ─────────────────────────────────────────────── */
  function wireResizers() {
    drag($('sideResizer'), e => {
      const w = Math.min(420, Math.max(180, e.clientX));
      document.documentElement.style.setProperty('--side-w', w + 'px');
      localStorage.setItem(LS.side, w);
    }, 'col-resize');

    drag($('termResizer'), e => {
      const h = Math.min(innerHeight - 200, Math.max(120, innerHeight - e.clientY - 24));
      document.documentElement.style.setProperty('--term-h', h + 'px');
    }, 'row-resize');
  }

  function drag(handle, onMove, cursor) {
    if (!handle) return;
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      const move = ev => onMove(ev);
      const up = () => {
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  }

  /* ── keyboard ─────────────────────────────────────────────── */
  function wireKeys() {
    addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);

      if (e.key === 'Escape') {
        const pal = !$('paletteOverlay').classList.contains('hidden');
        closeOverlays();
        if (!pal && assistantOn) openAssistant(false);
        return;
      }
      if (mod && (e.key === 'k' || e.key === 'p')) { e.preventDefault(); openPalette(e.shiftKey ? '>' : ''); return; }
      if (mod && e.key === '`') { e.preventDefault(); toggleTerminal(); return; }
      if (mod && e.key === 'b') { e.preventDefault(); toggleSidebar(); return; }
      if (mod && e.key === 'i') { e.preventDefault(); openAssistant(); return; }
      if (mod && e.shiftKey && (e.key === 'T' || e.key === 't')) { e.preventDefault(); cycleTheme(); return; }
      if (mod && e.key === 'w') { e.preventDefault(); closeTab(activeId); return; }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(zoom + 0.1); return; }
      if (mod && e.key === '-') { e.preventDefault(); setZoom(zoom - 0.1); return; }
      if (mod && e.key === '0') { e.preventDefault(); setZoom(1); return; }
      if (mod && /^[1-8]$/.test(e.key)) { e.preventDefault(); openFile(FILES[+e.key - 1].id); return; }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        const i = openTabs.indexOf(activeId);
        openFile(openTabs[(i + 1) % openTabs.length]);
        return;
      }
      if (!typing && e.key === '?') { e.preventDefault(); openOverlay('shortcutsOverlay'); return; }

      // palette navigation
      if (!$('paletteOverlay').classList.contains('hidden')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
        else if (e.key === 'Enter' && palItems[palSel]) { e.preventDefault(); const it = palItems[palSel]; closeOverlays(); it.run(); }
        return;
      }
      // knight run
      if (assistantOn && Assistant.gameVisible() && !typing) KnightRun.key(e);
    });
  }

  /* ── global click delegation ──────────────────────────────── */
  function wireGlobalActions() {
    document.addEventListener('click', e => {
      const act = e.target.closest('[data-action]');
      if (act) {
        const a = act.dataset.action;
        ({
          palette: () => openPalette(''),
          toggleTerminal: () => toggleTerminal(),
          clearTerminal: () => Term.clear(),
          cycleTheme,
          themes: () => showPanel('themes'),
          assistant: () => openAssistant(),
          shortcuts: () => openOverlay('shortcutsOverlay'),
          downloadResume,
          copyEmail,
          zoomIn: () => setZoom(zoom + 0.1),
          zoomOut: () => setZoom(zoom - 0.1),
          zoomReset: () => setZoom(1),
          closeAll
        }[a] || (() => {}))();
        return;
      }
      if (e.target.closest('[data-close-overlay]')) { closeOverlays(); return; }
      if (e.target.classList.contains('overlay')) { closeOverlays(); return; }
      if (!e.target.closest('#menuPop') && !e.target.closest('#menubar') && !e.target.closest('#compactMenuBtn'))
        $('menuPop').classList.add('hidden');
      if (window.innerWidth <= 860 && grid().classList.contains('side-open')
        && !e.target.closest('.sidebar') && !e.target.closest('.rail')) grid().classList.remove('side-open');
    });
  }

  /* ── clock ────────────────────────────────────────────────── */
  function tickClock() {
    const t = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
    });
    $('stClock').textContent = t + ' IST';
  }

  /* ── boot ─────────────────────────────────────────────────── */
  function boot() {
    const el = $('bootLog');
    const lines = [
      '<b>devbox</b> <i>v1.0</i>  · initialising workspace',
      '  ✓ mounting ~/shibang-das',
      '  ✓ loading src/*  (8 files)',
      '  ✓ starting shell, palette, assistant',
      '  <i>ready</i> — Ctrl K for the command palette'
    ];
    let i = 0;
    const step = () => {
      el.innerHTML += lines[i] + '\n';
      if (++i < lines.length) setTimeout(step, 130);
      else setTimeout(() => {
        $('boot').classList.add('gone');
        setTimeout(() => $('boot').remove(), 500);
      }, 380);
    };
    if (sessionStorage.getItem('devbox.booted')) { $('boot').remove(); }
    else { sessionStorage.setItem('devbox.booted', '1'); step(); }
  }

  /* ── init ─────────────────────────────────────────────────── */
  function init() {
    setTheme(localStorage.getItem(LS.theme) || 'ember', true);
    setZoom(+(localStorage.getItem(LS.zoom) || 1));
    const w = localStorage.getItem(LS.side);
    if (w) document.documentElement.style.setProperty('--side-w', w + 'px');

    try {
      const saved = JSON.parse(localStorage.getItem(LS.tabs) || 'null');
      if (saved && Array.isArray(saved.openTabs) && saved.openTabs.length) {
        openTabs = saved.openTabs.filter(id => FILES.some(f => f.id === id));
        activeId = FILES.some(f => f.id === saved.activeId) ? saved.activeId : openTabs[0];
      }
    } catch {}

    // A #hash in the URL wins over the restored session.
    const hash = location.hash.slice(1);
    if (FILES.some(f => f.id === hash)) {
      if (!openTabs.includes(hash)) openTabs.push(hash);
      activeId = hash;
    }
    addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (h && h !== activeId && FILES.some(f => f.id === h)) openFile(h);
    });

    renderMenubar(); renderRail(); renderTree(); renderTabs(); renderEditor();
    renderThemes(); renderLinks();

    $('shortcutList').innerHTML = SHORTCUTS.map(([k, d]) =>
      `<div class="sc-row"><span>${d}</span><span class="keys">${k.split(/\s+/).map(x => `<kbd>${x}</kbd>`).join('')}</span></div>`).join('');

    $('sideSearch').addEventListener('input', e => runSearch(e.target.value));
    $('sideSearch').addEventListener('keydown', e => e.stopPropagation());
    $('sideCollapse').addEventListener('click', () => toggleSidebar(false));
    // Resume buttons now use native <a> tags (view + download) — no JS needed.
    $('compactMenuBtn').addEventListener('click', e => { e.stopPropagation(); compactMenu(e.currentTarget); });

    $('palInput').addEventListener('input', filterPalette);
    $('palInput').addEventListener('keydown', e => e.stopPropagation());
    // let the global handler own arrows/enter while the palette is open
    $('palInput').addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape') return closeOverlays();
        if (e.key === 'Enter') { const it = palItems[palSel]; if (it) { closeOverlays(); it.run(); } return; }
        movePalette(e.key === 'ArrowDown' ? 1 : -1);
      }
    });

    Term.init(); Assistant.init();
    wireResizers(); wireKeys(); wireGlobalActions();
    tickClock(); setInterval(tickClock, 15000);
    addEventListener('resize', () => { paintGutter(); paintMinimap(); });
    $('editorScroll').addEventListener('scroll', () => {
      $('gutter').style.transform = `translateY(${-$('editorScroll').scrollTop}px)`;
    });
    boot();
  }

  return {
    init, openFile, toast, setTheme, toggleTerminal, openAssistant,
    downloadResume, copyEmail, showPanel
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
