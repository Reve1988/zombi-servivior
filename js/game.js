window.ZS = window.ZS || {};

ZS.Game = (function () {
  const SAVE_KEY = 'outpost_zero_save_v1';
  const DATA = ZS.DATA;
  const N = DATA.GRID_SIZE;

  const state = {
    wave: 1,
    phase: 'day', // 'day' | 'night' | 'gameover'
    isNight: false,
    nightAlpha: 0,
    blackoutTriggered: false,
    bossDefeated: false,
    gameSpeed: 1,

    wood: DATA.INITIAL_RESOURCES.wood,
    scrap: DATA.INITIAL_RESOURCES.scrap,
    coin: DATA.INITIAL_RESOURCES.coin,

    power: DATA.HQ_STATS.basePowerCap,
    powerCap: DATA.HQ_STATS.basePowerCap,
    dayCharge: DATA.HQ_STATS.baseDayCharge,
    nightIdleDrain: 0,

    agents: DATA.HQ_STATS.startingAgents,
    popCap: DATA.HQ_STATS.basePopCap,
    popUsed: 0,

    cozyScore: 0,
    cozyDiversityBonus: 0,
    cozyTier: DATA.COZY_TIERS[0],

    freeVouchers: {},
    traderOffers: [],
    traderRefreshCost: 15,

    skills: {
      repairCd: 0,
      repairMaxCd: 18,
      airstrikeCd: 0,
      airstrikeMaxCd: 22
    },

    floorGrid: [],
    structGrid: [],
    flow: null,

    spawnQueue: [],
    spawnTimer: 0,
    waveTotalZombies: 0,
    waveKilledZombies: 0,

    zombies: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    flares: [],

    lastSummary: null
  };

  let onUiChange = null;
  let onWaveBanner = null;

  function setCallbacks(cbs) {
    onUiChange = cbs.onUiChange || null;
    onWaveBanner = cbs.onWaveBanner || null;
  }

  function notifyUi() {
    if (onUiChange) onUiChange();
  }

  function banner(title, sub, tone) {
    if (onWaveBanner) onWaveBanner(title, sub, tone || 'info');
  }

  function createEmptyGrids() {
    state.floorGrid = Array.from({ length: N }, () => Array(N).fill(null));
    state.structGrid = Array.from({ length: N }, () => Array(N).fill(null));
  }

  function initNewGame() {
    createEmptyGrids();

    state.wave = 1;
    state.phase = 'day';
    state.isNight = false;
    state.nightAlpha = 0;
    state.blackoutTriggered = false;
    state.bossDefeated = false;
    state.gameSpeed = 1;

    state.wood = DATA.INITIAL_RESOURCES.wood;
    state.scrap = DATA.INITIAL_RESOURCES.scrap;
    state.coin = DATA.INITIAL_RESOURCES.coin;

    state.agents = DATA.HQ_STATS.startingAgents;
    state.freeVouchers = {};
    state.skills.repairCd = 0;
    state.skills.airstrikeCd = 0;

    state.zombies = [];
    state.projectiles = [];
    state.particles = [];
    state.floatingTexts = [];
    state.flares = [];
    state.spawnQueue = [];

    // Starter modern tactical plaza around HQ (8,8)
    const hx = DATA.HQ_POS.x;
    const hy = DATA.HQ_POS.y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        state.floorGrid[hy + dy][hx + dx] = dx === 0 && dy === 0 ? 'steel_deck' : 'asphalt';
      }
    }

    state.structGrid[hy][hx] = {
      id: 'command_hq',
      hp: DATA.HQ_STATS.maxHp,
      maxHp: DATA.HQ_STATS.maxHp,
      cooldown: 0,
      aimAngle: 0
    };

    recalculateBaseStats();
    state.power = state.powerCap;
    recomputeFlow();
    refreshTraderOffers(false);
    saveGame();
    notifyUi();
  }

  function recomputeFlow() {
    state.flow = ZS.Pathfinding.computeFlowField(N, DATA.HQ_POS, state.structGrid);
  }

  function recalculateBaseStats() {
    let powerCap = DATA.HQ_STATS.basePowerCap;
    let dayCharge = DATA.HQ_STATS.baseDayCharge;
    let nightIdleDrain = 0;
    let popCap = DATA.HQ_STATS.basePopCap;
    let popUsed = 0;
    let cozyRaw = 0;
    const uniqueGroups = new Set();

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const fid = state.floorGrid[y][x];
        const fDef = fid ? DATA.ITEMS[fid] : null;
        if (fDef && fDef.cozy) {
          cozyRaw += fDef.cozy;
          if (fDef.cozyGroup) uniqueGroups.add(fDef.cozyGroup);
        }

        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const def = DATA.ITEMS[st.id];
        if (!def) continue;

        // Update maxHp with floor bonus
        const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
        const targetMax = Math.round(def.maxHp * hpMult);
        if (st.maxHp !== targetMax) {
          const ratio = st.maxHp > 0 ? st.hp / st.maxHp : 1;
          st.maxHp = targetMax;
          st.hp = Math.min(targetMax, Math.max(1, Math.round(targetMax * ratio)));
        }

        if (def.powerCap) powerCap += def.powerCap;
        if (def.dayCharge) dayCharge += def.dayCharge;
        if (def.requiresPower && def.powerIdle) nightIdleDrain += def.powerIdle;
        if (def.popCap) popCap += def.popCap;
        if (def.popUse) popUsed += def.popUse;

        if (def.cozy) {
          cozyRaw += def.cozy;
          if (fDef && fDef.cozyTileBonus && def.category === 'decor') {
            cozyRaw += fDef.cozyTileBonus;
          }
          if (def.cozyGroup) uniqueGroups.add(def.cozyGroup);
        }
      }
    }

    const diversityBonus = uniqueGroups.size * 5;
    const totalCozy = cozyRaw + diversityBonus;

    let tier = DATA.COZY_TIERS[0];
    for (let i = 0; i < DATA.COZY_TIERS.length; i++) {
      if (totalCozy >= DATA.COZY_TIERS[i].min) {
        tier = DATA.COZY_TIERS[i];
      }
    }

    state.powerCap = powerCap;
    state.dayCharge = dayCharge;
    state.nightIdleDrain = nightIdleDrain;
    state.popCap = popCap;
    state.popUsed = popUsed;
    state.cozyScore = totalCozy;
    state.cozyDiversityBonus = diversityBonus;
    state.cozyTier = tier;
  }

  function getStructureEffectiveStats(st, tx, ty) {
    const def = DATA.ITEMS[st.id];
    if (!def) return { damage: 0, fireRate: 0, range: 0, critChance: 0 };

    let dmgMult = 1.0;
    let rateMult = 1.0 + state.cozyTier.fireRate;
    let rangeMult = 1.0;
    let critChance = 0.04;

    if (def.subType === 'manned') {
      dmgMult += state.cozyTier.agentDmg;
    }

    const fid = state.floorGrid[ty] && state.floorGrid[ty][tx];
    const fDef = fid ? DATA.ITEMS[fid] : null;
    if (fDef && fDef.rateTileBonus) {
      rateMult += fDef.rateTileBonus;
    }

    const powered = !state.isNight || state.power > 0.01;

    // Scan aura providers
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const other = state.structGrid[y][x];
        if (!other || other.id === 'command_hq') continue;
        const oDef = DATA.ITEMS[other.id];
        if (!oDef || !oDef.aura) continue;
        if (oDef.requiresPower && !powered) continue;

        const dist = Math.hypot(tx - x, ty - y);
        if (dist <= oDef.aura.radius + 0.05) {
          if (oDef.aura.mannedDmg && def.subType === 'manned') {
            dmgMult += oDef.aura.mannedDmg;
          }
          if (oDef.aura.fireRate) {
            rateMult += oDef.aura.fireRate;
          }
          if (oDef.aura.rangeMult) {
            rangeMult += oDef.aura.rangeMult;
          }
          if (oDef.aura.critChance) {
            critChance += oDef.aura.critChance;
          }
        }
      }
    }

    return {
      damage: (def.damage || 0) * dmgMult,
      fireRate: (def.fireRate || 0) * rateMult,
      range: (def.range || 0) * rangeMult,
      critChance: Math.min(0.65, critChance)
    };
  }

  function canAffordCost(cost) {
    if (!cost) return true;
    if (cost.wood && state.wood < cost.wood) return false;
    if (cost.scrap && state.scrap < cost.scrap) return false;
    if (cost.coin && state.coin < cost.coin) return false;
    return true;
  }

  function payCost(cost) {
    if (!cost) return;
    if (cost.wood) state.wood -= cost.wood;
    if (cost.scrap) state.scrap -= cost.scrap;
    if (cost.coin) state.coin -= cost.coin;
  }

  function canPlaceItem(itemId, tx, ty) {
    if (state.phase !== 'day') {
      return { ok: false, reason: '정비 페이즈(낮)에만 건설할 수 있습니다.' };
    }
    const def = DATA.ITEMS[itemId];
    if (!def) return { ok: false, reason: '잘못된 시설입니다.' };

    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      return { ok: false, reason: '맵 범위를 벗어났습니다.' };
    }

    const isBorder = tx === 0 || ty === 0 || tx === N - 1 || ty === N - 1;
    if (def.layer === 'struct' && isBorder) {
      return { ok: false, reason: '외곽 좀비 진입 구역에는 건물을 지을 수 없습니다.' };
    }

    if (def.unlockedByBoss && !state.bossDefeated) {
      return { ok: false, reason: '웨이브 5 보스 변이체를 처치하면 해금됩니다!' };
    }

    if (def.layer === 'floor') {
      if (state.floorGrid[ty][tx] === itemId) {
        return { ok: false, reason: '이미 같은 바닥재가 시공되어 있습니다.' };
      }
    } else {
      if (state.structGrid[ty][tx]) {
        return { ok: false, reason: '이미 다른 시설이 설치된 타일입니다.' };
      }
    }

    if (def.popUse) {
      if (state.popUsed + def.popUse > state.popCap) {
        return { ok: false, reason: '숙소 수용량이 부족합니다! [전력·숙소] 탭에서 막사/숙소를 건설하세요.' };
      }
      if (state.popUsed + def.popUse > state.agents) {
        return { ok: false, reason: '대기 중인 작전 요원이 부족합니다! (상인 스카우트 또는 다음 날 합류)' };
      }
    }

    const hasVoucher = (state.freeVouchers[itemId] || 0) > 0;
    if (!hasVoucher && !canAffordCost(def.cost)) {
      return { ok: false, reason: '건설 자원이 부족합니다.' };
    }

    return { ok: true };
  }

  function placeItem(itemId, tx, ty) {
    const check = canPlaceItem(itemId, tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      addFloatingText(tx + 0.5, ty + 0.5, 18, check.reason, '#ff8080', 11);
      return false;
    }

    const def = DATA.ITEMS[itemId];
    if ((state.freeVouchers[itemId] || 0) > 0) {
      state.freeVouchers[itemId] -= 1;
    } else {
      payCost(def.cost);
    }

    if (def.layer === 'floor') {
      state.floorGrid[ty][tx] = itemId;
    } else {
      const fid = state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
      const maxHp = Math.round(def.maxHp * hpMult);
      state.structGrid[ty][tx] = {
        id: itemId,
        hp: maxHp,
        maxHp,
        cooldown: 0,
        aimAngle: 0
      };
    }

    // Immediate battery cap increase feels nice if building battery/solar on day 1
    const prevCap = state.powerCap;
    recalculateBaseStats();
    if (def.dayCharge && state.wave === 1) {
      // On Day 1 before first night, let newly built generators top up initial charge up to cap
      state.power = Math.min(state.powerCap, state.power + Math.round(def.dayCharge * 0.5));
    } else if (state.powerCap > prevCap && def.id === 'battery_bank') {
      state.power = Math.min(state.powerCap, state.power + 20);
    }

    recomputeFlow();
    ZS.Audio.playBuild();
    spawnBurstParticles(tx + 0.5, ty + 0.5, 8, '#7ef5b5', 7);
    saveGame();
    notifyUi();
    return true;
  }

  function moveStructure(fromX, fromY, toX, toY) {
    if (state.phase !== 'day') return false;
    const src = state.structGrid[fromY] && state.structGrid[fromY][fromX];
    if (!src || src.id === 'command_hq') return false;
    if (toX <= 0 || toY <= 0 || toX >= N - 1 || toY >= N - 1) {
      ZS.Audio.playError();
      addFloatingText(toX + 0.5, toY + 0.5, 18, '외곽 진입 구역으로는 이동할 수 없습니다.', '#ff8080', 11);
      return false;
    }
    if (state.structGrid[toY][toX]) {
      ZS.Audio.playError();
      return false;
    }

    state.structGrid[toY][toX] = src;
    state.structGrid[fromY][fromX] = null;
    recalculateBaseStats();
    recomputeFlow();
    ZS.Audio.playBuild();
    addFloatingText(toX + 0.5, toY + 0.5, 18, '위치 재배치 완료', '#7ef5ff', 11);
    saveGame();
    notifyUi();
    return true;
  }

  function removeAt(tx, ty) {
    if (state.phase !== 'day') return false;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return false;

    const st = state.structGrid[ty][tx];
    if (st) {
      if (st.id === 'command_hq') {
        ZS.Audio.playError();
        addFloatingText(tx + 0.5, ty + 0.5, 22, '지휘 본부는 철거할 수 없습니다!', '#ff8080', 12);
        return false;
      }
      const def = DATA.ITEMS[st.id];
      state.structGrid[ty][tx] = null;
      refundCost(def && def.cost, tx, ty);
      recalculateBaseStats();
      state.power = Math.min(state.power, Math.max(state.powerCap, state.power));
      recomputeFlow();
      ZS.Audio.playRemove();
      saveGame();
      notifyUi();
      return true;
    }

    const fid = state.floorGrid[ty][tx];
    if (fid) {
      const fDef = DATA.ITEMS[fid];
      state.floorGrid[ty][tx] = null;
      refundCost(fDef && fDef.cost, tx, ty);
      recalculateBaseStats();
      ZS.Audio.playRemove();
      saveGame();
      notifyUi();
      return true;
    }

    return false;
  }

  function refundCost(cost, tx, ty) {
    if (!cost) return;
    const parts = [];
    if (cost.wood) {
      const rw = Math.max(1, Math.round(cost.wood * 0.8));
      state.wood += rw;
      parts.push(`+${rw}🪵`);
    }
    if (cost.scrap) {
      const rs = Math.max(1, Math.round(cost.scrap * 0.8));
      state.scrap += rs;
      parts.push(`+${rs}🔩`);
    }
    if (cost.coin) {
      const rc = Math.max(1, Math.round(cost.coin * 0.8));
      state.coin += rc;
      parts.push(`+${rc}🪙`);
    }
    if (parts.length > 0) {
      addFloatingText(tx + 0.5, ty + 0.5, 16, `환급 ${parts.join(' ')}`, '#ffd97d', 11);
    }
  }

  function getRepairAllInfo() {
    let missingTotal = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st && st.hp < st.maxHp) {
          missingTotal += st.maxHp - st.hp;
        }
      }
    }
    if (missingTotal <= 0) return { needed: false, woodCost: 0, scrapCost: 0 };
    return {
      needed: true,
      woodCost: Math.max(2, Math.ceil(missingTotal / 32)),
      scrapCost: Math.max(2, Math.ceil(missingTotal / 38))
    };
  }

  function repairAllStructures() {
    if (state.phase !== 'day') return false;
    const info = getRepairAllInfo();
    if (!info.needed) return false;
    if (state.wood < info.woodCost || state.scrap < info.scrapCost) {
      ZS.Audio.playError();
      banner('수리 자재 부족', `전체 수리에 🪵${info.woodCost}, 🔩${info.scrapCost}이 필요합니다.`, 'warn');
      return false;
    }
    state.wood -= info.woodCost;
    state.scrap -= info.scrapCost;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st && st.hp < st.maxHp) {
          st.hp = st.maxHp;
        }
      }
    }
    ZS.Audio.playBuild();
    banner('기지 전체 정비 완료', '모든 방벽과 방어 시설의 내구도가 100% 복구되었습니다.', 'good');
    saveGame();
    notifyUi();
    return true;
  }

  // ================= TRADER CONVOY SYSTEM =================
  function refreshTraderOffers(paid) {
    if (paid) {
      if (state.coin < state.traderRefreshCost) {
        ZS.Audio.playError();
        return false;
      }
      state.coin -= state.traderRefreshCost;
      ZS.Audio.playTrade();
    }

    // Always include Wood & Scrap packs + 3 shuffled specialty deals
    const pool = DATA.TRADER_POOL.slice();
    const fixed = pool.slice(0, 3); // wood, scrap, power_cell
    const rest = pool.slice(3).sort(() => Math.random() - 0.5).slice(0, 3);
    state.traderOffers = fixed.concat(rest).map((o) => ({
      ...o,
      sold: false
    }));

    notifyUi();
    return true;
  }

  function buyTraderOffer(index) {
    const offer = state.traderOffers[index];
    if (!offer || offer.sold) return false;
    if (state.coin < offer.coinCost) {
      ZS.Audio.playError();
      return false;
    }

    if (offer.type === 'agent') {
      if (state.agents >= state.popCap) {
        ZS.Audio.playError();
        banner('숙소 수용량 부족!', '먼저 [⚡전력·숙소] 탭에서 막사나 컨테이너 숙소를 건설해 빈자리를 확보하세요.', 'warn');
        return false;
      }
      state.coin -= offer.coinCost;
      state.agents += offer.amount;
      offer.sold = true;
      ZS.Audio.playTrade();
      banner('베테랑 요원 합류!', `작전 요원이 기지에 배치되었습니다. (현재 요원 👥 ${state.agents}/${state.popCap})`, 'good');
      saveGame();
      notifyUi();
      return true;
    }

    state.coin -= offer.coinCost;
    if (offer.type === 'resource') {
      if (offer.give.wood) state.wood += offer.give.wood;
      if (offer.give.scrap) state.scrap += offer.give.scrap;
    } else if (offer.type === 'power_boost') {
      state.power = Math.min(Math.round(state.powerCap * 1.35), state.power + offer.amount);
    } else if (offer.type === 'free_item') {
      state.freeVouchers[offer.itemId] = (state.freeVouchers[offer.itemId] || 0) + 1;
    }

    offer.sold = true;
    ZS.Audio.playTrade();
    saveGame();
    notifyUi();
    return true;
  }

  // ================= NIGHT WAVE & COMBAT =================
  function buildWaveQueue(waveNum) {
    const q = [];
    const hpScale = 1 + (waveNum - 1) * 0.16;
    const countBase = 9 + waveNum * 4;

    for (let i = 0; i < countBase; i++) {
      const r = Math.random();
      if (waveNum >= 3 && r < Math.min(0.26, (waveNum - 2) * 0.055)) {
        q.push({ type: 'brute', hpScale });
      } else if (waveNum >= 2 && r < Math.min(0.55, 0.22 + waveNum * 0.04)) {
        q.push({ type: 'runner', hpScale });
      } else {
        q.push({ type: 'walker', hpScale });
      }
    }

    if (waveNum % 5 === 0) {
      q.push({ type: 'boss', hpScale: 1 + (waveNum / 5 - 1) * 0.45 });
    }

    return q;
  }

  function startNightWave() {
    if (state.phase !== 'day') return false;
    state.phase = 'night';
    state.isNight = true;
    state.blackoutTriggered = state.power <= 0.01;

    recomputeFlow();
    state.spawnQueue = buildWaveQueue(state.wave);
    state.waveTotalZombies = state.spawnQueue.length;
    state.waveKilledZombies = 0;
    state.spawnTimer = 0.6;

    ZS.Audio.playWaveStart();
    const isBossWave = state.wave % 5 === 0;
    banner(
      isBossWave ? `⚠️ WAVE ${state.wave} — 알파 변이체 경보!` : `🌙 WAVE ${state.wave} 야간 방어 개시`,
      `충전 전력 ⚡${Math.round(state.power)} · 적 개체 ${state.waveTotalZombies}기 접근 중`,
      isBossWave ? 'warn' : 'info'
    );
    notifyUi();
    return true;
  }

  function spawnZombie(entry) {
    const def = DATA.ZOMBIES[entry.type];
    const side = Math.floor(Math.random() * 4);
    const idx = 1 + Math.floor(Math.random() * (N - 2));
    let gx = 0.5;
    let gy = 0.5;
    if (side === 0) { gx = idx + 0.5; gy = 0.45; }
    else if (side === 1) { gx = N - 0.45; gy = idx + 0.5; }
    else if (side === 2) { gx = idx + 0.5; gy = N - 0.45; }
    else { gx = 0.45; gy = idx + 0.5; }

    const maxHp = Math.round(def.hp * entry.hpScale);
    state.zombies.push({
      type: entry.type,
      x: gx,
      y: gy,
      hp: maxHp,
      maxHp,
      speed: def.speed,
      damage: Math.round(def.damage * (1 + (state.wave - 1) * 0.06)),
      attackRate: def.attackRate,
      atkCooldown: 0,
      slowTimer: 0,
      seed: Math.random() * 10
    });
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
          spawnBurstParticles(x + 0.5, y + 0.5, 10, '#4ade80', 6);
          count++;
        }
      }
    }
    ZS.Audio.playBuild();
    addFloatingText(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 30, `🛠️ 나노 수리 드론 가동! (${count}개 시설 회복)`, '#4ade80', 13);
    notifyUi();
    return true;
  }

  function triggerAirstrikeAt(gx, gy) {
    if (state.skills.airstrikeCd > 0 || state.phase === 'gameover') return false;
    state.skills.airstrikeCd = state.skills.airstrikeMaxCd;

    state.flares.push({ x: gx, y: gy, radius: 4.5, life: 4.5 });
    spawnBurstParticles(gx, gy, 10, '#ffae42', 22);
    spawnBurstParticles(gx, gy, 14, '#ff5c5c', 16);
    ZS.Audio.playExplosion();

    const strikeDmg = 120 + state.wave * 18;
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const d = Math.hypot(z.x - gx, z.y - gy);
      if (d <= 2.65) {
        damageZombie(i, strikeDmg * (1 - d * 0.18), '#ff9f43');
      }
    }
    addFloatingText(gx, gy, 24, '🚀 전술 조명탄 & 폭격!', '#ffb142', 13);
    notifyUi();
    return true;
  }

  // ================= MAIN SIMULATION STEP =================
  function update(rawDt) {
    if (state.phase === 'gameover') return;

    // Smooth day/night ambient transition
    const targetNight = state.isNight ? 1 : 0;
    state.nightAlpha += (targetNight - state.nightAlpha) * Math.min(1, rawDt * 2.6);

    const dt = rawDt * (state.phase === 'night' ? state.gameSpeed : 1);

    // Cooldowns
    if (state.skills.repairCd > 0) state.skills.repairCd = Math.max(0, state.skills.repairCd - dt);
    if (state.skills.airstrikeCd > 0) state.skills.airstrikeCd = Math.max(0, state.skills.airstrikeCd - dt);

    // Update flares, particles, floating texts
    for (let i = state.flares.length - 1; i >= 0; i--) {
      state.flares[i].life -= dt;
      if (state.flares[i].life <= 0) state.flares.splice(i, 1);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    if (state.phase !== 'night') return;

    // 1. Night Power Idle Drain
    if (state.power > 0 && state.nightIdleDrain > 0) {
      state.power = Math.max(0, state.power - state.nightIdleDrain * dt);
      if (state.power <= 0 && !state.blackoutTriggered) {
        triggerBlackout();
      }
    }

    // 2. Field Repair Bay real-time aura regeneration
    updateRepairBays(dt);

    // 3. Spawn Zombies
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnZombie(state.spawnQueue.shift());
        const baseInterval = Math.max(0.26, 0.92 - state.wave * 0.045);
        state.spawnTimer = baseInterval * (0.7 + Math.random() * 0.55);
      }
    }

    // 4. Update Defenders & Auto-Turrets
    updateDefenders(dt);

    // 5. Update Projectiles
    updateProjectiles(dt);

    // 6. Update Zombies & Razor Traps
    updateZombies(dt);

    // 7. Check Wave Clear
    if (state.spawnQueue.length === 0 && state.zombies.length === 0 && state.phase === 'night') {
      completeWave();
    }
  }

  function triggerBlackout() {
    state.blackoutTriggered = true;
    state.power = 0;
    ZS.Audio.playBlackout();
    banner('⚡ 배터리 방전 — 블랙아웃!', '자동 포탑과 전기 투광등이 정지했습니다! 무전력 전투원이 방어를 지속합니다.', 'warn');
  }

  function updateRepairBays(dt) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id !== 'repair_bay') continue;
        const def = DATA.ITEMS.repair_bay;
        const rad = def.aura.radius;
        const regen = def.aura.regenPerSec * dt;

        for (let ny = Math.max(0, Math.floor(y - rad)); ny <= Math.min(N - 1, Math.ceil(y + rad)); ny++) {
          for (let nx = Math.max(0, Math.floor(x - rad)); nx <= Math.min(N - 1, Math.ceil(x + rad)); nx++) {
            const target = state.structGrid[ny][nx];
            if (target && target.hp < target.maxHp && Math.hypot(nx - x, ny - y) <= rad + 0.05) {
              target.hp = Math.min(target.maxHp, target.hp + regen);
            }
          }
        }
      }
    }
  }

  function updateDefenders(dt) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const def = DATA.ITEMS[st.id];
        if (!def || (def.subType !== 'manned' && def.subType !== 'turret')) continue;

        if (st.cooldown > 0) st.cooldown -= dt;

        // Power check for automated turrets
        if (def.requiresPower && state.power <= 0.01) continue;
        if (st.cooldown > 0) continue;
        if (state.zombies.length === 0) continue;

        const eff = getStructureEffectiveStats(st, x, y);
        const cx = x + 0.5;
        const cy = y + 0.5;

        // Acquire target
        let bestIdx = -1;
        let bestScore = -1e9;
        for (let i = 0; i < state.zombies.length; i++) {
          const z = state.zombies[i];
          const d = Math.hypot(z.x - cx, z.y - cy);
          if (d > eff.range) continue;

          // Prioritize highest HP for sniper, otherwise closest to HQ / turret
          const hqDist = Math.hypot(z.x - (DATA.HQ_POS.x + 0.5), z.y - (DATA.HQ_POS.y + 0.5));
          const score = def.targetMode === 'strongest' ? z.hp * 10 - hqDist : -hqDist * 2 - d;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) continue;

        // Check shot power cost for electric turrets
        if (def.requiresPower && def.powerShot) {
          if (state.power < def.powerShot * 0.35) {
            state.power = 0;
            if (!state.blackoutTriggered) triggerBlackout();
            continue;
          }
          state.power = Math.max(0, state.power - def.powerShot);
          if (state.power <= 0 && !state.blackoutTriggered) triggerBlackout();
        }

        const target = state.zombies[bestIdx];
        st.aimAngle = Math.atan2(target.y - cy, target.x - cx);
        st.cooldown = 1 / Math.max(0.2, eff.fireRate);

        fireWeapon(def, eff, cx, cy, bestIdx);
      }
    }
  }

  function fireWeapon(def, eff, cx, cy, targetIdx) {
    const target = state.zombies[targetIdx];
    if (!target) return;

    const isCrit = Math.random() < eff.critChance;
    const finalDmg = eff.damage * (isCrit ? 1.65 : 1.0);
    const angle = Math.atan2(target.y - cy, target.x - cx);

    ZS.Audio.playShoot(def.projType);

    if (def.projType === 'emp') {
      // Instant chain lightning across up to chainCount zombies
      const hitIndices = [targetIdx];
      let curX = target.x;
      let curY = target.y;
      const points = [{ x: cx, y: cy }, { x: curX, y: curY }];

      for (let c = 1; c < (def.chainCount || 3); c++) {
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
        life: 0.14
      });

      // Apply damage from highest index down to safely handle splice on death
      const sorted = hitIndices.slice().sort((a, b) => b - a);
      for (let k = 0; k < sorted.length; k++) {
        const idx = sorted[k];
        if (state.zombies[idx]) {
          state.zombies[idx].slowTimer = Math.max(state.zombies[idx].slowTimer, def.slowDuration || 1.5);
          damageZombie(idx, finalDmg, '#67f3ff', isCrit);
        }
      }
      return;
    }

    if (def.projType === 'shotgun') {
      const pellets = def.pellets || 4;
      for (let p = 0; p < pellets; p++) {
        const a = angle + (Math.random() - 0.5) * (def.spread || 0.32);
        const spd = 15;
        state.projectiles.push({
          kind: 'bullet',
          x: cx,
          y: cy,
          z: 13,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          damage: finalDmg,
          isCrit,
          splash: 0,
          color: '#ffd166',
          width: 2.0,
          life: 0.32
        });
      }
      return;
    }

    const spd = def.projType === 'sniper' ? 24 : def.projType === 'missile' ? 11 : 18;
    const color =
      def.projType === 'sniper'
        ? '#7ef5ff'
        : def.projType === 'missile'
        ? '#ff7b54'
        : def.projType === 'vulcan'
        ? '#ffea75'
        : '#ffe082';

    state.projectiles.push({
      kind: 'bullet',
      x: cx,
      y: cy,
      z: def.id === 'sniper_tower' ? 24 : 14,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      damage: finalDmg,
      isCrit,
      splash: def.splashRadius || 0,
      color,
      width: def.projType === 'sniper' ? 2.8 : def.projType === 'missile' ? 3.5 : 2.1,
      life: 0.65
    });
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.projectiles.splice(i, 1);
        continue;
      }
      if (p.kind === 'chain') continue;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Hit detection against zombies
      let hitIdx = -1;
      for (let zIdx = 0; zIdx < state.zombies.length; zIdx++) {
        const z = state.zombies[zIdx];
        if (Math.hypot(z.x - p.x, z.y - p.y) <= 0.42) {
          hitIdx = zIdx;
          break;
        }
      }

      if (hitIdx !== -1) {
        if (p.splash > 0) {
          ZS.Audio.playExplosion();
          spawnBurstParticles(p.x, p.y, 12, '#ff8a47', 10);
          state.flares.push({ x: p.x, y: p.y, radius: 2.3, life: 0.22 });
          for (let k = state.zombies.length - 1; k >= 0; k--) {
            const zk = state.zombies[k];
            const dist = Math.hypot(zk.x - p.x, zk.y - p.y);
            if (dist <= p.splash) {
              damageZombie(k, p.damage * (1 - dist / (p.splash * 1.5)), '#ff9f43', p.isCrit);
            }
          }
        } else {
          damageZombie(hitIdx, p.damage, p.isCrit ? '#7ef5ff' : '#ffffff', p.isCrit);
        }
        state.projectiles.splice(i, 1);
      }
    }
  }

  function damageZombie(index, amount, textColor, isCrit) {
    const z = state.zombies[index];
    if (!z) return;
    const dmg = Math.max(1, Math.round(amount));
    z.hp -= dmg;
    spawnBurstParticles(z.x, z.y, 10, '#8ee89e', 3);

    if (dmg >= 15 || isCrit) {
      addFloatingText(
        z.x + (Math.random() - 0.5) * 0.25,
        z.y,
        18,
        isCrit ? `${dmg}!` : `${dmg}`,
        isCrit ? '#67f3ff' : textColor || '#fff',
        isCrit ? 13 : 11
      );
    }

    if (z.hp <= 0) {
      const def = DATA.ZOMBIES[z.type];
      const scrapGain = randInt(def.scrapDrop[0], def.scrapDrop[1]);
      const coinGain = randInt(def.coinDrop[0], def.coinDrop[1]);
      state.scrap += scrapGain;
      state.coin += coinGain;
      state.waveKilledZombies += 1;

      spawnBurstParticles(z.x, z.y, 10, '#5ad67d', 9);
      if (def.isBoss) {
        state.bossDefeated = true;
        addFloatingText(z.x, z.y, 26, `🏆 알파 보스 격파! +${scrapGain}🔩 +${coinGain}🪙 (기념비 해금!)`, '#ffe066', 14);
      } else if (Math.random() < 0.35 || z.type === 'brute') {
        addFloatingText(z.x, z.y, 16, `+${scrapGain}🔩`, '#cbd5e1', 10);
      }

      state.zombies.splice(index, 1);
      notifyUi();
    }
  }

  function updateZombies(dt) {
    let structureDestroyed = false;

    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      if (!z) continue;

      if (z.slowTimer > 0) z.slowTimer = Math.max(0, z.slowTimer - dt);
      if (z.atkCooldown > 0) z.atkCooldown = Math.max(0, z.atkCooldown - dt);

      const tx = Math.max(0, Math.min(N - 1, Math.floor(z.x)));
      const ty = Math.max(0, Math.min(N - 1, Math.floor(z.y)));

      // Check passable razor pad trap under zombie
      const under = state.structGrid[ty][tx];
      let slowMult = z.slowTimer > 0 ? 0.52 : 1.0;
      if (under && under.id === 'razor_pad') {
        const rDef = DATA.ITEMS.razor_pad;
        slowMult = Math.min(slowMult, rDef.slowFactor);
        z.hp -= rDef.trapDps * dt;
        under.hp -= 3.2 * dt;
        if (under.hp <= 0) {
          state.structGrid[ty][tx] = null;
          structureDestroyed = true;
        }
        if (z.hp <= 0) {
          damageZombie(i, 1, '#cbd5e1', false);
          continue;
        }
      }

      // Check distance to HQ first
      const hqCx = DATA.HQ_POS.x + 0.5;
      const hqCy = DATA.HQ_POS.y + 0.5;
      const distHq = Math.hypot(hqCx - z.x, hqCy - z.y);
      const hqStruct = state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];

      if (distHq <= 0.92 && hqStruct) {
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          hqStruct.hp -= z.damage;
          spawnBurstParticles(hqCx, hqCy, 14, '#ff6b6b', 5);
          addFloatingText(hqCx, hqCy, 28, `-${z.damage}`, '#ff6b6b', 12);
          notifyUi();
          if (hqStruct.hp <= 0) {
            hqStruct.hp = 0;
            triggerGameOver();
            return;
          }
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
      if (blockingTarget && distGoal <= 0.86) {
        // Melee attack blocking structure
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          blockingTarget.hp -= z.damage;
          spawnBurstParticles(btx + 0.5, bty + 0.5, 10, '#facc15', 4);
          if (blockingTarget.hp <= 0) {
            state.structGrid[bty][btx] = null;
            spawnBurstParticles(btx + 0.5, bty + 0.5, 10, '#ff7675', 10);
            structureDestroyed = true;
          }
        }
      } else if (distGoal > 0.01) {
        const moveSpd = z.speed * slowMult * dt;
        z.x += ((goalX - z.x) / distGoal) * moveSpd;
        z.y += ((goalY - z.y) / distGoal) * moveSpd;
      }
    }

    if (structureDestroyed) {
      recalculateBaseStats();
      recomputeFlow();
      notifyUi();
    }
  }

  function completeWave() {
    const clearedWave = state.wave;
    state.phase = 'day';
    state.isNight = false;
    state.projectiles = [];

    recalculateBaseStats();

    // 1. Wave clearance rewards + Cozy dividend bonus
    const woodReward = 30 + clearedWave * 8;
    const scrapReward = 24 + clearedWave * 7;
    const baseCoin = 24 + clearedWave * 6;
    const bonusCoin = Math.round(baseCoin * state.cozyTier.coinBonus);
    const totalCoin = baseCoin + bonusCoin;

    state.wood += woodReward;
    state.scrap += scrapReward;
    state.coin += totalCoin;

    // 2. Free Cozy Auto-Repair at Dawn
    const freeRatio = state.cozyTier.freeRepair;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st && st.hp < st.maxHp) {
          st.hp = Math.min(st.maxHp, Math.round(st.hp + (st.maxHp - st.hp) * freeRatio));
        }
      }
    }

    // 3. Daytime Solar & Wind Battery Recharge
    const beforePower = state.power;
    const maxTarget = Math.max(state.power, state.powerCap);
    state.power = Math.min(maxTarget, state.power + state.dayCharge);
    const gainedPower = Math.round(state.power - beforePower);

    // 4. Morning Survivor Arrival if Empty Bunk Available
    let arrivedAgent = 0;
    if (state.agents < state.popCap) {
      state.agents += 1;
      arrivedAgent = 1;
    }

    state.wave += 1;
    refreshTraderOffers(false);
    ZS.Audio.playWaveClear();

    const agentMsg = arrivedAgent > 0 ? ` · 신규 요원 +1👥 합류!` : '';
    banner(
      `☀️ WAVE ${clearedWave} 방어 성공! 아침이 밝았습니다`,
      `보상 +${woodReward}🪵 +${scrapReward}🔩 +${totalCoin}🪙 · 주간 충전 +${gainedPower}⚡${agentMsg}`,
      'good'
    );

    saveGame();
    notifyUi();
  }

  function triggerGameOver() {
    state.phase = 'gameover';
    ZS.Audio.playBlackout();
    banner('🚨 지휘 본부 함락 — 작전 실패', `WAVE ${state.wave}에서 방어선이 붕괴했습니다. 상단 [새 작전] 버튼으로 재도전하세요!`, 'danger');
    notifyUi();
  }

  // ================= VFX HELPERS =================
  function spawnBurstParticles(gx, gy, zPx, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 2.2;
      state.particles.push({
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
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z = Math.max(1, pt.z + pt.vz * dt);
      pt.vz -= 65 * dt;
    }
  }

  function addFloatingText(gx, gy, zPx, text, color, size) {
    state.floatingTexts.push({
      x: gx,
      y: gy,
      z: zPx,
      text,
      color,
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

  // ================= PERSISTENCE (localStorage) =================
  function saveGame() {
    if (state.phase !== 'day') return;
    try {
      const payload = {
        wave: state.wave,
        bossDefeated: state.bossDefeated,
        wood: state.wood,
        scrap: state.scrap,
        coin: state.coin,
        power: state.power,
        agents: state.agents,
        freeVouchers: state.freeVouchers,
        traderOffers: state.traderOffers,
        floorGrid: state.floorGrid,
        structGrid: state.structGrid
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Ignore storage quota / privacy mode errors
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.structGrid) || d.structGrid.length !== N) return false;

      state.wave = d.wave || 1;
      state.phase = 'day';
      state.isNight = false;
      state.nightAlpha = 0;
      state.bossDefeated = !!d.bossDefeated;
      state.wood = d.wood ?? DATA.INITIAL_RESOURCES.wood;
      state.scrap = d.scrap ?? DATA.INITIAL_RESOURCES.scrap;
      state.coin = d.coin ?? DATA.INITIAL_RESOURCES.coin;
      state.agents = d.agents ?? DATA.HQ_STATS.startingAgents;
      state.freeVouchers = d.freeVouchers || {};
      state.floorGrid = d.floorGrid;
      state.structGrid = d.structGrid;

      recalculateBaseStats();
      state.power = d.power ?? state.powerCap;
      recomputeFlow();
      if (Array.isArray(d.traderOffers) && d.traderOffers.length > 0) {
        state.traderOffers = d.traderOffers;
      } else {
        refreshTraderOffers(false);
      }
      notifyUi();
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSaveAndReset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    initNewGame();
    banner('새 전초기지 작전 개시', '방어선과 발전 설비를 구축하고 모던 쉘터를 꾸며보세요!', 'info');
  }

  return {
    state,
    setCallbacks,
    initNewGame,
    loadGame,
    clearSaveAndReset,
    recalculateBaseStats,
    getStructureEffectiveStats,
    canPlaceItem,
    placeItem,
    moveStructure,
    removeAt,
    getRepairAllInfo,
    repairAllStructures,
    refreshTraderOffers,
    buyTraderOffer,
    startNightWave,
    triggerNanoRepair,
    triggerAirstrikeAt,
    update
  };
})();
