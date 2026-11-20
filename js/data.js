window.ZS = window.ZS || {};

ZS.DATA = (function () {
  // Single-source-of-truth Semantic Palette (share/design/issue-03-palette-tokens.md)
  const PALETTE = {
    // 1. Semantic Tokens (1 Color = 1 Meaning)
    power: '#5EF2FF',
    powerDim: '#2A7F8C',
    powerSoft: 'rgba(94, 242, 255, 0.24)',
    powerGlow: 'rgba(94, 242, 255, 0.44)',

    coin: '#FFC94A',
    gold: '#FFC94A',
    goldStroke: 'rgba(255, 201, 74, 0.78)',
    goldFill: 'rgba(255, 201, 74, 0.10)',

    danger: '#FF4D6D',
    dangerFill: 'rgba(255, 77, 109, 0.24)',

    heal: '#4ADE80',
    health: '#4ADE80',
    healthFill: 'rgba(74, 222, 128, 0.24)',

    caution: '#FACC15',
    healthMid: '#FACC15',

    select: 'rgba(255, 255, 255, 0.85)',
    selectStroke: 'rgba(255, 255, 255, 0.85)',
    selectFill: 'rgba(255, 255, 255, 0.10)',
    rangeStroke: 'rgba(255, 255, 255, 0.85)',
    rangeFill: 'rgba(255, 255, 255, 0.10)',
    hoverStroke: 'rgba(255, 255, 255, 0.45)',
    hoverFill: 'rgba(255, 255, 255, 0.10)',

    critText: '#FFFFFF',
    critStroke: '#FF4D6D',
    neutralText: '#F1F5F9',

    // 2. Growth / Rank Metal Tokens (#12, #13)
    rankBronze: '#D08A4E',
    rankBronzeStroke: '#5A3317',
    rankSilver: '#E3E8EE',
    rankSilverStroke: '#4A5563',
    rankGold: '#FFD34D',
    rankGoldStroke: '#6B4A00',
    levelPip: '#F2F4F7',
    levelPipStroke: '#1B2430',
    levelMax: '#FF9F43',
    levelMaxStroke: '#5C2E00',
    steelBand: '#8C96A3',
    thornSpark: '#FF8A3D',

    // 3. World Base Tokens (#5: narrowed checker delta, desaturated gray-brown perimeter, 3-layer diorama strata)
    groundA: '#4E6653',
    groundB: '#4B6250',
    groundEdge: '#4A4F48',
    terrainA: '#4E6653',
    terrainB: '#4B6250',
    terrainEdgeA: '#4A4F48',
    terrainEdgeB: '#454A43',
    slabTurfLeft: '#3E4C3B',
    slabTurfRight: '#2F3A2D',
    slabSideLeft: '#3A3027',
    slabSideRight: '#2C241D',
    slabRockLeft: '#2B3038',
    slabRockRight: '#1E2229',
    baseLight: '#FFD27A',
    nightOverlay: 'rgb(7, 13, 25)',
    outlineDark: '#1B2430',
    resWood: '#D49A5A',
    resScrap: '#AEB8C4',
    warmGlow: 'rgba(255, 206, 112, 0.48)',

    // 4. Enemy (Zombie) Complementary Palette (share/design/issue-03-palette-tokens.md §4 approved)
    zombieWalkerCoat: '#6E1E3E',
    zombieWalkerSkin: '#F2CCD0',
    zombieWalkerEye: '#FF4D6D',

    zombieRunnerCoat: '#991B2E',
    zombieRunnerAccent: '#FF9466',
    zombieRunnerSkin: '#FFF0E6',
    zombieRunnerEye: '#FFB347',

    zombieBruteCoat: '#3B1029',
    zombieBruteArmor: '#C97A9E',
    zombieBruteSkin: '#E8BBD0',
    zombieBruteEye: '#FF4D6D',

    zombieBossCoat: '#591259',
    zombieBossCrack: '#E040FB',
    zombieBossSkin: '#F9DBFF',
    zombieBossEye: '#FF4D6D',

    // 5. Phase 2 Tokens (share/design/phase2-tokens.md)
    mutantAcid: '#C8F542',
    mutantAcidDim: '#6E8A1E',
    mutantEmp: '#B26BFF',
    mutantSpark: '#FFE14D',
    mutantBone: '#F4EBDD',
    zombieSpitterCoat: '#4F2147',
    zombieSpitterLegs: '#3A1636',
    zombieSpitterSkin: '#E9D3C2',
    zombieLeaperCoat: '#7A2338',
    zombieLeaperLegs: '#4A1522',
    zombieLeaperSkin: '#F4D9CF',
    zombieShockerCoat: '#2E1B4F',
    zombieShockerLegs: '#1E1236',
    zombieShockerPack: '#3B2A5E',
    zombieShockerRod: '#6B5A8E',
    zombieShockerSkin: '#D9CCE8',

    reconRoute: '#FF8FA3',
    reconRouteOutline: 'rgba(27, 36, 48, 0.55)',

    wireWood: '#8B6843',
    wireWoodDark: '#5E452B',
    wireIron: '#4A5562',
    wireCoil: '#BAC6D2',
    wireCoilDim: '#6E7B88',
    wireBarb: '#DCE5EE',
    gatePylon: '#59636E',
    gateBeam: '#4A5562',
    gateBar: '#2B333D',
    deckWood: '#8A6A45',
    deckRail: '#6E5536',
    deckSteelRail: '#3A434E',
    gateSlowRing: '#C9D3DE',

    // 6. Tier Evolution Tokens (share/design/phase2-tokens.md §5)
    piezoCopper: '#B87333',
    piezoArc: '#FF8A3D',
    piezoSpark: '#FFD08A',
    trapBlade: '#DCE5EE',
    habitatRoof: '#D96B38',
    repairNano: '#4ADE80'
  };

  const WALL_TIERS = {
    1: { level: 1, name: '철조망 바리케이드', reqHqLevel: 1, cost: { wood: 6, scrap: 2 }, maxHp: 180, thornsRatio: 0.15, thornsMin: 4, allowWallMount: false, mountBaseZ: 0, topZ: 10.9 },
    2: { level: 2, name: '헤스코 전술 방벽', reqHqLevel: 2, upCost: { wood: 8, scrap: 6 }, maxHp: 360, thornsRatio: 0, thornsMin: 0, allowWallMount: true, mountBaseZ: 15.2, topZ: 14.0 },
    3: { level: 3, name: '합금 장갑 성벽', reqHqLevel: 3, upCost: { wood: 6, scrap: 18, coin: 6 }, maxHp: 640, thornsRatio: 0.35, thornsMin: 8, allowWallMount: true, mountBaseZ: 25.4, topZ: 27.7 }
  };

  const SOLAR_TIERS = {
    1: { level: 1, name: '소형 태양광 패널', reqHqLevel: 1, cost: { wood: 10, scrap: 20 }, maxHp: 135, dayCharge: 38, nightGen: 0, powerCap: 15, cozy: 1, cozyGroup: 'infra_solar', topZ: 12 },
    2: { level: 2, name: '중형 태양광 패널', reqHqLevel: 2, upCost: { wood: 6, scrap: 34, coin: 10 }, maxHp: 195, dayCharge: 75, nightGen: 0, powerCap: 28, cozy: 3, cozyGroup: 'infra_solar', topZ: 17 },
    3: { level: 3, name: '태양광 발전기', reqHqLevel: 3, upCost: { wood: 8, scrap: 56, coin: 24 }, maxHp: 270, dayCharge: 135, nightGen: 0, powerCap: 45, cozy: 5, cozyGroup: 'infra_solar', topZ: 24 },
    4: { level: 4, name: '태양광 발전소', reqHqLevel: 4, upCost: { wood: 10, scrap: 92, coin: 48 }, maxHp: 370, dayCharge: 220, nightGen: 0, powerCap: 75, cozy: 8, cozyGroup: 'infra_solar', topZ: 34 }
  };

  const WIND_TIERS = {
    1: { level: 1, name: '마이크로 풍력발전기', reqHqLevel: 1, cost: { wood: 8, scrap: 18 }, maxHp: 140, dayCharge: 14, nightGen: 0.65, powerCap: 10, cozy: 1, cozyGroup: 'infra_wind', topZ: 30 },
    2: { level: 2, name: '소형 풍력발전기', reqHqLevel: 2, upCost: { wood: 6, scrap: 32, coin: 10 }, maxHp: 195, dayCharge: 28, nightGen: 1.35, powerCap: 18, cozy: 3, cozyGroup: 'infra_wind', topZ: 44 },
    3: { level: 3, name: '중형 풍력발전기', reqHqLevel: 3, upCost: { wood: 8, scrap: 54, coin: 24 }, maxHp: 265, dayCharge: 48, nightGen: 2.40, powerCap: 30, cozy: 5, cozyGroup: 'infra_wind', topZ: 60 },
    4: { level: 4, name: '대형 풍력발전기', reqHqLevel: 4, upCost: { wood: 10, scrap: 88, coin: 46 }, maxHp: 360, dayCharge: 75, nightGen: 3.80, powerCap: 50, cozy: 8, cozyGroup: 'infra_wind', topZ: 70 }
  };

  const BATTERY_TIERS = {
    1: { level: 1, name: '소형 야전 배터리 팩', reqHqLevel: 1, cost: { wood: 6, scrap: 18 }, maxHp: 165, powerCap: 70, dayCharge: 6, nightGen: 0, cozy: 1, cozyGroup: 'infra_battery', topZ: 14 },
    2: { level: 2, name: '중형 배터리 팩', reqHqLevel: 2, upCost: { wood: 4, scrap: 30, coin: 12 }, maxHp: 230, powerCap: 155, dayCharge: 14, nightGen: 0, cozy: 2, cozyGroup: 'infra_battery', topZ: 22 },
    3: { level: 3, name: '리튬 ESS 배터리 뱅크', reqHqLevel: 3, upCost: { wood: 6, scrap: 48, coin: 26 }, maxHp: 300, powerCap: 290, dayCharge: 26, nightGen: 0, cozy: 4, cozyGroup: 'infra_battery', topZ: 33 },
    4: { level: 4, name: '초전도 에너지 코어', reqHqLevel: 4, upCost: { wood: 8, scrap: 82, coin: 48 }, maxHp: 400, powerCap: 480, dayCharge: 42, nightGen: 0, cozy: 7, cozyGroup: 'infra_battery', topZ: 40 }
  };

  const BARRACKS_TIERS = {
    1: { level: 1, name: '전술 돔 막사', reqHqLevel: 1, cost: { wood: 24, scrap: 8 }, maxHp: 170, popCap: 1, cozy: 5, cozyGroup: 'infra_housing', lightRadius: 1.8, lightColor: 'rgba(255, 206, 112, 0.34)', topZ: 16 },
    2: { level: 2, name: '확장형 야전 막사', reqHqLevel: 2, upCost: { wood: 12, scrap: 24, coin: 12 }, maxHp: 230, popCap: 2, cozy: 10, cozyGroup: 'infra_housing', lightRadius: 2.0, lightColor: 'rgba(255, 206, 112, 0.35)', topZ: 19 },
    3: { level: 3, name: '모듈러 컨테이너 숙소', reqHqLevel: 3, upCost: { wood: 14, scrap: 44, coin: 26 }, maxHp: 310, popCap: 4, cozy: 18, cozyGroup: 'infra_housing', lightRadius: 2.3, lightColor: 'rgba(255, 214, 145, 0.36)', topZ: 22 },
    4: { level: 4, name: '강화 작전 생활관', reqHqLevel: 4, upCost: { wood: 18, scrap: 74, coin: 46 }, maxHp: 420, popCap: 6, cozy: 28, cozyGroup: 'infra_housing', lightRadius: 2.7, lightColor: 'rgba(255, 214, 145, 0.38)', topZ: 32 }
  };

  const GATE_TIERS = {
    1: { level: 1, name: '철조망 바리케이드 통문', reqHqLevel: 1, cost: { wood: 6, scrap: 8 }, maxHp: 240, gateSlowRadius: 1.15, gateSlowFactor: 0.82, thornsRatio: 0.15, thornsMin: 4, allowWallMount: false, topZ: 16.5 },
    2: { level: 2, name: '전술 방호 게이트', reqHqLevel: 2, upCost: { wood: 8, scrap: 14, coin: 6 }, maxHp: 480, gateSlowRadius: 1.15, gateSlowFactor: 0.75, thornsRatio: 0, thornsMin: 0, allowWallMount: false, topZ: 26.5 },
    3: { level: 3, name: '전자식 쇼크 게이트', reqHqLevel: 3, upCost: { wood: 12, scrap: 28, coin: 18 }, maxHp: 880, gateSlowRadius: 1.25, gateSlowFactor: 0.60, thornsRatio: 0.35, thornsMin: 8, allowWallMount: false, topZ: 28.0 }
  };

  const TRAP_TIERS = {
    1: { level: 1, name: '스파이크 철조망 매트', reqHqLevel: 1, cost: { wood: 6, scrap: 10 }, maxHp: 180, trapDps: 11, trapWear: 3.2, slowFactor: 0.55, vulnMult: 1.0, topZ: 4.6 },
    2: { level: 2, name: '소투스 칼날 매트', reqHqLevel: 2, upCost: { wood: 8, scrap: 14, coin: 8 }, maxHp: 270, trapDps: 19, trapWear: 2.4, slowFactor: 0.48, vulnMult: 1.0, topZ: 4.7 },
    3: { level: 3, name: '고전압 파쇄 패드', reqHqLevel: 3, upCost: { wood: 10, scrap: 22, coin: 20 }, maxHp: 390, trapDps: 30, trapWear: 2.0, slowFactor: 0.40, vulnMult: 1.15, topZ: 5.0 }
  };

  const REPAIR_TIERS = {
    1: { level: 1, name: '현장 수리 거치대', reqHqLevel: 1, cost: { wood: 10, scrap: 14 }, maxHp: 165, auraRadius: 2.2, regenPerSec: 2.5, cozy: 5, cozyGroup: 'repair_t1', lightRadius: 0, topZ: 18 },
    2: { level: 2, name: '필드 로봇 정비 베이', reqHqLevel: 2, upCost: { wood: 8, scrap: 18, coin: 12 }, maxHp: 230, auraRadius: 2.6, regenPerSec: 5.0, cozy: 9, cozyGroup: 'repair_t2', lightRadius: 0, topZ: 25 },
    3: { level: 3, name: '나노 드론 정비소', reqHqLevel: 3, upCost: { wood: 12, scrap: 32, coin: 24 }, maxHp: 320, auraRadius: 3.2, regenPerSec: 9.5, cozy: 15, cozyGroup: 'repair_t3', lightRadius: 2.2, lightColor: 'rgba(74, 222, 128, 0.32)', topZ: 30 }
  };

  const TIER_MAPS = {
    barricade_wall: WALL_TIERS,
    solar_array: SOLAR_TIERS,
    wind_turbine: WIND_TIERS,
    battery_bank: BATTERY_TIERS,
    field_tent: BARRACKS_TIERS,
    tactical_gate: GATE_TIERS,
    razor_pad: TRAP_TIERS,
    repair_bay: REPAIR_TIERS
  };

  return {
  VERSION: 'v0.4.0',
  GRID_SIZE: 22,
  HQ_POS: { x: 10, y: 10 },
  PALETTE,

  INITIAL_RESOURCES: {
    wood: 150,
    scrap: 130,
    coin: 95
  },

  HQ_STATS: {
    id: 'command_hq',
    name: '전술 지휘 본부',
    maxHp: 800,
    basePowerCap: 85,
    baseDayCharge: 42,
    basePopCap: 2,
    startingAgents: 2
  },

  HQ_LEVELS: [
    {
      level: 1,
      name: '임시 지휘소',
      cost: null,
      maxHp: 800,
      basePowerCap: 85,
      baseDayCharge: 42,
      basePopCap: 2,
      structUpgradeCap: 1,
      maxZ: 36,
      hpBarWidth: 38,
      weapon: null
    },
    {
      level: 2,
      name: '전술 작전 본부',
      cost: { wood: 90, scrap: 70, coin: 45 },
      maxHp: 1150,
      basePowerCap: 115,
      baseDayCharge: 55,
      basePopCap: 3,
      structUpgradeCap: 2,
      maxZ: 30,
      hpBarWidth: 41,
      weapon: {
        name: '경기관총',
        range: 5.0,
        damage: 16,
        fireRate: 2.2,
        projType: 'hq_lmg',
        color: '#FFE484',
        width: 1.8,
        speed: 19,
        splashRadius: 0
      }
    },
    {
      level: 3,
      name: '통합 요새 사령부',
      cost: { wood: 170, scrap: 140, coin: 95 },
      maxHp: 1600,
      basePowerCap: 150,
      baseDayCharge: 72,
      basePopCap: 4,
      structUpgradeCap: 3,
      maxZ: 38,
      hpBarWidth: 44,
      weapon: {
        name: '중기관총',
        range: 5.8,
        damage: 26,
        fireRate: 2.8,
        projType: 'hq_hmg',
        color: '#FFE484',
        width: 2.4,
        speed: 20,
        splashRadius: 0
      }
    },
    {
      level: 4,
      name: '이지스 코어 사령부',
      cost: { wood: 280, scrap: 240, coin: 170 },
      maxHp: 2200,
      basePowerCap: 200,
      baseDayCharge: 95,
      basePopCap: 5,
      structUpgradeCap: 3,
      maxZ: 48,
      hpBarWidth: 46,
      weapon: {
        name: '이지스 트윈캐논',
        range: 6.5,
        damage: 38,
        fireRate: 3.5,
        projType: 'hq_aegis',
        color: '#FF9F43',
        width: 3.0,
        speed: 17,
        splashRadius: 0.8
      }
    }
  ],

  COZY_TIERS: [
    { level: 1, min: 0,   title: '임시 전초기지',         agentDmg: 0.00, fireRate: 0.00, coinBonus: 0.00, xpBonus: 0.00, freeRepair: 0.10 },
    { level: 2, min: 25,  title: '정비된 작전소',         agentDmg: 0.08, fireRate: 0.03, coinBonus: 0.08, xpBonus: 0.10, freeRepair: 0.18 },
    { level: 3, min: 65,  title: '모던 전술 쉘터',        agentDmg: 0.16, fireRate: 0.06, coinBonus: 0.15, xpBonus: 0.20, freeRepair: 0.26 },
    { level: 4, min: 130, title: '하이라이즈 아웃포스트', agentDmg: 0.25, fireRate: 0.10, coinBonus: 0.22, xpBonus: 0.30, freeRepair: 0.34 },
    { level: 5, min: 225, title: '네오 어반 요새',        agentDmg: 0.35, fireRate: 0.14, coinBonus: 0.30, xpBonus: 0.45, freeRepair: 0.42 },
    { level: 6, min: 340, title: '택티컬 라운지 시타델',  agentDmg: 0.45, fireRate: 0.18, coinBonus: 0.38, xpBonus: 0.60, freeRepair: 0.50 },
    { level: 7, min: 480, title: '사이버 헤이븐 코어',    agentDmg: 0.56, fireRate: 0.22, coinBonus: 0.46, xpBonus: 0.80, freeRepair: 0.58 },
    { level: 8, min: 640, title: '엘리트 파라다이스',     agentDmg: 0.68, fireRate: 0.27, coinBonus: 0.55, xpBonus: 1.00, freeRepair: 0.65 }
  ],

  COZY_FLOOR_CAP: 60,

  CATEGORIES: [
    { id: 'defense', iconId: 'cat-defense', label: '방어·화력', desc: '방벽, 무전력 요원 초소, 전력 자동포탑' },
    { id: 'infra',   iconId: 'cat-infra',   label: '전력·숙소', desc: '주간 태양광·야간 풍력 발전기, 배터리, 요원 숙소' },
    { id: 'decor',   iconId: 'cat-decor',   label: '모던 꾸미기', desc: '바닥재, 전술 조명, 라운지 가구 & 버프' }
  ],

  WALL_TIERS,
  SOLAR_TIERS,
  WIND_TIERS,
  BATTERY_TIERS,
  BARRACKS_TIERS,
  GATE_TIERS,
  TRAP_TIERS,
  REPAIR_TIERS,
  TIER_MAPS,

  LV3_PERK_LABELS: {
    rifle_bunker: '전술 2점사 (50% 피해 보조탄 추가 발사)',
    shotgun_post: '중산탄 제압 (펠릿 6발 + 0.20칸 넉백)',
    sniper_tower: '대구경 관통탄 (사거리 +1.0 · 최대 2기 관통)',
    vulcan_turret: '초전도 급탄 (사격 전력 0.24 절감 · 치명타 +12%p)',
    missile_pod: '고폭 확산탄 (폭발 반경 1.75 확대)',
    emp_coil: '연쇄 과부하 (최대 5기 연쇄 · 둔화 2.4초)'
  },

  VETERANCY_RANKS: [
    { rank: 0, minXp: 0,  name: '신병',   dmgBonus: 0.00, rateBonus: 0.00, critAdd: 0.00, rangeAdd: 0.0, color: '#94A3B8', stroke: '#1B2430' },
    { rank: 1, minXp: 12, name: '숙련',   dmgBonus: 0.08, rateBonus: 0.05, critAdd: 0.00, rangeAdd: 0.0, color: PALETTE.rankBronze, stroke: PALETTE.rankBronzeStroke },
    { rank: 2, minXp: 32, name: '베테랑', dmgBonus: 0.18, rateBonus: 0.12, critAdd: 0.06, rangeAdd: 0.0, color: PALETTE.rankSilver, stroke: PALETTE.rankSilverStroke },
    { rank: 3, minXp: 70, name: '에이스', dmgBonus: 0.30, rateBonus: 0.20, critAdd: 0.12, rangeAdd: 0.4, color: PALETTE.rankGold,   stroke: PALETTE.rankGoldStroke }
  ],

  ZOMBIE_KILL_XP: {
    walker: 1.0,
    runner: 1.5,
    brute: 4.0,
    spitter: 2.5,
    leaper: 2.5,
    shocker: 4.5,
    boss: 12.0,
    bossGlobalBonus: 4.0
  },

  ITEMS: {
    // ================= FLOORS (layer: 'floor') =================
    asphalt: {
      id: 'asphalt',
      name: '전술 아스팔트',
      category: 'decor',
      layer: 'floor',
      reqHqLevel: 1,
      cost: { wood: 4 },
      cozy: 1,
      cozyGroup: 'floor_road',
      desc: '전술 유도 차선이 마킹된 깔끔한 아스팔트 도로 타일입니다.'
    },
    steel_deck: {
      id: 'steel_deck',
      name: '스틸 체커 데크',
      category: 'decor',
      layer: 'floor',
      reqHqLevel: 1,
      cost: { scrap: 5 },
      cozy: 2,
      cozyGroup: 'floor_steel',
      hpMultBonus: 0.15,
      desc: '강철 체크 플레이트 바닥. 위에 지은 시설의 최대 내구도가 +15% 증가합니다.'
    },
    lounge_tile: {
      id: 'lounge_tile',
      name: '모던 테라스 타일',
      category: 'decor',
      layer: 'floor',
      reqHqLevel: 2,
      cost: { wood: 5, coin: 4 },
      cozy: 4,
      cozyGroup: 'floor_lounge',
      cozyTileBonus: 3,
      desc: '세련된 모던 석재 타일. 위에 배치한 꾸미기 가구의 안락함을 +3 높여줍니다.'
    },
    hazard_mat: {
      id: 'hazard_mat',
      name: '전술 해저드 패드',
      category: 'decor',
      layer: 'floor',
      reqHqLevel: 3,
      cost: { scrap: 4, coin: 5 },
      cozy: 3,
      cozyGroup: 'floor_hazard',
      rateTileBonus: 0.08,
      desc: '화력 거점용 전술 매트. 위에 세운 초소·포탑의 연사속도가 +8% 증가합니다.'
    },

    // ================= DEFENSE: BARRIERS & TRAPS =================
    barricade_wall: {
      id: 'barricade_wall',
      name: '철조망 바리케이드',
      category: 'defense',
      layer: 'struct',
      subType: 'wall',
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 2 },
      maxHp: 180,
      thornsRatio: 0.15,
      desc: '[3단 진화 성벽] 철조망(Lv.1) → 헤스코 방벽(Lv.2·상부 거치 해금) → 합금 장갑 성벽(Lv.3·35% 반사)으로 진화하며 인접 성벽·게이트와 자동 연결됩니다.'
    },
    tactical_gate: {
      id: 'tactical_gate',
      name: '철조망 바리케이드 통문',
      category: 'defense',
      layer: 'struct',
      subType: 'gate',
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 8 },
      maxHp: 240,
      allowWallMount: false,
      gateSlowRadius: 1.15,
      gateSlowFactor: 0.82,
      thornsRatio: 0.15,
      desc: '[3단 진화 전술 관문] 철조망 통문(1단·둔화 18%·반사 15%) → 전술 방호 게이트(2단·25%) → 전자식 쇼크 게이트(3단·40%·반사 35%). 성벽 킬존 유인 가중치(2.0) 고정 (거치 불가).'
    },
    razor_pad: {
      id: 'razor_pad',
      name: '스파이크 철조망 매트',
      category: 'defense',
      layer: 'struct',
      subType: 'trap',
      passable: true,
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 10 },
      maxHp: 180,
      trapDps: 11,
      slowFactor: 0.55,
      desc: '[3단 진화 바닥 함정] 스파이크 매트(1단·11/s·둔화 45%) → 소투스 칼날(2단·19/s·52%) → 고전압 파쇄 패드(3단·30/s·60%·피해+15%).'
    },

    // ================= DEFENSE: MANNED POSTS (Pop: 1, Power: 0) =================
    rifle_bunker: {
      id: 'rifle_bunker',
      name: '소총수 전술 벙커',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqHqLevel: 1,
      cost: { wood: 24, scrap: 10 },
      popUse: 1,
      maxHp: 210,
      range: 4.3,
      damage: 19,
      fireRate: 2.5,
      projType: 'rifle',
      canMountOnWall: true,
      mountTopOffset: 15.5,
      desc: '[요원 1명 · 무전력] 돌격소총 사수가 배치된 엄폐호. 정전 시에도 멈추지 않고 사격합니다.'
    },
    shotgun_post: {
      id: 'shotgun_post',
      name: '브리처 샷건 초소',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqHqLevel: 1,
      cost: { wood: 22, scrap: 15 },
      popUse: 1,
      maxHp: 240,
      range: 3.0,
      damage: 14,
      pellets: 4,
      spread: 0.34,
      fireRate: 1.1,
      projType: 'shotgun',
      canMountOnWall: true,
      mountTopOffset: 15,
      desc: '[요원 1명 · 무전력] 근접 저지용 전술 산탄 사수. 한 번에 4발의 산탄을 발사합니다.'
    },
    sniper_tower: {
      id: 'sniper_tower',
      name: '대물 저격 감시탑',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqHqLevel: 2,
      cost: { wood: 30, scrap: 24 },
      popUse: 1,
      maxHp: 195,
      range: 7.0,
      damage: 78,
      fireRate: 0.65,
      targetMode: 'strongest',
      projType: 'sniper',
      desc: '[요원 1명 · 무전력] 철골 감시탑 위 저격수가 장거리에서 고체력 표적을 우선 저격합니다.'
    },

    // ================= DEFENSE: AUTO TURRETS (Pop: 0, Night Power Drain) =================
    vulcan_turret: {
      id: 'vulcan_turret',
      name: 'CIWS 발칸 오토터렛',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqHqLevel: 2,
      cost: { wood: 8, scrap: 36 },
      requiresPower: true,
      powerIdle: 0.55,
      powerShot: 0.38,
      maxHp: 240,
      range: 4.6,
      damage: 13,
      fireRate: 5.6,
      projType: 'vulcan',
      canMountOnWall: true,
      mountTopOffset: 12,
      desc: '[전력 소모] 레이더 돔 탑재 고속 개틀링 포탑. 압도적인 화력을 퍼붓지만 야간 전력을 소모합니다.'
    },
    missile_pod: {
      id: 'missile_pod',
      name: '다연장 유탄 포드',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqHqLevel: 3,
      cost: { wood: 12, scrap: 48 },
      requiresPower: true,
      powerIdle: 0.85,
      powerShot: 1.9,
      maxHp: 260,
      range: 5.5,
      damage: 48,
      splashRadius: 1.35,
      fireRate: 0.78,
      projType: 'missile',
      desc: '[전력 소모] 몰려오는 좀비 무리에 고폭 마이크로 유탄을 발사해 광역 피해를 입힙니다.'
    },
    emp_coil: {
      id: 'emp_coil',
      name: '테슬라 EMP 파일런',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqHqLevel: 4,
      cost: { wood: 10, scrap: 52, coin: 15 },
      requiresPower: true,
      powerIdle: 1.0,
      powerShot: 2.3,
      maxHp: 235,
      range: 3.8,
      damage: 30,
      chainCount: 3,
      slowDuration: 1.6,
      fireRate: 0.95,
      projType: 'emp',
      desc: '[전력 소모] 최대 3기 좀비에게 연쇄 고압 전격을 날리고 이동속도를 크게 둔화시킵니다.'
    },

    // ================= INFRASTRUCTURE: POWER & HOUSING (4-Tier Evolution) =================
    solar_array: {
      id: 'solar_array',
      name: '소형 태양광 패널',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      reqHqLevel: 1,
      cost: { wood: 10, scrap: 20 },
      maxHp: 135,
      dayCharge: 38,
      nightGen: 0,
      powerCap: 15,
      cozy: 1,
      cozyGroup: 'solar_t1',
      desc: '[주간 고효율 발전 · 4단 진화] 낮 전환 시 배터리를 대량 충전합니다(야간 발전 0/s). 본부 증축 시 태양광 발전소(+220)까지 진화합니다.'
    },
    wind_turbine: {
      id: 'wind_turbine',
      name: '마이크로 풍력발전기',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      reqHqLevel: 1,
      cost: { wood: 8, scrap: 18 },
      maxHp: 140,
      dayCharge: 14,
      nightGen: 0.65,
      powerCap: 10,
      cozy: 1,
      cozyGroup: 'wind_t1',
      desc: '[24시간 풍력 · 4단 진화] 야간에도 초당 +0.65씩 실시간 전력을 공급하며, 본부 증축 시 대형 풍력발전기(+3.80/s)까지 진화합니다.'
    },
    battery_bank: {
      id: 'battery_bank',
      name: '소형 야전 배터리 팩',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 18 },
      maxHp: 165,
      dayCharge: 6,
      nightGen: 0,
      powerCap: 70,
      cozy: 1,
      cozyGroup: 'battery_t1',
      desc: '[전력 저장 · 4단 진화] 최대 전력 저장량을 확장하고 보조 충전을 제공합니다. 초전도 에너지 코어(+480)까지 진화합니다.'
    },
    field_tent: {
      id: 'field_tent',
      name: '전술 돔 막사',
      category: 'infra',
      layer: 'struct',
      subType: 'housing',
      reqHqLevel: 1,
      cost: { wood: 24, scrap: 8 },
      maxHp: 170,
      popCap: 1,
      cozy: 5,
      cozyGroup: 'housing_t1',
      lightRadius: 1.8,
      lightColor: 'rgba(255, 206, 112, 0.34)',
      desc: '[요원 숙소 · 4단 진화] 요원 수용량을 확장하고 매일 아침 신규 요원이 합류합니다. 모듈러 숙소·강화 작전 생활관(+6명)으로 진화합니다.'
    },

    // ================= MODERN DECOR & TACTICAL SUPPORT =================
    gas_heater: {
      id: 'gas_heater',
      name: '야외 가스 파티오 히터',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { wood: 10, scrap: 12 },
      maxHp: 135,
      cozy: 8,
      cozyGroup: 'decor_heater',
      lightRadius: 3.1,
      lightColor: 'rgba(255, 168, 82, 0.46)',
      aura: { radius: 2.7, mannedDmg: 0.18 },
      desc: '[무전력 조명·버프] 따뜻한 가스 온기로 반경 2.7칸 내 전투원 공격력을 +18% 높여줍니다.'
    },
    led_floodlight: {
      id: 'led_floodlight',
      name: 'LED 전술 투광등',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 16 },
      requiresPower: true,
      powerIdle: 0.4,
      maxHp: 140,
      cozy: 7,
      cozyGroup: 'decor_flood',
      lightRadius: 4.8,
      lightColor: 'rgba(94, 242, 255, 0.42)',
      aura: { radius: 3.4, rangeMult: 0.15, critChance: 0.18 },
      canMountOnWall: true,
      mountTopOffset: 16,
      desc: '[야간 전력 소모] 고광량 서치라이트. 반경 3.4칸 내 초소·포탑의 사거리 +15%, 치명타율 +18%!'
    },
    urban_planter: {
      id: 'urban_planter',
      name: '모던 콘크리트 플랜터',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { wood: 14, coin: 8 },
      maxHp: 145,
      cozy: 10,
      cozyGroup: 'decor_tree',
      lightRadius: 1.8,
      lightColor: 'rgba(180, 255, 190, 0.25)',
      desc: '어반 건축 스타일의 사각 플랜터 조경수. 기지에 생기를 불어넣어 안락함을 +10 높입니다.'
    },
    vending_machine: {
      id: 'vending_machine',
      name: '스마트 음료 자판기',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 2,
      cost: { scrap: 14, coin: 18 },
      maxHp: 165,
      cozy: 13,
      cozyGroup: 'decor_vending',
      lightRadius: 2.3,
      lightColor: 'rgba(255, 208, 148, 0.36)',
      aura: { radius: 2.7, fireRate: 0.15 },
      desc: '[내장 배터리 발광] 시원한 에너지 드링크 보급! 반경 2.7칸 내 연사속도를 +15% 높입니다.'
    },
    repair_bay: {
      id: 'repair_bay',
      name: '현장 수리 거치대',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { wood: 10, scrap: 14 },
      maxHp: 165,
      cozy: 5,
      cozyGroup: 'repair_t1',
      aura: { radius: 2.2, regenPerSec: 2.5 },
      desc: '[3단 진화 자동 수리] 수리 거치대(1단·2.2칸 +2.5/s) → 로봇 정비 베이(2단·2.6칸 +5/s) → 나노 드론 정비소(3단·3.2칸 +9.5/s·야간 조명).'
    },
    lounge_set: {
      id: 'lounge_set',
      name: '택티컬 파라솔 라운지',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 3,
      cost: { wood: 18, coin: 14 },
      maxHp: 135,
      cozy: 15,
      cozyGroup: 'decor_lounge',
      desc: '모던 테라스 파라솔과 라운지 테이블 세트. 요원들의 휴식 만족도(안락함 +15)가 크게 오릅니다.'
    },
    arcade_neon: {
      id: 'arcade_neon',
      name: '네온 아케이드 스테이션',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 4,
      cost: { scrap: 12, coin: 26 },
      requiresPower: true,
      powerIdle: 0.25,
      maxHp: 145,
      cozy: 20,
      cozyGroup: 'decor_arcade',
      lightRadius: 3.0,
      lightColor: 'rgba(235, 105, 255, 0.46)',
      desc: '[미세 전력 소모] 감성적인 사이버 네온 보드와 아케이드 게임기. 안락함을 무려 +20 높여줍니다.'
    },
    boss_trophy: {
      id: 'boss_trophy',
      name: '특수작전 홀로그램 기념비',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { coin: 40 },
      unlockedByBoss: true,
      maxHp: 280,
      cozy: 30,
      cozyGroup: 'decor_trophy',
      lightRadius: 3.4,
      lightColor: 'rgba(255, 201, 74, 0.48)',
      aura: { radius: 3.6, mannedDmg: 0.12, fireRate: 0.10 },
      desc: '[보스 격파 해금] 황금빛 전술 홀로그램 트로피. 안락함 +30 및 광역 전투 버프를 부여합니다.'
    }
  },

  ZOMBIES: {
    walker: {
      id: 'walker',
      name: '감염 보행자',
      hp: 58,
      speed: 1.05,
      damage: 14,
      attackRate: 1.0,
      scrapDrop: [2, 4],
      coinDrop: [1, 2],
      scale: 1.0,
      coatColor: PALETTE.zombieWalkerCoat,
      skinColor: PALETTE.zombieWalkerSkin,
      eyeColor: PALETTE.zombieWalkerEye,
      eyeGlow: 'rgba(255, 77, 109, 0.56)'
    },
    runner: {
      id: 'runner',
      name: '하운드 러너',
      hp: 38,
      speed: 1.95,
      damage: 11,
      attackRate: 1.4,
      scrapDrop: [2, 5],
      coinDrop: [1, 3],
      scale: 0.92,
      coatColor: PALETTE.zombieRunnerCoat,
      accentColor: PALETTE.zombieRunnerAccent,
      skinColor: PALETTE.zombieRunnerSkin,
      eyeColor: PALETTE.zombieRunnerEye,
      eyeGlow: 'rgba(255, 179, 71, 0.58)'
    },
    brute: {
      id: 'brute',
      name: '방탄복 저거너트',
      hp: 215,
      speed: 0.68,
      damage: 34,
      attackRate: 0.85,
      woodDrop: [1, 3],
      scrapDrop: [7, 12],
      coinDrop: [4, 7],
      scale: 1.32,
      coatColor: PALETTE.zombieBruteCoat,
      armorColor: PALETTE.zombieBruteArmor,
      skinColor: PALETTE.zombieBruteSkin,
      eyeColor: PALETTE.zombieBruteEye,
      eyeGlow: 'rgba(255, 77, 109, 0.62)'
    },
    spitter: {
      id: 'spitter',
      name: '애시드 스피터',
      hp: 52,
      speed: 0.95,
      damage: 13,
      attackRate: 0.75,
      attackRange: 3.2,
      scrapDrop: [3, 6],
      coinDrop: [2, 4],
      scale: 1.04,
      coatColor: PALETTE.zombieSpitterCoat,
      legColor: PALETTE.zombieSpitterLegs,
      accentColor: PALETTE.mutantAcid,
      accentDimColor: PALETTE.mutantAcidDim,
      skinColor: PALETTE.zombieSpitterSkin,
      eyeColor: PALETTE.mutantAcid,
      eyeGlow: 'rgba(200, 245, 66, 0.75)'
    },
    leaper: {
      id: 'leaper',
      name: '스토커 리퍼',
      hp: 46,
      speed: 1.75,
      damage: 15,
      attackRate: 1.25,
      scrapDrop: [3, 6],
      coinDrop: [2, 4],
      scale: 0.96,
      coatColor: PALETTE.zombieLeaperCoat,
      legColor: PALETTE.zombieLeaperLegs,
      accentColor: PALETTE.mutantBone,
      skinColor: PALETTE.zombieLeaperSkin,
      eyeColor: PALETTE.danger,
      eyeGlow: 'rgba(255, 77, 109, 0.75)'
    },
    shocker: {
      id: 'shocker',
      name: '볼트 쇼커',
      hp: 125,
      speed: 0.88,
      damage: 22,
      attackRate: 0.90,
      empRadius: 2.1,
      empDuration: 3.0,
      woodDrop: [1, 2],
      scrapDrop: [5, 9],
      coinDrop: [3, 6],
      scale: 1.16,
      coatColor: PALETTE.zombieShockerCoat,
      legColor: PALETTE.zombieShockerLegs,
      packColor: PALETTE.zombieShockerPack,
      rodColor: PALETTE.zombieShockerRod,
      accentColor: PALETTE.mutantEmp,
      sparkColor: PALETTE.mutantSpark,
      skinColor: PALETTE.zombieShockerSkin,
      eyeColor: PALETTE.mutantSpark,
      eyeGlow: 'rgba(255, 225, 77, 0.78)'
    },
    boss: {
      id: 'boss',
      name: '알파 타이탄 변이체',
      hp: 860,
      speed: 0.56,
      damage: 58,
      attackRate: 0.8,
      woodDrop: [10, 16],
      scrapDrop: [30, 42],
      coinDrop: [28, 38],
      isBoss: true,
      scale: 1.72,
      coatColor: PALETTE.zombieBossCoat,
      accentColor: PALETTE.zombieBossCrack,
      skinColor: PALETTE.zombieBossSkin,
      eyeColor: PALETTE.zombieBossEye,
      eyeGlow: 'rgba(255, 77, 109, 0.78)'
    }
  },

  TRADER_POOL: [
    {
      id: 'wood_pack',
      name: '구조용 가공 목재 번들',
      svgIcon: 'res-wood',
      svgColorCls: 'icon-wood',
      desc: '외부 벌목 기지에서 공수한 규격 목재 +65개를 즉시 수령합니다.',
      coinCost: 22,
      type: 'resource',
      give: { wood: 65 }
    },
    {
      id: 'scrap_pack',
      name: '군용 합금 고철 컨테이너',
      svgIcon: 'res-scrap',
      svgColorCls: 'icon-scrap',
      desc: '포탑과 장갑벽 제작을 위한 고순도 고철 +55개를 즉시 수령합니다.',
      coinCost: 26,
      type: 'resource',
      give: { scrap: 55 }
    },
    {
      id: 'power_cell',
      name: '과충전 급속 파워셀',
      svgIcon: 'res-power',
      svgColorCls: 'icon-power',
      desc: '기지 배터리를 즉시 +70 충전합니다 (최대 저장량의 130%까지 과충전 가능!).',
      coinCost: 20,
      type: 'power_boost',
      amount: 70
    },
    {
      id: 'hire_agent',
      name: '베테랑 전술 요원 스카우트',
      svgIcon: 'res-agent',
      svgColorCls: '',
      desc: '숙소 빈자리에 즉시 작전 요원 +1명을 영입합니다 (빈 숙소 수용량 필요).',
      coinCost: 28,
      type: 'agent',
      amount: 1
    },
    {
      id: 'crate_vending',
      name: '보급품: 스마트 음료 자판기',
      desc: '고철 소비 없이 코인만으로 무료 설치권 1개를 확보합니다 (연사속도 오라!).',
      coinCost: 24,
      type: 'free_item',
      itemId: 'vending_machine'
    },
    {
      id: 'crate_arcade',
      name: '보급품: 네온 아케이드 스테이션',
      desc: '안락함 +20 최고급 네온 아케이드 무료 설치권 1개를 확보합니다.',
      coinCost: 28,
      type: 'free_item',
      itemId: 'arcade_neon'
    },
    {
      id: 'crate_pod',
      name: '프리팹: 모듈러 컨테이너 숙소',
      desc: '목재·고철 없이 모듈러 컨테이너 숙소(3단계 · 수용 +4명) 1회 무료 배치권을 확보합니다.',
      coinCost: 36,
      type: 'free_item',
      itemId: 'field_tent',
      spawnTier: 3,
      voucherKey: 'shelter_pod'
    },
    {
      id: 'crate_emp',
      name: '특수병기: 테슬라 EMP 파일런',
      desc: '고철 소비 없이 첨단 연쇄 전격 포탑 무료 설치권 1개를 확보합니다.',
      coinCost: 44,
      type: 'free_item',
      itemId: 'emp_coil'
    }
  ],

  TRADER_EXCHANGE_ROUTES: [
    { id: 'scrap_to_wood', from: 'scrap', to: 'wood', cost: 20, give: 24, label: '고철 → 목재' },
    { id: 'coin_to_wood',  from: 'coin',  to: 'wood', cost: 10, give: 22, label: '코인 → 목재' },
    { id: 'coin_to_scrap', from: 'coin',  to: 'scrap', cost: 12, give: 20, label: '코인 → 고철' },
    { id: 'scrap_to_coin', from: 'scrap', to: 'coin', cost: 28, give: 10, label: '고철 → 코인' },
    { id: 'wood_to_coin',  from: 'wood',  to: 'coin', cost: 35, give: 10, label: '목재 → 코인' }
  ],

  TRADER_NIGHT_CONSUMABLES: [
    {
      id: 'overpressure_ammo',
      stateKey: 'overpressureAmmo',
      name: '고압 탄약 보급',
      svgIcon: 'cat-defense',
      svgColorCls: 'icon-coin',
      baseScrap: 45,
      scrapPerWave: 8,
      baseCoin: 25,
      coinPerWave: 4,
      desc: '다음 1회 야간 웨이브 동안 모든 아군 초소·포탑·본부 화력 +20% (새벽 정산 시 자동 해제).'
    },
    {
      id: 'reactive_armor',
      stateKey: 'reactiveArmor',
      name: '반응 장갑 코팅',
      svgIcon: 'wall-upgrade',
      svgColorCls: 'icon-heal',
      baseScrap: 40,
      scrapPerWave: 8,
      baseCoin: 22,
      coinPerWave: 4,
      desc: '다음 1회 야간 웨이브 동안 모든 성벽·게이트·전초기지 피격 피해 -20% 및 근접 반사 +15%p (새벽 정산 시 자동 해제).'
    }
  ]
  };
})();
