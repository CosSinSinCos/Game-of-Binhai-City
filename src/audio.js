/* ============================================================
   Audio : 全程序化 WebAudio —— 引擎/轮胎/碰撞/脚步/可切台电台BGM
   ============================================================ */
window.AudioEngine = (function () {
  class A {
    constructor() { this.ctx = null; this.ready = false; this.station = 0; this.bgmOn = true; }

    init() {
      if (this.ctx) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);

      // 引擎：两个振荡器 -> 低通 -> 增益
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 900;
      this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
      this.osc2 = ctx.createOscillator(); this.osc2.type = 'square'; this.osc2.detune.value = -1200;
      this.osc1.connect(this.engFilter); this.osc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.osc1.frequency.value = 60; this.osc2.frequency.value = 30;
      this.osc1.start(); this.osc2.start();

      // 轮胎噪声
      this.noiseBuf = this._noise(2);
      this.tireSrc = ctx.createBufferSource(); this.tireSrc.buffer = this.noiseBuf; this.tireSrc.loop = true;
      this.tireFilter = ctx.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.frequency.value = 1800; this.tireFilter.Q.value = 1.2;
      this.tireGain = ctx.createGain(); this.tireGain.gain.value = 0;
      this.tireSrc.connect(this.tireFilter); this.tireFilter.connect(this.tireGain); this.tireGain.connect(this.master);
      this.tireSrc.start();

      // 电台 BGM
      this.bgmGain = ctx.createGain(); this.bgmGain.gain.value = this.bgmOn ? 0.16 : 0; this.bgmGain.connect(this.master);
      this._startBGM();
      this.ready = true;
    }

    _noise(sec) {
      const ctx = this.ctx, len = ctx.sampleRate * sec;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    setEngine(rpm, throttle) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      const base = 55 + rpm * 270;
      this.osc1.frequency.setTargetAtTime(base, t, 0.05);
      this.osc2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(500 + rpm * 2200, t, 0.05);
      this.engGain.gain.setTargetAtTime(0.03 + rpm * 0.10 + throttle * 0.05, t, 0.08);
    }
    setTire(slip) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.tireGain.gain.setTargetAtTime(Math.min(0.16, slip * 0.22), t, 0.05);
      this.tireFilter.frequency.setTargetAtTime(1400 + slip * 1600, t, 0.05);
    }
    hit(intensity) {
      if (!this.ready) return;
      const t = this.ctx.currentTime, ctx = this.ctx;
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.setValueAtTime(Math.min(0.5, intensity * 0.6), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.3);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(170 + Math.random() * 130, t);
      const og = ctx.createGain(); og.gain.setValueAtTime(Math.min(0.3, intensity * 0.4), t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.4);
    }
    step() {
      if (!this.ready) return;
      const t = this.ctx.currentTime, ctx = this.ctx;
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.1);
    }
    toggleBGM() { this.bgmOn = !this.bgmOn; if (this.ready) this.bgmGain.gain.setTargetAtTime(this.bgmOn ? 0.16 : 0, this.ctx.currentTime, 0.1); }
    nextStation() { if (!this.stations) return '—'; this.station = (this.station + 1) % this.stations.length; return this.stations[this.station].name; }
    stationName() { return this.stations ? this.stations[this.station].name : '—'; }

    _startBGM() {
      const ctx = this.ctx;
      this.stations = [
        { name: '潮汐电波', tempo: 104, wave: 'sawtooth', scale: [0, 3, 5, 7, 10, 12], root: 220 },
        { name: '霓虹慢摇', tempo: 92, wave: 'square', scale: [0, 2, 4, 7, 9, 12], root: 196 },
        { name: '码头脉冲', tempo: 120, wave: 'triangle', scale: [0, 5, 7, 10, 12, 14], root: 165 }
      ];
      this.bgmStep = 0; this.nextNoteTime = ctx.currentTime + 0.1;
      const lookahead = () => {
        while (this.nextNoteTime < ctx.currentTime + 0.12) {
          this._scheduleStep(this.nextNoteTime);
          const st = this.stations[this.station];
          const spb = 60 / st.tempo / 2; // 8分音符
          this.nextNoteTime += spb;
          this.bgmStep++;
        }
        this._bgmTimer = setTimeout(lookahead, 25);
      };
      lookahead();
    }
    _scheduleStep(time) {
      const st = this.stations[this.station];
      const ctx = this.ctx;
      // 低音（每拍）
      if (this.bgmStep % 4 === 0) {
        const bf = st.root / 2;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = bf;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(0.5, time + 0.02); g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        o.connect(g); g.connect(this.bgmGain); o.start(time); o.stop(time + 0.45);
      }
      // 主旋律（琶音）
      const deg = st.scale[(this.bgmStep * 2) % st.scale.length];
      const oct = (Math.floor((this.bgmStep * 2) / st.scale.length) % 2) * 12;
      const f = st.root * Math.pow(2, (deg + oct) / 12);
      const o = ctx.createOscillator(); o.type = st.wave; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(0.18, time + 0.02); g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
      o.connect(g); g.connect(this.bgmGain); o.start(time); o.stop(time + 0.25);
    }
  }
  return new A();
})();
