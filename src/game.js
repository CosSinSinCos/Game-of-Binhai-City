/* ============================================================
   Game : 主控制器 —— 渲染 / 昼夜光照 / 惯性镜头 / 步行<->驾驶
          状态机 / 任务引导 / GPS 3D 路径线 / 碰撞屏幕反馈
   ============================================================ */
(function () {
  let renderer, scene, camera, clock;
  let city, player, vehicle, audio = window.AudioEngine;
  let mode = 'walking';
  const cam = { yaw: 0, freeYaw: 0, freePitch: 0, pitch: 0.32, pos: new THREE.Vector3() };
  let shake = 0;
  let night = false;
  let started = false;
  let HUD_showHelp = false;

  // 任务步骤
  const steps = [
    { text: '步行靠近前方的红色跑车，按 [F] 上车', target: () => vehicle.pos, done: () => mode === 'driving' },
    { text: '已上车！沿小地图黄色 GPS 线，开往东侧「滨湾港」码头', target: () => city.dock, done: () => vehicle.pos.distanceTo(city.dock) < 22 },
    { text: '到达码头，任务完成！自由探索滨湾市 · [Tab] 昼夜 · [B] 电台 · [H] 帮助', target: () => null, done: () => false }
  ];
  let step = 0;
  let gpsLine, gpsGeo;

  function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(('ontouchstart' in window ? 1.5 : 2), devicePixelRatio));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.id = 'game';
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc6e8);
    scene.fog = new THREE.Fog(0x9fc6e8, 120, 620);

    camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 1600);
    camera.position.set(0, 6, -10);

    // 光照
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x46505c, 0.7); scene.add(hemi); scene.userData.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
    sun.position.set(120, 200, 80); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 1; sc.far = 600;
    scene.add(sun); scene.userData.sun = sun;
    scene.add(new THREE.AmbientLight(0x6688aa, 0.25));

    clock = new THREE.Clock();

    // 预加载贴图 -> 建城 -> 建角色/车 -> HUD
    const bar = document.querySelector('#loading .bar > i');
    Tex.preload((tex) => {
      city = City.build(scene);
      player = new Player(); player.setColliders(city.colliders); scene.add(player.group);
      vehicle = new Vehicle({ paint: 'paintRed' }); vehicle.setColliders(city.colliders);
      vehicle.pos.set(4, 0, 5); vehicle.group.position.copy(vehicle.pos); scene.add(vehicle.group);
      player.pos.set(0, 0, 0);

      // GPS 3D 线
      gpsGeo = new THREE.BufferGeometry();
      gpsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      gpsLine = new THREE.Line(gpsGeo, new THREE.LineBasicMaterial({ color: 0xffd23f }));
      gpsLine.position.y = 0.35; scene.add(gpsLine);

      HUD.init(city);
      HUD.setMission(steps[0].text);
      HUD.setStation(audio.stationName());
      document.getElementById('loading').style.display = 'none';
      showStart();
      animate();
    });
    // 进度条动画（占位）
    let p = 0; const iv = setInterval(() => { p = Math.min(95, p + 7); if (bar) bar.style.width = p + '%'; if (started) { clearInterval(iv); if (bar) bar.style.width = '100%'; } }, 120);
  }

  function showStart() {
    const s = document.createElement('div'); s.id = 'start';
    s.innerHTML = `<h1>滨 湾 市</h1><p>单人开放城市 · 步行 / 驾驶 · 程序化生成</p><div class="btn">点击开始（将开启声音）</div>`;
    document.body.appendChild(s);
    s.addEventListener('click', () => {
      audio.init(); audio.resume();
      s.style.display = 'none'; started = true;
      HUD.toast('WASD 移动 · 鼠标拖动转视角 · 走近红车按 F 上车', 4200);
    });
  }

  function setNight(on) {
    night = on;
    const sun = scene.userData.sun, hemi = scene.userData.hemi;
    if (on) {
      scene.background.set(0x0a1224); scene.fog.color.set(0x0a1224);
      sun.intensity = 0.18; hemi.intensity = 0.25; sun.color.set(0x9fb6ff);
      city.nightLights.forEach((l) => l.intensity = 1.3);
    } else {
      scene.background.set(0x9fc6e8); scene.fog.color.set(0x9fc6e8);
      sun.intensity = 1.1; hemi.intensity = 0.7; sun.color.set(0xfff2d8);
      city.nightLights.forEach((l) => l.intensity = 0);
    }
  }

  // ---- 输入收集 ----
  function gatherInput() {
    const I = Input;
    if (mode === 'driving') {
      let throttle = 0, steer = 0;
      if (I.isDown('KeyW') || I.isDown('ArrowUp')) throttle += 1;
      if (I.isDown('KeyS') || I.isDown('ArrowDown')) throttle -= 1;
      if (I.isDown('KeyA') || I.isDown('ArrowLeft')) steer += 1;
      if (I.isDown('KeyD') || I.isDown('ArrowRight')) steer -= 1;
      const handbrake = I.isDown('Space');
      return { throttle, steer, handbrake };
    } else {
      // 相机相对方向
      const fy = cam.yaw;
      const fwd = new THREE.Vector3(Math.sin(fy), 0, Math.cos(fy));
      const right = new THREE.Vector3(Math.cos(fy), 0, -Math.sin(fy));
      const wish = new THREE.Vector3();
      if (I.isDown('KeyW') || I.isDown('ArrowUp')) wish.add(fwd);
      if (I.isDown('KeyS') || I.isDown('ArrowDown')) wish.sub(fwd);
      if (I.isDown('KeyD') || I.isDown('ArrowRight')) wish.add(right);
      if (I.isDown('KeyA') || I.isDown('ArrowLeft')) wish.sub(right);
      const running = I.isDown('ShiftLeft') || I.isDown('ShiftRight');
      return { wish, running };
    }
  }

  function tryEnterExit() {
    if (Input.hit('KeyF')) {
      if (mode === 'walking') {
        if (player.pos.distanceTo(vehicle.pos) < 5.5) {
          mode = 'driving';
          player.group.visible = false;
          HUD.toast('已上车 · WASD 驾驶 · 空格手刹漂移 · 再按 F 下车', 3200);
        }
      } else {
        mode = 'walking';
        const ep = vehicle.exitPos();
        player.pos.copy(ep); player.group.visible = true;
        player.group.position.copy(ep);
        // 把车稍微停住
        vehicle.vel.multiplyScalar(0.3);
        HUD.toast('已下车 · 自由漫步', 2200);
      }
    }
  }

  function updateCamera(dt, target, followYaw) {
    // 鼠标自由视角
    if (Input.mouse.down) { cam.freeYaw += Input.mouse.dx * 0.005; cam.freePitch += Input.mouse.dy * 0.004; }
    else { cam.freeYaw *= (1 - Math.min(1, dt * 2.2)); cam.freePitch *= (1 - Math.min(1, dt * 2.2)); }
    cam.freePitch = Math.max(-0.25, Math.min(0.95, cam.freePitch));

    cam.yaw = lerpAngle(cam.yaw, followYaw, Math.min(1, dt * 3));
    const yaw = cam.yaw + cam.freeYaw;
    const dist = mode === 'driving' ? 9.5 : 6.0;
    const height = mode === 'driving' ? 3.6 : 3.0;
    const horiz = dist * Math.cos(cam.pitch + cam.freePitch);
    const vert = dist * Math.sin(cam.pitch + cam.freePitch);
    const desired = new THREE.Vector3(
      target.x - Math.sin(yaw) * horiz,
      target.y + height + vert,
      target.z - Math.cos(yaw) * horiz
    );
    const k = 1 - Math.exp(-7 * dt);
    camera.position.lerp(desired, k);
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake *= (1 - Math.min(1, dt * 5));
    }
    camera.lookAt(target.x, target.y + 1.1, target.z);
  }

  function updateGPS() {
    const t = steps[step].target();
    const src = mode === 'driving' ? vehicle.pos : player.pos;
    const arr = gpsGeo.attributes.position.array;
    arr[0] = src.x; arr[1] = 0; arr[2] = src.z;
    if (t) { arr[3] = t.x; arr[4] = 0; arr[5] = t.z; gpsLine.visible = true; }
    else gpsLine.visible = false;
    gpsGeo.attributes.position.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    // 全局按键
    if (Input.hit('KeyH')) { const open = HUD_showHelp = !HUD_showHelp; HUD.showHelp(open); }
    if (Input.hit('Tab')) { setNight(!night); HUD.toast(night ? '🌙 夜间' : '☀ 白昼', 1200); }
    if (Input.hit('KeyB')) { const n = audio.nextStation(); HUD.setStation(n); HUD.toast('电台：' + n, 1500); }
    if (Input.hit('KeyM')) { audio.toggleBGM(); HUD.toast('静音切换', 1000); }

    tryEnterExit();

    const inp = gatherInput();
    let target, followYaw, speed = 0;
    if (mode === 'driving') {
      const r = vehicle.update(dt, inp, {
        onHit: (i) => { HUD.flash(i); audio.hit(i); shake = 0.15 + i * 0.5; }
      });
      audio.setEngine(vehicle.rpm, inp.throttle > 0 ? 1 : 0);
      audio.setTire(vehicle.drift);
      target = vehicle.pos; followYaw = vehicle.heading; speed = vehicle.speed;
    } else {
      player.move(inp.wish, dt, inp.running);
      if (inp.wish.lengthSq() > 0.001 && Math.random() < dt * 3) audio.step();
      target = player.pos; followYaw = player.heading; speed = player.speed * (inp.running ? 1.6 : 1);
    }

    updateCamera(dt, new THREE.Vector3(target.x, 1.2, target.z), followYaw);
    updateGPS();

    // 任务推进
    if (step < steps.length && steps[step].done()) {
      step++;
      if (step < steps.length) { HUD.setMission(steps[step].text); HUD.toast(steps[step].text, 3600); }
    }

    // 霓虹脉动
    const pulse = 1.4 + Math.sin(t * 3) * 0.4;
    city.neon.forEach((m) => { if (m.material.emissive) m.material.emissiveIntensity = pulse; else if (m.material.color) m.material.color.multiplyScalar(1); });

    HUD.update({ mode, player: player.pos, vehicle: vehicle.pos, heading: (mode === 'driving' ? vehicle.heading : cam.yaw), speed, gpsPath: gpsPathArr(), target: steps[step].target() });

    Input.endFrame();
    renderer.render(scene, camera);
  }

  // 小地图 GPS 折点（与 3D 线一致）
  function gpsPathArr() {
    const t = steps[step].target();
    const src = mode === 'driving' ? vehicle.pos : player.pos;
    return t ? [src.clone(), t.clone()] : [];
  }

  window.addEventListener('resize', () => {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  init();
})();
