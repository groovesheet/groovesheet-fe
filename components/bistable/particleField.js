/**
 * Particle field for the /bistable keyboard — discrete glowing SQUARES that
 * shoot from played keys, drift up, twinkle, and fade. Where the fluid sim
 * renders continuous dye (which smears into murk), every particle here stays
 * a clean quad of light on black.
 *
 * Color is NOT stored per particle: the caller passes `colorFor(ageSec)` to
 * draw(), so every particle transitions through the same journey (bright
 * yellow → pink → bright blue) as it ages AFTER being shot — the plume
 * gradient emerges from particle age, not from what the emitter felt like
 * at spawn time.
 *
 * Plain mutable-array system (no React) driven from the page's rAF loop:
 *   spawn(...) → step(dt, physics) → draw(now, colorFor)
 * Renders additively ('lighter') as a two-pass core + halo — cheap enough
 * for ~1500 live particles without per-particle shadowBlur.
 */

const MAX_PARTICLES = 1500;

export function createParticleField(canvas) {
  const ctx = canvas.getContext('2d');
  const parts = [];

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  // Soft-glow sprites, one per quantized color. All particles share a single
  // 1-D color journey, so only ~50 distinct colors ever occur — each becomes
  // a cached 64px radial-gradient canvas. drawImage of a cached sprite is
  // ~100x cheaper than building a createRadialGradient per particle per frame.
  const spriteCache = new Map();
  const glowSprite = (r, g, b) => {
    const key = ((r * 15) | 0) * 256 + ((g * 15) | 0) * 16 + ((b * 15) | 0);
    let sprite = spriteCache.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = 64;
      sprite.height = 64;
      const sctx = sprite.getContext('2d');
      const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      const rgb = `${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0}`;
      grad.addColorStop(0, `rgba(${rgb},0.9)`);
      grad.addColorStop(0.35, `rgba(${rgb},0.45)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 64, 64);
      spriteCache.set(key, sprite);
    }
    return sprite;
  };

  /** Keep the backing store matched to the CSS box (caller calls per frame). */
  const resize = () => {
    // offsetWidth/Height rather than getBoundingClientRect: projection mode
    // puts a CSS matrix3d on an ancestor, and the rect would be the warped box.
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    if (!cw || !ch) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return true;
  };

  /**
   * @param {number} x,y     spawn point, backing-store px
   * @param {number} angle   radians, screen convention (-PI/2 is straight up)
   * @param {number} speed   px/s
   * @param {number} size    core half-side, px
   * @param {number} life    seconds
   */
  const spawn = (x, y, angle, speed, size, life) => {
    if (parts.length >= MAX_PARTICLES) parts.shift();
    parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      life,
      maxLife: life,
      tw: rand(0, Math.PI * 2), // twinkle phase
      twSpeed: rand(60, 140),
    });
  };

  // ---- shared flow grid: how particles interact -------------------------
  // A coarse velocity field (particle-in-cell lite). Every particle deposits
  // its momentum into the grid; the grid decays and diffuses (reads as
  // viscosity); every particle then steers toward the local flow. One
  // plume entrains the next, fresh bursts shove old embers aside, and
  // eddies emerge where flows collide — fluid behaviour, particle look.
  const GRID_W = 128;
  let gridH = 0;
  let gu = new Float32Array(0);
  let gv = new Float32Array(0);
  let guTmp = new Float32Array(0);
  let gvTmp = new Float32Array(0);

  const ensureGrid = () => {
    const h = Math.max(24, Math.round((GRID_W * canvas.height) / Math.max(1, canvas.width)));
    if (h === gridH && gu.length) return;
    gridH = h;
    gu = new Float32Array(GRID_W * gridH);
    gv = new Float32Array(GRID_W * gridH);
    guTmp = new Float32Array(GRID_W * gridH);
    gvTmp = new Float32Array(GRID_W * gridH);
  };

  /**
   * @param {number} dt      seconds
   * @param {object} p       { damp, buoy, wander, couple } — damp: exponential
   *   velocity decay /s; buoy: upward lift px/s²; wander: sideways jitter
   *   px/s²; couple: how strongly particles follow the shared flow, /s
   *   (0 = independent embers, ~3 = fluid-like entrainment)
   */
  const step = (dt, { damp, buoy, wander, couple = 0 }) => {
    const decay = Math.exp(-damp * dt);
    const w = canvas.width;
    const h = canvas.height;
    ensureGrid();
    const cellW = w / GRID_W;
    const cellH = h / gridH;

    // 1) grid decays and diffuses — old motion fades, momentum spreads to
    //    neighbouring cells (the "thickness" of the medium)
    const keep = Math.exp(-1.6 * dt);
    const spread = Math.min(0.35, 3.5 * dt);
    for (let y = 0; y < gridH; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const i = y * GRID_W + x;
        const xm = x > 0 ? i - 1 : i;
        const xp = x < GRID_W - 1 ? i + 1 : i;
        const ym = y > 0 ? i - GRID_W : i;
        const yp = y < gridH - 1 ? i + GRID_W : i;
        guTmp[i] = (gu[i] * (1 - spread) + (gu[xm] + gu[xp] + gu[ym] + gu[yp]) * (spread / 4)) * keep;
        gvTmp[i] = (gv[i] * (1 - spread) + (gv[xm] + gv[xp] + gv[ym] + gv[yp]) * (spread / 4)) * keep;
      }
    }
    [gu, guTmp] = [guTmp, gu];
    [gv, gvTmp] = [gvTmp, gv];

    // 2) particles: follow the local flow, then deposit their own momentum
    const follow = Math.min(1, couple * dt);
    const deposit = Math.min(1, 2.5 * dt);
    let write = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;

      if (couple > 0 && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h) {
        // bilinear sample of the shared flow at the particle
        const gx = Math.min(GRID_W - 1.001, Math.max(0, p.x / cellW - 0.5));
        const gy = Math.min(gridH - 1.001, Math.max(0, p.y / cellH - 0.5));
        const x0 = gx | 0;
        const y0 = gy | 0;
        const fx = gx - x0;
        const fy = gy - y0;
        const i00 = y0 * GRID_W + x0;
        const i10 = i00 + 1;
        const i01 = i00 + GRID_W;
        const i11 = i01 + 1;
        const fu = (gu[i00] * (1 - fx) + gu[i10] * fx) * (1 - fy)
          + (gu[i01] * (1 - fx) + gu[i11] * fx) * fy;
        const fv = (gv[i00] * (1 - fx) + gv[i10] * fx) * (1 - fy)
          + (gv[i01] * (1 - fx) + gv[i11] * fx) * fy;
        p.vx += (fu - p.vx) * follow;
        p.vy += (fv - p.vy) * follow;

        // nearest-cell deposit for the next frame's flow
        const ci = Math.min(gridH - 1, Math.max(0, Math.round(p.y / cellH))) * GRID_W
          + Math.min(GRID_W - 1, Math.max(0, Math.round(p.x / cellW)));
        gu[ci] += (p.vx - gu[ci]) * deposit;
        gv[ci] += (p.vy - gv[ci]) * deposit;
      }

      p.vx = p.vx * decay + rand(-wander, wander) * dt * 60;
      p.vy = p.vy * decay - buoy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      parts[write] = p;
      write += 1;
    }
    parts.length = write;
  };

  /**
   * @param {number} now       ms timestamp (for twinkle)
   * @param {Function} colorFor  (ageSec) => [r, g, b] in 0..1 — evaluated per
   *   particle per frame, so color keeps evolving after the shot.
   */
  const draw = (now, colorFor) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      const t = p.life / p.maxLife;
      const age = p.maxLife - p.life;
      const [r, g, b] = colorFor(age);
      const twinkle = 0.75 + 0.25 * Math.sin(now / p.twSpeed + p.tw);
      const a = t * t * twinkle;
      const s = p.size * (0.5 + 0.5 * t);
      // halo: soft radial falloff, not a hard-edged quad
      const hs = s * 3.4;
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(glowSprite(r, g, b), p.x - hs, p.y - hs, hs * 2, hs * 2);
      // core quad, whitened so it reads hot
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${(r * 0.6 + 0.4) * 255 | 0},${(g * 0.6 + 0.4) * 255 | 0},${(b * 0.6 + 0.4) * 255 | 0})`;
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const clear = () => {
    parts.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return { spawn, step, draw, resize, clear, count: () => parts.length };
}
