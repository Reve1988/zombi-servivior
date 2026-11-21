window.ZS = window.ZS || {};

(function () {
  const G = ZS._Game;
  const { DATA, N, PROD_SAVE_KEY, DEV_SAVE_KEY, SETTINGS_KEY, state } = G;

  const MAX_PARTICLES = 240;
  let particleEvictCursor = 0;

  function pushParticle(pt) {
    if (state.particles.length < MAX_PARTICLES) {
      state.particles.push(pt);
      return;
    }
    state.particles[particleEvictCursor] = pt;
    particleEvictCursor = (particleEvictCursor + 1) % MAX_PARTICLES;
  }

  function scaleWaveDrop(rawAmount, waveNum, isBoss) {
    const w = waveNum || 1;
    if (w < 10 || rawAmount <= 0) return rawAmount;
    const baseScale = Math.max(0.35, 1 / (1 + (w - 9) * 0.08));
    const scale = isBoss ? Math.max(0.70, baseScale) : baseScale;
    const exact = rawAmount * scale;
    const whole = Math.floor(exact);
    return whole + (Math.random() < (exact - whole) ? 1 : 0);
  }

  function damageZombie(index, amount, textColor, isCrit, sourceUid) {
    const z = state.zombies[index];
    if (!z) return;
    const dmg = Math.max(1, Math.round(amount));
    z.hp -= dmg;
    z.hitFlashTimer = 0.045;
    z.hitFlash = 1.0;
    spawnBurstParticles(z.x, z.y, 10, DATA.PALETTE.danger, 3);

    if (sourceUid !== '__silent_text__' && (dmg >= 15 || isCrit)) {
      addFloatingText(
        z.x + (Math.random() - 0.5) * 0.25,
        z.y,
        18,
        isCrit ? `${dmg}!` : `${dmg}`,
        isCrit ? DATA.PALETTE.critText : textColor || '#fff',
        isCrit ? 13 : 12,
        isCrit ? DATA.PALETTE.critStroke : null
      );
    }

    if (z.hp <= 0) {
      const def = DATA.ZOMBIES[z.type];
      const rawScrap = randInt(def.scrapDrop[0], def.scrapDrop[1]);
      const rawCoin = randInt(def.coinDrop[0], def.coinDrop[1]);
      const scrapGain = scaleWaveDrop(rawScrap, state.wave, !!def.isBoss);
      const coinGain = scaleWaveDrop(rawCoin, state.wave, !!def.isBoss);
      const woodGain = def.woodDrop ? randInt(def.woodDrop[0], def.woodDrop[1]) : 0;
      state.scrap += scrapGain;
      state.coin += coinGain;
      if (woodGain > 0) state.wood += woodGain;
      state.waveKilledZombies += 1;

      G.awardKillXpBySourceUid(sourceUid, z.type, !!def.isBoss);

      spawnBurstParticles(z.x, z.y, 10, DATA.PALETTE.danger, def.isBoss ? 16 : 9);
      spawnZombieDeathVfx(z, def);
      if (z.type === 'shocker') {
        G.triggerShockerEmp(z.x, z.y, def.empRadius || 2.1, def.empDuration || 3.0);
      }
      if (def.isBoss) {
        state.bossDefeated = true;
        const bossRp = Math.round(6 * (1 + (state.b1BossRpMult || 0)));
        state.rp = (state.rp || 0) + bossRp;
        if (G.recordDivisionProgress) {
          G.recordDivisionProgress(state.divisionId, state.wave, state.wave >= 20);
        }
        if (woodGain > 0) {
          addFloatingText(z.x - 0.32, z.y, 22, `+${woodGain}`, DATA.PALETTE.resWood, 13, DATA.PALETTE.outlineDark);
        }
        addFloatingText(z.x - 0.05, z.y, 25, `+${scrapGain}`, DATA.PALETTE.resScrap, 13, DATA.PALETTE.outlineDark);
        addFloatingText(z.x + 0.24, z.y, 27, `+${coinGain}`, DATA.PALETTE.coin, 13, DATA.PALETTE.outlineDark);
        addFloatingText(z.x + 0.38, z.y, 31, `+${bossRp} RP`, '#C084FC', 13, DATA.PALETTE.outlineDark);
        const woodTxt = woodGain > 0 ? `목재 +${woodGain} · ` : '';
        G.banner('알파 보스 격파!', `${woodTxt}고철 +${scrapGain} · 코인 +${coinGain} · 연구 +${bossRp} RP 획득 · 생존 전투원 숙련도 보너스 & 특수 기념비 해금!`, 'good');
      } else if (woodGain > 0 && Math.random() < 0.45) {
        addFloatingText(z.x, z.y, 16, `+${woodGain}`, DATA.PALETTE.resWood, 12, DATA.PALETTE.outlineDark);
      } else if (scrapGain > 0 && (Math.random() < 0.35 || z.type === 'brute')) {
        addFloatingText(z.x, z.y, 16, `+${scrapGain}`, DATA.PALETTE.resScrap, 12, DATA.PALETTE.outlineDark);
      }

      state.zombies.splice(index, 1);
      G._zombieBucketsDirty = true;
      G.notifyCombatHud();
    }
  }

  function findSpitterTargetInRange(z, tx, ty, rangeTiles) {
    const hqCx = DATA.HQ_POS.x + 0.5;
    const hqCy = DATA.HQ_POS.y + 0.5;
    let cx = tx;
    let cy = ty;
    const visited = new Set([`${cx},${cy}`]);
    for (let stepIdx = 0; stepIdx < 6; stepIdx++) {
      const st = state.structGrid[cy] && state.structGrid[cy][cx];
      if (st) {
        if (st.id === 'command_hq') {
          if (
            Math.hypot(hqCx - z.x, hqCy - z.y) <= rangeTiles &&
            (!G.hasDirectLineOfSight || G.hasDirectLineOfSight(z.x, z.y, hqCx, hqCy))
          ) {
            return { tx: cx, ty: cy, gx: hqCx, gy: hqCy };
          }
          break;
        }
        const def = DATA.ITEMS[st.id];
        if (!(def && def.passable)) {
          const candGx = cx + 0.5;
          const candGy = cy + 0.5;
          if (
            Math.hypot(candGx - z.x, candGy - z.y) <= rangeTiles &&
            (!G.hasDirectLineOfSight || G.hasDirectLineOfSight(z.x, z.y, candGx, candGy))
          ) {
            return { tx: cx, ty: cy, gx: candGx, gy: candGy };
          }
          break;
        }
      }
      const nextStep = state.flow && state.flow.next[cy] && state.flow.next[cy][cx];
      if (!nextStep) break;
      cx += nextStep.dx;
      cy += nextStep.dy;
      const key = `${cx},${cy}`;
      if (visited.has(key) || cx < 0 || cy < 0 || cx >= N || cy >= N) break;
      visited.add(key);
    }
    if (
      Math.hypot(hqCx - z.x, hqCy - z.y) <= rangeTiles &&
      state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x] &&
      (!G.hasDirectLineOfSight || G.hasDirectLineOfSight(z.x, z.y, hqCx, hqCy))
    ) {
      return { tx: DATA.HQ_POS.x, ty: DATA.HQ_POS.y, gx: hqCx, gy: hqCy };
    }
    let best = null;
    let bestD = Infinity;
    const minX = Math.max(0, Math.floor(z.x - rangeTiles - 1));
    const maxX = Math.min(N - 1, Math.ceil(z.x + rangeTiles + 1));
    const minY = Math.max(0, Math.floor(z.y - rangeTiles - 1));
    const maxY = Math.min(N - 1, Math.ceil(z.y + rangeTiles + 1));
    for (let sy = minY; sy <= maxY; sy++) {
      for (let sx = minX; sx <= maxX; sx++) {
        const st = state.structGrid[sy] && state.structGrid[sy][sx];
        if (!st || st.id === 'command_hq') continue;
        const def = DATA.ITEMS[st.id];
        if (def && def.passable) continue;
        const candGx = sx + 0.5;
        const candGy = sy + 0.5;
        const d = Math.hypot(candGx - z.x, candGy - z.y);
        if (d <= rangeTiles && d < bestD && (!G.hasDirectLineOfSight || G.hasDirectLineOfSight(z.x, z.y, candGx, candGy))) {
          bestD = d;
          best = { tx: sx, ty: sy, gx: candGx, gy: candGy };
        }
      }
    }
    return best;
  }

  function findBossChargeTarget(z, tx, ty) {
    const startT = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
    if (startT && (startT.kind === 'rock' || startT.kind === 'ramp')) return null;
    const startElev = startT && startT.kind === 'plateau' ? 10 : 0;

    let cx = tx;
    let cy = ty;
    const visited = new Set([`${cx},${cy}`]);
    for (let stepIdx = 0; stepIdx < 6; stepIdx++) {
      const nextStep = state.flow && state.flow.next[cy] && state.flow.next[cy][cx];
      if (!nextStep) break;
      const prevX = cx;
      const prevY = cy;
      cx += nextStep.dx;
      cy += nextStep.dy;
      const key = `${cx},${cy}`;
      if (visited.has(key) || cx < 0 || cy < 0 || cx >= N || cy >= N) break;
      visited.add(key);

      if (ZS.Pathfinding && ZS.Pathfinding.canTraverseTerrainStep && !ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, prevX, prevY, cx, cy)) {
        break;
      }
      const cT = G.getTerrainAt ? G.getTerrainAt(cx, cy) : null;
      if (cT && (cT.kind === 'rock' || cT.kind === 'ramp')) break;
      const cElev = cT && cT.kind === 'plateau' ? 10 : 0;
      if (cElev !== startElev) break;

      const st = state.structGrid[cy] && state.structGrid[cy][cx];
      if (!st) continue;
      if (st.id === 'command_hq') break;
      const def = DATA.ITEMS[st.id];
      if (def && def.passable) continue;

      if (def && (def.subType === 'wall' || def.subType === 'gate')) {
        const dist = Math.hypot(cx + 0.5 - z.x, cy + 0.5 - z.y);
        if (dist >= 1.2 && dist <= 3.4) {
          // Verify straight-line samples have clear non-rock, identical-elevation terrain
          let lineClear = true;
          for (let s = 1; s <= 6; s++) {
            const u = s / 7;
            const sx = Math.floor(z.x + (cx + 0.5 - z.x) * u);
            const sy = Math.floor(z.y + (cy + 0.5 - z.y) * u);
            const sT = G.getTerrainAt ? G.getTerrainAt(sx, sy) : null;
            const sElev = sT && sT.kind === 'plateau' ? 10 : 0;
            if ((sT && (sT.kind === 'rock' || sT.kind === 'ramp')) || sElev !== startElev) {
              lineClear = false;
              break;
            }
          }
          if (lineClear) {
            return { tx: cx, ty: cy, gx: cx + 0.5, gy: cy + 0.5 };
          }
        }
      }
      break;
    }
    return null;
  }

  function updateZombies(dt) {
    let structureDestroyed = false;
    const reactiveOn = state.phase === 'night' && !!(state.nightConsumables && state.nightConsumables.reactiveArmor);
    const dmgTakenMult = reactiveOn ? 0.80 : 1.0;
    const defRepeatLv = G.getTechLevel ? G.getTechLevel('def_repeat') : 0;
    const defRepDmgMult = 1 + 0.12 * defRepeatLv;

    // Collect active tactical gates once per tick instead of 5x5 grid scans per zombie
    const activeGates = state.activeGates || (state.activeGates = []);
    activeGates.length = 0;
    const gateDef = DATA.ITEMS.tactical_gate;
    for (let gy = 0; gy < N; gy++) {
      const row = state.structGrid[gy];
      if (!row) continue;
      for (let gx = 0; gx < N; gx++) {
        const gs = row[gx];
        if (!gs || gs.id !== 'tactical_gate' || gs.hp <= 0) continue;
        const gProf = gateDef ? G.getStructLevelProfile(gateDef, gs.level || 1) : null;
        const gRad = (gProf && gProf.gateSlowRadius) || (gateDef && gateDef.gateSlowRadius) || 1.15;
        const gSlow = gProf && gProf.gateSlowFactor ? gProf.gateSlowFactor : 0.75;
        activeGates.push({
          cx: gx + 0.5,
          cy: gy + 0.5,
          st: gs,
          gRadSq: gRad * gRad,
          gSlow
        });
      }
    }

    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      if (!z) continue;
      const zDef = DATA.ZOMBIES[z.type] || DATA.ZOMBIES.walker;

      if (z.slowTimer > 0) z.slowTimer = Math.max(0, z.slowTimer - dt);
      if (z.atkCooldown > 0) z.atkCooldown = Math.max(0, z.atkCooldown - dt);
      if (z.frenzyTimer > 0) z.frenzyTimer = Math.max(0, z.frenzyTimer - dt);
      if (zDef.isBoss) {
        if (z.warCryCd > 0) z.warCryCd = Math.max(0, z.warCryCd - dt);
        if (z.chargeCd > 0) z.chargeCd = Math.max(0, z.chargeCd - dt);
      }

      // Active Boss Siege Charge state (windup 0.45s -> dash 2.6x -> 2.5x wall/gate smash)
      if (z.chargeState) {
        const cs = z.chargeState;
        const targetSt = state.structGrid[cs.targetTy] && state.structGrid[cs.targetTy][cs.targetTx];
        if (!targetSt || targetSt.id === 'command_hq') {
          z.chargeState = null;
        } else if (cs.phase === 'windup') {
          cs.timer += dt;
          z.facingAngle = Math.atan2(cs.targetY - z.y, cs.targetX - z.x);
          if (cs.timer >= cs.windupDur) {
            cs.phase = 'dash';
            cs.timer = 0;
            cs.dashElapsed = 0;
          }
          continue;
        } else if (cs.phase === 'dash') {
          cs.dashElapsed = (cs.dashElapsed || 0) + dt;
          const dx = cs.targetX - z.x;
          const dy = cs.targetY - z.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.01) {
            z.facingAngle = Math.atan2(dy, dx);
          }
          const slowM = z.slowTimer > 0 ? 0.52 : 1.0;
          const frenzyM = z.frenzyTimer > 0 ? 1.3 : 1.0;
          const dashStep = z.speed * 2.6 * slowM * frenzyM * dt;
          if (dist <= 0.86 || dist <= dashStep || cs.dashElapsed >= 2.2) {
            const stopDist = Math.max(0.55, Math.min(dist, 0.72));
            if (dist > 0.01) {
              z.x = cs.targetX - (dx / dist) * stopDist;
              z.y = cs.targetY - (dy / dist) * stopDist;
            }
            const siegeDmg = Math.max(1, Math.round(z.damage * 2.5 * dmgTakenMult));
            targetSt.hp -= siegeDmg;
            targetSt.hitFlashTimer = 0.08;
            targetSt.hitFlash = 1.0;
            triggerScreenShake(6.5, 0.35);
            spawnBurstParticles(cs.targetX, cs.targetY, 16, DATA.PALETTE.danger, 8);
            spawnStructureDebris(cs.targetX, cs.targetY, targetSt.id, 10, targetSt.level || 1);
            if (state.groundDecals.length >= 45) state.groundDecals.shift();
            state.groundDecals.push({
              kind: 'crater_crack',
              x: cs.targetX,
              y: cs.targetY,
              radius: 0.55,
              seed: Math.random() * 10,
              life: 5.5,
              maxLife: 5.5
            });
            addFloatingText(cs.targetX, cs.targetY, 32, `-${siegeDmg}`, DATA.PALETTE.danger, 14, DATA.PALETTE.outlineDark);
            if (targetSt.hp <= 0) {
              destroyBlockingStructureAt(cs.targetTx, cs.targetTy);
              structureDestroyed = true;
            }
            z.chargeState = null;
            z.atkCooldown = 1 / z.attackRate;
            continue;
          } else {
            const curTx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
            const curTy = Math.max(0, Math.min(N - 1, Math.floor(z.y)));
            const nx = z.x + (dx / dist) * dashStep;
            const ny = z.y + (dy / dist) * dashStep;
            const ntx = Math.max(0, Math.min(N - 1, Math.floor(nx)));
            const nty = Math.max(0, Math.min(N - 1, Math.floor(ny)));
            if ((ntx === curTx && nty === curTy) || !ZS.Pathfinding || !ZS.Pathfinding.canTraverseTerrainStep || ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, curTx, curTy, ntx, nty)) {
              z.x = nx;
              z.y = ny;
            } else {
              z.chargeState = null;
            }
            continue;
          }
        }
      }

      // Active Leaper parabolic wall-leap state (0.12s crouch -> 0.42s leap)
      if (z.leapState) {
        const ls = z.leapState;
        z.facingAngle = Math.atan2(ls.targetY - ls.startY, ls.targetX - ls.startX);
        if (ls.phase === 'crouch') {
          ls.timer += dt;
          if (ls.timer >= ls.crouchDur) {
            ls.phase = 'air';
            ls.timer = ls.timer - ls.crouchDur;
          }
          continue;
        }
        ls.timer += dt;
        const u = Math.min(1, ls.timer / ls.airDur);
        z.x = ls.startX + (ls.targetX - ls.startX) * u;
        z.y = ls.startY + (ls.targetY - ls.startY) * u;
        if (u >= 1) {
          z.x = ls.targetX;
          z.y = ls.targetY;
          z.leapState = null;
          spawnBuildDustPuffs(z.x, z.y, 6);
          const landSt = state.structGrid[ls.landTy] && state.structGrid[ls.landTy][ls.landTx];
          if (landSt && landSt.id === 'razor_pad') {
            z.slowTimer = Math.max(z.slowTimer || 0, 2.5);
            const bleedDmg = Math.max(1, Math.round(z.maxHp * 0.30));
            state.projectiles.push({
              kind: 'bleed_burst',
              x: z.x,
              y: z.y,
              z: 3,
              life: 0.32,
              maxLife: 0.32
            });
            addFloatingText(z.x, z.y, 22, `-${bleedDmg}`, DATA.PALETTE.danger, 12, DATA.PALETTE.outlineDark);
            damageZombie(i, bleedDmg, DATA.PALETTE.danger, false, '__silent_text__');
          }
        }
        continue;
      }

      const tx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
      const ty = Math.max(0, Math.min(N - 1, Math.floor(z.y)));

      // Check passable razor pad trap & nearby tactical_gate slow aura (radius 1.15)
      const under = state.structGrid[ty][tx];
      let slowMult = z.slowTimer > 0 ? 0.52 : 1.0;
      const frenzyMult = z.frenzyTimer > 0 ? 1.30 : 1.0;
      z.vulnOnPad = false;
      z.inGateAura = false;
      if (under && under.id === 'razor_pad') {
        const rDef = DATA.ITEMS.razor_pad;
        const rProf = G.getStructLevelProfile(rDef, under.level || 1);
        slowMult = Math.min(slowMult, rProf.slowFactor);
        z.vulnOnPad = rProf.vulnMult > 1.0;
        z.hp -= rProf.trapDps * defRepDmgMult * dt;
        under.hp -= rProf.trapWear * dt;
        if (under.hp <= 0) {
          const rLv = under.level || 1;
          state.structGrid[ty][tx] = null;
          spawnStructureDebris(tx + 0.5, ty + 0.5, 'razor_pad', 7, rLv);
          structureDestroyed = true;
        }
        if (z.hp <= 0) {
          damageZombie(i, 1, '#cbd5e1', false);
          continue;
        }
      }

      for (let gi = 0; gi < activeGates.length; gi++) {
        const gate = activeGates[gi];
        if (gate.st.hp <= 0) continue;
        const gdx = z.x - gate.cx;
        const gdy = z.y - gate.cy;
        if (gdx * gdx + gdy * gdy <= gate.gRadSq) {
          slowMult = Math.min(slowMult, gate.gSlow);
          z.inGateAura = true;
        }
      }

      // Boss Active Skills: War Cry (3.8-tile +30% speed buff for 3.5s) & Siege Charge (1.2~3.4 tiles wall/gate smash)
      if (zDef.isBoss) {
        if (z.warCryCd <= 0) {
          z.warCryCd = 9.0;
          state.projectiles.push({
            kind: 'warcry_ring',
            x: z.x,
            y: z.y,
            radius: 3.8,
            color: DATA.PALETTE.zombieBossCrack || '#E040FB',
            life: 0.50,
            maxLife: 0.50
          });
          triggerScreenShake(3.5, 0.22);
          for (let k = 0; k < state.zombies.length; k++) {
            const oz = state.zombies[k];
            if (!oz) continue;
            const oDef = DATA.ZOMBIES[oz.type];
            if (oDef && oDef.isBoss) continue;
            if (Math.hypot(oz.x - z.x, oz.y - z.y) <= 3.8) {
              oz.frenzyTimer = Math.max(oz.frenzyTimer || 0, 3.5);
            }
          }
        }
        if (z.chargeCd <= 0) {
          const ct = findBossChargeTarget(z, tx, ty);
          if (ct) {
            z.chargeCd = 11.0;
            z.facingAngle = Math.atan2(ct.gy - z.y, ct.gx - z.x);
            z.chargeState = {
              phase: 'windup',
              timer: 0,
              windupDur: 0.45,
              startX: z.x,
              startY: z.y,
              targetTx: ct.tx,
              targetTy: ct.ty,
              targetX: ct.gx,
              targetY: ct.gy
            };
            continue;
          }
        }
      }

      // Check distance to HQ first
      const hqCx = DATA.HQ_POS.x + 0.5;
      const hqCy = DATA.HQ_POS.y + 0.5;
      const distHq = Math.hypot(hqCx - z.x, hqCy - z.y);
      const hqStruct = state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];

      if (distHq <= 0.92 && hqStruct) {
        if (distHq > 0.01) {
          z.facingAngle = Math.atan2(hqCy - z.y, hqCx - z.x);
        }
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          const hqDmg = Math.max(1, Math.round(z.damage * dmgTakenMult));
          hqStruct.hp -= hqDmg;
          hqStruct.hitFlashTimer = 0.05;
          hqStruct.hitFlash = 1.0;
          triggerScreenShake(5.0, 0.28);
          spawnBurstParticles(hqCx, hqCy, 14, DATA.PALETTE.danger, 5);
          addFloatingText(hqCx, hqCy, 28, `-${hqDmg}`, DATA.PALETTE.danger, 12);
          if (hqStruct.hp <= 0) {
            hqStruct.hp = 0;
            spawnStructureDebris(hqCx, hqCy, 'command_hq', 18);
            triggerScreenShake(8.0, 0.45);
            triggerGameOver();
            return;
          }
          if (reactiveOn) {
            const hqRefl = Math.max(4, Math.round(z.damage * 0.15));
            state.projectiles.push({
              kind: 'spark',
              x1: hqCx,
              y1: hqCy,
              x2: z.x,
              y2: z.y,
              z: 14,
              color: DATA.PALETTE.thornSpark || '#FF8A3D',
              life: 0.12,
              maxLife: 0.12
            });
            damageZombie(i, hqRefl, DATA.PALETTE.thornSpark || '#FF8A3D', false);
          }
          G.notifyCombatHud();
        }
        continue;
      }

      // Follow Dijkstra flow field
      const step = state.flow && state.flow.next[ty] && state.flow.next[ty][tx];
      let goalX = hqCx;
      let goalY = hqCy;
      let blockingTarget = null;
      let btx = -1;
      let bty = -1;

      if (step) {
        const ntx = tx + step.dx;
        const nty = ty + step.dy;
        goalX = ntx + 0.5;
        goalY = nty + 0.5;
        const candidate = state.structGrid[nty] && state.structGrid[nty][ntx];
        if (candidate && candidate.id !== 'command_hq') {
          const cDef = DATA.ITEMS[candidate.id];
          if (!(cDef && cDef.passable)) {
            blockingTarget = candidate;
            btx = ntx;
            bty = nty;
          }
        }
      }

      // Leaper single-wall leap (1x per spawn, 1.1-tile check, landing tile must be empty or passable, blocked across rock/ramp/cliff)
      if (z.type === 'leaper' && !z.hasLeaped && step) {
        const ntx = tx + step.dx;
        const nty = ty + step.dy;
        const wallSt = state.structGrid[nty] && state.structGrid[nty][ntx];
        const wallDef = wallSt ? DATA.ITEMS[wallSt.id] : null;
        if (
          wallSt &&
          wallDef &&
          (wallDef.subType === 'wall' || wallDef.subType === 'gate') &&
          Math.hypot(ntx + 0.5 - z.x, nty + 0.5 - z.y) <= 1.1
        ) {
          const ltx = ntx + step.dx;
          const lty = nty + step.dy;
          if (ltx >= 0 && lty >= 0 && ltx < N && lty < N) {
            const curT = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
            const midT = G.getTerrainAt ? G.getTerrainAt(ntx, nty) : null;
            const landT = G.getTerrainAt ? G.getTerrainAt(ltx, lty) : null;
            const curK = curT ? curT.kind : null;
            const midK = midT ? midT.kind : null;
            const landK = landT ? landT.kind : null;
            const terrainForbidden =
              curK === 'rock' || curK === 'ramp' ||
              midK === 'rock' || midK === 'ramp' ||
              landK === 'rock' || landK === 'ramp';
            const curElev = curK === 'plateau' ? 10 : 0;
            const midElev = midK === 'plateau' ? 10 : 0;
            const landElev = landK === 'plateau' ? 10 : 0;
            if (!terrainForbidden && curElev === midElev && midElev === landElev) {
              const landSt = state.structGrid[lty] && state.structGrid[lty][ltx];
              const landDef = landSt ? (landSt.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[landSt.id]) : null;
              if (!landSt || (landDef && landDef.passable)) {
                z.hasLeaped = true;
                z.facingAngle = Math.atan2(lty + 0.5 - z.y, ltx + 0.5 - z.x);
                z.leapState = {
                  phase: 'crouch',
                  timer: 0,
                  crouchDur: 0.12,
                  airDur: 0.42,
                  startX: z.x,
                  startY: z.y,
                  targetX: ltx + 0.5,
                  targetY: lty + 0.5,
                  landTx: ltx,
                  landTy: lty
                };
                continue;
              }
            }
          }
        }
      }

      // Spitter mid-range acid spit (<= 3.2 tiles toward blocking structure or HQ)
      if (z.type === 'spitter') {
        const spitTarget = findSpitterTargetInRange(z, tx, ty, z.acidRange || 3.2);
        if (spitTarget) {
          const sdx = spitTarget.gx - z.x;
          const sdy = spitTarget.gy - z.y;
          const sDist = Math.max(0.25, Math.hypot(sdx, sdy));
          z.facingAngle = Math.atan2(sdy, sdx);
          if (z.atkCooldown <= 0) {
            z.atkCooldown = 1 / z.attackRate;
            const travelLife = Math.max(0.08, sDist / 5.5);
            state.projectiles.push({
              kind: 'acid_glob',
              startX: z.x,
              startY: z.y,
              x: z.x,
              y: z.y,
              targetX: spitTarget.gx,
              targetY: spitTarget.gy,
              targetTx: spitTarget.tx,
              targetTy: spitTarget.ty,
              damage: z.damage,
              life: travelLife,
              maxLife: travelLife
            });
          }
          continue;
        }
      }

      // Also check if zombie is currently overlapping a blocking structure
      if (!blockingTarget && under && under.id !== 'command_hq') {
        const uDef = DATA.ITEMS[under.id];
        if (!(uDef && uDef.passable)) {
          blockingTarget = under;
          btx = tx;
          bty = ty;
          goalX = tx + 0.5;
          goalY = ty + 0.5;
        }
      }

      const distGoal = Math.hypot(goalX - z.x, goalY - z.y);
      if (distGoal > 0.01) {
        z.facingAngle = Math.atan2(goalY - z.y, goalX - z.x);
      }
      if (blockingTarget && distGoal <= 0.86) {
        // Melee attack blocking structure
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          const incDmg = Math.max(1, Math.round(z.damage * dmgTakenMult));
          blockingTarget.hp -= incDmg;
          blockingTarget.hitFlashTimer = 0.045;
          blockingTarget.hitFlash = 1.0;
          spawnBurstParticles(btx + 0.5, bty + 0.5, 10, '#cbd5e1', 4);

          const bDef = DATA.ITEMS[blockingTarget.id];
          const bProf = bDef ? G.getStructLevelProfile(bDef, blockingTarget.level || 1) : null;

          if (blockingTarget.hp <= 0) {
            destroyBlockingStructureAt(btx, bty);
            structureDestroyed = true;
          }

          // Wall/Gate Thorns (+15%p melee reflection when Reactive Armor Coating is active)
          const div = G.getDivisionDef ? G.getDivisionDef() : null;
          const thornsMult = ((div && div.thornsMult) || 1.0) * defRepDmgMult;
          const totalThorns = (((bProf && bProf.thornsRatio) || 0) + (reactiveOn ? 0.15 : 0)) * thornsMult;
          if (totalThorns > 0) {
            const minRefl = Math.round(((bProf && bProf.thornsMin) || 4) * thornsMult);
            const reflDmg = Math.max(minRefl, Math.round(z.damage * totalThorns));
            state.projectiles.push({
              kind: 'spark',
              x1: btx + 0.5,
              y1: bty + 0.5,
              x2: z.x,
              y2: z.y,
              z: 10,
              color: DATA.PALETTE.thornSpark || '#FF8A3D',
              life: 0.12,
              maxLife: 0.12
            });
            damageZombie(i, reflDmg, DATA.PALETTE.thornSpark || '#FF8A3D', false);
          }
        }
      } else if (distGoal > 0.01) {
        let rampMult = 1.0;
        const curT = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
        const stepDx = (goalX - z.x) / distGoal;
        const stepDy = (goalY - z.y) / distGoal;
        if (curT && curT.kind === 'ramp' && curT.rampDir) {
          const dot = stepDx * curT.rampDir.dx + stepDy * curT.rampDir.dy;
          const rampSpd = DATA.RAMP_SPEED || { uphill: 0.70, downhill: 1.25 };
          if (dot > 0.25) rampMult = rampSpd.uphill;
          else if (dot < -0.25) rampMult = rampSpd.downhill;
        }
        const moveSpd = z.speed * slowMult * frenzyMult * rampMult * dt;
        const candX = Math.max(0.02, Math.min(N - 0.02, z.x + stepDx * moveSpd));
        const candY = Math.max(0.02, Math.min(N - 0.02, z.y + stepDy * moveSpd));
        const ntx = Math.floor(candX);
        const nty = Math.floor(candY);
        const canStep =
          (ntx === tx && nty === ty) ||
          !ZS.Pathfinding ||
          !ZS.Pathfinding.canTraverseTerrainStep ||
          ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, tx, ty, ntx, nty);
        if (canStep) {
          z.x = candX;
          z.y = candY;
        } else {
          const canSlideX =
            ntx !== tx &&
            ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, tx, ty, ntx, ty);
          const canSlideY =
            nty !== ty &&
            ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, tx, ty, tx, nty);
          if (canSlideX) {
            z.x = candX;
            z.y = Math.max(ty + 0.02, Math.min(ty + 0.98, candY));
          } else if (canSlideY) {
            z.x = Math.max(tx + 0.02, Math.min(tx + 0.98, candX));
            z.y = candY;
          } else {
            z.x = Math.max(tx + 0.02, Math.min(tx + 0.98, candX));
            z.y = Math.max(ty + 0.02, Math.min(ty + 0.98, candY));
          }
        }
      }
    }

    if (structureDestroyed) {
      G.recalculateBaseStats();
      G.recomputeFlow();
      G.notifyCombatHud();
    }
  }

  function destroyBlockingStructureAt(btx, bty) {
    const st = state.structGrid[bty] && state.structGrid[bty][btx];
    if (!st || st.id === 'command_hq') return false;
    const bDef = DATA.ITEMS[st.id];
    const destroyedLv = st.level || 1;
    const lostRank = st.rank || G.computeRankFromXp(st.xp || 0);
    const wallProf = bDef ? G.getStructLevelProfile(bDef, destroyedLv) : null;
    const top = st.mounted;

    if (top) {
      spawnStructureDebris(btx + 0.5, bty + 0.5, st.id, 8, destroyedLv);
      spawnBuildDustPuffs(btx + 0.5, bty + 0.5, 6);
      const dropPenalty = Math.round((top.maxHp || 100) * 0.25);
      top.hp = Math.max(1, (top.hp || top.maxHp || 1) - dropPenalty);
      top.fallStartZ = (wallProf && wallProf.mountBaseZ) || 15.2;
      top.fallAnimTimer = 0.28;
      top.fallAnimDuration = 0.28;
      top.hitFlashTimer = 0.08;
      top.hitFlash = 1.0;
      state.structGrid[bty][btx] = top;
      triggerScreenShake(1.5, 0.12);
      addFloatingText(btx + 0.5, bty + 0.5, 22, `-${dropPenalty}`, '#FF8A3D', 12, DATA.PALETTE.outlineDark);
      G.banner(
        `[성벽 붕괴] ${G.getStructureDisplayName(top)} 지상 낙하`,
        `성벽이 무너져 상부 시설이 지상으로 낙하했습니다. (내구도 -${dropPenalty})`,
        'warn'
      );
    } else {
      spawnStructureDebris(btx + 0.5, bty + 0.5, st.id, 14, destroyedLv);
      spawnBurstParticles(btx + 0.5, bty + 0.5, 10, DATA.PALETTE.danger, 8);
      state.structGrid[bty][btx] = null;
      if (lostRank >= 1) {
        G.spawnBadgeShatterVfx(btx + 0.5, bty + 0.5, lostRank);
        const rInfo = G.getVeterancyRankInfo(lostRank);
        G.banner(`[${rInfo.name}] ${bDef ? G.getStructureDisplayName(st) : '방어 거점'} 파괴!`, '전투 중 파괴되어 누적 숙련도와 계급 배지가 소실되었습니다.', 'danger');
      }
    }
    return true;
  }

  function completeWave() {
    const clearedWave = state.wave;
    const hadBlackout = !!state.blackoutTriggered;
    state.phase = 'day';
    state.isNight = false;
    state.blackoutActive = false;
    state.blackoutTriggered = false;
    state.blackoutFlickerTimer = 0;
    state.muzzleFlashes = [];
    state.projectiles = [];
    state.burstQueue = [];
    state.nightConsumables = { overpressureAmmo: false, reactiveArmor: false };
    state.traderRefreshCost = 15;
    state.traderRefreshCount = 0;

    G.recalculateBaseStats();
    if (G.invalidateStatsCache) G.invalidateStatsCache();

    // 1. Wave clearance rewards + Cozy dividend bonus
    const woodReward = 26 + clearedWave * 9;
    const scrapReward = 16 + clearedWave * 5;
    const baseCoin = 16 + clearedWave * 4;
    const bonusCoin = Math.round(baseCoin * state.cozyTier.coinBonus);
    const totalCoin = baseCoin + bonusCoin;

    state.wood += woodReward;
    state.scrap += scrapReward;
    state.coin += totalCoin;

    // 2. Free Cozy Auto-Repair & EMP Stun Clear at Dawn
    const freeRatio = state.cozyTier.freeRepair;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st) {
          st.empStunTimer = 0;
          if (st.hp < st.maxHp) {
            st.hp = Math.min(st.maxHp, Math.round(st.hp + (st.maxHp - st.hp) * freeRatio));
          }
          if (st.mounted) {
            st.mounted.empStunTimer = 0;
            if (st.mounted.hp < st.mounted.maxHp) {
              st.mounted.hp = Math.min(st.mounted.maxHp, Math.round(st.mounted.hp + (st.mounted.maxHp - st.mounted.hp) * freeRatio));
            }
          }
        }
      }
    }

    // 3. Daytime Solar & Wind Battery Recharge
    const beforePower = state.power;
    const maxTarget = Math.max(state.power, state.powerCap);
    state.power = Math.min(maxTarget, state.power + state.dayCharge);
    const gainedPower = Math.round(state.power - beforePower);

    // 3.5. Dawn 3-Job Settlement (Research RP, Production Wood/Scrap/Dig AP, HQ Lv.1 Spare Combat Scavenge)
    const hqInfo = G.getHqLevelInfo(state.hqLevel);
    const jobs = G.normalizeJobs ? G.normalizeJobs() : (state.jobs || { combat: state.agents, research: 0, prod: 0 });
    const spareCombat = Math.max(0, (jobs.combat || 0) - (state.popUsed || 0));
    let scavengeWood = 0;
    let scavengeScrap = 0;
    if ((state.hqLevel || 1) === 1 && spareCombat > 0) {
      scavengeWood = spareCombat * 2;
      scavengeScrap = spareCombat * 1;
      state.wood += scavengeWood;
      state.scrap += scavengeScrap;
    }

    const rpBase = (hqInfo.baseRpPerScientist || 2) + (state.b1LabFlatRp || 0);
    const drill2Bonus = (G.getTechLevel && G.getTechLevel('b1_drill_2') > 0) ? 0.15 : 0;
    const rpMult = 1 + (state.b1LabMult || 0) + drill2Bonus;
    const rpGain = Math.round((jobs.research || 0) * rpBase * rpMult);
    state.rp = (state.rp || 0) + rpGain;

    const prodCount = jobs.prod || 0;
    const prodWood = prodCount * 5 + (state.b1SupplyWood || 0);
    const prodScrap = prodCount * 4 + (state.b1SupplyScrap || 0);
    state.wood += prodWood;
    state.scrap += prodScrap;

    let digGain = 0;
    if (state.undergroundUnlocked) {
      const digPerProd = (G.getTechLevel && G.getTechLevel('b1_drill_1') > 0) ? 4 : 3;
      digGain = Math.round((2 + prodCount * digPerProd) * (1 + (state.b1DigMult || 0)));
      const digCap = Math.max(16, (2 + prodCount * digPerProd) * 2 + ((G.getTechLevel && G.getTechLevel('b1_drill_1') > 0) ? 8 : 0));
      state.digApCap = digCap;
      state.digAp = Math.min(digCap, (state.digAp || 0) + digGain);
    }

    // 4. Morning Survivor Arrival (every day below 6 agents, every 2 waves at 6+ agents)
    let arrivedAgent = 0;
    let recruitNote = '';
    if (state.agents < state.popCap) {
      if (state.agents < 6) {
        if (G.grantAgents) G.grantAgents(1);
        else state.agents += 1;
        arrivedAgent = 1;
        state.agentRecruitProgress = 0;
      } else {
        state.agentRecruitProgress = (state.agentRecruitProgress || 0) + 1;
        if (state.agentRecruitProgress >= 2) {
          if (G.grantAgents) G.grantAgents(1);
          else state.agents += 1;
          arrivedAgent = 1;
          state.agentRecruitProgress = 0;
        } else {
          recruitNote = ' · 요원 합류 대기(1/2)';
        }
      }
    } else {
      state.agentRecruitProgress = 0;
    }

    state.wave += 1;
    state.reconNightFadeTimer = 0;
    G.generateWaveIntel(state.wave);
    G.recomputePreviewPaths(false);
    G.refreshTraderOffers(false);
    ZS.Audio.playWaveClear();

    const isRunCleared = !!(state.bossDefeated && clearedWave >= 20);
    if (G.recordDivisionProgress) {
      G.recordDivisionProgress(state.divisionId, state.wave, isRunCleared);
    }

    const newlyUnlocked = [];
    if (hadBlackout && G.unlockDivision && G.unlockDivision('nightwatch')) {
      newlyUnlocked.push(G.getDivisionDef('nightwatch').name);
    }
    if (state.wave >= 15 && G.unlockDivision && G.unlockDivision('arc_tech')) {
      newlyUnlocked.push(G.getDivisionDef('arc_tech').name);
    }

    const rpMsg = rpGain > 0 ? ` · 연구 +${rpGain} RP` : '';
    const prodMsg = prodWood > 0 || prodScrap > 0 ? ` · 생산 +${prodWood}W/+${prodScrap}S` : '';
    const scavMsg = scavengeWood > 0 ? ` · 수색 +${scavengeWood}W/+${scavengeScrap}S` : '';
    const digMsg = digGain > 0 ? ` · 굴착력 +${digGain} AP` : '';
    const agentMsg = arrivedAgent > 0 ? ' · 신규 요원 +1명 합류!' : recruitNote;
    G.banner(
      `WAVE ${clearedWave} 방어 성공! 아침이 밝았습니다`,
      `보상 목재 +${woodReward} · 고철 +${scrapReward} · 코인 +${totalCoin} · 전력 +${gainedPower}${rpMsg}${prodMsg}${scavMsg}${digMsg}${agentMsg}`,
      'good'
    );
    if (newlyUnlocked.length > 0) {
      G.banner(
        `사령관 분과 영구 해금: ${newlyUnlocked.join(', ')}`,
        '새 작전 개시 시 사령관 지휘 분과 선택 창에서 즉시 출격할 수 있습니다!',
        'good'
      );
    }

    G.saveGame();
    G.notifyUi();
  }

  function triggerGameOver() {
    state.phase = 'gameover';
    if (state.activeLayer === 'underground') {
      state.activeLayer = 'surface';
      if (ZS.Iso && ZS.Iso.restoreLayerCamera) ZS.Iso.restoreLayerCamera('surface');
      if (ZS._UI && ZS._UI.onLayerChanged) ZS._UI.onLayerChanged('surface');
    }
    if (G.recordDivisionProgress) {
      G.recordDivisionProgress(state.divisionId, state.wave, !!(state.bossDefeated && state.wave >= 20));
    }
    if (G.invalidateStatsCache) G.invalidateStatsCache();
    ZS.Audio.playBlackout();
    G.banner('지휘 본부 함락 — 작전 실패', `WAVE ${state.wave}에서 방어선이 붕괴했습니다. 상단 [새 작전] 버튼으로 재도전하세요!`, 'danger');
    G.notifyUi();
  }

  // ================= VFX HELPERS =================
  function triggerScreenShake(ampPx, durationSec) {
    if (!G.screenShakeEnabled) return;
    const dur = durationSec || 0.28;
    if (ampPx >= (state.shakeAmp || 0) || state.shakeTimer <= 0.05) {
      state.shakeAmp = ampPx;
      state.shakeDuration = dur;
      state.shakeTimer = dur;
    }
  }

  function spawnMuzzleFlash(gx, gy, zPx, angle, color, scale, kind) {
    state.muzzleFlashes.push({
      x: gx,
      y: gy,
      z: zPx,
      angle: angle || 0,
      color: color || '#FFF3C4',
      scale: scale || 1.0,
      kind: kind || 'cone',
      life: 0.055,
      maxLife: 0.055
    });
  }

  function spawnZombieDeathVfx(z, zDef) {
    const sc = (zDef && zDef.scale) || 1.0;
    // 1. ~0.3s collapsing/toppling zombie corpse animation
    state.dyingZombies.push({
      type: z.type,
      x: z.x,
      y: z.y,
      facingAngle: typeof z.facingAngle === 'number' ? z.facingAngle : 0,
      fallDir: Math.random() < 0.5 ? 1 : -1,
      scale: sc,
      coatColor: (zDef && zDef.coatColor) || '#6E1E3E',
      skinColor: (zDef && zDef.skinColor) || '#F2CCD0',
      accentColor: (zDef && (zDef.armorColor || zDef.accentColor)) || null,
      isBoss: !!(zDef && zDef.isBoss),
      timer: 0,
      duration: 0.32
    });

    // 2. Fading dark crimson/ichor ground stain (capped at 45 for clean frame budget)
    if (state.groundDecals.length >= 45) {
      state.groundDecals.shift();
    }
    const stainLife = zDef && zDef.isBoss ? 11.0 : 7.5;
    state.groundDecals.push({
      x: z.x,
      y: z.y,
      radius: (zDef && zDef.isBoss ? 0.52 : z.type === 'brute' ? 0.36 : 0.26),
      color: zDef && zDef.isBoss ? '#4A1048' : '#4E1224',
      subColor: zDef && zDef.isBoss ? '#8E24AA' : '#7A1A32',
      seed: z.seed || Math.random() * 10,
      life: stainLife,
      maxLife: stainLife
    });
  }

  function spawnBuildDustPuffs(gx, gy, count) {
    const n = count || 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const spd = 0.85 + Math.random() * 0.95;
      const life = 0.28 + Math.random() * 0.14;
      pushParticle({
        kind: 'dust',
        x: gx + Math.cos(a) * 0.24,
        y: gy + Math.sin(a) * 0.24,
        z: 2 + Math.random() * 2.5,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 7 + Math.random() * 8,
        color: i % 2 === 0 ? '#DDD2BE' : '#C2B7A3',
        size: 3.4 + Math.random() * 2.4,
        life,
        maxLife: life
      });
    }
  }

  function getStructureDebrisPalette(itemId, level) {
    if (itemId === 'barricade_wall') {
      const lv = level || 1;
      if (lv >= 3) return ['#6B7686', '#F0BD35', '#FF9F43'];
      if (lv === 2) return ['#C9B48A', '#9E8758', '#8C96A3'];
      return ['#8B6843', '#BAC6D2', '#5E452B'];
    }
    switch (itemId) {
      case 'tactical_gate':
        if ((level || 1) <= 1) return ['#8B6843', '#BAC6D2', '#F0BD35'];
        if ((level || 1) >= 3) return ['#59636E', '#B87333', '#FF8A3D'];
        return ['#59636E', '#4A5562', '#F0BD35'];
      case 'hesco_wall': return ['#C9B48A', '#9E8758', '#8C96A3'];
      case 'blast_wall': return ['#6B7686', '#F0BD35', '#FF9F43'];
      case 'razor_pad':
        if ((level || 1) >= 3) return ['#343C46', '#B87333', '#FF8A3D'];
        if ((level || 1) === 2) return ['#3E4650', '#DCE5EE', '#F0BD35'];
        return ['#4A525C', '#C9D3DE', '#596574'];
      case 'rifle_bunker': return ['#B5A27A', '#55684F', '#8C96A3'];
      case 'shotgun_post': return ['#B5A27A', '#3A4654', '#EBA834'];
      case 'sniper_tower': return ['#7C8B99', '#4F5D4B', '#5B6875'];
      case 'vulcan_turret': return ['#E8EEF4', '#4E5A68', '#5EF2FF'];
      case 'missile_pod': return ['#6C7D65', '#4C574A', '#E0603A'];
      case 'emp_coil': return ['#60748A', '#B87333', '#5EF2FF'];
      case 'solar_array': return ['#2466B5', '#A9B6C4', '#7B8996'];
      case 'wind_turbine': return ['#EEF3F8', '#D0DBE6', '#758594'];
      case 'battery_bank': return ['#DDE5EC', '#9AA8B6', '#5EF2FF'];
      case 'field_tent':
        return (level || 1) >= 3 ? ['#DCE5ED', '#EA6A3B', '#556370'] : ['#6E8466', '#2E3A2B', '#FFD27A'];
      case 'shelter_pod': return ['#DCE5ED', '#EA6A3B', '#556370'];
      case 'gas_heater': return ['#D5DEE7', '#9AA6B2', '#FFB347'];
      case 'led_floodlight': return ['#EBA834', '#59636E', '#FFF6DA'];
      case 'urban_planter': return ['#B8C0C7', '#5DBB63', '#6B4A33'];
      case 'vending_machine': return ['#2E86DE', '#FFF3D6', '#1B4F86'];
      case 'repair_bay': return ['#475361', '#F0A93A', '#4ADE80'];
      case 'lounge_set': return ['#F4E6C8', '#E8A04A', '#E8EEF5'];
      case 'arcade_neon': return ['#3A2C54', '#FF5CE1', '#52E8FF'];
      case 'boss_trophy': return ['#2E3744', '#D4AF37', '#FFE066'];
      case 'command_hq': return ['#5B6B7C', '#DCE4EC', '#FFD27A'];
      default: return ['#94A3B8', '#64748B', '#D49A5A'];
    }
  }

  function spawnStructureDebris(gx, gy, itemId, count, level) {
    const cols = getStructureDebrisPalette(itemId, level);
    const n = count || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.1 + Math.random() * 2.5;
      const w = 0.085 + Math.random() * 0.065;
      const life = 0.52 + Math.random() * 0.28;
      pushParticle({
        kind: 'cube',
        x: gx + (Math.random() - 0.5) * 0.36,
        y: gy + (Math.random() - 0.5) * 0.36,
        z: 4 + Math.random() * 12,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 24 + Math.random() * 34,
        w,
        h: 2.6 + Math.random() * 2.6,
        color: cols[i % cols.length],
        bounced: false,
        life,
        maxLife: life
      });
    }
    spawnBuildDustPuffs(gx, gy, 6);
  }

  function spawnBurstParticles(gx, gy, zPx, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 2.2;
      pushParticle({
        x: gx,
        y: gy,
        z: zPx,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 12 + Math.random() * 24,
        color,
        size: 1.8 + Math.random() * 2.2,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6
      });
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        const lastIdx = state.particles.length - 1;
        if (i !== lastIdx) state.particles[i] = state.particles[lastIdx];
        state.particles.pop();
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === 'dust') {
        pt.vx *= Math.max(0, 1 - dt * 3.5);
        pt.vy *= Math.max(0, 1 - dt * 3.5);
        pt.z += pt.vz * dt;
        pt.vz = Math.max(1.5, pt.vz - 18 * dt);
      } else if (pt.kind === 'cube') {
        pt.z += pt.vz * dt;
        pt.vz -= 105 * dt;
        if (pt.z <= 1) {
          pt.z = 1;
          if (!pt.bounced && Math.abs(pt.vz) > 10) {
            pt.vz = -pt.vz * 0.38;
            pt.vx *= 0.62;
            pt.vy *= 0.62;
            pt.bounced = true;
          } else {
            pt.vz = 0;
            pt.vx *= Math.max(0, 1 - dt * 8);
            pt.vy *= Math.max(0, 1 - dt * 8);
          }
        }
      } else {
        pt.z = Math.max(1, pt.z + pt.vz * dt);
        pt.vz -= 65 * dt;
      }
    }
  }

  function addFloatingText(gx, gy, zPx, text, color, size, strokeColor) {
    state.floatingTexts.push({
      x: gx,
      y: gy,
      z: zPx,
      text,
      color,
      strokeColor: strokeColor || null,
      size: size || 12,
      life: 1.15,
      maxLife: 1.15
    });
  }

  function updateFloatingTexts(dt) {
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.life -= dt;
      ft.z += 14 * dt;
      if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  Object.assign(G, {
    damageZombie,
    findSpitterTargetInRange,
    findBossChargeTarget,
    updateZombies,
    destroyBlockingStructureAt,
    completeWave,
    triggerGameOver,
    triggerScreenShake,
    spawnMuzzleFlash,
    spawnZombieDeathVfx,
    spawnBuildDustPuffs,
    getStructureDebrisPalette,
    spawnStructureDebris,
    pushParticle,
    spawnBurstParticles,
    updateParticles,
    addFloatingText,
    updateFloatingTexts,
    randInt
  });

  ZS.Game = {
    state: G.state,
    getEnvInfo: G.getEnvInfo,
    getSaveKey: G.getSaveKey,
    getMetaKey: G.getMetaKey,
    getDivisionDef: G.getDivisionDef,
    getCommanderMeta: G.getCommanderMeta,
    isDivisionUnlocked: G.isDivisionUnlocked,
    unlockDivision: G.unlockDivision,
    setLastSelectedDivision: G.setLastSelectedDivision,
    recordDivisionProgress: G.recordDivisionProgress,
    debugUnlockAllDivisions: G.debugUnlockAllDivisions,
    isArcOverdriveActive: G.isArcOverdriveActive,
    isScreenShakeEnabled: G.isScreenShakeEnabled,
    setScreenShakeEnabled: G.setScreenShakeEnabled,
    toggleScreenShake: G.toggleScreenShake,
    setCallbacks: G.setCallbacks,
    initNewGame: G.initNewGame,
    regenerateMapSeed: G.regenerateMapSeed,
    getTerrainAt: G.getTerrainAt,
    getTerrainElevationAt: G.getTerrainElevationAt,
    findFirstPeakOnSegment: G.findFirstPeakOnSegment,
    hasDirectLineOfSight: G.hasDirectLineOfSight,
    getTerrainPowerStats: G.getTerrainPowerStats,
    loadGame: G.loadGame,
    clearSaveAndReset: G.clearSaveAndReset,
    getHqLevelInfo: G.getHqLevelInfo,
    getEffectiveHqUpgradeCost: G.getEffectiveHqUpgradeCost,
    getEffectiveBuildCost: G.getEffectiveBuildCost,
    getEffectiveUpgradeCost: G.getEffectiveUpgradeCost,
    canUpgradeHq: G.canUpgradeHq,
    upgradeHq: G.upgradeHq,
    adjustJob: G.adjustJob,
    getTechLevel: G.getTechLevel,
    getTechCost: G.getTechCost,
    canResearchTech: G.canResearchTech,
    researchTech: G.researchTech,
    getItemRequiredTech: G.getItemRequiredTech,
    getUpgradeRequiredTech: G.getUpgradeRequiredTech,
    isUpgradeableDef: G.isUpgradeableDef,
    isTierEvolutionDef: G.isTierEvolutionDef,
    getStructMaxTier: G.getStructMaxTier,
    getUpgradeCost: G.getUpgradeCost,
    getStructureDisplayName: G.getStructureDisplayName,
    getStructLevelProfile: G.getStructLevelProfile,
    canUpgradeStructure: G.canUpgradeStructure,
    upgradeStructure: G.upgradeStructure,
    canUpgradeWallBase: G.canUpgradeWallBase,
    upgradeWallBase: G.upgradeWallBase,
    isCombatVeterancyDef: G.isCombatVeterancyDef,
    getVeterancyRankInfo: G.getVeterancyRankInfo,
    computeRankFromXp: G.computeRankFromXp,
    recalculateBaseStats: G.recalculateBaseStats,
    getPlacementCozyPreview: G.getPlacementCozyPreview,
    computeStructureEffectiveStatsUncached: G.computeStructureEffectiveStatsUncached,
    getStructureEffectiveStats: G.getStructureEffectiveStats,
    canPlaceItem: G.canPlaceItem,
    placeItem: G.placeItem,
    moveStructure: G.moveStructure,
    removeAt: G.removeAt,
    getRepairAllInfo: G.getRepairAllInfo,
    repairAllStructures: G.repairAllStructures,
    refreshTraderOffers: G.refreshTraderOffers,
    exchangeResource: G.exchangeResource,
    getNightConsumableCost: G.getNightConsumableCost,
    buyNightConsumable: G.buyNightConsumable,
    buyTraderOffer: G.buyTraderOffer,
    startNightWave: G.startNightWave,
    triggerBlackout: G.triggerBlackout,
    completeWave: G.completeWave,
    triggerGameOver: G.triggerGameOver,
    toggleReconPaths: G.toggleReconPaths,
    toggleWindOverlay: G.toggleWindOverlay,
    setWindOverlay: G.setWindOverlay,
    generateWaveIntel: G.generateWaveIntel,
    recomputePreviewPaths: G.recomputePreviewPaths,
    triggerNanoRepair: G.triggerNanoRepair,
    triggerAirstrikeAt: G.triggerAirstrikeAt,
    debugAddResources: G.debugAddResources,
    debugTogglePower: G.debugTogglePower,
    debugAddAgents: G.debugAddAgents,
    debugAddRp: G.debugAddRp,
    debugAdvanceWave: G.debugAdvanceWave,
    debugGrantSelectedXp: G.debugGrantSelectedXp,
    update: G.update
  };
})();
