// Castle Crash 3D - shared physics + rules (no rendering). Works in browser and Node.
export const CAMERA = { x: 0, y: 2.5, z: 4 };
export const MUZZLE = { x: 0, y: 2.0, z: 3.2 };
export const BALL_R = 0.26;
export const BALL_SPEED = 30;
export const MAX_BALLS = 4;
export const G = 9.82;
const SUB = 1 / 120;
const GRACE = 90; // substeps with no damage while things settle

export const MATS = {
  ice:   { density: 650,  hp: 35,  score: 50,  friction: 0.25 },
  wood:  { density: 600,  hp: 70,  score: 100, friction: 0.6 },
  stone: { density: 1800, hp: 160, score: 200, friction: 0.7 },
  target:{ density: 500,  hp: 22,  score: 500, friction: 0.6 }
};

// ---------- level builder (meters; y = bottom of piece) ----------
export class Builder {
  constructor() { this.items = []; }
  box(m, x, y, z, w, h, d) { this.items.push({ t: 'block', m, x, y: y + h / 2, z, w, h, d }); return y + h; }
  crate(m, x, y, z, s = 0.7) { return this.box(m, x, y, z, s, s, s); }
  stack(m, x, y, z, n, s = 0.7) { for (let i = 0; i < n; i++) y = this.crate(Array.isArray(m) ? m[i % m.length] : m, x, y, z, s); return y; }
  // 4 posts + a slab; returns top y
  frame(m, x, y, z, w = 1.4, h = 1.2, d = 1.4, slabM) {
    const p = 0.22;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(m, x + sx * (w / 2 - p / 2), y, z + sz * (d / 2 - p / 2), p, h, p);
    return this.box(slabM || m, x, y + h, z, w + 0.1, 0.2, d + 0.1);
  }
  tower(m, x, y, z, floors, w = 1.4, h = 1.1, d) {
    for (let i = 0; i < floors; i++) y = this.frame(Array.isArray(m) ? m[i % m.length] : m, x, y, z, w, h, d || w);
    return y;
  }
  // brick wall facing the camera, centered at x, width in bricks
  wall(m, x, y, z, cols, rows, bw = 0.8, bh = 0.4, bd = 0.45) {
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0, n = r % 2 ? cols - 1 : cols;
      for (let c = 0; c < n; c++) this.box(Array.isArray(m) ? m[r % m.length] : m, x - (cols * bw) / 2 + bw / 2 + off + c * bw, y + r * bh, z, bw * 0.98, bh, bd);
    }
    return y + rows * bh;
  }
  plank(m, x, y, z, w, d) { return this.box(m, x, y, z, w, 0.2, d); }
  pillar(x, y, z, w, h, d) { this.items.push({ t: 'static', x, y: y + h / 2, z, w, h, d: d || w }); return y + h; }
  crown(x, y, z) { this.items.push({ t: 'target', k: 'crown', x, y: y + 0.2, z }); }
  gem(x, y, z) { this.items.push({ t: 'target', k: 'gem', x, y: y + 0.21, z }); }
}

export function buildItems(level) { const b = new Builder(); level.build(b); return b.items; }

export function ballisticVelocity(target, speed = BALL_SPEED) {
  const dx = target.x - MUZZLE.x, dy = target.y - MUZZLE.y, dz = target.z - MUZZLE.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const t = dist / speed;
  return { x: dx / t, y: dy / t + 0.5 * G * t, z: dz / t };
}

