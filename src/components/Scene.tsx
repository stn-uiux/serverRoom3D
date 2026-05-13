import { Suspense, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  GizmoHelper,
  GizmoViewcube,
} from "@react-three/drei";
import { useStore } from "../store/useStore";
import { Rack } from "./Rack";
import { ImportedModelMesh } from "./ImportedModelMesh";
import { CameraController } from "./CameraController";
import { GRID_SPACING } from "./constants";
import { useTheme } from "../contexts/ThemeContext";
import { Plane, Vector3 } from 'three';

/** Syncs camera & controls refs into zustand store for viewport-center spawning */
const CameraRefSync = () => {
  const { camera, controls } = useThree();
  const setCameraRef = useStore((s) => s.setCameraRef);

  useEffect(() => {
    setCameraRef(camera, controls);
  }, [camera, controls, setCameraRef]);

  return null;
};

const DragHandler = () => {
  const isDragging = useStore((state) => state.isDragging);
  const draggingRackId = useStore((state) => state.draggingRackId);
  const updateDragPosition = useStore((state) => state.updateDragPosition);

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (isDragging && draggingRackId) {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        const { dragOffset } = useStore.getState();
        const offsetX = dragOffset ? dragOffset[0] : 0;
        const offsetZ = dragOffset ? dragOffset[1] : 0;

        // No grid snapping – use raw world coordinates for smooth movement
        updateDragPosition([tempPoint.x - offsetX, tempPoint.z - offsetZ]);
      }
    }
  });

  return null;
};

export const Scene = () => {
  const racks = useStore((state) => state.racks);
  const activeNodeId = useStore((state) => state.activeNodeId);
  const isDragging = useStore((state) => state.isDragging);
  const importedModels = useStore((state) => state.importedModels);
  const draggingModelId = useStore((state) => state.draggingModelId);
  const selectedRackId = useStore((state) => state.selectedRackId);
  const { theme } = useTheme();

  // Phase 2-C: useMemo로 감싸서 importedModels 변경 시에만 재계산
  const hasUserLight = useMemo(
    () => importedModels.some((m) => m.builtinType === "Light"),
    [importedModels],
  );

  // Strict one-node filtering: only racks placed exactly in this node
  const groupRacks = useMemo(
    () => racks.filter((r) => r.mapId === activeNodeId),
    [racks, activeNodeId],
  );

  // Theme-based colors
  const isDarkMode = theme === "dark";
  const backgroundColor = isDarkMode ? "#585d6e" : "#eef2f6"; // Dark mode background set to #585d6e
  const gridCellColor = isDarkMode ? "#6b7080" : "#ccc"; // Neutral/cool gray for dark mode grid cells
  const gridSectionColor = isDarkMode ? "#7d8292" : "#999"; // Neutral/cool gray for dark mode grid sections
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Global release handler using native window listener for 100% reliability
  useEffect(() => {
    const handleGlobalUp = () => {
      const state = useStore.getState();

      // Handle rack drag end
      if (state.isDragging) {
        const dragPos = state.dragPosition;
        const rackId = state.draggingRackId;

        if (rackId && dragPos) {
          // Convert raw world position to grid units (no rounding – free movement)
          const gridX = dragPos[0] / GRID_SPACING;
          const gridZ = dragPos[1] / GRID_SPACING;
          state.endDrag(rackId, [gridX, gridZ]);
        } else {
          state.setDragging(false, null);
          state.updateDragPosition(null);
        }
        document.body.style.cursor = "auto";
      }

      // Handle model drag end
      if (state.draggingModelId && state.modelDragPosition) {
        state.endModelDrag(state.draggingModelId, state.modelDragPosition);
        document.body.style.cursor = "auto";
      }
    };

    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, []);

  return (
    <Canvas
      shadows
      camera={{ position: [10, 10, 10], fov: 50 }}
      style={{ width: "100%", height: "100vh", background: backgroundColor }}
      onPointerDown={(e) => {
        if (useStore.getState().isGizmoHovered) return;
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMissed={(e) => {
        if (useStore.getState().isGizmoHovered) return;
        // Only clear focus on a "click" (minimal movement between down and up)
        if (pointerDownPos.current) {
          const dx = e.clientX - pointerDownPos.current.x;
          const dy = e.clientY - pointerDownPos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 5) {
            useStore.getState().selectRack(null);
            useStore.getState().selectModel(null);
          }
        }
        pointerDownPos.current = null;
      }}
    >
      <ambientLight intensity={isDarkMode ? 0.6 : 0.8} />
      {/* Only render default directional light if no user-placed Light model exists */}
      {!hasUserLight && (
        <directionalLight
          position={[10, 20, 5]}
          intensity={isDarkMode ? 1.2 : 1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
      )}
      <hemisphereLight
        intensity={isDarkMode ? 0.4 : 0.6}
        color="#ffffff"
        groundColor="#444444"
      />

      {!selectedRackId && (
        <GizmoHelper alignment="top-right" margin={[100, 140]}>
          <group 
            scale={1.4}
            onPointerOver={() => useStore.setState({ isGizmoHovered: true })}
            onPointerOut={() => useStore.setState({ isGizmoHovered: false })}
          >
            <GizmoViewcube
              opacity={1}
              color={isDarkMode ? "#2A3342" : "#D8DEE8"}
              textColor={isDarkMode ? "#ffffff" : "#111827"}
              strokeColor={isDarkMode ? "#9AA4B2" : "#5B6678"}
              hoverColor={isDarkMode ? "#3b82f6" : "#2563eb"}
            />
          </group>
        </GizmoHelper>
      )}

      <Suspense fallback={null}>
        <Environment preset={isDarkMode ? "night" : "city"} />

        {/* Visual Grid – offset slightly below y=0 to prevent z-fighting with model floors */}
        <Grid
          position={[0, -0.01, 0]}
          args={[40, 40]}
          cellSize={GRID_SPACING}
          cellColor={gridCellColor}
          sectionSize={GRID_SPACING * 5}
          sectionColor={gridSectionColor}
          fadeDistance={50}
          infiniteGrid
          followCamera={false}
        />

        {/* Racks (filtered by active group) */}
        {groupRacks.map((rack) => (
          <Rack
            key={rack.rackId}
            {...rack}
          />
        ))}

        {/* The Hidden Drag Engine */}
        <DragHandler />

        {/* Imported 3D Models */}
        {importedModels.map((model) => (
          <ImportedModelMesh key={model.id} model={model} />
        ))}
      </Suspense>

      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        enabled={!isDragging && !draggingModelId}
      />
      <CameraRefSync />
      <CameraController />
    </Canvas>
  );
};
