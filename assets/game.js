/* ────────────────────────────────────────────────────────────────
   game.js — "Knight Run": a pixel endless-runner that unlocks when
   the assistant's query budget hits zero. Clear 30 to earn 5 more.
   ──────────────────────────────────────────────────────────────── */

const KnightRun = (() => {
  const W = 520, H = 170, GROUND = 138, GRAV = 0.62, JUMP = -10.4;
  const TARGET = 10;

  let cv, ctx, hudScore, hudBest, hint;
  let raf = null, running = false, dead = false, started = false;
  let y, vy, score, best = +(localStorage.getItem('devbox.knightBest') || 0);
  let obstacles, tick, speed, onWin, rewarded;

  const px = (x, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, yy | 0, w, h); };

  function reset() {
    y = GROUND; vy = 0; score = 0; tick = 0; speed = 4.2;
    obstacles = []; dead = false; rewarded = false;
    hint.textContent = 'CLICK / SPACE TO JUMP · REACH ' + TARGET + ' FOR +5 QUERIES';
  }

  function spawn() {
    const tall = Math.random() > 0.68;
    obstacles.push({ x: W + 10, w: tall ? 12 : 14, h: tall ? 34 : 20, type: tall ? 'rook' : 'pawn' });
  }

  function drawKnight(x, yy) {
    const c = getVar('--acc'), d = getVar('--bright');
    px(x + 4, yy - 26, 12, 6, c);      // head crest
    px(x + 2, yy - 20, 16, 8, c);      // head
    px(x + 13, yy - 18, 3, 3, d);      // eye
    px(x + 5, yy - 12, 12, 8, c);      // body
    px(x + 2, yy - 4, 18, 4, c);       // base
    const step = ((tick >> 2) % 2) === 0;
    px(x + 5, yy, 4, 4, step ? c : d);
    px(x + 13, yy, 4, 4, step ? d : c);
  }

  function drawObstacle(o) {
    const c = getVar('--acc2');
    const top = GROUND - o.h;
    px(o.x, top, o.w, o.h, c);
    if (o.type === 'rook') { px(o.x - 2, top - 4, o.w + 4, 4, c); px(o.x + 3, top - 7, 3, 3, c); }
    else px(o.x + 3, top - 4, o.w - 6, 4, c);
  }

  function getVar(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#f5a524';
  }

  function frame() {
    tick++;
    ctx.clearRect(0, 0, W, H);

    // ground + parallax dashes
    px(0, GROUND, W, 1, getVar('--border2'));
    for (let i = 0; i < 9; i++) {
      const x = (i * 62 - (tick * speed * 0.45) % 62 + W) % W;
      px(x, GROUND + 6, 16, 1, getVar('--border'));
      px((x * 1.7) % W, 30 + (i % 3) * 16, 2, 2, getVar('--border'));
    }

    // physics
    vy += GRAV; y += vy;
    if (y > GROUND) { y = GROUND; vy = 0; }
    drawKnight(28, y);

    // obstacles
    if (tick % Math.max(46, 92 - Math.floor(score * 1.4)) === 0) spawn();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed;
      drawObstacle(o);
      if (o.x + o.w < 0) { obstacles.splice(i, 1); score++; speed = Math.min(9, 4.2 + score * 0.12); continue; }
      // collision box of the knight: x 28..48, top y-26
      if (o.x < 48 && o.x + o.w > 28 && y > GROUND - o.h - 22) return die();
    }

    hudScore.textContent = 'SCORE ' + String(score).padStart(3, '0');
    hudBest.textContent = 'BEST ' + String(best).padStart(3, '0');

    if (score >= TARGET && !rewarded) {
      rewarded = true;
      hint.textContent = 'CLEARED! +5 QUERIES UNLOCKED';
      if (typeof onWin === 'function') onWin(5);
    }
    raf = requestAnimationFrame(frame);
  }

  function die() {
    dead = true; running = false;
    cancelAnimationFrame(raf);
    if (score > best) { best = score; localStorage.setItem('devbox.knightBest', best); }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = getVar('--acc');
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 74);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = getVar('--dim');
    ctx.fillText('SCORE ' + score + '  ·  BEST ' + best, W / 2, 96);
    hint.textContent = 'CLICK OR SPACE TO RESTART';
  }

  function jump() {
    if (!started) { started = true; running = true; reset(); frame(); return; }
    if (dead) { running = true; reset(); frame(); return; }
    if (y >= GROUND) vy = JUMP;
  }

  function idleScreen() {
    ctx.clearRect(0, 0, W, H);
    px(0, GROUND, W, 1, getVar('--border2'));
    drawKnight(28, GROUND);
    ctx.fillStyle = getVar('--dim');
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KNIGHT RUN', W / 2, 52);
  }

  return {
    mount(canvas, els, winCb) {
      cv = canvas; ctx = cv.getContext('2d');
      hudScore = els.score; hudBest = els.best; hint = els.hint; onWin = winCb;
      reset(); started = false; idleScreen();
      hudBest.textContent = 'BEST ' + String(best).padStart(3, '0');
      cv.addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
    },
    key(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); return true; }
      return false;
    },
    stop() { running = false; started = false; cancelAnimationFrame(raf); },
    active() { return running || dead; }
  };
})();
