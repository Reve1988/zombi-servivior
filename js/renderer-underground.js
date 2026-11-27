window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;
  const _thumbCacheB1 = new Map();

  const b1TerrainCache = {
    canvas: document.createElement('canvas'),
    ctx: null,
    rev: -1,
    isSil: null,
    bakeScale: 0,
    worldMinX: 0,
    worldMinY: 0,
    worldW: 0,
    worldH: 0,
    bakeCount: 0
  };

  function getRoomDef(role) {
    return (ZS.DATA && ZS.DATA.B1_ROOMS && ZS.DATA.B1_ROOMS[role]) || null;
  }

  function getB1SpaceKey(cell) {
    if (!cell || !cell.excavated || cell.bedrock || cell.elevator) return 'solid';
    if (cell.permanentCorridor || cell.corridor) return 'corridor';
    if (cell.roomId != null) return `room:${cell.roomId}`;
    return 'dirt';
  }

  function drawB1SubterraneanBackdrop(ctx, w, h, isSil) {
    if (isSil) {
      ctx.fillStyle = '#0F131A';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      Math.min(w, h) * 0.12,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.78
    );
    grad.addColorStop(0, '#161D27');
    grad.addColorStop(0.58, '#10151E');
    grad.addColorStop(1, '#090C12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawB1DioramaSlab(ctx, B1_SIZE, isSil) {
    const Iso = ZS.Iso;
    if (isSil) {
      Iso.drawVoxelBox(ctx, 0, 0, -10, B1_SIZE, B1_SIZE, 10, { base: '#9CA6B2', noTop: true });
      return;
    }
    // Deep subterranean contact drop shadow
    const sTop = Iso.gridToScreen(0.4, 0.4, -24);
    const sRight = Iso.gridToScreen(B1_SIZE + 0.4, 0.4, -24);
    const sFront = Iso.gridToScreen(B1_SIZE + 0.4, B1_SIZE + 0.4, -24);
    const sLeft = Iso.gridToScreen(0.4, B1_SIZE + 0.4, -24);
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 9, 0.54)';
    ctx.beginPath();
    ctx.moveTo(sTop.x, sTop.y);
    ctx.lineTo(sRight.x, sRight.y);
    ctx.lineTo(sFront.x, sFront.y);
    ctx.lineTo(sLeft.x, sLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3 geological basement strata underneath the 23x23 cutaway
    Iso.drawVoxelBox(ctx, 0, 0, -20, B1_SIZE, B1_SIZE, 7.5, { base: '#1E232B', noTop: true });
    Iso.drawVoxelBox(ctx, 0, 0, -12.5, B1_SIZE, B1_SIZE, 7.5, { base: '#2B323D', noTop: true });
    Iso.drawVoxelBox(ctx, 0, 0, -5, B1_SIZE, B1_SIZE, 5, { base: '#3B424E', noTop: true });
  }

  function drawB1TileFloor(ctx, ug, x, y, cell, B1_SIZE, isSil, zScale) {
    const Iso = ZS.Iso;
    if (!cell.excavated) {
      const base = isSil ? '#8F98A3' : cell.bedrock ? '#1C2129' : '#262C35';
      Iso.drawTilePoly(ctx, x, y, 0, base, base, 0.5);
      return;
    }

    if (cell.elevator) {
      // Recessed elevator shaft pit with amber/dark caution frame
      const pitCol = isSil ? '#B8C0C8' : '#202630';
      Iso.drawTilePoly(ctx, x, y, 0, pitCol, '#141820', 0.8);
      if (!isSil) {
        const p0 = Iso.gridToScreen(x + 0.08, y + 0.08, 0.25);
        const p1 = Iso.gridToScreen(x + 0.92, y + 0.08, 0.25);
        const p2 = Iso.gridToScreen(x + 0.92, y + 0.92, 0.25);
        const p3 = Iso.gridToScreen(x + 0.08, y + 0.92, 0.25);
        ctx.strokeStyle = '#D9822B';
        ctx.lineWidth = Math.max(1.4, 2.0 * zScale);
        ctx.setLineDash([4 * zScale, 3 * zScale]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }

    if (cell.permanentCorridor || cell.corridor) {
      // Steel-grate corridor (connected vs unlinked caution dark-slate; 0px cyan!)
      const isCorrConn = cell.permanentCorridor || !!(ug.corridorConnected && ug.corridorConnected[y * B1_SIZE + x]);
      const frameCol = isSil ? (isCorrConn ? '#CDD5DE' : '#B8C0C8') : (isCorrConn ? '#3C4654' : '#313944');
      const innerCol = isSil ? (isCorrConn ? '#B6C0CA' : '#A5AEB8') : (isCorrConn ? '#2A323D' : '#222831');
      Iso.drawTilePoly(ctx, x, y, 0, frameCol, '#1D242E', 0.8);
      if (!isSil) {
        const i0 = Iso.gridToScreen(x + 0.09, y + 0.09, 0.25);
        const i1 = Iso.gridToScreen(x + 0.91, y + 0.09, 0.25);
        const i2 = Iso.gridToScreen(x + 0.91, y + 0.91, 0.25);
        const i3 = Iso.gridToScreen(x + 0.09, y + 0.91, 0.25);
        R.drawPolyFace(ctx, [i0, i1, i2, i3], innerCol, 1.0, false, false, zScale);
        ctx.strokeStyle = isCorrConn ? 'rgba(130, 146, 165, 0.34)' : 'rgba(110, 122, 138, 0.26)';
        ctx.lineWidth = Math.max(0.75, 0.9 * zScale);
        ctx.beginPath();
        for (let k = 1; k <= 3; k++) {
          const u = 0.09 + (0.82 * k) / 4;
          const a = Iso.gridToScreen(x + u, y + 0.09, 0.3);
          const b = Iso.gridToScreen(x + u, y + 0.91, 0.3);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          const c = Iso.gridToScreen(x + 0.09, y + u, 0.3);
          const d = Iso.gridToScreen(x + 0.91, y + u, 0.3);
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(d.x, d.y);
        }
        ctx.stroke();

        if (cell.permanentCorridor) {
          // Subtle warm amber border highlight facing elevator core
          if (Math.abs(x - 11) + Math.abs(y - 11) === 1) {
            ctx.strokeStyle = 'rgba(229, 152, 56, 0.45)';
            ctx.lineWidth = Math.max(1.0, 1.3 * zScale);
            const r0 = Iso.gridToScreen(x + 0.14, y + 0.14, 0.35);
            const r1 = Iso.gridToScreen(x + 0.86, y + 0.14, 0.35);
            const r2 = Iso.gridToScreen(x + 0.86, y + 0.86, 0.35);
            const r3 = Iso.gridToScreen(x + 0.14, y + 0.86, 0.35);
            ctx.beginPath();
            ctx.moveTo(r0.x, r0.y);
            ctx.lineTo(r1.x, r1.y);
            ctx.lineTo(r2.x, r2.y);
            ctx.lineTo(r3.x, r3.y);
            ctx.closePath();
            ctx.stroke();
          }
        } else {
          // Player tactical corridor: warm amber guide edges along non-corridor walls (or crimson caution if unlinked)
          ctx.strokeStyle = isCorrConn ? 'rgba(229, 152, 56, 0.42)' : 'rgba(255, 77, 109, 0.42)';
          ctx.lineWidth = Math.max(1.3, 1.7 * zScale);
          const corrEdges = [
            [0, -1, 0.14, 0.14, 0.86, 0.14],
            [1, 0, 0.86, 0.14, 0.86, 0.86],
            [0, 1, 0.86, 0.86, 0.14, 0.86],
            [-1, 0, 0.14, 0.86, 0.14, 0.14]
          ];
          ctx.beginPath();
          for (let i = 0; i < corrEdges.length; i++) {
            const [dx, dy, xA, yA, xB, yB] = corrEdges[i];
            const nx = x + dx;
            const ny = y + dy;
            const nc = nx >= 0 && ny >= 0 && nx < B1_SIZE && ny < B1_SIZE ? ug.grid[ny][nx] : null;
            if (!nc || !nc.excavated || (!nc.permanentCorridor && !nc.corridor && !nc.elevator)) {
              const pA = Iso.gridToScreen(x + xA, y + yA, 0.34);
              const pB = Iso.gridToScreen(x + xB, y + yB, 0.34);
              ctx.moveTo(pA.x, pA.y);
              ctx.lineTo(pB.x, pB.y);
            }
          }
          ctx.stroke();
        }
      }
      return;
    }

    if (cell.roomId != null) {
      // Tactical Concrete Floor for zoned rooms
      const room = ug.rooms[cell.roomId];
      const rDef = room ? getRoomDef(room.role) : null;
      const checker = (x + y) % 2 === 0;
      const baseCol = isSil ? '#D6DDE5' : checker ? '#6D7680' : '#656E78';
      Iso.drawTilePoly(ctx, x, y, 0, baseCol, isSil ? '#AEB7C2' : '#4C545E', 0.75);
      if (!isSil) {
        // Subtle inner modular concrete bevel plate
        const m0 = Iso.gridToScreen(x + 0.08, y + 0.08, 0.2);
        const m1 = Iso.gridToScreen(x + 0.92, y + 0.08, 0.2);
        const m2 = Iso.gridToScreen(x + 0.92, y + 0.92, 0.2);
        const m3 = Iso.gridToScreen(x + 0.08, y + 0.92, 0.2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = Math.max(0.7, 0.85 * zScale);
        ctx.beginPath();
        ctx.moveTo(m3.x, m3.y);
        ctx.lineTo(m0.x, m0.y);
        ctx.lineTo(m1.x, m1.y);
        ctx.stroke();

        // Crisp role accent trim stripe along room perimeter edges
        const accent = (rDef && rDef.accent) || '#E8A848';
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.8, 2.2 * zScale);
        const edges = [
          [0, -1, 0.12, 0.12, 0.88, 0.12],
          [1, 0, 0.88, 0.12, 0.88, 0.88],
          [0, 1, 0.88, 0.88, 0.12, 0.88],
          [-1, 0, 0.12, 0.88, 0.12, 0.12]
        ];
        ctx.beginPath();
        for (let i = 0; i < edges.length; i++) {
          const [dx, dy, xA, yA, xB, yB] = edges[i];
          const nx = x + dx;
          const ny = y + dy;
          const nc = nx >= 0 && ny >= 0 && nx < B1_SIZE && ny < B1_SIZE ? ug.grid[ny][nx] : null;
          if (!nc || !nc.excavated || nc.roomId !== cell.roomId) {
            const pA = Iso.gridToScreen(x + xA, y + yA, 0.3);
            const pB = Iso.gridToScreen(x + xB, y + yB, 0.3);
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
          }
        }
        ctx.stroke();
      }
      return;
    }

    // Rough excavated dirt / earthen corridor floor
    const checker = (x + y) % 2 === 0;
    const dirtRaw = isSil ? '#C2C9D2' : checker ? '#5D4B3B' : '#564536';
    const jitter = 1 + ((cell.dirtSeed || 0.5) - 0.5) * 0.05;
    const dirtCol = isSil ? dirtRaw : Iso.shadeHex(dirtRaw, jitter);
    Iso.drawTilePoly(ctx, x, y, 0, dirtCol, isSil ? '#9EA7B2' : '#433529', 0.65);

    if (!isSil) {
      const h1 = R.tileHash01(x, y, 911);
      const h2 = R.tileHash01(x, y, 947);
      if (h1 < 0.72) {
        const px = x + 0.24 + h1 * 0.52;
        const py = y + 0.24 + h2 * 0.52;
        const gp = Iso.gridToScreen(px, py, 0.15);
        ctx.fillStyle = h2 > 0.5 ? 'rgba(34, 24, 17, 0.36)' : 'rgba(130, 108, 86, 0.32)';
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y, (2.2 + h1 * 2.1) * zScale, (1.1 + h2 * 1.1) * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function ensureB1TerrainCache(ug, P, isSil) {
    const Iso = ZS.Iso;
    const B1_SIZE = (ZS.DATA && ZS.DATA.B1_SIZE) || 23;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2.5);
    const worldMinX = -B1_SIZE * (Iso.TILE_W * 0.5) - 24;
    const worldMaxX = B1_SIZE * (Iso.TILE_W * 0.5) + 24;
    const worldMinY = -24;
    const worldMaxY = (B1_SIZE + 0.4) * Iso.TILE_H + 36;
    const worldW = Math.ceil(worldMaxX - worldMinX);
    const worldH = Math.ceil(worldMaxY - worldMinY);
    const bakeScale = Math.min(3.0, Math.max(2.0, dpr * 1.25), 6144 / Math.max(1, worldW));

    const dirty =
      b1TerrainCache.rev !== ug.rev ||
      b1TerrainCache.isSil !== isSil ||
      b1TerrainCache.bakeScale !== bakeScale;

    if (!dirty) return b1TerrainCache;

    b1TerrainCache.rev = ug.rev;
    b1TerrainCache.isSil = isSil;
    b1TerrainCache.bakeScale = bakeScale;
    b1TerrainCache.worldMinX = worldMinX;
    b1TerrainCache.worldMinY = worldMinY;
    b1TerrainCache.worldW = worldW;
    b1TerrainCache.worldH = worldH;

    const cw = Math.max(1, Math.round(worldW * bakeScale));
    const ch = Math.max(1, Math.round(worldH * bakeScale));
    if (b1TerrainCache.canvas.width !== cw || b1TerrainCache.canvas.height !== ch) {
      b1TerrainCache.canvas.width = cw;
      b1TerrainCache.canvas.height = ch;
    }
    const tctx = b1TerrainCache.ctx || (b1TerrainCache.ctx = b1TerrainCache.canvas.getContext('2d'));

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

      Iso.resetRenderModifiers();
      drawB1DioramaSlab(tctx, B1_SIZE, isSil);

      for (let y = 0; y < B1_SIZE; y++) {
        for (let x = 0; x < B1_SIZE; x++) {
          drawB1TileFloor(tctx, ug, x, y, ug.grid[y][x], B1_SIZE, isSil, 1.0);
        }
      }

      b1TerrainCache.bakeCount += 1;
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.minZoom = prevMinZoom;
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
    }

    return b1TerrainCache;
  }

  // Draws exposed vertical cladding or rough earthen wall on rock faces bordering open tiles
  function drawB1RockFaceWall(ctx, faceSide, tx, ty, hRock, neighborCell, ug, isSil, zScale) {
    const Iso = ZS.Iso;
    const isZoned = !!(neighborCell && neighborCell.roomId != null);
    const isCorr = !!(neighborCell && (neighborCell.permanentCorridor || neighborCell.corridor));
    const room = isZoned ? ug.rooms[neighborCell.roomId] : null;
    const rDef = room ? getRoomDef(room.role) : null;
    const shade = faceSide === 'south' ? 0.82 : 0.66;

    const p0 = faceSide === 'south'
      ? Iso.gridToScreen(tx, ty + 1, 0)
      : Iso.gridToScreen(tx + 1, ty, 0);
    const p1 = faceSide === 'south'
      ? Iso.gridToScreen(tx + 1, ty + 1, 0)
      : Iso.gridToScreen(tx + 1, ty + 1, 0);
    const p2 = faceSide === 'south'
      ? Iso.gridToScreen(tx + 1, ty + 1, hRock)
      : Iso.gridToScreen(tx + 1, ty + 1, hRock);
    const p3 = faceSide === 'south'
      ? Iso.gridToScreen(tx, ty + 1, hRock)
      : Iso.gridToScreen(tx + 1, ty, hRock);

    if (isZoned || isCorr) {
      // Concrete inner wall cladding panel (top-left 82% / 66% shading)
      const concreteCol = isSil ? '#C8D0D8' : isCorr ? '#667382' : '#7C8896';
      R.drawPolyFace(ctx, [p0, p1, p2, p3], concreteCol, shade, false, false, zScale);
      if (!isSil) {
        // Dark plinth base & accent stripe
        const zBandTop = hRock * 0.24;
        const b0 = p0;
        const b1 = p1;
        const b2 = faceSide === 'south'
          ? Iso.gridToScreen(tx + 1, ty + 1, zBandTop)
          : Iso.gridToScreen(tx + 1, ty + 1, zBandTop);
        const b3 = faceSide === 'south'
          ? Iso.gridToScreen(tx, ty + 1, zBandTop)
          : Iso.gridToScreen(tx + 1, ty, zBandTop);
        R.drawPolyFace(ctx, [b0, b1, b2, b3], isCorr ? '#3E4752' : '#4B5562', shade, false, false, zScale);

        const b1W = (ug.grid && ug.grid.length) || 23;
        const nX = faceSide === 'east' ? tx + 1 : tx;
        const nY = faceSide === 'south' ? ty + 1 : ty;
        const isCorrConn = isCorr && (neighborCell.permanentCorridor || !!(ug.corridorConnected && ug.corridorConnected[nY * b1W + nX]));
        const accent = isCorr
          ? (isCorrConn ? '#D9822B' : '#64748B')
          : ((rDef && rDef.accent) || '#E8A848');
        const lA = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.04, ty + 1, zBandTop + 0.4)
          : Iso.gridToScreen(tx + 1, ty + 0.04, zBandTop + 0.4);
        const lB = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.96, ty + 1, zBandTop + 0.4)
          : Iso.gridToScreen(tx + 1, ty + 0.96, zBandTop + 0.4);
        ctx.strokeStyle = Iso.shadeHex(accent, shade);
        ctx.lineWidth = Math.max(1.2, 1.5 * zScale);
        ctx.beginPath();
        ctx.moveTo(lA.x, lA.y);
        ctx.lineTo(lB.x, lB.y);
        ctx.stroke();

        // Mid vertical panel seam
        const mBot = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.5, ty + 1, 0)
          : Iso.gridToScreen(tx + 1, ty + 0.5, 0);
        const mTop = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.5, ty + 1, hRock)
          : Iso.gridToScreen(tx + 1, ty + 0.5, hRock);
        ctx.strokeStyle = 'rgba(18, 24, 32, 0.35)';
        ctx.lineWidth = Math.max(0.8, 1.0 * zScale);
        ctx.beginPath();
        ctx.moveTo(mBot.x, mBot.y);
        ctx.lineTo(mTop.x, mTop.y);
        ctx.stroke();
      }
    } else {
      // Natural rough earthen / dug dirt wall strata
      const zMid = hRock * 0.52;
      const e0 = p0;
      const e1 = p1;
      const e2 = faceSide === 'south'
        ? Iso.gridToScreen(tx + 1, ty + 1, zMid)
        : Iso.gridToScreen(tx + 1, ty + 1, zMid);
      const e3 = faceSide === 'south'
        ? Iso.gridToScreen(tx, ty + 1, zMid)
        : Iso.gridToScreen(tx + 1, ty, zMid);
      R.drawPolyFace(ctx, [e0, e1, e2, e3], isSil ? '#8E96A0' : '#574434', shade, false, false, zScale);
      if (!isSil) {
        // Earthy pebble/root strata band
        const sA = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.15, ty + 1, zMid * 0.5)
          : Iso.gridToScreen(tx + 1, ty + 0.15, zMid * 0.5);
        const sB = faceSide === 'south'
          ? Iso.gridToScreen(tx + 0.85, ty + 1, zMid * 0.65)
          : Iso.gridToScreen(tx + 1, ty + 0.85, zMid * 0.65);
        ctx.strokeStyle = 'rgba(34, 24, 16, 0.46)';
        ctx.lineWidth = Math.max(1.0, 1.3 * zScale);
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();
      }
    }
  }

  function drawB1RockBlock(ctx, ug, tx, ty, cell, B1_SIZE, isSil, zScale) {
    const Iso = ZS.Iso;
    const hRock = cell.bedrock ? 13 : ((ZS.DATA && ZS.DATA.B1_ROCK_Z) || 11);

    let baseCol;
    let capCol;
    if (isSil) {
      baseCol = '#AEB7C2';
      capCol = '#C2CBD4';
    } else if (cell.bedrock) {
      baseCol = '#272D36';
      capCol = '#313944';
    } else if (cell.rockTier === 1) {
      baseCol = '#756A5C';
      capCol = '#847868';
    } else if (cell.rockTier === 2) {
      baseCol = '#58626E';
      capCol = '#687280';
    } else {
      baseCol = '#3E4652';
      capCol = '#4C5664';
    }

    const jit = 1 + ((cell.dirtSeed || 0.5) - 0.5) * 0.05;
    const shadedBase = isSil ? baseCol : Iso.shadeHex(baseCol, jit);
    const shadedCap = isSil ? capCol : Iso.shadeHex(capCol, jit);

    Iso.drawVoxelBox(ctx, tx, ty, 0, 1, 1, hRock, {
      base: shadedBase,
      stroke: isSil ? null : 'rgba(15, 20, 28, 0.25)'
    });

    // Subtle sculpted top rock cap facet
    if (!isSil) {
      const inset = cell.bedrock ? 0.10 : 0.14;
      Iso.drawVoxelBox(ctx, tx + inset, ty + inset, hRock, 1 - inset * 2, 1 - inset * 2, 1.4, {
        base: shadedCap
      });

      // Radial tier 3 iron-ore fleck or tier contour cues
      if (!cell.bedrock && cell.rockTier === 3 && cell.dirtSeed > 0.52) {
        const fp = Iso.gridToScreen(tx + 0.5, ty + 0.5, hRock + 1.5);
        ctx.fillStyle = 'rgba(165, 118, 72, 0.45)';
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y, 4.2 * zScale, 2.1 * zScale, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Check South & East neighbors for open excavated faces -> draw concrete cladding or natural earthen walls
      const southCell = ty + 1 < B1_SIZE ? ug.grid[ty + 1][tx] : null;
      if (southCell && southCell.excavated) {
        drawB1RockFaceWall(ctx, 'south', tx, ty, hRock, southCell, ug, isSil, zScale);
      }
      const eastCell = tx + 1 < B1_SIZE ? ug.grid[ty][tx + 1] : null;
      if (eastCell && eastCell.excavated) {
        drawB1RockFaceWall(ctx, 'east', tx, ty, hRock, eastCell, ug, isSil, zScale);
      }

      // If North or West neighbor is a concrete room or corridor, draw crisp coping on rock edge
      const northCell = ty - 1 >= 0 ? ug.grid[ty - 1][tx] : null;
      if (northCell && northCell.excavated) {
        if (northCell.roomId != null) {
          Iso.drawVoxelBox(ctx, tx, ty, hRock, 1.0, 0.11, 1.8, { base: '#8B96A4' });
        } else if (northCell.permanentCorridor || northCell.corridor) {
          Iso.drawVoxelBox(ctx, tx, ty, hRock, 1.0, 0.11, 1.8, { base: '#7A8694' });
        }
      }
      const westCell = tx - 1 >= 0 ? ug.grid[ty][tx - 1] : null;
      if (westCell && westCell.excavated) {
        if (westCell.roomId != null) {
          Iso.drawVoxelBox(ctx, tx, ty, hRock, 0.11, 1.0, 1.8, { base: '#8B96A4' });
        } else if (westCell.permanentCorridor || westCell.corridor) {
          Iso.drawVoxelBox(ctx, tx, ty, hRock, 0.11, 1.0, 1.8, { base: '#7A8694' });
        }
      }
    }
  }

  function drawB1PartitionWallOrDoor(ctx, axis, gx, gy, hasDoor, isSil, zScale) {
    const Iso = ZS.Iso;
    const hWall = (ZS.DATA && ZS.DATA.B1_WALL_Z) || 10;
    const halfT = 0.068;
    const wallCol = isSil ? '#CED6DF' : '#8A96A4';
    const plinthCol = isSil ? '#AEB7C2' : '#535F6D';
    const frameCol = isSil ? '#8F98A3' : '#434E5B';
    const doorLeafCol = isSil ? '#7E8894' : '#353F4B';
    const amberCol = '#F59E0B';

    if (axis === 'x') {
      // Edge runs along X: (gx..gx+1) at Y = gy
      const wy = gy - halfT;
      const d = halfT * 2;
      if (!hasDoor) {
        Iso.drawVoxelBox(ctx, gx - halfT, wy, 0, 1 + d, d, 2.2, { base: plinthCol });
        Iso.drawVoxelBox(ctx, gx - halfT, wy, 2.2, 1 + d, d, hWall - 2.2, {
          base: wallCol,
          stroke: 'rgba(18, 24, 32, 0.35)'
        });
      } else {
        // Left & right pillars + overhead lintel + 3D Blast Door leaves + amber LED
        Iso.drawVoxelBox(ctx, gx - halfT, wy, 0, 0.24 + halfT, d, hWall, { base: wallCol });
        Iso.drawVoxelBox(ctx, gx + 0.76, wy, 0, 0.24 + halfT, d, hWall, { base: wallCol });
        Iso.drawVoxelBox(ctx, gx + 0.22, wy - 0.015, hWall - 2.6, 0.56, d + 0.03, 3.0, { base: frameCol });
        // Threshold sill
        Iso.drawVoxelBox(ctx, gx + 0.24, wy - 0.01, 0, 0.52, d + 0.02, 1.3, { base: '#2D3640' });
        // Twin blast bulkhead leaves
        Iso.drawVoxelBox(ctx, gx + 0.25, wy + 0.015, 1.3, 0.245, d - 0.03, hWall - 3.9, { base: doorLeafCol });
        Iso.drawVoxelBox(ctx, gx + 0.505, wy + 0.015, 1.3, 0.245, d - 0.03, hWall - 3.9, { base: doorLeafCol });
        if (!isSil) {
          // Amber hazard stripe & warm status LED (NEVER #5EF2FF cyan!)
          Iso.drawVoxelBox(ctx, gx + 0.28, wy + 0.01, 3.6, 0.44, d - 0.02, 1.1, { base: '#D9822B' });
          const led = Iso.gridToScreen(gx + 0.5, gy, hWall + 0.6);
          ctx.fillStyle = amberCol;
          ctx.beginPath();
          ctx.arc(led.x, led.y, Math.max(1.8, 2.3 * zScale), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Edge runs along Y: (gy..gy+1) at X = gx
      const wx = gx - halfT;
      const d = halfT * 2;
      if (!hasDoor) {
        Iso.drawVoxelBox(ctx, wx, gy - halfT, 0, d, 1 + d, 2.2, { base: plinthCol });
        Iso.drawVoxelBox(ctx, wx, gy - halfT, 2.2, d, 1 + d, hWall - 2.2, {
          base: wallCol,
          stroke: 'rgba(18, 24, 32, 0.35)'
        });
      } else {
        Iso.drawVoxelBox(ctx, wx, gy - halfT, 0, d, 0.24 + halfT, hWall, { base: wallCol });
        Iso.drawVoxelBox(ctx, wx, gy + 0.76, 0, d, 0.24 + halfT, hWall, { base: wallCol });
        Iso.drawVoxelBox(ctx, wx - 0.015, gy + 0.22, hWall - 2.6, d + 0.03, 0.56, 3.0, { base: frameCol });
        Iso.drawVoxelBox(ctx, wx - 0.01, gy + 0.24, 0, d + 0.02, 0.52, 1.3, { base: '#2D3640' });
        Iso.drawVoxelBox(ctx, wx + 0.015, gy + 0.25, 1.3, d - 0.03, 0.245, hWall - 3.9, { base: doorLeafCol });
        Iso.drawVoxelBox(ctx, wx + 0.015, gy + 0.505, 1.3, d - 0.03, 0.245, hWall - 3.9, { base: doorLeafCol });
        if (!isSil) {
          Iso.drawVoxelBox(ctx, wx + 0.01, gy + 0.28, 3.6, d - 0.02, 0.44, 1.1, { base: '#D9822B' });
          const led = Iso.gridToScreen(gx, gy + 0.5, hWall + 0.6);
          ctx.fillStyle = amberCol;
          ctx.beginPath();
          ctx.arc(led.x, led.y, Math.max(1.8, 2.3 * zScale), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawB1ElevatorCore(ctx, tx, ty, timeSec, isSil, zScale) {
    const Iso = ZS.Iso;
    const steelBase = isSil ? '#AEB7C2' : '#5E6B7A';
    const steelDark = isSil ? '#8F98A3' : '#39434F';
    const cageFloor = isSil ? '#CED6DF' : '#73808E';
    const hazardAmber = '#E59838';

    // Freight platform deck & safety rim
    Iso.drawVoxelBox(ctx, tx + 0.14, ty + 0.14, 0.6, 0.72, 0.72, 2.6, {
      base: cageFloor,
      stroke: 'rgba(18, 24, 32, 0.42)'
    });
    if (!isSil) {
      // Safety amber bumper trim
      Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 3.2, 0.76, 0.76, 1.0, { base: hazardAmber });
      // Inner cargo deck plate
      Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 4.2, 0.56, 0.56, 0.9, { base: '#485462' });
    }

    // 4 Corner steel guide columns rising cleanly
    const colPos = [
      [0.10, 0.10],
      [0.81, 0.10],
      [0.10, 0.81],
      [0.81, 0.81]
    ];
    for (let i = 0; i < 4; i++) {
      Iso.drawVoxelBox(ctx, tx + colPos[i][0], ty + colPos[i][1], 0.5, 0.09, 0.09, 24, {
        base: steelBase
      });
    }

    // Overhead gantry frame & hoist drum
    Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.09, 23.5, 0.82, 0.12, 2.6, { base: steelDark });
    Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.79, 23.5, 0.82, 0.12, 2.6, { base: steelDark });
    Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.09, 23.5, 0.12, 0.82, 2.6, { base: steelDark });
    Iso.drawVoxelBox(ctx, tx + 0.79, ty + 0.09, 23.5, 0.12, 0.82, 2.6, { base: steelDark });
    Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.34, 24.4, 0.44, 0.32, 3.2, { base: steelBase });

    if (!isSil) {
      // Warm amber work lights (0px #5EF2FF cyan!)
      const pulse = 0.65 + 0.35 * Math.sin((timeSec || 0) * 3.4);
      const beaconPt = Iso.gridToScreen(tx + 0.5, ty + 0.5, 28.4);
      const glowStamp = R.getEmissiveGlowStamp ? R.getEmissiveGlowStamp('#FFB84D') : null;
      if (glowStamp) {
        const gr = 24 * zScale;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.32 * pulse;
        ctx.drawImage(glowStamp, beaconPt.x - gr, beaconPt.y - gr, gr * 2, gr * 2);
        ctx.restore();
      }
      ctx.fillStyle = '#FFD27A';
      ctx.beginPath();
      ctx.arc(beaconPt.x, beaconPt.y, Math.max(2.4, 3.0 * zScale), 0, Math.PI * 2);
      ctx.fill();

      // Ground warm worklight halo around elevator shaft
      const floorCenter = Iso.gridToScreen(tx + 0.5, ty + 0.5, 2);
      if (glowStamp) {
        const fRad = 44 * zScale;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.18;
        ctx.drawImage(glowStamp, floorCenter.x - fRad, floorCenter.y - fRad * 0.55, fRad * 2, fRad * 1.1);
        ctx.restore();
      }
    }
  }

  const _b1GadgetThumbCache = new Map();
  const _b1GlowStampCache = new Map();

  function getB1GlowStamp(color) {
    if (_b1GlowStampCache.has(color)) return _b1GlowStampCache.get(color);
    const s = 64;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const gctx = c.getContext('2d');
    const grad = gctx.createRadialGradient(s * 0.5, s * 0.5, 1, s * 0.5, s * 0.5, s * 0.5);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, s, s);
    _b1GlowStampCache.set(color, c);
    return c;
  }

  function rotateB1LocalPt(lx, ly, rot) {
    const r = rot & 3;
    if (r === 1) return [ly, 1 - lx];
    if (r === 2) return [1 - lx, 1 - ly];
    if (r === 3) return [1 - ly, lx];
    return [lx, ly];
  }

  function rotateB1LocalBox(lx, ly, sx, sy, rot) {
    const r = rot & 3;
    if (r === 1) return [ly, 1 - lx - sx, sy, sx];
    if (r === 2) return [1 - lx - sx, 1 - ly - sy, sx, sy];
    if (r === 3) return [1 - ly - sy, lx, sy, sx];
    return [lx, ly, sx, sy];
  }

  function sortRotatedB1Boxes(boxes) {
    const n = boxes.length;
    if (n <= 1) return boxes;
    const indeg = new Int16Array(n);
    const adj = Array.from({ length: n }, () => []);
    const embedTol = 0.045;
    const zTol = 0.02;

    for (let i = 0; i < n; i++) {
      const A = boxes[i];
      const ax0 = A.rx;
      const ax1 = A.rx + A.rsx;
      const ay0 = A.ry;
      const ay1 = A.ry + A.rsy;
      const az0 = A.lz;
      const az1 = A.lz + A.h;
      for (let j = i + 1; j < n; j++) {
        const B = boxes[j];
        const bx0 = B.rx;
        const bx1 = B.rx + B.rsx;
        const by0 = B.ry;
        const by1 = B.ry + B.rsy;
        const bz0 = B.lz;
        const bz1 = B.lz + B.h;

        const xOverlap = ax0 < bx1 - 0.005 && bx0 < ax1 - 0.005;
        const yOverlap = ay0 < by1 - 0.005 && by0 < ay1 - 0.005;
        const zOverlap = az0 < bz1 - 0.005 && bz0 < az1 - 0.005;

        let dir = 0; // 1 => A before B, -1 => B before A
        if (xOverlap && yOverlap && !zOverlap) {
          if (az1 <= bz0 + zTol && az0 < bz0 - 0.002) dir = 1;
          else if (bz1 <= az0 + zTol && bz0 < az0 - 0.002) dir = -1;
        }
        if (dir === 0 && zOverlap) {
          const aBehindX = ax0 < bx0 - 0.002 && ax1 < bx1 - 0.002 && ax1 <= bx0 + embedTol;
          const bBehindX = bx0 < ax0 - 0.002 && bx1 < ax1 - 0.002 && bx1 <= ax0 + embedTol;
          const aBehindY = ay0 < by0 - 0.002 && ay1 < by1 - 0.002 && ay1 <= by0 + embedTol;
          const bBehindY = by0 < ay0 - 0.002 && by1 < ay1 - 0.002 && by1 <= ay0 + embedTol;
          if ((aBehindX && yOverlap) || (aBehindY && xOverlap) || (aBehindX && aBehindY)) {
            dir = 1;
          } else if ((bBehindX && yOverlap) || (bBehindY && xOverlap) || (bBehindX && bBehindY)) {
            dir = -1;
          }
        }
        if (dir === 1) {
          adj[i].push(j);
          indeg[j] += 1;
        } else if (dir === -1) {
          adj[j].push(i);
          indeg[i] += 1;
        }
      }
    }

    const done = new Uint8Array(n);
    const out = [];
    for (let step = 0; step < n; step++) {
      let pick = -1;
      let bestDeg = Infinity;
      let bestKey = Infinity;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        const deg = indeg[i];
        const b = boxes[i];
        const depthKey = (b.rx + b.rsx * 0.5) + (b.ry + b.rsy * 0.5) + b.lz * 0.02 + i * 0.0001;
        if (deg < bestDeg || (deg === bestDeg && depthKey < bestKey)) {
          bestDeg = deg;
          bestKey = depthKey;
          pick = i;
        }
      }
      if (pick < 0) break;
      done[pick] = 1;
      out.push(boxes[pick]);
      const nbrs = adj[pick];
      for (let k = 0; k < nbrs.length; k++) {
        indeg[nbrs[k]] -= 1;
      }
    }
    return out;
  }

  function makeB1WorldPainter(ctx, tx, ty, baseZ, isSil, timeSec, opts) {
    const Iso = ZS.Iso;
    const powered = opts ? !opts.blackoutPaused : true;
    const active = opts && opts.active !== undefined ? !!opts.active : true;
    const rot = opts && opts.rot ? (opts.rot & 3) : 0;
    const polys = [];
    const boxes = [];
    const glows = [];
    return {
      isSil: !!isSil,
      isThumb: false,
      powered,
      active,
      timeSec: timeSec || 0,
      pt(lx, ly, lz) {
        const [rx, ry] = rotateB1LocalPt(lx, ly, rot);
        return Iso.gridToScreen(tx + rx, ty + ry, baseZ + lz);
      },
      box(lx, ly, lz, sx, sy, h, boxOpts) {
        const [rx, ry, rsx, rsy] = rotateB1LocalBox(lx, ly, sx, sy, rot);
        const o = Object.assign({}, boxOpts);
        if (isSil) {
          o.base = '#B8C0C8';
          delete o.top;
          delete o.left;
          delete o.right;
          o.stroke = 'rgba(18, 24, 32, 0.35)';
        }
        boxes.push({ rx, ry, lz, rsx, rsy, h, o });
      },
      poly(pts3d, fill, stroke, lineWidth) {
        if (isSil && !fill) return;
        polys.push({ pts3d, fill, stroke, lineWidth });
      },
      glowEllipse(lx, ly, lz, rx, ry, color, alpha) {
        if (isSil || !color || alpha <= 0) return;
        const [rlx, rly] = rotateB1LocalPt(lx, ly, rot);
        glows.push({ rlx, rly, lz, rx, ry, color, alpha });
      },
      flush() {
        for (let i = 0; i < polys.length; i++) {
          const pl = polys[i];
          ctx.save();
          ctx.beginPath();
          for (let j = 0; j < pl.pts3d.length; j++) {
            const [prx, pry] = rotateB1LocalPt(pl.pts3d[j][0], pl.pts3d[j][1], rot);
            const p = Iso.gridToScreen(tx + prx, ty + pry, baseZ + pl.pts3d[j][2]);
            if (j === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          if (pl.fill) {
            ctx.fillStyle = isSil ? '#B8C0C8' : pl.fill;
            ctx.fill();
          }
          if (pl.stroke) {
            ctx.strokeStyle = isSil ? 'rgba(18, 24, 32, 0.35)' : pl.stroke;
            ctx.lineWidth = pl.lineWidth || 1;
            ctx.stroke();
          }
          ctx.restore();
        }

        const ordered = rot === 0 ? boxes : sortRotatedB1Boxes(boxes);
        for (let i = 0; i < ordered.length; i++) {
          const b = ordered[i];
          Iso.drawVoxelBox(ctx, tx + b.rx, ty + b.ry, baseZ + b.lz, b.rsx, b.rsy, b.h, b.o);
        }

        for (let i = 0; i < glows.length; i++) {
          const g = glows[i];
          const p = Iso.gridToScreen(tx + g.rlx, ty + g.rly, baseZ + g.lz);
          const stamp = getB1GlowStamp(g.color);
          ctx.save();
          ctx.globalAlpha = g.alpha;
          ctx.drawImage(stamp, p.x - g.rx, p.y - g.ry, g.rx * 2, g.ry * 2);
          ctx.restore();
        }
      }
    };
  }

  function makeB1MiniPainter(ctx, originX, originY, tileScale, zScale) {
    const Iso = ZS.Iso;
    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);
    function pt(lx, ly, lz) {
      const ix = (lx - ly) * tileScale * cos * 0.52;
      const iy = (lx + ly) * tileScale * sin * 0.52 - lz * zScale;
      return { x: originX + ix, y: originY + iy };
    }
    return {
      isSil: false,
      isThumb: true,
      powered: true,
      active: true,
      timeSec: 0.4,
      pt,
      box(lx, ly, lz, sx, sy, h, opts) {
        const base = (opts && opts.base) || '#738292';
        const topCol = (opts && opts.top) || base;
        const leftCol = (opts && opts.left) || (Iso.shadeHex ? Iso.shadeHex(base, 0.82) : base);
        const rightCol = (opts && opts.right) || (Iso.shadeHex ? Iso.shadeHex(base, 0.66) : base);
        const stroke = (opts && opts.stroke) || 'rgba(14, 20, 28, 0.7)';
        const lw = (opts && opts.lineWidth) || 0.85;

        const p000 = pt(lx, ly, lz);
        const p100 = pt(lx + sx, ly, lz);
        const p110 = pt(lx + sx, ly + sy, lz);
        const p010 = pt(lx, ly + sy, lz);
        const p001 = pt(lx, ly, lz + h);
        const p101 = pt(lx + sx, ly, lz + h);
        const p111 = pt(lx + sx, ly + sy, lz + h);
        const p011 = pt(lx, ly + sy, lz + h);

        function drawFace(pts, fill) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
        drawFace([p010, p110, p111, p011], leftCol);
        drawFace([p100, p110, p111, p101], rightCol);
        drawFace([p001, p101, p111, p011], topCol);
      },
      poly(pts3d, fill, stroke, lineWidth) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < pts3d.length; i++) {
          const p = pt(pts3d[i][0], pts3d[i][1], pts3d[i][2]);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lineWidth || 0.9;
          ctx.stroke();
        }
        ctx.restore();
      },
      glowEllipse(lx, ly, lz, rx, ry, color, alpha) {
        if (!color || alpha <= 0) return;
        const p = pt(lx, ly, lz);
        const rScaled = Math.max(3, rx * 0.42);
        ctx.save();
        const grad = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rScaled);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rScaled, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
  }

  function paintB1Gadget(P, id) {
    const darkStroke = 'rgba(14, 20, 28, 0.62)';
    const onCyan = P.powered && P.active;
    const cyan = onCyan ? '#5EF2FF' : '#24313E';
    const cyanMid = onCyan ? '#36B8C8' : '#1B2530';
    const pulse = onCyan ? (0.78 + 0.22 * Math.sin(P.timeSec * 3.8)) : 0;

    if (!P.isSil && !P.isThumb) {
      P.poly(
        [[0.08, 0.08, 0.04], [0.92, 0.08, 0.04], [0.92, 0.92, 0.04], [0.08, 0.92, 0.04]],
        'rgba(8, 12, 18, 0.34)',
        null,
        0
      );
    }

    switch (id) {
      case 'b1_bunk_bed': {
        // Steel 4-post frame + lower & upper tactical bunks + ladder (0px cyan)
        P.box(0.14, 0.14, 0, 0.07, 0.07, 18.5, { base: '#465361', stroke: darkStroke });
        P.box(0.79, 0.14, 0, 0.07, 0.07, 18.5, { base: '#465361', stroke: darkStroke });
        P.box(0.14, 0.78, 0, 0.07, 0.07, 18.5, { base: '#465361', stroke: darkStroke });
        P.box(0.79, 0.78, 0, 0.07, 0.07, 18.5, { base: '#465361', stroke: darkStroke });
        // Lower bunk + pillow + olive mattress
        P.box(0.16, 0.17, 2.2, 0.68, 0.64, 1.4, { base: '#505E6C', stroke: darkStroke });
        P.box(0.18, 0.20, 3.6, 0.64, 0.58, 2.2, { base: '#7B8B63', stroke: darkStroke });
        P.box(0.20, 0.22, 5.8, 0.18, 0.42, 1.0, { base: '#DAD4C2', stroke: darkStroke });
        P.box(0.42, 0.20, 5.8, 0.38, 0.56, 0.9, { base: '#4B6378', stroke: darkStroke });
        // Upper bunk + rail
        P.box(0.16, 0.17, 11.2, 0.68, 0.64, 1.4, { base: '#505E6C', stroke: darkStroke });
        P.box(0.18, 0.20, 12.6, 0.64, 0.58, 2.2, { base: '#87976E', stroke: darkStroke });
        P.box(0.20, 0.22, 14.8, 0.18, 0.42, 1.0, { base: '#DFD9C7', stroke: darkStroke });
        P.box(0.42, 0.20, 14.8, 0.38, 0.56, 0.9, { base: '#556E84', stroke: darkStroke });
        P.box(0.20, 0.78, 15.0, 0.58, 0.05, 2.2, { base: '#697988', stroke: darkStroke });
        // Side ladder rungs
        P.box(0.58, 0.81, 2.5, 0.05, 0.05, 13.5, { base: '#8B9AA8', stroke: darkStroke });
        P.box(0.72, 0.81, 2.5, 0.05, 0.05, 13.5, { base: '#8B9AA8', stroke: darkStroke });
        break;
      }
      case 'b1_locker': {
        // Twin olive-slate steel lockers with louvers & brass locks (0px cyan)
        P.box(0.16, 0.18, 0, 0.68, 0.62, 1.4, { base: '#3B4652', stroke: darkStroke });
        P.box(0.18, 0.20, 1.4, 0.31, 0.58, 18.0, { base: '#576878', stroke: darkStroke });
        P.box(0.51, 0.20, 1.4, 0.31, 0.58, 18.0, { base: '#5E7080', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.22, 0.75, 15.4, 0.22, 0.04, 2.0, { base: '#2D3844', stroke: darkStroke });
          P.box(0.55, 0.75, 15.4, 0.22, 0.04, 2.0, { base: '#2D3844', stroke: darkStroke });
          P.box(0.24, 0.76, 9.6, 0.08, 0.04, 1.6, { base: '#D8A94E', stroke: darkStroke });
          P.box(0.57, 0.76, 9.6, 0.08, 0.04, 1.6, { base: '#D8A94E', stroke: darkStroke });
          P.box(0.22, 0.26, 19.4, 0.28, 0.28, 2.6, { base: '#8B6D4E', stroke: darkStroke });
        }
        break;
      }
      case 'b1_shower_booth': {
        // Ceramic tiled enclosure + basin + stainless showerhead (0px cyan)
        P.box(0.14, 0.14, 0, 0.72, 0.72, 2.4, { base: '#7B8A98', stroke: darkStroke });
        P.box(0.24, 0.24, 2.2, 0.52, 0.52, 0.5, { base: '#2F3B47', stroke: darkStroke });
        P.box(0.14, 0.14, 2.4, 0.72, 0.12, 17.6, { base: '#A2B0BD', stroke: darkStroke });
        P.box(0.14, 0.14, 2.4, 0.12, 0.72, 17.6, { base: '#94A3B1', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.46, 0.24, 6.0, 0.08, 0.08, 12.2, { base: '#CDD7E0', stroke: darkStroke });
          P.box(0.40, 0.26, 17.2, 0.20, 0.18, 1.4, { base: '#DFE7EE', stroke: darkStroke });
          P.box(0.18, 0.44, 11.2, 0.08, 0.28, 1.2, { base: '#C87654', stroke: darkStroke });
        }
        break;
      }
      case 'b1_air_purifier': {
        // Cylindrical-chamfered HEPA purifier tower with cyan HEPA ring
        P.box(0.22, 0.22, 0, 0.56, 0.56, 2.0, { base: '#485564', stroke: darkStroke });
        P.box(0.26, 0.26, 2.0, 0.48, 0.48, 13.0, { base: '#C7D3DD', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.32, 0.72, 4.2, 0.36, 0.04, 6.2, { base: '#34414E', stroke: darkStroke });
          P.box(0.30, 0.30, 15.0, 0.40, 0.40, 1.6, { base: cyanMid, stroke: darkStroke });
          P.box(0.28, 0.28, 16.6, 0.44, 0.44, 2.2, { base: '#8FA0AF', stroke: darkStroke });
          P.box(0.45, 0.73, 12.4, 0.10, 0.04, 1.4, { base: cyan, stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.5, 16.0, 12, 7, '#5EF2FF', 0.22 * pulse);
        break;
      }
      case 'b1_research_desk': {
        // Walnut/steel workstation + blueprint + warm amber brass lamp (0px cyan)
        P.box(0.14, 0.20, 0, 0.12, 0.58, 7.6, { base: '#424E5B', stroke: darkStroke });
        P.box(0.74, 0.20, 0, 0.12, 0.58, 7.6, { base: '#424E5B', stroke: darkStroke });
        P.box(0.12, 0.18, 7.6, 0.76, 0.62, 1.6, { base: '#765D46', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.22, 0.34, 9.2, 0.32, 0.28, 0.5, { base: '#E4DAC0', stroke: darkStroke });
          P.box(0.58, 0.26, 9.2, 0.16, 0.16, 4.8, { base: '#9BA8B4', stroke: darkStroke });
          // Warm brass desk lamp
          P.box(0.20, 0.22, 9.2, 0.12, 0.12, 5.2, { base: '#8E6B3A', stroke: darkStroke });
          P.box(0.22, 0.24, 14.2, 0.16, 0.14, 1.8, { base: '#FFB347', stroke: darkStroke });
        }
        break;
      }
      case 'b1_server_rack': {
        // Twin dark server cabinets + vertical cyan blade LED strips
        P.box(0.14, 0.20, 0, 0.34, 0.58, 19.2, { base: '#34404C', stroke: darkStroke });
        P.box(0.52, 0.20, 0, 0.34, 0.58, 19.2, { base: '#3B4856', stroke: darkStroke });
        P.box(0.16, 0.22, 19.2, 0.68, 0.54, 1.8, { base: '#556574', stroke: darkStroke });
        if (!P.isSil) {
          for (let z = 3.2; z <= 15.2; z += 4.0) {
            P.box(0.18, 0.76, z, 0.26, 0.04, 1.6, { base: '#212A33', stroke: darkStroke });
            P.box(0.56, 0.76, z, 0.26, 0.04, 1.6, { base: '#212A33', stroke: darkStroke });
            P.box(0.36, 0.78, z + 0.3, 0.07, 0.04, 1.0, { base: cyan, stroke: darkStroke });
            P.box(0.74, 0.78, z + 0.3, 0.07, 0.04, 1.0, { base: cyan, stroke: darkStroke });
          }
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.85, 11.0, 14, 8, '#5EF2FF', 0.24 * pulse);
        break;
      }
      case 'b1_specimen_bench': {
        // Stainless bench + glowing bio-lime/amber containment cylinder (0px cyan)
        P.box(0.14, 0.20, 0, 0.72, 0.58, 7.8, { base: '#52606E', stroke: darkStroke });
        P.box(0.12, 0.18, 7.8, 0.76, 0.62, 1.6, { base: '#96A4B0', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.24, 0.26, 9.4, 0.22, 0.22, 1.4, { base: '#3D4854', stroke: darkStroke });
          P.box(0.26, 0.28, 10.8, 0.18, 0.18, 5.4, { base: '#8AD968', stroke: darkStroke });
          P.box(0.24, 0.26, 16.2, 0.22, 0.22, 1.2, { base: '#465462', stroke: darkStroke });
          P.box(0.54, 0.34, 9.4, 0.22, 0.26, 3.2, { base: '#D48A45', stroke: darkStroke });
        }
        break;
      }
      case 'b1_holo_table': {
        // Heavy tactical octagonal-stepped base + hovering cyan holographic projection
        P.box(0.14, 0.14, 0, 0.72, 0.72, 5.8, { base: '#3E4B59', stroke: darkStroke });
        P.box(0.20, 0.20, 5.8, 0.60, 0.60, 2.2, { base: '#586776', stroke: darkStroke });
        P.box(0.28, 0.28, 8.0, 0.44, 0.44, 0.9, { base: '#1E2832', stroke: darkStroke });
        if (!P.isSil) {
          if (onCyan) {
            const lift = 0.8 * Math.sin(P.timeSec * 3.0);
            P.box(0.32, 0.32, 10.6 + lift, 0.36, 0.36, 1.2, { base: cyanMid, stroke: '#9BF9FF' });
            P.box(0.40, 0.40, 12.6 + lift, 0.20, 0.20, 4.6, { base: cyan, stroke: '#CCFDFD' });
          } else {
            P.box(0.34, 0.34, 8.9, 0.32, 0.32, 0.8, { base: '#24313E', stroke: darkStroke });
          }
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.5, 13.5, 17, 10, '#5EF2FF', 0.32 * pulse);
        break;
      }
      case 'b1_pallet_rack': {
        // Industrial orange uprights + wooden crate & strapped steel scrap (0px cyan)
        P.box(0.12, 0.16, 0, 0.08, 0.08, 19.0, { base: '#D67E33', stroke: darkStroke });
        P.box(0.80, 0.16, 0, 0.08, 0.08, 19.0, { base: '#D67E33', stroke: darkStroke });
        P.box(0.12, 0.76, 0, 0.08, 0.08, 19.0, { base: '#D67E33', stroke: darkStroke });
        P.box(0.80, 0.76, 0, 0.08, 0.08, 19.0, { base: '#D67E33', stroke: darkStroke });
        // Shelves
        P.box(0.14, 0.18, 2.0, 0.72, 0.64, 1.2, { base: '#4D5A68', stroke: darkStroke });
        P.box(0.14, 0.18, 10.8, 0.72, 0.64, 1.2, { base: '#4D5A68', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.20, 0.24, 3.2, 0.30, 0.50, 5.2, { base: '#A27B52', stroke: darkStroke });
          P.box(0.52, 0.24, 3.2, 0.28, 0.48, 4.4, { base: '#75805B', stroke: darkStroke });
          P.box(0.20, 0.24, 12.0, 0.34, 0.48, 4.8, { base: '#7B8B99', stroke: darkStroke });
          P.box(0.56, 0.26, 12.0, 0.22, 0.42, 3.6, { base: '#B28A5B', stroke: darkStroke });
        }
        break;
      }
      case 'b1_logistics_term': {
        // Steel logistics console + dual angled cyan manifest screens + freight box
        P.box(0.14, 0.24, 0, 0.72, 0.52, 8.0, { base: '#4C5B6A', stroke: darkStroke });
        P.box(0.16, 0.20, 8.0, 0.68, 0.34, 1.5, { base: '#697988', stroke: darkStroke });
        P.box(0.22, 0.22, 9.5, 0.26, 0.14, 7.6, { base: '#2D3742', stroke: darkStroke });
        P.box(0.52, 0.22, 9.5, 0.26, 0.14, 7.6, { base: '#2D3742', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.25, 0.34, 10.6, 0.20, 0.04, 5.4, { base: cyan, stroke: darkStroke });
          P.box(0.55, 0.34, 10.6, 0.20, 0.04, 5.4, { base: cyan, stroke: darkStroke });
          P.box(0.22, 0.54, 9.4, 0.20, 0.20, 2.0, { base: '#B68952', stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.45, 13.5, 13, 8, '#5EF2FF', 0.24 * pulse);
        break;
      }
      case 'vending_machine': {
        // Smart beverage dispenser: crimson armor + warm backlit glass cans (0px cyan)
        P.box(0.18, 0.20, 0, 0.64, 0.58, 20.5, { base: '#B24840', stroke: darkStroke });
        P.box(0.20, 0.74, 2.0, 0.38, 0.06, 15.5, { base: '#34404C', stroke: darkStroke });
        if (!P.isSil) {
          // Warm backlit drink window
          P.box(0.23, 0.77, 8.2, 0.32, 0.04, 8.4, { base: '#FFF2CE', stroke: darkStroke });
          P.box(0.25, 0.79, 13.8, 0.09, 0.03, 1.8, { base: '#FF6B5A', stroke: darkStroke });
          P.box(0.36, 0.79, 13.8, 0.09, 0.03, 1.8, { base: '#FFB347', stroke: darkStroke });
          P.box(0.25, 0.79, 10.6, 0.09, 0.03, 1.8, { base: '#7AE084', stroke: darkStroke });
          P.box(0.36, 0.79, 10.6, 0.09, 0.03, 1.8, { base: '#D88E4A', stroke: darkStroke });
          P.box(0.62, 0.76, 10.4, 0.14, 0.04, 3.6, { base: '#FFB347', stroke: darkStroke });
          P.box(0.24, 0.77, 2.8, 0.30, 0.05, 3.2, { base: '#1E2730', stroke: darkStroke });
        }
        break;
      }
      case 'lounge_set': {
        // Tactical sectional sofa + low steel coffee table + mug (0px cyan)
        P.box(0.12, 0.14, 0, 0.76, 0.24, 9.5, { base: '#965E3C', stroke: darkStroke });
        P.box(0.12, 0.38, 0, 0.24, 0.48, 9.5, { base: '#8B5636', stroke: darkStroke });
        P.box(0.16, 0.18, 2.4, 0.70, 0.28, 3.2, { base: '#B87850', stroke: darkStroke });
        P.box(0.16, 0.44, 2.4, 0.28, 0.40, 3.2, { base: '#B0724B', stroke: darkStroke });
        // Low coffee table
        P.box(0.46, 0.48, 0, 0.42, 0.38, 3.2, { base: '#4C5866', stroke: darkStroke });
        P.box(0.44, 0.46, 3.2, 0.46, 0.42, 1.0, { base: '#788694', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.56, 0.56, 4.2, 0.10, 0.10, 1.8, { base: '#EDE4D0', stroke: darkStroke });
          P.box(0.66, 0.22, 5.6, 0.16, 0.16, 2.2, { base: '#5E7262', stroke: darkStroke });
        }
        break;
      }
      case 'b1_coffee_bar': {
        // Wood/steel coffee bar + copper espresso machine + warm cup stack (0px cyan)
        P.box(0.12, 0.20, 0, 0.76, 0.58, 8.6, { base: '#72523B', stroke: darkStroke });
        P.box(0.10, 0.18, 8.6, 0.80, 0.62, 1.5, { base: '#8A98A6', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.20, 0.26, 10.1, 0.36, 0.28, 5.4, { base: '#B87141', stroke: darkStroke });
          P.box(0.24, 0.50, 11.4, 0.28, 0.08, 2.0, { base: '#434E5B', stroke: darkStroke });
          P.box(0.32, 0.52, 14.0, 0.12, 0.04, 1.2, { base: '#FFB347', stroke: darkStroke });
          P.box(0.64, 0.32, 10.1, 0.14, 0.14, 2.8, { base: '#EDE5D4', stroke: darkStroke });
        }
        break;
      }
      case 'arcade_neon': {
        // Dark arcade cabinet + magenta trim + neon cyan CRT & marquee
        P.box(0.22, 0.20, 0, 0.56, 0.54, 11.0, { base: '#343D4B', stroke: darkStroke });
        P.box(0.22, 0.20, 11.0, 0.56, 0.36, 9.0, { base: '#3B4555', stroke: darkStroke });
        if (!P.isSil) {
          const neonMag = onCyan ? '#FF5EB8' : '#3E2B3A';
          P.box(0.20, 0.20, 2.0, 0.04, 0.54, 17.5, { base: neonMag, stroke: darkStroke });
          P.box(0.76, 0.20, 2.0, 0.04, 0.54, 17.5, { base: neonMag, stroke: darkStroke });
          // CRT display + marquee
          P.box(0.28, 0.54, 12.0, 0.44, 0.05, 5.2, { base: cyan, stroke: darkStroke });
          P.box(0.26, 0.55, 18.0, 0.48, 0.06, 2.2, { base: neonMag, stroke: darkStroke });
          P.box(0.30, 0.54, 10.0, 0.40, 0.20, 1.2, { base: '#4D5A68', stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.72, 13.5, 13, 8, '#5EF2FF', 0.26 * pulse);
        break;
      }
      case 'b1_media_screen': {
        // Twin steel floor trusses + wide cyan tactical display wall
        P.box(0.20, 0.24, 0, 0.12, 0.42, 3.0, { base: '#485664', stroke: darkStroke });
        P.box(0.68, 0.24, 0, 0.12, 0.42, 3.0, { base: '#485664', stroke: darkStroke });
        P.box(0.22, 0.38, 3.0, 0.08, 0.12, 14.0, { base: '#5E6E7D', stroke: darkStroke });
        P.box(0.70, 0.38, 3.0, 0.08, 0.12, 14.0, { base: '#5E6E7D', stroke: darkStroke });
        P.box(0.08, 0.34, 7.2, 0.84, 0.18, 11.4, { base: '#27313B', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.13, 0.50, 8.2, 0.74, 0.04, 9.2, { base: cyanMid, stroke: darkStroke });
          P.box(0.18, 0.52, 11.2, 0.64, 0.04, 2.8, { base: cyan, stroke: darkStroke });
          P.box(0.18, 0.52, 9.2, 0.20, 0.04, 1.4, { base: onCyan ? '#FFB347' : '#3A3228', stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.65, 12.5, 16, 9, '#5EF2FF', 0.25 * pulse);
        break;
      }
      case 'b1_ess_rack': {
        // Armored ESS battery rack + compact #5EF2FF charge bar when connected
        P.box(0.14, 0.18, 0, 0.72, 0.64, 19.6, { base: '#3F4C5A', stroke: darkStroke });
        if (!P.isSil) {
          for (let i = 0; i < 3; i++) {
            const z = 2.4 + i * 5.4;
            P.box(0.18, 0.78, z, 0.64, 0.06, 4.2, { base: '#566676', stroke: darkStroke });
            P.box(0.22, 0.81, z + 1.4, 0.36, 0.04, 1.2, { base: cyan, stroke: darkStroke });
            P.box(0.66, 0.81, z + 1.4, 0.10, 0.04, 1.2, { base: '#FFB347', stroke: darkStroke });
          }
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.5, 0.86, 10.0, 10, 6, '#5EF2FF', 0.16);
        break;
      }
      case 'b1_power_panel': {
        // High-voltage switchgear cabinet + amber busbar + cyan meter strip
        P.box(0.16, 0.22, 0, 0.68, 0.54, 18.6, { base: '#556372', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.22, 0.73, 10.6, 0.32, 0.05, 5.6, { base: '#242D36', stroke: darkStroke });
          P.box(0.26, 0.76, 12.8, 0.24, 0.04, 1.6, { base: cyan, stroke: darkStroke });
          P.box(0.58, 0.74, 11.4, 0.16, 0.06, 4.4, { base: '#D44D44', stroke: darkStroke });
          P.box(0.22, 0.73, 4.2, 0.54, 0.05, 3.8, { base: '#D68E45', stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.42, 0.84, 13.0, 9, 5, '#5EF2FF', 0.16);
        break;
      }
      case 'b1_backup_gen': {
        // Olive diesel generator block + exhaust stack + cyan bus indicator
        const vib = onCyan && !P.isThumb ? Math.sin(P.timeSec * 36) * 0.22 : 0;
        P.box(0.12, 0.18, 0, 0.76, 0.64, 2.2, { base: '#3A4552', stroke: darkStroke });
        P.box(0.14, 0.22, 2.2 + vib, 0.72, 0.56, 11.2, { base: '#5E6C58', stroke: darkStroke });
        P.box(0.20, 0.24, 13.4 + vib, 0.16, 0.16, 6.2, { base: '#46515D', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.68, 0.26, 4.0 + vib, 0.20, 0.48, 7.6, { base: '#323C46', stroke: darkStroke });
          P.box(0.22, 0.76, 8.6 + vib, 0.26, 0.05, 1.6, { base: cyan, stroke: darkStroke });
          P.box(0.56, 0.36, 13.4 + vib, 0.16, 0.16, 1.4, { base: '#D48036', stroke: darkStroke });
        }
        if (onCyan && !P.isThumb) P.glowEllipse(0.36, 0.84, 9.0, 9, 5, '#5EF2FF', 0.16);
        break;
      }
      case 'b1_ceiling_led':
      default: {
        // Unpowered tactical amber tripod worklight (STRICTLY warm amber #FFB347, 0px cyan!)
        P.box(0.24, 0.24, 0, 0.52, 0.52, 1.6, { base: '#4E5C6A', stroke: darkStroke });
        P.box(0.45, 0.45, 1.6, 0.10, 0.10, 14.4, { base: '#7B8A98', stroke: darkStroke });
        P.box(0.32, 0.34, 15.8, 0.36, 0.32, 3.6, { base: '#627280', stroke: darkStroke });
        if (!P.isSil) {
          P.box(0.36, 0.64, 16.4, 0.28, 0.06, 2.4, { base: P.active ? '#FFB347' : '#58442C', stroke: darkStroke });
          P.box(0.40, 0.66, 16.8, 0.20, 0.04, 1.6, { base: P.active ? '#FFE6A8' : '#735A3B', stroke: darkStroke });
          if (P.active && !P.isThumb) {
            P.glowEllipse(0.5, 0.5, 0.1, 46, 24, '#FFB347', 0.22);
          } else if (P.isThumb) {
            P.glowEllipse(0.5, 0.68, 16.5, 14, 10, '#FFB347', 0.34);
          }
        }
        break;
      }
    }
    if (P.flush) P.flush();
  }

  function drawB1GadgetStatusBadge(ctx, tx, ty, status, zScale) {
    const Iso = ZS.Iso;
    if (!status || status.active) return;
    const p = Iso.gridToScreen(tx + 0.5, ty + 0.5, 22);
    const label = !status.connected ? '미연결' : 'OFF';
    const bg = !status.connected ? 'rgba(64, 42, 18, 0.88)' : 'rgba(48, 22, 26, 0.88)';
    const border = !status.connected ? '#FFB347' : '#FF6B6B';
    ctx.save();
    ctx.font = '700 12px "Pretendard", "Noto Sans KR", sans-serif';
    const w = Math.max(38, ctx.measureText(label).width + 12);
    const h = 18;
    const bx = p.x - w * 0.5;
    const by = p.y - h - 2;
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = border;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, by + h * 0.5 + 0.5);
    ctx.restore();
  }

  function drawB1Gadget(ctx, gadget, tx, ty, ug, state, timeSec, isSil, zScale) {
    const status = ZS.Game && ZS.Game.getB1GadgetStatus
      ? ZS.Game.getB1GadgetStatus(tx, ty)
      : { connected: true, blackoutPaused: false, active: true };
    const timer = gadget.buildAnimTimer || 0;
    const dropZ = timer > 0 ? Math.sin((timer / 0.24) * Math.PI) * 6.5 : 0;
    const painterOpts = Object.assign({}, status, { rot: gadget.rot || 0 });
    const painter = makeB1WorldPainter(ctx, tx, ty, 2.0 + dropZ, isSil, timeSec, painterOpts);
    paintB1Gadget(painter, gadget.id);
    if (!isSil && state && state.phase !== 'night') {
      drawB1GadgetStatusBadge(ctx, tx, ty, status, zScale);
    } else if (!isSil && status && status.connected && status.blackoutPaused) {
      drawB1GadgetStatusBadge(ctx, tx, ty, status, zScale);
    }
  }

  function renderB1GadgetThumbnail(itemId, size) {
    const sz = size || 48;
    const key = `${itemId}_${sz}`;
    if (_b1GadgetThumbCache.has(key)) return _b1GadgetThumbCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = sz;
    canvas.height = sz;
    const ctx = canvas.getContext('2d');
    const painter = makeB1MiniPainter(ctx, sz * 0.5, sz * 0.64, sz * 0.72, sz * 0.025);
    paintB1Gadget(painter, itemId);
    const url = canvas.toDataURL('image/png');
    _b1GadgetThumbCache.set(key, url);
    return url;
  }

  function drawB1DirectionCue(ctx, tx, ty, zOff, rot) {
    const Iso = ZS.Iso;
    const [txA, tyA] = rotateB1LocalPt(0.50, 0.96, rot);
    const [txB, tyB] = rotateB1LocalPt(0.36, 0.77, rot);
    const [txC, tyC] = rotateB1LocalPt(0.64, 0.77, rot);
    const pA = Iso.gridToScreen(tx + txA, ty + tyA, zOff);
    const pB = Iso.gridToScreen(tx + txB, ty + tyB, zOff);
    const pC = Iso.gridToScreen(tx + txC, ty + tyC, zOff);
    ctx.save();
    ctx.fillStyle = '#FFB347';
    ctx.strokeStyle = '#1B2430';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.lineTo(pC.x, pC.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawB1RoomLabelsAndWarnings(ctx, ug, B1_SIZE, zScale) {
    const Iso = ZS.Iso;
    const rKeys = Object.keys(ug.rooms || {});
    if (rKeys.length === 0) return;

    ctx.save();
    const fontPx = Math.max(12, Math.round(12 * Math.min(1.15, Math.max(0.95, zScale))));
    ctx.font = `700 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < rKeys.length; i++) {
      const room = ug.rooms[rKeys[i]];
      if (!room || !Array.isArray(room.tiles) || room.tiles.length === 0) continue;
      const rDef = getRoomDef(room.role);
      if (!rDef) continue;

      let sx = 0;
      let sy = 0;
      for (let t = 0; t < room.tiles.length; t++) {
        sx += room.tiles[t][0];
        sy += room.tiles[t][1];
      }
      const mx = sx / room.tiles.length;
      const my = sy / room.tiles.length;

      // Pick tile inside the room closest to arithmetic centroid
      let bestTile = room.tiles[0];
      let bestDist = Infinity;
      for (let t = 0; t < room.tiles.length; t++) {
        const dx = room.tiles[t][0] - mx;
        const dy = room.tiles[t][1] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          bestTile = room.tiles[t];
        }
      }

      const sc = Iso.gridToScreen(bestTile[0] + 0.5, bestTile[1] + 0.5, 4);
      const label = `${rDef.name}`;
      const textW = ctx.measureText(label).width;
      const pillW = textW + 22;
      const pillH = 22;
      const rx = sc.x - pillW * 0.5;
      const ry = sc.y - pillH * 0.5;

      // Room role badge pill
      ctx.fillStyle = 'rgba(13, 19, 28, 0.88)';
      ctx.strokeStyle = room.connected ? rDef.accent : '#FF4D6D';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rx, ry, pillW, pillH, 6);
      ctx.fill();
      ctx.stroke();

      // Status dot (green connected / crimson disconnected)
      ctx.fillStyle = room.connected ? '#4ADE80' : '#FF4D6D';
      ctx.beginPath();
      ctx.arc(rx + 10, sc.y, 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F1F5F9';
      ctx.textAlign = 'left';
      ctx.fillText(label, rx + 17, sc.y + 0.5);

      // Explicit isolated warning tag if disconnected (0 OS emojis — pure vector triangle!)
      if (!room.connected) {
        const warnText = '복도·문 미연결 — 대기';
        const warnW = ctx.measureText(warnText).width + 26;
        const warnH = 21;
        const wx = sc.x - warnW * 0.5;
        const wy = ry + pillH + 4;

        ctx.fillStyle = 'rgba(38, 12, 18, 0.92)';
        ctx.strokeStyle = 'rgba(255, 77, 109, 0.85)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.roundRect(wx, wy, warnW, warnH, 5);
        ctx.fill();
        ctx.stroke();

        // Vector warning triangle
        const tx0 = wx + 11;
        const ty0 = wy + warnH * 0.5;
        ctx.fillStyle = '#FF4D6D';
        ctx.beginPath();
        ctx.moveTo(tx0, ty0 - 5.5);
        ctx.lineTo(tx0 + 5.5, ty0 + 4.5);
        ctx.lineTo(tx0 - 5.5, ty0 + 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1B0B10';
        ctx.fillRect(tx0 - 0.8, ty0 - 2.3, 1.6, 3.8);
        ctx.fillRect(tx0 - 0.8, ty0 + 2.2, 1.6, 1.4);

        ctx.fillStyle = '#FECDD3';
        ctx.textAlign = 'left';
        ctx.fillText(warnText, wx + 20, wy + warnH * 0.5 + 0.5);
      }
    }
    ctx.restore();
  }

  function drawB1Overlays(ctx, state, uiState, ug, B1_SIZE, timeSec, zScale) {
    const Iso = ZS.Iso;
    const mode = uiState.mode;

    // 1. Subtle dig frontier outline when in b1_dig mode
    if (mode === 'b1_dig') {
      ctx.save();
      for (let y = 1; y < B1_SIZE - 1; y++) {
        for (let x = 1; x < B1_SIZE - 1; x++) {
          const check = ZS.Game && ZS.Game.canDigTile ? ZS.Game.canDigTile(x, y) : null;
          if (!check || !check.ok) continue;
          const rockZ = (ZS.DATA && ZS.DATA.B1_ROCK_Z) || 11;
          Iso.drawTilePoly(ctx, x, y, rockZ + 1.5, 'rgba(245, 158, 11, 0.08)', 'rgba(245, 158, 11, 0.35)', 1.0);
        }
      }
      ctx.restore();
    }

    // 2. Gadget Edit Lock 2.0s pulsing highlight
    if (ug.lockedHighlightTimer > 0 && ug.lockedHighlightRoomId != null) {
      const pulse = 0.45 + 0.45 * Math.abs(Math.sin((timeSec || 0) * 8));
      const room = ug.rooms[ug.lockedHighlightRoomId];
      if (room && Array.isArray(room.tiles)) {
        for (let i = 0; i < room.tiles.length; i++) {
          const [rx, ry] = room.tiles[i];
          const hasGadget = !!(ug.b1StructGrid[ry] && ug.b1StructGrid[ry][rx]);
          if (hasGadget) {
            Iso.drawTilePoly(
              ctx,
              rx,
              ry,
              2.5,
              `rgba(255, 77, 109, ${(0.36 * pulse).toFixed(3)})`,
              `rgba(245, 158, 11, ${(0.95 * pulse).toFixed(3)})`,
              2.6
            );
            // Vector lock badge above gadget tile
            const gp = Iso.gridToScreen(rx + 0.5, ry + 0.5, 13);
            ctx.save();
            ctx.fillStyle = `rgba(255, 77, 109, ${pulse.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, 7 * zScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(gp.x - 3 * zScale, gp.y - 1 * zScale, 6 * zScale, 5 * zScale);
            ctx.restore();
          } else {
            Iso.drawTilePoly(
              ctx,
              rx,
              ry,
              1.6,
              `rgba(255, 77, 109, ${(0.14 * pulse).toFixed(3)})`,
              `rgba(255, 77, 109, ${(0.65 * pulse).toFixed(3)})`,
              1.4
            );
          }
        }
      }
    }

    // 3. Drag rectangle preview for b1_zone & b1_unzone
    if ((mode === 'b1_zone' || mode === 'b1_unzone') && uiState.b1DragStart && uiState.b1DragCurrent) {
      const x0 = Math.max(1, Math.min(B1_SIZE - 2, Math.min(uiState.b1DragStart.tx, uiState.b1DragCurrent.tx)));
      const x1 = Math.max(1, Math.min(B1_SIZE - 2, Math.max(uiState.b1DragStart.tx, uiState.b1DragCurrent.tx)));
      const y0 = Math.max(1, Math.min(B1_SIZE - 2, Math.min(uiState.b1DragStart.ty, uiState.b1DragCurrent.ty)));
      const y1 = Math.max(1, Math.min(B1_SIZE - 2, Math.max(uiState.b1DragStart.ty, uiState.b1DragCurrent.ty)));
      const lockCheck = mode === 'b1_zone' && ZS.Game.canZoneB1Rect
        ? ZS.Game.canZoneB1Rect(x0, y0, x1, y1, uiState.selectedB1Role)
        : mode === 'b1_unzone' && ZS.Game.canUnzoneB1Rect
        ? ZS.Game.canUnzoneB1Rect(x0, y0, x1, y1)
        : null;
      const roomLocked = !!(lockCheck && lockCheck.lockedRoomId != null);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const c = ug.grid[y][x];
          const hasG = !!(ug.b1StructGrid && ug.b1StructGrid[y] && ug.b1StructGrid[y][x]);
          const isCorrRole = uiState.selectedB1Role === 'corridor';
          const cRoom = c && c.roomId != null && ug.rooms ? ug.rooms[c.roomId] : null;
          const sameRoleGadgetAllowed =
            hasG &&
            ((!isCorrRole && cRoom && cRoom.role === uiState.selectedB1Role) ||
              (isCorrRole && c && c.corridor && !c.permanentCorridor));
          const ok = mode === 'b1_zone'
            ? !!(c && c.excavated && !c.permanentCorridor && !c.elevator && !c.bedrock && (!hasG || sameRoleGadgetAllowed) && !roomLocked)
            : !!(c && c.excavated && (c.roomId != null || (c.corridor && !c.permanentCorridor)) && !hasG && !roomLocked);
          const zOff = c && !c.excavated ? ((ZS.DATA.B1_ROCK_Z || 11) + 1.6) : 1.5;
          Iso.drawTilePoly(
            ctx,
            x,
            y,
            zOff,
            ok ? 'rgba(74, 222, 128, 0.24)' : 'rgba(255, 77, 109, 0.24)',
            ok ? '#4ADE80' : '#FF4D6D',
            1.6
          );
        }
      }
      return;
    }

    // 4. Door edge hover preview in b1_door mode
    if (mode === 'b1_door' && uiState.hoverB1DoorEdge) {
      const e = uiState.hoverB1DoorEdge;
      const isX = e.a[1] === e.b[1];
      const gx = isX ? Math.max(e.a[0], e.b[0]) : e.a[0];
      const gy = isX ? e.a[1] : Math.max(e.a[1], e.b[1]);
      const hWall = (ZS.DATA && ZS.DATA.B1_WALL_Z) || 10;
      const col = e.hasDoor ? '#FF4D6D' : '#F59E0B';
      const pA = isX
        ? Iso.gridToScreen(gx, gy + 0.16, hWall + 1.5)
        : Iso.gridToScreen(gx + 0.16, gy, hWall + 1.5);
      const pB = isX
        ? Iso.gridToScreen(gx, gy + 0.84, hWall + 1.5)
        : Iso.gridToScreen(gx + 0.84, gy, hWall + 1.5);
      const pB0 = isX
        ? Iso.gridToScreen(gx, gy + 0.84, 0.5)
        : Iso.gridToScreen(gx + 0.84, gy, 0.5);
      const pA0 = isX
        ? Iso.gridToScreen(gx, gy + 0.16, 0.5)
        : Iso.gridToScreen(gx + 0.16, gy, 0.5);
      ctx.save();
      ctx.fillStyle = e.hasDoor ? 'rgba(255, 77, 109, 0.28)' : 'rgba(245, 158, 11, 0.28)';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2.0, 2.5 * zScale);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.lineTo(pB0.x, pB0.y);
      ctx.lineTo(pA0.x, pA0.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Single tile hover highlight & Dig AP badge
    if (uiState.hoverTile) {
      const { tx, ty } = uiState.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < B1_SIZE && ty < B1_SIZE) {
        const cell = ug.grid[ty][tx];
        const zOff = cell && !cell.excavated ? (cell.bedrock ? 13.5 : (ZS.DATA.B1_ROCK_Z || 11) + 1.6) : 1.5;
        if (mode === 'b1_dig') {
          const check = ZS.Game && ZS.Game.canDigTile ? ZS.Game.canDigTile(tx, ty) : null;
          const ok = !!(check && check.ok);
          Iso.drawTilePoly(
            ctx,
            tx,
            ty,
            zOff,
            ok ? 'rgba(245, 158, 11, 0.26)' : 'rgba(255, 77, 109, 0.22)',
            ok ? '#F59E0B' : '#FF4D6D',
            1.9
          );
          if (cell && !cell.excavated && !cell.bedrock) {
            const cost = ZS.Game && ZS.Game.getB1DigCost ? ZS.Game.getB1DigCost(tx, ty) : 1;
            const badgePt = Iso.gridToScreen(tx + 0.5, ty + 0.5, zOff + 6);
            const label = `${cost} AP`;
            ctx.save();
            ctx.font = `800 12px 'Chakra Petch', 'Pretendard', sans-serif`;
            const bw = ctx.measureText(label).width + 14;
            ctx.fillStyle = ok ? 'rgba(24, 17, 7, 0.92)' : 'rgba(34, 12, 18, 0.92)';
            ctx.strokeStyle = ok ? '#F59E0B' : '#FF4D6D';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(badgePt.x - bw * 0.5, badgePt.y - 11, bw, 22, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = ok ? '#FDE68A' : '#FECDD3';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, badgePt.x, badgePt.y + 0.5);
            ctx.restore();
          }
        } else if (mode === 'b1_zone' || mode === 'b1_unzone') {
          const hasG = !!(ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx]);
          const ok = mode === 'b1_zone'
            ? !!(cell && cell.excavated && !cell.permanentCorridor && !cell.elevator && !cell.bedrock && !hasG)
            : !!(cell && cell.excavated && (cell.roomId != null || (cell.corridor && !cell.permanentCorridor)) && !hasG);
          Iso.drawTilePoly(
            ctx,
            tx,
            ty,
            zOff,
            ok ? 'rgba(74, 222, 128, 0.22)' : 'rgba(255, 77, 109, 0.20)',
            ok ? '#4ADE80' : '#FF4D6D',
            1.7
          );
        } else {
          Iso.drawTilePoly(ctx, tx, ty, zOff, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.55)', 1.3);
        }
      }
    }

    // 5b. B1 Gadget build / move / remove overlays
    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (def && def.domain === 'underground') {
        if (def.requiredRole && ug.rooms) {
          for (let ry = 1; ry < B1_SIZE - 1; ry++) {
            for (let rx = 1; rx < B1_SIZE - 1; rx++) {
              const c = ug.grid[ry][rx];
              if (!c || !c.excavated || c.elevator || c.permanentCorridor || c.roomId == null) continue;
              const r = ug.rooms[c.roomId];
              if (r && r.role === def.requiredRole) {
                Iso.drawTilePoly(ctx, rx, ry, 2.05, 'rgba(114, 232, 138, 0.10)', 'rgba(114, 232, 138, 0.34)', 0.9);
              }
            }
          }
        }
        if (uiState.hoverTile) {
          const { tx, ty } = uiState.hoverTile;
          if (tx >= 1 && ty >= 1 && tx < B1_SIZE - 1 && ty < B1_SIZE - 1) {
            const check = ZS.Game && ZS.Game.canPlaceB1Item
              ? ZS.Game.canPlaceB1Item(def.id, tx, ty)
              : { ok: false };
            const cell = ug.grid[ty][tx];
            const zOff = cell && !cell.excavated ? (cell.bedrock ? 13.5 : (ZS.DATA.B1_ROCK_Z || 11) + 1.6) : 2.1;
            Iso.drawTilePoly(
              ctx, tx, ty, zOff,
              check.ok ? 'rgba(114, 232, 138, 0.28)' : 'rgba(255, 107, 107, 0.28)',
              check.ok ? '#72E88A' : '#FF6B6B',
              2.0
            );
            if (check.ok) {
              const ghostRot = uiState.b1BuildRot || 0;
              ctx.save();
              ctx.globalAlpha = 0.68;
              paintB1Gadget(
                makeB1WorldPainter(ctx, tx, ty, 2.0, false, timeSec, { connected: true, powered: true, active: true, rot: ghostRot }),
                def.id
              );
              ctx.restore();
              drawB1DirectionCue(ctx, tx, ty, zOff + 0.15, ghostRot);
            } else if (cell && cell.excavated) {
              drawB1DirectionCue(ctx, tx, ty, zOff + 0.15, uiState.b1BuildRot || 0);
            }
          }
        }
      }
    } else if (uiState.mode === 'move') {
      const src = uiState.movingSource;
      if (src) {
        Iso.drawTilePoly(ctx, src.tx, src.ty, 2.15, 'rgba(255, 179, 71, 0.28)', '#FFB347', 2.2);
        const srcGadget = ug.b1StructGrid && ug.b1StructGrid[src.ty] && ug.b1StructGrid[src.ty][src.tx];
        const srcDef = srcGadget && ZS.DATA.ITEMS[srcGadget.id];
        if (srcDef && srcDef.requiredRole && ug.rooms) {
          for (let ry = 1; ry < B1_SIZE - 1; ry++) {
            for (let rx = 1; rx < B1_SIZE - 1; rx++) {
              const c = ug.grid[ry][rx];
              if (!c || !c.excavated || c.elevator || c.permanentCorridor || c.roomId == null) continue;
              const r = ug.rooms[c.roomId];
              if (r && r.role === srcDef.requiredRole) {
                Iso.drawTilePoly(ctx, rx, ry, 2.05, 'rgba(114, 232, 138, 0.10)', 'rgba(114, 232, 138, 0.34)', 0.9);
              }
            }
          }
        }
        if (uiState.hoverTile && srcGadget) {
          const { tx, ty } = uiState.hoverTile;
          const moveRot = uiState.b1BuildRot || 0;
          const check = ZS.Game && ZS.Game.canMoveB1Item
            ? ZS.Game.canMoveB1Item(src.tx, src.ty, tx, ty, moveRot)
            : { ok: false };
          Iso.drawTilePoly(
            ctx, tx, ty, 2.1,
            check.ok ? 'rgba(114, 232, 138, 0.28)' : 'rgba(255, 107, 107, 0.28)',
            check.ok ? '#72E88A' : '#FF6B6B',
            2.0
          );
          if (check.ok) {
            ctx.save();
            ctx.globalAlpha = 0.68;
            paintB1Gadget(
              makeB1WorldPainter(ctx, tx, ty, 2.0, false, timeSec, { connected: true, powered: true, active: true, rot: moveRot }),
              srcGadget.id
            );
            ctx.restore();
            drawB1DirectionCue(ctx, tx, ty, 2.25, moveRot);
          }
        }
      } else if (uiState.hoverTile) {
        const { tx, ty } = uiState.hoverTile;
        const g = ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
        if (g) {
          Iso.drawTilePoly(ctx, tx, ty, 2.1, 'rgba(255, 179, 71, 0.28)', '#FFB347', 2.0);
        }
      }
    } else if (uiState.mode === 'remove' && uiState.hoverTile) {
      const { tx, ty } = uiState.hoverTile;
      const g = ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
      if (g) {
        Iso.drawTilePoly(ctx, tx, ty, 2.1, 'rgba(255, 92, 92, 0.32)', '#FF5C5C', 2.0);
      }
    }

    // 6. Inspected tile outline
    if (uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      if (tx >= 0 && ty >= 0 && tx < B1_SIZE && ty < B1_SIZE) {
        const cell = ug.grid[ty][tx];
        const zOff = cell && !cell.excavated ? (cell.bedrock ? 13.5 : (ZS.DATA.B1_ROCK_Z || 11) + 1.6) : 2.0;
        Iso.drawTilePoly(ctx, tx, ty, zOff, 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.88)', 2.0);
      }
    }
  }

  function renderUnderground(ctx, w, h, state, uiState, timeSec, zScale, isSil) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const B1_SIZE = DATA.B1_SIZE || 23;
    const ug = ZS.Game && ZS.Game.ensureUndergroundState ? ZS.Game.ensureUndergroundState() : state.underground;
    if (!ug) return;

    R.emissiveList = null;
    drawB1SubterraneanBackdrop(ctx, w, h, isSil);
    Iso.resetRenderModifiers();

    const tc = ensureB1TerrainCache(ug, P, isSil);
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

    const cullPadX = 64 * zScale;
    const cullPadTop = 64 * zScale;
    const cullPadBot = 48 * zScale;

    // Painter's depth sweep along isometric diagonals dSum = tx + ty
    for (let dSum = 0; dSum <= (B1_SIZE - 1) * 2; dSum++) {
      const minX = Math.max(0, dSum - (B1_SIZE - 1));
      const maxX = Math.min(B1_SIZE - 1, dSum);
      for (let tx = minX; tx <= maxX; tx++) {
        const ty = dSum - tx;
        const cell = ug.grid[ty][tx];
        if (!cell) continue;
        if (R.isGridVisible && !R.isGridVisible(tx + 0.5, ty + 0.5, cullPadX, cullPadTop, cullPadBot, w, h)) {
          continue;
        }

        if (!cell.excavated) {
          drawB1RockBlock(ctx, ug, tx, ty, cell, B1_SIZE, isSil, zScale);
          continue;
        }

        // Draw North & West Concrete Partition Walls (or Blast Doors) before tile interior
        const cellSpace = getB1SpaceKey(cell);
        if (!cell.elevator && ty > 1) {
          const north = ug.grid[ty - 1][tx];
          if (north && north.excavated && !north.elevator && getB1SpaceKey(north) !== cellSpace) {
            const key = `${tx},${ty - 1}|${tx},${ty}`;
            drawB1PartitionWallOrDoor(ctx, 'x', tx, ty, !!ug.doors[key], isSil, zScale);
          }
        }
        if (!cell.elevator && tx > 1) {
          const west = ug.grid[ty][tx - 1];
          if (west && west.excavated && !west.elevator && getB1SpaceKey(west) !== cellSpace) {
            const key = `${tx - 1},${ty}|${tx},${ty}`;
            drawB1PartitionWallOrDoor(ctx, 'y', tx, ty, !!ug.doors[key], isSil, zScale);
          }
        }

        if (cell.elevator) {
          drawB1ElevatorCore(ctx, tx, ty, timeSec, isSil, zScale);
        }

        const gadget = ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
        if (gadget) {
          drawB1Gadget(ctx, gadget, tx, ty, ug, state, timeSec, isSil, zScale);
        }
      }
    }

    if (!isSil) {
      drawB1Overlays(ctx, state, uiState, ug, B1_SIZE, timeSec, zScale);
      drawB1RoomLabelsAndWarnings(ctx, ug, B1_SIZE, zScale);
    }

    R.emissiveList = null;
    Iso.resetRenderModifiers();
  }

  function renderB1ToolThumbnail(toolId, sizePx) {
    const sz = Math.max(24, Math.round(sizePx || 88));
    const key = `${toolId}@${sz}`;
    const cached = _thumbCacheB1.get(key);
    if (cached) return cached;

    const Iso = ZS.Iso;
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

    try {
      if (Iso.setElevationOffset) Iso.setElevationOffset(0);
      Iso.setViewport(sz, sz);
      Iso.resetRenderModifiers();
      const zoom = (sz * 0.84) / 68;
      Iso.cam.zoom = zoom;
      Iso.cam.x = 0;
      Iso.cam.y = 14.5;

      // Miniature subterranean plinth
      Iso.drawVoxelBox(tctx, 0, 0, -4.5, 1, 1, 4.5, { base: '#3B424E', noTop: true });

      if (toolId === 'b1_dig') {
        Iso.drawVoxelBox(tctx, 0.05, 0.05, 0, 0.90, 0.90, 12, { base: '#58626E' });
        Iso.drawVoxelBox(tctx, 0.16, 0.16, 12, 0.68, 0.68, 2.2, { base: '#6D7886' });
        // Amber pickaxe head glyph on top
        Iso.drawVoxelBox(tctx, 0.34, 0.34, 14.2, 0.32, 0.32, 1.5, { base: '#F59E0B' });
      } else if (toolId === 'b1_door') {
        Iso.drawTilePoly(tctx, 0, 0, 0, '#6A737D', '#4B535D', 0.8);
        drawB1PartitionWallOrDoor(tctx, 'x', 0, 0.5, true, false, zoom);
      } else if (toolId === 'b1_unzone') {
        Iso.drawTilePoly(tctx, 0, 0, 0, '#5D4B3B', '#433529', 0.8);
        Iso.drawVoxelBox(tctx, 0.18, 0.18, 0.2, 0.64, 0.64, 1.2, { base: '#7A6857' });
      } else if (toolId === 'b1_zone_corridor') {
        Iso.drawTilePoly(tctx, 0, 0, 0, '#3C4654', '#1D242E', 0.8);
        Iso.drawVoxelBox(tctx, 0.12, 0.12, 0.1, 0.76, 0.76, 0.35, { base: '#2A323D', stroke: '#3E4752' });
        Iso.drawVoxelBox(tctx, 0.04, 0.04, 0.2, 0.92, 0.12, 8.2, { base: '#667382' });
        Iso.drawVoxelBox(tctx, 0.04, 0.84, 0.2, 0.92, 0.12, 8.2, { base: '#667382' });
        Iso.drawVoxelBox(tctx, 0.22, 0.44, 0.45, 0.56, 0.12, 0.5, { base: '#E59838' });
      } else {
        const role = toolId.replace(/^b1_zone_/, '');
        const rDef = getRoomDef(role);
        const accent = (rDef && rDef.accent) || '#E8A848';
        Iso.drawTilePoly(tctx, 0, 0, 0, '#6D7680', '#4C545E', 0.8);
        Iso.drawVoxelBox(tctx, 0.04, 0.04, 0.2, 0.92, 0.14, 9.5, { base: '#8A96A4' });
        Iso.drawVoxelBox(tctx, 0.04, 0.04, 0.2, 0.14, 0.92, 9.5, { base: '#8A96A4' });
        Iso.drawVoxelBox(tctx, 0.20, 0.20, 0.2, 0.68, 0.68, 1.0, { base: accent });
      }
    } finally {
      if (Iso.setElevationOffset) Iso.setElevationOffset(prevElev);
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
      Iso.resetRenderModifiers();
    }

    const url = cv.toDataURL ? cv.toDataURL('image/png') : '';
    if (url) _thumbCacheB1.set(key, url);
    return url;
  }

  Object.assign(R, {
    b1TerrainCache,
    ensureB1TerrainCache,
    renderUnderground,
    renderB1ToolThumbnail,
    renderB1GadgetThumbnail
  });

  if (ZS.Renderer) {
    ZS.Renderer.renderB1ToolThumbnail = renderB1ToolThumbnail;
    ZS.Renderer.renderB1GadgetThumbnail = renderB1GadgetThumbnail;
  }
})();
