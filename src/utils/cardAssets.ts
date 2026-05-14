/**
 * Card Asset Resolver
 *
 * Vite import.meta.glob으로 카드 SVG를 동적 로드.
 * 지원 카드 패턴:
 *   - "R-series-{n}-{half|full}.svg"  → R4/R6 전용 카드
 *   - "CPIOM-{widthType}.svg"         → CPIOM 전용 카드 (R6d/R6dl)
 *   - "MDAs-{n}-{half|full}.svg"      → MDAs 카드 (R6d/R6dl)
 */

import type {
  CardDefinition,
  CardWidthType,
  EquipmentModel,
} from "../types/equipment";

// ── 카드 SVG: img 태그용 URL 가져오기 (라이브러리 미리보기) ────────────────
const cardUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { eager: true },
);
const cpiomUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { eager: true },
);
const mdasUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { eager: true },
);
const dualUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/Dual-CPMs-*.svg",
  { eager: true },
);
const immUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/IMM-*.svg",
  { eager: true },
);
const psuUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/PSU-*.svg",
  { eager: true },
);
const ixrUrlModules = { ...dualUrlModules, ...immUrlModules, ...psuUrlModules };

// ── 카드 SVG: raw text (인라인 SVG 렌더링용) ────────────────────────────
const cardRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { query: "?raw" },
);
const cpiomRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { query: "?raw" },
);
const mdasRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { query: "?raw" },
);
const dualRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/Dual-CPMs-*.svg",
  { query: "?raw" },
);
const immRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/IMM-*.svg",
  { query: "?raw" },
);
const psuRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/PSU-*.svg",
  { query: "?raw" },
);
const ixrRawModules = { ...dualRawModules, ...immRawModules, ...psuRawModules };

// ── Base 장비 SVG: raw text ─────────────────────────────────────────────
const baseEquipRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/*.svg",
  { query: "?raw" },
);

const baseEquipUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/*.svg",
  { eager: true },
);

/** 파일명에서 widthType 추출 */
function parseWidthType(filename: string): CardWidthType {
  if (filename.includes("-full")) return "full";
  return "half";
}

/** 파일명에서 cardType 추출 (e.g. "R-series-1-half.svg" → "R-series-1") */
function parseCardType(filename: string): string {
  return filename.replace(/\.svg$/i, "").replace(/-(half|full)$/, "");
}

/** SVG URL에서 width/height 추출 (SVG 컨텐츠에서) */
function parseSvgDimensionsFromUrl(url: string): {
  width: number;
  height: number;
} {
  // 기본값: half=430x46, full=860x46
  const isFullWidth = url.includes("-full");
  return {
    width: isFullWidth ? 860 : 430,
    height: 46,
  };
}

// ── 카드 정의 빌드 ─────────────────────────────────────────────────────
const _cardDefinitions: CardDefinition[] = [];

// --- R-series 카드 ---
for (const [path, mod] of Object.entries(cardUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("R-series-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename);
  const dims = parseSvgDimensionsFromUrl(filename);

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    svgWidth: dims.width,
    svgHeight: dims.height,
  });
}

// --- CPIOM 카드 ---
for (const [path, mod] of Object.entries(cpiomUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("CPIOM-")) continue;

  const widthType: CardWidthType = "full";
  const cardType = filename.replace(/\.svg$/i, ""); // e.g. "CPIOM-full"

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "cpiom",
    cardSizeType: "cpiom-828x72",
    svgWidth: 828,
    svgHeight: 72,
  });
}

// --- MDAs 카드 ---
for (const [path, mod] of Object.entries(mdasUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("MDAs-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename); // e.g. "MDAs-1"

  const isHalf = widthType === "half";
  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "standard",
    cardSizeType: isHalf ? "half-414x77" : "full-828x80",
    svgWidth: isHalf ? 414 : 828,
    svgHeight: 77,
  });
}

