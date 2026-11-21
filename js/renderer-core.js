window.ZS = window.ZS || {};

(function () {
  const LIGHT_SCALE = 0.5;
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');
  const eyeHaloCache = new Map();
  const glowStampCache = new Map();
  const emissiveStampCache = new Map();
  const thumbnailCache = new Map();
  let punchHoleStamp = null;
  let cloudShadowStamp = null;
  const bgCache = {
    canvas: document.createElement('canvas'),
    ctx: null,
    w: 0,
    h: 0,
    dpr: 0,
    isSil: null,
    isNight: null,
    bakeCount: 0
  };
  const terrainCache = {
    canvas: document.createElement('canvas'),
    ctx: null,
    N: 0,
    seed: null,
    terrainGridRef: null,
    isSil: null,
    bakeScale: 0,
    worldMinX: 0,
    worldMinY: 0,
    worldW: 0,
    worldH: 0,
    floorIds: null,
    decalOcc: null,
    bakeCount: 0
  };
  const rockStampCache = new Map();
  const occludeAlphaMap = new Map();
  let lastOccTimeSec = -1;
  const R = (ZS._Renderer = {
    lightCanvas,
    lightCtx,
    LIGHT_SCALE,
    lightScaleX: LIGHT_SCALE,
    lightScaleY: LIGHT_SCALE,
    eyeHaloCache,
    glowStampCache,
    emissiveStampCache,
    thumbnailCache,
    rockStampCache,
    occludeAlphaMap,
    bgCache,
    terrainCache,
    emissiveList: null,
    currentEntityAlpha: 1.0,
    hoverOccludedByFront: false,
    activeTrapTiles: null,
    cachedTerrainN: 0,
    terrainMeta: null,
    stampCacheBakes: 0,
    stampCacheHits: 0,
    zombieStampBakes: 0,
    zombieStampHits: 0
  });

  function tileHash01(x, y, salt) {
    let h = ((x * 374761393) ^ (y * 668265263) ^ ((salt || 0) * 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function ensureTerrainMeta(N) {
    if (R.terrainMeta && R.cachedTerrainN === N) return R.terrainMeta;
    R.cachedTerrainN = N;
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    const edgeProps = [];

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const isEdge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        // Deterministic ±3% brightness variation per tile
        const jitter = (tileHash01(x, y, 11) * 2 - 1) * 0.03;
        const shadeFactor = +(1 + jitter).toFixed(3);

        let decal = null;
        if (!isEdge) {
          const r = tileHash01(x, y, 29);
          const ox = 0.24 + tileHash01(x, y, 41) * 0.52;
          const oy = 0.24 + tileHash01(x, y, 53) * 0.52;
          if (r < 0.16) {
            decal = { kind: 'tuft', ox, oy, v: tileHash01(x, y, 67) };
          } else if (r < 0.26) {
            decal = { kind: 'pebble', ox, oy, v: tileHash01(x, y, 71) };
          } else if (r < 0.35) {
            decal = { kind: 'soil', ox, oy, v: tileHash01(x, y, 83) };
          } else if (r < 0.41) {
            decal = { kind: 'clover', ox, oy, v: tileHash01(x, y, 97) };
          }
        } else {
          // Outer quarantine perimeter rubble / cracked earth details
          const er = tileHash01(x, y, 109);
          const ox = 0.26 + tileHash01(x, y, 113) * 0.48;
          const oy = 0.26 + tileHash01(x, y, 127) * 0.48;
          if (er < 0.44) {
            decal = { kind: 'crack', ox, oy, v: tileHash01(x, y, 131) };
          } else if (er < 0.72) {
            decal = { kind: 'scorch', ox, oy, v: tileHash01(x, y, 137) };
          }
        }

        grid[y][x] = { isEdge, shadeFactor, decal };
      }
    }

    // Build deterministic breached quarantine fence posts & concrete rubble along the 4 outer edges
    // Leave wide natural breach openings on each side where zombies pour in
    for (let i = 1; i < N - 1; i++) {
      // Top-right edge (y = 0)
      if (tileHash01(i, 0, 211) > 0.36) {
        edgeProps.push({
          kind: tileHash01(i, 0, 223) > 0.34 ? 'fence_x' : 'rubble',
          gx: i + 0.18,
          gy: 0.11,
          h: 5.2 + tileHash01(i, 0, 227) * 2.4,
          brokenRail: tileHash01(i, 0, 229) > 0.32,
          tilt: (tileHash01(i, 0, 233) - 0.5) * 0.06
        });
      }
      // Bottom-left edge (y = N - 1)
      if (tileHash01(i, N - 1, 239) > 0.36) {
        edgeProps.push({
          kind: tileHash01(i, N - 1, 241) > 0.34 ? 'fence_x' : 'rubble',
          gx: i + 0.18,
          gy: N - 0.13,
          h: 5.2 + tileHash01(i, N - 1, 251) * 2.4,
          brokenRail: tileHash01(i, N - 1, 257) > 0.32,
          tilt: (tileHash01(i, N - 1, 263) - 0.5) * 0.06
        });
      }
      // Top-left edge (x = 0)
      if (tileHash01(0, i, 269) > 0.36) {
        edgeProps.push({
          kind: tileHash01(0, i, 271) > 0.34 ? 'fence_y' : 'rubble',
          gx: 0.11,
          gy: i + 0.18,
          h: 5.2 + tileHash01(0, i, 277) * 2.4,
          brokenRail: tileHash01(0, i, 281) > 0.32,
          tilt: (tileHash01(0, i, 283) - 0.5) * 0.06
        });
      }
      // Bottom-right edge (x = N - 1)
      if (tileHash01(N - 1, i, 293) > 0.36) {
        edgeProps.push({
          kind: tileHash01(N - 1, i, 307) > 0.34 ? 'fence_y' : 'rubble',
          gx: N - 0.13,
          gy: i + 0.18,
          h: 5.2 + tileHash01(N - 1, i, 311) * 2.4,
          brokenRail: tileHash01(N - 1, i, 313) > 0.32,
          tilt: (tileHash01(N - 1, i, 317) - 0.5) * 0.06
        });
      }
    }

    // 4 Corner breached concrete barrier blocks
    const corners = [
      { gx: 0.22, gy: 0.22 },
      { gx: N - 0.36, gy: 0.22 },
      { gx: 0.22, gy: N - 0.36 },
      { gx: N - 0.36, gy: N - 0.36 }
    ];
    for (let c = 0; c < corners.length; c++) {
      edgeProps.push({
        kind: 'barrier',
        gx: corners[c].gx,
        gy: corners[c].gy,
        h: 5.8
      });
    }

    R.terrainMeta = { grid, edgeProps };
    return R.terrainMeta;
  }

  function ensureLightCanvas(w, h) {
    const lw = Math.max(1, Math.round(w * LIGHT_SCALE));
    const lh = Math.max(1, Math.round(h * LIGHT_SCALE));
    if (lightCanvas.width !== lw || lightCanvas.height !== lh) {
      lightCanvas.width = lw;
      lightCanvas.height = lh;
    }
    R.lightScaleX = lw / Math.max(1, w);
    R.lightScaleY = lh / Math.max(1, h);
    return { lw, lh, scaleX: R.lightScaleX, scaleY: R.lightScaleY };
  }

  function getGlowStamp(glowColor, innerFrac) {
    const frac = innerFrac != null ? innerFrac : 0.04;
    const key = `${glowColor}|${frac}`;
    let stamp = glowStampCache.get(key);
    if (stamp) return stamp;
    const sz = 64;
    stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const half = sz * 0.5;
    const grad = sctx.createRadialGradient(half, half, Math.max(1, half * frac), half, half, half);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, sz, sz);
    if (glowStampCache.size > 128) glowStampCache.clear();
    glowStampCache.set(key, stamp);
    return stamp;
  }

  function getPunchHoleStamp() {
    if (punchHoleStamp) return punchHoleStamp;
    const sz = 64;
    const stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const half = sz * 0.5;
    const grad = sctx.createRadialGradient(half, half, half * 0.08, half, half, half);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, sz, sz);
    punchHoleStamp = stamp;
    return stamp;
  }

  function getCloudShadowStamp() {
    if (cloudShadowStamp) return cloudShadowStamp;
    const sz = 96;
    const stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const puffs = [
      { x: 48, y: 48, r: 44, a: 0.72 },
      { x: 35, y: 50, r: 30, a: 0.34 },
      { x: 61, y: 46, r: 28, a: 0.32 }
    ];
    for (let i = 0; i < puffs.length; i++) {
      const pf = puffs[i];
      const grad = sctx.createRadialGradient(pf.x, pf.y, pf.r * 0.14, pf.x, pf.y, pf.r);
      grad.addColorStop(0, `rgba(8, 16, 26, ${pf.a})`);
      grad.addColorStop(0.5, `rgba(8, 16, 26, ${(pf.a * 0.52).toFixed(3)})`);
      grad.addColorStop(0.82, `rgba(10, 18, 28, ${(pf.a * 0.16).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(10, 18, 28, 0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, sz, sz);
    }
    cloudShadowStamp = stamp;
    return stamp;
  }

  function drawConiferRidge(bctx, x0, x1, baseY0, baseY1, viewH, minH, maxH, stepPx, seed, fillCol, rimCol) {
    bctx.save();
    bctx.fillStyle = fillCol;
    bctx.beginPath();
    const goingRight = x1 >= x0;
    const dir = goingRight ? 1 : -1;
    const len = Math.abs(x1 - x0);
    const count = Math.max(5, Math.floor(len / stepPx));
    bctx.moveTo(x0, viewH + 12);
    bctx.lineTo(x0, baseY0);
    for (let i = 0; i <= count; i++) {
      const f = i / count;
      const cx = x0 + (x1 - x0) * f;
      const ridgeY = baseY0 + (baseY1 - baseY0) * f;
      const r0 = tileHash01(i, seed, 503);
      const r1 = tileHash01(i, seed, 521);
      const r2 = tileHash01(i, seed, 541);
      const treeH = minH + (maxH - minH) * (0.35 + 0.65 * r0) * (1 - f * 0.36);
      const halfW = stepPx * (0.64 + 0.34 * r1);
      const t1 = ridgeY - treeH * 0.42;
      const t2 = ridgeY - treeH * 0.72;
      const tipY = ridgeY - treeH;
      const lean = (r2 - 0.5) * 2.6;
      bctx.lineTo(cx - dir * halfW * 0.52, ridgeY - treeH * 0.14);
      bctx.lineTo(cx - dir * halfW * 0.24, t1 + 3);
      bctx.lineTo(cx - dir * halfW * 0.44, t1);
      bctx.lineTo(cx - dir * halfW * 0.16, t2 + 2.5);
      bctx.lineTo(cx - dir * halfW * 0.30, t2);
      bctx.lineTo(cx + lean, tipY);
      bctx.lineTo(cx + dir * halfW * 0.30, t2);
      bctx.lineTo(cx + dir * halfW * 0.16, t2 + 2.5);
      bctx.lineTo(cx + dir * halfW * 0.44, t1);
      bctx.lineTo(cx + dir * halfW * 0.24, t1 + 3);
      bctx.lineTo(cx + dir * halfW * 0.52, ridgeY - treeH * 0.10);
    }
    bctx.lineTo(x1, baseY1);
    bctx.lineTo(x1, viewH + 12);
    bctx.closePath();
    bctx.fill();
    if (rimCol) {
      bctx.strokeStyle = rimCol;
      bctx.lineWidth = 1;
      bctx.stroke();
    }
    bctx.restore();
  }

  function drawFarDioramaSilhouettes(bctx, w, h, isNightBg) {
    const farCol = isNightBg ? '#0B1424' : '#1B2834';
    const farSub = isNightBg ? '#08101E' : '#16222C';
    const rimCol = isNightBg ? 'rgba(74, 112, 168, 0.25)' : 'rgba(136, 170, 192, 0.22)';

    bctx.save();

    // Left far horizon ridge + industrial factory + twin smokestacks (framed cleanly in open left flank)
    bctx.fillStyle = farCol;
    bctx.beginPath();
    bctx.moveTo(-10, h + 10);
    bctx.lineTo(-10, h * 0.53);
    bctx.lineTo(w * 0.015, h * 0.505);
    bctx.lineTo(w * 0.032, h * 0.525);
    bctx.lineTo(w * 0.036, h * 0.508);
    // Sawtooth factory roofs
    bctx.lineTo(w * 0.056, h * 0.508);
    bctx.lineTo(w * 0.058, h * 0.528);
    bctx.lineTo(w * 0.082, h * 0.506);
    bctx.lineTo(w * 0.084, h * 0.530);
    bctx.lineTo(w * 0.108, h * 0.514);
    bctx.lineTo(w * 0.110, h * 0.545);
    // Cylindrical silo / tank silhouette
    bctx.lineTo(w * 0.122, h * 0.542);
    bctx.lineTo(w * 0.136, h * 0.542);
    bctx.lineTo(w * 0.140, h * 0.568);
    bctx.lineTo(w * 0.185, h * 0.598);
    bctx.lineTo(w * 0.265, h * 0.665);
    bctx.lineTo(w * 0.295, h + 10);
    bctx.closePath();
    bctx.fill();

    // Twin factory smokestacks on left ridge
    const stacks = [
      { cx: w * 0.044, topY: h * 0.382, botY: h * 0.525, topW: 5.5, botW: 9.8 },
      { cx: w * 0.072, topY: h * 0.402, botY: h * 0.530, topW: 5.0, botW: 9.0 }
    ];
    for (let i = 0; i < stacks.length; i++) {
      const s = stacks[i];
      bctx.fillStyle = farCol;
      bctx.beginPath();
      bctx.moveTo(s.cx - s.topW * 0.5, s.topY);
      bctx.lineTo(s.cx + s.topW * 0.5, s.topY);
      bctx.lineTo(s.cx + s.botW * 0.5, s.botY);
      bctx.lineTo(s.cx - s.botW * 0.5, s.botY);
      bctx.closePath();
      bctx.fill();
      bctx.fillRect(s.cx - s.topW * 0.68, s.topY, s.topW * 1.36, 3.2);
      bctx.strokeStyle = rimCol;
      bctx.lineWidth = 1.1;
      bctx.beginPath();
      bctx.moveTo(s.cx - s.topW * 0.5, s.topY);
      bctx.lineTo(s.cx - s.botW * 0.5, s.botY);
      bctx.stroke();
    }

    // Subtle secondary ruined industrial block behind left ridge
    bctx.fillStyle = farSub;
    bctx.fillRect(w * 0.006, h * 0.535, w * 0.030, h * 0.09);

    // Right far horizon ridge + ruined city skyline + radio mast (placed visible to left & below right HUD panel)
    bctx.fillStyle = farCol;
    bctx.beginPath();
    bctx.moveTo(w * 0.70, h + 10);
    bctx.lineTo(w * 0.725, h * 0.675);
    bctx.lineTo(w * 0.768, h * 0.618);
    // Ruined stepped tower & apartment blocks
    bctx.lineTo(w * 0.774, h * 0.560);
    bctx.lineTo(w * 0.790, h * 0.560);
    bctx.lineTo(w * 0.793, h * 0.580);
    bctx.lineTo(w * 0.808, h * 0.580);
    bctx.lineTo(w * 0.812, h * 0.538);
    bctx.lineTo(w * 0.834, h * 0.538);
    bctx.lineTo(w * 0.837, h * 0.578);
    bctx.lineTo(w * 0.864, h * 0.592);
    bctx.lineTo(w * 0.905, h * 0.582);
    // Right jagged industrial rooftop + tower
    bctx.lineTo(w * 0.910, h * 0.545);
    bctx.lineTo(w * 0.930, h * 0.538);
    bctx.lineTo(w * 0.938, h * 0.566);
    bctx.lineTo(w * 0.962, h * 0.558);
    bctx.lineTo(w * 0.968, h * 0.530);
    bctx.lineTo(w * 0.992, h * 0.538);
    bctx.lineTo(w + 10, h * 0.560);
    bctx.lineTo(w + 10, h + 10);
    bctx.closePath();
    bctx.fill();

    // Slender radio / transmission mast clearly visible left of HUD panel
    const mastX = w * 0.822;
    const mastTop = h * 0.435;
    const mastBot = h * 0.542;
    bctx.strokeStyle = farCol;
    bctx.lineWidth = 2.0;
    bctx.beginPath();
    bctx.moveTo(mastX, mastTop);
    bctx.lineTo(mastX - 3.2, mastBot);
    bctx.moveTo(mastX, mastTop);
    bctx.lineTo(mastX + 3.2, mastBot);
    bctx.moveTo(mastX - 6.5, mastTop + (mastBot - mastTop) * 0.22);
    bctx.lineTo(mastX + 6.5, mastTop + (mastBot - mastTop) * 0.22);
    bctx.moveTo(mastX - 4.5, mastTop + (mastBot - mastTop) * 0.46);
    bctx.lineTo(mastX + 4.5, mastTop + (mastBot - mastTop) * 0.46);
    bctx.stroke();

    // Distant right smokestack
    const rStackX = w * 0.946;
    bctx.fillStyle = farCol;
    bctx.beginPath();
    bctx.moveTo(rStackX - 2.6, h * 0.478);
    bctx.lineTo(rStackX + 2.6, h * 0.478);
    bctx.lineTo(rStackX + 4.6, h * 0.562);
    bctx.lineTo(rStackX - 4.6, h * 0.562);
    bctx.closePath();
    bctx.fill();

    bctx.restore();
  }

  function drawBrokenViaducts(bctx, w, h, isNightBg) {
    const deckCol = isNightBg ? '#060D1A' : '#101A23';
    const pierCol = isNightBg ? '#040913' : '#0C141C';
    const rimCol = isNightBg ? 'rgba(72, 108, 162, 0.28)' : 'rgba(138, 174, 196, 0.24)';

    const drawPier = (cx, topY, botY, topW, botW) => {
      bctx.fillStyle = pierCol;
      bctx.beginPath();
      bctx.moveTo(cx - topW * 0.5, topY);
      bctx.lineTo(cx + topW * 0.5, topY);
      bctx.lineTo(cx + botW * 0.5, botY);
      bctx.lineTo(cx - botW * 0.5, botY);
      bctx.closePath();
      bctx.fill();
      bctx.strokeStyle = rimCol;
      bctx.lineWidth = 1;
      bctx.beginPath();
      bctx.moveTo(cx - topW * 0.5, topY);
      bctx.lineTo(cx - botW * 0.5, botY);
      bctx.stroke();
    };

    const drawPosts = (x0, y0, x1, y1, count, postH) => {
      bctx.strokeStyle = deckCol;
      bctx.lineWidth = 1.6;
      bctx.beginPath();
      for (let i = 0; i < count; i++) {
        const t = (i + 0.35) / count;
        const px = x0 + (x1 - x0) * t;
        const py = y0 + (y1 - y0) * t;
        bctx.moveTo(px, py);
        bctx.lineTo(px, py - postH);
      }
      bctx.stroke();
    };

    bctx.save();
    const deckThick = Math.max(12, h * 0.020);

    // Left Viaduct — Main Span rising from left edge above bottom dock to broken gap
    const lX0 = -14;
    const lY0 = h * 0.745;
    const lX1 = w * 0.128;
    const lY1 = h * 0.668;
    drawPier(w * 0.030, h * 0.728, h * 0.95, 13, 17);
    drawPier(w * 0.096, h * 0.690, h * 0.95, 11, 15);
    drawPosts(0, h * 0.738, lX1 - 6, lY1 + 2, 6, 6.5);

    bctx.fillStyle = deckCol;
    bctx.beginPath();
    bctx.moveTo(lX0, lY0);
    bctx.lineTo(lX1, lY1);
    bctx.lineTo(lX1 - 5, lY1 + deckThick * 0.38);
    bctx.lineTo(lX1 + 2, lY1 + deckThick * 0.72);
    bctx.lineTo(lX1 - 7, lY1 + deckThick * 1.05);
    bctx.lineTo(lX0, lY0 + deckThick * 1.18);
    bctx.closePath();
    bctx.fill();

    // Jagged rebar stubs on left broken tip
    bctx.strokeStyle = deckCol;
    bctx.lineWidth = 1.5;
    bctx.beginPath();
    bctx.moveTo(lX1 - 1, lY1 + 3);
    bctx.lineTo(lX1 + 11, lY1 + 5);
    bctx.moveTo(lX1 - 3, lY1 + 9);
    bctx.lineTo(lX1 + 9, lY1 + 14);
    bctx.stroke();

    // Sunlit top-left edge highlight on main span
    bctx.strokeStyle = rimCol;
    bctx.lineWidth = 1.2;
    bctx.beginPath();
    bctx.moveTo(lX0, lY0);
    bctx.lineTo(lX1, lY1);
    bctx.stroke();

    // Left Viaduct — Broken Counter-Span across the collapsed gap (kept cleanly below floating island)
    const gX0 = w * 0.156;
    const gY0 = h * 0.662;
    const gX1 = w * 0.232;
    const gY1 = h * 0.640;
    drawPier(w * 0.194, h * 0.658, h * 0.95, 9, 13);
    drawPosts(gX0 + 8, gY0 - 2, gX1 - 6, gY1 + 1, 4, 5.5);

    bctx.fillStyle = deckCol;
    bctx.beginPath();
    bctx.moveTo(gX0, gY0 + 3);
    bctx.lineTo(gX1, gY1);
    bctx.lineTo(gX1 - 4, gY1 + deckThick * 0.85);
    bctx.lineTo(gX0 - 3, gY0 + deckThick * 0.92);
    bctx.lineTo(gX0 + 3, gY0 + deckThick * 0.45);
    bctx.closePath();
    bctx.fill();

    bctx.strokeStyle = rimCol;
    bctx.lineWidth = 1.1;
    bctx.beginPath();
    bctx.moveTo(gX0, gY0 + 3);
    bctx.lineTo(gX1, gY1);
    bctx.stroke();

    // Right Viaduct — Broken Elevated Deck reaching inward from right edge above bottom dock
    const rX0 = w * 0.785;
    const rY0 = h * 0.662;
    const rX1 = w + 14;
    const rY1 = h * 0.738;
    drawPier(w * 0.850, h * 0.690, h * 0.95, 11, 15);
    drawPier(w * 0.942, h * 0.724, h * 0.95, 13, 17);
    drawPosts(rX0 + 8, rY0 + 2, w - 8, h * 0.732, 7, 6.5);

    bctx.fillStyle = deckCol;
    bctx.beginPath();
    bctx.moveTo(rX0, rY0);
    bctx.lineTo(rX1, rY1);
    bctx.lineTo(rX1, rY1 + deckThick * 1.16);
    bctx.lineTo(rX0 + 5, rY0 + deckThick * 1.02);
    bctx.lineTo(rX0 - 3, rY0 + deckThick * 0.68);
    bctx.lineTo(rX0 + 4, rY0 + deckThick * 0.34);
    bctx.closePath();
    bctx.fill();

    bctx.strokeStyle = deckCol;
    bctx.lineWidth = 1.5;
    bctx.beginPath();
    bctx.moveTo(rX0 + 1, rY0 + 3);
    bctx.lineTo(rX0 - 10, rY0 + 6);
    bctx.moveTo(rX0 + 3, rY0 + 9);
    bctx.lineTo(rX0 - 8, rY0 + 14);
    bctx.stroke();

    bctx.strokeStyle = rimCol;
    bctx.lineWidth = 1.1;
    bctx.beginPath();
    bctx.moveTo(rX0, rY0);
    bctx.lineTo(rX1, rY1);
    bctx.stroke();

    bctx.restore();
  }

  function drawBakedGodRays(bctx, w, h) {
    const shafts = [
      { ox: -36, oy: -12, ang: 0.575, len: Math.hypot(w, h) * 0.64, width: 118, alpha: 0.072 },
      { ox: w * 0.075, oy: -24, ang: 0.615, len: Math.hypot(w, h) * 0.70, width: 152, alpha: 0.084 },
      { ox: w * 0.185, oy: -32, ang: 0.650, len: Math.hypot(w, h) * 0.58, width: 102, alpha: 0.056 }
    ];
    const bands = [
      { scale: 1.38, weight: 0.18 },
      { scale: 0.94, weight: 0.28 },
      { scale: 0.58, weight: 0.32 },
      { scale: 0.28, weight: 0.22 }
    ];
    bctx.save();
    for (let i = 0; i < shafts.length; i++) {
      const sh = shafts[i];
      bctx.save();
      bctx.translate(sh.ox, sh.oy);
      bctx.rotate(sh.ang);
      for (let b = 0; b < bands.length; b++) {
        const bd = bands[b];
        const halfH = (sh.width * bd.scale) * 0.5;
        const a0 = sh.alpha * bd.weight;
        const grad = bctx.createLinearGradient(0, 0, sh.len, 0);
        grad.addColorStop(0, `rgba(255, 224, 165, ${a0.toFixed(4)})`);
        grad.addColorStop(0.45, `rgba(255, 224, 165, ${(a0 * 0.62).toFixed(4)})`);
        grad.addColorStop(1, 'rgba(255, 224, 165, 0)');
        bctx.fillStyle = grad;
        bctx.beginPath();
        bctx.moveTo(0, -halfH * 0.78);
        bctx.lineTo(sh.len, -halfH * 1.45);
        bctx.lineTo(sh.len, halfH * 1.45);
        bctx.lineTo(0, halfH * 0.78);
        bctx.closePath();
        bctx.fill();
      }
      bctx.restore();
    }
    bctx.restore();
  }

  function bakeDioramaBackdrop(bctx, w, h, isSil, isNightBg) {
    if (isSil) {
      bctx.fillStyle = '#EEF1F4';
      bctx.fillRect(0, 0, w, h);
      return;
    }

    // 1. Moody Sky & Abyss Mist Gradient (zero #5EF2FF cyan)
    const skyGrad = bctx.createLinearGradient(0, 0, 0, h);
    if (isNightBg) {
      skyGrad.addColorStop(0, '#111C30');
      skyGrad.addColorStop(0.48, '#08101E');
      skyGrad.addColorStop(1, '#04070F');
    } else {
      skyGrad.addColorStop(0, '#2C3E4C');
      skyGrad.addColorStop(0.48, '#1B2934');
      skyGrad.addColorStop(1, '#101922');
    }
    bctx.fillStyle = skyGrad;
    bctx.fillRect(0, 0, w, h);

    // Soft upper-center/left mist halo or distant cool moonlight horizon glow
    const mistCx = isNightBg ? w * 0.48 : w * 0.36;
    const mistCy = isNightBg ? h * 0.38 : h * 0.32;
    const mistRad = Math.max(w, h) * 0.64;
    const mistGlow = bctx.createRadialGradient(mistCx, mistCy, 24, mistCx, mistCy, mistRad);
    if (isNightBg) {
      mistGlow.addColorStop(0, 'rgba(48, 76, 124, 0.28)');
      mistGlow.addColorStop(0.55, 'rgba(24, 42, 74, 0.14)');
      mistGlow.addColorStop(1, 'rgba(4, 7, 15, 0)');
    } else {
      mistGlow.addColorStop(0, 'rgba(68, 94, 112, 0.38)');
      mistGlow.addColorStop(0.55, 'rgba(42, 62, 76, 0.18)');
      mistGlow.addColorStop(1, 'rgba(16, 25, 34, 0)');
    }
    bctx.fillStyle = mistGlow;
    bctx.fillRect(0, 0, w, h);

    // Subtle atmospheric horizon mist band behind far silhouettes so ruins & stacks separate crisply
    const horizonMist = bctx.createLinearGradient(0, h * 0.34, 0, h * 0.68);
    if (isNightBg) {
      horizonMist.addColorStop(0, 'rgba(22, 38, 66, 0)');
      horizonMist.addColorStop(0.54, 'rgba(28, 48, 84, 0.34)');
      horizonMist.addColorStop(1, 'rgba(8, 16, 30, 0)');
    } else {
      horizonMist.addColorStop(0, 'rgba(54, 76, 92, 0)');
      horizonMist.addColorStop(0.54, 'rgba(58, 82, 98, 0.38)');
      horizonMist.addColorStop(1, 'rgba(27, 41, 52, 0)');
    }
    bctx.fillStyle = horizonMist;
    bctx.fillRect(0, h * 0.34, w, h * 0.34);

    // 2. Far-Ground Silhouettes (Left factory & twin smokestacks, Right ruined skyline & radio mast)
    drawFarDioramaSilhouettes(bctx, w, h, isNightBg);

    // 3. Fog Band 1: separates far horizon from mid-ground viaducts
    const fogBand1 = bctx.createLinearGradient(0, h * 0.44, 0, h * 0.74);
    if (isNightBg) {
      fogBand1.addColorStop(0, 'rgba(16, 28, 52, 0)');
      fogBand1.addColorStop(0.52, 'rgba(22, 38, 68, 0.38)');
      fogBand1.addColorStop(1, 'rgba(6, 11, 22, 0)');
    } else {
      fogBand1.addColorStop(0, 'rgba(44, 65, 80, 0)');
      fogBand1.addColorStop(0.52, 'rgba(48, 70, 86, 0.36)');
      fogBand1.addColorStop(1, 'rgba(18, 28, 38, 0)');
    }
    bctx.fillStyle = fogBand1;
    bctx.fillRect(0, h * 0.44, w, h * 0.32);

    // 4. Mid-Ground Broken Elevated Highway / Viaduct Bridges
    drawBrokenViaducts(bctx, w, h, isNightBg);

    // 5. Fog Band 2: hugs viaduct piers behind conifer ridges
    const fogBand2 = bctx.createLinearGradient(0, h * 0.62, 0, h * 0.94);
    if (isNightBg) {
      fogBand2.addColorStop(0, 'rgba(10, 20, 38, 0)');
      fogBand2.addColorStop(0.55, 'rgba(14, 26, 48, 0.40)');
      fogBand2.addColorStop(1, 'rgba(4, 7, 15, 0.28)');
    } else {
      fogBand2.addColorStop(0, 'rgba(30, 46, 58, 0)');
      fogBand2.addColorStop(0.55, 'rgba(32, 50, 64, 0.38)');
      fogBand2.addColorStop(1, 'rgba(12, 20, 28, 0.25)');
    }
    bctx.fillStyle = fogBand2;
    bctx.fillRect(0, h * 0.62, w, h * 0.34);

    // 6. Multi-Tier Conifer / Pine Forest Ridges framing lower-left & lower-right corners above bottom dock
    const backPineCol = isNightBg ? '#060D1A' : '#111B24';
    const frontPineCol = isNightBg ? '#03070E' : '#091117';
    const pineRim = isNightBg ? 'rgba(54, 84, 130, 0.18)' : 'rgba(98, 130, 148, 0.16)';
    drawConiferRidge(bctx, -12, w * 0.34, h * 0.69, h * 0.86, h, 26, 56, 18, 17, backPineCol, pineRim);
    drawConiferRidge(bctx, w + 12, w * 0.66, h * 0.70, h * 0.86, h, 26, 54, 18, 29, backPineCol, pineRim);
    drawConiferRidge(bctx, -12, w * 0.25, h * 0.76, h * 0.90, h, 28, 62, 19, 41, frontPineCol, null);
    drawConiferRidge(bctx, w + 12, w * 0.75, h * 0.77, h * 0.90, h, 28, 60, 19, 53, frontPineCol, null);

    // 7. Baked Daytime Upper-Left God-Rays (zero per-frame cost)
    if (!isNightBg) {
      drawBakedGodRays(bctx, w, h);
    }
  }

  const _cloudPts = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ];
  const _cloudCenter = { x: 0, y: 0 };

  function drawDriftingCloudShadows(ctx, N, state, timeSec, zScale, w, h) {
    const Iso = ZS.Iso;
    const stamp = getCloudShadowStamp();
    const nightT = Math.max(0, Math.min(1, state.nightAlpha || 0));
    const tSec = Number.isFinite(timeSec) ? timeSec : 0;

    const periods = [44, 56, 49];
    const offsets = [0.14, 0.48, 0.81];
    const lanes = [-5.8, 0.6, 6.2];
    const baseRadii = [82, 98, 90];
    const dayAlphas = [0.064, 0.072, 0.058];
    const nightAlphas = [0.024, 0.027, 0.023];

    Iso.projectTo(0, 0, 0, _cloudPts[0]);
    Iso.projectTo(N, 0, 0, _cloudPts[1]);
    Iso.projectTo(N, N, 0, _cloudPts[2]);
    Iso.projectTo(0, N, 0, _cloudPts[3]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(_cloudPts[0].x, _cloudPts[0].y);
    ctx.lineTo(_cloudPts[1].x, _cloudPts[1].y);
    ctx.lineTo(_cloudPts[2].x, _cloudPts[2].y);
    ctx.lineTo(_cloudPts[3].x, _cloudPts[3].y);
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < 3; i++) {
      const phase = (((tSec / periods[i]) + offsets[i]) % 1 + 1) % 1;
      const edgeFade = Math.min(1, Math.min(phase, 1 - phase) / 0.14);
      const alpha = (dayAlphas[i] * (1 - nightT) + nightAlphas[i] * nightT) * edgeFade;
      if (alpha <= 0.002) continue;

      const travel = -5.5 + phase * (N + 11);
      const lane = lanes[i];
      const gx = travel + lane * 0.65;
      const gy = travel * 0.92 - lane * 0.65;
      const p = Iso.projectTo(gx, gy, 0, _cloudCenter);
      const rx = baseRadii[i] * 2.4 * zScale;
      const ry = baseRadii[i] * 1.15 * zScale;
      if (!isScreenVisible(p.x, p.y, rx, ry, ry, w, h)) continue;

      ctx.globalAlpha = alpha;
      ctx.drawImage(stamp, p.x - rx, p.y - ry, rx * 2, ry * 2);
    }

    ctx.restore();
  }

  function parseColorRgb(hex) {
    let r = 255;
    let g = 210;
    let b = 122;
    if (typeof hex === 'string' && hex[0] === '#') {
      if (hex.length >= 7) {
        r = parseInt(hex.slice(1, 3), 16) || 0;
        g = parseInt(hex.slice(3, 5), 16) || 0;
        b = parseInt(hex.slice(5, 7), 16) || 0;
      } else if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16) || 0;
        g = parseInt(hex[2] + hex[2], 16) || 0;
        b = parseInt(hex[3] + hex[3], 16) || 0;
      }
    }
    return { r, g, b };
  }

  function getEmissiveGlowStamp(hex) {
    const key = hex || '#FFD27A';
    let stamp = emissiveStampCache.get(key);
    if (stamp) return stamp;
    const sz = 64;
    stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const half = sz * 0.5;
    const { r, g, b } = parseColorRgb(key);
    const grad = sctx.createRadialGradient(half, half, 1.5, half, half, half);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.28)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, sz, sz);
    if (emissiveStampCache.size > 128) emissiveStampCache.clear();
    emissiveStampCache.set(key, stamp);
    return stamp;
  }

  function getTintBucket(state, isSil) {
    if (isSil) return 'sil';
    if (!state || state.nightAlpha <= 0.02) return 0;
    return Math.round(state.nightAlpha * 4);
  }

  function applyStampTint(tintBucket, isSil) {
    const Iso = ZS.Iso;
    if (tintBucket === 'sil' || isSil) {
      Iso.resetRenderModifiers();
    } else if (tintBucket === 0) {
      Iso.setSceneTint('#FFE8BA', 0.055);
      Iso.setEntityFlash(0);
    } else {
      Iso.setSceneTint('#6F9CE8', 0.085 * (tintBucket / 4));
      Iso.setEntityFlash(0);
    }
  }

  function mergeGlowCluster(clusters, cx, cy, hex, count, mergeR2) {
    let matched = null;
    for (let j = clusters.length - 1; j >= 0; j--) {
      const cl = clusters[j];
      if (cl.hex !== hex) continue;
      const dx = cx - cl.cx;
      const dy = cy - cl.cy;
      if (dx * dx + dy * dy <= mergeR2) {
        matched = cl;
        break;
      }
    }
    if (matched) {
      const n = matched.count;
      const total = n + count;
      matched.cx = (matched.cx * n + cx * count) / total;
      matched.cy = (matched.cy * n + cy * count) / total;
      matched.count = total;
    } else {
      clusters.push({ hex, cx, cy, count });
    }
  }

  function bakeEmissiveStamp(stampEmis, logicalW, logicalH, scale, anchorX, anchorY) {
    if (!stampEmis || stampEmis.length === 0) {
      return { emissiveCanvas: null, glowClusters: null };
    }
    const Iso = ZS.Iso;
    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = Math.round(logicalW * scale);
    emissiveCanvas.height = Math.round(logicalH * scale);
    const ectx = emissiveCanvas.getContext('2d');
    ectx.setTransform(scale, 0, 0, scale, 0, 0);
    ectx.clearRect(0, 0, logicalW, logicalH);
    ectx.globalAlpha = 1.0;

    const mergeR = 14;
    const mergeR2 = mergeR * mergeR;
    const glowClusters = [];

    for (let i = 0; i < stampEmis.length; i++) {
      const e = stampEmis[i];
      let cx = 0;
      let cy = 0;
      if (e.kind === 'dot') {
        ectx.beginPath();
        ectx.arc(e.p.x, e.p.y, e.r, 0, Math.PI * 2);
        ectx.fillStyle = e.fill || Iso.shadeHex(e.hex, 1);
        ectx.fill();
        cx = e.p.x;
        cy = e.p.y;
      } else {
        const pts = e.pts;
        if (!pts || pts.length === 0) continue;
        ectx.beginPath();
        for (let k = 0; k < pts.length; k++) {
          const pt = pts[k];
          if (k === 0) ectx.moveTo(pt.x, pt.y);
          else ectx.lineTo(pt.x, pt.y);
          cx += pt.x;
          cy += pt.y;
        }
        ectx.closePath();
        ectx.fillStyle = e.fill;
        ectx.fill();
        cx /= pts.length;
        cy /= pts.length;
      }

      const dxA = cx - anchorX;
      const dyA = cy - anchorY;
      const hex = e.hex && e.hex[0] === '#' ? e.hex.toUpperCase() : '#FFD27A';
      let matched = null;
      for (let j = glowClusters.length - 1; j >= 0; j--) {
        const cl = glowClusters[j];
        if (cl.hex !== hex) continue;
        const ddx = dxA - cl.dx;
        const ddy = dyA - cl.dy;
        if (ddx * ddx + ddy * ddy <= mergeR2) {
          matched = cl;
          break;
        }
      }
      if (matched) {
        const n = matched.count;
        matched.dx = (matched.dx * n + dxA) / (n + 1);
        matched.dy = (matched.dy * n + dyA) / (n + 1);
        matched.count = n + 1;
      } else {
        glowClusters.push({ dx: dxA, dy: dyA, hex, count: 1 });
      }
    }

    return { emissiveCanvas, glowClusters };
  }

  function bakeSpriteStamp(logicalW, logicalH, scale, anchorX, anchorY, tintBucket, isSil, bakeFn) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(logicalW * scale);
    cv.height = Math.round(logicalH * scale);
    const sctx = cv.getContext('2d');

    const Iso = ZS.Iso;
    const prevVp = Iso.getViewport();
    const prevMinZoom = Iso.cam.minZoom;
    const prevCamX = Iso.cam.x;
    const prevCamY = Iso.cam.y;
    const prevZoom = Iso.cam.zoom;
    const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;
    const prevMods = Iso.getRenderModifiers();
    const prevEmis = R.emissiveList;
    const stampEmis = isSil ? null : [];
    let bakedEmis = null;

    try {
      if (Iso.setElevationOffset) Iso.setElevationOffset(0);
      Iso.setViewport(logicalW, logicalH);
      Iso.cam.zoom = 1.0;
      Iso.cam.x = logicalW * 0.5 - anchorX;
      Iso.cam.y = logicalH * 0.5 - anchorY;

      sctx.setTransform(scale, 0, 0, scale, 0, 0);
      sctx.clearRect(0, 0, logicalW, logicalH);

      applyStampTint(tintBucket, isSil);
      R.emissiveList = stampEmis;
      bakeFn(sctx);
      bakedEmis = bakeEmissiveStamp(stampEmis, logicalW, logicalH, scale, anchorX, anchorY);
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.minZoom = prevMinZoom;
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
      Iso.setRenderModifiers(prevMods);
      R.emissiveList = prevEmis;
    }

    return {
      canvas: cv,
      logicalW,
      logicalH,
      anchorX,
      anchorY,
      emissiveCanvas: bakedEmis ? bakedEmis.emissiveCanvas : null,
      glowClusters: bakedEmis ? bakedEmis.glowClusters : null
    };
  }

  const _blitOrigin = { x: 0, y: 0 };

  function blitSpriteStamp(ctx, stamp, gx, gy, zScale, isSil, snapPixel) {
    const origin = ZS.Iso.projectTo(gx, gy, 0, _blitOrigin);
    const rawDstX = origin.x - stamp.anchorX * zScale;
    const rawDstY = origin.y - stamp.anchorY * zScale;
    let dstX = rawDstX;
    let dstY = rawDstY;
    if (snapPixel) {
      const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5);
      dstX = Math.round(rawDstX * dpr) / dpr;
      dstY = Math.round(rawDstY * dpr) / dpr;
    }
    const dstW = stamp.logicalW * zScale;
    const dstH = stamp.logicalH * zScale;
    ctx.drawImage(stamp.canvas, dstX, dstY, dstW, dstH);
    if (R.emissiveList && !isSil && stamp.emissiveCanvas) {
      const snapDx = snapPixel ? (dstX - rawDstX) : 0;
      const snapDy = snapPixel ? (dstY - rawDstY) : 0;
      R.emissiveList.push({
        kind: 'stamp',
        canvas: stamp.emissiveCanvas,
        x: dstX,
        y: dstY,
        w: dstW,
        h: dstH,
        originX: origin.x + snapDx,
        originY: origin.y + snapDy,
        glowClusters: stamp.glowClusters,
        alpha: R.currentEntityAlpha != null ? R.currentEntityAlpha : 1.0
      });
    }
  }

  function isScreenVisible(sx, sy, padX, padTop, padBot, w, h) {
    return sx >= -padX && sx <= w + padX && sy >= -padTop && sy <= h + padBot;
  }

  const _visPt = { x: 0, y: 0 };

  function isGridVisible(gx, gy, padX, padTop, padBot, w, h) {
    const p = ZS.Iso.projectTo(gx, gy, 0, _visPt);
    return p.x >= -padX && p.x <= w + padX && p.y >= -padTop && p.y <= h + padBot;
  }

  function getEyeHaloStamp(glowColor) {
    let stamp = eyeHaloCache.get(glowColor);
    if (stamp) return stamp;
    const sz = 48;
    stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const half = sz * 0.5;
    const grad = sctx.createRadialGradient(half, half, 1.5, half, half, half);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, sz, sz);
    eyeHaloCache.set(glowColor, stamp);
    return stamp;
  }

  function computeBlackoutElectricPowered(state, timeSec) {
    if (!state.isNight) return true;
    if (!state.blackoutActive) return true;
    const flk = state.blackoutFlickerTimer || 0;
    if (flk > 0) {
      // Rapid fluorescent stutter over 0.5s before plunging into full blackout (#8)
      const wave = Math.sin(timeSec * 62) + 0.55 * Math.cos(timeSec * 97);
      return wave > -0.15 + (0.5 - flk) * 0.9;
    }
    return false;
  }

  function getTileElevAt(state, gx, gy) {
    if (ZS.Game && ZS.Game.getTerrainElevationAt) {
      return ZS.Game.getTerrainElevationAt(gx, gy);
    }
    const tGrid = state && state.terrainGrid;
    if (!tGrid) return 0;
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    const t = tGrid[ty] && tGrid[ty][tx];
    if (!t) return 0;
    if (t.kind === 'plateau') return t.elev != null ? t.elev : 10;
    if (t.kind === 'ramp') return t.elev != null ? t.elev : 5;
    return 0;
  }

  function ensureTerrainCache(N, meta, state, P, isSil) {
    const Iso = ZS.Iso;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5);
    const worldMinX = -N * (Iso.TILE_W * 0.5) - 24;
    const worldMaxX = N * (Iso.TILE_W * 0.5) + 24;
    const worldMinY = -24;
    const worldMaxY = (N + 0.4) * Iso.TILE_H + 36;
    const worldW = Math.ceil(worldMaxX - worldMinX);
    const worldH = Math.ceil(worldMaxY - worldMinY);
    const bakeScale = Math.min(3.0, Math.max(2.0, dpr * 1.25), 6144 / Math.max(1, worldW));
    const totalCells = N * N;
    const tSeed = state.terrainSeed || 0;
    const tGrid = state.terrainGrid || null;

    let dirty =
      terrainCache.N !== N ||
      terrainCache.seed !== tSeed ||
      terrainCache.terrainGridRef !== tGrid ||
      terrainCache.isSil !== isSil ||
      terrainCache.bakeScale !== bakeScale ||
      !terrainCache.floorIds ||
      terrainCache.floorIds.length !== totalCells;

    if (!dirty) {
      const fg = state.floorGrid;
      const sg = state.structGrid;
      for (let y = 0; y < N && !dirty; y++) {
        const fRow = fg && fg[y];
        const sRow = sg && sg[y];
        const tRow = tGrid && tGrid[y];
        const mRow = meta.grid[y];
        const rowOff = y * N;
        for (let x = 0; x < N; x++) {
          const idx = rowOff + x;
          const fid = (fRow && fRow[x]) || null;
          if (terrainCache.floorIds[idx] !== fid) {
            dirty = true;
            break;
          }
          const tCell = tRow && tRow[x];
          if (!fid && !tCell && mRow[x].decal) {
            const occ = Boolean(sRow && sRow[x]);
            if (terrainCache.decalOcc[idx] !== occ) {
              dirty = true;
              break;
            }
          }
        }
      }
    }

    if (!dirty) return terrainCache;

    if (!terrainCache.floorIds || terrainCache.floorIds.length !== totalCells) {
      terrainCache.floorIds = new Array(totalCells);
      terrainCache.decalOcc = new Array(totalCells);
    }

    terrainCache.N = N;
    terrainCache.seed = tSeed;
    terrainCache.terrainGridRef = tGrid;
    terrainCache.isSil = isSil;
    terrainCache.bakeScale = bakeScale;
    terrainCache.worldMinX = worldMinX;
    terrainCache.worldMinY = worldMinY;
    terrainCache.worldW = worldW;
    terrainCache.worldH = worldH;

    const cw = Math.max(1, Math.round(worldW * bakeScale));
    const ch = Math.max(1, Math.round(worldH * bakeScale));
    if (terrainCache.canvas.width !== cw || terrainCache.canvas.height !== ch) {
      terrainCache.canvas.width = cw;
      terrainCache.canvas.height = ch;
    }
    const tctx = terrainCache.ctx || (terrainCache.ctx = terrainCache.canvas.getContext('2d'));

    const prevVp = Iso.getViewport();
    const prevMinZoom = Iso.cam.minZoom;
    const prevCamX = Iso.cam.x;
    const prevCamY = Iso.cam.y;
    const prevZoom = Iso.cam.zoom;
    const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;

    try {
      if (Iso.setElevationOffset) Iso.setElevationOffset(0);
      Iso.setViewport(worldW, worldH);
      Iso.cam.zoom = 1.0;
      Iso.cam.x = worldMinX + worldW * 0.5;
      Iso.cam.y = worldMinY + worldH * 0.5;
      tctx.setTransform(bakeScale, 0, 0, bakeScale, 0, 0);
      tctx.clearRect(0, 0, worldW, worldH);

      if (isSil) {
        Iso.resetRenderModifiers();
      } else {
        Iso.setSceneTint('#FFE8BA', 0.055);
      }

      drawIslandSlab(tctx, N, P, 1.0);

      for (let y = 0; y < N; y++) {
        const fRow = state.floorGrid && state.floorGrid[y];
        const sRow = state.structGrid && state.structGrid[y];
        const tRow = tGrid && tGrid[y];
        const rowOff = y * N;
        for (let x = 0; x < N; x++) {
          const cell = meta.grid[y][x];
          const tCell = (tRow && tRow[x]) || null;
          const isEdge = cell.isEdge;
          const checker = (x + y) % 2 === 0;
          const rawBase = isEdge
            ? checker
              ? P.terrainEdgeA
              : P.terrainEdgeB
            : checker
            ? P.terrainA
            : P.terrainB;
          const fid = (fRow && fRow[x]) || null;
          const occ = Boolean(sRow && sRow[x]);
          terrainCache.floorIds[rowOff + x] = fid;
          terrainCache.decalOcc[rowOff + x] = occ;

          if (tCell && tCell.kind === 'plateau') {
            // Plateau has its own elevated 3D block & top surface; keep flat under-tile muted soil
            const underFill = isSil ? '#C4CCD4' : '#39463B';
            Iso.drawTilePoly(tctx, x, y, 0, underFill, underFill, 0.5);
            continue;
          }

          const tileFill = isSil ? (isEdge ? '#CBD3DB' : '#D5DBE1') : Iso.shadeHex(rawBase, cell.shadeFactor);
          Iso.drawTilePoly(tctx, x, y, 0, tileFill, tileFill, 0.65);

          if (tCell && tCell.kind === 'rock') {
            if (!isSil) {
              const bedP = Iso.gridToScreen(x + 0.5, y + 0.5, 0.15);
              tctx.fillStyle = 'rgba(12, 16, 14, 0.16)';
              tctx.beginPath();
              tctx.ellipse(bedP.x, bedP.y, tCell.isPeak ? 25 : 22, tCell.isPeak ? 12.5 : 11, 0, 0, Math.PI * 2);
              tctx.fill();
            }
            continue;
          }

          if (tCell && tCell.kind === 'ramp') {
            if (!isSil) {
              const bedP = Iso.gridToScreen(x + 0.5, y + 0.5, 0.15);
              tctx.fillStyle = 'rgba(26, 24, 20, 0.16)';
              tctx.beginPath();
              tctx.ellipse(bedP.x, bedP.y, 21, 10.5, 0, 0, Math.PI * 2);
              tctx.fill();
            }
            continue;
          }

          if (fid) {
            drawFloorTile(tctx, x, y, fid, 1.0);
          } else {
            if (!isSil) {
              drawTileMicroGrain(tctx, x, y, isEdge, occ);
            }
            if (cell.decal && !occ) {
              drawTerrainDecal(tctx, x, y, cell.decal, 1.0);
            }
          }
        }
      }

      if (!isSil) {
        drawQuarantineBorder(tctx, N, P, false, 1.0);
      }
      terrainCache.bakeCount += 1;
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.minZoom = prevMinZoom;
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
    }

    return terrainCache;
  }

  function drawEditGridOverlay(ctx, N, meta, uiState, w, h, zScale) {
    const Iso = ZS.Iso;
    ctx.save();

    // Inner buildable grid lines (batched into 1 path)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= N - 1; i++) {
      const a = Iso.gridToScreen(i, 1, 0);
      const b = Iso.gridToScreen(i, N - 1, 0);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const c = Iso.gridToScreen(1, i, 0);
      const d = Iso.gridToScreen(N - 1, i, 0);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
    }
    ctx.stroke();

    // Outer quarantine ring grid lines (batched into 1 path)
    ctx.strokeStyle = 'rgba(255, 77, 109, 0.28)';
    ctx.beginPath();
    const o0 = Iso.gridToScreen(0, 0, 0);
    const o1 = Iso.gridToScreen(N, 0, 0);
    const o2 = Iso.gridToScreen(N, N, 0);
    const o3 = Iso.gridToScreen(0, N, 0);
    ctx.moveTo(o0.x, o0.y);
    ctx.lineTo(o1.x, o1.y);
    ctx.lineTo(o2.x, o2.y);
    ctx.lineTo(o3.x, o3.y);
    ctx.closePath();
    for (let i = 1; i < N; i++) {
      let pA = Iso.gridToScreen(i, 0, 0);
      let pB = Iso.gridToScreen(i, 1, 0);
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      pA = Iso.gridToScreen(i, N - 1, 0);
      pB = Iso.gridToScreen(i, N, 0);
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      pA = Iso.gridToScreen(0, i, 0);
      pB = Iso.gridToScreen(1, i, 0);
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      pA = Iso.gridToScreen(N - 1, i, 0);
      pB = Iso.gridToScreen(N, i, 0);
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
    }
    ctx.stroke();

    // Outer edge build-prohibition X markers (culled & batched)
    if (uiState.mode === 'build') {
      const pad = 20 * zScale;
      ctx.strokeStyle = 'rgba(255, 77, 109, 0.22)';
      ctx.lineWidth = Math.max(1, 1.1 * zScale);
      ctx.beginPath();
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          if (!meta.grid[y][x].isEdge) continue;
          const c = Iso.gridToScreen(x + 0.5, y + 0.5, 0.4);
          if (!isScreenVisible(c.x, c.y, pad, pad, pad, w, h)) continue;
          ctx.moveTo(c.x - 4 * zScale, c.y - 2 * zScale);
          ctx.lineTo(c.x + 4 * zScale, c.y + 2 * zScale);
          ctx.moveTo(c.x + 4 * zScale, c.y - 2 * zScale);
          ctx.lineTo(c.x - 4 * zScale, c.y + 2 * zScale);
        }
      }
      ctx.stroke();
    }

    // Highlighted quarantine perimeter border during edit mode
    const q0 = Iso.gridToScreen(1, 1, 0.5);
    const q1 = Iso.gridToScreen(N - 1, 1, 0.5);
    const q2 = Iso.gridToScreen(N - 1, N - 1, 0.5);
    const q3 = Iso.gridToScreen(1, N - 1, 0.5);
    ctx.strokeStyle = 'rgba(255, 77, 109, 0.68)';
    ctx.lineWidth = Math.max(1.0, 1.35 * zScale);
    ctx.setLineDash([6 * zScale, 5 * zScale]);
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.lineTo(q3.x, q3.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  function render(ctx, w, h, state, uiState, timeSec) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;
    const zScale = Iso.cam.zoom;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    // 1. Cached Background Sky / Diorama Silhouette Backdrop (1x offscreen bake at physical DPR)
    const isNightBg = state.nightAlpha > 0.4;
    const bgDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5);
    if (
      bgCache.w !== w ||
      bgCache.h !== h ||
      bgCache.dpr !== bgDpr ||
      bgCache.isSil !== isSil ||
      bgCache.isNight !== isNightBg
    ) {
      bgCache.w = w;
      bgCache.h = h;
      bgCache.dpr = bgDpr;
      bgCache.isSil = isSil;
      bgCache.isNight = isNightBg;
      bgCache.canvas.width = Math.max(1, Math.round(w * bgDpr));
      bgCache.canvas.height = Math.max(1, Math.round(h * bgDpr));
      const bctx = bgCache.ctx || (bgCache.ctx = bgCache.canvas.getContext('2d'));
      bctx.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bakeDioramaBackdrop(bctx, w, h, isSil, isNightBg);
      bgCache.bakeCount += 1;
    }
    ctx.drawImage(bgCache.canvas, 0, 0, bgCache.canvas.width, bgCache.canvas.height, 0, 0, w, h);

    // Optional mild camera shake ONLY on Airstrike, Boss spawn, and HQ hit (#8 + accessibility toggle)
    const shakeActive =
      (!ZS.Game || !ZS.Game.isScreenShakeEnabled || ZS.Game.isScreenShakeEnabled()) &&
      state.shakeTimer > 0 &&
      state.shakeAmp > 0;
    if (shakeActive) {
      const decay = Math.min(1, state.shakeTimer / (state.shakeDuration || 0.28));
      const amp = state.shakeAmp * decay;
      const sx = Math.sin(timeSec * 67) * amp + Math.cos(timeSec * 41) * amp * 0.35;
      const sy = Math.cos(timeSec * 59) * amp * 0.78;
      ctx.save();
      ctx.translate(sx, sy);
    }

    const meta = ensureTerrainMeta(N);
    const showEditGrid =
      (state.phase === 'day' &&
        (uiState.mode === 'build' || uiState.mode === 'move' || uiState.mode === 'remove')) ||
      uiState.activeSkill === 'airstrike';

    // 2 & 3. World-Baked Static Terrain, Island Slab, Natural Decals, Quarantine Border & Floor Tiles
    const tc = ensureTerrainCache(N, meta, state, P, isSil);
    const dstX = (tc.worldMinX - Iso.cam.x) * zScale + w * 0.5;
    const dstY = (tc.worldMinY - Iso.cam.y) * zScale + h * 0.5;
    const dstW = tc.worldW * zScale;
    const dstH = tc.worldH * zScale;
    const visX0 = Math.max(0, dstX);
    const visY0 = Math.max(0, dstY);
    const visX1 = Math.min(w, dstX + dstW);
    const visY1 = Math.min(h, dstY + dstH);
    if (visX1 > visX0 && visY1 > visY0) {
      const invX = tc.canvas.width / dstW;
      const invY = tc.canvas.height / dstH;
      ctx.drawImage(
        tc.canvas,
        (visX0 - dstX) * invX,
        (visY0 - dstY) * invY,
        (visX1 - visX0) * invX,
        (visY1 - visY0) * invY,
        visX0,
        visY0,
        visX1 - visX0,
        visY1 - visY0
      );
    }

    // Apply day warm-afternoon vs night cool-moonlight ambient tint to matte voxel surfaces
    if (state.nightAlpha > 0.02) {
      Iso.setSceneTint('#6F9CE8', 0.085 * state.nightAlpha);
    } else {
      Iso.setSceneTint('#FFE8BA', 0.055);
    }

    // Lightweight edit grid overlay (build/move/remove/airstrike without rebaking terrain)
    if (showEditGrid && !isSil) {
      drawEditGridOverlay(ctx, N, meta, uiState, w, h, zScale);
    }

    // Fading zombie death ground stains (#8: drawn flat on ground above tiles/floors, below structures)
    if (!isSil && state.groundDecals && state.groundDecals.length > 0) {
      R.drawGroundStains(ctx, state.groundDecals, zScale, w, h);
    }

    // Lightweight drifting cloud shadows over island terrain (3 pre-baked 96x96 drawImage calls)
    if (!isSil) {
      drawDriftingCloudShadows(ctx, N, state, timeSec, zScale, w, h);
    }

    // Subtle warm afternoon sunlight wash over the inner base during daytime (pre-baked glow stamp)
    if (!isSil && state.nightAlpha < 0.95) {
      const sunCenter = Iso.gridToScreen(DATA.HQ_POS.x + 0.2, DATA.HQ_POS.y + 0.2, 4);
      const sunRad = N * 22 * zScale;
      const dayFactor = Math.max(0, 1 - state.nightAlpha * 1.15);
      if (dayFactor > 0.01 && isScreenVisible(sunCenter.x, sunCenter.y, sunRad, sunRad, sunRad, w, h)) {
        const sunStamp = getGlowStamp('rgba(255, 222, 162, 1)', 0.08);
        ctx.save();
        ctx.globalAlpha = 0.085 * dayFactor;
        ctx.drawImage(sunStamp, sunCenter.x - sunRad, sunCenter.y - sunRad, sunRad * 2, sunRad * 2);
        ctx.restore();
      }
    }

    // 4. Hover / Placement Range & Aura Rings (Under structures)
    if (uiState.hoverTile) {
      const { tx, ty } = uiState.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        const hovElev = getTileElevAt(state, tx + 0.5, ty + 0.5);
        Iso.setElevationOffset(hovElev);
        try {
          drawHoverOverlay(ctx, state, uiState, tx, ty, zScale);
        } finally {
          Iso.setElevationOffset(0);
        }
      }
    }

    // Selected structure range / aura indicator + base tile floor highlight (occluded by 3D structures)
    if (uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        const selElev = getTileElevAt(state, tx + 0.5, ty + 0.5);
        Iso.setElevationOffset(selElev);
        try {
          Iso.drawTilePoly(ctx, tx, ty, 2.2, P.selectFill, P.selectStroke, 1.8);
          const st = state.structGrid[ty] && state.structGrid[ty][tx];
          if (st) {
            if (st.id === 'command_hq') {
              const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(state.hqLevel) : null;
              if (hqInfo && hqInfo.weapon && hqInfo.weapon.range > 0) {
                drawCombatRangeOverlay(ctx, state, DATA.HQ_STATS, tx + 0.5, ty + 0.5, hqInfo.weapon.range, 0, zScale);
              }
            } else {
              const def = DATA.ITEMS[st.id];
              if (st.id === 'barricade_wall' && st.mounted) {
                const mDef = DATA.ITEMS[st.mounted.id];
                if (mDef) {
                  if (mDef.range > 0 && ZS.Game.getStructureEffectiveStats) {
                    const groundEff = ZS.Game.getStructureEffectiveStats(st.mounted, tx, ty, undefined, false);
                    const mountEff = ZS.Game.getStructureEffectiveStats(st.mounted, tx, ty, undefined, true);
                    drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, groundEff.range, mountEff.range, zScale);
                    if (isDirectFireDef(mDef)) {
                      drawPeakShadowSectors(ctx, state, tx + 0.5, ty + 0.5, mountEff.range, zScale);
                    }
                  }
                  if (mDef.aura && mDef.aura.radius && ZS.Game.getStructureEffectiveStats) {
                    const mEff = ZS.Game.getStructureEffectiveStats(st.mounted, tx, ty, undefined, true);
                    const auraR = mEff.auraRadius || (mDef.aura.radius + (mDef.id === 'led_floodlight' ? 0.4 : 0));
                    drawIsoCircle(ctx, tx + 0.5, ty + 0.5, auraR, P.goldStroke, P.goldFill);
                  }
                }
              } else if (def) {
                const eff = ZS.Game.getStructureEffectiveStats(st, tx, ty);
                if (eff.range > 0) {
                  drawCombatRangeOverlay(ctx, state, def, tx + 0.5, ty + 0.5, eff.range, eff.minRange || def.minRange || 0, zScale);
                }
                if (eff.auraRadius > 0) {
                  drawIsoCircle(ctx, tx + 0.5, ty + 0.5, eff.auraRadius, P.goldStroke, P.goldFill);
                }
                const gateSlowR = (eff.prof && eff.prof.gateSlowRadius) || eff.gateSlowRadius || def.gateSlowRadius;
                if (gateSlowR) {
                  drawIsoCircle(ctx, tx + 0.5, ty + 0.5, gateSlowR, P.rangeStroke, 'rgba(255, 255, 255, 0.08)');
                }
              }
            }
          }
        } finally {
          Iso.setElevationOffset(0);
        }
      }
    }

    // Track read-only active spike trap occupancy before culling
    let activeTrapTiles = null;
    if (state.zombies && state.zombies.length > 0) {
      for (let i = 0; i < state.zombies.length; i++) {
        const z = state.zombies[i];
        if (!z || z.leapState || z.hp <= 0) continue;
        const ztx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
        const zty = Math.max(0, Math.min(N - 1, Math.floor(z.y)));
        const st = state.structGrid[zty] && state.structGrid[zty][ztx];
        if (st && st.id === 'razor_pad') {
          if (!activeTrapTiles) activeTrapTiles = new Map();
          const key = `${ztx},${zty}`;
          activeTrapTiles.set(key, (activeTrapTiles.get(key) || 0) + 1);
        }
      }
    }
    if (state.projectiles && state.projectiles.length > 0) {
      for (let i = 0; i < state.projectiles.length; i++) {
        const p = state.projectiles[i];
        if (!p || p.kind !== 'bleed_burst') continue;
        const ptx = Math.max(0, Math.min(N - 1, Math.floor(p.x)));
        const pty = Math.max(0, Math.min(N - 1, Math.floor(p.y)));
        const st = state.structGrid[pty] && state.structGrid[pty][ptx];
        if (st && st.id === 'razor_pad') {
          if (!activeTrapTiles) activeTrapTiles = new Map();
          const key = `${ptx},${pty}`;
          activeTrapTiles.set(key, (activeTrapTiles.get(key) || 0) + 2);
        }
      }
    }
    R.activeTrapTiles = activeTrapTiles;

    // 5. Collect & Depth-Sort Visible Structures + Perimeter Props + Zombies (Safe-Margin Frustum Culling)
    const cullPadX = Math.max(85, 110 * zScale);
    const cullPadTop = Math.max(55, 72 * zScale);
    const cullPadBot = Math.max(95, 130 * zScale);
    const propPadX = Math.max(48, 60 * zScale);
    const propPadY = Math.max(40, 50 * zScale);
    const zPadX = Math.max(90, 120 * zScale);
    const zPadTop = Math.max(60, 80 * zScale);
    const zPadBot = Math.max(95, 125 * zScale);

    const renderList = [];
    const tGrid = state.terrainGrid;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const tCell = tGrid && tGrid[y] && tGrid[y][x];
        if (tCell && (tCell.kind === 'plateau' || tCell.kind === 'ramp' || tCell.kind === 'rock')) {
          if (isGridVisible(x + 0.5, y + 0.5, cullPadX, cullPadTop, cullPadBot, w, h)) {
            renderList.push({
              kind: tCell.kind,
              depth: (x + 0.48) + (y + 0.48),
              tx: x,
              ty: y,
              terrain: tCell
            });
          }
        }

        const st = state.structGrid[y][x];
        if (!st) continue;
        if (!isGridVisible(x + 0.5, y + 0.5, cullPadX, cullPadTop, cullPadBot, w, h)) continue;
        const def = st.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[st.id];
        const onElevTerrain = !!(tCell && (tCell.kind === 'plateau' || tCell.kind === 'ramp'));
        const depthOffset = def && def.passable ? (onElevTerrain ? 0.98 : 0.15) : 1.0;
        renderList.push({
          kind: 'struct',
          depth: x + y + depthOffset,
          tx: x,
          ty: y,
          st
        });
      }
    }

    for (let i = 0; i < meta.edgeProps.length; i++) {
      const ep = meta.edgeProps[i];
      if (!isGridVisible(ep.gx + 0.2, ep.gy + 0.2, propPadX, propPadY, propPadY, w, h)) continue;
      renderList.push({
        kind: 'edge_prop',
        depth: ep.gx + ep.gy + 0.08,
        ep
      });
    }

    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      let visible = isGridVisible(z.x, z.y, zPadX, zPadTop, zPadBot, w, h);
      if (!visible && z.leapState) {
        visible = isGridVisible(z.leapState.targetX, z.leapState.targetY, zPadX, zPadTop, zPadBot, w, h);
      }
      if (!visible && z.chargeState) {
        visible = isGridVisible(z.chargeState.targetX, z.chargeState.targetY, zPadX, zPadTop, zPadBot, w, h);
      }
      if (!visible) continue;
      const zElev = getTileElevAt(state, z.x, z.y);
      const rawZDepth = z.x + z.y + 0.05;
      const zDepth = zElev > 0 ? Math.max(rawZDepth, Math.floor(z.x) + Math.floor(z.y) + 0.99) : rawZDepth;
      renderList.push({
        kind: 'zombie',
        depth: zDepth,
        z
      });
    }

    if (state.dyingZombies) {
      for (let i = 0; i < state.dyingZombies.length; i++) {
        const dz = state.dyingZombies[i];
        if (!isGridVisible(dz.x, dz.y, zPadX, zPadTop, zPadBot, w, h)) continue;
        const dzElev = getTileElevAt(state, dz.x, dz.y);
        const rawDzDepth = dz.x + dz.y + 0.04;
        const dzDepth = dzElev > 0 ? Math.max(rawDzDepth, Math.floor(dz.x) + Math.floor(dz.y) + 0.985) : rawDzDepth;
        renderList.push({
          kind: 'dying_zombie',
          depth: dzDepth,
          dz
        });
      }
    }

    renderList.sort((a, b) => a.depth - b.depth);

    const occDt = lastOccTimeSec >= 0 ? Math.min(0.1, Math.max(0, timeSec - lastOccTimeSec)) : 0.016;
    lastOccTimeSec = timeSec;
    const occStep = window.ZS_INSTANT_OCCLUDE ? 1 : (1 - Math.exp(-occDt * 22));
    const activeHoverTile =
      !window.ZS_SILHOUETTE_MODE &&
      !uiState.mainMenuOpen &&
      uiState.pointerClient &&
      uiState.pointerClient.inside &&
      uiState.hoverTile
        ? uiState.hoverTile
        : null;
    let hoverOccluded = false;
    const seenOcc = occludeAlphaMap.size > 0 ? new Set() : null;
    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind !== 'struct' && item.kind !== 'rock') continue;
      const shouldFade = !!(
        activeHoverTile &&
        (item.kind === 'struct'
          ? doesStructOccludeTarget(item.st, item.tx, item.ty, activeHoverTile.tx, activeHoverTile.ty, state)
          : doesRockOccludeTarget(item.tx, item.ty, activeHoverTile.tx, activeHoverTile.ty, state))
      );
      if (shouldFade) hoverOccluded = true;
      const occPrefix = item.kind === 'rock' ? 'r:' : 's:';
      const occKey = (shouldFade || occludeAlphaMap.size > 0) ? (occPrefix + item.tx + ',' + item.ty) : null;
      if (seenOcc && occKey) seenOcc.add(occKey);
      let occA = 1.0;
      if (shouldFade) {
        const prev = occludeAlphaMap.get(occKey);
        const cur = prev != null ? prev : 1.0;
        occA = occStep >= 1 ? 0.28 : cur + (0.28 - cur) * occStep;
        occludeAlphaMap.set(occKey, occA);
      } else if (occKey && occludeAlphaMap.has(occKey)) {
        const cur = occludeAlphaMap.get(occKey);
        const next = occStep >= 1 ? 1.0 : cur + (1.0 - cur) * occStep;
        if (next >= 0.992) {
          occludeAlphaMap.delete(occKey);
          occA = 1.0;
        } else {
          occludeAlphaMap.set(occKey, next);
          occA = next;
        }
      }
      item.occAlpha = occA;
    }
    if (seenOcc) {
      for (const k of occludeAlphaMap.keys()) {
        if (!seenOcc.has(k)) occludeAlphaMap.delete(k);
      }
    }
    R.hoverOccludedByFront = hoverOccluded;

    const powered = computeBlackoutElectricPowered(state, timeSec);
    const statusPowered = !state.isNight || !state.blackoutActive;
    const nightEmissives = state.nightAlpha > 0.02 ? [] : null;
    R.emissiveList = nightEmissives;

    try {
      for (let i = 0; i < renderList.length; i++) {
        const item = renderList[i];
        if (item.kind === 'plateau') {
          Iso.setElevationOffset(0);
          R.emissiveList = null;
          drawPlateauTile(ctx, item.tx, item.ty, item.terrain, state, P, isSil, zScale);
          R.emissiveList = nightEmissives;
        } else if (item.kind === 'ramp') {
          Iso.setElevationOffset(0);
          R.emissiveList = null;
          drawRampTile(ctx, item.tx, item.ty, item.terrain, state, P, isSil, zScale);
          R.emissiveList = nightEmissives;
        } else if (item.kind === 'rock') {
          Iso.setElevationOffset(0);
          R.emissiveList = null;
          const occA = item.occAlpha != null ? item.occAlpha : 1.0;
          if (occA < 0.995) {
            ctx.save();
            ctx.globalAlpha *= occA;
            drawRockTile(ctx, item.tx, item.ty, item.terrain, state, P, isSil, zScale);
            ctx.restore();
          } else {
            drawRockTile(ctx, item.tx, item.ty, item.terrain, state, P, isSil, zScale);
          }
          R.emissiveList = nightEmissives;
        } else if (item.kind === 'struct') {
          const elev = getTileElevAt(state, item.tx + 0.5, item.ty + 0.5);
          Iso.setElevationOffset(elev);
          const occA = item.occAlpha != null ? item.occAlpha : 1.0;
          if (occA < 0.995) {
            ctx.save();
            ctx.globalAlpha *= occA;
            R.currentEntityAlpha = occA;
            R.drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
            R.currentEntityAlpha = 1.0;
            ctx.restore();
          } else {
            R.currentEntityAlpha = 1.0;
            R.drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
          }
        } else if (item.kind === 'edge_prop') {
          Iso.setElevationOffset(0);
          R.emissiveList = null;
          drawPerimeterProp(ctx, item.ep, zScale);
          R.emissiveList = nightEmissives;
        } else if (item.kind === 'zombie') {
          const z = item.z;
          const elev = getTileElevAt(state, z.x, z.y);
          Iso.setElevationOffset(elev);
          const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;
          const pose = R.getQuantizedZombiePoseMetrics
            ? R.getQuantizedZombiePoseMetrics(z, zDef, timeSec, zScale)
            : R.getZombiePoseMetrics(z, zDef, timeSec);
          const eyes = R.getZombieEyePositions(z, zDef, timeSec, zScale, pose);
          const occluded = nightEmissives ? R.isZombieEyesOccluded(state, z, eyes, zScale) : false;
          z._framePose = pose;
          z._frameEyes = eyes;
          z._frameEyesOccluded = occluded;
          R.emissiveList = nightEmissives && eyes && !occluded ? nightEmissives : null;
          R.drawZombie(ctx, z, timeSec, zScale, state);
          R.emissiveList = nightEmissives;
        } else if (item.kind === 'dying_zombie') {
          const elev = getTileElevAt(state, item.dz.x, item.dz.y);
          Iso.setElevationOffset(elev);
          R.emissiveList = null;
          R.drawDyingZombie(ctx, item.dz, zScale);
          R.emissiveList = nightEmissives;
        }
      }
    } finally {
      Iso.setElevationOffset(0);
    }
    R.emissiveList = null;
    R.activeTrapTiles = null;

    // Creeping perimeter mist / fog band along the 4 outer edges ("outside = danger")
    if (!isSil) {
      drawPerimeterFog(ctx, N, state.nightAlpha, timeSec, zScale, w, h);
    }

    // 6. Ghost Preview of Structure Being Built or Moved
    if (uiState.hoverTile && state.phase === 'day') {
      const { tx, ty } = uiState.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        const ghostElev = getTileElevAt(state, tx + 0.5, ty + 0.5);
        Iso.setElevationOffset(ghostElev);
        try {
          drawBuildGhost(ctx, state, uiState, tx, ty, timeSec, zScale);
        } finally {
          Iso.setElevationOffset(0);
        }
      }
    }

    Iso.resetRenderModifiers();

    // 7. Muzzle Flashes, Projectiles & Voxel Debris / Dust Particles (World Space)
    if (state.muzzleFlashes && state.muzzleFlashes.length > 0) {
      R.drawMuzzleFlashes(ctx, state.muzzleFlashes, zScale, w, h);
    }
    R.drawProjectiles(ctx, state.projectiles, zScale, w, h);
    R.drawParticles(ctx, state.particles, zScale, w, h);

    // Warm central base glow on Cozy Tier-Up (radius 3 tiles, 0.8s — pre-baked glow stamp)
    if (!isSil && state.cozyTierUpTimer && state.cozyTierUpTimer > 0) {
      const progress = 1 - Math.max(0, Math.min(1, state.cozyTierUpTimer / 0.8));
      const alpha = Math.sin(progress * Math.PI) * 0.55;
      const center = Iso.gridToScreen(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 10);
      const rPx = (1.6 + progress * 1.4) * 38 * zScale;
      if (alpha > 0.01 && isScreenVisible(center.x, center.y, rPx, rPx, rPx, w, h)) {
        const cozyStamp = getGlowStamp('rgba(255, 204, 86, 1)', 0.06);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.drawImage(cozyStamp, center.x - rPx, center.y - rPx, rPx * 2, rPx * 2);
        ctx.restore();
      }
    }

    // 8. Nighttime Tactical Darkness & Dynamic Glow Layer
    if (!isSil && state.nightAlpha > 0.02) {
      R.drawNightLighting(ctx, w, h, state, powered, timeSec, zScale);
      if (nightEmissives && nightEmissives.length > 0) {
        R.drawEmissivePass(ctx, nightEmissives, state.nightAlpha, zScale, w, h);
      }
    }

    // ── Info Layer (Drawn above darkness: identical daytime brightness & contrast) ──
    // 9. Selection Outline, Structure/Zombie HP Bars, and Blackout OFF Warnings
    if (!isSil) {
      R.drawInfoLayer(ctx, state, uiState, renderList, statusPowered, timeSec, zScale, w, h);
    }

    for (let i = 0; i < renderList.length; i++) {
      if (renderList[i].kind === 'zombie') {
        const z = renderList[i].z;
        z._framePose = null;
        z._frameEyes = null;
        z._frameEyesOccluded = false;
      }
    }

    // 10. Floating Texts (Damage, Loot, Buff Callouts)
    R.drawFloatingTexts(ctx, state.floatingTexts, zScale, w, h);

    if (shakeActive) {
      ctx.restore();
    }
  }

  function drawIslandSlab(ctx, N, P, zScale) {
    const Iso = ZS.Iso;
    if (window.ZS_SILHOUETTE_MODE) {
      const fTopL = Iso.gridToScreen(0, N, 0);
      const fTopF = Iso.gridToScreen(N, N, 0);
      const fTopR = Iso.gridToScreen(N, 0, 0);
      const fBotL = Iso.gridToScreen(0, N, -10);
      const fBotF = Iso.gridToScreen(N, N, -10);
      const fBotR = Iso.gridToScreen(N, 0, -10);
      ctx.fillStyle = '#AEB7C0';
      ctx.beginPath();
      ctx.moveTo(fTopL.x, fTopL.y); ctx.lineTo(fTopF.x, fTopF.y); ctx.lineTo(fBotF.x, fBotF.y); ctx.lineTo(fBotL.x, fBotL.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#98A2AC';
      ctx.beginPath();
      ctx.moveTo(fTopF.x, fTopF.y); ctx.lineTo(fTopR.x, fTopR.y); ctx.lineTo(fBotR.x, fBotR.y); ctx.lineTo(fBotF.x, fBotF.y);
      ctx.closePath(); ctx.fill();
      return;
    }
    // Floating diorama drop shadow underneath island
    const sTop = Iso.gridToScreen(0.4, 0.4, -27);
    const sRight = Iso.gridToScreen(N + 0.4, 0.4, -27);
    const sFront = Iso.gridToScreen(N + 0.4, N + 0.4, -27);
    const sLeft = Iso.gridToScreen(0.4, N + 0.4, -27);
    ctx.save();
    ctx.fillStyle = 'rgba(4, 7, 13, 0.46)';
    ctx.beginPath();
    ctx.moveTo(sTop.x, sTop.y);
    ctx.lineTo(sRight.x, sRight.y);
    ctx.lineTo(sFront.x, sFront.y);
    ctx.lineTo(sLeft.x, sLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Stratum 1: Deep Slate Bedrock Band (-23 .. -14.2, left-top 100%/82%/66%)
    Iso.drawVoxelBox(ctx, 0, 0, -23, N, N, 8.8, {
      base: '#363E4B',
      noTop: true
    });
    Iso.drawVoxelBox(ctx, 0, 0, -23, N, N, 1.5, {
      base: '#252B35',
      noTop: true
    });

    // Protruding bedrock cliff blocks along visible front-left (y = N) and front-right (x = N) faces
    const rockOffsets = N >= 26
      ? [2.2, 6.2, 10.4, 14.8, 19.2, 23.1]
      : N >= 22
      ? [2.2, 6.4, 11.1, 14.8, 18.9]
      : [2.2, 6.4, 11.1, 14.8];
    for (let i = 0; i < rockOffsets.length; i++) {
      const k = rockOffsets[i];
      Iso.drawVoxelBox(ctx, k, N - 0.16, -21.8 + (i % 2) * 1.4, 1.5, 0.24, 6.4, {
        base: '#434D5D'
      });
      Iso.drawVoxelBox(ctx, N - 0.16, k + 0.5, -21.3 + (i % 2) * 1.4, 0.24, 1.4, 6.2, {
        base: '#3E4856'
      });
    }

    // Stratum 2: Mid Ochre-Clay Band (-14.2 .. -8.2)
    Iso.drawVoxelBox(ctx, 0, 0, -14.2, N, N, 6.0, {
      base: '#AD7E49',
      noTop: true
    });
    Iso.drawVoxelBox(ctx, 0, 0, -14.2, N, N, 0.8, {
      base: '#684B2C',
      noTop: true
    });

    // Stratum 3: Warm Earth Upper Layer (-8.2 .. -3.2)
    Iso.drawVoxelBox(ctx, 0, 0, -8.2, N, N, 5.0, {
      base: '#714D39',
      noTop: true
    });
    // Crisp contact AO strip directly beneath the overhanging grass rim
    Iso.drawVoxelBox(ctx, 0, 0, -4.1, N, N, 0.9, {
      base: '#38251B',
      noTop: true
    });

    // Embedded cliff stones in earth / ochre-clay strata
    const stoneOffsets = N >= 26
      ? [1.4, 4.8, 8.2, 11.9, 15.6, 19.2, 22.8]
      : N >= 22
      ? [1.4, 4.7, 8.3, 12.6, 15.9, 19.3]
      : [1.4, 4.7, 8.3, 12.6, 15.9];
    for (let i = 0; i < stoneOffsets.length; i++) {
      const k = stoneOffsets[i];
      Iso.drawVoxelBox(ctx, k, N - 0.06, -12.0 + (i % 2) * 2.4, 0.55, 0.11, 2.6, {
        base: '#7E8690'
      });
      Iso.drawVoxelBox(ctx, N - 0.06, k, -11.4 + ((i + 1) % 2) * 2.4, 0.11, 0.55, 2.6, {
        base: '#757D87'
      });
    }

    // Stratum 4: Top Grass Lip Rim (-3.2 .. 0)
    Iso.drawVoxelBox(ctx, 0, 0, -3.2, N, N, 3.2, {
      top: P.terrainEdgeB || P.terrainB,
      left: Iso.shadeHex('#5B7351', 0.82),
      right: Iso.shadeHex('#5B7351', 0.66),
      stroke: 'rgba(255, 255, 255, 0.06)'
    });
    Iso.drawVoxelBox(ctx, 0, 0, -1.1, N, N, 1.1, {
      base: '#68825E',
      noTop: true
    });
    for (let i = 0; i < N; i++) {
      if (tileHash01(i, N, 701) > 0.42) {
        const wLip = 0.28 + tileHash01(i, N, 709) * 0.34;
        const off = tileHash01(i, N, 719) * 0.45;
        Iso.drawVoxelBox(ctx, i + off, N - 0.04, -3.7, wLip, 0.06, 2.9, {
          base: '#5F7756',
          noTop: true
        });
      }
      if (tileHash01(N, i, 727) > 0.42) {
        const dLip = 0.28 + tileHash01(N, i, 733) * 0.34;
        const off = tileHash01(N, i, 739) * 0.45;
        Iso.drawVoxelBox(ctx, N - 0.04, i + off, -3.7, 0.06, dLip, 2.9, {
          base: '#5F7756',
          noTop: true
        });
      }
    }
  }

  function drawTileMicroGrain(ctx, x, y, isEdge, occ) {
    const Iso = ZS.Iso;
    const count = occ ? 2 : 3;
    for (let k = 0; k < count; k++) {
      const rx = 0.16 + tileHash01(x, y, 601 + k * 13) * 0.68;
      const ry = 0.16 + tileHash01(x, y, 607 + k * 17) * 0.68;
      const kind = tileHash01(x, y, 613 + k * 19);
      const p = Iso.gridToScreen(x + rx, y + ry, 0.1);
      if (isEdge) {
        ctx.fillStyle = kind > 0.48 ? 'rgba(26, 28, 28, 0.22)' : 'rgba(108, 110, 102, 0.17)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 1.5, 0.85, kind * 2.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind > 0.68 && !occ) {
        ctx.strokeStyle = 'rgba(110, 140, 102, 0.25)';
        ctx.lineWidth = 1.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - 0.8, p.y + 0.5);
        ctx.lineTo(p.x - 1.3, p.y - 1.5);
        ctx.moveTo(p.x + 0.7, p.y + 0.4);
        ctx.lineTo(p.x + 1.2, p.y - 1.3);
        ctx.stroke();
      } else {
        ctx.fillStyle = kind > 0.36 ? 'rgba(118, 146, 114, 0.20)' : 'rgba(34, 46, 36, 0.18)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 1.35, 0.75, kind * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTerrainDecal(ctx, x, y, decal, zScale) {
    const Iso = ZS.Iso;
    const gx = x + decal.ox;
    const gy = y + decal.oy;

    if (decal.kind === 'tuft') {
      const p = Iso.gridToScreen(gx, gy, 0.4);
      ctx.strokeStyle = decal.v > 0.5 ? '#5E7C63' : '#3B4F3F';
      ctx.lineWidth = Math.max(1, 1.25 * zScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - 2.2 * zScale, p.y + 1 * zScale);
      ctx.lineTo(p.x - 3.8 * zScale, p.y - 3.4 * zScale);
      ctx.moveTo(p.x, p.y + 1.2 * zScale);
      ctx.lineTo(p.x + 0.4 * zScale, p.y - 4.2 * zScale);
      ctx.moveTo(p.x + 2.0 * zScale, p.y + 0.8 * zScale);
      ctx.lineTo(p.x + 3.8 * zScale, p.y - 2.8 * zScale);
      ctx.stroke();
    } else if (decal.kind === 'pebble') {
      Iso.drawVoxelBox(ctx, gx - 0.05, gy - 0.04, 0, 0.10, 0.09, 1.5, {
        base: decal.v > 0.5 ? '#7A838C' : '#677079'
      });
      if (decal.v > 0.35) {
        Iso.drawVoxelBox(ctx, gx + 0.07, gy + 0.03, 0, 0.06, 0.06, 1.0, {
          base: '#5D666E'
        });
      }
    } else if (decal.kind === 'soil') {
      const p = Iso.gridToScreen(gx, gy, 0.2);
      ctx.fillStyle = 'rgba(78, 66, 50, 0.38)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6.2 * zScale, 3.1 * zScale, decal.v * 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (decal.kind === 'clover') {
      const p = Iso.gridToScreen(gx, gy, 0.3);
      ctx.fillStyle = '#5B7A60';
      ctx.beginPath();
      ctx.arc(p.x - 1.8 * zScale, p.y, 1.5 * zScale, 0, Math.PI * 2);
      ctx.arc(p.x + 1.8 * zScale, p.y, 1.5 * zScale, 0, Math.PI * 2);
      ctx.arc(p.x, p.y - 1.4 * zScale, 1.5 * zScale, 0, Math.PI * 2);
      ctx.fill();
    } else if (decal.kind === 'crack') {
      const p = Iso.gridToScreen(gx, gy, 0.2);
      ctx.strokeStyle = 'rgba(24, 26, 28, 0.42)';
      ctx.lineWidth = Math.max(0.9, 1.1 * zScale);
      ctx.beginPath();
      ctx.moveTo(p.x - 5 * zScale, p.y - 1.5 * zScale);
      ctx.lineTo(p.x - 0.5 * zScale, p.y + 0.8 * zScale);
      ctx.lineTo(p.x + 4.5 * zScale, p.y - 1.2 * zScale);
      ctx.moveTo(p.x - 0.5 * zScale, p.y + 0.8 * zScale);
      ctx.lineTo(p.x + 1.5 * zScale, p.y + 3.2 * zScale);
      ctx.stroke();
    } else if (decal.kind === 'scorch') {
      const p = Iso.gridToScreen(gx, gy, 0.2);
      ctx.fillStyle = 'rgba(28, 30, 32, 0.34)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5.5 * zScale, 2.8 * zScale, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawQuarantineBorder(ctx, N, P, showEditGrid, zScale) {
    const Iso = ZS.Iso;
    const p0 = Iso.gridToScreen(1, 1, 0.5);
    const p1 = Iso.gridToScreen(N - 1, 1, 0.5);
    const p2 = Iso.gridToScreen(N - 1, N - 1, 0.5);
    const p3 = Iso.gridToScreen(1, N - 1, 0.5);

    ctx.save();
    // Soft outer soil-to-turf edge transition bevel along inner safe-zone perimeter
    ctx.strokeStyle = 'rgba(26, 32, 26, 0.22)';
    ctx.lineWidth = Math.max(2.6, 5.2 * zScale);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();

    // Subtle dark curb shadow along inner safe-zone edge
    ctx.strokeStyle = 'rgba(18, 22, 26, 0.48)';
    ctx.lineWidth = Math.max(1.2, 2.0 * zScale);
    ctx.stroke();

    // Dashed tactical quarantine danger line
    ctx.strokeStyle = showEditGrid ? 'rgba(255, 77, 109, 0.68)' : 'rgba(255, 77, 109, 0.36)';
    ctx.lineWidth = Math.max(1.0, 1.35 * zScale);
    ctx.setLineDash([6 * zScale, 5 * zScale]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Inward-pointing danger approach chevrons at the 4 cardinal breach lanes
    const midIdx = N * 0.5;
    const lanes = [
      { gx: midIdx, gy: 0.52, ix: 0, iy: 0.24 },
      { gx: N - 0.52, gy: midIdx, ix: -0.24, iy: 0 },
      { gx: midIdx, gy: N - 0.52, ix: 0, iy: -0.24 },
      { gx: 0.52, gy: midIdx, ix: 0.24, iy: 0 }
    ];
    ctx.strokeStyle = 'rgba(255, 77, 109, 0.46)';
    ctx.lineWidth = Math.max(1.1, 1.5 * zScale);
    for (let i = 0; i < lanes.length; i++) {
      const ln = lanes[i];
      const px = -ln.iy * 0.9;
      const py = ln.ix * 0.9;
      const tip = Iso.gridToScreen(ln.gx + ln.ix * 0.55, ln.gy + ln.iy * 0.55, 0.6);
      const wL = Iso.gridToScreen(ln.gx - ln.ix * 0.35 + px, ln.gy - ln.iy * 0.35 + py, 0.6);
      const wR = Iso.gridToScreen(ln.gx - ln.ix * 0.35 - px, ln.gy - ln.iy * 0.35 - py, 0.6);
      ctx.beginPath();
      ctx.moveTo(wL.x, wL.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(wR.x, wR.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerimeterProp(ctx, ep, zScale) {
    const Iso = ZS.Iso;
    if (ep.kind === 'rubble') {
      Iso.drawVoxelBox(ctx, ep.gx, ep.gy, 0, 0.18, 0.14, 2.4, {
        base: '#5C6168'
      });
      Iso.drawVoxelBox(ctx, ep.gx + 0.14, ep.gy + 0.08, 0, 0.11, 0.10, 1.5, {
        base: '#4C5057'
      });
      return;
    }

    if (ep.kind === 'barrier') {
      Iso.drawVoxelBox(ctx, ep.gx, ep.gy, 0, 0.24, 0.16, ep.h, {
        base: '#646A73'
      });
      Iso.drawVoxelBox(ctx, ep.gx - 0.005, ep.gy - 0.005, ep.h * 0.52, 0.25, 0.17, 1.3, {
        base: '#A84252'
      });
      return;
    }

    // Broken perimeter fence post + snapped cross-rail
    Iso.drawVoxelBox(ctx, ep.gx, ep.gy, 0, 0.08, 0.08, ep.h, {
      base: '#5E6772'
    });
    if (ep.brokenRail) {
      const p1 = Iso.gridToScreen(ep.gx + 0.04, ep.gy + 0.04, ep.h * 0.72);
      const rx = ep.kind === 'fence_x' ? ep.gx + 0.46 : ep.gx + 0.04 + ep.tilt;
      const ry = ep.kind === 'fence_y' ? ep.gy + 0.46 : ep.gy + 0.04 + ep.tilt;
      const p2 = Iso.gridToScreen(rx, ry, ep.h * 0.48);
      const p3 = Iso.gridToScreen(ep.gx + 0.04, ep.gy + 0.04, ep.h * 0.38);
      const p4 = Iso.gridToScreen(rx, ry, ep.h * 0.20);
      ctx.strokeStyle = '#737D8A';
      ctx.lineWidth = Math.max(1, 1.3 * zScale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }
  }

  function drawPerimeterFog(ctx, N, nightAlpha, timeSec, zScale, viewW, viewH) {
    const Iso = ZS.Iso;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const isNightFog = nightAlpha > 0.35;
    const mistKey = isNightFog ? 'rgba(26, 44, 78, 1)' : 'rgba(176, 192, 204, 1)';
    const dangerKey = isNightFog ? 'rgba(255, 77, 109, 1)' : 'rgba(120, 96, 104, 1)';
    const mistAlpha = isNightFog ? (0.20 + nightAlpha * 0.14) : 0.13;
    const dangerAlpha = isNightFog ? (0.045 * nightAlpha) : 0.05;
    const mistStamp = getGlowStamp(mistKey, 0.05);
    const dangerStamp = getGlowStamp(dangerKey, 0.05);

    ctx.save();
    const wispCount = N >= 26 ? 24 : N >= 22 ? 20 : 16;
    for (let i = 0; i < wispCount; i++) {
      const side = i % 4;
      const t = ((i * 0.23 + timeSec * 0.018) % 1) * (N - 1) + 0.5;
      let gx = 0.35;
      let gy = 0.35;
      if (side === 0) {
        gx = t;
        gy = 0.32;
      } else if (side === 1) {
        gx = N - 0.32;
        gy = t;
      } else if (side === 2) {
        gx = t;
        gy = N - 0.32;
      } else {
        gx = 0.32;
        gy = t;
      }
      const p = Iso.gridToScreen(gx, gy, 2.5);
      const rx = (28 + (i % 3) * 8) * zScale;
      const ry = (13 + (i % 3) * 4) * zScale;
      if (!isScreenVisible(p.x, p.y, rx, ry, ry, vp.w, vp.h)) continue;
      const isDanger = i % 3 === 0;
      const alpha = isDanger ? dangerAlpha : mistAlpha;
      if (alpha <= 0.002) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(isDanger ? dangerStamp : mistStamp, p.x - rx, p.y - ry, rx * 2, ry * 2);
    }
    ctx.restore();
  }

  function drawFloorTile(ctx, x, y, floorId, zScale) {
    const Iso = ZS.Iso;
    const isPlain = isPlainDetailFallback();
    if (floorId === 'asphalt') {
      drawDetailedIsoBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 1.5, '#2B323C', { bevel: false, gradDrop: 0.05 }, zScale);
      if (isPlain) return;

      // Subtle tactical curb seam inset along tile perimeter
      const cCol = Iso.resolveFaceColor('#3D4754', 1.0, false, 0) || '#3D4754';
      const cA = Iso.gridToScreen(x + 0.05, y + 0.07, 1.55);
      const cB = Iso.gridToScreen(x + 0.95, y + 0.07, 1.55);
      const cC = Iso.gridToScreen(x + 0.05, y + 0.93, 1.55);
      const cD = Iso.gridToScreen(x + 0.95, y + 0.93, 1.55);
      ctx.strokeStyle = cCol;
      ctx.lineWidth = Math.max(0.65, 0.85 * zScale);
      ctx.beginPath();
      ctx.moveTo(cA.x, cA.y);
      ctx.lineTo(cB.x, cB.y);
      ctx.moveTo(cC.x, cC.y);
      ctx.lineTo(cD.x, cD.y);
      ctx.stroke();

      // Crisp double white road dashes (separated from Gold #FFC94A)
      const dashCol = Iso.resolveFaceColor('#E2E8F0', 1.0, false, 0) || '#E2E8F0';
      ctx.strokeStyle = dashCol;
      ctx.lineWidth = Math.max(0.85, 1.25 * zScale);
      ctx.lineCap = 'butt';
      ctx.beginPath();
      const segs = [[0.18, 0.42], [0.58, 0.82]];
      const ys = [0.45, 0.55];
      for (let yi = 0; yi < ys.length; yi++) {
        for (let si = 0; si < segs.length; si++) {
          const p1 = Iso.gridToScreen(x + segs[si][0], y + ys[yi], 1.65);
          const p2 = Iso.gridToScreen(x + segs[si][1], y + ys[yi], 1.65);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
      }
      ctx.stroke();
    } else if (floorId === 'steel_deck') {
      drawDetailedIsoBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, '#546270', { bevel: true, gradDrop: 0.05 }, zScale);
      if (isPlain) return;

      // Cross quadrant plate seam lines + 1px highlight lip
      drawIsoFaceSeams(ctx, 'topX', x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, 2, 'rgba(14, 20, 28, 0.46)', zScale);
      drawIsoFaceSeams(ctx, 'topY', x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, 2, 'rgba(14, 20, 28, 0.46)', zScale);
      const hiCol = 'rgba(215, 232, 248, 0.18)';
      ctx.strokeStyle = hiCol;
      ctx.lineWidth = Math.max(0.5, 0.65 * zScale);
      const sX0 = Iso.gridToScreen(x + 0.52, y + 0.05, 2.04);
      const sX1 = Iso.gridToScreen(x + 0.52, y + 0.95, 2.04);
      const sY0 = Iso.gridToScreen(x + 0.05, y + 0.52, 2.04);
      const sY1 = Iso.gridToScreen(x + 0.95, y + 0.52, 2.04);
      ctx.beginPath();
      ctx.moveTo(sX0.x, sX0.y);
      ctx.lineTo(sX1.x, sX1.y);
      ctx.moveTo(sY0.x, sY0.y);
      ctx.lineTo(sY1.x, sY1.y);
      ctx.stroke();

      // 4 corner micro rivets & subtle checker plate diamond ticks per quadrant
      drawIsoCornerRivets(ctx, x + 0.04, y + 0.04, 2.02, 0.92, 0.92, 0.06, 0.75, '#C4D0DC', zScale);
      ctx.strokeStyle = 'rgba(220, 236, 252, 0.28)';
      ctx.lineWidth = Math.max(0.6, 0.78 * zScale);
      ctx.beginPath();
      const qCenters = [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]];
      for (let i = 0; i < qCenters.length; i++) {
        const qx = x + qCenters[i][0];
        const qy = y + qCenters[i][1];
        const tA = Iso.gridToScreen(qx - 0.055, qy + 0.025, 2.05);
        const tB = Iso.gridToScreen(qx + 0.055, qy - 0.025, 2.05);
        const tC = Iso.gridToScreen(qx - 0.025, qy - 0.055, 2.05);
        const tD = Iso.gridToScreen(qx + 0.025, qy + 0.055, 2.05);
        ctx.moveTo(tA.x, tA.y);
        ctx.lineTo(tB.x, tB.y);
        ctx.moveTo(tC.x, tC.y);
        ctx.lineTo(tD.x, tD.y);
      }
      ctx.stroke();
    } else if (floorId === 'lounge_tile') {
      const sub = (x + y) % 2 === 0 ? '#CBC3B4' : '#BFB6A6';
      drawDetailedIsoBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, sub, { bevel: true, gradDrop: 0.04 }, zScale);
      if (isPlain) return;

      // Refined 3x3 mosaic stone paver grout lines + sunlit subtle center tile glint
      drawIsoFaceSeams(ctx, 'topX', x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, 3, 'rgba(72, 65, 54, 0.30)', zScale);
      drawIsoFaceSeams(ctx, 'topY', x + 0.02, y + 0.02, 0, 0.96, 0.96, 2.0, 3, 'rgba(72, 65, 54, 0.30)', zScale);
      const centerPts = [
        Iso.gridToScreen(x + 0.36, y + 0.36, 2.04),
        Iso.gridToScreen(x + 0.64, y + 0.36, 2.04),
        Iso.gridToScreen(x + 0.64, y + 0.64, 2.04),
        Iso.gridToScreen(x + 0.36, y + 0.64, 2.04)
      ];
      drawPolyFace(ctx, centerPts, (x + y) % 2 === 0 ? '#D5CEC0' : '#C9C0B0', 1.0, false, false, zScale);
    } else if (floorId === 'hazard_mat') {
      // Base gunmetal frame (1.5px) + diagonal hazard corner trim + central non-slip mat (0.7px)
      drawDetailedIsoBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 1.5, '#3B4552', { bevel: true, gradDrop: 0.05 }, zScale);
      if (!isPlain) {
        const hazY = '#DFAC2E';
        const corners = [
          [0.035, 0.035], [0.815, 0.035], [0.035, 0.815], [0.815, 0.815]
        ];
        for (let i = 0; i < corners.length; i++) {
          const cx = x + corners[i][0];
          const cy = y + corners[i][1];
          const cPts = [
            Iso.gridToScreen(cx, cy, 1.54),
            Iso.gridToScreen(cx + 0.15, cy, 1.54),
            Iso.gridToScreen(cx + 0.15, cy + 0.15, 1.54),
            Iso.gridToScreen(cx, cy + 0.15, 1.54)
          ];
          drawPolyFace(ctx, cPts, hazY, 1.0, false, false, zScale);
          const diagA = Iso.gridToScreen(cx + 0.02, cy + 0.13, 1.56);
          const diagB = Iso.gridToScreen(cx + 0.13, cy + 0.02, 1.56);
          ctx.strokeStyle = Iso.resolveFaceColor('#232B35', 1.0, false, 0) || '#232B35';
          ctx.lineWidth = Math.max(0.8, 1.2 * zScale);
          ctx.beginPath();
          ctx.moveTo(diagA.x, diagA.y);
          ctx.lineTo(diagB.x, diagB.y);
          ctx.stroke();
        }
      }
      drawDetailedIsoBox(ctx, x + 0.12, y + 0.12, 1.5, 0.76, 0.76, 0.7, '#2E3540', { bevel: true, gradDrop: 0.05 }, zScale);
      if (!isPlain) {
        drawIsoFaceSeams(ctx, 'topX', x + 0.15, y + 0.15, 1.5, 0.70, 0.70, 0.7, 4, 'rgba(12, 16, 22, 0.48)', zScale);
        drawIsoFaceSeams(ctx, 'topY', x + 0.15, y + 0.15, 1.5, 0.70, 0.70, 0.7, 4, 'rgba(12, 16, 22, 0.42)', zScale);
        drawIsoCornerRivets(ctx, x + 0.13, y + 0.13, 2.22, 0.74, 0.74, 0.045, 0.65, '#9AA8B6', zScale);
      }
    }
  }

  const _circPt = { x: 0, y: 0 };

  function drawIsoCircle(ctx, cx, cy, radiusTiles, strokeColor, fillColor, lineDash, lineWidth) {
    const Iso = ZS.Iso;
    const steps = 48;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const gx = cx + Math.cos(ang) * radiusTiles;
      const gy = cy + Math.sin(ang) * radiusTiles;
      const p = Iso.projectTo(gx, gy, 2, _circPt);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth || 1.6;
      if (lineDash && lineDash.length > 0) ctx.setLineDash(lineDash);
      else if (lineDash === undefined) ctx.setLineDash([5, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function isDirectFireDef(def) {
    if (!def) return false;
    if (def.id === 'missile_pod' || def.id === 'emp_coil' || def.projType === 'rocket' || def.projType === 'emp') {
      return false;
    }
    return def.id === 'command_hq' || def.subType === 'manned' || def.subType === 'turret';
  }

  function drawPeakShadowSectors(ctx, state, cx, cy, maxRange, zScale) {
    const tGrid = state && state.terrainGrid;
    if (!tGrid || !(maxRange > 0.5)) return;
    const N = ZS.DATA.GRID_SIZE;
    const Iso = ZS.Iso;
    const minX = Math.max(0, Math.floor(cx - maxRange));
    const maxX = Math.min(N - 1, Math.ceil(cx + maxRange));
    const minY = Math.max(0, Math.floor(cy - maxRange));
    const maxY = Math.min(N - 1, Math.ceil(cy + maxRange));

    ctx.save();
    for (let py = minY; py <= maxY; py++) {
      const row = tGrid[py];
      if (!row) continue;
      for (let px = minX; px <= maxX; px++) {
        const t = row[px];
        if (!t || t.kind !== 'rock' || !t.isPeak) continue;
        const ox = px + 0.5;
        const oy = py + 0.5;
        const dx = ox - cx;
        const dy = oy - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.45 || dist >= maxRange - 0.15) continue;
        const ang0 = Math.atan2(dy, dx);
        const halfAng = Math.asin(Math.min(0.90, 0.45 / dist));
        const rStart = Math.max(0.45, dist + 0.15);
        if (rStart >= maxRange) continue;

        const steps = 10;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const a = (ang0 - halfAng) + (halfAng * 2 * s) / steps;
          const p = Iso.gridToScreen(cx + Math.cos(a) * rStart, cy + Math.sin(a) * rStart, 2);
          if (s === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        for (let s = steps; s >= 0; s--) {
          const a = (ang0 - halfAng) + (halfAng * 2 * s) / steps;
          const p = Iso.gridToScreen(cx + Math.cos(a) * maxRange, cy + Math.sin(a) * maxRange, 2);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 77, 109, 0.17)';
        ctx.fill();

        const pA0 = Iso.gridToScreen(cx + Math.cos(ang0 - halfAng) * rStart, cy + Math.sin(ang0 - halfAng) * rStart, 2);
        const pA1 = Iso.gridToScreen(cx + Math.cos(ang0 - halfAng) * maxRange, cy + Math.sin(ang0 - halfAng) * maxRange, 2);
        const pB0 = Iso.gridToScreen(cx + Math.cos(ang0 + halfAng) * rStart, cy + Math.sin(ang0 + halfAng) * rStart, 2);
        const pB1 = Iso.gridToScreen(cx + Math.cos(ang0 + halfAng) * maxRange, cy + Math.sin(ang0 + halfAng) * maxRange, 2);
        ctx.strokeStyle = 'rgba(255, 77, 109, 0.56)';
        ctx.lineWidth = Math.max(1.1, 1.3 * zScale);
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pA0.x, pA0.y);
        ctx.lineTo(pA1.x, pA1.y);
        ctx.moveTo(pB0.x, pB0.y);
        ctx.lineTo(pB1.x, pB1.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  function drawCombatRangeOverlay(ctx, state, def, cx, cy, maxRange, minRange, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const minR = minRange > 0.1 && minRange < maxRange - 0.1 ? minRange : 0;

    if (minR > 0) {
      const steps = 48;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const p = Iso.gridToScreen(cx + Math.cos(ang) * maxRange, cy + Math.sin(ang) * maxRange, 2);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      for (let i = steps; i >= 0; i--) {
        const ang = (i / steps) * Math.PI * 2;
        const p = Iso.gridToScreen(cx + Math.cos(ang) * minR, cy + Math.sin(ang) * minR, 2);
        if (i === steps) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = P.rangeFill;
      ctx.fill('evenodd');
      ctx.restore();

      drawIsoCircle(ctx, cx, cy, minR, P.danger, 'rgba(255, 77, 109, 0.10)', [5, 4], Math.max(1.5, 1.7 * zScale));
      drawIsoCircle(ctx, cx, cy, maxRange, P.rangeStroke, null);
    } else {
      drawIsoCircle(ctx, cx, cy, maxRange, P.rangeStroke, P.rangeFill);
    }

    if (isDirectFireDef(def)) {
      drawPeakShadowSectors(ctx, state, cx, cy, maxRange, zScale);
    }
  }

  function drawDualRangeRings(ctx, cx, cy, groundR, mountR, zScale) {
    const Iso = ZS.Iso;
    const steps = 48;
    // Outer mounted solid circle + inner ground hole -> 6% white annulus band
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const p = Iso.gridToScreen(cx + Math.cos(ang) * mountR, cy + Math.sin(ang) * mountR, 2);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    if (groundR > 0.1 && groundR < mountR - 0.05) {
      for (let i = steps; i >= 0; i--) {
        const ang = (i / steps) * Math.PI * 2;
        const p = Iso.gridToScreen(cx + Math.cos(ang) * groundR, cy + Math.sin(ang) * groundR, 2);
        if (i === steps) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill('evenodd');
    }
    ctx.restore();

    if (groundR > 0.1) {
      drawIsoCircle(ctx, cx, cy, groundR, 'rgba(255, 255, 255, 0.58)', null, [4, 4], 1.4);
    }
    drawIsoCircle(ctx, cx, cy, mountR, 'rgba(255, 255, 255, 0.92)', null, [], Math.max(1.6, 1.8 * zScale));
  }

  function drawWallPillarHighlight(ctx, tx, ty, tier, fillColor, strokeColor, lineWidth) {
    const Iso = ZS.Iso;
    const zTop = tier >= 3 ? 25.4 : 15.2;
    const pad = tier >= 3 ? 0.25 : 0.27;
    const size = tier >= 3 ? 0.50 : 0.46;
    const pts = [
      Iso.gridToScreen(tx + pad, ty + pad, zTop),
      Iso.gridToScreen(tx + pad + size, ty + pad, zTop),
      Iso.gridToScreen(tx + pad + size, ty + pad + size, zTop),
      Iso.gridToScreen(tx + pad, ty + pad + size, zTop)
    ];
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth || 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function getCornerClipElev(dx, dy, cx, cy, highZ, lowZ) {
    if (dx === 1) return cx >= 0.5 ? highZ : lowZ;
    if (dx === -1) return cx < 0.5 ? highZ : lowZ;
    if (dy === 1) return cy >= 0.5 ? highZ : lowZ;
    if (dy === -1) return cy < 0.5 ? highZ : lowZ;
    return lowZ;
  }

  function drawFacetedCragSpire(rctx, cx, cy, zBase, rx, ry, topDx, topDy, h, taper, sides, seed, colBody, colCap, isSil, flip) {
    const Iso = ZS.Iso;
    const ptsB = [];
    const ptsT = [];
    const worldMids = [];
    const topCx = cx + topDx;
    const topCy = cy + topDy;
    const zTop = zBase + h;

    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + (seed % 7) * 0.27;
      const radJit = 0.84 + tileHash01(k + 1, seed, 701) * 0.34;
      const topJit = 0.80 + tileHash01(k + 3, seed, 709) * 0.40;
      let bx = cx + Math.cos(a) * rx * radJit;
      let by = cy + Math.sin(a) * ry * radJit;
      let tx = topCx + Math.cos(a) * rx * taper * topJit;
      let ty = topCy + Math.sin(a) * ry * taper * topJit;
      if (flip) {
        const tmpB = bx; bx = by; by = tmpB;
        const tmpT = tx; tx = ty; ty = tmpT;
      }
      ptsB.push(Iso.gridToScreen(bx, by, zBase));
      ptsT.push(Iso.gridToScreen(tx, ty, zTop));
      worldMids.push({ bx, by });
    }

    const faces = [];
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const mx0 = worldMids[k].bx;
      const my0 = worldMids[k].by;
      const mx1 = worldMids[k1].bx;
      const my1 = worldMids[k1].by;
      const midX = (mx0 + mx1) * 0.5;
      const midY = (my0 + my1) * 0.5;
      const ctrX = flip ? cy : cx;
      const ctrY = flip ? cx : cy;
      const nx = midX - ctrX;
      const ny = midY - ctrY;
      // Back-to-front painter's sort along iso depth (x + y)
      const faceShade = nx + ny < -0.02
        ? 0.94
        : nx + ny < 0.06
        ? 0.84
        : nx > ny
        ? 0.66
        : 0.78;
      faces.push({
        depth: midX + midY,
        shade: isSil ? 0.90 : faceShade,
        quad: [ptsB[k], ptsB[k1], ptsT[k1], ptsT[k]]
      });
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (let i = 0; i < faces.length; i++) {
      drawPolyFace(rctx, faces[i].quad, colBody, faces[i].shade, false, !isSil, 1.0);
    }
    drawPolyFace(rctx, ptsT, colCap, 1.0, false, !isSil, 1.0);
  }

  function isRockAt(state, x, y) {
    const g = state && state.terrainGrid;
    const t = g && g[y] && g[y][x];
    return !!(t && t.kind === 'rock');
  }

  function ensureRockStamp(isPeak, variant, flip, mask, P, isSil) {
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5);
    const bakeScale = Math.min(3.0, Math.max(2.0, dpr * 1.35));
    const vIdx = (variant || 0) & 7;
    const fl = flip ? 1 : 0;
    const mk = mask & 15;
    const pk = isPeak ? 1 : 0;
    const key = `${pk}|v${vIdx}|f${fl}|m${mk}|s${isSil ? 1 : 0}|b${bakeScale.toFixed(2)}`;
    const cached = rockStampCache.get(key);
    if (cached) return cached;
    if (rockStampCache.size >= 96) {
      rockStampCache.clear();
    }

    const logW = 92;
    const logH = 108;
    const originX = 46;
    const originY = 72;
    const cw = Math.round(logW * bakeScale);
    const ch = Math.round(logH * bakeScale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const rctx = canvas.getContext('2d');
    const Iso = ZS.Iso;

    const prevVp = Iso.getViewport();
    const prevMinZoom = Iso.cam.minZoom;
    const prevCamX = Iso.cam.x;
    const prevCamY = Iso.cam.y;
    const prevZoom = Iso.cam.zoom;
    const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;
    const prevTint = Iso.setSceneTint ? true : false;

    try {
      if (Iso.setElevationOffset) Iso.setElevationOffset(0);
      Iso.setViewport(logW, logH);
      Iso.cam.minZoom = 0.25;
      Iso.cam.zoom = 1.0;
      const gOrigin = Iso.gridToScreen(0.5, 0.5, 0);
      Iso.cam.x += (gOrigin.x - originX);
      Iso.cam.y += (gOrigin.y - originY);
      rctx.setTransform(bakeScale, 0, 0, bakeScale, 0, 0);
      if (isSil) {
        Iso.resetRenderModifiers();
      } else {
        Iso.setSceneTint('#FFE8BA', 0.045);
      }

      const bodyLow = isSil ? '#AAB3BC' : (P.rockBase || '#5B646F');
      const darkLow = isSil ? '#8E97A1' : (P.rockDark || '#3D444D');
      const capLow = isSil ? '#C8D0D8' : '#76808B';
      const mossCol = isSil ? '#B8C0C8' : (P.rockMoss || '#5D7455');

      const peakBody = isSil ? '#949EA8' : (P.rockPeakBase || '#4B525B');
      const peakDark = isSil ? '#79828C' : (P.rockPeakDark || '#2F353D');
      const peakCap = isSil ? '#D0D7DF' : (P.rockPeakCap || '#6E7680');

      // Double Contact AO shadow on ground plane
      if (!isSil) {
        const aoPos = Iso.gridToScreen(0.51, 0.52, 0.05);
        rctx.fillStyle = isPeak ? 'rgba(6, 10, 14, 0.26)' : 'rgba(8, 12, 14, 0.20)';
        rctx.beginPath();
        rctx.ellipse(aoPos.x, aoPos.y, isPeak ? 28 : 24, isPeak ? 14 : 12, 0, 0, Math.PI * 2);
        rctx.fill();

        const tightAo = Iso.gridToScreen(0.50, 0.51, 0.1);
        rctx.fillStyle = isPeak ? 'rgba(4, 8, 12, 0.44)' : 'rgba(6, 10, 14, 0.34)';
        rctx.beginPath();
        rctx.ellipse(tightAo.x, tightAo.y, isPeak ? 18 : 15, isPeak ? 9 : 7.5, 0, 0, Math.PI * 2);
        rctx.fill();
      }

      const bridgeBody = pk ? peakDark : darkLow;
      const bridgeCap = pk ? peakBody : bodyLow;
      const bridgeH = pk ? 11.5 : 8.2;

      // Back neighbor saddle bridges (North y-1, West x-1)
      if (mk & 1) {
        drawFacetedCragSpire(rctx, 0.50, 0.12, 0, 0.22, 0.18, 0.02, 0.02, bridgeH, 0.45, 5, 11 + vIdx, bridgeBody, bridgeCap, isSil, false);
      }
      if (mk & 8) {
        drawFacetedCragSpire(rctx, 0.12, 0.50, 0, 0.18, 0.22, 0.02, 0.02, bridgeH, 0.45, 5, 23 + vIdx, bridgeBody, bridgeCap, isSil, false);
      }

      if (pk) {
        // Mountain Peak (isPeak: true, tall z = 29..34 sharp crags + shoulder spurs + base scree)
        const peakSpecs = [
          { cx: 0.48, cy: 0.48, rx: 0.36, ry: 0.34, tdx: -0.05, tdy: -0.04, h: 32.5, tp: 0.18, shX: 0.68, shY: 0.62, shH: 15.0 },
          { cx: 0.52, cy: 0.46, rx: 0.35, ry: 0.36, tdx: 0.04, tdy: -0.05, h: 31.0, tp: 0.20, shX: 0.28, shY: 0.60, shH: 17.5 },
          { cx: 0.46, cy: 0.52, rx: 0.38, ry: 0.33, tdx: -0.03, tdy: 0.03, h: 33.8, tp: 0.16, shX: 0.66, shY: 0.32, shH: 16.5 },
          { cx: 0.50, cy: 0.50, rx: 0.34, ry: 0.37, tdx: 0.05, tdy: 0.02, h: 29.5, tp: 0.22, shX: 0.30, shY: 0.30, shH: 18.0 },
          { cx: 0.44, cy: 0.48, rx: 0.36, ry: 0.35, tdx: 0.06, tdy: -0.03, h: 33.0, tp: 0.17, shX: 0.68, shY: 0.58, shH: 19.0 },
          { cx: 0.53, cy: 0.49, rx: 0.37, ry: 0.34, tdx: -0.06, tdy: 0.01, h: 30.8, tp: 0.19, shX: 0.28, shY: 0.52, shH: 16.0 },
          { cx: 0.49, cy: 0.45, rx: 0.35, ry: 0.36, tdx: 0.02, tdy: 0.05, h: 32.0, tp: 0.18, shX: 0.64, shY: 0.66, shH: 14.5 },
          { cx: 0.47, cy: 0.51, rx: 0.36, ry: 0.36, tdx: -0.04, tdy: -0.04, h: 34.0, tp: 0.15, shX: 0.34, shY: 0.68, shH: 15.5 }
        ];
        const sp = peakSpecs[vIdx];
        // Back ridge shoulder
        drawFacetedCragSpire(rctx, sp.cx - 0.04, sp.cy - 0.06, 0, 0.24, 0.23, 0, 0, sp.shH, 0.34, 6, 41 + vIdx, peakDark, peakBody, isSil, fl);
        // Dominant mountain crag summit (29.5..34px height!)
        drawFacetedCragSpire(rctx, sp.cx, sp.cy, 0, sp.rx, sp.ry, sp.tdx, sp.tdy, sp.h, sp.tp, 7, 101 + vIdx * 13, peakBody, peakCap, isSil, fl);
        // Foreground flank shoulder buttress
        drawFacetedCragSpire(rctx, sp.shX, sp.shY, 0, 0.21, 0.20, -0.02, 0.02, sp.shH * 0.78, 0.36, 5, 181 + vIdx, peakDark, peakBody, isSil, fl);

        // Weathered sunlit ridge knife-edge glint near crown
        if (!isSil) {
          const sx = fl ? sp.cy : sp.cx;
          const sy = fl ? sp.cx : sp.cy;
          const rA = Iso.gridToScreen(sx - 0.04, sy - 0.02, sp.h);
          const rB = Iso.gridToScreen(sx + (fl ? sp.tdy : sp.tdx), sy + (fl ? sp.tdx : sp.tdy), sp.h - 1.2);
          const rC = Iso.gridToScreen(sx - 0.14, sy + 0.10, sp.h * 0.55);
          rctx.strokeStyle = 'rgba(220, 230, 240, 0.34)';
          rctx.lineWidth = 1.15;
          rctx.beginPath();
          rctx.moveTo(rC.x, rC.y);
          rctx.lineTo(rA.x, rA.y);
          rctx.lineTo(rB.x, rB.y);
          rctx.stroke();

          // Sharp base scree splinters around peak base
          const screes = [[0.20, 0.76, 3.6], [0.78, 0.72, 4.0], [0.76, 0.24, 3.4], [0.18, 0.28, 3.2]];
          for (let i = 0; i < screes.length; i++) {
            const sc = screes[i];
            drawFacetedCragSpire(rctx, sc[0], sc[1], 0, 0.08, 0.07, 0, 0, sc[2], 0.45, 5, 300 + i + vIdx, peakDark, peakBody, false, fl);
          }
        }
      } else {
        // Foothill Rock (isPeak: false, broad low boulders topZ = 11..16 + moss cushions)
        const lowSpecs = [
          { cx: 0.44, cy: 0.46, rx: 0.32, ry: 0.30, tdx: -0.02, tdy: -0.02, h: 14.5, tp: 0.46, b2x: 0.68, b2y: 0.62, b2h: 9.2 },
          { cx: 0.54, cy: 0.44, rx: 0.30, ry: 0.33, tdx: 0.03, tdy: -0.01, h: 15.6, tp: 0.42, b2x: 0.28, b2y: 0.60, b2h: 10.4 },
          { cx: 0.48, cy: 0.52, rx: 0.34, ry: 0.29, tdx: -0.03, tdy: 0.02, h: 12.8, tp: 0.52, b2x: 0.66, b2y: 0.30, b2h: 8.6 },
          { cx: 0.42, cy: 0.50, rx: 0.31, ry: 0.32, tdx: 0.02, tdy: 0.03, h: 15.2, tp: 0.44, b2x: 0.68, b2y: 0.56, b2h: 11.0 },
          { cx: 0.52, cy: 0.50, rx: 0.33, ry: 0.31, tdx: -0.04, tdy: -0.02, h: 13.8, tp: 0.48, b2x: 0.28, b2y: 0.34, b2h: 9.8 },
          { cx: 0.47, cy: 0.45, rx: 0.30, ry: 0.34, tdx: 0.01, tdy: 0.02, h: 15.8, tp: 0.40, b2x: 0.64, b2y: 0.68, b2h: 8.2 },
          { cx: 0.50, cy: 0.54, rx: 0.35, ry: 0.30, tdx: 0.03, tdy: -0.03, h: 11.8, tp: 0.55, b2x: 0.26, b2y: 0.42, b2h: 9.4 },
          { cx: 0.45, cy: 0.48, rx: 0.32, ry: 0.31, tdx: -0.02, tdy: 0.02, h: 14.0, tp: 0.47, b2x: 0.70, b2y: 0.46, b2h: 10.0 }
        ];
        const sp = lowSpecs[vIdx];
        drawFacetedCragSpire(rctx, sp.cx, sp.cy, 0, sp.rx, sp.ry, sp.tdx, sp.tdy, sp.h, sp.tp, 6, 51 + vIdx * 11, bodyLow, capLow, isSil, fl);
        drawFacetedCragSpire(rctx, sp.b2x, sp.b2y, 0, 0.20, 0.19, 0.01, -0.01, sp.b2h, 0.50, 5, 91 + vIdx, darkLow, bodyLow, isSil, fl);
        if (!isSil) {
          // Subtle moss tuft along sunlit top-left shoulder
          drawFacetedCragSpire(rctx, sp.cx - 0.05, sp.cy - 0.04, sp.h - 0.4, 0.14, 0.13, 0, 0, 1.5, 0.60, 5, 141 + vIdx, mossCol, mossCol, false, fl);
          // Single small foreground pebble
          drawFacetedCragSpire(rctx, 0.22 + (vIdx % 3) * 0.18, 0.76, 0, 0.08, 0.07, 0, 0, 3.0, 0.55, 5, 210 + vIdx, darkLow, bodyLow, false, fl);
        }
      }

      // Front neighbor saddle bridges (East x+1, South y+1)
      if (mk & 2) {
        drawFacetedCragSpire(rctx, 0.88, 0.50, 0, 0.18, 0.22, -0.02, 0.0, bridgeH * 0.92, 0.48, 5, 31 + vIdx, bridgeBody, bridgeCap, isSil, false);
      }
      if (mk & 4) {
        drawFacetedCragSpire(rctx, 0.50, 0.88, 0, 0.22, 0.18, 0.0, -0.02, bridgeH * 0.92, 0.48, 5, 37 + vIdx, bridgeBody, bridgeCap, isSil, false);
      }
    } finally {
      if (prevTint) Iso.resetRenderModifiers();
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.minZoom = prevMinZoom;
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
    }

    const stamp = { canvas, originX, originY, logW, logH, bakeScale };
    rockStampCache.set(key, stamp);
    return stamp;
  }

  function drawRockTile(ctx, tx, ty, tCell, state, P, isSil, zScale) {
    const Iso = ZS.Iso;
    let mask = 0;
    if (isRockAt(state, tx, ty - 1)) mask |= 1;
    if (isRockAt(state, tx + 1, ty)) mask |= 2;
    if (isRockAt(state, tx, ty + 1)) mask |= 4;
    if (isRockAt(state, tx - 1, ty)) mask |= 8;
    const isPeak = !!(tCell && tCell.isPeak);
    const variant = (tCell && tCell.variant != null) ? tCell.variant : ((tx * 5 + ty * 7) & 7);
    const flip = (tCell && tCell.flip) ? 1 : 0;
    const stamp = ensureRockStamp(isPeak, variant, flip, mask, P, isSil);
    const p = Iso.gridToScreen(tx + 0.5, ty + 0.5, 0);
    const drawW = stamp.logW * zScale;
    const drawH = stamp.logH * zScale;
    const dx = p.x - stamp.originX * zScale;
    const dy = p.y - stamp.originY * zScale;
    ctx.drawImage(stamp.canvas, 0, 0, stamp.canvas.width, stamp.canvas.height, dx, dy, drawW, drawH);
  }

  function isNeighborPlateau(state, nx, ny) {
    const tGrid = state && state.terrainGrid;
    const c = tGrid && tGrid[ny] && tGrid[ny][nx];
    return !!(c && c.kind === 'plateau');
  }

  function isNeighborRampInto(state, nx, ny, tx, ty) {
    const tGrid = state && state.terrainGrid;
    const c = tGrid && tGrid[ny] && tGrid[ny][nx];
    if (!c || c.kind !== 'ramp' || !c.rampDir) return false;
    return nx + c.rampDir.dx === tx && ny + c.rampDir.dy === ty;
  }

  const _msB0 = { x: 0, y: 0 };
  const _msB1 = { x: 0, y: 0 };
  const _msB2 = { x: 0, y: 0 };
  const _msB3 = { x: 0, y: 0 };
  const _msT0 = { x: 0, y: 0 };
  const _msT1 = { x: 0, y: 0 };
  const _msT2 = { x: 0, y: 0 };
  const _msT3 = { x: 0, y: 0 };
  const _msLeftQuad = [_msB3, _msB2, _msT2, _msT3];
  const _msRightQuad = [_msB2, _msB1, _msT1, _msT2];
  const _msTopQuad = [_msT0, _msT1, _msT2, _msT3];

  function drawMiniStoneBlock(ctx, cx, cy, zBase, rx, ry, h, colBody, colTop, isSil, zScale) {
    const Iso = ZS.Iso;
    const zTop = zBase + h;
    const ix = rx * 0.65;
    const iy = ry * 0.65;
    Iso.projectTo(cx - rx, cy - ry * 0.85, zBase, _msB0);
    Iso.projectTo(cx + rx, cy - ry, zBase, _msB1);
    Iso.projectTo(cx + rx * 0.92, cy + ry, zBase, _msB2);
    Iso.projectTo(cx - rx * 0.95, cy + ry * 0.9, zBase, _msB3);
    Iso.projectTo(cx - ix, cy - iy * 0.85, zTop, _msT0);
    Iso.projectTo(cx + ix, cy - iy, zTop, _msT1);
    Iso.projectTo(cx + ix * 0.92, cy + iy, zTop, _msT2);
    Iso.projectTo(cx - ix * 0.95, cy + iy * 0.9, zTop, _msT3);
    drawPolyFace(ctx, _msLeftQuad, colBody, isSil ? 0.88 : 0.82, false, !isSil, zScale);
    drawPolyFace(ctx, _msRightQuad, colBody, isSil ? 0.78 : 0.66, false, !isSil, zScale);
    drawPolyFace(ctx, _msTopQuad, colTop, 1.0, false, !isSil, zScale);
  }

  function drawPlateauTile(ctx, tx, ty, tCell, state, P, isSil, zScale) {
    const Iso = ZS.Iso;
    const elev = (ZS.DATA.PLATEAU_ELEV_Z != null ? ZS.DATA.PLATEAU_ELEV_Z : 10);
    const checker = (tx + ty) % 2 === 0;
    const turfBase = isSil
      ? '#DFE5EC'
      : checker
      ? (P.plateauTopA || '#5D775A')
      : (P.plateauTopB || '#577054');
    const tileJitter = (tileHash01(tx, ty, 307) * 2 - 1) * 0.03;
    const topCol = isSil ? turfBase : (Iso.shadeHex(turfBase, 1 + tileJitter) || turfBase);

    const soilCol = isSil ? '#8E96A0' : (P.plateauCliffSoil || '#473628');
    const slateCol = isSil ? '#9FA8B2' : (P.plateauCliffSlate || '#424A56');
    const ochreCol = isSil ? '#B8C0C8' : (P.plateauCliffOchre || '#8E6A42');

    const expNorth = !isNeighborPlateau(state, tx, ty - 1) && !isNeighborRampInto(state, tx, ty - 1, tx, ty);
    const expWest = !isNeighborPlateau(state, tx - 1, ty) && !isNeighborRampInto(state, tx - 1, ty, tx, ty);
    const expSouth = !isNeighborPlateau(state, tx, ty + 1) && !isNeighborRampInto(state, tx, ty + 1, tx, ty);
    const expEast = !isNeighborPlateau(state, tx + 1, ty) && !isNeighborRampInto(state, tx + 1, ty, tx, ty);

    // 1) Exposed South-West cliff face (y = ty + 1, top-left 82% directional shade)
    if (expSouth) {
      if (!isSil) {
        const g0 = Iso.projectTo(tx, ty + 1.0, 0.15, _msB0);
        const g1 = Iso.projectTo(tx + 1.0, ty + 1.0, 0.15, _msB1);
        const g2 = Iso.projectTo(tx + 1.0, ty + 1.16, 0.15, _msB2);
        const g3 = Iso.projectTo(tx, ty + 1.16, 0.15, _msB3);
        ctx.fillStyle = 'rgba(10, 14, 16, 0.28)';
        ctx.beginPath();
        ctx.moveTo(g0.x, g0.y);
        ctx.lineTo(g1.x, g1.y);
        ctx.lineTo(g2.x, g2.y);
        ctx.lineTo(g3.x, g3.y);
        ctx.closePath();
        ctx.fill();
      }
      const zSplit = elev * 0.44 + (tileHash01(tx, ty, 503) - 0.5) * 1.4;
      const zLip = elev - 2.1;
      const yWall = ty + 1.0;
      const midCol = tileHash01(tx, ty, 509) > 0.45 ? ochreCol : slateCol;
      // Lower soil stratum
      drawPolyFace(ctx, [
        Iso.projectTo(tx, yWall, 0, _msB0),
        Iso.projectTo(tx + 1, yWall, 0, _msB1),
        Iso.projectTo(tx + 1, yWall, zSplit + 0.3, _msB2),
        Iso.projectTo(tx, yWall, zSplit + 0.3, _msB3)
      ], soilCol, 0.82, false, false, zScale);
      // Upper rock strata
      drawPolyFace(ctx, [
        Iso.projectTo(tx, yWall, zSplit, _msT0),
        Iso.projectTo(tx + 1, yWall, zSplit, _msT1),
        Iso.projectTo(tx + 1, yWall, zLip + 0.2, _msT2),
        Iso.projectTo(tx, yWall, zLip + 0.2, _msT3)
      ], midCol, 0.82, false, false, zScale);
      // Protruding stone buttress rib & fallen scree pebble
      const bPos = 0.25 + tileHash01(tx, ty, 521) * 0.45;
      drawMiniStoneBlock(ctx, tx + bPos, yWall + 0.03, 0, 0.14, 0.06, elev - 2.0, slateCol, midCol, isSil, zScale);
      // Overhanging turf skirt lip
      const midDrop = (tileHash01(tx, ty, 541) - 0.5) * 0.8;
      drawPolyFace(ctx, [
        Iso.gridToScreen(tx, yWall + 0.025, zLip + 0.2),
        Iso.gridToScreen(tx + 0.5, yWall + 0.035, zLip + midDrop),
        Iso.gridToScreen(tx + 1, yWall + 0.025, zLip + 0.2),
        Iso.gridToScreen(tx + 1, yWall, elev),
        Iso.gridToScreen(tx, yWall, elev)
      ], turfBase, 0.80, false, false, zScale);
      if (!isSil) {
        drawMiniStoneBlock(ctx, tx + 0.28 + tileHash01(tx, ty, 557) * 0.42, ty + 1.11, 0, 0.06, 0.04, 2.0, P.rockDark || '#3D444D', P.rockBase || '#5B646F', false, zScale);
      }
    }

    // 2) Exposed South-East cliff face (x = tx + 1, darker 66% directional shade)
    if (expEast) {
      if (!isSil) {
        const g0 = Iso.projectTo(tx + 1.0, ty, 0.15, _msB0);
        const g1 = Iso.projectTo(tx + 1.0, ty + 1.0, 0.15, _msB1);
        const g2 = Iso.projectTo(tx + 1.16, ty + 1.0, 0.15, _msB2);
        const g3 = Iso.projectTo(tx + 1.16, ty, 0.15, _msB3);
        ctx.fillStyle = 'rgba(10, 14, 16, 0.32)';
        ctx.beginPath();
        ctx.moveTo(g0.x, g0.y);
        ctx.lineTo(g1.x, g1.y);
        ctx.lineTo(g2.x, g2.y);
        ctx.lineTo(g3.x, g3.y);
        ctx.closePath();
        ctx.fill();
      }
      const zSplit = elev * 0.44 + (tileHash01(tx, ty, 603) - 0.5) * 1.4;
      const zLip = elev - 2.1;
      const xWall = tx + 1.0;
      const midCol = tileHash01(tx, ty, 609) > 0.45 ? ochreCol : slateCol;
      drawPolyFace(ctx, [
        Iso.projectTo(xWall, ty, 0, _msB0),
        Iso.projectTo(xWall, ty + 1, 0, _msB1),
        Iso.projectTo(xWall, ty + 1, zSplit + 0.3, _msB2),
        Iso.projectTo(xWall, ty, zSplit + 0.3, _msB3)
      ], soilCol, 0.66, false, false, zScale);
      drawPolyFace(ctx, [
        Iso.projectTo(xWall, ty, zSplit, _msT0),
        Iso.projectTo(xWall, ty + 1, zSplit, _msT1),
        Iso.projectTo(xWall, ty + 1, zLip + 0.2, _msT2),
        Iso.projectTo(xWall, ty, zLip + 0.2, _msT3)
      ], midCol, 0.66, false, false, zScale);
      const bPos = 0.25 + tileHash01(tx, ty, 621) * 0.45;
      drawMiniStoneBlock(ctx, xWall + 0.03, ty + bPos, 0, 0.06, 0.14, elev - 2.0, slateCol, midCol, isSil, zScale);
      const midDrop = (tileHash01(tx, ty, 641) - 0.5) * 0.8;
      drawPolyFace(ctx, [
        Iso.gridToScreen(xWall + 0.025, ty, zLip + 0.2),
        Iso.gridToScreen(xWall + 0.035, ty + 0.5, zLip + midDrop),
        Iso.gridToScreen(xWall + 0.025, ty + 1, zLip + 0.2),
        Iso.gridToScreen(xWall, ty + 1, elev),
        Iso.gridToScreen(xWall, ty, elev)
      ], turfBase, 0.65, false, false, zScale);
      if (!isSil) {
        drawMiniStoneBlock(ctx, tx + 1.11, ty + 0.28 + tileHash01(tx, ty, 657) * 0.42, 0, 0.04, 0.06, 2.0, P.rockDark || '#3D444D', P.rockBase || '#5B646F', false, zScale);
      }
    }

    // 3) Seamless mesa deck surface (no internal borders; overlap interior edges slightly by 0.012 to prevent AA seams)
    const padN = !expNorth ? -0.012 : 0;
    const padW = !expWest ? -0.012 : 0;
    const padS = expSouth ? 0.02 : 0;
    const padE = expEast ? 0.02 : 0;
    drawPolyFace(ctx, [
      Iso.projectTo(tx + padW, ty + padN, elev, _msT0),
      Iso.projectTo(tx + 1 + padE, ty + padN, elev, _msT1),
      Iso.projectTo(tx + 1 + padE, ty + 1 + padS, elev, _msT2),
      Iso.projectTo(tx + padW, ty + 1 + padS, elev, _msT3)
    ], topCol, 1.0, false, false, zScale);

    const fid = state && state.floorGrid && state.floorGrid[ty] && state.floorGrid[ty][tx];
    if (fid && !isSil) {
      const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;
      Iso.setElevationOffset(elev);
      try {
        drawFloorTile(ctx, tx, ty, fid, zScale);
      } finally {
        Iso.setElevationOffset(prevElev);
      }
    } else if (!isSil) {
      if (tileHash01(tx, ty, 311) > 0.42) {
        const sx = tx + 0.25 + tileHash01(tx, ty, 317) * 0.5;
        const sy = ty + 0.25 + tileHash01(tx, ty, 331) * 0.5;
        const gp = Iso.projectTo(sx, sy, elev + 0.15, _msB0);
        ctx.fillStyle = tileHash01(tx, ty, 349) > 0.5 ? 'rgba(64, 84, 60, 0.42)' : 'rgba(130, 146, 118, 0.28)';
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y, 2.4 * zScale, 1.2 * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (isSil) return;

    ctx.save();
    if (expNorth || expWest) {
      ctx.strokeStyle = P.plateauRimSoft || 'rgba(176, 196, 152, 0.28)';
      ctx.lineWidth = Math.max(0.95, 1.25 * zScale);
      ctx.beginPath();
      if (expNorth) {
        const a = Iso.projectTo(tx, ty, elev + 0.1, _msB0);
        const b = Iso.projectTo(tx + 1, ty, elev + 0.1, _msB1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      if (expWest) {
        const a = Iso.projectTo(tx, ty, elev + 0.1, _msB0);
        const b = Iso.projectTo(tx, ty + 1, elev + 0.1, _msB1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    if (expSouth || expEast) {
      ctx.strokeStyle = 'rgba(16, 22, 18, 0.36)';
      ctx.lineWidth = Math.max(0.9, 1.15 * zScale);
      ctx.beginPath();
      if (expSouth) {
        const a = Iso.projectTo(tx, ty + 1 + padS, elev + 0.1, _msB0);
        const b = Iso.projectTo(tx + 1 + padE, ty + 1 + padS, elev + 0.1, _msB1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      if (expEast) {
        const a = Iso.projectTo(tx + 1 + padE, ty, elev + 0.1, _msB0);
        const b = Iso.projectTo(tx + 1 + padE, ty + 1 + padS, elev + 0.1, _msB1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRampTile(ctx, tx, ty, tCell, state, P, isSil, zScale) {
    const Iso = ZS.Iso;
    const elev = (ZS.DATA.PLATEAU_ELEV_Z != null ? ZS.DATA.PLATEAU_ELEV_Z : 10);
    const dir = (tCell && tCell.rampDir) || { dx: 1, dy: 0 };
    const dx = dir.dx || 0;
    const dy = dir.dy || 0;

    const z00 = getCornerClipElev(dx, dy, 0, 0, elev, 0.15);
    const z10 = getCornerClipElev(dx, dy, 1, 0, elev, 0.15);
    const z11 = getCornerClipElev(dx, dy, 1, 1, elev, 0.15);
    const z01 = getCornerClipElev(dx, dy, 0, 1, elev, 0.15);

    const sideSoil = isSil ? '#9FA8B2' : (P.plateauCliffSoil || '#473628');
    const sideSlate = isSil ? '#AAB3BC' : (P.plateauCliffSlate || '#424A56');
    const earthTop = isSil ? '#C8D0D8' : (P.rampEarth || '#6B665D');

    if (z01 > 0.5 || z11 > 0.5) {
      drawPolyFace(ctx, [
        Iso.projectTo(tx, ty + 1, z01, _msB0),
        Iso.projectTo(tx + 1, ty + 1, z11, _msB1),
        Iso.projectTo(tx + 1, ty + 1, 0, _msB2),
        Iso.projectTo(tx, ty + 1, 0, _msB3)
      ], sideSoil, 0.82, false, false, zScale);
      drawPolyFace(ctx, [
        Iso.projectTo(tx, ty + 1, Math.min(z01, z01 * 0.55), _msT0),
        Iso.projectTo(tx + 1, ty + 1, Math.min(z11, z11 * 0.55), _msT1),
        Iso.projectTo(tx + 1, ty + 1, 0, _msT2),
        Iso.projectTo(tx, ty + 1, 0, _msT3)
      ], sideSlate, 0.80, false, false, zScale);
    }
    if (z10 > 0.5 || z11 > 0.5) {
      drawPolyFace(ctx, [
        Iso.projectTo(tx + 1, ty, z10, _msB0),
        Iso.projectTo(tx + 1, ty + 1, z11, _msB1),
        Iso.projectTo(tx + 1, ty + 1, 0, _msB2),
        Iso.projectTo(tx + 1, ty, 0, _msB3)
      ], sideSoil, 0.66, false, false, zScale);
      drawPolyFace(ctx, [
        Iso.projectTo(tx + 1, ty, Math.min(z10, z10 * 0.55), _msT0),
        Iso.projectTo(tx + 1, ty + 1, Math.min(z11, z11 * 0.55), _msT1),
        Iso.projectTo(tx + 1, ty + 1, 0, _msT2),
        Iso.projectTo(tx + 1, ty, 0, _msT3)
      ], sideSlate, 0.66, false, false, zScale);
    }

    const slopeShade = (dx < 0 || dy < 0) ? 0.92 : 1.0;
    drawPolyFace(ctx, [
      Iso.projectTo(tx, ty, z00, _msB0),
      Iso.projectTo(tx + 1, ty, z10, _msB1),
      Iso.projectTo(tx + 1, ty + 1, z11, _msB2),
      Iso.projectTo(tx, ty + 1, z01, _msB3)
    ], earthTop, slopeShade, false, false, zScale);

    if (isSil) return;

    const projSlope = (u, v, zAdd, outPt) => {
      let lx, ly;
      if (dx === 1) { lx = u; ly = v; }
      else if (dx === -1) { lx = 1 - u; ly = v; }
      else if (dy === 1) { lx = v; ly = u; }
      else { lx = v; ly = 1 - u; }
      return Iso.projectTo(tx + lx, ty + ly, u * elev + (zAdd || 0), outPt);
    };

    const turfLip = P.plateauTopB || '#577054';
    drawPolyFace(ctx, [
      projSlope(1.0, 0.06, 0.15, _msB0),
      projSlope(1.0, 0.94, 0.15, _msB1),
      projSlope(0.84, 0.88, 0.15, _msB2),
      projSlope(0.78, 0.52, 0.15, _msT0),
      projSlope(0.85, 0.14, 0.15, _msB3)
    ], turfLip, slopeShade, false, false, zScale);

    const flagCol = P.rampFlagstone || '#7E786E';
    const stoneSpots = (tx + ty) % 2 === 0 ? [0.28, 0.54, 0.76] : [0.34, 0.66];
    for (let s = 0; s < stoneSpots.length; s++) {
      const uC = stoneSpots[s];
      const vOff = 0.44 + (tileHash01(tx, ty, 730 + s) - 0.5) * 0.14;
      const du = 0.085;
      const dv = 0.14;
      drawPolyFace(ctx, [
        projSlope(uC - du, vOff - dv, 0.35, _msB0),
        projSlope(uC + du, vOff - dv * 0.8, 0.35, _msB1),
        projSlope(uC + du * 0.9, vOff + dv, 0.35, _msB2),
        projSlope(uC - du, vOff + dv * 0.85, 0.35, _msB3)
      ], flagCol, slopeShade * (0.94 + s * 0.03), false, true, zScale);
    }

    ctx.fillStyle = 'rgba(42, 38, 32, 0.42)';
    for (let g = 0; g < 3; g++) {
      const gu = 0.18 + tileHash01(tx, ty, 750 + g) * 0.58;
      const gv = 0.24 + tileHash01(tx, ty, 760 + g) * 0.52;
      const gp = projSlope(gu, gv, 0.25, _msB0);
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, 1.15 * zScale, 0, Math.PI * 2);
      ctx.fill();
    }

    const curbCol = P.rampCurb || '#535B65';
    const curbStone = P.rampStone || '#7E786C';
    const curbUs = [0.25, 0.54, 0.82];
    for (let si = 0; si < 2; si++) {
      const vSide = si === 0 ? 0.07 : 0.93;
      for (let ci = 0; ci < 3; ci++) {
        const u = curbUs[ci];
        let lx, ly;
        if (dx === 1) { lx = u; ly = vSide; }
        else if (dx === -1) { lx = 1 - u; ly = vSide; }
        else if (dy === 1) { lx = vSide; ly = u; }
        else { lx = vSide; ly = 1 - u; }
        const hCurb = 2.4 + tileHash01(tx + ci, ty + si, 790) * 1.4;
        drawMiniStoneBlock(
          ctx,
          tx + lx,
          ty + ly,
          u * elev - 0.2,
          dx !== 0 ? 0.08 : 0.055,
          dx !== 0 ? 0.055 : 0.08,
          hCurb,
          curbCol,
          curbStone,
          false,
          zScale
        );
      }
    }
  }

  function drawHoverOverlay(ctx, state, uiState, tx, ty, zScale) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;

    if (uiState.activeSkill === 'airstrike') {
      drawIsoCircle(ctx, tx + 0.5, ty + 0.5, 2.5, P.danger, P.dangerFill);
      return;
    }

    if (state.phase !== 'day') {
      Iso.drawTilePoly(ctx, tx, ty, 2, P.hoverFill, P.hoverStroke, 1.5);
      return;
    }

    if (uiState.mode === 'remove') {
      Iso.drawTilePoly(ctx, tx, ty, 2, P.dangerFill, P.danger, 2);
      return;
    }

    if (uiState.mode === 'move') {
      if (uiState.movingSource) {
        const srcCell = state.structGrid[uiState.movingSource.ty] && state.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
        const srcUnit = srcCell && (srcCell.mounted || srcCell);
        const srcDef = srcUnit ? DATA.ITEMS[srcUnit.id] : null;
        const dest = state.structGrid[ty] && state.structGrid[ty][tx];
        const destTerrain = ZS.Game.getTerrainAt ? ZS.Game.getTerrainAt(tx, ty) : (state.terrainGrid && state.terrainGrid[ty] && state.terrainGrid[ty][tx]);
        const inBounds = tx > 0 && ty > 0 && tx < DATA.GRID_SIZE - 1 && ty < DATA.GRID_SIZE - 1;
        let terrainOk = true;
        if (destTerrain) {
          if (destTerrain.kind === 'rock') terrainOk = false;
          else if (destTerrain.kind === 'ramp' && (!srcDef || srcDef.id !== 'razor_pad')) terrainOk = false;
        }
        const canMountDest = !!(terrainOk && dest && srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && !dest.mounted);
        const canDrop = inBounds && terrainOk && (!dest || canMountDest);
        if (inBounds && terrainOk && dest && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && srcDef && srcDef.canMountOnWall) {
          drawWallPillarHighlight(
            ctx,
            tx,
            ty,
            dest.level || 2,
            canDrop ? 'rgba(74, 222, 128, 0.18)' : 'rgba(255, 77, 109, 0.18)',
            canDrop ? P.health : P.danger,
            2.2
          );
          if (canDrop && srcDef.range && ZS.Game.getStructureEffectiveStats) {
            const groundEff = ZS.Game.getStructureEffectiveStats(srcUnit, tx, ty, undefined, false);
            const mountEff = ZS.Game.getStructureEffectiveStats(srcUnit, tx, ty, undefined, true);
            drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, groundEff.range, mountEff.range, zScale);
            if (isDirectFireDef(srcDef)) {
              drawPeakShadowSectors(ctx, state, tx + 0.5, ty + 0.5, mountEff.range, zScale);
            }
          } else if (canDrop && srcDef.aura && srcDef.aura.radius && ZS.Game.getStructureEffectiveStats) {
            const mEff = ZS.Game.getStructureEffectiveStats(srcUnit, tx, ty, undefined, true);
            drawIsoCircle(ctx, tx + 0.5, ty + 0.5, mEff.auraRadius || (srcDef.aura.radius + 0.4), P.goldStroke, P.goldFill);
          }
        } else {
          Iso.drawTilePoly(
            ctx,
            tx,
            ty,
            2,
            canDrop ? P.healthFill : P.dangerFill,
            canDrop ? P.health : P.danger,
            2
          );
          if (inBounds && canDrop && srcDef && !(uiState.movingSource.tx === tx && uiState.movingSource.ty === ty)) {
            const eff = ZS.Game.getStructureEffectiveStats ? ZS.Game.getStructureEffectiveStats(srcUnit, tx, ty, undefined, false) : null;
            const moveRange = eff ? eff.range : srcDef.range;
            const moveMinRange = (eff && eff.minRange) || srcDef.minRange || 0;
            const moveAuraR = (eff && eff.auraRadius) || (srcDef.aura && srcDef.aura.radius);
            const srcProf = eff && eff.prof ? eff.prof : (ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(srcDef, srcUnit.level || 1) : null);
            const moveGateR = (srcProf && srcProf.gateSlowRadius) || srcDef.gateSlowRadius;
            if (moveRange > 0) {
              drawCombatRangeOverlay(ctx, state, srcDef, tx + 0.5, ty + 0.5, moveRange, moveMinRange, zScale);
            }
            if (moveAuraR > 0) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, moveAuraR, P.goldStroke, P.goldFill);
            }
            if (moveGateR > 0) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, moveGateR, P.rangeStroke, 'rgba(255, 255, 255, 0.08)');
            }
          }
        }
      } else {
        Iso.drawTilePoly(ctx, tx, ty, 2, P.selectFill, P.selectStroke, 2);
      }
      return;
    }

    if (uiState.selectedItemId) {
      const def = DATA.ITEMS[uiState.selectedItemId];
      if (!def) return;
      const check = ZS.Game.canPlaceItem(uiState.selectedItemId, tx, ty);
      const existing = state.structGrid[ty] && state.structGrid[ty][tx];

      if (existing && existing.id === 'barricade_wall' && (existing.level || 1) >= 2 && def.canMountOnWall) {
        drawWallPillarHighlight(
          ctx,
          tx,
          ty,
          existing.level || 2,
          check.ok ? 'rgba(74, 222, 128, 0.18)' : 'rgba(255, 77, 109, 0.18)',
          check.ok ? P.health : P.danger,
          2.2 * Math.min(1.2, zScale)
        );
        if (check.ok && def.range && ZS.Game.getStructureEffectiveStats) {
          const previewStub = { id: def.id, level: 1, hp: def.maxHp || 100, maxHp: def.maxHp || 100 };
          const groundEff = ZS.Game.getStructureEffectiveStats(previewStub, tx, ty, undefined, false);
          const mountEff = ZS.Game.getStructureEffectiveStats(previewStub, tx, ty, undefined, true);
          drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, groundEff.range, mountEff.range, zScale);
          if (isDirectFireDef(def)) {
            drawPeakShadowSectors(ctx, state, tx + 0.5, ty + 0.5, mountEff.range, zScale);
          }
        } else if (check.ok && def.aura && def.aura.radius && ZS.Game.getStructureEffectiveStats) {
          const previewStub = { id: def.id, level: 1, hp: def.maxHp || 100, maxHp: def.maxHp || 100 };
          const mEff = ZS.Game.getStructureEffectiveStats(previewStub, tx, ty, undefined, true);
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, mEff.auraRadius || (def.aura.radius + 0.4), P.goldStroke, P.goldFill);
        }
        return;
      }

      Iso.drawTilePoly(
        ctx,
        tx,
        ty,
        2,
        check.ok ? P.healthFill : P.dangerFill,
        check.ok ? P.health : P.danger,
        2 * Math.min(1.2, zScale)
      );
      if (check.autoUnderlay && existing) {
        const eDef = DATA.ITEMS[existing.id];
        if (eDef && eDef.range) {
          const groundEff = ZS.Game.getStructureEffectiveStats(existing, tx, ty, undefined, false);
          const mountEff = ZS.Game.getStructureEffectiveStats(existing, tx, ty, undefined, true);
          drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, groundEff.range, mountEff.range, zScale);
          if (isDirectFireDef(eDef)) {
            drawPeakShadowSectors(ctx, state, tx + 0.5, ty + 0.5, mountEff.range, zScale);
          }
        } else if (eDef && eDef.aura && eDef.aura.radius) {
          const mEff = ZS.Game.getStructureEffectiveStats(existing, tx, ty, undefined, true);
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, mEff.auraRadius || (eDef.aura.radius + 0.4), P.goldStroke, P.goldFill);
        }
      } else {
        const previewLv =
          def.id === 'field_tent' && state.freeVouchers && state.freeVouchers.shelter_pod > 0
            ? 3
            : def.id === 'shelter_pod'
            ? 3
            : 1;
        const previewStub = {
          id: def.id === 'shelter_pod' ? 'field_tent' : def.id,
          level: previewLv,
          hp: def.maxHp || 100,
          maxHp: def.maxHp || 100
        };
        const eff = ZS.Game.getStructureEffectiveStats ? ZS.Game.getStructureEffectiveStats(previewStub, tx, ty, undefined, false) : null;
        const tier1Prof = (eff && eff.prof) || (ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, 1) : null);
        const buildRange = (eff && eff.range) || def.range;
        const buildMinRange = (eff && eff.minRange) || def.minRange || 0;
        const auraR = (eff && eff.auraRadius) || (tier1Prof && tier1Prof.auraRadius) || (def.aura && def.aura.radius);
        const gateSlowR = (tier1Prof && tier1Prof.gateSlowRadius) || def.gateSlowRadius;
        if (buildRange > 0) {
          drawCombatRangeOverlay(ctx, state, def, tx + 0.5, ty + 0.5, buildRange, buildMinRange, zScale);
        }
        if (auraR > 0) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, auraR, P.goldStroke, P.goldFill);
        }
        if (gateSlowR > 0) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, gateSlowR, P.rangeStroke, 'rgba(255, 255, 255, 0.08)');
        }
      }
    } else {
      Iso.drawTilePoly(ctx, tx, ty, 2, P.hoverFill, P.hoverStroke, 1.2);
    }
  }

  function drawBuildGhost(ctx, state, uiState, tx, ty, timeSec, zScale) {
    let previewObj = null;
    let previewMountHost = null;

    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (def && def.layer === 'struct') {
        const existing = state.structGrid[ty] && state.structGrid[ty][tx];
        if (!existing) {
          const previewLv =
            def.id === 'field_tent' && state.freeVouchers && state.freeVouchers.shelter_pod > 0
              ? 3
              : def.id === 'shelter_pod'
              ? 3
              : 1;
          previewObj = { id: def.id === 'shelter_pod' ? 'field_tent' : def.id, level: previewLv, hp: 100, maxHp: 100, aimAngle: 0 };
        } else if (ZS.Game.canPlaceItem) {
          const check = ZS.Game.canPlaceItem(uiState.selectedItemId, tx, ty);
          if (check.ok && check.mountOnWall) {
            previewMountHost = { wallLv: existing.level || 2, unit: { id: def.id, level: 1, hp: 100, maxHp: 100, aimAngle: 0 } };
          } else if (check.ok && check.autoUnderlay) {
            previewObj = { id: 'barricade_wall', level: 2, hp: 360, maxHp: 360, mounted: { ...existing, buildAnimTimer: 0 } };
          }
        }
      }
    } else if (uiState.mode === 'move' && uiState.movingSource) {
      const srcCell = state.structGrid[uiState.movingSource.ty] && state.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
      const src = srcCell && (srcCell.mounted || srcCell);
      const srcDef = src ? ZS.DATA.ITEMS[src.id] : null;
      const dest = state.structGrid[ty] && state.structGrid[ty][tx];
      if (src && !(uiState.movingSource.tx === tx && uiState.movingSource.ty === ty)) {
        if (!dest) {
          previewObj = { id: src.id, level: src.level || 1, rank: src.rank || 0, hp: 100, maxHp: 100, aimAngle: src.aimAngle || 0 };
        } else if (srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && !dest.mounted) {
          previewMountHost = {
            wallLv: dest.level || 2,
            unit: { id: src.id, level: src.level || 1, rank: src.rank || 0, hp: 100, maxHp: 100, aimAngle: src.aimAngle || 0 }
          };
        }
      }
    }

    if (previewObj) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      R.drawStructure(ctx, previewObj, tx, ty, state, true, timeSec, zScale);
      ctx.restore();
    } else if (previewMountHost) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      R.drawWallDeck(ctx, previewMountHost.wallLv, tx, ty, zScale);
      const mBaseZ = previewMountHost.wallLv >= 3 ? 25.4 : 15.2;
      R.drawMountedUnit(ctx, previewMountHost.unit, tx, ty, mBaseZ, state, true, timeSec, zScale);
      ctx.restore();
    }
  }

  function getStructVisualTopZ(id, level) {
    switch (id) {
      case 'command_hq': return level >= 3 ? 46 : level === 2 ? 34 : 30;
      case 'barricade_wall': return level >= 3 ? 27.7 : level === 2 ? 14 : 10.9;
      case 'tactical_gate': return [16.5, 26.5, 28.0][Math.min(3, Math.max(1, level || 1)) - 1];
      case 'hesco_wall': return level >= 3 ? 19 : 14;
      case 'blast_wall': return level >= 3 ? 29 : 25;
      case 'razor_pad': return [5.4, 5.8, 6.45][Math.min(3, Math.max(1, level || 1)) - 1];
      case 'rifle_bunker': return level >= 3 ? 26 : 23;
      case 'shotgun_post': return 23;
      case 'sniper_tower': return 60;
      case 'vulcan_turret': return level >= 2 ? 24 : 21;
      case 'missile_pod': return level >= 3 ? 28 : 25;
      case 'emp_coil': return 35;
      case 'solar_array': return [12, 17, 24, 34][Math.min(4, Math.max(1, level || 1)) - 1];
      case 'wind_turbine': return [34, 46, 60, 74][Math.min(4, Math.max(1, level || 1)) - 1];
      case 'battery_bank': return [14, 22, 33, 40][Math.min(4, Math.max(1, level || 1)) - 1];
      case 'field_tent': return [16, 19, 22, 32][Math.min(4, Math.max(1, level || 1)) - 1];
      case 'shelter_pod': return 22;
      case 'gas_heater': return 26;
      case 'led_floodlight': return 24;
      case 'urban_planter': return 32;
      case 'vending_machine': return 23;
      case 'repair_bay': return [18, 25, 30][Math.min(3, Math.max(1, level || 1)) - 1];
      case 'lounge_set': return 28;
      case 'arcade_neon': return 27;
      case 'boss_trophy': return 37;
      default: return 24;
    }
  }

  function getEffectiveStructTopZ(st) {
    if (!st) return 0;
    const lv = st.level || 1;
    let topZ = getStructVisualTopZ(st.id, lv);
    if (st.mounted) {
      const mDefTop = getStructVisualTopZ(st.mounted.id, st.mounted.level || 1);
      const deckZ = lv >= 3 ? 25.4 : 15.2;
      topZ = Math.max(topZ, deckZ + Math.min(28, mDefTop));
    }
    return topZ;
  }

  function doesStructOccludeTarget(st, sx, sy, tx, ty, state) {
    if (!st) return false;
    const dSum = (sx + sy) - (tx + ty);
    if (dSum < 1) return false;
    const dCol = Math.abs((sx - sy) - (tx - ty));
    if (dCol > 1) return false;
    const rawTopZ = getEffectiveStructTopZ(st);
    // Flat ground traps (< 10px, e.g. razor_pad 5.4..6.45) never hide behind tiles
    if (rawTopZ < 10) return false;
    const sElev = state ? getTileElevAt(state, sx + 0.5, sy + 0.5) : 0;
    const tElev = state ? getTileElevAt(state, tx + 0.5, ty + 0.5) : 0;
    const effTopZ = rawTopZ + (sElev - tElev);
    const minTopZ = dSum <= 2 ? 10 : (dSum - 1) * 15 - 3;
    return effTopZ >= minTopZ;
  }

  function doesRockOccludeTarget(rx, ry, tx, ty, state) {
    const dSum = (rx + ry) - (tx + ty);
    if (dSum < 1) return false;
    const dCol = Math.abs((rx - ry) - (tx - ty));
    if (dCol > 1) return false;
    const tRock = state && state.terrainGrid && state.terrainGrid[ry] && state.terrainGrid[ry][rx];
    const rockTopZ = tRock && tRock.isPeak
      ? (tRock.topZ || ZS.DATA.ROCK_PEAK_TOP_Z || 33)
      : ((tRock && tRock.topZ) || ZS.DATA.ROCK_TOP_Z || 16);
    const tElev = state ? getTileElevAt(state, tx + 0.5, ty + 0.5) : 0;
    const effTopZ = rockTopZ - tElev;
    const minTopZ = dSum <= 2 ? 10 : (dSum - 1) * 15 - 3;
    return effTopZ >= minTopZ;
  }

  // ===================== #6 SILHOUETTE PRIMITIVES (Top-Left 100% / 82% / 66% Shading) =====================
  function drawPolyFace(ctx, pts, hex, shadeFactor, isEmissive, withEdge, zScale) {
    const Iso = ZS.Iso;
    const f = isEmissive ? (shadeFactor >= 1 ? 1 : 0.92) : shadeFactor;
    const fill = Iso.resolveFaceColor(hex, f, !!isEmissive, 0);
    if (!fill) return;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (withEdge !== false && !isEmissive && !window.ZS_SILHOUETTE_MODE) {
      ctx.strokeStyle = 'rgba(10, 14, 20, 0.28)';
      ctx.lineWidth = Math.max(0.65, 0.8 * zScale);
      ctx.stroke();
    }
    if (isEmissive && R.emissiveList && !window.ZS_SILHOUETTE_MODE) {
      const snap = new Array(pts.length);
      for (let i = 0; i < pts.length; i++) {
        snap[i] = { x: pts[i].x, y: pts[i].y };
      }
      R.emissiveList.push({
        kind: 'poly',
        pts: snap,
        fill,
        hex,
        alpha: R.currentEntityAlpha != null ? R.currentEntityAlpha : 1.0
      });
    }
  }

  const _ibA = { x: 0, y: 0 };
  const _ibB = { x: 0, y: 0 };
  const _ibC = { x: 0, y: 0 };
  const _ibD = { x: 0, y: 0 };
  const _ibBb = { x: 0, y: 0 };
  const _ibCb = { x: 0, y: 0 };
  const _ibDb = { x: 0, y: 0 };
  const _ibLeftQuad = [_ibD, _ibC, _ibCb, _ibDb];
  const _ibRightQuad = [_ibC, _ibB, _ibBb, _ibCb];
  const _ibTopQuad = [_ibA, _ibB, _ibC, _ibD];

  function drawIsoBox(ctx, gx, gy, z, w, d, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const em = !!(opts && opts.emissive);
    const withEdge = !(opts && opts.edge === false);
    const noTop = !!(opts && opts.noTop);
    const zTop = z + h;
    Iso.projectTo(gx, gy, zTop, _ibA);
    Iso.projectTo(gx + w, gy, zTop, _ibB);
    Iso.projectTo(gx + w, gy + d, zTop, _ibC);
    Iso.projectTo(gx, gy + d, zTop, _ibD);
    if (h > 0) {
      Iso.projectTo(gx + w, gy, z, _ibBb);
      Iso.projectTo(gx + w, gy + d, z, _ibCb);
      Iso.projectTo(gx, gy + d, z, _ibDb);
      drawPolyFace(ctx, _ibLeftQuad, hex, 0.82, em, withEdge, zScale);
      drawPolyFace(ctx, _ibRightQuad, hex, 0.66, em, withEdge, zScale);
    }
    if (!noTop) {
      drawPolyFace(ctx, _ibTopQuad, hex, 1.0, em, withEdge, zScale);
    }
  }

  const _frB0 = { x: 0, y: 0 };
  const _frB1 = { x: 0, y: 0 };
  const _frB2 = { x: 0, y: 0 };
  const _frB3 = { x: 0, y: 0 };
  const _frT0 = { x: 0, y: 0 };
  const _frT1 = { x: 0, y: 0 };
  const _frT2 = { x: 0, y: 0 };
  const _frT3 = { x: 0, y: 0 };
  const _frFace0 = [_frB0, _frB1, _frT1, _frT0];
  const _frFace1 = [_frB0, _frB3, _frT3, _frT0];
  const _frFace2 = [_frB3, _frB2, _frT2, _frT3];
  const _frFace3 = [_frB2, _frB1, _frT1, _frT2];
  const _frFaceTop = [_frT0, _frT1, _frT2, _frT3];

  function drawFrustumXY(ctx, gx, gy, z, w, d, h, ix, iy, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const em = !!(opts && opts.emissive);
    const noTop = !!(opts && opts.noTop);
    const zTop = z + h;
    Iso.projectTo(gx, gy, z, _frB0);
    Iso.projectTo(gx + w, gy, z, _frB1);
    Iso.projectTo(gx + w, gy + d, z, _frB2);
    Iso.projectTo(gx, gy + d, z, _frB3);
    Iso.projectTo(gx + ix, gy + iy, zTop, _frT0);
    Iso.projectTo(gx + w - ix, gy + iy, zTop, _frT1);
    Iso.projectTo(gx + w - ix, gy + d - iy, zTop, _frT2);
    Iso.projectTo(gx + ix, gy + d - iy, zTop, _frT3);
    drawPolyFace(ctx, _frFace0, hex, 0.95, em, true, zScale);
    drawPolyFace(ctx, _frFace1, hex, 0.95, em, true, zScale);
    drawPolyFace(ctx, _frFace2, hex, 0.86, em, true, zScale);
    drawPolyFace(ctx, _frFace3, hex, 0.70, em, true, zScale);
    if (!noTop) {
      drawPolyFace(ctx, _frFaceTop, hex, 1.0, em, true, zScale);
    }
  }

  function drawFrustum(ctx, gx, gy, z, w, d, h, inset, hex, opts, zScale) {
    drawFrustumXY(ctx, gx, gy, z, w, d, h, inset, inset, hex, opts, zScale);
  }

  function calcSideShade(nx, ny) {
    const t = (ny - nx) / (Math.abs(nx) + Math.abs(ny) + 1e-6);
    return 0.74 + 0.08 * t;
  }

  const CYL_LUT = Object.create(null);
  const _cylSideTop0 = { x: 0, y: 0 };
  const _cylSideTop1 = { x: 0, y: 0 };
  const _cylSideBot1 = { x: 0, y: 0 };
  const _cylSideBot0 = { x: 0, y: 0 };
  const _cylQuad = [_cylSideTop0, _cylSideTop1, _cylSideBot1, _cylSideBot0];

  function getCylLut(n) {
    let lut = CYL_LUT[n];
    if (lut) return lut;
    const cos = new Float64Array(n);
    const sin = new Float64Array(n);
    const topPts = new Array(n);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      cos[k] = Math.cos(a);
      sin[k] = Math.sin(a);
      topPts[k] = { x: 0, y: 0 };
    }
    const rawSides = [];
    for (let k = 0; k < n; k++) {
      const am = ((k + 0.5) / n) * Math.PI * 2;
      const nx = Math.cos(am);
      const ny = Math.sin(am);
      if (nx + ny > -0.25) {
        rawSides.push({
          k0: k,
          k1: (k + 1) % n,
          depth: nx + ny,
          shade: calcSideShade(nx, ny)
        });
      }
    }
    rawSides.sort((a, b) => a.depth - b.depth);
    const sideCount = rawSides.length;
    const sideK0 = new Uint16Array(sideCount);
    const sideK1 = new Uint16Array(sideCount);
    const sideShade = new Float64Array(sideCount);
    for (let i = 0; i < sideCount; i++) {
      sideK0[i] = rawSides[i].k0;
      sideK1[i] = rawSides[i].k1;
      sideShade[i] = rawSides[i].shade;
    }
    lut = { n, cos, sin, topPts, sideCount, sideK0, sideK1, sideShade };
    CYL_LUT[n] = lut;
    return lut;
  }

  function drawCyl(ctx, cx, cy, z, r, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const n = (opts && opts.n) || 14;
    const em = !!(opts && opts.emissive);
    const noSides = !!(opts && opts.noSides);
    const noTop = !!(opts && opts.noTop);
    const topEdge = !(opts && opts.topEdge === false);
    const lut = getCylLut(n);
    const cos = lut.cos;
    const sin = lut.sin;
    const zTop = z + h;

    if (!noSides && h > 0) {
      const sideCount = lut.sideCount;
      const sideK0 = lut.sideK0;
      const sideK1 = lut.sideK1;
      const sideShade = lut.sideShade;
      for (let i = 0; i < sideCount; i++) {
        const k0 = sideK0[i];
        const k1 = sideK1[i];
        const x0 = cx + cos[k0] * r;
        const y0 = cy + sin[k0] * r;
        const x1 = cx + cos[k1] * r;
        const y1 = cy + sin[k1] * r;
        Iso.projectTo(x0, y0, zTop, _cylSideTop0);
        Iso.projectTo(x1, y1, zTop, _cylSideTop1);
        Iso.projectTo(x1, y1, z, _cylSideBot1);
        Iso.projectTo(x0, y0, z, _cylSideBot0);
        drawPolyFace(ctx, _cylQuad, hex, sideShade[i], em, false, zScale);
      }
    }
    if (!noTop) {
      const topPts = lut.topPts;
      for (let k = 0; k < n; k++) {
        Iso.projectTo(cx + cos[k] * r, cy + sin[k] * r, zTop, topPts[k]);
      }
      drawPolyFace(ctx, topPts, hex, 1.0, em, topEdge, zScale);
    }
  }

  function drawDome(ctx, cx, cy, z, r, h, hex, opts, zScale) {
    const o = opts || {};
    const slices = o.slices || 5;
    for (let i = 0; i < slices; i++) {
      const ri = r * Math.sqrt(Math.max(0.04, 1 - Math.pow(i / slices, 2)));
      drawCyl(ctx, cx, cy, z + (h * i) / slices, ri, h / slices + 0.3, hex, { n: o.n || 16, emissive: o.emissive, topEdge: i === slices - 1 }, zScale);
    }
  }

  function drawBlob(ctx, cx, cy, z, r, h, hex, opts, zScale) {
    const o = opts || {};
    const slices = o.slices || 6;
    for (let i = 0; i < slices; i++) {
      const ri = r * Math.max(0.25, Math.sin((Math.PI * (i + 0.5)) / slices));
      drawCyl(ctx, cx, cy, z + (h * i) / slices, ri, h / slices + 0.3, hex, { n: o.n || 14, emissive: o.emissive, topEdge: false }, zScale);
    }
  }

  function drawCone(ctx, cx, cy, z, r, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const n = o.n || 12;
    const em = !!o.emissive;
    const apex = Iso.gridToScreen(cx, cy, z + h);
    const tris = [];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) * 0.5;
      tris.push({ k, a0, a1, nx: Math.cos(am), ny: Math.sin(am) });
    }
    tris.sort((a, b) => a.nx + a.ny - (b.nx + b.ny));
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const c = o.alt && t.k % 2 ? o.alt : hex;
      const shade = t.nx + t.ny < 0 ? 0.97 : Math.min(1.0, calcSideShade(t.nx, t.ny) + 0.12);
      drawPolyFace(
        ctx,
        [
          Iso.gridToScreen(cx + Math.cos(t.a0) * r, cy + Math.sin(t.a0) * r, z),
          Iso.gridToScreen(cx + Math.cos(t.a1) * r, cy + Math.sin(t.a1) * r, z),
          apex
        ],
        c,
        shade,
        em,
        false,
        zScale
      );
    }
  }

  function drawGable(ctx, gx, gy, z, w, d, rise, roofHex, wallHex, zScale, opts) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const cy = gy + d * 0.5;
    const b0 = Iso.gridToScreen(gx, gy, z);
    const b1 = Iso.gridToScreen(gx + w, gy, z);
    const b2 = Iso.gridToScreen(gx + w, gy + d, z);
    const b3 = Iso.gridToScreen(gx, gy + d, z);
    const r0 = Iso.gridToScreen(gx, cy, z + rise);
    const r1 = Iso.gridToScreen(gx + w, cy, z + rise);

    drawPolyFace(ctx, [b0, b1, r1, r0], roofHex, 0.96, false, true, zScale);
    drawPolyFace(ctx, [b3, b2, r1, r0], roofHex, 0.85, false, true, zScale);
    drawPolyFace(ctx, [b1, b2, r1], wallHex, 0.66, false, true, zScale);

    if (isPlainDetailFallback()) return;

    // Corrugated roof ribs / panel seam lines on both roof slopes
    const ribs = o.ribs != null ? o.ribs : 5;
    if (ribs > 1) {
      ctx.strokeStyle = o.seamColor || 'rgba(12, 18, 24, 0.24)';
      ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
      ctx.beginPath();
      for (let i = 1; i < ribs; i++) {
        const sx = gx + (w * i) / ribs;
        const pR = Iso.gridToScreen(sx, cy, z + rise);
        const pF = Iso.gridToScreen(sx, gy + d, z);
        const pB = Iso.gridToScreen(sx, gy, z);
        ctx.moveTo(pR.x, pR.y);
        ctx.lineTo(pF.x, pF.y);
        ctx.moveTo(pR.x, pR.y);
        ctx.lineTo(pB.x, pB.y);
      }
      ctx.stroke();
    }

    // Eave fascia overhang underside shadow along front eave & right rake
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.44)';
    ctx.lineWidth = Math.max(0.85, 1.15 * zScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(b3.x, b3.y + 0.7 * zScale);
    ctx.lineTo(b2.x, b2.y + 0.7 * zScale);
    ctx.lineTo(r1.x, r1.y + 0.6 * zScale);
    ctx.moveTo(b2.x, b2.y + 0.7 * zScale);
    ctx.lineTo(b1.x, b1.y + 0.7 * zScale);
    ctx.stroke();

    // 1px sunlit ridge cap + front-left gable rake highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = Math.max(0.7, 0.9 * zScale);
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(0.6, 0.75 * zScale);
    ctx.beginPath();
    ctx.moveTo(b3.x, b3.y);
    ctx.lineTo(r0.x, r0.y);
    ctx.stroke();
  }

  function drawSlantedSolarPanel(ctx, gx, gy, w, d, zBack, zFront, thick, frameHex, cellHex, gridHex, cols, rows, zScale) {
    const Iso = ZS.Iso;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const mods = Iso.getRenderModifiers();
    const isPlain = isSil || mods.flash > 0.01;
    const a = Iso.gridToScreen(gx, gy, zBack);
    const b = Iso.gridToScreen(gx + w, gy, zBack);
    const c = Iso.gridToScreen(gx + w, gy + d, zFront);
    const dd = Iso.gridToScreen(gx, gy + d, zFront);
    const bB = Iso.gridToScreen(gx + w, gy, zBack - thick);
    const cB = Iso.gridToScreen(gx + w, gy + d, zFront - thick);
    const dB = Iso.gridToScreen(gx, gy + d, zFront - thick);
    const aB = Iso.gridToScreen(gx, gy, zBack - thick);

    // Side & back thickness extrusions of brushed aluminum bezel frame
    drawPolyFace(ctx, [a, dd, dB, aB], frameHex, 0.88, false, true, zScale);
    drawPolyFace(ctx, [dd, c, cB, dB], frameHex, 0.82, false, true, zScale);
    drawPolyFace(ctx, [c, b, bB, cB], frameHex, 0.66, false, true, zScale);

    // Top metallic bezel rim
    drawPolyFace(ctx, [a, b, c, dd], frameHex, 1.0, false, true, zScale);

    // Inset dark slate-navy solar cell wafer bed
    const bX = Math.min(w * 0.08, 0.032);
    const bY = Math.min(d * 0.08, 0.032);
    const cX0 = gx + bX;
    const cX1 = gx + w - bX;
    const cY0 = gy + bY;
    const cY1 = gy + d - bY;
    const cW = Math.max(0.04, cX1 - cX0);
    const cD = Math.max(0.04, cY1 - cY0);
    const t0 = bY / Math.max(0.01, d);
    const t1 = 1 - t0;
    const zC0 = zBack + (zFront - zBack) * t0 + 0.05;
    const zC1 = zBack + (zFront - zBack) * t1 + 0.05;
    const ca = Iso.gridToScreen(cX0, cY0, zC0);
    const cb = Iso.gridToScreen(cX1, cY0, zC0);
    const cc = Iso.gridToScreen(cX1, cY1, zC1);
    const cd = Iso.gridToScreen(cX0, cY1, zC1);

    if (!isPlain) {
      const topCol = Iso.resolveFaceColor(cellHex, 1.14, false, 0) || cellHex;
      const botCol = Iso.resolveFaceColor(cellHex, 0.82, false, 0) || cellHex;
      const grad = ctx.createLinearGradient(ca.x, ca.y, cc.x, cc.y);
      grad.addColorStop(0, topCol);
      grad.addColorStop(0.55, Iso.resolveFaceColor(cellHex, 0.98, false, 0) || cellHex);
      grad.addColorStop(1, botCol);
      ctx.beginPath();
      ctx.moveTo(ca.x, ca.y);
      ctx.lineTo(cb.x, cb.y);
      ctx.lineTo(cc.x, cc.y);
      ctx.lineTo(cd.x, cd.y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(8, 14, 22, 0.55)';
      ctx.lineWidth = Math.max(0.6, 0.75 * zScale);
      ctx.stroke();
    } else {
      drawPolyFace(ctx, [ca, cb, cc, cd], cellHex, 1.0, false, true, zScale);
    }

    if (!isPlain) {
      // Crisp silver-slate cell grid busbars & micro sub-lines
      const busCol = Iso.resolveFaceColor(gridHex, 1.0, false, 0) || gridHex;
      const subCol = Iso.resolveFaceColor(gridHex, 0.68, false, 0) || gridHex;

      // Micro horizontal wafer sub-divisions
      const subRows = rows * 2;
      ctx.strokeStyle = subCol;
      ctx.lineWidth = Math.max(0.45, 0.52 * zScale);
      ctx.beginPath();
      for (let j = 1; j < subRows; j++) {
        if (j % 2 === 0) continue;
        const tf = j / subRows;
        const sy = cY0 + cD * tf;
        const sz = zC0 + (zC1 - zC0) * tf;
        const m1 = Iso.gridToScreen(cX0, sy, sz);
        const m2 = Iso.gridToScreen(cX1, sy, sz);
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
      }
      ctx.stroke();

      // Primary silver cell divisions
      ctx.strokeStyle = busCol;
      ctx.lineWidth = Math.max(0.7, 0.82 * zScale);
      ctx.beginPath();
      for (let i = 1; i < cols; i++) {
        const sx = cX0 + (cW * i) / cols;
        const p1 = Iso.gridToScreen(sx, cY0, zC0);
        const p2 = Iso.gridToScreen(sx, cY1, zC1);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      for (let j = 1; j < rows; j++) {
        const tf = j / rows;
        const sy = cY0 + cD * tf;
        const sz = zC0 + (zC1 - zC0) * tf;
        const m1 = Iso.gridToScreen(cX0, sy, sz);
        const m2 = Iso.gridToScreen(cX1, sy, sz);
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
      }
      ctx.stroke();

      // Diagonal upper-left tempered glass specular glint streak
      const g0 = Iso.gridToScreen(cX0 + cW * 0.08, cY0 + cD * 0.28, zC0 + (zC1 - zC0) * 0.28 + 0.06);
      const g1 = Iso.gridToScreen(cX0 + cW * 0.36, cY0 + cD * 0.06, zC0 + (zC1 - zC0) * 0.06 + 0.06);
      const g2 = Iso.gridToScreen(cX0 + cW * 0.48, cY0 + cD * 0.06, zC0 + (zC1 - zC0) * 0.06 + 0.06);
      const g3 = Iso.gridToScreen(cX0 + cW * 0.16, cY0 + cD * 0.38, zC0 + (zC1 - zC0) * 0.38 + 0.06);
      ctx.fillStyle = 'rgba(220, 240, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.lineTo(g2.x, g2.y);
      ctx.lineTo(g3.x, g3.y);
      ctx.closePath();
      ctx.fill();

      // Sunlit top-left bezel edge specular highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = Math.max(0.7, 0.85 * zScale);
      ctx.beginPath();
      ctx.moveTo(dd.x, dd.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawHipRoof(ctx, gx, gy, z, w, d, h, hex, zScale, opts) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const apex = Iso.gridToScreen(gx + w * 0.5, gy + d * 0.5, z + h);
    const b0 = Iso.gridToScreen(gx, gy, z);
    const b1 = Iso.gridToScreen(gx + w, gy, z);
    const b2 = Iso.gridToScreen(gx + w, gy + d, z);
    const b3 = Iso.gridToScreen(gx, gy + d, z);
    drawPolyFace(ctx, [b0, b1, apex], hex, 0.97, false, true, zScale);
    drawPolyFace(ctx, [b0, b3, apex], hex, 0.97, false, true, zScale);
    drawPolyFace(ctx, [b3, b2, apex], hex, 0.86, false, true, zScale);
    drawPolyFace(ctx, [b2, b1, apex], hex, 0.72, false, true, zScale);

    if (isPlainDetailFallback()) return;

    // Mid-slope horizontal seam & radial ribs on visible front faces
    const cx = gx + w * 0.5;
    const cy = gy + d * 0.5;
    const m3 = Iso.gridToScreen((gx + cx) * 0.5, (gy + d + cy) * 0.5, z + h * 0.5);
    const m2 = Iso.gridToScreen((gx + w + cx) * 0.5, (gy + d + cy) * 0.5, z + h * 0.5);
    const m1 = Iso.gridToScreen((gx + w + cx) * 0.5, (gy + cy) * 0.5, z + h * 0.5);
    ctx.strokeStyle = o.seamColor || 'rgba(12, 16, 22, 0.26)';
    ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
    ctx.beginPath();
    ctx.moveTo(m3.x, m3.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.lineTo(m1.x, m1.y);
    ctx.stroke();

    // Eave overhang shadow lip along front edges
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.44)';
    ctx.lineWidth = Math.max(0.85, 1.1 * zScale);
    ctx.beginPath();
    ctx.moveTo(b3.x, b3.y + 0.65 * zScale);
    ctx.lineTo(b2.x, b2.y + 0.65 * zScale);
    ctx.lineTo(b1.x, b1.y + 0.65 * zScale);
    ctx.stroke();

    // Sunlit hip ridge highlight on top-left corner ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(0.65, 0.8 * zScale);
    ctx.beginPath();
    ctx.moveTo(b3.x, b3.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.stroke();
  }

  function drawOctahedron(ctx, cx, cy, zc, r, hh, hex, isEmissive, zScale) {
    const Iso = ZS.Iso;
    const E = Iso.gridToScreen(cx + r, cy, zc);
    const Np = Iso.gridToScreen(cx, cy - r, zc);
    const Wp = Iso.gridToScreen(cx - r, cy, zc);
    const So = Iso.gridToScreen(cx, cy + r, zc);
    const T = Iso.gridToScreen(cx, cy, zc + hh);
    const Bt = Iso.gridToScreen(cx, cy, zc - hh);
    drawPolyFace(ctx, [Np, Wp, T], hex, 1.0, isEmissive, false, zScale);
    drawPolyFace(ctx, [E, Np, T], hex, 1.0, isEmissive, false, zScale);
    drawPolyFace(ctx, [Wp, So, Bt], hex, 0.72, isEmissive, false, zScale);
    drawPolyFace(ctx, [So, E, Bt], hex, 0.60, isEmissive, false, zScale);
    drawPolyFace(ctx, [Wp, So, T], hex, 0.95, isEmissive, false, zScale);
    drawPolyFace(ctx, [So, E, T], hex, 0.80, isEmissive, false, zScale);
  }

  function drawIsoLine(ctx, a, b, hex, widthPx, withOutline, zScale) {
    const Iso = ZS.Iso;
    ctx.lineCap = 'round';
    if (withOutline && !window.ZS_SILHOUETTE_MODE) {
      ctx.strokeStyle = 'rgba(10, 14, 20, 0.55)';
      ctx.lineWidth = (widthPx + 1.5) * zScale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = Iso.resolveFaceColor(hex, 1.0, false, 0) || hex;
    ctx.lineWidth = widthPx * zScale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawIsoDot(ctx, p, rPx, hex, isEmissive, zScale) {
    const Iso = ZS.Iso;
    const fill = Iso.resolveFaceColor(hex, 1.0, !!isEmissive, 0) || hex;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rPx * zScale, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (isEmissive && R.emissiveList && !window.ZS_SILHOUETTE_MODE) {
      R.emissiveList.push({
        kind: 'dot',
        p: { x: p.x, y: p.y },
        r: rPx,
        hex,
        fill,
        alpha: R.currentEntityAlpha != null ? R.currentEntityAlpha : 1.0
      });
    }
  }

  function drawPowerStripCyl(ctx, cx, cy, z, r, isUnpowered, zScale) {
    const P = ZS.DATA.PALETTE;
    const col = isUnpowered ? P.powerDim : P.power;
    drawCyl(ctx, cx, cy, z, r, 1.4, col, { noTop: true, emissive: !isUnpowered, n: 16 }, zScale);
  }

  function drawIsoRibbon(ctx, p0, p1, halfW, hex, isEmissive, zScale) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * halfW * zScale;
    const ny = (dx / len) * halfW * zScale;
    drawPolyFace(
      ctx,
      [
        { x: p0.x - nx, y: p0.y - ny },
        { x: p1.x - nx, y: p1.y - ny },
        { x: p1.x + nx, y: p1.y + ny },
        { x: p0.x + nx, y: p0.y + ny }
      ],
      hex,
      1.0,
      !!isEmissive,
      false,
      zScale
    );
  }

  function drawRingGlow(ctx, cx, cy, z, r, strokeW, hex, isEmissive, n, zScale) {
    const Iso = ZS.Iso;
    const steps = n || 20;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      drawIsoRibbon(
        ctx,
        Iso.gridToScreen(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z),
        Iso.gridToScreen(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z),
        strokeW,
        hex,
        isEmissive,
        zScale
      );
    }
  }

  const _psW = { x: 0, y: 0 };
  const _psN = { x: 0, y: 0 };
  const _psE = { x: 0, y: 0 };
  const _psS = { x: 0, y: 0 };
  const _psApex = { x: 0, y: 0 };
  const _psTri0 = [_psN, _psW, _psApex];
  const _psTri1 = [_psW, _psS, _psApex];
  const _psTri2 = [_psS, _psE, _psApex];
  const _psTri3 = [_psE, _psN, _psApex];

  function drawPyramidSpike(ctx, cx, cy, z, rx, ry, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const em = !!(opts && opts.emissive);
    const withEdge = !(opts && opts.edge === false);
    const rX = rx || 0.07;
    const rY = ry != null ? ry : rX;
    Iso.projectTo(cx - rX, cy, z, _psW);
    Iso.projectTo(cx, cy - rY, z, _psN);
    Iso.projectTo(cx + rX, cy, z, _psE);
    Iso.projectTo(cx, cy + rY, z, _psS);
    Iso.projectTo(cx, cy, z + h, _psApex);

    if (h <= 17 * Math.max(rX, rY)) {
      drawPolyFace(ctx, _psTri0, hex, 1.0, em, false, zScale);
    }
    // Top-left directional light: left face 100%, front-left mid face 82%, right face 66%
    drawPolyFace(ctx, _psTri1, hex, 1.0, em, false, zScale);
    drawPolyFace(ctx, _psTri2, hex, 0.82, em, false, zScale);
    drawPolyFace(ctx, _psTri3, hex, 0.66, em, false, zScale);

    if (withEdge && !em && !window.ZS_SILHOUETTE_MODE) {
      ctx.strokeStyle = (opts && opts.outlineColor) || 'rgba(10, 14, 20, 0.34)';
      ctx.lineWidth = Math.max(0.6, 0.75 * zScale);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(_psW.x, _psW.y);
      ctx.lineTo(_psS.x, _psS.y);
      ctx.lineTo(_psE.x, _psE.y);
      ctx.lineTo(_psN.x, _psN.y);
      ctx.lineTo(_psApex.x, _psApex.y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawSawTooth(ctx, cx, cy, z, w, h, hexLight, hexDark, zScale) {
    const Iso = ZS.Iso;
    const pL = Iso.gridToScreen(cx - w, cy, z);
    const pR = Iso.gridToScreen(cx + w, cy, z);
    const pF = Iso.gridToScreen(cx, cy + w * 0.7, z);
    const pTop = Iso.gridToScreen(cx, cy - w * 0.15, z + h);
    drawPolyFace(ctx, [pL, pF, pTop], hexDark, 0.84, false, true, zScale);
    drawPolyFace(ctx, [pF, pR, pTop], hexLight, 0.72, false, true, zScale);
    drawPolyFace(ctx, [pL, pR, pTop], hexLight, 1.0, false, true, zScale);
  }

  function drawZigzagArc(ctx, pA, pB, midOffsetPx, hex, isEmissive, zScale) {
    const mx = (pA.x + pB.x) * 0.5;
    const my = (pA.y + pB.y) * 0.5;
    const p1 = { x: pA.x * 0.65 + pB.x * 0.35 + midOffsetPx * zScale, y: pA.y * 0.65 + pB.y * 0.35 - 2.2 * zScale };
    const p2 = { x: pA.x * 0.35 + pB.x * 0.65 - midOffsetPx * zScale, y: pA.y * 0.35 + pB.y * 0.65 + 1.8 * zScale };
    const pM = { x: mx + midOffsetPx * 0.35 * zScale, y: my - 1.2 * zScale };
    const pts = [pA, p1, pM, p2, pB];
    for (let i = 0; i < pts.length - 1; i++) {
      drawIsoRibbon(ctx, pts[i], pts[i + 1], 0.85, hex, isEmissive, zScale);
    }
  }

  function drawSandbagRing(ctx, cx, cy, zBase, r, h, pass, zScale, opts) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const sandHex = o.sandHex || '#B7A179';
    const isPlain = isPlainDetailFallback();
    if (pass === 'back') {
      drawCyl(ctx, cx, cy, zBase, r, h, sandHex, { n: 16 }, zScale);
      if (!isPlain) {
        // Top sandbag pillow joint ticks around the ring crown + sunlit back-left highlight arc
        ctx.strokeStyle = Iso.resolveFaceColor('#6D5C3E', 0.72, false, 0) || '#4E422C';
        ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.2;
          const p0 = Iso.gridToScreen(cx + Math.cos(a) * r * 0.73, cy + Math.sin(a) * r * 0.73, zBase + h + 0.05);
          const p1 = Iso.gridToScreen(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96, zBase + h + 0.05);
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 245, 220, 0.34)';
        ctx.lineWidth = Math.max(0.65, 0.8 * zScale);
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const a = 0.72 * Math.PI + (k / 10) * 1.10 * Math.PI;
          const p = Iso.gridToScreen(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96, zBase + h + 0.08);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      drawCyl(ctx, cx, cy, zBase + h, r * 0.72, 0.02, '#4E4535', { n: 16, noSides: true, topEdge: false }, zScale);
    } else {
      drawCyl(ctx, cx, cy, zBase, r, h, sandHex, { n: 16, noTop: true }, zScale);
      if (isPlain) return;

      const seamDark = Iso.resolveFaceColor('#6D5C3E', 0.72, false, 0) || '#4E422C';
      const seamHi = 'rgba(255, 245, 220, 0.24)';
      const courseZFracs = [0.27, 0.53, 0.78];

      // 3 horizontal sandbag course seams + pillow highlight lines below each seam
      for (let ci = 0; ci < courseZFracs.length; ci++) {
        const zz = zBase + h * courseZFracs[ci];
        ctx.strokeStyle = seamDark;
        ctx.lineWidth = Math.max(0.75, 0.92 * zScale);
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const a = -0.25 * Math.PI + (k / 12) * Math.PI;
          const p = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, zz);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        ctx.strokeStyle = seamHi;
        ctx.lineWidth = Math.max(0.5, 0.65 * zScale);
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const a = -0.25 * Math.PI + (k / 12) * Math.PI;
          const p = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, zz);
          if (k === 0) ctx.moveTo(p.x, p.y + 0.75 * zScale);
          else ctx.lineTo(p.x, p.y + 0.75 * zScale);
        }
        ctx.stroke();
      }

      // Staggered zigzag vertical sandbag joints across the courses
      const bands = [0, 0.27, 0.53, 0.78, 1.0];
      ctx.strokeStyle = seamDark;
      ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
      ctx.beginPath();
      for (let b = 0; b < bands.length - 1; b++) {
        const z0 = zBase + h * bands[b] + 0.18;
        const z1 = zBase + h * bands[b + 1] - 0.18;
        if (z1 <= z0) continue;
        const stagger = (b % 2) * 0.5;
        const nJoints = 5;
        for (let j = 0; j < nJoints; j++) {
          const frac = (j + 0.35 + stagger * 0.45) / nJoints;
          if (frac <= 0.06 || frac >= 0.94) continue;
          const a = -0.25 * Math.PI + frac * Math.PI;
          const p0 = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0);
          const p1 = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z1);
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
        }
      }
      ctx.stroke();

      // Sunlit front-left sandbag top rim highlight arc
      ctx.strokeStyle = 'rgba(255, 245, 220, 0.28)';
      ctx.lineWidth = Math.max(0.65, 0.78 * zScale);
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = 0.22 * Math.PI + (k / 8) * 0.53 * Math.PI;
        const p = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, zBase + h);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // ===================== #95 DIORAMA DETAIL KIT (Reusable Bevel, Micro-Surface & Ground Glow Helpers) =====================
  const _dbA = { x: 0, y: 0 };
  const _dbB = { x: 0, y: 0 };
  const _dbC = { x: 0, y: 0 };
  const _dbD = { x: 0, y: 0 };
  const _dbBb = { x: 0, y: 0 };
  const _dbCb = { x: 0, y: 0 };
  const _dbDb = { x: 0, y: 0 };
  const _dbLeftQuad = [_dbD, _dbC, _dbCb, _dbDb];
  const _dbRightQuad = [_dbC, _dbB, _dbBb, _dbCb];
  const _dbTopQuad = [_dbA, _dbB, _dbC, _dbD];

  function isPlainDetailFallback() {
    return !!window.ZS_SILHOUETTE_MODE || ZS.Iso.getRenderModifiers().flash > 0.01;
  }

  function fillShadedGradFace(ctx, pts, hex, topFactor, botFactor, withEdge, zScale) {
    const Iso = ZS.Iso;
    const cTop = Iso.resolveFaceColor(hex, topFactor, false, 0);
    const cBot = Iso.resolveFaceColor(hex, botFactor, false, 0);
    if (!cTop || !cBot) return;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    if (maxY - minY > 1.5) {
      const grad = ctx.createLinearGradient(0, minY, 0, maxY);
      grad.addColorStop(0, cTop);
      grad.addColorStop(1, cBot);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = cTop;
    }
    ctx.fill();
    if (withEdge !== false) {
      ctx.strokeStyle = 'rgba(10, 14, 20, 0.30)';
      ctx.lineWidth = Math.max(0.65, 0.78 * zScale);
      ctx.stroke();
    }
  }

  function drawDetailedIsoBox(ctx, gx, gy, z, w, d, h, hex, opts, zScale) {
    const o = opts || {};
    if (o.emissive || isPlainDetailFallback()) {
      drawIsoBox(ctx, gx, gy, z, w, d, h, hex, o, zScale);
      return;
    }
    const Iso = ZS.Iso;
    const withEdge = o.edge !== false;
    const noTop = !!o.noTop;
    const bevel = o.bevel !== false;
    const groundCrease = !!o.groundCrease;
    const gradDrop = o.gradDrop != null ? o.gradDrop : 0.085;
    const zTop = z + h;

    Iso.projectTo(gx, gy, zTop, _dbA);
    Iso.projectTo(gx + w, gy, zTop, _dbB);
    Iso.projectTo(gx + w, gy + d, zTop, _dbC);
    Iso.projectTo(gx, gy + d, zTop, _dbD);

    if (h > 0) {
      Iso.projectTo(gx + w, gy, z, _dbBb);
      Iso.projectTo(gx + w, gy + d, z, _dbCb);
      Iso.projectTo(gx, gy + d, z, _dbDb);
      // Preserve Top 100% / Left 82% / Right 66% hierarchy with subtle top-to-bottom falloff
      fillShadedGradFace(ctx, _dbLeftQuad, hex, Math.min(0.86, 0.82 + gradDrop * 0.35), Math.max(0.70, 0.82 - gradDrop), withEdge, zScale);
      fillShadedGradFace(ctx, _dbRightQuad, hex, Math.min(0.70, 0.66 + gradDrop * 0.30), Math.max(0.54, 0.66 - gradDrop), withEdge, zScale);

      if (groundCrease) {
        ctx.strokeStyle = 'rgba(6, 10, 16, 0.42)';
        ctx.lineWidth = Math.max(0.8, 1.05 * zScale);
        ctx.beginPath();
        ctx.moveTo(_dbDb.x, _dbDb.y);
        ctx.lineTo(_dbCb.x, _dbCb.y);
        ctx.lineTo(_dbBb.x, _dbBb.y);
        ctx.stroke();
      }
    }

    if (!noTop) {
      const topHex = o.topHex || hex;
      fillShadedGradFace(ctx, _dbTopQuad, topHex, 1.03, 0.96, withEdge, zScale);
      if (bevel) {
        // 1px sunlit top-left specular bevel edge + front V-ridge crisp highlight
        ctx.strokeStyle = o.bevelColor || 'rgba(255, 255, 255, 0.32)';
        ctx.lineWidth = Math.max(0.7, 0.88 * zScale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(_dbD.x, _dbD.y);
        ctx.lineTo(_dbA.x, _dbA.y);
        ctx.lineTo(_dbB.x, _dbB.y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = Math.max(0.6, 0.72 * zScale);
        ctx.beginPath();
        ctx.moveTo(_dbD.x, _dbD.y);
        ctx.lineTo(_dbC.x, _dbC.y);
        ctx.stroke();
      }
    }
  }

  function drawDetailedFrustum(ctx, gx, gy, z, w, d, h, inset, hex, opts, zScale) {
    const o = opts || {};
    if (o.emissive || isPlainDetailFallback()) {
      drawFrustum(ctx, gx, gy, z, w, d, h, inset, hex, o, zScale);
      return;
    }
    const Iso = ZS.Iso;
    const noTop = !!o.noTop;
    const zTop = z + h;
    const ix = o.ix != null ? o.ix : inset;
    const iy = o.iy != null ? o.iy : inset;
    Iso.projectTo(gx, gy, z, _frB0);
    Iso.projectTo(gx + w, gy, z, _frB1);
    Iso.projectTo(gx + w, gy + d, z, _frB2);
    Iso.projectTo(gx, gy + d, z, _frB3);
    Iso.projectTo(gx + ix, gy + iy, zTop, _frT0);
    Iso.projectTo(gx + w - ix, gy + iy, zTop, _frT1);
    Iso.projectTo(gx + w - ix, gy + d - iy, zTop, _frT2);
    Iso.projectTo(gx + ix, gy + d - iy, zTop, _frT3);

    drawPolyFace(ctx, _frFace0, hex, 0.94, false, true, zScale);
    drawPolyFace(ctx, _frFace1, hex, 0.94, false, true, zScale);
    fillShadedGradFace(ctx, _frFace2, hex, 0.86, 0.75, true, zScale);
    fillShadedGradFace(ctx, _frFace3, hex, 0.70, 0.59, true, zScale);

    if (o.groundCrease) {
      ctx.strokeStyle = 'rgba(6, 10, 16, 0.42)';
      ctx.lineWidth = Math.max(0.8, 1.05 * zScale);
      ctx.beginPath();
      ctx.moveTo(_frB3.x, _frB3.y);
      ctx.lineTo(_frB2.x, _frB2.y);
      ctx.lineTo(_frB1.x, _frB1.y);
      ctx.stroke();
    }

    if (!noTop) {
      fillShadedGradFace(ctx, _frFaceTop, o.topHex || hex, 1.03, 0.96, true, zScale);
      if (o.bevel !== false) {
        ctx.strokeStyle = o.bevelColor || 'rgba(255, 255, 255, 0.30)';
        ctx.lineWidth = Math.max(0.7, 0.85 * zScale);
        ctx.beginPath();
        ctx.moveTo(_frT3.x, _frT3.y);
        ctx.lineTo(_frT0.x, _frT0.y);
        ctx.lineTo(_frT1.x, _frT1.y);
        ctx.stroke();
      }
    }
  }

  function drawTaperedCyl(ctx, cx, cy, z, rBot, rTop, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const n = o.n || 14;
    const em = !!o.emissive;
    const noTop = !!o.noTop;
    const topEdge = o.topEdge !== false;
    const lut = getCylLut(n);
    const cos = lut.cos;
    const sin = lut.sin;
    const zTop = z + h;
    const isPlain = em || isPlainDetailFallback();

    if (h > 0) {
      const sideCount = lut.sideCount;
      const sideK0 = lut.sideK0;
      const sideK1 = lut.sideK1;
      const sideShade = lut.sideShade;
      for (let i = 0; i < sideCount; i++) {
        const k0 = sideK0[i];
        const k1 = sideK1[i];
        Iso.projectTo(cx + cos[k0] * rTop, cy + sin[k0] * rTop, zTop, _cylSideTop0);
        Iso.projectTo(cx + cos[k1] * rTop, cy + sin[k1] * rTop, zTop, _cylSideTop1);
        Iso.projectTo(cx + cos[k1] * rBot, cy + sin[k1] * rBot, z, _cylSideBot1);
        Iso.projectTo(cx + cos[k0] * rBot, cy + sin[k0] * rBot, z, _cylSideBot0);
        const sh = sideShade[i];
        if (!isPlain && o.specHighlight && sh > 0.79) {
          drawPolyFace(ctx, _cylQuad, hex, Math.min(1.04, sh + 0.08), false, false, zScale);
        } else {
          drawPolyFace(ctx, _cylQuad, hex, sh, em, false, zScale);
        }
      }
    }
    if (!noTop) {
      const topPts = lut.topPts;
      for (let k = 0; k < n; k++) {
        Iso.projectTo(cx + cos[k] * rTop, cy + sin[k] * rTop, zTop, topPts[k]);
      }
      drawPolyFace(ctx, topPts, hex, 1.0, em, topEdge, zScale);
    }
  }

  function drawIsoFaceSeams(ctx, face, gx, gy, z, w, d, h, divisions, seamColor, zScale) {
    if (isPlainDetailFallback() || divisions <= 1) return;
    const Iso = ZS.Iso;
    ctx.strokeStyle = seamColor || 'rgba(12, 18, 26, 0.34)';
    ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
    ctx.beginPath();
    if (face === 'left') {
      const yFace = gy + d;
      for (let i = 1; i < divisions; i++) {
        const sx = gx + (w * i) / divisions;
        const p0 = Iso.gridToScreen(sx, yFace, z + 0.3);
        const p1 = Iso.gridToScreen(sx, yFace, z + h - 0.3);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    } else if (face === 'right') {
      const xFace = gx + w;
      for (let i = 1; i < divisions; i++) {
        const sy = gy + (d * i) / divisions;
        const p0 = Iso.gridToScreen(xFace, sy, z + 0.3);
        const p1 = Iso.gridToScreen(xFace, sy, z + h - 0.3);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    } else if (face === 'topX') {
      const zTop = z + h;
      for (let i = 1; i < divisions; i++) {
        const sx = gx + (w * i) / divisions;
        const p0 = Iso.gridToScreen(sx, gy + 0.02, zTop);
        const p1 = Iso.gridToScreen(sx, gy + d - 0.02, zTop);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    } else if (face === 'topY') {
      const zTop = z + h;
      for (let i = 1; i < divisions; i++) {
        const sy = gy + (d * i) / divisions;
        const p0 = Iso.gridToScreen(gx + 0.02, sy, zTop);
        const p1 = Iso.gridToScreen(gx + w - 0.02, sy, zTop);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();
  }

  function drawIsoLouvers(ctx, face, gx, gy, z0, span, count, stepZ, zScale) {
    if (isPlainDetailFallback() || count <= 0) return;
    const Iso = ZS.Iso;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const zz = z0 + i * stepZ;
      const p0 = face === 'left' ? Iso.gridToScreen(gx, gy, zz) : Iso.gridToScreen(gx, gy, zz);
      const p1 = face === 'left' ? Iso.gridToScreen(gx + span, gy, zz) : Iso.gridToScreen(gx, gy + span, zz);
      ctx.strokeStyle = 'rgba(10, 15, 22, 0.56)';
      ctx.lineWidth = Math.max(0.75, 0.95 * zScale);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = Math.max(0.45, 0.55 * zScale);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y + 0.7 * zScale);
      ctx.lineTo(p1.x, p1.y + 0.7 * zScale);
      ctx.stroke();
    }
  }

  function drawIsoCornerRivets(ctx, gx, gy, zTop, w, d, inset, rPx, rivetHex, zScale) {
    if (isPlainDetailFallback()) return;
    const Iso = ZS.Iso;
    const insX = Math.min(w * 0.28, inset || 0.04);
    const insY = Math.min(d * 0.28, inset || 0.04);
    const col = Iso.resolveFaceColor(rivetHex || '#DCE5EE', 1.0, false, 0) || '#DCE5EE';
    const pts = [
      Iso.gridToScreen(gx + insX, gy + insY, zTop + 0.1),
      Iso.gridToScreen(gx + w - insX, gy + insY, zTop + 0.1),
      Iso.gridToScreen(gx + w - insX, gy + d - insY, zTop + 0.1),
      Iso.gridToScreen(gx + insX, gy + d - insY, zTop + 0.1)
    ];
    ctx.fillStyle = 'rgba(10, 14, 20, 0.45)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y + 0.4 * zScale, (rPx + 0.25) * zScale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, rPx * zScale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIsoHazardBand(ctx, gx, gy, z, w, d, h, yellowHex, darkHex, stripes, zScale) {
    const yCol = yellowHex || '#E6B432';
    const dCol = darkHex || '#232B35';
    drawIsoBox(ctx, gx, gy, z, w, d, h, yCol, { noTop: true, edge: false }, zScale);
    if (isPlainDetailFallback()) return;
    const Iso = ZS.Iso;
    const nL = Math.max(2, stripes || Math.round(w * 7));
    const nR = Math.max(2, stripes || Math.round(d * 7));
    const leftFill = Iso.resolveFaceColor(dCol, 0.82, false, 0) || dCol;
    const rightFill = Iso.resolveFaceColor(dCol, 0.66, false, 0) || dCol;

    ctx.fillStyle = leftFill;
    for (let i = 0; i < nL; i++) {
      const u0 = (i + 0.15) / nL;
      const u1 = Math.min(1, u0 + 0.42 / nL);
      const u0b = Math.max(0, u0 - 0.22 / nL);
      const u1b = Math.max(0, u1 - 0.22 / nL);
      const p0 = Iso.gridToScreen(gx + w * u0, gy + d, z + h);
      const p1 = Iso.gridToScreen(gx + w * u1, gy + d, z + h);
      const p2 = Iso.gridToScreen(gx + w * u1b, gy + d, z);
      const p3 = Iso.gridToScreen(gx + w * u0b, gy + d, z);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = rightFill;
    for (let i = 0; i < nR; i++) {
      const u0 = (i + 0.15) / nR;
      const u1 = Math.min(1, u0 + 0.42 / nR);
      const u0b = Math.max(0, u0 - 0.22 / nR);
      const u1b = Math.max(0, u1 - 0.22 / nR);
      const p0 = Iso.gridToScreen(gx + w, gy + d * u0, z + h);
      const p1 = Iso.gridToScreen(gx + w, gy + d * u1, z + h);
      const p2 = Iso.gridToScreen(gx + w, gy + d * u1b, z);
      const p3 = Iso.gridToScreen(gx + w, gy + d * u0b, z);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSandbagCoursesOnBox(ctx, gx, gy, z, w, d, h, courses, colsX, colsY, seamHex, wireRibs, zScale) {
    if (isPlainDetailFallback()) return;
    const Iso = ZS.Iso;
    const cCount = Math.max(2, courses || 4);
    const seamDark = Iso.resolveFaceColor(seamHex || '#6D5C3E', 0.72, false, 0) || '#4E422C';
    const seamHi = 'rgba(255, 245, 220, 0.22)';
    const yL = gy + d;
    const xR = gx + w;

    // Horizontal course seams + subtle pillow highlight below each seam
    for (let c = 1; c < cCount; c++) {
      const zz = z + (h * c) / cCount;
      const l0 = Iso.gridToScreen(gx + 0.008, yL, zz);
      const l1 = Iso.gridToScreen(gx + w - 0.008, yL, zz);
      const r0 = Iso.gridToScreen(xR, gy + 0.008, zz);
      const r1 = Iso.gridToScreen(xR, gy + d - 0.008, zz);

      ctx.strokeStyle = seamDark;
      ctx.lineWidth = Math.max(0.85, 1.05 * zScale);
      ctx.beginPath();
      ctx.moveTo(l0.x, l0.y);
      ctx.lineTo(l1.x, l1.y);
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r0.x, r0.y);
      ctx.stroke();

      ctx.strokeStyle = seamHi;
      ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
      ctx.beginPath();
      ctx.moveTo(l0.x, l0.y + 0.85 * zScale);
      ctx.lineTo(l1.x, l1.y + 0.85 * zScale);
      ctx.moveTo(r1.x, r1.y + 0.85 * zScale);
      ctx.lineTo(r0.x, r0.y + 0.85 * zScale);
      ctx.stroke();
    }

    // Staggered vertical sandbag joints per course
    const nX = Math.max(1, colsX || Math.max(1, Math.round(w * 5)));
    const nY = Math.max(1, colsY || Math.max(1, Math.round(d * 5)));
    ctx.strokeStyle = seamDark;
    ctx.lineWidth = Math.max(0.6, 0.72 * zScale);
    ctx.beginPath();
    for (let c = 0; c < cCount; c++) {
      const z0 = z + (h * c) / cCount + 0.25;
      const z1 = z + (h * (c + 1)) / cCount - 0.25;
      const off = (c % 2) * 0.5;
      for (let i = 1; i <= nX; i++) {
        const u = (i - 0.5 + off) / nX;
        if (u <= 0.08 || u >= 0.92) continue;
        const p0 = Iso.gridToScreen(gx + w * u, yL, z0);
        const p1 = Iso.gridToScreen(gx + w * u, yL, z1);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      for (let j = 1; j <= nY; j++) {
        const u = (j - 0.5 + off) / nY;
        if (u <= 0.08 || u >= 0.92) continue;
        const p0 = Iso.gridToScreen(xR, gy + d * u, z0);
        const p1 = Iso.gridToScreen(xR, gy + d * u, z1);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();

    // Optional galvanized HESCO wire-mesh cage vertical ribs
    if (wireRibs) {
      const ribL = Iso.resolveFaceColor('#8C9AA8', 0.88, false, 0) || '#7C8894';
      const ribR = Iso.resolveFaceColor('#8C9AA8', 0.70, false, 0) || '#646F7A';
      const rCountX = Math.max(2, Math.round(w * 7));
      const rCountY = Math.max(2, Math.round(d * 7));
      ctx.lineWidth = Math.max(0.55, 0.68 * zScale);
      ctx.strokeStyle = ribL;
      ctx.beginPath();
      for (let i = 1; i < rCountX; i++) {
        const sx = gx + (w * i) / rCountX;
        const p0 = Iso.gridToScreen(sx, yL, z + 0.2);
        const p1 = Iso.gridToScreen(sx, yL, z + h - 0.2);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();

      ctx.strokeStyle = ribR;
      ctx.beginPath();
      for (let j = 1; j < rCountY; j++) {
        const sy = gy + (d * j) / rCountY;
        const p0 = Iso.gridToScreen(xR, sy, z + 0.2);
        const p1 = Iso.gridToScreen(xR, sy, z + h - 0.2);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
    }
  }

  function drawGroundGlowPad(ctx, tx, ty, footprint, colorHex, intensity, zScale) {
    if (window.ZS_SILHOUETTE_MODE) return;
    const Iso = ZS.Iso;
    const fp = Math.max(0.45, Math.min(0.98, footprint || 0.86));
    const pad = (1 - fp) * 0.5;
    const inten = intensity != null ? intensity : 1.0;
    const hex = colorHex || '#FFC94A';
    const zPad = 0.45;

    // 1. Warm radial ground bloom halo around pad (clearly visible in both day & night!)
    const center = Iso.gridToScreen(tx + 0.5, ty + 0.5, zPad);
    const glowStamp = getEmissiveGlowStamp(hex);
    const rx = 38 * fp * zScale;
    const ry = 19.5 * fp * zScale;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, 0.92 * inten);
    ctx.drawImage(glowStamp, center.x - rx, center.y - ry, rx * 2, ry * 2);
    ctx.restore();

    // Soft outer semantic isometric aura skirt on ground
    const oPad = Math.max(0.01, pad - 0.045);
    const oSpan = 1 - oPad * 2;
    const oN = Iso.gridToScreen(tx + oPad, ty + oPad, 0.12);
    const oE = Iso.gridToScreen(tx + oPad + oSpan, ty + oPad, 0.12);
    const oS = Iso.gridToScreen(tx + oPad + oSpan, ty + oPad + oSpan, 0.12);
    const oW = Iso.gridToScreen(tx + oPad, ty + oPad + oSpan, 0.12);
    const rgb = parseColorRgb(hex);
    const auraAlpha = (hex === '#FFC94A' ? 0.16 : 0.18) * Math.min(1.2, inten);
    ctx.save();
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${auraAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(oN.x, oN.y);
    ctx.lineTo(oE.x, oE.y);
    ctx.lineTo(oS.x, oS.y);
    ctx.lineTo(oW.x, oW.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Dark tactical recessed pad slab + warm semantic glowing rim & corner chevrons
    const x0 = tx + pad;
    const y0 = ty + pad;
    drawDetailedIsoBox(ctx, x0, y0, 0.15, fp, fp, 1.05, '#2D3540', { bevel: true, groundCrease: true }, zScale);

    const rimIn = 0.036;
    const rx0 = x0 + rimIn;
    const ry0 = y0 + rimIn;
    const rSpan = fp - rimIn * 2;
    const zRim = 1.28;
    const pN = Iso.gridToScreen(rx0, ry0, zRim);
    const pE = Iso.gridToScreen(rx0 + rSpan, ry0, zRim);
    const pS = Iso.gridToScreen(rx0 + rSpan, ry0 + rSpan, zRim);
    const pW = Iso.gridToScreen(rx0, ry0 + rSpan, zRim);

    // Emissive perimeter light channel (registers with emissiveList for night bloom!)
    drawIsoRibbon(ctx, pN, pE, 0.92, hex, true, zScale);
    drawIsoRibbon(ctx, pE, pS, 1.02, hex, true, zScale);
    drawIsoRibbon(ctx, pS, pW, 1.02, hex, true, zScale);
    drawIsoRibbon(ctx, pW, pN, 0.92, hex, true, zScale);

    // 4 Corner beacon nodes on pad (tinted toward pad semantic color, 0px cyan)
    const cOff = 0.012;
    const nodeHex = Iso.mixHex(hex, '#FFFFFF', 0.72);
    const cPts = [
      Iso.gridToScreen(rx0 + cOff, ry0 + cOff, zRim + 0.25),
      Iso.gridToScreen(rx0 + rSpan - cOff, ry0 + cOff, zRim + 0.25),
      Iso.gridToScreen(rx0 + rSpan - cOff, ry0 + rSpan - cOff, zRim + 0.25),
      Iso.gridToScreen(rx0 + cOff, ry0 + rSpan - cOff, zRim + 0.25)
    ];
    for (let i = 0; i < 4; i++) {
      drawIsoDot(ctx, cPts[i], 1.45, nodeHex, true, zScale);
    }
  }

  function drawEmissivePass(ctx, list, nightAlpha, zScale, viewW, viewH) {
    if (!list || list.length === 0) return;
    const Iso = ZS.Iso;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const mergeR = 14 * zScale;
    const mergeR2 = mergeR * mergeR;
    const cullPad = 28 * zScale;
    const clusters = [];

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if ((e.alpha != null ? e.alpha : 1) < 0.55) continue;
      if (e.kind === 'stamp') {
        if (e.x + e.w < -cullPad || e.x > vp.w + cullPad || e.y + e.h < -cullPad || e.y > vp.h + cullPad) {
          continue;
        }
        const gcs = e.glowClusters;
        if (gcs) {
          for (let g = 0; g < gcs.length; g++) {
            const gc = gcs[g];
            const cx = e.originX + gc.dx * zScale;
            const cy = e.originY + gc.dy * zScale;
            if (!isScreenVisible(cx, cy, cullPad, cullPad, cullPad, vp.w, vp.h)) continue;
            mergeGlowCluster(clusters, cx, cy, gc.hex, gc.count || 1, mergeR2);
          }
        }
        continue;
      }

      let cx = 0;
      let cy = 0;
      if (e.kind === 'dot') {
        cx = e.p.x;
        cy = e.p.y;
      } else {
        for (let k = 0; k < e.pts.length; k++) {
          cx += e.pts[k].x;
          cy += e.pts[k].y;
        }
        cx /= e.pts.length;
        cy /= e.pts.length;
      }
      if (!isScreenVisible(cx, cy, cullPad, cullPad, cullPad, vp.w, vp.h)) continue;
      const hex = e.hex && e.hex[0] === '#' ? e.hex.toUpperCase() : '#FFD27A';
      mergeGlowCluster(clusters, cx, cy, hex, 1, mergeR2);
    }

    if (clusters.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < clusters.length; i++) {
        const cl = clusters[i];
        const stamp = getEmissiveGlowStamp(cl.hex);
        const boost = Math.min(1.75, 1 + (cl.count - 1) * 0.18);
        const rad = (18 + Math.min(6, (cl.count - 1) * 1.4)) * zScale;
        ctx.globalAlpha = Math.min(1, nightAlpha * boost);
        ctx.drawImage(stamp, cl.cx - rad, cl.cy - rad, rad * 2, rad * 2);
      }
      ctx.restore();
    }

    ctx.save();
    const baseEmissiveAlpha = Math.min(1, 0.35 + nightAlpha * 0.65);
    ctx.globalAlpha = baseEmissiveAlpha;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const ea = e.alpha != null ? e.alpha : 1;
      if (ea <= 0.01) continue;
      ctx.globalAlpha = baseEmissiveAlpha * ea;
      if (e.kind === 'stamp') {
        if (e.x + e.w < -cullPad || e.x > vp.w + cullPad || e.y + e.h < -cullPad || e.y > vp.h + cullPad) {
          continue;
        }
        ctx.drawImage(e.canvas, e.x, e.y, e.w, e.h);
      } else if (e.kind === 'dot') {
        if (!isScreenVisible(e.p.x, e.p.y, cullPad, cullPad, cullPad, vp.w, vp.h)) continue;
        ctx.beginPath();
        ctx.arc(e.p.x, e.p.y, e.r * zScale, 0, Math.PI * 2);
        ctx.fillStyle = e.fill || Iso.shadeHex(e.hex, 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let k = 0; k < e.pts.length; k++) {
          if (k === 0) ctx.moveTo(e.pts[k].x, e.pts[k].y);
          else ctx.lineTo(e.pts[k].x, e.pts[k].y);
        }
        ctx.closePath();
        ctx.fillStyle = e.fill;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  Object.assign(R, {
    tileHash01,
    getTileElevAt,
    doesStructOccludeTarget,
    doesRockOccludeTarget,
    ensureTerrainMeta,
    ensureTerrainCache,
    drawEditGridOverlay,
    drawPlateauTile,
    drawRampTile,
    drawRockTile,
    ensureLightCanvas,
    getGlowStamp,
    getPunchHoleStamp,
    getCloudShadowStamp,
    getEmissiveGlowStamp,
    getTintBucket,
    applyStampTint,
    bakeEmissiveStamp,
    bakeSpriteStamp,
    blitSpriteStamp,
    isScreenVisible,
    isGridVisible,
    getEyeHaloStamp,
    computeBlackoutElectricPowered,
    render,
    drawIslandSlab,
    drawTerrainDecal,
    drawQuarantineBorder,
    drawPerimeterProp,
    drawPerimeterFog,
    drawFloorTile,
    drawIsoCircle,
    drawPeakShadowSectors,
    drawCombatRangeOverlay,
    drawDualRangeRings,
    drawWallPillarHighlight,
    drawHoverOverlay,
    drawBuildGhost,
    getStructVisualTopZ,
    drawPolyFace,
    drawIsoBox,
    drawFrustumXY,
    drawFrustum,
    calcSideShade,
    drawCyl,
    drawDome,
    drawBlob,
    drawCone,
    drawGable,
    drawSlantedSolarPanel,
    drawHipRoof,
    drawOctahedron,
    drawIsoLine,
    drawIsoDot,
    drawPowerStripCyl,
    drawIsoRibbon,
    drawRingGlow,
    drawPyramidSpike,
    drawSawTooth,
    drawZigzagArc,
    drawSandbagRing,
    drawDetailedIsoBox,
    drawDetailedFrustum,
    drawTaperedCyl,
    drawIsoFaceSeams,
    drawIsoLouvers,
    drawIsoCornerRivets,
    drawIsoHazardBand,
    drawSandbagCoursesOnBox,
    drawGroundGlowPad,
    drawEmissivePass
  });
})();
