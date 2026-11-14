# Developer Agent Guide (`agents/developer`)

본 디렉토리는 **OUTPOST ZERO (`zombi-servivior`)** 프로젝트의 개발 에이전트 지침과 멀티 에이전트(기획·디자인·개발) 간 GitHub 협업 표준을 정의합니다.

---

## 1. 문서 구성

- **[github-gitflow.md](./github-gitflow.md)**: GitHub CLI(`gh`) 사용법, 정통 GitFlow 5대 브랜치 규칙, 이슈 기반 작업 및 PR 권한, 커밋 메시지 포맷, 릴리즈·태그 규칙 상세 정의
- *(공통 파이프라인)* **[../README.md](../README.md)** · **[../../share/README.md](../../share/README.md)**: `share/` 기반 시안·기획 수령 및 개발 에이전트 단일 코드 작성(`Single Code Writer`) 협업 흐름

---

## 2. 에이전트 간 역할 경계 및 단일 코드 작성자(`Single Code Writer`) 원칙

| 에이전트 역할 | 담당 업무 | `share/` 및 GitHub 내 주요 액션 |
| :--- | :--- | :--- |
| **기획 (Planner) Agent** | 게임 시스템·밸런스·신규 콘텐츠 기획 및 요구사항 정의 | `share/plans/` 계획서 작성 + `gh issue create`로 기능/밸런스 이슈 등록 *(코드 수정·PR 생성 금지)* |
| **디자인 (Designer) Agent** | UI/UX 레이아웃, 복셀 외형·팔레트·SVG 시안 제작 및 비주얼 검수 | `share/design/`에 시안·SVG·토큰표 납품 + `gh issue create`/`comment` 등록 *(코드 수정·PR 생성 금지)* |
| **개발 (Developer) Agent** | **기획 이슈 및 디자인 이슈(`[Art]`/`[UI]`) 전체에 대한 유일한 인게임 코드 구현·이식 주체** | 이슈(`#{issueNumber}`) 및 **`share/plans/`, `share/design/` 산출물 확인** → `git worktree`(`feature/*`) 구현·최적화 → `share/dev/` 전후 캡처 저장 → `develop` 대상 **PR 생성(`Closes #{issueNumber}`)까지만 수행** |

- **디자인 산출물 통합 책임**: 디자인 에이전트가 `share/design/`에 납품한 시안 HTML, SVG 아이콘 세트, 팔레트 토큰표, 아트 명세는 개발 에이전트가 읽어 런타임 아키텍처(깊이 정렬, 야간 정보 레이어, `file://` 무오류 인라인 스프라이트화, 프레임 최적화)에 맞게 정제·이식하여 해당 디자인 이슈를 해결합니다.
- **주의**: 개발 에이전트는 별도 지시가 없는 한 임의로 기획/디자인 이슈를 생성하지 않으며, 등록된 이슈와 `share/` 산출물의 요구사항을 정확히 구현하는 데 집중합니다.
- **시각 검수 및 머지(Merge)**: PR 생성 후 디자인 에이전트가 `share/dev/` 캡처를 바탕으로 시각 검수를 수행할 수 있으며, 최종 코드 리뷰와 병합(`merge`)은 **사용자(프로젝트 오너)가 직접 수행**합니다.

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
