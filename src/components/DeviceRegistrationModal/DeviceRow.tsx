import React from "react";
import { PencilIcon, TrashIcon } from "../Icons";
import { getHighestError } from "../../utils/errorHelpers";

export interface DeviceRowProps {
  device: any;
  isSelected: boolean;
  groupName: string;
  statusInfo?: { placed: boolean; highestError: ReturnType<typeof getHighestError> };
  onLocate: (device: any) => void;
  onSelect: (id: string, checked: boolean) => void;
  onEdit: (device: any) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, device: any) => void;
}

export const DeviceRow = React.memo(({
  device,
  isSelected,
  groupName,
  statusInfo,
  onLocate,
  onSelect,
  onEdit,
  onDelete
}: DeviceRowProps) => {
  return (
    <tr onClick={() => onLocate(device)}>
      <td className="col-check">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(device.deviceId, e.target.checked);
            }}
          />
        </div>
      </td>
      <td>
        <span className="drm-group-tag group-gwacheon">
          {groupName}
        </span>
      </td>
      <td>
        <div className="drm-device-name">
          {device.title || device.modelName}
        </div>
      </td>
      <td>{device.modelName}</td>
      <td
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "12px",
        }}
      >
        {device.IPAddr}
      </td>
      <td
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "12px",
        }}
      >
        {device.macAddr}
      </td>
      <td>
        <span className="drm-vendor-tag">{device.vendor}</span>
      </td>
      <td>
        {(() => {
          if (!statusInfo || !statusInfo.placed) {
            return (
              <span
                className="drm-badge"
                style={{ opacity: 0.5, fontSize: "10px" }}
              >
                미배치
              </span>
            );
          }
          if (!statusInfo.highestError) {
            return (
              <span
                className="drm-badge"
                style={{
                  color: "#4ade80",
                  borderColor: "rgba(74, 222, 128, 0.3)",
                  background: "rgba(74, 222, 128, 0.1)",
                }}
              >
                정상
              </span>
            );
          }
          const he = statusInfo.highestError;
          return (
            <span
              className="drm-badge"
              style={{
                color: he.color,
                borderColor: `${he.color}44`,
                background: `${he.color}11`,
              }}
              title={he.level}
            >
              {he.level === "critical"
                ? "심각"
                : he.level === "major"
                  ? "경고"
                  : he.level === "minor"
                    ? "주의"
                    : "알림"}
            </span>
          );
        })()}
      </td>
      <td style={{ textAlign: "center" }}>
        <button
          className="grafana-btn grafana-btn-sm grafana-btn-tertiary"
          title="수정"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(device);
          }}
        >
          <PencilIcon />
        </button>
      </td>
      <td style={{ textAlign: "center" }}>
        <button
          className="grafana-btn grafana-btn-sm grafana-btn-tertiary"
          style={{ color: "var(--severity-critical)" }}
          title="삭제"
          onClick={(e) => onDelete(e, device)}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
});

DeviceRow.displayName = "DeviceRow";
