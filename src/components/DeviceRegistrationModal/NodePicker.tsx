import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { MagnifyingGlassIcon, ChevronDownIcon } from "../Icons";
import { TreeNodeItem } from "./TreeNodeItem";
import { useClickOutside } from "../../hooks/useClickOutside";
import { getNodeName, getAncestorPath } from "../../utils/nodeUtils";
import type { HierarchyNode } from "../../types";

// Stable no-op function to avoid re-creating arrow functions on every render
const NOOP: any = () => {};

// --- Custom Hierarchical Node Picker Component ---
export const NodePicker = ({
  nodes,
  selectedNodeId,
  registeredDevices,
  onSelect,
}: {
  nodes: HierarchyNode[];
  selectedNodeId: string;
  registeredDevices: any[];
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Pre-compute equipment count map for tree nodes in picker
  const pickerEquipCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of registeredDevices) {
      const gid = d.deviceGroupId || "";
      map.set(gid, (map.get(gid) || 0) + 1);
    }
    return map;
  }, [registeredDevices]);

  const selectedNodeName = useMemo(() => {
    if (!selectedNodeId) return "선택하세요";
    return getNodeName(nodes, selectedNodeId);
  }, [nodes, selectedNodeId]);

  const handleClose = useCallback(() => setIsOpen(false), []);
  useClickOutside(pickerRef, isOpen, handleClose);

  // Expand parents if searching or if selected
  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const toExpand = new Set<string>();
      nodes.forEach((n) => {
        if (n.name.toLowerCase().includes(q)) {
          let curr = n;
          while (curr.parentId) {
            toExpand.add(curr.parentId);
            const parent = nodes.find((p) => p.nodeId === curr.parentId);
            if (!parent) break;
            curr = parent;
          }
        }
      });
      if (toExpand.size > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [search, nodes]);

  // Expand ancestors of selected node on open
  useEffect(() => {
    if (isOpen && selectedNodeId) {
      const path = getAncestorPath(nodes, selectedNodeId);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        path.forEach((n) => next.add(n.nodeId));
        return next;
      });
    }
  }, [isOpen, selectedNodeId, nodes]);

  return (
    <div className="drm-node-picker" ref={pickerRef}>
      <div
        className={`drm-node-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span>{selectedNodeName}</span>
        <span className="chevron">
          <ChevronDownIcon style={{ width: 14, height: 14 }} />
        </span>
      </div>

      {isOpen && (
        <div
          className="drm-node-picker-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drm-node-picker-search">
            <MagnifyingGlassIcon
              className="search-icon"
              style={{ width: 14, height: 14 }}
            />
            <input
              type="text"
              placeholder="노드 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="drm-node-picker-tree">
            {nodes
              .filter((n) => n.parentId === null)
              .map((root) => (
                <TreeNodeItem
                  key={root.nodeId}
                  node={root}
                  depth={0}
                  nodes={nodes}
                  selectedNodeId={selectedNodeId}
                  expandedIds={expandedIds}
                  nodeSearch={search}
                  equipCountMap={pickerEquipCountMap}
                  onToggle={(id) =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelect={(id) => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  isEditMode={false}
                  draggedNodeId={null}
                  dragOverNodeId={null}
                  onDragStart={NOOP}
                  onDragOver={NOOP}
                  onDragLeave={NOOP}
                  onDrop={NOOP}
                  onContextMenu={NOOP}
                  onAddSubNode={NOOP}
                  onDeleteNode={NOOP}
                  onRenameNode={NOOP}
                  renamingId={null}
                  setRenamingId={NOOP}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Custom Select for Form Fields ---
export const FormSelect = ({
  options,
  value,
  onChange,
  placeholder = "선택하세요",
}: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (val: any) => void;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : placeholder;
  }, [options, value, placeholder]);

  const handleClose = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, handleClose);

  return (
    <div className="drm-form-select" ref={containerRef}>
      <div
        className={`drm-node-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ height: "44px", borderRadius: "12px" }}
      >
        <span>{selectedLabel}</span>
        <span className="chevron">
          <ChevronDownIcon style={{ width: 14, height: 14 }} />
        </span>
      </div>

      {isOpen && (
        <div className="drm-form-select-popover">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`drm-form-select-option ${opt.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="check-icon">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
