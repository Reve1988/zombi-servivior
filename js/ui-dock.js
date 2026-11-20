window.ZS = window.ZS || {};

(function () {
  const U = ZS._UI;
  const { uiState, ozIcon, escapeHtml, formatInlineCostHtml } = U;

  let lastDockSig = '';
  let lastDockCategory = '';
  let lastTipStateKey = '';
  let lastTipVisible = false;
  let cachedTipW = 240;
  let cachedTipH = 32;

  // ================= UI RENDERING =================
  function renderCategoryTabs() {
    const wrap = document.getElementById('category-tabs');
    wrap.innerHTML = '';
    ZS.DATA.CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (uiState.activeCategory === cat.id ? ' active' : '');
      const iconId = cat.iconId || (cat.id === 'defense' ? 'cat-defense' : cat.id === 'infra' ? 'cat-infra' : 'cat-decor');
      btn.innerHTML = `${ozIcon(iconId, 16)}<span>${escapeHtml(cat.label)}</span>`;
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
    const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
    if (def.layer === 'floor') {
      if (preview && preview.isFloorCapped) {
        return { html: `<span>바닥재 · 상한 도달</span>`, cls: 'tag-cozy-dim' };
      }
      return { html: `<span>바닥재 ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy || 0}</span>`, cls: 'tag-cozy' };
    }
    if (def.subType === 'manned') {
      return { html: `${ozIcon('res-agent', 13)}<span>요원 ${def.popUse} · 무전력</span>`, cls: 'tag-manned' };
    }
    if (def.subType === 'turret') {
      return { html: `${ozIcon('res-power', 13, 'icon-power')}<span>야간전력 소모</span>`, cls: 'tag-power' };
    }
    if (def.subType === 'power') {
      if (def.nightGen > 0) {
        return {
          html: `${ozIcon('res-power', 13, 'icon-power')}<span>밤+${def.nightGen}/s · 낮+${def.dayCharge}</span>`,
          cls: 'tag-power'
        };
      }
      return {
        html: `${ozIcon('phase-day', 13, 'icon-coin')}<span>낮+${def.dayCharge}</span>${ozIcon('res-power', 13, 'icon-power')}<span>· 용량+${def.powerCap}</span>`,
        cls: 'tag-power'
      };
    }
    if (def.subType === 'housing') {
      if (preview && preview.isDiminished) {
        return { html: `${ozIcon('res-agent', 13)}<span>수용+${def.popCap} · +${preview.gain} (50%)</span>`, cls: 'tag-cozy-dim' };
      }
      return {
        html: `${ozIcon('res-agent', 13)}<span>수용+${def.popCap} ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy}</span>`,
        cls: 'tag-manned'
      };
    }
    if (def.category === 'decor') {
      if (def.id === 'repair_bay' && def.aura && def.aura.regenPerSec) {
        return {
          html: `${ozIcon('act-repair', 13, 'icon-heal')}<span>수리 +${def.aura.regenPerSec}/s ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy || 0}</span>`,
          cls: 'tag-manned'
        };
      }
      const pwrPrefix = def.requiresPower ? `${ozIcon('res-power', 13, 'icon-power')}<span>전등 ·</span>` : '';
      if (preview && preview.isDiminished) {
        return { html: `${pwrPrefix}<span>+${preview.gain} (50%)</span>`, cls: 'tag-cozy-dim' };
      }
      return { html: `${pwrPrefix}${ozIcon('res-cozy', 13, 'icon-coin')}<span>안락함 +${def.cozy || 0}</span>`, cls: 'tag-cozy' };
    }
    if (def.subType === 'trap') return { html: `<span>초당 ${def.trapDps} · 둔화 45%</span>`, cls: '' };
    if (def.subType === 'gate') return { html: `<span>전술 관문 · 둔화 18%</span>`, cls: '' };
    if (def.id === 'barricade_wall') return { html: `<span>3단 진화 · 반사 15%</span>`, cls: '' };
    return { html: `<span>방호벽 · HP ${def.maxHp}</span>`, cls: '' };
  }

  function renderItemCards() {
    const container = document.getElementById('item-cards');
    const st = ZS.Game.state;
    if (st.phase === 'night' && container.childElementCount > 0 && lastDockCategory === uiState.activeCategory) {
      return;
    }

    const items = Object.values(ZS.DATA.ITEMS).filter((def) => def.category === uiState.activeCategory);
    const floorCap = ZS.DATA.COZY_FLOOR_CAP || 60;
    const floorCappedAll = (st.cozyFloorRaw || 0) >= floorCap;
    const sigParts = [
      st.phase,
      uiState.activeCategory,
      uiState.mode,
      uiState.selectedItemId || '',
      st.hqLevel || 1,
      st.bossDefeated ? 1 : 0,
      floorCappedAll ? 1 : 0
    ];
    for (let i = 0; i < items.length; i++) {
      const def = items[i];
      const vCnt = (st.freeVouchers[def.id] || 0) + (def.id === 'field_tent' ? st.freeVouchers.shelter_pod || 0 : 0);
      const c = def.cost || {};
      const aff = `${st.wood >= (c.wood || 0) ? 1 : 0}${st.scrap >= (c.scrap || 0) ? 1 : 0}${st.coin >= (c.coin || 0) ? 1 : 0}`;
      const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
      const dimFlag = preview && preview.isDiminished ? 1 : 0;
      sigParts.push(`${def.id}:${vCnt}:${aff}:${dimFlag}`);
    }
    const nextSig = sigParts.join('|');
    if (nextSig === lastDockSig && container.childElementCount > 0) {
      return;
    }
    lastDockSig = nextSig;
    lastDockCategory = uiState.activeCategory;

    container.innerHTML = '';

    items.forEach((def) => {
      const bossLocked = def.unlockedByBoss && !st.bossDefeated;
      const voucherCount = (st.freeVouchers[def.id] || 0) + (def.id === 'field_tent' ? st.freeVouchers.shelter_pod || 0 : 0);
      const reqHq = def.reqHqLevel || 1;
      const hqLockedRaw = (st.hqLevel || 1) < reqHq;
      const voucherBypass = hqLockedRaw && !bossLocked && voucherCount > 0;
      const isLocked = bossLocked || (hqLockedRaw && !voucherBypass);

      const card = document.createElement('div');
      card.className =
        'item-card' +
        (uiState.mode === 'build' && uiState.selectedItemId === def.id ? ' selected' : '') +
        (isLocked ? ' locked' : '') +
        (voucherBypass ? ' voucher-bypass' : '');

      const tag = getCardTagInfo(def);

      let badgeHtml = '';
      const floorCapped = def.layer === 'floor' && floorCappedAll;
      if (bossLocked) {
        badgeHtml = `<span class="card-lock-badge">${ozIcon('state-lock', 14, 'icon-muted')}<span>보스</span></span>`;
      } else if (voucherBypass) {
        badgeHtml = `<span class="card-voucher-badge">${ozIcon('state-voucher', 14, 'icon-coin')}<span>보급권 ${voucherCount}</span></span>`;
      } else if (hqLockedRaw) {
        badgeHtml = `<span class="card-lock-badge">${ozIcon('state-lock', 14, 'icon-muted')}<span>본부 Lv.${reqHq}</span></span>`;
      } else if (floorCapped) {
        badgeHtml = `<span class="card-cap-badge">상한 도달</span>`;
      }

      let costHtml = '';
      if (bossLocked) {
        costHtml = `<span class="cost-chip locked-chip">${ozIcon('state-lock', 14, 'icon-muted')}<span>보스 처치 해금</span></span>`;
      } else if (voucherCount > 0) {
        costHtml = `<span class="cost-chip free">${ozIcon('state-voucher', 14, 'icon-heal')}<span>보급권 ${voucherCount}</span></span>`;
      } else if (hqLockedRaw) {
        costHtml = `<span class="cost-chip locked-chip">${ozIcon('state-lock', 14, 'icon-muted')}<span>본부 Lv.${reqHq}</span></span>`;
      } else {
        const c = def.cost || {};
        if (c.wood) {
          costHtml += `<span class="cost-chip ${st.wood < c.wood ? 'short' : ''}">${ozIcon('res-wood', 14, st.wood < c.wood ? 'icon-danger' : 'icon-wood')}<span>${c.wood}</span></span>`;
        }
        if (c.scrap) {
          costHtml += `<span class="cost-chip ${st.scrap < c.scrap ? 'short' : ''}">${ozIcon('res-scrap', 14, st.scrap < c.scrap ? 'icon-danger' : 'icon-scrap')}<span>${c.scrap}</span></span>`;
        }
        if (c.coin) {
          costHtml += `<span class="cost-chip ${st.coin < c.coin ? 'short' : ''}">${ozIcon('res-coin', 14, st.coin < c.coin ? 'icon-danger' : 'icon-coin')}<span>${c.coin}</span></span>`;
        }
      }

      const thumbUrl = ZS.Renderer.renderItemThumbnail ? ZS.Renderer.renderItemThumbnail(def.id, 40) : '';
      const thumbHtml = thumbUrl
        ? `<img class="card-thumb" src="${thumbUrl}" width="38" height="38" alt="" />`
        : `<span class="card-thumb icon-slot">${ozIcon('cat-defense', 20)}</span>`;

      card.innerHTML = `
        ${badgeHtml}
        <div class="card-top">
          ${thumbHtml}
          <span class="card-title">${escapeHtml(def.name)}</span>
        </div>
        <span class="card-tag ${tag.cls}">${tag.html}</span>
        <div class="card-costs">${costHtml}</div>
      `;

      card.addEventListener('click', () => {
        if (isLocked) {
          ZS.Audio.playError();
          if (bossLocked) {
            U.showWaveBanner('특수 기념비 잠김', 'WAVE 5 알파 타이탄 변이체를 격파하면 해금됩니다.', 'warn');
          } else {
            const reqInfo = ZS.Game.getHqLevelInfo(reqHq);
            U.showWaveBanner(
              `지휘 본부 Lv.${reqHq} 필요`,
              `[${def.name}] 시설은 지휘 본부를 Lv.${reqHq}(${reqInfo.name})로 증축하면 건설할 수 있습니다.`,
              'warn'
            );
          }
          inspectTileAt(ZS.DATA.HQ_POS.x, ZS.DATA.HQ_POS.y);
          return;
        }
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
        const prev = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
        let cozyHint = '';
        if (prev && prev.isFloorCapped) {
          cozyHint = ' (바닥재 안락함 60점 상한 도달)';
        } else if (prev && prev.isDiminished) {
          cozyHint = ` [도배 감쇠 적용: 안락함 +${prev.gain} (50%)]`;
        }
        const catIcon = def.category === 'defense' ? 'cat-defense' : def.category === 'infra' ? 'cat-infra' : 'cat-decor';
        let mountHint = '';
        if (def.canMountOnWall) {
          mountHint =
            def.id === 'led_floodlight'
              ? ' [Lv.2+ 성벽 상부 거치 가능: 조명 +0.6 · 오라 +0.4]'
              : ' [Lv.2+ 성벽 상부 거치 가능: 사거리 +0.5]';
        } else if (def.id === 'barricade_wall') {
          mountHint = ' [기존 거치 대상 위에 덮어 자동 하부 승격 가능]';
        }
        setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)}]</b> — ${escapeHtml(def.desc + cozyHint + mountHint)}`);
      }
    } else {
      uiState.selectedItemId = null;
      if (mode === 'move') {
        setDetailHtml(`${ozIcon('tool-move', 14)} <b>[무료 이동 모드]</b> 옮길 시설을 클릭한 뒤, 이동할 빈 타일을 클릭하세요. (낮 전용)`);
      } else if (mode === 'remove') {
        setDetailHtml(`${ozIcon('tool-remove', 14, 'icon-danger')} <b>[철거 모드]</b> 철거할 시설 또는 바닥 타일을 클릭하면 건설 자원의 80%를 돌려받습니다.`);
      } else {
        setDetailHtml(`${ozIcon('tool-inspect', 14)} 기지 내 시설을 클릭하면 현재 적용 중인 안락함·오라 버프와 상세 스탯을 확인할 수 있습니다.`);
      }
    }

    document.getElementById('tool-inspect').classList.toggle('active', mode === 'inspect');
    document.getElementById('tool-move').classList.toggle('active', mode === 'move');
    document.getElementById('tool-remove').classList.toggle('active', mode === 'remove');
    renderItemCards();
    updateCursorTooltip();
  }

  function syncDockAndHudState() {
    const dockEl = document.getElementById('build-dock');
    if (dockEl) {
      dockEl.classList.toggle('collapsed', !!uiState.dockCollapsed);
    }
    const topHudEl = document.getElementById('top-hud');
    if (topHudEl) {
      topHudEl.classList.toggle('hud-res-compact', !!uiState.hudResCompact);
    }
    const hudResBtn = document.getElementById('btn-toggle-hud-res');
    if (hudResBtn) {
      hudResBtn.innerHTML = ozIcon(uiState.hudResCompact ? 'ui-chevron-down' : 'ui-chevron-up', 15);
      hudResBtn.title = uiState.hudResCompact ? '보조 자원 라벨 펼치기' : '보조 자원 간소화';
    }
  }

  function setDockCollapsed(flag) {
    uiState.dockCollapsed = !!flag;
    syncDockAndHudState();
  }

  function updateCursorTooltip() {
    const tipEl = document.getElementById('cursor-tooltip');
    if (!tipEl) return;
    const st = ZS.Game.state;
    const hideTip = () => {
      if (lastTipVisible) {
        tipEl.classList.remove('ok');
        tipEl.classList.add('hidden');
        lastTipVisible = false;
      }
      lastTipStateKey = '';
    };

    if (!uiState.pointerClient.inside || !uiState.hoverTile || st.phase !== 'day') {
      hideTip();
      return;
    }

    const { tx, ty } = uiState.hoverTile;
    const N = ZS.DATA.GRID_SIZE;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      hideTip();
      return;
    }

    const moveSrcKey = uiState.movingSource ? `${uiState.movingSource.tx},${uiState.movingSource.ty}` : '';
    const vKey = uiState.selectedItemId
      ? `${st.freeVouchers[uiState.selectedItemId] || 0},${st.freeVouchers.barricade_wall || 0}`
      : '0';
    const nextKey = `${st.phase}|${uiState.mode}|${uiState.selectedItemId || ''}|${tx},${ty}|${moveSrcKey}|${Math.floor(st.wood)},${Math.floor(st.scrap)},${Math.floor(st.coin)}|${st.popUsed},${st.agents},${st.popCap}|${st.hqLevel}|${st.bossDefeated ? 1 : 0}|${vKey}`;

    if (nextKey !== lastTipStateKey) {
      lastTipStateKey = nextKey;
      let tipText = null;
      let tipKind = 'err';
      let tipIcon = 'state-alert';
      let tipIconCls = 'icon-danger';

      if (uiState.mode === 'build' && uiState.selectedItemId && ZS.Game.canPlaceItem) {
        const check = ZS.Game.canPlaceItem(uiState.selectedItemId, tx, ty);
        const hoveredSt = st.structGrid[ty] && st.structGrid[ty][tx];
        const itemDef = ZS.DATA.ITEMS[uiState.selectedItemId];
        if (check && !check.ok && check.reason) {
          tipText = check.reason;
          tipKind = 'err';
          if (hoveredSt && hoveredSt.id === 'barricade_wall' && (hoveredSt.level || 1) === 1 && itemDef && itemDef.canMountOnWall) {
            tipIcon = 'mount';
          }
        } else if (check && check.ok && check.mountOnWall && hoveredSt) {
          const wName = ZS.Game.getStructureDisplayName(hoveredSt);
          const bonusLabel = uiState.selectedItemId === 'led_floodlight' ? '조명 +0.6 · 사기 반경 +0.4' : '사거리 +0.5';
          tipText = `${wName} 상부 거치 가능 (${bonusLabel})`;
          tipKind = 'ok';
          tipIcon = 'mount';
          tipIconCls = 'icon-heal';
        } else if (check && check.ok && check.autoUnderlay && hoveredSt) {
          const uName = ZS.Game.getStructureDisplayName(hoveredSt);
          const uCost = check.underlayCost || { wood: 10, scrap: 12 };
          const vCount = (st.freeVouchers && st.freeVouchers.barricade_wall) || 0;
          const costStr = vCount > 0 ? '보급권 1 소모' : `목재 ${uCost.wood}·철재 ${uCost.scrap}`;
          tipText = `성벽 자동 하부 승격 (${uName} Lv·숙련 유지, ${costStr})`;
          tipKind = 'ok';
          tipIcon = 'wall-link';
          tipIconCls = 'icon-heal';
        }
      } else if (uiState.mode === 'move' && uiState.movingSource) {
        if (tx <= 0 || ty <= 0 || tx >= N - 1 || ty >= N - 1) {
          tipText = '외곽 진입 구역으로는 시설을 옮길 수 없습니다.';
        } else if (!(uiState.movingSource.tx === tx && uiState.movingSource.ty === ty) && st.structGrid[ty] && st.structGrid[ty][tx]) {
          const srcCell = st.structGrid[uiState.movingSource.ty] && st.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
          const srcUnit = srcCell && (srcCell.mounted || srcCell);
          const srcDef = srcUnit ? ZS.DATA.ITEMS[srcUnit.id] : null;
          const dest = st.structGrid[ty][tx];
          if (srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall') {
            if ((dest.level || 1) >= 2 && !dest.mounted) {
              tipText = `${ZS.Game.getStructureDisplayName(dest)} 상부에 거치 이동`;
              tipKind = 'ok';
              tipIcon = 'mount';
              tipIconCls = 'icon-heal';
            } else if ((dest.level || 1) === 1) {
              tipText = '철조망(Lv.1) 위에는 거치 불가 — [U]로 헤스코 방벽 강화 필요';
              tipIcon = 'mount';
            } else {
              tipText = '이미 다른 시설이 거치된 성벽입니다.';
            }
          } else {
            tipText = '이미 다른 시설이 설치된 타일입니다.';
          }
        }
      }

      if (!tipText) {
        if (lastTipVisible) {
          tipEl.classList.remove('ok');
          tipEl.classList.add('hidden');
          lastTipVisible = false;
        }
        return;
      }

      tipEl.innerHTML = `${ozIcon(tipIcon, 14, tipIconCls)}<span>${escapeHtml(tipText)}</span>`;
      tipEl.classList.toggle('ok', tipKind === 'ok');
      tipEl.classList.remove('hidden');
      lastTipVisible = true;
      cachedTipW = tipEl.offsetWidth || 240;
      cachedTipH = tipEl.offsetHeight || 32;
    }

    if (!lastTipVisible) return;

    const vw = window.innerWidth || 1600;
    const vh = window.innerHeight || 900;
    const x = Math.max(12, Math.min(vw - cachedTipW - 14, uiState.pointerClient.x + 16));
    const y = Math.max(70, Math.min(vh - cachedTipH - 14, uiState.pointerClient.y + 16));
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;
  }

  function setDetailHtml(html, actionsHtml) {
    const bar = document.getElementById('detail-bar');
    if (bar) bar.classList.remove('composite');
    document.getElementById('detail-text').innerHTML = html;
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = actionsHtml || '';
    }
  }

  function setCompositeDetailHtml(innerHtml) {
    const bar = document.getElementById('detail-bar');
    if (bar) bar.classList.add('composite');
    document.getElementById('detail-text').innerHTML = innerHtml;
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = '';
    }
  }

  function formatAuraStacksText(auraStacks) {
    if (!auraStacks) return '';
    const LABELS = {
      gas_heater: '히터',
      led_floodlight: '투광등',
      vending_machine: '자판기',
      boss_trophy: '기념비'
    };
    const keys = Object.keys(auraStacks);
    if (keys.length === 0) return '';
    const parts = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const cnt = auraStacks[k] || 0;
      if (cnt <= 0) continue;
      const lbl = LABELS[k] || k;
      if (cnt === 1) parts.push(`${lbl} ×1(100%)`);
      else if (cnt === 2) parts.push(`${lbl} ×2(150% 상한)`);
      else parts.push(`${lbl} ×${cnt}(150% 상한·초과 0%)`);
    }
    return parts.length > 0 ? ` · 오라[${parts.join(', ')}]` : '';
  }

  function ensureTraderSections(grid) {
    const parent = grid && grid.parentNode;
    if (!parent) return { exchangeWrap: null, consumWrap: null };
    let panel = document.getElementById('trader-ops-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'trader-ops-panel';
      panel.className = 'trader-ops-panel';
      panel.innerHTML = `
        <div id="trader-exchange-bar" class="trader-exchange-bar"></div>
        <div id="trader-consumables-bar" class="trader-consumables-bar"></div>
      `;
      parent.insertBefore(panel, grid);
    }
    return {
      exchangeWrap: document.getElementById('trader-exchange-bar'),
      consumWrap: document.getElementById('trader-consumables-bar')
    };
  }

  function renderTraderModal() {
    const st = ZS.Game.state;
    const isDay = st.phase === 'day';
    const RES_ICON = {
      wood: { icon: 'res-wood', cls: 'icon-wood', name: '목재' },
      scrap: { icon: 'res-scrap', cls: 'icon-scrap', name: '고철' },
      coin: { icon: 'res-coin', cls: 'icon-coin', name: '코인' }
    };

    const coinValEl = document.getElementById('trader-coin-val');
    if (coinValEl) {
      if (coinValEl.previousElementSibling) {
        coinValEl.previousElementSibling.textContent = '보유 자재:';
      }
      coinValEl.innerHTML =
        `${ozIcon('res-coin', 16, 'icon-coin')}<span>${Math.floor(st.coin)}</span>` +
        `<span class="trader-res-sep">·</span>` +
        `${ozIcon('res-wood', 15, 'icon-wood')}<span>${Math.floor(st.wood)}</span>` +
        `<span class="trader-res-sep">·</span>` +
        `${ozIcon('res-scrap', 15, 'icon-scrap')}<span>${Math.floor(st.scrap)}</span>`;
    }

    const refreshBtn = document.getElementById('btn-refresh-trader');
    const refreshCost = st.traderRefreshCost || 15;
    if (refreshBtn) {
      refreshBtn.disabled = !isDay || st.coin < refreshCost;
      refreshBtn.innerHTML = `${ozIcon('sys-reset', 15)}<span>무전 보급 목록 갱신 (${refreshCost} 코인)</span>`;
    }

    const grid = document.getElementById('trader-grid');
    const { exchangeWrap, consumWrap } = ensureTraderSections(grid);

    if (exchangeWrap) {
      const routes = ZS.DATA.TRADER_EXCHANGE_ROUTES || [];
      const rowsHtml = routes
        .map((r) => {
          const fromMeta = RES_ICON[r.from] || RES_ICON.scrap;
          const toMeta = RES_ICON[r.to] || RES_ICON.wood;
          const curStock = st[r.from] || 0;
          const btnsHtml = [1, 5, 10]
            .map((mult) => {
              const need = r.cost * mult;
              const gain = r.give * mult;
              const disabled = !isDay || curStock < need ? 'disabled' : '';
              return `<button type="button" class="exchange-mult-btn" data-route="${escapeHtml(r.id)}" data-mult="${mult}" ${disabled} title="${fromMeta.name} ${need} → ${toMeta.name} +${gain}">×${mult}</button>`;
            })
            .join('');
          return `
            <div class="exchange-row">
              <div class="exchange-rate">
                <span class="inline-icon-text">${ozIcon(fromMeta.icon, 14, fromMeta.cls)}<b>${r.cost}</b></span>
                <span class="exchange-arrow">→</span>
                <span class="inline-icon-text">${ozIcon(toMeta.icon, 14, toMeta.cls)}<b>+${r.give}</b></span>
              </div>
              <div class="exchange-btns">${btnsHtml}</div>
            </div>
          `;
        })
        .join('');

      exchangeWrap.innerHTML = `
        <div class="trader-section-head">
          <span class="inline-icon-text">${ozIcon('act-trader', 15, 'icon-coin')}<b>상시 대량 자원 환전소</b></span>
          <span class="trader-section-sub">품절 없음 · 왕복 차익 방지 수수료 적용</span>
        </div>
        <div class="exchange-grid">${rowsHtml}</div>
      `;

      exchangeWrap.querySelectorAll('.exchange-mult-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-route');
          const mult = Number(btn.getAttribute('data-mult'));
          ZS.Game.exchangeResource(rId, mult);
        });
      });
    }

    if (consumWrap) {
      const list = ZS.DATA.TRADER_NIGHT_CONSUMABLES || [];
      const activeMap = st.nightConsumables || {};
      const cardsHtml = list
        .map((item) => {
          const cost = ZS.Game.getNightConsumableCost(item.id, st.wave) || { scrap: 60, coin: 30 };
          const active = !!activeMap[item.stateKey];
          const canBuy = isDay && !active && st.scrap >= cost.scrap && st.coin >= cost.coin;
          const btnInner = active
            ? `${ozIcon('state-rank', 14, 'icon-heal')}<span>오늘 밤 장착 완료</span>`
            : `${ozIcon('res-scrap', 14, 'icon-scrap')}<span>${cost.scrap}</span><span>+</span>${ozIcon('res-coin', 14, 'icon-coin')}<span>${cost.coin} 보급</span>`;
          return `
            <div class="consumable-card${active ? ' active' : ''}">
              <div class="consumable-info">
                <div class="consumable-title inline-icon-text">${ozIcon(item.svgIcon || 'cat-defense', 15, item.svgColorCls || 'icon-coin')}<span>${escapeHtml(item.name)}</span></div>
                <div class="consumable-desc">${escapeHtml(item.desc)}</div>
              </div>
              <button type="button" class="buy-consumable-btn${active ? ' active' : ''}" data-cid="${escapeHtml(item.id)}" ${canBuy ? '' : 'disabled'}>
                ${btnInner}
              </button>
            </div>
          `;
        })
        .join('');

      consumWrap.innerHTML = `
        <div class="trader-section-head">
          <span class="inline-icon-text">${ozIcon('phase-night', 15, 'icon-coin')}<b>일회성 야간 작전 보급 (WAVE ${st.wave} 전용)</b></span>
          <span class="trader-section-sub">다음 1회 야간 전투만 유지 · 새벽 자동 해제</span>
        </div>
        <div class="consumable-grid">${cardsHtml}</div>
      `;

      consumWrap.querySelectorAll('.buy-consumable-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-cid');
          ZS.Game.buyNightConsumable(cid);
        });
      });
    }

    grid.innerHTML = '';

    st.traderOffers.forEach((offer, idx) => {
      const card = document.createElement('div');
      card.className = 'offer-card';
      const canBuy = !offer.sold && st.coin >= offer.coinCost && isDay;

      let iconVisualHtml = '';
      if (offer.type === 'free_item' && offer.itemId && ZS.Renderer.renderItemThumbnail) {
        const tierOpt = offer.spawnTier || (offer.itemId === 'shelter_pod' ? 3 : 1);
        const thumbSrc = ZS.Renderer.renderItemThumbnail(offer.itemId, 44, tierOpt);
        iconVisualHtml = `<span class="offer-icon-box"><img class="offer-thumb" src="${thumbSrc}" width="40" height="40" alt="" /></span>`;
      } else {
        const svgId =
          offer.svgIcon ||
          (offer.id === 'wood_pack'
            ? 'res-wood'
            : offer.id === 'scrap_pack'
            ? 'res-scrap'
            : offer.type === 'power_boost'
            ? 'res-power'
            : 'res-agent');
        const svgCls =
          offer.svgColorCls !== undefined
            ? offer.svgColorCls
            : svgId === 'res-wood'
            ? 'icon-wood'
            : svgId === 'res-scrap'
            ? 'icon-scrap'
            : svgId === 'res-power'
            ? 'icon-power'
            : '';
        iconVisualHtml = `<span class="offer-icon-box">${ozIcon(svgId, 24, svgCls)}</span>`;
      }

      card.innerHTML = `
        <div>
          <div class="offer-head">
            ${iconVisualHtml}
            <span>${escapeHtml(offer.name)}</span>
          </div>
          <p class="offer-desc" style="margin-top:8px;">${escapeHtml(offer.desc)}</p>
        </div>
        <button class="buy-offer-btn" ${canBuy ? '' : 'disabled'}>
          ${offer.sold ? '<span>보급 완료</span>' : `${ozIcon('res-coin', 15, 'icon-coin')}<span>${offer.coinCost} 코인으로 구매</span>`}
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
        setDetailHtml(`${ozIcon('cat-decor', 14, 'icon-coin')} <b>[${escapeHtml(fDef.name)}]</b> 시공됨 — ${escapeHtml(fDef.desc)}`);
      } else {
        setDetailHtml(`빈 전술 구역 (${tx}, ${ty}) — 하단 도크에서 방벽, 발전기, 숙소 또는 모던 가구를 선택해 배치하세요.`);
      }
      return;
    }

    if (obj.id === 'command_hq') {
      const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
      const wpnText = hqInfo.weapon
        ? `무장: ${hqInfo.weapon.name}(피해 ${hqInfo.weapon.damage}, 사거리 ${hqInfo.weapon.range})`
        : '무장: 없음(Lv.2 개방)';
      const upCheck = ZS.Game.canUpgradeHq();
      let actionHtml = '';
      if (st.hqLevel < 4) {
        const nextInfo = ZS.Game.getHqLevelInfo(st.hqLevel + 1);
        const costHtml = formatInlineCostHtml(nextInfo.cost || {}, 14);
        const disabledAttr = upCheck.ok ? '' : 'disabled';
        actionHtml = `<button id="btn-upgrade-hq" class="detail-upgrade-btn" ${disabledAttr} title="${escapeHtml(upCheck.ok ? `${nextInfo.name} 증축` : upCheck.reason)}">${ozIcon('state-upgrade', 16)}<span>본부 Lv.${nextInfo.level} 증축</span>(${costHtml})</button>`;
      } else {
        actionHtml = `<span class="cost-chip free">★ 최고 등급(Lv.4)</span>`;
      }

      const nightBuffs = [];
      if (st.nightConsumables && st.nightConsumables.overpressureAmmo) nightBuffs.push('고압 탄약 +20%');
      if (st.nightConsumables && st.nightConsumables.reactiveArmor) nightBuffs.push('반응 장갑 -20%피격/+15%반사');
      const buffTxt = nightBuffs.length > 0 ? ` · 야간보급[${nightBuffs.join(', ')}]` : '';

      setDetailHtml(
        `${ozIcon('hud-hq', 14)} <b>[${escapeHtml(hqInfo.name)} · Lv.${st.hqLevel}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 충전 +${hqInfo.baseDayCharge} · 용량 ${hqInfo.basePowerCap} · 숙소 ${hqInfo.basePopCap}명 · ${escapeHtml(wpnText)}${escapeHtml(buffTxt)}`,
        actionHtml
      );

      const upBtn = document.getElementById('btn-upgrade-hq');
      if (upBtn) {
        upBtn.addEventListener('click', () => {
          ZS.Game.upgradeHq();
        });
      }
      return;
    }

    const def = ZS.DATA.ITEMS[obj.id];
    if (!def) return;

    const buildRankWidgetHtml = (targetObj, eff) => {
      const rank = eff.rank || 0;
      const rInfo = eff.rankInfo || ZS.Game.getVeterancyRankInfo(rank);
      const xp = targetObj.xp || 0;
      const ranks = ZS.DATA.VETERANCY_RANKS || [];
      const nextR = ranks[rank + 1] || null;
      const curMin = rInfo.minXp || 0;
      const pct = nextR
        ? Math.max(0, Math.min(100, ((xp - curMin) / Math.max(1, nextR.minXp - curMin)) * 100))
        : 100;
      const remLabel = nextR ? `남은 ${(Math.max(0.1, nextR.minXp - xp)).toFixed(1)} XP` : 'MAX';
      return `
        <span class="detail-rank-box" title="처치 ${targetObj.kills || 0}기 · 누적 ${xp.toFixed(1)} XP">
          <span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${ozIcon('state-rank', 14)}</span>
          <span class="detail-rank-name" style="color:${rInfo.color};">${escapeHtml(rInfo.name)}</span>
          <span class="detail-xp-track"><span class="detail-xp-fill" style="width:${pct.toFixed(1)}%;background:${rInfo.color};"></span></span>
          <span class="detail-xp-rem">${remLabel}</span>
        </span>
      `;
    };

    const lv = obj.level || 1;
    if (obj.id === 'barricade_wall' && lv >= 2 && obj.mounted) {
      const m = obj.mounted;
      const mDef = ZS.DATA.ITEMS[m.id];
      const mLv = m.level || 1;
      const wallName = ZS.Game.getStructureDisplayName(obj);
      const wallProf = ZS.Game.getStructLevelProfile(def, lv);
      const wallHpPct = obj.maxHp > 0 ? Math.max(0, Math.min(100, (obj.hp / obj.maxHp) * 100)) : 100;
      const mHpPct = m.maxHp > 0 ? Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100)) : 100;
      const mEff = ZS.Game.getStructureEffectiveStats(m, tx, ty, undefined, true);

      let mSubStats = '';
      let mRankHtml = '';
      if (mDef && (mDef.subType === 'manned' || mDef.subType === 'turret')) {
        mRankHtml = buildRankWidgetHtml(m, mEff);
        const mPopTxt = mDef.subType === 'manned' ? ` · 요원 ${(mEff.prof && mEff.prof.popUse) || mDef.popUse}명` : '';
        const mAuraTxt = formatAuraStacksText(mEff.auraStacks);
        mSubStats = `화력 ${mEff.damage.toFixed(1)} · 연사 ${mEff.fireRate.toFixed(2)}/s · 사거리 ${mEff.range.toFixed(1)} (+0.5 고지대) · 치명 ${Math.round(mEff.critChance * 100)}%${mPopTxt}${mAuraTxt}`;
      } else if (mDef && mDef.id === 'led_floodlight') {
        const lr = mEff.lightRadius != null ? mEff.lightRadius : mDef.lightRadius;
        const ar = (mDef.aura && mDef.aura.radius ? mDef.aura.radius : 2.4) + 0.4;
        mSubStats = `조명 반경 ${lr.toFixed(1)} (+0.6) · 사기 오라 ${ar.toFixed(1)} (+0.4) · 안락함 +${mDef.cozy || 0}`;
      } else {
        mSubStats = mDef ? escapeHtml(mDef.desc) : '';
      }

      let topUpHtml = '';
      if (mDef && ZS.Game.isUpgradeableDef(mDef)) {
        const topCheck = ZS.Game.canUpgradeStructure(tx, ty);
        if (mLv >= 3) {
          topUpHtml = `<span class="cost-chip free">◆◆◆ Lv.3 MAX</span>`;
        } else {
          const topCost = ZS.Game.getUpgradeCost(mDef, mLv) || {};
          const topCostHtml = formatInlineCostHtml(topCost, 13);
          const upCls = mLv + 1 === 3 && !topCheck.hqCapped ? 'icon-max' : '';
          const inner = topCheck.hqCapped
            ? `${ozIcon('state-lock', 13, 'icon-muted')}<span>본부 Lv.${topCheck.reqHqLevel} 필요</span>(${topCostHtml})`
            : `${ozIcon('state-upgrade', 14, upCls)}<span>상부 Lv.${mLv + 1}</span>(${topCostHtml})<span>[U]</span>`;
          topUpHtml = `<button id="btn-comp-up-top" class="detail-upgrade-btn" ${topCheck.ok ? '' : 'disabled'} title="${escapeHtml(topCheck.ok ? '단축키 U로 상부 강화' : topCheck.reason)}">${inner}</button>`;
        }
      }

      let wallUpHtml = '';
      const wallCheck = ZS.Game.canUpgradeWallBase ? ZS.Game.canUpgradeWallBase(tx, ty) : null;
      const wallMaxLv = ZS.Game.getStructMaxTier ? ZS.Game.getStructMaxTier(def) : 3;
      if (lv >= wallMaxLv) {
        wallUpHtml = `<span class="cost-chip free">최종 진화 완료</span>`;
      } else if (wallCheck) {
        const wCost = wallCheck.cost || ZS.Game.getUpgradeCost(def, lv) || {};
        const wCostHtml = formatInlineCostHtml(wCost, 13);
        const nextWallProf = ZS.Game.getStructLevelProfile(def, lv + 1);
        const wInner = wallCheck.hqCapped
          ? `${ozIcon('state-lock', 13, 'icon-muted')}<span>본부 Lv.${wallCheck.reqHqLevel} 필요</span>(${wCostHtml})`
          : `${ozIcon('wall-upgrade', 14)}<span>${escapeHtml(nextWallProf.levelName || '합금 장갑 성벽')} 업그레이드</span>(${wCostHtml})<span>[G]</span>`;
        wallUpHtml = `<button id="btn-comp-up-wall" class="detail-upgrade-btn" ${wallCheck.ok ? '' : 'disabled'} title="${escapeHtml(wallCheck.ok ? '단축키 G로 상부 유지 성벽 승강' : wallCheck.reason)}">${wInner}</button>`;
      }

      const wallStatSummary = `반사 ${Math.round((wallProf.thornsRatio || 0) * 100)}% (최소 ${wallProf.thornsMin || 0})`;
      const compHtml = `
        <div class="comp-list">
          <div class="comp-row top">
            <span class="comp-slot">${ozIcon('mount', 13)} 상부 거치</span>
            <div class="comp-info">
              <div class="comp-title-line">
                <span class="comp-title">${escapeHtml(mDef ? mDef.name : m.id)}</span>
                ${mDef && ZS.Game.isUpgradeableDef(mDef) ? `<span class="comp-lv">Lv.${mLv}</span>` : ''}
                ${mRankHtml}
                <div class="comp-hpb-wrap">
                  <span class="comp-hpb"><span style="width:${mHpPct.toFixed(1)}%"></span></span>
                  <span class="comp-hp-txt">${Math.ceil(m.hp)}/${m.maxHp}</span>
                </div>
              </div>
              <div class="comp-sub">${mSubStats}</div>
            </div>
            <div class="comp-actions">
              ${topUpHtml}
              <button id="btn-comp-move-top" class="detail-upgrade-btn" ${st.phase !== 'day' ? 'disabled' : ''} title="상부 유닛만 분리해 이동 (M)">${ozIcon('unmount', 13)}<span>분리 이동 M</span></button>
              <button id="btn-comp-demolish-top" class="detail-upgrade-btn danger" ${st.phase !== 'day' ? 'disabled' : ''} title="상부 유닛만 먼저 철거 (X)">${ozIcon('tool-remove', 13, 'icon-danger')}<span>상부 철거 X</span></button>
            </div>
          </div>
          <div class="comp-row">
            <span class="comp-slot">${ozIcon('wall-link', 13)} 하부 성벽</span>
            <div class="comp-info">
              <div class="comp-title-line">
                <span class="comp-title">${escapeHtml(wallName)}</span>
                <div class="comp-hpb-wrap">
                  <span class="comp-hpb wall"><span style="width:${wallHpPct.toFixed(1)}%"></span></span>
                  <span class="comp-hp-txt">${Math.ceil(obj.hp)}/${obj.maxHp}</span>
                </div>
              </div>
              <div class="comp-sub">${wallStatSummary}</div>
            </div>
            <div class="comp-actions">
              ${wallUpHtml}
            </div>
          </div>
          <div class="comp-foot">
            <span class="inline-icon-text">${ozIcon('collapse-drop', 13)}<span>하부 성벽 파괴 시 상부 유닛이 지상 낙하 (최대 HP -25%, 최소 1 HP)</span></span>
            <span>단축키: U 상부 · G 성벽 · M 분리 · X 철거</span>
          </div>
        </div>
      `;
      setCompositeDetailHtml(compHtml);
      document.getElementById('btn-comp-up-top')?.addEventListener('click', () => {
        ZS.Game.upgradeStructure(tx, ty);
      });
      document.getElementById('btn-comp-up-wall')?.addEventListener('click', () => {
        if (ZS.Game.upgradeWallBase) ZS.Game.upgradeWallBase(tx, ty);
      });
      document.getElementById('btn-comp-move-top')?.addEventListener('click', () => {
        if (st.phase !== 'day') return;
        setToolMode('move');
        uiState.movingSource = { tx, ty };
        const canMountDest = !!(mDef && mDef.canMountOnWall);
        setDetailHtml(`${ozIcon('unmount', 14)} <b>[${escapeHtml(ZS.Game.getStructureDisplayName(m))}]</b> (상부 분리) 선택됨 — 이동할 빈 타일${canMountDest ? ' 또는 헤스코+ 성벽' : ''}을 클릭하세요.`);
      });
      document.getElementById('btn-comp-demolish-top')?.addEventListener('click', () => {
        if (st.phase !== 'day') return;
        U.handleRemoveTile(tx, ty);
      });
      return;
    }

    const isTierEvo = !!(ZS.Game.isTierEvolutionDef && ZS.Game.isTierEvolutionDef(def));
    const maxLv = isTierEvo && ZS.Game.getStructMaxTier ? ZS.Game.getStructMaxTier(def) : 3;
    let actionHtml = '';
    if (ZS.Game.isUpgradeableDef(def)) {
      const upCheck = ZS.Game.canUpgradeStructure(tx, ty);
      if (lv >= maxLv) {
        if (isTierEvo) {
          actionHtml = `<span class="cost-chip free">최종 진화 완료</span>`;
        } else {
          const perk = ZS.DATA.LV3_PERK_LABELS && ZS.DATA.LV3_PERK_LABELS[def.id];
          actionHtml = `<span class="cost-chip free" title="${escapeHtml(perk || '')}">◆◆◆ Lv.3 MAX</span>`;
        }
      } else {
        const cost = ZS.Game.getUpgradeCost(def, lv) || {};
        const costHtml = formatInlineCostHtml(cost, 14);
        const upIconCls = lv + 1 === maxLv && !upCheck.hqCapped ? 'icon-max' : '';
        const nextProfBtn = ZS.Game.getStructLevelProfile(def, lv + 1);
        const btnInner = upCheck.hqCapped
          ? `${ozIcon('state-lock', 14, 'icon-muted')}<span>본부 Lv.${upCheck.reqHqLevel} 필요</span>(${costHtml})`
          : isTierEvo
          ? `${ozIcon('state-upgrade', 16, upIconCls)}<span>${escapeHtml(nextProfBtn.levelName || def.name)} 업그레이드</span>(${costHtml})<span>[U]</span>`
          : `${ozIcon('state-upgrade', 16, upIconCls)}<span>Lv.${lv + 1} 강화</span>(${costHtml})<span>[U]</span>`;
        actionHtml = `<button id="btn-upgrade-struct" class="detail-upgrade-btn" ${upCheck.ok ? '' : 'disabled'} title="${escapeHtml(upCheck.ok ? '단축키 U로 즉시 강화' : upCheck.reason)}">${btnInner}</button>`;
      }
    }

    const catIcon = def.category === 'defense' ? 'cat-defense' : def.category === 'infra' ? 'cat-infra' : 'cat-decor';

    if (def.subType === 'manned' || def.subType === 'turret') {
      const eff = ZS.Game.getStructureEffectiveStats(obj, tx, ty);
      const rankWidgetHtml = buildRankWidgetHtml(obj, eff);
      actionHtml = rankWidgetHtml + actionHtml;

      const curPopUse = (eff.prof && eff.prof.popUse) || def.popUse;
      const pwrInfo = def.requiresPower
        ? `${ozIcon('res-power', 13, 'icon-power')}대기 -${eff.powerIdle}/s, 사격 -${eff.powerShot}`
        : `${ozIcon('res-agent', 13)}요원 ${curPopUse}명`;
      const auraInfo = formatAuraStacksText(eff.auraStacks);
      let nextPreview = '';
      if (lv < 3) {
        const nextEff = ZS.Game.getStructureEffectiveStats(obj, tx, ty, lv + 1);
        const nextPopHint = def.subType === 'manned' && lv + 1 === 3 ? ' · 요원 2명' : '';
        const perkHint = lv + 1 === 3 && nextEff.perkLabel ? ` · ★${escapeHtml(nextEff.perkLabel.split(' (')[0])}` : '';
        nextPreview = ` → [Lv.${lv + 1}: 화력 ${nextEff.damage.toFixed(1)} · 연사 ${nextEff.fireRate.toFixed(2)}/s${nextPopHint}${perkHint}]`;
      } else if (eff.perkLabel) {
        nextPreview = ` · ★${escapeHtml(eff.perkLabel)}`;
      }
      setDetailHtml(
        `${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)} Lv.${lv}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 화력 ${eff.damage.toFixed(1)} · 연사 ${eff.fireRate.toFixed(2)}/s · 사거리 ${eff.range.toFixed(1)} · 치명 ${Math.round(eff.critChance * 100)}% (${pwrInfo})${auraInfo}${nextPreview}`,
        actionHtml
      );
    } else if (ZS.Game.isUpgradeableDef(def)) {
      const prof = ZS.Game.getStructLevelProfile(def, lv);
      const dispName = ZS.Game.getStructureDisplayName(obj);
      let statSummary = '';
      if (def.subType === 'wall') {
        const parts = [];
        if (prof.thornsRatio > 0) {
          parts.push(`피해 반사 ${Math.round(prof.thornsRatio * 100)}% (최소 ${prof.thornsMin || 0})`);
        }
        if (def.id === 'barricade_wall') {
          if (lv === 1) {
            parts.push('초소·포탑·조명 거치 불가 — [U] 헤스코 전술 방벽 업그레이드 시 상부 거치 해금');
          } else {
            parts.push('상부 거치 가능 (사거리 +0.5)');
          }
        }
        if (prof.perkLabel) parts.push(`★${escapeHtml(prof.perkLabel)}`);
        statSummary = parts.join(' · ');
      } else if (def.subType === 'gate') {
        const slowPct = Math.round((1 - (prof.gateSlowFactor || 0.75)) * 100);
        const slowRad = prof.gateSlowRadius || 1.15;
        statSummary = `전술 관문 · 주변 둔화 ${slowPct}% (반경 ${slowRad}칸)${prof.thornsRatio > 0 ? ` · 반사 ${Math.round(prof.thornsRatio * 100)}% (최소 ${prof.thornsMin || 4})` : ''}`;
      } else if (def.id === 'razor_pad') {
        const vulnTxt = prof.vulnMult > 1 ? ` · 받는피해 +${Math.round((prof.vulnMult - 1) * 100)}%` : '';
        statSummary = `지속피해 ${prof.trapDps}/s · 마모 ${prof.trapWear}/s · 둔화 ${Math.round((1 - prof.slowFactor) * 100)}%${vulnTxt}`;
      } else if (def.id === 'repair_bay') {
        const lightTxt = prof.lightRadius > 0 ? ` · 야간 조명 ${prof.lightRadius}칸` : '';
        statSummary = `${ozIcon('act-repair', 13, 'icon-heal')}수리 반경 ${prof.auraRadius}칸 · 회복 +${prof.regenPerSec} HP/s · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}${lightTxt}`;
      } else if (def.subType === 'power') {
        const nightTxt = prof.nightGen > 0 ? ` · 야간 +${prof.nightGen.toFixed(2)}/s` : '';
        statSummary = `${ozIcon('res-power', 13, 'icon-power')}주간 충전 +${prof.dayCharge}${nightTxt} · 저장 용량 +${prof.powerCap}`;
      } else if (def.subType === 'housing') {
        statSummary = `${ozIcon('res-agent', 13)}요원 수용 +${prof.popCap}명 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}`;
      }
      if (lv < maxLv) {
        const nextProf = ZS.Game.getStructLevelProfile(def, lv + 1);
        const nextDispName = ZS.Game.getStructureDisplayName({ id: def.id, level: lv + 1 });
        const fid2 = st.floorGrid[ty] && st.floorGrid[ty][tx];
        const fDef2 = fid2 ? ZS.DATA.ITEMS[fid2] : null;
        const hpMult = 1 + (fDef2 && fDef2.hpMultBonus ? fDef2.hpMultBonus : 0);
        const nextMaxHp = Math.round(nextProf.baseMaxHp * hpMult);
        const nextLabel = isTierEvo ? escapeHtml(nextDispName) : `Lv.${lv + 1}`;
        const extraHint =
          def.id === 'barricade_wall' && lv + 1 === 2
            ? ' · 상부 거치 해금'
            : def.subType === 'gate'
            ? ` · 둔화 ${Math.round((1 - (nextProf.gateSlowFactor || 0.75)) * 100)}%`
            : def.id === 'razor_pad'
            ? ` · 피해 ${nextProf.trapDps}/s`
            : def.id === 'repair_bay'
            ? ` · 회복 +${nextProf.regenPerSec}/s`
            : def.subType === 'power' && nextProf.nightGen > 0
            ? ` · 밤 +${nextProf.nightGen.toFixed(2)}/s`
            : def.subType === 'housing'
            ? ` · 수용 +${nextProf.popCap}명`
            : !isTierEvo && lv + 1 === 3 && nextProf.perkLabel
            ? ` · ★${escapeHtml(nextProf.perkLabel.split(' (')[0])}`
            : '';
        statSummary += ` → [${nextLabel}: HP ${nextMaxHp}${extraHint}]`;
      }
      const titleText = isTierEvo ? escapeHtml(dispName) : `${escapeHtml(dispName)} Lv.${lv}`;
      setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${titleText}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | ${statSummary}`, actionHtml);
    } else {
      const dispName = ZS.Game.getStructureDisplayName(obj);
      setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${escapeHtml(dispName)}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} — ${escapeHtml(def.desc)}`);
    }

    const upStructBtn = document.getElementById('btn-upgrade-struct');
    if (upStructBtn) {
      upStructBtn.addEventListener('click', () => {
        ZS.Game.upgradeStructure(tx, ty);
      });
    }
  }

  Object.assign(U, {
    renderCategoryTabs,
    getCardTagInfo,
    renderItemCards,
    setToolMode,
    syncDockAndHudState,
    setDockCollapsed,
    updateCursorTooltip,
    setDetailHtml,
    setCompositeDetailHtml,
    renderTraderModal,
    inspectTileAt
  });
})();
