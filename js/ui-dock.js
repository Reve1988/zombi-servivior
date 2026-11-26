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
    if (!wrap) return;
    wrap.innerHTML = '';
    const st = ZS.Game && ZS.Game.state;
    if (st && st.activeLayer === 'underground') {
      const b1Cats = ZS.DATA.B1_CATEGORIES || [];
      const activeB1 = uiState.activeB1Category || 'b1_ops';
      b1Cats.forEach((cat) => {
        const isActive = cat.id === activeB1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab-btn b1-tab-btn' + (isActive ? ' active' : '');
        btn.setAttribute('data-b1-cat', cat.id);
        btn.innerHTML = ozIcon(cat.iconId || 'b1-ops', 20, isActive ? 'icon-ap' : '');
        btn.setAttribute('aria-label', cat.label);
        btn.title = `${cat.label} — ${cat.desc}`;
        btn.addEventListener('click', () => {
          uiState.activeB1Category = cat.id;
          if (uiState.mode !== 'inspect') {
            setToolMode('inspect');
          } else {
            renderCategoryTabs();
            renderItemCards();
          }
        });
        wrap.appendChild(btn);
      });
      return;
    }

    ZS.DATA.CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-btn' + (uiState.activeCategory === cat.id ? ' active' : '');
      const iconId = cat.iconId || (cat.id === 'defense' ? 'cat-defense' : cat.id === 'infra' ? 'cat-infra' : 'cat-decor');
      btn.innerHTML = ozIcon(iconId, 20);
      btn.setAttribute('aria-label', cat.label);
      btn.title = `${cat.label} — ${cat.desc}`;
      btn.addEventListener('click', () => {
        uiState.activeCategory = cat.id;
        renderCategoryTabs();
        renderItemCards();
      });
      wrap.appendChild(btn);
    });
  }

  function selectB1Tool(toolDef) {
    if (!toolDef) return;
    setToolMode(toolDef.mode, toolDef.id, toolDef.role || null);
  }

  function getCardLockState(def, st) {
    const bossLocked = !!(def.unlockedByBoss && !st.bossDefeated);
    const voucherCount = (st.freeVouchers[def.id] || 0) + (def.id === 'field_tent' ? st.freeVouchers.shelter_pod || 0 : 0);
    const reqTechId = ZS.Game.getItemRequiredTech ? ZS.Game.getItemRequiredTech(def.id) : null;
    const techDef = reqTechId && ZS.DATA.TECH_TREE ? ZS.DATA.TECH_TREE[reqTechId] : null;
    const techGate = reqTechId && ZS.Game.getTechGateInfo ? ZS.Game.getTechGateInfo(reqTechId) : null;
    const reqTechHqLevel = (techGate && techGate.reqHqLevel) || Math.max(1, Number((techDef && techDef.reqHqLevel) || (techDef && techDef.branch === 'bunker_eng' ? 2 : 1)) || 1);
    const reqTechWave = (techGate && techGate.reqWave) || (ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(reqTechHqLevel) : ([1, 10, 20, 35, 50][reqTechHqLevel - 1] || 50));
    const techLv = reqTechId && ZS.Game.getTechLevel ? ZS.Game.getTechLevel(reqTechId) : 1;
    const reqTechCost = reqTechId && ZS.Game.getTechCost
      ? ZS.Game.getTechCost(reqTechId)
      : (techDef && techDef.costRp != null ? techDef.costRp : null);
    const techLockedRaw = !!(reqTechId && techLv <= 0);
    const reqTechHqLocked = techLockedRaw && (st.hqLevel || 1) < reqTechHqLevel;
    const voucherBypass = techLockedRaw && !bossLocked && voucherCount > 0;
    const isLocked = bossLocked || (techLockedRaw && !voucherBypass);
    return {
      bossLocked,
      voucherCount,
      reqTechId,
      reqTechName: techDef ? techDef.name : reqTechId,
      reqTechCost,
      reqTechHqLevel,
      reqTechWave,
      reqTechHqLocked,
      techLockedRaw,
      voucherBypass,
      isLocked
    };
  }

  function formatTechLockBadgeHtml(lock) {
    const label = lock && lock.reqTechHqLocked ? `Lv.${lock.reqTechHqLevel}` : '연구';
    return `<span class="card-lock-badge">${ozIcon('state-lock', 12, 'icon-muted')}<span>${label}</span></span>`;
  }

  function formatTechLockChipHtml(reqTechCost) {
    if (reqTechCost != null) {
      return `<span class="cost-chip locked-chip">${ozIcon('res-rp', 12, 'icon-rp')}<span>연구 ${reqTechCost}RP</span></span>`;
    }
    return `<span class="cost-chip locked-chip">${ozIcon('state-lock', 12, 'icon-muted')}<span>연구 필요</span></span>`;
  }

  function formatTechLockTitleSuffix(lock) {
    if (!lock.techLockedRaw || lock.voucherBypass) return '';
    const hqNote = lock.reqTechHqLocked ? ` · 본부 Lv.${lock.reqTechHqLevel} (W${lock.reqTechWave}) 필요` : '';
    return ` [필요 연구: ${lock.reqTechName || '연구 필요'}${lock.reqTechCost != null ? ` · ${lock.reqTechCost} RP` : ''}${hqNote}]`;
  }

  function formatInspectTechLockLabel(check) {
    const tName = escapeHtml((check && check.reqTechName) || '필요');
    if (check && check.lockedByHq && check.reqHqLevel) {
      return `본부 Lv.${check.reqHqLevel} · 연구 [${tName}]`;
    }
    return `연구 [${tName}]`;
  }

  function buildItemCostChipsHtml(def, st) {
    const c = ZS.Game.getEffectiveBuildCost ? ZS.Game.getEffectiveBuildCost(def.id) : (def.cost || {});
    const costKeys = ['wood', 'scrap', 'coin'].filter((k) => (c[k] || 0) > 0);
    const isTriple = costKeys.length >= 3;
    const iconSz = isTriple ? 11 : 13;
    const resMap = {
      wood: { icon: 'res-wood', cls: 'icon-wood' },
      scrap: { icon: 'res-scrap', cls: 'icon-scrap' },
      coin: { icon: 'res-coin', cls: 'icon-coin' }
    };
    let html = '';
    costKeys.forEach((k) => {
      const amt = c[k];
      const meta = resMap[k];
      const isShort = st[k] < amt;
      html += `<span class="cost-chip ${isShort ? 'short' : ''}">${ozIcon(meta.icon, iconSz, isShort ? 'icon-danger' : meta.cls)}<span>${amt}</span></span>`;
    });
    return { html, isTriple };
  }

  function selectBuildCard(def) {
    if (!def) return;
    const st = ZS.Game.state;
    const lock = getCardLockState(def, st);
    if (lock.isLocked) {
      ZS.Audio.playError();
      if (lock.bossLocked) {
        U.showWaveBanner('특수 기념비 잠김', 'WAVE 5 알파 타이탄 변이체를 격파하면 해금됩니다.', 'warn');
      } else if (lock.reqTechHqLocked) {
        U.showWaveBanner(
          `연구 잠금: 본부 Lv.${lock.reqTechHqLevel} (W${lock.reqTechWave}) 필요`,
          `[${def.name}] 시설은 본부 Lv.${lock.reqTechHqLevel} (Wave ${lock.reqTechWave}+) 증축 후 [${lock.reqTechName}] 연구 완료 시 건설할 수 있습니다.`,
          'warn'
        );
        if (U.openTechModal) U.openTechModal(def.reqTech);
      } else {
        U.showWaveBanner(
          `연구 필요: ${lock.reqTechName || '전술 기술'}`,
          `[${def.name}] 시설은 [연구 트리 (T)] 창에서 [${lock.reqTechName}] 연구 완료 시 건설할 수 있습니다.`,
          'warn'
        );
        if (U.openTechModal) U.openTechModal(def.reqTech);
      }
      return;
    }
    setToolMode('build', def.id);
  }

  function getEstimatedNightPowerUse(def, eff) {
    if (!def || !def.requiresPower) return 0;
    const idle = eff && eff.powerIdle != null ? eff.powerIdle : (def.powerIdle || 0);
    const shot = eff && eff.powerShot != null ? eff.powerShot : (def.powerShot || 0);
    const rate = eff && eff.fireRate != null ? eff.fireRate : (def.fireRate || 0);
    return Math.max(1, Math.round(idle * 22 + shot * rate * 5));
  }

  function getCardTagInfo(def) {
    if (def.domain === 'underground') {
      const roleDef = def.requiredRole && ZS.DATA.B1_ROOMS ? ZS.DATA.B1_ROOMS[def.requiredRole] : null;
      const roleTag = roleDef ? roleDef.name : '지하 공용';
      const pwrPrefix = def.requiresPower ? `${ozIcon('res-power', 13, 'icon-power')}<span>전등 ·</span>` : '';
      if (def.popCap) {
        return { html: `${ozIcon('res-agent', 13)}<span>수용+${def.popCap} ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy || 0}</span>`, cls: 'tag-manned' };
      }
      if ((def.powerCap || 0) > 0 || (def.dayCharge || 0) > 0 || (def.nightGen || 0) > 0) {
        return { html: `${ozIcon('res-power', 13, 'icon-power')}<span>${escapeHtml(roleTag)} · 전력 지원</span>`, cls: 'tag-power' };
      }
      if (def.requiredRole === 'research_lab' || def.requiredRole === 'supply_depot') {
        return { html: `${pwrPrefix}<span>${escapeHtml(roleTag)} 보너스</span>`, cls: def.requiresPower ? 'tag-power' : 'tag-manned' };
      }
      if (def.cozy) {
        return { html: `${pwrPrefix}${ozIcon('res-cozy', 13, 'icon-coin')}<span>안락함 +${def.cozy}</span>`, cls: 'tag-cozy' };
      }
      return { html: `<span>${escapeHtml(roleTag)}</span>`, cls: 'tag-cozy' };
    }
    const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
    if (def.layer === 'floor') {
      if (preview && preview.isFloorCapped) {
        return { html: `<span>바닥재</span>`, cls: 'tag-cozy-dim' };
      }
      return { html: `<span>바닥재 ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy || 0}</span>`, cls: 'tag-cozy' };
    }
    if (def.subType === 'manned') {
      const maxC = def.maxCrew || 1;
      return { html: `${ozIcon('res-agent', 13)}<span>슬롯 ${maxC}명 · 무전력</span>`, cls: 'tag-manned' };
    }
    if (def.id === 'supply_workshop') {
      return { html: `${ozIcon('act-repair', 13, 'icon-ap')}<span>생산 +${def.prodSlots || 2}자리 · 무전력</span>`, cls: 'tag-manned' };
    }
    if (def.id === 'research_lab') {
      return { html: `${ozIcon('res-rp', 13, 'icon-rp')}<span>연구 +${def.researchSlots || 2}자리 · 무전력</span>`, cls: 'tag-manned' };
    }
    if (def.subType === 'turret') {
      const estPwr = getEstimatedNightPowerUse(def);
      return { html: `${ozIcon('res-power', 13, 'icon-power')}<span>야간 ~${estPwr} 전력</span>`, cls: 'tag-power' };
    }
    if (def.subType === 'power') {
      const prof = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, 1) : def;
      const pStats = ZS.Game.getTerrainPowerStats ? ZS.Game.getTerrainPowerStats(def.id, prof, -1, -1) : prof;
      if ((pStats.nightGen || def.nightGen) > 0) {
        return {
          html: `${ozIcon('res-power', 13, 'icon-power')}<span>야간 발전 · 낮+${Math.round(pStats.dayCharge)}</span>`,
          cls: 'tag-power'
        };
      }
      return {
        html: `${ozIcon('phase-day', 13, 'icon-coin')}<span>낮+${Math.round(pStats.dayCharge)}</span>${ozIcon('res-power', 13, 'icon-power')}<span>· 용량+${pStats.powerCap}</span>`,
        cls: 'tag-power'
      };
    }
    if (def.subType === 'housing') {
      const st = ZS.Game.state;
      const spawnLv = def.id === 'field_tent' && st && st.freeVouchers && st.freeVouchers.shelter_pod > 0 ? 3 : 1;
      const prof = ZS.Game.getStructLevelProfile ? ZS.Game.getStructLevelProfile(def, spawnLv) : def;
      const popVal = prof.popCap != null ? prof.popCap : def.popCap;
      return {
        html: `${ozIcon('res-agent', 13)}<span>수용+${popVal} ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${prof.cozy != null ? prof.cozy : def.cozy}</span>`,
        cls: 'tag-manned'
      };
    }
    if (def.id === 'repair_bay' && def.aura && def.aura.regenPerSec) {
      return {
        html: `${ozIcon('act-repair', 13, 'icon-heal')}<span>자동 수리 ·</span>${ozIcon('res-cozy', 13, 'icon-coin')}<span>+${def.cozy || 0}</span>`,
        cls: 'tag-manned'
      };
    }
    if (def.category === 'decor') {
      const pwrPrefix = def.requiresPower ? `${ozIcon('res-power', 13, 'icon-power')}<span>전등 ·</span>` : '';
      return { html: `${pwrPrefix}${ozIcon('res-cozy', 13, 'icon-coin')}<span>안락함 +${def.cozy || 0}</span>`, cls: 'tag-cozy' };
    }
    if (def.subType === 'trap') {
      return { html: `<span>가시 함정 · 둔화</span>`, cls: '' };
    }
    if (def.subType === 'gate') return { html: `<span>전술 관문 · 둔화</span>`, cls: '' };
    if (def.id === 'barricade_wall') return { html: `<span>방호 성벽 · HP ${def.maxHp}</span>`, cls: '' };
    return { html: `<span>방호벽 · HP ${def.maxHp}</span>`, cls: '' };
  }

  function renderB1DockCards(container, st) {
    const tools = ZS.DATA.B1_TOOLS || [];
    const drill2 = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_2') : 0;
    const ugRev = st.underground ? st.underground.rev : 0;
    const nextSig = `b1|${st.phase}|${uiState.mode}|${uiState.selectedB1ToolId || ''}|${Math.floor(st.digAp || 0)}|${drill2}|${ugRev}`;
    if (nextSig === lastDockSig && container.childElementCount > 0) {
      return;
    }
    const layerChanged = lastDockCategory !== '__b1_ops__';
    lastDockSig = nextSig;
    lastDockCategory = '__b1_ops__';

    container.innerHTML = '';

    tools.forEach((t, idx) => {
      const isSelected = uiState.selectedB1ToolId === t.id && uiState.mode === t.mode;
      const card = document.createElement('div');
      card.className = 'item-card b1-tool-card' + (isSelected ? ' selected' : '');
      card.setAttribute('data-b1-tool', t.id);
      card.title = `${t.name} (${t.tag}) — ${t.desc}`;

      const hotkeyHtml = idx < 9 ? `<span class="card-hotkey">${idx + 1}</span>` : '';
      const thumbUrl = ZS.Renderer && ZS.Renderer.renderB1ToolThumbnail ? ZS.Renderer.renderB1ToolThumbnail(t.id, 88) : '';
      const thumbHtml = thumbUrl
        ? `<img class="card-thumb" src="${thumbUrl}" width="84" height="84" alt="" />`
        : `<span class="card-thumb icon-slot">${ozIcon(t.iconId || 'b1-dig', 28)}</span>`;

      let chipHtml = '';
      if (t.id === 'b1_dig') {
        const rangeTxt = drill2 > 0 ? '1~2 AP' : '1~3 AP';
        chipHtml = `<span class="cost-chip b1-ap-cost">${ozIcon('b1-dig', 13, 'icon-ap')}<span>${rangeTxt}</span></span>`;
      } else if (t.id === 'b1_door') {
        chipHtml = `<span class="cost-chip free">${ozIcon('b1-door', 13, 'icon-ap')}<span>무료 연결</span></span>`;
      } else if (t.id === 'b1_zone_corridor') {
        chipHtml = `<span class="cost-chip free">${ozIcon('b1-corridor', 13, 'icon-ap')}<span>무료 통로</span></span>`;
      } else if (t.id === 'b1_unzone') {
        chipHtml = `<span class="cost-chip">${escapeHtml(t.costLabel)}</span>`;
      } else {
        chipHtml = `<span class="cost-chip b1-role-chip"><span class="b1-role-dot" style="background:${escapeHtml(t.accent)};"></span><span>${escapeHtml(t.costLabel)}</span></span>`;
      }

      card.innerHTML = `
        ${hotkeyHtml}
        <div class="card-visual">
          ${thumbHtml}
        </div>
        <div class="card-meta">
          <span class="card-title">${escapeHtml(t.name)}</span>
          <div class="card-costs">${chipHtml}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectB1Tool(t);
      });

      container.appendChild(card);
    });

    if (layerChanged) container.scrollLeft = 0;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncDockScrollButtons);
  }

  const B1_ROLE_SHORT_LABELS = {
    quarters: '생활',
    lounge: '휴게',
    research_lab: '연구',
    supply_depot: '보급',
    power_vault: '축전'
  };

  function renderB1GadgetCards(container, st) {
    const activeB1 = uiState.activeB1Category || 'b1_living';
    const items = Object.values(ZS.DATA.ITEMS).filter(
      (def) => def.domain === 'underground' && def.b1Category === activeB1
    );
    const techSig = Object.keys(st.researchedTechs || {})
      .sort()
      .map((k) => `${k}:${st.researchedTechs[k]}`)
      .join(',');
    const ugRev = st.underground ? st.underground.rev : 0;
    const sigParts = [
      'b1_gadgets',
      activeB1,
      st.phase,
      uiState.mode,
      uiState.selectedItemId || '',
      st.hqLevel || 1,
      st.bossDefeated ? 1 : 0,
      ugRev,
      techSig
    ];
    for (let i = 0; i < items.length; i++) {
      const def = items[i];
      const vCnt = st.freeVouchers[def.id] || 0;
      const c = ZS.Game.getEffectiveBuildCost ? ZS.Game.getEffectiveBuildCost(def.id) : (def.cost || {});
      const aff = `${st.wood >= (c.wood || 0) ? 1 : 0}${st.scrap >= (c.scrap || 0) ? 1 : 0}${st.coin >= (c.coin || 0) ? 1 : 0}`;
      const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
      const dimFlag = preview && preview.isDiminished ? 1 : 0;
      sigParts.push(`${def.id}:${vCnt}:${aff}:${dimFlag}`);
    }
    const nextSig = sigParts.join('|');
    if (nextSig === lastDockSig && container.childElementCount > 0) {
      return;
    }
    const catKey = `__${activeB1}__`;
    const categoryChanged = lastDockCategory !== catKey;
    lastDockSig = nextSig;
    lastDockCategory = catKey;

    container.innerHTML = '';

    items.forEach((def, idx) => {
      const lock = getCardLockState(def, st);
      const { bossLocked, voucherCount, reqTechCost, techLockedRaw, voucherBypass, isLocked } = lock;

      const card = document.createElement('div');
      card.className =
        'item-card b1-gadget-card' +
        (uiState.mode === 'build' && uiState.selectedItemId === def.id ? ' selected' : '') +
        (isLocked ? ' locked' : '') +
        (voucherBypass ? ' voucher-bypass' : '');
      card.setAttribute('data-item-id', def.id);

      const tag = getCardTagInfo(def);
      const tagPlain = tag.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const lockTip = formatTechLockTitleSuffix(lock);
      card.title = `${def.name}${tagPlain ? ` (${tagPlain})` : ''} — ${def.desc}${lockTip}`;

      let badgeHtml = '';
      if (bossLocked) {
        badgeHtml = `<span class="card-lock-badge">${ozIcon('state-lock', 12, 'icon-muted')}<span>보스</span></span>`;
      } else if (voucherBypass) {
        badgeHtml = `<span class="card-voucher-badge">${ozIcon('state-voucher', 12, 'icon-coin')}<span>보급 ${voucherCount}</span></span>`;
      } else if (techLockedRaw) {
        badgeHtml = formatTechLockBadgeHtml(lock);
      } else {
        const rDef = def.requiredRole && ZS.DATA.B1_ROOMS ? ZS.DATA.B1_ROOMS[def.requiredRole] : null;
        const rShort = (def.requiredRole && B1_ROLE_SHORT_LABELS[def.requiredRole]) || '공용';
        const rAccent = (rDef && rDef.accent) || '#FFB347';
        badgeHtml = `<span class="card-role-badge"><span class="b1-role-dot" style="background:${escapeHtml(rAccent)};"></span><span>${escapeHtml(rShort)}</span></span>`;
      }

      let costHtml = '';
      let isTriple = false;
      if (bossLocked) {
        costHtml = `<span class="cost-chip locked-chip">${ozIcon('state-lock', 12, 'icon-muted')}<span>보스 처치</span></span>`;
      } else if (voucherCount > 0) {
        costHtml = `<span class="cost-chip free">${ozIcon('state-voucher', 12, 'icon-heal')}<span>보급권 ${voucherCount}</span></span>`;
      } else if (techLockedRaw) {
        costHtml = formatTechLockChipHtml(reqTechCost);
      } else {
        const costBuilt = buildItemCostChipsHtml(def, st);
        costHtml = costBuilt.html;
        isTriple = costBuilt.isTriple;
      }

      const hotkeyHtml = idx < 9 ? `<span class="card-hotkey">${idx + 1}</span>` : '';
      const thumbUrl = ZS.Renderer.renderItemThumbnail ? ZS.Renderer.renderItemThumbnail(def.id, 88) : '';
      const thumbHtml = thumbUrl
        ? `<img class="card-thumb" src="${thumbUrl}" width="84" height="84" alt="" />`
        : `<span class="card-thumb icon-slot">${ozIcon('b1-systems', 28)}</span>`;

      card.innerHTML = `
        ${hotkeyHtml}
        ${badgeHtml}
        <div class="card-visual">
          ${thumbHtml}
        </div>
        <div class="card-meta">
          <span class="card-title">${escapeHtml(def.name)}</span>
          <div class="card-costs${isTriple ? ' triple-costs' : ''}">${costHtml}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectBuildCard(def);
      });

      container.appendChild(card);
    });

    if (categoryChanged) container.scrollLeft = 0;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncDockScrollButtons);
  }

  function renderItemCards() {
    const container = document.getElementById('item-cards');
    const st = ZS.Game.state;
    if (st && st.activeLayer === 'underground') {
      if (!uiState.activeB1Category || uiState.activeB1Category === 'b1_ops') {
        renderB1DockCards(container, st);
      } else {
        renderB1GadgetCards(container, st);
      }
      return;
    }
    if (st.phase === 'night' && container.childElementCount > 0 && lastDockCategory === uiState.activeCategory) {
      return;
    }

    const items = Object.values(ZS.DATA.ITEMS).filter((def) => def.category === uiState.activeCategory && def.domain !== 'underground');
    const floorCap = ZS.DATA.COZY_FLOOR_CAP || 60;
    const floorCappedAll = (st.cozyFloorRaw || 0) >= floorCap;
    const techSig = Object.keys(st.researchedTechs || {})
      .sort()
      .map((k) => `${k}:${st.researchedTechs[k]}`)
      .join(',');
    const sigParts = [
      st.divisionId || 'mobile_corps',
      st.phase,
      uiState.activeCategory,
      uiState.mode,
      uiState.selectedItemId || '',
      st.hqLevel || 1,
      st.bossDefeated ? 1 : 0,
      floorCappedAll ? 1 : 0,
      techSig
    ];
    for (let i = 0; i < items.length; i++) {
      const def = items[i];
      const vCnt = (st.freeVouchers[def.id] || 0) + (def.id === 'field_tent' ? st.freeVouchers.shelter_pod || 0 : 0);
      const r1Cnt = (st.divisionRank1Vouchers && st.divisionRank1Vouchers[def.id]) || 0;
      const c = ZS.Game.getEffectiveBuildCost ? ZS.Game.getEffectiveBuildCost(def.id) : (def.cost || {});
      const aff = `${st.wood >= (c.wood || 0) ? 1 : 0}${st.scrap >= (c.scrap || 0) ? 1 : 0}${st.coin >= (c.coin || 0) ? 1 : 0}`;
      const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
      const dimFlag = preview && preview.isDiminished ? 1 : 0;
      sigParts.push(`${def.id}:${vCnt}:${r1Cnt}:${aff}:${dimFlag}`);
    }
    const nextSig = sigParts.join('|');
    if (nextSig === lastDockSig && container.childElementCount > 0) {
      return;
    }
    const categoryChanged = lastDockCategory !== uiState.activeCategory;
    lastDockSig = nextSig;
    lastDockCategory = uiState.activeCategory;

    container.innerHTML = '';

    items.forEach((def, idx) => {
      const lock = getCardLockState(def, st);
      const { bossLocked, voucherCount, reqTechCost, techLockedRaw, voucherBypass, isLocked } = lock;

      const card = document.createElement('div');
      card.className =
        'item-card' +
        (uiState.mode === 'build' && uiState.selectedItemId === def.id ? ' selected' : '') +
        (isLocked ? ' locked' : '') +
        (voucherBypass ? ' voucher-bypass' : '');

      const tag = getCardTagInfo(def);
      const tagPlain = tag.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const lockTip = formatTechLockTitleSuffix(lock);
      card.title = `${def.name}${tagPlain ? ` (${tagPlain})` : ''} — ${def.desc}${lockTip}`;

      let badgeHtml = '';
      if (bossLocked) {
        badgeHtml = `<span class="card-lock-badge">${ozIcon('state-lock', 12, 'icon-muted')}<span>보스</span></span>`;
      } else if (voucherBypass) {
        badgeHtml = `<span class="card-voucher-badge">${ozIcon('state-voucher', 12, 'icon-coin')}<span>보급 ${voucherCount}</span></span>`;
      } else if (techLockedRaw) {
        badgeHtml = formatTechLockBadgeHtml(lock);
      }

      let costHtml = '';
      let isTriple = false;
      if (bossLocked) {
        costHtml = `<span class="cost-chip locked-chip">${ozIcon('state-lock', 12, 'icon-muted')}<span>보스 처치</span></span>`;
      } else if (voucherCount > 0) {
        const hasR1 = !!(st.divisionRank1Vouchers && (st.divisionRank1Vouchers[def.id] || 0) > 0);
        costHtml = `<span class="cost-chip free">${ozIcon('state-voucher', 12, 'icon-heal')}<span>보급권 ${voucherCount}${hasR1 ? ' ★' : ''}</span></span>`;
      } else if (techLockedRaw) {
        costHtml = formatTechLockChipHtml(reqTechCost);
      } else {
        const costBuilt = buildItemCostChipsHtml(def, st);
        costHtml = costBuilt.html;
        isTriple = costBuilt.isTriple;
      }

      const hotkeyHtml = idx < 9 ? `<span class="card-hotkey">${idx + 1}</span>` : '';
      const thumbUrl = ZS.Renderer.renderItemThumbnail ? ZS.Renderer.renderItemThumbnail(def.id, 88) : '';
      const thumbHtml = thumbUrl
        ? `<img class="card-thumb" src="${thumbUrl}" width="84" height="84" alt="" />`
        : `<span class="card-thumb icon-slot">${ozIcon('cat-defense', 28)}</span>`;

      card.innerHTML = `
        ${hotkeyHtml}
        ${badgeHtml}
        <div class="card-visual">
          ${thumbHtml}
        </div>
        <div class="card-meta">
          <span class="card-title">${escapeHtml(def.name)}</span>
          <div class="card-costs${isTriple ? ' triple-costs' : ''}">${costHtml}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectBuildCard(def);
      });

      container.appendChild(card);
    });
    if (categoryChanged) container.scrollLeft = 0;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncDockScrollButtons);
  }

  const B1_ROT_LABELS = ['남서(기본)', '남동(90°)', '북동(180°)', '북서(270°)'];

  function getB1RotLabel(rot) {
    const idx = ((Math.round(Number(rot) || 0) % 4) + 4) % 4;
    return B1_ROT_LABELS[idx];
  }

  function buildDetailCardHtml(opts) {
    const o = opts || {};
    let visualHtml = '';
    if (o.thumbItemId && ZS.Renderer && ZS.Renderer.renderItemThumbnail) {
      const src = ZS.Renderer.renderItemThumbnail(o.thumbItemId, 64, o.thumbTier);
      if (src) {
        visualHtml = `<img class="detail-thumb-img" src="${src}" width="48" height="48" alt="" />`;
      }
    } else if (o.thumbB1ToolId && ZS.Renderer && ZS.Renderer.renderB1ToolThumbnail) {
      const src = ZS.Renderer.renderB1ToolThumbnail(o.thumbB1ToolId, 64);
      if (src) {
        visualHtml = `<img class="detail-thumb-img" src="${src}" width="48" height="48" alt="" />`;
      }
    }
    if (!visualHtml) {
      visualHtml = ozIcon(o.iconId || 'tool-inspect', 26, o.iconCls || '');
    }

    const lvHtml = o.lvLabel ? `<span class="detail-lv-pill">${escapeHtml(o.lvLabel)}</span>` : '';
    const tagLineHtml = o.tagHtml ? `<div class="detail-tag-line">${o.tagHtml}</div>` : '';

    let hpBarHtml = '';
    if (o.hp != null && o.maxHp > 0) {
      const pct = Math.max(0, Math.min(100, (o.hp / o.maxHp) * 100));
      hpBarHtml = `
        <div class="comp-hpb-wrap">
          <span class="comp-hpb${o.hpWall ? ' wall' : ''}"><span style="width:${pct.toFixed(1)}%"></span></span>
          <span class="comp-hp-txt">${Math.ceil(o.hp)}/${o.maxHp}</span>
        </div>
      `;
    }

    const statsBlock = o.statsHtml ? `<div class="detail-stats-line">${o.statsHtml}</div>` : '';
    const costBlock = o.costHtml ? `<div class="detail-cost-row">${o.costHtml}</div>` : '';
    const descBlock = o.descHtml ? `<div class="detail-desc-line">${o.descHtml}</div>` : '';

    return `
      <div class="detail-hero">
        <div class="detail-thumb-box">${visualHtml}</div>
        <div class="detail-hero-meta">
          <div class="detail-title-row">
            <span class="detail-title">${escapeHtml(o.title || '')}</span>
            ${lvHtml}
          </div>
          ${tagLineHtml}
          ${hpBarHtml}
        </div>
      </div>
      ${statsBlock}
      ${costBlock}
      ${descBlock}
    `;
  }

  function formatB1BuildDetailHtml(def) {
    const st = ZS.Game && ZS.Game.state;
    const rDef = def.requiredRole && ZS.DATA.B1_ROOMS ? ZS.DATA.B1_ROOMS[def.requiredRole] : null;
    const catIcon = (rDef && rDef.iconId) || (def.b1Category === 'b1_living' ? 'b1-living' : 'b1-systems');
    const roleTag = rDef ? `<span class="cost-chip b1-role-chip">${escapeHtml(rDef.name)} 전용</span>` : '';
    const rotChip = `<span class="cost-chip">방향: ${escapeHtml(getB1RotLabel(uiState.b1BuildRot))} (우클릭/R)</span>`;
    const costBuilt = st ? buildItemCostChipsHtml(def, st) : { html: '' };
    const vCount = st ? ((st.freeVouchers && st.freeVouchers[def.id]) || 0) : 0;
    const costHtml = vCount > 0
      ? `<span class="cost-chip free">${ozIcon('state-voucher', 12, 'icon-heal')}<span>보급권 ${vCount}</span></span>`
      : costBuilt.html;
    return buildDetailCardHtml({
      thumbItemId: def.id,
      iconId: catIcon,
      title: def.name,
      tagHtml: `${roleTag}${rotChip}`,
      costHtml,
      descHtml: escapeHtml(def.desc || '')
    });
  }

  function formatB1MoveDetailHtml(def) {
    const rotLabel = getB1RotLabel(uiState.b1BuildRot);
    return buildDetailCardHtml({
      thumbItemId: def.id,
      iconId: 'tool-move',
      title: `${def.name} 이동 중`,
      tagHtml: `<span class="cost-chip">방향: ${escapeHtml(rotLabel)} (우클릭/R 회전)</span>`,
      descHtml: '배치할 빈 지하 타일을 클릭하세요.'
    });
  }

  function rotateActiveB1Gadget(options) {
    const st = ZS.Game.state;
    if (!st || st.activeLayer !== 'underground') return false;
    const allowInspect = !(options && options.fromRightClick);

    if (uiState.mode === 'build' && uiState.selectedItemId) {
      const def = ZS.DATA.ITEMS[uiState.selectedItemId];
      if (!def || def.domain !== 'underground') return false;
      uiState.b1BuildRot = ((uiState.b1BuildRot || 0) + 1) % 4;
      if (ZS.Audio && ZS.Audio.playClick) ZS.Audio.playClick();
      setDetailHtml(formatB1BuildDetailHtml(def));
      updateCursorTooltip();
      return true;
    }

    if (uiState.mode === 'move' && uiState.movingSource) {
      const ug = st.underground;
      const src = uiState.movingSource;
      const g = ug && ug.b1StructGrid && ug.b1StructGrid[src.ty] && ug.b1StructGrid[src.ty][src.tx];
      const def = g ? ZS.DATA.ITEMS[g.id] : null;
      if (!def) return false;
      uiState.b1BuildRot = ((uiState.b1BuildRot || 0) + 1) % 4;
      if (ZS.Audio && ZS.Audio.playClick) ZS.Audio.playClick();
      setDetailHtml(formatB1MoveDetailHtml(def, src.tx, src.ty));
      updateCursorTooltip();
      return true;
    }

    if (allowInspect && uiState.mode === 'inspect' && uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      const ug = st.underground;
      const g = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
      if (!g) return false;
      if (ZS.Game.rotateB1ItemAt && ZS.Game.rotateB1ItemAt(tx, ty, 1)) {
        inspectTileAt(tx, ty);
        updateCursorTooltip();
        return true;
      }
    }
    return false;
  }

  function setToolMode(mode, itemId, b1Role) {
    const st = ZS.Game && ZS.Game.state;
    const isUg = !!(st && st.activeLayer === 'underground');
    if (isUg && st && st.phase !== 'day' && (mode === 'move' || mode === 'remove' || mode === 'build' || mode.startsWith('b1_'))) {
      mode = 'inspect';
    }

    uiState.mode = mode;
    uiState.movingSource = null;
    uiState.activeSkill = null;
    uiState.b1DragStart = null;
    uiState.b1DragCurrent = null;
    uiState.hoverB1DoorEdge = null;
    document.getElementById('btn-skill-airstrike').classList.remove('targeting');

    if (mode === 'build') {
      uiState.selectedItemId = itemId;
      uiState.selectedB1ToolId = null;
      uiState.selectedB1Role = null;
      uiState.inspectedTile = null;
      const def = ZS.DATA.ITEMS[itemId];
      if (def) {
        if (def.domain === 'underground') {
          setDetailHtml(formatB1BuildDetailHtml(def), '', '건설 항목');
        } else {
          const catIcon = def.category === 'defense' ? 'cat-defense' : def.category === 'infra' ? 'cat-infra' : 'cat-decor';
          const tagInfo = getCardTagInfo(def);
          const vCnt = ((st.freeVouchers && st.freeVouchers[def.id]) || 0) + (def.id === 'field_tent' && st.freeVouchers ? st.freeVouchers.shelter_pod || 0 : 0);
          const costBuilt = buildItemCostChipsHtml(def, st);
          const costHtml = vCnt > 0
            ? `<span class="cost-chip free">${ozIcon('state-voucher', 12, 'icon-heal')}<span>보급권 ${vCnt}</span></span>`
            : costBuilt.html;
          const mountNote = def.canMountOnWall ? ' · Lv.2+ 성벽 상부 거치 가능' : '';
          setDetailHtml(
            buildDetailCardHtml({
              thumbItemId: def.id,
              iconId: catIcon,
              title: def.name,
              tagHtml: tagInfo.html,
              costHtml,
              descHtml: `${escapeHtml(def.desc || '')}${mountNote}`
            }),
            '',
            '건설 항목'
          );
        }
      }
    } else if (mode === 'b1_dig' || mode === 'b1_door' || mode === 'b1_zone' || mode === 'b1_unzone') {
      uiState.selectedItemId = null;
      uiState.selectedB1ToolId = itemId || null;
      uiState.selectedB1Role = b1Role || null;
      uiState.inspectedTile = null;
      const toolDef = (ZS.DATA.B1_TOOLS || []).find((t) => t.id === itemId);
      if (toolDef) {
        const iconCls = mode === 'b1_dig' || mode === 'b1_door' ? 'icon-ap' : '';
        setDetailHtml(
          buildDetailCardHtml({
            thumbB1ToolId: toolDef.id,
            iconId: toolDef.iconId || 'b1-dig',
            iconCls,
            title: toolDef.name,
            tagHtml: toolDef.costLabel ? `<span class="cost-chip">${escapeHtml(toolDef.costLabel)}</span>` : '',
            descHtml: escapeHtml(toolDef.desc || '')
          }),
          '',
          '지하 작업 도구'
        );
      }
    } else {
      uiState.selectedItemId = null;
      uiState.selectedB1ToolId = null;
      uiState.selectedB1Role = null;
      if (mode === 'move') {
        setDetailHtml(
          buildDetailCardHtml({
            iconId: 'tool-move',
            title: isUg ? '지하 가젯 이동' : '무료 이동 모드',
            tagHtml: '<span class="cost-chip free">낮 전용 · 비용 무료</span>',
            descHtml: isUg
              ? '옮길 지하 가젯을 클릭한 뒤 같은 역할의 빈 타일을 클릭하세요.'
              : '옮길 시설을 클릭한 뒤 이동할 빈 타일 또는 Lv.2+ 성벽을 클릭하세요.'
          }),
          '',
          '전술 도구'
        );
      } else if (mode === 'remove') {
        setDetailHtml(
          buildDetailCardHtml({
            iconId: 'tool-remove',
            iconCls: 'icon-danger',
            title: isUg ? '지하 가젯 철거' : '시설 철거 모드',
            tagHtml: '<span class="cost-chip short">건설 자원 80% 회수</span>',
            descHtml: isUg
              ? '철거할 지하 설비를 클릭하면 건설 자원의 80%를 돌려받습니다.'
              : '철거할 시설 또는 바닥 타일을 클릭하면 건설 자원의 80%를 돌려받습니다.'
          }),
          '',
          '전술 도구'
        );
      } else if (isUg) {
        setDetailHtml(
          buildDetailCardHtml({
            iconId: 'tool-inspect',
            title: '지하 시설 조회',
            descHtml: '지하 B1 타일·구역·가젯·승강기를 클릭해 상태를 확인하세요.'
          }),
          '',
          '전술 정보'
        );
      } else {
        setDetailHtml(
          buildDetailCardHtml({
            iconId: 'tool-inspect',
            title: '시설 조회 모드',
            descHtml: '기지 내 시설을 클릭하면 현재 상태와 강화 옵션을 확인할 수 있습니다.'
          }),
          '',
          '전술 정보'
        );
      }
    }

    document.getElementById('tool-inspect').classList.toggle('active', mode === 'inspect');
    const moveBtn = document.getElementById('tool-move');
    const removeBtn = document.getElementById('tool-remove');
    const disableEdit = isUg && st && st.phase !== 'day';
    if (moveBtn) {
      moveBtn.classList.toggle('active', mode === 'move');
      moveBtn.disabled = disableEdit;
    }
    if (removeBtn) {
      removeBtn.classList.toggle('active', mode === 'remove');
      removeBtn.disabled = disableEdit;
    }
    syncDetailBarVisibility();
    syncDockToolLabels();
    renderItemCards();
    updateCursorTooltip();
  }

  function syncDockToolLabels() {
    const st = ZS.Game && ZS.Game.state;
    const moveBtn = document.getElementById('tool-move');
    const removeBtn = document.getElementById('tool-remove');
    if (!moveBtn && !removeBtn) return;

    let isMountedInspect = false;
    if (st && st.activeLayer !== 'underground' && st.phase === 'day' && uiState.mode === 'inspect' && uiState.inspectedTile) {
      const { tx, ty } = uiState.inspectedTile;
      const cell = st.structGrid[ty] && st.structGrid[ty][tx];
      isMountedInspect = !!(cell && cell.id === 'barricade_wall' && cell.mounted);
    }

    if (moveBtn) {
      const span = moveBtn.querySelector('span');
      if (span) span.textContent = isMountedInspect ? '상부 이동 [M]' : '이동 [M]';
      moveBtn.classList.toggle('is-mounted-scope', isMountedInspect);
    }
    if (removeBtn) {
      const span = removeBtn.querySelector('span');
      if (span) span.textContent = isMountedInspect ? '상부 철거 [X]' : '철거 [X]';
      removeBtn.classList.toggle('is-mounted-scope', isMountedInspect);
    }
  }

  function syncDockScrollButtons() {
    const container = document.getElementById('item-cards');
    const leftBtn = document.getElementById('btn-dock-scroll-left');
    const rightBtn = document.getElementById('btn-dock-scroll-right');
    if (!container) return;
    const wrap = container.parentElement;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const hasLeft = maxScroll > 6 && container.scrollLeft > 4;
    const hasRight = maxScroll > 6 && container.scrollLeft < maxScroll - 4;
    if (leftBtn) leftBtn.classList.toggle('hidden', !hasLeft);
    if (rightBtn) rightBtn.classList.toggle('hidden', !hasRight);
    if (wrap) {
      wrap.classList.toggle('has-scroll-left', hasLeft);
      wrap.classList.toggle('has-scroll-right', hasRight);
    }
  }

  function syncDetailBarVisibility() {
    const bar = document.getElementById('detail-bar');
    if (!bar) return;
    const hasConfirm = !!document.getElementById('btn-confirm-demolish');
    const isIdle = uiState.mode === 'inspect' && !uiState.inspectedTile && !hasConfirm;
    bar.classList.toggle('idle-hidden', isIdle);
    syncDockToolLabels();
  }

  function syncDockAndHudState() {
    const dockEl = document.getElementById('build-dock');
    if (dockEl) {
      dockEl.classList.toggle('collapsed', !!uiState.dockCollapsed);
    }
    const secHudEl = document.getElementById('hud-secondary');
    if (secHudEl) {
      secHudEl.classList.toggle('hud-res-compact', !!uiState.hudResCompact);
    }
    const topLeftEl = document.getElementById('hud-top-left');
    if (topLeftEl) {
      topLeftEl.classList.toggle('hud-res-compact', !!uiState.hudResCompact);
    }
    const hudResBtn = document.getElementById('btn-toggle-hud-res');
    if (hudResBtn) {
      hudResBtn.innerHTML = ozIcon(uiState.hudResCompact ? 'ui-chevron-down' : 'ui-chevron-up', 14);
      hudResBtn.title = uiState.hudResCompact ? '보조 자원 라벨 펼치기' : '보조 자원 간소화';
    }
    syncDetailBarVisibility();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncDockScrollButtons);
  }

  function setDockCollapsed(flag) {
    uiState.dockCollapsed = !!flag;
    syncDockAndHudState();
  }

  function getTerrainUiMeta(tCell) {
    if (!tCell) return null;
    switch (tCell.kind) {
      case 'rock':
        if (tCell.isPeak) {
          return {
            title: '산맥 주봉',
            badge: '건설 불가 · 곡사/EMP 통과',
            desc: '직사 탄환을 막지만 로켓·EMP·폭격은 산 너머로 타격합니다.',
            tipText: '산맥 주봉 (건설 불가)',
            tipIcon: 'state-lock',
            tipIconCls: 'icon-muted'
          };
        }
        return {
          title: '기슭 암석',
          badge: '건설 불가 · 탄환 통과',
          desc: '시설 건설이 불가하지만 아군 탄환과 포격은 통과합니다.',
          tipText: '암석 지형 (건설 불가)',
          tipIcon: 'state-lock',
          tipIconCls: 'icon-muted'
        };
      case 'plateau':
        return {
          title: '고지대',
          badge: '고지대 보너스 (사거리·치명·조명 강화)',
          desc: '전투·조명·오라 시설에 고지대 보너스를 부여합니다.',
          tipText: '고지대 보너스',
          tipIcon: 'nav-recon',
          tipIconCls: 'icon-coin'
        };
      case 'ramp':
        return {
          title: '경사로',
          badge: '가시 함정 전용 경사로',
          desc: '일반 시설은 불가하며 가시 함정만 설치 가능합니다.',
          tipText: '경사로 (함정 전용)',
          tipIcon: 'nav-recon',
          tipIconCls: 'icon-muted'
        };
      case 'wind': {
        const isCore = (tCell.tier || 1) >= 2;
        const pct = isCore ? 70 : 40;
        const title = isCore ? '돌풍 핵심 지대' : '강풍 지대';
        return {
          title,
          badge: `풍력 발전 +${pct}%`,
          desc: `풍력 터빈 설치 시 주·야간 발전량이 +${pct}% 증가합니다.`,
          tipText: isCore ? '돌풍 핵심 +70%' : '강풍 +40%',
          tipIcon: 'hud-wind',
          tipIconCls: 'icon-heal'
        };
      }
      default:
        return null;
    }
  }

  function updateCursorTooltip() {
    const tipEl = document.getElementById('cursor-tooltip');
    if (!tipEl) return;
    const st = ZS.Game.state;
    const hideTip = () => {
      if (lastTipVisible) {
        tipEl.classList.remove('ok', 'info');
        tipEl.classList.add('hidden');
        lastTipVisible = false;
      }
      lastTipStateKey = '';
    };

    if (uiState.mainMenuOpen || !uiState.pointerClient.inside || !uiState.hoverTile || st.phase !== 'day') {
      hideTip();
      return;
    }

    const { tx, ty } = uiState.hoverTile;
    if (st.activeLayer === 'underground') {
      const b1Size = ZS.DATA.B1_SIZE || 23;
      if (tx < 0 || ty < 0 || tx >= b1Size || ty >= b1Size) {
        hideTip();
        return;
      }
      const ug = st.underground;
      const cell = ug && ug.grid && ug.grid[ty] && ug.grid[ty][tx];
      const doorEdge = uiState.hoverB1DoorEdge;
      const doorKey = doorEdge ? `${doorEdge.key}:${doorEdge.hasDoor ? 1 : 0}` : '';
      const dragKey = uiState.b1DragStart && uiState.b1DragCurrent
        ? `${uiState.b1DragStart.tx},${uiState.b1DragStart.ty}:${uiState.b1DragCurrent.tx},${uiState.b1DragCurrent.ty}`
        : '';
      const srcKey = uiState.movingSource ? `${uiState.movingSource.tx},${uiState.movingSource.ty}` : '';
      const ugKey = `b1|${uiState.mode}|${uiState.selectedB1Role || ''}|${uiState.selectedItemId || ''}|${uiState.b1BuildRot || 0}|${srcKey}|${tx},${ty}|${Math.floor(st.digAp || 0)}|${ug ? ug.rev : 0}|${doorKey}|${dragKey}`;
      if (ugKey !== lastTipStateKey) {
        lastTipStateKey = ugKey;
        let tipText = null;
        let tipKind = 'info';
        let tipIcon = 'b1-dig';
        let tipIconCls = 'icon-ap';

        if (uiState.mode === 'b1_dig') {
          const check = ZS.Game.canDigTile ? ZS.Game.canDigTile(tx, ty) : null;
          if (check && check.ok) {
            tipText = `굴착 가능 (${check.tierName}) — ${check.cost} AP 소모`;
            tipKind = 'ok';
            tipIcon = 'b1-dig';
            tipIconCls = 'icon-ap';
          } else if (check && check.reason) {
            tipText = check.reason;
            tipKind = check.alreadyExcavated ? 'info' : 'err';
            tipIcon = check.alreadyExcavated ? 'b1-zone' : 'state-alert';
            tipIconCls = check.alreadyExcavated ? 'icon-muted' : 'icon-danger';
          }
        } else if (uiState.mode === 'b1_zone') {
          const isCorrRole = uiState.selectedB1Role === 'corridor';
          const rDef = !isCorrRole && ZS.Game.getB1RoomDef ? ZS.Game.getB1RoomDef(uiState.selectedB1Role) : null;
          const rName = isCorrRole ? '전술 복도' : (rDef ? rDef.name : '방 구역');
          if (cell && cell.excavated && !cell.permanentCorridor && !cell.elevator && !cell.bedrock) {
            const hasG = !!(ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx]);
            if (cell.roomId != null && ZS.Game.roomHasGadgets && ZS.Game.roomHasGadgets(cell.roomId)) {
              tipText = '가젯이 배치된 구역은 먼저 가젯을 제거해야 수정할 수 있습니다.';
              tipKind = 'err';
              tipIcon = 'state-lock';
              tipIconCls = 'icon-danger';
            } else if (hasG) {
              tipText = '설비가 배치된 타일은 설비를 먼저 철거·이동한 뒤 변경하세요.';
              tipKind = 'err';
              tipIcon = 'state-lock';
              tipIconCls = 'icon-danger';
            } else {
              tipText = isCorrRole ? '드래그하여 [전술 복도] 시공 (승강기 통로)' : `드래그하여 [${rName}] 구역 지정`;
              tipKind = 'ok';
              tipIcon = isCorrRole ? 'b1-corridor' : ((rDef && rDef.iconId) || 'b1-zone');
              tipIconCls = 'icon-heal';
            }
          } else {
            tipText = cell && (cell.permanentCorridor || cell.elevator)
              ? '중앙 승강기 공용 복도는 구역을 지정할 수 없습니다.'
              : '굴착된 빈 공간 위에서만 구역을 지정할 수 있습니다.';
            tipKind = 'err';
            tipIcon = 'state-lock';
            tipIconCls = 'icon-danger';
          }
        } else if (uiState.mode === 'b1_unzone') {
          const hasG = !!(ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx]);
          if (cell && (cell.roomId != null || (cell.corridor && !cell.permanentCorridor))) {
            if (cell.roomId != null && ZS.Game.roomHasGadgets && ZS.Game.roomHasGadgets(cell.roomId)) {
              tipText = '가젯이 배치된 구역은 먼저 가젯을 제거해야 해제할 수 있습니다.';
              tipKind = 'err';
              tipIcon = 'state-lock';
              tipIconCls = 'icon-danger';
            } else if (hasG) {
              tipText = '설비가 배치된 타일은 설비를 먼저 철거·이동한 뒤 해제하세요.';
              tipKind = 'err';
              tipIcon = 'state-lock';
              tipIconCls = 'icon-danger';
            } else {
              tipText = cell.corridor && !cell.permanentCorridor
                ? '드래그하여 전술 복도 해제 (일반 흙바닥 복원)'
                : '드래그하여 구역 지정 해제 (일반 흙바닥 복원)';
              tipKind = 'info';
              tipIcon = 'b1-unzone';
              tipIconCls = 'icon-ap';
            }
          } else {
            tipText = '해제할 지정 구역이나 전술 복도가 없는 타일입니다.';
            tipKind = 'info';
            tipIcon = 'b1-unzone';
            tipIconCls = 'icon-muted';
          }
        } else if (uiState.mode === 'b1_door') {
          if (doorEdge) {
            tipText = doorEdge.hasDoor ? '방폭문 제거' : '3D 방폭문 설치';
            tipKind = 'ok';
            tipIcon = 'b1-door';
            tipIconCls = 'icon-ap';
          } else {
            tipText = '격벽을 클릭하세요';
            tipKind = 'info';
            tipIcon = 'b1-door';
            tipIconCls = 'icon-muted';
          }
        } else if (uiState.mode === 'build' && uiState.selectedItemId) {
          const def = ZS.DATA.ITEMS[uiState.selectedItemId];
          const check = ZS.Game.canPlaceB1Item ? ZS.Game.canPlaceB1Item(uiState.selectedItemId, tx, ty) : null;
          if (check && check.ok) {
            tipText = `${def ? def.name : '설비'} 설치 가능 · ${getB1RotLabel(uiState.b1BuildRot)}`;
            tipKind = 'ok';
            tipIcon = 'b1-systems';
            tipIconCls = 'icon-heal';
          } else if (check && check.reason) {
            tipText = check.reason;
            tipKind = 'err';
            tipIcon = 'state-lock';
            tipIconCls = 'icon-danger';
          }
        } else if (uiState.mode === 'move') {
          const g = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
          if (!uiState.movingSource) {
            if (g && ZS.DATA.ITEMS[g.id]) {
              tipText = `[${ZS.DATA.ITEMS[g.id].name}] 이동`;
              tipKind = 'ok';
              tipIcon = 'tool-move';
              tipIconCls = 'icon-ap';
            } else {
              tipText = '이동할 지하 가젯 선택';
              tipKind = 'info';
              tipIcon = 'tool-move';
              tipIconCls = 'icon-muted';
            }
          } else {
            const src = uiState.movingSource;
            const check = ZS.Game.canMoveB1Item ? ZS.Game.canMoveB1Item(src.tx, src.ty, tx, ty, uiState.b1BuildRot || 0) : null;
            if (check && check.ok) {
              tipText = check.inPlaceRotate
                ? `제자리 회전 · ${getB1RotLabel(uiState.b1BuildRot)}`
                : `무료 이동 · ${getB1RotLabel(uiState.b1BuildRot)}`;
              tipKind = 'ok';
              tipIcon = check.inPlaceRotate ? 'sys-reset' : 'tool-move';
              tipIconCls = 'icon-heal';
            } else if (check && check.reason) {
              tipText = check.reason;
              tipKind = check.sameTile ? 'info' : 'err';
              tipIcon = 'state-lock';
              tipIconCls = check.sameTile ? 'icon-muted' : 'icon-danger';
            }
          }
        } else if (uiState.mode === 'remove') {
          const g = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
          if (g && ZS.DATA.ITEMS[g.id]) {
            tipText = `[${ZS.DATA.ITEMS[g.id].name}] 철거 (80% 환급)`;
            tipKind = 'err';
            tipIcon = 'tool-remove';
            tipIconCls = 'icon-danger';
          } else {
            tipText = '철거 대상 없음';
            tipKind = 'info';
            tipIcon = 'tool-remove';
            tipIconCls = 'icon-muted';
          }
        } else if (uiState.mode === 'inspect' && cell) {
          const g = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
          if (g && ZS.DATA.ITEMS[g.id]) {
            const def = ZS.DATA.ITEMS[g.id];
            const gStatus = ZS.Game.getB1GadgetStatus ? ZS.Game.getB1GadgetStatus(tx, ty) : null;
            const stText = !gStatus || !gStatus.connected
              ? '미연결(대기)'
              : gStatus.blackoutPaused
              ? '야간 정전'
              : '활성';
            tipText = `${def.name} (${stText})`;
            tipKind = !gStatus || !gStatus.active ? 'err' : 'ok';
            tipIcon = 'b1-systems';
            tipIconCls = !gStatus || !gStatus.active ? 'icon-danger' : 'icon-heal';
          } else if (cell.elevator) {
            tipText = '지하 화물 승강기 (지상 복귀)';
            tipKind = 'info';
            tipIcon = 'b1-elevator';
            tipIconCls = 'icon-ap';
          } else if (cell.permanentCorridor) {
            tipText = '승강기 공용 복도';
            tipKind = 'info';
            tipIcon = 'b1-zone';
            tipIconCls = 'icon-ap';
          } else if (cell.corridor) {
            const isCorrConn = ZS.Game.isB1CorridorConnected ? ZS.Game.isB1CorridorConnected(tx, ty) : false;
            tipText = isCorrConn ? '전술 복도 (연결됨)' : '전술 복도 (미연결)';
            tipKind = isCorrConn ? 'ok' : 'err';
            tipIcon = 'b1-corridor';
            tipIconCls = isCorrConn ? 'icon-heal' : 'icon-danger';
          } else if (cell.roomId != null && ug && ug.rooms[cell.roomId]) {
            const room = ug.rooms[cell.roomId];
            const rDef = ZS.Game.getB1RoomDef ? ZS.Game.getB1RoomDef(room.role) : null;
            tipText = `${rDef ? rDef.name : room.role} (${room.connected ? '연결됨' : '미연결'})`;
            tipKind = room.connected ? 'ok' : 'err';
            tipIcon = (rDef && rDef.iconId) || 'b1-zone';
            tipIconCls = room.connected ? 'icon-heal' : 'icon-danger';
          } else if (cell.excavated) {
            tipText = '굴착 공간 (복도·방 지정 가능)';
            tipKind = 'info';
            tipIcon = 'b1-zone';
            tipIconCls = 'icon-muted';
          } else if (cell.bedrock) {
            tipText = '기반암 (굴착 불가)';
            tipKind = 'info';
            tipIcon = 'state-lock';
            tipIconCls = 'icon-muted';
          } else {
            const tier = ZS.Game.getB1RockTier ? ZS.Game.getB1RockTier(tx, ty) : 1;
            const cost = ZS.Game.getB1DigCost ? ZS.Game.getB1DigCost(tx, ty) : 1;
            const tName = ZS.Game.getB1RockTierName ? ZS.Game.getB1RockTierName(tier) : '암반';
            tipText = `${tName} · 굴착 ${cost} AP`;
            tipKind = 'info';
            tipIcon = 'b1-dig';
            tipIconCls = 'icon-ap';
          }
        }

        if (!tipText) {
          hideTip();
          return;
        }
        tipEl.innerHTML = `${ozIcon(tipIcon, 14, tipIconCls)}<span>${escapeHtml(tipText)}</span>`;
        tipEl.classList.toggle('ok', tipKind === 'ok');
        tipEl.classList.toggle('info', tipKind === 'info');
        tipEl.classList.remove('hidden');
        lastTipVisible = true;
        cachedTipW = tipEl.offsetWidth || 240;
        cachedTipH = tipEl.offsetHeight || 32;
      }
      if (!lastTipVisible) return;
      const vw = window.innerWidth || 1600;
      const vh = window.innerHeight || 900;
      tipEl.style.left = `${Math.max(12, Math.min(vw - cachedTipW - 14, uiState.pointerClient.x + 16))}px`;
      tipEl.style.top = `${Math.max(70, Math.min(vh - cachedTipH - 14, uiState.pointerClient.y + 16))}px`;
      return;
    }

    const N = ZS.DATA.GRID_SIZE;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) {
      hideTip();
      return;
    }

    const hoveredTerrain = ZS.Game.getTerrainAt ? ZS.Game.getTerrainAt(tx, ty) : (st.terrainGrid && st.terrainGrid[ty] && st.terrainGrid[ty][tx]);
    const tKey = hoveredTerrain ? `${hoveredTerrain.kind}:${hoveredTerrain.tier || 0}:${hoveredTerrain.isPeak ? 1 : 0}` : '';
    const moveSrcKey = uiState.movingSource ? `${uiState.movingSource.tx},${uiState.movingSource.ty}` : '';
    const vKey = uiState.selectedItemId
      ? `${st.freeVouchers[uiState.selectedItemId] || 0},${st.freeVouchers.barricade_wall || 0}`
      : '0';
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const techKey = Object.keys(st.researchedTechs || {}).map((k) => `${k}:${st.researchedTechs[k]}`).join(',');
    const nextKey = `${st.phase}|${uiState.mode}|${uiState.selectedItemId || ''}|${tx},${ty}|${tKey}|${st.showWindOverlay ? 1 : 0}|${moveSrcKey}|${Math.floor(st.wood)},${Math.floor(st.scrap)},${Math.floor(st.coin)}|${st.popUsed},${st.agents},${st.popCap},${jobs.combat}|${st.hqLevel}|${st.bossDefeated ? 1 : 0}|${vKey}|${techKey}`;

    if (nextKey !== lastTipStateKey) {
      lastTipStateKey = nextKey;
      let tipText = null;
      let tipKind = 'err';
      let tipIcon = 'state-alert';
      let tipIconCls = 'icon-danger';

      const formatTerrainBuildBonus = (def, tCell) => {
        if (!def || !tCell) return null;
        if (tCell.kind === 'plateau') {
          if (
            def.subType === 'manned' ||
            def.subType === 'turret' ||
            def.id === 'led_floodlight' ||
            def.id === 'repair_bay' ||
            def.id === 'gas_heater' ||
            def.subType === 'comfort' ||
            def.id === 'boss_trophy'
          ) {
            return '고지대 보너스';
          }
        } else if (tCell.kind === 'wind' && def.id === 'wind_turbine' && st.showWindOverlay) {
          return (tCell.tier || 1) >= 2 ? '돌풍 핵심 +70%' : '강풍 +40%';
        } else if (tCell.kind === 'ramp' && def.id === 'razor_pad') {
          return '경사로 함정 설치';
        }
        return null;
      };

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
          tipText = `${wName} 상부 거치`;
          tipKind = 'ok';
          tipIcon = 'mount';
          tipIconCls = 'icon-heal';
        } else if (check && check.ok && check.autoUnderlay && hoveredSt) {
          const uCost = check.underlayCost || { wood: 10, scrap: 12 };
          const vCount = (st.freeVouchers && st.freeVouchers.barricade_wall) || 0;
          const costStr = vCount > 0 ? '보급권 1' : `목재 ${uCost.wood}·철재 ${uCost.scrap}`;
          tipText = `성벽 하부 승격 (${costStr})`;
          tipKind = 'ok';
          tipIcon = 'wall-link';
          tipIconCls = 'icon-heal';
        } else if (check && check.ok && hoveredTerrain) {
          const bonusTip = formatTerrainBuildBonus(itemDef, hoveredTerrain);
          if (bonusTip) {
            tipText = bonusTip;
            tipKind = 'ok';
            tipIcon = hoveredTerrain.kind === 'wind' ? 'hud-wind' : 'nav-recon';
            tipIconCls = 'icon-heal';
          }
        }
      } else if (uiState.mode === 'move' && uiState.movingSource) {
        const srcCell = st.structGrid[uiState.movingSource.ty] && st.structGrid[uiState.movingSource.ty][uiState.movingSource.tx];
        const srcUnit = srcCell && (srcCell.mounted || srcCell);
        const srcDef = srcUnit ? ZS.DATA.ITEMS[srcUnit.id] : null;
        if (tx <= 0 || ty <= 0 || tx >= N - 1 || ty >= N - 1) {
          tipText = '외곽 구역 이동 불가';
        } else if (hoveredTerrain && hoveredTerrain.kind === 'rock') {
          tipText = '암석 지형 이동 불가';
          tipIcon = 'state-lock';
        } else if (hoveredTerrain && hoveredTerrain.kind === 'ramp' && (!srcDef || srcDef.id !== 'razor_pad')) {
          tipText = '경사로: 가시 함정 전용';
          tipIcon = 'state-lock';
        } else if (!(uiState.movingSource.tx === tx && uiState.movingSource.ty === ty) && st.structGrid[ty] && st.structGrid[ty][tx]) {
          const dest = st.structGrid[ty][tx];
          if (srcDef && srcDef.canMountOnWall && dest.id === 'barricade_wall') {
            if ((dest.level || 1) >= 2 && !dest.mounted) {
              tipText = `${ZS.Game.getStructureDisplayName(dest)} 상부 거치`;
              tipKind = 'ok';
              tipIcon = 'mount';
              tipIconCls = 'icon-heal';
            } else if ((dest.level || 1) === 1) {
              tipText = '성벽 Lv.2 강화 필요';
              tipIcon = 'mount';
            } else {
              tipText = '이미 거치된 성벽';
            }
          } else {
            tipText = '설치 불가: 점유됨';
          }
        } else if (hoveredTerrain && srcDef) {
          const moveBonus = formatTerrainBuildBonus(srcDef, hoveredTerrain);
          if (moveBonus) {
            tipText = moveBonus;
            tipKind = 'ok';
            tipIcon = hoveredTerrain.kind === 'wind' ? 'hud-wind' : 'nav-recon';
            tipIconCls = 'icon-heal';
          }
        }
      } else if (uiState.mode === 'inspect' && hoveredTerrain && !(st.structGrid[ty] && st.structGrid[ty][tx])) {
        if (hoveredTerrain.kind !== 'wind' || st.showWindOverlay) {
          const meta = getTerrainUiMeta(hoveredTerrain);
          if (meta) {
            tipText = meta.tipText;
            tipKind = 'info';
            tipIcon = meta.tipIcon;
            tipIconCls = meta.tipIconCls;
          }
        }
      }

      if (!tipText) {
        if (lastTipVisible) {
          tipEl.classList.remove('ok', 'info');
          tipEl.classList.add('hidden');
          lastTipVisible = false;
        }
        return;
      }

      tipEl.innerHTML = `${ozIcon(tipIcon, 14, tipIconCls)}<span>${escapeHtml(tipText)}</span>`;
      tipEl.classList.toggle('ok', tipKind === 'ok');
      tipEl.classList.toggle('info', tipKind === 'info');
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

  function setDetailHtml(html, actionsHtml, eyebrow) {
    const bar = document.getElementById('detail-bar');
    if (bar) {
      bar.classList.remove('composite');
      bar.classList.remove('idle-hidden');
    }
    const eyebrowEl = document.getElementById('detail-panel-eyebrow');
    if (eyebrowEl) {
      eyebrowEl.textContent = eyebrow || '전술 정보';
    }
    const textEl = document.getElementById('detail-text');
    if (textEl) {
      textEl.innerHTML = html;
      textEl.scrollTop = 0;
    }
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = actionsHtml || '';
    }
  }

  function setCompositeDetailHtml(innerHtml, eyebrow) {
    const bar = document.getElementById('detail-bar');
    if (bar) {
      bar.classList.add('composite');
      bar.classList.remove('idle-hidden');
    }
    const eyebrowEl = document.getElementById('detail-panel-eyebrow');
    if (eyebrowEl) {
      eyebrowEl.textContent = eyebrow || '복합 방어 진지';
    }
    const textEl = document.getElementById('detail-text');
    if (textEl) {
      textEl.innerHTML = innerHtml;
      textEl.scrollTop = 0;
    }
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = '';
    }
  }

  function formatAuraStacksText(auraStacks) {
    if (!auraStacks) return '';
    const hasAny = Object.keys(auraStacks).some((k) => (auraStacks[k] || 0) > 0);
    return hasAny ? ' · 오라 강화' : '';
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
    const refreshCost = ZS.Game.getEffectiveTraderRefreshCost ? ZS.Game.getEffectiveTraderRefreshCost() : (st.traderRefreshCost || 15);
    const discPct = Math.round((st.b1TraderDisc || 0) * 100);
    if (refreshBtn) {
      refreshBtn.disabled = !isDay || st.coin < refreshCost;
      refreshBtn.innerHTML = `${ozIcon('sys-reset', 15)}<span>무전 보급 목록 갱신 (${refreshCost} 코인${discPct > 0 ? ` · -${discPct}%` : ''})</span>`;
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
          <span class="inline-icon-text">${ozIcon('act-trader', 15, 'icon-coin')}<b>대량 자원 환전소</b></span>
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
          <span class="inline-icon-text">${ozIcon('phase-night', 15, 'icon-coin')}<b>야간 작전 보급품 (WAVE ${st.wave})</b></span>
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
      const effCost = ZS.Game.getEffectiveTraderOfferCost ? ZS.Game.getEffectiveTraderOfferCost(offer) : offer.coinCost;
      const canBuy = !offer.sold && st.coin >= effCost && isDay;

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
          ${offer.sold ? '<span>보급 완료</span>' : `${ozIcon('res-coin', 15, 'icon-coin')}<span>${effCost} 코인으로 구매${effCost < offer.coinCost ? ` (-${Math.round((st.b1TraderDisc || 0) * 100)}%)` : ''}</span>`}
        </button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        ZS.Game.buyTraderOffer(idx);
      });
      grid.appendChild(card);
    });
  }

  function inspectB1TileAt(tx, ty, st) {
    const b1Size = ZS.DATA.B1_SIZE || 23;
    if (tx < 0 || ty < 0 || tx >= b1Size || ty >= b1Size) return;
    uiState.inspectedTile = { tx, ty };
    const ug = ZS.Game.ensureUndergroundState ? ZS.Game.ensureUndergroundState() : st.underground;
    const cell = ug && ug.grid && ug.grid[ty] && ug.grid[ty][tx];
    if (!cell) return;

    if (cell.elevator) {
      const sum = ZS.Game.getB1Summary ? ZS.Game.getB1Summary() : { roomCount: 0, connectedRooms: 0 };
      const exitBtnHtml = `<button id="btn-exit-b1" class="detail-upgrade-btn b1-action-btn">${ozIcon('b1-elevator', 15, 'icon-ap')}<span>지상 본부 복귀</span></button>`;
      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'b1-elevator',
          iconCls: 'icon-ap',
          title: '지하 화물 승강기',
          statsHtml: `굴착력 ${Math.floor(st.digAp || 0)}/${st.digApCap || 24} AP · 연결 구역 ${sum.connectedRooms}/${sum.roomCount}`,
          descHtml: '지상 본부와 지하 쉘터를 연결하는 중앙 수직 통로입니다.'
        }),
        exitBtnHtml,
        '지하 시설'
      );
      document.getElementById('btn-exit-b1')?.addEventListener('click', () => {
        if (ZS.Game.exitUnderground) ZS.Game.exitUnderground();
      });
      return;
    }

    const gadget = ug && ug.b1StructGrid && ug.b1StructGrid[ty] && ug.b1StructGrid[ty][tx];
    if (gadget && ZS.DATA.ITEMS[gadget.id]) {
      const def = ZS.DATA.ITEMS[gadget.id];
      const status = ZS.Game.getB1GadgetStatus ? ZS.Game.getB1GadgetStatus(tx, ty) : null;
      const room = cell.roomId != null && ug.rooms[cell.roomId] ? ug.rooms[cell.roomId] : null;
      const rDef = room && ZS.Game.getB1RoomDef ? ZS.Game.getB1RoomDef(room.role) : null;
      const roleTitle = rDef ? rDef.name : '지하 공용';
      let statusHtml = `<span class="cost-chip free">작동 중</span>`;
      if (status && !status.connected) {
        statusHtml = `<span class="cost-chip short">${ozIcon('state-alert', 13, 'icon-danger')}<span>미연결 대기</span></span>`;
      } else if (status && status.blackoutPaused) {
        statusHtml = `<span class="cost-chip short">${ozIcon('res-power', 13, 'icon-danger')}<span>야간 정전</span></span>`;
      }
      const rotLabel = getB1RotLabel(gadget.rot || 0);
      const actionBtns =
        st.phase === 'day'
          ? `<button id="btn-b1-inspect-rotate" class="detail-upgrade-btn b1-action-btn">${ozIcon('sys-reset', 14)}<span>회전 (R)</span></button><button id="btn-b1-inspect-move" class="detail-upgrade-btn b1-action-btn">${ozIcon('tool-move', 14)}<span>이동 (M)</span></button><button id="btn-b1-inspect-remove" class="detail-upgrade-btn">${ozIcon('tool-remove', 14, 'icon-danger')}<span>철거 (X)</span></button>`
          : '';
      setDetailHtml(
        buildDetailCardHtml({
          thumbItemId: def.id,
          iconId: (rDef && rDef.iconId) || 'b1-systems',
          title: def.name,
          tagHtml: `${statusHtml}<span class="cost-chip b1-role-chip">${escapeHtml(roleTitle)}</span>`,
          statsHtml: `방향: ${escapeHtml(rotLabel)}`,
          descHtml: escapeHtml(def.desc || '')
        }),
        actionBtns,
        '지하 설비'
      );
      document.getElementById('btn-b1-inspect-rotate')?.addEventListener('click', () => {
        rotateActiveB1Gadget();
      });
      document.getElementById('btn-b1-inspect-move')?.addEventListener('click', () => {
        setToolMode('move');
        uiState.movingSource = { tx, ty };
        uiState.b1BuildRot = gadget.rot || 0;
        setDetailHtml(formatB1MoveDetailHtml(def), '', '전술 도구');
        updateCursorTooltip();
      });
      document.getElementById('btn-b1-inspect-remove')?.addEventListener('click', () => {
        if (ZS.Game.removeB1ItemAt && ZS.Game.removeB1ItemAt(tx, ty)) {
          uiState.inspectedTile = null;
          setToolMode('inspect');
        }
      });
      return;
    }

    if (cell.permanentCorridor) {
      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'b1-zone',
          iconCls: 'icon-ap',
          title: '승강기 공용 복도',
          descHtml: '방과 복도·방폭문이 이어지면 구역이 활성화됩니다.'
        }),
        '',
        '지하 구역'
      );
      return;
    }

    if (cell.corridor) {
      const isCorrConn = ZS.Game.isB1CorridorConnected ? ZS.Game.isB1CorridorConnected(tx, ty) : false;
      const corrBadge = isCorrConn
        ? `<span class="cost-chip free">연결됨</span>`
        : `<span class="cost-chip short">${ozIcon('state-alert', 13, 'icon-danger')}<span>미연결</span></span>`;
      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'b1-corridor',
          iconCls: isCorrConn ? 'icon-ap' : 'icon-danger',
          title: '전술 복도',
          tagHtml: corrBadge,
          descHtml: '승강기와 방 구역을 연결하는 지하 통로입니다.'
        }),
        '',
        '지하 구역'
      );
      return;
    }

    if (cell.roomId != null && ug.rooms[cell.roomId]) {
      const room = ug.rooms[cell.roomId];
      const rDef = ZS.Game.getB1RoomDef ? ZS.Game.getB1RoomDef(room.role) : null;
      const statusBadge = room.connected
        ? `<span class="cost-chip free">연결 활성</span>`
        : `<span class="cost-chip short">${ozIcon('state-alert', 13, 'icon-danger')}<span>미연결 대기</span></span>`;
      setDetailHtml(
        buildDetailCardHtml({
          iconId: (rDef && rDef.iconId) || 'b1-zone',
          title: (rDef && rDef.name) || room.role,
          tagHtml: `${statusBadge}<span class="cost-chip">${room.tiles.length}칸</span>`,
          descHtml: escapeHtml((rDef && rDef.desc) || '')
        }),
        '',
        '지하 구역'
      );
      return;
    }

    if (cell.excavated) {
      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'b1-zone',
          title: '굴착 공간',
          descHtml: '전술 복도 또는 방 구역을 지정해 설비를 배치하세요.'
        }),
        '',
        '지하 지형'
      );
      return;
    }

    if (cell.bedrock) {
      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'state-lock',
          iconCls: 'icon-muted',
          title: '기반암',
          descHtml: '굴착할 수 없는 외곽 암반입니다.'
        }),
        '',
        '지하 지형'
      );
      return;
    }

    const tier = ZS.Game.getB1RockTier ? ZS.Game.getB1RockTier(tx, ty) : 1;
    const cost = ZS.Game.getB1DigCost ? ZS.Game.getB1DigCost(tx, ty) : 1;
    const tierName = ZS.Game.getB1RockTierName ? ZS.Game.getB1RockTierName(tier) : '암반';
    setDetailHtml(
      buildDetailCardHtml({
        thumbB1ToolId: 'b1_dig',
        iconId: 'b1-dig',
        iconCls: 'icon-ap',
        title: tierName,
        tagHtml: `<span class="cost-chip b1-ap-cost">${ozIcon('b1-dig', 12, 'icon-ap')}<span>굴착 ${cost} AP</span></span>`,
        descHtml: '굴착 도구를 선택해 공간을 확보한 뒤 방 구역을 지정할 수 있습니다.'
      }),
      '',
      '지하 암반'
    );
  }

  function inspectTileAt(tx, ty) {
    const st = ZS.Game.state;
    if (st.activeLayer === 'underground') {
      inspectB1TileAt(tx, ty, st);
      return;
    }
    if (tx < 0 || ty < 0 || tx >= ZS.DATA.GRID_SIZE || ty >= ZS.DATA.GRID_SIZE) return;
    uiState.inspectedTile = { tx, ty };

    const obj = st.structGrid[ty][tx];
    const fid = st.floorGrid[ty][tx];
    const fDef = fid ? ZS.DATA.ITEMS[fid] : null;
    const tCell = ZS.Game.getTerrainAt ? ZS.Game.getTerrainAt(tx, ty) : (st.terrainGrid && st.terrainGrid[ty] && st.terrainGrid[ty][tx]);
    const tMeta = getTerrainUiMeta(tCell);

    if (!obj) {
      if (tMeta && (tCell.kind !== 'wind' || st.showWindOverlay)) {
        const floorSuffix = fDef ? ` · 바닥: ${escapeHtml(fDef.name)}` : '';
        const iconId = tCell.kind === 'wind' ? 'hud-wind' : 'nav-recon';
        const iconCls = tCell.kind === 'wind' ? 'icon-heal' : 'icon-coin';
        setDetailHtml(
          buildDetailCardHtml({
            thumbItemId: fDef ? fDef.id : null,
            iconId,
            iconCls,
            title: tMeta.title,
            tagHtml: `<span class="cost-chip">${escapeHtml(tMeta.badge)}</span>`,
            descHtml: `${escapeHtml(tMeta.desc)}${floorSuffix}`
          }),
          '',
          '지형 정보'
        );
      } else if (fDef) {
        setDetailHtml(
          buildDetailCardHtml({
            thumbItemId: fDef.id,
            iconId: 'cat-decor',
            iconCls: 'icon-coin',
            title: fDef.name,
            tagHtml: '<span class="cost-chip">바닥재 시공됨</span>',
            descHtml: escapeHtml(fDef.desc || '')
          }),
          '',
          '바닥 정보'
        );
      } else {
        setDetailHtml(
          buildDetailCardHtml({
            iconId: 'tool-inspect',
            title: '빈 전술 구역',
            descHtml: '우측 도크에서 방벽, 발전기, 숙소 또는 가구를 선택해 배치하세요.'
          }),
          '',
          '구역 정보'
        );
      }
      return;
    }

    if (obj.id === 'command_hq') {
      const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
      const maxHqLv = (ZS.DATA.HQ_LEVELS && ZS.DATA.HQ_LEVELS.length) || 5;
      const divDef = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef() : null;
      const basePopCap = hqInfo.basePopCap + ((divDef && divDef.basePopCapBonus) || 0);
      const hqMaxCrew = ZS.Game.getStructMaxCrew ? ZS.Game.getStructMaxCrew(obj) : 0;
      const hqCrew = Math.max(0, Math.min(hqMaxCrew, Math.floor(Number(obj.crew) || 0)));
      const hqRateMult = ZS.Game.getStructCrewRateMult ? ZS.Game.getStructCrewRateMult(obj) : 1.0;
      const wpnText = hqInfo.weapon
        ? (hqCrew > 0
          ? `무장: ${hqInfo.weapon.name} (배치 ${hqCrew}/${hqMaxCrew} · 공속 ${Math.round(hqRateMult * 100)}%)`
          : `무장: ${hqInfo.weapon.name} (미배치 비활성)`)
        : '무장 없음 (Lv.2 개방)';
      const upCheck = ZS.Game.canUpgradeHq();
      let actionHtml = '';
      if (hqMaxCrew > 0) {
        actionHtml += buildCrewStepperHtml(st, obj, tx, ty, false);
      }
      if (st.hqLevel < maxHqLv) {
        const nextInfo = ZS.Game.getHqLevelInfo(st.hqLevel + 1);
        const hqCost = upCheck.cost || (ZS.Game.getEffectiveHqUpgradeCost ? ZS.Game.getEffectiveHqUpgradeCost(st.hqLevel + 1) : nextInfo.cost) || {};
        const costHtml = formatInlineCostHtml(hqCost, 14);
        const disabledAttr = upCheck.ok ? '' : 'disabled';
        if (upCheck.lockedByWave) {
          actionHtml += `<button id="btn-upgrade-hq" class="detail-upgrade-btn" disabled title="${escapeHtml(upCheck.reason)}">${ozIcon('state-lock', 14, 'icon-muted')}<span>WAVE ${upCheck.reqWave}+ 필요</span>(${costHtml})</button>`;
        } else {
          const nextTip = `${nextInfo.name} 증축 (HP ${nextInfo.maxHp} · 수용 ${nextInfo.basePopCap}명 · 충전 +${nextInfo.baseDayCharge})`;
          actionHtml += `<button id="btn-upgrade-hq" class="detail-upgrade-btn" ${disabledAttr} title="${escapeHtml(upCheck.ok ? nextTip : upCheck.reason)}">${ozIcon('state-upgrade', 16)}<span>본부 Lv.${nextInfo.level} 증축</span>(${costHtml})</button>`;
        }
      } else {
        actionHtml += `<span class="cost-chip free">★ 최고 등급(Lv.${maxHqLv})</span>`;
      }

      if ((st.hqLevel || 1) >= 2 && st.undergroundUnlocked) {
        const b1Dis = st.phase !== 'day' ? 'disabled' : '';
        actionHtml += `<button id="btn-enter-b1" class="detail-upgrade-btn b1-action-btn" ${b1Dis} title="지하 B1 쉘터 레이어 진입 (주간 전용 · 단축키 B)">${ozIcon('b1-elevator', 15, 'icon-ap')}<span>지하 B1 진입</span></button>`;
      }

      const nightBuffs = [];
      if (st.nightConsumables && st.nightConsumables.overpressureAmmo) nightBuffs.push('고압 탄약');
      if (st.nightConsumables && st.nightConsumables.reactiveArmor) nightBuffs.push('반응 장갑');
      const buffTxt = nightBuffs.length > 0 ? ` · ${nightBuffs.join(' · ')}` : '';
      const hqCrewTag = hqMaxCrew > 0
        ? (hqCrew <= 0
          ? `<span class="cost-chip short">${ozIcon('res-agent', 13, 'icon-danger')}<span>옥상 포대 0/${hqMaxCrew}명 · 비활성</span></span>`
          : `<span class="cost-chip free">${ozIcon('res-agent', 13, 'icon-heal')}<span>옥상 포대 ${hqCrew}/${hqMaxCrew}명 · 공속 ${Math.round(hqRateMult * 100)}%</span></span>`)
        : '';

      setDetailHtml(
        buildDetailCardHtml({
          iconId: 'hud-hq',
          iconCls: 'icon-coin',
          title: hqInfo.name,
          lvLabel: `Lv.${st.hqLevel}`,
          tagHtml: hqCrewTag,
          hp: obj.hp,
          maxHp: obj.maxHp,
          statsHtml: `충전 +${hqInfo.baseDayCharge} · 용량 ${hqInfo.basePowerCap} · 수용 ${basePopCap}명 · 연구 ${hqInfo.researchSlots || 2} · 생산 ${hqInfo.prodSlots || 2} · ${escapeHtml(wpnText)}${escapeHtml(buffTxt)}`,
          descHtml: '중앙 지휘 거점입니다. 파괴되면 방어 작전이 종료됩니다.'
        }),
        actionHtml,
        '지휘 본부'
      );

      bindCrewStepperEvents(document.getElementById('detail-actions'));
      const upBtn = document.getElementById('btn-upgrade-hq');
      if (upBtn) {
        upBtn.addEventListener('click', () => {
          ZS.Game.upgradeHq();
        });
      }
      const enterB1Btn = document.getElementById('btn-enter-b1');
      if (enterB1Btn) {
        enterB1Btn.addEventListener('click', () => {
          if (ZS.Game.enterUnderground) ZS.Game.enterUnderground();
        });
      }
      return;
    }

    const def = ZS.DATA.ITEMS[obj.id];
    if (!def) return;

    function buildCrewStepperHtml(curState, targetSt, gx, gy, isMounted) {
      const maxC = ZS.Game.getStructMaxCrew ? ZS.Game.getStructMaxCrew(targetSt) : 0;
      if (maxC <= 0) return '';
      const crew = Math.max(0, Math.min(maxC, Math.floor(Number(targetSt.crew) || 0)));
      const jobs = (curState && curState.jobs) || { combat: 0, research: 0, prod: 0 };
      const assigned = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
      const unassigned = Math.max(0, ((curState && curState.agents) || 0) - assigned);
      const isOver = curState && curState.phase === 'gameover';
      const minusDis = isOver || crew <= 0 ? 'disabled' : '';
      const plusDis = isOver || crew >= maxC || unassigned <= 0 ? 'disabled' : '';
      const plusTip = crew >= maxC ? `최대 ${maxC}명 배치 완료` : unassigned <= 0 ? '미배정 대기 요원 없음' : '전투요원 1명 배치';
      return `
        <span class="detail-crew-control" title="이 시설의 주둔 전투요원 인원 조정 (미배정 ${unassigned}명)">
          <span class="crew-ctl-label">${ozIcon('res-agent', 13)}<span>배치</span></span>
          <button type="button" class="crew-step-btn" data-crew-tx="${gx}" data-crew-ty="${gy}" data-crew-mounted="${isMounted ? 1 : 0}" data-crew-delta="-1" ${minusDis} title="주둔 요원 1명 해제">−</button>
          <span class="crew-step-val">${crew}/${maxC}</span>
          <button type="button" class="crew-step-btn" data-crew-tx="${gx}" data-crew-ty="${gy}" data-crew-mounted="${isMounted ? 1 : 0}" data-crew-delta="1" ${plusDis} title="${escapeHtml(plusTip)}">+</button>
        </span>
      `;
    }

    function bindCrewStepperEvents(containerEl) {
      if (!containerEl) return;
      containerEl.querySelectorAll('.crew-step-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cx = Number(btn.getAttribute('data-crew-tx'));
          const cy = Number(btn.getAttribute('data-crew-ty'));
          const isM = btn.getAttribute('data-crew-mounted') === '1';
          const d = Number(btn.getAttribute('data-crew-delta'));
          if (ZS.Game.adjustStructCrew) ZS.Game.adjustStructCrew(cx, cy, d, isM);
        });
      });
    }

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
      const remLabel = nextR ? `${Math.floor(xp)}/${nextR.minXp}` : `MAX · ${targetObj.kills || 0}킬`;
      return `
        <span class="detail-rank-box" title="처치 ${targetObj.kills || 0}기 · 숙련 ${Math.floor(xp)} XP">
          <span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${ozIcon('state-rank', 14)}</span>
          <span class="detail-rank-name" style="color:${rInfo.color};">${escapeHtml(rInfo.name)}</span>
          <span class="detail-xp-track"><span class="detail-xp-fill" style="width:${pct.toFixed(1)}%;background:${rInfo.color};"></span></span>
          <span class="detail-xp-rem">${escapeHtml(remLabel)}</span>
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
      let mCrewCtlHtml = '';
      if (mDef && (mDef.subType === 'manned' || mDef.subType === 'turret')) {
        mRankHtml = buildRankWidgetHtml(m, mEff);
        if (mDef.subType === 'manned') {
          mCrewCtlHtml = buildCrewStepperHtml(st, m, tx, ty, true);
        }
        const mPopTxt = mDef.subType === 'manned'
          ? (mEff.isInactive
            ? ` · 배치 0/${mEff.maxCrew || 1}명 (비활성)`
            : ` · 배치 ${mEff.crew || 0}/${mEff.maxCrew || 1}명 (공속 ${Math.round((mEff.crewRateMult || 1) * 100)}%)`)
          : ` · 전력 ~${getEstimatedNightPowerUse(mDef, mEff)}`;
        const mAuraTxt = formatAuraStacksText(mEff.auraStacks);
        const platTxt = mEff.onPlateau ? ' · 고지대 보너스' : '';
        const rangeTxt = mEff.range.toFixed(1).replace(/\.0$/, '');
        mSubStats = `화력 ${Math.round(mEff.damage)} · 사거리 ${rangeTxt} · 치명 ${Math.round(mEff.critChance * 100)}%${mPopTxt}${mAuraTxt}${platTxt}`;
      } else if (mDef && mDef.id === 'led_floodlight') {
        const lr = mEff.lightRadius != null ? mEff.lightRadius : mDef.lightRadius;
        mSubStats = `조명 반경 ${lr.toFixed(1).replace(/\.0$/, '')}칸 · 안락함 +${mDef.cozy || 0}`;
      } else {
        mSubStats = mDef ? escapeHtml(mDef.desc) : '';
      }

      let topUpHtml = '';
      if (mDef && ZS.Game.isUpgradeableDef(mDef)) {
        const topCheck = ZS.Game.canUpgradeStructure(tx, ty);
        if (mLv >= 3) {
          topUpHtml = `<span class="cost-chip free">◆◆◆ Lv.3 MAX</span>`;
        } else {
          const topCost = (ZS.Game.getEffectiveUpgradeCost ? ZS.Game.getEffectiveUpgradeCost(mDef, mLv) : ZS.Game.getUpgradeCost(mDef, mLv)) || {};
          const topCostHtml = formatInlineCostHtml(topCost, 13);
          const upCls = mLv + 1 === 3 && !topCheck.techLocked ? 'icon-max' : '';
          const nextTopEff = mDef.subType === 'manned' || mDef.subType === 'turret'
            ? ZS.Game.getStructureEffectiveStats(m, tx, ty, mLv + 1, true)
            : null;
          const nextTopTip = nextTopEff
            ? `Lv.${mLv + 1} 강화 (화력 ${Math.round(nextTopEff.damage)} · 사거리 ${nextTopEff.range.toFixed(1).replace(/\.0$/, '')})`
            : '단축키 U로 상부 강화';
          const inner = topCheck.techLocked
            ? `${ozIcon('state-lock', 13, 'icon-muted')}<span>${formatInspectTechLockLabel(topCheck)}</span>(${topCostHtml})`
            : `${ozIcon('state-upgrade', 14, upCls)}<span>상부 Lv.${mLv + 1}</span>(${topCostHtml})<span>[U]</span>`;
          topUpHtml = `<button id="btn-comp-up-top" class="detail-upgrade-btn" ${topCheck.ok ? '' : 'disabled'} title="${escapeHtml(topCheck.ok ? nextTopTip : topCheck.reason)}">${inner}</button>`;
        }
      }

      let wallUpHtml = '';
      const wallCheck = ZS.Game.canUpgradeWallBase ? ZS.Game.canUpgradeWallBase(tx, ty) : null;
      const wallMaxLv = ZS.Game.getStructMaxTier ? ZS.Game.getStructMaxTier(def) : 3;
      if (lv >= wallMaxLv) {
        wallUpHtml = `<span class="cost-chip free">최종 진화 완료</span>`;
      } else if (wallCheck) {
        const wCost = wallCheck.cost || (ZS.Game.getEffectiveUpgradeCost ? ZS.Game.getEffectiveUpgradeCost(def, lv) : ZS.Game.getUpgradeCost(def, lv)) || {};
        const wCostHtml = formatInlineCostHtml(wCost, 13);
        const nextWallProf = ZS.Game.getStructLevelProfile(def, lv + 1);
        const wInner = wallCheck.techLocked
          ? `${ozIcon('state-lock', 13, 'icon-muted')}<span>${formatInspectTechLockLabel(wallCheck)}</span>(${wCostHtml})`
          : `${ozIcon('wall-upgrade', 14)}<span>${escapeHtml(nextWallProf.levelName || '합금 장갑 성벽')} 업그레이드</span>(${wCostHtml})<span>[G]</span>`;
        wallUpHtml = `<button id="btn-comp-up-wall" class="detail-upgrade-btn" ${wallCheck.ok ? '' : 'disabled'} title="${escapeHtml(wallCheck.ok ? `단축키 G로 ${nextWallProf.levelName || '성벽'} 승격 (HP ${nextWallProf.baseMaxHp})` : wallCheck.reason)}">${wInner}</button>`;
      }

      const wallDiv = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef() : null;
      const defRepLv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('def_repeat') : 0;
      const wallThornsMult = ((wallDiv && wallDiv.thornsMult) || 1.0) * (1 + 0.12 * defRepLv);
      const wallStatSummary = `근접 피해 반사 ${Math.round((wallProf.thornsRatio || 0) * wallThornsMult * 100)}%`;
      const compHtml = `
        <div class="comp-list">
          <div class="comp-row top">
            <div class="comp-head">
              <span class="comp-slot">${ozIcon('mount', 13)} 상부 거치</span>
              ${mDef && ZS.Game.isUpgradeableDef(mDef) ? `<span class="comp-lv">Lv.${mLv}</span>` : ''}
            </div>
            <div class="comp-info">
              <div class="comp-title-line">
                <span class="comp-title">${escapeHtml(mDef ? mDef.name : m.id)}</span>
                ${mRankHtml}
              </div>
              <div class="comp-hpb-wrap">
                <span class="comp-hpb"><span style="width:${mHpPct.toFixed(1)}%"></span></span>
                <span class="comp-hp-txt">${Math.ceil(m.hp)}/${m.maxHp}</span>
              </div>
              <div class="comp-sub">${mSubStats}</div>
            </div>
            <div class="comp-actions">
              ${mCrewCtlHtml}
              ${topUpHtml}
              <button id="btn-comp-move-top" class="detail-upgrade-btn" ${st.phase !== 'day' ? 'disabled' : ''} title="상부 유닛만 분리해 이동 (M)">${ozIcon('unmount', 13)}<span>분리 이동 M</span></button>
              <button id="btn-comp-demolish-top" class="detail-upgrade-btn danger" ${st.phase !== 'day' ? 'disabled' : ''} title="상부 유닛만 먼저 철거 (X)">${ozIcon('tool-remove', 13, 'icon-danger')}<span>상부 철거 X</span></button>
            </div>
          </div>
          <div class="comp-row">
            <div class="comp-head">
              <span class="comp-slot">${ozIcon('wall-link', 13)} 하부 성벽</span>
              <span class="comp-lv">Lv.${lv}</span>
            </div>
            <div class="comp-info">
              <div class="comp-title-line">
                <span class="comp-title">${escapeHtml(wallName)}</span>
              </div>
              <div class="comp-hpb-wrap">
                <span class="comp-hpb wall"><span style="width:${wallHpPct.toFixed(1)}%"></span></span>
                <span class="comp-hp-txt">${Math.ceil(obj.hp)}/${obj.maxHp}</span>
              </div>
              <div class="comp-sub">${wallStatSummary}</div>
            </div>
            <div class="comp-actions">
              ${wallUpHtml}
            </div>
          </div>
        </div>
      `;
      setCompositeDetailHtml(compHtml, '복합 방어 진지');
      syncDockToolLabels();
      bindCrewStepperEvents(document.getElementById('detail-text'));
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
    let upgradeBtnTitle = '';
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
        const cost = (ZS.Game.getEffectiveUpgradeCost ? ZS.Game.getEffectiveUpgradeCost(def, lv) : ZS.Game.getUpgradeCost(def, lv)) || {};
        const costHtml = formatInlineCostHtml(cost, 14);
        const upIconCls = lv + 1 === maxLv && !upCheck.techLocked ? 'icon-max' : '';
        const nextProfBtn = ZS.Game.getStructLevelProfile(def, lv + 1);
        if (upCheck.ok) {
          if (def.subType === 'manned' || def.subType === 'turret') {
            const nextEffBtn = ZS.Game.getStructureEffectiveStats(obj, tx, ty, lv + 1);
            const nextDmgBtn = (nextEffBtn.salvoCount || 1) > 1 ? `${Math.round(nextEffBtn.damage)}×${nextEffBtn.salvoCount}` : Math.round(nextEffBtn.damage);
            upgradeBtnTitle = `Lv.${lv + 1} 강화: 화력 ${nextDmgBtn} · 사거리 ${nextEffBtn.range.toFixed(1).replace(/\.0$/, '')}`;
          } else {
            upgradeBtnTitle = `${nextProfBtn.levelName || `Lv.${lv + 1}`} 강화: HP ${nextProfBtn.baseMaxHp || obj.maxHp}`;
          }
        } else {
          upgradeBtnTitle = upCheck.reason || '';
        }
        const btnInner = upCheck.techLocked
          ? `${ozIcon('state-lock', 14, 'icon-muted')}<span>${formatInspectTechLockLabel(upCheck)}</span>(${costHtml})`
          : isTierEvo
          ? `${ozIcon('state-upgrade', 16, upIconCls)}<span>${escapeHtml(nextProfBtn.levelName || def.name)} 업그레이드</span>(${costHtml})<span>[U]</span>`
          : `${ozIcon('state-upgrade', 16, upIconCls)}<span>Lv.${lv + 1} 강화</span>(${costHtml})<span>[U]</span>`;
        actionHtml = `<button id="btn-upgrade-struct" class="detail-upgrade-btn" ${upCheck.ok ? '' : 'disabled'} title="${escapeHtml(upgradeBtnTitle)}">${btnInner}</button>`;
      }
    }

    const catIcon = def.category === 'defense' ? 'cat-defense' : def.category === 'infra' ? 'cat-infra' : 'cat-decor';

    if (def.subType === 'manned' || def.subType === 'turret') {
      const eff = ZS.Game.getStructureEffectiveStats(obj, tx, ty);
      const rankWidgetHtml = buildRankWidgetHtml(obj, eff);
      const crewStepperHtml = def.subType === 'manned' ? buildCrewStepperHtml(st, obj, tx, ty, false) : '';
      actionHtml = crewStepperHtml + rankWidgetHtml + actionHtml;

      const pwrInfo = def.requiresPower
        ? `${ozIcon('res-power', 13, 'icon-power')}<span title="야간 1웨이브 예상 전력 소모량">야간 ~${getEstimatedNightPowerUse(def, eff)} 전력</span>`
        : eff.isInactive
        ? `<span class="cost-chip short">${ozIcon('res-agent', 13, 'icon-danger')}<span>미배치 비활성 (0/${eff.maxCrew || 1}명)</span></span>`
        : `${ozIcon('res-agent', 13, 'icon-heal')}<span>배치 ${eff.crew || 0}/${eff.maxCrew || 1}명 · 공속 ${Math.round((eff.crewRateMult || 1) * 100)}% · 무전력</span>`;
      const auraInfo = formatAuraStacksText(eff.auraStacks);
      const tBonusHint = eff.onPlateau ? ' · 고지대 보너스' : '';
      const rangeStr = (v) => v.toFixed(1).replace(/\.0$/, '');
      const rangeLabel = eff.minRange > 0 ? `${rangeStr(eff.minRange)}~${rangeStr(eff.range)}` : rangeStr(eff.range);
      const dmgLabel = (eff.salvoCount || 1) > 1 ? `${Math.round(eff.damage)}×${eff.salvoCount}` : `${Math.round(eff.damage)}`;
      const perkNote = lv >= 3 && eff.perkLabel ? ` · ★${escapeHtml(eff.perkLabel.split(' (')[0])}` : '';
      setDetailHtml(
        buildDetailCardHtml({
          thumbItemId: def.id,
          thumbTier: lv,
          iconId: catIcon,
          title: def.name,
          lvLabel: `Lv.${lv}`,
          hp: obj.hp,
          maxHp: obj.maxHp,
          tagHtml: pwrInfo,
          statsHtml: `화력 ${dmgLabel} · 사거리 ${rangeLabel} · 치명 ${Math.round(eff.critChance * 100)}%${auraInfo}${tBonusHint}${perkNote}`,
          descHtml: escapeHtml(def.desc || '')
        }),
        actionHtml,
        '방어 유닛 정보'
      );
    } else if (ZS.Game.isUpgradeableDef(def)) {
      const prof = ZS.Game.getStructLevelProfile(def, lv);
      const dispName = ZS.Game.getStructureDisplayName(obj);
      const isPlateau = !!(tCell && tCell.kind === 'plateau');
      const onWindZone = !!(def.id === 'wind_turbine' && tCell && tCell.kind === 'wind');
      const windPct = onWindZone ? ((tCell.tier || 1) >= 2 ? 70 : 40) : 0;
      const divDef2 = ZS.Game.getDivisionDef ? ZS.Game.getDivisionDef() : null;
      const defRepLv2 = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('def_repeat') : 0;
      const defRepMult2 = 1 + 0.12 * defRepLv2;
      const thornsMult2 = ((divDef2 && divDef2.thornsMult) || 1.0) * defRepMult2;
      let statSummary = '';
      if (def.subType === 'wall') {
        const parts = [];
        if (prof.thornsRatio > 0) {
          parts.push(`반사 ${Math.round(prof.thornsRatio * thornsMult2 * 100)}%`);
        }
        if (def.id === 'barricade_wall') {
          parts.push(lv === 1 ? 'Lv.2 강화 시 상부 거치 해금' : '상부 거치 가능');
        }
        if (prof.perkLabel) parts.push(`★${escapeHtml(prof.perkLabel)}`);
        statSummary = parts.join(' · ');
      } else if (def.subType === 'gate') {
        const slowPct = Math.round((1 - (prof.gateSlowFactor || 0.75)) * 100);
        statSummary = `전술 관문 · 둔화 ${slowPct}%${prof.thornsRatio > 0 ? ` · 반사 ${Math.round(prof.thornsRatio * thornsMult2 * 100)}%` : ''}`;
      } else if (def.id === 'razor_pad') {
        const vulnTxt = prof.vulnMult > 1 ? ` · 취약 +${Math.round((prof.vulnMult - 1) * 100)}%` : '';
        const rampTxt = tCell && tCell.kind === 'ramp' ? ' · 경사로 배치' : '';
        const effTrapDps = Math.round(prof.trapDps * defRepMult2);
        statSummary = `지속피해 ${effTrapDps} · 둔화 ${Math.round((1 - prof.slowFactor) * 100)}%${vulnTxt}${rampTxt}`;
      } else if (def.id === 'repair_bay') {
        const bayEff = ZS.Game.getStructureEffectiveStats ? ZS.Game.getStructureEffectiveStats(obj, tx, ty) : null;
        const auraR = bayEff && bayEff.auraRadius ? bayEff.auraRadius : prof.auraRadius;
        const lightR = bayEff && bayEff.lightRadius != null ? bayEff.lightRadius : prof.lightRadius;
        const lightTxt = lightR > 0 ? ` · 조명 ${lightR.toFixed(1).replace(/\.0$/, '')}칸` : '';
        const platTxt = isPlateau ? ' · 고지대 보너스' : '';
        statSummary = `${ozIcon('act-repair', 13, 'icon-heal')}수리 반경 ${auraR.toFixed(1).replace(/\.0$/, '')}칸 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}${lightTxt}${platTxt}`;
      } else if (def.subType === 'power') {
        const pwrEff = ZS.Game.getTerrainPowerStats ? ZS.Game.getTerrainPowerStats(def.id, prof, tx, ty) : prof;
        const nightTxt = pwrEff.nightGen > 0 ? ` · 야간 발전` : '';
        const windTxt = onWindZone ? ` · 강풍 +${windPct}%` : '';
        statSummary = `${ozIcon('res-power', 13, 'icon-power')}충전 +${Math.round(pwrEff.dayCharge)}${nightTxt} · 용량 +${pwrEff.powerCap}${windTxt}`;
      } else if (def.subType === 'housing') {
        statSummary = `${ozIcon('res-agent', 13)}수용 +${prof.popCap}명 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}`;
      } else if (def.id === 'supply_workshop') {
        statSummary = `${ozIcon('act-repair', 13, 'icon-ap')}생산 직무 +${prof.prodSlots}자리 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}`;
      } else if (def.id === 'research_lab') {
        statSummary = `${ozIcon('res-rp', 13, 'icon-rp')}연구 직무 +${prof.researchSlots}자리 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}`;
      }
      setDetailHtml(
        buildDetailCardHtml({
          thumbItemId: def.id,
          thumbTier: lv,
          iconId: catIcon,
          title: dispName,
          lvLabel: isTierEvo ? '' : `Lv.${lv}`,
          hp: obj.hp,
          maxHp: obj.maxHp,
          hpWall: def.subType === 'wall' || def.subType === 'gate',
          statsHtml: statSummary,
          descHtml: escapeHtml(def.desc || '')
        }),
        actionHtml,
        '시설 정보'
      );
    } else {
      const dispName = ZS.Game.getStructureDisplayName(obj);
      const eff = ZS.Game.getStructureEffectiveStats ? ZS.Game.getStructureEffectiveStats(obj, tx, ty) : null;
      let tExtra = '';
      if (def.id === 'led_floodlight' && eff) {
        const arcNote = ZS.Game.isArcOverdriveActive && ZS.Game.isArcOverdriveActive() ? ' · ARC +25%' : '';
        tExtra = `조명 ${eff.lightRadius.toFixed(1).replace(/\.0$/, '')}칸${arcNote}`;
      } else if (tCell && tCell.kind === 'plateau' && eff && (eff.lightRadius > 0 || eff.auraRadius > 0)) {
        tExtra = '고지대 보너스 적용 중';
      }
      setDetailHtml(
        buildDetailCardHtml({
          thumbItemId: def.id,
          iconId: catIcon,
          title: dispName,
          hp: obj.hp,
          maxHp: obj.maxHp,
          statsHtml: tExtra,
          descHtml: escapeHtml(def.desc || '')
        }),
        '',
        '시설 정보'
      );
    }

    bindCrewStepperEvents(document.getElementById('detail-actions'));
    const upStructBtn = document.getElementById('btn-upgrade-struct');
    if (upStructBtn) {
      upStructBtn.addEventListener('click', () => {
        ZS.Game.upgradeStructure(tx, ty);
      });
    }
    syncDockToolLabels();
  }

  Object.assign(U, {
    renderCategoryTabs,
    getCardTagInfo,
    selectBuildCard,
    selectB1Tool,
    renderItemCards,
    setToolMode,
    syncDetailBarVisibility,
    syncDockToolLabels,
    syncDockScrollButtons,
    syncDockAndHudState,
    setDockCollapsed,
    updateCursorTooltip,
    setDetailHtml,
    setCompositeDetailHtml,
    renderTraderModal,
    formatB1MoveDetailHtml,
    rotateActiveB1Gadget,
    inspectTileAt
  });
})();
