/* ============================================================
   倾汤 · 锅盔回声  —  entities.js
   ============================================================ */
W.GRAV = 2250;

/* ---------------- 物理体基类 ---------------- */
W.Body = class Body {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.onWall = 0;
    this.face = 1;
    this.dead = false;
    this.groundedLast = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  get box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
};

/* ---------------- 玩家 ---------------- */
W.Player = class Player extends W.Body {
  constructor(x, y) {
    super(x, y, 34, 58);
    this.maxHp = 100; this.hp = 100;
    this.maxSt = 100; this.st = 100;
    this.maxEcho = 100; this.echo = 100;
    this.souls = 0;
    this.flasks = 3; this.maxFlasks = 3;
    this.state = 'idle';      // idle run jump fall attack heavy roll hurt dead echo
    this.stateT = 0;
    this.invuln = 0;
    this.attackT = 0;
    this.attackDone = false;
    this.combo = 0;
    this.comboWindow = 0;
    this.rollCd = 0;
    this.echoCd = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpsLeft = 1;
    this.healT = 0;
    this.hitstop = 0;
    this.landT = 0;
    this.stepT = 0;
    this.deadT = 0;
    this.echoRings = [];
    this.attackBox = null;
    this.lastSafe = { x, y };
    this.speed = 320;
    this.soulsLost = 0;
    this.atFire = null;
    this.lantern = 0;
  }

  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hp = this.maxHp; this.st = this.maxSt; this.echo = this.maxEcho;
    this.flasks = this.maxFlasks;
    this.state = 'idle'; this.stateT = 0; this.invuln = 0; this.dead = false;
    this.rollCd = 0; this.echoCd = 0; this.healT = 0; this.hitstop = 0;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  get invincible() { return this.invuln > 0 || this.state === 'roll' && this.stateT > 0.03 && this.stateT < 0.3; }

  update(dt, G) {
    const In = G.input;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.echoCd = Math.max(0, this.echoCd - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.landT = Math.max(0, this.landT - dt);
    if (this.hitstop > 0) return;

    if (this.dead) { this.deadT += dt; this.vy += W.GRAV * dt; this._move(dt, G); return; }

    // 体力恢复
    const resting = this.state === 'idle' || this.state === 'run';
    this.st = W.clamp(this.st + (resting ? 46 : 16) * dt, 0, this.maxSt);

    // 回声充能
    this.echo = W.clamp(this.echo + (resting ? 26 : 9) * dt, 0, this.maxEcho);

    const ax = In.axis();

    /* ---- 状态机 ---- */
    switch (this.state) {
      case 'roll':
        if (this.stateT > 0.42) this.setState('idle');
        break;
      case 'attack':
      case 'heavy': {
        const dur = this.state === 'attack' ? 0.34 : 0.62;
        if (this.attackT === 0 && this.stateT > (this.state === 'attack' ? 0.075 : 0.2)) {
          this.attackT = 1;
          this._spawnHitbox(G);
        }
        if (this.stateT > dur) { this.setState('idle'); this.attackT = 0; }
        break;
      }
      case 'echo':
        if (this.stateT > 0.52) this.setState('idle');
        break;
      case 'hurt':
        if (this.stateT > 0.38) this.setState('idle');
        break;
      case 'heal':
        if (this.healT > 0) {
          this.healT -= dt;
          if (this.healT <= 0) {
            this.hp = Math.min(this.maxHp, this.hp + 55);
            G.audio.heal();
            G.fx.burst(this.cx, this.cy, 26, { color: '#9be8d0', size: 4, speed: 130, lift: 60, grav: -200, life: .9 });
            this.setState('idle');
          }
        }
        break;
    }

    /* ---- 翻滚 ---- */
    if (In.pressed('roll') && this.rollCd <= 0 && this.st >= 22 && this.state !== 'roll' && this.state !== 'hurt') {
      this.setState('roll');
      this.st -= 22; this.rollCd = 0.6;
      const dir = ax !== 0 ? ax : this.face;
      this.face = dir;
      this.vx = dir * 620;
      this.invuln = 0.34;
      G.audio.roll();
      G.fx.burst(this.cx, this.bottom - 6, 10, { color: '#7d8b96', size: 3, speed: 90, grav: -40, life: .4 });
    }

    /* ---- 攻击 ---- */
    const canAct = this.state === 'idle' || this.state === 'run' || this.state === 'jump' || this.state === 'fall';
    if (canAct) {
      if (In.pressed('attack') && this.st >= 12) {
        this.setState('attack'); this.attackT = 0; this.vx *= 0.3;
        this.st -= 12;
        this.combo = this.comboWindow > 0 ? (this.combo + 1) % 3 : 0;
        this.comboWindow = 0.55;
        G.audio.swing(false);
      } else if (In.pressed('heavy') && this.st >= 28) {
        this.setState('heavy'); this.attackT = 0; this.vx *= 0.15;
        this.st -= 28;
        G.audio.swing(true);
      } else if (In.pressed('echo') && this.echo >= 30 && this.echoCd <= 0) {
        this._doEcho(G);
      } else if (In.pressed('heal') && this.flasks > 0 && this.onGround) {
        this.flasks--; this.setState('heal'); this.healT = 0.55; this.vx = 0;
        G.audio.whisper();
      }
    }

    /* ---- 移动 ---- */
    let targetVx = 0;
    if (this.state === 'run' || canAct) {
      targetVx = ax * this.speed;
      if (ax !== 0) this.face = ax;
    }
    if (this.state === 'roll') {
      this.vx = W.approach(this.vx, this.face * 200, 1600 * dt);
    } else if (this.state === 'hurt') {
      this.vx = W.approach(this.vx, 0, 900 * dt);
    } else {
      const accel = this.onGround ? 3000 : 1900;
      this.vx = W.approach(this.vx, targetVx, accel * dt);
    }
    if ((this.state === 'idle' || this.state === 'run') && this.onGround) {
      this.setState(Math.abs(this.vx) > 24 ? 'run' : 'idle');
      if (Math.abs(this.vx) > 40) {
        this.stepT -= dt * Math.abs(this.vx) / 320;
        if (this.stepT <= 0) { this.stepT = 0.34; G.audio.step(false); }
      }
    }

    /* ---- 跳跃 ---- */
    this.coyote = this.onGround ? 0.11 : Math.max(0, this.coyote - dt);
    if (In.buffered('jump') && (this.coyote > 0 || this.jumpsLeft > 0) && this.state !== 'hurt' && this.state !== 'roll') {
      In.useBuffer('jump');
      const air = this.coyote <= 0;
      if (air) this.jumpsLeft--;
      this.vy = -770; this.onGround = false; this.coyote = 0;
      this.setState('jump');
      this.jumpsLeft = Math.min(this.jumpsLeft, 1);
      G.audio.jump();
      G.fx.burst(this.cx, this.bottom - 4, 8, { color: '#6b7b88', size: 3, speed: 100, grav: 200, life: .35 });
    }
    if (!In.held('jump') && this.vy < -260) this.vy += 2100 * dt;

    if (this.onGround) this.jumpsLeft = 1;
    if (!this.onGround && this.vy > 120 && this.state !== 'attack' && this.state !== 'heavy') this.setState('fall');

    /* ---- 重力 ---- */
    if (this.state !== 'roll' || !this.onGround) this.vy = Math.min(this.vy + W.GRAV * dt, 1500);

    const wasOnGround = this.onGround;
    this._move(dt, G);
    if (!wasOnGround && this.onGround && this.vy > 400) {
      this.landT = 0.16; G.audio.land();
      G.fx.burst(this.cx, this.bottom - 2, 9, { color: '#7a8894', size: 3, speed: 130, grav: 260, life: .4 });
    }
    if (this.onGround && this.state === 'fall') this.setState('idle');

    // 记录安全点
    if (this.onGround && this.state !== 'fall') this.lastSafe = { x: this.x, y: this.y };

    // 回声环更新
    for (let i = this.echoRings.length - 1; i >= 0; i--) {
      const r = this.echoRings[i];
      r.t += dt;
      r.r = W.ease.outCubic(Math.min(1, r.t / 0.85)) * r.max;
      if (r.t > 0.95) this.echoRings.splice(i, 1);
    }
  }

  _move(dt, G) {
    const L = G.level;
    this.onGround = false; this.onWall = 0;
    // X
    this.x += this.vx * dt;
    for (const s of L.solids) {
      if (!W.rectsOverlap(this.box, s)) continue;
      if (this.vx > 0) { this.x = s.x - this.w; this.onWall = 1; }
      else if (this.vx < 0) { this.x = s.x + s.w; this.onWall = -1; }
      this.vx = 0;
    }
    for (const g of (L.gates || [])) {
      if (g.open) continue;
      if (!W.rectsOverlap(this.box, g)) continue;
      if (this.vx > 0) this.x = g.x - this.w; else if (this.vx < 0) this.x = g.x + g.w;
      this.vx = 0;
    }
    // Y
    const prevBottom = this.bottom;
    this.y += this.vy * dt;
    for (const s of L.solids) {
      if (!W.rectsOverlap(this.box, s)) continue;
      if (this.vy > 0) { this.y = s.y - this.h; this.vy = 0; this.onGround = true; }
      else if (this.vy < 0) { this.y = s.y + s.h; this.vy = 0; }
    }
    for (const g of (L.gates || [])) {
      if (g.open) continue;
      if (!W.rectsOverlap(this.box, g)) continue;
      if (this.vy > 0) { this.y = g.y - this.h; this.vy = 0; this.onGround = true; }
      else if (this.vy < 0) { this.y = g.y + g.h; this.vy = 0; }
    }
    // one-way
    for (const o of L.oneways) {
      if (o.hidden && !o.revealed) continue;
      if (!W.rectsOverlap(this.box, o)) continue;
      if (this.vy >= 0 && prevBottom <= o.y + 8 && !G.input.held('down')) {
        this.y = o.y - this.h; this.vy = 0; this.onGround = true;
      }
    }
    this.x = W.clamp(this.x, -100, L.w);
    if (this.y > L.h + 200) { this.hurt(999, 0, G); }
  }

  _doEcho(G) {
    this.setState('echo');
    this.echo -= 30; this.echoCd = 0.3;
    this.echoRings.push({ t: 0, r: 0, max: 780, x: this.cx, y: this.cy });
    this.echoRings.push({ t: -0.12, r: 0, max: 560, x: this.cx, y: this.cy });
    G.audio.potEcho(1);
    G.cam.kick(4);
    G.onEcho(this.cx, this.cy);
  }

  _spawnHitbox(G) {
    const heavy = this.state === 'heavy';
    const reach = heavy ? 96 : 74;
    const hh = heavy ? 74 : 56;
    this.attackBox = {
      x: this.face > 0 ? this.x + this.w - 8 : this.x - reach + 8,
      y: this.cy - hh / 2 + (heavy ? 4 : 0),
      w: reach, h: hh, life: heavy ? 0.16 : 0.1, heavy,
      hitSet: new Set()
    };
    G.playerHitboxes.push(this.attackBox);
    if (heavy) G.cam.kick(5);
  }

  hurt(dmg, dir, G, stagger = true) {
    if (this.dead || this.invincible) return false;
    if (this.godMode) return false;
    if (this.state === 'roll') return false;
    this.hp -= dmg;
    this.invuln = 0.72;
    this.hitstop = 0.06;
    G.cam.kick(9);
    G.audio.hurt();
    G.hurtFlash = 0.4;
    G.fx.burst(this.cx, this.cy, 16, { color: '#c03a44', size: 4, speed: 240, grav: 700, life: .7 });
    G.float.add(this.cx, this.y - 10, '-' + Math.round(dmg), '#ff7b86', 22);
    if (stagger) {
      this.setState('hurt');
      this.vx = (dir || -this.face) * 260; this.vy = -230;
    }
    if (this.hp <= 0) { this.hp = 0; this.die(G); }
    return true;
  }

  die(G) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.setState('dead');
    this.vx = 0;
    G.audio.death();
    G.cam.kick(16);
    G.fx.burst(this.cx, this.cy, 50, { color: '#8fd2ff', size: 5, speed: 300, grav: -90, life: 1.6, drag: .96 });
    G.onPlayerDeath();
  }
};

