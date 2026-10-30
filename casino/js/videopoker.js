'use strict';
/* Video poker: Jacks or Better, full-pay 9/6 table, 1 to 5 credits, choice of credit size. */
(() => {
  const ROWS = [
    { k: 'RF', name: 'Royal Flush', pay: [250, 500, 750, 1000, 4000] },
    { k: 'SF', name: 'Straight Flush', pay: 50 },
    { k: '4K', name: 'Four of a Kind', pay: 25 },
    { k: 'FH', name: 'Full House', pay: 9 },
    { k: 'FL', name: 'Flush', pay: 6 },
    { k: 'ST', name: 'Straight', pay: 4 },
    { k: '3K', name: 'Three of a Kind', pay: 3 },
    { k: '2P', name: 'Two Pair', pay: 2 },
    { k: 'JB', name: 'Jacks or Better', pay: 1 },
  ];
  const DENOMS = [1, 5, 25];
  const payOf = (row, coins) => Array.isArray(row.pay) ? row.pay[coins - 1] : row.pay * coins;
  function rank(cards) {
    const sc = PK.score(cards.map(PK.toInt), 5), cat = sc >> 20;
    if (cat === 8) return ((sc >> 16) & 15) === 14 ? 'RF' : 'SF';
    return { 7: '4K', 6: 'FH', 5: 'FL', 4: 'ST', 3: '3K', 2: '2P' }[cat] || (cat === 1 && ((sc >> 16) & 15) >= 11 ? 'JB' : null);
  }

  let S = null;

  Games.add({
    id: 'videopoker', name: 'Video Poker', tag: 'Jacks or Better 9/6',
    art: '<div class="mini-vp"><b>JACKS</b><span>OR BETTER</span></div>',
    help: `<p>Five-card draw against the paytable. Deal, tap the cards you want to keep (they show <b>HELD</b>), then draw.</p>
      <ul><li>A pair of jacks or better pays. Max bet (5 credits) unlocks the 4,000-credit royal flush.</li>
      <li>This is the full-pay 9/6 table: 99.5% payback with perfect play.</li>
      <li>Tips: always keep a paying hand, except break up anything for four to a royal. Keep any four to a flush. Keep a low pair over unsuited high cards.</li>
      <li>Change the credit size with the coin button: $1, $5 or $25 per credit.</li></ul>`,
    mount(v, sess) {
      S = { sess, coins: 5, denom: 5, phase: 'idle', hand: [], held: [false, false, false, false, false], deck: null, busy: false };
      v.innerHTML = `
        <div class="vp">
          <div class="vp-pay" id="vp-pay"></div>
          <div class="vp-msg" id="vp-msg">Press Deal to play</div>
          <div class="vp-cards" id="vp-cards"></div>
          <div class="vp-meta"><span>BET <b id="vp-bet"></b></span><span>WIN <b id="vp-win">0</b></span><span>CREDITS <b id="vp-cred"></b></span></div>
          <div class="vp-btns">
            <button class="vbtn" id="vp-den"></button>
            <button class="vbtn" id="vp-one">BET ONE</button>
            <button class="vbtn" id="vp-max">BET MAX</button>
            <button class="vbtn deal" id="vp-deal">DEAL</button>
          </div>
        </div>`;
      const cards = $('#vp-cards');
      for (let i = 0; i < 5; i++) {
        const slot = h('div', 'vslot', '<div class="held">HELD</div>');
        slot.appendChild(cardEl(null, false));
        slot.addEventListener('click', () => toggle(i));
        cards.appendChild(slot);
      }
      $('#vp-den').addEventListener('click', () => {
        if (S.phase === 'draw' || S.busy) return;
        Sound.play('chip');
        S.denom = DENOMS[(DENOMS.indexOf(S.denom) + 1) % DENOMS.length]; meta();
      });
      $('#vp-one').addEventListener('click', () => { if (S.phase === 'draw' || S.busy) return; Sound.play('tap'); S.coins = S.coins % 5 + 1; paytable(); meta(); });
      $('#vp-max').addEventListener('click', () => { if (S.phase === 'draw' || S.busy) return; S.coins = 5; paytable(); meta(); deal(); });
      $('#vp-deal').addEventListener('click', () => { Sound.unlock(); S.phase === 'draw' ? draw() : deal(); });
      paytable(); meta();
    },
    unmount() { S = null; },
    onBank() { meta(); },
  });

  function paytable(hit) {
    const t = $('#vp-pay');
    t.innerHTML = ROWS.map(r => `<div class="pr${hit === r.k ? ' hit' : ''}"><span>${r.name}</span>${[1, 2, 3, 4, 5].map(c => `<b class="${c === S.coins ? 'col' : ''}">${payOf(r, c)}</b>`).join('')}</div>`).join('');
  }
  function meta() {
    if (!S) return;
    $('#vp-bet').textContent = S.coins + ' × ' + fmt(S.denom);
    $('#vp-cred').textContent = Math.floor(Bank.value / S.denom).toLocaleString();
    $('#vp-den').innerHTML = `<span class="coin">${fmt(S.denom)}</span>`;
  }
  function msg(t) { $('#vp-msg').innerHTML = t; }
  function toggle(i) {
    if (!S || S.phase !== 'draw' || S.busy) return;
    S.held[i] = !S.held[i];
    $$('.vslot')[i].classList.toggle('on', S.held[i]);
    Sound.play('tap'); haptic();
  }
  async function deal() {
    if (!S || S.busy || S.phase === 'draw') return;
    const sess = S.sess, cost = S.coins * S.denom;
    if (!Bank.can(cost)) { if (Bank.value >= S.denom) { S.coins = Math.max(1, Math.floor(Bank.value / S.denom)); paytable(); meta(); UI.toast('Bet lowered to what you can cover'); } else App.cashier(); return; }
    S.busy = true;
    Bank.take('videopoker', cost);
    meta(); paytable();
    $('#vp-win').textContent = '0';
    S.deck = newShoe(1);
    S.hand = [0, 1, 2, 3, 4].map(() => S.deck.pop());
    S.held = [false, false, false, false, false];
    const slots = $$('.vslot');
    slots.forEach(s => { s.classList.remove('on', 'win'); const c = s.querySelector('.card'); c.classList.add('down'); });
    Sound.play('card');
    await sess.wait(330);
    for (let i = 0; i < 5; i++) {
      const c = slots[i].querySelector('.card');
      flipCard(c, S.hand[i]);
      await sess.wait(90);
    }
    const r = rank(S.hand);
    msg(r ? '<b>' + ROWS.find(x => x.k === r).name + '</b> &#183; tap cards to hold' : 'Tap cards to hold, then draw');
    if (r) paytable(r);
    S.phase = 'draw'; S.busy = false;
    $('#vp-deal').textContent = 'DRAW';
  }
  async function draw() {
    if (!S || S.busy) return;
    const sess = S.sess;
    S.busy = true;
    const slots = $$('.vslot');
    const swap = [];
    for (let i = 0; i < 5; i++) if (!S.held[i]) { slots[i].querySelector('.card').classList.add('down'); swap.push(i); }
    if (swap.length) { Sound.play('card'); await sess.wait(330); }
    for (const i of swap) {
      S.hand[i] = S.deck.pop();
      flipCard(slots[i].querySelector('.card'), S.hand[i]);
      await sess.wait(110);
    }
    const r = rank(S.hand);
    const row = r && ROWS.find(x => x.k === r);
    const credits = row ? payOf(row, S.coins) : 0;
    const won = credits * S.denom;
    paytable(r);
    $('#vp-deal').textContent = 'DEAL';
    if (won) {
      Bank.pay('videopoker', won);
      $('#vp-win').textContent = credits.toLocaleString();
      msg('<b>' + row.name + '</b> &#183; win ' + fmt(won));
      // light the cards that make the hand
      slots.forEach(s => s.classList.add('win'));
      if (credits >= 25 * S.coins) { Sound.play('big'); UI.banner(row.name + '!', fmt(won), 'win', 2200); UI.confetti(r === 'RF' ? 150 : 60); haptic('heavy'); }
      else { Sound.play('win'); haptic('medium'); }
    } else { msg('Game over &#183; press Deal'); Sound.play('lose'); }
    Bank.record(won - S.coins * S.denom);
    $$('.vslot').forEach(s => s.classList.remove('on'));
    meta();
    S.phase = 'idle'; S.busy = false;
  }
})();
