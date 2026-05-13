import { useShallow } from "zustand/react/shallow";
import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { ErrorLevel } from "../types";
import {
  getNodeName,
  GWACHEON_NODE_ID,
  DAEJEON_NODE_ID,
} from "../utils/nodeUtils";
import { ExclamationCircleIcon, ChartBarIcon } from "./Icons";

// Responsive Water Drop SVG component
const WaterDropIcon = ({ percentage }: { percentage: number }) => {
  // Map 0-100% to fill level (SVG Y coordinates roughly from 22 down to 2)
  const fillY = 22 - (percentage / 100) * 20;

  return (
    <svg
      width="18"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="weather-drop-svg"
    >
      <defs>
        <clipPath id={`drop-clip-${percentage.toFixed(0)}`}>
          <path d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z" />
        </clipPath>
      </defs>
      {/* Background/Outline */}
      <path
        d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z"
        stroke="var(--border-medium)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Filling Rect */}
      <rect
        x="0"
        y={fillY}
        width="24"
        height="24"
        fill="var(--theme-primary)"
        clipPath={`url(#drop-clip-${percentage.toFixed(0)})`}
      />
    </svg>
  );
};

// Error item for table display
interface ErrorItem {
  nodeId: string;
  nodeName: string;
  rackId: string;
  rackName: string;
  deviceId: string;
  deviceName: string;
  portId: string;
  displayPort: string;
  severity: ErrorLevel;
}

// Severity config for display - Grafana style
const severityConfig: Record<
  ErrorLevel,
  {
    label: string;
    bgClass: string;
    badgeClass: string;
    statBg: string;
    statColor: string;
  }
> = {
  critical: {
    label: "Critical",
    bgClass: "severity-critical",
    badgeClass: "grafana-badge-critical",
    statBg: "var(--severity-critical-bg)",
    statColor: "var(--severity-critical)",
  },
  major: {
    label: "Major",
    bgClass: "severity-major",
    badgeClass: "grafana-badge-major",
    statBg: "var(--severity-major-bg)",
    statColor: "var(--severity-major)",
  },
  minor: {
    label: "Minor",
    bgClass: "severity-minor",
    badgeClass: "grafana-badge-minor",
    statBg: "var(--severity-minor-bg)",
    statColor: "var(--severity-minor)",
  },
  warning: {
    label: "Warning",
    bgClass: "severity-warning",
    badgeClass: "grafana-badge-warning",
    statBg: "var(--severity-warning-bg)",
    statColor: "var(--severity-warning)",
  },
};

// Sensor data type (mock for now)
export interface SensorData {
  temperature: number | null;
  humidity: number | null;
}

// Mock sensor data per known node ID
export const MOCK_SENSOR_DATA: Record<string, SensorData> = {
  [GWACHEON_NODE_ID]: { temperature: 31.5, humidity: 45.0 },
  [GWACHEON_NODE_ID.replace("-1f", "-2f")]: {
    temperature: 22.1,
    humidity: 39.0,
  }, // gwacheon-room-2f
  [DAEJEON_NODE_ID]: { temperature: 23.8, humidity: 42.0 },
  ["gwacheon-center"]: { temperature: 23.2, humidity: 41.0 },
  ["daejeon-center"]: { temperature: 23.1, humidity: 54.0 },
  ["sudogwon"]: { temperature: 24.4, humidity: 43.0 },
  ["chungcheong"]: { temperature: 21.0, humidity: 62.0 },
  ["gyeonggi"]: { temperature: 23.8, humidity: 44.0 },
  ["daejeon-city"]: { temperature: 21.3, humidity: 43.0 },
};

/** 노드 ID에 대한 결정론적 센서 데이터 반환 (MOCK_SENSOR_DATA 우선, 없으면 해시 기반 생성) */
export const getNodeSensorData = (nodeId: string): SensorData => {
  if (MOCK_SENSOR_DATA[nodeId]) return MOCK_SENSOR_DATA[nodeId];
  // Deterministic hash-based fallback for unknown nodes
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
  }
  const t = 20 + (Math.abs(hash) % 50) / 10; // 20.0 ~ 24.9
  const h = 30 + (Math.abs(hash >> 8) % 400) / 10; // 30.0 ~ 69.9
  return { temperature: Math.round(t * 10) / 10, humidity: Math.round(h) };
};

