/* ============================================================
   SVGArt : 全部 2D 美术（贴图/招牌/标志）均由 SVG 程序化生成
   每个函数返回一段 SVG 字符串，由 textures.js 转成 CanvasTexture
   ============================================================ */
window.SVGArt = (function () {
  // 可重复的伪随机数（保证每次生成一致，便于 DEBUG）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = (seed) => mulberry32(seed >>> 0);

  // ---------- 沥青（道路） ----------
  function asphalt(seed) {
    const S = 512, r = R(seed || 11);
    let specks = '';
    for (let i = 0; i < 1700; i++) {
      const x = (r() * S) | 0, y = (r() * S) | 0, s = (r() * 3 + 0.6) | 0;
      const g = 28 + ((r() * 38) | 0);
      specks += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="rgb(${g},${g},${g + 5})" opacity="${(0.12 + r() * 0.28).toFixed(2)}"/>`;
    }
    let cracks = '';
    for (let i = 0; i < 9; i++) {
      let x = r() * S, y = r() * S, d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
      for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 130; y += (r() - 0.5) * 130; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; }
      cracks += `<path d="${d}" stroke="#19191d" stroke-width="${(0.5 + r()).toFixed(1)}" fill="none" opacity="0.55"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <rect width="${S}" height="${S}" fill="#34343c"/>
      <rect width="${S}" height="${S}" fill="#2b2b32"/>
      ${specks}${cracks}</svg>`;
  }

  // ---------- 人行道 / 广场铺装 ----------
  function sidewalk(seed) {
    const S = 256, r = R(seed || 3);
    let tiles = '';
    const n = 8, step = S / n;
    for (let i = 0; i <= n; i++) {
      tiles += `<line x1="0" y1="${i * step}" x2="${S}" y2="${i * step}" stroke="#8a8a90" stroke-width="2"/>`;
      tiles += `<line x1="${i * step}" y1="0" x2="${i * step}" y2="${S}" stroke="#8a8a90" stroke-width="2"/>`;
    }
    let dirt = '';
    for (let i = 0; i < 200; i++) { const x = r() * S, y = r() * S; dirt += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r() * 1.6).toFixed(1)}" fill="#71717a" opacity="0.4"/>`; }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <rect width="${S}" height="${S}" fill="#b9b9c0"/>${dirt}${tiles}</svg>`;
  }

  // ---------- 砖墙 ----------
  function brick(seed, base) {
    base = base || '#8a4b3a';
    const S = 256, r = R(seed || 5), cols = 8, rows = 16, cw = S / cols, ch = S / rows;
    let out = `<rect width="${S}" height="${S}" fill="${base}"/>`;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * (cw / 2);
      for (let x = -1; x < cols; x++) {
        const bx = x * cw + off, by = y * ch;
        const shade = 0.82 + r() * 0.3;
        out += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" fill="${base}" filter="brightness(${shade.toFixed(2)})" opacity="0.9"/>`;
        out += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" fill="none" stroke="#2c1812" stroke-width="1.5" opacity="0.5"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${out}</svg>`;
  }

  // ---------- 玻璃幕墙 ----------
  function glass(seed, tint) {
    tint = tint || '#3a6ea5';
    const S = 256, r = R(seed || 9);
    let out = `<rect width="${S}" height="${S}" fill="${tint}"/>`;
    const cols = 6, rows = 10, cw = S / cols, ch = S / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const bx = x * cw, by = y * ch;
      const sh = 0.6 + r() * 0.5;
      out += `<rect x="${bx + 1}" y="${by + 1}" width="${cw - 2}" height="${ch - 2}" fill="${tint}" filter="brightness(${sh.toFixed(2)})"/>`;
      out += `<rect x="${bx + 1}" y="${by + 1}" width="${cw - 2}" height="${ch - 2}" fill="none" stroke="#11161c" stroke-width="2"/>`;
    }
    // 反光斜条
    for (let i = 0; i < 4; i++) {
      const x = r() * S;
      out += `<polygon points="${x},0 ${x + 40},0 ${x - 40},${S} ${x - 80},${S}" fill="#ffffff" opacity="0.06"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${out}</svg>`;
  }

  // ---------- 车漆（含金属渐变 + 可选涂装条纹） ----------
  function carPaint(base, stripe) {
    base = base || '#c81e3a';
    const id = 'g' + ((Math.random() * 1e6) | 0);
    let extra = '';
    if (stripe) {
      extra = `<rect x="0" y="120" width="512" height="22" fill="${stripe}" opacity="0.95"/>
               <rect x="0" y="370" width="512" height="22" fill="${stripe}" opacity="0.95"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="0.25" stop-color="${base}" stop-opacity="1"/>
        <stop offset="0.6" stop-color="${base}" stop-opacity="1"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
      </linearGradient></defs>
      <rect width="512" height="512" fill="url(#${id})"/>${extra}</svg>`;
  }

  // ---------- 水面（海湾） ----------
  function water(seed) {
    const S = 256, r = R(seed || 21);
    let out = `<rect width="${S}" height="${S}" fill="#10405e"/>`;
    out += `<rect width="${S}" height="${S}" fill="#0c3349" opacity="0.6"/>`;
    for (let i = 0; i < 40; i++) {
      const y = r() * S, x = r() * S, w = 30 + r() * 80;
      out += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q ${w / 2} -6 ${w} 0" stroke="#5fb6d6" stroke-width="2" fill="none" opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${out}</svg>`;
  }

  // ---------- 集装箱贴图 ----------
  function container(seed, col) {
    col = col || '#c9742a';
    const S = 128;
    let out = `<rect width="${S}" height="${S}" fill="${col}"/>`;
    for (let i = 0; i < 6; i++) out += `<rect x="${i * (S / 6)}" y="0" width="${S / 6 - 3}" height="${S}" fill="none" stroke="#3a230f" stroke-width="3"/>`;
    out += `<rect x="0" y="0" width="${S}" height="${S}" fill="#000" opacity="0.12"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${out}</svg>`;
  }

  // ---------- 霓虹招牌（自发光面板） ----------
  function neon(text, col) {
    col = col || '#ff3df0';
    const W = 256, H = 128;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#0a0a12"/>
      <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="10" fill="none" stroke="${col}" stroke-width="4" filter="drop-shadow(0 0 6px ${col})"/>
      <text x="50%" y="56%" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="46" font-weight="900" fill="${col}" filter="drop-shadow(0 0 8px ${col})">${text}</text>
    </svg>`;
  }

  // ---------- 交通标志（原创图案，非现实标志） ----------
  function sign(kind) {
    const S = 128;
    const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">`;
    if (kind === 'stop') {
      // 八边形 红底白边 + 原创「停」符号
      let pts = '';
      for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; const x = 64 + 50 * Math.cos(a), y = 64 + 50 * Math.sin(a); pts += `${x.toFixed(1)},${y.toFixed(1)} `; }
      return base + `<polygon points="${pts}" fill="#d11f2d" stroke="#fff" stroke-width="6"/>
        <rect x="44" y="50" width="40" height="28" rx="4" fill="#fff"/>
        <line x1="50" y1="64" x2="78" y2="64" stroke="#d11f2d" stroke-width="6"/></svg>`;
    }
    if (kind === 'yield') {
      return base + `<polygon points="64,18 112,108 16,108" fill="#f2b705" stroke="#1a1a1a" stroke-width="6"/>
        <rect x="40" y="74" width="48" height="14" rx="3" fill="#1a1a1a"/></svg>`;
    }
    if (kind === 'limit') {
      return base + `<circle cx="64" cy="64" r="50" fill="#fff" stroke="#1a1a1a" stroke-width="6"/>
        <text x="64" y="80" text-anchor="middle" font-family="Arial Black, Arial" font-size="44" font-weight="900" fill="#1a1a1a">50</text></svg>`;
    }
    if (kind === 'arrow') {
      return base + `<circle cx="64" cy="64" r="50" fill="#15489c" stroke="#fff" stroke-width="6"/>
        <polygon points="64,34 84,64 64,94 44,64" fill="#fff"/>
        <polygon points="64,34 110,64 64,94 84,64" fill="#ffd23f"/></svg>`;
    }
    if (kind === 'parking') {
      return base + `<rect x="20" y="20" width="88" height="88" rx="8" fill="#1f8a4c" stroke="#fff" stroke-width="6"/>
        <text x="64" y="82" text-anchor="middle" font-family="Arial Black, Arial" font-size="50" font-weight="900" fill="#fff">P</text></svg>`;
    }
    return base + `<circle cx="64" cy="64" r="50" fill="#888" stroke="#fff" stroke-width="6"/></svg>`;
  }

  return { asphalt, sidewalk, brick, glass, carPaint, water, container, neon, sign };
})();
