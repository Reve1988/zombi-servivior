# Project Agent Guidelines

이 저장소(`OUTPOST ZERO`)에서 작업하는 모든 에이전트(기획/PM · 디자인 · 개발)는 작업 시작 전 반드시 아래 공통 규칙과 자신의 역할별 가이드를 읽고 준수해야 합니다.

## 1. 역할별 필독 가이드

- **공통 GitHub / GitFlow / 버전 표준**: `agents/developer/github-gitflow.md`
- **기획 · PM (Planner / PM) 에이전트**: `agents/pm/README.md`, `agents/pm/issue-spec-guide.md`, `agents/pm/roadmap-and-balance.md` 참고
- **개발 (Developer) 에이전트**: `agents/developer/README.md` 및 `agents/developer/github-gitflow.md` 참고
- **디자인 (Designer) 에이전트**: `agents/designer/README.md`, `agents/designer/design-issue-guide.md`, `agents/designer/art-direction.md` 참고 (코드베이스 구조는 `agents/developer/README.md` 참고)

## 2. 핵심 역할 경계 및 불변 원칙

1. **기획(PM) 에이전트의 코드 비개입 원칙**: 기획 에이전트는 인게임 런타임 코드(`index.html`, `css/*`, `js/*`)를 직접 수정하지 않으며, 코드베이스를 읽기 전용으로 분석한 뒤 구체적인 수치·공식·인수 조건을 담은 GitHub 이슈(`gh issue create`)로 개발 할 일을 등록합니다.
2. **이슈 기반 개발 및 PR 경계**: 개발 에이전트는 등록된 GitHub 이슈(`#{issueNumber}`)를 기반으로 `feature/{issueNumber}-{slug}` 브랜치에서 구현하고 `develop` 타겟 PR 생성(`gh pr create`)까지만 수행합니다.
3. **머지 및 보호 브랜치 권한**: 모든 에이전트는 사용자의 명시적 지시 없이 `main` / `develop` 브랜치에 직접 커밋·푸시하거나 `gh pr merge`를 실행하지 않습니다.
4. **디자인(Designer) 에이전트의 코드 비개입 원칙**: 디자인 에이전트도 인게임 런타임 코드(`index.html`, `css/*`, `js/*`)를 직접 수정하지 않습니다(색상값 하나라도 마찬가지). 화면과 코드를 읽기 전용으로 분석한 뒤, 색상 HEX·크기·레이어 순서·연출 시간과 완료 조건을 담은 디자인 이슈(`[Art]` / `[UI]`, `design` 라벨)를 등록하거나 기획 이슈에 디자인 명세 코멘트를 남깁니다. 비주얼 기준의 단일 출처는 `agents/designer/art-direction.md`입니다.
