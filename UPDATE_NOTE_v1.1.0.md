# VeryTerm v1.1.0 Update Note

**Release Date**: 2026-02-07

---

## New Features

### macOS Hide-to-Dock 지원
- X 버튼(창 닫기) 클릭 시 앱이 완전 종료되지 않고 Dock으로 숨김 처리
- 실행 중인 Claude CLI 세션과 개발 서버가 그대로 유지됨
- Dock 아이콘 클릭으로 즉시 복귀 가능
- `⌘Q`로만 완전 종료 (pty 세션 정리 포함)

### 4색 배경 테마 시스템
- Gray / Blue / Green / Purple 4가지 배경 테마 전환 지원
- Blue 테마 어두운 영역 색상 조정 및 폴리싱
- 프롬프트 카드 배경 테마 연동

### 프로젝트 아이콘 자동 감지
- 프로젝트 추가 시 favicon 파일을 자동으로 탐색하여 아이콘 설정
  - `public/favicon.ico`, `public/favicon.png`, `public/favicon.svg`
  - `static/favicon.ico`, `static/favicon.png`
  - `app/favicon.ico` (Next.js 13+)
  - `public/logo.png`, `public/logo.svg`
- 기존 프로젝트도 앱 실행 시 favicon 자동 재감지
- favicon이 없는 프로젝트는 이름 기반 2글자 약어 표시 (예: `my-app` → `MA`)
- 사이드바 펼침/접힘 모두에서 약어 정상 표시

### 프롬프트 MD 파일 다운로드
- 저장된 프롬프트를 Markdown 파일로 내보내기 기능 추가

## Bug Fixes

### 서버 터미널 공백줄 문제 해결
- 서버 터미널 출력에서 불필요한 공백줄이 표시되던 문제 수정

### 사이드패널 접힘 시 아이콘 배열 수정
- 사이드바를 접었을 때 아이콘이 올바르게 정렬되지 않던 문제 수정

---

## Commits

| Commit | Description |
|--------|-------------|
| `7a5c96b` | 창 닫아도 터미널 내용 유지되도록 macOS Hide-to-Dock 패턴 추가 완료 |
| `ab1393e` | 프로젝트 불러올때 아이콘 임의지정 완료: favicon 자동감지 + 2글자 약어 폴백 |
| `c401a34` | 사이드패널 접을때 아이콘 배열 수정완료 |
| `94f38cd` | 서버 공백줄 해결완료 |
| `9c7ccab` | 프롬프트 MD파일 다운로드 기능 추가 완료 |
| `d045307` | 테마 폴리싱: Blue 테마 어두운 영역 색상 조정, 프롬프트 카드 배경 테마 연동 |
| `b738bc1` | 4색 배경 테마 시스템 구현: Gray/Blue/Green/Purple 전환 지원 |
