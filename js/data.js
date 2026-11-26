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
    habitatRoof: '#C86438',
    repairNano: '#4ADE80',

    // 7. Diorama Military Material Tokens (#95)
    milOlive: '#6B7A5E',
    milOliveDark: '#4D5943',
    milOliveLight: '#859576',
    milSand: '#B7A179',
    milSandDark: '#8F7B56',
    milSandSeam: '#6D5C3E',
    milGunmetal: '#3B4552',
    milGunmetalDark: '#262E38',
    milSlate: '#525E6B',
    milSteelTrim: '#8A96A4',
    milBrushed: '#B8C4D0',
    milSolarCell: '#1A3048',
    milSolarCellDeep: '#122235',
    milSolarGrid: '#89A1B8',
    milSolarGlint: '#B8D0E6',
    hqAmberCore: '#FFF3D6',
    hqGoldTrim: '#E2A83B',

    // 8. Procedural Terrain Tokens (#67 — zero #5EF2FF cyan!)
    rockBase: '#5B646F',
    rockDark: '#3D444D',
    rockMoss: '#5D7455',
    rockPeakBase: '#4B525B',
    rockPeakDark: '#2F353D',
    rockPeakCap: '#6E7680',
    plateauCliffSlate: '#424A56',
    plateauCliffOchre: '#8E6A42',
    plateauCliffSoil: '#473628',
    plateauTopA: '#5D775A',
    plateauTopB: '#577054',
    plateauRimSoft: 'rgba(176, 196, 152, 0.28)',
    rampStone: '#7E786C',
    rampCurb: '#535B65',
    rampEarth: '#6B665D',
    rampEarthDark: '#534E46',
    rampFlagstone: '#7E786E'
  };

  // Structures & upgrades unlock via the 5-branch RP Tech Tree gated by HQ Lv.1~5
  const WALL_TIERS = {
    1: { level: 1, name: '철조망 바리케이드', reqTech: null, cost: { wood: 6, scrap: 2 }, maxHp: 180, thornsRatio: 0.15, thornsMin: 4, allowWallMount: false, mountBaseZ: 0, topZ: 10.9 },
    2: { level: 2, name: '헤스코 전술 방벽', reqTech: 'def_t1', upCost: { wood: 8, scrap: 6 }, maxHp: 360, thornsRatio: 0, thornsMin: 0, allowWallMount: true, mountBaseZ: 15.2, topZ: 14.0 },
    3: { level: 3, name: '합금 장갑 성벽', reqTech: 'def_t2', upCost: { wood: 6, scrap: 18, coin: 6 }, maxHp: 640, thornsRatio: 0.35, thornsMin: 8, allowWallMount: true, mountBaseZ: 25.4, topZ: 27.7 }
  };

  const SOLAR_TIERS = {
    1: { level: 1, name: '소형 태양광 패널', reqTech: null, cost: { wood: 10, scrap: 20 }, maxHp: 135, dayCharge: 28, nightGen: 0, powerCap: 15, cozy: 1, cozyGroup: 'infra_solar', topZ: 12 },
    2: { level: 2, name: '중형 태양광 패널', reqTech: 'inf_tier2', upCost: { wood: 6, scrap: 34, coin: 10 }, maxHp: 195, dayCharge: 56, nightGen: 0, powerCap: 28, cozy: 3, cozyGroup: 'infra_solar', topZ: 17 },
    3: { level: 3, name: '태양광 발전기', reqTech: 'inf_tier3', upCost: { wood: 8, scrap: 56, coin: 24 }, maxHp: 270, dayCharge: 100, nightGen: 0, powerCap: 45, cozy: 5, cozyGroup: 'infra_solar', topZ: 24 },
    4: { level: 4, name: '태양광 발전소', reqTech: 'inf_tier4', upCost: { wood: 10, scrap: 92, coin: 48 }, maxHp: 370, dayCharge: 165, nightGen: 0, powerCap: 75, cozy: 8, cozyGroup: 'infra_solar', topZ: 34 }
  };

  const WIND_TIERS = {
    1: { level: 1, name: '마이크로 풍력발전기', reqTech: null, cost: { wood: 8, scrap: 18 }, maxHp: 140, dayCharge: 14, nightGen: 0.65, powerCap: 10, cozy: 1, cozyGroup: 'infra_wind', topZ: 34 },
    2: { level: 2, name: '소형 풍력발전기', reqTech: 'inf_tier2', upCost: { wood: 6, scrap: 32, coin: 10 }, maxHp: 195, dayCharge: 28, nightGen: 1.35, powerCap: 18, cozy: 3, cozyGroup: 'infra_wind', topZ: 46 },
    3: { level: 3, name: '중형 풍력발전기', reqTech: 'inf_tier3', upCost: { wood: 8, scrap: 54, coin: 24 }, maxHp: 265, dayCharge: 48, nightGen: 2.40, powerCap: 30, cozy: 5, cozyGroup: 'infra_wind', topZ: 60 },
    4: { level: 4, name: '대형 풍력발전기', reqTech: 'inf_tier4', upCost: { wood: 10, scrap: 88, coin: 46 }, maxHp: 360, dayCharge: 75, nightGen: 3.80, powerCap: 50, cozy: 8, cozyGroup: 'infra_wind', topZ: 74 }
  };

  const BATTERY_TIERS = {
    1: { level: 1, name: '소형 야전 배터리 팩', reqTech: null, cost: { wood: 6, scrap: 18 }, maxHp: 165, powerCap: 60, dayCharge: 4, nightGen: 0, cozy: 1, cozyGroup: 'infra_battery', topZ: 14 },
    2: { level: 2, name: '중형 배터리 팩', reqTech: 'inf_tier2', upCost: { wood: 4, scrap: 30, coin: 12 }, maxHp: 230, powerCap: 135, dayCharge: 10, nightGen: 0, cozy: 2, cozyGroup: 'infra_battery', topZ: 22 },
    3: { level: 3, name: '리튬 ESS 배터리 뱅크', reqTech: 'inf_tier3', upCost: { wood: 6, scrap: 48, coin: 26 }, maxHp: 300, powerCap: 250, dayCharge: 18, nightGen: 0, cozy: 4, cozyGroup: 'infra_battery', topZ: 33 },
    4: { level: 4, name: '초전도 에너지 코어', reqTech: 'inf_tier4', upCost: { wood: 8, scrap: 82, coin: 48 }, maxHp: 400, powerCap: 410, dayCharge: 30, nightGen: 0, cozy: 7, cozyGroup: 'infra_battery', topZ: 40 }
  };

  const BARRACKS_TIERS = {
    1: { level: 1, name: '전술 돔 막사', reqTech: null, cost: { wood: 85, scrap: 35 }, maxHp: 170, popCap: 4, cozy: 5, cozyGroup: 'infra_housing', lightRadius: 1.8, lightColor: 'rgba(255, 206, 112, 0.34)', topZ: 16 },
    2: { level: 2, name: '확장형 야전 막사', reqTech: 'inf_tier2', upCost: { wood: 60, scrap: 75, coin: 35 }, maxHp: 230, popCap: 6, cozy: 10, cozyGroup: 'infra_housing', lightRadius: 2.0, lightColor: 'rgba(255, 206, 112, 0.35)', topZ: 19 },
    3: { level: 3, name: '모듈러 컨테이너 숙소', reqTech: 'inf_tier3', upCost: { wood: 90, scrap: 140, coin: 75 }, maxHp: 310, popCap: 12, cozy: 18, cozyGroup: 'infra_housing', lightRadius: 2.3, lightColor: 'rgba(255, 214, 145, 0.36)', topZ: 22 },
    4: { level: 4, name: '강화 작전 생활관', reqTech: 'inf_tier4', upCost: { wood: 140, scrap: 240, coin: 140 }, maxHp: 420, popCap: 24, cozy: 28, cozyGroup: 'infra_housing', lightRadius: 2.7, lightColor: 'rgba(255, 214, 145, 0.38)', topZ: 32 }
  };

  const WORKSHOP_TIERS = {
    1: { level: 1, name: '작업장', reqTech: null, cost: { wood: 45, scrap: 20 }, maxHp: 150, prodSlots: 2, cozy: 3, cozyGroup: 'infra_workshop', lightRadius: 0, topZ: 17 },
    2: { level: 2, name: '보급창고', reqTech: 'inf_tier3', upCost: { wood: 55, scrap: 50, coin: 25 }, maxHp: 240, prodSlots: 4, cozy: 6, cozyGroup: 'infra_workshop', lightRadius: 0, topZ: 21 },
    3: { level: 3, name: '보급소', reqTech: 'inf_tier4', upCost: { wood: 80, scrap: 95, coin: 55 }, maxHp: 360, prodSlots: 6, cozy: 10, cozyGroup: 'infra_workshop', lightRadius: 0, topZ: 25 }
  };

  const RESEARCH_LAB_TIERS = {
    1: { level: 1, name: '연구막사', reqTech: null, cost: { wood: 40, scrap: 25 }, maxHp: 140, researchSlots: 2, cozy: 4, cozyGroup: 'infra_lab', lightRadius: 0, topZ: 17 },
    2: { level: 2, name: '연구창고', reqTech: 'inf_tier3', upCost: { wood: 50, scrap: 55, coin: 30 }, maxHp: 220, researchSlots: 4, cozy: 7, cozyGroup: 'infra_lab', lightRadius: 0, topZ: 21 },
    3: { level: 3, name: '연구소', reqTech: 'inf_tier4', upCost: { wood: 75, scrap: 105, coin: 60 }, maxHp: 340, researchSlots: 6, cozy: 11, cozyGroup: 'infra_lab', lightRadius: 0, topZ: 25 }
  };

  const GATE_TIERS = {
    1: { level: 1, name: '철조망 바리케이드 통문', reqTech: null, cost: { wood: 6, scrap: 8 }, maxHp: 240, gateSlowRadius: 1.15, gateSlowFactor: 0.82, thornsRatio: 0.15, thornsMin: 4, allowWallMount: false, topZ: 16.5 },
    2: { level: 2, name: '전술 방호 게이트', reqTech: 'def_t1', upCost: { wood: 8, scrap: 14, coin: 6 }, maxHp: 480, gateSlowRadius: 1.15, gateSlowFactor: 0.75, thornsRatio: 0, thornsMin: 0, allowWallMount: false, topZ: 26.5 },
    3: { level: 3, name: '전자식 쇼크 게이트', reqTech: 'def_t2', upCost: { wood: 12, scrap: 28, coin: 18 }, maxHp: 880, gateSlowRadius: 1.25, gateSlowFactor: 0.60, thornsRatio: 0.35, thornsMin: 8, allowWallMount: false, topZ: 28.0 }
  };

  const TRAP_TIERS = {
    1: { level: 1, name: '강철 스파이크 트랩', reqTech: null, cost: { wood: 6, scrap: 10 }, maxHp: 180, trapDps: 11, trapWear: 3.2, slowFactor: 0.55, vulnMult: 1.0, topZ: 5.4 },
    2: { level: 2, name: '중장갑 피스톤 스파이크 트랩', reqTech: 'def_t1', upCost: { wood: 8, scrap: 14, coin: 8 }, maxHp: 270, trapDps: 19, trapWear: 2.4, slowFactor: 0.48, vulnMult: 1.0, topZ: 5.8 },
    3: { level: 3, name: '고전압 피에조 스파이크 트랩', reqTech: 'def_t2', upCost: { wood: 10, scrap: 22, coin: 20 }, maxHp: 390, trapDps: 30, trapWear: 2.0, slowFactor: 0.40, vulnMult: 1.15, topZ: 6.45 }
  };

  const REPAIR_TIERS = {
    1: { level: 1, name: '현장 수리 거치대', reqTech: null, cost: { wood: 10, scrap: 14 }, maxHp: 165, auraRadius: 2.2, regenPerSec: 2.5, cozy: 5, cozyGroup: 'repair_t1', lightRadius: 0, topZ: 18 },
    2: { level: 2, name: '필드 로봇 정비 베이', reqTech: 'inf_tier2', upCost: { wood: 8, scrap: 18, coin: 12 }, maxHp: 230, auraRadius: 2.6, regenPerSec: 5.0, cozy: 9, cozyGroup: 'repair_t2', lightRadius: 0, topZ: 25 },
    3: { level: 3, name: '나노 드론 정비소', reqTech: 'inf_tier3', upCost: { wood: 12, scrap: 32, coin: 24 }, maxHp: 320, auraRadius: 3.2, regenPerSec: 9.5, cozy: 15, cozyGroup: 'repair_t3', lightRadius: 2.2, lightColor: 'rgba(74, 222, 128, 0.32)', topZ: 30 }
  };

  const TIER_MAPS = {
    barricade_wall: WALL_TIERS,
    solar_array: SOLAR_TIERS,
    wind_turbine: WIND_TIERS,
    battery_bank: BATTERY_TIERS,
    field_tent: BARRACKS_TIERS,
    supply_workshop: WORKSHOP_TIERS,
    research_lab: RESEARCH_LAB_TIERS,
    tactical_gate: GATE_TIERS,
    razor_pad: TRAP_TIERS,
    repair_bay: REPAIR_TIERS
  };

  return {
  VERSION: 'v0.8.1',
  GRID_SIZE: 26,
  HQ_POS: { x: 13, y: 13 },
  B1_SIZE: 23,
  B1_ELEVATOR_POS: { x: 11, y: 11 },
  B1_ROCK_Z: 11,
  B1_WALL_Z: 10,
  B1_ROOMS: {
    quarters: {
      id: 'quarters',
      name: '생활관',
      accent: '#E8A848',
      floorTint: '#656E78',
      iconId: 'b1-quarters',
      desc: '작전 요원 주거·휴식 구역 (전술 침대·관물대·샤워 부스·공기청정기 배치)'
    },
    research_lab: {
      id: 'research_lab',
      name: '연구실',
      accent: '#C084FC',
      floorTint: '#666E7C',
      iconId: 'b1-lab',
      desc: '연구 데이터 분석 및 RP 증폭 구역 (연구 데스크·서버 랙·표본 분석대·홀로 테이블 배치)'
    },
    supply_depot: {
      id: 'supply_depot',
      name: '보급 창고',
      accent: '#D49A5A',
      floorTint: '#686F76',
      iconId: 'b1-supply',
      desc: '자재·고철 비축 및 물류 관제 구역 (파렛트 랙·물류 단말기 배치)'
    },
    lounge: {
      id: 'lounge',
      name: '휴게실',
      accent: '#4ADE80',
      floorTint: '#626F75',
      iconId: 'b1-lounge',
      desc: '생존자 사기 회복 및 안락함 지원 구역 (자판기·라운지·커피 바·아케이드·미디어 스크린 배치)'
    },
    power_vault: {
      id: 'power_vault',
      name: '지하 축전실',
      accent: '#E07A38',
      floorTint: '#616B77',
      iconId: 'b1-vault',
      desc: '피격 면역 비상 축전·배전 구역 (ESS 배터리 랙·배전 제어반·비상 보조 발전기 배치)'
    }
  },
  B1_ROOM_ORDER: ['quarters', 'research_lab', 'supply_depot', 'lounge', 'power_vault'],
  B1_CATEGORIES: [
    { id: 'b1_ops',     iconId: 'b1-ops',     label: '굴착·구역·방폭문',   desc: '암반 굴착, 전술 복도·5대 방 구역 지정·해제 및 3D 방폭문 연결' },
    { id: 'b1_living',  iconId: 'b1-living',  label: '생활관·휴게실',       desc: '생활관(4종) & 휴게실(5종) 지하 설비 배치' },
    { id: 'b1_systems', iconId: 'b1-systems', label: '연구·보급·축전·공용', desc: '연구실(4종)·보급 창고(2종)·지하 축전실(3종)·공용 조명(1종)' }
  ],
  B1_TOOLS: [
    {
      id: 'b1_dig',
      mode: 'b1_dig',
      name: '암반 굴착',
      iconId: 'b1-dig',
      tag: '인접 굴착',
      costLabel: '1~3 AP',
      accent: '#F59E0B',
      desc: '열린 공간과 상하좌우 인접한 비기반암 암반을 클릭 또는 드래그해 굴착합니다. 거리별 1/2/3 AP 소모.'
    },
    {
      id: 'b1_door',
      mode: 'b1_door',
      name: '방폭문',
      iconId: 'b1-door',
      tag: '격벽 연결',
      costLabel: '무료',
      accent: '#F59E0B',
      desc: '전술 복도와 방 구역 사이의 콘크리트 격벽을 클릭해 3D 방폭문을 설치·제거합니다. 승강기와 복도·방폭문으로 연결된 방만 활성화됩니다.'
    },
    {
      id: 'b1_zone_corridor',
      mode: 'b1_zone',
      role: 'corridor',
      name: '전술 복도',
      iconId: 'b1-corridor',
      tag: '드래그 시공',
      costLabel: '무료 통로',
      accent: '#94A3B8',
      desc: '드래그로 굴착된 흙바닥에 강철 그레이트 전술 복도를 시공합니다. 승강기와 복도·방폭문으로 연결된 방만 활성화됩니다.'
    },
    {
      id: 'b1_zone_quarters',
      mode: 'b1_zone',
      role: 'quarters',
      name: '생활관 구역',
      iconId: 'b1-quarters',
      tag: '드래그 지정',
      costLabel: '생활관',
      accent: '#E8A848',
      desc: '드래그로 생활관 구역을 지정해 전술 콘크리트 바닥과 자동 격벽을 형성합니다.'
    },
    {
      id: 'b1_zone_research_lab',
      mode: 'b1_zone',
      role: 'research_lab',
      name: '연구실 구역',
      iconId: 'b1-lab',
      tag: '드래그 지정',
      costLabel: '연구실',
      accent: '#C084FC',
      desc: '드래그로 연구실 구역을 지정해 전술 콘크리트 바닥과 자동 격벽을 형성합니다.'
    },
    {
      id: 'b1_zone_supply_depot',
      mode: 'b1_zone',
      role: 'supply_depot',
      name: '보급 창고 구역',
      iconId: 'b1-supply',
      tag: '드래그 지정',
      costLabel: '보급 창고',
      accent: '#D49A5A',
      desc: '드래그로 보급 창고 구역을 지정해 전술 콘크리트 바닥과 자동 격벽을 형성합니다.'
    },
    {
      id: 'b1_zone_lounge',
      mode: 'b1_zone',
      role: 'lounge',
      name: '휴게실 구역',
      iconId: 'b1-lounge',
      tag: '드래그 지정',
      costLabel: '휴게실',
      accent: '#4ADE80',
      desc: '드래그로 휴게실 구역을 지정해 전술 콘크리트 바닥과 자동 격벽을 형성합니다.'
    },
    {
      id: 'b1_zone_power_vault',
      mode: 'b1_zone',
      role: 'power_vault',
      name: '지하 축전실 구역',
      iconId: 'b1-vault',
      tag: '드래그 지정',
      costLabel: '축전실',
      accent: '#E07A38',
      desc: '드래그로 지하 축전실 구역을 지정해 전술 콘크리트 바닥과 자동 격벽을 형성합니다.'
    },
    {
      id: 'b1_unzone',
      mode: 'b1_unzone',
      name: '구역 해제',
      iconId: 'b1-unzone',
      tag: '드래그 해제',
      costLabel: '초기화',
      accent: '#94A3B8',
      desc: '지정된 방 구역이나 전술 복도 타일을 드래그 또는 클릭해 일반 흙바닥으로 되돌립니다. (설비 미배치 시 가능)'
    }
  ],
  PLATEAU_ELEV_Z: 10,
  RAMP_ELEV_Z: 5,
  ROCK_TOP_Z: 16,
  ROCK_PEAK_TOP_Z: 33,
  WIND_ZONE: {
    outerMult: 1.40,
    coreMult: 1.70,
    minTiles: 10,
    maxTiles: 16
  },
  PLATEAU_BONUS: {
    rangeAdd: 1.0,
    mountCap: 1.25,
    critAdd: 0.08,
    lightAdd: 1.0,
    auraAdd: 0.5
  },
  RAMP_SPEED: {
    uphill: 0.70,
    downhill: 1.25
  },
  TERRAIN_TYPES: {
    rock: {
      id: 'rock',
      name: '기슭 암석 (바위)',
      elev: 0,
      topZ: 16,
      desc: '이동 및 건설 불가. 직사·곡사 탄환은 상공으로 통과하며 인접 성벽·게이트와 자동 연결됩니다.'
    },
    rock_peak: {
      id: 'rock_peak',
      name: '산맥 주봉',
      elev: 0,
      topZ: 33,
      desc: '높게 솟은 산맥 봉우리. 이동·건설 및 직사 탄환·산성 침을 가로막지만, 다연장 로켓 포대·EMP·폭격은 산 너머로 통과합니다.'
    },
    plateau: {
      id: 'plateau',
      name: '고지대 암반',
      elev: 10,
      desc: '고도 +10. 초소·포탑 사거리 +1.0(성벽 거치 합산 최대 +1.25)·치명 +8%p, 조명 반경 +1.0·오라 +0.5.'
    },
    ramp: {
      id: 'ramp',
      name: '경사 언덕',
      elev: 5,
      desc: '고지대 연결 경사로. 오르막 이속 -30%·내리막 +25%. 스파이크 트랩만 설치 가능.'
    },
    wind: {
      id: 'wind',
      name: '강풍 지대',
      elev: 0,
      tiers: {
        1: { name: '강풍 지대 (+40%)', mult: 1.40 },
        2: { name: '돌풍 핵심 지대 (+70%)', mult: 1.70 }
      },
      desc: '산맥 기슭을 따라 형성되는 자연 바람길입니다. 평소에는 보이지 않으며 [강풍 레이어 V]를 켜서 위치를 확인할 수 있습니다. 풍력 터빈 설치 시 주·야간 발전량이 +40%(주변부) / +70%(중심부) 증가합니다.'
    }
  },
  PALETTE,

  INITIAL_RESOURCES: {
    wood: 100,
    scrap: 95,
    coin: 60
  },

  HQ_STATS: {
    id: 'command_hq',
    name: '전술 지휘 본부',
    maxHp: 800,
    basePowerCap: 70,
    baseDayCharge: 32,
    basePopCap: 10,
    startingAgents: 10
  },

  HQ_LEVELS: [
    {
      level: 1,
      reqWave: 1,
      name: '임시 지휘소',
      cost: null,
      maxHp: 800,
      basePowerCap: 70,
      baseDayCharge: 32,
      basePopCap: 10,
      baseRpPerScientist: 0.8,
      combatSlots: 0,
      researchSlots: 2,
      prodSlots: 2,
      structUpgradeCap: 3,
      maxZ: 36,
      hpBarWidth: 38,
      weapon: null,
      globalAura: null
    },
    {
      level: 2,
      reqWave: 10,
      name: '전술 작전 본부',
      cost: { wood: 140, scrap: 120, coin: 85 },
      maxHp: 1350,
      basePowerCap: 105,
      baseDayCharge: 46,
      basePopCap: 14,
      baseRpPerScientist: 1.2,
      combatSlots: 2,
      researchSlots: 2,
      prodSlots: 2,
      structUpgradeCap: 3,
      maxZ: 34,
      hpBarWidth: 41,
      unlocksUnderground: true,
      bonusDigAp: 16,
      weapon: {
        name: '경기관총',
        range: 5.0,
        damage: 20,
        fireRate: 2.3,
        projType: 'hq_lmg',
        color: '#FFE484',
        width: 1.8,
        speed: 19,
        splashRadius: 0
      },
      globalAura: { structHpMult: 1.08 }
    },
    {
      level: 3,
      reqWave: 20,
      name: '통합 요새 사령부',
      cost: { wood: 260, scrap: 240, coin: 170 },
      maxHp: 2100,
      basePowerCap: 145,
      baseDayCharge: 64,
      basePopCap: 18,
      baseRpPerScientist: 1.6,
      combatSlots: 3,
      researchSlots: 3,
      prodSlots: 3,
      structUpgradeCap: 3,
      maxZ: 40,
      hpBarWidth: 44,
      weapon: {
        name: '중기관총',
        range: 5.8,
        damage: 34,
        fireRate: 2.9,
        projType: 'hq_hmg',
        color: '#FFE484',
        width: 2.4,
        speed: 20,
        splashRadius: 0
      },
      globalAura: { structHpMult: 1.18, dmgMult: 1.10 }
    },
    {
      level: 4,
      reqWave: 35,
      name: '이지스 코어 사령부',
      cost: { wood: 420, scrap: 400, coin: 300 },
      maxHp: 3100,
      basePowerCap: 195,
      baseDayCharge: 88,
      basePopCap: 24,
      baseRpPerScientist: 2.0,
      combatSlots: 4,
      researchSlots: 4,
      prodSlots: 4,
      structUpgradeCap: 3,
      maxZ: 48,
      hpBarWidth: 46,
      weapon: {
        name: '이지스 트윈캐논',
        range: 6.5,
        damage: 52,
        fireRate: 3.5,
        projType: 'hq_aegis',
        color: '#FF9F43',
        width: 3.0,
        speed: 17,
        splashRadius: 0.85
      },
      globalAura: { structHpMult: 1.30, dmgMult: 1.20, fireRateMult: 1.08 }
    },
    {
      level: 5,
      reqWave: 50,
      name: '오메가 시타델 사령부',
      cost: { wood: 650, scrap: 640, coin: 520 },
      maxHp: 4600,
      basePowerCap: 260,
      baseDayCharge: 120,
      basePopCap: 30,
      baseRpPerScientist: 2.8,
      combatSlots: 4,
      researchSlots: 5,
      prodSlots: 5,
      structUpgradeCap: 3,
      maxZ: 56,
      hpBarWidth: 50,
      weapon: {
        name: '오메가 레일화포',
        range: 7.8,
        damage: 92,
        fireRate: 3.8,
        projType: 'hq_omega',
        color: '#5EF2FF',
        width: 3.4,
        speed: 22,
        splashRadius: 1.35
      },
      globalAura: { structHpMult: 1.45, dmgMult: 1.35, fireRateMult: 1.15 }
    }
  ],

  // 5-Branch RP Tech Tree gated by HQ Lv.1~5 (Wave 1/10/20/35/50)
  TECH_BRANCHES: [
    { id: 'defense_eng', name: '방어선 공학', desc: '성벽·게이트·트랩 진화 및 복합 장갑 연구', accent: '#4ADE80' },
    { id: 'infantry_weap', name: '보병 화기 개량', desc: '저격탑 해금 및 무전력 요원 초소 2·3단계 개량', accent: '#FACC15' },
    { id: 'auto_turret', name: '자동화 화력 공학', desc: '발칸·로켓·EMP 자동포탑 해금 및 관제 강화', accent: '#FF9F43' },
    { id: 'power_infra', name: '전력·인프라 공학', desc: '발전·배터리·숙소·정비소 2~4단계 진화', accent: '#C084FC' },
    { id: 'bunker_eng', name: '지하 쉘터 공학', desc: '심부 굴착·고급 설비·레이저 파쇄기 연구', accent: '#F59E0B' }
  ],

  TECH_ORDER: [
    'def_t1', 'def_t2', 'def_repeat',
    'inf_sniper', 'inf_lv2', 'inf_lv3', 'inf_repeat',
    'tur_vulcan', 'tur_lv2', 'tur_missile', 'tur_emp', 'tur_lv3', 'tur_repeat',
    'inf_tier2', 'inf_tier3', 'inf_tier4', 'infra_repeat',
    'b1_drill_1', 'b1_gadgets_adv', 'b1_drill_2'
  ],

  // Note: Branch 4 repeatable ESS tech uses ID 'infra_repeat' to stay distinct from Branch 2 'inf_repeat'
  TECH_TREE: {
    def_t1: {
      id: 'def_t1',
      branch: 'defense_eng',
      name: '중장갑 방어선 1단계',
      costRp: 4,
      maxLv: 1,
      reqHqLevel: 1,
      req: [],
      desc: '성벽(헤스코 방벽·상부 거치 & 하부 보강), 전술 게이트, 피스톤 트랩 Lv.2 해금'
    },
    def_t2: {
      id: 'def_t2',
      branch: 'defense_eng',
      name: '고압·반사 방어선 2단계',
      costRp: 10,
      maxLv: 1,
      reqHqLevel: 2,
      req: ['def_t1'],
      desc: '합금 장갑 성벽, 전자식 쇼크 게이트, 고전압 피에조 트랩 Lv.3 해금'
    },
    def_repeat: {
      id: 'def_repeat',
      branch: 'defense_eng',
      name: '초고강도 복합 장갑 연구',
      costRp: 14,
      costStep: 8,
      maxLv: 5,
      reqHqLevel: 5,
      req: ['def_t2'],
      desc: '레벨당 성벽·게이트·트랩 HP +15% & 근접 반사·트랩 피해 +12%'
    },
    inf_sniper: {
      id: 'inf_sniper',
      branch: 'infantry_weap',
      name: '대물 저격 체계',
      costRp: 4,
      maxLv: 1,
      reqHqLevel: 1,
      req: [],
      desc: '대물 저격 감시탑(무전력 장거리 초소) 건설 해금'
    },
    inf_lv2: {
      id: 'inf_lv2',
      branch: 'infantry_weap',
      name: '전술 화기 개량 Lv.2',
      costRp: 7,
      maxLv: 1,
      reqHqLevel: 1,
      req: ['inf_sniper'],
      desc: '모든 요원 초소(소총·샷건·저격탑) Lv.2 강화 해금'
    },
    inf_lv3: {
      id: 'inf_lv3',
      branch: 'infantry_weap',
      name: '특수 작전 화기 Lv.3',
      costRp: 15,
      maxLv: 1,
      reqHqLevel: 2,
      req: ['inf_lv2'],
      desc: '모든 요원 초소 Lv.3 특수 개조(2점사·중산탄·관통탄) 해금'
    },
    inf_repeat: {
      id: 'inf_repeat',
      branch: 'infantry_weap',
      name: '고관통 정밀 탄약',
      costRp: 16,
      costStep: 9,
      maxLv: 5,
      reqHqLevel: 5,
      req: ['inf_lv3'],
      desc: '레벨당 모든 요원 초소 공격력 +12% & 치명타율 +3%p'
    },
    tur_vulcan: {
      id: 'tur_vulcan',
      branch: 'auto_turret',
      name: '무인 발칸 오토터렛',
      costRp: 5,
      maxLv: 1,
      reqHqLevel: 1,
      req: [],
      desc: 'CIWS 발칸 오토터렛 건설 해금'
    },
    tur_lv2: {
      id: 'tur_lv2',
      branch: 'auto_turret',
      name: '자동 포탑 화력 강화 Lv.2',
      costRp: 9,
      maxLv: 1,
      reqHqLevel: 2,
      req: ['tur_vulcan'],
      desc: '모든 자동 포탑(발칸·로켓·EMP) Lv.2 강화 해금'
    },
    tur_missile: {
      id: 'tur_missile',
      branch: 'auto_turret',
      name: '고각 다연장 로켓 체계',
      costRp: 12,
      maxLv: 1,
      reqHqLevel: 3,
      req: ['tur_vulcan'],
      desc: '다연장 로켓 포대(산맥 너머 광역 곡사 포격) 건설 해금'
    },
    tur_emp: {
      id: 'tur_emp',
      branch: 'auto_turret',
      name: '고압 테슬라 EMP 방전',
      costRp: 16,
      maxLv: 1,
      reqHqLevel: 4,
      req: ['tur_missile'],
      desc: '테슬라 EMP 파일런(연쇄 전격·둔화) 건설 해금'
    },
    tur_lv3: {
      id: 'tur_lv3',
      branch: 'auto_turret',
      name: '초전도 오토터렛 특전 Lv.3',
      costRp: 20,
      maxLv: 1,
      reqHqLevel: 4,
      req: ['tur_lv2', 'tur_missile'],
      desc: '모든 자동 포탑 Lv.3 특수 개조(초전도 급탄·6연장·5연쇄) 해금'
    },
    tur_repeat: {
      id: 'tur_repeat',
      branch: 'auto_turret',
      name: '고효율 화력 관제',
      costRp: 18,
      costStep: 10,
      maxLv: 5,
      reqHqLevel: 5,
      req: ['tur_lv3'],
      desc: '레벨당 모든 자동 포탑 공격력 +12% & 사격 전력 소모 -6%'
    },
    inf_tier2: {
      id: 'inf_tier2',
      branch: 'power_infra',
      name: '기지 인프라 2단계 진화',
      costRp: 5,
      maxLv: 1,
      reqHqLevel: 1,
      req: [],
      desc: '태양광·풍력·배터리·야전 막사·정비 베이 Lv.2 업그레이드 해금'
    },
    inf_tier3: {
      id: 'inf_tier3',
      branch: 'power_infra',
      name: '기지 인프라 3단계 진화',
      costRp: 12,
      maxLv: 1,
      reqHqLevel: 2,
      req: ['inf_tier2'],
      desc: '태양광·풍력·리튬 ESS·모듈러 숙소·보급창고·연구창고·나노 정비소 진화 해금'
    },
    inf_tier4: {
      id: 'inf_tier4',
      branch: 'power_infra',
      name: '초전도 인프라 4단계',
      costRp: 22,
      maxLv: 1,
      reqHqLevel: 3,
      req: ['inf_tier3'],
      desc: '태양광 발전소·대형 풍력·초전도 코어·작전 생활관·보급소·연구소 진화 해금'
    },
    infra_repeat: {
      id: 'infra_repeat',
      branch: 'power_infra',
      name: '고밀도 ESS 전력망',
      costRp: 16,
      costStep: 9,
      maxLv: 5,
      reqHqLevel: 5,
      req: ['inf_tier4'],
      desc: '레벨당 본부·태양광·풍력·배터리 주간 충전량 및 전력 용량 +10%'
    },
    b1_drill_1: {
      id: 'b1_drill_1',
      branch: 'bunker_eng',
      name: '심부 굴착 공법',
      costRp: 8,
      maxLv: 1,
      reqHqLevel: 2,
      req: [],
      desc: '생산요원 굴착력 1.2→1.6 AP/명 · 이월 상한 +8 · 매몰 전리품 +25%'
    },
    b1_gadgets_adv: {
      id: 'b1_gadgets_adv',
      branch: 'bunker_eng',
      name: '고급 쉘터 설비 인가',
      costRp: 14,
      maxLv: 1,
      reqHqLevel: 3,
      req: ['b1_drill_1'],
      desc: '지하 쉘터(Stage 3) 고급 가젯 및 심층 지원 설비 인가'
    },
    b1_drill_2: {
      id: 'b1_drill_2',
      branch: 'bunker_eng',
      name: '레이저 암반 파쇄기',
      costRp: 20,
      maxLv: 1,
      reqHqLevel: 4,
      req: ['b1_gadgets_adv'],
      desc: '심부 현무암 굴착 AP 3→2 소모 · 기지 전역 RP 획득량 +15%'
    }
  },

  COZY_TIERS: [
    { level: 1, min: 0,   title: '임시 전초기지',         agentDmg: 0.00, fireRate: 0.00, coinBonus: 0.00, xpBonus: 0.00, freeRepair: 0.06 },
    { level: 2, min: 25,  title: '정비된 작전소',         agentDmg: 0.08, fireRate: 0.03, coinBonus: 0.08, xpBonus: 0.10, freeRepair: 0.12 },
    { level: 3, min: 65,  title: '모던 전술 쉘터',        agentDmg: 0.16, fireRate: 0.06, coinBonus: 0.15, xpBonus: 0.20, freeRepair: 0.18 },
    { level: 4, min: 130, title: '하이라이즈 아웃포스트', agentDmg: 0.25, fireRate: 0.10, coinBonus: 0.22, xpBonus: 0.30, freeRepair: 0.24 },
    { level: 5, min: 225, title: '네오 어반 요새',        agentDmg: 0.35, fireRate: 0.14, coinBonus: 0.30, xpBonus: 0.45, freeRepair: 0.30 },
    { level: 6, min: 340, title: '택티컬 라운지 시타델',  agentDmg: 0.45, fireRate: 0.18, coinBonus: 0.38, xpBonus: 0.60, freeRepair: 0.36 },
    { level: 7, min: 480, title: '사이버 헤이븐 코어',    agentDmg: 0.56, fireRate: 0.22, coinBonus: 0.46, xpBonus: 0.80, freeRepair: 0.42 },
    { level: 8, min: 640, title: '엘리트 파라다이스',     agentDmg: 0.68, fireRate: 0.27, coinBonus: 0.55, xpBonus: 1.00, freeRepair: 0.48 }
  ],

  COZY_FLOOR_CAP: 60,

  CATEGORIES: [
    { id: 'defense', iconId: 'cat-defense', label: '방어·화력', desc: '방벽, 무전력 요원 초소, 전력 자동포탑' },
    { id: 'infra',   iconId: 'cat-infra',   label: '전력·숙소·정비', desc: '주간 태양광·야간 풍력 발전기, 배터리, 요원 숙소, 현장 수리 정비' },
    { id: 'decor',   iconId: 'cat-decor',   label: '모던 꾸미기', desc: '바닥재, 전술 조명, 라운지 가구 & 버프' }
  ],

  WALL_TIERS,
  SOLAR_TIERS,
  WIND_TIERS,
  BATTERY_TIERS,
  BARRACKS_TIERS,
  WORKSHOP_TIERS,
  RESEARCH_LAB_TIERS,
  GATE_TIERS,
  TRAP_TIERS,
  REPAIR_TIERS,
  TIER_MAPS,

  CREW_SPECS: {
    rifle_bunker: { maxByLv: { 1: 2, 2: 3, 3: 4 }, rateByCrew: [0, 0.75, 1.00, 1.30, 1.65] },
    shotgun_post: { maxByLv: { 1: 1, 2: 2, 3: 2 }, rateByCrew: [0, 1.00, 1.45] },
    sniper_tower: { maxByLv: { 1: 1, 2: 2, 3: 2 }, rateByCrew: [0, 1.00, 1.45] },
    command_hq:   { maxByLv: { 1: 0, 2: 2, 3: 3, 4: 4, 5: 4 }, rateByCrew: [0, 0.85, 1.15, 1.40, 1.65] }
  },

  PROD_RATES: {
    woodPerWorker: 2.0,
    scrapPerWorker: 1.5,
    digBase: 1.2,
    digDrill1: 1.6
  },

  LV3_PERK_LABELS: {
    rifle_bunker: '전술 2점사 (50% 피해 보조탄 추가 발사)',
    shotgun_post: '중산탄 제압 (펠릿 6발 + 0.20칸 넉백)',
    sniper_tower: '대구경 관통탄 (사거리 +1.0 · 최대 2기 관통)',
    vulcan_turret: '초전도 급탄 (사격 전력 0.28 절감 · 치명타 +12%p)',
    missile_pod: '6연장 융단 포격 (1회 6발 연속 포격 · 광역 제압)',
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

  // Note: Base items & upgrades unlock via the 5-branch RP Tech Tree gated by HQ Lv.1~5
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
      reqHqLevel: 1,
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
      reqHqLevel: 1,
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
      name: '강철 스파이크 트랩',
      category: 'defense',
      layer: 'struct',
      subType: 'trap',
      passable: true,
      reqHqLevel: 1,
      cost: { wood: 6, scrap: 10 },
      maxHp: 180,
      trapDps: 11,
      slowFactor: 0.55,
      desc: '[3단 진화 바닥 스파이크 트랩] 강철 스파이크(1단·11/s·둔화 45%) → 중장갑 피스톤(2단·19/s·52%) → 고전압 피에조(3단·30/s·60%·피해+15%).'
    },

    // ================= DEFENSE: MANNED POSTS (Crew Slotted, Power: 0) =================
    rifle_bunker: {
      id: 'rifle_bunker',
      name: '소총수 전술 벙커',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqHqLevel: 1,
      cost: { wood: 24, scrap: 10 },
      maxCrew: 2,
      maxHp: 210,
      range: 4.3,
      damage: 19,
      fireRate: 2.5,
      projType: 'rifle',
      canMountOnWall: true,
      mountTopOffset: 15.5,
      desc: '[전투 슬롯 최대 2~4명 · 무전력] 요원 미배치 상태로도 건설 가능하며 1명 이상 배치 시 정전 중에도 사격합니다.'
    },
    shotgun_post: {
      id: 'shotgun_post',
      name: '브리처 샷건 초소',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqHqLevel: 1,
      cost: { wood: 22, scrap: 15 },
      maxCrew: 1,
      maxHp: 240,
      range: 3.0,
      damage: 14,
      pellets: 4,
      spread: 0.34,
      fireRate: 1.1,
      projType: 'shotgun',
      canMountOnWall: true,
      mountTopOffset: 15,
      desc: '[전투 슬롯 1~2명 · 무전력] 근접 저지용 전술 산탄 사수. 1명 이상 배치 시 한 번에 4발의 산탄을 발사합니다.'
    },
    sniper_tower: {
      id: 'sniper_tower',
      name: '대물 저격 감시탑',
      category: 'defense',
      layer: 'struct',
      subType: 'manned',
      reqTech: 'inf_sniper',
      cost: { wood: 30, scrap: 24 },
      maxCrew: 1,
      maxHp: 195,
      range: 7.0,
      damage: 78,
      fireRate: 0.65,
      targetMode: 'strongest',
      projType: 'sniper',
      desc: '[전투 슬롯 1~2명 · 무전력 · 연구 해금] 철골 감시탑 위 저격수가 장거리에서 고체력 표적을 우선 저격합니다.'
    },

    // ================= DEFENSE: AUTO TURRETS (Pop: 0, Night Power Drain) =================
    vulcan_turret: {
      id: 'vulcan_turret',
      name: 'CIWS 발칸 오토터렛',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqTech: 'tur_vulcan',
      cost: { wood: 8, scrap: 36 },
      requiresPower: true,
      powerIdle: 0.70,
      powerShot: 0.44,
      maxHp: 240,
      range: 4.6,
      damage: 13,
      fireRate: 5.6,
      projType: 'vulcan',
      canMountOnWall: true,
      mountTopOffset: 12,
      desc: '[전력 소모 · 연구 해금] 레이더 돔 탑재 고속 개틀링 포탑. 압도적인 화력을 퍼붓지만 야간 전력을 소모합니다.'
    },
    missile_pod: {
      id: 'missile_pod',
      name: '다연장 로켓 포대',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqTech: 'tur_missile',
      cost: { wood: 12, scrap: 48 },
      requiresPower: true,
      powerIdle: 1.05,
      powerShot: 2.4,
      maxHp: 260,
      minRange: 2.2,
      range: 8.0,
      damage: 24,
      salvoCount: 2,
      salvoScatter: 0.25,
      splashRadius: 1.20,
      fireRate: 0.48,
      projType: 'rocket',
      desc: '[전력 소모 · 다연장 곡사 · 연구 해금] 산맥 너머 적군에 고각 로켓을 연속 일제 발사(2→3→6발)해 광역 제압합니다. (최소 사거리 2.2 · 정전 시 정지)'
    },
    emp_coil: {
      id: 'emp_coil',
      name: '테슬라 EMP 파일런',
      category: 'defense',
      layer: 'struct',
      subType: 'turret',
      reqTech: 'tur_emp',
      cost: { wood: 10, scrap: 52, coin: 15 },
      requiresPower: true,
      powerIdle: 1.25,
      powerShot: 2.7,
      maxHp: 235,
      range: 3.8,
      damage: 30,
      chainCount: 3,
      slowDuration: 1.6,
      fireRate: 0.95,
      projType: 'emp',
      desc: '[전력 소모 · 연구 해금] 최대 3기 좀비에게 연쇄 고압 전격을 날리고 이동속도를 크게 둔화시킵니다.'
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
      dayCharge: 28,
      nightGen: 0,
      powerCap: 15,
      cozy: 1,
      cozyGroup: 'solar_t1',
      desc: '[주간 고효율 발전 · 4단 진화] 낮 전환 시 배터리를 대량 충전합니다(야간 발전 0/s). 인프라 연구 시 태양광 발전소(+165)까지 진화합니다.'
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
      desc: '[24시간 풍력 · 4단 진화] 야간에도 초당 +0.65씩 실시간 전력을 공급하며, 인프라 연구 시 대형 풍력발전기(+3.80/s)까지 진화합니다. [강풍 레이어 V]로 산맥 주변의 강풍(+40%)·돌풍(+70%) 지대를 찾아 배치할 수 있습니다.'
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
      dayCharge: 4,
      nightGen: 0,
      powerCap: 60,
      cozy: 1,
      cozyGroup: 'battery_t1',
      desc: '[전력 저장 · 4단 진화] 최대 전력 저장량을 확장하고 보조 충전을 제공합니다. 인프라 연구 시 초전도 에너지 코어(+410)까지 진화합니다.'
    },
    field_tent: {
      id: 'field_tent',
      name: '전술 돔 막사',
      category: 'infra',
      layer: 'struct',
      subType: 'housing',
      reqHqLevel: 1,
      cost: { wood: 85, scrap: 35 },
      maxHp: 170,
      popCap: 4,
      cozy: 5,
      cozyGroup: 'housing_t1',
      lightRadius: 1.8,
      lightColor: 'rgba(255, 206, 112, 0.34)',
      desc: '[요원 숙소 · 4단 진화] 요원 수용량 +4명(+4→+6→+12→+24)을 확장합니다. 인프라 연구 시 모듈러 숙소·강화 작전 생활관으로 진화합니다.'
    },
    supply_workshop: {
      id: 'supply_workshop',
      name: '작업장',
      category: 'infra',
      layer: 'struct',
      subType: 'job_slot',
      reqHqLevel: 1,
      cost: { wood: 45, scrap: 20 },
      maxHp: 150,
      prodSlots: 2,
      cozy: 3,
      cozyGroup: 'infra_workshop',
      desc: '[생산 슬롯 +2 · 무전력 · 3단 진화] 야전 공방 작업장. 생산요원 배치 상한을 확장합니다 (보급창고 +4 → 보급소 +6).'
    },
    research_lab: {
      id: 'research_lab',
      name: '연구막사',
      category: 'infra',
      layer: 'struct',
      subType: 'job_slot',
      reqHqLevel: 1,
      cost: { wood: 40, scrap: 25 },
      maxHp: 140,
      researchSlots: 2,
      cozy: 4,
      cozyGroup: 'infra_lab',
      desc: '[연구 슬롯 +2 · 무전력 · 3단 진화] 야전 전술 연구막사. 연구요원 배치 상한을 확장합니다 (연구창고 +4 → 연구소 +6).'
    },
    repair_bay: {
      id: 'repair_bay',
      name: '현장 수리 거치대',
      category: 'infra',
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
      powerIdle: 0.55,
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
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'lounge',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { scrap: 14, coin: 18 },
      maxHp: 165,
      cozy: 14,
      cozyGroup: 'decor_vending',
      mannedFireRateAdd: 0.05,
      mannedFireRateCap: 0.15,
      lightRadius: 2.3,
      lightColor: 'rgba(255, 208, 148, 0.36)',
      desc: '[지하 휴게실 전용 · 무전력] 안락함 +14 · 지상 유인 초소 전역 연사속도 +5% (상한 +15%).'
    },
    lounge_set: {
      id: 'lounge_set',
      name: '택티컬 라운지 세트',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'lounge',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      cost: { wood: 18, coin: 14 },
      maxHp: 135,
      cozy: 16,
      cozyGroup: 'decor_lounge',
      desc: '[지하 휴게실 전용] 아늑한 전술 소파와 라운지 테이블 세트. 안락함을 +16 높입니다.'
    },
    arcade_neon: {
      id: 'arcade_neon',
      name: '네온 아케이드 스테이션',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'lounge',
      category: 'decor',
      layer: 'struct',
      subType: 'decor',
      reqHqLevel: 1,
      reqTech: 'b1_gadgets_adv',
      cost: { scrap: 12, coin: 26 },
      requiresPower: true,
      powerIdle: 0.25,
      maxHp: 145,
      cozy: 22,
      cozyGroup: 'decor_arcade',
      lightRadius: 3.0,
      lightColor: 'rgba(235, 105, 255, 0.46)',
      desc: '[지하 휴게실 전용 · 0.25/s 전력] 감성적인 사이버 네온 아케이드 게임기. 안락함을 무려 +22 높여줍니다.'
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
    },

    // ================= UNDERGROUND B1 GADGETS: QUARTERS (4) =================
    b1_bunk_bed: {
      id: 'b1_bunk_bed',
      name: '2층 전술 침대',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'quarters',
      category: 'b1_living',
      layer: 'struct',
      subType: 'housing',
      cost: { wood: 55, scrap: 35, coin: 15 },
      popCap: 2,
      cozy: 6,
      cozyGroup: 'b1_bunk_bed',
      desc: '[생활관 전용] 2층 강철 침대. 요원 수용 +2명 (고정 · 감쇠 없음) · 안락함 +6 (안락함 4개째부터 감쇠).'
    },
    b1_locker: {
      id: 'b1_locker',
      name: '개인 관물대',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'quarters',
      category: 'b1_living',
      layer: 'struct',
      subType: 'decor',
      cost: { wood: 12, scrap: 10 },
      cozy: 5,
      cozyGroup: 'b1_locker',
      adjacentBedSynergy: 3,
      desc: '[생활관 전용] 전술 개인 관물대. 안락함 +5 · 2층 전술 침대와 상하좌우 인접 시 관물대당 +3 시너지.'
    },
    b1_shower_booth: {
      id: 'b1_shower_booth',
      name: '샤워/세면 부스',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'quarters',
      category: 'b1_living',
      layer: 'struct',
      subType: 'decor',
      reqTech: 'b1_gadgets_adv',
      cost: { scrap: 20, coin: 14 },
      cozy: 9,
      cozyGroup: 'b1_shower_booth',
      desc: '[생활관 전용 · 연구 해금] 온수 순환 샤워 부스. 요원 위생 개선으로 안락함 +9.'
    },
    b1_air_purifier: {
      id: 'b1_air_purifier',
      name: '공기청정기',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'quarters',
      category: 'b1_living',
      layer: 'struct',
      subType: 'decor',
      reqTech: 'b1_gadgets_adv',
      requiresPower: true,
      powerIdle: 0.25,
      cost: { scrap: 18, coin: 16 },
      cozy: 5,
      cozyGroup: 'b1_air_purifier',
      roomCozyBonusPct: 0.20,
      roomCozyBonusCap: 0.40,
      desc: '[생활관 전용 · 0.25/s 전력] 안락함 +5 · 같은 생활관 내 생활관 가젯 안락함 총합 +20% (방당 상한 +40%).'
    },

    // ================= UNDERGROUND B1 GADGETS: LOUNGE EXTRA (2 + 3 MIGRATED) =================
    b1_coffee_bar: {
      id: 'b1_coffee_bar',
      name: '에스프레소 커피 바',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'lounge',
      category: 'b1_living',
      layer: 'struct',
      subType: 'decor',
      cost: { wood: 14, scrap: 12, coin: 16 },
      cozy: 14,
      cozyGroup: 'b1_coffee_bar',
      digApBonusPct: 0.10,
      digApBonusCap: 0.30,
      desc: '[휴게실 전용] 안락함 +14 · 매일 아침 지하 굴착력(Dig AP) 충전 +10% (상한 +30%).'
    },
    b1_media_screen: {
      id: 'b1_media_screen',
      name: '전술 미디어 스크린',
      domain: 'underground',
      b1Category: 'b1_living',
      requiredRole: 'lounge',
      category: 'b1_living',
      layer: 'struct',
      subType: 'decor',
      reqTech: 'b1_gadgets_adv',
      requiresPower: true,
      powerIdle: 0.35,
      cost: { scrap: 22, coin: 28 },
      cozy: 20,
      cozyGroup: 'b1_media_screen',
      mannedXpAdd: 0.12,
      desc: '[휴게실 전용 · 0.35/s 전력] 안락함 +20 · 지상 유인 초소 전투 숙련 XP 획득량 +12%.'
    },

    // ================= UNDERGROUND B1 GADGETS: RESEARCH LAB (4) =================
    b1_research_desk: {
      id: 'b1_research_desk',
      name: '전술 연구 데스크',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'research_lab',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_lab',
      cost: { wood: 18, scrap: 16, coin: 10 },
      scientistRpAdd: 0.8,
      waveRpAdd: 0.5,
      researchSlots: 1,
      desc: '[연구실 전용] 연구 슬롯 +1자리 · 연구요원 1명당 +0.8 RP (데스크 수 상한) + 매일 아침 고정 +0.5 RP.'
    },
    b1_server_rack: {
      id: 'b1_server_rack',
      name: '데이터 서버 랙',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'research_lab',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_lab',
      reqTech: 'b1_gadgets_adv',
      requiresPower: true,
      powerIdle: 0.45,
      cost: { scrap: 28, coin: 22 },
      rpMultAdd: 0.18,
      desc: '[연구실 전용 · 0.45/s 전력] 전술 연산 클러스터. 기지 전역 RP 획득률 +18% (4개째부터 50% 감쇠).'
    },
    b1_specimen_bench: {
      id: 'b1_specimen_bench',
      name: '표본 분석대',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'research_lab',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_lab',
      reqTech: 'b1_gadgets_adv',
      cost: { scrap: 22, coin: 20 },
      bossRpMultAdd: 0.25,
      waveRpAdd: 1,
      desc: '[연구실 전용 · 연구 해금] 보스 변이체 처치 보너스 RP +25% + 매일 아침 고정 +1 RP.'
    },
    b1_holo_table: {
      id: 'b1_holo_table',
      name: '홀로 전술 테이블',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'research_lab',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_lab',
      reqTech: 'b1_gadgets_adv',
      requiresPower: true,
      powerIdle: 0.55,
      cost: { scrap: 34, coin: 32 },
      rpMultAdd: 0.15,
      combatCritAdd: 0.04,
      desc: '[연구실 전용 · 0.55/s 전력] 기지 전역 RP 획득률 +15% · 지상 유인 초소 & 자동 포탑 전역 치명타율 +4%p.'
    },

    // ================= UNDERGROUND B1 GADGETS: SUPPLY DEPOT (2) =================
    b1_pallet_rack: {
      id: 'b1_pallet_rack',
      name: '자재 파렛트 랙',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'supply_depot',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_supply',
      cost: { wood: 20, scrap: 14 },
      dawnWood: 2.0,
      dawnScrap: 1.5,
      prodWood: 1.2,
      prodScrap: 1.2,
      prodSlots: 1,
      desc: '[보급 창고 전용] 생산 슬롯 +1자리 · 매일 아침 +2.0 목재 · +1.5 고철 + 생산요원당 +1.2 목재 · +1.2 고철.'
    },
    b1_logistics_term: {
      id: 'b1_logistics_term',
      name: '물류 단말기',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'supply_depot',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_supply',
      reqTech: 'b1_gadgets_adv',
      requiresPower: true,
      powerIdle: 0.30,
      cost: { scrap: 24, coin: 24 },
      dawnCoin: 6,
      traderDiscAdd: 0.08,
      traderDiscCap: 0.24,
      desc: '[보급 창고 전용 · 0.30/s 전력] 매일 아침 +6 코인 · 외부 교역소 구매·갱신 비용 -8% (상한 -24%).'
    },

    // ================= UNDERGROUND B1 GADGETS: POWER VAULT (3) =================
    b1_ess_rack: {
      id: 'b1_ess_rack',
      name: '지하 ESS 배터리 랙',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'power_vault',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_power',
      cost: { wood: 8, scrap: 28, coin: 12 },
      powerCap: 90,
      dayCharge: 6,
      desc: '[지하 축전실 전용] 피격 면역 지하 ESS. 전력 용량 +90 · 주간 충전 +6.'
    },
    b1_power_panel: {
      id: 'b1_power_panel',
      name: '배전 제어반',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'power_vault',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_power',
      reqTech: 'b1_gadgets_adv',
      cost: { scrap: 26, coin: 22 },
      b1DrainSaveAdd: 0.15,
      b1DrainSaveCap: 0.35,
      dayCharge: 12,
      desc: '[지하 축전실 전용 · 연구 해금] 지하 유전력 가젯 대기전력 -15% (상한 -35%) + 주간 충전 +12.'
    },
    b1_backup_gen: {
      id: 'b1_backup_gen',
      name: '비상 보조 발전기',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: 'power_vault',
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_power',
      reqTech: 'b1_gadgets_adv',
      cost: { scrap: 36, coin: 30 },
      dayCharge: 18,
      nightGen: 1.10,
      desc: '[지하 축전실 전용 · 연구 해금] 방호 격벽 내부 보조 발전기. 주간 충전 +18 · 야간 상시 발전 +1.10/s.'
    },

    // ================= UNDERGROUND B1 GADGETS: COMMON WORKLIGHT (1) =================
    b1_ceiling_led: {
      id: 'b1_ceiling_led',
      name: '지하 전술 스탠드 조명',
      domain: 'underground',
      b1Category: 'b1_systems',
      requiredRole: null,
      category: 'b1_systems',
      layer: 'struct',
      subType: 'b1_light',
      cost: { scrap: 8, coin: 4 },
      cozy: 3,
      cozyGroup: 'b1_ceiling_led',
      lightRadius: 3.2,
      lightColor: 'rgba(255, 179, 71, 0.42)',
      desc: '[지하 공용 · 무전력] 굴착된 모든 B1 타일 배치 가능. 따뜻한 앰버 작업광(반경 3.2) · 안락함 +3.'
    }
  },

  ZOMBIES: {
    walker: {
      id: 'walker',
      name: '감염 보행자',
      hp: 64,
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
      hp: 245,
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
      hp: 1180,
      speed: 0.64,
      damage: 68,
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
      desc: '숙소 빈자리만큼 즉시 작전 요원을 최대 +3명 영입합니다 (빈 숙소 수용량 필요).',
      coinCost: 32,
      type: 'agent',
      amount: 3
    },
    {
      id: 'crate_vending',
      name: '보급품: 스마트 음료 자판기',
      desc: '고철·코인 소비 없이 지하 B1 휴게실에 스마트 음료 자판기(연사 +5% · 안락함 +14) 무료 배치권 1개를 확보합니다.',
      coinCost: 24,
      type: 'free_item',
      itemId: 'vending_machine'
    },
    {
      id: 'crate_arcade',
      name: '보급품: 네온 아케이드 스테이션',
      desc: '안락함 +22 네온 아케이드 무료 배치권 1개를 확보합니다. 연구 미완료 상태여도 지하 B1 휴게실에 즉시 배치 가능!',
      coinCost: 28,
      type: 'free_item',
      itemId: 'arcade_neon'
    },
    {
      id: 'crate_pod',
      name: '프리팹: 모듈러 컨테이너 숙소',
      desc: '목재·고철·코인 없이 모듈러 컨테이너 숙소(3단계 · 수용 +12명) 1회 무료 배치권을 확보합니다.',
      coinCost: 95,
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
    },
    {
      id: 'research_disk',
      name: '전술 연구 데이터 디스크',
      svgIcon: 'res-rp',
      svgColorCls: 'icon-rp',
      desc: '외부 연구소에서 암호 해독한 전술 데이터 디스크. 즉시 연구포인트 +5 RP를 획득합니다.',
      coinCost: 28,
      type: 'rp',
      amount: 5
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
  ],

  DIVISION_ORDER: ['mobile_corps', 'iron_engineers', 'nightwatch', 'arc_tech'],

  DIVISIONS: {
    mobile_corps: {
      id: 'mobile_corps',
      name: '기동방위대',
      shortName: '기동방위대',
      subtitle: '표준 기동 전개 교리',
      iconId: 'div-mobile',
      accentColor: '#FFC94A',
      unlockedByDefault: true,
      unlockCondition: null,
      unlockHint: '기본 해금 교리',
      hqCostMult: 0.85,
      badgeTag: '본부 -15%',
      pros: [
        '본부(HQ) 증축 비용(목재·고철·코인) -15%'
      ],
      cons: [
        '패널티 없음 (표준 올라운더)'
      ],
      hasPenalty: false
    },
    iron_engineers: {
      id: 'iron_engineers',
      name: '철벽 공병단',
      shortName: '철벽 공병단',
      subtitle: '축성·방벽·공병 특화 교리',
      iconId: 'div-iron',
      accentColor: '#4ADE80',
      unlockedByDefault: true,
      unlockCondition: null,
      unlockHint: '기본 해금 교리',
      startingVouchers: { razor_pad: 3 },
      fortHpMult: 1.35,
      thornsMult: 1.5,
      trapDpsMult: 1.5,
      repairMaxCd: 12,
      rangeMult: 0.85,
      badgeTag: '축성 +35% · 수리 12s',
      pros: [
        '시작 시 강철 스파이크 트랩 보급권 ×3 지급',
        '성벽·통문·스파이크 트랩 최대 내구도 +35%',
        '성벽·통문 반사 피해 & 트랩 지속피해 +50%',
        '긴급 나노 수리 드론 대기시간 18초 → 12초'
      ],
      cons: [
        '모든 요원 초소 및 자동 포탑 사거리 -15%'
      ],
      hasPenalty: true
    },
    nightwatch: {
      id: 'nightwatch',
      name: '나이트워치 유격대',
      shortName: '나이트워치',
      subtitle: '야간 정전 유격·정예 요원 교리',
      iconId: 'div-nightwatch',
      accentColor: '#E2E8F0',
      unlockedByDefault: false,
      unlockCondition: 'survive_blackout',
      unlockHint: '블랙아웃이 발생한 야간 웨이브 방어에 1회 생존하면 해금',
      startingAgentsBonus: 4,
      basePopCapBonus: 4,
      startingVouchers: { rifle_bunker: 1 },
      voucherRank1: { rifle_bunker: 1 },
      mannedXpMult: 2.0,
      blackoutMannedFireRateMult: 1.40,
      blackoutMannedCritAdd: 0.20,
      solarBatteryMult: 0.60,
      turretCostMult: 1.30,
      badgeTag: '숙련 ×2 · 정전 유격',
      pros: [
        '시작 가용 요원 +4명 & 본부 기본 수용량 +4',
        '소총 벙커 보급권 ×1 (첫 보급 배치 숙련 Rank 1)',
        '요원 초소 전투 숙련 XP 획득량 2배',
        '정전(블랙아웃) 중 요원 초소 연사 +40% · 치명 +20%p'
      ],
      cons: [
        '태양광·배터리 주간 충전량 및 저장 용량 -40%',
        '무인 자동 포탑 건설·업그레이드 비용 +30%'
      ],
      hasPenalty: true
    },
    arc_tech: {
      id: 'arc_tech',
      name: '아크 테크놀로지',
      shortName: '아크 테크',
      subtitle: '고전압 전력망·오버드라이브 교리',
      iconId: 'div-arc',
      accentColor: '#5EF2FF',
      isElectricDivision: true,
      unlockedByDefault: false,
      unlockCondition: 'reach_wave_15',
      unlockHint: 'WAVE 15에 도달하면 영구 해금',
      startingVouchers: { wind_turbine: 1, battery_bank: 1 },
      overdriveThreshold: 0.70,
      overdriveTurretFireRateMult: 1.25,
      overdriveFloodlightMult: 1.25,
      overdriveEmpDurationMult: 0.35,
      fieldTentPopCapMult: 0.65,
      badgeTag: 'ARC ≥70%',
      pros: [
        '시작 시 풍력 터빈 보급권 ×1 + 배터리 보급권 ×1 지급',
        '전력 ≥70% 유지 시 자동 포탑 연사력 +25%',
        '전력 ≥70% 유지 시 LED 투광등 조명·오라 반경 +25%',
        '전력 ≥70% 유지 시 전기 시설 EMP 기절 시간 -65%'
      ],
      cons: [
        '모든 티어 야전 숙소 요원 수용량 -35%'
      ],
      hasPenalty: true
    }
  }
  };
})();
