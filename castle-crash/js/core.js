// Castle Crash - shared physics + rules (Rapier). No rendering. Works in browser and Node.
export const CAMERA = { x: 0, y: 3.0, z: 6.5 };
export const MUZZLE = { x: 0, y: 2.4, z: 5.6 };
export const LOOK = { x: 0, y: 1.6, z: -5 };
export const BALL_R = 0.3;
export const BALL_SPEED = 34;
export const BALL_DENSITY = 2600;
export const MAX_BALLS = 4;
export const G = 9.81;
export const DT = 1 / 60;
export const PLATFORM_TOP = 0;
export const CENTER_Z = -5;

export const MATS = {
  wood:  { density: 600,  friction: 0.6,  restitution: 0.12 },
  stone: { density: 1900, friction: 0.75, restitution: 0.05 },
  ice:   { density: 900,  friction: 0.12, restitution: 0.08, shatterG: 55 },
  gold:  { density: 800,  friction: 0.6,  restitution: 0.1 }
};
export const PALETTE = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#3ccf6e', '#1fb5c9', '#3d7dff', '#9b5de5', '#ff5fa2'];
const STONES = ['#8e94a3', '#a3a9b6', '#7b8190'];
const ICES = ['#bfeeff', '#a6e4ff', '#d8f6ff'];

