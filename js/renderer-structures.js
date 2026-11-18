window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;

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
    const wood = P.wireWood || '#8B6843';
    const woodDark = P.wireWoodDark || '#5E452B';
    const iron = P.wireIron || '#4A5562';
    if (crossAxis === 'y') {
      R.drawIsoBox(ctx, cx - 0.04, cy - 0.19, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      R.drawIsoBox(ctx, cx - 0.04, cy + 0.11, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx, cy - 0.16, 1.0), Iso.gridToScreen(cx, cy + 0.16, 10.5), wood, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx, cy + 0.16, 1.0), Iso.gridToScreen(cx, cy - 0.16, 10.5), wood, 2.3, true, zScale);
    } else {
      R.drawIsoBox(ctx, cx - 0.19, cy - 0.04, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      R.drawIsoBox(ctx, cx + 0.11, cy - 0.04, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx - 0.16, cy, 1.0), Iso.gridToScreen(cx + 0.16, cy, 10.5), wood, 2.3, true, zScale);
      R.drawIsoLine(ctx, Iso.gridToScreen(cx + 0.16, cy, 1.0), Iso.gridToScreen(cx - 0.16, cy, 10.5), wood, 2.3, true, zScale);
    }
    R.drawIsoBox(ctx, cx - 0.045, cy - 0.045, 4.9, 0.09, 0.09, 1.5, iron, null, zScale);
  }

  function drawWireHub(ctx, tx, ty, P, zScale) {
    const Iso = ZS.Iso;
    const wood = P.wireWood || '#8B6843';
    const woodDark = P.wireWoodDark || '#5E452B';
    const iron = P.wireIron || '#4A5562';
    R.drawIsoBox(ctx, tx + 0.41, ty + 0.41, 0, 0.18, 0.18, 1.6, woodDark, null, zScale);
    R.drawIsoBox(ctx, tx + 0.43, ty + 0.43, 1.6, 0.14, 0.14, 8.6, wood, null, zScale);
    R.drawIsoBox(ctx, tx + 0.42, ty + 0.42, 4.9, 0.16, 0.16, 1.6, iron, null, zScale);
    R.drawIsoBox(ctx, tx + 0.435, ty + 0.435, 10.2, 0.13, 0.13, 0.7, iron, null, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.35, ty + 0.65, 0.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), wood, 2.0, true, zScale);
    R.drawIsoLine(ctx, Iso.gridToScreen(tx + 0.65, ty + 0.35, 0.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), wood, 2.0, true, zScale);
  }

  function drawWireCoilSpan(ctx, tx, ty, axis, t0, t1, loops, P, zScale) {
    const Iso = ZS.Iso;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const rr = 0.145;
    const zc = 5.7;
    const rz = 3.9;
    const span = t1 - t0;
    const du = span / loops;
    const ptAt = (u, a) =>
      axis === 'x'
        ? Iso.gridToScreen(tx + u, ty + 0.5 + rr * Math.cos(a), zc + rz * Math.sin(a))
        : Iso.gridToScreen(tx + 0.5 + rr * Math.cos(a), ty + u, zc + rz * Math.sin(a));

    const drawHalf = (uStart, a0, a1, steps, phaseOff, strokeHex, widthPx, withOutline) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const a = a0 + (a1 - a0) * f;
        const u = Math.min(t1, Math.max(t0, uStart + (phaseOff + f * 0.5) * du));
        const p = ptAt(u, a);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      if (withOutline && !isSil) {
        ctx.strokeStyle = 'rgba(10, 14, 20, 0.48)';
        ctx.lineWidth = (widthPx + 1.0) * zScale;
        ctx.stroke();
      }
      ctx.strokeStyle = Iso.resolveFaceColor(strokeHex, 1.0, false, 0) || strokeHex;
      ctx.lineWidth = widthPx * zScale;
      ctx.stroke();
    };

    const coilDim = P.wireCoilDim || '#6E7B88';
    const coilCol = P.wireCoil || '#BAC6D2';
    const barbCol = P.wireBarb || '#DCE5EE';
    const wood = P.wireWood || '#8B6843';

    for (let i = 0; i < loops; i++) {
      drawHalf(t0 + i * du, 0.72 * Math.PI, 1.72 * Math.PI, 7, 0.0, coilDim, 1.2, false);
    }

    if (axis === 'x') R.drawIsoBox(ctx, tx + t0, ty + 0.475, 5.1, span, 0.05, 1.1, wood, null, zScale);
    else R.drawIsoBox(ctx, tx + 0.475, ty + t0, 5.1, 0.05, span, 1.1, wood, null, zScale);

    for (let i = 0; i < loops; i++) {
      const uStart = t0 + i * du;
      drawHalf(uStart, -0.28 * Math.PI, 0.72 * Math.PI, 8, 0.5, coilCol, 1.5, true);
      const barbAngles = [0.48 * Math.PI, 0.05];
      for (let bi = 0; bi < barbAngles.length; bi++) {
        const ba = barbAngles[bi];
        const f = (ba + 0.28 * Math.PI) / Math.PI;
        const u = Math.min(t1, Math.max(t0, uStart + (0.5 + f * 0.5) * du));
        const bp = ptAt(u, ba);
        const d = 2.0 * zScale;
        ctx.strokeStyle = Iso.resolveFaceColor(barbCol, 1.0, false, 0) || barbCol;
        ctx.lineWidth = 1.1 * zScale;
        ctx.beginPath();
        ctx.moveTo(bp.x - d, bp.y - d * 0.65);
        ctx.lineTo(bp.x + d, bp.y + d * 0.65);
        ctx.moveTo(bp.x - d, bp.y + d * 0.65);
        ctx.lineTo(bp.x + d, bp.y - d * 0.65);
        ctx.stroke();
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

  function drawHescoPiece(ctx, x, y, w, d, h, lv, skipCap, steelCol, maxAccent, zScale) {
    R.drawIsoBox(ctx, x, y, 0, w, d, h, '#C9B48A', null, zScale);
    R.drawIsoBox(ctx, x + 0.035, y + 0.035, h, w - 0.07, d - 0.07, 0.6, '#9E8758', null, zScale);
    if (lv >= 2) {
      R.drawIsoBox(ctx, x - 0.006, y - 0.006, 4.8, w + 0.012, d + 0.012, 2.2, steelCol, { noTop: true }, zScale);
    }
    if (lv >= 3 && !skipCap) {
      R.drawIsoBox(ctx, x - 0.005, y - 0.005, h + 0.6, w + 0.01, d + 0.01, 1.2, maxAccent, { noTop: true }, zScale);
      R.drawIsoBox(ctx, x, y, h + 1.8, w, d, 2.4, steelCol, null, zScale);
    }
  }

  function drawBlastSlab(ctx, x, y, w, d, z0, z1, H, I, axis, hex, top, zScale) {
    const ix = axis === 'x' ? 0 : 1;
    const iy = axis === 'y' ? 0 : 1;
    const i0 = (I * z0) / H;
    const i1 = (I * z1) / H;
    R.drawFrustumXY(
      ctx,
      x + i0 * ix,
      y + i0 * iy,
      z0,
      w - 2 * i0 * ix,
      d - 2 * i0 * iy,
      z1 - z0,
      (i1 - i0) * ix,
      (i1 - i0) * iy,
      hex,
      { noTop: !top },
      zScale
    );
  }

  function drawBlastPiece(ctx, x, y, w, d, axis, lv, skipCap, steelCol, maxAccent, zScale) {
    const H = 24;
    const I = 0.08;
    const secs =
      lv >= 2
        ? [
            [0, 4.5, '#6B7686'],
            [4.5, 8.5, '#F0BD35'],
            [8.5, 12.5, '#6B7686'],
            [12.5, 15.5, steelCol],
            [15.5, 24, '#6B7686']
          ]
        : [
            [0, 4.5, '#6B7686'],
            [4.5, 8.5, '#F0BD35'],
            [8.5, 24, '#6B7686']
          ];
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      drawBlastSlab(ctx, x, y, w, d, s[0], s[1], H, I, axis, s[2], i === secs.length - 1, zScale);
    }
    if (lv >= 3 && !skipCap) {
      const ix = axis === 'x' ? 0 : I;
      const iy = axis === 'y' ? 0 : I;
      R.drawIsoBox(ctx, x + ix - 0.004, y + iy - 0.004, H, w - 2 * ix + 0.008, d - 2 * iy + 0.008, 1.3, maxAccent, { noTop: true }, zScale);
      R.drawIsoBox(ctx, x + ix, y + iy, H + 1.3, w - 2 * ix, d - 2 * iy, 2.4, steelCol, null, zScale);
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
        drawHescoPiece(ctx, tx + 0.17, ty + 0.31, 0.32, 0.38, 13, tier, !!mounted, steelCol, maxAccent, zScale);
        drawHescoPiece(ctx, tx + 0.51, ty + 0.31, 0.32, 0.38, 13, tier, !!mounted, steelCol, maxAccent, zScale);
      } else {
        const r = WALL_PIECES.iso;
        drawBlastPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], 'both', tier, !!mounted, steelCol, maxAccent, zScale);
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

    for (let i = 0; i < order.length; i++) {
      const k = order[i][0];
      const axis = order[i][1];
      const r = WALL_PIECES[k];
      if (isHesco) {
        drawHescoPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], k === 'post' ? 14 : 13, tier, !!(mounted && k === 'post'), steelCol, maxAccent, zScale);
      } else {
        drawBlastPiece(ctx, tx + r[0], ty + r[1], r[2], r[3], axis, tier, !!(mounted && k === 'post'), steelCol, maxAccent, zScale);
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
        const rh = lv >= 3 ? 5.5 : 4;
        R.drawSandbagRing(ctx, cx, cy, baseZ, 0.22, rh, 'back', zScale);
        drawOperatorFigure(ctx, cx, cy, baseZ + 0.4, '#55684F', '#3E4D3A', aim, zScale, false, lv >= 3);
        R.drawSandbagRing(ctx, cx, cy, baseZ, 0.22, rh, 'front', zScale);
        if (lv >= 2) {
          R.drawCyl(ctx, cx, cy, baseZ + (lv >= 3 ? 4.3 : 2.8), 0.224, 1.2, steelCol, { noTop: true, n: 16 }, zScale);
        }
        break;
      }

      case 'shotgun_post': {
        drawOperatorFigure(ctx, cx, cy - 0.04, baseZ + 0.3, '#3A4654', '#2F3945', aim, zScale, false, false);
        R.drawIsoBox(ctx, tx + 0.30, ty + 0.68, baseZ, 0.40, 0.05, 11, '#3A4654', null, zScale);
        R.drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 7, 0.406, 0.056, 1.8, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
        if (lv >= 2) {
          R.drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 3.0, 0.406, 0.056, 1.6, steelCol, { noTop: true }, zScale);
        }
        R.drawIsoBox(ctx, tx + 0.44, ty + 0.677, baseZ + 9, 0.12, 0.056, 1.1, '#1B2430', { noTop: true }, zScale);
        break;
      }

      case 'vulcan_turret': {
        R.drawCyl(ctx, cx, cy, baseZ, 0.20, 3, '#4E5A68', { n: 16 }, zScale);
        R.drawPowerStripCyl(ctx, cx, cy, baseZ + 1.8, 0.204, isUnpowered, zScale);
        let domeZ = baseZ + 3;
        if (lv >= 2) {
          R.drawCyl(ctx, cx, cy, domeZ, 0.18, 1.4, steelCol, { n: 16 }, zScale);
          domeZ += 1.4;
        }
        R.drawDome(ctx, cx, cy, domeZ, 0.17, 9, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
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
        break;
      }

      case 'led_floodlight': {
        R.drawCyl(ctx, cx, cy, baseZ, 0.11, 2, '#59636E', { n: 12 }, zScale);
        R.drawPowerStripCyl(ctx, cx, cy, baseZ + 0.6, 0.114, isUnpowered, zScale);
        R.drawIsoBox(ctx, cx - 0.025, cy - 0.025, baseZ + 2, 0.05, 0.05, 9, lv >= 2 ? steelCol : '#8A99A8', null, zScale);
        R.drawIsoBox(ctx, tx + 0.34, ty + 0.40, baseZ + 11, 0.32, 0.20, 5, '#59636E', null, zScale);
        R.drawIsoBox(ctx, tx + 0.36, ty + 0.595, baseZ + 12, 0.28, 0.012, 3.2, isUnpowered ? '#4B5563' : '#FFF6DA', { emissive: !isUnpowered }, zScale);
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

  function drawStructure(ctx, st, tx, ty, state, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const id = st.id;
    const lv = st.level || 1;
    const steelCol = P.steelBand || '#8C96A3';
    const maxAccent = P.levelMax || '#FF9F43';
    const def = id === 'command_hq' ? ZS.DATA.HQ_STATS : ZS.DATA.ITEMS[id];
    const isUnpowered = (state.isNight && def && def.requiresPower && !powered) || !!(def && def.requiresPower && (st.empStunTimer || 0) > 0);

    // Soft ground shadow
    if (!(def && def.passable) && !window.ZS_SILHOUETTE_MODE) {
      const sc = Iso.gridToScreen(tx + 0.52, ty + 0.55, 0.5);
      ctx.fillStyle = 'rgba(10, 16, 22, 0.28)';
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y, 21 * zScale, 10.5 * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
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

      case 'hesco_wall': {
        // 2×2 gabion blocks (low & wide segmented silhouette) + Lv.2 steel bands + Lv.3 orange-rimmed armor plate
        const s = 0.37;
        const gp = 0.12;
        const o = 0.07;
        const h = 12.5;
        const cells = [
          [o, o],
          [o + s + gp, o],
          [o, o + s + gp],
          [o + s + gp, o + s + gp]
        ];
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
        // Trapezoidal T-wall frustum + amber hazard stripe + Lv.2 steel band + Lv.3 shock-reflect armor crown
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

      case 'razor_pad': {
        if (lv <= 1) {
          R.drawIsoBox(ctx, tx + 0.10, ty + 0.10, 0.4, 0.80, 0.80, 2, '#4A525C', null, zScale);
          const c = Iso.gridToScreen(tx + 0.5, ty + 0.5, 4.2);
          ctx.strokeStyle = Iso.resolveFaceColor('#C9D3DE', 1.0, false, 0);
          ctx.lineWidth = 1.4 * zScale;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.ellipse(c.x + k * 8.5 * zScale, c.y, 6.8 * zScale, 4.4 * zScale, 0.3, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (lv === 2) {
          R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, 0.4, 0.84, 0.84, 2.0, '#3E4650', null, zScale);
          R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, 0.6, 0.85, 0.85, 1.0, '#F0BD35', { noTop: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.14, ty + 0.14, 2.4, 0.72, 0.72, 0.15, '#1F252D', null, zScale);
          const rYs = [0.27, 0.50, 0.73];
          const rXs = [0.24, 0.41, 0.59, 0.76];
          for (let j = 0; j < rYs.length; j++) {
            for (let i = 0; i < rXs.length; i++) {
              R.drawSawTooth(ctx, tx + rXs[i], ty + rYs[j], 2.5, 0.075, 2.2, P.trapBlade || '#DCE5EE', '#8E9CA9', zScale);
            }
          }
        } else {
          const copper = P.piezoCopper || '#B87333';
          const arcA = P.piezoArc || '#FF8A3D';
          const arcB = P.piezoSpark || '#FFD08A';
          R.drawIsoBox(ctx, tx + 0.07, ty + 0.07, 0.4, 0.86, 0.86, 2.2, '#343C46', null, zScale);
          R.drawIsoBox(ctx, tx + 0.065, ty + 0.065, 1.2, 0.87, 0.87, 1.0, copper, { noTop: true }, zScale);
          const barYs = [0.28, 0.43, 0.57, 0.72];
          for (let i = 0; i < barYs.length; i++) {
            R.drawIsoBox(ctx, tx + 0.18, ty + barYs[i] - 0.025, 2.6, 0.64, 0.05, 1.4, '#C9D3DE', null, zScale);
          }
          const studs = [[0.14, 0.14], [0.80, 0.14], [0.14, 0.80], [0.80, 0.80]];
          for (let i = 0; i < studs.length; i++) {
            R.drawIsoBox(ctx, tx + studs[i][0], ty + studs[i][1], 2.6, 0.06, 0.06, 1.6, copper, null, zScale);
            R.drawIsoBox(ctx, tx + studs[i][0] + 0.01, ty + studs[i][1] + 0.01, 4.2, 0.04, 0.04, 0.8, arcA, { emissive: true }, zScale);
          }
          R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.17, ty + 0.17, 4.4), Iso.gridToScreen(tx + 0.83, ty + 0.83, 4.4), 2.2, arcB, true, zScale);
          R.drawZigzagArc(ctx, Iso.gridToScreen(tx + 0.83, ty + 0.17, 4.4), Iso.gridToScreen(tx + 0.17, ty + 0.83, 4.4), -2.2, arcA, true, zScale);
        }
        break;
      }

      case 'rifle_bunker': {
        // Round sandbag ring + entrenched 2.2-head rifleman (unmistakable circular pit silhouette)
        const rh = lv >= 3 ? 10 : 7;
        R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'back', zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 2.2, '#55684F', '#3E4D3A', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, lv >= 3);
        R.drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'front', zScale);
        if (lv >= 2) {
          R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5 + rh - 1.6, 0.406, 1.6, steelCol, { noTop: true, n: 16 }, zScale);
        }
        break;
      }

      case 'shotgun_post': {
        // Compact sandbag ring + tall front ballistic shield plate with amber band & vision slit
        R.drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'back', zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.44, 1.8, '#3A4654', '#2F3945', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, false);
        R.drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'front', zScale);
        R.drawIsoBox(ctx, tx + 0.16, ty + 0.80, 0.5, 0.68, 0.07, 17, '#3A4654', null, zScale);
        R.drawIsoBox(ctx, tx + 0.155, ty + 0.795, 11.5, 0.69, 0.08, 2.2, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
        if (lv >= 2) {
          R.drawIsoBox(ctx, tx + 0.155, ty + 0.795, 4.5, 0.69, 0.08, 2.0, steelCol, { noTop: true }, zScale);
        }
        R.drawIsoBox(ctx, tx + 0.42, ty + 0.795, 14.1, 0.16, 0.08, 1.4, '#1B2430', { noTop: true }, zScale);
        break;
      }

      case 'sniper_tower': {
        // Tall lattice truss watchtower + platform + hip roof (h=52, tallest manned structure)
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
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 27.5, '#3D4D42', '#2F3B33', st.aimAngle != null ? st.aimAngle : 0.8, zScale, true, false);
        R.drawIsoBox(ctx, tx + 0.86, ty + 0.86, 27.5, 0.04, 0.04, 18, '#5B6875', null, zScale);
        R.drawHipRoof(ctx, tx + 0.04, ty + 0.04, 45.5, 0.92, 0.92, 7, '#4F5D4B', zScale);
        if (lv >= 3) {
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.5, ty + 0.5, 53.0), 2.3, maxAccent, true, zScale);
        }
        break;
      }

      case 'vulcan_turret': {
        // Circular pedestal + cyan power strip + white CIWS radar dome + rotating tri-barrel gatling
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 7, '#4E5A68', { n: 16 }, zScale);
        R.drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.9, 0.366, isUnpowered, zScale);
        let z0 = 7.5;
        if (lv >= 2) {
          R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.32, 2.6, steelCol, { n: 16 }, zScale);
          z0 = 10.1;
        }
        R.drawDome(ctx, tx + 0.5, ty + 0.5, z0, 0.26, 13, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
        const aim = st.aimAngle != null ? st.aimAngle : 0.8;
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
        break;
      }

      case 'missile_pod': {
        // Circular pedestal + cyan power strip + tilted 4-tube MLRS rocket pod (angled rack silhouette)
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 6.5, '#4C574A', { n: 16 }, zScale);
        R.drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.4, 0.366, isUnpowered, zScale);
        if (lv >= 2) {
          R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.0, 0.31, 1.8, steelCol, { n: 16 }, zScale);
        }
        // Tilted MLRS pod body (rises forward from z=8.5 back to z=13.5 front)
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

      case 'emp_coil': {
        // Circular pedestal + cyan power strip + slender pylon + copper coil rings + glowing cyan energy orb
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
        const pulse = isUnpowered ? 0.85 : 0.94 + 0.10 * Math.sin(timeSec * 7);
        R.drawBlob(ctx, tx + 0.5, ty + 0.5, 25.5, 0.14 * pulse, 9, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, n: 14 }, zScale);
        break;
      }

      case 'solar_array': {
        const solarOff = !powered;
        if (lv <= 1) {
          R.drawIsoBox(ctx, tx + 0.22, ty + 0.28, 0.5, 0.56, 0.06, 1.2, '#596673', null, zScale);
          R.drawIsoBox(ctx, tx + 0.22, ty + 0.72, 0.5, 0.56, 0.06, 1.2, '#596673', null, zScale);
          R.drawIsoBox(ctx, tx + 0.45, ty + 0.30, 1.7, 0.10, 0.08, 7.6, '#7B8996', null, zScale);
          R.drawIsoBox(ctx, tx + 0.12, ty + 0.52, 0.5, 0.12, 0.20, 4.2, '#475361', null, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.72, 3.2), 1.4, solarOff ? P.powerDim : P.power, !solarOff, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.22, ty + 0.24, 0.58, 0.54, 11.2, 5.4, 1.1, '#9AA8B6', '#2466B5', '#6E9FE0', 2, 2, zScale);
        } else if (lv === 2) {
          R.drawIsoBox(ctx, tx + 0.44, ty + 0.44, 0.5, 0.12, 0.12, 9.0, '#7B8996', null, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.06, ty + 0.12, 0.88, 0.76, 15.5, 8.5, 1.5, '#A9B6C4', '#2466B5', '#6E9FE0', 3, 2, zScale);
        } else if (lv === 3) {
          R.drawCyl(ctx, tx + 0.50, ty + 0.44, 0.5, 0.22, 3.6, '#596673', { n: 14 }, zScale);
          R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.44, 2.5, 0.225, solarOff, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.44, 4.1, 0.07, 11.4, '#8C9AA8', { n: 10 }, zScale);
          R.drawIsoBox(ctx, tx + 0.18, ty + 0.40, 14.8, 0.64, 0.08, 1.8, '#7B8996', null, zScale);
          R.drawIsoBox(ctx, tx + 0.34, ty + 0.66, 0.5, 0.32, 0.20, 7.2, '#DDE5EC', null, zScale);
          R.drawIsoBox(ctx, tx + 0.37, ty + 0.855, 4.6, 0.26, 0.015, 1.4, solarOff ? P.powerDim : P.power, { emissive: !solarOff }, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.04, ty + 0.10, 0.42, 0.62, 22.5, 13.5, 1.3, '#A9B6C4', '#2466B5', '#6E9FE0', 2, 2, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.54, ty + 0.10, 0.42, 0.62, 22.5, 13.5, 1.3, '#A9B6C4', '#2466B5', '#6E9FE0', 2, 2, zScale);
        } else {
          R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 3.0, '#475361', null, zScale);
          R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, 1.7, 0.85, 0.85, 1.0, solarOff ? P.powerDim : P.power, { noTop: true, emissive: !solarOff }, zScale);
          R.drawIsoBox(ctx, tx + 0.38, ty + 0.34, 3.5, 0.24, 0.24, 26.0, '#607080', null, zScale);
          R.drawIsoBox(ctx, tx + 0.375, ty + 0.335, 17.5, 0.25, 0.25, 1.5, solarOff ? P.powerDim : P.power, { noTop: true, emissive: !solarOff }, zScale);
          R.drawIsoBox(ctx, tx + 0.41, ty + 0.37, 29.5, 0.18, 0.18, 3.5, solarOff ? P.powerDim : P.power, { emissive: !solarOff }, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.06, ty + 0.06, 0.88, 0.42, 28.0, 20.5, 1.4, '#B6C3D0', '#1D5AA8', '#6E9FE0', 4, 2, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.04, ty + 0.46, 0.33, 0.46, 14.2, 8.2, 1.2, '#A9B6C4', '#2466B5', '#6E9FE0', 2, 2, zScale);
          R.drawSlantedSolarPanel(ctx, tx + 0.63, ty + 0.46, 0.33, 0.46, 14.2, 8.2, 1.2, '#A9B6C4', '#2466B5', '#6E9FE0', 2, 2, zScale);
        }
        break;
      }

      case 'wind_turbine': {
        const windOff = false;
        const bladeAngle = st.isPreview ? 0.45 + (tx + ty) * 0.4 : timeSec * 2.6 + (tx + ty);
        if (lv <= 1) {
          R.drawIsoBox(ctx, tx + 0.36, ty + 0.36, 0.5, 0.28, 0.28, 3.0, '#647280', null, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.50, 3.5, 0.13, 2.0, windOff ? P.powerDim : P.power, { n: 12, emissive: !windOff }, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.50, 5.5, 0.042, 22.0, '#DCE5EE', { n: 10 }, zScale);
          const rx = 0.21 * Math.cos(bladeAngle);
          const ry = 0.21 * Math.sin(bladeAngle);
          const bx1 = tx + 0.50 + rx;
          const by1 = ty + 0.50 + ry;
          const bx2 = tx + 0.50 - rx;
          const by2 = ty + 0.50 - ry;
          R.drawIsoLine(ctx, Iso.gridToScreen(bx2, by2, 14.0), Iso.gridToScreen(bx1, by1, 14.0), '#9AA8B6', 1.7, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(bx2, by2, 24.5), Iso.gridToScreen(bx1, by1, 24.5), '#9AA8B6', 1.7, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(bx1, by1, 12.2), Iso.gridToScreen(bx1, by1, 26.5), '#F5F9FC', 2.8, true, zScale);
          R.drawIsoLine(ctx, Iso.gridToScreen(bx2, by2, 12.2), Iso.gridToScreen(bx2, by2, 26.5), '#F5F9FC', 2.8, true, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, 28.0), 2.2, '#C7D2DD', false, zScale);
        } else if (lv === 2) {
          R.drawIsoBox(ctx, tx + 0.34, ty + 0.34, 0.5, 0.32, 0.32, 3.5, '#6C7B8A', null, zScale);
          R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.50, 3.8, 0.125, windOff, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.50, 4.0, 0.048, 31.0, '#E4ECF4', { n: 10 }, zScale);
          R.drawIsoBox(ctx, tx + 0.44, ty + 0.38, 35.0, 0.12, 0.24, 3.8, '#C7D2DD', null, zScale);
          R.drawIsoBox(ctx, tx + 0.48, ty + 0.18, 35.6, 0.04, 0.20, 4.4, '#7B8FA2', null, zScale);
          const hub = Iso.gridToScreen(tx + 0.50, ty + 0.64, 37.0);
          for (let b = 0; b < 3; b++) {
            const a = bladeAngle + (b * Math.PI * 2) / 3;
            R.drawIsoLine(ctx, hub, { x: hub.x + Math.cos(a) * 15.5 * zScale, y: hub.y + Math.sin(a) * 15.5 * zScale }, '#F5F9FC', 2.2, true, zScale);
          }
          R.drawIsoDot(ctx, hub, 2.4, '#C7D2DD', false, zScale);
        } else if (lv === 3) {
          R.drawIsoBox(ctx, tx + 0.36, ty + 0.36, 0.5, 0.28, 0.28, 4.0, '#758594', null, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.50, 4.5, 0.058, 42.0, '#EEF3F8', { n: 10 }, zScale);
          R.drawIsoBox(ctx, tx + 0.42, ty + 0.36, 46.5, 0.16, 0.28, 5.0, '#D0DBE6', null, zScale);
          const hub = Iso.gridToScreen(tx + 0.50, ty + 0.66, 49.0);
          for (let b = 0; b < 3; b++) {
            const a = bladeAngle + (b * Math.PI * 2) / 3;
            R.drawIsoLine(ctx, hub, { x: hub.x + Math.cos(a) * 23.0 * zScale, y: hub.y + Math.sin(a) * 23.0 * zScale }, '#F5F9FC', 2.7, true, zScale);
          }
          R.drawIsoDot(ctx, hub, 3.0, '#C7D2DD', false, zScale);
        } else {
          R.drawFrustum(ctx, tx + 0.30, ty + 0.30, 0.5, 0.40, 0.40, 6.5, 0.08, '#5E6E7E', null, zScale);
          R.drawPowerStripCyl(ctx, tx + 0.50, ty + 0.50, 5.4, 0.145, windOff, zScale);
          R.drawCyl(ctx, tx + 0.50, ty + 0.50, 7.0, 0.066, 47.0, '#EEF3F8', { n: 12 }, zScale);
          R.drawIsoBox(ctx, tx + 0.40, ty + 0.28, 54.0, 0.20, 0.38, 5.6, '#DCE5EE', null, zScale);
          R.drawIsoBox(ctx, tx + 0.395, ty + 0.275, 56.0, 0.21, 0.39, 1.3, windOff ? P.powerDim : P.power, { noTop: true, emissive: !windOff }, zScale);
          R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.46, 61.0), 1.9, windOff ? P.powerDim : P.power, !windOff, zScale);
          const hubB = Iso.gridToScreen(tx + 0.50, ty + 0.26, 56.8);
          for (let b = 0; b < 3; b++) {
            const a = -bladeAngle + 0.52 + (b * Math.PI * 2) / 3;
            R.drawIsoLine(ctx, hubB, { x: hubB.x + Math.cos(a) * 13.5 * zScale, y: hubB.y + Math.sin(a) * 13.5 * zScale }, '#CBD7E3', 2.1, true, zScale);
          }
          const hubF = Iso.gridToScreen(tx + 0.50, ty + 0.68, 56.8);
          for (let b = 0; b < 3; b++) {
            const a = bladeAngle + (b * Math.PI * 2) / 3;
            const tip = { x: hubF.x + Math.cos(a) * 26.0 * zScale, y: hubF.y + Math.sin(a) * 26.0 * zScale };
            R.drawIsoLine(ctx, hubF, tip, '#F5F9FC', 2.9, true, zScale);
            R.drawIsoDot(ctx, tip, 1.5, windOff ? P.powerDim : P.power, !windOff, zScale);
          }
          R.drawIsoDot(ctx, hubF, 3.2, '#B6C3D0', false, zScale);
        }
        break;
      }

      case 'battery_bank': {
        const ratio = st.isPreview ? 0.78 : Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0.78));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        const hasCharge = ratio > 0.01;
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
            '#2E3A2B',
            1.0,
            false,
            false,
            zScale
          );
          R.drawPolyFace(
            ctx,
            [
              Iso.gridToScreen(tx + 0.44, ty + 0.92, 0.5),
              Iso.gridToScreen(tx + 0.56, ty + 0.92, 0.5),
              Iso.gridToScreen(tx + 0.50, ty + 0.92, 7.5)
            ],
            P.baseLight,
            1.0,
            true,
            false,
            zScale
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
        // Mushroom-hood outdoor gas patio heater + glowing amber flame column (unpowered)
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.14, 2, '#5D6873', { n: 12 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 2.5, 0.045, 17, '#9AA6B2', { n: 8 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.08, 8, '#FFB347', { emissive: true, n: 10 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 19.5, 0.30, 1.5, '#D5DEE7', { n: 16 }, zScale);
        R.drawCone(ctx, tx + 0.5, ty + 0.5, 21.0, 0.30, 4, '#D5DEE7', { n: 16 }, zScale);
        break;
      }

      case 'led_floodlight': {
        // Yellow tactical tripod + cyan power band + floodlight lamp head
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
        // Cylindrical concrete pot + soil + rounded organic lush tree canopy
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.30, 7, '#B8C0C7', { n: 16 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.26, 0.02, '#5E493A', { n: 16, noSides: true, topEdge: false }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.045, 6, '#6B4A33', { n: 8 }, zScale);
        R.drawBlob(ctx, tx + 0.5, ty + 0.5, 12.5, 0.32, 15, '#5DBB63', { n: 14 }, zScale);
        R.drawBlob(ctx, tx + 0.52, ty + 0.48, 22.5, 0.20, 9, '#77D27A', { n: 12 }, zScale);
        break;
      }

      case 'vending_machine': {
        // Vertical smart drink cabinet + warm glowing showcase window + coin slot & pickup bin
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.27, 0.5, 0.52, 0.46, 22, '#2E86DE', null, zScale);
        R.drawIsoBox(ctx, tx + 0.28, ty + 0.725, 8.5, 0.30, 0.015, 11, '#FFF3D6', { emissive: true }, zScale);
        R.drawIsoBox(ctx, tx + 0.62, ty + 0.725, 10.5, 0.08, 0.015, 6, '#1B4F86', null, zScale);
        R.drawIsoBox(ctx, tx + 0.30, ty + 0.725, 3.0, 0.32, 0.015, 3, '#14365C', null, zScale);
        break;
      }

      case 'repair_bay': {
        const healCol = P.repairNano || P.heal || '#4ADE80';
        if (lv <= 1) {
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
        } else if (lv === 2) {
          R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 3, '#475361', null, zScale);
          R.drawIsoBox(ctx, tx + 0.07, ty + 0.07, 0.5, 0.86, 0.86, 1.2, '#F0A93A', { noTop: true }, zScale);
          R.drawCyl(ctx, tx + 0.32, ty + 0.32, 3.5, 0.11, 5, '#5D6B7A', { n: 12 }, zScale);
          const sway = st.isPreview ? 0 : Math.sin(timeSec * 3.2) * 0.8;
          const a = Iso.gridToScreen(tx + 0.32, ty + 0.32, 8.5);
          const b = Iso.gridToScreen(tx + 0.46, ty + 0.42, 22.5);
          const c = Iso.gridToScreen(tx + 0.66, ty + 0.62, 15.5 + sway);
          R.drawIsoLine(ctx, a, b, '#F0A93A', 3.2, true, zScale);
          R.drawIsoLine(ctx, b, c, '#F0A93A', 3.2, true, zScale);
          R.drawIsoDot(ctx, b, 2.2, '#5D6B7A', false, zScale);
          R.drawIsoDot(ctx, c, 2.6, healCol, true, zScale);
        } else {
          R.drawIsoBox(ctx, tx + 0.05, ty + 0.05, 0.5, 0.90, 0.90, 3.6, '#3E4956', null, zScale);
          R.drawIsoBox(ctx, tx + 0.045, ty + 0.045, 1.2, 0.91, 0.91, 1.2, '#F0A93A', { noTop: true }, zScale);
          R.drawRingGlow(ctx, tx + 0.50, ty + 0.58, 4.2, 0.25, 1.2, healCol, true, 20, zScale);
          R.drawIsoRibbon(ctx, Iso.gridToScreen(tx + 0.42, ty + 0.58, 4.2), Iso.gridToScreen(tx + 0.58, ty + 0.58, 4.2), 1.0, healCol, true, zScale);
          R.drawIsoRibbon(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, 4.2), Iso.gridToScreen(tx + 0.50, ty + 0.66, 4.2), 1.0, healCol, true, zScale);
          R.drawIsoBox(ctx, tx + 0.14, ty + 0.10, 4.1, 0.72, 0.20, 10.5, '#596673', null, zScale);
          R.drawIsoBox(ctx, tx + 0.28, ty + 0.305, 6.2, 0.44, 0.015, 5.2, healCol, { emissive: true }, zScale);
          R.drawIsoBox(ctx, tx + 0.16, ty + 0.14, 14.6, 0.06, 0.06, 5.2, '#F0A93A', null, zScale);
          R.drawIsoBox(ctx, tx + 0.78, ty + 0.14, 14.6, 0.06, 0.06, 5.2, '#F0A93A', null, zScale);
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
        break;
      }

      case 'lounge_set': {
        // Striped conical parasol + round patio table + 2 lounge stools
        R.drawIsoBox(ctx, tx + 0.16, ty + 0.58, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        R.drawIsoBox(ctx, tx + 0.62, ty + 0.18, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.17, 7, '#E8EEF5', { n: 16 }, zScale);
        R.drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.025, 15, '#A0AEC0', { n: 6 }, zScale);
        R.drawCone(ctx, tx + 0.5, ty + 0.5, 21.5, 0.44, 6, '#F4E6C8', { alt: '#E8A04A', n: 12 }, zScale);
        break;
      }

      case 'arcade_neon': {
        // Protruding control deck + overhanging top marquee ('ㄷ' side profile) + cyan power band
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

      case 'boss_trophy': {
        // Tapered dark pedestal + gold trim + levitating golden octahedron hologram
        R.drawFrustum(ctx, tx + 0.18, ty + 0.18, 0.5, 0.64, 0.64, 10, 0.06, '#2E3744', null, zScale);
        R.drawIsoBox(ctx, tx + 0.24, ty + 0.24, 10.5, 0.52, 0.52, 1.5, '#D4AF37', null, zScale);
        const bobZ = 25.5 + Math.sin(timeSec * 3.2) * 1.8;
        R.drawOctahedron(ctx, tx + 0.5, ty + 0.5, bobZ, 0.14, 9, '#FFE066', true, zScale);
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

  function drawHqByLevel(ctx, st, tx, ty, state, timeSec, zScale) {
    const Iso = ZS.Iso;
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

    if (lv === 1) {
      // Lv.1 임시 지휘소: circular sandbag ring (#B5A27A) + olive container (#7D8B6A, 0.6x0.54, h12) + warm door window (#FFD27A) + radio antenna (h35)
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, zb, 0.45, 5, '#B5A27A', { n: 18 }, zScale);
      R.drawIsoBox(ctx, tx + 0.20, ty + 0.22, zb, 0.60, 0.54, 12, '#7D8B6A', null, zScale);
      R.drawCyl(ctx, tx + 0.5, ty + 0.5, zb, 0.45, 5, '#B5A27A', { n: 18, noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.30, ty + 0.76, zb + 4.8, 0.24, 0.015, 4, P.baseLight, { emissive: true }, zScale);
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 12),
        Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 34),
        '#C8D0D8',
        1.4,
        false,
        zScale
      );
      const blinkOn = Math.sin(timeSec * 4.5) > -0.25;
      R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 35), 2.2, blinkOn ? P.baseLight : '#B8893A', blinkOn, zScale);
      return;
    }

    if (lv === 2) {
      // Lv.2 전술 작전 본부: body 0.84x0.84 h16 (#5B6B7C) + #FFD27A window band + bridge 0.6x0.6 h6 (#C9D3DD) + radar + LMG (0.32 tiles)
      R.drawIsoBox(ctx, tx + 0.08, ty + 0.08, zb, 0.84, 0.84, 16, '#5B6B7C', null, zScale);
      R.drawIsoBox(ctx, tx + 0.075, ty + 0.075, zb + 9, 0.85, 0.85, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.20, ty + 0.20, zb + 16, 0.60, 0.60, 6, '#C9D3DD', null, zScale);
      R.drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.32, ty + 0.32, zb + 22),
        Iso.gridToScreen(tx + 0.32, ty + 0.32, zb + 28),
        '#C9D3DD',
        1.6,
        false,
        zScale
      );
      const rTop = Iso.gridToScreen(tx + 0.32, ty + 0.32, zb + 29);
      ctx.fillStyle = Iso.resolveFaceColor('#EEF5FC', 1.0, false, 0);
      ctx.beginPath();
      ctx.ellipse(rTop.x, rTop.y, 6.0 * zScale, 3.4 * zScale, Math.sin(timeSec * 1.8) * 0.3, 0, Math.PI * 2);
      ctx.fill();

      R.drawCyl(ctx, tx + 0.62, ty + 0.62, zb + 22, 0.08, 3, '#3B4552', { n: 12 }, zScale);
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 24, aim, 0.32, 1, 2.2, '#1F242B', zScale);
      return;
    }

    if (lv === 3) {
      // Lv.3 통합 요새 사령부: sloped armor skirt 0.96 h8 (#4A5562) + body 0.76 h16 + #FFD27A band + bridge 0.56 h7 + #FFF6DA searchlight + HMG twin barrels
      R.drawFrustum(ctx, tx + 0.02, ty + 0.02, zb, 0.96, 0.96, 8, 0.06, '#4A5562', null, zScale);
      R.drawIsoBox(ctx, tx + 0.12, ty + 0.12, zb + 8, 0.76, 0.76, 16, '#5B6B7C', null, zScale);
      R.drawIsoBox(ctx, tx + 0.115, ty + 0.115, zb + 15, 0.77, 0.77, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
      R.drawIsoBox(ctx, tx + 0.22, ty + 0.22, zb + 24, 0.56, 0.56, 7, '#DCE4EC', null, zScale);
      R.drawIsoBox(ctx, tx + 0.26, ty + 0.30, zb + 31, 0.12, 0.10, 3, '#59636E', null, zScale);
      R.drawIsoBox(ctx, tx + 0.26, ty + 0.40, zb + 31.5, 0.12, 0.015, 2, '#FFF6DA', { emissive: true }, zScale);
      R.drawCyl(ctx, tx + 0.62, ty + 0.62, zb + 31, 0.10, 3.5, '#3B4552', { n: 12 }, zScale);
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 33.5, aim, 0.38, 2, 2.4, '#1F242B', zScale);
      return;
    }

    // Lv.4 이지스 코어 사령부: sloped full-tile skirt + #F0BD35 hazard band + body + 2nd tower + 2 #FFD27A bands + white Aegis dome + heavy twin barrels + #FFF3D6 core beacon
    R.drawFrustum(ctx, tx, ty, zb, 1.0, 1.0, 10, 0.07, '#3F4955', null, zScale);
    const i3 = (0.07 * 3) / 10;
    const i5 = (0.07 * 5) / 10;
    R.drawFrustum(ctx, tx + i3, ty + i3, zb + 3, 1.0 - 2 * i3, 1.0 - 2 * i3, 2, i5 - i3, '#F0BD35', { noTop: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.10, ty + 0.10, zb + 10, 0.80, 0.80, 18, '#5B6B7C', null, zScale);
    R.drawIsoBox(ctx, tx + 0.095, ty + 0.095, zb + 19, 0.81, 0.81, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
    R.drawIsoBox(ctx, tx + 0.20, ty + 0.20, zb + 28, 0.60, 0.60, 8, '#DCE4EC', null, zScale);
    R.drawIsoBox(ctx, tx + 0.195, ty + 0.195, zb + 33, 0.61, 0.61, 1.5, P.baseLight, { emissive: true, noTop: true }, zScale);
    R.drawDome(ctx, tx + 0.50, ty + 0.50, zb + 36, 0.22, 9, '#EEF3F8', { n: 16 }, zScale);
    drawHqRoofBarrels(ctx, tx + 0.50, ty + 0.50, zb + 40, aim, 0.48, 2, 3.4, '#1F242B', zScale);
    R.drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, zb + 46.5), 3.2, '#FFF3D6', true, zScale);
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
    drawStructure,
    drawHqByLevel,
    drawHqRoofBarrels,
    pushOrientedPart,
    pushOrientedBlob,
    flushOrientedParts,
    drawOperatorFigure,
    drawTurretBarrel
  });
})();
