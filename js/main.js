window.ZS = window.ZS || {};

(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const uiState = {
    activeCategory: 'defense',
    mode: 'inspect', // 'inspect' | 'build' | 'move' | 'remove'
    selectedItemId: null,
    hoverTile: null,
    inspectedTile: null,
    movingSource: null,
    activeSkill: null // null | 'airstrike'
  };

  const keys = {};
  let isPanning = false;
  let isLeftPainting = false;
  let lastPaintKey = '';
  let panStart = { x: 0, y: 0 };
  let bannerTimer = null;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ZS.Iso.setViewport(w, h);
  }

  // ================= UI RENDERING =================
  function renderCategoryTabs() {
    const wrap = document.getElementById('category-tabs');
    wrap.innerHTML = '';
    ZS.DATA.CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (uiState.activeCategory === cat.id ? ' active' : '');
      btn.textContent = cat.label;
      btn.title = cat.desc;
      btn.addEventListener('click', () => {
        uiState.activeCategory = cat.id;
        renderCategoryTabs();
        renderItemCards();
      });
      wrap.appendChild(btn);
    });
  }

  function getCardTagInfo(def) {
    if (def.layer === 'floor') return { text: `바닥재 · 💛+${def.cozy || 0}`, cls: 'tag-cozy' };
    if (def.subType === 'manned') return { text: `👥요원 ${def.popUse} · 무전력`, cls: 'tag-manned' };
    if (def.subType === 'turret') return { text: `⚡야간전력 소모`, cls: 'tag-power' };
    if (def.subType === 'power') return { text: `☀️+${def.dayCharge}⚡ / 용량+${def.powerCap}`, cls: 'tag-power' };
    if (def.subType === 'housing') return { text: `👥수용+${def.popCap} · 💛+${def.cozy}`, cls: 'tag-manned' };
    if (def.category === 'decor') {
      const pwr = def.requiresPower ? '⚡전등 · ' : '';
      return { text: `${pwr}💛안락함 +${def.cozy || 0}`, cls: 'tag-cozy' };
    }
    if (def.subType === 'trap') return { text: '무전력 둔화 함정', cls: '' };
    return { text: `방호벽 · HP ${def.maxHp}`, cls: '' };
  }

  function renderItemCards() {
    const container = document.getElementById('item-cards');
    container.innerHTML = '';
    const st = ZS.Game.state;

    Object.values(ZS.DATA.ITEMS).forEach((def) => {
      if (def.category !== uiState.activeCategory) return;

      const isLocked = def.unlockedByBoss && !st.bossDefeated;
      const voucherCount = st.freeVouchers[def.id] || 0;

      const card = document.createElement('div');
      card.className =
        'item-card' +
        (uiState.mode === 'build' && uiState.selectedItemId === def.id ? ' selected' : '') +
        (isLocked ? ' locked' : '');

      const tag = getCardTagInfo(def);

      let costHtml = '';
      if (isLocked) {
        costHtml = `<span class="cost-chip short">🔒 보스 처치 해금</span>`;
      } else if (voucherCount > 0) {
        costHtml = `<span class="cost-chip free">🎁 무료 보급 x${voucherCount}</span>`;
      } else {
        const c = def.cost || {};
        if (c.wood) {
          costHtml += `<span class="cost-chip ${st.wood < c.wood ? 'short' : ''}">🪵${c.wood}</span>`;
        }
        if (c.scrap) {
          costHtml += `<span class="cost-chip ${st.scrap < c.scrap ? 'short' : ''}">🔩${c.scrap}</span>`;
        }
        if (c.coin) {
          costHtml += `<span class="cost-chip ${st.coin < c.coin ? 'short' : ''}">🪙${c.coin}</span>`;
        }
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="card-icon">${def.icon}</span>
          <span class="card-title">${def.name}</span>
        </div>
        <span class="card-tag ${tag.cls}">${tag.text}</span>
        <div class="card-costs">${costHtml}</div>
      `;

      card.addEventListener('click', () => {
        setToolMode('build', def.id);
      });

      container.appendChild(card);
    });
  }

  function setToolMode(mode, itemId) {
    uiState.mode = mode;
    uiState.movingSource = null;
    uiState.activeSkill = null;
    document.getElementById('btn-skill-airstrike').classList.remove('targeting');

    if (mode === 'build') {
      uiState.selectedItemId = itemId;
      uiState.inspectedTile = null;
      const def = ZS.DATA.ITEMS[itemId];
      if (def) {
        setDetailText(`${def.icon} [${def.name}] — ${def.desc}`);
      }
    } else {
      uiState.selectedItemId = null;
      if (mode === 'move') {
        setDetailText('🔄 [무료 이동 모드] 옮길 시설을 클릭한 뒤, 이동할 빈 타일을 클릭하세요. (낮 전용)');
      } else if (mode === 'remove') {
        setDetailText('🗑️ [철거 모드] 철거할 시설 또는 바닥 타일을 클릭하면 건설 자원의 80%를 돌려받습니다.');
      } else {
        setDetailText('기지 내 시설을 클릭하면 현재 적용 중인 안락함·오라 버프와 상세 스탯을 확인할 수 있습니다.');
      }
    }

    document.getElementById('tool-inspect').classList.toggle('active', mode === 'inspect');
    document.getElementById('tool-move').classList.toggle('active', mode === 'move');
    document.getElementById('tool-remove').classList.toggle('active', mode === 'remove');
    renderItemCards();
  }

  function setDetailText(msg) {
    document.getElementById('detail-text').textContent = msg;
  }

  function updateHud() {
    const st = ZS.Game.state;
    const hq = st.structGrid[ZS.DATA.HQ_POS.y] && st.structGrid[ZS.DATA.HQ_POS.y][ZS.DATA.HQ_POS.x];

    document.getElementById('hud-wave-num').textContent = `WAVE ${st.wave}`;
    if (st.phase === 'day') {
      document.getElementById('hud-phase-icon').textContent = '☀️';
      document.getElementById('hud-phase-text').textContent = '주간 정비 · 건설 페이즈';
    } else if (st.phase === 'night') {
      document.getElementById('hud-phase-icon').textContent = '🌙';
      document.getElementById('hud-phase-text').textContent = st.power <= 0.01 ? '⚡ 블랙아웃 교전 중!' : '야간 방어 교전 중';
    } else {
      document.getElementById('hud-phase-icon').textContent = '🚨';
      document.getElementById('hud-phase-text').textContent = '작전 실패';
    }

    const hqHp = hq ? Math.ceil(hq.hp) : 0;
    const hqMax = hq ? hq.maxHp : ZS.DATA.HQ_STATS.maxHp;
    document.getElementById('hud-hq-hp').textContent = `${hqHp} / ${hqMax}`;
    document.getElementById('hud-hq-bar').style.width = `${Math.max(0, (hqHp / hqMax) * 100)}%`;

    document.getElementById('res-wood').textContent = Math.floor(st.wood);
    document.getElementById('res-scrap').textContent = Math.floor(st.scrap);
    document.getElementById('res-coin').textContent = Math.floor(st.coin);

    // Power display
    const pwrVal = Math.round(st.power);
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    const pwrBar = document.getElementById('res-power-bar');
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background =
      pwrPct > 35
        ? 'linear-gradient(90deg, #0ea5e9, #5ef2ff)'
        : pwrPct > 5
        ? '#f59e0b'
        : '#ef4444';

    document.querySelector('.power-pill').classList.toggle('blackout', st.isNight && st.power <= 0.01);
    document.getElementById('res-power-sub').textContent = `낮 충전 +${st.dayCharge}⚡ · 대기 -${st.nightIdleDrain.toFixed(1)}/s`;

    // Population display
    document.getElementById('res-pop').innerHTML = `${st.popUsed} / ${st.agents} <span class="pop-cap">(숙소 ${st.popCap})</span>`;

    // Cozy Morale display & tooltip
    const tier = st.cozyTier;
    document.getElementById('res-cozy').textContent = `Lv.${tier.level} (${st.cozyScore})`;
    const nextTier = ZS.DATA.COZY_TIERS.find((t) => t.level === tier.level + 1);
    document.getElementById('cozy-tooltip').innerHTML = `
      <div style="font-weight:800;color:#fde68a;margin-bottom:4px;">💛 ${tier.title} (Lv.${tier.level})</div>
      <div>총 안락함 점수: <b>${st.cozyScore}점</b> <span style="color:#93c5fd">(다양성 시너지 +${st.cozyDiversityBonus})</span></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:6px 0;" />
      <div>• 무전력 전투원 공격력: <b style="color:#86efac">+${Math.round(tier.agentDmg * 100)}%</b></div>
      <div>• 전체 화기 연사속도: <b style="color:#86efac">+${Math.round(tier.fireRate * 100)}%</b></div>
      <div>• 웨이브 코인 배당금: <b style="color:#fde047">+${Math.round(tier.coinBonus * 100)}%</b></div>
      <div>• 아침 무료 자동수리: <b style="color:#7dd3fc">${Math.round(tier.freeRepair * 100)}%</b></div>
      ${
        nextTier
          ? `<div style="margin-top:6px;color:#94a3b8;font-size:11px;">다음 등급(Lv.${nextTier.level})까지 <b>${nextTier.min - st.cozyScore}점</b> 필요</div>`
          : `<div style="margin-top:6px;color:#fde047;font-size:11px;">최고 안락함 등급 달성!</div>`
      }
    `;

    // Toggle Day vs Night right-side action stacks
    const isDay = st.phase === 'day';
    document.getElementById('day-actions').classList.toggle('hidden', !isDay);
    document.getElementById('night-actions').classList.toggle('hidden', st.phase !== 'night');
    document.getElementById('build-dock').style.opacity = isDay ? '1' : '0.75';

    if (isDay) {
      document.getElementById('cta-wave-sub').textContent =
        st.wave % 5 === 0 ? `⚠️ WAVE ${st.wave} 보스전 개시` : `WAVE ${st.wave} 야간 방어 돌입`;

      const rep = ZS.Game.getRepairAllInfo();
      const repBtn = document.getElementById('btn-repair-all');
      const repLbl = document.getElementById('repair-cost-label');
      repBtn.disabled = !rep.needed;
      repLbl.textContent = rep.needed
        ? `비용: 🪵${rep.woodCost} · 🔩${rep.scrapCost}`
        : '모든 시설 내구도 100%';
    } else if (st.phase === 'night') {
      const left = st.spawnQueue.length + st.zombies.length;
      document.getElementById('hud-enemies-left').textContent = `${left}기`;
      document.getElementById('speed-label').textContent = `${st.gameSpeed}x`;

      const rBtn = document.getElementById('btn-skill-repair');
      rBtn.disabled = st.skills.repairCd > 0;
      document.getElementById('skill-repair-cd').textContent =
        st.skills.repairCd > 0 ? `재충전 중 (${Math.ceil(st.skills.repairCd)}초)` : '즉시 전체 시설 +95 HP';

      const sBtn = document.getElementById('btn-skill-airstrike');
      sBtn.disabled = st.skills.airstrikeCd > 0;
      document.getElementById('skill-strike-cd').textContent =
        st.skills.airstrikeCd > 0
          ? `재장전 중 (${Math.ceil(st.skills.airstrikeCd)}초)`
          : uiState.activeSkill === 'airstrike'
          ? '🎯 타격할 타일을 클릭하세요!'
          : '지정 위치 광역 폭격 + 조명';
    }

    renderItemCards();
    if (!document.getElementById('trader-modal').classList.contains('hidden')) {
      renderTraderModal();
    }
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

  function renderTraderModal() {
    const st = ZS.Game.state;
    document.getElementById('trader-coin-val').textContent = `${Math.floor(st.coin)} 🪙`;
    const grid = document.getElementById('trader-grid');
    grid.innerHTML = '';

    st.traderOffers.forEach((offer, idx) => {
      const card = document.createElement('div');
      card.className = 'offer-card';
      const canBuy = !offer.sold && st.coin >= offer.coinCost && st.phase === 'day';
      card.innerHTML = `
        <div>
          <div class="offer-head">
            <span class="offer-icon">${offer.icon}</span>
            <span>${offer.name}</span>
          </div>
          <p class="offer-desc" style="margin-top:6px;">${offer.desc}</p>
        </div>
        <button class="buy-offer-btn" ${canBuy ? '' : 'disabled'}>
          ${offer.sold ? '✔ 보급 완료' : `🪙 ${offer.coinCost} 코인으로 구매`}
        </button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        ZS.Game.buyTraderOffer(idx);
      });
      grid.appendChild(card);
    });
  }

  function inspectTileAt(tx, ty) {
    const st = ZS.Game.state;
    if (tx < 0 || ty < 0 || tx >= ZS.DATA.GRID_SIZE || ty >= ZS.DATA.GRID_SIZE) return;
    uiState.inspectedTile = { tx, ty };

    const obj = st.structGrid[ty][tx];
    const fid = st.floorGrid[ty][tx];
    const fDef = fid ? ZS.DATA.ITEMS[fid] : null;

    if (!obj) {
      if (fDef) {
        setDetailText(`${fDef.icon} [${fDef.name}] 시공됨 — ${fDef.desc}`);
      } else {
        setDetailText(`빈 전술 구역 (${tx}, ${ty}) — 하단 도크에서 방벽, 발전기, 숙소 또는 모던 가구를 선택해 배치하세요.`);
      }
      return;
    }

    if (obj.id === 'command_hq') {
      setDetailText(
        `🏛️ [전술 지휘 본부] 내구도 ${Math.ceil(obj.hp)}/${obj.maxHp} · 기본 충전 +${ZS.DATA.HQ_STATS.baseDayCharge}⚡ · 기본 용량 ${ZS.DATA.HQ_STATS.basePowerCap}⚡ · 기본 숙소 ${ZS.DATA.HQ_STATS.basePopCap}👥`
      );
      return;
    }

    const def = ZS.DATA.ITEMS[obj.id];
    if (!def) return;

    if (def.subType === 'manned' || def.subType === 'turret') {
      const eff = ZS.Game.getStructureEffectiveStats(obj, tx, ty);
      const pwrInfo = def.requiresPower
        ? `⚡야간 대기 -${def.powerIdle}/s, 사격당 -${def.powerShot}`
        : `👥요원 ${def.popUse}명 (무전력 사격)`;
      setDetailText(
        `${def.icon} [${def.name}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 화력 ${eff.damage.toFixed(1)} · 연사 ${eff.fireRate.toFixed(2)}/s · 사거리 ${eff.range.toFixed(1)} · 치명타 ${Math.round(eff.critChance * 100)}% (${pwrInfo})`
      );
    } else {
      setDetailText(`${def.icon} [${def.name}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} — ${def.desc}`);
    }
  }

  // ================= INPUT HANDLING =================
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
      if (!isDrag) inspectTileAt(tx, ty);
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
      ZS.Game.removeAt(tx, ty);
      return;
    }

    if (uiState.mode === 'move') {
      if (isDrag) return;
      if (!uiState.movingSource) {
        const src = st.structGrid[ty] && st.structGrid[ty][tx];
        if (src && src.id !== 'command_hq') {
          uiState.movingSource = { tx, ty };
          const def = ZS.DATA.ITEMS[src.id];
          setDetailText(`🔄 [${def ? def.name : src.id}] 선택됨 — 이동할 빈 타일을 클릭하세요.`);
        } else {
          ZS.Audio.playError();
        }
      } else {
        if (uiState.movingSource.tx === tx && uiState.movingSource.ty === ty) {
          uiState.movingSource = null;
          setDetailText('🔄 이동 취소됨 — 옮길 다른 시설을 클릭하세요.');
        } else if (ZS.Game.moveStructure(uiState.movingSource.tx, uiState.movingSource.ty, tx, ty)) {
          uiState.movingSource = null;
        }
      }
      return;
    }

    if (!isDrag) {
      inspectTileAt(tx, ty);
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
        const g = ZS.Iso.screenToGrid(e.clientX, e.clientY);
        uiState.hoverTile = { tx: g.tx, ty: g.ty };
        isLeftPainting = true;
        lastPaintKey = `${g.tx},${g.ty}`;
        handlePrimaryTileAction(g.tx, g.ty, g.gx, g.gy, false);
      }
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

      const g = ZS.Iso.screenToGrid(e.clientX, e.clientY);
      uiState.hoverTile = { tx: g.tx, ty: g.ty };

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
        setToolMode('inspect');
        document.getElementById('trader-modal').classList.add('hidden');
        document.getElementById('guide-modal').classList.add('hidden');
      } else if (e.code === 'KeyM') {
        setToolMode(uiState.mode === 'move' ? 'inspect' : 'move');
      } else if (e.code === 'KeyX') {
        setToolMode(uiState.mode === 'remove' ? 'inspect' : 'remove');
      } else if (e.code === 'Space' && document.activeElement === document.body) {
        ZS.Iso.resetCamera();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Buttons
    document.getElementById('tool-inspect').addEventListener('click', () => setToolMode('inspect'));
    document.getElementById('tool-move').addEventListener('click', () => setToolMode('move'));
    document.getElementById('tool-remove').addEventListener('click', () => setToolMode('remove'));

    document.getElementById('btn-start-wave').addEventListener('click', () => {
      setToolMode('inspect');
      ZS.Game.startNightWave();
    });

    const openTrader = () => {
      if (ZS.Game.state.phase !== 'day') {
        showWaveBanner('야간 교전 중 교역 불가', '아침이 밝아 정비 페이즈가 되면 보급 상인과 거래할 수 있습니다.', 'warn');
        return;
      }
      renderTraderModal();
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
      updateHud();
    });

    document.getElementById('btn-skill-repair').addEventListener('click', () => {
      ZS.Game.triggerNanoRepair();
    });

    document.getElementById('btn-skill-airstrike').addEventListener('click', () => {
      if (ZS.Game.state.skills.airstrikeCd > 0) return;
      uiState.activeSkill = uiState.activeSkill === 'airstrike' ? null : 'airstrike';
      document.getElementById('btn-skill-airstrike').classList.toggle('targeting', uiState.activeSkill === 'airstrike');
      updateHud();
    });

    document.getElementById('btn-sound').addEventListener('click', () => {
      const muted = ZS.Audio.toggleMute();
      document.getElementById('btn-sound').textContent = muted ? '🔇' : '🔊';
    });

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
        setToolMode('inspect');
        ZS.Iso.resetCamera();
        ZS.Game.clearSaveAndReset();
      }
    });
  }

  // ================= MAIN ANIMATION LOOP =================
  let lastFrameMs = performance.now();
  let hudTick = 0;

  function loop(nowMs) {
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
        updateLiveNightNumbers();
      }
    }

    ZS.Renderer.render(ctx, window.innerWidth, window.innerHeight, ZS.Game.state, uiState, nowMs / 1000);
    requestAnimationFrame(loop);
  }

  function updateLiveNightNumbers() {
    const st = ZS.Game.state;
    const pwrVal = Math.round(st.power);
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    document.getElementById('res-power-bar').style.width = `${Math.max(0, pwrPct)}%`;
    document.querySelector('.power-pill').classList.toggle('blackout', st.isNight && st.power <= 0.01);

    const left = st.spawnQueue.length + st.zombies.length;
    document.getElementById('hud-enemies-left').textContent = `${left}기`;

    const rBtn = document.getElementById('btn-skill-repair');
    rBtn.disabled = st.skills.repairCd > 0;
    document.getElementById('skill-repair-cd').textContent =
      st.skills.repairCd > 0 ? `재충전 중 (${Math.ceil(st.skills.repairCd)}초)` : '즉시 전체 시설 +95 HP';

    const sBtn = document.getElementById('btn-skill-airstrike');
    sBtn.disabled = st.skills.airstrikeCd > 0;
    if (st.skills.airstrikeCd > 0) {
      document.getElementById('skill-strike-cd').textContent = `재장전 중 (${Math.ceil(st.skills.airstrikeCd)}초)`;
    }
  }

  // ================= BOOTSTRAP =================
  function init() {
    resizeCanvas();
    ZS.Iso.resetCamera();

    ZS.Game.setCallbacks({
      onUiChange: updateHud,
      onWaveBanner: showWaveBanner
    });

    if (!ZS.Game.loadGame()) {
      ZS.Game.initNewGame();
      showWaveBanner(
        '📡 OUTPOST ZERO 지휘권 인수 완료',
        '낮 동안 방어선·발전기·모던 쉘터를 구축하고 [웨이브 시작]을 눌러 야간 방어에 돌입하세요!',
        'info'
      );
    }

    renderCategoryTabs();
    updateHud();
    bindEvents();
    requestAnimationFrame(loop);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
