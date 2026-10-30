'use strict';
/* Craps: pass / don't pass with odds, place bets, field, hardways and one-roll props. */
(() => {
  const MAX = 5000;
  const PLACE = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
  const ODDS = { 4: [2, 1], 5: [3, 2], 6: [6, 5], 8: [6, 5], 9: [3, 2], 10: [2, 1] };
  const ODDS_X = { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  let S = null;

  Games.add({
    id: 'craps', name: 'Craps', tag: 'Roll the bones',
    art: '<div class="mini-dice"><i class="d5"></i><i class="d2"></i></div>',
    help: `<p>The first roll is the <b>come-out</b>. 7 or 11 wins on the <b>Pass Line</b>, 2, 3 or 12 loses. Any other number becomes the <b>point</b>. Roll the point again before a 7 to win.</p>
      <ul><li><b>Don't Pass</b> is the opposite: wins on 2 or 3, pushes on 12, then wins if a 7 comes before the point.</li>
      <li><b>Odds</b>: once a point is set, back your pass line bet at true odds (no house edge): 2 to 1 on 4 and 10, 3 to 2 on 5 and 9, 6 to 5 on 6 and 8. Up to 3x, 4x, 5x.</li>
      <li><b>Place bets</b> on 4, 5, 6, 8, 9, 10 win whenever that number rolls before a 7: 9 to 5, 7 to 5, 7 to 6. They are off on the come-out roll.</li>
      <li><b>Field</b> (one roll): 3, 4, 9, 10, 11 pay even money, 2 pays double, 12 pays triple.</li>
      <li><b>Hard 6 / Hard 8</b> pay 9 to 1 if rolled as a pair before a 7 or the easy way. Off on the come-out.</li>
      <li>One-roll props: <b>Any 7</b> 4 to 1, <b>Any Craps</b> (2, 3, 12) 7 to 1, <b>Yo</b> (11) 15 to 1.</li>
      <li>Winning bets stay up for the next roll. Long-press a bet to take it down.</li></ul>`,
    mount(v, sess) {
      S = { sess, point: 0, bets: {}, busy: false, rolls: [] };
      v.innerHTML = `
        <div class="felt cr">
          <div class="cr-tray"><div class="dice" id="cr-dice"></div><div class="puck off" id="cr-puck">OFF</div><div class="cr-last" id="cr-last"></div></div>
          <div class="cr-say" id="cr-say">Come-out roll: bet the Pass Line</div>
          <div class="cr-layout">
            <div class="cr-places">${[4, 5, 6, 8, 9, 10].map(n => `<div class="cb place" data-k="p${n}"><b>${n === 6 ? 'SIX' : n === 9 ? 'NINE' : n}</b><small>${PLACE[n][0]}:${PLACE[n][1]}</small><div class="cc"></div></div>`).join('')}</div>
            <div class="cb field" data-k="field"><b>FIELD</b><small>2 pays double &#183; 3 &#183; 4 &#183; 9 &#183; 10 &#183; 11 &#183; 12 pays triple</small><div class="cc"></div></div>
            <div class="cr-row">
              <div class="cb dp" data-k="dp"><b>DON'T PASS BAR</b><small>12 pushes</small><div class="cc"></div></div>
            </div>
            <div class="cr-row">
              <div class="cb pass" data-k="pass"><b>PASS LINE</b><div class="cc"></div></div>
              <div class="cb odds" data-k="odds"><b>ODDS</b><small id="cr-oddsx">after point</small><div class="cc"></div></div>
            </div>
            <div class="cr-props">
              <div class="cb prop" data-k="any7"><b>ANY 7</b><small>4:1</small><div class="cc"></div></div>
              <div class="cb prop" data-k="craps"><b>CRAPS</b><small>7:1</small><div class="cc"></div></div>
              <div class="cb prop" data-k="yo"><b>YO 11</b><small>15:1</small><div class="cc"></div></div>
              <div class="cb prop" data-k="h6"><b>HARD 6</b><small>9:1</small><div class="cc"></div></div>
              <div class="cb prop" data-k="h8"><b>HARD 8</b><small>9:1</small><div class="cc"></div></div>
            </div>
          </div>
        </div>
        <div class="ctrl">
          <div class="rackrow" id="cr-rack"></div>
          <div class="btns" id="cr-btns"></div>
        </div>`;
      S.rack = new ChipRack($('#cr-rack'));
      $$('.cb', v).forEach(b => press(b, b.dataset.k));
      dice([randInt(6) + 1, randInt(6) + 1]);
      state(); buttons();
    },
    unmount() { if (S && !S.busy) { const t = Object.values(S.bets).reduce((a, b) => a + b, 0); if (t) Bank.pay('craps', t); } S = null; },
    onBank() { if (S) { S.rack.refresh(); buttons(); } },
  });

  function press(el, k) {
    let t = null, long = false;
    el.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; take(k); }, 550); });
    el.addEventListener('pointerup', () => { clearTimeout(t); if (!long) place(k); });
    el.addEventListener('pointerleave', () => clearTimeout(t));
    el.addEventListener('pointercancel', () => clearTimeout(t));
  }
  function maxOdds() { return S.point ? (S.bets.pass || 0) * ODDS_X[S.point] : 0; }
  function place(k) {
    if (!S || S.busy) return;
    if ((k === 'pass' || k === 'dp') && S.point) { UI.toast(k === 'pass' ? 'Pass Line bets go down on the come-out roll' : 'Don\'t Pass bets go down on the come-out roll'); return; }
    if (k === 'odds') {
      if (!S.point || !S.bets.pass) { UI.toast('Odds go behind a Pass Line bet once a point is set'); return; }
    }
    let amt = Math.min(S.rack.value, Bank.value, MAX - (S.bets[k] || 0));
    if (k === 'odds') amt = Math.min(amt, maxOdds() - (S.bets.odds || 0));
    if (amt <= 0) {
      if (!Bank.value) App.cashier();
      else UI.toast(k === 'odds' ? 'Odds are capped at ' + ODDS_X[S.point] + 'x your line bet' : 'Table limit is ' + fmt(MAX));
      return;
    }
    Bank.take('craps', amt);
    S.bets[k] = (S.bets[k] || 0) + amt;
    Sound.play('chip'); haptic();
    drawBets(); buttons();
  }
  function take(k) {
    if (!S || S.busy || !S.bets[k]) return;
    if (k === 'pass' && S.point) { UI.toast('A Pass Line bet can\'t come down once the point is set'); return; }
    Bank.pay('craps', S.bets[k]); delete S.bets[k];
    if (k === 'pass') { if (S.bets.odds) { Bank.pay('craps', S.bets.odds); delete S.bets.odds; } }
    Sound.play('chips'); haptic('medium');
    drawBets(); buttons();
  }
  function drawBets() {
    $$('.cr .cb').forEach(b => {
      const k = b.dataset.k, c = $('.cc', b);
      c.innerHTML = '';
      if (S.bets[k]) c.appendChild(chipStack(S.bets[k], 'small'));
      b.classList.toggle('has', !!S.bets[k]);
      const off = k[0] === 'p' && k !== 'pass' && !S.point || ((k === 'h6' || k === 'h8') && !S.point);
      b.classList.toggle('off', !!(off && S.bets[k]));
    });
    S.rack.refresh();
  }
  function state() {
    const pk = $('#cr-puck');
    pk.className = 'puck ' + (S.point ? 'on' : 'off');
    pk.textContent = S.point ? 'ON' : 'OFF';
    $$('.cr .place').forEach(b => b.classList.toggle('point', S.point && b.dataset.k === 'p' + S.point));
    $('.cr .odds').classList.toggle('dead', !S.point);
    $('#cr-oddsx').textContent = S.point ? 'up to ' + ODDS_X[S.point] + 'x pays ' + ODDS[S.point].join(':') : 'after point';
    $('#cr-say').textContent = S.point ? 'The point is ' + S.point + '. Roll it again before a 7.' : 'Come-out roll';
    const l = $('#cr-last'); l.innerHTML = '';
    S.rolls.slice(0, 10).forEach(r => l.appendChild(h('span', r === 7 ? 'seven' : '', String(r))));
  }
  function buttons() {
    const b = $('#cr-btns'); if (!b) return;
    b.innerHTML = '';
    const total = Object.values(S.bets).reduce((a, x) => a + x, 0);
    const clr = UI.button('Clear', 'ghost', () => {
      Object.keys(S.bets).forEach(k => { if (!(k === 'pass' && S.point)) { Bank.pay('craps', S.bets[k]); delete S.bets[k]; } });
      Sound.play('chips'); drawBets(); buttons();
    });
    clr.disabled = !Object.keys(S.bets).some(k => !(k === 'pass' && S.point));
    b.appendChild(clr);
    const roll = UI.button('Roll dice', 'gold', () => doRoll());
    roll.disabled = !total;
    b.appendChild(roll);
  }
  function dieEl(n) {
    const d = h('div', 'die');
    for (let i = 0; i < 9; i++) d.appendChild(h('i', PIPS[n].includes(i) ? 'on' : ''));
    return d;
  }
  function dice(vals) {
    const w = $('#cr-dice'); w.innerHTML = '';
    vals.forEach(v => w.appendChild(dieEl(v)));
  }

  async function doRoll() {
    if (!S || S.busy) return;
    const sess = S.sess;
    S.busy = true;
    $('#cr-btns').innerHTML = '';
    const a = randInt(6) + 1, b = randInt(6) + 1, t = a + b, hard = a === b;
    // tumble
    Sound.play('dice'); haptic('medium');
    const w = $('#cr-dice');
    for (let i = 0; i < 9; i++) {
      dice([randInt(6) + 1, randInt(6) + 1]);
      $$('.die', w).forEach((d, j) => { d.style.transform = `translate(${(Math.random() - 0.5) * 30}px,${(Math.random() - 0.5) * 18}px) rotate(${Math.random() * 360}deg)`; });
      await sess.wait(70);
    }
    dice([a, b]);
    $$('.die', w).forEach((d, j) => { d.style.transform = `rotate(${(Math.random() - 0.5) * 24}deg)`; d.classList.add('land'); });
    Sound.play('thunk');
    if (!S || S.sess !== sess) return;
    S.rolls.unshift(t);
    // settle
    const B = S.bets, pt = S.point;
    let back = 0, gain = 0, lost = 0;
    // winners stay up (keep) except odds, which come down with the point
    const win = (k, num, den, keep) => { const amt = B[k]; const prof = Math.floor(amt * num / den); gain += prof; back += prof + (keep ? 0 : amt); if (!keep) delete B[k]; };
    const lose = k => { if (B[k]) { lost += B[k]; delete B[k]; } };
    // one-roll bets
    if (B.field) { if (t === 2) win('field', 2, 1, true); else if (t === 12) win('field', 3, 1, true); else if ([3, 4, 9, 10, 11].includes(t)) win('field', 1, 1, true); else lose('field'); }
    if (B.any7) { if (t === 7) win('any7', 4, 1, true); else lose('any7'); }
    if (B.craps) { if (t === 2 || t === 3 || t === 12) win('craps', 7, 1, true); else lose('craps'); }
    if (B.yo) { if (t === 11) win('yo', 15, 1, true); else lose('yo'); }
    let msg = '';
    if (!pt) {
      if (B.pass) { if (t === 7 || t === 11) win('pass', 1, 1, true); else if (t === 2 || t === 3 || t === 12) lose('pass'); }
      if (B.dp) { if (t === 2 || t === 3) win('dp', 1, 1, true); else if (t === 7 || t === 11) lose('dp'); }
      if (t === 7 || t === 11) msg = t + ' on the come-out: winner';
      else if (t === 2 || t === 3 || t === 12) msg = 'Craps ' + t;
      else { S.point = t; msg = 'Point is ' + t; }
    } else {
      // hardways
      ['h6', 'h8'].forEach(k => { const n = k === 'h6' ? 6 : 8; if (!B[k]) return; if (t === 7) lose(k); else if (t === n) { if (hard) win(k, 9, 1, true); else lose(k); } });
      // place bets
      [4, 5, 6, 8, 9, 10].forEach(n => { const k = 'p' + n; if (!B[k]) return; if (t === 7) lose(k); else if (t === n) win(k, PLACE[n][0], PLACE[n][1], true); });
      if (t === pt) {
        if (B.pass) win('pass', 1, 1, true);
        if (B.odds) win('odds', ODDS[pt][0], ODDS[pt][1], false);
        lose('dp');
        S.point = 0; msg = 'Winner! ' + t + ' hits the point';
      } else if (t === 7) {
        lose('pass'); lose('odds');
        if (B.dp) win('dp', 1, 1, true);
        S.point = 0; msg = 'Seven out';
      } else msg = 'Rolled ' + t + (hard && (t === 6 || t === 8) ? ' the hard way' : '');
    }
    if (back) Bank.pay('craps', back);
    const net = gain - lost;
    if (gain || lost) Bank.record(net);
    state(); drawBets();
    $('#cr-say').textContent = msg;
    if (net > 0) { Sound.play('win'); haptic('medium'); UI.banner(t + (hard ? ' the hard way' : ''), '+' + fmt(net), 'win', 1300); }
    else if (net < 0) { Sound.play('lose'); UI.banner(String(t), fmt(net), 'lose', 1000); }
    else UI.banner(String(t), msg, 'push', 1000);
    await sess.wait(1100);
    if (!S || S.sess !== sess) return;
    S.busy = false;
    state(); buttons();
  }
})();
