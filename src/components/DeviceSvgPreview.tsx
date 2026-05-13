/**
 * DeviceSvgPreview — 재사용 가능한 장비 SVG 프리뷰 + 모듈 설정 컴포넌트
 *
 * DeviceModal과 RegistrationFormModal에서 공통으로 사용.
 * SVG 합성(베이스 + 카드 + 모듈) 및 포트 클릭 → 모듈 팝오버 처리.
 */
import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync } from '../utils/cardAssets';
import { resolveDeviceSvgContent } from '../utils/deviceAssets';
import type { InsertedCard, InsertedModule } from '../types/equipment';
import { moduleDefinitions } from '../utils/moduleAssets';

const CARD_ROW_HEIGHT = 46;

function getElementBBox(el: Element): { x: number; y: number; w: number; h: number } {
  const xAttr = el.getAttribute("x");
  const yAttr = el.getAttribute("y");
  const wAttr = el.getAttribute("width");
  const hAttr = el.getAttribute("height");
  if (xAttr && yAttr && wAttr && hAttr) {
    return { x: parseFloat(xAttr), y: parseFloat(yAttr), w: parseFloat(wAttr), h: parseFloat(hAttr) };
  }
  const d = el.getAttribute("d");
  if (d) {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (nums && nums.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i])) { minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]); }
        if (nums[i + 1] !== undefined && !isNaN(nums[i + 1])) { minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]); }
      }
      if (minX !== Infinity) return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
  const cx = el.getAttribute("cx"); const cy = el.getAttribute("cy"); const r = el.getAttribute("r");
  if (cx && cy && r) { const rv = parseFloat(r); return { x: parseFloat(cx) - rv, y: parseFloat(cy) - rv, w: rv * 2, h: rv * 2 }; }
  return { x: 0, y: 0, w: 20, h: 20 };
}

