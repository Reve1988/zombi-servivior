window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;
  const { lightCanvas, lightCtx, eyeHaloCache, thumbnailCache } = R;

  function drawNightLighting(ctx, w, h, state, powered, timeSec, zScale) {
    R.ensureLightCanvas(w, h);
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const N = DATA.GRID_SIZE;

    const darkness = state.nightAlpha * (powered ? 0.72 : 0.84);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.clearRect(0, 0, w, h);
    lightCtx.fillStyle = `rgba(7, 13, 25, ${darkness.toFixed(3)})`;
    lightCtx.fillRect(0, 0, w, h);

    lightCtx.globalCompositeOperation = 'destination-out';

    function punchHole(gx, gy, zPx, radiusTiles, strength) {
      const p = Iso.gridToScreen(gx, gy, zPx);
      const rPx = radiusTiles * 36 * zScale;
      const grad = lightCtx.createRadialGradient(p.x, p.y, rPx * 0.08, p.x, p.y, rPx);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(0.65, `rgba(0,0,0,${strength * 0.45})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = grad;
      lightCtx.beginPath();
      lightCtx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
      lightCtx.fill();
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

    const illuminateNode = (node, gx, gy, lz, isMounted) => {
      const def = DATA.ITEMS[node.id];
      if (!def) return;
      if (def.requiresPower && (!powered || (node.empStunTimer || 0) > 0)) return;
      const prof = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, node.level || 1) : null;
      const eff = isMounted && ZS.Game.getStructureEffectiveStats
        ? ZS.Game.getStructureEffectiveStats(node, gx, gy, undefined, true)
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
        illuminateNode(st, x, y, 12, false);
        if (st.mounted) {
          const mBaseZ = (st.level || 2) >= 3 ? 25.4 : 15.2;
          illuminateNode(st.mounted, x, y, mBaseZ + 12, true);
        }
      }
    }

    // Active flares & explosions illuminate the battlefield
    for (let i = 0; i < state.flares.length; i++) {
      const fl = state.flares[i];
      punchHole(fl.x, fl.y, 8, fl.radius, 0.96);
      colorGlows.push({
        gx: fl.x,
        gy: fl.y,
        z: 8,
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

    ctx.drawImage(lightCanvas, 0, 0);

    // Cold deep-navy exterior rim vignette around outer perimeter to heighten temperature contrast
    const islandCenter = Iso.gridToScreen(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 6);
    const innerR = N * 11 * zScale;
    const outerR = Math.max(w, h) * 0.68;
    if (outerR > innerR + 10) {
      ctx.save();
      const coldRim = ctx.createRadialGradient(islandCenter.x, islandCenter.y, innerR, islandCenter.x, islandCenter.y, outerR);
      coldRim.addColorStop(0, 'rgba(10, 22, 48, 0)');
      coldRim.addColorStop(0.6, `rgba(12, 26, 56, ${(0.22 * state.nightAlpha).toFixed(3)})`);
      coldRim.addColorStop(1, `rgba(5, 11, 26, ${(0.42 * state.nightAlpha).toFixed(3)})`);
      ctx.fillStyle = coldRim;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Subtle colored atmospheric bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < colorGlows.length; i++) {
      const g = colorGlows[i];
      const p = Iso.gridToScreen(g.gx, g.gy, g.z);
      const rPx = g.r * 34 * zScale;
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, rPx);
      grad.addColorStop(0, g.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = state.nightAlpha * 0.60;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
    const ENTRY_IDX = [5, 11, 16];

    ctx.save();

    // 1. Dijkstra flow preview path lines (z = 1.5, segment deduplicated, flowing toward HQ)
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
            Iso.gridToScreen(a.x + 0.5, a.y + 0.5, 1.5),
            Iso.gridToScreen(b.x + 0.5, b.y + 0.5, 1.5)
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
      for (let bi = 0; bi < breaches.length; bi++) {
        const bm = breaches[bi];
        const bSt = state.structGrid[bm.ty] && state.structGrid[bm.ty][bm.tx];
        if (!bSt) continue;
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

    // 4. Boss spawn direction icon (z = 22 at midpoint idx = 11)
    if (intel.bossSide != null) {
      const bPos = SIDE_POS[intel.bossSide](11);
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

  function drawInfoLayer(ctx, state, uiState, renderList, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;

    drawReconOverlay(ctx, state, timeSec, zScale);

    ctx.save();

    // 1. Selected / Inspected Tile Border (crisp above night darkness without cutting through 3D structures)
    if (state.phase === 'day' && uiState.mode === 'build' && uiState.selectedItemId && uiState.hoverTile && ZS.Game.getPlacementCozyPreview) {
      const htx = uiState.hoverTile.tx;
      const hty = uiState.hoverTile.ty;
      if (htx >= 0 && hty >= 0 && htx < N && hty < N) {
        const cPrev = ZS.Game.getPlacementCozyPreview(uiState.selectedItemId, htx, hty);
        if (cPrev && (cPrev.isDiminished || cPrev.isFloorCapped || cPrev.gain > 0)) {
          const p = Iso.gridToScreen(htx + 0.5, hty + 0.5, 26);
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
      }
    }

    // 2. Depth-sorted Structure HP Bars, Power-OFF Warnings, and Zombie HP Bars
    const nightEyes = [];
    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        const st = item.st;
        const tx = item.tx;
        const ty = item.ty;
        const id = st.id;
        const def = id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[id];
        const lv = st.level || 1;
        const isWall = id === 'barricade_wall' || (def && def.subType === 'wall');
        const wallMask = isWall ? R.getWallConnectMask(state.structGrid, tx, ty) : 0;
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
          if (isMountUnpowered) {
            const warnZ = showDualHp ? dualHpZ + 13 : topZ + (hasPips || hasRank ? 19 : 11);
            drawPowerOffPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P);
          } else if (isMountEmpStunned) {
            const empZ = showDualHp ? dualHpZ + 8 : topZ + (hasPips || hasRank ? 14 : 6);
            drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, m.empStunTimer || 0, timeSec, badgeScaleCap, zScale, P);
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
          if (isUnpowered) {
            const warnZ = isDamaged ? 35 : 29;
            drawPowerOffPillBadge(ctx, tx + 0.5, ty + 0.5, warnZ, zScale, P);
          } else if (isEmpStunned) {
            const empZ = Math.max(topZ + (hasPips || hasRank ? 12 : 4), isDamaged ? 32 : 24);
            drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, st.empStunTimer || 0, timeSec, Math.max(1.0, Math.min(1.65, zScale)), zScale, P);
          }
        }
      } else if (item.kind === 'zombie') {
        const z = item.z;
        const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;
        const m = R.getZombiePoseMetrics(z, zDef, timeSec);

        if (state.nightAlpha > 0.05) {
          const eyes = R.getZombieEyePositions(z, zDef, timeSec, zScale);
          if (!R.isZombieEyesOccluded(state, z, eyes, zScale)) {
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
            const pt = Iso.gridToScreen(
              ls.startX + (ls.targetX - ls.startX) * u,
              ls.startY + (ls.targetY - ls.startY) * u,
              1 + Math.sin(Math.PI * u) * 26
            );
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
          const cp = Iso.gridToScreen(cs.targetX, cs.targetY, 34);
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
    ctx.globalAlpha = isNight ? 0.70 : 1.0;
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

  function drawFloatingTexts(ctx, list, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = 0; i < list.length; i++) {
      const ft = list[i];
      const p = Iso.gridToScreen(ft.x, ft.y, ft.z);
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
    const prevEmis = R.emissiveList;

    try {
      Iso.setViewport(sz, sz);
      Iso.resetRenderModifiers();
      Iso.setSceneTint('#FFE8BA', 0.045);
      R.emissiveList = null;

      if (def.layer === 'floor') {
        const zoom = (sz / 82) * 1.02;
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = Iso.TILE_H * 0.5 - 1.5;

        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4.5), Iso.gridToScreen(0, 1, -4.5)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4.5), Iso.gridToScreen(1, 1, -4.5)];
        R.drawPolyFace(tctx, l, '#3A3027', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, r, '#2C241D', 1.0, false, false, zoom);
        R.drawPolyFace(tctx, t, '#55705A', 1.0, false, false, zoom);
        R.drawFloorTile(tctx, 0, 0, resolvedId, zoom);
      } else {
        const topZ = resolvedId === 'command_hq' ? 36 : R.getStructVisualTopZ(resolvedId, tier);
        const extraTop = resolvedId === 'wind_turbine' && tier >= 3 ? 14 : 3;
        const spanY = Math.max(44, topZ + extraTop + 22);
        const zoom = Math.min((sz * 0.88) / 72, (sz * 0.88) / spanY);
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = Iso.TILE_H * 0.5 - (topZ + extraTop - 16) * 0.5;

        // Miniature diorama turf plinth under structure
        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4), Iso.gridToScreen(0, 1, -4)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4), Iso.gridToScreen(1, 1, -4)];
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
    getStructVisualTopZ: R.getStructVisualTopZ,
    getWallConnectMask: R.getWallConnectMask,
    drawStructure: R.drawStructure,
    drawFloorTile: R.drawFloorTile
  };
})();
