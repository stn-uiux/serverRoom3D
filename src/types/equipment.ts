/**
 * Equipment Assembly Types
 *
 * 장비 모델 선택 및 카드 삽입 기능을 위한 타입 정의
 */

/** 카드 폭 타입: half = 430px (1열), full = 860px (2열) */
export type CardWidthType = "half" | "full";

/** 카드 그룹: cpiom = CPIOM 전용, standard = 일반 카드 */
export type CardGroupType = "cpiom" | "standard";

/** 서브 슬롯 (row-based layout용) */
export interface EquipmentSubSlot {
  slotId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 행 정의 (row-based layout용) */
export interface EquipmentRow {
  rowId: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  overlapY: number;
  columns: number;
  subSlots: EquipmentSubSlot[];
}

/** 슬롯 정의 (mixed layout용) */
export interface SlotDefinition {
  slotId: string;
  row: number;
  col?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 슬롯 유형 식별자 (e.g. "full-860x71", "half-430x46") */
  slotType: string;
  /** 이 슬롯에 허용되는 카드 그룹 (e.g. ["cpiom"], ["standard"]) */
  allowedCardGroups?: string[];
  /** 이 슬롯에 삽입 가능한 cardSizeType / widthType 목록 */
  accepts: string[];
}

/** 장비 모델 정의 */
export interface EquipmentModel {
  modelId: string;
  modelName: string;
  rackUnit?: string; // e.g. "4U", "7U"
  baseSvgUrl: string; // e.g. "/equipment/[2U] 7250 IXR-R4-CARD.svg"
  dashboardThumbnailUrl?: string;
  cardArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
    columns: number;
    columnWidth: number;
  };
  equipmentSize?: {
    width: number;
  };
  /** mixed layout용 명시적 슬롯 정의 (없으면 uniform grid) */
  slots?: SlotDefinition[];
  /** row-based layout용 행 정의 (IXR-6, IXR-10 등) */
  rows?: EquipmentRow[];
}

/** 카드 정의 (카드 라이브러리에 표시) */
export interface CardDefinition {
  cardFileName: string; // e.g. "R-series-1-half.svg"
  cardType: string; // e.g. "R-series-1"
  svgUrl: string; // glob-resolved import path
  widthType: CardWidthType;
  /** 카드 그룹 ("cpiom" | "standard"). 미지정 시 기존 widthType 기반 매칭 */
  cardGroup?: string;
  /** 슬롯 accepts와 매칭되는 크기 타입 (e.g. "cpiom-828x72", "half-414x77") */
  cardSizeType?: string;
  /** SVG 원본 너비 (px) */
  svgWidth: number;
  /** SVG 원본 높이 (px) */
  svgHeight: number;
}

/** 장비 포트 정보 (런타임 생성) */
export interface EquipmentPort {
  /** 실제 포트 번호 (e.g. "1/1/9") */
  realPortNumber: string;
  /** SVG 내 로컬 포트 번호 (e.g. "9") */
  localPort: string;
  /** 소속 카드 인스턴스 ID */
  cardInstanceId: string;
  /** 포트 유형 (e.g. "qsfp", "sfp", "eth") */
  portType: string;
  /** 포트 상태 */
  status: "normal" | "critical" | "warning" | "disabled";
}

/** [VITE_CACHE_BREAKER_GEN_PORT] */
export interface GeneratedPort {
  /** 실제 포트 번호 (e.g. "1/1/9") - shelfNo/slotNo/localPort */
  realPortNumber: string;
  /** SVG 내 로컬 포트 번호 (e.g. "9") */
  localPort: string;
  /** 소속 카드 인스턴스 ID */
  cardInstanceId: string;
  /** 카드 파일명 (SVG 매핑용) */
  cardFileName: string;
  /** 포트 유형 (e.g. "qsfp", "sfp", "port") */
  portType: string;
  /** 포트 상태 (기본: "normal") */
  status: "normal" | "critical" | "warning" | "disabled";
  /** SVG path의 d 속성 (포트 위치/크기 추출용) */
  pathD?: string;
}

/** 삽입된 카드 인스턴스 */
export interface InsertedCard {
  instanceId: string;
  cardFileName: string;
  cardType: string;
  svgUrl: string;
  widthType: CardWidthType;
  shelfNo: number;
  slotNo: number;
  /** 그리드 내 위치 인덱스 (row * columns + col) */
  positionIndex: number;
  /** 카드 SVG 원본 높이 */
  svgHeight: number;
  /** 런타임 생성된 포트 목록 */
  ports?: EquipmentPort[];
  /** mixed layout용 슬롯 ID (e.g. "row-1-full") 또는 row-based 서브 슬롯 ID */
  slotId?: string;
  /** row-based layout용 행 ID */
  rowId?: string;
  /** 카드 크기 타입 (e.g. "full-860x71", "half-430x46") - slots 모델 전용 */
  cardSizeType?: string;
}

/** 모듈 유형 (포트에 삽입 가능한 트랜시버/커넥터) */
export type ModuleType = "ethernet" | "sfp";

/** 포트에 삽입된 모듈 인스턴스 */
export interface InsertedModule {
  /** 대상 포트 식별자 (realPortNumber e.g. "1/1/9" 또는 SVG portId e.g. "port-sfp-1") */
  portId: string;
  /** 모듈 유형 */
  moduleType: ModuleType;
  /** 모듈 SVG 파일명 (e.g. "Ethernet.svg") */
  moduleSvgFileName: string;
  hitboxId?: string;
}

/** 모듈 정의 (라이브러리 표시용) */
export interface ModuleDefinition {
  /** 모듈 유형 */
  moduleType: ModuleType;
  /** 표시 이름 */
  displayName: string;
  /** SVG 파일명 */
  svgFileName: string;
  /** SVG URL (img 태그용) */
  svgUrl: string;
}

/** 장비 조립 결과 (저장 시) */
export interface EquipmentAssemblyResult {
  equipmentModel: EquipmentModel;
  insertedCards: InsertedCard[];
  insertedModules?: InsertedModule[];
  thumbnailDataUrl?: string; // PNG/WebP data URL
}
