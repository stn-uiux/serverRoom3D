/**
 * usePortInteraction – 포트 hover/click/tooltip/블링킹 이벤트 바인딩 훅
 *
 * SvgPortView 내부의 거대한 useEffect를 추출한 것입니다.
 * containerRef에 이벤트 리스너를 부착하여 포트 상호작용을 처리합니다.
 */
import { useEffect, useMemo } from 'react';
import type { GeneratedPort } from '../types/equipment';
import { ERROR_COLORS } from '../utils/errorHelpers';
import { ensureKeyframe, isPortId, PORT_SELECTOR, filterPortElements } from '../utils/svgUtils';
import type { PortState } from '../types';

/** 포트 상태별 색상 */
const PORT_STATUS_COLORS: Record<string, string> = {
  normal: "transparent",
  critical: ERROR_COLORS.critical,
  warning: ERROR_COLORS.warning,
  disabled: "#666666",
};

export function usePortInteraction(
  containerRef: React.RefObject<HTMLDivElement | null>,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
  composedHtml: string,
  portStates: PortState[],
  isModularDevice: boolean,
  generatedPorts: GeneratedPort[],
  generatedPortMap: Map<string, GeneratedPort>,
  editable: boolean = true,
) {
  const portStateMap = useMemo(
    () => new Map(portStates.map(p => [p.portId, p])),
    [portStates]
  );

  useEffect(() => {
    let activePortEl: SVGElement | null = null;
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    // ─── SVG 초기 설정 ───
    initializeSvg(container);

    // ─── 포트 스타일 초기화 ───
    const allPortEls = filterPortElements(
      Array.from(container.querySelectorAll(PORT_SELECTOR))
    );
    initializePortStyles(allPortEls, generatedPortMap);

    // ─── 이벤트 핸들러 ───
    const resetHover = () => {
      const tooltip = tooltipRef.current;
      if (activePortEl) {
        resetPortStyle(activePortEl, generatedPortMap);
        activePortEl = null;
      }
      if (tooltip) tooltip.style.display = "none";
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);

      if (portEl && portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) {
        resetHover();
        return;
      }
      if (!portEl) { resetHover(); return; }

      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (activePortEl !== portEl) {
        resetHover();
        activePortEl = portEl;
        applyHoverStyle(portEl);
      }

      // 툴팁 내용 생성
      const { displayType, displayId, statusStr, statusColor } = resolvePortInfo(
        portEl, generatedPortMap, portStateMap
      );

      tooltip.innerHTML = `
        <div style="font-weight:700; font-size:13px; margin-bottom:6px; color:#80deea;">${displayType} ${displayId}</div>
        <div style="font-weight:600; color:${statusColor}; font-size:12px; text-shadow:0 0 4px ${statusColor}40;">${statusStr}</div>
        ${editable ? `<div style="margin-top:4px; font-size:11px; color:#e0f7fa; opacity:0.8;">Click to manage module</div>` : ""}
      `;
      tooltip.style.display = "block";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };

    const handleMouseOut = () => resetHover();

    const handleClick = (e: MouseEvent) => {
      if (!editable) return;
      e.stopPropagation();
      const target = e.target as SVGElement;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);
      if (!portEl) return;
      if (portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) return;

      const realPortNumber = portEl.getAttribute("data-port-number");
      const localPort = portEl.getAttribute("data-local-port");
      const portType = portEl.getAttribute("data-port-type");
      const portId = realPortNumber || portEl.id || localPort || "";
      if (!portId) return;

      const rect = portEl.getBoundingClientRect();
      const popoverEvent = new CustomEvent("port-module-popover", {
        bubbles: true,
        detail: {
          portId,
          portType: portType || "port",
          hitboxId: portEl.id,
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
      });
      container.dispatchEvent(popoverEvent);
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    // ─── 에러 블링킹 ───
    applyErrorBlinking(container, isModularDevice, generatedPorts, portStates);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, portStateMap, portStates, isModularDevice, generatedPortMap, generatedPorts, editable]);

  return portStateMap;
}

