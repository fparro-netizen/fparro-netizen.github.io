// Castle Crash - first-person 3D, many-piece stacked structures (three.js + Rapier).
import * as THREE from './lib/three.module.js';
import RAPIER from './lib/rapier.js';
import { createGame, CAMERA, MUZZLE, LOOK, BALL_R, PLATFORM_TOP, CENTER_Z } from './core.js';
import LEVELS from './levels.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ---------- save data ----------
const SAVE_KEY = 'castleCrashStack.v1';
const save = { stars: {}, best: {}, shots: {}, coins: 0, sound: true, hintSeen: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- audio ----------
let AC = null, master = null, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C(); master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function tone(freq, dur, type, vol, slideTo, delay = 0) {
  if (!AC || !save.sound) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, type, freq, vol, q = 1, delay = 0) {
  if (!AC || !save.sound) return;
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
let hitBudget = 0, lastHitT = 0;
const SFX = {
  fire() { noise(0.25, 'lowpass', 800, 0.5); tone(150, 0.2, 'sine', 0.5, 55); },
  impact(mat, s) {
    const n = performance.now(); if (n - lastHitT > 1000) hitBudget = 0;
    if (n - lastHitT < 28 || hitBudget > 40) return; lastHitT = n; hitBudget++;
    const v = Math.min(0.35, 0.05 + s * 0.004);
    if (mat === 'ice') tone(1400 + Math.random() * 800, 0.07, 'triangle', v * 0.6);
    else if (mat === 'stone') noise(0.08, 'lowpass', 500 + Math.random() * 300, v);
    else tone(260 + Math.random() * 220, 0.07, 'triangle', v, 140);
  },
  shatter() { for (let i = 0; i < 4; i++) tone(1800 + Math.random() * 1500, 0.12, 'triangle', 0.07, null, i * 0.025); noise(0.15, 'highpass', 4000, 0.15); },
  bonus() { tone(880, 0.12, 'square', 0.1); tone(1320, 0.2, 'square', 0.08, null, 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.25, 'square', 0.09, null, i * 0.12); tone(f / 2, 0.25, 'triangle', 0.14, null, i * 0.12); }); },
  click() { tone(660, 0.05, 'square', 0.06); }
};

// ---------- three.js ----------
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe9ff, 40, 140);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
const LOOKV = new THREE.Vector3(LOOK.x, LOOK.y, LOOK.z);