/* ============================================================
   敌人
   ============================================================ */
W.Enemy = class Enemy extends W.Body {
  constructor(x, y, cfg) {
    super(x, y, cfg.w, cfg.h);
    Object.assign(this, {
      type: cfg.type || 'drown',
      hp: cfg.hp, maxHp: cfg.hp,
      dmg: cfg.dmg,
      speed: cfg.speed,
      aggro: cfg.aggro || 380,
      souls: cfg.souls || 12,
      name: cfg.name || '敌人',
      color: cfg.color || '#8899a0',
      pat: cfg.pat || null,
      patDir: 1,
      state: 'idle', stateT: 0,
      attackCd: 0, flash: 0, hitstop: 0,
      revealed: 0, alert: 0,
      homeX: x, homeY: y,
      respawn: true,
      alive: true,
      face: -1,
      stunT: 0,
      poise: cfg.poise || 0,
      telegraph: 0
    });
    this.zone = cfg.zone;
  }

  update(dt, G) {
    if (!this.alive) return;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.revealed = Math.max(0, this.revealed - dt);
    this.alert = Math.max(0, this.alert - dt);
    this.hitstop = Math.max(0, this.hitstop - dt);
    if (this.stunT > 0) { this.stunT -= dt; dt = 0; }
    if (this.hitstop > 0) { this.vy = Math.min(this.vy + W.GRAV * dt, 1400); this._move(dt, G); return; }

    const p = G.player;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    const dist = Math.hypot(dx, dy);
    const sameRoom = Math.abs(dx) < 1400 && Math.abs(dy) < 700;
    const sees = !p.dead && sameRoom && dist < this.aggro;

    switch (this.type) {
      case 'drown': this._drown(dt, G, p, dx, dist, sees); break;
      case 'leaper': this._leaper(dt, G, p, dx, dist, sees); break;
      case 'archer': this._archer(dt, G, p, dx, dist, sees); break;
      case 'knight': this._knight(dt, G, p, dx, dist, sees); break;
    }

    this.vy = Math.min(this.vy + W.GRAV * dt, 1400);
    this._move(dt, G);
    if (this.y > G.level.h + 200) this.alive = false;
  }

  _move(dt, G) {
    this.onGround = false;
    this.x += this.vx * dt;
    for (const s of G.level.solids) {
      if (!W.rectsOverlap(this.box, s)) continue;
      if (this.vx > 0) this.x = s.x - this.w; else if (this.vx < 0) this.x = s.x + s.w;
      this.vx = 0;
    }
    const prevBottom = this.bottom;
    this.y += this.vy * dt;
    for (const s of G.level.solids) {
      if (!W.rectsOverlap(this.box, s)) continue;
      if (this.vy > 0) { this.y = s.y - this.h; this.vy = 0; this.onGround = true; }
      else if (this.vy < 0) { this.y = s.y + s.h; this.vy = 0; }
    }
    for (const o of G.level.oneways) {
      if (o.hidden && !o.revealed) continue;
      if (!W.rectsOverlap(this.box, o)) continue;
      if (this.vy >= 0 && prevBottom <= o.y + 8) { this.y = o.y - this.h; this.vy = 0; this.onGround = true; }
    }
  }

  _patrol(dt, spd) {
    if (!this.pat) { this.vx = W.approach(this.vx, 0, spd * 3 * dt); return; }
    if (this.x <= this.pat[0]) this.patDir = 1;
    if (this.x + this.w >= this.pat[1]) this.patDir = -1;
    this.vx = this.patDir * spd;
    this.face = this.patDir;
  }

  _chase(dt, p, spd, stopDist = 0) {
    const dx = p.cx - this.cx;
    this.face = dx > 0 ? 1 : -1;
    if (Math.abs(dx) > stopDist) this.vx = this.face * spd;
    else this.vx = W.approach(this.vx, 0, spd * 4 * dt);
  }

  // --- 溺行者：慢，重击，有抬手 ---
  _drown(dt, G, p, dx, dist, sees) {
    if (this.state === 'windup') {
      this.vx = 0;
      if (this.stateT > 0.5) { this.state = 'attack'; this.stateT = 0; }
      return;
    }
    if (this.state === 'attack') {
      this.vx = this.face * 130;
      if (this.stateT > 0.12 && !this.hitDone) {
        this.hitDone = true;
        const hb = { x: this.face > 0 ? this.x + this.w - 4 : this.x - 62, y: this.y + 8, w: 62, h: this.h - 6 };
        if (W.rectsOverlap(hb, p.box)) p.hurt(this.dmg, this.face, G);
      }
      if (this.stateT > 0.42) { this.state = 'recover'; this.stateT = 0; this.hitDone = false; this.attackCd = 0.75; }
      return;
    }
    if (this.state === 'recover') { this.vx = 0; if (this.stateT > 0.45) this.state = 'idle'; return; }

    if (sees && Math.abs(dx) < 90 && this.attackCd <= 0 && Math.abs(this.vy) < 60) {
      this.state = 'windup'; this.stateT = 0;
      this.face = dx > 0 ? 1 : -1;
      G.audio.whisper();
      return;
    }
    if (sees) this._chase(dt, p, this.speed, 40);
    else this._patrol(dt, this.speed * 0.4);
  }

  // --- 跃潮者：跳劈，快，血薄 ---
  _leaper(dt, G, p, dx, dist, sees) {
    if (this.state === 'crouch') {
      this.vx = 0;
      if (this.stateT > 0.34) {
        this.state = 'leap'; this.stateT = 0;
        const dir = dx > 0 ? 1 : -1;
        this.face = dir;
        this.vx = dir * 470; this.vy = -640;
        this.hitDone = false;
        G.audio.roll();
      }
      return;
    }
    if (this.state === 'leap') {
      if (!this.hitDone && W.rectsOverlap(this.box, p.box)) { this.hitDone = true; p.hurt(this.dmg, this.face, G); }
      if (this.onGround && this.stateT > 0.15) {
        this.state = 'recover'; this.stateT = 0;
        this.vx = 0;
        G.fx.burst(this.cx, this.bottom - 2, 12, { color: '#5a7a86', size: 3, speed: 150, grav: 300, life: .5 });
      }
      return;
    }
    if (this.state === 'recover') {
      this.vx = W.approach(this.vx, 0, 1200 * dt);
      if (this.stateT > 0.5) this.state = 'idle';
      return;
    }
    if (sees && dist < 340 && dist > 40 && this.onGround && this.attackCd <= 0) {
      this.state = 'crouch'; this.stateT = 0; this.attackCd = 1.1;
      this.face = dx > 0 ? 1 : -1;
      return;
    }
    if (sees) this._chase(dt, p, this.speed, 70);
    else this._patrol(dt, this.speed * 0.35);
  }

  // --- 射潮者：远程，脆，会后退 ---
  _archer(dt, G, p, dx, dist, sees) {
    if (this.state === 'aim') {
      this.vx = 0;
      if (this.stateT > 0.62) {
        this.state = 'idle'; this.stateT = 0; this.attackCd = 1.5;
        const ang = Math.atan2(p.cy - (this.y + 18), p.cx - this.cx);
        G.projectiles.push(new W.Projectile(this.cx, this.y + 18, Math.cos(ang) * 430, Math.sin(ang) * 430, 'arrow', this.dmg, 1));
        G.audio.noise(0.15, { filter: 'bandpass', freq: 2200, vol: 0.09 });
      }
      return;
    }
    if (sees && this.attackCd <= 0 && dist < 620) {
      if (dist > 120) { this.state = 'aim'; this.stateT = 0; this.face = dx > 0 ? 1 : -1; }
    }
    if (dist < 140) { this.vx = -this.face * this.speed * 1.1; }
    else if (sees) { this._chase(dt, p, this.speed, 260); }
    else this._patrol(dt, this.speed * 0.4);
  }

  // --- 汤卫：举盾，慢但硬，重击可破防 ---
  _knight(dt, G, p, dx, dist, sees) {
    if (this.state === 'windup') {
      this.vx = 0;
      if (this.stateT > 0.62) { this.state = 'attack'; this.stateT = 0; this.hitDone = false; }
      return;
    }
    if (this.state === 'attack') {
      this.vx = this.face * 190;
      if (this.stateT > 0.1 && !this.hitDone) {
        this.hitDone = true;
        const hb = { x: this.face > 0 ? this.x + this.w - 4 : this.x - 78, y: this.y - 6, w: 78, h: this.h + 6 };
        if (W.rectsOverlap(hb, p.box)) p.hurt(this.dmg, this.face, G);
        G.audio.noise(0.12, { filter: 'lowpass', freq: 700, vol: 0.12 });
      }
      if (this.stateT > 0.4) { this.state = 'recover'; this.stateT = 0; this.attackCd = 1.0; }
      return;
    }
    if (this.state === 'recover') { this.vx = W.approach(this.vx, 0, 900 * dt); if (this.stateT > 0.6) this.state = 'idle'; return; }

    if (sees && Math.abs(dx) < 108 && this.attackCd <= 0 && Math.abs(this.vy) < 60) {
      this.state = 'windup'; this.stateT = 0; this.face = dx > 0 ? 1 : -1;
      G.audio.noise(0.3, { filter: 'bandpass', freq: 300, vol: 0.07, attack: 0.1 });
      return;
    }
    if (sees) this._chase(dt, p, this.speed, 50);
    else this._patrol(dt, this.speed * 0.3);
  }

  takeDamage(dmg, dir, G, heavy = false) {
    if (!this.alive) return;
    const shield = this.type === 'knight' && !heavy && this.face !== dir && this.state !== 'attack';
    if (shield) {
      G.audio.noise(0.14, { filter: 'highpass', freq: 1800, vol: 0.14 });
      G.fx.burst(this.cx + this.face * 22, this.cy, 8, { color: '#d8dde0', size: 2.5, speed: 170, life: .4, grav: 400 });
      G.float.add(this.cx, this.y - 8, 'GUARD', '#c8d4dc', 16, .7);
      this.vx = dir * 90;
      return;
    }
    this.hp -= dmg;
    this.flash = 0.18;
    this.hitstop = heavy ? 0.075 : 0.04;
    this.vx = dir * (heavy ? 320 : 150);
    this.revealed = Math.max(this.revealed, 1.4);
    this.stunT = heavy ? 0.24 : 0.09;
    if (this.poise > 0) {
      this.poise -= heavy ? 2 : 1;
      if (this.poise <= 0) { this.stunT = 0.7; this.poise = 1; G.float.add(this.cx, this.y - 20, 'BREAK', '#ffd08a', 20); }
    }
    G.audio.hitLight();
    G.fx.burst(this.cx + dir * 8, this.cy, heavy ? 18 : 10, {
      color: '#c94a52', size: heavy ? 4 : 3, speed: heavy ? 300 : 200, grav: 900, life: .6
    });
    G.float.add(this.cx, this.y - 4, '' + Math.round(dmg), heavy ? '#ffd08a' : '#e9eef2', heavy ? 22 : 18);
    G.fx.burst(this.cx + dir * 8, this.cy, 6, { color: '#bfe9ff', size: 2, speed: 120, life: .3 });
    if (this.hp <= 0) this.die(G);
  }

  die(G) {
    this.alive = false;
    G.audio.noise(0.4, { filter: 'lowpass', freq: 800, slide: 200, vol: 0.18, pw: 1.5 });
    G.fx.burst(this.cx, this.cy, 34, { color: this.color, size: 4, speed: 260, grav: 800, life: 1.1 });
    G.fx.burst(this.cx, this.cy, 14, { color: '#bfe9ff', size: 3, speed: 90, grav: -60, life: 1.4, drag: .96 });
    G.addSouls(this.souls, this.cx, this.cy);
    G.onEnemyKilled(this);
  }
};

