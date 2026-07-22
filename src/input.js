/* ============================================================
   Input : 键盘 + 鼠标（拖拽自由看视角，带衰减回正）
   ============================================================ */
window.Input = (function () {
  const keys = {};
  const edge = {};            // 单次触发
  const mouse = { down: false, dx: 0, dy: 0, x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true;
    // 阻止方向键/空格滚动页面
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const canvas = () => document.getElementById('game');
  window.addEventListener('mousedown', (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('mousemove', (e) => {
    if (mouse.down) { mouse.dx += e.clientX - mouse.x; mouse.dy += e.clientY - mouse.y; mouse.x = e.clientX; mouse.y = e.clientY; }
  });
  // 触屏简易支持
  window.addEventListener('touchstart', () => { mouse.down = true; }, { passive: true });
  window.addEventListener('touchend', () => { mouse.down = false; });

  return {
    keys,
    isDown: (c) => !!keys[c],
    // 消费一次性按键
    hit: (c) => { if (edge[c]) { edge[c] = false; return true; } return false; },
    mouse,
    // 每帧末尾清空鼠标位移增量
    endFrame() { mouse.dx = 0; mouse.dy = 0; for (const k in edge) edge[k] = false; }
  };
})();
