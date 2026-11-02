/* ============================================================
   倾汤 · 锅盔回声  —  core.js
   数学 / 输入 / 相机 / 粒子 / 碰撞
   ============================================================ */
const W = {};

/* ---------------- math ---------------- */
W.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
W.lerp = (a, b, t) => a + (b - a) * t;
W.rand = (a = 1, b = 0) => b + Math.random() * (a - b);
W.randi = (a, b) => Math.floor(W.rand(a, b));
W.chance = p => Math.random() < p;
W.ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outBack: t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outElastic: t => {
    const c = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  }
};
W.approach = (cur, tgt, step) => cur < tgt ? Math.min(cur + step, tgt) : Math.max(cur - step, tgt);
W.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
W.rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
W.rect = (x, y, w, h) => ({ x, y, w, h });
W.pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/* ---------------- input ---------------- */
W.KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump',
  KeyJ: 'attack', KeyZ: 'attack',
  KeyK: 'heavy', KeyX: 'heavy',
  KeyL: 'echo', KeyC: 'echo',
  ShiftLeft: 'roll', ShiftRight: 'roll',
  KeyE: 'interact', Enter: 'interact',
  KeyQ: 'heal',
  KeyR: 'rest',
  Escape: 'pause', KeyP: 'pause'
};

W.Input = class Input {
  constructor() {
    this.down = Object.create(null);
    this.hit = Object.create(null);
    this.consume = Object.create(null);
    this.padPrev = {};
    this.pad = null;
    this.buffers = Object.create(null);
    this.anyKey = false;
    this.lastSign = 1;

    addEventListener('keydown', e => {
      const a = W.KEYMAP[e.code];
      if (a) { e.preventDefault(); if (!this.down[a]) this.hit[a] = true; this.down[a] = true; this.buffers[a] = 0.16; this.anyKey = true; }
      if (e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', e => {
      const a = W.KEYMAP[e.code];
      if (a) { this.down[a] = false; e.preventDefault(); }
    });
    addEventListener('blur', () => { this.down = Object.create(null); });
  }
  padPoll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    this.pad = p;
    if (!p) return;
    const btn = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const map = { jump: btn(0), roll: btn(1), attack: btn(2), heavy: btn(3), echo: btn(5), interact: btn(9), heal: btn(4) };
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (ax < -0.35) map.left = true; if (ax > 0.35) map.right = true;
    if (ay < -0.5) map.up = true; if (ay > 0.5) map.down = true;
    for (const a in map) {
      if (map[a] && !this.padPrev[a]) { this.hit[a] = true; this.buffers[a] = 0.16; this.anyKey = true; }
      if (map[a]) { this.down[a] = true; this.buffers[a] = 0.16; } else if (this.padPrev[a]) this.down[a] = false;
      this.padPrev[a] = map[a];
    }
  }
  update(dt) {
    this.padPoll();
    for (const k in this.buffers) this.buffers[k] = Math.max(0, this.buffers[k] - dt);
    if (this.down.left && !this.down.right) this.lastSign = -1;
    else if (this.down.right && !this.down.left) this.lastSign = 1;
  }
  endFrame() { this.hit = Object.create(null); }
  pressed(a) { return !!this.hit[a]; }
  buffered(a) { return (this.buffers[a] || 0) > 0; }
  useBuffer(a) { this.buffers[a] = 0; }
  held(a) { return !!this.down[a]; }
  axis() { return (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0); }
};

/* ---------------- camera ---------------- */
W.Camera = class Camera {
  constructor() { this.x = 0; this.y = 0; this.shake = 0; this.shakeT = 0; this.zoom = 1; this.bounds = { x: 0, y: 0, w: 99999, h: 99999 }; }
  follow(t, dt, look = 0) {
    const tx = t.x + t.w / 2 + look - 640;
    const ty = t.y + t.h / 2 - 330;
    const k = 1 - Math.pow(0.0016, dt);
    this.x = W.lerp(this.x, tx, k);
    this.y = W.lerp(this.y, ty, k * 0.85);
    const b = this.bounds;
    this.x = W.clamp(this.x, b.x, b.x + Math.max(0, b.w - 1280));
    this.y = W.clamp(this.y, b.y, b.y + Math.max(0, b.h - 720));
    if (this.shakeT > 0) this.shakeT -= dt; else this.shake = 0;
  }
  kick(amount) { this.shake = Math.max(this.shake, amount); this.shakeT = 0.32; }
  get ox() { return this.x + (this.shake ? W.rand(this.shake, -this.shake) : 0); }
  get oy() { return this.y + (this.shake ? W.rand(this.shake, -this.shake) : 0); }
};

/* ---------------- particles ---------------- */
W.Particles = class Particles {
  constructor(max = 900) { this.p = []; this.max = max; }
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 3, color: '#fff',
      grav: 0, drag: 0.9, type: 'dot', rot: 0, vr: 0, glow: 0, fade: true, bounce: 0
    }, o));
  }
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = W.rand(Math.PI * 2), s = W.rand(o.speed || 260, (o.speed || 260) * 0.15);
      this.spawn(Object.assign({}, o, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.lift || 0),
        life: W.rand(o.life || 0.7, (o.life || 0.7) * 0.4), max: o.life || 0.7,
        size: W.rand(o.size || 4, 1.2), rot: W.rand(6.28), vr: W.rand(9, -9)
      }));
    }
  }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0) { this.p.splice(i, 1); continue; }
      q.vy += q.grav * dt;
      q.vx *= Math.pow(q.drag, dt * 60);
      q.vy *= Math.pow(q.drag, dt * 60);
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
  }
  clear() { this.p.length = 0; }
};

/* ---------------- floating text ---------------- */
W.FloatText = class FloatText {
  constructor() { this.items = []; }
  add(x, y, text, color = '#e8f1ff', size = 19, life = 1.1) {
    this.items.push({ x, y, text, color, size, life, max: life, vy: -62 });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const t = this.items[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94;
      if (t.life <= 0) this.items.splice(i, 1);
    }
  }
  clear() { this.items.length = 0; }
};

/* ---------------- timing helpers ---------------- */
W.Timer = {
  now: () => performance.now() / 1000
};
W.seedRand = function (seed) {
  let s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  };
};
