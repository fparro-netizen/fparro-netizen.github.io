'use strict';
/* Crown Jewels slots: 5 reels, 3 rows, 10 lines, crown wilds. Weights tuned by simulation to about 97% payback. */
(() => {
  const SYM = {
    CH: { w: 6.5, pay: [1, 5, 15, 50], html: '<span class="em">\u{1F352}</span>' },
    LE: { w: 6, pay: [0, 5, 15, 50], html: '<span class="em">\u{1F34B}</span>' },
    ME: { w: 5, pay: [0, 8, 25, 80], html: '<span class="em">\u{1F349}</span>' },
    GR: { w: 5, pay: [0, 8, 25, 80], html: '<span class="em">\u{1F347}</span>' },
    BE: { w: 4, pay: [0, 12, 40, 150], html: '<span class="em">\u{1F514}</span>' },
    BA: { w: 3, pay: [0, 15, 60, 250], html: '<span class="bar">BAR</span>' },
    SE: { w: 2.5, pay: [0, 25, 100, 500], html: '<span class="seven">7</span>' },
    DI: { w: 2, pay: [0, 40, 160, 1000], html: '<span class="em">\u{1F48E}</span>' },
    WI: { w: 2.55, pay: [0, 50, 250, 2500], html: '<span class="wild"><span class="em">\u{1F451}</span><b>WILD</b></span>' },
  };
  const KEYS = Object.keys(SYM);
  const TOTW = KEYS.reduce((a, k) => a + SYM[k].w, 0);
  const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 0, 1, 0]];
  const LCOL = ['#ffd54a', '#ff6b6b', '#6bd0ff', '#9dff6b', '#ff9df0', '#ffa94d', '#b197fc', '#63e6be', '#f783ac', '#fff'];
  const BETS = [10, 20, 50, 100, 250, 500];

  function pick() { let r = rand() * TOTW; for (const k of KEYS) { r -= SYM[k].w; if (r < 0) return k; } return 'CH'; }
  function lineWin(sy) {
    const base = sy.find(s => s !== 'WI') || 'WI';
    let n = 0; for (const s of sy) { if (s === base || s === 'WI') n++; else break; }
    let pay = n >= 2 ? SYM[base].pay[n - 2] : 0, sym = base, cnt = n;
    let wn = 0; for (const s of sy) { if (s === 'WI') wn++; else break; }
    if (wn >= 2 && SYM.WI.pay[wn - 2] > pay) { pay = SYM.WI.pay[wn - 2]; sym = 'WI'; cnt = wn; }
    return { pay, sym, n: cnt };
  }
  function evaluate(g) {
    const wins = [];
    LINES.forEach((L, i) => {
      const w = lineWin(L.map((row, r) => g[r][row]));
      if (w.pay > 0) wins.push(Object.assign({ line: i }, w));
    });
    return wins;
  }

  let S = null;

  Games.add({
    id: 'slots', name: 'Crown Jewels', tag: '5-reel slots, 10 lines',
    art: '<div class="mini-slot"><span>7</span><span>7</span><span>7</span></div>',
    help: GUIDES.slots.replace('{{PAYTABLE}}', `<table class="pt"><tr><th></th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
      ${KEYS.slice().reverse().map(k => `<tr><td class="ps">${SYM[k].html}</td>${SYM[k].pay.map(p => `<td>${p || ''}</td>`).join('')}</tr>`).join('')}</table>`),
    mount(v, sess) {
      S = { sess, bet: 20, grid: null, busy: false, auto: false, cycle: null };
      v.innerHTML = `
        <div class="slots">
          <div class="cab">
            <div class="marquee"><div class="mq-t">Crown Jewels</div><div class="lights"></div></div>
            <div class="win-meter"><span class="wl">WIN</span><span id="sl-win">$0</span></div>
            <div class="reels" id="sl-reels"><svg class="lines" id="sl-lines" preserveAspectRatio="none"></svg></div>
            <div class="lines-key" id="sl-key"></div>
          </div>
          <div class="sl-ctrl">
            <div class="betbox"><button class="rb" id="sl-dn">&minus;</button><div><small>BET</small><b id="sl-bet"></b></div><button class="rb" id="sl-up">+</button></div>
            <button class="spin" id="sl-spin"><span>SPIN</span></button>
            <button class="auto" id="sl-auto">AUTO</button>
          </div>
        </div>`;
      const lights = $('.lights', v);
      for (let i = 0; i < 18; i++) lights.appendChild(h('i'));
      const key = $('#sl-key');
      LINES.forEach((_, i) => key.appendChild(h('span', '', String(i + 1))));
      S.grid = [0, 1, 2, 3, 4].map(() => [pick(), pick(), pick()]);
      const reels = $('#sl-reels');
      for (let r = 0; r < 5; r++) {
        const re = h('div', 'reel', '<div class="strip"></div>');
        reels.insertBefore(re, $('#sl-lines'));
      }
      layout();
      S.onResize = () => layout();
      window.addEventListener('resize', S.onResize);
      $('#sl-dn').addEventListener('click', () => setBet(-1));
      $('#sl-up').addEventListener('click', () => setBet(1));
      $('#sl-spin').addEventListener('click', () => { Sound.unlock(); spin(); });
      $('#sl-auto').addEventListener('click', () => {
        Sound.unlock(); Sound.play('tap');
        S.auto = !S.auto; $('#sl-auto').classList.toggle('on', S.auto);
        if (S.auto && !S.busy) spin();
      });
      setBet(0);
    },
    unmount() { if (S) { window.removeEventListener('resize', S.onResize); clearInterval(S.cycle); } S = null; },
    onBank() { setBet(0); },
  });

  function setBet(d) {
    if (!S || S.busy) return;
    let i = BETS.indexOf(S.bet) + d;
    i = Math.max(0, Math.min(BETS.length - 1, i));
    S.bet = BETS[i];
    if (d) Sound.play('chip');
    $('#sl-bet').textContent = fmt(S.bet);
    $('#sl-dn').disabled = i === 0; $('#sl-up').disabled = i === BETS.length - 1;
  }
  function layout() {
    const reels = $('#sl-reels'); if (!reels) return;
    const w = reels.clientWidth;
    const rw = (w - 4 * 6 - 12) / 5;
    S.symH = Math.round(Math.min(rw * 1.02, (window.innerHeight * 0.42) / 3));
    reels.style.setProperty('--sym', S.symH + 'px');
    $$('.reel', reels).forEach((re, r) => setStrip(re, S.grid[r]));
  }
  function symEl(k) { const d = h('div', 'sym s-' + k, SYM[k].html); d.dataset.k = k; return d; }
  function setStrip(re, col) {
    const st = $('.strip', re);
    st.innerHTML = ''; st.style.transform = 'translateY(0)';
    col.forEach(k => st.appendChild(symEl(k)));
  }
  function clearWins() {
    clearInterval(S.cycle); S.cycle = null;
    $('#sl-lines').innerHTML = '';
    $$('.sym.win', $('#sl-reels')).forEach(e => e.classList.remove('win'));
    $$('#sl-key span').forEach(e => e.classList.remove('on'));
  }

  async function spin() {
    if (!S || S.busy) return;
    const sess = S.sess;
    if (!Bank.can(S.bet)) {
      S.auto = false; $('#sl-auto').classList.remove('on');
      if (Bank.value >= BETS[0]) { UI.toast('Lower your bet to keep playing'); } else App.cashier();
      return;
    }
    S.busy = true;
    clearWins();
    $('#sl-spin').classList.add('down');
    Bank.take('slots', S.bet);
    $('#sl-win').textContent = '$0';
    Sound.play('tap'); haptic();
    const next = [0, 1, 2, 3, 4].map(() => [pick(), pick(), pick()]);
    const reels = $$('.reel', $('#sl-reels'));
    const H = S.symH;
    const anims = reels.map((re, r) => {
      const st = $('.strip', re);
      const filler = 12 + r * 5;
      st.innerHTML = '';
      next[r].forEach(k => st.appendChild(symEl(k)));
      for (let i = 0; i < filler; i++) st.appendChild(symEl(pick()));
      S.grid[r].forEach(k => st.appendChild(symEl(k)));
      const from = -(filler + 3) * H;
      st.style.transform = 'translateY(0)';
      const dur = (900 + r * 260) * speed();
      const a = st.animate([
        { transform: `translateY(${from}px)`, filter: 'blur(0)' },
        { transform: `translateY(${from * 0.6}px)`, filter: 'blur(1.5px)', offset: 0.25 },
        { transform: `translateY(${H * 0.12}px)`, filter: 'blur(0)', offset: 0.9 },
        { transform: 'translateY(0)', filter: 'blur(0)' },
      ], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)' });
      return new Promise(res => { a.onfinish = () => { Sound.play('thunk'); res(); }; });
    });
    // spin sound: soft ticking while reels turn
    let ticking = true;
    (async () => { while (ticking && sess.alive) { Sound.play('tick'); await sess.wait(70); } })();
    for (const a of anims) await a;
    ticking = false;
    if (!S || S.sess !== sess) return;
    S.grid = next;
    reels.forEach((re, r) => setStrip(re, next[r]));
    $('#sl-spin').classList.remove('down');
    const wins = evaluate(next);
    const lineBet = S.bet / 10;
    const won = Math.round(wins.reduce((a, w) => a + w.pay, 0) * lineBet);
    if (won > 0) {
      Bank.pay('slots', won);
      showWins(wins);
      countUp(won);
      const x = won / S.bet;
      if (x >= 25) { Sound.play('big'); haptic('heavy'); UI.banner(x >= 100 ? 'Mega win!' : 'Big win!', fmt(won), 'win', 2200); UI.confetti(x >= 100 ? 120 : 70); }
      else if (won > S.bet) { Sound.play('win'); haptic('medium'); }
      else Sound.play('push');
    }
    Bank.record(won - S.bet);
    await sess.wait(won >= S.bet * 25 ? 2400 : won > 0 ? 1100 : 350);
    if (!S || S.sess !== sess) return;
    S.busy = false;
    if (S.auto) spin();
  }
  function countUp(v) {
    const e = $('#sl-win'), t0 = performance.now(), dur = Math.min(1600, 300 + v * 2);
    const f = t => { if (!e.isConnected) return; const k = Math.min(1, (t - t0) / dur); e.textContent = fmt(v * k); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  function showWins(wins) {
    const reels = $('#sl-reels'), svg = $('#sl-lines');
    const rr = reels.getBoundingClientRect();
    const cols = $$('.reel', reels);
    svg.setAttribute('viewBox', `0 0 ${rr.width} ${rr.height}`);
    const pts = (L, n) => L.map((row, r) => {
      const c = cols[r].getBoundingClientRect();
      return [c.left - rr.left + c.width / 2, c.top - rr.top + S.symH * (row + 0.5)];
    });
    const draw = list => {
      svg.innerHTML = '';
      $$('.sym.win', reels).forEach(e => e.classList.remove('win'));
      $$('#sl-key span').forEach(e => e.classList.remove('on'));
      list.forEach(w => {
        const L = LINES[w.line], p = pts(L);
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', p.map(q => q.join(',')).join(' '));
        pl.setAttribute('stroke', LCOL[w.line]);
        svg.appendChild(pl);
        for (let r = 0; r < w.n; r++) cols[r].querySelectorAll('.sym')[L[r]].classList.add('win');
        $$('#sl-key span')[w.line].classList.add('on');
      });
    };
    draw(wins);
    if (wins.length > 1) {
      let k = 0;
      S.cycle = setInterval(() => { if (!S) return; draw([wins[k % wins.length]]); k++; }, 1100);
    }
  }
})();
