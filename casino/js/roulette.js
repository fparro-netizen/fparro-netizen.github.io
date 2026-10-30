'use strict';
/* European roulette: single zero, inside bets by tapping numbers, lines and corners, canvas wheel with ball physics feel. */
(() => {
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const MAX = 10000;
  const color = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
  const OUT = {
    low: { label: '1 to 18', pay: 1, win: n => n >= 1 && n <= 18 },
    even: { label: 'EVEN', pay: 1, win: n => n > 0 && n % 2 === 0 },
    red: { label: '<i class="dia r"></i>', pay: 1, win: n => REDS.has(n) },
    black: { label: '<i class="dia b"></i>', pay: 1, win: n => n > 0 && !REDS.has(n) },
    odd: { label: 'ODD', pay: 1, win: n => n % 2 === 1 },
    high: { label: '19 to 36', pay: 1, win: n => n >= 19 },
    d1: { label: '1st 12', pay: 2, win: n => n >= 1 && n <= 12 },
    d2: { label: '2nd 12', pay: 2, win: n => n >= 13 && n <= 24 },
    d3: { label: '3rd 12', pay: 2, win: n => n >= 25 },
    c1: { label: '2:1', pay: 2, win: n => n > 0 && n % 3 === 1 },
    c2: { label: '2:1', pay: 2, win: n => n > 0 && n % 3 === 2 },
    c3: { label: '2:1', pay: 2, win: n => n > 0 && n % 3 === 0 },
  };
  const NAMES = { 1: 'Straight up', 2: 'Split', 3: 'Street', 4: 'Corner', 6: 'Six line' };

  let S = null;

  Games.add({
    id: 'roulette', name: 'Roulette', tag: 'European single zero',
    art: '<div class="mini-wheel"><i></i></div>',
    help: GUIDES.roulette,
    mount(v, sess) {
      S = { sess, bets: new Map(), history: [], last: null, undo: [], spinning: false, hist: Store.getGame('roulette-hist') || [] };
      v.innerHTML = `
        <div class="felt rl">
          <div class="rl-hist" id="rl-hist"></div>
          <div class="rl-board" id="rl-board"></div>
        </div>
        <div class="ctrl">
          <div class="betline"><span>Total bet <b id="rl-total">$0</b></span><span id="rl-sel" class="sel"></span></div>
          <div class="rackrow" id="rl-rack"></div>
          <div class="btns" id="rl-btns"></div>
        </div>`;
      S.rack = new ChipRack($('#rl-rack'));
      board();
      hist();
      buttons();
    },
    unmount() {
      if (S && !S.spinning) refundAll();
      S = null;
    },
    onBank() { if (S) { S.rack.refresh(); buttons(); } },
  });

  function total() { let t = 0; S.bets.forEach(b => { t += b.amt; }); return t; }
  function refundAll() { const t = total(); if (t) Bank.pay('roulette', t); S.bets.clear(); }

  // ---------- board ----------
  function board() {
    const b = $('#rl-board');
    b.innerHTML = '';
    const out = h('div', 'rl-out');
    ['low', 'even', 'red', 'black', 'odd', 'high'].forEach(k => out.appendChild(outCell(k)));
    const doz = h('div', 'rl-doz');
    ['d1', 'd2', 'd3'].forEach(k => doz.appendChild(outCell(k)));
    const nums = h('div', 'rl-nums');
    nums.appendChild(h('div', 'num green zero', '<span>0</span>'));
    for (let n = 1; n <= 36; n++) nums.appendChild(h('div', 'num ' + color(n), `<span>${n}</span>`));
    const chips = h('div', 'rl-chips');
    nums.appendChild(chips);
    const cols = h('div', 'rl-cols');
    ['c1', 'c2', 'c3'].forEach(k => cols.appendChild(outCell(k)));
    b.appendChild(out); b.appendChild(doz); b.appendChild(nums); b.appendChild(cols);
    S.nums = nums; S.chips = chips;
    bindPress(nums, e => {
      const r = nums.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 3, y = (e.clientY - r.top) / r.height * 13;
      return hit(Math.max(0, Math.min(2.999, x)), Math.max(0, Math.min(12.999, y)));
    });
  }
  function outCell(k) {
    const c = h('div', 'oc oc-' + k, `<span>${OUT[k].label}</span>`);
    c.dataset.k = k;
    bindPress(c, () => k);
    return c;
  }
  // tap places a chip; long-press removes the bet
  function bindPress(el, keyAt) {
    let timer = null, start = null, longed = false;
    el.addEventListener('pointerdown', e => {
      start = e; longed = false;
      timer = setTimeout(() => { longed = true; const k = norm(keyAt(e)); if (S.bets.has(k)) removeBet(k); }, 550);
    });
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerup', e => {
      if (!timer && !longed) return;
      cancel();
      if (longed) return;
      if (start && Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > 18) return;
      place(norm(keyAt(e)));
    });
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', cancel);
  }
  function norm(k) { return Array.isArray(k) ? 'n:' + k.slice().sort((a, b) => a - b).join('-') : k; }
  function numsOf(k) { return k.startsWith('n:') ? k.slice(2).split('-').map(Number) : null; }

  function hit(x, y) {
    const e = 0.26;
    if (y < 1 - e) return [0];
    if (y < 1 + e) {
      if (Math.abs(x - 1) < e) return [0, 1, 2];
      if (Math.abs(x - 2) < e) return [0, 2, 3];
      return y < 1 ? [0] : [0, Math.floor(x) + 1];
    }
    const r = Math.floor(y), c = Math.floor(x), rx = x - c, ry = y - r;
    const num = (cc, rr) => (rr - 1) * 3 + cc + 1;
    const top = ry < e && r > 1, bot = ry > 1 - e && r < 12;
    const left = rx < e && c > 0, right = rx > 1 - e && c < 2;
    if (c === 0 && rx < e * 0.8) {
      const rows = top ? [r - 1, r] : bot ? [r, r + 1] : [r];
      const out = [];
      rows.forEach(rr => { for (let k = 0; k < 3; k++) out.push(num(k, rr)); });
      return out;
    }
    if ((left || right) && (top || bot)) {
      const cs = left ? [c - 1, c] : [c, c + 1], rs = top ? [r - 1, r] : [r, r + 1];
      return [num(cs[0], rs[0]), num(cs[1], rs[0]), num(cs[0], rs[1]), num(cs[1], rs[1])];
    }
    if (left) return [num(c - 1, r), num(c, r)];
    if (right) return [num(c, r), num(c + 1, r)];
    if (top) return [num(c, r - 1), num(c, r)];
    if (bot) return [num(c, r), num(c, r + 1)];
    return [num(c, r)];
  }
  // chip position on the number grid, in grid units
  function spot(nums) {
    const cx = n => (n - 1) % 3 + 0.5, cy = n => Math.ceil(n / 3) + 0.5;
    if (nums.length === 1 && nums[0] === 0) return [1.5, 0.5];
    if (nums.includes(0)) { const nz = nums.filter(n => n); return [nz.reduce((a, n) => a + cx(n), 0) / nz.length, 1]; }
    let x = nums.reduce((a, n) => a + cx(n), 0) / nums.length;
    const y = nums.reduce((a, n) => a + cy(n), 0) / nums.length;
    if (nums.length === 3 || nums.length === 6) x = 0;
    return [x, y];
  }

  function place(k) {
    if (!S || S.spinning) return;
    const amt = Math.min(S.rack.value, MAX - total(), Bank.value);
    if (amt <= 0) { if (total() >= MAX) UI.toast('Table limit is ' + fmt(MAX) + ' per spin'); else App.cashier(); return; }
    Bank.take('roulette', amt);
    const b = S.bets.get(k) || { amt: 0 };
    b.amt += amt; S.bets.set(k, b);
    S.undo.push([k, amt]);
    Sound.play('chip'); haptic();
    const nums = numsOf(k);
    $('#rl-sel').textContent = nums ? (NAMES[nums.length] || '') + ' ' + nums.join(', ') + ' pays ' + (36 / nums.length - 1) + ' to 1' : (OUT[k].pay === 2 ? 'Pays 2 to 1' : 'Pays even money');
    drawChips(); buttons();
  }
  function removeBet(k) {
    const b = S.bets.get(k); if (!b || S.spinning) return;
    Bank.pay('roulette', b.amt); S.bets.delete(k);
    S.undo = S.undo.filter(u => u[0] !== k);
    Sound.play('chips'); haptic('medium');
    drawChips(); buttons();
  }
  function drawChips() {
    S.chips.innerHTML = '';
    $$('.oc .stack', $('#rl-board')).forEach(e => e.remove());
    S.bets.forEach((b, k) => {
      const st = chipStack(b.amt, 'small');
      const nums = numsOf(k);
      if (nums) {
        const [x, y] = spot(nums);
        st.style.left = (x / 3 * 100) + '%'; st.style.top = (y / 13 * 100) + '%';
        S.chips.appendChild(st);
      } else $(`.oc-${k}`).appendChild(st);
    });
    $('#rl-total').textContent = fmt(total());
    S.rack.refresh();
  }
  function buttons() {
    const b = $('#rl-btns'); if (!b) return;
    b.innerHTML = '';
    const t = total();
    const undo = UI.button('Undo', 'ghost', () => {
      const u = S.undo.pop(); if (!u) return;
      const bet = S.bets.get(u[0]); if (!bet) return;
      bet.amt -= u[1]; Bank.pay('roulette', u[1]);
      if (bet.amt <= 0) S.bets.delete(u[0]);
      Sound.play('chip'); drawChips(); buttons();
    });
    undo.disabled = !S.undo.length; b.appendChild(undo);
    const clr = UI.button('Clear', 'ghost', () => { refundAll(); S.undo = []; Sound.play('chips'); drawChips(); buttons(); });
    clr.disabled = !t; b.appendChild(clr);
    let lastT = 0; if (S.last) S.last.forEach(v => { lastT += v; });
    const re = UI.button(t ? 'x2' : 'Rebet', 'ghost', () => {
      const src = t ? new Map([...S.bets].map(([k, v]) => [k, v.amt])) : S.last;
      let need = 0; src.forEach(v => { need += v; });
      if (need > Bank.value || total() + need > MAX) { UI.toast('Not enough for that'); return; }
      src.forEach((v, k) => { Bank.take('roulette', v); const bb = S.bets.get(k) || { amt: 0 }; bb.amt += v; S.bets.set(k, bb); S.undo.push([k, v]); });
      Sound.play('chips'); drawChips(); buttons();
    });
    re.disabled = t ? (t * 2 > MAX || Bank.value < t) : (!S.last || lastT > Bank.value);
    b.appendChild(re);
    const spin = UI.button('Spin', 'gold', () => doSpin());
    spin.disabled = !t; b.appendChild(spin);
  }
  function hist() {
    const e = $('#rl-hist'); if (!e) return;
    e.innerHTML = '<span class="hl">Last</span>';
    S.hist.slice(0, 14).forEach((n, i) => e.appendChild(h('span', 'hn ' + color(n) + (i === 0 ? ' first' : ''), String(n))));
    if (!S.hist.length) e.appendChild(h('span', 'hempty', 'No spins yet. Place your bets.'));
  }

  // ---------- the spin ----------
  async function doSpin() {
    if (S.spinning || !total()) return;
    const sess = S.sess;
    S.spinning = true;
    S.last = new Map([...S.bets].map(([k, v]) => [k, v.amt]));
    $('#rl-btns').innerHTML = '';
    const win = randInt(37);
    await wheel(win, sess);
    if (!S || S.sess !== sess) return;
    S.hist.unshift(win); S.hist = S.hist.slice(0, 40);
    Store.setGame('roulette-hist', S.hist);
    hist();
    // settle
    let back = 0, staked = 0;
    const winners = [];
    S.bets.forEach((b, k) => {
      staked += b.amt;
      const nums = numsOf(k);
      const ok = nums ? nums.includes(win) : OUT[k].win(win);
      if (ok) { const pay = nums ? 36 / nums.length - 1 : OUT[k].pay; back += b.amt * (pay + 1); winners.push(k); }
    });
    // mark the winning number and fade losing chips
    const cell = win === 0 ? $('.zero', S.nums) : S.nums.children[win];
    cell.classList.add('hit');
    Bank.pay('roulette', back);
    const profit = back - staked;
    Bank.record(profit);
    const label = `<span class="rn ${color(win)}">${win}</span>`;
    if (profit > 0) {
      Sound.play(profit >= staked * 10 ? 'big' : 'win'); haptic('medium');
      UI.banner(label + ' ' + color(win).toUpperCase(), 'You win ' + fmt(profit), 'win', 1900);
      if (profit >= staked * 10) UI.confetti(70);
    } else if (back > 0) { Sound.play('push'); UI.banner(label + ' ' + color(win).toUpperCase(), 'Returned ' + fmt(back), 'push', 1700); }
    else { Sound.play('lose'); UI.banner(label + ' ' + color(win).toUpperCase(), 'No winners', 'lose', 1500); }
    $$('.stack', $('#rl-board')).forEach(st => st.classList.add('fade'));
    await sess.wait(2000);
    if (!S || S.sess !== sess) return;
    cell.classList.remove('hit');
    S.bets.clear(); S.undo = [];
    S.spinning = false;
    $('#rl-sel').textContent = '';
    drawChips(); buttons();
  }

  // full-screen wheel; resolves when the ball has settled
  function wheel(win, sess) {
    return new Promise(res => {
      const ov = h('div', 'wheel-ov', '<canvas></canvas><div class="wres"></div>');
      $('#fx').appendChild(ov);
      const cv = ov.querySelector('canvas');
      const size = Math.min(window.innerWidth - 24, window.innerHeight * 0.62, 460);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = size * dpr; cv.height = size * dpr;
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      const R = size / 2, step = Math.PI * 2 / 37;
      const wheelImg = renderWheel(size, dpr);
      const T = 6200 * speed(), t0 = performance.now();
      const idx = ORDER.indexOf(win);
      const w0 = rand() * Math.PI * 2, W = Math.PI * 2 * (1.2 + rand() * 0.4);
      const wEnd = w0 + W;
      const target = wEnd + idx * step - Math.PI / 2; // pocket angle at the end (pocket 0 drawn at the top)
      const b0 = rand() * Math.PI * 2;
      let K = b0 - target; K = ((K % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) + Math.PI * 2 * 6;
      let lastPocket = -1, done = false;
      const ease = k => 1 - Math.pow(1 - k, 3);
      Sound.play('dice');
      const frame = now => {
        if (!sess.alive || done) { ov.remove(); return; }
        const k = Math.min(1, (now - t0) / T);
        const wa = w0 + W * ease(k);
        // ball runs the other way and slows faster than the wheel
        const bk = 1 - Math.pow(1 - k, 2.2);
        let ba = b0 - K * bk;
        let br;
        const rimR = R * 0.86, pocketR = R * 0.62;
        if (k < 0.62) br = rimR;
        else if (k < 0.9) {
          const f = (k - 0.62) / 0.28;
          br = rimR - (rimR - pocketR) * f + Math.abs(Math.sin(f * Math.PI * 3)) * R * 0.05 * (1 - f);
          ba += Math.sin(f * Math.PI * 4) * 0.08 * (1 - f);
        } else br = pocketR;
        if (k >= 1) ba = wa + idx * step - Math.PI / 2;
        // ticks as the ball skips over frets
        if (k > 0.55) {
          const rel = Math.floor(((ba - wa) % (Math.PI * 2) + Math.PI * 4) / step);
          if (rel !== lastPocket) { if (lastPocket !== -1 && k < 0.97) Sound.play('tick'); lastPocket = rel; }
        }
        ctx.clearRect(0, 0, size, size);
        ctx.save(); ctx.translate(R, R); ctx.rotate(wa); ctx.drawImage(wheelImg, -R, -R, size, size); ctx.restore();
        // ball
        const bx = R + Math.cos(ba) * br, by = R + Math.sin(ba) * br;
        const g = ctx.createRadialGradient(bx - R * 0.012, by - R * 0.012, 0, bx, by, R * 0.035);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e8e8e8'); g.addColorStop(1, '#9a9a9a');
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(bx + 2, by + 2, R * 0.032, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, R * 0.032, 0, Math.PI * 2); ctx.fill();
        if (k < 1) requestAnimationFrame(frame);
        else {
          done = true;
          Sound.play('thunk');
          const r = ov.querySelector('.wres');
          r.innerHTML = `<span class="rn ${color(win)}">${win}</span>`;
          r.classList.add('show');
          setTimeout(() => { ov.classList.add('out'); setTimeout(() => { ov.remove(); res(); }, 350); }, 1200 * speed());
        }
      };
      requestAnimationFrame(frame);
    });
  }
  let cached = null;
  function renderWheel(size, dpr) {
    if (cached && cached.size === size) return cached.c;
    const c = document.createElement('canvas');
    c.width = size * dpr; c.height = size * dpr;
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    const R = size / 2, step = Math.PI * 2 / 37;
    x.translate(R, R);
    // wooden bowl
    let g = x.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
    g.addColorStop(0, '#5a2e14'); g.addColorStop(0.5, '#7a3e1a'); g.addColorStop(0.85, '#3e1d0b'); g.addColorStop(1, '#1e0d04');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
    // ball track
    g = x.createRadialGradient(0, 0, R * 0.78, 0, 0, R * 0.92);
    g.addColorStop(0, '#2b1608'); g.addColorStop(0.5, '#6b3a18'); g.addColorStop(1, '#2b1608');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.92, 0, Math.PI * 2); x.arc(0, 0, R * 0.78, 0, Math.PI * 2, true); x.fill();
    // number ring and pockets
    for (let i = 0; i < 37; i++) {
      const n = ORDER[i], a0 = i * step - Math.PI / 2 - step / 2, a1 = a0 + step;
      x.fillStyle = n === 0 ? '#0f8a4a' : REDS.has(n) ? '#b8141f' : '#151515';
      x.beginPath(); x.arc(0, 0, R * 0.78, a0, a1); x.arc(0, 0, R * 0.56, a1, a0, true); x.closePath(); x.fill();
      x.strokeStyle = '#d4af37'; x.lineWidth = Math.max(1, R * 0.008);
      x.beginPath(); x.moveTo(Math.cos(a0) * R * 0.56, Math.sin(a0) * R * 0.56); x.lineTo(Math.cos(a0) * R * 0.78, Math.sin(a0) * R * 0.78); x.stroke();
      x.save();
      x.rotate(i * step);
      x.fillStyle = '#fff';
      x.font = `600 ${Math.round(R * 0.075)}px -apple-system, Helvetica, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(n), 0, -R * 0.71);
      x.restore();
    }
    x.strokeStyle = '#d4af37'; x.lineWidth = Math.max(1.5, R * 0.012);
    x.beginPath(); x.arc(0, 0, R * 0.78, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, R * 0.64, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, R * 0.56, 0, Math.PI * 2); x.stroke();
    // cone
    g = x.createRadialGradient(-R * 0.1, -R * 0.1, R * 0.05, 0, 0, R * 0.56);
    g.addColorStop(0, '#8a5328'); g.addColorStop(0.6, '#5a2e14'); g.addColorStop(1, '#2a1406');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.555, 0, Math.PI * 2); x.fill();
    // turret
    g = x.createRadialGradient(-R * 0.03, -R * 0.03, 0, 0, 0, R * 0.16);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#d4af37'); g.addColorStop(1, '#7a5a12');
    x.fillStyle = g;
    for (let i = 0; i < 4; i++) {
      x.save(); x.rotate(i * Math.PI / 2);
      x.beginPath(); x.ellipse(0, -R * 0.2, R * 0.025, R * 0.14, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.beginPath(); x.arc(0, 0, R * 0.09, 0, Math.PI * 2); x.fill();
    cached = { size, c };
    return c;
  }
})();