// ---------- builder (y = bottom of piece) ----------
export class Builder {
  constructor() { this.items = []; this.ci = 0; this.platform = { w: 4.6, d: 3.2 }; }
  color(m, c) {
    if (c) return c;
    if (m === 'stone') return STONES[this.ci++ % STONES.length];
    if (m === 'ice') return ICES[this.ci++ % ICES.length];
    return PALETTE[this.ci++ % PALETTE.length];
  }
  box(m, x, y, z, w, h, d, c, rotY = 0) { this.items.push({ shape: 'box', m, x, y: y + h / 2, z, sx: w, sy: h, sz: d, c: this.color(m, c), rotY }); return y + h; }
  cyl(m, x, y, z, r, h, c) { this.items.push({ shape: 'cyl', m, x, y: y + h / 2, z, sx: r * 2, sy: h, sz: r * 2, c: this.color(m, c) }); return y + h; }
  sphere(m, x, y, z, r, c) { this.items.push({ shape: 'sphere', m, x, y: y + r, z, sx: r * 2, sy: r * 2, sz: r * 2, c: this.color(m, c) }); return y + 2 * r; }
  crown(x, y, z) { this.items.push({ shape: 'crown', m: 'gold', x, y: y + 0.17, z, sx: 0.4, sy: 0.34, sz: 0.4, c: '#ffc928', bonus: true }); }
  // staggered brick wall facing the camera
  wall(m, cx, y, z, cols, rows, bw = 0.6, bh = 0.3, bd = 0.4, mats) {
    for (let r = 0; r < rows; r++) {
      const mm = mats ? mats[r % mats.length] : m;
      if (r % 2 === 0) for (let c = 0; c < cols; c++) this.box(mm, cx + (c - (cols - 1) / 2) * bw, y + r * bh, z, bw * 0.98, bh, bd);
      else {
        this.box(mm, cx - (cols * bw) / 2 + bw / 4, y + r * bh, z, bw / 2 * 0.96, bh, bd);
        for (let c = 0; c < cols - 1; c++) this.box(mm, cx + (c - (cols - 2) / 2) * bw, y + r * bh, z, bw * 0.98, bh, bd);
        this.box(mm, cx + (cols * bw) / 2 - bw / 4, y + r * bh, z, bw / 2 * 0.96, bh, bd);
      }
    }
    return y + rows * bh;
  }
  // flat (camera-facing) pyramid of cubes
  pyramid(m, cx, y, z, n, s = 0.45, mats) {
    for (let r = 0; r < n; r++) for (let i = 0; i < n - r; i++) this.box(mats ? mats[r % mats.length] : m, cx + (i - (n - r - 1) / 2) * s, y + r * s, z, s * 0.98, s, s * 0.98);
    return y + n * s;
  }
  // square stepped pyramid
  pyramid3(m, cx, y, z, n, s = 0.45, mats) {
    for (let r = 0; r < n; r++) { const k = n - r; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) this.box(mats ? mats[r % mats.length] : m, cx + (i - (k - 1) / 2) * s, y + r * s, z + (j - (k - 1) / 2) * s, s * 0.98, s, s * 0.98); }
    return y + n * s;
  }
  // alternating cube / cylinder column
  column(m, x, y, z, n, s = 0.4, mats) {
    for (let i = 0; i < n; i++) { const mm = mats ? mats[i % mats.length] : m; y = i % 2 ? this.cyl(mm, x, y, z, s * 0.5, s) : this.box(mm, x, y, z, s, s, s); }
    return y;
  }
  // jenga-style tower: layers of 3 planks alternating direction
  jenga(m, cx, y, z, layers, L = 1.05, t = 0.33, h = 0.2, mats) {
    for (let l = 0; l < layers; l++) {
      const mm = mats ? mats[l % mats.length] : m;
      for (let k = -1; k <= 1; k++) {
        if (l % 2 === 0) this.box(mm, cx + k * t * 1.02, y, z, t, h, L);
        else this.box(mm, cx, y, z + k * t * 1.02, L, h, t);
      }
      y += h;
    }
    return y;
  }
  // tiered tower: 4 cylinder legs + slab per tier
  tiers(m, cx, y, z, n, w = 1.0, legH = 0.5, mats) {
    for (let i = 0; i < n; i++) {
      const mm = mats ? mats[i % mats.length] : m, o = w / 2 - 0.12;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(mm, cx + sx * o, y, z + sz * o, 0.2, legH, 0.2);
      y = this.box(mm, cx, y + legH, z, w, 0.14, w);
    }
    return y;
  }
  // shelf unit: posts + planks, each shelf holding small items
  shelf(m, cx, y, z, tiers, w = 2.2, gap = 0.55, items = 5, itemM = 'wood') {
    for (let t = 0; t < tiers; t++) {
      this.box(m, cx - w / 2 + 0.08, y, z, 0.16, gap, 0.5); this.box(m, cx + w / 2 - 0.08, y, z, 0.16, gap, 0.5);
      y = this.box(m, cx, y + gap, z, w, 0.12, 0.55);
      for (let i = 0; i < items; i++) {
        const x = cx + (i - (items - 1) / 2) * ((w - 0.3) / items);
        if (i % 3 === 1) this.cyl(itemM, x, y, z, 0.13, 0.36); else if (i % 3 === 2 && t % 2) this.cyl(itemM, x, y, z, 0.15, 0.24); else this.box(itemM, x, y, z, 0.26, 0.3, 0.26);
      }
      // items are only on the tier just built; the next tier's posts sit on the plank ends
    }
    return y;
  }
}

export function buildLevel(level) { const b = new Builder(); level.build(b); return { items: b.items, platform: { ...b.platform, ...(level.platform || {}) } }; }

export function ballisticVelocity(t, speed = BALL_SPEED) {
  const dx = t.x - MUZZLE.x, dy = t.y - MUZZLE.y, dz = t.z - MUZZLE.z;
  const dist = Math.hypot(dx, dy, dz) || 1, time = dist / speed;
  return { x: dx / time, y: dy / time + 0.5 * G * time, z: dz / time };
}

const prismCache = new Map();
function prism(r, hh, n) {
  const key = r + ':' + hh; if (prismCache.has(key)) return prismCache.get(key);
  const pts = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pts.set([x, -hh, z, x, hh, z], i * 6); }
  prismCache.set(key, pts); return pts;
}
function quatY(a) { return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }; }

