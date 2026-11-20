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
  const bgCache = {
    canvas: document.createElement('canvas'),
    ctx: null,
    w: 0,
    h: 0,
    isSil: null,
    isNight: null
  };
  const terrainCache = {
    canvas: document.createElement('canvas'),
    ctx: null,
    N: 0,
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
    terrainCache,
    emissiveList: null,
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
    let r = 255;
    let g = 210;
    let b = 122;
    if (key[0] === '#') {
      if (key.length >= 7) {
        r = parseInt(key.slice(1, 3), 16) || 0;
        g = parseInt(key.slice(3, 5), 16) || 0;
        b = parseInt(key.slice(5, 7), 16) || 0;
      } else if (key.length === 4) {
        r = parseInt(key[1] + key[1], 16) || 0;
        g = parseInt(key[2] + key[2], 16) || 0;
        b = parseInt(key[3] + key[3], 16) || 0;
      }
    }
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
    const prevMods = Iso.getRenderModifiers();
    const prevEmis = R.emissiveList;
    const stampEmis = isSil ? null : [];
    let bakedEmis = null;

    try {
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
        glowClusters: stamp.glowClusters
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

    let dirty =
      terrainCache.N !== N ||
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
        const mRow = meta.grid[y];
        const rowOff = y * N;
        for (let x = 0; x < N; x++) {
          const idx = rowOff + x;
          const fid = (fRow && fRow[x]) || null;
          if (terrainCache.floorIds[idx] !== fid) {
            dirty = true;
            break;
          }
          if (!fid && mRow[x].decal) {
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

    try {
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
        const rowOff = y * N;
        for (let x = 0; x < N; x++) {
          const cell = meta.grid[y][x];
          const isEdge = cell.isEdge;
          const checker = (x + y) % 2 === 0;
          const rawBase = isEdge
            ? checker
              ? P.terrainEdgeA
              : P.terrainEdgeB
            : checker
            ? P.terrainA
            : P.terrainB;
          const tileFill = isSil ? (isEdge ? '#CBD3DB' : '#D5DBE1') : Iso.shadeHex(rawBase, cell.shadeFactor);
          Iso.drawTilePoly(tctx, x, y, 0, tileFill, tileFill, 0.65);

          const fid = (fRow && fRow[x]) || null;
          const occ = Boolean(sRow && sRow[x]);
          terrainCache.floorIds[rowOff + x] = fid;
          terrainCache.decalOcc[rowOff + x] = occ;

          if (fid) {
            drawFloorTile(tctx, x, y, fid, 1.0);
          } else if (cell.decal && !occ) {
            drawTerrainDecal(tctx, x, y, cell.decal, 1.0);
          }
        }
      }

      if (!isSil) {
        drawQuarantineBorder(tctx, N, P, false, 1.0);
      }
      terrainCache.bakeCount += 1;
    } finally {
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

    // 1. Cached Background Sky / Tactical Tabletop Backdrop
    const isNightBg = state.nightAlpha > 0.4;
    if (bgCache.w !== w || bgCache.h !== h || bgCache.isSil !== isSil || bgCache.isNight !== isNightBg) {
      bgCache.w = w;
      bgCache.h = h;
      bgCache.isSil = isSil;
      bgCache.isNight = isNightBg;
      bgCache.canvas.width = Math.max(1, w);
      bgCache.canvas.height = Math.max(1, h);
      const bctx = bgCache.ctx || (bgCache.ctx = bgCache.canvas.getContext('2d'));
      if (isSil) {
        bctx.fillStyle = '#EEF1F4';
        bctx.fillRect(0, 0, w, h);
      } else {
        const bgGrad = bctx.createRadialGradient(w * 0.5, h * 0.42, 60, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
        if (isNightBg) {
          bgGrad.addColorStop(0, '#101B2D');
          bgGrad.addColorStop(1, '#060A13');
        } else {
          bgGrad.addColorStop(0, '#2C3B49');
          bgGrad.addColorStop(1, '#151E27');
        }
        bctx.fillStyle = bgGrad;
        bctx.fillRect(0, 0, w, h);
      }
    }
    ctx.drawImage(bgCache.canvas, 0, 0, w, h);

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
        drawHoverOverlay(ctx, state, uiState, tx, ty, zScale);
      }
    }

    // Selected structure range / aura indicator + base tile floor highlight (occluded by 3D structures)
    if (uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        Iso.drawTilePoly(ctx, tx, ty, 2.2, P.selectFill, P.selectStroke, 1.8);
      }
      const st = state.structGrid[ty] && state.structGrid[ty][tx];
      if (st) {
        if (st.id === 'command_hq') {
          const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(state.hqLevel) : null;
          if (hqInfo && hqInfo.weapon && hqInfo.weapon.range > 0) {
            drawIsoCircle(ctx, tx + 0.5, ty + 0.5, hqInfo.weapon.range, P.rangeStroke, P.rangeFill);
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
              }
              if (mDef.aura && mDef.aura.radius) {
                const auraR = mDef.aura.radius + (mDef.id === 'led_floodlight' ? 0.4 : 0);
                drawIsoCircle(ctx, tx + 0.5, ty + 0.5, auraR, P.goldStroke, P.goldFill);
              }
            }
          } else if (def) {
            const eff = ZS.Game.getStructureEffectiveStats(st, tx, ty);
            if (eff.range > 0) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, eff.range, P.rangeStroke, P.rangeFill);
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
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st) continue;
        if (!isGridVisible(x + 0.5, y + 0.5, cullPadX, cullPadTop, cullPadBot, w, h)) continue;
        const def = st.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[st.id];
        const depthOffset = def && def.passable ? 0.15 : 1.0;
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
      renderList.push({
        kind: 'zombie',
        depth: z.x + z.y + 0.05,
        z
      });
    }

    if (state.dyingZombies) {
      for (let i = 0; i < state.dyingZombies.length; i++) {
        const dz = state.dyingZombies[i];
        if (!isGridVisible(dz.x, dz.y, zPadX, zPadTop, zPadBot, w, h)) continue;
        renderList.push({
          kind: 'dying_zombie',
          depth: dz.x + dz.y + 0.04,
          dz
        });
      }
    }

    renderList.sort((a, b) => a.depth - b.depth);

    const powered = computeBlackoutElectricPowered(state, timeSec);
    const statusPowered = !state.isNight || !state.blackoutActive;
    const nightEmissives = state.nightAlpha > 0.02 ? [] : null;
    R.emissiveList = nightEmissives;

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        R.drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
      } else if (item.kind === 'edge_prop') {
        R.emissiveList = null;
        drawPerimeterProp(ctx, item.ep, zScale);
        R.emissiveList = nightEmissives;
      } else if (item.kind === 'zombie') {
        const z = item.z;
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
        R.emissiveList = null;
        R.drawDyingZombie(ctx, item.dz, zScale);
        R.emissiveList = nightEmissives;
      }
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
        drawBuildGhost(ctx, state, uiState, tx, ty, timeSec, zScale);
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

    // Stratum 1: Deep Bedrock (-22 .. -12)
    Iso.drawVoxelBox(ctx, 0, 0, -22, N, N, 10, {
      top: P.slabRockLeft || '#2B3038',
      left: P.slabRockLeft || '#2B3038',
      right: P.slabRockRight || '#1E2229'
    });

    // Protruding bedrock cliff blocks along visible front-left (y = N) and front-right (x = N) faces
    const rockOffsets = N >= 22 ? [2.2, 6.4, 11.1, 14.8, 18.9] : [2.2, 6.4, 11.1, 14.8];
    for (let i = 0; i < rockOffsets.length; i++) {
      const k = rockOffsets[i];
      Iso.drawVoxelBox(ctx, k, N - 0.16, -20.5 + (i % 2) * 1.5, 1.5, 0.24, 6.5, {
        base: '#363D47'
      });
      Iso.drawVoxelBox(ctx, N - 0.16, k + 0.5, -20 + (i % 2) * 1.5, 0.24, 1.4, 6.2, {
        base: '#2D333C'
      });
    }

    // Stratum 2: Subsoil & Clay (-12 .. -3.5)
    Iso.drawVoxelBox(ctx, 0, 0, -12, N, N, 8.5, {
      top: P.slabSideLeft || '#3A3027',
      left: P.slabSideLeft || '#3A3027',
      right: P.slabSideRight || '#2C241D'
    });

    // Embedded cliff stones in soil layer
    const stoneOffsets = N >= 22 ? [1.4, 4.7, 8.3, 12.6, 15.9, 19.3] : [1.4, 4.7, 8.3, 12.6, 15.9];
    for (let i = 0; i < stoneOffsets.length; i++) {
      const k = stoneOffsets[i];
      Iso.drawVoxelBox(ctx, k, N - 0.06, -9.2 + (i % 2) * 1.8, 0.55, 0.11, 2.6, {
        base: '#6C737B'
      });
      Iso.drawVoxelBox(ctx, N - 0.06, k, -8.8 + ((i + 1) % 2) * 1.8, 0.11, 0.55, 2.6, {
        base: '#5E656D'
      });
    }

    // Stratum 3: Topsoil & Overgrown Turf Lip (-3.5 .. 0)
    Iso.drawVoxelBox(ctx, 0, 0, -3.5, N, N, 3.5, {
      top: P.terrainEdgeB || P.terrainB,
      left: P.slabTurfLeft || '#3E4C3B',
      right: P.slabTurfRight || '#2F3A2D',
      stroke: 'rgba(255, 255, 255, 0.06)'
    });
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
    // Subtle dark curb shadow along inner safe-zone edge
    ctx.strokeStyle = 'rgba(18, 22, 26, 0.48)';
    ctx.lineWidth = Math.max(1.2, 2.0 * zScale);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
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
    const wispCount = N >= 22 ? 20 : 16;
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
    if (floorId === 'asphalt') {
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 1.5, {
        base: '#323842'
      });
      // Neutral white-gray lane dash (separated from Gold #FFC94A)
      const p1 = Iso.gridToScreen(x + 0.35, y + 0.5, 1.8);
      const p2 = Iso.gridToScreen(x + 0.65, y + 0.5, 1.8);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, 1.8 * zScale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (floorId === 'steel_deck') {
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2, {
        base: '#606f80',
        stroke: 'rgba(210,230,250,0.22)'
      });
      const c = Iso.gridToScreen(x + 0.5, y + 0.5, 2.2);
      ctx.fillStyle = 'rgba(220,235,255,0.3)';
      ctx.fillRect(c.x - 2 * zScale, c.y - 1 * zScale, 4 * zScale, 2 * zScale);
    } else if (floorId === 'lounge_tile') {
      const sub = (x + y) % 2 === 0 ? '#d8d2c5' : '#cbc4b5';
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2, {
        base: sub,
        stroke: 'rgba(255,255,255,0.28)'
      });
    } else if (floorId === 'hazard_mat') {
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 1.5, {
        base: '#c48650',
        stroke: '#d69c68'
      });
      Iso.drawVoxelBox(ctx, x + 0.12, y + 0.12, 1.5, 0.76, 0.76, 0.7, {
        base: '#3b424c'
      });
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
        const inBounds = tx > 0 && ty > 0 && tx < DATA.GRID_SIZE - 1 && ty < DATA.GRID_SIZE - 1;
        const canMountDest = !!(dest && srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && !dest.mounted);
        const canDrop = inBounds && (!dest || canMountDest);
        if (inBounds && dest && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && srcDef && srcDef.canMountOnWall) {
          drawWallPillarHighlight(
            ctx,
            tx,
            ty,
            dest.level || 2,
            canDrop ? 'rgba(74, 222, 128, 0.18)' : 'rgba(255, 77, 109, 0.18)',
            canDrop ? P.health : P.danger,
            2.2
          );
          if (canDrop && srcDef.range) {
            drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, srcDef.range, srcDef.range + 0.5, zScale);
          } else if (canDrop && srcDef.aura && srcDef.aura.radius) {
            drawIsoCircle(ctx, tx + 0.5, ty + 0.5, srcDef.aura.radius + 0.4, P.goldStroke, P.goldFill);
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
            const srcProf = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(srcDef, srcUnit.level || 1) : null;
            const moveAuraR = (srcProf && srcProf.auraRadius) || (srcDef.aura && srcDef.aura.radius);
            const moveGateR = (srcProf && srcProf.gateSlowRadius) || srcDef.gateSlowRadius;
            if (srcDef.range) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, srcDef.range, P.rangeStroke, P.rangeFill);
            }
            if (moveAuraR) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, moveAuraR, P.goldStroke, P.goldFill);
            }
            if (moveGateR) {
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
        if (check.ok && def.range) {
          drawDualRangeRings(ctx, tx + 0.5, ty + 0.5, def.range, def.range + 0.5, zScale);
        } else if (check.ok && def.aura && def.aura.radius) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.aura.radius + 0.4, P.goldStroke, P.goldFill);
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
        } else if (eDef && eDef.aura && eDef.aura.radius) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, eDef.aura.radius + 0.4, P.goldStroke, P.goldFill);
        }
      } else {
        const tier1Prof = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, 1) : null;
        const auraR = (tier1Prof && tier1Prof.auraRadius) || (def.aura && def.aura.radius);
        const gateSlowR = (tier1Prof && tier1Prof.gateSlowRadius) || def.gateSlowRadius;
        if (def.range) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.range, P.rangeStroke, P.rangeFill);
        }
        if (auraR) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, auraR, P.goldStroke, P.goldFill);
        }
        if (gateSlowR) {
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
      case 'barricade_wall': return level >= 3 ? 27.7 : level === 2 ? 14 : 10.9;
      case 'tactical_gate': return [16.5, 26.5, 28.0][Math.min(3, Math.max(1, level || 1)) - 1];
      case 'hesco_wall': return level >= 3 ? 19 : 14;
      case 'blast_wall': return level >= 3 ? 29 : 25;
      case 'razor_pad': return [5.4, 5.8, 6.45][Math.min(3, Math.max(1, level || 1)) - 1];
      case 'rifle_bunker': return level >= 3 ? 24 : 23;
      case 'shotgun_post': return 23;
      case 'sniper_tower': return 53;
      case 'vulcan_turret': return level >= 2 ? 24 : 21;
      case 'missile_pod': return 22;
      case 'emp_coil': return 35;
      case 'solar_array': return [12, 17, 24, 34][Math.min(4, Math.max(1, level || 1)) - 1];
      case 'wind_turbine': return [30, 44, 60, 70][Math.min(4, Math.max(1, level || 1)) - 1];
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
      R.emissiveList.push({ kind: 'poly', pts: snap, fill, hex });
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

  function drawGable(ctx, gx, gy, z, w, d, rise, roofHex, wallHex, zScale) {
    const Iso = ZS.Iso;
    const cy = gy + d * 0.5;
    drawPolyFace(
      ctx,
      [
        Iso.gridToScreen(gx, gy, z),
        Iso.gridToScreen(gx + w, gy, z),
        Iso.gridToScreen(gx + w, cy, z + rise),
        Iso.gridToScreen(gx, cy, z + rise)
      ],
      roofHex,
      0.95,
      false,
      true,
      zScale
    );
    drawPolyFace(
      ctx,
      [
        Iso.gridToScreen(gx, gy + d, z),
        Iso.gridToScreen(gx + w, gy + d, z),
        Iso.gridToScreen(gx + w, cy, z + rise),
        Iso.gridToScreen(gx, cy, z + rise)
      ],
      roofHex,
      0.86,
      false,
      true,
      zScale
    );
    drawPolyFace(
      ctx,
      [
        Iso.gridToScreen(gx + w, gy, z),
        Iso.gridToScreen(gx + w, gy + d, z),
        Iso.gridToScreen(gx + w, cy, z + rise)
      ],
      wallHex,
      0.66,
      false,
      true,
      zScale
    );
  }

  function drawSlantedSolarPanel(ctx, gx, gy, w, d, zBack, zFront, thick, frameHex, cellHex, gridHex, cols, rows, zScale) {
    const Iso = ZS.Iso;
    const a = Iso.gridToScreen(gx, gy, zBack);
    const b = Iso.gridToScreen(gx + w, gy, zBack);
    const c = Iso.gridToScreen(gx + w, gy + d, zFront);
    const dd = Iso.gridToScreen(gx, gy + d, zFront);
    const bB = Iso.gridToScreen(gx + w, gy, zBack - thick);
    const cB = Iso.gridToScreen(gx + w, gy + d, zFront - thick);
    const dB = Iso.gridToScreen(gx, gy + d, zFront - thick);
    drawPolyFace(ctx, [dd, c, cB, dB], frameHex, 0.82, false, true, zScale);
    drawPolyFace(ctx, [c, b, bB, cB], frameHex, 0.66, false, true, zScale);
    drawPolyFace(ctx, [a, b, c, dd], cellHex, 1.0, false, true, zScale);
    if (!window.ZS_SILHOUETTE_MODE) {
      ctx.strokeStyle = Iso.resolveFaceColor(gridHex, 1.0, false, 0) || gridHex;
      ctx.lineWidth = Math.max(0.75, 0.85 * zScale);
      for (let i = 1; i < cols; i++) {
        const sx = gx + (w * i) / cols;
        const p1 = Iso.gridToScreen(sx, gy, zBack);
        const p2 = Iso.gridToScreen(sx, gy + d, zFront);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let j = 1; j < rows; j++) {
        const t = j / rows;
        const sy = gy + d * t;
        const sz = zBack + (zFront - zBack) * t;
        const m1 = Iso.gridToScreen(gx, sy, sz);
        const m2 = Iso.gridToScreen(gx + w, sy, sz);
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
        ctx.stroke();
      }
    }
  }

  function drawHipRoof(ctx, gx, gy, z, w, d, h, hex, zScale) {
    const Iso = ZS.Iso;
    const apex = Iso.gridToScreen(gx + w * 0.5, gy + d * 0.5, z + h);
    const b0 = Iso.gridToScreen(gx, gy, z);
    const b1 = Iso.gridToScreen(gx + w, gy, z);
    const b2 = Iso.gridToScreen(gx + w, gy + d, z);
    const b3 = Iso.gridToScreen(gx, gy + d, z);
    drawPolyFace(ctx, [b0, b1, apex], hex, 0.97, false, true, zScale);
    drawPolyFace(ctx, [b0, b3, apex], hex, 0.97, false, true, zScale);
    drawPolyFace(ctx, [b3, b2, apex], hex, 0.86, false, true, zScale);
    drawPolyFace(ctx, [b2, b1, apex], hex, 0.72, false, true, zScale);
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
      R.emissiveList.push({ kind: 'dot', p: { x: p.x, y: p.y }, r: rPx, hex, fill });
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

  function drawSandbagRing(ctx, cx, cy, zBase, r, h, pass, zScale) {
    const Iso = ZS.Iso;
    if (pass === 'back') {
      drawCyl(ctx, cx, cy, zBase, r, h, '#B5A27A', { n: 16 }, zScale);
      drawCyl(ctx, cx, cy, zBase + h, r * 0.74, 0.02, '#5E5440', { n: 16, noSides: true, topEdge: false }, zScale);
    } else {
      drawCyl(ctx, cx, cy, zBase, r, h, '#B5A27A', { n: 16, noTop: true }, zScale);
      ctx.strokeStyle = Iso.resolveFaceColor('#B5A27A', 0.55, false, 0) || '#635943';
      ctx.lineWidth = Math.max(0.7, 0.85 * zScale);
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const a = -Math.PI * 0.25 + (k / 12) * Math.PI;
        const p = Iso.gridToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, zBase + h * 0.5);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
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
    ctx.globalAlpha = Math.min(1, 0.35 + nightAlpha * 0.65);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
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
    ensureTerrainMeta,
    ensureTerrainCache,
    drawEditGridOverlay,
    ensureLightCanvas,
    getGlowStamp,
    getPunchHoleStamp,
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
    drawEmissivePass
  });
})();
