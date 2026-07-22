// 无头自检：加载 index.html，捕获控制台/页面错误，点击开始，截图
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const url = 'file://' + path.resolve(__dirname, 'index.html');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--window-size=1280,720'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  const logs = [];
  page.on('console', (m) => { logs.push('[' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => { errors.push('PAGEERROR: ' + e.message); });
  page.on('requestfailed', (r) => { errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)); });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3500)); // 等待贴图预加载 + 建城

  // 点击开始（初始化音频并尝试进入）
  try { await page.evaluate(() => { const s = document.getElementById('start'); if (s) s.click(); }); } catch (e) {}
  await new Promise(r => setTimeout(r, 2500));

  // 模拟走两步 + 上车
  await page.keyboard.down('KeyW'); await new Promise(r => setTimeout(r, 600)); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.down('KeyW'); await new Promise(r => setTimeout(r, 1200)); await page.keyboard.up('KeyW');

  await page.screenshot({ path: path.resolve(__dirname, 'shot.png') });

  // 收集诊断信息
  const diag = await page.evaluate(() => {
    return {
      hasTHREE: typeof THREE !== 'undefined',
      canvas: !!document.getElementById('game'),
      loadingHidden: document.getElementById('loading') ? document.getElementById('loading').style.display : 'none',
      startHidden: document.getElementById('start') ? document.getElementById('start').style.display : 'gone',
      minimap: !!document.getElementById('minimap')
    };
  });

  console.log('=== DIAG ===');
  console.log(JSON.stringify(diag, null, 2));
  console.log('=== ERRORS (' + errors.length + ') ===');
  errors.forEach(e => console.log(e));
  console.log('=== LOGS (last 20) ===');
  logs.slice(-20).forEach(l => console.log(l));

  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('HARNESS FAIL:', e); process.exit(2); });
