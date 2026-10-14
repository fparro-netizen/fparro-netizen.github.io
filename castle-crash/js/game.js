// Castle Crash - first-person 3D physics puzzle (three.js + Rapier).
// v3 "pro" pass: golden-hour art direction, particles, camera work, slow-mo finale, music, haptics, new UI.
// Gameplay rules and levels live in core.js / levels.js and are unchanged.
import * as THREE from './lib/three.module.js';
import RAPIER from './lib/rapier.js';
import { createGame, CAMERA, MUZZLE, LOOK, BALL_R, PLATFORM_TOP, CENTER_Z } from './core.js';
import LEVELS from './levels.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// ---------- save data ----------
const SAVE_KEY = 'castleCrashStack.v1';
const save = { stars: {}, best: {}, shots: {}, coins: 0, sound: true, music: true, hintSeen: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- haptics (Android vibrate; iOS 18+ Safari via the native switch control) ----------
const hapticSwitch = $('haptic-wrap');
function haptic(kind) {
  if (!save.sound) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(kind === 'heavy' ? [18, 30, 24] : kind === 'medium' ? 14 : 8); return; }
    if (hapticSwitch) hapticSwitch.click();
  } catch (e) {}
}

// ---------- audio: SFX bus + reverb + generative music ----------
let AC = null, master = null, sfxBus = null, musicBus = null, lowpass = null, noiseBuf = null, verb = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C();
  master = AC.createGain(); master.gain.value = save.sound ? 0.8 : 0;
  lowpass = AC.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 20000;
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(lowpass); lowpass.connect(comp); comp.connect(AC.destination);
  sfxBus = AC.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
  musicBus = AC.createGain(); musicBus.gain.value = save.music ? 0.16 : 0; musicBus.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // small generated room reverb
  const len = Math.floor(AC.sampleRate * 1.4), ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb = AC.createConvolver(); verb.buffer = ir; const vg = AC.createGain(); vg.gain.value = 0.28; verb.connect(vg); vg.connect(master);
  startMusic();
}
function out(node, wet = 0.25, bus = sfxBus) { node.connect(bus); if (wet && verb) { const s = AC.createGain(); s.gain.value = wet; node.connect(s); s.connect(verb); } }
function tone(freq, dur, type, vol, slideTo, delay = 0, wet = 0.2, bus) {
  if (!AC || !save.sound) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); out(g, wet, bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, type, freq, vol, q = 1, delay = 0, wet = 0.2, sweepTo) {
  if (!AC || !save.sound) return;
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); out(g, wet); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
let hitBudget = 0, lastHitT = 0;
const SFX = {
  fire() { noise(0.5, 'lowpass', 2400, 0.9, 0.7, 0, 0.35, 120); tone(120, 0.35, 'sine', 0.9, 38); noise(0.06, 'highpass', 3000, 0.25, 1, 0, 0); },
  impact(mat, s) {
    const n = performance.now(); if (n - lastHitT > 1000) hitBudget = 0;
    if (n - lastHitT < 26 || hitBudget > 40) return; lastHitT = n; hitBudget++;
    const v = Math.min(0.5, 0.06 + s * 0.004);
    if (mat === 'ice') { tone(1500 + Math.random() * 900, 0.18, 'sine', v * 0.5, null, 0, 0.5); tone(2900 + Math.random() * 600, 0.1, 'triangle', v * 0.2); }
    else if (mat === 'stone') { noise(0.14, 'lowpass', 420 + Math.random() * 250, v * 1.2, 1, 0, 0.3); tone(90 + Math.random() * 30, 0.12, 'sine', v * 0.8, 50); }
    else { noise(0.07, 'bandpass', 700 + Math.random() * 500, v * 1.4, 3, 0, 0.2); tone(210 + Math.random() * 160, 0.09, 'triangle', v * 0.7, 120); }
  },
  shatter() { for (let i = 0; i < 6; i++) tone(1700 + Math.random() * 2200, 0.25, 'sine', 0.06, null, i * 0.022, 0.6); noise(0.25, 'highpass', 5000, 0.2, 1, 0, 0.4); },
  bonus() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.28, 'triangle', 0.12, null, i * 0.06, 0.5)); },
  collapse() { noise(1.8, 'lowpass', 300, 0.7, 0.8, 0, 0.5, 60); tone(55, 1.6, 'sine', 0.5, 30); },
  win() {
    const ch = [[392, 494, 587], [440, 554, 659], [523, 659, 784, 1047]];
    ch.forEach((c, i) => c.forEach(f => { tone(f, i === 2 ? 1.1 : 0.32, 'sawtooth', 0.05, null, i * 0.2, 0.45); tone(f, i === 2 ? 1.2 : 0.35, 'triangle', 0.09, null, i * 0.2, 0.45); }));
  },
  star(i) { tone(880 * Math.pow(1.26, i), 0.35, 'triangle', 0.16, null, 0, 0.5); tone(1760 * Math.pow(1.26, i), 0.2, 'sine', 0.06, null, 0.02, 0.5); },
  coin() { tone(1568, 0.06, 'square', 0.04, null, 0, 0.1); tone(2093, 0.12, 'square', 0.04, null, 0.05, 0.1); },
  click() { tone(720, 0.05, 'triangle', 0.12, 520, 0, 0.05); },
  whoosh() { noise(0.35, 'bandpass', 500, 0.25, 0.8, 0, 0.2, 2200); }
};
// gentle lute-and-pad loop, scheduled ahead on the audio clock
const SCALE = [0, 2, 3, 5, 7, 9, 10]; // D dorian
const CHORDS = [[0, 2, 4], [3, 5, 7], [4, 6, 8], [2, 4, 6]];
let musicTimer = 0, nextBeat = 0, beat = 0;
const note = (deg, oct = 0) => 146.83 * Math.pow(2, (SCALE[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct)) / 12);
function startMusic() {
  if (musicTimer) return; nextBeat = AC.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    while (nextBeat < AC.currentTime + 0.35) {
      const bar = Math.floor(beat / 8) % CHORDS.length, step = beat % 8, ch = CHORDS[bar], spb = 0.27;
      if (save.music && save.sound) {
        if (step === 0) ch.forEach(d => { tone(note(d, -1), spb * 8.2, 'triangle', 0.10, null, nextBeat - AC.currentTime, 0.6, musicBus); });
        if (step === 0) tone(note(ch[0], -2), spb * 3.5, 'sine', 0.22, null, nextBeat - AC.currentTime, 0.2, musicBus);
        const pat = [0, 1, 2, 1, 0, 2, 1, 2][step] + (step === 6 ? 7 : 0);
        if (step !== 3 && step !== 7) tone(note(ch[pat % 3] + (pat >= 7 ? 7 : 0), 1), 0.32, 'triangle', 0.09, null, nextBeat - AC.currentTime, 0.5, musicBus);
      }
      nextBeat += 0.27; beat++;
    }
  }, 90);
}
function applyVolumes() {
  if (!AC) return; const t = AC.currentTime;
  master.gain.setTargetAtTime(save.sound ? 0.8 : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(save.music && mode !== 'result' ? 0.16 : save.music ? 0.07 : 0, t, 0.3);
}
document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else if (save.sound) AC.resume(); });

