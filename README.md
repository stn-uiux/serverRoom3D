<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Three.js-0.182-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Zustand-5-F36D00?style=for-the-badge" alt="Zustand" />
</p>

# 🏢 Server Room 3D

> **인터랙티브 3D 서버실 시각화 및 장비 관리 시스템**
>
> 브라우저에서 실행되는 WebGL 기반 3D 서버실 환경을 구축하고,
> 랙·장비·포트를 직관적으로 배치·관리·모니터링할 수 있는 풀스택 프론트엔드 애플리케이션입니다.

---

## ✨ 주요 기능

### 🖥️ 3D 서버실 환경
- **React Three Fiber** 기반 실시간 3D 렌더링
- 랙, 벽, 파티션, 조명 등 빌트인 오브젝트 배치
- GLB/GLTF 커스텀 3D 모델 임포트 지원
- 마우스 기반 오브젝트 이동·회전·스케일 조작 (Gizmo)
- 카메라 자동 포커싱 및 Fit-to-Scene

### 📦 랙 & 장비 관리
- **24U / 32U / 48U** 표준·와이드 랙 생성
- 드래그 앤 드롭 기반 장비 배치
- 장비 등록(CRUD) 모달 — IP, MAC, 모델명, 벤더 등 상세 속성 관리
- SVG 기반 장비 전면 패널 시각화

### 🔌 포트 & 모듈 시스템
- **인터랙티브 포트 호버/클릭** — 포트 상태 실시간 확인
- 모듈러 카드(CPIOM 등) 슬롯에 **Ethernet / SFP 모듈** 삽입·제거
- SVG 컴포저를 통한 동적 포트 합성 렌더링
- 포트 에러 오버레이 및 심각도별 시각화 (`critical` / `major` / `minor` / `warning`)

### 📊 대시보드 & 모니터링
- 장비 현황 위젯 (총 장비 수, 에러율 등)
- 실시간 디지털 시계
- 랙별 에러 마커 표시
- 라이트/다크 테마 전환

### 📁 데이터 관리
- **Excel(XLSX) Import / Export** — 전체 서버실 데이터 일괄 관리
- LocalStorage + IndexedDB 기반 영속 저장
- Undo / Redo 지원 (`Ctrl+Z` / `Ctrl+Shift+Z`)
- 변경사항 추적 및 저장 알림 (Dirty State)
- 계층 트리 구조 (Root → Group → Site → Room → Zone)

---

## 🏗️ 기술 스택

| 카테고리 | 기술 |
|:---|:---|
| **프레임워크** | React 19 + TypeScript 5.9 |
| **3D 엔진** | Three.js 0.182 · React Three Fiber · Drei |
| **상태관리** | Zustand 5 |
| **빌드 도구** | Vite 7 |
| **스타일링** | Vanilla CSS (Grafana-inspired 디자인 시스템) |
| **데이터 처리** | SheetJS (xlsx) · IndexedDB |
| **애니메이션** | React Spring · @use-gesture/react |

---

## 📂 프로젝트 구조

```
server-room-3d/
├── public/
│   ├── assets/          # 3D 모델 에셋 (GLB)
│   └── font/            # 커스텀 폰트
├── src/
│   ├── assets/          # 장비 SVG · 모듈 SVG · 카드 SVG
│   │   ├── card/        # 모듈러 카드 에셋
│   │   └── 3D/          # 3D 모델 에셋
│   ├── components/
│   │   ├── Scene.tsx              # 3D 씬 루트
│   │   ├── Rack.tsx               # 3D 랙 렌더링
│   │   ├── CameraController.tsx   # 카메라 제어
│   │   ├── DevicePanel.tsx        # 장비 사이드 패널
│   │   ├── DeviceModal.tsx        # 장비 상세 모달
│   │   ├── DeviceSvgPreview.tsx   # SVG 장비 프리뷰
│   │   ├── DeviceRegistrationModal.tsx  # 장비 등록 CRUD
│   │   ├── EquipmentAssemblyModal.tsx   # 장비 조립 모달
│   │   ├── ImportExportModal.tsx  # Excel 임포트/익스포트
│   │   ├── ModelImporter.tsx      # 3D 모델 임포터
│   │   ├── HierarchyTree.tsx      # 계층 트리 네비게이션
│   │   ├── DashboardWidgets.tsx   # 대시보드 위젯
│   │   ├── ModulePopover.tsx      # 모듈 삽입 팝오버
│   │   ├── PortErrorOverlay.tsx   # 포트 에러 오버레이
│   │   └── ...
│   ├── hooks/
│   │   ├── usePortInteraction.ts  # 포트 호버/클릭 인터랙션
│   │   ├── useSvgComposer.ts      # SVG 동적 합성
│   │   └── useClickOutside.ts     # 외부 클릭 감지
│   ├── store/
│   │   └── useStore.ts            # Zustand 글로벌 스토어
│   ├── contexts/
│   │   └── ThemeContext.tsx        # 라이트/다크 테마
│   ├── types/
│   │   ├── index.ts               # 공통 타입 정의
│   │   └── equipment.ts           # 장비·모듈 타입
│   ├── utils/
│   │   ├── storage.ts             # 데이터 영속화 (Excel ↔ Store)
│   │   ├── svgUtils.ts            # SVG 유틸리티
│   │   ├── portUtils.ts           # 포트 처리 유틸리티
│   │   ├── nodeUtils.ts           # 트리 노드 유틸리티
│   │   ├── deviceAssets.ts        # 장비 에셋 매핑
│   │   ├── cardAssets.ts          # 모듈러 카드 에셋
│   │   ├── moduleAssets.ts        # 모듈 에셋
│   │   └── sampleData.ts          # 샘플 데이터
│   └── styles/
│       └── grafana-theme.css      # Grafana 스타일 디자인 시스템
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 시작하기

### 사전 요구사항

- **Node.js** ≥ 18
- **npm** ≥ 9

### 설치 & 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속합니다.

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 프리뷰
npm run preview
```

---

## 🎮 사용법

### 기본 조작

| 조작 | 동작 |
|:---|:---|
| **좌클릭 드래그** | 카메라 회전 |
| **우클릭 드래그** | 카메라 팬 |
| **스크롤** | 줌 인/아웃 |
| **랙 클릭** | 랙 상세 패널 열기 |
| **장비 클릭** | 장비 상세 모달 열기 |
| `Ctrl + Z` | 실행 취소 (Undo) |
| `Ctrl + Shift + Z` | 다시 실행 (Redo) |
| `Ctrl + S` | 변경사항 저장 |

### 모드

- **View Mode** — 서버실 모니터링 및 장비 상태 조회
- **Edit Mode** — 랙 추가/삭제, 장비 배치, 3D 모델 임포트, 데이터 Import/Export

---

## 🎨 디자인 시스템

Grafana에서 영감을 받은 커스텀 CSS 디자인 시스템을 사용합니다.

- CSS Custom Properties 기반 테마 토큰
- 라이트 / 다크 모드 완전 지원
- 일관된 색상·타이포그래피·간격 체계
- 글래스모피즘 & 마이크로 애니메이션 적용

---

## 📜 라이선스

이 프로젝트는 비공개 프로젝트입니다.
