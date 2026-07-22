/* ============================================================
   Tex : 把 SVG 字符串转成 THREE.CanvasTexture（异步预加载）
   ============================================================ */
window.Tex = (function () {
  const store = {};

  function loadSVG(svg, w, h, cb) {
    const img = new Image();
    img.onload = function () {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.encoding = THREE.sRGBEncoding;
      cb(t);
    };
    img.onerror = function () { console.warn('SVG 贴图加载失败'); cb(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // 预加载所有静态贴图，全部就绪后回调
  function preload(done) {
    const defs = {
      asphalt:   [() => SVGArt.asphalt(11), 512, 512],
      sidewalk:  [() => SVGArt.sidewalk(3), 256, 256],
      brickA:    [() => SVGArt.brick(5, '#8a4b3a'), 256, 256],
      brickB:    [() => SVGArt.brick(8, '#6f6f76'), 256, 256],
      glassBlue: [() => SVGArt.glass(9, '#3a6ea5'), 256, 256],
      glassTeal: [() => SVGArt.glass(13, '#2f8f8a'), 256, 256],
      glassDark: [() => SVGArt.glass(17, '#2a3340'), 256, 256],
      water:     [() => SVGArt.water(21), 256, 256],
      contA:     [() => SVGArt.container(2, '#c9742a'), 128, 128],
      contB:     [() => SVGArt.container(4, '#2f7d4f'), 128, 128],
      contC:     [() => SVGArt.container(6, '#9a3b3b'), 128, 128],
      // 车漆（多配色，含涂装条纹）
      paintRed:    [() => SVGArt.carPaint('#c81e3a', '#ffffff'), 512, 512],
      paintBlue:   [() => SVGArt.carPaint('#1f5fbf', '#ffd23f'), 512, 512],
      paintYellow: [() => SVGArt.carPaint('#f2c029', '#1a1a1a'), 512, 512],
      paintBlack:  [() => SVGArt.carPaint('#1a1a1d', null), 512, 512],
      paintGreen:  [() => SVGArt.carPaint('#1f8a4c', null), 512, 512],
      paintOrange: [() => SVGArt.carPaint('#e2682a', '#101010'), 512, 512],
      // 交通标志
      signStop:    [() => SVGArt.sign('stop'), 128, 128],
      signYield:   [() => SVGArt.sign('yield'), 128, 128],
      signLimit:   [() => SVGArt.sign('limit'), 128, 128],
      signArrow:   [() => SVGArt.sign('arrow'), 128, 128],
      signPark:    [() => SVGArt.sign('parking'), 128, 128]
    };
    const keys = Object.keys(defs);
    let loaded = 0;
    const result = {};
    keys.forEach((k) => {
      const [gen, w, h] = defs[k];
      loadSVG(gen(), w, h, (t) => {
        result[k] = t;
        store[k] = t;            // 写入运行期缓存，供 Tex.get() 取用
        loaded++;
        if (loaded === keys.length) done(result);
      });
    });
  }

  function get(name) { return store[name]; }

  // 运行时保存（如按车辆颜色生成的车漆）
  function put(name, tex) { store[name] = tex; }

  // 生成可调用的车漆贴图（按色号缓存）
  function carPaint(name, base, stripe) {
    if (store[name]) return store[name];
    let t = null;
    loadSVG(SVGArt.carPaint(base, stripe), 512, 512, (tex) => { store[name] = tex; });
    return null; // 异步；稍后从 store 取
  }

  return { preload, get, put, carPaint, loadSVG, store };
})();
