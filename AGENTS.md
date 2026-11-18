# Project Agent Guidelines (`OUTPOST ZERO`)

본 저장소는 속도·토큰 효율과 진정한 기능 병렬화를 위해 **`1 총괄 에이전트(기획·조율) + N 기능별 풀스택 서브에이전트(병렬 구현·PR)`** 경량 체제로 운영합니다.

---

## 1. 운영 구조 (`Coordinator + Parallel Full-Stack Workers`)

1. **총괄 에이전트 (Lead / Coordinator — 메인 대화창)**
   - 사용자(오너)와 방향·수치·우선순위를 간결하게 합의해 GitHub 이슈를 정리합니다.
   - 수정 파일이 겹치지 않는 독립 이슈는 **`invoke_subagent`(`Workspace: "share"` 또는 `.worktrees/feature-{N}-{slug}`)** 로 **동시에 병렬 실행**합니다.
   - 반면 `renderer.js`·`game.js` 등 핵심 파일을 함께 고치는 연관 작업은 **단일 워커 · 단일 통합 PR (`1 Sprint = 1 PR` 허용)** 로 묶어 충돌과 중복 파일 탐색을 막습니다.
   - 사소한 1~2파일 수정·문서 정리·핫픽스는 서브에이전트 없이 총괄 에이전트가 직접 처리할 수 있습니다.
2. **기능별 풀스택 서브에이전트 (Full-Stack Worker)**
   - 과거의 `기획 → 디자인 → 개발` 직렬 역할 분리를 폐지합니다. 각 워커는 할당받은 이슈를 **`조형·UI/SVG + 게임 로직 + 구문/브라우저 검증 + develop 타겟 PR 생성`까지 End-to-End** 로 완결합니다.
   - 작업 완료 시 전후 비교 캡처(필요한 경우에만 `share/dev/issue-{N}.png`)와 검증 요약을 PR 본문(`Closes #N`)에 남기고 종료합니다.

---

## 2. 토큰 · 속도 절감 불변 수칙 (`Zero-Bloat Rules`)

1. **단일 기록 원칙 (`Single Source of Truth = GitHub Issue / PR`)**:
   - `share/STATUS.md`, `share/plans/*`, `share/dev/*-handoff.md`, 상시 `GitHub Wiki` 중복 동기화를 **폐지**합니다.
   - 요구사항·수치는 GitHub 이슈 본문에, 구현 결과·검증 내역은 PR 본문(`Closes #N`)에만 간결히 적습니다. *(Wiki는 정식 릴리스 시 필요할 때만 총괄이 선택 갱신)*
2. **HTML 프로토타입 시안 이중 코딩 금지**:
   - 사용자의 명시적 요청이 없는 한 `share/design/*.html` 별도 렌더 시안을 새로 코딩하지 않고, **인게임 코드에 직접 구현한 뒤 실제 게임 화면 캡처로 검수**합니다.
3. **필요한 문서만 선택 열람 (전수 열람 금지)**:
   - 모든 에이전트는 작업 시작 전 아래 해당 파일만 선택해 읽습니다:
     - **시각 · UI · 조형 수정 포함 시**: `agents/designer/art-direction.md` (시맨틱 팔레트·음영·`>=12px`·이모지 금지)
     - **브랜치 · `worktree` · PR · 릴리스 작업 시**: `agents/developer/github-gitflow.md` (커밋·PR 포맷·GitFlow)
     - *(구 `agents/pm/*`, `agents/designer/design-issue-guide.md`, `agents/github-communication-guide.md`는 과거 3에이전트 직렬 체제 아카이브이며 현행 필수 규칙이 아님)*

---

## 3. GitHub 표기 · 권한 · 런타임 불변 기준

1. **단일 계정(`Reve1988`) 구분 말머리**:
   - GitHub 이슈·코멘트·PR 작성 시 첫 줄에 **`### 📋 [총괄/기획]`** 또는 **`### 🛠️ [풀스택 워커]`**, PR 제목에 `[워커] {type}: [#{N}] {요약}`을 표기합니다. 말머리가 없는 일반 댓글은 오너 직접 지시로 간주합니다.
   - `Project #1` / 게이트 라벨 갱신은 최소한으로 유지합니다(PR 머지 또는 핵심 상태 전환 시에만 동기화).
2. **보호 브랜치 및 머지 권한**:
   - 모든 에이전트는 사용자의 명시적 지시 없이 `main` / `develop` 브랜치에 직접 커밋·푸시하거나 `gh pr merge`를 실행하지 않습니다.
3. **런타임 불변 원칙 (`file://` 호환 & 비주얼 기준)**:
   - 순수 HTML / CSS / Vanilla JS(`window.ZS`)를 유지하며 `<script type="module">` · `import` / `export`를 절대 사용하지 않습니다.
   - `12px` 최소 폰트, 런타임 UI 내 OS 이모지 `0개`, 좌상단 광원 3면 명도(`100% / 82% / 66%`), **전력 청록(`#5EF2FF`)은 유전력 설비 전용(무전력 시설 청록 `0px`)** 규칙을 반드시 준수합니다.
