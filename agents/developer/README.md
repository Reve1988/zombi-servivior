# Developer Agent Guide (`agents/developer`)

본 디렉토리는 **OUTPOST ZERO (`zombi-servivior`)** 프로젝트의 개발 에이전트 지침과 멀티 에이전트(기획·디자인·개발) 간 GitHub 협업 표준을 정의합니다.

---

## 1. 문서 구성

- **[github-gitflow.md](./github-gitflow.md)**: GitHub CLI(`gh`) 사용법, 정통 GitFlow 5대 브랜치 규칙, 이슈 기반 작업 및 PR 권한, 커밋 메시지 포맷, 릴리즈·태그 규칙 상세 정의

---

## 2. 에이전트 간 역할 경계 (Role Boundaries)

| 에이전트 역할 | 담당 업무 | GitHub 내 주요 액션 |
| :--- | :--- | :--- |
| **기획 (Planner) Agent** | 게임 시스템·밸런스·신규 콘텐츠 기획 및 요구사항 정의 | `gh issue create`로 기능/밸런스 이슈 등록 및 명세 작성 |
| **디자인 (Designer) Agent** | UI/UX 레이아웃, 복셀 오브젝트 외형·이펙트·아트 명세 정의 | `gh issue create` / `gh issue comment`로 디자인 이슈·가이드 등록 |
| **개발 (Developer) Agent** | **등록된 GitHub 이슈(`#{issueNumber}`)를 기반으로 코드 구현 및 검증** | 이슈 조회(`gh issue view`) → `feature` 브랜치 생성 → 구현·커밋 → `develop` 대상 **PR 생성(`gh pr create`)까지만 수행** |

- **주의**: 개발 에이전트는 별도 지시가 없는 한 임의로 기획/디자인 이슈를 생성하지 않으며, 등록된 이슈의 요구사항을 정확히 구현하는 데 집중합니다.
- **리뷰 및 머지(Merge)**: 생성된 PR의 코드 리뷰와 병합(`merge`)은 **사용자(프로젝트 오너)가 직접 수행**합니다.

---

## 3. 코드베이스 구조 및 인게임 버전 관리

- 본 프로젝트는 외부 번들러나 프레임워크 없이 순수 **HTML / CSS / Vanilla JS (`window.ZS` 네임스페이스)** 로 동작합니다 (`file://` 직접 실행 및 GitHub Pages 완벽 호환).
- 주요 파일:
  - `index.html`: 메인 캔버스, 상단 전술 HUD(`#hud-version` 포함), 건설 도크, 상인·가이드 모달
  - `css/style.css`: 모던 택티컬 UI 스타일
  - `js/data.js`: **인게임 버전(`ZS.DATA.VERSION`)**, 건물/가구/좀비/상인 밸런스 데이터
  - `js/iso.js`: 2:1 아이소메트릭 투영, 카메라 제어, 3D 복셀 프리즘 드로잉
  - `js/pathfinding.js`: 다익스트라 기반 플로우 필드 길찾기
  - `js/renderer.js`: 복셀 오브젝트 및 주야간 조명·블랙아웃 렌더러
  - `js/game.js`: 자원·전력·전투·안락함·상인·세이브 시뮬레이션 로직
  - `js/audio.js` / `js/main.js`: Web Audio 사운드 합성 및 입력·UI 바인딩

### 인게임 버전 관리 규칙 (필수)
- 게임 버전의 단일 진실 공급원(Single Source of Truth)은 **`js/data.js`의 `ZS.DATA.VERSION`** 상수입니다 (예: `'v0.1.0'`).
- `js/main.js` 초기화 시 `ZS.DATA.VERSION` 값을 읽어 다음 3곳에 자동 표시합니다:
  1. 상단 HUD 우측 버전 배지 (`#hud-version`)
  2. 전술 지휘관 매뉴얼 모달 헤더 (`#guide-version`)
  3. 브라우저 탭 타이틀 (`document.title`)
- `release/*` 또는 `hotfix/*` 브랜치에서 버전을 올릴 때는 반드시 **`js/data.js`의 `ZS.DATA.VERSION` 값을 Git 태그 버전(`vX.Y.Z`)과 동일하게 갱신**해야 합니다.

---

## 4. 구현 후 필수 검증 체크리스트

PR을 생성하기 전 개발 에이전트는 반드시 아래 항목을 검증합니다.
1. 모든 `js/*.js` 파일 구문 오류(Syntax Error) 여부 확인 (`node` 구문 검사 등)
2. 신규/수정 시스템 동작 및 기존 세이브 데이터(`localStorage`) 호환성 확인
3. `<script type="module">` 등 `file://` 로컬 실행 시 CORS 오류를 유발하는 문법 미사용 확인
