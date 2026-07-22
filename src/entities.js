/* ============================================================
   Entities : 载具驾驶（手感优先 + 手刹漂移） / 步行角色 / 进出车
   ============================================================ */
(function () {

  // ---------- 载具 ----------
  class Vehicle {
    constructor(opts) {
      this.group = Models.buildCar(opts);
      this.pos = new THREE.Vector3(0, 0, 0);
      this.heading = 0;            // 绕 Y 偏航；本地 +Z 为车头
      this.vel = new THREE.Vector3(); // 世界速度
      this.steer = 0;              // 当前前轮转角
      this.speed = 0;              // 沿车头方向速度（HUD/音效用）
      this.rpm = 0;
      this.radius = 2.1;
      this.engineOn = true;
      this.drift = 0;
      this.spin = 0;               // 车轮滚动累计
      this.colliders = null;
    }

    setColliders(c) { this.colliders = c; }

    forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
    right() { return new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading)); }

    // input: {throttle:-1..1, steer:-1..1, handbrake:bool}
    update(dt, input, hooks) {
      const f = this.forward(), r = this.right();
      let vF = this.vel.dot(f);
      let vL = this.vel.dot(r);

      const power = 26;          // 引擎推力
      const brake = 30;
      const maxF = 42;           // 最高前向速度
      const maxR = 14;           // 倒车

      // 纵向：油门 / 刹车 / 阻力
      if (input.throttle > 0) vF += power * input.throttle * dt;
      else if (input.throttle < 0) {
        if (vF > 0.5) vF -= brake * dt;          // 刹车
        else vF += power * input.throttle * 0.6 * dt; // 倒车
      }
      // 自然阻力
      vF -= vF * (input.handbrake ? 0.6 : 1.1) * dt;
      vF = Math.max(-maxR, Math.min(maxF, vF));

      // 转向：随速度变化的转向速率
      const speedFactor = Math.min(1, Math.abs(vF) / 8);
      const target = -input.steer * 0.5;          // 前轮目标角(约28°)
      this.steer += (target - this.steer) * Math.min(1, dt * 8);
      const yawRate = this.steer * speedFactor * 2.4 * Math.sign(vF || 1);
      this.heading += yawRate * dt;

      // 横向抓地：手刹时大幅降低 -> 漂移
      const grip = input.handbrake ? 1.5 : 9.0;
      const prevL = vL;
      vL -= vL * Math.min(1, grip * dt);
      this.drift = Math.min(1, Math.abs(prevL - vL) * 0.6 + (input.handbrake ? Math.abs(vL) * 0.12 : 0));

      // 重组世界速度
      const nf = this.forward(), nr = this.right();
      this.vel.copy(nf.multiplyScalar(vF)).add(nr.multiplyScalar(vL));
      this.speed = vF;
      this.rpm = 0.15 + Math.min(1, Math.abs(vF) / maxF) * 0.85 + (input.throttle > 0 ? 0.1 : 0);

      // 位移 + 碰撞（分轴，可沿墙滑行）
      const nx = this.pos.x + this.vel.x * dt;
      const nz = this.pos.z + this.vel.z * dt;
      let hit = false, impact = 0;
      if (!this._blocked(nx, this.pos.z)) this.pos.x = nx; else { this.vel.x *= -0.35; hit = true; impact = Math.abs(this.vel.x); }
      if (!this._blocked(this.pos.x, nz)) this.pos.z = nz; else { this.vel.z *= -0.35; hit = true; impact = Math.max(impact, Math.abs(this.vel.z)); }
      this.pos.y = 0;

      // 应用到 mesh
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.heading;

      // 车轮动画
      this.spin += (vF * dt) / 0.42;
      this.group.userData.wheels.forEach((w) => { if (w.userData.spin) w.userData.spin.rotation.x = -this.spin; });
      this.group.userData.frontPivots.forEach((p) => { p.rotation.y = this.steer; });

      if (hit && impact > 4 && hooks && hooks.onHit) hooks.onHit(Math.min(1, impact / 30));
      return { hit, impact };
    }

    _blocked(x, z) {
      if (!this.colliders) return false;
      const rad = this.radius;
      for (const c of this.colliders) {
        if (c.road || c.water) continue;
        if (x > c.minX - rad && x < c.maxX + rad && z > c.minZ - rad && z < c.maxZ + rad) return true;
      }
      return false;
    }

    // 把乘客放到车门旁
    exitPos() {
      const r = this.right();
      return new THREE.Vector3(this.pos.x + r.x * 2.4, 0, this.pos.z + r.z * 2.4);
    }
  }

  // ---------- 步行角色 ----------
  class Player {
    constructor() {
      this.group = Models.buildCharacter();
      this.pos = new THREE.Vector3(0, 0, 0);
      this.heading = 0;
      this.radius = 0.45;
      this.colliders = null;
      this.walkPhase = 0;
      this.speed = 0;
    }
    setColliders(c) { this.colliders = c; }

    move(wishDir, dt, running) {
      const sp = running ? 7.5 : 4.2;
      let moving = wishDir.lengthSq() > 0.001;
      if (moving) {
        wishDir.normalize();
        this.heading = Math.atan2(wishDir.x, wishDir.z);
        const nx = this.pos.x + wishDir.x * sp * dt;
        const nz = this.pos.z + wishDir.z * sp * dt;
        if (!this._blocked(nx, this.pos.z)) this.pos.x = nx;
        if (!this._blocked(this.pos.x, nz)) this.pos.z = nz;
        this.speed = sp;
        this.walkPhase += dt * (running ? 13 : 9);
      } else { this.speed = 0; this.walkPhase += dt * 2; }

      this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.group.rotation.y = this.heading;
      // 四肢摆动
      const u = this.group.userData;
      const sw = moving ? Math.sin(this.walkPhase) * 0.6 : 0;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
    }

    _blocked(x, z) {
      if (!this.colliders) return false;
      const rad = this.radius;
      for (const c of this.colliders) {
        if (c.road || c.water) continue;
        if (x > c.minX - rad && x < c.maxX + rad && z > c.minZ - rad && z < c.maxZ + rad) return true;
      }
      return false;
    }
  }

  window.Vehicle = Vehicle;
  window.Player = Player;
})();
