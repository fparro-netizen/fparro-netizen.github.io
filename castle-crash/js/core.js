/* Castle Crash - shared game core (physics + rules). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CastleCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 450, H = 800, GROUND_Y = 720;
  var LAUNCH = { x: 72, y: 612 };
  var MAXV = 17;          // px per 60Hz step at full power
  var GRAVITY = 1.6;
  var STEP_MS = 1000 / 60;
  var BALL_R = 12;
  var GRACE_STEPS = 50;   // no damage while the level settles

  var MATS = {
    ice:    { density: 0.0012, friction: 0.25, hp: 9,   score: 50,  restitution: 0.05 },
    wood:   { density: 0.0016, friction: 0.7,  hp: 26,  score: 100, restitution: 0.02 },
    stone:  { density: 0.0036, friction: 0.85, hp: 70,  score: 200, restitution: 0.0 },
    target: { density: 0.0018, friction: 0.7,  hp: 4,   score: 500, restitution: 0.05 }
  };

  // ---- level builder -------------------------------------------------------
  function Builder() { this.items = []; }
  Builder.prototype.box = function (m, cx, bottom, w, h) {
    this.items.push({ t: 'block', m: m, x: cx, y: bottom - h / 2, w: w, h: h });
    return bottom - h;
  };
  Builder.prototype.post = function (m, cx, bottom, h, w) { return this.box(m, cx, bottom, w || 16, h || 60); };
  Builder.prototype.slab = function (m, cx, bottom, w, h) { return this.box(m, cx, bottom, w, h || 16); };
  // two posts + slab on top; returns top y
  Builder.prototype.frame = function (m, cx, bottom, w, h, slabM) {
    var pw = 16;
    this.post(m, cx - w / 2 + pw / 2, bottom, h, pw);
    this.post(m, cx + w / 2 - pw / 2, bottom, h, pw);
    return this.slab(slabM || m, cx, bottom - h, w + 8, 16);
  };
  Builder.prototype.tower = function (m, cx, bottom, floors, w, h) {
    var y = bottom;
    for (var i = 0; i < floors; i++) y = this.frame(Array.isArray(m) ? m[i % m.length] : m, cx, y, w || 60, h || 50);
    return y;
  };
  Builder.prototype.stack = function (m, cx, bottom, n, w, h) {
    var y = bottom;
    for (var i = 0; i < n; i++) y = this.box(Array.isArray(m) ? m[i % m.length] : m, cx, y, w || 30, h || 30);
    return y;
  };
  Builder.prototype.plat = function (cx, top, w, h) {
    h = h || 20;
    this.items.push({ t: 'static', x: cx, y: top + h / 2, w: w, h: h });
    return top;
  };
  Builder.prototype.roof = function (m, cx, bottom, w, h) {
    this.items.push({ t: 'roof', m: m, x: cx, y: bottom, w: w, h: h || w * 0.5 });
    return bottom - (h || w * 0.5);
  };
  Builder.prototype.crown = function (cx, bottom) { this.items.push({ t: 'target', k: 'crown', x: cx, y: bottom - 10 }); };
  Builder.prototype.gem = function (cx, bottom) { this.items.push({ t: 'target', k: 'gem', x: cx, y: bottom - 11 }); };

  function buildItems(level) {
    var b = new Builder();
    level.build(b);
    return b.items;
  }

  // ---- game instance --------------------------------------------------------
  function createGame(Matter, level, hooks) {
    hooks = hooks || {};
    var Engine = Matter.Engine, Bodies = Matter.Bodies, Body = Matter.Body,
        Composite = Matter.Composite, Events = Matter.Events, Sleeping = Matter.Sleeping, Vertices = Matter.Vertices;

    var engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = GRAVITY;
    var world = engine.world;

    var g = {
      engine: engine, level: level, W: W, H: H, GROUND_Y: GROUND_Y, LAUNCH: LAUNCH, MAXV: MAXV,
      ballsLeft: level.balls, shotsUsed: 0, score: 0, phase: 'aim', stepCount: 0,
      blocks: [], targets: [], statics: [], ball: null, oldBalls: [], targetsLeft: 0,
      blocksBroken: 0, damageDealt: 0
    };

    var ground = Bodies.rectangle(W / 2, GROUND_Y + 200, 3000, 400, { isStatic: true, friction: 0.9, label: 'ground' });
    ground.plugin.cc = { kind: 'ground' };
    Composite.add(world, ground);
    g.ground = ground;

    var items = buildItems(level);
    items.forEach(function (it, idx) {
      var body;
      if (it.t === 'static') {
        body = Bodies.rectangle(it.x, it.y, it.w, it.h, { isStatic: true, friction: 0.9, label: 'static' });
        body.plugin.cc = { kind: 'static', w: it.w, h: it.h };
        g.statics.push(body);
      } else if (it.t === 'block' || it.t === 'roof') {
        var mat = MATS[it.m];
        var opts = { density: mat.density, friction: mat.friction, frictionStatic: 1.0, restitution: mat.restitution, label: it.m, slop: 0.02 };
        if (it.t === 'block') body = Bodies.rectangle(it.x, it.y, it.w, it.h, opts);
        else {
          var verts = [{ x: it.x - it.w / 2, y: it.y }, { x: it.x + it.w / 2, y: it.y }, { x: it.x, y: it.y - it.h }];
          body = Bodies.fromVertices(it.x, it.y - it.h / 3, [verts], opts);
          Body.setPosition(body, { x: it.x, y: it.y - it.h / 3 });
        }
        var hp = mat.hp * Math.max(0.6, Math.min(1.8, (it.w * it.h) / 1600));
        body.plugin.cc = { kind: 'block', mat: it.m, hp: hp, maxHp: hp, w: it.w, h: it.h, roof: it.t === 'roof', seed: idx * 7919 % 1000 };
        g.blocks.push(body);
      } else if (it.t === 'target') {
        var tm = MATS.target;
        var topts = { density: tm.density, friction: tm.friction, frictionStatic: 1.0, restitution: tm.restitution, label: 'target' };
        if (it.k === 'crown') body = Bodies.rectangle(it.x, it.y, 26, 20, topts);
        else body = Bodies.polygon(it.x, it.y, 6, 11, topts);
        body.plugin.cc = { kind: 'target', k: it.k, hp: tm.hp, maxHp: tm.hp };
        g.targets.push(body);
      }
      if (body) Composite.add(world, body);
    });
    g.targetsLeft = g.targets.length;

    function wakeAll() {
      Composite.allBodies(world).forEach(function (b) { if (!b.isStatic && b.isSleeping) Sleeping.set(b, false); });
    }

    function removeBody(b, why) {
      var cc = b.plugin.cc;
      if (!cc || cc.dead) return;
      cc.dead = true;
      Composite.remove(world, b);
      if (cc.kind === 'block') {
        g.blocksBroken++;
        g.score += MATS[cc.mat].score;
        if (hooks.onBreak) hooks.onBreak(b, cc.mat);
      } else if (cc.kind === 'target') {
        g.targetsLeft--;
        g.score += MATS.target.score;
        if (hooks.onTarget) hooks.onTarget(b, cc.k, why);
      }
      wakeAll();
    }
    g.removeBody = removeBody;

    function damage(b, amount) {
      var cc = b.plugin.cc;
      if (!cc || cc.dead || (cc.kind !== 'block' && cc.kind !== 'target')) return;
      cc.hp -= amount;
      g.damageDealt += amount;
      if (cc.hp <= 0) removeBody(b, 'broken');
    }

    var pending = [];
    Events.on(engine, 'collisionStart', function (ev) {
      if (g.stepCount < GRACE_STEPS) return;
      for (var i = 0; i < ev.pairs.length; i++) {
        var p = ev.pairs[i];
        var a = p.bodyA.parent, b = p.bodyB.parent;
        var ca = a.plugin.cc || {}, cb = b.plugin.cc || {};
        // targets touching the ground are knocked off
        if (ca.kind === 'target' && cb.kind === 'ground') { pending.push([a, 999]); continue; }
        if (cb.kind === 'target' && ca.kind === 'ground') { pending.push([b, 999]); continue; }
        var rvx = a.velocity.x - b.velocity.x, rvy = a.velocity.y - b.velocity.y;
        var n = p.collision.normal;
        var rel = Math.abs(rvx * n.x + rvy * n.y);
        var ma = a.isStatic ? Infinity : a.mass, mb = b.isStatic ? Infinity : b.mass;
        var mu = (ma === Infinity) ? mb : (mb === Infinity) ? ma : (ma * mb) / (ma + mb);
        var E = rel * rel * mu;
        var dmg = Math.max(0, E - 14) * 0.1;
        if (dmg <= 0) continue;
        if (hooks.onHit && E > 30) hooks.onHit(Math.min(1, E / 400), ca.mat || cb.mat || 'stone', ca.kind === 'ball' || cb.kind === 'ball');
        if (!a.isStatic) pending.push([a, dmg]);
        if (!b.isStatic) pending.push([b, dmg]);
      }
    });

    g.aimVelocity = function (angleDeg, power) {
      var a = angleDeg * Math.PI / 180, v = MAXV * Math.max(0, Math.min(1, power));
      return { x: Math.cos(a) * v, y: -Math.sin(a) * v };
    };

    // predicted path points (world coords) for given launch velocity
    g.predict = function (v, steps) {
      var pts = [], x = LAUNCH.x, y = LAUNCH.y, vx = v.x, vy = v.y;
      var acc = GRAVITY * 0.001 * STEP_MS * STEP_MS;
      for (var i = 0; i < steps; i++) {
        vy += acc; x += vx; y += vy;
        pts.push({ x: x, y: y });
        if (y > GROUND_Y || x > W + 40) break;
      }
      return pts;
    };

    var flyT = 0, slowT = 0, endT = 0;
    g.fire = function (v) {
      if (g.phase !== 'aim' || g.ballsLeft <= 0) return false;
      var ball = Bodies.circle(LAUNCH.x, LAUNCH.y, BALL_R, { density: 0.009, friction: 0.4, frictionAir: 0, restitution: 0.15, label: 'ball' });
      ball.plugin.cc = { kind: 'ball' };
      Composite.add(world, ball);
      Body.setVelocity(ball, v);
      g.ball = ball;
      g.ballsLeft--; g.shotsUsed++;
      g.phase = 'flying'; flyT = 0; slowT = 0;
      wakeAll();
      if (hooks.onLaunch) hooks.onLaunch();
      return true;
    };

    function outOfWorld(b) { return b.position.y > H + 150 || b.position.x < -150 || b.position.x > W + 200; }

    function quiet() {
      var bodies = Composite.allBodies(world);
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.isStatic || b.isSleeping || b === g.ball) continue;
        if (b.speed > 0.25 || b.angularSpeed > 0.02) return false;
      }
      return true;
    }

    g.step = function () {
      Engine.update(engine, STEP_MS);
      g.stepCount++;
      for (var i = 0; i < pending.length; i++) damage(pending[i][0], pending[i][1]);
      pending.length = 0;
      // off-world cleanup
      g.blocks.concat(g.targets).forEach(function (b) { if (!b.plugin.cc.dead && outOfWorld(b)) removeBody(b, 'fell'); });

      if (g.phase === 'won' || g.phase === 'lost') return;
      if (g.targetsLeft <= 0) {
        if (g.phase !== 'winning') { g.phase = 'winning'; endT = 0; }
      }
      if (g.phase === 'winning') {
        if (++endT > 70) {
          g.phase = 'won';
          g.coins = g.ballsLeft * 10;
          g.score += g.ballsLeft * 1000;
          g.stars = g.shotsUsed <= level.par ? 3 : g.shotsUsed <= level.par + 1 ? 2 : 1;
          if (hooks.onWin) hooks.onWin(g);
        }
        return;
      }
      if (g.phase === 'flying') {
        flyT++;
        var ball = g.ball;
        if (ball && (ball.speed < 0.3 || ball.isSleeping)) slowT++; else slowT = 0;
        var ballDone = !ball || slowT > 25 || outOfWorld(ball) || flyT > 480;
        if ((ballDone && quiet() && flyT > 40) || flyT > 660) {
          if (ball) { g.oldBalls.push(ball); ball.plugin.cc.fadeAt = g.stepCount; }
          g.ball = null;
          if (g.ballsLeft > 0) g.phase = 'aim';
          else { g.phase = 'lastcheck'; endT = 0; }
        }
      } else if (g.phase === 'lastcheck') {
        if (++endT > 60) { g.phase = 'lost'; if (hooks.onLose) hooks.onLose(g); }
      }
      // fade + remove old balls after a while
      for (var j = g.oldBalls.length - 1; j >= 0; j--) {
        var ob = g.oldBalls[j];
        if (g.stepCount - ob.plugin.cc.fadeAt > 45) { Composite.remove(world, ob); g.oldBalls.splice(j, 1); }
      }
    };

    // run until the current shot resolves (for tests / solver)
    g.resolve = function (maxSteps) {
      maxSteps = maxSteps || 2000;
      for (var i = 0; i < maxSteps && (g.phase === 'flying' || g.phase === 'winning' || g.phase === 'lastcheck'); i++) g.step();
      return g.phase;
    };
    g.settle = function (n) { for (var i = 0; i < (n || 90); i++) g.step(); };

    return g;
  }

  return { W: W, H: H, GROUND_Y: GROUND_Y, LAUNCH: LAUNCH, MAXV: MAXV, MATS: MATS, BALL_R: BALL_R,
           createGame: createGame, buildItems: buildItems };
});