// ─── 내부 헬퍼 ───

function initializeSvg(container: HTMLDivElement) {
  const svgEl = container.querySelector("svg");
  if (svgEl) {
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '984';
      const h = svgEl.getAttribute('height') || '200';
      svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
    }
    container.style.transform = "none";
    if (container.parentElement) {
      container.parentElement.style.height = "auto";
      container.parentElement.style.overflow = "visible";
    }
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxWidth = "880px";
    svgEl.style.display = "block";
  }
  container.querySelectorAll("title").forEach(t => t.textContent = "");
}

function initializePortStyles(
  portEls: SVGElement[],
  generatedPortMap: Map<string, GeneratedPort>,
) {
  portEls.forEach((el) => {
    const realPortNumber = el.getAttribute("data-port-number");
    const localPort = el.getAttribute("data-local-port");
    const portId = realPortNumber || el.id || localPort || "";

    if (el.classList.contains("port-hitbox")) {
      if (portId) {
        const gp = generatedPortMap.get(portId);
        if (gp && gp.status !== "normal") {
          const color = PORT_STATUS_COLORS[gp.status] || "transparent";
          el.style.fill = `${color}33`;
          el.style.stroke = color;
          el.style.strokeWidth = "1.5px";
        } else {
          el.style.fill = "transparent";
          el.style.stroke = "none";
        }
      } else {
        el.style.fill = "transparent";
        el.style.stroke = "none";
      }
    }

    el.style.pointerEvents = "all";
    el.style.cursor = "pointer";
  });
}

function resetPortStyle(
  el: SVGElement,
  generatedPortMap: Map<string, GeneratedPort>,
) {
  if (el.classList.contains("port-hitbox")) {
    const realPortNumber = el.getAttribute("data-port-number");
    const localPort = el.getAttribute("data-local-port");
    const portId = realPortNumber || el.id || localPort || "";

    if (portId) {
      const gp = generatedPortMap.get(portId);
      if (gp && gp.status !== "normal") {
        const color = PORT_STATUS_COLORS[gp.status] || "transparent";
        el.style.fill = `${color}33`;
        el.style.stroke = color;
        el.style.strokeWidth = "1.5px";
      } else {
        el.style.fill = "transparent";
        el.style.stroke = "none";
      }
    } else {
      el.style.fill = "transparent";
      el.style.stroke = "none";
    }
  } else {
    el.style.opacity = "1";
    el.style.filter = "none";
  }
}

function applyHoverStyle(portEl: SVGElement) {
  if (portEl.classList.contains("port-hitbox")) {
    const currentFill = portEl.style.fill;
    if (currentFill === "transparent" || !currentFill) {
      portEl.style.fill = "rgba(0, 229, 255, 0.2)";
    } else {
      portEl.style.stroke = "rgba(0, 229, 255, 0.8)";
      portEl.style.strokeWidth = "2px";
    }
  } else {
    portEl.style.opacity = "0.7";
    portEl.style.filter = "drop-shadow(0 0 4px var(--primary-light))";
    portEl.style.cursor = "pointer";
  }
}

interface PortInfo {
  displayType: string;
  displayId: string;
  statusStr: string;
  statusColor: string;
}