// --- IXR 전용 카드 ---
for (const [path, mod] of Object.entries(ixrUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  const cardType = filename.replace(/\.svg$/i, "");
  let widthType: CardWidthType = "half";
  let svgWidth = 492;

  if (filename.includes("-full")) {
    widthType = "full";
    svgWidth = 984;
  } else if (filename.includes("-sixth")) {
    widthType = "half";
    svgWidth = 164;
  }

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "ixr",
    svgWidth,
    svgHeight: 116,
  });
}

// 정렬: half → full, 이름순
_cardDefinitions.sort((a, b) => {
  if (a.widthType !== b.widthType) {
    return a.widthType === "half" ? -1 : 1;
  }
  return a.cardFileName.localeCompare(b.cardFileName, undefined, {
    numeric: true,
  });
});

export const cardDefinitions: CardDefinition[] = _cardDefinitions;

/**
 * R6 전용 카드 파일명 목록 (R4 등 다른 모델에서는 사용 불가)
 * R-series-9-full.svg는 860×46이지만 R6 full slot (860×71) 전용.
 */
const R6_ONLY_CARD_FILENAMES = new Set(["R-series-9-full.svg"]);

/**
 * 모델에 맞는 카드 목록 필터링.
 * - slots 모델: 슬롯 accepts/allowedCardGroups에 매칭되는 카드만 반환
 * - uniform grid 모델: R6 전용 카드 제외
 */
export function getCardsForModel(model: EquipmentModel): CardDefinition[] {
  if (model.slots) {
    // 모든 슬롯의 accepts와 allowedCardGroups 합산
    const allAccepts = new Set<string>();
    const allGroups = new Set<string>();
    model.slots.forEach((s) => {
      s.accepts.forEach((a) => allAccepts.add(a));
      s.allowedCardGroups?.forEach((g) => allGroups.add(g));
    });

    return cardDefinitions.filter((cd) => {
      // cardSizeType이 있으면 그걸로, 없으면 widthType으로 매칭
      const sizeKey = cd.cardSizeType || cd.widthType;
      const sizeOk = allAccepts.has(sizeKey);
      // cardGroup이 있으면 그걸로, 없으면 그룹 필터 스킵
      const groupOk =
        !allGroups.size || !cd.cardGroup || allGroups.has(cd.cardGroup);
      return sizeOk && groupOk;
    });
  }
  if (model.rows) {
    // row-based 모델: IXR 전용 카드만 허용
    return cardDefinitions.filter((cd) => cd.cardGroup === "ixr");
  }
  // uniform grid 모델: R6 전용 카드 제외, CPIOM/MDAs도 제외
  return cardDefinitions.filter(
    (cd) => !R6_ONLY_CARD_FILENAMES.has(cd.cardFileName) && !cd.cardGroup, // R-series 카드만 (cardGroup 미지정)
  );
}

/** 카드 SVG raw text 메모리 캐시 */
const _cardSvgRawCache = new Map<string, string>();

// ── O(1) Map Lookups for SVGs ──────────────────────────────────────────────
const _cardRawModuleMap = new Map<string, () => Promise<{ default: string }>>();
const _baseEquipRawModuleMap = new Map<string, () => Promise<{ default: string }>>();
const _baseEquipUrlModuleMap = new Map<string, string>();

function initMaps() {
  const allCardSources = { ...cardRawModules, ...cpiomRawModules, ...mdasRawModules, ...ixrRawModules };
  for (const [path, importFn] of Object.entries(allCardSources)) {
    const fn = path.split("/").pop() ?? "";
    _cardRawModuleMap.set(fn, importFn);
  }
  for (const [path, importFn] of Object.entries(baseEquipRawModules)) {
    const fn = path.split("/").pop() ?? "";
    _baseEquipRawModuleMap.set(fn, importFn);
  }
  for (const [path, mod] of Object.entries(baseEquipUrlModules)) {
    const fn = path.split("/").pop() ?? "";
    _baseEquipUrlModuleMap.set(fn, mod.default);
  }
}
initMaps();

/**
 * 카드 SVG raw text 로드 (인라인 렌더링용)
 * 캐시 히트 시 즉시 반환, 미스 시 O(1) Map 룩업으로 동적 로드
 */
