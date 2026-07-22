/* ============================================================
   Models : 声明式零件 JSON 建模 + SVG 车削(Lathe)/挤出(Extrude)
   规则：
     - 不手写顶点；仅用 Box/Cylinder/Sphere/Lathe/Extrude
     - 强制左右对称（mirror 自动镜像 x 与绕 Y/Z 旋转）
     - 尺寸吸附统一栅格（GRID）
   ============================================================ */
window.Models = (function () {
  const GRID = 0.05; // 统一吸附栅格（米）
  function snap(v) { return Math.round(v / GRID) * GRID; }

  function mat(def) {
    def = def || {};
    const p = {};
    if (def.color !== undefined) p.color = new THREE.Color(def.color);
    if (def.map) {
      const base = Tex.get(def.map) || Tex.store[def.map];
      if (base) {
        const t = base.clone();
        t.needsUpdate = true;
        if (def.repeat) t.repeat.set(def.repeat[0], def.repeat[1]);
        p.map = t;
      }
    }
    if (def.emissive !== undefined) p.emissive = new THREE.Color(def.emissive);
    if (def.emissiveIntensity !== undefined) p.emissiveIntensity = def.emissiveIntensity;
    if (def.metalness !== undefined) p.metalness = def.metalness;
    if (def.roughness !== undefined) p.roughness = def.roughness;
    if (def.transparent) p.transparent = true;
    if (def.opacity !== undefined) p.opacity = def.opacity;
    if (def.side) p.side = def.side;
    if (def.flatShading) p.flatShading = true;
    return new THREE.MeshStandardMaterial(p);
  }

  // 单个零件 -> Mesh
  function part(def) {
    let geo;
    const d = def;
    if (d.type === 'box') geo = new THREE.BoxGeometry(d.size[0], d.size[1], d.size[2]);
    else if (d.type === 'cyl') geo = new THREE.CylinderGeometry(d.r != null ? d.r : d.size[0], d.r2 != null ? d.r2 : (d.r != null ? d.r : d.size[0]), d.h != null ? d.h : d.size[1], d.seg || 18);
    else if (d.type === 'sphere') geo = new THREE.SphereGeometry(d.r || d.size[0], d.seg || 18, d.seg || 14);
    else if (d.type === 'lathe') geo = new THREE.LatheGeometry(d.points.map((q) => new THREE.Vector2(q[0], q[1])), d.seg || 22);
    else if (d.type === 'extrude') geo = new THREE.ExtrudeGeometry(d.shape, d.opts || { depth: d.depth || 1, bevelEnabled: false, steps: 1 });
    else throw new Error('unknown part type ' + d.type);

    const m = new THREE.Mesh(geo, mat(d.mat));
    if (d.pos) m.position.set(snap(d.pos[0]), snap(d.pos[1]), snap(d.pos[2]));
    if (d.rot) m.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
    if (d.castShadow) m.castShadow = true;
    if (d.receiveShadow) m.receiveShadow = true;
    m.userData.part = d;
    return m;
  }

  // 左右镜像一个零件定义（x 取反，绕 Y、Z 旋转取反）
  function mirror(d) {
    const m = JSON.parse(JSON.stringify(d));
    if (m.pos) m.pos[0] = -m.pos[0];
    if (m.rot) { m.rot[1] = -m.rot[1]; m.rot[2] = -m.rot[2]; }
    // 挤出件沿 X 镜像需翻转
    if (m.type === 'extrude' && m.shape) m.shape = m.shape.clone().scale(-1, 1);
    return m;
  }

  // 由零件数组构建一个 Group（含可选对称）
  function build(parts, group) {
    group = group || new THREE.Group();
    parts.forEach((d) => {
      const meshes = [part(d)];
      if (d.mirror) meshes.push(part(mirror(d)));
      meshes.forEach((m) => group.add(m));
    });
    return group;
  }

  // ---- 车轮：轮胎用车削(lathe)生成环形截面，轮毂用圆柱 ----
  function buildWheel(paintMat) {
    const g = new THREE.Group();
    // 轮胎截面（绕 Y 轴车削 -> 环面管）
    const tire = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(0.30, -0.13), new THREE.Vector2(0.43, -0.13),
        new THREE.Vector2(0.45, 0), new THREE.Vector2(0.43, 0.13),
        new THREE.Vector2(0.30, 0.13), new THREE.Vector2(0.30, -0.13)
      ], 24),
      mat({ color: 0x0d0d10, roughness: 0.9, metalness: 0.0 })
    );
    // 轮毂
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.26, 18),
      mat({ color: 0xbfc4cc, metalness: 0.9, roughness: 0.3 })
    );
    rim.rotation.z = Math.PI / 2; // 轴转到 X
    // 轮辐（几条细盒，对称）
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), mat({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.4 }));
      sp.rotation.x = (i / 5) * Math.PI * 2;
      rim.add(sp);
    }
    g.add(tire); g.add(rim);
    g.userData.spin = rim; // 旋转轮毂表示转动
    return g;
  }

  // ---- 整车（声明式 JSON，强制对称） ----
  // 朝向：+Z 为车头；+X 右；+Y 上
  function buildCar(opts) {
    opts = opts || {};
    const paint = opts.paint || 'paintRed';
    const PM = { map: paint, metalness: 0.55, roughness: 0.35, color: 0xffffff };
    const GLASS = { color: 0x0a0f14, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55 };
    const DARK = { color: 0x14141a, roughness: 0.7, metalness: 0.1 };
    const CHROME = { color: 0xcfd4da, metalness: 0.95, roughness: 0.25 };

    const car = new THREE.Group();
    const wheels = [];
    const frontPivots = [];

    // —— 车身下部 ——
    car.add(part({ type: 'box', size: [1.9, 0.5, 4.1], pos: [0, 0.52, 0], mat: PM, castShadow: true, receiveShadow: true }));
    // 引擎盖斜面
    car.add(part({ type: 'box', size: [1.78, 0.22, 1.3], pos: [0, 0.86, 1.45], mat: PM, castShadow: true }));
    // 后备箱
    car.add(part({ type: 'box', size: [1.8, 0.22, 0.95], pos: [0, 0.86, -1.5], mat: PM, castShadow: true }));
    // 座舱玻璃罩
    car.add(part({ type: 'box', size: [1.6, 0.52, 1.7], pos: [0, 1.18, -0.15], mat: GLASS }));
    // 车顶
    car.add(part({ type: 'box', size: [1.5, 0.1, 1.45], pos: [0, 1.5, -0.2], mat: PM, castShadow: true }));
    // 行李架/装饰条
    car.add(part({ type: 'box', size: [0.08, 0.06, 1.3], pos: [0.7, 1.56, -0.2], mat: CHROME, mirror: true }));
    // 前杠
    car.add(part({ type: 'box', size: [1.9, 0.32, 0.3], pos: [0, 0.5, 2.12], mat: DARK }));
    car.add(part({ type: 'box', size: [1.9, 0.32, 0.3], pos: [0, 0.5, -2.12], mat: DARK }));
    // 前大灯（自发光）
    car.add(part({ type: 'box', size: [0.34, 0.16, 0.08], pos: [0.62, 0.78, 2.18], mat: { color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.4 }, mirror: true }));
    // 尾灯
    car.add(part({ type: 'box', size: [0.4, 0.16, 0.08], pos: [0.6, 0.8, -2.18], mat: { color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1.2 }, mirror: true }));
    // 侧后视镜
    car.add(part({ type: 'box', size: [0.16, 0.1, 0.22], pos: [0.98, 1.12, 0.55], mat: DARK, mirror: true }));
    // 尾翼
    car.add(part({ type: 'box', size: [1.7, 0.06, 0.42], pos: [0, 1.18, -2.05], mat: CHROME, castShadow: true }));
    car.add(part({ type: 'box', size: [0.06, 0.22, 0.06], pos: [0.7, 1.05, -2.0], mat: DARK, mirror: true }));
    // 排气管（车削）
    car.add(part({ type: 'lathe', points: [[0.05, -0.04], [0.07, -0.04], [0.07, 0.04], [0.05, 0.04], [0.05, -0.04]], seg: 14, pos: [0.45, 0.34, -2.2], rot: [0, 0, Math.PI / 2], mat: CHROME, mirror: true }));

    // —— 车轮（4 个，前轮可转向）——
    const wx = 0.98, wy = 0.42, wz = 1.4;
    const positions = [[wx, wz, true], [-wx, wz, true], [wx, -wz, false], [-wx, -wz, false]];
    positions.forEach((pp) => {
      const pivot = new THREE.Group();
      pivot.position.set(snap(pp[0]), snap(wy), snap(pp[1]));
      const w = buildWheel();
      pivot.add(w);
      if (pp[2]) { pivot.userData.steer = true; frontPivots.push(pivot); }
      car.add(pivot);
      wheels.push(w);
    });

    car.userData = { wheels, frontPivots, paint: PM.map };
    return car;
  }

  // ---- 行人角色（声明式零件，对称） ----
  function buildCharacter() {
    const col = { skin: 0xe0a884, shirt: 0x2f7d9a, pants: 0x23252b, shoe: 0x15151a };
    const g = new THREE.Group();
    const head = part({ type: 'sphere', r: 0.16, pos: [0, 1.62, 0], mat: { color: col.skin, roughness: 0.8 } });
    const torso = part({ type: 'box', size: [0.42, 0.6, 0.26], pos: [0, 1.18, 0], mat: { color: col.shirt, roughness: 0.7 } });
    const hips = part({ type: 'box', size: [0.4, 0.22, 0.24], pos: [0, 0.82, 0], mat: { color: col.pants, roughness: 0.8 } });
    g.add(head); g.add(torso); g.add(hips);
    // 四肢（用 pivot 便于动画）
    function limb(x, y, z, size, color) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const m = part({ type: 'box', size, pos: [0, -size[1] / 2, 0], mat: { color, roughness: 0.8 } });
      pivot.add(m); pivot.userData.limb = m; return pivot;
    }
    const armL = limb(0.27, 1.45, 0, [0.12, 0.55, 0.12], col.shirt);
    const armR = limb(-0.27, 1.45, 0, [0.12, 0.55, 0.12], col.shirt);
    const legL = limb(0.11, 0.82, 0, [0.15, 0.8, 0.16], col.pants);
    const legR = limb(-0.11, 0.82, 0, [0.15, 0.8, 0.16], col.pants);
    g.add(armL); g.add(armR); g.add(legL); g.add(legR);
    // 鞋
    legL.add(part({ type: 'box', size: [0.17, 0.1, 0.28], pos: [0, -0.82, 0.05], mat: { color: col.shoe } }));
    legR.add(part({ type: 'box', size: [0.17, 0.1, 0.28], pos: [0, -0.82, 0.05], mat: { color: col.shoe } }));
    g.userData = { armL, armR, legL, legR, head };
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---- 由 SVG path 构造 THREE.Shape（供挤出使用） ----
  function shapeFromPath(d) {
    const s = new THREE.Shape();
    const tk = d.match(/[a-zA-Z]|-?[\d.]+/g) || [];
    let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    function num() { return parseFloat(tk[i++]); }
    while (i < tk.length) {
      const c = tk[i++];
      if (c === 'M') { cx = num(); cy = num(); s.moveTo(cx, cy); sx = cx; sy = cy; }
      else if (c === 'L') { cx = num(); cy = num(); s.lineTo(cx, cy); }
      else if (c === 'H') { cx = num(); s.lineTo(cx, cy); }
      else if (c === 'V') { cy = num(); s.lineTo(cx, cy); }
      else if (c === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num(); s.bezierCurveTo(x1, y1, x2, y2, x, y); cx = x; cy = y; }
      else if (c === 'Q') { const x1 = num(), y1 = num(), x = num(), y = num(); s.quadraticCurveTo(x1, y1, x, y); cx = x; cy = y; }
      else if (c === 'Z' || c === 'z') { s.lineTo(sx, sy); }
      else { i++; } // 跳过无法识别
    }
    return s;
  }

  return { snap, mat, part, mirror, build, buildWheel, buildCar, buildCharacter, shapeFromPath, GRID };
})();
