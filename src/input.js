/* ============================================================
   Input : 键盘 + 鼠标 + 触摸（移动端虚拟摇杆 / 按钮 / 视角拖拽）
   ============================================================ */
window.Input = (function () {
  const keys = {};
  const touchState = {};      // 触摸模拟按键（摇杆 / 按钮）
  const edge = {};            // 单次触发
  const mouse = { down: false, dx: 0, dy: 0, x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true;
    // 阻止方向键/空格滚动页面
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  window.addEventListener('mousedown', (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('mousemove', (e) => {
    if (mouse.down) { mouse.dx += e.clientX - mouse.x; mouse.dy += e.clientY - mouse.y; mouse.x = e.clientX; mouse.y = e.clientY; }
  });

  // ============ 触摸 / 移动端控制 ============
  const touch = { stickId: null, ox: 0, oy: 0, camId: null, cx: 0, cy: 0 };
  const STICK_R = 56, STICK_DEAD = 14;
  let stickBase = null, stickKnob = null;
  function refreshStickUI(dx, dy) { if (stickKnob) stickKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
  function applyStick(x, y) {
    let dx = x - touch.ox, dy = y - touch.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
    refreshStickUI(dx, dy);
    const s = touchState;
    s.KeyW = s.ArrowUp = dy < -STICK_DEAD;
    s.KeyS = s.ArrowDown = dy > STICK_DEAD;
    s.KeyA = s.ArrowLeft = dx < -STICK_DEAD;
    s.KeyD = s.ArrowRight = dx > STICK_DEAD;
  }
  function clearStick() {
    touch.stickId = null;
    const s = touchState;
    s.KeyW = s.ArrowUp = s.KeyS = s.ArrowDown = s.KeyA = s.ArrowLeft = s.KeyD = s.ArrowRight = false;
    refreshStickUI(0, 0);
    if (stickBase) stickBase.style.display = 'none';
  }
  function touchPress(code) { edge[code] = true; }        // 一次性触发（被 hit 消费）
  function touchHold(code, on) { touchState[code] = on; } // 持续按住（被 isDown 读取）

  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.target && t.target.closest && t.target.closest('.touch-ui')) continue;
      if (t.clientX < innerWidth * 0.5 && touch.stickId === null) {
        touch.stickId = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY;
        stickBase = document.getElementById('stick-base');
        if (stickBase) { stickBase.style.left = t.clientX + 'px'; stickBase.style.top = t.clientY + 'px'; stickBase.style.display = 'block'; stickKnob = document.getElementById('stick-knob'); }
        applyStick(t.clientX, t.clientY);
      } else if (t.clientX >= innerWidth * 0.5 && touch.camId === null) {
        touch.camId = t.identifier; touch.cx = t.clientX; touch.cy = t.clientY; mouse.down = true;
      }
    }
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) applyStick(t.clientX, t.clientY);
      else if (t.identifier === touch.camId) {
        mouse.dx += t.clientX - touch.cx; mouse.dy += t.clientY - touch.cy;
        touch.cx = t.clientX; touch.cy = t.clientY;
      }
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) clearStick();
      if (t.identifier === touch.camId) { touch.camId = null; mouse.down = false; }
    }
  }
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  return {
    keys,
    isDown: (c) => !!keys[c] || !!touchState[c],
    // 消费一次性按键
    hit: (c) => { if (edge[c]) { edge[c] = false; return true; } return false; },
    mouse,
    touchPress, touchHold,
    // 每帧末尾清空鼠标位移增量
    endFrame() { mouse.dx = 0; mouse.dy = 0; for (const k in edge) edge[k] = false; }
  };
})();
