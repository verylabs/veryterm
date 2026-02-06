<p align="center">
  <img src="build/icon-round.png" alt="VeryTerm" width="128" />
</p>

<h1 align="center">VeryTerm</h1>

<p align="center">
  <strong>바이브 코더를 위한 멀티 프로젝트 터미널 매니저</strong><br/>
  랩탑에서 여러 프로젝트를 바이브 코딩으로 작업하는 개발자를 위해 만들었습니다.<br/>
  Claude Code, Codex 등 CLI 도구와 개발 서버를 한 화면에서 관리하세요.
</p>

<p align="center">
  <a href="#다운로드">다운로드</a> &middot;
  <a href="#주요-기능">주요 기능</a> &middot;
  <a href="#소스에서-빌드">소스에서 빌드</a> &middot;
  <a href="README.md">English</a>
</p>

---

## 이런 불편함, 겪어봤죠?

Claude Code나 Codex 같은 CLI로 바이브 코딩하다 보면:

- 프로젝트가 늘어날수록 십수 개의 터미널 창이 여기저기 널려있음
- 개발 서버가 흩어져 있어서 뭐가 실행 중인지 헷갈림
- 지난주에 쓴 완벽한 프롬프트? 이미 사라짐
- 프로젝트 전환할 때마다 흐름이 끊김

**VeryTerm은 이 모든 걸 한 곳에서 해결합니다.**

## 주요 기능

### 멀티 프로젝트 워크스페이스

`Cmd+1-9`로 프로젝트를 즉시 전환. 각 프로젝트마다 독립된 터미널 세션이 제공됩니다.

### 프로젝트당 듀얼 터미널

모든 프로젝트에 2개의 터미널이 기본 제공:

- **CLI 터미널** — Claude Code, Codex 등 CLI 도구용. 프로젝트 열 때 자동 시작 가능.
- **서버 터미널** — `npm run dev`, `cargo watch` 등 개발 서버 실행. 프로젝트당 **다중 서버 탭** 지원.

### 프롬프트 히스토리

CLI 터미널에 입력한 모든 프롬프트가 **프로젝트별로 자동 저장**됩니다. 검색, 핀 고정, 재사용 가능. 좋은 프롬프트를 다시는 잃어버리지 마세요.

### 서버 프로세스 감지

프로세스 감지를 통한 실시간 서버 상태 추적. 사이드바의 녹색 인디케이터로 어떤 프로젝트에 서버가 실행 중인지 한눈에 파악.

### 키보드 중심 설계

| 단축키 | 동작 |
|--------|------|
| `Cmd+1-9` | 프로젝트 전환 |
| `Cmd+B` | 사이드바 토글 |
| `Tab` | CLI와 서버 간 포커스 전환 |
| `Cmd+N` | 프로젝트 추가 |
| `Cmd+K` | 프롬프트 검색 |

### 기타 기능

- **다크 모드 전용** — 라이트 모드 없음
- **드래그 앤 드롭** — Finder에서 폴더를 끌어다 놓으면 프로젝트 추가
- **카테고리 그룹** — 접이식 카테고리로 프로젝트 정리
- **패널 리사이즈** — 드래그로 CLI, 서버, 프롬프트 패널 크기 조절
- **3가지 레이아웃** — 행, 열, 우측 분할 모드
- **macOS 네이티브 알림** — CLI 작업 완료 시 알림
- **자동 업데이트** — 항상 최신 버전 유지
- **코드 서명 및 공증** — macOS Gatekeeper 경고 없음

## 스크린샷

**사이드바 펼침** — Project Sidebar, CLI Terminal, Multi Server Terminal, Prompt History

![VeryTerm - Expanded](docs/screenshot-expanded.png)

**사이드바 접힘** — 터미널 영역 최대화

![VeryTerm - Collapsed](docs/screenshot-collapsed.png)

## 다운로드

[Releases](https://github.com/verylabs/veryterm/releases) 페이지에서 최신 `.dmg`를 다운로드하세요.

> macOS 전용 (Apple Silicon). Windows/Linux는 아직 지원하지 않지만 기여는 환영합니다.

## 소스에서 빌드

### 사전 요구사항

- Node.js 18+
- Python 3.12+ 및 setuptools (`brew install python-setuptools`)
  - `node-pty` 네이티브 모듈 빌드에 필요

### 설치

```bash
git clone https://github.com/verylabs/veryterm.git
cd veryterm
npm install
```

### 개발

```bash
npm run dev          # 개발 모드 실행
npm run build        # 프로덕션 빌드
npm run typecheck    # 타입 체크
npm run lint         # ESLint 실행
```

### DMG 빌드

```bash
npm run build && npx electron-builder --mac dmg
```

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Electron 34 |
| 프론트엔드 | React 19 + TypeScript 5 |
| 터미널 | xterm.js + node-pty (실제 PTY) |
| 스타일링 | Tailwind CSS v4 |
| 상태 관리 | Zustand |
| 빌드 | electron-vite + electron-builder |
| 데이터 | 로컬 JSON 파일 (Electron userData) |

## 아키텍처

```
src/
├── main/           # 메인 프로세스: node-pty, IPC 핸들러, 네이티브 API
├── preload/        # contextBridge: window.api 노출
└── renderer/       # React UI, xterm.js, Zustand 스토어
    └── src/
        ├── components/   # ProjectView, Sidebar, Titlebar 등
        ├── stores/       # projectStore, promptStore, uiStore
        └── types/        # TypeScript 인터페이스
```

## 기여하기

VeryTerm은 오픈소스입니다. 자유롭게 포크하고 수정해서 사용하세요.

1. 리포지토리 포크
2. 피처 브랜치 생성 (`git checkout -b feature/awesome`)
3. 변경사항 커밋
4. 브랜치에 푸시
5. Pull Request 생성

재배포 시 원본 프로젝트 출처를 명시해 주세요.

## 만든 사람

**VeryTerm**은 [VeryLabs](https://www.verylabs.io)의 대표 **Bryan KO**가 직접 만들었습니다.

여러 프로젝트를 오가며 바이브 코딩하다가 매일 겪는 불편함을 해소하기 위해 탄생했습니다. Claude Code나 Codex로 5개 이상의 프로젝트를 관리하고 있다면, 이 도구가 딱입니다.

## 바이브 코딩으로 제작

이 프로젝트는 Claude Code CLI 모드에서 100% 바이브 코딩으로 만들어졌습니다.

## 라이선스

MIT License - [LICENSE](LICENSE) 파일 참고.
