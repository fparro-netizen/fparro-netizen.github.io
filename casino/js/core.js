'use strict';
/* Gilded Ace Casino: shared core (storage, bankroll, sound, haptics, cards, chips, poker evaluator, UI helpers). */

// ---------- dom helpers ----------
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function fmt(n) {
  n = Math.round(n);
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
}
function fmtShort(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K';
  return String(n);
}
// fair randomness for shuffles and spins
const _rb = new Uint32Array(1);
function rand() { crypto.getRandomValues(_rb); return _rb[0] / 4294967296; }
function randInt(n) { return Math.floor(rand() * n); }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ---------- storage ----------
const START_BANK = 5000, TOPUP = 1000;
const Store = {
  KEY: 'gilded-ace.v1',
  d: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) {}
    if (!d || !Array.isArray(d.players)) d = { players: [], current: null, settings: {} };
    d.settings = Object.assign({ sound: true, fast: false, hints: true }, d.settings || {});
    this.d = d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },
  get settings() { return this.d.settings; },
  get player() { return this.d.players.find(p => p.id === this.d.current) || null; },
  byId(id) { return this.d.players.find(p => p.id === id) || null; },
  addPlayer(name) {
    const p = { id: 'p' + Date.now().toString(36) + randInt(1e6).toString(36), name, bank: START_BANK, invested: START_BANK, best: 0, hands: 0, net: {} };
    this.d.players.push(p);
    this.save();
    return p;
  },
  removePlayer(id) {
    this.d.players = this.d.players.filter(p => p.id !== id);
    if (this.d.current === id) this.d.current = null;
    this.save();
  },
  use(id) { this.d.current = id; this.save(); },
  getGame(key) { return (this.d.games || {})[key]; },
  setGame(key, v) { this.d.games = this.d.games || {}; if (v == null) delete this.d.games[key]; else this.d.games[key] = v; this.save(); },
};

// ---------- bankroll ----------
const Bank = {
  get value() { const p = Store.player; return p ? p.bank : 0; },
  can(n, p) { p = p || Store.player; return !!p && p.bank >= n; },
  take(game, n, p) {
    p = p || Store.player; if (!p || n <= 0) return;
    p.bank -= n; p.net[game] = (p.net[game] || 0) - n;
    Store.save(); UI.bank();
  },
  pay(game, n, p) {
    p = p || Store.player; if (!p || n <= 0) return;
    p.bank += n; p.net[game] = (p.net[game] || 0) + n;
    Store.save(); UI.bank(true);
  },
  record(profit, p) {
    p = p || Store.player; if (!p) return;
    p.hands++; if (profit > p.best) p.best = profit;
    Store.save();
  },
  topUp(p) {
    p = p || Store.player; if (!p) return;
    p.bank += TOPUP; p.invested += TOPUP;
    Store.save(); UI.bank(true);
  },
};

// ---------- sessions: timers that die when you leave a game ----------
function speed() { return Store.settings.fast ? 0.55 : 1; }
class Session {
  constructor() { this.alive = true; this.timers = new Set(); }
  wait(ms) {
    return new Promise(res => {
      if (!this.alive) return;
      const t = setTimeout(() => { this.timers.delete(t); if (this.alive) res(); }, ms * speed());
      this.timers.add(t);
    });
  }
  end() { this.alive = false; this.timers.forEach(clearTimeout); this.timers.clear(); }
}
// a promise you resolve from a button
function deferred() { let r; const p = new Promise(x => { r = x; }); p.resolve = r; return p; }

// ---------- haptics (Android vibrate; iOS 18+ via the native switch control) ----------
function haptic(kind) {
  if (!Store.settings.sound) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(kind === 'heavy' ? [18, 30, 24] : kind === 'medium' ? 14 : 8); return; }
    const w = $('#haptic-wrap'); if (w) w.click();
  } catch (e) {}
}

