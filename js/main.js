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
      if (savedN !== N && savedN !== 18) return null;
      const hqLv = Math.max(1, Math.min(4, Number(parsed.hqLevel) || 1));
      const phaseLabel = parsed.phase === 'night' ? '야간 방어' : '주간 정비';
      const wavePad = String(Math.floor(waveNum)).padStart(2, '0');
      return {
        wave: Math.floor(waveNum),
        wavePad,
        hqLevel: hqLv,
        phase: parsed.phase || 'day',
        phaseLabel,
        summaryText: `WAVE ${wavePad} · ${phaseLabel} · 본부 Lv.${hqLv}`
      };
    } catch (e) {
      return null;
    }
  }

  function isConfirmModalOpen() {
    const modal = document.getElementById('confirm-modal');
    return !!(modal && !modal.classList.contains('hidden'));
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
      document.getElementById('btn-skill-airstrike')?.classList.remove('targeting');
      document.getElementById('trader-modal')?.classList.add('hidden');
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
    uiState.inspectedTile = null;
    U.setToolMode('inspect');
    ZS.Iso.resetCamera();
    setMainMenuOpen(false);
    if (ZS.Audio.playBuild) ZS.Audio.playBuild();
  }

  function executeStartNewOperation() {
    closeConfirmModal();
    uiState.inspectedTile = null;
    U.setToolMode('inspect');
    ZS.Iso.resetCamera();
    setMainMenuOpen(false);
    ZS.Game.clearSaveAndReset();
    U.showWaveBanner(
      'Dead-End Defense 지휘권 인수 완료',
      '낮 동안 방어선·발전기·모던 쉘터를 구축하고 [웨이브 시작]을 눌러 야간 방어에 돌입하세요!',
      'info'
    );
    if (ZS.Audio.playBuild) ZS.Audio.playBuild();
  }

  function beginNewOperationFlow() {
    const info = getSavedOperationInfo();
    if (!info) {
      executeStartNewOperation();
      return;
    }
    openConfirmModal({
      title: '새 작전 개시 확인',
      desc: `현재 진행 중인 작전(WAVE ${info.wavePad})을 초기화하고 WAVE 01부터 새 작전을 시작할까요?`,
      acceptText: '새 작전 개시',
      onAccept: executeStartNewOperation
    });
  }

  function returnToTitleMenu() {
    const st = ZS.Game.state;
    const saveFn = ZS.Game.saveGame || (ZS._Game && ZS._Game.saveGame);
    if (st.phase !== 'gameover' && saveFn) {
      saveFn();
    }
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

  function handlePrimaryTileAction(tx, ty, gx, gy, isDrag) {
    const st = ZS.Game.state;

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
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (uiState.mainMenuOpen || isConfirmModalOpen()) return;
      if (e.button === 2 || e.button === 1 || (e.button === 0 && keys['Space'])) {
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
        isLeftPainting = true;
        lastPaintKey = `${g.tx},${g.ty}`;
        handlePrimaryTileAction(g.tx, g.ty, g.gx, g.gy, false);
        U.updateCursorTooltip();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      uiState.pointerClient.inside = false;
      U.updateCursorTooltip();
    });

    window.addEventListener('mousemove', (e) => {
      if (uiState.mainMenuOpen || isConfirmModalOpen()) {
        uiState.pointerClient.inside = false;
        uiState.hoverTile = null;
        U.updateCursorTooltip();
        return;
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
      U.updateCursorTooltip();

      if (isLeftPainting) {
        const key = `${g.tx},${g.ty}`;
        if (key !== lastPaintKey) {
          lastPaintKey = key;
          handlePrimaryTileAction(g.tx, g.ty, g.gx, g.gy, true);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      isLeftPainting = false;
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (uiState.mainMenuOpen || isConfirmModalOpen()) return;
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
        if (guideEl && !guideEl.classList.contains('hidden')) {
          guideEl.classList.add('hidden');
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

      if (uiState.mainMenuOpen || isConfirmModalOpen()) return;

      keys[e.code] = true;
      const activeTag = document.activeElement && document.activeElement.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
      if (!isTyping && /^Digit([1-9])$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const traderHidden = !traderEl || traderEl.classList.contains('hidden');
        const guideHidden = !guideEl || guideEl.classList.contains('hidden');
        if (ZS.Game.state.phase === 'day' && traderHidden && guideHidden) {
          const slotIdx = Number(RegExp.$1) - 1;
          const items = Object.values(ZS.DATA.ITEMS).filter((def) => def.category === uiState.activeCategory);
          if (items[slotIdx]) {
            if (uiState.dockCollapsed) U.setDockCollapsed(false);
            if (U.selectBuildCard) U.selectBuildCard(items[slotIdx]);
          }
        }
      } else if (e.code === 'KeyU') {
        if (uiState.inspectedTile) {
          ZS.Game.upgradeStructure(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
        }
      } else if (e.code === 'KeyG') {
        if (uiState.inspectedTile && ZS.Game.upgradeWallBase) {
          ZS.Game.upgradeWallBase(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
        }
      } else if (e.code === 'KeyM') {
        U.setToolMode(uiState.mode === 'move' ? 'inspect' : 'move');
      } else if (e.code === 'KeyX') {
        if (uiState.dockCollapsed) U.setDockCollapsed(false);
        U.setToolMode(uiState.mode === 'remove' ? 'inspect' : 'remove');
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
        acceptText: '새 작전 개시',
        onAccept: executeStartNewOperation
      });
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
    const ver = ZS.DATA.VERSION || 'v0.5.1';
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
