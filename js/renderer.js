window.ZS = window.ZS || {};

ZS.Renderer = (function () {
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');
  const eyeHaloCache = new Map();

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

  function render(ctx, w, h, state, uiState, timeSec) {
    const Iso = ZS.Iso;
    const DATA = ZS.DATA;
    const P = DATA.PALETTE;
    const N = DATA.GRID_SIZE;
    const zScale = Iso.cam.zoom;

    // 1. Background Sky / Tactical Tabletop Backdrop
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 60, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    if (state.nightAlpha > 0.4) {
      bgGrad.addColorStop(0, '#142030');
      bgGrad.addColorStop(1, '#090e17');
    } else {
      bgGrad.addColorStop(0, '#273646');
      bgGrad.addColorStop(1, '#141d26');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply subtle day/night ambient tint to matte voxel surfaces (emissive faces stay untouched)
    if (state.nightAlpha > 0.02) {
      Iso.setSceneTint('#7aa6e8', 0.07 * state.nightAlpha);
    } else {
      Iso.setSceneTint('#fff3db', 0.03);
    }

    // 2. 3D Miniature Diorama Island Base Slab (grass top seam-guard + pre-shaded soil strata sides)
    Iso.drawVoxelBox(ctx, 0, 0, -14, N, N, 14, {
      top: P.terrainB,
      left: P.slabSideLeft || '#3A3027',
      right: P.slabSideRight || '#2C241D',
      stroke: 'rgba(255,255,255,0.08)'
    });

    // 3. Terrain & Floor Tiles
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const isEdge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        const checker = (x + y) % 2 === 0;
        let baseFill = checker ? P.terrainA : P.terrainB;
        if (isEdge) {
          baseFill = checker ? P.terrainEdgeA : P.terrainEdgeB;
        }
        Iso.drawTilePoly(ctx, x, y, 0, baseFill, 'rgba(18, 28, 22, 0.24)', 1);

        // Subtle perimeter spawn marker ticks
        if (isEdge && (x + y) % 3 === 0) {
          const c = Iso.gridToScreen(x + 0.5, y + 0.5, 0.5);
          ctx.fillStyle = P.dangerFill;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 2.2 * zScale, 0, Math.PI * 2);
          ctx.fill();
        }

        const floorId = state.floorGrid[y][x];
        if (floorId) {
          drawFloorTile(ctx, x, y, floorId, zScale);
        }
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

    // 5. Collect & Depth-Sort All Structures + Zombies
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

    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      renderList.push({
        kind: 'zombie',
        depth: z.x + z.y + 0.05,
        z
      });
    }

    renderList.sort((a, b) => a.depth - b.depth);

    const powered = !state.isNight || state.power > 0.01;

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'struct') {
        drawStructure(ctx, item.st, item.tx, item.ty, state, powered, timeSec, zScale);
      } else {
        drawZombie(ctx, item.z, timeSec, zScale);
      }
    }

    // 6. Ghost Preview of Structure Being Built or Moved
    if (uiState.hoverTile && state.phase === 'day') {
      const { tx, ty } = uiState.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
        drawBuildGhost(ctx, state, uiState, tx, ty, timeSec, zScale);
      }
    }

    Iso.resetRenderModifiers();

    // 7. Projectiles & Lightning Arcs (World Space)
    drawProjectiles(ctx, state.projectiles, zScale);
    drawParticles(ctx, state.particles, zScale);

    // 8. Nighttime Tactical Darkness & Dynamic Glow Layer
    if (state.nightAlpha > 0.02) {
      drawNightLighting(ctx, w, h, state, powered, timeSec, zScale);
    }

    // ── Info Layer (Drawn above darkness: identical daytime brightness & contrast) ──
    // 9. Selection Outline, Structure/Zombie HP Bars, and Blackout ⚡OFF Warnings
    drawInfoLayer(ctx, state, uiState, renderList, powered, timeSec, zScale);

    // 10. Floating Texts (Damage, Loot, Buff Callouts)
    drawFloatingTexts(ctx, state.floatingTexts, zScale);
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
    let previewId = null;
    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (def && def.layer === 'struct' && !state.structGrid[ty][tx]) {
        previewId = def.id;
      }
    } else if (uiState.mode === 'move' && uiState.movingSource && !state.structGrid[ty][tx]) {
      const src = state.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
      if (src) previewId = src.id;
    }

    if (previewId) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      drawStructure(ctx, { id: previewId, hp: 100, maxHp: 100, aimAngle: 0 }, tx, ty, state, true, timeSec, zScale);
      ctx.restore();
    }
  }

  function drawStructure(ctx, st, tx, ty, state, powered, timeSec, zScale) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const id = st.id;
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

    Iso.setEntityFlash(st.hitFlash || 0);

    switch (id) {
      case 'command_hq': {
        drawHqByLevel(ctx, st, tx, ty, state, timeSec, zScale);
        break;
      }

      case 'hesco_wall': {
        // Modern HESCO military gabion bastion
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 1, 0.84, 0.84, 16, {
          base: '#d6c49e',
          stroke: '#635947'
        });
        // Wire mesh frame band
        Iso.drawVoxelBox(ctx, tx + 0.07, ty + 0.07, 8, 0.86, 0.86, 2, {
          base: '#6c7680'
        });
        break;
      }

      case 'blast_wall': {
        // Heavy Armored Alloy Blast Barrier (copper-bronze stripe instead of coin gold)
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.06, 1, 0.88, 0.88, 20, {
          base: '#5f6f82',
          stroke: '#8396ad'
        });
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.05, 5, 0.90, 0.90, 3, {
          base: '#c4834b'
        });
        break;
      }

      case 'razor_pad': {
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 2, {
          base: '#454e59'
        });
        const c = Iso.gridToScreen(tx + 0.5, ty + 0.5, 4);
        ctx.strokeStyle = '#bcc8d6';
        ctx.lineWidth = 1.4 * zScale;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.ellipse(c.x + k * 7 * zScale, c.y, 6 * zScale, 4 * zScale, 0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'rifle_bunker': {
        // Sandbag/Composite Bunker + Modern Kevlar Rifleman
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 10, {
          base: '#6e7d68',
          stroke: '#85967e'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 11, '#4b5d46', '#38463a', st.aimAngle || 0, zScale, false);
        break;
      }

      case 'shotgun_post': {
        // Ballistic Shield Breacher Post
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 11, {
          base: '#4d5968',
          stroke: '#8fa1b3'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 12, '#3a4654', '#b87d4b', st.aimAngle || 0, zScale, false);
        break;
      }

      case 'sniper_tower': {
        // Steel Truss Overwatch Tower + Sniper
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
          base: '#637282',
          stroke: '#94a6b8'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 25, '#3d4d42', '#6f8072', st.aimAngle || 0, zScale, true);
        break;
      }

      case 'vulcan_turret': {
        // CIWS Radar Dome Auto-Turret
        Iso.drawVoxelBox(ctx, tx + 0.14, ty + 0.14, 1, 0.72, 0.72, 9, {
          base: '#525f6e'
        });
        Iso.drawVoxelBox(ctx, tx + 0.25, ty + 0.25, 10, 0.50, 0.50, 13, {
          base: isUnpowered ? '#7a828a' : '#eef4fa'
        });
        drawTurretBarrel(ctx, tx + 0.5, ty + 0.5, 16, st.aimAngle || 0, 15, '#2b333d', zScale);
        break;
      }

      case 'missile_pod': {
        // Multi-cell Tactical Grenade/SAM Pod
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 9, {
          base: '#4c574a'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 12, {
          base: isUnpowered ? '#596159' : '#6c7d65',
          stroke: '#94a3b8'
        });
        const podTop = Iso.gridToScreen(tx + 0.5, ty + 0.5, 22);
        ctx.fillStyle = isUnpowered ? '#444' : P.danger;
        ctx.beginPath();
        ctx.arc(podTop.x - 3 * zScale, podTop.y, 2 * zScale, 0, Math.PI * 2);
        ctx.arc(podTop.x + 3 * zScale, podTop.y, 2 * zScale, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'emp_coil': {
        // Futuristic Tesla EMP Pylon
        Iso.drawVoxelBox(ctx, tx + 0.16, ty + 0.16, 1, 0.68, 0.68, 8, {
          base: '#3e4a59'
        });
        Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 9, 0.32, 0.32, 17, {
          base: '#60748a'
        });
        const orb = Iso.gridToScreen(tx + 0.5, ty + 0.5, 29);
        const pulse = isUnpowered ? 0.55 : 0.85 + 0.2 * Math.sin(timeSec * 7);
        ctx.fillStyle = isUnpowered ? P.powerDim : P.power;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 5.8 * zScale * pulse, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'solar_array': {
        // Pedestal + Aluminum Tray + Glossy Photovoltaic Panel
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.35, 1, 0.30, 0.30, 8, {
          base: '#7b8996'
        });
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.12, 9, 0.84, 0.76, 2.2, {
          base: '#9cb0c4'
        });
        Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.15, 11.2, 0.78, 0.70, 1.8, {
          base: '#286ec2',
          stroke: '#8ec8ff'
        });
        // Solar reflection line
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
        // Sleek Modern 3-Blade Wind Turbine
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, 1, 0.44, 0.44, 5, {
          base: '#758594'
        });
        Iso.drawVoxelBox(ctx, tx + 0.40, ty + 0.40, 6, 0.20, 0.20, 28, {
          base: '#f0f5fa'
        });
        const hub = Iso.gridToScreen(tx + 0.5, ty + 0.5, 35);
        const bladeAngle = timeSec * 2.8 + (tx + ty);
        ctx.strokeStyle = '#f5f9fc';
        ctx.lineWidth = 2.6 * zScale;
        for (let b = 0; b < 3; b++) {
          const a = bladeAngle + (b * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(hub.x, hub.y);
          ctx.lineTo(hub.x + Math.cos(a) * 16 * zScale, hub.y + Math.sin(a) * 14 * zScale);
          ctx.stroke();
        }
        ctx.fillStyle = P.power;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, 3 * zScale, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'battery_bank': {
        // Lithium ESS Battery Cabinet with Emissive Charge LED
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 19, {
          base: '#e2ebf2',
          stroke: P.power
        });
        const ratio = Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.25, 6, 0.78, 0.50, Math.max(2, 10 * ratio), {
          base: ledColor,
          emissive: true
        });
        break;
      }

      case 'field_tent': {
        // Modern Olive Tactical Dome Tent
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 9, {
          base: '#5d7059'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 6, {
          base: '#72876d'
        });
        // Warm illuminated tent window
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.86, 4, 0.30, 0.06, 4, {
          base: P.baseLight,
          emissive: true
        });
        break;
      }

      case 'shelter_pod': {
        // Modern Modular Container Home (container wall + terracotta roof cap)
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.12, 1, 0.88, 0.76, 13.5, {
          base: '#dce5ed',
          stroke: 'rgba(255,255,255,0.2)'
        });
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.11, 14.5, 0.90, 0.78, 2.5, {
          base: '#ea6a3b'
        });
        // Warm illuminated panoramic window
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.85, 5.5, 0.55, 0.06, 7, {
          base: P.baseLight,
          emissive: true
        });
        // Rooftop HVAC unit
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.25, 17, 0.32, 0.32, 4, {
          base: '#8fa0b0'
        });
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

  function drawOperatorFigure(ctx, gx, gy, zBase, vestColor, helmetAccent, aimAngle, zScale, hasLaser) {
    const Iso = ZS.Iso;
    // Voxel torso + face + helmet cap (each single-material with unified top-left shading)
    Iso.drawVoxelBox(ctx, gx - 0.11, gy - 0.11, zBase, 0.22, 0.22, 8, {
      base: vestColor
    });
    Iso.drawVoxelBox(ctx, gx - 0.08, gy - 0.08, zBase + 8, 0.16, 0.16, 3.4, {
      base: '#debda0'
    });
    Iso.drawVoxelBox(ctx, gx - 0.095, gy - 0.095, zBase + 11.4, 0.19, 0.19, 2.8, {
      base: helmetAccent
    });
    drawTurretBarrel(ctx, gx, gy, zBase + 6, aimAngle, hasLaser ? 16 : 12, '#1f242b', zScale);
    if (hasLaser) {
      const p1 = Iso.gridToScreen(gx, gy, zBase + 6);
      const tx = gx + Math.cos(aimAngle) * 1.4;
      const ty = gy + Math.sin(aimAngle) * 1.4;
      const p2 = Iso.gridToScreen(tx, ty, zBase + 4);
      ctx.strokeStyle = 'rgba(255, 65, 65, 0.45)';
      ctx.lineWidth = 1 * zScale;
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
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.0 * zScale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  function getZombieEyePositions(z, zDef, timeSec, zScale) {
    const Iso = ZS.Iso;
    const sc = zDef.scale || 1.0;
    const bob = Math.abs(Math.sin(timeSec * 8 + z.seed)) * 2.4;
    const headCenter = Iso.gridToScreen(z.x, z.y, 1 + bob + 13.6 * sc);

    const ang = typeof z.facingAngle === 'number' ? z.facingAngle : Math.PI * 0.75;
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);

    let sx = fx - fy;
    let sy = (fx + fy) * 0.5;
    const len = Math.hypot(sx, sy) || 1;
    sx /= len;
    sy = Math.max(-0.18, sy / len);

    const fwdX = sx * 2.4 * sc * zScale;
    const fwdY = sy * 1.9 * sc * zScale;
    const sep = 2.3 * sc * zScale;

    return {
      cx: headCenter.x + fwdX,
      cy: headCenter.y + fwdY,
      lx: headCenter.x + fwdX - sep,
      ly: headCenter.y + fwdY,
      rx: headCenter.x + fwdX + sep,
      ry: headCenter.y + fwdY,
      sc
    };
  }

  function drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P) {
    const eyeSz = Math.max(1.8, 2.0 * eyes.sc * zScale);
    ctx.fillStyle = P.outlineDark || '#1B2430';
    ctx.fillRect(eyes.lx - eyeSz * 0.5 - 0.7, eyes.ly - eyeSz * 0.5 - 0.7, eyeSz + 1.4, eyeSz + 1.4);
    ctx.fillRect(eyes.rx - eyeSz * 0.5 - 0.7, eyes.ry - eyeSz * 0.5 - 0.7, eyeSz + 1.4, eyeSz + 1.4);

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
      const structH = st.id === 'command_hq' ? hqOccH : st.id === 'sniper_tower' ? 30 : 22;
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
    const sc = zDef.scale || 1.0;
    const bob = Math.abs(Math.sin(timeSec * 8 + z.seed)) * 2.4;

    const basePos = Iso.gridToScreen(z.x, z.y, 1);

    // Boss pulsing danger threat ring on ground
    if (zDef.isBoss) {
      const pulse = 0.92 + 0.10 * Math.sin(timeSec * 5);
      ctx.fillStyle = P.dangerFill;
      ctx.strokeStyle = P.danger;
      ctx.lineWidth = 1.8 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 14 * sc * zScale * pulse, 7.2 * sc * zScale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Crisp ground contact shadow for strong luminance separation against grass
    ctx.fillStyle = 'rgba(8, 10, 16, 0.48)';
    ctx.beginPath();
    ctx.ellipse(basePos.x, basePos.y, 8.8 * sc * zScale, 4.6 * sc * zScale, 0, 0, Math.PI * 2);
    ctx.fill();

    Iso.setEntityFlash(z.hitFlash || 0);

    const w = 0.25 * sc;
    // Legs + Torso (complementary coat per issue-03-palette-tokens.md §4)
    Iso.drawVoxelBox(ctx, z.x - w * 0.5, z.y - w * 0.5, 1 + bob, w, w, 10 * sc, {
      base: zDef.coatColor
    });

    // Runner harness (#FF9466) / Brute armor (#C97A9E) / Boss glowing fissure (#E040FB)
    if (z.type === 'runner' && zDef.accentColor) {
      const rw = 0.27 * sc;
      Iso.drawVoxelBox(ctx, z.x - rw * 0.5, z.y - rw * 0.5, 1 + bob + 6.2 * sc, rw, rw, 2.8 * sc, {
        base: zDef.accentColor
      });
    } else if (z.type === 'brute' && zDef.armorColor) {
      const aw = 0.30 * sc;
      Iso.drawVoxelBox(ctx, z.x - aw * 0.5, z.y - aw * 0.5, 1 + bob + 4.5 * sc, aw, aw, 4.8 * sc, {
        base: zDef.armorColor
      });
    } else if (zDef.isBoss && zDef.accentColor) {
      const bw = 0.29 * sc;
      Iso.drawVoxelBox(ctx, z.x - bw * 0.5, z.y - bw * 0.5, 1 + bob + 4.8 * sc, bw, bw, 3.8 * sc, {
        base: zDef.accentColor,
        emissive: true
      });
    }

    // Infected Voxel Head (pale rose/bone/mauve/lavender per issue-03-palette-tokens.md §4)
    const hw = 0.20 * sc;
    Iso.drawVoxelBox(ctx, z.x - hw * 0.5, z.y - hw * 0.5, 1 + bob + 10 * sc, hw, hw, 6.8 * sc, {
      base: zDef.skinColor,
      stroke: 'rgba(27, 36, 48, 0.38)'
    });

    Iso.setEntityFlash(0);

    // Depth-sorted daytime/lit eyes (naturally occluded by foreground 3D structures)
    const eyes = getZombieEyePositions(z, zDef, timeSec, zScale);
    drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P);

    // Slowed EMP cyan tint ring
    if (z.slowTimer > 0) {
      ctx.strokeStyle = P.power;
      ctx.lineWidth = 1.4 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 9.2 * sc * zScale, 5 * sc * zScale, 0, 0, Math.PI * 2);
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
      if (p.kind === 'chain') {
        ctx.strokeStyle = ZS.DATA.PALETTE.power;
        ctx.lineWidth = 2.2 * zScale;
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

  function drawParticles(ctx, particles, zScale) {
    const Iso = ZS.Iso;
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const sc = Iso.gridToScreen(pt.x, pt.y, pt.z);
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, pt.size * zScale, 0, Math.PI * 2);
      ctx.fill();
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
        } else if (def.subType === 'manned' || def.subType === 'turret') {
          punchHole(x + 0.5, y + 0.5, 10, 1.65, 0.55);
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

    ctx.drawImage(lightCanvas, 0, 0);

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
      ctx.globalAlpha = state.nightAlpha * 0.55;
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

        if (isDamaged) {
          let hpZ = 28;
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
      } else {
        const z = item.z;
        const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;

        if (state.nightAlpha > 0.05) {
          const eyes = getZombieEyePositions(z, zDef, timeSec, zScale);
          if (!isZombieEyesOccluded(state, z, eyes, zScale)) {
            nightEyes.push({ eyes, zDef });
          }
        }

        if (z.hp < z.maxHp || zDef.isBoss) {
          const sc = zDef.scale || 1.0;
          const bob = Math.abs(Math.sin(timeSec * 8 + z.seed)) * 2.4;
          const hpTop = Iso.gridToScreen(z.x, z.y, 20 * sc + bob);
          const bw = (zDef.isBoss ? 40 : 20) * zScale;
          const bh = (zDef.isBoss ? 5 : 3.2) * zScale;
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
