// Castle Crash - 24 levels of stacked, layered structures on a floating platform.
// Coordinates: meters, y = bottom of a piece, z is relative to the platform center (negative = farther away).
// goal = fraction of pieces to knock off the platform; par = shots for 3 stars (tuned with test/sim4.mjs).
export default [
  { name: 'Brick Wall', goal: 0.85, par: 4, platform: { w: 4.4, d: 2.2 }, build(b) {
    b.wall('wood', 0, 0, 0, 6, 7, 0.6, 0.3, 0.4); b.crown(0, 2.1, 0);
  } },
  { name: 'Pyramid', goal: 0.85, par: 4, platform: { w: 4.6, d: 2.2 }, build(b) {
    b.pyramid('wood', 0, 0, 0, 9, 0.45); b.crown(0, 4.05, 0);
  } },
  { name: 'Twin Columns', goal: 0.85, par: 4, platform: { w: 4.4, d: 2.4 }, build(b) {
    b.wall('wood', 0, 0, 0.5, 6, 4, 0.6, 0.3, 0.35);
    let y = b.column('wood', -1.2, 0, -0.4, 8, 0.45); b.crown(-1.2, y, -0.4);
    y = b.column('wood', 1.2, 0, -0.4, 8, 0.45); b.crown(1.2, y, -0.4);
  } },
  { name: 'Jenga Pair', goal: 0.85, par: 4, platform: { w: 4.4, d: 2.6 }, build(b) {
    let y = b.jenga('wood', -0.9, 0, 0, 9); b.crown(-0.9, y, 0);
    y = b.jenga('wood', 0.9, 0, 0, 9); b.crown(0.9, y, 0);
  } },
  { name: 'The Shelf', goal: 0.85, par: 4, platform: { w: 4.6, d: 2.4 }, build(b) {
    b.shelf('wood', 0, 0, 0, 4, 2.2, 0.55, 5);
    b.column('stone', -1.85, 0, 0, 8, 0.4); b.column('stone', 1.85, 0, 0, 8, 0.4);
  } },
  { name: 'Double Wall', goal: 0.85, par: 5, platform: { w: 4.6, d: 2.8 }, build(b) {
    b.wall('ice', 0, 0, 0.8, 6, 5, 0.6, 0.3, 0.35);
    const y = b.wall('wood', 0, 0, -0.5, 6, 6, 0.6, 0.3, 0.4); b.crown(0, y, -0.5);
  } },
  { name: 'Step Pyramid', goal: 0.85, par: 8, platform: { w: 4.6, d: 3.4 }, build(b) {
    const y = b.pyramid3('wood', 0, 0, 0, 5, 0.42, ['stone', 'wood', 'wood', 'wood', 'wood']); b.crown(0, y, 0);
    for (const [x, z] of [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.1], [1.7, 1.1]]) b.column('wood', x, 0, z, 3, 0.36);
  } },
  { name: 'Pagoda', goal: 0.85, par: 4, platform: { w: 4.6, d: 2.8 }, build(b) {
    let y = b.tiers('wood', 0, 0, -0.3, 6, 1.0, 0.45); b.crown(0, y, -0.3);
    b.wall('wood', 0, 0, 0.9, 6, 6, 0.6, 0.3, 0.35);
  } },
  { name: 'Great Wall', goal: 0.87, par: 5, platform: { w: 5.2, d: 2.2 }, build(b) {
    const y = b.wall('wood', 0, 0, 0, 8, 10, 0.6, 0.3, 0.42, ['wood', 'wood', 'stone']); b.crown(-1.2, y, 0); b.crown(1.2, y, 0);
  } },
  { name: 'Three Pagodas', goal: 0.87, par: 4, platform: { w: 5.0, d: 2.8 }, build(b) {
    for (const x of [-1.6, 0, 1.6]) { const y = b.tiers('wood', x, 0, x === 0 ? -0.5 : 0, x === 0 ? 7 : 5, 0.9, 0.42); b.crown(x, y, x === 0 ? -0.5 : 0); }
    b.wall('wood', 0, 0, 1.0, 7, 4, 0.6, 0.3, 0.3);
  } },
  { name: 'Fortress', goal: 0.87, par: 5, platform: { w: 5.0, d: 3.0 }, build(b) {
    b.wall('stone', 0, 0, 1.0, 7, 6, 0.6, 0.3, 0.4, ['stone', 'wood']);
    let y = b.jenga('wood', -1.2, 0, -0.6, 8); b.crown(-1.2, y, -0.6);
    y = b.jenga('wood', 1.2, 0, -0.6, 8); b.crown(1.2, y, -0.6);
  } },
  { name: 'Ziggurat', goal: 0.87, par: 9, platform: { w: 4.8, d: 3.6 }, build(b) {
    let y = b.pyramid3('stone', 0, 0, 0, 5, 0.46, ['stone', 'stone', 'wood', 'wood', 'wood']);
    y = b.column('wood', 0, y, 0, 6, 0.38); b.crown(0, y, 0);
    for (const x of [-2.0, 2.0]) b.column('wood', x, 0, 0, 8, 0.36);
  } },
  { name: 'Library', goal: 0.88, par: 3, platform: { w: 5.2, d: 2.6 }, build(b) {
    b.shelf('wood', -1.25, 0, 0, 5, 2.3, 0.5, 6); b.shelf('stone', 1.25, 0, 0, 5, 2.3, 0.5, 6, 'wood');
  } },
  { name: 'Ice Castle', goal: 0.88, par: 7, platform: { w: 5.0, d: 3.2 }, build(b) {
    b.wall('ice', 0, 0, 1.1, 7, 6, 0.6, 0.3, 0.35);
    for (const x of [-1.7, 1.7]) { const y = b.column('ice', x, 0, -0.3, 7, 0.45); b.crown(x, y, -0.3); }
    const y = b.jenga('ice', 0, 0, -0.5, 9); b.crown(0, y, -0.5);
  } },
  { name: 'Grand Pyramid', goal: 0.88, par: 4, platform: { w: 6.0, d: 2.4 }, build(b) {
    const y = b.pyramid('wood', 0, 0, 0, 13, 0.4, ['stone', 'wood', 'wood']); b.crown(0, y, 0);
    for (const x of [-2.75, 2.75]) b.column('wood', x, 0, 0, 7, 0.4);
  } },
  { name: 'Skyscrapers', goal: 0.88, par: 7, platform: { w: 5.0, d: 3.0 }, build(b) {
    let y = b.jenga('wood', -1.1, 0, -0.3, 15); b.crown(-1.1, y, -0.3);
    y = b.jenga('wood', 1.1, 0, -0.3, 15, 1.05, 0.33, 0.2, ['wood', 'stone']); b.crown(1.1, y, -0.3);
    b.wall('wood', 0, 0, 1.0, 7, 3, 0.6, 0.3, 0.3);
  } },
  { name: 'Colonnade', goal: 0.9, par: 5, platform: { w: 5.2, d: 3.0 }, build(b) {
    const xs = [-2.0, -1.0, 0, 1.0, 2.0];
    for (const x of xs) b.column('stone', x, 0, 0, 6, 0.4, ['stone', 'wood']);
    let y = 6 * 0.4;
    for (let i = 0; i < 4; i++) b.box('wood', -1.5 + i, y, 0, 1.1, 0.16, 0.5);
    y += 0.16;
    for (const x of xs) b.column('wood', x, y, 0, 5, 0.36);
    b.wall('wood', 0, 0, 1.0, 8, 4, 0.6, 0.3, 0.3);
    b.crown(0, y + 5 * 0.36, 0);
  } },
  { name: 'Castle Keep', goal: 0.9, par: 9, platform: { w: 5.0, d: 3.8 }, build(b) {
    b.wall('stone', 0, 0, 1.2, 7, 6, 0.6, 0.3, 0.4, ['stone', 'wood']);
    b.wall('stone', 0, 0, -1.2, 7, 6, 0.6, 0.3, 0.4, ['stone', 'wood']);
    for (const x of [-2.05, 2.05]) for (let r = 0; r < 6; r++) for (let k = -1; k <= 1; k++) b.box(r % 2 ? 'wood' : 'stone', x, r * 0.3, k * 0.6, 0.4, 0.3, 0.58);
    const y = b.tiers('wood', 0, 0, 0, 5, 0.9, 0.45); b.crown(0, y, 0);
  } },
  { name: 'Stone Heart', goal: 0.9, par: 10, platform: { w: 5.0, d: 3.2 }, build(b) {
    let y = b.pyramid3('stone', 0, 0, 0, 4, 0.5); b.crown(0, y, 0);
    b.wall('wood', 0, 0, 1.1, 8, 5, 0.6, 0.3, 0.3);
    for (const x of [-1.9, 1.9]) { y = b.jenga('wood', x, 0, -0.3, 9, 0.9, 0.28, 0.2); b.crown(x, y, -0.3); }
  } },
  { name: 'Twin Pyramids', goal: 0.9, par: 10, platform: { w: 5.4, d: 3.4 }, build(b) {
    for (const x of [-1.35, 1.35]) { const y = b.pyramid3('wood', x, 0, -0.3, 5, 0.42, ['stone', 'wood']); b.crown(x, y, -0.3); }
    for (let i = 0; i < 12; i++) b.cyl('wood', -2.2 + i * 0.4, 0, 1.25, 0.15, 0.5);
    for (let i = 0; i < 11; i++) b.box('wood', -2.0 + i * 0.4, 0.5, 1.25, 0.36, 0.2, 0.36);
  } },
  { name: 'Market Stalls', goal: 0.9, par: 7, platform: { w: 5.6, d: 3.4 }, build(b) {
    b.shelf('wood', -1.75, 0, 0.6, 4, 1.9, 0.5, 5); b.shelf('wood', 1.75, 0, 0.6, 4, 1.9, 0.5, 5);
    b.shelf('stone', 0, 0, -0.8, 6, 2.0, 0.48, 5, 'ice');
  } },
  { name: 'The Great Wall', goal: 0.9, par: 5, platform: { w: 6.0, d: 2.6 }, build(b) {
    const y = b.wall('stone', 0, 0, 0, 9, 13, 0.6, 0.3, 0.45, ['stone', 'wood', 'wood']);
    for (const x of [-2.1, -0.7, 0.7, 2.1]) { const t = b.column('wood', x, y, 0, 4, 0.36); b.crown(x, t, 0); }
  } },
  { name: 'Citadel', goal: 0.9, par: 12, platform: { w: 5.6, d: 3.8 }, build(b) {
    b.wall('stone', 0, 0, 1.3, 8, 6, 0.6, 0.3, 0.4, ['stone', 'wood']);
    for (const x of [-1.9, 1.9]) { const y = b.jenga('wood', x, 0, -0.2, 9, 0.9, 0.28, 0.2, ['wood', 'stone']); b.crown(x, y, -0.2); }
    const y = b.pyramid3('wood', 0, 0, -0.6, 4, 0.42, ['stone', 'wood']); const t = b.tiers('wood', 0, y, -0.6, 3, 0.7, 0.4); b.crown(0, t, -0.6);
  } },
  { name: 'The Last Crown', goal: 0.9, par: 13, platform: { w: 6.0, d: 4.0 }, build(b) {
    b.wall('stone', 0, 0, 1.4, 9, 6, 0.6, 0.3, 0.4, ['stone', 'ice']);
    for (const x of [-2.2, 2.2]) { const y = b.column('stone', x, 0, -0.4, 7, 0.45, ['stone', 'wood']); b.crown(x, y, -0.4); }
    let y = b.pyramid3('stone', 0, 0, -0.5, 4, 0.48, ['stone', 'wood']);
    y = b.jenga('wood', 0, y, -0.5, 8, 0.9, 0.28, 0.2); b.crown(0, y, -0.5);
    b.shelf('wood', 0, 0, -1.6, 2, 3.4, 0.45, 7);
  } }
];
