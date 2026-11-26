window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;
  const { lightCanvas, lightCtx, eyeHaloCache, thumbnailCache } = R;
  const coldRimCache = new Map();
  const _holePt = { x: 0, y: 0 };
  const _glowPt = { x: 0, y: 0 };

  function getColdRimStamp(rimRatio) {
    const key = rimRatio.toFixed(3);
    let stamp = coldRimCache.get(key);
    if (stamp) return stamp;
    const sz = 128;
    stamp = document.createElement('canvas');
    stamp.width = sz;
    stamp.height = sz;
    const sctx = stamp.getContext('2d');
    const half = sz * 0.5;
    const grad = sctx.createRadialGradient(half, half, half * rimRatio, half, half, half);
    grad.addColorStop(0, 'rgba(10, 22, 48, 0)');
    grad.addColorStop(0.6, 'rgba(12, 26, 56, 0.22)');
    grad.addColorStop(1, 'rgba(5, 11, 26, 0.42)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, sz, sz);
    if (coldRimCache.size > 32) coldRimCache.clear();
    coldRimCache.set(key, stamp);
    return stamp;
  }

  function drawNightLighting(ctx, w, h, state, powered, timeSec, zScale) {
    const lc = R.ensureLightCanvas(w, h);
    const lw = lc.lw;
    const lh = lc.lh;
    const scaleX = lc.scaleX;
    const scaleY = lc.scaleY;
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const N = DATA.GRID_SIZE;

    const darkness = state.nightAlpha * (powered ? 0.72 : 0.84);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.globalAlpha = 1;
    lightCtx.clearRect(0, 0, lw, lh);
    lightCtx.fillStyle = `rgba(7, 13, 25, ${darkness.toFixed(3)})`;
    lightCtx.fillRect(0, 0, lw, lh);

    lightCtx.globalCompositeOperation = 'destination-out';
    const holeStamp = R.getPunchHoleStamp();

    function punchHole(gx, gy, zPx, radiusTiles, strength) {
      const rPx = radiusTiles * 36 * zScale;
      if (rPx <= 0 || strength <= 0.002) return;
      const p = Iso.projectTo(gx, gy, zPx, _holePt);
      if (p.x + rPx < 0 || p.x - rPx > w || p.y + rPx < 0 || p.y - rPx > h) return;
      const lx = p.x * scaleX;
      const ly = p.y * scaleY;
      const lrx = rPx * scaleX;
      const lry = rPx * scaleY;
      lightCtx.globalAlpha = Math.max(0, Math.min(1, strength));
      lightCtx.drawImage(holeStamp, lx - lrx, ly - lry, lrx * 2, lry * 2);
    }

    const colorGlows = [];

    // HQ always maintains warm emergency command light (scales with HQ level)
    const hqLv = state.hqLevel || 1;
    const hqLightRad = 3.4 + (hqLv - 1) * 0.55;
    punchHole(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 14, hqLightRad, 0.94);
    colorGlows.push({
      gx: DATA.HQ_POS.x + 0.5,
      gy: DATA.HQ_POS.y + 0.5,
      z: 14,
      r: 2.6 + (hqLv - 1) * 0.45,
      color: DATA.PALETTE.warmGlow
    });

    const getElev = (gx, gy) => (ZS.Game && ZS.Game.getTerrainElevationAt ? ZS.Game.getTerrainElevationAt(gx, gy) : 0);

    const illuminateNode = (node, gx, gy, lz, isMounted) => {
      const def = DATA.ITEMS[node.id];
      if (!def) return;
      if (def.requiresPower && (!powered || (node.empStunTimer || 0) > 0)) return;
      const prof = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, node.level || 1) : null;
      const eff = ZS.Game.getStructureEffectiveStats
        ? ZS.Game.getStructureEffectiveStats(node, gx, gy, undefined, !!isMounted)
        : null;
      const lightR = (eff && eff.lightRadius != null)
        ? eff.lightRadius
        : (prof && prof.lightRadius !== undefined ? prof.lightRadius : def.lightRadius);
      const lightCol = (prof && prof.lightColor) || def.lightColor;
      if (lightR) {
        const flicker = node.id === 'gas_heater' ? 0.96 + 0.05 * Math.sin(timeSec * 11 + gx) : 1.0;
        punchHole(gx + 0.5, gy + 0.5, lz, lightR * flicker, 0.92);
        if (lightCol) {
          colorGlows.push({
            gx: gx + 0.5,
            gy: gy + 0.5,
            z: lz,
            r: lightR * 0.85,
            color: lightCol
          });
        }
      } else if (def.subType === 'housing' || node.id === 'vending_machine') {
        const rad = node.id === 'shelter_pod' ? 2.2 : node.id === 'field_tent' ? 1.85 : 1.35;
        punchHole(gx + 0.5, gy + 0.5, lz, rad, 0.78);
        colorGlows.push({
          gx: gx + 0.5,
          gy: gy + 0.5,
          z: lz,
          r: rad * 0.85,
          color: 'rgba(255, 206, 112, 0.34)'
        });
      } else if (def.subType === 'manned' || def.subType === 'turret') {
        punchHole(gx + 0.5, gy + 0.5, lz, 1.65, 0.55);
        if (def.subType === 'manned') {
          colorGlows.push({
            gx: gx + 0.5,
            gy: gy + 0.5,
            z: lz,
            r: 1.25,
            color: 'rgba(255, 198, 108, 0.18)'
          });
        }
      }
    };

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const elev = getElev(x + 0.5, y + 0.5);
        illuminateNode(st, x, y, 12 + elev, false);
        if (st.mounted) {
          const mBaseZ = (st.level || 2) >= 3 ? 25.4 : 15.2;
          illuminateNode(st.mounted, x, y, mBaseZ + 12 + elev, true);
        }
      }
    }

    // Active flares & explosions illuminate the battlefield
    for (let i = 0; i < state.flares.length; i++) {
      const fl = state.flares[i];
      const flElev = getElev(fl.x, fl.y);
      punchHole(fl.x, fl.y, 8 + flElev, fl.radius, 0.96);
      colorGlows.push({
        gx: fl.x,
        gy: fl.y,
        z: 8 + flElev,
        r: fl.radius * 0.9,
        color: 'rgba(255, 195, 120, 0.25)'
      });
    }

    // Brief weapon muzzle flashes punch micro tactical illumination holes at night (#8)
    if (state.muzzleFlashes) {
      for (let i = 0; i < state.muzzleFlashes.length; i++) {
        const mf = state.muzzleFlashes[i];
        const strength = 0.62 * Math.max(0, Math.min(1, mf.life / (mf.maxLife || 0.055)));
        punchHole(mf.x, mf.y, mf.z || 14, 1.15 * (mf.scale || 1.0), strength);
        colorGlows.push({
          gx: mf.x,
          gy: mf.y,
          z: mf.z || 14,
          r: 0.95 * (mf.scale || 1.0),
          color: mf.kind === 'emp' ? 'rgba(94, 242, 255, 0.32)' : 'rgba(255, 214, 130, 0.32)'
        });
      }
    }

    lightCtx.globalAlpha = 1;
    ctx.drawImage(lightCanvas, 0, 0, w, h);

    // Cold deep-navy exterior rim vignette around outer perimeter to heighten temperature contrast
    const islandCenter = Iso.gridToScreen(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 6);
    const innerR = N * 11 * zScale;
    const outerR = Math.max(w, h) * 0.68;
    if (outerR > innerR + 10) {
      const rimRatio = Math.max(0.05, Math.min(0.85, Math.round((innerR / outerR) * 40) / 40));
      const rimStamp = getColdRimStamp(rimRatio);
      const rx0 = islandCenter.x - outerR;
      const ry0 = islandCenter.y - outerR;
      const rx1 = islandCenter.x + outerR;
      const ry1 = islandCenter.y + outerR;
      ctx.save();
      ctx.globalAlpha = state.nightAlpha;
      ctx.drawImage(rimStamp, rx0, ry0, outerR * 2, outerR * 2);
      ctx.fillStyle = 'rgba(5, 11, 26, 0.42)';
      if (ry0 > 0) ctx.fillRect(0, 0, w, ry0);
      if (ry1 < h) ctx.fillRect(0, ry1, w, h - ry1);
      const midTop = Math.max(0, ry0);
      const midBot = Math.min(h, ry1);
      if (midBot > midTop) {
        if (rx0 > 0) ctx.fillRect(0, midTop, rx0, midBot - midTop);
        if (rx1 < w) ctx.fillRect(rx1, midTop, w - rx1, midBot - midTop);
      }
      ctx.restore();
    }

    // Subtle colored atmospheric bloom (cluster-merged pre-baked 64x64 glow stamps + radius culling)
    const bloomAlpha = state.nightAlpha * 0.60;
    if (bloomAlpha > 0.005 && colorGlows.length > 0) {
      const mergeR = 40 * zScale;
      const mergeR2 = mergeR * mergeR;
      const glowClusters = [];
      for (let i = 0; i < colorGlows.length; i++) {
        const g = colorGlows[i];
        const rPx = g.r * 34 * zScale;
        if (rPx <= 0) continue;
        const p = Iso.projectTo(g.gx, g.gy, g.z, _glowPt);
        if (p.x + rPx < 0 || p.x - rPx > w || p.y + rPx < 0 || p.y - rPx > h) continue;
        let matched = null;
        for (let j = glowClusters.length - 1; j >= 0; j--) {
          const cl = glowClusters[j];
          if (cl.color !== g.color) continue;
          const dx = p.x - cl.x;
          const dy = p.y - cl.y;
          if (dx * dx + dy * dy <= mergeR2) {
            matched = cl;
            break;
          }
        }
        if (matched) {
          const n = matched.count;
          matched.x = (matched.x * n + p.x) / (n + 1);
          matched.y = (matched.y * n + p.y) / (n + 1);
          matched.count = n + 1;
          if (rPx > matched.maxR) matched.maxR = rPx;
        } else {
          glowClusters.push({
            color: g.color,
            x: p.x,
            y: p.y,
            maxR: rPx,
            count: 1
          });
        }
      }
      if (glowClusters.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < glowClusters.length; i++) {
          const cl = glowClusters[i];
          const rad = cl.count === 1
            ? cl.maxR
            : Math.min(cl.maxR * 1.35, cl.maxR + (cl.count - 1) * 7 * zScale);
          const boost = cl.count === 1 ? 1.0 : Math.min(1.85, 1 + (cl.count - 1) * 0.22);
          const stamp = R.getGlowStamp(cl.color, 0.04);
          ctx.globalAlpha = Math.min(1, bloomAlpha * boost);
          ctx.drawImage(stamp, cl.x - rad, cl.y - rad, rad * 2, rad * 2);
        }
        ctx.restore();
      }
    }
  }

  function drawReconOverlay(ctx, state, timeSec, zScale) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;
    const intel = state.nextWaveIntel;
    if (!intel) return;

    const isDay = state.phase === 'day';
    const fade = isDay ? 1.0 : Math.max(0, Math.min(1, (state.reconNightFadeTimer || 0) / 2.0));
    if (fade <= 0.01) return;

    const SIDE_POS = {
      0: (idx) => [idx, 0],
      1: (idx) => [N - 1, idx],
      2: (idx) => [idx, N - 1],
      3: (idx) => [0, idx]
    };
    const INWARD = {
      0: [0, 1],
      1: [-1, 0],
      2: [0, -1],
      3: [1, 0]
    };
    const eMid = Math.floor(N * 0.5);
    const eOff = Math.floor(N * 0.25);
    const ENTRY_IDX = [eOff, eMid, N - 1 - eOff];
    const getElev = (gx, gy) => (ZS.Game && ZS.Game.getTerrainElevationAt ? ZS.Game.getTerrainElevationAt(gx, gy) : 0);

    ctx.save();

    // 1. Dijkstra flow preview path lines (z = 1.5 + terrainElev, segment deduplicated, flowing toward HQ)
    if (state.showReconPaths && state.previewPaths && state.previewPaths.length > 0) {
      const seen = Object.create(null);
      const screenSegs = [];
      for (let pi = 0; pi < state.previewPaths.length; pi++) {
        const pts = state.previewPaths[pi].pts;
        if (!pts || pts.length < 2) continue;
        for (let si = 0; si < pts.length - 1; si++) {
          const a = pts[si];
          const b = pts[si + 1];
          const key = `${a.x},${a.y}>${b.x},${b.y}`;
          if (seen[key]) continue;
          seen[key] = true;
          screenSegs.push([
            Iso.gridToScreen(a.x + 0.5, a.y + 0.5, 1.5 + getElev(a.x + 0.5, a.y + 0.5)),
            Iso.gridToScreen(b.x + 0.5, b.y + 0.5, 1.5 + getElev(b.x + 0.5, b.y + 0.5))
          ]);
        }
      }

      if (screenSegs.length > 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(27, 36, 48, ${(0.55 * fade).toFixed(3)})`;
        ctx.lineWidth = Math.max(3.0, 4.0 * zScale);
        ctx.beginPath();
        for (let i = 0; i < screenSegs.length; i++) {
          ctx.moveTo(screenSegs[i][0].x, screenSegs[i][0].y);
          ctx.lineTo(screenSegs[i][1].x, screenSegs[i][1].y);
        }
        ctx.stroke();

        const flash = Math.max(0, Math.min(1, (state.reconFlashTimer || 0) / 0.30));
        const cr = 255;
        const cg = Math.round(143 + (255 - 143) * flash);
        const cb = Math.round(163 + (255 - 163) * flash);
        const ca = (0.85 + 0.15 * flash) * fade;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${ca.toFixed(3)})`;
        ctx.lineWidth = Math.max(2.0, 2.2 * zScale);
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -timeSec * 22;
        ctx.beginPath();
        for (let i = 0; i < screenSegs.length; i++) {
          ctx.moveTo(screenSegs[i][0].x, screenSegs[i][0].y);
          ctx.lineTo(screenSegs[i][1].x, screenSegs[i][1].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }

      // 2. Siege breach crosshairs (first blocking structure on predicted paths)
      const breaches = state.breachMarkers || [];
      const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;
      try {
        for (let bi = 0; bi < breaches.length; bi++) {
          const bm = breaches[bi];
          const bSt = state.structGrid[bm.ty] && state.structGrid[bm.ty][bm.tx];
          if (!bSt) continue;
          const bmElev = getElev(bm.tx + 0.5, bm.ty + 0.5);
          if (Iso.setElevationOffset) Iso.setElevationOffset(bmElev);
          let topZ = R.getStructVisualTopZ(bSt.id, bSt.level || 1);
          if (bSt.id === 'barricade_wall' && (bSt.level || 1) >= 2 && bSt.mounted) {
            topZ = ((bSt.level || 2) >= 3 ? 25.4 : 15.2) + R.getMountedVisualTopZ(bSt.mounted.id);
          }
          const pulse = 1 + 0.12 * Math.sin(timeSec * 5.23);
          R.drawIsoCircle(
            ctx,
            bm.tx + 0.5,
            bm.ty + 0.5,
            0.42 * pulse,
            `rgba(255, 77, 109, ${(0.9 * fade).toFixed(3)})`,
            `rgba(255, 77, 109, ${(0.12 * fade).toFixed(3)})`,
            [],
            1.6 * Math.max(0.9, zScale)
          );

          const cp = Iso.gridToScreen(bm.tx + 0.5, bm.ty + 0.5, topZ + 6);
          const r = 7 * pulse * Math.max(0.9, zScale);
          ctx.strokeStyle = `rgba(255, 77, 109, ${fade.toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cp.x - r - 4, cp.y);
          ctx.lineTo(cp.x - r + 3, cp.y);
          ctx.moveTo(cp.x + r - 3, cp.y);
          ctx.lineTo(cp.x + r + 4, cp.y);
          ctx.moveTo(cp.x, cp.y - r - 4);
          ctx.lineTo(cp.x, cp.y - r + 3);
          ctx.moveTo(cp.x, cp.y + r - 3);
          ctx.lineTo(cp.x, cp.y + r + 4);
          ctx.stroke();

          if (bm.count > 1) {
            const fontPx = Math.max(12, Math.round(12 * Math.max(1, zScale)));
            ctx.font = `800 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
            ctx.textAlign = 'left';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(8, 12, 18, ${(0.85 * fade).toFixed(3)})`;
            ctx.strokeText(`×${bm.count}`, cp.x + r + 5, cp.y - 6);
            ctx.fillStyle = `rgba(255, 255, 255, ${fade.toFixed(3)})`;
            ctx.fillText(`×${bm.count}`, cp.x + r + 5, cp.y - 6);
          }
        }
      } finally {
        if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      }
    }

    // 3. Outer perimeter entry chevrons (z = 0.8, 1.6s inward pulse, 5% minor sides omitted)
    const pul = 0.06 * (1 + Math.sin(timeSec * 3.927));
    for (let sd = 0; sd < 4; sd++) {
      const kind = intel.sideKinds ? intel.sideKinds[sd] : 'none';
      if (!kind || kind === 'none' || kind === 'min') continue;
      const inVec = INWARD[sd];
      const ix = inVec[0];
      const iy = inVec[1];
      const px = -iy;
      const py = ix;
      const rgb = kind === 'boss' ? '224, 64, 251' : kind === 'main' ? '255, 77, 109' : '255, 143, 163';

      const drawChev = (gx, gy, off, fill) => {
        const cx = gx + 0.5 + ix * (off + pul);
        const cy = gy + 0.5 + iy * (off + pul);
        const p0 = Iso.gridToScreen(cx + px * 0.32 - ix * 0.14, cy + py * 0.32 - iy * 0.14, 0.8);
        const p1 = Iso.gridToScreen(cx + ix * 0.18, cy + iy * 0.18, 0.8);
        const p2 = Iso.gridToScreen(cx - px * 0.32 - ix * 0.14, cy - py * 0.32 - iy * 0.14, 0.8);
        const p3 = Iso.gridToScreen(cx - ix * 0.02, cy - iy * 0.02, 0.8);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = `rgba(${rgb}, ${(0.95 * fade).toFixed(3)})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(27, 36, 48, ${(0.6 * fade).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.strokeStyle = `rgba(${rgb}, ${fade.toFixed(3)})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      };

      for (let k = 0; k < ENTRY_IDX.length; k++) {
        const pos = SIDE_POS[sd](ENTRY_IDX[k]);
        if (kind === 'main' || kind === 'boss') {
          drawChev(pos[0], pos[1], -0.18, true);
          drawChev(pos[0], pos[1], 0.16, true);
        } else {
          drawChev(pos[0], pos[1], 0, false);
        }
      }
    }

    // 4. Boss spawn direction icon (z = 22 at midpoint idx = Math.floor(N / 2))
    if (intel.bossSide != null) {
      const bPos = SIDE_POS[intel.bossSide](Math.floor(N / 2));
      const bp = Iso.gridToScreen(bPos[0] + 0.5, bPos[1] + 0.5, 22);
      const iconScale = Math.max(0.9, zScale);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(16, 22, 31, 0.78)';
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, 14 * iconScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = P.bossAccent || '#E040FB';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.translate(bp.x - 11 * iconScale, bp.y - 11 * iconScale);
      ctx.scale((22 / 24) * iconScale, (22 / 24) * iconScale);
      ctx.strokeStyle = P.bossAccent || '#E040FB';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (typeof Path2D === 'function') {
        const dList = [
          'M5 3.5l2.2 5M19 3.5l-2.2 5',
          'M12 7a6 6 0 0 0-6 6c0 2 1 3.6 2.5 4.6V20.5h7v-2.9c1.5-1 2.5-2.6 2.5-4.6a6 6 0 0 0-6-6z',
          'M9.3 13h1.6M13.1 13h1.6'
        ];
        for (let i = 0; i < dList.length; i++) {
          ctx.stroke(new Path2D(dList[i]));
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawEmpStunIndicator(ctx, gx, gy, topZ, stunTimer, timeSec, badgeScale, zScale, P) {
    const Iso = ZS.Iso;
    const empCol = P.mutantEmp || '#B26BFF';
    const arcBase = Iso.gridToScreen(gx, gy, Math.max(4, topZ - 6));
    const flicker = (Math.floor(timeSec * 12) % 3);
    const arcs = [
      [-8, 6, -2, -2, 4, 8],
      [6, 2, 10, -6, 12, 4],
      [-6, -4, 0, -9, 6, -3]
    ];
    ctx.save();
    ctx.strokeStyle = empCol;
    ctx.lineWidth = 1.4 * zScale;
    for (let k = 0; k < arcs.length; k++) {
      if (k === 2 && flicker === 0) continue;
      const a = arcs[k];
      const ox = k === flicker ? 1.5 * zScale : 0;
      ctx.beginPath();
      ctx.moveTo(arcBase.x + (a[0] * zScale) + ox, arcBase.y + a[1] * zScale);
      ctx.lineTo(arcBase.x + (a[2] * zScale) + ox, arcBase.y + a[3] * zScale);
      ctx.lineTo(arcBase.x + (a[4] * zScale) + ox, arcBase.y + a[5] * zScale);
      ctx.stroke();
    }

    const pos = Iso.gridToScreen(gx, gy, topZ + 8);
    const r = 10 * badgeScale;
    const ratio = Math.max(0, Math.min(1, stunTimer / 3.0));
    ctx.fillStyle = 'rgba(27, 36, 48, 0.78)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r + 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(178, 107, 255, 0.35)';
    ctx.lineWidth = 2.4 * badgeScale;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = empCol;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();

    const icoScale = 0.58 * badgeScale;
    ctx.translate(pos.x - 12 * icoScale, pos.y - 12 * icoScale);
    ctx.scale(icoScale, icoScale);
    ctx.strokeStyle = empCol;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (typeof Path2D !== 'undefined') {
      ctx.stroke(new Path2D('M11.5 3L5.5 13.5h5L9.5 21l6.5-10.5h-5z'));
      ctx.stroke(new Path2D('M16 3.5h4.5l-4.5 5h4.5'));
    } else {
      ctx.beginPath();
      ctx.moveTo(11.5, 3);
      ctx.lineTo(5.5, 13.5);
      ctx.lineTo(10.5, 13.5);
      ctx.lineTo(9.5, 21);
      ctx.lineTo(16, 10.5);
      ctx.lineTo(11, 10.5);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Renders the unpowered OFF pill badge with a 1.65x zoom cap so 2.50x closeups stay unobstructed. */
  function drawPowerOffPillBadge(ctx, gx, gy, warnZ, zScale, P) {
    const warnPos = ZS.Iso.gridToScreen(gx, gy, warnZ);
    const badgeScale = Math.max(1.0, Math.min(1.65, zScale));
    const fontPx = Math.max(12, Math.round(12 * badgeScale));
    const pillW = 46 * badgeScale;
    const pillH = 16 * badgeScale;
    const pillY = warnPos.y - pillH + 2 * badgeScale;
    ctx.fillStyle = P.outlineDark || '#1B2430';
    ctx.fillRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);
    ctx.strokeStyle = P.danger;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);

    drawCanvasPowerOffIcon(ctx, warnPos.x - 13 * badgeScale, pillY + pillH * 0.5, Math.max(12, 12 * badgeScale), P.danger);
    ctx.font = `800 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    const textY = pillY + pillH * 0.5 + fontPx * 0.35;
    ctx.fillStyle = P.danger;
    ctx.fillText('OFF', warnPos.x + 6.5 * badgeScale, textY);
  }

  /** Renders an amber 0명 badge above unmanned outposts or uncrewed HQ turrets. */
  function drawDormantCrewPillBadge(ctx, gx, gy, warnZ, zScale, P, label) {
    const warnPos = ZS.Iso.gridToScreen(gx, gy, warnZ);
    const badgeScale = Math.max(1.0, Math.min(1.65, zScale));
    const fontPx = Math.max(12, Math.round(12 * badgeScale));
    const text = label || '0명';
    const pillW = 34 * badgeScale;
    const pillH = 16 * badgeScale;
    const pillY = warnPos.y - pillH + 2 * badgeScale;
    ctx.fillStyle = P.outlineDark || '#1B2430';
    ctx.fillRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);
    ctx.strokeStyle = P.caution || '#FFC94A';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);
    ctx.font = `800 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    const textY = pillY + pillH * 0.5 + fontPx * 0.35;
    ctx.fillStyle = P.caution || '#FFC94A';
    ctx.fillText(text, warnPos.x, textY);
  }

  function drawWindOverlay(ctx, state, uiState, timeSec, zScale) {
    const tGrid = state && state.terrainGrid;
    if (!tGrid || !state.showWindOverlay || uiState.mainMenuOpen) return;
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const N = DATA.GRID_SIZE;
    const vp = Iso.getViewport ? Iso.getViewport() : { w: 1280, h: 720 };
    const viewW = vp.w;
    const viewH = vp.h;
    const windCells = [];
    let sumX = 0;
    let sumY = 0;
    let windAngle = -0.6;

    for (let y = 0; y < N; y++) {
      const row = tGrid[y];
      if (!row) continue;
      for (let x = 0; x < N; x++) {
        const tc = row[x];
        if (!tc || tc.kind !== 'wind') continue;
        windCells.push({ x, y, tc });
        sumX += x + 0.5;
        sumY += y + 0.5;
        if (tc.windAngle != null) windAngle = tc.windAngle;
      }
    }
    if (windCells.length === 0) return;

    const getWindTier = (x, y) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return 0;
      const tc = tGrid[y] && tGrid[y][x];
      return tc && tc.kind === 'wind' ? (tc.tier || 1) : 0;
    };

    ctx.save();
    const zOv = 0.45;
    const pulse = 0.86 + 0.14 * Math.sin(timeSec * 2.6);

    // 1. 2-tier Wind Zone isometric heatmap (tier 1: emerald +40%, tier 2: golden-chartreuse +70%, 0px cyan)
    for (let i = 0; i < windCells.length; i++) {
      const { x, y, tc } = windCells[i];
      const tier = tc.tier || 1;
      const pN = Iso.gridToScreen(x, y, zOv);
      const pE = Iso.gridToScreen(x + 1, y, zOv);
      const pS = Iso.gridToScreen(x + 1, y + 1, zOv);
      const pW = Iso.gridToScreen(x, y + 1, zOv);

      ctx.beginPath();
      ctx.moveTo(pN.x, pN.y);
      ctx.lineTo(pE.x, pE.y);
      ctx.lineTo(pS.x, pS.y);
      ctx.lineTo(pW.x, pW.y);
      ctx.closePath();

      if (tier >= 2) {
        ctx.fillStyle = `rgba(250, 204, 21, ${(0.34 * pulse).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.48)';
        ctx.lineWidth = Math.max(0.8, 1.0 * zScale);
        ctx.stroke();

        const cN = Iso.gridToScreen(x + 0.22, y + 0.22, zOv + 0.15);
        const cE = Iso.gridToScreen(x + 0.78, y + 0.22, zOv + 0.15);
        const cS = Iso.gridToScreen(x + 0.78, y + 0.78, zOv + 0.15);
        const cW = Iso.gridToScreen(x + 0.22, y + 0.78, zOv + 0.15);
        ctx.beginPath();
        ctx.moveTo(cN.x, cN.y);
        ctx.lineTo(cE.x, cE.y);
        ctx.lineTo(cS.x, cS.y);
        ctx.lineTo(cW.x, cW.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.24)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.72)';
        ctx.lineWidth = Math.max(0.9, 1.15 * zScale);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(52, 211, 153, ${(0.23 * pulse).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.36)';
        ctx.lineWidth = Math.max(0.75, 0.9 * zScale);
        ctx.stroke();
      }
    }

    // 2. Perimeter contour (#6EE7B7 outer edge, #FDE047 core gust edge)
    const drawEdgeSeg = (x0, y0, x1, y1) => {
      const a = Iso.gridToScreen(x0, y0, zOv + 0.4);
      const b = Iso.gridToScreen(x1, y1, zOv + 0.4);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    };

    ctx.beginPath();
    ctx.strokeStyle = '#6EE7B7';
    ctx.lineWidth = Math.max(1.6, 2.2 * zScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < windCells.length; i++) {
      const { x, y } = windCells[i];
      if (getWindTier(x, y - 1) === 0) drawEdgeSeg(x, y, x + 1, y);
      if (getWindTier(x + 1, y) === 0) drawEdgeSeg(x + 1, y, x + 1, y + 1);
      if (getWindTier(x, y + 1) === 0) drawEdgeSeg(x, y + 1, x + 1, y + 1);
      if (getWindTier(x - 1, y) === 0) drawEdgeSeg(x, y, x, y + 1);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = Math.max(1.5, 2.0 * zScale);
    for (let i = 0; i < windCells.length; i++) {
      const { x, y, tc } = windCells[i];
      if ((tc.tier || 1) < 2) continue;
      if (getWindTier(x, y - 1) < 2) drawEdgeSeg(x, y, x + 1, y);
      if (getWindTier(x + 1, y) < 2) drawEdgeSeg(x + 1, y, x + 1, y + 1);
      if (getWindTier(x, y + 1) < 2) drawEdgeSeg(x, y + 1, x + 1, y + 1);
      if (getWindTier(x - 1, y) < 2) drawEdgeSeg(x, y, x, y + 1);
    }
    ctx.stroke();

    // 3. Animated directional wind streamlines
    const vx = Math.cos(windAngle);
    const vy = Math.sin(windAngle);
    ctx.lineCap = 'round';
    for (let i = 0; i < windCells.length; i++) {
      const { x, y, tc } = windCells[i];
      const tier = tc.tier || 1;
      const phase = ((timeSec * (tier >= 2 ? 0.95 : 0.68) + x * 0.37 + y * 0.53) % 1);
      const alpha = Math.sin(phase * Math.PI) * (tier >= 2 ? 0.88 : 0.65);
      if (alpha <= 0.04) continue;
      const drift = (phase - 0.5) * 0.44;
      const mx = x + 0.5 + vx * drift;
      const my = y + 0.5 + vy * drift;
      const segHalf = tier >= 2 ? 0.24 : 0.19;
      const zFlow = zOv + 2.6 + tier * 1.4;
      const s0 = Iso.gridToScreen(mx - vx * segHalf, my - vy * segHalf, zFlow);
      const s1 = Iso.gridToScreen(mx + vx * segHalf, my + vy * segHalf, zFlow);
      if (
        Math.max(s0.x, s1.x) < -40 || Math.min(s0.x, s1.x) > viewW + 40 ||
        Math.max(s0.y, s1.y) < -40 || Math.min(s0.y, s1.y) > viewH + 40
      ) continue;

      ctx.strokeStyle = tier >= 2 ? `rgba(254, 249, 195, ${alpha.toFixed(3)})` : `rgba(209, 250, 229, ${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, (tier >= 2 ? 2.1 : 1.55) * zScale);
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.quadraticCurveTo(
        (s0.x + s1.x) * 0.5,
        (s0.y + s1.y) * 0.5 - 3.2 * zScale,
        s1.x,
        s1.y
      );
      ctx.stroke();

      if (tier >= 2) {
        const dx = s1.x - s0.x;
        const dy = s1.y - s0.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const aw = 4.2 * zScale;
        ctx.beginPath();
        ctx.moveTo(s1.x - ux * aw - uy * aw * 0.55, s1.y - uy * aw + ux * aw * 0.55);
        ctx.lineTo(s1.x, s1.y);
        ctx.lineTo(s1.x - ux * aw + uy * aw * 0.55, s1.y - uy * aw - ux * aw * 0.55);
        ctx.stroke();
      }
    }

    // 4. Per-tile percentage labels & Zone summary legend
    const labelPx = Math.max(12, Math.round(12 * zScale));
    ctx.font = `800 ${labelPx}px 'Chakra Petch', 'Pretendard', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < windCells.length; i++) {
      const { x, y, tc } = windCells[i];
      const tier = tc.tier || 1;
      if (state.structGrid[y] && state.structGrid[y][x]) continue;
      if (tier < 2 && ((x + y) & 1) !== 0 && zScale < 0.92) continue;
      const lp = Iso.gridToScreen(x + 0.5, y + 0.5, zOv + 2.0);
      if (lp.x < -30 || lp.x > viewW + 30 || lp.y < -20 || lp.y > viewH + 20) continue;
      const txt = tier >= 2 ? '+70%' : '+40%';
      ctx.strokeStyle = 'rgba(8, 13, 20, 0.92)';
      ctx.lineWidth = Math.max(2.6, 3.2 * zScale);
      ctx.strokeText(txt, lp.x, lp.y);
      ctx.fillStyle = tier >= 2 ? '#FEF08A' : '#A7F3D0';
      ctx.fillText(txt, lp.x, lp.y);
    }

    // Place zone legend pill neatly above the northernmost wind tile so core tiles & turbines stay unobstructed
    let topTile = windCells[0];
    for (let i = 1; i < windCells.length; i++) {
      if (windCells[i].x + windCells[i].y < topTile.x + topTile.y) {
        topTile = windCells[i];
      }
    }
    const cx = sumX / windCells.length;
    const badgePos = Iso.gridToScreen((cx + topTile.x + 0.5) * 0.5, topTile.y + 0.15, 22);
    if (badgePos.x >= -140 && badgePos.x <= viewW + 140 && badgePos.y >= -40 && badgePos.y <= viewH + 40) {
      const bannerTxt = '강풍 레이어 · 주변 +40% / 중심 +70% (풍력 전용)';
      ctx.font = "700 12px 'Pretendard', 'Segoe UI', sans-serif";
      const tw = ctx.measureText(bannerTxt).width;
      const pw = tw + 18;
      const ph = 24;
      const px = Math.round(badgePos.x - pw * 0.5);
      const py = Math.round(badgePos.y - ph * 0.5);
      ctx.fillStyle = 'rgba(12, 24, 24, 0.88)';
      ctx.strokeStyle = '#6EE7B7';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(px, py, pw, ph, 5);
      } else {
        ctx.rect(px, py, pw, ph);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ECFDF5';
      ctx.fillText(bannerTxt, badgePos.x, badgePos.y + 0.5);
    }

    ctx.restore();
  }

  function drawInfoLayer(ctx, state, uiState, renderList, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;

    drawWindOverlay(ctx, state, uiState, timeSec, zScale);
    drawReconOverlay(ctx, state, timeSec, zScale);

    const getElev = (gx, gy) => (ZS.Game && ZS.Game.getTerrainElevationAt ? ZS.Game.getTerrainElevationAt(gx, gy) : 0);
    const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;

    ctx.save();

    // 1. Selected / Inspected Tile Border (crisp above night darkness without cutting through 3D structures)
    if (state.phase === 'day' && uiState.mode === 'build' && uiState.selectedItemId && uiState.hoverTile && ZS.Game.getPlacementCozyPreview) {
      const htx = uiState.hoverTile.tx;
      const hty = uiState.hoverTile.ty;
      if (htx >= 0 && hty >= 0 && htx < N && hty < N) {
        const cPrev = ZS.Game.getPlacementCozyPreview(uiState.selectedItemId, htx, hty);
        if (cPrev && (cPrev.isDiminished || cPrev.isFloorCapped || cPrev.gain > 0)) {
          const p = Iso.gridToScreen(htx + 0.5, hty + 0.5, 26 + getElev(htx + 0.5, hty + 0.5));
          const isNormalCozy = !cPrev.isFloorCapped && !cPrev.isDiminished;
          const label = cPrev.isFloorCapped
            ? '상한 도달'
            : cPrev.isDiminished
            ? `+${cPrev.gain} (50%)`
            : `+${cPrev.gain}`;
          const col = cPrev.isFloorCapped ? '#A9BCCF' : cPrev.isDiminished ? '#A9BCCF' : P.gold;
          const fontPx = Math.max(12, Math.round(12.5 * zScale));
          ctx.font = `700 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
          ctx.textAlign = 'center';
          const textX = isNormalCozy ? p.x + 6 : p.x;
          ctx.strokeStyle = P.outlineDark || '#1B2430';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText(label, textX, p.y);
          ctx.fillStyle = col;
          ctx.fillText(label, textX, p.y);
          if (isNormalCozy) {
            drawCanvasHeartIcon(ctx, p.x - fontPx * 0.85, p.y - fontPx * 0.36, Math.max(12, fontPx), P.gold, P.outlineDark || '#1B2430');
          }
        }
      }
    }

    if (uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(tx + 0.5, ty + 0.5));
        try {
          const selSt = state.structGrid[ty] && state.structGrid[ty][tx];
          const selDef = selSt ? (selSt.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[selSt.id]) : null;
          const hasSolidStruct = selSt && !(selDef && selDef.passable);
          if (hasSolidStruct) {
            const l = Iso.gridToScreen(tx, ty + 1, 2.2);
            const f = Iso.gridToScreen(tx + 1, ty + 1, 2.2);
            const r = Iso.gridToScreen(tx + 1, ty, 2.2);
            ctx.strokeStyle = P.selectStroke;
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(f.x, f.y);
            ctx.lineTo(r.x, r.y);
            ctx.stroke();
          } else {
            Iso.drawTilePoly(ctx, tx, ty, 2.2, null, P.selectStroke, 1.8);
          }
        } finally {
          if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
        }
      }
    }

    if (R.hoverOccludedByFront && !uiState.mainMenuOpen && uiState.pointerClient && uiState.pointerClient.inside && uiState.hoverTile) {
      const { tx, ty } = uiState.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        let rimStroke = 'rgba(255, 255, 255, 0.78)';
        let rimFill = 'rgba(255, 255, 255, 0.08)';
        if (state.phase === 'day') {
          if (uiState.mode === 'remove') {
            rimStroke = P.danger;
            rimFill = P.dangerFill;
          } else if (uiState.mode === 'build' && uiState.selectedItemId && ZS.Game.canPlaceItem) {
            const check = ZS.Game.canPlaceItem(uiState.selectedItemId, tx, ty);
            rimStroke = check && check.ok ? P.health : P.danger;
            rimFill = check && check.ok ? P.healthFill : P.dangerFill;
          } else if (uiState.mode === 'move' && uiState.movingSource) {
            const srcCell = state.structGrid[uiState.movingSource.ty] && state.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
            const srcUnit = srcCell && (srcCell.mounted || srcCell);
            const srcDef = srcUnit ? DATA.ITEMS[srcUnit.id] : null;
            const dest = state.structGrid[ty] && state.structGrid[ty][tx];
            const destTerrain = ZS.Game.getTerrainAt ? ZS.Game.getTerrainAt(tx, ty) : (state.terrainGrid && state.terrainGrid[ty] && state.terrainGrid[ty][tx]);
            const inBounds = tx > 0 && ty > 0 && tx < N - 1 && ty < N - 1;
            let terrainOk = true;
            if (destTerrain) {
              if (destTerrain.kind === 'rock') terrainOk = false;
              else if (destTerrain.kind === 'ramp' && (!srcDef || srcDef.id !== 'razor_pad')) terrainOk = false;
            }
            const canMountDest = !!(terrainOk && dest && srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall' && (dest.level || 1) >= 2 && !dest.mounted);
            const canDrop = inBounds && terrainOk && (!dest || canMountDest);
            rimStroke = canDrop ? P.health : P.danger;
            rimFill = canDrop ? P.healthFill : P.dangerFill;
          }
        }
        if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(tx + 0.5, ty + 0.5));
        ctx.save();
        try {
          ctx.setLineDash([4 * zScale, 3 * zScale]);
          Iso.drawTilePoly(ctx, tx, ty, 2, rimFill, rimStroke, 1.6 * zScale);
        } finally {
          ctx.restore();
          if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
        }
      }
    }

    // 2. Depth-sorted Structure HP Bars, Power-OFF Warnings, and Zombie HP Bars
    const nightEyes = [];
    try {
      for (let i = 0; i < renderList.length; i++) {
        const item = renderList[i];
        if (item.kind === 'struct') {
          if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(item.tx + 0.5, item.ty + 0.5));
          const structOccAlpha = item.occAlpha != null ? item.occAlpha : 1.0;
          if (structOccAlpha < 0.995) {
            ctx.save();
            ctx.globalAlpha *= structOccAlpha;
          }
          const st = item.st;
          const tx = item.tx;
          const ty = item.ty;
          const id = st.id;
          const def = id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[id];
          const lv = st.level || 1;
          const isWall = id === 'barricade_wall' || (def && def.subType === 'wall');
          const wallMask = isWall ? R.getWallConnectMask(state.structGrid, tx, ty, state.terrainGrid) : 0;
          const isWallInspOrHov =
            (uiState.inspectedTile && uiState.inspectedTile.tx === tx && uiState.inspectedTile.ty === ty) ||
            (uiState.hoverTile && uiState.hoverTile.tx === tx && uiState.hoverTile.ty === ty);

          if (id === 'barricade_wall' && lv >= 2 && st.mounted) {
            const m = st.mounted;
            const mDef = DATA.ITEMS[m.id];
            const mLv = m.level || 1;
            const mBaseZ = lv >= 3 ? 25.4 : 15.2;
            const topZ = mBaseZ + R.getMountedVisualTopZ(m.id);
            const hasPips = mLv >= 2;
            const hasRank = (m.rank || 0) >= 1;
            const isAnyDamaged = (st.hp < st.maxHp && st.hp > 0) || (m.hp < m.maxHp && m.hp > 0);
            const showDualHp = isAnyDamaged || isWallInspOrHov;
            const dualHpZ = topZ + 16 + (hasPips || hasRank ? 8 : 0);

            if (showDualHp) {
              const barPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, dualHpZ);
              const bw = 26 * zScale;
              const drawSubBar = (yPx, hPx, ratio) => {
                ctx.fillStyle = P.outlineDark || '#1B2430';
                ctx.fillRect(barPos.x - bw * 0.5 - 1.2, yPx - 1.2, bw + 2.4, hPx + 2.4);
                ctx.fillStyle = ratio > 0.5 ? P.heal : ratio > 0.25 ? P.caution : P.danger;
                ctx.fillRect(barPos.x - bw * 0.5, yPx, bw * Math.max(0, Math.min(1, ratio)), hPx);
              };
              const topH = 3.6 * zScale;
              const wallH = 2.4 * zScale;
              const mRatio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
              const wRatio = st.maxHp > 0 ? st.hp / st.maxHp : 1;
              drawSubBar(barPos.y, topH, mRatio);
              const wallY = barPos.y + topH + 2.5;
              drawSubBar(wallY, wallH, wRatio);
              ctx.fillStyle = P.steelBand || '#8C96A3';
              ctx.fillRect(barPos.x - bw * 0.5 - 3.5, wallY - 1, 2, wallH + 2);
            }

            if (hasPips) {
              drawUpgradePips(ctx, tx + 0.5, ty + 0.5, topZ + 9, mLv, hasRank, state.isNight, m.upgradeAnimTimer || 0, zScale);
            }
            if (hasRank) {
              drawRankBadge(ctx, tx + 0.5, ty + 0.5, topZ + 9, m.rank || 0, hasPips, m.promoAnimTimer || 0, zScale);
            }

            const badgeScaleCap = Math.max(1.0, Math.min(1.65, zScale));
            const isMountUnpowered = state.isNight && mDef && mDef.requiresPower && !powered;
            const isMountEmpStunned = !isMountUnpowered && mDef && mDef.requiresPower && (m.empStunTimer || 0) > 0;
            const isMountUncrewed = !isMountUnpowered && !isMountEmpStunned && mDef && mDef.subType === 'manned' && (m.crew || 0) <= 0;
            if (isMountUnpowered) {
              const warnZ = showDualHp ? dualHpZ + 13 : topZ + (hasPips || hasRank ? 19 : 11);
              drawPowerOffPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P);
            } else if (isMountEmpStunned) {
              const empZ = showDualHp ? dualHpZ + 8 : topZ + (hasPips || hasRank ? 14 : 6);
              drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, m.empStunTimer || 0, timeSec, badgeScaleCap, zScale, P);
            } else if (isMountUncrewed) {
              const warnZ = showDualHp ? dualHpZ + 13 : topZ + (hasPips || hasRank ? 19 : 11);
              drawDormantCrewPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P, '0명');
            }
          } else {
            const isDamaged = st.hp < st.maxHp && st.hp > 0;
            const isUnpowered = state.isNight && def && def.requiresPower && !powered;
            const isTierEvo = !!(ZS.Game && ZS.Game.isTierEvolutionDef && ZS.Game.isTierEvolutionDef(def));
            const isWallHub = isWall && wallMask !== 0 && ((wallMask & 5) !== 0 && (wallMask & 10) !== 0);
            const showWallPips = isWall && lv >= 2 && (wallMask === 0 || isWallHub || isWallInspOrHov);
            const hasPips = id !== 'command_hq' && !isTierEvo && (isWall ? showWallPips : lv >= 2);
            const hasRank = (st.rank || 0) >= 1;
            const topZ = id === 'command_hq'
              ? ((ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(state.hqLevel) : null)?.maxZ || 36)
              : R.getStructVisualTopZ(id, lv);

            if (isDamaged) {
              let hpZ = topZ + 8 + (hasPips || hasRank ? 6 : 0);
              let hpW = 26;
              if (id === 'command_hq') {
                const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(state.hqLevel) : null;
                hpZ = (hqInfo ? hqInfo.maxZ : 36) + 8;
                hpW = hqInfo ? hqInfo.hpBarWidth : 38;
              }
              const barPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, hpZ);
              const bw = hpW * zScale;
              const bh = 4 * zScale;
              const ratio = Math.max(0, st.hp / st.maxHp);
              ctx.fillStyle = P.outlineDark || '#1B2430';
              ctx.fillRect(barPos.x - bw * 0.5 - 1.2, barPos.y - 1.2, bw + 2.4, bh + 2.4);
              ctx.fillStyle = ratio > 0.5 ? P.heal : ratio > 0.25 ? P.caution : P.danger;
              ctx.fillRect(barPos.x - bw * 0.5, barPos.y, bw * ratio, bh);
            }

            // Facility Upgrade ◆ Pips in Info Layer (Lv.2 = ◆◆ #F2F4F7, Lv.3 = ◆◆◆ #FF9F43, 70% alpha at night)
            if (hasPips) {
              drawUpgradePips(ctx, tx + 0.5, ty + 0.5, topZ + 9, lv, hasRank, state.isNight, st.upgradeAnimTimer || 0, zScale);
            }

            // Combat Veterancy Rank Badge in Info Layer (Rank 1 Bronze Chevron, Rank 2 Silver 2-Chevron [NO cyan], Rank 3 Gold Star)
            if (hasRank) {
              drawRankBadge(ctx, tx + 0.5, ty + 0.5, topZ + 9, st.rank || 0, hasPips, st.promoAnimTimer || 0, zScale);
            }

            const isEmpStunned = !isUnpowered && def && def.requiresPower && (st.empStunTimer || 0) > 0;
            const isUncrewed = !isUnpowered && !isEmpStunned && (
              (def && def.subType === 'manned' && (st.crew || 0) <= 0) ||
              (id === 'command_hq' && lv >= 2 && (st.crew || 0) <= 0)
            );
            if (isUnpowered) {
              const warnZ = isDamaged ? 35 : 29;
              drawPowerOffPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P);
            } else if (isEmpStunned) {
              const empZ = Math.max(topZ + (hasPips || hasRank ? 12 : 4), isDamaged ? 32 : 24);
              drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, st.empStunTimer || 0, timeSec, Math.max(1.0, Math.min(1.65, zScale)), zScale, P);
            } else if (isUncrewed) {
              const warnZ = Math.max(topZ + (hasPips || hasRank ? 15 : 8), isDamaged ? 35 : 26);
              drawDormantCrewPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P, '0명');
            }
          }
          if (structOccAlpha < 0.995) ctx.restore();
        } else if (item.kind === 'zombie') {
          const z = item.z;
          if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(z.x, z.y));
          const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;
          const m = z._framePose || (R.getQuantizedZombiePoseMetrics ? R.getQuantizedZombiePoseMetrics(z, zDef, timeSec) : R.getZombiePoseMetrics(z, zDef, timeSec));

          if (state.nightAlpha > 0.05) {
            const eyes = z._frameEyes || R.getZombieEyePositions(z, zDef, timeSec, zScale, m);
            const occluded = z._frameEyes != null && z._frameEyesOccluded !== undefined
              ? z._frameEyesOccluded
              : R.isZombieEyesOccluded(state, z, eyes, zScale);
            if (!occluded) {
              nightEyes.push({ eyes, zDef });
            }
          }

          // Shocker Info-Layer Spark Arc connecting 3 dorsal rod tips (#FFE14D)
          if (z.type === 'shocker') {
            const rodOffsets = [[-0.09, 13.0], [0, 15.5], [0.09, 13.0]];
            const tips = [];
            for (let r = 0; r < rodOffsets.length; r++) {
              const oy = rodOffsets[r][0] * m.sc;
              const rh = rodOffsets[r][1] * m.sc;
              tips.push(Iso.gridToScreen(
                z.x - m.fx * 0.26 * m.sc + m.px * oy,
                z.y - m.fy * 0.26 * m.sc + m.py * oy,
                m.bodyBaseZ + 8.0 * m.sc + rh + 1.1 * m.sc
              ));
            }
            ctx.save();
            ctx.strokeStyle = P.mutantSpark || '#FFE14D';
            ctx.lineWidth = 1.2 * zScale;
            ctx.beginPath();
            ctx.moveTo(tips[0].x, tips[0].y);
            ctx.lineTo((tips[0].x + tips[1].x) * 0.5 + 2 * zScale, (tips[0].y + tips[1].y) * 0.5 - 3 * zScale);
            ctx.lineTo(tips[1].x, tips[1].y);
            ctx.lineTo((tips[1].x + tips[2].x) * 0.5 - 2 * zScale, (tips[1].y + tips[2].y) * 0.5 - 2 * zScale);
            ctx.lineTo(tips[2].x, tips[2].y);
            ctx.stroke();
            ctx.restore();
          }

          // Buffed Zombie War Cry Speed Lines (#E040FB 2 speed lines behind body)
          if (z.frenzyTimer > 0) {
            const bPt = Iso.gridToScreen(z.x - m.fx * 0.28 * m.sc - m.px * 0.12 * m.sc, z.y - m.fy * 0.28 * m.sc - m.py * 0.12 * m.sc, 7 * m.sc);
            ctx.save();
            ctx.strokeStyle = 'rgba(224, 64, 251, 0.75)';
            ctx.lineWidth = 1.6 * zScale;
            ctx.beginPath();
            ctx.moveTo(bPt.x - 10 * zScale, bPt.y);
            ctx.lineTo(bPt.x - 2 * zScale, bPt.y - 3 * zScale);
            ctx.moveTo(bPt.x - 7 * zScale, bPt.y + 5 * zScale);
            ctx.lineTo(bPt.x + 1 * zScale, bPt.y + 2 * zScale);
            ctx.stroke();
            ctx.restore();
          }

          // Leaper Leap Trajectory Dotted Arc (#FF8FA3 +26px peak)
          if (z.leapState) {
            const ls = z.leapState;
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255, 143, 163, 0.85)';
            ctx.lineWidth = 1.6 * zScale;
            ctx.beginPath();
            for (let k = 0; k <= 16; k++) {
              const u = k / 16;
              const gx = ls.startX + (ls.targetX - ls.startX) * u;
              const gy = ls.startY + (ls.targetY - ls.startY) * u;
              const gz = 1 + Math.sin(Math.PI * u) * 26;
              const pt = Iso.gridToScreen(gx, gy, gz);
              if (k === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // Boss Siege Charge Windup Target Crosshair (#FF4D6D above target wall/gate)
          if (zDef.isBoss && z.chargeState && z.chargeState.phase === 'windup') {
            const cs = z.chargeState;
            if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(cs.targetX, cs.targetY));
            const cp = Iso.gridToScreen(cs.targetX, cs.targetY, 34);
            if (Iso.setElevationOffset) Iso.setElevationOffset(getElev(z.x, z.y));
            const cr = 9 * zScale;
            ctx.save();
            ctx.strokeStyle = P.danger;
            ctx.lineWidth = 2.2 * zScale;
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, cr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cp.x - 14 * zScale, cp.y);
            ctx.lineTo(cp.x - 5 * zScale, cp.y);
            ctx.moveTo(cp.x + 5 * zScale, cp.y);
            ctx.lineTo(cp.x + 14 * zScale, cp.y);
            ctx.moveTo(cp.x, cp.y - 14 * zScale);
            ctx.lineTo(cp.x, cp.y - 5 * zScale);
            ctx.moveTo(cp.x, cp.y + 5 * zScale);
            ctx.lineTo(cp.x, cp.y + 14 * zScale);
            ctx.stroke();
            ctx.restore();
          }

          if (z.hp < z.maxHp || zDef.isBoss) {
            const hpTop = Iso.gridToScreen(z.x, z.y, m.topZ);
            const bw = (zDef.isBoss ? 42 : 22) * zScale;
            const bh = (zDef.isBoss ? 5.2 : 3.4) * zScale;
            ctx.fillStyle = P.outlineDark || '#1B2430';
            ctx.fillRect(hpTop.x - bw * 0.5 - 1.2, hpTop.y - 1.2, bw + 2.4, bh + 2.4);
            ctx.fillStyle = P.danger;
            ctx.fillRect(hpTop.x - bw * 0.5, hpTop.y, bw * Math.max(0, z.hp / z.maxHp), bh);
          }
        }
      }
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
    }

    // 3. Batched Nighttime Emissive Eye Halos (single composite switch + cached stamp) & Pinpoints
    if (nightEyes.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, state.nightAlpha * 0.85);
      for (let i = 0; i < nightEyes.length; i++) {
        const { eyes, zDef } = nightEyes[i];
        const haloR = (zDef.isBoss ? 12 : 7.5) * eyes.sc * zScale;
        const stamp = R.getEyeHaloStamp(zDef.eyeGlow || 'rgba(255, 77, 109, 0.56)');
        ctx.drawImage(stamp, eyes.cx - haloR, eyes.cy - haloR, haloR * 2, haloR * 2);
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = Math.min(1, state.nightAlpha * 1.15);
      for (let i = 0; i < nightEyes.length; i++) {
        const { eyes, zDef } = nightEyes[i];
        R.drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawCanvasHeartIcon(ctx, cx, cy, size, fillCol, strokeCol) {
    const s = (size || 12) / 24;
    ctx.save();
    ctx.translate(cx - 12 * s, cy - 12 * s);
    ctx.beginPath();
    ctx.moveTo(12 * s, 20 * s);
    ctx.bezierCurveTo(12 * s, 20 * s, 4.5 * s, 15.4 * s, 4.5 * s, 9.8 * s);
    ctx.bezierCurveTo(4.5 * s, 6.8 * s, 7.2 * s, 5.2 * s, 9.8 * s, 5.6 * s);
    ctx.bezierCurveTo(10.9 * s, 5.8 * s, 11.6 * s, 6.4 * s, 12 * s, 7.2 * s);
    ctx.bezierCurveTo(12.4 * s, 6.4 * s, 13.1 * s, 5.8 * s, 14.2 * s, 5.6 * s);
    ctx.bezierCurveTo(16.8 * s, 5.2 * s, 19.5 * s, 6.8 * s, 19.5 * s, 9.8 * s);
    ctx.bezierCurveTo(19.5 * s, 15.4 * s, 12 * s, 20 * s, 12 * s, 20 * s);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (strokeCol) {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = Math.max(2.4, 3.2 * s);
      ctx.stroke();
    }
    ctx.fillStyle = fillCol || '#FFD34D';
    ctx.fill();
    ctx.strokeStyle = fillCol || '#FFD34D';
    ctx.lineWidth = Math.max(1.2, 1.8 * s);
    ctx.stroke();
    ctx.restore();
  }

  function drawCanvasPowerOffIcon(ctx, cx, cy, size, col) {
    const s = (size || 12) / 24;
    ctx.save();
    ctx.translate(cx - 12 * s, cy - 12 * s);
    ctx.strokeStyle = col || '#FF4D6D';
    ctx.lineWidth = Math.max(1.4, 2.1 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(13 * s, 2.5 * s);
    ctx.lineTo(5 * s, 13.5 * s);
    ctx.lineTo(11 * s, 13.5 * s);
    ctx.lineTo(10 * s, 21.5 * s);
    ctx.lineTo(18 * s, 10.5 * s);
    ctx.lineTo(12 * s, 10.5 * s);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3.5 * s, 3.5 * s);
    ctx.lineTo(20.5 * s, 20.5 * s);
    ctx.stroke();
    ctx.restore();
  }

  function drawUpgradePips(ctx, gx, gy, zPos, lv, hasRank, isNight, animTimer, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const c = Iso.gridToScreen(gx, gy, zPos);
    const scale = Math.max(0.82, zScale);
    const rBase = 3.3 * scale;
    const gap = 8 * scale;
    const fill = lv >= 3 ? (P.levelMax || '#FF9F43') : (P.levelPip || '#F2F4F7');
    const stroke = lv >= 3 ? (P.levelMaxStroke || '#5C2E00') : (P.levelPipStroke || '#1B2430');
    const x0 = c.x - ((lv - 1) * gap) * 0.5 + (hasRank ? 7 * scale : 0);

    ctx.save();
    ctx.globalAlpha *= isNight ? 0.70 : 1.0;
    for (let i = 0; i < lv; i++) {
      let r = rBase;
      if (animTimer > 0 && i === lv - 1) {
        const pop = Math.sin(Math.min(1, (0.6 - animTimer) / 0.6) * Math.PI);
        r = rBase * (1 + pop * 0.55);
      }
      const px = x0 + i * gap;
      const py = c.y;
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.0, 1.2 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChevronShape(ctx, cx, cy, s, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx - 5 * s, cy + 1.5 * s);
    ctx.lineTo(cx, cy - 2.5 * s);
    ctx.lineTo(cx + 5 * s, cy + 1.5 * s);
    ctx.lineTo(cx + 5 * s, cy + 4.0 * s);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 5 * s, cy + 4.0 * s);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.0, 1.2 * s);
    ctx.stroke();
  }

  function drawStarShape(ctx, cx, cy, r, fill, stroke, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
      const rr = i % 2 === 1 ? r * 0.45 : r;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.0, 1.2 * s);
    ctx.stroke();
  }

  function drawRankBadge(ctx, gx, gy, zPos, rank, hasPips, promoAnimTimer, zScale) {
    if (!rank || rank < 1) return;
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const c = Iso.gridToScreen(gx, gy, zPos);
    const scale = Math.max(0.82, zScale);
    let popMult = 1.0;
    if (promoAnimTimer > 0) {
      popMult = 1.0 + 0.35 * Math.sin(Math.min(1, (0.8 - promoAnimTimer) / 0.8) * Math.PI);
    }
    const s = scale * popMult;
    const cx = c.x - (hasPips ? 16 * scale : 0);
    const cy = c.y;

    ctx.save();
    if (rank === 1) {
      drawChevronShape(ctx, cx, cy, s, P.rankBronze || '#D08A4E', P.rankBronzeStroke || '#5A3317');
    } else if (rank === 2) {
      // Silver 2-chevron (NEVER cyan)
      drawChevronShape(ctx, cx, cy - 2.6 * s, s, P.rankSilver || '#E3E8EE', P.rankSilverStroke || '#4A5563');
      drawChevronShape(ctx, cx, cy + 2.2 * s, s, P.rankSilver || '#E3E8EE', P.rankSilverStroke || '#4A5563');
    } else if (rank >= 3) {
      drawStarShape(ctx, cx, cy, 6.0 * s, P.rankGold || '#FFD34D', P.rankGoldStroke || '#6B4A00', s);
    }
    ctx.restore();
  }

  function drawFloatingTexts(ctx, list, zScale, viewW, viewH) {
    if (!list || list.length === 0) return;
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const padX = 110 * zScale;
    const padY = 50 * zScale;
    const getElev = (gx, gy) => (ZS.Game && ZS.Game.getTerrainElevationAt ? ZS.Game.getTerrainElevationAt(gx, gy) : 0);
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = 0; i < list.length; i++) {
      const ft = list[i];
      const p = Iso.gridToScreen(ft.x, ft.y, ft.z + getElev(ft.x, ft.y));
      if (p.x < -padX || p.x > vp.w + padX || p.y < -padY || p.y > vp.h + padY) continue;
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.globalAlpha = Math.max(0, alpha);
      const fontPx = Math.max(12, Math.round((ft.size || 12) * Math.min(1.25, Math.max(0.95, zScale))));
      ctx.font = `bold ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
      if (ft.strokeColor) {
        ctx.strokeStyle = ft.strokeColor;
        ctx.lineWidth = 2.2 * Math.min(1.2, zScale);
        ctx.lineJoin = 'round';
        ctx.strokeText(ft.text, p.x, p.y);
      } else {
        ctx.fillStyle = P.outlineDark || 'rgba(0,0,0,0.75)';
        ctx.fillText(ft.text, p.x + 1, p.y + 1);
      }
      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(ft.text, p.x, p.y);
    }
    ctx.restore();
  }

  function renderItemThumbnail(itemId, sizePx, tierOpt) {
    const resolvedId = itemId === 'shelter_pod' ? 'field_tent' : itemId;
    const tier = tierOpt || (itemId === 'shelter_pod' ? 3 : 1);
    const sz = Math.max(24, Math.round(sizePx || 44));
    const key = `${resolvedId}@${sz}@t${tier}`;
    const cached = thumbnailCache.get(key);
    if (cached) return cached;

    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const def = resolvedId === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[resolvedId];
    if (!def) return '';
    if (def.domain === 'underground' && R.renderB1GadgetThumbnail) {
      return R.renderB1GadgetThumbnail(resolvedId, sz);
    }

    const dpr = 2;
    const cv = document.createElement('canvas');
    cv.width = sz * dpr;
    cv.height = sz * dpr;
    const tctx = cv.getContext('2d');
    if (!tctx) return '';
    tctx.scale(dpr, dpr);

    const prevVp = Iso.getViewport();
    const prevCamX = Iso.cam.x;
    const prevCamY = Iso.cam.y;
    const prevZoom = Iso.cam.zoom;
    const prevElev = Iso.getElevationOffset ? Iso.getElevationOffset() : 0;
    const prevEmis = R.emissiveList;

    try {
      if (Iso.setElevationOffset) Iso.setElevationOffset(0);
      Iso.setViewport(sz, sz);
      Iso.resetRenderModifiers();
      Iso.setSceneTint('#FFE8BA', 0.045);
      R.emissiveList = null;

      if (def.layer === 'floor') {
        const zoom = (sz * 0.88) / 68;
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = 17.5;

        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4.5), Iso.gridToScreen(0, 1, -4.5)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4.5), Iso.gridToScreen(1, 1, -4.5)];
        R.drawPolyFace(tctx, l, '#3A3027', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, r, '#2C241D', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, t, '#55705A', 1.0, false, false, zoom);
        R.drawFloorTile(tctx, 0, 0, resolvedId, zoom);
      } else {
        const topZ = resolvedId === 'command_hq' ? 36 : R.getStructVisualTopZ(resolvedId, tier);
        const extraTop = resolvedId === 'wind_turbine' ? (tier >= 3 ? 18 : 6) : 4;
        const wyTop = Math.min(-2, 16 - (topZ + extraTop));
        const wyBot = 38.5;
        const spanY = Math.max(40, wyBot - wyTop);
        const zoom = Math.min((sz * 0.87) / 72, (sz * 0.87) / spanY);
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = (wyTop + wyBot) * 0.5;

        // Miniature diorama turf plinth under structure
        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4.5), Iso.gridToScreen(0, 1, -4.5)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4.5), Iso.gridToScreen(1, 1, -4.5)];
        R.drawPolyFace(tctx, l, '#3A3027', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, r, '#2C241D', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, t, '#55705A', 1.0, false, false, zoom);

        const dummyState = {
          isNight: false,
          nightAlpha: 0,
          hqLevel: 1,
          power: 80,
          powerCap: 100
        };
        const dummySt = {
          id: resolvedId,
          level: tier,
          hp: 100,
          maxHp: 100,
          aimAngle: 0.78,
          isPreview: true,
          previewMask: resolvedId === 'barricade_wall' || resolvedId === 'tactical_gate' ? 10 : undefined
        };
        R.drawStructure(tctx, dummySt, 0, 0, dummyState, true, 0.45, zoom);
      }
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
      Iso.resetRenderModifiers();
      R.emissiveList = prevEmis;
    }

    const url = cv.toDataURL ? cv.toDataURL('image/png') : '';
    if (url) {
      thumbnailCache.set(key, url);
    }
    return url;
  }

  Object.assign(R, {
    drawNightLighting,
    drawReconOverlay,
    drawEmpStunIndicator,
    drawPowerOffPillBadge,
    drawDormantCrewPillBadge,
    drawInfoLayer,
    drawCanvasHeartIcon,
    drawCanvasPowerOffIcon,
    drawUpgradePips,
    drawChevronShape,
    drawStarShape,
    drawRankBadge,
    drawFloatingTexts,
    renderItemThumbnail
  });

  ZS.Renderer = {
    render: R.render,
    renderItemThumbnail: R.renderItemThumbnail,
    renderB1ToolThumbnail: R.renderB1ToolThumbnail,
    renderB1GadgetThumbnail: R.renderB1GadgetThumbnail,
    getStructVisualTopZ: R.getStructVisualTopZ,
    getWallConnectMask: R.getWallConnectMask,
    drawStructure: R.drawStructure,
    drawFloorTile: R.drawFloorTile
  };
})();
