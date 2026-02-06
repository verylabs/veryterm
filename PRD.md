# VeryTerm - PRD (Product Requirements Document)

## 개요

바이브 코딩 워크플로우를 위한 멀티 프로젝트 터미널 매니저. 여러 프로젝트에서 Claude CLI를 실행하고, 개발 서버를 관리하며, 프롬프트 히스토리를 기록하는 데스크탑 애플리케이션.

## 문제 정의

- 여러 프로젝트를 동시에 작업할 때 CLI 터미널을 일일이 열고 닫는 반복 작업이 비효율적
- 개발 서버 시작/중지를 위해 별도 터미널을 관리해야 하는 번거로움
- Claude CLI에 입력한 프롬프트가 기록되지 않아 이전 작업 맥락을 잃어버림

## 기술 스택

- **프레임워크**: Electron
- **프론트엔드**: React + TypeScript
- **터미널 에뮬레이터**: xterm.js
- **스타일링**: Tailwind CSS
- **상태 관리**: Zustand
- **데이터 저장**: SQLite (electron-better-sqlite3) 또는 로컬 JSON 파일
- **빌드 도구**: Vite + electron-builder

## 핵심 기능

### 1. 프로젝트 관리

- 폴더 경로를 지정하여 프로젝트 추가
- Finder에서 폴더 드래그 앤 드롭으로 프로젝트 추가
- 프로젝트 목록 사이드바 (좌측)
- 프로젝트 선택 시 해당 경로로 터미널 세션 자동 연결
- 프로젝트 추가/삭제/순서 변경
- 프로젝트별 상태 표시 (서버 실행 중, Claude 세션 활성 등)
- 프로젝트 타입 자동 감지 (`package.json` 분석 → Next.js, Vite 등 식별 → 서버 명령어 자동 제안)
- 프로젝트별 아이콘 설정 (이모지 또는 이미지)
- **프로젝트 카테고리 분류**: 접이식 카테고리 그룹으로 프로젝트 정리
  - 카테고리 생성/이름 변경(더블클릭)/삭제
  - 드래그 앤 드롭으로 프로젝트를 카테고리에 배치
  - 카테고리 접기/펴기 (▶/▼)
  - 카테고리 삭제 시 소속 프로젝트는 미분류로 이동
  - 카테고리 상태(접힘 여부) 앱 재시작 후에도 유지

### 2. 터미널 레이아웃

프로젝트 선택 시 우측 영역에 3분할 패널 표시:

```
┌──────────┬─────────────────────────────────┐
│          │  메인 터미널 (Claude CLI)        │
│ 프로젝트  │                                 │
│ 목록      ├─────────────────────────────────┤
│          │  서버 터미널 (dev server 등)      │
│          ├─────────────────────────────────┤
│          │  프롬프트 히스토리                 │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

- **메인 터미널**: Claude CLI 실행 전용. 프로젝트 디렉토리에서 자동 시작
- **서버 터미널**: 개발 서버(npm run dev 등) 실행/중지 관리
- **프롬프트 히스토리 패널**: 입력한 프롬프트 목록 표시

### 3. Claude CLI 연동

- 프로젝트 열 때 Claude CLI 자동 시작 옵션 (설정 가능)
- `claude --continue`, `--resume` 세션 이어하기 지원
- 프로젝트의 `CLAUDE.md` 존재 여부 사이드바에 표시
- Claude 응답 로그 저장 (프롬프트 + 응답 쌍으로 기록)

### 4. 프롬프트 히스토리

- 메인 터미널에서 입력한 프롬프트 자동 캡처 및 저장
- Claude 응답도 함께 저장 (프롬프트-응답 쌍)
- 프로젝트별 프롬프트 히스토리 관리
- 타임스탬프와 함께 목록 표시
- 프롬프트 클릭 시 터미널에 자동 입력 (재사용)
- 프롬프트 검색 기능
- 프롬프트 즐겨찾기/핀 기능

### 5. 세션 복원

- 앱 재시작 시 프로젝트별 터미널 상태 복원
- 스크롤백 버퍼 보존
- 마지막으로 열었던 프로젝트 자동 선택
- 서버 터미널 실행 상태 기억 및 재시작 옵션

### 6. 알림 시스템

- 서버 크래시/에러 발생 시 알림 (macOS 네이티브 알림)
- 서버 터미널 에러 감지 및 하이라이트
- Claude CLI 작업 완료 알림 (긴 작업 시 유용)

### 7. 키보드 단축키

- `Cmd+1~9`: 프로젝트 번호로 빠른 전환
- `Cmd+\``: 패널 간 포커스 이동 (메인 터미널 ↔ 서버 터미널)
- `Cmd+N`: 새 프로젝트 추가
- `Cmd+K`: 프롬프트 히스토리 검색
- `Cmd+,`: 설정 열기

### 8. UI/UX

- 다크 모드 기본 테마
- 패널 크기 드래그로 조절 가능 (리사이즈)
- 사이드바 접기/펼치기
- 프로젝트별 아이콘 또는 컬러 태그