export const DashboardWidgets = () => {
  const nodes = useStore((state) => state.nodes);
  const activeNodeId = useStore((state) => state.activeNodeId);
  const setActiveNode = useStore((state) => state.setActiveNode);
  const selectRack = useStore((state) => state.selectRack);
  const focusRack = useStore((state) => state.focusRack);
  const selectDevice = useStore((state) => state.selectDevice);
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorLevel | null>(
    "critical",
  );

  // Collect ALL racks from ALL nodes
  const allRacks = useStore(
    useShallow((state) => {
      const result = [...state.racks];
      Object.entries(state.layouts).forEach(([nid, layout]) => {
        if (nid !== state.activeNodeId) {
          result.push(...(layout.racks || []));
        }
      });
      return result;
    }),
  );

  // Collect all errors from all racks
  const allErrors = useMemo<ErrorItem[]>(() => {
    const errors: ErrorItem[] = [];
    allRacks.forEach((rack) => {
      const nodeName = getNodeName(nodes, rack.mapId);
      rack.devices.forEach((device) => {
        device.portStates.forEach((port) => {
          if (port.status === "error" && port.errorLevel) {
            let displayPort = port.portId;
            if (port.portName && port.portNumber) {
              if (port.portName.toLowerCase() === "port") {
                displayPort = String(port.portNumber);
              } else {
                displayPort = `${port.portNumber}\n${port.portName.toUpperCase()}`;
              }
            } else if (port.portName) {
              displayPort = port.portName.toUpperCase();
              if (displayPort === "PORT")
                displayPort = port.portId.replace("port-", "");
            } else if (port.portNumber) {
              displayPort = String(port.portNumber);
            } else {
              displayPort = port.portId.replace("port-", "");
            }

            errors.push({
              nodeId: rack.mapId,
              nodeName: nodeName,
              rackId: rack.rackId,
              rackName: rack.rackTitle || `Rack ${rack.rackId.slice(0, 4)}`,
              deviceId: device.itemId,
              deviceName: device.title,
              portId: port.portId,
              displayPort: displayPort,
              severity: port.errorLevel,
            });
          }
        });
      });
    });
    return errors;
  }, [allRacks, nodes]);

  // Handle error row click
  const handleErrorRowClick = (error: ErrorItem) => {
    // If from another node, switch first
    if (activeNodeId !== error.nodeId) {
      setActiveNode(error.nodeId);
    }

    // First select and focus the rack
    selectRack(error.rackId);
    focusRack(error.rackId);
    // Then open the device modal with highlighted port (use setTimeout to ensure state updates)
    setTimeout(() => {
      selectDevice(error.deviceId, error.portId);
    }, 50);
  };

  // Count errors by severity
  const errorCounts = useMemo(() => {
    const counts: Record<ErrorLevel, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      warning: 0,
    };
    allErrors.forEach((err) => {
      counts[err.severity]++;
    });
    return counts;
  }, [allErrors]);

  // Filter errors by selected severity
  const filteredErrors = useMemo(() => {
    if (!selectedSeverity) return [];
    return allErrors.filter((err) => err.severity === selectedSeverity);
  }, [allErrors, selectedSeverity]);

  // Collect sensor data for all nodes in the hierarchy
  const allNodeSensors = useMemo(() => {
    // Priority 1: Nodes that actually exist in hierarchy
    const sensorList = nodes
      .map((node) => ({
        id: node.nodeId,
        name: node.name,
        data: getNodeSensorData(node.nodeId),
      }))
      .filter((n) => n.id !== "root"); // Skip root if needed

    // Return only nodes that exist in hierarchy
    return sensorList;
  }, [nodes]);

  return (
    <div className="dashboard-widgets-container">
      {/* Widget 1: Error Summary - Grafana Panel Style */}
      <div className="grafana-panel">
        <div className="grafana-panel-header">
          <h3 className="grafana-panel-title">
            <span
              style={{
                fontSize: "18px",
                display: "flex",
                color: "var(--severity-critical)",
                alignSelf: "center",
                marginRight: "8px",
              }}
            >
              <ExclamationCircleIcon style={{ width: 20, height: 20 }} />
            </span>
            Overall Error Summary
          </h3>
        </div>
        <div className="grafana-panel-content">
          {/* Severity Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {(Object.keys(severityConfig) as ErrorLevel[]).map((level) => {
              const config = severityConfig[level];
              const count = errorCounts[level];
              const isSelected = selectedSeverity === level;

              return (
                <div
                  key={level}
                  className={`grafana-stat-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedSeverity(level)}
                  style={{
                    background: config.statBg,
                    color: config.statColor,
                  }}
                >
                  <div className="grafana-stat-value">{count}</div>
                  <div className="grafana-stat-label">{config.label}</div>
                </div>
              );
            })}
          </div>

          {/* Drill-down Table */}
          <div
            style={{
              borderTop: "1px solid var(--border-weak)",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {selectedSeverity && (
                <span
                  className={`grafana-badge ${severityConfig[selectedSeverity].badgeClass}`}
                >
                  {severityConfig[selectedSeverity].label}
                </span>
              )}
              <span>
                {selectedSeverity
                  ? `Errors (${filteredErrors.length})`
                  : "Select a severity level"}
              </span>
            </div>

            {/* Table Container with Fixed Height */}
            <div
              className="grafana-table-container"
              style={{ height: "180px" }}
            >
              {/* Sticky Header */}
              <div
                className="grafana-table-header"
                style={{
                  gridTemplateColumns: "0.8fr 1.4fr 0.8fr",
                  color: "var(--text-secondary)", // Slightly darker than the default table header text
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                <div
                  className="grafana-table-cell"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    whiteSpace: "normal",
                  }}
                >
                  Node
                </div>
                <div
                  className="grafana-table-cell"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    whiteSpace: "normal",
                  }}
                >
                  Equipment
                </div>
                <div
                  className="grafana-table-cell"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    whiteSpace: "normal",
                  }}
                >
                  Port
                </div>
              </div>

              {/* Scrollable Body */}
              <div style={{ height: "calc(100% - 32px)", overflowY: "auto" }}>
                {filteredErrors.length > 0 ? (
                  filteredErrors.map((err, idx) => {
                    const cellStyle: React.CSSProperties = {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    };
                    const textStyle: React.CSSProperties = {
                      textAlign: "center",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    };
                    return (
                      <div
                        key={idx}
                        className="grafana-table-row"
                        style={{
                          gridTemplateColumns: "0.8fr 1.4fr 0.8fr",
                          fontSize: "11px",
                        }}
                        onClick={() => handleErrorRowClick(err)}
                      >
                        <div
                          className="grafana-table-cell"
                          style={cellStyle}
                          title={err.nodeName}
                        >
                          <span style={textStyle}>{err.nodeName}</span>
                        </div>
                        <div
                          className="grafana-table-cell"
                          style={cellStyle}
                          title={err.deviceName}
                        >
                          <span style={textStyle}>{err.deviceName}</span>
                        </div>
                        <div
                          className="grafana-table-cell"
                          style={cellStyle}
                          title={err.displayPort}
                        >
                          <span style={textStyle}>{err.displayPort}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--text-secondary)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    {selectedSeverity
                      ? `No ${severityConfig[selectedSeverity].label.toLowerCase()} errors`
                      : "No data"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Widget 2: Global Sensor Overview - Refined Weather Style */}
      <div className="grafana-panel">
        <div className="grafana-panel-header">
          <h3 className="grafana-panel-title">
            <span
              style={{
                fontSize: "16px",
                display: "flex",
                color: "var(--theme-primary)",
                alignSelf: "center",
                marginRight: "8px",
              }}
            >
              <ChartBarIcon style={{ width: 18, height: 18 }} />
            </span>
            System Environment Overview
          </h3>
        </div>
        <div className="grafana-sensor-widget">
          <div className="weather-list">
            {allNodeSensors.length > 0 ? (
              allNodeSensors.map((node) => {
                const isActive = node.id === activeNodeId;
                const temp = node.data.temperature || 0;
                const hum = node.data.humidity || 0;

                // Normalize temp for gauge bar (assuming 15°C - 35°C range)
                const tempPercent = Math.min(
                  100,
                  Math.max(0, ((temp - 15) / 20) * 100),
                );

                let tempGradient =
                  "linear-gradient(to right, rgba(var(--theme-primary-rgb), 0.3), var(--theme-primary))";
                let tempShadow = "0 0 8px rgba(var(--theme-primary-rgb), 0.5)";

                if (tempPercent >= 80) {
                  // > 31°C
                  tempGradient =
                    "linear-gradient(to right, var(--theme-primary), #ef4444)";
                  tempShadow = "0 0 8px rgba(239, 68, 68, 0.6)";
                } else if (tempPercent >= 60) {
                  // > 27°C
                  tempGradient =
                    "linear-gradient(to right, var(--theme-primary), #f97316)";
                  tempShadow = "0 0 8px rgba(249, 115, 22, 0.6)";
                }

                return (
                  <div
                    key={node.id}
                    className={`weather-row ${isActive ? "active" : ""}`}
                    onClick={() => setActiveNode(node.id)}
                  >
                    <div className="weather-node-name" title={node.name}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <div className="weather-dot-container">
                          {isActive && <div className="weather-active-dot" />}
                        </div>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {node.name}
                        </span>
                      </div>
                    </div>

                    {/* Temperature Info (Value & Gauge only) */}
                    <div className="weather-temp">{temp.toFixed(1)}°</div>
                    <div
                      className="weather-bar-container"
                      title={`Temperature: ${temp.toFixed(1)}°C`}
                    >
                      <div className="weather-track">
                        <div
                          className="weather-temp-gradient"
                          style={{
                            width: `${tempPercent}%`,
                            background: tempGradient,
                            boxShadow: tempShadow,
                          }}
                        />
                      </div>
                    </div>

                    {/* Humidity Info (Drop Icon & Percent) */}
                    <div
                      className="weather-drop-wrap"
                      title={`Humidity: ${hum.toFixed(0)}%`}
                    >
                      <WaterDropIcon percentage={hum} />
                    </div>
                    <div className="weather-humidity-percent">
                      {hum.toFixed(0)}%
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                No sensor nodes found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
