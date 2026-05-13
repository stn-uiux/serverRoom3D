import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import type { CardDefinition, InsertedCard, EquipmentModel, SlotDefinition, EquipmentRow, EquipmentSubSlot } from "../types/equipment";
import {
  cardDefinitions,
  equipmentModels,
  getCardsForModel,
  loadBaseEquipmentSvgRaw,
  loadCardSvgRaw,
} from "../utils/cardAssets";
import { generatePortMap } from "../utils/portUtils";
import type { GeneratedPort } from "../types/equipment";

/* ────── 스타일 ────── */
const STYLES = `
.eam-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:2500;animation:eam-fi .25s ease-out}
@keyframes eam-fi{from{opacity:0}to{opacity:1}}
.eam-modal{background:var(--modal-bg);border:1px solid var(--border-medium);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.6);width:1400px;max-width:98vw;height:90vh;display:flex;flex-direction:column;overflow:hidden;animation:eam-zi .3s cubic-bezier(.16,1,.3,1)}
@keyframes eam-zi{from{transform:scale(.96) translateY(16px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
.eam-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-weak)}
.eam-header h2{font-size:18px;font-weight:700;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:12px}
.eam-header .icon-box{width:34px;height:34px;background:linear-gradient(135deg,var(--theme-primary),#4872d8);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px}
.eam-close{background:var(--bg-tertiary);border:1px solid var(--border-medium);color:var(--text-secondary);width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;transition:all .2s;font-size:18px;line-height:0}
.eam-close:hover{background:var(--severity-critical);color:#fff;border-color:var(--severity-critical);transform:rotate(90deg)}
.eam-body{flex:1;display:flex;overflow:hidden}
.eam-sidebar{width:240px;background:var(--bg-secondary);border-right:1px solid var(--border-weak);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;padding:16px 12px;gap:8px}
.eam-sidebar-title{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);font-weight:700;padding:4px 8px;margin-bottom:4px}
.eam-card-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid var(--border-weak);background:var(--bg-primary);transition:all .15s;position:relative}
.eam-card-item:hover{border-color:var(--theme-primary);background:rgba(var(--theme-primary-rgb),.06);transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.eam-card-item img{height:28px;flex-shrink:0;border-radius:4px;background:var(--bg-tertiary)}
.eam-card-item .info{flex:1;min-width:0}
.eam-card-item .name{font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eam-card-item .tag{font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px}
.eam-card-item .tag.half{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.eam-card-item .tag.full{background:rgba(249,115,22,.12);color:#f97316;border:1px solid rgba(249,115,22,.2)}
.eam-main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-primary)}
.eam-toolbar{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border-weak);background:var(--bg-secondary);flex-shrink:0}
.eam-toolbar select{height:36px;padding:0 32px 0 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:13px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;background-size:14px}
.eam-toolbar .btn{height:36px;padding:0 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--border-medium);background:var(--bg-tertiary);color:var(--text-primary);transition:all .2s;display:flex;align-items:center;gap:6px}
.eam-toolbar .btn:hover{background:var(--bg-secondary);border-color:var(--text-tertiary)}
.eam-toolbar .btn.primary{background:linear-gradient(135deg,var(--theme-primary),#4872d8);color:#fff;border-color:transparent}
.eam-toolbar .btn.primary:hover{filter:brightness(1.1);transform:translateY(-1px)}
.eam-toolbar .btn.danger{color:var(--severity-critical);border-color:rgba(239,68,68,.3)}
.eam-toolbar .btn.danger:hover{background:var(--severity-critical);color:#fff}
.eam-canvas-area{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:60px;background:#1a1c22;position:relative}
.eam-equip-wrap{position:relative;margin:auto;display:inline-block;box-shadow:0 0 60px rgba(0,0,0,.7);border-radius:4px;background:#000;flex-shrink:0}
.eam-equip-wrap svg{display:block;width:auto;height:auto;max-width:none}
.base-svg-container{display:block}
.base-svg-container svg{display:block;width:auto;height:auto;max-width:none}
.eam-card-area-overlay{position:absolute;pointer-events:none}
.eam-slot{position:absolute;border:1px dashed rgba(var(--theme-primary-rgb),.35);border-radius:4px;transition:all .2s;pointer-events:all;cursor:pointer;display:flex;align-items:center;justify-content:center}
.eam-slot:hover{background:rgba(var(--theme-primary-rgb),.08);border-color:var(--theme-primary)}
.eam-slot.occupied{border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.04);cursor:default}
.eam-slot.occupied:hover{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.4)}
.eam-slot .remove-btn{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:var(--severity-critical);color:#fff;border:none;cursor:pointer;font-size:11px;display:none;align-items:center;justify-content:center;z-index:10;line-height:0}
.eam-slot.occupied:hover .remove-btn{display:flex}
.eam-slot .slot-label{font-size:10px;color:var(--text-tertiary);opacity:.6;pointer-events:none}
.eam-slot .card-svg-inline{width:100%;height:100%;pointer-events:none}
.eam-slot .card-svg-inline svg{width:100%;height:100%}
.eam-slot.highlight{border-color:var(--theme-primary);border-style:solid;background:rgba(var(--theme-primary-rgb),.12);box-shadow:inset 0 0 12px rgba(var(--theme-primary-rgb),.2),0 0 8px rgba(var(--theme-primary-rgb),.25)}
.eam-slot.dimmed{opacity:.3;cursor:not-allowed;border-color:rgba(255,255,255,.08);background:rgba(0,0,0,.15);pointer-events:none}
.eam-slot.dimmed:hover{background:rgba(0,0,0,.15);border-color:rgba(255,255,255,.08)}
.eam-warn{position:fixed;top:80px;left:50%;transform:translateX(-50%);background:var(--severity-critical);color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:3000;animation:eam-fi .2s ease-out;box-shadow:0 8px 24px rgba(239,68,68,.4)}
.eam-model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:24px;flex:1;overflow-y:auto;align-content:start}
.eam-model-card{padding:16px;border:1px solid var(--border-weak);border-radius:12px;background:var(--bg-secondary);cursor:pointer;transition:all .2s;text-align:center}
.eam-model-card:hover{border-color:var(--theme-primary);background:rgba(var(--theme-primary-rgb),.06);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.15)}
.eam-model-card .model-name{font-size:14px;font-weight:700;color:var(--text-primary);margin-top:10px}
.eam-model-card img{width:100%;height:60px;object-fit:contain;border-radius:6px;background:var(--bg-tertiary);padding:4px}
.eam-card-item .tag.cpiom{background:rgba(168,85,247,.12);color:#a855f7;border:1px solid rgba(168,85,247,.25)}
.eam-card-item .tag.standard{background:rgba(59,130,246,.12);color:#3b82f6;border:1px solid rgba(59,130,246,.25)}
.eam-sidebar-section{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:700;padding:8px 8px 4px;margin-top:8px;border-top:1px solid var(--border-weak)}
.eam-sidebar-section:first-of-type{margin-top:0;border-top:none}
.eam-sidebar-section:first-of-type{margin-top:0;border-top:none}
.eam-row-container{position:absolute;border:1px dashed rgba(168,85,247,.3);pointer-events:none;display:flex;align-items:center;justify-content:center}
.eam-row-container .row-label{position:absolute;left:-40px;font-size:10px;color:rgba(168,85,247,.7);font-weight:700}
`;

