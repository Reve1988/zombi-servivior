window.ZS = window.ZS || {};

ZS.Renderer = (function () {
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');
  const eyeHaloCache = new Map();
  let cachedTerrainN = 0;
  let terrainMeta = null;

  function tileHash01(x, y, salt) {
    let h = ((x * 374761393) ^ (y * 668265263) ^ ((salt || 0) * 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function ensureTerrainMeta(N) {
    if (terrainMeta && cachedTerrainN === N) return terrainMeta;
    cachedTerrainN = N;
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

    terrainMeta = { grid, edgeProps };
    return terrainMeta;
  }

  function ensureLightCanvas(w, h) {
    if (lightCanvas.width !== w || lightCanvas.height !== h) {
      lightCanvas.width = w;
      lightCanvas.height = h;
    }
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
    if (state.power > 0.01) return true;
    const flk = state.blackoutFlickerTimer || 0;
    if (flk > 0) {
      // Rapid fluorescent stutter over 0.5s before plunging into full blackout (#8)
      const wave = Math.sin(timeSec * 62) + 0.55 * Math.cos(timeSec * 97);
      return wave > -0.15 + (0.5 - flk) * 0.9;
    }
    return false;
  }

  function render(ctx, w, h, state, uiState, timeSec) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;
    const zScale = Iso.cam.zoom;

    // 1. Background Sky / Tactical Tabletop Backdrop
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 60, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    if (state.nightAlpha > 0.4) {
      bgGrad.addColorStop(0, '#101B2D');
      bgGrad.addColorStop(1, '#060A13');
    } else {
      bgGrad.addColorStop(0, '#2C3B49');
      bgGrad.addColorStop(1, '#151E27');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

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

    // Apply day warm-afternoon vs night cool-moonlight ambient tint to matte voxel surfaces
    if (state.nightAlpha > 0.02) {
      Iso.setSceneTint('#6F9CE8', 0.085 * state.nightAlpha);
    } else {
      Iso.setSceneTint('#FFE8BA', 0.055);
    }

    const meta = ensureTerrainMeta(N);
    const showEditGrid =
      (state.phase === 'day' &&
        (uiState.mode === 'build' || uiState.mode === 'move' || uiState.mode === 'remove')) ||
      uiState.activeSkill === 'airstrike';

    // 2. 3D Miniature Diorama Island Base Slab (3-layer turf / soil / bedrock geological strata)
    drawIslandSlab(ctx, N, P, zScale);

    // 3. Terrain, Natural Decals, Quarantine Border & Floor Tiles
    for (let y = 0; y < N; y++) {
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
        const tileFill = Iso.shadeHex(rawBase, cell.shadeFactor);

        if (showEditGrid) {
          const gridStroke = isEdge ? 'rgba(255, 77, 109, 0.28)' : 'rgba(255, 255, 255, 0.14)';
          Iso.drawTilePoly(ctx, x, y, 0, tileFill, gridStroke, 1);
          if (isEdge && uiState.mode === 'build') {
            const c = Iso.gridToScreen(x + 0.5, y + 0.5, 0.4);
            ctx.strokeStyle = 'rgba(255, 77, 109, 0.22)';
            ctx.lineWidth = Math.max(1, 1.1 * zScale);
            ctx.beginPath();
            ctx.moveTo(c.x - 4 * zScale, c.y - 2 * zScale);
            ctx.lineTo(c.x + 4 * zScale, c.y + 2 * zScale);
            ctx.moveTo(c.x + 4 * zScale, c.y - 2 * zScale);
            ctx.lineTo(c.x - 4 * zScale, c.y + 2 * zScale);
            ctx.stroke();
          }
        } else {
          // Seam-guard stroke in matching tile color eliminates graph-paper grid lines & Canvas AA seams
          Iso.drawTilePoly(ctx, x, y, 0, tileFill, tileFill, 0.65);
        }

        const floorId = state.floorGrid[y][x];
        if (floorId) {
          drawFloorTile(ctx, x, y, floorId, zScale);
        } else if (cell.decal && !(state.structGrid[y] && state.structGrid[y][x])) {
          drawTerrainDecal(ctx, x, y, cell.decal, zScale);
        }
      }
    }

    // Crisp inner quarantine boundary & directional danger chevrons separating 1-tile outer spawn zone
    drawQuarantineBorder(ctx, N, P, showEditGrid, zScale);

    // Fading zombie death ground stains (#8: drawn flat on ground above tiles/floors, below structures)
    if (state.groundDecals && state.groundDecals.length > 0) {
      drawGroundStains(ctx, state.groundDecals, zScale);
    }

    // Subtle warm afternoon sunlight wash over the inner base during daytime
    if (state.nightAlpha < 0.95) {
      const sunCenter = Iso.gridToScreen(DATA.HQ_POS.x + 0.2, DATA.HQ_POS.y + 0.2, 4);
      const sunRad = N * 22 * zScale;
      const dayFactor = Math.max(0, 1 - state.nightAlpha * 1.15);
      ctx.save();
      const sunGrad = ctx.createRadialGradient(sunCenter.x, sunCenter.y, sunRad * 0.08, sunCenter.x, sunCenter.y, sunRad);
      sunGrad.addColorStop(0, `rgba(255, 224, 166, ${(0.085 * dayFactor).toFixed(3)})`);
      sunGrad.addColorStop(0.65, `rgba(255, 214, 150, ${(0.035 * dayFactor).toFixed(3)})`);
      sunGrad.addColorStop(1, 'rgba(255, 214, 150, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunCenter.x, sunCenter.y, sunRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
          if (def) {
            const eff = ZS.Game.getStructureEffectiveStats(st, tx, ty);
            if (eff.range > 0) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, eff.range, P.rangeStroke, P.rangeFill);
            }
            if (def.aura && def.aura.radius) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.aura.radius, P.goldStroke, P.goldFill);
            }
          }
        }
      }
    }

    // 5. Collect & Depth-Sort All Structures + Perimeter Props + Zombies
    const renderList = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st) continue;
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
      renderList.push({
        kind: 'edge_prop',
        depth: ep.gx + ep.gy + 0.08,
        ep
      });
    }

    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      renderList.push({
        kind: 'zombie',
        depth: z.x + z.y + 0.05,
        z
      });
    }

    if (state.dyingZombies) {
      for (let i = 0; i < state.dyingZombies.length; i++) {
        const dz = state.dyingZombies[i];
        renderList.push({
          kind: 'dying_zombie',
          depth: dz.x + dz.y + 0.04,
          dz
        });
      }
    }

    renderList.sort((a, b) => a.depth - b.depth);

    const powered = computeBlackoutElectricPowered(state, timeSec);
    const statusPowered = !state.isNight || state.power > 0.01;

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
      } else if (item.kind === 'edge_prop') {
        drawPerimeterProp(ctx, item.ep, zScale);
      } else if (item.kind === 'zombie') {
        drawZombie(ctx, item.z, timeSec, zScale);
      } else if (item.kind === 'dying_zombie') {
        drawDyingZombie(ctx, item.dz, zScale);
      }
    }

    // Creeping perimeter mist / fog band along the 4 outer edges ("outside = danger")
    drawPerimeterFog(ctx, N, state.nightAlpha, timeSec, zScale);

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
      drawMuzzleFlashes(ctx, state.muzzleFlashes, zScale);
    }
    drawProjectiles(ctx, state.projectiles, zScale);
    drawParticles(ctx, state.particles, zScale);

    // Warm central base glow on Cozy Tier-Up (radius 3 tiles, 0.8s)
    if (state.cozyTierUpTimer && state.cozyTierUpTimer > 0) {
      const progress = 1 - Math.max(0, Math.min(1, state.cozyTierUpTimer / 0.8));
      const alpha = Math.sin(progress * Math.PI) * 0.55;
      const center = Iso.gridToScreen(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 10);
      const rPx = (1.6 + progress * 1.4) * 38 * zScale;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(center.x, center.y, 4, center.x, center.y, rPx);
      grad.addColorStop(0, `rgba(255, 201, 74, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(255, 210, 122, ${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 201, 74, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center.x, center.y, rPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Nighttime Tactical Darkness & Dynamic Glow Layer
    if (state.nightAlpha > 0.02) {
      drawNightLighting(ctx, w, h, state, powered, timeSec, zScale);
    }

    // ── Info Layer (Drawn above darkness: identical daytime brightness & contrast) ──
    // 9. Selection Outline, Structure/Zombie HP Bars, and Blackout ⚡OFF Warnings
    drawInfoLayer(ctx, state, uiState, renderList, statusPowered, timeSec, zScale);

    // 10. Floating Texts (Damage, Loot, Buff Callouts)
    drawFloatingTexts(ctx, state.floatingTexts, zScale);

    if (shakeActive) {
      ctx.restore();
    }
  }

  function drawIslandSlab(ctx, N, P, zScale) {
    const Iso = ZS.Iso;
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
    const rockOffsets = [2.2, 6.4, 11.1, 14.8];
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
    const stoneOffsets = [1.4, 4.7, 8.3, 12.6, 15.9];
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

  function drawPerimeterFog(ctx, N, nightAlpha, timeSec, zScale) {
    const Iso = ZS.Iso;
    // Subtle drifting mist wisps along the 4 outer island edges to reinforce "outside = danger"
    ctx.save();
    const mistColor =
      nightAlpha > 0.35
        ? `rgba(26, 44, 78, ${(0.20 + nightAlpha * 0.14).toFixed(3)})`
        : 'rgba(176, 192, 204, 0.13)';
    const dangerMist =
      nightAlpha > 0.35
        ? `rgba(255, 77, 109, ${(0.045 * nightAlpha).toFixed(3)})`
        : 'rgba(120, 96, 104, 0.05)';

    for (let i = 0; i < 16; i++) {
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
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, rx);
      grad.addColorStop(0, i % 3 === 0 ? dangerMist : mistColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
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

  function drawIsoCircle(ctx, cx, cy, radiusTiles, strokeColor, fillColor) {
    const Iso = ZS.Iso;
    const steps = 40;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const gx = cx + Math.cos(ang) * radiusTiles;
      const gy = cy + Math.sin(ang) * radiusTiles;
      const p = Iso.gridToScreen(gx, gy, 2);
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
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
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
        const canDrop = !state.structGrid[ty][tx];
        Iso.drawTilePoly(
          ctx,
          tx,
          ty,
          2,
          canDrop ? P.healthFill : P.dangerFill,
          canDrop ? P.health : P.danger,
          2
        );
      } else {
        Iso.drawTilePoly(ctx, tx, ty, 2, P.selectFill, P.selectStroke, 2);
      }
      return;
    }

    if (uiState.selectedItemId) {
      const def = DATA.ITEMS[uiState.selectedItemId];
      if (!def) return;
      const check = ZS.Game.canPlaceItem(uiState.selectedItemId, tx, ty);
      Iso.drawTilePoly(
        ctx,
        tx,
        ty,
        2,
        check.ok ? P.healthFill : P.dangerFill,
        check.ok ? P.health : P.danger,
        2 * Math.min(1.2, zScale)
      );
      if (def.range) {
        drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.range, P.rangeStroke, P.rangeFill);
      }
      if (def.aura && def.aura.radius) {
        drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.aura.radius, P.goldStroke, P.goldFill);
      }
    } else {
      Iso.drawTilePoly(ctx, tx, ty, 2, P.hoverFill, P.hoverStroke, 1.2);
    }
  }

  function drawBuildGhost(ctx, state, uiState, tx, ty, timeSec, zScale) {
    let previewObj = null;
    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (def && def.layer === 'struct' && !state.structGrid[ty][tx]) {
        previewObj = { id: def.id, level: 1, hp: 100, maxHp: 100, aimAngle: 0 };
      }
    } else if (uiState.mode === 'move' && uiState.movingSource && !state.structGrid[ty][tx]) {
      const src = state.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
      if (src) {
        previewObj = { id: src.id, level: src.level || 1, rank: src.rank || 0, hp: 100, maxHp: 100, aimAngle: src.aimAngle || 0 };
      }
    }

    if (previewObj) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      drawStructure(ctx, previewObj, tx, ty, state, true, timeSec, zScale);
      ctx.restore();
    }
  }

  function getStructVisualTopZ(id, level) {
    switch (id) {
      case 'hesco_wall': return level >= 3 ? 21 : 17;
      case 'blast_wall': return level >= 3 ? 25 : 21;
      case 'razor_pad': return 6;
      case 'rifle_bunker': return level >= 3 ? 35 : 33;
      case 'shotgun_post': return 34;
      case 'sniper_tower': return 47;
      case 'vulcan_turret': return level >= 2 ? 26 : 23;
      case 'missile_pod': return 23;
      case 'emp_coil': return 32;
      case 'solar_array': return 15;
      case 'wind_turbine': return 40;
      case 'battery_bank': return 21;
      case 'field_tent': return 17;
      case 'shelter_pod': return 21;
      default: return 22;
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
    const isUnpowered = state.isNight && def && def.requiresPower && !powered;

    // Soft ground shadow
    if (!(def && def.passable)) {
      const sc = Iso.gridToScreen(tx + 0.52, ty + 0.55, 1);
      ctx.fillStyle = 'rgba(10, 16, 22, 0.28)';
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y, 20 * zScale, 10 * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Build placement drop + elastic squash-and-stretch rebound (#8)
    let hasBuildTransform = false;
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
    }

    Iso.setEntityFlash(st.hitFlash || 0);

    switch (id) {
      case 'command_hq': {
        drawHqByLevel(ctx, st, tx, ty, state, timeSec, zScale);
        break;
      }

      case 'hesco_wall': {
        // Modern HESCO military gabion bastion + Lv.2 steel band + Lv.3 orange-rimmed top armor plate
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 1, 0.84, 0.84, 16, {
          base: '#d6c49e',
          stroke: '#635947'
        });
        Iso.drawVoxelBox(ctx, tx + 0.07, ty + 0.07, 8, 0.86, 0.86, 2, {
          base: '#6c7680'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.065, ty + 0.065, 3.5, 0.87, 0.87, 2.4, {
            base: steelCol
          });
        }
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.055, ty + 0.055, 17, 0.89, 0.89, 1.3, {
            base: maxAccent
          });
          Iso.drawVoxelBox(ctx, tx + 0.065, ty + 0.065, 18.3, 0.87, 0.87, 2.5, {
            base: steelCol,
            stroke: maxAccent
          });
        }
        break;
      }

      case 'blast_wall': {
        // Heavy Armored Alloy Blast Barrier + Lv.2 steel band + Lv.3 shock-reflect armor crown
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.06, 1, 0.88, 0.88, 20, {
          base: '#5f6f82',
          stroke: '#8396ad'
        });
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.05, 5, 0.90, 0.90, 3, {
          base: '#c4834b'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.045, ty + 0.045, 12, 0.91, 0.91, 2.4, {
            base: steelCol
          });
        }
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.04, ty + 0.04, 21, 0.92, 0.92, 1.4, {
            base: maxAccent
          });
          Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.05, 22.4, 0.90, 0.90, 2.6, {
            base: steelCol,
            stroke: maxAccent
          });
        }
        break;
      }

      case 'razor_pad': {
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 2, {
          base: lv >= 2 ? '#596574' : '#454e59',
          stroke: lv >= 2 ? steelCol : null
        });
        const c = Iso.gridToScreen(tx + 0.5, ty + 0.5, 4);
        ctx.strokeStyle = lv >= 3 ? maxAccent : '#bcc8d6';
        ctx.lineWidth = (lv >= 3 ? 1.8 : 1.4) * zScale;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.ellipse(c.x + k * 7 * zScale, c.y, 6 * zScale, 4 * zScale, 0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'rifle_bunker': {
        // Sandbag/Composite Bunker (Lv.3 raises parapet 10->12.5 + orange muzzle dot; Lv.2 steel rim)
        const wallH = lv >= 3 ? 12.5 : 10;
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, wallH, {
          base: '#6e7d68',
          stroke: '#85967e'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.09, wallH - 1.4, 0.82, 0.82, 2.2, {
            base: steelCol
          });
        }
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, wallH + 1, '#4b5d46', '#38463a', st.aimAngle || 0, zScale, false, lv >= 3);
        break;
      }

      case 'shotgun_post': {
        // Ballistic Shield Breacher Post (Lv.2 steel band; Lv.3 double orange ballistic stripes)
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 11, {
          base: '#4d5968',
          stroke: '#8fa1b3'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.09, 4.5, 0.82, 0.82, 2.4, {
            base: steelCol
          });
        }
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.085, ty + 0.085, 7.8, 0.83, 0.83, 1.3, {
            base: maxAccent
          });
          Iso.drawVoxelBox(ctx, tx + 0.085, ty + 0.085, 10.2, 0.83, 0.83, 1.3, {
            base: maxAccent
          });
        }
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 12, '#3a4654', '#b87d4b', st.aimAngle || 0, zScale, false, false);
        break;
      }

      case 'sniper_tower': {
        // Steel Truss Overwatch Tower + Sniper (Lv.2 steel deck band; Lv.3 orange roof beacon)
        const legs = [
          [0.14, 0.14],
          [0.74, 0.14],
          [0.14, 0.74],
          [0.74, 0.74]
        ];
        legs.forEach(([lx, ly]) => {
          Iso.drawVoxelBox(ctx, tx + lx, ty + ly, 1, 0.12, 0.12, 20, {
            base: '#7c8b99'
          });
        });
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 21, 0.80, 0.80, 4, {
          base: lv >= 2 ? steelCol : '#637282',
          stroke: '#94a6b8'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 25, '#3d4d42', '#6f8072', st.aimAngle || 0, zScale, true, false);
        if (lv >= 3) {
          const bPos = Iso.gridToScreen(tx + 0.22, ty + 0.22, 27.5);
          ctx.fillStyle = maxAccent;
          ctx.beginPath();
          ctx.arc(bPos.x, bPos.y, 2.5 * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'vulcan_turret': {
        // CIWS Radar Dome Auto-Turret (Lv.2 steel collar; Lv.3 extended barrel + superconducting cyan feed core)
        Iso.drawVoxelBox(ctx, tx + 0.14, ty + 0.14, 1, 0.72, 0.72, 9, {
          base: '#525f6e'
        });
        let domeZ = 10;
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.18, ty + 0.18, 10, 0.64, 0.64, 2.5, {
            base: steelCol
          });
          domeZ = 12.5;
        }
        Iso.drawVoxelBox(ctx, tx + 0.25, ty + 0.25, domeZ, 0.50, 0.50, 13, {
          base: isUnpowered ? '#7a828a' : '#eef4fa'
        });
        const bLen = lv >= 3 ? 20 : 15;
        const aim = st.aimAngle || 0;
        drawTurretBarrel(ctx, tx + 0.5, ty + 0.5, domeZ + 6, aim, bLen, '#2b333d', zScale);
        if (lv >= 3) {
          // Superconducting feed core — power-saving perk, cyan explicitly approved in art spec §3
          const midGx = tx + 0.5 + Math.cos(aim) * 0.34;
          const midGy = ty + 0.5 + Math.sin(aim) * 0.34;
          const corePos = Iso.gridToScreen(midGx, midGy, domeZ + 6);
          ctx.fillStyle = isUnpowered ? P.powerDim : P.power;
          ctx.beginPath();
          ctx.arc(corePos.x, corePos.y, 2.6 * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'missile_pod': {
        // Multi-cell Tactical Grenade/SAM Pod (Lv.2 steel band; Lv.3 orange tube rim)
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 9, {
          base: '#4c574a'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.11, 6.5, 0.78, 0.78, 2.4, {
            base: steelCol
          });
        }
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 12, {
          base: isUnpowered ? '#596159' : '#6c7d65',
          stroke: lv >= 3 ? maxAccent : '#94a3b8'
        });
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.19, ty + 0.19, 20.5, 0.62, 0.62, 1.6, {
            base: maxAccent
          });
        }
        const podTop = Iso.gridToScreen(tx + 0.5, ty + 0.5, 22.5);
        ctx.fillStyle = isUnpowered ? '#444' : P.danger;
        ctx.beginPath();
        ctx.arc(podTop.x - 3 * zScale, podTop.y, 2 * zScale, 0, Math.PI * 2);
        ctx.arc(podTop.x + 3 * zScale, podTop.y, 2 * zScale, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'emp_coil': {
        // Futuristic Tesla EMP Pylon (Lv.2 steel base band; Lv.3 4 copper coil rings vs 3)
        Iso.drawVoxelBox(ctx, tx + 0.16, ty + 0.16, 1, 0.68, 0.68, 8, {
          base: '#3e4a59'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.15, ty + 0.15, 5.5, 0.70, 0.70, 2.4, {
            base: steelCol
          });
        }
        Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 9, 0.32, 0.32, 17, {
          base: '#60748a'
        });
        const ringZs = lv >= 3 ? [11, 15, 19, 23] : [12, 17, 22];
        for (let r = 0; r < ringZs.length; r++) {
          Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, ringZs[r], 0.44, 0.44, 1.6, {
            base: lv >= 3 && r === ringZs.length - 1 ? maxAccent : '#B87333'
          });
        }
        const orb = Iso.gridToScreen(tx + 0.5, ty + 0.5, 29);
        const pulse = isUnpowered ? 0.55 : 0.85 + 0.2 * Math.sin(timeSec * 7);
        ctx.fillStyle = isUnpowered ? P.powerDim : P.power;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, (lv >= 3 ? 6.6 : 5.8) * zScale * pulse, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'solar_array': {
        // Pedestal + Aluminum Tray + Glossy Photovoltaic Panel (Lv.2 steel mount; Lv.3 extra auxiliary solar wing)
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.35, 1, 0.30, 0.30, 8, {
          base: lv >= 2 ? steelCol : '#7b8996'
        });
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.12, 9, 0.84, 0.76, 2.2, {
          base: '#9cb0c4'
        });
        Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.15, 11.2, 0.78, 0.70, 1.8, {
          base: '#286ec2',
          stroke: lv >= 3 ? maxAccent : '#8ec8ff'
        });
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.04, 13.2, 0.60, 0.24, 1.5, {
            base: '#2f7bd6',
            stroke: '#8ec8ff'
          });
        }
        const s1 = Iso.gridToScreen(tx + 0.22, ty + 0.5, 13.5);
        const s2 = Iso.gridToScreen(tx + 0.78, ty + 0.5, 13.5);
        ctx.strokeStyle = 'rgba(170, 225, 255, 0.48)';
        ctx.lineWidth = 1.2 * zScale;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        break;
      }

      case 'wind_turbine': {
        // Sleek Modern 3-Blade Wind Turbine (Lv.2 steel base collar; Lv.3 orange blade tips)
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, 1, 0.44, 0.44, 5, {
          base: '#758594'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 6, 0.32, 0.32, 2.4, {
            base: steelCol
          });
        }
        Iso.drawVoxelBox(ctx, tx + 0.40, ty + 0.40, 6, 0.20, 0.20, 28, {
          base: '#f0f5fa'
        });
        const hub = Iso.gridToScreen(tx + 0.5, ty + 0.5, 35);
        const bladeAngle = timeSec * 2.8 + (tx + ty);
        ctx.strokeStyle = '#f5f9fc';
        ctx.lineWidth = 2.6 * zScale;
        for (let b = 0; b < 3; b++) {
          const a = bladeAngle + (b * Math.PI * 2) / 3;
          const tipX = hub.x + Math.cos(a) * 16 * zScale;
          const tipY = hub.y + Math.sin(a) * 14 * zScale;
          ctx.beginPath();
          ctx.moveTo(hub.x, hub.y);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
          if (lv >= 3) {
            ctx.fillStyle = maxAccent;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 2.1 * zScale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = P.power;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, 3 * zScale, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'battery_bank': {
        // Lithium ESS Battery Cabinet (Lv.2 steel band; Lv.3 5 segmented charge bars vs 4)
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 19, {
          base: '#e2ebf2',
          stroke: P.power
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.11, 2.5, 0.78, 0.78, 2.2, {
            base: steelCol
          });
        }
        const ratio = Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        const barSlots = lv >= 3 ? 5 : 4;
        const litSlots = Math.max(1, Math.round(ratio * barSlots));
        const stepZ = 12.5 / barSlots;
        for (let k = 0; k < barSlots; k++) {
          const isLit = ratio > 0.01 && k < litSlots;
          Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.84, 5.5 + k * stepZ, 0.56, 0.05, stepZ * 0.68, {
            base: isLit ? ledColor : P.powerDim,
            emissive: isLit
          });
        }
        break;
      }

      case 'field_tent': {
        // Modern Olive Tactical Dome Tent (Lv.2 steel skirt; Lv.3 extra warm window + comms mast)
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 9, {
          base: '#5d7059'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.09, ty + 0.09, 2.5, 0.82, 0.82, 2.2, {
            base: steelCol
          });
        }
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 6, {
          base: '#72876d'
        });
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.86, 4, 0.30, 0.06, 4, {
          base: P.baseLight,
          emissive: true
        });
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.86, ty + 0.35, 4, 0.06, 0.28, 4, {
            base: P.baseLight,
            emissive: true
          });
          const pA = Iso.gridToScreen(tx + 0.68, ty + 0.32, 16);
          const pB = Iso.gridToScreen(tx + 0.68, ty + 0.32, 22);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.3 * zScale;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
        break;
      }

      case 'shelter_pod': {
        // Modern Modular Container Home (Lv.2 steel band; Lv.3 extra side window + roof planter)
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.12, 1, 0.88, 0.76, 13.5, {
          base: '#dce5ed',
          stroke: 'rgba(255,255,255,0.2)'
        });
        if (lv >= 2) {
          Iso.drawVoxelBox(ctx, tx + 0.055, ty + 0.115, 2.5, 0.89, 0.77, 2.2, {
            base: steelCol
          });
        }
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.11, 14.5, 0.90, 0.78, 2.5, {
          base: '#ea6a3b'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.85, 5.5, 0.55, 0.06, 7, {
          base: P.baseLight,
          emissive: true
        });
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.25, 17, 0.32, 0.32, 4, {
          base: '#8fa0b0'
        });
        if (lv >= 3) {
          Iso.drawVoxelBox(ctx, tx + 0.91, ty + 0.28, 6, 0.05, 0.42, 6, {
            base: P.baseLight,
            emissive: true
          });
          Iso.drawVoxelBox(ctx, tx + 0.62, ty + 0.26, 17, 0.20, 0.20, 3.2, {
            base: '#64c466'
          });
        }
        break;
      }

      case 'gas_heater': {
        // Stainless Outdoor Patio Gas Heater (No Electricity!)
        Iso.drawVoxelBox(ctx, tx + 0.32, ty + 0.32, 1, 0.36, 0.36, 9, {
          base: '#7d8a96'
        });
        // Glowing amber flame cylinder
        Iso.drawVoxelBox(ctx, tx + 0.38, ty + 0.38, 10, 0.24, 0.24, 9, {
          base: '#ffb347',
          emissive: true
        });
        // Reflector canopy
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 19, 0.60, 0.60, 2.5, {
          base: '#cfd9e3'
        });
        break;
      }

      case 'led_floodlight': {
        // Tactical Tripod Mast + Twin LED Floodlights
        Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 1, 0.32, 0.32, 4, {
          base: '#525f6e'
        });
        Iso.drawVoxelBox(ctx, tx + 0.44, ty + 0.44, 5, 0.12, 0.12, 20, {
          base: '#8a99a8'
        });
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.32, 25, 0.56, 0.36, 5, {
          base: isUnpowered ? P.powerDim : P.power,
          emissive: !isUnpowered
        });
        break;
      }

      case 'urban_planter': {
        // Architectural Concrete Planter + Soil Bed + Miniature Lush Tree
        Iso.drawVoxelBox(ctx, tx + 0.16, ty + 0.16, 1, 0.68, 0.68, 6.2, {
          base: '#cbd3db'
        });
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 7.2, 0.56, 0.56, 1.0, {
          base: '#5e493a'
        });
        Iso.drawVoxelBox(ctx, tx + 0.42, ty + 0.42, 8.2, 0.16, 0.16, 7.8, {
          base: '#78583f'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 15, 0.60, 0.60, 10, {
          base: '#64c466'
        });
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, 25, 0.44, 0.44, 6, {
          base: '#7ede78'
        });
        break;
      }

      case 'vending_machine': {
        // Glowing Smart Drink Vending Machine (warm internal display)
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 1, 0.56, 0.56, 21, {
          base: '#475569'
        });
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.75, 7, 0.42, 0.06, 11, {
          base: P.baseLight,
          emissive: true
        });
        break;
      }

      case 'repair_bay': {
        // Robotic Maintenance Bay
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 5, {
          base: '#475361'
        });
        Iso.drawVoxelBox(ctx, tx + 0.25, ty + 0.20, 6, 0.50, 0.35, 12, {
          base: P.health
        });
        break;
      }

      case 'lounge_set': {
        // Modern Parasol & Lounge Table (unified top-left shading)
        Iso.drawVoxelBox(ctx, tx + 0.32, ty + 0.32, 1, 0.36, 0.36, 7, {
          base: '#e8eef5'
        });
        Iso.drawVoxelBox(ctx, tx + 0.46, ty + 0.46, 8, 0.08, 0.08, 13, {
          base: '#cbd5e0'
        });
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 21, 0.76, 0.76, 3.2, {
          base: '#e07a5f'
        });
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 24.2, 0.56, 0.56, 1.4, {
          base: '#f1f5f9'
        });
        break;
      }

      case 'arcade_neon': {
        // Neon Sign + Arcade Station (emissive marquee)
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 1, 0.56, 0.56, 18, {
          base: '#3a2c54',
          stroke: isUnpowered ? '#555' : '#eb64ff'
        });
        Iso.drawVoxelBox(ctx, tx + 0.26, ty + 0.26, 19, 0.48, 0.48, 6, {
          base: isUnpowered ? '#52495c' : '#ff66e5',
          emissive: !isUnpowered
        });
        break;
      }

      case 'boss_trophy': {
        Iso.drawVoxelBox(ctx, tx + 0.18, ty + 0.18, 1, 0.64, 0.64, 10, {
          base: '#2e3744'
        });
        const holo = Iso.gridToScreen(tx + 0.5, ty + 0.5, 22 + Math.sin(timeSec * 3.5) * 3);
        ctx.fillStyle = P.gold;
        ctx.beginPath();
        ctx.moveTo(holo.x, holo.y - 9 * zScale);
        ctx.lineTo(holo.x + 7 * zScale, holo.y);
        ctx.lineTo(holo.x, holo.y + 9 * zScale);
        ctx.lineTo(holo.x - 7 * zScale, holo.y);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }

    Iso.setEntityFlash(0);
    if (hasBuildTransform) {
      ctx.restore();
    }

    // 0.6s Facility Upgrade white scanline sweep VFX
    if (id !== 'command_hq' && st.upgradeAnimTimer > 0) {
      const p = 1 - Math.max(0, Math.min(1, st.upgradeAnimTimer / 0.6));
      const scanZ = 1 + p * getStructVisualTopZ(id, lv);
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
    const aim = st.aimAngle || 0.8;

    // 1.2s Upgrade rise-up animation: dust (1.2->0.8), rise-up ease-out (0.8->0.3), turret mount flash (0.3->0.15)
    let zLift = 0;
    const animT = st.upgradeAnimTimer || 0;
    if (animT > 0.3) {
      const p = Math.max(0, Math.min(1, (1.1 - animT) / 0.5));
      const easeOut = 1 - Math.pow(1 - p, 3);
      zLift = -14 * (1 - easeOut);
    }
    const zb = Math.max(0, 1 + zLift);

    if (lv === 1) {
      // Lv.1 임시 지휘소: sandbag ring (#B5A27A) + olive container (#7D8B6A, 0.6x0.54, h12) + warm door window (#FFD27A) + radio antenna (h36)
      const segs = [
        [0.06, 0.14, 0.88, 0.14],
        [0.06, 0.72, 0.88, 0.14],
        [0.06, 0.28, 0.14, 0.44],
        [0.80, 0.28, 0.14, 0.44]
      ];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        Iso.drawVoxelBox(ctx, tx + s[0], ty + s[1], zb, s[2], s[3], 5, {
          base: '#B5A27A',
          stroke: 'rgba(65, 52, 34, 0.35)'
        });
      }
      Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.22, zb, 0.60, 0.54, 12, {
        base: '#7D8B6A',
        stroke: 'rgba(255,255,255,0.18)'
      });
      // Warm entrance window (#FFD27A, NO cyan)
      Iso.drawVoxelBox(ctx, tx + 0.30, ty + 0.75, zb + 4.5, 0.24, 0.04, 4, {
        base: P.baseLight,
        emissive: true
      });
      // Radio antenna mast + warm blinking tip
      const antBot = Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 12);
      const antTop = Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 34);
      ctx.strokeStyle = '#C8D0D8';
      ctx.lineWidth = Math.max(1.2, 1.5 * zScale);
      ctx.beginPath();
      ctx.moveTo(antBot.x, antBot.y);
      ctx.lineTo(antTop.x, antTop.y);
      ctx.stroke();

      ctx.fillStyle = Math.sin(timeSec * 4.5) > -0.2 ? P.baseLight : '#B8893A';
      ctx.beginPath();
      ctx.arc(antTop.x, antTop.y - 1 * zScale, 2.3 * zScale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (lv === 2) {
      // Lv.2 전술 작전 본부: body 0.84x0.84 h16 (#5B6B7C) + #FFD27A window band (z 9..12) + bridge 0.6x0.6 h6 (#C9D3DD) + radar + LMG (0.32 tiles)
      Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, zb, 0.84, 0.84, 16, {
        base: '#5B6B7C',
        stroke: 'rgba(255,255,255,0.20)'
      });
      Iso.drawVoxelBox(ctx, tx + 0.075, ty + 0.075, zb + 9, 0.85, 0.85, 3, {
        base: P.baseLight,
        emissive: true
      });
      Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, zb + 16, 0.60, 0.60, 6, {
        base: '#C9D3DD'
      });
      // Small radar dish on back-left
      const rBot = Iso.gridToScreen(tx + 0.32, ty + 0.32, zb + 22);
      const rTop = Iso.gridToScreen(tx + 0.32, ty + 0.32, zb + 28);
      ctx.strokeStyle = '#C9D3DD';
      ctx.lineWidth = 1.6 * zScale;
      ctx.beginPath();
      ctx.moveTo(rBot.x, rBot.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.stroke();
      ctx.fillStyle = '#EEF5FC';
      ctx.beginPath();
      ctx.ellipse(rTop.x, rTop.y - 1 * zScale, 5.8 * zScale, 3.3 * zScale, Math.sin(timeSec * 1.8) * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Roof LMG turret mount + single barrel (0.32 tiles)
      Iso.drawVoxelBox(ctx, tx + 0.54, ty + 0.54, zb + 22, 0.16, 0.16, 3, {
        base: '#3B4552'
      });
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 24, aim, 0.32, 1, 2.2, '#1F242B', zScale);
      return;
    }

    if (lv === 3) {
      // Lv.3 통합 요새 사령부: skirt 0.96 h8 (#4A5562) + body 0.76 h16 (#5B6B7C) + #FFD27A band + bridge 0.56 h7 (#DCE4EC) + #FFF6DA searchlight + HMG twin barrels (0.38)
      Iso.drawVoxelBox(ctx, tx + 0.02, ty + 0.02, zb, 0.96, 0.96, 8, {
        base: '#4A5562',
        stroke: 'rgba(255,255,255,0.16)'
      });
      Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, zb + 8, 0.76, 0.76, 16, {
        base: '#5B6B7C',
        stroke: 'rgba(255,255,255,0.22)'
      });
      Iso.drawVoxelBox(ctx, tx + 0.115, ty + 0.115, zb + 15, 0.77, 0.77, 3, {
        base: P.baseLight,
        emissive: true
      });
      Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, zb + 24, 0.56, 0.56, 7, {
        base: '#DCE4EC'
      });
      // Searchlight housing + #FFF6DA lens
      Iso.drawVoxelBox(ctx, tx + 0.26, ty + 0.30, zb + 31, 0.13, 0.11, 3, {
        base: '#59636E'
      });
      Iso.drawVoxelBox(ctx, tx + 0.26, ty + 0.41, zb + 31.5, 0.13, 0.03, 2.2, {
        base: '#FFF6DA',
        emissive: true
      });
      // HMG twin turret mount + twin barrels (0.38 tiles)
      Iso.drawVoxelBox(ctx, tx + 0.52, ty + 0.52, zb + 31, 0.20, 0.20, 3.5, {
        base: '#3B4552'
      });
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 33.5, aim, 0.38, 2, 2.4, '#1F242B', zScale);
      return;
    }

    // Lv.4 이지스 코어 사령부: skirt 1.0 h10 (#3F4955) + hazard stripe (#F0BD35) + body 0.8 h18 (#5B6B7C) + 2nd tower 0.6 h8 (#DCE4EC) + 2 #FFD27A bands + white dome + heavy twin barrels (0.48) + #FFF3D6 core beacon
    Iso.drawVoxelBox(ctx, tx, ty, zb, 1.0, 1.0, 10, {
      base: '#3F4955',
      stroke: 'rgba(255,255,255,0.18)'
    });
    Iso.drawVoxelBox(ctx, tx - 0.005, ty - 0.005, zb + 3, 1.01, 1.01, 2, {
      base: '#F0BD35'
    });
    Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, zb + 10, 0.80, 0.80, 18, {
      base: '#5B6B7C',
      stroke: 'rgba(255,255,255,0.24)'
    });
    Iso.drawVoxelBox(ctx, tx + 0.095, ty + 0.095, zb + 19, 0.81, 0.81, 3, {
      base: P.baseLight,
      emissive: true
    });
    Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, zb + 28, 0.60, 0.60, 8, {
      base: '#DCE4EC'
    });
    Iso.drawVoxelBox(ctx, tx + 0.195, ty + 0.195, zb + 33, 0.61, 0.61, 1.6, {
      base: P.baseLight,
      emissive: true
    });
    // White Aegis dome (stepped voxel dome)
    Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, zb + 36, 0.44, 0.44, 5, {
      base: '#EEF3F8'
    });
    Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, zb + 41, 0.32, 0.32, 4, {
      base: '#F8FAFC'
    });
    // Heavy twin Aegis barrels (0.48 tiles)
    drawHqRoofBarrels(ctx, tx + 0.50, ty + 0.50, zb + 40, aim, 0.48, 2, 3.4, '#1F242B', zScale);
    // Warm #FFF3D6 core beacon at top (z 46.5, maxZ 48)
    const beacon = Iso.gridToScreen(tx + 0.50, ty + 0.50, zb + 46.5);
    ctx.fillStyle = '#FFF3D6';
    ctx.beginPath();
    ctx.arc(beacon.x, beacon.y, 3.2 * zScale, 0, Math.PI * 2);
    ctx.fill();
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

  function flushOrientedParts(ctx, parts) {
    parts.sort((a, b) => a.sort - b.sort);
    const Iso = ZS.Iso;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      Iso.drawVoxelBox(ctx, p.x, p.y, p.z, p.w, p.d, p.h, p.opts);
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

  function getZombiePoseMetrics(z, zDef, timeSec) {
    const sc = zDef.scale || 1.0;
    const type = z.type || 'walker';
    const freq = type === 'runner' ? 12.5 : type === 'brute' ? 5.8 : zDef.isBoss ? 4.8 : 7.8;
    const stride = Math.sin(timeSec * freq + (z.seed || 0));
    const bobAmp = type === 'runner' ? 1.8 : type === 'brute' ? 1.6 : zDef.isBoss ? 2.2 : 2.2;
    const bob = Math.abs(stride) * bobAmp;

    const ang = typeof z.facingAngle === 'number' ? z.facingAngle : Math.PI * 0.75;
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);
    const px = -fy;
    const py = fx;

    let headFwd = 0.05 * sc;
    let headZ = 1 + bob + 13.0 * sc;
    let headW = 0.31 * sc;
    let headH = 10.6 * sc;
    let topZ = 1 + bob + 26.8 * sc;

    if (type === 'runner') {
      // Hunched forward predator pose: head pitched far forward while keeping >=16px 2.2-head toy height at 0.78x zoom
      headFwd = 0.25 * sc;
      headZ = 1 + bob + 11.2 * sc;
      headW = 0.32 * sc;
      headH = 10.8 * sc;
      topZ = 1 + bob + 25.4 * sc;
    } else if (type === 'brute') {
      // Broad armored juggernaut: thick head tucked into wide shoulder collar
      headFwd = 0.06 * sc;
      headZ = 1 + bob + 11.8 * sc;
      headW = 0.28 * sc;
      headH = 8.4 * sc;
      topZ = 1 + bob + 23.2 * sc;
    } else if (zDef.isBoss) {
      // Towering horned mutant titan
      headFwd = 0.05 * sc;
      headZ = 1 + bob + 12.2 * sc;
      headW = 0.28 * sc;
      headH = 8.8 * sc;
      topZ = 1 + bob + 28.5 * sc;
    }

    return { sc, type, stride, bob, ang, fx, fy, px, py, headFwd, headZ, headW, headH, topZ };
  }

  function getZombieEyePositions(z, zDef, timeSec, zScale) {
    const Iso = ZS.Iso;
    const m = getZombiePoseMetrics(z, zDef, timeSec);
    const eyeWorldX = z.x + m.fx * (m.headFwd + m.headW * 0.44);
    const eyeWorldY = z.y + m.fy * (m.headFwd + m.headW * 0.44);
    const eyeWorldZ = m.headZ + m.headH * 0.46;

    const sepWorld = m.headW * 0.24;
    const cPos = Iso.gridToScreen(eyeWorldX, eyeWorldY, eyeWorldZ);
    const lPos = Iso.gridToScreen(eyeWorldX - m.px * sepWorld, eyeWorldY - m.py * sepWorld, eyeWorldZ);
    const rPos = Iso.gridToScreen(eyeWorldX + m.px * sepWorld, eyeWorldY + m.py * sepWorld, eyeWorldZ);

    return {
      cx: cPos.x,
      cy: cPos.y,
      lx: lPos.x,
      ly: lPos.y,
      rx: rPos.x,
      ry: rPos.y,
      sc: m.sc
    };
  }

  function drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P) {
    const eyeSz = Math.max(2.0, 2.3 * eyes.sc * zScale);
    ctx.fillStyle = P.outlineDark || '#1B2430';
    ctx.fillRect(eyes.lx - eyeSz * 0.5 - 0.8, eyes.ly - eyeSz * 0.5 - 0.8, eyeSz + 1.6, eyeSz + 1.6);
    ctx.fillRect(eyes.rx - eyeSz * 0.5 - 0.8, eyes.ry - eyeSz * 0.5 - 0.8, eyeSz + 1.6, eyeSz + 1.6);

    ctx.fillStyle = zDef.eyeColor || P.danger;
    ctx.fillRect(eyes.lx - eyeSz * 0.5, eyes.ly - eyeSz * 0.5, eyeSz, eyeSz);
    ctx.fillRect(eyes.rx - eyeSz * 0.5, eyes.ry - eyeSz * 0.5, eyeSz, eyeSz);
  }

  function isZombieEyesOccluded(state, z, eyes, zScale) {
    const DATA = ZS.DATA;
    const Iso = ZS.Iso;
    const N = DATA.GRID_SIZE;
    const tx = Math.floor(z.x);
    const ty = Math.floor(z.y);
    const offsets = [
      [1, 0],
      [0, 1],
      [1, 1]
    ];
    for (let k = 0; k < offsets.length; k++) {
      const sx = tx + offsets[k][0];
      const sy = ty + offsets[k][1];
      if (sx < 0 || sy < 0 || sx >= N || sy >= N) continue;
      const st = state.structGrid[sy] && state.structGrid[sy][sx];
      if (!st) continue;
      const def = st.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[st.id];
      if (def && def.passable) continue;
      if (sx + sy + 1.0 <= z.x + z.y + 0.05) continue;

      const hqLv = state.hqLevel || 1;
      const hqOccH = hqLv === 1 ? 18 : hqLv === 2 ? 26 : hqLv === 3 ? 36 : 46;
      const structH = st.id === 'command_hq' ? hqOccH : st.id === 'sniper_tower' ? 38 : 26;
      const topPos = Iso.gridToScreen(sx + 0.5, sy + 0.5, structH);
      const botPos = Iso.gridToScreen(sx + 1, sy + 1, 0);
      const halfW = 26 * zScale;
      if (
        eyes.cx >= topPos.x - halfW &&
        eyes.cx <= topPos.x + halfW &&
        eyes.cy >= topPos.y &&
        eyes.cy <= botPos.y
      ) {
        return true;
      }
    }
    return false;
  }

  function drawZombie(ctx, z, timeSec, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const zDef = ZS.DATA.ZOMBIES[z.type] || ZS.DATA.ZOMBIES.walker;
    const m = getZombiePoseMetrics(z, zDef, timeSec);
    const { sc, type, stride, bob, fx, fy, px, py } = m;

    const basePos = Iso.gridToScreen(z.x, z.y, 1);

    // Boss: dark abyssal ground shadow ring + pulsing danger threat ring (#7)
    if (zDef.isBoss) {
      const pulse = 0.94 + 0.09 * Math.sin(timeSec * 5);
      ctx.fillStyle = 'rgba(18, 6, 26, 0.52)';
      ctx.strokeStyle = 'rgba(224, 64, 251, 0.45)';
      ctx.lineWidth = 2.2 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 18.5 * sc * zScale * pulse, 9.5 * sc * zScale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = P.dangerFill;
      ctx.strokeStyle = P.danger;
      ctx.lineWidth = 1.9 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 14.5 * sc * zScale * pulse, 7.4 * sc * zScale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Crisp ground contact shadow for strong luminance separation against grass
    const shadowRx = (type === 'brute' ? 11.4 : type === 'runner' ? 10.2 : 9.6) * sc * zScale;
    const shadowRy = (type === 'brute' ? 5.8 : 5.0) * sc * zScale;
    ctx.fillStyle = 'rgba(8, 10, 16, 0.52)';
    ctx.beginPath();
    ctx.ellipse(basePos.x, basePos.y, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();

    Iso.setEntityFlash(z.hitFlash || 0);

    const parts = [];
    const darkStroke = 'rgba(27, 36, 48, 0.42)';
    const legStep = stride * 0.055 * sc;

    if (type === 'runner') {
      // RUNNER: Low hunched forward-leaning sprint pose + swept-back limbs + jutting head
      const legW = 0.12 * sc;
      pushOrientedPart(parts, z.x - fx * (0.10 * sc - legStep) - px * 0.09 * sc, z.y - fy * (0.10 * sc - legStep) - py * 0.09 * sc, 1, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      pushOrientedPart(parts, z.x - fx * (0.10 * sc + legStep) + px * 0.09 * sc, z.y - fy * (0.10 * sc + legStep) + py * 0.09 * sc, 1, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      // Rear hunched pelvis/back
      pushOrientedPart(parts, z.x - fx * 0.09 * sc, z.y - fy * 0.09 * sc, 1 + bob + 4.4 * sc, 0.28 * sc, 0.28 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      // Forward-pitched chest + orange harness
      pushOrientedPart(parts, z.x + fx * 0.10 * sc, z.y + fy * 0.10 * sc, 1 + bob + 6.4 * sc, 0.30 * sc, 0.30 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      if (zDef.accentColor) {
        pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, 1 + bob + 8.4 * sc, 0.32 * sc, 0.32 * sc, 3.0 * sc, {
          base: zDef.accentColor
        });
      }
      // Swept-back predator sprint arms
      const armW = 0.11 * sc;
      pushOrientedPart(parts, z.x - fx * 0.16 * sc - px * 0.18 * sc, z.y - fy * 0.16 * sc - py * 0.18 * sc, 1 + bob + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      pushOrientedPart(parts, z.x - fx * 0.16 * sc + px * 0.18 * sc, z.y - fy * 0.16 * sc + py * 0.18 * sc, 1 + bob + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      // Forward-jutting large toy head
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'brute') {
      // BRUTE: Extra-wide T-silhouette shoulders + heavy front ballistic riot plate
      const legW = 0.13 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, 1, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, 1, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      // Massive core torso
      pushOrientedPart(parts, z.x, z.y, 1 + bob + 3.6 * sc, 0.34 * sc, 0.34 * sc, 8.4 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      // Front thick ballistic armor shield plate (#C97A9E)
      const armorCol = zDef.armorColor || '#C97A9E';
      pushOrientedPart(parts, z.x + fx * 0.15 * sc, z.y + fy * 0.15 * sc, 1 + bob + 4.2 * sc, 0.24 * sc, 0.24 * sc, 7.4 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
      // Oversized left & right shoulder pauldrons + heavy fists (unmistakable wide silhouette)
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + px * side * 0.22 * sc, z.y + py * side * 0.22 * sc, 1 + bob + 7.2 * sc, 0.18 * sc, 0.18 * sc, 5.4 * sc, {
          base: armorCol,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.07 * sc + px * side * 0.23 * sc, z.y + fy * 0.07 * sc + py * side * 0.23 * sc, 1 + bob + 2.8 * sc, 0.14 * sc, 0.14 * sc, 4.8 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      // Heavy armored head tucked between pauldrons
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
      // Riot helmet brow strip
      pushOrientedPart(parts, z.x + fx * (m.headFwd + 0.01 * sc), z.y + fy * (m.headFwd + 0.01 * sc), m.headZ + m.headH * 0.68, m.headW * 1.06, m.headW * 1.06, 2.2 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
    } else if (zDef.isBoss) {
      // BOSS (Alpha Titan): Towering mutant + glowing fissures + spiked shoulders + twin curved horns
      const legW = 0.13 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, 1, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, 1, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      // Mutant torso
      pushOrientedPart(parts, z.x, z.y, 1 + bob + 3.8 * sc, 0.33 * sc, 0.33 * sc, 8.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      // Glowing magenta/violet fissure core + dorsal crystal裂 (emissive)
      const crackCol = zDef.accentColor || '#E040FB';
      pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, 1 + bob + 5.4 * sc, 0.26 * sc, 0.26 * sc, 4.4 * sc, {
        base: crackCol,
        emissive: true
      });
      pushOrientedPart(parts, z.x - fx * 0.12 * sc, z.y - fy * 0.12 * sc, 1 + bob + 7.6 * sc, 0.14 * sc, 0.14 * sc, 5.2 * sc, {
        base: crackCol,
        emissive: true
      });
      // Broad clawed arms + shoulder spikes
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + px * side * 0.21 * sc, z.y + py * side * 0.21 * sc, 1 + bob + 8.0 * sc, 0.16 * sc, 0.16 * sc, 5.0 * sc, {
          base: zDef.coatColor,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.14 * sc + px * side * 0.21 * sc, z.y + fy * 0.14 * sc + py * side * 0.21 * sc, 1 + bob + 4.2 * sc, 0.14 * sc, 0.14 * sc, 5.0 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      // Large mutant skull
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
      // Twin 2-stage curved horns crowning silhouette
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + fx * 0.04 * sc + px * side * 0.16 * sc, z.y + fy * 0.04 * sc + py * side * 0.16 * sc, m.headZ + m.headH * 0.72, 0.10 * sc, 0.10 * sc, 3.8 * sc, {
          base: '#2b0938',
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.10 * sc + px * side * 0.21 * sc, z.y + fy * 0.10 * sc + py * side * 0.21 * sc, m.headZ + m.headH * 0.72 + 3.0 * sc, 0.085 * sc, 0.085 * sc, 4.4 * sc, {
          base: crackCol,
          emissive: true
        });
      }
    } else {
      // WALKER: Upright 2.2-head shambler with two iconic outstretched zombie arms in front
      const legW = 0.11 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.075 * sc, z.y + fy * legStep - py * 0.075 * sc, 1, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.075 * sc, z.y - fy * legStep + py * 0.075 * sc, 1, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      // Coat torso
      pushOrientedPart(parts, z.x, z.y, 1 + bob + 4.2 * sc, 0.29 * sc, 0.29 * sc, 9.0 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      // Outstretched zombie arms reaching forward (signature Walker silhouette)
      for (const side of [-1, 1]) {
        // Upper arm sleeve
        pushOrientedPart(parts, z.x + fx * 0.16 * sc + px * side * 0.16 * sc, z.y + fy * 0.16 * sc + py * side * 0.16 * sc, 1 + bob + 8.6 * sc, 0.115 * sc, 0.115 * sc, 3.4 * sc, {
          base: zDef.coatColor
        });
        // Forearm + reaching hand
        pushOrientedPart(parts, z.x + fx * 0.30 * sc + px * side * 0.16 * sc, z.y + fy * 0.30 * sc + py * side * 0.16 * sc, 1 + bob + 8.8 * sc, 0.115 * sc, 0.115 * sc, 3.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      // Large 2.2-head infected head
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    }

    flushOrientedParts(ctx, parts);

    // Boss glowing chest crack lines on screen space for unmistakable mutant fissure detail
    if (zDef.isBoss && !(z.hitFlash > 0)) {
      const c1 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.06 * sc, z.y + fy * 0.18 * sc - py * 0.06 * sc, 1 + bob + 9.8 * sc);
      const c2 = Iso.gridToScreen(z.x + fx * 0.20 * sc + px * 0.02 * sc, z.y + fy * 0.20 * sc + py * 0.02 * sc, 1 + bob + 7.2 * sc);
      const c3 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.04 * sc, z.y + fy * 0.18 * sc - py * 0.04 * sc, 1 + bob + 4.8 * sc);
      ctx.strokeStyle = '#FF94FF';
      ctx.lineWidth = Math.max(1.2, 1.6 * zScale);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.stroke();
    }

    Iso.setEntityFlash(0);

    // Depth-sorted daytime/lit eyes (naturally occluded by foreground 3D structures)
    const eyes = getZombieEyePositions(z, zDef, timeSec, zScale);
    drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P);

    // Slowed EMP cyan tint ring
    if (z.slowTimer > 0) {
      ctx.strokeStyle = P.power;
      ctx.lineWidth = 1.4 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 10.2 * sc * zScale, 5.4 * sc * zScale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lv.3 Razor Pad Vulnerability ring (+15% incoming projectile damage)
    if (z.vulnOnPad) {
      ctx.fillStyle = P.dangerFill;
      ctx.strokeStyle = P.danger;
      ctx.lineWidth = 1.4 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 11.6 * sc * zScale, 6.0 * sc * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawProjectiles(ctx, projectiles, zScale) {
    const Iso = ZS.Iso;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.kind === 'ring') {
        const alpha = Math.max(0, p.life / (p.maxLife || 0.2));
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        drawIsoCircle(ctx, p.x, p.y, p.radius || 0.8, p.color || '#FF9F43', 'rgba(255, 159, 67, 0.22)');
        ctx.restore();
        continue;
      }
      if (p.kind === 'promo_ring') {
        const t = 1 - Math.max(0, p.life / (p.maxLife || 0.8));
        const c = Iso.gridToScreen(p.x, p.y, p.z || 18);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.92;
        ctx.strokeStyle = p.color || '#FFD34D';
        ctx.lineWidth = 2.4 * zScale;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, (10 + t * 24) * zScale, (5.5 + t * 13) * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'spark') {
        const p1 = Iso.gridToScreen(p.x1, p.y1, p.z || 10);
        const p2 = Iso.gridToScreen(p.x2, p.y2, p.z || 10);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.12));
        ctx.strokeStyle = p.color || '#FF8A3D';
        ctx.lineWidth = 2.4 * zScale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo((p1.x + p2.x) * 0.5 + 3 * zScale, (p1.y + p2.y) * 0.5 - 4 * zScale);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'sniper_trail') {
        const p1 = Iso.gridToScreen(p.x1, p.y1, p.z || 24);
        const p2 = Iso.gridToScreen(p.x2, p.y2, p.z || 24);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.15)) * 0.9;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.2 * zScale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'chain') {
        ctx.strokeStyle = ZS.DATA.PALETTE.power;
        ctx.lineWidth = 2.2 * (p.widthMult || 1.0) * zScale;
        ctx.beginPath();
        for (let k = 0; k < p.points.length; k++) {
          const pt = Iso.gridToScreen(p.points[k].x, p.points[k].y, 14);
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x + (Math.random() - 0.5) * 6, pt.y + (Math.random() - 0.5) * 6);
        }
        ctx.stroke();
        continue;
      }

      const cur = Iso.gridToScreen(p.x, p.y, p.z || 12);
      const prev = Iso.gridToScreen(p.x - p.vx * 0.035, p.y - p.vy * 0.035, p.z || 12);
      ctx.strokeStyle = p.color || '#ffe484';
      ctx.lineWidth = (p.width || 2.2) * zScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }
  }

  function drawGroundStains(ctx, stains, zScale) {
    const Iso = ZS.Iso;
    ctx.save();
    for (let i = 0; i < stains.length; i++) {
      const stn = stains[i];
      const fade = Math.min(1, stn.life / Math.min(2.2, stn.maxLife || 7.5));
      const p = Iso.gridToScreen(stn.x, stn.y, 1.05);
      const rx = stn.radius * 30 * zScale;
      const ry = stn.radius * 15 * zScale;

      ctx.globalAlpha = fade * 0.56;
      ctx.fillStyle = stn.color || '#4E1224';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, (stn.seed || 0) * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Two small irregular satellite splatter droplets
      const a1 = (stn.seed || 1) * 1.9;
      const a2 = a1 + 2.3;
      ctx.globalAlpha = fade * 0.46;
      ctx.fillStyle = stn.subColor || '#7A1A32';
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a1) * rx * 0.85, p.y + Math.sin(a1) * ry * 0.85, rx * 0.36, ry * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + Math.cos(a2) * rx * 0.72, p.y + Math.sin(a2) * ry * 0.72, rx * 0.28, ry * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDyingZombie(ctx, dz, zScale) {
    const Iso = ZS.Iso;
    const t = Math.max(0, Math.min(1, dz.timer / (dz.duration || 0.32)));
    const ease = t * t;
    const sc = dz.scale || 1.0;
    const fallAngle = (dz.facingAngle || 0) + (dz.fallDir || 1) * 1.15;
    const fx = Math.cos(fallAngle);
    const fy = Math.sin(fallAngle);

    const alpha = Math.max(0, 1 - Math.max(0, (t - 0.58) / 0.42));
    ctx.save();
    ctx.globalAlpha = alpha;

    const shadowP = Iso.gridToScreen(dz.x + fx * ease * 0.20 * sc, dz.y + fy * ease * 0.20 * sc, 1);
    ctx.fillStyle = 'rgba(8, 10, 16, 0.38)';
    ctx.beginPath();
    ctx.ellipse(shadowP.x, shadowP.y, (9 + ease * 5) * sc * zScale, (4.8 + ease * 2.2) * sc * zScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brief initial white flash on first 18% of death fall
    Iso.setEntityFlash(t < 0.18 ? 1.0 : 0);

    const torsoX = dz.x + fx * ease * 0.16 * sc;
    const torsoY = dz.y + fy * ease * 0.16 * sc;
    const torsoZ = 1 + (1 - ease) * 4.2 * sc;
    const torsoW = (0.28 + ease * 0.08) * sc;
    const torsoH = Math.max(2.6 * sc, (8.2 - ease * 5.2) * sc);

    const headX = dz.x + fx * (0.06 + ease * 0.36) * sc;
    const headY = dz.y + fy * (0.06 + ease * 0.36) * sc;
    const headZ = 1 + (1 - ease) * 12.2 * sc;
    const headW = 0.28 * sc;
    const headH = Math.max(3.2 * sc, (8.6 - ease * 4.2) * sc);

    const parts = [];
    pushOrientedPart(parts, torsoX, torsoY, torsoZ, torsoW, torsoW, torsoH, {
      base: dz.coatColor,
      stroke: 'rgba(27, 36, 48, 0.38)'
    });
    if (dz.accentColor) {
      pushOrientedPart(parts, torsoX + fx * 0.05 * sc, torsoY + fy * 0.05 * sc, torsoZ + torsoH * 0.35, torsoW * 0.92, torsoW * 0.92, torsoH * 0.45, {
        base: dz.accentColor,
        emissive: !!dz.isBoss
      });
    }
    pushOrientedPart(parts, headX, headY, headZ, headW, headW, headH, {
      base: dz.skinColor,
      stroke: 'rgba(27, 36, 48, 0.38)'
    });
    flushOrientedParts(ctx, parts);

    Iso.setEntityFlash(0);
    ctx.restore();
  }

  function drawMuzzleFlashes(ctx, flashes, zScale) {
    const Iso = ZS.Iso;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < flashes.length; i++) {
      const mf = flashes[i];
      const alpha = Math.max(0, Math.min(1, mf.life / (mf.maxLife || 0.055)));
      const sc = (mf.scale || 1.0) * zScale;
      const origin = Iso.gridToScreen(mf.x, mf.y, mf.z);

      if (mf.kind === 'emp') {
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = mf.color || '#5EF2FF';
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 9.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const tip = Iso.gridToScreen(
        mf.x + Math.cos(mf.angle) * 0.34 * (mf.scale || 1.0),
        mf.y + Math.sin(mf.angle) * 0.34 * (mf.scale || 1.0),
        mf.z
      );
      const dx = tip.x - origin.x;
      const dy = tip.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wing = 4.6 * sc;

      // Outer warm muzzle flame cone
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = mf.color || '#FFE484';
      ctx.beginPath();
      ctx.moveTo(origin.x + nx * wing, origin.y + ny * wing);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(origin.x - nx * wing, origin.y - ny * wing);
      ctx.closePath();
      ctx.fill();

      // Hot white core spark at barrel tip
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(origin.x + dx * 0.22, origin.y + dy * 0.22, 3.4 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(ctx, particles, zScale) {
    const Iso = ZS.Iso;
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const alpha = Math.max(0, pt.life / (pt.maxLife || 0.5));
      if (pt.kind === 'cube') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.25);
        const w = pt.w || 0.10;
        Iso.drawVoxelBox(ctx, pt.x - w * 0.5, pt.y - w * 0.5, pt.z, w, w, pt.h || 3.0, {
          base: pt.color || '#94A3B8',
          stroke: 'rgba(27, 36, 48, 0.38)'
        });
        ctx.restore();
        continue;
      }
      const sc = Iso.gridToScreen(pt.x, pt.y, pt.z);
      ctx.save();
      if (pt.kind === 'dust') {
        const grow = 1 + (1 - alpha) * 0.65;
        ctx.globalAlpha = alpha * 0.52;
        ctx.fillStyle = pt.color || '#DDD2BE';
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, pt.size * grow * zScale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, pt.size * zScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawNightLighting(ctx, w, h, state, powered, timeSec, zScale) {
    ensureLightCanvas(w, h);
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

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const def = DATA.ITEMS[st.id];
        if (!def) continue;
        if (def.requiresPower && !powered) continue;

        if (def.lightRadius) {
          const flicker = st.id === 'gas_heater' ? 0.96 + 0.05 * Math.sin(timeSec * 11 + x) : 1.0;
          punchHole(x + 0.5, y + 0.5, 12, def.lightRadius * flicker, 0.92);
          if (def.lightColor) {
            colorGlows.push({
              gx: x + 0.5,
              gy: y + 0.5,
              z: 12,
              r: def.lightRadius * 0.85,
              color: def.lightColor
            });
          }
        } else if (def.subType === 'housing' || st.id === 'vending_machine') {
          // Warm interior window glow for cozy shelters & vending machine (#5 warm base vs cold outside)
          const rad = st.id === 'shelter_pod' ? 2.2 : st.id === 'field_tent' ? 1.85 : 1.35;
          punchHole(x + 0.5, y + 0.5, 10, rad, 0.78);
          colorGlows.push({
            gx: x + 0.5,
            gy: y + 0.5,
            z: 10,
            r: rad * 0.85,
            color: 'rgba(255, 206, 112, 0.34)'
          });
        } else if (def.subType === 'manned' || def.subType === 'turret') {
          punchHole(x + 0.5, y + 0.5, 10, 1.65, 0.55);
          if (def.subType === 'manned') {
            colorGlows.push({
              gx: x + 0.5,
              gy: y + 0.5,
              z: 10,
              r: 1.25,
              color: 'rgba(255, 198, 108, 0.18)'
            });
          }
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

  function drawInfoLayer(ctx, state, uiState, renderList, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;

    ctx.save();

    // 1. Selected / Inspected Tile Border (crisp above night darkness without cutting through 3D structures)
    if (state.phase === 'day' && uiState.mode === 'build' && uiState.selectedItemId && uiState.hoverTile && ZS.Game.getPlacementCozyPreview) {
      const htx = uiState.hoverTile.tx;
      const hty = uiState.hoverTile.ty;
      if (htx >= 0 && hty >= 0 && htx < N && hty < N) {
        const cPrev = ZS.Game.getPlacementCozyPreview(uiState.selectedItemId, htx, hty);
        if (cPrev && (cPrev.isDiminished || cPrev.isFloorCapped || cPrev.gain > 0)) {
          const p = Iso.gridToScreen(htx + 0.5, hty + 0.5, 26);
          const label = cPrev.isFloorCapped
            ? '상한 도달'
            : cPrev.isDiminished
            ? `+${cPrev.gain} (50%)`
            : `💛+${cPrev.gain}`;
          const col = cPrev.isFloorCapped ? '#A9BCCF' : cPrev.isDiminished ? '#94A3B8' : P.gold;
          const fontPx = Math.max(11, Math.round(12 * zScale));
          ctx.font = `700 ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
          ctx.textAlign = 'center';
          ctx.strokeStyle = P.outlineDark || '#1B2430';
          ctx.lineWidth = 3;
          ctx.strokeText(label, p.x, p.y);
          ctx.fillStyle = col;
          ctx.fillText(label, p.x, p.y);
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

    // 2. Depth-sorted Structure HP Bars, ⚡OFF Warnings, and Zombie HP Bars
    const nightEyes = [];
    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        const st = item.st;
        const tx = item.tx;
        const ty = item.ty;
        const id = st.id;
        const def = id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[id];
        const isDamaged = st.hp < st.maxHp && st.hp > 0;
        const isUnpowered = state.isNight && def && def.requiresPower && !powered;

        const lv = st.level || 1;
        const hasPips = id !== 'command_hq' && lv >= 2;
        const hasRank = (st.rank || 0) >= 1;
        const topZ = id === 'command_hq'
          ? ((ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(state.hqLevel) : null)?.maxZ || 36)
          : getStructVisualTopZ(id, lv);

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

        if (isUnpowered) {
          const warnZ = isDamaged ? 35 : 29;
          const warnPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, warnZ);
          const badgeScale = Math.max(9 / 11, zScale);
          const fontPx = Math.round(11 * badgeScale);
          const pillW = 40 * badgeScale;
          const pillH = 14 * badgeScale;
          const pillY = warnPos.y - pillH + 2 * badgeScale;
          ctx.fillStyle = P.outlineDark || '#1B2430';
          ctx.fillRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);
          ctx.strokeStyle = P.danger;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(warnPos.x - pillW * 0.5, pillY, pillW, pillH);

          ctx.font = `bold ${fontPx}px 'Pretendard', 'Segoe UI', sans-serif`;
          ctx.textAlign = 'center';
          const textY = pillY + pillH * 0.5 + fontPx * 0.34;
          ctx.fillStyle = P.power;
          ctx.fillText('⚡', warnPos.x - 11.5 * badgeScale, textY);
          ctx.fillStyle = P.danger;
          ctx.fillText('OFF', warnPos.x + 5.5 * badgeScale, textY);
        }
      } else if (item.kind === 'zombie') {
        const z = item.z;
        const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;

        if (state.nightAlpha > 0.05) {
          const eyes = getZombieEyePositions(z, zDef, timeSec, zScale);
          if (!isZombieEyesOccluded(state, z, eyes, zScale)) {
            nightEyes.push({ eyes, zDef });
          }
        }

        if (z.hp < z.maxHp || zDef.isBoss) {
          const m = getZombiePoseMetrics(z, zDef, timeSec);
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
        const stamp = getEyeHaloStamp(zDef.eyeGlow || 'rgba(255, 77, 109, 0.56)');
        ctx.drawImage(stamp, eyes.cx - haloR, eyes.cy - haloR, haloR * 2, haloR * 2);
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = Math.min(1, state.nightAlpha * 1.15);
      for (let i = 0; i < nightEyes.length; i++) {
        const { eyes, zDef } = nightEyes[i];
        drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P);
      }
      ctx.restore();
    }

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
      ctx.font = `bold ${Math.round((ft.size || 12) * Math.min(1.25, Math.max(0.85, zScale)))}px 'Pretendard', 'Segoe UI', sans-serif`;
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

  return {
    render
  };
})();
