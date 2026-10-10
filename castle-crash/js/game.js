// Castle Crash 3D - rendering (three.js), input, audio, menus.
import * as THREE from './lib/three.module.js';
import * as CANNON from './lib/cannon-es.js';
import { createGame, CAMERA, MUZZLE, BALL_R, MATS } from './core.js';
import LEVELS from './levels.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ---------- save data ----------
const SAVE_KEY = 'castleCrash3d.v1';
const save = { stars: {}, best: {}, shots: {}, coins: 0, sound: true, hintSeen: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- audio ----------
let AC = null, master = null, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C(); master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
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
let lastHit = 0;
const SFX = {
  fire() { noise(0.25, 'lowpass', 800, 0.5); tone(150, 0.2, 'sine', 0.5, 55); },
  hit(s, mat) {
    const n = performance.now(); if (n - lastHit < 50) return; lastHit = n;
    if (mat === 'ice') tone(1500 + Math.random() * 500, 0.08, 'triangle', 0.08 + s * 0.15);
    else if (mat === 'wood') tone(210 + Math.random() * 60, 0.1, 'triangle', 0.12 + s * 0.25, 110);
    else noise(0.12, 'lowpass', 450, 0.15 + s * 0.3);
  },
  break(mat) {
    if (mat === 'ice') { for (let i = 0; i < 4; i++) tone(1800 + Math.random() * 1500, 0.12, 'triangle', 0.08, null, i * 0.025); noise(0.15, 'highpass', 4000, 0.15); }
    else if (mat === 'wood') { noise(0.22, 'bandpass', 700, 0.45, 2); tone(160, 0.15, 'square', 0.05, 70); }
    else { noise(0.35, 'lowpass', 380, 0.6); tone(90, 0.3, 'sine', 0.3, 40); }
  },
  target() { tone(880, 0.12, 'square', 0.12); tone(1320, 0.2, 'square', 0.1, null, 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.25, 'square', 0.1, null, i * 0.12); tone(f / 2, 0.25, 'triangle', 0.15, null, i * 0.12); }); },
  click() { tone(660, 0.05, 'square', 0.06); }
};

// ---------- three.js setup ----------
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe3ff, 45, 120);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
const LOOK = new THREE.Vector3(0, 1.5, -8);
camera.lookAt(LOOK);

