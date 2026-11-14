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

    // 3. World Base Tokens (issue-03-palette-tokens.md §3: keep terrain #485E4D/#415646 until #5)
    groundA: '#485E4D',
    groundB: '#415646',
    groundEdge: '#4A4F48',
    terrainA: '#485E4D',
    terrainB: '#415646',
    terrainEdgeA: '#3C4B42',
    terrainEdgeB: '#36443B',
    slabSideLeft: '#3A3027',
    slabSideRight: '#2C241D',
    baseLight: '#FFD27A',
    nightOverlay: 'rgb(7, 13, 25)',
    outlineDark: '#1B2430',
    resWood: '#D49A5A',
    resScrap: '#AEB8C4',
    warmGlow: 'rgba(255, 210, 122, 0.42)',

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
    zombieBossEye: '#FF4D6D'
  };

  return {
  VERSION: 'v0.1.0',
  GRID_SIZE: 18,
  HQ_POS: { x: 8, y: 8 },
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

  COZY_TIERS: [
    { level: 1, min: 0,   title: '임시 전초기지',     agentDmg: 0,    fireRate: 0,    coinBonus: 0,    freeRepair: 0.15 },
    { level: 2, min: 20,  title: '정비된 작전소',     agentDmg: 0.10, fireRate: 0.04, coinBonus: 0.12, freeRepair: 0.30 },
    { level: 3, min: 50,  title: '모던 전술 쉘터',    agentDmg: 0.20, fireRate: 0.08, coinBonus: 0.25, freeRepair: 0.50 },
    { level: 4, min: 95,  title: '하이라이즈 아웃포스트', agentDmg: 0.32, fireRate: 0.13, coinBonus: 0.40, freeRepair: 0.70 },
    { level: 5, min: 150, title: '네오 어반 요새',    agentDmg: 0.45, fireRate: 0.18, coinBonus: 0.55, freeRepair: 0.85 },
    { level: 6, min: 220, title: '엘리트 파라다이스', agentDmg: 0.60, fireRate: 0.25, coinBonus: 0.75, freeRepair: 1.00 }
  ],

  CATEGORIES: [
    { id: 'defense', label: '🛡️ 방어·화력', desc: '방벽, 무전력 요원 초소, 전력 자동포탑' },
    { id: 'infra',   label: '⚡ 전력·숙소', desc: '주간 충전 발전기, 배터리, 요원 숙소' },
    { id: 'decor',   label: '✨ 모던 꾸미기', desc: '바닥재, 전술 조명, 라운지 가구 & 버프' }
  ],

  ITEMS: {
    // ================= FLOORS (layer: 'floor') =================
    asphalt: {
      id: 'asphalt',
      name: '전술 아스팔트',
      category: 'decor',
      layer: 'floor',
      icon: '🛣️',
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
      icon: '🔩',
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
      icon: '⬜',
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
      icon: '⚠️',
      cost: { scrap: 4, coin: 5 },
      cozy: 3,
      cozyGroup: 'floor_hazard',
      rateTileBonus: 0.08,
      desc: '화력 거점용 전술 매트. 위에 세운 초소·포탑의 연사속도가 +8% 증가합니다.'
    },

    // ================= DEFENSE: BARRIERS & TRAPS =================
    hesco_wall: {
      id: 'hesco_wall',
      name: '헤스코 전술 방벽',
      category: 'defense',
      layer: 'struct',
      subType: 'wall',
      icon: '🧱',
      cost: { wood: 10, scrap: 4 },
      maxHp: 260,
      desc: '철망 프레임과 고밀도 충진재로 구성된 현대 군용 표준 바리케이드입니다.'
    },
    blast_wall: {
      id: 'blast_wall',
      name: '합금 장갑 방벽',
      category: 'defense',
      layer: 'struct',
      subType: 'wall',
      icon: '🛡️',
      cost: { wood: 6, scrap: 18 },
      maxHp: 560,
      desc: '중장갑 강철 경사 장갑판으로 제작되어 브루트 좀비의 돌파도 오래 버텨냅니다.'
    },
    razor_pad: {
      id: 'razor_pad',
      name: '고장력 철조망 패드',
      category: 'defense',
      layer: 'struct',
      subType: 'trap',
      passable: true,
      icon: '🕸️',
      cost: { wood: 6, scrap: 10 },
      maxHp: 180,
      trapDps: 11,
      slowFactor: 0.55,
      desc: '[무전력 함정] 좀비가 밟고 지나가며 이동속도가 45% 감소하고 지속 피해를 입습니다.'
    },

    // ================= DEFENSE: MANNED POSTS (Pop: 1, Power: 0) =================
    rifle_bunker: {
      id: 'rifle_bunker',
      name: '소총수 전술 벙커',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      icon: '🪖',
      cost: { wood: 24, scrap: 10 },
      popUse: 1,
      maxHp: 210,
      range: 4.3,
      damage: 19,
      fireRate: 2.5,
      projType: 'rifle',
      desc: '[👥요원 1명 · 무전력] 돌격소총 사수가 배치된 엄폐호. 정전 시에도 멈추지 않고 사격합니다.'
    },
    shotgun_post: {
      id: 'shotgun_post',
      name: '브리처 샷건 초소',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      icon: '💥',
      cost: { wood: 22, scrap: 15 },
      popUse: 1,
      maxHp: 240,
      range: 3.0,
      damage: 14,
      pellets: 4,
      spread: 0.34,
      fireRate: 1.1,
      projType: 'shotgun',
      desc: '[👥요원 1명 · 무전력] 근접 저지용 전술 산탄 사수. 한 번에 4발의 산탄을 발사합니다.'
    },
    sniper_tower: {
      id: 'sniper_tower',
      name: '대물 저격 감시탑',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      icon: '🎯',
      cost: { wood: 30, scrap: 24 },
      popUse: 1,
      maxHp: 195,
      range: 7.0,
      damage: 78,
      fireRate: 0.65,
      targetMode: 'strongest',
      projType: 'sniper',
      desc: '[👥요원 1명 · 무전력] 철골 감시탑 위 저격수가 장거리에서 고체력 표적을 우선 저격합니다.'
    },

    // ================= DEFENSE: AUTO TURRETS (Pop: 0, Night Power Drain) =================
    vulcan_turret: {
      id: 'vulcan_turret',
      name: 'CIWS 발칸 오토터렛',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      icon: '🔫',
      cost: { wood: 8, scrap: 36 },
      requiresPower: true,
      powerIdle: 0.55,
      powerShot: 0.38,
      maxHp: 240,
      range: 4.6,
      damage: 13,
      fireRate: 5.6,
      projType: 'vulcan',
      desc: '[⚡전력 소모] 레이더 돔 탑재 고속 개틀링 포탑. 압도적인 화력을 퍼붓지만 야간 전력을 소모합니다.'
    },
    missile_pod: {
      id: 'missile_pod',
      name: '다연장 유탄 포드',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      icon: '🚀',
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
      desc: '[⚡전력 소모] 몰려오는 좀비 무리에 고폭 마이크로 유탄을 발사해 광역 피해를 입힙니다.'
    },
    emp_coil: {
      id: 'emp_coil',
      name: '테슬라 EMP 파일런',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      icon: '⚡',
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
      desc: '[⚡전력 소모] 최대 3기 좀비에게 연쇄 고압 전격을 날리고 이동속도를 크게 둔화시킵니다.'
    },

    // ================= INFRASTRUCTURE: POWER & HOUSING =================
    solar_array: {
      id: 'solar_array',
      name: '고효율 태양광 어레이',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      icon: '☀️',
      cost: { wood: 10, scrap: 22 },
      maxHp: 155,
      dayCharge: 36,
      powerCap: 15,
      cozy: 2,
      cozyGroup: 'infra_solar',
      desc: '낮 전환 시 배터리를 +36⚡ 충전하며 최대 저장 용량도 +15⚡ 늘려줍니다.'
    },
    wind_turbine: {
      id: 'wind_turbine',
      name: '마이크로 풍력 터빈',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      icon: '🌬️',
      cost: { wood: 14, scrap: 38 },
      maxHp: 175,
      dayCharge: 68,
      powerCap: 25,
      cozy: 4,
      cozyGroup: 'infra_wind',
      desc: '매끈하게 회전하는 현대식 터빈. 낮마다 +68⚡ 대량 충전 및 용량 +25⚡를 제공합니다.'
    },
    battery_bank: {
      id: 'battery_bank',
      name: '리튬 ESS 배터리 뱅크',
      category: 'infra',
      layer: 'struct',
      subType: 'power',
      icon: '🔋',
      cost: { wood: 8, scrap: 28 },
      maxHp: 215,
      dayCharge: 12,
      powerCap: 95,
      cozy: 2,
      cozyGroup: 'infra_ess',
      desc: '대용량 에너지 저장 장치. 최대 전력 저장량을 +95⚡ 확장하고 +12⚡ 보조 충전합니다.'
    },
    field_tent: {
      id: 'field_tent',
      name: '전술 돔 막사',
      category: 'infra',
      layer: 'struct',
      subType: 'housing',
      icon: '⛺',
      cost: { wood: 26, scrap: 8 },
      maxHp: 165,
      popCap: 1,
      cozy: 5,
      cozyGroup: 'housing_tent',
      desc: '최대 요원 수용량 +1👥 확장 (빈자리가 있으면 매일 아침 신규 요원이 합류합니다).'
    },
    shelter_pod: {
      id: 'shelter_pod',
      name: '모듈러 컨테이너 숙소',
      category: 'infra',
      layer: 'struct',
      subType: 'housing',
      icon: '🏢',
      cost: { wood: 32, scrap: 26, coin: 15 },
      maxHp: 245,
      popCap: 2,
      cozy: 12,
      cozyGroup: 'housing_pod',
      lightRadius: 2.2,
      lightColor: 'rgba(255, 214, 145, 0.35)',
      desc: '냉난방이 완비된 모던 모듈러 생활관. 수용량 +2👥 및 높은 안락함(+12)을 제공합니다.'
    },

    // ================= MODERN DECOR & TACTICAL SUPPORT =================
    gas_heater: {
      id: 'gas_heater',
      name: '야외 가스 파티오 히터',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      icon: '🔥',
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
      icon: '🔦',
      cost: { wood: 6, scrap: 16 },
      requiresPower: true,
      powerIdle: 0.4,
      maxHp: 140,
      cozy: 7,
      cozyGroup: 'decor_flood',
      lightRadius: 4.8,
      lightColor: 'rgba(94, 242, 255, 0.42)',
      aura: { radius: 3.4, rangeMult: 0.15, critChance: 0.18 },
      desc: '[⚡야간 소모] 고광량 서치라이트. 반경 3.4칸 내 초소·포탑의 사거리 +15%, 치명타율 +18%!'
    },
    urban_planter: {
      id: 'urban_planter',
      name: '모던 콘크리트 플랜터',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      icon: '🌳',
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
      icon: '🥤',
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
      name: '필드 로봇 정비 베이',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      icon: '🔧',
      cost: { wood: 10, scrap: 26, coin: 12 },
      maxHp: 210,
      cozy: 8,
      cozyGroup: 'decor_repair',
      aura: { radius: 2.6, regenPerSec: 4.5 },
      desc: '반경 2.6칸 내 손상된 방벽과 시설을 전투 중에도 초당 4.5 HP씩 실시간 자동 수리합니다.'
    },
    lounge_set: {
      id: 'lounge_set',
      name: '택티컬 파라솔 라운지',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      icon: '⛱️',
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
      icon: '🕹️',
      cost: { scrap: 12, coin: 26 },
      requiresPower: true,
      powerIdle: 0.25,
      maxHp: 145,
      cozy: 20,
      cozyGroup: 'decor_arcade',
      lightRadius: 3.0,
      lightColor: 'rgba(235, 105, 255, 0.46)',
      desc: '[⚡미세 전력] 감성적인 사이버 네온 보드와 아케이드 게임기. 안락함을 무려 +20 높여줍니다.'
    },
    boss_trophy: {
      id: 'boss_trophy',
      name: '특수작전 홀로그램 기념비',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      icon: '🏆',
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
      scrapDrop: [7, 12],
      coinDrop: [4, 7],
      scale: 1.32,
      coatColor: PALETTE.zombieBruteCoat,
      armorColor: PALETTE.zombieBruteArmor,
      skinColor: PALETTE.zombieBruteSkin,
      eyeColor: PALETTE.zombieBruteEye,
      eyeGlow: 'rgba(255, 77, 109, 0.62)'
    },
    boss: {
      id: 'boss',
      name: '알파 타이탄 변이체',
      hp: 860,
      speed: 0.56,
      damage: 58,
      attackRate: 0.8,
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
      icon: '🪵',
      desc: '외부 벌목 기지에서 공수한 규격 목재 +65개를 즉시 수령합니다.',
      coinCost: 22,
      type: 'resource',
      give: { wood: 65 }
    },
    {
      id: 'scrap_pack',
      name: '군용 합금 고철 컨테이너',
      icon: '🔩',
      desc: '포탑과 장갑벽 제작을 위한 고순도 고철 +55개를 즉시 수령합니다.',
      coinCost: 26,
      type: 'resource',
      give: { scrap: 55 }
    },
    {
      id: 'power_cell',
      name: '과충전 급속 파워셀',
      icon: '⚡',
      desc: '기지 배터리를 즉시 +70⚡ 충전합니다 (최대 저장량의 130%까지 과충전 가능!).',
      coinCost: 20,
      type: 'power_boost',
      amount: 70
    },
    {
      id: 'hire_agent',
      name: '베테랑 전술 요원 스카우트',
      icon: '🪖',
      desc: '숙소 빈자리에 즉시 작전 요원 +1명을 영입합니다 (빈 숙소 수용량 필요).',
      coinCost: 28,
      type: 'agent',
      amount: 1
    },
    {
      id: 'crate_vending',
      name: '보급품: 스마트 음료 자판기',
      icon: '🥤',
      desc: '고철 소비 없이 코인만으로 무료 설치권 1개를 확보합니다 (연사속도 오라!).',
      coinCost: 24,
      type: 'free_item',
      itemId: 'vending_machine'
    },
    {
      id: 'crate_arcade',
      name: '보급품: 네온 아케이드 스테이션',
      icon: '🕹️',
      desc: '안락함 +20 최고급 네온 아케이드 무료 설치권 1개를 확보합니다.',
      coinCost: 28,
      type: 'free_item',
      itemId: 'arcade_neon'
    },
    {
      id: 'crate_pod',
      name: '프리팹: 모듈러 컨테이너 숙소',
      icon: '🏢',
      desc: '목재·고철 없이 모듈러 2인 숙소 무료 설치권 1개를 확보합니다.',
      coinCost: 36,
      type: 'free_item',
      itemId: 'shelter_pod'
    },
    {
      id: 'crate_emp',
      name: '특수병기: 테슬라 EMP 파일런',
      icon: '⚡',
      desc: '고철 소비 없이 첨단 연쇄 전격 포탑 무료 설치권 1개를 확보합니다.',
      coinCost: 44,
      type: 'free_item',
      itemId: 'emp_coil'
    }
  ]
  };
})();
