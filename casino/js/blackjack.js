'use strict';
/* Blackjack: 6-deck shoe, dealer stands on all 17s, 3:2 blackjack, double any two, split to four hands, insurance. */
(() => {
  const MIN = 5, MAX = 5000, DECKS = 6;

  function value(cards) {
    let t = 0, a = 0;
    for (const c of cards) { if (c.r === 14) { a++; t += 11; } else t += Math.min(10, c.r); }
    while (t > 21 && a) { t -= 10; a--; }
    return { t, soft: a > 0 };
  }
  const tenish = c => c.r >= 10 && c.r <= 13;
  const isBJ = cards => cards.length === 2 && value(cards).t === 21;
  const sameValue = (a, b) => a.r === b.r || (tenish(a) && tenish(b));

  // basic strategy, 6 decks, S17, double after split
  function advise(hand, up, canDouble, canSplit) {
    const d = up.r === 14 ? 11 : Math.min(10, up.r);
    const cs = hand.cards;
    let a = null;
    if (canSplit) {
      const r = cs[0].r === 14 ? 11 : Math.min(10, cs[0].r);
      if (r === 11 || r === 8) a = 'P';
      else if (r === 9 && ((d >= 2 && d <= 6) || d === 8 || d === 9)) a = 'P';
      else if ((r === 7 || r === 3 || r === 2) && d <= 7) a = 'P';
      else if (r === 6 && d <= 6) a = 'P';
      else if (r === 4 && (d === 5 || d === 6)) a = 'P';
    }
    if (!a) {
      const { t, soft } = value(cs);
      if (soft && t <= 21 && t >= 13) {
        if (t >= 19) a = 'S';
        else if (t === 18) a = d >= 3 && d <= 6 ? 'Ds' : (d <= 8 ? 'S' : 'H');
        else if (t === 17) a = d >= 3 && d <= 6 ? 'D' : 'H';
        else if (t >= 15) a = d >= 4 && d <= 6 ? 'D' : 'H';
        else a = d >= 5 && d <= 6 ? 'D' : 'H';
      } else {
        if (t >= 17) a = 'S';
        else if (t >= 13) a = d <= 6 ? 'S' : 'H';
        else if (t === 12) a = d >= 4 && d <= 6 ? 'S' : 'H';
        else if (t === 11) a = d <= 10 ? 'D' : 'H';
        else if (t === 10) a = d <= 9 ? 'D' : 'H';
        else if (t === 9) a = d >= 3 && d <= 6 ? 'D' : 'H';
        else a = 'H';
      }
    }
    if (a === 'D') a = canDouble ? 'D' : 'H';
    if (a === 'Ds') a = canDouble ? 'D' : 'S';
    return a;
  }
  const ACT = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };

  let S = null; // per-visit state

  Games.add({
    id: 'blackjack', name: 'Blackjack', tag: 'Beat the dealer to 21',
    art: `<div class="mini-cards"><div class="mc">A<i>${SUIT[0]}</i></div><div class="mc red">K<i>${SUIT[1]}</i></div></div>`,
    help: GUIDES.blackjack,
    mount(v, sess) {
      S = { sess, shoe: newShoe(DECKS), bet: 0, last: 0, phase: 'bet', hands: [], dealer: [], active: -1 };
      v.innerHTML = `
        <div class="felt bj">
          <div class="shoe" id="bj-shoe"><div class="shoe-card"></div></div>
          <div class="bj-dealer"><div class="hand" id="bj-dh"></div><div class="tot" id="bj-dt"></div></div>
          <svg class="arc" viewBox="0 0 400 90" preserveAspectRatio="xMidYMid meet"><defs><path id="bjarc" d="M20,20 Q200,110 380,20"/><path id="bjarc2" d="M50,42 Q200,120 350,42"/></defs>
            <text class="a1"><textPath href="#bjarc" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
            <text class="a2"><textPath href="#bjarc2" startOffset="50%" text-anchor="middle">Dealer stands on all 17s &#183; Insurance pays 2 to 1</textPath></text></svg>
          <div class="say" id="bj-say">Place your bet</div>
          <div class="bj-hands" id="bj-hands"></div>
          <div class="betspot" id="bj-spot"><div class="ring">BET</div></div>
        </div>
        <div class="ctrl">
          <div class="coach" id="bj-coach"></div>
          <div class="rackrow" id="bj-rack"></div>
          <div class="btns" id="bj-btns"></div>
        </div>`;
      S.rack = new ChipRack($('#bj-rack'));
      $('#bj-spot').addEventListener('click', () => addBet());
      betPhase();
    },
    unmount() {
      if (S && S.phase === 'bet' && S.bet > 0) Bank.pay('blackjack', S.bet); // return chips left on the felt
      S = null;
    },
    onBank() { if (S && S.phase === 'bet') { S.rack.refresh(); betButtons(); } },
  });

  function say(t) { const e = $('#bj-say'); if (e) { e.textContent = t; e.classList.toggle('hidden', !t); } }
  function coach(t) { const e = $('#bj-coach'); if (e) e.innerHTML = t || ''; }
  function shoeXY() { const r = $('#bj-shoe').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  // ---------- betting ----------
  function drawSpot() {
    const spot = $('#bj-spot');
    spot.innerHTML = '<div class="ring">BET</div>';
    if (S.bet) spot.appendChild(chipStack(S.bet));
    spot.classList.toggle('has', S.bet > 0);
  }
  function addBet(amt) {
    if (!S || S.phase !== 'bet') return;
    amt = amt || S.rack.value;
    amt = Math.min(amt, MAX - S.bet, Bank.value);
    if (amt <= 0) { if (S.bet >= MAX) UI.toast('Table maximum is ' + fmt(MAX)); else if (!Bank.value) App.cashier(); return; }
    Bank.take('blackjack', amt); S.bet += amt;
    Sound.play('chip'); haptic();
    drawSpot(); S.rack.refresh(); betButtons();
  }
  function clearBet() {
    if (!S.bet) return;
    Bank.pay('blackjack', S.bet); S.bet = 0; Sound.play('chips');
    drawSpot(); S.rack.refresh(); betButtons();
  }
  function betPhase() {
    S.phase = 'bet';
    S.hands = []; S.dealer = [];
    $('#bj-dh').innerHTML = ''; $('#bj-dt').textContent = ''; $('#bj-hands').innerHTML = '';
    $('#bj-spot').classList.remove('hidden');
    drawSpot();
    say(Bank.value + S.bet < MIN ? 'Visit the cashier to keep playing' : 'Place your bet');
    coach('');
    S.rack.show(true); S.rack.refresh();
    betButtons();
  }
  function betButtons() {
    const b = $('#bj-btns'); b.innerHTML = '';
    b.appendChild(UI.button('Clear', 'ghost', clearBet)).disabled = !S.bet;
    const re = UI.button(S.last && !S.bet ? 'Rebet ' + fmtShort(S.last) : 'Bet x2', 'ghost', () => {
      if (!S.bet) addBet(S.last); else addBet(S.bet);
    });
    re.disabled = S.bet ? (S.bet * 2 > MAX || Bank.value < S.bet) : (!S.last || Bank.value < S.last);
    b.appendChild(re);
    const deal = UI.button('Deal', 'gold', () => round());
    deal.disabled = S.bet < MIN;
    b.appendChild(deal);
  }

  // ---------- dealing ----------
  function draw() { return S.shoe.pop(); }
  async function deal(handEl, card, faceUp) {
    const el = cardEl(card, faceUp !== false);
    handEl.appendChild(el);
    const p = shoeXY();
    slideFrom(el, p.x, p.y);
    Sound.play('card');
    await S.sess.wait(300);
    return el;
  }
  function seatEl(i) { return $('#bj-hands').children[i]; }
  function renderSeats() {
    const wrap = $('#bj-hands');
    wrap.className = 'bj-hands n' + S.hands.length;
    // keep existing card elements: only rebuild when the number of hands changes
    while (wrap.children.length < S.hands.length) {
      const s = h('div', 'seat', '<div class="hand"></div><div class="tot"></div><div class="hbet"></div><div class="res"></div>');
      wrap.appendChild(s);
    }
    S.hands.forEach((hd, i) => {
      const s = wrap.children[i];
      s.classList.toggle('act', i === S.active && S.phase === 'play' && S.hands.length > 1);
      const hb = s.querySelector('.hbet'); hb.innerHTML = ''; hb.appendChild(chipStack(hd.bet));
      updTotal(i);
    });
  }
  function updTotal(i) {
    const hd = S.hands[i], s = seatEl(i); if (!s) return;
    const { t, soft } = value(hd.cards);
    const tot = s.querySelector('.tot');
    tot.textContent = hd.cards.length < 2 && !hd.split ? '' : (isBJ(hd.cards) && !hd.split ? 'BJ' : (soft && t < 21 ? (t - 10) + ' / ' + t : t));
    tot.classList.toggle('bust', t > 21);
    tot.classList.toggle('hidden', !hd.cards.length);
  }
  function dealerTotal(all) {
    const e = $('#bj-dt');
    if (!S.dealer.length) { e.textContent = ''; return; }
    const cards = all ? S.dealer : [S.dealer[0]];
    const { t, soft } = value(cards);
    e.textContent = all && isBJ(S.dealer) ? 'BJ' : (soft && t < 21 && !all ? (t - 10) + ' / ' + t : t);
    e.classList.toggle('bust', t > 21);
  }

  async function round() {
    if (S.phase !== 'bet' || S.bet < MIN) return;
    const sess = S.sess;
    S.phase = 'deal'; S.last = S.bet;
    S.rack.show(false); $('#bj-btns').innerHTML = ''; say(''); coach('');
    if (S.shoe.length < DECKS * 52 * 0.25) {
      S.shoe = newShoe(DECKS); Sound.play('shuffle'); say('Shuffling a fresh shoe'); await sess.wait(1100); say('');
    }
    S.hands = [{ cards: [], bet: S.bet, done: false }];
    S.bet = 0; drawSpot(); $('#bj-spot').classList.add('hidden');
    S.dealer = [];
    renderSeats();
    const dh = $('#bj-dh');
    const ph = () => seatEl(0).querySelector('.hand');
    S.hands[0].cards.push(draw()); await deal(ph(), S.hands[0].cards[0]); updTotal(0);
    S.dealer.push(draw()); await deal(dh, S.dealer[0]); dealerTotal(false);
    S.hands[0].cards.push(draw()); await deal(ph(), S.hands[0].cards[1]); updTotal(0);
    S.dealer.push(draw()); S.holeEl = await deal(dh, S.dealer[1], false);
    const up = S.dealer[0];
    const hand = S.hands[0];

    // insurance
    let ins = 0;
    if (up.r === 14 && !isBJ(hand.cards)) {
      const cost = Math.floor(hand.bet / 2);
      if (cost > 0 && Bank.value >= cost) {
        say('Insurance?');
        if (Store.settings.hints) coach('<b>Coach:</b> decline insurance. It loses money over time.');
        const d = deferred();
        const b = $('#bj-btns'); b.innerHTML = '';
        b.appendChild(UI.button('No thanks', 'ghost', () => d.resolve(false)));
        b.appendChild(UI.button('Insure ' + fmt(cost), 'gold', () => d.resolve(true)));
        const yes = await d; if (!sess.alive) return;
        b.innerHTML = ''; coach('');
        if (yes) { ins = cost; Bank.take('blackjack', cost); Sound.play('chip'); }
      }
    }
    // dealer peeks with an ace or ten up
    if (up.r === 14 || tenish(up)) {
      say('Dealer checks for blackjack');
      await sess.wait(900);
      if (isBJ(S.dealer)) {
        flipCard(S.holeEl); dealerTotal(true);
        await sess.wait(500);
        let paid = 0;
        if (ins) { paid += ins * 3; }
        if (isBJ(hand.cards)) { paid += hand.bet; result(0, 'PUSH', 'push'); }
        else result(0, 'LOSE', 'lose');
        Bank.pay('blackjack', paid);
        const profit = paid - hand.bet - ins;
        say('Dealer has blackjack');
        finish(profit, ins ? 'Insurance paid ' + fmt(ins * 2) : '');
        return;
      }
      if (ins) UI.toast('No dealer blackjack. Insurance lost.');
      say('');
    }
    if (isBJ(hand.cards)) {
      flipCard(S.holeEl); dealerTotal(true);
      await sess.wait(400);
      const win = hand.bet + Math.floor(hand.bet * 1.5);
      Bank.pay('blackjack', win);
      result(0, 'BLACKJACK', 'win');
      finish(win - hand.bet - ins, '', true);
      return;
    }

    // player's hands
    S.phase = 'play';
    for (S.active = 0; S.active < S.hands.length; S.active++) {
      renderSeats();
      await playHand(S.active);
      if (!sess.alive) return;
    }
    S.active = -1; renderSeats(); coach(''); $('#bj-btns').innerHTML = '';

    // dealer's turn
    S.phase = 'dealer';
    flipCard(S.holeEl); dealerTotal(true);
    await sess.wait(650);
    const live = S.hands.some(x => value(x.cards).t <= 21);
    if (live) {
      while (value(S.dealer).t < 17) {
        const c = draw(); S.dealer.push(c); await deal(dh, c); dealerTotal(true);
        await sess.wait(250);
      }
    }
    const dv = value(S.dealer).t;
    if (dv > 21) say('Dealer busts with ' + dv); else say('Dealer has ' + dv);
    await sess.wait(400);

    // settle
    let back = 0, staked = ins;
    S.hands.forEach((hd, i) => {
      const pv = value(hd.cards).t;
      staked += hd.bet;
      if (pv > 21) result(i, 'BUST', 'lose');
      else if (dv > 21 || pv > dv) { back += hd.bet * 2; result(i, 'WIN', 'win'); }
      else if (pv === dv) { back += hd.bet; result(i, 'PUSH', 'push'); }
      else result(i, 'LOSE', 'lose');
    });
    Bank.pay('blackjack', back);
    finish(back - staked);
  }

  async function playHand(i) {
    const sess = S.sess, hd = S.hands[i];
    const handEl = () => seatEl(i).querySelector('.hand');
    // second card for a split hand
    if (hd.cards.length === 1) {
      const c = draw(); hd.cards.push(c); await deal(handEl(), c); updTotal(i);
      if (hd.aces) { await sess.wait(250); return; }
    }
    while (true) {
      const { t } = value(hd.cards);
      if (t >= 21) { if (t > 21) { result(i, 'BUST', 'lose'); Sound.play('lose'); } await sess.wait(350); return; }
      const two = hd.cards.length === 2;
      const canDouble = two && Bank.value >= hd.bet;
      const canSplit = two && sameValue(hd.cards[0], hd.cards[1]) && S.hands.length < 4 && Bank.value >= hd.bet;
      const tip = advise(hd, S.dealer[0], canDouble, canSplit);
      say(S.hands.length > 1 ? 'Hand ' + (i + 1) + ' of ' + S.hands.length : '');
      if (Store.settings.hints) coach(`<b>Coach:</b> ${ACT[tip]} <span>(${describe(hd)} vs dealer ${RANK[S.dealer[0].r]})</span>`);
      const d = deferred();
      const b = $('#bj-btns'); b.innerHTML = '';
      const mk = (k, label, cls, ok) => { const x = UI.button(label, cls + (Store.settings.hints && tip === k ? ' tip' : ''), () => d.resolve(k)); x.disabled = !ok; b.appendChild(x); };
      mk('H', 'Hit', 'act', true);
      mk('S', 'Stand', 'act', true);
      mk('D', 'Double', 'act', canDouble);
      mk('P', 'Split', 'act', canSplit);
      const a = await d; if (!sess.alive) return;
      b.innerHTML = ''; coach('');
      if (a === 'S') { await sess.wait(150); return; }
      if (a === 'H') { const c = draw(); hd.cards.push(c); await deal(handEl(), c); updTotal(i); continue; }
      if (a === 'D') {
        Bank.take('blackjack', hd.bet); hd.bet *= 2; Sound.play('chip'); renderSeats();
        const c = draw(); hd.cards.push(c);
        const el = await deal(handEl(), c); el.classList.add('sideways'); updTotal(i);
        if (value(hd.cards).t > 21) { result(i, 'BUST', 'lose'); Sound.play('lose'); }
        await sess.wait(350); return;
      }
      if (a === 'P') {
        Bank.take('blackjack', hd.bet); Sound.play('chip');
        const moved = hd.cards.pop();
        const aces = moved.r === 14;
        const nh = { cards: [moved], bet: hd.bet, split: true, aces };
        hd.split = true; hd.aces = aces;
        S.hands.splice(i + 1, 0, nh);
        // rebuild seats so cards sit in the right hands
        $('#bj-hands').innerHTML = '';
        renderSeats();
        S.hands.forEach((x, k) => { const he = seatEl(k).querySelector('.hand'); x.cards.forEach(c => he.appendChild(cardEl(c, true))); updTotal(k); });
        await sess.wait(300);
        const c = draw(); hd.cards.push(c); await deal(handEl(), c); updTotal(i);
        if (aces) { await sess.wait(250); return; }
        continue;
      }
    }
  }
  function describe(hd) {
    const { t, soft } = value(hd.cards);
    if (hd.cards.length === 2 && sameValue(hd.cards[0], hd.cards[1])) return 'pair of ' + RANK[hd.cards[0].r] + 's';
    return (soft ? 'soft ' : 'hard ') + t;
  }
  function result(i, text, kind) {
    const s = seatEl(i); if (!s) return;
    const r = s.querySelector('.res');
    r.textContent = text; r.className = 'res show ' + kind;
  }
  async function finish(profit, extra, bj) {
    const sess = S.sess;
    S.phase = 'done';
    Bank.record(profit);
    if (profit > 0) {
      Sound.play(bj ? 'big' : 'win'); haptic('medium');
      UI.banner(bj ? 'Blackjack!' : 'You win', '+' + fmt(profit) + (extra ? ' &#183; ' + extra : ''), 'win');
      if (bj) UI.confetti(50);
      flyChips($('#bj-dh'), $('#bj-hands'), profit);
    } else if (profit === 0) { Sound.play('push'); UI.banner('Push', extra || 'Bet returned', 'push'); }
    else { Sound.play('lose'); UI.banner('Dealer wins', fmt(profit) + (extra ? ' &#183; ' + extra : ''), 'lose', 1200); }
    await sess.wait(1700);
    if (!S || S.sess !== sess) return;
    betPhase();
    // put the last bet back out automatically when affordable
    if (S.last && Bank.value >= S.last) addBet(S.last);
  }
})();