// ---------- sound: everything synthesized, nothing to download ----------
const Sound = {
  ctx: null, out: null, noise: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.out = ctx.createGain(); this.out.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      this.out.connect(comp); comp.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.6);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  ok() { return Store.settings.sound && this.ctx && this.ctx.state === 'running'; },
  tone(f, dur, type, vol, when, slide) {
    const c = this.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  },
  hiss(dur, f, q, vol, when, f2) {
    const c = this.ctx, t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); bp.Q.value = q || 1;
    if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.ok()) return;
    try {
      switch (name) {
        case 'tap': this.tone(1100, 0.05, 'sine', 0.07); break;
        case 'chip':
          this.hiss(0.035, 3800, 5, 0.5); this.tone(2600, 0.03, 'triangle', 0.05);
          this.hiss(0.03, 5200, 6, 0.35, 0.05); break;
        case 'chips': for (let i = 0; i < 5; i++) this.hiss(0.03, 3400 + Math.random() * 2200, 5, 0.35, i * 0.045 + Math.random() * 0.02); break;
        case 'card': this.hiss(0.09, 1800, 0.8, 0.32, 0, 5000); break;
        case 'flip': this.hiss(0.05, 2600, 1.2, 0.3); this.tone(900, 0.03, 'triangle', 0.04, 0.02); break;
        case 'shuffle': for (let i = 0; i < 14; i++) this.hiss(0.04, 2000 + Math.random() * 2500, 1, 0.18, i * 0.035); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.16, i * 0.09)); break;
        case 'big':
          [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.16, i * 0.1));
          for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 2000, 0.12, 'sine', 0.05, 0.4 + i * 0.08);
          break;
        case 'lose': this.tone(330, 0.22, 'sine', 0.12, 0, 260); this.tone(247, 0.4, 'sine', 0.13, 0.18, 190); break;
        case 'push': this.tone(587, 0.12, 'triangle', 0.1); this.tone(587, 0.16, 'triangle', 0.1, 0.15); break;
        case 'tick': this.hiss(0.012, 4200, 3, 0.25); break;
        case 'thunk': this.tone(150, 0.14, 'sine', 0.3, 0, 70); this.hiss(0.03, 1500, 1, 0.15); break;
        case 'dice': for (let i = 0; i < 9; i++) this.hiss(0.025, 1200 + Math.random() * 1800, 2, 0.35, i * 0.06 + Math.random() * 0.03); break;
        case 'alert': this.tone(880, 0.12, 'sine', 0.1); this.tone(1175, 0.18, 'sine', 0.1, 0.12); break;
      }
    } catch (e) {}
  },
};

// ---------- cards ----------
const SUIT = ['♠︎', '♥︎', '♦︎', '♣︎']; // text presentation, never emoji
const RANK = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const RANK_PLURAL = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
const PIPS = {
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[30, 18], [70, 18], [30, 82], [70, 82]],
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 28], [30, 39], [70, 39], [30, 61], [70, 61], [50, 72], [30, 84], [70, 84]],
};
function newDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}
function newShoe(decks) {
  let d = [];
  for (let i = 0; i < decks; i++) d = d.concat(newDeck());
  return shuffle(d);
}
function cardFace(c) {
  const red = c.s === 1 || c.s === 2, s = SUIT[c.s], r = RANK[c.r];
  let mid;
  if (c.r <= 10) mid = PIPS[c.r].map(([x, y]) => `<i style="left:${x}%;top:${y}%"${y > 55 ? ' class="u"' : ''}>${s}</i>`).join('');
  else if (c.r === 14) mid = `<i class="ace">${s}</i>`;
  else mid = `<div class="face"><b>${r}</b><span>${s}</span></div>`;
  return `<div class="cf${red ? ' red' : ''}"><div class="cn tl"><b>${r}</b><i>${s}</i></div><div class="mid">${mid}</div><div class="cn br"><b>${r}</b><i>${s}</i></div><div class="sm"><b>${r}</b><i>${s}</i></div></div>`;
}
function cardEl(c, faceUp, extra) {
  const d = h('div', 'card' + (faceUp === false ? ' down' : '') + (extra ? ' ' + extra : ''));
  d.innerHTML = `<div class="ci">${c ? cardFace(c) : '<div class="cf"></div>'}<div class="cbk"></div></div>`;
  d._card = c;
  return d;
}
function flipCard(el, c) {
  if (c && el._card !== c) { el.querySelector('.cf').outerHTML = cardFace(c); el._card = c; }
  el.classList.remove('down');
  Sound.play('flip');
}
// slide a freshly placed element in from a point on screen (the shoe)
function slideFrom(el, x, y, ms) {
  const r = el.getBoundingClientRect();
  if (!r.width || !el.animate) return;
  const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
  el.animate([
    { transform: `translate(${dx}px,${dy}px) rotate(-22deg) scale(.75)`, opacity: 0.4 },
    { transform: 'none', opacity: 1 },
  ], { duration: (ms || 380) * speed(), easing: 'cubic-bezier(.18,.8,.25,1)' });
}
function shoePoint() { return { x: window.innerWidth - 30, y: 70 }; }

