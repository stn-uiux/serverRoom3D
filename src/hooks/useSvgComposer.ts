/**
 * useSvgComposer – SVG 합성 로직 커스텀 훅
 *
 * 장비 본체 SVG + 카드 SVG + 모듈 SVG를 합성하여 최종 HTML 문자열을 반환합니다.
 * 캐싱을 통해 재열기 시 즉시 렌더링합니다.
 */
import { useEffect, useState, useMemo } from 'react';
import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync } from '../utils/cardAssets';
import { resolveDeviceSvgContent } from '../utils/deviceAssets';
import { moduleDefinitions, loadModuleSvgRaw } from '../utils/moduleAssets';
import { generatePortMap, buildPortStatusMapFromPortStates, applyPortStatuses } from '../utils/portUtils';
import { getElementBBox, prefixSvgIds, filterPortElements, PORT_SELECTOR } from '../utils/svgUtils';
import type { GeneratedPort, InsertedModule } from '../types/equipment';
import type { PortState } from '../types';

const CARD_ROW_HEIGHT = 46;

/** 합성된 SVG HTML 모듈 레벨 캐시 (재열기 시 즉시 렌더링) */
const _composedHtmlCache = new Map<string, string>();

export interface SvgComposerResult {
  composedHtml: string;
  isModularDevice: boolean;
  generatedPorts: GeneratedPort[];
  generatedPortMap: Map<string, GeneratedPort>;
}