## 화면 상세

### 사이드바 (좌측)

```
┌──────────────────┐
│ Projects  [+]  ◀ │  ← 프로젝트 추가 / 사이드바 접기
│──────────────────│
│ 🟢 프로젝트A   ⚙ │  ← 미분류 프로젝트
│ ⚫ 프로젝트B   ⚙ │
│──────────────────│
│ ▼ 바이브코딩  2 ✕ │  ← 카테고리 (접기/펴기, 프로젝트 수, 삭제)
│   🔵 프로젝트C ⚙ │
│   📋 프로젝트D ⚙ │
│ ▶ 업무        1   │  ← 접힌 카테고리
│──────────────────│
│ + 카테고리 추가    │
│──────────────────│
│ 4 projects   ⌘B  │
└──────────────────┘
```

- 프로젝트를 카테고리 헤더로 드래그하여 분류
- 카테고리 이름 더블클릭으로 이름 변경
- 접힌 사이드바(48px)에서는 카테고리 무시, 프로젝트 dot만 표시

### 메인 영역 (우측)

- 상단: 메인 터미널 (전체 높이의 약 40%)
- 중단: 서버 터미널 (전체 높이의 약 30%)
- 하단: 프롬프트 히스토리 (전체 높이의 약 30%)
- 각 패널 사이 드래그 핸들로 높이 조절 가능

## 데이터 모델

### Category

```typescript
interface Category {
  id: string;
  name: string;
  collapsed: boolean;        // 접힘 상태
}
```

### Project

```typescript
interface Project {
  id: string;
  name: string;
  path: string;              // 프로젝트 폴더 경로
  color?: string;            // 사이드바 컬러 태그
  icon?: string;             // 이모지 또는 data URI 이미지
  category?: string;         // Category ID (없으면 미분류)
  serverCommand?: string;    // 서버 실행 명령어 (예: "npm run dev")
  projectType?: string;      // 자동 감지된 프로젝트 타입 (next, vite, cra 등)
  autoStartClaude?: boolean; // 프로젝트 열 때 Claude CLI 자동 시작
  hasCLAUDEmd?: boolean;     // CLAUDE.md 존재 여부
  createdAt: Date;
  updatedAt: Date;
}
```

### PromptHistory

```typescript
interface PromptHistory {
  id: string;
  projectId: string;
  prompt: string;
  response?: string;    // Claude 응답 내용
  timestamp: Date;
  pinned: boolean;
}
```

### SessionState

```typescript
interface SessionState {
  projectId: string;
  lastActiveAt: Date;
  scrollbackBuffer?: string;  // 터미널 스크롤백 버퍼
  serverRunning: boolean;
  serverCommand?: string;
}
```

## 데이터 저장 형태 (`projects.json`)

```json
{
  "projects": [
    { "id": "...", "name": "...", "category": "cat-1", "icon": "🚀", ... },
    { "id": "...", "name": "...", ... }
  ],
  "categories": [
    { "id": "cat-1", "name": "바이브 코딩", "collapsed": false },
    { "id": "cat-2", "name": "업무", "collapsed": true }
  ],
  "activeProjectId": "..."
}
```

## 개발 단계

### Phase 1 - MVP

- [x] Electron + React + TypeScript 프로젝트 셋업
- [x] 다크 모드 기본 UI 레이아웃
- [x] 프로젝트 추가/삭제/목록 표시
- [x] xterm.js 기반 터미널 2개 (메인 + 서버)
- [x] 프로젝트 선택 시 해당 경로에서 터미널 세션 시작
- [x] 프롬프트 히스토리 기본 저장 및 표시
- [x] 기본 키보드 단축키 (프로젝트 전환, 패널 포커스)

### Phase 2 - 개선

- [x] 패널 리사이즈 (드래그)
- [x] 프롬프트 검색 및 즐겨찾기
- [ ] Claude 응답 로그 저장
- [x] 프로젝트별 서버 명령어 설정
- [x] 프로젝트 타입 자동 감지 및 서버 명령어 제안
- [ ] 프로젝트 상태 표시 (서버 실행 중 등)
- [x] 사이드바 접기/펼치기
- [x] 폴더 드래그 앤 드롭으로 프로젝트 추가
- [x] 레이아웃 3종 전환 (rows / right-split / cols)
- [x] 레이아웃 설정 자동 저장

### Phase 3 - 고도화

- [ ] 세션 복원 (앱 재시작 시 상태 유지)
- [ ] 서버 크래시/에러 알림 (macOS 네이티브)
- [ ] Claude CLI 연동 강화 (--continue, --resume, CLAUDE.md 감지)
- [ ] 프롬프트 히스토리 내보내기 (Markdown)
- [ ] 터미널 탭 추가 (2개 이상 터미널)
- [x] 프로젝트 카테고리 그룹핑 (접이식, 드래그 앤 드롭 분류)
- [ ] 글로벌 단축키
- [ ] 자동 업데이트
