# GitHub 중심 협업 및 역할 식별 소통 가이드 (`agents/github-communication-guide.md`)

본 문서는 **OUTPOST ZERO (`Reve1988/zombi-servivior`)** 프로젝트에서 **기획자(PM) · 디자이너(Designer) · 개발자(Developer) · 오너(Owner)** 간의 모든 공식 대화를 **GitHub 저장소(Issues · PR · Project #1 · Milestones · Wiki)** 중심으로 일원화하고, 단일 GitHub 계정(`Reve1988`) 환경에서도 작성 주체를 한눈에 식별하기 위한 표준 규약입니다.

---

## 1. 소통 채널 일원화 원칙 (`GitHub 중심 + share/ 첨부함`)

| 채널 | 공식 역할 | 언제 사용하나요? |
| :--- | :--- | :--- |
| **GitHub Issues & PR 댓글** | **공식 대화·인계·컨펌·QA 스레드** | 기획 전달, 시안 납품 보고, 오너 컨펌, 개발 착수/PR 보고, 시각/밸런스 검수(`Pass`/수정 요청), 스펙 건의 |
| **[GitHub Project #1](https://github.com/users/Reve1988/projects/1)** | **실시간 단계(칸반) & 담당자 현황판** | 이슈가 어느 게이트(`Gate 2→3→4→Done`)에 있고 누가 처리 중인지 추적 |
| **[GitHub Milestones](https://github.com/Reve1988/zombi-servivior/milestones)** | **버전 목표 & 달성률 관리** | `v0.4.0`, `v0.5.0` 버전별 포함 범위와 전체 완료율 확인 |
| **[GitHub Wiki](https://github.com/Reve1988/zombi-servivior/wiki)** | **웹 열람용 최신 기획·워크플로 백과** | PM이 주요 기획서·로드맵·워크플로를 요약 게시해 오너님이 웹에서 즉시 열람 |
| **로컬 `share/` 폴더** | **대용량·실행형 산출물 첨부함** (`.gitignore`) | GitHub 마크다운에 띄울 수 없는 **HTML/Canvas 복셀 시안, SVG 원본, PNG 전후 캡처, 상세 수치 명세** 보관 *(업로드 후 반드시 GitHub 이슈 코멘트로 요약 전달!)* |

> **핵심 변화**: 이제 에이전트 간 길고 복잡한 전달문 전체를 채팅창으로 복사·전달하지 않아도 됩니다. **GitHub 이슈/PR 스레드 + Project #1 + 게이트 라벨**을 단일 대화창으로 사용하고, 채팅창에서는 짧은 호출만 주고받습니다.

---

## 2. 단일 계정(`Reve1988`) 역할 표시 규칙 (필수)

기획·디자인·개발 에이전트가 모두 동일한 `Reve1988` 계정으로 `gh` CLI를 사용하므로, **에이전트가 작성하는 모든 GitHub 글(이슈 본문, 이슈 코멘트, PR 본문, PR 코멘트)은 반드시 첫 줄(`Line 1`)에 역할 헤더를 명시**합니다.

### 2.1 댓글 / 본문 첫 줄 필수 역할 헤더

| 작성 에이전트 | 첫 줄 필수 헤더 형식 (`Line 1`) | 대상 지정(`→ @...`) 예시 |
| :--- | :--- | :--- |
| **기획자 (PM)** | `### 📋 [기획자 / PM] → @{대상}` *(단독 보고 시 `### 📋 [기획자 / PM]`)* | `### 📋 [기획자 / PM] → @디자이너` |
| **디자이너 (Designer)** | `### 🎨 [디자이너 / Designer] → @{대상}` *(단독 보고 시 `### 🎨 [디자이너 / Designer]`)* | `### 🎨 [디자이너 / Designer] → @오너 @개발자` |
| **개발자 (Developer)** | `### 🛠️ [개발자 / Developer] → @{대상}` *(단독 보고 시 `### 🛠️ [개발자 / Developer]`)* | `### 🛠️ [개발자 / Developer] → @디자이너 @기획자 @오너` |
| **오너 (Owner)** | **말머리 없음 (일반 댓글 그대로 작성)** *(원하시면 `[오너]` 표기 가능)* | **역할 배지가 없는 댓글 = 오너의 직접 지시/컨펌으로 자동 인식** |

- **대상 멘션 규약**: `@기획자`, `@디자이너`, `@개발자`, `@오너`, `@전체`처럼 **한글 역할명**을 사용해 실제 타인 GitHub ID 오호출을 막고 누구에게 보낸 메시지인지 분명히 적습니다.
- **이모지 적용 범위**: GitHub 이슈·PR·위키는 **GitHub 협업 메타데이터**이므로 역할 배지(`📋`·`🎨`·`🛠️`)를 허용합니다. *(인게임 런타임 HTML/CSS/JS 내 OS 이모지 금지 규칙 `#9`는 그대로 엄격히 유지됩니다.)*

### 2.2 이슈 · PR · 커밋 제목 말머리 규칙

| 항목 | 제목 규칙 | 작성 예시 |
| :--- | :--- | :--- |
| **기획 이슈 (PM)** | `[기획/{영역} {페이즈}-{순번}] ...` 또는 `[밸런스/{영역}] ...` | `[기획/성장·인프라 2-8] 전력·숙소 4단 업그레이드...` |
| **디자인 이슈 (Designer)** | `[Art] ...` 또는 `[UI] ...` | `[Art] 건물 실루엣 구분이 어려움` |
| **개발 등록 이슈 (Developer)** | `[개발/{영역}] ...` *(인프라·버그·리팩토링 제안 시)* | `[개발/인프라] 거대 단일 모듈 도메인별 파일 분할...` |
| **Pull Request 제목 (Developer)** | **`[개발자] {type}: [#{issueNumber}] {요약}`** | `[개발자] feat: [#51] 전력·숙소 4단 업그레이드 구현` |
| **Git 커밋 메시지** | 기존 `github-gitflow.md` 표준 유지 (`{type}: [#N] ...`) | `feat: [#51] 전력·숙소 4단 업그레이드 구현` |

---

## 3. 게이트별 표준 GitHub 대화 시퀀스 (`Gate 1 → 4`)

### 작업 시작 전 필수 루틴 (모든 에이전트 공통)
1. **보드 & 이슈 목록 확인**: `gh project item-list 1 --owner Reve1988` 또는 `gh issue list --repo Reve1988/zombi-servivior --state open`으로 본인 담당 게이트 확인
2. **스레드 정독 필수**: 작업할 이슈/PR 번호를 **`gh issue view <N> --repo Reve1988/zombi-servivior --comments`** (또는 `gh pr view <M> --comments`)로 읽어 **오너의 최신 댓글**과 타 에이전트의 전달사항을 확인
3. **로컬 첨부물 확인**: 코멘트에 적힌 `share/plans/`, `share/design/`, `share/dev/` 파일 열람

### 단계별 표준 코멘트 템플릿

#### ① Gate 1 (PM → `@디자이너` 또는 `@개발자`)
- 이슈 생성 시 본문 맨 위를 `### 📋 [기획자 / PM] → @디자이너` (무조형 건은 `@개발자`)로 시작하고, 해당 **Milestone** + 라벨(`gate:2-design` 또는 `gate:3-dev-ready`) + **Project #1** 배치(`Status`, `담당`, `스프린트`)까지 한 번에 완료합니다.

#### ② Gate 2 시안 납품 (Designer → `@오너 @개발자`)
- 디자이너는 `share/design/`에 시안 HTML/SVG/PNG를 저장한 뒤, **해당 GitHub 이슈 `#N`에 아래 형식의 코멘트**를 남기고 Project `#1`의 `담당 (Agent)`를 `Owner (최종 승인)`으로 전환합니다.
```markdown
### 🎨 [디자이너 / Designer] → @오너 @개발자

`Gate 2` 시안 및 아트 명세 납품 완료했습니다. 오너님 컨펌 후 개발 착수 부탁드립니다.

- **시안 파일(`share/`)**: `share/design/phase2-tier-evolution.html` (`.md` · `previews/phase2-tier-evolution-color.png`)
- **핵심 구현 포인트**:
  1. `getStructVisualTopZ(id, level)` 티어별 높이표 반영
  2. 무전력 5종 청록(`#5EF2FF`) 0px 유지, 8종 진화 건물 `Lv.`/`◆◆` 마름모 제거
```

#### ③ 오너 컨펌 (`Owner` → `@개발자` / `@기획자`)
- 오너님은 이슈 `#N` 아래에 일반 댓글로 편하게 의견을 남깁니다 (예: `"컨펌 완료! #51 개발 진행해줘"` 또는 `"태양광 T4 크기만 조금 키워줘"`).
- PM(또는 개발자 확인 후)은 컨펌이 확인되면 이슈 라벨을 `gate:2-design` → **`gate:3-dev-ready`** 로, Project `#1` `Status`를 **`🛠️ Gate 3: Dev Ready (개발 대기)`** 로 변경합니다.

#### ④ Gate 3 구현 & PR 생성 (Developer → `@디자이너 @기획자 @오너`)
- 개발 착수 시 Project `#1` `Status`를 **`⚙️ In Progress (개발 중)`** 으로 옮깁니다.
- PR 생성 시 제목은 `[개발자] {type}: [#{issueNumber}] {요약}`, 본문 첫 줄은 **`### 🛠️ [개발자 / Developer] → @디자이너 @기획자 @오너`** 로 시작합니다.
- `develop` 반영 및 `share/dev/` 전후 캡처 저장 후, **원본 이슈 `#N`에도 코멘트**를 남기고 라벨 `gate:4-qa` + Project `#1` `🔍 Gate 4: QA (시각·밸런스 검수)` (`담당: Designer` / `PM`)로 전환합니다.

#### ⑤ Gate 4 교차 검수 (Designer · PM → `@오너`)
- 디자이너(`### 🎨 [디자이너 / Designer] → @오너`)와 PM(`### 📋 [기획자 / PM] → @오너`)이 각각 이슈 `#N`(또는 PR)에 시각·밸런스 검수 결과를 코멘트로 남깁니다.
- 양측 모두 `Pass` 시 라벨을 **`status:merged-dev`**, Project `#1` `Status`를 **`✅ Done (검수 완료)`** (`담당: Owner`)로 전환합니다.

#### 💡 역방향 질문 · 수정 건의 (개발자/디자이너 ↔ 기획자)
- 구현이나 디자인 도중 스펙 모순·밸런스 조정 필요가 발견되면 해당 이슈 `#N`에 `### 🛠️ [개발자 / Developer] → @기획자 @오너` (또는 신규 `[개발/...]` 이슈)로 근거와 대안을 남깁니다.

---

## 4. 오너(Owner) 실전 사용 팁

1. **GitHub 웹/모바일에서 댓글 달기**: 이슈 페이지 맨 아래 댓글창에 **별도 양식 없이 평소 말투로 적고 `Comment` 버튼**만 누르시면 모든 에이전트가 **오너 지시**로 인식합니다.
2. **에이전트 채팅창에서는 1줄만 지시**:
   - 기획자에게: `"GitHub #51 댓글 확인하고 스펙/보드 반영해줘"`
   - 디자이너에게: `"GitHub 보드에서 Gate 2 / Gate 4 담당 이슈 확인하고 진행해줘"`
   - 개발자에게: `"GitHub 보드에서 Dev Ready 이슈 확인하고 코멘트 읽은 뒤 진행해줘"`

---

## 5. `gh` CLI 필수 실행 수칙 (Windows PowerShell 기준)

1. **UTF-8 파일 입력(`--body-file`) 필수**: 한글·백틱·마크다운 표가 깨지지 않도록 반드시 저장소 밖 스크래치 폴더에 UTF-8 `.md` 파일을 만든 뒤 `--body-file`로 전달합니다.
2. **Project #1 & 라벨 동기화 명령**:
```powershell
# 이슈 댓글 및 본문 확인
gh issue view 51 --repo Reve1988/zombi-servivior --comments

# 역할 코멘트 등록
gh issue comment 51 --repo Reve1988/zombi-servivior --body-file "<scratch>/comment.md"

# 게이트 라벨 변경
gh issue edit 51 --repo Reve1988/zombi-servivior --remove-label "gate:2-design" --add-label "gate:3-dev-ready"

# Project #1 칸반 카드 상태·담당 이동
gh project item-edit 1 --owner Reve1988 --url "https://github.com/Reve1988/zombi-servivior/issues/51" --field "Status" --value "🛠️ Gate 3: Dev Ready (개발 대기)"
gh project item-edit 1 --owner Reve1988 --url "https://github.com/Reve1988/zombi-servivior/issues/51" --field "담당 (Agent)" --value "Developer (개발)"
```
