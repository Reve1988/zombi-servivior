window.ZS = window.ZS || {};

ZS.Renderer = (function () {
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');
  const eyeHaloCache = new Map();
  const thumbnailCache = new Map();
  let emissiveList = null;
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
    const isSil = !!window.ZS_SILHOUETTE_MODE;

    // 1. Background Sky / Tactical Tabletop Backdrop
    if (isSil) {
      ctx.fillStyle = '#EEF1F4';
      ctx.fillRect(0, 0, w, h);
    } else {
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
    }

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
        const tileFill = isSil ? (isEdge ? '#CBD3DB' : '#D5DBE1') : Iso.shadeHex(rawBase, cell.shadeFactor);

        if (showEditGrid && !isSil) {
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
    if (!isSil) {
      drawQuarantineBorder(ctx, N, P, showEditGrid, zScale);
    }

    // Fading zombie death ground stains (#8: drawn flat on ground above tiles/floors, below structures)
    if (!isSil && state.groundDecals && state.groundDecals.length > 0) {
      drawGroundStains(ctx, state.groundDecals, zScale);
    }

    // Subtle warm afternoon sunlight wash over the inner base during daytime
    if (!isSil && state.nightAlpha < 0.95) {
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
            if (def.aura && def.aura.radius) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.aura.radius, P.goldStroke, P.goldFill);
            }
            if (def.gateSlowRadius) {
              drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.gateSlowRadius, P.rangeStroke, 'rgba(255, 255, 255, 0.08)');
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
    const nightEmissives = state.nightAlpha > 0.02 ? [] : null;
    emissiveList = nightEmissives;

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
      } else if (item.kind === 'edge_prop') {
        emissiveList = null;
        drawPerimeterProp(ctx, item.ep, zScale);
        emissiveList = nightEmissives;
      } else if (item.kind === 'zombie') {
        const zDef = DATA.ZOMBIES[item.z.type] || DATA.ZOMBIES.walker;
        const zEyes = nightEmissives ? getZombieEyePositions(item.z, zDef, timeSec, zScale) : null;
        emissiveList = nightEmissives && zEyes && !isZombieEyesOccluded(state, item.z, zEyes, zScale) ? nightEmissives : null;
        drawZombie(ctx, item.z, timeSec, zScale, state);
        emissiveList = nightEmissives;
      } else if (item.kind === 'dying_zombie') {
        emissiveList = null;
        drawDyingZombie(ctx, item.dz, zScale);
        emissiveList = nightEmissives;
      }
    }
    emissiveList = null;

    // Creeping perimeter mist / fog band along the 4 outer edges ("outside = danger")
    if (!isSil) {
      drawPerimeterFog(ctx, N, state.nightAlpha, timeSec, zScale);
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
      drawMuzzleFlashes(ctx, state.muzzleFlashes, zScale);
    }
    drawProjectiles(ctx, state.projectiles, zScale);
    drawParticles(ctx, state.particles, zScale);

    // Warm central base glow on Cozy Tier-Up (radius 3 tiles, 0.8s)
    if (!isSil && state.cozyTierUpTimer && state.cozyTierUpTimer > 0) {
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
    if (!isSil && state.nightAlpha > 0.02) {
      drawNightLighting(ctx, w, h, state, powered, timeSec, zScale);
      if (nightEmissives && nightEmissives.length > 0) {
        drawEmissivePass(ctx, nightEmissives, state.nightAlpha, zScale);
      }
    }

    // ── Info Layer (Drawn above darkness: identical daytime brightness & contrast) ──
    // 9. Selection Outline, Structure/Zombie HP Bars, and Blackout OFF Warnings
    if (!isSil) {
      drawInfoLayer(ctx, state, uiState, renderList, statusPowered, timeSec, zScale);
    }

    // 10. Floating Texts (Damage, Loot, Buff Callouts)
    drawFloatingTexts(ctx, state.floatingTexts, zScale);

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

  function drawIsoCircle(ctx, cx, cy, radiusTiles, strokeColor, fillColor, lineDash, lineWidth) {
    const Iso = ZS.Iso;
    const steps = 48;
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
        if (def.range) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.range, P.rangeStroke, P.rangeFill);
        }
        if (def.aura && def.aura.radius) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.aura.radius, P.goldStroke, P.goldFill);
        }
        if (def.gateSlowRadius) {
          drawIsoCircle(ctx, tx + 0.5, ty + 0.5, def.gateSlowRadius, P.rangeStroke, 'rgba(255, 255, 255, 0.08)');
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
          previewObj = { id: def.id, level: 1, hp: 100, maxHp: 100, aimAngle: 0 };
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
      drawStructure(ctx, previewObj, tx, ty, state, true, timeSec, zScale);
      ctx.restore();
    } else if (previewMountHost) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      drawWallDeck(ctx, previewMountHost.wallLv, tx, ty, zScale);
      const mBaseZ = previewMountHost.wallLv >= 3 ? 25.4 : 15.2;
      drawMountedUnit(ctx, previewMountHost.unit, tx, ty, mBaseZ, state, true, timeSec, zScale);
      ctx.restore();
    }
  }

  function getStructVisualTopZ(id, level) {
    switch (id) {
      case 'barricade_wall': return level >= 3 ? 27.7 : level === 2 ? 14 : 10.9;
      case 'tactical_gate': return 26.5;
      case 'hesco_wall': return level >= 3 ? 19 : 14;
      case 'blast_wall': return level >= 3 ? 29 : 25;
      case 'razor_pad': return 6;
      case 'rifle_bunker': return level >= 3 ? 24 : 23;
      case 'shotgun_post': return 23;
      case 'sniper_tower': return 53;
      case 'vulcan_turret': return level >= 2 ? 24 : 21;
      case 'missile_pod': return 22;
      case 'emp_coil': return 35;
      case 'solar_array': return 17;
      case 'wind_turbine': return 60;
      case 'battery_bank': return 33;
      case 'field_tent': return level >= 3 ? 22 : 16;
      case 'shelter_pod': return 22;
      case 'gas_heater': return 26;
      case 'led_floodlight': return 24;
      case 'urban_planter': return 32;
      case 'vending_machine': return 23;
      case 'repair_bay': return 25;
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
    if (isEmissive && emissiveList && !window.ZS_SILHOUETTE_MODE) {
      emissiveList.push({ kind: 'poly', pts, fill, hex });
    }
  }

  function drawIsoBox(ctx, gx, gy, z, w, d, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const em = !!o.emissive;
    const zTop = z + h;
    const A = Iso.gridToScreen(gx, gy, zTop);
    const B = Iso.gridToScreen(gx + w, gy, zTop);
    const C = Iso.gridToScreen(gx + w, gy + d, zTop);
    const D = Iso.gridToScreen(gx, gy + d, zTop);
    if (h > 0) {
      const Bb = Iso.gridToScreen(gx + w, gy, z);
      const Cb = Iso.gridToScreen(gx + w, gy + d, z);
      const Db = Iso.gridToScreen(gx, gy + d, z);
      drawPolyFace(ctx, [D, C, Cb, Db], hex, 0.82, em, o.edge !== false, zScale);
      drawPolyFace(ctx, [C, B, Bb, Cb], hex, 0.66, em, o.edge !== false, zScale);
    }
    if (!o.noTop) {
      drawPolyFace(ctx, [A, B, C, D], hex, 1.0, em, o.edge !== false, zScale);
    }
  }

  function drawFrustumXY(ctx, gx, gy, z, w, d, h, ix, iy, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const em = !!o.emissive;
    const b0 = Iso.gridToScreen(gx, gy, z);
    const b1 = Iso.gridToScreen(gx + w, gy, z);
    const b2 = Iso.gridToScreen(gx + w, gy + d, z);
    const b3 = Iso.gridToScreen(gx, gy + d, z);
    const t0 = Iso.gridToScreen(gx + ix, gy + iy, z + h);
    const t1 = Iso.gridToScreen(gx + w - ix, gy + iy, z + h);
    const t2 = Iso.gridToScreen(gx + w - ix, gy + d - iy, z + h);
    const t3 = Iso.gridToScreen(gx + ix, gy + d - iy, z + h);
    drawPolyFace(ctx, [b0, b1, t1, t0], hex, 0.95, em, true, zScale);
    drawPolyFace(ctx, [b0, b3, t3, t0], hex, 0.95, em, true, zScale);
    drawPolyFace(ctx, [b3, b2, t2, t3], hex, 0.86, em, true, zScale);
    drawPolyFace(ctx, [b2, b1, t1, t2], hex, 0.70, em, true, zScale);
    if (!o.noTop) {
      drawPolyFace(ctx, [t0, t1, t2, t3], hex, 1.0, em, true, zScale);
    }
  }

  function drawFrustum(ctx, gx, gy, z, w, d, h, inset, hex, opts, zScale) {
    drawFrustumXY(ctx, gx, gy, z, w, d, h, inset, inset, hex, opts, zScale);
  }

  function calcSideShade(nx, ny) {
    const t = (ny - nx) / (Math.abs(nx) + Math.abs(ny) + 1e-6);
    return 0.74 + 0.08 * t;
  }

  function drawCyl(ctx, cx, cy, z, r, h, hex, opts, zScale) {
    const Iso = ZS.Iso;
    const o = opts || {};
    const n = o.n || 14;
    const em = !!o.emissive;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    if (!o.noSides && h > 0) {
      const sides = [];
      for (let k = 0; k < n; k++) {
        const am = ((k + 0.5) / n) * Math.PI * 2;
        const nx = Math.cos(am);
        const ny = Math.sin(am);
        if (nx + ny > -0.25) sides.push({ k, nx, ny });
      }
      sides.sort((a, b) => a.nx + a.ny - (b.nx + b.ny));
      for (let i = 0; i < sides.length; i++) {
        const s = sides[i];
        const p0 = pts[s.k];
        const p1 = pts[(s.k + 1) % n];
        drawPolyFace(
          ctx,
          [
            Iso.gridToScreen(p0[0], p0[1], z + h),
            Iso.gridToScreen(p1[0], p1[1], z + h),
            Iso.gridToScreen(p1[0], p1[1], z),
            Iso.gridToScreen(p0[0], p0[1], z)
          ],
          hex,
          calcSideShade(s.nx, s.ny),
          em,
          false,
          zScale
        );
      }
    }
    if (!o.noTop) {
      const topPts = [];
      for (let k = 0; k < n; k++) {
        topPts.push(Iso.gridToScreen(pts[k][0], pts[k][1], z + h));
      }
      drawPolyFace(ctx, topPts, hex, 1.0, em, o.topEdge !== false, zScale);
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
    if (isEmissive && emissiveList && !window.ZS_SILHOUETTE_MODE) {
      emissiveList.push({ kind: 'dot', p, r: rPx, hex, fill });
    }
  }

  function drawPowerStripCyl(ctx, cx, cy, z, r, isUnpowered, zScale) {
    const P = ZS.DATA.PALETTE;
    const col = isUnpowered ? P.powerDim : P.power;
    drawCyl(ctx, cx, cy, z, r, 1.4, col, { noTop: true, emissive: !isUnpowered, n: 16 }, zScale);
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

  function drawEmissivePass(ctx, list, nightAlpha, zScale) {
    if (!list || list.length === 0) return;
    const Iso = ZS.Iso;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
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
      const rad = 18 * zScale;
      const rgb = e.hex && e.hex[0] === '#'
        ? [parseInt(e.hex.slice(1, 3), 16), parseInt(e.hex.slice(3, 5), 16), parseInt(e.hex.slice(5, 7), 16)]
        : [255, 210, 122];
      const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
      grd.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(0.28 * nightAlpha).toFixed(3)})`);
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.35 + nightAlpha * 0.65);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.kind === 'dot') {
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
      drawIsoBox(ctx, cx - 0.04, cy - 0.19, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      drawIsoBox(ctx, cx - 0.04, cy + 0.11, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      drawIsoLine(ctx, Iso.gridToScreen(cx, cy - 0.16, 1.0), Iso.gridToScreen(cx, cy + 0.16, 10.5), wood, 2.3, true, zScale);
      drawIsoLine(ctx, Iso.gridToScreen(cx, cy + 0.16, 1.0), Iso.gridToScreen(cx, cy - 0.16, 10.5), wood, 2.3, true, zScale);
    } else {
      drawIsoBox(ctx, cx - 0.19, cy - 0.04, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      drawIsoBox(ctx, cx + 0.11, cy - 0.04, 0, 0.08, 0.08, 1.6, woodDark, null, zScale);
      drawIsoLine(ctx, Iso.gridToScreen(cx - 0.16, cy, 1.0), Iso.gridToScreen(cx + 0.16, cy, 10.5), wood, 2.3, true, zScale);
      drawIsoLine(ctx, Iso.gridToScreen(cx + 0.16, cy, 1.0), Iso.gridToScreen(cx - 0.16, cy, 10.5), wood, 2.3, true, zScale);
    }
    drawIsoBox(ctx, cx - 0.045, cy - 0.045, 4.9, 0.09, 0.09, 1.5, iron, null, zScale);
  }

  function drawWireHub(ctx, tx, ty, P, zScale) {
    const Iso = ZS.Iso;
    const wood = P.wireWood || '#8B6843';
    const woodDark = P.wireWoodDark || '#5E452B';
    const iron = P.wireIron || '#4A5562';
    drawIsoBox(ctx, tx + 0.41, ty + 0.41, 0, 0.18, 0.18, 1.6, woodDark, null, zScale);
    drawIsoBox(ctx, tx + 0.43, ty + 0.43, 1.6, 0.14, 0.14, 8.6, wood, null, zScale);
    drawIsoBox(ctx, tx + 0.42, ty + 0.42, 4.9, 0.16, 0.16, 1.6, iron, null, zScale);
    drawIsoBox(ctx, tx + 0.435, ty + 0.435, 10.2, 0.13, 0.13, 0.7, iron, null, zScale);
    drawIsoLine(ctx, Iso.gridToScreen(tx + 0.35, ty + 0.65, 0.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), wood, 2.0, true, zScale);
    drawIsoLine(ctx, Iso.gridToScreen(tx + 0.65, ty + 0.35, 0.8), Iso.gridToScreen(tx + 0.50, ty + 0.50, 9.6), wood, 2.0, true, zScale);
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

    if (axis === 'x') drawIsoBox(ctx, tx + t0, ty + 0.475, 5.1, span, 0.05, 1.1, wood, null, zScale);
    else drawIsoBox(ctx, tx + 0.475, ty + t0, 5.1, 0.05, span, 1.1, wood, null, zScale);

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
    drawIsoBox(ctx, x, y, 0, w, d, h, '#C9B48A', null, zScale);
    drawIsoBox(ctx, x + 0.035, y + 0.035, h, w - 0.07, d - 0.07, 0.6, '#9E8758', null, zScale);
    if (lv >= 2) {
      drawIsoBox(ctx, x - 0.006, y - 0.006, 4.8, w + 0.012, d + 0.012, 2.2, steelCol, { noTop: true }, zScale);
    }
    if (lv >= 3 && !skipCap) {
      drawIsoBox(ctx, x - 0.005, y - 0.005, h + 0.6, w + 0.01, d + 0.01, 1.2, maxAccent, { noTop: true }, zScale);
      drawIsoBox(ctx, x, y, h + 1.8, w, d, 2.4, steelCol, null, zScale);
    }
  }

  function drawBlastSlab(ctx, x, y, w, d, z0, z1, H, I, axis, hex, top, zScale) {
    const ix = axis === 'x' ? 0 : 1;
    const iy = axis === 'y' ? 0 : 1;
    const i0 = (I * z0) / H;
    const i1 = (I * z1) / H;
    drawFrustumXY(
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
      drawIsoBox(ctx, x + ix - 0.004, y + iy - 0.004, H, w - 2 * ix + 0.008, d - 2 * iy + 0.008, 1.3, maxAccent, { noTop: true }, zScale);
      drawIsoBox(ctx, x + ix, y + iy, H + 1.3, w - 2 * ix, d - 2 * iy, 2.4, steelCol, null, zScale);
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
    const dk = P.gatePylon || '#59636E';
    const beamCol = P.gateBeam || '#4A5562';
    const barCol = lv >= 3 ? P.thornSpark || '#FF8A3D' : P.gateBar || '#2B333D';

    const pyl = (x, y, w, d) => {
      drawIsoBox(ctx, x, y, 0, w, d, 22, dk, null, zScale);
      drawIsoBox(ctx, x - 0.004, y - 0.004, 3, w + 0.008, d + 0.008, 3, '#F0BD35', { noTop: true }, zScale);
      if (lv >= 2) {
        drawIsoBox(ctx, x - 0.004, y - 0.004, 9, w + 0.008, d + 0.008, 2.4, steelCol, { noTop: true }, zScale);
      }
      drawIsoBox(ctx, x + 0.04, y + 0.04, 22, w - 0.08, d - 0.08, 1.4, '#3E4650', null, zScale);
      drawIsoDot(ctx, Iso.gridToScreen(x + w / 2, y + d / 2, 25), 1.9, P.danger, true, zScale);
    };

    const door = () => {
      if (!alongY) {
        drawIsoBox(ctx, tx + 0.24, ty + 0.46, 0, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
        drawIsoBox(ctx, tx + 0.24, ty + 0.46, 13.4, 0.52, 0.08, 1.6, '#3E4650', null, zScale);
        for (let k = 0; k < 5; k++) {
          drawIsoBox(ctx, tx + 0.28 + k * 0.1, ty + 0.48, 1.6, 0.035, 0.04, 11.8, barCol, null, zScale);
        }
        if (lv >= 3) {
          const sx = [0.36, 0.5, 0.64];
          for (let i = 0; i < sx.length; i++) {
            drawIsoDot(ctx, Iso.gridToScreen(tx + sx[i], ty + 0.5, 5 + i * 3), 1.5, '#FFD08A', true, zScale);
          }
        }
      } else {
        drawIsoBox(ctx, tx + 0.46, ty + 0.24, 0, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
        drawIsoBox(ctx, tx + 0.46, ty + 0.24, 13.4, 0.08, 0.52, 1.6, '#3E4650', null, zScale);
        for (let k = 0; k < 5; k++) {
          drawIsoBox(ctx, tx + 0.48, ty + 0.28 + k * 0.1, 1.6, 0.04, 0.035, 11.8, barCol, null, zScale);
        }
        if (lv >= 3) {
          const sy = [0.36, 0.5, 0.64];
          for (let i = 0; i < sy.length; i++) {
            drawIsoDot(ctx, Iso.gridToScreen(tx + 0.5, ty + sy[i], 5 + i * 3), 1.5, '#FFD08A', true, zScale);
          }
        }
      }
    };

    if (!alongY) {
      pyl(tx + 0, ty + 0.30, 0.24, 0.40);
      door();
      drawIsoBox(ctx, tx + 0.24, ty + 0.38, 19, 0.52, 0.24, 3, beamCol, null, zScale);
      pyl(tx + 0.76, ty + 0.30, 0.24, 0.40);
    } else {
      pyl(tx + 0.30, ty + 0, 0.40, 0.24);
      door();
      drawIsoBox(ctx, tx + 0.38, ty + 0.24, 19, 0.24, 0.52, 3, beamCol, null, zScale);
      pyl(tx + 0.30, ty + 0.76, 0.40, 0.24);
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
      drawIsoBox(ctx, tx + 0.27, ty + 0.27, 14, 0.46, 0.46, 1.2, '#8A6A45', null, zScale);
      drawIsoBox(ctx, tx + 0.27, ty + 0.27, 15.2, 0.46, 0.03, 3.2, '#6E5536', null, zScale);
      drawIsoBox(ctx, tx + 0.27, ty + 0.27, 15.2, 0.03, 0.46, 3.2, '#6E5536', null, zScale);
    } else {
      drawIsoBox(ctx, tx + 0.25, ty + 0.25, 24, 0.50, 0.50, 1.4, '#4A5562', null, zScale);
      drawIsoBox(ctx, tx + 0.25, ty + 0.25, 25.4, 0.50, 0.03, 3.4, '#3A434E', null, zScale);
      drawIsoBox(ctx, tx + 0.25, ty + 0.25, 25.4, 0.03, 0.50, 3.4, '#3A434E', null, zScale);
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
    let prevEmissives = emissiveList;
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
      emissiveList = null;
    }

    Iso.setEntityFlash(unit.hitFlash || 0);

    switch (unit.id) {
      case 'rifle_bunker': {
        const rh = lv >= 3 ? 5.5 : 4;
        drawSandbagRing(ctx, cx, cy, baseZ, 0.22, rh, 'back', zScale);
        drawOperatorFigure(ctx, cx, cy, baseZ + 0.4, '#55684F', '#3E4D3A', aim, zScale, false, lv >= 3);
        drawSandbagRing(ctx, cx, cy, baseZ, 0.22, rh, 'front', zScale);
        if (lv >= 2) {
          drawCyl(ctx, cx, cy, baseZ + (lv >= 3 ? 4.3 : 2.8), 0.224, 1.2, steelCol, { noTop: true, n: 16 }, zScale);
        }
        break;
      }

      case 'shotgun_post': {
        drawOperatorFigure(ctx, cx, cy - 0.04, baseZ + 0.3, '#3A4654', '#2F3945', aim, zScale, false, false);
        drawIsoBox(ctx, tx + 0.30, ty + 0.68, baseZ, 0.40, 0.05, 11, '#3A4654', null, zScale);
        drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 7, 0.406, 0.056, 1.8, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
        if (lv >= 2) {
          drawIsoBox(ctx, tx + 0.297, ty + 0.677, baseZ + 3.0, 0.406, 0.056, 1.6, steelCol, { noTop: true }, zScale);
        }
        drawIsoBox(ctx, tx + 0.44, ty + 0.677, baseZ + 9, 0.12, 0.056, 1.1, '#1B2430', { noTop: true }, zScale);
        break;
      }

      case 'vulcan_turret': {
        drawCyl(ctx, cx, cy, baseZ, 0.20, 3, '#4E5A68', { n: 16 }, zScale);
        drawPowerStripCyl(ctx, cx, cy, baseZ + 1.8, 0.204, isUnpowered, zScale);
        let domeZ = baseZ + 3;
        if (lv >= 2) {
          drawCyl(ctx, cx, cy, domeZ, 0.18, 1.4, steelCol, { n: 16 }, zScale);
          domeZ += 1.4;
        }
        drawDome(ctx, cx, cy, domeZ, 0.17, 9, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
        const px = -Math.sin(aim);
        const py = Math.cos(aim);
        const len = lv >= 3 ? 0.46 : 0.40;
        for (let k = -1; k <= 1; k++) {
          const ox = cx + px * 0.028 * k;
          const oy = cy + py * 0.028 * k;
          drawIsoLine(
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
          drawIsoDot(ctx, mid, 2.0, isUnpowered ? P.powerDim : P.power, !isUnpowered, zScale);
        }
        break;
      }

      case 'led_floodlight': {
        drawCyl(ctx, cx, cy, baseZ, 0.11, 2, '#59636E', { n: 12 }, zScale);
        drawPowerStripCyl(ctx, cx, cy, baseZ + 0.6, 0.114, isUnpowered, zScale);
        drawIsoBox(ctx, cx - 0.025, cy - 0.025, baseZ + 2, 0.05, 0.05, 9, lv >= 2 ? steelCol : '#8A99A8', null, zScale);
        drawIsoBox(ctx, tx + 0.34, ty + 0.40, baseZ + 11, 0.32, 0.20, 5, '#59636E', null, zScale);
        drawIsoBox(ctx, tx + 0.36, ty + 0.595, baseZ + 12, 0.28, 0.012, 3.2, isUnpowered ? '#4B5563' : '#FFF6DA', { emissive: !isUnpowered }, zScale);
        break;
      }
    }

    Iso.setEntityFlash(0);
    if (hasMountAnim) {
      ctx.restore();
      emissiveList = prevEmissives;
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
    let prevEmissives = emissiveList;
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
      emissiveList = null;
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
      emissiveList = null;
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
          drawIsoBox(ctx, cx, cy, 0.5, s, s, h, '#C9B48A', null, zScale);
          drawIsoBox(ctx, cx + 0.05, cy + 0.05, 0.5 + h, s - 0.10, s - 0.10, 0.6, '#9E8758', null, zScale);
          if (lv >= 2) {
            drawIsoBox(ctx, cx - 0.006, cy - 0.006, 4.8, s + 0.012, s + 0.012, 2.2, steelCol, { noTop: true }, zScale);
          }
        }
        if (lv >= 3) {
          drawIsoBox(ctx, tx + 0.055, ty + 0.055, 0.5 + h + 0.6, 0.89, 0.89, 1.2, maxAccent, { noTop: true }, zScale);
          drawIsoBox(ctx, tx + 0.06, ty + 0.06, 0.5 + h + 1.8, 0.88, 0.88, 2.4, steelCol, null, zScale);
        }
        break;
      }

      case 'blast_wall': {
        // Trapezoidal T-wall frustum + amber hazard stripe + Lv.2 steel band + Lv.3 shock-reflect armor crown
        drawFrustum(ctx, tx + 0.06, ty + 0.06, 0.5, 0.88, 0.88, 24, 0.21, '#6B7686', null, zScale);
        const i4 = (0.21 * 4) / 24;
        const i8 = (0.21 * 8) / 24;
        drawFrustum(ctx, tx + 0.06 + i4, ty + 0.06 + i4, 4.5, 0.88 - 2 * i4, 0.88 - 2 * i4, 4, i8 - i4, '#F0BD35', { noTop: true }, zScale);
        if (lv >= 2) {
          const i12 = (0.21 * 12) / 24;
          const i15 = (0.21 * 15) / 24;
          drawFrustum(ctx, tx + 0.055 + i12, ty + 0.055 + i12, 12.5, 0.89 - 2 * i12, 0.89 - 2 * i12, 3, i15 - i12, steelCol, { noTop: true }, zScale);
        }
        if (lv >= 3) {
          drawIsoBox(ctx, tx + 0.23, ty + 0.23, 24.5, 0.54, 0.54, 1.3, maxAccent, { noTop: true }, zScale);
          drawIsoBox(ctx, tx + 0.24, ty + 0.24, 25.8, 0.52, 0.52, 2.4, steelCol, null, zScale);
        }
        break;
      }

      case 'razor_pad': {
        // Ground-level metal plate + 3 razor wire coils (passable trap)
        drawIsoBox(ctx, tx + 0.10, ty + 0.10, 0.4, 0.80, 0.80, 2, lv >= 2 ? '#596574' : '#4A525C', null, zScale);
        const c = Iso.gridToScreen(tx + 0.5, ty + 0.5, 4.2);
        ctx.strokeStyle = Iso.resolveFaceColor(lv >= 3 ? maxAccent : '#C9D3DE', 1.0, false, 0);
        ctx.lineWidth = (lv >= 3 ? 1.8 : 1.4) * zScale;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.ellipse(c.x + k * 8.5 * zScale, c.y, 6.8 * zScale, 4.4 * zScale, 0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'rifle_bunker': {
        // Round sandbag ring + entrenched 2.2-head rifleman (unmistakable circular pit silhouette)
        const rh = lv >= 3 ? 10 : 7;
        drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'back', zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 2.2, '#55684F', '#3E4D3A', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, lv >= 3);
        drawSandbagRing(ctx, tx + 0.5, ty + 0.5, 0.5, 0.40, rh, 'front', zScale);
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5 + rh - 1.6, 0.406, 1.6, steelCol, { noTop: true, n: 16 }, zScale);
        }
        break;
      }

      case 'shotgun_post': {
        // Compact sandbag ring + tall front ballistic shield plate with amber band & vision slit
        drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'back', zScale);
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.44, 1.8, '#3A4654', '#2F3945', st.aimAngle != null ? st.aimAngle : 0.8, zScale, false, false);
        drawSandbagRing(ctx, tx + 0.5, ty + 0.44, 0.5, 0.34, 6, 'front', zScale);
        drawIsoBox(ctx, tx + 0.16, ty + 0.80, 0.5, 0.68, 0.07, 17, '#3A4654', null, zScale);
        drawIsoBox(ctx, tx + 0.155, ty + 0.795, 11.5, 0.69, 0.08, 2.2, lv >= 3 ? maxAccent : '#EBA834', { noTop: true }, zScale);
        if (lv >= 2) {
          drawIsoBox(ctx, tx + 0.155, ty + 0.795, 4.5, 0.69, 0.08, 2.0, steelCol, { noTop: true }, zScale);
        }
        drawIsoBox(ctx, tx + 0.42, ty + 0.795, 14.1, 0.16, 0.08, 1.4, '#1B2430', { noTop: true }, zScale);
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
          drawIsoBox(ctx, tx + legs[i][0], ty + legs[i][1], 0.5, 0.08, 0.08, 24, '#7C8B99', null, zScale);
        }
        drawIsoLine(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.84, 2.5), Iso.gridToScreen(tx + 0.80, ty + 0.84, 21.5), '#5B6875', 1.15, false, zScale);
        drawIsoLine(ctx, Iso.gridToScreen(tx + 0.18, ty + 0.84, 21.5), Iso.gridToScreen(tx + 0.80, ty + 0.84, 2.5), '#5B6875', 1.15, false, zScale);
        drawIsoLine(ctx, Iso.gridToScreen(tx + 0.84, ty + 0.18, 2.5), Iso.gridToScreen(tx + 0.84, ty + 0.80, 21.5), '#5B6875', 1.15, false, zScale);
        drawIsoLine(ctx, Iso.gridToScreen(tx + 0.84, ty + 0.18, 21.5), Iso.gridToScreen(tx + 0.84, ty + 0.80, 2.5), '#5B6875', 1.15, false, zScale);
        drawIsoBox(ctx, tx + 0.08, ty + 0.08, 24.5, 0.84, 0.84, 3, lv >= 2 ? steelCol : '#6C7B8B', null, zScale);
        const backPosts = [
          [0.10, 0.10],
          [0.86, 0.10],
          [0.10, 0.86]
        ];
        for (let i = 0; i < backPosts.length; i++) {
          drawIsoBox(ctx, tx + backPosts[i][0], ty + backPosts[i][1], 27.5, 0.04, 0.04, 18, '#5B6875', null, zScale);
        }
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 27.5, '#3D4D42', '#2F3B33', st.aimAngle != null ? st.aimAngle : 0.8, zScale, true, false);
        drawIsoBox(ctx, tx + 0.86, ty + 0.86, 27.5, 0.04, 0.04, 18, '#5B6875', null, zScale);
        drawHipRoof(ctx, tx + 0.04, ty + 0.04, 45.5, 0.92, 0.92, 7, '#4F5D4B', zScale);
        if (lv >= 3) {
          drawIsoDot(ctx, Iso.gridToScreen(tx + 0.5, ty + 0.5, 53.0), 2.3, maxAccent, true, zScale);
        }
        break;
      }

      case 'vulcan_turret': {
        // Circular pedestal + cyan power strip + white CIWS radar dome + rotating tri-barrel gatling
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 7, '#4E5A68', { n: 16 }, zScale);
        drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.9, 0.366, isUnpowered, zScale);
        let z0 = 7.5;
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.32, 2.6, steelCol, { n: 16 }, zScale);
          z0 = 10.1;
        }
        drawDome(ctx, tx + 0.5, ty + 0.5, z0, 0.26, 13, isUnpowered ? '#8B949E' : '#E8EEF4', { n: 16 }, zScale);
        const aim = st.aimAngle != null ? st.aimAngle : 0.8;
        const len = lv >= 3 ? 0.62 : 0.50;
        const px = -Math.sin(aim);
        const py = Math.cos(aim);
        for (let k = -1; k <= 1; k++) {
          const ox = tx + 0.5 + px * 0.035 * k;
          const oy = ty + 0.5 + py * 0.035 * k;
          drawIsoLine(
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
          drawIsoDot(ctx, mid, 2.5, isUnpowered ? P.powerDim : P.power, !isUnpowered, zScale);
        }
        break;
      }

      case 'missile_pod': {
        // Circular pedestal + cyan power strip + tilted 4-tube MLRS rocket pod (angled rack silhouette)
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.36, 6.5, '#4C574A', { n: 16 }, zScale);
        drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 5.4, 0.366, isUnpowered, zScale);
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 7.0, 0.31, 1.8, steelCol, { n: 16 }, zScale);
        }
        // Tilted MLRS pod body (rises forward from z=8.5 back to z=13.5 front)
        const podCol = isUnpowered ? '#596159' : '#6C7D65';
        const x0 = tx + 0.21, x1 = tx + 0.79, y0 = ty + 0.20, y1 = ty + 0.76;
        const bA = Iso.gridToScreen(x0, y0, 8.2), bB = Iso.gridToScreen(x1, y0, 8.2);
        const bC = Iso.gridToScreen(x1, y1, 12.0), bD = Iso.gridToScreen(x0, y1, 12.0);
        const tA = Iso.gridToScreen(x0, y0, 17.5), tB = Iso.gridToScreen(x1, y0, 17.5);
        const tC = Iso.gridToScreen(x1, y1, 21.8), tD = Iso.gridToScreen(x0, y1, 21.8);
        drawPolyFace(ctx, [tD, tC, bC, bD], podCol, 0.82, false, true, zScale);
        drawPolyFace(ctx, [tC, tB, bB, bC], podCol, 0.66, false, true, zScale);
        drawPolyFace(ctx, [tA, tB, tC, tD], lv >= 3 ? maxAccent : podCol, 1.0, false, true, zScale);

        const tubeXs = [0.35, 0.61];
        const tubeZs = [14.6, 19.0];
        for (let ix = 0; ix < tubeXs.length; ix++) {
          for (let iz = 0; iz < tubeZs.length; iz++) {
            const c = Iso.gridToScreen(tx + tubeXs[ix], ty + 0.765, tubeZs[iz]);
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 3.1 * zScale, 2.7 * zScale, 0, 0, Math.PI * 2);
            ctx.fillStyle = Iso.resolveFaceColor('#20261D', 1.0, false, 0);
            ctx.fill();
            drawIsoDot(ctx, c, 1.3, isUnpowered ? '#5A3A32' : '#E0603A', !isUnpowered, zScale);
          }
        }
        break;
      }

      case 'emp_coil': {
        // Circular pedestal + cyan power strip + slender pylon + copper coil rings + glowing cyan energy orb
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.32, 6, '#3E4A59', { n: 16 }, zScale);
        drawPowerStripCyl(ctx, tx + 0.5, ty + 0.5, 4.9, 0.326, isUnpowered, zScale);
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 6.5, 0.25, 1.8, steelCol, { n: 14 }, zScale);
        }
        drawCyl(ctx, tx + 0.5, ty + 0.5, 6.5, 0.09, 20, '#60748A', { n: 10 }, zScale);
        const coilZs = lv >= 3 ? [9.5, 13.5, 17.5, 21.5] : [10.5, 15.5, 20.5];
        for (let r = 0; r < coilZs.length; r++) {
          drawCyl(
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
        drawBlob(ctx, tx + 0.5, ty + 0.5, 25.5, 0.14 * pulse, 9, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, n: 14 }, zScale);
        break;
      }

      case 'solar_array': {
        // Center pedestal + tilted photovoltaic panel (z=15 back -> z=8 front) + cell grid lines
        drawIsoBox(ctx, tx + 0.44, ty + 0.44, 0.5, 0.12, 0.12, 9, lv >= 2 ? steelCol : '#7B8996', null, zScale);
        const a = Iso.gridToScreen(tx + 0.06, ty + 0.12, 15.5);
        const b = Iso.gridToScreen(tx + 0.94, ty + 0.12, 15.5);
        const c = Iso.gridToScreen(tx + 0.94, ty + 0.88, 8.5);
        const d = Iso.gridToScreen(tx + 0.06, ty + 0.88, 8.5);
        const cB = Iso.gridToScreen(tx + 0.94, ty + 0.88, 7.0);
        const dB = Iso.gridToScreen(tx + 0.06, ty + 0.88, 7.0);
        const bB = Iso.gridToScreen(tx + 0.94, ty + 0.12, 14.0);
        drawPolyFace(ctx, [d, c, cB, dB], lv >= 3 ? maxAccent : '#A9B6C4', 0.82, false, true, zScale);
        drawPolyFace(ctx, [c, b, bB, cB], lv >= 3 ? maxAccent : '#A9B6C4', 0.66, false, true, zScale);
        drawPolyFace(ctx, [a, b, c, d], '#2466B5', 1.0, false, true, zScale);

        ctx.strokeStyle = Iso.resolveFaceColor('#6E9FE0', 1.0, false, 0);
        ctx.lineWidth = Math.max(0.75, 0.9 * zScale);
        const splits = [1 / 3, 2 / 3];
        for (let i = 0; i < splits.length; i++) {
          const sx = tx + 0.06 + 0.88 * splits[i];
          const p1 = Iso.gridToScreen(sx, ty + 0.12, 15.5);
          const p2 = Iso.gridToScreen(sx, ty + 0.88, 8.5);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        const m1 = Iso.gridToScreen(tx + 0.06, ty + 0.50, 12.0);
        const m2 = Iso.gridToScreen(tx + 0.94, ty + 0.50, 12.0);
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
        ctx.stroke();
        break;
      }

      case 'wind_turbine': {
        // Tallest & slenderest silhouette (h=60): pedestal + cylindrical mast + nacelle + 3 rotor blades
        drawIsoBox(ctx, tx + 0.36, ty + 0.36, 0.5, 0.28, 0.28, 4, '#758594', null, zScale);
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 4.5, 0.11, 2.4, steelCol, { n: 12 }, zScale);
        }
        drawCyl(ctx, tx + 0.5, ty + 0.5, 4.5, 0.058, 42, '#EEF3F8', { n: 10 }, zScale);
        drawIsoBox(ctx, tx + 0.42, ty + 0.36, 46.5, 0.16, 0.28, 5, '#D0DBE6', null, zScale);
        const hub = Iso.gridToScreen(tx + 0.5, ty + 0.66, 49.0);
        const bladeAngle = timeSec * 2.6 + (tx + ty);
        for (let b = 0; b < 3; b++) {
          const a = bladeAngle + (b * Math.PI * 2) / 3;
          const tip = { x: hub.x + Math.cos(a) * 23 * zScale, y: hub.y + Math.sin(a) * 23 * zScale };
          drawIsoLine(ctx, hub, tip, '#F5F9FC', 2.7, true, zScale);
          if (lv >= 3) {
            drawIsoDot(ctx, tip, 2.0, maxAccent, false, zScale);
          }
        }
        drawIsoDot(ctx, hub, 3.0, '#C7D2DD', false, zScale);
        break;
      }

      case 'battery_bank': {
        // Tall narrow twin ESS cabinets with wide center gap (unmistakable split-pillar silhouette)
        const ratio = Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0.75));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        const barSlots = lv >= 3 ? 5 : 4;
        const litSlots = ratio > 0.01 ? Math.max(1, Math.round(ratio * barSlots)) : 0;
        const stepZ = 22.4 / barSlots;
        const cabXs = [0.14, 0.58];
        for (let c = 0; c < cabXs.length; c++) {
          const cx = tx + cabXs[c];
          drawIsoBox(ctx, cx, ty + 0.32, 0.5, 0.24, 0.34, 30, '#DDE5EC', null, zScale);
          drawIsoBox(ctx, cx + 0.03, ty + 0.35, 30.5, 0.18, 0.28, 1.8, lv >= 3 ? maxAccent : '#9AA8B6', null, zScale);
          if (lv >= 2) {
            drawIsoBox(ctx, cx - 0.008, ty + 0.312, 2.2, 0.256, 0.356, 2.2, steelCol, { noTop: true }, zScale);
          }
          for (let k = 0; k < barSlots; k++) {
            const isLit = k < litSlots;
            drawIsoBox(
              ctx,
              cx + 0.04,
              ty + 0.655,
              5.2 + k * stepZ,
              0.16,
              0.014,
              stepZ * 0.64,
              isLit ? ledColor : P.powerDim,
              { emissive: isLit },
              zScale
            );
          }
        }
        break;
      }

      case 'field_tent': {
        // Hemispherical olive dome tent + warm glowing triangular entrance flap
        drawDome(ctx, tx + 0.5, ty + 0.5, 0.5, 0.42, 15, '#6E8466', { n: 16 }, zScale);
        if (lv >= 2) {
          drawCyl(ctx, tx + 0.5, ty + 0.5, 1.2, 0.425, 1.8, steelCol, { noTop: true, n: 16 }, zScale);
        }
        drawPolyFace(
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
        drawPolyFace(
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
        if (lv >= 3) {
          drawIsoLine(
            ctx,
            Iso.gridToScreen(tx + 0.66, ty + 0.34, 13.5),
            Iso.gridToScreen(tx + 0.66, ty + 0.34, 21.5),
            '#CBD5E1',
            1.3,
            false,
            zScale
          );
          drawIsoDot(ctx, Iso.gridToScreen(tx + 0.66, ty + 0.34, 22.0), 1.8, maxAccent, true, zScale);
        }
        break;
      }

      case 'shelter_pod': {
        // Modular container shelter + orange pitched gable roof + warm window & door
        drawIsoBox(ctx, tx + 0.06, ty + 0.14, 0.5, 0.88, 0.72, 13, '#DCE5ED', null, zScale);
        if (lv >= 2) {
          drawIsoBox(ctx, tx + 0.055, ty + 0.135, 2.2, 0.89, 0.73, 2.1, steelCol, { noTop: true }, zScale);
        }
        drawGable(ctx, tx + 0.03, ty + 0.11, 13.5, 0.94, 0.78, 8, '#EA6A3B', '#DCE5ED', zScale);
        drawIsoBox(ctx, tx + 0.18, ty + 0.86, 4.5, 0.46, 0.015, 5, P.baseLight, { emissive: true }, zScale);
        drawIsoBox(ctx, tx + 0.72, ty + 0.86, 0.5, 0.13, 0.015, 9, '#556370', null, zScale);
        if (lv >= 3) {
          drawIsoBox(ctx, tx + 0.935, ty + 0.28, 5.0, 0.015, 0.38, 5, P.baseLight, { emissive: true }, zScale);
        }
        break;
      }

      case 'gas_heater': {
        // Mushroom-hood outdoor gas patio heater + glowing amber flame column (unpowered)
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.14, 2, '#5D6873', { n: 12 }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 2.5, 0.045, 17, '#9AA6B2', { n: 8 }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.08, 8, '#FFB347', { emissive: true, n: 10 }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 19.5, 0.30, 1.5, '#D5DEE7', { n: 16 }, zScale);
        drawCone(ctx, tx + 0.5, ty + 0.5, 21.0, 0.30, 4, '#D5DEE7', { n: 16 }, zScale);
        break;
      }

      case 'led_floodlight': {
        // Yellow tactical tripod + cyan power band + floodlight lamp head
        const top = Iso.gridToScreen(tx + 0.5, ty + 0.5, 15.5);
        drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.55, ty + 0.16, 0.5), '#EBA834', 1.8, true, zScale);
        drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.84, ty + 0.66, 0.5), '#EBA834', 1.8, true, zScale);
        drawIsoBox(ctx, tx + 0.28, ty + 0.38, 15.3, 0.44, 0.26, 1.3, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, noTop: true }, zScale);
        drawIsoBox(ctx, tx + 0.28, ty + 0.38, 16.5, 0.44, 0.26, 7, '#59636E', null, zScale);
        drawIsoBox(ctx, tx + 0.31, ty + 0.635, 17.5, 0.38, 0.015, 5, isUnpowered ? '#4B5563' : '#FFF6DA', { emissive: !isUnpowered }, zScale);
        drawIsoLine(ctx, top, Iso.gridToScreen(tx + 0.18, ty + 0.78, 0.5), '#EBA834', 1.8, true, zScale);
        break;
      }

      case 'urban_planter': {
        // Cylindrical concrete pot + soil + rounded organic lush tree canopy
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.30, 7, '#B8C0C7', { n: 16 }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.26, 0.02, '#5E493A', { n: 16, noSides: true, topEdge: false }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.045, 6, '#6B4A33', { n: 8 }, zScale);
        drawBlob(ctx, tx + 0.5, ty + 0.5, 12.5, 0.32, 15, '#5DBB63', { n: 14 }, zScale);
        drawBlob(ctx, tx + 0.52, ty + 0.48, 22.5, 0.20, 9, '#77D27A', { n: 12 }, zScale);
        break;
      }

      case 'vending_machine': {
        // Vertical smart drink cabinet + warm glowing showcase window + coin slot & pickup bin
        drawIsoBox(ctx, tx + 0.24, ty + 0.27, 0.5, 0.52, 0.46, 22, '#2E86DE', null, zScale);
        drawIsoBox(ctx, tx + 0.28, ty + 0.725, 8.5, 0.30, 0.015, 11, '#FFF3D6', { emissive: true }, zScale);
        drawIsoBox(ctx, tx + 0.62, ty + 0.725, 10.5, 0.08, 0.015, 6, '#1B4F86', null, zScale);
        drawIsoBox(ctx, tx + 0.30, ty + 0.725, 3.0, 0.32, 0.015, 3, '#14365C', null, zScale);
        break;
      }

      case 'repair_bay': {
        // Hazard-rimmed pad + articulated robotic arm + glowing green repair head
        drawIsoBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 3, '#475361', null, zScale);
        drawIsoBox(ctx, tx + 0.07, ty + 0.07, 0.5, 0.86, 0.86, 1.2, '#F0A93A', { noTop: true }, zScale);
        drawCyl(ctx, tx + 0.32, ty + 0.32, 3.5, 0.11, 5, '#5D6B7A', { n: 12 }, zScale);
        const a = Iso.gridToScreen(tx + 0.32, ty + 0.32, 8.5);
        const b = Iso.gridToScreen(tx + 0.46, ty + 0.42, 22.5);
        const c = Iso.gridToScreen(tx + 0.66, ty + 0.62, 15.5 + Math.sin(timeSec * 3.2) * 0.8);
        drawIsoLine(ctx, a, b, '#F0A93A', 3.2, true, zScale);
        drawIsoLine(ctx, b, c, '#F0A93A', 3.2, true, zScale);
        drawIsoDot(ctx, b, 2.2, '#5D6B7A', false, zScale);
        drawIsoDot(ctx, c, 2.6, P.heal, true, zScale);
        break;
      }

      case 'lounge_set': {
        // Striped conical parasol + round patio table + 2 lounge stools
        drawIsoBox(ctx, tx + 0.16, ty + 0.58, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        drawIsoBox(ctx, tx + 0.62, ty + 0.18, 0.5, 0.16, 0.16, 5, '#C9D3DD', null, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 0.5, 0.17, 7, '#E8EEF5', { n: 16 }, zScale);
        drawCyl(ctx, tx + 0.5, ty + 0.5, 7.5, 0.025, 15, '#A0AEC0', { n: 6 }, zScale);
        drawCone(ctx, tx + 0.5, ty + 0.5, 21.5, 0.44, 6, '#F4E6C8', { alt: '#E8A04A', n: 12 }, zScale);
        break;
      }

      case 'arcade_neon': {
        // Protruding control deck + overhanging top marquee ('ㄷ' side profile) + cyan power band
        drawIsoBox(ctx, tx + 0.255, ty + 0.215, 1.4, 0.49, 0.45, 1.3, isUnpowered ? P.powerDim : P.power, { emissive: !isUnpowered, noTop: true }, zScale);
        drawIsoBox(ctx, tx + 0.26, ty + 0.22, 0.5, 0.48, 0.44, 20, '#3A2C54', null, zScale);
        drawIsoBox(ctx, tx + 0.27, ty + 0.66, 0.5, 0.46, 0.20, 9, '#2B2040', null, zScale);
        drawIsoBox(ctx, tx + 0.29, ty + 0.855, 2.5, 0.42, 0.015, 5, isUnpowered ? '#4D3B59' : '#FF5CE1', { emissive: !isUnpowered }, zScale);
        drawIsoBox(ctx, tx + 0.30, ty + 0.655, 10.5, 0.40, 0.015, 8, isUnpowered ? '#354856' : '#52E8FF', { emissive: !isUnpowered }, zScale);
        drawIsoBox(ctx, tx + 0.24, ty + 0.20, 20.5, 0.52, 0.62, 2, '#2B2040', null, zScale);
        drawIsoBox(ctx, tx + 0.25, ty + 0.81, 21.0, 0.50, 0.015, 3.4, isUnpowered ? '#4D3B59' : '#C742E8', { emissive: !isUnpowered }, zScale);
        drawIsoBox(ctx, tx + 0.26, ty + 0.22, 22.5, 0.48, 0.30, 4, '#3A2C54', null, zScale);
        break;
      }

      case 'boss_trophy': {
        // Tapered dark pedestal + gold trim + levitating golden octahedron hologram
        drawFrustum(ctx, tx + 0.18, ty + 0.18, 0.5, 0.64, 0.64, 10, 0.06, '#2E3744', null, zScale);
        drawIsoBox(ctx, tx + 0.24, ty + 0.24, 10.5, 0.52, 0.52, 1.5, '#D4AF37', null, zScale);
        const bobZ = 25.5 + Math.sin(timeSec * 3.2) * 1.8;
        drawOctahedron(ctx, tx + 0.5, ty + 0.5, bobZ, 0.14, 9, '#FFE066', true, zScale);
        break;
      }
    }

    Iso.setEntityFlash(0);
    if (hasBuildTransform) {
      ctx.restore();
      emissiveList = prevEmissives;
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
      drawCyl(ctx, tx + 0.5, ty + 0.5, zb, 0.45, 5, '#B5A27A', { n: 18 }, zScale);
      drawIsoBox(ctx, tx + 0.20, ty + 0.22, zb, 0.60, 0.54, 12, '#7D8B6A', null, zScale);
      drawCyl(ctx, tx + 0.5, ty + 0.5, zb, 0.45, 5, '#B5A27A', { n: 18, noTop: true }, zScale);
      drawIsoBox(ctx, tx + 0.30, ty + 0.76, zb + 4.8, 0.24, 0.015, 4, P.baseLight, { emissive: true }, zScale);
      drawIsoLine(
        ctx,
        Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 12),
        Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 34),
        '#C8D0D8',
        1.4,
        false,
        zScale
      );
      const blinkOn = Math.sin(timeSec * 4.5) > -0.25;
      drawIsoDot(ctx, Iso.gridToScreen(tx + 0.70, ty + 0.30, zb + 35), 2.2, blinkOn ? P.baseLight : '#B8893A', blinkOn, zScale);
      return;
    }

    if (lv === 2) {
      // Lv.2 전술 작전 본부: body 0.84x0.84 h16 (#5B6B7C) + #FFD27A window band + bridge 0.6x0.6 h6 (#C9D3DD) + radar + LMG (0.32 tiles)
      drawIsoBox(ctx, tx + 0.08, ty + 0.08, zb, 0.84, 0.84, 16, '#5B6B7C', null, zScale);
      drawIsoBox(ctx, tx + 0.075, ty + 0.075, zb + 9, 0.85, 0.85, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
      drawIsoBox(ctx, tx + 0.20, ty + 0.20, zb + 16, 0.60, 0.60, 6, '#C9D3DD', null, zScale);
      drawIsoLine(
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

      drawCyl(ctx, tx + 0.62, ty + 0.62, zb + 22, 0.08, 3, '#3B4552', { n: 12 }, zScale);
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 24, aim, 0.32, 1, 2.2, '#1F242B', zScale);
      return;
    }

    if (lv === 3) {
      // Lv.3 통합 요새 사령부: sloped armor skirt 0.96 h8 (#4A5562) + body 0.76 h16 + #FFD27A band + bridge 0.56 h7 + #FFF6DA searchlight + HMG twin barrels
      drawFrustum(ctx, tx + 0.02, ty + 0.02, zb, 0.96, 0.96, 8, 0.06, '#4A5562', null, zScale);
      drawIsoBox(ctx, tx + 0.12, ty + 0.12, zb + 8, 0.76, 0.76, 16, '#5B6B7C', null, zScale);
      drawIsoBox(ctx, tx + 0.115, ty + 0.115, zb + 15, 0.77, 0.77, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
      drawIsoBox(ctx, tx + 0.22, ty + 0.22, zb + 24, 0.56, 0.56, 7, '#DCE4EC', null, zScale);
      drawIsoBox(ctx, tx + 0.26, ty + 0.30, zb + 31, 0.12, 0.10, 3, '#59636E', null, zScale);
      drawIsoBox(ctx, tx + 0.26, ty + 0.40, zb + 31.5, 0.12, 0.015, 2, '#FFF6DA', { emissive: true }, zScale);
      drawCyl(ctx, tx + 0.62, ty + 0.62, zb + 31, 0.10, 3.5, '#3B4552', { n: 12 }, zScale);
      drawHqRoofBarrels(ctx, tx + 0.62, ty + 0.62, zb + 33.5, aim, 0.38, 2, 2.4, '#1F242B', zScale);
      return;
    }

    // Lv.4 이지스 코어 사령부: sloped full-tile skirt + #F0BD35 hazard band + body + 2nd tower + 2 #FFD27A bands + white Aegis dome + heavy twin barrels + #FFF3D6 core beacon
    drawFrustum(ctx, tx, ty, zb, 1.0, 1.0, 10, 0.07, '#3F4955', null, zScale);
    const i3 = (0.07 * 3) / 10;
    const i5 = (0.07 * 5) / 10;
    drawFrustum(ctx, tx + i3, ty + i3, zb + 3, 1.0 - 2 * i3, 1.0 - 2 * i3, 2, i5 - i3, '#F0BD35', { noTop: true }, zScale);
    drawIsoBox(ctx, tx + 0.10, ty + 0.10, zb + 10, 0.80, 0.80, 18, '#5B6B7C', null, zScale);
    drawIsoBox(ctx, tx + 0.095, ty + 0.095, zb + 19, 0.81, 0.81, 3, P.baseLight, { emissive: true, noTop: true }, zScale);
    drawIsoBox(ctx, tx + 0.20, ty + 0.20, zb + 28, 0.60, 0.60, 8, '#DCE4EC', null, zScale);
    drawIsoBox(ctx, tx + 0.195, ty + 0.195, zb + 33, 0.61, 0.61, 1.5, P.baseLight, { emissive: true, noTop: true }, zScale);
    drawDome(ctx, tx + 0.50, ty + 0.50, zb + 36, 0.22, 9, '#EEF3F8', { n: 16 }, zScale);
    drawHqRoofBarrels(ctx, tx + 0.50, ty + 0.50, zb + 40, aim, 0.48, 2, 3.4, '#1F242B', zScale);
    drawIsoDot(ctx, Iso.gridToScreen(tx + 0.50, ty + 0.50, zb + 46.5), 3.2, '#FFF3D6', true, zScale);
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
        drawBlob(ctx, p.cx, p.cy, p.z, p.r, p.h, p.hex, p.opts, sc);
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
            drawIsoDot(ctx, sp, 1.4, p.opts.spotColor || '#C8F542', true, sc);
          }
        }
      } else if (p.opts && p.opts.emissive && p.opts.base) {
        drawIsoBox(ctx, p.x, p.y, p.z, p.w, p.d, p.h, p.opts.base, { emissive: true, edge: false }, sc);
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

  function getZombiePoseMetrics(z, zDef, timeSec) {
    const sc = zDef.scale || 1.0;
    const type = z.type || 'walker';
    const freq = type === 'runner'
      ? 12.5
      : type === 'leaper'
      ? 13.0
      : type === 'brute'
      ? 5.8
      : type === 'shocker'
      ? 6.4
      : zDef.isBoss
      ? 4.8
      : 7.8;
    const stride = z.leapState ? 0 : Math.sin(timeSec * freq + (z.seed || 0));
    const bobAmp = type === 'runner'
      ? 1.8
      : type === 'leaper'
      ? 1.9
      : type === 'brute'
      ? 1.6
      : type === 'spitter'
      ? 1.8
      : 2.1;
    const bob = z.leapState ? 0 : Math.abs(stride) * bobAmp;

    let leapLift = 0;
    let crouch = 0;
    if (z.leapState) {
      if (z.leapState.phase === 'crouch') {
        crouch = -2.0;
      } else if (z.leapState.phase === 'air') {
        const u = Math.max(0, Math.min(1, z.leapState.timer / (z.leapState.airDur || 0.42)));
        leapLift = Math.sin(Math.PI * u) * 26;
      }
    }
    const legZ = 1 + leapLift;
    const bodyBaseZ = Math.max(0.5, 1 + leapLift + crouch + bob);

    const ang = typeof z.facingAngle === 'number' ? z.facingAngle : Math.PI * 0.75;
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);
    const px = -fy;
    const py = fx;

    let headFwd = 0.05 * sc;
    let headZ = bodyBaseZ + 13.0 * sc;
    let headW = 0.31 * sc;
    let headH = 10.6 * sc;
    let topZ = bodyBaseZ + 26.8 * sc;

    if (type === 'runner') {
      headFwd = 0.25 * sc;
      headZ = bodyBaseZ + 11.2 * sc;
      headW = 0.32 * sc;
      headH = 10.8 * sc;
      topZ = bodyBaseZ + 25.4 * sc;
    } else if (type === 'brute') {
      headFwd = 0.06 * sc;
      headZ = bodyBaseZ + 11.8 * sc;
      headW = 0.28 * sc;
      headH = 8.4 * sc;
      topZ = bodyBaseZ + 23.2 * sc;
    } else if (type === 'spitter') {
      headFwd = 0.22 * sc;
      headZ = bodyBaseZ + 8.8 * sc;
      headW = 0.24 * sc;
      headH = 6.0 * sc;
      topZ = bodyBaseZ + 18.2 * sc;
    } else if (type === 'leaper') {
      headFwd = 0.30 * sc;
      headZ = bodyBaseZ + 7.2 * sc;
      headW = 0.22 * sc;
      headH = 5.4 * sc;
      topZ = bodyBaseZ + 16.5 * sc;
    } else if (type === 'shocker') {
      headFwd = 0.03 * sc;
      headZ = bodyBaseZ + 13.6 * sc;
      headW = 0.25 * sc;
      headH = 6.2 * sc;
      topZ = bodyBaseZ + 28.0 * sc;
    } else if (zDef.isBoss) {
      headFwd = 0.05 * sc;
      headZ = bodyBaseZ + 12.2 * sc;
      headW = 0.28 * sc;
      headH = 8.8 * sc;
      topZ = bodyBaseZ + 28.5 * sc;
    }

    return { sc, type, stride, bob, legZ, bodyBaseZ, leapLift, crouch, ang, fx, fy, px, py, headFwd, headZ, headW, headH, topZ };
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
      const structH = st.id === 'command_hq' ? hqOccH : getStructVisualTopZ(st.id, st.level || 1);
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

  function drawZombie(ctx, z, timeSec, zScale, state, opts) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const zDef = ZS.DATA.ZOMBIES[z.type] || ZS.DATA.ZOMBIES.walker;
    const m = getZombiePoseMetrics(z, zDef, timeSec);
    const { sc, type, stride, legZ, bodyBaseZ, fx, fy, px, py } = m;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const isGhost = !!(opts && opts.isGhost);
    const isNightLit = !!(state && state.nightAlpha > 0.35);

    const basePos = Iso.gridToScreen(z.x, z.y, 1);

    // Boss Siege Charge trailing afterimages (3 echoes: alpha 0.18 / 0.30 / 0.42)
    if (zDef.isBoss && !isGhost && !isSil && z.chargeState && z.chargeState.phase === 'dash') {
      const cs = z.chargeState;
      const trailFracs = [0.28, 0.52, 0.76];
      const alphas = [0.18, 0.30, 0.42];
      for (let tIdx = 0; tIdx < trailFracs.length; tIdx++) {
        const f = trailFracs[tIdx];
        const ghost = {
          ...z,
          x: cs.startX + (z.x - cs.startX) * f,
          y: cs.startY + (z.y - cs.startY) * f,
          hitFlash: 0
        };
        ctx.save();
        ctx.globalAlpha = alphas[tIdx];
        const prevGhostEm = emissiveList;
        emissiveList = null;
        drawZombie(ctx, ghost, timeSec, zScale, state, { isGhost: true });
        emissiveList = prevGhostEm;
        ctx.restore();
      }
    }

    // Boss: dark abyssal ground shadow ring + pulsing danger threat ring + windup lane / glow (hidden in silhouette mode)
    if (zDef.isBoss && !isGhost && !isSil) {
      if (z.chargeState && z.chargeState.phase === 'windup') {
        const cs = z.chargeState;
        const cDx = cs.targetX - z.x;
        const cDy = cs.targetY - z.y;
        const cLen = Math.max(0.01, Math.hypot(cDx, cDy));
        const perpX = (-cDy / cLen) * 0.3;
        const perpY = (cDx / cLen) * 0.3;
        const p1 = Iso.gridToScreen(z.x + perpX, z.y + perpY, 0.6);
        const p2 = Iso.gridToScreen(cs.targetX + perpX, cs.targetY + perpY, 0.6);
        const p3 = Iso.gridToScreen(cs.targetX - perpX, cs.targetY - perpY, 0.6);
        const p4 = Iso.gridToScreen(z.x - perpX, z.y - perpY, 0.6);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 77, 109, 0.14)';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 1.8 * zScale;
        ctx.stroke();
        ctx.setLineDash([]);

        const glowP = Iso.gridToScreen(z.x, z.y, 14);
        ctx.fillStyle = 'rgba(255, 77, 109, 0.32)';
        ctx.beginPath();
        ctx.ellipse(glowP.x, glowP.y, 30 * zScale, 30 * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

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

    // Leaper landing shadow preview on target tile (grows as leaper approaches landing)
    if (!isGhost && !isSil && z.leapState) {
      const ls = z.leapState;
      const u = ls.phase === 'crouch'
        ? 0.35 + 0.25 * (ls.timer / (ls.crouchDur || 0.12))
        : 0.6 + 0.4 * Math.min(1, ls.timer / (ls.airDur || 0.42));
      const lSh = Iso.gridToScreen(ls.targetX, ls.targetY + 0.05, 0.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(lSh.x, lSh.y, 14 * u * zScale, 7 * u * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // War Cry frenzy ring (dashed #E040FB r=0.30 around buffed zombie)
    if (!isGhost && !isSil && z.frenzyTimer > 0) {
      drawIsoCircle(ctx, z.x, z.y, 0.30 * sc, P.zombieBossCrack || '#E040FB', null, [3, 2], 1.5 * zScale);
    }

    // Crisp ground contact shadow (faint when airborne mid-leap)
    if (!isGhost) {
      const shadowScale = z.leapState && z.leapState.phase === 'air' ? 0.55 : 1.0;
      const shadowRx = (type === 'brute' ? 11.4 : type === 'runner' ? 10.2 : 9.6) * sc * shadowScale * zScale;
      const shadowRy = (type === 'brute' ? 5.8 : 5.0) * sc * shadowScale * zScale;
      ctx.fillStyle = z.leapState && z.leapState.phase === 'air' ? 'rgba(8, 10, 16, 0.25)' : 'rgba(8, 10, 16, 0.52)';
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, shadowRx, shadowRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    Iso.setEntityFlash(z.hitFlash || 0);

    const parts = [];
    const darkStroke = 'rgba(27, 36, 48, 0.42)';
    const legStep = stride * 0.055 * sc;

    if (type === 'runner') {
      const legW = 0.12 * sc;
      pushOrientedPart(parts, z.x - fx * (0.10 * sc - legStep) - px * 0.09 * sc, z.y - fy * (0.10 * sc - legStep) - py * 0.09 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      pushOrientedPart(parts, z.x - fx * (0.10 * sc + legStep) + px * 0.09 * sc, z.y - fy * (0.10 * sc + legStep) + py * 0.09 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      pushOrientedPart(parts, z.x - fx * 0.09 * sc, z.y - fy * 0.09 * sc, bodyBaseZ + 4.4 * sc, 0.28 * sc, 0.28 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      pushOrientedPart(parts, z.x + fx * 0.10 * sc, z.y + fy * 0.10 * sc, bodyBaseZ + 6.4 * sc, 0.30 * sc, 0.30 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      if (zDef.accentColor) {
        pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, bodyBaseZ + 8.4 * sc, 0.32 * sc, 0.32 * sc, 3.0 * sc, {
          base: zDef.accentColor
        });
      }
      const armW = 0.11 * sc;
      pushOrientedPart(parts, z.x - fx * 0.16 * sc - px * 0.18 * sc, z.y - fy * 0.16 * sc - py * 0.18 * sc, bodyBaseZ + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      pushOrientedPart(parts, z.x - fx * 0.16 * sc + px * 0.18 * sc, z.y - fy * 0.16 * sc + py * 0.18 * sc, bodyBaseZ + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'brute') {
      const legW = 0.13 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 3.6 * sc, 0.34 * sc, 0.34 * sc, 8.4 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const armorCol = zDef.armorColor || '#C97A9E';
      pushOrientedPart(parts, z.x + fx * 0.15 * sc, z.y + fy * 0.15 * sc, bodyBaseZ + 4.2 * sc, 0.24 * sc, 0.24 * sc, 7.4 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + px * side * 0.22 * sc, z.y + py * side * 0.22 * sc, bodyBaseZ + 7.2 * sc, 0.18 * sc, 0.18 * sc, 5.4 * sc, {
          base: armorCol,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.07 * sc + px * side * 0.23 * sc, z.y + fy * 0.07 * sc + py * side * 0.23 * sc, bodyBaseZ + 2.8 * sc, 0.14 * sc, 0.14 * sc, 4.8 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
      pushOrientedPart(parts, z.x + fx * (m.headFwd + 0.01 * sc), z.y + fy * (m.headFwd + 0.01 * sc), m.headZ + m.headH * 0.68, m.headW * 1.06, m.headW * 1.06, 2.2 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
    } else if (type === 'spitter') {
      // SPITTER: Leaning torso + dorsal globular acid sac (#6E8A1E day + 3 #C8F542 spots / #C8F542 emissive night) + low forward head
      const legW = 0.11 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.08 * sc, z.y + fy * legStep - py * 0.08 * sc, legZ, legW, legW, 3.8 * sc, {
        base: zDef.legColor || '#3A1636'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.08 * sc, z.y - fy * legStep + py * 0.08 * sc, legZ, legW, legW, 3.8 * sc, {
        base: zDef.legColor || '#3A1636'
      });
      pushOrientedPart(parts, z.x + fx * 0.06 * sc, z.y + fy * 0.06 * sc, bodyBaseZ + 3.6 * sc, 0.28 * sc, 0.28 * sc, 7.0 * sc, {
        base: zDef.coatColor || '#4F2147',
        stroke: darkStroke
      });
      const sacCol = isNightLit ? (zDef.accentColor || '#C8F542') : (zDef.accentDimColor || '#6E8A1E');
      pushOrientedBlob(parts, z.x - fx * 0.15 * sc, z.y - fy * 0.15 * sc, bodyBaseZ + 2.6 * sc, 0.16 * sc, 8.5 * sc, sacCol, {
        emissive: isNightLit,
        acidSpots: !isNightLit,
        spotColor: zDef.accentColor || '#C8F542',
        n: 12,
        slices: 5
      });
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + fx * 0.14 * sc + px * side * 0.15 * sc, z.y + fy * 0.14 * sc + py * side * 0.15 * sc, bodyBaseZ + 4.8 * sc, 0.10 * sc, 0.10 * sc, 4.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'leaper') {
      // LEAPER: Reverse-jointed hind legs + low 2-piece horizontal torso + 3 dorsal bone spines + long reaching arms + claws
      const legCol = zDef.legColor || '#4A1522';
      const boneCol = zDef.accentColor || '#F4EBDD';
      for (const side of [-1, 1]) {
        const sStep = side * legStep;
        pushOrientedPart(parts, z.x - fx * (0.13 * sc - sStep * 0.5) + px * side * 0.09 * sc, z.y - fy * (0.13 * sc - sStep * 0.5) + py * side * 0.09 * sc, legZ + 2.4 * sc, 0.10 * sc, 0.10 * sc, 3.8 * sc, {
          base: legCol
        });
        pushOrientedPart(parts, z.x - fx * (0.03 * sc - sStep) + px * side * 0.09 * sc, z.y - fy * (0.03 * sc - sStep) + py * side * 0.09 * sc, legZ, 0.09 * sc, 0.09 * sc, 3.0 * sc, {
          base: legCol
        });
        pushOrientedPart(parts, z.x + fx * (0.04 * sc + sStep) + px * side * 0.09 * sc, z.y + fy * (0.04 * sc + sStep) + py * side * 0.09 * sc, Math.max(0.4, legZ - 0.3), 0.12 * sc, 0.12 * sc, 1.0 * sc, {
          base: boneCol
        });
      }
      pushOrientedPart(parts, z.x - fx * 0.06 * sc, z.y - fy * 0.06 * sc, bodyBaseZ + 5.4 * sc, 0.26 * sc, 0.26 * sc, 4.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      pushOrientedPart(parts, z.x + fx * 0.12 * sc, z.y + fy * 0.12 * sc, bodyBaseZ + 6.0 * sc, 0.26 * sc, 0.26 * sc, 4.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const spines = [[-0.10, 10.0, 2.4], [0.02, 10.6, 2.6], [0.14, 10.6, 2.2]];
      for (let k = 0; k < spines.length; k++) {
        pushOrientedPart(parts, z.x + fx * spines[k][0] * sc, z.y + fy * spines[k][0] * sc, bodyBaseZ + spines[k][1] * sc, 0.06 * sc, 0.06 * sc, spines[k][2] * sc, {
          base: boneCol,
          stroke: darkStroke
        });
      }
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + fx * 0.25 * sc + px * side * 0.16 * sc, z.y + fy * 0.25 * sc + py * side * 0.16 * sc, bodyBaseZ + 5.0 * sc, 0.09 * sc, 0.09 * sc, 4.8 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.40 * sc + px * side * 0.16 * sc, z.y + fy * 0.40 * sc + py * side * 0.16 * sc, bodyBaseZ + 0.2 * sc, 0.09 * sc, 0.09 * sc, 5.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.48 * sc + px * side * 0.16 * sc, z.y + fy * 0.48 * sc + py * side * 0.16 * sc, Math.max(0.3, legZ - 0.4), 0.11 * sc, 0.11 * sc, 1.2 * sc, {
          base: boneCol
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'shocker') {
      // SHOCKER: Armored torso + dorsal battery pack + 3 vertical EMP rods + glowing #B26BFF coil tips
      const legW = 0.13 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.6 * sc, {
        base: zDef.legColor || '#1E1236'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.6 * sc, {
        base: zDef.legColor || '#1E1236'
      });
      pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 4.6 * sc, 0.34 * sc, 0.34 * sc, 9.0 * sc, {
        base: zDef.coatColor || '#2E1B4F',
        stroke: darkStroke
      });
      pushOrientedPart(parts, z.x - fx * 0.21 * sc, z.y - fy * 0.21 * sc, bodyBaseZ + 6.0 * sc, 0.20 * sc, 0.20 * sc, 7.0 * sc, {
        base: zDef.packColor || '#3B2A5E',
        stroke: darkStroke
      });
      const rods = [[-0.09, 13.0], [0, 15.5], [0.09, 13.0]];
      for (let k = 0; k < rods.length; k++) {
        const oy = rods[k][0] * sc;
        const rh = rods[k][1] * sc;
        const rx = z.x - fx * 0.26 * sc + px * oy;
        const ry = z.y - fy * 0.26 * sc + py * oy;
        pushOrientedPart(parts, rx, ry, bodyBaseZ + 8.0 * sc, 0.05 * sc, 0.05 * sc, rh, {
          base: zDef.rodColor || '#6B5A8E',
          stroke: darkStroke
        });
        pushOrientedPart(parts, rx, ry, bodyBaseZ + 8.0 * sc + rh, 0.085 * sc, 0.085 * sc, 2.2 * sc, {
          base: zDef.accentColor || '#B26BFF',
          emissive: true
        });
      }
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + fx * 0.04 * sc + px * side * 0.23 * sc, z.y + fy * 0.04 * sc + py * side * 0.23 * sc, bodyBaseZ + 6.0 * sc, 0.14 * sc, 0.14 * sc, 6.0 * sc, {
          base: zDef.coatColor || '#2E1B4F',
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.08 * sc + px * side * 0.23 * sc, z.y + fy * 0.08 * sc + py * side * 0.23 * sc, bodyBaseZ + 2.4 * sc, 0.13 * sc, 0.13 * sc, 3.6 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (zDef.isBoss) {
      const legW = 0.13 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 3.8 * sc, 0.33 * sc, 0.33 * sc, 8.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const crackCol = zDef.accentColor || '#E040FB';
      pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, bodyBaseZ + 5.4 * sc, 0.26 * sc, 0.26 * sc, 4.4 * sc, {
        base: crackCol,
        emissive: true
      });
      pushOrientedPart(parts, z.x - fx * 0.12 * sc, z.y - fy * 0.12 * sc, bodyBaseZ + 7.6 * sc, 0.14 * sc, 0.14 * sc, 5.2 * sc, {
        base: crackCol,
        emissive: true
      });
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + px * side * 0.21 * sc, z.y + py * side * 0.21 * sc, bodyBaseZ + 8.0 * sc, 0.16 * sc, 0.16 * sc, 5.0 * sc, {
          base: zDef.coatColor,
          stroke: darkStroke
        });
        pushOrientedPart(parts, z.x + fx * 0.14 * sc + px * side * 0.21 * sc, z.y + fy * 0.14 * sc + py * side * 0.21 * sc, bodyBaseZ + 4.2 * sc, 0.14 * sc, 0.14 * sc, 5.0 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
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
      const legW = 0.11 * sc;
      pushOrientedPart(parts, z.x + fx * legStep - px * 0.075 * sc, z.y + fy * legStep - py * 0.075 * sc, legZ, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      pushOrientedPart(parts, z.x - fx * legStep + px * 0.075 * sc, z.y - fy * legStep + py * 0.075 * sc, legZ, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 4.2 * sc, 0.29 * sc, 0.29 * sc, 9.0 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      for (const side of [-1, 1]) {
        pushOrientedPart(parts, z.x + fx * 0.16 * sc + px * side * 0.16 * sc, z.y + fy * 0.16 * sc + py * side * 0.16 * sc, bodyBaseZ + 8.6 * sc, 0.115 * sc, 0.115 * sc, 3.4 * sc, {
          base: zDef.coatColor
        });
        pushOrientedPart(parts, z.x + fx * 0.30 * sc + px * side * 0.16 * sc, z.y + fy * 0.30 * sc + py * side * 0.16 * sc, bodyBaseZ + 8.8 * sc, 0.115 * sc, 0.115 * sc, 3.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    }

    flushOrientedParts(ctx, parts, zScale);

    // Spitter acid chin droplet (#C8F542)
    if (type === 'spitter' && !isSil && !isGhost) {
      const drip = Iso.gridToScreen(z.x + fx * (m.headFwd + 0.10 * sc), z.y + fy * (m.headFwd + 0.10 * sc), m.headZ - 0.5 * sc);
      drawIsoDot(ctx, { x: drip.x, y: drip.y + 3 * zScale }, 1.1, P.mutantAcid || '#C8F542', true, zScale);
    }

    // Boss glowing chest crack lines on screen space for unmistakable mutant fissure detail
    if (zDef.isBoss && !(z.hitFlash > 0)) {
      const c1 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.06 * sc, z.y + fy * 0.18 * sc - py * 0.06 * sc, bodyBaseZ + 9.8 * sc);
      const c2 = Iso.gridToScreen(z.x + fx * 0.20 * sc + px * 0.02 * sc, z.y + fy * 0.20 * sc + py * 0.02 * sc, bodyBaseZ + 7.2 * sc);
      const c3 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.04 * sc, z.y + fy * 0.18 * sc - py * 0.04 * sc, bodyBaseZ + 4.8 * sc);
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
    if (!isGhost) {
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

      // Gate slow aura ring (#C9D3DE, distinct from EMP cyan #5EF2FF)
      if (z.inGateAura && !isSil) {
        ctx.strokeStyle = P.gateSlowRing || '#C9D3DE';
        ctx.lineWidth = 1.5 * zScale;
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y, 11.4 * sc * zScale, 6.0 * sc * zScale, 0, 0, Math.PI * 2);
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
  }

  function drawProjectiles(ctx, projectiles, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.kind === 'acid_glob') {
        if (isSil) continue;
        const prog = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.4)));
        const arcPt = (u) => {
          const gx = p.startX + (p.targetX - p.startX) * u;
          const gy = p.startY + (p.targetY - p.startY) * u;
          const gz = 11 + Math.sin(Math.PI * u) * 18;
          return Iso.gridToScreen(gx, gy, gz);
        };
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(200, 245, 66, 0.45)';
        ctx.lineWidth = 1.4 * zScale;
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const u = (prog * k) / 10;
          const pt = arcPt(u);
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const trailOffsets = [0.16, 0.10, 0.05];
        for (let k = 0; k < trailOffsets.length; k++) {
          const tu = Math.max(0, prog - trailOffsets[k]);
          const tp = arcPt(tu);
          ctx.fillStyle = `rgba(200, 245, 66, ${(0.20 + k * 0.20).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, (2.0 + k * 0.6) * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        const cur = arcPt(prog);
        ctx.fillStyle = P.mutantAcid || '#C8F542';
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 4.0 * zScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.kind === 'acid_mount_ring') {
        if (isSil) continue;
        const alpha = Math.max(0, p.life / (p.maxLife || 0.30));
        const c = Iso.gridToScreen(p.x, p.y, p.z || 22);
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = p.color || P.mutantAcid || '#C8F542';
        ctx.lineWidth = 1.6 * zScale;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, (p.radius || 0.18) * 32 * zScale, (p.radius || 0.18) * 16 * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        continue;
      }
      if (p.kind === 'emp_ring') {
        if (isSil) continue;
        const t = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.35)));
        const r = Math.max(0.15, (p.radius || 2.1) * t);
        const alpha = Math.max(0, p.life / (p.maxLife || 0.35));
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.1);
        drawIsoCircle(ctx, p.x, p.y, r, p.color || P.mutantEmp || '#B26BFF', 'rgba(178, 107, 255, 0.10)', [], 2.0 * zScale);
        if (r > 0.65) {
          drawIsoCircle(ctx, p.x, p.y, r * 0.66, 'rgba(178, 107, 255, 0.5)', null, [3, 3], 1.4 * zScale);
        }
        ctx.restore();
        continue;
      }
      if (p.kind === 'warcry_ring') {
        if (isSil) continue;
        const t = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.50)));
        const r = Math.max(0.25, (p.radius || 3.8) * t);
        const alpha = Math.max(0, p.life / (p.maxLife || 0.50));
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        drawIsoCircle(ctx, p.x, p.y, r, p.color || '#E040FB', 'rgba(224, 64, 251, 0.06)', [], 2.2 * zScale);
        drawIsoCircle(ctx, p.x, p.y, r * 0.68, 'rgba(224, 64, 251, 0.55)', null, [], 1.8 * zScale);
        ctx.restore();
        continue;
      }
      if (p.kind === 'bleed_burst') {
        if (isSil) continue;
        const alpha = Math.max(0, p.life / (p.maxLife || 0.32));
        const b = Iso.gridToScreen(p.x, p.y, p.z || 3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 2.0 * zScale;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(a) * 8 * zScale, b.y + Math.sin(a) * 5 * zScale);
          ctx.lineTo(b.x + Math.cos(a) * 16 * zScale, b.y + Math.sin(a) * 9.5 * zScale);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
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
      if (stn.kind === 'acid_puddle') {
        const fade = Math.min(1, stn.life / Math.min(1.0, stn.maxLife || 2.5));
        const p = Iso.gridToScreen(stn.x, stn.y, 0.65);
        const rx = (stn.radius || 0.32) * 30 * zScale;
        const ry = (stn.radius || 0.32) * 15 * zScale;
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(200, 245, 66, 0.55)';
        ctx.strokeStyle = stn.subColor || '#6E8A1E';
        ctx.lineWidth = 1.5 * zScale;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const drops = [[-6, -4], [5, -7], [9, 2], [-9, 3], [1, -10]];
        ctx.fillStyle = stn.color || '#C8F542';
        for (let k = 0; k < drops.length; k++) {
          ctx.beginPath();
          ctx.arc(p.x + drops[k][0] * zScale, p.y + drops[k][1] * zScale, 1.6 * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (stn.kind === 'crater_crack') {
        const fade = Math.min(1, stn.life / Math.min(1.6, stn.maxLife || 5.5));
        const p = Iso.gridToScreen(stn.x, stn.y, 0.7);
        ctx.globalAlpha = fade * 0.78;
        ctx.strokeStyle = '#1B2430';
        ctx.lineWidth = 2.0 * zScale;
        const baseA = (stn.seed || 0) * 0.5;
        for (let k = 0; k < 6; k++) {
          const a = baseA + (k / 6) * Math.PI * 2;
          const len = (10 + (k % 2) * 5) * zScale;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len * 0.55);
          ctx.stroke();
        }
        continue;
      }
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

    const illuminateNode = (node, gx, gy, lz, isMounted) => {
      const def = DATA.ITEMS[node.id];
      if (!def) return;
      if (def.requiresPower && (!powered || (node.empStunTimer || 0) > 0)) return;
      const eff = isMounted && ZS.Game.getStructureEffectiveStats
        ? ZS.Game.getStructureEffectiveStats(node, gx, gy, undefined, true)
        : null;
      const lightR = (eff && eff.lightRadius != null) ? eff.lightRadius : def.lightRadius;
      if (lightR) {
        const flicker = node.id === 'gas_heater' ? 0.96 + 0.05 * Math.sin(timeSec * 11 + gx) : 1.0;
        punchHole(gx + 0.5, gy + 0.5, lz, lightR * flicker, 0.92);
        if (def.lightColor) {
          colorGlows.push({
            gx: gx + 0.5,
            gy: gy + 0.5,
            z: lz,
            r: lightR * 0.85,
            color: def.lightColor
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
        let topZ = getStructVisualTopZ(bSt.id, bSt.level || 1);
        if (bSt.id === 'barricade_wall' && (bSt.level || 1) >= 2 && bSt.mounted) {
          topZ = ((bSt.level || 2) >= 3 ? 25.4 : 15.2) + getMountedVisualTopZ(bSt.mounted.id);
        }
        const pulse = 1 + 0.12 * Math.sin(timeSec * 5.23);
        drawIsoCircle(
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
        const wallMask = isWall ? getWallConnectMask(state.structGrid, tx, ty) : 0;
        const isWallInspOrHov =
          (uiState.inspectedTile && uiState.inspectedTile.tx === tx && uiState.inspectedTile.ty === ty) ||
          (uiState.hoverTile && uiState.hoverTile.tx === tx && uiState.hoverTile.ty === ty);

        if (id === 'barricade_wall' && lv >= 2 && st.mounted) {
          const m = st.mounted;
          const mDef = DATA.ITEMS[m.id];
          const mLv = m.level || 1;
          const mBaseZ = lv >= 3 ? 25.4 : 15.2;
          const topZ = mBaseZ + getMountedVisualTopZ(m.id);
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

          const isMountUnpowered = state.isNight && mDef && mDef.requiresPower && !powered;
          const isMountEmpStunned = !isMountUnpowered && mDef && mDef.requiresPower && (m.empStunTimer || 0) > 0;
          if (isMountUnpowered) {
            const warnZ = showDualHp ? dualHpZ + 13 : topZ + (hasPips || hasRank ? 19 : 11);
            const warnPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, warnZ);
            const badgeScale = Math.max(1.0, zScale);
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
          } else if (isMountEmpStunned) {
            const empZ = showDualHp ? dualHpZ + 8 : topZ + (hasPips || hasRank ? 14 : 6);
            drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, m.empStunTimer || 0, timeSec, Math.max(1.0, zScale), zScale, P);
          }
        } else {
          const isDamaged = st.hp < st.maxHp && st.hp > 0;
          const isUnpowered = state.isNight && def && def.requiresPower && !powered;
          const isWallHub = isWall && wallMask !== 0 && ((wallMask & 5) !== 0 && (wallMask & 10) !== 0);
          const showWallPips = isWall && lv >= 2 && (wallMask === 0 || isWallHub || isWallInspOrHov);
          const hasPips = id !== 'command_hq' && (isWall ? showWallPips : lv >= 2);
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

          const isEmpStunned = !isUnpowered && def && def.requiresPower && (st.empStunTimer || 0) > 0;
          if (isUnpowered) {
            const warnZ = isDamaged ? 35 : 29;
            const warnPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, warnZ);
            const badgeScale = Math.max(1.0, zScale);
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
          } else if (isEmpStunned) {
            const empZ = Math.max(topZ + (hasPips || hasRank ? 12 : 4), isDamaged ? 32 : 24);
            drawEmpStunIndicator(ctx, tx + 0.5, ty + 0.5, empZ, st.empStunTimer || 0, timeSec, Math.max(1.0, zScale), zScale, P);
          }
        }
      } else if (item.kind === 'zombie') {
        const z = item.z;
        const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;
        const m = getZombiePoseMetrics(z, zDef, timeSec);

        if (state.nightAlpha > 0.05) {
          const eyes = getZombieEyePositions(z, zDef, timeSec, zScale);
          if (!isZombieEyesOccluded(state, z, eyes, zScale)) {
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

  function renderItemThumbnail(itemId, sizePx) {
    const sz = Math.max(24, Math.round(sizePx || 44));
    const key = `${itemId}@${sz}`;
    const cached = thumbnailCache.get(key);
    if (cached) return cached;

    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const def = itemId === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[itemId];
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
    const prevEmis = emissiveList;

    try {
      Iso.setViewport(sz, sz);
      Iso.resetRenderModifiers();
      Iso.setSceneTint('#FFE8BA', 0.045);
      emissiveList = null;

      if (def.layer === 'floor') {
        const zoom = (sz / 82) * 1.02;
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = Iso.TILE_H * 0.5 - 1.5;

        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4.5), Iso.gridToScreen(0, 1, -4.5)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4.5), Iso.gridToScreen(1, 1, -4.5)];
        drawPolyFace(tctx, l, '#3A3027', 1.0, false, false, zoom);
        drawPolyFace(tctx, r, '#2C241D', 1.0, false, false, zoom);
        drawPolyFace(tctx, t, '#55705A', 1.0, false, false, zoom);
        drawFloorTile(tctx, 0, 0, itemId, zoom);
      } else {
        const topZ = itemId === 'command_hq' ? 36 : getStructVisualTopZ(itemId, 1);
        const extraTop = itemId === 'wind_turbine' ? 14 : 3;
        const spanY = Math.max(44, topZ + extraTop + 22);
        const zoom = Math.min((sz * 0.88) / 72, (sz * 0.88) / spanY);
        Iso.cam.zoom = zoom;
        Iso.cam.x = 0;
        Iso.cam.y = Iso.TILE_H * 0.5 - (topZ + extraTop - 16) * 0.5;

        // Miniature diorama turf plinth under structure
        const t = [Iso.gridToScreen(0, 0, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(0, 1, 0)];
        const l = [Iso.gridToScreen(0, 1, 0), Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 1, -4), Iso.gridToScreen(0, 1, -4)];
        const r = [Iso.gridToScreen(1, 1, 0), Iso.gridToScreen(1, 0, 0), Iso.gridToScreen(1, 0, -4), Iso.gridToScreen(1, 1, -4)];
        drawPolyFace(tctx, l, '#3A3027', 1.0, false, false, zoom);
        drawPolyFace(tctx, r, '#2C241D', 1.0, false, false, zoom);
        drawPolyFace(tctx, t, '#55705A', 1.0, false, false, zoom);

        const dummyState = {
          isNight: false,
          nightAlpha: 0,
          hqLevel: 1,
          power: 80,
          powerCap: 100
        };
        const dummySt = {
          id: itemId,
          level: 1,
          hp: 100,
          maxHp: 100,
          aimAngle: 0.78,
          previewMask: itemId === 'barricade_wall' || itemId === 'tactical_gate' ? 10 : undefined
        };
        drawStructure(tctx, dummySt, 0, 0, dummyState, true, 0.45, zoom);
      }
    } finally {
      Iso.setViewport(prevVp.w, prevVp.h);
      Iso.cam.x = prevCamX;
      Iso.cam.y = prevCamY;
      Iso.cam.zoom = prevZoom;
      Iso.resetRenderModifiers();
      emissiveList = prevEmis;
    }

    const url = cv.toDataURL ? cv.toDataURL('image/png') : '';
    if (url) {
      thumbnailCache.set(key, url);
    }
    return url;
  }

  return {
    render,
    renderItemThumbnail,
    getStructVisualTopZ,
    getWallConnectMask,
    drawStructure,
    drawFloorTile
  };
})();