/* ────── 슬롯 그리드 계산 ────── */
const CARD_ROW_HEIGHT = 46; // 기본 카드 높이

interface SlotPosition {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function buildSlotGrid(model: EquipmentModel): SlotPosition[] {
  const { cardArea } = model;
  if (!cardArea) return [];
  const maxRows = Math.floor(cardArea.height / CARD_ROW_HEIGHT);
  const slots: SlotPosition[] = [];
  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < cardArea.columns; col++) {
      slots.push({
        row,
        col,
        x: cardArea.x + col * cardArea.columnWidth,
        y: cardArea.y + row * CARD_ROW_HEIGHT,
        width: cardArea.columnWidth,
        height: CARD_ROW_HEIGHT,
      });
    }
  }
  return slots;
}

function getOccupiedPositions(cards: InsertedCard[]): Set<string> {
  const set = new Set<string>();
  for (const c of cards) {
    const row = Math.floor(c.positionIndex / 2);
    const col = c.positionIndex % 2;
    set.add(`${row}-${col}`);
    if (c.widthType === "full") {
      set.add(`${row}-${col + 1}`);
    }
  }
  return set;
}

function canInsertAt(
  cards: InsertedCard[],
  posIndex: number,
  widthType: "half" | "full",
  columns: number,
): boolean {
  const occupied = getOccupiedPositions(cards);
  const row = Math.floor(posIndex / columns);
  const col = posIndex % columns;
  if (occupied.has(`${row}-${col}`)) return false;
  if (widthType === "full") {
    if (col !== 0) return false; // full은 col 0에서만 시작
    if (occupied.has(`${row}-1`)) return false;
  }
  return true;
}

