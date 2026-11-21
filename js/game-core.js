window.ZS = window.ZS || {};

(function () {
  const PROD_SAVE_KEY = 'outpost_zero_save_v1';
  const DEV_SAVE_KEY = 'outpost_zero_save_dev';
  const PROD_META_KEY = 'outpost_zero_commander_meta_v1';
  const DEV_META_KEY = 'outpost_zero_commander_meta_dev';
  const SETTINGS_KEY = 'outpost_zero_settings_v1';
  const DATA = ZS.DATA;
  const N = DATA.GRID_SIZE;

  const state = {
    divisionId: 'mobile_corps',
    divisionRank1Vouchers: {},
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
    jobs: {
      combat: Math.max(1, DATA.HQ_STATS.startingAgents - 1),
      research: 1,
      prod: 0
    },
    popCap: DATA.HQ_STATS.basePopCap,
    popUsed: 0,
    debugBonusPopCap: 0,
    rp: 0,
    researchedTechs: {},
    undergroundUnlocked: false,
    digAp: 0,
    digApCap: 24,

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
    terrainSeed: 0,
    terrainGrid: [],
    flow: null,
    nextWaveIntel: null,
    previewPaths: [],
    breachMarkers: [],
    showReconPaths: true,
    showWindOverlay: false,
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
    PROD_META_KEY,
    DEV_META_KEY,
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

  function getMetaKey() {
    return getEnvInfo().useDevSave ? DEV_META_KEY : PROD_META_KEY;
  }

  function getDivisionDef(id) {
    const divs = DATA.DIVISIONS || {};
    const key = id || state.divisionId || 'mobile_corps';
    return divs[key] || divs.mobile_corps || { id: 'mobile_corps', name: '기동방위대', unlockedByDefault: true };
  }

  function createDefaultCommanderMeta() {
    const divisions = {};
    const divs = DATA.DIVISIONS || {};
    const order = DATA.DIVISION_ORDER || Object.keys(divs);
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const def = divs[id];
      divisions[id] = {
        unlocked: !!(def && def.unlockedByDefault),
        bestWave: 0,
        cleared: false
      };
    }
    return {
      version: 1,
      lastDivisionId: 'mobile_corps',
      divisions
    };
  }

  function normalizeCommanderMeta(raw) {
    const base = createDefaultCommanderMeta();
    if (!raw || typeof raw !== 'object') return base;
    const rawDivs = raw.divisions && typeof raw.divisions === 'object' ? raw.divisions : {};
    const keys = Object.keys(base.divisions);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      const def = DATA.DIVISIONS && DATA.DIVISIONS[id];
      const rec = rawDivs[id];
      if (rec && typeof rec === 'object') {
        base.divisions[id] = {
          unlocked: !!(def && def.unlockedByDefault) || Boolean(rec.unlocked),
          bestWave: Math.max(0, Math.floor(Number(rec.bestWave) || 0)),
          cleared: Boolean(rec.cleared)
        };
      }
    }
    if (typeof raw.lastDivisionId === 'string' && base.divisions[raw.lastDivisionId] && base.divisions[raw.lastDivisionId].unlocked) {
      base.lastDivisionId = raw.lastDivisionId;
    }
    return base;
  }

  function saveCommanderMeta(meta) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getMetaKey(), JSON.stringify(meta));
      }
    } catch (e) {}
    return meta;
  }

  function getCommanderMeta() {
    try {
      if (typeof localStorage === 'undefined') return createDefaultCommanderMeta();
      const raw = localStorage.getItem(getMetaKey());
      if (!raw) return createDefaultCommanderMeta();
      return normalizeCommanderMeta(JSON.parse(raw));
    } catch (e) {
      return createDefaultCommanderMeta();
    }
  }

  function isDivisionUnlocked(id) {
    const divs = DATA.DIVISIONS || {};
    const def = divs[id];
    if (!def) return false;
    if (def.unlockedByDefault) return true;
    const meta = getCommanderMeta();
    return !!(meta.divisions[id] && meta.divisions[id].unlocked);
  }

  function unlockDivision(id) {
    const divs = DATA.DIVISIONS || {};
    if (!divs[id]) return false;
    const meta = getCommanderMeta();
    const rec = meta.divisions[id] || { unlocked: false, bestWave: 0, cleared: false };
    if (rec.unlocked) return false;
    rec.unlocked = true;
    meta.divisions[id] = rec;
    saveCommanderMeta(meta);
    return true;
  }

  function setLastSelectedDivision(id) {
    const divs = DATA.DIVISIONS || {};
    if (!divs[id]) return;
    const meta = getCommanderMeta();
    if (!meta.divisions[id] || !meta.divisions[id].unlocked) return;
    meta.lastDivisionId = id;
    saveCommanderMeta(meta);
  }

  function recordDivisionProgress(divId, wave, cleared) {
    const id = (DATA.DIVISIONS && DATA.DIVISIONS[divId]) ? divId : (state.divisionId || 'mobile_corps');
    const meta = getCommanderMeta();
    const rec = meta.divisions[id] || { unlocked: isDivisionUnlocked(id), bestWave: 0, cleared: false };
    const waveNum = Math.max(0, Math.floor(Number(wave) || 0));
    if (waveNum > rec.bestWave) rec.bestWave = waveNum;
    if (cleared) rec.cleared = true;
    meta.divisions[id] = rec;
    saveCommanderMeta(meta);
    return rec;
  }

  function isArcOverdriveActive() {
    if (state.divisionId !== 'arc_tech') return false;
    if (state.blackoutActive) return false;
    const thresh = (getDivisionDef('arc_tech').overdriveThreshold != null) ? getDivisionDef('arc_tech').overdriveThreshold : 0.70;
    return state.powerCap > 0 && state.power >= state.powerCap * thresh;
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
        reqWave: 1,
        name: DATA.HQ_STATS.name,
        cost: null,
        maxHp: DATA.HQ_STATS.maxHp,
        basePowerCap: DATA.HQ_STATS.basePowerCap,
        baseDayCharge: DATA.HQ_STATS.baseDayCharge,
        basePopCap: DATA.HQ_STATS.basePopCap,
        baseRpPerScientist: 2,
        structUpgradeCap: 3,
        maxZ: 36,
        hpBarWidth: 38,
        weapon: null,
        globalAura: null
      }
    );
  }

  function normalizeJobs() {
    const totalAgents = Math.max(0, Math.floor(Number(state.agents) || 0));
    const minCombat = Math.min(totalAgents, Math.max(0, Math.floor(Number(state.popUsed) || 0)));
    if (!state.jobs || typeof state.jobs !== 'object') {
      const rDefault = totalAgents > minCombat ? 1 : 0;
      state.jobs = {
        combat: Math.max(minCombat, totalAgents - rDefault),
        research: rDefault,
        prod: 0
      };
    }

    let c = Math.max(0, Math.floor(Number(state.jobs.combat) || 0));
    let r = Math.max(0, Math.floor(Number(state.jobs.research) || 0));
    let p = Math.max(0, Math.floor(Number(state.jobs.prod) || 0));

    let sum = c + r + p;
    if (sum > totalAgents) {
      let excess = sum - totalAgents;
      const takeP = Math.min(p, excess);
      p -= takeP;
      excess -= takeP;
      if (excess > 0) {
        const takeR = Math.min(r, excess);
        r -= takeR;
        excess -= takeR;
      }
      if (excess > 0) {
        const takeC = Math.min(c, excess);
        c -= takeC;
        excess -= takeC;
      }
    }

    if (c < minCombat) {
      let need = minCombat - c;
      const unassigned = Math.max(0, totalAgents - (c + r + p));
      const fromUn = Math.min(unassigned, need);
      c += fromUn;
      need -= fromUn;
      if (need > 0) {
        const fromP = Math.min(p, need);
        p -= fromP;
        c += fromP;
        need -= fromP;
      }
      if (need > 0) {
        const fromR = Math.min(r, need);
        r -= fromR;
        c += fromR;
        need -= fromR;
      }
    }

    state.jobs = { combat: c, research: r, prod: p };
    return state.jobs;
  }

  function grantAgents(count) {
    const add = Math.max(0, Math.floor(Number(count) || 0));
    if (add <= 0) return 0;
    normalizeJobs();
    state.agents += add;
    let rem = add;
    if ((state.jobs.research || 0) === 0 && rem > 0) {
      state.jobs.research = 1;
      rem -= 1;
    }
    if (rem > 0) {
      state.jobs.combat = (state.jobs.combat || 0) + rem;
    }
    normalizeJobs();
    return add;
  }

  function adjustJob(role, delta) {
    if (role !== 'combat' && role !== 'research' && role !== 'prod') return false;
    if (state.phase === 'gameover') return false;
    const rawDelta = Math.trunc(Number(delta) || 0);
    if (rawDelta === 0) return false;

    normalizeJobs();
    const steps = Math.abs(rawDelta);
    const sign = rawDelta > 0 ? 1 : -1;
    let changed = false;

    for (let s = 0; s < steps; s++) {
      if (sign < 0) {
        if (role === 'combat' && state.jobs.combat <= (state.popUsed || 0)) {
          ZS.Audio.playError();
          banner('전투요원 감원 불가', '초소에 배치된 전투요원(' + state.popUsed + '명) 미만으로 줄일 수 없습니다.', 'warn');
          break;
        }
        if ((state.jobs[role] || 0) <= 0) break;
        state.jobs[role] -= 1;
        changed = true;
      } else {
        const used = (state.jobs.combat || 0) + (state.jobs.research || 0) + (state.jobs.prod || 0);
        const unassigned = state.agents - used;
        if (unassigned > 0) {
          state.jobs[role] += 1;
          changed = true;
        } else {
          const donorOrder = ['prod', 'combat', 'research'];
          let donor = null;
          for (let i = 0; i < donorOrder.length; i++) {
            const dRole = donorOrder[i];
            if (dRole === role) continue;
            const hasSpare = dRole === 'combat'
              ? state.jobs.combat > (state.popUsed || 0)
              : (state.jobs[dRole] || 0) > 0;
            if (hasSpare) {
              donor = dRole;
              break;
            }
          }
          if (!donor) break;
          state.jobs[donor] -= 1;
          state.jobs[role] += 1;
          changed = true;
        }
      }
    }

    if (!changed) return false;
    normalizeJobs();
    if (G.recalculateBaseStats) G.recalculateBaseStats(true);
    saveGame();
    notifyUi();
    return true;
  }

  function createEmptyGrids() {
    state.floorGrid = Array.from({ length: N }, () => Array(N).fill(null));
    state.structGrid = Array.from({ length: N }, () => Array(N).fill(null));
    state.terrainGrid = Array.from({ length: N }, () => Array(N).fill(null));
  }

  function getTerrainAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return null;
    const g = state.terrainGrid;
    return (g && g[ty] && g[ty][tx]) || null;
  }

  function getTerrainElevationAt(gx, gy) {
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return 0;
    const t = state.terrainGrid && state.terrainGrid[ty] && state.terrainGrid[ty][tx];
    if (!t) return 0;
    const plateauZ = DATA.PLATEAU_ELEV_Z || 10;
    if (t.kind === 'plateau') return t.elev != null ? t.elev : plateauZ;
    if (t.kind === 'ramp' && t.rampDir) {
      const fx = Math.max(0, Math.min(1, gx - tx));
      const fy = Math.max(0, Math.min(1, gy - ty));
      const dx = t.rampDir.dx;
      const dy = t.rampDir.dy;
      let u = 0.5;
      if (dx === 1) u = fx;
      else if (dx === -1) u = 1 - fx;
      else if (dy === 1) u = fy;
      else if (dy === -1) u = 1 - fy;
      return u * plateauZ;
    }
    return 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWithRng(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function isInsideHqSafeZone(x, y) {
    return Math.abs(x - DATA.HQ_POS.x) <= 2 && Math.abs(y - DATA.HQ_POS.y) <= 2;
  }

  function isInsideInnerTerrainBounds(x, y) {
    return x >= 2 && x <= N - 3 && y >= 2 && y <= N - 3;
  }

  function findFirstPeakOnSegment(x0, y0, x1, y1, ignoreTx, ignoreTy) {
    const tGrid = state.terrainGrid;
    if (!tGrid) return null;
    let cx = Math.floor(x0);
    let cy = Math.floor(y0);
    const endX = Math.floor(x1);
    const endY = Math.floor(y1);
    const skipX = ignoreTx !== undefined ? ignoreTx : cx;
    const skipY = ignoreTy !== undefined ? ignoreTy : cy;

    if (cx === endX && cy === endY) {
      if (!(cx === skipX && cy === skipY) && cx >= 0 && cy >= 0 && cx < N && cy < N) {
        const t = tGrid[cy] && tGrid[cy][cx];
        if (t && t.kind === 'rock' && t.isPeak) return { tx: cx, ty: cy };
      }
      return null;
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 1e-8 ? 1 : dx < -1e-8 ? -1 : 0;
    const stepY = dy > 1e-8 ? 1 : dy < -1e-8 ? -1 : 0;
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : 1e9;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : 1e9;

    let tMaxX = 1e9;
    if (stepX > 0) tMaxX = (cx + 1 - x0) * tDeltaX;
    else if (stepX < 0) {
      const dist = x0 - cx;
      tMaxX = (dist > 1e-7 ? dist : 1) * tDeltaX;
    }
    let tMaxY = 1e9;
    if (stepY > 0) tMaxY = (cy + 1 - y0) * tDeltaY;
    else if (stepY < 0) {
      const dist = y0 - cy;
      tMaxY = (dist > 1e-7 ? dist : 1) * tDeltaY;
    }

    const maxSteps = N * 3;
    for (let s = 0; s < maxSteps; s++) {
      if (!(cx === skipX && cy === skipY) && cx >= 0 && cy >= 0 && cx < N && cy < N) {
        const t = tGrid[cy] && tGrid[cy][cx];
        if (t && t.kind === 'rock' && t.isPeak) {
          return { tx: cx, ty: cy };
        }
      }
      if (cx === endX && cy === endY) break;
      if (tMaxX > 1.0001 && tMaxY > 1.0001) break;
      if (tMaxX < tMaxY) {
        cx += stepX;
        tMaxX += tDeltaX;
      } else {
        cy += stepY;
        tMaxY += tDeltaY;
      }
    }
    return null;
  }

  function hasDirectLineOfSight(x0, y0, x1, y1) {
    return !findFirstPeakOnSegment(x0, y0, x1, y1);
  }

  function rotatePlateauTemplate(rawCells, rotIdx, flipX) {
    let minX = 1e9;
    let minY = 1e9;
    const pts = [];
    for (let i = 0; i < rawCells.length; i++) {
      let x = rawCells[i][0];
      let y = rawCells[i][1];
      if (flipX) x = -x;
      let rx = x;
      let ry = y;
      if (rotIdx === 1) { rx = -y; ry = x; }
      else if (rotIdx === 2) { rx = -x; ry = -y; }
      else if (rotIdx === 3) { rx = y; ry = -x; }
      if (rx < minX) minX = rx;
      if (ry < minY) minY = ry;
      pts.push([rx, ry]);
    }
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < pts.length; i++) {
      pts[i][0] -= minX;
      pts[i][1] -= minY;
      if (pts[i][0] > maxX) maxX = pts[i][0];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    return { cells: pts, bw: maxX + 1, bh: maxY + 1 };
  }

  function generateProceduralTerrain(seed) {
    const rng = mulberry32(seed);
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    const hx = DATA.HQ_POS.x;
    const hy = DATA.HQ_POS.y;
    const plateauElev = DATA.PLATEAU_ELEV_Z || 10;
    const rampElev = DATA.RAMP_ELEV_Z || 5;
    const card = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const rampEntries = new Set();
    const placedPlateauCells = [];
    const targetPlateaus = rng() < 0.55 ? 3 : 2;
    const organicShapes = [
      [[0, 0], [1, 0], [0, 1]],                 // 3-tile L
      [[0, 0], [1, 0], [2, 0], [0, 1]],         // 4-tile L
      [[0, 0], [1, 0], [1, 1], [2, 1]],         // 4-tile stepped Z
      [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]]  // 5-tile P / stepped block
    ];
    const rectShapes = [
      [[0, 0], [1, 0], [0, 1], [1, 1]],                 // 2x2
      [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]  // 3x2
    ];

    for (let p = 0; p < targetPlateaus; p++) {
      let placed = false;
      for (let tries = 0; tries < 160; tries++) {
        // Ensure at least the first plateau is an asymmetric L / stepped silhouette
        const useOrganic = p === 0 ? true : rng() < 0.65;
        const pool = useOrganic ? organicShapes : rectShapes;
        const rawShape = pool[Math.floor(rng() * pool.length)];
        const shaped = rotatePlateauTemplate(rawShape, Math.floor(rng() * 4), rng() < 0.5);
        const bw = shaped.bw;
        const bh = shaped.bh;
        const minC = 3;
        const maxCx = N - 4 - bw + 1;
        const maxCy = N - 4 - bh + 1;
        if (maxCx < minC || maxCy < minC) continue;
        const px = minC + Math.floor(rng() * (maxCx - minC + 1));
        const py = minC + Math.floor(rng() * (maxCy - minC + 1));

        const worldCells = [];
        const shapeSet = new Set();
        let hitsHqOrOverlap = false;
        for (let ci = 0; ci < shaped.cells.length; ci++) {
          const xx = px + shaped.cells[ci][0];
          const yy = py + shaped.cells[ci][1];
          // At least 1 flat tile gap from HQ 5x5 ([11..15]) -> keep clear of [10..16]
          if (Math.abs(xx - hx) <= 3 && Math.abs(yy - hy) <= 3) {
            hitsHqOrOverlap = true;
            break;
          }
          if (grid[yy][xx] || rampEntries.has(xx + ',' + yy)) {
            hitsHqOrOverlap = true;
            break;
          }
          for (let oi = 0; oi < placedPlateauCells.length; oi++) {
            const o = placedPlateauCells[oi];
            if (Math.max(Math.abs(xx - o[0]), Math.abs(yy - o[1])) <= 2) {
              hitsHqOrOverlap = true;
              break;
            }
          }
          if (hitsHqOrOverlap) break;
          // Ensure no adjacent cell already holds a plateau or ramp
          for (let k = 0; k < 4; k++) {
            const nx = xx + card[k][0];
            const ny = yy + card[k][1];
            const nt = grid[ny] && grid[ny][nx];
            if (nt && (nt.kind === 'plateau' || nt.kind === 'ramp')) {
              hitsHqOrOverlap = true;
              break;
            }
          }
          if (hitsHqOrOverlap) break;
          worldCells.push([xx, yy]);
          shapeSet.add(xx + ',' + yy);
        }
        if (hitsHqOrOverlap) continue;

        // Collect cardinal ramp attachment slots along outer boundary of arbitrary shape
        const candidates = [];
        const candSeen = new Set();
        for (let ci = 0; ci < worldCells.length; ci++) {
          const xx = worldCells[ci][0];
          const yy = worldCells[ci][1];
          for (let k = 0; k < 4; k++) {
            const odx = card[k][0];
            const ody = card[k][1];
            const rx = xx + odx;
            const ry = yy + ody;
            const dx = -odx;
            const dy = -ody;
            const key = rx + ',' + ry + ',' + dx + ',' + dy;
            if (candSeen.has(key) || shapeSet.has(rx + ',' + ry)) continue;
            candSeen.add(key);
            candidates.push({ rx, ry, dx, dy, ex: rx - dx, ey: ry - dy });
          }
        }

        const validRamps = candidates.filter((c) => {
          if (!isInsideInnerTerrainBounds(c.rx, c.ry) || isInsideHqSafeZone(c.rx, c.ry)) return false;
          if (!isInsideInnerTerrainBounds(c.ex, c.ey) || isInsideHqSafeZone(c.ex, c.ey)) return false;
          if (grid[c.ry][c.rx] || grid[c.ey][c.ex]) return false;
          if (shapeSet.has(c.ex + ',' + c.ey)) return false;
          if (rampEntries.has(c.rx + ',' + c.ry) || rampEntries.has(c.ex + ',' + c.ey)) return false;
          // Ensure ramp touches ONLY its target plateau cell (rx + dx, ry + dy), no other plateau/ramp laterally or behind
          for (let k = 0; k < 4; k++) {
            const nx = c.rx + card[k][0];
            const ny = c.ry + card[k][1];
            if (nx === c.rx + c.dx && ny === c.ry + c.dy) continue;
            if (shapeSet.has(nx + ',' + ny)) return false;
            const nt = grid[ny] && grid[ny][nx];
            if (nt && (nt.kind === 'plateau' || nt.kind === 'ramp')) return false;
          }
          // Ensure flat ramp entry doesn't abut another plateau or ramp
          for (let k = 0; k < 4; k++) {
            const nx = c.ex + card[k][0];
            const ny = c.ey + card[k][1];
            if (nx === c.rx && ny === c.ry) continue;
            if (shapeSet.has(nx + ',' + ny)) return false;
            const nt = grid[ny] && grid[ny][nx];
            if (nt && (nt.kind === 'plateau' || nt.kind === 'ramp')) return false;
          }
          return true;
        });

        if (validRamps.length === 0) continue;

        for (let ci = 0; ci < worldCells.length; ci++) {
          const xx = worldCells[ci][0];
          const yy = worldCells[ci][1];
          grid[yy][xx] = {
            kind: 'plateau',
            elev: plateauElev,
            variant: (xx * 7 + yy * 13) & 3
          };
          placedPlateauCells.push([xx, yy]);
        }

        shuffleWithRng(validRamps, rng);
        const wantRamps = rng() < 0.60 ? 2 : 1;
        const chosen = [];
        for (let k = 0; k < validRamps.length && chosen.length < wantRamps; k++) {
          const c = validRamps[k];
          let conflicts = false;
          for (let m = 0; m < chosen.length; m++) {
            const prev = chosen[m];
            if (Math.abs(c.rx - prev.rx) + Math.abs(c.ry - prev.ry) <= 1) {
              conflicts = true;
              break;
            }
            if ((c.rx === prev.ex && c.ry === prev.ey) || (c.ex === prev.rx && c.ey === prev.ry) || (c.ex === prev.ex && c.ey === prev.ey)) {
              conflicts = true;
              break;
            }
          }
          if (!conflicts) chosen.push(c);
        }
        for (let k = 0; k < chosen.length; k++) {
          const c = chosen[k];
          grid[c.ry][c.rx] = {
            kind: 'ramp',
            elev: rampElev,
            rampDir: { dx: c.dx, dy: c.dy },
            variant: (c.rx * 5 + c.ry * 11) & 3
          };
          rampEntries.add(c.ex + ',' + c.ey);
        }
        placed = true;
        break;
      }
      if (!placed && p < 2) return null;
    }

    // 2) Rocks: 5~6 abundant mountain ridges (4~7 connected tiles, interior isPeak: true crags) + 2~3 foothill clusters
    const ridgeCount = rng() < 0.55 ? 5 : 6;
    const ridgeSizes = [];
    for (let i = 0; i < ridgeCount; i++) {
      const maxAdd = i < 2 ? 4 : 3;
      ridgeSizes.push(4 + Math.floor(rng() * maxAdd));
    }
    const clusterCount = rng() < 0.5 ? 2 : 3;
    const clusterSizes = [];
    for (let i = 0; i < clusterCount; i++) {
      clusterSizes.push(2 + (rng() < 0.45 ? 1 : 0));
    }

    const rockClusterIdGrid = Array.from({ length: N }, () => Array(N).fill(-1));
    const isValidRockCell = (x, y, groupIdx) => {
      if (!isInsideInnerTerrainBounds(x, y) || isInsideHqSafeZone(x, y)) return false;
      if (grid[y][x]) return false;
      if (rampEntries.has(x + ',' + y)) return false;
      for (let k = 0; k < 4; k++) {
        const nx = x + card[k][0];
        const ny = y + card[k][1];
        const nt = grid[ny] && grid[ny][nx];
        if (nt && nt.kind === 'ramp') return false;
        const otherCid = rockClusterIdGrid[ny] && rockClusterIdGrid[ny][nx];
        if (otherCid >= 0 && otherCid !== groupIdx) return false;
      }
      return true;
    };
    const isValidRidgeCell = (x, y, groupIdx) =>
      isValidRockCell(x, y, groupIdx) && !(Math.abs(x - hx) <= 3 && Math.abs(y - hy) <= 3);

    const isInQuadrant = (x, y, qIdx) => {
      if (qIdx === 0) return x < hx && y < hy;
      if (qIdx === 1) return x >= hx && y < hy;
      if (qIdx === 2) return x < hx && y >= hy;
      return x >= hx && y >= hy;
    };
    const quadOrder = shuffleWithRng([0, 1, 2, 3], rng).concat(shuffleWithRng([0, 1, 2, 3], rng));

    const rockTopLow = DATA.ROCK_TOP_Z || 16;
    const rockTopPeak = DATA.ROCK_PEAK_TOP_Z || 33;
    let rockTilesPlaced = 0;
    let totalPeaksPlaced = 0;
    let groupIdSeq = 0;
    const placedRidges = [];

    // 2a) Place 5~6 mountain ridges (elongated 4~7-tile chains with dense interior isPeak: true crags)
    for (let rIdx = 0; rIdx < ridgeCount; rIdx++) {
      const wantSz = ridgeSizes[rIdx];
      const gId = groupIdSeq++;
      const targetQuad = quadOrder[rIdx];
      let ridgeCells = null;
      for (let tries = 0; tries < 220; tries++) {
        const sx = 2 + Math.floor(rng() * (N - 4));
        const sy = 2 + Math.floor(rng() * (N - 4));
        if (tries < 120 && !isInQuadrant(sx, sy, targetQuad)) continue;
        if (!isValidRidgeCell(sx, sy, gId)) continue;
        const chain = [[sx, sy]];
        rockClusterIdGrid[sy][sx] = gId;
        let lastDir = card[Math.floor(rng() * 4)];
        while (chain.length < wantSz) {
          const tail = chain[chain.length - 1];
          const opts = [];
          for (let k = 0; k < 4; k++) {
            const nx = tail[0] + card[k][0];
            const ny = tail[1] + card[k][1];
            if (!isValidRidgeCell(nx, ny, gId) || rockClusterIdGrid[ny][nx] === gId) continue;
            // Prevent folding back into a 2x2 clump: only 1 cardinal link back into current chain
            let adjInChain = 0;
            for (let m = 0; m < 4; m++) {
              const cx = nx + card[m][0];
              const cy = ny + card[m][1];
              if (rockClusterIdGrid[cy] && rockClusterIdGrid[cy][cx] === gId) adjInChain += 1;
            }
            if (adjInChain !== 1) continue;
            const dot = card[k][0] * lastDir[0] + card[k][1] * lastDir[1];
            const w = dot > 0 ? 4 : dot === 0 ? 2 : 0;
            for (let wi = 0; wi < w; wi++) opts.push({ nx, ny, dir: card[k] });
          }
          if (opts.length === 0) break;
          const pick = opts[Math.floor(rng() * opts.length)];
          chain.push([pick.nx, pick.ny]);
          rockClusterIdGrid[pick.ny][pick.nx] = gId;
          lastDir = pick.dir;
        }
        if (chain.length === wantSz) {
          ridgeCells = chain;
          break;
        }
        for (let ci = 0; ci < chain.length; ci++) {
          rockClusterIdGrid[chain[ci][1]][chain[ci][0]] = -1;
        }
      }
      if (!ridgeCells) return null;

      const peakIndices = new Set();
      for (let pi = 1; pi <= wantSz - 2; pi++) {
        peakIndices.add(pi);
      }
      if (wantSz === 4 && rng() < 0.5) {
        peakIndices.add(rng() < 0.5 ? 0 : 3);
      }

      const peakCells = [];
      for (let ci = 0; ci < ridgeCells.length; ci++) {
        const rx = ridgeCells[ci][0];
        const ry = ridgeCells[ci][1];
        const isPeak = peakIndices.has(ci);
        grid[ry][rx] = {
          kind: 'rock',
          elev: 0,
          isPeak,
          topZ: isPeak ? rockTopPeak : rockTopLow,
          variant: Math.floor(rng() * 8),
          flip: rng() < 0.5 ? 1 : 0
        };
        rockTilesPlaced += 1;
        if (isPeak) {
          totalPeaksPlaced += 1;
          peakCells.push([rx, ry]);
        }
      }
      placedRidges.push({ cells: ridgeCells, peakCells });
    }

    // 2b) Place 2~3 foothill rock clusters (isPeak: false)
    let foothillClustersPlaced = 0;
    for (let cIdx = 0; cIdx < clusterCount; cIdx++) {
      const wantSz = clusterSizes[cIdx];
      const gId = groupIdSeq++;
      let clusterCells = null;
      for (let tries = 0; tries < 120; tries++) {
        const sx = 2 + Math.floor(rng() * (N - 4));
        const sy = 2 + Math.floor(rng() * (N - 4));
        if (!isValidRockCell(sx, sy, gId)) continue;
        const cells = [[sx, sy]];
        const seen = new Set([sx + ',' + sy]);
        rockClusterIdGrid[sy][sx] = gId;
        let stuck = false;
        while (cells.length < wantSz && !stuck) {
          const frontier = [];
          for (let ci = 0; ci < cells.length; ci++) {
            for (let k = 0; k < 4; k++) {
              const nx = cells[ci][0] + card[k][0];
              const ny = cells[ci][1] + card[k][1];
              const key = nx + ',' + ny;
              if (seen.has(key)) continue;
              if (isValidRockCell(nx, ny, gId)) {
                frontier.push([nx, ny]);
                seen.add(key);
              }
            }
          }
          if (frontier.length === 0) {
            stuck = true;
          } else {
            const pick = frontier[Math.floor(rng() * frontier.length)];
            cells.push(pick);
            rockClusterIdGrid[pick[1]][pick[0]] = gId;
          }
        }
        if (cells.length === wantSz) {
          clusterCells = cells;
          break;
        }
        for (let ci = 0; ci < cells.length; ci++) {
          rockClusterIdGrid[cells[ci][1]][cells[ci][0]] = -1;
        }
      }
      if (!clusterCells) return null;
      for (let ci = 0; ci < clusterCells.length; ci++) {
        const rx = clusterCells[ci][0];
        const ry = clusterCells[ci][1];
        grid[ry][rx] = {
          kind: 'rock',
          elev: 0,
          isPeak: false,
          topZ: rockTopLow,
          variant: Math.floor(rng() * 8),
          flip: rng() < 0.5 ? 1 : 0
        };
        rockTilesPlaced += 1;
      }
      foothillClustersPlaced += 1;
    }

    if (
      placedRidges.length < 5 ||
      totalPeaksPlaced < 13 ||
      rockTilesPlaced < 26 ||
      rockTilesPlaced > 45 ||
      foothillClustersPlaced < 2 ||
      foothillClustersPlaced > 3
    ) {
      return null;
    }

    // 3) Single Mountain-Anchored Strong Wind Zone (10~16 connected flat tiles wrapping along a mountain ridge)
    const wzCfg = DATA.WIND_ZONE || {};
    const minWindTiles = wzCfg.minTiles || 10;
    const maxWindTiles = wzCfg.maxTiles || 16;
    const targetWindTiles = minWindTiles + Math.floor(rng() * (maxWindTiles - minWindTiles + 1));
    const isValidWindCell = (wx, wy) =>
      isInsideInnerTerrainBounds(wx, wy) &&
      !isInsideHqSafeZone(wx, wy) &&
      !grid[wy][wx] &&
      !rampEntries.has(wx + ',' + wy);

    const minChebToCells = (x, y, arr) => {
      let best = 1e9;
      for (let i = 0; i < arr.length; i++) {
        const d = Math.max(Math.abs(x - arr[i][0]), Math.abs(y - arr[i][1]));
        if (d < best) best = d;
      }
      return best;
    };
    const minHypotToCells = (x, y, arr) => {
      let best = 1e9;
      for (let i = 0; i < arr.length; i++) {
        const d = Math.hypot(x - arr[i][0], y - arr[i][1]);
        if (d < best) best = d;
      }
      return best;
    };

    const shuffledRidges = shuffleWithRng(placedRidges.slice(), rng);
    const preferredRidges = [];
    const fallbackRidges = [];
    for (let i = 0; i < shuffledRidges.length; i++) {
      const r = shuffledRidges[i];
      let sx = 0;
      let sy = 0;
      for (let ci = 0; ci < r.cells.length; ci++) {
        sx += r.cells[ci][0];
        sy += r.cells[ci][1];
      }
      const distHq = Math.hypot(sx / r.cells.length - hx, sy / r.cells.length - hy);
      if (distHq >= 5.0 && distHq <= 11.5) preferredRidges.push(r);
      else fallbackRidges.push(r);
    }
    const orderedRidges = preferredRidges.concat(fallbackRidges);
    const cardDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    let chosenWind = null;
    let chosenRidge = null;
    let chosenWindAngle = 0;
    for (let rIdx = 0; rIdx < orderedRidges.length && !chosenWind; rIdx++) {
      const R = orderedRidges[rIdx];
      let baseAng = Math.atan2(
        R.cells[R.cells.length - 1][1] - R.cells[0][1],
        R.cells[R.cells.length - 1][0] - R.cells[0][0]
      );
      if (rng() < 0.5) baseAng += Math.PI;
      const ridgeWindAngle = baseAng + (rng() - 0.5) * 0.45;
      const dirCos = Math.cos(ridgeWindAngle);
      const dirSin = Math.sin(ridgeWindAngle);

      const ridgeSeeds = [];
      for (let y = 2; y <= N - 3; y++) {
        for (let x = 2; x <= N - 3; x++) {
          if (isValidWindCell(x, y) && minChebToCells(x, y, R.peakCells) === 1) {
            ridgeSeeds.push({ x, y });
          }
        }
      }
      shuffleWithRng(ridgeSeeds, rng);

      let bestFallback = null;
      const maxSeedTries = Math.min(16, ridgeSeeds.length);
      for (let sIdx = 0; sIdx < maxSeedTries; sIdx++) {
        const root = ridgeSeeds[sIdx];
        const cells = [{ x: root.x, y: root.y }];
        const inSet = new Set([root.x + ',' + root.y]);
        while (cells.length < targetWindTiles) {
          const frontier = [];
          const seenFront = new Set();
          for (let ci = 0; ci < cells.length; ci++) {
            const c = cells[ci];
            for (let k = 0; k < cardDirs.length; k++) {
              const nx = c.x + cardDirs[k][0];
              const ny = c.y + cardDirs[k][1];
              const key = nx + ',' + ny;
              if (inSet.has(key) || seenFront.has(key) || !isValidWindCell(nx, ny)) continue;
              if (minHypotToCells(nx, ny, R.cells) > 4.2) continue;
              seenFront.add(key);
              let nCount = 0;
              for (let m = 0; m < cardDirs.length; m++) {
                if (inSet.has((nx + cardDirs[m][0]) + ',' + (ny + cardDirs[m][1]))) nCount++;
              }
              const dPeak = minHypotToCells(nx, ny, R.peakCells);
              const mtnAffinity = Math.max(0, 3.6 - dPeak) * 0.95;
              const dx = nx - root.x;
              const dy = ny - root.y;
              const align = Math.abs(dx * dirCos + dy * dirSin) * 0.40 - Math.abs(dx * dirSin - dy * dirCos) * 0.25;
              const score = nCount * 1.15 + mtnAffinity + align + rng() * 1.15;
              frontier.push({ x: nx, y: ny, score });
            }
          }
          if (frontier.length === 0) break;
          frontier.sort((a, b) => b.score - a.score);
          const pickPool = Math.min(3, frontier.length);
          const chosen = frontier[Math.floor(rng() * pickPool)];
          cells.push({ x: chosen.x, y: chosen.y });
          inSet.add(chosen.x + ',' + chosen.y);
        }
        if (cells.length >= minWindTiles) {
          let adjPeakCount = 0;
          let adjRidgeCount = 0;
          for (let ci = 0; ci < cells.length; ci++) {
            if (minChebToCells(cells[ci].x, cells[ci].y, R.peakCells) <= 1) adjPeakCount += 1;
            if (minChebToCells(cells[ci].x, cells[ci].y, R.cells) <= 1) adjRidgeCount += 1;
          }
          if (adjPeakCount >= 2 && adjRidgeCount >= 3) {
            if (cells.length >= targetWindTiles) {
              chosenWind = cells;
              chosenRidge = R;
              chosenWindAngle = ridgeWindAngle;
              break;
            }
            if (!bestFallback || cells.length > bestFallback.cells.length) {
              bestFallback = { cells, ridge: R, angle: ridgeWindAngle };
            }
          }
        }
      }
      if (!chosenWind && bestFallback) {
        chosenWind = bestFallback.cells;
        chosenRidge = bestFallback.ridge;
        chosenWindAngle = bestFallback.angle;
      }
    }
    if (!chosenWind || chosenWind.length < minWindTiles) return null;

    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < chosenWind.length; i++) {
      sumX += chosenWind[i].x;
      sumY += chosenWind[i].y;
    }
    const cxMean = sumX / chosenWind.length;
    const cyMean = sumY / chosenWind.length;
    const windSet = new Set(chosenWind.map((c) => c.x + ',' + c.y));
    let maxDist = 0.001;
    for (let i = 0; i < chosenWind.length; i++) {
      const d = Math.hypot(chosenWind[i].x - cxMean, chosenWind[i].y - cyMean);
      if (d > maxDist) maxDist = d;
      chosenWind[i].dist = d;
    }
    const diagDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let i = 0; i < chosenWind.length; i++) {
      const c = chosenWind[i];
      let nb = 0;
      for (let k = 0; k < 4; k++) {
        if (windSet.has((c.x + cardDirs[k][0]) + ',' + (c.y + cardDirs[k][1]))) nb += 1.0;
        if (windSet.has((c.x + diagDirs[k][0]) + ',' + (c.y + diagDirs[k][1]))) nb += 0.5;
      }
      const dPeak = minHypotToCells(c.x, c.y, chosenRidge.peakCells);
      c.interiorScore = nb - (c.dist / maxDist) * 1.85 + Math.max(0, 2.5 - dPeak) * 0.45;
    }
    const ranked = chosenWind.slice().sort((a, b) => b.interiorScore - a.interiorScore);
    const coreTarget = Math.max(3, Math.min(6, Math.round(chosenWind.length * 0.35)));
    const coreSet = new Set();
    for (let i = 0; i < coreTarget; i++) {
      coreSet.add(ranked[i].x + ',' + ranked[i].y);
    }
    const outerMult = wzCfg.outerMult || 1.40;
    const coreMult = wzCfg.coreMult || 1.70;
    for (let i = 0; i < chosenWind.length; i++) {
      const c = chosenWind[i];
      const isCore = coreSet.has(c.x + ',' + c.y);
      grid[c.y][c.x] = {
        kind: 'wind',
        elev: 0,
        tier: isCore ? 2 : 1,
        windMult: isCore ? coreMult : outerMult,
        windAngle: chosenWindAngle
      };
    }

    return grid;
  }

  function verifyTerrainReachability(terrainGrid) {
    if (!terrainGrid || !ZS.Pathfinding || !ZS.Pathfinding.computeFlowField) return false;
    const emptyStruct = Array.from({ length: N }, () => Array(N).fill(null));
    const flow = ZS.Pathfinding.computeFlowField(N, DATA.HQ_POS, emptyStruct, terrainGrid);
    if (!flow || !flow.cost) return false;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const isEdge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        const t = terrainGrid[y][x];
        if (isEdge || (t && (t.kind === 'plateau' || t.kind === 'ramp'))) {
          if (!(flow.cost[y][x] < 1e8)) return false;
        }
      }
    }
    return true;
  }

  function generateVerifiedTerrain(seedOverride) {
    const baseSeed =
      seedOverride !== undefined && seedOverride !== null
        ? (Number(seedOverride) >>> 0)
        : (((Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0) || 1);
    for (let attempt = 0; attempt < 32; attempt++) {
      const candSeed = ((baseSeed + attempt * 2654435761) >>> 0) || (attempt + 1);
      const grid = generateProceduralTerrain(candSeed);
      if (grid && verifyTerrainReachability(grid)) {
        return { seed: candSeed, terrainGrid: grid };
      }
    }
    // Deterministic fallback seed known to generate cleanly
    const fallbackGrid = generateProceduralTerrain(670001) || Array.from({ length: N }, () => Array(N).fill(null));
    return { seed: 670001, terrainGrid: fallbackGrid };
  }

  function resolveSeedAndDivisionArgs(arg1, arg2) {
    let seedOverride = null;
    let divisionId = null;
    if (typeof arg1 === 'string' && DATA.DIVISIONS && DATA.DIVISIONS[arg1]) {
      divisionId = arg1;
      if (arg2 !== undefined && arg2 !== null && typeof arg2 !== 'string') {
        seedOverride = arg2;
      }
    } else {
      seedOverride = arg1 !== undefined ? arg1 : null;
      if (typeof arg2 === 'string' && DATA.DIVISIONS && DATA.DIVISIONS[arg2]) {
        divisionId = arg2;
      }
    }
    return { seedOverride, divisionId };
  }

  function initNewGame(arg1, arg2) {
    const args = resolveSeedAndDivisionArgs(arg1, arg2);
    const chosenDivision = (args.divisionId && DATA.DIVISIONS && DATA.DIVISIONS[args.divisionId])
      ? args.divisionId
      : 'mobile_corps';
    const divDef = getDivisionDef(chosenDivision);

    createEmptyGrids();
    G.pendingVeteranDemolish = null;
    const gen = generateVerifiedTerrain(args.seedOverride);
    state.terrainSeed = gen.seed;
    state.terrainGrid = gen.terrainGrid;

    state.divisionId = chosenDivision;
    state.divisionRank1Vouchers = divDef.voucherRank1 ? { ...divDef.voucherRank1 } : {};
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
    state.agents = DATA.HQ_STATS.startingAgents + (divDef.startingAgentsBonus || 0);
    state.jobs = {
      combat: Math.max(1, state.agents - 1),
      research: state.agents >= 1 ? 1 : 0,
      prod: 0
    };
    state.debugBonusPopCap = 0;
    state.rp = 0;
    state.researchedTechs = {};
    state.undergroundUnlocked = false;
    state.digAp = 0;
    state.digApCap = 24;
    state.freeVouchers = divDef.startingVouchers ? { ...divDef.startingVouchers } : {};
    state.showWindOverlay = false;
    state.traderRefreshCost = 15;
    state.traderRefreshCount = 0;
    state.nightConsumables = { overpressureAmmo: false, reactiveArmor: false };
    state.agentRecruitProgress = 0;
    state.statsEpoch = 1;
    state.skills.repairCd = 0;
    state.skills.repairMaxCd = divDef.repairMaxCd || 18;
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

    // Starter modern tactical plaza around HQ (13,13)
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

    // Starter free 5x5 razor-wire barricade perimeter surrounding the 3x3 HQ plaza
    const wallDef = DATA.ITEMS && DATA.ITEMS.barricade_wall;
    if (wallDef) {
      const wallProf = G.getStructLevelProfile ? G.getStructLevelProfile(wallDef, 1) : null;
      const wallMaxHp = (wallProf && wallProf.baseMaxHp) || wallDef.maxHp || 180;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
          const wx = hx + dx;
          const wy = hy + dy;
          if (wx > 0 && wy > 0 && wx < N - 1 && wy < N - 1 && !state.structGrid[wy][wx]) {
            state.structGrid[wy][wx] = {
              uid: G.nextStructUid++,
              id: 'barricade_wall',
              level: 1,
              xp: 0,
              rank: 0,
              kills: 0,
              usedVoucher: true,
              invested: { wood: 0, scrap: 0, coin: 0 },
              hp: wallMaxHp,
              maxHp: wallMaxHp,
              cooldown: 0,
              aimAngle: 0,
              buildAnimTimer: 0,
              upgradeAnimTimer: 0,
              promoAnimTimer: 0,
              fallAnimTimer: 0
            };
          }
        }
      }
    }

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

    const ENTRY_IDX = [Math.floor(N * 0.25), Math.floor(N * 0.5), N - 1 - Math.floor(N * 0.25)];
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

        for (let stepIdx = 0; stepIdx < N * 4; stepIdx++) {
          const step = flow.next[y] && flow.next[y][x];
          if (!step) break;
          x += step.dx;
          y += step.dy;
          if (x < 0 || y < 0 || x >= N || y >= N) break;
          pts.push({ x, y });
          if (!breach && ZS.Pathfinding.isBlocking(state.structGrid, x, y, state.terrainGrid)) {
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
    state.flow = ZS.Pathfinding.computeFlowField(N, DATA.HQ_POS, state.structGrid, state.terrainGrid);
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

  function toggleWindOverlay() {
    state.showWindOverlay = !state.showWindOverlay;
    notifyUi();
    return state.showWindOverlay;
  }

  function setWindOverlay(flag) {
    state.showWindOverlay = !!flag;
    notifyUi();
    return state.showWindOverlay;
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
    const div = getDivisionDef();
    const divXpMult = (def.subType === 'manned' && div && div.mannedXpMult) ? div.mannedXpMult : 1.0;
    const gained = rawXp * cozyXpMult * divXpMult;
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
      const div = getDivisionDef();
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const s = state.structGrid[y] && state.structGrid[y][x];
          if (!s || s.id === 'command_hq' || s.hp <= 0) continue;
          const d = DATA.ITEMS[s.id];
          if (isCombatVeterancyDef(d)) {
            const dMult = (d.subType === 'manned' && div && div.mannedXpMult) ? div.mannedXpMult : 1.0;
            s.xp = +((s.xp || 0) + bonus * cozyXpMult * dMult).toFixed(3);
            applyPromoteCheck(s, d, x, y, false, true);
          }
          if (s.mounted && s.mounted.hp > 0) {
            const md = DATA.ITEMS[s.mounted.id];
            if (isCombatVeterancyDef(md)) {
              const mdMult = (md.subType === 'manned' && div && div.mannedXpMult) ? div.mannedXpMult : 1.0;
              s.mounted.xp = +((s.mounted.xp || 0) + bonus * cozyXpMult * mdMult).toFixed(3);
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
        saveVersion: 3,
        defenseTierV2: true,
        balanceV3: true,
        divisionId: state.divisionId || 'mobile_corps',
        divisionRank1Vouchers: state.divisionRank1Vouchers || {},
        wave: state.wave,
        hqLevel: state.hqLevel,
        bossDefeated: state.bossDefeated,
        wood: state.wood,
        scrap: state.scrap,
        coin: state.coin,
        power: state.power,
        agents: state.agents,
        jobs: state.jobs ? { ...state.jobs } : { combat: state.agents, research: 0, prod: 0 },
        debugBonusPopCap: state.debugBonusPopCap || 0,
        rp: state.rp || 0,
        researchedTechs: state.researchedTechs ? { ...state.researchedTechs } : {},
        undergroundUnlocked: !!state.undergroundUnlocked,
        digAp: state.digAp || 0,
        digApCap: state.digApCap || 24,
        showReconPaths: state.showReconPaths !== false,
        showWindOverlay: !!state.showWindOverlay,
        nextWaveIntel: state.nextWaveIntel,
        freeVouchers: state.freeVouchers,
        traderOffers: state.traderOffers,
        traderRefreshCost: state.traderRefreshCost || 15,
        traderRefreshCount: state.traderRefreshCount || 0,
        nightConsumables: state.nightConsumables || { overpressureAmmo: false, reactiveArmor: false },
        agentRecruitProgress: state.agentRecruitProgress || 0,
        terrainSeed: state.terrainSeed || 0,
        terrainGrid: state.terrainGrid,
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
      const LEGACY_GRID_18 = 18;
      const LEGACY_GRID_22 = 22;
      if (!d || !Array.isArray(d.structGrid)) return false;
      const savedN = d.structGrid.length;
      if (savedN !== N && savedN !== LEGACY_GRID_22 && savedN !== LEGACY_GRID_18) return false;
      if (!Array.isArray(d.floorGrid) || d.floorGrid.length !== savedN) return false;
      for (let ry = 0; ry < savedN; ry++) {
        if (!Array.isArray(d.structGrid[ry]) || d.structGrid[ry].length !== savedN) return false;
        if (!Array.isArray(d.floorGrid[ry]) || d.floorGrid[ry].length !== savedN) return false;
      }

      const nextFloorGrid = Array.from({ length: N }, () => Array(N).fill(null));
      const nextStructGrid = Array.from({ length: N }, () => Array(N).fill(null));
      let offset = 0;
      if (savedN === LEGACY_GRID_22 && N === 26) offset = 3;
      else if (savedN === LEGACY_GRID_18 && N === 26) offset = 5;
      else if (savedN === LEGACY_GRID_18 && N === 22) offset = 2;

      for (let oy = 0; oy < savedN; oy++) {
        for (let ox = 0; ox < savedN; ox++) {
          nextFloorGrid[oy + offset][ox + offset] = d.floorGrid[oy][ox] || null;
          nextStructGrid[oy + offset][ox + offset] = d.structGrid[oy][ox] || null;
        }
      }

      const hqLoaded = nextStructGrid[DATA.HQ_POS.y] && nextStructGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
      if (!hqLoaded || hqLoaded.id !== 'command_hq') return false;

      const nextTerrainGrid = Array.from({ length: N }, () => Array(N).fill(null));
      let hasValidTerrainGrid = savedN === N && Array.isArray(d.terrainGrid) && d.terrainGrid.length === N;
      if (hasValidTerrainGrid) {
        for (let ty = 0; ty < N; ty++) {
          if (!Array.isArray(d.terrainGrid[ty]) || d.terrainGrid[ty].length !== N) {
            hasValidTerrainGrid = false;
            break;
          }
        }
      }
      if (hasValidTerrainGrid) {
        for (let ty = 0; ty < N; ty++) {
          for (let tx = 0; tx < N; tx++) {
            const cell = d.terrainGrid[ty][tx];
            if (!cell) {
              nextTerrainGrid[ty][tx] = null;
            } else if (cell.kind === 'energy') {
              nextTerrainGrid[ty][tx] =
                cell.subKind === 'wind'
                  ? {
                      kind: 'wind',
                      elev: 0,
                      tier: 1,
                      windMult: (DATA.WIND_ZONE && DATA.WIND_ZONE.outerMult) || 1.40,
                      windAngle: -0.6
                    }
                  : null;
            } else if (cell.kind === 'rock') {
              const isPeak = !!cell.isPeak;
              nextTerrainGrid[ty][tx] = {
                ...cell,
                isPeak,
                topZ: cell.topZ || (isPeak ? (DATA.ROCK_PEAK_TOP_Z || 33) : (DATA.ROCK_TOP_Z || 16)),
                variant: Number.isFinite(cell.variant) ? cell.variant : ((tx * 5 + ty * 7) & 7),
                flip: cell.flip ? 1 : 0
              };
            } else {
              nextTerrainGrid[ty][tx] = { ...cell };
            }
          }
        }
        state.terrainSeed = Number(d.terrainSeed) || 0;
      } else {
        state.terrainSeed = 0;
      }
      state.terrainGrid = nextTerrainGrid;

      state.divisionId = (d.divisionId && DATA.DIVISIONS && DATA.DIVISIONS[d.divisionId])
        ? d.divisionId
        : 'mobile_corps';
      state.divisionRank1Vouchers = (d.divisionRank1Vouchers && typeof d.divisionRank1Vouchers === 'object')
        ? { ...d.divisionRank1Vouchers }
        : {};
      const loadedDiv = getDivisionDef(state.divisionId);
      state.skills.repairMaxCd = loadedDiv.repairMaxCd || 18;
      state.skills.repairCd = Math.min(state.skills.repairCd || 0, state.skills.repairMaxCd);
      state.wave = d.wave || 1;
      const maxHqLv = (DATA.HQ_LEVELS && DATA.HQ_LEVELS.length) || 5;
      state.hqLevel = Math.max(1, Math.min(maxHqLv, d.hqLevel || 1));
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
      state.rp = Math.max(0, Number(d.rp) || 0);
      state.digApCap = Math.max(16, Number(d.digApCap) || 24);
      state.digAp = Math.max(0, Number(d.digAp) || 0);

      let migratedTechOrJobs = false;
      if (d.researchedTechs && typeof d.researchedTechs === 'object') {
        const sanitizedTechs = {};
        const tTree = DATA.TECH_TREE || {};
        const keys = Object.keys(d.researchedTechs);
        for (let i = 0; i < keys.length; i++) {
          const tid = keys[i];
          const tDef = tTree[tid];
          const lvVal = Math.floor(Number(d.researchedTechs[tid]) || 0);
          if (tDef && lvVal > 0) {
            sanitizedTechs[tid] = Math.min(tDef.maxLv || 1, lvVal);
          }
        }
        state.researchedTechs = sanitizedTechs;
        state.undergroundUnlocked = d.undergroundUnlocked !== undefined ? !!d.undergroundUnlocked : state.hqLevel >= 2;
      } else {
        // Legacy save (v0.7.0 and earlier) tech auto-unlock migration based on saved hqLevel
        const inferred = {};
        if (state.hqLevel >= 2) {
          inferred.def_t1 = 1;
          inferred.inf_sniper = 1;
          inferred.inf_lv2 = 1;
          inferred.tur_vulcan = 1;
          inferred.tur_lv2 = 1;
          inferred.inf_tier2 = 1;
          state.undergroundUnlocked = true;
          if (d.digAp === undefined) {
            state.digAp = Math.min(state.digApCap, 16);
          }
        } else {
          state.undergroundUnlocked = !!d.undergroundUnlocked;
        }
        if (state.hqLevel >= 3) {
          inferred.def_t2 = 1;
          inferred.inf_lv3 = 1;
          inferred.tur_missile = 1;
          inferred.tur_lv3 = 1;
          inferred.inf_tier3 = 1;
        }
        if (state.hqLevel >= 4) {
          inferred.tur_emp = 1;
          inferred.inf_tier4 = 1;
        }
        state.researchedTechs = inferred;
        migratedTechOrJobs = true;
      }
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

      state.jobs = (d.jobs && typeof d.jobs === 'object')
        ? {
            combat: Math.max(0, Math.floor(Number(d.jobs.combat) || 0)),
            research: Math.max(0, Math.floor(Number(d.jobs.research) || 0)),
            prod: Math.max(0, Math.floor(Number(d.jobs.prod) || 0))
          }
        : null;
      if (!state.jobs) migratedTechOrJobs = true;

      G.recalculateBaseStats(true);
      if (!d.jobs || typeof d.jobs !== 'object') {
        const minC = Math.min(state.agents, Math.max(1, state.popUsed || 0));
        const rem = Math.max(0, state.agents - minC);
        const rCount = rem >= 1 ? 1 : 0;
        const cCount = minC + Math.max(0, rem - rCount);
        state.jobs = { combat: cCount, research: rCount, prod: 0 };
      }
      normalizeJobs();
      state.cozyTierUpTimer = 0;
      state.power = d.power ?? state.powerCap;
      state.showReconPaths = d.showReconPaths !== undefined ? !!d.showReconPaths : true;
      state.showWindOverlay = !!d.showWindOverlay;
      state.reconNightFadeTimer = 0;
      state.reconFlashTimer = 0;
      if (savedN === N && d.nextWaveIntel && d.nextWaveIntel.wave === state.wave && Array.isArray(d.nextWaveIntel.plannedQueue)) {
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
      if (offset > 0 || savedN !== N || migratedWalls || isLegacyV1 || needsDefenseMigration || migratedV2 || migratedTechOrJobs) saveGame();
      notifyUi();
      return true;
    } catch (e) {
      return false;
    }
  }

  function regenerateMapSeed(seed) {
    const res = generateVerifiedTerrain(seed);
    state.terrainSeed = res.seed;
    state.terrainGrid = res.terrainGrid;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const t = state.terrainGrid[y][x];
        if (!t) continue;
        if (t.kind === 'rock') {
          if (state.structGrid[y][x] && state.structGrid[y][x].id !== 'command_hq') {
            state.structGrid[y][x] = null;
          }
          state.floorGrid[y][x] = null;
        } else if (t.kind === 'ramp') {
          if (state.structGrid[y][x] && state.structGrid[y][x].id !== 'command_hq' && state.structGrid[y][x].id !== 'razor_pad') {
            state.structGrid[y][x] = null;
          }
          state.floorGrid[y][x] = null;
        }
      }
    }
    invalidateStatsCache();
    G.recalculateBaseStats(true);
    recomputeFlow(false);
    saveGame();
    notifyUi();
    return state.terrainSeed;
  }

  function clearSaveAndReset(arg1, arg2) {
    try {
      localStorage.removeItem(getSaveKey());
    } catch (e) {}
    initNewGame(arg1, arg2);
    const div = getDivisionDef();
    banner(
      `[${div.name}] 새 전초기지 작전 개시`,
      '방어선과 발전 설비를 구축하고 모던 쉘터를 꾸며보세요!',
      'info'
    );
  }

  function debugUnlockAllDivisions() {
    if (!isDebugAllowed()) return false;
    const divs = DATA.DIVISIONS || {};
    const keys = Object.keys(divs);
    for (let i = 0; i < keys.length; i++) {
      unlockDivision(keys[i]);
    }
    notifyUi();
    return true;
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
      state.power = Math.max(DATA.HQ_STATS.basePowerCap || 70, state.powerCap);
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
    grantAgents(n);
    G.recalculateBaseStats(true);
    ZS.Audio.playTrade();
    banner(`[DEBUG] 요원 +${n}명 충원`, `가용 요원 ${state.agents}명 · 숙소 수용량 ${state.popCap}명으로 확장`, 'good');
    saveGame();
    notifyUi();
    return true;
  }

  function debugAddRp(amount) {
    if (!isDebugAllowed()) return false;
    const add = Number(amount) || 20;
    state.rp = (state.rp || 0) + add;
    ZS.Audio.playTrade();
    banner(`[DEBUG] +${add} RP 지급`, `연구포인트 +${add} RP 추가 완료 (보유 ${state.rp} RP)`, 'good');
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
    if (state.wave >= 15 && unlockDivision('arc_tech')) {
      banner('사령관 분과 영구 해금: 아크 테크놀로지', 'WAVE 15 도달 조건 달성! 새 작전에서 선택할 수 있습니다.', 'good');
    }
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
    getMetaKey,
    getDivisionDef,
    getCommanderMeta,
    isDivisionUnlocked,
    unlockDivision,
    setLastSelectedDivision,
    recordDivisionProgress,
    debugUnlockAllDivisions,
    isArcOverdriveActive,
    setCallbacks,
    invalidateStatsCache,
    notifyUi,
    notifyCombatHud,
    banner,
    getHqLevelInfo,
    normalizeJobs,
    grantAgents,
    adjustJob,
    createEmptyGrids,
    getTerrainAt,
    getTerrainElevationAt,
    findFirstPeakOnSegment,
    hasDirectLineOfSight,
    generateProceduralTerrain,
    verifyTerrainReachability,
    generateVerifiedTerrain,
    regenerateMapSeed,
    initNewGame,
    getSideEntryTile,
    computeWaveSideProfile,
    recomputePreviewPaths,
    recomputeFlow,
    toggleReconPaths,
    toggleWindOverlay,
    setWindOverlay,
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
    debugAddRp,
    debugAdvanceWave,
    debugGrantSelectedXp
  });
})();