export async function loadCardSvgRaw(
  cardFileName: string,
): Promise<string | undefined> {
  const cached = _cardSvgRawCache.get(cardFileName);
  if (cached) return cached;

  const importFn = _cardRawModuleMap.get(cardFileName);
  if (importFn) {
    try {
      const mod = await importFn();
      _cardSvgRawCache.set(cardFileName, mod.default);
      return mod.default;
    } catch (err) {
      console.error("Failed to load card SVG:", cardFileName, err);
      return undefined;
    }
  }
  return undefined;
}

/** 카드 SVG raw text 동기 캐시 조회 (캐시 미스 시 undefined) */
export function loadCardSvgRawSync(
  cardFileName: string,
): string | undefined {
  return _cardSvgRawCache.get(cardFileName);
}

/**
 * Base 장비 SVG raw text 로드
 */
export async function loadBaseEquipmentSvgRaw(
  baseSvgUrl: string,
): Promise<string | undefined> {
  const importFn = _baseEquipRawModuleMap.get(baseSvgUrl);
  if (importFn) {
    try {
      const mod = await importFn();
      return mod.default;
    } catch (err) {
      console.error("Failed to load base equipment SVG:", baseSvgUrl, err);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Base 장비 SVG URL (img 태그용)
 */
export function getBaseEquipmentSvgUrl(baseSvgUrl: string): string | undefined {
  return _baseEquipUrlModuleMap.get(baseSvgUrl);
}

// ── 장비 모델 목록 ─────────────────────────────────────────────────────

// --- Factory Functions for Equipment Rows ---
function createR6FullSlot(row: number, y: number) {
  return { slotId: `row-${row}-full`, row, col: 1, x: 0, y, width: 860, height: 71, slotType: "full-860x71", accepts: ["full"] };
}
function createR6HalfSlots(row: number, y: number) {
  return [
    { slotId: `row-${row}-left`, row, col: 1, x: 0, y, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
    { slotId: `row-${row}-right`, row, col: 2, x: 430, y, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
  ];
}

function createR6dFullSlot(row: number, y: number) {
  return { slotId: `r6d-row-${row}-full`, row, x: 0, y, width: 828, height: 77, slotType: "full-828x77", allowedCardGroups: ["standard"], accepts: ["full-828x80"] };
}
function createR6dHalfSlots(row: number, y: number) {
  return [
    { slotId: `r6d-row-${row}-left`, row, col: 1, x: 0, y, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
    { slotId: `r6d-row-${row}-right`, row, col: 2, x: 414, y, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
  ];
}

function createR6dlStandardRow(row: number, y: number) {
  return { slotId: `r6dl-row-${row}`, row, x: 0, y, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] };
}
function createR6dlCpiomRow(row: number, y: number) {
  return { slotId: `r6dl-row-${row}`, row, x: 0, y, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] };
}

function createIxrStandardRow(prefix: string, row: number, y: number, overlapY: number) {
  return {
    rowId: `${prefix}-row-${row}`,
    row,
    x: 0,
    y,
    width: 984,
    height: 116,
    overlapY,
    columns: 2,
    subSlots: [
      { slotId: `${prefix}-r${row}-full`, x: 0, y: 0, width: 984, height: 116 },
      { slotId: `${prefix}-r${row}-c1`, x: 0, y: 0, width: 492, height: 116 },
      { slotId: `${prefix}-r${row}-c2`, x: 492, y: 0, width: 492, height: 116 },
    ],
  };
}

function createIxrCpmRow(prefix: string, row: number, y: number, overlapY: number) {
  return {
    rowId: `${prefix}-row-${row}`,
    row,
    x: 0,
    y,
    width: 984,
    height: 102,
    overlapY,
    columns: 6,
    subSlots: Array.from({ length: 6 }).map((_, i) => ({
      slotId: `${prefix}-r${row}-c${i + 1}`,
      x: i * 164,
      y: 0,
      width: 164,
      height: 102,
    })),
  };
}

export const equipmentModels: EquipmentModel[] = [
  {
    modelId: "7250-ixr-r4",
    modelName: "7250 IXR-R4",
    baseSvgUrl: "[2U] 7250 IXR-R4-CARD.svg",
    equipmentSize: { width: 984, height: 192 },
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 184,
      columns: 2,
      columnWidth: 430,
    },
  },
  {
    modelId: "7250-ixr-r6",
    modelName: "7250 IXR-R6",
    baseSvgUrl: "[3U] 7250 IXR-R6-CARD.svg",
    equipmentSize: { width: 984, height: 288 },
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 280,
      columns: 2,
      columnWidth: 430,
    },
    slots: [
      createR6FullSlot(1, 0),
      createR6FullSlot(2, 71),
      ...createR6HalfSlots(3, 142),
      ...createR6HalfSlots(4, 188),
      ...createR6HalfSlots(5, 234),
    ],
  },
  {
    modelId: "7250-ixr-r6d",
    modelName: "7250 IXR-R6d",
    rackUnit: "4U",
    baseSvgUrl: "[4U] 7250 IXR-R6d-CARD.svg",
    equipmentSize: { width: 984, height: 384 },
    cardArea: {
      x: 136,
      y: 2,
      width: 828,
      height: 375,
      columns: 1,
      columnWidth: 828,
    },
    slots: [
      createR6dFullSlot(1, 0),
      createR6dFullSlot(2, 67),
      ...createR6dHalfSlots(3, 144),
      createR6dFullSlot(4, 221),
      ...createR6dHalfSlots(4, 221),
      createR6dFullSlot(5, 298),
      ...createR6dHalfSlots(5, 298),
    ],
  },
  {
    modelId: "7250-ixr-r6dl",
    modelName: "7250 IXR-R6dl",
    rackUnit: "7U",
    baseSvgUrl: "[7U] 7250 IXR-R6dl-CARD.svg",
    equipmentSize: { width: 984, height: 672 },
    cardArea: {
      x: 136,
      y: 22,
      width: 828,
      height: 624,
      columns: 1,
      columnWidth: 828,
    },
    slots: [
      createR6dlStandardRow(1, 0),
      createR6dlStandardRow(2, 80),
      createR6dlStandardRow(3, 160),
      createR6dlCpiomRow(4, 240),
      createR6dlCpiomRow(5, 312),
      createR6dlStandardRow(6, 384),
      createR6dlStandardRow(7, 464),
      createR6dlStandardRow(8, 544),
    ],
  },
  {
    modelId: "7250-ixr-6",
    modelName: "7250 IXR-6",
    rackUnit: "7U",
    baseSvgUrl: "7250-IXR-6-CARD.svg",
    dashboardThumbnailUrl: "/thumbnails/7250-ixr-6.png",
    equipmentSize: { width: 984, height: 672 },
    rows: [
      createIxrStandardRow("ixr6", 1, 20, 0),
      createIxrStandardRow("ixr6", 2, 130, -6),
      createIxrStandardRow("ixr6", 3, 240, -6),
      createIxrStandardRow("ixr6", 4, 350, -6),
      createIxrStandardRow("ixr6", 5, 460, -6),
      createIxrCpmRow("ixr6", 6, 570, -6),
    ],
  },
  {
    modelId: "7250-ixr-10",
    modelName: "7250 IXR-10",
    rackUnit: "13U",
    baseSvgUrl: "7250-IXR-10-CARD.svg",
    dashboardThumbnailUrl: "/thumbnails/7250-ixr-10.png",
    equipmentSize: { width: 984, height: 1248 },
    rows: [
      createIxrStandardRow("ixr10", 1, 20, 0),
      createIxrStandardRow("ixr10", 2, 130, -6),
      createIxrStandardRow("ixr10", 3, 240, -6),
      createIxrStandardRow("ixr10", 4, 350, -6),
      createIxrStandardRow("ixr10", 5, 460, -6),
      createIxrStandardRow("ixr10", 6, 570, -6),
      createIxrStandardRow("ixr10", 7, 680, -6),
      createIxrStandardRow("ixr10", 8, 790, -6),
      createIxrStandardRow("ixr10", 9, 900, -6),
      createIxrCpmRow("ixr10", 10, 1044, 0),
      createIxrCpmRow("ixr10", 11, 1146, 0),
    ],
  },
];
