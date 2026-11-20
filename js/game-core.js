window.ZS = window.ZS || {};

(function () {
  const PROD_SAVE_KEY = 'outpost_zero_save_v1';
  const DEV_SAVE_KEY = 'outpost_zero_save_dev';
  const SETTINGS_KEY = 'outpost_zero_settings_v1';
  const DATA = ZS.DATA;
  const N = DATA.GRID_SIZE;

  const state = {
    wave: 1,
    hqLevel: 1,
    phase: 'day', // 'day' | 'night' | 'gameover'
    isNight: false,
    nightAlpha: 0,
    blackoutTriggered: false,
    blackoutActive: false,
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
    nightGen: 0,
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
    traderRefreshCount: 0,
    nightConsumables: {
      overpressureAmmo: false,
      reactiveArmor: false
    },
    agentRecruitProgress: 0,
    statsEpoch: 1,

    skills: {
      repairCd: 0,
      repairMaxCd: 18,
      airstrikeCd: 0,
      airstrikeMaxCd: 22
    },

    floorGrid: [],
    structGrid: [],
    flow: null,
    nextWaveIntel: null,
    previewPaths: [],
    breachMarkers: [],
    showReconPaths: true,
    reconNightFadeTimer: 0,
    reconFlashTimer: 0,

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

  const G = (ZS._Game = {
    DATA,
    N,
    PROD_SAVE_KEY,
    DEV_SAVE_KEY,
    SETTINGS_KEY,
    state,
    nextZombieUid: 1,
    nextStructUid: 1,
    pendingVeteranDemolish: null,
    screenShakeEnabled: true,
    onUiChange: null,
    onCombatHudChange: null,
    onWaveBanner: null,
    _inSimStep: false,
    _combatHudDirty: false
  });

  try {
    const rawSettings = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (rawSettings) {
      const parsedSettings = JSON.parse(rawSettings);
      if (parsedSettings && typeof parsedSettings.screenShake === 'boolean') {
        G.screenShakeEnabled = parsedSettings.screenShake;
      }
    }
  } catch (e) {}

  function isScreenShakeEnabled() {
    return G.screenShakeEnabled;
  }

  function setScreenShakeEnabled(flag) {
    G.screenShakeEnabled = !!flag;
    if (!G.screenShakeEnabled) {
      state.shakeTimer = 0;
      state.shakeAmp = 0;
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ screenShake: G.screenShakeEnabled }));
    } catch (e) {}
    notifyUi();
    return G.screenShakeEnabled;
  }

  function toggleScreenShake() {
    return setScreenShakeEnabled(!G.screenShakeEnabled);
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

  function setCallbacks(cbs) {
    G.onUiChange = cbs.onUiChange || null;
    G.onCombatHudChange = cbs.onCombatHudChange || null;
    G.onWaveBanner = cbs.onWaveBanner || null;
  }

  function invalidateStatsCache() {
    state.statsEpoch = (state.statsEpoch || 0) + 1;
    return state.statsEpoch;
  }

  function notifyUi() {
    G._combatHudDirty = false;
    if (G.onUiChange) G.onUiChange();
  }

  function notifyCombatHud() {
    if (G._inSimStep) {
      G._combatHudDirty = true;
      return;
    }
    if (G.onCombatHudChange) {
      G.onCombatHudChange();
    } else if (G.onUiChange) {
      G.onUiChange();
    }
  }

  function banner(title, sub, tone) {
    if (G.onWaveBanner) G.onWaveBanner(title, sub, tone || 'info');
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
    G.pendingVeteranDemolish = null;

    state.wave = 1;
    state.hqLevel = 1;
    state.phase = 'day';
    state.isNight = false;
    state.nightAlpha = 0;
    state.blackoutTriggered = false;
    state.blackoutActive = false;
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
    state.traderRefreshCost = 15;
    state.traderRefreshCount = 0;
    state.nightConsumables = { overpressureAmmo: false, reactiveArmor: false };
    state.agentRecruitProgress = 0;
    state.statsEpoch = 1;
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
    state.previewPaths = [];
    state.breachMarkers = [];
    state.reconNightFadeTimer = 0;
    state.reconFlashTimer = 0;

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

    G.recalculateBaseStats(true);
    state.cozyTierUpTimer = 0;
    state.power = state.powerCap;
    G.generateWaveIntel(state.wave);
    recomputeFlow(false);
    G.refreshTraderOffers(false);
    saveGame();
    notifyUi();
  }

  function getSideEntryTile(side, idx) {
    if (side === 0) return { x: idx, y: 0 };
    if (side === 1) return { x: N - 1, y: idx };
    if (side === 2) return { x: idx, y: N - 1 };
    return { x: 0, y: idx };
  }

  function computeWaveSideProfile(waveNum) {
    const weights = [0, 0, 0, 0];
    const kinds = ['none', 'none', 'none', 'none'];
    let pattern = 'single';
    let patternLabel = '단일 정면 침공';
    let bossSide = null;

    if (waveNum >= 10 || waveNum % 5 === 0) {
      pattern = 'siege';
      patternLabel = '전방위 포위';
      const first = Math.floor(Math.random() * 4);
      const second = (first + 1 + Math.floor(Math.random() * 3)) % 4;
      for (let s = 0; s < 4; s++) {
        if (s === first || s === second) {
          weights[s] = 0.35;
          kinds[s] = 'main';
        } else {
          weights[s] = 0.15;
          kinds[s] = 'sub';
        }
      }
      if (waveNum % 5 === 0) {
        bossSide = first;
        kinds[bossSide] = 'boss';
      }
    } else if (waveNum >= 6) {
      pattern = 'dual';
      patternLabel = '양면 협공';
      const first = Math.floor(Math.random() * 4);
      const second = (first + 1 + Math.floor(Math.random() * 3)) % 4;
      for (let s = 0; s < 4; s++) {
        if (s === first || s === second) {
          weights[s] = 0.45;
          kinds[s] = 'main';
        } else {
          weights[s] = 0.05;
          kinds[s] = 'min';
        }
      }
    } else if (waveNum >= 3) {
      pattern = 'flank';
      patternLabel = '주력 + 측면 견제';
      const mainSide = Math.floor(Math.random() * 4);
      const subSide = (mainSide + (Math.random() < 0.5 ? 1 : 3)) % 4;
      weights[mainSide] = 0.75;
      kinds[mainSide] = 'main';
      weights[subSide] = 0.25;
      kinds[subSide] = 'sub';
    } else {
      const mainSide = Math.floor(Math.random() * 4);
      weights[mainSide] = 1.0;
      kinds[mainSide] = 'main';
    }

    return { pattern, patternLabel, sideWeights: weights, sideKinds: kinds, bossSide };
  }

  function recomputePreviewPaths(isManualEdit) {
    const intel = state.nextWaveIntel;
    const flow = state.flow;
    if (!intel || !flow || !flow.next) {
      state.previewPaths = [];
      state.breachMarkers = [];
      return;
    }

    const ENTRY_IDX = [5, 11, 16];
    const paths = [];
    const breachMap = Object.create(null);

    for (let sd = 0; sd < 4; sd++) {
      const w = intel.sideWeights ? (intel.sideWeights[sd] || 0) : 0;
      const kind = intel.sideKinds ? intel.sideKinds[sd] : 'none';
      if (w <= 0.05 || kind === 'min' || kind === 'none') continue;

      for (let k = 0; k < ENTRY_IDX.length; k++) {
        const start = getSideEntryTile(sd, ENTRY_IDX[k]);
        let x = start.x;
        let y = start.y;
        const pts = [{ x, y }];
        let breach = null;

        for (let stepIdx = 0; stepIdx < 80; stepIdx++) {
          const step = flow.next[y] && flow.next[y][x];
          if (!step) break;
          x += step.dx;
          y += step.dy;
          if (x < 0 || y < 0 || x >= N || y >= N) break;
          pts.push({ x, y });
          if (!breach && ZS.Pathfinding.isBlocking(state.structGrid, x, y)) {
            breach = { tx: x, ty: y };
            const bKey = x + ',' + y;
            breachMap[bKey] = (breachMap[bKey] || 0) + 1;
          }
          if (Math.abs(x - DATA.HQ_POS.x) + Math.abs(y - DATA.HQ_POS.y) <= 1) break;
        }
        paths.push({ side: sd, kind, pts, breach });
      }
    }

    const breaches = [];
    const bKeys = Object.keys(breachMap);
    for (let i = 0; i < bKeys.length; i++) {
      const parts = bKeys[i].split(',');
      breaches.push({
        tx: Number(parts[0]),
        ty: Number(parts[1]),
        count: breachMap[bKeys[i]]
      });
    }

    state.previewPaths = paths;
    state.breachMarkers = breaches;
    if (isManualEdit && state.phase === 'day') {
      state.reconFlashTimer = 0.30;
    }
  }

  function recomputeFlow(isManualEdit) {
    state.flow = ZS.Pathfinding.computeFlowField(N, DATA.HQ_POS, state.structGrid);
    if (state.nextWaveIntel) {
      recomputePreviewPaths(!!isManualEdit);
    }
  }

  function toggleReconPaths() {
    state.showReconPaths = !state.showReconPaths;
    saveGame();
    notifyUi();
    return state.showReconPaths;
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
        if (!s) continue;
        if (s.uid === uid && s.hp > 0) {
          return { st: s, tx: x, ty: y, isMounted: false, host: null };
        }
        if (s.mounted && s.mounted.uid === uid && s.mounted.hp > 0) {
          return { st: s.mounted, tx: x, ty: y, isMounted: true, host: s };
        }
      }
    }
    return null;
  }

  function applyPromoteCheck(st, def, tx, ty, isMounted, silentBanner) {
    const newRank = computeRankFromXp(st.xp || 0);
    const prevRank = st.rank || 0;
    st.rank = newRank;
    if (newRank > prevRank) {
      invalidateStatsCache();
      const rInfo = getVeterancyRankInfo(newRank);
      st.promoAnimTimer = 0.8;
      if (!silentBanner) {
        if (ZS.Audio.playPromote) ZS.Audio.playPromote();
        else if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
      }
      let extraZ = 0;
      if (isMounted) {
        const host = state.structGrid[ty] && state.structGrid[ty][tx];
        extraZ = host && host.id === 'barricade_wall' && (host.level || 2) >= 3 ? 25 : 15;
      }
      state.projectiles.push({
        kind: 'promo_ring',
        x: tx + 0.5,
        y: ty + 0.5,
        z: 18 + extraZ,
        color: rInfo.color,
        life: 0.8,
        maxLife: 0.8
      });
      G.addFloatingText(tx + 0.5, ty + 0.5, 30 + extraZ, '★ UP', rInfo.color, 14, rInfo.stroke);
      if (!silentBanner && def) {
        banner(`[${G.getStructureDisplayName(st)}] ${rInfo.name} 진급!`, `전투 숙련도 Rank ${newRank} 달성 — 공격력 +${Math.round(rInfo.dmgBonus * 100)}% · 연사 +${Math.round(rInfo.rateBonus * 100)}%`, 'good');
      }
    }
  }

  function awardStructureXp(st, tx, ty, rawXp, isMounted) {
    if (!st || st.id === 'command_hq' || st.hp <= 0 || rawXp <= 0) return;
    const def = DATA.ITEMS[st.id];
    if (!isCombatVeterancyDef(def)) return;

    const cozyXpMult = 1.0 + ((state.cozyTier && state.cozyTier.xpBonus) || 0);
    const gained = rawXp * cozyXpMult;
    st.xp = +((st.xp || 0) + gained).toFixed(3);
    st.kills = (st.kills || 0) + 1;
    const onWall = isMounted !== undefined
      ? !!isMounted
      : !!(state.structGrid[ty] && state.structGrid[ty][tx] && state.structGrid[ty][tx].mounted === st);
    applyPromoteCheck(st, def, tx, ty, onWall, false);
  }

  function awardKillXpBySourceUid(sourceUid, zombieType, isBoss) {
    const xpTable = DATA.ZOMBIE_KILL_XP || { walker: 1.0, runner: 1.5, brute: 4.0, boss: 12.0, bossGlobalBonus: 4.0 };
    if (sourceUid) {
      const found = findStructureByUid(sourceUid);
      if (found) {
        const raw = xpTable[zombieType] || 1.0;
        awardStructureXp(found.st, found.tx, found.ty, raw, found.isMounted);
      }
    }
    // On Boss kill, all surviving manned/turret structures (ground + wall-mounted) receive +4.0 bonus XP
    if (isBoss) {
      const bonus = xpTable.bossGlobalBonus || 4.0;
      const cozyXpMult = 1.0 + ((state.cozyTier && state.cozyTier.xpBonus) || 0);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s || s.id === 'command_hq' || s.hp <= 0) continue;
          const d = DATA.ITEMS[s.id];
          if (isCombatVeterancyDef(d)) {
            s.xp = +((s.xp || 0) + bonus * cozyXpMult).toFixed(3);
            applyPromoteCheck(s, d, x, y, false, true);
          }
          if (s.mounted && s.mounted.hp > 0) {
            const md = DATA.ITEMS[s.mounted.id];
            if (isCombatVeterancyDef(md)) {
              s.mounted.xp = +((s.mounted.xp || 0) + bonus * cozyXpMult).toFixed(3);
              applyPromoteCheck(s.mounted, md, x, y, true, true);
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
      const pt = {
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
      };
      if (G.pushParticle) G.pushParticle(pt);
      else state.particles.push(pt);
    }
  }

  // ================= PERSISTENCE (localStorage) =================
  function saveGame() {
    if (state.phase !== 'day') return;
    try {
      const payload = {
        saveVersion: 2,
        defenseTierV2: true,
        balanceV3: true,
        wave: state.wave,
        hqLevel: state.hqLevel,
        bossDefeated: state.bossDefeated,
        wood: state.wood,
        scrap: state.scrap,
        coin: state.coin,
        power: state.power,
        agents: state.agents,
        debugBonusPopCap: state.debugBonusPopCap || 0,
        showReconPaths: state.showReconPaths !== false,
        nextWaveIntel: state.nextWaveIntel,
        freeVouchers: state.freeVouchers,
        traderOffers: state.traderOffers,
        traderRefreshCost: state.traderRefreshCost || 15,
        traderRefreshCount: state.traderRefreshCount || 0,
        nightConsumables: state.nightConsumables || { overpressureAmmo: false, reactiveArmor: false },
        agentRecruitProgress: state.agentRecruitProgress || 0,
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
      state.blackoutActive = false;
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
      state.traderRefreshCost = Math.max(15, Number(d.traderRefreshCost) || 15);
      state.traderRefreshCount = Math.max(0, Number(d.traderRefreshCount) || 0);
      state.nightConsumables = {
        overpressureAmmo: !!(d.nightConsumables && d.nightConsumables.overpressureAmmo),
        reactiveArmor: !!(d.nightConsumables && d.nightConsumables.reactiveArmor)
      };
      state.agentRecruitProgress = Math.max(0, Number(d.agentRecruitProgress) || 0);
      invalidateStatsCache();
      const saveVersion = Number(d.saveVersion || 1);
      const isLegacyV1 = saveVersion < 2;
      const needsDefenseMigration = isLegacyV1 || !d.defenseTierV2;
      let migratedWalls = false;
      let migratedV2 = false;
      if (state.freeVouchers.hesco_wall || state.freeVouchers.blast_wall) {
        state.freeVouchers.barricade_wall =
          (state.freeVouchers.barricade_wall || 0) +
          (state.freeVouchers.hesco_wall || 0) +
          (state.freeVouchers.blast_wall || 0);
        delete state.freeVouchers.hesco_wall;
        delete state.freeVouchers.blast_wall;
        migratedWalls = true;
      }
      state.floorGrid = nextFloorGrid;
      state.structGrid = nextStructGrid;

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s) continue;
          if (s.id === 'hesco_wall') {
            s.id = 'barricade_wall';
            s.level = Math.max(2, s.level || 1);
            migratedWalls = true;
          } else if (s.id === 'blast_wall') {
            s.id = 'barricade_wall';
            s.level = 3;
            migratedWalls = true;
          } else if (s.id === 'shelter_pod') {
            const oldLv = s.level || 1;
            s.id = 'field_tent';
            s.level = oldLv >= 2 ? 4 : 3;
            migratedV2 = true;
          } else if (isLegacyV1) {
            if (s.id === 'solar_array' || s.id === 'battery_bank') {
              s.level = Math.min(4, (s.level || 1) + 1);
              migratedV2 = true;
            } else if (s.id === 'wind_turbine') {
              s.level = (s.level || 1) >= 2 ? 4 : 3;
              migratedV2 = true;
            } else if (s.id === 'field_tent') {
              s.level = Math.min(3, Math.max(1, s.level || 1));
              migratedV2 = true;
            }
          }
          if (needsDefenseMigration) {
            if (s.id === 'tactical_gate') {
              s.level = (s.level || 1) >= 2 ? 3 : 2;
              migratedV2 = true;
            } else if (s.id === 'razor_pad') {
              s.level = Math.max(1, Math.min(3, s.level || 1));
              migratedV2 = true;
            } else if (s.id === 'repair_bay') {
              s.level = (s.level || 1) >= 2 ? Math.min(3, s.level) : 2;
              migratedV2 = true;
            }
          }
          if (!s.level) s.level = s.id === 'command_hq' ? state.hqLevel : 1;
          if (s.id !== 'command_hq') {
            if (!s.uid) s.uid = G.nextStructUid++;
            else if (s.uid >= G.nextStructUid) G.nextStructUid = s.uid + 1;
            s.xp = s.xp || 0;
            s.rank = computeRankFromXp(s.xp);
          }
          s.buildAnimTimer = 0;
          s.hitFlashTimer = 0;
          s.hitFlash = 0;
          s.upgradeAnimTimer = 0;
          s.promoAnimTimer = 0;
          s.fallAnimTimer = 0;
          if (s.mounted) {
            if (!s.mounted.level) s.mounted.level = 1;
            if (!s.mounted.uid) s.mounted.uid = G.nextStructUid++;
            else if (s.mounted.uid >= G.nextStructUid) G.nextStructUid = s.mounted.uid + 1;
            s.mounted.xp = s.mounted.xp || 0;
            s.mounted.rank = computeRankFromXp(s.mounted.xp);
            s.mounted.buildAnimTimer = 0;
            s.mounted.hitFlashTimer = 0;
            s.mounted.hitFlash = 0;
            s.mounted.upgradeAnimTimer = 0;
            s.mounted.promoAnimTimer = 0;
            s.mounted.fallAnimTimer = 0;
          }
        }
      }

      G.recalculateBaseStats(true);
      state.cozyTierUpTimer = 0;
      state.power = d.power ?? state.powerCap;
      state.showReconPaths = d.showReconPaths !== undefined ? !!d.showReconPaths : true;
      state.reconNightFadeTimer = 0;
      state.reconFlashTimer = 0;
      if (d.nextWaveIntel && d.nextWaveIntel.wave === state.wave && Array.isArray(d.nextWaveIntel.plannedQueue)) {
        state.nextWaveIntel = d.nextWaveIntel;
      } else {
        G.generateWaveIntel(state.wave);
      }
      recomputeFlow(false);
      if (Array.isArray(d.traderOffers) && d.traderOffers.length > 0) {
        const poolMap = {};
        if (Array.isArray(DATA.TRADER_POOL)) {
          for (let i = 0; i < DATA.TRADER_POOL.length; i++) {
            poolMap[DATA.TRADER_POOL[i].id] = DATA.TRADER_POOL[i];
          }
        }
        state.traderOffers = d.traderOffers.map((offer) => {
          if (!offer) return offer;
          if (offer.id === 'crate_pod' || offer.itemId === 'shelter_pod') {
            migratedV2 = true;
            const latest = poolMap.crate_pod;
            if (latest) {
              return { ...offer, ...latest, purchased: !!offer.purchased };
            }
            return { ...offer, itemId: 'field_tent', spawnTier: 3, voucherKey: 'shelter_pod' };
          }
          return offer;
        });
      } else {
        G.refreshTraderOffers(false);
      }
      if (offset > 0 || migratedWalls || isLegacyV1 || needsDefenseMigration || migratedV2) saveGame();
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
    if (state.power > 0.01 || (state.isNight && !state.blackoutActive)) {
      state.power = 0;
      if (state.isNight) {
        G.enterBlackout();
      } else {
        ZS.Audio.playBlackout();
        banner('[DEBUG] 전력 강제 방전 (0)', '블랙아웃 테스트를 위해 배터리를 0으로 방전했습니다.', 'warn');
      }
    } else {
      state.power = Math.max(85, state.powerCap);
      state.blackoutActive = false;
      state.blackoutTriggered = false;
      state.blackoutFlickerTimer = 0;
      invalidateStatsCache();
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
    G.recalculateBaseStats(true);
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
    G.generateWaveIntel(state.wave);
    recomputePreviewPaths(false);
    G.refreshTraderOffers(false);
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
    const rawS = state.structGrid[ty] && state.structGrid[ty][tx];
    const s = rawS && rawS.mounted && isCombatVeterancyDef(DATA.ITEMS[rawS.mounted.id]) ? rawS.mounted : rawS;
    const isMounted = !!(rawS && s === rawS.mounted);
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
      applyPromoteCheck(s, def, tx, ty, isMounted, true);
      const rInfo = getVeterancyRankInfo(newRank);
      if (ZS.Audio.playPromote) ZS.Audio.playPromote();
      banner(`[DEBUG] [${def.name}] ${rInfo.name} 진급!`, `숙련도 +${gain} XP 부여 (누적 ${s.xp.toFixed(1)} XP · Rank ${newRank})`, 'good');
    } else {
      ZS.Audio.playBuild();
      banner(`[DEBUG] [${def.name}] +${gain} XP 부여`, `현재 누적 ${s.xp.toFixed(1)} XP (${getVeterancyRankInfo(newRank).name})`, 'good');
    }
    saveGame();
    notifyUi();
    return true;
  }

  Object.assign(G, {
    isScreenShakeEnabled,
    setScreenShakeEnabled,
    toggleScreenShake,
    getEnvInfo,
    getSaveKey,
    setCallbacks,
    invalidateStatsCache,
    notifyUi,
    notifyCombatHud,
    banner,
    getHqLevelInfo,
    createEmptyGrids,
    initNewGame,
    getSideEntryTile,
    computeWaveSideProfile,
    recomputePreviewPaths,
    recomputeFlow,
    toggleReconPaths,
    isCombatVeterancyDef,
    getVeterancyRankInfo,
    computeRankFromXp,
    findStructureByUid,
    applyPromoteCheck,
    awardStructureXp,
    awardKillXpBySourceUid,
    spawnBadgeShatterVfx,
    saveGame,
    loadGame,
    clearSaveAndReset,
    isDebugAllowed,
    debugAddResources,
    debugTogglePower,
    debugAddAgents,
    debugAdvanceWave,
    debugGrantSelectedXp
  });
})();
