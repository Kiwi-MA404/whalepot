/* ============================================================
   倾汤 · 锅盔回声  —  game.js
   ============================================================ */
W.Game = class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.audio = new W.Audio();
    this.input = new W.Input();
    this.cam = new W.Camera();
    this.parts = new W.Particles();
    this.fx = this.parts;                    // 别名：粒子系统
    this.float = new W.FloatText();

    this.state = 'title';     // title | play | dialog | pause | death | fire | end
    this.time = 0;
    this.level = null;
    this.player = null;
    this.boss = null;
    this.projectiles = [];
    this.playerHitboxes = [];
    this.pickups = [];
    this.corrpses = [];
    this.hurtFlash = 0;
    this.echoGlow = 0;
    this.echoActive = 0;
    this.stats = { deaths: 0, kills: 0, echos: 0, soulsTotal: 0 };
    this.deathCorpse = null;
    this.discovered = { rain: false, bone: false, hall: false };
    this.dialogQueue = [];
    this.dialogDone = null;
    this.dialogTyping = null;
    this.fps = 60;
    this.lastT = 0;
    this.pauseT = 0;
    this.endingPhase = 0;
    this.bossArena = false;
    this.toastT = 0;

    this.renderer = new W.Render(this.canvas, this);
    this._bindUI();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /* ---------------- UI ---------------- */
  _bindUI() {
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('hud'), hpFill: $('hpFill'), hpText: $('hpText'), stFill: $('stFill'),
      echoFill: $('echoFill'), soulText: $('soulText'), bossBar: $('bossBar'),
      bossName: $('bossName'), bossFill: $('bossFill'), zoneName: $('zoneName'),
      deathSub: $('deathSub'),
      tips: $('tips'), prompt: $('prompt'), promptText: $('promptText'),
      dialog: $('dialog'), dName: $('dName'), dText: $('dText'),
      title: $('titleScreen'), pause: $('pauseScreen'), death: $('deathScreen'),
      fire: $('fireScreen'), fireTitle: $('fireTitle'), fireStats: $('fireStats'),
      toast: $('toast'), flash: $('flash')
    };
    $('btnStart').onclick = () => {
      this.audio.init(); this.audio.uiConfirm();
      this.clearSave();
      this.startGame();
    };
    $('btnContinue').onclick = () => {
      this.audio.init(); this.audio.uiConfirm();
      this.continueGame();
    };
    $('btnResume').onclick = () => { this.resume(); };
    this._refreshSaveUI();
    document.querySelectorAll('#fireScreen .btn').forEach(b => {
      b.onclick = () => {
        this.audio.uiClick();
        if (b.dataset.act === 'rest') this.restAtFire(); else this.closeFire();
      };
    });
    addEventListener('resize', () => this._resize());
    this._resize();
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = innerWidth, ch = innerHeight;
    const scale = Math.min(cw / 1280, ch / 720);
    this.canvas.style.width = (1280 * scale) + 'px';
    this.canvas.style.height = (720 * scale) + 'px';
    this.canvas.width = 1280 * dpr;
    this.canvas.height = 720 * dpr;
    const c = this.canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
  }

  toast(msg, dur = 2600) {
    const el = this.el.toast;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), dur);
  }

  showZone(name) {
    const el = this.el.zoneName;
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(this._zoneTimer);
    this._zoneTimer = setTimeout(() => el.classList.remove('show'), 3400);
  }

  /* ---------------- 游戏流程 ---------------- */
  startGame() {
    this.level = W.buildLevel();
    this.level.fires.forEach(f => f.lit = true);
    // 敌人配置 -> 实例
    W.ENEMY_TYPES = W.ENEMY_TYPES || {
      drown: { hp: 62, dmg: 14, speed: 62, aggro: 360, souls: 14, w: 30, h: 56, color: '#3f606c', name: '溺行者' },
      leaper: { hp: 44, dmg: 11, speed: 105, aggro: 420, souls: 12, w: 34, h: 34, color: '#2a4854', name: '跃潮者' },
      archer: { hp: 38, dmg: 10, speed: 58, aggro: 560, souls: 16, w: 26, h: 54, color: '#4e6470', name: '射潮者' },
      knight: { hp: 110, dmg: 19, speed: 74, aggro: 400, souls: 26, w: 40, h: 62, color: '#5a534a', name: '汤卫', poise: 3 }
    };
    const ng = this.ngPlus || 0;
    this.level.enemies = this.level.enemies.map(cfg => {
      const base = W.ENEMY_TYPES[cfg.type];
      const t = Object.assign({ type: cfg.type }, base);
      // 二周目起：血量、伤害递增
      if (ng > 0) {
        t.hp = Math.round(base.hp * (1 + 0.55 * ng));
        t.dmg = Math.round(base.dmg * (1 + 0.35 * ng));
        t.souls = Math.round(base.souls * (1 + 0.5 * ng));
      }
      return new W.Enemy(cfg.x, cfg.y, Object.assign(t, { pat: cfg.pat, zone: cfg.zone }));
    });
    this.player = new W.Player(this.level.spawn.x, this.level.spawn.y);
    this.cam.x = this.player.cx - 640;
    this.cam.y = this.player.y - 360;
    this.cam.bounds = { x: 0, y: 0, w: this.level.w, h: this.level.h };
    this.boss = null;
    this.projectiles = [];
    this.playerHitboxes = [];
    this.pickups = this.level.items.map(i => new W.Pickup(i));
    this.corpses = [];
    this.parts.clear(); this.float.clear();
    this.state = 'play';
    this.el.title.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.deathCorpse = null;
    this.discovered = { rain: false, bone: false, hall: false };

    this.audio.drone('ash');
    this.showZone(this.level.zones[0].name);
    this.pushDialog(W.STORY.intro);
  }

  pushDialog(lines, onDone) {
    this.dialogQueue = lines.slice();
    this.dialogDone = onDone || null;
    this.state = 'dialog';
    this._nextDialog();
  }

  _nextDialog() {
    if (this.dialogQueue.length === 0) {
      this.el.dialog.classList.add('hidden');
      this.state = 'play';
      const cb = this.dialogDone; this.dialogDone = null;
      if (cb) cb();
      return;
    }
    const line = this.dialogQueue.shift();
    this.el.dialog.classList.remove('hidden');
    this.el.dName.textContent = line.who || '';
    this._typeText(line.t);
  }

  _typeText(text) {
    const el = this.el.dText;
    el.textContent = '';
    let i = 0;
    clearInterval(this._typeTimer);
    this._typeText_full = text;
    this._typeIdx = 0;
    this._typeTimer = setInterval(() => {
      i += 1;
      this._typeIdx = i;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(this._typeTimer); this._typeIdx = text.length; }
    }, 26);
  }

  advanceDialog() {
    if (this._typeIdx < this._typeText_full.length) {
      clearInterval(this._typeTimer);
      this._typeIdx = this._typeText_full.length;
      this.el.dText.textContent = this._typeText_full;
      return;
    }
    this.audio.uiClick();
    this._nextDialog();
  }

  /* ---------------- 事件回调 ---------------- */
  onEcho(x, y) {
    this.stats.echos++;
    this.echoGlow = 1;
    this._checkEasterEgg(x, y);
    // 揭示
    const R = 760;
    let found = 0;
    for (const e of this.level.enemies) {
      if (!e.alive) continue;
      if (W.dist(x, y, e.cx, e.cy) < R) { e.revealed = 2.4; found++; this.audio.echoReturn(Math.hypot(x - e.cx, y - e.cy)); }
    }
    for (const o of this.level.oneways) {
      if (!o.hidden) continue;
      if (W.dist(x, y, o.x + o.w / 2, o.y) < R) {
        if (!o.revealed) { o.revealed = true; this.toast('某处悬空的东西，被回声点亮了'); }
      }
    }
    for (const it of this.pickups) {
      if (it.taken) continue;
      if (W.dist(x, y, it.x, it.y) < R) { it.revealed = 2.4; found++; }
    }
    for (const n of this.level.npcs) {
      if (W.dist(x, y, n.x, n.y) < R) { this.audio.echoReturn(Math.hypot(x - n.x, y - n.y)); }
    }
    // 回声会惊醒沉睡者
    for (const e of this.level.enemies) {
      if (e.alive && W.dist(x, y, e.cx, e.cy) < R * 0.8) {
        e.alert = 2.2;
        if (e.type === 'archer') e.attackCd = Math.min(e.attackCd, 0.4);
      }
    }
    // 波纹粒子
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.28;
      this.parts.spawn({
        x, y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
        color: 'rgba(150,225,255,0.7)', size: 3, life: .8, max: .8, drag: .9, type: 'dot'
      });
    }
  }

  addSouls(n, x, y) {
    this.player.souls += n;
    this.stats.soulsTotal += n;
    this.float.add(x, y - 24, '+' + n, '#bfe9ff', 20);
    this.audio.soulGain(n);
    for (let i = 0; i < 8; i++) {
      this.parts.spawn({
        x, y, vx: W.rand(80, -80), vy: W.rand(-40, -160), color: '#bfe9ff',
        size: 3, life: .8, max: .8, drag: .94, grav: -60
      });
    }
  }

  onEnemyKilled(e) { this.stats.kills++; }

  onPickup(item) {
    if (item.type === 'soup') {
      this.player.flasks = Math.min(this.player.maxFlasks, this.player.flasks + 1);
      this.player.maxFlasks = Math.max(this.player.maxFlasks, 3);
      this.toast('获得「一口汤」 · 一口汤可以续命');
      this.audio.soulGain(1);
    } else if (item.type === 'key') {
      this.hasKey = true;
      this.toast('获得「锈钥匙 · 汤殿门」');
      this.audio.uiConfirm();
      const gate = this.level.gates.find(g => g.id === 'hallGate');
      if (gate) {
        gate.open = true;
        this.parts.burst(5900, 620, 40, { color: '#d8b070', size: 4, speed: 240, grav: 400, life: 1.2 });
        this.audio.noise(0.8, { filter: 'lowpass', freq: 500, vol: 0.16, pw: 1.2 });
      }
    } else if (item.type === 'shard') {
      const p = this.player;
      this.shards = (this.shards || 0) + 1;
      p.maxSt += 20;
      p.st = p.maxSt;
      p.maxEcho += 15;
      p.echo = p.maxEcho;
      this.audio.potEcho(0.6);
      this.parts.burst(item.x, item.y, 34, { color: '#9fe4ff', size: 4, speed: 220, grav: -90, life: 1.2, drag: .96 });
      this.toast(`回声碎片 ${this.shards}/3 · 体力上限 +20 · 回声上限 +15`);
      this.pushDialog([{ who: '· ' + item.title + ' ·', t: item.text }], () => {
        if (this.shards >= 3) {
          this.player.maxHp += 20;
          this.player.hp = this.player.maxHp;
          this.audio.uiConfirm();
          this.toast('三片合一 —— 锅盔内壁亮了一瞬。生命上限 +20');
        }
      });
    } else if (item.type === 'lore') {
      this.pushDialog([{ who: '· ' + item.title + ' ·', t: item.text }]);
    }
  }

  onPlayerDeath() {
    // 已击败 Boss 的瞬间不再进入死亡流程（避免死亡画面盖住结局）
    if (this.defeatedBoss) return;
    this.stats.deaths++;
    // 掉魂
    const p = this.player;
    if (p.souls > 0) {
      this.deathCorpse = { x: p.cx, y: p.cy, souls: p.souls };
      p.souls = 0;
    }
    this.state = 'death';
    setTimeout(() => {
      if (this.state === 'end') return;   // 结局已开始时不要弹死亡屏
      this.el.death.classList.remove('hidden');
      this.el.deathSub.textContent = this.deathCorpse
        ? '你的魂落在了原地。回去把它捡回来。'
        : '锅还在，人还在。再来一次。';
    }, 1400);
  }

  respawn() {
    const p = this.player;
    // 回到最近的已点亮火堆
    let best = this.level.fires[0];
    for (const f of this.level.fires) {
      if (!f.lit) continue;
      if (Math.abs(f.x - p.x) < Math.abs(best.x - p.x) || !best.lit) best = f;
    }
    // 用"最后坐过的火"
    best = this.lastFire || this.level.fires[0];
    p.reset(best.x + 40, best.y - 70);
    // 敌人复活
    for (const e of this.level.enemies) {
      if (!e.respawn) continue;
      e.alive = true; e.hp = e.maxHp; e.state = 'idle'; e.stateT = 0;
      e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0;
    }
    this.projectiles = [];
    this.boss = null;
    this.bossArena = false;
    this.el.bossBar.classList.add('hidden');
    this.level.gates.forEach(g => { if (g.id === 'hallGate' && !this.hasKey) g.open = false; });
    this.el.death.classList.add('hidden');
    this.state = 'play';
    this.cam.x = p.cx - 640; this.cam.y = p.y - 360;
    this.audio.drone(this.zoneOf(p.x).drone);
    this.toast('从「' + best.name + '」醒来');
  }

  zoneOf(x) {
    for (const z of this.level.zones) if (x >= z.x0 && x < z.x1) return z;
    return this.level.zones[0];
  }

  restAtFire() {
    const p = this.player;
    const f = this.nearFire || this._fireInRange() || this.level.fires[0];
    this.lastFire = f;
    this.restedFireId = f.id;
    p.hp = p.maxHp; p.st = p.maxSt; p.echo = p.maxEcho;
    p.flasks = p.maxFlasks;
    for (const e of this.level.enemies) {
      if (!e.respawn) continue;
      e.alive = true; e.hp = e.maxHp; e.state = 'idle'; e.stateT = 0;
      e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0;
    }
    this.projectiles = [];
    if (!this.bossArena) {
      this.boss = null;
      this.level.gates.forEach(g => { if (g.id === 'hallGate' && !this.hasKey) g.open = false; });
      this.el.bossBar.classList.add('hidden');
    } else {
      // Boss 战重置
      if (this.boss && !this.boss.dead) {
        this.boss.hp = this.boss.maxHp; this.boss.phase = 1;
        this.boss.state = 'idle'; this.boss.aggro = false;
      }
      this.bossArena = false;
    }
    this.audio.fireRest();
    this.parts.burst(f.x, f.y - 20, 26, { color: '#ffc070', size: 3, speed: 160, grav: -120, life: 1.2, drag: .95 });
    this.closeFire();
    this.state = 'play';
    this.toast('坐火 · 已存档 · 敌人重生');
    this.saveGame();
  }

  closeFire() {
    this.el.fire.classList.add('hidden');
    this.state = 'play';
  }

  openFire(f) {
    this.nearFire = f;
    this.state = 'fire';
    this.el.fire.classList.remove('hidden');
    this.el.fireTitle.textContent = f.name;
    this.el.fireStats.innerHTML =
      `累计死亡 <b>${this.stats.deaths}</b> · 击杀 <b>${this.stats.kills}</b> · 敲锅 <b>${this.stats.echos}</b><br>` +
      `持有魂 <b>${this.player.souls}</b> · 汤 x${this.player.flasks}`;
    this.audio.uiClick();
  }

  /* ---------------- Boss ---------------- */
  startBoss() {
    if (this.boss) return;
    this.bossArena = true;
    const b = new W.Boss(this.level.bossSpawn.x, this.level.bossSpawn.y);
    const ng = this.ngPlus || 0;
    if (ng > 0) {
      b.maxHp = Math.round(900 * (1 + 0.45 * ng));
      b.hp = b.maxHp;
    }
    this.boss = b;
    this.el.bossBar.classList.remove('hidden');
    this.el.bossName.textContent = b.name;
    this.audio.drone('boss');
    this.audio.bossRoar();
    this.cam.kick(12);
    this.pushDialog(W.STORY.bossIntro, () => {
      b.aggro = true;
      this.el.bossBar.classList.remove('hidden');
    });
    this.el.bossBar.classList.add('hidden');
  }

  onBossDead() {
    setTimeout(() => {
      this.el.bossBar.classList.add('hidden');
      this.pushDialog(W.STORY.ending, () => this.showEnding());
    }, 2600);
    this.defeatedBoss = true;
  }

  showEnding() {
    this.state = 'end';
    this.el.hud.classList.add('hidden');
    const c = this.el.zoneName;
    this.endingPhase = 1;

    // 用 title 屏做结局菜单
    const t = this.el.title;
    t.classList.remove('hidden');
    const wrap = t.querySelector('.titleWrap');
    wrap.innerHTML = `
      <div class="tKicker">终 章</div>
      <h1 style="font-size:48px;letter-spacing:.2em">锅 盔 回 声</h1>
      <p class="tSub">你听过所有的回声了</p>
      <div class="tDesc">
        死于 <b style="color:#8fd2ff">${this.stats.deaths}</b> 次 · 击杀 <b style="color:#8fd2ff">${this.stats.kills}</b> · 敲锅 <b style="color:#8fd2ff">${this.stats.echos}</b> 次<br>
        <em>回声不会说谎，但会遗忘。</em>
      </div>
      <button id="btnC" class="btn">进入二周目</button>
      <div class="keys"><span>敌人更强 · 属性继承 · 同样的汤</span></div>
    `;
    document.getElementById('btnC').onclick = () => {
      this.el.title.classList.add('hidden');
      this.startNewGamePlus();
    };
  }

  /* ---------------- 二周目 ---------------- */
  startNewGamePlus() {
    this.ngPlus = (this.ngPlus || 0) + 1;
    this.startGame();
    const p = this.player;
    // 继承部分属性，敌人按周目增强
    p.maxHp = 120 + (this.ngPlus - 1) * 20;
    p.hp = p.maxHp;
    p.maxSt = 120;
    p.maxEcho = 115;
    this.toast(`第 ${this.ngPlus + 1} 周目 · 汤又开了`);
    this.showZone(`第 ${this.ngPlus + 1} 周目 · 灰烬滩`);
  }

  _phaseStart() { }

  /* ---------------- pickups / 魂尸体 ---------------- */
  checkCorpse() {
    if (!this.deathCorpse) return;
    const p = this.player;
    if (W.dist(p.cx, p.cy, this.deathCorpse.x, this.deathCorpse.y) < 46) {
      this.addSouls(this.deathCorpse.souls, this.deathCorpse.x, this.deathCorpse.y);
      this.parts.burst(this.deathCorpse.x, this.deathCorpse.y, 30, { color: '#bfe9ff', size: 4, speed: 200, grav: -80, life: 1.2 });
      this.audio.heal();
      this.toast('找回了 ' + this.deathCorpse.souls + ' 魂');
      this.deathCorpse = null;
    }
  }

  /* ---------------- 主循环 ---------------- */
  _loop(now) {
    requestAnimationFrame(this._loop);
    const t = now / 1000;
    let dt = this.lastT ? t - this.lastT : 0.016;
    this.lastT = t;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) dt = 1 / 60;

    this.input.update(dt);
    this._handleGlobalKeys();

    if (this.state === 'play' || this.state === 'dialog') {
      // 对话时不推进世界
      if (this.state === 'play') this._updateWorld(dt);
      else { this.parts.update(dt); this.float.update(dt); this.cam.follow(this.player, dt); }
    } else if (this.state === 'fire' || this.state === 'pause') {
      this.parts.update(dt * 0.2);
    } else if (this.state === 'death') {
      this.player.update(dt, this);
      this.parts.update(dt);
      this.cam.follow(this.player, dt);
    }

    if (this.level && this.player) this.renderer.draw(dt);
    this._updateHUD();
    this.input.endFrame();
  }

  _handleGlobalKeys() {
    const In = this.input;
    if (this.state === 'title') {
      if (In.pressed('interact') || In.pressed('jump')) document.getElementById('btnStart').click();
      return;
    }
    if (In.pressed('pause') && (this.state === 'play' || this.state === 'pause')) {
      if (this.state === 'pause') this.resume(); else this.pauseGame();
    }
    if (this.state === 'dialog' && (In.pressed('interact') || In.pressed('jump'))) {
      this.advanceDialog();
    }
    if (this.state === 'death' && In.pressed('interact')) {
      this.respawn();
    }
    // 坐火：R 键，或站在火堆旁按 E（与提示框一致）
    if (this.state === 'play' && (In.pressed('rest') || In.pressed('interact'))) {
      const f = this.nearFire || this._fireInRange();
      if (f) this.openFire(f);
    }
  }

  _fireInRange() {
    const p = this.player;
    for (const f of this.level.fires) {
      if (W.dist(p.cx, p.cy, f.x, f.y - 30) < 150) return f;
    }
    return null;
  }

  pauseGame() {
    this.state = 'pause';
    this.el.pause.classList.remove('hidden');
  }
  resume() {
    this.el.pause.classList.add('hidden');
    this.el.fire.classList.add('hidden');
    this.state = 'play';
  }

  _updateWorld(dt) {
    const G = this, L = this.level, p = this.player, In = this.input;
    this.time += dt;
    this.echoGlow = Math.max(0, this.echoGlow - dt * 1.4);

    // 彩蛋：连续敲锅计时，间隔超过 2.5 秒就重新计数
    if (this._eggTaps > 0) {
      this._eggTapT = (this._eggTapT || 0) + dt;
      if (this._eggTapT > 2.5) this._eggTaps = 0;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    this.echoActive = Math.max(0, this.echoActive - dt);

    p.update(dt, G);

    // 相机前瞻
    const look = W.clamp(p.vx * 0.28, -160, 160);
    this.cam.follow(p, dt, look);

    // 敌人
    for (const e of L.enemies) {
      if (Math.abs(e.cx - p.cx) > 1800) continue;
      e.update(dt, G);
    }

    // boss
    if (this.boss) {
      this.boss.update(dt, G);
      if (this.boss.dead) {
        this.el.bossBar.classList.add('hidden');
      }
    }

    // 弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.update(dt, G);
      if (pr.dead) this.projectiles.splice(i, 1);
    }

    // 玩家攻击判定
    for (let i = this.playerHitboxes.length - 1; i >= 0; i--) {
      const hb = this.playerHitboxes[i];
      hb.life -= dt;
      if (hb.life <= 0) { this.playerHitboxes.splice(i, 1); continue; }
      const dmg = hb.heavy ? 34 : (p.combo === 2 ? 22 : 16);
      for (const e of L.enemies) {
        if (!e.alive || hb.hitSet.has(e)) continue;
        if (W.rectsOverlap(hb, e.box)) {
          hb.hitSet.add(e);
          e.takeDamage(dmg, p.face, G, hb.heavy);
          p.hitstop = hb.heavy ? 0.07 : 0.045;
          // 命中回魂
          this.addSoulsSilent(2);
        }
      }
      if (this.boss && !this.boss.dead && !hb.hitSet.has('boss')) {
        if (W.rectsOverlap(hb, this.boss.box)) {
          hb.hitSet.add('boss');
          this.boss.takeDamage(hb.heavy ? 42 : (p.combo === 2 ? 28 : 21), p.face, G, hb.heavy);
          p.hitstop = hb.heavy ? 0.08 : 0.05;
          this.addSoulsSilent(3);
        }
      }
    }

    // 拾取
    for (const it of this.pickups) it.update(dt, G);
    this.checkCorpse();

    // 触发器
    for (const tr of L.triggers) {
      if (tr.once && tr.done) continue;
      if (W.rectsOverlap({ x: tr.x, y: tr.y, w: tr.w, h: tr.h }, p.box)) {
        tr.done = true;
        this._onTrigger(tr.id);
      }
    }

    // 交互提示
    this._updatePrompt();

    // 粒子
    this.parts.update(dt);
    this.float.update(dt);

    // 区域音乐
    const z = this.zoneOf(p.x);
    if (!this.bossArena) this.audio.drone(z.drone);

    // 死亡检查
    if (p.dead && this.state === 'play') this.state = 'deadwait';
  }

  addSoulsSilent(n) {
    this.player.souls += n; this.stats.soulsTotal += n;
  }

  _onTrigger(id) {
    if (id === 'bossArena') { this.startBoss(); return; }
    const zmap = { zoneRain: 'rain', zoneBone: 'bone', zoneHall: 'hall' };
    const zid = zmap[id];
    if (zid && !this.discovered[zid]) {
      this.discovered[zid] = true;
      const z = this.level.zones.find(q => q.id === zid);
      this.showZone(z.name);
      this.audio.zoneRise();
      this.audio.drone(z.drone);
    }
  }

  _updatePrompt() {
    const p = this.player;
    let text = null;
    const R = 92;
    // 火堆
    for (const f of this.level.fires) {
      if (W.dist(p.cx, p.cy, f.x, f.y - 30) < 150) { text = '坐火 · ' + f.name; this.nearFire = f; break; }
    }
    if (!text) this.nearFire = null;
    // NPC
    if (!text) for (const n of this.level.npcs) {
      if (W.dist(p.cx, p.cy, n.x, n.y - n.h / 2) < 100) {
        text = '交谈 · ' + n.name;
        if (this.input.pressed('interact')) {
          this.audio.whisper();
          this.pushDialog(n.lines, null);
          return;
        }
        break;
      }
    }
    // 物品
    if (!text) for (const it of this.pickups) {
      if (it.taken) continue;
      if (W.dist(p.cx, p.cy, it.x + 11, it.y + 11) < 60) { text = '拾取'; break; }
    }

    if (text) {
      this.el.prompt.classList.remove('hidden');
      this.el.promptText.textContent = text;
    } else {
      this.el.prompt.classList.add('hidden');
    }
  }

  _updateHUD() {
    if (!this.player) return;
    const p = this.player;
    this.el.hpFill.style.transform = `scaleX(${W.clamp(p.hp / p.maxHp, 0, 1)})`;
    this.el.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.el.stFill.style.transform = `scaleX(${W.clamp(p.st / p.maxSt, 0, 1)})`;
    this.el.echoFill.style.transform = `scaleX(${W.clamp(p.echo / p.maxEcho, 0, 1)})`;
    this.el.soulText.textContent = p.souls;
    if (this.boss && !this.boss.dead) {
      this.el.bossBar.classList.remove('hidden');
      this.el.bossFill.style.transform = `scaleX(${W.clamp(this.boss.hp / this.boss.maxHp, 0, 1)})`;
    } else if (!this.boss) {
      this.el.bossBar.classList.add('hidden');
    }
  }

  shakeWorld(t) { this.cam.kick(6); }
};
W.Boss.prototype.windupTime = 0.5;
W.Boss.prototype.recoverTime = 0.6;

