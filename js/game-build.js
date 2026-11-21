window.ZS = window.ZS || {};

(function () {
  const G = ZS._Game;
  const { DATA, N, PROD_SAVE_KEY, DEV_SAVE_KEY, SETTINGS_KEY, state } = G;

  // ================= 5-BRANCH RP TECH TREE =================
  function getTechLevel(id) {
    return (state.researchedTechs && state.researchedTechs[id]) || 0;
  }

  function getTechCost(id) {
    const def = DATA.TECH_TREE && DATA.TECH_TREE[id];
    if (!def) return null;
    const curLv = getTechLevel(id);
    const maxLv = def.maxLv || 1;
    if (curLv >= maxLv) return null;
    return (def.costRp || 0) + curLv * (def.costStep || 0);
  }

  function canResearchTech(id) {
    if (state.phase === 'gameover') {
      return { ok: false, reason: '작전 실패 상태에서는 연구를 진행할 수 없습니다.' };
    }
    const def = DATA.TECH_TREE && DATA.TECH_TREE[id];
    if (!def) {
      return { ok: false, reason: '존재하지 않는 연구 항목입니다.' };
    }
    const curLv = getTechLevel(id);
    const maxLv = def.maxLv || 1;
    if (curLv >= maxLv) {
      return { ok: false, isMax: true, reason: '이미 최고 연구 단계에 도달했습니다.' };
    }
    if (def.branch === 'bunker_eng' && (state.hqLevel || 1) < 2) {
      return {
        ok: false,
        lockedByHq: true,
        reqHqLevel: 2,
        reason: '지휘 본부 Lv.2 증축(지하 B1 개방) 후 연구할 수 있습니다.'
      };
    }
    const reqs = Array.isArray(def.req) ? def.req : [];
    const missing = [];
    for (let i = 0; i < reqs.length; i++) {
      if (getTechLevel(reqs[i]) <= 0) {
        missing.push(reqs[i]);
      }
    }
    if (missing.length > 0) {
      const missingNames = missing.map((rid) => (DATA.TECH_TREE[rid] ? DATA.TECH_TREE[rid].name : rid));
      return {
        ok: false,
        missingReq: true,
        missingReqIds: missing,
        reason: `선행 연구 완료 필요: ${missingNames.join(', ')}`
      };
    }
    const costRp = getTechCost(id);
    if ((state.rp || 0) < costRp) {
      return {
        ok: false,
        shortRp: true,
        costRp,
        reason: `연구포인트(RP)가 부족합니다. (필요: ${costRp} RP)`
      };
    }
    return { ok: true, costRp, nextLv: curLv + 1 };
  }

  function researchTech(id) {
    const check = canResearchTech(id);
    if (!check.ok) {
      ZS.Audio.playError();
      G.banner('연구 진행 불가', check.reason, 'warn');
      return false;
    }
    const def = DATA.TECH_TREE[id];
    state.rp -= check.costRp;
    if (!state.researchedTechs) state.researchedTechs = {};
    state.researchedTechs[id] = check.nextLv;

    if (G.invalidateStatsCache) G.invalidateStatsCache();
    recalculateBaseStats(true);

    if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
    else ZS.Audio.playBuild();

    const lvSuffix = (def.maxLv || 1) > 1 ? ` Lv.${check.nextLv}` : '';
    G.banner(`연구 완료: ${def.name}${lvSuffix}`, def.desc, 'good');
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function getItemRequiredTech(itemId) {
    const id = itemId === 'shelter_pod' ? 'field_tent' : itemId;
    switch (id) {
      case 'sniper_tower': return 'inf_sniper';
      case 'vulcan_turret': return 'tur_vulcan';
      case 'missile_pod': return 'tur_missile';
      case 'emp_coil': return 'tur_emp';
      default: {
        const def = DATA.ITEMS && DATA.ITEMS[id];
        return (def && def.reqTech) || null;
      }
    }
  }

  function getUpgradeRequiredTech(defOrId, targetLv) {
    const def = typeof defOrId === 'string' ? DATA.ITEMS[defOrId] : defOrId;
    if (!def || !targetLv || targetLv <= 1) return null;
    if (def.id === 'barricade_wall' || def.id === 'tactical_gate' || def.id === 'razor_pad') {
      if (targetLv === 2) return 'def_t1';
      if (targetLv >= 3) return 'def_t2';
    }
    if (def.subType === 'manned') {
      if (targetLv === 2) return 'inf_lv2';
      if (targetLv >= 3) return 'inf_lv3';
    }
    if (def.subType === 'turret') {
      if (targetLv === 2) return 'tur_lv2';
      if (targetLv >= 3) return 'tur_lv3';
    }
    if (
      def.id === 'solar_array' ||
      def.id === 'wind_turbine' ||
      def.id === 'battery_bank' ||
      def.id === 'field_tent' ||
      def.id === 'repair_bay'
    ) {
      if (targetLv === 2) return 'inf_tier2';
      if (targetLv === 3) return 'inf_tier3';
      if (targetLv >= 4) return 'inf_tier4';
    }
    return null;
  }

  function getTierMap(defOrId) {
    const id = typeof defOrId === 'string' ? defOrId : defOrId && defOrId.id;
    if (!id || !DATA.TIER_MAPS) return null;
    return DATA.TIER_MAPS[id] || null;
  }

  function isTierEvolutionDef(defOrId) {
    return !!getTierMap(defOrId);
  }

  function getStructMaxTier(defOrId) {
    const map = getTierMap(defOrId);
    if (!map) return 3;
    const keys = Object.keys(map);
    return keys.length > 0 ? keys.length : 3;
  }

  function isUpgradeableDef(def) {
    if (!def || def.layer !== 'struct') return false;
    if (isTierEvolutionDef(def)) return true;
    return def.category === 'defense' || def.category === 'infra';
  }

  const TIER_UPCOST_OVERRIDES = {
    barricade_wall: {
      2: { wood: 4, scrap: 10 },
      3: { wood: 4, scrap: 24, coin: 10 }
    },
    tactical_gate: {
      2: { wood: 4, scrap: 18, coin: 8 },
      3: { wood: 6, scrap: 36, coin: 24 }
    }
  };

  function normalizeCozyGroup(grp) {
    if (!grp) return grp;
    if (/^repair_t\d+$/.test(grp)) return 'decor_repair';
    if (/^solar_t\d+$/.test(grp)) return 'infra_solar';
    if (/^wind_t\d+$/.test(grp)) return 'infra_wind';
    if (/^battery_t\d+$/.test(grp)) return 'infra_battery';
    if (/^housing_t\d+$/.test(grp)) return 'infra_housing';
    return grp;
  }

  function getUpgradeCost(def, fromLevel) {
    if (!isUpgradeableDef(def)) return null;
    const nextLv = (fromLevel || 1) + 1;
    const overrideMap = TIER_UPCOST_OVERRIDES[def.id];
    if (overrideMap && overrideMap[nextLv]) {
      return { ...overrideMap[nextLv] };
    }
    const tierMap = getTierMap(def);
    if (tierMap) {
      const nextTier = tierMap[nextLv];
      return nextTier && nextTier.upCost ? { ...nextTier.upCost } : null;
    }
    const base = def.cost || {};
    if (fromLevel === 1) {
      return {
        wood: Math.max(4, Math.round((base.wood || 8) * 0.45)),
        scrap: Math.max(16, Math.round((base.scrap || 12) * 1.35)),
        coin: (base.coin || 0) + 14
      };
    }
    if (fromLevel === 2) {
      return {
        wood: Math.max(6, Math.round((base.wood || 10) * 0.55)),
        scrap: Math.max(30, Math.round((base.scrap || 14) * 2.25)),
        coin: Math.round((base.coin || 0) * 1.6) + 34
      };
    }
    return null;
  }

  function scaleCostObj(cost, mult) {
    if (!cost) return null;
    const out = {};
    const m = mult != null ? mult : 1.0;
    if (cost.wood) out.wood = m === 1.0 ? cost.wood : Math.max(1, Math.round(cost.wood * m));
    if (cost.scrap) out.scrap = m === 1.0 ? cost.scrap : Math.max(1, Math.round(cost.scrap * m));
    if (cost.coin) out.coin = m === 1.0 ? cost.coin : Math.max(1, Math.round(cost.coin * m));
    return out;
  }

  function getEffectiveHqUpgradeCost(targetLevel) {
    const lv = targetLevel || ((state.hqLevel || 1) + 1);
    const info = G.getHqLevelInfo(lv);
    if (!info || !info.cost) return null;
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const mult = (div && div.hqCostMult) || 1.0;
    return scaleCostObj(info.cost, mult);
  }

  function getEffectiveBuildCost(rawItemId) {
    const itemId = rawItemId === 'shelter_pod' ? 'field_tent' : rawItemId;
    const def = DATA.ITEMS[itemId];
    if (!def || !def.cost) return {};
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const mult = (def.subType === 'turret' && div && div.turretCostMult) ? div.turretCostMult : 1.0;
    return scaleCostObj(def.cost, mult) || {};
  }

  function getEffectiveUpgradeCost(defOrId, fromLevel) {
    const def = typeof defOrId === 'string' ? DATA.ITEMS[defOrId] : defOrId;
    const baseCost = getUpgradeCost(def, fromLevel);
    if (!baseCost) return null;
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const mult = (def && def.subType === 'turret' && div && div.turretCostMult) ? div.turretCostMult : 1.0;
    return scaleCostObj(baseCost, mult);
  }

  function getStructureDisplayName(st) {
    if (!st) return '';
    if (st.id === 'command_hq') return DATA.HQ_STATS.name;
    const def = DATA.ITEMS[st.id];
    const tierMap = getTierMap(st.id);
    if (tierMap) {
      const maxLv = getStructMaxTier(st.id);
      const tier = tierMap[Math.max(1, Math.min(maxLv, st.level || 1))];
      if (tier && tier.name) return tier.name;
    }
    return def ? def.name : st.id;
  }

  function getStructLevelProfile(def, level) {
    const isTierEvo = isTierEvolutionDef(def);
    const maxTier = isTierEvo ? getStructMaxTier(def.id) : 3;
    const lv = Math.max(1, Math.min(maxTier, level || 1));
    let hpScale = 1.0;
    let exactMaxHp = null;
    let levelName = def.name;
    let dmgScale = 1.0;
    let rateScale = 1.0;
    let rangeAdd = 0;
    let minRange = def.minRange || 0;
    let critAdd = 0;
    let powerIdle = def.powerIdle || 0;
    let powerShot = def.powerShot || 0;
    let powerCap = def.powerCap || 0;
    let dayCharge = def.dayCharge || 0;
    let nightGen = def.nightGen || 0;
    let popCap = def.popCap || 0;
    let popUse = def.popUse || 0;
    let cozy = def.cozy || 0;
    let cozyGroup = normalizeCozyGroup(def.cozyGroup || null);
    let lightRadius = def.lightRadius || 0;
    let lightColor = def.lightColor || null;
    let auraRadius = def.aura ? def.aura.radius || 0 : 0;
    let regenPerSec = def.aura ? def.aura.regenPerSec || 0 : 0;
    let trapDps = def.trapDps || 0;
    let trapWear = 3.2;
    let slowFactor = def.slowFactor || 1.0;
    let gateSlowRadius = def.gateSlowRadius || 0;
    let gateSlowFactor = def.gateSlowFactor || 1.0;
    let vulnMult = 1.0;
    let thornsRatio = def.thornsRatio || 0;
    let thornsMin = 4;
    let allowWallMount = false;
    let mountBaseZ = 0;
    let pellets = def.pellets || 1;
    let knockback = 0;
    let pierceCount = 1;
    let burstSecondMult = 0;
    let splashRadius = def.splashRadius || 0;
    let salvoCount = def.salvoCount || 1;
    let salvoScatter = def.salvoScatter || 0;
    let chainCount = def.chainCount || 3;
    let slowDuration = def.slowDuration || 1.5;

    const tierMap = getTierMap(def);
    if (tierMap && tierMap[lv]) {
      const tier = tierMap[lv];
      exactMaxHp = tier.maxHp;
      levelName = tier.name || def.name;
      if (tier.powerCap !== undefined) powerCap = tier.powerCap;
      if (tier.dayCharge !== undefined) dayCharge = tier.dayCharge;
      if (tier.nightGen !== undefined) nightGen = tier.nightGen;
      if (tier.popCap !== undefined) popCap = tier.popCap;
      if (tier.cozy !== undefined) cozy = tier.cozy;
      if (tier.cozyGroup !== undefined) cozyGroup = normalizeCozyGroup(tier.cozyGroup);
      if (tier.lightRadius !== undefined) lightRadius = tier.lightRadius;
      if (tier.lightColor !== undefined) lightColor = tier.lightColor;
      if (tier.auraRadius !== undefined) auraRadius = tier.auraRadius;
      if (tier.regenPerSec !== undefined) regenPerSec = tier.regenPerSec;
      if (tier.trapDps !== undefined) trapDps = tier.trapDps;
      if (tier.trapWear !== undefined) trapWear = tier.trapWear;
      if (tier.slowFactor !== undefined) slowFactor = tier.slowFactor;
      if (tier.gateSlowRadius !== undefined) gateSlowRadius = tier.gateSlowRadius;
      if (tier.gateSlowFactor !== undefined) gateSlowFactor = tier.gateSlowFactor;
      if (tier.vulnMult !== undefined) vulnMult = tier.vulnMult;
      if (tier.thornsRatio !== undefined) thornsRatio = tier.thornsRatio;
      if (tier.thornsMin !== undefined) thornsMin = tier.thornsMin;
      if (tier.allowWallMount !== undefined) allowWallMount = !!tier.allowWallMount;
      if (tier.mountBaseZ !== undefined) mountBaseZ = tier.mountBaseZ;
    } else if (def.subType === 'wall') {
      if (lv === 2) hpScale = 1.45;
      else if (lv === 3) {
        hpScale = 2.00;
        thornsRatio = 0.35;
        thornsMin = 8;
      }
    } else if (def.subType === 'gate') {
      if (lv === 1) {
        gateSlowFactor = def.gateSlowFactor || 0.75;
      } else if (lv === 2) {
        hpScale = 1.45;
        gateSlowFactor = def.gateSlowFactor || 0.75;
      } else if (lv === 3) {
        hpScale = 2.05;
        gateSlowFactor = 0.60;
        thornsRatio = 0.35;
        thornsMin = 8;
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
        popUse = 2;
        dmgScale = 1.92;
        rateScale = 1.32;
        hpScale = 1.70;
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
    } else if (def.id === 'missile_pod') {
      if (lv === 1) {
        salvoCount = 2;
        salvoScatter = 0.25;
        powerShot = 2.4;
        splashRadius = 1.20;
      } else if (lv === 2) {
        dmgScale = 26 / 24;
        rateScale = 1.0;
        hpScale = 1.25;
        powerIdle = +(powerIdle * 1.15).toFixed(2);
        powerShot = 3.1;
        salvoCount = 3;
        salvoScatter = 0.50;
        splashRadius = 1.20;
      } else if (lv === 3) {
        dmgScale = 28 / 24;
        rateScale = 1.0;
        hpScale = 1.55;
        powerIdle = +(powerIdle * 1.30).toFixed(2);
        powerShot = 4.0;
        salvoCount = 6;
        salvoScatter = 0.80;
        splashRadius = 1.20;
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
          powerShot = 0.28;
          critAdd = 0.12;
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
        powerCap = 135;
        dayCharge = 10;
      } else if (lv === 3) {
        hpScale = 1.55;
        powerCap = 250;
        dayCharge = 18;
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

    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    let rawBaseMaxHp = exactMaxHp !== null ? exactMaxHp : Math.round((def.maxHp || 100) * hpScale);
    if (
      div &&
      div.fortHpMult &&
      (def.id === 'barricade_wall' || def.id === 'tactical_gate' || def.id === 'razor_pad')
    ) {
      rawBaseMaxHp = Math.round(rawBaseMaxHp * div.fortHpMult);
    }
    if (div && div.trapDpsMult && def.id === 'razor_pad' && trapDps > 0) {
      trapDps = +(trapDps * div.trapDpsMult).toFixed(2);
    }
    if (div && div.fieldTentPopCapMult && def.id === 'field_tent' && popCap > 0) {
      popCap = Math.max(1, Math.round(popCap * div.fieldTentPopCapMult));
    }

    return {
      level: lv,
      levelName,
      baseMaxHp: rawBaseMaxHp,
      dmgScale,
      rateScale,
      rangeAdd,
      minRange,
      critAdd,
      powerIdle,
      powerShot,
      powerCap,
      dayCharge,
      nightGen,
      popCap,
      popUse,
      cozy,
      cozyGroup,
      lightRadius,
      lightColor,
      auraRadius,
      regenPerSec,
      trapDps,
      trapWear,
      slowFactor,
      gateSlowRadius,
      gateSlowFactor,
      vulnMult,
      thornsRatio,
      thornsMin,
      allowWallMount,
      mountBaseZ,
      pellets,
      knockback,
      pierceCount,
      burstSecondMult,
      splashRadius,
      salvoCount,
      salvoScatter,
      chainCount,
      slowDuration,
      perkLabel: !isTierEvo && lv >= 3 && DATA.LV3_PERK_LABELS ? DATA.LV3_PERK_LABELS[def.id] || null : null
    };
  }

  function getTerrainPowerStats(defId, prof, tx, ty) {
    let powerCap = (prof && prof.powerCap) || 0;
    let dayCharge = (prof && prof.dayCharge) || 0;
    let nightGen = (prof && prof.nightGen) || 0;
    const terrain = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
    const onWind = !!(terrain && terrain.kind === 'wind');
    const windTier = onWind ? (terrain.tier || 1) : 0;
    const wzCfg = DATA.WIND_ZONE || {};
    const windMult = onWind
      ? (terrain.windMult || (windTier === 2 ? (wzCfg.coreMult || 1.70) : (wzCfg.outerMult || 1.40)))
      : 1.0;
    if (onWind && defId === 'wind_turbine') {
      dayCharge = +(dayCharge * windMult).toFixed(2);
      nightGen = +(nightGen * windMult).toFixed(3);
    }
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    if (div && div.solarBatteryMult && (defId === 'solar_array' || defId === 'battery_bank' || defId === 'b1_ess_rack')) {
      powerCap = Math.round(powerCap * div.solarBatteryMult);
      dayCharge = +(dayCharge * div.solarBatteryMult).toFixed(2);
    }
    return {
      powerCap,
      dayCharge,
      nightGen,
      onWind,
      windTier,
      windMult
    };
  }

  function recalculateBaseStats(silentTierUp) {
    state.undergroundUnlocked = (state.hqLevel || 1) >= 2;
    if (!state.undergroundUnlocked && state.activeLayer === 'underground') {
      if (G.exitUnderground) G.exitUnderground();
      else state.activeLayer = 'surface';
    }
    const hqInfo = G.getHqLevelInfo(state.hqLevel);
    const hqAura = hqInfo && hqInfo.globalAura ? hqInfo.globalAura : null;
    const hqStructHpMult = (hqAura && hqAura.structHpMult) || 1.0;
    const defRepeatLv = getTechLevel('def_repeat');
    const infraRepeatLv = getTechLevel('infra_repeat');
    const infraPowerMult = 1 + 0.10 * infraRepeatLv;
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const prevTierLevel = state.cozyTier ? state.cozyTier.level : 1;
    let powerCap = hqInfo.basePowerCap;
    let dayCharge = hqInfo.baseDayCharge;
    let nightGen = 0;
    let nightIdleDrain = 0;
    let popCap = hqInfo.basePopCap + ((div && div.basePopCapBonus) || 0) + (state.debugBonusPopCap || 0);
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

        const accumulateStructStats = (targetSt) => {
          if (!targetSt || targetSt.id === 'command_hq') return;
          const def = DATA.ITEMS[targetSt.id];
          if (!def) return;

          // Update maxHp & infra stats with upgrade level/tier + floor bonus + HQ aura + def_repeat tech
          const prof = getStructLevelProfile(def, targetSt.level || 1);
          const isFort = def.subType === 'wall' || def.subType === 'gate' || def.subType === 'trap';
          const defHpTechMult = isFort && defRepeatLv > 0 ? (1 + 0.15 * defRepeatLv) : 1.0;
          const hpMult = (1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0)) * hqStructHpMult * defHpTechMult;
          const targetMax = Math.round(prof.baseMaxHp * hpMult);
          if (targetSt.maxHp !== targetMax) {
            const ratio = targetSt.maxHp > 0 ? targetSt.hp / targetSt.maxHp : 1;
            targetSt.maxHp = targetMax;
            targetSt.hp = Math.min(targetMax, Math.max(1, Math.round(targetMax * ratio)));
          }

          const pStats = getTerrainPowerStats(targetSt.id, prof, x, y);
          if (pStats.powerCap) powerCap += pStats.powerCap;
          if (pStats.dayCharge) dayCharge += pStats.dayCharge;
          if (pStats.nightGen) nightGen += pStats.nightGen;
          if (def.requiresPower && prof.powerIdle) nightIdleDrain += prof.powerIdle;
          if (prof.popCap) popCap += prof.popCap;
          if (prof.popUse) popUsed += prof.popUse;

          if (prof.cozy) {
            const grp = normalizeCozyGroup(prof.cozyGroup || def.cozyGroup || def.id);
            if (!structGroups[grp]) structGroups[grp] = [];
            structGroups[grp].push(prof.cozy);
            groupCounts[grp] = (groupCounts[grp] || 0) + 1;

            // Lounge tile +3 decor synergy is separate from the 60-point floor cap
            if (fDef && fDef.cozyTileBonus && def.category === 'decor') {
              synergyScore += fDef.cozyTileBonus;
            }
            if (grp) uniqueGroups.add(grp);
          }
        };

        const st = state.structGrid[y][x];
        if (!st || st.id === 'command_hq') continue;
        accumulateStructStats(st);
        if (st.mounted) {
          accumulateStructStats(st.mounted);
        }
      }
    }

    // Aggregate active Underground B1 gadgets (connectivity, 4th-copy diminishing, blackout pause)
    const ugEff = G.recomputeUndergroundEffects ? G.recomputeUndergroundEffects() : null;
    if (ugEff) {
      powerCap += ugEff.powerCap || 0;
      dayCharge += ugEff.dayCharge || 0;
      nightGen += ugEff.nightGen || 0;
      nightIdleDrain += ugEff.nightIdleDrain || 0;
      popCap += ugEff.popCap || 0;
      synergyScore += ugEff.cozySynergy || 0;
      const entries = ugEff.cozyEntries || [];
      for (let i = 0; i < entries.length; i++) {
        const ce = entries[i];
        const grp = normalizeCozyGroup(ce.grp);
        if (!structGroups[grp]) structGroups[grp] = [];
        structGroups[grp].push(ce.score);
        groupCounts[grp] = (groupCounts[grp] || 0) + 1;
        if (grp) uniqueGroups.add(grp);
      }
    }

    const floorCap = DATA.COZY_FLOOR_CAP || 60;
    const floorScore = Math.min(floorCap, floorRaw);

    // Same cozyGroup structures: first 3 at 100%, 4th+ at Math.round(score * 0.5) (sorted descending)
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

    state.powerCap = Math.round(powerCap * infraPowerMult);
    state.dayCharge = +(dayCharge * infraPowerMult).toFixed(2);
    state.nightGen = +nightGen.toFixed(3);
    state.nightIdleDrain = nightIdleDrain;
    state.popCap = popCap;
    state.popUsed = popUsed;
    if (G.normalizeJobs) G.normalizeJobs();
    state.cozyFloorRaw = floorRaw;
    state.cozyFloorScore = floorScore;
    state.cozyStructScore = structScore;
    state.cozySynergyScore = synergyScore;
    state.cozyGroupCounts = groupCounts;
    state.cozyScore = totalCozy;
    state.cozyDiversityBonus = diversityBonus;
    state.cozyTier = tier;
    if (G.invalidateStatsCache) G.invalidateStatsCache();

    if (!silentTierUp && tier.level > prevTierLevel) {
      state.cozyTierUpTimer = 0.8;
      state.cozyPulseSeq = (state.cozyPulseSeq || 0) + 1;
      state.flares.push({
        x: DATA.HQ_POS.x + 0.5,
        y: DATA.HQ_POS.y + 0.5,
        radius: 3.0,
        life: 0.8
      });
      G.banner(`안락함 Lv.${tier.level} — ${tier.title}`, `요원 화력 +${Math.round(tier.agentDmg * 100)}% · 숙련도 +${Math.round((tier.xpBonus || 0) * 100)}% · 무료수리 ${Math.round(tier.freeRepair * 100)}%`, 'good');
    }
  }

  function getPlacementCozyPreview(itemId, tx, ty) {
    const resolvedId = itemId === 'shelter_pod' ? 'field_tent' : itemId;
    const def = DATA.ITEMS[resolvedId];
    if (!def) return null;

    let spawnLv = 1;
    if (itemId === 'shelter_pod' || (resolvedId === 'field_tent' && (state.freeVouchers.shelter_pod || 0) > 0)) {
      spawnLv = 3;
    }
    const prof = def.layer === 'floor' ? null : getStructLevelProfile(def, spawnLv);
    const cozyVal = def.layer === 'floor' ? (def.cozy || 0) : (prof ? prof.cozy : (def.cozy || 0));
    if (!cozyVal) return null;

    if (def.layer === 'floor') {
      const cap = DATA.COZY_FLOOR_CAP || 60;
      const curRaw = state.cozyFloorRaw || 0;
      let prevFloorCozy = 0;
      if (tx !== undefined && ty !== undefined && tx >= 0 && ty >= 0 && tx < N && ty < N) {
        const oldFid = state.floorGrid[ty] && state.floorGrid[ty][tx];
        const oldDef = oldFid ? DATA.ITEMS[oldFid] : null;
        if (oldDef && oldDef.cozy) prevFloorCozy = oldDef.cozy;
      }
      const nextRaw = curRaw - prevFloorCozy + cozyVal;
      const effectiveGain = Math.max(0, Math.min(cap, nextRaw) - Math.min(cap, curRaw));
      return {
        base: cozyVal,
        gain: effectiveGain,
        isDiminished: false,
        isFloorCapped: curRaw >= cap || effectiveGain === 0
      };
    }

    const grp = normalizeCozyGroup((prof && prof.cozyGroup) || def.cozyGroup || def.id);
    const existingCount = (state.cozyGroupCounts && state.cozyGroupCounts[grp]) || 0;
    const isDiminished = existingCount >= 3;
    let gain = isDiminished ? Math.round(cozyVal * 0.5) : cozyVal;
    if (def.domain === 'underground') {
      if (resolvedId === 'b1_locker' && def.adjacentBedSynergy && tx !== undefined && ty !== undefined && state.underground) {
        const ug = state.underground;
        const b1N = DATA.B1_SIZE || 23;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < dirs.length; k++) {
          const nx = tx + dirs[k][0];
          const ny = ty + dirs[k][1];
          if (nx < 1 || ny < 1 || nx >= b1N - 1 || ny >= b1N - 1) continue;
          const ng = ug.b1StructGrid && ug.b1StructGrid[ny] && ug.b1StructGrid[ny][nx];
          const nc = ug.grid && ug.grid[ny] && ug.grid[ny][nx];
          if (ng && ng.id === 'b1_bunk_bed' && nc && nc.roomId != null && ug.rooms[nc.roomId] && ug.rooms[nc.roomId].connected) {
            gain += Math.round(def.adjacentBedSynergy * (isDiminished ? 0.5 : 1.0));
            break;
          }
        }
      }
    } else if (tx !== undefined && ty !== undefined && tx >= 0 && ty >= 0 && tx < N && ty < N) {
      const fid = state.floorGrid[ty] && state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      if (fDef && fDef.cozyTileBonus && def.category === 'decor') {
        gain += fDef.cozyTileBonus;
      }
    }
    return {
      base: cozyVal,
      gain,
      isDiminished,
      isFloorCapped: false
    };
  }

  function computeStructureEffectiveStatsUncached(st, tx, ty, overrideLevel, isMounted) {
    if (!st) return { damage: 0, fireRate: 0, range: 0, critChance: 0, lightRadius: 0, auraStacks: {} };
    const def = DATA.ITEMS[st.id];
    if (!def) return { damage: 0, fireRate: 0, range: 0, critChance: 0, lightRadius: 0, auraStacks: {} };

    const onWall = isMounted !== undefined
      ? !!isMounted
      : !!(state.structGrid[ty] && state.structGrid[ty][tx] && state.structGrid[ty][tx].mounted === st);
    const lv = overrideLevel !== undefined ? overrideLevel : (st.level || 1);
    const prof = getStructLevelProfile(def, lv);
    const rank = G.isCombatVeterancyDef(def) ? (st.rank || G.computeRankFromXp(st.xp || 0)) : 0;
    const rankInfo = G.getVeterancyRankInfo(rank);

    let dmgMult = 1.0 + rankInfo.dmgBonus;
    let rateMult = 1.0 + state.cozyTier.fireRate + rankInfo.rateBonus;
    let rangeMult = 1.0;
    let critChance = 0.04 + prof.critAdd + rankInfo.critAdd;

    if (def.subType === 'manned') {
      dmgMult += state.cozyTier.agentDmg;
      rateMult += (state.b1MannedFireRateMult || 0);
    }

    if (state.phase === 'night' && state.nightConsumables && state.nightConsumables.overpressureAmmo) {
      if (def.subType === 'manned' || def.subType === 'turret') {
        dmgMult += 0.20;
      }
    }

    const fid = state.floorGrid[ty] && state.floorGrid[ty][tx];
    const fDef = fid ? DATA.ITEMS[fid] : null;
    if (fDef && fDef.rateTileBonus) {
      rateMult += fDef.rateTileBonus;
    }

    const powered = !state.isNight || !state.blackoutActive;
    const div = G.getDivisionDef ? G.getDivisionDef() : null;
    const arcOverdrive = G.isArcOverdriveActive ? G.isArcOverdriveActive() : false;
    const auraCounts = {};
    const terrain = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
    const onPlateau = !!(terrain && terrain.kind === 'plateau');
    const pBonus = DATA.PLATEAU_BONUS || {};

    // Scan aura providers (ground structures and wall-mounted units) with same-ID stacking cap: 1st 100%, 2nd 50%, 3rd+ 0%
    const applyAuraFrom = (provider, providerMounted, px, py, dist) => {
      if (!provider || provider.id === 'command_hq') return;
      const oDef = DATA.ITEMS[provider.id];
      if (!oDef || !oDef.aura) return;
      if (oDef.requiresPower && (!powered || (provider.empStunTimer || 0) > 0)) return;

      const oProf = getStructLevelProfile(oDef, provider.level || 1);
      const baseAuraR = oProf.auraRadius || oDef.aura.radius || 0;
      const pTerrain = G.getTerrainAt ? G.getTerrainAt(px, py) : null;
      const pOnPlateau = !!(pTerrain && pTerrain.kind === 'plateau');
      let auraRadius =
        baseAuraR +
        (providerMounted && oDef.id === 'led_floodlight' ? 0.4 : 0) +
        (pOnPlateau && baseAuraR > 0 ? (pBonus.auraAdd != null ? pBonus.auraAdd : 0.5) : 0);
      if (arcOverdrive && oDef.id === 'led_floodlight' && auraRadius > 0) {
        auraRadius *= (div && div.overdriveFloodlightMult) || 1.25;
      }
      if (dist <= auraRadius + 0.05) {
        const hasCombatAura = !!(oDef.aura.mannedDmg || oDef.aura.fireRate || oDef.aura.rangeMult || oDef.aura.critChance);
        if (!hasCombatAura) return;
        const nextCount = (auraCounts[oDef.id] || 0) + 1;
        auraCounts[oDef.id] = nextCount;
        const stackWeight = nextCount === 1 ? 1.0 : nextCount === 2 ? 0.5 : 0.0;
        if (stackWeight <= 0) return;

        if (oDef.aura.mannedDmg && def.subType === 'manned') {
          dmgMult += oDef.aura.mannedDmg * stackWeight;
        }
        if (oDef.aura.fireRate) {
          rateMult += oDef.aura.fireRate * stackWeight;
        }
        if (oDef.aura.rangeMult) {
          rangeMult += oDef.aura.rangeMult * stackWeight;
        }
        if (oDef.aura.critChance) {
          critChance += oDef.aura.critChance * stackWeight;
        }
      }
    };

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const other = state.structGrid[y][x];
        if (!other) continue;
        const dist = Math.hypot(tx - x, ty - y);
        applyAuraFrom(other, false, x, y, dist);
        if (other.mounted) {
          applyAuraFrom(other.mounted, true, x, y, dist);
        }
      }
    }

    const isCombatUnit = def.subType === 'manned' || def.subType === 'turret';
    if (isCombatUnit && state.b1HoloCritAdd) {
      critChance += state.b1HoloCritAdd;
    }
    if (onPlateau && isCombatUnit) {
      critChance += pBonus.critAdd != null ? pBonus.critAdd : 0.08;
    }
    if (isCombatUnit && div && div.rangeMult) {
      rangeMult *= div.rangeMult;
    }
    if (div && div.id === 'nightwatch' && state.blackoutActive && def.subType === 'manned') {
      rateMult *= (div.blackoutMannedFireRateMult || 1.40);
      critChance += (div.blackoutMannedCritAdd != null ? div.blackoutMannedCritAdd : 0.20);
    }
    if (arcOverdrive && def.subType === 'turret') {
      rateMult *= (div && div.overdriveTurretFireRateMult) || 1.25;
    }

    const hqInfo = G.getHqLevelInfo ? G.getHqLevelInfo(state.hqLevel) : null;
    const hqAura = hqInfo && hqInfo.globalAura ? hqInfo.globalAura : null;
    if (hqAura && isCombatUnit) {
      if (hqAura.dmgMult && hqAura.dmgMult !== 1) {
        dmgMult *= hqAura.dmgMult;
      }
      if (hqAura.fireRateMult && hqAura.fireRateMult !== 1) {
        rateMult *= hqAura.fireRateMult;
      }
    }

    const infRepeatLv = getTechLevel('inf_repeat');
    if (def.subType === 'manned' && infRepeatLv > 0) {
      dmgMult *= 1 + 0.12 * infRepeatLv;
      critChance += 0.03 * infRepeatLv;
    }

    const turRepeatLv = getTechLevel('tur_repeat');
    let effPowerShot = prof.powerShot;
    if (def.subType === 'turret' && turRepeatLv > 0) {
      dmgMult *= 1 + 0.12 * turRepeatLv;
      if (effPowerShot > 0) {
        effPowerShot = +(effPowerShot * Math.max(0.4, 1 - 0.06 * turRepeatLv)).toFixed(3);
      }
    }

    const baseDmg = (def.damage || 0) * prof.dmgScale;
    const baseRate = (def.fireRate || 0) * prof.rateScale;
    const mountRangeBonus = onWall && def.range ? 0.5 : 0;
    const plateauRangeBonus = onPlateau && isCombatUnit && def.range ? (pBonus.rangeAdd != null ? pBonus.rangeAdd : 1.0) : 0;
    const elevRangeCap = pBonus.mountCap != null ? pBonus.mountCap : 1.25;
    const combinedElevRangeBonus =
      mountRangeBonus > 0 && plateauRangeBonus > 0
        ? Math.min(elevRangeCap, mountRangeBonus + plateauRangeBonus)
        : mountRangeBonus + plateauRangeBonus;
    const baseRange = (def.range || 0) + prof.rangeAdd + rankInfo.rangeAdd + combinedElevRangeBonus;

    const baseLightR = prof.lightRadius !== undefined ? prof.lightRadius : (def.lightRadius || 0);
    let lightRadius =
      baseLightR > 0
        ? baseLightR +
          (onWall && def.id === 'led_floodlight' ? 0.6 : 0) +
          (onPlateau ? (pBonus.lightAdd != null ? pBonus.lightAdd : 1.0) : 0)
        : 0;
    const lightColor = prof.lightColor || def.lightColor || null;
    const baseSelfAuraR = def.aura ? (prof.auraRadius || def.aura.radius || 0) : 0;
    let auraRadius =
      baseSelfAuraR > 0
        ? baseSelfAuraR +
          (onWall && def.id === 'led_floodlight' ? 0.4 : 0) +
          (onPlateau ? (pBonus.auraAdd != null ? pBonus.auraAdd : 0.5) : 0)
        : 0;
    if (arcOverdrive && def.id === 'led_floodlight') {
      const flMult = (div && div.overdriveFloodlightMult) || 1.25;
      if (lightRadius > 0) lightRadius = +(lightRadius * flMult).toFixed(3);
      if (auraRadius > 0) auraRadius = +(auraRadius * flMult).toFixed(3);
    }

    return {
      level: lv,
      rank,
      rankInfo,
      isMounted: onWall,
      onPlateau,
      elevRangeBonus: combinedElevRangeBonus,
      damage: baseDmg * dmgMult,
      fireRate: baseRate * rateMult,
      range: baseRange * rangeMult,
      minRange: prof.minRange || def.minRange || 0,
      lightRadius,
      lightColor,
      auraRadius,
      gateSlowRadius: prof.gateSlowRadius,
      critChance: Math.min(0.85, critChance),
      powerIdle: prof.powerIdle,
      powerShot: effPowerShot,
      pellets: prof.pellets,
      knockback: prof.knockback,
      pierceCount: prof.pierceCount,
      burstSecondMult: prof.burstSecondMult,
      splashRadius: prof.splashRadius,
      salvoCount: prof.salvoCount || def.salvoCount || 1,
      salvoScatter: prof.salvoScatter != null ? prof.salvoScatter : (def.salvoScatter || 0),
      chainCount: prof.chainCount,
      slowDuration: prof.slowDuration,
      perkLabel: prof.perkLabel,
      prof,
      auraStacks: auraCounts
    };
  }

  function getStructureEffectiveStats(st, tx, ty, overrideLevel, isMounted) {
    if (!st) return { damage: 0, fireRate: 0, range: 0, critChance: 0, lightRadius: 0, auraStacks: {} };
    const def = DATA.ITEMS[st.id];
    if (!def) return { damage: 0, fireRate: 0, range: 0, critChance: 0, lightRadius: 0, auraStacks: {} };

    const canCache = overrideLevel === undefined && tx >= 0 && ty >= 0 && tx < N && ty < N;
    if (!canCache) {
      return computeStructureEffectiveStatsUncached(st, tx, ty, overrideLevel, isMounted);
    }

    const onWall = isMounted !== undefined
      ? !!isMounted
      : !!(state.structGrid[ty] && state.structGrid[ty][tx] && state.structGrid[ty][tx].mounted === st);
    const lv = st.level || 1;
    const rank = G.isCombatVeterancyDef(def) ? (st.rank || G.computeRankFromXp(st.xp || 0)) : 0;
    const curEpoch = state.statsEpoch || 0;
    const cacheKey = onWall ? '_effCacheMounted' : '_effCache';
    const cached = st[cacheKey];

    if (
      cached &&
      cached.epoch === curEpoch &&
      cached.tx === tx &&
      cached.ty === ty &&
      cached.lv === lv &&
      cached.rank === rank &&
      cached.id === st.id
    ) {
      return cached.val;
    }

    const val = computeStructureEffectiveStatsUncached(st, tx, ty, undefined, onWall);
    const entry = { epoch: curEpoch, tx, ty, lv, rank, id: st.id, val };
    if (Object.prototype.hasOwnProperty.call(st, cacheKey)) {
      st[cacheKey] = entry;
    } else {
      Object.defineProperty(st, cacheKey, {
        value: entry,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
    return val;
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
    const maxLv = (DATA.HQ_LEVELS && DATA.HQ_LEVELS.length) || 5;
    if (state.hqLevel >= maxLv) {
      return { ok: false, isMax: true, reason: `이미 최고 지휘 본부 등급(Lv.${maxLv})에 도달했습니다.` };
    }
    const nextInfo = G.getHqLevelInfo(state.hqLevel + 1);
    const effCost = getEffectiveHqUpgradeCost(nextInfo.level);
    const reqWave = nextInfo.reqWave || 1;
    if ((state.wave || 1) < reqWave) {
      return {
        ok: false,
        lockedByWave: true,
        reqWave,
        reason: `WAVE ${reqWave} 도달 시 증축할 수 있습니다. (현재 WAVE ${state.wave})`,
        nextInfo,
        cost: effCost
      };
    }
    if (!canAffordCost(effCost)) {
      const c = effCost || {};
      return {
        ok: false,
        reason: `증축 자원이 부족합니다. (필요: 목재 ${c.wood || 0} · 고철 ${c.scrap || 0} · 코인 ${c.coin || 0})`,
        nextInfo,
        cost: effCost
      };
    }
    return { ok: true, nextInfo, cost: effCost };
  }

  function upgradeHq() {
    const check = canUpgradeHq();
    if (!check.ok) {
      ZS.Audio.playError();
      G.banner('지휘 본부 증축 불가', check.reason, 'warn');
      return false;
    }

    const prevInfo = G.getHqLevelInfo(state.hqLevel);
    const nextInfo = check.nextInfo;
    payCost(check.cost || getEffectiveHqUpgradeCost(nextInfo.level));

    state.hqLevel = nextInfo.level;
    const hq = state.structGrid[DATA.HQ_POS.y] && state.structGrid[DATA.HQ_POS.y][DATA.HQ_POS.x];
    const hpGain = Math.max(0, nextInfo.maxHp - prevInfo.maxHp);
    if (hq && hq.id === 'command_hq') {
      hq.level = nextInfo.level;
      hq.maxHp = nextInfo.maxHp;
      hq.hp = Math.min(nextInfo.maxHp, hq.hp + hpGain);
      hq.upgradeAnimTimer = 1.2;
    }

    if (nextInfo.level >= 2 || nextInfo.unlocksUnderground) {
      state.undergroundUnlocked = true;
    }
    if (nextInfo.level === 2 && nextInfo.bonusDigAp) {
      const apCap = Math.max(24, state.digApCap || 0);
      state.digApCap = apCap;
      state.digAp = Math.min(apCap, (state.digAp || 0) + nextInfo.bonusDigAp);
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
      if (G.grantAgents) G.grantAgents(1);
      else state.agents += 1;
    }

    const hx = DATA.HQ_POS.x + 0.5;
    const hy = DATA.HQ_POS.y + 0.5;
    G.spawnBurstParticles(hx, hy, 6, '#C8B898', 16);
    G.spawnBurstParticles(hx, hy, 18, DATA.PALETTE.baseLight, 10);
    G.addFloatingText(hx, hy, nextInfo.maxZ + 6, `Lv.${nextInfo.level}`, DATA.PALETTE.levelPip, 14, DATA.PALETTE.outlineDark);

    if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
    else ZS.Audio.playBuild();

    const wpnLabel = nextInfo.weapon ? `무장 [${nextInfo.weapon.name}] 개방` : '';
    const auraParts = [];
    if (nextInfo.globalAura) {
      if (nextInfo.globalAura.structHpMult && nextInfo.globalAura.structHpMult > 1) {
        auraParts.push(`시설 HP +${Math.round((nextInfo.globalAura.structHpMult - 1) * 100)}%`);
      }
      if (nextInfo.globalAura.dmgMult && nextInfo.globalAura.dmgMult > 1) {
        auraParts.push(`화력 +${Math.round((nextInfo.globalAura.dmgMult - 1) * 100)}%`);
      }
      if (nextInfo.globalAura.fireRateMult && nextInfo.globalAura.fireRateMult > 1) {
        auraParts.push(`연사 +${Math.round((nextInfo.globalAura.fireRateMult - 1) * 100)}%`);
      }
    }
    const auraLabel = auraParts.length > 0 ? `전역 오라(${auraParts.join(' · ')})` : '';
    const b1Label = nextInfo.unlocksUnderground ? '지하 쉘터(B1) 개방 및 초기 굴착력 +16 AP 지급!' : '';
    const subParts = [wpnLabel, auraLabel, b1Label].filter(Boolean).join(' · ');

    G.banner(`지휘 본부 Lv.${nextInfo.level} — ${nextInfo.name}`, subParts || `최대 내구도 ${nextInfo.maxHp} 확장 완료`, 'good');
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function canPlaceItem(rawItemId, tx, ty) {
    if (state.phase !== 'day') {
      return { ok: false, reason: '정비 페이즈(낮)에만 건설할 수 있습니다.' };
    }
    const itemId = rawItemId === 'shelter_pod' ? 'field_tent' : rawItemId;
    const def = DATA.ITEMS[itemId];
    if (!def) return { ok: false, reason: '잘못된 시설입니다.' };
    if (def.domain === 'underground') {
      return { ok: false, reason: '이 설비는 지하 B1 쉘터 전용 설비입니다.' };
    }

    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      return { ok: false, reason: '맵 범위를 벗어났습니다.' };
    }

    const isBorder = tx === 0 || ty === 0 || tx === N - 1 || ty === N - 1;
    if (def.layer === 'struct' && isBorder) {
      return { ok: false, reason: '외곽 좀비 진입 구역에는 건물을 지을 수 없습니다.' };
    }

    const terrain = G.getTerrainAt ? G.getTerrainAt(tx, ty) : null;
    if (terrain && terrain.kind === 'rock') {
      return { ok: false, reason: '자연 암석(바위) 지형에는 설치할 수 없습니다.' };
    }
    if (terrain && terrain.kind === 'ramp') {
      if (def.layer === 'floor') {
        return { ok: false, reason: '경사 언덕 지형에는 바닥재를 시공할 수 없습니다.' };
      }
      if (itemId !== 'razor_pad') {
        return { ok: false, reason: '경사 언덕에는 스파이크 트랩만 설치할 수 있습니다.' };
      }
    }

    if (def.unlockedByBoss && !state.bossDefeated) {
      return { ok: false, reason: '웨이브 5 보스 변이체를 처치하면 해금됩니다!' };
    }

    const hasPodVoucher = itemId === 'field_tent' && (state.freeVouchers.shelter_pod || 0) > 0;
    const hasVoucher = hasPodVoucher || (state.freeVouchers[itemId] || 0) > 0;
    const reqTechId = getItemRequiredTech(itemId);
    if (!hasVoucher && reqTechId && getTechLevel(reqTechId) <= 0) {
      const tDef = DATA.TECH_TREE && DATA.TECH_TREE[reqTechId];
      const tName = tDef ? tDef.name : reqTechId;
      return {
        ok: false,
        reason: `연구 [${tName}] 완료 시 해금됩니다.`,
        techLocked: true,
        reqTechId,
        reqTechName: tName
      };
    }

    const existing = state.structGrid[ty][tx];
    let mountOnWall = false;
    let autoUnderlay = false;
    let underlayCost = null;

    if (def.layer === 'floor') {
      if (state.floorGrid[ty][tx] === itemId) {
        return { ok: false, reason: '이미 같은 바닥재가 시공되어 있습니다.' };
      }
    } else if (existing) {
      if (def.canMountOnWall) {
        if (existing.id === 'barricade_wall') {
          if ((existing.level || 1) < 2) {
            return { ok: false, reason: '먼저 철조망을 Lv.2 헤스코 방벽으로 강화하세요!' };
          }
          if (existing.mounted) {
            return { ok: false, reason: '이미 상부에 시설이 거치된 성벽입니다.' };
          }
          mountOnWall = true;
        } else if (existing.id === 'tactical_gate') {
          return { ok: false, reason: '게이트 위에는 거치할 수 없습니다' };
        } else {
          return { ok: false, reason: '이미 다른 시설이 설치된 타일입니다.' };
        }
      } else if (itemId === 'barricade_wall' && DATA.ITEMS[existing.id] && DATA.ITEMS[existing.id].canMountOnWall) {
        const wallLv2Tech = getUpgradeRequiredTech(def, 2) || 'def_t1';
        if (getTechLevel(wallLv2Tech) <= 0) {
          const tDef = DATA.TECH_TREE && DATA.TECH_TREE[wallLv2Tech];
          const tName = tDef ? tDef.name : wallLv2Tech;
          return {
            ok: false,
            techLocked: true,
            reqTechId: wallLv2Tech,
            reqTechName: tName,
            reason: `Lv.2 헤스코 방벽 하부 보강은 연구 [${tName}] 완료 후 가능합니다.`
          };
        }
        autoUnderlay = true;
        const wallBaseCost = getEffectiveBuildCost(itemId);
        const wallLv2Up = getEffectiveUpgradeCost(def, 1) || { wood: 4, scrap: 10, coin: 0 };
        underlayCost = {
          wood: (hasVoucher ? 0 : (wallBaseCost.wood || 6)) + (wallLv2Up.wood || 0),
          scrap: (hasVoucher ? 0 : (wallBaseCost.scrap || 2)) + (wallLv2Up.scrap || 0),
          coin: wallLv2Up.coin || 0
        };
      } else if (existing.id === 'barricade_wall' || existing.id === 'tactical_gate') {
        return { ok: false, reason: '성벽 위에는 초소·발칸·투광기만 거치 가능합니다.' };
      } else {
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
      const combatAssigned = (state.jobs && state.jobs.combat) || 0;
      if (state.popUsed + def.popUse > combatAssigned) {
        return {
          ok: false,
          jobShort: true,
          reason: '전투요원 배정이 부족합니다! 상단 [인구·연구 (T)] 패널에서 연구/생산 요원을 전투요원으로 전환하세요.'
        };
      }
    }

    if (autoUnderlay) {
      if (!canAffordCost(underlayCost)) {
        return {
          ok: false,
          reason: `하부 보강 자원이 부족합니다. (필요: 목재 ${underlayCost.wood} · 고철 ${underlayCost.scrap})`,
          underlayCost
        };
      }
    } else if (!hasVoucher && !canAffordCost(getEffectiveBuildCost(itemId))) {
      return { ok: false, reason: '건설 자원이 부족합니다.' };
    }

    return { ok: true, mountOnWall, autoUnderlay, underlayCost };
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
      const effBase = getEffectiveBuildCost(def.id);
      total.wood += effBase.wood || 0;
      total.scrap += effBase.scrap || 0;
      total.coin += effBase.coin || 0;
    }
    const lv = st.level || 1;
    for (let k = 1; k < lv; k++) {
      const up = getEffectiveUpgradeCost(def, k);
      if (up) {
        total.wood += up.wood || 0;
        total.scrap += up.scrap || 0;
        total.coin += up.coin || 0;
      }
    }
    return total;
  }

  function canUpgradeSpecificStruct(st) {
    if (!st) return { ok: false, reason: '시설이 없습니다.' };
    if (st.id === 'command_hq') {
      return canUpgradeHq();
    }
    const def = DATA.ITEMS[st.id];
    if (!isUpgradeableDef(def)) {
      return { ok: false, reason: '이 시설은 강화 대상이 아닙니다.', notUpgradeable: true };
    }
    const isTierEvo = isTierEvolutionDef(def);
    const maxLv = isTierEvo ? getStructMaxTier(def) : 3;
    const curLv = st.level || 1;
    if (curLv >= maxLv) {
      return {
        ok: false,
        reason: isTierEvo ? '이미 최종 진화 단계에 도달했습니다.' : '이미 최고 강화 단계(Lv.3)입니다.',
        isMax: true
      };
    }
    const nextLv = curLv + 1;
    const cost = getEffectiveUpgradeCost(def, curLv);
    const curProf = getStructLevelProfile(def, curLv);
    const nextProf = getStructLevelProfile(def, nextLv);
    const reqTechId = getUpgradeRequiredTech(def, nextLv);
    if (reqTechId && getTechLevel(reqTechId) <= 0) {
      const tDef = DATA.TECH_TREE && DATA.TECH_TREE[reqTechId];
      const tName = tDef ? tDef.name : reqTechId;
      return {
        ok: false,
        reason: isTierEvo
          ? `연구 [${tName}] 완료 시 ${nextProf.levelName || '상위 티어'}로 업그레이드됩니다.`
          : `연구 [${tName}] 완료 시 Lv.${nextLv} 강화가 해금됩니다.`,
        techLocked: true,
        reqTechId,
        reqTechName: tName,
        cost
      };
    }
    const popDelta = Math.max(0, (nextProf.popUse || def.popUse || 0) - (curProf.popUse || def.popUse || 0));
    if (popDelta > 0) {
      if (state.popUsed + popDelta > state.popCap) {
        return {
          ok: false,
          reason: `숙소 수용량이 부족합니다! (Lv.${nextLv} 개조에 추가 요원 +${popDelta}명 필요)`,
          popShort: true,
          cost
        };
      }
      if (state.popUsed + popDelta > state.agents) {
        return {
          ok: false,
          reason: `대기 중인 작전 요원이 부족합니다! (Lv.${nextLv} 개조에 추가 요원 +${popDelta}명 필요)`,
          popShort: true,
          cost
        };
      }
      const combatAssigned = (state.jobs && state.jobs.combat) || 0;
      if (state.popUsed + popDelta > combatAssigned) {
        return {
          ok: false,
          reason: '전투요원 배정이 부족합니다! 상단 [인구·연구 (T)] 패널에서 연구/생산 요원을 전투요원으로 전환하세요.',
          popShort: true,
          jobShort: true,
          cost
        };
      }
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

  function applyUpgradeToStruct(st, tx, ty, check, isMounted) {
    const def = DATA.ITEMS[st.id];
    const isTierEvo = isTierEvolutionDef(def);
    const cost = check.cost;
    payCost(cost);

    const prevMax = st.maxHp;
    const prevCap = state.powerCap;

    st.level = check.nextLv;
    if (!st.invested) {
      const base = st.usedVoucher ? {} : (getEffectiveBuildCost(def.id) || {});
      st.invested = {
        wood: base.wood || 0,
        scrap: base.scrap || 0,
        coin: base.coin || 0
      };
      for (let k = 1; k < check.nextLv - 1; k++) {
        const prevUp = getEffectiveUpgradeCost(def, k);
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

    if (ZS.Audio.playUpgrade) ZS.Audio.playUpgrade();
    else ZS.Audio.playBuild();

    const cx = tx + 0.5;
    const cy = ty + 0.5;
    let extraZ = 0;
    if (isMounted) {
      const host = state.structGrid[ty] && state.structGrid[ty][tx];
      extraZ = host && host.id === 'barricade_wall' && (host.level || 2) >= 3 ? 25 : 15;
    }
    const pipCol = isTierEvo ? (def.subType === 'power' ? DATA.PALETTE.power : DATA.PALETTE.levelPip) : st.level >= 3 ? DATA.PALETTE.levelMax : DATA.PALETTE.levelPip;
    const strokeCol = st.level >= 3 ? DATA.PALETTE.levelMaxStroke : DATA.PALETTE.outlineDark;
    G.spawnBurstParticles(cx, cy, 12, pipCol, 12);
    if (!isTierEvo) {
      G.addFloatingText(cx, cy, 28 + extraZ, `Lv.${st.level}`, DATA.PALETTE.levelPip, 14, strokeCol);
    }

    if (def.subType === 'wall' || def.subType === 'gate') {
      G.recomputeFlow(true);
    }

    const dispName = getStructureDisplayName(st);
    if (isTierEvo) {
      let tierSub = `최대 내구도 ${st.maxHp}로 강화되었습니다.`;
      if (def.id === 'barricade_wall' && st.level === 2) {
        tierSub = '상부 거치(Wall-Top Mount)가 해금되었습니다.';
      } else if (def.id === 'barricade_wall' && st.level >= 3) {
        tierSub = '근접 피격 35% 반사 및 상부 거치 유지가 활성화되었습니다.';
      } else if (def.subType === 'power') {
        const pProf = getStructLevelProfile(def, st.level);
        const pStats = getTerrainPowerStats(def.id, pProf, tx, ty);
        tierSub = `주간 +${Math.round(pStats.dayCharge)} · 야간 +${(pStats.nightGen || 0).toFixed(2)}/s · 용량 +${pStats.powerCap}`;
      } else if (def.subType === 'housing') {
        const hProf = getStructLevelProfile(def, st.level);
        tierSub = `요원 수용 +${hProf.popCap}명 · 안락함 +${hProf.cozy}`;
      }
      G.banner(`${dispName}로 업그레이드 완료`, tierSub, 'good');
    } else if (st.level === 3 && DATA.LV3_PERK_LABELS && DATA.LV3_PERK_LABELS[def.id]) {
      G.banner(`[${dispName}] Lv.3 개조 완료`, `특수 효과 개방: ${DATA.LV3_PERK_LABELS[def.id]}`, 'good');
    }

    G.saveGame();
    G.notifyUi();
    return true;
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
    const target = st.mounted || st;
    const res = canUpgradeSpecificStruct(target);
    res.isMounted = !!st.mounted;
    res.target = target;
    return res;
  }

  function canUpgradeWallBase(tx, ty) {
    if (state.phase !== 'day') {
      return { ok: false, reason: '정비 페이즈(낮)에만 성벽을 강화할 수 있습니다.' };
    }
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      return { ok: false, reason: '잘못된 타일입니다.' };
    }
    const st = state.structGrid[ty] && state.structGrid[ty][tx];
    if (!st || st.id !== 'barricade_wall') {
      return { ok: false, reason: '하부 성벽이 없는 타일입니다.', notWall: true };
    }
    const res = canUpgradeSpecificStruct(st);
    res.isMounted = false;
    res.target = st;
    return res;
  }

  function upgradeStructure(tx, ty) {
    const st = state.structGrid[ty] && state.structGrid[ty][tx];
    if (st && !st.mounted && st.id === 'command_hq') {
      return upgradeHq();
    }
    const check = canUpgradeStructure(tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      G.banner('시설 강화 불가', check.reason, 'warn');
      return false;
    }
    return applyUpgradeToStruct(check.target, tx, ty, check, check.isMounted);
  }

  function upgradeWallBase(tx, ty) {
    const check = canUpgradeWallBase(tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      G.banner('성벽 하부 강화 불가', check.reason, 'warn');
      return false;
    }
    return applyUpgradeToStruct(check.target, tx, ty, check, false);
  }

  function placeItem(rawItemId, tx, ty) {
    const itemId = rawItemId === 'shelter_pod' ? 'field_tent' : rawItemId;
    const check = canPlaceItem(itemId, tx, ty);
    if (!check.ok) {
      ZS.Audio.playError();
      G.banner('건설 불가', check.reason, 'warn');
      return false;
    }

    const def = DATA.ITEMS[itemId];
    let usedVoucher = false;
    let spawnLevel = 1;
    if (check.autoUnderlay) {
      if ((state.freeVouchers[itemId] || 0) > 0) {
        state.freeVouchers[itemId] -= 1;
        usedVoucher = true;
      }
      payCost(check.underlayCost);
    } else if (itemId === 'field_tent' && (state.freeVouchers.shelter_pod || 0) > 0) {
      state.freeVouchers.shelter_pod -= 1;
      usedVoucher = true;
      spawnLevel = 3;
    } else if ((state.freeVouchers[itemId] || 0) > 0) {
      state.freeVouchers[itemId] -= 1;
      usedVoucher = true;
    } else {
      payCost(getEffectiveBuildCost(itemId));
    }

    let spawnXp = 0;
    let spawnRank = 0;
    if (usedVoucher && state.divisionRank1Vouchers && (state.divisionRank1Vouchers[itemId] || 0) > 0) {
      state.divisionRank1Vouchers[itemId] -= 1;
      const rank1Info = DATA.VETERANCY_RANKS && DATA.VETERANCY_RANKS[1];
      spawnXp = (rank1Info && rank1Info.minXp) || 12;
      spawnRank = G.computeRankFromXp(spawnXp);
    }

    const spawnProf = def.layer === 'struct' ? getStructLevelProfile(def, spawnLevel) : null;

    if (def.layer === 'floor') {
      state.floorGrid[ty][tx] = itemId;
    } else if (check.autoUnderlay) {
      const existing = state.structGrid[ty][tx];
      const fid = state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
      const profLv2 = getStructLevelProfile(def, 2);
      const wallMaxHp = Math.round(profLv2.baseMaxHp * hpMult);
      const wallBaseCost = getEffectiveBuildCost(itemId);
      const wallLv2Up = getEffectiveUpgradeCost(def, 1) || { wood: 4, scrap: 10, coin: 0 };
      const wallInvested = {
        wood: (usedVoucher ? 0 : (wallBaseCost.wood || 6)) + (wallLv2Up.wood || 0),
        scrap: (usedVoucher ? 0 : (wallBaseCost.scrap || 2)) + (wallLv2Up.scrap || 0),
        coin: wallLv2Up.coin || 0
      };
      existing.buildAnimTimer = 0.24;
      state.structGrid[ty][tx] = {
        uid: G.nextStructUid++,
        id: 'barricade_wall',
        level: 2,
        xp: 0,
        rank: 0,
        kills: 0,
        usedVoucher,
        invested: wallInvested,
        hp: wallMaxHp,
        maxHp: wallMaxHp,
        cooldown: 0,
        aimAngle: 0,
        buildAnimTimer: 0.34,
        upgradeAnimTimer: 0,
        promoAnimTimer: 0,
        fallAnimTimer: 0,
        mounted: existing
      };
      G.banner(
        `[하부 보강] ${getStructureDisplayName(existing)} 하단 헤스코 방벽 구축`,
        '상부 시설의 숙련도와 개조가 유지된 채 성벽 상부 거치로 전환되었습니다.',
        'good'
      );
    } else if (check.mountOnWall) {
      const existing = state.structGrid[ty][tx];
      const fid = state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
      const baseMaxHp = spawnProf ? spawnProf.baseMaxHp : def.maxHp;
      const maxHp = Math.round(baseMaxHp * hpMult);
      const baseCost = usedVoucher ? {} : (getEffectiveBuildCost(itemId) || {});
      existing.mounted = {
        uid: G.nextStructUid++,
        id: itemId,
        level: 1,
        xp: spawnXp,
        rank: spawnRank,
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
    } else {
      const fid = state.floorGrid[ty][tx];
      const fDef = fid ? DATA.ITEMS[fid] : null;
      const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
      const baseMaxHp = spawnProf ? spawnProf.baseMaxHp : def.maxHp;
      const maxHp = Math.round(baseMaxHp * hpMult);
      const baseCost = usedVoucher ? {} : (getEffectiveBuildCost(itemId) || {});
      state.structGrid[ty][tx] = {
        uid: G.nextStructUid++,
        id: itemId,
        level: spawnLevel,
        xp: spawnXp,
        rank: spawnRank,
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
        promoAnimTimer: 0,
        fallAnimTimer: 0
      };
    }

    // Immediate battery cap increase feels nice if building battery/solar/wind on day 1
    const prevCap = state.powerCap;
    recalculateBaseStats();
    const placedPwr = spawnProf ? getTerrainPowerStats(itemId, spawnProf, tx, ty) : { dayCharge: def.dayCharge || 0 };
    const placedDayCharge = placedPwr.dayCharge || 0;
    if (placedDayCharge && state.wave === 1) {
      state.power = Math.min(state.powerCap, state.power + Math.round(placedDayCharge * 0.5));
    } else if (state.powerCap > prevCap && def.id === 'battery_bank') {
      state.power = Math.min(state.powerCap, state.power + 20);
    }

    G.recomputeFlow(true);
    ZS.Audio.playBuild();
    G.spawnBuildDustPuffs(tx + 0.5, ty + 0.5, def.layer === 'floor' ? 6 : 10);
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function moveStructure(fromX, fromY, toX, toY) {
    if (state.phase !== 'day') return false;
    if (fromX === toX && fromY === toY) return false;
    const src = state.structGrid[fromY] && state.structGrid[fromY][fromX];
    if (!src || src.id === 'command_hq') return false;
    if (toX <= 0 || toY <= 0 || toX >= N - 1 || toY >= N - 1) {
      ZS.Audio.playError();
      G.banner('이동 불가', '외곽 진입 구역으로는 시설을 옮길 수 없습니다.', 'warn');
      return false;
    }

    const moving = src.mounted ? src.mounted : src;
    const movingDef = DATA.ITEMS[moving.id];
    const destTerrain = G.getTerrainAt ? G.getTerrainAt(toX, toY) : null;
    if (destTerrain && destTerrain.kind === 'rock') {
      ZS.Audio.playError();
      G.banner('이동 불가', '자연 암석(바위) 지형에는 설치할 수 없습니다.', 'warn');
      return false;
    }
    if (destTerrain && destTerrain.kind === 'ramp' && moving.id !== 'razor_pad') {
      ZS.Audio.playError();
      G.banner('이동 불가', '경사 언덕에는 스파이크 트랩만 설치할 수 있습니다.', 'warn');
      return false;
    }
    const dest = state.structGrid[toY][toX];

    if (dest) {
      if (
        movingDef &&
        movingDef.canMountOnWall &&
        dest.id === 'barricade_wall' &&
        (dest.level || 1) >= 2 &&
        !dest.mounted
      ) {
        if (src.mounted) src.mounted = null;
        else state.structGrid[fromY][fromX] = null;
        moving.buildAnimTimer = 0.34;
        dest.mounted = moving;
      } else {
        ZS.Audio.playError();
        if (dest.id === 'tactical_gate') {
          G.banner('이동 불가', '게이트 위에는 거치할 수 없습니다', 'warn');
        } else if (dest.id === 'barricade_wall' && (dest.level || 1) < 2) {
          G.banner('이동 불가', '먼저 철조망을 Lv.2 헤스코 방벽으로 강화하세요!', 'warn');
        } else if (dest.mounted) {
          G.banner('이동 불가', '이미 상부에 시설이 거치된 성벽입니다.', 'warn');
        }
        return false;
      }
    } else {
      if (src.mounted) src.mounted = null;
      else state.structGrid[fromY][fromX] = null;
      moving.buildAnimTimer = 0.34;
      state.structGrid[toY][toX] = moving;
    }

    recalculateBaseStats();
    G.recomputeFlow(true);
    ZS.Audio.playBuild();
    G.spawnBuildDustPuffs(toX + 0.5, toY + 0.5, 9);
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function removeAt(tx, ty, forceConfirm) {
    if (state.phase !== 'day') return false;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return false;

    const st = state.structGrid[ty][tx];
    if (st) {
      if (st.mounted) {
        const top = st.mounted;
        const topDef = DATA.ITEMS[top.id];
        const rank = top.rank || G.computeRankFromXp(top.xp || 0);
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (!forceConfirm && rank >= 1) {
          const isConfirmedRepeat =
            G.pendingVeteranDemolish &&
            G.pendingVeteranDemolish.tx === tx &&
            G.pendingVeteranDemolish.ty === ty &&
            G.pendingVeteranDemolish.isMounted === true &&
            nowMs - G.pendingVeteranDemolish.atMs < 4000;

          if (!isConfirmedRepeat) {
            G.pendingVeteranDemolish = { tx, ty, isMounted: true, atMs: nowMs };
            const rInfo = G.getVeterancyRankInfo(rank);
            ZS.Audio.playError();
            G.banner(
              `[${rInfo.name}] ${topDef ? topDef.name : top.id} — 계급이 사라집니다`,
              `철거하면 누적 숙련도(${Math.floor(top.xp || 0)} XP)와 계급 배지가 영구 소멸합니다. 4초 내 한 번 더 클릭하면 상부 시설만 철거됩니다.`,
              'warn'
            );
            return false;
          }
        }

        G.pendingVeteranDemolish = null;
        const refundTotal = getCumulativeRefundCost(top, topDef);
        st.mounted = null;
        G.spawnStructureDebris(tx + 0.5, ty + 0.5, top.id, 9, top.level || 1);
        if (rank >= 1) {
          G.spawnBadgeShatterVfx(tx + 0.5, ty + 0.5, rank);
        }
        refundCost(refundTotal, tx, ty);
        recalculateBaseStats();
        state.power = Math.min(state.power, Math.max(state.powerCap, state.power));
        G.recomputeFlow(true);
        ZS.Audio.playRemove();
        G.saveGame();
        G.notifyUi();
        return true;
      }

      if (st.id === 'command_hq') {
        ZS.Audio.playError();
        G.banner('철거 불가', '지휘 본부는 철거할 수 없습니다!', 'warn');
        return false;
      }
      const def = DATA.ITEMS[st.id];
      const rank = st.rank || G.computeRankFromXp(st.xp || 0);
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Veteran/Ace Rank 1+ daytime demolish confirmation guard (art spec §4)
      if (!forceConfirm && rank >= 1) {
        const isConfirmedRepeat =
          G.pendingVeteranDemolish &&
          G.pendingVeteranDemolish.tx === tx &&
          G.pendingVeteranDemolish.ty === ty &&
          !G.pendingVeteranDemolish.isMounted &&
          nowMs - G.pendingVeteranDemolish.atMs < 4000;

        if (!isConfirmedRepeat) {
          G.pendingVeteranDemolish = { tx, ty, isMounted: false, atMs: nowMs };
          const rInfo = G.getVeterancyRankInfo(rank);
          ZS.Audio.playError();
          G.banner(
            `[${rInfo.name}] ${def ? def.name : st.id} — 계급이 사라집니다`,
            `철거하면 누적 숙련도(${Math.floor(st.xp || 0)} XP)와 계급 배지가 영구 소멸합니다. 4초 내 한 번 더 클릭하면 철거됩니다.`,
            'warn'
          );
          return false;
        }
      }

      G.pendingVeteranDemolish = null;
      const refundTotal = getCumulativeRefundCost(st, def);
      state.structGrid[ty][tx] = null;
      G.spawnStructureDebris(tx + 0.5, ty + 0.5, st.id, 9, st.level || 1);
      if (rank >= 1) {
        G.spawnBadgeShatterVfx(tx + 0.5, ty + 0.5, rank);
      }
      refundCost(refundTotal, tx, ty);
      recalculateBaseStats();
      state.power = Math.min(state.power, Math.max(state.powerCap, state.power));
      G.recomputeFlow(true);
      ZS.Audio.playRemove();
      G.saveGame();
      G.notifyUi();
      return true;
    }

    const fid = state.floorGrid[ty][tx];
    if (fid) {
      const fDef = DATA.ITEMS[fid];
      state.floorGrid[ty][tx] = null;
      refundCost(fDef && fDef.cost, tx, ty);
      recalculateBaseStats();
      ZS.Audio.playRemove();
      G.saveGame();
      G.notifyUi();
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
      G.addFloatingText(
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

  function getStructureRepairWeights(node) {
    if (!node) return { woodRatio: 0.5, scrapRatio: 0.5 };
    if (node.id === 'command_hq') {
      return (state.hqLevel || 1) >= 2
        ? { woodRatio: 0.15, scrapRatio: 0.85 }
        : { woodRatio: 0.50, scrapRatio: 0.50 };
    }
    const def = DATA.ITEMS[node.id];
    const lv = node.level || 1;
    const isMetalPrimary =
      lv >= 2 ||
      (def && (def.subType === 'turret' || def.subType === 'power' || def.id === 'vending_machine' || def.id === 'arcade_neon'));
    if (!isMetalPrimary) {
      return { woodRatio: 0.75, scrapRatio: 0.25 };
    }
    return lv >= 3
      ? { woodRatio: 0.10, scrapRatio: 0.90 }
      : { woodRatio: 0.15, scrapRatio: 0.85 };
  }

  function getRepairAllInfo() {
    let missingTotal = 0;
    let woodWeight = 0;
    let scrapWeight = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const st = state.structGrid[y][x];
        if (st && st.hp < st.maxHp) {
          const miss = st.maxHp - st.hp;
          const w = getStructureRepairWeights(st);
          missingTotal += miss;
          woodWeight += miss * w.woodRatio;
          scrapWeight += miss * w.scrapRatio;
        }
        if (st && st.mounted && st.mounted.hp < st.mounted.maxHp) {
          const miss = st.mounted.maxHp - st.mounted.hp;
          const w = getStructureRepairWeights(st.mounted);
          missingTotal += miss;
          woodWeight += miss * w.woodRatio;
          scrapWeight += miss * w.scrapRatio;
        }
      }
    }
    if (missingTotal <= 0) return { needed: false, woodCost: 0, scrapCost: 0 };
    let woodCost = Math.round(woodWeight / 26);
    let scrapCost = Math.round(scrapWeight / 20);
    if (woodCost === 0 && scrapCost === 0) {
      if (scrapWeight >= woodWeight) scrapCost = 1;
      else woodCost = 1;
    }
    return {
      needed: true,
      woodCost,
      scrapCost
    };
  }

  function repairAllStructures() {
    if (state.phase !== 'day') return false;
    const info = getRepairAllInfo();
    if (!info.needed) return false;
    if (state.wood < info.woodCost || state.scrap < info.scrapCost) {
      ZS.Audio.playError();
      const parts = [];
      if (info.woodCost > 0) parts.push(`목재 ${info.woodCost}`);
      if (info.scrapCost > 0) parts.push(`고철 ${info.scrapCost}`);
      G.banner('수리 자재 부족', `전체 수리에 ${parts.join(', ')}이 필요합니다.`, 'warn');
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
        if (st && st.mounted && st.mounted.hp < st.mounted.maxHp) {
          st.mounted.hp = st.mounted.maxHp;
        }
      }
    }
    ZS.Audio.playBuild();
    G.banner('기지 전체 정비 완료', '모든 방벽과 방어 시설의 내구도가 100% 복구되었습니다.', 'good');
    G.saveGame();
    G.notifyUi();
    return true;
  }

  // ================= TRADER CONVOY SYSTEM =================
  function getEffectiveTraderOfferCost(offer) {
    if (!offer || !offer.coinCost) return 0;
    const disc = Math.max(0, Math.min(0.24, state.b1TraderDisc || 0));
    return Math.max(1, Math.round(offer.coinCost * (1 - disc)));
  }

  function getEffectiveTraderRefreshCost() {
    const baseCost = state.traderRefreshCost || 15;
    const disc = Math.max(0, Math.min(0.24, state.b1TraderDisc || 0));
    return Math.max(1, Math.round(baseCost * (1 - disc)));
  }

  function refreshTraderOffers(paid) {
    if (paid) {
      if (state.phase !== 'day') {
        ZS.Audio.playError();
        return false;
      }
      const baseCurCost = state.traderRefreshCost || 15;
      const curCost = getEffectiveTraderRefreshCost();
      if (state.coin < curCost) {
        ZS.Audio.playError();
        G.banner('코인 부족', `보급 목록 갱신에 ${curCost} 코인이 필요합니다.`, 'warn');
        return false;
      }
      state.coin -= curCost;
      state.traderRefreshCount = (state.traderRefreshCount || 0) + 1;
      state.traderRefreshCost = baseCurCost + 10 + (state.traderRefreshCount - 1) * 5;
      ZS.Audio.playTrade();
    }

    // Always include Wood, Scrap, Power Cell & Research Disk + 2 shuffled specialty deals (6 cards)
    const pool = DATA.TRADER_POOL.slice();
    const fixedIds = ['wood_pack', 'scrap_pack', 'power_cell', 'research_disk'];
    const fixed = [];
    const specialty = [];
    for (let i = 0; i < pool.length; i++) {
      if (fixedIds.indexOf(pool[i].id) !== -1) fixed.push(pool[i]);
      else specialty.push(pool[i]);
    }
    const rest = specialty.sort(() => Math.random() - 0.5).slice(0, Math.max(0, 6 - fixed.length));
    state.traderOffers = fixed.concat(rest).map((o) => ({
      ...o,
      sold: false
    }));

    if (paid) G.saveGame();
    G.notifyUi();
    return true;
  }

  function exchangeResource(routeId, mult) {
    if (state.phase !== 'day') {
      ZS.Audio.playError();
      return false;
    }
    const routes = DATA.TRADER_EXCHANGE_ROUTES || [];
    let route = null;
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].id === routeId) {
        route = routes[i];
        break;
      }
    }
    const count = Math.floor(Number(mult));
    if (!route || !Number.isFinite(count) || count <= 0) {
      ZS.Audio.playError();
      return false;
    }
    const totalCost = route.cost * count;
    const totalGive = route.give * count;
    const RES_NAMES = { wood: '목재', scrap: '고철', coin: '코인' };
    if ((state[route.from] || 0) < totalCost) {
      ZS.Audio.playError();
      G.banner('환전 자재 부족', `${route.label} ×${count} 환전에 ${RES_NAMES[route.from] || route.from} ${totalCost}이 필요합니다.`, 'warn');
      return false;
    }
    state[route.from] -= totalCost;
    state[route.to] = (state[route.to] || 0) + totalGive;
    ZS.Audio.playTrade();
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function findNightConsumable(consumableId) {
    const list = DATA.TRADER_NIGHT_CONSUMABLES || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === consumableId) return list[i];
    }
    return null;
  }

  function getNightConsumableCost(consumableId, waveNum) {
    const item = findNightConsumable(consumableId);
    if (!item) return null;
    const w = Math.max(1, waveNum || state.wave || 1);
    return {
      scrap: item.baseScrap + w * item.scrapPerWave,
      coin: item.baseCoin + w * item.coinPerWave
    };
  }

  function buyNightConsumable(consumableId) {
    if (state.phase !== 'day') {
      ZS.Audio.playError();
      return false;
    }
    const item = findNightConsumable(consumableId);
    if (!item) return false;
    if (!state.nightConsumables) {
      state.nightConsumables = { overpressureAmmo: false, reactiveArmor: false };
    }
    if (state.nightConsumables[item.stateKey]) {
      ZS.Audio.playError();
      return false;
    }
    const cost = getNightConsumableCost(consumableId, state.wave);
    if (!cost || state.scrap < cost.scrap || state.coin < cost.coin) {
      ZS.Audio.playError();
      G.banner('보급 자재 부족', `[${item.name}] 구매에 고철 ${cost ? cost.scrap : 0} · 코인 ${cost ? cost.coin : 0}이 필요합니다.`, 'warn');
      return false;
    }
    state.scrap -= cost.scrap;
    state.coin -= cost.coin;
    state.nightConsumables[item.stateKey] = true;
    if (G.invalidateStatsCache) G.invalidateStatsCache();
    ZS.Audio.playTrade();
    G.banner(`[야간 작전 보급] ${item.name} 장착`, '다음 1회 야간 웨이브 동안 기지 전역에 효과가 적용됩니다.', 'good');
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function buyTraderOffer(index) {
    if (state.phase !== 'day') {
      ZS.Audio.playError();
      return false;
    }
    const offer = state.traderOffers[index];
    if (!offer || offer.sold) return false;
    const effCost = getEffectiveTraderOfferCost(offer);
    if (state.coin < effCost) {
      ZS.Audio.playError();
      return false;
    }

    if (offer.type === 'agent') {
      if (state.agents >= state.popCap) {
        ZS.Audio.playError();
        G.banner('숙소 수용량 부족!', '먼저 [전력·숙소] 탭에서 막사나 컨테이너 숙소를 건설해 빈자리를 확보하세요.', 'warn');
        return false;
      }
      state.coin -= effCost;
      if (G.grantAgents) G.grantAgents(offer.amount);
      else state.agents += offer.amount;
      offer.sold = true;
      ZS.Audio.playTrade();
      G.banner('베테랑 요원 합류!', `작전 요원이 기지에 배치되었습니다. (현재 요원 ${state.agents}/${state.popCap})`, 'good');
      G.saveGame();
      G.notifyUi();
      return true;
    }

    state.coin -= effCost;
    if (offer.type === 'resource') {
      if (offer.give.wood) state.wood += offer.give.wood;
      if (offer.give.scrap) state.scrap += offer.give.scrap;
    } else if (offer.type === 'power_boost') {
      state.power = Math.min(Math.round(state.powerCap * 1.35), state.power + offer.amount);
      if (G.invalidateStatsCache) G.invalidateStatsCache();
    } else if (offer.type === 'rp') {
      const rpAmt = offer.amount || 5;
      state.rp = (state.rp || 0) + rpAmt;
      G.banner('전술 연구 데이터 확보!', `연구포인트 +${rpAmt} RP 획득 (보유 ${state.rp} RP)`, 'good');
    } else if (offer.type === 'free_item') {
      const vKey = offer.voucherKey || (offer.id === 'crate_pod' ? 'shelter_pod' : offer.itemId);
      state.freeVouchers[vKey] = (state.freeVouchers[vKey] || 0) + 1;
    }

    offer.sold = true;
    ZS.Audio.playTrade();
    G.saveGame();
    G.notifyUi();
    return true;
  }

  Object.assign(G, {
    getTechLevel,
    getTechCost,
    canResearchTech,
    researchTech,
    getItemRequiredTech,
    getUpgradeRequiredTech,
    getTierMap,
    isTierEvolutionDef,
    getStructMaxTier,
    isUpgradeableDef,
    getUpgradeCost,
    getEffectiveHqUpgradeCost,
    getEffectiveBuildCost,
    getEffectiveUpgradeCost,
    getStructureDisplayName,
    getStructLevelProfile,
    getTerrainPowerStats,
    recalculateBaseStats,
    getPlacementCozyPreview,
    computeStructureEffectiveStatsUncached,
    getStructureEffectiveStats,
    canAffordCost,
    payCost,
    canUpgradeHq,
    upgradeHq,
    canPlaceItem,
    getCumulativeRefundCost,
    canUpgradeSpecificStruct,
    applyUpgradeToStruct,
    canUpgradeStructure,
    canUpgradeWallBase,
    upgradeStructure,
    upgradeWallBase,
    placeItem,
    moveStructure,
    removeAt,
    refundCost,
    getRepairAllInfo,
    repairAllStructures,
    getEffectiveTraderOfferCost,
    getEffectiveTraderRefreshCost,
    refreshTraderOffers,
    exchangeResource,
    getNightConsumableCost,
    buyNightConsumable,
    buyTraderOffer
  });
})();
