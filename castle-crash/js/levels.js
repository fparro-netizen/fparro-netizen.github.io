/* Castle Crash - hand-designed levels. Ground top is y=720, world is 450 x 800, launcher at x=72. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CastleLevels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var G = 720;
  var ALL = [
    { name: 'First Shot', balls: 3, par: 1, build: function (b) {
      var y = b.box('wood', 300, G, 40, 40); y = b.box('wood', 300, y, 40, 40); b.crown(300, y);
    } },
    { name: 'Wooden Gate', balls: 3, par: 1, build: function (b) {
      var y = b.frame('wood', 310, G, 80, 60); b.crown(310, y);
    } },
    { name: 'Twin Stacks', balls: 4, par: 2, build: function (b) {
      var y = b.stack('wood', 250, G, 2, 30, 30); b.crown(250, y);
      y = b.stack('wood', 370, G, 3, 30, 30); b.crown(370, y);
    } },
    { name: 'Ice Wall', balls: 3, par: 1, build: function (b) {
      b.box('ice', 240, G, 20, 110);
      var y = b.stack('wood', 320, G, 2, 34, 34); b.crown(320, y);
    } },
    { name: 'The Hut', balls: 3, par: 1, build: function (b) {
      b.slab('wood', 320, G, 30, 14); b.gem(320, G - 14);
      var y = b.frame('wood', 320, G, 96, 60); b.roof('wood', 320, y, 100, 44);
    } },
    { name: 'Watchtower', balls: 3, par: 1, build: function (b) {
      var y = b.tower('wood', 330, G, 3, 60, 50); b.crown(330, y);
    } },
    { name: 'Stone Footing', balls: 4, par: 2, build: function (b) {
      var y = b.frame('stone', 300, G, 100, 50); y = b.frame('wood', 300, y, 70, 50); b.crown(300, y);
      y = b.stack('wood', 400, G, 2, 30, 30); b.crown(400, y);
    } },
    { name: 'The Ledge', balls: 3, par: 1, build: function (b) {
      b.box('ice', 270, G, 20, 120);
      var y = b.plat(385, 560, 90); y = b.box('wood', 385, y, 30, 30); b.crown(385, y);
    } },
    { name: 'Over the Wall', balls: 3, par: 1, build: function (b) {
      b.plat(215, 540, 24, G - 540);
      var y = b.frame('wood', 340, G, 80, 60); b.crown(340, y);
    } },
    { name: 'Castle Walls', balls: 4, par: 2, build: function (b) {
      var y = b.tower(['stone', 'wood'], 250, G, 2, 56, 50); b.crown(250, y);
      y = b.tower(['stone', 'wood'], 390, G, 2, 56, 50); b.crown(390, y);
      b.slab('wood', 320, G, 30, 14); b.gem(320, G - 14);
    } },
    { name: 'Ice Palace', balls: 4, par: 2, build: function (b) {
      var y = b.tower('ice', 260, G, 2, 50, 50); b.crown(260, y);
      y = b.tower('ice', 330, G, 3, 50, 50); b.crown(330, y);
      y = b.tower('ice', 400, G, 2, 50, 50); b.crown(400, y);
    } },
    { name: 'Pyramid', balls: 4, par: 2, build: function (b) {
      var s = 30, rows = [5, 4, 3, 2], y = G;
      for (var r = 0; r < rows.length; r++) {
        var n = rows[r], x0 = 330 - (n - 1) * s / 2;
        for (var i = 0; i < n; i++) b.box(r % 2 ? 'wood' : 'stone', x0 + i * s, y, s, s);
        y -= s;
      }
      b.gem(330, y);
    } },
    { name: 'Floating Gems', balls: 4, par: 2, build: function (b) {
      var y = b.plat(300, 500, 60); y = b.post('wood', 300, y, 40, 16); b.gem(300, y);
      y = b.plat(400, 610, 60); y = b.post('wood', 400, y, 40, 16); b.gem(400, y);
    } },
    { name: 'Fortress Gate', balls: 4, par: 2, build: function (b) {
      b.box('stone', 230, G, 24, 90); b.box('stone', 230, G - 90, 24, 40);
      var y = b.frame('wood', 330, G, 90, 60); y = b.frame('wood', 330, y, 70, 50); b.crown(330, y);
      b.slab('wood', 330, G, 30, 14); b.gem(330, G - 14);
    } },
    { name: 'Dominoes', balls: 3, par: 1, build: function (b) {
      for (var i = 0; i < 5; i++) b.post('wood', 220 + i * 38, G, 90, 14);
      var y = b.stack('wood', 420, G, 1, 30, 30); b.crown(420, y);
    } },
    { name: 'Shelter', balls: 4, par: 2, build: function (b) {
      b.plat(340, 560, 150);
      var y = b.stack('ice', 300, G, 2, 30, 30); b.crown(300, y);
      y = b.stack('wood', 380, G, 2, 30, 30); b.crown(380, y);
    } },
    { name: 'The Keep', balls: 4, par: 2, build: function (b) {
      var s = b.frame('stone', 330, G, 120, 60);
      b.slab('wood', 330, G, 30, 14); b.crown(330, G - 14);
      b.crown(330, s);
      var y = b.frame('wood', 330, s, 100, 50);
      b.roof('wood', 330, y, 110, 40);
    } },
    { name: 'Rope Bridge', balls: 4, par: 2, build: function (b) {
      b.plat(250, 600, 40); b.plat(410, 600, 40);
      var y = b.slab('wood', 330, 600, 170, 14);
      y = b.box('ice', 330, y, 30, 30); b.crown(330, y);
      b.crown(410, 600);
    } },
    { name: 'High Tower', balls: 4, par: 2, build: function (b) {
      var y = b.tower(['stone', 'wood', 'wood', 'ice', 'wood'], 360, G, 5, 56, 46); b.crown(360, y);
      y = b.stack('ice', 260, G, 1, 30, 30); b.gem(260, y);
    } },
    { name: 'Twin Keeps', balls: 5, par: 3, build: function (b) {
      var y = b.frame('stone', 260, G, 70, 50); y = b.frame('wood', 260, y, 60, 50); b.crown(260, y);
      b.slab('wood', 260, G, 24, 12); b.gem(260, G - 12);
      y = b.frame('stone', 390, G, 70, 50); y = b.frame('wood', 390, y, 60, 50); b.crown(390, y);
      b.slab('wood', 390, G, 24, 12); b.gem(390, G - 12);
    } },
    { name: 'Sky Throne', balls: 4, par: 2, build: function (b) {
      b.plat(215, 560, 24, G - 560);
      var y = b.plat(380, 430, 80); y = b.frame('wood', 380, y, 60, 40); b.crown(380, y);
      y = b.stack('stone', 330, G, 2, 30, 30); b.gem(330, y);
    } },
    { name: 'Stone Ring', balls: 5, par: 3, build: function (b) {
      var y = b.frame('stone', 280, G, 80, 60); b.crown(280, y);
      y = b.frame('stone', 380, G, 80, 60); b.crown(380, y);
      b.slab('ice', 280, G, 24, 12); b.gem(280, G - 12);
      b.slab('ice', 380, G, 24, 12); b.gem(380, G - 12);
    } },
    { name: 'Royal Citadel', balls: 5, par: 3, build: function (b) {
      b.box('stone', 225, G, 22, 100);
      var y = b.tower(['stone', 'wood'], 300, G, 2, 60, 50); b.crown(300, y);
      y = b.tower(['stone', 'wood', 'ice'], 390, G, 3, 60, 50); b.crown(390, y);
      b.slab('wood', 345, G, 24, 12); b.gem(345, G - 12);
    } },
    { name: 'The Last Crown', balls: 5, par: 3, build: function (b) {
      b.plat(210, 520, 24, G - 520);
      var y = b.plat(300, 470, 60); y = b.stack('ice', 300, y, 1, 26, 26); b.gem(300, y);
      y = b.tower(['stone', 'wood', 'stone', 'wood'], 380, G, 4, 60, 46); b.crown(380, y);
      b.slab('wood', 380, G, 24, 12); b.gem(380, G - 12);
    } }
  ];
  // play order (easy -> hard) with [balls, par]; tuned with test/sim.js
  var ORDER = [
    ['First Shot', 3, 1], ['Watchtower', 3, 1], ['Wooden Gate', 3, 1], ['Ice Wall', 3, 1],
    ['The Hut', 3, 1], ['Dominoes', 3, 1], ['Stone Footing', 4, 2], ['High Tower', 3, 1],
    ['Twin Stacks', 4, 2], ['The Ledge', 3, 1], ['Pyramid', 3, 1], ['Fortress Gate', 4, 2],
    ['Shelter', 4, 2], ['Over the Wall', 3, 1], ['Rope Bridge', 4, 2], ['Ice Palace', 4, 2],
    ['Floating Gems', 4, 2], ['Castle Walls', 4, 2], ['The Keep', 4, 2], ['Royal Citadel', 4, 2],
    ['Twin Keeps', 4, 3], ['Stone Ring', 4, 3], ['Sky Throne', 3, 2], ['The Last Crown', 5, 3]
  ];
  var byName = {};
  ALL.forEach(function (l) { byName[l.name] = l; });
  return ORDER.map(function (o) {
    var l = byName[o[0]];
    return { name: l.name, balls: o[1], par: o[2], build: l.build };
  });
});