/* ---------------- boot ---------------- */
addEventListener('DOMContentLoaded', () => {
  window.GAME = new W.Game();
});

/* Boss 复用敌人的碰撞体移动逻辑（Boss 继承 Body，未定义 _move） */
W.Boss.prototype._move = W.Enemy.prototype._move;

/* ============================================================
   存档 / 读档（localStorage）
   存档点 = 坐过的火堆。刷新页面后可继续。
   ============================================================ */
W.Game.prototype.SAVE_KEY = 'whalepot_save_v1';

W.Game.prototype.saveGame = function () {
  try {
    const p = this.player;
    const data = {
      v: 1,
      fireId: this.restedFireId || (this.level.fires[0] && this.level.fires[0].id),
      souls: p.souls,
      maxHp: p.maxHp,
      maxFlasks: p.maxFlasks,
      hasKey: !!this.hasKey,
      defeatedBoss: !!this.defeatedBoss,
      deathCorpse: this.deathCorpse || null,
      revealedGhosts: this.level.oneways
        .map((o, i) => (o.hidden && o.revealed) ? i : -1)
        .filter(i => i >= 0),
      picked: this.pickups.filter(x => x.taken).map(x => x.item.id),
      stats: this.stats,
      discovered: this.discovered,
      time: Date.now()
    };
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
    this.hasSave = true;
  } catch (e) { /* 隐私模式等情况下静默失败 */ }
};

