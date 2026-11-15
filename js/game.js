window.ZS = window.ZS || {};

ZS.Game = (function () {
  const PROD_SAVE_KEY = 'outpost_zero_save_v1';
  const DEV_SAVE_KEY = 'outpost_zero_save_dev';
  const SETTINGS_KEY = 'outpost_zero_settings_v1';
  const DATA = ZS.DATA;
  const N = DATA.GRID_SIZE;
  let nextZombieUid = 1;
  let nextStructUid = 1;
  let pendingVeteranDemolish = null;
  let screenShakeEnabled = true;

  try {
    const rawSettings = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (rawSettings) {
      const parsedSettings = JSON.parse(rawSettings);
      if (parsedSettings && typeof parsedSettings.screenShake === 'boolean') {
        screenShakeEnabled = parsedSettings.screenShake;
      }
    }
  } catch (e) {}

  function isScreenShakeEnabled() {
    return screenShakeEnabled;
  }

  function setScreenShakeEnabled(flag) {
    screenShakeEnabled = !!flag;
    if (!screenShakeEnabled) {
      state.shakeTimer = 0;
      state.shakeAmp = 0;
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ screenShake: screenShakeEnabled }));
    } catch (e) {}
    notifyUi();
    return screenShakeEnabled;
  }

  function toggleScreenShake() {
    return setScreenShakeEnabled(!screenShakeEnabled);
  }

  function getEnvInfo() {
    const loc = typeof window !== 'undefined' && window.location ? window.location : {};
    const proto = loc.protocol || '';
    const host = loc.hostname || '';
    const search = loc.search || '';
    const isLocalHost = proto === 'file:' || host === 'localhost' || host === '127.0.0.1';
    const isDevBuild = typeof window !== 'undefined' && window.ZS_DEV_BUILD === true;
    const isDevEnvironment = isLocalHost || isDevBuild;

    let hasDebugParam = false;
    let hasDevParam = false;
    if (isDevEnvironment && search) {
      try {
        const params = new URLSearchParams(search);
        hasDebugParam = params.get('debug') === '1';
        hasDevParam = params.get('dev') === '1';
      } catch (e) {
        hasDebugParam = /[?&]debug=1(?:&|$)/.test(search);
        hasDevParam = /[?&]dev=1(?:&|$)/.test(search);
      }
    }

    const useDevSave = isDevBuild || (isDevEnvironment && (hasDevParam || hasDebugParam));
    const saveKey = useDevSave ? DEV_SAVE_KEY : PROD_SAVE_KEY;
    const commitSha = isDevBuild && typeof window.ZS_COMMIT_SHA === 'string' ? window.ZS_COMMIT_SHA : null;

    return {
      isLocalHost,
      isDevBuild,
      isDevEnvironment,
      isDebugMode: isDevEnvironment && hasDebugParam,
      useDevSave,
      saveKey,
      commitSha
    };
  }

  function getSaveKey() {
    return getEnvInfo().saveKey;
  }

  const state = {
    wave: 1,
    hqLevel: 1,
    phase: 'day', // 'day' | 'night' | 'gameover'
    isNight: false,
    nightAlpha: 0,
    blackoutTriggered: false,
    blackoutFlickerTimer: 0,
    shakeTimer: 0,
    shakeDuration: 0.25,
    shakeAmp: 0,
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
    debugBonusPopCap: 0,

    cozyScore: 0,
    cozyFloorRaw: 0,
    cozyFloorScore: 0,
    cozyStructScore: 0,
    cozySynergyScore: 0,
    cozyDiversityBonus: 0,
    cozyGroupCounts: {},
    cozyTier: DATA.COZY_TIERS[0],
    cozyTierUpTimer: 0,
    cozyPulseSeq: 0,

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
    dyingZombies: [],
    groundDecals: [],
    muzzleFlashes: [],
    projectiles: [],
    burstQueue: [],
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

  function getHqLevelInfo(lv) {
    const targetLv = lv || state.hqLevel || 1;
    const list = DATA.HQ_LEVELS || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].level === targetLv) return list[i];
    }
    return (
      list[0] || {
        level: 1,
        name: DATA.HQ_STATS.name,
        cost: null,
        maxHp: DATA.HQ_STATS.maxHp,
        basePowerCap: DATA.HQ_STATS.basePowerCap,
        baseDayCharge: DATA.HQ_STATS.baseDayCharge,
        basePopCap: DATA.HQ_STATS.basePopCap,
        structUpgradeCap: 1,
        maxZ: 36,
        hpBarWidth: 38,
        weapon: null
      }
    );
  }

  function createEmptyGrids() {
    state.floorGrid = Array.from({ length: N }, () => Array(N).fill(null));
    state.structGrid = Array.from({ length: N }, () => Array(N).fill(null));
  }

  function initNewGame() {
    createEmptyGrids();
    pendingVeteranDemolish = null;

    state.wave = 1;
    state.hqLevel = 1;
    state.phase = 'day';
    state.isNight = false;
    state.nightAlpha = 0;
    state.blackoutTriggered = false;
    state.blackoutFlickerTimer = 0;
    state.shakeTimer = 0;
    state.shakeAmp = 0;
    state.bossDefeated = false;
    state.gameSpeed = 1;

    state.wood = DATA.INITIAL_RESOURCES.wood;
    state.scrap = DATA.INITIAL_RESOURCES.scrap;
    state.coin = DATA.INITIAL_RESOURCES.coin;

    const hqInfo = getHqLevelInfo(1);
    state.agents = DATA.HQ_STATS.startingAgents;
    state.debugBonusPopCap = 0;
    state.freeVouchers = {};
    state.skills.repairCd = 0;
    state.skills.airstrikeCd = 0;

    state.zombies = [];
    state.dyingZombies = [];
    state.groundDecals = [];
    state.muzzleFlashes = [];
    state.projectiles = [];
    state.burstQueue = [];
    state.particles = [];
    state.floatingTexts = [];
    state.flares = [];
    state.spawnQueue = [];

    // Starter modern tactical plaza around HQ (10,10)
    const hx = DATA.HQ_POS.x;
    const hy = DATA.HQ_POS.y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        state.floorGrid[hy + dy][hx + dx] = dx === 0 && dy === 0 ? 'steel_deck' : 'asphalt';
      }
    }

    state.structGrid[hy][hx] = {
      id: 'command_hq',
      level: 1,
      hp: hqInfo.maxHp,
      maxHp: hqInfo.maxHp,
      cooldown: 0,
      aimAngle: 0,
      upgradeAnimTimer: 0
    };

    recalculateBaseStats(true);
    state.cozyTierUpTimer = 0;
    state.power = state.powerCap;
    recomputeFlow();
    refreshTraderOffers(false);
    saveGame();
    notifyUi();
  }

  function recomputeFlow() {
    state.flow = ZS.Pathfinding.computeFlowField(N, DATA.HQ_POS, state.structGrid);
  }

  function isCombatVeterancyDef(def) {
    if (!def || def.layer !== 'struct') return false;
    return def.subType === 'manned' || def.subType === 'turret';
  }

  function getVeterancyRankInfo(rank) {
    const list = DATA.VETERANCY_RANKS || [];
    const r = Math.max(0, Math.min(3, rank || 0));
    for (let i = 0; i < list.length; i++) {
      if (list[i].rank === r) return list[i];
    }
    return list[0] || { rank: 0, minXp: 0, name: '신병', dmgBonus: 0, rateBonus: 0, critAdd: 0, rangeAdd: 0, color: '#94A3B8', stroke: '#1B2430' };
  }

  function computeRankFromXp(xp) {
    const list = DATA.VETERANCY_RANKS || [];
    let best = 0;
    for (let i = 0; i < list.length; i++) {
      if ((xp || 0) >= list[i].minXp) best = list[i].rank;
    }
    return best;
  }

  function findStructureByUid(uid) {
    if (!uid) return null;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const s = state.structGrid[y] && state.structGrid[y][x];
        if (s && s.uid === uid && s.hp > 0) {
          return { st: s, tx: x, ty: y };
        }
      }
    }
    return null;
  }

  function awardStructureXp(st, tx, ty, rawXp) {
    if (!st || st.id === 'command_hq' || st.hp <= 0 || rawXp <= 0) return;
    const def = DATA.ITEMS[st.id];
    if (!isCombatVeterancyDef(def)) return;

    const cozyXpMult = 1.0 + ((state.cozyTier && state.cozyTier.xpBonus) || 0);
    const gained = rawXp * cozyXpMult;
    const prevRank = st.rank || computeRankFromXp(st.xp || 0);
    st.xp = +((st.xp || 0) + gained).toFixed(3);
    st.kills = (st.kills || 0) + 1;
    const newRank = computeRankFromXp(st.xp);
    st.rank = newRank;

    if (newRank > prevRank) {
      const rInfo = getVeterancyRankInfo(newRank);
      st.promoAnimTimer = 0.8;
      if (ZS.Audio.playPromote) ZS.Audio.playPromote();
      else if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();

      state.projectiles.push({
        kind: 'promo_ring',
        x: tx + 0.5,
        y: ty + 0.5,
        z: 18,
        color: rInfo.color,
        life: 0.8,
        maxLife: 0.8
      });
      addFloatingText(tx + 0.5, ty + 0.5, 30, '★ UP', rInfo.color, 14, rInfo.stroke);
      banner(`[${def.name}] ${rInfo.name} 진급!`, `전투 숙련도 Rank ${newRank} 달성 — 공격력 +${Math.round(rInfo.dmgBonus * 100)}% · 연사 +${Math.round(rInfo.rateBonus * 100)}%`, 'good');
    }
  }

  function awardKillXpBySourceUid(sourceUid, zombieType, isBoss) {
    const xpTable = DATA.ZOMBIE_KILL_XP || { walker: 1.0, runner: 1.5, brute: 4.0, boss: 12.0, bossGlobalBonus: 4.0 };
    if (sourceUid) {
      const found = findStructureByUid(sourceUid);
      if (found) {
        const raw = xpTable[zombieType] || 1.0;
        awardStructureXp(found.st, found.tx, found.ty, raw);
      }
    }
    // On Boss kill, all surviving manned/turret structures receive +4.0 bonus XP
    if (isBoss) {
      const bonus = xpTable.bossGlobalBonus || 4.0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s || s.id === 'command_hq' || s.hp <= 0) continue;
          const d = DATA.ITEMS[s.id];
          if (isCombatVeterancyDef(d)) {
            const cozyXpMult = 1.0 + ((state.cozyTier && state.cozyTier.xpBonus) || 0);
            const prevRank = s.rank || computeRankFromXp(s.xp || 0);
            s.xp = +((s.xp || 0) + bonus * cozyXpMult).toFixed(3);
            const newRank = computeRankFromXp(s.xp);
            s.rank = newRank;
            if (newRank > prevRank) {
              const rInfo = getVeterancyRankInfo(newRank);
              s.promoAnimTimer = 0.8;
              state.projectiles.push({
                kind: 'promo_ring',
                x: x + 0.5,
                y: y + 0.5,
                z: 18,
                color: rInfo.color,
                life: 0.8,
                maxLife: 0.8
              });
              addFloatingText(x + 0.5, y + 0.5, 30, '★ UP', rInfo.color, 14, rInfo.stroke);
            }
          }
        }
      }
    }
  }

  function spawnBadgeShatterVfx(gx, gy, rank) {
    if (!rank || rank < 1) return;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI * 0.5 + (i - 1) * 0.85;
      const spd = 0.9 + Math.random() * 0.7;
      state.particles.push({
        x: gx,
        y: gy,
        z: 24,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 14 + Math.random() * 10,
        color: '#8C96A3',
        size: 2.8,
        life: 0.40,
        maxLife: 0.40
      });
    }
  }

  function isUpgradeableDef(def) {
    if (!def || def.layer !== 'struct') return false;
    return def.category === 'defense' || def.category === 'infra';
  }

  function getUpgradeCost(def, fromLevel) {
    if (!isUpgradeableDef(def)) return null;
    const base = def.cost || {};
    if (fromLevel === 1) {
      return {
        wood: Math.max(12, Math.round((base.wood || 8) * 1.15)),
        scrap: Math.max(8, Math.round((base.scrap || 6) * 0.85)),
        coin: (base.coin || 0) + 10
      };
    }
    if (fromLevel === 2) {
      return {
        wood: Math.max(24, Math.round((base.wood || 10) * 1.80)),
        scrap: Math.max(16, Math.round((base.scrap || 10) * 1.45)),
        coin: Math.round((base.coin || 0) * 1.5) + 25
      };
    }
    return null;
  }

  function getStructLevelProfile(def, level) {
    const lv = Math.max(1, Math.min(3, level || 1));
    let hpScale = 1.0;
    let dmgScale = 1.0;
    let rateScale = 1.0;
    let rangeAdd = 0;
    let critAdd = 0;
    let powerIdle = def.powerIdle || 0;
    let powerShot = def.powerShot || 0;
    let powerCap = def.powerCap || 0;
    let dayCharge = def.dayCharge || 0;
    let popCap = def.popCap || 0;
    let cozy = def.cozy || 0;
    let trapDps = def.trapDps || 0;
    let trapWear = 3.2;
    let slowFactor = def.slowFactor || 1.0;
    let vulnMult = 1.0;
    let thornsRatio = 0;
    let pellets = def.pellets || 1;
    let knockback = 0;
    let pierceCount = 1;
    let burstSecondMult = 0;
    let splashRadius = def.splashRadius || 0;
    let chainCount = def.chainCount || 3;
    let slowDuration = def.slowDuration || 1.5;

    if (def.subType === 'wall') {
      if (lv === 2) hpScale = 1.45;
      else if (lv === 3) {
        hpScale = 2.00;
        thornsRatio = 0.35;
      }
    } else if (def.id === 'razor_pad') {
      if (lv === 2) {
        hpScale = 1.40;
        trapDps = 17;
        trapWear = 2.4;
      } else if (lv === 3) {
        hpScale = 1.90;
        trapDps = 26;
        trapWear = 2.4;
        slowFactor = 0.40;
        vulnMult = 1.15;
      }
    } else if (def.subType === 'manned') {
      if (lv === 2) {
        dmgScale = 1.28;
        rateScale = 1.10;
        hpScale = 1.25;
      } else if (lv === 3) {
        dmgScale = 1.62;
        rateScale = 1.20;
        hpScale = 1.55;
        if (def.id === 'rifle_bunker') {
          burstSecondMult = 0.50;
        } else if (def.id === 'shotgun_post') {
          pellets = 6;
          knockback = 0.20;
        } else if (def.id === 'sniper_tower') {
          rangeAdd = 1.0;
          pierceCount = 2;
        }
      }
    } else if (def.subType === 'turret') {
      if (lv === 2) {
        dmgScale = 1.30;
        rateScale = 1.12;
        hpScale = 1.25;
        powerIdle = +(powerIdle * 1.15).toFixed(2);
      } else if (lv === 3) {
        dmgScale = 1.68;
        rateScale = 1.25;
        hpScale = 1.55;
        powerIdle = +(powerIdle * 1.30).toFixed(2);
        if (def.id === 'vulcan_turret') {
          powerShot = 0.24;
          critAdd = 0.12;
        } else if (def.id === 'missile_pod') {
          splashRadius = 1.75;
        } else if (def.id === 'emp_coil') {
          chainCount = 5;
          slowDuration = 2.4;
        }
      }
    } else if (def.id === 'solar_array' || def.id === 'wind_turbine') {
      if (lv === 2) {
        hpScale = 1.25;
        dayCharge = Math.round(dayCharge * 1.4);
        powerCap = Math.round(powerCap * 1.4);
      } else if (lv === 3) {
        hpScale = 1.55;
        dayCharge = Math.round(dayCharge * 1.9);
        powerCap = Math.round(powerCap * 1.9);
      }
    } else if (def.id === 'battery_bank') {
      if (lv === 2) {
        hpScale = 1.25;
        powerCap = 145;
        dayCharge = 18;
      } else if (lv === 3) {
        hpScale = 1.55;
        powerCap = 205;
        dayCharge = 28;
      }
    } else if (def.id === 'field_tent') {
      if (lv === 2) {
        hpScale = 1.25;
        popCap = 2;
        cozy = 8;
      } else if (lv === 3) {
        hpScale = 1.55;
        popCap = 3;
        cozy = 12;
      }
    } else if (def.id === 'shelter_pod') {
      if (lv === 2) {
        hpScale = 1.25;
        popCap = 3;
        cozy = 18;
      } else if (lv === 3) {
        hpScale = 1.55;
        popCap = 4;
        cozy = 26;
      }
    }

    return {
      level: lv,
      baseMaxHp: Math.round((def.maxHp || 100) * hpScale),
      dmgScale,
      rateScale,
      rangeAdd,
      critAdd,
      powerIdle,
      powerShot,
      powerCap,
      dayCharge,
      popCap,
      cozy,
      trapDps,
      trapWear,
      slowFactor,
      vulnMult,
      thornsRatio,
      pellets,
      knockback,
      pierceCount,
      burstSecondMult,
      splashRadius,
      chainCount,
      slowDuration,
      perkLabel: lv >= 3 && DATA.LV3_PERK_LABELS ? DATA.LV3_PERK_LABELS[def.id] || null : null
    };
  }

  function recalculateBaseStats(silentTierUp) {
    const hqInfo = getHqLevelInfo(state.hqLevel);
    const prevTierLevel = state.cozyTier ? state.cozyTier.level : 1;
    let powerCap = hqInfo.basePowerCap;
    let dayCharge = hqInfo.baseDayCharge;
    let nightIdleDrain = 0;
    let popCap = hqInfo.basePopCap + (state.debugBonusPopCap || 0);
    let popUsed = 0;
    let floorRaw = 0;
    let synergyScore = 0;
    const structGroups = {};
    const groupCounts = {};
    const uniqueGroups = new Set();

    const hqStruct = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
    if (hqStruct && hqStruct.id === 'command_hq') {
      hqStruct.level = state.hqLevel || 1;
      if (hqStruct.maxHp !== hqInfo.maxHp) {
        const ratio = hqStruct.maxHp > 0 ? hqStruct.hp / hqStruct.maxHp : 1;
        hqStruct.maxHp = hqInfo.maxHp;
        hqStruct.hp = Math.min(hqInfo.maxHp, Math.max(1, Math.round(hqInfo.maxHp * ratio)));
      }
    }

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const fid = state.floorGrid[y][x];
        const fDef = fid ? DATA.ITEMS[fid] : null;
        if (fDef && fDef.cozy) {
          floorRaw += fDef.cozy;
          if (fDef.cozyGroup) uniqueGroups.add(fDef.cozyGroup);
        }

        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        const def = DATA.ITEMS[st.id];
        if (!def) continue;

        // Update maxHp & infra stats with upgrade level + floor bonus
        const prof = getStructLevelProfile(def, st.level || 1);
        const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
        const targetMax = Math.round(prof.baseMaxHp * hpMult);
        if (st.maxHp !== targetMax) {
          const ratio = st.maxHp > 0 ? st.hp / st.maxHp : 1;
          st.maxHp = targetMax;
          st.hp = Math.min(targetMax, Math.max(1, Math.round(targetMax * ratio)));
        }

        if (prof.powerCap) powerCap += prof.powerCap;
        if (prof.dayCharge) dayCharge += prof.dayCharge;
        if (def.requiresPower && prof.powerIdle) nightIdleDrain += prof.powerIdle;
        if (prof.popCap) popCap += prof.popCap;
        if (def.popUse) popUsed += def.popUse;

        if (prof.cozy) {
          const grp = def.cozyGroup || def.id;
          if (!structGroups[grp]) structGroups[grp] = [];
          structGroups[grp].push(prof.cozy);
          groupCounts[grp] = (groupCounts[grp] || 0) + 1;

          // Lounge tile +3 decor synergy is separate from the 60-point floor cap
          if (fDef && fDef.cozyTileBonus && def.category === 'decor') {
            synergyScore += fDef.cozyTileBonus;
          }
          if (def.cozyGroup) uniqueGroups.add(def.cozyGroup);
        }
      }
    }

    const floorCap = DATA.COZY_FLOOR_CAP || 60;
    const floorScore = Math.min(floorCap, floorRaw);

    // Same cozyGroup structures: first 3 at 100%, 4th+ at Math.round(score * 0.5) (sorted descending so upgraded Lv.2/3 get full credit first)
    let structScore = 0;
    const grpKeys = Object.keys(structGroups);
    for (let i = 0; i < grpKeys.length; i++) {
      const scores = structGroups[grpKeys[i]].sort((a, b) => b - a);
      for (let k = 0; k < scores.length; k++) {
        structScore += k < 3 ? scores[k] : Math.round(scores[k] * 0.5);
      }
    }

    const diversityBonus = uniqueGroups.size * 5;
    const totalCozy = floorScore + structScore + synergyScore + diversityBonus;

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
    state.cozyFloorRaw = floorRaw;
    state.cozyFloorScore = floorScore;
    state.cozyStructScore = structScore;
    state.cozySynergyScore = synergyScore;
    state.cozyGroupCounts = groupCounts;
    state.cozyScore = totalCozy;
    state.cozyDiversityBonus = diversityBonus;
    state.cozyTier = tier;

    if (!silentTierUp && tier.level > prevTierLevel) {
      state.cozyTierUpTimer = 0.8;
      state.cozyPulseSeq = (state.cozyPulseSeq || 0) + 1;
      state.flares.push({
        x: DATA.HQ_POS.x + 0.5,
        y: DATA.HQ_POS.y + 0.5,
        radius: 3.0,
        life: 0.8
      });
      banner(`안락함 Lv.${tier.level} — ${tier.title}`, `요원 화력 +${Math.round(tier.agentDmg * 100)}% · 숙련도 +${Math.round((tier.xpBonus || 0) * 100)}% · 무료수리 ${Math.round(tier.freeRepair * 100)}%`, 'good');
    }
  }

  function getPlacementCozyPreview(itemId, tx, ty) {
    const def = DATA.ITEMS[itemId];
    if (!def || !def.cozy) return null;
    if (def.layer === 'floor') {
      const cap = DATA.COZY_FLOOR_CAP || 60;
      const curRaw = state.cozyFloorRaw || 0;
      let prevFloorCozy = 0;
      if (tx !== undefined && ty !== undefined && tx >= 0 && ty >= 0 && tx < N && ty < N) {
        const oldFid = state.floorGrid[ty] && state.floorGrid[ty][tx];
        const oldDef = oldFid ? DATA.ITEMS[oldFid] : null;
        if (oldDef && oldDef.cozy) prevFloorCozy = oldDef.cozy;
      }
      const nextRaw = curRaw - prevFloorCozy + def.cozy;
      const effectiveGain = Math.max(0, Math.min(cap, nextRaw) - Math.min(cap, curRaw));
      return {
        base: def.cozy,
        gain: effectiveGain,
        isDiminished: false,
        isFloorCapped: curRaw >= cap || effectiveGain === 0
      };
    }

    const grp = def.cozyGroup || def.id;
    const existingCount = (state.cozyGroupCounts && state.cozyGroupCounts[grp]) || 0;
    const isDiminished = existingCount >= 3;
    let gain = isDiminished ? Math.round(def.cozy * 0.5) : def.cozy;
    if (tx !== undefined && ty !== undefined && tx >= 0 && ty >= 0 && tx < N && ty < N) {
      const fid = state.floorGrid[ty] && state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      if (fDef && fDef.cozyTileBonus && def.category === 'decor') {
        gain += fDef.cozyTileBonus;
      }
    }
    return {
      base: def.cozy,
      gain,
      isDiminished,
      isFloorCapped: false
    };
  }

  function getStructureEffectiveStats(st, tx, ty, overrideLevel) {
    const def = DATA.ITEMS[st.id];
    if (!def) return { damage: 0, fireRate: 0, range: 0, critChance: 0 };

    const lv = overrideLevel !== undefined ? overrideLevel : (st.level || 1);
    const prof = getStructLevelProfile(def, lv);
    const rank = isCombatVeterancyDef(def) ? (st.rank || computeRankFromXp(st.xp || 0)) : 0;
    const rankInfo = getVeterancyRankInfo(rank);

    let dmgMult = 1.0 + rankInfo.dmgBonus;
    let rateMult = 1.0 + state.cozyTier.fireRate + rankInfo.rateBonus;
    let rangeMult = 1.0;
    let critChance = 0.04 + prof.critAdd + rankInfo.critAdd;

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

    const baseDmg = (def.damage || 0) * prof.dmgScale;
    const baseRate = (def.fireRate || 0) * prof.rateScale;
    const baseRange = (def.range || 0) + prof.rangeAdd + rankInfo.rangeAdd;

    return {
      level: lv,
      rank,
      rankInfo,
      damage: baseDmg * dmgMult,
      fireRate: baseRate * rateMult,
      range: baseRange * rangeMult,
      critChance: Math.min(0.85, critChance),
      powerIdle: prof.powerIdle,
      powerShot: prof.powerShot,
      pellets: prof.pellets,
      knockback: prof.knockback,
      pierceCount: prof.pierceCount,
      burstSecondMult: prof.burstSecondMult,
      splashRadius: prof.splashRadius,
      chainCount: prof.chainCount,
      slowDuration: prof.slowDuration,
      perkLabel: prof.perkLabel,
      prof
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

  function canUpgradeHq() {
    if (state.phase !== 'day') {
      return { ok: false, reason: '정비 페이즈(낮)에만 지휘 본부를 증축할 수 있습니다.' };
    }
    const maxLv = (DATA.HQ_LEVELS && DATA.HQ_LEVELS.length) || 4;
    if (state.hqLevel >= maxLv) {
      return { ok: false, reason: '이미 최고 지휘 본부 등급(Lv.4)에 도달했습니다.' };
    }
    const nextInfo = getHqLevelInfo(state.hqLevel + 1);
    if (!canAffordCost(nextInfo.cost)) {
      const c = nextInfo.cost || {};
      return {
        ok: false,
        reason: `증축 자원이 부족합니다. (필요: 목재 ${c.wood || 0} · 고철 ${c.scrap || 0} · 코인 ${c.coin || 0})`,
        nextInfo
      };
    }
    return { ok: true, nextInfo };
  }

  function upgradeHq() {
    const check = canUpgradeHq();
    if (!check.ok) {
      ZS.Audio.playError();
      banner('지휘 본부 증축 불가', check.reason, 'warn');
      return false;
    }

    const prevInfo = getHqLevelInfo(state.hqLevel);
    const nextInfo = check.nextInfo;
    payCost(nextInfo.cost);

    state.hqLevel = nextInfo.level;
    const hq = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
    const hpGain = Math.max(0, nextInfo.maxHp - prevInfo.maxHp);
    if (hq && hq.id === 'command_hq') {
      hq.level = nextInfo.level;
      hq.maxHp = nextInfo.maxHp;
      hq.hp = Math.min(nextInfo.maxHp, hq.hp + hpGain);
      hq.upgradeAnimTimer = 1.2;
    }

    const prevCap = state.powerCap;
    const prevPopCap = state.popCap;
    recalculateBaseStats();

    // Immediately grant the new HQ generator/battery delta & bunk recruit feel
    const capDelta = Math.max(0, state.powerCap - prevCap);
    if (capDelta > 0) {
      state.power = Math.min(state.powerCap, state.power + capDelta);
    }
    if (state.popCap > prevPopCap && state.agents < state.popCap) {
      state.agents += 1;
    }

    const hx = DATA.HQ_POS.x + 0.5;
    const hy = DATA.HQ_POS.y + 0.5;
    spawnBurstParticles(hx, hy, 6, '#C8B898', 16);
    spawnBurstParticles(hx, hy, 18, DATA.PALETTE.baseLight, 10);
    addFloatingText(hx, hy, nextInfo.maxZ + 6, `Lv.${nextInfo.level}`, DATA.PALETTE.levelPip, 14, DATA.PALETTE.outlineDark);

    if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
    else ZS.Audio.playBuild();

    const unlockedNames = Object.values(DATA.ITEMS)
      .filter((it) => it.reqHqLevel === nextInfo.level && !it.unlockedByBoss)
      .map((it) => it.name);
    const wpnLabel = nextInfo.weapon ? `무장 [${nextInfo.weapon.name}] 개방` : '';
    const unlockLabel = unlockedNames.length > 0 ? `신규 해금: ${unlockedNames.join(', ')}` : '';
    const subParts = [wpnLabel, unlockLabel].filter(Boolean).join(' · ');

    banner(`지휘 본부 Lv.${nextInfo.level} — ${nextInfo.name}`, subParts || `최대 내구도 ${nextInfo.maxHp} 확장 완료`, 'good');
    saveGame();
    notifyUi();
    return true;
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

    const hasVoucher = (state.freeVouchers[itemId] || 0) > 0;
    const reqLv = def.reqHqLevel || 1;
    if (!hasVoucher && state.hqLevel < reqLv) {
      const reqInfo = getHqLevelInfo(reqLv);
      return {
        ok: false,
        reason: `지휘 본부 Lv.${reqLv}(${reqInfo.name}) 증축 시 해금됩니다.`,
        lockedByHq: true,
        reqHqLevel: reqLv
      };
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

    if (!hasVoucher && !canAffordCost(def.cost)) {
      return { ok: false, reason: '건설 자원이 부족합니다.' };
    }

    return { ok: true };
  }

  function getCumulativeRefundCost(st, def) {
    if (!def) return null;
    if (st.invested) {
      return {
        wood: st.invested.wood || 0,
        scrap: st.invested.scrap || 0,
        coin: st.invested.coin || 0
      };
    }
    // Fallback reconstruction for legacy saves without st.invested
    const total = { wood: 0, scrap: 0, coin: 0 };
    if (!st.usedVoucher && def.cost) {
      total.wood += def.cost.wood || 0;
      total.scrap += def.cost.scrap || 0;
      total.coin += def.cost.coin || 0;
    }
    const lv = st.level || 1;
    for (let k = 1; k < lv; k++) {
      const up = getUpgradeCost(def, k);
      if (up) {
        total.wood += up.wood || 0;
        total.scrap += up.scrap || 0;
        total.coin += up.coin || 0;
      }
    }
    return total;
  }

  function canUpgradeStructure(tx, ty) {
    if (state.phase !== 'day') {
      return { ok: false, reason: '정비 페이즈(낮)에만 시설을 강화할 수 있습니다.' };
    }
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      return { ok: false, reason: '잘못된 타일입니다.' };
    }
    const st = state.structGrid[ty] && state.structGrid[ty][tx];
    if (!st) return { ok: false, reason: '시설이 없습니다.' };
    if (st.id === 'command_hq') {
      return canUpgradeHq();
    }
    const def = DATA.ITEMS[st.id];
    if (!isUpgradeableDef(def)) {
      return { ok: false, reason: '이 시설은 강화 대상이 아닙니다.', notUpgradeable: true };
    }
    const curLv = st.level || 1;
    if (curLv >= 3) {
      return { ok: false, reason: '이미 최고 강화 단계(Lv.3)입니다.', isMax: true };
    }
    const nextLv = curLv + 1;
    const capLv = Math.min(3, state.hqLevel || 1);
    const cost = getUpgradeCost(def, curLv);
    if (nextLv > capLv) {
      return {
        ok: false,
        reason: `지휘 본부 Lv.${nextLv} 증축 후 Lv.${nextLv} 강화가 해금됩니다.`,
        hqCapped: true,
        reqHqLevel: nextLv,
        cost
      };
    }
    if (!canAffordCost(cost)) {
      return {
        ok: false,
        reason: `강화 자원이 부족합니다. (필요: 목재 ${cost.wood || 0} · 고철 ${cost.scrap || 0} · 코인 ${cost.coin || 0})`,
        cost
      };
    }
    return { ok: true, nextLv, cost };
  }

  function upgradeStructure(tx, ty) {
    const st = state.structGrid[ty] && state.structGrid[ty][tx];
    if (st && st.id === 'command_hq') {
      return upgradeHq();
    }
    const check = canUpgradeStructure(tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      banner('시설 강화 불가', check.reason, 'warn');
      return false;
    }

    const def = DATA.ITEMS[st.id];
    const cost = check.cost;
    payCost(cost);

    const prevMax = st.maxHp;
    const prevCap = state.powerCap;
    const prevPopCap = state.popCap;

    st.level = check.nextLv;
    if (!st.invested) {
      st.invested = getCumulativeRefundCost(st, def) || { wood: 0, scrap: 0, coin: 0 };
      // Note: getCumulativeRefundCost already counted up to old st.level-1, so reset properly:
      const base = st.usedVoucher ? {} : (def.cost || {});
      st.invested = {
        wood: base.wood || 0,
        scrap: base.scrap || 0,
        coin: base.coin || 0
      };
      for (let k = 1; k < check.nextLv - 1; k++) {
        const prevUp = getUpgradeCost(def, k);
        if (prevUp) {
          st.invested.wood += prevUp.wood || 0;
          st.invested.scrap += prevUp.scrap || 0;
          st.invested.coin += prevUp.coin || 0;
        }
      }
    }
    st.invested.wood = (st.invested.wood || 0) + (cost.wood || 0);
    st.invested.scrap = (st.invested.scrap || 0) + (cost.scrap || 0);
    st.invested.coin = (st.invested.coin || 0) + (cost.coin || 0);
    st.upgradeAnimTimer = 0.6;

    recalculateBaseStats();
    const hpDelta = Math.max(0, st.maxHp - prevMax);
    st.hp = Math.min(st.maxHp, st.hp + hpDelta);

    if (state.powerCap > prevCap && def.subType === 'power') {
      state.power = Math.min(state.powerCap, state.power + Math.round((state.powerCap - prevCap) * 0.5));
    }
    if (state.popCap > prevPopCap && state.agents < state.popCap && state.wave === 1) {
      // Keep natural morning arrival rule unless HQ upgraded
    }

    if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
    else ZS.Audio.playBuild();

    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const pipCol = st.level >= 3 ? DATA.PALETTE.levelMax : DATA.PALETTE.levelPip;
    const strokeCol = st.level >= 3 ? DATA.PALETTE.levelMaxStroke : DATA.PALETTE.outlineDark;
    spawnBurstParticles(cx, cy, 12, pipCol, 10);
    addFloatingText(cx, cy, 28, `Lv.${st.level}`, DATA.PALETTE.levelPip, 14, strokeCol);

    if (st.level === 3 && DATA.LV3_PERK_LABELS && DATA.LV3_PERK_LABELS[def.id]) {
      banner(`[${def.name}] Lv.3 개조 완료`, `특수 효과 개방: ${DATA.LV3_PERK_LABELS[def.id]}`, 'good');
    }

    saveGame();
    notifyUi();
    return true;
  }

  function placeItem(itemId, tx, ty) {
    const check = canPlaceItem(itemId, tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      banner('건설 불가', check.reason, 'warn');
      return false;
    }

    const def = DATA.ITEMS[itemId];
    let usedVoucher = false;
    if ((state.freeVouchers[itemId] || 0) > 0) {
      state.freeVouchers[itemId] -= 1;
      usedVoucher = true;
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
      const baseCost = usedVoucher ? {} : (def.cost || {});
      state.structGrid[ty][tx] = {
        uid: nextStructUid++,
        id: itemId,
        level: 1,
        xp: 0,
        rank: 0,
        kills: 0,
        usedVoucher,
        invested: {
          wood: baseCost.wood || 0,
          scrap: baseCost.scrap || 0,
          coin: baseCost.coin || 0
        },
        hp: maxHp,
        maxHp,
        cooldown: 0,
        aimAngle: 0,
        buildAnimTimer: 0.34,
        upgradeAnimTimer: 0,
        promoAnimTimer: 0
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
    spawnBuildDustPuffs(tx + 0.5, ty + 0.5, def.layer === 'floor' ? 6 : 10);
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
      banner('이동 불가', '외곽 진입 구역으로는 시설을 옮길 수 없습니다.', 'warn');
      return false;
    }
    if (state.structGrid[toY][toX]) {
      ZS.Audio.playError();
      return false;
    }

    src.buildAnimTimer = 0.34;
    state.structGrid[toY][toX] = src;
    state.structGrid[fromY][fromX] = null;
    recalculateBaseStats();
    recomputeFlow();
    ZS.Audio.playBuild();
    spawnBuildDustPuffs(toX + 0.5, toY + 0.5, 9);
    saveGame();
    notifyUi();
    return true;
  }

  function removeAt(tx, ty, forceConfirm) {
    if (state.phase !== 'day') return false;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return false;

    const st = state.structGrid[ty][tx];
    if (st) {
      if (st.id === 'command_hq') {
        ZS.Audio.playError();
        banner('철거 불가', '지휘 본부는 철거할 수 없습니다!', 'warn');
        return false;
      }
      const def = DATA.ITEMS[st.id];
      const rank = st.rank || computeRankFromXp(st.xp || 0);
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Veteran/Ace Rank 1+ daytime demolish confirmation guard (art spec §4)
      if (!forceConfirm && rank >= 1) {
        const isConfirmedRepeat =
          pendingVeteranDemolish &&
          pendingVeteranDemolish.tx === tx &&
          pendingVeteranDemolish.ty === ty &&
          nowMs - pendingVeteranDemolish.atMs < 4000;

        if (!isConfirmedRepeat) {
          pendingVeteranDemolish = { tx, ty, atMs: nowMs };
          const rInfo = getVeterancyRankInfo(rank);
          ZS.Audio.playError();
          banner(
            `[${rInfo.name}] ${def ? def.name : st.id} — 계급이 사라집니다`,
            `철거하면 누적 숙련도(${Math.floor(st.xp || 0)} XP)와 계급 배지가 영구 소멸합니다. 4초 내 한 번 더 클릭하면 철거됩니다.`,
            'warn'
          );
          return false;
        }
      }

      pendingVeteranDemolish = null;
      const refundTotal = getCumulativeRefundCost(st, def);
      state.structGrid[ty][tx] = null;
      spawnStructureDebris(tx + 0.5, ty + 0.5, st.id, 9);
      if (rank >= 1) {
        spawnBadgeShatterVfx(tx + 0.5, ty + 0.5, rank);
      }
      refundCost(refundTotal, tx, ty);
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
    const entries = [];
    if (cost.wood) {
      const rw = Math.max(1, Math.round(cost.wood * 0.8));
      state.wood += rw;
      entries.push({ val: `+${rw}`, col: DATA.PALETTE.resWood || '#D49A5A' });
    }
    if (cost.scrap) {
      const rs = Math.max(1, Math.round(cost.scrap * 0.8));
      state.scrap += rs;
      entries.push({ val: `+${rs}`, col: DATA.PALETTE.resScrap || '#AEB8C4' });
    }
    if (cost.coin) {
      const rc = Math.max(1, Math.round(cost.coin * 0.8));
      state.coin += rc;
      entries.push({ val: `+${rc}`, col: DATA.PALETTE.coin || '#FFC94A' });
    }
    for (let i = 0; i < entries.length; i++) {
      const offsetX = (i - (entries.length - 1) * 0.5) * 0.22;
      addFloatingText(
        tx + 0.5 + offsetX,
        ty + 0.5,
        16 + i * 4,
        entries[i].val,
        entries[i].col,
        12,
        DATA.PALETTE.outlineDark
      );
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
      banner('수리 자재 부족', `전체 수리에 목재 ${info.woodCost}, 고철 ${info.scrapCost}이 필요합니다.`, 'warn');
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
        banner('숙소 수용량 부족!', '먼저 [전력·숙소] 탭에서 막사나 컨테이너 숙소를 건설해 빈자리를 확보하세요.', 'warn');
        return false;
      }
      state.coin -= offer.coinCost;
      state.agents += offer.amount;
      offer.sold = true;
      ZS.Audio.playTrade();
      banner('베테랑 요원 합류!', `작전 요원이 기지에 배치되었습니다. (현재 요원 ${state.agents}/${state.popCap})`, 'good');
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
      isBossWave ? `WAVE ${state.wave} — 알파 변이체 경보!` : `WAVE ${state.wave} 야간 방어 개시`,
      `충전 전력 ${Math.round(state.power)} · 적 개체 ${state.waveTotalZombies}기 접근 중`,
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
    const hqCx = DATA.HQ_POS.x + 0.5;
    const hqCy = DATA.HQ_POS.y + 0.5;
    state.zombies.push({
      uid: nextZombieUid++,
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
      hitFlash: 0,
      hitFlashTimer: 0,
      vulnOnPad: false,
      facingAngle: Math.atan2(hqCy - gy, hqCx - gx),
      seed: Math.random() * 10
    });

    if (def.isBoss) {
      triggerScreenShake(5.5, 0.36);
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
          spawnBurstParticles(x + 0.5, y + 0.5, 10, DATA.PALETTE.health, 6);
          count++;
        }
      }
    }
    ZS.Audio.playBuild();
    addFloatingText(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 30, '+95 HP', DATA.PALETTE.heal || DATA.PALETTE.health, 14, DATA.PALETTE.outlineDark);
    banner(
      '긴급 나노 수리 드론 가동',
      count > 0 ? `${count}개 시설의 내구도를 +95 회복했습니다.` : '모든 시설 내구도가 이미 최대입니다.',
      'good'
    );
    notifyUi();
    return true;
  }

  function triggerAirstrikeAt(gx, gy) {
    if (state.skills.airstrikeCd > 0 || state.phase === 'gameover') return false;
    state.skills.airstrikeCd = state.skills.airstrikeMaxCd;

    state.flares.push({ x: gx, y: gy, radius: 4.5, life: 4.5 });
    spawnBurstParticles(gx, gy, 10, '#ffae42', 22);
    spawnBurstParticles(gx, gy, 14, DATA.PALETTE.danger, 16);
    spawnStructureDebris(gx, gy, 'hesco_wall', 8);
    triggerScreenShake(7.5, 0.42);
    ZS.Audio.playExplosion();

    const strikeDmg = 120 + state.wave * 18;
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const d = Math.hypot(z.x - gx, z.y - gy);
      if (d <= 2.65) {
        damageZombie(i, strikeDmg * (1 - d * 0.18), '#ff9f43');
      }
    }
    banner('전술 조명탄 & 폭격 투하', '지정 구역 광역 타격 및 야간 조명이 전개되었습니다.', 'info');
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
        spawnBurstParticles(DATA.HQ_POS.x + 0.5, DATA.HQ_POS.y + 0.5, 8, '#D8C8A8', 10);
      }
      if (prevT > 0.3 && hqSt.upgradeAnimTimer <= 0.3) {
        hqSt.hitFlashTimer = 0.06;
        hqSt.hitFlash = 1.0;
      }
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const s = state.structGrid[y] && state.structGrid[y][x];
        if (!s) continue;
        if (s.hitFlashTimer > 0) {
          s.hitFlashTimer = Math.max(0, s.hitFlashTimer - rawDt);
          s.hitFlash = s.hitFlashTimer > 0 ? 1.0 : 0;
        } else if (s.hitFlash > 0) {
          s.hitFlash = Math.max(0, s.hitFlash - rawDt * 18);
        }
        if (s.buildAnimTimer > 0) {
          s.buildAnimTimer = Math.max(0, s.buildAnimTimer - rawDt);
        }
        if (s.id !== 'command_hq' && s.upgradeAnimTimer > 0) {
          s.upgradeAnimTimer = Math.max(0, s.upgradeAnimTimer - rawDt);
        }
        if (s.promoAnimTimer > 0) {
          s.promoAnimTimer = Math.max(0, s.promoAnimTimer - rawDt);
        }
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

    // 4. Update Defenders & Auto-Turrets + Delayed Burst Shots
    updateDefenders(dt);
    updateBurstQueue(dt);

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
    state.blackoutFlickerTimer = 0.50;
    state.power = 0;
    ZS.Audio.playBlackout();
    banner('배터리 방전 — 블랙아웃!', '자동 포탑과 전기 투광등이 정지했습니다! 무전력 전투원이 방어를 지속합니다.', 'warn');
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
    // 1. HQ Roof Auto-Turret (Lv.2~4, unpowered emergency defense)
    const hq = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
    const hqInfo = getHqLevelInfo(state.hqLevel);
    if (hq && hq.id === 'command_hq' && hqInfo.weapon) {
      if (hq.cooldown > 0) hq.cooldown -= dt;
      if (hq.cooldown <= 0 && state.zombies.length > 0) {
        const wpn = hqInfo.weapon;
        const hcx = DATA.HQ_POS.x + 0.5;
        const hcy = DATA.HQ_POS.y + 0.5;
        const fireRate = wpn.fireRate * (1.0 + (state.cozyTier ? state.cozyTier.fireRate : 0));
        let bestIdx = -1;
        let bestDist = 1e9;
        for (let i = 0; i < state.zombies.length; i++) {
          const z = state.zombies[i];
          const d = Math.hypot(z.x - hcx, z.y - hcy);
          if (d <= wpn.range && d < bestDist) {
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
          const hqLenTiles = hqLvNow >= 4 ? 0.48 : hqLvNow === 3 ? 0.38 : 0.32;
          const hqMuzzleZ = hqLvNow >= 4 ? 41 : hqLvNow === 3 ? 34.5 : 25;
          spawnMuzzleFlash(
            hqMountX + Math.cos(hq.aimAngle) * hqLenTiles,
            hqMountY + Math.sin(hq.aimAngle) * hqLenTiles,
            hqMuzzleZ,
            hq.aimAngle,
            wpn.color || '#FFE484',
            hqLvNow >= 4 ? 1.35 : 1.05
          );
          const spd = wpn.speed || 18;
          state.projectiles.push({
            kind: 'bullet',
            x: hcx,
            y: hcy,
            z: hqInfo.maxZ - 4,
            vx: Math.cos(hq.aimAngle) * spd,
            vy: Math.sin(hq.aimAngle) * spd,
            damage: wpn.damage,
            isCrit: false,
            splash: wpn.splashRadius || 0,
            splashFlashRadius: wpn.splashRadius || 0,
            color: wpn.color || '#FFE484',
            width: wpn.width || 2.0,
            life: 0.65,
            isHqShot: true
          });
        }
      }
    }

    // 2. Manned Posts & Electric Auto-Turrets
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

        // Check shot power cost for electric turrets (uses upgraded powerShot, e.g. vulcan Lv.3 = 0.24)
        const shotCost = eff.powerShot !== undefined ? eff.powerShot : (def.powerShot || 0);
        if (def.requiresPower && shotCost) {
          if (state.power < shotCost * 0.35) {
            state.power = 0;
            if (!state.blackoutTriggered) triggerBlackout();
            continue;
          }
          state.power = Math.max(0, state.power - shotCost);
          if (state.power <= 0 && !state.blackoutTriggered) triggerBlackout();
        }

        const target = state.zombies[bestIdx];
        st.aimAngle = Math.atan2(target.y - cy, target.x - cx);
        st.cooldown = 1 / Math.max(0.2, eff.fireRate);

        fireWeapon(def, eff, cx, cy, bestIdx, st);
      }
    }
  }

  function updateBurstQueue(dt) {
    for (let i = state.burstQueue.length - 1; i >= 0; i--) {
      const b = state.burstQueue[i];
      b.delay -= dt;
      if (b.delay <= 0) {
        state.burstQueue.splice(i, 1);
        const a = b.angle + (Math.random() - 0.5) * 0.08;
        const spd = 18;
        ZS.Audio.playShoot('rifle');
        spawnMuzzleFlash(
          b.cx + Math.cos(a) * 0.53,
          b.cy + Math.sin(a) * 0.53,
          9.0,
          a,
          '#FFE484',
          0.88
        );
        state.projectiles.push({
          kind: 'bullet',
          sourceUid: b.sourceUid || null,
          x: b.cx,
          y: b.cy,
          z: 9.0,
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

  function fireWeapon(def, eff, cx, cy, targetIdx, st) {
    const target = state.zombies[targetIdx];
    if (!target) return;

    if (st && !st.uid) st.uid = nextStructUid++;
    const sourceUid = st && st.id !== 'command_hq' ? st.uid : null;

    const isCrit = Math.random() < eff.critChance;
    const finalDmg = eff.damage * (isCrit ? 1.65 : 1.0);
    const angle = Math.atan2(target.y - cy, target.x - cx);

    ZS.Audio.playShoot(def.projType);

    const lvNow = (st && st.level) || 1;
    if (def.projType === 'emp') {
      spawnMuzzleFlash(cx, cy, 30.0, angle, DATA.PALETTE.power, 1.35, 'emp');
    } else if (def.id === 'sniper_tower') {
      spawnMuzzleFlash(cx + Math.cos(angle) * 0.68, cy + Math.sin(angle) * 0.68, 34.3, angle, '#FFFFFF', 1.3);
    } else if (def.id === 'shotgun_post') {
      spawnMuzzleFlash(cx + Math.cos(angle) * 0.53, cy - 0.06 + Math.sin(angle) * 0.53, 8.6, angle, '#FFB347', 1.25);
    } else if (def.id === 'rifle_bunker') {
      spawnMuzzleFlash(cx + Math.cos(angle) * 0.53, cy + Math.sin(angle) * 0.53, 9.0, angle, '#FFE484', 0.95);
    } else if (def.id === 'vulcan_turret') {
      const vDist = lvNow >= 3 ? 0.62 : 0.50;
      const vZ = (lvNow >= 2 ? 10.1 : 7.5) + 5.0;
      spawnMuzzleFlash(cx + Math.cos(angle) * vDist, cy + Math.sin(angle) * vDist, vZ, angle, '#FFE8B6', 1.0);
    } else if (def.id === 'missile_pod') {
      spawnMuzzleFlash(cx + Math.cos(angle) * 0.22, cy + 0.22 + Math.sin(angle) * 0.14, 14.5, angle, '#FF8A47', 1.3);
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
          damageZombie(idx, finalDmg * vuln, DATA.PALETTE.power, isCrit, sourceUid);
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
          z: 9.0,
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
      z: def.id === 'sniper_tower' ? 34.0 : def.id === 'rifle_bunker' ? 9.0 : 14.0,
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

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.projectiles.splice(i, 1);
        continue;
      }
      if (p.kind === 'chain' || p.kind === 'ring' || p.kind === 'spark' || p.kind === 'sniper_trail' || p.kind === 'promo_ring') continue;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const hitList = p.hitUids || [];

      // Hit detection against zombies (skip already pierced zombie uids)
      let hitIdx = -1;
      for (let zIdx = 0; zIdx < state.zombies.length; zIdx++) {
        const z = state.zombies[zIdx];
        if (z.uid && hitList.includes(z.uid)) continue;
        if (Math.hypot(z.x - p.x, z.y - p.y) <= 0.42) {
          hitIdx = zIdx;
          break;
        }
      }

      if (hitIdx !== -1) {
        if (p.splash > 0) {
          ZS.Audio.playExplosion();
          spawnBurstParticles(p.x, p.y, 12, '#ff8a47', p.isHqShot ? 8 : 12);
          state.flares.push({ x: p.x, y: p.y, radius: p.isHqShot ? 1.5 : 2.3, life: 0.20 });
          const ringRad = p.splashFlashRadius || p.splashRingLv3 || 0;
          if (ringRad > 0) {
            state.projectiles.push({
              kind: 'ring',
              x: p.x,
              y: p.y,
              radius: ringRad,
              color: '#FF9F43',
              life: 0.20,
              maxLife: 0.20
            });
          }
          for (let k = state.zombies.length - 1; k >= 0; k--) {
            const zk = state.zombies[k];
            const dist = Math.hypot(zk.x - p.x, zk.y - p.y);
            if (dist <= p.splash) {
              const vuln = isZombieOnLv3RazorPad(zk) ? 1.15 : 1.0;
              damageZombie(k, p.damage * vuln * (1 - dist / (p.splash * 1.5)), '#ff9f43', p.isCrit, p.sourceUid);
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
              const nx = hitZ.x + (p.vx / vLen) * p.knockback;
              const ny = hitZ.y + (p.vy / vLen) * p.knockback;
              const ntx = Math.floor(nx);
              const nty = Math.floor(ny);
              if (ntx >= 0 && nty >= 0 && ntx < N && nty < N) {
                const blk = state.structGrid[nty] && state.structGrid[nty][ntx];
                const bDef = blk ? (blk.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[blk.id]) : null;
                if (!blk || (bDef && bDef.passable)) {
                  hitZ.x = nx;
                  hitZ.y = ny;
                  spawnBurstParticles(nx, ny, 2, '#C8BFA8', 4);
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

          damageZombie(hitIdx, p.damage * pierceMult * vuln, p.isCrit ? DATA.PALETTE.critText : '#ffffff', p.isCrit, p.sourceUid);

          const rem = (p.pierceLeft || 1) - 1;
          p.pierceLeft = rem;
          if (rem <= 0) {
            state.projectiles.splice(i, 1);
          }
        }
      }
    }
  }

  function damageZombie(index, amount, textColor, isCrit, sourceUid) {
    const z = state.zombies[index];
    if (!z) return;
    const dmg = Math.max(1, Math.round(amount));
    z.hp -= dmg;
    z.hitFlashTimer = 0.045;
    z.hitFlash = 1.0;
    spawnBurstParticles(z.x, z.y, 10, DATA.PALETTE.danger, 3);

    if (dmg >= 15 || isCrit) {
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
      const scrapGain = randInt(def.scrapDrop[0], def.scrapDrop[1]);
      const coinGain = randInt(def.coinDrop[0], def.coinDrop[1]);
      state.scrap += scrapGain;
      state.coin += coinGain;
      state.waveKilledZombies += 1;

      awardKillXpBySourceUid(sourceUid, z.type, !!def.isBoss);

      spawnBurstParticles(z.x, z.y, 10, DATA.PALETTE.danger, def.isBoss ? 16 : 9);
      spawnZombieDeathVfx(z, def);
      if (def.isBoss) {
        state.bossDefeated = true;
        addFloatingText(z.x - 0.18, z.y, 24, `+${scrapGain}`, DATA.PALETTE.resScrap, 13, DATA.PALETTE.outlineDark);
        addFloatingText(z.x + 0.18, z.y, 26, `+${coinGain}`, DATA.PALETTE.coin, 13, DATA.PALETTE.outlineDark);
        banner('알파 보스 격파!', `고철 +${scrapGain} · 코인 +${coinGain} 획득 · 생존 전투원 숙련도 보너스 & 특수 기념비 해금!`, 'good');
      } else if (Math.random() < 0.35 || z.type === 'brute') {
        addFloatingText(z.x, z.y, 16, `+${scrapGain}`, DATA.PALETTE.resScrap, 12, DATA.PALETTE.outlineDark);
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
      z.vulnOnPad = false;
      if (under && under.id === 'razor_pad') {
        const rDef = DATA.ITEMS.razor_pad;
        const rProf = getStructLevelProfile(rDef, under.level || 1);
        slowMult = Math.min(slowMult, rProf.slowFactor);
        z.vulnOnPad = rProf.vulnMult > 1.0;
        z.hp -= rProf.trapDps * dt;
        under.hp -= rProf.trapWear * dt;
        if (under.hp <= 0) {
          state.structGrid[ty][tx] = null;
          spawnStructureDebris(tx + 0.5, ty + 0.5, 'razor_pad', 7);
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
        if (distHq > 0.01) {
          z.facingAngle = Math.atan2(hqCy - z.y, hqCx - z.x);
        }
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          hqStruct.hp -= z.damage;
          hqStruct.hitFlashTimer = 0.05;
          hqStruct.hitFlash = 1.0;
          triggerScreenShake(5.0, 0.28);
          spawnBurstParticles(hqCx, hqCy, 14, DATA.PALETTE.danger, 5);
          addFloatingText(hqCx, hqCy, 28, `-${z.damage}`, DATA.PALETTE.danger, 12);
          notifyUi();
          if (hqStruct.hp <= 0) {
            hqStruct.hp = 0;
            spawnStructureDebris(hqCx, hqCy, 'command_hq', 18);
            triggerScreenShake(8.0, 0.45);
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
      if (distGoal > 0.01) {
        z.facingAngle = Math.atan2(goalY - z.y, goalX - z.x);
      }
      if (blockingTarget && distGoal <= 0.86) {
        // Melee attack blocking structure
        if (z.atkCooldown <= 0) {
          z.atkCooldown = 1 / z.attackRate;
          blockingTarget.hp -= z.damage;
          blockingTarget.hitFlashTimer = 0.045;
          blockingTarget.hitFlash = 1.0;
          spawnBurstParticles(btx + 0.5, bty + 0.5, 10, '#cbd5e1', 4);

          const bDef = DATA.ITEMS[blockingTarget.id];
          const bProf = bDef ? getStructLevelProfile(bDef, blockingTarget.level || 1) : null;

          if (blockingTarget.hp <= 0) {
            const lostRank = blockingTarget.rank || computeRankFromXp(blockingTarget.xp || 0);
            const destroyedId = blockingTarget.id;
            state.structGrid[bty][btx] = null;
            spawnStructureDebris(btx + 0.5, bty + 0.5, destroyedId, 14);
            spawnBurstParticles(btx + 0.5, bty + 0.5, 10, DATA.PALETTE.danger, 8);
            if (lostRank >= 1) {
              spawnBadgeShatterVfx(btx + 0.5, bty + 0.5, lostRank);
              const rInfo = getVeterancyRankInfo(lostRank);
              banner(`[${rInfo.name}] ${bDef ? bDef.name : '방어 거점'} 파괴!`, '전투 중 파괴되어 누적 숙련도와 계급 배지가 소실되었습니다.', 'danger');
            }
            structureDestroyed = true;
          }

          // Wall Lv.3 Thorns: reflect max(8, round(z.damage * 0.35)) + orange spark line (0.12s)
          if (bProf && bProf.thornsRatio > 0) {
            const reflDmg = Math.max(8, Math.round(z.damage * bProf.thornsRatio));
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
    state.blackoutFlickerTimer = 0;
    state.muzzleFlashes = [];
    state.projectiles = [];
    state.burstQueue = [];

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

    const agentMsg = arrivedAgent > 0 ? ' · 신규 요원 +1명 합류!' : '';
    banner(
      `WAVE ${clearedWave} 방어 성공! 아침이 밝았습니다`,
      `보상 목재 +${woodReward} · 고철 +${scrapReward} · 코인 +${totalCoin} · 주간 충전 전력 +${gainedPower}${agentMsg}`,
      'good'
    );

    saveGame();
    notifyUi();
  }

  function triggerGameOver() {
    state.phase = 'gameover';
    ZS.Audio.playBlackout();
    banner('지휘 본부 함락 — 작전 실패', `WAVE ${state.wave}에서 방어선이 붕괴했습니다. 상단 [새 작전] 버튼으로 재도전하세요!`, 'danger');
    notifyUi();
  }

  // ================= VFX HELPERS =================
  function triggerScreenShake(ampPx, durationSec) {
    if (!screenShakeEnabled) return;
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
      state.particles.push({
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

  function getStructureDebrisPalette(itemId) {
    switch (itemId) {
      case 'hesco_wall': return ['#C9B48A', '#9E8758', '#8C96A3'];
      case 'blast_wall': return ['#6B7686', '#F0BD35', '#8C96A3'];
      case 'razor_pad': return ['#4A525C', '#C9D3DE', '#596574'];
      case 'rifle_bunker': return ['#B5A27A', '#55684F', '#8C96A3'];
      case 'shotgun_post': return ['#B5A27A', '#3A4654', '#EBA834'];
      case 'sniper_tower': return ['#7C8B99', '#4F5D4B', '#5B6875'];
      case 'vulcan_turret': return ['#E8EEF4', '#4E5A68', '#5EF2FF'];
      case 'missile_pod': return ['#6C7D65', '#4C574A', '#E0603A'];
      case 'emp_coil': return ['#60748A', '#B87333', '#5EF2FF'];
      case 'solar_array': return ['#2466B5', '#A9B6C4', '#7B8996'];
      case 'wind_turbine': return ['#EEF3F8', '#D0DBE6', '#758594'];
      case 'battery_bank': return ['#DDE5EC', '#9AA8B6', '#5EF2FF'];
      case 'field_tent': return ['#6E8466', '#2E3A2B', '#FFD27A'];
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

  function spawnStructureDebris(gx, gy, itemId, count) {
    const cols = getStructureDebrisPalette(itemId);
    const n = count || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.1 + Math.random() * 2.5;
      const w = 0.085 + Math.random() * 0.065;
      const life = 0.52 + Math.random() * 0.28;
      state.particles.push({
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

  // ================= PERSISTENCE (localStorage) =================
  function saveGame() {
    if (state.phase !== 'day') return;
    try {
      const payload = {
        wave: state.wave,
        hqLevel: state.hqLevel,
        bossDefeated: state.bossDefeated,
        wood: state.wood,
        scrap: state.scrap,
        coin: state.coin,
        power: state.power,
        agents: state.agents,
        debugBonusPopCap: state.debugBonusPopCap || 0,
        freeVouchers: state.freeVouchers,
        traderOffers: state.traderOffers,
        floorGrid: state.floorGrid,
        structGrid: state.structGrid
      };
      localStorage.setItem(getSaveKey(), JSON.stringify(payload));
    } catch (e) {
      // Ignore storage quota / privacy mode errors
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(getSaveKey());
      if (!raw) return false;
      const d = JSON.parse(raw);
      const LEGACY_GRID_SIZE = 18;
      if (!d || !Array.isArray(d.structGrid)) return false;
      const savedN = d.structGrid.length;
      if (savedN !== N && savedN !== LEGACY_GRID_SIZE) return false;
      if (!Array.isArray(d.floorGrid) || d.floorGrid.length !== savedN) return false;
      for (let ry = 0; ry < savedN; ry++) {
        if (!Array.isArray(d.structGrid[ry]) || d.structGrid[ry].length !== savedN) return false;
        if (!Array.isArray(d.floorGrid[ry]) || d.floorGrid[ry].length !== savedN) return false;
      }

      const nextFloorGrid = Array.from({ length: N }, () => Array(N).fill(null));
      const nextStructGrid = Array.from({ length: N }, () => Array(N).fill(null));
      const offset = savedN === LEGACY_GRID_SIZE && N === 22 ? (N - LEGACY_GRID_SIZE) / 2 : 0;

      for (let oy = 0; oy < savedN; oy++) {
        for (let ox = 0; ox < savedN; ox++) {
          nextFloorGrid[oy + offset][ox + offset] = d.floorGrid[oy][ox] || null;
          nextStructGrid[oy + offset][ox + offset] = d.structGrid[oy][ox] || null;
        }
      }

      const hqLoaded = nextStructGrid[DATA.HQ_POS.y] && nextStructGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
      if (!hqLoaded || hqLoaded.id !== 'command_hq') return false;

      state.wave = d.wave || 1;
      state.hqLevel = Math.max(1, Math.min(4, d.hqLevel || 1));
      state.phase = 'day';
      state.isNight = false;
      state.nightAlpha = 0;
      state.blackoutTriggered = false;
      state.blackoutFlickerTimer = 0;
      state.shakeTimer = 0;
      state.shakeAmp = 0;
      state.dyingZombies = [];
      state.groundDecals = [];
      state.muzzleFlashes = [];
      state.bossDefeated = !!d.bossDefeated;
      state.wood = d.wood ?? DATA.INITIAL_RESOURCES.wood;
      state.scrap = d.scrap ?? DATA.INITIAL_RESOURCES.scrap;
      state.coin = d.coin ?? DATA.INITIAL_RESOURCES.coin;
      state.agents = d.agents ?? DATA.HQ_STATS.startingAgents;
      state.debugBonusPopCap = d.debugBonusPopCap || 0;
      state.freeVouchers = d.freeVouchers || {};
      state.floorGrid = nextFloorGrid;
      state.structGrid = nextStructGrid;

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s) continue;
          if (!s.level) s.level = s.id === 'command_hq' ? state.hqLevel : 1;
          if (s.id !== 'command_hq') {
            if (!s.uid) s.uid = nextStructUid++;
            else if (s.uid >= nextStructUid) nextStructUid = s.uid + 1;
            s.xp = s.xp || 0;
            s.rank = computeRankFromXp(s.xp);
          }
          s.buildAnimTimer = 0;
          s.hitFlashTimer = 0;
          s.hitFlash = 0;
          s.upgradeAnimTimer = 0;
          s.promoAnimTimer = 0;
        }
      }

      recalculateBaseStats(true);
      state.cozyTierUpTimer = 0;
      state.power = d.power ?? state.powerCap;
      recomputeFlow();
      if (Array.isArray(d.traderOffers) && d.traderOffers.length > 0) {
        state.traderOffers = d.traderOffers;
      } else {
        refreshTraderOffers(false);
      }
      if (offset > 0) saveGame();
      notifyUi();
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSaveAndReset() {
    try {
      localStorage.removeItem(getSaveKey());
    } catch (e) {}
    initNewGame();
    banner('새 전초기지 작전 개시', '방어선과 발전 설비를 구축하고 모던 쉘터를 꾸며보세요!', 'info');
  }

  // ================= DEBUG / STAGING CHEAT ACTIONS (DOUBLE-GATED) =================
  function isDebugAllowed() {
    const env = getEnvInfo();
    return !!(env.isDevEnvironment && env.isDebugMode);
  }

  function debugAddResources(amount) {
    if (!isDebugAllowed()) return false;
    const add = Number(amount) || 500;
    state.wood += add;
    state.scrap += add;
    state.coin += add;
    ZS.Audio.playTrade();
    banner(`[DEBUG] +${add} 자원 지급`, `목재·고철·코인 각 +${add} 추가 완료`, 'good');
    saveGame();
    notifyUi();
    return true;
  }

  function debugTogglePower() {
    if (!isDebugAllowed()) return false;
    if (state.power > 0.01) {
      state.power = 0;
      if (state.isNight) {
        triggerBlackout();
      } else {
        ZS.Audio.playBlackout();
        banner('[DEBUG] 전력 강제 방전 (0)', '블랙아웃 테스트를 위해 배터리를 0으로 방전했습니다.', 'warn');
      }
    } else {
      state.power = Math.max(85, state.powerCap);
      state.blackoutTriggered = false;
      state.blackoutFlickerTimer = 0;
      ZS.Audio.playBuild();
      banner(`[DEBUG] 전력 즉시 완충 (${state.power})`, '자동 포탑 및 전기 조명 전원이 복구되었습니다.', 'good');
    }
    saveGame();
    notifyUi();
    return true;
  }

  function debugAddAgents(count) {
    if (!isDebugAllowed()) return false;
    const n = Number(count) || 2;
    state.debugBonusPopCap = (state.debugBonusPopCap || 0) + n;
    recalculateBaseStats(true);
    state.agents += n;
    ZS.Audio.playTrade();
    banner(`[DEBUG] 요원 +${n}명 충원`, `가용 요원 ${state.agents}명 · 숙소 수용량 ${state.popCap}명으로 확장`, 'good');
    saveGame();
    notifyUi();
    return true;
  }

  function debugAdvanceWave(delta) {
    if (!isDebugAllowed()) return false;
    if (state.phase !== 'day') {
      ZS.Audio.playError();
      banner('[DEBUG] 주간 전용 기능', '웨이브 번호 이동은 주간 정비 페이즈에서만 가능합니다.', 'warn');
      return false;
    }
    const step = Number(delta) || 1;
    state.wave = Math.max(1, state.wave + step);
    refreshTraderOffers(false);
    ZS.Audio.playBuild();
    banner(`[DEBUG] WAVE ${state.wave} 이동`, state.wave % 5 === 0 ? '보스 변이체 출현 웨이브입니다!' : '웨이브 번호가 즉시 변경되었습니다.', 'info');
    saveGame();
    notifyUi();
    return true;
  }

  function debugGrantSelectedXp(tx, ty, rawXp) {
    if (!isDebugAllowed()) return false;
    if (tx === undefined || ty === undefined || tx < 0 || ty < 0 || tx >= N || ty >= N) {
      ZS.Audio.playError();
      banner('[DEBUG] 대상 시설 미선택', '먼저 초소 또는 자동포탑을 클릭해 조회한 뒤 실행하세요.', 'warn');
      return false;
    }
    const s = state.structGrid[ty] && state.structGrid[ty][tx];
    if (!s || s.id === 'command_hq') {
      ZS.Audio.playError();
      banner('[DEBUG] 숙련도 부여 불가', '전투원 초소(manned) 또는 자동포탑(turret)을 선택해 주세요.', 'warn');
      return false;
    }
    const def = DATA.ITEMS[s.id];
    if (!isCombatVeterancyDef(def)) {
      ZS.Audio.playError();
      banner('[DEBUG] 숙련도 대상 아님', `[${def ? def.name : s.id}] 시설은 전투 숙련도 시스템 대상이 아닙니다.`, 'warn');
      return false;
    }
    const gain = Number(rawXp) || 20;
    const prevRank = s.rank || computeRankFromXp(s.xp || 0);
    s.xp = +((s.xp || 0) + gain).toFixed(3);
    const newRank = computeRankFromXp(s.xp);
    s.rank = newRank;

    if (newRank > prevRank) {
      const rInfo = getVeterancyRankInfo(newRank);
      s.promoAnimTimer = 0.8;
      if (ZS.Audio.playPromote) ZS.Audio.playPromote();
      state.projectiles.push({
        kind: 'promo_ring',
        x: tx + 0.5,
        y: ty + 0.5,
        z: 18,
        color: rInfo.color,
        life: 0.8,
        maxLife: 0.8
      });
      addFloatingText(tx + 0.5, ty + 0.5, 30, '★ UP', rInfo.color, 14, rInfo.stroke);
      banner(`[DEBUG] [${def.name}] ${rInfo.name} 진급!`, `숙련도 +${gain} XP 부여 (누적 ${s.xp.toFixed(1)} XP · Rank ${newRank})`, 'good');
    } else {
      ZS.Audio.playBuild();
      banner(`[DEBUG] [${def.name}] +${gain} XP 부여`, `현재 누적 ${s.xp.toFixed(1)} XP (${getVeterancyRankInfo(newRank).name})`, 'good');
    }
    saveGame();
    notifyUi();
    return true;
  }

  return {
    state,
    getEnvInfo,
    getSaveKey,
    isScreenShakeEnabled,
    setScreenShakeEnabled,
    toggleScreenShake,
    setCallbacks,
    initNewGame,
    loadGame,
    clearSaveAndReset,
    getHqLevelInfo,
    canUpgradeHq,
    upgradeHq,
    isUpgradeableDef,
    getUpgradeCost,
    getStructLevelProfile,
    canUpgradeStructure,
    upgradeStructure,
    isCombatVeterancyDef,
    getVeterancyRankInfo,
    computeRankFromXp,
    recalculateBaseStats,
    getPlacementCozyPreview,
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
    debugAddResources,
    debugTogglePower,
    debugAddAgents,
    debugAdvanceWave,
    debugGrantSelectedXp,
    update
  };
})();
