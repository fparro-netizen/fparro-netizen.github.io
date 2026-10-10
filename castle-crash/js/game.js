/* Castle Crash - rendering, input, audio, menus. */
(function () {
  'use strict';
  var Core = window.CastleCore, LEVELS = window.CastleLevels;
  var W = Core.W, H = Core.H, GY = Core.GROUND_Y, LP = Core.LAUNCH;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });

  // ---------- save data ----------
  var SAVE_KEY = 'castleCrash.v1';
  var save = { stars: {}, best: {}, coins: 0, sound: true, hintSeen: false };
  try { var s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) for (var k in s) save[k] = s[k]; } catch (e) {}
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------- audio (generated) ----------
  var AC = null, master = null, noiseBuf = null;
  function audioInit() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    AC = new C(); master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!AC || !save.sound) return;
    var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, filterType, freq, vol, q, delay) {
    if (!AC || !save.sound) return;
    var t = AC.currentTime + (delay || 0), src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noiseBuf; f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  var lastHitAt = 0;
  var SFX = {
    launch: function () { noise(0.25, 'lowpass', 900, 0.5); tone(140, 0.22, 'sine', 0.5, 50); },
    hit: function (s, mat) {
      var now = performance.now(); if (now - lastHitAt < 45) return; lastHitAt = now;
      if (mat === 'ice') tone(1400 + Math.random() * 600, 0.08, 'triangle', 0.08 + s * 0.15);
      else if (mat === 'wood') { tone(220 + Math.random() * 60, 0.09, 'triangle', 0.1 + s * 0.25, 120); }
      else noise(0.1, 'lowpass', 500, 0.1 + s * 0.3);
    },
    break: function (mat) {
      if (mat === 'ice') { for (var i = 0; i < 4; i++) tone(1800 + Math.random() * 1500, 0.12, 'triangle', 0.08, null, i * 0.025); noise(0.15, 'highpass', 4000, 0.15); }
      else if (mat === 'wood') { noise(0.22, 'bandpass', 700, 0.45, 2); tone(160, 0.15, 'square', 0.06, 70); }
      else { noise(0.35, 'lowpass', 400, 0.6); tone(90, 0.3, 'sine', 0.3, 40); }
    },
    target: function () { tone(880, 0.12, 'square', 0.12); tone(1320, 0.18, 'square', 0.1, null, 0.08); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'square', 0.1, null, i * 0.12); tone(f / 2, 0.25, 'triangle', 0.15, null, i * 0.12); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.2, f * 0.95, i * 0.2); }); },
    click: function () { tone(660, 0.05, 'square', 0.06); }
  };

  // ---------- layout ----------
  var dpr = 1, cssW = 0, cssH = 0, scale = 1, ox = 0, oy = 0, safe = { t: 0, b: 0, l: 0, r: 0 };
  var bgCanvas = document.createElement('canvas');
  function readSafe() {
    var cs = getComputedStyle($('safe-probe'));
    safe.t = parseFloat(cs.paddingTop) || 0; safe.b = parseFloat(cs.paddingBottom) || 0;
    safe.l = parseFloat(cs.paddingLeft) || 0; safe.r = parseFloat(cs.paddingRight) || 0;
  }
  function resize() {
    readSafe();
    cssW = window.innerWidth; cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    var availH = cssH - safe.b - (safe.t + 56) * 0.4;
    scale = Math.min((cssW - safe.l - safe.r) / W, availH / H);
    ox = safe.l + (cssW - safe.l - safe.r - W * scale) / 2;
    oy = cssH - safe.b - H * scale;
    drawBackground();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  // deterministic pseudo random for decoration
  function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

  function drawBackground() {
    bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
    var b = bgCanvas.getContext('2d');
    var gy = oy + GY * scale;
    var grd = b.createLinearGradient(0, 0, 0, gy * dpr);
    grd.addColorStop(0, '#3a6fd8'); grd.addColorStop(0.6, '#8ec5ff'); grd.addColorStop(1, '#d9efff');
    b.fillStyle = grd; b.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sun
    b.fillStyle = 'rgba(255,245,200,.9)'; b.beginPath(); b.arc(cssW * 0.8, oy + 150 * scale, 34 * scale, 0, 7); b.fill();
    // clouds
    b.fillStyle = 'rgba(255,255,255,.85)';
    for (var i = 0; i < 6; i++) {
      var cx = rnd(i + 1) * cssW, cy = oy + (80 + rnd(i + 9) * 300) * scale, r = (16 + rnd(i + 3) * 14) * scale;
      b.beginPath(); b.arc(cx, cy, r, 0, 7); b.arc(cx + r, cy + 4 * scale, r * 0.8, 0, 7); b.arc(cx - r, cy + 5 * scale, r * 0.7, 0, 7); b.fill();
    }
    // far hills
    b.fillStyle = '#7fb4a0';
    b.beginPath(); b.moveTo(0, gy);
    for (var x = 0; x <= cssW + 20; x += 20) b.lineTo(x, gy - (60 + Math.sin(x * 0.012) * 30 + Math.sin(x * 0.031) * 12) * scale);
    b.lineTo(cssW, gy); b.fill();
    // far castle silhouette
    b.fillStyle = '#6a9a8c';
    var bx = cssW * 0.12, by = gy - 90 * scale, u = scale;
    b.fillRect(bx, by, 70 * u, 90 * u); b.fillRect(bx - 12 * u, by - 30 * u, 22 * u, 120 * u); b.fillRect(bx + 60 * u, by - 24 * u, 22 * u, 114 * u);
    b.fillStyle = '#5c8e7f';
    b.beginPath(); b.moveTo(cssW, gy);
    for (x = cssW; x >= -20; x -= 20) b.lineTo(x, gy - (28 + Math.sin(x * 0.02 + 1) * 14) * scale);
    b.lineTo(0, gy); b.fill();
    // ground
    var g2 = b.createLinearGradient(0, gy, 0, cssH);
    g2.addColorStop(0, '#6bbf45'); g2.addColorStop(0.08, '#4e9a35'); g2.addColorStop(0.1, '#8a5a32'); g2.addColorStop(1, '#5a3a20');
    b.fillStyle = g2; b.fillRect(0, gy, cssW, cssH - gy);
    b.fillStyle = 'rgba(0,0,0,.08)';
    for (i = 0; i < 40; i++) b.fillRect(rnd(i + 50) * cssW, gy + 14 * scale + rnd(i + 80) * (cssH - gy), 6 * scale, 3 * scale);
    // launcher pedestal
    b.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    b.fillStyle = '#8b8f9c'; b.strokeStyle = '#555a68'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(LP.x - 36, GY); b.lineTo(LP.x - 26, LP.y + 14); b.lineTo(LP.x + 26, LP.y + 14); b.lineTo(LP.x + 36, GY); b.closePath(); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(0,0,0,.18)'; b.lineWidth = 1.5;
    for (var r = 0; r < 4; r++) { var yy = LP.y + 14 + (GY - LP.y - 14) * (r + 1) / 5; b.beginPath(); b.moveTo(LP.x - 32, yy); b.lineTo(LP.x + 32, yy); b.stroke(); }
  }

  // ---------- state ----------
  var game = null, levelIdx = 0, mode = 'title';
  var particles = [], lastTrail = [], curTrail = [], shake = 0, popups = [];
  var aim = null; // {sx,sy,cx,cy}
  var cannonAngle = 30;

  var hooks = {
    onBreak: function (b, mat) { SFX.break(mat); burst(b.position.x, b.position.y, mat, 12); shake = Math.max(shake, mat === 'stone' ? 5 : 3); popup(b.position.x, b.position.y, '+' + Core.MATS[mat].score); },
    onTarget: function (b, k) { SFX.target(); burst(b.position.x, b.position.y, k === 'gem' ? 'gem' : 'gold', 18); popup(b.position.x, b.position.y - 10, '+500', '#ffe14d'); },
    onHit: function (s, mat) { SFX.hit(s, mat); },
    onLaunch: function () { SFX.launch(); shake = 3; burst(LP.x + Math.cos(cannonAngle * Math.PI / 180) * 30, LP.y - Math.sin(cannonAngle * Math.PI / 180) * 30, 'smoke', 10); },
    onWin: function (g) { setTimeout(function () { if (g === game) showResult(true); }, 350); },
    onLose: function (g) { setTimeout(function () { if (g === game) showResult(false); }, 350); }
  };

  var COLORS = {
    wood: { fill: '#c98a4b', dark: '#8a5527', light: '#e2a86a' },
    stone: { fill: '#9ea3b0', dark: '#5f6472', light: '#c3c7d2' },
    ice: { fill: 'rgba(170,225,255,.82)', dark: '#5fa8d6', light: '#e8f8ff' },
    gold: { fill: '#ffd23f' }, gem: { fill: '#e0407b' }, smoke: { fill: 'rgba(240,240,240,.8)' }
  };
  function burst(x, y, mat, n) {
    var col = (COLORS[mat] || COLORS.stone).fill;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 30 + Math.random() * 25, max: 55, s: 3 + Math.random() * 5, c: col, rot: Math.random() * 6, smoke: mat === 'smoke' });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }
  function popup(x, y, text, color) { popups.push({ x: x, y: y, t: 0, text: text, c: color || '#fff' }); }

  function loadLevel(i) {
    levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
    game = Core.createGame(Matter, LEVELS[levelIdx], hooks);
    particles = []; popups = []; lastTrail = []; curTrail = []; aim = null; cannonAngle = 30;
    $('hud-level').textContent = (levelIdx + 1) + '. ' + LEVELS[levelIdx].name;
    updateBalls();
    show('game');
    $('hint').classList.toggle('hidden', !(levelIdx === 0 && !save.hintSeen));
  }
  function updateBalls() {
    var h = '';
    for (var i = 0; i < game.level.balls; i++) h += '<i class="' + (i < game.ballsLeft ? '' : 'used') + '"></i>';
    $('hud-balls').innerHTML = h;
  }

  // ---------- screens ----------
  function show(m) {
    mode = m;
    $('title').classList.toggle('hidden', m !== 'title');
    $('levels').classList.toggle('hidden', m !== 'levels');
    $('result').classList.toggle('hidden', m !== 'result');
    $('hud').classList.toggle('hidden', !(m === 'game' || m === 'result'));
    if (m !== 'game') $('hint').classList.add('hidden');
    var cs = document.querySelectorAll('.coins'); for (var i = 0; i < cs.length; i++) cs[i].textContent = save.coins;
    if (m === 'levels') buildLevelGrid();
  }
  function unlocked(i) { return i === 0 || (save.stars[i - 1] || 0) > 0; }
  function buildLevelGrid() {
    var grid = $('lv-grid'), html = '', total = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      var st = save.stars[i] || 0; total += st;
      if (unlocked(i)) {
        var stars = ''; for (var j = 0; j < 3; j++) stars += j < st ? '<b>&#9733;</b>' : '&#9733;';
        html += '<button class="lv" data-i="' + i + '">' + (i + 1) + '<span class="st">' + stars + '</span></button>';
      } else html += '<button class="lv locked" disabled>&#128274;</button>';
    }
    grid.innerHTML = html;
    $('star-total').textContent = total + ' / ' + LEVELS.length * 3;
  }
  $('lv-grid').addEventListener('click', function (e) {
    var t = e.target.closest('.lv'); if (!t || t.disabled) return;
    audioInit(); SFX.click(); loadLevel(+t.getAttribute('data-i'));
  });
  function firstUnplayed() { for (var i = 0; i < LEVELS.length; i++) if (!save.stars[i]) return i; return LEVELS.length - 1; }
  $('btn-play').onclick = function () { audioInit(); SFX.click(); loadLevel(firstUnplayed()); };
  $('btn-levels').onclick = function () { audioInit(); SFX.click(); show('levels'); };
  $('btn-back').onclick = function () { SFX.click(); show('title'); };
  $('btn-menu').onclick = function () { SFX.click(); show('levels'); };
  $('btn-restart').onclick = function () { audioInit(); SFX.click(); loadLevel(levelIdx); };
  function soundIcon() { $('btn-sound').innerHTML = save.sound ? '&#128266;' : '&#128263;'; }
  $('btn-sound').onclick = function () { save.sound = !save.sound; persist(); soundIcon(); audioInit(); SFX.click(); };
  soundIcon();
  $('res-levels').onclick = function () { SFX.click(); show('levels'); };
  $('res-retry').onclick = function () { SFX.click(); loadLevel(levelIdx); };
  $('res-next').onclick = function () { SFX.click(); if (levelIdx < LEVELS.length - 1 && unlocked(levelIdx + 1)) loadLevel(levelIdx + 1); else show('levels'); };

  function showResult(won) {
    if (!game) return;
    var stars = won ? game.stars : 0;
    if (won) {
      save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, stars);
      save.best[levelIdx] = Math.max(save.best[levelIdx] || 0, game.score);
      save.coins += game.coins;
      persist();
      SFX.win();
    } else SFX.lose();
    $('res-title').textContent = won ? (stars === 3 ? 'Perfect Siege!' : 'Castle Cleared!') : 'Out of Cannonballs';
    var ss = $('res-stars').children;
    for (var i = 0; i < 3; i++) ss[i].className = i < stars ? 'on' : '';
    $('res-score').textContent = 'Score ' + game.score.toLocaleString() + (won ? '   Best ' + save.best[levelIdx].toLocaleString() : '');
    $('res-coins').innerHTML = won ? (game.ballsLeft > 0 ? '&#129689; +' + game.coins + ' coins (' + game.ballsLeft + ' unused ball' + (game.ballsLeft > 1 ? 's' : '') + ')' : 'No balls left for bonus coins') : 'Some targets are still standing. Try again!';
    var hasNext = won && levelIdx < LEVELS.length - 1;
    $('res-next').classList.toggle('hidden', !hasNext);
    $('res-next').innerHTML = 'Next &#9654;';
    show('result');
  }

  // ---------- input ----------
  var PULL_MAX = 110; // css px for full power
  function toWorld(px, py) { return { x: (px - ox) / scale, y: (py - oy) / scale }; }
  function aimFromDrag() {
    var dx = aim.sx - aim.cx, dy = aim.sy - aim.cy; // pull back -> fire forward
    var len = Math.sqrt(dx * dx + dy * dy);
    var power = Math.min(1, len / PULL_MAX);
    var ang = Math.atan2(-dy, dx) * 180 / Math.PI;
    ang = Math.max(-25, Math.min(88, ang));
    return { angle: ang, power: power, len: len };
  }
  canvas.addEventListener('pointerdown', function (e) {
    audioInit();
    if (mode !== 'game' || !game || game.phase !== 'aim') return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    aim = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, id: e.pointerId };
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!aim || e.pointerId !== aim.id) return;
    aim.cx = e.clientX; aim.cy = e.clientY;
    var a = aimFromDrag(); if (a.len > 8) cannonAngle = a.angle;
    e.preventDefault();
  });
  function release(e) {
    if (!aim || (e && e.pointerId !== aim.id)) return;
    var a = aimFromDrag(); aim = null;
    if (a.len < 14 || !game || game.phase !== 'aim') return;
    fire(a.angle, a.power);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function () { aim = null; });
  function fire(angle, power) {
    cannonAngle = angle;
    if (!game.fire(game.aimVelocity(angle, power))) return false;
    if (curTrail.length) lastTrail = curTrail;
    curTrail = [];
    if (!save.hintSeen) { save.hintSeen = true; persist(); $('hint').classList.add('hidden'); }
    updateBalls();
    return true;
  }
  // block pinch zoom / double-tap zoom / scroll bounce on iOS
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (!e.target.closest || !e.target.closest('#lv-grid')) e.preventDefault(); }, { passive: false });
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) { var n = Date.now(); if (n - lastTouchEnd < 300 && e.target === canvas) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- rendering ----------
  function poly(c, verts) { c.beginPath(); c.moveTo(verts[0].x, verts[0].y); for (var i = 1; i < verts.length; i++) c.lineTo(verts[i].x, verts[i].y); c.closePath(); }
  function drawBlock(b) {
    var cc = b.plugin.cc, col = COLORS[cc.mat];
    poly(ctx, b.vertices);
    ctx.fillStyle = col.fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = col.dark; ctx.stroke();
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    var w = cc.w, h = cc.h;
    if (!cc.roof) {
      if (cc.mat === 'wood') {
        ctx.strokeStyle = 'rgba(110,60,20,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
        if (w >= h) { for (var y = -h / 2 + 5; y < h / 2 - 2; y += 6) { ctx.moveTo(-w / 2 + 3, y); ctx.lineTo(w / 2 - 3, y); } }
        else { for (var x = -w / 2 + 5; x < w / 2 - 2; x += 6) { ctx.moveTo(x, -h / 2 + 3); ctx.lineTo(x, h / 2 - 3); } }
        ctx.stroke();
      } else if (cc.mat === 'stone') {
        ctx.strokeStyle = 'rgba(60,64,80,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
        var rows = Math.max(1, Math.round(h / 16)), rh = h / rows;
        for (var r = 1; r < rows; r++) { ctx.moveTo(-w / 2, -h / 2 + r * rh); ctx.lineTo(w / 2, -h / 2 + r * rh); }
        for (r = 0; r < rows; r++) { var off = (r % 2) * 0.5, cols = Math.max(1, Math.round(w / 24)); for (var c2 = 1; c2 <= cols; c2++) { var xx = -w / 2 + ((c2 - off) / cols) * w; if (xx > -w / 2 + 2 && xx < w / 2 - 2) { ctx.moveTo(xx, -h / 2 + r * rh); ctx.lineTo(xx, -h / 2 + (r + 1) * rh); } } }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.moveTo(-w / 2 + 3, -h / 2 + 3); ctx.lineTo(-w / 2 + Math.min(w, 14), -h / 2 + 3); ctx.lineTo(-w / 2 + 3, -h / 2 + Math.min(h, 14)); ctx.fill();
      }
    }
    var dmg = 1 - cc.hp / cc.maxHp;
    if (dmg > 0.25) {
      ctx.strokeStyle = 'rgba(30,20,10,' + (0.3 + dmg * 0.5) + ')'; ctx.lineWidth = 1.4; ctx.beginPath();
      var n = dmg > 0.6 ? 3 : 1;
      for (var i = 0; i < n; i++) {
        var sx = (rnd(cc.seed + i) - 0.5) * w * 0.6, sy = (rnd(cc.seed + i + 9) - 0.5) * h * 0.6;
        ctx.moveTo(sx, sy); ctx.lineTo(sx + (rnd(cc.seed + i + 3) - 0.5) * w * 0.5, sy + (rnd(cc.seed + i + 5) - 0.5) * h * 0.5);
        ctx.lineTo(sx + (rnd(cc.seed + i + 7) - 0.5) * w * 0.7, sy + (rnd(cc.seed + i + 4) - 0.5) * h * 0.7);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawTarget(b, t) {
    var cc = b.plugin.cc;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    var bob = 0;
    if (cc.k === 'crown') {
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b5770d'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-13, 10); ctx.lineTo(13, 10); ctx.lineTo(13, -3); ctx.lineTo(13, -10); ctx.lineTo(7, -2); ctx.lineTo(0, -11); ctx.lineTo(-7, -2); ctx.lineTo(-13, -10); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0407b'; ctx.beginPath(); ctx.arc(0, 3, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#3fa8e0'; ctx.beginPath(); ctx.arc(-7, 4, 2, 0, 7); ctx.arc(7, 4, 2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-11, 6, 22, 2);
    } else {
      poly(ctx, [{ x: 11, y: 0 }, { x: 5.5, y: 9.5 }, { x: -5.5, y: 9.5 }, { x: -11, y: 0 }, { x: -5.5, y: -9.5 }, { x: 5.5, y: -9.5 }]);
      ctx.fillStyle = '#e0407b'; ctx.fill(); ctx.strokeStyle = '#8a1440'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-5.5, -9.5); ctx.lineTo(5.5, -9.5); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-5.5, -9.5); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // sparkle
    var s = (Math.sin(t * 0.005 + b.id) + 1) / 2;
    if (s > 0.85) { ctx.fillStyle = 'rgba(255,255,255,' + (s - 0.85) * 6 + ')'; ctx.beginPath(); ctx.arc(b.position.x + 8, b.position.y - 9, 2.5, 0, 7); ctx.fill(); }
  }
  function drawBall(b, alpha) {
    ctx.globalAlpha = alpha;
    var g = ctx.createRadialGradient(b.position.x - 4, b.position.y - 4, 2, b.position.x, b.position.y, Core.BALL_R);
    g.addColorStop(0, '#a7afc2'); g.addColorStop(1, '#262a36');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, Core.BALL_R, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawCannon() {
    ctx.save(); ctx.translate(LP.x, LP.y); ctx.rotate(-cannonAngle * Math.PI / 180);
    ctx.fillStyle = '#2f3443'; ctx.strokeStyle = '#151821'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(34, -10); ctx.lineTo(34, 10); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a5166'; ctx.fillRect(28, -12, 8, 24); ctx.strokeRect(28, -12, 8, 24);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-6, -10, 34, 4);
    ctx.restore();
    // wheel
    ctx.fillStyle = '#7a4a22'; ctx.strokeStyle = '#3e230d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(LP.x - 2, LP.y + 6, 11, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3e230d'; ctx.beginPath(); ctx.arc(LP.x - 2, LP.y + 6, 3, 0, 7); ctx.fill();
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    var sx = 0, sy = 0;
    if (shake > 0.1) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake *= 0.85; }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));
    if (!game) return;
    // statics
    for (var i = 0; i < game.statics.length; i++) {
      var s = game.statics[i];
      poly(ctx, s.vertices); ctx.fillStyle = '#5b5f6e'; ctx.fill(); ctx.strokeStyle = '#33363f'; ctx.lineWidth = 2; ctx.stroke();
      var mn = s.bounds.min, mx = s.bounds.max;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath();
      for (var yy = mn.y + 14; yy < mx.y - 2; yy += 14) { ctx.moveTo(mn.x + 2, yy); ctx.lineTo(mx.x - 2, yy); }
      ctx.stroke();
      ctx.fillStyle = '#6bbf45'; ctx.fillRect(mn.x, mn.y - 2, mx.x - mn.x, 4);
    }
    // last shot trail
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (i = 0; i < lastTrail.length; i += 2) { ctx.beginPath(); ctx.arc(lastTrail[i].x, lastTrail[i].y, 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (i = 0; i < curTrail.length; i += 2) { ctx.beginPath(); ctx.arc(curTrail[i].x, curTrail[i].y, 2, 0, 7); ctx.fill(); }
    for (i = 0; i < game.blocks.length; i++) if (!game.blocks[i].plugin.cc.dead) drawBlock(game.blocks[i]);
    for (i = 0; i < game.targets.length; i++) if (!game.targets[i].plugin.cc.dead) drawTarget(game.targets[i], t);
    for (i = 0; i < game.oldBalls.length; i++) drawBall(game.oldBalls[i], Math.max(0, 1 - (game.stepCount - game.oldBalls[i].plugin.cc.fadeAt) / 45));
    if (game.ball) drawBall(game.ball, 1);
    drawCannon();
    // aiming
    if (aim && game.phase === 'aim') {
      var a = aimFromDrag();
      if (a.len > 8) {
        var v = game.aimVelocity(a.angle, a.power), pts = game.predict(v, 34);
        for (i = 1; i < pts.length; i += 2) {
          var f = 1 - i / pts.length;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + f * 0.6) + ')';
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 2 + f * 2.5, 0, 7); ctx.fill();
        }
        // power meter
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(LP.x, LP.y, 46, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
        ctx.strokeStyle = a.power > 0.85 ? '#ff5a3c' : a.power > 0.5 ? '#ffb400' : '#7ddc4a';
        ctx.beginPath(); ctx.arc(LP.x, LP.y, 46, Math.PI * 1.4 - Math.PI * 0.8 * a.power, Math.PI * 1.4); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px -apple-system, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Math.round(a.power * 100) + '%', LP.x, LP.y - 54);
      }
    } else if (game.phase === 'aim' && !aim) {
      // idle pulse ring on the cannon
      var p = (t % 1400) / 1400;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - p)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(LP.x, LP.y, 20 + p * 22, 0, 7); ctx.stroke();
    }
    // particles
    for (i = 0; i < particles.length; i++) {
      var q = particles[i], al = q.life / q.max;
      ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = q.c;
      if (q.smoke) { ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (2 - al), 0, 7); ctx.fill(); }
      else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = 'bold 15px -apple-system, sans-serif';
    for (i = 0; i < popups.length; i++) {
      var pp = popups[i]; ctx.globalAlpha = Math.max(0, 1 - pp.t / 50);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillText(pp.text, pp.x + 1, pp.y - pp.t * 0.6 + 1);
      ctx.fillStyle = pp.c; ctx.fillText(pp.text, pp.x, pp.y - pp.t * 0.6);
    }
    ctx.globalAlpha = 1;
    // score
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'right'; ctx.font = 'bold 15px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillText(game.score.toLocaleString(), cssW - safe.r - 13, safe.t + 74);
    ctx.fillStyle = '#fff'; ctx.fillText(game.score.toLocaleString(), cssW - safe.r - 14, safe.t + 73);
  }

  function stepFx() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var q = particles[i]; q.x += q.vx; q.y += q.vy; q.rot += 0.2;
      if (q.smoke) { q.vx *= 0.92; q.vy = q.vy * 0.92 - 0.05; } else q.vy += 0.35;
      if (--q.life <= 0) particles.splice(i, 1);
    }
    for (i = popups.length - 1; i >= 0; i--) if (++popups[i].t > 50) popups.splice(i, 1);
    if (game && game.ball && game.phase === 'flying' && game.stepCount % 2 === 0 && curTrail.length < 300) curTrail.push({ x: game.ball.position.x, y: game.ball.position.y });
  }

  // ---------- main loop (fixed 60 Hz physics) ----------
  var acc = 0, last = performance.now(), STEP = 1000 / 60, prevPhase = null;
  var fpsFrames = 0, fpsT = last; window.__fps = 0;
  function frame(now) {
    var dt = Math.min(100, now - last); last = now;
    fpsFrames++; if (now - fpsT >= 1000) { window.__fps = fpsFrames * 1000 / (now - fpsT); fpsFrames = 0; fpsT = now; }
    if (game && (mode === 'game' || mode === 'result')) {
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 4) { game.step(); stepFx(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      if (game.phase !== prevPhase) { prevPhase = game.phase; updateBalls(); }
    }
    render(now);
    requestAnimationFrame(frame);
  }

  // ---------- test hooks ----------
  window.CastleCrash = {
    get game() { return game; }, get mode() { return mode; }, get save() { return save; },
    loadLevel: loadLevel, fire: fire, levels: LEVELS, show: show,
    worldToScreen: function (x, y) { return { x: ox + x * scale, y: oy + y * scale }; },
    pullMax: PULL_MAX
  };

  resize();
  // preview level 1 behind the title screen
  game = Core.createGame(Matter, LEVELS[0], {});
  show('title');
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