// ---------- renderer ----------
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const PAL = { skyTop: 0x2d5fa8, skyMid: 0x86b9e6, horizon: 0xffd9a8, fog: 0xe8d2b0, sun: 0xffe2b8, grass: '#5fa344', stone: '#a7a39a' };
scene.fog = new THREE.Fog(PAL.fog, 38, 175);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
const LOOKV = new THREE.Vector3(LOOK.x, LOOK.y, LOOK.z);
const SUN_DIR = new THREE.Vector3(-0.55, 0.32, -1).normalize();

{ // sky dome: gradient, warm horizon haze, sun glow
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PAL.skyTop) }, mid: { value: new THREE.Color(PAL.skyMid) }, hor: { value: new THREE.Color(PAL.horizon) }, sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color(0xfff1d6) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 c = mix(hor, mid, smoothstep(-0.05, 0.22, h)); c = mix(c, top, smoothstep(0.22, 0.85, h));
        c = mix(c, hor * 0.92, smoothstep(0.0, -0.4, h));
        float s = max(dot(normalize(vP), sunDir), 0.0);
        c += sunCol * (pow(s, 900.0) * 1.6 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat));
}
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b5a45, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(PAL.sun, 2.9);
sun.position.set(-7, 13, 5); sun.target.position.set(0, 0, CENTER_Z);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 7.5, bottom: -5, near: 2, far: 42 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xffc89a, 0.8); rim.position.set(6, 6, -14); rim.target.position.set(0, 0, CENTER_Z); scene.add(rim, rim.target);
const flash = new THREE.PointLight(0xffb060, 0, 9, 2); flash.position.set(MUZZLE.x, MUZZLE.y + 0.2, MUZZLE.z - 1.2); scene.add(flash);

