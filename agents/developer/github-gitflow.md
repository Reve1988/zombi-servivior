# GitHub & GitFlow 운영 규칙 (`github-gitflow.md`)

모든 에이전트는 GitHub 작업 시 본 문서의 **GitHub CLI (`gh`) + 정통 GitFlow 표준**을 엄격히 준수합니다.

---

## 1. 저장소 및 `gh` CLI 환경

- **원격 저장소**: `https://github.com/Reve1988/zombi-servivior.git` (`Reve1988/zombi-servivior`)
- **GitHub 상호작용 도구**: 로컬에 설치된 **GitHub CLI (`gh`)** 를 사용합니다.
  - 기본 명령어: `gh ...`
  - 만약 터미널 세션의 `PATH` 환경변수가 아직 갱신되지 않아 `gh`를 찾지 못하는 경우, Windows 기본 설치 경로인 `& 'C:\Program Files\GitHub CLI\gh.exe'` 로 실행합니다.

---

## 2. 브랜치 전략 (정통 GitFlow 5종 표준)

명시적으로 예외를 두지 않은 모든 분기·병합 규칙은 **GitFlow 표준**(`--no-ff` Merge Commit 이력 보존 등)을 따릅니다.

| 브랜치 종류 | 명명 규칙 | 분기 기준 (Base) | 병합 대상 (Target) | 역할 및 운용 기준 |
| :--- | :--- | :---: | :---: | :--- |
| **`main`** | `main` | - | - | **정식 배포(Production) 브랜치**. 항상 안정된 배포 상태만 유지하며 **GitHub Pages 라이브 서비스 기준 브랜치**로 사용합니다. 모든 배포 커밋에는 버전 태그(`vX.Y.Z`)를 부여합니다. |
| **`develop`** | `develop` | `main` | - | 다음 릴리즈를 위한 **개발 통합 브랜치**. 모든 일상적인 기능 개발의 기준점이 됩니다. |
| **`feature`** | `feature/{issueNumber}-{slug}` | `develop` | `develop` | 이슈 단위 신규 기능·개선 작업 브랜치 (예: `feature/12-turret-upgrade`). |
| **`release`** | `release/v{X.Y.Z}` | `develop` | `main` & `develop` | 새 버전 배포 준비용 임시 브랜치. 인게임 버전(`ZS.DATA.VERSION`) 갱신 및 배포 전 버그 수정만 수행하며, 배포 완료 후 `main`과 `develop` 양쪽에 반영하고 브랜치를 정리합니다. |
| **`hotfix`** | `hotfix/{issueNumber}-{slug}` | `main` | `main` & `develop` | 라이브(`main`)에서 발생한 긴급 버그 패치 브랜치. 인게임 패치 버전을 올리고 수정한 뒤 `main`과 `develop` 양쪽에 반영합니다. |

> **GitHub Pages 연동 원칙**: GitFlow에서 `release/vX.Y.Z`는 버전마다 생성 후 병합·삭제되는 임시 브랜치이고 `hotfix/*`는 `main`으로 직접 병합되므로, GitHub Pages 배포 소스는 **`main` 브랜치**로 고정합니다. `release` 또는 `hotfix` 검증이 끝나 `main`에 머지되는 즉시 라이브 페이지가 새 버전으로 자동 갱신됩니다.

---

## 3. 이슈 기반 개발 및 PR 워크플로우

### 3.1 작업 시작 (Issue 확인 → `feature` 브랜치 분기)
1. 기획·디자인 에이전트가 등록한 이슈를 조회하여 요구사항과 인수 조건을 파악합니다.
   ```powershell
   gh issue list
   gh issue view <issueNumber>
   ```
2. `develop` 브랜치를 최신 상태로 동기화한 뒤 `feature` 브랜치를 생성합니다.
   ```powershell
   git checkout develop
   git pull origin develop
   git checkout -b feature/<issueNumber>-<short-slug>
   ```

### 3.2 커밋 메시지 컨벤션 (필수 준수)
커밋 메시지는 반드시 아래 형식을 따릅니다.

```text
{type}: [#{issueNumber}] {issueName}
- {detailMessage1}
- {detailMessage2}
```

- **사용 가능한 `{type}`**:
  - `feat`: 새로운 기능, 건물, 유닛, UI 요소 추가 (`기본`)
  - `fix`: 버그 및 오류 수정
  - `refactor`: 기능 변화 없는 코드 구조 개선
  - `style`: CSS 스타일·레이아웃·코드 포맷팅 수정
  - `docs`: 문서(`README.md`, `agents/` 등) 수정
  - `chore`: 설정, 빌드, 기타 유지보수
  - `release`: 버전 번호 갱신 및 릴리즈 준비 커밋
- **작성 예시**:
  ```text
  feat: [#14] 포탑 3단계 강화 시스템 구현
  - 발칸·유탄·EMP 자동포탑 단계별 화력 및 외형 업그레이드 로직 추가
  - 시설 조회 패널 내 강화 비용 표시 및 강화 버튼 UI 연동
  ```

### 3.3 원격 푸시 및 PR 생성 (`develop` 타겟)
1. 작업 및 검증이 완료되면 원격 저장소에 `feature` 브랜치를 푸시합니다.
   ```powershell
   git push -u origin feature/<issueNumber>-<short-slug>
   ```
2. `gh pr create`를 사용해 **`develop` 브랜치를 타겟(`--base develop`)** 으로 Pull Request를 생성합니다.
   ```powershell
   gh pr create --base develop --head feature/<issueNumber>-<short-slug> --title "feat: [#<issueNumber>] <issueName>" --body "Closes #<issueNumber>`n`n## 변경 사항`n- ...`n`n## 확인 내역`n- ..."
   ```
3. **권한 경계 (중요)**:
   - 개발 에이전트는 **PR 생성까지만 직접 수행**하고 사용자에게 PR 링크와 요약 결과를 보고합니다.
   - **코드 리뷰 및 머지(`merge`)는 사용자가 직접 진행**합니다. 에이전트는 사용자의 명시적 지시 없이 `gh pr merge`를 실행하거나 `main` / `develop` 브랜치에 직접 커밋·푸시하지 않습니다.

---

## 4. 버전 태깅 및 GitHub 릴리즈 규칙

배포(`release/vX.Y.Z` → `main` 또는 `hotfix` → `main`) 시 다음 사항을 반드시 지킵니다.

1. **시맨틱 버저닝 (`vMAJOR.MINOR.PATCH`)**:
   - 초기 기준 버전: `v0.1.0`
   - 신규 기능 배포(`release`): `MINOR` 상승 (예: `v0.2.0`)
   - 긴급 버그 수정(`hotfix`): `PATCH` 상승 (예: `v0.2.1`)
2. **인게임 버전 동기화**:
   - `js/data.js` 파일의 `ZS.DATA.VERSION` 값을 새 태그명(예: `'v0.2.0'`)과 일치하도록 수정하여 커밋합니다.
3. **Git 태그 및 GitHub 릴리즈 노트 동시 생성**:
   - `main` 브랜치 병합 완료 후 해당 커밋에 버전 태그와 릴리즈 노트를 함께 생성합니다.
   ```powershell
   gh release create v0.2.0 --target main --title "v0.2.0 — <릴리즈 요약>" --notes "## 주요 변경 사항`n- ...`n`n## 수정된 오류`n- ..."
   ```
