'use strict';
/* Gilded Ace Casino: lobby, players, settings and routing. */
const CACHE_NAME = 'gilded-ace-v1', CACHE_COUNT = 16; // keep in step with sw.js

const App = {
  game: null, sess: null,

  init() {
    Store.load();
    document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
    $('#btn-back').addEventListener('click', () => { Sound.play('tap'); this.leave(); });
    $('#btn-help').addEventListener('click', () => { Sound.play('tap'); this.help(); });
    $('#bank').addEventListener('click', () => { Sound.play('tap'); this.cashier(); });
    // stop iOS double-tap zoom and rubber-band scrolling on the tables
    let last = 0;
    document.addEventListener('touchend', e => { const t = Date.now(); if (t - last < 320 && !e.target.closest('input,textarea')) e.preventDefault(); last = t; }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    if (!Store.player) this.lobby(true); else this.lobby();
    this.offline();
  },

  // ---------- lobby ----------
  lobby(ask) {
    this.unmount();
    document.body.dataset.screen = 'lobby';
    $('#title').textContent = '';
    const v = $('#view');
    v.className = 'lobby';
    v.innerHTML = '';
    const p = Store.player;
    const hero = h('section', 'hero', `
      <div class="logo"><div class="ace">A<span>${SUIT[0]}</span></div><div><div class="lt">The Gilded Ace</div><div class="ls">Casino &amp; Card Club</div></div></div>`);
    v.appendChild(hero);
    if (p) {
      const net = p.bank - p.invested;
      const card = h('section', 'pcard', `
        <div class="av">${p.name.slice(0, 1).toUpperCase()}</div>
        <div class="pi"><div class="pn">${esc(p.name)}</div><div class="pnet ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmt(net)} tonight</div></div>
        <div class="pb"><div class="pbl">Bankroll</div><div class="pbv">${fmt(p.bank)}</div></div>`);
      card.addEventListener('click', () => { Sound.play('tap'); this.players(); });
      v.appendChild(card);
    }
    const st = h('div', 'status', '');
    st.id = 'status';
    v.appendChild(st);
    this.status();

    const grid = h('section', 'tiles');
    Games.list.forEach(g => {
      const t = h('button', 'tile t-' + g.id, `<div class="art">${g.art}</div><div class="tn">${g.name}</div><div class="tt">${g.tag}</div>`);
      t.addEventListener('click', () => { Sound.unlock(); Sound.play('tap'); haptic(); this.open(g.id); });
      grid.appendChild(t);
    });
    v.appendChild(grid);

    if (Store.d.players.length) {
      const lb = h('section', 'board', '<h3>Tonight\'s Standings</h3>');
      const rows = Store.d.players.slice().sort((a, b) => (b.bank - b.invested) - (a.bank - a.invested));
      rows.forEach((q, i) => {
        const net = q.bank - q.invested;
        lb.appendChild(h('div', 'lrow' + (q.id === Store.d.current ? ' me' : ''), `<span class="lp">${i + 1}</span><span class="ln">${esc(q.name)}</span><span class="lv">${fmt(q.bank)}</span><span class="lnet ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`));
      });
      lb.appendChild(h('div', 'note', 'Pass the phone: each player keeps a separate bankroll on this device. Tap your name above to switch.'));
      v.appendChild(lb);
    }

    const set = h('section', 'settings', '<h3>Settings</h3>');
    const toggle = (key, label, sub) => {
      const r = h('label', 'srow', `<span><b>${label}</b><small>${sub}</small></span><input type="checkbox" ${Store.settings[key] ? 'checked' : ''}>`);
      r.querySelector('input').addEventListener('change', e => { Store.settings[key] = e.target.checked; Store.save(); Sound.unlock(); Sound.play('tap'); });
      set.appendChild(r);
    };
    toggle('sound', 'Sound and haptics', 'Chips, cards and wheel sounds');
    toggle('fast', 'Fast dealing', 'Speeds up every animation');
    toggle('hints', 'Strategy coach', 'Blackjack basic-strategy tips');
    const btns = h('div', 'srow2');
    btns.appendChild(UI.button('Cashier', 'ghost', () => this.cashier()));
    btns.appendChild(UI.button('Players', 'ghost', () => this.players()));
    btns.appendChild(UI.button('Install help', 'ghost', () => this.installHelp()));
    set.appendChild(btns);
    v.appendChild(set);
    v.appendChild(h('div', 'foot', 'For entertainment only. Play money, no real wagering.'));
    v.scrollTop = 0;
    UI._shown = null; UI.bank();
    if (ask) setTimeout(() => this.players(true), 250);
  },

  status() {
    const st = $('#status'); if (!st) return;
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
    const ready = this._ready;
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      st.innerHTML = '<b>Install for offline play:</b> tap the Share button, then <b>Add to Home Screen</b>. Open it from the home screen once while online.';
      st.className = 'status warn';
      st.onclick = () => this.installHelp();
    } else if (ready) {
      st.innerHTML = '<span class="dot"></span> Ready to play offline';
      st.className = 'status ok';
      st.onclick = null;
    } else {
      st.innerHTML = '<span class="dot"></span> Saving games for offline play...';
      st.className = 'status';
      st.onclick = null;
    }
  },

  offline() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
      const check = () => caches.has(CACHE_NAME).then(has => {
        if (!has) return setTimeout(check, 800);
        caches.open(CACHE_NAME).then(c => c.keys()).then(keys => {
          if (keys.length >= CACHE_COUNT) { this._ready = true; this.status(); } else setTimeout(check, 800);
        });
      });
      check();
    }).catch(() => {});
  },

  // ---------- players ----------
  players(first) {
    const body = h('div', 'plist');
    const list = Store.d.players;
    let close;
    const pick = id => { Store.use(id); close(true); this.lobby(); };
    if (list.length) {
      list.forEach(q => {
        const r = h('div', 'prow' + (q.id === Store.d.current ? ' on' : ''), `<div class="av">${esc(q.name.slice(0, 1).toUpperCase())}</div><div class="pi"><b>${esc(q.name)}</b><small>${fmt(q.bank)}</small></div><button class="x" aria-label="Remove">&times;</button>`);
        r.addEventListener('click', e => {
          if (e.target.closest('.x')) {
            e.stopPropagation();
            UI.modal({ title: 'Remove ' + esc(q.name) + '?', body: 'Their bankroll and stats on this phone will be deleted.', buttons: [{ label: 'Cancel', value: false }, { label: 'Remove', value: true, cls: 'red' }] })
              .then(ok => { if (ok) { Store.removePlayer(q.id); close(true); this.lobby(!Store.player); } });
            return;
          }
          Sound.play('tap'); pick(q.id);
        });
        body.appendChild(r);
      });
    }
    const add = h('div', 'padd', `<input type="text" maxlength="14" placeholder="${list.length ? 'Add a player' : 'Your name'}" autocomplete="off" autocorrect="off">`);
    const quick = h('div', 'pquick');
    ['Frank', 'Anna'].filter(n => !list.some(q => q.name.toLowerCase() === n.toLowerCase())).forEach(n => {
      const b = UI.button(n, 'ghost', () => { const p = Store.addPlayer(n); pick(p.id); });
      quick.appendChild(b);
    });
    const go = UI.button('Add', 'gold', () => {
      const n = add.querySelector('input').value.trim();
      if (!n) return;
      const p = Store.addPlayer(n); pick(p.id);
    });
    add.appendChild(go);
    body.appendChild(add);
    if (quick.children.length) body.appendChild(quick);
    UI.modal({
      title: first ? 'Welcome to the club' : 'Who\'s playing?',
      body: (first ? '<p class="lead">Every player starts with a $5,000 bankroll. Pick your name.</p>' : ''),
      buttons: first ? [] : [{ label: 'Done', value: true }],
      dismiss: !first,
      onOpen: (m, c) => { close = c; m.querySelector('.mbody').appendChild(body); },
    });
  },

  cashier() {
    const p = Store.player; if (!p) return;
    UI.modal({
      title: 'Cashier',
      body: `<p class="lead">Bankroll <b>${fmt(p.bank)}</b>. Buy in for another ${fmt(TOPUP)}? It counts against your standings.</p>`,
      buttons: [{ label: 'Not now', value: false }, { label: 'Add ' + fmt(TOPUP), value: true, cls: 'gold' }],
    }).then(ok => {
      if (!ok) return;
      Bank.topUp(); Sound.play('chips');
      if (this.game && this.game.onBank) this.game.onBank();
      if (!this.game) this.lobby();
    });
  },

  installHelp() {
    UI.modal({
      title: 'Play offline on iPhone',
      body: `<ol class="steps">
        <li>Open this page in <b>Safari</b> while you still have internet.</li>
        <li>Tap the <b>Share</b> button (square with an arrow), then <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open <b>Gilded Ace</b> from your home screen and wait for the green <b>Ready to play offline</b> line in the lobby.</li>
        <li>Test it: turn on Airplane Mode and open it again. Everything runs on the phone.</li>
      </ol>
      <p class="lead">Two players, one phone: Texas Hold'em has a pass-and-play mode with a privacy screen, and every player keeps a separate bankroll.</p>`,
    });
  },

  // ---------- routing ----------
  open(id) {
    const g = Games.get(id); if (!g) return;
    if (!Store.player) return this.players(true);
    this.unmount();
    document.body.dataset.screen = 'game';
    $('#title').textContent = g.name;
    const v = $('#view');
    v.className = 'game g-' + id;
    v.innerHTML = '';
    this.game = g;
    this.sess = new Session();
    g.mount(v, this.sess);
  },
  leave() {
    if (this.game && this.game.canLeave && !this.game.canLeave()) return;
    this.lobby();
  },
  unmount() {
    if (this.sess) this.sess.end();
    if (this.game && this.game.unmount) this.game.unmount();
    this.game = null; this.sess = null;
    $$('#fx > *').forEach(e => { if (!e.classList.contains('modal-back')) e.remove(); });
  },
  help() {
    if (!this.game) return;
    UI.modal({ title: this.game.name, body: `<div class="rules">${this.game.help}</div>`, cls: 'wide' });
  },
};
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

window.addEventListener('DOMContentLoaded', () => App.init());