export function createGame(RAPIER, level, hooks = {}, opts = {}) {
  const { items, platform } = buildLevel(level);
  let world = new RAPIER.World({ x: 0, y: -G, z: 0 });
  world.timestep = DT;
  world.numSolverIterations = 8;
  world.numAdditionalFrictionIterations = 4;
  const eq = new RAPIER.EventQueue(true);

  const g = { RAPIER, level, platform, pieces: [], bonus: [], balls: [], shots: 0, steps: 0, phase: 'play', off: 0, total: 0,
    bonusOff: 0, wonAt: 0, goal: 1 };
  g.world = world;

  // floating platform
  const pd = RAPIER.RigidBodyDesc.fixed().setTranslation(0, PLATFORM_TOP - 0.3, CENTER_Z);
  const pb = world.createRigidBody(pd);
  world.createCollider(RAPIER.ColliderDesc.cuboid(platform.w / 2, 0.3, platform.d / 2).setFriction(0.8).setRestitution(0.05), pb);

  const hw = platform.w / 2 + 0.02, hd = platform.d / 2 + 0.02;
  const byCollider = new Map();
  items.forEach((it, idx) => {
    const M = MATS[it.m];
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(it.x, it.y, CENTER_Z + it.z).setCanSleep(true)
      .setLinearDamping(0.05).setAngularDamping(0.12);
    if (it.rotY) bd.setRotation(quatY(it.rotY));
    const body = world.createRigidBody(bd);
    let cd;
    if (it.shape === 'box') cd = RAPIER.ColliderDesc.cuboid(it.sx / 2, it.sy / 2, it.sz / 2);
    else if (it.shape === 'sphere') cd = RAPIER.ColliderDesc.ball(it.sx / 2);
    else cd = RAPIER.ColliderDesc.cylinder(it.sy / 2, it.sx / 2); // cylinders + crowns
    cd.setDensity(M.density).setFriction(M.friction).setRestitution(M.restitution);
    const col = world.createCollider(cd, body);
    const mass = body.mass();
    col.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    col.setContactForceEventThreshold(mass * G * 22);
    const p = { idx, h: body.handle, ch: col.handle, shape: it.shape, m: it.m, sx: it.sx, sy: it.sy, sz: it.sz, c: it.c, mass, off: false, gone: false, bonus: !!it.bonus };
    byCollider.set(col.handle, p);
    (p.bonus ? g.bonus : g.pieces).push(p);
  });
  g.total = g.pieces.length;
  g.body = (p) => world.getRigidBody(p.h);

  function markOff(p, why) {
    if (p.off) return;
    p.off = true;
    if (p.bonus) { g.bonusOff++; hooks.onBonus && hooks.onBonus(p); }
    else { g.off++; hooks.onOff && hooks.onOff(p, why); }
  }
  function removePiece(p) {
    if (p.gone) return;
    p.gone = true;
    const b = world.getRigidBody(p.h); if (b) world.removeRigidBody(b);
    hooks.onRemove && hooks.onRemove(p);
  }
  function wakeAll() { world.forEachRigidBody(b => { if (b.isDynamic()) b.wakeUp(); }); }

  g.fireAt = function (t) {
    if (g.phase !== 'play') return null;
    const v = ballisticVelocity(t);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(MUZZLE.x, MUZZLE.y, MUZZLE.z).setLinvel(v.x, v.y, v.z).setCcdEnabled(true).setCanSleep(true).setAngularDamping(0.2));
    world.createCollider(RAPIER.ColliderDesc.ball(BALL_R).setDensity(BALL_DENSITY).setFriction(0.5).setRestitution(0.2)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(40000), body);
    const ball = { h: body.handle, born: g.steps, gone: false };
    g.balls.push(ball);
    while (g.balls.length > MAX_BALLS) { const o = g.balls.shift(); const ob = world.getRigidBody(o.h); if (ob) world.removeRigidBody(ob); o.gone = true; hooks.onBallRemoved && hooks.onBallRemoved(o); }
    g.shots++;
    hooks.onFire && hooks.onFire(ball);
    return ball;
  };

  g.step = function () {
    world.step(eq);
    g.steps++;
    const live = g.steps > 30;
    eq.drainContactForceEvents(ev => {
      if (!live) return;
      const f = ev.maxForceMagnitude();
      for (const ch of [ev.collider1(), ev.collider2()]) {
        const p = byCollider.get(ch);
        if (!p || p.gone) continue;
        const gs = f / (p.mass * G);
        if (p.m === 'ice' && gs > MATS.ice.shatterG) { markOff(p, 'shatter'); removePiece(p); hooks.onShatter && hooks.onShatter(p); wakeAll(); continue; }
        hooks.onImpact && hooks.onImpact(p, gs);
      }
    });
    if (g.steps % 6 === 0) {
      for (const list of [g.pieces, g.bonus]) for (const p of list) {
        if (p.gone) continue;
        const b = world.getRigidBody(p.h); if (b.isSleeping()) continue;
        const t = b.translation(), y = t.y;
        // Cleared once the piece's centre drops below the platform top, or leaves the island's footprint (off the edge).
        if (!p.off && (y < PLATFORM_TOP - 0.05 || Math.abs(t.x) > hw || Math.abs(t.z - CENTER_Z) > hd)) markOff(p, 'fell');
        if (y < -25) removePiece(p);
      }
      for (let i = g.balls.length - 1; i >= 0; i--) {
        const o = g.balls[i], b = world.getRigidBody(o.h);
        if (!b) continue;
        if (b.translation().y < -25 || g.steps - o.born > 60 * 7) { world.removeRigidBody(b); o.gone = true; g.balls.splice(i, 1); hooks.onBallRemoved && hooks.onBallRemoved(o); }
      }
    }
    if (g.phase === 'play' && g.off / g.total >= g.goal) { g.phase = 'winning'; g.wonAt = g.steps; }
    if (g.phase === 'winning' && g.steps - g.wonAt > 75) {
      g.phase = 'won';
      const par = level.par;
      g.stars = g.shots <= par ? 3 : g.shots <= par + 2 ? 2 : 1;
      g.coins = g.stars * 10 + g.bonusOff * 5 + Math.max(0, par + 2 - g.shots) * 5;
      g.score = g.off * 100 + g.bonusOff * 500 + Math.max(0, par + 3 - g.shots) * 1000;
      hooks.onWin && hooks.onWin(g);
    }
  };
  g.progress = () => Math.min(1, g.off / g.total / g.goal);

  g.isQuiet = function () {
    let quiet = true;
    world.forEachRigidBody(b => { if (quiet && b.isDynamic() && !b.isSleeping()) { const v = b.linvel(); if (v.x * v.x + v.y * v.y + v.z * v.z > 0.04) quiet = false; } });
    return quiet;
  };
  g.settle = function (max = 240, min = 20) { for (let i = 0; i < max; i++) { g.step(); if (i > min && g.isQuiet()) break; } };

  // snapshots for the solver (world + rules state)
  g.snapshot = () => ({ bytes: world.takeSnapshot(), state: JSON.stringify({ p: g.pieces.map(p => [p.off, p.gone]), b: g.bonus.map(p => [p.off, p.gone]), balls: g.balls, shots: g.shots, steps: g.steps, phase: g.phase, off: g.off, bonusOff: g.bonusOff, wonAt: g.wonAt }) });
  g.restore = (s) => {
    world.free();
    world = RAPIER.World.restoreSnapshot(s.bytes); g.world = world;
    const st = JSON.parse(s.state);
    g.pieces.forEach((p, i) => { p.off = st.p[i][0]; p.gone = st.p[i][1]; });
    g.bonus.forEach((p, i) => { p.off = st.b[i][0]; p.gone = st.b[i][1]; });
    Object.assign(g, { balls: st.balls, shots: st.shots, steps: st.steps, phase: st.phase, off: st.off, bonusOff: st.bonusOff, wonAt: st.wonAt });
  };
  g.positions = () => g.pieces.map(p => { if (p.gone) return null; const t = world.getRigidBody(p.h).translation(); return { x: t.x, y: t.y, z: t.z }; });
  g.free = () => world.free();

  // let the stacks settle before play (they then sleep and do not jitter)
  if (opts.presettle !== false) { for (let i = 0; i < 45; i++) g.step(); g.steps = 0; }
  return g;
}
