'use strict';
/* Texas Hold'em sit-and-go: no-limit, side pots, rising blinds, Monte Carlo bots with personalities, pass-and-play privacy screen. */
(() => {
  const BUYIN = 500, STACK = 1500, PER_LEVEL = 6;
  const LEVELS = [[10, 20], [15, 30], [25, 50], [40, 80], [60, 120], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000], [800, 1600], [1200, 2400], [2000, 4000], [3000, 6000]];
  const ROSTER = [
    { name: 'Vincent', tight: 0.7, aggr: 0.75, bluff: 0.25, style: 'Tight and aggressive' },
    { name: 'Rosa', tight: 0.3, aggr: 0.8, bluff: 0.45, style: 'Loose cannon' },
    { name: 'Lou', tight: 0.2, aggr: 0.2, bluff: 0.1, style: 'Calls everything' },
    { name: 'Mei', tight: 0.55, aggr: 0.55, bluff: 0.2, style: 'Solid regular' },
    { name: 'Dmitri', tight: 0.85, aggr: 0.45, bluff: 0.05, style: 'The rock' },
    { name: 'Jules', tight: 0.15, aggr: 0.9, bluff: 0.6, style: 'Maniac' },
    { name: 'Harriet', tight: 0.6, aggr: 0.65, bluff: 0.3, style: 'Tricky' },
    { name: 'Omar', tight: 0.45, aggr: 0.4, bluff: 0.15, style: 'Patient' },
  ];
  const COLORS = ['#c9a227', '#b2443a', '#3a78b2', '#6b4bb3', '#2f9a6a', '#c46a2b', '#a23a7a', '#4a8a99'];
  const DIFF = {
    relaxed: { iters: 160, noise: 0.45, read: 0, label: 'Relaxed' },
    sharp: { iters: 380, noise: 0.22, read: 0.08, label: 'Sharp' },
    shark: { iters: 650, noise: 0.1, read: 0.14, label: 'Shark' },
  };
  const POS = {
    2: [[50, 87], [50, 11]],
    3: [[50, 87], [14, 25], [86, 25]],
    4: [[50, 87], [11, 48], [50, 11], [89, 48]],
    5: [[50, 87], [11, 62], [25, 13], [75, 13], [89, 62]],
    6: [[50, 87], [11, 66], [11, 29], [50, 11], [89, 29], [89, 66]],
  };

  let S = null;
  const alive = s => S && S.sess === s && s.alive;

  Games.add({
    id: 'holdem', name: 'Texas Hold\'em', tag: 'Tournament vs. sharp bots',
    art: `<div class="mini-cards"><div class="mc">A<i>${SUIT[3]}</i></div><div class="mc">A<i>${SUIT[0]}</i></div></div><div class="mini-chips"><i></i><i></i><i></i></div>`,
    help: GUIDES.holdem,
    mount(v, sess) { S = { sess, v }; setup(); },
    unmount() { S = null; },
  });

  // ---------- setup ----------
  function setup() {
    const v = S.v;
    v.innerHTML = '';
    const saved = Store.getGame('holdem');
    const wrap = h('div', 'felt pk-setup');
    const card = h('div', 'setup');
    wrap.appendChild(card);
    v.appendChild(wrap);
    if (saved && saved.players) {
      const lv = LEVELS[Math.min(saved.level, LEVELS.length - 1)];
      card.innerHTML = `<h2>Tournament in progress</h2><p class="lead">Hand ${saved.hand + 1} &#183; Blinds ${lv[0]}/${lv[1]} &#183; ${saved.players.filter(p => !p.out).length} players left</p>`;
      const list = h('div', 'mini-standings');
      saved.players.filter(p => !p.out).sort((a, b) => b.stack - a.stack).forEach(p => list.appendChild(h('div', '', `<span>${esc(p.name)}${p.human ? ' &#9733;' : ''}</span><b>${p.stack.toLocaleString()}</b>`)));
      card.appendChild(list);
      const row = h('div', 'btns');
      row.appendChild(UI.button('Abandon', 'ghost', async () => {
        const ok = await UI.modal({ title: 'Abandon tournament?', body: 'Buy-ins are lost.', buttons: [{ label: 'Keep playing', value: false }, { label: 'Abandon', value: true, cls: 'red' }] });
        if (ok && S) { Store.setGame('holdem', null); setup(); }
      }));
      row.appendChild(UI.button('Resume', 'gold', () => { S.T = JSON.parse(JSON.stringify(saved)); table(); loop(); }));
      card.appendChild(row);
      return;
    }
    const me = Store.player;
    const sel = new Set([me.id]);
    let bots = 4, diff = 'sharp';
    card.innerHTML = `<h2>Hold'em Tournament</h2><p class="lead">Buy-in ${fmt(BUYIN)} per player &#183; ${STACK.toLocaleString()} chips &#183; rising blinds</p>`;
    const sec1 = h('div', 'opt', '<div class="ol">Players on this phone</div>');
    const ppl = h('div', 'chips-row');
    Store.d.players.forEach(p => {
      const b = h('button', 'pill' + (sel.has(p.id) ? ' on' : ''), `${esc(p.name)} <small>${fmt(p.bank)}</small>`);
      b.addEventListener('click', () => {
        Sound.play('tap');
        if (sel.has(p.id)) { if (sel.size > 1) sel.delete(p.id); } else if (sel.size < 4) sel.add(p.id);
        refresh();
      });
      b.dataset.id = p.id;
      ppl.appendChild(b);
    });
    sec1.appendChild(ppl);
    sec1.appendChild(h('div', 'onote', 'Pick two or more for pass and play. Add players from the lobby.'));
    card.appendChild(sec1);
    const sec2 = h('div', 'opt', '<div class="ol">Computer opponents</div>');
    const brow = h('div', 'seg');
    sec2.appendChild(brow);
    card.appendChild(sec2);
    const sec3 = h('div', 'opt', '<div class="ol">Difficulty</div>');
    const drow = h('div', 'seg');
    Object.keys(DIFF).forEach(k => {
      const b = h('button', '', DIFF[k].label);
      b.addEventListener('click', () => { Sound.play('tap'); diff = k; refresh(); });
      b.dataset.k = k;
      drow.appendChild(b);
    });
    sec3.appendChild(drow);
    card.appendChild(sec3);
    const info = h('div', 'pool');
    card.appendChild(info);
    const go = UI.button('Take your seats', 'gold big', () => {
      const humans = [...sel].map(id => Store.byId(id));
      const broke = humans.find(p => p.bank < BUYIN);
      if (broke) { UI.toast(esc(broke.name) + ' needs ' + fmt(BUYIN) + ' for the buy-in. Visit the cashier.'); return; }
      start(humans, bots, diff);
    });
    card.appendChild(go);
    function refresh() {
      $$('.pill', ppl).forEach(b => b.classList.toggle('on', sel.has(b.dataset.id)));
      const maxBots = 6 - sel.size, minBots = sel.size > 1 ? 0 : 1;
      bots = Math.max(minBots, Math.min(bots, maxBots));
      brow.innerHTML = '';
      for (let n = minBots; n <= maxBots; n++) {
        const b = h('button', n === bots ? 'on' : '', String(n));
        b.addEventListener('click', () => { Sound.play('tap'); bots = n; refresh(); });
        brow.appendChild(b);
      }
      $$('button', drow).forEach(b => b.classList.toggle('on', b.dataset.k === diff));
      const n = sel.size + bots;
      info.innerHTML = `${n} players &#183; prize pool <b>${fmt(n * BUYIN)}</b> &#183; pays ${payTable(n).map(x => Math.round(x * 100) + '%').join(' / ')}`;
    }
    refresh();
  }
  function payTable(n) { return n >= 5 ? [0.5, 0.3, 0.2] : n >= 3 ? [0.65, 0.35] : [1]; }

  function start(humans, nBots, diff) {
    const roster = shuffle(ROSTER.slice()).slice(0, nBots);
    const n = humans.length + nBots;
    // spread humans around the table
    const seats = new Array(n).fill(null);
    humans.forEach((p, k) => { seats[Math.round(k * n / humans.length) % n] = p; });
    let b = 0, ci = 0;
    const players = seats.map(p => {
      if (p) return { name: p.name, pid: p.id, human: true, stack: STACK, color: '#d4af37', out: false, place: 0 };
      const r = roster[b++];
      return { name: r.name, human: false, bot: { tight: r.tight, aggr: r.aggr, bluff: r.bluff }, style: r.style, stack: STACK, color: COLORS[(ci++ * 3 + 1) % COLORS.length], out: false, place: 0 };
    });
    humans.forEach(p => Bank.take('holdem', BUYIN, p));
    S.T = { players, button: randInt(n), hand: 0, level: 0, diff, pool: n * BUYIN, paid: {} };
    Store.setGame('holdem', S.T);
    Sound.play('chips');
    table();
    loop();
  }

  // ---------- table rendering ----------
  function table() {
    const v = S.v, T = S.T, n = T.players.length;
    S.passPlay = T.players.filter(p => p.human).length > 1;
    v.innerHTML = `
      <div class="felt pk">
        <div class="pk-rail"><div class="pk-oval"></div></div>
        <div class="pk-center"><div class="pk-info" id="pk-info"></div><div class="pk-pot" id="pk-pot"></div><div class="pk-board" id="pk-board"></div><div class="pk-msg" id="pk-msg"></div></div>
        <div id="pk-seats"></div>
      </div>
      <div class="dock" id="pk-dock">
        <div class="mine"><div class="mycards" id="pk-my"></div><div class="myinfo"><div class="myname" id="pk-myname"></div><div class="myhand" id="pk-myhand"></div></div></div>
        <div class="raise hidden" id="pk-raise"></div>
        <div class="btns" id="pk-btns"></div>
      </div>`;
    const seats = $('#pk-seats');
    const pos = POS[n];
    T.players.forEach((p, i) => {
      const [x, y] = pos[i];
      const s = h('div', 'pseat' + (y > 70 ? ' bottom' : y < 32 && x >= 20 && x <= 80 ? ' top' : '') + (x < 30 ? ' left' : x > 70 ? ' right' : ''));
      s.style.left = x + '%'; s.style.top = y + '%';
      s.innerHTML = `<div class="pcs"></div><div class="pav" style="--c:${p.color}">${esc(p.name.slice(0, 1))}<div class="dbtn">D</div></div><div class="pnm">${esc(p.name)}</div><div class="pst"></div><div class="pact"></div><div class="pwin"></div>`;
      seats.appendChild(s);
      const bx = x + (50 - x) * 0.42, by = y + (47 - y) * 0.42;
      const bet = h('div', 'pbet');
      bet.style.left = bx + '%'; bet.style.top = by + '%';
      seats.appendChild(bet);
      p._el = s; p._bet = bet;
      s.addEventListener('click', () => { if (!p.human && p.style) UI.toast(esc(p.name) + ': ' + p.style.toLowerCase()); });
    });
    for (let i = 0; i < 5; i++) $('#pk-board').appendChild(h('div', 'slot'));
    T.players.forEach((p, i) => updSeat(i));
    info();
    dock(null);
  }
  function info() {
    const T = S.T, lv = LEVELS[Math.min(T.level, LEVELS.length - 1)];
    const left = PER_LEVEL - (T.hand % PER_LEVEL);
    $('#pk-info').innerHTML = `<span>Blinds <b>${lv[0]}/${lv[1]}</b> &#183; Hand ${T.hand + 1}${left === 1 ? ' &#183; <b>up next</b>' : ''}</span>`;
  }
  function updSeat(i) {
    const p = S.T.players[i], H = S.H, s = p._el;
    s.classList.toggle('out', p.out);
    s.classList.toggle('folded', !!(H && H.folded[i]));
    s.classList.toggle('turn', !!(H && H.turn === i));
    s.classList.toggle('dealer', S.T.button === i);
    s.querySelector('.pst').textContent = p.out ? 'Out' : (H && H.allIn[i] ? 'All-in' : p.stack.toLocaleString());
    const b = p._bet; b.innerHTML = '';
    if (H && H.bet[i] > 0) b.appendChild(chipStack(H.bet[i], 'small'));
  }
  function act(i, text, cls) {
    const e = S.T.players[i]._el.querySelector('.pact');
    e.textContent = text; e.className = 'pact show ' + (cls || '');
  }
  function clearActs() { S.T.players.forEach(p => { const e = p._el.querySelector('.pact'); e.className = 'pact'; const w = p._el.querySelector('.pwin'); w.className = 'pwin'; }); }
  function potTotal() { const H = S.H; return H.pot + H.bet.reduce((a, b) => a + b, 0); }
  function updPot() {
    const H = S.H, e = $('#pk-pot');
    e.innerHTML = '';
    if (!H || (!H.pot && !potTotal())) return;
    if (H.pot) e.appendChild(chipStack(H.pot, 'small'));
    e.appendChild(h('div', 'potl', 'Pot <b>' + potTotal().toLocaleString() + '</b>'));
  }
  function msg(t) { const e = $('#pk-msg'); if (e) e.textContent = t || ''; }
  function seatCards(i, mode) {
    // mode: 'none' | 'back' | 'face'
    const p = S.T.players[i], H = S.H, wrap = p._el.querySelector('.pcs');
    wrap.innerHTML = '';
    if (mode === 'none' || !H || !H.hole[i]) return;
    H.hole[i].forEach(c => wrap.appendChild(cardEl(c, mode === 'face', 'mini')));
  }
  function defaultSeatMode(i) {
    const p = S.T.players[i], H = S.H;
    if (!H || p.out || H.folded[i]) return 'none';
    if (H.shown[i]) return 'face';
    if (p.human && !S.passPlay) return 'none'; // your cards live in the dock
    return 'back';
  }

  // the dock shows the cards of the human whose turn it is (or your cards in solo play)
  function dock(i, reveal) {
    const my = $('#pk-my'), nm = $('#pk-myname'), hn = $('#pk-myhand');
    if (!my) return;
    my.innerHTML = '';
    const H = S.H, T = S.T;
    let who = i;
    if (who == null && !S.passPlay) who = T.players.findIndex(p => p.human);
    if (who == null || who < 0 || !H || !H.hole[who]) {
      nm.textContent = S.passPlay ? 'Pass and play' : (T.players.find(p => p.human) || {}).name || '';
      hn.textContent = '';
      my.appendChild(cardEl(null, false)); my.appendChild(cardEl(null, false));
      return;
    }
    const p = T.players[who];
    const show = reveal || !S.passPlay;
    H.hole[who].forEach(c => my.appendChild(cardEl(c, show)));
    nm.textContent = p.name + (p.out ? ' (out)' : H.folded[who] ? ' (folded)' : '');
    my.classList.toggle('dim', !!H.folded[who] || p.out);
    if (show && H.board.length >= 3) hn.textContent = PK.name(PK.score(H.hole[who].concat(H.board).map(PK.toInt)));
    else if (show) hn.textContent = preflopName(H.hole[who]);
    else hn.textContent = '';
  }
  function preflopName(cs) {
    const [a, b] = cs[0].r >= cs[1].r ? cs : [cs[1], cs[0]];
    if (a.r === b.r) return 'Pocket ' + RANK_PLURAL[a.r];
    return RANK[a.r] + '-' + RANK[b.r] + (a.s === b.s ? ' suited' : ' offsuit');
  }

  // ---------- the game loop ----------
  async function loop() {
    const sess = S.sess;
    while (alive(sess)) {
      const r = await playHand();
      if (!alive(sess) || r === 'end') return;
    }
  }
  const nextSeat = (i, ok) => { const n = S.T.players.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (ok(j)) return j; } return -1; };

  async function playHand() {
    const sess = S.sess, T = S.T, P = T.players, n = P.length;
    const live = i => !P[i].out;
    if (P.filter(p => !p.out).length < 2 || !P.some(p => p.human && !p.out)) return endTournament();
    T.level = Math.floor(T.hand / PER_LEVEL);
    const [sbAmt, bbAmt] = LEVELS[Math.min(T.level, LEVELS.length - 1)];
    T.bb = bbAmt;
    if (T.hand > 0) T.button = nextSeat(T.button, live);
    else if (!live(T.button)) T.button = nextSeat(T.button, live);
    Store.setGame('holdem', strip(T));
    const H = S.H = {
      deck: newShoe(1), board: [], pot: 0, cur: 0, minRaise: bbAmt, turn: -1,
      hole: new Array(n).fill(null), bet: new Array(n).fill(0), total: new Array(n).fill(0),
      folded: P.map(p => p.out), allIn: new Array(n).fill(false), shown: new Array(n).fill(false),
      startStack: P.map(p => p.stack),
    };
    clearActs(); info(); msg(T.hand > 0 && T.hand % PER_LEVEL === 0 ? 'Blinds are up: ' + sbAmt + '/' + bbAmt : '');
    $$('#pk-board .slot').forEach(s => { s.innerHTML = ''; });
    P.forEach((p, i) => { seatCards(i, 'none'); updSeat(i); });
    updPot(); dock(null);
    await sess.wait(450);

    // blinds
    const actives = P.map((p, i) => i).filter(live);
    let sb, bb;
    if (actives.length === 2) { sb = T.button; bb = nextSeat(sb, live); } else { sb = nextSeat(T.button, live); bb = nextSeat(sb, live); }
    post(sb, sbAmt); act(sb, 'SB ' + sbAmt);
    post(bb, bbAmt); act(bb, 'BB ' + bbAmt);
    H.cur = bbAmt; H.minRaise = bbAmt;
    Sound.play('chip');
    updSeat(sb); updSeat(bb); updPot();
    await sess.wait(300);

    // deal hole cards, two rounds starting left of the button
    for (let r = 0; r < 2; r++) {
      let i = T.button;
      for (let k = 0; k < actives.length; k++) {
        i = nextSeat(i, live);
        if (!H.hole[i]) H.hole[i] = [];
        H.hole[i].push(H.deck.pop());
        seatCards(i, defaultSeatMode(i));
        const cs = P[i]._el.querySelectorAll('.pcs .card');
        if (cs.length) slideFrom(cs[cs.length - 1], window.innerWidth / 2, window.innerHeight * 0.35, 260);
        Sound.play('card');
        await sess.wait(110);
      }
    }
    dock(null);
    if (!alive(sess)) return;

    // betting streets
    const first = actives.length === 2 ? sb : nextSeat(bb, live);
    await betting(first);
    for (const [cards, label] of [[3, 'Flop'], [1, 'Turn'], [1, 'River']]) {
      if (!alive(sess)) return;
      if (inHand().length < 2) break;
      await collect();
      // everyone left is all-in: turn the hands face up and run the board out
      if (canActList().length < 2 && !H.runout) { H.runout = true; revealAll(); await sess.wait(900); }
      H.deck.pop(); // burn
      for (let k = 0; k < cards; k++) {
        const c = H.deck.pop(); H.board.push(c);
        const slot = $$('#pk-board .slot')[H.board.length - 1];
        const ce = cardEl(c, false, 'mini'); slot.appendChild(ce);
        await sess.wait(60); flipCard(ce);
        await sess.wait(cards === 3 ? 160 : 260);
      }
      msg(label);
      if (!S.passPlay) dock(null);
      await sess.wait(350);
      // if nobody (or only one player) can still bet, run the board out with cards face up
      if (H.runout) { await sess.wait(500); continue; }
      H.cur = 0; H.minRaise = T.bb;
      clearActs();
      await betting(nextSeat(T.button, i => live(i) && !H.folded[i]));
    }
    if (!alive(sess)) return;
    await collect();
    await showdown();
    if (!alive(sess)) return;

    // eliminations
    const busted = P.map((p, i) => i).filter(i => !P[i].out && P[i].stack <= 0).sort((a, b) => H.startStack[b] - H.startStack[a]);
    let left = P.filter(p => !p.out).length;
    for (const i of busted.reverse()) { P[i].out = true; P[i].place = left--; }
    for (const i of busted) {
      const p = P[i];
      if (p.human) await payPrize(p);
      updSeat(i);
    }
    T.hand++;
    Store.setGame('holdem', strip(T));
    if (P.filter(p => !p.out).length < 2 || !P.some(p => p.human && !p.out)) {
      await sess.wait(1200);
      return endTournament();
    }
    // wait for a tap before the next hand
    const d = deferred();
    const b = $('#pk-btns'); b.innerHTML = '';
    $('#pk-raise').classList.add('hidden');
    b.appendChild(UI.button('Next hand', 'gold', () => d.resolve()));
    await d;
    return 'next';
  }
  function strip(T) {
    return Object.assign({}, T, { players: T.players.map(p => { const o = Object.assign({}, p); delete o._el; delete o._bet; return o; }) });
  }
  function post(i, amt) {
    const p = S.T.players[i], H = S.H;
    const a = Math.min(amt, p.stack);
    p.stack -= a; H.bet[i] += a; H.total[i] += a;
    if (p.stack === 0) H.allIn[i] = true;
  }
  const inHand = () => S.T.players.map((p, i) => i).filter(i => !S.T.players[i].out && !S.H.folded[i]);
  const canActList = () => inHand().filter(i => !S.H.allIn[i]);

  async function betting(first) {
    const sess = S.sess, H = S.H, P = S.T.players;
    let need = new Set(canActList());
    let i = first, guard = 0;
    while (need.size && inHand().length > 1 && guard++ < 300) {
      if (need.has(i)) {
        need.delete(i);
        const toCall = H.cur - H.bet[i];
        if (!(canActList().length === 1 && toCall <= 0)) {
          H.turn = i; updSeat(i);
          const a = P[i].human ? await humanAct(i) : await botAct(i);
          if (!alive(sess)) return;
          H.turn = -1;
          if (apply(i, a)) need = new Set(canActList().filter(j => j !== i));
          updSeat(i); updPot();
          await sess.wait(P[i].human ? 150 : 250);
        }
      }
      i = (i + 1) % P.length;
    }
    H.turn = -1;
  }
  // returns true when the action reopens betting
  function apply(i, a) {
    const H = S.H, p = S.T.players[i];
    const toCall = H.cur - H.bet[i];
    if (a.type === 'fold') {
      H.folded[i] = true; act(i, 'Fold', 'fold'); seatCards(i, 'none');
      Sound.play('flip');
      if (p.human && !S.passPlay) dock(null);
      return false;
    }
    if (a.type === 'check' || (a.type === 'call' && toCall <= 0)) { act(i, 'Check'); Sound.play('tap'); return false; }
    if (a.type === 'call') {
      const amt = Math.min(toCall, p.stack);
      p.stack -= amt; H.bet[i] += amt; H.total[i] += amt;
      if (!p.stack) { H.allIn[i] = true; act(i, 'All-in', 'allin'); } else act(i, 'Call ' + amt.toLocaleString());
      Sound.play('chip');
      return false;
    }
    // raise to a.to
    let to = Math.min(a.to, H.bet[i] + p.stack);
    const amt = to - H.bet[i];
    p.stack -= amt; H.bet[i] += amt; H.total[i] += amt;
    if (!p.stack) H.allIn[i] = true;
    const opened = H.cur === 0;
    if (to > H.cur) {
      const inc = to - H.cur;
      if (inc >= H.minRaise) H.minRaise = inc;
      H.cur = to;
      act(i, H.allIn[i] ? 'All-in' : (opened ? 'Bet ' : 'Raise ') + to.toLocaleString(), H.allIn[i] ? 'allin' : 'raise');
      Sound.play('chips');
      return true;
    }
    act(i, H.allIn[i] ? 'All-in' : 'Call', H.allIn[i] ? 'allin' : '');
    Sound.play('chip');
    return false;
  }
  async function collect() {
    const H = S.H, P = S.T.players;
    if (!H.bet.some(b => b > 0)) return;
    const pot = $('#pk-pot');
    P.forEach((p, i) => { if (H.bet[i] > 0) flyChip(p._bet, pot, H.bet[i]); });
    Sound.play('chips');
    await S.sess.wait(420);
    H.pot += H.bet.reduce((a, b) => a + b, 0);
    H.bet.fill(0);
    P.forEach((p, i) => updSeat(i));
    updPot();
  }
  function revealAll() {
    inHand().forEach(i => { if (!S.H.shown[i]) { S.H.shown[i] = true; seatCards(i, 'face'); } });
  }

  // ---------- showdown and side pots ----------
  function buildPots() {
    const H = S.H, P = S.T.players, n = P.length;
    const rem = H.total.slice(), pots = [];
    while (rem.some(x => x > 0)) {
      const liveIdx = [];
      for (let i = 0; i < n; i++) if (rem[i] > 0 && !H.folded[i] && !P[i].out) liveIdx.push(i);
      if (!liveIdx.length) { // leftover dead money joins the last pot
        const extra = rem.reduce((a, b) => a + b, 0);
        if (pots.length) pots[pots.length - 1].amount += extra; else pots.push({ amount: extra, elig: inHand() });
        break;
      }
      const lvl = Math.min(...liveIdx.map(i => rem[i]));
      let amount = 0;
      for (let i = 0; i < n; i++) { const t = Math.min(rem[i], lvl); amount += t; rem[i] -= t; }
      pots.push({ amount, elig: liveIdx });
    }
    // merge pots with identical eligibility
    const out = [];
    for (const p of pots) {
      const last = out[out.length - 1];
      if (last && last.elig.join() === p.elig.join()) last.amount += p.amount; else out.push(p);
    }
    return out;
  }
  async function showdown() {
    const sess = S.sess, H = S.H, T = S.T, P = T.players;
    const alive2 = inHand();
    clearActs();
    if (alive2.length === 1) {
      const w = alive2[0], amt = H.pot;
      P[w].stack += amt;
      winFx(w, amt, '');
      msg(P[w].name + ' wins ' + amt.toLocaleString());
      H.pot = 0; updPot(); updSeat(w);
      if (P[w].human) { Sound.play('win'); UI.banner(esc(P[w].name) + ' wins', amt.toLocaleString() + ' chips', 'win', 1300); }
      return;
    }
    revealAll();
    if (!S.passPlay) dock(null);
    await sess.wait(600);
    const scores = {};
    alive2.forEach(i => { scores[i] = PK.score(H.hole[i].concat(H.board).map(PK.toInt)); });
    alive2.forEach(i => act(i, PK.name(scores[i]).replace(/, .*$/, ''), 'hand'));
    const pots = buildPots();
    const won = {};
    const leftOfButton = i => (i - T.button - 1 + P.length) % P.length;
    let best = null;
    for (const pot of pots) {
      const top = Math.max(...pot.elig.map(i => scores[i]));
      const winners = pot.elig.filter(i => scores[i] === top).sort((a, b) => leftOfButton(a) - leftOfButton(b));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      winners.forEach(i => { const x = share + (odd-- > 0 ? 1 : 0); won[i] = (won[i] || 0) + x; P[i].stack += x; });
      if (!best || top > best.score) best = { score: top, winners };
    }
    H.pot = 0; updPot();
    const ws = Object.keys(won).map(Number);
    ws.forEach(i => { winFx(i, won[i], PK.name(scores[i])); updSeat(i); });
    // highlight winning hand in the message line
    const main = best.winners.map(i => P[i].name).join(' & ');
    msg(main + (best.winners.length > 1 ? ' split with ' : ' wins with ') + PK.name(best.score));
    const humanWon = ws.filter(i => P[i].human);
    if (humanWon.length) {
      Sound.play('win'); haptic('medium');
      UI.banner(humanWon.map(i => esc(P[i].name)).join(' & ') + (humanWon.length > 1 ? ' win' : ' wins'), PK.name(scores[humanWon[0]]), 'win', 1600);
    } else if (!S.passPlay && alive2.some(i => P[i].human)) Sound.play('lose');
    await sess.wait(600);
  }
  function winFx(i, amt, hand) {
    const p = S.T.players[i], w = p._el.querySelector('.pwin');
    w.textContent = '+' + amt.toLocaleString();
    w.className = 'pwin show';
    p._el.classList.add('winner');
    setTimeout(() => p._el && p._el.classList.remove('winner'), 2600);
    flyChip($('#pk-pot'), p._el.querySelector('.pav'), amt);
  }

  // ---------- human turn ----------
  async function curtain(name) {
    const d = deferred();
    const c = h('div', 'curtain', `<div class="cin"><div class="cav">${esc(name.slice(0, 1))}</div><div class="ct">${esc(name)}, your turn</div><div class="cs">Everyone else look away</div><button class="btn gold big">Show my cards</button><button class="cleave">Leave table (progress is saved)</button></div>`);
    c.querySelector('.btn').addEventListener('click', () => { Sound.unlock(); Sound.play('tap'); c.remove(); d.resolve(); });
    c.querySelector('.cleave').addEventListener('click', () => { Sound.play('tap'); c.remove(); App.lobby(); });
    $('#fx').appendChild(c);
    Sound.play('alert'); haptic('medium');
    await d;
  }
  async function humanAct(i) {
    const sess = S.sess, H = S.H, P = S.T.players, p = P[i];
    if (S.passPlay) await curtain(p.name);
    if (!alive(sess)) return { type: 'fold' };
    dock(i, true);
    const toCall = H.cur - H.bet[i];
    const maxTo = H.bet[i] + p.stack;
    const minTo = Math.min(maxTo, H.cur + Math.max(H.minRaise, S.T.bb));
    const canRaise = maxTo > H.cur && canActList().filter(j => j !== i).length > 0;
    const d = deferred();
    const b = $('#pk-btns'), rz = $('#pk-raise');
    b.innerHTML = ''; rz.classList.add('hidden');
    if (toCall > 0) b.appendChild(UI.button('Fold', 'act red', () => d.resolve({ type: 'fold' })));
    if (toCall <= 0) b.appendChild(UI.button('Check', 'act', () => d.resolve({ type: 'check' })));
    else b.appendChild(UI.button(toCall >= p.stack ? 'All-in ' + p.stack.toLocaleString() : 'Call ' + toCall.toLocaleString(), 'act', () => d.resolve({ type: 'call' })));
    if (canRaise) {
      const label = H.cur === 0 ? 'Bet' : 'Raise';
      b.appendChild(UI.button(label, 'act gold', () => openRaise()));
      const openRaise = () => {
        if (maxTo <= minTo) { d.resolve({ type: 'raise', to: maxTo }); return; }
        rz.classList.remove('hidden');
        const pot = potTotal() + toCall;
        let to = minTo;
        rz.innerHTML = `<div class="rtop"><span>${label} to</span><b id="pk-rv"></b></div><input type="range" min="${minTo}" max="${maxTo}" step="${S.T.bb >= 100 ? 10 : 5}" value="${minTo}"><div class="presets"></div>`;
        const rv = $('#pk-rv'), inp = rz.querySelector('input'), pre = rz.querySelector('.presets');
        const set = x => { to = Math.max(minTo, Math.min(maxTo, Math.round(x))); inp.value = to; rv.textContent = to >= maxTo ? 'All-in ' + to.toLocaleString() : to.toLocaleString(); };
        inp.addEventListener('input', () => { set(+inp.value); if (+inp.value >= maxTo - 5) set(maxTo); });
        [['Min', minTo], ['½ Pot', H.cur + pot / 2], ['¾ Pot', H.cur + pot * 0.75], ['Pot', H.cur + pot], ['All-in', maxTo]].forEach(([l, x]) => {
          const pb = h('button', '', l);
          pb.addEventListener('click', () => { Sound.play('tap'); set(x); });
          pre.appendChild(pb);
        });
        set(minTo);
        b.innerHTML = '';
        b.appendChild(UI.button('Back', 'act ghost', () => { rz.classList.add('hidden'); humanButtons(); }));
        b.appendChild(UI.button('Confirm', 'act gold', () => d.resolve({ type: 'raise', to })));
      };
      const humanButtons = () => {
        b.innerHTML = '';
        if (toCall > 0) b.appendChild(UI.button('Fold', 'act red', () => d.resolve({ type: 'fold' })));
        if (toCall <= 0) b.appendChild(UI.button('Check', 'act', () => d.resolve({ type: 'check' })));
        else b.appendChild(UI.button(toCall >= p.stack ? 'All-in ' + p.stack.toLocaleString() : 'Call ' + toCall.toLocaleString(), 'act', () => d.resolve({ type: 'call' })));
        b.appendChild(UI.button(label, 'act gold', () => openRaise()));
      };
    }
    Sound.play('alert');
    const a = await d;
    b.innerHTML = ''; rz.classList.add('hidden');
    if (S.passPlay) dock(null);
    return a;
  }

  // ---------- bots ----------
  async function botAct(i) {
    const sess = S.sess;
    const t0 = performance.now();
    const a = decide(i);
    const spent = performance.now() - t0;
    await sess.wait(Math.max(0, 450 + Math.random() * 650 - spent));
    return a;
  }
  function decide(i) {
    const H = S.H, T = S.T, p = T.players[i], B = p.bot, D = DIFF[T.diff] || DIFF.sharp;
    const toCall = H.cur - H.bet[i];
    const opp = inHand().length - 1;
    const hole = H.hole[i].map(PK.toInt), board = H.board.map(PK.toInt);
    let eq = PK.equity(hole, board, Math.max(1, opp), D.iters);
    const pot = potTotal();
    // respect big bets: a raise usually means a real hand
    if (toCall > 0) eq -= D.read * Math.min(1, toCall / Math.max(1, pot));
    const rel = eq * (opp + 1);
    const noise = (Math.random() - 0.5) * D.noise;
    const r = Math.random();
    const bb = T.bb, stack = p.stack, maxTo = H.bet[i] + stack;
    const minTo = H.cur + Math.max(H.minRaise, bb);
    const raiseTo = x => {
      let to = Math.max(minTo, Math.round(x / 5) * 5);
      if (to >= maxTo * 0.8) to = maxTo;
      return { type: 'raise', to: Math.min(to, maxTo) };
    };
    const callOrCheck = () => toCall > 0 ? { type: 'call' } : { type: 'check' };
    const fold = () => toCall > 0 ? { type: 'fold' } : { type: 'check' };
    const othersCanAct = canActList().filter(j => j !== i).length > 0;
    const canRaise = othersCanAct && maxTo > H.cur;

    if (!H.board.length) {
      const playT = 1.12 + B.tight * 0.45 + noise;
      const raiseT = 1.7 + B.tight * 0.3 - B.aggr * 0.25 + noise;
      const facing = Math.max(1, toCall / bb);
      // short stack: push or fold
      if (stack <= bb * 10) {
        if (rel > playT + 0.05 || (toCall === 0 && rel > playT - 0.2)) return canRaise ? { type: 'raise', to: maxTo } : callOrCheck();
        return fold();
      }
      if (toCall <= 0) {
        if (canRaise && rel > raiseT && r < 0.55 + B.aggr * 0.4) return raiseTo(H.cur + bb * (2 + Math.random() * 1.5));
        return { type: 'check' };
      }
      const big = toCall > stack * 0.4;
      if (canRaise && rel > raiseT + 0.3 * Math.log2(facing) && r < 0.35 + B.aggr * 0.5) return raiseTo(H.cur * (2.5 + Math.random()) + H.pot * 0.3);
      const need = playT + 0.26 * Math.log2(facing) + (big ? 0.35 : 0);
      if (rel > need) return { type: 'call' };
      if (toCall <= bb / 2 && rel > playT - 0.25) return { type: 'call' };
      return { type: 'fold' };
    }
    const strong = eq > 0.64 + B.tight * 0.08 + noise * 0.2 || rel > 2.1 + noise;
    const medium = rel > 1.15 + B.tight * 0.3 + noise;
    const late = H.board.length >= 4;
    if (toCall <= 0) {
      if (canRaise && strong && r < 0.5 + B.aggr * 0.45) return raiseTo(pot * (0.5 + Math.random() * 0.45));
      if (canRaise && medium && r < B.aggr * 0.35) return raiseTo(pot * 0.5);
      if (canRaise && opp <= 2 && r < B.bluff * (late ? 0.3 : 0.18)) return raiseTo(pot * (0.45 + Math.random() * 0.3));
      return { type: 'check' };
    }
    const potOdds = toCall / (pot + toCall);
    const margin = 0.02 + B.tight * 0.07 + noise * 0.1;
    if (canRaise && strong && r < 0.2 + B.aggr * 0.5) return raiseTo(H.cur + Math.max(H.minRaise, (pot + toCall) * (0.6 + Math.random() * 0.4)));
    if (eq > potOdds + margin) return { type: 'call' };
    if (canRaise && opp === 1 && r < B.bluff * 0.07) return raiseTo(H.cur * 2.5 + pot * 0.3);
    if (toCall <= bb && eq > 0.18 && r < 0.6) return { type: 'call' };
    return { type: 'fold' };
  }

  // ---------- prizes and tournament end ----------
  async function payPrize(p) {
    const T = S.T, pays = payTable(T.players.length);
    const prize = p.place <= pays.length ? Math.round(T.pool * pays[p.place - 1]) : 0;
    if (T.paid[p.pid]) return;
    T.paid[p.pid] = true;
    const prof = Store.byId(p.pid);
    if (prize && prof) { Bank.pay('holdem', prize, prof); Bank.record(prize - BUYIN, prof); } else if (prof) Bank.record(-BUYIN, prof);
    const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th'][p.place - 1];
    if (p.place > 1) {
      await UI.modal({
        title: esc(p.name) + ' finishes ' + ord,
        body: `<p class="lead">${prize ? 'Cashed for <b>' + fmt(prize) + '</b>.' : 'Out of the money this time.'}</p>`,
        buttons: [{ label: 'Continue', value: true, cls: 'gold' }], dismiss: false,
      });
    }
  }
  async function endTournament() {
    const T = S.T, P = T.players;
    const left = P.filter(p => !p.out);
    if (left.length === 1) { left[0].place = 1; }
    for (const p of P) if (p.human && !p.out && left.length === 1) await payPrize(p);
    Store.setGame('holdem', null);
    const champ = left.length === 1 ? left[0] : null;
    const pays = payTable(P.length);
    const rows = P.filter(p => p.place).sort((a, b) => a.place - b.place).map(p => {
      const prize = p.place <= pays.length ? Math.round(T.pool * pays[p.place - 1]) : 0;
      return `<div class="frow${p.human ? ' me' : ''}"><span>${p.place}</span><span>${esc(p.name)}</span><b>${prize ? fmt(prize) : ''}</b></div>`;
    }).join('');
    if (champ && champ.human) { Sound.play('big'); UI.confetti(90); }
    const again = await UI.modal({
      title: champ ? (champ.human ? esc(champ.name) + ' wins the tournament!' : esc(champ.name) + ' wins the tournament') : 'Tournament over',
      body: `<div class="final">${rows}</div>`,
      buttons: [{ label: 'Lobby', value: false }, { label: 'Play again', value: true, cls: 'gold' }], dismiss: false,
    });
    if (!S) return 'end';
    if (again) setup(); else App.lobby();
    return 'end';
  }
})();
