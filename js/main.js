window.ZS = window.ZS || {};

(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const U = ZS._UI;
  const { uiState, ozIcon, escapeHtml, formatInlineCostHtml } = U;

  const keys = {};
  let isPanning = false;
  let isLeftPainting = false;
  let lastPaintKey = '';
  let panStart = { x: 0, y: 0 };
  let pendingConfirmAction = null;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ZS.Iso.setViewport(w, h);
  }

  // ================= SAVE SUMMARY & TITLE MAIN MENU (#65) =================
  function getSavedOperationInfo() {
    try {
      const saveKey = ZS.Game.getSaveKey ? ZS.Game.getSaveKey() : 'outpost_zero_save_v1';
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(saveKey) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.phase === 'gameover') return null;
      const waveNum = Number(parsed.wave);
      if (!Number.isFinite(waveNum) || waveNum < 1) return null;
      if (!Array.isArray(parsed.structGrid) || !Array.isArray(parsed.floorGrid)) return null;
      const savedN = parsed.structGrid.length;
      const N = ZS.DATA.GRID_SIZE;
      if (savedN !== N && savedN !== 22 && savedN !== 18) return null;
      const hqLv = Math.max(1, Math.min(5, Number(parsed.hqLevel) || 1));
      const phaseLabel = parsed.phase === 'night' ? '야간 방어' : '주간 정비';
      const wavePad = String(Math.floor(waveNum)).padStart(2, '0');
      const divId = (parsed.divisionId && ZS.DATA.DIVISIONS && ZS.DATA.DIVISIONS[parsed.divisionId])
        ? parsed.divisionId
        : 'mobile_corps';
      const divDef = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef(divId) : null;
      const divLabel = divDef ? ` · ${divDef.name}` : '';
      return {
        wave: Math.floor(waveNum),
        wavePad,
        hqLevel: hqLv,
        divisionId: divId,
        phase: parsed.phase || 'day',
        phaseLabel,
        summaryText: `WAVE ${wavePad}${divLabel} · ${phaseLabel} · 본부 Lv.${hqLv}`
      };
    } catch (e) {
      return null;
    }
  }

  function isConfirmModalOpen() {
    const modal = document.getElementById('confirm-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function isDivisionModalOpen() {
    const modal = document.getElementById('division-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function isTechModalOpen() {
    return !!(U.isAnyPopTechModalOpen && U.isAnyPopTechModalOpen());
  }

  function isGameOverModalOpen() {
    const modal = document.getElementById('gameover-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function renderGameOverModal() {
    const st = ZS.Game.state;
    if (!st) return;

    const divDef = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef(st.divisionId) : null;
    const divName = (divDef && divDef.name) || '기동방위대';
    const divIconId = (divDef && divDef.iconId) || 'div-mobile';
    const divIconCls = divDef && divDef.isElectricDivision ? 'icon-power' : 'icon-coin';
    const waveNum = Math.max(1, Math.floor(Number(st.wave) || 1));
    const wavePad = String(waveNum).padStart(2, '0');
    const prevBest = Number(st.gameOverPrevBestWave) || 0;
    const isNewBest = waveNum > prevBest && waveNum >= 2;
    const totalKills = Math.max(0, Math.floor(Number(st.totalKills) || 0));
    const cozyLv = (st.cozyTier && st.cozyTier.level) || 1;
    const cozyTitle = (st.cozyTier && st.cozyTier.title) || '임시 전초기지';
    const researchedCount = st.researchedTechs ? Object.keys(st.researchedTechs).length : 0;

    const subEl = document.getElementById('gameover-modal-sub');
    if (subEl) {
      subEl.textContent = `WAVE ${wavePad} 야간 방어전 중 지휘 본부가 함락되어 전초기지 통신이 두절되었습니다.`;
    }

    const unlockBox = document.getElementById('gameover-unlock-box');
    const unlocked = Array.isArray(st.gameOverUnlockedDivisions) ? st.gameOverUnlockedDivisions : [];
    if (unlockBox) {
      if (unlocked.length > 0) {
        unlockBox.innerHTML = `${ozIcon('state-rank', 16, 'icon-coin')}<span>이번 작전 신규 해금 분과: <b>${escapeHtml(unlocked.join(', '))}</b></span>`;
        unlockBox.classList.remove('hidden');
      } else {
        unlockBox.innerHTML = '';
        unlockBox.classList.add('hidden');
      }
    }

    const gridEl = document.getElementById('gameover-stats-grid');
    if (gridEl) {
      const bestPill = isNewBest ? '<span class="gameover-best-pill">최고 기록</span>' : '';
      const cells = [
        {
          icon: 'phase-night',
          iconCls: 'icon-danger',
          label: '도달 웨이브',
          valHtml: `<span class="gameover-stat-val">WAVE ${wavePad}</span>${bestPill}`
        },
        {
          icon: divIconId,
          iconCls: divIconCls,
          label: '지휘 분과 · 본부',
          valHtml: `<span class="gameover-stat-val">${escapeHtml(divName)} · Lv.${st.hqLevel || 1}</span>`
        },
        {
          icon: 'hud-enemy',
          iconCls: 'icon-danger',
          label: '총 격파 감염체',
          valHtml: `<span class="gameover-stat-val">${totalKills}기</span>`
        },
        {
          icon: 'res-agent',
          iconCls: '',
          label: '생존 인원 · 상한',
          valHtml: `<span class="gameover-stat-val">${st.agents || 0} / ${st.popCap || 4}명</span>`
        },
        {
          icon: 'res-cozy',
          iconCls: 'icon-coin',
          label: '최종 안락함',
          valHtml: `<span class="gameover-stat-val">Lv.${cozyLv} · ${escapeHtml(cozyTitle)}</span>`
        },
        {
          icon: 'res-rp',
          iconCls: 'icon-rp',
          label: '완료 연구 · 잔여 RP',
          valHtml: `<span class="gameover-stat-val">${researchedCount}건 · ${Math.floor(st.rp || 0)} RP</span>`
        }
      ];
      gridEl.innerHTML = cells
        .map(
          (c) => `
          <div class="gameover-stat-cell">
            <span class="gameover-stat-label">${ozIcon(c.icon, 13, c.iconCls)}<span>${escapeHtml(c.label)}</span></span>
            <div class="gameover-stat-val-row">${c.valHtml}</div>
          </div>`
        )
        .join('');
    }
  }

  function closeGameOverModal() {
    const modal = document.getElementById('gameover-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openGameOverModal() {
    const modal = document.getElementById('gameover-modal');
    if (!modal) return;
    isPanning = false;
    isLeftPainting = false;
    uiState.hoverTile = null;
    uiState.inspectedTile = null;
    uiState.movingSource = null;
    uiState.activeSkill = null;
    uiState.hoverB1DoorEdge = null;
    document.getElementById('btn-skill-airstrike')?.classList.remove('targeting');
    document.getElementById('trader-modal')?.classList.add('hidden');
    document.getElementById('guide-modal')?.classList.add('hidden');
    document.getElementById('settings-popover')?.classList.add('hidden');
    document.getElementById('wave-banner')?.classList.add('hidden');
    closeConfirmModal();
    if (U.closeTechPopModal) U.closeTechPopModal();
    if (U.setToolMode) U.setToolMode('inspect');
    if (U.updateCursorTooltip) U.updateCursorTooltip();
    renderGameOverModal();
    modal.classList.remove('hidden');
  }

  function closeDivisionModal() {
    const modal = document.getElementById('division-modal');
    if (modal) modal.classList.add('hidden');
    uiState.divisionModalOpen = false;
    if (ZS.Game && ZS.Game.state && ZS.Game.state.phase === 'gameover' && !uiState.mainMenuOpen) {
      openGameOverModal();
    }
  }

  function getDivisionClassSuffix(divId) {
    if (divId === 'iron_engineers') return 'iron';
    if (divId === 'nightwatch') return 'nightwatch';
    if (divId === 'arc_tech') return 'arc';
    return 'mobile';
  }

  function renderDivisionModal(lockedNoticeDivId) {
    const grid = document.getElementById('division-cards');
    const summaryEl = document.getElementById('division-modal-summary');
    const confirmBtn = document.getElementById('btn-division-confirm');
    if (!grid) return;

    const divs = ZS.DATA.DIVISIONS || {};
    const order = ZS.DATA.DIVISION_ORDER || Object.keys(divs);
    const meta = ZS.Game.getCommanderMeta ? ZS.Game.getCommanderMeta() : { divisions: {}, lastDivisionId: 'mobile_corps' };

    if (!uiState.selectedDivisionId || !divs[uiState.selectedDivisionId] || !(ZS.Game.isDivisionUnlocked && ZS.Game.isDivisionUnlocked(uiState.selectedDivisionId))) {
      const fallback = meta.lastDivisionId && ZS.Game.isDivisionUnlocked && ZS.Game.isDivisionUnlocked(meta.lastDivisionId)
        ? meta.lastDivisionId
        : 'mobile_corps';
      uiState.selectedDivisionId = fallback;
    }

    grid.innerHTML = order
      .map((divId) => {
        const def = divs[divId];
        if (!def) return '';
        const rec = (meta.divisions && meta.divisions[divId]) || {};
        const unlocked = ZS.Game.isDivisionUnlocked ? ZS.Game.isDivisionUnlocked(divId) : !!def.unlockedByDefault;
        const selected = unlocked && uiState.selectedDivisionId === divId;
        const bestWave = Math.max(0, Number(rec.bestWave) || 0);
        const cleared = !!rec.cleared;
        const clsSuffix = getDivisionClassSuffix(divId);

        const statePill = unlocked
          ? selected
            ? `<span class="div-pill state-selected">선택됨</span>`
            : `<span class="div-pill state-ready">출격 가능</span>`
          : `<span class="div-pill state-locked">${ozIcon('state-lock', 12)}<span>미해금</span></span>`;

        const bestPill = bestWave > 0
          ? `<span class="div-pill meta-best">BEST W${String(bestWave).padStart(2, '0')}</span>`
          : `<span class="div-pill meta-best">기록 없음</span>`;

        const clearPill = cleared
          ? `<span class="div-pill meta-clear">${ozIcon('state-rank', 12)}<span>CLEAR</span></span>`
          : '';

        const unlockHtml = !unlocked
          ? `<div class="div-unlock-box">${ozIcon('state-lock', 14, 'icon-danger')}<span>해금 조건: ${escapeHtml(def.unlockHint || '특수 조건 달성')}</span></div>`
          : '';

        const prosHtml = (def.pros || [])
          .map((line) => `<div class="div-trait pro"><span class="div-trait-sign">+</span><span>${escapeHtml(line)}</span></div>`)
          .join('');
        const consHtml = (def.cons || [])
          .map((line) => `<div class="div-trait ${def.hasPenalty === false ? 'neutral' : 'con'}"><span class="div-trait-sign">${def.hasPenalty === false ? '·' : '-'}</span><span>${escapeHtml(line)}</span></div>`)
          .join('');

        return `
          <button
            type="button"
            class="division-card div-${clsSuffix}${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}"
            data-division-id="${escapeHtml(divId)}"
            role="radio"
            aria-checked="${selected ? 'true' : 'false'}"
            aria-disabled="${unlocked ? 'false' : 'true'}"
          >
            <div class="div-card-top">
              <div class="div-card-head">
                <span class="div-card-emblem">${ozIcon(def.iconId || 'div-mobile', 24)}</span>
                <div class="div-card-titles">
                  <div class="div-card-name">${escapeHtml(def.name)}</div>
                  <div class="div-card-sub">${escapeHtml(def.subtitle || '')}</div>
                </div>
              </div>
              <div class="div-card-badges">
                ${statePill}
                ${bestPill}
                ${clearPill}
              </div>
              ${unlockHtml}
            </div>
            <div class="div-card-lists">
              <div class="div-trait-list">${prosHtml}</div>
              <div class="div-trait-list">${consHtml}</div>
            </div>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('.division-card').forEach((cardBtn) => {
      cardBtn.addEventListener('click', () => {
        const divId = cardBtn.getAttribute('data-division-id');
        if (!divId) return;
        const ok = ZS.Game.isDivisionUnlocked ? ZS.Game.isDivisionUnlocked(divId) : false;
        if (!ok) {
          ZS.Audio.playError();
          renderDivisionModal(divId);
          return;
        }
        uiState.selectedDivisionId = divId;
        renderDivisionModal();
      });
    });

    const selDef = divs[uiState.selectedDivisionId] || divs.mobile_corps;
    if (summaryEl) {
      if (lockedNoticeDivId && divs[lockedNoticeDivId]) {
        const lDef = divs[lockedNoticeDivId];
        summaryEl.className = 'division-foot-summary warn';
        summaryEl.innerHTML = `${ozIcon('state-lock', 16, 'icon-danger')}<span>[${escapeHtml(lDef.name)}] 미해금 — ${escapeHtml(lDef.unlockHint || '')}</span>`;
      } else if (selDef) {
        summaryEl.className = 'division-foot-summary';
        summaryEl.innerHTML = `${ozIcon(selDef.iconId || 'div-mobile', 18, selDef.isElectricDivision ? 'icon-power' : 'icon-coin')}<span>선택 분과: <b>${escapeHtml(selDef.name)}</b> — ${escapeHtml(selDef.subtitle || '')}</span>`;
      }
    }
    if (confirmBtn) {
      confirmBtn.disabled = !(selDef && ZS.Game.isDivisionUnlocked && ZS.Game.isDivisionUnlocked(selDef.id));
    }
  }

  function openDivisionModal() {
    const modal = document.getElementById('division-modal');
    if (!modal) {
      executeStartNewOperation('mobile_corps');
      return;
    }
    const meta = ZS.Game.getCommanderMeta ? ZS.Game.getCommanderMeta() : null;
    if (meta && meta.lastDivisionId && ZS.Game.isDivisionUnlocked && ZS.Game.isDivisionUnlocked(meta.lastDivisionId)) {
      uiState.selectedDivisionId = meta.lastDivisionId;
    } else if (!uiState.selectedDivisionId || !(ZS.Game.isDivisionUnlocked && ZS.Game.isDivisionUnlocked(uiState.selectedDivisionId))) {
      uiState.selectedDivisionId = 'mobile_corps';
    }
    renderDivisionModal();
    uiState.divisionModalOpen = true;
    modal.classList.remove('hidden');
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    pendingConfirmAction = null;
  }

  function openConfirmModal(opts) {
    const o = opts || {};
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      if (typeof o.onAccept === 'function') o.onAccept();
      return;
    }
    const titleEl = document.getElementById('confirm-modal-title');
    const descEl = document.getElementById('confirm-modal-desc');
    const acceptLabelEl = document.getElementById('confirm-accept-label');
    if (titleEl) titleEl.textContent = o.title || '새 작전 개시 확인';
    if (descEl) descEl.textContent = o.desc || '현재 진행 중인 작전을 초기화하고 WAVE 01부터 새 작전을 시작할까요?';
    if (acceptLabelEl) acceptLabelEl.textContent = o.acceptText || '새 작전 개시';
    pendingConfirmAction = typeof o.onAccept === 'function' ? o.onAccept : null;
    modal.classList.remove('hidden');
  }

  function setMenuOptionsOpen(open) {
    uiState.menuOptionsOpen = !!open;
    const drawer = document.getElementById('menu-options-drawer');
    const btn = document.getElementById('btn-menu-options');
    if (drawer) drawer.classList.toggle('hidden', !uiState.menuOptionsOpen);
    if (btn) {
      btn.setAttribute('aria-expanded', uiState.menuOptionsOpen ? 'true' : 'false');
      btn.classList.toggle('active', uiState.menuOptionsOpen);
    }
  }

  function syncSettingsButtons() {
    const muted = ZS.Audio.isMuted ? ZS.Audio.isMuted() : false;
    const soundHtml = `${ozIcon(muted ? 'sys-sound-off' : 'sys-sound-on', 16)}<span>${muted ? '효과음 꺼짐' : '효과음 켜짐'}</span>`;
    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.innerHTML = soundHtml;
      soundBtn.classList.toggle('toggle-off', !!muted);
    }
    const menuSoundBtn = document.getElementById('btn-menu-sound');
    if (menuSoundBtn) {
      menuSoundBtn.innerHTML = soundHtml;
      menuSoundBtn.classList.toggle('toggle-off', !!muted);
    }

    const shakeOn = ZS.Game.isScreenShakeEnabled ? ZS.Game.isScreenShakeEnabled() : true;
    const shakeHtml = `${ozIcon(shakeOn ? 'sys-shake-on' : 'sys-shake-off', 16)}<span>${shakeOn ? '화면 흔들림 ON' : '화면 흔들림 OFF'}</span>`;
    const shakeBtn = document.getElementById('btn-shake');
    if (shakeBtn) {
      shakeBtn.innerHTML = shakeHtml;
      shakeBtn.classList.toggle('toggle-off', !shakeOn);
    }
    const menuShakeBtn = document.getElementById('btn-menu-shake');
    if (menuShakeBtn) {
      menuShakeBtn.innerHTML = shakeHtml;
      menuShakeBtn.classList.toggle('toggle-off', !shakeOn);
    }
  }

  function refreshMainMenuState() {
    const info = getSavedOperationInfo();
    const contBtn = document.getElementById('btn-menu-continue');
    const contSub = document.getElementById('menu-continue-sub');
    const newBtn = document.getElementById('btn-menu-new');
    const newSub = document.getElementById('menu-new-sub');

    if (info) {
      if (contBtn) {
        contBtn.disabled = false;
        contBtn.classList.add('primary-gold');
      }
      if (contSub) contSub.textContent = info.summaryText;
      if (newBtn) newBtn.classList.remove('primary-gold');
      if (newSub) newSub.textContent = '기존 작전을 초기화하고 WAVE 01부터 새로 지휘';
    } else {
      if (contBtn) {
        contBtn.disabled = true;
        contBtn.classList.remove('primary-gold');
      }
      if (contSub) contSub.textContent = '저장된 작전 기록 없음';
      if (newBtn) newBtn.classList.add('primary-gold');
      if (newSub) newSub.textContent = 'WAVE 01부터 새로운 전초기지 지휘 개시';
    }
    syncSettingsButtons();
  }

  function setMainMenuOpen(open) {
    const flag = !!open;
    uiState.mainMenuOpen = flag;
    document.body.classList.toggle('main-menu-active', flag);
    const menuEl = document.getElementById('main-menu');
    if (menuEl) menuEl.classList.toggle('hidden', !flag);

    if (flag) {
      isPanning = false;
      isLeftPainting = false;
      Object.keys(keys).forEach((k) => {
        keys[k] = false;
      });
      uiState.hoverTile = null;
      uiState.inspectedTile = null;
      uiState.movingSource = null;
      uiState.activeSkill = null;
      uiState.pointerClient.inside = false;
      closeConfirmModal();
      closeGameOverModal();
      document.getElementById('btn-skill-airstrike')?.classList.remove('targeting');
      document.getElementById('trader-modal')?.classList.add('hidden');
      if (U.closeTechPopModal) U.closeTechPopModal();
      U.updateCursorTooltip();
      refreshMainMenuState();
    } else {
      setMenuOptionsOpen(false);
      U.updateHud();
    }
  }

  function resumeSavedOperation() {
    const info = getSavedOperationInfo();
    if (!info) return;
    if (ZS.Game.state.phase === 'gameover') {
      ZS.Game.loadGame();
    }
    closeGameOverModal();
    uiState.inspectedTile = null;
    U.setToolMode('inspect');
    ZS.Iso.resetCamera();
    setMainMenuOpen(false);
    if (ZS.Audio.playBuild) ZS.Audio.playBuild();
  }

  function executeStartNewOperation(divId) {
    let chosenId = divId || uiState.selectedDivisionId || 'mobile_corps';
    if (ZS.Game.isDivisionUnlocked && !ZS.Game.isDivisionUnlocked(chosenId)) {
      chosenId = 'mobile_corps';
    }
    if (ZS.Game.setLastSelectedDivision) {
      ZS.Game.setLastSelectedDivision(chosenId);
    }
    closeDivisionModal();
    closeConfirmModal();
    closeGameOverModal();
    uiState.inspectedTile = null;
    U.setToolMode('inspect');
    ZS.Iso.resetCamera();
    setMainMenuOpen(false);
    ZS.Game.clearSaveAndReset(chosenId);
    const divDef = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef(chosenId) : null;
    U.showWaveBanner(
      `${divDef ? divDef.name : '전초기지'} 지휘권 인수 완료`,
      '낮 동안 방어선·발전기·모던 쉘터를 구축하고 [웨이브 시작]을 눌러 야간 방어에 돌입하세요!',
      'info'
    );
    if (ZS.Audio.playBuild) ZS.Audio.playBuild();
  }

  function beginNewOperationFlow() {
    const info = getSavedOperationInfo();
    if (!info) {
      openDivisionModal();
      return;
    }
    openConfirmModal({
      title: '새 작전 개시 확인',
      desc: `현재 진행 중인 작전(WAVE ${info.wavePad})을 초기화하고 WAVE 01부터 새 작전을 시작할까요?`,
      acceptText: '분과 선택',
      onAccept: openDivisionModal
    });
  }

  function returnToTitleMenu() {
    const st = ZS.Game.state;
    const saveFn = ZS.Game.saveGame || (ZS._Game && ZS._Game.saveGame);
    if (st.phase !== 'gameover' && saveFn) {
      saveFn();
    }
    closeDivisionModal();
    closeConfirmModal();
    document.getElementById('settings-popover')?.classList.add('hidden');
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
      settingsBtn.setAttribute('aria-expanded', 'false');
      settingsBtn.classList.remove('active');
    }
    ZS.Iso.resetCamera();
    setMainMenuOpen(true);
  }

  // ================= INPUT HANDLING =================
  function handleRemoveTile(tx, ty) {
    const st = ZS.Game.state;
    const cell = st.structGrid[ty] && st.structGrid[ty][tx];
    const actualTarget = cell ? (cell.mounted || cell) : null;
    const rank = actualTarget && actualTarget.id !== 'command_hq' ? (actualTarget.rank || 0) : 0;
    const removed = ZS.Game.removeAt(tx, ty);
    if (!removed && actualTarget && rank >= 1) {
      const rInfo = ZS.Game.getVeterancyRankInfo(rank);
      U.setDetailHtml(
        `${ozIcon('state-alert', 14, 'icon-danger')} <b>[${escapeHtml(ZS.Game.getStructureDisplayName(actualTarget))}]</b> 철거 확인 — ${escapeHtml(rInfo.name)} 배지(${Math.floor(actualTarget.xp || 0)} XP) 계급이 사라집니다.`,
        `<span class="detail-rank-box"><span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${ozIcon('state-rank', 14)}</span><span class="detail-rank-name" style="color:${rInfo.color};">${escapeHtml(rInfo.name)}</span></span><button id="btn-confirm-demolish" class="detail-demolish-confirm-btn">${ozIcon('tool-remove', 14, 'icon-danger')}<span>계급 소멸 감수하고 철거</span></button>`
      );
      const confirmBtn = document.getElementById('btn-confirm-demolish');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (ZS.Game.removeAt(tx, ty, true)) {
            U.setDetailHtml(`${ozIcon('tool-remove', 14, 'icon-danger')} <b>[철거 완료]</b> 건설·강화 자원의 80%를 회수했습니다.`);
          }
        });
      }
    }
    return removed;
  }

  function handlePrimaryTileAction(tx, ty, gx, gy, isDrag, clientX, clientY) {
    const st = ZS.Game.state;

    if (st.activeLayer === 'underground') {
      if (st.phase !== 'day') {
        if (!isDrag) U.inspectTileAt(tx, ty);
        return;
      }
      if (uiState.mode === 'b1_dig') {
        if (ZS.Game.digTileAt) ZS.Game.digTileAt(tx, ty, { silent: isDrag });
        return;
      }
      if (uiState.mode === 'b1_door') {
        if (!isDrag && ZS.Game.toggleB1Door) {
          const edge = uiState.hoverB1DoorEdge || (ZS.Game.findNearestB1DoorEdge ? ZS.Game.findNearestB1DoorEdge(clientX, clientY, gx, gy) : null);
          if (edge) {
            ZS.Game.toggleB1Door(edge.a[0], edge.a[1], edge.b[0], edge.b[1]);
            uiState.hoverB1DoorEdge = ZS.Game.findNearestB1DoorEdge ? ZS.Game.findNearestB1DoorEdge(clientX, clientY, gx, gy) : null;
          } else {
            ZS.Audio.playError();
            U.showWaveBanner('방폭문 설치 불가', '전술 복도와 방 구역 사이의 콘크리트 격벽을 클릭하세요.', 'warn');
          }
        }
        return;
      }
      if (uiState.mode === 'b1_zone' || uiState.mode === 'b1_unzone') {
        if (!isDrag) {
          uiState.b1DragStart = { tx, ty };
          uiState.b1DragCurrent = { tx, ty };
        }
        return;
      }
      if (uiState.mode === 'build') {
        if (!isDrag && uiState.selectedItemId && ZS.Game.placeB1Item) {
          ZS.Game.placeB1Item(uiState.selectedItemId, tx, ty, uiState.b1BuildRot || 0);
        }
        return;
      }
      if (uiState.mode === 'remove') {
        if (!isDrag && ZS.Game.removeB1ItemAt) {
          ZS.Game.removeB1ItemAt(tx, ty);
        }
        return;
      }
      if (uiState.mode === 'move') {
        if (!isDrag) {
          const ug = st.underground;
          if (!uiState.movingSource) {
            const g = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
            if (g) {
              uiState.movingSource = { tx, ty };
              uiState.b1BuildRot = g.rot || 0;
              ZS.Audio.playClick();
              const def = ZS.DATA.ITEMS[g.id];
              if (def && U.formatB1MoveDetailHtml && U.setDetailHtml) {
                U.setDetailHtml(U.formatB1MoveDetailHtml(def, tx, ty));
              }
              if (U.updateCursorTooltip) U.updateCursorTooltip();
            } else {
              ZS.Audio.playError();
              U.showWaveBanner('이동 대상 없음', '이동할 지하 가젯이 있는 타일을 먼저 클릭하세요.', 'warn');
            }
          } else {
            const src = uiState.movingSource;
            const srcG = ug && ug.b1StructGrid && ug.b1StructGrid[src.ty] && ug.b1StructGrid[src.ty][src.tx];
            const nextRot = ((Math.round(Number(uiState.b1BuildRot) || 0) % 4) + 4) % 4;
            const srcRot = srcG ? (((Math.round(Number(srcG.rot) || 0) % 4) + 4) % 4) : 0;
            if (src.tx === tx && src.ty === ty && nextRot === srcRot) {
              uiState.movingSource = null;
              if (U.setToolMode) U.setToolMode('move');
              ZS.Audio.playClick();
            } else if (ZS.Game.moveB1Item && ZS.Game.moveB1Item(src.tx, src.ty, tx, ty, nextRot)) {
              uiState.movingSource = null;
              if (U.setToolMode) U.setToolMode('move');
            }
            if (U.updateCursorTooltip) U.updateCursorTooltip();
          }
        }
        return;
      }
      if (!isDrag) {
        U.inspectTileAt(tx, ty);
      }
      return;
    }

    if (uiState.activeSkill === 'airstrike') {
      if (!isDrag && ZS.Game.triggerAirstrikeAt(gx, gy)) {
        uiState.activeSkill = null;
        document.getElementById('btn-skill-airstrike').classList.remove('targeting');
      }
      return;
    }

    if (st.phase !== 'day') {
      if (!isDrag) U.inspectTileAt(tx, ty);
      return;
    }

    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (!def) return;
      if (isDrag && def.layer !== 'floor' && def.subType !== 'wall') return;
      ZS.Game.placeItem(uiState.selectedItemId, tx, ty);
      return;
    }

    if (uiState.mode === 'remove') {
      handleRemoveTile(tx, ty);
      return;
    }

    if (uiState.mode === 'move') {
      if (isDrag) return;
      if (!uiState.movingSource) {
        const src = st.structGrid[ty] && st.structGrid[ty][tx];
        if (src && src.id !== 'command_hq') {
          const srcUnit = src.mounted || src;
          const srcDef = ZS.DATA.ITEMS[srcUnit.id];
          const canMountDest = !!(srcDef && srcDef.canMountOnWall);
          uiState.movingSource = { tx, ty };
          U.setDetailHtml(
            `${ozIcon(src.mounted ? 'unmount' : 'tool-move', 14)} <b>[${escapeHtml(ZS.Game.getStructureDisplayName(srcUnit))}]</b>${src.mounted ? ' (상부 분리)' : ''} 선택됨 — 이동할 빈 타일${canMountDest ? ' 또는 Lv.2+ 성벽' : ''}을 클릭하세요.`
          );
        } else {
          ZS.Audio.playError();
        }
      } else {
        if (uiState.movingSource.tx === tx && uiState.movingSource.ty === ty) {
          uiState.movingSource = null;
          U.setDetailHtml(`${ozIcon('tool-move', 14)} 이동 취소됨 — 옮길 다른 시설을 클릭하세요.`);
        } else if (ZS.Game.moveStructure(uiState.movingSource.tx, uiState.movingSource.ty, tx, ty)) {
          uiState.movingSource = null;
        }
      }
      return;
    }

    if (!isDrag) {
      U.inspectTileAt(tx, ty);
    }
  }

  function bindEvents() {
    let rightClickTrack = null;
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (uiState.mainMenuOpen || isConfirmModalOpen() || isDivisionModalOpen() || isTechModalOpen() || isGameOverModalOpen()) return;
      if (e.button === 2) {
        const shouldTrackRotate =
          ZS.Game.state.activeLayer === 'underground' &&
          ZS.Game.state.phase === 'day' &&
          ((uiState.mode === 'build' && !!uiState.selectedItemId) ||
            (uiState.mode === 'move' && !!uiState.movingSource));
        if (shouldTrackRotate) {
          rightClickTrack = { startX: e.clientX, startY: e.clientY, dragged: false };
          return;
        }
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        return;
      }
      if (e.button === 1 || (e.button === 0 && keys['Space'])) {
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        return;
      }

      if (e.button === 0) {
        if (uiState.dockCollapsed && uiState.mode === 'build') {
          U.setDockCollapsed(false);
        }
        const g = ZS.Iso.screenToGrid(e.clientX, e.clientY);
        uiState.pointerClient = { x: e.clientX, y: e.clientY, inside: true };
        uiState.hoverTile = { tx: g.tx, ty: g.ty };
        if (ZS.Game.state.activeLayer === 'underground' && uiState.mode === 'b1_door' && ZS.Game.findNearestB1DoorEdge) {
          uiState.hoverB1DoorEdge = ZS.Game.findNearestB1DoorEdge(e.clientX, e.clientY, g.gx, g.gy);
        }
        isLeftPainting = true;
        lastPaintKey = `${g.tx},${g.ty}`;
        handlePrimaryTileAction(g.tx, g.ty, g.gx, g.gy, false, e.clientX, e.clientY);
        U.updateCursorTooltip();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      uiState.pointerClient.inside = false;
      uiState.hoverB1DoorEdge = null;
      U.updateCursorTooltip();
    });

    window.addEventListener('mousemove', (e) => {
      if (uiState.mainMenuOpen || isConfirmModalOpen() || isDivisionModalOpen() || isTechModalOpen() || isGameOverModalOpen()) {
        uiState.pointerClient.inside = false;
        uiState.hoverTile = null;
        uiState.hoverB1DoorEdge = null;
        U.updateCursorTooltip();
        return;
      }

      if (rightClickTrack && !rightClickTrack.dragged) {
        const dist = Math.hypot(e.clientX - rightClickTrack.startX, e.clientY - rightClickTrack.startY);
        if (dist >= 6) {
          rightClickTrack.dragged = true;
          isPanning = true;
          panStart.x = rightClickTrack.startX;
          panStart.y = rightClickTrack.startY;
        }
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        ZS.Iso.panByScreen(dx, dy);
        return;
      }

      const overCanvas = e.target === canvas;
      uiState.pointerClient = { x: e.clientX, y: e.clientY, inside: overCanvas };
      const g = ZS.Iso.screenToGrid(e.clientX, e.clientY);
      uiState.hoverTile = { tx: g.tx, ty: g.ty };
      if (ZS.Game.state.activeLayer === 'underground' && uiState.mode === 'b1_door' && overCanvas && ZS.Game.findNearestB1DoorEdge) {
        uiState.hoverB1DoorEdge = ZS.Game.findNearestB1DoorEdge(e.clientX, e.clientY, g.gx, g.gy);
      } else {
        uiState.hoverB1DoorEdge = null;
      }

      if (isLeftPainting) {
        if (
          ZS.Game.state.activeLayer === 'underground' &&
          uiState.b1DragStart &&
          (uiState.mode === 'b1_zone' || uiState.mode === 'b1_unzone')
        ) {
          uiState.b1DragCurrent = { tx: g.tx, ty: g.ty };
        }
        const key = `${g.tx},${g.ty}`;
        if (key !== lastPaintKey) {
          lastPaintKey = key;
          handlePrimaryTileAction(g.tx, g.ty, g.gx, g.gy, true, e.clientX, e.clientY);
        }
      }
      U.updateCursorTooltip();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 && rightClickTrack) {
        const track = rightClickTrack;
        rightClickTrack = null;
        if (!track.dragged && U.rotateActiveB1Gadget) {
          U.rotateActiveB1Gadget({ fromRightClick: true });
        }
      } else if (e.button === 2) {
        rightClickTrack = null;
      }
      if (
        ZS.Game.state.activeLayer === 'underground' &&
        uiState.b1DragStart &&
        uiState.b1DragCurrent
      ) {
        const s = uiState.b1DragStart;
        const cur = uiState.b1DragCurrent;
        const mode = uiState.mode;
        const role = uiState.selectedB1Role;
        uiState.b1DragStart = null;
        uiState.b1DragCurrent = null;
        if (mode === 'b1_zone' && role && ZS.Game.zoneB1Rect) {
          ZS.Game.zoneB1Rect(s.tx, s.ty, cur.tx, cur.ty, role);
        } else if (mode === 'b1_unzone' && ZS.Game.unzoneB1Rect) {
          ZS.Game.unzoneB1Rect(s.tx, s.ty, cur.tx, cur.ty);
        }
        U.updateCursorTooltip();
      } else {
        uiState.b1DragStart = null;
        uiState.b1DragCurrent = null;
      }
      isPanning = false;
      isLeftPainting = false;
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (uiState.mainMenuOpen || isConfirmModalOpen() || isDivisionModalOpen() || isTechModalOpen() || isGameOverModalOpen()) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        ZS.Iso.zoomAtScreen(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    const itemCardsEl = document.getElementById('item-cards');
    if (itemCardsEl) {
      itemCardsEl.addEventListener(
        'wheel',
        (e) => {
          if (itemCardsEl.scrollWidth > itemCardsEl.clientWidth + 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            itemCardsEl.scrollLeft += e.deltaY;
          }
        },
        { passive: false }
      );
    }

    const settingsWrap = document.getElementById('settings-wrap');
    const settingsBtn = document.getElementById('btn-settings');
    const settingsPopover = document.getElementById('settings-popover');
    const setSettingsOpen = (open) => {
      if (!settingsPopover || !settingsBtn) return;
      settingsPopover.classList.toggle('hidden', !open);
      settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      settingsBtn.classList.toggle('active', !!open);
    };

    if (settingsBtn && settingsPopover) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSettingsOpen(settingsPopover.classList.contains('hidden'));
      });
      document.addEventListener('mousedown', (e) => {
        if (!settingsPopover.classList.contains('hidden') && settingsWrap && !settingsWrap.contains(e.target)) {
          setSettingsOpen(false);
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      const guideEl = document.getElementById('guide-modal');
      const traderEl = document.getElementById('trader-modal');

      if (e.code === 'Escape') {
        if (isConfirmModalOpen()) {
          closeConfirmModal();
          return;
        }
        if (isDivisionModalOpen()) {
          closeDivisionModal();
          return;
        }
        if (guideEl && !guideEl.classList.contains('hidden')) {
          guideEl.classList.add('hidden');
          return;
        }
        if (isTechModalOpen()) {
          if (U.closeTechPopModal) U.closeTechPopModal();
          return;
        }
        if (isGameOverModalOpen()) {
          return;
        }
        if (uiState.mainMenuOpen) {
          if (uiState.menuOptionsOpen) setMenuOptionsOpen(false);
          return;
        }
        setSettingsOpen(false);
        uiState.inspectedTile = null;
        U.setToolMode('inspect');
        traderEl?.classList.add('hidden');
        return;
      }

      if (uiState.mainMenuOpen || isConfirmModalOpen() || isDivisionModalOpen() || isGameOverModalOpen()) return;

      keys[e.code] = true;
      const activeTag = document.activeElement && document.activeElement.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
      if (!isTyping && e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSettingsOpen(false);
        if (U.togglePopModal) U.togglePopModal();
        return;
      }
      if (!isTyping && e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSettingsOpen(false);
        if (U.toggleTechModal) U.toggleTechModal();
        return;
      }
      if (!isTyping && e.code === 'KeyB' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const traderHidden = !traderEl || traderEl.classList.contains('hidden');
        const guideHidden = !guideEl || guideEl.classList.contains('hidden');
        if (traderHidden && guideHidden && !isTechModalOpen()) {
          e.preventDefault();
          setSettingsOpen(false);
          if (ZS.Game.toggleActiveLayer) ZS.Game.toggleActiveLayer();
        }
        return;
      }
      if (!isTyping && /^Digit([1-9])$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const traderHidden = !traderEl || traderEl.classList.contains('hidden');
        const guideHidden = !guideEl || guideEl.classList.contains('hidden');
        if (ZS.Game.state.phase === 'day' && traderHidden && guideHidden && !isTechModalOpen()) {
          const slotIdx = Number(RegExp.$1) - 1;
          if (ZS.Game.state.activeLayer === 'underground') {
            if (!uiState.activeB1Category || uiState.activeB1Category === 'b1_ops') {
              const tools = ZS.DATA.B1_TOOLS || [];
              if (tools[slotIdx]) {
                if (uiState.dockCollapsed) U.setDockCollapsed(false);
                if (U.selectB1Tool) U.selectB1Tool(tools[slotIdx]);
              }
            } else {
              const b1Items = Object.values(ZS.DATA.ITEMS).filter(
                (def) => def.domain === 'underground' && def.b1Category === uiState.activeB1Category
              );
              if (b1Items[slotIdx]) {
                if (uiState.dockCollapsed) U.setDockCollapsed(false);
                if (U.selectBuildCard) U.selectBuildCard(b1Items[slotIdx]);
              }
            }
          } else {
            const items = Object.values(ZS.DATA.ITEMS).filter((def) => def.category === uiState.activeCategory && def.domain !== 'underground');
            if (items[slotIdx]) {
              if (uiState.dockCollapsed) U.setDockCollapsed(false);
              if (U.selectBuildCard) U.selectBuildCard(items[slotIdx]);
            }
          }
        }
      } else if (e.code === 'KeyU') {
        if (ZS.Game.state.activeLayer !== 'underground' && uiState.inspectedTile) {
          ZS.Game.upgradeStructure(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
        }
      } else if (e.code === 'KeyG') {
        if (ZS.Game.state.activeLayer !== 'underground' && uiState.inspectedTile && ZS.Game.upgradeWallBase) {
          ZS.Game.upgradeWallBase(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
        }
      } else if (e.code === 'KeyR') {
        if (
          !isTyping &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          ZS.Game.state.activeLayer === 'underground' &&
          ZS.Game.state.phase === 'day' &&
          !isTechModalOpen() &&
          U.rotateActiveB1Gadget
        ) {
          U.rotateActiveB1Gadget();
        }
      } else if (e.code === 'KeyV') {
        if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && ZS.Game.toggleWindOverlay) {
          ZS.Game.toggleWindOverlay();
        }
      } else if (e.code === 'KeyM') {
        if (ZS.Game.state.phase === 'day') {
          U.setToolMode(uiState.mode === 'move' ? 'inspect' : 'move');
        }
      } else if (e.code === 'KeyX') {
        if (ZS.Game.state.phase === 'day') {
          if (uiState.dockCollapsed) U.setDockCollapsed(false);
          U.setToolMode(uiState.mode === 'remove' ? 'inspect' : 'remove');
        }
      } else if (e.code === 'Tab') {
        e.preventDefault();
        U.setDockCollapsed(!uiState.dockCollapsed);
      } else if (e.code === 'Space' && document.activeElement === document.body) {
        ZS.Iso.resetCamera();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Buttons
    document.getElementById('tool-inspect').addEventListener('click', () => U.setToolMode('inspect'));
    document.getElementById('tool-move').addEventListener('click', () => U.setToolMode('move'));
    document.getElementById('tool-remove').addEventListener('click', () => U.setToolMode('remove'));

    const dockToggleBtn = document.getElementById('btn-toggle-dock');
    if (dockToggleBtn) {
      dockToggleBtn.addEventListener('click', () => U.setDockCollapsed(true));
    }
    const dockExpandBtn = document.getElementById('btn-expand-dock');
    if (dockExpandBtn) {
      dockExpandBtn.addEventListener('click', () => U.setDockCollapsed(false));
    }
    const hudResToggleBtn = document.getElementById('btn-toggle-hud-res');
    if (hudResToggleBtn) {
      hudResToggleBtn.addEventListener('click', () => {
        uiState.hudResCompact = !uiState.hudResCompact;
        U.syncDockAndHudState();
      });
    }

    document.getElementById('btn-start-wave').addEventListener('click', () => {
      setSettingsOpen(false);
      uiState.inspectedTile = null;
      U.setToolMode('inspect');
      ZS.Game.startNightWave();
    });

    const windLayerBtn = document.getElementById('btn-toggle-wind-layer');
    if (windLayerBtn) {
      windLayerBtn.addEventListener('click', () => {
        if (ZS.Game.toggleWindOverlay) ZS.Game.toggleWindOverlay();
      });
    }

    const undergroundBtn = document.getElementById('btn-toggle-underground');
    if (undergroundBtn) {
      undergroundBtn.addEventListener('click', () => {
        setSettingsOpen(false);
        if (ZS.Game.toggleActiveLayer) ZS.Game.toggleActiveLayer();
      });
    }

    const reconCardEl = document.getElementById('recon-card');
    if (reconCardEl) {
      reconCardEl.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-toggle-recon-paths');
        if (!btn) return;
        e.stopPropagation();
        if (ZS.Game.toggleReconPaths) ZS.Game.toggleReconPaths();
      });
    }

    const openTrader = () => {
      if (ZS.Game.state.phase !== 'day') {
        U.showWaveBanner('야간 교전 중 교역 불가', '아침이 밝아 정비 페이즈가 되면 보급 상인과 거래할 수 있습니다.', 'warn');
        return;
      }
      setSettingsOpen(false);
      U.renderTraderModal();
      document.getElementById('trader-modal').classList.remove('hidden');
    };
    document.getElementById('btn-trader').addEventListener('click', openTrader);
    const traderPillEl = document.getElementById('btn-open-trader-pill');
    if (traderPillEl) {
      traderPillEl.addEventListener('click', openTrader);
      traderPillEl.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          openTrader();
        }
      });
    }
    document.getElementById('btn-close-trader').addEventListener('click', () => {
      document.getElementById('trader-modal').classList.add('hidden');
    });
    document.getElementById('btn-refresh-trader').addEventListener('click', () => {
      ZS.Game.refreshTraderOffers(true);
    });

    const openPop = () => {
      setSettingsOpen(false);
      if (U.openPopModal) U.openPopModal();
    };
    const openTech = (focusTechId) => {
      setSettingsOpen(false);
      if (U.openTechModal) U.openTechModal(focusTechId);
    };
    const popPillEl = document.getElementById('pop-pill');
    if (popPillEl) {
      popPillEl.addEventListener('click', openPop);
      popPillEl.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          openPop();
        }
      });
    }
    const rpPillEl = document.getElementById('rp-pill');
    if (rpPillEl) {
      rpPillEl.addEventListener('click', () => openTech());
      rpPillEl.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          openTech();
        }
      });
    }
    document.getElementById('btn-open-pop')?.addEventListener('click', () => {
      setSettingsOpen(false);
      if (U.togglePopModal) U.togglePopModal();
    });
    document.getElementById('btn-open-tech')?.addEventListener('click', () => {
      setSettingsOpen(false);
      if (U.toggleTechModal) U.toggleTechModal();
    });
    document.getElementById('btn-pop-to-tech')?.addEventListener('click', () => {
      openTech();
    });
    document.getElementById('btn-tech-to-pop')?.addEventListener('click', () => {
      openPop();
    });
    document.getElementById('btn-close-pop')?.addEventListener('click', () => {
      if (U.closePopModal) U.closePopModal();
    });
    document.getElementById('btn-close-tech')?.addEventListener('click', () => {
      if (U.closeTechModal) U.closeTechModal();
    });
    document.getElementById('pop-modal')?.addEventListener('mousedown', (e) => {
      if (e.target && e.target.id === 'pop-modal') {
        if (U.closePopModal) U.closePopModal();
      }
    });
    document.getElementById('tech-modal')?.addEventListener('mousedown', (e) => {
      if (e.target && e.target.id === 'tech-modal') {
        if (U.closeTechModal) U.closeTechModal();
      }
    });

    document.getElementById('btn-repair-all').addEventListener('click', () => {
      ZS.Game.repairAllStructures();
    });

    document.getElementById('btn-speed').addEventListener('click', () => {
      ZS.Game.state.gameSpeed = ZS.Game.state.gameSpeed === 1 ? 2 : 1;
      if (ZS.Game.state.phase === 'night' && U.updateCombatHud) U.updateCombatHud();
      else U.updateHud();
    });

    document.getElementById('btn-skill-repair').addEventListener('click', () => {
      ZS.Game.triggerNanoRepair();
    });

    document.getElementById('btn-skill-airstrike').addEventListener('click', () => {
      if (ZS.Game.state.skills.airstrikeCd > 0) return;
      uiState.activeSkill = uiState.activeSkill === 'airstrike' ? null : 'airstrike';
      document.getElementById('btn-skill-airstrike').classList.toggle('targeting', uiState.activeSkill === 'airstrike');
      if (ZS.Game.state.phase === 'night' && U.updateCombatHud) U.updateCombatHud();
      else U.updateHud();
    });

    const handleToggleSound = () => {
      ZS.Audio.toggleMute();
      syncSettingsButtons();
    };

    const handleToggleShake = (showToast) => {
      const on = ZS.Game.toggleScreenShake();
      syncSettingsButtons();
      if (showToast && !uiState.mainMenuOpen) {
        U.showWaveBanner(
          on ? '화면 흔들림 켜짐' : '화면 흔들림 꺼짐',
          on ? '폭격·보스 등장·본부 피격 시 미세한 진동 피드백이 재생됩니다.' : '카메라 화면 흔들림 연출이 비활성화되었습니다.',
          'info'
        );
      }
    };

    syncSettingsButtons();
    document.getElementById('btn-sound')?.addEventListener('click', handleToggleSound);
    document.getElementById('btn-menu-sound')?.addEventListener('click', handleToggleSound);

    if (ZS.Game.isScreenShakeEnabled) {
      document.getElementById('btn-shake')?.addEventListener('click', () => handleToggleShake(true));
      document.getElementById('btn-menu-shake')?.addEventListener('click', () => handleToggleShake(false));
    }

    const hqBoxEl = document.getElementById('hud-hq-box');
    if (hqBoxEl) {
      const focusHq = () => {
        U.setToolMode('inspect');
        ZS.Iso.resetCamera();
        U.inspectTileAt(ZS.DATA.HQ_POS.x, ZS.DATA.HQ_POS.y);
      };
      hqBoxEl.addEventListener('click', focusHq);
      hqBoxEl.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          focusHq();
        }
      });
    }

    document.getElementById('btn-center').addEventListener('click', () => {
      ZS.Iso.resetCamera();
      setSettingsOpen(false);
    });

    document.getElementById('btn-guide').addEventListener('click', () => {
      setSettingsOpen(false);
      document.getElementById('guide-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-guide').addEventListener('click', () => {
      document.getElementById('guide-modal').classList.add('hidden');
    });

    document.getElementById('btn-return-title')?.addEventListener('click', () => {
      setSettingsOpen(false);
      returnToTitleMenu();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      setSettingsOpen(false);
      const st = ZS.Game.state;
      const curWavePad = String(Math.max(1, Math.floor(st.wave || 1))).padStart(2, '0');
      openConfirmModal({
        title: '새 작전 초기화 확인',
        desc: `현재 진행 중인 기지(WAVE ${curWavePad})를 초기화하고 WAVE 01부터 새 작전을 시작할까요?`,
        acceptText: '분과 선택',
        onAccept: openDivisionModal
      });
    });

    // Commander Division Modal Controls (#66)
    document.getElementById('btn-close-division')?.addEventListener('click', () => {
      closeDivisionModal();
    });
    document.getElementById('btn-division-cancel')?.addEventListener('click', () => {
      closeDivisionModal();
    });
    document.getElementById('btn-division-confirm')?.addEventListener('click', () => {
      executeStartNewOperation(uiState.selectedDivisionId);
    });
    document.getElementById('division-modal')?.addEventListener('mousedown', (e) => {
      if (e.target && e.target.id === 'division-modal') {
        closeDivisionModal();
      }
    });

    // Title Main Menu & Custom Confirm Modal Controls (#65)
    document.getElementById('btn-menu-continue')?.addEventListener('click', () => {
      resumeSavedOperation();
    });
    document.getElementById('btn-menu-new')?.addEventListener('click', () => {
      beginNewOperationFlow();
    });
    document.getElementById('btn-menu-options')?.addEventListener('click', () => {
      setMenuOptionsOpen(!uiState.menuOptionsOpen);
    });
    document.getElementById('btn-menu-guide')?.addEventListener('click', () => {
      document.getElementById('guide-modal').classList.remove('hidden');
    });

    document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => {
      closeConfirmModal();
    });
    document.getElementById('btn-confirm-accept')?.addEventListener('click', () => {
      const fn = pendingConfirmAction;
      closeConfirmModal();
      if (typeof fn === 'function') fn();
    });
    document.getElementById('confirm-modal')?.addEventListener('mousedown', (e) => {
      if (e.target && e.target.id === 'confirm-modal') {
        closeConfirmModal();
      }
    });

    // Dedicated Game Over Modal Controls
    document.getElementById('btn-gameover-retry')?.addEventListener('click', () => {
      const divId = (ZS.Game && ZS.Game.state && ZS.Game.state.divisionId) || 'mobile_corps';
      closeGameOverModal();
      executeStartNewOperation(divId);
    });
    document.getElementById('btn-gameover-division')?.addEventListener('click', () => {
      closeGameOverModal();
      openDivisionModal();
    });
    document.getElementById('btn-gameover-title')?.addEventListener('click', () => {
      closeGameOverModal();
      returnToTitleMenu();
    });
  }

  // ================= MAIN ANIMATION LOOP (Fixed 60 FPS Limiter) =================
  const TARGET_FPS = 60;
  const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
  const VSYNC_TOLERANCE_MS = 1.6;
  let lastFrameMs = performance.now();
  let nextFrameTargetMs = lastFrameMs;
  let hudTick = 0;

  function loop(nowMs) {
    requestAnimationFrame(loop);
    if (nowMs < nextFrameTargetMs - VSYNC_TOLERANCE_MS) {
      return;
    }
    if (nowMs - nextFrameTargetMs > FRAME_INTERVAL_MS) {
      nextFrameTargetMs = nowMs + FRAME_INTERVAL_MS;
    } else {
      nextFrameTargetMs += FRAME_INTERVAL_MS;
    }

    const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;

    if (!uiState.mainMenuOpen) {
      // Smooth WASD / Arrow camera pan
      const panSpd = 380 * rawDt;
      if (keys['KeyW'] || keys['ArrowUp']) ZS.Iso.panByScreen(0, panSpd);
      if (keys['KeyS'] || keys['ArrowDown']) ZS.Iso.panByScreen(0, -panSpd);
      if (keys['KeyA'] || keys['ArrowLeft']) ZS.Iso.panByScreen(panSpd, 0);
      if (keys['KeyD'] || keys['ArrowRight']) ZS.Iso.panByScreen(-panSpd, 0);

      ZS.Game.update(rawDt);

      if (ZS.Game.state.phase === 'night') {
        hudTick += rawDt;
        if (hudTick >= 0.16) {
          hudTick = 0;
          U.updateLiveNightNumbers();
        }
      }
    }

    ZS.Renderer.render(ctx, window.innerWidth, window.innerHeight, ZS.Game.state, uiState, nowMs / 1000);
  }

  // ================= BOOTSTRAP =================
  function hexWithAlpha(color, alpha) {
    if (!color || typeof color !== 'string') return `rgba(0, 0, 0, ${alpha})`;
    const s = color.trim();
    if (s[0] === '#') {
      if (s.length === 4 || s.length === 5) {
        const r = parseInt(s[1] + s[1], 16);
        const g = parseInt(s[2] + s[2], 16);
        const b = parseInt(s[3] + s[3], 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      } else if (s.length === 7 || s.length === 9) {
        const r = parseInt(s.slice(1, 3), 16);
        const g = parseInt(s.slice(3, 5), 16);
        const b = parseInt(s.slice(5, 7), 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      }
    }
    const rgbMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgbMatch) {
      return `rgba(${Math.round(+rgbMatch[1])}, ${Math.round(+rgbMatch[2])}, ${Math.round(+rgbMatch[3])}, ${alpha})`;
    }
    return `color-mix(in srgb, ${s} ${Math.round(alpha * 100)}%, transparent)`;
  }

  function syncCssPalette() {
    const P = ZS.DATA.PALETTE;
    if (!P) return;
    const root = document.documentElement.style;
    root.setProperty('--power', P.power);
    root.setProperty('--power-dim', P.powerDim);
    root.setProperty('--coin', P.coin);
    root.setProperty('--danger', P.danger);
    root.setProperty('--heal', P.heal);
    root.setProperty('--caution', P.caution);
    root.setProperty('--select', P.selectStroke);
    root.setProperty('--outline-dark', P.outlineDark);
    root.setProperty('--res-wood', P.resWood);
    root.setProperty('--res-scrap', P.resScrap);

    root.setProperty('--col-power', P.power);
    root.setProperty('--col-power-dim', P.powerDim);
    root.setProperty('--col-power-soft', hexWithAlpha(P.power, 0.24));
    root.setProperty('--col-power-bg', hexWithAlpha(P.power, 0.14));

    root.setProperty('--col-gold', P.coin);
    root.setProperty('--col-gold-soft', hexWithAlpha(P.coin, 0.42));
    root.setProperty('--col-gold-bg', hexWithAlpha(P.coin, 0.16));

    root.setProperty('--col-danger', P.danger);
    root.setProperty('--col-danger-soft', hexWithAlpha(P.danger, 0.45));
    root.setProperty('--col-danger-bg', hexWithAlpha(P.danger, 0.20));

    root.setProperty('--col-health', P.heal);
    root.setProperty('--col-health-soft', hexWithAlpha(P.heal, 0.45));
    root.setProperty('--col-health-bg', hexWithAlpha(P.heal, 0.18));

    root.setProperty('--col-caution', P.caution);

    root.setProperty('--col-select', P.selectStroke);
    root.setProperty('--col-select-soft', P.hoverStroke);
    root.setProperty('--col-select-bg', P.selectFill);
  }

  function init() {
    syncCssPalette();
    resizeCanvas();
    ZS.Iso.resetCamera();

    const env = ZS.Game.getEnvInfo ? ZS.Game.getEnvInfo() : { isDevBuild: false, isDevEnvironment: false, isDebugMode: false };
    const ver = ZS.DATA.VERSION || 'v0.8.1';
    const hudVer = document.getElementById('hud-version');
    const menuVer = document.getElementById('menu-version');
    const guideVer = document.getElementById('guide-version');
    const applyVersionLabel = (el) => {
      if (!el) return;
      if (env.isDevBuild) {
        const shaLabel = env.commitSha ? `DEV · #${env.commitSha}` : 'DEV';
        el.innerHTML = `<span>${ver}</span><span class="dev-build-badge" title="develop 스테이징 빌드 (세이브 격리됨)">${shaLabel}</span>`;
      } else {
        el.textContent = ver;
      }
    };
    applyVersionLabel(hudVer);
    applyVersionLabel(menuVer);
    if (guideVer) guideVer.textContent = ver;
    document.title = env.isDevBuild
      ? '[DEV] Dead-End Defense — 스테이징 검수 빌드'
      : 'Dead-End Defense — 모던 전술 디펜스 & 쉘터 빌더';

    U.initDebugToolbar(env);

    ZS.Game.setCallbacks({
      onUiChange: U.updateHud,
      onCombatHudChange: U.updateCombatHud,
      onWaveBanner: U.showWaveBanner
    });

    const initialSave = getSavedOperationInfo();
    if (!initialSave || !ZS.Game.loadGame()) {
      const saveKey = ZS.Game.getSaveKey ? ZS.Game.getSaveKey() : 'outpost_zero_save_v1';
      let prevRawSave = null;
      try {
        prevRawSave = typeof localStorage !== 'undefined' ? localStorage.getItem(saveKey) : null;
      } catch (e) {}
      ZS.Game.initNewGame();
      try {
        if (prevRawSave == null) {
          localStorage.removeItem(saveKey);
        } else {
          localStorage.setItem(saveKey, prevRawSave);
        }
      } catch (e) {}
    }

    U.renderCategoryTabs();
    U.updateHud();
    bindEvents();
    setMainMenuOpen(true);
    requestAnimationFrame(loop);
  }

  Object.assign(U, {
    resizeCanvas,
    getSavedOperationInfo,
    isConfirmModalOpen,
    openConfirmModal,
    closeConfirmModal,
    isDivisionModalOpen,
    renderDivisionModal,
    openDivisionModal,
    closeDivisionModal,
    isGameOverModalOpen,
    renderGameOverModal,
    openGameOverModal,
    closeGameOverModal,
    setMenuOptionsOpen,
    syncSettingsButtons,
    refreshMainMenuState,
    setMainMenuOpen,
    resumeSavedOperation,
    beginNewOperationFlow,
    executeStartNewOperation,
    returnToTitleMenu,
    handleRemoveTile,
    handlePrimaryTileAction,
    bindEvents,
    loop,
    hexWithAlpha,
    syncCssPalette,
    init
  });

  window.addEventListener('DOMContentLoaded', init);
})();
