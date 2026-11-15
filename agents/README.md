# Multi-Agent Collaboration & Handoff Pipeline (`agents/`)

본 문서는 **OUTPOST ZERO (`zombi-servivior`)** 저장소에서 협업하는 **기획(PM) · 디자인(Designer) · 개발(Developer)** 3개 에이전트의 공통 작업 파이프라인과 **단일 코드 작성자(`Single Code Writer`) 원칙**을 정의합니다.

---

## 1. 역할별 세부 가이드 디렉토리

- **[pm/README.md](./pm/README.md)**: 시스템·밸런스 기획, 이슈 분할 표준, 페이즈별 로드맵 관리
- **[designer/README.md](./designer/README.md)**: 아트 디렉션, 시맨틱 팔레트, 시안/SVG 제작 및 비주얼 검수
- **[developer/README.md](./developer/README.md)**: `git worktree` 기반 코드 구현, `share/` 산출물 통합, PR 생성 및 버전 관리
- **[../share/README.md](../share/README.md)**: Git에 추적되지 않는 로컬 실시간 작업물 공유 허브 운영 지침 (`share/STATUS.md` 현황판 포함)

---

## 2. 핵심 운영 원칙: 단일 코드 작성자 (`Single Code Writer`)

본 프로젝트는 외부 이미지 파일 대신 `js/iso.js` · `js/renderer.js`로 그리는 **프로시저럴 2.5D 복셀 엔진**이며 `file://` 직접 실행 호환성(외부 리소스 `fetch` CORS 회피, 깊이 정렬, 야간 정보 레이어 분리 등)을 유지해야 합니다. 따라서 **Git 브랜치 충돌 방지와 런타임 품질 보증을 위해 아래 권한 경계를 엄격히 적용**합니다.

| 구분 | 기획 (PM) 에이전트 | 디자인 (Designer) 에이전트 | 개발 (Developer) 에이전트 | 사용자 (Owner) |
| :--- | :---: | :---: | :---: | :---: |
| **인게임 코드 수정 (`index.html`, `css/`, `js/`)** | ❌ 금지 | ❌ 금지 | ✅ **단독 전담** | ✅ 가능 |
| **Git 브랜치 생성 & PR 생성 (`gh pr create`)** | ❌ 금지 | ❌ 금지 | ✅ **단독 전담 (`Closes #N`)** | ✅ 가능 |
| **GitHub 이슈 생성 / 코멘트 (`gh issue`)** | ✅ 기획·밸런스 이슈 등록 | ✅ 디자인 이슈 등록 & 아트 코멘트 | ⚪ 구현·PR 안내 코멘트 | ✅ 총괄 |
| **로컬 공유 폴더 (`share/`) 쓰기 영역** | `share/plans/` & `STATUS.md` | `share/design/` & `STATUS.md` | `share/dev/` & `STATUS.md` | 전체 |
| **검수 및 병합 (`gh pr merge`)** | 밸런스·스펙 부합 확인 | `share/dev/` 캡처 기반 시각 검수 | 구문·세이브·`file://` 무결성 검증 | ✅ **최종 리뷰 & Merge** |

### 왜 디자인 이슈(`[Art]` / `[UI]`)도 개발 에이전트가 PR을 생성하는가?
1. **엔진 아키텍처 통합**: 디자이너가 만든 실루엣 시안 HTML이나 개별 SVG 세트를 실제 게임에 적용하려면 깊이 정렬, 피격 플래시, 인라인 스프라이트 변환, 프레임 최적화가 함께 이루어져야 합니다.
2. **병합 충돌(Merge Conflict) 원천 차단**: 오직 개발 에이전트만 `index.html`, `css/style.css`, `js/renderer.js`를 수정하고 PR을 올리므로 기획 기능과 디자인 리뉴얼이 같은 파일을 건드려도 충돌이 발생하지 않습니다.
3. **교차 검증(Cross-Check) 품질 확보**: 디자이너는 시안 납품 후 개발자가 구현한 결과 화면(`share/dev/` 캡처)을 객관적으로 검수할 수 있어 셀프 리뷰 오류를 방지합니다.
4. **저장소 경량화**: 비교용 무거운 시안 HTML·프리뷰 PNG는 로컬 `share/design/`에만 남기고, 실제 Git 커밋에는 게임 실행에 필수적인 정제된 코드만 반영합니다.

---

## 3. 표준 엔드투엔드(End-to-End) 작업 흐름 (`v0.4.0+` 순차 게이트 필수)

> **필수 원칙 (`v0.4.0`부터 엄격 적용):** 신규 건물·성벽·몬스터·이펙트·UI/SVG가 포함되는 모든 작업은 **반드시 `기획(PM) → 디자인(Designer) → 개발(Developer) → 교차 검수` 순서로 진행**합니다. 디자이너의 `share/design/` 시안·명세 납품 전에는 개발 에이전트가 임의로 조형·SVG·UI를 디자인하여 선행 구현할 수 없습니다. *(예외: 화면 변화가 전혀 없는 순수 내부 로직·세이브 마이그레이션·빌드 스크립트 이슈만 디자인 단계 생략 가능)*

```text
[Gate 1. 기획 & 이슈화 — PM Agent]
  • 코드 읽기 전용 분석 → 구체적 수치·공식 기획서(share/plans/) 작성 및 GitHub 이슈(#N) 등록
  • share/STATUS.md에 스프린트 우선순위 배치 및 디자이너 인계(Design Needed 표시)
        │
        ▼
[Gate 2. 아트 명세 & 시안 납품 — Designer Agent] (PR 생성 X · 개발 착수 선행 조건)
  • 기획서(share/plans/) 및 이슈(#N)를 바탕으로 오브젝트 조형 시안 HTML/Canvas, 신규 SVG 원본,
    레이아웃·컬러·수치 명세를 share/design/에 반드시 선행 납품
  • 중요 신규 외형·UI 시안은 사용자(Owner) 컨펌을 거친 뒤 share/STATUS.md를 Dev Ready로 전환
        │
        ▼
[Gate 3. 통합 코드 이식 & PR 생성 — Developer Agent] (유일한 PR 생성 주체 · 임의 디자인 금지)
  • GitHub 이슈(#N) + share/plans/(기획) + share/design/(확정 시안) 산출물이 모두 준비된 후 착수
  • .worktrees/feature-{N}-{slug} 독립 워크트리에서 시안과 수치를 인게임 코드로 정확히 이식·최적화
  • 구현 전후 비교 캡처를 share/dev/에 저장 → develop 타겟 PR 생성 ("Closes #N") → STATUS.md 갱신
        │
        ▼
[Gate 4. 교차 검수 & 최종 병합 — Designer · PM · User]
  • Designer: share/dev/ 캡처를 원본 시안 및 art-direction.md와 대조해 시각 검수(Visual QA) 수행
  • PM: 기획 수치·공식·밸런스 무결성 검수 수행
  • User (Owner): 최종 확인 후 PR Merge 수행
```
