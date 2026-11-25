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
    hudResCompact: false,
    mainMenuOpen: true,
    menuOptionsOpen: false,
    divisionModalOpen: false,
    selectedDivisionId: 'mobile_corps',
    lastPhase: null,
    pointerClient: { x: 0, y: 0, inside: false }
  };

  let bannerTimer = null;
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
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
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
    document.getElementById('res-power-sub').textContent = formatPowerSubText(st);
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

    let statusText = def.badgeTag || '표준 교리';
    let statusCls = 'active-gold';
    let badgeVariantCls = 'div-mobile';
    if (divId === 'iron_engineers') {
      badgeVariantCls = 'div-iron';
      statusText = '축성 +35% · 수리 12s';
      statusCls = 'active-heal';
    } else if (divId === 'nightwatch') {
      badgeVariantCls = 'div-nightwatch';
      if (isNight && blackout) {
        statusText = '야간 유격 활성';
        statusCls = 'active-heal';
      } else {
        statusText = 'XP ×2 · 정전 유격';
        statusCls = '';
      }
    } else if (divId === 'arc_tech') {
      badgeVariantCls = 'div-arc';
      if (arcActive) {
        statusText = 'ARC ≥70%';
        statusCls = 'arc-active';
      } else if (blackout) {
        statusText = '정전 대기';
        statusCls = 'warn-dim';
      } else {
        statusText = `ARC <70% (${pwrPct}%)`;
        statusCls = 'warn-dim';
      }
    }

    badgeEl.className = `hud-division-badge ${badgeVariantCls}`;
    const iconEl = document.getElementById('hud-div-icon');
    const nameEl = document.getElementById('hud-div-name');
    const statusEl = document.getElementById('hud-div-status');
    if (iconEl) iconEl.innerHTML = ozIcon(def.iconId || 'div-mobile', 15);
    if (nameEl) nameEl.textContent = def.name || divId;
    if (statusEl) {
      statusEl.className = `div-badge-status${statusCls ? ' ' + statusCls : ''}`;
      statusEl.textContent = statusText;
    }

    const prosList = Array.isArray(def.pros) ? def.pros : [];
    const consList = Array.isArray(def.cons) ? def.cons : [];
    const titleLines = [
      `${def.name} (${def.subtitle || ''})`,
      ...prosList.map((p) => `+ ${p}`),
      ...consList.map((c) => `- ${c}`)
    ];
    badgeEl.title = titleLines.join('\n');

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

  function syncWindLayerButton(st) {
    const btn = document.getElementById('btn-toggle-wind-layer');
    if (!btn || !st) return;
    const isUg = st.activeLayer === 'underground';
    const on = !isUg && !!st.showWindOverlay;
    btn.disabled = isUg;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = isUg
      ? '지상 레이어에서만 강풍 오버레이를 사용할 수 있습니다.'
      : '강풍 지대(주변 +40% / 중심 +70%) 오버레이 레이어 표시/숨기기 (단축키 V)';
  }

  function syncUndergroundToggleButton(st) {
    const btn = document.getElementById('btn-toggle-underground');
    if (!btn || !st) return;
    const unlocked = (st.hqLevel || 1) >= 2 && !!st.undergroundUnlocked;
    const isDay = st.phase === 'day';
    const isUg = st.activeLayer === 'underground';
    btn.disabled = !unlocked || !isDay;
    btn.classList.toggle('b1-locked-unlock', !unlocked);
    btn.classList.toggle('b1-unlocked-pulse', unlocked && isDay && !isUg);
    btn.classList.toggle('active', isUg);
    btn.setAttribute('aria-pressed', isUg ? 'true' : 'false');

    const lblEl = document.getElementById('btn-b1-label');
    if (lblEl) {
      lblEl.textContent = isUg ? '지상 복귀 [B]' : '지하 B1 [B]';
    }
    const apChip = document.getElementById('hud-dig-ap-chip');
    if (apChip) {
      apChip.textContent = unlocked ? `${Math.floor(st.digAp || 0)} AP` : 'Lv.2';
    }
    const lv2Wave = ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(2) : 10;
    btn.title = !unlocked
      ? (st.wave || 1) >= lv2Wave
        ? '지하 쉘터 B1: 먼저 중앙 지휘 본부를 Lv.2로 증축하세요!'
        : `지하 쉘터 B1: WAVE ${lv2Wave} 도달 후 지휘 본부 Lv.2 증축 시 개방`
      : !isDay
      ? '야간 방어 중에는 지하로 이동할 수 없습니다 (주간 전용)'
      : isUg
      ? '지상 본부 레이어로 복귀 (단축키 B)'
      : `지하 B1 쉘터로 이동 (보유 ${Math.floor(st.digAp || 0)}/${st.digApCap || 24} AP · 단축키 B)`;
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

    if (st.phase !== 'night') {
      syncNightPhaseAndPowerHud(st);
    }

    // Population (3-job) & Research Points (RP) display
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const popEl = document.getElementById('res-pop');
    if (popEl) {
      popEl.innerHTML = `${st.agents}/${st.popCap} <span class="pop-cap">(전${jobs.combat} 연${jobs.research} 생${jobs.prod})</span>`;
    }
    const popPillEl = document.getElementById('pop-pill');
    if (popPillEl) {
      popPillEl.title = `작전 요원 ${st.agents}/${st.popCap}명 (초소 배치 ${st.popUsed}/${jobs.combat} · 연구 ${jobs.research} · 생산 ${jobs.prod}) — 클릭하여 직무 분배 [T]`;
    }
    const rpEl = document.getElementById('res-rp');
    if (rpEl) {
      rpEl.textContent = `${Math.floor(st.rp || 0)} RP`;
    }
    const rpPillEl = document.getElementById('rp-pill');
    if (rpPillEl) {
      rpPillEl.title = `연구포인트(RP) · 현재 본부 Lv.${st.hqLevel || 1} 연구 티어 인가 (잔여 RP는 상위 본부 증축 시까지 누적 이월 — 클릭해 연구창 [T])`;
    }

    // Cozy Morale Lv.1~8 display, 8-segment bar, heart stroke scaling & table tooltip (dirty-memoized)
    const tier = st.cozyTier;
    const tiers = ZS.DATA.COZY_TIERS || [];
    document.getElementById('res-cozy').textContent = `Lv.${tier.level}`;

    const cozyPillEl = document.getElementById('cozy-pill');
    if (cozyPillEl && st.cozyPulseSeq && st.cozyPulseSeq !== lastCozyPulseSeq) {
      lastCozyPulseSeq = st.cozyPulseSeq;
      cozyPillEl.classList.remove('tier-up-pulse');
      if (cozyPillEl.offsetWidth !== undefined) {
        // Trigger reflow only when a cozy tier-up pulse occurs
      }
      cozyPillEl.classList.add('tier-up-pulse');
    }

    const cozySig = `${st.cozyScore}|${st.cozyFloorRaw || 0}|${st.cozyStructScore || 0}|${st.cozySynergyScore || 0}|${st.cozyDiversityBonus || 0}|${tier.level}`;
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

      const floorCap = ZS.DATA.COZY_FLOOR_CAP || 60;
      const rowsHtml = tiers
        .map(
          (t) => `
          <tr class="${t.level === tier.level ? 'current-tier' : ''}">
            <td>Lv.${t.level}</td>
            <td>${escapeHtml(t.title)}</td>
            <td>${t.min}</td>
            <td>+${Math.round(t.agentDmg * 100)}%</td>
            <td>+${Math.round(t.fireRate * 100)}%</td>
            <td>+${Math.round(t.coinBonus * 100)}%</td>
            <td>+${Math.round((t.xpBonus || 0) * 100)}%</td>
            <td>${Math.round(t.freeRepair * 100)}%</td>
          </tr>`
        )
        .join('');

      document.getElementById('cozy-tooltip').innerHTML = `
        <div class="cozy-popover-head">
          <span class="inline-icon-text" style="font-weight:800;color:${P.gold};">${ozIcon('res-cozy', 15, 'icon-coin')}<span>${escapeHtml(tier.title)} (Lv.${tier.level})</span></span>
          <span style="font-size:12px;color:#e6eef7;">총 <b>${st.cozyScore}점</b></span>
        </div>
        <div class="cozy-popover-meta">
          바닥재 ${st.cozyFloorScore || 0}/${floorCap}점${(st.cozyFloorRaw || 0) >= floorCap ? ' (상한)' : ''} · 구조물 ${st.cozyStructScore || 0}점${st.cozySynergyScore ? ` · 라운지 +${st.cozySynergyScore}` : ''} · 다양성 <span style="color:${P.gold}">+${st.cozyDiversityBonus}</span>
        </div>
        <table class="cozy-table">
          <thead>
            <tr>
              <th>등급</th>
              <th>타이틀</th>
              <th>요구</th>
              <th>요원화력</th>
              <th>연사</th>
              <th>코인</th>
              <th>숙련XP</th>
              <th>수리</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${
          nextTier
            ? `<div class="cozy-popover-foot">다음 등급(Lv.${nextTier.level})까지 <b>${nextTier.min - st.cozyScore}점</b> 필요</div>`
            : `<div class="cozy-popover-foot" style="color:${P.gold};">★ 최고 안락함 등급(Lv.8) 달성!</div>`
        }
      `;
    }

    // Auto-collapse build dock & compact secondary HUD at Night start; auto-expand at Dawn (#10)
    if (st.phase !== uiState.lastPhase) {
      if (st.phase === 'night') {
        uiState.dockCollapsed = true;
        uiState.hudResCompact = true;
      } else if (st.phase === 'day') {
        uiState.dockCollapsed = false;
        uiState.hudResCompact = false;
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
        repLbl.innerHTML = repParts.join('');
        repLbl.classList.remove('hidden');
        repBtn.title = `기지 일괄 정비 (${titleParts.join(' · ')})`;
      } else {
        repLbl.textContent = '모든 시설 내구도 100%';
        repLbl.classList.add('hidden');
        repBtn.title = '기지 일괄 정비 — 모든 시설 내구도 100%';
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
    const techModal = document.getElementById('tech-pop-modal');
    if (techModal && !techModal.classList.contains('hidden') && U.renderTechPopModal) {
      U.renderTechPopModal();
    }
    U.updateCursorTooltip();
  }

  function renderReconCard(st) {
    const el = document.getElementById('recon-card');
    if (!el) return;
    const intel = st && st.nextWaveIntel;
    if (!intel || st.phase !== 'day') {
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

    el.style.display = 'block';
    const isBossWave = intel.bossSide != null || (intel.counts && intel.counts.boss > 0);
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

    const mainSides = [];
    const subSides = [];
    for (let sd = 0; sd < 4; sd++) {
      if (kinds[sd] === 'main' || kinds[sd] === 'boss') mainSides.push(SIDE_NAMES[sd]);
      else if (kinds[sd] === 'sub') subSides.push(SIDE_NAMES[sd]);
    }

    let patTitle = intel.patternLabel || '침공 경보';
    let patDesc = '';
    if (intel.pattern === 'single') {
      patTitle = `${mainSides[0] || '북동'} 정면 침공`;
      patDesc = '1개 방위 100% 집중 돌파';
    } else if (intel.pattern === 'flank') {
      patTitle = `${mainSides[0] || ''}·${subSides[0] || ''} 측면`;
      patDesc = `주력 ${mainSides[0] || ''} 75% · 견제 ${subSides[0] || ''} 25%`;
    } else if (intel.pattern === 'dual') {
      patTitle = `${mainSides.join('·')} 협공`;
      patDesc = '주공 2면 각 45% · 기습 10%';
    } else {
      patTitle = '전방위 포위';
      patDesc = `주공 ${mainSides.join('·')} 35% · 보조 15%`;
    }

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

    const waveBadge = String(intel.wave).padStart(2, '0');
    el.innerHTML = `
      <div class="recon-head">
        <span class="recon-title">${ozIcon('recon-compass', 15)}<span>정찰 레이더 · W${waveBadge}</span></span>
        <button id="btn-toggle-recon-paths" type="button" class="recon-toggle${showPaths ? ' on' : ''}" title="${showPaths ? '예상 경로선 숨기기' : '예상 경로선 표시'}">${ozIcon('recon-route', 15)}</button>
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
      <div class="recon-pat">${escapeHtml(patTitle)}<small>${escapeHtml(patDesc)}</small></div>
      <div class="recon-chips">${chipsHtml}</div>
      ${bossRowHtml}
      <div class="recon-foot">
        <span class="recon-total-badge">${ozIcon('hud-enemy', 15, 'icon-danger')}<strong>×${intel.totalCount || 0}</strong></span>
        <span class="recon-route-stat">${showPaths ? `경로 ${pathLen} · 공성 ${breachLen}` : '경로선 숨김'}</span>
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
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const nextPopSig = `${st.popUsed}/${st.agents}/${st.popCap}/${jobs.combat}/${jobs.research}/${jobs.prod}/${Math.floor(st.rp || 0)}`;
    if (nextPopSig !== lastPopSig) {
      lastPopSig = nextPopSig;
      const popEl = document.getElementById('res-pop');
      if (popEl) {
        popEl.innerHTML = `${st.agents}/${st.popCap} <span class="pop-cap">(전${jobs.combat} 연${jobs.research} 생${jobs.prod})</span>`;
      }
      const rpEl = document.getElementById('res-rp');
      if (rpEl) {
        rpEl.textContent = `${Math.floor(st.rp || 0)} RP`;
      }
      const techModal = document.getElementById('tech-pop-modal');
      if (techModal && !techModal.classList.contains('hidden') && U.renderTechPopModal) {
        U.renderTechPopModal();
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

    const rBtn = document.getElementById('btn-skill-repair');
    rBtn.disabled = st.skills.repairCd > 0;
    document.getElementById('skill-repair-cd').textContent =
      st.skills.repairCd > 0 ? `재충전 중 (${Math.ceil(st.skills.repairCd)}초)` : `즉시 전체 시설 +95 HP (${st.skills.repairMaxCd || 18}초)`;

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
    showWaveBanner,
    updateLiveNightNumbers,
    initDebugToolbar
  });
})();