/* ────── 카드 SVG 인라인 렌더링 ────── */
const CardInlineSvg = ({ cardFileName }: { cardFileName: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    loadCardSvgRaw(cardFileName).then((raw) => {
      if (m && raw) {
        // 내부 SVG가 슬롯에 꽉 차도록 속성 수정
        const responsiveRaw = raw
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="100%"')
          .replace(/<svg/, '<svg preserveAspectRatio="none"');
        setSvgHtml(responsiveRaw);
      }
    });
    return () => { m = false; };
  }, [cardFileName]);

  if (!svgHtml) return null;
  return (
    <div
      ref={ref}
      className="card-svg-inline"
      style={{ display: "flex", width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
};

/* ────── 메인 컴포넌트 ────── */
interface Props {
  open: boolean;
  onClose: () => void;
  initialModelName?: string;
  initialCards?: InsertedCard[];
  onSave?: (result: {
    model: EquipmentModel;
    cards: InsertedCard[];
    thumbnailDataUrl: string;
    generatedPorts: GeneratedPort[];
  }) => void;
}

export const EquipmentAssemblyModal: React.FC<Props> = ({ open, onClose, initialModelName, initialCards, onSave }) => {
  const [selectedModel, setSelectedModel] = useState<EquipmentModel | null>(null);
  const [insertedCards, setInsertedCards] = useState<InsertedCard[]>([]);
  const [baseSvgHtml, setBaseSvgHtml] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slotNextId, setSlotNextId] = useState(1);
  const equipRef = useRef<HTMLDivElement>(null);
  const styleInjectedRef = useRef(false);

  // 스타일 주입
  useEffect(() => {
    if (styleInjectedRef.current) return;
    styleInjectedRef.current = true;
    const s = document.createElement("style");
    s.dataset.eam = "1";
    s.textContent = STYLES;
    document.head.appendChild(s);
  }, []);

  // Base SVG 로드
  useEffect(() => {
    if (!selectedModel) { setBaseSvgHtml(null); return; }
    let m = true;
    loadBaseEquipmentSvgRaw(selectedModel.baseSvgUrl).then((raw) => {
      if (m) setBaseSvgHtml(raw ?? null);
    });
    return () => { m = false; };
  }, [selectedModel]);

  // 모델 초기화
  useEffect(() => {
    if (open && initialModelName) {
      const found = equipmentModels.find((m) => m.modelName === initialModelName);
      if (found) {
        setSelectedModel(found);
      }
    }
  }, [open, initialModelName]);

  // 카드 초기화 (기존 데이터가 있으면 로드)
  useEffect(() => {
    if (open) {
      if (initialCards && initialCards.length > 0) {
        setInsertedCards(initialCards.map(c => ({
          ...c,
          slotNo: c.slotNo ?? (c.positionIndex + 1)
        })));
        // slotNextId도 최대값 + 1로 설정하여 ID 충돌 방지
        const maxId = initialCards.reduce((max, c) => {
          const num = parseInt(c.instanceId.split("-").pop() || "0", 10);
          return num > max ? num : max;
        }, 0);
        setSlotNextId(maxId + 1);
      } else {
        setInsertedCards([]);
        setSlotNextId(1);
      }
    }
  }, [open, initialCards]);

  // 모델 변경 시 카드 초기화
  const handleSelectModel = useCallback((model: EquipmentModel) => {
    setSelectedModel(model);
    setInsertedCards([]);
    setSelectedCard(null);
    setSlotNextId(1);
  }, []);

  // 경고 자동 숨김
  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 2500);
    return () => clearTimeout(t);
  }, [warning]);

  // 슬롯 그리드 (uniform grid 모델용)
  const slots = useMemo(() => {
    if (!selectedModel) return [];
    if (selectedModel.slots) return []; // slots 모델은 별도 처리
    return buildSlotGrid(selectedModel);
  }, [selectedModel]);

  // mixed layout 여부
  const isMixedLayout = !!selectedModel?.slots;
  // row layout 여부
  const isRowLayout = !!selectedModel?.rows;

  // 모델에 맞는 카드 목록 (R6 전용 필터 등)
  const filteredCards = useMemo(() => {
    if (!selectedModel) return cardDefinitions;
    return getCardsForModel(selectedModel);
  }, [selectedModel]);

  // === slots 모델: slotId 기반 점유 맵 ===
  const slotOccupiedMap = useMemo(() => {
    const map = new Map<string, InsertedCard>();
    for (const c of insertedCards) {
      if (c.slotId) map.set(c.slotId, c);
    }
    return map;
  }, [insertedCards]);

  // === 같은 행에서 full/half 슬롯 상호 배제 (geometry overlap) ===
  const blockedSlotIds = useMemo(() => {
    const blocked = new Set<string>();

    if (selectedModel?.slots) {
      for (const card of insertedCards) {
        if (!card.slotId) continue;
        const occupied = selectedModel.slots.find(s => s.slotId === card.slotId);
        if (!occupied) continue;

        for (const slot of selectedModel.slots) {
          if (slot.slotId === card.slotId) continue;
          if (slot.row !== occupied.row) continue;

          const oRight = occupied.x + occupied.width;
          const sRight = slot.x + slot.width;
          if (occupied.x < sRight && oRight > slot.x) {
            blocked.add(slot.slotId);
          }
        }
      }
    } else if (selectedModel?.rows) {
      for (const card of insertedCards) {
        if (!card.slotId || !card.rowId) continue;
        const row = selectedModel.rows.find(r => r.rowId === card.rowId);
        if (!row) continue;
        const occupied = row.subSlots.find(s => s.slotId === card.slotId);
        if (!occupied) continue;

        for (const slot of row.subSlots) {
          if (slot.slotId === card.slotId) continue;

          const oRight = occupied.x + occupied.width;
          const sRight = slot.x + slot.width;
          if (occupied.x < sRight && oRight > slot.x) {
            blocked.add(slot.slotId);
          }
        }
      }
    }
    return blocked;
  }, [selectedModel, insertedCards]);

  // === 선택된 카드에 대한 유효 슬롯 ID 계산 (하이라이팅용) ===
  const availableSlotIds = useMemo(() => {
    if (!selectedCard) return new Set<string>();
    const ids = new Set<string>();

    if (selectedModel?.slots) {
      selectedModel.slots.forEach(slot => {
        const sizeKey = selectedCard.cardSizeType || selectedCard.widthType;
        const sizeOk = slot.accepts.includes(sizeKey);
        const groupOk = !slot.allowedCardGroups?.length ||
          slot.allowedCardGroups.includes(selectedCard.cardGroup || "standard");
        const emptyOk = !slotOccupiedMap.has(slot.slotId);
        const notBlocked = !blockedSlotIds.has(slot.slotId);
        if (sizeOk && groupOk && emptyOk && notBlocked) ids.add(slot.slotId);
      });
    } else if (selectedModel?.rows) {
      selectedModel.rows.forEach(row => {
        row.subSlots.forEach(subSlot => {
          // 카드의 svg 너비가 서브슬롯 너비를 초과하지 않는지 확인
          const sizeOk = selectedCard.svgWidth <= subSlot.width;
          const emptyOk = !slotOccupiedMap.has(subSlot.slotId);
          const notBlocked = !blockedSlotIds.has(subSlot.slotId);
          if (sizeOk && emptyOk && notBlocked) ids.add(subSlot.slotId);
        });
      });
    }
    return ids;
  }, [selectedCard, selectedModel, slotOccupiedMap, blockedSlotIds]);

  // 카드가 선택되었을 때 하이라이팅 활성 여부
  const isHighlightActive = !!selectedCard && (isMixedLayout || isRowLayout);

  // === slots 모델: 슬롯 클릭 → 카드 삽입 ===
  const handleSlotClickMixed = useCallback(
    (slot: SlotDefinition) => {
      if (!selectedCard || !selectedModel) return;

      // 이미 점유된 슬롯인지 확인
      if (slotOccupiedMap.has(slot.slotId)) {
        setWarning("이미 카드가 삽입된 슬롯입니다.");
        return;
      }

      // 같은 행의 다른 슬롯에 의해 블록된 경우
      if (blockedSlotIds.has(slot.slotId)) {
        setWarning("같은 행의 다른 슬롯에 카드가 삽입되어 사용할 수 없습니다.");
        return;
      }

      // allowedCardGroups 검증
      if (slot.allowedCardGroups?.length) {
        const cardGroup = selectedCard.cardGroup || "standard";
        if (!slot.allowedCardGroups.includes(cardGroup)) {
          const groupLabel = slot.allowedCardGroups.includes("cpiom") ? "CPIOM" : "Standard";
          setWarning(`이 슬롯은 ${groupLabel} 카드만 삽입할 수 있습니다.`);
          return;
        }
      }

      // accepts (cardSizeType) 검증
      const sizeKey = selectedCard.cardSizeType || selectedCard.widthType;
      if (!slot.accepts.includes(sizeKey)) {
        setWarning(
          `이 슬롯은 ${slot.accepts.join(", ")} 타입 카드만 삽입할 수 있습니다.`,
        );
        return;
      }

      const colValue = slot.col ?? 1;
      const globalSlotNo = selectedModel.slots!.findIndex(s => s.slotId === slot.slotId) + 1;
      const newCard: InsertedCard = {
        instanceId: `card-instance-${String(slotNextId).padStart(3, "0")}`,
        cardFileName: selectedCard.cardFileName,
        cardType: selectedCard.cardType,
        svgUrl: selectedCard.svgUrl,
        widthType: selectedCard.widthType,
        shelfNo: 1,
        slotNo: globalSlotNo,
        positionIndex: slot.row * 2 + (colValue - 1), // 호환용
        svgHeight: selectedCard.svgHeight,
        slotId: slot.slotId,
        cardSizeType: slot.slotType,
      };
      setInsertedCards((prev) => [...prev, newCard]);
      setSlotNextId((n) => n + 1);
    },
    [selectedCard, selectedModel, slotOccupiedMap, blockedSlotIds, slotNextId],
  );

  // === row 모델: 슬롯 클릭 → 카드 삽입 ===
  const handleSlotClickRow = useCallback(
    (row: EquipmentRow, subSlot: EquipmentSubSlot) => {
      if (!selectedCard || !selectedModel) return;

      if (slotOccupiedMap.has(subSlot.slotId)) {
        setWarning("이미 카드가 삽입된 슬롯입니다.");
        return;
      }

      if (blockedSlotIds.has(subSlot.slotId)) {
        setWarning("같은 행의 다른 슬롯에 카드가 삽입되어 사용할 수 없습니다.");
        return;
      }

      if (selectedCard.svgWidth > subSlot.width) {
        setWarning(`이 카드의 너비(${selectedCard.svgWidth}px)는 슬롯 너비(${subSlot.width}px)를 초과합니다.`);
        return;
      }

      const allSubSlots = selectedModel.rows!.flatMap(r => r.subSlots.map(s => s.slotId));
      const globalSlotNo = allSubSlots.indexOf(subSlot.slotId) + 1;

      const newCard: InsertedCard = {
        instanceId: `card-instance-${String(slotNextId).padStart(3, "0")}`,
        cardFileName: selectedCard.cardFileName,
        cardType: selectedCard.cardType,
        svgUrl: selectedCard.svgUrl,
        widthType: selectedCard.widthType,
        shelfNo: 1,
        slotNo: globalSlotNo, // 고유 slotNo 할당 (포트 충돌 방지)
        positionIndex: row.row * row.columns + row.subSlots.indexOf(subSlot), // 호환용
        svgHeight: selectedCard.svgHeight,
        slotId: subSlot.slotId,
        rowId: row.rowId,
      };
      setInsertedCards((prev) => [...prev, newCard]);
      setSlotNextId((n) => n + 1);
    },
    [selectedCard, selectedModel, slotOccupiedMap, slotNextId]
  );

  // === uniform grid 모델: 슬롯 클릭 → 카드 삽입 ===
  const handleSlotClick = useCallback(
    (slot: SlotPosition) => {
      if (!selectedCard || !selectedModel || !selectedModel.cardArea) return;

      const posIndex = slot.row * selectedModel.cardArea.columns + slot.col;

      if (!canInsertAt(insertedCards, posIndex, selectedCard.widthType, selectedModel.cardArea.columns)) {
        setWarning(
          selectedCard.widthType === "full"
            ? "Full 카드는 빈 행의 첫 번째 열에서만 삽입할 수 있습니다."
            : "이미 다른 카드가 있는 슬롯입니다.",
        );
        return;
      }

      const newCard: InsertedCard = {
        instanceId: `card-instance-${String(slotNextId).padStart(3, "0")}`,
        cardFileName: selectedCard.cardFileName,
        cardType: selectedCard.cardType,
        svgUrl: selectedCard.svgUrl,
        widthType: selectedCard.widthType,
        shelfNo: 1,
        slotNo: posIndex + 1,
        positionIndex: posIndex,
        svgHeight: selectedCard.svgHeight,
      };
      setInsertedCards((prev) => [...prev, newCard]);
      setSlotNextId((n) => n + 1);
    },
    [selectedCard, selectedModel, insertedCards, slotNextId],
  );

  // 카드 제거
  const handleRemoveCard = useCallback((instanceId: string) => {
    setInsertedCards((prev) => prev.filter((c) => c.instanceId !== instanceId));
  }, []);

  // 전체 초기화
  const handleClearAll = useCallback(() => {
    setInsertedCards([]);
    setSlotNextId(1);
  }, []);

  // 저장 (썸네일 생성 – 카드 합성 후 PNG 변환)
  const handleSave = useCallback(async () => {
    if (!selectedModel) return;

    let thumbnailDataUrl = "";
    try {
      // 1. 베이스 SVG raw 로드
      const baseRaw = await loadBaseEquipmentSvgRaw(selectedModel.baseSvgUrl);
      if (baseRaw) {
        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseRaw, "image/svg+xml");
        const baseSvgEl = baseDoc.querySelector("svg");

        if (baseSvgEl) {
          const vb = baseSvgEl.getAttribute("viewBox");
          if (!baseSvgEl.getAttribute("width") && vb) {
            const parts = vb.split(/\s+/);
            baseSvgEl.setAttribute("width", parts[2] || "100%");
            baseSvgEl.setAttribute("height", parts[3] || "100%");
          }

          // 2. 각 카드 SVG를 베이스 SVG에 인라인 합성
          const cardPromises = insertedCards.map(card =>
            loadCardSvgRaw(card.cardFileName).then(raw => ({ card, raw }))
          );
          const cardResults = await Promise.all(cardPromises);

          for (const { card, raw } of cardResults) {
            if (!raw) continue;
            const cardDoc = parser.parseFromString(raw, "image/svg+xml");
            const cardSvgEl = cardDoc.querySelector("svg");
            if (!cardSvgEl) continue;

            let x: number, y: number, cardW: number, cardH: number;

            // slots 모델: slotId로 좌표 결정
            if (selectedModel.slots && card.slotId) {
              const slotDef = selectedModel.slots.find(s => s.slotId === card.slotId);
              if (!slotDef || !selectedModel.cardArea) continue;
              x = selectedModel.cardArea.x + slotDef.x;
              y = selectedModel.cardArea.y + slotDef.y;
              cardW = slotDef.width;
              cardH = slotDef.height;
            } else if (selectedModel.rows && card.rowId && card.slotId) {
              // row-based 모델: rowId와 slotId로 결정
              const rowDef = selectedModel.rows.find(r => r.rowId === card.rowId);
              if (!rowDef) continue;
              const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
              if (!subDef) continue;
              x = rowDef.x + subDef.x;
              y = rowDef.y + subDef.y;
              cardW = subDef.width;
              cardH = subDef.height;
            } else if (selectedModel.cardArea) {
              // uniform grid 모델
              const row = Math.floor(card.positionIndex / selectedModel.cardArea.columns);
              const col = card.positionIndex % selectedModel.cardArea.columns;
              x = selectedModel.cardArea.x + col * selectedModel.cardArea.columnWidth;
              y = selectedModel.cardArea.y + row * CARD_ROW_HEIGHT;
              cardW = card.widthType === "full"
                ? selectedModel.cardArea.columnWidth * 2
                : selectedModel.cardArea.columnWidth;
              cardH = CARD_ROW_HEIGHT;
            } else {
              continue; // fallback
            }

            const vb = cardSvgEl.getAttribute("viewBox");
            const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, cardW, cardH];
            const origW = parts[2];
            const origH = parts[3];

            const g = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
            const scaleX = cardW / origW;
            const scaleY = cardH / origH;
            g.setAttribute("transform", `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`);

            while (cardSvgEl.firstChild) {
              g.appendChild(cardSvgEl.firstChild);
            }
            baseSvgEl.appendChild(g);
          }

          // 3. 합성된 SVG → Canvas → PNG
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(baseDoc);
          const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);

          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
          });

          // Phase 3: SCALE 4→2, PNG→WebP로 data URL 크기 ~70% 감소
          // → 3D 텍스처 GPU 업로드 비용 + structuredClone 비용 절감
          const SCALE = 2;
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth * SCALE;
          canvas.height = img.naturalHeight * SCALE;
          const ctx = canvas.getContext("2d")!;
          
          // 크기를 키운 캔버스에 이미지를 그려 화질 보존
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          thumbnailDataUrl = canvas.toDataURL("image/webp", 0.8);
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      console.error("Thumbnail generation failed:", e);
    }

    // 4. Generate Port Map
    const cardSvgMap = new Map<string, string>();
    for (const card of insertedCards) {
      if (!cardSvgMap.has(card.cardFileName)) {
        const raw = await loadCardSvgRaw(card.cardFileName);
        if (raw) cardSvgMap.set(card.cardFileName, raw);
      }
    }
    const generatedPorts = generatePortMap(insertedCards, cardSvgMap);

    onSave?.({ model: selectedModel, cards: insertedCards, thumbnailDataUrl, generatedPorts });
    onClose();
  }, [selectedModel, insertedCards, onSave, onClose]);

  // 점유 맵
  const occupied = useMemo(() => getOccupiedPositions(insertedCards), [insertedCards]);

  // 카드 인스턴스 → 슬롯 위치 매핑
  const cardAtSlot = useMemo(() => {
    const map = new Map<string, InsertedCard>();
    for (const c of insertedCards) {
      const row = Math.floor(c.positionIndex / 2);
      const col = c.positionIndex % 2;
      map.set(`${row}-${col}`, c);
    }
    return map;
  }, [insertedCards]);

  if (!open) return null;

  return createPortal(
    <div className="eam-overlay" onClick={onClose}>
      <div className="eam-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="eam-header">
          <h2>
            {selectedModel ? `장비 구성 – ${selectedModel.modelName}` : "새 장비 등록"}
          </h2>
          <button className="eam-close" onClick={onClose}>×</button>
        </div>

        <div className="eam-body">
          {!selectedModel ? (
            /* ─── 모델 선택 화면 ─── */
            <div className="eam-model-grid">
              {equipmentModels.map((m) => (
                <div
                  key={m.modelId}
                  className="eam-model-card"
                  onClick={() => handleSelectModel(m)}
                >
                  <div className="model-name">{m.modelName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    {m.slots
                      ? `${m.slots.length}개 슬롯 (Mixed)`
                      : m.rows
                      ? `${m.rows.length}개 행 (Row-based)`
                      : m.cardArea
                      ? `${m.cardArea.columns}열 × ${Math.floor(m.cardArea.height / CARD_ROW_HEIGHT)}행 슬롯`
                      : ""
                    }
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ─── 카드 라이브러리 사이드바 ─── */}
              <div className="eam-sidebar">
                <div className="eam-sidebar-title">카드 라이브러리</div>
                {(() => {
                  // 카드 그룹별로 분류하여 표시
                  const hasGroups = filteredCards.some(cd => cd.cardGroup);
                  if (!hasGroups) {
                    // 기존 R4/R6: 그룹 없이 표시
                    return filteredCards.map((cd) => (
                      <div
                        key={cd.cardFileName}
                        className="eam-card-item"
                        style={{
                          borderColor: selectedCard?.cardFileName === cd.cardFileName ? "var(--theme-primary)" : undefined,
                          background: selectedCard?.cardFileName === cd.cardFileName ? "rgba(var(--theme-primary-rgb),.1)" : undefined,
                        }}
                        onClick={() => setSelectedCard(cd)}
                      >
                        <img src={cd.svgUrl} alt={cd.cardType} style={{ width: cd.widthType === "full" ? 80 : 50 }} />
                        <div className="info">
                          <div className="name">{cd.cardType}</div>
                          <span className={`tag ${cd.widthType}`}>{cd.widthType === "full" ? "FULL" : "HALF"}</span>
                        </div>
                      </div>
                    ));
                  }
                  // R6d/R6dl/IXR: 그룹 분리
                  const cpiomCards = filteredCards.filter(cd => cd.cardGroup === "cpiom");
                  const standardCards = filteredCards.filter(cd => cd.cardGroup === "standard" || (!cd.cardGroup && cd.cardGroup !== "ixr"));
                  const ixrCards = filteredCards.filter(cd => cd.cardGroup === "ixr");
                  return (
                    <>
                      {cpiomCards.length > 0 && (
                        <>
                          <div className="eam-sidebar-section">CPIOM 카드</div>
                          {cpiomCards.map((cd) => (
                            <div
                              key={cd.cardFileName}
                              className="eam-card-item"
                              style={{
                                borderColor: selectedCard?.cardFileName === cd.cardFileName ? "#a855f7" : undefined,
                                background: selectedCard?.cardFileName === cd.cardFileName ? "rgba(168,85,247,.1)" : undefined,
                              }}
                              onClick={() => setSelectedCard(cd)}
                            >
                              <img src={cd.svgUrl} alt={cd.cardType} style={{ width: 80 }} />
                              <div className="info">
                                <div className="name">{cd.cardType}</div>
                                <span className="tag cpiom">CPIOM</span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {standardCards.length > 0 && (
                        <>
                          <div className="eam-sidebar-section">Standard 카드</div>
                          {standardCards.map((cd) => (
                            <div
                              key={cd.cardFileName}
                              className="eam-card-item"
                              style={{
                                borderColor: selectedCard?.cardFileName === cd.cardFileName ? "var(--theme-primary)" : undefined,
                                background: selectedCard?.cardFileName === cd.cardFileName ? "rgba(var(--theme-primary-rgb),.1)" : undefined,
                              }}
                              onClick={() => setSelectedCard(cd)}
                            >
                              <img src={cd.svgUrl} alt={cd.cardType} style={{ width: cd.widthType === "full" ? 80 : 50 }} />
                              <div className="info">
                                <div className="name">{cd.cardType}</div>
                                <span className={`tag ${cd.widthType === "full" ? "standard" : cd.widthType}`}>
                                  {cd.widthType === "full" ? "FULL" : "HALF"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {ixrCards.length > 0 && (
                        <>
                          <div className="eam-sidebar-section">IXR 카드</div>
                          {ixrCards.map((cd) => (
                            <div
                              key={cd.cardFileName}
                              className="eam-card-item"
                              style={{
                                borderColor: selectedCard?.cardFileName === cd.cardFileName ? "var(--theme-primary)" : undefined,
                                background: selectedCard?.cardFileName === cd.cardFileName ? "rgba(var(--theme-primary-rgb),.1)" : undefined,
                              }}
                              onClick={() => setSelectedCard(cd)}
                            >
                              <img src={cd.svgUrl} alt={cd.cardType} style={{ width: cd.widthType === "full" ? 80 : 50 }} />
                              <div className="info">
                                <div className="name">{cd.cardType}</div>
                                <span className={`tag ${cd.widthType === "full" ? "standard" : cd.widthType}`}>
                                  {cd.widthType === "full" ? "FULL" : "HALF"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                {selectedCard && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: 8,
                    background: selectedCard.cardGroup === "cpiom" ? "rgba(168,85,247,.08)" : "rgba(var(--theme-primary-rgb),.08)",
                    border: `1px solid ${selectedCard.cardGroup === "cpiom" ? "rgba(168,85,247,.2)" : "rgba(var(--theme-primary-rgb),.2)"}`,
                    fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5,
                  }}>
                    <strong style={{ color: "var(--text-primary)" }}>선택됨:</strong> {selectedCard.cardType}
                    <br />빈 슬롯을 클릭하여 삽입하세요.
                    {selectedCard.cardGroup === "cpiom" && (
                      <div style={{ marginTop: 4, color: "#a855f7", fontSize: 10 }}>CPIOM 전용 슬롯만 삽입 가능</div>
                    )}
                  </div>
                )}
              </div>

              {/* ─── 메인 캔버스 ─── */}
              <div className="eam-main">
                <div className="eam-toolbar">
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    삽입된 카드: {insertedCards.length}
                  </span>
                  <button className="btn danger" onClick={handleClearAll}>
                    전체 제거
                  </button>
                  <button className="btn primary" onClick={handleSave}>
                    저장
                  </button>
                </div>

                <div className="eam-canvas-area">
                  <div className="eam-equip-wrap" ref={equipRef}>
                    {/* Base SVG */}
                    {baseSvgHtml && (
                      <div 
                        className="base-svg-container"
                        dangerouslySetInnerHTML={{ __html: baseSvgHtml }} 
                      />
                    )}

                    {/* 카드 슬롯 오버레이 */}
                    {selectedModel && (
                      <div
                        className="eam-card-area-overlay"
                        style={{
                          left: selectedModel.cardArea ? selectedModel.cardArea.x : 0,
                          top: selectedModel.cardArea ? selectedModel.cardArea.y : 0,
                          width: selectedModel.cardArea ? selectedModel.cardArea.width : (selectedModel.equipmentSize?.width || "100%"),
                          height: selectedModel.cardArea ? selectedModel.cardArea.height : "100%",
                        }}
                      >
                        {isMixedLayout && selectedModel.slots ? (
                          /* ─── Mixed Layout (slots 기반) ─── */
                          selectedModel.slots.map((slot) => {
                            const card = slotOccupiedMap.get(slot.slotId);
                            const isOccupied = !!card;
                            const isBlocked = blockedSlotIds.has(slot.slotId);

                            // blocked 슬롯은 완전히 숨김 (같은 행의 다른 슬롯에 카드가 있을 때)
                            if (isBlocked && !isOccupied) return null;

                            // 하이라이팅 상태 결정
                            const isAvailable = availableSlotIds.has(slot.slotId);
                            const isDimmed = isHighlightActive && !isOccupied && !isAvailable;
                            const isHighlight = isHighlightActive && !isOccupied && isAvailable;

                            // full/half 겹침: full 슬롯은 하이라이트될 때만 표시
                            const hasSmallSiblings = selectedModel.slots!.some(
                              s => s.slotId !== slot.slotId && s.row === slot.row && s.width < slot.width
                            );
                            if (hasSmallSiblings && !isOccupied && !isHighlight) return null;

                            // 슬롯 그룹 라벨
                            const groupLabel = slot.allowedCardGroups?.includes("cpiom") ? "CPIOM" : "";

                            return (
                              <div
                                key={slot.slotId}
                                className={`eam-slot ${isOccupied ? "occupied" : ""} ${isHighlight ? "highlight" : ""} ${isDimmed ? "dimmed" : ""}`}
                                style={{
                                  left: slot.x,
                                  top: slot.y,
                                  width: slot.width,
                                  height: slot.height,
                                }}
                                onClick={() => {
                                  if (card || isDimmed) return;
                                  handleSlotClickMixed(slot);
                                }}
                              >
                                {card ? (
                                  <>
                                    <CardInlineSvg cardFileName={card.cardFileName} />
                                    <button
                                      className="remove-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCard(card.instanceId);
                                      }}
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <span className="slot-label">
                                    {groupLabel ? `${groupLabel} · ${slot.slotId}` : slot.slotId}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : isRowLayout && selectedModel.rows ? (
                          /* ─── Row Layout (rows 기반) ─── */
                          selectedModel.rows.map(row => (
                            <div key={row.rowId} className="eam-row-container" style={{
                              left: row.x,
                              top: row.y,
                              width: row.width,
                              height: row.height,
                            }}>
                              <div className="row-label">R{row.row}</div>
                              {row.subSlots.map(subSlot => {
                                const card = slotOccupiedMap.get(subSlot.slotId);
                                const isOccupied = !!card;
                                const isBlocked = blockedSlotIds.has(subSlot.slotId);

                                if (isBlocked && !isOccupied) return null;

                                const isAvailable = availableSlotIds.has(subSlot.slotId);
                                const isDimmed = isHighlightActive && !isOccupied && !isAvailable;
                                const isHighlight = isHighlightActive && !isOccupied && isAvailable;

                                // full/half 겹침 시 풀 슬롯은 하이라이트될 때만 렌더링
                                const hasSmallSiblings = row.subSlots.some(s => s.slotId !== subSlot.slotId && s.width < subSlot.width);
                                if (hasSmallSiblings && !isOccupied && !isHighlight) return null;

                                return (
                                  <div
                                    key={subSlot.slotId}
                                    className={`eam-slot ${isOccupied ? "occupied" : ""} ${isHighlight ? "highlight" : ""} ${isDimmed ? "dimmed" : ""}`}
                                    style={{
                                      left: subSlot.x,
                                      top: subSlot.y,
                                      width: subSlot.width,
                                      height: subSlot.height,
                                    }}
                                    onClick={() => {
                                      if (card || isDimmed) return;
                                      handleSlotClickRow(row, subSlot);
                                    }}
                                  >
                                    {card ? (
                                      <>
                                        <CardInlineSvg cardFileName={card.cardFileName} />
                                        <button
                                          className="remove-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveCard(card.instanceId);
                                          }}
                                        >
                                          ×
                                        </button>
                                      </>
                                    ) : (
                                      <span className="slot-label">{subSlot.slotId}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        ) : selectedModel.cardArea ? (
                          /* ─── Uniform Grid Layout ─── */
                          slots.map((slot) => {
                            const key = `${slot.row}-${slot.col}`;
                            const card = cardAtSlot.get(key);
                            const isOccupied = occupied.has(key);

                            // full 카드의 두번째 칸은 렌더링 건너뜀
                            if (isOccupied && !card) return null;

                            const slotWidth = card?.widthType === "full"
                              ? selectedModel.cardArea!.columnWidth * 2
                              : selectedModel.cardArea!.columnWidth;

                            return (
                              <div
                                key={key}
                                className={`eam-slot ${isOccupied ? "occupied" : ""}`}
                                style={{
                                  left: slot.x - selectedModel.cardArea!.x,
                                  top: slot.y - selectedModel.cardArea!.y,
                                  width: slotWidth,
                                  height: slot.height,
                                }}
                                onClick={() => {
                                  if (card) return;
                                  handleSlotClick(slot);
                                }}
                              >
                                {card ? (
                                  <>
                                    <CardInlineSvg cardFileName={card.cardFileName} />
                                    <button
                                      className="remove-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCard(card.instanceId);
                                      }}
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <span className="slot-label">
                                    R{slot.row + 1}C{slot.col + 1}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 경고 토스트 */}
      {warning && <div className="eam-warn">{warning}</div>}
    </div>,
    document.body,
  );
};

export default EquipmentAssemblyModal;
