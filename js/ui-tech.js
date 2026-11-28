window.ZS = window.ZS || {};

(function () {
  const U = ZS._UI;
  const { ozIcon, escapeHtml } = U;

  let selectedTechId = null;

  // Virtual SVG graph coordinates (viewBox 0 0 1000 444; left track rail 0..116, 5 tier lanes 116..1000)
  const TECH_GRAPH_META = {
    def_t1: {
      icon: 'tech-shield',
      shortLabel: '방어선 Lv.2',
      x: 204,
      y: 44,
      chips: [
        { icon: 'stat-unlock', tone: 'heal', text: '헤스코 성벽 Lv.2 해금' },
        { icon: 'gate', tone: 'heal', text: '방호 게이트 · 트랩 Lv.2' },
        { icon: 'wall-upgrade', tone: 'gold', text: '성벽 상부 거치 개방' }
      ]
    },
    def_t2: {
      icon: 'tech-spike',
      shortLabel: '방어선 Lv.3',
      x: 381,
      y: 44,
      chips: [
        { icon: 'stat-unlock', tone: 'heal', text: '합금 장갑 성벽 Lv.3' },
        { icon: 'emp-stun', tone: 'heal', text: '쇼크 게이트 · 피에조 트랩' },
        { icon: 'stat-dmg', tone: 'gold', text: '근접 반사·둔화 강화' }
      ]
    },
    def_repeat: {
      icon: 'tech-repeat',
      shortLabel: '복합 장갑',
      x: 911,
      y: 44,
      chips: [
        { icon: 'tech-shield', tone: 'heal', text: '레벨당 방어선 HP +15%' },
        { icon: 'tech-spike', tone: 'heal', text: '레벨당 반사·트랩 피해 +12%' },
        { icon: 'stat-unlock', tone: 'muted', text: '최대 5단계 반복 연구' }
      ]
    },

    inf_sniper: {
      icon: 'tech-sniper',
      shortLabel: '저격탑 해금',
      x: 158,
      y: 114,
      chips: [
        { icon: 'stat-unlock', tone: 'gold', text: '대물 저격 감시탑 해금' },
        { icon: 'stat-range', tone: 'gold', text: '무전력 장거리 초소' },
        { icon: 'res-agent', tone: 'muted', text: '전투요원 1명 배치' }
      ]
    },
    inf_lv2: {
      icon: 'tech-rifle',
      shortLabel: '보병 화기 Lv.2',
      x: 250,
      y: 114,
      chips: [
        { icon: 'stat-unlock', tone: 'gold', text: '요원 초소 Lv.2 강화 해금' },
        { icon: 'stat-dmg', tone: 'gold', text: '소총·샷건·저격탑 개량' },
        { icon: 'res-power', tone: 'muted', text: '정전 면역 무전력 화기' }
      ]
    },
    inf_lv3: {
      icon: 'tech-specops',
      shortLabel: '특수 화기 Lv.3',
      x: 381,
      y: 114,
      chips: [
        { icon: 'stat-unlock', tone: 'gold', text: '요원 초소 Lv.3 특수 개조' },
        { icon: 'stat-dmg', tone: 'gold', text: '2점사 · 중산탄 · 관통탄' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.2 (W10) 인가' }
      ]
    },
    inf_repeat: {
      icon: 'tech-repeat',
      shortLabel: '정밀 탄약',
      x: 911,
      y: 114,
      chips: [
        { icon: 'stat-dmg', tone: 'gold', text: '레벨당 초소 공격력 +12%' },
        { icon: 'tech-sniper', tone: 'gold', text: '레벨당 치명타율 +3%p' },
        { icon: 'stat-unlock', tone: 'muted', text: '최대 5단계 반복 연구' }
      ]
    },

    tur_vulcan: {
      icon: 'tech-vulcan',
      shortLabel: '발칸 해금',
      x: 204,
      y: 221,
      chips: [
        { icon: 'stat-unlock', tone: 'orange', text: 'CIWS 발칸 오토터렛 해금' },
        { icon: 'stat-dmg', tone: 'orange', text: '무인 고속 자동 사격' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.1 (W1) 즉시 연구' }
      ]
    },
    tur_lv2: {
      icon: 'tech-turret2',
      shortLabel: '포탑 Lv.2',
      x: 381,
      y: 186,
      chips: [
        { icon: 'stat-unlock', tone: 'orange', text: '자동 포탑 Lv.2 강화 해금' },
        { icon: 'stat-dmg', tone: 'orange', text: '발칸 · 로켓 · EMP 화력 강화' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.2 (W10) 인가' }
      ]
    },
    tur_missile: {
      icon: 'tech-missile',
      shortLabel: '로켓 포대',
      x: 558,
      y: 256,
      chips: [
        { icon: 'stat-unlock', tone: 'orange', text: '다연장 로켓 포대 해금' },
        { icon: 'stat-range', tone: 'orange', text: '산맥 너머 광역 곡사 포격' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.3 (W20) 인가' }
      ]
    },
    tur_lv3: {
      icon: 'tech-turret3',
      shortLabel: '포탑 특전 Lv.3',
      x: 558,
      y: 186,
      chips: [
        { icon: 'stat-unlock', tone: 'orange', text: '자동 포탑 Lv.3 특수 개조' },
        { icon: 'stat-dmg', tone: 'orange', text: '초전도 급탄 · 6연장 · 5연쇄' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.3 (W20) 인가' }
      ]
    },
    tur_emp: {
      icon: 'tech-emp',
      shortLabel: '테슬라 EMP',
      x: 735,
      y: 256,
      chips: [
        { icon: 'stat-unlock', tone: 'orange', text: '테슬라 EMP 파일런 해금' },
        { icon: 'emp-stun', tone: 'orange', text: '다중 연쇄 전격 + 둔화' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.4 (W35) 인가' }
      ]
    },
    tur_repeat: {
      icon: 'tech-repeat',
      shortLabel: '화력 관제',
      x: 911,
      y: 186,
      chips: [
        { icon: 'stat-dmg', tone: 'orange', text: '레벨당 자동 포탑 공격력 +12%' },
        { icon: 'res-power', tone: 'orange', text: '레벨당 사격 전력 소모 -6%' },
        { icon: 'stat-unlock', tone: 'muted', text: '최대 5단계 반복 연구' }
      ]
    },

    inf_tier2: {
      icon: 'tech-solar',
      shortLabel: '인프라 Lv.2',
      x: 204,
      y: 330,
      chips: [
        { icon: 'stat-unlock', tone: 'rp', text: '발전 · 배터리 · 막사 Lv.2' },
        { icon: 'act-repair', tone: 'rp', text: '정비 베이 Lv.2 강화 해금' },
        { icon: 'res-agent', tone: 'muted', text: '야전 막사 인구 수용 +6' }
      ]
    },
    inf_tier3: {
      icon: 'tech-battery',
      shortLabel: '인프라 Lv.3',
      x: 381,
      y: 330,
      chips: [
        { icon: 'stat-unlock', tone: 'rp', text: '발전 · ESS · 숙소 · 보급 · 연구' },
        { icon: 'res-power', tone: 'rp', text: '리튬 ESS 배터리 뱅크 해금' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.2 (W10) 인가' }
      ]
    },
    inf_tier4: {
      icon: 'tech-reactor',
      shortLabel: '인프라 Lv.4',
      x: 558,
      y: 330,
      chips: [
        { icon: 'stat-unlock', tone: 'rp', text: '발전 · 코어 · 생활관 · 보급소' },
        { icon: 'res-power', tone: 'rp', text: '초전도 에너지 코어 해금' },
        { icon: 'res-agent', tone: 'muted', text: '작전 생활관 수용 +24' }
      ]
    },
    infra_repeat: {
      icon: 'tech-repeat',
      shortLabel: 'ESS 전력망',
      x: 911,
      y: 330,
      chips: [
        { icon: 'res-power', tone: 'rp', text: '레벨당 충전량 · 용량 +10%' },
        { icon: 'hud-hq', tone: 'rp', text: '본부 · 태양광 · 풍력 · 배터리' },
        { icon: 'stat-unlock', tone: 'muted', text: '최대 5단계 반복 연구' }
      ]
    },

    b1_drill_1: {
      icon: 'tech-drill1',
      shortLabel: '심부 굴착',
      x: 381,
      y: 402,
      chips: [
        { icon: 'b1-dig', tone: 'amber', text: '생산요원 굴착력 1.2→1.6 AP' },
        { icon: 'b1-ops', tone: 'amber', text: 'AP 이월 상한 +8 증가' },
        { icon: 'res-scrap', tone: 'gold', text: '매몰 전리품 획득 +25%' }
      ]
    },
    b1_gadgets_adv: {
      icon: 'tech-b1gear',
      shortLabel: '고급 쉘터',
      x: 558,
      y: 402,
      chips: [
        { icon: 'stat-unlock', tone: 'amber', text: '로켓 조립·양액 탱크 인가' },
        { icon: 'b1-armory', tone: 'orange', text: '장갑 용접·드론 정비 개방' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.3 (W20) 인가' }
      ]
    },
    b1_drill_2: {
      icon: 'tech-drill2',
      shortLabel: '레이저 파쇄',
      x: 735,
      y: 402,
      chips: [
        { icon: 'b1-dig', tone: 'amber', text: '심부 현무암 소모 3→2 AP' },
        { icon: 'res-rp', tone: 'rp', text: '기지 전역 RP 획득량 +15%' },
        { icon: 'hud-hq', tone: 'muted', text: '본부 Lv.4 (W35) 인가' }
      ]
    }
  };

  const TRACK_Y_POS = {
    defense_eng: 44,
    infantry_weap: 114,
    auto_turret: 221,
    power_infra: 330,
    bunker_eng: 402
  };

  function isPopModalOpen() {
    const modal = document.getElementById('pop-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function isTechModalOpen() {
    const modal = document.getElementById('tech-modal');
    return !!(modal && !modal.classList.contains('hidden'));
  }

  function isAnyPopTechModalOpen() {
    return isPopModalOpen() || isTechModalOpen();
  }

  function openPopModal() {
    const popModal = document.getElementById('pop-modal');
    const techModal = document.getElementById('tech-modal');
    if (techModal) techModal.classList.add('hidden');
    if (!popModal) return;
    renderPopModal();
    popModal.classList.remove('hidden');
  }

  function closePopModal() {
    const popModal = document.getElementById('pop-modal');
    if (popModal) popModal.classList.add('hidden');
  }

  function togglePopModal() {
    if (isPopModalOpen()) {
      closePopModal();
      return false;
    }
    openPopModal();
    return true;
  }

  function getDefaultSelectedTechId(st) {
    const tree = (ZS.DATA && ZS.DATA.TECH_TREE) || {};
    const order = (ZS.DATA && ZS.DATA.TECH_ORDER) || Object.keys(tree);
    if (selectedTechId && tree[selectedTechId]) {
      return selectedTechId;
    }
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (ZS.Game.canResearchTech && ZS.Game.canResearchTech(id).ok) {
        return id;
      }
    }
    if (tree.tur_lv2 && (!st || (st.hqLevel || 1) <= 2)) return 'tur_lv2';
    return order[0] || null;
  }

  function openTechModal(focusTechId) {
    const popModal = document.getElementById('pop-modal');
    const techModal = document.getElementById('tech-modal');
    if (popModal) popModal.classList.add('hidden');
    if (!techModal) return;
    if (focusTechId && ZS.DATA && ZS.DATA.TECH_TREE && ZS.DATA.TECH_TREE[focusTechId]) {
      selectedTechId = focusTechId;
    } else if (!selectedTechId || !(ZS.DATA && ZS.DATA.TECH_TREE && ZS.DATA.TECH_TREE[selectedTechId])) {
      selectedTechId = getDefaultSelectedTechId(ZS.Game.state);
    }
    renderTechModal();
    techModal.classList.remove('hidden');
  }

  function closeTechModal() {
    const techModal = document.getElementById('tech-modal');
    if (techModal) techModal.classList.add('hidden');
  }

  function toggleTechModal(focusTechId) {
    if (isTechModalOpen()) {
      closeTechModal();
      return false;
    }
    openTechModal(focusTechId);
    return true;
  }

  function closeAllPopTechModals() {
    closePopModal();
    closeTechModal();
  }

  function renderOpenPopTechModals() {
    if (isPopModalOpen()) renderPopModal();
    if (isTechModalOpen()) renderTechModal();
  }

  // Strict unassigned-pool check: NEVER steal from another assigned role
  function canAdjustRoleUp(st) {
    const jobs = st.jobs || { combat: st.agents, research: 0, prod: 0 };
    const used = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    return (st.agents || 0) > used;
  }

  function fmtPopDec(v) {
    const n = +Number(v || 0).toFixed(1);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function getDailyRpPreview(st) {
    const jobs = st.jobs || { combat: st.popUsed || 0, research: 0, prod: 0 };
    const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(st.hqLevel) : { baseRpPerScientist: 0.8 };
    const drill2Lv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_2') : 0;
    const rawRp = (jobs.research || 0) * (hqInfo.baseRpPerScientist || 0.8) + (st.b1LabFlatRp || 0) + (st.b1LabFlatPerWaveRp || 0);
    const rpMult = 1 + (st.b1LabMult || 0) + (drill2Lv > 0 ? 0.15 : 0);
    const starveMult = st.starving ? (1 - ((ZS.DATA.SUPPLY_RULES && ZS.DATA.SUPPLY_RULES.starveOutputPenalty) || 0.35)) : 1.0;
    return +(rawRp * rpMult * starveMult).toFixed(1);
  }

  function renderPopModal() {
    const body = document.getElementById('pop-modal-body');
    const st = ZS.Game.state;
    if (!body || !st) return;

    const jobs = st.jobs || { combat: st.popUsed || 0, research: 0, prod: 0 };
    const caps = st.jobCaps || { combat: 2, research: 2, prod: 2 };
    const hqInfo = ZS.Game.getHqLevelInfo ? ZS.Game.getHqLevelInfo(st.hqLevel) : { baseRpPerScientist: 0.8 };
    const totalAgents = Math.max(0, st.agents || 0);
    const popUsed = Math.max(0, st.popUsed || 0);
    const assigned = (jobs.combat || 0) + (jobs.research || 0) + (jobs.prod || 0);
    const unassigned = Math.max(0, totalAgents - assigned);
    const canAddAny = canAdjustRoleUp(st);

    const totalBadge = document.getElementById('pop-modal-total-badge');
    if (totalBadge) {
      totalBadge.innerHTML = `${ozIcon('res-agent', 15, 'icon-coin')}<span>총 인원 ${totalAgents} / ${st.popCap || 10}명</span>`;
    }

    const drill1Lv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel('b1_drill_1') : 0;
    const rpPerScientist = hqInfo.baseRpPerScientist || 0.8;
    const rpGainPreview = getDailyRpPreview(st);

    const prodRates = (ZS.DATA && ZS.DATA.PROD_RATES) || { woodPerWorker: 2.0, scrapPerWorker: 1.5, foodPerWorker: 1.5, ammoPerWorker: 2.0, digBase: 1.2, digDrill1: 1.6 };
    const prodCount = jobs.prod || 0;
    const starveMult = st.starving ? (1 - ((ZS.DATA.SUPPLY_RULES && ZS.DATA.SUPPLY_RULES.starveOutputPenalty) || 0.35)) : 1.0;
    const prodWoodPreview = +((prodCount * prodRates.woodPerWorker + (st.b1SupplyWood || 0) + (st.b1SupplyProdWood || 0)) * starveMult).toFixed(1);
    const prodScrapPreview = +((prodCount * prodRates.scrapPerWorker + (st.b1SupplyScrap || 0) + (st.b1SupplyProdScrap || 0)) * starveMult).toFixed(1);
    const digPerProd = drill1Lv > 0 ? prodRates.digDrill1 : prodRates.digBase;
    const digGainPreview = +((2 + prodCount * digPerProd) * (1 + (st.b1DigApBonusMult || st.b1DigMult || 0))).toFixed(1);
    const prodFoodPerW = (prodRates.foodPerWorker || 1.5) + (st.b1ProdFoodAdd || 0);
    const prodAmmoPerW = (prodRates.ammoPerWorker || 2.0) + (st.b1ProdAmmoAdd || 0);

    const b1Open = (st.hqLevel || 1) >= 2 && !!st.undergroundUnlocked;
    const isGameOver = st.phase === 'gameover';

    // Agent pips bar (shows assigned vs unassigned visually)
    const maxPips = Math.min(12, totalAgents);
    let pipsHtml = '';
    for (let i = 0; i < maxPips; i++) {
      const isFree = i >= assigned;
      pipsHtml += `<span class="pop-agent-pip${isFree ? ' is-free' : ' is-assigned'}" title="${isFree ? '미배정 대기 요원' : '직무 배치 완료'}">${ozIcon('res-agent', 15)}</span>`;
    }
    if (totalAgents > maxPips) {
      pipsHtml += `<span class="pop-pip-overflow">+${totalAgents - maxPips}</span>`;
    }

    const plusLockHint = !canAddAny ? '미배정 인원이 0명입니다. 먼저 다른 직무에서 (-)로 감원하세요.' : '';
    const combatCap = Math.max(0, caps.combat || 0);
    const researchCap = Math.max(0, caps.research || 0);
    const prodCap = Math.max(0, caps.prod || 0);

    const roleCards = [
      {
        role: 'combat',
        title: '전투요원',
        badgeCls: 'role-combat',
        iconId: 'cat-defense',
        iconCls: 'icon-coin',
        count: jobs.combat || 0,
        cap: combatCap,
        canMinus: !isGameOver && (jobs.combat || 0) > 0,
        canPlus: !isGameOver && canAddAny && (jobs.combat || 0) < combatCap,
        atCap: (jobs.combat || 0) >= combatCap,
        minusTitle: (jobs.combat || 0) <= 0 ? '감원할 전투요원 없음' : '전투요원 1명을 미배정 대기 풀로 감원 (미배치 초소 발생 가능)',
        plusTitle: (jobs.combat || 0) >= combatCap
          ? `전투 슬롯 상한(${combatCap}자리) 도달 — 초소 추가 건설 또는 본부 Lv.2+ 증축`
          : (plusLockHint || '미배정 요원 1명을 빈 초소·포대에 자동 배정'),
        stats: [
          {
            icon: 'cat-defense',
            cls: popUsed > 0 ? 'icon-coin' : 'icon-muted',
            main: `가동 ${popUsed}/${combatCap}자리`,
            sub: combatCap > popUsed ? `빈 초소 슬롯 ${combatCap - popUsed}자리` : (combatCap > 0 ? '모든 전투 슬롯 가동' : '전투 초소를 건설하세요')
          }
        ]
      },
      {
        role: 'research',
        title: '연구요원',
        badgeCls: 'role-research',
        iconId: 'res-rp',
        iconCls: 'icon-rp',
        count: jobs.research || 0,
        cap: researchCap,
        canMinus: !isGameOver && (jobs.research || 0) > 0,
        canPlus: !isGameOver && canAddAny && (jobs.research || 0) < researchCap,
        atCap: (jobs.research || 0) >= researchCap,
        minusTitle: (jobs.research || 0) <= 0 ? '감원할 연구요원 없음' : '연구요원 1명을 미배정 대기 풀로 감원',
        plusTitle: (jobs.research || 0) >= researchCap
          ? `연구 슬롯 상한(${researchCap}자리) 도달 — [전력·숙소] 탭에서 연구막사 증설`
          : (plusLockHint || '미배정 요원 1명을 연구요원으로 배정'),
        stats: [
          {
            icon: 'res-rp',
            cls: 'icon-rp',
            main: `+${fmtPopDec(rpGainPreview)} RP / 일`,
            sub: `1인당 +${fmtPopDec(rpPerScientist)} RP`
          }
        ]
      },
      {
        role: 'prod',
        title: '생산요원',
        badgeCls: 'role-prod',
        iconId: 'act-repair',
        iconCls: 'icon-ap',
        count: jobs.prod || 0,
        cap: prodCap,
        canMinus: !isGameOver && (jobs.prod || 0) > 0,
        canPlus: !isGameOver && canAddAny && (jobs.prod || 0) < prodCap,
        atCap: (jobs.prod || 0) >= prodCap,
        minusTitle: (jobs.prod || 0) <= 0 ? '감원할 생산요원 없음' : '생산요원 1명을 미배정 대기 풀로 감원',
        plusTitle: (jobs.prod || 0) >= prodCap
          ? `생산 슬롯 상한(${prodCap}자리) 도달 — [전력·숙소] 탭에서 작업장 증설`
          : (plusLockHint || '미배정 요원 1명을 생산요원으로 배정'),
        stats: b1Open
          ? [
              {
                hideTopIcon: true,
                mainHtml: `${ozIcon('res-wood', 14, 'icon-wood')}<span>+${fmtPopDec(prodWoodPreview)}</span><span class="pop-stat-sep">·</span>${ozIcon('res-scrap', 14, 'icon-scrap')}<span>+${fmtPopDec(prodScrapPreview)}</span>`,
                sub: `1인당 목재 +${fmtPopDec(prodRates.woodPerWorker)} · 고철 +${fmtPopDec(prodRates.scrapPerWorker)} · 식량 +${fmtPopDec(prodFoodPerW)} · 탄환 +${fmtPopDec(prodAmmoPerW)}`
              },
              {
                icon: 'b1-dig',
                cls: 'icon-ap',
                main: `+${fmtPopDec(digGainPreview)} AP / 일`,
                sub: `지하 굴착 · 1인당 +${fmtPopDec(digPerProd)} AP`
              }
            ]
          : [
              {
                hideTopIcon: true,
                mainHtml: `${ozIcon('res-wood', 14, 'icon-wood')}<span>+${fmtPopDec(prodWoodPreview)}</span><span class="pop-stat-sep">·</span>${ozIcon('res-scrap', 14, 'icon-scrap')}<span>+${fmtPopDec(prodScrapPreview)}</span>`,
                sub: `1인당 목재 +${fmtPopDec(prodRates.woodPerWorker)} · 고철 +${fmtPopDec(prodRates.scrapPerWorker)}`
              }
            ]
      }
    ];

    const cardsHtml = roleCards
      .map(
        (rc) => `
        <section class="pop-role-card ${rc.badgeCls}" data-role="${rc.role}">
          <div class="pop-role-bar"></div>
          <header class="pop-role-head">
            <span class="pop-role-title">${escapeHtml(rc.title)}</span>
          </header>
          <div class="pop-role-hero">
            <span class="pop-role-emblem">${ozIcon(rc.iconId, 44, rc.iconCls)}</span>
            <div class="pop-role-count-wrap">
              <strong class="pop-role-count">${rc.count}</strong>
              <span class="pop-role-cap">/ ${rc.cap}자리</span>
            </div>
          </div>
          <div class="pop-role-stats ${rc.stats.length === 1 ? 'single' : ''}">
            ${rc.stats
              .map(
                (sb) => `
              <div class="pop-stat-box">
                ${sb.hideTopIcon ? '' : `<span class="pop-stat-icon">${ozIcon(sb.icon, 16, sb.cls)}</span>`}
                <span class="pop-stat-main">${sb.mainHtml || escapeHtml(sb.main)}</span>
                <span class="pop-stat-sub">${escapeHtml(sb.sub)}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="pop-stepper">
            <button
              type="button"
              class="pop-step-btn minus"
              data-job-role="${rc.role}"
              data-job-delta="-1"
              ${rc.canMinus ? '' : 'disabled'}
              title="${escapeHtml(rc.minusTitle)}"
              aria-label="${escapeHtml(rc.title)} 1명 감원"
            >
              <span>−</span>
            </button>
            <button
              type="button"
              class="pop-step-btn plus${canAddAny ? '' : ' pool-empty'}${rc.atCap ? ' cap-full' : ''}"
              data-job-role="${rc.role}"
              data-job-delta="1"
              ${rc.canPlus ? '' : 'disabled'}
              title="${escapeHtml(rc.plusTitle)}"
              aria-label="${escapeHtml(rc.title)} 1명 배정"
            >
              <span>+</span>
            </button>
          </div>
        </section>
      `
      )
      .join('');

    const starveBannerHtml = st.starving
      ? `<div class="pop-starve-alert">${ozIcon('state-alert', 16, 'icon-danger')}<span>기아 상태: 유인 화력 -25% · 연구/생산 -35% · 안락함 -2티어 · 신규 유입 중단 (식량 보급 시 즉시 해제)</span></div>`
      : '';

    const recruitPct = Math.min(100, Math.max(0, Math.round((st.agentRecruitProgress || 0) * 100)));
    const recruitRate = ZS.Game.getDawnRecruitRate ? ZS.Game.getDawnRecruitRate(st.wave) : 0.75;
    const maxPerDawn = (ZS.DATA && ZS.DATA.RECRUIT_RULES && ZS.DATA.RECRUIT_RULES.maxPerDawn) || 3;
    const isFullBeds = totalAgents >= (st.popCap || 9);
    const recruitStateCls = st.starving ? ' is-starving' : (isFullBeds ? ' is-full' : '');
    const recruitText = st.starving
      ? `기아로 모집 중단 (진행도 ${recruitPct}% 정지)`
      : (isFullBeds
          ? `숙소 만원 · 증설 대기 ${recruitPct}% (일일 +${fmtPopDec(recruitRate)}명 · 상한 ${maxPerDawn}명/일)`
          : `다음 생존자 모집 ${recruitPct}% (일일 +${fmtPopDec(recruitRate)}명 · 상한 ${maxPerDawn}명/일)`);

    body.innerHTML = `
      ${starveBannerHtml}
      <div class="pop-pool-banner${unassigned > 0 ? ' has-free' : ' all-assigned'}">
        <div class="pop-pool-top">
          <div class="pop-pool-count-wrap">
            <span class="pop-pool-label">미배정 대기 인원</span>
            <strong class="pop-pool-num">${unassigned}명</strong>
            <span class="pop-pool-ratio">(${assigned}/${totalAgents} 배치 중)</span>
          </div>
          <div class="pop-agent-pips" aria-hidden="true">${pipsHtml}</div>
        </div>
        <div class="pop-pool-notice">
          ${
            unassigned === 0
              ? `${ozIcon('state-alert', 15, 'icon-coin')}<span>전원 배치 완료 — 타 직무로 전환하려면 먼저 다른 직무에서 <b>(−) 감원</b> 후 <b>(+) 배정</b>하세요.</span>`
              : `${ozIcon('stat-check', 15, 'icon-heal')}<span>대기 인원 <b>${unassigned}명</b> 배정 가능 — 원하는 직무의 <b>(+)</b>를 눌러 배치하세요.</span>`
          }
        </div>
        <div class="pop-recruit-row${recruitStateCls}">
          <div class="pop-recruit-meta">
            <span>${ozIcon('res-agent', 14, st.starving ? 'icon-danger' : 'icon-coin')} ${escapeHtml(recruitText)}</span>
            <strong>${recruitPct}%</strong>
          </div>
          <div class="pop-recruit-track" role="progressbar" aria-valuenow="${recruitPct}" aria-valuemin="0" aria-valuemax="100">
            <div class="pop-recruit-fill" style="width:${recruitPct}%"></div>
          </div>
        </div>
      </div>

      <div class="pop-roles-grid">${cardsHtml}</div>
    `;

    body.querySelectorAll('.pop-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-job-role');
        const delta = Number(btn.getAttribute('data-job-delta'));
        if (ZS.Game.adjustJob) ZS.Game.adjustJob(role, delta);
      });
    });
  }

  function evaluateNodeStatus(st, t) {
    const tree = (ZS.DATA && ZS.DATA.TECH_TREE) || {};
    const curLv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel(t.id) : 0;
    const maxLv = t.maxLv || 1;
    const isMax = curLv >= maxLv;
    const check = ZS.Game.canResearchTech ? ZS.Game.canResearchTech(t.id) : { ok: false };
    const costRp = ZS.Game.getTechCost ? ZS.Game.getTechCost(t.id) : t.costRp;
    const reqHq = t.reqHqLevel || 1;
    const reqWave = ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(reqHq) : ([1, 10, 20, 35, 50][reqHq - 1] || 1);

    let stateCls = 'state-locked';
    let stateLabel = '미해금';
    if (isMax) {
      stateCls = 'state-done';
      stateLabel = maxLv > 1 ? `Lv.${curLv}/${maxLv} 완료` : '연구 완료';
    } else if (check.ok) {
      stateCls = 'state-ready';
      stateLabel = '연구 가능';
    } else if (check.lockedByHq || check.missingReq) {
      stateCls = 'state-locked';
      stateLabel = '미해금';
    } else if (check.shortRp) {
      stateCls = 'state-short';
      stateLabel = 'RP 부족';
    }

    return { curLv, maxLv, isMax, check, costRp, reqHq, reqWave, stateCls, stateLabel };
  }

  function buildEdgePath(fromNode, toNode, edgeIdx, totalIncoming) {
    const halfW = 30;
    const x1 = fromNode.x + halfW;
    const y1 = fromNode.y;
    const x2 = toNode.x - halfW - 3;

    // Spread multiple converging inputs slightly on Y so both arrowheads read cleanly
    let y2 = toNode.y;
    if (totalIncoming === 2) {
      y2 = toNode.y + (edgeIdx === 0 ? -7 : 7);
    }

    if (Math.abs(y1 - y2) <= 2) {
      return {
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        tipX: x2 + 2,
        tipY: y2
      };
    }

    // Keep multi-lane branches cleanly routed in gap corridors
    const corridorX = Math.round((fromNode.x + toNode.x) * 0.5);
    const midX = toNode.id === 'tur_missile' && fromNode.id === 'tur_vulcan'
      ? 294
      : corridorX;

    return {
      d: `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`,
      tipX: x2 + 2,
      tipY: y2
    };
  }

  function renderTechInspector(st) {
    const bar = document.getElementById('tech-inspector-bar');
    if (!bar) return;

    const tree = (ZS.DATA && ZS.DATA.TECH_TREE) || {};
    const branches = (ZS.DATA && ZS.DATA.TECH_BRANCHES) || [];
    selectedTechId = getDefaultSelectedTechId(st);
    const t = selectedTechId ? tree[selectedTechId] : null;
    if (!t) {
      bar.innerHTML = '';
      return;
    }

    const meta = TECH_GRAPH_META[t.id] || {};
    const branch = branches.find((b) => b.id === t.branch) || { name: '', accent: '#C084FC' };
    const stInfo = evaluateNodeStatus(st, t);

    const chips = Array.isArray(meta.chips) ? meta.chips.slice(0, 3) : [];
    const chipsHtml = chips
      .map(
        (c) => `
        <span class="tech-stat-chip tone-${escapeHtml(c.tone || 'muted')}">
          ${ozIcon(c.icon || 'stat-dmg', 15)}
          <span>${escapeHtml(c.text)}</span>
        </span>
      `
      )
      .join('');

    let btnIcon = ozIcon('res-rp', 16, stInfo.check.ok ? 'icon-rp' : '');
    let btnLabel = '연구 불가';
    if (stInfo.isMax) {
      btnIcon = ozIcon('stat-check', 16);
      btnLabel = '연구 완료';
    } else if (stInfo.check.ok) {
      btnLabel = `연구 진행 · ${stInfo.costRp} RP`;
    } else if (stInfo.check.lockedByHq) {
      btnIcon = ozIcon('state-lock', 15, 'icon-muted');
      btnLabel = `본부 Lv.${stInfo.reqHq} (W${stInfo.reqWave}) 필요 · ${stInfo.costRp} RP`;
    } else if (stInfo.check.missingReq) {
      const reqNames = (t.req || [])
        .filter((rid) => !(ZS.Game.getTechLevel && ZS.Game.getTechLevel(rid) > 0))
        .map((rid) => (TECH_GRAPH_META[rid] ? TECH_GRAPH_META[rid].shortLabel : rid));
      btnIcon = ozIcon('state-lock', 15, 'icon-muted');
      btnLabel = reqNames.length > 0 ? `선행 [${reqNames.join(' + ')}] 필요 · ${stInfo.costRp} RP` : `선행 연구 필요 · ${stInfo.costRp} RP`;
    } else if (stInfo.check.shortRp) {
      btnLabel = `RP 부족 (필요 ${stInfo.costRp} RP)`;
    }

    bar.style.setProperty('--branch-accent', branch.accent || '#C084FC');
    bar.innerHTML = `
      <div class="tech-insp-left">
        <div class="tech-insp-icon-tile ${stInfo.stateCls}">
          ${ozIcon(meta.icon || 'res-rp', 28)}
        </div>
        <div class="tech-insp-copy">
          <div class="tech-insp-title-row">
            <strong class="tech-insp-title">${escapeHtml(t.name)}</strong>
            <span class="tech-insp-badge ${stInfo.stateCls}">${escapeHtml(stInfo.stateLabel)}</span>
          </div>
        </div>
      </div>

      <div class="tech-insp-chips">${chipsHtml}</div>

      <div class="tech-insp-act">
        <button
          id="btn-tech-research-exec"
          type="button"
          class="tech-exec-btn${stInfo.check.ok ? ' is-ready' : ''}${stInfo.isMax ? ' is-done' : ''}"
          ${stInfo.check.ok ? '' : 'disabled'}
        >
          ${btnIcon}
          <span>${escapeHtml(btnLabel)}</span>
        </button>
      </div>
    `;

    const execBtn = document.getElementById('btn-tech-research-exec');
    if (execBtn) {
      execBtn.addEventListener('click', () => {
        if (selectedTechId && ZS.Game.researchTech) {
          ZS.Game.researchTech(selectedTechId);
        }
      });
    }
  }

  function renderTechModal() {
    const wrap = document.getElementById('tech-graph-wrap');
    const st = ZS.Game.state;
    if (!wrap || !st) return;

    const rpGainPreview = getDailyRpPreview(st);
    const rpBadge = document.getElementById('tech-modal-rp-badge');
    if (rpBadge) {
      rpBadge.innerHTML = `${ozIcon('res-rp', 15, 'icon-rp')}<span>${Math.floor(st.rp || 0)} RP (+${rpGainPreview}/일)</span>`;
    }
    const hqBadge = document.getElementById('tech-modal-hq-badge');
    if (hqBadge) {
      hqBadge.innerHTML = `${ozIcon('hud-hq', 14, 'icon-coin')}<span>본부 Lv.${st.hqLevel || 1}</span>`;
    }

    const branches = (ZS.DATA && ZS.DATA.TECH_BRANCHES) || [];
    const tree = (ZS.DATA && ZS.DATA.TECH_TREE) || {};
    const order = (ZS.DATA && ZS.DATA.TECH_ORDER) || Object.keys(tree);
    selectedTechId = getDefaultSelectedTechId(st);

    const hqLv = st.hqLevel || 1;
    const hqTiers = [1, 2, 3, 4, 5].map((lv) => {
      const wave = ZS.Game.getHqUnlockWave ? ZS.Game.getHqUnlockWave(lv) : ([1, 10, 20, 35, 50][lv - 1] || 50);
      return { lv, wave, locked: hqLv < lv };
    });

    const tierHeadsHtml = hqTiers
      .map(
        (col) => `
        <div class="tech-tier-head${col.locked ? ' locked' : ''}">
          <span>본부 Lv.${col.lv} · W${col.wave}</span>
          ${col.locked ? ozIcon('state-lock', 13, 'icon-muted') : ''}
        </div>
      `
      )
      .join('');

    const colBgsHtml = hqTiers
      .map((col, idx) => `<div class="tech-col-bg${col.locked ? ' locked' : ''}" data-tier="${idx + 1}"></div>`)
      .join('');

    // Count branch progress
    const branchStats = {};
    for (let i = 0; i < branches.length; i++) {
      branchStats[branches[i].id] = { done: 0, total: 0 };
    }
    for (let i = 0; i < order.length; i++) {
      const t = tree[order[i]];
      if (!t || !branchStats[t.branch]) continue;
      branchStats[t.branch].total += 1;
      const curLv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel(t.id) : 0;
      const maxLv = t.maxLv || 1;
      if (curLv > 0 && (maxLv === 1 || curLv >= maxLv)) {
        branchStats[t.branch].done += 1;
      }
    }

    const tracksHtml = branches
      .map((br) => {
        const yPct = (((TRACK_Y_POS[br.id] || 44) / 444) * 100).toFixed(2);
        const stat = branchStats[br.id] || { done: 0, total: 0 };
        const shortName = br.name.replace(/\s*공학$/, '').replace(/\s*개량$/, '');
        return `
          <div class="tech-track-label" style="top:${yPct}%;--branch-accent:${escapeHtml(br.accent || '#C084FC')};">
            <div class="tech-track-top">
              <span class="tech-branch-dot" aria-hidden="true"></span>
              <span class="tech-track-name">${escapeHtml(shortName)}</span>
            </div>
            <span class="tech-branch-prog">${stat.done}/${stat.total}</span>
          </div>
        `;
      })
      .join('');

    // SVG edges
    let edgesSvg = '';
    for (let i = 0; i < order.length; i++) {
      const tid = order[i];
      const t = tree[tid];
      const toMeta = TECH_GRAPH_META[tid];
      if (!t || !toMeta || !Array.isArray(t.req) || t.req.length === 0) continue;
      const br = branches.find((b) => b.id === t.branch) || { accent: '#C084FC' };
      const toStatus = evaluateNodeStatus(st, t);

      for (let j = 0; j < t.req.length; j++) {
        const rid = t.req[j];
        const fromMeta = TECH_GRAPH_META[rid];
        const fromTech = tree[rid];
        if (!fromMeta || !fromTech) continue;
        const fromLv = ZS.Game.getTechLevel ? ZS.Game.getTechLevel(rid) : 0;
        const fromDone = fromLv > 0;
        const geom = buildEdgePath(
          { id: rid, x: fromMeta.x, y: fromMeta.y },
          { id: tid, x: toMeta.x, y: toMeta.y },
          j,
          t.req.length
        );

        let edgeState = 'locked';
        if (toStatus.isMax || (fromDone && toStatus.curLv > 0)) {
          edgeState = 'done';
        } else if (fromDone && (toStatus.check.ok || toStatus.check.shortRp)) {
          edgeState = 'ready';
        }
        const isConnSelected = selectedTechId === tid || selectedTechId === rid;

        const strokeCol = edgeState === 'locked' && !isConnSelected ? '#475569' : br.accent || '#C084FC';
        const strokeOp = edgeState === 'done' ? '0.92' : edgeState === 'ready' ? '0.88' : isConnSelected ? '0.72' : '0.45';
        const strokeWidth = isConnSelected || edgeState === 'done' ? '2.8' : '2.2';
        const dashAttr = edgeState === 'locked' ? ' stroke-dasharray="5 4"' : '';

        edgesSvg += `<path class="tech-edge ${edgeState}${isConnSelected ? ' selected' : ''}" data-from="${escapeHtml(rid)}" data-to="${escapeHtml(tid)}" data-accent="${escapeHtml(br.accent || '#C084FC')}" data-state="${edgeState}" d="${geom.d}" fill="none" stroke="${strokeCol}" stroke-opacity="${strokeOp}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`;

        // Directional arrowhead triangle
        const tx = geom.tipX;
        const ty = geom.tipY;
        edgesSvg += `<polygon class="tech-edge-arrow" data-from="${escapeHtml(rid)}" data-to="${escapeHtml(tid)}" data-accent="${escapeHtml(br.accent || '#C084FC')}" data-state="${edgeState}" points="${tx},${ty} ${tx - 7},${ty - 4.2} ${tx - 7},${ty + 4.2}" fill="${strokeCol}" fill-opacity="${strokeOp}"/>`;
      }
    }

    // Node tiles
    const nodesHtml = order
      .map((tid) => {
        const t = tree[tid];
        const meta = TECH_GRAPH_META[tid];
        if (!t || !meta) return '';
        const br = branches.find((b) => b.id === t.branch) || { accent: '#C084FC' };
        const info = evaluateNodeStatus(st, t);
        const leftPct = (meta.x / 10).toFixed(2);
        const topPct = ((meta.y / 444) * 100).toFixed(2);
        const isSel = selectedTechId === tid;

        let topBadge = '';
        if (info.isMax) {
          topBadge = `<span class="node-corner-badge done">${ozIcon('stat-check', 13)}</span>`;
        } else if (info.check.lockedByHq || info.check.missingReq) {
          topBadge = `<span class="node-corner-badge lock">${ozIcon('state-lock', 12)}</span>`;
        } else if (info.maxLv > 1) {
          topBadge = `<span class="node-corner-lv">Lv.${info.curLv}/${info.maxLv}</span>`;
        }

        const chipLabel = info.isMax ? (info.maxLv > 1 ? 'MAX' : '완료') : `${info.costRp} RP`;
        const chipCls = info.isMax ? 'done' : info.check.shortRp && !info.check.lockedByHq && !info.check.missingReq ? 'short' : '';

        return `
          <button
            type="button"
            class="tech-graph-node ${info.stateCls}${isSel ? ' is-selected' : ''}"
            data-tech-id="${escapeHtml(t.id)}"
            style="left:${leftPct}%;top:${topPct}%;--branch-accent:${escapeHtml(br.accent || '#C084FC')};"
            title="${escapeHtml(`${t.name} (${info.stateLabel} · ${chipLabel})`)} — 클릭: 상세 확인 / 더블클릭: 즉시 연구"
          >
            ${topBadge}
            <span class="tech-node-icon">${ozIcon(meta.icon || 'res-rp', 24)}</span>
            <span class="tech-node-cost ${chipCls}">${escapeHtml(chipLabel)}</span>
          </button>
        `;
      })
      .join('');

    wrap.innerHTML = `
      <div class="tech-tier-header-row">
        <div class="tech-rail-head">공학 트랙</div>
        <div class="tech-tier-cols-head">${tierHeadsHtml}</div>
      </div>
      <div class="tech-graph-stage">
        <div class="tech-stage-cols">${colBgsHtml}</div>
        <div class="tech-tracks-rail">${tracksHtml}</div>
        <svg class="tech-graph-edges" viewBox="0 0 1000 444" preserveAspectRatio="none" aria-hidden="true">${edgesSvg}</svg>
        <div class="tech-nodes-layer">${nodesHtml}</div>
      </div>
    `;

    wrap.querySelectorAll('.tech-graph-node').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-tech-id');
        if (!tid) return;
        selectedTechId = tid;
        wrap.querySelectorAll('.tech-graph-node').forEach((n) => {
          n.classList.toggle('is-selected', n.getAttribute('data-tech-id') === tid);
        });
        wrap.querySelectorAll('.tech-edge').forEach((edgeEl) => {
          const fromId = edgeEl.getAttribute('data-from');
          const toId = edgeEl.getAttribute('data-to');
          const state = edgeEl.getAttribute('data-state') || 'locked';
          const accent = edgeEl.getAttribute('data-accent') || '#C084FC';
          const isConn = tid === fromId || tid === toId;
          const col = state === 'locked' && !isConn ? '#475569' : accent;
          const op = state === 'done' ? '0.92' : state === 'ready' ? '0.88' : isConn ? '0.72' : '0.45';
          const w = isConn || state === 'done' ? '2.8' : '2.2';
          edgeEl.classList.toggle('selected', isConn);
          edgeEl.setAttribute('stroke', col);
          edgeEl.setAttribute('stroke-opacity', op);
          edgeEl.setAttribute('stroke-width', w);
        });
        wrap.querySelectorAll('.tech-edge-arrow').forEach((arrEl) => {
          const fromId = arrEl.getAttribute('data-from');
          const toId = arrEl.getAttribute('data-to');
          const state = arrEl.getAttribute('data-state') || 'locked';
          const accent = arrEl.getAttribute('data-accent') || '#C084FC';
          const isConn = tid === fromId || tid === toId;
          const col = state === 'locked' && !isConn ? '#475569' : accent;
          const op = state === 'done' ? '0.92' : state === 'ready' ? '0.88' : isConn ? '0.72' : '0.45';
          arrEl.setAttribute('fill', col);
          arrEl.setAttribute('fill-opacity', op);
        });
        renderTechInspector(ZS.Game.state);
      });
      btn.addEventListener('dblclick', () => {
        const tid = btn.getAttribute('data-tech-id');
        if (tid && ZS.Game.researchTech) {
          ZS.Game.researchTech(tid);
        }
      });
    });

    renderTechInspector(st);
  }

  Object.assign(U, {
    isPopModalOpen,
    isTechModalOpen,
    isAnyPopTechModalOpen,
    openPopModal,
    closePopModal,
    togglePopModal,
    openTechModal,
    closeTechModal,
    toggleTechModal,
    closeAllPopTechModals,
    renderPopModal,
    renderTechModal,
    renderOpenPopTechModals,
    // Backward compatibility aliases
    isTechPopModalOpen: isAnyPopTechModalOpen,
    openTechPopModal: function (focusArea) {
      if (focusArea === 'pop') openPopModal();
      else openTechModal();
    },
    closeTechPopModal: closeAllPopTechModals,
    toggleTechPopModal: function (focusArea) {
      if (focusArea === 'pop') return togglePopModal();
      return toggleTechModal();
    },
    renderTechPopModal: renderOpenPopTechModals
  });
})();
