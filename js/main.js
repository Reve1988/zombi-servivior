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
    const preview = ZS.Game.getPlacementCozyPreview ? ZS.Game.getPlacementCozyPreview(def.id) : null;
    if (def.layer === 'floor') {
      if (preview && preview.isFloorCapped) {
        return { text: `바닥재 · 상한 도달`, cls: 'tag-cozy-dim' };
      }
      return { text: `바닥재 · 💛+${def.cozy || 0}`, cls: 'tag-cozy' };
    }
    if (def.subType === 'manned') return { text: `👥요원 ${def.popUse} · 무전력`, cls: 'tag-manned' };
    if (def.subType === 'turret') return { text: `⚡야간전력 소모`, cls: 'tag-power' };
    if (def.subType === 'power') return { text: `☀️+${def.dayCharge}⚡ / 용량+${def.powerCap}`, cls: 'tag-power' };
    if (def.subType === 'housing') {
      if (preview && preview.isDiminished) {
        return { text: `👥수용+${def.popCap} · +${preview.gain} (50%)`, cls: 'tag-cozy-dim' };
      }
      return { text: `👥수용+${def.popCap} · 💛+${def.cozy}`, cls: 'tag-manned' };
    }
    if (def.category === 'decor') {
      const pwr = def.requiresPower ? '⚡전등 · ' : '';
      if (preview && preview.isDiminished) {
        return { text: `${pwr}+${preview.gain} (50%)`, cls: 'tag-cozy-dim' };
      }
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
        badgeHtml = `<span class="card-lock-badge">🔒 보스</span>`;
      } else if (voucherBypass) {
        badgeHtml = `<span class="card-voucher-badge">보급권 ${voucherCount}</span>`;
      } else if (hqLockedRaw) {
        badgeHtml = `<span class="card-lock-badge">🔒 본부 Lv.${reqHq}</span>`;
      } else if (floorCapped) {
        badgeHtml = `<span class="card-cap-badge">상한 도달</span>`;
      }

      let costHtml = '';
      if (bossLocked) {
        costHtml = `<span class="cost-chip short">🔒 보스 처치 해금</span>`;
      } else if (voucherCount > 0) {
        costHtml = `<span class="cost-chip free">🎁 보급권 ${voucherCount}</span>`;
      } else if (hqLockedRaw) {
        costHtml = `<span class="cost-chip short">🔒 본부 Lv.${reqHq} 필요</span>`;
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
        ${badgeHtml}
        <div class="card-top">
          <span class="card-icon">${def.icon}</span>
          <span class="card-title">${def.name}</span>
        </div>
        <span class="card-tag ${tag.cls}">${tag.text}</span>
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
        setDetailText(`${def.icon} [${def.name}] — ${def.desc}${cozyHint}`);
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

  function setDetailText(msg, actionsHtml) {
    document.getElementById('detail-text').textContent = msg;
    const actEl = document.getElementById('detail-actions');
    if (actEl) {
      actEl.innerHTML = actionsHtml || '';
    }
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

    const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
    const hqTitleEl = document.getElementById('hud-hq-title');
    if (hqTitleEl) {
      hqTitleEl.textContent = `🏛️ 본부 Lv.${st.hqLevel}`;
    }
    const hqHp = hq ? Math.ceil(hq.hp) : 0;
    const hqMax = hq ? hq.maxHp : hqInfo.maxHp;
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
    const P = ZS.DATA.PALETTE;
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background =
      pwrPct > 35
        ? P.power
        : pwrPct > 5
        ? P.healthMid
        : P.danger;

    document.querySelector('.power-pill').classList.toggle('blackout', st.isNight && st.power <= 0.01);
    document.getElementById('res-power-sub').textContent = `낮 충전 +${st.dayCharge}⚡ · 대기 -${st.nightIdleDrain.toFixed(1)}/s`;

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
          <td>${t.title}</td>
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
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <span style="font-weight:800;color:${P.gold};">💛 ${tier.title} (Lv.${tier.level})</span>
        <span style="font-size:11px;color:#e2e8f0;">총 <b>${st.cozyScore}점</b></span>
      </div>
      <div style="font-size:10.5px;color:#94a3b8;margin-bottom:4px;">
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
          ? `<div style="margin-top:6px;color:#94a3b8;font-size:11px;">다음 등급(Lv.${nextTier.level})까지 <b>${nextTier.min - st.cozyScore}점</b> 필요</div>`
          : `<div style="margin-top:6px;color:${P.gold};font-size:11px;">★ 최고 안락함 등급(Lv.8) 달성!</div>`
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
      const hqInfo = ZS.Game.getHqLevelInfo(st.hqLevel);
      const wpnText = hqInfo.weapon
        ? `무장: ${hqInfo.weapon.name}(피해 ${hqInfo.weapon.damage}, 사거리 ${hqInfo.weapon.range})`
        : '무장: 없음(Lv.2 개방)';
      const upCheck = ZS.Game.canUpgradeHq();
      let actionHtml = '';
      if (st.hqLevel < 4) {
        const nextInfo = ZS.Game.getHqLevelInfo(st.hqLevel + 1);
        const c = nextInfo.cost || {};
        const costLabel = `🪵${c.wood || 0} 🔩${c.scrap || 0} 🪙${c.coin || 0}`;
        const disabledAttr = upCheck.ok ? '' : 'disabled';
        actionHtml = `<button id="btn-upgrade-hq" class="detail-upgrade-btn" ${disabledAttr} title="${upCheck.ok ? `${nextInfo.name} 증축` : upCheck.reason}">⬆️ 본부 Lv.${nextInfo.level} 증축 (${costLabel})</button>`;
      } else {
        actionHtml = `<span class="cost-chip free">★ 최고 등급(Lv.4)</span>`;
      }

      setDetailText(
        `🏛️ [${hqInfo.name} · Lv.${st.hqLevel}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 충전 +${hqInfo.baseDayCharge}⚡ · 용량 ${hqInfo.basePowerCap}⚡ · 숙소 ${hqInfo.basePopCap}👥 · ${wpnText}`,
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
        actionHtml = `<span class="cost-chip free" title="${perk || ''}">◆◆◆ Lv.3 MAX</span>`;
      } else {
        const cost = ZS.Game.getUpgradeCost(def, lv) || {};
        const costLabel = `🪵${cost.wood || 0} 🔩${cost.scrap || 0} 🪙${cost.coin || 0}`;
        let btnText = `⬆️ Lv.${lv + 1} 강화 (${costLabel}) [U]`;
        if (upCheck.hqCapped) {
          btnText = `🔒 본부 Lv.${upCheck.reqHqLevel} 필요 (${costLabel})`;
        }
        actionHtml = `<button id="btn-upgrade-struct" class="detail-upgrade-btn" ${upCheck.ok ? '' : 'disabled'} title="${upCheck.ok ? '단축키 U로 즉시 강화' : upCheck.reason}">${btnText}</button>`;
      }
    }

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
      const rankSymbol = rank >= 3 ? '★' : rank === 2 ? '︾' : rank === 1 ? '▾' : '•';
      const remLabel = nextR ? `남은 ${(Math.max(0.1, nextR.minXp - xp)).toFixed(1)} XP` : 'MAX';
      const rankWidgetHtml = `
        <span class="detail-rank-box" title="처치 ${obj.kills || 0}기 · 누적 ${xp.toFixed(1)} XP">
          <span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${rankSymbol}</span>
          <span class="detail-rank-name" style="color:${rInfo.color};">${rInfo.name}</span>
          <span class="detail-xp-track"><span class="detail-xp-fill" style="width:${pct.toFixed(1)}%;background:${rInfo.color};"></span></span>
          <span class="detail-xp-rem">${remLabel}</span>
        </span>
      `;
      actionHtml = rankWidgetHtml + actionHtml;

      const pwrInfo = def.requiresPower
        ? `⚡대기 -${eff.powerIdle}/s, 사격 -${eff.powerShot}`
        : `👥요원 ${def.popUse}명`;
      let nextPreview = '';
      if (lv < 3) {
        const nextEff = ZS.Game.getStructureEffectiveStats(obj, tx, ty, lv + 1);
        const perkHint = lv + 1 === 3 && nextEff.perkLabel ? ` · ★${nextEff.perkLabel.split(' (')[0]}` : '';
        nextPreview = ` → [Lv.${lv + 1}: 화력 ${nextEff.damage.toFixed(1)} · 연사 ${nextEff.fireRate.toFixed(2)}/s${perkHint}]`;
      } else if (eff.perkLabel) {
        nextPreview = ` · ★${eff.perkLabel}`;
      }
      setDetailText(
        `${def.icon} [${def.name} Lv.${lv}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} | 화력 ${eff.damage.toFixed(1)} · 연사 ${eff.fireRate.toFixed(2)}/s · 사거리 ${eff.range.toFixed(1)} · 치명 ${Math.round(eff.critChance * 100)}% (${pwrInfo})${nextPreview}`,
        actionHtml
      );
    } else if (ZS.Game.isUpgradeableDef(def)) {
      const prof = ZS.Game.getStructLevelProfile(def, lv);
      let statSummary = '';
      if (def.subType === 'wall') {
        statSummary = prof.perkLabel ? `★${prof.perkLabel}` : `차단 방호벽`;
      } else if (def.id === 'razor_pad') {
        statSummary = `지속피해 ${prof.trapDps}/s · 둔화 ${Math.round((1 - prof.slowFactor) * 100)}%${prof.perkLabel ? ` · ★${prof.perkLabel}` : ''}`;
      } else if (def.subType === 'power') {
        statSummary = `주간 충전 +${prof.dayCharge}⚡ · 저장 용량 +${prof.powerCap}⚡`;
      } else if (def.subType === 'housing') {
        statSummary = `요원 수용 +${prof.popCap}👥 · 안락함 +${prof.cozy}💛`;
      }
      if (lv < 3) {
        const nextProf = ZS.Game.getStructLevelProfile(def, lv + 1);
        const fid = st.floorGrid[ty] && st.floorGrid[ty][tx];
        const fDef = fid ? ZS.DATA.ITEMS[fid] : null;
        const hpMult = 1 + (fDef && fDef.hpMultBonus ? fDef.hpMultBonus : 0);
        const nextMaxHp = Math.round(nextProf.baseMaxHp * hpMult);
        const perkHint = lv + 1 === 3 && nextProf.perkLabel ? ` · ★${nextProf.perkLabel.split(' (')[0]}` : '';
        statSummary += ` → [Lv.${lv + 1}: HP ${nextMaxHp}${perkHint}]`;
      }
      setDetailText(`${def.icon} [${def.name} Lv.${lv}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} | ${statSummary}`, actionHtml);
    } else {
      setDetailText(`${def.icon} [${def.name}] HP ${Math.ceil(obj.hp)}/${obj.maxHp} — ${def.desc}`);
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
        const rankSymbol = rank >= 3 ? '★' : rank === 2 ? '︾' : '▾';
        setDetailText(
          `⚠️ [${def ? def.name : target.id}] 철거 확인 — ${rInfo.name} 배지(${Math.floor(target.xp || 0)} XP) 계급이 사라집니다.`,
          `<span class="detail-rank-box"><span class="detail-rank-icon state-rank" style="color:${rInfo.color};">${rankSymbol}</span><span class="detail-rank-name" style="color:${rInfo.color};">${rInfo.name}</span></span><button id="btn-confirm-demolish" class="detail-demolish-confirm-btn">🗑️ 계급 소멸 감수하고 철거</button>`
        );
        const confirmBtn = document.getElementById('btn-confirm-demolish');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            if (ZS.Game.removeAt(tx, ty, true)) {
              setDetailText('🗑️ [철거 완료] 건설·강화 자원의 80%를 회수했습니다.');
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
      document.getElementById('btn-sound').textContent = muted ? '🔇' : '🔊';
    });

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
    document.getElementById('res-power').textContent = `${pwrVal} / ${st.powerCap}`;
    const pwrPct = st.powerCap > 0 ? Math.min(100, (st.power / st.powerCap) * 100) : 0;
    const pwrBar = document.getElementById('res-power-bar');
    pwrBar.style.width = `${Math.max(0, pwrPct)}%`;
    pwrBar.style.background = pwrPct > 35 ? P.power : pwrPct > 5 ? P.healthMid : P.danger;
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
        <span class="debug-title">🛠️ DEBUG · ${env.saveKey === 'outpost_zero_save_dev' ? 'DEV SAVE' : 'LOCAL'}</span>
        <button id="btn-debug-collapse" class="debug-toggle-btn" title="디버그 바 접기/펼치기">접기 ▴</button>
      </div>
      <div class="debug-body">
        <button id="btn-dbg-res" class="debug-btn" title="목재·고철·코인 즉시 +500">+500 자원</button>
        <button id="btn-dbg-pwr" class="debug-btn" title="배터리 전력 완충 / 방전(0) 토글">⚡ 전력 완충/방전</button>
        <button id="btn-dbg-pop" class="debug-btn" title="가용 요원 및 임시 숙소 수용량 +2">👥 요원 +2</button>
        <button id="btn-dbg-wave1" class="debug-btn" title="주간 정비 상태에서 웨이브 +1">⏭️ 웨이브 +1</button>
        <button id="btn-dbg-wave5" class="debug-btn" title="주간 정비 상태에서 웨이브 +5 (보스전 등)">⏭️ +5</button>
        <button id="btn-dbg-xp" class="debug-btn" title="조회 중인 초소·포탑에 숙련도 +20 XP 즉시 부여">🎖️ 선택 시설 XP +20</button>
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
