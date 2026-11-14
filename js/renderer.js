window.ZS = window.ZS || {};

ZS.Renderer = (function () {
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');

  function ensureLightCanvas(w, h) {
    if (lightCanvas.width !== w || lightCanvas.height !== h) {
      lightCanvas.width = w;
      lightCanvas.height = h;
    }
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

    // 2. 3D Miniature Diorama Island Base Slab
    Iso.drawVoxelBox(ctx, 0, 0, -14, N, N, 14, {
      top: P.terrainB,
      left: P.slabSideLeft,
      right: P.slabSideRight,
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
      if (st && st.id !== 'command_hq') {
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
        top: '#323842',
        left: '#232830',
        right: '#1c2026'
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
        top: '#606f80',
        left: '#434f5c',
        right: '#343e49',
        stroke: 'rgba(210,230,250,0.22)'
      });
      const c = Iso.gridToScreen(x + 0.5, y + 0.5, 2.2);
      ctx.fillStyle = 'rgba(220,235,255,0.3)';
      ctx.fillRect(c.x - 2 * zScale, c.y - 1 * zScale, 4 * zScale, 2 * zScale);
    } else if (floorId === 'lounge_tile') {
      const sub = (x + y) % 2 === 0 ? '#d8d2c5' : '#cbc4b5';
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2, {
        top: sub,
        left: '#9e9788',
        right: '#847e71',
        stroke: 'rgba(255,255,255,0.28)'
      });
    } else if (floorId === 'hazard_mat') {
      Iso.drawVoxelBox(ctx, x + 0.02, y + 0.02, 0, 0.96, 0.96, 2, {
        top: '#3b424c',
        left: '#b87d4b',
        right: '#8f5e36',
        stroke: '#c98e5b'
      });
      Iso.drawVoxelBox(ctx, x + 0.16, y + 0.16, 2, 0.68, 0.68, 0.5, {
        top: '#2a3038'
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

    switch (id) {
      case 'command_hq': {
        // Armored Modern Command HQ (warm command visor instead of power-cyan)
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.05, 1, 0.90, 0.90, 18, {
          top: '#4e6073',
          left: '#364452',
          right: '#293440',
          stroke: 'rgba(255,255,255,0.22)'
        });
        Iso.drawVoxelBox(ctx, tx + 0.04, ty + 0.04, 13, 0.92, 0.92, 3, {
          top: P.baseLight,
          left: '#ddb464',
          right: '#b8944d'
        });
        // Upper tactical bridge
        Iso.drawVoxelBox(ctx, tx + 0.18, ty + 0.18, 19, 0.64, 0.64, 11, {
          top: '#dce4ec',
          left: '#aebbc9',
          right: '#8a98a8'
        });
        // Rotating radar dish on roof
        const dishPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, 34);
        const rot = timeSec * 1.8;
        ctx.strokeStyle = '#cbd6e2';
        ctx.lineWidth = 2.2 * zScale;
        ctx.beginPath();
        ctx.moveTo(dishPos.x, dishPos.y + 4 * zScale);
        ctx.lineTo(dishPos.x, dishPos.y - 5 * zScale);
        ctx.stroke();

        ctx.save();
        ctx.translate(dishPos.x, dishPos.y - 5 * zScale);
        ctx.fillStyle = '#eef5fc';
        ctx.beginPath();
        ctx.ellipse(Math.cos(rot) * 2 * zScale, 0, 7 * zScale, 4 * zScale, Math.sin(rot) * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // Blinking comms beacon
        ctx.fillStyle = Math.sin(timeSec * 5) > 0 ? P.danger : '#ffe2a8';
        ctx.beginPath();
        ctx.arc(0, -4 * zScale, 2.2 * zScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'hesco_wall': {
        // Modern HESCO military gabion bastion
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 1, 0.84, 0.84, 16, {
          top: '#d6c49e',
          left: '#b8a47c',
          right: '#968460',
          stroke: '#635947'
        });
        // Wire mesh frame band
        Iso.drawVoxelBox(ctx, tx + 0.07, ty + 0.07, 8, 0.86, 0.86, 2, {
          top: '#6c7680',
          left: '#555e66',
          right: '#41484f'
        });
        break;
      }

      case 'blast_wall': {
        // Heavy Armored Alloy Blast Barrier (copper-bronze stripe instead of coin gold)
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.06, 1, 0.88, 0.88, 20, {
          top: '#5f6f82',
          left: '#414d5c',
          right: '#2e3844',
          stroke: '#8396ad'
        });
        Iso.drawVoxelBox(ctx, tx + 0.05, ty + 0.05, 5, 0.90, 0.90, 3, {
          top: '#c4834b',
          left: '#a36b3b',
          right: '#82542d'
        });
        break;
      }

      case 'razor_pad': {
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.08, 0.5, 0.84, 0.84, 2, {
          top: '#454e59',
          left: '#303740',
          right: '#252b33'
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
          top: '#6e7d68',
          left: '#54614f',
          right: '#3f4a3b',
          stroke: '#85967e'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 11, '#4b5d46', '#2e3830', st.aimAngle || 0, zScale, false);
        break;
      }

      case 'shotgun_post': {
        // Ballistic Shield Breacher Post
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 11, {
          top: '#4d5968',
          left: '#38424f',
          right: '#2a323d',
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
            top: '#7c8b99',
            left: '#5b6875',
            right: '#434d57'
          });
        });
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 21, 0.80, 0.80, 4, {
          top: '#637282',
          left: '#495563',
          right: '#37414d',
          stroke: '#94a6b8'
        });
        drawOperatorFigure(ctx, tx + 0.5, ty + 0.5, 25, '#3d4d42', '#6f8072', st.aimAngle || 0, zScale, true);
        break;
      }

      case 'vulcan_turret': {
        // CIWS Radar Dome Auto-Turret
        Iso.drawVoxelBox(ctx, tx + 0.14, ty + 0.14, 1, 0.72, 0.72, 9, {
          top: '#525f6e',
          left: '#3b4552',
          right: '#2c343e'
        });
        Iso.drawVoxelBox(ctx, tx + 0.25, ty + 0.25, 10, 0.50, 0.50, 13, {
          top: isUnpowered ? '#7a828a' : '#eef4fa',
          left: isUnpowered ? '#5c636b' : '#cad5e2',
          right: isUnpowered ? '#464c52' : '#a4b3c4'
        });
        drawTurretBarrel(ctx, tx + 0.5, ty + 0.5, 16, st.aimAngle || 0, 15, '#2b333d', zScale);
        break;
      }

      case 'missile_pod': {
        // Multi-cell Tactical Grenade/SAM Pod
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 9, {
          top: '#4c574a',
          left: '#384237',
          right: '#2a3329'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 12, {
          top: isUnpowered ? '#596159' : '#6c7d65',
          left: '#4e5c48',
          right: '#3b4737',
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
          top: '#3e4a59',
          left: '#2c3540',
          right: '#202730'
        });
        Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 9, 0.32, 0.32, 17, {
          top: '#60748a',
          left: '#445566',
          right: '#323f4d'
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
        // Pedestal + Glossy Photovoltaic Panel
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.35, 1, 0.30, 0.30, 8, {
          top: '#7b8996',
          left: '#5b6773',
          right: '#454f59'
        });
        Iso.drawVoxelBox(ctx, tx + 0.08, ty + 0.12, 9, 0.84, 0.76, 4, {
          top: '#2466b5',
          left: '#90a2b5',
          right: '#708294',
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
          top: '#758594',
          left: '#55626e',
          right: '#404a54'
        });
        Iso.drawVoxelBox(ctx, tx + 0.40, ty + 0.40, 6, 0.20, 0.20, 28, {
          top: '#f0f5fa',
          left: '#d0dbe6',
          right: '#b0becd'
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
        // Lithium ESS Battery Cabinet with Charge LED
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 1, 0.76, 0.76, 19, {
          top: '#e2ebf2',
          left: '#b8c7d4',
          right: '#8fa1b3',
          stroke: P.power
        });
        const ratio = Math.max(0, Math.min(1, state.powerCap > 0 ? state.power / state.powerCap : 0));
        const ledColor = ratio > 0.35 ? P.power : ratio > 0.05 ? P.healthMid : P.danger;
        Iso.drawVoxelBox(ctx, tx + 0.11, ty + 0.25, 6, 0.78, 0.50, Math.max(2, 10 * ratio), {
          top: ledColor,
          left: ledColor,
          right: ledColor
        });
        break;
      }

      case 'field_tent': {
        // Modern Olive Tactical Dome Tent
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 9, {
          top: '#5d7059',
          left: '#495946',
          right: '#384536'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 10, 0.60, 0.60, 6, {
          top: '#72876d',
          left: '#5b6e57',
          right: '#475744'
        });
        // Warm tent window
        Iso.drawVoxelBox(ctx, tx + 0.35, ty + 0.86, 4, 0.30, 0.06, 4, {
          top: '#ffd480',
          left: '#ffd480',
          right: '#e6b85c'
        });
        break;
      }

      case 'shelter_pod': {
        // Modern Modular Container Home
        Iso.drawVoxelBox(ctx, tx + 0.06, ty + 0.12, 1, 0.88, 0.76, 16, {
          top: '#ea6a3b',
          left: '#dce5ed',
          right: '#b8c5d1',
          stroke: '#ffffff33'
        });
        // Warm illuminated panoramic window
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.85, 6, 0.55, 0.06, 7, {
          top: '#ffe09e',
          left: '#ffe09e',
          right: '#f5c76e'
        });
        // Rooftop HVAC unit
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.25, 17, 0.32, 0.32, 4, {
          top: '#8fa0b0',
          left: '#6e7e8d',
          right: '#556370'
        });
        break;
      }

      case 'gas_heater': {
        // Stainless Outdoor Patio Gas Heater (No Electricity!)
        Iso.drawVoxelBox(ctx, tx + 0.32, ty + 0.32, 1, 0.36, 0.36, 9, {
          top: '#7d8a96',
          left: '#5d6873',
          right: '#465059'
        });
        // Glowing amber flame cylinder
        Iso.drawVoxelBox(ctx, tx + 0.38, ty + 0.38, 10, 0.24, 0.24, 9, {
          top: '#ffb347',
          left: '#ff9636',
          right: '#e6781e'
        });
        // Reflector canopy
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 19, 0.60, 0.60, 2.5, {
          top: '#cfd9e3',
          left: '#9aa8b5',
          right: '#7b8894'
        });
        break;
      }

      case 'led_floodlight': {
        // Tactical Tripod Mast + Twin LED Floodlights
        Iso.drawVoxelBox(ctx, tx + 0.34, ty + 0.34, 1, 0.32, 0.32, 4, {
          top: '#525f6e',
          left: '#3b4552',
          right: '#2c343e'
        });
        Iso.drawVoxelBox(ctx, tx + 0.44, ty + 0.44, 5, 0.12, 0.12, 20, {
          top: '#8a99a8',
          left: '#657382',
          right: '#4b5763'
        });
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.32, 25, 0.56, 0.36, 5, {
          top: isUnpowered ? P.powerDim : '#e6fcff',
          left: isUnpowered ? '#226873' : P.power,
          right: isUnpowered ? '#1b535c' : '#2dbbd1'
        });
        break;
      }

      case 'urban_planter': {
        // Architectural Concrete Planter + Miniature Lush Tree
        Iso.drawVoxelBox(ctx, tx + 0.16, ty + 0.16, 1, 0.68, 0.68, 7, {
          top: '#5e493a',
          left: '#b8c0c7',
          right: '#929ba3'
        });
        Iso.drawVoxelBox(ctx, tx + 0.42, ty + 0.42, 8, 0.16, 0.16, 8, {
          top: '#78583f',
          left: '#694b34',
          right: '#523926'
        });
        Iso.drawVoxelBox(ctx, tx + 0.20, ty + 0.20, 15, 0.60, 0.60, 10, {
          top: '#64c466',
          left: '#4aa84d',
          right: '#38873a'
        });
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.28, 25, 0.44, 0.44, 6, {
          top: '#7ede78',
          left: '#5ec25a',
          right: '#469c43'
        });
        break;
      }

      case 'vending_machine': {
        // Glowing Smart Drink Vending Machine (warm internal display, not electric cyan)
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 1, 0.56, 0.56, 21, {
          top: '#475569',
          left: '#334155',
          right: '#1e293b'
        });
        Iso.drawVoxelBox(ctx, tx + 0.28, ty + 0.75, 7, 0.42, 0.06, 11, {
          top: '#ffe8c2',
          left: '#ffe8c2',
          right: '#f5cfa0'
        });
        break;
      }

      case 'repair_bay': {
        // Robotic Maintenance Bay
        Iso.drawVoxelBox(ctx, tx + 0.10, ty + 0.10, 1, 0.80, 0.80, 5, {
          top: '#475361',
          left: '#353e4a',
          right: '#262d36'
        });
        Iso.drawVoxelBox(ctx, tx + 0.25, ty + 0.20, 6, 0.50, 0.35, 12, {
          top: P.health,
          left: '#3bb570',
          right: '#2b8f56'
        });
        break;
      }

      case 'lounge_set': {
        // Modern Parasol & Lounge Table
        Iso.drawVoxelBox(ctx, tx + 0.32, ty + 0.32, 1, 0.36, 0.36, 7, {
          top: '#e8eef5',
          left: '#b8c4d1',
          right: '#929fab'
        });
        Iso.drawVoxelBox(ctx, tx + 0.46, ty + 0.46, 8, 0.08, 0.08, 13, {
          top: '#cbd5e0',
          left: '#a0aec0',
          right: '#718096'
        });
        Iso.drawVoxelBox(ctx, tx + 0.12, ty + 0.12, 21, 0.76, 0.76, 4, {
          top: '#e07a5f',
          left: '#c4664d',
          right: '#9e4f3b'
        });
        break;
      }

      case 'arcade_neon': {
        // Neon Sign + Arcade Station
        Iso.drawVoxelBox(ctx, tx + 0.22, ty + 0.22, 1, 0.56, 0.56, 18, {
          top: '#3a2c54',
          left: '#2b2040',
          right: '#1e162e',
          stroke: isUnpowered ? '#555' : '#eb64ff'
        });
        Iso.drawVoxelBox(ctx, tx + 0.26, ty + 0.26, 19, 0.48, 0.48, 6, {
          top: isUnpowered ? '#52495c' : '#ff66e5',
          left: isUnpowered ? '#403947' : '#df52ff',
          right: isUnpowered ? '#302b36' : '#b83be0'
        });
        break;
      }

      case 'boss_trophy': {
        Iso.drawVoxelBox(ctx, tx + 0.18, ty + 0.18, 1, 0.64, 0.64, 10, {
          top: '#2e3744',
          left: '#232a34',
          right: '#191f26'
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
  }

  function drawOperatorFigure(ctx, gx, gy, zBase, vestColor, helmetAccent, aimAngle, zScale, hasLaser) {
    const Iso = ZS.Iso;
    // Voxel torso & helmeted head
    Iso.drawVoxelBox(ctx, gx - 0.11, gy - 0.11, zBase, 0.22, 0.22, 8, {
      top: vestColor,
      left: vestColor,
      right: '#252e27'
    });
    Iso.drawVoxelBox(ctx, gx - 0.09, gy - 0.09, zBase + 8, 0.18, 0.18, 6, {
      top: helmetAccent,
      left: '#d8b898',
      right: '#bd9d7e'
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

  function drawZombie(ctx, z, timeSec, zScale) {
    const Iso = ZS.Iso;
    const zDef = ZS.DATA.ZOMBIES[z.type] || ZS.DATA.ZOMBIES.walker;
    const sc = zDef.scale || 1.0;
    const bob = Math.abs(Math.sin(timeSec * 8 + z.seed)) * 2.4;

    const basePos = Iso.gridToScreen(z.x, z.y, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(basePos.x, basePos.y, 8 * sc * zScale, 4.2 * sc * zScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const w = 0.24 * sc;
    // Legs + Torso
    Iso.drawVoxelBox(ctx, z.x - w * 0.5, z.y - w * 0.5, 1 + bob, w, w, 10 * sc, {
      top: zDef.coatColor,
      left: zDef.coatColor,
      right: '#232830'
    });
    // Infected Voxel Head
    const hw = 0.19 * sc;
    Iso.drawVoxelBox(ctx, z.x - hw * 0.5, z.y - hw * 0.5, 1 + bob + 10 * sc, hw, hw, 6.5 * sc, {
      top: zDef.skinColor,
      left: zDef.skinColor,
      right: '#4f7354'
    });

    // Slowed EMP cyan tint ring
    if (z.slowTimer > 0) {
      ctx.strokeStyle = ZS.DATA.PALETTE.power;
      ctx.lineWidth = 1.4 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 9 * sc * zScale, 5 * sc * zScale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawProjectiles(ctx, projectiles, zScale) {
    const Iso = ZS.Iso;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
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

    // HQ always maintains warm emergency command light
    punchHole(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 14, 3.8, 0.92);
    colorGlows.push({
      gx: DATA.HQ_POS.x + 0.5,
      gy: DATA.HQ_POS.y + 0.5,
      z: 14,
      r: 3.0,
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
          const barPos = Iso.gridToScreen(tx + 0.5, ty + 0.5, id === 'command_hq' ? 40 : 28);
          const bw = (id === 'command_hq' ? 38 : 26) * zScale;
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
