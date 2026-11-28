window.ZS = window.ZS || {};

(function () {
  const uiState = {
    activeCategory: 'defense',
    activeB1Category: 'b1_ops',
    mode: 'inspect', // 'inspect' | 'build' | 'move' | 'remove' | 'b1_dig' | 'b1_door' | 'b1_zone' | 'b1_unzone'
    selectedItemId: null,
    selectedB1ToolId: null,
    selectedB1Role: null,
    hoverTile: null,
    inspectedTile: null,
    movingSource: null,
    activeSkill: null, // null | 'airstrike'
    b1DragStart: null,
    b1DragCurrent: null,
    hoverB1DoorEdge: null,
    b1BuildRot: 0,
    dockCollapsed: false,
    hudResCompact: true,
    reconOpen: false,
    mainMenuOpen: true,
    menuOptionsOpen: false,
    divisionModalOpen: false,
    selectedDivisionId: 'mobile_corps',
    lastPhase: null,
    pointerClient: { x: 0, y: 0, inside: false }
  };

  let bannerTimer = null;
  let invasionAlertTimer = null;
  let lastCozyPulseSeq = 0;
  let lastWaveNumStr = '';
  let lastPhaseIconKey = '';
  let lastPowerIconKey = '';
  let lastCozySig = '';
  let lastReconSig = '';
  let lastDivBadgeSig = '';

  const U = (ZS._UI = {
    uiState
  });

  function ozIcon(name, size, cls, inlineStyle) {
    const sz = size || 16;
    const clsAttr = cls ? `oz-icon ${cls}` : 'oz-icon';
    const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : '';
    return `<svg class="${clsAttr}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"${styleAttr}><use href="#oz-${name}"></use></svg>`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInlineCostHtml(cost, iconSize) {
    const c = cost || {};
    const sz = iconSize || 14;
    const parts = [];
    if (c.wood) parts.push(`<span class="inline-icon-text">${ozIcon('res-wood', sz, 'icon-wood')}${c.wood}</span>`);
    if (c.scrap) parts.push(`<span class="inline-icon-text">${ozIcon('res-scrap', sz, 'icon-scrap')}${c.scrap}</span>`);
    if (c.coin) parts.push(`<span class="inline-icon-text">${ozIcon('res-coin', sz, 'icon-coin')}${c.coin}</span>`);
    return parts.join(' ');
  }

  function formatPowerSubText(st) {
    if (st.isNight && st.blackoutActive && (st.nightGen || 0) > 0) {
      const target = Math.min(Math.round(st.powerCap || 12), 12);
      return `블랙아웃 · 풍력 복구 중 (${Math.floor(st.power)}/${target})`;
    }
    if (st.isNight && st.blackoutActive) {
      return '배터리 방전 (자동포탑 정지)';
    }
    return `낮 +${Math.round(st.dayCharge || 0)} · 밤 +${(st.nightGen || 0).toFixed(1)}/s · 대기 -${(st.nightIdleDrain || 0).toFixed(1)}/s`;
  }

  function syncNightPhaseAndPowerHud(st) {
    const P = ZS.DATA.PALETTE;
    const isNightBlackout = !!(st.isNight && st.blackoutActive);
    if (st.phase === 'night') {
      const nextPhaseKey = isNightBlackout ? 'night-off' : 'night-on';
      const phaseIconEl = document.getElementById('hud-phase-icon');
      if (phaseIconEl && lastPhaseIconKey !== nextPhaseKey) {
        lastPhaseIconKey = nextPhaseKey;
        phaseIconEl.className = isNightBlackout ? 'icon-slot icon-danger' : 'icon-slot phase-night-icon';
        phaseIconEl.innerHTML = ozIcon(isNightBlackout ? 'state-power-off' : 'phase-night', 26);
      }
      const phaseTextEl = document.getElementById('hud-phase-text');
      if (phaseTextEl) {
        const nextTxt = isNightBlackout ? '블랙아웃!' : '야간 방어';
        const nextCls = isNightBlackout ? 'wave-sub phase-alert' : 'wave-sub phase-night';
        if (phaseTextEl.textContent !== nextTxt) phaseTextEl.textContent = nextTxt;
        if (phaseTextEl.className !== nextCls) phaseTextEl.className = nextCls;
      }
    }

    const pwrVal = Math.round(st.power);
    document.getElementById('res-power').textContent = isNightBlackout ? '정전' : `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    const pwrBar = document.getElementById('res-power-bar');
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background =
      pwrPct > 35
        ? 'linear-gradient(180deg, #8FF6FF 0%, #5EF2FF 50%, #24B9CB 100%)'
        : pwrPct > 5
        ? P.healthMid
        : P.danger;

    const nextPwrKey = isNightBlackout ? 'pwr-off' : 'pwr-on';
    const pwrIconEl = document.getElementById('res-power-icon');
    if (pwrIconEl && lastPowerIconKey !== nextPwrKey) {
      lastPowerIconKey = nextPwrKey;
      pwrIconEl.className = isNightBlackout ? 'res-icon icon-danger' : 'res-icon icon-power';
      pwrIconEl.innerHTML = ozIcon(isNightBlackout ? 'state-power-off' : 'res-power', 15);
    }

    document.querySelector('.power-pill').classList.toggle('blackout', isNightBlackout);
    const subEl = document.getElementById('res-power-sub');
    if (subEl) subEl.textContent = '';
  }

  function syncDivisionBadge(st) {
    const badgeEl = document.getElementById('hud-division-badge');
    if (!badgeEl) return;
    const divId = (st && st.divisionId) || 'mobile_corps';
    const def = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef(divId) : (ZS.DATA.DIVISIONS && ZS.DATA.DIVISIONS[divId]);
    if (!def) return;

    const isNight = !!(st && st.isNight);
    const blackout = !!(st && st.blackoutActive);
    const arcActive = ZS.Game.isArcOverdriveActive ? ZS.Game.isArcOverdriveActive() : false;
    const meta = ZS.Game.getCommanderMeta ? ZS.Game.getCommanderMeta() : null;
    const rec = meta && meta.divisions ? meta.divisions[divId] : null;
    const bestWave = rec ? (rec.bestWave || 0) : 0;
    const cleared = !!(rec && rec.cleared);
    const pwrPct = st && st.powerCap > 0 ? Math.round((st.power / st.powerCap) * 100) : 0;

    const sig = `${divId}|${isNight ? 1 : 0}|${blackout ? 1 : 0}|${arcActive ? 1 : 0}|${bestWave}|${cleared ? 1 : 0}|${pwrPct}`;
    if (sig === lastDivBadgeSig) return;
    lastDivBadgeSig = sig;

    let dotCls = 'on';
    let badgeVariantCls = 'div-mobile';
    if (divId === 'iron_engineers') {
      badgeVariantCls = 'div-iron';
      dotCls = 'on-heal';
    } else if (divId === 'nightwatch') {
      badgeVariantCls = 'div-nightwatch';
      dotCls = isNight && blackout ? 'on-heal' : 'on';
    } else if (divId === 'arc_tech') {
      badgeVariantCls = 'div-arc';
      dotCls = arcActive ? 'arc-on' : 'off';
    }

    badgeEl.className = `hud-division-badge ${badgeVariantCls}`;
    const iconEl = document.getElementById('hud-div-icon');
    const nameEl = document.getElementById('hud-div-name');
    const statusEl = document.getElementById('hud-div-status');
    if (iconEl) iconEl.innerHTML = ozIcon(def.iconId || 'div-mobile', 15);
    if (nameEl) nameEl.textContent = def.name || divId;
    if (statusEl) {
      statusEl.className = `div-status-dot ${dotCls}`;
      statusEl.textContent = '';
    }

    const prosList = Array.isArray(def.pros) ? def.pros : [];
    const consList = Array.isArray(def.cons) ? def.cons : [];
    badgeEl.removeAttribute('title');

    const tipEl = document.getElementById('hud-division-tooltip');
    if (tipEl) {
      const bestLabel = bestWave > 0 ? `BEST W${String(bestWave).padStart(2, '0')}` : '첫 출격';
      const clearPill = cleared ? `<span class="div-pill meta-clear">${ozIcon('state-rank', 12)}<span>CLEAR</span></span>` : '';
      const prosHtml = prosList
        .map((p) => `<div class="div-pop-item pro"><span>+</span><span>${escapeHtml(p)}</span></div>`)
        .join('');
      const consHtml = consList
        .map((c) => `<div class="div-pop-item ${def.hasPenalty === false ? 'neutral' : 'con'}"><span>${def.hasPenalty === false ? '·' : '-'}</span><span>${escapeHtml(c)}</span></div>`)
        .join('');
      tipEl.innerHTML = `
        <div class="div-pop-head">
          <span class="div-pop-title">${ozIcon(def.iconId || 'div-mobile', 16)}<span>${escapeHtml(def.name)}</span></span>
          <span style="display:inline-flex;align-items:center;gap:4px;">
            <span class="div-pill meta-best">${escapeHtml(bestLabel)}</span>
            ${clearPill}
          </span>
        </div>
        <div class="div-pop-sub">${escapeHtml(def.subtitle || '')}</div>
        <div class="div-pop-list">
          ${prosHtml}
          ${consHtml}
        </div>
      `;
    }
  }

  function setOzTitle(el, val) {
    if (!el) return;
    if (el.hasAttribute('title')) el.removeAttribute('title');
    if (el.dataset) el.dataset.ozTitle = val || '';
  }

  function syncWindLayerButton(st) {
    const btn = document.getElementById('btn-toggle-wind-layer');
    if (!btn || !st) return;
    const isUg = st.activeLayer === 'underground';
    const on = !isUg && !!st.showWindOverlay;
    btn.disabled = isUg;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    setOzTitle(
      btn,
      isUg
        ? '지상 레이어에서만 강풍 오버레이를 사용할 수 있습니다.'
        : '강풍 지대(주변 +40% / 중심 +70%) 오버레이 레이어 표시/숨기기 (단축키 V)'
    );
  }

  function syncUndergroundToggleButton(st) {
    const btn = document.getElementById('btn-toggle-underground');
    if (!btn || !st) return;
    const unlocked = (st.hqLevel || 1) >= 2 && !!st.undergroundUnlocked;
    const isDay = st.phase === 'day';
    const isUg = st.activeLayer === 'underground';
    btn.disabled = !unlocked || !isDay;
    btn.classList.toggle('b1-locked-unlock', !unlocked);
    btn.classList.toggle('active', isUg);
    btn.setAttribute('aria-pressed', isUg ? 'true' : 'false');
    btn.setAttribute('aria-label', isUg ? '지상 본부 복귀 [B]' : '지하 B1 쉘터 전환 [B]');

    const lv2Wave = ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(2) : 10;
    setOzTitle(
      btn,
      !unlocked
        ? (st.wave || 1) >= lv2Wave
          ? '지하 쉘터 B1: 먼저 중앙 지휘 본부를 Lv.2로 증축하세요!'
          : `지하 쉘터 B1: WAVE ${lv2Wave} 도달 후 지휘 본부 Lv.2 증축 시 개방`
        : !isDay
        ? '야간 방어 중에는 지하로 이동할 수 없습니다 (주간 전용)'
        : isUg
        ? '지상 본부 레이어로 복귀 (단축키 B)'
        : `지하 B1 쉘터로 이동 (보유 ${Math.floor(st.digAp || 0)}/${st.digApCap || 24} AP · 단축키 B)`
    );
  }

  function getDailyResourceDeltaPreview(st) {
    if (!st) return { wood: 0, scrap: 0, coin: 0, rp: 0 };
    const wave = Math.max(1, st.wave || 1);
    const jobs = st.jobs || { combat: st.popUsed || 0, research: 0, prod: 0 };
    const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(st.hqLevel) : { baseRpPerScientist: 0.8 };
    const prodRates = (ZS.DATA && ZS.DATA.PROD_RATES) || { woodPerWorker: 2.0, scrapPerWorker: 1.5 };
    const prodCount = jobs.prod || 0;
    const starveMult = st.starving ? (1 - ((ZS.DATA.SUPPLY_RULES && ZS.DATA.SUPPLY_RULES.starveOutputPenalty) || 0.35)) : 1.0;
    const prodWood = (prodCount * prodRates.woodPerWorker + (st.b1SupplyWood || 0) + (st.b1SupplyProdWood || 0)) * starveMult;
    const prodScrap = (prodCount * prodRates.scrapPerWorker + (st.b1SupplyScrap || 0) + (st.b1SupplyProdScrap || 0)) * starveMult;
    const supplyCoin = Math.round(st.b1SupplyCoin || 0);
    const wood = +(26 + wave * 9 + prodWood).toFixed(1);
    const scrap = +(16 + wave * 5 + prodScrap).toFixed(1);
    const baseCoin = 16 + wave * 4;
    const coinBonus = st.cozyTier ? (st.cozyTier.coinBonus || 0) : 0;
    const coin = baseCoin + Math.round(baseCoin * coinBonus) + supplyCoin;
    const rawRp = (jobs.research || 0) * (hqInfo.baseRpPerScientist || 0.8) + (st.b1LabFlatRp || 0) + (st.b1LabFlatPerWaveRp || 0);
    const drill2 = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_2') : 0;
    const rpMult = 1 + (st.b1LabMult || 0) + (drill2 > 0 ? 0.15 : 0);
    const rp = +(rawRp * rpMult * starveMult).toFixed(1);
    return { wood, scrap, coin, rp };
  }

  function syncSupplyPillHud(st) {
    if (!st) return;
    const foodVal = Math.floor(st.food || 0);
    const ammoVal = Math.floor(st.ammo || 0);
    const rocketVal = Math.floor(st.rocket || 0);
    const foodEl = document.getElementById('res-food');
    const ammoEl = document.getElementById('res-ammo');
    const rocketEl = document.getElementById('res-rocket');
    if (foodEl) foodEl.textContent = foodVal;
    if (ammoEl) ammoEl.textContent = ammoVal;
    if (rocketEl) rocketEl.textContent = rocketVal;

    const agents = Math.max(0, st.agents || 0);
    const foodChip = document.getElementById('sup-chip-food');
    const ammoChip = document.getElementById('sup-chip-ammo');
    const rocketChip = document.getElementById('sup-chip-rocket');
    const supplyPill = document.getElementById('supply-pill');

    if (foodChip) {
      const critFood = !!st.starving || foodVal < agents;
      const lowFood = !critFood && foodVal < agents * 2;
      foodChip.classList.toggle('is-critical', critFood);
      foodChip.classList.toggle('is-low', lowFood);
    }
    if (ammoChip) {
      const critAmmo = (st.ammo || 0) < 1;
      const lowAmmo = !critAmmo && (st.ammo || 0) < 30;
      ammoChip.classList.toggle('is-critical', critAmmo);
      ammoChip.classList.toggle('is-low', lowAmmo);
    }
    if (rocketChip) {
      const rocketActive = (st.hqLevel || 1) >= 3 || (st.rocketCap || 40) > 40;
      const critRocket = rocketActive && (st.rocket || 0) < 1;
      const lowRocket = rocketActive && !critRocket && (st.rocket || 0) < 10;
      rocketChip.classList.toggle('is-critical', critRocket);
      rocketChip.classList.toggle('is-low', lowRocket);
    }
    if (supplyPill) {
      supplyPill.classList.toggle('is-starving', !!st.starving);
    }
  }

  function formatDeltaVal(v) {
    const n = +Number(v || 0).toFixed(1);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function updateDailyResourceDeltas(st) {
    const d = getDailyResourceDeltaPreview(st);
    const items = [
      ['res-wood-delta', d.wood],
      ['res-scrap-delta', d.scrap],
      ['res-coin-delta', d.coin],
      ['res-rp-delta', d.rp]
    ];
    items.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const txt = formatDeltaVal(val);
      el.textContent = `+${txt}`;
      el.classList.toggle('is-zero', val <= 0);
      setOzTitle(el, `웨이브 ${st.wave || 1} 완료 시 예상 획득량 (+${txt})`);
    });
  }

  function formatReconPatternTitle(intel) {
    if (!intel) return '침공 경보';
    const SIDE_NAMES = ['북동', '남동', '남서', '북서'];
    const kinds = intel.sideKinds || ['none', 'none', 'none', 'none'];
    const mainSides = [];
    const subSides = [];
    for (let sd = 0; sd < 4; sd++) {
      if (kinds[sd] === 'main' || kinds[sd] === 'boss') mainSides.push(SIDE_NAMES[sd]);
      else if (kinds[sd] === 'sub') subSides.push(SIDE_NAMES[sd]);
    }
    if (intel.pattern === 'single') return `${mainSides[0] || '북동'} 정면 침공`;
    if (intel.pattern === 'flank') return `${mainSides[0] || ''}·${subSides[0] || ''} 측면`;
    if (intel.pattern === 'dual') return `${mainSides.join('·')} 협공`;
    return '전방위 포위';
  }

  function showInvasionAlert(intel, isBossWave) {
    if (uiState.mainMenuOpen || !intel) return;
    const el = document.getElementById('invasion-alert');
    const iconEl = document.getElementById('invasion-alert-icon');
    const titleEl = document.getElementById('invasion-alert-title');
    const subEl = document.getElementById('invasion-alert-sub');
    if (!el || !titleEl || !subEl) return;

    const waveBadge = String(intel.wave || 1).padStart(2, '0');
    const patTitle = formatReconPatternTitle(intel);
    if (iconEl) {
      iconEl.innerHTML = ozIcon(isBossWave ? 'en-boss' : 'state-alert', 22, isBossWave ? 'icon-boss' : 'icon-danger');
    }
    titleEl.textContent = `WAVE ${waveBadge} · ${patTitle}`;
    subEl.textContent = isBossWave
      ? `알파 변이체 포함 ${intel.totalCount || 0}기 침공 개시`
      : `적 감염체 ${intel.totalCount || 0}기 방어선 접근 중`;

    el.classList.toggle('boss', !!isBossWave);
    el.classList.remove('hidden', 'converging');
    if (el.offsetWidth !== undefined) {
      // Trigger CSS animation restart cleanly
    }
    el.classList.add('converging');

    if (invasionAlertTimer) clearTimeout(invasionAlertTimer);
    invasionAlertTimer = setTimeout(() => {
      el.classList.remove('converging');
      el.classList.add('hidden');
    }, 2550);
  }

  function updateHud() {
    const st = ZS.Game.state;
    syncDivisionBadge(st);
    syncWindLayerButton(st);
    syncUndergroundToggleButton(st);
    const P = ZS.DATA.PALETTE;
    const hq = st.structGrid[ZS.DATA.HQ_POS.y] && st.structGrid[ZS.DATA.HQ_POS.y][ZS.DATA.HQ_POS.x];
    const phaseIconEl = document.getElementById('hud-phase-icon');
    const phaseTextEl = document.getElementById('hud-phase-text');

    const waveStr = String(st.wave).padStart(2, '0');
    if (waveStr !== lastWaveNumStr) {
      lastWaveNumStr = waveStr;
      document.getElementById('hud-wave-num').innerHTML = `WAVE <span class="wave-title-num">${waveStr}</span>`;
    }

    if (st.phase === 'day') {
      if (lastPhaseIconKey !== 'day') {
        lastPhaseIconKey = 'day';
        phaseIconEl.className = 'icon-slot icon-coin';
        phaseIconEl.innerHTML = ozIcon('phase-day', 26);
      }
      if (phaseTextEl) {
        phaseTextEl.textContent = '주간 정비';
        phaseTextEl.className = 'wave-sub phase-day';
      }
    } else if (st.phase === 'night') {
      syncNightPhaseAndPowerHud(st);
    } else {
      if (lastPhaseIconKey !== 'gameover') {
        lastPhaseIconKey = 'gameover';
        phaseIconEl.className = 'icon-slot icon-danger';
        phaseIconEl.innerHTML = ozIcon('state-alert', 26);
      }
      if (phaseTextEl) {
        phaseTextEl.textContent = '작전 실패';
        phaseTextEl.className = 'wave-sub phase-alert';
      }
    }

    const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
    const hqTitleEl = document.getElementById('hud-hq-title');
    if (hqTitleEl) {
      hqTitleEl.innerHTML = `${ozIcon('hud-hq', 14)}<span>본부 Lv.${st.hqLevel}</span>`;
    }
    const hqHp = hq ? Math.ceil(hq.hp) : 0;
    const hqMax = hq ? hq.maxHp : hqInfo.maxHp;
    document.getElementById('hud-hq-hp').textContent = `${hqHp} / ${hqMax}`;
    document.getElementById('hud-hq-bar').style.width = `${Math.max(0, (hqHp / hqMax) * 100)}%`;

    document.getElementById('res-wood').textContent = Math.floor(st.wood);
    document.getElementById('res-scrap').textContent = Math.floor(st.scrap);
    document.getElementById('res-coin').textContent = Math.floor(st.coin);
    updateDailyResourceDeltas(st);
    syncSupplyPillHud(st);

    if (st.phase !== 'night') {
      syncNightPhaseAndPowerHud(st);
    }

    // Population (3-job) & Research Points (RP) display
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const assignedCount = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    const unassignedCount = Math.max(0, (st.agents || 0) - assignedCount);
    const popEl = document.getElementById('res-pop');
    if (popEl) {
      popEl.textContent = `${st.agents}/${st.popCap}`;
    }
    const popPillEl = document.getElementById('pop-pill');
    if (popPillEl) {
      setOzTitle(popPillEl, `작전 요원 ${st.agents}/${st.popCap}명 (미배정 ${unassignedCount}명)`);
    }
    const unassignedChipEl = document.getElementById('hud-unassigned-chip');
    if (unassignedChipEl) {
      unassignedChipEl.textContent = `+${unassignedCount}`;
      unassignedChipEl.classList.toggle('hidden', unassignedCount <= 0);
    }
    const rpEl = document.getElementById('res-rp');
    if (rpEl) {
      rpEl.textContent = `${Math.floor(st.rp || 0)} RP`;
    }
    const rpPillEl = document.getElementById('rp-pill');
    if (rpPillEl) {
      setOzTitle(rpPillEl, '연구포인트(RP)');
    }

    // Cozy Morale Lv.1~8 display, 8-segment bar, heart stroke scaling & table tooltip (dirty-memoized)
    const tier = st.cozyTier;
    const tiers = ZS.DATA.COZY_TIERS || [];
    document.getElementById('res-cozy').textContent = `Lv.${tier.level}`;

    const cozyPillEl = document.getElementById('cozy-pill');
    if (cozyPillEl) {
      cozyPillEl.classList.toggle('is-starving', !!st.starving);
    }
    if (cozyPillEl && st.cozyPulseSeq && st.cozyPulseSeq !== lastCozyPulseSeq) {
      lastCozyPulseSeq = st.cozyPulseSeq;
      cozyPillEl.classList.remove('tier-up-pulse');
      if (cozyPillEl.offsetWidth !== undefined) {
        // Trigger reflow only when a cozy tier-up pulse occurs
      }
      cozyPillEl.classList.add('tier-up-pulse');
    }

    const cozySig = `${st.cozyScore}|${st.cozyFloorRaw || 0}|${st.cozyStructScore || 0}|${st.cozySynergyScore || 0}|${st.cozyDiversityBonus || 0}|${tier.level}|${st.starving ? 1 : 0}`;
    if (cozySig !== lastCozySig) {
      lastCozySig = cozySig;
      const heartPath = document.getElementById('res-cozy-heart-path');
      if (heartPath) {
        const strokeW = (1.5 + ((tier.level - 1) / 7) * 1.0).toFixed(2);
        heartPath.setAttribute('stroke-width', strokeW);
      }

      const nextTier = tiers.find((t) => t.level === tier.level + 1);
      const segWrap = document.getElementById('res-cozy-segments');
      if (segWrap) {
        const curProgress = nextTier
          ? Math.max(0, Math.min(1, (st.cozyScore - tier.min) / Math.max(1, nextTier.min - tier.min)))
          : 1;
        let segHtml = '';
        for (let idx = 1; idx <= 8; idx++) {
          let fillPct = 0;
          if (idx < tier.level) {
            fillPct = 100;
          } else if (idx === tier.level) {
            fillPct = nextTier ? Math.max(18, Math.round(curProgress * 100)) : 100;
          }
          segHtml += `<span class="cozy-seg"><span class="cozy-seg-fill" style="width:${fillPct}%"></span></span>`;
        }
        segWrap.innerHTML = segHtml;
      }

      const buffParts = [];
      if (tier.agentDmg > 0) buffParts.push(`화력 +${Math.round(tier.agentDmg * 100)}%`);
      if (tier.fireRate > 0) buffParts.push(`연사 +${Math.round(tier.fireRate * 100)}%`);
      if (tier.coinBonus > 0) buffParts.push(`코인 +${Math.round(tier.coinBonus * 100)}%`);
      if ((tier.xpBonus || 0) > 0) buffParts.push(`숙련 +${Math.round(tier.xpBonus * 100)}%`);
      const buffLine = buffParts.length > 0 ? buffParts.join(' · ') : '모던 꾸미기로 등급 상승';
      const starveNote = st.starving
        ? `<div class="cozy-popover-foot" style="color:${P.danger};font-weight:700;">기아 디버프 적용 중 (-2티어)</div>`
        : '';

      document.getElementById('cozy-tooltip').innerHTML = `
        <div class="cozy-popover-head">
          <span class="inline-icon-text" style="font-weight:800;color:${P.gold};">${ozIcon('res-cozy', 15, 'icon-coin')}<span>안락함 (Lv.${tier.level} ${escapeHtml(tier.title)})</span></span>
          <span style="font-size:12px;color:#e6eef7;"><b>${st.cozyScore}점</b></span>
        </div>
        <div class="cozy-buff-line">${escapeHtml(buffLine)}</div>
        ${starveNote}
        ${
          nextTier
            ? `<div class="cozy-popover-foot">다음 등급(Lv.${nextTier.level})까지 <b>${nextTier.min - st.cozyScore}점</b></div>`
            : `<div class="cozy-popover-foot" style="color:${P.gold};">★ 최고 안락함 등급(Lv.8) 달성</div>`
        }
      `;
    }

    // Auto-collapse build dock at Night start; auto-expand at Dawn (#10); Resource Bar stays compact
    uiState.hudResCompact = true;
    if (st.phase !== uiState.lastPhase) {
      if (st.phase === 'night') {
        uiState.dockCollapsed = true;
      } else if (st.phase === 'day') {
        uiState.dockCollapsed = false;
      }
      uiState.lastPhase = st.phase;
    }
    U.syncDockAndHudState();

    // Toggle Day vs Night action controls & top-right enemy counter
    const isDay = st.phase === 'day';
    document.getElementById('day-actions').classList.toggle('hidden', !isDay);
    document.getElementById('night-actions').classList.toggle('hidden', st.phase !== 'night');
    document.getElementById('night-top-status')?.classList.toggle('hidden', st.phase !== 'night');
    document.getElementById('build-dock').style.opacity = isDay ? '1' : uiState.dockCollapsed ? '0.96' : '0.90';

    renderReconCard(st);

    if (isDay) {
      const isUg = st.activeLayer === 'underground';
      const startBtn = document.getElementById('btn-start-wave');
      if (startBtn) {
        startBtn.disabled = isUg;
        startBtn.classList.toggle('b1-locked', isUg);
        startBtn.classList.toggle('boss-wave', !isUg && st.wave % 5 === 0);
      }
      document.getElementById('cta-wave-sub').innerHTML = isUg
        ? `${ozIcon('state-lock', 13, 'icon-ap')}<span>지상 복귀 후 웨이브 시작 [B]</span>`
        : st.wave % 5 === 0
        ? `${ozIcon('state-alert', 13, 'icon-danger')}<span>WAVE ${st.wave} 보스전 개시</span>`
        : `<span>WAVE ${st.wave} 야간 방어 돌입</span>`;

      const rep = ZS.Game.getRepairAllInfo();
      const repBtn = document.getElementById('btn-repair-all');
      const repTitle = document.getElementById('repair-bar-title');
      const repLbl = document.getElementById('repair-cost-label');
      repBtn.disabled = !rep.needed;
      if (rep.needed) {
        const repParts = [];
        const titleParts = [];
        if (rep.woodCost > 0) {
          repParts.push(`${ozIcon('res-wood', 13, 'icon-wood')}<span>${rep.woodCost}</span>`);
          titleParts.push(`목재 ${rep.woodCost}`);
        }
        if (rep.scrapCost > 0) {
          repParts.push(`${ozIcon('res-scrap', 13, 'icon-scrap')}<span>${rep.scrapCost}</span>`);
          titleParts.push(`고철 ${rep.scrapCost}`);
        }
        if (repTitle) repTitle.textContent = '일괄 수리';
        repLbl.innerHTML = repParts.join('');
        repLbl.classList.remove('hidden');
        setOzTitle(repBtn, `기지 일괄 정비 (${titleParts.join(' · ')})`);
      } else {
        if (repTitle) repTitle.textContent = '정비 완료';
        repLbl.textContent = '';
        repLbl.classList.add('hidden');
        setOzTitle(repBtn, '기지 일괄 정비 — 모든 시설 내구도 100%');
      }
    } else if (st.phase === 'night') {
      updateCombatHud();
    }

    U.renderItemCards();
    if (uiState.inspectedTile && uiState.mode === 'inspect') {
      U.inspectTileAt(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
    } else if (U.syncDetailBarVisibility) {
      U.syncDetailBarVisibility();
    }
    if (!document.getElementById('trader-modal').classList.contains('hidden')) {
      U.renderTraderModal();
    }
    if (U.isAnyPopTechModalOpen && U.isAnyPopTechModalOpen() && U.renderOpenPopTechModals) {
      U.renderOpenPopTechModals();
    }
    U.updateCursorTooltip();
  }

  function renderReconCard(st) {
    const el = document.getElementById('recon-card');
    const reconBtn = document.getElementById('btn-toggle-recon');
    let intel = st && st.nextWaveIntel;
    if (st && st.phase === 'day' && (!intel || intel.wave !== st.wave) && ZS.Game && ZS.Game.generateWaveIntel) {
      intel = ZS.Game.generateWaveIntel(st.wave);
    }
    const isDayIntel = !!(intel && st && st.phase === 'day');
    const isBossWave = !!(intel && (intel.bossSide != null || (intel.counts && intel.counts.boss > 0)));
    const reconOpen = !!uiState.reconOpen;
    if (reconBtn) {
      reconBtn.disabled = !isDayIntel;
      reconBtn.classList.toggle('active', isDayIntel && reconOpen);
      reconBtn.classList.toggle('boss', isDayIntel && isBossWave);
      reconBtn.setAttribute('aria-expanded', isDayIntel && reconOpen ? 'true' : 'false');
      setOzTitle(
        reconBtn,
        !isDayIntel
          ? '야간 방어 중에는 정찰 레이더가 숨겨집니다'
          : reconOpen
          ? '정찰 레이더 숨기기'
          : '정찰 레이더 펼치기'
      );
    }
    if (!el) return;
    if (!isDayIntel || !reconOpen) {
      if (lastReconSig !== 'hidden') {
        lastReconSig = 'hidden';
        el.style.display = 'none';
      }
      return;
    }

    const showPaths = st.showReconPaths !== false;
    const pathLen = st.previewPaths ? st.previewPaths.length : 0;
    const breachLen = st.breachMarkers ? st.breachMarkers.length : 0;
    const reconSig = `${intel.wave}|${intel.pattern}|${intel.totalCount}|${showPaths ? 1 : 0}|${pathLen}|${breachLen}|${(intel.sideKinds || []).join(',')}`;
    if (reconSig === lastReconSig) return;
    lastReconSig = reconSig;

    el.style.display = 'flex';
    el.classList.toggle('boss', isBossWave);

    const SIDE_NAMES = ['북동', '남동', '남서', '북서'];
    // Isometric diamond (center 60,42; N=60,10; E=108,42; S=60,74; W=12,42)
    const SIDE_EDGES = {
      0: [60, 10, 108, 42, 84, 26, -0.832, 0.555],
      1: [108, 42, 60, 74, 84, 58, -0.832, -0.555],
      2: [60, 74, 12, 42, 36, 58, 0.832, -0.555],
      3: [12, 42, 60, 10, 36, 26, 0.832, 0.555]
    };

    // 6x6 internal isometric radar grid lines matching 26x26 scale
    const gridLines = [1, 2, 3, 4, 5]
      .map((step) => {
        const u = step / 6;
        const ax = 60 - 48 * u;
        const ay = 10 + 32 * u;
        const bx = 108 - 48 * u;
        const by = 42 + 32 * u;
        const cx = 60 + 48 * u;
        const cy = 10 + 32 * u;
        const dx = 12 + 48 * u;
        const dy = 42 + 32 * u;
        return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="rgba(130, 195, 215, 0.16)" stroke-width="0.9"/><line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${dx.toFixed(1)}" y2="${dy.toFixed(1)}" stroke="rgba(130, 195, 215, 0.16)" stroke-width="0.9"/>`;
      })
      .join('');

    const kinds = intel.sideKinds || ['none', 'none', 'none', 'none'];
    const linesSvg = [0, 1, 2, 3]
      .map((sd) => {
        const k = kinds[sd];
        const e = SIDE_EDGES[sd];
        const strokeAttr =
          k === 'boss'
            ? 'stroke="#E040FB" stroke-width="3.6"'
            : k === 'main'
            ? 'stroke="#FF4D6D" stroke-width="3.4"'
            : k === 'sub'
            ? 'stroke="#FF8FA3" stroke-width="2.2"'
            : k === 'min'
            ? 'stroke="#FF8FA3" stroke-width="1.5" stroke-dasharray="3 3"'
            : 'stroke="#3A4D5E" stroke-width="1.4"';
        return `<line x1="${e[0]}" y1="${e[1]}" x2="${e[2]}" y2="${e[3]}" ${strokeAttr} stroke-linecap="round"/>`;
      })
      .join('');

    // Inward directional chevron arrows on threatened edges
    const arrowsSvg = [0, 1, 2, 3]
      .map((sd) => {
        const k = kinds[sd];
        if (!k || k === 'none' || k === 'min') return '';
        const e = SIDE_EDGES[sd];
        const mx = e[4];
        const my = e[5];
        const ix = e[6];
        const iy = e[7];
        const tx = -iy;
        const ty = ix;
        const col = k === 'boss' ? '#E040FB' : k === 'main' ? '#FF4D6D' : '#FF8FA3';
        const reach = k === 'sub' ? 8.5 : 11;
        const back = k === 'sub' ? -2 : -3;
        const wing = k === 'sub' ? 4.8 : 6.2;
        const pTip = `${(mx + ix * reach).toFixed(1)},${(my + iy * reach).toFixed(1)}`;
        const pW1 = `${(mx + ix * back + tx * wing).toFixed(1)},${(my + iy * back + ty * wing).toFixed(1)}`;
        const pNotch = `${(mx + ix * (back + 3.2)).toFixed(1)},${(my + iy * (back + 3.2)).toFixed(1)}`;
        const pW2 = `${(mx + ix * back - tx * wing).toFixed(1)},${(my + iy * back - ty * wing).toFixed(1)}`;
        return `<polygon points="${pTip} ${pW1} ${pNotch} ${pW2}" fill="${col}" stroke="#0E1722" stroke-width="0.9" stroke-linejoin="round"/>`;
      })
      .join('');

    const bossDot =
      intel.bossSide != null
        ? `<circle cx="${SIDE_EDGES[intel.bossSide][4]}" cy="${SIDE_EDGES[intel.bossSide][5]}" r="6.2" fill="rgba(224, 64, 251, 0.28)"/><circle cx="${SIDE_EDGES[intel.bossSide][4]}" cy="${SIDE_EDGES[intel.bossSide][5]}" r="3.4" fill="#E040FB" stroke="#FFFFFF" stroke-width="0.9"/>`
        : '';

    const patTitle = formatReconPatternTitle(intel);

    const ENEMY_ORDER = [
      ['walker', '보행자'],
      ['runner', '러너'],
      ['brute', '저거너트'],
      ['spitter', '애시드 스피터'],
      ['leaper', '스토커 리퍼'],
      ['shocker', '볼트 쇼커']
    ];
    const counts = intel.counts || {};
    const chipsHtml = ENEMY_ORDER.map(([id, label]) => {
      const cnt = counts[id] || 0;
      if (cnt <= 0) return '';
      const isNew =
        id === 'spitter' ||
        id === 'leaper' ||
        id === 'shocker' ||
        (id === 'runner' && intel.wave === 2) ||
        (id === 'brute' && intel.wave === 3);
      return `<span class="recon-chip${isNew ? ' new' : ''}" title="${escapeHtml(label)} ${cnt}기">${ozIcon(`en-${id}`, 13)}<span>${cnt}</span></span>`;
    }).join('');

    const bossRowHtml =
      isBossWave && intel.bossSide != null
        ? `<div class="recon-boss-row">${ozIcon('en-boss', 15)}<span>알파 타이탄${counts.boss > 1 ? ` ×${counts.boss}` : ''} · ${SIDE_NAMES[intel.bossSide]}</span></div>`
        : '';

    const waveBadge = String(st.wave || intel.wave || 1).padStart(2, '0');
    el.innerHTML = `
      <div class="recon-head">
        <span class="recon-title">${ozIcon('recon-compass', 15)}<span>정찰 레이더 · W${waveBadge}</span></span>
      </div>
      <div class="recon-radar-wrap">
        <svg class="recon-compass" viewBox="0 0 120 84" aria-hidden="true">
          <polygon points="60,10 108,42 60,74 12,42" fill="rgba(22, 48, 56, 0.90)"/>
          ${gridLines}
          ${linesSvg}
          <circle cx="60" cy="42" r="7.5" fill="rgba(255, 210, 122, 0.22)"/>
          <circle cx="60" cy="42" r="3.4" fill="#FFD27A" stroke="#0B1119" stroke-width="0.8"/>
          ${arrowsSvg}
          ${bossDot}
        </svg>
      </div>
      <div class="recon-pat">${ozIcon('state-alert', 14, isBossWave ? 'icon-boss' : 'icon-danger')}<span>${escapeHtml(patTitle)}</span></div>
      <div class="recon-chips">${chipsHtml}</div>
      ${bossRowHtml}
      <div class="recon-foot">
        <span class="recon-total-badge">${ozIcon('hud-enemy', 15, 'icon-danger')}<strong>×${intel.totalCount || 0}</strong></span>
        <button id="btn-toggle-recon-paths" type="button" class="recon-toggle${showPaths ? ' on' : ''}" aria-pressed="${showPaths ? 'true' : 'false'}" title="${showPaths ? '예상 침공 경로선 숨기기' : '예상 침공 경로선 표시'}">${ozIcon('recon-route', 14)}<span>경로선 ${showPaths ? 'ON' : 'OFF'}</span></button>
      </div>
    `;
  }

  function showWaveBanner(title, sub, tone) {
    if (uiState.mainMenuOpen) return;
    const el = document.getElementById('wave-banner');
    el.className = `wave-banner ${tone || 'info'}`;
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = sub;
    el.classList.remove('hidden');

    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, 4200);
  }

  function isWaveReportModalOpen() {
    const modal = document.getElementById('wave-report-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function closeWaveReportModal() {
    const modal = document.getElementById('wave-report-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openWaveReportModal(report) {
    if (uiState.mainMenuOpen || !report) return;
    const modal = document.getElementById('wave-report-modal');
    const codeEl = document.getElementById('wave-report-code');
    const highlightsEl = document.getElementById('wave-report-highlights');
    const gridEl = document.getElementById('wave-report-grid');
    if (!modal || !highlightsEl || !gridEl) return;

    const clearedPad = String(Math.max(1, Math.floor(report.clearedWave || 1))).padStart(2, '0');
    const nextPad = String(Math.max(2, Math.floor(report.nextWave || 2))).padStart(2, '0');
    if (codeEl) {
      codeEl.textContent = `WAVE ${clearedPad} 방어 성공 · 다음 목표 WAVE ${nextPad}`;
    }

    const alerts = [];
    if (report.starving) {
      alerts.push({
        cls: 'is-danger',
        icon: 'state-alert',
        iconCls: 'icon-danger',
        title: '식량 고갈 — 기아 페널티 발생!',
        sub: '신규 생존자 유입 중단 · 유인 화력 -25% · 연구/생산 -35% · 안락함 -2티어. 상점 긴급 보급이나 수경재배실로 식량을 채우면 즉시 해제됩니다.'
      });
    } else if (report.recoveredFromStarve) {
      alerts.push({
        cls: 'is-hq',
        icon: 'res-food',
        iconCls: 'icon-food',
        title: '식량 수급 안정 — 기아 페널티 해제!',
        sub: '전투원 화력·생산 효율·안락함 등급이 정상 수치로 복구되었습니다.'
      });
    }
    if (report.arrivedAgent > 0) {
      alerts.push({
        cls: 'is-arrival',
        icon: 'res-agent',
        iconCls: 'icon-coin',
        title: `생존자 ${report.arrivedAgent}명이 쉘터에 합류하였습니다.`,
        sub: `현재 총원 ${report.totalAgents}/${report.popCap}명 (다음 모집 ${report.recruitProgress || 0}% · +${report.recruitRate || 0}명/일) · 인구 배치 [P]에서 직무를 배정하세요.`
      });
    }
    if ((report.turnedAway || 0) > 0) {
      alerts.push({
        cls: 'is-danger',
        icon: 'state-alert',
        iconCls: 'icon-danger',
        title: `숙소 부족으로 생존자 ${report.turnedAway}명이 되돌아갔습니다.`,
        sub: `새벽 방문 ${report.incomingAgents}명 중 ${report.arrivedAgent}명만 수용됨 (${report.totalAgents}/${report.popCap}명). [전력·숙소] 탭에서 막사/숙소를 증설하세요.`
      });
    } else if (report.arrivedAgent <= 0 && (report.incomingAgents || 0) === 0 && !report.starveBlockedArrival) {
      alerts.push({
        cls: 'is-info',
        icon: 'res-agent',
        iconCls: 'icon-muted',
        title: report.popFull
          ? `요원 수용 한도 도달 (${report.totalAgents}/${report.popCap}명)`
          : `생존자 모집 진행 중 (${report.recruitProgress || 0}%)`,
        sub: report.popFull
          ? `모집 대기 ${report.recruitProgress || 0}% · 막사나 지하 침대를 증설하면 새벽마다 순차 합류합니다.`
          : `현재 총원 ${report.totalAgents}/${report.popCap}명 · 일일 모집 +${report.recruitRate || 0}명 (100% 도달 시 새벽 합류, 급할 땐 상점 요원 스카우트 활용)`
      });
    }

    if (report.unlockedHqLevel) {
      const b1Note = report.unlockedHqLevel === 2 ? '와 지하 쉘터(B1)' : '';
      alerts.push({
        cls: 'is-hq',
        icon: 'hud-hq',
        iconCls: 'icon-heal',
        title: `지휘 본부 Lv.${report.unlockedHqLevel} 증축 조건 달성!`,
        sub: `중앙 지휘 본부를 클릭해 증축하면 상위 공학 연구 티어${b1Note}가 개방됩니다.`
      });
    }

    if (Array.isArray(report.newlyUnlocked) && report.newlyUnlocked.length > 0) {
      alerts.push({
        cls: 'is-unlock',
        icon: 'state-rank',
        iconCls: 'icon-coin',
        title: `사령관 지휘 분과 영구 해금: ${report.newlyUnlocked.join(', ')}`,
        sub: '다음 새 작전 개시 시 지휘 분과 선택 창에서 즉시 출격할 수 있습니다.'
      });
    }

    highlightsEl.innerHTML = alerts
      .map(
        (a) => `
        <div class="wr-highlight ${a.cls}">
          <span class="wr-hl-icon" aria-hidden="true">${ozIcon(a.icon, 20, a.iconCls)}</span>
          <div class="wr-hl-copy">
            <div class="wr-hl-title">${escapeHtml(a.title)}</div>
            <div class="wr-hl-sub">${escapeHtml(a.sub)}</div>
          </div>
        </div>
      `
      )
      .join('');

    const woodTotal = (report.woodReward || 0) + (report.prodWood || 0) + (report.scavengeWood || 0);
    const scrapTotal = (report.scrapReward || 0) + (report.prodScrap || 0) + (report.scavengeScrap || 0);
    const coinTotal = (report.totalCoin || 0) + (report.supplyCoin || 0);
    const jobs = report.jobs || { combat: 0, research: 0, prod: 0 };

    const cells = [
      {
        icon: 'res-wood',
        iconCls: 'icon-wood',
        label: '목재 획득',
        val: `+${woodTotal}`,
        sub: ''
      },
      {
        icon: 'res-scrap',
        iconCls: 'icon-scrap',
        label: '고철 획득',
        val: `+${scrapTotal}`,
        sub: ''
      },
      {
        icon: 'res-coin',
        iconCls: 'icon-coin',
        label: '코인 보상',
        val: `+${coinTotal}`,
        sub: ''
      },
      {
        icon: 'res-rp',
        iconCls: 'icon-rp',
        label: '연구 포인트',
        val: `+${report.rpGain || 0} RP`,
        sub: `보유 ${Math.floor(report.totalRp || 0)} RP`
      },
      {
        icon: 'act-repair',
        iconCls: 'icon-heal',
        label: '전력 충전 · 정비',
        val: `전력 +${report.gainedPower || 0}`,
        sub: '주간 충전 완료'
      },
      report.b1Open
        ? {
            icon: 'b1-dig',
            iconCls: 'icon-ap',
            label: '지하 굴착력',
            val: `+${report.digGain || 0} AP`,
            sub: `보유 ${report.digAp || 0}/${report.digApCap || 16} AP`
          }
        : {
            icon: 'res-agent',
            iconCls: 'icon-coin',
            label: '생존 인원',
            val: `${report.totalAgents || 0}/${report.popCap || 4}명`,
            sub: ''
          },
      {
        icon: 'res-food',
        iconCls: report.starving ? 'icon-danger' : 'icon-food',
        label: '식량 결산',
        val: `${report.foodAfter || 0}/${report.foodCap || 160}`,
        sub: `+${report.foodGain || 0} / -${report.foodUsed || 0} 소비${report.starving ? ' (기아)' : ''}`
      },
      {
        icon: 'res-ammo',
        iconCls: 'icon-ammo',
        label: '탄환 보급',
        val: `+${report.ammoGain || 0}`,
        sub: `보유 ${report.ammoAfter || 0}/${report.ammoCap || 140}`
      },
      {
        icon: 'res-rocket',
        iconCls: 'icon-rocket',
        label: '로켓 탄두',
        val: `+${report.rocketGain || 0}`,
        sub: `보유 ${report.rocketAfter || 0}/${report.rocketCap || 40}`
      }
    ];

    gridEl.innerHTML = cells
      .map(
        (c) => `
        <div class="wr-stat-cell">
          <span class="wr-stat-label">${ozIcon(c.icon, 14, c.iconCls)}<span>${escapeHtml(c.label)}</span></span>
          <strong class="wr-stat-val">${escapeHtml(c.val)}</strong>
          ${c.sub ? `<span class="wr-stat-sub">${escapeHtml(c.sub)}</span>` : ''}
        </div>
      `
      )
      .join('');

    document.getElementById('wave-banner')?.classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('btn-close-wave-report')?.focus();
  }

  let lastStrikeTargeting = null;
  let lastPopSig = '';

  function updateCombatHud() {
    const st = ZS.Game.state;
    if (st.phase !== 'night') {
      updateHud();
      return;
    }
    const hq = st.structGrid[ZS.DATA.HQ_POS.y] && st.structGrid[ZS.DATA.HQ_POS.y][ZS.DATA.HQ_POS.x];
    const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
    const hqHp = hq ? Math.ceil(hq.hp) : 0;
    const hqMax = hq ? hq.maxHp : hqInfo.maxHp;
    document.getElementById('hud-hq-hp').textContent = `${hqHp} / ${hqMax}`;
    document.getElementById('hud-hq-bar').style.width = `${Math.max(0, (hqHp / hqMax) * 100)}%`;

    document.getElementById('res-wood').textContent = Math.floor(st.wood);
    document.getElementById('res-scrap').textContent = Math.floor(st.scrap);
    document.getElementById('res-coin').textContent = Math.floor(st.coin);
    updateDailyResourceDeltas(st);
    syncSupplyPillHud(st);
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const nextPopSig = `${st.popUsed}/${st.agents}/${st.popCap}/${jobs.combat}/${jobs.research}/${jobs.prod}/${Math.floor(st.rp || 0)}`;
    if (nextPopSig !== lastPopSig) {
      lastPopSig = nextPopSig;
      const popEl = document.getElementById('res-pop');
      if (popEl) {
        popEl.textContent = `${st.agents}/${st.popCap}`;
      }
      const assignedCount = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
      const unassignedCount = Math.max(0, (st.agents || 0) - assignedCount);
      const rpEl = document.getElementById('res-rp');
      if (rpEl) {
        rpEl.textContent = `${Math.floor(st.rp || 0)} RP`;
      }
      const unassignedChipEl = document.getElementById('hud-unassigned-chip');
      if (unassignedChipEl) {
        unassignedChipEl.textContent = `+${unassignedCount}`;
        unassignedChipEl.classList.toggle('hidden', unassignedCount <= 0);
      }
      if (U.isAnyPopTechModalOpen && U.isAnyPopTechModalOpen() && U.renderOpenPopTechModals) {
        U.renderOpenPopTechModals();
      }
    }
    document.getElementById('res-cozy').textContent = `Lv.${st.cozyTier.level}`;

    syncNightPhaseAndPowerHud(st);
    syncDivisionBadge(st);
    syncWindLayerButton(st);
    syncUndergroundToggleButton(st);

    const left = st.spawnQueue.length + st.zombies.length;
    document.getElementById('hud-enemies-left').textContent = `${left}기`;
    document.getElementById('speed-label').textContent = `${st.gameSpeed}x`;

    const healAmt = 95 + (st.b1ArmoryDroneHealAdd || 0);
    const effMaxCd = Math.max(6, Math.round((st.skills.repairMaxCd || 18) - (st.b1ArmoryDroneCdRed || 0)));
    const rBtn = document.getElementById('btn-skill-repair');
    rBtn.disabled = st.skills.repairCd > 0;
    document.getElementById('skill-repair-cd').textContent =
      st.skills.repairCd > 0 ? `재충전 중 (${Math.ceil(st.skills.repairCd)}초)` : `즉시 전체 시설 +${healAmt} HP (${effMaxCd}초)`;

    const sBtn = document.getElementById('btn-skill-airstrike');
    sBtn.disabled = st.skills.airstrikeCd > 0;
    const strikeEl = document.getElementById('skill-strike-cd');
    if (st.skills.airstrikeCd > 0) {
      lastStrikeTargeting = 'cd';
      strikeEl.textContent = `재장전 중 (${Math.ceil(st.skills.airstrikeCd)}초)`;
    } else if (uiState.activeSkill === 'airstrike') {
      if (lastStrikeTargeting !== 'targeting') {
        lastStrikeTargeting = 'targeting';
        strikeEl.innerHTML = `${ozIcon('sys-center', 13, 'icon-danger')}<span>타격할 타일을 클릭하세요!</span>`;
      }
    } else if (lastStrikeTargeting !== 'idle') {
      lastStrikeTargeting = 'idle';
      strikeEl.textContent = '지정 위치 광역 폭격 + 조명';
    }
  }

  function updateLiveNightNumbers() {
    updateCombatHud();
  }

  function initDebugToolbar(env) {
    const bar = document.getElementById('debug-toolbar');
    if (!bar) return;

    // Strictly double-gated: NEVER mount or unhide when isDevEnvironment === false or ?debug=1 is absent
    if (!env || !env.isDevEnvironment || !env.isDebugMode) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }

    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div class="debug-head">
        <span class="debug-title">${ozIcon('act-repair', 14, 'icon-coin')}<span>DEBUG · ${env.saveKey === 'outpost_zero_save_dev' ? 'DEV SAVE' : 'LOCAL'}</span></span>
        <button id="btn-debug-collapse" class="debug-toggle-btn" title="디버그 바 접기/펼치기">접기 ▴</button>
      </div>
      <div class="debug-body">
        <button id="btn-dbg-res" class="debug-btn" title="목재·고철·코인 즉시 +500">${ozIcon('res-coin', 13, 'icon-coin')}<span>+500 자원</span></button>
        <button id="btn-dbg-supply" class="debug-btn" title="식량+100 · 탄환+100 · 로켓+40 즉시 보급">${ozIcon('res-ammo', 13, 'icon-ammo')}<span>+보급품</span></button>
        <button id="btn-dbg-rp" class="debug-btn" title="연구포인트(RP) 즉시 +20">${ozIcon('res-rp', 13, 'icon-rp')}<span>+20 RP</span></button>
        <button id="btn-dbg-digap" class="debug-btn" title="굴착력 +20 AP 지급 (본부 Lv.2 증축 후 사용)">${ozIcon('b1-dig', 13, 'icon-ap')}<span>+20 굴착 AP</span></button>
        <button id="btn-dbg-pwr" class="debug-btn" title="배터리 전력 완충 / 방전(0) 토글">${ozIcon('res-power', 13, 'icon-power')}<span>전력 완충/방전</span></button>
        <button id="btn-dbg-pop" class="debug-btn" title="가용 요원 및 임시 숙소 수용량 +2">${ozIcon('res-agent', 13)}<span>요원 +2</span></button>
        <button id="btn-dbg-wave1" class="debug-btn" title="주간 정비 상태에서 웨이브 +1">${ozIcon('act-speed', 13)}<span>웨이브 +1</span></button>
        <button id="btn-dbg-wave5" class="debug-btn" title="주간 정비 상태에서 웨이브 +5 (보스전 등)">${ozIcon('act-speed', 13)}<span>+5</span></button>
        <button id="btn-dbg-wave10" class="debug-btn" title="주간 정비 상태에서 웨이브 +10 (본부 웨이브 게이트 검증)">${ozIcon('act-speed', 13)}<span>웨이브 +10</span></button>
        <button id="btn-dbg-xp" class="debug-btn" title="조회 중인 초소·포탑에 숙련도 +20 XP 즉시 부여">${ozIcon('state-rank', 13, 'icon-coin')}<span>선택 시설 XP +20</span></button>
      </div>
    `;

    const toggleBtn = document.getElementById('btn-debug-collapse');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const collapsed = bar.classList.toggle('collapsed');
        toggleBtn.textContent = collapsed ? '펼치기 ▾' : '접기 ▴';
      });
    }

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    bind('btn-dbg-res', () => ZS.Game.debugAddResources(500));
    bind('btn-dbg-supply', () => ZS.Game.debugAddSupplies && ZS.Game.debugAddSupplies());
    bind('btn-dbg-rp', () => ZS.Game.debugAddRp && ZS.Game.debugAddRp(20));
    bind('btn-dbg-digap', () => ZS.Game.debugAddDigAp && ZS.Game.debugAddDigAp(20));
    bind('btn-dbg-pwr', () => ZS.Game.debugTogglePower());
    bind('btn-dbg-pop', () => ZS.Game.debugAddAgents(2));
    bind('btn-dbg-wave1', () => ZS.Game.debugAdvanceWave(1));
    bind('btn-dbg-wave5', () => ZS.Game.debugAdvanceWave(5));
    bind('btn-dbg-wave10', () => ZS.Game.debugAdvanceWave(10));
    bind('btn-dbg-xp', () => {
      const sel = uiState.inspectedTile;
      if (sel) {
        ZS.Game.debugGrantSelectedXp(sel.tx, sel.ty, 20);
      } else {
        ZS.Game.debugGrantSelectedXp(-1, -1, 20);
      }
    });
  }

  function onLayerChanged() {
    uiState.inspectedTile = null;
    uiState.movingSource = null;
    uiState.activeSkill = null;
    uiState.b1DragStart = null;
    uiState.b1DragCurrent = null;
    uiState.hoverB1DoorEdge = null;
    uiState.selectedItemId = null;
    uiState.selectedB1ToolId = null;
    uiState.selectedB1Role = null;
    uiState.b1BuildRot = 0;
    if (!uiState.activeB1Category) uiState.activeB1Category = 'b1_ops';
    if (U.renderCategoryTabs) U.renderCategoryTabs();
    if (U.setToolMode) U.setToolMode('inspect');
  }

  let activeHoverAnchor = null;
  let tooltipObserver = null;
  let tooltipsBound = false;

  const TOOLTIP_TARGET_SELECTOR = [
    '#hud-division-badge',
    '#hud-hq-box',
    '.power-pill',
    '#btn-toggle-underground',
    '#btn-toggle-wind-layer',
    '#res-wood-cell',
    '#res-scrap-cell',
    '#btn-open-trader-pill',
    '#pop-pill',
    '#rp-pill',
    '#supply-pill',
    '#cozy-pill',
    '#btn-trader',
    '#btn-open-pop',
    '#btn-open-tech',
    '#btn-toggle-recon',
    '#btn-settings',
    '#btn-toggle-recon-paths',
    '#btn-repair-all',
    '#tool-move',
    '#tool-remove',
    '#tool-inspect',
    '#btn-toggle-dock',
    '#btn-expand-dock',
    '.tab-btn',
    '.item-card',
    '[data-pop-title]',
    '[data-oz-title]',
    '[title]'
  ].join(',');

  function harvestNativeTitle(el) {
    if (!el || el.namespaceURI === 'http://www.w3.org/2000/svg') return '';
    if (el.hasAttribute('title')) {
      const val = el.getAttribute('title') || '';
      if (val && el.dataset) el.dataset.ozTitle = val;
      el.removeAttribute('title');
    }
    return (el.dataset && el.dataset.ozTitle) || '';
  }

  function sweepNativeTitles(root) {
    const scope = root && root.querySelectorAll ? root : document.body;
    if (!scope) return;
    if (scope.nodeType === 1) harvestNativeTitle(scope);
    scope.querySelectorAll('[title]').forEach((el) => {
      harvestNativeTitle(el);
    });
  }

  function renderPopoverHtml(opts) {
    const o = opts || {};
    const iconHtml = o.icon ? ozIcon(o.icon, 15, o.iconCls || '') : '';
    const rightHtml = o.kbd
      ? `<span class="oz-pop-kbd">${escapeHtml(o.kbd)}</span>`
      : o.badge
      ? `<span class="oz-pop-badge">${escapeHtml(o.badge)}</span>`
      : '';
    const highlightHtml = o.highlight ? `<div class="oz-pop-highlight">${escapeHtml(o.highlight)}</div>` : '';
    const bodyHtml = o.body ? `<div class="oz-pop-body">${escapeHtml(o.body)}</div>` : '';
    const footHtml = o.foot ? `<div class="oz-pop-foot">${escapeHtml(o.foot)}</div>` : '';
    return `
      <div class="oz-pop-head">
        <span class="oz-pop-title">${iconHtml}<span>${escapeHtml(o.title || '')}</span></span>
        ${rightHtml}
      </div>
      ${highlightHtml}
      ${bodyHtml}
      ${footHtml}
    `;
  }

  function buildGenericFallbackSpec(el, rawText) {
    const clean = String(rawText || '').trim();
    if (!clean) return null;
    let title = clean;
    let body = '';
    const emIdx = clean.indexOf(' — ');
    if (emIdx > 0) {
      title = clean.slice(0, emIdx).trim();
      body = clean.slice(emIdx + 3).trim();
    } else {
      const colIdx = clean.indexOf(': ');
      if (colIdx > 0 && colIdx <= 20) {
        title = clean.slice(0, colIdx).trim();
        body = clean.slice(colIdx + 2).trim();
      }
    }
    let kbd = '';
    const kbdMatch = (body || title).match(/\((?:단축키\s+)?([A-Za-z0-9]{1,3}|ESC|Tab|Space)\)$/);
    if (kbdMatch) {
      kbd = kbdMatch[1];
      if (body) body = body.slice(0, kbdMatch.index).trim();
      else title = title.slice(0, kbdMatch.index).trim();
    }
    const tone = el.classList.contains('danger') || el.classList.contains('danger-outline') ? 'danger' : 'scrap';
    return {
      tone,
      compact: !body,
      html: renderPopoverHtml({ title, kbd, body })
    };
  }

  function buildUnifiedTooltipSpec(el, st) {
    if (!el || !st) return null;
    const rawFallback = harvestNativeTitle(el);
    const id = el.id || '';

    if (el.dataset && el.dataset.popTitle) {
      return {
        tone: el.dataset.popTone || 'scrap',
        align: el.closest('#detail-bar') ? 'left' : undefined,
        html: renderPopoverHtml({
          icon: el.dataset.popIcon || '',
          iconCls: el.dataset.popIconCls || '',
          title: el.dataset.popTitle,
          badge: el.dataset.popBadge || '',
          kbd: el.dataset.popKbd || '',
          highlight: el.dataset.popHighlight || '',
          body: el.dataset.popBody || '',
          foot: el.dataset.popFoot || ''
        })
      };
    }

    if (id === 'cozy-pill') {
      const tipEl = document.getElementById('cozy-tooltip');
      if (!tipEl || !tipEl.innerHTML.trim()) return null;
      return { tone: 'gold', html: tipEl.innerHTML, align: 'right' };
    }

    if (id === 'hud-division-badge') {
      const tipEl = document.getElementById('hud-division-tooltip');
      if (!tipEl || !tipEl.innerHTML.trim()) return null;
      return {
        tone: el.classList.contains('div-arc') ? 'power' : 'gold',
        wide: true,
        align: 'left',
        html: tipEl.innerHTML
      };
    }

    const jobs = st.jobs || { combat: st.agents || 0, research: 0, prod: 0 };
    const assigned = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    const unassigned = Math.max(0, (st.agents || 0) - assigned);

    if (id === 'res-wood-cell') {
      return {
        tone: 'wood',
        html: renderPopoverHtml({
          icon: 'res-wood',
          iconCls: 'icon-wood',
          title: '목재',
          badge: `${Math.floor(st.wood || 0)}`,
          body: '방벽, 전술 막사, 전투원 초소, 모던 가구 제작'
        })
      };
    }

    if (id === 'res-scrap-cell') {
      return {
        tone: 'scrap',
        html: renderPopoverHtml({
          icon: 'res-scrap',
          iconCls: 'icon-scrap',
          title: '고철',
          badge: `${Math.floor(st.scrap || 0)}`,
          body: '강화 장갑벽, 자동 포탑, 발전·배터리 설비 제작'
        })
      };
    }

    if (id === 'btn-open-trader-pill') {
      const coinBonus = st.cozyTier ? (st.cozyTier.coinBonus || 0) : 0;
      return {
        tone: 'gold',
        html: renderPopoverHtml({
          icon: 'res-coin',
          iconCls: 'icon-coin',
          title: '코인',
          badge: `${Math.floor(st.coin || 0)}`,
          body: '외부 보급 상인과 자재·특수 가구·요원 거래',
          foot: coinBonus > 0 ? `안락함 보너스 +${Math.round(coinBonus * 100)}% 적용 중` : '상단 상점 버튼에서 사용'
        })
      };
    }

    if (id === 'pop-pill') {
      return {
        tone: 'gold',
        html: renderPopoverHtml({
          icon: 'res-agent',
          title: '생존자',
          badge: `${st.agents || 0}/${st.popCap || 4}명`,
          highlight: `전투 ${jobs.combat || 0} · 연구 ${jobs.research || 0} · 생산 ${jobs.prod || 0}`,
          body: unassigned > 0 ? `미배정 대기 인원 ${unassigned}명이 대기 중입니다` : '모든 생존자가 직무에 배치되어 작전 중입니다',
          foot: '상단 인구배치 버튼 [P]에서 직무 배치'
        })
      };
    }

    if (id === 'rp-pill') {
      return {
        tone: 'rp',
        html: renderPopoverHtml({
          icon: 'res-rp',
          iconCls: 'icon-rp',
          title: '연구포인트 (RP)',
          badge: `${Math.floor(st.rp || 0)} RP`,
          body: '연구 요원이 매일 아침 생산하며 5계열 연구 트리를 해금',
          foot: `연구 요원 ${jobs.research || 0}명 배치 · 상단 연구 버튼 [T]`
        })
      };
    }

    if (id === 'supply-pill') {
      const dSup = st.supplyDaily || { foodIn: 0, foodOut: 0, ammoIn: 0, rocketIn: 0 };
      const armParts = [];
      if ((st.b1ArmoryDmgAdd || 0) > 0) armParts.push(`화기 +${Math.round(st.b1ArmoryDmgAdd * 100)}%`);
      if ((st.b1ArmoryWallHpAdd || 0) > 0) armParts.push(`성벽 +${Math.round(st.b1ArmoryWallHpAdd * 100)}%`);
      if ((st.b1ArmoryDroneHealAdd || 0) > 0) armParts.push(`드론 +${st.b1ArmoryDroneHealAdd}HP`);
      const armLine = armParts.length > 0 ? `병기 공방: ${armParts.join(' · ')}` : '새벽 정산 및 상점 [긴급 보급]으로 보충';
      return {
        tone: st.starving ? 'danger' : 'gold',
        html: renderPopoverHtml({
          icon: 'res-ammo',
          iconCls: st.starving ? 'icon-danger' : 'icon-ammo',
          title: '기지 보급품 3종',
          badge: st.starving ? '기아 경보' : '보급 가동',
          highlight: `식량 ${Math.floor(st.food || 0)}/${st.foodCap || 160} (+${dSup.foodIn}/-${dSup.foodOut}) · 탄환 ${Math.floor(st.ammo || 0)}/${st.ammoCap || 140} (+${dSup.ammoIn}) · 로켓 ${Math.floor(st.rocket || 0)}/${st.rocketCap || 40} (+${dSup.rocketIn})`,
          body: st.starving
            ? '식량 고갈 상태! 유인 화력 -25%, 연구·생산 -35%, 안락함 -2티어, 신규 유입 중단이 적용 중입니다.'
            : '발칸 포대는 탄환, 다연장 로켓은 로켓 탄두를 소모하며 고갈 시 즉시 정지(OFF)됩니다. 유인 초소는 무탄약·무전력 작동.',
          foot: armLine
        })
      };
    }

    if (id === 'hud-hq-box') {
      const hqPos = ZS.DATA && ZS.DATA.HQ_POS;
      const hq = hqPos && st.structGrid && st.structGrid[hqPos.y] && st.structGrid[hqPos.y][hqPos.x];
      const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(st.hqLevel) : { maxHp: 800 };
      const hqHp = hq ? Math.ceil(hq.hp) : 0;
      const hqMax = hq ? hq.maxHp : hqInfo.maxHp;
      const hqPct = hqMax > 0 ? Math.round((hqHp / hqMax) * 100) : 0;
      return {
        tone: 'heal',
        align: 'left',
        html: renderPopoverHtml({
          icon: 'hud-hq',
          title: '전술 지휘 본부',
          badge: `Lv.${st.hqLevel || 1}`,
          highlight: `내구도 ${hqHp} / ${hqMax} (${hqPct}%)`,
          body: '기지의 핵심 지휘 거점입니다. 파괴되면 작전이 실패합니다.',
          foot: '클릭하여 본부 상세 조회 및 증축'
        })
      };
    }

    if (el.classList.contains('power-pill')) {
      const isBlackout = !!(st.isNight && st.blackoutActive);
      return {
        tone: isBlackout ? 'danger' : 'power',
        align: 'left',
        html: renderPopoverHtml({
          icon: isBlackout ? 'state-power-off' : 'res-power',
          iconCls: isBlackout ? 'icon-danger' : 'icon-power',
          title: '배터리 전력',
          badge: isBlackout ? '정전' : `${Math.round(st.power || 0)} / ${st.powerCap || 0}`,
          highlight: formatPowerSubText(st),
          body: '낮에 태양광·풍력으로 충전되며, 밤에 자동 포탑과 전기 조명이 실시간 소모합니다.',
          foot: '유인 초소는 무전력으로 정전 시에도 작동'
        })
      };
    }

    if (id === 'btn-toggle-underground') {
      const unlocked = (st.hqLevel || 1) >= 2 && !!st.undergroundUnlocked;
      const isDay = st.phase === 'day';
      const isUg = st.activeLayer === 'underground';
      const lv2Wave = ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(2) : 10;
      const statusText = !unlocked
        ? (st.wave || 1) >= lv2Wave
          ? '잠금 · 본부 Lv.2 증축 필요'
          : `잠금 · WAVE ${lv2Wave} 이후 해금`
        : !isDay
        ? '야간 방어 중 이동 불가'
        : isUg
        ? '현재 지하 B1 쉘터 작전 중'
        : `입장 가능 · 보유 ${Math.floor(st.digAp || 0)}/${st.digApCap || 24} AP`;
      const bodyText = !unlocked
        ? `WAVE ${lv2Wave} 도달 후 지휘 본부를 Lv.2로 증축하면 지하 B1 쉘터가 개방됩니다.`
        : isUg
        ? '클릭하여 지상 본부 레이어로 복귀합니다.'
        : '지하 B1 쉘터를 굴착하고 생활관·연구·보급 시설을 배치합니다.';
      return {
        tone: !unlocked ? 'scrap' : 'gold',
        align: 'left',
        html: renderPopoverHtml({
          icon: 'b1-elevator',
          iconCls: unlocked ? 'icon-ap' : '',
          title: isUg ? '지상 본부 복귀' : '지하 B1 쉘터',
          kbd: 'B',
          highlight: statusText,
          body: bodyText,
          foot: '주간 정비 전용 · 단축키 B'
        })
      };
    }

    if (id === 'btn-toggle-wind-layer') {
      const isUg = st.activeLayer === 'underground';
      const on = !isUg && !!st.showWindOverlay;
      return {
        tone: isUg ? 'scrap' : 'heal',
        html: renderPopoverHtml({
          icon: 'hud-wind',
          title: '강풍 지대 오버레이',
          kbd: 'V',
          highlight: isUg ? '지상 레이어 전용' : on ? '표시 중 (ON)' : '숨김 (OFF)',
          body: '풍력 발전 효율 보너스 지대(주변 +40% · 중심 +70%)를 지형 위에 표시합니다.'
        })
      };
    }

    if (id === 'btn-trader') {
      return {
        tone: 'gold',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'act-trader',
          iconCls: 'icon-coin',
          title: '상점',
          badge: `코인 ${Math.floor(st.coin || 0)}`,
          body: '크레딧 코인으로 전략 자재, 급속 파워셀, 작전 요원, 특수 가구를 거래합니다.',
          foot: '클릭하여 상점 열기'
        })
      };
    }

    if (id === 'btn-open-pop') {
      return {
        tone: 'gold',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'res-agent',
          title: '인구배치',
          kbd: 'P',
          highlight: unassigned > 0 ? `미배정 대기 요원 +${unassigned}명` : `전원 배치 완료 (${st.agents || 0}/${st.popCap || 4}명)`,
          body: `전투 ${jobs.combat || 0} · 연구 ${jobs.research || 0} · 생산 ${jobs.prod || 0} 직무 배치 및 인원을 관리합니다.`
        })
      };
    }

    if (id === 'btn-open-tech') {
      return {
        tone: 'rp',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'res-rp',
          iconCls: 'icon-rp',
          title: '연구',
          kbd: 'T',
          highlight: `보유 연구포인트 ${Math.floor(st.rp || 0)} RP`,
          body: '5계열 공학 기술을 연구해 고급 포탑과 기지 인프라를 해금합니다.'
        })
      };
    }

    if (id === 'btn-toggle-recon') {
      const intel = st.nextWaveIntel;
      const isDayIntel = !!(intel && st.phase === 'day');
      const isBossWave = !!(intel && (intel.bossSide != null || (intel.counts && intel.counts.boss > 0)));
      const reconOpen = !!uiState.reconOpen;
      return {
        tone: isBossWave ? 'rp' : 'danger',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'recon-compass',
          title: '정찰 레이더',
          badge: !isDayIntel ? '야간 숨김' : reconOpen ? '표시 중' : '숨김',
          body: !isDayIntel
            ? '야간 방어 중에는 정찰 레이더가 자동으로 숨겨집니다.'
            : '다음 웨이브 침공 방향·적 구성·예상 침공 경로 브리핑 카드를 열고 닫습니다.'
        })
      };
    }

    if (id === 'btn-settings') {
      const sp = document.getElementById('settings-popover');
      if (sp && !sp.classList.contains('hidden')) return null;
      return {
        tone: 'scrap',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'sys-settings',
          title: '메뉴',
          body: '효과음, 화면 흔들림, 카메라 복귀, 작전 가이드, 작전 초기화를 설정합니다.'
        })
      };
    }

    if (id === 'btn-toggle-recon-paths') {
      const showPaths = st.showReconPaths !== false;
      return {
        tone: 'danger',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'recon-route',
          title: '예상 침공 경로선',
          badge: showPaths ? 'ON' : 'OFF',
          body: '전장 위에 표시되는 적 예상 침공 경로 점선을 켜거나 끕니다.'
        })
      };
    }

    if (id === 'btn-repair-all') {
      const rep = ZS.Game.getRepairAllInfo ? ZS.Game.getRepairAllInfo() : { needed: false, woodCost: 0, scrapCost: 0 };
      const costParts = [];
      if (rep.woodCost > 0) costParts.push(`목재 ${rep.woodCost}`);
      if (rep.scrapCost > 0) costParts.push(`고철 ${rep.scrapCost}`);
      return {
        tone: 'heal',
        align: 'right',
        html: renderPopoverHtml({
          icon: 'act-repair',
          iconCls: 'icon-heal',
          title: '기지 일괄 정비',
          badge: rep.needed ? '수리 필요' : '100%',
          highlight: rep.needed ? `필요 자원: ${costParts.join(' · ')}` : '모든 시설 내구도 100%',
          body: '손상된 모든 아군 방어 시설을 한 번에 수리합니다.'
        })
      };
    }

    if (id === 'tool-move') {
      return {
        tone: 'scrap',
        html: renderPopoverHtml({
          icon: 'tool-move',
          title: '시설 이동',
          kbd: 'M',
          body: '낮 동안 이미 설치한 시설을 무료로 다른 위치로 옮깁니다.'
        })
      };
    }

    if (id === 'tool-remove') {
      return {
        tone: 'danger',
        html: renderPopoverHtml({
          icon: 'tool-remove',
          iconCls: 'icon-danger',
          title: '시설 철거',
          kbd: 'X',
          body: '설치한 시설이나 바닥재를 철거하고 건설 비용의 80%를 돌려받습니다.'
        })
      };
    }

    if (id === 'tool-inspect') {
      return {
        tone: 'scrap',
        html: renderPopoverHtml({
          icon: 'tool-inspect',
          title: '시설 조회',
          kbd: 'ESC',
          body: '시설의 상세 능력치, 버프 반경, 전력 수치를 확인합니다.'
        })
      };
    }

    if (id === 'btn-toggle-dock' || id === 'btn-expand-dock') {
      const isExpand = id === 'btn-expand-dock';
      return {
        tone: 'scrap',
        html: renderPopoverHtml({
          icon: isExpand ? 'ui-chevron-up' : 'ui-chevron-down',
          title: isExpand ? '건설 도크 펼치기' : '건설 도크 접기',
          kbd: 'Tab',
          body: '하단 전술 건설 카드덱을 접거나 펼쳐 전장 시야를 확보합니다.'
        })
      };
    }

    if (el.classList.contains('tab-btn')) {
      const b1CatId = el.getAttribute('data-b1-cat');
      const catId = el.getAttribute('data-cat');
      const catDef = b1CatId
        ? (ZS.DATA.B1_CATEGORIES || []).find((c) => c.id === b1CatId)
        : (ZS.DATA.CATEGORIES || []).find((c) => c.id === catId);
      if (catDef) {
        const iconId = catDef.iconId || (b1CatId ? 'b1-ops' : `cat-${catDef.id}`);
        return {
          tone: b1CatId || catDef.id === 'decor' ? 'gold' : 'scrap',
          align: 'left',
          html: renderPopoverHtml({
            icon: iconId,
            title: catDef.label,
            body: catDef.desc
          })
        };
      }
    }

    if (el.classList.contains('item-card')) {
      const b1ToolId = el.getAttribute('data-b1-tool');
      if (b1ToolId) {
        const toolDef = (ZS.DATA.B1_TOOLS || []).find((t) => t.id === b1ToolId);
        if (toolDef) {
          return {
            tone: 'gold',
            html: renderPopoverHtml({
              icon: toolDef.iconId || 'b1-dig',
              iconCls: 'icon-ap',
              title: toolDef.name,
              badge: toolDef.costLabel || '',
              highlight: toolDef.tag || '',
              body: toolDef.desc || ''
            })
          };
        }
      }
      const itemId = el.getAttribute('data-item-id');
      const def = itemId && ZS.DATA.ITEMS ? ZS.DATA.ITEMS[itemId] : null;
      if (def) {
        const tagInfo = U.getCardTagInfo ? U.getCardTagInfo(def) : null;
        const tagText = tagInfo ? tagInfo.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const hotkeyEl = el.querySelector('.card-hotkey');
        const reqTechId = ZS.Game.getItemRequiredTech ? ZS.Game.getItemRequiredTech(def.id) : null;
        const techDef = reqTechId && ZS.DATA.TECH_TREE ? ZS.DATA.TECH_TREE[reqTechId] : null;
        const techLv = reqTechId && ZS.Game.getTechLevel ? ZS.Game.getTechLevel(reqTechId) : 1;
        const isTechLocked = !!(reqTechId && techLv <= 0 && el.classList.contains('locked'));
        const isElectric = !!(def.requiresPower || def.subType === 'power' || def.subType === 'turret');
        const tone = isElectric ? 'power' : isTechLocked ? 'rp' : def.category === 'decor' || def.cozy ? 'gold' : 'scrap';
        let foot = '';
        if (def.unlockedByBoss && !st.bossDefeated) {
          foot = '해금 조건: WAVE 5 보스 격파';
        } else if (isTechLocked && techDef) {
          const reqCost = ZS.Game.getTechCost ? ZS.Game.getTechCost(reqTechId) : techDef.costRp;
          foot = `필요 연구: ${techDef.name}${reqCost != null ? ` (${reqCost} RP)` : ''}`;
        }
        return {
          tone,
          html: renderPopoverHtml({
            title: def.name,
            kbd: hotkeyEl ? hotkeyEl.textContent.trim() : '',
            highlight: tagText,
            body: def.desc || '',
            foot
          })
        };
      }
    }

    return buildGenericFallbackSpec(el, rawFallback);
  }

  function findTooltipTarget(rawTarget, clientX, clientY) {
    if (rawTarget && rawTarget.nodeType === 1) {
      const hit = rawTarget.closest(TOOLTIP_TARGET_SELECTOR);
      if (hit && hit.id !== 'hud-popover') {
        const st = ZS.Game && ZS.Game.state;
        const isPrimaryCandidate =
          hit.id === 'hud-division-badge' ||
          hit.id === 'hud-hq-box' ||
          hit.id === 'cozy-pill' ||
          hit.classList.contains('power-pill') ||
          hit.classList.contains('res-cell') ||
          hit.classList.contains('item-card') ||
          hit.classList.contains('tab-btn') ||
          hit.tagName === 'BUTTON' ||
          hit.hasAttribute('data-pop-title') ||
          hit.hasAttribute('data-oz-title') ||
          hit.hasAttribute('title');
        if (isPrimaryCandidate && buildUnifiedTooltipSpec(hit, st)) {
          return hit;
        }
      }
      // Hit-test disabled <button disabled> inside container elements (browser skips pointer events on disabled buttons)
      const container = rawTarget.closest('.tl-view-row, .tr-controls-row, .day-cta-stack, .night-cta-stack, .detail-actions, .comp-actions, .detail-meta-row, .detail-action-row, .dock-tools, .settings-pop-list, #hud-top-left, #hud-top-right, #detail-bar, #build-dock, #bottom-right-cta');
      if (container) {
        const disabledBtns = container.querySelectorAll('button:disabled');
        for (let i = 0; i < disabledBtns.length; i++) {
          const btn = disabledBtns[i];
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
            return btn;
          }
        }
      }
    }
    return null;
  }

  function positionUnifiedPopover(popEl, anchorEl, spec) {
    const r = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const popW = popEl.offsetWidth;
    const popH = popEl.offsetHeight;
    const margin = 12;
    const gap = 10;

    let left;
    if (spec.align === 'left') {
      left = r.left;
    } else if (spec.align === 'right') {
      left = r.right - popW;
    } else {
      left = r.left + r.width / 2 - popW / 2;
    }
    left = Math.max(margin, Math.min(vw - popW - margin, left));

    const preferAbove = r.top + r.height / 2 > vh * 0.55;
    let top = preferAbove ? r.top - popH - gap : r.bottom + gap;
    if (preferAbove && top < margin) {
      top = Math.min(vh - popH - margin, r.bottom + gap);
    } else if (!preferAbove && top + popH > vh - margin) {
      top = Math.max(margin, r.top - popH - gap);
    }
    top = Math.max(margin, Math.min(vh - popH - margin, top));

    popEl.style.left = `${Math.round(left)}px`;
    popEl.style.top = `${Math.round(top)}px`;
  }

  function showUnifiedTooltip(anchorEl) {
    const popEl = document.getElementById('hud-popover');
    if (!popEl || !anchorEl) return;
    if (uiState.mainMenuOpen && !anchorEl.closest('#main-menu-overlay')) {
      hideUnifiedTooltip();
      return;
    }
    const st = ZS.Game && ZS.Game.state;
    const spec = buildUnifiedTooltipSpec(anchorEl, st);
    if (!spec || !spec.html) {
      hideUnifiedTooltip();
      return;
    }

    activeHoverAnchor = anchorEl;
    const cls = ['oz-popover', `tone-${spec.tone || 'scrap'}`];
    if (spec.wide) cls.push('wide');
    if (spec.compact) cls.push('compact');
    popEl.className = cls.join(' ');
    popEl.innerHTML = spec.html;
    popEl.setAttribute('aria-hidden', 'false');
    positionUnifiedPopover(popEl, anchorEl, spec);
    popEl.classList.add('visible');
  }

  function hideUnifiedTooltip() {
    activeHoverAnchor = null;
    const popEl = document.getElementById('hud-popover');
    if (!popEl) return;
    popEl.classList.remove('visible');
    popEl.classList.add('hidden');
    popEl.setAttribute('aria-hidden', 'true');
  }

  function initUnifiedTooltips() {
    sweepNativeTitles(document.body);
    if (tooltipsBound) return;
    tooltipsBound = true;

    if (typeof MutationObserver === 'function' && !tooltipObserver) {
      tooltipObserver = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === 'attributes' && m.attributeName === 'title') {
            harvestNativeTitle(m.target);
          } else if (m.type === 'childList' && m.addedNodes) {
            for (let j = 0; j < m.addedNodes.length; j++) {
              const node = m.addedNodes[j];
              if (node && node.nodeType === 1 && node.id !== 'hud-popover') {
                sweepNativeTitles(node);
              }
            }
          }
        }
      });
      tooltipObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['title']
      });
    }

    document.addEventListener('pointermove', (e) => {
      const target = findTooltipTarget(e.target, e.clientX, e.clientY);
      if (target) {
        if (target !== activeHoverAnchor || document.getElementById('hud-popover')?.classList.contains('hidden')) {
          showUnifiedTooltip(target);
        }
      } else if (activeHoverAnchor) {
        hideUnifiedTooltip();
      }
    }, true);

    document.addEventListener('focusin', (e) => {
      const target = findTooltipTarget(e.target, 0, 0);
      if (target && (target.matches(':focus-visible') || target.id === 'hud-division-badge')) {
        showUnifiedTooltip(target);
      }
    }, true);

    document.addEventListener('focusout', (e) => {
      if (activeHoverAnchor && e.target === activeHoverAnchor) {
        hideUnifiedTooltip();
      }
    }, true);

    document.addEventListener('pointerdown', hideUnifiedTooltip, true);
    document.addEventListener('scroll', hideUnifiedTooltip, true);
    document.addEventListener('keydown', hideUnifiedTooltip, true);
    window.addEventListener('blur', hideUnifiedTooltip);
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) hideUnifiedTooltip();
    });
  }

  Object.assign(U, {
    ozIcon,
    escapeHtml,
    formatInlineCostHtml,
    formatPowerSubText,
    syncNightPhaseAndPowerHud,
    syncDivisionBadge,
    syncUndergroundToggleButton,
    onLayerChanged,
    updateHud,
    updateCombatHud,
    renderReconCard,
    showInvasionAlert,
    showWaveBanner,
    isWaveReportModalOpen,
    openWaveReportModal,
    closeWaveReportModal,
    updateLiveNightNumbers,
    initUnifiedTooltips,
    hideUnifiedTooltip,
    initDebugToolbar
  });
})();