W.Game.prototype.loadSave = function () {
  try {
    const raw = localStorage.getItem(this.SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
};

W.Game.prototype.clearSave = function () {
  try { localStorage.removeItem(this.SAVE_KEY); } catch (e) { }
  this.hasSave = false;
};

/* 从存档继续 */
W.Game.prototype.continueGame = function () {
  const d = this.loadSave();
  this.startGame(true);
  if (!d) return;
  const p = this.player;
  const fire = this.level.fires.find(f => f.id === d.fireId) || this.level.fires[0];
  this.restedFireId = fire.id;
  this.lastFire = fire;
  p.reset(fire.x + 46, fire.y - 62);
  p.souls = d.souls || 0;
  p.maxFlasks = d.maxFlasks || 3;
  p.flasks = p.maxFlasks;
  this.hasKey = !!d.hasKey;
  if (this.hasKey) {
    const gate = this.level.gates.find(g => g.id === 'hallGate');
    if (gate) gate.open = true;
  }
  this.deathCorpse = d.deathCorpse || null;
  this.stats = Object.assign(this.stats, d.stats || {});
  this.discovered = Object.assign(this.discovered, d.discovered || {});
  (d.revealedGhosts || []).forEach(i => {
    if (this.level.oneways[i]) this.level.oneways[i].revealed = true;
  });
  (d.picked || []).forEach(id => {
    const pk = this.pickups.find(x => x.item.id === id);
    if (pk) pk.taken = true;
  });
  if (d.defeatedBoss) this.defeatedBoss = true;

  this.cam.x = p.cx - 640;
  this.cam.y = p.y - 360;
  this.audio.drone(this.zoneOf(p.x).drone);
  const z = this.zoneOf(p.x);
  this.showZone(z.name);
  this.toast('从「' + fire.name + '」继续');
  this.saveGame();
};

/* 刷新标题页的存档提示 */
W.Game.prototype._refreshSaveUI = function () {
  const btn = document.getElementById('btnContinue');
  const info = document.getElementById('saveInfo');
  if (!btn || !info) return;
  const d = this.loadSave();
  if (!d) {
    btn.classList.add('hidden');
    info.classList.add('hidden');
    return;
  }
  const L = W.buildLevel();
  const fire = L.fires.find(f => f.id === d.fireId);
  const name = fire ? fire.name : '灰烬滩';
  btn.classList.remove('hidden');
  info.classList.remove('hidden');
  info.innerHTML = `存档：<b>${name}</b> · 魂 <b>${d.souls || 0}</b> · 死亡 <b>${(d.stats && d.stats.deaths) || 0}</b>`;
};

/* 清档：重新开始 */
W.Game.prototype.newGame = function () {
  this.clearSave();
  this.startGame();
};

/* ============================================================
   隐藏彩蛋：对着汤主敲锅
   ------------------------------------------------------------
   条件：Boss 战中，离 Boss 足够近，且连续敲锅 3 次（中间不能断太久）
   结果：Boss 被秒杀，进入独立于最终结局的隐藏结局「一记回声」
   ============================================================ */
W.Game.prototype._checkEasterEgg = function (x, y) {
  if (this.easterDone) return;
  const b = this.boss;
  if (!b || b.dead || !this.bossArena) return;

  const dist = W.dist(x, y, b.cx, b.cy);
  const NEAR = 260;

  if (dist > NEAR) {
    // 离得远就重置计数：必须在它面前敲
    this._eggTaps = 0;
    return;
  }

  this._eggTaps = (this._eggTaps || 0) + 1;
  this._eggTapT = 0;

  if (this._eggTaps === 1) {
    this.toast('回声在汤主身上……空了一下');
    this.audio.tone(220, 1.2, { type: 'sine', vol: 0.06, reverb: 0.9, attack: 0.05 });
  } else if (this._eggTaps === 2) {
    this.toast('再听一次。它没有回声。');
    this.audio.tone(196, 1.4, { type: 'sine', vol: 0.07, reverb: 0.95, attack: 0.05 });
    this.fx.burst(b.cx, b.cy, 20, { color: '#9fd8ff', size: 3, speed: 120, grav: -30, life: 1.2, drag: .95 });
  } else if (this._eggTaps >= 3) {
    this.triggerEasterEgg();
  }
};

W.Game.prototype.triggerEasterEgg = function () {
  if (this.easterDone) return;
  this.easterDone = true;
  this._eggTaps = 0;

  const b = this.boss;
  if (!b || b.dead) return;

  // 无敌 + 清场，防止过场中被打断
  this.player.invuln = 999;
  this.player.godMode = true;
  this.projectiles = [];
  b.aggro = false;

  // 视觉效果：整屏回声爆发
  this.echoGlow = 1.4;
  this.cam.kick(24);
  this.audio.potEcho(1);
  this.audio.droneOff();
  this.fx.burst(b.cx, b.cy, 90, { color: '#bfe9ff', size: 5, speed: 420, grav: -40, life: 2.2, drag: .97 });
  this.fx.burst(b.cx, b.cy, 50, { color: '#ffffff', size: 3, speed: 220, grav: -20, life: 1.8, drag: .98 });
  this.hurtFlash = 0.6;

  // 让 Boss 血量归零但走独立流程
  b.hp = 0;
  b.dead = true;
  b.deadT = 0;
  b.vy = -120;
  this.el.bossBar.classList.add('hidden');

  this.pushDialog(W.STORY.easterHint, () => {
    // 剧震
    this.cam.kick(20);
    this.audio.bossRoar();
    this.fx.burst(b.cx, b.cy, 120, { color: '#e0f4ff', size: 6, speed: 520, grav: 60, life: 2.6, drag: .96 });
    this.pushDialog(W.STORY.easterKill, () => {
      this.pushDialog(W.STORY.easterAfter, () => this.showEasterEnding());
    });
  });
};

W.Game.prototype.showEasterEnding = function () {
  this.state = 'end';
  this.defeatedBoss = true;
  this.el.hud.classList.add('hidden');
  this.el.dialog.classList.add('hidden');
  this.el.bossBar.classList.add('hidden');
  this.el.death.classList.add('hidden');

  const t = this.el.title;
  t.classList.remove('hidden');
  const wrap = t.querySelector('.titleWrap');
  wrap.innerHTML = `
    <div class="tKicker">隐 藏 结 局</div>
    <h1 style="font-size:44px;letter-spacing:.22em;color:#cfeaff">一 记 回 声</h1>
    <p class="tSub">你敲了它。它回了一声。</p>
    <div class="tDesc">
      死于 <b style="color:#8fd2ff">${this.stats.deaths}</b> 次 ·
      击杀 <b style="color:#8fd2ff">${this.stats.kills}</b> ·
      敲锅 <b style="color:#8fd2ff">${this.stats.echos}</b> 次<br>
      <em>回声不会说谎，但会遗忘。<br>而这一次，是谁忘了谁？</em>
    </div>
    <div class="btnRow">
      <button id="btnC" class="btn">再走一遍</button>
      <button id="btnFromEgg" class="btn ghost">回去打完这一场</button>
    </div>
    <div class="keys"><span>你发现了这口锅真正的用法</span></div>
  `;
  document.getElementById('btnC').onclick = () => {
    t.classList.add('hidden');
    this.startNewGamePlus();
  };
  document.getElementById('btnFromEgg').onclick = () => {
    t.classList.add('hidden');
    this.rewindBossFight();
  };
  this.audio.zoneRise();
};

/* 从彩蛋结局退回去，重打 Boss（不计入通关） */
W.Game.prototype.rewindBossFight = function () {
  this.easterDone = false;
  this.defeatedBoss = false;
  this.state = 'play';
  this.el.hud.classList.remove('hidden');
  this.player.godMode = false;
  this.player.invuln = 1.5;
  this.bossArena = false;
  this.boss = null;
  this.el.bossBar.classList.add('hidden');

  // 关键：重置 Boss 竞技场触发器，否则 tr.done 仍为 true，走进去也不会再次开战
  const trg = (this.level.triggers || []).find(t => t.id === 'bossArena');
  if (trg) trg.done = false;

  const p = this.player;
  p.x = 6100; p.y = 700;
  p.vx = 0; p.vy = 0;
  p.hp = p.maxHp; p.st = p.maxSt; p.echo = p.maxEcho;
  this.cam.x = p.cx - 640;
  this.cam.y = p.y - 360;
  this.audio.drone('hall');
  this.toast('回声退潮了。往右走，汤主还在里面等着。');
};
