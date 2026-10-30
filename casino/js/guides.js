'use strict';
/* How-to-play guides shown from the ? button and the first time each game opens. */
const GUIDES = {

  blackjack: `
<div class="g-goal"><b>The goal:</b> finish with a hand closer to 21 than the dealer's, without going over 21.</div>
<h4>Card values</h4>
<ul><li>2 through 10 count their number.</li><li>Jack, Queen and King count 10.</li><li>An Ace counts 11, or 1 if 11 would put you over 21. A hand with an Ace counted as 11 is called <b>soft</b> (Ace + 6 is "soft 17").</li></ul>
<h4>How a round works</h4>
<ol class="g-steps">
<li><b>Bet.</b> Tap a chip at the bottom, then tap the gold <b>BET</b> circle. Each tap adds that chip. Tap <b>Deal</b>.</li>
<li><b>The deal.</b> You get two cards face up. The dealer gets one face up and one face down (the "hole card").</li>
<li><b>Your move.</b> Your total shows under your cards. Choose:
  <ul><li><b>Hit:</b> take another card. Hit as many times as you like.</li>
  <li><b>Stand:</b> keep your total and end your turn.</li>
  <li><b>Double:</b> double your bet and take exactly one more card. Only on your first two cards.</li>
  <li><b>Split:</b> if your first two cards match (two 8s, two Kings), split them into two separate hands with an equal bet on each.</li></ul></li>
<li><b>Bust.</b> If you go over 21 you lose right away, even if the dealer busts later.</li>
<li><b>The dealer plays.</b> The dealer turns over the hole card and must keep hitting until reaching 17 or more. The dealer has no choices.</li>
<li><b>Settle.</b> Higher total wins. A tie is a <b>push</b> and your bet comes back.</li>
</ol>
<h4>Payouts</h4>
<table class="g-pay"><tr><td>Win</td><td>1 to 1 (bet $25, win $25)</td></tr><tr><td>Blackjack (Ace + any 10 card on the first two cards)</td><td>3 to 2 (bet $20, win $30)</td></tr><tr><td>Insurance</td><td>2 to 1</td></tr></table>
<h4>Insurance</h4>
<p>When the dealer shows an Ace you are offered insurance for half your bet. It is a side bet that the dealer has blackjack. Over time it loses money, so the coach always says no.</p>
<h4>Beginner tips</h4>
<ul class="g-tips"><li>Stand on 17 or more.</li><li>With 12 to 16, stand if the dealer shows 2 to 6, hit if the dealer shows 7 or higher.</li><li>Double on 11 (and on 10 unless the dealer shows a 10 or Ace).</li><li>Always split Aces and 8s. Never split 10s or 5s.</li><li>Turn on <b>Strategy coach</b> in lobby settings: the best play glows on every hand.</li></ul>`,

  holdem: `
<div class="g-goal"><b>The goal:</b> win chips from the other players by having the best five-card hand, or by betting so they fold. This is a tournament: everyone buys in for $500 and starts with 1,500 chips, and the last player with chips wins.</div>
<h4>How a hand works</h4>
<ol class="g-steps">
<li><b>Blinds.</b> The two players left of the dealer button (<b>D</b>) post forced bets: the small blind and big blind. Blinds go up every 6 hands so the game keeps moving.</li>
<li><b>Hole cards.</b> Everyone gets two private cards. Yours appear in the panel at the bottom.</li>
<li><b>Pre-flop betting.</b> Starting left of the big blind, each player folds, calls or raises.</li>
<li><b>The flop.</b> Three shared cards are dealt face up in the middle. Another round of betting.</li>
<li><b>The turn.</b> A fourth shared card. Betting.</li>
<li><b>The river.</b> A fifth shared card. Final betting.</li>
<li><b>Showdown.</b> Remaining players show cards. Each makes the best five-card hand from their two cards plus the five shared cards. Best hand wins the pot.</li>
</ol>
<p>If everyone else folds at any point, the last player in wins the pot without showing.</p>
<h4>Your actions</h4>
<ul><li><b>Check:</b> pass without betting (only when nobody has bet).</li><li><b>Call:</b> match the current bet.</li><li><b>Bet / Raise:</b> put in more. Use the slider or the Min, &frac12; Pot, &frac34; Pot, Pot and All-in buttons, then tap <b>Confirm</b>.</li><li><b>Fold:</b> give up the hand and anything you have already bet.</li><li><b>All-in:</b> bet every chip you have. If you lose, you are out.</li></ul>
<h4>Hand rankings, best to worst</h4>
<table class="g-pay">
<tr><td>Royal Flush</td><td>A K Q J 10, all one suit</td></tr>
<tr><td>Straight Flush</td><td>Five in a row, one suit</td></tr>
<tr><td>Four of a Kind</td><td>Four cards of one rank</td></tr>
<tr><td>Full House</td><td>Three of a kind plus a pair</td></tr>
<tr><td>Flush</td><td>Any five of one suit</td></tr>
<tr><td>Straight</td><td>Five in a row, mixed suits (A can be high or low)</td></tr>
<tr><td>Three of a Kind</td><td>Three cards of one rank</td></tr>
<tr><td>Two Pair</td><td>Two different pairs</td></tr>
<tr><td>Pair</td><td>Two cards of one rank</td></tr>
<tr><td>High Card</td><td>None of the above; highest card plays</td></tr></table>
<h4>Playing Anna on one phone</h4>
<p>On the setup screen tap both names under <b>Players on this phone</b>. When it is someone's turn, a privacy screen says whose turn it is. Everyone else looks away, that player taps <b>Show my cards</b>, acts, and the cards hide again.</p>
<h4>Prizes</h4>
<p>With 5 or 6 players, 1st, 2nd and 3rd split the prize pool 50% / 30% / 20%. With 3 or 4 players it pays 65% / 35%. Heads-up is winner take all. Your tournament saves after every hand.</p>
<h4>Beginner tips</h4>
<ul class="g-tips"><li>Fold most hands before the flop. Play pairs, two high cards (A, K, Q, J), and suited Aces.</li><li>Raise good hands instead of just calling.</li><li>Be careful when a quiet player suddenly bets big.</li><li>Tap any computer player to see their style.</li></ul>`,

  roulette: `
<div class="g-goal"><b>The goal:</b> guess where the ball lands. This is a European wheel: numbers 1 to 36 plus a single green zero.</div>
<h4>How a round works</h4>
<ol class="g-steps">
<li>Tap a chip at the bottom to choose its value.</li>
<li>Tap the layout to place chips. You can bet on many spots at once.</li>
<li>Tap <b>Spin</b>. The wheel opens, the ball drops, and winning bets are paid automatically.</li>
<li>Tap <b>Rebet</b> to repeat your last bets, or <b>x2</b> to double the bets on the table. <b>Undo</b> removes your last chip, and holding your finger on any bet removes it.</li>
</ol>
<h4>Where to tap and what it pays</h4>
<table class="g-pay">
<tr><td><b>Straight up</b>: tap a number</td><td>35 to 1</td></tr>
<tr><td><b>Split</b>: tap the line between two numbers</td><td>17 to 1</td></tr>
<tr><td><b>Street</b>: tap the left edge of a row (3 numbers)</td><td>11 to 1</td></tr>
<tr><td><b>Corner</b>: tap where four numbers meet</td><td>8 to 1</td></tr>
<tr><td><b>Six line</b>: left edge, on the line between two rows</td><td>5 to 1</td></tr>
<tr><td><b>Dozen</b>: 1st 12, 2nd 12, 3rd 12</td><td>2 to 1</td></tr>
<tr><td><b>Column</b>: a 2:1 box at the bottom</td><td>2 to 1</td></tr>
<tr><td><b>Red / Black, Odd / Even, 1 to 18 / 19 to 36</b></td><td>1 to 1</td></tr></table>
<p>The line under the total bet tells you exactly which numbers you just covered and what they pay. When zero comes up, all outside bets lose.</p>
<h4>Beginner tips</h4>
<ul class="g-tips"><li>Every bet has the same small house edge (2.7%), so bet what is fun.</li><li>Outside bets win often but pay little. A straight-up number rarely hits but pays big.</li><li>The strip at the top shows recent numbers. The wheel has no memory, but it is fun to watch.</li></ul>`,

  slots: `
<div class="g-goal"><b>The goal:</b> line up matching symbols from left to right on any of the 10 paylines.</div>
<h4>How to play</h4>
<ol class="g-steps">
<li>Use <b>&minus;</b> and <b>+</b> to set your total bet ($10 to $500). It is spread across all 10 lines.</li>
<li>Tap <b>SPIN</b>. The reels stop left to right.</li>
<li>Wins light up and draw the winning lines. The numbered dots under the reels show which lines paid.</li>
<li>Tap <b>AUTO</b> to keep spinning on its own. Tap it again to stop.</li>
</ol>
<h4>Rules</h4>
<ul><li>Matches must start on the leftmost reel and run on consecutive reels.</li><li>The <b>crown</b> is wild: it stands in for any symbol.</li><li>Two cherries pay a little; everything else needs three or more.</li><li>Pays below are multiplied by your line bet (total bet divided by 10).</li></ul>
{{PAYTABLE}}
<p>Payback is about 97% over the long run, which is generous for a slot machine.</p>`,

  videopoker: `
<div class="g-goal"><b>The goal:</b> make the best five-card poker hand. There is no opponent: you are paid by the table at the top.</div>
<h4>How a hand works</h4>
<ol class="g-steps">
<li><b>Set your bet.</b> The coin button sets the credit size ($1, $5 or $25). <b>BET ONE</b> steps from 1 to 5 credits. <b>BET MAX</b> bets 5 and deals at once.</li>
<li><b>Deal.</b> You get five cards.</li>
<li><b>Hold.</b> Tap the cards you want to keep. They show <b>HELD</b>. Tap again to release.</li>
<li><b>Draw.</b> Cards you did not hold are replaced. You get one draw only.</li>
<li><b>Payout.</b> A pair of Jacks or better pays. The winning row flashes in the table.</li>
</ol>
<h4>Paying hands</h4>
<p>Jacks or Better (a pair of J, Q, K or A), Two Pair, Three of a Kind, Straight, Flush, Full House, Four of a Kind, Straight Flush, Royal Flush. The Royal Flush pays 4,000 credits only at max bet, so play 5 credits.</p>
<h4>What to hold, in order of priority</h4>
<ol class="g-tips g-num">
<li>Any paying hand of a straight or better. Exception: break it up if you have four cards to a Royal Flush.</li>
<li>Four to a Royal Flush.</li>
<li>Three of a Kind, Two Pair, or a high pair (J, Q, K, A).</li>
<li>Four to a Flush.</li>
<li>A low pair (2s through 10s).</li>
<li>Four in a row (open-ended straight).</li>
<li>Two high cards of the same suit.</li>
<li>Otherwise, keep your high cards (J or better), or draw five new cards.</li></ol>
<p>Played this way, this full-pay table returns over 99%, the best odds in the casino.</p>`,

  baccarat: `
<div class="g-goal"><b>The goal:</b> bet on which of two hands, <b>Player</b> or <b>Banker</b>, will finish closer to 9. You do not play either hand, and you make no decisions after betting. The names are just labels: you can bet on either one.</div>
<h4>Counting cards</h4>
<ul><li>Aces count 1. Cards 2 through 9 count their number. 10, J, Q and K count 0.</li>
<li>Only the last digit of the total counts. 7 + 6 = 13, which counts as <b>3</b>. 9 + 9 = 18, which counts as <b>8</b>. So a hand is always worth 0 to 9.</li></ul>
<h4>How a round works</h4>
<ol class="g-steps">
<li><b>Bet.</b> Tap a chip, then tap <b>Player</b>, <b>Banker</b> or <b>Tie</b> (and the pair bets if you like). Tap <b>Deal</b>.</li>
<li><b>Two cards each.</b> Player and Banker each get two cards. Their totals show in the circles.</li>
<li><b>Natural.</b> If either hand totals 8 or 9, both stand and the round is over.</li>
<li><b>Player's third card.</b> Otherwise, Player draws a third card on 0 to 5 and stands on 6 or 7.</li>
<li><b>Banker's third card.</b> Banker follows the fixed rules below.</li>
<li><b>Result.</b> Closer to 9 wins. Equal totals are a Tie.</li>
</ol>
<h4>When does Banker draw?</h4>
<p>If Player stood with two cards, Banker draws on 0 to 5 and stands on 6 or 7. If Player drew a third card, it depends on that card:</p>
<table class="g-pay g-grid">
<tr><th>Banker has</th><th>Banker draws if Player's third card is</th></tr>
<tr><td>0, 1, 2</td><td>Always draws</td></tr>
<tr><td>3</td><td>Anything except 8</td></tr>
<tr><td>4</td><td>2, 3, 4, 5, 6, 7</td></tr>
<tr><td>5</td><td>4, 5, 6, 7</td></tr>
<tr><td>6</td><td>6 or 7</td></tr>
<tr><td>7</td><td>Never, Banker stands</td></tr></table>
<p>You never need to remember this table: the game follows it for you and tells you each step.</p>
<h4>Bets and payouts</h4>
<table class="g-pay">
<tr><td><b>Player</b></td><td>1 to 1. Pushes on a tie.</td></tr>
<tr><td><b>Banker</b></td><td>0.95 to 1 (a 5% commission, since Banker wins slightly more often). Pushes on a tie.</td></tr>
<tr><td><b>Tie</b></td><td>8 to 1</td></tr>
<tr><td><b>Player Pair / Banker Pair</b></td><td>11 to 1 if that hand's first two cards are the same rank</td></tr></table>
<div class="g-ex"><b>Example:</b> You bet $25 on Banker. Player shows 4 + King = 4 and draws a 3 for 7. Banker shows 6 + Queen = 6. Player's third card was a 3, so Banker (6) stands. Player wins 7 to 6 and your Banker bet loses. Had you bet Player, you would win $25.</div>
<h4>Reading the board</h4>
<p>The white bead road tracks this shoe: blue dot Player win, red dot Banker win, green dot Tie. A white ring inside a dot means a pair came up. Counts are on the right.</p>
<h4>Beginner tips</h4>
<ul class="g-tips"><li><b>Banker</b> is the best bet in baccarat (house edge about 1.1%). <b>Player</b> is close behind (about 1.2%).</li><li>The <b>Tie</b> pays well but has a house edge over 14%. Skip it, except for fun.</li><li>Past results do not predict the next hand, whatever the board looks like.</li></ul>`,

  craps: `
<div class="g-goal"><b>The goal:</b> bet on the outcome of two dice. You are the "shooter": you roll for the whole table. Craps looks complicated, but you only need one bet to play: the <b>Pass Line</b>.</div>
<h4>The basic game, step by step</h4>
<ol class="g-steps">
<li><b>The come-out roll.</b> When the puck in the dice tray says <b>OFF</b>, a new round is starting. Tap a chip, then tap <b>PASS LINE</b>. Tap <b>Roll dice</b>.</li>
<li><b>Instant win or loss.</b> On the come-out roll:
  <ul><li><b>7 or 11</b>: Pass Line wins right away.</li>
  <li><b>2, 3 or 12</b> ("craps"): Pass Line loses.</li>
  <li><b>4, 5, 6, 8, 9 or 10</b>: that number becomes the <b>point</b>. The puck flips to <b>ON</b> and the number's box lights up.</li></ul></li>
<li><b>Chasing the point.</b> Keep rolling. You win if the point comes again <b>before a 7</b>. You lose if a 7 comes first ("seven out"). Every other number does nothing to the Pass Line, so just keep rolling.</li>
<li><b>Start over.</b> Once the point is hit or you seven out, the puck goes back to OFF and a new come-out roll begins. Winning Pass Line bets stay on the table for the next round.</li>
</ol>
<div class="g-ex"><b>Example:</b> You bet $25 on the Pass Line and roll a 6. The point is 6. You roll 9, then 4 (nothing happens), then 6. You win $25. If you had rolled a 7 before the 6, you would lose the $25.</div>
<h4>Odds: the best bet in the casino</h4>
<p>Once a point is set, tap <b>ODDS</b> to add chips behind your Pass Line. Odds win and lose together with your Pass Line, but they pay true odds with <b>no house edge at all</b>:</p>
<table class="g-pay"><tr><td>Point 4 or 10</td><td>pays 2 to 1 (up to 3x your line bet)</td></tr><tr><td>Point 5 or 9</td><td>pays 3 to 2 (up to 4x)</td></tr><tr><td>Point 6 or 8</td><td>pays 6 to 5 (up to 5x)</td></tr></table>
<div class="g-ex"><b>Example:</b> $25 Pass Line, point is 6. You add $50 odds. When the 6 comes, you win $25 on the line plus $60 on the odds.</div>
<h4>The other bets</h4>
<table class="g-pay">
<tr><td><b>Don't Pass Bar</b></td><td>The opposite of Pass. Place it on the come-out. Wins on 2 or 3, loses on 7 or 11, 12 is a push. Then it wins if a 7 comes before the point. Pays 1 to 1.</td></tr>
<tr><td><b>Place 4, 5, SIX, 8, NINE, 10</b></td><td>Tap a number box. Wins every time that number rolls before a 7, and stays up after winning. Pays 9 to 5 on 4 and 10, 7 to 5 on 5 and 9, 7 to 6 on 6 and 8. Place bets are <b>OFF</b> during the come-out roll.</td></tr>
<tr><td><b>Field</b></td><td>One roll only. Wins on 2, 3, 4, 9, 10, 11 or 12 (2 pays double, 12 pays triple). Loses on 5, 6, 7 or 8.</td></tr>
<tr><td><b>Hard 6 / Hard 8</b></td><td>Wins 9 to 1 if the number rolls as a pair (3 and 3, or 4 and 4) before it rolls any other way or a 7 shows. Off on the come-out.</td></tr>
<tr><td><b>Any 7</b></td><td>One roll: next roll is a 7. Pays 4 to 1.</td></tr>
<tr><td><b>Craps</b></td><td>One roll: next roll is 2, 3 or 12. Pays 7 to 1.</td></tr>
<tr><td><b>Yo 11</b></td><td>One roll: next roll is 11. Pays 15 to 1.</td></tr></table>
<p>To take a bet down, hold your finger on it. Pass Line bets cannot come down once a point is set.</p>
<h4>Craps words</h4>
<table class="g-pay g-grid">
<tr><td>Come-out</td><td>The first roll of a new round (puck OFF)</td></tr>
<tr><td>Point</td><td>The number you need to roll again before a 7</td></tr>
<tr><td>Seven out</td><td>Rolling a 7 before the point. Pass Line and place bets lose.</td></tr>
<tr><td>Hard way</td><td>Rolling 4, 6, 8 or 10 as a pair</td></tr>
<tr><td>One-roll bet</td><td>Decided on the very next roll (Field, Any 7, Craps, Yo)</td></tr></table>
<h4>Beginner strategy</h4>
<ul class="g-tips"><li>Bet the <b>Pass Line</b>, then add <b>Odds</b> when the point is set. This is how experienced players play.</li><li>For more action, <b>Place the 6 and 8</b> (house edge about 1.5%).</li><li>The one-roll bets in the bottom row are exciting but expensive (house edge 11% to 17%).</li><li>Watch the line under the dice tray: it always tells you what is happening.</li></ul>`,
};
