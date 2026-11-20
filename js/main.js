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
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        ZS.Iso.zoomAtScreen(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Escape') {
        U.setToolMode('inspect');
        document.getElementById('trader-modal').classList.add('hidden');
        document.getElementById('guide-modal').classList.add('hidden');
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
      U.renderTraderModal();
      document.getElementById('trader-modal').classList.remove('hidden');
    };
    document.getElementById('btn-trader').addEventListener('click', openTrader);
    document.getElementById('btn-open-trader-pill').addEventListener('click', openTrader);
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

    document.getElementById('btn-sound').addEventListener('click', () => {
      const muted = ZS.Audio.toggleMute();
      const soundBtn = document.getElementById('btn-sound');
      soundBtn.innerHTML = ozIcon(muted ? 'sys-sound-off' : 'sys-sound-on', 16);
      soundBtn.classList.toggle('toggle-off', muted);
    });

    const shakeBtn = document.getElementById('btn-shake');
    if (shakeBtn && ZS.Game.isScreenShakeEnabled) {
      const syncShakeBtn = () => {
        const on = ZS.Game.isScreenShakeEnabled();
        shakeBtn.innerHTML = `${ozIcon(on ? 'sys-shake-on' : 'sys-shake-off', 16)}<span>${on ? '흔들림 ON' : '흔들림 OFF'}</span>`;
        shakeBtn.classList.toggle('toggle-off', !on);
      };
      syncShakeBtn();
      shakeBtn.addEventListener('click', () => {
        const on = ZS.Game.toggleScreenShake();
        syncShakeBtn();
        U.showWaveBanner(
          on ? '화면 흔들림 켜짐' : '화면 흔들림 꺼짐',
          on ? '폭격·보스 등장·본부 피격 시 미세한 진동 피드백이 재생됩니다.' : '카메라 화면 흔들림 연출이 비활성화되었습니다.',
          'info'
        );
      });
    }

    const hqBoxEl = document.getElementById('hud-hq-box');
    if (hqBoxEl) {
      hqBoxEl.addEventListener('click', () => {
        U.setToolMode('inspect');
        ZS.Iso.resetCamera();
        U.inspectTileAt(ZS.DATA.HQ_POS.x, ZS.DATA.HQ_POS.y);
      });
    }

    document.getElementById('btn-center').addEventListener('click', () => {
      ZS.Iso.resetCamera();
    });

    document.getElementById('btn-guide').addEventListener('click', () => {
      document.getElementById('guide-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-guide').addEventListener('click', () => {
      document.getElementById('guide-modal').classList.add('hidden');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('현재 기지를 초기화하고 WAVE 1부터 새 작전을 시작할까요?')) {
        U.setToolMode('inspect');
        ZS.Iso.resetCamera();
        ZS.Game.clearSaveAndReset();
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
    const ver = ZS.DATA.VERSION || 'v0.5.0';
    const hudVer = document.getElementById('hud-version');
    const guideVer = document.getElementById('guide-version');
    if (hudVer) {
      if (env.isDevBuild) {
        const shaLabel = env.commitSha ? `DEV · #${env.commitSha}` : 'DEV';
        hudVer.innerHTML = `<span>${ver}</span><span class="dev-build-badge" title="develop 스테이징 빌드 (세이브 격리됨)">${shaLabel}</span>`;
      } else {
        hudVer.textContent = ver;
      }
    }
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

    if (!ZS.Game.loadGame()) {
      ZS.Game.initNewGame();
      U.showWaveBanner(
        'Dead-End Defense 지휘권 인수 완료',
        '낮 동안 방어선·발전기·모던 쉘터를 구축하고 [웨이브 시작]을 눌러 야간 방어에 돌입하세요!',
        'info'
      );
    }

    U.renderCategoryTabs();
    U.updateHud();
    bindEvents();
    requestAnimationFrame(loop);
  }

  Object.assign(U, {
    resizeCanvas,
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
