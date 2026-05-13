import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "../utils/indexedDBStorage";
import type {
  Rack,
  Device,
  ImportedModel,
  HierarchyNode,
  RegisteredDevice,
  PortState,
} from "../types";
import { type GeneratedPort } from "../types/equipment";
import { GRID_SPACING, RACK_WIDTH_STANDARD } from "../components/constants";
import {
  getFrontDirection,
  getEffectiveDimensions,
} from "../utils/rackGeometry";
import { migrateGroupNameToNodeId, NONE_NODE_ID } from "../utils/nodeUtils";
import { Camera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { layoutsEqual } from "../utils/comparison";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

export interface AppState {
  racks: Rack[];
  registeredDevices: RegisteredDevice[];
  selectedRackId: string | null;
  selectedDeviceId: string | null;
  highlightedPortId: string | null;
  focusedRackId: string | null;
  isDragging: boolean;
  draggingRackId: string | null;
  dragPosition: [number, number] | null;
  dragOffset: [number, number] | null;
  isEditMode: boolean;
  hoveredRackId: string | null;
  importExportModalRackId: string | null;
  deviceRegistrationModalOpen: boolean;
  deviceDeleteConfirm: { id: string; title: string; rackName?: string } | null;
  setDeviceDeleteConfirm: (
    confirm: { id: string; title: string; rackName?: string } | null,
  ) => void;
  highlightedDeviceId: string | null;
  blinkTimeoutId: number | null; // Track current blink timer to clear it if needed
  showEquipmentInTree: boolean;
  preFocusCameraState: CameraState | null;

  // Hierarchy
  nodes: HierarchyNode[];
  activeNodeId: string | null;
  expandedNodeIds: Set<string>;
  isHierarchyCollapsed: boolean;

  // Node-Specific 3D Layouts
  layouts: Record<string, { racks: Rack[]; importedModels: ImportedModel[] }>;

  // Camera reference for viewport-center spawning
  _cameraRef: Camera | null;
  _controlsRef: any | null;

  // Gizmo interaction state
  isGizmoHovered: boolean;

  // Imported 3D Models
  importedModels: ImportedModel[];
  selectedModelId: string | null;
  draggingModelId: string | null;
  modelDragPosition: [number, number] | null;
  modelDragOffset: [number, number] | null;

  // Toast Notification
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (
    message: string,
    type: "success" | "error",
    source?: string,
  ) => void;

  // Unsaved Changes & Undo
  baselineRacks: Rack[] | null;
  baselineModels: ImportedModel[] | null;
  baselineNodes: HierarchyNode[] | null;
  undoStack: {
    racks: Rack[];
    importedModels: ImportedModel[];
    nodes: HierarchyNode[];
  }[];
  redoStack: {
    racks: Rack[];
    importedModels: ImportedModel[];
    nodes: HierarchyNode[];
  }[];
  showUnsavedDialog: boolean;
  pendingAction:
    | { type: "node"; value: string | null }
    | { type: "editMode"; value: boolean }
    | null;
  _importDirty: boolean; // Forced dirty flag after import

  // Camera Trigger
  triggerFitToScene: number;
  fitToScene: () => void;

  // Editor Transform State


  // Actions
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  setCameraRef: (camera: Camera, controls: any) => void;
  setHoveredRack: (id: string | null) => void;
  setActiveNode: (nodeId: string | null) => void;
  setImportExportModalRackId: (id: string | null) => void;
  addRack: (
    rackSize: 24 | 32 | 48,
    position?: [number, number],
    width?: number,
  ) => void;
  moveRack: (id: string, newPosition: [number, number]) => boolean;
  deleteRack: (id: string) => void;
  selectRack: (id: string | null) => void;
  selectDevice: (id: string | null, portId?: string | null) => void;
  focusRack: (id: string | null) => void;
  setPreFocusCameraState: (state: CameraState | null) => void;
  setDragging: (
    isDragging: boolean,
    rackId?: string | null,
    offset?: [number, number] | null,
  ) => void;
  updateDragPosition: (pos: [number, number] | null) => void;
  endDrag: (id: string, newPosition: [number, number]) => boolean;
  updateRackOrientation: (id: string, orientation: 0 | 90 | 180 | 270) => void;
  setEditMode: (enabled: boolean) => void;

  addDevice: (rackId: string, device: Omit<Device, "itemId">) => boolean;
  removeDevice: (rackId: string, deviceId: string) => void;
  /** Returns { rackId, nodeId, deviceId } if the registeredDeviceId is already mounted somewhere, else null */
  findExistingMount: (
    registeredDeviceId: string,
  ) => {
    rackId: string;
    nodeId: string;
    deviceId: string;
    rackName?: string;
  } | null;
  updateRack: (
    id: string,
    updates: Partial<Omit<Rack, "rackId" | "position">>,
  ) => void;

  // Registered Device Management
  setDeviceRegistrationModalOpen: (open: boolean) => void;
  setHighlightedDevice: (id: string | null, duration?: number) => void;
  setShowEquipmentInTree: (show: boolean) => void;
  addRegisteredDevice: (device: Omit<RegisteredDevice, "deviceId">) => void;
  removeRegisteredDevice: (id: string) => void;
  updateRegisteredDevice: (
    id: string,
    updates: Partial<RegisteredDevice> & { generatedPorts?: GeneratedPort[] },
  ) => void;
  upsertRegisteredDevices: (devices: Omit<RegisteredDevice, "deviceId">[]) => {
    added: number;
    updated: number;
  };

  // Import/Export flow enhancements
  pendingImportFile: File | null;
  setPendingImportFile: (file: File | null) => void;

  // Imported Model Actions
  addImportedModel: (model: Omit<ImportedModel, "id">) => string;
  selectModel: (id: string | null) => void;
  deleteModel: (id: string) => void;
  updateModel: (
    id: string,
    updates: Partial<Omit<ImportedModel, "id">>,
  ) => void;
  setModelDragging: (
    modelId: string | null,
    pos?: [number, number] | null,
    offset?: [number, number] | null,
  ) => void;
  updateModelDragPosition: (pos: [number, number] | null) => void;
  endModelDrag: (id: string, position: [number, number]) => void;
  toggleModelMove: (id: string) => void;

  // Hierarchy Node Management
  addNode: (node: Omit<HierarchyNode, "nodeId">) => string;
  renameNode: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  locateDevice: (registeredDeviceId: string) => boolean;
  upsertNodes: (
    nodes: HierarchyNode[],
    overwrite: boolean,
    dryRun?: boolean,
  ) => { mapping: Record<string, string>; updatedNodes: HierarchyNode[] };
  setExpandedNodeIds: (ids: Set<string>) => void;
  toggleNodeExpansion: (nodeId: string, expand?: boolean) => void;
  expandNodePath: (nodeId: string | null) => void;
  setHierarchyCollapsed: (collapsed: boolean) => void;
  reorderNode: (
    nodeId: string,
    targetNodeId: string,
    position: "before" | "after" | "inside",
  ) => void;

  // Data Persistence
  loadState: (
    racks: Rack[],
    models?: ImportedModel[],
    registeredDevices?: RegisteredDevice[],
    nodes?: HierarchyNode[],
  ) => void;
  replaceNodeData: (
    nodeId: string | "ALL",
    newRacks: Rack[],
    newRegisteredDevices?: RegisteredDevice[],
  ) => void;
  replaceMultipleNodesData: (
    data: Record<
      string,
      { racks: Rack[]; registeredDevices: RegisteredDevice[] }
    >,
  ) => void;
  updateDevicePortStates: (
    deviceId: string,
    newPortStates: import("../types").PortState[]
  ) => void;

  // Edit Session Actions
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;
  saveChanges: () => void;
  discardChanges: () => void;
  cancelConfirmation: () => void;
  getIsDirty: () => boolean;
}

// Helper to check collision using AABB (Axis-Aligned Bounding Box)
const checkCollision = (
  racks: Rack[],
  idToExclude: string | null,
  pos: [number, number],
  width: number,
  orientation: 0 | 90 | 180 | 270 = 180,
): boolean => {
  const { effectiveWidth: w1, effectiveDepth: d1 } = getEffectiveDimensions(
    width,
    orientation,
  );
  const x1 = pos[0] * GRID_SPACING;
  const z1 = pos[1] * GRID_SPACING;

  return racks.some((r) => {
    if (r.rackId === idToExclude) return false;

    const { effectiveWidth: w2, effectiveDepth: d2 } = getEffectiveDimensions(
      r.width,
      r.orientation ?? 180,
    );
    const x2 = r.position[0] * GRID_SPACING;
    const z2 = r.position[1] * GRID_SPACING;

    // AABB overlap check
    const overlapX = Math.abs(x1 - x2) < (w1 + w2) / 2 - 0.01; // Small buffer
    const overlapZ = Math.abs(z1 - z2) < (d1 + d2) / 2 - 0.01;

    return overlapX && overlapZ;
  });
};

// Helper to check front clearance violation (combined Rule A + Rule B)
export const checkFrontClearanceViolation = (
  racks: Rack[],
  movedRackId: string,
  newPos: [number, number],
  movedRackOrientation?: 0 | 90 | 180 | 270,
  movedRackWidth?: number,
): boolean => {
  const CLEARANCE = 1.74;

  const movedRack = racks.find((r) => r.rackId === movedRackId);
  const placedOrientation =
    movedRackOrientation ?? movedRack?.orientation ?? 180;
  const placedWidth = movedRackWidth ?? movedRack?.width ?? RACK_WIDTH_STANDARD;

  const placedFrontDir = getFrontDirection(placedOrientation);
  const placedDims = getEffectiveDimensions(placedWidth, placedOrientation);

  const isInFront = (
    frontDir: { x: number; z: number },
    sourceDims: { effectiveWidth: number; effectiveDepth: number },
    otherDims: { effectiveWidth: number; effectiveDepth: number },
    deltaX: number,
    deltaZ: number,
  ): boolean => {
    if (frontDir.x !== 0) {
      const inFront = frontDir.x > 0 ? deltaX > 0 : deltaX < 0;
      const withinClearance = Math.abs(deltaX) <= CLEARANCE;
      const aligned =
        Math.abs(deltaZ) <
        (sourceDims.effectiveDepth + otherDims.effectiveDepth) / 2 - 0.05;
      if (inFront && withinClearance && aligned) return true;
    }
    if (frontDir.z !== 0) {
      const inFront = frontDir.z > 0 ? deltaZ > 0 : deltaZ < 0;
      const withinClearance = Math.abs(deltaZ) <= CLEARANCE;
      const aligned =
        Math.abs(deltaX) <
        (sourceDims.effectiveWidth + otherDims.effectiveWidth) / 2 - 0.05;
      if (inFront && withinClearance && aligned) return true;
    }
    return false;
  };

  for (const otherRack of racks) {
    if (otherRack.rackId === movedRackId) continue;

    const otherOrientation = otherRack.orientation ?? 180;
    const otherDims = getEffectiveDimensions(otherRack.width, otherOrientation);
    const deltaToOtherX = (otherRack.position[0] - newPos[0]) * GRID_SPACING;
    const deltaToOtherZ = (otherRack.position[1] - newPos[1]) * GRID_SPACING;

    if (
      isInFront(
        placedFrontDir,
        placedDims,
        otherDims,
        deltaToOtherX,
        deltaToOtherZ,
      )
    ) {
      return true;
    }

    const otherFrontDir = getFrontDirection(otherOrientation);
    const deltaFromOtherX = (newPos[0] - otherRack.position[0]) * GRID_SPACING;
    const deltaFromOtherZ = (newPos[1] - otherRack.position[1]) * GRID_SPACING;

    if (
      isInFront(
        otherFrontDir,
        otherDims,
        placedDims,
        deltaFromOtherX,
        deltaFromOtherZ,
      )
    ) {
      return true;
    }
  }

  return false;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  racks: [],
  registeredDevices: [],
  selectedRackId: null,
  selectedDeviceId: null,
  highlightedPortId: null,
  focusedRackId: null,
  isDragging: false,
  draggingRackId: null,
  dragPosition: null,
  dragOffset: null,
  isEditMode: false,
  hoveredRackId: null,
  nodes: [],
  activeNodeId: null,
  expandedNodeIds: new Set(),
  isHierarchyCollapsed: false,
  layouts: {},
  importExportModalRackId: null,
  deviceRegistrationModalOpen: false,
  deviceDeleteConfirm: null,
  setDeviceDeleteConfirm: (confirm) => set({ deviceDeleteConfirm: confirm }),
  highlightedDeviceId: null,
  blinkTimeoutId: null,
  showEquipmentInTree: false,
  preFocusCameraState: null,
  pendingImportFile: null,
  setPendingImportFile: (file) => set({ pendingImportFile: file }),

  isGizmoHovered: false,

  _cameraRef: null,
  _controlsRef: null,

  importedModels: [],
  selectedModelId: null,
  draggingModelId: null,
  modelDragPosition: null,
  modelDragOffset: null,

  toast: null,
  showToast: (message, type) => {
    set({ toast: { message, type } });
    setTimeout(() => {
      const current = get().toast;
      if (current?.message === message) {
        set({ toast: null });
      }
    }, 3000);
  },

  baselineRacks: null,
  baselineModels: null,
  baselineNodes: null,
  undoStack: [],
  redoStack: [],
  showUnsavedDialog: false,
  pendingAction: null,
  _importDirty: false,

  triggerFitToScene: 0,
  fitToScene: () =>
    set((state) => ({
      triggerFitToScene: state.triggerFitToScene + 1,
      focusedRackId: null,
      selectedRackId: null,
      selectedDeviceId: null,
      selectedModelId: null,
      preFocusCameraState: null,
    })),



  getIsDirty: () => {
    const {
      racks,
      importedModels,
      nodes,
      baselineRacks,
      baselineModels,
      baselineNodes,
      _importDirty,
    } = get();
    if (_importDirty) return true;

    // Use current state as fallback if baselines are null/undefined (e.g. legacy state before persistence fix).
    // This prevents false dirty flags upon page refresh.
    const baseRacks = baselineRacks || racks;
    const baseModels = baselineModels || importedModels;
    const baseNodes = baselineNodes || nodes;

    // Robust field-by-field comparison with epsilon tolerance
    return (
      !layoutsEqual(racks, baseRacks) ||
      !layoutsEqual(importedModels, baseModels) ||
      !layoutsEqual(nodes, baseNodes)
    );
  },

  pushUndoState: () => {
    const { isEditMode, racks, importedModels, nodes, undoStack } = get();
    if (!isEditMode) return;

    // Phase 3-A: 단일 structuredClone 호출로 통합 (3회 → 1회)
    const { racks: r, importedModels: m, nodes: n } = structuredClone({ racks, importedModels, nodes });
    const newEntry = { racks: r, importedModels: m, nodes: n };

    set({
      undoStack: [...undoStack, newEntry].slice(-50), // Limit to 50 entries
      redoStack: [], // Clear redo stack on new action
    });
  },

  undo: () => {
    const { isEditMode, undoStack, redoStack, racks, importedModels, nodes } = get();
    if (!isEditMode || undoStack.length === 0) return;

    const newStack = [...undoStack];
    const prevState = newStack.pop();

    if (prevState) {
      const currentState = { racks, importedModels, nodes };
      set({
        racks: prevState.racks,
        importedModels: prevState.importedModels,
        nodes: prevState.nodes,
        undoStack: newStack,
        redoStack: [...redoStack, currentState].slice(-50),
      });
    }
  },

  redo: () => {
    const { isEditMode, undoStack, redoStack, racks, importedModels, nodes } = get();
    if (!isEditMode || redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop();

    if (nextState) {
      const currentState = { racks, importedModels, nodes };
      set({
        racks: nextState.racks,
        importedModels: nextState.importedModels,
        nodes: nextState.nodes,
        undoStack: [...undoStack, currentState].slice(-50),
        redoStack: newRedoStack,
      });
    }
  },

  saveChanges: () => {
    const {
      pendingAction,
      racks,
      importedModels,
      activeNodeId,
      layouts,
      expandNodePath,
    } = get();

    // 1. Save current state and clear flags
    const updatedLayouts = activeNodeId
      ? {
          ...layouts,
          [activeNodeId]: { racks, importedModels },
        }
      : layouts;

    // Phase 3-A: 단일 structuredClone으로 baseline 스냅샷
    const { nodes: currentNodes } = get();
    const snapshot = structuredClone({ racks, importedModels, nodes: currentNodes });
    set({
      layouts: updatedLayouts,
      baselineRacks: snapshot.racks,
      baselineModels: snapshot.importedModels,
      baselineNodes: snapshot.nodes,
      undoStack: [],
      redoStack: [],
      showUnsavedDialog: false,
      pendingAction: null,
      _importDirty: false,
    });

    // 2. Execute pending action DIRECTLY (bypass dirty checks since we just saved)
    if (pendingAction) {
      if (pendingAction.type === "node") {
        const targetNodeId = pendingAction.value;
        expandNodePath(targetNodeId);
        const currentLayouts = get().layouts;
        const newNodeLayout = targetNodeId
          ? currentLayouts[targetNodeId] || { racks: [], importedModels: [] }
          : { racks: [], importedModels: [] };

        // Phase 3-A: 단일 structuredClone으로 새 노드 baseline 스냅샷
        const newSnap = structuredClone({
          racks: newNodeLayout.racks,
          importedModels: newNodeLayout.importedModels,
          nodes: get().nodes,
        });
        set({
          activeNodeId: targetNodeId,
          racks: newNodeLayout.racks,
          importedModels: newNodeLayout.importedModels,
          baselineRacks: newSnap.racks,
          baselineModels: newSnap.importedModels,
          baselineNodes: newSnap.nodes,
          undoStack: [],
          redoStack: [],
          selectedRackId: null,
          focusedRackId: null,
          selectedDeviceId: null,
          isDragging: false,
          draggingRackId: null,
          dragPosition: null,
          dragOffset: null,
          draggingModelId: null,
          modelDragPosition: null,
          modelDragOffset: null,
          preFocusCameraState: null,
          triggerFitToScene: get().triggerFitToScene + 1,
        });
      } else if (pendingAction.type === "editMode") {
        get().setEditMode(pendingAction.value);
      }
    }
  },

  discardChanges: () => {
    const {
      pendingAction,
      baselineRacks,
      baselineModels,
      baselineNodes,
      activeNodeId,
    } = get();

    if (baselineRacks && baselineModels && baselineNodes) {
      // Restore from baseline
      // Phase 3-A: 단일 structuredClone으로 복원
      const restored = structuredClone({ racks: baselineRacks, importedModels: baselineModels, nodes: baselineNodes });
      set({
        racks: restored.racks,
        importedModels: restored.importedModels,
        nodes: restored.nodes,
        undoStack: [],
        redoStack: [],
        showUnsavedDialog: false,
        pendingAction: null,
        _importDirty: false,
      });

      // If we are discarding while in a node, ensure layouts map is also refreshed if it was used as runtime cache
      if (activeNodeId) {
        // state.racks/importedModels는 이미 위 set()에서 restored 값으로 업데이트됨
        set((state) => ({
          layouts: {
            ...state.layouts,
            [activeNodeId]: {
              racks: state.racks,
              importedModels: state.importedModels,
            },
          },
        }));
      }
    } else {
      set({
        undoStack: [],
        redoStack: [],
        showUnsavedDialog: false,
        pendingAction: null,
        _importDirty: false,
      });
    }

    if (pendingAction) {
      if (pendingAction.type === "node") {
        const targetNodeId = pendingAction.value;
        get().expandNodePath(targetNodeId);
        const currentLayouts = get().layouts;
        const newNodeLayout = targetNodeId
          ? currentLayouts[targetNodeId] || { racks: [], importedModels: [] }
          : { racks: [], importedModels: [] };

        // Phase 3-A: 단일 structuredClone으로 discard 후 새 노드 baseline 스냅샷
        const discardSnap = structuredClone({
          racks: newNodeLayout.racks,
          importedModels: newNodeLayout.importedModels,
          nodes: get().nodes,
        });
        set({
          activeNodeId: targetNodeId,
          racks: newNodeLayout.racks,
          importedModels: newNodeLayout.importedModels,
          baselineRacks: discardSnap.racks,
          baselineModels: discardSnap.importedModels,
          baselineNodes: discardSnap.nodes,
          undoStack: [],
          redoStack: [],
          selectedRackId: null,
          focusedRackId: null,
          selectedDeviceId: null,
          isDragging: false,
          draggingRackId: null,
          dragPosition: null,
          dragOffset: null,
          draggingModelId: null,
          modelDragPosition: null,
          modelDragOffset: null,
          preFocusCameraState: null,
          triggerFitToScene: get().triggerFitToScene + 1,
        });
      } else if (pendingAction.type === "editMode") {
        get().setEditMode(pendingAction.value);
      }
    }
  },

  cancelConfirmation: () => {
    set({ showUnsavedDialog: false, pendingAction: null });
  },

  setCameraRef: (camera, controls) =>
    set({ _cameraRef: camera, _controlsRef: controls }),
  setHoveredRack: (id) => set({ hoveredRackId: id }),
  setActiveNode: (nodeId) => {
    const { isEditMode, getIsDirty, expandNodePath, layouts } = get();

    if (isEditMode && getIsDirty() && nodeId !== get().activeNodeId) {
      set({
        showUnsavedDialog: true,
        pendingAction: { type: "node", value: nodeId },
      });
      return;
    }

    expandNodePath(nodeId);

    // Switch Layout
    const newNodeLayout = nodeId
      ? layouts[nodeId] || { racks: [], importedModels: [] }
      : { racks: [], importedModels: [] };

    set({
      activeNodeId: nodeId,
      racks: newNodeLayout.racks,
      importedModels: newNodeLayout.importedModels,
      // If in edit mode, the new node's layout becomes the new baseline for dirty checks
      // Phase 3-A: isEditMode 시 단일 structuredClone으로 통합
      ...(isEditMode
        ? (() => {
            const snap = structuredClone({
              racks: newNodeLayout.racks,
              importedModels: newNodeLayout.importedModels,
              nodes: get().nodes,
            });
            return {
              baselineRacks: snap.racks,
              baselineModels: snap.importedModels,
              baselineNodes: snap.nodes,
            };
          })()
        : {
            baselineRacks: get().baselineRacks,
            baselineModels: get().baselineModels,
            baselineNodes: get().baselineNodes,
          }),

      undoStack: [], // Clear undo stack on node switch to prevent mixing node states
      redoStack: [], // Clear redo stack on node switch
      selectedRackId: null,
      focusedRackId: null,
      selectedDeviceId: null,
      isDragging: false,
      draggingRackId: null,
      dragPosition: null,
      dragOffset: null,
      draggingModelId: null,
      modelDragPosition: null,
      modelDragOffset: null,
      preFocusCameraState: null,
      triggerFitToScene: get().triggerFitToScene + 1,
    });
  },
  setImportExportModalRackId: (id) => set({ importExportModalRackId: id }),
  setDeviceRegistrationModalOpen: (open) =>
    set({ deviceRegistrationModalOpen: open }),
  setHighlightedDevice: (id, duration) => {
    const { blinkTimeoutId } = get();
    if (blinkTimeoutId) {
      window.clearTimeout(blinkTimeoutId);
    }

    set({ highlightedDeviceId: id, blinkTimeoutId: null });

    if (id && duration) {
      const timeoutId = window.setTimeout(() => {
        if (get().highlightedDeviceId === id) {
          set({ highlightedDeviceId: null, blinkTimeoutId: null });
        }
      }, duration);
      set({ blinkTimeoutId: timeoutId as unknown as number });
    }
  },

  locateDevice: (registeredDeviceId) => {
    const {
      layouts,
      setActiveNode,
      selectRack,
      focusRack,
      setHighlightedDevice,
    } = get();

    let foundNodeId: string | null = null;
    let foundRackId: string | null = null;
    let foundDeviceId: string | null = null;

    // Global search across all node layouts
    for (const [nodeId, layout] of Object.entries(layouts)) {
      if (!layout.racks) continue;
      for (const rack of layout.racks) {
        const placed = rack.devices.find(
          (d) => d.deviceId === registeredDeviceId,
        );
        if (placed) {
          foundNodeId = nodeId;
          foundRackId = rack.rackId;
          foundDeviceId = placed.itemId; // Use itemId for 3D highlight matching
          break;
        }
      }
      if (foundNodeId) break;
    }

    if (foundNodeId && foundRackId && foundDeviceId) {
      // 1. Switch Node if needed
      if (get().activeNodeId !== foundNodeId) {
        setActiveNode(foundNodeId);
      }

      // 2. Select and Focus Rack
      selectRack(foundRackId);
      focusRack(foundRackId);

      // 3. Highlight Device
      setHighlightedDevice(foundDeviceId, 2500);

      return true;
    }

    return false;
  },
  setShowEquipmentInTree: (show) => set({ showEquipmentInTree: show }),

  addRegisteredDevice: (deviceData) => {
    // Generate current timestamp in 'YYYY-MM-DD HH:mm:ss' format
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().replace('T', ' ').substring(0, 19);

    const newDevice: RegisteredDevice = {
      ...deviceData,
      regDate: deviceData.regDate || localISOTime,
      deviceId: crypto.randomUUID(),
    };
    set((state) => ({
      registeredDevices: [...state.registeredDevices, newDevice],
    }));
  },

  updateRegisteredDevice: (id: string, updates: Partial<RegisteredDevice> & { generatedPorts?: GeneratedPort[] }) => {
    // Generate current timestamp in 'YYYY-MM-DD HH:mm:ss' format
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().replace('T', ' ').substring(0, 19);

    set((state) => {
      const updatedRegDevices = state.registeredDevices.map((d) =>
        d.deviceId === id ? { ...d, ...updates, modiDate: localISOTime } : d,
      );

      // Phase 4: 해당 device가 없는 rack은 참조 유지 (불필요한 복사 방지)
      let racksChanged = false;
      const updatedRacks = state.racks.map((rack) => {
        const hasTarget = rack.devices.some(d => d.deviceId === id);
        if (!hasTarget) return rack; // 원래 참조 유지
        racksChanged = true;
        return {
          ...rack,
          devices: rack.devices.map((device) => {
            if (device.deviceId === id) {
              return {
                ...device,
                title: updates.title ?? device.title,
                IPAddr: updates.IPAddr ?? device.IPAddr,
                macAddr: updates.macAddr ?? device.macAddr,
                vendor: updates.vendor ?? device.vendor,
                modelName: updates.modelName ?? device.modelName,
                size: updates.size ?? device.size,
                insertedCards: updates.insertedCards !== undefined ? updates.insertedCards : device.insertedCards,
                insertedModules: updates.insertedModules !== undefined ? updates.insertedModules : device.insertedModules,
                dashboardThumbnailUrl: updates.dashboardThumbnailUrl !== undefined ? updates.dashboardThumbnailUrl : device.dashboardThumbnailUrl,
                portStates: updates.generatedPorts 
                  ? updates.generatedPorts.map(gp => {
                      const ex = device.portStates.find(p => p.portId === gp.realPortNumber);
                      if (ex) return { ...ex, portName: gp.portType, portNumber: gp.realPortNumber };
                      return { portId: gp.realPortNumber, portNumber: gp.realPortNumber, portName: gp.portType, status: "normal" } as PortState;
                    })
                  : device.portStates,
              };
            }
            return device;
          }),
        };
      });

      return {
        registeredDevices: updatedRegDevices,
        racks: racksChanged ? updatedRacks : state.racks,
        layouts: state.activeNodeId && racksChanged
          ? {
              ...state.layouts,
              [state.activeNodeId]: {
                ...state.layouts[state.activeNodeId],
                racks: updatedRacks,
              },
            }
          : state.layouts,
      };
    });
  },

  removeRegisteredDevice: (id) => {
    set((state) => {
      const updatedRacks = state.racks.map((rack) => ({
        ...rack,
        devices: rack.devices.filter((d) => d.deviceId !== id),
      }));
      return {
        registeredDevices: state.registeredDevices.filter(
          (d) => d.deviceId !== id,
        ),
        racks: updatedRacks,
        layouts: state.activeNodeId
          ? {
              ...state.layouts,
              [state.activeNodeId]: {
                ...state.layouts[state.activeNodeId],
                racks: updatedRacks,
              },
            }
          : state.layouts,
      };
    });
  },

  upsertRegisteredDevices: (devices) => {
    let added = 0;
    let updated = 0;

    set((state) => {
      const existing = [...state.registeredDevices];
      devices.forEach((newDev) => {
        // Identity Matching Rule (Strictly Node-Scoped):
        // 1. Same Node + Same MAC (Strong match)
        // 2. Same Node + Same Name + Same IP (Secondary match for attribute updates)
        const matchIdx = existing.findIndex(
          (ex) =>
            ex.deviceGroupId === newDev.deviceGroupId &&
            (ex.macAddr === newDev.macAddr ||
              (ex.title === newDev.title && ex.IPAddr === newDev.IPAddr)),
        );

        if (matchIdx >= 0) {
          existing[matchIdx] = { ...existing[matchIdx], ...newDev };
          updated++;
        } else {
          existing.push({ ...newDev, deviceId: crypto.randomUUID() });
          added++;
        }
      });
      return { registeredDevices: existing };
    });

    return { added, updated };
  },

  addRack: (rackSize, position, width = RACK_WIDTH_STANDARD) => {
    const { racks, isEditMode, _cameraRef, pushUndoState } = get();

    if (isEditMode) {
      pushUndoState();
    }

    let spawnPos: [number, number];
    if (position) {
      spawnPos = position;
    } else if (_cameraRef) {
      const raycaster = new Raycaster();
      const center = new Vector2(0, 0);
      raycaster.setFromCamera(center, _cameraRef);
      const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
      const hitPoint = new Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const gridX = Math.round((hitPoint.x / GRID_SPACING) * 15) / 15;
        const gridZ = Math.round((hitPoint.z / GRID_SPACING) * 15) / 15;
        spawnPos = [gridX, gridZ];
      } else {
        const dir = new Vector3();
        _cameraRef.getWorldDirection(dir);
        const fallback = _cameraRef.position.clone().add(dir.multiplyScalar(5));
        const gridX = Math.round((fallback.x / GRID_SPACING) * 15) / 15;
        const gridZ = Math.round((fallback.z / GRID_SPACING) * 15) / 15;
        spawnPos = [gridX, gridZ];
      }
    } else {
      spawnPos = [0, 0];
    }

    const { activeNodeId } = get();
    if (!activeNodeId) {
      get().showToast("노드를 먼저 선택하거나 생성해주세요.", "error");
      return;
    }
    const nodeRacks = racks.filter((r) => r.mapId === activeNodeId);

    let finalPos = spawnPos;
    if (checkCollision(nodeRacks, null, spawnPos, width)) {
      // 기존 랙들의 실제 크기를 기반으로 정확히 옆에 붙는 후보 위치를 생성
      const newDims = getEffectiveDimensions(width, 180);
      const candidates: [number, number][] = [];

      for (const other of nodeRacks) {
        const otherDims = getEffectiveDimensions(
          other.width,
          other.orientation ?? 180,
        );
        const ox = other.position[0] * GRID_SPACING;
        const oz = other.position[1] * GRID_SPACING;

        const halfSumX = (otherDims.effectiveWidth + newDims.effectiveWidth) / 2;
        const halfSumZ = (otherDims.effectiveDepth + newDims.effectiveDepth) / 2;
        const GAP = 0.01; // 최소 이격 거리

        // 좌/우/앞/뒤로 딱 붙는 후보들
        candidates.push(
          [(ox + halfSumX + GAP) / GRID_SPACING, other.position[1]],
          [(ox - halfSumX - GAP) / GRID_SPACING, other.position[1]],
          [other.position[0], (oz + halfSumZ + GAP) / GRID_SPACING],
          [other.position[0], (oz - halfSumZ - GAP) / GRID_SPACING],
        );
      }

      // 스폰 위치에서 가장 가까운 후보부터 탐색
      candidates.sort((a, b) => {
        const da =
          Math.abs(a[0] - spawnPos[0]) + Math.abs(a[1] - spawnPos[1]);
        const db =
          Math.abs(b[0] - spawnPos[0]) + Math.abs(b[1] - spawnPos[1]);
        return da - db;
      });

      let found = false;
      for (const candidate of candidates) {
        if (!checkCollision(nodeRacks, null, candidate, width)) {
          finalPos = candidate;
          found = true;
          break;
        }
      }

      // 후보 탐색 실패 시 기존 그리드 탐색 fallback
      if (!found) {
        for (let radius = 1; radius <= 20 && !found; radius++) {
          for (const dx of [-radius, 0, radius]) {
            for (const dz of [-radius, 0, radius]) {
              if (dx === 0 && dz === 0) continue;
              const candidate: [number, number] = [
                spawnPos[0] + (dx * width) / GRID_SPACING,
                spawnPos[1] + (dz * (newDims.effectiveDepth + 0.02)) / GRID_SPACING,
              ];
              if (!checkCollision(nodeRacks, null, candidate, width)) {
                finalPos = candidate;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      }
    }

    const newRack: Rack = {
      rackId: crypto.randomUUID(),
      mapId: activeNodeId!,
      rackSize,
      width,
      position: finalPos,
      orientation: 180,
      devices: [],
    };

    if (isEditMode) {
      set((state) => ({
        racks: [...state.racks, newRack],
        selectedRackId: newRack.rackId,
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                racks: [...state.racks, newRack],
              },
            }
          : state.layouts,
      }));
    } else {
      set((state) => ({
        racks: [...state.racks, newRack],
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                racks: [...state.racks, newRack],
              },
            }
          : state.layouts,
      }));
    }
  },

  moveRack: (id, newPosition) => {
    const { racks, showToast } = get();
    const rack = racks.find((r) => r.rackId === id);
    if (!rack) return false;

    const nodeRacks = racks.filter((r) => r.mapId === rack.mapId);

    if (
      checkCollision(nodeRacks, id, newPosition, rack.width, rack.orientation)
    ) {
      showToast("겹치는 위치에는 렉을 배치할 수 없습니다.", "error");
      return false;
    }

    const updatedRacks = racks.map((r) =>
      r.rackId === id ? { ...r, position: newPosition } : r,
    );
    set((state) => ({
      racks: updatedRacks,
      layouts: rack.mapId
        ? {
            ...state.layouts,
            [rack.mapId]: { ...state.layouts[rack.mapId], racks: updatedRacks },
          }
        : state.layouts,
    }));
    return true;
  },

  deleteRack: (id) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedRacks = state.racks.filter((r) => r.rackId !== id);
      const rackToDelete = state.racks.find((r) => r.rackId === id);
      const nid = rackToDelete?.mapId;

      return {
        racks: updatedRacks,
        selectedRackId:
          state.selectedRackId === id ? null : state.selectedRackId,
        focusedRackId: state.focusedRackId === id ? null : state.focusedRackId,
        layouts: nid
          ? {
              ...state.layouts,
              [nid]: { ...state.layouts[nid], racks: updatedRacks },
            }
          : state.layouts,
      };
    });
  },

  selectRack: (id) => {
    const state = get();
    if (state.isDragging && state.draggingRackId && state.dragPosition) {
      const gridX =
        Math.round((state.dragPosition[0] / GRID_SPACING) * 15) / 15;
      const gridZ =
        Math.round((state.dragPosition[1] / GRID_SPACING) * 15) / 15;
      state.endDrag(state.draggingRackId, [gridX, gridZ]);
    } else if (state.isDragging) {
      set({
        isDragging: false,
        draggingRackId: null,
        dragPosition: null,
        dragOffset: null,
      });
    }

    if (id && id === state.selectedRackId && state.focusedRackId) {
      return;
    }

    set({
      selectedRackId: id,
      focusedRackId: null,
      selectedDeviceId: null,
      selectedModelId: id ? null : state.selectedModelId,
    });
  },
  selectDevice: (id, portId = null) =>
    set({ selectedDeviceId: id, highlightedPortId: portId }),
  focusRack: (id) => {
    const { _cameraRef, _controlsRef, preFocusCameraState } = get();

    // Capture state if starting focus and no state is saved yet
    if (id && !preFocusCameraState && _cameraRef && _controlsRef) {
      const pos = _cameraRef.position;
      const target = (_controlsRef as any).target;
      set({
        preFocusCameraState: {
          position: [pos.x, pos.y, pos.z],
          target: [target.x, target.y, target.z],
          zoom: (_cameraRef as any).zoom ?? 1,
        },
      });
    }

    set({ focusedRackId: id });
  },
  setPreFocusCameraState: (state) => set({ preFocusCameraState: state }),
  setDragging: (isDragging, rackId = null, offset = null) =>
    set({
      isDragging,
      draggingRackId: isDragging ? rackId : null,
      dragOffset: offset,
    }),
  updateDragPosition: (pos) => set({ dragPosition: pos }),

  endDrag: (id, newPosition) => {
    const { racks, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.rackId === id);
    if (!rack) return false;

    let finalPosition = [...newPosition] as [number, number];
    
    // Deadzone check for accidental micro-movements on click
    const distMoved = Math.sqrt(
      Math.pow(newPosition[0] - rack.position[0], 2) +
      Math.pow(newPosition[1] - rack.position[1], 2)
    );

    const nodeRacks = racks.filter((r) => r.mapId === rack.mapId);

    if (distMoved < 0.05) {
      finalPosition = [...rack.position];
    } else {
      const SNAP_THRESHOLD = 0.5;
      const worldX = newPosition[0] * GRID_SPACING;

      let xSnapped = false;
      for (const other of nodeRacks) {
        if (other.rackId === id) continue;
        // ── X축 스냅 (좌우로 나란히 붙이기): 같은 Z 행 ──
        if (Math.abs(other.position[1] - newPosition[1]) <= 0.1) {
          const otherWorldX = other.position[0] * GRID_SPACING;
          const gap =
            Math.abs(worldX - otherWorldX) - (rack.width + other.width) / 2;

          if (gap >= -0.1 && gap < SNAP_THRESHOLD) {
            const direction = worldX > otherWorldX ? 1 : -1;
            const snappedWorldX =
              otherWorldX + (direction * (other.width + rack.width)) / 2;
            finalPosition[0] = snappedWorldX / GRID_SPACING;
            finalPosition[1] = other.position[1]; // 완벽한 전후 정렬 (Align Z-axis)
            xSnapped = true;
            break;
          }
        }
      }

      // ── Z축 스냅 (앞뒤로 붙이기 / back-to-back): 같은 X 열 ──
      if (!xSnapped) {
        const worldZ = newPosition[1] * GRID_SPACING;
        const RACK_D = 1.0; // RACK_DEPTH 상수와 동일

        for (const other of nodeRacks) {
          if (other.rackId === id) continue;
          const otherWorldX = other.position[0] * GRID_SPACING;
          // 같은 X 열: X 거리가 두 랙 폭 절반의 합 이내
          if (
            Math.abs(worldX - otherWorldX) >
            (rack.width + other.width) / 2 + 0.1
          )
            continue;

          const otherWorldZ = other.position[1] * GRID_SPACING;
          const zGap =
            Math.abs(worldZ - otherWorldZ) - (RACK_D + RACK_D) / 2;

          if (zGap >= -0.1 && zGap < SNAP_THRESHOLD) {
            const direction = worldZ > otherWorldZ ? 1 : -1;
            const snappedWorldZ =
              otherWorldZ + (direction * (RACK_D + RACK_D)) / 2;
            finalPosition[1] = snappedWorldZ / GRID_SPACING;
            finalPosition[0] = other.position[0]; // 완벽한 좌우 정렬 (Align X-axis)
            break;
          }
        }
      }
    }


    const colliding = checkCollision(
      nodeRacks,
      id,
      finalPosition,
      rack.width,
      rack.orientation,
    );
    const frontClearanceViolation = checkFrontClearanceViolation(
      nodeRacks,
      id,
      finalPosition,
      rack.orientation,
      rack.width,
    );

    if (colliding || frontClearanceViolation) {
      if (colliding) {
        get().showToast("다른 렉과 겹쳐서 배치할 수 없습니다.", "error");
      } else {
        get().showToast("앞쪽 유지보수 공간이 부족합니다.", "error");
      }
      set({
        isDragging: false,
        draggingRackId: null,
        dragPosition: null,
        dragOffset: null,
      });
      return false;
    }

    const hasMoved = !layoutsEqual(rack.position, finalPosition);

    if (hasMoved && isEditMode) {
      pushUndoState();
    }

    const newRacks = hasMoved
      ? racks.map((r) =>
          r.rackId === id ? { ...r, position: finalPosition } : r,
        )
      : racks;

    set({
      racks: newRacks,
      isDragging: false,
      draggingRackId: null,
      dragPosition: null,
      dragOffset: null,
    });
    return true;
  },

  updateRackOrientation: (id, orientation) => {
    const { racks, showToast, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.rackId === id);
    if (!rack) return;

    if (rack.orientation === orientation) return;

    if (isEditMode) pushUndoState();

    const nodeRacks = racks.filter((r) => r.mapId === rack.mapId);

    const frontClearanceViolation = checkFrontClearanceViolation(
      nodeRacks,
      id,
      rack.position,
      orientation,
      rack.width,
    );

    if (frontClearanceViolation) {
      showToast("해당 방향은 앞쪽 유지보수 공간이 부족합니다.", "error");
      return;
    }

    set((state) => {
      const updatedRacks = state.racks.map((r) =>
        r.rackId === id ? { ...r, orientation } : r,
      );
      return {
        racks: updatedRacks,
        layouts: rack.mapId
          ? {
              ...state.layouts,
              [rack.mapId]: {
                ...state.layouts[rack.mapId],
                racks: updatedRacks,
              },
            }
          : state.layouts,
      };
    });
  },

  setEditMode: (enabled) => {
    const {
      isDragging,
      draggingRackId,
      dragPosition,
      endDrag,
      getIsDirty,
      racks,
      importedModels,
    } = get();

    if (enabled) {
      // Entering Edit Mode: Snapshot current state as baseline
      // Phase 3-A: 단일 structuredClone으로 통합
      const editSnap = structuredClone({ racks, importedModels, nodes: get().nodes });
      set({
        baselineRacks: editSnap.racks,
        baselineModels: editSnap.importedModels,
        baselineNodes: editSnap.nodes,
        undoStack: [],
        redoStack: [],
        isEditMode: true,
      });
      return;
    }

    // Exiting Edit Mode
    if (getIsDirty()) {
      set({
        showUnsavedDialog: true,
        pendingAction: { type: "editMode", value: false },
      });
      return;
    }

    if (isDragging && draggingRackId && dragPosition) {
      const gridX = Math.round((dragPosition[0] / GRID_SPACING) * 15) / 15;
      const gridZ = Math.round((dragPosition[1] / GRID_SPACING) * 15) / 15;
      endDrag(draggingRackId, [gridX, gridZ]);
    }

    set({
      isEditMode: false,
      baselineRacks: null,
      baselineModels: null,
      undoStack: [],
      redoStack: [],
    });
  },

  addDevice: (rackId, deviceData) => {
    const { racks, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.rackId === rackId);
    if (!rack) return false;

    if (isEditMode) pushUndoState();

    if (
      deviceData.position < 1 ||
      deviceData.position + deviceData.size - 1 > rack.rackSize
    ) {
      return false;
    }

    const collision = rack.devices.some((d) => {
      const dStart = d.position;
      const dEnd = d.position + d.size - 1;
      const newStart = deviceData.position;
      const newEnd = deviceData.position + deviceData.size - 1;
      return dStart <= newEnd && dEnd >= newStart;
    });

    if (collision) {
      return false;
    }

    // Single-mount enforcement: block if already mounted anywhere in all layouts
    if (deviceData.deviceId) {
      const alreadyMounted = get().findExistingMount(deviceData.deviceId);
      if (alreadyMounted && alreadyMounted.rackId !== rackId) {
        // Caller must handle remount flow; store blocks silently
        return false;
      }
    }

    const newDevice: Device = {
      ...deviceData,
      itemId: crypto.randomUUID(),
      portStates: deviceData.portStates || [],
      insertedCards: deviceData.insertedCards,
      insertedModules: deviceData.insertedModules,
      dashboardThumbnailUrl: deviceData.dashboardThumbnailUrl,
    };

    const updatedRacks = racks.map((r) =>
      r.rackId === rackId ? { ...r, devices: [...r.devices, newDevice] } : r,
    );
    set((state) => ({
      racks: updatedRacks,
      layouts: rack.mapId
        ? {
            ...state.layouts,
            [rack.mapId]: { ...state.layouts[rack.mapId], racks: updatedRacks },
          }
        : state.layouts,
    }));
    return true;
  },

  findExistingMount: (registeredDeviceId) => {
    const { racks, layouts } = get();
    // Search active racks (current node)
    for (const rack of racks) {
      const found = rack.devices.find((d) => d.deviceId === registeredDeviceId);
      if (found) {
        return {
          rackId: rack.rackId,
          nodeId: rack.mapId,
          deviceId: found.deviceId || "",
          rackName:
            rack.rackTitle || `Rack-${rack.rackId.slice(0, 4).toUpperCase()}`,
        };
      }
    }
    // Search all layouts (other nodes)
    for (const [nodeId, layout] of Object.entries(layouts)) {
      if (!layout.racks) continue;
      for (const rack of layout.racks) {
        const found = rack.devices.find(
          (d) => d.deviceId === registeredDeviceId,
        );
        if (found) {
          return {
            rackId: rack.rackId,
            nodeId,
            deviceId: found.deviceId || "",
            rackName:
              rack.rackTitle || `Rack-${rack.rackId.slice(0, 4).toUpperCase()}`,
          };
        }
      }
    }
    return null;
  },

  removeDevice: (rackId, targetId) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      // Helper to remove device from a rack list
      const updateRacksList = (rList: Rack[]) =>
        rList.map((r) =>
          r.rackId === rackId
            ? {
                ...r,
                devices: r.devices.filter(
                  (d) => d.deviceId !== targetId && d.itemId !== targetId,
                ),
              }
            : r,
        );

      // Update current active racks
      const updatedRacks = updateRacksList(state.racks);

      // Update all layouts to ensure data integrity
      const updatedLayouts = { ...state.layouts };
      for (const [nid, layout] of Object.entries(updatedLayouts)) {
        if (layout.racks?.some((r) => r.rackId === rackId)) {
          updatedLayouts[nid] = {
            ...layout,
            racks: updateRacksList(layout.racks),
          };
          // Note: multiple layouts shouldn't have the same rackId, but we update all just in case
        }
      }

      return {
        racks: updatedRacks,
        layouts: updatedLayouts,
      };
    });
  },

  updateRack: (id, updates) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedRacks = state.racks.map((r) =>
        r.rackId === id ? { ...r, ...updates } : r,
      );
      const rack = state.racks.find((r) => r.rackId === id);
      const nid = rack?.mapId;

      return {
        racks: updatedRacks,
        layouts: nid
          ? {
              ...state.layouts,
              [nid]: { ...state.layouts[nid], racks: updatedRacks },
            }
          : state.layouts,
      };
    });
  },

  loadState: (newRacks, newModels, newRegisteredDevices, newNodes) => {
    // Migration: groupName → nodeId
    const migratedRacks = newRacks.map((r) => ({
      ...r,
      nodeId:
        r.mapId || migrateGroupNameToNodeId((r as any).groupName || "과천"),
    }));
    const migratedRegDevices = (newRegisteredDevices ?? []).map((d) => ({
      ...d,
      nodeId:
        d.deviceGroupId ||
        migrateGroupNameToNodeId((d as any).groupName || "과천"),
    }));
    const finalNodes = newNodes && newNodes.length > 0 ? newNodes : [];
    const rootNode = finalNodes.find((n) => n.parentId === null);

    const expandedNodeIds = new Set<string>();
    if (rootNode) expandedNodeIds.add(rootNode.nodeId);

    const activeNodeId = rootNode
      ? rootNode.nodeId
      : finalNodes.length > 0
        ? finalNodes[0].nodeId
        : null;

    // Group racks and models by nodeId
    const layouts: Record<
      string,
      { racks: Rack[]; importedModels: ImportedModel[] }
    > = {};

    migratedRacks.forEach((r) => {
      if (!layouts[r.mapId])
        layouts[r.mapId] = { racks: [], importedModels: [] };
      layouts[r.mapId].racks.push(r);
    });

    (newModels ?? []).forEach((m) => {
      // If model doesn't have nodeId, we might need a default or use active one.
      // For now assume they have them or assign to active if missing
      const nid = (m as any).nodeId || activeNodeId;
      if (nid) {
        if (!layouts[nid]) layouts[nid] = { racks: [], importedModels: [] };
        layouts[nid].importedModels.push(m);
      }
    });

    const activeLayout = activeNodeId
      ? layouts[activeNodeId] || { racks: [], importedModels: [] }
      : { racks: [], importedModels: [] };

    set((state) => ({
      layouts,
      racks: activeLayout.racks,
      importedModels: activeLayout.importedModels,
      registeredDevices: migratedRegDevices,
      nodes: finalNodes,
      activeNodeId,
      expandedNodeIds,
      selectedRackId: null,
      focusedRackId: null,
      selectedModelId: null,
      // Set baselines to pre-load state so dirty detection works
      // Phase 3-A: 단일 structuredClone으로 통합
      ...(() => { const s = structuredClone({ r: state.racks, m: state.importedModels, n: state.nodes }); return { baselineRacks: s.r, baselineModels: s.m, baselineNodes: s.n }; })(),
      _importDirty: true,
      triggerFitToScene: state.triggerFitToScene + 1,
    }));
  },

  replaceNodeData: (nodeId, newRacks, newRegisteredDevices) => {
    set((state) => {
      if (nodeId === "ALL") {
        // Handle ALL - ideally we should group newRacks by nodeId
        const newLayouts: Record<
          string,
          { racks: Rack[]; importedModels: ImportedModel[] }
        > = {};
        newRacks.forEach((r) => {
          if (!newLayouts[r.mapId])
            newLayouts[r.mapId] = { racks: [], importedModels: [] };
          newLayouts[r.mapId].racks.push(r);
        });

        const activeLayout = state.activeNodeId
          ? newLayouts[state.activeNodeId] || { racks: [], importedModels: [] }
          : { racks: [], importedModels: [] };

        return {
          layouts: newLayouts,
          racks: activeLayout.racks,
          importedModels: activeLayout.importedModels,
          registeredDevices: newRegisteredDevices || [],
          selectedRackId: null,
          focusedRackId: null,
          selectedDeviceId: null,
        };
      }

      const otherRegDevices = state.registeredDevices.filter(
        (d) => d.deviceGroupId !== nodeId,
      );

      const updatedLayouts = {
        ...state.layouts,
        [nodeId]: {
          racks: newRacks,
          importedModels: state.layouts[nodeId]?.importedModels || [],
        },
      };

      const isCurrentNode = state.activeNodeId === nodeId;

      return {
        layouts: updatedLayouts,
        racks: isCurrentNode ? newRacks : state.racks,
        registeredDevices: newRegisteredDevices
          ? [...otherRegDevices, ...newRegisteredDevices]
          : state.registeredDevices,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
      };
    });
  },

  updateDevicePortStates: (deviceId, newPortStates) =>
    set((state) => {
      let updated = false;
      const newRacks = state.racks.map((rack) => {
        const hasDevice = rack.devices.some((d) => d.itemId === deviceId);
        if (!hasDevice) return rack;

        updated = true;
        return {
          ...rack,
          devices: rack.devices.map((d) =>
            d.itemId === deviceId ? { ...d, portStates: newPortStates } : d,
          ),
        };
      });

      // Update layouts as well to ensure data consistency across nodes
      const newLayouts = { ...state.layouts };
      let anyLayoutUpdated = false;
      Object.entries(newLayouts).forEach(([nid, layout]) => {
        if (!layout.racks) return;
        let layoutUpdated = false;
        const layoutRacks = layout.racks.map((rack) => {
          const hasDevice = rack.devices.some((d) => d.itemId === deviceId);
          if (!hasDevice) return rack;
          layoutUpdated = true;
          updated = true;
          return {
            ...rack,
            devices: rack.devices.map((d) =>
              d.itemId === deviceId ? { ...d, portStates: newPortStates } : d,
            ),
          };
        });
        if (layoutUpdated) {
          newLayouts[nid] = { ...layout, racks: layoutRacks };
          anyLayoutUpdated = true;
        }
      });

      if (!updated) return state;
      
      // Update baselineRacks to prevent these system enrichment updates 
      // from flagging the workspace as 'dirty' (unsaved changes).
      const newBaselineRacks = state.baselineRacks ? state.baselineRacks.map((rack) => {
        const hasDevice = rack.devices.some((d) => d.itemId === deviceId);
        if (!hasDevice) return rack;
        return {
          ...rack,
          devices: rack.devices.map((d) =>
            d.itemId === deviceId ? { ...d, portStates: newPortStates } : d,
          ),
        };
      }) : state.baselineRacks;

      return { 
        racks: newRacks, 
        layouts: anyLayoutUpdated ? newLayouts : state.layouts,
        baselineRacks: newBaselineRacks
      };
    }),

  replaceMultipleNodesData: (data) => {
    set((state) => {
      let updatedRegDevices = [...state.registeredDevices];
      let updatedLayouts = { ...state.layouts };

      // Capture pre-import state for baseline (so getIsDirty detects changes)
      // Phase 3-A: 단일 structuredClone으로 통합
      const preImport = structuredClone({ racks: state.racks, importedModels: state.importedModels, nodes: state.nodes });
      const preImportRacks = preImport.racks;
      const preImportModels = preImport.importedModels;
      const preImportNodes = preImport.nodes;

      Object.entries(data).forEach(([nodeId, nodeData]) => {
        updatedRegDevices = updatedRegDevices.filter(
          (d) => d.deviceGroupId !== nodeId,
        );
        updatedRegDevices.push(...nodeData.registeredDevices);

        updatedLayouts[nodeId] = {
          racks: nodeData.racks,
          importedModels: updatedLayouts[nodeId]?.importedModels || [],
        };
      });

      const activeLayout = state.activeNodeId
        ? updatedLayouts[state.activeNodeId] || {
            racks: [],
            importedModels: [],
          }
        : { racks: [], importedModels: [] };

      return {
        layouts: updatedLayouts,
        racks: activeLayout.racks,
        importedModels: activeLayout.importedModels,
        registeredDevices: updatedRegDevices,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
        // Set baseline to pre-import state so changes are detectable
        baselineRacks: preImportRacks,
        baselineModels: preImportModels,
        baselineNodes: preImportNodes,
        _importDirty: true,
      };
    });
  },

  // Hierarchy Node Management
  addNode: (nodeData) => {
    const { isEditMode, pushUndoState, nodes } = get();
    if (isEditMode) pushUndoState();
    const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Auto-calculate order if not provided
    let finalOrder = nodeData.order;
    if (finalOrder === undefined) {
      const siblings = nodes.filter((n) => n.parentId === nodeData.parentId);
      finalOrder =
        siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    }

    const newNode: HierarchyNode = {
      ...nodeData,
      nodeId: newId,
      order: finalOrder,
    };

    set((state) => ({ nodes: [...state.nodes, newNode] }));

    return newId;
  },

  renameNode: (nodeId, name) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => ({
      nodes: state.nodes.map((n) => (n.nodeId === nodeId ? { ...n, name } : n)),
    }));
  },

  deleteNode: (nodeId) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      // 1. Delete node and descendant hierarchy structurally
      const toDelete = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        toDelete.add(curr);
        state.nodes.forEach((n) => {
          if (n.parentId === curr) queue.push(n.nodeId);
        });
      }

      // 2. But for data isolation, only clean data bound *exactly* to nodes being structurally deleted.
      const updatedLayouts = { ...state.layouts };
      toDelete.forEach((id) => delete updatedLayouts[id]);

      return {
        nodes: state.nodes.filter((n) => !toDelete.has(n.nodeId)),
        racks: state.racks.filter((r) => !toDelete.has(r.mapId)),
        registeredDevices: state.registeredDevices.filter(
          (d) => !toDelete.has(d.deviceGroupId || ""),
        ),
        layouts: updatedLayouts,
        activeNodeId:
          state.activeNodeId && toDelete.has(state.activeNodeId)
            ? state.nodes.find((n) => n.parentId === null)?.nodeId || null
            : state.activeNodeId,
      };
    });
  },

  setExpandedNodeIds: (ids) => set({ expandedNodeIds: ids }),
  toggleNodeExpansion: (nodeId, expand) => {
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      const shouldExpand = expand !== undefined ? expand : !next.has(nodeId);

      if (shouldExpand) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      return { expandedNodeIds: next };
    });
  },
  expandNodePath: (nodeId) => {
    if (!nodeId) return;
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      const { nodes } = state;
      let curr = nodes.find((n) => n.nodeId === nodeId);
      next.add(nodeId);
      while (curr && curr.parentId) {
        next.add(curr.parentId);
        curr = nodes.find((n) => n.nodeId === curr?.parentId);
      }
      return { expandedNodeIds: next };
    });
  },
  setHierarchyCollapsed: (collapsed) =>
    set({ isHierarchyCollapsed: collapsed }),

  reorderNode: (nodeId, targetNodeId, position) => {
    const { isEditMode, pushUndoState } = get();
    if (nodeId === targetNodeId) return;

    if (isEditMode) pushUndoState();

    set((state) => {
      const sourceNode = state.nodes.find((n) => n.nodeId === nodeId);
      const targetNode = state.nodes.find((n) => n.nodeId === targetNodeId);

      if (!sourceNode || !targetNode) return state;

      // Circularity check: node cannot be parent of its own ancestor
      const getDescendants = (id: string): string[] => {
        const children = state.nodes.filter((n) => n.parentId === id);
        return [id, ...children.flatMap((c) => getDescendants(c.nodeId))];
      };
      if (getDescendants(nodeId).includes(targetNodeId)) {
        return state;
      }

      let newParentId: string | null = null;
      let newOrder = 0;

      if (position === "inside") {
        newParentId = targetNodeId;
        const siblings = state.nodes.filter((n) => n.parentId === newParentId);
        newOrder =
          siblings.length > 0
            ? Math.max(...siblings.map((s) => s.order)) + 1
            : 0;
      } else {
        newParentId = targetNode.parentId;
        newOrder =
          position === "before" ? targetNode.order : targetNode.order + 1;
      }

      // Re-assign orders for all siblings
      const updatedNodes = state.nodes.map((n) => {
        if (n.nodeId === nodeId) {
          return { ...n, parentId: newParentId, order: newOrder };
        }

        // If moving within same parent or into new parent
        if (n.parentId === newParentId) {
          if (n.nodeId !== nodeId) {
            if (n.order >= newOrder) {
              return { ...n, order: n.order + 1 };
            }
          }
        }
        return n;
      });

      // Optional: normalization of orders to 0, 1, 2...
      const normalizeOrders = (nodes: HierarchyNode[], pId: string | null) => {
        const parentSiblings = nodes
          .filter((n) => n.parentId === pId)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

        parentSiblings.forEach((s, idx) => {
          const match = nodes.find((n) => n.nodeId === s.nodeId);
          if (match) match.order = idx;
        });
      };

      // Normalize for both old parent and new parent
      const finalNodes = [...updatedNodes];
      normalizeOrders(finalNodes, sourceNode.parentId);
      normalizeOrders(finalNodes, newParentId);

      return { nodes: finalNodes };
    });
  },

  upsertNodes: (newNodes, overwrite, dryRun = false) => {
    const mapping: Record<string, string> = {};
    const process = (stateNodes: HierarchyNode[]) => {
      const updatedNodes = [...stateNodes];

      newNodes.forEach((n) => {
        if (n.nodeId === NONE_NODE_ID) return;
        mapping[n.nodeId] = n.nodeId;
        const matchIdx = updatedNodes.findIndex((ex) => ex.nodeId === n.nodeId);
        if (matchIdx >= 0) {
          if (overwrite) {
            updatedNodes[matchIdx] = { ...updatedNodes[matchIdx], ...n };
          }
        } else {
          const duplicateIdx = updatedNodes.findIndex(
            (ex) => ex.parentId === n.parentId && ex.name === n.name,
          );
          if (duplicateIdx >= 0) {
            mapping[n.nodeId] = updatedNodes[duplicateIdx].nodeId;
            if (overwrite) {
              updatedNodes[duplicateIdx] = {
                ...updatedNodes[duplicateIdx],
                ...n,
                nodeId: updatedNodes[duplicateIdx].nodeId,
              };
            }
          } else {
            updatedNodes.push(n);
          }
        }
      });
      return updatedNodes;
    };

    const updatedNodes = process(get().nodes);
    if (!dryRun) {
      set({ nodes: updatedNodes });
    }
    return { mapping, updatedNodes };
  },

  // Imported Model Actions
  addImportedModel: (modelData) => {
    const { _cameraRef, isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    let spawnPos: [number, number, number] = modelData.position;

    if (
      spawnPos[0] === 0 &&
      spawnPos[1] === 0 &&
      spawnPos[2] === 0 &&
      _cameraRef
    ) {
      const raycaster = new Raycaster();
      const center = new Vector2(0, 0);
      raycaster.setFromCamera(center, _cameraRef);
      const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
      const hitPoint = new Vector3();

      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const gridX =
          (Math.round((hitPoint.x / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        const gridZ =
          (Math.round((hitPoint.z / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        spawnPos = [gridX, 0, gridZ];
      }
    }

    const newId = crypto.randomUUID();
    const activeNodeId = get().activeNodeId;
    const model: ImportedModel = {
      ...modelData,
      id: newId,
      position: spawnPos,
      isMoveEnabled: modelData.isMoveEnabled ?? false,
    };

    set((state) => {
      const updatedModels: ImportedModel[] = [...state.importedModels, model];
      return {
        importedModels: updatedModels,
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                importedModels: updatedModels,
              },
            }
          : state.layouts,
      };
    });
    return newId;
  },

  selectModel: (id) =>
    set({
      selectedModelId: id,
      selectedRackId: id ? null : undefined,
      focusedRackId: null,
      selectedDeviceId: null,
    }),

  deleteModel: (id) => {
    const { isEditMode, pushUndoState, activeNodeId } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedModels: ImportedModel[] = state.importedModels.filter(
        (m) => m.id !== id,
      );
      return {
        importedModels: updatedModels,
        selectedModelId:
          state.selectedModelId === id ? null : state.selectedModelId,
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                importedModels: updatedModels,
              },
            }
          : state.layouts,
      };
    });
  },

  updateModel: (id, updates) => {
    const { isEditMode, pushUndoState, activeNodeId } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedModels: ImportedModel[] = state.importedModels.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      );
      return {
        importedModels: updatedModels,
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                importedModels: updatedModels,
              },
            }
          : state.layouts,
      };
    });
  },

  setModelDragging: (modelId, pos = null, offset = null) =>
    set({
      draggingModelId: modelId,
      modelDragPosition: pos,
      modelDragOffset: offset,
    }),

  updateModelDragPosition: (pos) => set({ modelDragPosition: pos }),

  endModelDrag: (id, position) => {
    const { isEditMode, pushUndoState, activeNodeId, importedModels } = get();
    const model = importedModels.find((m) => m.id === id);
    if (!model) return;

    const finalPos: [number, number, number] = [
      position[0],
      model.position[1],
      position[1],
    ];
    const hasMoved = !layoutsEqual(model.position, finalPos);

    if (hasMoved && isEditMode) {
      pushUndoState();
    }

    set((state) => {
      const updatedModels: ImportedModel[] = hasMoved
        ? state.importedModels.map((m) =>
            m.id === id ? { ...m, position: finalPos } : m,
          )
        : state.importedModels;

      return {
        importedModels: updatedModels,
        draggingModelId: null,
        modelDragPosition: null,
        modelDragOffset: null,
        layouts: activeNodeId
          ? {
              ...state.layouts,
              [activeNodeId]: {
                ...(state.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                importedModels: updatedModels,
              },
            }
          : state.layouts,
      };
    });
  },

  toggleModelMove: (id) => {
    const state = get();
    const model = state.importedModels.find((m) => m.id === id);
    if (!model) return;

    const newEnabled = !model.isMoveEnabled;

    if (!newEnabled && state.draggingModelId === id) {
      set({
        draggingModelId: null,
        modelDragPosition: null,
        modelDragOffset: null,
      });
      document.body.style.cursor = "auto";
    }

    set((s) => {
      const updatedModels: ImportedModel[] = s.importedModels.map((m) =>
        m.id === id ? { ...m, isMoveEnabled: newEnabled } : m,
      );
      const activeNodeId = s.activeNodeId;
      return {
        importedModels: updatedModels,
        layouts: activeNodeId
          ? {
              ...s.layouts,
              [activeNodeId]: {
                ...(s.layouts[activeNodeId] || {
                  racks: [],
                  importedModels: [],
                }),
                importedModels: updatedModels,
              },
            }
          : s.layouts,
      };
    });
  },

  reparentNode: (nodeId, newParentId) => {
    const { nodes, isEditMode, pushUndoState } = get();

    // Safety Checks
    if (nodeId === newParentId) return;

    // Check if newParentId is a descendant of nodeId (to prevent circularity)
    // getSubtreeNodeIds already includes nodeId
    const subtreeIds = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      subtreeIds.add(curr);
      nodes.forEach((n) => {
        if (n.parentId === curr) stack.push(n.nodeId);
      });
    }

    if (newParentId && subtreeIds.has(newParentId)) {
      get().showToast("Cannot move a node under its own descendant.", "error");
      return;
    }

    if (isEditMode) pushUndoState();

    set((state) => {
      // Find new order: max(order of siblings) + 1
      const siblings = state.nodes.filter((n) => n.parentId === newParentId);
      const newOrder =
        siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;

      const updatedNodes = state.nodes.map((n) => {
        if (n.nodeId === nodeId) {
          return { ...n, parentId: newParentId, order: newOrder };
        }
        return n;
      });

      return { nodes: updatedNodes };
    });
  },
}),
    {
      name: "server-room-storage",
      partialize: (state) => {
        const {
          _cameraRef,
          _controlsRef,
          pendingImportFile,
          toast,
          blinkTimeoutId,
          isDragging,
          draggingRackId,
          dragPosition,
          dragOffset,
          draggingModelId,
          modelDragPosition,
          modelDragOffset,
          importExportModalRackId,
          deviceDeleteConfirm,
          deviceRegistrationModalOpen,
          undoStack,
          redoStack,
          showUnsavedDialog,
          pendingAction,
          triggerFitToScene,
          expandedNodeIds,
          ...rest
        } = state;
        return rest;
      },
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
