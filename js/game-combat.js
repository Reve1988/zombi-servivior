window.ZS = window.ZS || {};

(function () {
  const G = ZS._Game;
  const { DATA, N, PROD_SAVE_KEY, DEV_SAVE_KEY, SETTINGS_KEY, state } = G;

  const BUCKET_CELLS = N * N;
  const zombieBucketHead = new Int16Array(BUCKET_CELLS);
  let zombieBucketNext = new Int16Array(256);
  G._zombieBucketsDirty = true;

  function rebuildZombieSpatialBuckets() {
    const zList = state.zombies;
    const count = zList.length;
    if (count > zombieBucketNext.length) {
      let nextCap = zombieBucketNext.length;
      while (nextCap < count) nextCap *= 2;
      zombieBucketNext = new Int16Array(nextCap);
    }
    zombieBucketHead.fill(-1);
    for (let i = 0; i < count; i++) {
      const z = zList[i];
      const bx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
      const by = Math.max(0, Math.min(N - 1, Math.floor(z.y)));
      const cell = by * N + bx;
      zombieBucketNext[i] = zombieBucketHead[cell];
      zombieBucketHead[cell] = i;
    }
    G._zombieBucketsDirty = false;
  }

  // ================= NIGHT WAVE & COMBAT =================
  function allocateSidesByWeights(totalCount, weights) {
    const out = [];
    if (totalCount <= 0) return out;
    const wArr = Array.isArray(weights) && weights.length === 4 ? weights : [0.25, 0.25, 0.25, 0.25];
    const sum = wArr[0] + wArr[1] + wArr[2] + wArr[3];
    const norm = sum > 0 ? wArr.map((w) => w / sum) : [0.25, 0.25, 0.25, 0.25];

    const quotas = norm.map((p, idx) => {
      const exact = p * totalCount;
      const base = Math.floor(exact);
      return { idx, base, rem: exact - base };
    });
    let used = quotas.reduce((acc, q) => acc + q.base, 0);
    const byRem = quotas.slice().sort((a, b) => b.rem - a.rem);
    for (let k = 0; used < totalCount && k < byRem.length; k++) {
      if (norm[byRem[k].idx] > 0) {
        byRem[k].base += 1;
        used += 1;
      }
    }
    for (let s = 0; s < quotas.length; s++) {
      for (let c = 0; c < quotas[s].base; c++) {
        out.push(quotas[s].idx);
      }
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function computeWaveHpScale(waveNum) {
    const w = Math.max(1, waveNum || 1);
    if (w <= 10) {
      return 1 + (w - 1) * 0.22;
    }
    if (w <= 20) {
      const d = w - 10;
      return 2.98 + d * 0.30 + d * d * 0.012;
    }
    if (w <= 40) {
      const d = w - 20;
      return 7.18 + d * 0.48 + d * d * 0.020;
    }
    const d4 = w - 40;
    return 24.78 + d4 * 0.85 + Math.pow(d4, 1.3) * 0.12;
  }

  function computeBossHpScale(waveNum) {
    const tier = Math.max(1, Math.floor((waveNum || 5) / 5));
    if (tier <= 5) {
      const quad = Math.max(0, tier - 2);
      return 1 + (tier - 1) * 0.80 + quad * quad * 0.35;
    }
    const dt = tier - 5;
    return 7.35 + dt * 2.80 + Math.pow(dt, 1.35) * 0.65;
  }

  function buildWaveQueue(waveNum, sideWeights, bossSide) {
    const q = [];
    const hpScale = computeWaveHpScale(waveNum);
    const rawCount = 11 + waveNum * 4.8 + Math.max(0, waveNum - 8) * 1.8;
    const countBase = Math.min(
      185,
      Math.round(rawCount <= 165 ? rawCount : 165 + 20 * (1 - Math.exp(-(rawCount - 165) / 85)))
    );
    const sidePool = allocateSidesByWeights(countBase, sideWeights);

    const wSpitter = waveNum >= 4 ? Math.min(0.16, 0.05 + (waveNum - 4) * 0.012) : 0;
    const wLeaper = waveNum >= 6 ? Math.min(0.16, 0.06 + (waveNum - 6) * 0.012) : 0;
    const wShocker = waveNum >= 8 ? Math.min(0.15, 0.05 + (waveNum - 8) * 0.010) : 0;
    const wBrute = waveNum >= 3 ? Math.min(0.24, (waveNum - 2) * 0.035) : 0;
    const wRunner = waveNum >= 2 ? Math.min(0.25, 0.16 + waveNum * 0.012) : 0;

    for (let i = 0; i < countBase; i++) {
      const r = Math.random();
      const side = sidePool[i] != null ? sidePool[i] : Math.floor(Math.random() * 4);
      let type = 'walker';
      if (r < wSpitter) {
        type = 'spitter';
      } else if (r < wSpitter + wLeaper) {
        type = 'leaper';
      } else if (r < wSpitter + wLeaper + wShocker) {
        type = 'shocker';
      } else if (r < wSpitter + wLeaper + wShocker + wBrute) {
        type = 'brute';
      } else if (r < wSpitter + wLeaper + wShocker + wBrute + wRunner) {
        type = 'runner';
      }
      q.push({ type, hpScale, side });
    }

    if (waveNum % 5 === 0) {
      const bSide = typeof bossSide === 'number' ? bossSide : Math.floor(Math.random() * 4);
      const bScale = computeBossHpScale(waveNum);
      if (waveNum === 20) {
        const escortScale = +(hpScale * 1.6).toFixed(3);
        q.push({ type: 'brute', hpScale: escortScale, side: bSide });
        q.push({ type: 'brute', hpScale: escortScale, side: bSide });
      }
      const bossCount = waveNum >= 30 ? 2 : 1;
      for (let b = 0; b < bossCount; b++) {
        q.push({
          type: 'boss',
          hpScale: bScale,
          side: bSide
        });
      }
    }

    return q;
  }

  function generateWaveIntel(waveNum) {
    const w = Math.max(1, waveNum || state.wave || 1);
    const prof = G.computeWaveSideProfile(w);
    const plannedQueue = buildWaveQueue(w, prof.sideWeights, prof.bossSide);
    const counts = {
      walker: 0,
      runner: 0,
      brute: 0,
      spitter: 0,
      leaper: 0,
      shocker: 0,
      boss: 0
    };
    for (let i = 0; i < plannedQueue.length; i++) {
      const t = plannedQueue[i].type;
      if (counts[t] !== undefined) counts[t] += 1;
    }

    state.nextWaveIntel = {
      wave: w,
      pattern: prof.pattern,
      patternLabel: prof.patternLabel,
      sideWeights: prof.sideWeights,
      sideKinds: prof.sideKinds,
      bossSide: prof.bossSide,
      counts,
      totalCount: plannedQueue.length,
      plannedQueue
    };
    return state.nextWaveIntel;
  }

  function startNightWave() {
    if (state.phase !== 'day') return false;
    state.phase = 'night';
    state.isNight = true;
    const nightStartsDry = state.power <= 0.001 && (state.nightGen || 0) < state.nightIdleDrain;
    state.blackoutActive = nightStartsDry;
    state.blackoutTriggered = nightStartsDry;
    state.reconNightFadeTimer = 2.0;
    if (G.invalidateStatsCache) G.invalidateStatsCache();

    if (!state.nextWaveIntel || state.nextWaveIntel.wave !== state.wave) {
      generateWaveIntel(state.wave);
    }
    G.recomputeFlow(false);
    const planned = state.nextWaveIntel && state.nextWaveIntel.plannedQueue;
    state.spawnQueue = planned && planned.length > 0
      ? planned.map((e) => ({ type: e.type, hpScale: e.hpScale, side: e.side }))
      : buildWaveQueue(state.wave);
    state.waveTotalZombies = state.spawnQueue.length;
    state.waveKilledZombies = 0;
    state.spawnTimer = 0.6;

    ZS.Audio.playWaveStart();
    const isBossWave = state.wave % 5 === 0;
    G.banner(
      isBossWave ? `WAVE ${state.wave} — 알파 변이체 경보!` : `WAVE ${state.wave} 야간 방어 개시`,
      `충전 전력 ${Math.round(state.power)} · 적 개체 ${state.waveTotalZombies}기 접근 중`,
      isBossWave ? 'warn' : 'info'
    );
    G.notifyUi();
    return true;
  }

  function spawnZombie(entry) {
    const def = DATA.ZOMBIES[entry.type];
    const side = typeof entry.side === 'number' ? entry.side : Math.floor(Math.random() * 4);
    const idx = 1 + Math.floor(Math.random() * (N - 2));
    let gx = 0.5;
    let gy = 0.5;
    if (side === 0) { gx = idx + 0.5; gy = 0.45; }
    else if (side === 1) { gx = N - 0.45; gy = idx + 0.5; }
    else if (side === 2) { gx = idx + 0.5; gy = N - 0.45; }
    else { gx = 0.45; gy = idx + 0.5; }

    const maxHp = Math.round(def.hp * entry.hpScale);
    const hqCx = DATA.HQ_POS.x + 0.5;
    const hqCy = DATA.HQ_POS.y + 0.5;
    const dmgWaveScale = 1 + Math.min(state.wave - 1, 29) * 0.09 + Math.max(0, state.wave - 30) * 0.045;
    state.zombies.push({
      uid: G.nextZombieUid++,
      type: entry.type,
      x: gx,
      y: gy,
      hp: maxHp,
      maxHp,
      speed: def.speed,
      damage: Math.round(def.damage * dmgWaveScale),
      attackRate: def.attackRate,
      atkCooldown: 0,
      slowTimer: 0,
      hitFlash: 0,
      hitFlashTimer: 0,
      vulnOnPad: false,
      acidRange: def.attackRange || 0,
      hasLeaped: false,
      leapState: null,
      frenzyTimer: 0,
      warCryCd: def.isBoss ? 3.5 : 0,
      chargeCd: def.isBoss ? 4.0 : 0,
      chargeState: null,
      facingAngle: Math.atan2(hqCy - gy, hqCx - gx),
      seed: Math.random() * 10
    });
    G._zombieBucketsDirty = true;

    if (def.isBoss) {
      G.triggerScreenShake(5.5, 0.36);
    }
  }

  // ================= ACTIVE TACTICAL SKILLS =================
  function triggerNanoRepair() {
    if (state.skills.repairCd > 0 || state.phase === 'gameover') return false;
    state.skills.repairCd = state.skills.repairMaxCd;

    let count = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st && st.hp < st.maxHp) {
          st.hp = Math.min(st.maxHp, st.hp + 95);
          G.spawnBurstParticles(x + 0.5, y + 0.5, 10, DATA.PALETTE.health, 6);
          count++;
        }
        if (st && st.mounted && st.mounted.hp < st.mounted.maxHp) {
          st.mounted.hp = Math.min(st.mounted.maxHp, st.mounted.hp + 95);
          G.spawnBurstParticles(x + 0.5, y + 0.5, 8, DATA.PALETTE.health, 16);
          count++;
        }
      }
    }
    ZS.Audio.playBuild();
    G.addFloatingText(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 30, '+95 HP', DATA.PALETTE.heal || DATA.PALETTE.health, 14, DATA.PALETTE.outlineDark);
    G.banner(
      '긴급 나노 수리 드론 가동',
      count > 0 ? `${count}개 시설의 내구도를 +95 회복했습니다.` : '모든 시설 내구도가 이미 최대입니다.',
      'good'
    );
    G.notifyUi();
    return true;
  }

  function triggerAirstrikeAt(gx, gy) {
    if (state.skills.airstrikeCd > 0 || state.phase === 'gameover') return false;
    state.skills.airstrikeCd = state.skills.airstrikeMaxCd;

    state.flares.push({ x: gx, y: gy, radius: 4.5, life: 4.5 });
    G.spawnBurstParticles(gx, gy, 10, '#ffae42', 22);
    G.spawnBurstParticles(gx, gy, 14, DATA.PALETTE.danger, 16);
    G.spawnStructureDebris(gx, gy, 'barricade_wall', 8, 2);
    G.triggerScreenShake(7.5, 0.42);
    ZS.Audio.playExplosion();

    const strikeDmg = 120 + state.wave * 18;
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const d = Math.hypot(z.x - gx, z.y - gy);
      if (d <= 2.65) {
        G.damageZombie(i, strikeDmg * (1 - d * 0.18), '#ff9f43');
      }
    }
    G.banner('전술 조명탄 & 폭격 투하', '지정 구역 광역 타격 및 야간 조명이 전개되었습니다.', 'info');
    G.notifyUi();
    return true;
  }

  // ================= MAIN SIMULATION STEP =================
  function update(rawDt) {
    if (state.phase === 'gameover') return;
    G._inSimStep = true;
    try {
      // Smooth day/night ambient transition
      const targetNight = state.isNight ? 1 : 0;
      state.nightAlpha += (targetNight - state.nightAlpha) * Math.min(1, rawDt * 2.6);

      const dt = rawDt * (state.phase === 'night' ? state.gameSpeed : 1);

      // Cooldowns
      if (state.skills.repairCd > 0) state.skills.repairCd = Math.max(0, state.skills.repairCd - dt);
      if (state.skills.airstrikeCd > 0) state.skills.airstrikeCd = Math.max(0, state.skills.airstrikeCd - dt);

      // Update HQ / structure / cozy tier-up / screen shake / blackout flicker animations
      if (state.cozyTierUpTimer > 0) {
        state.cozyTierUpTimer = Math.max(0, state.cozyTierUpTimer - rawDt);
      }
      if (state.shakeTimer > 0) {
        state.shakeTimer = Math.max(0, state.shakeTimer - rawDt);
        if (state.shakeTimer <= 0) state.shakeAmp = 0;
      }
      if (state.blackoutFlickerTimer > 0) {
        state.blackoutFlickerTimer = Math.max(0, state.blackoutFlickerTimer - rawDt);
      }
      const hqSt = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
      if (hqSt && hqSt.upgradeAnimTimer > 0) {
        const prevT = hqSt.upgradeAnimTimer;
        hqSt.upgradeAnimTimer = Math.max(0, hqSt.upgradeAnimTimer - rawDt);
        if (prevT > 0.8 && hqSt.upgradeAnimTimer <= 0.8) {
          G.spawnBurstParticles(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 8, '#D8C8A8', 10);
        }
        if (prevT > 0.3 && hqSt.upgradeAnimTimer <= 0.3) {
          hqSt.hitFlashTimer = 0.06;
          hqSt.hitFlash = 1.0;
        }
      }
      const stepStructAnim = (node) => {
        if (!node) return;
        if (node.hitFlashTimer > 0) {
          node.hitFlashTimer = Math.max(0, node.hitFlashTimer - rawDt);
          node.hitFlash = node.hitFlashTimer > 0 ? 1.0 : 0;
        } else if (node.hitFlash > 0) {
          node.hitFlash = Math.max(0, node.hitFlash - rawDt * 18);
        }
        if (node.buildAnimTimer > 0) {
          node.buildAnimTimer = Math.max(0, node.buildAnimTimer - rawDt);
        }
        if (node.id !== 'command_hq' && node.upgradeAnimTimer > 0) {
          node.upgradeAnimTimer = Math.max(0, node.upgradeAnimTimer - rawDt);
        }
        if (node.promoAnimTimer > 0) {
          node.promoAnimTimer = Math.max(0, node.promoAnimTimer - rawDt);
        }
        if (node.fallAnimTimer > 0) {
          node.fallAnimTimer = Math.max(0, node.fallAnimTimer - rawDt);
        }
      };
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s) continue;
          stepStructAnim(s);
          if (s.mounted) stepStructAnim(s.mounted);
        }
      }
      for (let i = 0; i < state.zombies.length; i++) {
        const z = state.zombies[i];
        if (z.hitFlashTimer > 0) {
          z.hitFlashTimer = Math.max(0, z.hitFlashTimer - rawDt);
          z.hitFlash = z.hitFlashTimer > 0 ? 1.0 : 0;
        } else if (z.hitFlash > 0) {
          z.hitFlash = Math.max(0, z.hitFlash - rawDt * 22);
        }
      }

      // Update flares, muzzle flashes, dying zombies, ground decals, particles, floating texts
      for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
        state.muzzleFlashes[i].life -= rawDt;
        if (state.muzzleFlashes[i].life <= 0) state.muzzleFlashes.splice(i, 1);
      }
      for (let i = state.flares.length - 1; i >= 0; i--) {
        state.flares[i].life -= dt;
        if (state.flares[i].life <= 0) state.flares.splice(i, 1);
      }
      for (let i = state.dyingZombies.length - 1; i >= 0; i--) {
        state.dyingZombies[i].timer += rawDt;
        if (state.dyingZombies[i].timer >= state.dyingZombies[i].duration) {
          state.dyingZombies.splice(i, 1);
        }
      }
      for (let i = state.groundDecals.length - 1; i >= 0; i--) {
        state.groundDecals[i].life -= dt;
        if (state.groundDecals[i].life <= 0) state.groundDecals.splice(i, 1);
      }
      G.updateParticles(dt);
      G.updateFloatingTexts(dt);
      if (state.reconFlashTimer > 0) {
        state.reconFlashTimer = Math.max(0, state.reconFlashTimer - rawDt);
      }

      if (state.phase !== 'night') return;

      if (state.reconNightFadeTimer > 0) {
        state.reconNightFadeTimer = Math.max(0, state.reconNightFadeTimer - dt);
      }

      // 1. Night Power Generation & Idle Drain (Wind Continuous + REBOOT_POWER = 12 Hysteresis)
      const prevArcOverdrive = G.isArcOverdriveActive ? G.isArcOverdriveActive() : false;
      const REBOOT_POWER = 12;
      const windGen = state.nightGen || 0;
      if (!state.blackoutActive) {
        const netRate = windGen - (state.nightIdleDrain || 0);
        state.power = Math.max(0, Math.min(state.powerCap, state.power + netRate * dt));
        if (state.power <= 0.001 && windGen < (state.nightIdleDrain || 0)) {
          enterBlackout();
        }
      } else {
        if (windGen > 0) {
          state.power = Math.min(state.powerCap, state.power + windGen * dt);
        }
        const rebootTarget = Math.min(state.powerCap || REBOOT_POWER, REBOOT_POWER);
        if (state.power > 0 && state.power >= rebootTarget) {
          state.blackoutActive = false;
          if (G.invalidateStatsCache) G.invalidateStatsCache();
          G.notifyCombatHud();
          G.banner('전력 복구 — 자동 방어 재가동!', `풍력 발전으로 전력 ${Math.floor(state.power)} 도달! 포탑과 투광등이 다시 가동됩니다.`, 'good');
        }
      }

      // 2. Field Repair Bay real-time aura regeneration + EMP stun countdown
      let empExpired = false;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const st = state.structGrid[y][x];
          if (!st) continue;
          if (st.empStunTimer > 0) {
            st.empStunTimer = Math.max(0, st.empStunTimer - dt);
            if (st.empStunTimer === 0) empExpired = true;
          }
          if (st.mounted && st.mounted.empStunTimer > 0) {
            st.mounted.empStunTimer = Math.max(0, st.mounted.empStunTimer - dt);
            if (st.mounted.empStunTimer === 0) empExpired = true;
          }
        }
      }
      if (empExpired && G.invalidateStatsCache) G.invalidateStatsCache();
      updateRepairBays(dt);

      // 3. Spawn Zombies
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnZombie(state.spawnQueue.shift());
          if (state.wave >= 4 && state.spawnQueue.length > 0) {
            const swarmChance = Math.min(0.45, 0.20 + (state.wave - 4) * 0.025);
            if (Math.random() < swarmChance) {
              const extraCount = Math.random() < 0.5 ? 1 : 2;
              for (let s = 0; s < extraCount; s += 1) {
                const extraIdx = state.spawnQueue.findIndex((entry) => entry && entry.type !== 'boss');
                if (extraIdx === -1) break;
                spawnZombie(state.spawnQueue.splice(extraIdx, 1)[0]);
              }
            }
          }
          const baseInterval = Math.max(0.20, 0.82 - state.wave * 0.048);
          state.spawnTimer = baseInterval * (0.7 + Math.random() * 0.55);
        }
      }

      // 4. Rebuild 22x22 Spatial Zombie Buckets, Update Defenders & Auto-Turrets + Delayed Burst Shots
      rebuildZombieSpatialBuckets();
      updateDefenders(dt);
      updateBurstQueue(dt);

      // Invalidate stats cache if ARC Overdrive (>=70% power) threshold was crossed this tick
      const nextArcOverdrive = G.isArcOverdriveActive ? G.isArcOverdriveActive() : false;
      if (nextArcOverdrive !== prevArcOverdrive) {
        if (G.invalidateStatsCache) G.invalidateStatsCache();
        G.notifyCombatHud();
      }

      // 5. Update Projectiles
      updateProjectiles(dt);

      // 6. Update Zombies & Razor Traps
      G.updateZombies(dt);

      // 7. Check Wave Clear
      if (state.spawnQueue.length === 0 && state.zombies.length === 0 && state.phase === 'night') {
        G.completeWave();
      }
    } finally {
      G._inSimStep = false;
      if (G._combatHudDirty) {
        G._combatHudDirty = false;
        if (G.onCombatHudChange) G.onCombatHudChange();
      }
    }
  }

  function enterBlackout() {
    if (state.blackoutActive) return;
    state.blackoutActive = true;
    state.power = 0;
    if (G.invalidateStatsCache) G.invalidateStatsCache();
    if (!state.blackoutTriggered) {
      state.blackoutTriggered = true;
      state.blackoutFlickerTimer = 0.50;
      ZS.Audio.playBlackout();
      G.banner('배터리 방전 — 블랙아웃!', '자동 포탑과 전기 투광등이 정지했습니다! 무전력 전투원이 방어를 지속합니다.', 'warn');
    } else {
      state.blackoutFlickerTimer = 0.22;
    }
    G.notifyCombatHud();
  }

  function triggerBlackout() {
    enterBlackout();
  }

  function updateRepairBays(dt) {
    const auraAdd = (DATA.PLATEAU_BONUS && DATA.PLATEAU_BONUS.auraAdd) || 0.5;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id !== 'repair_bay') continue;
        const def = DATA.ITEMS.repair_bay;
        const prof = G.getStructLevelProfile(def, st.level || 1);
        const t = G.getTerrainAt ? G.getTerrainAt(x, y) : null;
        const onPlateau = !!(t && t.kind === 'plateau');
        const rad = (prof.auraRadius || def.aura.radius) + (onPlateau ? auraAdd : 0);
        const regen = (prof.regenPerSec || def.aura.regenPerSec) * dt;

        for (let ny = Math.max(0, Math.floor(y - rad)); ny <= Math.min(N - 1, Math.ceil(y + rad)); ny++) {
          for (let nx = Math.max(0, Math.floor(x - rad)); nx <= Math.min(N - 1, Math.ceil(x + rad)); nx++) {
            const target = state.structGrid[ny][nx];
            if (!target || Math.hypot(nx - x, ny - y) > rad + 0.05) continue;
            if (target.hp < target.maxHp) {
              target.hp = Math.min(target.maxHp, target.hp + regen);
            }
            if (target.mounted && target.mounted.hp < target.mounted.maxHp) {
              target.mounted.hp = Math.min(target.mounted.maxHp, target.mounted.hp + regen);
            }
          }
        }
      }
    }
  }

  function updateDefenders(dt) {
    // 1. HQ Roof Auto-Turret (Lv.2~5, unpowered emergency defense; boosted by spare combat agents)
    const hq = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
    const hqInfo = G.getHqLevelInfo(state.hqLevel);
    if (hq && hq.id === 'command_hq' && hqInfo.weapon) {
      if (hq.cooldown > 0) hq.cooldown -= dt;
      if (hq.cooldown <= 0 && state.zombies.length > 0) {
        const wpn = hqInfo.weapon;
        const hcx = DATA.HQ_POS.x + 0.5;
        const hcy = DATA.HQ_POS.y + 0.5;
        const spareCombat = Math.max(0, ((state.jobs && state.jobs.combat) || 0) - (state.popUsed || 0));
        const spareRateBonus = Math.min(0.25, spareCombat * 0.05);
        const fireRate = wpn.fireRate * (1.0 + (state.cozyTier ? state.cozyTier.fireRate : 0) + spareRateBonus);
        let bestIdx = -1;
        let bestDist = 1e9;
        for (let i = 0; i < state.zombies.length; i++) {
          const z = state.zombies[i];
          const d = Math.hypot(z.x - hcx, z.y - hcy);
          if (d <= wpn.range && d < bestDist && (!G.hasDirectLineOfSight || G.hasDirectLineOfSight(hcx, hcy, z.x, z.y))) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx !== -1) {
          const target = state.zombies[bestIdx];
          hq.aimAngle = Math.atan2(target.y - hcy, target.x - hcx);
          hq.cooldown = 1 / Math.max(0.2, fireRate);
          ZS.Audio.playShoot(wpn.projType);
          const hqLvNow = state.hqLevel || 2;
          const hqMountX = hqLvNow >= 4 ? DATA.HQ_POS.x + 0.50 : DATA.HQ_POS.x + 0.62;
          const hqMountY = hqLvNow >= 4 ? DATA.HQ_POS.y + 0.50 : DATA.HQ_POS.y + 0.62;
          const hqLenTiles = hqLvNow >= 5 ? 0.56 : hqLvNow === 4 ? 0.48 : hqLvNow === 3 ? 0.38 : 0.32;
          const hqMuzzleZ = hqLvNow >= 5 ? 45.5 : hqLvNow === 4 ? 41 : hqLvNow === 3 ? 34.5 : 25;
          G.spawnMuzzleFlash(
            hqMountX + Math.cos(hq.aimAngle) * hqLenTiles,
            hqMountY + Math.sin(hq.aimAngle) * hqLenTiles,
            hqMuzzleZ,
            hq.aimAngle,
            wpn.color || '#FFE484',
            hqLvNow >= 5 ? 1.55 : hqLvNow >= 4 ? 1.35 : 1.05
          );
          const spd = wpn.speed || 18;
          const hqDmgMult = state.nightConsumables && state.nightConsumables.overpressureAmmo ? 1.20 : 1.0;
          state.projectiles.push({
            kind: 'bullet',
            projType: wpn.projType,
            x: hcx,
            y: hcy,
            z: hqInfo.maxZ - 4,
            vx: Math.cos(hq.aimAngle) * spd,
            vy: Math.sin(hq.aimAngle) * spd,
            damage: Math.round(wpn.damage * hqDmgMult),
            isCrit: false,
            splash: wpn.splashRadius || 0,
            splashFlashRadius: wpn.splashRadius || 0,
            color: wpn.color || '#FFE484',
            width: wpn.width || 2.0,
            life: 0.65,
            isHqShot: true,
            isHqOmega: wpn.projType === 'hq_omega'
          });
        }
      }
    }

    // 2. Manned Posts & Electric Auto-Turrets (ground and wall-mounted units)
    const updateOneDefender = (st, x, y, mountBaseZ, isMounted) => {
      if (!st || st.id === 'command_hq') return;
      const def = DATA.ITEMS[st.id];
      if (!def || (def.subType !== 'manned' && def.subType !== 'turret')) return;

      if (st.cooldown > 0) st.cooldown -= dt;

      // Power & EMP stun check for automated electric facilities
      const hasWindSurplus = (state.nightGen || 0) >= (state.nightIdleDrain || 0) && (state.nightGen || 0) > 0;
      if (def.requiresPower && (state.blackoutActive || (state.power <= 0.001 && !hasWindSurplus) || (st.empStunTimer || 0) > 0)) return;
      if (st.cooldown > 0) return;
      if (state.zombies.length === 0) return;

      const eff = G.getStructureEffectiveStats(st, x, y, undefined, isMounted);
      const cx = x + 0.5;
      const cy = y + 0.5;
      const SNIPER_PRIORITY = {
        boss: 6,
        spitter: 5,
        shocker: 4,
        brute: 3,
        leaper: 2,
        runner: 1,
        walker: 0
      };

      // Acquire target via 22x22 spatial zombie buckets
      if (G._zombieBucketsDirty) rebuildZombieSpatialBuckets();
      const range = eff.range;
      const minRange = eff.minRange || def.minRange || 0;
      const isIndirect = def.id === 'missile_pod' || def.id === 'emp_coil' || def.projType === 'rocket' || def.projType === 'emp';
      const rMinX = Math.max(0, Math.floor(cx - range));
      const rMaxX = Math.min(N - 1, Math.floor(cx + range));
      const rMinY = Math.max(0, Math.floor(cy - range));
      const rMaxY = Math.min(N - 1, Math.floor(cy + range));
      const hqCx = DATA.HQ_POS.x + 0.5;
      const hqCy = DATA.HQ_POS.y + 0.5;
      let bestIdx = -1;
      let bestScore = -1e9;
      for (let by = rMinY; by <= rMaxY; by++) {
        const rowOff = by * N;
        for (let bx = rMinX; bx <= rMaxX; bx++) {
          let i = zombieBucketHead[rowOff + bx];
          while (i !== -1) {
            const z = state.zombies[i];
            const d = Math.hypot(z.x - cx, z.y - cy);
            if (
              d <= range &&
              !(minRange > 0 && d < minRange) &&
              (isIndirect || !G.hasDirectLineOfSight || G.hasDirectLineOfSight(cx, cy, z.x, z.y))
            ) {
              // Priority table for sniper (boss > spitter > shocker > brute > leaper > runner > walker), else closest to HQ / turret
              const hqDist = Math.hypot(z.x - hqCx, z.y - hqCy);
              const score = def.targetMode === 'strongest'
                ? (SNIPER_PRIORITY[z.type] || 0) * 100000 + z.hp * 10 - hqDist
                : -hqDist * 2 - d;
              if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
              }
            }
            i = zombieBucketNext[i];
          }
        }
      }

      if (bestIdx === -1) return;

      // Check shot power cost for electric turrets (uses upgraded powerShot, e.g. vulcan Lv.3 = 0.24)
      const shotCost = eff.powerShot !== undefined ? eff.powerShot : (def.powerShot || 0);
      if (def.requiresPower && shotCost) {
        if (hasWindSurplus) {
          if (state.power < shotCost) return;
          state.power = Math.max(0, state.power - shotCost);
        } else {
          if (state.power < shotCost * 0.35) {
            enterBlackout();
            return;
          }
          state.power = Math.max(0, state.power - shotCost);
          if (state.power <= 0.001) enterBlackout();
        }
      }

      const target = state.zombies[bestIdx];
      st.aimAngle = Math.atan2(target.y - cy, target.x - cx);
      st.cooldown = 1 / Math.max(0.2, eff.fireRate);

      fireWeapon(def, eff, cx, cy, bestIdx, st, mountBaseZ);
    };

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const terrainElev = G.getTerrainElevationAt ? G.getTerrainElevationAt(x + 0.5, y + 0.5) : 0;
        updateOneDefender(st, x, y, terrainElev, false);
        if (st.mounted) {
          const wallDef = DATA.ITEMS[st.id];
          const wallProf = wallDef ? G.getStructLevelProfile(wallDef, st.level || 2) : null;
          const mBaseZ = terrainElev + ((wallProf && wallProf.mountBaseZ) || 15.2);
          updateOneDefender(st.mounted, x, y, mBaseZ, true);
        }
      }
    }
  }

  function spawnSingleRocketProjectile(sourceUid, cx, cy, zOff, txGoal, tyGoal, dmgPerRocket, critChance, splashR, isLv3, tubeIdx) {
    const isCrit = Math.random() < (critChance || 0);
    const finalDmg = dmgPerRocket * (isCrit ? 1.65 : 1.0);
    const angle = Math.atan2(tyGoal - cy, txGoal - cx);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const latOff = (((tubeIdx || 0) % 3) - 1) * 0.09;
    const sx = cx + perpX * latOff;
    const sy = cy + perpY * latOff;
    const launchZ = 17.5 + (zOff || 0);
    const targetZ = G.getTerrainElevationAt ? G.getTerrainElevationAt(txGoal, tyGoal) : 0;
    const dist = Math.hypot(txGoal - sx, tyGoal - sy);
    const flightDur = Math.max(0.48, Math.min(0.76, 0.34 + dist * 0.052));
    const peakZ = Math.max(58, Math.min(72, 48 + dist * 2.6 + Math.max(launchZ, targetZ) * 0.45));

    ZS.Audio.playShoot('rocket');
    G.spawnMuzzleFlash(sx + Math.cos(angle) * 0.24, sy + 0.12 + Math.sin(angle) * 0.16, launchZ, angle, '#FF9F43', 1.15);
    G.spawnBurstParticles(sx, sy, launchZ, '#CBD5E1', 3);

    state.projectiles.push({
      kind: 'rocket',
      sourceUid,
      startX: sx,
      startY: sy,
      startZ: launchZ,
      x: sx,
      y: sy,
      z: launchZ,
      targetX: txGoal,
      targetY: tyGoal,
      targetZ,
      peakZ,
      damage: finalDmg,
      isCrit,
      splash: splashR,
      isLv3: !!isLv3,
      life: flightDur,
      maxLife: flightDur,
      smokeAcc: 0
    });
  }

  function computeSalvoImpactPoint(cx, cy, anchorX, anchorY, minR, maxR, scatter, k, count) {
    let tx = anchorX;
    let ty = anchorY;
    if (scatter > 0.01) {
      if (k === 0) {
        const ang = Math.random() * Math.PI * 2;
        const r = scatter * 0.25 * Math.random();
        tx += Math.cos(ang) * r;
        ty += Math.sin(ang) * r;
      } else {
        const baseA = k * 2.39996 + (Math.random() - 0.5) * 0.45;
        const frac = Math.sqrt(k / Math.max(1, count - 1));
        const r = scatter * (0.45 + 0.55 * frac);
        tx += Math.cos(baseA) * r;
        ty += Math.sin(baseA) * r;
      }
    }
    tx = Math.max(0.6, Math.min(N - 0.6, tx));
    ty = Math.max(0.6, Math.min(N - 0.6, ty));
    const dx = tx - cx;
    const dy = ty - cy;
    const d = Math.hypot(dx, dy);
    if (minR > 0 && d < minR) {
      const safeAng = d > 1e-4 ? Math.atan2(dy, dx) : Math.atan2(anchorY - cy, anchorX - cx);
      tx = Math.max(0.6, Math.min(N - 0.6, cx + Math.cos(safeAng) * (minR + 0.05)));
      ty = Math.max(0.6, Math.min(N - 0.6, cy + Math.sin(safeAng) * (minR + 0.05)));
    } else if (maxR > 0 && d > maxR + 0.5) {
      const ang = Math.atan2(dy, dx);
      tx = Math.max(0.6, Math.min(N - 0.6, cx + Math.cos(ang) * (maxR + 0.5)));
      ty = Math.max(0.6, Math.min(N - 0.6, cy + Math.sin(ang) * (maxR + 0.5)));
    }
    return { x: tx, y: ty };
  }

  function updateBurstQueue(dt) {
    for (let i = state.burstQueue.length - 1; i >= 0; i--) {
      const b = state.burstQueue[i];
      b.delay -= dt;
      if (b.delay <= 0) {
        state.burstQueue.splice(i, 1);
        if (b.kind === 'rocket_salvo') {
          spawnSingleRocketProjectile(
            b.sourceUid,
            b.cx,
            b.cy,
            b.zOff,
            b.targetX,
            b.targetY,
            b.damage,
            b.critChance,
            b.splash,
            b.isLv3,
            b.tubeIdx
          );
          continue;
        }
        const a = b.angle + (Math.random() - 0.5) * 0.08;
        const spd = 18;
        const bz = b.z !== undefined ? b.z : 9.0;
        ZS.Audio.playShoot('rifle');
        G.spawnMuzzleFlash(
          b.cx + Math.cos(a) * 0.53,
          b.cy + Math.sin(a) * 0.53,
          bz,
          a,
          '#FFE484',
          0.88
        );
        state.projectiles.push({
          kind: 'bullet',
          sourceUid: b.sourceUid || null,
          x: b.cx,
          y: b.cy,
          z: bz,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          damage: b.damage,
          isCrit: b.isCrit,
          splash: 0,
          color: '#FFE484',
          width: 1.9,
          life: 0.60,
          pierceLeft: 1,
          hitUids: []
        });
      }
    }
  }

  function isZombieOnLv3RazorPad(z) {
    if (!z) return false;
    const tx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
    const ty = Math.max(0, Math.min(N - 1, Math.floor(z.y)));
    const under = state.structGrid[ty] && state.structGrid[ty][tx];
    return !!(under && under.id === 'razor_pad' && (under.level || 1) >= 3);
  }

  function fireWeapon(def, eff, cx, cy, targetIdx, st, mountBaseZ) {
    const target = state.zombies[targetIdx];
    if (!target) return;

    if (st && !st.uid) st.uid = G.nextStructUid++;
    const sourceUid = st && st.id !== 'command_hq' ? st.uid : null;
    const zOff = mountBaseZ || 0;

    if (def.id === 'missile_pod' || def.projType === 'rocket') {
      const salvoCount = eff.salvoCount || def.salvoCount || 2;
      const scatter = eff.salvoScatter != null ? eff.salvoScatter : (def.salvoScatter != null ? def.salvoScatter : 0.25);
      const minR = eff.minRange || def.minRange || 2.2;
      const maxR = eff.range || def.range || 8.0;
      const splashR = eff.splashRadius !== undefined ? eff.splashRadius : (def.splashRadius || 1.20);
      const isLv3 = (eff.level || 1) >= 3;
      const anchorX = Math.max(0.6, Math.min(N - 0.6, target.x));
      const anchorY = Math.max(0.6, Math.min(N - 0.6, target.y));

      const p0 = computeSalvoImpactPoint(cx, cy, anchorX, anchorY, minR, maxR, scatter, 0, salvoCount);
      spawnSingleRocketProjectile(sourceUid, cx, cy, zOff, p0.x, p0.y, eff.damage, eff.critChance, splashR, isLv3, 0);

      for (let k = 1; k < salvoCount; k++) {
        const pk = computeSalvoImpactPoint(cx, cy, anchorX, anchorY, minR, maxR, scatter, k, salvoCount);
        state.burstQueue.push({
          kind: 'rocket_salvo',
          delay: k * 0.07,
          sourceUid,
          cx,
          cy,
          zOff,
          targetX: pk.x,
          targetY: pk.y,
          damage: eff.damage,
          critChance: eff.critChance,
          splash: splashR,
          isLv3,
          tubeIdx: k
        });
      }
      return;
    }

    const isCrit = Math.random() < eff.critChance;
    const finalDmg = eff.damage * (isCrit ? 1.65 : 1.0);
    const angle = Math.atan2(target.y - cy, target.x - cx);

    ZS.Audio.playShoot(def.projType);

    const lvNow = (st && st.level) || 1;
    if (def.projType === 'emp') {
      G.spawnMuzzleFlash(cx, cy, 30.0 + zOff, angle, DATA.PALETTE.power, 1.35, 'emp');
    } else if (def.id === 'sniper_tower') {
      G.spawnMuzzleFlash(cx + Math.cos(angle) * 0.68, cy + Math.sin(angle) * 0.68, 34.3 + zOff, angle, '#FFFFFF', 1.3);
    } else if (def.id === 'shotgun_post') {
      G.spawnMuzzleFlash(cx + Math.cos(angle) * 0.53, cy - 0.06 + Math.sin(angle) * 0.53, 8.6 + zOff, angle, '#FFB347', 1.25);
    } else if (def.id === 'rifle_bunker') {
      G.spawnMuzzleFlash(cx + Math.cos(angle) * 0.53, cy + Math.sin(angle) * 0.53, 9.0 + zOff, angle, '#FFE484', 0.95);
    } else if (def.id === 'vulcan_turret') {
      const vDist = lvNow >= 3 ? 0.62 : 0.50;
      const vZ = (lvNow >= 2 ? 10.1 : 7.5) + 5.0 + zOff;
      G.spawnMuzzleFlash(cx + Math.cos(angle) * vDist, cy + Math.sin(angle) * vDist, vZ, angle, '#FFE8B6', 1.0);
    }

    if (def.projType === 'emp') {
      // Instant chain lightning across up to eff.chainCount zombies (Lv.3 = 5)
      const chainMax = eff.chainCount || def.chainCount || 3;
      const slowDur = eff.slowDuration || def.slowDuration || 1.6;
      const isLv3Emp = (eff.level || 1) >= 3;
      const hitIndices = [targetIdx];
      let curX = target.x;
      let curY = target.y;
      const points = [{ x: cx, y: cy }, { x: curX, y: curY }];

      for (let c = 1; c < chainMax; c++) {
        let nextIdx = -1;
        let minDist = 2.4;
        for (let i = 0; i < state.zombies.length; i++) {
          if (hitIndices.includes(i)) continue;
          const d = Math.hypot(state.zombies[i].x - curX, state.zombies[i].y - curY);
          if (d < minDist) {
            minDist = d;
            nextIdx = i;
          }
        }
        if (nextIdx === -1) break;
        hitIndices.push(nextIdx);
        curX = state.zombies[nextIdx].x;
        curY = state.zombies[nextIdx].y;
        points.push({ x: curX, y: curY });
      }

      state.projectiles.push({
        kind: 'chain',
        points,
        widthMult: isLv3Emp ? 1.4 : 1.0,
        life: 0.14
      });

      // Apply damage from highest index down to safely handle splice on death
      const sorted = hitIndices.slice().sort((a, b) => b - a);
      for (let k = 0; k < sorted.length; k++) {
        const idx = sorted[k];
        const zk = state.zombies[idx];
        if (zk) {
          zk.slowTimer = Math.max(zk.slowTimer, slowDur);
          const vuln = isZombieOnLv3RazorPad(zk) ? 1.15 : 1.0;
          G.damageZombie(idx, finalDmg * vuln, DATA.PALETTE.power, isCrit, sourceUid);
        }
      }
      return;
    }

    if (def.projType === 'shotgun') {
      const pellets = eff.pellets || def.pellets || 4;
      const kb = eff.knockback || 0;
      for (let p = 0; p < pellets; p++) {
        const a = angle + (Math.random() - 0.5) * (def.spread || 0.32);
        const spd = 15;
        state.projectiles.push({
          kind: 'bullet',
          sourceUid,
          x: cx,
          y: cy - 0.06,
          z: 9.0 + zOff,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          damage: finalDmg,
          isCrit,
          splash: 0,
          knockback: kb,
          color: '#ffd6a5',
          width: 2.0,
          life: 0.32,
          pierceLeft: 1,
          hitUids: []
        });
      }
      return;
    }

    // Rifle Lv.3: Tactical 2-Round Burst (secondary shot at 50% damage after 0.06s)
    if (def.id === 'rifle_bunker' && eff.burstSecondMult > 0) {
      state.burstQueue.push({
        delay: 0.06,
        sourceUid,
        cx,
        cy,
        z: 9.0 + zOff,
        angle,
        damage: finalDmg * eff.burstSecondMult,
        isCrit
      });
    }

    const spd = def.projType === 'sniper' ? 24 : def.projType === 'missile' ? 11 : 18;
    const color =
      def.projType === 'sniper'
        ? '#f8fafc'
        : def.projType === 'missile'
        ? '#ff7b54'
        : def.projType === 'vulcan'
        ? '#ffe8b6'
        : '#ffe0a8';
    const splashR = eff.splashRadius !== undefined ? eff.splashRadius : (def.splashRadius || 0);
    const pierceCnt = eff.pierceCount || 1;

    state.projectiles.push({
      kind: 'bullet',
      sourceUid,
      x: cx,
      y: cy,
      startX: cx,
      startY: cy,
      z: (def.id === 'sniper_tower' ? 34.0 : def.id === 'rifle_bunker' ? 9.0 : 14.0) + zOff,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      damage: finalDmg,
      isCrit,
      splash: splashR,
      splashRingLv3: def.id === 'missile_pod' && (eff.level || 1) >= 3 ? splashR : 0,
      color,
      width: def.projType === 'sniper' ? 2.8 : def.projType === 'missile' ? 3.5 : 2.1,
      life: 0.65,
      pierceLeft: pierceCnt,
      isPiercingSniper: def.id === 'sniper_tower' && pierceCnt > 1,
      hitUids: []
    });
  }

  function resolveAcidGlobHit(p) {
    if (state.groundDecals.length >= 45) {
      state.groundDecals.shift();
    }
    state.groundDecals.push({
      kind: 'acid_puddle',
      x: p.targetX,
      y: p.targetY,
      radius: 0.32,
      color: DATA.PALETTE.mutantAcid || '#C8F542',
      subColor: DATA.PALETTE.mutantAcidDim || '#6E8A1E',
      seed: Math.random() * 10,
      life: 2.5,
      maxLife: 2.5
    });
    G.spawnBurstParticles(p.targetX, p.targetY, 10, DATA.PALETTE.mutantAcid || '#C8F542', 8);

    const st = state.structGrid[p.targetTy] && state.structGrid[p.targetTy][p.targetTx];
    if (!st) return;

    const rawDmg = Math.max(1, Math.round(p.damage || 13));
    const dmgScale = state.phase === 'night' && state.nightConsumables && state.nightConsumables.reactiveArmor ? 0.80 : 1.0;
    const dmg = Math.max(1, Math.round(rawDmg * dmgScale));
    st.hp -= dmg;
    st.hitFlashTimer = 0.05;
    st.hitFlash = 1.0;

    let topologyChanged = false;
    if (st.id === 'command_hq') {
      G.triggerScreenShake(3.5, 0.2);
      G.addFloatingText(p.targetX, p.targetY, 28, `-${dmg}`, DATA.PALETTE.danger, 12, DATA.PALETTE.outlineDark);
      G.notifyCombatHud();
      if (st.hp <= 0) {
        st.hp = 0;
        G.spawnStructureDebris(p.targetX, p.targetY, 'command_hq', 18);
        G.triggerScreenShake(8.0, 0.45);
        G.triggerGameOver();
      }
      return;
    }

    const wallDef = DATA.ITEMS[st.id];
    const wallProf = wallDef ? G.getStructLevelProfile(wallDef, st.level || 1) : null;
    const baseZ = (wallProf && wallProf.mountBaseZ) || ((st.level || 1) >= 3 ? 25.4 : (st.level || 1) === 2 ? 15.2 : 10);
    G.addFloatingText(p.targetTx + 0.5, p.targetTy + 0.5, Math.min(20, baseZ), `-${dmg}`, DATA.PALETTE.danger, 12, DATA.PALETTE.outlineDark);

    // 50% splash acid damage onto wall-mounted unit
    if (st.mounted) {
      const m = st.mounted;
      const mDmg = Math.max(1, Math.round(dmg * 0.5));
      m.hp -= mDmg;
      m.hitFlashTimer = 0.05;
      m.hitFlash = 1.0;
      state.projectiles.push({
        kind: 'acid_mount_ring',
        x: p.targetTx + 0.5,
        y: p.targetTy + 0.5,
        z: baseZ + 6,
        radius: 0.18,
        color: DATA.PALETTE.mutantAcid || '#C8F542',
        life: 0.30,
        maxLife: 0.30
      });
      G.addFloatingText(p.targetTx + 0.5, p.targetTy + 0.5, baseZ + 14, `-${mDmg}`, DATA.PALETTE.danger, 12, DATA.PALETTE.outlineDark);
      if (m.hp <= 0) {
        const mRank = m.rank || G.computeRankFromXp(m.xp || 0);
        const mDef = DATA.ITEMS[m.id];
        G.spawnStructureDebris(p.targetTx + 0.5, p.targetTy + 0.5, m.id, 9, m.level || 1, baseZ);
        if (mRank >= 1) {
          G.spawnBadgeShatterVfx(p.targetTx + 0.5, p.targetTy + 0.5, mRank);
          const rInfo = G.getVeterancyRankInfo(mRank);
          G.banner(`[${rInfo.name}] ${mDef ? mDef.name : '거치 시설'} 용해 파괴!`, '산성 포격에 의해 상부 거치 시설이 파괴되었습니다.', 'danger');
        }
        st.mounted = null;
        topologyChanged = true;
      }
    }

    if (st.hp <= 0) {
      G.destroyBlockingStructureAt(p.targetTx, p.targetTy);
      topologyChanged = true;
    }

    if (topologyChanged) {
      G.recalculateBaseStats();
      G.recomputeFlow();
    }
    G.notifyCombatHud();
  }

  function triggerShockerEmp(cx, cy, radius, duration) {
    const rad = radius || 2.1;
    const rawDur = duration || 3.0;
    const arcOverdrive = G.isArcOverdriveActive ? G.isArcOverdriveActive() : false;
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const empMult = arcOverdrive && div && div.overdriveEmpDurationMult != null ? div.overdriveEmpDurationMult : 1.0;
    const dur = +(rawDur * empMult).toFixed(3);
    state.projectiles.push({
      kind: 'emp_ring',
      x: cx,
      y: cy,
      radius: rad,
      color: DATA.PALETTE.mutantEmp || '#B26BFF',
      life: 0.35,
      maxLife: 0.35
    });
    G.spawnBurstParticles(cx, cy, 10, DATA.PALETTE.mutantEmp || '#B26BFF', 10);
    G.triggerScreenShake(2.5, 0.16);

    let newlyStunned = false;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        if (Math.hypot((x + 0.5) - cx, (y + 0.5) - cy) > rad + 0.05) continue;

        const def = DATA.ITEMS[st.id];
        if (def && def.requiresPower) {
          if ((st.empStunTimer || 0) <= 0) newlyStunned = true;
          st.empStunTimer = Math.max(st.empStunTimer || 0, dur);
        }
        if (st.mounted) {
          const mDef = DATA.ITEMS[st.mounted.id];
          if (mDef && mDef.requiresPower) {
            if ((st.mounted.empStunTimer || 0) <= 0) newlyStunned = true;
            st.mounted.empStunTimer = Math.max(st.mounted.empStunTimer || 0, dur);
          }
        }
      }
    }
    if (newlyStunned && G.invalidateStatsCache) G.invalidateStatsCache();
  }

  function detonateRocketImpact(p) {
    const ix = p.targetX;
    const iy = p.targetY;
    const impElev = p.targetZ || 0;
    const splashR = p.splash || 1.20;
    ZS.Audio.playExplosion();
    G.spawnBurstParticles(ix, iy, impElev + 4, '#FF8A3D', p.isLv3 ? 7 : 6);
    state.flares.push({ x: ix, y: iy, radius: p.isLv3 ? 2.0 : 1.7, life: 0.18 });
    if (state.groundDecals.length >= 45) {
      state.groundDecals.shift();
    }
    state.groundDecals.push({
      kind: 'crater_crack',
      x: ix,
      y: iy,
      radius: Math.min(0.65, splashR * 0.36),
      seed: Math.random() * 10,
      life: 4.0,
      maxLife: 4.0
    });
    state.projectiles.push({
      kind: 'ring',
      x: ix,
      y: iy,
      radius: splashR,
      color: p.isLv3 ? '#FF6B4A' : '#FF9F43',
      life: 0.24,
      maxLife: 0.24
    });
    for (let k = state.zombies.length - 1; k >= 0; k--) {
      const zk = state.zombies[k];
      if (!zk) continue;
      const dist = Math.hypot(zk.x - ix, zk.y - iy);
      if (dist <= splashR) {
        const vuln = isZombieOnLv3RazorPad(zk) ? 1.15 : 1.0;
        const falloff = dist <= 0.45 ? 1.0 : Math.max(0.45, 1 - (dist / splashR) * 0.45);
        G.damageZombie(k, p.damage * vuln * falloff, '#FF9F43', p.isCrit, p.sourceUid);
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= dt;
      if (p.kind === 'rocket') {
        const maxL = p.maxLife || 0.6;
        const u = Math.max(0, Math.min(1, 1 - Math.max(0, p.life) / maxL));
        const sZ = p.startZ != null ? p.startZ : 18;
        const tZ = p.targetZ != null ? p.targetZ : 0;
        const linZ = sZ + (tZ - sZ) * u;
        const lift = Math.max(24, (p.peakZ || 62) - Math.max(sZ, tZ));
        p.x = p.startX + (p.targetX - p.startX) * u;
        p.y = p.startY + (p.targetY - p.startY) * u;
        p.z = linZ + 4 * lift * u * (1 - u);
        p.smokeAcc = (p.smokeAcc || 0) + dt;
        if (p.smokeAcc >= 0.055 && p.life > 0) {
          p.smokeAcc = 0;
          if (state.particles.length < 240) {
            const locElev = G.getTerrainElevationAt ? G.getTerrainElevationAt(p.x, p.y) : 0;
            state.particles.push({
              kind: 'dust',
              x: p.x,
              y: p.y,
              z: Math.max(2, p.z - locElev),
              vx: (Math.random() - 0.5) * 0.45,
              vy: (Math.random() - 0.5) * 0.45,
              vz: 3.0 + Math.random() * 4.0,
              color: Math.random() < 0.5 ? '#CBD5E1' : '#94A3B8',
              size: 2.0 + Math.random() * 1.4,
              life: 0.34,
              maxLife: 0.34
            });
          }
        }
        if (p.life <= 0) {
          p.x = p.targetX;
          p.y = p.targetY;
          detonateRocketImpact(p);
          state.projectiles.splice(i, 1);
        }
        continue;
      }
      if (p.kind === 'acid_glob') {
        const maxL = p.maxLife || 0.4;
        const progress = Math.min(1, 1 - Math.max(0, p.life) / maxL);
        p.x = p.startX + (p.targetX - p.startX) * progress;
        p.y = p.startY + (p.targetY - p.startY) * progress;
        const gtx = Math.floor(p.x);
        const gty = Math.floor(p.y);
        const gt = state.terrainGrid && state.terrainGrid[gty] && state.terrainGrid[gty][gtx];
        if (gt && gt.kind === 'rock' && gt.isPeak) {
          G.spawnBurstParticles(p.x, p.y, 18, DATA.PALETTE.mutantAcid || '#C8F542', 6);
          state.projectiles.splice(i, 1);
          continue;
        }
        if (p.life <= 0) {
          resolveAcidGlobHit(p);
          state.projectiles.splice(i, 1);
        }
        continue;
      }
      if (p.life <= 0) {
        state.projectiles.splice(i, 1);
        continue;
      }
      if (
        p.kind === 'chain' ||
        p.kind === 'ring' ||
        p.kind === 'spark' ||
        p.kind === 'sniper_trail' ||
        p.kind === 'promo_ring' ||
        p.kind === 'acid_mount_ring' ||
        p.kind === 'emp_ring' ||
        p.kind === 'warcry_ring' ||
        p.kind === 'bleed_burst'
      ) continue;

      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (G.findFirstPeakOnSegment) {
        const sTx = p.startX !== undefined ? Math.floor(p.startX) : Math.floor(prevX);
        const sTy = p.startY !== undefined ? Math.floor(p.startY) : Math.floor(prevY);
        const hitPeak = G.findFirstPeakOnSegment(prevX, prevY, p.x, p.y, sTx, sTy);
        if (hitPeak) {
          const hitX = (prevX + p.x) * 0.5;
          const hitY = (prevY + p.y) * 0.5;
          G.spawnBurstParticles(hitX, hitY, 16, '#B8C4D0', 4);
          state.projectiles.splice(i, 1);
          continue;
        }
      }

      const hitList = p.hitUids || [];

      // Hit detection against zombies (22x22 spatial bucket neighborhood + swept segment)
      if (G._zombieBucketsDirty) rebuildZombieSpatialBuckets();
      const segDx = p.x - prevX;
      const segDy = p.y - prevY;
      const segLenSq = segDx * segDx + segDy * segDy;
      const minX = (prevX < p.x ? prevX : p.x) - 0.42;
      const maxX = (prevX > p.x ? prevX : p.x) + 0.42;
      const minY = (prevY < p.y ? prevY : p.y) - 0.42;
      const maxY = (prevY > p.y ? prevY : p.y) + 0.42;
      const cMinX = Math.max(0, Math.floor(minX));
      const cMaxX = Math.min(N - 1, Math.floor(maxX));
      const cMinY = Math.max(0, Math.floor(minY));
      const cMaxY = Math.min(N - 1, Math.floor(maxY));
      let hitIdx = -1;
      let bestT = 2;
      for (let cy = cMinY; cy <= cMaxY; cy++) {
        const rowOff = cy * N;
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          let zIdx = zombieBucketHead[rowOff + cx];
          while (zIdx !== -1) {
            const z = state.zombies[zIdx];
            if (!(z.uid && hitList.indexOf(z.uid) !== -1)) {
              const t = segLenSq > 1e-8
                ? Math.max(0, Math.min(1, ((z.x - prevX) * segDx + (z.y - prevY) * segDy) / segLenSq))
                : 0;
              const nearX = prevX + segDx * t;
              const nearY = prevY + segDy * t;
              const dx = z.x - nearX;
              const dy = z.y - nearY;
              if (dx * dx + dy * dy <= 0.1764 && t < bestT) {
                bestT = t;
                hitIdx = zIdx;
              }
            }
            zIdx = zombieBucketNext[zIdx];
          }
        }
      }

      if (hitIdx !== -1) {
        if (p.splash > 0) {
          ZS.Audio.playExplosion();
          const splashParticleCol = p.isHqOmega ? (DATA.PALETTE.power || '#5EF2FF') : '#ff8a47';
          const splashRingCol = p.isHqOmega ? (DATA.PALETTE.power || '#5EF2FF') : '#FF9F43';
          const splashDmgCol = p.isHqOmega ? (DATA.PALETTE.power || '#5EF2FF') : '#ff9f43';
          G.spawnBurstParticles(p.x, p.y, 12, splashParticleCol, p.isHqOmega ? 12 : p.isHqShot ? 8 : 12);
          state.flares.push({ x: p.x, y: p.y, radius: p.isHqOmega ? 2.1 : p.isHqShot ? 1.5 : 2.3, life: 0.20 });
          const ringRad = p.splashFlashRadius || p.splashRingLv3 || 0;
          if (ringRad > 0) {
            state.projectiles.push({
              kind: 'ring',
              x: p.x,
              y: p.y,
              radius: ringRad,
              color: splashRingCol,
              fillColor: p.isHqOmega ? 'rgba(94, 242, 255, 0.24)' : 'rgba(255, 159, 67, 0.22)',
              life: 0.22,
              maxLife: 0.22
            });
          }
          for (let k = state.zombies.length - 1; k >= 0; k--) {
            const zk = state.zombies[k];
            const dist = Math.hypot(zk.x - p.x, zk.y - p.y);
            if (dist <= p.splash) {
              const vuln = isZombieOnLv3RazorPad(zk) ? 1.15 : 1.0;
              G.damageZombie(k, p.damage * vuln * (1 - dist / (p.splash * 1.5)), splashDmgCol, p.isCrit, p.sourceUid);
            }
          }
          state.projectiles.splice(i, 1);
        } else {
          const hitZ = state.zombies[hitIdx];
          if (hitZ && hitZ.uid) {
            if (!p.hitUids) p.hitUids = [];
            p.hitUids.push(hitZ.uid);
          }
          const isSecondPierce = p.isPiercingSniper && p.hitUids && p.hitUids.length === 2;
          const pierceMult = isSecondPierce ? 0.70 : 1.0;
          const vuln = isZombieOnLv3RazorPad(hitZ) ? 1.15 : 1.0;

          // Shotgun Lv.3 knockback (0.20 tiles, bosses immune, prevent pushing into solid structure or outside map)
          if (p.knockback > 0 && hitZ) {
            const zDef = DATA.ZOMBIES[hitZ.type];
            if (!(zDef && zDef.isBoss)) {
              const vLen = Math.hypot(p.vx, p.vy) || 1;
              const otx = Math.max(0, Math.min(N - 1, Math.floor(hitZ.x)));
              const oty = Math.max(0, Math.min(N - 1, Math.floor(hitZ.y)));
              const nx = hitZ.x + (p.vx / vLen) * p.knockback;
              const ny = hitZ.y + (p.vy / vLen) * p.knockback;
              const ntx = Math.floor(nx);
              const nty = Math.floor(ny);
              if (ntx >= 0 && nty >= 0 && ntx < N && nty < N) {
                const terrainOk =
                  (ntx === otx && nty === oty) ||
                  !ZS.Pathfinding ||
                  !ZS.Pathfinding.canTraverseTerrainStep ||
                  ZS.Pathfinding.canTraverseTerrainStep(state.terrainGrid, otx, oty, ntx, nty);
                const blk = state.structGrid[nty] && state.structGrid[nty][ntx];
                const bDef = blk ? (blk.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[blk.id]) : null;
                if (terrainOk && (!blk || (bDef && bDef.passable))) {
                  hitZ.x = nx;
                  hitZ.y = ny;
                  G.spawnBurstParticles(nx, ny, 2, '#C8BFA8', 4);
                }
              }
            }
          }

          // Sniper Lv.3 white piercing trail (0.15s)
          if (p.isPiercingSniper) {
            state.projectiles.push({
              kind: 'sniper_trail',
              x1: p.startX !== undefined ? p.startX : p.x - p.vx * 0.08,
              y1: p.startY !== undefined ? p.startY : p.y - p.vy * 0.08,
              x2: p.x,
              y2: p.y,
              z: p.z || 24,
              life: 0.15,
              maxLife: 0.15
            });
            p.startX = p.x;
            p.startY = p.y;
          }

          G.damageZombie(hitIdx, p.damage * pierceMult * vuln, p.isCrit ? DATA.PALETTE.critText : '#ffffff', p.isCrit, p.sourceUid);

          const rem = (p.pierceLeft || 1) - 1;
          p.pierceLeft = rem;
          if (rem <= 0) {
            state.projectiles.splice(i, 1);
          }
        }
      }
    }
  }

  Object.assign(G, {
    rebuildZombieSpatialBuckets,
    allocateSidesByWeights,
    computeWaveHpScale,
    computeBossHpScale,
    buildWaveQueue,
    generateWaveIntel,
    startNightWave,
    spawnZombie,
    triggerNanoRepair,
    triggerAirstrikeAt,
    update,
    enterBlackout,
    triggerBlackout,
    updateRepairBays,
    updateDefenders,
    updateBurstQueue,
    isZombieOnLv3RazorPad,
    fireWeapon,
    resolveAcidGlobHit,
    triggerShockerEmp,
    updateProjectiles
  });
})();