function prefixSvgIds(svgEl: Element, prefix: string) {
  const idMap = new Map<string, string>();
  svgEl.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id")!;
    if (oldId === "ports-layer" || oldId === "port-layer") return;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  });
  if (idMap.size === 0) return;
  svgEl.querySelectorAll("*").forEach((el) => {
    for (const attr of ["fill", "stroke", "clip-path", "mask", "filter"]) {
      const val = el.getAttribute(attr);
      if (val && val.includes("url(#")) {
        let updated = val;
        idMap.forEach((newId, oldId) => { updated = updated.replace(`url(#${oldId})`, `url(#${newId})`); });
        if (updated !== val) el.setAttribute(attr, updated);
      }
    }
    for (const attr of ["href", "xlink:href"]) {
      const val = el.getAttribute(attr);
      if (val && val.startsWith("#")) { const newId = idMap.get(val.slice(1)); if (newId) el.setAttribute(attr, `#${newId}`); }
    }
    const styleVal = el.getAttribute("style");
    if (styleVal && styleVal.includes("url(#")) {
      let updated = styleVal;
      idMap.forEach((newId, oldId) => {
        updated = updated.replace(new RegExp(`url\\(#${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), `url(#${newId})`);
      });
      if (updated !== styleVal) el.setAttribute("style", updated);
    }
  });
}

// ── 합성 캐시 ──
const _previewCache = new Map<string, string>();

export interface DeviceSvgPreviewProps {
  modelName?: string;
  insertedCards?: InsertedCard[];
  insertedModules?: InsertedModule[];
  onModuleChange?: (modules: InsertedModule[]) => void;
  /** true이면 포트 클릭으로 모듈 편집 가능 */
  editable?: boolean;
  maxWidth?: string;
}

export const DeviceSvgPreview = memo(({
  modelName,
  insertedCards = [],
  insertedModules = [],
  onModuleChange,
  editable = true,
  maxWidth = "100%",
}: DeviceSvgPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const modulesKey = useMemo(() => 
    insertedModules
      .map(m => `${m.portId}:${m.moduleType}:${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [insertedModules]
  );
  const cacheKey = `${modelName}::${cardsKey}::${modulesKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() => _previewCache.get(cacheKey) || "");

  const equipModel = useMemo(() => equipmentModels.find(m => m.modelName === modelName), [modelName]);

  // 모델 변경 시 HTML 초기화
  useEffect(() => {
    setComposedHtml("");
  }, [modelName]);

  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(new Map());

  // 카드 SVG 로딩 - 필요한 모든 카드 SVG가 로드될 때까지 실행
  useEffect(() => {
    if (insertedCards.length === 0) {
      if (cardSvgMap.size > 0) setCardSvgMap(new Map());
      return;
    }

    const uniqueFns = [...new Set(insertedCards.map(c => c.cardFileName))];
    const missingFns = uniqueFns.filter(fn => !cardSvgMap.has(fn));

    if (missingFns.length === 0) return;

    let isMounted = true;
    Promise.all(missingFns.map(async fn => {
      const raw = await loadCardSvgRaw(fn);
      return [fn, raw] as const;
    })).then(results => {
      if (!isMounted) return;
      setCardSvgMap(prev => {
        const next = new Map(prev);
        results.forEach(([fn, raw]) => {
          if (raw) next.set(fn, raw);
        });
        return next;
      });
    });

    return () => { isMounted = false; };
  }, [cardsKey, cardSvgMap.size]); // cardsKey가 변경되거나 맵 크기가 변할 때 체크

  // SVG 합성
  useEffect(() => {
    if (!modelName) return;
    // 모든 카드가 로드되었는지 확인
    const allCardsLoaded = insertedCards.every(c => cardSvgMap.has(c.cardFileName));
    
    // 모듈이 없고 모든 카드가 로드된 상태에서 유효한 캐시 히트일 때만 캐시 사용
    if (allCardsLoaded && insertedModules.length === 0 && _previewCache.has(cacheKey)) {
      const cached = _previewCache.get(cacheKey)!;
      if (composedHtml !== cached) setComposedHtml(cached);
      return;
    }
    let isMounted = true;
    const compose = async () => {
      try {
        // 실제로 카드가 삽입된 경우에만 modular 베이스 SVG 사용
        const isModularDevice = insertedCards.length > 0;
        
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
        if (maxWidth) {
          baseSvgEl.style.maxWidth = maxWidth;
        }
        baseSvgEl.style.display = "block";

        // 카드 합성
        for (const card of insertedCards) {
          const raw = cardSvgMap.get(card.cardFileName);
          if (!raw || !equipModel) continue;
          const cardDoc = parser.parseFromString(raw, "image/svg+xml");
          const cardSvgEl = cardDoc.querySelector("svg");
          if (!cardSvgEl) continue;

          let x: number, y: number, cardW: number, cardH: number;
          if (equipModel.slots && card.slotId) {
            const slotDef = equipModel.slots.find(s => s.slotId === card.slotId);
            if (!slotDef || !equipModel.cardArea) continue;
            x = equipModel.cardArea.x + slotDef.x; y = equipModel.cardArea.y + slotDef.y;
            cardW = slotDef.width; cardH = slotDef.height;
          } else if (equipModel.rows && card.rowId && card.slotId) {
            const rowDef = equipModel.rows.find(r => r.rowId === card.rowId);
            if (!rowDef) continue;
            const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
            if (!subDef) continue;
            x = rowDef.x + subDef.x; y = rowDef.y + subDef.y; cardW = subDef.width; cardH = subDef.height;
          } else if (equipModel.cardArea) {
            const row = Math.floor(card.positionIndex / equipModel.cardArea.columns);
            const col = card.positionIndex % equipModel.cardArea.columns;
            x = equipModel.cardArea.x + col * equipModel.cardArea.columnWidth;
            y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
            cardW = card.widthType === "full" ? equipModel.cardArea.columnWidth * 2 : equipModel.cardArea.columnWidth;
            cardH = CARD_ROW_HEIGHT;
          } else continue;

          const vb = cardSvgEl.getAttribute("viewBox");
          const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
          const origW = parts[2] || 100; const origH = parts[3] || 20;
          const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
          prefixSvgIds(cardSvgEl, instancePrefix);

          const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${cardW / origW}, ${cardH / origH})`);
          cardGroup.setAttribute("data-card-instance", instancePrefix);

          // 포트 히트박스 속성 처리
          cardSvgEl.querySelectorAll(".port-hitbox").forEach(hb => {
            const localPort = hb.getAttribute("data-local-port");
            if (!localPort) return;

            // 사용자의 제안대로 type + port 조합으로 고유 식별자 생성
            const portType = hb.getAttribute("data-port-type") || hb.getAttribute("data-porttype") || "";
            const uniquePortKey = portType ? `${portType}-${localPort}` : localPort;

            const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;
            hb.setAttribute("data-port-number", realPortNumber);
            hb.setAttribute("data-card-instance", instancePrefix);
          });

          while (cardSvgEl.firstChild) {
            const child = baseDoc.adoptNode(cardSvgEl.firstChild);
            cardGroup.appendChild(child);
          }
          baseSvgEl.appendChild(cardGroup);
        }

        // 전체 포트에 대해 모듈 합성
        const allPortEls = Array.from(baseSvgEl.querySelectorAll("[id*='port-'], [id^='p'], .port-hitbox")).filter(el => {
          const id = el.id;
          if (el.classList.contains("port-hitbox")) return true;
          if (!id || id === "ports-layer" || id === "port-layer") return false;
          return id.includes("port-") || /^p\d+$/.test(id);
        }) as SVGElement[];

        const hitboxesByPortId = new Map<string, SVGElement[]>();
        allPortEls.forEach(hb => {
          // 모든 포트 엘리먼트에 기본적으로 pointer-events="all" 부여 (상호작용 보장)
          hb.setAttribute("pointer-events", "all");
          hb.style.pointerEvents = "all";

          const portId = hb.getAttribute("data-port-number") || hb.id || hb.getAttribute("data-local-port");
          if (!portId) return;
          if (!hitboxesByPortId.has(portId)) hitboxesByPortId.set(portId, []);
          hitboxesByPortId.get(portId)!.push(hb);
        });

        // 삽입된 모든 모듈 렌더링
        insertedModules.forEach((mod) => {
          const hbs = hitboxesByPortId.get(mod.portId);
          if (!hbs || hbs.length === 0) return;

          const moduleDef = moduleDefinitions.find(m => m.svgFileName === mod.moduleSvgFileName);
          if (moduleDef) {
            const modType = mod.moduleType.toLowerCase();
            let targetHb = hbs[0];
            
            if (hbs.length > 1) {
              // 1순위: 클릭했던 정확한 hitboxId 우선 매칭
              if (mod.hitboxId) {
                const exactHb = hbs.find(hb => hb.id === mod.hitboxId);
                if (exactHb) {
                  targetHb = exactHb;
                } else {
                  // hitboxId 매칭 실패 시 fallback (모듈 타입 기반)
                  const exactMatch = hbs.find(hb => {
                    const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                    if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                    if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                    return false;
                  });
                  if (exactMatch) targetHb = exactMatch;
                }
              } else {
                // 이전 방식 fallback (명시적 hitboxId가 없을 때)
                const exactMatch = hbs.find(hb => {
                  const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                  if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                  if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                  return false;
                });
                if (exactMatch) targetHb = exactMatch;
              }
            }

            const bbox = getElementBBox(targetHb);
            const sf = 1.2;
            const fw = bbox.w * sf, fh = bbox.h * sf;
            const fx = bbox.x - (fw - bbox.w) / 2, fy = bbox.y - (fh - bbox.h) / 2;
            
            const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
            img.setAttribute("href", moduleDef.svgUrl);
            img.setAttribute("x", fx.toString()); img.setAttribute("y", fy.toString());
            img.setAttribute("width", fw.toString()); img.setAttribute("height", fh.toString());
            img.setAttribute("preserveAspectRatio", "none");
            img.setAttribute("class", "inserted-module");
            // 스타일과 속성 모두에 pointer-events: none 설정하여 이벤트를 절대 방해하지 않게 함
            img.setAttribute("pointer-events", "none");
            img.style.pointerEvents = "none";
            
            // 이미지 삽입 후, 히트박스를 이미지 뒤(DOM 순서상 나중)로 다시 옮겨서 렌더링상 최상단 보장
            const parent = targetHb.parentNode;
            if (parent) {
              parent.insertBefore(img, targetHb);
              // targetHb를 다시 appendChild 하여 이미지보다 뒤에 오게 함 (렌더링은 위에 됨)
              parent.appendChild(targetHb);
            }
          }
        });

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        
        // 모든 카드가 정상적으로 로드된 경우에만 캐시 저장
        if (allCardsLoaded && insertedModules.length === 0) {
          _previewCache.set(cacheKey, finalHtml);
        }
        
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) { console.error("DeviceSvgPreview compose error:", e); }
    };
    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, modulesKey, equipModel, cardSvgMap, cacheKey]);

  // 모듈 팝오버 상태
  const [popover, setPopover] = useState<{ portId: string; portType: string; hitboxId?: string; x: number; y: number } | null>(null);

  // SVG 스타일 + 포트 인터랙션
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    const svgEl = container.querySelector("svg");
    if (svgEl) {
      if (!svgEl.getAttribute('viewBox')) {
        const w = svgEl.getAttribute('width') || '984';
        const h = svgEl.getAttribute('height') || '200';
        svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
      }
      container.style.transform = "none";
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.maxWidth = maxWidth;
      svgEl.style.display = "block";
    }
    container.querySelectorAll("title").forEach(t => t.textContent = "");

    // 포트 요소 수집
    const allPortEls = Array.from(container.querySelectorAll("[id*='port-'], [id^='p'], .port-hitbox")).filter(el => {
      const id = (el as HTMLElement).id;
      if (el.classList.contains("port-hitbox")) return true;
      if (!id || id === "ports-layer" || id === "port-layer") return false;
      return id.includes("port-") || /^p\d+$/.test(id);
    }) as SVGElement[];

    allPortEls.forEach(el => {
      el.style.fill = "transparent";
      el.style.stroke = "none";
      el.style.pointerEvents = "all";
      el.style.cursor = editable ? "pointer" : "default";
    });

    if (!editable) return;

    // hover 처리
    let hoveredEl: SVGElement | null = null;
    let origFill = "", origStroke = "", origStrokeWidth = "";

    const getTooltip = () => {
      // 1. 컨테이너 내부 툴팁 시도
      let tt = container.querySelector(".port-tooltip") as HTMLElement | null;
      if (tt) return tt;
      // 2. 부모 형제 요소에서 찾기 (현재 구조)
      tt = container.parentElement?.querySelector(".port-tooltip") as HTMLElement | null;
      if (tt) return tt;
      // 3. 더 상위 모달 컨텐츠에서 찾기 (안전책)
      return container.closest(".modal-content, .device-registration-modal")?.querySelector(".port-tooltip") as HTMLElement | null;
    };

    const resetHover = () => {
      const tooltip = getTooltip();
      if (hoveredEl) {
        hoveredEl.style.fill = origFill; hoveredEl.style.stroke = origStroke; hoveredEl.style.strokeWidth = origStrokeWidth;
        hoveredEl = null;
      }
      if (tooltip) tooltip.style.display = "none";
    };

    const findPortEl = (e: MouseEvent): SVGElement | null => {
      const target = e.target as SVGElement;
      const isPortId = (id: string) => (id.includes("port-") && id !== "ports-layer" && id !== "port-layer") || /^p\d+$/.test(id);
      const portEl = target.closest<SVGElement>("[id*='port-'], [id^='p'], .port-hitbox");
      if (portEl && portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) return null;
      return portEl;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const portEl = findPortEl(e);
      if (!portEl) { resetHover(); return; }
      if (hoveredEl && hoveredEl !== portEl) resetHover();
      if (hoveredEl !== portEl) {
        hoveredEl = portEl;
        origFill = portEl.style.fill; origStroke = portEl.style.stroke; origStrokeWidth = portEl.style.strokeWidth;
        portEl.style.fill = "rgba(0, 229, 255, 0.25)";
        portEl.style.stroke = "rgba(0, 229, 255, 0.7)";
        portEl.style.strokeWidth = "1.5px";
      }

      const tooltip = getTooltip();
      if (tooltip) {
        const realPortNumber = portEl.getAttribute("data-port-number");
        const localPort = portEl.getAttribute("data-local-port");
        const portType = portEl.getAttribute("data-port-type") || "PORT";
        const portId = realPortNumber || portEl.id || localPort || "";
        const displayId = portId.replace(/^.*port-/, "").replace(/^p/, "");

        tooltip.innerHTML = `
          <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#80deea;">${portType.toUpperCase()} ${displayId}</div>
          <div style="font-size:11px; color:#e0f7fa; opacity:0.8;">Click to manage module</div>
        `;
        tooltip.style.display = "block";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const tooltip = getTooltip();
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };

    const handleMouseOut = () => resetHover();

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      const portEl = findPortEl(e);
      if (!portEl) return;
      const portId = portEl.getAttribute("data-port-number") || portEl.id || "";
      if (!portId) return;
      const portType = portEl.getAttribute("data-port-type") || "port";
      const rect = portEl.getBoundingClientRect();
      setPopover({ portId, portType, hitboxId: portEl.id, x: rect.left + rect.width / 2, y: rect.top });
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, editable, maxWidth]);

  // 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!popover) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".module-popover, .port-hitbox, [id*='port-'], [id^='p']")) return;
      setPopover(null);
    };
    const timer = setTimeout(() => window.addEventListener("click", handle, { capture: true }), 50);
    return () => { clearTimeout(timer); window.removeEventListener("click", handle, { capture: true }); };
  }, [popover]);

  const handleInsertModule = useCallback((portId: string, moduleType: InsertedModule["moduleType"], hitboxId?: string) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;
    const newModule: InsertedModule = { portId, moduleType, moduleSvgFileName: moduleDef.svgFileName, hitboxId };
    const updated = [...insertedModules.filter(m => m.portId !== portId), newModule];
    onModuleChange?.(updated);
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    onModuleChange?.(insertedModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const existingModule = popover ? insertedModules.find(m => m.portId === popover.portId) : null;

  if (!modelName) return null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0 }} dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined} />

      <div className="port-tooltip" style={{
        position: "fixed", pointerEvents: "none", display: "none",
        backgroundColor: "rgba(4, 15, 33, 0.95)",
        color: "#e0f7fa",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "12px",
        zIndex: 10001,
        border: "1px solid rgba(0, 229, 255, 0.5)",
        boxShadow: "0 0 10px rgba(0, 229, 255, 0.2)",
        backdropFilter: "blur(4px)",
      }} />

      {/* 모듈 팝오버 */}
      {/* 모듈 팝오버 - Portal로 렌더링하여 잘림 방지 */}
      {popover && editable && createPortal(
        <div
          className="module-popover"
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", 
            left: popover.x, 
            top: popover.y + 30, // 포트 아래쪽에 표시
            transform: "translateX(-50%)",
            backgroundColor: "rgba(10, 20, 40, 0.98)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "12px", padding: "12px", zIndex: 11000,
            display: "flex", flexDirection: "column", gap: "8px",
            minWidth: "180px",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 229, 255, 0.2)",
            backdropFilter: "blur(16px)", animation: "eam-fi .15s ease-out",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#80deea", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            {popover.portType.toUpperCase()} — 모듈 선택
          </div>
          {existingModule && (
            <div style={{ fontSize: "11px", color: "#a5d6a7", padding: "4px 8px", borderRadius: "6px",
              backgroundColor: "rgba(76, 175, 80, 0.12)", border: "1px solid rgba(76, 175, 80, 0.25)", marginBottom: "2px" }}>
              현재: {existingModule.moduleType === "ethernet" ? "Ethernet" : "SFP"}
            </div>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            {moduleDefinitions.map(md => (
              <button key={md.moduleType} onClick={() => handleInsertModule(popover.portId, md.moduleType)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  padding: "8px 6px", borderRadius: "8px",
                  border: existingModule?.moduleType === md.moduleType ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                  background: existingModule?.moduleType === md.moduleType ? "rgba(0, 229, 255, 0.1)" : "rgba(255,255,255,0.04)",
                  cursor: "pointer", color: "#e0f7fa", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0, 229, 255, 0.12)"; e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)"; }}
                onMouseLeave={e => {
                  if (existingModule?.moduleType !== md.moduleType) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }
                }}
              >
                <img src={md.svgUrl} alt={md.displayName} style={{ width: 28, height: 22, objectFit: "contain" }} />
                {md.displayName}
              </button>
            ))}
          </div>
          {existingModule && (
            <button onClick={() => handleRemoveModule(popover.portId, popover.hitboxId)}
              style={{
                padding: "6px 12px", borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)",
                color: "#ef4444", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"; }}
            >
              모듈 제거
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});
