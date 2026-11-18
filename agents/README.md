# Multi-Agent Architecture (`agents/`)

**OUTPOST ZERO (`zombi-servivior`)** 는 루트 [AGENTS.md](../AGENTS.md)에 따라 **`1 총괄 에이전트 + N 기능별 풀스택 서브에이전트`** 체제로 운영합니다.

## 현행 필수 참조 문서

| 대상 작업 | 필독 문서 | 핵심 내용 |
| :--- | :--- | :--- |
| **전 작업 공통** | [../AGENTS.md](../AGENTS.md) | 총괄·풀스택 워커 역할, `Zero-Bloat` 단일 기록 원칙, 병렬/통합 기준 |
| **시각·조형·UI·이펙트** | [designer/art-direction.md](./designer/art-direction.md) | 시맨틱 팔레트(`#5EF2FF` 전력 전용), 3면 음영(`100/82/66%`), `12px`·`0` 이모지 |
| **브랜치·커밋·PR·배포** | [developer/github-gitflow.md](./developer/github-gitflow.md) | `git worktree`, `{type}: [#N]` 커밋, `develop` 타겟 PR, `release/*` |

> **아카이브 안내**: 과거 3에이전트 직렬(`기획→디자인→개발`) 체제 문서([github-communication-guide.md](./github-communication-guide.md), `pm/*`, `designer/README.md`, `designer/design-issue-guide.md`, `developer/README.md`)는 기존 이력 참고용이며, 현재 파이프라인에서는 [AGENTS.md](../AGENTS.md)가 우선합니다.
