import { useState, useRef, useCallback } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { HierarchyNode } from "../../types";

const MultiPickerItem = ({
  node,
  depth = 0,
  selected,
  onToggle,
}: {
  node: HierarchyNode;
  depth?: number;
  selected: boolean;
  onToggle: () => void;
}) => {
  return (
    <div
      className={`drm-cmp-option ${selected ? "active" : ""}`}
      style={{ paddingLeft: `${10 + depth * 16}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {depth > 0 &&
          Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="indent" />
          ))}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
        <span className="name">{node.name}</span>
      </div>
    </div>
  );
};

export const ChildMultiPicker = ({
  options,
  selectedIds,
  onToggle,
}: {
  options: { node: HierarchyNode; depth: number }[];
  selectedIds: Set<string>;
  onToggle: (nodeId: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, handleClose);

  return (
    <div className="drm-child-multi-picker" ref={containerRef}>
      <div
        className={`drm-cmp-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span>하위 자식 필터</span>
          {selectedIds.size > 0 && (
            <span className="count-badge">{selectedIds.size}</span>
          )}
        </div>
        <span
          className="chevron"
          style={{ fontSize: "10px", marginLeft: "8px" }}
        >
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {isOpen && (
        <div className="drm-cmp-popover">
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-tertiary)",
              }}
            >
              자식 노드가 없습니다.
            </div>
          ) : (
            options.map(({ node, depth }) => (
              <MultiPickerItem
                key={node.nodeId}
                node={node}
                depth={depth}
                selected={selectedIds.has(node.nodeId)}
                onToggle={() => onToggle(node.nodeId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
