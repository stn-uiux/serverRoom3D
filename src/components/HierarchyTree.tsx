import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useStore } from "../store/useStore";
import type { HierarchyNode } from "../types";
import {
  getChildren,
  getSubtreeEquipmentCount,
  getNodeEquipmentCount,
  getSubtreeDevices,
  isLeafNode,
} from "../utils/nodeUtils";
import { getHighestError } from "../utils/errorHelpers";

import "./HierarchyTree.css";

import {
  Squares2x2Icon,
  ChevronDownIcon,
  BuildingOfficeIcon,
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from "./Icons";

// ─── Tree Node Component ─────────────────────────────────────────────────────

interface TreeNodeItemProps {
  node: HierarchyNode;
  depth: number;
  nodes: HierarchyNode[];
  activeNodeId: string;
  expandedIds: Set<string>;
  equipmentCounts: Map<string, number>;
  isEditMode: boolean;
  showEquipment: boolean;
  highlightedDeviceId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  // Drag and drop
  draggedNodeId: string | null;
  dragOverNodeId: string | null;
  onDragStart: (nodeId: string) => void;
  onDragOver: (
    e: React.DragEvent,
    nodeId: string,
    position: "before" | "after" | "inside",
  ) => void;
  onDragLeave: () => void;
  onDrop: (
    e: React.DragEvent,
    targetNodeId: string,
    position: "before" | "after" | "inside",
  ) => void;
}

const TreeNodeItem = ({
  node,
  depth,
  nodes,
  activeNodeId,
  expandedIds,
  equipmentCounts,
  isEditMode,
  showEquipment,
  highlightedDeviceId,
  onToggle,
  onSelect,
  onContextMenu,
  draggedNodeId,
  dragOverNodeId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: TreeNodeItemProps) => {
  const children = getChildren(nodes, node.nodeId);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.nodeId);
  const isSelected = activeNodeId === node.nodeId;
  const count = equipmentCounts.get(node.nodeId) || 0;

  const [dropPos, setDropPos] = useState<"before" | "after" | "inside" | null>(
    null,
  );

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode || draggedNodeId === node.nodeId) return;
    e.preventDefault();

    // Safety: Cannot drop on own children
    const getDescendantIds = (id: string): string[] => {
      const children = nodes.filter((n) => n.parentId === id);
      return [id, ...children.flatMap((c) => getDescendantIds(c.nodeId))];
    };
    if (
      draggedNodeId &&
      getDescendantIds(draggedNodeId).includes(node.nodeId)
    ) {
      setDropPos(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;

    let position: "before" | "after" | "inside";
    if (node.parentId === null) {
      // Root node only allows "inside"
      position = "inside";
    } else if (relativeY < height * 0.25) {
      position = "before";
    } else if (relativeY > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropPos(position);
    onDragOver(e, node.nodeId, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditMode || !dropPos) return;
    e.preventDefault();
    onDrop(e, node.nodeId, dropPos);
    setDropPos(null);
  };

  return (
    <>
      <div
        className={`tree-node ${isSelected ? "selected" : ""} ${
          draggedNodeId === node.nodeId ? "dragging" : ""
        } ${dropPos === "inside" ? "drop-target" : ""} ${
          dropPos === "before" ? "drop-before" : ""
        } ${dropPos === "after" ? "drop-after" : ""}`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => {
          onSelect(node.nodeId);
        }}
        onContextMenu={(e) => isEditMode && onContextMenu(e, node.nodeId)}
        // Drag and drop handlers
        draggable={isEditMode && node.parentId !== null}
        onDragStart={(e) => {
          if (!isEditMode) return;
          onDragStart(node.nodeId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => {
          setDropPos(null);
          onDragLeave();
        }}
        onDrop={handleDrop}
      >
        {/* Toggle arrow */}
        <span
          className={`tree-node-toggle ${isExpanded ? "expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.nodeId);
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          <svg
            viewBox="0 0 24 24"
            width="10"
            height="10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>

        {/* Icon */}
        <span className="tree-node-icon">
          {node.parentId === null ? (
            <BuildingOfficeIcon
              style={{ width: 14, height: 14, color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : (
            <FolderIcon
              style={{ width: 14, height: 14, color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          )}
        </span>

        {/* Name */}
        <span className="tree-node-name">{node.name}</span>

        {/* Rack count badge */}
        {count > 0 && <span className="tree-node-count">{count}</span>}
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {children.map((child) => (
            <TreeNodeItem
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              nodes={nodes}
              activeNodeId={activeNodeId}
              expandedIds={expandedIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              draggedNodeId={draggedNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </>
      )}
    </>
  );
};

// ─── Main HierarchyTree Component ────────────────────────────────────────────

export const HierarchyTree = () => {
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const expandedNodeIds = useStore((s) => s.expandedNodeIds);
  const toggleNodeExpansion = useStore((s) => s.toggleNodeExpansion);
  const expandNodePath = useStore((s) => s.expandNodePath);
  const isCollapsed = useStore((s) => s.isHierarchyCollapsed);
  const setIsCollapsed = useStore((s) => s.setHierarchyCollapsed);
  const racks = useStore((s) => s.racks);
  const isEditMode = useStore((s) => s.isEditMode);
  const addNode = useStore((s) => s.addNode);
  const renameNode = useStore((s) => s.renameNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const showEquipment = useStore((s) => s.showEquipmentInTree);
  const setShowEquipment = useStore((s) => s.setShowEquipmentInTree);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const locateDevice = useStore((s) => s.locateDevice);
  const showToast = useStore((s) => s.showToast);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const layouts = useStore((s) => s.layouts);
  const reorderNode = useStore((s) => s.reorderNode);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tree-context-menu")) return;
      setContextMenu(null);
    };
    window.addEventListener("click", close, { capture: true });
    return () => window.removeEventListener("click", close, { capture: true });
  }, [contextMenu]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Calculate direct node equipment counts (ONLY devices directly in this node)
  const equipmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => {
      const count = getNodeEquipmentCount(registeredDevices, n.nodeId);
      if (count > 0) counts.set(n.nodeId, count);
    });
    return counts;
  }, [nodes, registeredDevices]);

  // Consolidated racks from all node layouts for accurate equipment mapping in parent nodes
  const allRacksForMapping = useMemo(() => {
    const fromLayouts = Object.entries(layouts)
      .filter(([nid]) => nid !== activeNodeId)
      .flatMap(([, l]) => l.racks || []);
    return [...fromLayouts, ...racks];
  }, [layouts, racks, activeNodeId]);

  const totalDeviceCount = useMemo(() => {
    if (!activeNodeId) return 0;
    return getSubtreeEquipmentCount(nodes, registeredDevices, activeNodeId);
  }, [nodes, activeNodeId, registeredDevices]);

  const deviceGroups = useMemo(() => {
    if (!activeNodeId) return [];
    // Key fix: Use allRacksForMapping instead of just current racks to find placements in descendant nodes
    const flat = getSubtreeDevices(
      nodes,
      activeNodeId,
      registeredDevices,
      allRacksForMapping,
    );

    // Grouping by actual nodeId
    const groups: Record<string, typeof flat> = {};
    flat.forEach((item) => {
      const nid = item.device.deviceGroupId || '';
      if (!groups[nid]) groups[nid] = [];
      groups[nid].push(item);
    });

    // Extract ordered list of groups based on node tree order
    const result: {
      nodeId: string;
      nodeName: string;
      devices: typeof flat;
    }[] = [];
    nodes.forEach((n) => {
      if (groups[n.nodeId]) {
        result.push({
          nodeId: n.nodeId,
          nodeName: n.name,
          devices: groups[n.nodeId],
        });
      }
    });

    return result;
  }, [nodes, activeNodeId, registeredDevices, racks]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      toggleNodeExpansion(nodeId);
    },
    [toggleNodeExpansion],
  );

  const handleSelect = useCallback(
    (nodeId: string) => {
      if (renamingId) return;
      setActiveNode(nodeId);
    },
    [setActiveNode, renamingId],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    },
    [],
  );

  const handleDeviceClick = useCallback(
    (registeredDeviceId: string) => {
      const found = locateDevice(registeredDeviceId);
      if (!found) {
        showToast("배치되지 않은 장비입니다. 랙에 먼저 배치해주세요.", "error");
      }
    },
    [locateDevice, showToast],
  );

  const handleAddChild = useCallback(() => {
    if (!contextMenu) return;
    const parentId = contextMenu.nodeId;
    const siblings = nodes.filter((n) => n.parentId === parentId);
    const newId = addNode({
      parentId,
      name: "New Node",
      type: "group",
      order: siblings.length,
    });
    setContextMenu(null);
    // Expand parent and start renaming
    toggleNodeExpansion(parentId);
    setRenamingId(newId);
    setRenameValue("New Node");
  }, [contextMenu, nodes, addNode]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node) {
      setRenamingId(node.nodeId);
      setRenameValue(node.name);
    }
    setContextMenu(null);
  }, [contextMenu, nodes]);

  const handleRenameConfirm = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameNode(renamingId as string, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameNode]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node && node.parentId !== null) {
      // Do not allow deleting root
      if (
        window.confirm(`"${node.name}" 노드와 하위 데이터를 삭제하시겠습니까?`)
      ) {
        deleteNode(node.nodeId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode]);

  // Drag and Drop handlers
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggedNodeId(nodeId);
  }, []);

  const handleDragOver = useCallback(
    (
      e: React.DragEvent,
      nodeId: string,
    ) => {
      e.preventDefault();
      if (draggedNodeId === nodeId) return;
      setDragOverNodeId(nodeId);
    },
    [draggedNodeId],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverNodeId(null);
  }, []);

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      targetNodeId: string,
      position: "before" | "after" | "inside",
    ) => {
      e.preventDefault();
      const sourceId = draggedNodeId;
      setDraggedNodeId(null);
      setDragOverNodeId(null);

      if (sourceId && sourceId !== targetNodeId) {
        reorderNode(sourceId, targetNodeId, position);
      }
    },
    [draggedNodeId, reorderNode],
  );

  // Auto-expand tree when activeNodeId changes from external sources (breadcrumb, search, etc.)
  useEffect(() => {
    if (activeNodeId) {
      expandNodePath(activeNodeId);
    }
  }, [activeNodeId, expandNodePath]);

  const rootNodes = getChildren(nodes, null);

  return (
    <div className="tree-sidebar-container">
      <div
        className={`hierarchy-tree ${isCollapsed ? "collapsed" : "expanded"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hierarchy-tree-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflow: "hidden",
              flex: 1,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  color: "var(--theme-primary)",
                }}
              >
                <Squares2x2Icon style={{ width: 18, height: 18 }} />
              </span>
              <span style={{ fontWeight: 800 }}>구조</span>
            </span>
            {/* breadcrumb preview removed when collapsed per request */}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              className="tree-toggle-item"
              onClick={(e) => e.stopPropagation()}
              title="장비 표시 토글"
            >
              <span className="tree-toggle-label">장비</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showEquipment}
                  onChange={(e) => setShowEquipment(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {isEditMode && (
                <button
                  className="grafana-btn grafana-btn-sm grafana-btn-secondary"
                  title="최상위 노드 추가"
                  onClick={(e) => {
                    e.stopPropagation();
                    const siblings = nodes.filter((n) => n.parentId === null);
                    const newId = addNode({
                      parentId: null,
                      name: "New Root",
                      type: "root",
                      order: siblings.length,
                    });
                    setRenamingId(newId);
                    setRenameValue("New Root");
                    if (isCollapsed) setIsCollapsed(false);
                  }}
                >
                  <PlusIcon />
                </button>
              )}

              <button
                className="grafana-btn grafana-btn-sm grafana-btn-secondary"
                title={isCollapsed ? "펼치기" : "접기"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(!isCollapsed);
                }}
              >
                <ChevronDownIcon
                  style={{
                    transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)",
                    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="hierarchy-tree-body">
          {rootNodes.map((root) => (
            <TreeNodeItem
              key={root.nodeId}
              node={root}
              depth={0}
              nodes={nodes}
              activeNodeId={activeNodeId || ""}
              expandedIds={expandedNodeIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onContextMenu={handleContextMenu}
              draggedNodeId={draggedNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      {/* Equipment Detail Side Panel - Absolute positioned to the right */}
      {showEquipment && !isCollapsed && activeNodeId && (
        <div className="equipment-detail-panel">
          {(() => {
            const nodeName =
              nodes.find((n) => n.nodeId === activeNodeId)?.name || "전체";

            return (
              <>
                <div className="equipment-panel-header">
                  📦 장비: {nodeName} ({totalDeviceCount})
                </div>
                <div className="equipment-panel-body">
                  {deviceGroups.length > 0 ? (
                    deviceGroups.map((group) => {
                      const isLeaf = isLeafNode(nodes, activeNodeId);

                      return (
                        <div key={group.nodeId} className="equipment-subgroup">
                          {/* Show header if not a leaf view OR if there are multiple groups (though usually leaf implies 1 group) */}
                          {!isLeaf && (
                            <div className="equipment-subgroup-header">
                              <span className="equipment-subgroup-icon">
                                📂
                              </span>
                              {group.nodeName} ({group.devices.length})
                            </div>
                          )}
                          {group.devices.map(
                            ({ device, rackId, instanceId, portStates }) => {
                              const highestError = getHighestError(portStates);
                              const hasError = !!highestError;

                              const rack = rackId
                                ? allRacksForMapping.find(
                                    (r) => r.rackId === rackId,
                                  )
                                : null;

                              const equipmentLabel =
                                device.title ||
                                device.modelName ||
                                "Device";

                              const rackLabel = rack
                                ? (rack.rackTitle ||
                                    `Rack-${rack.rackId.slice(0, 4)}`) +
                                  ` (${rack.rackSize}U)`
                                : "미배치 (Inventory)";

                              return (
                                <div
                                  key={`${activeNodeId}-${device.deviceId}`}
                                  className={`tree-node tree-node-equipment ${highlightedDeviceId === (instanceId || device.deviceId) ? "highlighted" : ""} ${hasError ? "has-error" : ""}`}
                                  onClick={() => handleDeviceClick(device.deviceId)}
                                >
                                  <span 
                                    className="tree-node-icon"
                                    style={{ color: hasError ? highestError.color : "inherit" }}
                                  >
                                    {hasError ? "⚠" : "📟"}
                                  </span>
                                  <div
                                    className="tree-node-name"
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ fontWeight: 600 }}>
                                        {equipmentLabel}
                                      </span>
                                      {hasError && (
                                        <span 
                                          className="equipment-status-dot" 
                                          style={{ background: highestError.color }}
                                          title={highestError.level}
                                        />
                                      )}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "var(--text-secondary)",
                                        marginTop: "1px",
                                      }}
                                    >
                                      📍 {rackLabel}
                                    </span>
                                  </div>
                                  <span className="tree-node-count">
                                    {device.size}U
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="equipment-panel-empty">
                      표시할 장비가 없습니다.
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Rename overlay (displayed over the tree node name) */}
      {renamingId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
          }}
          onClick={handleRenameConfirm}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-medium)",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "var(--elevation-3)",
              zIndex: 10001,
              width: "280px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "15px",
                color: "var(--text-primary)",
                fontWeight: 700,
                marginBottom: "16px",
              }}
            >
              노드 이름 변경
            </div>
            <input
              ref={renameInputRef}
              className="tree-inline-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape") setRenamingId(null);
              }}
              style={{ width: "100%", padding: "8px 12px", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                className="grafana-btn grafana-btn-primary"
                style={{ flex: 1, padding: "8px", fontSize: "13px" }}
                onClick={handleRenameConfirm}
              >
                확인
              </button>
              <button
                className="grafana-btn grafana-btn-secondary"
                style={{ flex: 1, padding: "8px", fontSize: "13px" }}
                onClick={() => setRenamingId(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tree-context-item" onClick={handleAddChild}>
            <PlusIcon style={{ marginRight: 8 }} /> 하위
            노드 추가
          </div>
          <div className="tree-context-item" onClick={handleRenameStart}>
            <PencilIcon style={{ marginRight: 8 }} />{" "}
            이름 변경
          </div>
          {nodes.find((n) => n.nodeId === contextMenu.nodeId)?.parentId !==
            null && (
            <div className="tree-context-item danger" onClick={handleDelete}>
              <TrashIcon style={{ marginRight: 8 }} />{" "}
              삭제
            </div>
          )}
        </div>
      )}
    </div>
  );
};
