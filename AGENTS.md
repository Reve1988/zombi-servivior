# Project Agent Guidelines

이 저장소(`OUTPOST ZERO`)에서 작업하는 모든 에이전트(기획/PM · 디자인 · 개발)는 작업 시작 전 반드시 아래 공통 규칙과 자신의 역할별 가이드를 읽고 준수해야 합니다.

## 1. 역할별 필독 가이드

- **멀티 에이전트 공통 협업 파이프라인 (`Single Code Writer` 원칙)**: `agents/README.md`
- **공통 GitHub / GitFlow / 버전 표준**: `agents/developer/github-gitflow.md`
- **에이전트 간 로컬 작업물 공유 허브 (Git 미추적)**: `share/README.md`, `share/STATUS.md` (전체 실행 계획서: `share/plans/issue-execution-plan.md`)
- **기획 · PM (Planner / PM) 에이전트**: `agents/pm/README.md`, `agents/pm/issue-spec-guide.md`, `agents/pm/roadmap-and-balance.md` 참고
- **개발 (Developer) 에이전트**: `agents/developer/README.md` 및 `agents/developer/github-gitflow.md` 참고
- **디자인 (Designer) 에이전트**: `agents/designer/README.md`, `agents/designer/design-issue-guide.md`, `agents/designer/art-direction.md` 참고 (코드베이스 구조는 `agents/developer/README.md` 참고)

## 2. 핵심 역할 경계 및 불변 원칙

1. **기획(PM) 에이전트의 코드·PR 비개입 원칙**: 기획 에이전트는 인게임 런타임 코드(`index.html`, `css/*`, `js/*`)를 직접 수정하거나 PR을 생성하지 않으며, 코드베이스를 읽기 전용으로 분석한 뒤 구체적인 수치·공식·인수 조건을 담은 GitHub 이슈(`gh issue create`) 및 `share/plans/` 계획서로 할 일을 등록합니다.
2. **디자인(Designer) 에이전트의 시안 납품 및 코드·PR 비개입 원칙**: 디자인 에이전트 역시 인게임 코드를 직접 수정하거나 PR을 생성하지 않습니다. 디자인 이슈(`[Art]` / `[UI]`, `design` 라벨) 등록 또는 기획 이슈의 시각 명세 수립 후 **프로토타입 시안 HTML/Canvas·SVG 원본·팔레트·수치 명세 결과물을 반드시 `share/design/`에 선행 납품**(필요 시 이슈에 핵심 수치 코멘트 추가)하며, 비주얼 기준의 단일 출처는 `agents/designer/art-direction.md`입니다.
3. **개발(Developer) 에이전트 단일 코드 작성(`Single Code Writer`) 및 임의 조형 금지 원칙**: 기획 이슈와 디자인 이슈 모두 **오직 개발 에이전트가 `share/plans/` 및 `share/design/`의 확정 결과물을 인게임 코드에 이식·최적화**하여 `feature/{issueNumber}-{slug}` 브랜치에서 구현하고, 검증 캡처를 `share/dev/`에 남긴 뒤 `develop` 타겟 PR(`Closes #{issueNumber}`) 생성까지만 수행합니다. 시각 요소가 포함된 과제는 **디자이너의 `share/design/` 산출물 없이 개발 에이전트가 임의로 오브젝트 조형·SVG 아이콘·UI 디자인을 창작해 선행 구현하지 않습니다.**
4. **`v0.4.0` 이후 필수 순차 파이프라인 (`기획 → 디자인 → 개발 → 검수`)**: `v0.4.0`(Phase 2) 작업부터는 모든 기능·콘텐츠를 반드시 **`[1단계: 기획(PM) 명세·이슈화]` → `[2단계: 디자인(Designer) 시안·SVG·아트 명세 납품 (`share/design/`) & 컨펌]` → `[3단계: 개발(Developer) 인게임 코드 이식 & PR 생성]` → `[4단계: 디자인 시각 검수 & PM 밸런스 검수]`** 순서로 진행합니다. (순수 백엔드/데이터 전용 작업만 디자인 단계 생략 가능)
5. **머지 및 보호 브랜치 권한**: 모든 에이전트는 사용자의 명시적 지시 없이 `main` / `develop` 브랜치에 직접 커밋·푸시하거나 `gh pr merge`를 실행하지 않습니다.