function resolvePortInfo(
  portEl: SVGElement,
  generatedPortMap: Map<string, GeneratedPort>,
  portStateMap: Map<string, PortState>,
): PortInfo {
  const realPortNumber = portEl.getAttribute("data-port-number");
  const localPort = portEl.getAttribute("data-local-port");
  const portId = realPortNumber || portEl.id || localPort || "";
  const gp = portId ? generatedPortMap.get(portId) : null;

  let pType = gp?.portType ||
    portEl.getAttribute("data-port-type") ||
    portEl.getAttribute("data-porttype") ||
    portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type") ||
    "";
  let displayId = portId;

  // pType fallback
  if (!pType || pType.toLowerCase() === "port") {
    const fallbackType = portEl.getAttribute("data-port-type") ||
      portEl.getAttribute("data-porttype") ||
      portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type");
    if (fallbackType && fallbackType.toLowerCase() !== "port") {
      pType = fallbackType;
    } else {
      const idMatch = portEl.id.match(/port-(qsfp28|qsfp|sfp|console|mgmt|usb)-/i);
      if (idMatch) pType = idMatch[1];
    }
  }

  // displayId 가공
  if (displayId.includes("port-")) {
    const parts = displayId.split("-");
    if (parts.length >= 3) {
      if (!pType) pType = parts[1];
      displayId = parts.slice(2).join("-");
    } else {
      displayId = displayId.replace(/^port-/, "");
    }
  } else if (/^p\d+$/.test(displayId)) {
    displayId = displayId.replace(/^p/, "");
  }

  // 중복 type 접두어 제거
  if (pType && displayId.includes(`${pType.toLowerCase()}-`)) {
    displayId = displayId.replace(`${pType.toLowerCase()}-`, "");
  }

  const displayType = pType ? pType.toUpperCase() : "PORT";

  // 상태 결정
  let statusStr = "NORMAL";
  let statusColor = "#22c55e";

  if (gp) {
    statusStr = gp.status.toUpperCase();
    statusColor = gp.status === "normal" ? "#22c55e"
      : gp.status === "critical" ? ERROR_COLORS.critical
      : gp.status === "warning" ? ERROR_COLORS.warning
      : "#888";
  } else {
    const ps = portStateMap.get(portId);
    if (ps) {
      statusStr = ps.status.toUpperCase();
      const isError = ps.status === "error";
      if (isError && ps.errorLevel && ERROR_COLORS[ps.errorLevel]) {
        statusColor = ERROR_COLORS[ps.errorLevel];
      } else {
        statusColor = isError ? "#ff4d4d" : "#22c55e";
      }
    } else {
      const stampedLevel = portEl.getAttribute("data-error-level") as keyof typeof ERROR_COLORS | null;
      if (stampedLevel && ERROR_COLORS[stampedLevel]) {
        statusStr = stampedLevel.toUpperCase();
        statusColor = ERROR_COLORS[stampedLevel];
      }
    }
  }

  return { displayType, displayId, statusStr, statusColor };
}

function applyErrorBlinking(
  container: HTMLDivElement,
  isModularDevice: boolean,
  generatedPorts: GeneratedPort[],
  portStates: PortState[],
) {
  if (isModularDevice) {
    generatedPorts.forEach((gp) => {
      if (gp.status === "normal") return;
      const color = PORT_STATUS_COLORS[gp.status] || "#ef4444";
      const el = container.querySelector(`[data-port-number='${gp.realPortNumber}']`) as SVGElement | null;
      if (el) {
        const animName = `blink-${gp.realPortNumber.replace(/[^a-z0-9]/gi, "-")}`;
        ensureKeyframe(animName, color);
        el.style.animation = `${animName} 1.5s infinite`;
        el.setAttribute("data-error-level", gp.status);
      }
    });
  } else {
    portStates.filter(p => p.status === "error").forEach((ps) => {
      const color = ps.errorLevel && ERROR_COLORS[ps.errorLevel] ? ERROR_COLORS[ps.errorLevel] : "#ef4444";
      const el = container.querySelector(`[id='${ps.portId}']`) as SVGElement | null;
      if (el) {
        const animName = `blink-${ps.portId.replace(/[^a-z0-9]/gi, "-")}`;
        ensureKeyframe(animName, color);
        el.style.animation = `${animName} 1.5s infinite`;
        el.setAttribute("data-error-level", ps.errorLevel || "critical");
      }
    });
  }
}