export function useSvgComposer(
  modelName: string | undefined,
  insertedCards: any[],
  insertedModules: InsertedModule[],
  portStates: PortState[],
): SvgComposerResult {
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const modulesKey = useMemo(() =>
    insertedModules
      .map(m => `${m.portId}-${m.moduleType}-${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [insertedModules]
  );
  const _cacheKey = `${modelName}::${cardsKey}::${modulesKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() =>
    _composedHtmlCache.get(_cacheKey) || ""
  );

  const equipModel = useMemo(() =>
    equipmentModels.find(m => m.modelName === modelName),
    [modelName]
  );

  const isModularDevice = !!equipModel && insertedCards.length > 0;

  // ─── 카드 SVG raw text 캐시 ───
  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(() => {
    if (!isModularDevice) return new Map();
    const uniqueFileNames = [...new Set(insertedCards.map((c: any) => c.cardFileName))];
    const syncMap = new Map<string, string>();
    for (const fn of uniqueFileNames) {
      const cached = loadCardSvgRawSync(fn);
      if (cached) syncMap.set(fn, cached);
    }
    return syncMap.size === uniqueFileNames.length ? syncMap : new Map();
  });

  // 카드 SVG async fallback
  useEffect(() => {
    if (!isModularDevice || cardSvgMap.size > 0) return;
    let isMounted = true;
    const uniqueFileNames = [...new Set(insertedCards.map((c: any) => c.cardFileName))];
    Promise.all(
      uniqueFileNames.map(async (fn) => {
        const raw = await loadCardSvgRaw(fn);
        return [fn, raw] as const;
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      for (const [fn, raw] of results) { if (raw) map.set(fn, raw); }
      setCardSvgMap(map);
    });
    return () => { isMounted = false; };
  }, [isModularDevice, cardsKey]);

  // ─── 포트 맵 ───
  const generatedPorts = useMemo<GeneratedPort[]>(() => {
    if (!isModularDevice || cardSvgMap.size === 0) return [];
    const ports = generatePortMap(insertedCards, cardSvgMap);
    const statusMap = buildPortStatusMapFromPortStates(portStates);
    return applyPortStatuses(ports, statusMap);
  }, [isModularDevice, insertedCards, cardSvgMap, portStates]);

  // ─── 모듈 SVG raw text 캐시 ───
  const [moduleSvgMap, setModuleSvgMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (insertedModules.length === 0) return;
    let isMounted = true;
    const uniqueFileNames = [...new Set(insertedModules.map(m => m.moduleSvgFileName))];
    Promise.all(
      uniqueFileNames.map(async (fn) => {
        const raw = await loadModuleSvgRaw(fn);
        return [fn, raw] as const;
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      for (const [fn, raw] of results) { if (raw) map.set(fn, raw); }
      setModuleSvgMap(map);
    });
    return () => { isMounted = false; };
  }, [insertedModules]);

  const generatedPortMap = useMemo(() =>
    new Map(generatedPorts.map(p => [p.realPortNumber, p])),
    [generatedPorts]
  );

  // ─── SVG 합성 ───
  useEffect(() => {
    let isMounted = true;

    const compose = async () => {
      try {
        const targetModelName = isModularDevice && equipModel?.baseSvgUrl
          ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
          : modelName;

        const baseSvg = await resolveDeviceSvgContent(targetModelName);
        if (!isMounted || !baseSvg) return;

        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
        const baseSvgEl = baseDoc.querySelector("svg");
        if (!baseSvgEl) { setComposedHtml(baseSvg); return; }

        if (!baseSvgEl.getAttribute('viewBox')) {
          const w = baseSvgEl.getAttribute('width') || '984';
          const h = baseSvgEl.getAttribute('height') || '200';
          baseSvgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
        }
        baseSvgEl.setAttribute("width", "100%");
        baseSvgEl.setAttribute("height", "auto");
        baseSvgEl.style.maxWidth = "880px";
        baseSvgEl.style.display = "block";

        // ─── 카드 합성 ───
        composeCards(baseSvgEl, baseDoc, parser, insertedCards, cardSvgMap, equipModel);

        // ─── 모듈 합성 ───
        composeModules(baseSvgEl, baseDoc, insertedModules);

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        _composedHtmlCache.set(_cacheKey, finalHtml);
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) {
        console.error("Compose Error:", e);
      }
    };

    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, equipModel, isModularDevice, cardSvgMap, moduleSvgMap, insertedModules, _cacheKey]);

  return { composedHtml, isModularDevice, generatedPorts, generatedPortMap };
}

// ─── 내부 합성 헬퍼 ───

function composeCards(
  baseSvgEl: SVGSVGElement,
  baseDoc: Document,
  parser: DOMParser,
  insertedCards: any[],
  cardSvgMap: Map<string, string>,
  equipModel: any,
) {
  for (const card of insertedCards) {
    const raw = cardSvgMap.get(card.cardFileName);
    if (!raw || !equipModel) continue;

    const cardDoc = parser.parseFromString(raw, "image/svg+xml");
    const cardSvgEl = cardDoc.querySelector("svg");
    if (!cardSvgEl) continue;

    let x: number, y: number, cardW: number, cardH: number;

    if (equipModel.slots && card.slotId) {
      const slotDef = equipModel.slots.find((s: any) => s.slotId === card.slotId);
      if (!slotDef || !equipModel.cardArea) continue;
      x = equipModel.cardArea.x + slotDef.x;
      y = equipModel.cardArea.y + slotDef.y;
      cardW = slotDef.width;
      cardH = slotDef.height;
    } else if (equipModel.rows && card.rowId && card.slotId) {
      const rowDef = equipModel.rows.find((r: any) => r.rowId === card.rowId);
      if (!rowDef) continue;
      const subDef = rowDef.subSlots.find((s: any) => s.slotId === card.slotId);
      if (!subDef) continue;
      x = rowDef.x + subDef.x;
      y = rowDef.y + subDef.y;
      cardW = subDef.width;
      cardH = subDef.height;
    } else if (equipModel.cardArea) {
      const row = Math.floor(card.positionIndex / equipModel.cardArea.columns);
      const col = card.positionIndex % equipModel.cardArea.columns;
      x = equipModel.cardArea.x + col * equipModel.cardArea.columnWidth;
      y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
      cardW = card.widthType === "full" ? equipModel.cardArea.columnWidth * 2 : equipModel.cardArea.columnWidth;
      cardH = CARD_ROW_HEIGHT;
    } else {
      continue;
    }

    const vb = cardSvgEl.getAttribute("viewBox");
    const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
    const origW = parts[2] || 100;
    const origH = parts[3] || 20;

    const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
    prefixSvgIds(cardSvgEl, instancePrefix);

    const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
    const scaleX = cardW / origW;
    const scaleY = cardH / origH;
    cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`);
    cardGroup.setAttribute("data-card-instance", instancePrefix);

    // 포트 히트박스 속성 처리
    cardSvgEl.querySelectorAll(".port-hitbox").forEach((hb) => {
      const localPort = hb.getAttribute("data-local-port");
      if (!localPort) return;

      const portType = hb.getAttribute("data-port-type") || hb.getAttribute("data-porttype") || "";
      const uniquePortKey = portType ? `${portType}-${localPort}` : localPort;
      const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;
      hb.setAttribute("data-port-number", realPortNumber);
      hb.setAttribute("data-card-instance", instancePrefix);
    });

    while (cardSvgEl.firstChild) {
      cardGroup.appendChild(cardSvgEl.firstChild);
    }
    baseSvgEl.appendChild(cardGroup);
  }
}

function composeModules(
  baseSvgEl: SVGSVGElement,
  baseDoc: Document,
  insertedModules: InsertedModule[],
) {
  // 전체 포트 엘리먼트 수집
  const allPortEls = filterPortElements(
    Array.from(baseSvgEl.querySelectorAll(PORT_SELECTOR))
  );

  allPortEls.forEach(el => {
    el.setAttribute("pointer-events", "all");
    if (el instanceof SVGElement) el.style.pointerEvents = "all";
  });

  // portId → hitbox 맵핑
  const hitboxesByPortId = new Map<string, SVGElement[]>();
  allPortEls.forEach((hb) => {
    const portId = hb.getAttribute("data-port-number") || hb.id || hb.getAttribute("data-local-port");
    if (!portId) return;
    if (!hitboxesByPortId.has(portId)) hitboxesByPortId.set(portId, []);
    hitboxesByPortId.get(portId)!.push(hb);
  });

  // 각 모듈 렌더링
  insertedModules.forEach((module) => {
    const hbs = hitboxesByPortId.get(module.portId);
    if (!hbs || hbs.length === 0) return;

    const moduleDef = moduleDefinitions.find(m => m.svgFileName === module.moduleSvgFileName);
    if (!moduleDef) return;

    const targetHb = resolveTargetHitbox(hbs, module);
    const bbox = getElementBBox(targetHb);
    const scaleFactor = 1.2;
    const finalW = bbox.w * scaleFactor;
    const finalH = bbox.h * scaleFactor;
    const finalX = bbox.x - (finalW - bbox.w) / 2;
    const finalY = bbox.y - (finalH - bbox.h) / 2;

    const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", moduleDef.svgUrl);
    img.setAttribute("x", finalX.toString());
    img.setAttribute("y", finalY.toString());
    img.setAttribute("width", finalW.toString());
    img.setAttribute("height", finalH.toString());
    img.setAttribute("preserveAspectRatio", "none");
    img.setAttribute("class", "inserted-module");
    img.setAttribute("data-port-id", module.portId);
    img.setAttribute("pointer-events", "none");
    img.style.pointerEvents = "none";

    const parent = targetHb.parentNode;
    if (parent) {
      parent.insertBefore(img, targetHb);
      parent.appendChild(targetHb);
    }
  });
}

/** 복수 hitbox 중 올바른 타겟을 결정 */
function resolveTargetHitbox(hbs: SVGElement[], module: InsertedModule): SVGElement {
  if (hbs.length <= 1) return hbs[0];

  const modType = module.moduleType.toLowerCase();

  // 1순위: 정확한 hitboxId 매칭
  if (module.hitboxId) {
    const exact = hbs.find(hb => hb.id === module.hitboxId);
    if (exact) return exact;
  }

  // 2순위: 모듈 타입 기반 매칭
  const typeMatch = hbs.find(hb => {
    const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
    if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
    if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
    return false;
  });

  return typeMatch || hbs[0];
}
