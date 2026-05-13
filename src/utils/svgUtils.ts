/**
 * SVG 유틸리티 함수 모음
 * - getElementBBox: SVG 요소의 바운딩 박스 추출
 * - prefixSvgIds: SVG ID 충돌 방지를 위한 프리픽싱
 * - ensureKeyframe: 동적 CSS keyframe 주입
 */

/** SVG 요소(rect, path, circle 등)에서 BBox를 추출하는 헬퍼 */
export function getElementBBox(el: Element): { x: number; y: number; w: number; h: number } {
  const xAttr = el.getAttribute("x");
  const yAttr = el.getAttribute("y");
  const wAttr = el.getAttribute("width");
  const hAttr = el.getAttribute("height");

  if (xAttr && yAttr && wAttr && hAttr) {
    return {
      x: parseFloat(xAttr),
      y: parseFloat(yAttr),
      w: parseFloat(wAttr),
      h: parseFloat(hAttr),
    };
  }

  const d = el.getAttribute("d");
  if (d) {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (nums && nums.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i])) {
          minX = Math.min(minX, nums[i]);
          maxX = Math.max(maxX, nums[i]);
        }
        if (nums[i + 1] !== undefined && !isNaN(nums[i + 1])) {
          minY = Math.min(minY, nums[i + 1]);
          maxY = Math.max(maxY, nums[i + 1]);
        }
      }
      if (minX !== Infinity) {
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    }
  }

  const cx = el.getAttribute("cx");
  const cy = el.getAttribute("cy");
  const r = el.getAttribute("r");
  if (cx && cy && r) {
    const rv = parseFloat(r);
    return { x: parseFloat(cx) - rv, y: parseFloat(cy) - rv, w: rv * 2, h: rv * 2 };
  }

  return { x: 0, y: 0, w: 20, h: 20 };
}

/**
 * SVG 내부 id 속성들을 instancePrefix로 프리픽싱하여 충돌 방지.
 * id="foo" → id="instancePrefix-foo"
 * url(#foo) → url(#instancePrefix-foo)
 * href="#foo" → href="#instancePrefix-foo"
 */
export function prefixSvgIds(svgEl: Element, prefix: string) {
  const idMap = new Map<string, string>();

  // 1차: 모든 id 수집 및 치환
  svgEl.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id")!;
    // ports-layer 같은 구조적 id는 제외
    if (oldId === "ports-layer" || oldId === "port-layer") return;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  });

  if (idMap.size === 0) return;

  // 2차: url(#id) 및 href="#id" 참조 갱신
  const allElements = svgEl.querySelectorAll("*");
  allElements.forEach((el) => {
    // fill, stroke, clip-path 등의 url(#id) 참조
    for (const attr of ["fill", "stroke", "clip-path", "mask", "filter"]) {
      const val = el.getAttribute(attr);
      if (val && val.includes("url(#")) {
        let updated = val;
        idMap.forEach((newId, oldId) => {
          updated = updated.replace(`url(#${oldId})`, `url(#${newId})`);
        });
        if (updated !== val) el.setAttribute(attr, updated);
      }
    }
    // xlink:href 및 href 참조
    for (const attr of ["href", "xlink:href"]) {
      const val = el.getAttribute(attr);
      if (val && val.startsWith("#")) {
        const refId = val.slice(1);
        const newId = idMap.get(refId);
        if (newId) el.setAttribute(attr, `#${newId}`);
      }
    }
    // style 속성 내 url(#id)
    const styleVal = el.getAttribute("style");
    if (styleVal && styleVal.includes("url(#")) {
      let updated = styleVal;
      idMap.forEach((newId, oldId) => {
        updated = updated.replace(
          new RegExp(`url\\(#${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
          `url(#${newId})`
        );
      });
      if (updated !== styleVal) el.setAttribute("style", updated);
    }
  });
}

/** 동적 CSS @keyframes 주입 (에러 블링킹 애니메이션용) */
export function ensureKeyframe(name: string, color: string) {
  const styleId = `style-${name}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @keyframes ${name} {
      0% { fill: ${color}22; stroke: ${color}; stroke-width: 1px; }
      50% { fill: ${color}aa; stroke: ${color}; stroke-width: 3px; }
      100% { fill: ${color}22; stroke: ${color}; stroke-width: 1px; }
    }
  `;
  document.head.appendChild(style);
}

/** 포트 ID인지 판별하는 유틸 */
export function isPortId(id: string): boolean {
  return (id.includes("port-") && id !== "ports-layer" && id !== "port-layer") || /^p\d+$/.test(id);
}

/** 포트 셀렉터: SVG 내부에서 포트 요소를 찾는 공통 쿼리 */
export const PORT_SELECTOR = "[id*='port-'], [id^='p'], .port-hitbox";

/** 포트 요소 목록을 필터링하여 실제 포트만 반환 */
export function filterPortElements(elements: Element[]): SVGElement[] {
  return elements.filter(el => {
    const id = el.id;
    if (el.classList.contains("port-hitbox")) return true;
    if (!id || id === "ports-layer" || id === "port-layer") return false;
    return id.includes("port-") || /^p\d+$/.test(id);
  }) as SVGElement[];
}
