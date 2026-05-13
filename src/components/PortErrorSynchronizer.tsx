import { useEffect, useRef, useMemo } from "react";
import { useStore } from "../store/useStore";
import { resolveDeviceSvgContent } from "../utils/deviceAssets";

/**
 * PortErrorSynchronizer
 * 
 * 에러가 있는 장비의 SVG를 파싱하여 portStates에 portName/portNumber를 보강합니다.
 * 
 * 두 가지 케이스를 처리:
 * 1. Exact match: mock portId(port-5)가 SVG에 그대로 존재 → portName/portNumber만 보강
 * 2. Index fallback: mock portId(port-14)가 SVG에 없음 → SVG의 N번째 포트로 리매핑 + 보강
 * 
 * ⚠️ 모듈러 카드 장비(insertedCards.length > 0)는 EquipmentAssemblyModal.handleSave에서
 *    generatePortMap으로 이미 정확한 portName/portNumber가 생성되므로 enrichment 대상에서 제외합니다.
 *    이를 통해 racks → useEffect → updateDevicePortStates → racks 순환 트리거를 차단합니다.
 */
export const PortErrorSynchronizer = () => {
  const racks = useStore((s) => s.racks);
  const layouts = useStore((s) => s.layouts);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const updateDevicePortStates = useStore((s) => s.updateDevicePortStates);
  const processedRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);

  // Phase 1: racks 전체 참조 대신 장비 fingerprint 기반 의존성
  // → racks 내부 데이터가 변해도 enrichment 대상 장비가 동일하면 useEffect 재실행 방지
  const deviceFingerprint = useMemo(() => {
    const parts: string[] = [];
    for (const rack of racks) {
      for (const device of rack.devices) {
        // 모듈러 카드 장비는 enrichment 대상이 아니므로 fingerprint에서 제외
        if (device.insertedCards && device.insertedCards.length > 0) continue;
        const errorCount = device.portStates.filter(p => p.status === "error").length;
        if (errorCount > 0 && device.modelName) {
          const needsEnrich = device.portStates.some(p => p.status === "error" && !p.portName);
          if (needsEnrich && !processedRef.current.has(device.itemId)) {
            parts.push(`${device.itemId}:${device.modelName}:${errorCount}`);
          }
        }
      }
    }
    return parts.join("|");
  }, [racks]);

  useEffect(() => {
    // fingerprint가 비어있으면 enrichment 대상 없음 — 스킵
    if (!deviceFingerprint) return;

    const synchronizePorts = async () => {
      if (isSyncingRef.current) {
        pendingSyncRef.current = true;
        return;
      }
      isSyncingRef.current = true;
      pendingSyncRef.current = false;

      try {
        const allRacks = [...racks];
        Object.entries(layouts).forEach(([nid, layout]) => {
        if (nid !== activeNodeId) {
          allRacks.push(...(layout.racks || []));
        }
      });

      for (const rack of allRacks) {
        for (const device of rack.devices) {
          // 이미 처리된 장비는 스킵
          if (processedRef.current.has(device.itemId)) continue;

          // 모듈러 카드 장비는 스킵 (EquipmentAssemblyModal에서 이미 포트 정보 생성됨)
          if (device.insertedCards && device.insertedCards.length > 0) {
            processedRef.current.add(device.itemId);
            continue;
          }

          const hasError = device.portStates.some((p) => p.status === "error");
          if (!hasError || !device.modelName) continue;

          // portName이 이미 채워져 있으면 이미 동기화 완료된 것
          const needsEnrichment = device.portStates.some(
            (p) => p.status === "error" && !p.portName
          );
          if (!needsEnrichment) {
            processedRef.current.add(device.itemId);
            continue;
          }

          try {
            const svgContent = await resolveDeviceSvgContent(device.modelName);
            if (!svgContent) continue;

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = svgContent;
            const svgEl = tempDiv.querySelector("svg");
            if (!svgEl) continue;

            const allPortEls = Array.from(
              svgEl.querySelectorAll<SVGPathElement>("[id^='port-']")
            );
            if (allPortEls.length === 0) continue;

            // SVG 포트 ID → element 매핑 테이블 생성
            const svgPortMap = new Map<string, SVGPathElement>();
            allPortEls.forEach((el) => svgPortMap.set(el.id, el));

            let updated = false;
            const newPortStates = device.portStates.map((ps) => {
              if (ps.status !== "error") return ps;
              if (ps.portName) return ps; // portName이 이미 있으면 보강 불필요

              // 1단계: Exact match — SVG에 동일 ID가 존재하는지 확인
              const exactEl = svgPortMap.get(ps.portId);
              if (exactEl) {
                updated = true;
                return {
                  ...ps,
                  portName: exactEl.getAttribute("data-port-name") || undefined,
                  portNumber: exactEl.getAttribute("data-port-number") || undefined,
                };
              }

              // 2단계: Index fallback — port-N 패턴이면 N번째 SVG 포트로 리매핑
              const numMatch = ps.portId.match(/^port-(\d+)$/);
              if (numMatch) {
                const idx = parseInt(numMatch[1], 10) - 1;
                if (idx >= 0 && idx < allPortEls.length) {
                  updated = true;
                  const el = allPortEls[idx];
                  return {
                    ...ps,
                    portId: el.id,
                    portName: el.getAttribute("data-port-name") || undefined,
                    portNumber: el.getAttribute("data-port-number") || undefined,
                  };
                }
              }

              return ps;
            });

            if (updated) {
              processedRef.current.add(device.itemId);
              updateDevicePortStates(device.itemId, newPortStates);
            }
          } catch (e) {
            console.error("Failed to sync ports for", device.modelName, e);
          }
        }
      }
      } finally {
        isSyncingRef.current = false;
        if (pendingSyncRef.current) {
          setTimeout(synchronizePorts, 0);
        }
      }
    };

    let debounceTimer: ReturnType<typeof setTimeout>;

    debounceTimer = setTimeout(() => {
      synchronizePorts();
    }, 300);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [deviceFingerprint, layouts, activeNodeId, updateDevicePortStates]);

  return null;
};
