import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { getAncestorPath } from "../utils/nodeUtils";

import "./Breadcrumb.css";

export const Breadcrumb = () => {
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);

  const path = useMemo(
    () => getAncestorPath(nodes, activeNodeId),
    [nodes, activeNodeId],
  );

  const MAX_VISIBLE = 3;
  const displayPath = useMemo(() => {
    if (path.length <= MAX_VISIBLE) return path.map(n => ({ ...n, isEllipsis: false }));

    const first = path[0];
    const lastTwo = path.slice(-2);

    return [
      { ...first, isEllipsis: false },
      { nodeId: 'ellipsis', name: '...', isEllipsis: true },
      ...lastTwo.map(n => ({ ...n, isEllipsis: false }))
    ];
  }, [path]);

  if (path.length === 0) return null;

  return (
    <>
      <div className="grafana-toolbar-divider" />
      <div className="breadcrumb-container">
        {displayPath.map((node, idx) => {
          const isLast = idx === displayPath.length - 1 && !node.isEllipsis;

          return (
            <span key={node.nodeId === 'ellipsis' ? `ellipsis-${idx}` : node.nodeId} style={{ display: "flex", alignItems: "center" }}>
              {idx > 0 && <span className="breadcrumb-separator">›</span>}
              {node.isEllipsis ? (
                <span 
                  className="breadcrumb-ellipsis" 
                  data-tooltip={`생략된 경로: ${path.slice(1, -2).map(n => n.name).join(" > ")}`}
                >
                  ...
                </span>
              ) : (
                <span
                  className={`breadcrumb-item ${isLast ? "active" : ""}`}
                  onClick={() => !isLast && setActiveNode(node.nodeId)}
                  title={node.name}
                >
                  {node.name}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="grafana-toolbar-divider" />
    </>
  );
};