/* ---------------- 弹道 ---------------- */
W.Projectile = class Projectile {
  constructor(x, y, vx, vy, kind, dmg, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.kind = kind; this.dmg = dmg; this.owner = owner;
    this.life = 3.2; this.dead = false; this.rot = Math.atan2(vy, vx);
    this.grav = kind === 'arrow' ? 260 : 0;
    this.hitWall = false;
  }
  update(dt, G) {
    this.vy += this.grav * dt;
    this.life -= dt;
    this.rot = Math.atan2(this.vy, this.vx);
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const r = { x: nx - 4, y: ny - 4, w: 8, h: 8 };
    for (const s of G.level.solids) if (W.rectsOverlap(r, s)) { this.dead = true; this._land(G); return; }
    this.x = nx; this.y = ny;
    const p = G.player;
    if (this.owner === 1 && !p.dead && W.rectsOverlap({ x: nx - 6, y: ny - 6, w: 12, h: 12 }, p.box)) {
      if (p.hurt(this.dmg, Math.sign(this.vx) || 1, G)) {
        this.dead = true;
        G.fx.burst(nx, ny, 10, { color: '#c94a52', size: 2, speed: 180, life: .4 });
      }
    }
    if (this.life <= 0) this.dead = true;
  }
  _land(G) {
    G.fx.burst(this.x, this.y, 8, { color: '#9aa7b0', size: 2, speed: 140, grav: 500, life: .45 });
    G.audio.noise(0.1, { filter: 'highpass', freq: 1600, vol: 0.07 });
  }
};

