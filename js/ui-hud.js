window.ZS = window.ZS || {};

(function () {
  const uiState = {
    activeCategory: 'defense',
    mode: 'inspect', // 'inspect' | 'build' | 'move' | 'remove'
    selectedItemId: null,
    hoverTile: null,
    inspectedTile: null,
    movingSource: null,
    activeSkill: null, // null | 'airstrike'
    dockCollapsed: false,
    hudResCompact: false,
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

  function updateHud() {
    const st = ZS.Game.state;
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

    // Population display
    document.getElementById('res-pop').innerHTML = `${st.popUsed} / ${st.agents} <span class="pop-cap">(숙소 ${st.popCap})</span>`;

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
      const startBtn = document.getElementById('btn-start-wave');
      if (startBtn) startBtn.classList.toggle('boss-wave', st.wave % 5 === 0);
      document.getElementById('cta-wave-sub').innerHTML =
        st.wave % 5 === 0
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

    // 4x4 internal isometric radar grid lines
    const gridLines = [1, 2, 3]
      .map((step) => {
        const u = step / 4;
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
    const nextPopSig = `${st.popUsed}/${st.agents}/${st.popCap}`;
    if (nextPopSig !== lastPopSig) {
      lastPopSig = nextPopSig;
      document.getElementById('res-pop').innerHTML = `${st.popUsed} / ${st.agents} <span class="pop-cap">(숙소 ${st.popCap})</span>`;
    }
    document.getElementById('res-cozy').textContent = `Lv.${st.cozyTier.level}`;

    syncNightPhaseAndPowerHud(st);

    const left = st.spawnQueue.length + st.zombies.length;
    document.getElementById('hud-enemies-left').textContent = `${left}기`;
    document.getElementById('speed-label').textContent = `${st.gameSpeed}x`;

    const rBtn = document.getElementById('btn-skill-repair');
    rBtn.disabled = st.skills.repairCd > 0;
    document.getElementById('skill-repair-cd').textContent =
      st.skills.repairCd > 0 ? `재충전 중 (${Math.ceil(st.skills.repairCd)}초)` : '즉시 전체 시설 +95 HP';

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
        <button id="btn-dbg-pwr" class="debug-btn" title="배터리 전력 완충 / 방전(0) 토글">${ozIcon('res-power', 13, 'icon-power')}<span>전력 완충/방전</span></button>
        <button id="btn-dbg-pop" class="debug-btn" title="가용 요원 및 임시 숙소 수용량 +2">${ozIcon('res-agent', 13)}<span>요원 +2</span></button>
        <button id="btn-dbg-wave1" class="debug-btn" title="주간 정비 상태에서 웨이브 +1">${ozIcon('act-speed', 13)}<span>웨이브 +1</span></button>
        <button id="btn-dbg-wave5" class="debug-btn" title="주간 정비 상태에서 웨이브 +5 (보스전 등)">${ozIcon('act-speed', 13)}<span>+5</span></button>
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
    bind('btn-dbg-pwr', () => ZS.Game.debugTogglePower());
    bind('btn-dbg-pop', () => ZS.Game.debugAddAgents(2));
    bind('btn-dbg-wave1', () => ZS.Game.debugAdvanceWave(1));
    bind('btn-dbg-wave5', () => ZS.Game.debugAdvanceWave(5));
    bind('btn-dbg-xp', () => {
      const sel = uiState.inspectedTile;
      if (sel) {
        ZS.Game.debugGrantSelectedXp(sel.tx, sel.ty, 20);
      } else {
        ZS.Game.debugGrantSelectedXp(-1, -1, 20);
      }
    });
  }

  Object.assign(U, {
    ozIcon,
    escapeHtml,
    formatInlineCostHtml,
    formatPowerSubText,
    syncNightPhaseAndPowerHud,
    updateHud,
    updateCombatHud,
    renderReconCard,
    showWaveBanner,
    updateLiveNightNumbers,
    initDebugToolbar
  });
})();