// ---------- procedural textures ----------
const rnd = (s) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
function canvasTex(draw, size = 128, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function bevel(x, S, dark = 0.4, light = 0.5) {
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.78); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = `rgba(0,0,0,${dark})`; x.lineWidth = S * 0.05; x.strokeRect(0, 0, S, S);
  x.strokeStyle = `rgba(255,255,255,${light})`; x.lineWidth = S * 0.02; x.beginPath(); x.moveTo(S * 0.06, S * 0.94); x.lineTo(S * 0.06, S * 0.06); x.lineTo(S * 0.94, S * 0.06); x.stroke();
}
const woodTex = canvasTex((x, S) => {
  x.fillStyle = '#f4ece0'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(90,50,20,${0.05 + rnd(i) * 0.1})`; x.lineWidth = 1 + rnd(i + 3) * 2.5; x.beginPath(); const y0 = rnd(i + 9) * S;
    for (let k = 0; k <= 16; k++) { const px = k / 16 * S, py = y0 + Math.sin(k * 0.7 + i) * 2.5 * rnd(i + 1); k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  x.fillStyle = 'rgba(80,40,15,.18)'; x.beginPath(); x.ellipse(S * 0.68, S * 0.4, S * 0.05, S * 0.025, 0, 0, 7); x.fill();
  bevel(x, S, 0.42, 0.45);
}, 256);
const stoneTex = canvasTex((x, S) => {
  x.fillStyle = '#efefef'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) { const v = rnd(i + 11); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - .5) * .35})` : `rgba(0,0,0,${v * .22})`; x.fillRect(rnd(i + 5) * S, rnd(i + 6) * S, 1 + rnd(i) * 3, 1 + rnd(i + 2) * 3); }
  for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.2; x.beginPath(); let px = rnd(i + 40) * S, py = rnd(i + 41) * S; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rnd(i * 7 + k) - .5) * 40; py += (rnd(i * 5 + k) - .5) * 40; x.lineTo(px, py); } x.stroke(); }
  bevel(x, S, 0.5, 0.35);
}, 256);
const iceTex = canvasTex((x, S) => {
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e6f8ff'); g.addColorStop(1, '#ffffff'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; x.beginPath(); x.moveTo(S * .15, S * .7); x.lineTo(S * .5, S * .2); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.moveTo(S * .3, S * .85); x.lineTo(S * .7, S * .3); x.stroke();
  bevel(x, S, 0.25, 0.8);
}, 128);
const grassTex = canvasTex((x, S) => {
  x.fillStyle = PAL.grass; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = rnd(i); x.fillStyle = v > .55 ? 'rgba(170,220,110,.35)' : v > .25 ? 'rgba(35,95,30,.32)' : 'rgba(220,200,120,.18)'; x.fillRect(rnd(i + 1) * S, rnd(i + 2) * S, 1.5, 3 + rnd(i + 3) * 3); }
}, 256);
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(2.5, 1.5);
const brickTex = canvasTex((x, S) => {
  x.fillStyle = '#6f6a62'; x.fillRect(0, 0, S, S);
  const rows = 4, bh = S / rows;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++) {
    const bw = S / 3, ox = (r % 2) * bw / 2, v = rnd(r * 9 + c);
    x.fillStyle = `rgb(${165 + v * 30},${158 + v * 28},${145 + v * 25})`; x.fillRect(c * bw + ox + 3, r * bh + 3, bw - 6, bh - 6);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(c * bw + ox + 3, r * bh + 3, bw - 6, 3);
    x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(c * bw + ox + 3, r * bh + bh - 7, bw - 6, 4);
  }
}, 256);
brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
const rockTex = canvasTex((x, S) => {
  x.fillStyle = '#7a6552'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd(i) > .5 ? '255,230,200' : '0,0,0'},${rnd(i + 7) * 0.16})`; x.fillRect(rnd(i + 5) * S, rnd(i + 6) * S, 4 + rnd(i) * 10, 2 + rnd(i + 1) * 4); }
}, 256);
rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping; rockTex.repeat.set(4, 2);
const softTex = canvasTex((x, S) => { const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }, 64);
const cloudTex = canvasTex((x, S) => {
  for (let i = 0; i < 16; i++) { const cx = S * (0.2 + rnd(i) * 0.6), cy = S * (0.45 + rnd(i + 1) * 0.15), r = S * (0.1 + rnd(i + 2) * 0.16);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  const sh = x.createLinearGradient(0, S * 0.3, 0, S * 0.7); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,140,170,.35)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = sh; x.fillRect(0, 0, S, S);
}, 256);

const MAT = {
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.0 }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.88, metalness: 0.0 }),
  ice: new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.74, emissive: 0x1a3a4a, emissiveIntensity: 0.35 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.85, roughness: 0.25, emissive: 0x4a3000 }),
  jewel: new THREE.MeshStandardMaterial({ color: 0xff2d6f, roughness: 0.15, emissive: 0x50001a }),
  ball: new THREE.MeshStandardMaterial({ color: 0x1d2028, metalness: 0.8, roughness: 0.32 }),
  wall: new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x7a4f22, metalness: 0.85, roughness: 0.35 }),
  timber: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6b4426, roughness: 0.8 })
};
MAT.solid = MAT.wood;
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sphere: new THREE.SphereGeometry(0.5, 18, 12),
  ball: new THREE.SphereGeometry(BALL_R, 20, 14)
};

// ---------- scenery ----------
const clouds = [];
{
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x4f88b8, roughness: 0.3, metalness: 0.2 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -34; scene.add(sea);
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x6d9c55, roughness: 1, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1, flatShading: true });
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x7d8fb0, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) { // distant mountain ring, melts into fog
    const h = 20 + rnd(i + 50) * 30, m = new THREE.Mesh(new THREE.ConeGeometry(14 + rnd(i) * 14, h, 6), mtnMat);
    const a = -Math.PI * 0.95 + i / 13 * Math.PI * 0.9; m.position.set(Math.cos(a) * 150, -34 + h / 2, -40 + Math.sin(a) * 150); m.rotation.y = rnd(i) * 3; scene.add(m);
  }
  for (let i = 0; i < 9; i++) { // floating islands
    const r = 2.5 + rnd(i) * 6, g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.1, 10), islandMat); g.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 1.8, 10), rockMat); under.rotation.x = Math.PI; under.position.y = -r * 0.9 - 0.55; g.add(under);
    if (rnd(i + 30) > 0.4) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, r * 0.9, 8), MAT.wall); t.position.set(r * 0.3, r * 0.45, 0); g.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xb3473a, roughness: .8 })); c.position.set(r * 0.3, r * 0.9 + 0.6, 0); g.add(c); }
    g.position.set(-80 + i * 20 + rnd(i + 2) * 8, -8 + rnd(i + 3) * 18, -55 - rnd(i + 4) * 60); g.rotation.y = rnd(i) * 6; g.userData.bob = rnd(i) * 6; scene.add(g); clouds.push({ isle: g, y: g.position.y });
  }
  const cm = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: true, color: 0xfff3e6 });
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(cm), w = 22 + rnd(i + 70) * 26; s.scale.set(w, w * 0.5, 1);
    s.position.set(-110 + i * 20 + rnd(i) * 10, 10 + rnd(i + 3) * 22, -70 - rnd(i + 1) * 70); scene.add(s); clouds.push({ sprite: s, speed: 0.4 + rnd(i) * 0.6 });
  }
  // player's battlement
  const wallMat = MAT.wall.clone(); wallMat.map = brickTex.clone(); wallMat.map.needsUpdate = true; wallMat.map.repeat.set(4, 1);
  const front = new THREE.Mesh(GEO.box, wallMat); front.scale.set(9, 2.0, 0.6); front.position.set(0, 1.0, CAMERA.z - 1.7); front.receiveShadow = true; scene.add(front);
  for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 1) continue; const m = new THREE.Mesh(GEO.box, MAT.wall); m.scale.set(0.62, 0.5, 0.66); m.position.set(i * 1.0, 2.25, CAMERA.z - 1.7); m.castShadow = true; scene.add(m); }
  const under = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 8), rockMat); under.rotation.x = Math.PI; under.position.set(0, -7, CAMERA.z); scene.add(under);
  // banners on the battlement
  const bm = new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.9, side: THREE.DoubleSide });
  for (const sx of [-3.5, 3.5]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), bm); b.position.set(sx, 1.35, CAMERA.z - 1.38); scene.add(b);
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), MAT.gold); e.position.set(sx, 1.5, CAMERA.z - 1.37); scene.add(e); }
}
const cannon = new THREE.Group();
{
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.3, 20), MAT.bronze); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.35; cannon.add(barrel);
  for (const z of [1.0, 0.55, -0.15]) { const r = new THREE.Mesh(new THREE.TorusGeometry(z > 0.9 ? 0.19 : 0.235 - z * 0.05, 0.04, 8, 20), MAT.bronze); r.position.z = z; cannon.add(r); }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), MAT.bronze); knob.position.z = -0.35; cannon.add(knob);
  scene.add(cannon);
}
const cannonBase = new THREE.Vector3(MUZZLE.x, MUZZLE.y - 0.3, MUZZLE.z + 0.8);
const aimTarget = new THREE.Vector3(LOOK.x, LOOK.y, LOOK.z), aimSmooth = aimTarget.clone();

// level platform (rebuilt per level)
const platformGroup = new THREE.Group(); scene.add(platformGroup);
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
function buildPlatform(pf) {
  platformGroup.traverse(o => { if (o.isMesh && o.userData.own) { o.geometry.dispose(); if (o.material.map && o.material.userData.own) o.material.map.dispose(); } });
  platformGroup.clear();
  const sideTex = brickTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(pf.w / 1.2, 0.4);
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95 }); sideMat.userData.own = true;
  const top = new THREE.Mesh(GEO.box, [sideMat, sideMat, grassMat, sideMat, sideMat, sideMat]);
  top.scale.set(pf.w, 0.6, pf.d); top.position.set(0, PLATFORM_TOP - 0.3, CENTER_Z); top.receiveShadow = true; platformGroup.add(top);
  const r = pf.w * 0.49;
  const under = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 9, 3), new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1, flatShading: true })); under.userData.own = true;
  under.rotation.x = Math.PI; under.scale.z = pf.d / pf.w; under.position.set(0, PLATFORM_TOP - 0.6 - r * 1.1, CENTER_Z); platformGroup.add(under);
  // grass lip and a few rocks on the underside for silhouette
  const lip = new THREE.Mesh(new THREE.BoxGeometry(pf.w + 0.08, 0.08, pf.d + 0.08), grassMat); lip.userData.own = true; lip.position.set(0, PLATFORM_TOP - 0.04, CENTER_Z); lip.receiveShadow = true; platformGroup.add(lip);
  return top;
}

// ---------- instanced pieces ----------
let groups = {};
const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
const ballMeshes = new Map(), crownMeshes = new Map();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _c = new THREE.Color(), _v = new THREE.Vector3();
const crownProto = (() => {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.18, 16, 1, true), MAT.gold); band.position.y = -0.06; g.add(band);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), MAT.gold); base.position.y = -0.15; g.add(base);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), MAT.gold); s.position.set(Math.cos(a) * 0.18, 0.11, Math.sin(a) * 0.18); g.add(s);
    if (i % 2) { const j = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), MAT.jewel); j.position.set(Math.cos(a) * 0.2, -0.06, Math.sin(a) * 0.2); g.add(j); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
})();
function clearPieces() {
  for (const k in groups) { pieceRoot.remove(groups[k].mesh); groups[k].mesh.dispose(); }
  groups = {};
  for (const m of crownMeshes.values()) pieceRoot.remove(m); crownMeshes.clear();
  for (const m of ballMeshes.values()) pieceRoot.remove(m); ballMeshes.clear();
}
const matKey = (m) => (m === 'ice' || m === 'stone') ? m : 'wood';
function buildPieces(g) {
  clearPieces();
  const lists = {};
  for (const p of g.pieces) { const k = p.shape + ':' + matKey(p.m); (lists[k] = lists[k] || []).push(p); }
  for (const k in lists) {
    const [shape, cls] = k.split(':');
    const mesh = new THREE.InstancedMesh(GEO[shape], MAT[cls], lists[k].length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true; mesh.receiveShadow = cls !== 'ice'; mesh.frustumCulled = false;
    lists[k].forEach((p, i) => { p.gk = k; p.gi = i; _c.set(p.c); if (cls === 'wood') _c.offsetHSL(0, -0.1, -0.03); p.col = _c.getHex(); mesh.setColorAt(i, _c); });
    mesh.instanceColor.needsUpdate = true;
    groups[k] = { mesh, pieces: lists[k] };
    pieceRoot.add(mesh);
  }
  for (const p of g.bonus) { const m = crownProto.clone(); crownMeshes.set(p, m); pieceRoot.add(m); }
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
    if (!o.lastT) o.lastT = { x: t.x, y: t.y, z: t.z };
    const dx = t.x - o.lastT.x, dy = t.y - o.lastT.y, dz = t.z - o.lastT.z, sp = Math.hypot(dx, dy, dz);
    if (sp > 0.12) emit(t.x, t.y, t.z, 1, { col: 0xd9d2c6, size: 0.35, life: 0.5, spread: 0.05, up: 0.2, alpha: 0.35, grow: 1.8 });
    o.lastT.x = t.x; o.lastT.y = t.y; o.lastT.z = t.z;
  }
}

// ---------- particles: soft dust/smoke/sparks (one Points draw call) ----------
const PMAX = 500;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pA = new Float32Array(PMAX), pSz = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSz, 1).setUsage(THREE.DynamicDrawUsage));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, vertexColors: true,
  uniforms: { map: { value: softTex }, scale: { value: 400 } },
  vertexShader: 'attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }'
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
const parts = []; for (let i = 0; i < PMAX; i++) parts.push({ life: 0 });
let pCursor = 0;
function emit(x, y, z, n, o) {
  const col = _c.set(o.col || 0xffffff);
  for (let i = 0; i < n; i++) {
    const p = parts[pCursor]; pCursor = (pCursor + 1) % PMAX;
    const sp = o.spread ?? 1;
    p.x = x + (Math.random() - .5) * (o.jitter || 0.1); p.y = y + (Math.random() - .5) * (o.jitter || 0.1); p.z = z + (Math.random() - .5) * (o.jitter || 0.1);
    p.vx = (Math.random() - .5) * 2 * sp + (o.vx || 0); p.vy = Math.random() * sp + (o.up || 0); p.vz = (Math.random() - .5) * 2 * sp + (o.vz || 0);
    p.life = p.max = (o.life || 1) * (0.7 + Math.random() * 0.6); p.size = (o.size || 0.5) * (0.7 + Math.random() * 0.6); p.grow = o.grow ?? 1.5;
    p.a = o.alpha ?? 0.6; p.g = o.gravity ?? -0.4; p.drag = o.drag ?? 2.2; p.r = col.r; p.gg = col.g; p.b = col.b;
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.life <= 0) { pA[i] = 0; pSz[i] = 0; continue; }
    p.life -= dt; const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vz *= k; p.vy = p.vy * k + p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = 1 - p.life / p.max;
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    pCol[i * 3] = p.r; pCol[i * 3 + 1] = p.gg; pCol[i * 3 + 2] = p.b;
    pA[i] = p.a * Math.min(1, t * 8) * (1 - t); pSz[i] = p.size * (1 + t * p.grow);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.alpha.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}
// ---------- chunk debris (one instanced draw call) ----------
const DMAX = 140;
const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, map: woodTex }), DMAX);
chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chunkMesh.castShadow = true; chunkMesh.frustumCulled = false;
for (let i = 0; i < DMAX; i++) { chunkMesh.setMatrixAt(i, _zero); chunkMesh.setColorAt(i, _c.set(0xffffff)); }
scene.add(chunkMesh);
const chunks = []; for (let i = 0; i < DMAX; i++) chunks.push({ life: 0, q: new THREE.Quaternion(), w: new THREE.Vector3() });
let cCursor = 0, platformHalf = { w: 2, d: 1 };
function spawnChunks(x, y, z, n, color, speed = 3, size = 0.09) {
  for (let i = 0; i < n; i++) {
    const c = chunks[cCursor]; const idx = cCursor; cCursor = (cCursor + 1) % DMAX;
    c.x = x; c.y = y; c.z = z; c.vx = (Math.random() - .5) * speed * 2; c.vy = Math.random() * speed + 1; c.vz = (Math.random() - .5) * speed * 2 + 0.5;
    c.life = 1.4 + Math.random() * 0.8; c.s = size * (0.5 + Math.random()); c.w.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); c.spin = 6 + Math.random() * 10;
    chunkMesh.setColorAt(idx, _c.set(color));
  }
  chunkMesh.instanceColor.needsUpdate = true;
}
const _dq = new THREE.Quaternion();
function updateChunks(dt) {
  let any = false;
  for (let i = 0; i < DMAX; i++) {
    const c = chunks[i]; if (c.life <= 0) { if (c.alive) { chunkMesh.setMatrixAt(i, _zero); c.alive = false; any = true; } continue; }
    c.alive = true; any = true; c.life -= dt; c.vy -= 9.8 * dt;
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    if (c.y < PLATFORM_TOP + c.s / 2 && c.y > PLATFORM_TOP - 0.4 && Math.abs(c.x) < platformHalf.w && Math.abs(c.z - CENTER_Z) < platformHalf.d) { c.y = PLATFORM_TOP + c.s / 2; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.spin *= 0.5; }
    c.q.multiply(_dq.setFromAxisAngle(c.w, c.spin * dt));
    const s = c.s * Math.min(1, c.life * 2);
    _m.compose(_p.set(c.x, c.y, c.z), c.q, _s.set(s, s, s)); chunkMesh.setMatrixAt(i, _m);
  }
  if (any) chunkMesh.instanceMatrix.needsUpdate = true;
}

// ---------- camera director ----------
const cam = { trauma: 0, intro: 0, introFrom: new THREE.Vector3(), push: 0, finale: 0, t: 0 };
function addTrauma(v) { cam.trauma = Math.min(1, cam.trauma + v); }
let timeScale = 1, slowmo = 0, hitStop = 0;

// ---------- game state ----------
let game = null, levelIdx = 0, mode = 'title', recoil = 0, platformMesh = null, combo = 0, comboT = 0, comboShown = 0;
const posOf = (p) => { const b = game && game.world.getRigidBody(p.h); return b ? b.translation() : null; };
const hooks = {
  onImpact(p, gs) {
    if (gs > 30) SFX.impact(p.m, gs);
    if (gs > 55) {
      const t = posOf(p); if (!t) return;
      const col = p.m === 'stone' ? 0xe0dbd2 : p.m === 'ice' ? 0xf0fcff : 0xeadcc4;
      emit(t.x, t.y, t.z, Math.min(5, 1 + (gs / 80) | 0), { col, size: 0.4, life: 0.8, spread: 0.9, up: 0.4, alpha: 0.22, grow: 2 });
      if (gs > 90) { spawnChunks(t.x, t.y, t.z, 2, p.col || p.c, 2.2, p.m === 'stone' ? 0.1 : 0.07); addTrauma(Math.min(0.25, gs / 900)); }
      if (gs > 160 && hitStop <= 0) { hitStop = 0.045; haptic('light'); }
    }
  },
  onShatter(p) {
    SFX.shatter(); const t = posOf(p) || { x: 0, y: 1, z: CENTER_Z };
    spawnChunks(t.x, t.y, t.z, 12, 0xcff4ff, 3.5, 0.08);
    emit(t.x, t.y, t.z, 10, { col: 0xeafcff, size: 0.25, life: 0.6, spread: 2.2, up: 1, alpha: 0.9, grow: 0.5, gravity: -3 });
    addTrauma(0.2);
  },
  onRemove() {},
  onOff(p) {
    combo++; comboT = 1.1; updateHud();
    const t = posOf(p); if (t && t.y > PLATFORM_TOP - 1.2) emit(t.x, PLATFORM_TOP + 0.1, t.z, 3, { col: 0xd9c9a8, size: 0.5, life: 1, spread: 0.6, up: 0.3, alpha: 0.4 });
  },
  onBonus(p) { SFX.bonus(); haptic('medium'); popup('+5 coins', 'gold'); const t = posOf(p); if (t) emit(t.x, t.y, t.z, 16, { col: 0xffd54a, size: 0.18, life: 0.9, spread: 2, up: 1.5, alpha: 1, grow: 0, gravity: -4 }); updateHud(); },
  onFire() { SFX.fire(); updateHud(); },
  onBallRemoved() {},
  onWin(g) { recordWin(g); setTimeout(() => { if (g === game) showResult(); }, 300); }
};
function popup(text, cls = '') { const el = document.createElement('div'); el.className = 'popup ' + cls; el.textContent = text; $('popups').appendChild(el); setTimeout(() => el.remove(), 1100); }

function loadLevel(i) {
  levelIdx = Math.max(0, Math.min(LEVELS.length - 1, i));
  if (game) game.free();
  game = createGame(RAPIER, LEVELS[levelIdx], hooks);
  platformMesh = buildPlatform(game.platform);
  platformHalf = { w: game.platform.w / 2, d: game.platform.d / 2 };
  buildPieces(game);
  for (const c of chunks) c.life = 0; for (const p of parts) p.life = 0;
  $('hud-level').textContent = LEVELS[levelIdx].name;
  $('hud-num').textContent = 'Level ' + (levelIdx + 1);
  combo = 0; comboT = 0; timeScale = 1; slowmo = 0; cam.finale = 0; recoil = 0; collapsePlayed = false;
  if (AC) lowpass.frequency.setTargetAtTime(20000, AC.currentTime, 0.05);
  cam.intro = 1; cam.introFrom.set(CAMERA.x + 2.5, CAMERA.y + 3.5, CAMERA.z + 3);
  updateHud();
  show('game');
  const w = $('wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
  $('hint').classList.toggle('hidden', !(levelIdx === 0 && !save.hintSeen));
}
let lastPct = -1;
function updateHud() {
  if (!game) return;
  const pct = Math.floor(100 * game.off / game.total);
  $('bar-fill').style.transform = `scaleX(${game.progress()})`;
  $('bar-text').textContent = pct + '% of 100%';
  if (pct !== lastPct) { lastPct = pct; const b = $('bar'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  const par = game.level.par, s = game.shots;
  $('hud-shots').textContent = s;
  $('hud-par').textContent = s <= par ? `3\u2605 in ${par}` : s <= par + 2 ? `2\u2605 in ${par + 2}` : '1\u2605';
  const cw = $('chip-crowns'); cw.classList.toggle('hidden', !game.bonus.length);
  $('hud-crowns').textContent = game.bonusOff + '/' + game.bonus.length;
}

// ---------- screens ----------
const SCREENS = ['title', 'levels', 'result', 'pause'];
function show(m) {
  mode = m;
  SCREENS.forEach(s => $(s).classList.toggle('hidden', m !== s));
  const inGame = m === 'game' || m === 'result' || m === 'pause';
  $('hud').classList.toggle('hidden', !inGame);
  $('progress').classList.toggle('hidden', !inGame);
  $('hud-bottom').classList.toggle('hidden', m !== 'game');
  document.body.dataset.mode = m;
  if (m !== 'game') { $('hint').classList.add('hidden'); hideCross(); }
  document.querySelectorAll('.coins').forEach(c => c.textContent = save.coins);
  if (m === 'levels') buildLevelGrid();
  if (m === 'title') { const t = $('title-stars'); t.textContent = Object.values(save.stars).reduce((a, b) => a + b, 0) + ' / ' + LEVELS.length * 3; }
  applyVolumes();
}
const unlocked = (i) => i === 0 || (save.stars[i - 1] || 0) > 0;
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1zm2 0h6V7a3 3 0 00-6 0z"/></svg>';
function buildLevelGrid() {
  let html = '', total = 0; const cur = firstUnplayed();
  LEVELS.forEach((L, i) => {
    const st = save.stars[i] || 0; total += st;
    if (unlocked(i)) { let s = ''; for (let j = 0; j < 3; j++) s += `<i class="${j < st ? 'on' : ''}">${STAR}</i>`; html += `<button class="lv${i === cur && !st ? ' cur' : ''}${st === 3 ? ' perfect' : ''}" data-i="${i}" style="--d:${i * 18}ms"><span class="n">${i + 1}</span><span class="st">${s}</span></button>`; }
    else html += `<button class="lv locked" disabled style="--d:${i * 18}ms"><span class="lk">${LOCK}</span></button>`;
  });
  $('lv-grid').innerHTML = html;
  $('star-total').textContent = total + ' / ' + LEVELS.length * 3;
  $('star-fill').style.transform = `scaleX(${total / (LEVELS.length * 3)})`;
}
const tap = (fn) => (e) => { audioInit(); SFX.click(); haptic('light'); fn(e); };
$('lv-grid').addEventListener('click', (e) => { const t = e.target.closest('.lv'); if (!t || t.disabled) return; audioInit(); SFX.click(); haptic('light'); loadLevel(+t.dataset.i); });
const firstUnplayed = () => { for (let i = 0; i < LEVELS.length; i++) if (!save.stars[i]) return i; return LEVELS.length - 1; };
$('btn-play').onclick = tap(() => loadLevel(firstUnplayed()));
$('btn-levels').onclick = tap(() => show('levels'));
$('btn-back').onclick = tap(() => show('title'));
$('btn-menu').onclick = tap(() => show('pause'));
$('btn-restart').onclick = tap(() => { SFX.whoosh(); loadLevel(levelIdx); });
$('p-resume').onclick = tap(() => show('game'));
$('p-restart').onclick = tap(() => loadLevel(levelIdx));
$('p-levels').onclick = tap(() => show('levels'));
$('p-home').onclick = tap(() => show('title'));
function syncToggles() {
  document.querySelectorAll('.t-sound').forEach(b => { b.classList.toggle('off', !save.sound); b.setAttribute('aria-pressed', save.sound); });
  document.querySelectorAll('.t-music').forEach(b => { b.classList.toggle('off', !save.music); b.setAttribute('aria-pressed', save.music); });
}
document.querySelectorAll('.t-sound').forEach(b => b.onclick = () => { save.sound = !save.sound; persist(); audioInit(); applyVolumes(); syncToggles(); SFX.click(); });
document.querySelectorAll('.t-music').forEach(b => b.onclick = () => { save.music = !save.music; persist(); audioInit(); applyVolumes(); syncToggles(); SFX.click(); });
syncToggles();
$('res-levels').onclick = tap(() => show('levels'));
$('res-retry').onclick = tap(() => loadLevel(levelIdx));
$('res-next').onclick = tap(() => { if (levelIdx < LEVELS.length - 1) loadLevel(levelIdx + 1); else show('levels'); });

function recordWin(g) {
  const i = LEVELS.indexOf(g.level); if (i < 0) return;
  g.prevBest = save.stars[i] || 0;
  save.stars[i] = Math.max(save.stars[i] || 0, g.stars);
  save.best[i] = Math.max(save.best[i] || 0, g.score);
  save.shots[i] = Math.min(save.shots[i] || 999, g.shots);
  save.coins += g.coins; persist();
}
function confetti() {
  const box = $('confetti'); box.innerHTML = '';
  const cols = ['#ffd23f', '#ff6b4a', '#4fc3f7', '#7ed957', '#ff8fd0', '#fff'];
  for (let i = 0; i < 46; i++) { const d = document.createElement('i'); d.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--x:${(Math.random() - .5) * 160}px;--r:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * .5}s;animation-duration:${1.8 + Math.random() * 1.2}s`; box.appendChild(d); }
  setTimeout(() => { box.innerHTML = ''; }, 3600);
}
function showResult() {
  const s = game.stars;
  $('res-title').textContent = s === 3 ? 'Perfect Smash!' : s === 2 ? 'Great Shot!' : 'Castle Cleared!';
  $('res-level').textContent = 'Level ' + (levelIdx + 1) + ' \u00b7 ' + game.level.name;
  [...$('res-stars').children].forEach((el) => el.className = '');
  $('res-shots').textContent = game.shots; $('res-par').textContent = game.level.par;
  $('res-crowns-wrap').classList.toggle('hidden', !game.bonus.length); $('res-crowns').textContent = game.bonusOff + '/' + game.bonus.length;
  $('res-best').classList.toggle('hidden', !(s > (game.prevBest || 0) && game.prevBest > 0));
  $('res-next').classList.toggle('hidden', levelIdx >= LEVELS.length - 1);
  const coinEl = $('res-coins'); coinEl.textContent = '+0';
  show('result'); SFX.win(); haptic('heavy');
  if (s === 3) confetti();
  const g = game;
  [...$('res-stars').children].forEach((el, i) => setTimeout(() => { if (game !== g || mode !== 'result') return; if (i < s) { el.className = 'on'; SFX.star(i); haptic('light'); } else el.className = 'miss'; }, 450 + i * 280));
  const target = g.coins, t0 = performance.now() + 500;
  (function tick() { if (game !== g || mode !== 'result') return; const k = clamp((performance.now() - t0) / 700, 0, 1); coinEl.textContent = '+' + Math.round(target * ease(k)); if (k < 1) { if (Math.random() < 0.3) SFX.coin(); requestAnimationFrame(tick); } })();
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
  const hits = raycaster.intersectObjects(targets, true).filter(h => h.object !== chunkMesh);
  if (hits.length) return hits[0].point;
  return raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(30));
}
function fireAtWorld(p) {
  if (!game || game.phase !== 'play') return false;
  aimTarget.set(p.x, p.y, p.z); aimSmooth.copy(aimTarget);
  const o = game.fireAt({ x: p.x, y: p.y, z: p.z }); if (!o) return false;
  const m = new THREE.Mesh(GEO.ball, MAT.ball); m.castShadow = true; m.position.set(MUZZLE.x, MUZZLE.y, MUZZLE.z);
  ballMeshes.set(o, m); pieceRoot.add(m);
  recoil = 0.35; addTrauma(0.22); cam.push = 1; flash.intensity = 30;
  // muzzle: flash, smoke and sparks along the barrel direction
  _v.set(p.x - MUZZLE.x, p.y - MUZZLE.y, p.z - MUZZLE.z).normalize();
  const mx = MUZZLE.x + _v.x * 0.5, my = MUZZLE.y + _v.y * 0.5, mz = MUZZLE.z + _v.z * 0.5;
  emit(mx, my, mz, 3, { col: 0xffd28a, size: 0.7, life: 0.12, spread: 0.2, alpha: 1, grow: 1, gravity: 0 });
  emit(mx + _v.x * 0.8, my + _v.y * 0.8, mz + _v.z * 0.8, 8, { col: 0xf1ece4, size: 0.35, life: 1.3, spread: 0.5, up: 0.4, alpha: 0.35, grow: 2.5, vx: _v.x * 2, vy: 0, vz: _v.z * 2 });
  emit(mx, my, mz, 6, { col: 0xffb347, size: 0.08, life: 0.4, spread: 1.5, alpha: 1, grow: 0, gravity: -6, vx: _v.x * 4, vz: _v.z * 4 });
  haptic('medium');
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
  pMat.uniforms.scale.value = h * pixelRatio / (2 * Math.tan(camera.fov * Math.PI / 360));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- loop ----------
let acc = 0, last = performance.now(), fpsFrames = 0, fpsT = last, lowFps = 0, collapsePlayed = false;
window.__fps = 0; window.__physMs = 0; let physSum = 0, physN = 0, physWorst = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), BASE = new THREE.Vector3(CAMERA.x, CAMERA.y, CAMERA.z);
function frame(now) {
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsFrames++;
  if (now - fpsT >= 1000) {
    window.__fps = fpsFrames * 1000 / (now - fpsT); fpsFrames = 0; fpsT = now;
    // adaptive resolution keeps phones at 60fps: drop pixel ratio if we fall behind for 3 seconds
    if (isMobile && !document.hidden && window.__fps < 50 && pixelRatio > 1.25) { if (++lowFps >= 3) { pixelRatio = Math.max(1.25, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); lowFps = 0; } } else lowFps = 0;
  }
  cam.t += rdt;
  // finale slow-motion when the last pieces go
  if (game && game.phase === 'winning' && !collapsePlayed) { collapsePlayed = true; slowmo = 1.6; SFX.collapse(); addTrauma(0.5); haptic('heavy'); if (AC) lowpass.frequency.setTargetAtTime(900, AC.currentTime, 0.08); }
  if (slowmo > 0) { slowmo -= rdt; timeScale = slowmo > 0.5 ? 0.3 : 0.3 + (0.5 - slowmo) * 1.4; if (slowmo <= 0) { timeScale = 1; if (AC) lowpass.frequency.setTargetAtTime(20000, AC.currentTime, 0.2); } }
  if (hitStop > 0) hitStop -= rdt;
  const dt = rdt * timeScale * (hitStop > 0 ? 0.15 : 1);
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
  if (comboT > 0) { comboT -= rdt; if (comboT <= 0) { if (combo >= 8 && game && game.phase === 'play') popup(combo >= 20 ? `MEGA SMASH x${combo}` : `SMASH x${combo}`, combo >= 20 ? 'mega' : ''); combo = 0; } }
  updateParticles(dt); updateChunks(dt);
  for (const c of clouds) { if (c.sprite) { c.sprite.position.x += c.speed * rdt; if (c.sprite.position.x > 130) c.sprite.position.x = -130; } else c.isle.position.y = c.y + Math.sin(cam.t * 0.4 + c.isle.userData.bob) * 0.6; }
  flash.intensity *= Math.exp(-rdt * 22);
  for (const m of crownMeshes.values()) if (m.visible) m.children[0].material.emissiveIntensity = 0.8 + Math.sin(cam.t * 4) * 0.4;

  // cannon
  aimSmooth.lerp(aimTarget, 1 - Math.exp(-rdt * 18));
  cannon.position.copy(cannonBase); cannon.lookAt(aimSmooth);
  if (recoil > 0.001) { cannon.translateZ(-recoil); recoil *= Math.exp(-rdt * 9); }

  // camera: title orbit, level intro dolly, fire push, win push-in, trauma shake
  if (mode === 'title' || mode === 'levels') {
    const a = Math.sin(cam.t * 0.12) * 0.5;
    camPos.set(Math.sin(a) * 9.5, 4.2 + Math.sin(cam.t * 0.2) * 0.4, CENTER_Z + Math.cos(a) * 9.5); camLook.set(0, 3.4, CENTER_Z);
  } else {
    camPos.copy(BASE); camLook.copy(LOOKV);
    if (cam.intro > 0) { cam.intro = Math.max(0, cam.intro - rdt / 1.1); camPos.lerp(cam.introFrom, ease(cam.intro) * 1); }
    if (cam.push > 0) { cam.push = Math.max(0, cam.push - rdt * 3); camPos.z -= Math.sin(cam.push * Math.PI) * 0.12; }
    if (game && game.phase !== 'play') { cam.finale = Math.min(1, cam.finale + rdt * 0.35); const f = ease(cam.finale); camPos.z -= f * 1.6; camPos.y += f * 0.7; camPos.x += Math.sin(cam.t * 0.3) * f * 0.6; }
    camPos.y += Math.sin(cam.t * 0.9) * 0.012;
  }
  if (cam.trauma > 0) {
    const s = cam.trauma * cam.trauma, k = cam.t * 38;
    camPos.x += (Math.sin(k * 1.1) + Math.sin(k * 2.3) * 0.5) * 0.09 * s; camPos.y += (Math.sin(k * 1.7 + 3) + Math.sin(k * 3.1) * 0.5) * 0.08 * s;
    cam.trauma = Math.max(0, cam.trauma - rdt * 1.6);
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (cam.trauma > 0) camera.rotateZ(Math.sin(cam.t * 31) * 0.012 * cam.trauma * cam.trauma);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- test hooks ----------
window.CastleCrash = {
  get game() { return game; }, get mode() { return mode; }, get save() { return save; }, levels: LEVELS,
  loadLevel, show, fireAtScreen, fireWorldDirect: (x, y, z) => fireAtWorld({ x, y, z }),
  worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  get renderInfo() { return renderer.info.render; }, get physMs() { return { avg: window.__physMs, worst: window.__physWorst }; },
  get fps() { return window.__fps; }, get pixelRatio() { return pixelRatio; }
};

await RAPIER.init();
resize();
loadLevel(0); show('title');
$('loading').classList.add('out'); setTimeout(() => $('loading').classList.add('hidden'), 500);
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
