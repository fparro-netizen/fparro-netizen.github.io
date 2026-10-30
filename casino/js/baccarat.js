'use strict';
/* Punto Banco baccarat: 8-deck shoe, standard third-card rules, 5% banker commission, tie 8:1, pairs 11:1, bead road. */
(() => {
  const DECKS = 8, MAX = 5000;
  const SPOTS = {
    ppair: { label: 'P Pair', sub: '11 : 1' },
    tie: { label: 'Tie', sub: '8 : 1' },
    bpair: { label: 'B Pair', sub: '11 : 1' },
    player: { label: 'Player', sub: '1 : 1' },
    banker: { label: 'Banker', sub: '0.95 : 1' },
  };
  const val = c => c.r === 14 ? 1 : c.r >= 10 ? 0 : c.r;
  const total = cs => cs.reduce((a, c) => a + val(c), 0) % 10;

  let S = null;

  Games.add({
    id: 'baccarat', name: 'Baccarat', tag: 'Punto Banco',
    art: '<div class="mini-bac"><b>9</b></div>',
    help: `<p>Bet on which hand finishes closest to 9: <b>Player</b> or <b>Banker</b>. Tens and face cards count zero, aces count one, and only the last digit of the total counts (7 + 6 = 3).</p>
      <ul><li>The dealer follows fixed drawing rules; you make no decisions after betting.</li>
      <li><b>Player</b> pays 1 to 1. <b>Banker</b> pays 0.95 to 1 (5% commission). Both push on a tie.</li>
      <li><b>Tie</b> pays 8 to 1. <b>Player Pair</b> or <b>Banker Pair</b> (first two cards match in rank) pay 11 to 1.</li>
      <li>The bead road on the right tracks the shoe: blue Player, red Banker, green Tie.</li>
      <li>Eight-deck shoe. Table limit ${fmt(MAX)} per bet.</li></ul>`,
    mount(v, sess) {
      S = { sess, shoe: newShoe(DECKS), bets: {}, last: null, busy: false, road: Store.getGame('bac-road') || [] };
      v.innerHTML = `
        <div class="felt bac">
          <div class="shoe" id="bc-shoe"><div class="shoe-card"></div></div>
          <div class="bc-hands">
            <div class="bh p"><div class="bl">PLAYER</div><div class="hand" id="bc-p"></div><div class="bt" id="bc-pt"></div></div>
            <div class="bh b"><div class="bl">BANKER</div><div class="hand" id="bc-b"></div><div class="bt" id="bc-bt"></div></div>
          </div>
          <div class="bc-say" id="bc-say">Place your bets</div>
          <div class="bc-bets" id="bc-bets"></div>
          <div class="road" id="bc-road"></div>
        </div>
        <div class="ctrl">
          <div class="rackrow" id="bc-rack"></div>
          <div class="btns" id="bc-btns"></div>
        </div>`;
      const bets = $('#bc-bets');
      const top = h('div', 'brow small'), bot = h('div', 'brow');
      ['ppair', 'tie', 'bpair'].forEach(k => top.appendChild(spot(k)));
      ['player', 'banker'].forEach(k => bot.appendChild(spot(k)));
      bets.appendChild(top); bets.appendChild(bot);
      S.rack = new ChipRack($('#bc-rack'));
      road(); buttons();
    },
    unmount() { if (S && !S.busy) refund(); S = null; },
    onBank() { if (S) { S.rack.refresh(); buttons(); } },
  });

  function spot(k) {
    const e = h('div', 'bspot bs-' + k, `<div class="bsl">${SPOTS[k].label}</div><div class="bss">${SPOTS[k].sub}</div><div class="bsc"></div>`);
    e.addEventListener('click', () => addBet(k));
    return e;
  }
  const staked = () => Object.values(S.bets).reduce((a, b) => a + b, 0);
  function refund() { const t = staked(); if (t) Bank.pay('baccarat', t); S.bets = {}; }
  function addBet(k, amt) {
    if (!S || S.busy) return;
    amt = Math.min(amt || S.rack.value, MAX - (S.bets[k] || 0), Bank.value);
    if (amt <= 0) { if ((S.bets[k] || 0) >= MAX) UI.toast('Table limit is ' + fmt(MAX)); else App.cashier(); return; }
    Bank.take('baccarat', amt);
    S.bets[k] = (S.bets[k] || 0) + amt;
    Sound.play('chip'); haptic();
    drawBets(); buttons();
  }
  function drawBets() {
    Object.keys(SPOTS).forEach(k => {
      const c = $('.bs-' + k + ' .bsc'); c.innerHTML = '';
      if (S.bets[k]) c.appendChild(chipStack(S.bets[k], 'small'));
      $('.bs-' + k).classList.toggle('has', !!S.bets[k]);
    });
    S.rack.refresh();
  }
  function buttons() {
    const b = $('#bc-btns'); if (!b) return;
    b.innerHTML = '';
    const t = staked();
    const clr = UI.button('Clear', 'ghost', () => { refund(); Sound.play('chips'); drawBets(); buttons(); });
    clr.disabled = !t; b.appendChild(clr);
    const lastT = S.last ? Object.values(S.last).reduce((a, x) => a + x, 0) : 0;
    const re = UI.button('Rebet', 'ghost', () => {
      if (lastT > Bank.value) return UI.toast('Not enough for that');
      Object.entries(S.last).forEach(([k, x]) => addBet(k, x));
    });
    re.disabled = !!t || !S.last || lastT > Bank.value; b.appendChild(re);
    const d = UI.button('Deal', 'gold', () => play());
    d.disabled = !t; b.appendChild(d);
  }
  function say(t) { $('#bc-say').innerHTML = t; }
  function road() {
    const r = $('#bc-road'); r.innerHTML = '';
    const cols = Math.max(6, Math.floor((r.clientWidth - 70) / 16)), list = S.road.slice(-cols * 6);
    for (let i = 0; i < cols * 6; i++) {
      const x = list[i];
      r.appendChild(h('i', x ? 'rd ' + x : 'rd'));
    }
    const pc = S.road.filter(x => x[0] === 'p').length, bc = S.road.filter(x => x[0] === 'b').length, tc = S.road.filter(x => x[0] === 't').length;
    r.appendChild(h('div', 'rsum', `<span class="p">P ${pc}</span><span class="b">B ${bc}</span><span class="t">T ${tc}</span>`));
  }
  function shoeXY() { const r = $('#bc-shoe').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  async function deal(handEl, c, side) {
    const e = cardEl(c, false, side ? 'sideways' : '');
    handEl.appendChild(e);
    const p = shoeXY(); slideFrom(e, p.x, p.y); Sound.play('card');
    await S.sess.wait(330);
    flipCard(e);
    await S.sess.wait(260);
  }

  async function play() {
    if (!S || S.busy || !staked()) return;
    const sess = S.sess;
    S.busy = true; S.last = Object.assign({}, S.bets);
    $('#bc-btns').innerHTML = ''; S.rack.show(false);
    $('.bac').classList.remove('pwin', 'bwin', 'twin');
    if (S.shoe.length < 20) { S.shoe = newShoe(DECKS); S.road = []; road(); Sound.play('shuffle'); say('New shoe'); await sess.wait(1000); }
    const pe = $('#bc-p'), be = $('#bc-b');
    pe.innerHTML = ''; be.innerHTML = ''; $('#bc-pt').textContent = ''; $('#bc-bt').textContent = '';
    say('');
    const P = [], B = [], d = () => S.shoe.pop();
    const showT = () => { $('#bc-pt').textContent = P.length ? total(P) : ''; $('#bc-bt').textContent = B.length ? total(B) : ''; };
    P.push(d()); await deal(pe, P[0]); showT();
    B.push(d()); await deal(be, B[0]); showT();
    P.push(d()); await deal(pe, P[1]); showT();
    B.push(d()); await deal(be, B[1]); showT();
    if (!S || S.sess !== sess) return;
    let pt = total(P), bt = total(B);
    if (pt >= 8 || bt >= 8) say('Natural ' + Math.max(pt, bt));
    else {
      let p3 = null;
      if (pt <= 5) { await sess.wait(400); say('Player draws'); p3 = d(); P.push(p3); await deal(pe, p3, true); showT(); }
      else say('Player stands on ' + pt);
      bt = total(B);
      let draw;
      if (p3 == null) draw = bt <= 5;
      else {
        const v = val(p3);
        draw = bt <= 2 || (bt === 3 && v !== 8) || (bt === 4 && v >= 2 && v <= 7) || (bt === 5 && v >= 4 && v <= 7) || (bt === 6 && (v === 6 || v === 7));
      }
      if (draw) { await sess.wait(450); say('Banker draws'); const c = d(); B.push(c); await deal(be, c, true); showT(); }
      else if (p3 != null) { await sess.wait(300); say('Banker stands on ' + bt); }
    }
    if (!S || S.sess !== sess) return;
    pt = total(P); bt = total(B);
    const res = pt > bt ? 'p' : bt > pt ? 'b' : 't';
    const ppair = P[0].r === P[1].r, bpair = B[0].r === B[1].r;
    await sess.wait(500);
    $('.bac').classList.add(res + 'win');
    say(res === 't' ? `Tie, ${pt} to ${bt}` : (res === 'p' ? 'Player' : 'Banker') + ` wins, ${Math.max(pt, bt)} over ${Math.min(pt, bt)}`);
    // settle
    let back = 0;
    const bet = S.bets;
    if (bet.player) back += res === 'p' ? bet.player * 2 : res === 't' ? bet.player : 0;
    if (bet.banker) back += res === 'b' ? Math.floor(bet.banker * 1.95) : res === 't' ? bet.banker : 0;
    if (bet.tie && res === 't') back += bet.tie * 9;
    if (bet.ppair && ppair) back += bet.ppair * 12;
    if (bet.bpair && bpair) back += bet.bpair * 12;
    const put = staked();
    Bank.pay('baccarat', back);
    Bank.record(back - put);
    S.road.push(res + (ppair ? ' pp' : '') + (bpair ? ' bp' : ''));
    S.road = S.road.slice(-72);
    Store.setGame('bac-road', S.road);
    road();
    const profit = back - put;
    if (profit > 0) { Sound.play(profit >= put * 8 ? 'big' : 'win'); haptic('medium'); UI.banner('You win', '+' + fmt(profit), 'win'); if (profit >= put * 8) UI.confetti(60); }
    else if (profit === 0) { Sound.play('push'); UI.banner('Push', 'Bets returned', 'push'); }
    else { Sound.play('lose'); UI.banner(res === 't' ? 'Tie' : (res === 'p' ? 'Player' : 'Banker') + ' wins', fmt(profit), 'lose', 1200); }
    S.bets = {};
    await sess.wait(1800);
    if (!S || S.sess !== sess) return;
    S.busy = false;
    drawBets(); S.rack.show(true); buttons();
    say('Place your bets');
  }
})();
