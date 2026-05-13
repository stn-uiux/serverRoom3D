import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useSvgComposer } from '../hooks/useSvgComposer';
import { usePortInteraction } from '../hooks/usePortInteraction';
import { ModulePopover } from './ModulePopover';
import type { ModulePopoverData } from './ModulePopover';
import type { InsertedModule, ModuleType } from '../types/equipment';
import { moduleDefinitions } from '../utils/moduleAssets';
import type { Device, PortState } from '../types';
import './DeviceModal.css';

// ─── SvgPortView ─── (SVG 프리뷰 + 포트 상호작용)
const SvgPortView = memo(({ device, portStates, tooltipRef }: {
  device: Device;
  portStates: PortState[];
  tooltipRef: React.RefObject<HTMLDivElement>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { composedHtml, isModularDevice, generatedPorts, generatedPortMap } = useSvgComposer(
    device.modelName,
    device.insertedCards || [],
    device.insertedModules || [],
    portStates,
  );

  usePortInteraction(
    containerRef,
    tooltipRef,
    composedHtml,
    portStates,
    isModularDevice,
    generatedPorts,
    generatedPortMap,
  );

  return (
    <div
      ref={containerRef}
      className="svg-port-view-container"
      dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined}
    />
  );
});

// ─── DeviceModal ───
export const DeviceModal = ({ deviceId, onClose }: { deviceId: string; onClose: () => void }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Store 셀렉터
  const { rawDevice, rackName } = useStore(useShallow(useCallback((s) => {
    if (!deviceId) return { rawDevice: null, rackName: "" };
    for (const r of s.racks) {
      const d = r.devices.find(d => d.itemId === deviceId || d.deviceId === deviceId);
      if (d) return { rawDevice: d, rackName: r.rackTitle || `Rack ${r.rackId.slice(0, 4).toUpperCase()}` };
    }
    return { rawDevice: null, rackName: "" };
  }, [deviceId])));

  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);

  // device 참조 안정화
  const prevDeviceRef = useRef<{ device: Device | null; key: string }>({ device: null, key: "" });
  const device = useMemo(() => {
    if (!rawDevice) {
      prevDeviceRef.current = { device: null, key: "" };
      return null;
    }
    const newKey = `${rawDevice.itemId}::${rawDevice.modelName}::${rawDevice.insertedCards?.length ?? 0}::${rawDevice.insertedCards?.[0]?.instanceId ?? ""}::${rawDevice.portStates.length}::${rawDevice.portStates.filter(p => p.status === 'error').length}::${rawDevice.dashboardThumbnailUrl?.length ?? 0}::${rawDevice.insertedModules?.length ?? 0}`;
    if (prevDeviceRef.current.key === newKey && prevDeviceRef.current.device) {
      return prevDeviceRef.current.device;
    }
    const stable = rawDevice as unknown as Device;
    prevDeviceRef.current = { device: stable, key: newKey };
    return stable;
  }, [rawDevice]);

  const devicePortStates = useMemo(() => device?.portStates || [], [device]);

  // ─── 모듈 상태 관리 ───
  const [modulePopover, setModulePopover] = useState<ModulePopoverData | null>(null);
  const [localModules, setLocalModules] = useState<InsertedModule[]>([]);

  useEffect(() => {
    if (device?.insertedModules) {
      setLocalModules(device.insertedModules);
    } else {
      setLocalModules([]);
    }
  }, [device?.itemId]);

  const deviceWithModules = useMemo(() => {
    if (!device) return null;
    return { ...device, insertedModules: localModules };
  }, [device, localModules]);

  // ─── 팝오버 이벤트 수신 ───
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;
    const handlePopover = (e: Event) => setModulePopover((e as CustomEvent).detail);
    container.addEventListener("port-module-popover", handlePopover);
    return () => container.removeEventListener("port-module-popover", handlePopover);
  }, []);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!modulePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".module-popover, .port-hitbox, [id*='port-'], [id^='p']")) return;
      setModulePopover(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClickOutside, { capture: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickOutside, { capture: true });
    };
  }, [modulePopover]);

  // ─── 모듈 삽입/제거 ───
  const handleInsertModule = useCallback((portId: string, moduleType: ModuleType, hitboxId?: string) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;

    const newModule: InsertedModule = {
      portId,
      moduleType,
      moduleSvgFileName: moduleDef.svgFileName,
      hitboxId,
    };

    setLocalModules(prev => {
      const filtered = prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      return [...filtered, newModule];
    });
    setModulePopover(null);

    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = [...currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId), newModule];
      generateThumbnail().then(thumbUrl => {
        updateRegisteredDevice(device.deviceId!, {
          insertedModules: updated,
          dashboardThumbnailUrl: thumbUrl || device.dashboardThumbnailUrl,
        });
      });
    }
  }, [device, updateRegisteredDevice]);

  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    setLocalModules(prev => prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setModulePopover(null);

    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      generateThumbnail().then(thumbUrl => {
        updateRegisteredDevice(device.deviceId!, {
          insertedModules: updated,
          dashboardThumbnailUrl: thumbUrl || device.dashboardThumbnailUrl,
        });
      });
    }
  }, [device, updateRegisteredDevice]);

  const getModuleForPort = useCallback((portId: string, hitboxId?: string) => {
    return localModules.find(m => hitboxId ? m.hitboxId === hitboxId : m.portId === portId);
  }, [localModules]);

  // ─── 썸네일 생성 ───
  const generateThumbnail = async (): Promise<string> => {
    if (!svgContainerRef.current) return "";
    try {
      const svgEl = svgContainerRef.current.querySelector("svg");
      if (!svgEl) return "";

      const clonedSvg = svgEl.cloneNode(true) as SVGElement;
      const vb = clonedSvg.getAttribute("viewBox") || "0 0 984 200";
      const parts = vb.split(/\s+/).map(Number);
      clonedSvg.setAttribute("width", (parts[2] || 984).toString());
      clonedSvg.setAttribute("height", (parts[3] || 200).toString());

      const svgStr = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const SCALE = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * SCALE;
      canvas.height = img.naturalHeight * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/webp", 0.8);
      URL.revokeObjectURL(url);
      return dataUrl;
    } catch (e) {
      console.error("[DeviceModal] Failed to generate thumbnail:", e);
      return "";
    }
  };

  if (!device || !deviceWithModules) return null;

  const existingModule = modulePopover ? getModuleForPort(modulePopover.portId, modulePopover.hitboxId) : undefined;

  return createPortal(
    <div className="device-modal-overlay" onClick={onClose}>
      <div className="device-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="device-modal-header">
          <div className="device-modal-header-inner">
            <div className="device-modal-title-row">
              <h2 className="device-modal-title">{device.title}</h2>
              <button className="device-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="device-modal-meta">
              <span className="device-type-badge">{device.type || "Router"}</span>
              <span className="device-rack-info">Rack: {rackName || device.rackId || "Unknown"}</span>
              {localModules.length > 0 && (
                <span className="module-count-badge">모듈 {localModules.length}개</span>
              )}
            </div>
          </div>
          <div className="device-modal-divider" />
        </div>

        {/* Body */}
        <div className="device-modal-body">
          <div className="device-modal-svg-area">
            <div ref={svgContainerRef} className="device-modal-svg-wrap">
              <SvgPortView
                device={deviceWithModules}
                portStates={devicePortStates}
                tooltipRef={tooltipRef as React.RefObject<HTMLDivElement>}
              />
            </div>
          </div>

          {/* Active Faults */}
          <ActiveFaults portStates={devicePortStates} />
        </div>

        <div ref={tooltipRef} className="device-modal-tooltip" />
      </div>

      {/* Module Popover */}
      {modulePopover && (
        <ModulePopover
          popover={modulePopover}
          existingModule={existingModule}
          onInsert={handleInsertModule}
          onRemove={handleRemoveModule}
        />
      )}
    </div>,
    document.body
  );
};

// ─── ActiveFaults 서브컴포넌트 ───
const ActiveFaults = ({ portStates }: { portStates: PortState[] }) => {
  const errorPorts = portStates.filter((p) => p.status === "error");
  if (errorPorts.length === 0) return null;

  return (
    <div className="active-faults">
      <h4>Active Faults</h4>
      <div className="active-faults-list">
        {errorPorts.map((err, idx) => {
          const level = err.errorLevel || err.status || "error";
          const badgeClass =
            level === "critical" ? "grafana-badge-critical" :
            level === "major" ? "grafana-badge-major" :
            level === "minor" ? "grafana-badge-minor" :
            level === "warning" ? "grafana-badge-warning" : "grafana-badge-critical";

          return (
            <div key={idx} className="active-fault-item">
              <strong>{err.portId}</strong>
              <span>{err.errorMessage || "Unknown Error"}</span>
              {level && (
                <span className={`grafana-badge ${badgeClass}`}>{level}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
