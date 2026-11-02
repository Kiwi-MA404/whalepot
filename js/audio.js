/* ============================================================
   倾汤 · 锅盔回声  —  audio.js
   全程序化合成。回声是玩法，所以声音必须与状态严格同步。
   ============================================================ */
W.Audio = class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.echoGain = null;
    this.muted = false;
    this.reverb = null;
    this.droneNodes = [];
    this.droneOn = false;
    this.curDroneKey = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain(); this.master.gain.value = 0.85; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.22;
    comp.connect(this.master);
    this.bus = comp;

    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.bus);
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0.34; this.musicGain.connect(this.bus);
    this.echoGain = c.createGain(); this.echoGain.gain.value = 1.0; this.echoGain.connect(this.bus);

    // 长混响：地下的空旷感
    const conv = c.createConvolver();
    conv.buffer = this._impulse(2.8, 3.2);
    this.reverb = c.createGain();
    this.reverb.gain.value = 0.5;
    conv.connect(this.reverb); this.reverb.connect(this.bus);
    this.revSend = conv;
    this.ready = true;
  }

  _impulse(dur, decay) {
    const c = this.ctx, rate = c.sampleRate, len = Math.floor(rate * dur);
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  _env(node, t, a, d, peak = 1) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, dur, o = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const g = c.createGain();
    this._env(g, t, o.attack || 0.004, dur, o.vol ?? 0.2);
    let out = g;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 1;
      g.connect(f); out = f;
    }
    osc.connect(g);
    let dest = o.echo ? this.echoGain : this.sfxGain;
    if (o.pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = W.clamp(o.pan, -1, 1);
      out.connect(p); p.connect(dest);
      if (o.reverb) { const rg = c.createGain(); rg.gain.value = o.reverb; p.connect(rg); rg.connect(this.revSend); }
    } else {
      out.connect(dest);
      if (o.reverb) { const rg = c.createGain(); rg.gain.value = o.reverb; out.connect(rg); rg.connect(this.revSend); }
    }
    osc.start(t); osc.stop(t + (o.attack || 0.004) + dur + 0.05);
  }

  noise(dur, o = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * (o.decay === false ? 1 : Math.pow(1 - p, o.pw || 2));
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 900, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.slide), t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    this._env(g, t, o.attack || 0.002, dur, o.vol ?? 0.2);
    src.connect(f); f.connect(g);
    let dest = this.sfxGain;
    if (o.pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = W.clamp(o.pan, -1, 1);
      g.connect(p); p.connect(dest);
      if (o.reverb) { const rg = c.createGain(); rg.gain.value = o.reverb; p.connect(rg); rg.connect(this.revSend); }
    } else {
      g.connect(dest);
      if (o.reverb) { const rg = c.createGain(); rg.gain.value = o.reverb; g.connect(rg); rg.connect(this.revSend); }
    }
    src.start(t); src.stop(t + dur + 0.05);
  }

  /* ---------- 具体音效 ---------- */
  hitLight() {
    this.noise(0.09, { filter: 'highpass', freq: 2400, vol: 0.16, pw: 3 });
    this.tone(W.rand(240, 180), 0.09, { type: 'square', vol: 0.05, filter: 'lowpass', freq: 1400 });
  }
  hitHeavy() {
    this.noise(0.2, { filter: 'lowpass', freq: 900, vol: 0.3, pw: 2 });
    this.tone(90, 0.24, { type: 'sine', slide: 42, vol: 0.24 });
    this.tone(W.rand(190, 150), 0.14, { type: 'sawtooth', vol: 0.06, filter: 'lowpass', freq: 700 });
  }
  hurt() {
    this.noise(0.24, { filter: 'bandpass', freq: 520, q: 0.8, vol: 0.26, pw: 1.4 });
    this.tone(148, 0.3, { type: 'triangle', slide: 62, vol: 0.16, reverb: 0.2 });
  }
  swing(heavy = false) {
    this.noise(heavy ? 0.22 : 0.13, {
      filter: 'bandpass', freq: heavy ? 420 : 1500, slide: heavy ? 190 : 700,
      q: 1.4, vol: heavy ? 0.11 : 0.07, attack: 0.02, decay: false, reverb: 0.12
    });
  }
  jump() { this.noise(0.08, { filter: 'highpass', freq: 900, vol: 0.05 }); }
  roll() { this.noise(0.26, { filter: 'lowpass', freq: 1500, slide: 300, vol: 0.1, attack: 0.03 }); }
  land() { this.noise(0.1, { filter: 'lowpass', freq: 420, vol: 0.13, pw: 2.4 }); }
  step(hard) {
    this.noise(0.055, { filter: 'lowpass', freq: hard ? 700 : 480, vol: hard ? 0.055 : 0.032, pw: 3 });
  }

  /* 锅被敲响 —— 整个游戏最重要的声音 */
  potEcho(power = 1) {
    if (!this.ready) return;
    const base = 523 * (0.94 + Math.random() * 0.12);
    // 金属非谐波泛音
    const parts = [1, 2.76, 5.4, 8.93];
    parts.forEach((m, i) => {
      this.tone(base * m, (1.5 - i * 0.28) * (0.8 + power * 0.5), {
        type: i === 0 ? 'sine' : 'sine',
        vol: (0.16 / (i + 1)) * (0.7 + power * 0.5),
        attack: 0.002,
        echo: true,
        reverb: 0.85,
        filter: 'lowpass', freq: 3000 + power * 4000
      });
    });
    this.noise(0.5, { filter: 'bandpass', freq: 2600, q: 0.9, vol: 0.13 * power, pw: 1.2, decay: false, reverb: 1 });
  }
  echoReturn(dist) {
    const v = W.clamp(1 - dist / 1400, 0.03, 1);
    this.tone(1180 * W.rand(1.05, .95), 0.45, { type: 'sine', vol: 0.055 * v, attack: 0.01, echo: true, reverb: 0.6, pan: W.rand(1, -1) });
  }

  heal() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.09, delay: i * 0.11, reverb: 0.5, attack: 0.03 }));
    this.noise(0.4, { filter: 'bandpass', freq: 1800, vol: 0.05, reverb: 0.6 });
  }
  soulGain(n) {
    this.tone(880, 0.16, { type: 'sine', vol: 0.05 });
    this.tone(1320, 0.26, { type: 'sine', vol: 0.035, delay: 0.05 });
  }
  fireRest() {
    this.noise(0.9, { filter: 'lowpass', freq: 700, vol: 0.14, attack: 0.15, pw: 1.1 });
    [196, 247, 294].forEach((f, i) => this.tone(f, 1.1, { type: 'triangle', vol: 0.06, delay: i * 0.08, attack: 0.08, reverb: 0.5 }));
  }
  death() {
    this.tone(110, 1.6, { type: 'sine', slide: 34, vol: 0.3, attack: 0.02, reverb: 0.9 });
    this.tone(74, 2.2, { type: 'triangle', slide: 28, vol: 0.22, attack: 0.05, reverb: 0.9 });
    this.noise(1.4, { filter: 'lowpass', freq: 400, vol: 0.16, attack: 0.05, pw: 1.2, reverb: 0.8 });
  }
  bossRoar() {
    this.tone(58, 1.5, { type: 'sawtooth', slide: 38, vol: 0.22, filter: 'lowpass', freq: 340, reverb: 0.7, attack: 0.08 });
    this.tone(87, 1.3, { type: 'square', slide: 52, vol: 0.09, filter: 'lowpass', freq: 500, reverb: 0.6, attack: 0.06 });
    this.noise(1.2, { filter: 'lowpass', freq: 320, vol: 0.2, attack: 0.1, pw: 1.3, reverb: 0.8 });
  }
  uiClick() { this.tone(660, 0.07, { type: 'sine', vol: 0.07 }); this.tone(990, 0.1, { type: 'sine', vol: 0.04, delay: 0.03 }); }
  uiConfirm() { [440, 660, 880].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', vol: 0.07, delay: i * 0.06, reverb: 0.4 })); }
  zoneRise() {
    [130, 196, 261, 392].forEach((f, i) => this.tone(f, 2.6, { type: 'sine', vol: 0.05, delay: i * 0.22, attack: 0.9, reverb: 0.9 }));
  }
  whisper() { this.noise(0.6, { filter: 'bandpass', freq: W.rand(1400, 700), q: 3, vol: 0.05, attack: 0.1, reverb: 0.8, pan: W.rand(1, -1) }); }

  /* ---------- 环境底噪（随区域变化） ---------- */
  drone(key) {
    if (!this.ready || this.curDroneKey === key) return;
    this.curDroneKey = key;
    const c = this.ctx, t = c.currentTime;
    // 旧的不动，新的叠上来淡出旧的
    const old = this.droneNodes;
    old.forEach(n => {
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setTargetAtTime(0.0001, t, 0.8);
      n.osc.stop(t + 4);
    });
    this.droneNodes = [];
    const P = {
      ash: [[55, 'sine', 0.1], [82.4, 'sine', 0.055], [110, 'triangle', 0.03]],
      rain: [[49, 'sine', 0.11], [73.4, 'sine', 0.06], [146.8, 'triangle', 0.022]],
      bone: [[41.2, 'sine', 0.12], [61.7, 'sine', 0.07], [92.5, 'triangle', 0.035]],
      boss: [[36.7, 'sawtooth', 0.05], [55, 'sine', 0.12], [82.4, 'sine', 0.06]],
      ghost: [[65.4, 'sine', 0.09], [98, 'sine', 0.05], [196, 'triangle', 0.02]]
    }[key] || [[55, 'sine', 0.08], [82.4, 'sine', 0.04]];
    P.forEach(([f, type, v]) => {
      const osc = c.createOscillator(); osc.type = type; osc.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0.0001;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 620;
      osc.connect(f2); f2.connect(g); g.connect(this.musicGain);
      const rg = c.createGain(); rg.gain.value = 0.5; g.connect(rg); rg.connect(this.revSend);
      osc.start(t);
      g.gain.setTargetAtTime(v, t, 1.6);
      // 极慢的失谐，制造不安
      const lfo = c.createOscillator(); lfo.frequency.value = 0.03 + Math.random() * 0.05;
      const lg = c.createGain(); lg.gain.value = f * 0.004;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t);
      this.droneNodes.push({ osc, gain: g, lfo });
    });
  }
  droneOff() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.droneNodes.forEach(n => { n.gain.gain.setTargetAtTime(0.0001, t, 0.6); n.osc.stop(t + 3); if (n.lfo) n.lfo.stop(t + 3); });
    this.droneNodes = []; this.curDroneKey = null;
  }
};