// sky dome with vertical gradient
{
  const geo = new THREE.SphereGeometry(200, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f6ad6) }, mid: { value: new THREE.Color(0x8ec8ff) }, bot: { value: new THREE.Color(0xe6f5ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c, 1.0); }'
  });
  scene.add(new THREE.Mesh(geo, mat));
}
const hemi = new THREE.HemisphereLight(0xdff0ff, 0x5a7a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(-8, 16, 10);
sun.target.position.set(0, 0, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 50 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// procedural canvas textures
function canvasTex(draw, size = 128, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4; return t;
}
const rnd = (s) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const TEX = {
  wood: canvasTex((x, S) => {
    x.fillStyle = '#c98a4b'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#c08044' : '#d39552'; x.fillRect(0, i * S / 4, S, S / 4); x.fillStyle = 'rgba(90,45,15,.55)'; x.fillRect(0, i * S / 4, S, 2); }
    x.strokeStyle = 'rgba(110,60,20,.3)'; for (let i = 0; i < 18; i++) { x.beginPath(); const y = rnd(i) * S; x.moveTo(0, y); x.bezierCurveTo(S / 3, y + 4, S * 2 / 3, y - 4, S, y); x.stroke(); }
    x.strokeStyle = '#7a4a22'; x.lineWidth = 6; x.strokeRect(0, 0, S, S);
  }),
  stone: canvasTex((x, S) => {
    x.fillStyle = '#8f95a3'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rnd(i) > .5 ? '255,255,255' : '0,0,0'},${0.05 + rnd(i + 1) * 0.08})`; x.fillRect(rnd(i + 2) * S, rnd(i + 3) * S, 3, 3); }
    x.strokeStyle = 'rgba(50,54,66,.55)'; x.lineWidth = 3;
    for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(0, r * S / 4); x.lineTo(S, r * S / 4); x.stroke(); for (let c = 0; c < 2; c++) { const xx = (c + (r % 2) * 0.5) * S / 2; x.beginPath(); x.moveTo(xx, r * S / 4); x.lineTo(xx, (r + 1) * S / 4); x.stroke(); } }
  }),
  ice: canvasTex((x, S) => {
    const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#e9fbff'); g.addColorStop(1, '#9fd8f5'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(10, 20); x.lineTo(40, 10); x.moveTo(15, 35); x.lineTo(30, 30); x.stroke();
    x.strokeStyle = 'rgba(80,160,210,.6)'; x.lineWidth = 4; x.strokeRect(0, 0, S, S);
  }),
  rock: canvasTex((x, S) => {
    x.fillStyle = '#5d6170'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${rnd(i + 7) * 0.15})`; x.fillRect(rnd(i + 5) * S, rnd(i + 6) * S, 4, 4); }
    x.strokeStyle = 'rgba(30,32,40,.6)'; x.lineWidth = 3; for (let r = 1; r < 4; r++) { x.beginPath(); x.moveTo(0, r * S / 4); x.lineTo(S, r * S / 4); x.stroke(); }
  }),
  grass: canvasTex((x, S) => {
    x.fillStyle = '#5fae3e'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd(i) > .5 ? 'rgba(40,110,30,.35)' : 'rgba(150,210,90,.3)'; x.fillRect(rnd(i + 1) * S, rnd(i + 2) * S, 2, 4); }
  }, 128, 40),
  crack: canvasTex((x, S) => {
    x.clearRect(0, 0, S, S); x.strokeStyle = 'rgba(20,10,5,.75)'; x.lineWidth = 3; x.beginPath();
    x.moveTo(S * .2, S * .1); x.lineTo(S * .45, S * .4); x.lineTo(S * .35, S * .65); x.lineTo(S * .6, S * .9); x.moveTo(S * .45, S * .4); x.lineTo(S * .8, S * .35); x.stroke();
  })
};
const MATL = {
  wood: new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.85 }),
  stone: new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.95 }),
  ice: new THREE.MeshStandardMaterial({ map: TEX.ice, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.82 }),
  rock: new THREE.MeshStandardMaterial({ map: TEX.rock, roughness: 1 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.6, roughness: 0.3, emissive: 0x4a3000 }),
  gem: new THREE.MeshStandardMaterial({ color: 0xff3d8b, metalness: 0.2, roughness: 0.15, emissive: 0x5a0024, flatShading: true }),
  jewel: new THREE.MeshStandardMaterial({ color: 0x3fb4ff, roughness: 0.2, emissive: 0x06304a }),
  ball: new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.7, roughness: 0.35 })
};
const CRACKED = {};
for (const k of ['wood', 'stone', 'ice']) {
  CRACKED[k] = MATL[k].clone(); CRACKED[k].color = new THREE.Color(0xb0a090);
  CRACKED[k].onBeforeCompile = (sh) => {}; // keep default
}
const crackOverlay = new THREE.MeshBasicMaterial({ map: TEX.crack, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

// ground + scenery
const unitBoxG = new THREE.BoxGeometry(1, 1, 1);
let cannon = null;
const aimTarget = new THREE.Vector3(0, 1.5, -8);
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }));
groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);
{
  // the player's battlement (visual only, sits below the line of fire)
  const parapet = new THREE.Group();
  const wallM = MATL.stone;
  const front = new THREE.Mesh(unitBoxG, wallM); front.scale.set(8, 1.45, 0.5); front.position.set(0, 0.725, CAMERA.z - 1.6); parapet.add(front);
  for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 1) continue; const m = new THREE.Mesh(unitBoxG, wallM); m.scale.set(0.55, 0.45, 0.5); m.position.set(i * 0.9, 1.67, CAMERA.z - 1.6); parapet.add(m); }
  parapet.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(parapet);
  // the player's cannon
  cannon = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0x30343f, metalness: 0.7, roughness: 0.4 }));
  barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.35; cannon.add(barrel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 16), barrel.material); rim.position.z = 1.0; cannon.add(rim);
  cannon.position.set(MUZZLE.x, MUZZLE.y - 0.25, MUZZLE.z + 0.75);
  scene.add(cannon);
  // hills
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f9f62, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(18 + rnd(i) * 14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    h.position.set(-70 + i * 18 + rnd(i + 3) * 8, -2, -60 - rnd(i + 5) * 25); h.scale.y = 0.45 + rnd(i + 9) * 0.3; scene.add(h);
  }
  // trees
  const trunk = new THREE.MeshStandardMaterial({ color: 0x7a4f2a }), leaf = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, flatShading: true });
  const tg = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), lg = new THREE.ConeGeometry(1, 2.4, 7);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, x = side * (6 + rnd(i) * 10), z = -4 - rnd(i + 2) * 22;
    const t = new THREE.Mesh(tg, trunk); t.position.set(x, 0.6, z);
    const l = new THREE.Mesh(lg, leaf); l.position.set(x, 2.3, z); l.castShadow = true;
    const s = 0.8 + rnd(i + 4) * 0.6; t.scale.setScalar(s); l.scale.setScalar(s); l.position.y = 2.3 * s;
    scene.add(t, l);
  }
  // clouds
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x555555, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rnd(i * 4 + j) * 1.5, 0), cm); p.position.set(j * 2.2, rnd(j + i) * 1.0, 0); g.add(p); }
    g.position.set(-50 + i * 17, 22 + rnd(i) * 10, -70 - rnd(i + 1) * 30); scene.add(g);
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const ballGeo = new THREE.SphereGeometry(BALL_R, 18, 12);
function crownMesh() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.2, 14, 1, true), MATL.gold); band.position.y = -0.08; g.add(band);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 14), MATL.gold); base.position.y = -0.18; g.add(base);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), MATL.gold);
    s.position.set(Math.cos(a) * 0.21, 0.12, Math.sin(a) * 0.21); g.add(s);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), i % 2 ? MATL.gem : MATL.jewel); b.position.set(Math.cos(a) * 0.235, -0.08, Math.sin(a) * 0.235); g.add(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function gemMesh() { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), MATL.gem); m.castShadow = true; m.scale.y = 1.15; return m; }