/* ============================================================
   BOSS · 汤主 · 无口
   ============================================================ */
W.Boss = class Boss extends W.Body {
  constructor(x, y) {
    super(x, y, 118, 150);
    this.name = '汤主 · 无口';
    this.hp = 900; this.maxHp = 900;
    this.phase = 1;
    this.state = 'idle'; this.stateT = 0;
    this.attackCd = 1.4;
    this.flash = 0;
    this.aggro = false;
    this.dead = false;
    this.deadT = 0;
    this.face = -1;
    this.enraged = false;
    this.pattern = 0;
    this.hitDone = false;
    this.tele = 0;
    this.waveCd = 0;
    this.sweep = null;
    this.bubbles = 0;
  }

  get active() { return this.hp < this.maxHp || this.aggro; }

  update(dt, G) {
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.waveCd = Math.max(0, this.waveCd - dt);
    this.tele = Math.max(0, this.tele - dt);
    const p = G.player;

    if (this.dead) {
      this.deadT += dt;
      this.vy += W.GRAV * dt; this.y += this.vy * dt;
      if (this.onGround) this.vy = 0;
      return;
    }

    // 阶段
    const hpr = this.hp / this.maxHp;
    if (hpr < 0.5 && this.phase === 1) {
      this.phase = 2;
      G.audio.bossRoar();
      G.cam.kick(20);
      G.toast('汤主 · 无口 —— 汤，沸了');
      G.fx.burst(this.cx, this.cy, 60, { color: '#e07a4a', size: 6, speed: 420, grav: 200, life: 1.6 });
      this.state = 'roar'; this.stateT = 0;
      this.aggro = true;
      G.bossWaveStart && G.bossWaveStart();
      return;
    }
    if (hpr < 0.22 && this.phase === 2) {
      this.phase = 3;
      G.audio.bossRoar();
      G.cam.kick(22);
      G.toast('汤主 · 无口 —— 最后一口');
      this.state = 'roar'; this.stateT = 0;
      G.bossWaveStart && G.bossWaveStart();
      return;
    }

    if (!this.aggro) {
      this.vx = 0;
      this.vy = Math.min(this.vy + W.GRAV * dt, 1400);
      this._move(dt, G);
      return;
    }

    const dx = p.cx - this.cx;
    const dist = Math.abs(dx);
    this.face = dx > 0 ? 1 : -1;

    if (this.state === 'roar') {
      this.vx = 0;
      if (this.stateT > 1.3) { this.state = 'idle'; this.stateT = 0; }
      this._physics(dt, G);
      return;
    }

    if (this.state === 'windup') {
      this.vx = 0;
      if (this.stateT > this.windupTime) { this.state = 'attack'; this.stateT = 0; this.hitDone = false; }
      this._physics(dt, G);
      return;
    }

    if (this.state === 'attack') {
      this._doAttack(dt, G, p, dist);
      this._physics(dt, G);
      return;
    }

    if (this.state === 'recover') {
      this.vx = W.approach(this.vx, 0, 1400 * dt);
      if (this.stateT > this.recoverTime) { this.state = 'idle'; this.stateT = 0; }
      this._physics(dt, G);
      return;
    }

    // idle: 选择招式
    this.vx = W.approach(this.vx, 0, 900 * dt);
    if (dist > 200) this.vx = this.face * (this.phase === 3 ? 130 : 95);
    if (this.attackCd <= 0) {
      this.pattern = (this.pattern + 1 + W.randi(0, 2)) % 5;
      this._chooseAttack(G, p, dist);
    }
    this._physics(dt, G);
  }

  _chooseAttack(G, p, dist) {
    const r = Math.random();
    let pick;
    if (this.phase === 1) {
      pick = dist < 170 ? (r < .55 ? 'sweep' : 'slam') : (r < .6 ? 'charge' : 'bubble');
    } else if (this.phase === 2) {
      pick = r < .3 ? 'sweep' : r < .55 ? 'slam' : r < .78 ? 'charge' : 'bubbleVolley';
    } else {
      pick = r < .34 ? 'slamTriple' : r < .58 ? 'charge' : r < .8 ? 'sweep' : 'bubbleVolley';
    }
    this.attackCd = this.phase === 1 ? 1.25 : this.phase === 2 ? 0.9 : 0.72;
    this.state = 'windup'; this.stateT = 0;
    this.nextAttack = pick;
    this.windupTime = { sweep: .42, slam: .6, slamTriple: .5, charge: .5, bubble: .45, bubbleVolley: .5 }[pick] || .5;
    this.recoverTime = { sweep: .62, slam: .75, slamTriple: .6, charge: .85, bubble: .4, bubbleVolley: .5 }[pick] || .6;
    this.tele = this.windupTime;
    G.audio.noise(0.4, { filter: 'bandpass', freq: pick.startsWith('bubble') ? 900 : 260, vol: 0.1, attack: 0.12 });
  }

  _doAttack(dt, G, p, dist) {
    const t = this.stateT;
    if (!this.hitDone) {
      switch (this.nextAttack) {
        case 'sweep': {
          this.vx = this.face * 420;
          if (t > 0.06) {
            this.hitDone = true;
            const hb = { x: this.face > 0 ? this.x + this.w - 10 : this.x - 150, y: this.y + 10, w: 160, h: this.h - 10 };
            if (W.rectsOverlap(hb, p.box)) p.hurt(this.phase === 3 ? 26 : 21, this.face, G);
            G.audio.noise(0.26, { filter: 'bandpass', freq: 800, slide: 240, vol: 0.16 });
            G.cam.kick(7);
            G.fx.burst(this.cx + this.face * 70, this.cy, 14, { color: '#c98a5a', size: 4, speed: 260, life: .5 });
          }
          break;
        }
        case 'slam': {
          if (t > 0.02) { this.vy = -520; this.vx = this.face * 300; }
          if (t > 0.08) this.hitDone = true;
          this._slamCheck = true;
          break;
        }
        case 'slamTriple': {
          if (t > 0.02) { this.vy = -600; this.vx = this.face * 380; }
          if (t > 0.08) this.hitDone = true;
          this._slamCheck = true;
          break;
        }
        case 'charge': {
          if (t > 0.02 && t < 0.7) { this.vx = this.face * 640; }
          else this.vx = W.approach(this.vx, 0, 1800 * dt);
          if (!this.hitDone && W.rectsOverlap(this.box, p.box)) {
            p.hurt(this.phase === 3 ? 30 : 24, this.face, G, true);
            this.hitDone = true;
          }
          break;
        }
        case 'bubble': {
          this.vx = 0;
          if (t > 0.1) {
            this.hitDone = true;
            this._spawnBubbles(G, 3);
          }
          break;
        }
        case 'bubbleVolley': {
          this.vx = 0;
          if (t > 0.1) {
            this.hitDone = true;
            this._spawnBubbles(G, this.phase === 3 ? 7 : 5);
          }
          break;
        }
      }
    }
    if (this.stateT > (this.nextAttack.startsWith('sweep') ? 0.36 : this.nextAttack === 'charge' ? 0.72 : 0.5)) {
      this.state = 'recover'; this.stateT = 0;
    }
  }

  _spawnBubbles(G, n) {
    const p = G.player;
    for (let i = 0; i < n; i++) {
      const ang = Math.atan2(p.cy - this.cy, p.cx - this.cx) + W.rand(0.5, -0.5);
      const sp = W.rand(400, 300);
      G.projectiles.push(new W.Projectile(this.cx, this.cy - 20, Math.cos(ang) * sp, Math.sin(ang) * sp, 'bubble', 15, 1));
    }
    G.audio.noise(0.3, { filter: 'bandpass', freq: 700, vol: 0.12 });
  }

  _physics(dt, G) {
    this.vy = Math.min(this.vy + W.GRAV * dt, 1500);
    const wasOnGround = this.onGround;
    this._move(dt, G);
    if (this._slamCheck && !wasOnGround && this.onGround) {
      this._slamCheck = false;
      this._slamImpact(G);
    }
    this._unstick(dt, G);
  }

  /* 脱困保险：Boss 体型大，任何台阶都可能让它卡死。
     若 2 秒内几乎没有位移且玩家不在身边，直接把它挪到玩家侧边。 */
  _unstick(dt, G) {
    if (this.dead || !this.aggro) return;
    const p = G.player;
    if (!p) return;
    const moved = Math.abs(this.x - (this._lastX === undefined ? this.x : this._lastX));
    this._lastX = this.x;
    if (moved < 0.6) {
      this._stuckT = (this._stuckT || 0) + dt;
    } else {
      this._stuckT = 0;
    }
    if (this._stuckT > 2.0) {
      this._stuckT = 0;
      const dir = p.cx < this.cx ? -1 : 1;
      const targetX = W.clamp(p.cx + dir * 150 - this.w / 2, 5950, 7300);
      this.x = targetX;
      this.y = 500;
      this.vy = 0;
      this.vx = 0;
      this.state = 'recover';
      this.stateT = 0;
      G.toast('汤主 · 无口 沉了下来');
      G.audio.noise(0.5, { filter: 'lowpass', freq: 600, vol: 0.16, attack: 0.05 });
      G.fx.burst(this.cx, this.cy, 26, { color: '#c07a5a', size: 4, speed: 220, grav: 500, life: 1 });
    }
  }

  _slamImpact(G) {
    G.cam.kick(18);
    G.audio.hitHeavy();
    const p = G.player;
    // 冲击波
    for (const dir of [-1, 1]) {
      G.projectiles.push(new W.Projectile(this.cx + dir * 40, this.bottom - 26, dir * 380, -80, 'wave', this.phase === 3 ? 22 : 18, 1));
    }
    G.fx.burst(this.cx, this.bottom - 6, 40, { color: '#b08a62', size: 5, speed: 380, grav: 900, life: 1 });
    G.fx.burst(this.cx, this.bottom - 6, 20, { color: '#ffe0a0', size: 4, speed: 200, grav: 300, life: .7 });
    if (W.rectsOverlap({ x: this.x - 50, y: this.bottom - 50, w: this.w + 100, h: 60 }, p.box)) {
      p.hurt(this.phase === 3 ? 26 : 20, p.cx > this.cx ? 1 : -1, G, true);
    }
    G.shakeWorld && G.shakeWorld(0.35);
  }

  takeDamage(dmg, dir, G, heavy) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.16;
    this.aggro = true;
    G.audio.hitLight();
    G.fx.burst(this.cx + dir * 20, this.cy + W.rand(30, -30), heavy ? 22 : 12, {
      color: '#d9644a', size: heavy ? 5 : 3, speed: heavy ? 340 : 230, grav: 700, life: .7
    });
    G.float.add(this.cx + W.rand(30, -30), this.y + 20, '' + Math.round(dmg), heavy ? '#ffd08a' : '#f0e0d0', heavy ? 24 : 19);
    if (this.hp <= 0) { this.hp = 0; this.die(G); }
  }

  die(G) {
    this.dead = true; this.deadT = 0;
    G.audio.bossRoar();
    G.audio.noise(2.2, { filter: 'lowpass', freq: 900, slide: 90, vol: 0.24, pw: 1.1, attack: 0.05, reverb: 0.9 });
    G.cam.kick(24);
    G.fx.burst(this.cx, this.cy, 90, { color: '#e08a5a', size: 6, speed: 420, grav: 300, life: 2.2, drag: .97 });
    G.fx.burst(this.cx, this.cy, 40, { color: '#9be8ff', size: 4, speed: 180, grav: -40, life: 2.6, drag: .98 });
    G.addSouls(600, this.cx, this.cy);
    G.onBossDead();
  }
};

/* ---------------- 掉落物 ---------------- */
W.Pickup = class Pickup {
  constructor(item) {
    this.item = item;
    this.x = item.x; this.y = item.y;
    this.t = W.rand(6.28);
    this.w = 22; this.h = 22;
    this.taken = false;
    this.revealed = 0;
  }
  update(dt, G) {
    this.t += dt;
    this.revealed = Math.max(0, this.revealed - dt);
    const p = G.player;
    if (!this.taken && !p.dead && W.dist(this.x + 11, this.y + 11, p.cx, p.cy) < 44) {
      G.onPickup(this.item);
      this.taken = true;
    }
  }
};
