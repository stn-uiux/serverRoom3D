import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore, checkFrontClearanceViolation } from "../store/useStore";
import type { PortState, RegisteredDevice } from "../types";
import type { GeneratedPort } from "../types/equipment";
import { getHighestError } from "../utils/errorHelpers";
import { resolveDeviceImage } from "../utils/deviceAssets";
import { getNodeName } from "../utils/nodeUtils";

/* ---------- Device Tile Image with loading / fallback ---------- */
const DeviceTileImage = ({ src, alt }: { src: string; alt: string }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  return (
    <div className="device-tile-img-wrap">
      {status === "loading" && (
        <div className="device-tile-img-placeholder">
          <span className="device-tile-img-spinner" />
        </div>
      )}
      {status === "error" && (
        <div className="device-tile-img-placeholder">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="device-tile-img"
        style={{ opacity: status === "loaded" ? 1 : 0 }}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        draggable={false}
      />
    </div>
  );
};

import "./DevicePanel.css";

export const DevicePanel = () => {
  // Phase 2: 개별 셀렉터로 불필요 리렌더 방지
  const racks = useStore((s) => s.racks);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const nodes = useStore((s) => s.nodes);
  const selectedRackId = useStore((s) => s.selectedRackId);
  const selectRack = useStore((s) => s.selectRack);
  const addDevice = useStore((s) => s.addDevice);
  const removeDevice = useStore((s) => s.removeDevice);
  const selectDevice = useStore((s) => s.selectDevice);
  const deleteRack = useStore((s) => s.deleteRack);
  const isEditMode = useStore((s) => s.isEditMode);
  const updateRackOrientation = useStore((s) => s.updateRackOrientation);
  const updateRack = useStore((s) => s.updateRack);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const setHighlightedDevice = useStore((s) => s.setHighlightedDevice);
  const focusRack = useStore((s) => s.focusRack);
  const showToast = useStore((s) => s.showToast);
  const findExistingMount = useStore((s) => s.findExistingMount);
  const rack = useMemo(
    () => racks.find((r) => r.rackId === selectedRackId),
    [racks, selectedRackId],
  );
  // 방향 제어에서 같은 mapId의 랙 목록 필요
  const sameNodeRacks = useMemo(
    () => (rack ? racks.filter((r) => r.mapId === rack.mapId) : []),
    [racks, rack?.mapId],
  );

  // Rack UI name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add-device modal state
  const [addModalSlot, setAddModalSlot] = useState<number | null>(null);
  const [selectedRegDeviceId, setSelectedRegDeviceId] = useState<string | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteRackModalOpen, setIsDeleteRackModalOpen] = useState(false);
  // Filter & Sort state for add-device modal
  const [showUnmountedOnly, setShowUnmountedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<
    "regDateDesc" | "regDateAsc" | "title" | "modelName"
  >("regDateDesc");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [sortKey, showUnmountedOnly]);

  // Remount confirmation state
  const [remountPending, setRemountPending] = useState<{
    regDeviceId: string;
    existingRackId: string;
    existingDeviceId: string;
    existingRackName?: string;
  } | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingName]);

  // Handle ESC key for modal
  useEffect(() => {
    if (!isDeleteRackModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDeleteRackModalOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isDeleteRackModalOpen]);

  const handleNameSubmit = () => {
    if (!rack) return;
    const newName = editNameValue.trim();
    if (newName) {
      updateRack(rack.rackId, { rackTitle: newName });
    }
    setIsEditingName(false);
  };

  // Registered devices for this rack's exact node scope
  const groupRegDevices = useMemo(() => {
    if (!rack) return [];
    return registeredDevices.filter((rd) => rd.deviceGroupId === rack.mapId);
  }, [registeredDevices, rack?.mapId]);

  // Helper to lookup a registered device by ID
  const findRegDevice = (id?: string): RegisteredDevice | undefined =>
    id ? registeredDevices.find((rd) => rd.deviceId === id) : undefined;

  if (!rack) return null;

  const openAddModal = (slotU: number) => {
    setAddModalSlot(slotU);
    setSelectedRegDeviceId(null);
  };

  const closeAddModal = () => {
    setAddModalSlot(null);
    setSelectedRegDeviceId(null);
  };

  const handleAdd = () => {
    if (addModalSlot === null || !selectedRegDeviceId) return;

    const regDevice = findRegDevice(selectedRegDeviceId);
    if (!regDevice) return;

    const start = addModalSlot;
    const end = start + (regDevice.size || 1) - 1;

    if (start < 1 || end > rack.rackSize) {
      showToast(
        `에러: 장비(${regDevice.size || 1}U)가 랙 높이를 초과했습니다.`,
        "error",
      );
      return;
    }

    const collision = rack.devices.find((d) => {
      const dStart = d.position;
      const dEnd = d.position + d.size - 1;
      return start <= dEnd && end >= dStart;
    });

    if (collision) {
      showToast(`에러: "${collision.title}" 장비와 겹칩니다.`, "error");
      return;
    }

    // Single-mount check: warn if already mounted in another rack
    const existing = findExistingMount(selectedRegDeviceId);
    if (existing && existing.rackId !== rack.rackId) {
      setRemountPending({
        regDeviceId: selectedRegDeviceId,
        existingRackId: existing.rackId,
        existingDeviceId: existing.deviceId,
        existingRackName: existing.rackName,
      });
      return;
    }

    doMount(selectedRegDeviceId, start);
  };

  const doMount = (
    regDeviceId: string,
    slot: number,
    existingPortStates: PortState[] = [],
  ) => {
    const regDevice = findRegDevice(regDeviceId);
    if (!regDevice || !rack) return;

    const device = {
      type: regDevice.type,
      title: regDevice.title,
      size: regDevice.size,
      position: slot,
      modelName: regDevice.modelName,
      vendor: regDevice.vendor,
      deviceId: regDevice.deviceId,
      portStates:
        existingPortStates.length > 0
          ? existingPortStates
          : regDevice.generatedPorts?.map((gp: GeneratedPort) => ({
              portId: gp.realPortNumber,
              portNumber: gp.realPortNumber,
              portName: gp.portType,
              status: "normal",
            })) || [],
      insertedCards: regDevice.insertedCards,
      insertedModules: regDevice.insertedModules,
      dashboardThumbnailUrl: regDevice.dashboardThumbnailUrl,
    } as any; // Type assertion since itemId needs to be generated in useStore

    const success = addDevice(rack.rackId, device);
    if (success) {
      closeAddModal();
    } else {
      showToast("장비 추가 실패: 알 수 없는 오류", "error");
    }
  };

  const handleRemountConfirm = () => {
    if (!remountPending || addModalSlot === null) return;
    // Capture existing device's portStates before removal so error states survive the move
    const srcRack = racks.find(
      (r) => r.rackId === remountPending.existingRackId,
    );
    const srcDevice = srcRack?.devices.find(
      (d) =>
        d.deviceId === remountPending.existingDeviceId ||
        d.itemId === remountPending.existingDeviceId,
    );
    const preservedPortStates = srcDevice?.portStates ?? [];
    // Remove from old rack first, then mount at new position
    removeDevice(
      remountPending.existingRackId,
      remountPending.existingDeviceId,
    );
    doMount(remountPending.regDeviceId, addModalSlot, preservedPortStates);
    setRemountPending(null);
  };

  const handleRemountCancel = () => setRemountPending(null);

  // Device Colors
  const UNIFIED_DEVICE_BG = "var(--bg-tertiary)";
  const UNIFIED_DEVICE_TEXT = "var(--text-primary)";
  const UNIFIED_DEVICE_BORDER = "var(--border-medium)";

  const renderSlots = () => {
    if (!rack) return null;

    const SLOT_HEIGHT = 22;
    const SLOT_MARGIN = 2;
    const TOTAL_SLOT_HEIGHT = SLOT_HEIGHT + SLOT_MARGIN;

    const usedSlots = new Set<number>();
    rack.devices.forEach((d) => {
      for (let i = 0; i < d.size; i++) {
        usedSlots.add(d.position + i);
      }
    });

    const rendered = [];
    for (let u = 1; u <= rack.rackSize; u++) {
      const device = rack.devices.find((d) => d.position === u);
      const occupied = usedSlots.has(u);

      if (device) {
        const heightPx = device.size * TOTAL_SLOT_HEIGHT - SLOT_MARGIN;
        const regDev = findRegDevice(device.deviceId);
        const displayName =
          (regDev
            ? regDev.title || regDev.modelName
            : (device.modelName ?? device.title)) || "Device";
        const imageSrc =
          regDev?.dashboardThumbnailUrl ||
          device.dashboardThumbnailUrl ||
          resolveDeviceImage(regDev?.modelName ?? device.modelName);
        const hasImage = !!imageSrc;

        const errorInfo = getHighestError(device.portStates);
        const hasError = errorInfo !== null;
        const highestSeverity = errorInfo?.level ?? null;

        const bg = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BG;
        const textColor = hasImage
          ? "#ffffff"
          : hasError
            ? "#ffffff"
            : UNIFIED_DEVICE_TEXT;
        const borderColor = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BORDER;

        const isHighlighted = highlightedDeviceId === device.itemId;

        rendered.push(
          <div
            key={`dev-${u}`}
            className={`device-tile ${hasError ? "has-error" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
            style={{
              height: `${heightPx}px`,
              backgroundColor: bg,
              border: hasError
                ? "2px solid var(--severity-critical)"
                : `1px solid ${borderColor}`,
            }}
            onClick={() => {
              selectDevice(device.itemId);
              if (selectedRackId) {
                focusRack(selectedRackId);
              }
              setHighlightedDevice(device.itemId, 2500);
            }}
          >
            {hasImage && <DeviceTileImage src={imageSrc!} alt={displayName} />}

            <div
              className={
                hasImage ? "device-tile-overlay" : "device-tile-overlay-plain"
              }
              style={{
                color: textColor,
                fontWeight: hasError ? 700 : 500,
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                {hasError && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: `var(--severity-${highestSeverity})`,
                      boxShadow: `0 0 6px var(--severity-${highestSeverity})`,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    opacity: 0.75,
                    fontSize: "var(--font-size-xs)",
                    flexShrink: 0,
                  }}
                >
                  ({device.size}U)
                </span>
              </div>

              <button
                className="device-tile-delete"
                aria-label={`Delete device ${displayName}`}
                title="Delete device"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteConfirmId(device.itemId);
                }}
              >
                ✕
              </button>

              {/* Inline delete confirmation */}
              {deleteConfirmId === device.itemId && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.82)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    borderRadius: "var(--radius-sm)",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                    }}
                  >
                    삭제?
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDevice(rack.rackId, device.itemId);
                      setDeleteConfirmId(null);
                    }}
                    style={{
                      padding: "4px 14px",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      background: "#e03131",
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(null);
                    }}
                    style={{
                      padding: "4px 14px",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "var(--radius-sm)",
                      background: "transparent",
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>,
        );
      } else if (!occupied) {
        rendered.push(
          <div
            key={`empty-${u}`}
            onClick={() => openAddModal(u)}
            style={{
              height: `${SLOT_HEIGHT}px`,
              borderBottom: "1px solid var(--border-weak)",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              backgroundColor: "var(--severity-success-bg)",
              transition: "background 0.1s",
              marginBottom: "2px",
              borderRadius: "var(--radius-sm)",
            }}
            title="Click to add device at this slot"
          >
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                borderRight: "1px solid var(--border-weak)",
              }}
            >
              {u}
            </div>
            <div
              style={{
                flex: 1,
                paddingLeft: "10px",
                fontSize: "var(--font-size-xs)",
                color: "var(--severity-success-text)",
              }}
            >
              + Available
            </div>
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-weak)",
              }}
            >
              {u}
            </div>
          </div>,
        );
      }
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-weak)",
          borderRadius: "var(--radius-md)",
          padding: "4px",
          marginTop: "10px",
        }}
      >
        {rendered}
      </div>
    );
  };

  // ─── Add Device Modal ─────────────────────────────────────────────────────
  const renderAddDeviceModal = () => {
    if (addModalSlot === null) return null;

    const selectedRegDevice = findRegDevice(selectedRegDeviceId ?? undefined);

    // Calculate actual contiguous free space starting from addModalSlot
    const usedSlots = new Set<number>();
    rack.devices.forEach((d) => {
      for (let i = 0; i < d.size; i++) usedSlots.add(d.position + i);
    });
    let contiguousFreeU = 0;
    for (let u = addModalSlot; u <= rack.rackSize; u++) {
      if (usedSlots.has(u)) break;
      contiguousFreeU++;
    }

    // Check if a device can be placed at this slot
    const canPlace = (uSize: number): boolean => uSize <= contiguousFreeU;

    const modalContent = (
      <div className="add-device-modal-overlay" onClick={closeAddModal}>
        <div className="add-device-modal" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="grafana-modal-header">
            <div>
              <h2 className="grafana-modal-title">Add New Device</h2>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                Position: U{addModalSlot} · {getNodeName(nodes, rack.mapId)} ·
                가용 공간 {contiguousFreeU}U
              </span>
            </div>
            <button className="grafana-modal-close" onClick={closeAddModal}>
              &times;
            </button>
          </div>

          {/* Modal Content */}
          <div className="grafana-modal-content">
            {/* Registered Device List */}
            <div className="grafana-field">
              <label className="grafana-label">등록 장비 선택</label>
              {groupRegDevices.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  등록된 장비가 없습니다.
                </div>
              ) : (
                <>
                  {/* Filter & Sort Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={showUnmountedOnly}
                        onChange={(e) => setShowUnmountedOnly(e.target.checked)}
                        style={{
                          accentColor: "var(--theme-primary)",
                          width: "14px",
                          height: "14px",
                          cursor: "pointer",
                        }}
                      />
                      미실장 장비만 보기
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginLeft: "auto",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--text-tertiary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        정렬:
                      </span>
                      <select
                        value={sortKey}
                        onChange={(e) =>
                          setSortKey(
                            e.target.value as
                              | "regDateDesc"
                              | "regDateAsc"
                              | "title"
                              | "modelName",
                          )
                        }
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--text-primary)",
                          background: "var(--bg-tertiary)",
                          border: "1px solid var(--border-weak)",
                          borderRadius: "var(--radius-sm)",
                          padding: "3px 8px",
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        <option value="regDateDesc">최신순</option>
                        <option value="regDateAsc">오래된순</option>
                        <option value="title">장비명순</option>
                        <option value="modelName">모델명순</option>
                      </select>
                    </div>
                  </div>
                  <div className="reg-device-list" ref={listRef}>
                    {(() => {
                      // Apply filter
                      let filtered = groupRegDevices;
                      if (showUnmountedOnly) {
                        filtered = filtered.filter(
                          (rd) => !findExistingMount(rd.deviceId),
                        );
                      }
                      // Apply sort
                      const sorted = [...filtered].sort((a, b) => {
                        switch (sortKey) {
                          case "title": {
                            const aName = (
                              a.title ||
                              a.modelName ||
                              ""
                            ).toLowerCase();
                            const bName = (
                              b.title ||
                              b.modelName ||
                              ""
                            ).toLowerCase();
                            return aName.localeCompare(bName, "ko");
                          }
                          case "modelName": {
                            const aModel = (a.modelName || "").toLowerCase();
                            const bModel = (b.modelName || "").toLowerCase();
                            return aModel.localeCompare(bModel, "ko");
                          }
                          case "regDateAsc": {
                            const aDate = a.modiDate || a.regDate || "";
                            const bDate = b.modiDate || b.regDate || "";
                            // 오래된 등록이 위로
                            return aDate.localeCompare(bDate);
                          }
                          case "regDateDesc":
                          default: {
                            const aDate = a.modiDate || a.regDate || "";
                            const bDate = b.modiDate || b.regDate || "";
                            // 최신 등록이 위로
                            return bDate.localeCompare(aDate);
                          }
                        }
                      });
                      return sorted.map((rd) => {
                        const thumb =
                          rd.dashboardThumbnailUrl ||
                          resolveDeviceImage(rd.modelName);
                        const isSelected = selectedRegDeviceId === rd.deviceId;
                        const placeable = canPlace(rd.size || 1);
                        const existingMount = findExistingMount(rd.deviceId);
                        const isMountedElsewhere =
                          !!existingMount &&
                          existingMount.rackId !== rack.rackId;
                        const isMountedHere =
                          !!existingMount &&
                          existingMount.rackId === rack.rackId;
                        return (
                          <div
                            key={rd.deviceId}
                            className={`reg-device-item ${isSelected ? "selected" : ""} ${!placeable && !isMountedElsewhere ? "disabled" : ""}`}
                            onClick={() => {
                              if (placeable || isMountedElsewhere)
                                setSelectedRegDeviceId(rd.deviceId);
                            }}
                            style={{
                              opacity:
                                placeable || isMountedElsewhere ? 1 : 0.45,
                              cursor:
                                placeable || isMountedElsewhere
                                  ? "pointer"
                                  : "not-allowed",
                              position: "relative",
                              outline: isMountedElsewhere
                                ? "1px solid var(--severity-warning, #f59e0b)"
                                : undefined,
                            }}
                          >
                            <div className="reg-device-item-thumb">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={rd.modelName}
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--text-tertiary)",
                                  }}
                                >
                                  No IMG
                                </span>
                              )}
                            </div>
                            <div className="reg-device-item-info">
                              <div
                                className="reg-device-item-model"
                                style={{ marginBottom: "2px" }}
                              >
                                {rd.title || rd.modelName}
                              </div>
                              <div className="reg-device-item-details">
                                {rd.title && rd.title !== rd.modelName && (
                                  <span
                                    className="reg-device-item-badge"
                                    style={{
                                      background: "var(--bg-primary)",
                                      border: "1px solid var(--border-weak)",
                                    }}
                                  >
                                    {rd.modelName}
                                  </span>
                                )}
                                <span className="reg-device-item-badge">
                                  {rd.size}U
                                </span>
                                <span className="reg-device-item-badge">
                                  {rd.vendor}
                                </span>
                                <span>{rd.IPAddr}</span>
                              </div>
                            </div>
                            {(isMountedHere || isMountedElsewhere) && (
                              <span
                                style={{
                                  fontSize: "var(--font-size-xs)",
                                  color: isMountedElsewhere
                                    ? "#f59e0b"
                                    : "#22c55e",
                                  fontWeight: 600,
                                  background: isMountedElsewhere
                                    ? "rgba(245,158,11,0.12)"
                                    : "rgba(34,197,94,0.12)",
                                  border: `1px solid ${isMountedElsewhere ? "rgba(245,158,11,0.4)" : "rgba(34,197,94,0.4)"}`,
                                  borderRadius: "var(--radius-sm)",
                                  padding: "2px 8px",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                {isMountedElsewhere
                                  ? "⚠ 다른 랙에 탑재됨"
                                  : "✓ 이 랙에 탑재됨"}
                              </span>
                            )}
                            {!placeable && !isMountedElsewhere && (
                              <span
                                style={{
                                  fontSize: "var(--font-size-xs)",
                                  color: "#ff6b6b",
                                  fontWeight: 600,
                                  background: "rgba(255, 60, 60, 0.1)",
                                  border: "1px solid rgba(255, 60, 60, 0.3)",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "2px 8px",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                배치 불가
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Selected device info */}
            {selectedRegDevice && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                    fontWeight: 600,
                  }}
                >
                  선택된 장비 정보
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px",
                    fontSize: "var(--font-size-xs)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Model:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.modelName}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Size:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.size}U
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>IP: </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.IPAddr}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>MAC: </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.macAddr}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Vendor:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.vendor}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Type:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.type}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                className="grafana-btn grafana-btn-primary"
                onClick={handleAdd}
                disabled={!selectedRegDeviceId}
                style={{
                  flex: 1,
                  opacity: selectedRegDeviceId ? 1 : 0.5,
                  cursor: selectedRegDeviceId ? "pointer" : "not-allowed",
                }}
              >
                {selectedRegDevice
                  ? `${selectedRegDevice.title || selectedRegDevice.modelName} 배치 (U${addModalSlot})`
                  : "장비를 선택하세요"}
              </button>
              <button
                className="grafana-btn grafana-btn-secondary"
                onClick={closeAddModal}
                style={{ flex: 0.4 }}
              >
                Cancel
              </button>
            </div>

            {/* Remount confirmation modal (nested over the add modal) */}
            {remountPending && (
              <div
                className="confirm-modal-overlay"
                style={{
                  position: "absolute",
                  background: "rgba(0,0,0,0.8)",
                  borderRadius: "var(--radius-lg)",
                  zIndex: 2500,
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  className="confirm-modal-card"
                  style={{
                    width: "400px",
                    background: "var(--bg-primary)",
                    padding: "32px",
                    borderRadius: "16px",
                    border: "1px solid var(--border-medium)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    margin: "auto",
                  }}
                >
                  <div className="confirm-modal-header">
                    <div className="confirm-modal-icon">⚠️</div>
                    <h3 className="confirm-modal-title">장비 배치 이동 확인</h3>
                  </div>
                  <div className="confirm-modal-body">
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      「
                      {selectedRegDevice?.title || selectedRegDevice?.modelName}
                      」
                    </p>
                    <p style={{ marginTop: "12px", marginBottom: 0 }}>
                      이 장비는 이미{" "}
                      <span
                        style={{
                          color: "var(--theme-primary)",
                          fontWeight: 700,
                        }}
                      >
                        「{remountPending.existingRackName || "다른 랙"}」
                      </span>
                      에 배치되어 있습니다.
                    </p>
                    <p
                      style={{
                        marginTop: "8px",
                        fontWeight: 700,
                        color: "var(--severity-warning-text, #f59e0b)",
                      }}
                    >
                      현재 위치에서 제거하고 이 랙(U{addModalSlot})으로
                      이동하시겠습니까?
                    </p>
                  </div>
                  <div className="confirm-modal-actions">
                    <button
                      className="grafana-btn grafana-btn-secondary"
                      onClick={handleRemountCancel}
                    >
                      취소
                    </button>
                    <button
                      className="grafana-btn grafana-btn-destructive"
                      onClick={handleRemountConfirm}
                      style={{
                        background: "#f59e0b",
                        borderColor: "#d97706",
                        color: "#fff",
                      }}
                    >
                      이동 및 배치
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  return (
    <div className="grafana-side-panel" style={{ width: "400px" }}>
      <div className="grafana-side-panel-header">
        <div>
          {isEditingName ? (
            <input
              ref={editInputRef}
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              onBlur={handleNameSubmit}
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-primary)",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--theme-primary)",
                outline: "none",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                width: "200px",
                margin: 0,
              }}
            />
          ) : (
            <h2
              onClick={() => {
                setEditNameValue(
                  rack.rackTitle || `Rack ${rack.rackId.substring(0, 4)}`,
                );
                setIsEditingName(true);
              }}
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              title="클릭하여 랙 이름 변경"
            >
              {rack.rackTitle || `Rack ${rack.rackId.substring(0, 4)}`}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-tertiary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </h2>
          )}
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {rack.rackSize}U Configuration
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--theme-primary)",
                color: "#fff",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
              }}
            >
              {getNodeName(nodes, rack.mapId)}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => selectRack(null)}
            className="grafana-modal-close"
            style={{ position: "static", transform: "none" }}
          >
            ×
          </button>
        </div>
      </div>

      <div className="grafana-side-panel-content">
        {/* Orientation Control (Edit Mode Only) */}
        {isEditMode && (
          <div className="grafana-section" style={{ marginBottom: "16px" }}>
            <h3 className="grafana-section-title">Rack Orientation</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {[
                { label: "North (0°)", value: 0 },
                { label: "East (90°)", value: 90 },
                { label: "South (180°)", value: 180 },
                { label: "West (270°)", value: 270 },
              ].map((dir) => {
                const wouldViolate = checkFrontClearanceViolation(
                  sameNodeRacks,
                  rack.rackId,
                  rack.position,
                  dir.value as 0 | 90 | 180 | 270,
                );
                const isCurrentDirection = rack.orientation === dir.value;
                const isDisabled = wouldViolate && !isCurrentDirection;

                return (
                  <button
                    key={dir.value}
                    className={`grafana-btn grafana-btn-sm ${isCurrentDirection ? "grafana-btn-primary" : "grafana-btn-secondary"}`}
                    onClick={() =>
                      !isDisabled &&
                      updateRackOrientation(
                        rack.rackId,
                        dir.value as 0 | 90 | 180 | 270,
                      )
                    }
                    disabled={isDisabled}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    title={
                      isDisabled
                        ? "이 방향으로 회전하면 다른 장비의 정면 1.75단위 이내에 위치하게 됩니다."
                        : ""
                    }
                  >
                    {dir.label}
                    {isDisabled && " ⛔"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rack Layout */}
        <div
          className="grafana-section"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <h3 className="grafana-section-title">Rack Layout</h3>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-tertiary)",
              marginBottom: "8px",
            }}
          >
            빈 슬롯을 클릭하면 등록 장비를 배치할 수 있습니다.
          </div>
          {renderSlots()}
        </div>

        {/* Delete Rack Section */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--severity-critical-bg)",
          }}
        >
          <button
            className="grafana-btn grafana-btn-md grafana-btn-destructive"
            style={{ width: "100%" }}
            onClick={() => setIsDeleteRackModalOpen(true)}
          >
            Rack 삭제
          </button>
        </div>
      </div>

      {renderAddDeviceModal()}

      {/* Rack Deletion Confirm Modal */}
      {isDeleteRackModalOpen &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            onClick={() => setIsDeleteRackModalOpen(false)}
          >
            <div
              className="confirm-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-modal-header">
                <div className="confirm-modal-icon">🗑️</div>
                <h3 className="confirm-modal-title">랙 삭제</h3>
              </div>
              <div className="confirm-modal-body">
                <strong>
                  {rack.rackTitle || `Rack ${rack.rackId.substring(0, 4)}`}
                </strong>
                을(를) 삭제하시겠습니까?
              </div>
              <div className="confirm-modal-actions">
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-secondary"
                  onClick={() => setIsDeleteRackModalOpen(false)}
                >
                  취소
                </button>
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-destructive"
                  onClick={() => {
                    deleteRack(rack.rackId);
                    setIsDeleteRackModalOpen(false);
                    showToast("랙이 삭제되었습니다.", "success");
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