export function createGame(CANNON, level, hooks = {}) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) });
  world.allowSleep = true;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 12;
  world.solver.tolerance = 1e-4;
  world.defaultContactMaterial.friction = 0.6;
  world.defaultContactMaterial.restitution = 0.02;
  world.defaultContactMaterial.contactEquationStiffness = 5e7;
  world.defaultContactMaterial.contactEquationRelaxation = 3;
  world.defaultContactMaterial.frictionEquationStiffness = 5e7;

  const g = { world, level, shots: 0, score: 0, phase: 'play', steps: 0, blocks: [], targets: [], statics: [], balls: [],
    targetsLeft: 0, damageDealt: 0, blocksBroken: 0, wonAt: 0 };

  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.cc = { kind: 'ground' };
  world.addBody(ground);
  g.ground = ground;

  buildItems(level).forEach((it, idx) => {
    let body;
    if (it.t === 'static') {
      body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(it.w / 2, it.h / 2, it.d / 2)) });
      body.cc = { kind: 'static', w: it.w, h: it.h, d: it.d };
      g.statics.push(body);
    } else if (it.t === 'block') {
      const M = MATS[it.m];
      body = new CANNON.Body({ mass: M.density * it.w * it.h * it.d, shape: new CANNON.Box(new CANNON.Vec3(it.w / 2, it.h / 2, it.d / 2)) });
      body.cc = { kind: 'block', mat: it.m, hp: M.hp, maxHp: M.hp, w: it.w, h: it.h, d: it.d, seed: idx };
      g.blocks.push(body);
    } else {
      const M = MATS.target;
      const he = it.k === 'crown' ? new CANNON.Vec3(0.24, 0.2, 0.24) : new CANNON.Vec3(0.21, 0.21, 0.21);
      body = new CANNON.Body({ mass: M.density * 8 * he.x * he.y * he.z, shape: new CANNON.Box(he) });
      body.cc = { kind: 'target', k: it.k, hp: M.hp, maxHp: M.hp, home: { x: it.x, y: it.y, z: it.z } };
      g.targets.push(body);
    }
    body.position.set(it.x, it.y, it.z);
    body.linearDamping = 0.02; body.angularDamping = 0.05;
    body.allowSleep = true; body.sleepSpeedLimit = 0.12; body.sleepTimeLimit = 0.4;
    body.addEventListener('collide', onCollide);
    world.addBody(body);
  });
  g.targetsLeft = g.targets.length;

  const pending = new Map();
  function onCollide(e) {
    if (g.steps < GRACE) return;
    const a = e.target, b = e.body;
    if (!a.cc || a.cc.dead) return;
    if (a.cc.kind === 'target' && b.cc && b.cc.kind === 'ground') { pending.set(a.id, Infinity); return; }
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v < 1.2) return;
    const ma = a.mass, mb = b.mass || Infinity;
    const mu = mb === Infinity ? ma : (ma * mb) / (ma + mb);
    const spec = (0.5 * mu * v * v) / ma; // J per kg of this body
    const prev = pending.get(a.id) || 0;
    if (spec > prev) pending.set(a.id, spec);
    if (hooks.onHit && spec > 8 && (b.cc && b.cc.kind === 'ball')) hooks.onHit(Math.min(1, spec / 200), a.cc.mat || 'target');
  }

  function wakeAll() { for (const b of world.bodies) if (b.mass > 0) b.wakeUp(); }

  function removeBody(b, why) {
    if (b.cc.dead) return;
    b.cc.dead = true;
    world.removeBody(b);
    if (b.cc.kind === 'block') { g.blocksBroken++; g.score += MATS[b.cc.mat].score; hooks.onBreak && hooks.onBreak(b, b.cc.mat); }
    else if (b.cc.kind === 'target') { g.targetsLeft--; g.score += MATS.target.score; hooks.onTarget && hooks.onTarget(b, b.cc.k, why); }
    wakeAll();
  }
  g.removeBody = removeBody;

  g.fireAt = function (p) {
    if (g.phase !== 'play') return null;
    const v = ballisticVelocity(p);
    const ball = new CANNON.Body({ mass: 140, shape: new CANNON.Sphere(BALL_R), linearDamping: 0, angularDamping: 0.1 });
    ball.position.set(MUZZLE.x, MUZZLE.y, MUZZLE.z);
    ball.velocity.set(v.x, v.y, v.z);
    ball.allowSleep = true; ball.sleepSpeedLimit = 0.2; ball.sleepTimeLimit = 0.5;
    ball.cc = { kind: 'ball', born: g.steps };
    world.addBody(ball);
    g.balls.push(ball);
    while (g.balls.length > MAX_BALLS) { const old = g.balls.shift(); world.removeBody(old); old.cc.dead = true; hooks.onBallRemoved && hooks.onBallRemoved(old); }
    g.shots++;
    hooks.onFire && hooks.onFire(ball);
    return ball;
  };

  g.substep = function () {
    world.step(SUB);
    g.steps++;
    if (pending.size) {
      for (const [id, spec] of pending) {
        const b = g.blocks.find(x => x.id === id) || g.targets.find(x => x.id === id);
        if (!b || b.cc.dead) continue;
        if (spec === Infinity) { removeBody(b, 'ground'); continue; }
        const dmg = spec - 4;
        if (dmg > 0) { b.cc.hp -= dmg; g.damageDealt += dmg; if (b.cc.hp <= 0) removeBody(b, 'broken'); }
      }
      pending.clear();
    }
    if (g.steps % 12 === 0) {
      for (const b of g.blocks) if (!b.cc.dead && b.position.y < -8) removeBody(b, 'fell');
      for (const b of g.targets) if (!b.cc.dead && (b.position.y < -3 || Math.abs(b.position.x) > 30 || b.position.z < -60)) removeBody(b, 'fell');
      for (let i = g.balls.length - 1; i >= 0; i--) {
        const ball = g.balls[i];
        if (ball.position.y < -8 || g.steps - ball.cc.born > 120 * 8) { world.removeBody(ball); ball.cc.dead = true; g.balls.splice(i, 1); hooks.onBallRemoved && hooks.onBallRemoved(ball); }
      }
    }
    if (g.phase === 'play' && g.targetsLeft <= 0) { g.phase = 'winning'; g.wonAt = g.steps; }
    if (g.phase === 'winning' && g.steps - g.wonAt > 150) {
      g.phase = 'won';
      const par = level.par;
      g.stars = g.shots <= par ? 3 : g.shots <= par + 2 ? 2 : 1;
      g.coins = g.stars * 10 + Math.max(0, par + 2 - g.shots) * 5;
      g.score += Math.max(0, par + 3 - g.shots) * 1000;
      hooks.onWin && hooks.onWin(g);
    }
  };
  g.frame = function () { g.substep(); g.substep(); };

  g.isQuiet = function () {
    for (const b of world.bodies) {
      if (b.mass === 0 || b.sleepState === 2) continue;
      if (b.velocity.lengthSquared() > 0.05 || b.angularVelocity.lengthSquared() > 0.05) return false;
    }
    return true;
  };
  // run (headless) until things settle or a time limit
  g.settle = function (maxFrames = 300, minFrames = 30) {
    for (let i = 0; i < maxFrames; i++) { g.frame(); if (i > minFrames && g.isQuiet()) break; }
  };
  return g;
}
