import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { NodePicker, FormSelect } from "./NodePicker";
import { EquipmentAssemblyModal } from "../EquipmentAssemblyModal";
import { DeviceSvgPreview } from "../DeviceSvgPreview";
import { equipmentModels } from "../../utils/cardAssets";
import type { InsertedCard, GeneratedPort, InsertedModule } from "../../types/equipment";
import { useStore } from "../../store/useStore";
import { DEVICE_TEMPLATES } from "../../utils/deviceTemplates";
import { hasDeviceSvgAsset } from "../../utils/deviceAssets";
import type { VendorName, HierarchyNode } from "../../types";

const VENDORS: VendorName[] = [
  "코위버PTN",
  "CISCO",
  "Huawei",
  "Nokia",
  "유비쿼스",
];

// Simple IP format validation (X.X.X.X)
const isValidIP = (IPAddr: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(IPAddr) &&
  IPAddr.split(".").every((n) => parseInt(n) >= 0 && parseInt(n) <= 255);

// Simple MAC format validation (XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)
const isValidMAC = (macAddr: string) =>
  /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(macAddr);

// --- Registration Form Modal (Separate Overlay) ---
export const RegistrationFormModal = ({
  isOpen,
  onClose,
  editingDeviceId,
  activeNodeId,
  nodes,
  registeredDevices,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingDeviceId: string | null;
  activeNodeId: string;
  nodes: HierarchyNode[];
  registeredDevices: any[];
  onSuccess: (title: string, isEdit: boolean) => void;
}) => {
  const addRegisteredDevice = useStore((s) => s.addRegisteredDevice);
  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);

  // Form state
  const [nodeId, setNodeId] = useState<string>(activeNodeId || "");
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [title, setDeviceName] = useState("");
  const [IPAddr, setIp] = useState("");
  const [macAddr, setMac] = useState("");
  const [vendor, setVendor] = useState<VendorName>("Nokia");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Equipment Assembly State
  const [insertedCards, setInsertedCards] = useState<InsertedCard[]>([]);
  const [generatedPorts, setGeneratedPorts] = useState<GeneratedPort[]>([]);
  const [dashboardThumbnailUrl, setDashboardThumbnailUrl] =
    useState<string>("");
  const [isAssemblyOpen, setIsAssemblyOpen] = useState(false);

  // Module State
  const [insertedModules, setInsertedModules] = useState<InsertedModule[]>([]);

  const selectedTemplate = DEVICE_TEMPLATES[selectedModelIdx];

  useEffect(() => {
    if (isOpen) {
      if (editingDeviceId) {
        const device = registeredDevices.find(
          (d) => d.deviceId === editingDeviceId,
        );
        if (device) {
          setNodeId(device.deviceGroupId || "");
          const idx = DEVICE_TEMPLATES.findIndex(
            (t) => t.modelName === device.modelName,
          );
          if (idx >= 0) setSelectedModelIdx(idx);
          setDeviceName(device.title || "");
          setIp(device.IPAddr || "");
          setMac(device.macAddr || "");
          if (device.vendor) setVendor(device.vendor);
          setInsertedCards(device.insertedCards || []);
          setInsertedModules(device.insertedModules || []);
          setDashboardThumbnailUrl(device.dashboardThumbnailUrl || "");
        }
      } else {
        setNodeId(activeNodeId || "");
        setSelectedModelIdx(0); // 기본 모델로 초기화
        setDeviceName("");
        setIp("");
        setMac("");
        setErrors({});
        setInsertedCards([]);
        setInsertedModules([]);
        setGeneratedPorts([]);
        setDashboardThumbnailUrl("");
      }
    }
  }, [isOpen, editingDeviceId, activeNodeId, registeredDevices]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "필수 입력";
    if (!IPAddr.trim()) newErrors.IPAddr = "필수 입력";
    else if (!isValidIP(IPAddr.trim())) newErrors.IPAddr = "형식: X.X.X.X";
    if (!macAddr.trim()) newErrors.macAddr = "필수 입력";
    else if (!isValidMAC(macAddr.trim()))
      newErrors.macAddr = "형식: XX:XX:XX:XX:XX:XX";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const macTrimmed = macAddr.trim().toUpperCase();
    const existing = registeredDevices.find(
      (d) => d.macAddr === macTrimmed && d.deviceId !== editingDeviceId,
    );
    if (existing) {
      setErrors((prev) => ({ ...prev, macAddr: "이미 존재하는 MAC입니다." }));
      return;
    }

    const payload: any = {
      title: title.trim(),
      IPAddr: IPAddr.trim(),
      macAddr: macTrimmed,
    };
    // 선택 필드: 값이 있을 때만 포함
    if (nodeId) payload.deviceGroupId = nodeId;
    if (selectedTemplate) {
      payload.modelName = selectedTemplate.modelName;
      payload.type = selectedTemplate.type;
      payload.size = selectedTemplate.uSize;
    }
    if (vendor) payload.vendor = vendor;

    if (insertedCards.length > 0) {
      payload.insertedCards = insertedCards;
      payload.dashboardThumbnailUrl = dashboardThumbnailUrl;
      payload.generatedPorts = generatedPorts;
    } else {
      payload.insertedCards = [];
      payload.dashboardThumbnailUrl = "";
      payload.generatedPorts = [];
    }
    // 모듈 정보 포함
    payload.insertedModules = insertedModules;

    if (editingDeviceId) {
      updateRegisteredDevice(editingDeviceId, payload);
      onSuccess(title.trim(), true);
    } else {
      addRegisteredDevice(payload);
      onSuccess(title.trim(), false);
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="drm-reg-modal-overlay" onClick={onClose}>
      <div className="drm-reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drm-form-title">
          {editingDeviceId ? "장비 정보 수정" : "새 장비 등록"}
        </div>

        <div className="drm-form-grid">
          <div className="drm-field">
            <label>위치</label>
            <NodePicker
              nodes={nodes}
              selectedNodeId={nodeId}
              registeredDevices={registeredDevices}
              onSelect={(id) => setNodeId(id)}
            />
            {errors.nodeId && (
              <span className="drm-error-hint">{errors.nodeId}</span>
            )}
          </div>

          <div className="drm-field">
            <label>모델</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <FormSelect
                  options={DEVICE_TEMPLATES.map((t, i) => ({
                    label: `[${t.uSize}U] ${t.modelName}`,
                    value: i,
                  }))}
                  value={selectedModelIdx}
                  onChange={(val) => {
                    setSelectedModelIdx(val);
                    setInsertedCards([]);
                    setInsertedModules([]);
                    setDashboardThumbnailUrl("");
                  }}
                  placeholder="장비 모델 선택"
                />
              </div>
              {Array.isArray(equipmentModels) &&
                equipmentModels.some(
                  (m) => m.modelName === selectedTemplate?.modelName,
                ) && (
                  <button
                    style={{
                      background: "linear-gradient(135deg, var(--theme-primary), #4872d8)",
                      color: "#fff",
                      border: "none",
                      padding: "0 16px",
                      height: "44px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => setIsAssemblyOpen(true)}
                  >
                    장비 구성
                  </button>
                )}
            </div>
          </div>

          <div className="drm-field drm-field-full">
            <label>
              장비명<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="장비 이름을 입력하세요 (예: 2층-라우터-01)"
            />
            {errors.title && (
              <span className="drm-error-hint">{errors.title}</span>
            )}
          </div>

          <div className="drm-field">
            <label>
              IP 주소<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={IPAddr}
              onChange={(e) => setIp(e.target.value)}
              placeholder="10.0.0.1"
            />
            {errors.IPAddr && (
              <span className="drm-error-hint">{errors.IPAddr}</span>
            )}
          </div>

          <div className="drm-field">
            <label>벤더</label>
            <FormSelect
              options={VENDORS.map((v) => ({ label: v, value: v }))}
              value={vendor}
              onChange={(val) => setVendor(val)}
            />
          </div>

          <div className="drm-field drm-field-full">
            <label>
              MAC 주소<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={macAddr}
              onChange={(e) => setMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
            {errors.macAddr && (
              <span className="drm-error-hint">{errors.macAddr}</span>
            )}
          </div>
        </div>

        {/* 장비 프리뷰 + 모듈 설정 */}
        {selectedTemplate && hasDeviceSvgAsset(selectedTemplate.modelName) && (
          <div style={{
            margin: "0 0 32px",
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "13px", fontWeight: 700, color: "var(--text-primary)",
                }}>장비 프리뷰</span>
                {insertedModules.length > 0 && (
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 8px",
                    borderRadius: "8px", background: "rgba(0, 229, 255, 0.1)",
                    color: "#00e5ff", border: "1px solid rgba(0, 229, 255, 0.3)",
                  }}>모듈 {insertedModules.length}개</span>
                )}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                포트를 클릭하여 모듈을 설정하세요
              </span>
            </div>
            <div style={{ borderRadius: "8px" }}>
              <DeviceSvgPreview
                modelName={selectedTemplate.modelName}
                insertedCards={insertedCards}
                insertedModules={insertedModules}
                onModuleChange={setInsertedModules}
                editable={true}
                maxWidth="100%"
              />
            </div>
          </div>
        )}

        <div className="drm-form-actions">
          <button
            className="grafana-btn grafana-btn-lg grafana-btn-secondary"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="grafana-btn grafana-btn-lg grafana-btn-primary"
            onClick={handleSubmit}
          >
            {editingDeviceId ? "저장하기" : "등록하기"}
          </button>
        </div>
      </div>
      {isAssemblyOpen && (
        <EquipmentAssemblyModal
          open={isAssemblyOpen}
          onClose={() => setIsAssemblyOpen(false)}
          initialModelName={selectedTemplate?.modelName}
          initialCards={insertedCards}
          onSave={(result) => {
            setInsertedCards(result.cards);
            setDashboardThumbnailUrl(result.thumbnailDataUrl);
            if (result.generatedPorts) {
              setGeneratedPorts(result.generatedPorts);
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
};