// ---------- chips ----------
const DENOMS = [5, 25, 100, 500, 1000];
const ALL_DENOMS = [5000, 1000, 500, 100, 25, 5, 1];
function chipEl(v, cls) {
  const c = h('div', 'chip c' + v + (cls ? ' ' + cls : ''));
  c.innerHTML = `<span>${fmtShort(v)}</span>`;
  return c;
}
function splitChips(n) {
  const out = [];
  for (const d of ALL_DENOMS) { while (n >= d && out.length < 40) { out.push(d); n -= d; } }
  return out;
}
// a small stack of chips plus a label showing the amount
function chipStack(n, cls) {
  const w = h('div', 'stack' + (cls ? ' ' + cls : ''));
  if (n <= 0) return w;
  const chips = splitChips(n).reverse().slice(-6);
  chips.forEach((v, i) => { const c = chipEl(v); c.style.setProperty('--i', i); w.appendChild(c); });
  const lab = h('div', 'amt', fmtShort(n));
  w.appendChild(lab);
  return w;
}
class ChipRack {
  constructor(parent, opts) {
    this.opts = opts || {};
    this.value = this.opts.value || 25;
    this.el = h('div', 'rack');
    for (const v of (this.opts.denoms || DENOMS)) {
      const c = chipEl(v, 'pick');
      c.dataset.v = v;
      c.addEventListener('click', () => { Sound.unlock(); Sound.play('chip'); haptic(); this.select(v); });
      this.el.appendChild(c);
    }
    parent.appendChild(this.el);
    this.select(this.value);
  }
  select(v) {
    this.value = v;
    $$('.chip', this.el).forEach(c => c.classList.toggle('on', +c.dataset.v === v));
  }
  refresh(limit) {
    const bank = limit != null ? limit : Bank.value;
    $$('.chip', this.el).forEach(c => c.classList.toggle('off', +c.dataset.v > bank));
    if (this.value > bank) {
      const ok = (this.opts.denoms || DENOMS).filter(v => v <= bank);
      if (ok.length) this.select(ok[ok.length - 1]);
    }
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
}
// animate a chip flying between two elements
function flyChip(from, to, v, delay) {
  return new Promise(res => {
    const a = from.getBoundingClientRect ? from.getBoundingClientRect() : from;
    const b = to.getBoundingClientRect ? to.getBoundingClientRect() : to;
    const c = chipEl(splitChips(v)[0] || 5, 'fly');
    document.body.appendChild(c);
    const ax = a.left + a.width / 2 - 16, ay = a.top + a.height / 2 - 16;
    const bx = b.left + b.width / 2 - 16, by = b.top + b.height / 2 - 16;
    c.style.left = ax + 'px'; c.style.top = ay + 'px';
    const an = c.animate([
      { transform: 'translate(0,0) scale(.9)', opacity: 0 },
      { transform: `translate(${(bx - ax) * 0.1}px,${(by - ay) * 0.1}px) scale(1)`, opacity: 1, offset: 0.1 },
      { transform: `translate(${bx - ax}px,${by - ay}px) scale(.85)`, opacity: 1 },
    ], { duration: 480 * speed(), delay: (delay || 0) * speed(), easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' });
    an.onfinish = () => { c.remove(); res(); };
  });
}
function flyChips(from, to, amount, count) {
  const n = Math.min(count || 3, Math.max(1, Math.ceil(amount / 100)));
  const ps = [];
  for (let i = 0; i < n; i++) ps.push(flyChip(from, to, amount, i * 70));
  setTimeout(() => Sound.play('chips'), 300 * speed());
  return Promise.all(ps);
}

// ---------- poker hand evaluation (used by Hold'em and Video Poker) ----------
// card int = rank * 4 + suit, rank 2..14
const PK = (() => {
  const cnt = new Int8Array(15), sc = new Int8Array(4), sm = new Int32Array(4);
  function sHigh(m) {
    if (m & (1 << 14)) m |= 2;
    for (let hi = 14; hi >= 5; hi--) { const x = 0x1f << (hi - 4); if ((m & x) === x) return hi; }
    return 0;
  }
  function topBits(m, k, ex1, ex2) {
    let v = 0, n = 0;
    for (let r = 14; r >= 2 && n < k; r--) if ((m & (1 << r)) && r !== ex1 && r !== ex2) { v = (v << 4) | r; n++; }
    while (n < k) { v <<= 4; n++; }
    return v;
  }
  function score(cards, n) {
    n = n || cards.length;
    cnt.fill(0); sc.fill(0); sm.fill(0);
    let mask = 0;
    for (let i = 0; i < n; i++) { const c = cards[i], r = c >> 2, s = c & 3; cnt[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r; }
    let fm = 0;
    for (let s = 0; s < 4; s++) if (sc[s] >= 5) { const sh = sHigh(sm[s]); if (sh) return (8 << 20) | (sh << 16); fm = sm[s]; }
    let q = 0, t1 = 0, t2 = 0, p1 = 0, p2 = 0;
    for (let r = 14; r >= 2; r--) {
      const k = cnt[r];
      if (k === 4) q = r;
      else if (k === 3) { if (!t1) t1 = r; else if (!t2) t2 = r; }
      else if (k === 2) { if (!p1) p1 = r; else if (!p2) p2 = r; }
    }
    if (q) return (7 << 20) | (q << 16) | (topBits(mask, 1, q) << 12);
    if (t1 && (t2 || p1)) return (6 << 20) | (t1 << 16) | ((t2 > p1 ? t2 : p1) << 12);
    if (fm) return (5 << 20) | topBits(fm, 5);
    const sh = sHigh(mask);
    if (sh) return (4 << 20) | (sh << 16);
    if (t1) return (3 << 20) | (t1 << 16) | (topBits(mask, 2, t1) << 8);
    if (p1 && p2) return (2 << 20) | (p1 << 16) | (p2 << 12) | (topBits(mask, 1, p1, p2) << 8);
    if (p1) return (1 << 20) | (p1 << 16) | (topBits(mask, 3, p1) << 4);
    return topBits(mask, 5);
  }
  const CAT = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  function name(sc) {
    const cat = sc >> 20, a = (sc >> 16) & 15, b = (sc >> 12) & 15;
    switch (cat) {
      case 8: return a === 14 ? 'Royal Flush' : 'Straight Flush, ' + RANK_NAME[a] + ' high';
      case 7: return 'Four ' + RANK_PLURAL[a];
      case 6: return 'Full House, ' + RANK_PLURAL[a] + ' over ' + RANK_PLURAL[b];
      case 5: return 'Flush, ' + RANK_NAME[a] + ' high';
      case 4: return 'Straight, ' + RANK_NAME[a] + ' high';
      case 3: return 'Three ' + RANK_PLURAL[a];
      case 2: return 'Two Pair, ' + RANK_PLURAL[a] + ' and ' + RANK_PLURAL[b];
      case 1: return 'Pair of ' + RANK_PLURAL[a];
      default: return RANK_NAME[a] + ' high';
    }
  }
  const toInt = c => c.r * 4 + c.s;
  // Monte Carlo equity: share of pots won against n random opponent hands
  function equity(hole, board, nOpp, iters) {
    const used = new Set(hole.concat(board)), deck = [];
    for (let c = 8; c < 60; c++) if (!used.has(c)) deck.push(c);
    const need = 5 - board.length, draw = need + nOpp * 2;
    const mine = new Array(7), opp = new Array(7);
    for (let i = 0; i < board.length; i++) { mine[i + 2] = board[i]; opp[i + 2] = board[i]; }
    mine[0] = hole[0]; mine[1] = hole[1];
    let won = 0;
    const L = deck.length;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < draw; i++) { const j = i + ((Math.random() * (L - i)) | 0); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      for (let i = 0; i < need; i++) { mine[2 + board.length + i] = deck[i]; opp[2 + board.length + i] = deck[i]; }
      const my = score(mine, 7);
      let best = 0, ties = 0, lost = false;
      for (let o = 0; o < nOpp; o++) {
        opp[0] = deck[need + o * 2]; opp[1] = deck[need + o * 2 + 1];
        const s = score(opp, 7);
        if (s > my) { lost = true; break; }
        if (s === my) ties++;
        if (s > best) best = s;
      }
      if (!lost) won += 1 / (ties + 1);
    }
    return won / iters;
  }
  return { score, name, equity, toInt, cat: sc => sc >> 20 };
})();

// ---------- UI helpers ----------
const UI = {
  _shown: null,
  bank(up) {
    const e = $('#bank-amt'); if (!e) return;
    const v = Bank.value;
    if (this._shown == null || !e.animate) { e.textContent = fmt(v); this._shown = v; return; }
    const from = this._shown, to = v, t0 = performance.now(), dur = 500;
    this._shown = v;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), val = from + (to - from) * (1 - Math.pow(1 - k, 3));
      e.textContent = fmt(val);
      if (k < 1 && this._shown === to) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (up && to > from) { const pill = $('#bank'); pill.classList.remove('up'); void pill.offsetWidth; pill.classList.add('up'); }
  },
  // big centered result banner
  banner(title, sub, kind, ms) {
    const root = $('#fx');
    const b = h('div', 'banner ' + (kind || ''), `<div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`);
    root.appendChild(b);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, (ms || 1500) * speed());
  },
  toast(msg, ms) {
    const root = $('#fx');
    const t = h('div', 'toast', msg);
    root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms || 1800);
  },
  // modal dialog; resolves with the chosen button's value
  modal(opts) {
    return new Promise(res => {
      const back = h('div', 'modal-back');
      const m = h('div', 'modal' + (opts.cls ? ' ' + opts.cls : ''));
      if (opts.title) m.appendChild(h('h2', '', opts.title));
      const body = h('div', 'mbody');
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      m.appendChild(body);
      const row = h('div', 'mbtns');
      (opts.buttons || [{ label: 'OK', value: true, cls: 'gold' }]).forEach(b => {
        const btn = h('button', 'btn ' + (b.cls || ''), b.label);
        btn.addEventListener('click', () => { Sound.play('tap'); close(b.value); });
        row.appendChild(btn);
      });
      m.appendChild(row);
      back.appendChild(m);
      const close = v => { back.classList.add('out'); setTimeout(() => back.remove(), 220); res(v); };
      if (opts.dismiss !== false) back.addEventListener('click', e => { if (e.target === back) close(null); });
      $('#fx').appendChild(back);
      if (opts.onOpen) opts.onOpen(m, close);
    });
  },
  confetti(n) {
    const root = $('#fx');
    const cols = ['#f3d77a', '#d4af37', '#fff3c4', '#e94b5b', '#4cc38a', '#6aa9ff'];
    for (let i = 0; i < (n || 60); i++) {
      const p = h('i', 'confetti');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      p.style.setProperty('--x', ((Math.random() - 0.5) * 140) + 'px');
      p.style.setProperty('--r', (Math.random() * 900) + 'deg');
      root.appendChild(p);
      setTimeout(() => p.remove(), 3800);
    }
  },
  // standard button row used by table games
  button(label, cls, fn) {
    const b = h('button', 'btn ' + (cls || ''), label);
    b.addEventListener('click', e => { if (b.disabled) return; Sound.unlock(); Sound.play('tap'); haptic(); fn(e); });
    return b;
  },
};

// game registry
const Games = { list: [], add(g) { this.list.push(g); }, get(id) { return this.list.find(g => g.id === id); } };
