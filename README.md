# Dead-End Defense — 모던 전술 디펜스 & 쉘터 빌더

순수 **HTML / CSS / JavaScript (Canvas 2D & Web Audio API)** 만으로 제작한 아이소메트릭(쿼터뷰) 2.5D 미니어처 복셀 좀비 디펜스 & 기지 꾸미기 게임입니다.

---

## 주요 특징

- **미니어처 / 복셀 쿼터뷰 그래픽**: 별도 외부 이미지 에셋 없이 프로시저럴 2.5D 복셀 렌더링과 동적 야간 조명·블랙아웃 연출을 구현했습니다.
- **낮(정비) ↔ 밤(웨이브 방어) 사이클**:
  - **낮**: 시간 제한 없이 방벽·방어 거점·발전기·숙소·모던 인테리어를 건설하고 무료로 위치를 재배치할 수 있습니다.
  - **밤**: `[🌙 웨이브 시작]` 버튼을 누르면 야간 조명이 점등되며 자동 방어 전투가 시작됩니다.
- **5대 자원 & 전력·인구 전략 시스템**:
  - `🪵 목재` / `🔩 고철`: 방벽, 초소, 자동포탑, 발전·숙소, 인테리어 건설 및 수리
  - `⚡ 전력`: 낮 전환 시 **태양광 어레이·풍력 터빈** 발전량만큼 충전되며, 밤 동안 **CIWS 발칸·유탄·EMP 자동포탑**과 **LED 투광등**이 실시간으로 소모합니다. 배터리가 방전되면 **정전(블랙아웃)**이 발생합니다.
  - `👥 작전 요원(인구)`: 막사·모듈러 숙소로 수용량을 늘리며, 요원이 배치된 **소총 벙커·샷건 초소·저격 감시탑**은 전기가 끊겨도 끝까지 사격합니다.
  - `🪙 코인`: 낮마다 방문하는 **외부 기지 장갑 보급대(상인)**에게서 자재, 급속 파워셀, 베테랑 요원, 특수 설비 보급품을 구매합니다.
- **모던 기지 꾸미기 & 안락함(사기) 시너지**:
  - 아스팔트·스틸 데크·테라스 타일과 야외 가스 파티오 히터, LED 투광등, 스마트 음료 자판기, 네온 아케이드, 콘크리트 플랜터 등을 조화롭게 배치하면 **안락함 등급 보너스**와 **반경 오라 버프**가 활성화됩니다.
- **자동 저장**: `localStorage`를 통해 현재 기지 배치와 진행 웨이브가 브라우저에 자동 저장됩니다.

---

## 실행 방법

별도 설치나 빌드 과정 없이 `index.html`을 브라우저에서 열면 바로 플레이할 수 있습니다.

- **GitHub Pages 웹 플레이** *(Settings → Pages 활성화 시)*: `https://reve1988.github.io/zombi-servivior/`

---

## 조작 방법

| 조작 | 설명 |
| :--- | :--- |
| **마우스 좌클릭 / 드래그** | 시설·바닥재 설치 및 타일 상세 정보 조회 |
| **마우스 우클릭 드래그 / `WASD`** | 카메라 화면 이동 |
| **마우스 휠** | 화면 확대 / 축소 |
| **`M`** | 낮 동안 기존 설치물 **무료 위치 이동** 모드 |
| **`X`** | 시설/바닥 철거 및 건설 비용 **80% 환급** 모드 |
| **`Space`** | 지휘 본부 중심으로 카메라 복귀 |
| **`ESC`** | 선택 / 모달 취소 |

---

## 프로젝트 구조

```text
zombi-servivior/
├── index.html          # 메인 화면 및 HUD / 건설 도크 / 보급 상인 UI
├── assets/
│   ├── fonts/          # 번들 웹폰트 (Pretendard·Chakra Petch .subset.woff2) 및 SIL OFL 1.1 전문
│   └── icons/          # 전술 디오라마 파비콘 (favicon.svg · ico · png · apple-touch-icon)
├── css/
│   └── style.css       # 모던 택티컬 UI 스타일링
└── js/
    ├── data.js         # 시설, 인테리어, 상인 품목, 좀비 밸런스 데이터
    ├── audio.js        # Web Audio API 기반 합성 사운드 효과음
    ├── iso.js          # 2:1 아이소메트릭 좌표 변환 및 3D 복셀 드로잉
    ├── pathfinding.js  # 다익스트라 플로우 필드 길찾기
    ├── renderer-core.js        # 지형·프레임 루프·기본 복셀 도형·발광 패스 렌더러 (ZS._Renderer)
    ├── renderer-structures.js  # 연결 성벽·게이트·거치 데크·건물/HQ/요원 조형 렌더러
    ├── renderer-entities.js    # 좀비·특수 변이체·보스·투사체·사망/파티클 렌더러
    ├── renderer-overlay.js     # 야간 조명·정찰선·정보 레이어·도크 썸네일 & ZS.Renderer 조합
    ├── game-core.js            # 전역 state·그리드·정찰 경로·숙련도·세이브/로드·디버그 (ZS._Game)
    ├── game-build.js           # 티어 진화·안락함/오라 스탯·건설/거치/이동/철거·상인 시스템
    ├── game-combat.js          # 웨이브/정찰 생성·스킬·주야간 전력/블랙아웃·포탑/투사체 전투
    ├── game-zombies.js         # 좀비/보스 AI·성벽 파괴·웨이브 정산·VFX & ZS.Game 조합
    ├── ui-hud.js               # 상단 전술 HUD·정찰 브리핑·웨이브 배너·디버그 바 (ZS._UI)
    ├── ui-dock.js              # 건설 도크 탭/카드·툴 모드·커서 툴팁·시설 조회·상인 모달
    └── main.js                 # 입력/단축키 바인딩·메인 루프·팔레트 동기화·부트스트랩
```

---

## 오픈소스 라이선스 고지 (Third-Party Licenses)

- **`Pretendard`** — Copyright (c) 2021 Kil Hyung-jin (`https://github.com/orioncactus/pretendard`), licensed under the **SIL Open Font License 1.1** ([`assets/fonts/OFL.txt`](./assets/fonts/OFL.txt)).
- **`Chakra Petch`** — Copyright 2018 The Chakra Petch Project Authors (Cadson Demak, `https://github.com/m4rc1e/Chakra-Petch`), licensed under the **SIL Open Font License 1.1** ([`assets/fonts/ChakraPetch-OFL.txt`](./assets/fonts/ChakraPetch-OFL.txt)).
