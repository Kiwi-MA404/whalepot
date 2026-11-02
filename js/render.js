/* ============================================================
   倾汤 · 锅盔回声  —  render.js
   所有美术均为程序化绘制，无素材依赖（除角色肖像）
   ============================================================ */
W.Render = class Renderer {
  constructor(canvas, G) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.G = G;
    this.time = 0;
    this.stars = [];
    this.ash = [];
    this.rain = [];
    this.drips = [];
    this.portrait = new Image();
    this.portraitLoaded = false;
    this.portrait.src = 'assets/portrait.jpg';
    this.portrait.onload = () => { this.portraitLoaded = true; };

    // 主角精灵（原版角色，抠图 + 放大锐化）
    this.hero = new Image();
    this.heroLoaded = false;
    this.heroError = null;
    this.hero.onload = () => { this.heroLoaded = true; this.heroError = null; };
    this.hero.onerror = (e) => {
      this.heroError = 'hero.png 加载失败';
      console.error('[倾汤] assets/hero.png 加载失败，请确认 assets 目录与 index.html 同级');
    };
    // 优先用内联数据（file:// 下最可靠），缺失时回退到文件
    this.hero.src = (W.HERO_SPRITE || 'assets/hero.png');
    this._seed();
  }

  _seed() {
    const r = W.seedRand(1337);
    for (let i = 0; i < 90; i++) this.stars.push({ x: r() * 1400, y: r() * 500, s: r() * 1.8 + 0.4, a: r() * 0.5 + 0.2, p: r() * 6.28 });
    for (let i = 0; i < 130; i++) this.ash.push({ x: r() * 1400, y: r() * 760, s: r() * 2.4 + 0.6, v: r() * 22 + 8, d: r() * 6.28, w: r() * 26 + 6 });
    for (let i = 0; i < 110; i++) this.rain.push({ x: r() * 1400, y: r() * 760, s: r() * 220 + 380, l: r() * 22 + 10 });
    for (let i = 0; i < 14; i++) this.drips.push({ x: r() * 1400, y: r() * 400, t: r() * 4 });
  }

  get zone() {
    const L = this.G.level;
    const cx = this.G.player ? this.G.player.cx : 0;
    for (const z of L.zones) if (cx >= z.x0 && cx < z.x1) return z;
    return L.zones[0];
  }

  /* =========================================================
     主绘制
     ========================================================= */
  draw(dt) {
    const c = this.ctx, G = this.G, L = G.level, P = G.player;
    this.time += dt;
    const t = this.time;
    const zone = this.zone;
    const camX = G.cam.ox, camY = G.cam.oy;

    // 保留 DPR 缩放：只重置平移/旋转，不抹掉设备像素比
    const dpr = this.G.dpr || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, 1280, 720);
    c.fillStyle = '#04070c';
    c.fillRect(0, 0, 1280, 720);

    /* ---- 天空 ---- */
    const sky = c.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, zone.sky[0]);
    sky.addColorStop(1, zone.sky[1]);
    c.fillStyle = sky;
    c.fillRect(0, 0, 1280, 720);

    this._drawFarBG(c, t, camX, camY, zone);
    this._drawMidBG(c, t, camX, camY, zone);

    c.save();
    c.translate(-camX, -camY);

    this._drawDecor(c, t, camX, camY, zone);
    this._drawSolids(c, t);
    this._drawOneways(c, t);
    this._drawGates(c, t);
    this._drawItems(c, t);
    this._drawFires(c, t);
    this._drawNPCs(c, t);
    this._drawEnemies(c, t);
    this._drawBoss(c, t);
    this._drawProjectiles(c, t);
    this._drawPlayer(c, t);
    this._drawParticles(c);
    this._drawEchoRings(c, t);
    this._drawFloatText(c);

    c.restore();

    this._drawSurfaceFX(c, t, zone, camX, camY);
    this._drawLighting(c, t, camX, camY, zone);
    this._drawEchoOverlay(c, t, camX, camY);
    this._drawVignette(c);
  }

  /* ---------------- 远景 ---------------- */
  _drawFarBG(c, t, camX, camY, zone) {
    const px = camX * 0.12, py = camY * 0.08;
    c.save();
    // 星 / 灰点
    c.globalAlpha = 0.5;
    for (const s of this.stars) {
      const x = ((s.x - px) % 1400 + 1400) % 1400;
      const y = ((s.y - py) % 560 + 560) % 560;
      c.fillStyle = zone.id === 'bone' ? '#c8c0a8' : '#9fc4de';
      c.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * 0.7 + s.p));
      c.fillRect(x, y, s.s, s.s);
    }
    c.restore();

    // 远处巨影：一口倒扣的巨锅
    c.save();
    const ox = 640 - (camX * 0.06) % 2600;
    c.globalAlpha = 0.16;
    c.fillStyle = zone.id === 'hall' ? '#3a1c18' : '#0d1620';
    c.beginPath();
    c.ellipse(ox + 300, 400 - camY * 0.05, 420, 300, 0, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.ellipse(ox + 300, 400 - camY * 0.05, 430, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 远山/柱子剪影
    c.save();
    c.globalAlpha = 0.5;
    const g2 = c.createLinearGradient(0, 300, 0, 720);
    g2.addColorStop(0, 'rgba(6,12,18,0)');
    g2.addColorStop(1, 'rgba(4,8,12,0.95)');
    c.fillStyle = g2;
    const off = camX * 0.18;
    c.beginPath();
    c.moveTo(0, 720);
    for (let i = 0; i <= 12; i++) {
      const x = i * 130 - (off % 1560);
      const h = 300 + Math.sin(i * 1.9) * 90 + Math.sin(i * 0.7) * 60;
      c.lineTo(x, h);
      c.lineTo(x + 65, h - 40 - Math.sin(i * 2.4) * 30);
    }
    c.lineTo(1400, 720);
    c.closePath();
    c.fill();
    c.restore();
  }

  _drawMidBG(c, t, camX, camY, zone) {
    const px = camX * 0.4, py = camY * 0.3;
    c.save();
    c.globalAlpha = 0.75;
    if (zone.id === 'rain') {
      // 廊柱
      for (let i = 0; i < 10; i++) {
        const x = i * 260 - (px % 2600) + 40;
        c.fillStyle = 'rgba(9,20,26,0.9)';
        c.fillRect(x, 120, 54, 620);
        c.fillStyle = 'rgba(20,36,44,0.5)';
        c.fillRect(x, 120, 10, 620);
        c.fillStyle = 'rgba(40,70,80,0.35)';
        c.fillRect(x - 12, 112, 78, 14);
      }
    } else if (zone.id === 'bone') {
      for (let i = 0; i < 9; i++) {
        const x = i * 300 - (px % 2700);
        c.fillStyle = 'rgba(14,12,14,0.85)';
        c.beginPath();
        c.moveTo(x, 740); c.lineTo(x + 40, 740); c.lineTo(x + 26, 260); c.lineTo(x + 14, 260);
        c.closePath(); c.fill();
        // 钟
        c.fillStyle = 'rgba(22,19,16,0.9)';
        c.beginPath();
        c.moveTo(x - 6, 300);
        c.quadraticCurveTo(x + 20, 250, x + 46, 300);
        c.lineTo(x + 52, 340); c.lineTo(x - 12, 340);
        c.closePath(); c.fill();
      }
    } else if (zone.id === 'hall') {
      for (let i = 0; i < 8; i++) {
        const x = i * 340 - (px % 2720);
        c.fillStyle = 'rgba(24,12,12,0.9)';
        c.fillRect(x, 60, 70, 700);
        c.fillStyle = 'rgba(60,26,22,0.55)';
        c.fillRect(x, 60, 16, 700);
      }
      // 悬挂的锅
      for (let i = 0; i < 6; i++) {
        const x = i * 420 - (px % 2520) + 120;
        const sw = Math.sin(t * 0.6 + i) * 0.06;
        c.save();
        c.translate(x, 90);
        c.rotate(sw);
        c.strokeStyle = 'rgba(90,80,70,0.4)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 120); c.stroke();
        c.fillStyle = 'rgba(30,24,22,0.9)';
        c.beginPath(); c.ellipse(0, 140, 46, 30, 0, 0, 6.3); c.fill();
        c.restore();
      }
    } else {
      // 灰烬滩：枯树剪影
      for (let i = 0; i < 11; i++) {
        const x = i * 240 - (px % 2640) + 60;
        c.fillStyle = 'rgba(8,13,17,0.85)';
        c.beginPath();
        c.moveTo(x, 740);
        c.lineTo(x + 12, 740);
        c.quadraticCurveTo(x + 6, 520, x + 20, 440);
        c.lineTo(x + 4, 440);
        c.quadraticCurveTo(x - 8, 540, x - 10, 740);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(10,16,20,0.8)'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x + 8, 520); c.lineTo(x - 30, 470); c.stroke();
        c.beginPath(); c.moveTo(x + 10, 490); c.lineTo(x + 48, 430); c.stroke();
      }
    }
    c.restore();

    // 雾层
    c.save();
    const fg = c.createLinearGradient(0, 380, 0, 720);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(1, zone.fog);
    c.fillStyle = fg;
    c.fillRect(0, 380, 1280, 340);
    c.restore();
  }

  /* ---------------- 地形 ---------------- */
  _drawSolids(c, t) {
    const L = this.G.level;
    const camX = this.G.cam.ox, camY = this.G.cam.oy;
    for (const s of L.solids) {
      if (s.x + s.w < camX - 120 || s.x > camX + 1400) continue;
      if (s.y + s.h < camY - 200 || s.y > camY + 900) continue;
      const g = c.createLinearGradient(0, s.y, 0, s.y + Math.min(s.h, 260));
      if (s.type === 'sand') { g.addColorStop(0, '#3a3830'); g.addColorStop(0.12, '#26241f'); g.addColorStop(1, '#12110f'); }
      else if (s.type === 'bone') { g.addColorStop(0, '#43403a'); g.addColorStop(0.15, '#2b2823'); g.addColorStop(1, '#14120f'); }
      else if (s.type === 'temple') { g.addColorStop(0, '#3d2420'); g.addColorStop(0.15, '#261614'); g.addColorStop(1, '#100a0a'); }
      else if (s.type === 'pillar') { g.addColorStop(0, '#3a201c'); g.addColorStop(1, '#0e0808'); }
      else if (s.type === 'wall') { g.addColorStop(0, '#2e3a42'); g.addColorStop(1, '#0d1319'); }
      else { g.addColorStop(0, '#333a42'); g.addColorStop(0.15, '#20262c'); g.addColorStop(1, '#0b0f13'); }
      c.fillStyle = g;
      c.fillRect(s.x, s.y, s.w, s.h);

      // 顶面高光边
      c.fillStyle = s.type === 'bone' ? 'rgba(190,180,150,0.22)'
        : s.type === 'temple' ? 'rgba(220,140,110,0.24)'
          : 'rgba(150,190,215,0.16)';
      c.fillRect(s.x, s.y, s.w, 2.5);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(s.x, s.y + 2.5, s.w, 5);

      // 边缘暗角
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(s.x, s.y, 3, s.h);
      c.fillRect(s.x + s.w - 3, s.y, 3, s.h);

      // 纹理
      c.save();
      c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip();
      const r = W.seedRand(Math.floor(s.x * 7 + s.y));
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      const n = Math.min(12, Math.floor(s.w / 40) + 3);
      for (let i = 0; i < n; i++) {
        const gx = s.x + r() * s.w, gy = s.y + r() * Math.min(s.h, 300);
        c.beginPath();
        c.moveTo(gx, gy);
        c.lineTo(gx + r() * 30 - 15, gy + r() * 30);
        c.stroke();
      }
      if (s.type === 'bone') {
        c.strokeStyle = 'rgba(170,160,130,0.14)';
        for (let i = 0; i < 4; i++) {
          const gx = s.x + r() * s.w, gy = s.y + r() * Math.min(s.h, 200) + 20;
          c.beginPath(); c.ellipse(gx, gy, 12 + r() * 10, 5, r() * 3, 0, 6.3); c.stroke();
        }
      }
      c.restore();
    }
  }

  _drawOneways(c, t) {
    const L = this.G.level;
    const camX = this.G.cam.ox;
    for (const o of L.oneways) {
      if (o.x + o.w < camX - 100 || o.x > camX + 1400) continue;
      if (o.hidden) {
        if (!o.revealed) {
          // 只有回声中可见
          continue;
        }
        // 幽灵板：发光
        const pulse = 0.6 + 0.4 * Math.sin(t * 6);
        c.save();
        c.globalAlpha = 0.85;
        c.shadowColor = 'rgba(120,220,255,0.9)';
        c.shadowBlur = 24 * pulse;
        c.fillStyle = 'rgba(110,200,255,0.42)';
        c.fillRect(o.x, o.y, o.w, o.h);
        c.fillStyle = 'rgba(200,240,255,0.9)';
        c.fillRect(o.x, o.y, o.w, 2);
        c.restore();
        // 悬浮符文
        c.save();
        c.globalAlpha = 0.4;
        c.strokeStyle = 'rgba(140,215,255,0.7)'; c.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const rx = o.x + (o.w / 5) * (i + .5);
          const dy = Math.sin(t * 1.6 + i) * 4;
          c.beginPath(); c.moveTo(rx - 4, o.y + 14 + dy); c.lineTo(rx, o.y + 20 + dy); c.lineTo(rx + 4, o.y + 14 + dy); c.stroke();
        }
        c.restore();
        continue;
      }
      const g = c.createLinearGradient(0, o.y, 0, o.y + o.h);
      if (o.type === 'wood') { g.addColorStop(0, '#4a3a2a'); g.addColorStop(1, '#1a1410'); }
      else { g.addColorStop(0, '#3a4048'); g.addColorStop(1, '#141a1f'); }
      c.fillStyle = g;
      c.fillRect(o.x, o.y, o.w, o.h);
      c.fillStyle = 'rgba(180,205,225,0.2)';
      c.fillRect(o.x, o.y, o.w, 2);
      if (o.type === 'wood') {
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
        for (let x = o.x + 18; x < o.x + o.w; x += 22) {
          c.beginPath(); c.moveTo(x, o.y + 2); c.lineTo(x, o.y + o.h); c.stroke();
        }
      }
      // 底部吊挂
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(o.x + 4, o.y + o.h, o.w - 8, 5);
    }
  }

  _drawGates(c, t) {
    for (const g of (this.G.level.gates || [])) {
      if (g.open) continue;
      c.save();
      c.fillStyle = 'rgba(24,18,14,0.96)';
      c.fillRect(g.x, g.y, g.w, g.h);
      c.strokeStyle = 'rgba(200,170,110,0.35)'; c.lineWidth = 2;
      c.strokeRect(g.x + 3, g.y + 3, g.w - 6, g.h - 6);
      // 锁
      const lx = g.x + g.w / 2, ly = g.y + 40;
      c.fillStyle = 'rgba(200,170,110,0.5)';
      c.beginPath(); c.arc(lx, ly, 8, 0, 6.3); c.stroke();
      c.font = '16px serif'; c.textAlign = 'center';
      c.fillText('碗', lx, ly + 34);
      // 门的呼吸光
      c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2);
      c.fillStyle = 'rgba(255,190,120,0.25)';
      c.fillRect(g.x - 6, g.y, 4, g.h);
      c.restore();
    }
  }

  /* ---------------- 装饰 ---------------- */
  _drawDecor(c, t, camX, camY, zone) {
    for (const d of this.G.level.decor) {
      if (d.x < camX - 300 || d.x > camX + 1600) continue;
      const x = d.x, y = d.y;
      c.save();
      switch (d.kind) {
        case 'deadTree': {
          c.strokeStyle = 'rgba(28,26,24,0.95)'; c.lineCap = 'round';
          c.lineWidth = 11;
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6, y - 90, x + 6, y - 160); c.stroke();
          c.lineWidth = 5;
          [[0, -100, -46, -150], [4, -130, 44, -178], [2, -80, 40, -96]].forEach(([ax, ay, bx, by]) => {
            c.beginPath(); c.moveTo(x + ax, y + ay); c.lineTo(x + bx, y + by); c.stroke();
          });
          break;
        }
        case 'grave': {
          c.fillStyle = 'rgba(30,32,34,0.95)';
          c.fillRect(x - 14, y - 40, 28, 40);
          c.beginPath(); c.arc(x, y - 40, 14, Math.PI, 0); c.fill();
          c.fillStyle = 'rgba(90,100,110,0.3)';
          c.fillRect(x - 10, y - 34, 20, 2);
          break;
        }
        case 'rock': {
          c.fillStyle = 'rgba(26,28,30,0.95)';
          c.beginPath();
          c.moveTo(x - 34, y); c.lineTo(x - 20, y - 26); c.lineTo(x + 6, y - 34);
          c.lineTo(x + 30, y - 16); c.lineTo(x + 36, y);
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(90,110,125,0.16)';
          c.beginPath(); c.moveTo(x - 20, y - 26); c.lineTo(x + 6, y - 34); c.lineTo(x + 2, y - 20); c.closePath(); c.fill();
          break;
        }
        case 'pipe': {
          c.fillStyle = 'rgba(30,44,50,0.9)';
          c.fillRect(x, y - 120, 16, 320);
          c.fillStyle = 'rgba(60,90,100,0.5)';
          c.fillRect(x, y - 120, 3, 320);
          break;
        }
        case 'bell': {
          c.strokeStyle = 'rgba(60,52,44,0.9)'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(x, y - 300); c.lineTo(x, y - 150); c.stroke();
          const sw = Math.sin(t * 0.7) * 0.02;
          c.translate(x, y - 150); c.rotate(sw);
          const bg = c.createLinearGradient(0, 0, 0, 130);
          bg.addColorStop(0, '#5a5142'); bg.addColorStop(1, '#201d17');
          c.fillStyle = bg;
          c.beginPath();
          c.moveTo(-58, 0); c.quadraticCurveTo(-40, 90, -66, 130);
          c.lineTo(66, 130); c.quadraticCurveTo(40, 90, 58, 0);
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(220,205,170,0.25)';
          c.fillRect(-70, 128, 140, 6);
          break;
        }
        case 'bellSmall': {
          c.strokeStyle = 'rgba(60,52,44,0.8)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(x, y - 200); c.lineTo(x, y - 100); c.stroke();
          c.save(); c.translate(x, y - 100); c.rotate(Math.sin(t * 0.9 + x) * 0.03);
          c.fillStyle = 'rgba(70,62,50,0.95)';
          c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-18, 44, -30, 62); c.lineTo(30, 62);
          c.quadraticCurveTo(18, 44, 26, 0); c.closePath(); c.fill();
          c.restore();
          break;
        }
        case 'bonePile': {
          c.fillStyle = 'rgba(30,28,24,0.9)';
          for (let i = 0; i < 7; i++) {
            const bx = x + Math.cos(i * 2.1) * 26, by = y - 8 - Math.abs(Math.sin(i * 1.7)) * 16;
            c.save(); c.translate(bx, by); c.rotate(i * 1.3);
            c.fillRect(-16, -3, 32, 6);
            c.restore();
          }
          break;
        }
        case 'pot': {
          const pg = c.createLinearGradient(0, y - 170, 0, y);
          pg.addColorStop(0, '#5a5048'); pg.addColorStop(.5, '#3a332e'); pg.addColorStop(1, '#1a1614');
          c.fillStyle = pg;
          c.beginPath();
          c.moveTo(x - 70, y - 150); c.bezierCurveTo(x - 90, y - 40, x - 40, y, x, y);
          c.bezierCurveTo(x + 40, y, x + 90, y - 40, x + 70, y - 150);
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(240,150,90,0.12)';
          c.beginPath(); c.ellipse(x, y - 150, 70, 16, 0, 0, 6.3); c.fill();
          break;
        }
        case 'potSmall': {
          c.fillStyle = '#2a2421';
          c.beginPath(); c.ellipse(x, y - 30, 30, 34, 0, 0, 6.3); c.fill();
          c.fillStyle = 'rgba(240,150,90,0.1)';
          c.beginPath(); c.ellipse(x, y - 56, 30, 8, 0, 0, 6.3); c.fill();
          break;
        }
        case 'ledge': {
          // 纯装饰石檐（不参与碰撞，只是墙上的凸出结构）
          const lg2 = c.createLinearGradient(0, y - 10, 0, y + 10);
          lg2.addColorStop(0, 'rgba(58,32,26,0.55)');
          lg2.addColorStop(1, 'rgba(30,16,13,0.35)');
          c.fillStyle = lg2;
          c.fillRect(x - 55, y - 9, 110, 18);
          c.fillStyle = 'rgba(215,135,105,0.16)';
          c.fillRect(x - 55, y - 9, 110, 1.5);
          // 支撑的托臂
          c.fillStyle = 'rgba(44,24,20,0.5)';
          c.beginPath();
          c.moveTo(x - 20, y + 9); c.lineTo(x, y + 22); c.lineTo(x + 20, y + 9);
          c.closePath(); c.fill();
          break;
        }
      }
      c.restore();
    }
  }

  /* ---------------- 火堆 ---------------- */
  _drawFires(c, t) {
    for (const f of this.G.level.fires) {
      const lit = !f.extinguished;
      const x = f.x, y = f.y;
      c.save();
      // 灶石
      c.fillStyle = '#20201d';
      c.beginPath(); c.ellipse(x, y - 4, 40, 12, 0, 0, 6.3); c.fill();
      c.fillStyle = '#2c2a26';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.28;
        c.beginPath(); c.ellipse(x + Math.cos(a) * 32, y - 4 + Math.sin(a) * 8, 8, 6, a, 0, 6.3); c.fill();
      }
      // 柴
      c.strokeStyle = '#1a1512'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 22, y - 2); c.lineTo(x + 18, y - 14); c.stroke();
      c.beginPath(); c.moveTo(x - 16, y - 16); c.lineTo(x + 22, y - 2); c.stroke();

      if (lit) {
        // 火
        const fl = 0.8 + Math.sin(t * 9 + x) * 0.16 + Math.sin(t * 17.3) * 0.08;
        const grad = c.createRadialGradient(x, y - 30, 2, x, y - 30, 90 * fl);
        grad.addColorStop(0, 'rgba(255,240,200,0.9)');
        grad.addColorStop(0.15, 'rgba(255,180,90,0.6)');
        grad.addColorStop(0.45, 'rgba(220,90,40,0.22)');
        grad.addColorStop(1, 'rgba(180,50,20,0)');
        c.fillStyle = grad;
        c.beginPath(); c.arc(x, y - 30, 90 * fl, 0, 6.3); c.fill();

        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const ph = t * 3.4 + i * 1.3;
          const fx = x + Math.sin(ph) * 10;
          const fh = 30 + Math.sin(ph * 1.7) * 12 + i * 4;
          const fg = c.createLinearGradient(0, y - 8, 0, y - 8 - fh);
          fg.addColorStop(0, 'rgba(255,220,150,0.85)');
          fg.addColorStop(0.5, 'rgba(255,140,60,0.5)');
          fg.addColorStop(1, 'rgba(200,50,20,0)');
          c.fillStyle = fg;
          c.beginPath();
          c.moveTo(fx - 11, y - 8);
          c.quadraticCurveTo(fx - 6, y - 8 - fh * .6, fx + Math.sin(ph * 2) * 4, y - 8 - fh);
          c.quadraticCurveTo(fx + 7, y - 8 - fh * .5, fx + 11, y - 8);
          c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';

        // 火星
        for (let i = 0; i < 3; i++) {
          const lt = (t * 0.8 + i * 0.37) % 1;
          const ex = x + Math.sin(t * 2 + i * 3) * 22 * lt;
          const ey = y - 20 - lt * 120;
          c.globalAlpha = (1 - lt) * 0.8;
          c.fillStyle = '#ffc070';
          c.fillRect(ex, ey, 2, 2);
          c.globalAlpha = 1;
        }
      } else {
        // 熄灭的灶：一缕烟
        c.strokeStyle = 'rgba(120,130,140,0.12)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x, y - 10);
        for (let i = 1; i < 8; i++) {
          c.lineTo(x + Math.sin(t + i * 0.6) * (i * 3), y - 10 - i * 22);
        }
        c.stroke();
      }
      c.restore();
    }
  }

  /* ---------------- NPC ---------------- */
  _drawNPCs(c, t) {
    for (const n of this.G.level.npcs) {
      const x = n.x, y = n.y;
      const bob = Math.sin(t * 1.6 + x) * 2.4;
      c.save();
      c.translate(x, y + n.h + bob);
      // 影子
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath(); c.ellipse(0, 2, n.w * .6, 7, 0, 0, 6.3); c.fill();
      // 身体：斗篷剪影
      const g = c.createLinearGradient(0, -n.h, 0, 0);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(10,14,16,0.95)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-n.w / 2, 0);
      c.quadraticCurveTo(-n.w / 2 - 4, -n.h * .75, 0, -n.h);
      c.quadraticCurveTo(n.w / 2 + 4, -n.h * .75, n.w / 2, 0);
      c.closePath(); c.fill();
      // 兜帽
      c.fillStyle = 'rgba(8,12,14,0.98)';
      c.beginPath(); c.ellipse(0, -n.h * .82, n.w * .34, n.h * .22, 0, 0, 6.3); c.fill();
      // 眼
      const bl = Math.sin(t * 2.2 + x) > 0.93 ? 0.1 : 1;
      c.fillStyle = 'rgba(200,230,255,0.85)';
      c.globalAlpha = 0.8;
      c.fillRect(-7, -n.h * .86, 3, 3 * bl);
      c.fillRect(4, -n.h * .86, 3, 3 * bl);
      c.globalAlpha = 1;
      c.restore();
    }
  }

  /* ---------------- 敌人 ---------------- */
  _drawEnemies(c, t) {
    for (const e of this.G.level.enemies) {
      if (!e.alive) continue;
      const camX = this.G.cam.ox;
      if (e.x < camX - 200 || e.x > camX + 1480) continue;
      const rev = e.revealed > 0;
      c.save();
      c.translate(e.cx, e.y + e.h);
      const f = e.face;
      c.scale(f, 1);
      const flash = e.flash > 0;

      // 影子
      c.save(); c.scale(f, 1);
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.ellipse(0, 2, e.w * .55, 6, 0, 0, 6.3); c.fill();
      c.restore();

      const base = flash ? '#ffffff' : e.color;
      const dark = flash ? '#ffdddd' : 'rgba(8,12,15,0.96)';

      if (e.type === 'drown') {
        // 溺行者：细长，垂手，滴汤
        const g = c.createLinearGradient(0, -e.h, 0, 0);
        g.addColorStop(0, base); g.addColorStop(.6, 'rgba(40,60,68,0.95)'); g.addColorStop(1, 'rgba(6,10,12,1)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-e.w * .3, 0);
        c.quadraticCurveTo(-e.w * .42, -e.h * .5, -e.w * .22, -e.h * .72);
        c.quadraticCurveTo(0, -e.h, e.w * .22, -e.h * .72);
        c.quadraticCurveTo(e.w * .42, -e.h * .5, e.w * .3, 0);
        c.closePath(); c.fill();
        // 头
        c.fillStyle = dark;
        c.beginPath(); c.ellipse(0, -e.h * .82, e.w * .3, e.h * .17, 0, 0, 6.3); c.fill();
        // 眼
        const glow = e.state === 'windup' ? 1 : 0.55;
        c.fillStyle = e.state === 'windup' ? '#ff9a6a' : '#7fd8ff';
        c.globalAlpha = glow;
        c.beginPath(); c.arc(-6, -e.h * .84, 2.6, 0, 6.3); c.fill();
        c.beginPath(); c.arc(7, -e.h * .84, 2.6, 0, 6.3); c.fill();
        c.globalAlpha = 1;
        // 手臂
        c.strokeStyle = 'rgba(30,45,52,1)'; c.lineWidth = 5; c.lineCap = 'round';
        const sw = e.state === 'windup' ? -0.7 : (e.state === 'attack' ? 0.9 : Math.sin(t * 2 + e.x) * .15);
        c.beginPath(); c.moveTo(-e.w * .22, -e.h * .6);
        c.lineTo(-e.w * .22 - 12, -e.h * .6 + Math.cos(sw) * 26); c.stroke();
        c.beginPath(); c.moveTo(e.w * .24, -e.h * .6);
        c.lineTo(e.w * .24 + 14 * (e.state === 'attack' ? 1.9 : 1), -e.h * .6 + Math.sin(sw) * 26); c.stroke();
      } else if (e.type === 'leaper') {
        // 跃潮者：蛙形，蜷缩
        const squat = e.state === 'crouch' ? 1.18 : 1;
        c.fillStyle = flash ? '#fff' : '#2a4854';
        c.beginPath();
        c.ellipse(0, -e.h * .38 * squat, e.w * .48, e.h * .34 * squat, 0, 0, 6.3);
        c.fill();
        // 头
        c.fillStyle = dark;
        c.beginPath(); c.ellipse(e.w * .16, -e.h * .62 * squat, e.w * .26, e.h * .16, 0, 0, 6.3); c.fill();
        // 腿
        c.strokeStyle = '#2a4854'; c.lineWidth = 6; c.lineCap = 'round';
        const lg = e.onGround ? 0 : -0.5;
        c.beginPath(); c.moveTo(-e.w * .3, -e.h * .3); c.lineTo(-e.w * .5, -6 + lg * 10); c.stroke();
        c.beginPath(); c.moveTo(e.w * .3, -e.h * .3); c.lineTo(e.w * .5, -6 + lg * 10); c.stroke();
        // 眼
        c.fillStyle = e.state === 'crouch' ? '#ff7a4a' : '#7fd8ff';
        c.beginPath(); c.arc(e.w * .06, -e.h * .68 * squat, 3, 0, 6.3); c.fill();
        c.beginPath(); c.arc(e.w * .3, -e.h * .64 * squat, 3, 0, 6.3); c.fill();
      } else if (e.type === 'archer') {
        // 射潮者：瘦高，持弓
        const g = c.createLinearGradient(0, -e.h, 0, 0);
        g.addColorStop(0, base); g.addColorStop(1, 'rgba(6,10,14,1)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-e.w * .26, 0); c.lineTo(-e.w * .2, -e.h * .8);
        c.lineTo(e.w * .2, -e.h * .8); c.lineTo(e.w * .26, 0);
        c.closePath(); c.fill();
        c.fillStyle = dark;
        c.beginPath(); c.ellipse(0, -e.h * .88, e.w * .24, e.h * .13, 0, 0, 6.3); c.fill();
        c.fillStyle = e.state === 'aim' ? '#ff9a6a' : '#7fd8ff';
        c.beginPath(); c.arc(6, -e.h * .9, 2.4, 0, 6.3); c.fill();
        // 弓
        c.strokeStyle = 'rgba(120,160,175,0.9)'; c.lineWidth = 2.5;
        c.beginPath();
        const pull = e.state === 'aim' ? 8 : 0;
        c.arc(e.w * .3, -e.h * .55, 22, -1.2, 1.2);
        c.stroke();
        c.strokeStyle = 'rgba(200,220,230,0.5)'; c.lineWidth = 1;
        c.beginPath();
        c.moveTo(e.w * .3 + 8, -e.h * .55 - 20);
        c.lineTo(e.w * .3 - pull, -e.h * .55);
        c.lineTo(e.w * .3 + 8, -e.h * .55 + 20);
        c.stroke();
      } else if (e.type === 'knight') {
        // 汤卫：厚重，大盾
        const g = c.createLinearGradient(0, -e.h, 0, 0);
        g.addColorStop(0, base); g.addColorStop(.7, 'rgba(46,40,34,0.98)'); g.addColorStop(1, 'rgba(8,8,8,1)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-e.w * .38, 0); c.lineTo(-e.w * .42, -e.h * .78);
        c.lineTo(e.w * .38, -e.h * .78); c.lineTo(e.w * .42, 0);
        c.closePath(); c.fill();
        // 盔
        c.fillStyle = dark;
        c.beginPath(); c.ellipse(0, -e.h * .86, e.w * .3, e.h * .13, 0, 0, 6.3); c.fill();
        c.fillStyle = e.state === 'windup' ? '#ff9a6a' : '#c8e0ff';
        c.globalAlpha = .9;
        c.fillRect(-9, -e.h * .88, 16, 3);
        c.globalAlpha = 1;
        // 盾
        c.fillStyle = 'rgba(40,46,50,1)';
        c.beginPath();
        c.moveTo(e.w * .28, -e.h * .74);
        c.lineTo(e.w * .56, -e.h * .6);
        c.lineTo(e.w * .56, -e.h * .1);
        c.lineTo(e.w * .28, -e.h * .04);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(180,190,195,0.4)'; c.lineWidth = 1.5; c.stroke();
        // 剑
        if (e.state === 'windup' || e.state === 'attack') {
          c.strokeStyle = 'rgba(200,210,220,0.85)'; c.lineWidth = 4; c.lineCap = 'round';
          c.beginPath();
          c.moveTo(-e.w * .3, -e.h * .55);
          c.lineTo(-e.w * .3 - 40, e.state === 'attack' ? -e.h * .2 : -e.h * .9);
          c.stroke();
        }
      }

      // 回声中：轮廓强调
      if (rev) {
        c.restore(); c.save();
        c.globalCompositeOperation = 'lighter';
        const a = W.clamp(e.revealed, 0, 1);
        c.strokeStyle = `rgba(140,225,255,${0.55 * a})`;
        c.lineWidth = 2;
        c.shadowColor = 'rgba(120,220,255,0.9)'; c.shadowBlur = 18 * a;
        c.strokeRect(e.x - e.cx + 0, 0, 0, 0);
        c.restore();
        c.save();
        c.translate(e.cx, e.y + e.h);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(120,210,255,${0.16 * a})`;
        c.beginPath(); c.ellipse(0, -e.h * .5, e.w * .62, e.h * .58, 0, 0, 6.3); c.fill();
      }
      c.restore();
    }
  }

  /* ---------------- BOSS ---------------- */
  _drawBoss(c, t) {
    const b = this.G.boss;
    if (!b) return;
    c.save();
    c.translate(b.cx, b.bottom);
    const f = b.face;
    c.scale(f, 1);

    if (!b.dead) {
      // 影
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath(); c.ellipse(0, 3, b.w * .6, 10, 0, 0, 6.3); c.fill();
    }

    const flash = b.flash > 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    const tele = b.tele > 0;
    const main = flash ? '#ffffff' : (b.phase >= 2 ? '#5a2a22' : '#3a2f2a');

    // 身躯：一口人形大锅
    const g = c.createLinearGradient(0, -b.h, 0, 0);
    g.addColorStop(0, main);
    g.addColorStop(.55, flash ? '#ffdddd' : '#241c19');
    g.addColorStop(1, '#0a0808');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-b.w * .34, 0);
    c.bezierCurveTo(-b.w * .58, -b.h * .38, -b.w * .45, -b.h * .8, -b.w * .3, -b.h * .88);
    c.lineTo(b.w * .3, -b.h * .88);
    c.bezierCurveTo(b.w * .45, -b.h * .8, b.w * .58, -b.h * .38, b.w * .34, 0);
    c.closePath(); c.fill();

    // 汤面：胸口发光的液面
    const lg = c.createRadialGradient(0, -b.h * .55, 4, 0, -b.h * .55, b.w * .42);
    const hot = b.phase >= 2;
    lg.addColorStop(0, hot ? 'rgba(255,220,140,0.85)' : 'rgba(255,180,120,0.5)');
    lg.addColorStop(.35, hot ? 'rgba(230,110,50,0.6)' : 'rgba(160,80,50,0.35)');
    lg.addColorStop(1, 'rgba(80,30,20,0)');
    c.fillStyle = lg;
    c.beginPath(); c.ellipse(0, -b.h * .55, b.w * .4, b.h * .3, 0, 0, 6.3); c.fill();
    // 汤里晃动的脸
    c.globalAlpha = 0.25 + 0.15 * pulse;
    c.strokeStyle = '#ffd9a0'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -b.h * .55, b.w * .18 * (0.9 + pulse * .1), t, t + 2.6); c.stroke();
    c.beginPath(); c.arc(0, -b.h * .55, b.w * .13, t * 1.3, t * 1.3 + 1.8); c.stroke();
    c.globalAlpha = 1;

    // 头：无口
    const hx = b.w * .12, hy = -b.h * .96;
    c.fillStyle = flash ? '#fff' : '#2a2320';
    c.beginPath(); c.ellipse(hx, hy, b.w * .28, b.h * .15, 0.1, 0, 6.3); c.fill();
    // 一只眼
    c.fillStyle = tele ? '#ffb070' : (b.phase >= 2 ? '#ff6a50' : '#e8d0b0');
    c.shadowColor = tele ? '#ff8a50' : '#ffb080';
    c.shadowBlur = tele ? 34 : 16;
    c.beginPath(); c.ellipse(hx + 6, hy - 2, 13, 9, 0, 0, 6.3); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#1a0e08';
    c.beginPath(); c.ellipse(hx + 9, hy - 2, 4, 8, 0, 0, 6.3); c.fill();

    // 手臂 + 勺子
    c.save();
    const armA = tele ? -0.9 : (b.state === 'attack' ? 0.5 : 0.1);
    c.translate(b.w * .28, -b.h * .72);
    c.rotate(armA);
    c.strokeStyle = flash ? '#fff' : '#2a2320'; c.lineWidth = 13; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(b.w * .34, 0); c.stroke();
    // 勺
    c.strokeStyle = 'rgba(190,180,160,0.7)'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(b.w * .34, 0); c.lineTo(b.w * .62, -8); c.stroke();
    c.fillStyle = 'rgba(200,190,170,0.55)';
    c.beginPath(); c.ellipse(b.w * .68, -10, 20, 13, -0.2, 0, 6.3); c.fill();
    c.restore();

    // 另一只手垂着
    c.strokeStyle = flash ? '#fff' : '#221c1a'; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-b.w * .3, -b.h * .66);
    c.quadraticCurveTo(-b.w * .52, -b.h * .4, -b.w * .46, -b.h * .18);
    c.stroke();

    // 攻击预警光
    if (tele) {
      const a = 1 - b.tele / Math.max(b.windupTime, .01);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,120,60,${0.14 + a * 0.2})`;
      c.beginPath(); c.ellipse(0, -b.h * .5, b.w * .75, b.h * .65, 0, 0, 6.3); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    if (b.phase >= 2 && !b.dead) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * 2.1;
        const ex = Math.cos(a) * b.w * .5 + W.rand(6, -6);
        const ey = -b.h * (.5 + Math.sin(a) * .2) + W.rand(6, -6);
        c.fillStyle = `rgba(255,150,80,${0.5 + Math.sin(t * 5 + i) * .3})`;
        c.beginPath(); c.arc(ex, ey, 2.6, 0, 6.3); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }

  /* ---------------- 弹道 ---------------- */
  _drawProjectiles(c, t) {
    for (const pr of this.G.projectiles) {
      c.save();
      c.translate(pr.x, pr.y);
      if (pr.kind === 'arrow') {
        c.rotate(pr.rot);
        c.strokeStyle = 'rgba(180,215,230,0.9)'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(8, 0); c.stroke();
        c.fillStyle = '#9fd8ff';
        c.beginPath(); c.moveTo(14, 0); c.lineTo(4, -4); c.lineTo(4, 4); c.closePath(); c.fill();
        c.globalAlpha = .3;
        c.strokeStyle = '#7fd8ff'; c.lineWidth = 6;
        c.beginPath(); c.moveTo(-4, 0); c.lineTo(8, 0); c.stroke();
      } else if (pr.kind === 'bubble') {
        const r = 11 + Math.sin(t * 12 + pr.x) * 1.5;
        const g = c.createRadialGradient(-3, -3, 1, 0, 0, r);
        g.addColorStop(0, 'rgba(255,240,210,0.95)');
        g.addColorStop(.5, 'rgba(230,140,70,0.75)');
        g.addColorStop(1, 'rgba(160,60,30,0.35)');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill();
        c.strokeStyle = 'rgba(255,200,150,0.6)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.stroke();
      } else if (pr.kind === 'wave') {
        const dir = Math.sign(pr.vx) || 1;
        c.scale(dir, 1);
        c.globalCompositeOperation = 'lighter';
        const g = c.createLinearGradient(-30, 0, 30, 0);
        g.addColorStop(0, 'rgba(255,140,70,0)');
        g.addColorStop(.6, 'rgba(255,170,90,0.55)');
        g.addColorStop(1, 'rgba(255,230,180,0.85)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-24, 16);
        c.quadraticCurveTo(6, -22 - Math.sin(t * 20) * 5, 26, 16);
        c.closePath(); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
  }

  /* ---------------- 敌人复活/死亡标记 ---------------- */

  /* =========================================================
     玩家绘制 —— 原版角色精灵 + 程序化动作
     ========================================================= */
  _drawPlayer(c, t) {
    const p = this.G.player;
    if (!p) return;
    const x = p.cx, y = p.bottom;

    const dead = p.dead;
    const runSpd = Math.abs(p.vx);
    const walkPh = t * (7 + runSpd / 60);
    const hurt = p.state === 'hurt';
    const roll = p.state === 'roll';
    const rollP = roll ? Math.min(1, p.stateT / 0.42) : 0;
    const atk = p.state === 'attack' || p.state === 'heavy';
    const hvy = p.state === 'heavy';
    const atkP = atk ? Math.min(1, p.stateT / (hvy ? 0.62 : 0.34)) : 0;
    const echoP = p.state === 'echo' ? Math.min(1, p.stateT / 0.52) : 0;
    const f = p.face;

    /* ---- 地面影（不随精灵翻转） ---- */
    c.save();
    c.translate(x, y);
    if (dead) c.globalAlpha = W.clamp(1 - p.deadT * 0.5, 0, 1);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath();
    c.ellipse(0, 1, roll ? 26 : 20, 6, 0, 0, 6.3);
    c.fill();
    c.restore();

    /* ---- 精灵 ---- */
    c.save();
    c.translate(x, y);
    if (dead) c.globalAlpha = W.clamp(1 - p.deadT * 0.5, 0, 1);

    // 呼吸 / 跑动起伏
    const bob = p.state === 'idle' ? Math.sin(t * 2.2) * 1.3
      : (p.onGround ? -Math.abs(Math.sin(walkPh)) * 2.6 : 0);

    if (roll) {
      // 翻滚：整体旋转并压扁
      const ang = W.ease.inOutSine(rollP) * Math.PI * 2;
      c.translate(0, -30);
      c.rotate(ang * f);
      c.translate(0, 30);
      c.scale(1, 0.86);
    }
    c.translate(0, bob);

    // 受击抖动
    if (hurt) c.translate(W.rand(3, -3), W.rand(2, -2));

    c.scale(f, 1);

    // 攻击时前倾
    if (atk) {
      const lean = hvy ? W.lerp(-0.1, 0.16, Math.min(1, atkP * 1.5))
        : W.lerp(-0.06, 0.12, Math.min(1, atkP * 1.6));
      c.rotate(lean);
    }
    if (echoP > 0) c.rotate(-0.05 * Math.sin(echoP * Math.PI));

    // 精灵尺寸：游戏角色高 58px，视觉上略大一点
    const HERO_H = 118;
    const HERO_W = HERO_H * (843 / 1026);

    // 用 complete + naturalWidth 实时判定，避免 onload 时机问题
    const heroReady = (this.heroLoaded || (this.hero.complete && this.hero.naturalWidth > 0));
    if (heroReady) {
      if (!this.heroLoaded) this.heroLoaded = true;
      c.drawImage(this.hero, -HERO_W / 2, -HERO_H, HERO_W, HERO_H);
    } else {
      // 仅在确实未就绪时占位（会随加载完成自动替换）
      c.fillStyle = 'rgba(42,95,150,0.35)';
      c.beginPath(); c.ellipse(0, -HERO_H * .5, HERO_W * .38, HERO_H * .46, 0, 0, 6.3); c.fill();
    }

    c.restore();

    /* ---- 攻击弧光 ---- */
    if (atk && atkP > 0.06 && atkP < 0.72) {
      const prog = W.clamp((atkP - 0.06) / 0.55, 0, 1);
      const a = Math.sin(prog * Math.PI);
      c.save();
      c.translate(x, y - 46);
      c.scale(f, 1);
      const R = hvy ? 88 : 70;
      const start = -1.5 + prog * 2.6;
      const g = c.createRadialGradient(0, 0, R * 0.45, 0, 0, R);
      g.addColorStop(0, 'rgba(190,235,255,0)');
      g.addColorStop(0.7, `rgba(180,230,255,${0.30 * a})`);
      g.addColorStop(1, `rgba(230,250,255,${0.62 * a})`);
      c.strokeStyle = g;
      c.lineWidth = hvy ? 13 : 9;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(0, 0, R * 0.78, start, start + 1.7);
      c.stroke();
      c.restore();
    }

    /* ---- 敲锅回声：锅盔发光 ---- */
    if (echoP > 0) {
      const a2 = Math.sin(echoP * Math.PI);
      c.save();
      c.translate(x, y - 74);
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, 2, 0, 0, 52);
      g.addColorStop(0, `rgba(190,240,255,${0.55 * a2})`);
      g.addColorStop(0.5, `rgba(120,200,255,${0.24 * a2})`);
      g.addColorStop(1, 'rgba(80,160,230,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 52, 0, 6.3); c.fill();
      c.restore();
    }

    /* ---- 无敌帧闪烁 ---- */
    if (p.invuln > 0 && !dead && p.state !== 'roll') {
      const bl = Math.floor(p.invuln * 20) % 2 === 0;
      if (bl) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.22;
        c.translate(x, y - 48);
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 46);
        g.addColorStop(0, 'rgba(255,120,130,0.8)');
        g.addColorStop(1, 'rgba(255,60,80,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, 46, 0, 6.3); c.fill();
        c.restore();
      }
    }
  }

  /* ---------------- 粒子 ---------------- */
  _drawParticles(c) {
    for (const q of this.G.parts.p) {
      const a = W.clamp(q.life / (q.max || 1), 0, 1);
      c.globalAlpha = q.fade ? a : 1;
      c.fillStyle = q.color;
      if (q.type === 'rect') {
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
        c.fillRect(-q.size / 2, -q.size / 2, q.size, q.size);
        c.restore();
      } else {
        c.beginPath(); c.arc(q.x, q.y, q.size * (0.4 + a * 0.6), 0, 6.3); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  /* ---------------- 回声环 ---------------- */
  _drawEchoRings(c, t) {
    const p = this.G.player;
    if (!p) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const r of p.echoRings) {
      if (r.t < 0) continue;
      const a = Math.max(0, 1 - r.t / 0.95);
      c.strokeStyle = `rgba(140,225,255,${a * 0.5})`;
      c.lineWidth = 2.5 + a * 5;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, 6.3); c.stroke();
      c.strokeStyle = `rgba(210,245,255,${a * 0.32})`;
      c.lineWidth = 1;
      c.beginPath(); c.arc(r.x, r.y, r.r * 0.72, 0, 6.3); c.stroke();
    }
    c.restore();
  }

  _drawFloatText(c) {
    for (const t of this.G.float.items) {
      const a = W.clamp(t.life / t.max, 0, 1);
      c.globalAlpha = a;
      c.font = `${t.size}px "Songti SC", serif`;
      c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,0.7)';
      c.fillText(t.text, t.x + 1, t.y + 1);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
    c.textAlign = 'left';
  }

  /* ---------------- 表面粒子（灰/雨/滴水） ---------------- */
  _drawSurfaceFX(c, t, zone, camX, camY) {
    c.save();
    if (zone.id === 'rain' || zone.id === 'ash') {
      // 雨
      if (zone.id === 'rain') {
        c.strokeStyle = 'rgba(150,200,225,0.16)'; c.lineWidth = 1.2;
        for (const r of this.rain) {
          const y = ((r.y + t * r.s) % 800);
          const x = ((r.x - camX * 0.5) % 1400 + 1400) % 1400;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + r.l); c.stroke();
        }
        // 地面水花
        for (let i = 0; i < 8; i++) {
          const ph = (t * 1.4 + i * 0.31) % 1;
          if (ph > 0.3) continue;
          const x = ((i * 197 - camX * 0.9) % 1400 + 1400) % 1400;
          c.strokeStyle = `rgba(160,210,235,${(1 - ph / 0.3) * 0.3})`;
          c.beginPath(); c.ellipse(x, 620 + (i % 3) * 24, 4 + ph * 22, 2 + ph * 8, 0, 0, 6.3); c.stroke();
        }
      } else {
        // 灰烬飘落
        for (const a of this.ash) {
          const y = ((a.y + t * a.v) % 820);
          const x = ((a.x + Math.sin(t * 0.6 + a.d) * a.w - camX * 0.7) % 1400 + 1400) % 1400;
          c.fillStyle = `rgba(190,196,200,${0.1 + (a.s / 3) * 0.18})`;
          c.beginPath(); c.arc(x, y, a.s * 0.6, 0, 6.3); c.fill();
        }
      }
    } else if (zone.id === 'hall') {
      // 热浪/汤气
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.24 + i * 0.31) % 1;
        const x = ((i * 240 - camX * 0.4) % 1400 + 1400) % 1400;
        const y = 700 - ph * 620;
        const rr = 60 + ph * 160;
        const g = c.createRadialGradient(x, y, 1, x, y, rr);
        g.addColorStop(0, `rgba(200,110,70,${0.05 * (1 - ph)})`);
        g.addColorStop(1, 'rgba(200,110,70,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, rr, 0, 6.3); c.fill();
      }
    } else {
      // 骨钟道：浮尘
      for (const a of this.ash) {
        const y = ((a.y + Math.sin(t * 0.3 + a.d) * 40 - t * a.v * 0.3) % 820);
        const x = ((a.x - camX * 0.6) % 1400 + 1400) % 1400;
        c.fillStyle = `rgba(200,190,160,${0.06 + (a.s / 3) * 0.1})`;
        c.beginPath(); c.arc(x, y, a.s * 0.5, 0, 6.3); c.fill();
      }
    }
    c.restore();
  }

  /* ---------------- 光照 / 黑暗 ---------------- */
  _drawLighting(c, t, camX, camY, zone) {
    const p = this.G.player;
    if (!p) return;
    const px = p.cx - camX, py = p.cy - camY;    c.save();
    c.globalCompositeOperation = 'multiply';
    // 全局压暗（保留地形可读性：这是"暗"不是"看不见"）
    const amb = { ash: 0.78, rain: 0.72, bone: 0.68, hall: 0.7 }[zone.id] || 0.75;
    c.fillStyle = `rgba(${Math.round(255 * amb * 0.86)},${Math.round(255 * amb * 0.92)},${Math.round(255 * amb)},1)`;
    c.fillRect(0, 0, 1280, 720);
    c.globalCompositeOperation = 'source-over';

    // 火光叠加
    for (const l of this.G.level.lights) {
      const lx = l.x - camX, ly = l.y - camY;
      if (lx < -400 || lx > 1700) continue;
      const fl = 1 + (l.flicker || 0) * Math.sin(t * 7 + l.x) * 0.08 + (l.flicker || 0) * Math.sin(t * 13.7 + l.x * 2) * 0.04;
      const g = c.createRadialGradient(lx, ly, 4, lx, ly, l.r * fl);
      g.addColorStop(0, `rgba(${l.c},${l.i})`);
      g.addColorStop(1, `rgba(${l.c},0)`);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g;
      c.beginPath(); c.arc(lx, ly, l.r * fl, 0, 6.3); c.fill();
      c.globalCompositeOperation = 'source-over';
    }

    // 玩家周围微光（锅盔里透出来的）
    c.globalCompositeOperation = 'lighter';
    const pg = c.createRadialGradient(px, py, 6, px, py, 210 + this.G.echoGlow * 160);
    const gi = 0.09 + this.G.echoGlow * 0.16;
    pg.addColorStop(0, `rgba(130,200,255,${gi})`);
    pg.addColorStop(1, 'rgba(90,150,220,0)');
    c.fillStyle = pg;
    c.beginPath(); c.arc(px, py, 210 + this.G.echoGlow * 160, 0, 6.3); c.fill();
    c.restore();

    // 受击红闪
    if (this.G.hurtFlash > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const a = this.G.hurtFlash * 0.5;
      const g = c.createRadialGradient(640, 360, 200, 640, 360, 760);
      g.addColorStop(0, 'rgba(190,40,50,0)');
      g.addColorStop(1, `rgba(190,40,50,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, 1280, 720);
      c.restore();
    }
  }

  /* ---------------- 回声特效层（全局） ---------------- */
  _drawEchoOverlay(c, t, camX, camY) {
    const G = this.G;
    if (G.echoGlow <= 0.01) return;
    const a = G.echoGlow;
    c.save();
    c.globalCompositeOperation = 'lighter';

    // 全屏冷光脉冲
    const g = c.createRadialGradient(640, 400, 100, 640, 400, 900);
    g.addColorStop(0, `rgba(120,200,255,0)`);
    g.addColorStop(0.6, `rgba(90,170,230,${0.05 * a})`);
    g.addColorStop(1, `rgba(50,110,180,${0.11 * a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, 1280, 720);

    // 回声波纹扫描线
    for (const r of (G.player ? G.player.echoRings : [])) {
      if (r.t < 0) continue;
      const rr = r.r;
      c.strokeStyle = `rgba(150,225,255,${0.16 * a})`;
      c.lineWidth = 26;
      c.beginPath(); c.arc(r.x - camX, r.y - camY, rr, 0, 6.3); c.stroke();
    }
    c.restore();
  }

  _drawVignette(c) {
    const g = c.createRadialGradient(640, 360, 300, 640, 360, 820);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.82)');
    c.fillStyle = g;
    c.fillRect(0, 0, 1280, 720);

    // 细微扫描线
    c.globalAlpha = 0.032;
    c.fillStyle = '#000';
    for (let y = 0; y < 720; y += 3) c.fillRect(0, y, 1280, 1);
    c.globalAlpha = 1;
  }

  /* ---------------- 物品 ---------------- */
  _drawItems(c, t) {
    for (const it of this.G.pickups) {
      if (it.taken) continue;
      const x = it.x, y = it.y + Math.sin(it.t * 2.2) * 5;
      c.save();
      c.translate(x + 11, y + 11);
      const rev = it.revealed > 0;
      const glow = 0.5 + 0.5 * Math.sin(t * 3 + x);
      if (it.item.type === 'shard') {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 1, 0, 0, 40);
        g.addColorStop(0, `rgba(150,225,255,${0.42 * glow})`);
        g.addColorStop(0.5, `rgba(90,180,255,${0.16 * glow})`);
        g.addColorStop(1, 'rgba(60,140,230,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, 6.3); c.fill();
        c.globalCompositeOperation = 'source-over';
        // 碎片：三棱锥状的玻璃片
        c.save();
        c.rotate(Math.sin(t * 1.4 + x) * 0.5);
        const sg = c.createLinearGradient(-8, -10, 8, 10);
        sg.addColorStop(0, 'rgba(235,250,255,0.95)');
        sg.addColorStop(0.5, 'rgba(140,215,255,0.85)');
        sg.addColorStop(1, 'rgba(70,150,220,0.8)');
        c.fillStyle = sg;
        c.beginPath();
        c.moveTo(0, -11); c.lineTo(7, 3); c.lineTo(0, 10); c.lineTo(-7, 3);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 10); c.stroke();
        c.restore();
        // 环绕的小光点
        for (let k = 0; k < 3; k++) {
          const a2 = t * 2 + k * 2.09;
          c.fillStyle = `rgba(180,235,255,${0.5 + 0.4 * Math.sin(a2)})`;
          c.beginPath();
          c.arc(Math.cos(a2) * 16, Math.sin(a2) * 10, 1.8, 0, 6.3);
          c.fill();
        }
      } else if (it.item.type === 'soup') {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 1, 0, 0, 34);
        g.addColorStop(0, `rgba(140,255,210,${0.28 * glow})`);
        g.addColorStop(1, 'rgba(80,220,180,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 34, 0, 6.3); c.fill();
        c.globalCompositeOperation = 'source-over';
        // 小碗
        c.fillStyle = '#dfe9f0';
        c.beginPath(); c.moveTo(-10, -2); c.quadraticCurveTo(0, 10, 10, -2); c.closePath(); c.fill();
        c.fillStyle = '#7fe8c0';
        c.beginPath(); c.ellipse(0, -2, 10, 3.4, 0, 0, 6.3); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, -2, 10, 3.4, 0, 0, 6.3); c.stroke();
      } else if (it.item.type === 'key') {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 1, 0, 0, 30);
        g.addColorStop(0, `rgba(255,215,140,${0.3 * glow})`);
        g.addColorStop(1, 'rgba(255,180,80,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30, 0, 6.3); c.fill();
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = '#d8b070'; c.lineWidth = 3;
        c.beginPath(); c.arc(-4, 0, 6, 0, 6.3); c.stroke();
        c.beginPath(); c.moveTo(2, 0); c.lineTo(14, 0); c.stroke();
        c.beginPath(); c.moveTo(11, 0); c.lineTo(11, 6); c.stroke();
        c.beginPath(); c.moveTo(14, 0); c.lineTo(14, 5); c.stroke();
      } else {
        // 文字
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 1, 0, 0, 28);
        g.addColorStop(0, `rgba(255,240,200,${0.22 * glow})`);
        g.addColorStop(1, 'rgba(255,220,160,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 28, 0, 6.3); c.fill();
        c.globalCompositeOperation = 'source-over';
        c.save(); c.rotate(Math.sin(t + x) * 0.1);
        c.fillStyle = '#e8dcc0';
        c.fillRect(-8, -10, 16, 20);
        c.strokeStyle = 'rgba(120,100,70,0.8)'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-5, -6 + i * 4); c.lineTo(5, -6 + i * 4); c.stroke(); }
        c.restore();
      }
      if (rev) {
        c.strokeStyle = 'rgba(150,230,255,0.7)'; c.lineWidth = 1.6;
        c.beginPath(); c.arc(0, 0, 22 + Math.sin(t * 5) * 3, 0, 6.3); c.stroke();
      }
      c.restore();
    }
  }
};
