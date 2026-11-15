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
  let lastCozyPulseSeq = 0;

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
      return {
        html: `${ozIcon('phase-day', 13, 'icon-coin')}<span>+${def.dayCharge}</span>${ozIcon('res-power', 13, 'icon-power')}<span>/ 용량+${def.powerCap}</span>`,
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
      const pwrPrefix = def.requiresPower ? `${ozIcon('res-power', 13, 'icon-power')}<span>전등 ·</span>` : '';
      if (preview && preview.isDiminished) {
        return { html: `${pwrPrefix}<span>+${preview.gain} (50%)</span>`, cls: 'tag-cozy-dim' };
      }
      return { html: `${pwrPrefix}${ozIcon('res-cozy', 13, 'icon-coin')}<span>안락함 +${def.cozy || 0}</span>`, cls: 'tag-cozy' };
    }
    if (def.subType === 'trap') return { html: `<span>무전력 둔화 함정</span>`, cls: '' };
    return { html: `<span>방호벽 · HP ${def.maxHp}</span>`, cls: '' };
  }

  function renderItemCards() {
    const container = document.getElementById('item-cards');
    container.innerHTML = '';
    const st = ZS.Game.state;

    Object.values(ZS.DATA.ITEMS).forEach((def) => {
      if (def.category !== uiState.activeCategory) return;

      const bossLocked = def.unlockedByBoss && !st.bossDefeated;
      const voucherCount = st.freeVouchers[def.id] || 0;
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
      const floorCapped = def.layer === 'floor' && (st.cozyFloorRaw || 0) >= (ZS.DATA.COZY_FLOOR_CAP || 60);
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
            showWaveBanner('특수 기념비 잠김', 'WAVE 5 알파 타이탄 변이체를 격파하면 해금됩니다.', 'warn');
          } else {
            const reqInfo = ZS.Game.getHqLevelInfo(reqHq);
            showWaveBanner(
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
        setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)}]</b> — ${escapeHtml(def.desc + cozyHint)}`);
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
  }

  function setDetailHtml(html, actionsHtml) {
    document.getElementById('detail-text').innerHTML = html;
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = actionsHtml || '';
    }
  }

  function updateHud() {
    const st = ZS.Game.state;
    const hq = st.structGrid[ZS.DATA.HQ_POS.y] && st.structGrid[ZS.DATA.HQ_POS.y][ZS.DATA.HQ_POS.x];
    const phaseIconEl = document.getElementById('hud-phase-icon');

    document.getElementById('hud-wave-num').textContent = `WAVE ${st.wave}`;
    if (st.phase === 'day') {
      phaseIconEl.className = 'icon-slot icon-coin';
      phaseIconEl.innerHTML = ozIcon('phase-day', 20);
      document.getElementById('hud-phase-text').textContent = '주간 정비 · 건설 페이즈';
    } else if (st.phase === 'night') {
      const isBlackout = st.power <= 0.01;
      phaseIconEl.className = isBlackout ? 'icon-slot icon-danger' : 'icon-slot';
      phaseIconEl.innerHTML = ozIcon(isBlackout ? 'state-power-off' : 'phase-night', 20);
      document.getElementById('hud-phase-text').textContent = isBlackout ? '블랙아웃 교전 중!' : '야간 방어 교전 중';
    } else {
      phaseIconEl.className = 'icon-slot icon-danger';
      phaseIconEl.innerHTML = ozIcon('state-alert', 20);
      document.getElementById('hud-phase-text').textContent = '작전 실패';
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

    // Power display & blackout icon state (#9)
    const pwrVal = Math.round(st.power);
    const isNightBlackout = st.isNight && st.power <= 0.01;
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    const pwrBar = document.getElementById('res-power-bar');
    const P = ZS.DATA.PALETTE;
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background =
      pwrPct > 35
        ? P.power
        : pwrPct > 5
        ? P.healthMid
        : P.danger;

    const pwrIconEl = document.getElementById('res-power-icon');
    if (pwrIconEl) {
      pwrIconEl.className = isNightBlackout ? 'res-icon icon-danger' : 'res-icon icon-power';
      pwrIconEl.innerHTML = ozIcon(isNightBlackout ? 'state-power-off' : 'res-power', isNightBlackout ? 16 : 18);
    }

    document.querySelector('.power-pill').classList.toggle('blackout', isNightBlackout);
    document.getElementById('res-power-sub').textContent = isNightBlackout
      ? '배터리 방전 (자동포탑 정지)'
      : `낮 충전 +${st.dayCharge} · 대기 -${st.nightIdleDrain.toFixed(1)}/s`;

    // Population display
    document.getElementById('res-pop').innerHTML = `${st.popUsed} / ${st.agents} <span class="pop-cap">(숙소 ${st.popCap})</span>`;

    // Cozy Morale Lv.1~8 display, 8-segment bar, heart stroke scaling & table tooltip
    const tier = st.cozyTier;
    const tiers = ZS.DATA.COZY_TIERS || [];
    document.getElementById('res-cozy').textContent = `Lv.${tier.level}`;

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

    const cozyPillEl = document.getElementById('cozy-pill');
    if (cozyPillEl && st.cozyPulseSeq && st.cozyPulseSeq !== lastCozyPulseSeq) {
      lastCozyPulseSeq = st.cozyPulseSeq;
      cozyPillEl.classList.remove('tier-up-pulse');
      if (cozyPillEl.offsetWidth !== undefined) {
        // Trigger reflow when running in browser DOM
      }
      cozyPillEl.classList.add('tier-up-pulse');
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

    // Toggle Day vs Night right-side action stacks
    const isDay = st.phase === 'day';
    document.getElementById('day-actions').classList.toggle('hidden', !isDay);
    document.getElementById('night-actions').classList.toggle('hidden', st.phase !== 'night');
    document.getElementById('build-dock').style.opacity = isDay ? '1' : '0.75';

    if (isDay) {
      document.getElementById('cta-wave-sub').innerHTML =
        st.wave % 5 === 0
          ? `${ozIcon('state-alert', 14, 'icon-danger')}<span>WAVE ${st.wave} 보스전 개시</span>`
          : `<span>WAVE ${st.wave} 야간 방어 돌입</span>`;

      const rep = ZS.Game.getRepairAllInfo();
      const repBtn = document.getElementById('btn-repair-all');
      const repLbl = document.getElementById('repair-cost-label');
      repBtn.disabled = !rep.needed;
      repLbl.innerHTML = rep.needed
        ? `<span>비용:</span>${ozIcon('res-wood', 13, 'icon-wood')}<span>${rep.woodCost}</span><span>·</span>${ozIcon('res-scrap', 13, 'icon-scrap')}<span>${rep.scrapCost}</span>`
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
      document.getElementById('skill-strike-cd').innerHTML =
        st.skills.airstrikeCd > 0
          ? `재장전 중 (${Math.ceil(st.skills.airstrikeCd)}초)`
          : uiState.activeSkill === 'airstrike'
          ? `${ozIcon('sys-center', 13, 'icon-danger')}<span>타격할 타일을 클릭하세요!</span>`
          : '지정 위치 광역 폭격 + 조명';
    }

    renderItemCards();
    if (uiState.inspectedTile && uiState.mode === 'inspect') {
      inspectTileAt(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
    }
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
    document.getElementById('trader-coin-val').innerHTML = `${ozIcon('res-coin', 16, 'icon-coin')}<span>${Math.floor(st.coin)}</span>`;
    const grid = document.getElementById('trader-grid');
    grid.innerHTML = '';

    st.traderOffers.forEach((offer, idx) => {
      const card = document.createElement('div');
      card.className = 'offer-card';
      const canBuy = !offer.sold && st.coin >= offer.coinCost && st.phase === 'day';

      let iconVisualHtml = '';
      if (offer.type === 'free_item' && offer.itemId && ZS.Renderer.renderItemThumbnail) {
        const thumbSrc = ZS.Renderer.renderItemThumbnail(offer.itemId, 44);
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

      setDetailHtml(
        `${ozIcon('hud-hq', 14)} <b>[${escapeHtml(hqInfo.name)} · Lv.${st.hqLevel}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 충전 +${hqInfo.baseDayCharge} · 용량 ${hqInfo.basePowerCap} · 숙소 ${hqInfo.basePopCap}명 · ${escapeHtml(wpnText)}`,
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

    const lv = obj.level || 1;
    let actionHtml = '';
    if (ZS.Game.isUpgradeableDef(def)) {
      const upCheck = ZS.Game.canUpgradeStructure(tx, ty);
      if (lv >= 3) {
        const perk = ZS.DATA.LV3_PERK_LABELS && ZS.DATA.LV3_PERK_LABELS[def.id];
        actionHtml = `<span class="cost-chip free" title="${escapeHtml(perk || '')}">◆◆◆ Lv.3 MAX</span>`;
      } else {
        const cost = ZS.Game.getUpgradeCost(def, lv) || {};
        const costHtml = formatInlineCostHtml(cost, 14);
        const upIconCls = lv + 1 === 3 && !upCheck.hqCapped ? 'icon-max' : '';
        const btnInner = upCheck.hqCapped
          ? `${ozIcon('state-lock', 14, 'icon-muted')}<span>본부 Lv.${upCheck.reqHqLevel} 필요</span>(${costHtml})`
          : `${ozIcon('state-upgrade', 16, upIconCls)}<span>Lv.${lv + 1} 강화</span>(${costHtml})<span>[U]</span>`;
        actionHtml = `<button id="btn-upgrade-struct" class="detail-upgrade-btn" ${upCheck.ok ? '' : 'disabled'} title="${escapeHtml(upCheck.ok ? '단축키 U로 즉시 강화' : upCheck.reason)}">${btnInner}</button>`;
      }
    }

    const catIcon = def.category === 'defense' ? 'cat-defense' : def.category === 'infra' ? 'cat-infra' : 'cat-decor';

    if (def.subType === 'manned' || def.subType === 'turret') {
      const eff = ZS.Game.getStructureEffectiveStats(obj, tx, ty);
      const rank = eff.rank || 0;
      const rInfo = eff.rankInfo || ZS.Game.getVeterancyRankInfo(rank);
      const xp = obj.xp || 0;
      const ranks = ZS.DATA.VETERANCY_RANKS || [];
      const nextR = ranks[rank + 1] || null;
      const curMin = rInfo.minXp || 0;
      const pct = nextR
        ? Math.max(0, Math.min(100, ((xp - curMin) / Math.max(1, nextR.minXp - curMin)) * 100))
        : 100;
      const remLabel = nextR ? `남은 ${(Math.max(0.1, nextR.minXp - xp)).toFixed(1)} XP` : 'MAX';
      const rankWidgetHtml = `
        <span class="detail-rank-box" title="처치 ${obj.kills || 0}기 · 누적 ${xp.toFixed(1)} XP">
          <span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${ozIcon('state-rank', 14)}</span>
          <span class="detail-rank-name" style="color:${rInfo.color};">${escapeHtml(rInfo.name)}</span>
          <span class="detail-xp-track"><span class="detail-xp-fill" style="width:${pct.toFixed(1)}%;background:${rInfo.color};"></span></span>
          <span class="detail-xp-rem">${remLabel}</span>
        </span>
      `;
      actionHtml = rankWidgetHtml + actionHtml;

      const pwrInfo = def.requiresPower
        ? `${ozIcon('res-power', 13, 'icon-power')}대기 -${eff.powerIdle}/s, 사격 -${eff.powerShot}`
        : `${ozIcon('res-agent', 13)}요원 ${def.popUse}명`;
      let nextPreview = '';
      if (lv < 3) {
        const nextEff = ZS.Game.getStructureEffectiveStats(obj, tx, ty, lv + 1);
        const perkHint = lv + 1 === 3 && nextEff.perkLabel ? ` · ★${escapeHtml(nextEff.perkLabel.split(' (')[0])}` : '';
        nextPreview = ` → [Lv.${lv + 1}: 화력 ${nextEff.damage.toFixed(1)} · 연사 ${nextEff.fireRate.toFixed(2)}/s${perkHint}]`;
      } else if (eff.perkLabel) {
        nextPreview = ` · ★${escapeHtml(eff.perkLabel)}`;
      }
      setDetailHtml(
        `${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)} Lv.${lv}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 화력 ${eff.damage.toFixed(1)} · 연사 ${eff.fireRate.toFixed(2)}/s · 사거리 ${eff.range.toFixed(1)} · 치명 ${Math.round(eff.critChance * 100)}% (${pwrInfo})${nextPreview}`,
        actionHtml
      );
    } else if (ZS.Game.isUpgradeableDef(def)) {
      const prof = ZS.Game.getStructLevelProfile(def, lv);
      let statSummary = '';
      if (def.subType === 'wall') {
        statSummary = prof.perkLabel ? `★${escapeHtml(prof.perkLabel)}` : '차단 방호벽';
      } else if (def.id === 'razor_pad') {
        statSummary = `지속피해 ${prof.trapDps}/s · 둔화 ${Math.round((1 - prof.slowFactor) * 100)}%${prof.perkLabel ? ` · ★${escapeHtml(prof.perkLabel)}` : ''}`;
      } else if (def.subType === 'power') {
        statSummary = `${ozIcon('res-power', 13, 'icon-power')}주간 충전 +${prof.dayCharge} · 저장 용량 +${prof.powerCap}`;
      } else if (def.subType === 'housing') {
        statSummary = `${ozIcon('res-agent', 13)}요원 수용 +${prof.popCap}명 · ${ozIcon('res-cozy', 13, 'icon-coin')}안락함 +${prof.cozy}`;
      }
      if (lv < 3) {
        const nextProf = ZS.Game.getStructLevelProfile(def, lv + 1);
        const fid2 = st.floorGrid[ty] && st.floorGrid[ty][tx];
        const fDef2 = fid2 ? ZS.DATA.ITEMS[fid2] : null;
        const hpMult = 1 + (fDef2 && fDef2.hpMultBonus ? fDef2.hpMultBonus : 0);
        const nextMaxHp = Math.round(nextProf.baseMaxHp * hpMult);
        const perkHint = lv + 1 === 3 && nextProf.perkLabel ? ` · ★${escapeHtml(nextProf.perkLabel.split(' (')[0])}` : '';
        statSummary += ` → [Lv.${lv + 1}: HP ${nextMaxHp}${perkHint}]`;
      }
      setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)} Lv.${lv}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} | ${statSummary}`, actionHtml);
    } else {
      setDetailHtml(`${ozIcon(catIcon, 14)} <b>[${escapeHtml(def.name)}]</b> HP ${Math.ceil(obj.hp)}/${obj.maxHp} — ${escapeHtml(def.desc)}`);
    }

    const upStructBtn = document.getElementById('btn-upgrade-struct');
    if (upStructBtn) {
      upStructBtn.addEventListener('click', () => {
        ZS.Game.upgradeStructure(tx, ty);
      });
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
      const target = st.structGrid[ty] && st.structGrid[ty][tx];
      const rank = target && target.id !== 'command_hq' ? (target.rank || 0) : 0;
      const removed = ZS.Game.removeAt(tx, ty);
      if (!removed && target && rank >= 1) {
        const def = ZS.DATA.ITEMS[target.id];
        const rInfo = ZS.Game.getVeterancyRankInfo(rank);
        setDetailHtml(
          `${ozIcon('state-alert', 14, 'icon-danger')} <b>[${escapeHtml(def ? def.name : target.id)}]</b> 철거 확인 — ${escapeHtml(rInfo.name)} 배지(${Math.floor(target.xp || 0)} XP) 계급이 사라집니다.`,
          `<span class="detail-rank-box"><span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${ozIcon('state-rank', 14)}</span><span class="detail-rank-name" style="color:${rInfo.color};">${escapeHtml(rInfo.name)}</span></span><button id="btn-confirm-demolish" class="detail-demolish-confirm-btn">${ozIcon('tool-remove', 14, 'icon-danger')}<span>계급 소멸 감수하고 철거</span></button>`
        );
        const confirmBtn = document.getElementById('btn-confirm-demolish');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            if (ZS.Game.removeAt(tx, ty, true)) {
              setDetailHtml(`${ozIcon('tool-remove', 14, 'icon-danger')} <b>[철거 완료]</b> 건설·강화 자원의 80%를 회수했습니다.`);
            }
          });
        }
      }
      return;
    }

    if (uiState.mode === 'move') {
      if (isDrag) return;
      if (!uiState.movingSource) {
        const src = st.structGrid[ty] && st.structGrid[ty][tx];
        if (src && src.id !== 'command_hq') {
          uiState.movingSource = { tx, ty };
          const def = ZS.DATA.ITEMS[src.id];
          setDetailHtml(`${ozIcon('tool-move', 14)} <b>[${escapeHtml(def ? def.name : src.id)}]</b> 선택됨 — 이동할 빈 타일을 클릭하세요.`);
        } else {
          ZS.Audio.playError();
        }
      } else {
        if (uiState.movingSource.tx === tx && uiState.movingSource.ty === ty) {
          uiState.movingSource = null;
          setDetailHtml(`${ozIcon('tool-move', 14)} 이동 취소됨 — 옮길 다른 시설을 클릭하세요.`);
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
      } else if (e.code === 'KeyU') {
        if (uiState.inspectedTile) {
          ZS.Game.upgradeStructure(uiState.inspectedTile.tx, uiState.inspectedTile.ty);
        }
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
        showWaveBanner(
          on ? '화면 흔들림 켜짐' : '화면 흔들림 꺼짐',
          on ? '폭격·보스 등장·본부 피격 시 미세한 진동 피드백이 재생됩니다.' : '카메라 화면 흔들림 연출이 비활성화되었습니다.',
          'info'
        );
      });
    }

    const hqBoxEl = document.getElementById('hud-hq-box');
    if (hqBoxEl) {
      hqBoxEl.addEventListener('click', () => {
        setToolMode('inspect');
        ZS.Iso.resetCamera();
        inspectTileAt(ZS.DATA.HQ_POS.x, ZS.DATA.HQ_POS.y);
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
    const P = ZS.DATA.PALETTE;
    const pwrVal = Math.round(st.power);
    const isNightBlackout = st.isNight && st.power <= 0.01;
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    const pwrBar = document.getElementById('res-power-bar');
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background = pwrPct > 35 ? P.power : pwrPct > 5 ? P.healthMid : P.danger;
    document.querySelector('.power-pill').classList.toggle('blackout', isNightBlackout);

    const pwrIconEl = document.getElementById('res-power-icon');
    if (pwrIconEl) {
      pwrIconEl.className = isNightBlackout ? 'res-icon icon-danger' : 'res-icon icon-power';
      pwrIconEl.innerHTML = ozIcon(isNightBlackout ? 'state-power-off' : 'res-power', isNightBlackout ? 16 : 18);
    }

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

  function init() {
    syncCssPalette();
    resizeCanvas();
    ZS.Iso.resetCamera();

    const env = ZS.Game.getEnvInfo ? ZS.Game.getEnvInfo() : { isDevBuild: false, isDevEnvironment: false, isDebugMode: false };
    const ver = ZS.DATA.VERSION || 'v0.2.0';
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
      ? `[DEV] OUTPOST ZERO (${ver}) — 스테이징 검수 빌드`
      : `OUTPOST ZERO (${ver}) — 모던 전술 디펜스 & 쉘터 빌더`;

    initDebugToolbar(env);

    ZS.Game.setCallbacks({
      onUiChange: updateHud,
      onWaveBanner: showWaveBanner
    });

    if (!ZS.Game.loadGame()) {
      ZS.Game.initNewGame();
      showWaveBanner(
        'OUTPOST ZERO 지휘권 인수 완료',
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
