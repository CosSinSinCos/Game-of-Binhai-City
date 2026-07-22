/* ============================================================
   City : 程序化规则铺设的「滨湾市」——道路网格 / 街区 / 路牙 /
          斑马线 / 护栏 / 建筑 / 海湾码头 / 路灯霓虹
   产出：世界静态网格 + 碰撞盒 + 小地图数据 + 出生点 / 码头点
   ============================================================ */
window.City = (function () {
  const R = (seed) => { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  const CFG = { cell: 84, road: 16, gx: 5, gz: 5, waterX: 196 };

  // 小地图/夜间用全局引用
  let G = null;        // 当前城市 Group
  let NEON = [];       // 霓虹/灯牌 mesh（夜间脉动）

  function build(scene) {
    const rnd = R(20240722);
    G = new THREE.Group(); scene.add(G); NEON = [];

    const colliders = [];     // {minX,maxX,minZ,maxZ,top,road?,water?}
    const buildings = [];     // 小地图：{cx,cz,w,d,h,col,water?}
    const roadLines = [];     // 小地图道路线段
    const nightLights = [];   // PointLight（夜间开启）

    const roadR = CFG.road / 2;
    const xs = [], zs = [];
    for (let i = 0; i < CFG.gx; i++) xs.push((i - (CFG.gx - 1) / 2) * CFG.cell);
    for (let j = 0; j < CFG.gz; j++) zs.push((j - (CFG.gz - 1) / 2) * CFG.cell);
    const spanX = xs[xs.length - 1] + CFG.cell / 2 + 40;
    const spanZ = zs[zs.length - 1] + CFG.cell / 2 + 40;

    // ---------- 基础地面 ----------
    const groundTex = Tex.get('asphalt').clone(); groundTex.repeat.set(spanX / 16, spanZ / 16);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX * 2, spanZ * 2),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.0; ground.receiveShadow = true; G.add(ground);

    // ---------- 道路网格 ----------
    const roadMat = Models.mat({ map: 'asphalt', roughness: 0.92, color: 0xffffff });
    function roadStrip(x1, z1, x2, z2) {
      const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
      const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
      const geo = new THREE.BoxGeometry(horiz ? len : CFG.road, 0.06, horiz ? CFG.road : len);
      const m = new THREE.Mesh(geo, roadMat); m.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2); m.receiveShadow = true; G.add(m);
      const dash = 3, gap = 3;
      for (let p = -len / 2 + 2; p < len / 2; p += dash + gap) {
        const dl = new THREE.Mesh(new THREE.BoxGeometry(horiz ? dash : 0.3, 0.02, horiz ? 0.3 : dash),
          new THREE.MeshStandardMaterial({ color: 0xf2c200, emissive: 0x4a3a00, roughness: 0.6 }));
        dl.position.set(horiz ? (x1 + x2) / 2 + p : (x1 + x2) / 2, 0.075, horiz ? (z1 + z2) / 2 : (z1 + z2) / 2 + p);
        G.add(dl);
      }
    }
    xs.forEach((x) => { roadStrip(x, zs[0] - CFG.cell / 2, x, zs[zs.length - 1] + CFG.cell / 2); roadLines.push({ x1: x, z1: zs[0] - CFG.cell / 2, x2: x, z2: zs[zs.length - 1] + CFG.cell / 2 }); });
    zs.forEach((z) => { roadStrip(xs[0] - CFG.cell / 2, z, xs[xs.length - 1] + CFG.cell / 2, z); roadLines.push({ x1: xs[0] - CFG.cell / 2, z1: z, x2: xs[xs.length - 1] + CFG.cell / 2, z2: z }); });

    function curb(x, z, w, d) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), Models.mat({ color: 0x9a9aa2, roughness: 0.85 }));
      g.position.set(x, 0.09, z); g.receiveShadow = true; G.add(g);
    }

    // ---------- 街区 ----------
    const sideMat = Models.mat({ map: 'sidewalk', roughness: 0.9, color: 0xffffff });
    const glassMats = ['glassBlue', 'glassTeal', 'glassDark'];
    const brickMats = ['brickA', 'brickB'];

    for (let i = 0; i < CFG.gx - 1; i++) {
      for (let j = 0; j < CFG.gz - 1; j++) {
        const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
        const bw = CFG.cell - CFG.road - 6, bd = CFG.cell - CFG.road - 6;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, bd), sideMat);
        slab.position.set(cx, 0.06, cz); slab.receiveShadow = true; G.add(slab);
        curb(cx - bw / 2, cz, 1.0, bd); curb(cx + bw / 2, cz, 1.0, bd);
        curb(cx, cz - bd / 2, bw, 1.0); curb(cx, cz + bd / 2, bw, 1.0);

        const n = 1 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
        const sub = Math.sqrt(n);
        const fw = bw / (sub + 0.4), fd = bd / (sub + 0.4);
        for (let b = 0; b < n; b++) {
          const ox = (b % 2 === 0 ? -1 : 1) * (n > 1 ? fw * 0.45 : 0);
          const oz = (b < 2 ? -1 : 1) * (n > 1 ? fd * 0.45 : 0);
          const w = fw * (0.7 + rnd() * 0.25), d = fd * (0.7 + rnd() * 0.25);
          const h = 12 + rnd() * 52;
          const isGlass = rnd() < 0.55;
          const texName = isGlass ? glassMats[(rnd() * glassMats.length) | 0] : brickMats[(rnd() * brickMats.length) | 0];
          const btex = Tex.get(texName).clone(); btex.repeat.set(Math.max(2, Math.round(w / 6)), Math.max(2, Math.round(h / 8)));
          const bmat = new THREE.MeshStandardMaterial({ map: btex, roughness: isGlass ? 0.25 : 0.85, metalness: isGlass ? 0.4 : 0.05 });
          const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
          bld.position.set(cx + ox, h / 2 + 0.12, cz + oz); bld.castShadow = true; bld.receiveShadow = true; G.add(bld);
          if (rnd() < 0.6) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 3, d * 0.4), Models.mat({ color: 0x55585f, roughness: 0.8 }));
            cap.position.set(cx + ox, h + 0.12 + 1.5, cz + oz); cap.castShadow = true; G.add(cap);
          }
          const minX = cx + ox - w / 2, maxX = cx + ox + w / 2, minZ = cz + oz - d / 2, maxZ = cz + oz + d / 2;
          colliders.push({ minX, maxX, minZ, maxZ, top: h + 0.12 });
          buildings.push({ cx: cx + ox, cz: cz + oz, w, d, h: h + 0.12, col: isGlass ? 0x2f5d7a : 0x6a4a3a });
          if (isGlass && rnd() < 0.5) {
            addNeonBillboard(cx + ox, h * 0.6 + 0.12, cz + oz + d / 2 + 0.3, w * 0.8, 6,
              ['滨湾', 'BAY', '海鲜', '霓虹', '夜未央', '潮'][(rnd() * 6) | 0],
              ['#ff3df0', '#3df0ff', '#ffd23f', '#6cff5a'][(rnd() * 4) | 0]);
          }
        }
        const trees = 1 + ((rnd() * 3) | 0);
        for (let t = 0; t < trees; t++) addTree(cx + (rnd() - 0.5) * bw * 0.7, cz + (rnd() - 0.5) * bd * 0.7);
      }
    }

    // ---------- 斑马线 ----------
    function zebra(x, z, dir) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (CFG.road / n);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(dir === 'h' ? 0.7 : 4, 0.03, dir === 'h' ? 4 : 0.7),
          new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7, emissive: 0x222222 }));
        stripe.position.set(dir === 'h' ? x + off : x, 0.08, dir === 'h' ? z : z + off); G.add(stripe);
      }
    }
    for (let k = 0; k < xs.length; k += 2) for (let m = 0; m < zs.length; m += 2) { zebra(xs[k], zs[m], 'h'); zebra(xs[k], zs[m], 'v'); }

    // ---------- 护栏 ----------
    function guardrail(x, z, len, horiz) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.2, 0.8, horiz ? 0.2 : len), Models.mat({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.4 }));
      g.position.set(x, 0.5, z); G.add(g);
    }
    for (let k = 1; k < xs.length - 1; k += 2) guardrail(xs[k] - CFG.road / 2 - 1, 0, spanZ, false);

    // ---------- 交通标志 ----------
    const signDefs = ['signStop', 'signYield', 'signLimit', 'signArrow', 'signPark'];
    xs.forEach((x, ki) => { if (ki % 2 === 0) addSign(signDefs[(rnd() * signDefs.length) | 0], x + CFG.road / 2 + 1.5, zs[0]); });
    zs.forEach((z, zi) => { if (zi % 2 === 0) addSign(signDefs[(rnd() * signDefs.length) | 0], xs[0], z + CFG.road / 2 + 1.5); });

    // ---------- 路灯 ----------
    function streetlight(x, z) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 10), Models.mat({ color: 0x3a3d44, metalness: 0.5, roughness: 0.6 }));
      pole.position.set(x, 3, z); pole.castShadow = true; G.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffe08a, emissiveIntensity: 1.6 }));
      head.position.set(x, 6, z); G.add(head); NEON.push(head);
      if (nightLights.length < 18) { const pl = new THREE.PointLight(0xffd9a0, 0.0, 26, 2); pl.position.set(x, 5.6, z); scene.add(pl); nightLights.push(pl); }
    }
    xs.forEach((x) => zs.forEach((z) => { if (rnd() < 0.4) streetlight(x + CFG.road / 2 + 1, z - CFG.road / 2 - 1); }));

    // ---------- 海湾码头 ----------
    const dock = buildBay(rnd);
    buildings.push({ cx: dock.cx, cz: dock.cz, w: 30, d: 30, h: 2, col: 0x1f6f8f, water: true });

    // ---------- 边界墙 ----------
    const wall = 20;
    colliders.push({ minX: -spanX - wall, maxX: -spanX, minZ: -spanZ - wall, maxZ: spanZ + wall, top: 6 });
    colliders.push({ minX: spanX, maxX: spanX + wall, minZ: -spanZ - wall, maxZ: spanZ + wall, top: 6 });
    colliders.push({ minX: -spanX, maxX: spanX, minZ: -spanZ - wall, maxZ: -spanZ, top: 6 });
    colliders.push({ minX: -spanX, maxX: spanX, minZ: spanZ, maxZ: spanZ + wall, top: 6 });

    return {
      group: G, colliders, buildings, roadLines, nightLights, neon: NEON,
      spawn: new THREE.Vector3(0, 0, 0),
      dock: new THREE.Vector3(dock.cx, 0, dock.cz),
      bounds: { spanX, spanZ }, CFG
    };
  }

  // ---- 海湾码头 ----
  function buildBay(rnd) {
    const waterX = CFG.waterX;
    const wtex = Tex.get('water').clone(); wtex.repeat.set(40, 20);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 500),
      new THREE.MeshStandardMaterial({ map: wtex, transparent: true, opacity: 0.92, roughness: 0.2, metalness: 0.5, color: 0x2a6b8f }));
    water.rotation.x = -Math.PI / 2; water.position.set(waterX + 420, 0.02, 0); G.add(water);

    const prom = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 520), Models.mat({ map: 'sidewalk', roughness: 0.9 }));
    prom.position.set(waterX - 7, 0.06, 0); prom.receiveShadow = true; G.add(prom);

    for (let p = -1; p <= 1; p++) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 10), Models.mat({ color: 0x6b4f3a, roughness: 0.9 }));
      pier.position.set(waterX + 30, 0.18, p * 40); pier.receiveShadow = true; G.add(pier);
      for (let s = 0; s < 4; s++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), Models.mat({ color: 0x4a3526 }));
        post.position.set(waterX + 10 + s * 16, -1.2, p * 40 + 4); G.add(post);
      }
    }
    const contMats = ['contA', 'contB', 'contC'];
    for (let c = 0; c < 14; c++) {
      const t = contMats[(rnd() * 3) | 0];
      const ct = Tex.get(t).clone(); ct.repeat.set(2, 1);
      const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7, metalness: 0.2 }));
      const stack = (rnd() < 0.4) ? 1 : 0;
      box.position.set(waterX + 2 + (rnd() - 0.5) * 20 + (c % 5) * 7, 1.3 + stack * 2.6, -60 + (c * 18) % 180);
      box.rotation.y = (rnd() - 0.5) * 0.3; box.castShadow = true; box.receiveShadow = true; G.add(box);
    }
    // 岸桥吊机（箱体支腿 + 主梁，对称）
    const crane = new THREE.Group();
    const legMat = Models.mat({ color: 0xd8a32a, metalness: 0.5, roughness: 0.5 });
    [-9, 9].forEach((lx) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), legMat); leg.position.set(lx, 17, 0); leg.castShadow = true; crane.add(leg); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 1.6), legMat); beam.position.set(0, 34, 0); beam.castShadow = true; crane.add(beam);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(46, 1.0, 1.0), legMat); arm2.position.set(-10, 33, 0); arm2.castShadow = true; crane.add(arm2);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(46, 1.0, 1.0), legMat); arm.position.set(10, 33, 0); arm.castShadow = true; crane.add(arm);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), Models.mat({ color: 0x222222, metalness: 0.3 }));
    cab.position.set(14, 31, 0); crane.add(cab);
    crane.position.set(waterX + 6, 0, 90); G.add(crane);

    addNeonBillboard(waterX - 4, 5, 0, 18, 5, '滨湾港', '#3df0ff');

    return { cx: waterX - 7, cz: 0, waterX };
  }

  // ---- 树 ----
  function addTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), Models.mat({ color: 0x5a3d28, roughness: 0.9 }));
    trunk.position.y = 1.1; trunk.castShadow = true; g.add(trunk);
    const foliMat = Models.mat({ color: 0x2f7d3a, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 - i * 0.25, 0), foliMat); f.position.y = 2.4 + i * 0.7; f.castShadow = true; g.add(f); }
    g.position.set(x, 0.12, z); G.add(g);
  }

  // ---- 交通标志 ----
  function addSign(name, x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), Models.mat({ color: 0x444444, metalness: 0.4 }));
    pole.position.set(x, 1.5, z); G.add(pole);
    const tex = Tex.get(name);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    sign.position.set(x, 3, z + 0.05); sign.rotation.y = Math.PI; G.add(sign);
  }

  // ---- 霓虹招牌（自发光，异步加载 SVG） ----
  function addNeonBillboard(x, y, z, w, h, text, color) {
    const matl = new THREE.MeshBasicMaterial({ color: 0x111118, side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matl);
    board.position.set(x, y, z); G.add(board);
    Tex.loadSVG(SVGArt.neon(text, color), 512, 256, (t) => { matl.map = t; matl.color.set(0xffffff); matl.needsUpdate = true; NEON.push(board); });
  }

  return { build };
})();
