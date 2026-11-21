window.ZS = window.ZS || {};

(function () {
  const U = ZS._UI;
  const { ozIcon, escapeHtml } = U;

  let activeFocusArea = 'all'; // 'all' | 'pop' | 'tech'

  function isTechPopModalOpen() {
    const modal = document.getElementById('tech-pop-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function openTechPopModal(focusArea) {
    const modal = document.getElementById('tech-pop-modal');
    if (!modal) return;
    activeFocusArea = focusArea === 'pop' || focusArea === 'tech' ? focusArea : 'all';
    renderTechPopModal();
    modal.classList.remove('hidden');
  }

  function closeTechPopModal() {
    const modal = document.getElementById('tech-pop-modal');
    if (modal) modal.classList.add('hidden');
    activeFocusArea = 'all';
  }

  function toggleTechPopModal(focusArea) {
    if (isTechPopModalOpen()) {
      closeTechPopModal();
      return false;
    }
    openTechPopModal(focusArea);
    return true;
  }

  function canAdjustRoleUp(st, role) {
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const used = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    if (st.agents > used) return true;
    if (role !== 'combat' && (jobs.combat || 0) > (st.popUsed || 0)) return true;
    if (role !== 'research' && (jobs.research || 0) > 0) return true;
    if (role !== 'prod' && (jobs.prod || 0) > 0) return true;
    return false;
  }

  function renderJobBar(st) {
    const wrap = document.getElementById('tech-job-bar');
    if (!wrap) return;

    const jobs = st.jobs || { combat: st.agents || 0, research: 0, prod: 0 };
    const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(st.hqLevel) : { baseRpPerScientist: 2 };
    const popUsed = st.popUsed || 0;
    const assigned = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    const unassigned = Math.max(0, (st.agents || 0) - assigned);

    const spareCombat = Math.max(0, (jobs.combat || 0) - popUsed);
    const hqRatePct = Math.min(25, spareCombat * 5);
    const scavWood = (st.hqLevel || 1) === 1 ? spareCombat * 2 : 0;
    const scavScrap = (st.hqLevel || 1) === 1 ? spareCombat * 1 : 0;

    const drill1Lv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_1') : 0;
    const drill2Lv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_2') : 0;
    const rawScientistRp = (jobs.research || 0) * (hqInfo.baseRpPerScientist || 2) + (st.b1LabFlatRp || 0) + (st.b1LabFlatPerWaveRp || 0);
    const rpMult = 1 + (st.b1LabMult || 0) + (drill2Lv > 0 ? 0.15 : 0);
    const rpGainPreview = Math.round(rawScientistRp * rpMult);

    const prodCount = jobs.prod || 0;
    const prodWoodPreview = Math.round(prodCount * 5 + (st.b1SupplyWood || 0) + (st.b1SupplyProdWood || 0));
    const prodScrapPreview = Math.round(prodCount * 4 + (st.b1SupplyScrap || 0) + (st.b1SupplyProdScrap || 0));
    const prodCoinPreview = Math.round(st.b1SupplyCoin || 0);
    const digPerProd = drill1Lv > 0 ? 4 : 3;
    const digGainPreview = Math.round((2 + prodCount * digPerProd) * (1 + (st.b1DigApBonusMult || st.b1DigMult || 0)));
    const digCapPreview = Math.max(16, (2 + prodCount * digPerProd) * 2 + (drill1Lv > 0 ? 8 : 0));

    const combatAtFloor = (jobs.combat || 0) <= popUsed;
    const isGameOver = st.phase === 'gameover';

    const b1Open = (st.hqLevel || 1) >= 2 && !!st.undergroundUnlocked;
    const roleCards = [
      {
        role: 'combat',
        title: '전투요원',
        badgeCls: 'role-combat',
        iconId: 'cat-defense',
        iconCls: 'icon-coin',
        count: jobs.combat || 0,
        canMinus: !isGameOver && !combatAtFloor && (jobs.combat || 0) > 0,
        canPlus: !isGameOver && canAdjustRoleUp(st, 'combat'),
        floorCue: popUsed > 0
          ? `<span class="job-floor-cue${combatAtFloor ? ' locked' : ''}">${combatAtFloor ? ozIcon('state-lock', 12, 'icon-danger') : ozIcon('cat-defense', 12, 'icon-muted')}<span>초소 배치 ${popUsed}명 고정</span></span>`
          : `<span class="job-floor-cue"><span>초소 미배치 (자유 전환)</span></span>`,
        previewHtml: `여유 <b>${spareCombat}명</b> · 본부 화기 연사 <b>+${hqRatePct}%</b>${(st.hqLevel || 1) === 1 ? ` · 새벽 채집 <b>+${scavWood}목재/+${scavScrap}고철</b>` : ''}`
      },
      {
        role: 'research',
        title: '연구요원',
        badgeCls: 'role-research',
        iconId: 'res-rp',
        iconCls: 'icon-rp',
        count: jobs.research || 0,
        canMinus: !isGameOver && (jobs.research || 0) > 0,
        canPlus: !isGameOver && canAdjustRoleUp(st, 'research'),
        floorCue: `<span class="job-floor-cue"><span>과학자 기본 +${hqInfo.baseRpPerScientist || 2} RP/일${(st.b1LabFlatRp || 0) > 0 ? ` · 데스크 +${Math.round(st.b1LabFlatRp)}` : ''}${(st.b1LabFlatPerWaveRp || 0) > 0 ? ` · 고정 +${st.b1LabFlatPerWaveRp}` : ''}${drill2Lv > 0 || (st.b1LabMult || 0) > 0 ? ` · 증폭 +${Math.round(((st.b1LabMult || 0) + (drill2Lv > 0 ? 0.15 : 0)) * 100)}%` : ''}</span></span>`,
        previewHtml: `새벽 정산 <b class="txt-rp">+${rpGainPreview} RP/일</b> · 보스 처치 시 <b>+${Math.round(6 * (1 + (st.b1BossRpMult || 0)))} RP</b> 추가`
      },
      {
        role: 'prod',
        title: '생산요원',
        badgeCls: 'role-prod',
        iconId: 'act-repair',
        iconCls: 'icon-ap',
        count: jobs.prod || 0,
        canMinus: !isGameOver && (jobs.prod || 0) > 0,
        canPlus: !isGameOver && canAdjustRoleUp(st, 'prod'),
        floorCue: b1Open
          ? `<span class="job-floor-cue ap-cue"><span>보유 굴착력 ${st.digAp || 0}/${st.digApCap || digCapPreview} AP</span></span>`
          : `<span class="job-floor-cue"><span>본부 Lv.2 증축 시 지하 굴착력(AP) 개방</span></span>`,
        previewHtml: `새벽 생산 <b class="txt-wood">+${prodWoodPreview} 목재</b> · <b class="txt-scrap">+${prodScrapPreview} 고철</b>${prodCoinPreview > 0 ? ` · <b class="txt-coin">+${prodCoinPreview} 코인</b>` : ''}${b1Open ? ` · <b class="txt-ap">+${digGainPreview} AP</b> (상한 ${digCapPreview})` : ''}`
      }
    ];

    const cardsHtml = roleCards
      .map((rc) => `
        <div class="job-role-card ${rc.badgeCls}" data-role="${rc.role}">
          <div class="job-role-top">
            <span class="job-role-name inline-icon-text">${ozIcon(rc.iconId, 16, rc.iconCls)}<span>${escapeHtml(rc.title)}</span></span>
            <div class="job-stepper">
              <button type="button" class="job-step-btn" data-job-role="${rc.role}" data-job-delta="-1" ${rc.canMinus ? '' : 'disabled'} aria-label="${escapeHtml(rc.title)} 1명 감원">-</button>
              <strong class="job-count-val">${rc.count}</strong>
              <button type="button" class="job-step-btn" data-job-role="${rc.role}" data-job-delta="1" ${rc.canPlus ? '' : 'disabled'} aria-label="${escapeHtml(rc.title)} 1명 증원">+</button>
            </div>
          </div>
          <div class="job-role-floor">${rc.floorCue}</div>
          <div class="job-role-preview">${rc.previewHtml}</div>
        </div>
      `)
      .join('');

    wrap.classList.toggle('focus-highlight', activeFocusArea === 'pop');
    wrap.innerHTML = `
      <div class="tech-section-bar">
        <div class="inline-icon-text">
          ${ozIcon('res-agent', 16)}
          <span class="tech-section-title">인구 직무 분배</span>
          <span class="job-summary-pill">총 인원 ${st.agents} / 수용 ${st.popCap}명</span>
          ${unassigned > 0 ? `<span class="job-unassigned-pill">미배정 ${unassigned}명</span>` : ''}
        </div>
        <div class="job-spare-banner">여유 전투요원 ${spareCombat}명 → 본부 연사 +${hqRatePct}% (최대 +25%)</div>
      </div>
      <div class="job-roles-grid">${cardsHtml}</div>
    `;

    wrap.querySelectorAll('.job-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-job-role');
        const delta = Number(btn.getAttribute('data-job-delta'));
        if (ZS.Game.adjustJob) ZS.Game.adjustJob(role, delta);
      });
    });
  }

  function renderTechGrid(st) {
    const grid = document.getElementById('tech-branches-grid');
    if (!grid) return;

    const branches = ZS.DATA.TECH_BRANCHES || [];
    const tree = ZS.DATA.TECH_TREE || {};
    const order = ZS.DATA.TECH_ORDER || Object.keys(tree);

    const byBranch = {};
    for (let i = 0; i < branches.length; i++) {
      byBranch[branches[i].id] = [];
    }
    for (let i = 0; i < order.length; i++) {
      const node = tree[order[i]];
      if (node && byBranch[node.branch]) {
        byBranch[node.branch].push(node);
      }
    }

    const branchesHtml = branches
      .map((br) => {
        const nodes = byBranch[br.id] || [];
        let doneCount = 0;
        const nodesHtml = nodes
          .map((t) => {
            const curLv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel(t.id) : 0;
            const maxLv = t.maxLv || 1;
            const isMax = curLv >= maxLv;
            if (curLv > 0 && (maxLv === 1 || isMax)) doneCount += 1;
            const check = ZS.Game.canResearchTech ? ZS.Game.canResearchTech(t.id) : { ok: false };
            const costRp = ZS.Game.getTechCost ? ZS.Game.getTechCost(t.id) : t.costRp;

            let stateCls = 'tech-locked';
            let badgeHtml = `<span class="tech-state-pill locked">${ozIcon('state-lock', 12, 'icon-muted')}<span>잠금</span></span>`;
            if (isMax) {
              stateCls = 'tech-done';
              badgeHtml = `<span class="tech-state-pill done">${ozIcon('state-rank', 12, 'icon-heal')}<span>${maxLv > 1 ? `Lv.${curLv}/${maxLv} 완료` : '완료'}</span></span>`;
            } else if (check.ok) {
              stateCls = 'tech-ready';
              badgeHtml = `<span class="tech-state-pill ready"><span>연구 가능</span></span>`;
            } else if (check.lockedByHq) {
              badgeHtml = `<span class="tech-state-pill locked">${ozIcon('state-lock', 12, 'icon-muted')}<span>본부 Lv.${check.reqHqLevel}</span></span>`;
            } else if (!check.missingReq) {
              stateCls = 'tech-short';
              badgeHtml = `<span class="tech-state-pill short"><span>RP 부족</span></span>`;
            }

            const costHtml = !isMax && costRp != null
              ? `<span class="tech-cost-pill${check.shortRp ? ' short' : ''}">${ozIcon('res-rp', 13, 'icon-rp')}<span>${costRp} RP</span></span>`
              : `<span class="tech-cost-pill done"><span>MAX</span></span>`;

            const lvTag = maxLv > 1 && !isMax ? `<span class="tech-lv-chip">Lv.${curLv}/${maxLv}</span>` : '';

            let reqHtml = '';
            if (check.lockedByHq) {
              const reqWave = check.reqWave || (ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(check.reqHqLevel) : (check.reqHqLevel > 1 ? (check.reqHqLevel - 1) * 20 : 1));
              reqHtml = `<div class="tech-req-line hq-lock">본부 Lv.${check.reqHqLevel} (W${reqWave}) 필요</div>`;
            } else if (Array.isArray(t.req) && t.req.length > 0 && check.missingReq) {
              const reqNames = t.req.map((rid) => (tree[rid] ? tree[rid].name : rid));
              reqHtml = `<div class="tech-req-line">선행: ${escapeHtml(reqNames.join(' + '))}</div>`;
            }

            const disabledAttr = check.ok ? '' : 'disabled';
            return `
              <button
                type="button"
                class="tech-node-card ${stateCls}"
                data-tech-id="${escapeHtml(t.id)}"
                ${disabledAttr}
                title="${escapeHtml(check.ok ? `${t.name} 연구 진행 (${costRp} RP)` : (check.reason || t.desc))}"
              >
                <div class="tech-node-top">
                  <span class="tech-node-title">${escapeHtml(t.name)} ${lvTag}</span>
                  ${costHtml}
                </div>
                <div class="tech-node-desc">${escapeHtml(t.desc)}</div>
                <div class="tech-node-foot">
                  ${badgeHtml}
                  ${reqHtml}
                </div>
              </button>
            `;
          })
          .join('');

        return `
          <section class="tech-branch-col" data-branch="${escapeHtml(br.id)}" style="--branch-accent:${escapeHtml(br.accent || '#C084FC')};">
            <header class="tech-branch-head">
              <div class="tech-branch-title-row">
                <span class="tech-branch-dot" aria-hidden="true"></span>
                <h3>${escapeHtml(br.name)}</h3>
                <span class="tech-branch-prog">${doneCount}/${nodes.length}</span>
              </div>
              <p class="tech-branch-desc">${escapeHtml(br.desc)}</p>
            </header>
            <div class="tech-nodes-list">${nodesHtml}</div>
          </section>
        `;
      })
      .join('');

    grid.classList.toggle('focus-highlight', activeFocusArea === 'tech');
    grid.innerHTML = branchesHtml;

    grid.querySelectorAll('.tech-node-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-tech-id');
        if (tid && ZS.Game.researchTech) {
          ZS.Game.researchTech(tid);
        }
      });
    });
  }

  function renderTechPopModal() {
    const st = ZS.Game.state;
    if (!st) return;

    const rpBadge = document.getElementById('tech-modal-rp-badge');
    if (rpBadge) {
      rpBadge.innerHTML = `${ozIcon('res-rp', 16, 'icon-rp')}<span>본부 Lv.${st.hqLevel || 1} 인가 · 보유 ${Math.floor(st.rp || 0)} RP</span>`;
    }

    renderJobBar(st);
    renderTechGrid(st);
  }

  Object.assign(U, {
    isTechPopModalOpen,
    openTechPopModal,
    closeTechPopModal,
    toggleTechPopModal,
    renderTechPopModal
  });
})();