// ---------- state ----------
let game = null, levelIdx = 0, mode = 'title';
const meshes = new Map(); // body -> mesh
const dynamicRoot = new THREE.Group(); scene.add(dynamicRoot);
const debris = [];
const debrisGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
let shake = 0;

const hooks = {
  onBreak(b, mat) { SFX.break(mat); spawnDebris(b.position, mat, 10); removeMesh(b); shake = Math.max(shake, mat === 'stone' ? 0.08 : 0.04); },
  onTarget(b, k) { SFX.target(); spawnDebris(b.position, k === 'gem' ? 'gem' : 'gold', 16); removeMesh(b); popup('+500'); updateHud(); },
  onHit(s, mat) { SFX.hit(s, mat); },
  onFire() { SFX.fire(); updateHud(); },
  onBallRemoved(b) { removeMesh(b); },
  onWin(g) { recordWin(g); setTimeout(() => { if (g === game) showResult(); }, 300); }
};

function removeMesh(b) { const m = meshes.get(b); if (m) { dynamicRoot.remove(m); meshes.delete(b); } }
function spawnDebris(p, mat, n) {
  const m = mat === 'gold' ? MATL.gold : mat === 'gem' ? MATL.gem : MATL[mat];
  for (let i = 0; i < n; i++) {
    let d = debris.length >= 80 ? debris.shift() : null;
    if (!d) { d = { mesh: new THREE.Mesh(debrisGeo, m) }; scene.add(d.mesh); }
    d.mesh.material = m; d.mesh.visible = true;
    d.mesh.position.set(p.x, p.y, p.z);
    d.v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5 + 1, (Math.random() - 0.5) * 5);
    d.life = 0.8 + Math.random() * 0.6; d.mesh.scale.setScalar(0.6 + Math.random() * 1.2);
    debris.push(d);
  }
}
function popup(text) {
  const el = document.createElement('div'); el.className = 'popup'; el.textContent = text; $('popups').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function loadLevel(i) {
  levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
  for (const m of meshes.values()) dynamicRoot.remove(m);
  meshes.clear();
  game = createGame(CANNON, LEVELS[levelIdx], hooks);
  const add = (body, mesh) => { meshes.set(body, mesh); dynamicRoot.add(mesh); mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); };
  for (const b of game.statics) { const m = new THREE.Mesh(unitBox, MATL.rock); m.scale.set(b.cc.w, b.cc.h, b.cc.d); m.castShadow = m.receiveShadow = true; add(b, m); }
  for (const b of game.blocks) { const m = new THREE.Mesh(unitBox, MATL[b.cc.mat]); m.scale.set(b.cc.w, b.cc.h, b.cc.d); m.castShadow = true; m.receiveShadow = b.cc.mat !== 'ice'; add(b, m); }
  for (const b of game.targets) add(b, b.cc.k === 'crown' ? crownMesh() : gemMesh());
  $('hud-level').textContent = (levelIdx + 1) + '. ' + LEVELS[levelIdx].name;
  updateHud();
  show('game');
  $('hint').classList.toggle('hidden', !(levelIdx === 0 && !save.hintSeen));
}
function updateHud() {
  if (!game) return;
  $('hud-shots').textContent = 'Shots ' + game.shots + '  \u00b7  \u2605\u2605\u2605 in ' + game.level.par;
  $('hud-targets').textContent = (game.targets.length - game.targetsLeft) + ' / ' + game.targets.length;
}

