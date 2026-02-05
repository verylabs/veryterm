# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

VTerm - 바이브 코딩 워크플로우를 위한 멀티 프로젝트 터미널 매니저 데스크탑 앱. 여러 프로젝트에서 Claude CLI 실행, 개발 서버 관리, 프롬프트 히스토리 기록을 한 곳에서 처리한다.

## 명령어

```bash
npm run dev          # 개발 모드 실행 (electron-vite dev)
npm run build        # 프로덕션 빌드 (electron-vite build)
npm run preview      # 빌드 결과 미리보기
npm run typecheck    # 타입 체크 (main + renderer)
npm run lint         # ESLint 실행
```

## 기술 스택

- **Electron 34** + **React 19** + **TypeScript 5**
- **electron-vite**: 빌드 도구 (main/preload/renderer 분리 빌드)
- **xterm.js** + **node-pty**: 터미널 에뮬레이터 (실제 pty)
- **Tailwind CSS v4**: 스타일링 (다크 모드 기본)
- **Zustand**: 상태 관리
- **로컬 JSON 파일**: 데이터 저장 (Electron userData 경로)
- **electron-builder**: 패키징

## 아키텍처

### Electron 프로세스 구조
- **Main Process** (`src/main/`): node-pty 세션 관리, 파일시스템, 네이티브 알림, IPC 핸들러
- **Preload** (`src/preload/`): contextBridge로 API 노출. `window.api`로 접근
- **Renderer** (`src/renderer/`): React UI, xterm.js, Zustand 스토어

### IPC 채널
- `terminal:create/write/resize/kill` — pty 세션 관리
- `terminal:data/exit` — main→renderer 터미널 출력/종료 이벤트
- `dialog:selectFolder` — 폴더 선택 다이얼로그
- `project:detectType/hasCLAUDEmd` — 프로젝트 분석
- `data:load/save` — JSON 파일 영속화

### 레이아웃 구조
```
┌──────────┬─────────────────────────────────┐
│ Sidebar  │  메인 터미널 (Claude CLI)  [40%] │
│ 프로젝트  ├─────────────────────────────────┤
│ 목록      │  서버 터미널 (dev server)  [30%] │
│          ├─────────────────────────────────┤
│          │  프롬프트 히스토리          [30%] │
└──────────┴─────────────────────────────────┘
```

### 핵심 모듈
- **프로젝트 매니저** (`projectStore.ts`): 프로젝트 CRUD, 타입 자동 감지, CLAUDE.md 존재 확인
- **터미널 매니저** (`src/main/index.ts`): node-pty 세션 생성/관리, 프로젝트당 2개 (메인 + 서버)
- **프롬프트 트래커** (`promptStore.ts` + `PromptPanel.tsx`): 입력 캡처, 검색/핀

## 개발 규칙

- 모든 UI는 다크 모드 기본. 라이트 모드는 고려하지 않는다.
- 터미널은 xterm.js + node-pty 조합. 실제 pty를 사용한다.
- Main/Renderer 간 통신은 반드시 IPC(preload의 contextBridge)를 통해서만 한다.
- 프롬프트 히스토리는 터미널 입력을 캡처하여 저장한다. Claude CLI의 내부 API를 사용하지 않는다.
- node-pty 빌드 시 Python setuptools 필요 (Python 3.12+에서 distutils 제거됨. `brew install python-setuptools`).
- 상세 PRD는 `PRD.md` 참고.
