window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;
  const STAMP_SCALE = 3.0;
  const STAMP_CACHE_MAX = 512;
  const structStampCache = new Map();
  R.structStampCache = structStampCache;

  const getTintBucket = R.getTintBucket;

  function isNodeAnimatingOrFlashing(node) {
    return !!(
      node &&
      (node.isPreview ||
        (node.hitFlash || 0) > 0.001 ||
        (node.buildAnimTimer || 0) > 0 ||
        (node.upgradeAnimTimer || 0) > 0 ||
        (node.fallAnimTimer || 0) > 0)
    );
  }

  function ensureStructureStamp(key, topZ, tintBucket, isSil, bakeFn) {
    const hit = structStampCache.get(key);
    if (hit) {
      structStampCache.delete(key);
      structStampCache.set(key, hit);
      R.stampCacheHits += 1;
      return hit;
    }

    const logicalW = 96;
    const anchorX = 48;
    const anchorY = Math.max(48, Math.ceil((topZ || 24) + 24));
    const logicalH = anchorY + 46;
    const stamp = R.bakeSpriteStamp(logicalW, logicalH, STAMP_SCALE, anchorX, anchorY, tintBucket, isSil, bakeFn);
    if (structStampCache.size >= STAMP_CACHE_MAX) {
      const oldestKey = structStampCache.keys().next().value;
      if (oldestKey !== undefined) structStampCache.delete(oldestKey);
    }
    structStampCache.set(key, stamp);
    R.stampCacheBakes += 1;
    return stamp;
  }

  function blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil) {
    R.blitSpriteStamp(ctx, stamp, tx, ty, zScale, isSil, true);
  }

  const WALL_PIECES = {
    post: [0.30, 0.30, 0.40, 0.40],
    N: [0.32, 0, 0.36, 0.30],
    S: [0.32, 0.70, 0.36, 0.30],
    W: [0, 0.32, 0.30, 0.36],
    E: [0.70, 0.32, 0.30, 0.36],
    iso: [0.18, 0.31, 0.64, 0.38]
  };

  function isWallConnectableCell(structGrid, tx, ty) {
    const s = structGrid && structGrid[ty] && structGrid[ty][tx];
    if (!s || s.hp <= 0) return false;
    const def = ZS.DATA.ITEMS[s.id];
    return !!(def && (def.subType === 'wall' || def.subType === 'gate'));
  }

  function getWallConnectMask(structGrid, tx, ty) {
    if (!structGrid) return 0;
    return (
      (isWallConnectableCell(structGrid, tx, ty - 1) ? 1 : 0) |
      (isWallConnectableCell(structGrid, tx + 1, ty) ? 2 : 0) |
      (isWallConnectableCell(structGrid, tx, ty + 1) ? 4 : 0) |
      (isWallConnectableCell(structGrid, tx - 1, ty) ? 8 : 0)
    );
  }

  function drawWireXFrame(ctx, cx, cy, crossAxis, P, zScale) {
    const Iso = ZS.Iso;
    const sand = P.milSand || '#B7A179';
    const sandDark = P.milSandDark || '#8F7B56';
    const iron = P.milGunmetal || '#3B4552';
    const steel = P.milSteelTrim || '#8A96A4';
    if (crossAxis === 'y') {
      // Compact sandbag/concrete anchor blocks at picket feet
      R.drawDetailedIsoBox(ctx, cx - 0.065, cy - 0.21, 0, 0.13, 0.10, 2.2, sand, { bevel: true, groundCrease: true }, zScale);
      R.drawDetailedIsoBox(ctx, cx - 0.065, cy + 0.11, 0, 0.13, 0.10, 2.2, sand, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoBox(ctx, cx - 0.035, cy - 0.19, 1.8, 0.07, 0.07, 1.0, iron, null, zScale);
      R.drawIsoBox(ctx, cx - 0.035, cy + 0.12, 1.8, 0.07, 0.07, 1.0, iron, null, zScale);
      // Angled steel X-pickets (eliminating railroad-tie illusion)
      R.drawIsoLine(ctx, Iso.gridToScreen(cx, cy - 0.16, 1.8), Iso.gridToScreen(cx, cy + 0.15, 10.6), iron, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx, cy + 0.16, 1.8), Iso.gridToScreen(cx, cy - 0.15, 10.6), iron, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx, cy - 0.16, 2.1), Iso.gridToScreen(cx, cy + 0.15, 10.7), steel, 0.9, false, zScale);
    } else {
      R.drawDetailedIsoBox(ctx, cx - 0.21, cy - 0.065, 0, 0.10, 0.13, 2.2, sand, { bevel: true, groundCrease: true }, zScale);
      R.drawDetailedIsoBox(ctx, cx + 0.11, cy - 0.065, 0, 0.10, 0.13, 2.2, sand, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoBox(ctx, cx - 0.19, cy - 0.035, 1.8, 0.07, 0.07, 1.0, iron, null, zScale);
      R.drawIsoBox(ctx, cx + 0.12, cy - 0.035, 1.8, 0.07, 0.07, 1.0, iron, null, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx - 0.16, cy, 1.8), Iso.gridToScreen(cx + 0.15, cy, 10.6), iron, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx + 0.16, cy, 1.8), Iso.gridToScreen(cx - 0.15, cy, 10.6), iron, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx - 0.16, cy, 2.1), Iso.gridToScreen(cx + 0.15, cy, 10.7), steel, 0.9, false, zScale);
    }
    R.drawDetailedIsoBox(ctx, cx - 0.05, cy - 0.05, 5.1, 0.10, 0.10, 1.7, sandDark, { bevel: true }, zScale);
    R.drawIsoDot(ctx, Iso.gridToScreen(cx, cy, 6.2), 1.1, steel, false, zScale);
  }

  function drawWireHub(ctx, tx, ty, P, zScale) {
    const Iso = ZS.Iso;
    const sand = P.milSand || '#B7A179';
    const iron = P.milGunmetal || '#3B4552';
    const steel = P.milSteelTrim || '#8A96A4';
    R.drawDetailedIsoBox(ctx, tx + 0.36, ty + 0.36, 0, 0.28, 0.28, 2.6, sand, { bevel: true, groundCrease: true }, zScale);
    R.drawSandbagCoursesOnBox(ctx, tx + 0.36, ty + 0.36, 0, 0.28, 0.28, 2.6, 2, 2, 2, P.milSandSeam, false, zScale);
    R.drawDetailedIsoBox(ctx, tx + 0.425, ty + 0.425, 2.6, 0.15, 0.15, 8.0, iron, { bevel: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.415, ty + 0.415, 5.6, 0.17, 0.17, 1.5, steel, null, zScale);
    R.drawIsoCornerRivets(ctx, tx + 0.425, ty + 0.425, 10.6, 0.15, 0.15, 0.03, 0.8, '#DCE5EE', zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.36, ty + 0.64, 1.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), iron, 1.9, true, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.64, ty + 0.36, 1.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), iron, 1.9, true, zScale);
  }

  function drawWireCoilSpan(ctx, tx, ty, axis, t0, t1, loops, P, zScale) {
    const Iso = ZS.Iso;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const span = t1 - t0;
    const denseLoops = Math.max(loops + 2, Math.round(span * 11));
    const du = span / denseLoops;

    const ptAt = (u, a, rr, zc, rz, offLat) =>
      axis === 'x'
        ? Iso.gridToScreen(tx + u, ty + 0.5 + (offLat || 0) + rr * Math.cos(a), zc + rz * Math.sin(a))
        : Iso.gridToScreen(tx + 0.5 + (offLat || 0) + rr * Math.cos(a), ty + u, zc + rz * Math.sin(a));

    const drawHalf = (uStart, a0, a1, steps, phaseOff, rr, zc, rz, offLat, strokeHex, widthPx, withOutline) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const a = a0 + (a1 - a0) * f;
        const u = Math.min(t1, Math.max(t0, uStart + (phaseOff + f * 0.5) * du));
        const p = ptAt(u, a, rr, zc, rz, offLat);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      if (withOutline && !isSil) {
        ctx.strokeStyle = 'rgba(10, 14, 20, 0.52)';
        ctx.lineWidth = (widthPx + 0.9) * zScale;
        ctx.stroke();
      }
      ctx.strokeStyle = Iso.resolveFaceColor(strokeHex, 1.0, false, 0) || strokeHex;
      ctx.lineWidth = widthPx * zScale;
      ctx.stroke();
    };

    const coilDim = P.wireCoilDim || '#6E7B88';
    const coilCol = P.wireCoil || '#BAC6D2';
    const barbCol = P.wireBarb || '#DCE5EE';
    const iron = P.milGunmetal || '#3B4552';

    // Thin tensioned steel spine wire (no thick wooden beam that looked like a railroad track)
    const w0 = axis === 'x' ? Iso.gridToScreen(tx + t0, ty + 0.5, 5.8) : Iso.gridToScreen(tx + 0.5, ty + t0, 5.8);
    const w1 = axis === 'x' ? Iso.gridToScreen(tx + t1, ty + 0.5, 5.8) : Iso.gridToScreen(tx + 0.5, ty + t1, 5.8);
    R.drawIsoLine(ctx, w0, w1, iron, 1.15, false, zScale);

    // Back-side concertina arcs (lower twin-roll + upper crown roll)
    for (let i = 0; i < denseLoops; i++) {
      const uS = t0 + i * du;
      drawHalf(uS, 0.72 * Math.PI, 1.72 * Math.PI, 6, 0.0, 0.115, 3.8, 2.7, -0.045, coilDim, 1.05, false);
      drawHalf(uS, 0.72 * Math.PI, 1.72 * Math.PI, 6, 0.25, 0.145, 6.4, 3.8, 0.015, coilDim, 1.15, false);
    }

    // Front-side razor concertina arcs + sharp glinting razor-barb X-nodes
    for (let i = 0; i < denseLoops; i++) {
      const uStart = t0 + i * du;
      drawHalf(uStart, -0.28 * Math.PI, 0.72 * Math.PI, 6, 0.25, 0.115, 3.8, 2.7, 0.045, '#9AA8B6', 1.15, false);
      drawHalf(uStart, -0.28 * Math.PI, 0.72 * Math.PI, 7, 0.5, 0.148, 6.4, 3.9, 0.0, coilCol, 1.4, true);

      if (!isSil && i % 2 === 0) {
        const barbAngles = [0.50 * Math.PI, 0.08 * Math.PI];
        for (let bi = 0; bi < barbAngles.length; bi++) {
          const ba = barbAngles[bi];
          const f = (ba + 0.28 * Math.PI) / Math.PI;
          const u = Math.min(t1, Math.max(t0, uStart + (0.5 + f * 0.5) * du));
          const bp = ptAt(u, ba, 0.148, 6.4, 3.9, 0.0);
          const d = 1.9 * zScale;
          ctx.strokeStyle = Iso.resolveFaceColor(barbCol, 1.0, false, 0) || barbCol;
          ctx.lineWidth = 1.05 * zScale;
          ctx.beginPath();
          ctx.moveTo(bp.x - d, bp.y - d * 0.65);
          ctx.lineTo(bp.x + d, bp.y + d * 0.65);
          ctx.moveTo(bp.x - d, bp.y + d * 0.65);
          ctx.lineTo(bp.x + d, bp.y - d * 0.65);
          ctx.stroke();
        }
      }
    }
  }

  function drawWireWallTile(ctx, tx, ty, mask, P, zScale) {
    if (mask === 0) {
      drawWireXFrame(ctx, tx + 0.24, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.16, 0.84, 5, P, zScale);
      drawWireXFrame(ctx, tx + 0.76, ty + 0.50, 'y', P, zScale);
      return;
    }
    if (mask === 10) {
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.00, 0.26, 2, P, zScale);
      drawWireXFrame(ctx, tx + 0.26, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.26, 0.74, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.74, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.74, 1.00, 2, P, zScale);
      return;
    }
    if (mask === 5) {
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.00, 0.26, 2, P, zScale);
      drawWireXFrame(ctx, tx + 0.50, ty + 0.26, 'x', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.26, 0.74, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.50, ty + 0.74, 'x', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.74, 1.00, 2, P, zScale);
      return;
    }
    if (mask === 1) {
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.00, 0.24, 2, P, zScale);
      drawWireXFrame(ctx, tx + 0.50, ty + 0.24, 'x', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.24, 0.62, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.50, ty + 0.62, 'x', P, zScale);
      return;
    }
    if (mask === 4) {
      drawWireXFrame(ctx, tx + 0.50, ty + 0.38, 'x', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.38, 0.76, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.50, ty + 0.76, 'x', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'y', 0.76, 1.00, 2, P, zScale);
      return;
    }
    if (mask === 8) {
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.00, 0.24, 2, P, zScale);
      drawWireXFrame(ctx, tx + 0.24, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.24, 0.62, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.62, ty + 0.50, 'y', P, zScale);
      return;
    }
    if (mask === 2) {
      drawWireXFrame(ctx, tx + 0.38, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.38, 0.76, 3, P, zScale);
      drawWireXFrame(ctx, tx + 0.76, ty + 0.50, 'y', P, zScale);
      drawWireCoilSpan(ctx, tx, ty, 'x', 0.76, 1.00, 2, P, zScale);
      return;
    }
    if (mask & 1) drawWireCoilSpan(ctx, tx, ty, 'y', 0.00, 0.45, 3, P, zScale);
    if (mask & 8) drawWireCoilSpan(ctx, tx, ty, 'x', 0.00, 0.45, 3, P, zScale);
    drawWireHub(ctx, tx, ty, P, zScale);
    if (mask & 2) drawWireCoilSpan(ctx, tx, ty, 'x', 0.55, 1.00, 3, P, zScale);
    if (mask & 4) drawWireCoilSpan(ctx, tx, ty, 'y', 0.55, 1.00, 3, P, zScale);
  }

  function drawHescoPiece(ctx, x, y, w, d, h, lv, skipCap, steelCol, maxAccent, zScale, isPost) {
    const P = ZS.DATA.PALETTE;
    const sand = P.milSand || '#B7A179';
    const sandTop = P.milSandDark || '#8F7B56';
    const gunmetal = P.milGunmetal || '#3B4552';
    const slate = P.milSlate || '#525E6B';

    if (isPost) {
      // Heavy dark gunmetal/concrete fortress bastion post (matches concept art corner & rhythm pillars!)
      R.drawDetailedIsoBox(ctx, x - 0.012, y - 0.012, 0, w + 0.024, d + 0.024, 2.2, '#2B333D', { bevel: true, groundCrease: true }, zScale);
      R.drawDetailedIsoBox(ctx, x, y, 2.2, w, d, h - 3.6, gunmetal, { bevel: true }, zScale);
      R.drawIsoFaceSeams(ctx, 'left', x, y, 2.4, w, d, h - 3.8, 2, 'rgba(10, 14, 20, 0.42)', zScale);
      R.drawIsoFaceSeams(ctx, 'right', x, y, 2.4, w, d, h - 3.8, 2, 'rgba(10, 14, 20, 0.42)', zScale);
      // Mid steel reinforcement collar
      R.drawIsoBox(ctx, x - 0.008, y - 0.008, 6.4, w + 0.016, d + 0.016, 1.8, slate, { noTop: true }, zScale);
      if (!skipCap) {
        R.drawDetailedIsoBox(ctx, x - 0.014, y - 0.014, h - 1.4, w + 0.028, d + 0.028, 1.4, slate, { bevel: true }, zScale);
        R.drawDetailedIsoBox(ctx, x + 0.035, y + 0.035, h, w - 0.07, d - 0.07, 0.55, '#687686', { bevel: true }, zScale);
        R.drawIsoCornerRivets(ctx, x - 0.01, y - 0.01, h, w + 0.02, d + 0.02, 0.045, 0.85, '#DCE5EE', zScale);
      } else {
        R.drawDetailedIsoBox(ctx, x - 0.01, y - 0.01, h - 1.4, w + 0.02, d + 0.02, 1.4, slate, { bevel: true }, zScale);
      }
      return;
    }

    // Stacked desert-sand sandbag wall span inside galvanized wire-mesh HESCO cage + light sandbag crown (distinct from dark gunmetal corner posts!)
    R.drawDetailedIsoBox(ctx, x - 0.008, y - 0.008, 0, w + 0.016, d + 0.016, 1.15, gunmetal, { bevel: false, groundCrease: true }, zScale);
    const bagH = h - 1.55;
    R.drawDetailedIsoBox(ctx, x, y, 1.15, w, d, bagH, sand, { bevel: true, topHex: '#C8B48B', gradDrop: 0.11 }, zScale);
    R.drawSandbagCoursesOnBox(ctx, x, y, 1.15, w, d, bagH, 4, Math.max(2, Math.round(w * 6)), Math.max(2, Math.round(d * 6)), '#5A4A2E', true, zScale);

    // Thin galvanized steel cage rim collar + top sandbag seam lines
    R.drawIsoBox(ctx, x - 0.006, y - 0.006, h - 0.9, w + 0.012, d + 0.012, 0.5, '#7E8C9A', { noTop: true }, zScale);
    R.drawIsoFaceSeams(ctx, 'topX', x, y, 1.15, w, d, bagH, Math.max(2, Math.round(w * 5)), 'rgba(70, 56, 34, 0.34)', zScale);
    R.drawIsoFaceSeams(ctx, 'topY', x, y, 1.15, w, d, bagH, Math.max(2, Math.round(d * 5)), 'rgba(70, 56, 34, 0.28)', zScale);
    R.drawIsoBox(ctx, x + 0.04, y + 0.04, h - 0.4, w - 0.08, d - 0.08, 0.35, sandTop, null, zScale);

    if (lv >= 3 && !skipCap) {
      R.drawIsoBox(ctx, x - 0.005, y - 0.005, h + 0.6, w + 0.01, d + 0.01, 1.2, maxAccent, { noTop: true }, zScale);
      R.drawDetailedIsoBox(ctx, x, y, h + 1.8, w, d, 2.4, steelCol, { bevel: true }, zScale);
    }
  }

  function drawBlastSlab(ctx, x, y, w, d, z0, z1, H, I, axis, hex, top, zScale, groundCrease) {
    const ix = axis === 'x' ? 0 : 1;
    const iy = axis === 'y' ? 0 : 1;
    const i0 = (I * z0) / H;
    const i1 = (I * z1) / H;
    R.drawDetailedFrustum(
      ctx,
      x + i0 * ix,
      y + i0 * iy,
      z0,
      w - 2 * i0 * ix,
      d - 2 * i0 * iy,
      z1 - z0,
      0,
      hex,
      {
        ix: (i1 - i0) * ix,
        iy: (i1 - i0) * iy,
        noTop: !top,
        bevel: !!top,
        groundCrease: !!groundCrease
      },
      zScale
    );
  }

  function drawBlastPiece(ctx, x, y, w, d, axis, lv, skipCap, steelCol, maxAccent, zScale, isPost) {
    const P = ZS.DATA.PALETTE;
    const gunmetal = P.milGunmetal || '#3B4552';
    const slate = P.milSlate || '#525E6B';
    const armorBody = '#606C7A';
    const H = 24;
    const I = isPost ? 0.045 : 0.08;

    if (isPost) {
      // Heavy reinforced alloy bastion corner/center post
      R.drawDetailedIsoBox(ctx, x - 0.014, y - 0.014, 0, w + 0.028, d + 0.028, 3.6, '#272F39', { bevel: true, groundCrease: true }, zScale);
      R.drawIsoHazardBand(ctx, x - 0.008, y - 0.008, 3.6, w + 0.016, d + 0.016, 2.8, '#DFAC2E', '#232B35', 3, zScale);
      R.drawDetailedFrustum(ctx, x, y, 6.4, w, d, H - 6.4, I, gunmetal, { bevel: skipCap, noTop: false }, zScale);
      R.drawIsoFaceSeams(ctx, 'left', x + I * 0.5, y, 7.0, w - I, d - I * 0.5, H - 8.0, 2, 'rgba(10, 14, 20, 0.45)', zScale);
      R.drawIsoFaceSeams(ctx, 'right', x, y + I * 0.5, 7.0, w - I * 0.5, d - I, H - 8.0, 2, 'rgba(10, 14, 20, 0.45)', zScale);
      R.drawIsoBox(ctx, x + I * 0.4 - 0.008, y + I * 0.4 - 0.008, 14.2, w - I * 0.8 + 0.016, d - I * 0.8 + 0.016, 2.2, steelCol, { noTop: true }, zScale);
      if (!skipCap) {
        R.drawIsoBox(ctx, x + I - 0.006, y + I - 0.006, H, w - 2 * I + 0.012, d - 2 * I + 0.012, 1.3, maxAccent, { noTop: true }, zScale);
        R.drawDetailedIsoBox(ctx, x + I - 0.01, y + I - 0.01, H + 1.3, w - 2 * I + 0.02, d - 2 * I + 0.02, 2.4, slate, { bevel: true }, zScale);
        R.drawIsoCornerRivets(ctx, x + I - 0.01, y + I - 0.01, H + 3.7, w - 2 * I + 0.02, d - 2 * I + 0.02, 0.045, 0.9, '#E2EBF3', zScale);
      }
      return;
    }

    // Sloped composite alloy armor wall span with hazard band, armor seams & rivets
    drawBlastSlab(ctx, x, y, w, d, 0, 4.2, H, I, axis, gunmetal, false, zScale, true);
    const ix4 = axis === 'x' ? 0 : (I * 4.2) / H;
    const iy4 = axis === 'y' ? 0 : (I * 4.2) / H;
    R.drawIsoHazardBand(ctx, x + ix4, y + iy4, 4.2, w - 2 * ix4, d - 2 * iy4, 3.0, '#DFAC2E', '#232B35', 3, zScale);
    drawBlastSlab(ctx, x, y, w, d, 7.2, 13.5, H, I, axis, armorBody, false, zScale, false);
    drawBlastSlab(ctx, x, y, w, d, 13.5, 16.0, H, I, axis, steelCol, false, zScale, false);
    drawBlastSlab(ctx, x, y, w, d, 16.0, H, H, I, axis, armorBody, true, zScale, false);

    if (lv >= 3 && !skipCap) {
      const ix = axis === 'x' ? 0 : I;
      const iy = axis === 'y' ? 0 : I;
      R.drawIsoBox(ctx, x + ix - 0.004, y + iy - 0.004, H, w - 2 * ix + 0.008, d - 2 * iy + 0.008, 1.3, maxAccent, { noTop: true }, zScale);
      R.drawDetailedIsoBox(ctx, x + ix, y + iy, H + 1.3, w - 2 * ix, d - 2 * iy, 2.4, steelCol, { bevel: true }, zScale);
      R.drawIsoCornerRivets(ctx, x + ix, y + iy, H + 3.7, w - 2 * ix, d - 2 * iy, 0.038, 0.8, '#E2EBF3', zScale);
    }
  }

  function drawConnectedWallTile(ctx, tx, ty, mask, tier, mounted, P, steelCol, maxAccent, zScale) {
    if (tier <= 1) {
      drawWireWallTile(ctx, tx, ty, mask, P, zScale);
      return;
    }
    const isHesco = tier === 2;
    if (mask === 0) {
      if (isHesco) {
        drawHescoPiece(ctx, tx + 0.14, ty + 0.31, 0.24, 0.38, 13.2, tier, !!mounted, steelCol, maxAccent, zScale, false);
        drawHescoPiece(ctx, tx + 0.38, ty + 0.29, 0.24, 0.42, 14.0, tier, !!mounted, steelCol, maxAccent, zScale, true);
        drawHescoPiece(ctx, tx + 0.62, ty + 0.31, 0.24, 0.38, 13.2, tier, !!mounted, steelCol, maxAccent, zScale, false);
      } else {
        const r = WALL_PIECES.iso;
        drawBlastPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], 'both', tier, !!mounted, steelCol, maxAccent, zScale, false);
      }
      return;
    }

    const order = [];
    if (mask & 1) order.push(['N', 'y']);
    if (mask & 8) order.push(['W', 'x']);
    const postAxis = mask === 10 ? 'x' : mask === 5 ? 'y' : 'both';
    order.push(['post', postAxis]);
    if (mask & 2) order.push(['E', 'x']);
    if (mask & 4) order.push(['S', 'y']);

    // Straight spans (mask === 10 or mask === 5) use sandbag span for smooth continuous wall + slim gunmetal rib,
    // while corners, T-junctions, ends, and mounted walls use full gunmetal bastion posts!
    const isCornerOrEndOrMount = !!mounted || (mask !== 10 && mask !== 5);

    for (let i = 0; i < order.length; i++) {
      const k = order[i][0];
      const axis = order[i][1];
      const r = WALL_PIECES[k];
      if (isHesco) {
        if (k === 'post') {
          if (isCornerOrEndOrMount) {
            drawHescoPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], 14.0, tier, !!mounted, steelCol, maxAccent, zScale, true);
          } else {
            // Straight run: continuous sandbag body with crisp narrow gunmetal divider post rib (matches concept art wall!)
            drawHescoPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], 13.2, tier, false, steelCol, maxAccent, zScale, false);
            if (mask === 10) {
              R.drawDetailedIsoBox(ctx, tx + 0.46, ty + 0.295, 0, 0.08, 0.41, 13.8, P.milGunmetal || '#3B4552', { bevel: true }, zScale);
            } else {
              R.drawDetailedIsoBox(ctx, tx + 0.295, ty + 0.46, 0, 0.41, 0.08, 13.8, P.milGunmetal || '#3B4552', { bevel: true }, zScale);
            }
          }
        } else {
          drawHescoPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], 13.2, tier, false, steelCol, maxAccent, zScale, false);
        }
      } else {
        drawBlastPiece(
          ctx,
          tx + r[0],
          ty + r[1],
          r[2],
          r[3],
          axis,
          tier,
          !!(mounted && k === 'post'),
          steelCol,
          maxAccent,
          zScale,
          k === 'post' && isCornerOrEndOrMount
        );
      }
    }
  }

  function drawTacticalGateTile(ctx, tx, ty, mask, lv, P, steelCol, zScale) {
    const Iso = ZS.Iso;
    const alongY = Boolean((mask & 5) && !(mask & 10));
    if (lv <= 1) {
      const wood = P.wireWood || '#8B6843';
      const woodDark = P.wireWoodDark || '#5E452B';
      const iron = P.wireIron || '#4A5562';
      const coil = P.wireCoil || '#BAC6D2';
      const coilDim = P.wireCoilDim || '#6E7B88';
      const barb = P.wireBarb || '#DCE5EE';
      const woodPost = (px, py, pw, pd) => {
        R.drawIsoBox(ctx, px, py, 0, pw, pd, 3.0, woodDark, null, zScale);
        R.drawIsoBox(ctx, px, py, 3.0, pw, pd, 12.2, wood, null, zScale);
        R.drawIsoBox(ctx, px - 0.004, py - 0.004, 11.4, pw + 0.008, pd + 0.008, 1.4, iron, { noTop: true }, zScale);
        R.drawIsoBox(ctx, px + 0.02, py + 0.02, 15.2, pw - 0.04, pd - 0.04, 1.2, '#F0BD35', null, zScale);
      };
      const uprightCoil = (gx, gy, zc, alongX) => {
        const steps = 10;
        const rx = 0.08;
        const rz = 3.2;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < steps; i++) {
            const a0 = (i / steps) * Math.PI * 2;
            const a1 = ((i + 1) / steps) * Math.PI * 2;
            const s0 = Math.sin(a0);
            const s1 = Math.sin(a1);
            const isFront = s0 + s1 >= 0;
            if ((pass === 0 && isFront) || (pass === 1 && !isFront)) continue;
            const p0 = alongX
              ? Iso.gridToScreen(gx + Math.cos(a0) * rx, gy + s0 * 0.03, zc + s0 * rz)
              : Iso.gridToScreen(gx + s0 * 0.03, gy + Math.cos(a0) * rx, zc + s0 * rz);
            const p1 = alongX
              ? Iso.gridToScreen(gx + Math.cos(a1) * rx, gy + s1 * 0.03, zc + s1 * rz)
              : Iso.gridToScreen(gx + s1 * 0.03, gy + Math.cos(a1) * rx, zc + s1 * rz);
            R.drawIsoRibbon(ctx, p0, p1, isFront ? 0.85 : 0.7, isFront ? coil : coilDim, false, zScale);
          }
        }
        R.drawIsoDot(ctx, Iso.gridToScreen(gx, gy, zc + rz + 0.4), 1.0, barb, false, zScale);
      };
      if (!alongY) {
        woodPost(tx + 0.02, ty + 0.34, 0.18, 0.32);
        R.drawIsoBox(ctx, tx + 0.20, ty + 0.46, 0.6, 0.60, 0.08, 1.2, woodDark, null, zScale);
        R.drawIsoBox(ctx, tx + 0.20, ty + 0.46, 8.6, 0.60, 0.08, 1.2, wood, null, zScale);
        R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.22, ty + 0.50, 1.8), Iso.gridToScreen(tx + 0.78, ty + 0.50, 8.4), woodDark, 1.6, true, zScale);
        R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.22, ty + 0.50, 8.4), Iso.gridToScreen(tx + 0.78, ty + 0.50, 1.8), woodDark, 1.6, true, zScale);
        const xs = [0.31, 0.50, 0.69];
        for (let i = 0; i < xs.length; i++) uprightCoil(tx + xs[i], ty + 0.50, 5.2, true);
        R.drawIsoBox(ctx, tx + 0.18, ty + 0.42, 13.6, 0.64, 0.16, 1.6, wood, null, zScale);
        woodPost(tx + 0.80, ty + 0.34, 0.18, 0.32);
      } else {
        woodPost(tx + 0.34, ty + 0.02, 0.32, 0.18);
        R.drawIsoBox(ctx, tx + 0.46, ty + 0.20, 0.6, 0.08, 0.60, 1.2, woodDark, null, zScale);
        R.drawIsoBox(ctx, tx + 0.46, ty + 0.20, 8.6, 0.08, 0.60, 1.2, wood, null, zScale);
        R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.22, 1.8), Iso.gridToScreen(tx + 0.50, ty + 0.78, 8.4), woodDark, 1.6, true, zScale);
        R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.22, 8.4), Iso.gridToScreen(tx + 0.50, ty + 0.78, 1.8), woodDark, 1.6, true, zScale);
        const ys = [0.31, 0.50, 0.69];
        for (let i = 0; i < ys.length; i++) uprightCoil(tx + 0.50, ty + ys[i], 5.2, false);
        R.drawIsoBox(ctx, tx + 0.42, ty + 0.18, 13.6, 0.16, 0.64, 1.6, wood, null, zScale);
        woodPost(tx + 0.34, ty + 0.80, 0.32, 0.18);
      }
      return;
    }

    if (lv === 2) {
      const dk = P.gatePylon || '#59636E';
      const beamCol = P.gateBeam || '#4A5562';
      const barCol = P.gateBar || '#2B333D';
      const pyl = (x, y, w, d) => {
        R.drawIsoBox(ctx, x, y, 0, w, d, 22, dk, null, zScale);
        R.drawIsoBox(ctx, x - 0.004, y - 0.004, 3, w + 0.008, d + 0.008, 3, '#F0BD35', { noTop: true }, zScale);
        R.drawIsoBox(ctx, x + 0.04, y + 0.04, 22, w - 0.08, d - 0.08, 1.4, '#3E4650', null, zScale);
        R.drawIsoDot(ctx, Iso.gridToScreen(x + w * 0.5, y + d * 0.5, 25), 1.9, P.danger, true, zScale);
      };
      const door = () => {
        if (!alongY) {
          R.drawIsoBox(ctx, tx + 0.24, ty + 0.46, 0, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
          R.drawIsoBox(ctx, tx + 0.24, ty + 0.46, 13.4, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
          for (let k = 0; k < 5; k++) {
            R.drawIsoBox(ctx, tx + 0.28 + k * 0.1, ty + 0.48, 1.6, 0.035, 0.04, 11.8, barCol, null, zScale);
          }
        } else {
          R.drawIsoBox(ctx, tx + 0.46, ty + 0.24, 0, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
          R.drawIsoBox(ctx, tx + 0.46, ty + 0.24, 13.4, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
          for (let k = 0; k < 5; k++) {
            R.drawIsoBox(ctx, tx + 0.48, ty + 0.28 + k * 0.1, 1.6, 0.04, 0.035, 11.8, barCol, null, zScale);
          }
        }
      };
      if (!alongY) {
        pyl(tx + 0, ty + 0.30, 0.24, 0.40);
        door();
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.38, 19, 0.52, 0.24, 3, beamCol, null, zScale);
        pyl(tx + 0.76, ty + 0.30, 0.24, 0.40);
      } else {
        pyl(tx + 0.30, ty + 0, 0.40, 0.24);
        door();
        R.drawIsoBox(ctx, tx + 0.38, ty + 0.24, 19, 0.24, 0.52, 3, beamCol, null, zScale);
        pyl(tx + 0.30, ty + 0.76, 0.40, 0.24);
      }
      return;
    }

    // T3: Electronic Shock Gate (armored pylon shoulders, copper discharge horns, dual zigzag arcs)
    const dk = P.gatePylon || '#59636E';
    const arcA = P.piezoArc || '#FF8A3D';
    const arcB = P.piezoSpark || '#FFD08A';
    const copper = P.piezoCopper || '#B87333';
    const shockPyl = (px, py, pw, pd) => {
      R.drawIsoBox(ctx, px, py, 0, pw, pd, 23.0, dk, null, zScale);
      R.drawIsoBox(ctx, px - 0.005, py - 0.005, 3.0, pw + 0.01, pd + 0.01, 3.0, '#F0BD35', { noTop: true }, zScale);
      R.drawIsoBox(ctx, px - 0.014, py - 0.014, 11.5, pw + 0.028, pd + 0.028, 5.5, '#4A5562', null, zScale);
      R.drawIsoBox(ctx, px + 0.03, py + 0.03, 23.0, pw - 0.06, pd - 0.06, 1.5, copper, null, zScale);
      R.drawCyl(ctx, px + pw * 0.5, py + pd * 0.5, 24.5, 0.038, 3.0, copper, { n: 8 }, zScale);
      R.drawIsoDot(ctx, Iso.gridToScreen(px + pw * 0.5, py + pd * 0.5, 27.8), 2.1, arcA, true, zScale);
    };
    const shockDoor = () => {
      if (!alongY) {
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.46, 0, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.46, 13.4, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
        for (let k = 0; k < 5; k++) {
          R.drawIsoBox(ctx, tx + 0.28 + k * 0.1, ty + 0.48, 1.6, 0.035, 0.04, 11.8, arcA, { emissive: true }, zScale);
        }
        R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.26, ty + 0.50, 5.2), Iso.gridToScreen(tx + 0.74, ty + 0.50, 6.4), 2.0, arcB, true, zScale);
        R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.26, ty + 0.50, 10.6), Iso.gridToScreen(tx + 0.74, ty + 0.50, 9.6), -1.8, arcB, true, zScale);
      } else {
        R.drawIsoBox(ctx, tx + 0.46, ty + 0.24, 0, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
        R.drawIsoBox(ctx, tx + 0.46, ty + 0.24, 13.4, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
        for (let k = 0; k < 5; k++) {
          R.drawIsoBox(ctx, tx + 0.48, ty + 0.28 + k * 0.1, 1.6, 0.04, 0.035, 11.8, arcA, { emissive: true }, zScale);
        }
        R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.26, 5.2), Iso.gridToScreen(tx + 0.50, ty + 0.74, 6.4), 2.0, arcB, true, zScale);
        R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.26, 10.6), Iso.gridToScreen(tx + 0.50, ty + 0.74, 9.6), -1.8, arcB, true, zScale);
      }
    };
    if (!alongY) {
      shockPyl(tx + 0, ty + 0.30, 0.24, 0.40);
      shockDoor();
      R.drawIsoBox(ctx, tx + 0.24, ty + 0.38, 19.0, 0.52, 0.24, 3.8, '#3E4650', null, zScale);
      R.drawIsoBox(ctx, tx + 0.235, ty + 0.375, 22.0, 0.53, 0.25, 1.0, '#FF9F43', { noTop: true }, zScale);
      shockPyl(tx + 0.76, ty + 0.30, 0.24, 0.40);
    } else {
      shockPyl(tx + 0.30, ty + 0, 0.40, 0.24);
      shockDoor();
      R.drawIsoBox(ctx, tx + 0.38, ty + 0.24, 19.0, 0.24, 0.52, 3.8, '#3E4650', null, zScale);
      R.drawIsoBox(ctx, tx + 0.375, ty + 0.235, 22.0, 0.25, 0.53, 1.0, '#FF9F43', { noTop: true }, zScale);
      shockPyl(tx + 0.30, ty + 0.76, 0.40, 0.24);
    }
  }

  function getMountedVisualTopZ(unitId) {
    switch (unitId) {
      case 'rifle_bunker': return 15.5;
      case 'shotgun_post': return 15;
      case 'vulcan_turret': return 12;
      case 'led_floodlight': return 16;
      default: return 15;
    }
  }

  function drawWallDeck(ctx, wallLv, tx, ty, zScale) {
    const isBlast = (wallLv || 2) >= 3;
    if (!isBlast) {
      R.drawIsoBox(ctx, tx + 0.27, ty + 0.27, 14, 0.46, 0.46, 1.2, '#8A6A45', null, zScale);
      R.drawIsoBox(ctx, tx + 0.27, ty + 0.27, 15.2, 0.46, 0.03, 3.2, '#6E5536', null, zScale);
      R.drawIsoBox(ctx, tx + 0.27, ty + 0.27, 15.2, 0.03, 0.46, 3.2, '#6E5536', null, zScale);
    } else {
      R.drawIsoBox(ctx, tx + 0.25, ty + 0.25, 24, 0.50, 0.50, 1.4, '#4A5562', null, zScale);
      R.drawIsoBox(ctx, tx + 0.25, ty + 0.25, 25.4, 0.50, 0.03, 3.4, '#3A434E', null, zScale);
      R.drawIsoBox(ctx, tx + 0.25, ty + 0.25, 25.4, 0.03, 0.50, 3.4, '#3A434E', null, zScale);
    }
  }

  function drawMountedBunkerBack(ctx, tx, ty, baseZ, lv, zScale) {
    const rh = lv >= 3 ? 5.5 : 4;
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, baseZ, 0.22, rh, 'back', zScale);
  }

  function drawMountedBunkerFront(ctx, tx, ty, baseZ, lv, steelCol, zScale) {
    const rh = lv >= 3 ? 5.5 : 4;
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, baseZ, 0.22, rh, 'front', zScale);
    if (lv >= 2) {
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, baseZ + (lv >= 3 ? 4.3 : 2.8), 0.224, 1.2, steelCol, { noTop: true, n: 16 }, zScale);
    }
  }

  function drawMountedShotgunFront(ctx, tx, ty, baseZ, lv, steelCol, maxAccent, zScale) {
    R.drawIsoBox(ctx, tx + 0.30, ty + 0.68, baseZ, 0.40, 0.05, 11, '#3A4654', null, zScale);
    R.drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 7, 0.406, 0.056, 1.8, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
    if (lv >= 2) {
      R.drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 3.0, 0.406, 0.056, 1.6, steelCol, { noTop: true }, zScale);
    }
    R.drawIsoBox(ctx, tx + 0.44, ty + 0.677, baseZ + 9, 0.12, 0.056, 1.1, '#1B2430', { noTop: true }, zScale);
  }

  function drawMountedVulcanStatic(ctx, tx, ty, baseZ, lv, isUnpowered, steelCol, zScale) {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    R.drawCyl(ctx, cx, cy, baseZ, 0.20, 3, '#4E5A68', { n: 16 }, zScale);
    R.drawPowerStripCyl(ctx, cx, cy, baseZ + 1.8, 0.204, isUnpowered, zScale);
    let domeZ = baseZ + 3;
    if (lv >= 2) {
      R.drawCyl(ctx, cx, cy, domeZ, 0.18, 1.4, steelCol, { n: 16 }, zScale);
      domeZ += 1.4;
    }
    R.drawDome(ctx, cx, cy, domeZ, 0.17, 9, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
  }

  function drawMountedVulcanBarrels(ctx, cx, cy, baseZ, lv, isUnpowered, aim, P, zScale) {
    const Iso = ZS.Iso;
    const domeZ = baseZ + (lv >= 2 ? 4.4 : 3);
    const px = -Math.sin(aim);
    const py = Math.cos(aim);
    const len = lv >= 3 ? 0.46 : 0.40;
    for (let k = -1; k <= 1; k++) {
      const ox = cx + px * 0.028 * k;
      const oy = cy + py * 0.028 * k;
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(ox, oy, domeZ + 4),
        Iso.gridToScreen(ox + Math.cos(aim) * len, oy + Math.sin(aim) * len, domeZ + 4),
        '#2B333D',
        1.6,
        true,
        zScale
      );
    }
    if (lv >= 3) {
      const mid = Iso.gridToScreen(cx + Math.cos(aim) * 0.25, cy + Math.sin(aim) * 0.25, domeZ + 4);
      R.drawIsoDot(ctx, mid, 2.0, isUnpowered ? P.powerDim : P.power, !isUnpowered, zScale);
    }
  }

  function drawMountedFloodlight(ctx, tx, ty, baseZ, lv, isUnpowered, steelCol, zScale) {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    R.drawCyl(ctx, cx, cy, baseZ, 0.11, 2, '#59636E', { n: 12 }, zScale);
    R.drawPowerStripCyl(ctx, cx, cy, baseZ + 0.6, 0.114, isUnpowered, zScale);
    R.drawIsoBox(ctx, cx - 0.025, cy - 0.025, baseZ + 2, 0.05, 0.05, 9, lv >= 2 ? steelCol : '#8A99A8', null, zScale);
    R.drawIsoBox(ctx, tx + 0.34, ty + 0.40, baseZ + 11, 0.32, 0.20, 5, '#59636E', null, zScale);
    R.drawIsoBox(ctx, tx + 0.36, ty + 0.595, baseZ + 12, 0.28, 0.012, 3.2, isUnpowered ? '#4B5563' : '#FFF6DA', { emissive: !isUnpowered }, zScale);
  }

  function drawMountedUnit(ctx, unit, tx, ty, baseZ, state, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const steelCol = P.steelBand || '#8C96A3';
    const maxAccent = P.levelMax || '#FF9F43';
    const def = ZS.DATA.ITEMS[unit.id];
    const isUnpowered = (state.isNight && def && def.requiresPower && !powered) || !!(def && def.requiresPower && (unit.empStunTimer || 0) > 0);
    const lv = unit.level || 1;
    const aim = unit.aimAngle != null ? unit.aimAngle : 0.8;
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const isSil = !!window.ZS_SILHOUETTE_MODE;

    if (!isNodeAnimatingOrFlashing(unit)) {
      const tintBucket = getTintBucket(state, isSil);
      const mountTopZ = baseZ + getMountedVisualTopZ(unit.id);
      if (unit.id === 'rifle_bunker') {
        const bStamp = ensureStructureStamp(`m|bunker_b|${lv}|${baseZ}|${tintBucket}`, mountTopZ, tintBucket, isSil, (sctx) => {
          drawMountedBunkerBack(sctx, 0, 0, baseZ, lv, 1.0);
        });
        blitStructureStamp(ctx, bStamp, tx, ty, zScale, isSil);
        drawOperatorFigure(ctx, cx, cy, baseZ + 0.4, '#55684F', '#3E4D3A', aim, zScale, false, lv >= 3);
        const fStamp = ensureStructureStamp(`m|bunker_f|${lv}|${baseZ}|${tintBucket}`, mountTopZ, tintBucket, isSil, (sctx) => {
          drawMountedBunkerFront(sctx, 0, 0, baseZ, lv, steelCol, 1.0);
        });
        blitStructureStamp(ctx, fStamp, tx, ty, zScale, isSil);
        return;
      }
      if (unit.id === 'shotgun_post') {
        drawOperatorFigure(ctx, cx, cy - 0.04, baseZ + 0.3, '#3A4654', '#2F3945', aim, zScale, false, false);
        const fStamp = ensureStructureStamp(`m|shotgun_f|${lv}|${baseZ}|${tintBucket}`, mountTopZ, tintBucket, isSil, (sctx) => {
          drawMountedShotgunFront(sctx, 0, 0, baseZ, lv, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, fStamp, tx, ty, zScale, isSil);
        return;
      }
      if (unit.id === 'vulcan_turret') {
        const vStamp = ensureStructureStamp(`m|vulcan|${lv}|${baseZ}|${isUnpowered ? 1 : 0}|${tintBucket}`, mountTopZ, tintBucket, isSil, (sctx) => {
          drawMountedVulcanStatic(sctx, 0, 0, baseZ, lv, isUnpowered, steelCol, 1.0);
        });
        blitStructureStamp(ctx, vStamp, tx, ty, zScale, isSil);
        drawMountedVulcanBarrels(ctx, cx, cy, baseZ, lv, isUnpowered, aim, P, zScale);
        return;
      }
      if (unit.id === 'led_floodlight') {
        const flLv = lv >= 2 ? 2 : 1;
        const lStamp = ensureStructureStamp(`m|flood|${flLv}|${baseZ}|${isUnpowered ? 1 : 0}|${tintBucket}`, mountTopZ, tintBucket, isSil, (sctx) => {
          drawMountedFloodlight(sctx, 0, 0, baseZ, flLv, isUnpowered, steelCol, 1.0);
        });
        blitStructureStamp(ctx, lStamp, tx, ty, zScale, isSil);
        return;
      }
    }

    let hasMountAnim = false;
    let prevEmissives = R.emissiveList;
    if (unit.buildAnimTimer && unit.buildAnimTimer > 0) {
      const progress = 1 - Math.max(0, Math.min(1, unit.buildAnimTimer / 0.34));
      const pivot = Iso.gridToScreen(cx, cy, baseZ);
      let scaleX = 1;
      let scaleY = 1;
      let dropY = 0;
      if (progress < 0.28) {
        const u = progress / 0.28;
        dropY = -(1 - u * u) * 18 * zScale;
        scaleX = 0.91 + 0.09 * u;
        scaleY = 1.12 - 0.12 * u;
      } else {
        const u = (progress - 0.28) / 0.72;
        const squash = Math.sin(u * Math.PI * 2.1) * Math.exp(-u * 3.8);
        scaleX = 1 + squash * 0.20;
        scaleY = 1 - squash * 0.24;
      }
      ctx.save();
      ctx.translate(pivot.x, pivot.y + dropY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-pivot.x, -pivot.y);
      hasMountAnim = true;
      R.emissiveList = null;
    }

    Iso.setEntityFlash(unit.hitFlash || 0);

    switch (unit.id) {
      case 'rifle_bunker': {
        drawMountedBunkerBack(ctx, tx, ty, baseZ, lv, zScale);
        drawOperatorFigure(ctx, cx, cy, baseZ + 0.4, '#55684F', '#3E4D3A', aim, zScale, false, lv >= 3);
        drawMountedBunkerFront(ctx, tx, ty, baseZ, lv, steelCol, zScale);
        break;
      }

      case 'shotgun_post': {
        drawOperatorFigure(ctx, cx, cy - 0.04, baseZ + 0.3, '#3A4654', '#2F3945', aim, zScale, false, false);
        drawMountedShotgunFront(ctx, tx, ty, baseZ, lv, steelCol, maxAccent, zScale);
        break;
      }

      case 'vulcan_turret': {
        drawMountedVulcanStatic(ctx, tx, ty, baseZ, lv, isUnpowered, steelCol, zScale);
        drawMountedVulcanBarrels(ctx, cx, cy, baseZ, lv, isUnpowered, aim, P, zScale);
        break;
      }

      case 'led_floodlight': {
        drawMountedFloodlight(ctx, tx, ty, baseZ, lv, isUnpowered, steelCol, zScale);
        break;
      }
    }

    Iso.setEntityFlash(0);
    if (hasMountAnim) {
      ctx.restore();
      R.emissiveList = prevEmissives;
    }

    if (unit.upgradeAnimTimer > 0) {
      const p = 1 - Math.max(0, Math.min(1, unit.upgradeAnimTimer / 0.6));
      const scanZ = baseZ + p * getMountedVisualTopZ(unit.id);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.85;
      Iso.drawTilePoly(ctx, tx + 0.20, ty + 0.20, scanZ, 'rgba(255,255,255,0.22)', '#FFFFFF', 1.8 * zScale);
      ctx.restore();
    }
  }

  const trapAnimCache = new Map();

  function getTrapThrustAmount(st, tx, ty, state, timeSec) {
    if (!st || st.isPreview) return 0;
    const key = Number.isFinite(st.uid) ? `u${st.uid}` : `${tx},${ty}`;
    let isActive = false;
    if (R.activeTrapTiles) {
      isActive = R.activeTrapTiles.has(`${tx},${ty}`);
    } else if (state) {
      if (state.zombies && state.zombies.length > 0) {
        for (let i = 0; i < state.zombies.length; i++) {
          const z = state.zombies[i];
          if (!z || z.leapState || z.hp <= 0) continue;
          if (Math.floor(z.x) === tx && Math.floor(z.y) === ty) {
            isActive = true;
            break;
          }
        }
      }
      if (!isActive && state.projectiles && state.projectiles.length > 0) {
        for (let i = 0; i < state.projectiles.length; i++) {
          const p = state.projectiles[i];
          if (p && p.kind === 'bleed_burst' && Math.floor(p.x) === tx && Math.floor(p.y) === ty) {
            isActive = true;
            break;
          }
        }
      }
    }

    let rec = trapAnimCache.get(key);
    if (rec && timeSec < rec.lastTime - 0.5) {
      trapAnimCache.delete(key);
      rec = null;
    }
    if (!rec) {
      if (!isActive) return 0;
      rec = { lastTime: timeSec, cycle: 0.22, releaseThrust: 1.0, wasActive: true };
      if (trapAnimCache.size > 256) {
        for (const [k, v] of trapAnimCache) {
          if (timeSec - v.lastTime > 4.0) trapAnimCache.delete(k);
        }
      }
      trapAnimCache.set(key, rec);
      return 1.0;
    }

    const dt = Math.max(0, Math.min(0.1, timeSec - rec.lastTime));
    rec.lastTime = timeSec;
    if (isActive) {
      if (!rec.wasActive) {
        rec.cycle = 0.22;
        rec.wasActive = true;
      } else {
        rec.cycle = (rec.cycle + dt * 3.0) % 1.0;
      }
      const u = rec.cycle;
      const thrust = u < 0.22 ? u / 0.22 : u < 0.42 ? 1.0 : Math.max(0, 1 - (u - 0.42) / 0.58);
      rec.releaseThrust = thrust;
      return thrust;
    }

    rec.wasActive = false;
    rec.releaseThrust = Math.max(0, rec.releaseThrust - dt * 4.5);
    if (rec.releaseThrust <= 0.001) {
      trapAnimCache.delete(key);
      return 0;
    }
    return rec.releaseThrust;
  }

  function drawRazorPadT3Static(ctx, tx, ty, P, zScale) {
    const Iso = ZS.Iso;
    const copper = P.piezoCopper || '#B87333';
    const arcA = P.piezoArc || '#FF8A3D';
    R.drawFrustum(ctx, tx + 0.04, ty + 0.04, 0.4, 0.92, 0.92, 1.5, 0.025, '#343C46', null, zScale);
    R.drawIsoBox(ctx, tx + 0.045, ty + 0.045, 0.75, 0.91, 0.91, 0.85, copper, { noTop: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, 1.9, 0.85, 0.85, 0.50, copper, null, zScale);
    R.drawIsoBox(ctx, tx + 0.135, ty + 0.135, 2.4, 0.73, 0.73, 0.25, '#1D232C', null, zScale);
    R.drawIsoBox(ctx, tx + 0.18, ty + 0.475, 2.65, 0.64, 0.05, 0.22, copper, { edge: false }, zScale);
    R.drawIsoBox(ctx, tx + 0.475, ty + 0.18, 2.65, 0.05, 0.64, 0.22, copper, { edge: false }, zScale);

    const drawCornerElectrode = (ex, ey) => {
      R.drawIsoBox(ctx, tx + ex - 0.045, ty + ey - 0.045, 2.4, 0.09, 0.09, 1.5, copper, null, zScale);
      R.drawIsoBox(ctx, tx + ex - 0.048, ty + ey - 0.048, 3.4, 0.096, 0.096, 0.5, '#A84232', { noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + ex - 0.032, ty + ey - 0.032, 3.9, 0.064, 0.064, 0.8, arcA, { emissive: true }, zScale);
    };
    drawCornerElectrode(0.145, 0.145);
    drawCornerElectrode(0.855, 0.145);
    drawCornerElectrode(0.145, 0.855);

    const tPos = [0.29, 0.50, 0.71];
    for (let j = 0; j < tPos.length; j++) {
      for (let i = 0; i < tPos.length; i++) {
        const sx = tx + tPos[i];
        const sy = ty + tPos[j];
        const isCenter = i === 1 && j === 1;
        const rBase = isCenter ? 0.102 : 0.078;
        const hSpike = isCenter ? 3.25 : 2.60;
        R.drawFrustum(ctx, sx - rBase * 0.88, sy - rBase * 0.88, 2.65, rBase * 1.76, rBase * 1.76, 0.75, 0.015, copper, null, zScale);
        R.drawPyramidSpike(ctx, sx, sy, 3.20, rBase, rBase, hSpike, isCenter ? '#EEF4FA' : '#D5DFE9', null, zScale);
        if (isCenter) {
          R.drawIsoDot(ctx, Iso.gridToScreen(sx, sy, 3.20 + hSpike), 1.3, arcA, true, zScale);
        }
      }
    }
    drawCornerElectrode(0.855, 0.855);
  }

  function drawRazorPadT3Arcs(ctx, st, tx, ty, P, timeSec, zScale) {
    const Iso = ZS.Iso;
    const arcA = P.piezoArc || '#FF8A3D';
    const arcB = P.piezoSpark || '#FFD08A';
    const jA = st.isPreview ? 1.8 : 1.5 + 0.8 * Math.sin(timeSec * 19 + tx * 2.1 + ty);
    const jB = st.isPreview ? -1.8 : -1.5 + 0.8 * Math.cos(timeSec * 23 + tx + ty * 1.7);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.15, 4.3), jA * 0.65, arcA, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.15, ty + 0.85, 4.3), jB * 0.65, arcA, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.18, 3.35), Iso.gridToScreen(tx + 0.82, ty + 0.82, 3.35), jA * 0.55, arcB, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.82, ty + 0.18, 3.35), Iso.gridToScreen(tx + 0.18, ty + 0.82, 3.35), jB * 0.55, arcA, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.85, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.85, 4.3), jA * 0.65, arcB, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.85, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.85, 4.3), jB * 0.65, arcB, true, zScale);
  }

  function drawRazorPadTile(ctx, st, tx, ty, lv, P, state, timeSec, zScale, preThrust) {
    const Iso = ZS.Iso;
    const thrust = preThrust !== undefined ? preThrust : getTrapThrustAmount(st, tx, ty, state, timeSec);

    if (lv <= 1) {
      // T1: Beveled riveted steel hatch base plate + 3x3 sharp 3D pyramid steel spikes
      R.drawFrustum(ctx, tx + 0.08, ty + 0.08, 0.4, 0.84, 0.84, 1.3, 0.035, '#4A5460', null, zScale);
      R.drawIsoBox(ctx, tx + 0.145, ty + 0.145, 1.7, 0.71, 0.71, 0.35, '#252C34', null, zScale);
      const rivets = [
        [0.12, 0.12],
        [0.835, 0.12],
        [0.12, 0.835],
        [0.835, 0.835]
      ];
      for (let i = 0; i < rivets.length; i++) {
        R.drawIsoBox(ctx, tx + rivets[i][0], ty + rivets[i][1], 1.7, 0.045, 0.045, 0.45, '#8C96A3', null, zScale);
      }

      const pos = [0.275, 0.50, 0.725];
      const liftZ = thrust * 2.6;
      for (let j = 0; j < pos.length; j++) {
        for (let i = 0; i < pos.length; i++) {
          const sx = tx + pos[i];
          const sy = ty + pos[j];
          R.drawIsoBox(ctx, sx - 0.058, sy - 0.058, 2.05, 0.116, 0.116, 0.34, '#3E4650', null, zScale);
          if (liftZ > 0.18) {
            R.drawIsoBox(ctx, sx - 0.025, sy - 0.025, 2.05, 0.05, 0.05, liftZ + 0.2, '#6E7B88', { edge: false }, zScale);
          }
          R.drawPyramidSpike(ctx, sx, sy, 2.15 + liftZ, 0.074, 0.074, 3.25, '#DCE5EE', null, zScale);
        }
      }
      return;
    }

    if (lv === 2) {
      // T2: Heavy armored hazard-yellow rim + recessed dark piston channels + 4x4 dual-bevel steel spike array
      R.drawFrustum(ctx, tx + 0.05, ty + 0.05, 0.4, 0.90, 0.90, 1.3, 0.025, '#3E4650', null, zScale);
      R.drawIsoBox(ctx, tx + 0.055, ty + 0.055, 0.65, 0.89, 0.89, 0.75, '#F0BD35', { noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, 1.7, 0.85, 0.85, 0.45, '#F0BD35', null, zScale);
      R.drawIsoBox(ctx, tx + 0.13, ty + 0.13, 2.15, 0.74, 0.74, 0.30, '#2B333D', null, zScale);
      const clamps = [
        [0.08, 0.08],
        [0.84, 0.08],
        [0.08, 0.84],
        [0.84, 0.84]
      ];
      for (let i = 0; i < clamps.length; i++) {
        R.drawIsoBox(ctx, tx + clamps[i][0], ty + clamps[i][1], 2.15, 0.08, 0.08, 0.55, '#6E7B88', null, zScale);
      }

      const pPos = [0.24, 0.413, 0.587, 0.76];
      for (let j = 0; j < pPos.length; j++) {
        R.drawIsoBox(ctx, tx + 0.17, ty + pPos[j] - 0.032, 2.45, 0.66, 0.064, 0.12, '#141920', { edge: false }, zScale);
      }

      const liftZ = thrust * 3.0;
      const bladeCol = P.trapBlade || '#E6EFF7';
      for (let j = 0; j < pPos.length; j++) {
        for (let i = 0; i < pPos.length; i++) {
          const sx = tx + pPos[i];
          const sy = ty + pPos[j];
          if (liftZ > 0.18) {
            R.drawIsoBox(ctx, sx - 0.022, sy - 0.022, 2.45, 0.044, 0.044, liftZ + 0.2, '#6E7B88', { edge: false }, zScale);
          }
          R.drawFrustum(ctx, sx - 0.056, sy - 0.056, 2.45 + liftZ, 0.112, 0.112, 0.85, 0.018, '#7A8794', null, zScale);
          R.drawPyramidSpike(ctx, sx, sy, 3.10 + liftZ, 0.052, 0.052, 2.70, bladeCol, null, zScale);
        }
      }
      return;
    }

    // T3: High-Voltage Piezo Spike Trap (copper busbar frame + 3x3 reinforced spikes + 4-corner warm orange/amber piezo arcs; 0px cyan)
    const copper = P.piezoCopper || '#B87333';
    const arcA = P.piezoArc || '#FF8A3D';
    const arcB = P.piezoSpark || '#FFD08A';
    R.drawFrustum(ctx, tx + 0.04, ty + 0.04, 0.4, 0.92, 0.92, 1.5, 0.025, '#343C46', null, zScale);
    R.drawIsoBox(ctx, tx + 0.045, ty + 0.045, 0.75, 0.91, 0.91, 0.85, copper, { noTop: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, 1.9, 0.85, 0.85, 0.50, copper, null, zScale);
    R.drawIsoBox(ctx, tx + 0.135, ty + 0.135, 2.4, 0.73, 0.73, 0.25, '#1D232C', null, zScale);
    R.drawIsoBox(ctx, tx + 0.18, ty + 0.475, 2.65, 0.64, 0.05, 0.22, copper, { edge: false }, zScale);
    R.drawIsoBox(ctx, tx + 0.475, ty + 0.18, 2.65, 0.05, 0.64, 0.22, copper, { edge: false }, zScale);

    const drawCornerElectrode = (ex, ey) => {
      R.drawIsoBox(ctx, tx + ex - 0.045, ty + ey - 0.045, 2.4, 0.09, 0.09, 1.5, copper, null, zScale);
      R.drawIsoBox(ctx, tx + ex - 0.048, ty + ey - 0.048, 3.4, 0.096, 0.096, 0.5, '#A84232', { noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + ex - 0.032, ty + ey - 0.032, 3.9, 0.064, 0.064, 0.8, arcA, { emissive: true }, zScale);
    };

    const liftZ = thrust * 3.2;
    const jA = st.isPreview ? 1.8 : 1.5 + 0.8 * Math.sin(timeSec * 19 + tx * 2.1 + ty);
    const jB = st.isPreview ? -1.8 : -1.5 + 0.8 * Math.cos(timeSec * 23 + tx + ty * 1.7);

    // Back and side electrodes + back perimeter arcs before central spike array
    drawCornerElectrode(0.145, 0.145);
    drawCornerElectrode(0.855, 0.145);
    drawCornerElectrode(0.145, 0.855);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.15, 4.3), jA * 0.65, arcA, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.15, ty + 0.85, 4.3), jB * 0.65, arcA, true, zScale);

    // Low diagonal busbar discharge underneath the upper spike tips so 3D spikes stay razor-clear
    const busArcZ = 3.35 + liftZ * 0.35;
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.18, busArcZ), Iso.gridToScreen(tx + 0.82, ty + 0.82, busArcZ), jA * 0.55, arcB, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.82, ty + 0.18, busArcZ), Iso.gridToScreen(tx + 0.18, ty + 0.82, busArcZ), jB * 0.55, arcA, true, zScale);

    const tPos = [0.29, 0.50, 0.71];
    for (let j = 0; j < tPos.length; j++) {
      for (let i = 0; i < tPos.length; i++) {
        const sx = tx + tPos[i];
        const sy = ty + tPos[j];
        const isCenter = i === 1 && j === 1;
        const rBase = isCenter ? 0.102 : 0.078;
        const hSpike = isCenter ? 3.25 : 2.60;
        if (liftZ > 0.18) {
          R.drawIsoBox(ctx, sx - 0.028, sy - 0.028, 2.65, 0.056, 0.056, liftZ + 0.25, copper, { edge: false }, zScale);
        }
        R.drawFrustum(ctx, sx - rBase * 0.88, sy - rBase * 0.88, 2.65 + liftZ, rBase * 1.76, rBase * 1.76, 0.75, 0.015, copper, null, zScale);
        R.drawPyramidSpike(ctx, sx, sy, 3.20 + liftZ, rBase, rBase, hSpike, isCenter ? '#EEF4FA' : '#D5DFE9', null, zScale);
        if (isCenter) {
          R.drawIsoDot(ctx, Iso.gridToScreen(sx, sy, 3.20 + hSpike + liftZ), thrust > 0.25 ? 2.1 : 1.3, arcA, true, zScale);
        }
      }
    }

    // Front electrode + front perimeter arcs after spikes
    drawCornerElectrode(0.855, 0.855);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.85, ty + 0.15, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.85, 4.3), jA * 0.65, arcB, true, zScale);
    R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.85, 4.3), Iso.gridToScreen(tx + 0.85, ty + 0.85, 4.3), jB * 0.65, arcB, true, zScale);
    if (thrust > 0.25) {
      R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.15, ty + 0.15, 4.5 + liftZ * 0.4), Iso.gridToScreen(tx + 0.85, ty + 0.85, 4.5 + liftZ * 0.4), jA, arcB, true, zScale);
      R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.85, ty + 0.15, 4.5 + liftZ * 0.4), Iso.gridToScreen(tx + 0.15, ty + 0.85, 4.5 + liftZ * 0.4), jB, arcB, true, zScale);
    }
  }

  const _aoPts = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ];

  function drawIsoShadowQuad(ctx, gx, gy, gw, gd, zPx, fillStyle) {
    const Iso = ZS.Iso;
    Iso.projectTo(gx, gy, zPx, _aoPts[0]);
    Iso.projectTo(gx + gw, gy, zPx, _aoPts[1]);
    Iso.projectTo(gx + gw, gy + gd, zPx, _aoPts[2]);
    Iso.projectTo(gx, gy + gd, zPx, _aoPts[3]);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(_aoPts[0].x, _aoPts[0].y);
    ctx.lineTo(_aoPts[1].x, _aoPts[1].y);
    ctx.lineTo(_aoPts[2].x, _aoPts[2].y);
    ctx.lineTo(_aoPts[3].x, _aoPts[3].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawIsoFootprintAO(ctx, gx, gy, gw, gd, zPx, zScale) {
    drawIsoShadowQuad(ctx, gx - 0.025, gy - 0.025, gw + 0.095, gd + 0.095, zPx, 'rgba(10, 16, 22, 0.22)');
    drawIsoShadowQuad(ctx, gx - 0.005, gy - 0.005, gw + 0.055, gd + 0.055, zPx, 'rgba(6, 10, 16, 0.36)');
  }

  function drawWallContactShadow(ctx, tx, ty, mask, tier, isSil, zScale) {
    if (isSil) return;
    if (tier <= 1) {
      const Iso = ZS.Iso;
      const drawWireBand = (gx, gy, gw, gd) => {
        drawIsoShadowQuad(ctx, gx - 0.02, gy - 0.02, gw + 0.065, gd + 0.065, 0.15, 'rgba(10, 16, 22, 0.17)');
        drawIsoShadowQuad(ctx, gx, gy, gw + 0.035, gd + 0.035, 0.15, 'rgba(6, 10, 16, 0.26)');
      };
      if (mask === 0) {
        drawWireBand(tx + 0.16, ty + 0.36, 0.68, 0.28);
      } else if (mask === 10) {
        drawWireBand(tx, ty + 0.36, 1.0, 0.28);
      } else if (mask === 5) {
        drawWireBand(tx + 0.36, ty, 0.28, 1.0);
      } else {
        const sc = Iso.gridToScreen(tx + 0.53, ty + 0.55, 0.15);
        ctx.fillStyle = 'rgba(10, 16, 22, 0.18)';
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, 13 * zScale, 6.5 * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
        if (mask & 1) drawWireBand(tx + 0.38, ty, 0.24, 0.5);
        if (mask & 4) drawWireBand(tx + 0.38, ty + 0.5, 0.24, 0.5);
        if (mask & 8) drawWireBand(tx, ty + 0.38, 0.5, 0.24);
        if (mask & 2) drawWireBand(tx + 0.5, ty + 0.38, 0.5, 0.24);
      }
      return;
    }

    const boxes = [];
    if (mask === 0) {
      if (tier === 2) {
        boxes.push([tx + 0.17, ty + 0.31, 0.32, 0.38]);
        boxes.push([tx + 0.51, ty + 0.31, 0.32, 0.38]);
      } else {
        const r = WALL_PIECES.iso;
        boxes.push([tx + r[0], ty + r[1], r[2], r[3]]);
      }
    } else {
      const keys = ['post'];
      if (mask & 1) keys.push('N');
      if (mask & 2) keys.push('E');
      if (mask & 4) keys.push('S');
      if (mask & 8) keys.push('W');
      for (let i = 0; i < keys.length; i++) {
        const r = WALL_PIECES[keys[i]];
        boxes.push([tx + r[0], ty + r[1], r[2], r[3]]);
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      drawIsoShadowQuad(ctx, b[0] - 0.025, b[1] - 0.025, b[2] + 0.09, b[3] + 0.09, 0.15, 'rgba(10, 16, 22, 0.22)');
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      drawIsoShadowQuad(ctx, b[0] - 0.005, b[1] - 0.005, b[2] + 0.05, b[3] + 0.05, 0.15, 'rgba(6, 10, 16, 0.36)');
    }
  }

  function drawGateContactShadow(ctx, tx, ty, mask, lv, isSil, zScale) {
    if (isSil) return;
    const alongY = Boolean((mask & 5) && !(mask & 10));
    const boxes =
      lv <= 1
        ? !alongY
          ? [
              [tx + 0.02, ty + 0.34, 0.18, 0.32],
              [tx + 0.80, ty + 0.34, 0.18, 0.32],
              [tx + 0.20, ty + 0.44, 0.60, 0.12]
            ]
          : [
              [tx + 0.34, ty + 0.02, 0.32, 0.18],
              [tx + 0.34, ty + 0.80, 0.32, 0.18],
              [tx + 0.44, ty + 0.20, 0.12, 0.60]
            ]
        : !alongY
        ? [
            [tx, ty + 0.30, 0.24, 0.40],
            [tx + 0.76, ty + 0.30, 0.24, 0.40],
            [tx + 0.24, ty + 0.44, 0.52, 0.12]
          ]
        : [
            [tx + 0.30, ty, 0.40, 0.24],
            [tx + 0.30, ty + 0.76, 0.40, 0.24],
            [tx + 0.44, ty + 0.24, 0.12, 0.52]
          ];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      drawIsoShadowQuad(ctx, b[0] - 0.025, b[1] - 0.025, b[2] + 0.09, b[3] + 0.09, 0.15, 'rgba(10, 16, 22, 0.22)');
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      drawIsoShadowQuad(ctx, b[0] - 0.005, b[1] - 0.005, b[2] + 0.05, b[3] + 0.05, 0.15, 'rgba(6, 10, 16, 0.36)');
    }
  }

  function drawHqContactShadow(ctx, tx, ty, lv, isSil, zScale) {
    if (isSil) return;
    const pad = lv === 1 ? 0.08 : lv === 2 ? 0.06 : lv === 3 ? 0.05 : 0.04;
    drawIsoFootprintAO(ctx, tx + pad, ty + pad, 1.0 - pad * 2, 1.0 - pad * 2, 0.25, zScale);
  }

  function drawStructGroundShadow(ctx, tx, ty, def, isSil, zScale) {
    if (!(def && def.passable) && !isSil) {
      const Iso = ZS.Iso;
      const id = def && def.id;
      const isCompactMast = id === 'wind_turbine' || id === 'gas_heater' || id === 'led_floodlight';
      const isMedPad = id === 'solar_array' || id === 'battery_bank' || id === 'vending_machine' || id === 'arcade_neon' || id === 'urban_planter';
      const rxOuter = (isCompactMast ? 17.5 : isMedPad ? 22.0 : 24.5) * zScale;
      const ryOuter = rxOuter * 0.50;
      const rxCore = (isCompactMast ? 12.2 : isMedPad ? 15.8 : 17.8) * zScale;
      const ryCore = rxCore * 0.50;

      const outerC = Iso.gridToScreen(tx + 0.52, ty + 0.545, 0.35);
      ctx.fillStyle = 'rgba(8, 14, 20, 0.24)';
      ctx.beginPath();
      ctx.ellipse(outerC.x, outerC.y, rxOuter, ryOuter, 0, 0, Math.PI * 2);
      ctx.fill();

      const coreC = Iso.gridToScreen(tx + 0.53, ty + 0.555, 0.35);
      ctx.fillStyle = 'rgba(5, 9, 14, 0.38)';
      ctx.beginPath();
      ctx.ellipse(coreC.x, coreC.y, rxCore, ryCore, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRifleBunkerBack(ctx, tx, ty, lv, zScale) {
    const rh = lv >= 3 ? 10 : 7;
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'back', zScale);
  }

  function drawRifleBunkerFront(ctx, tx, ty, lv, steelCol, zScale) {
    const rh = lv >= 3 ? 10 : 7;
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'front', zScale);
    if (lv >= 2) {
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5 + rh - 1.6, 0.406, 1.6, steelCol, { noTop: true, n: 16 }, zScale);
    }
  }

  function drawShotgunPostBack(ctx, tx, ty, zScale) {
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'back', zScale);
  }

  function drawShotgunPostFront(ctx, tx, ty, lv, steelCol, maxAccent, zScale) {
    R.drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'front', zScale);
    R.drawIsoBox(ctx, tx + 0.16, ty + 0.80, 0.5, 0.68, 0.07, 17, '#3A4654', null, zScale);
    R.drawIsoBox(ctx, tx + 0.155, ty + 0.795, 11.5, 0.69, 0.08, 2.2, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
    if (lv >= 2) {
      R.drawIsoBox(ctx, tx + 0.155, ty + 0.795, 4.5, 0.69, 0.08, 2.0, steelCol, { noTop: true }, zScale);
    }
    R.drawIsoBox(ctx, tx + 0.42, ty + 0.795, 14.1, 0.16, 0.08, 1.4, '#1B2430', { noTop: true }, zScale);
  }

  function drawSniperTowerBack(ctx, tx, ty, lv, steelCol, zScale) {
    const Iso = ZS.Iso;
    const legs = [
      [0.14, 0.14],
      [0.76, 0.14],
      [0.14, 0.76],
      [0.76, 0.76]
    ];
    for (let i = 0; i < legs.length; i++) {
      R.drawIsoBox(ctx, tx + legs[i][0], ty + legs[i][1], 0.5, 0.08, 0.08, 24, '#7C8B99', null, zScale);
    }
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.84, 2.5), Iso.gridToScreen(tx + 0.80, ty + 0.84, 21.5), '#5B6875', 1.15, false, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.84, 21.5), Iso.gridToScreen(tx + 0.80, ty + 0.84, 2.5), '#5B6875', 1.15, false, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.84, ty + 0.18, 2.5), Iso.gridToScreen(tx + 0.84, ty + 0.80, 21.5), '#5B6875', 1.15, false, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.84, ty + 0.18, 21.5), Iso.gridToScreen(tx + 0.84, ty + 0.80, 2.5), '#5B6875', 1.15, false, zScale);
    R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, 24.5, 0.84, 0.84, 3, lv >= 2 ? steelCol : '#6C7B8B', null, zScale);
    const backPosts = [
      [0.10, 0.10],
      [0.86, 0.10],
      [0.10, 0.86]
    ];
    for (let i = 0; i < backPosts.length; i++) {
      R.drawIsoBox(ctx, tx + backPosts[i][0], ty + backPosts[i][1], 27.5, 0.04, 0.04, 18, '#5B6875', null, zScale);
    }
  }

  function drawSniperTowerFront(ctx, tx, ty, lv, maxAccent, zScale) {
    const Iso = ZS.Iso;
    R.drawIsoBox(ctx, tx + 0.86, ty + 0.86, 27.5, 0.04, 0.04, 18, '#5B6875', null, zScale);
    R.drawHipRoof(ctx, tx + 0.04, ty + 0.04, 45.5, 0.92, 0.92, 7, '#4F5D4B', zScale);
    if (lv >= 3) {
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.5, ty + 0.5, 53.0), 2.3, maxAccent, true, zScale);
    }
  }

  function drawVulcanStatic(ctx, tx, ty, lv, isUnpowered, steelCol, zScale) {
    R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 7, '#4E5A68', { n: 16 }, zScale);
    R.drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.9, 0.366, isUnpowered, zScale);
    let z0 = 7.5;
    if (lv >= 2) {
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.32, 2.6, steelCol, { n: 16 }, zScale);
      z0 = 10.1;
    }
    R.drawDome(ctx, tx + 0.5, ty + 0.5, z0, 0.26, 13, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
  }

  function drawVulcanBarrels(ctx, tx, ty, lv, isUnpowered, aim, P, zScale) {
    const Iso = ZS.Iso;
    const z0 = lv >= 2 ? 10.1 : 7.5;
    const len = lv >= 3 ? 0.62 : 0.50;
    const px = -Math.sin(aim);
    const py = Math.cos(aim);
    for (let k = -1; k <= 1; k++) {
      const ox = tx + 0.5 + px * 0.035 * k;
      const oy = ty + 0.5 + py * 0.035 * k;
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(ox, oy, z0 + 5),
        Iso.gridToScreen(ox + Math.cos(aim) * len, oy + Math.sin(aim) * len, z0 + 5),
        '#2B333D',
        1.9,
        true,
        zScale
      );
    }
    if (lv >= 3) {
      const mid = Iso.gridToScreen(tx + 0.5 + Math.cos(aim) * 0.36, ty + 0.5 + Math.sin(aim) * 0.36, z0 + 5);
      R.drawIsoDot(ctx, mid, 2.5, isUnpowered ? P.powerDim : P.power, !isUnpowered, zScale);
    }
  }

  function drawEmpCoilStatic(ctx, tx, ty, lv, isUnpowered, steelCol, maxAccent, zScale) {
    R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.32, 6, '#3E4A59', { n: 16 }, zScale);
    R.drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 4.9, 0.326, isUnpowered, zScale);
    if (lv >= 2) {
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, 6.5, 0.25, 1.8, steelCol, { n: 14 }, zScale);
    }
    R.drawCyl(ctx, tx + 0.5, ty + 0.5, 6.5, 0.09, 20, '#60748A', { n: 10 }, zScale);
    const coilZs = lv >= 3 ? [9.5, 13.5, 17.5, 21.5] : [10.5, 15.5, 20.5];
    for (let r = 0; r < coilZs.length; r++) {
      R.drawCyl(
        ctx,
        tx + 0.5,
        ty + 0.5,
        coilZs[r],
        0.19,
        2.0,
        lv >= 3 && r === coilZs.length - 1 ? maxAccent : '#B87333',
        { n: 14 },
        zScale
      );
    }
  }

  function drawEmpCoilOrb(ctx, tx, ty, isUnpowered, P, timeSec, zScale) {
    const pulse = isUnpowered ? 0.85 : 0.94 + 0.10 * Math.sin(timeSec * 7);
    R.drawBlob(ctx, tx + 0.5, ty + 0.5, 25.5, 0.14 * pulse, 9, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, n: 14 }, zScale);
  }

  function drawWindTurbineStatic(ctx, tx, ty, lv, P, zScale) {
    const Iso = ZS.Iso;
    const gunmetal = P.milGunmetal || '#3B4552';
    const slate = P.milSlate || '#525E6B';
    const olive = P.milOlive || '#6B7A5E';
    const towerBase = '#D8E1EA';
    const towerMid = '#E6EEF5';

    if (lv <= 1) {
      // Compact octagonal/chamfered military base pad (~30% footprint) + bolt flange + tapered tower + compact nacelle & tail vane
      R.drawDetailedFrustum(ctx, tx + 0.35, ty + 0.35, 0.4, 0.30, 0.30, 2.2, 0.03, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.35, ty + 0.35, 2.6, 0.30, 0.30, 0.045, 0.75, '#BAC6D2', zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 2.6, 0.095, 1.4, slate, { n: 10 }, zScale);
      // Small cyan power indicator ring on collar
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 4.0, 0.072, 0.9, P.power, { n: 10, emissive: true, noTop: true }, zScale);
      // Slim tapered white-slate tubular mast
      R.drawTaperedCyl(ctx, tx + 0.50, ty + 0.50, 4.8, 0.056, 0.034, 19.8, towerBase, { n: 10, specHighlight: true }, zScale);
      // Tail vane (drawn before nacelle housing)
      R.drawDetailedIsoBox(ctx, tx + 0.485, ty + 0.25, 24.8, 0.03, 0.16, 2.8, olive, { bevel: true }, zScale);
      // Aerodynamic nacelle housing
      R.drawDetailedIsoBox(ctx, tx + 0.445, ty + 0.39, 24.2, 0.11, 0.22, 3.2, '#CFD9E3', { bevel: true }, zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.555, ty + 0.43, 25.0, 0.12, 2, 1.0, zScale);
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.43, 27.9), 1.15, P.power, true, zScale);
    } else if (lv === 2) {
      R.drawDetailedFrustum(ctx, tx + 0.33, ty + 0.33, 0.4, 0.34, 0.34, 2.8, 0.035, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.33, ty + 0.33, 3.2, 0.34, 0.34, 0.05, 0.8, '#BAC6D2', zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.61, ty + 0.44, 0.8, 0.09, 0.13, 3.2, olive, { bevel: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 3.2, 0.11, 1.6, slate, { n: 12 }, zScale);
      R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.50, 4.4, 0.092, false, zScale);
      R.drawTaperedCyl(ctx, tx + 0.50, ty + 0.50, 5.6, 0.064, 0.038, 29.4, towerMid, { n: 12, specHighlight: true }, zScale);
      // Mid-tower collar seam
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 18.5, 0.054, 0.9, '#9AA8B6', { n: 10, noTop: true }, zScale);
      // Tail stabilizer fin + armored nacelle
      R.drawDetailedIsoBox(ctx, tx + 0.48, ty + 0.21, 35.6, 0.04, 0.18, 3.8, slate, { bevel: true }, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.43, ty + 0.37, 34.6, 0.14, 0.26, 4.0, '#D8E2EC', { bevel: true }, zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.57, ty + 0.42, 35.6, 0.15, 2, 1.2, zScale);
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.44, 39.1), 1.3, P.power, true, zScale);
    } else if (lv === 3) {
      R.drawDetailedFrustum(ctx, tx + 0.31, ty + 0.31, 0.4, 0.38, 0.38, 3.4, 0.045, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.31, ty + 0.31, 3.8, 0.38, 0.38, 0.055, 0.85, '#C9D5E0', zScale);
      // Compact auxiliary transformer pod beside mast
      R.drawDetailedIsoBox(ctx, tx + 0.30, ty + 0.56, 0.6, 0.13, 0.14, 4.2, slate, { bevel: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 3.8, 0.12, 2.0, slate, { n: 12 }, zScale);
      R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.50, 5.2, 0.10, false, zScale);
      R.drawTaperedCyl(ctx, tx + 0.50, ty + 0.50, 6.4, 0.072, 0.044, 39.8, towerMid, { n: 12, specHighlight: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 22.0, 0.062, 1.0, '#94A3B2', { n: 12, noTop: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 35.0, 0.052, 1.0, '#94A3B2', { n: 12, noTop: true }, zScale);
      // Heavy streamlined military nacelle + olive dorsal cowling
      R.drawDetailedIsoBox(ctx, tx + 0.475, ty + 0.20, 47.0, 0.05, 0.16, 4.2, olive, { bevel: true }, zScale);
      R.drawDetailedFrustum(ctx, tx + 0.41, ty + 0.34, 45.8, 0.18, 0.31, 4.8, 0.018, '#DCE6F0', { bevel: true }, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.43, ty + 0.37, 50.6, 0.14, 0.22, 1.1, olive, { bevel: true }, zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.59, ty + 0.40, 47.0, 0.18, 3, 1.1, zScale);
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.45, 52.2), 1.5, P.power, true, zScale);
    } else {
      // Lv.4 High-altitude twin-rotor military wind generator
      R.drawDetailedFrustum(ctx, tx + 0.28, ty + 0.28, 0.4, 0.44, 0.44, 4.8, 0.06, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoHazardBand(ctx, tx + 0.295, ty + 0.295, 1.4, 0.41, 0.41, 1.6, '#DFAC2E', '#232B35', 4, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.28, ty + 0.28, 5.2, 0.44, 0.44, 0.06, 0.9, '#DCE5EE', zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 5.2, 0.14, 2.2, slate, { n: 12 }, zScale);
      R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.50, 6.2, 0.142, false, zScale);
      R.drawTaperedCyl(ctx, tx + 0.50, ty + 0.50, 7.4, 0.082, 0.048, 46.6, '#EDF3F8', { n: 12, specHighlight: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 24.0, 0.070, 1.2, slate, { n: 12, noTop: true }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 40.0, 0.058, 1.2, slate, { n: 12, noTop: true }, zScale);
      // Long twin-rotor armored nacelle + small cyan power core slit
      R.drawDetailedFrustum(ctx, tx + 0.39, ty + 0.27, 53.6, 0.22, 0.42, 5.6, 0.02, '#DCE6F0', { bevel: true }, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.41, ty + 0.31, 59.2, 0.18, 0.32, 1.3, slate, { bevel: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.386, ty + 0.34, 55.8, 0.228, 0.26, 1.1, P.power, { noTop: true, emissive: true }, zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.61, ty + 0.36, 54.6, 0.22, 2, 1.4, zScale);
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.46, 61.1), 1.8, P.power, true, zScale);
    }
  }

  function drawAeroRotorAssembly(ctx, hubPt, coneTipPt, radiusPx, rootHalfW, tipHalfW, bladeAngle, bladeHex, trimHex, hubHex, zScale, tipGlowHex) {
    const Iso = ZS.Iso;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const mainFill = Iso.resolveFaceColor(bladeHex, 1.0, false, 0) || bladeHex;
    const edgeShade = Iso.resolveFaceColor(bladeHex, 0.80, false, 0) || bladeHex;
    const trimFill = trimHex ? (Iso.resolveFaceColor(trimHex, 0.95, false, 0) || trimHex) : null;

    for (let b = 0; b < 3; b++) {
      const a = bladeAngle + (b * Math.PI * 2) / 3;
      const dx = Math.cos(a) * 0.96;
      const dy = Math.sin(a) * 0.90;
      const nx = -dy;
      const ny = dx;

      const rStart = 1.6 * zScale;
      const rMid = radiusPx * 0.34 * zScale;
      const rBand = radiusPx * 0.78 * zScale;
      const rEnd = radiusPx * zScale;
      const wRoot = rootHalfW * zScale;
      const wMid = rootHalfW * 1.32 * zScale;
      const wTip = tipHalfW * zScale;

      const p0L = { x: hubPt.x + dx * rStart + nx * wRoot * 0.65, y: hubPt.y + dy * rStart + ny * wRoot * 0.65 };
      const pMidL = { x: hubPt.x + dx * rMid + nx * wMid, y: hubPt.y + dy * rMid + ny * wMid };
      const pTipL = { x: hubPt.x + dx * rEnd + nx * wTip * 0.5, y: hubPt.y + dy * rEnd + ny * wTip * 0.5 };
      const pTipR = { x: hubPt.x + dx * rEnd - nx * wTip, y: hubPt.y + dy * rEnd - ny * wTip };
      const pMidR = { x: hubPt.x + dx * rMid - nx * wRoot * 0.85, y: hubPt.y + dy * rMid - ny * wRoot * 0.85 };
      const p0R = { x: hubPt.x + dx * rStart - nx * wRoot * 0.65, y: hubPt.y + dy * rStart - ny * wRoot * 0.65 };

      // Tapered airfoil polygon
      ctx.beginPath();
      ctx.moveTo(p0L.x, p0L.y);
      ctx.lineTo(pMidL.x, pMidL.y);
      ctx.lineTo(pTipL.x, pTipL.y);
      ctx.lineTo(pTipR.x, pTipR.y);
      ctx.lineTo(pMidR.x, pMidR.y);
      ctx.lineTo(p0R.x, p0R.y);
      ctx.closePath();
      ctx.fillStyle = mainFill;
      ctx.fill();

      if (!isSil) {
        // Trailing-edge subtle shadow facet for 3D airfoil volume
        ctx.beginPath();
        ctx.moveTo(hubPt.x + dx * rStart, hubPt.y + dy * rStart);
        ctx.lineTo(hubPt.x + dx * rEnd, hubPt.y + dy * rEnd);
        ctx.lineTo(pTipR.x, pTipR.y);
        ctx.lineTo(pMidR.x, pMidR.y);
        ctx.lineTo(p0R.x, p0R.y);
        ctx.closePath();
        ctx.fillStyle = edgeShade;
        ctx.fill();

        if (trimFill) {
          const b0L = { x: hubPt.x + dx * rBand + nx * wTip * 1.15, y: hubPt.y + dy * rBand + ny * wTip * 1.15 };
          const b0R = { x: hubPt.x + dx * rBand - nx * wTip * 1.15, y: hubPt.y + dy * rBand - ny * wTip * 1.15 };
          ctx.beginPath();
          ctx.moveTo(b0L.x, b0L.y);
          ctx.lineTo(pTipL.x, pTipL.y);
          ctx.lineTo(pTipR.x, pTipR.y);
          ctx.lineTo(b0R.x, b0R.y);
          ctx.closePath();
          ctx.fillStyle = trimFill;
          ctx.fill();
        }

        ctx.strokeStyle = 'rgba(10, 16, 24, 0.46)';
        ctx.lineWidth = Math.max(0.6, 0.72 * zScale);
        ctx.beginPath();
        ctx.moveTo(p0L.x, p0L.y);
        ctx.lineTo(pMidL.x, pMidL.y);
        ctx.lineTo(pTipL.x, pTipL.y);
        ctx.lineTo(pTipR.x, pTipR.y);
        ctx.lineTo(pMidR.x, pMidR.y);
        ctx.lineTo(p0R.x, p0R.y);
        ctx.closePath();
        ctx.stroke();
      }

      if (tipGlowHex) {
        R.drawIsoDot(ctx, { x: hubPt.x + dx * rEnd, y: hubPt.y + dy * rEnd }, 1.15, tipGlowHex, true, zScale);
      }
    }

    // 3D aerodynamic nose spinner cone at hub center
    const rHub = (rootHalfW * 1.38 + 0.9) * zScale;
    const hubBaseCol = Iso.resolveFaceColor(hubHex || '#607080', 0.82, false, 0) || '#607080';
    const hubCapCol = Iso.resolveFaceColor(bladeHex, 1.0, false, 0) || bladeHex;
    ctx.beginPath();
    ctx.arc(hubPt.x, hubPt.y, rHub, 0, Math.PI * 2);
    ctx.fillStyle = hubBaseCol;
    ctx.fill();
    if (!isSil) {
      ctx.strokeStyle = 'rgba(10, 14, 20, 0.52)';
      ctx.lineWidth = Math.max(0.65, 0.75 * zScale);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(coneTipPt.x, coneTipPt.y, rHub * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = hubCapCol;
    ctx.fill();
  }

  function drawWindTurbineRotors(ctx, tx, ty, lv, bladeAngle, P, zScale) {
    const Iso = ZS.Iso;
    const olive = P.milOlive || '#6B7A5E';
    const slate = P.milSlate || '#525E6B';
    if (lv <= 1) {
      // Lv.1 immediately reads as a crisp 3-blade horizontal-axis wind turbine!
      const hub = Iso.gridToScreen(tx + 0.50, ty + 0.63, 25.8);
      const tip = Iso.gridToScreen(tx + 0.50, ty + 0.67, 25.8);
      drawAeroRotorAssembly(ctx, hub, tip, 13.5, 1.55, 0.55, bladeAngle, '#F2F7FB', olive, slate, zScale, null);
    } else if (lv === 2) {
      const hub = Iso.gridToScreen(tx + 0.50, ty + 0.65, 36.6);
      const tip = Iso.gridToScreen(tx + 0.50, ty + 0.70, 36.6);
      drawAeroRotorAssembly(ctx, hub, tip, 17.5, 1.75, 0.62, bladeAngle, '#F4F8FC', olive, slate, zScale, null);
    } else if (lv === 3) {
      const hub = Iso.gridToScreen(tx + 0.50, ty + 0.67, 48.2);
      const tip = Iso.gridToScreen(tx + 0.50, ty + 0.73, 48.2);
      drawAeroRotorAssembly(ctx, hub, tip, 23.0, 2.05, 0.70, bladeAngle, '#F6FAFD', '#D99B26', slate, zScale, null);
    } else {
      // Rear counter-rotating auxiliary rotor + massive front 3-blade rotor
      const hubB = Iso.gridToScreen(tx + 0.50, ty + 0.25, 56.4);
      const tipB = Iso.gridToScreen(tx + 0.50, ty + 0.21, 56.4);
      drawAeroRotorAssembly(ctx, hubB, tipB, 14.2, 1.45, 0.52, -bladeAngle + 0.52, '#CFDCE8', slate, '#455260', zScale, null);

      const hubF = Iso.gridToScreen(tx + 0.50, ty + 0.71, 56.4);
      const tipF = Iso.gridToScreen(tx + 0.50, ty + 0.77, 56.4);
      drawAeroRotorAssembly(ctx, hubF, tipF, 26.2, 2.25, 0.76, bladeAngle, '#F7FAFD', '#E2A83B', slate, zScale, P.power);
    }
  }

  function drawRepairBayLv2Static(ctx, tx, ty, zScale) {
    R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 3, '#475361', null, zScale);
    R.drawIsoBox(ctx, tx + 0.07, ty + 0.07, 0.5, 0.86, 0.86, 1.2, '#F0A93A', { noTop: true }, zScale);
    R.drawCyl(ctx, tx + 0.32, ty + 0.32, 3.5, 0.11, 5, '#5D6B7A', { n: 12 }, zScale);
  }

  function drawRepairBayLv2Arm(ctx, st, tx, ty, healCol, timeSec, zScale) {
    const Iso = ZS.Iso;
    const sway = st.isPreview ? 0 : Math.sin(timeSec * 3.2) * 0.8;
    const a = Iso.gridToScreen(tx + 0.32, ty + 0.32, 8.5);
    const b = Iso.gridToScreen(tx + 0.46, ty + 0.42, 22.5);
    const c = Iso.gridToScreen(tx + 0.66, ty + 0.62, 15.5 + sway);
    R.drawIsoLine(ctx, a, b, '#F0A93A', 3.2, true, zScale);
    R.drawIsoLine(ctx, b, c, '#F0A93A', 3.2, true, zScale);
    R.drawIsoDot(ctx, b, 2.2, '#5D6B7A', false, zScale);
    R.drawIsoDot(ctx, c, 2.6, healCol, true, zScale);
  }

  function drawRepairBayLv3Static(ctx, tx, ty, healCol, zScale) {
    const Iso = ZS.Iso;
    R.drawIsoBox(ctx, tx + 0.05, ty + 0.05, 0.5, 0.90, 0.90, 3.6, '#3E4956', null, zScale);
    R.drawIsoBox(ctx, tx + 0.045, ty + 0.045, 1.2, 0.91, 0.91, 1.2, '#F0A93A', { noTop: true }, zScale);
    R.drawRingGlow(ctx, tx + 0.50, ty + 0.58, 4.2, 0.25, 1.2, healCol, true, 20, zScale);
    R.drawIsoRibbon(ctx, Iso.gridToScreen(tx + 0.42, ty + 0.58, 4.2), Iso.gridToScreen(tx + 0.58, ty + 0.58, 4.2), 1.0, healCol, true, zScale);
    R.drawIsoRibbon(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, 4.2), Iso.gridToScreen(tx + 0.50, ty + 0.66, 4.2), 1.0, healCol, true, zScale);
    R.drawIsoBox(ctx, tx + 0.14, ty + 0.10, 4.1, 0.72, 0.20, 10.5, '#596673', null, zScale);
    R.drawIsoBox(ctx, tx + 0.28, ty + 0.305, 6.2, 0.44, 0.015, 5.2, healCol, { emissive: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.16, ty + 0.14, 14.6, 0.06, 0.06, 5.2, '#F0A93A', null, zScale);
    R.drawIsoBox(ctx, tx + 0.78, ty + 0.14, 14.6, 0.06, 0.06, 5.2, '#F0A93A', null, zScale);
  }

  function drawRepairBayLv3Drone(ctx, st, tx, ty, healCol, timeSec, zScale) {
    const Iso = ZS.Iso;
    const bob = st.isPreview ? 0 : Math.sin(timeSec * 3.0 + tx + ty) * 0.8;
    const dz = 23.8 + bob;
    const rotors = [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]];
    for (let i = 0; i < rotors.length; i++) {
      const ox = rotors[i][0];
      const oy = rotors[i][1];
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.50, ty + 0.56, dz + 1.4),
        Iso.gridToScreen(tx + 0.50 + ox, ty + 0.56 + oy, dz + 2.2),
        '#6B7A8A',
        1.6,
        true,
        zScale
      );
      R.drawRingGlow(ctx, tx + 0.50 + ox, ty + 0.56 + oy, dz + 2.4, 0.075, 0.7, '#C9D3DE', false, 12, zScale);
    }
    R.drawIsoBox(ctx, tx + 0.41, ty + 0.47, dz, 0.18, 0.18, 3.2, '#E3EBF2', null, zScale);
    R.drawIsoBox(ctx, tx + 0.45, ty + 0.51, dz + 3.2, 0.10, 0.10, 1.4, healCol, { emissive: true }, zScale);
    R.drawIsoRibbon(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.56, dz), Iso.gridToScreen(tx + 0.50, ty + 0.56, 4.4), 0.75, healCol, true, zScale);
  }

  function drawBossTrophyStatic(ctx, tx, ty, zScale) {
    R.drawFrustum(ctx, tx + 0.18, ty + 0.18, 0.5, 0.64, 0.64, 10, 0.06, '#2E3744', null, zScale);
    R.drawIsoBox(ctx, tx + 0.24, ty + 0.24, 10.5, 0.52, 0.52, 1.5, '#D4AF37', null, zScale);
  }

  function drawBossTrophyOrb(ctx, tx, ty, timeSec, zScale) {
    const bobZ = 25.5 + Math.sin(timeSec * 3.2) * 1.8;
    R.drawOctahedron(ctx, tx + 0.5, ty + 0.5, bobZ, 0.14, 9, '#FFE066', true, zScale);
  }

  function drawBatteryBankBody(ctx, tx, ty, lv, ratio, hasCharge, ledColor, P, zScale) {
    if (lv <= 1) {
      R.drawIsoBox(ctx, tx + 0.24, ty + 0.28, 0.5, 0.52, 0.44, 2.0, '#3E4854', null, zScale);
      R.drawIsoBox(ctx, tx + 0.27, ty + 0.31, 2.5, 0.46, 0.38, 8.2, '#6A7B8C', null, zScale);
      R.drawIsoBox(ctx, tx + 0.30, ty + 0.34, 10.7, 0.40, 0.32, 1.5, '#475361', null, zScale);
      R.drawIsoBox(ctx, tx + 0.36, ty + 0.46, 12.2, 0.06, 0.06, 1.6, '#DCE5EE', null, zScale);
      R.drawIsoBox(ctx, tx + 0.58, ty + 0.46, 12.2, 0.06, 0.06, 1.6, '#DCE5EE', null, zScale);
      for (let k = 0; k < 2; k++) {
        const lit = ratio > k * 0.4 && hasCharge;
        R.drawIsoBox(ctx, tx + 0.34, ty + 0.695, 4.0 + k * 3.1, 0.32, 0.015, 2.0, lit ? ledColor : P.powerDim, { emissive: lit }, zScale);
      }
    } else if (lv === 2) {
      const posts = [[0.18, 0.26], [0.76, 0.26], [0.18, 0.66], [0.76, 0.66]];
      for (let i = 0; i < posts.length; i++) {
        R.drawIsoBox(ctx, tx + posts[i][0], ty + posts[i][1], 0.5, 0.06, 0.06, 20.5, '#475361', null, zScale);
      }
      const shelves = [0.5, 10.5, 20.0];
      for (let i = 0; i < shelves.length; i++) {
        R.drawIsoBox(ctx, tx + 0.18, ty + 0.26, shelves[i], 0.64, 0.46, 1.2, '#596673', null, zScale);
      }
      const modZs = [2.0, 12.0];
      for (let mi = 0; mi < modZs.length; mi++) {
        const mz = modZs[mi];
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.30, mz, 0.52, 0.38, 7.8, '#C9D4DF', null, zScale);
        for (let k = 0; k < 3; k++) {
          const lit = (mi * 3 + k) / 6 < ratio && hasCharge;
          R.drawIsoBox(ctx, tx + 0.28 + k * 0.16, ty + 0.685, mz + 1.8, 0.11, 0.015, 4.2, lit ? ledColor : P.powerDim, { emissive: lit }, zScale);
        }
      }
    } else if (lv === 3) {
      const cabXs = [0.14, 0.58];
      for (let c = 0; c < cabXs.length; c++) {
        const cx = tx + cabXs[c];
        R.drawIsoBox(ctx, cx, ty + 0.32, 0.5, 0.24, 0.34, 30.0, '#DDE5EC', null, zScale);
        R.drawIsoBox(ctx, cx + 0.03, ty + 0.35, 30.5, 0.18, 0.28, 1.8, '#9AA8B6', null, zScale);
        const litSlots = hasCharge ? Math.max(1, Math.round(ratio * 4)) : 0;
        for (let k = 0; k < 4; k++) {
          const lit = k < litSlots;
          R.drawIsoBox(ctx, cx + 0.04, ty + 0.655, 5.2 + k * 5.6, 0.16, 0.014, 3.6, lit ? ledColor : P.powerDim, { emissive: lit }, zScale);
        }
      }
    } else {
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 0.5, 0.40, 4.5, '#3B4654', { n: 8 }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 5.0, 0.31, 2.0, '#596878', { n: 8 }, zScale);
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 7.0, 0.17, 25.0, P.powerDim, { n: 14 }, zScale);
      if (hasCharge) {
        const litH = Math.max(4.0, 25.0 * ratio);
        R.drawCyl(ctx, tx + 0.50, ty + 0.50, 7.0, 0.174, litH, ledColor, { n: 14, emissive: true, noTop: true }, zScale);
      }
      const ringZs = [11.0, 18.5, 26.0];
      for (let i = 0; i < ringZs.length; i++) {
        R.drawCyl(ctx, tx + 0.50, ty + 0.50, ringZs[i], 0.22, 1.6, '#DCE5EE', { n: 14 }, zScale);
      }
      const fins = [[0.17, 0.46], [0.75, 0.46], [0.46, 0.17], [0.46, 0.75]];
      for (let i = 0; i < fins.length; i++) {
        R.drawIsoBox(ctx, tx + fins[i][0], ty + fins[i][1], 5.0, 0.08, 0.08, 29.0, '#475361', null, zScale);
      }
      R.drawCyl(ctx, tx + 0.50, ty + 0.50, 32.0, 0.24, 3.0, '#DCE5EE', { n: 12 }, zScale);
      R.drawDome(ctx, tx + 0.50, ty + 0.50, 35.0, 0.12, 4.5, hasCharge ? ledColor : P.powerDim, { emissive: hasCharge }, zScale);
    }
  }

  function drawFullStaticStructBody(ctx, id, lv, tx, ty, isUnpowered, solarOff, P, steelCol, maxAccent, zScale) {
    const Iso = ZS.Iso;
    switch (id) {
      case 'hesco_wall': {
        const s = 0.37;
        const gp = 0.12;
        const o = 0.07;
        const h = 12.5;
        const cells = [[o, o], [o + s + gp, o], [o, o + s + gp], [o + s + gp, o + s + gp]];
        for (let i = 0; i < cells.length; i++) {
          const cx = tx + cells[i][0];
          const cy = ty + cells[i][1];
          R.drawIsoBox(ctx, cx, cy, 0.5, s, s, h, '#C9B48A', null, zScale);
          R.drawIsoBox(ctx, cx + 0.05, cy + 0.05, 0.5 + h, s - 0.10, s - 0.10, 0.6, '#9E8758', null, zScale);
          if (lv >= 2) {
            R.drawIsoBox(ctx, cx - 0.006, cy - 0.006, 4.8, s + 0.012, s + 0.012, 2.2, steelCol, { noTop: true }, zScale);
          }
        }
        if (lv >= 3) {
          R.drawIsoBox(ctx, tx + 0.055, ty + 0.055, 0.5 + h + 0.6, 0.89, 0.89, 1.2, maxAccent, { noTop: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.06, ty + 0.06, 0.5 + h + 1.8, 0.88, 0.88, 2.4, steelCol, null, zScale);
        }
        break;
      }

      case 'blast_wall': {
        R.drawFrustum(ctx, tx + 0.06, ty + 0.06, 0.5, 0.88, 0.88, 24, 0.21, '#6B7686', null, zScale);
        const i4 = (0.21 * 4) / 24;
        const i8 = (0.21 * 8) / 24;
        R.drawFrustum(ctx, tx + 0.06 + i4, ty + 0.06 + i4, 4.5, 0.88 - 2 * i4, 0.88 - 2 * i4, 4, i8 - i4, '#F0BD35', { noTop: true }, zScale);
        if (lv >= 2) {
          const i12 = (0.21 * 12) / 24;
          const i15 = (0.21 * 15) / 24;
          R.drawFrustum(ctx, tx + 0.055 + i12, ty + 0.055 + i12, 12.5, 0.89 - 2 * i12, 0.89 - 2 * i12, 3, i15 - i12, steelCol, { noTop: true }, zScale);
        }
        if (lv >= 3) {
          R.drawIsoBox(ctx, tx + 0.23, ty + 0.23, 24.5, 0.54, 0.54, 1.3, maxAccent, { noTop: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.24, ty + 0.24, 25.8, 0.52, 0.52, 2.4, steelCol, null, zScale);
        }
        break;
      }

      case 'missile_pod': {
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 6.5, '#4C574A', { n: 16 }, zScale);
        R.drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.4, 0.366, isUnpowered, zScale);
        if (lv >= 2) {
          R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.0, 0.31, 1.8, steelCol, { n: 16 }, zScale);
        }
        const podCol = isUnpowered ? '#596159' : '#6C7D65';
        const x0 = tx + 0.21, x1 = tx + 0.79, y0 = ty + 0.20, y1 = ty + 0.76;
        const bA = Iso.gridToScreen(x0, y0, 8.2), bB = Iso.gridToScreen(x1, y0, 8.2);
        const bC = Iso.gridToScreen(x1, y1, 12.0), bD = Iso.gridToScreen(x0, y1, 12.0);
        const tA = Iso.gridToScreen(x0, y0, 17.5), tB = Iso.gridToScreen(x1, y0, 17.5);
        const tC = Iso.gridToScreen(x1, y1, 21.8), tD = Iso.gridToScreen(x0, y1, 21.8);
        R.drawPolyFace(ctx, [tD, tC, bC, bD], podCol, 0.82, false, true, zScale);
        R.drawPolyFace(ctx, [tC, tB, bB, bC], podCol, 0.66, false, true, zScale);
        R.drawPolyFace(ctx, [tA, tB, tC, tD], lv >= 3 ? maxAccent : podCol, 1.0, false, true, zScale);

        const tubeXs = [0.35, 0.61];
        const tubeZs = [14.6, 19.0];
        for (let ix = 0; ix < tubeXs.length; ix++) {
          for (let iz = 0; iz < tubeZs.length; iz++) {
            const c = Iso.gridToScreen(tx + tubeXs[ix], ty + 0.765, tubeZs[iz]);
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 3.1 * zScale, 2.7 * zScale, 0, 0, Math.PI * 2);
            ctx.fillStyle = Iso.resolveFaceColor('#20261D', 1.0, false, 0);
            ctx.fill();
            R.drawIsoDot(ctx, c, 1.3, isUnpowered ? '#5A3A32' : '#E0603A', !isUnpowered, zScale);
          }
        }
        break;
      }

      case 'solar_array': {
        const gunmetal = P.milGunmetal || '#3B4552';
        const slate = P.milSlate || '#525E6B';
        const olive = P.milOlive || '#6B7A5E';
        const bezel = P.milBrushed || '#B8C4D0';
        const cellCol = P.milSolarCell || '#1A3048';
        const cellDeep = P.milSolarCellDeep || '#122235';
        const gridCol = P.milSolarGrid || '#89A1B8';
        const ledCol = solarOff ? P.powerDim : P.power;

        if (lv <= 1) {
          // Compact ~68% military skid rails + angled A-frame truss struts + side micro-inverter box + 3x2 slate-navy solar module
          R.drawDetailedIsoBox(ctx, tx + 0.20, ty + 0.24, 0.4, 0.60, 0.06, 1.3, gunmetal, { bevel: true, groundCrease: true }, zScale);
          R.drawDetailedIsoBox(ctx, tx + 0.20, ty + 0.70, 0.4, 0.60, 0.06, 1.3, gunmetal, { bevel: true, groundCrease: true }, zScale);
          // Rear A-frame truss struts & hydraulic brace
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.30, ty + 0.27, 1.5), Iso.gridToScreen(tx + 0.30, ty + 0.27, 10.6), slate, 1.9, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.68, ty + 0.27, 1.5), Iso.gridToScreen(tx + 0.68, ty + 0.27, 10.6), slate, 1.9, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.30, ty + 0.72, 1.5), Iso.gridToScreen(tx + 0.30, ty + 0.29, 9.8), '#788694', 1.3, false, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.68, ty + 0.72, 1.5), Iso.gridToScreen(tx + 0.68, ty + 0.29, 9.8), '#788694', 1.3, false, zScale);
          // Front low mounting cleats
          R.drawDetailedIsoBox(ctx, tx + 0.28, ty + 0.69, 1.7, 0.06, 0.06, 3.2, slate, { bevel: true }, zScale);
          R.drawDetailedIsoBox(ctx, tx + 0.66, ty + 0.69, 1.7, 0.06, 0.06, 3.2, slate, { bevel: true }, zScale);
          // Compact olive field inverter & junction box on left skid
          R.drawDetailedIsoBox(ctx, tx + 0.14, ty + 0.50, 0.5, 0.11, 0.19, 4.4, olive, { bevel: true, groundCrease: true }, zScale);
          R.drawIsoLouvers(ctx, 'left', tx + 0.155, ty + 0.69, 1.6, 0.08, 2, 1.1, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.195, ty + 0.695, 3.9), 1.2, ledCol, !solarOff, zScale);
          // Precision brushed-bezel solar panel (3x2 wafer array)
          R.drawSlantedSolarPanel(ctx, tx + 0.21, ty + 0.21, 0.60, 0.54, 11.4, 4.8, 1.25, bezel, cellCol, gridCol, 3, 2, zScale);
        } else if (lv === 2) {
          // Medium ~76% tracking pedestal + twin hydraulic actuators + inverter cabinet + dense 4x3 panel array
          R.drawDetailedFrustum(ctx, tx + 0.30, ty + 0.32, 0.4, 0.40, 0.36, 2.2, 0.04, gunmetal, { bevel: true, groundCrease: true }, zScale);
          R.drawIsoCornerRivets(ctx, tx + 0.30, ty + 0.32, 2.6, 0.40, 0.36, 0.05, 0.75, '#BAC6D2', zScale);
          R.drawDetailedIsoBox(ctx, tx + 0.44, ty + 0.43, 2.6, 0.12, 0.12, 8.2, slate, { bevel: true }, zScale);
          // Angled steel cross-beams & hydraulic rams under panel
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.24, ty + 0.30, 13.8), Iso.gridToScreen(tx + 0.76, ty + 0.30, 13.8), '#8A98A6', 1.8, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.38, ty + 0.52, 4.2), Iso.gridToScreen(tx + 0.28, ty + 0.28, 13.4), '#9AA8B6', 1.4, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.62, ty + 0.52, 4.2), Iso.gridToScreen(tx + 0.72, ty + 0.28, 13.4), '#9AA8B6', 1.4, true, zScale);
          // Front-left tactical inverter box
          R.drawDetailedIsoBox(ctx, tx + 0.18, ty + 0.58, 0.5, 0.15, 0.18, 5.2, olive, { bevel: true, groundCrease: true }, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.25, ty + 0.765, 4.4), 1.25, ledCol, !solarOff, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.14, ty + 0.16, 0.72, 0.64, 15.8, 7.6, 1.45, bezel, cellCol, gridCol, 4, 3, zScale);
        } else if (lv === 3) {
          // Dual-wing military tracking solar generator (~80% footprint) + armored mast + transformer box
          R.drawDetailedFrustum(ctx, tx + 0.30, ty + 0.30, 0.4, 0.40, 0.38, 2.6, 0.04, gunmetal, { bevel: true, groundCrease: true }, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.46, 3.0, 0.13, 1.8, slate, { n: 12 }, zScale);
          R.drawTaperedCyl(ctx, tx + 0.50, ty + 0.46, 4.8, 0.068, 0.052, 11.2, '#94A2B0', { n: 10, specHighlight: true }, zScale);
          // Horizontal torque tube & actuator struts
          R.drawDetailedIsoBox(ctx, tx + 0.16, ty + 0.39, 15.2, 0.68, 0.07, 1.6, slate, { bevel: true }, zScale);
          // Front compact military inverter unit (tiny LED strip only — no large cyan ring)
          R.drawDetailedIsoBox(ctx, tx + 0.36, ty + 0.64, 0.5, 0.28, 0.18, 6.2, slate, { bevel: true, groundCrease: true }, zScale);
          R.drawDetailedIsoBox(ctx, tx + 0.38, ty + 0.66, 6.7, 0.24, 0.14, 0.8, olive, { bevel: true }, zScale);
          R.drawIsoLouvers(ctx, 'left', tx + 0.39, ty + 0.82, 1.8, 0.14, 3, 1.1, zScale);
          R.drawIsoBox(ctx, tx + 0.56, ty + 0.822, 4.2, 0.05, 0.014, 1.2, ledCol, { emissive: !solarOff }, zScale);
          // Twin precision solar wings (3x3 each)
          R.drawSlantedSolarPanel(ctx, tx + 0.09, ty + 0.14, 0.38, 0.56, 22.4, 12.6, 1.35, bezel, cellCol, gridCol, 3, 3, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.53, ty + 0.14, 0.38, 0.56, 22.4, 12.6, 1.35, bezel, cellCol, gridCol, 3, 3, zScale);
        } else {
          // Lv.4 Tactical Solar Power Station: compact ~82% armored gantry + upper main 5x3 array + twin lower 3x2 collector wings
          R.drawDetailedFrustum(ctx, tx + 0.13, ty + 0.13, 0.4, 0.74, 0.74, 2.6, 0.04, gunmetal, { bevel: true, groundCrease: true }, zScale);
          R.drawIsoHazardBand(ctx, tx + 0.145, ty + 0.145, 1.1, 0.71, 0.71, 1.2, '#DFAC2E', '#232B35', 5, zScale);
          R.drawIsoCornerRivets(ctx, tx + 0.13, ty + 0.13, 3.0, 0.74, 0.74, 0.055, 0.85, '#C9D5E0', zScale);
          // Central armored support pylon + inverter core
          R.drawDetailedIsoBox(ctx, tx + 0.39, ty + 0.35, 3.0, 0.22, 0.22, 22.5, slate, { bevel: true }, zScale);
          R.drawIsoFaceSeams(ctx, 'left', tx + 0.39, ty + 0.35, 3.5, 0.22, 0.22, 21.0, 2, 'rgba(10, 14, 20, 0.42)', zScale);
          R.drawIsoBox(ctx, tx + 0.386, ty + 0.346, 17.5, 0.228, 0.228, 1.0, ledCol, { noTop: true, emissive: !solarOff }, zScale);
          R.drawDetailedIsoBox(ctx, tx + 0.42, ty + 0.38, 25.5, 0.16, 0.16, 4.2, olive, { bevel: true }, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.46, 30.3), 1.5, ledCol, !solarOff, zScale);
          // Upper high-elevation 5x3 array + twin lower 3x2 flank arrays
          R.drawSlantedSolarPanel(ctx, tx + 0.11, ty + 0.10, 0.78, 0.38, 29.2, 21.2, 1.45, bezel, cellDeep, gridCol, 5, 3, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.10, ty + 0.48, 0.33, 0.40, 14.4, 8.0, 1.25, bezel, cellCol, gridCol, 3, 2, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.57, ty + 0.48, 0.33, 0.40, 14.4, 8.0, 1.25, bezel, cellCol, gridCol, 3, 2, zScale);
        }
        break;
      }

      case 'field_tent':
      case 'shelter_pod': {
        const effTier = id === 'shelter_pod' ? 3 : lv;
        if (effTier <= 1) {
          R.drawDome(ctx, tx + 0.5, ty + 0.5, 0.5, 0.42, 15.0, '#6E8466', { n: 16 }, zScale);
          R.drawPolyFace(
            ctx,
            [
              Iso.gridToScreen(tx + 0.40, ty + 0.915, 0.5),
              Iso.gridToScreen(tx + 0.60, ty + 0.915, 0.5),
              Iso.gridToScreen(tx + 0.50, ty + 0.915, 10.5)
            ],
            '#2E3A2B', 1.0, false, false, zScale
          );
          R.drawPolyFace(
            ctx,
            [
              Iso.gridToScreen(tx + 0.44, ty + 0.92, 0.5),
              Iso.gridToScreen(tx + 0.56, ty + 0.92, 0.5),
              Iso.gridToScreen(tx + 0.50, ty + 0.92, 7.5)
            ],
            P.baseLight, 1.0, true, false, zScale
          );
        } else if (effTier === 2) {
          R.drawIsoBox(ctx, tx + 0.05, ty + 0.12, 0.5, 0.90, 0.76, 1.6, '#7A5E42', null, zScale);
          R.drawIsoBox(ctx, tx + 0.07, ty + 0.16, 2.1, 0.41, 0.66, 8.8, '#5F7758', null, zScale);
          R.drawIsoBox(ctx, tx + 0.50, ty + 0.16, 2.1, 0.43, 0.66, 8.8, '#5F7758', null, zScale);
          R.drawGable(ctx, tx + 0.06, ty + 0.14, 10.9, 0.43, 0.70, 5.8, '#768F6D', '#5F7758', zScale);
          R.drawGable(ctx, tx + 0.49, ty + 0.14, 10.9, 0.45, 0.70, 5.8, '#768F6D', '#5F7758', zScale);
          R.drawIsoBox(ctx, tx + 0.14, ty + 0.825, 4.8, 0.22, 0.015, 4.0, P.baseLight, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.64, ty + 0.825, 4.8, 0.22, 0.015, 4.0, P.baseLight, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.43, ty + 0.825, 2.1, 0.14, 0.015, 7.2, '#2E3A2B', null, zScale);
          R.drawIsoBox(ctx, tx + 0.76, ty + 0.28, 14.0, 0.05, 0.05, 5.0, '#8C96A3', null, zScale);
        } else if (effTier === 3) {
          R.drawIsoBox(ctx, tx + 0.06, ty + 0.14, 0.5, 0.88, 0.72, 13.0, '#DCE5ED', null, zScale);
          R.drawGable(ctx, tx + 0.03, ty + 0.11, 13.5, 0.94, 0.78, 8.0, '#EA6A3B', '#DCE5ED', zScale);
          R.drawIsoBox(ctx, tx + 0.18, ty + 0.86, 4.5, 0.46, 0.015, 5.0, P.baseLight, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.72, ty + 0.86, 0.5, 0.13, 0.015, 9.0, '#556370', null, zScale);
        } else {
          R.drawIsoBox(ctx, tx + 0.05, ty + 0.12, 0.5, 0.90, 0.76, 12.0, '#C8D4E0', null, zScale);
          const pillars = [[0.05, 0.12], [0.89, 0.12], [0.05, 0.82], [0.89, 0.82]];
          for (let i = 0; i < pillars.length; i++) {
            R.drawIsoBox(ctx, tx + pillars[i][0], ty + pillars[i][1], 0.5, 0.06, 0.06, 12.0, '#4E5B68', null, zScale);
          }
          R.drawIsoBox(ctx, tx + 0.14, ty + 0.885, 4.2, 0.42, 0.015, 4.8, P.baseLight, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.66, ty + 0.885, 0.5, 0.15, 0.015, 9.2, '#475361', null, zScale);
          R.drawIsoBox(ctx, tx + 0.07, ty + 0.14, 12.5, 0.70, 0.68, 10.5, '#DCE5ED', null, zScale);
          R.drawIsoBox(ctx, tx + 0.77, ty + 0.16, 12.5, 0.18, 0.64, 1.2, '#596673', null, zScale);
          R.drawIsoBox(ctx, tx + 0.77, ty + 0.77, 13.7, 0.18, 0.03, 3.0, '#475361', null, zScale);
          R.drawIsoBox(ctx, tx + 0.92, ty + 0.16, 13.7, 0.03, 0.64, 3.0, '#475361', null, zScale);
          R.drawIsoBox(ctx, tx + 0.15, ty + 0.825, 15.8, 0.50, 0.015, 4.6, P.baseLight, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.775, ty + 0.28, 15.8, 0.015, 0.34, 4.6, P.baseLight, { emissive: true }, zScale);
          R.drawGable(ctx, tx + 0.05, ty + 0.11, 23.0, 0.74, 0.74, 6.5, P.habitatRoof || '#D96B38', '#DCE5ED', zScale);
          R.drawIsoBox(ctx, tx + 0.18, ty + 0.24, 27.8, 0.18, 0.16, 3.4, '#7B8996', null, zScale);
        }
        break;
      }

      case 'gas_heater': {
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.14, 2, '#5D6873', { n: 12 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 2.5, 0.045, 17, '#9AA6B2', { n: 8 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.08, 8, '#FFB347', { emissive: true, n: 10 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 19.5, 0.30, 1.5, '#D5DEE7', { n: 16 }, zScale);
        R.drawCone(ctx, tx + 0.5, ty + 0.5, 21.0, 0.30, 4, '#D5DEE7', { n: 16 }, zScale);
        break;
      }

      case 'led_floodlight': {
        const top = Iso.gridToScreen(tx + 0.5, ty + 0.5, 15.5);
        R.drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.55, ty + 0.16, 0.5), '#EBA834', 1.8, true, zScale);
        R.drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.84, ty + 0.66, 0.5), '#EBA834', 1.8, true, zScale);
        R.drawIsoBox(ctx, tx + 0.28, ty + 0.38, 15.3, 0.44, 0.26, 1.3, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, noTop: true }, zScale);
        R.drawIsoBox(ctx, tx + 0.28, ty + 0.38, 16.5, 0.44, 0.26, 7, '#59636E', null, zScale);
        R.drawIsoBox(ctx, tx + 0.31, ty + 0.635, 17.5, 0.38, 0.015, 5, isUnpowered ? '#4B5563' : '#FFF6DA', { emissive: !isUnpowered }, zScale);
        R.drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.18, ty + 0.78, 0.5), '#EBA834', 1.8, true, zScale);
        break;
      }

      case 'urban_planter': {
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.30, 7, '#B8C0C7', { n: 16 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.26, 0.02, '#5E493A', { n: 16, noSides: true, topEdge: false }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.045, 6, '#6B4A33', { n: 8 }, zScale);
        R.drawBlob(ctx, tx + 0.5, ty + 0.5, 12.5, 0.32, 15, '#5DBB63', { n: 14 }, zScale);
        R.drawBlob(ctx, tx + 0.52, ty + 0.48, 22.5, 0.20, 9, '#77D27A', { n: 12 }, zScale);
        break;
      }

      case 'vending_machine': {
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.27, 0.5, 0.52, 0.46, 22, '#2E86DE', null, zScale);
        R.drawIsoBox(ctx, tx + 0.28, ty + 0.725, 8.5, 0.30, 0.015, 11, '#FFF3D6', { emissive: true }, zScale);
        R.drawIsoBox(ctx, tx + 0.62, ty + 0.725, 10.5, 0.08, 0.015, 6, '#1B4F86', null, zScale);
        R.drawIsoBox(ctx, tx + 0.30, ty + 0.725, 3.0, 0.32, 0.015, 3, '#14365C', null, zScale);
        break;
      }

      case 'repair_bay': {
        const healCol = P.repairNano || P.heal || '#4ADE80';
        R.drawIsoBox(ctx, tx + 0.14, ty + 0.16, 0.5, 0.72, 0.68, 2.2, '#475361', null, zScale);
        R.drawIsoBox(ctx, tx + 0.18, ty + 0.18, 2.7, 0.42, 0.09, 11.5, '#5D6B7A', null, zScale);
        R.drawIsoBox(ctx, tx + 0.18, ty + 0.18, 14.2, 0.42, 0.09, 1.2, '#F0A93A', null, zScale);
        R.drawCyl(ctx, tx + 0.70, ty + 0.28, 2.7, 0.055, 10.2, '#D97724', { n: 10 }, zScale);
        R.drawCyl(ctx, tx + 0.78, ty + 0.38, 2.7, 0.055, 9.2, '#7B8996', { n: 10 }, zScale);
        R.drawIsoBox(ctx, tx + 0.22, ty + 0.52, 2.7, 0.30, 0.22, 5.2, '#3A4450', null, zScale);
        const a = Iso.gridToScreen(tx + 0.42, ty + 0.26, 14.5);
        const b = Iso.gridToScreen(tx + 0.44, ty + 0.50, 17.5);
        const c = Iso.gridToScreen(tx + 0.38, ty + 0.58, 12.2);
        R.drawIsoLine(ctx, a, b, '#F0A93A', 2.4, true, zScale);
        R.drawIsoLine(ctx, b, c, '#F0A93A', 2.4, true, zScale);
        R.drawIsoDot(ctx, b, 1.8, '#5D6B7A', false, zScale);
        R.drawIsoDot(ctx, c, 2.1, healCol, true, zScale);
        break;
      }

      case 'lounge_set': {
        R.drawIsoBox(ctx, tx + 0.16, ty + 0.58, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        R.drawIsoBox(ctx, tx + 0.62, ty + 0.18, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.17, 7, '#E8EEF5', { n: 16 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.025, 15, '#A0AEC0', { n: 6 }, zScale);
        R.drawCone(ctx, tx + 0.5, ty + 0.5, 21.5, 0.44, 6, '#F4E6C8', { alt: '#E8A04A', n: 12 }, zScale);
        break;
      }

      case 'arcade_neon': {
        R.drawIsoBox(ctx, tx + 0.255, ty + 0.215, 1.4, 0.49, 0.45, 1.3, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, noTop: true }, zScale);
        R.drawIsoBox(ctx, tx + 0.26, ty + 0.22, 0.5, 0.48, 0.44, 20, '#3A2C54', null, zScale);
        R.drawIsoBox(ctx, tx + 0.27, ty + 0.66, 0.5, 0.46, 0.20, 9, '#2B2040', null, zScale);
        R.drawIsoBox(ctx, tx + 0.29, ty + 0.855, 2.5, 0.42, 0.015, 5, isUnpowered ? '#4D3B59' : '#FF5CE1', { emissive: !isUnpowered }, zScale);
        R.drawIsoBox(ctx, tx + 0.30, ty + 0.655, 10.5, 0.40, 0.015, 8, isUnpowered ? '#354856' : '#52E8FF', { emissive: !isUnpowered }, zScale);
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.20, 20.5, 0.52, 0.62, 2, '#2B2040', null, zScale);
        R.drawIsoBox(ctx, tx + 0.25, ty + 0.81, 21.0, 0.50, 0.015, 3.4, isUnpowered ? '#4D3B59' : '#C742E8', { emissive: !isUnpowered }, zScale);
        R.drawIsoBox(ctx, tx + 0.26, ty + 0.22, 22.5, 0.48, 0.30, 4, '#3A2C54', null, zScale);
        break;
      }
    }
  }

  function drawStructure(ctx, st, tx, ty, state, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const id = st.id;
    const lv = st.level || 1;
    const steelCol = P.steelBand || '#8C96A3';
    const maxAccent = P.levelMax || '#FF9F43';
    const def = id === 'command_hq' ? ZS.DATA.HQ_STATS : ZS.DATA.ITEMS[id];
    const isUnpowered = (state.isNight && def && def.requiresPower && !powered) || !!(def && def.requiresPower && (st.empStunTimer || 0) > 0);
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const healCol = P.repairNano || P.heal || '#4ADE80';

    const canTryStamp =
      !isNodeAnimatingOrFlashing(st) &&
      !(st.mounted && isNodeAnimatingOrFlashing(st.mounted));

    if (canTryStamp) {
      const tintBucket = getTintBucket(state, isSil);
      const topZ = R.getStructVisualTopZ(id, lv);
      const aim = st.aimAngle != null ? st.aimAngle : 0.8;

      if (id === 'command_hq') {
        const hqLv = Math.max(1, Math.min(4, st.level || state.hqLevel || 1));
        const hqTopZ = [38, 34, 42, 52][hqLv - 1];
        const stamp = ensureStructureStamp(`hq|${hqLv}|${tintBucket}`, hqTopZ, tintBucket, isSil, (sctx) => {
          drawHqContactShadow(sctx, 0, 0, hqLv, isSil, 1.0);
          drawHqStaticBody(sctx, 0, 0, 0.5, hqLv, P, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        drawHqDynamicOverlay(ctx, tx, ty, 0.5, hqLv, aim, timeSec, P, zScale);
        return;
      }

      if (id === 'barricade_wall') {
        const mask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
        const hasMount = lv >= 2 && !!st.mounted;
        const wallTopZ = hasMount ? (lv >= 3 ? 29.0 : 18.6) : topZ;
        const stamp = ensureStructureStamp(`wall|${lv}|${mask}|${hasMount ? 1 : 0}|${tintBucket}`, wallTopZ, tintBucket, isSil, (sctx) => {
          drawWallContactShadow(sctx, 0, 0, mask, lv, isSil, 1.0);
          drawConnectedWallTile(sctx, 0, 0, mask, lv, hasMount, P, steelCol, maxAccent, 1.0);
          if (hasMount) drawWallDeck(sctx, lv, 0, 0, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        if (hasMount) {
          const mBaseZ = lv >= 3 ? 25.4 : 15.2;
          drawMountedUnit(ctx, st.mounted, tx, ty, mBaseZ, state, powered, timeSec, zScale);
        }
        return;
      }

      if (id === 'tactical_gate') {
        const mask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
        const alongY = Boolean((mask & 5) && !(mask & 10));
        const normMask = alongY ? 5 : 10;
        const stamp = ensureStructureStamp(`gate|${lv}|${alongY ? 1 : 0}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawGateContactShadow(sctx, 0, 0, normMask, lv, isSil, 1.0);
          drawTacticalGateTile(sctx, 0, 0, normMask, lv, P, steelCol, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'razor_pad') {
        const thrust = getTrapThrustAmount(st, tx, ty, state, timeSec);
        if (thrust <= 0.001) {
          if (lv <= 2) {
            const stamp = ensureStructureStamp(`razor|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
              drawRazorPadTile(sctx, { id: 'razor_pad', level: lv, isPreview: true }, 0, 0, lv, P, state, 0, 1.0, 0);
            });
            blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
            return;
          }
          const stamp = ensureStructureStamp(`razor|3|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
            drawRazorPadT3Static(sctx, 0, 0, P, 1.0);
          });
          blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
          drawRazorPadT3Arcs(ctx, st, tx, ty, P, timeSec, zScale);
          return;
        }
        // Thrusting trap: fall through to dynamic live rendering
        drawRazorPadTile(ctx, st, tx, ty, lv, P, state, timeSec, zScale, thrust);
        return;
      }

      if (id === 'battery_bank') {
        const ratio = Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0.78));
        const hasCharge = ratio > 0.01;
        const chargeBucket = !hasCharge ? 0 : Math.max(1, Math.min(10, Math.round(ratio * 10)));
        const ledTier = ratio > 0.35 ? 2 : ratio > 0.05 ? 1 : 0;
        const qRatio = chargeBucket / 10;
        const qHasCharge = chargeBucket > 0;
        const qLedColor = ledTier === 2 ? P.power : ledTier === 1 ? P.healthMid : P.danger;
        const stamp = ensureStructureStamp(`battery|${lv}|${chargeBucket}|${ledTier}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawBatteryBankBody(sctx, 0, 0, lv, qRatio, qHasCharge, qLedColor, P, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'solar_array') {
        const solarOff = !!(state.isNight || !powered || (st.empStunTimer || 0) > 0);
        const stamp = ensureStructureStamp(`solar|${lv}|${solarOff ? 1 : 0}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawFullStaticStructBody(sctx, id, lv, 0, 0, isUnpowered, solarOff, P, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'field_tent' || id === 'shelter_pod') {
        const effTier = id === 'shelter_pod' ? 3 : lv;
        const stamp = ensureStructureStamp(`housing|${effTier}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawFullStaticStructBody(sctx, id, lv, 0, 0, false, false, P, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'hesco_wall' || id === 'blast_wall') {
        const stamp = ensureStructureStamp(`${id}|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawFullStaticStructBody(sctx, id, lv, 0, 0, false, false, P, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'missile_pod' || id === 'led_floodlight' || id === 'arcade_neon') {
        const keyLv = id === 'missile_pod' ? lv : 1;
        const stamp = ensureStructureStamp(`${id}|${keyLv}|${isUnpowered ? 1 : 0}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawFullStaticStructBody(sctx, id, lv, 0, 0, isUnpowered, false, P, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'gas_heater' || id === 'urban_planter' || id === 'vending_machine' || id === 'lounge_set') {
        const stamp = ensureStructureStamp(`${id}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawFullStaticStructBody(sctx, id, lv, 0, 0, false, false, P, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'wind_turbine') {
        const stamp = ensureStructureStamp(`wind|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawWindTurbineStatic(sctx, 0, 0, lv, P, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        drawWindTurbineRotors(ctx, tx, ty, lv, timeSec * 2.6 + (tx + ty), P, zScale);
        return;
      }

      if (id === 'vulcan_turret') {
        const stamp = ensureStructureStamp(`vulcan|${lv}|${isUnpowered ? 1 : 0}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawVulcanStatic(sctx, 0, 0, lv, isUnpowered, steelCol, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        drawVulcanBarrels(ctx, tx, ty, lv, isUnpowered, aim, P, zScale);
        return;
      }

      if (id === 'emp_coil') {
        const stamp = ensureStructureStamp(`emp|${lv}|${isUnpowered ? 1 : 0}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawEmpCoilStatic(sctx, 0, 0, lv, isUnpowered, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        drawEmpCoilOrb(ctx, tx, ty, isUnpowered, P, timeSec, zScale);
        return;
      }

      if (id === 'rifle_bunker') {
        const bStamp = ensureStructureStamp(`bunker_b|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawRifleBunkerBack(sctx, 0, 0, lv, 1.0);
        });
        blitStructureStamp(ctx, bStamp, tx, ty, zScale, isSil);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 2.2, '#55684F', '#3E4D3A', aim, zScale, false, lv >= 3);
        const fStamp = ensureStructureStamp(`bunker_f|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawRifleBunkerFront(sctx, 0, 0, lv, steelCol, 1.0);
        });
        blitStructureStamp(ctx, fStamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'shotgun_post') {
        const bStamp = ensureStructureStamp(`shotgun_b|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawShotgunPostBack(sctx, 0, 0, 1.0);
        });
        blitStructureStamp(ctx, bStamp, tx, ty, zScale, isSil);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.44, 1.8, '#3A4654', '#2F3945', aim, zScale, false, false);
        const fStamp = ensureStructureStamp(`shotgun_f|${lv}|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawShotgunPostFront(sctx, 0, 0, lv, steelCol, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, fStamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'sniper_tower') {
        const bStamp = ensureStructureStamp(`sniper_b|${lv}|${tintBucket}`, 46, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawSniperTowerBack(sctx, 0, 0, lv, steelCol, 1.0);
        });
        blitStructureStamp(ctx, bStamp, tx, ty, zScale, isSil);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 27.5, '#3D4D42', '#2F3B33', aim, zScale, true, false);
        const fStamp = ensureStructureStamp(`sniper_f|${lv}|${tintBucket}`, 54, tintBucket, isSil, (sctx) => {
          drawSniperTowerFront(sctx, 0, 0, lv, maxAccent, 1.0);
        });
        blitStructureStamp(ctx, fStamp, tx, ty, zScale, isSil);
        return;
      }

      if (id === 'repair_bay') {
        if (lv <= 1) {
          const stamp = ensureStructureStamp(`repair|1|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
            drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
            drawFullStaticStructBody(sctx, id, 1, 0, 0, false, false, P, steelCol, maxAccent, 1.0);
          });
          blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        } else if (lv === 2) {
          const stamp = ensureStructureStamp(`repair|2|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
            drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
            drawRepairBayLv2Static(sctx, 0, 0, 1.0);
          });
          blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
          drawRepairBayLv2Arm(ctx, st, tx, ty, healCol, timeSec, zScale);
        } else {
          const stamp = ensureStructureStamp(`repair|3|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
            drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
            drawRepairBayLv3Static(sctx, 0, 0, healCol, 1.0);
          });
          blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
          drawRepairBayLv3Drone(ctx, st, tx, ty, healCol, timeSec, zScale);
        }
        return;
      }

      if (id === 'boss_trophy') {
        const stamp = ensureStructureStamp(`boss_trophy|${tintBucket}`, topZ, tintBucket, isSil, (sctx) => {
          drawStructGroundShadow(sctx, 0, 0, def, isSil, 1.0);
          drawBossTrophyStatic(sctx, 0, 0, 1.0);
        });
        blitStructureStamp(ctx, stamp, tx, ty, zScale, isSil);
        drawBossTrophyOrb(ctx, tx, ty, timeSec, zScale);
        return;
      }
    }

    // Soft ground shadow (live fallback / HQ / animating / flashing / preview)
    if (id === 'command_hq') {
      drawHqContactShadow(ctx, tx, ty, Math.max(1, Math.min(4, st.level || state.hqLevel || 1)), isSil, zScale);
    } else if (id === 'barricade_wall') {
      const wMask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
      drawWallContactShadow(ctx, tx, ty, wMask, lv, isSil, zScale);
    } else if (id === 'tactical_gate') {
      const gMask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
      drawGateContactShadow(ctx, tx, ty, gMask, lv, isSil, zScale);
    } else {
      drawStructGroundShadow(ctx, tx, ty, def, isSil, zScale);
    }

    // Build placement drop OR collapse drop + landing squash
    let hasBuildTransform = false;
    let prevEmissives = R.emissiveList;
    if (st.buildAnimTimer && st.buildAnimTimer > 0) {
      const progress = 1 - Math.max(0, Math.min(1, st.buildAnimTimer / 0.34));
      const pivot = Iso.gridToScreen(tx + 0.5, ty + 0.5, 1);
      let scaleX = 1;
      let scaleY = 1;
      let dropY = 0;
      if (progress < 0.28) {
        const u = progress / 0.28;
        dropY = -(1 - u * u) * 20 * zScale;
        scaleX = 0.91 + 0.09 * u;
        scaleY = 1.12 - 0.12 * u;
      } else {
        const u = (progress - 0.28) / 0.72;
        const squash = Math.sin(u * Math.PI * 2.1) * Math.exp(-u * 3.8);
        scaleX = 1 + squash * 0.22;
        scaleY = 1 - squash * 0.26;
      }
      ctx.save();
      ctx.translate(pivot.x, pivot.y + dropY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-pivot.x, -pivot.y);
      hasBuildTransform = true;
      R.emissiveList = null;
    } else if (st.fallAnimTimer && st.fallAnimTimer > 0) {
      const dur = st.fallAnimDuration || 0.28;
      const p = 1 - Math.max(0, Math.min(1, st.fallAnimTimer / dur));
      const pivot = Iso.gridToScreen(tx + 0.5, ty + 0.5, 1);
      let scaleX = 1;
      let scaleY = 1;
      let dropY = 0;
      if (p < 0.78) {
        const u = p / 0.78;
        dropY = -(1 - u * u) * (st.fallStartZ || 15.2) * zScale;
        scaleX = 0.96 + 0.04 * u;
        scaleY = 1.04 - 0.04 * u;
      } else {
        const u = (p - 0.78) / 0.22;
        const k = 1 - u;
        scaleX = 1 + 0.08 * k;
        scaleY = 1 - 0.06 * k;
      }
      ctx.save();
      ctx.translate(pivot.x, pivot.y + dropY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-pivot.x, -pivot.y);
      hasBuildTransform = true;
      R.emissiveList = null;
    }

    Iso.setEntityFlash(st.hitFlash || 0);

    switch (id) {
      case 'command_hq': {
        drawHqByLevel(ctx, st, tx, ty, state, timeSec, zScale);
        break;
      }

      case 'barricade_wall': {
        const mask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
        const hasMount = lv >= 2 && !!st.mounted;
        drawConnectedWallTile(ctx, tx, ty, mask, lv, hasMount, P, steelCol, maxAccent, zScale);
        if (hasMount) {
          drawWallDeck(ctx, lv, tx, ty, zScale);
          const mBaseZ = lv >= 3 ? 25.4 : 15.2;
          drawMountedUnit(ctx, st.mounted, tx, ty, mBaseZ, state, powered, timeSec, zScale);
          Iso.setEntityFlash(st.hitFlash || 0);
        }
        break;
      }

      case 'tactical_gate': {
        const mask = st.previewMask != null ? st.previewMask : getWallConnectMask(state.structGrid, tx, ty);
        drawTacticalGateTile(ctx, tx, ty, mask, lv, P, steelCol, zScale);
        break;
      }

      case 'razor_pad': {
        drawRazorPadTile(ctx, st, tx, ty, lv, P, state, timeSec, zScale);
        break;
      }

      case 'rifle_bunker': {
        drawRifleBunkerBack(ctx, tx, ty, lv, zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 2.2, '#55684F', '#3E4D3A', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, lv >= 3);
        drawRifleBunkerFront(ctx, tx, ty, lv, steelCol, zScale);
        break;
      }

      case 'shotgun_post': {
        drawShotgunPostBack(ctx, tx, ty, zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.44, 1.8, '#3A4654', '#2F3945', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, false);
        drawShotgunPostFront(ctx, tx, ty, lv, steelCol, maxAccent, zScale);
        break;
      }

      case 'sniper_tower': {
        drawSniperTowerBack(ctx, tx, ty, lv, steelCol, zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 27.5, '#3D4D42', '#2F3B33', st.aimAngle != null ? st.aimAngle : 0.8, zScale, true, false);
        drawSniperTowerFront(ctx, tx, ty, lv, maxAccent, zScale);
        break;
      }

      case 'vulcan_turret': {
        drawVulcanStatic(ctx, tx, ty, lv, isUnpowered, steelCol, zScale);
        drawVulcanBarrels(ctx, tx, ty, lv, isUnpowered, st.aimAngle != null ? st.aimAngle : 0.8, P, zScale);
        break;
      }

      case 'emp_coil': {
        drawEmpCoilStatic(ctx, tx, ty, lv, isUnpowered, steelCol, maxAccent, zScale);
        drawEmpCoilOrb(ctx, tx, ty, isUnpowered, P, timeSec, zScale);
        break;
      }

      case 'wind_turbine': {
        const bladeAngle = st.isPreview ? 0.45 + (tx + ty) * 0.4 : timeSec * 2.6 + (tx + ty);
        drawWindTurbineStatic(ctx, tx, ty, lv, P, zScale);
        drawWindTurbineRotors(ctx, tx, ty, lv, bladeAngle, P, zScale);
        break;
      }

      case 'battery_bank': {
        const ratio = st.isPreview ? 0.78 : Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0.78));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        const hasCharge = ratio > 0.01;
        drawBatteryBankBody(ctx, tx, ty, lv, ratio, hasCharge, ledColor, P, zScale);
        break;
      }

      case 'repair_bay': {
        if (lv <= 1) {
          drawFullStaticStructBody(ctx, id, 1, tx, ty, isUnpowered, false, P, steelCol, maxAccent, zScale);
        } else if (lv === 2) {
          drawRepairBayLv2Static(ctx, tx, ty, zScale);
          drawRepairBayLv2Arm(ctx, st, tx, ty, healCol, timeSec, zScale);
        } else {
          drawRepairBayLv3Static(ctx, tx, ty, healCol, zScale);
          drawRepairBayLv3Drone(ctx, st, tx, ty, healCol, timeSec, zScale);
        }
        break;
      }

      case 'boss_trophy': {
        drawBossTrophyStatic(ctx, tx, ty, zScale);
        drawBossTrophyOrb(ctx, tx, ty, timeSec, zScale);
        break;
      }

      default: {
        const defaultSolarOff = id === 'solar_array' ? !!(state.isNight || !powered || (st.empStunTimer || 0) > 0) : !powered;
        drawFullStaticStructBody(ctx, id, lv, tx, ty, isUnpowered, defaultSolarOff, P, steelCol, maxAccent, zScale);
        break;
      }
    }

    Iso.setEntityFlash(0);
    if (hasBuildTransform) {
      ctx.restore();
      R.emissiveList = prevEmissives;
    }

    // 0.6s Facility Upgrade white scanline sweep VFX
    if (id !== 'command_hq' && st.upgradeAnimTimer > 0) {
      const p = 1 - Math.max(0, Math.min(1, st.upgradeAnimTimer / 0.6));
      const scanZ = 1 + p * R.getStructVisualTopZ(id, lv);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.85;
      Iso.drawTilePoly(ctx, tx + 0.08, ty + 0.08, scanZ, 'rgba(255,255,255,0.22)', '#FFFFFF', 2.0 * zScale);
      ctx.restore();
    }
  }

  function drawHqStaticBody(ctx, tx, ty, zb, lv, P, zScale) {
    const Iso = ZS.Iso;
    const olive = P.milOlive || '#6B7A5E';
    const oliveDark = P.milOliveDark || '#4D5943';
    const sand = P.milSand || '#B7A179';
    const gunmetal = P.milGunmetal || '#3B4552';
    const slate = P.milSlate || '#525E6B';
    const goldHex = P.gold || '#FFC94A';
    const amberLight = P.baseLight || '#FFD27A';
    const warmCore = P.hqAmberCore || '#FFF3D6';

    if (lv === 1) {
      // Lv.1 임시 지휘소: Warm golden glowing ground pad (0px cyan!) + sandbag defensive pockets + chamfered olive command container + awning + radio mast
      R.drawGroundGlowPad(ctx, tx, ty, 0.84, goldHex, 0.92, zScale);
      const bz = zb + 0.9;

      // Back sandbag parapet pockets
      R.drawDetailedIsoBox(ctx, tx + 0.14, ty + 0.16, bz, 0.24, 0.14, 3.6, sand, { bevel: false }, zScale);
      R.drawSandbagCoursesOnBox(ctx, tx + 0.14, ty + 0.16, bz, 0.24, 0.14, 3.6, 3, 2, 1, P.milSandSeam, false, zScale);

      // Main olive tactical command container (~58% footprint for crisp pad margin)
      R.drawDetailedIsoBox(ctx, tx + 0.21, ty + 0.22, bz, 0.56, 0.50, 12.2, olive, { bevel: true, groundCrease: true }, zScale);
      // Corrugated container panel seams & louvers
      R.drawIsoFaceSeams(ctx, 'left', tx + 0.21, ty + 0.22, bz + 0.6, 0.56, 0.50, 10.8, 5, 'rgba(12, 18, 14, 0.36)', zScale);
      R.drawIsoFaceSeams(ctx, 'right', tx + 0.21, ty + 0.22, bz + 0.6, 0.56, 0.50, 10.8, 4, 'rgba(12, 18, 14, 0.36)', zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.77, ty + 0.52, bz + 4.2, 0.14, 3, 1.2, zScale);

      // Recessed warm amber situation-room slit window & blast awning
      R.drawDetailedIsoBox(ctx, tx + 0.26, ty + 0.70, bz + 9.2, 0.34, 0.06, 1.0, gunmetal, { bevel: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.28, ty + 0.722, bz + 4.8, 0.30, 0.015, 4.0, amberLight, { emissive: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.63, ty + 0.722, bz + 1.2, 0.10, 0.015, 7.6, oliveDark, null, zScale);

      // Front sandbag defensive pockets
      R.drawDetailedIsoBox(ctx, tx + 0.15, ty + 0.66, bz, 0.22, 0.14, 3.8, sand, { bevel: false, groundCrease: true }, zScale);
      R.drawSandbagCoursesOnBox(ctx, tx + 0.15, ty + 0.66, bz, 0.22, 0.14, 3.8, 3, 2, 1, P.milSandSeam, false, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.65, ty + 0.64, bz, 0.18, 0.15, 3.8, sand, { bevel: false, groundCrease: true }, zScale);
      R.drawSandbagCoursesOnBox(ctx, tx + 0.65, ty + 0.64, bz, 0.18, 0.15, 3.8, 3, 2, 1, P.milSandSeam, false, zScale);

      // Roof HVAC unit, reinforced trim & tall radio mast
      R.drawDetailedIsoBox(ctx, tx + 0.20, ty + 0.21, bz + 12.2, 0.58, 0.52, 1.2, gunmetal, { bevel: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.20, ty + 0.21, bz + 13.4, 0.58, 0.52, 0.045, 0.8, '#DCE5EE', zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.27, ty + 0.29, bz + 13.4, 0.20, 0.18, 2.8, slate, { bevel: true }, zScale);
      R.drawCyl(ctx, tx + 0.66, ty + 0.32, bz + 13.4, 0.055, 2.2, gunmetal, { n: 8 }, zScale);
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.66, ty + 0.32, bz + 15.4),
        Iso.gridToScreen(tx + 0.66, ty + 0.32, bz + 33.6),
        '#DCE5EE',
        1.45,
        true,
        zScale
      );
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.61, ty + 0.32, bz + 26.5),
        Iso.gridToScreen(tx + 0.71, ty + 0.32, bz + 26.5),
        '#BAC6D2',
        1.1,
        false,
        zScale
      );
      return;
    }

    if (lv === 2) {
      // Lv.2 전술 작전 본부: Golden command pad + stepped bunker plinth (76% footprint) + armored ops room + upper bridge + radar base + LMG turret ring
      R.drawGroundGlowPad(ctx, tx, ty, 0.88, goldHex, 1.0, zScale);
      const bz = zb + 0.9;

      // Stepped chamfered bunker plinth
      R.drawDetailedFrustum(ctx, tx + 0.12, ty + 0.12, bz, 0.76, 0.76, 4.4, 0.04, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoHazardBand(ctx, tx + 0.145, ty + 0.145, bz + 1.2, 0.71, 0.71, 1.4, '#DFAC2E', '#232B35', 5, zScale);

      // 1st floor armored tactical operations hall (~64% footprint)
      R.drawDetailedIsoBox(ctx, tx + 0.18, ty + 0.18, bz + 4.4, 0.64, 0.64, 11.2, slate, { bevel: true }, zScale);
      R.drawIsoFaceSeams(ctx, 'left', tx + 0.18, ty + 0.18, bz + 4.8, 0.64, 0.64, 10.4, 4, 'rgba(10, 14, 20, 0.42)', zScale);
      R.drawIsoFaceSeams(ctx, 'right', tx + 0.18, ty + 0.18, bz + 4.8, 0.64, 0.64, 10.4, 4, 'rgba(10, 14, 20, 0.42)', zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.82, ty + 0.56, bz + 6.2, 0.18, 3, 1.2, zScale);

      // Warm amber recessed tactical slit windows on both visible faces (0px cyan!)
      R.drawIsoBox(ctx, tx + 0.24, ty + 0.822, bz + 10.2, 0.48, 0.015, 2.8, amberLight, { emissive: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.822, ty + 0.24, bz + 10.2, 0.015, 0.26, 2.8, amberLight, { emissive: true }, zScale);

      // 2nd floor observation command bridge (~46% footprint)
      R.drawDetailedIsoBox(ctx, tx + 0.24, ty + 0.24, bz + 15.6, 0.50, 0.50, 6.2, '#C9D5E0', { bevel: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.28, ty + 0.742, bz + 17.8, 0.38, 0.015, 2.2, warmCore, { emissive: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.742, ty + 0.28, bz + 17.8, 0.015, 0.34, 2.2, amberLight, { emissive: true }, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.23, ty + 0.23, bz + 21.8, 0.52, 0.52, 1.1, gunmetal, { bevel: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.23, ty + 0.23, bz + 22.9, 0.52, 0.52, 0.045, 0.8, '#E2EBF3', zScale);

      // Radar mast pedestal & roof LMG turret ring
      R.drawCyl(ctx, tx + 0.34, ty + 0.34, bz + 22.9, 0.055, 4.6, '#8C9AA8', { n: 8 }, zScale);
      R.drawCyl(ctx, tx + 0.60, ty + 0.60, bz + 22.9, 0.095, 2.8, gunmetal, { n: 12 }, zScale);
      return;
    }

    if (lv === 3) {
      // Lv.3 통합 요새 사령부: Golden luminous pad + sloped armored bastion skirt + multi-tier command citadel + warm golden core bands + HMG turret mount
      R.drawGroundGlowPad(ctx, tx, ty, 0.90, goldHex, 1.12, zScale);
      const bz = zb + 0.9;

      // Sloped armored citadel bastion base (80% footprint)
      R.drawDetailedFrustum(ctx, tx + 0.10, ty + 0.10, bz, 0.80, 0.80, 7.6, 0.065, gunmetal, { bevel: true, groundCrease: true }, zScale);
      R.drawIsoHazardBand(ctx, tx + 0.125, ty + 0.125, bz + 2.0, 0.75, 0.75, 1.8, '#E2A83B', '#232B35', 6, zScale);
      // Corner armored buttress lugs
      const lugs = [[0.10, 0.10], [0.76, 0.10], [0.10, 0.76], [0.76, 0.76]];
      for (let i = 0; i < lugs.length; i++) {
        R.drawDetailedIsoBox(ctx, tx + lugs[i][0], ty + lugs[i][1], bz, 0.14, 0.14, 5.8, '#2B333D', { bevel: true }, zScale);
      }

      // Main armored command tower (~64% footprint) + golden luminous waist band (matches concept art!)
      R.drawDetailedIsoBox(ctx, tx + 0.18, ty + 0.18, bz + 7.6, 0.64, 0.64, 14.4, slate, { bevel: true }, zScale);
      R.drawIsoFaceSeams(ctx, 'left', tx + 0.18, ty + 0.18, bz + 8.0, 0.64, 0.64, 13.6, 4, 'rgba(10, 14, 20, 0.42)', zScale);
      R.drawIsoFaceSeams(ctx, 'right', tx + 0.18, ty + 0.18, bz + 8.0, 0.64, 0.64, 13.6, 4, 'rgba(10, 14, 20, 0.42)', zScale);
      R.drawIsoBox(ctx, tx + 0.175, ty + 0.175, bz + 14.6, 0.65, 0.65, 2.8, amberLight, { emissive: true, noTop: true }, zScale);
      R.drawIsoLouvers(ctx, 'left', tx + 0.24, ty + 0.82, bz + 9.4, 0.20, 3, 1.2, zScale);
      R.drawIsoLouvers(ctx, 'right', tx + 0.82, ty + 0.54, bz + 9.4, 0.20, 3, 1.2, zScale);

      // Upper duplex bridge (~48% footprint) + warm searchlight housing + HMG turret ring
      R.drawDetailedFrustum(ctx, tx + 0.25, ty + 0.25, bz + 22.0, 0.50, 0.50, 7.2, 0.025, '#D8E2EC', { bevel: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.265, ty + 0.265, bz + 25.4, 0.47, 0.47, 2.0, warmCore, { emissive: true, noTop: true }, zScale);
      R.drawDetailedIsoBox(ctx, tx + 0.26, ty + 0.26, bz + 29.2, 0.48, 0.48, 1.2, gunmetal, { bevel: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + 0.26, ty + 0.26, bz + 30.4, 0.48, 0.48, 0.045, 0.85, '#E2EBF3', zScale);

      // Tactical warm searchlight + comm antenna + HMG turret pedestal
      R.drawDetailedIsoBox(ctx, tx + 0.29, ty + 0.32, bz + 30.4, 0.13, 0.11, 3.2, slate, { bevel: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.30, ty + 0.432, bz + 31.0, 0.11, 0.015, 2.0, warmCore, { emissive: true }, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.34, ty + 0.29, bz + 30.4), Iso.gridToScreen(tx + 0.34, ty + 0.29, bz + 37.5), '#DCE5EE', 1.3, true, zScale);
      R.drawCyl(ctx, tx + 0.60, ty + 0.60, bz + 30.4, 0.105, 3.4, gunmetal, { n: 12 }, zScale);
      return;
    }

    // Lv.4 이지스 코어 사령부: Brilliant warm-gold core pad (0px cyan!) + chamfered fortress base (82%) + dual golden light bands + Aegis radome + twin cannon turret
    R.drawGroundGlowPad(ctx, tx, ty, 0.92, goldHex, 1.25, zScale);
    const bz = zb + 0.9;

    R.drawDetailedFrustum(ctx, tx + 0.09, ty + 0.09, bz, 0.82, 0.82, 9.2, 0.065, '#333C48', { bevel: true, groundCrease: true }, zScale);
    R.drawIsoHazardBand(ctx, tx + 0.115, ty + 0.115, bz + 2.4, 0.77, 0.77, 2.0, '#FFC94A', '#202730', 6, zScale);
    const bastions = [[0.08, 0.08], [0.76, 0.08], [0.08, 0.76], [0.76, 0.76]];
    for (let i = 0; i < bastions.length; i++) {
      R.drawDetailedIsoBox(ctx, tx + bastions[i][0], ty + bastions[i][1], bz, 0.16, 0.16, 7.2, '#262E38', { bevel: true }, zScale);
      R.drawIsoCornerRivets(ctx, tx + bastions[i][0], ty + bastions[i][1], bz + 7.2, 0.16, 0.16, 0.035, 0.75, '#FFC94A', zScale);
    }

    // Lower citadel core + radiant golden energy band 1
    R.drawDetailedIsoBox(ctx, tx + 0.17, ty + 0.17, bz + 9.2, 0.66, 0.66, 15.8, slate, { bevel: true }, zScale);
    R.drawIsoFaceSeams(ctx, 'left', tx + 0.17, ty + 0.17, bz + 9.8, 0.66, 0.66, 14.8, 4, 'rgba(10, 14, 20, 0.45)', zScale);
    R.drawIsoFaceSeams(ctx, 'right', tx + 0.17, ty + 0.17, bz + 9.8, 0.66, 0.66, 14.8, 4, 'rgba(10, 14, 20, 0.45)', zScale);
    R.drawIsoBox(ctx, tx + 0.164, ty + 0.164, bz + 17.2, 0.672, 0.672, 3.0, goldHex, { emissive: true, noTop: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.162, ty + 0.162, bz + 18.0, 0.676, 0.676, 1.4, warmCore, { emissive: true, noTop: true }, zScale);

    // Upper Aegis command crown + golden core band 2
    R.drawDetailedFrustum(ctx, tx + 0.24, ty + 0.24, bz + 25.0, 0.52, 0.52, 8.2, 0.03, '#DCE6F0', { bevel: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.252, ty + 0.252, bz + 28.8, 0.496, 0.496, 2.2, warmCore, { emissive: true, noTop: true }, zScale);
    R.drawDetailedIsoBox(ctx, tx + 0.25, ty + 0.25, bz + 33.2, 0.50, 0.50, 1.4, gunmetal, { bevel: true }, zScale);
    R.drawIsoCornerRivets(ctx, tx + 0.25, ty + 0.25, bz + 34.6, 0.50, 0.50, 0.045, 0.9, '#FFC94A', zScale);

    // Phased-array Aegis radome + twin comm whip antennas
    R.drawCyl(ctx, tx + 0.50, ty + 0.50, bz + 34.6, 0.21, 2.2, '#455260', { n: 14 }, zScale);
    R.drawDome(ctx, tx + 0.50, ty + 0.50, bz + 36.8, 0.19, 8.2, '#EEF4F9', { n: 16 }, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.30, ty + 0.30, bz + 34.6), Iso.gridToScreen(tx + 0.30, ty + 0.30, bz + 44.0), '#DCE5EE', 1.25, true, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.70, ty + 0.30, bz + 34.6), Iso.gridToScreen(tx + 0.70, ty + 0.30, bz + 42.5), '#DCE5EE', 1.25, true, zScale);
  }

  function drawHqDynamicOverlay(ctx, tx, ty, zb, lv, aim, timeSec, P, zScale) {
    const Iso = ZS.Iso;
    const bz = zb + 0.9;
    const amberLight = P.baseLight || '#FFD27A';
    const warmCore = P.hqAmberCore || '#FFF3D6';

    if (lv === 1) {
      const blinkOn = Math.sin(timeSec * 4.5) > -0.25;
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.66, ty + 0.32, bz + 34.5), 2.0, blinkOn ? amberLight : '#9E7428', blinkOn, zScale);
      return;
    }

    if (lv === 2) {
      const rTop = Iso.gridToScreen(tx + 0.34, ty + 0.34, bz + 28.2);
      const rot = timeSec * 1.9;
      ctx.save();
      ctx.translate(rTop.x, rTop.y);
      ctx.rotate(Math.sin(rot) * 0.38);
      ctx.fillStyle = Iso.resolveFaceColor('#E8F0F7', 1.0, false, 0) || '#E8F0F7';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.8 * zScale, 3.1 * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!window.ZS_SILHOUETTE_MODE) {
        ctx.strokeStyle = 'rgba(12, 18, 26, 0.48)';
        ctx.lineWidth = Math.max(0.7, 0.85 * zScale);
        ctx.stroke();
      }
      ctx.restore();
      R.drawIsoDot(ctx, { x: rTop.x, y: rTop.y - 1.2 * zScale }, 1.15, amberLight, true, zScale);
      drawHqRoofBarrels(ctx, tx + 0.60, ty + 0.60, bz + 24.8, aim, 0.32, 1, 2.2, '#1F242B', zScale);
      return;
    }

    if (lv === 3) {
      const blinkOn = Math.sin(timeSec * 5.0) > -0.2;
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.34, ty + 0.29, bz + 38.2), 1.6, blinkOn ? amberLight : '#9E7428', blinkOn, zScale);
      drawHqRoofBarrels(ctx, tx + 0.60, ty + 0.60, bz + 32.8, aim, 0.38, 2, 2.5, '#1F242B', zScale);
      return;
    }

    // Lv.4 Aegis twin heavy cannon barrels + pulsing golden apex core beacon
    drawHqRoofBarrels(ctx, tx + 0.50, ty + 0.50, bz + 39.8, aim, 0.48, 2, 3.3, '#1F242B', zScale);
    const pulseR = 2.6 + 0.55 * Math.sin(timeSec * 5.5);
    R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, bz + 46.2), pulseR, warmCore, true, zScale);
  }

  function drawHqByLevel(ctx, st, tx, ty, state, timeSec, zScale) {
    const P = ZS.DATA.PALETTE;
    const lv = Math.max(1, Math.min(4, st.level || state.hqLevel || 1));
    const aim = st.aimAngle != null ? st.aimAngle : 0.8;

    // 1.2s Upgrade rise-up animation: dust (1.2->0.8), rise-up ease-out (0.8->0.3), turret mount flash (0.3->0.15)
    let zLift = 0;
    const animT = st.upgradeAnimTimer || 0;
    if (animT > 0.3) {
      const p = Math.max(0, Math.min(1, (1.1 - animT) / 0.5));
      const easeOut = 1 - Math.pow(1 - p, 3);
      zLift = -14 * (1 - easeOut);
    }
    const zb = Math.max(0, 0.5 + zLift);

    drawHqStaticBody(ctx, tx, ty, zb, lv, P, zScale);
    drawHqDynamicOverlay(ctx, tx, ty, zb, lv, aim, timeSec, P, zScale);
  }

  function drawHqRoofBarrels(ctx, gx, gy, zBase, aimAngle, lenTiles, count, widthPx, color, zScale) {
    const Iso = ZS.Iso;
    const perpX = -Math.sin(aimAngle);
    const perpY = Math.cos(aimAngle);
    const offsets = count === 2 ? [-0.045, 0.045] : [0];

    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx * zScale;
    ctx.lineCap = 'round';
    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i];
      const sx = gx + perpX * off;
      const sy = gy + perpY * off;
      const tx = sx + Math.cos(aimAngle) * lenTiles;
      const ty = sy + Math.sin(aimAngle) * lenTiles;
      const p1 = Iso.gridToScreen(sx, sy, zBase);
      const p2 = Iso.gridToScreen(tx, ty, zBase);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  function pushOrientedPart(parts, gx, gy, z, w, d, h, opts) {
    parts.push({
      kind: 'box',
      x: gx - w * 0.5,
      y: gy - d * 0.5,
      z,
      w,
      d,
      h,
      opts,
      sort: gx + gy + z * 0.004
    });
  }

  function pushOrientedBlob(parts, gx, gy, z, r, h, hex, opts) {
    parts.push({
      kind: 'blob',
      cx: gx,
      cy: gy,
      z,
      r,
      h,
      hex,
      opts: opts || {},
      sort: gx + gy + z * 0.004
    });
  }

  function flushOrientedParts(ctx, parts, zScale) {
    parts.sort((a, b) => a.sort - b.sort);
    const Iso = ZS.Iso;
    const sc = zScale || 1;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.kind === 'blob') {
        R.drawBlob(ctx, p.cx, p.cy, p.z, p.r, p.h, p.hex, p.opts, sc);
        if (!isSil && p.opts && p.opts.acidSpots) {
          const spots = [
            [0.30, 0.60],
            [-0.20, 0.35],
            [0.10, 0.80]
          ];
          for (let k = 0; k < spots.length; k++) {
            const sp = Iso.gridToScreen(
              p.cx + spots[k][0] * p.r * 0.65,
              p.cy - spots[k][0] * p.r * 0.45,
              p.z + p.h * spots[k][1]
            );
            R.drawIsoDot(ctx, sp, 1.4, p.opts.spotColor || '#C8F542', true, sc);
          }
        }
      } else if (p.opts && p.opts.emissive && p.opts.base) {
        R.drawIsoBox(ctx, p.x, p.y, p.z, p.w, p.d, p.h, p.opts.base, { emissive: true, edge: false }, sc);
      } else {
        Iso.drawVoxelBox(ctx, p.x, p.y, p.z, p.w, p.d, p.h, p.opts);
      }
    }
  }

  function drawOperatorFigure(ctx, gx, gy, zBase, vestColor, helmetAccent, aimAngle, zScale, hasLaser, hasOrangeTip) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const ang = typeof aimAngle === 'number' ? aimAngle : 0;
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);
    const px = -fy;
    const py = fx;

    // 2.2-head miniature toy proportions (#7: height ~21.2z => >18px at default 0.78x zoom)
    const parts = [];
    // Backpack / radio pack behind torso
    pushOrientedPart(parts, gx - fx * 0.11, gy - fy * 0.11, zBase + 1.4, 0.16, 0.16, 6.2, {
      base: '#2b343d',
      stroke: 'rgba(27, 36, 48, 0.42)'
    });
    // Compact tactical vest torso
    pushOrientedPart(parts, gx, gy, zBase, 0.28, 0.28, 8.8, {
      base: vestColor,
      stroke: 'rgba(27, 36, 48, 0.42)'
    });
    // Forward aiming shoulder/arm block
    pushOrientedPart(parts, gx + fx * 0.11 + px * 0.09, gy + fy * 0.11 + py * 0.09, zBase + 4.8, 0.13, 0.13, 3.6, {
      base: vestColor
    });
    // Large 2.2-head toy face block
    pushOrientedPart(parts, gx, gy, zBase + 8.8, 0.26, 0.26, 7.6, {
      base: '#e4c3a5',
      stroke: 'rgba(27, 36, 48, 0.36)'
    });
    // Chunky tactical helmet dome + brim
    pushOrientedPart(parts, gx - fx * 0.01, gy - fy * 0.01, zBase + 16.0, 0.31, 0.31, 5.2, {
      base: helmetAccent,
      stroke: 'rgba(27, 36, 48, 0.45)'
    });
    flushOrientedParts(ctx, parts);

    // Crisp tactical visor / goggles facing aimAngle
    const visorGx = gx + fx * 0.125;
    const visorGy = gy + fy * 0.125;
    const vL = Iso.gridToScreen(visorGx - px * 0.055, visorGy - py * 0.055, zBase + 12.8);
    const vR = Iso.gridToScreen(visorGx + px * 0.055, visorGy + py * 0.055, zBase + 12.8);
    ctx.strokeStyle = '#1B2430';
    ctx.lineWidth = Math.max(1.8, 2.4 * zScale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(vL.x, vL.y);
    ctx.lineTo(vR.x, vR.y);
    ctx.stroke();

    const barrelZ = zBase + 6.8;
    const bLen = hasLaser ? 20 : 15;
    drawTurretBarrel(ctx, gx + fx * 0.06, gy + fy * 0.06, barrelZ, ang, bLen, '#1f242b', zScale);
    if (hasOrangeTip) {
      const tipGx = gx + fx * (0.06 + bLen / 32);
      const tipGy = gy + fy * (0.06 + bLen / 32);
      const tipP = Iso.gridToScreen(tipGx, tipGy, barrelZ);
      ctx.fillStyle = P.levelMax || '#FF9F43';
      ctx.beginPath();
      ctx.arc(tipP.x, tipP.y, 2.1 * zScale, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hasLaser) {
      const p1 = Iso.gridToScreen(gx + fx * 0.25, gy + fy * 0.25, barrelZ);
      const tx = gx + fx * 1.55;
      const ty = gy + fy * 1.55;
      const p2 = Iso.gridToScreen(tx, ty, zBase + 4);
      ctx.strokeStyle = 'rgba(255, 65, 65, 0.50)';
      ctx.lineWidth = 1.1 * zScale;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  function drawTurretBarrel(ctx, gx, gy, zBase, aimAngle, lenPx, color, zScale) {
    const Iso = ZS.Iso;
    const p1 = Iso.gridToScreen(gx, gy, zBase);
    const tipGx = gx + Math.cos(aimAngle) * (lenPx / 32);
    const tipGy = gy + Math.sin(aimAngle) * (lenPx / 32);
    const p2 = Iso.gridToScreen(tipGx, tipGy, zBase);
    ctx.strokeStyle = '#11161d';
    ctx.lineWidth = 4.2 * zScale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8 * zScale;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  R.WALL_PIECES = WALL_PIECES;

  Object.assign(R, {
    isWallConnectableCell,
    getWallConnectMask,
    drawStructGroundShadow,
    drawWallContactShadow,
    drawGateContactShadow,
    drawHqContactShadow,
    drawWireXFrame,
    drawWireHub,
    drawWireCoilSpan,
    drawWireWallTile,
    drawHescoPiece,
    drawBlastSlab,
    drawBlastPiece,
    drawConnectedWallTile,
    drawTacticalGateTile,
    getMountedVisualTopZ,
    drawWallDeck,
    drawMountedUnit,
    getTrapThrustAmount,
    drawRazorPadTile,
    drawStructure,
    drawHqStaticBody,
    drawHqDynamicOverlay,
    drawHqByLevel,
    drawHqRoofBarrels,
    pushOrientedPart,
    pushOrientedBlob,
    flushOrientedParts,
    drawOperatorFigure,
    drawTurretBarrel
  });
})();