// ---------- screens ----------
function show(m) {
  mode = m;
  $('title').classList.toggle('hidden', m !== 'title');
  $('levels').classList.toggle('hidden', m !== 'levels');
  $('result').classList.toggle('hidden', m !== 'result');
  $('hud').classList.toggle('hidden', !(m === 'game' || m === 'result'));
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
  save.coins += g.coins;
  persist();
}
function showResult() {
  SFX.win();
  const s = game.stars;
  $('res-title').textContent = s === 3 ? 'Perfect Siege!' : 'Castle Cleared!';
  [...$('res-stars').children].forEach((el, i) => el.className = i < s ? 'on' : '');
  $('res-score').textContent = `${game.shots} shot${game.shots > 1 ? 's' : ''}  \u00b7  3 stars in ${game.level.par}`;
  $('res-coins').textContent = `\u{1FA99} +${game.coins} coins   Score ${game.score.toLocaleString()}`;
  $('res-next').classList.toggle('hidden', levelIdx >= LEVELS.length - 1);
  show('result');
}

// ---------- input: tap to fire, or hold-drag-release with crosshair ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let press = null, lastFire = 0, recoil = 0;
const cross = $('cross');
function showCross(x, y) { cross.style.transform = `translate(${x}px, ${y}px)`; cross.classList.remove('hidden'); }
function hideCross() { cross.classList.add('hidden'); }
function aimPoint(sx, sy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([dynamicRoot, groundMesh], true);
  if (hits.length) return hits[0].point;
  return raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(45));
}
function fireAtScreen(sx, sy) {
  if (!game || game.phase !== 'play' || mode !== 'game') return false;
  const now = performance.now(); if (now - lastFire < 180) return false; lastFire = now;
  const p = aimPoint(sx, sy);
  aimTarget.copy(p);
  const ball = game.fireAt({ x: p.x, y: p.y, z: p.z });
  if (!ball) return false;
  recoil = 0.25;
  const m = new THREE.Mesh(ballGeo, MATL.ball); m.castShadow = true; meshes.set(ball, m); dynamicRoot.add(m); m.position.copy(ball.position);
  shake = Math.max(shake, 0.03);
  if (!save.hintSeen) { save.hintSeen = true; persist(); $('hint').classList.add('hidden'); }
  return true;
}
canvas.addEventListener('pointerdown', (e) => {
  audioInit();
  if (mode !== 'game' || !game || game.phase !== 'play') return;
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  showCross(e.clientX, e.clientY);
  aimTarget.copy(aimPoint(e.clientX, e.clientY));
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
  // keep about 30 degrees of horizontal view so the castle fits in portrait
  const vfov = 2 * Math.atan(Math.tan((16.5 * Math.PI) / 180) / camera.aspect) * 180 / Math.PI;
  camera.fov = Math.max(42, Math.min(75, vfov));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- loop ----------
let acc = 0, last = performance.now();
let fpsFrames = 0, fpsT = last; window.__fps = 0;
const tmpQ = new THREE.Quaternion();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsFrames++; if (now - fpsT >= 1000) { window.__fps = fpsFrames * 1000 / (now - fpsT); fpsFrames = 0; fpsT = now; }
  if (game && (mode === 'game' || mode === 'result')) {
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 3) { game.frame(); acc -= 1 / 60; n++; }
    if (n === 3) acc = 0;
    for (const [b, m] of meshes) {
      if (b.sleepState === 2 && m.userData.synced) continue;
      m.position.set(b.position.x, b.position.y, b.position.z);
      m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      m.userData.synced = true;
      if (b.cc.kind === 'block' && !m.userData.cracked && b.cc.hp < b.cc.maxHp * 0.55) {
        m.userData.cracked = true; m.material = CRACKED[b.cc.mat];
        const o = new THREE.Mesh(unitBox, crackOverlay); o.scale.setScalar(1.01); m.add(o);
      }
    }
  }
  // targets bob/spin a little to draw the eye
  if (game) for (const b of game.targets) { const m = meshes.get(b); if (m && b.sleepState === 2) { m.rotation.y += dt * 0.0; } }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt;
    d.v.y -= 9.8 * dt; d.mesh.position.addScaledVector(d.v, dt); d.mesh.rotation.x += dt * 6; d.mesh.rotation.y += dt * 5;
    if (d.mesh.position.y < 0.06) { d.mesh.position.y = 0.06; d.v.multiplyScalar(0.4); d.v.y = Math.abs(d.v.y) * 0.3; }
    if (d.life <= 0) { d.mesh.visible = false; debris.splice(i, 1); scene.remove(d.mesh); }
  }
  if (cannon) {
    const base = new THREE.Vector3(MUZZLE.x, MUZZLE.y - 0.25, MUZZLE.z + 0.75);
    cannon.position.copy(base); cannon.lookAt(aimTarget);
    if (recoil > 0.001) { cannon.translateZ(-recoil); recoil *= 0.85; }
  }
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
  if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.85; }
  camera.lookAt(LOOK);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- test hooks ----------
window.CastleCrash = {
  get game() { return game; }, get mode() { return mode; }, get save() { return save; }, levels: LEVELS,
  loadLevel, show, fireAtScreen,
  fireWorldDirect(x, y, z) {
    if (!game || game.phase !== 'play') return false;
    const ball = game.fireAt({ x, y, z }); if (!ball) return false;
    const m = new THREE.Mesh(ballGeo, MATL.ball); m.castShadow = true; meshes.set(ball, m); dynamicRoot.add(m); m.position.copy(ball.position); return true;
  },
  fireAtWorld(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return fireAtScreen(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height); },
  worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  get renderInfo() { return renderer.info.render; }
};

resize();
loadLevel(0); show('title');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
