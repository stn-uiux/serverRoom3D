import React, { useState, useEffect } from "react";
import { BuildingOfficeIcon, FolderIcon } from "../Icons";
import { getChildren } from "../../utils/nodeUtils";
import type { HierarchyNode } from "../../types";

export interface TreeNodeItemProps {
  node: HierarchyNode;
  depth: number;
  nodes: HierarchyNode[];
  selectedNodeId: string;
  expandedIds: Set<string>;
  nodeSearch: string;
  equipCountMap: Map<string, number>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  isEditMode: boolean;
  draggedNodeId: string | null;
  dragOverNodeId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (
    e: React.DragEvent,
    id: string,
    position: "before" | "after" | "inside",
  ) => void;
  onDragLeave: () => void;
  onDrop: (
    e: React.DragEvent,
    targetId: string,
    position: "before" | "after" | "inside",
  ) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onAddSubNode: (parentId: string) => void;
  onDeleteNode: (e: React.MouseEvent, node: HierarchyNode) => void;
  onRenameNode: (node: HierarchyNode) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}

export const TreeNodeItem = React.memo(
  ({
    node,
    depth,
    nodes,
    selectedNodeId,
    expandedIds,
    nodeSearch,
    equipCountMap,
    onToggle,
    onSelect,
    isEditMode,
    draggedNodeId,
    dragOverNodeId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onContextMenu,
    onAddSubNode,
    onDeleteNode,
    onRenameNode,
    renamingId,
    setRenamingId,
  }: TreeNodeItemProps) => {
    const children = getChildren(nodes, node.nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.nodeId);
    const isSelected = selectedNodeId === node.nodeId;
    const count = equipCountMap.get(node.nodeId) || 0;

    const isMatch =
      nodeSearch && node.name.toLowerCase().includes(nodeSearch.toLowerCase());

    // Local edit states for renaming
    const isRenaming = renamingId === node.nodeId;
    const [renameValue, setRenameValue] = useState(node.name);

    // Focus input when renaming starts
    useEffect(() => {
      if (isRenaming) {
        setRenameValue(node.name);
      }
    }, [isRenaming, node.name]);

    const handleRenameComplete = () => {
      if (renameValue.trim() && renameValue !== node.name) {
        onRenameNode({ ...node, name: renameValue.trim() });
      }
      setRenamingId(null);
    };

    const isDragged = draggedNodeId === node.nodeId;

    const [dropPos, setDropPos] = useState<
      "before" | "after" | "inside" | null
    >(null);

    const handleDragOver = (e: React.DragEvent) => {
      if (!isEditMode || isDragged) return;
      e.preventDefault();
      e.stopPropagation();

      // Safety: Cannot drop on own children
      const getDescendantIds = (id: string): string[] => {
        const childrenNodes = nodes.filter((n) => n.parentId === id);
        return [
          id,
          ...childrenNodes.flatMap((c) => getDescendantIds(c.nodeId)),
        ];
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
      e.stopPropagation();
      onDrop(e, node.nodeId, dropPos);
      setDropPos(null);
    };

    return (
      <>
        <div
          className={`drm-tree-node ${isSelected ? "selected" : ""} ${isMatch ? "match" : ""} ${isDragged ? "dragging" : ""} ${dropPos === "inside" ? "drop-target" : ""} ${dropPos === "before" ? "drop-before" : ""} ${dropPos === "after" ? "drop-after" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelect(node.nodeId)}
          onContextMenu={(e) => onContextMenu(e, node.nodeId)}
          draggable={isEditMode && node.parentId !== null}
          onDragStart={(e) => {
            if (!isEditMode || node.parentId === null) {
              e.preventDefault();
              return;
            }
            e.stopPropagation();
            onDragStart(node.nodeId);
          }}
          onDragOver={handleDragOver}
          onDragLeave={() => {
            setDropPos(null);
            onDragLeave();
          }}
          onDrop={handleDrop}
        >
          <span
            className={`drm-tree-node-toggle ${isExpanded ? "expanded" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggle(node.nodeId);
            }}
            style={{ visibility: hasChildren ? "visible" : "hidden" }}
          >
            ▶
          </span>
          <span className="drm-tree-node-icon">
            {node.parentId === null ? (
              <BuildingOfficeIcon
                style={{
                  width: 14,
                  height: 14,
                  color: isSelected
                    ? "var(--theme-primary)"
                    : "var(--text-tertiary)",
                }}
              />
            ) : (
              <FolderIcon
                style={{
                  width: 14,
                  height: 14,
                  color: isSelected
                    ? "var(--theme-primary)"
                    : "var(--text-tertiary)",
                }}
              />
            )}
          </span>

          {isRenaming ? (
            <input
              type="text"
              className="tree-rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameComplete();
                if (e.key === "Escape") setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()}
              style={{
                flex: 1,
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--theme-primary)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "12px",
                outline: "none",
              }}
            />
          ) : (
            <span
              className="drm-tree-node-name"
              onDoubleClick={(e) => {
                if (isEditMode) {
                  e.stopPropagation();
                  setRenamingId(node.nodeId);
                }
              }}
            >
              {node.name}
            </span>
          )}

          {count > 0 && !isRenaming && (
            <span
              className="drm-tree-node-count"
              style={{ marginLeft: isEditMode ? "4px" : "auto" }}
            >
              {count}
            </span>
          )}
        </div>
        {isExpanded &&
          children.map((child) => (
            <TreeNodeItem
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              expandedIds={expandedIds}
              nodeSearch={nodeSearch}
              equipCountMap={equipCountMap}
              onToggle={onToggle}
              onSelect={onSelect}
              isEditMode={isEditMode}
              draggedNodeId={draggedNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onContextMenu={onContextMenu}
              onAddSubNode={onAddSubNode}
              onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))}
      </>
    );
  },
);
