/**
 * ModulePopover – 모듈 선택/제거 팝오버 UI 컴포넌트
 */
import type { InsertedModule, ModuleType } from '../types/equipment';
import { moduleDefinitions } from '../utils/moduleAssets';
import './DeviceModal.css';

export interface ModulePopoverData {
  portId: string;
  portType: string;
  hitboxId?: string;
  x: number;
  y: number;
}

interface Props {
  popover: ModulePopoverData;
  existingModule: InsertedModule | undefined;
  onInsert: (portId: string, moduleType: ModuleType, hitboxId?: string) => void;
  onRemove: (portId: string, hitboxId?: string) => void;
}

export const ModulePopover = ({ popover, existingModule, onInsert, onRemove }: Props) => {
  return (
    <div
      className="module-popover"
      onClick={(e) => e.stopPropagation()}
      style={{
        left: popover.x,
        top: popover.y < 150 ? popover.y + 24 : popover.y - 8,
        transform: popover.y < 150 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      <div className="module-popover-title">
        {popover.portType.toUpperCase()} — 모듈 선택
      </div>

      {existingModule && (
        <div className="module-popover-current">
          현재: {existingModule.moduleType === "ethernet" ? "Ethernet" : "SFP"}
        </div>
      )}

      <div className="module-popover-options">
        {moduleDefinitions.map((md) => (
          <button
            key={md.moduleType}
            className={`module-popover-btn ${existingModule?.moduleType === md.moduleType ? "active" : ""}`}
            onClick={() => onInsert(popover.portId, md.moduleType, popover.hitboxId)}
          >
            <img src={md.svgUrl} alt={md.displayName} />
            {md.displayName}
          </button>
        ))}
      </div>

      {existingModule && (
        <button
          className="module-remove-btn"
          onClick={() => onRemove(popover.portId, popover.hitboxId)}
        >
          모듈 제거
        </button>
      )}
    </div>
  );
};
