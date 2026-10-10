// Castle Crash 3D - 24 hand-built levels. Units are meters, ground is y=0, the player stands at z=+9 looking toward -z.
// par = shots for 3 stars (tuned with test/sim3.mjs)
const Z = -8;
export default [
  { name: 'First Shot', par: 1, build(b) { const y = b.stack('wood', 0, 0, Z, 2); b.crown(0, y, Z); } },
  { name: 'Watchtower', par: 1, build(b) { const y = b.tower('wood', 0, 0, Z, 2); b.crown(0, y, Z); } },
  { name: 'Wooden Gate', par: 1, build(b) {
    b.box('wood', -1.1, 0, Z, 0.35, 1.6, 0.5); b.box('wood', 1.1, 0, Z, 0.35, 1.6, 0.5);
    const y = b.box('wood', 0, 1.6, Z, 2.8, 0.3, 0.6); b.crown(0, y, Z);
  } },
  { name: 'Ice Wall', par: 2, build(b) {
    b.wall('ice', 0, 0, Z + 1.5, 4, 3);
    const y = b.stack('wood', 0, 0, Z - 0.5, 2); b.crown(0, y, Z - 0.5);
  } },
  { name: 'Twin Stacks', par: 2, build(b) {
    let y = b.stack('wood', -1.5, 0, Z, 2); b.crown(-1.5, y, Z);
    y = b.stack('wood', 1.5, 0, Z, 3); b.crown(1.5, y, Z);
  } },
  { name: 'The Hut', par: 2, build(b) {
    b.plank('wood', 0, 0, Z, 0.6, 0.6); b.gem(0, 0.2, Z);
    b.box('wood', 0, 0, Z + 0.9, 2.0, 1.2, 0.2); b.box('wood', 0, 0, Z - 0.9, 2.0, 1.2, 0.2);
    b.box('wood', -0.9, 0, Z, 0.2, 1.2, 1.6); b.box('wood', 0.9, 0, Z, 0.2, 1.2, 1.6);
    b.box('wood', 0, 1.2, Z, 2.3, 0.2, 2.3);
  } },
  { name: 'Stone Footing', par: 2, build(b) {
    let y = b.frame('stone', -0.8, 0, Z, 1.6, 1.0); y = b.frame('wood', -0.8, y, Z, 1.3, 1.0); b.crown(-0.8, y, Z);
    y = b.stack('wood', 1.8, 0, Z, 2); b.crown(1.8, y, Z);
  } },
  { name: 'High Tower', par: 2, build(b) { const y = b.tower(['stone', 'wood', 'wood', 'ice', 'wood'], 0, 0, Z, 5, 1.4, 0.9); b.crown(0, y, Z); } },
  { name: 'Dominoes', par: 5, build(b) {
    for (let i = 0; i < 6; i++) b.box('wood', 0, 0, Z + 2.5 - i * 0.9, 1.2, 1.8, 0.2);
    const y = b.crate('stone', 0, 0, Z - 3.2, 0.7); b.crown(0, y, Z - 3.2);
  } },
  { name: 'The Ledge', par: 2, build(b) {
    b.wall('ice', 0, 0, Z + 1.5, 3, 4);
    let y = b.pillar(1.2, 0, Z - 1, 1.2, 2.2); y = b.crate('wood', 1.2, y, Z - 1, 0.6); b.crown(1.2, y, Z - 1);
    y = b.pillar(-1.4, 0, Z - 1.5, 1.0, 1.2); b.gem(-1.4, y, Z - 1.5);
  } },
  { name: 'Pyramid', par: 2, build(b) {
    const s = 0.7; let y = 0;
    [4, 3, 2, 1].forEach((n, r) => { for (let i = 0; i < n; i++) b.crate(r % 2 ? 'wood' : 'stone', (i - (n - 1) / 2) * s, y, Z, s); y += s; });
    b.gem(0, y, Z);
  } },
  { name: 'Fortress Gate', par: 3, build(b) {
    b.wall('stone', -1.6, 0, Z + 1.2, 2, 5); b.wall('stone', 1.6, 0, Z + 1.2, 2, 5);
    let y = b.frame('wood', 0, 0, Z - 0.8, 1.4, 1.2); y = b.frame('wood', 0, y, Z - 0.8, 1.2, 1.0); b.crown(0, y, Z - 0.8);
    b.plank('wood', 0, 0, Z - 0.8, 0.6, 0.6); b.gem(0, 0.2, Z - 0.8);
  } },
  { name: 'Shelter', par: 3, build(b) {
    b.pillar(-2.3, 0, Z, 0.5, 2.2); b.pillar(2.3, 0, Z, 0.5, 2.2); b.pillar(0, 2.2, Z, 5.1, 0.35, 2.0);
    let y = b.stack('ice', -1.1, 0, Z, 2, 0.6); b.crown(-1.1, y, Z);
    y = b.stack('wood', 1.1, 0, Z, 2, 0.6); b.crown(1.1, y, Z);
  } },
  { name: 'Window', par: 3, build(b) {
    b.pillar(-1.75, 0, Z + 1, 2.0, 3.2, 0.5); b.pillar(1.75, 0, Z + 1, 2.0, 3.2, 0.5);
    b.pillar(0, 0, Z + 1, 1.5, 1.2, 0.5); b.pillar(0, 2.4, Z + 1, 1.5, 0.8, 0.5);
    let y = b.frame('wood', 0, 0, Z - 1, 1.2, 1.3); y = b.crate('ice', 0, y, Z - 1, 0.6); b.crown(0, y, Z - 1);
  } },
  { name: 'Rope Bridge', par: 3, build(b) {
    b.pillar(-2.0, 0, Z, 0.8, 2.0); b.pillar(2.0, 0, Z, 0.8, 2.0);
    let y = b.plank('wood', 0, 2.0, Z, 4.6, 1.0);
    y = b.crate('ice', 0, y, Z, 0.6); b.crown(0, y, Z);
    b.crown(-2.0, 2.0, Z); b.gem(2.0, 2.0, Z);
  } },
  { name: 'Ice Palace', par: 3, build(b) {
    let y = b.tower('ice', -1.8, 0, Z, 2, 1.1, 1.0); b.crown(-1.8, y, Z);
    y = b.tower('ice', 0, 0, Z - 1, 3, 1.1, 1.0); b.crown(0, y, Z - 1);
    y = b.tower('ice', 1.8, 0, Z, 2, 1.1, 1.0); b.crown(1.8, y, Z);
  } },
  { name: 'Floating Gems', par: 3, build(b) {
    let y = b.pillar(-1.8, 0, Z, 0.7, 3.0); y = b.box('wood', -1.8, y, Z, 0.25, 0.6, 0.25); b.gem(-1.8, y, Z);
    y = b.pillar(0, 0, Z - 2, 0.7, 1.8); y = b.box('wood', 0, y, Z - 2, 0.25, 0.6, 0.25); b.gem(0, y, Z - 2);
    y = b.pillar(1.8, 0, Z + 1, 0.7, 0.8); y = b.box('wood', 1.8, y, Z + 1, 0.25, 0.6, 0.25); b.gem(1.8, y, Z + 1);
  } },
  { name: 'Castle Walls', par: 4, build(b) {
    let y = b.tower(['stone', 'wood'], -2, 0, Z, 2, 1.2, 1.0); b.crown(-2, y, Z);
    y = b.tower(['stone', 'wood'], 2, 0, Z, 2, 1.2, 1.0); b.crown(2, y, Z);
    b.wall('stone', 0, 0, Z + 0.8, 3, 3);
    b.plank('wood', 0, 0, Z - 0.3, 0.6, 0.6); b.gem(0, 0.2, Z - 0.3);
  } },
  { name: 'The Keep', par: 4, build(b) {
    b.wall('stone', 0, 0, Z + 1.1, 4, 4); b.wall('stone', 0, 0, Z - 1.1, 4, 4);
    b.box('stone', -1.4, 0, Z, 0.4, 1.6, 1.8); b.box('stone', 1.4, 0, Z, 0.4, 1.6, 1.8);
    b.plank('wood', 0, 0, Z, 0.6, 0.6); b.crown(0, 0.2, Z);
    const y = b.box('wood', 0, 1.6, Z, 3.4, 0.25, 2.8); b.crown(0, y, Z);
  } },
  { name: 'Royal Citadel', par: 4, build(b) {
    b.wall('stone', 0, 0, Z + 2, 4, 2);
    let y = b.tower(['stone', 'wood'], -1.2, 0, Z, 2, 1.3, 1.1); b.crown(-1.2, y, Z);
    y = b.tower(['stone', 'wood', 'ice'], 1.2, 0, Z - 0.5, 3, 1.3, 1.0); b.crown(1.2, y, Z - 0.5);
    b.plank('wood', 0, 0, Z + 0.8, 0.6, 0.6); b.gem(0, 0.2, Z + 0.8);
  } },
  { name: 'Twin Keeps', par: 5, build(b) {
    for (const x of [-1.6, 1.6]) {
      let y = b.frame('stone', x, 0, Z, 1.5, 1.1); b.plank('wood', x, 0, Z, 0.5, 0.5); b.gem(x, 0.2, Z);
      y = b.frame('stone', x, y, Z, 1.3, 1.0); b.crown(x, y, Z);
    }
    b.wall('stone', 0, 0, Z + 1.6, 3, 2);
  } },
  { name: 'Stone Ring', par: 5, build(b) {
    b.wall('stone', 0, 0, Z + 1.2, 4, 4); b.wall('stone', 0, 0, Z - 1.2, 4, 4);
    b.box('stone', -1.4, 0, Z, 0.45, 1.6, 2.0); b.box('stone', 1.4, 0, Z, 0.45, 1.6, 2.0);
    const y = b.stack('stone', 0, 0, Z, 2, 0.7); b.crown(0, y, Z);
    b.plank('wood', -0.75, 0, Z + 0.5, 0.5, 0.5); b.gem(-0.75, 0.2, Z + 0.5);
  } },
  { name: 'Sky Throne', par: 5, build(b) {
    b.wall('stone', 0, 0, Z + 2.2, 4, 3);
    let y = b.pillar(0, 0, Z - 1.5, 1.4, 3.2); y = b.frame('stone', 0, y, Z - 1.5, 1.2, 0.9); b.crown(0, y, Z - 1.5);
    y = b.stack('stone', -1.8, 0, Z, 2, 0.6); b.gem(-1.8, y, Z);
    y = b.stack('stone', 1.8, 0, Z, 2, 0.6); b.gem(1.8, y, Z);
  } },
  { name: 'The Last Crown', par: 7, build(b) {
    b.wall('stone', 0, 0, Z + 2.2, 5, 4);
    let y = b.tower(['stone', 'stone', 'wood'], -2.2, 0, Z, 3, 1.2, 1.0); b.crown(-2.2, y, Z);
    y = b.tower(['stone', 'stone', 'wood'], 2.2, 0, Z, 3, 1.2, 1.0); b.crown(2.2, y, Z);
    y = b.pillar(0, 0, Z - 1.5, 1.6, 2.4); y = b.frame('stone', 0, y, Z - 1.5, 1.4, 1.0); y = b.frame('wood', 0, y, Z - 1.5, 1.2, 0.9); b.crown(0, y, Z - 1.5);
    b.plank('stone', 0, 0, Z, 0.6, 0.6); b.gem(0, 0.2, Z);
  } }
];