{ // sky
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f6ad6) }, mid: { value: new THREE.Color(0x92ccff) }, bot: { value: new THREE.Color(0xe8f6ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.1 ? mix(mid, top, smoothstep(0.1, 0.7, h)) : mix(bot, mid, smoothstep(-0.3, 0.1, h)); gl_FragColor = vec4(c, 1.0); }'
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(250, 24, 12), mat));
}
scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x6a7f5a, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
sun.position.set(-6, 14, 4); sun.target.position.set(0, 0, CENTER_Z);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -5, near: 2, far: 40 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const rnd = (s) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
function canvasTex(draw, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// bevelled block face: light center, darker rim, so tinted instances read as separate pieces
const bevelTex = canvasTex((x, S) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 7; x.strokeRect(0, 0, S, S);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; x.strokeRect(8, 8, S - 16, S - 16);
});
const grassTex = canvasTex((x, S) => {
  x.fillStyle = '#62b543'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { x.fillStyle = rnd(i) > .5 ? 'rgba(40,110,30,.35)' : 'rgba(160,220,100,.3)'; x.fillRect(rnd(i + 1) * S, rnd(i + 2) * S, 2, 4); }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(3, 3);
const rockTex = canvasTex((x, S) => {
  x.fillStyle = '#7d6a58'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${rnd(i + 7) * 0.2})`; x.fillRect(rnd(i + 5) * S, rnd(i + 6) * S, 5, 3); }
});
rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping; rockTex.repeat.set(4, 2);

const MAT = {
  solid: new THREE.MeshStandardMaterial({ map: bevelTex, roughness: 0.55, metalness: 0.0 }),
  ice: new THREE.MeshStandardMaterial({ map: bevelTex, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.72 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.65, roughness: 0.28, emissive: 0x4a3000 }),
  jewel: new THREE.MeshStandardMaterial({ color: 0xff3d8b, roughness: 0.2, emissive: 0x40001a }),
  ball: new THREE.MeshStandardMaterial({ color: 0x23262f, metalness: 0.75, roughness: 0.3 }),
  stoneDeco: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.95 })
};
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  sphere: new THREE.SphereGeometry(0.5, 16, 10),
  ball: new THREE.SphereGeometry(BALL_R, 18, 12)
};

// ---------- scenery ----------
{
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x3f8fd1, roughness: 0.35, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -30; scene.add(sea);
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x6f9f62, roughness: 1, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7462, roughness: 1, flatShading: true });
  for (let i = 0; i < 8; i++) { // distant floating islands
    const r = 3 + rnd(i) * 6, g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 1.2, 9), islandMat); g.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 1.6, 9), rockMat); under.rotation.x = Math.PI; under.position.y = -r * 0.8 - 0.6; g.add(under);
    g.position.set(-70 + i * 20 + rnd(i + 2) * 8, -6 + rnd(i + 3) * 16, -60 - rnd(i + 4) * 50); scene.add(g);
  }
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x666666, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rnd(i * 4 + j) * 1.6, 0), cm); p.position.set(j * 2.3, rnd(j + i) * 1.0, 0); g.add(p); }
    g.position.set(-60 + i * 15, 14 + rnd(i) * 14, -50 - rnd(i + 1) * 40); scene.add(g);
  }
  // player's battlement + cannon
  const front = new THREE.Mesh(GEO.box, MAT.stoneDeco); front.scale.set(9, 2.0, 0.6); front.position.set(0, 1.0, CAMERA.z - 1.7); front.receiveShadow = true; scene.add(front);
  for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 1) continue; const m = new THREE.Mesh(GEO.box, MAT.stoneDeco); m.scale.set(0.6, 0.5, 0.6); m.position.set(i * 1.0, 2.25, CAMERA.z - 1.7); scene.add(m); }
  const under = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 8), rockMat); under.rotation.x = Math.PI; under.position.set(0, -7, CAMERA.z); scene.add(under);
}
const cannon = new THREE.Group();
{
  const bm = new THREE.MeshStandardMaterial({ color: 0x30343f, metalness: 0.7, roughness: 0.4 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 1.3, 16), bm); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.35; cannon.add(barrel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 16), bm); rim.position.z = 1.0; cannon.add(rim);
  scene.add(cannon);
}
const cannonBase = new THREE.Vector3(MUZZLE.x, MUZZLE.y - 0.3, MUZZLE.z + 0.8);
const aimTarget = new THREE.Vector3(LOOK.x, LOOK.y, LOOK.z);

// level platform (rebuilt per level)
const platformGroup = new THREE.Group(); scene.add(platformGroup);
function buildPlatform(pf) {
  platformGroup.clear();
  const top = new THREE.Mesh(GEO.box, [MAT.stoneDeco, MAT.stoneDeco, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }), MAT.stoneDeco, MAT.stoneDeco, MAT.stoneDeco]);
  top.scale.set(pf.w, 0.6, pf.d); top.position.set(0, PLATFORM_TOP - 0.3, CENTER_Z); top.receiveShadow = true; platformGroup.add(top);
  const r = pf.w * 0.49;
  const under = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 8, 1), new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1, flatShading: true }));
  under.rotation.x = Math.PI; under.scale.z = pf.d / pf.w; under.position.set(0, PLATFORM_TOP - 0.6 - r * 1.1, CENTER_Z); platformGroup.add(under);
  return top;
}

// ---------- instanced pieces ----------
let groups = {}; // key -> { mesh, pieces: [] }
const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
const ballMeshes = new Map();
const crownMeshes = new Map();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _c = new THREE.Color();
function crownMesh() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.18, 14, 1, true), MAT.gold); band.position.y = -0.06; g.add(band);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14), MAT.gold); base.position.y = -0.15; g.add(base);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), MAT.gold); s.position.set(Math.cos(a) * 0.18, 0.11, Math.sin(a) * 0.18); g.add(s);
    if (i % 2) { const j = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), MAT.jewel); j.position.set(Math.cos(a) * 0.2, -0.06, Math.sin(a) * 0.2); g.add(j); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function clearPieces() {
  for (const k in groups) { pieceRoot.remove(groups[k].mesh); groups[k].mesh.dispose(); }
  groups = {};
  for (const m of crownMeshes.values()) pieceRoot.remove(m); crownMeshes.clear();
  for (const m of ballMeshes.values()) pieceRoot.remove(m); ballMeshes.clear();
}
function buildPieces(g) {
  clearPieces();
  const lists = {};
  for (const p of g.pieces) { const k = p.shape + (p.m === 'ice' ? ':ice' : ':solid'); (lists[k] = lists[k] || []).push(p); }
  for (const k in lists) {
    const [shape, cls] = k.split(':');
    const mesh = new THREE.InstancedMesh(GEO[shape], MAT[cls], lists[k].length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true; mesh.receiveShadow = cls !== 'ice'; mesh.frustumCulled = false;
    lists[k].forEach((p, i) => { p.gk = k; p.gi = i; mesh.setColorAt(i, _c.set(p.c)); });
    mesh.instanceColor.needsUpdate = true;
    groups[k] = { mesh, pieces: lists[k] };
    pieceRoot.add(mesh);
  }
  for (const p of g.bonus) { const m = crownMesh(); crownMeshes.set(p, m); pieceRoot.add(m); }
  syncAll(g, true);
}
function syncAll(g, force) {
  const w = g.world;
  for (const k in groups) {
    const gr = groups[k]; let dirty = force;
    for (const p of gr.pieces) {
      if (p.gone) { if (!p.hidden) { gr.mesh.setMatrixAt(p.gi, _zero); p.hidden = true; dirty = true; } continue; }
      const b = w.getRigidBody(p.h);
      if (!force && b.isSleeping() && p.synced) continue;
      const t = b.translation(), r = b.rotation();
      _m.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s.set(p.sx, p.sy, p.sz));
      gr.mesh.setMatrixAt(p.gi, _m); p.synced = true; dirty = true;
    }
    if (dirty) gr.mesh.instanceMatrix.needsUpdate = true;
  }
  for (const [p, m] of crownMeshes) {
    if (p.gone) { m.visible = false; continue; }
    const b = w.getRigidBody(p.h), t = b.translation(), r = b.rotation();
    m.position.set(t.x, t.y, t.z); m.quaternion.set(r.x, r.y, r.z, r.w);
  }
  for (const [o, m] of ballMeshes) {
    const b = o.gone ? null : w.getRigidBody(o.h);
    if (!b) { pieceRoot.remove(m); ballMeshes.delete(o); continue; }
    const t = b.translation(), r = b.rotation(); m.position.set(t.x, t.y, t.z); m.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

// debris for shattered ice
const debris = [];
const debrisGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const debrisMat = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.85, roughness: 0.1 });
function spawnDebris(t, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(debrisGeo, debrisMat); m.position.set(t.x, t.y, t.z); scene.add(m);
    debris.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5), life: 0.7 + Math.random() * 0.5 });
  }
  while (debris.length > 90) { const d = debris.shift(); scene.remove(d.m); }
}

// ---------- game state ----------
let game = null, levelIdx = 0, mode = 'title', shake = 0, recoil = 0, platformMesh = null;
const hooks = {
  onImpact(p, gs) { if (gs > 30) SFX.impact(p.m, gs); },
  onShatter(p) { SFX.shatter(); const b = game.world.getRigidBody(p.h); spawnDebris(b ? b.translation() : { x: 0, y: 1, z: CENTER_Z }, 8); },
  onRemove(p) {},
  onOff() { updateHud(); },
  onBonus() { SFX.bonus(); popup('+5 \u{1FA99}'); updateHud(); },
  onFire() { SFX.fire(); updateHud(); },
  onBallRemoved() {},
  onWin(g) { recordWin(g); setTimeout(() => { if (g === game) showResult(); }, 250); }
};
function popup(text) { const el = document.createElement('div'); el.className = 'popup'; el.textContent = text; $('popups').appendChild(el); setTimeout(() => el.remove(), 900); }

function loadLevel(i) {
  levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
  if (game) game.free();
  game = createGame(RAPIER, LEVELS[levelIdx], hooks);
  platformMesh = buildPlatform(game.platform);
  buildPieces(game);
  $('hud-level').textContent = (levelIdx + 1) + '. ' + LEVELS[levelIdx].name;
  updateHud();
  show('game');
  $('hint').classList.toggle('hidden', !(levelIdx === 0 && !save.hintSeen));
}
function updateHud() {
  if (!game) return;
  const pct = Math.floor(100 * game.off / game.total);
  $('bar-fill').style.width = Math.round(100 * game.progress()) + '%';
  $('bar-text').textContent = pct + '% of 100%';
  $('hud-shots').textContent = 'Shots ' + game.shots + '  \u00b7  \u2605\u2605\u2605 in ' + game.level.par;
  $('hud-crowns').textContent = game.bonus.length ? '\u{1F451} ' + game.bonusOff + '/' + game.bonus.length : '';
}

// ---------- screens ----------
function show(m) {
  mode = m;
  $('title').classList.toggle('hidden', m !== 'title');
  $('levels').classList.toggle('hidden', m !== 'levels');
  $('result').classList.toggle('hidden', m !== 'result');
  $('hud').classList.toggle('hidden', !(m === 'game' || m === 'result'));
  $('progress').classList.toggle('hidden', !(m === 'game' || m === 'result'));
  if (m !== 'game') { $('hint').classList.add('hidden'); hideCross(); }
  document.querySelectorAll('.coins').forEach(c => c.textContent = save.coins);
  if (m === 'levels') buildLevelGrid();
}
const unlocked = (i) => i === 0 || (save.stars[i - 1] || 0) > 0;
function buildLevelGrid() {
  let html = '', total = 0;
  LEVELS.forEach((L, i) => {
    const st = save.stars[i] || 0; total += st;
    if (unlocked(i)) { let s = ''; for (let j = 0; j < 3; j++) s += j < st ? '<b>\u2605</b>' : '\u2605'; html += `<button class="lv" data-i="${i}">${i + 1}<span class="st">${s}</span></button>`; }
    else html += '<button class="lv locked" disabled>\u{1F512}</button>';
  });
  $('lv-grid').innerHTML = html;
  $('star-total').textContent = total + ' / ' + LEVELS.length * 3;
}
$('lv-grid').addEventListener('click', (e) => { const t = e.target.closest('.lv'); if (!t || t.disabled) return; audioInit(); SFX.click(); loadLevel(+t.dataset.i); });
const firstUnplayed = () => { for (let i = 0; i < LEVELS.length; i++) if (!save.stars[i]) return i; return LEVELS.length - 1; };
$('btn-play').onclick = () => { audioInit(); SFX.click(); loadLevel(firstUnplayed()); };
$('btn-levels').onclick = () => { audioInit(); SFX.click(); show('levels'); };
$('btn-back').onclick = () => { SFX.click(); show('title'); };
$('btn-menu').onclick = () => { SFX.click(); show('levels'); };
$('btn-restart').onclick = () => { audioInit(); SFX.click(); loadLevel(levelIdx); };
const soundIcon = () => { $('btn-sound').textContent = save.sound ? '\u{1F50A}' : '\u{1F507}'; };
$('btn-sound').onclick = () => { save.sound = !save.sound; persist(); soundIcon(); audioInit(); SFX.click(); };
soundIcon();
$('res-levels').onclick = () => { SFX.click(); show('levels'); };
$('res-retry').onclick = () => { SFX.click(); loadLevel(levelIdx); };
$('res-next').onclick = () => { SFX.click(); if (levelIdx < LEVELS.length - 1) loadLevel(levelIdx + 1); else show('levels'); };

function recordWin(g) {
  const i = LEVELS.indexOf(g.level); if (i < 0) return;
  save.stars[i] = Math.max(save.stars[i] || 0, g.stars);
  save.best[i] = Math.max(save.best[i] || 0, g.score);
  save.shots[i] = Math.min(save.shots[i] || 999, g.shots);
  save.coins += g.coins; persist();
}
function showResult() {
  SFX.win();
  const s = game.stars;
  $('res-title').textContent = s === 3 ? 'Perfect Smash!' : 'Cleared!';
  [...$('res-stars').children].forEach((el, i) => el.className = i < s ? 'on' : '');
  $('res-score').textContent = `${game.shots} shot${game.shots > 1 ? 's' : ''}  \u00b7  3 stars in ${game.level.par}  \u00b7  ${Math.floor(100 * game.off / game.total)}% cleared`;
  $('res-coins').textContent = `\u{1FA99} +${game.coins} coins` + (game.bonus.length ? `   \u{1F451} ${game.bonusOff}/${game.bonus.length}` : '');
  $('res-next').classList.toggle('hidden', levelIdx >= LEVELS.length - 1);
  show('result');
}

// ---------- input: tap to fire, or hold-drag-release with a crosshair ----------
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let press = null, lastFire = 0;
const cross = $('cross');
function showCross(x, y) { cross.style.transform = `translate(${x}px, ${y}px)`; cross.classList.remove('hidden'); }
function hideCross() { cross.classList.add('hidden'); }
function aimPoint(sx, sy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [pieceRoot]; if (platformMesh) targets.push(platformMesh);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) return hits[0].point;
  return raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(30));
}
function fireAtWorld(p) {
  if (!game || game.phase !== 'play') return false;
  aimTarget.set(p.x, p.y, p.z);
  const o = game.fireAt({ x: p.x, y: p.y, z: p.z }); if (!o) return false;
  const m = new THREE.Mesh(GEO.ball, MAT.ball); m.castShadow = true; m.position.set(MUZZLE.x, MUZZLE.y, MUZZLE.z);
  ballMeshes.set(o, m); pieceRoot.add(m);
  recoil = 0.3; shake = Math.max(shake, 0.03);
  if (!save.hintSeen) { save.hintSeen = true; persist(); $('hint').classList.add('hidden'); }
  return true;
}
function fireAtScreen(sx, sy) {
  if (mode !== 'game') return false;
  const now = performance.now(); if (now - lastFire < 160) return false; lastFire = now;
  return fireAtWorld(aimPoint(sx, sy));
}
canvas.addEventListener('pointerdown', (e) => {
  audioInit();
  if (mode !== 'game' || !game || game.phase !== 'play') return;
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  showCross(e.clientX, e.clientY); aimTarget.copy(aimPoint(e.clientX, e.clientY));
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => { if (!press || e.pointerId !== press.id) return; press.x = e.clientX; press.y = e.clientY; showCross(press.x, press.y); aimTarget.copy(aimPoint(press.x, press.y)); e.preventDefault(); });
canvas.addEventListener('pointerup', (e) => { if (!press || e.pointerId !== press.id) return; const p = press; press = null; hideCross(); fireAtScreen(p.x, p.y); });
canvas.addEventListener('pointercancel', () => { press = null; hideCross(); });
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('#lv-grid')) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 300 && e.target === canvas) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- layout ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const vfov = 2 * Math.atan(Math.tan((17.5 * Math.PI) / 180) / camera.aspect) * 180 / Math.PI;
  camera.fov = Math.max(42, Math.min(75, vfov));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- loop ----------
let acc = 0, last = performance.now(), fpsFrames = 0, fpsT = last;
window.__fps = 0; window.__physMs = 0; let physSum = 0, physN = 0, physWorst = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsFrames++; if (now - fpsT >= 1000) { window.__fps = fpsFrames * 1000 / (now - fpsT); fpsFrames = 0; fpsT = now; }
  if (game && (mode === 'game' || mode === 'result')) {
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 3) {
      const t0 = performance.now(); game.step(); const d = performance.now() - t0;
      physSum += d; physN++; if (d > physWorst) physWorst = d;
      acc -= 1 / 60; n++;
    }
    if (n === 3) acc = 0;
    if (physN >= 60) { window.__physMs = physSum / physN; window.__physWorst = physWorst; physSum = 0; physN = 0; physWorst = 0; }
    syncAll(game, false);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt; d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += dt * 6;
    if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); }
  }
  cannon.position.copy(cannonBase); cannon.lookAt(aimTarget);
  if (recoil > 0.001) { cannon.translateZ(-recoil); recoil *= 0.85; }
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.85; }
  camera.lookAt(LOOKV);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- test hooks ----------
window.CastleCrash = {
  get game() { return game; }, get mode() { return mode; }, get save() { return save; }, levels: LEVELS,
  loadLevel, show, fireAtScreen, fireWorldDirect: (x, y, z) => fireAtWorld({ x, y, z }),
  worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  get renderInfo() { return renderer.info.render; }, get physMs() { return { avg: window.__physMs, worst: window.__physWorst }; }
};

await RAPIER.init();
resize();
loadLevel(0); show('title');
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
