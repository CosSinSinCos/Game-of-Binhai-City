/* ============================================================
   HUD : 小地图 + GPS路径线 + 任务指引 + 速度表 + H帮助 + 新手引导
   ============================================================ */
window.HUD = (function () {
  let el = {};
  let city = null, scale = 1, extent = 1, mapSize = 210;

  function init(c) {
    city = c;
    extent = Math.max(c.bounds.spanX, c.bounds.spanZ) + 40;
    scale = mapSize / (2 * extent);

    const style = document.createElement('style');
    style.textContent = `
      #hud{position:fixed;inset:0;pointer-events:none;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#eaf2ff;z-index:10}
      #minimap{position:absolute;right:16px;top:16px;width:${mapSize}px;height:${mapSize}px;background:rgba(8,12,20,.72);border:2px solid rgba(120,200,255,.5);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.5)}
      #speedo{position:absolute;right:18px;bottom:18px;text-align:right;text-shadow:0 2px 6px #000}
      #speedo .v{font-size:42px;font-weight:800;letter-spacing:1px}
      #speedo .u{font-size:14px;opacity:.7}
      #speedbar{width:160px;height:8px;background:rgba(255,255,255,.15);border-radius:4px;margin-top:4px;margin-left:auto;overflow:hidden}
      #speedbar > i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3df0ff,#ffd23f,#ff3b3b)}
      #mission{position:absolute;left:16px;top:16px;max-width:360px;background:rgba(8,12,20,.7);border-left:4px solid #3df0ff;padding:10px 14px;border-radius:0 8px 8px 0;text-shadow:0 1px 3px #000}
      #mission .t{font-size:13px;opacity:.7;letter-spacing:2px}
      #mission .m{font-size:16px;font-weight:600;margin-top:2px}
      #toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);background:rgba(10,16,28,.85);border:1px solid rgba(120,200,255,.4);padding:10px 18px;border-radius:24px;font-size:15px;opacity:0;transition:opacity .4s;text-shadow:0 1px 3px #000}
      #toast.show{opacity:1}
      #radio{position:absolute;left:16px;bottom:16px;background:rgba(8,12,20,.7);padding:6px 12px;border-radius:8px;font-size:13px;border:1px solid rgba(255,210,63,.4)}
      #radio b{color:#ffd23f}
      #vignette{position:absolute;inset:0;box-shadow:inset 0 0 200px 40px rgba(255,0,0,0);transition:box-shadow .12s}
      #help{position:absolute;inset:0;background:rgba(4,8,14,.92);display:none;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;color:#eaf2ff}
      #help h1{font-size:30px;color:#3df0ff;letter-spacing:4px;margin-bottom:6px}
      #help .sub{opacity:.7;margin-bottom:22px}
      #help .grid{display:grid;grid-template-columns:auto auto;gap:8px 28px;font-size:15px}
      #help .k{color:#ffd23f;font-weight:700;font-family:monospace}
      #help .hint{margin-top:24px;opacity:.6;font-size:13px}
      #loading{position:fixed;inset:0;background:#060a12;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#cfe6ff;z-index:50;font-family:system-ui,Arial}
      #loading .bar{width:240px;height:6px;background:#1a2433;border-radius:3px;margin-top:14px;overflow:hidden}
      #loading .bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3df0ff,#ffd23f);transition:width .2s}
      #start{position:fixed;inset:0;background:rgba(4,8,14,.9);display:flex;align-items:center;justify-content:center;flex-direction:column;color:#eaf2ff;z-index:40;cursor:pointer;font-family:system-ui,Arial}
      #start h1{font-size:40px;color:#3df0ff;letter-spacing:6px}
      #start p{opacity:.8;margin-top:10px}
      #start .btn{margin-top:22px;padding:12px 30px;border:2px solid #3df0ff;border-radius:30px;font-size:16px;animation:pulse 1.4s infinite}
      @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(61,240,255,.4)}50%{box-shadow:0 0 0 14px rgba(61,240,255,0)}}
    `;
    document.head.appendChild(style);

    const hud = document.createElement('div'); hud.id = 'hud';
    hud.innerHTML = `
      <canvas id="minimap" width="${mapSize}" height="${mapSize}"></canvas>
      <div id="mission"><div class="t">当前任务</div><div class="m" id="missionText">—</div></div>
      <div id="speedo"><span class="v" id="spd">0</span> <span class="u">km/h</span><div id="speedbar"><i id="spdbar"></i></div></div>
      <div id="radio">电台 <b id="station">—</b> · 按 [B] 切台 · [M] 静音</div>
      <div id="toast"></div>
      <div id="vignette"></div>
      <div id="help">
        <h1>滨湾市 · 操作指南</h1>
        <div class="sub">单人开放城市 · 步行 / 驾驶无缝切换</div>
        <div class="grid">
          <span class="k">W A S D</span><span>移动 / 驾驶（前后左右）</span>
          <span class="k">鼠标拖拽</span><span>自由转动视角（松开自动回正）</span>
          <span class="k">F</span><span>靠近车辆时 上车 / 下车</span>
          <span class="k">空格</span><span>手刹（漂移）</span>
          <span class="k">Shift</span><span>步行奔跑</span>
          <span class="k">B</span><span>切换电台　<b>M</b> 静音</span>
          <span class="k">H</span><span>打开 / 关闭本帮助</span>
          <span class="k">Tab</span><span>切换 昼 / 夜</span>
        </div>
        <div class="hint">按 H 或点击任意处关闭 · 新手引导会自动进行</div>
      </div>`;
    document.body.appendChild(hud);

    el = {
      map: document.getElementById('minimap'),
      mission: document.getElementById('missionText'),
      spd: document.getElementById('spd'),
      spdbar: document.getElementById('spdbar'),
      station: document.getElementById('station'),
      toast: document.getElementById('toast'),
      vignette: document.getElementById('vignette'),
      help: document.getElementById('help')
    };
    el.ctx = el.map.getContext('2d');
    el.station.textContent = window.AudioEngine.stationName();
    drawStatic();
  }

  function w2m(x, z) { return { x: mapSize / 2 + x * scale, y: mapSize / 2 + z * scale }; }

  function drawStatic() {
    const g = el.ctx; g.clearRect(0, 0, mapSize, mapSize);
    // 水面
    const w = w2m(city.CFG.waterX, -260); const w2 = w2m(900, 260);
    g.fillStyle = 'rgba(40,120,160,.55)'; g.fillRect(w.x, w.y, w2.x - w.x, w2.y - w.y);
    // 道路
    g.strokeStyle = 'rgba(150,160,175,.55)'; g.lineWidth = Math.max(2, city.CFG.road * scale * 0.5);
    city.roadLines.forEach((r) => { const a = w2m(r.x1, r.z1), b = w2m(r.x2, r.z2); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
    // 建筑
    city.buildings.forEach((b) => {
      if (b.water) return;
      const c = w2m(b.cx - b.w / 2, b.cz - b.d / 2);
      g.fillStyle = '#' + b.col.toString(16).padStart(6, '0');
      g.fillRect(c.x, c.y, b.w * scale, b.d * scale);
    });
  }

  function update(s) {
    // 速度
    const kmh = Math.round(Math.abs(s.speed) * 3.6);
    el.spd.textContent = kmh;
    el.spdbar.style.width = Math.min(100, kmh / 1.2) + '%';

    // 动态层
    const g = el.ctx;
    drawStatic();
    // GPS 路径
    if (s.gpsPath && s.gpsPath.length) {
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath();
      s.gpsPath.forEach((p, i) => { const m = w2m(p.x, p.z); if (i === 0) g.moveTo(m.x, m.y); else g.lineTo(m.x, m.y); });
      g.stroke(); g.setLineDash([]);
    }
    // 目标
    if (s.target) {
      const m = w2m(s.target.x, s.target.z);
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(m.x, m.y, 5, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // 玩家
    const p = w2m(s.player.x, s.player.z);
    const ang = s.heading;
    g.save(); g.translate(p.x, p.y); g.rotate(-ang);
    g.fillStyle = s.mode === 'driving' ? '#3df0ff' : '#7CFF6C';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
  }

  function setMission(t) { el.mission.textContent = t; }
  function setStation(n) { el.station.textContent = n; }
  let toastTimer = null;
  function toast(t, dur) {
    el.toast.textContent = t; el.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), dur || 2600);
  }
  function flash(i) {
    el.vignette.style.boxShadow = `inset 0 0 200px 50px rgba(255,30,30,${(0.25 + i * 0.4).toFixed(2)})`;
    setTimeout(() => { el.vignette.style.boxShadow = 'inset 0 0 200px 40px rgba(255,0,0,0)'; }, 140);
  }
  function showHelp(b) { el.help.style.display = b ? 'flex' : 'none'; }

  return { init, update, setMission, setStation, toast, flash, showHelp };
})();
