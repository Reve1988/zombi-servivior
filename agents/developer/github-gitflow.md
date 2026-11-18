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

## 3. 이슈 기반 개발 및 `git worktree` 워크플로우

복수의 개발 에이전트가 동시에 서로 다른 이슈를 작업하더라도 브랜치와 작업 파일이 섞이지 않도록, **모든 개발 작업은 반드시 `git worktree`를 사용해 독립된 작업 디렉토리에서 진행**합니다.

### 3.1 작업 시작 (Project #1 / Issue 코멘트 확인 → `git worktree` 생성)
1. [github-communication-guide.md](../github-communication-guide.md)에 따라 Project #1(`gh project item-list 1 --owner Reve1988`)에서 `gate:3-dev-ready` 이슈를 확인하고, **착수 전 반드시 `--comments`로 오너(일반 댓글)·디자이너·기획자의 최신 지시를 정독**한 뒤 Project #1 `Status`를 `⚙️ In Progress (개발 중)`으로 전환합니다.
   ```powershell
   gh project item-list 1 --owner Reve1988
   gh issue view <issueNumber> --repo Reve1988/zombi-servivior --comments
   ```
2. 루트 저장소(`zombi-servivior/`)의 체크아웃 브랜치(`develop`)는 직접 변경하지 않고, 원격 정보를 최신화한 뒤 `.worktrees/` 하위에 이슈 전용 워크트리와 `feature` 브랜치를 동시에 생성합니다.
   - *(예외: Antigravity 서브에이전트/스웜의 `workspace: "share"` 등 이미 시스템 차원에서 분리된 워크트리를 할당받은 에이전트는 현재 할당된 워크스페이스에서 바로 브랜치를 생성해 작업할 수 있습니다.)*
   ```powershell
   git fetch origin
   git worktree add -b feature/<issueNumber>-<short-slug> .worktrees/feature-<issueNumber>-<short-slug> origin/develop
   ```
   - `release/*` 작업 시: `git worktree add -b release/v<X.Y.Z> .worktrees/release-v<X.Y.Z> origin/develop`
   - `hotfix/*` 작업 시: `git worktree add -b hotfix/<issueNumber>-<short-slug> .worktrees/hotfix-<issueNumber>-<short-slug> origin/main`
3. 코드 수정, 구문/동작 검증, 스테이징(`git add`), 커밋(`git commit`), 푸시(`git push`)는 모두 **생성한 해당 워크트리 경로(`.worktrees/feature-<issueNumber>-<short-slug>`) 내부**에서 수행합니다.
   - 참고: `.worktrees/` 경로는 `.gitignore`에 등록되어 있어 루트 디렉토리의 Git 상태에 영향을 주지 않습니다.

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

### 3.3 원격 푸시, PR 생성 (`develop` 타겟) 및 워크트리 정리
1. 해당 워크트리 디렉토리에서 작업 및 검증이 완료되면 원격 저장소에 `feature` 브랜치를 푸시합니다.
   ```powershell
   git -C .worktrees/feature-<issueNumber>-<short-slug> push -u origin feature/<issueNumber>-<short-slug>
   ```
2. `gh pr create`를 사용해 **`develop` 브랜치를 타겟(`--base develop`)** 으로 Pull Request를 생성합니다. (**PR 제목에는 `[개발자]` 말머리, PR 본문·이슈 보고 코멘트 첫 줄에는 `### 🛠️ [개발자 / Developer] → @디자이너 @기획자 @오너`를 반드시 포함**하며 한글 깨짐 방지를 위해 UTF-8 `--body-file`을 사용합니다.)
   ```powershell
   gh pr create --base develop --head feature/<issueNumber>-<short-slug> --title "[개발자] feat: [#<issueNumber>] <issueName>" --body-file "<scratch>/pr_<issueNumber>.md"
   ```
   - PR 생성(`develop` 반영) 및 `share/dev/` 캡처 저장 후에는 원본 이슈 `#<issueNumber>`에도 구현 요약 + 캡처 경로 코멘트를 남기고, 라벨을 `gate:4-qa`로, Project #1 `Status`를 **`🔍 Gate 4: QA (시각·밸런스 검수)`** 로 전환합니다. *(신규 이슈를 개발자가 직접 제안/등록할 때는 `[개발/{영역}]` 제목 + 첫 줄 `### 🛠️ [개발자 / Developer] → @기획자 @오너`를 사용합니다.)*
3. **권한 경계 (중요)**:
   - 개발 에이전트는 **PR 생성까지만 직접 수행**하고 사용자에게 PR 링크와 요약 결과를 보고합니다.
   - **코드 리뷰 및 머지(`merge`)는 사용자가 직접 진행**합니다. 에이전트는 사용자의 명시적 지시 없이 `gh pr merge`를 실행하거나 `main` / `develop` 브랜치에 직접 커밋·푸시하지 않습니다.
4. **워크트리 유지 및 정리**:
   - PR 리뷰 대기 중에는 추가 피드백 수정에 바로 대응할 수 있도록 해당 워크트리를 그대로 두어도 무방합니다(다른 에이전트의 워크트리와 간섭 없음).
   - PR이 `develop`에 최종 병합된 이후 더 이상 작업이 필요 없다면 아래 명령어로 워크트리를 깔끔하게 제거합니다.
   ```powershell
   git worktree remove .worktrees/feature-<issueNumber>-<short-slug>
   git worktree prune
   ```

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
