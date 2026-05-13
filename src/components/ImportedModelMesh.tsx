import { useEffect, useRef, useMemo, Suspense } from "react";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useGLTF, Html, Billboard, PivotControls } from "@react-three/drei";
import { Box3, Euler, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { useStore } from "../store/useStore";
import type { ImportedModel, LightParams } from "../types";
import {
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
  DEFAULT_LIGHT_PARAMS,
} from "../utils/builtinModels";
import { DigitalClock } from "./DigitalClock";
import { getNodeSensorData } from "./DashboardWidgets";
import { GltfErrorBoundary } from "./GltfErrorBoundary";

interface ImportedModelMeshProps {
  model: ImportedModel;
}
/* ------------------------------------------------------------------ */
/*  Wall mesh — procedural box with parametric dimensions              */
/* ------------------------------------------------------------------ */
const WallMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.wallParams ?? DEFAULT_WALL_PARAMS;
  return (
    <mesh position={[0, params.height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[params.length, params.height, params.thickness]} />
      <meshStandardMaterial
        color={params.color}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
};

/* ------------------------------------------------------------------ */
/*  Partition mesh — framed two-panel divider with base and feet       */
/* ------------------------------------------------------------------ */
const PartitionMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
  const isTransparent = params.visibilityMode === "transparent";

  const { height: H, length: L, thickness: T } = params;

  // Design constants
  const frameWidth = 0.04;
  const feetHeight = 0.04;
  const feetWidth = 0.08;
  const baseHeight = 0.22;
  const dividerHeight = 0.02;

  // Calculate inner panel area
  const innerStartH = feetHeight + baseHeight;
  const totalInnerH = H - innerStartH - frameWidth;
  const topPanelH = totalInnerH * 0.35;
  const bottomPanelH = totalInnerH * 0.65 - dividerHeight;

  // Colors based on reference
  const frameColor = "#4a5568"; // Slate gray
  const topPanelColor = "#2d3748"; // Darker fabric gray
  const bottomPanelColor = "#718096"; // Lighter fabric gray
  const baseColor = "#1a202c"; // Darkest gray for plinth
  const plateColor = "#cbd5e0"; // Light gray for the small label plate

  const panelOpacity = isTransparent ? 0.45 : 1.0;

  return (
    <group>
      {/* 1. Feet */}
      <mesh position={[-L / 2 + feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[L / 2 - feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {/* 2. Base / Plinth */}
      <mesh
        position={[0, feetHeight + baseHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L, baseHeight, T + 0.01]} />
        <meshStandardMaterial color={baseColor} roughness={0.7} />
      </mesh>

      {/* 3. Small label plate on base */}
      <mesh position={[-L / 4, feetHeight + baseHeight / 2, T / 2 + 0.01]}>
        <boxGeometry args={[0.1, 0.04, 0.005]} />
        <meshStandardMaterial color={plateColor} />
      </mesh>

      {/* 4. Outer Frames (Left, Right, Top) */}
      {/* Left */}
      <mesh
        position={[
          -L / 2 + frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Right */}
      <mesh
        position={[
          L / 2 - frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Top */}
      <mesh position={[0, H - frameWidth / 2, 0]} castShadow>
        <boxGeometry args={[L, frameWidth, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>

      {/* 5. Panels */}
      {/* Bottom Panel (Lighter) */}
      <mesh
        position={[0, innerStartH + bottomPanelH / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, bottomPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={bottomPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>

      {/* Divider Rail */}
      <mesh
        position={[0, innerStartH + bottomPanelH + dividerHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[L - frameWidth * 2, dividerHeight, T * 0.9]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} />
      </mesh>

      {/* Top Panel (Darker) */}
      <mesh
        position={[
          0,
          innerStartH + bottomPanelH + dividerHeight + topPanelH / 2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, topPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={topPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ */
/*  Light mesh — server-room ceiling LED panel fixture                 */
/* ------------------------------------------------------------------ */
const LightMesh = ({ model }: { model: ImportedModel }) => {
  const params: LightParams = model.lightParams ?? DEFAULT_LIGHT_PARAMS;

  // Panel dimensions (typical 600×1200mm ceiling light scaled to scene units)
  const panelW = 1.2;
  const panelD = 0.6;
  const panelH = 0.06;
  const frameThick = 0.02;

  return (
    <group>
      {/* ── Outer aluminium housing / frame ── */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[panelW, panelH, panelD]} />
        <meshStandardMaterial
          color="#b0b0b0"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>

      {/* ── Inner diffuser panel (emissive — the actual glowing surface) ── */}
      <mesh position={[0, -(panelH / 2 - 0.005), 0]}>
        <boxGeometry
          args={[panelW - frameThick * 2, 0.01, panelD - frameThick * 2]}
        />
        <meshStandardMaterial
          color={params.color}
          emissive={params.color}
          emissiveIntensity={1.2}
          roughness={0.9}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* ── Ceiling mount brackets (two short tabs) ── */}
      {[-0.35, 0.35].map((xOff) => (
        <mesh key={xOff} position={[xOff, panelH / 2 + 0.06, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.04]} />
          <meshStandardMaterial
            color="#888"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* ── Thin top plate connecting brackets ── */}
      <mesh position={[0, panelH / 2 + 0.12, 0]}>
        <boxGeometry args={[0.8, 0.015, 0.06]} />
        <meshStandardMaterial
          color="#999"
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {/* ── Actual directional light emitter ── */}
      <directionalLight
        position={[0, 0, 0]}
        intensity={params.intensity}
        color={params.color}
        castShadow={params.castShadow}
        shadow-mapSize={[params.shadowMapSize, params.shadowMapSize]}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
    </group>
  );
};

/* ------------------------------------------------------------------ */
/*  GLB mesh — loads from dataUrl (base64 or public URL)               */
/* ------------------------------------------------------------------ */
const GltfMesh = ({ url }: { url: string }) => {
  const { scene: gltfScene } = useGLTF(url);

  const cloned = useMemo(() => {
    if (!gltfScene) return null;
    const clone = gltfScene.clone(true);

    // Calculate bounding box for auto-centering
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    box.getCenter(center);

    // Center X, Z and set bottom (min Y) to 0 so it sits on the floor
    clone.position.set(-center.x, -box.min.y, -center.z);

    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [gltfScene]);

  if (!cloned) return null;
  return <primitive object={cloned} />;
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export const ImportedModelMesh = ({ model }: ImportedModelMeshProps) => {
  const selectedModelId = useStore((s) => s.selectedModelId);
  const isEditMode = useStore((s) => s.isEditMode);
  const isSelected = selectedModelId === model.id;
  const isMoveEnabled = model.isMoveEnabled ?? false;

  const isWall = model.builtinType === "Wall";
  const isPartition = model.builtinType === "Partition";
  const isClock = model.builtinType === "Clock";
  const isLight = model.builtinType === "Light";

  // Sensor data for DigitalClock — synced with dashboard overview
  const activeNodeId = useStore((s) => s.activeNodeId);
  const sensorData = activeNodeId ? getNodeSensorData(activeNodeId) : undefined;

  const updateModel = useStore((s) => s.updateModel);
  const setModelDragging = useStore((s) => s.setModelDragging);
  const { controls } = useThree();


  // Live pose ref — stores the current transform while dragging without triggering re-renders
  const livePose = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }>({
    position: [...model.position],
    rotation: [...model.rotation],
    scale: [...model.scale],
  });

  // Keep livePose in sync with store when NOT dragging
  const isDragging = useRef(false);
  useEffect(() => {
    if (isDragging.current) return;
    livePose.current = {
      position: [...model.position],
      rotation: [...model.rotation],
      scale: [...model.scale],
    };
  }, [model.position, model.rotation, model.scale]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useStore.getState().isGizmoHovered) return;

    // Check if the user is clicking the PivotControls gizmo.
    // Because depthTest={false}, the gizmo is visually on top.
    // If the raycaster intersected the gizmo, we must let it handle the event,
    // even if the model geometry is geometrically closer to the camera.
    const hitGizmo = e.intersections.some((hit) => {
      let obj: Object3D | null = hit.object;
      let isInner = false;
      let isGizmo = false;
      while (obj) {
        if (obj.userData?.isInnerContent) isInner = true;
        if (obj.userData?.isGizmo) isGizmo = true;
        obj = obj.parent;
      }
      return isGizmo && !isInner;
    });

    if (hitGizmo) {
      return; // Do nothing, let PivotControls catch it
    }

    const { isEditMode: editMode, selectRack, selectModel } = useStore.getState();

    if (!editMode) {
      selectRack(null);
      return;
    }

    e.stopPropagation();
    selectModel(model.id);
  };

  // Visual feedback
  const highlightColor = isMoveEnabled ? "#4ade80" : "#f97316";
  const highlightOpacity = isMoveEnabled ? 0.6 : 0.35;

  const wp = model.wallParams ?? DEFAULT_WALL_PARAMS;
  const pp = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;

  const hlArgs: [number, number, number] = isWall
    ? [wp.length + 0.1, wp.height + 0.1, wp.thickness + 0.1]
    : isPartition
      ? [pp.length + 0.1, pp.height + 0.1, pp.thickness + 0.1]
      : isClock
        ? [1.3, 0.95, 0.15]
        : isLight
          ? [1.4, 0.3, 0.8]
          : [1.1, 1.1, 1.1];

  const hlCenter: [number, number, number] = isWall
    ? [0, wp.height / 2, 0]
    : isPartition
      ? [0, pp.height / 2, 0]
      : isClock
        ? [0, 0.85 / 2, 0]
        : isLight
          ? [0, 0.03, 0]
          : [0, 0, 0];

  // matrix used by PivotControls — derived from live pose ref while dragging
  const matrix = useMemo(() => {
    const m = new Matrix4();
    m.compose(
      new Vector3(...model.position),
      new Quaternion().setFromEuler(new Euler(...model.rotation)),
      new Vector3(...model.scale),
    );
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.position, model.rotation, model.scale]);

  const shouldTransform = isSelected && isEditMode && isMoveEnabled;

  const innerContent = (
    <group
      userData={{ isInnerContent: true }}
      onPointerDown={handlePointerDown}
      onPointerOver={() => {
        if (useStore.getState().isGizmoHovered) return;
        if (isEditMode) {
          document.body.style.cursor = isMoveEnabled ? "grab" : "pointer";
        }
      }}
      onPointerOut={() => {
        if (
          document.body.style.cursor === "grab" ||
          document.body.style.cursor === "pointer"
        ) {
          document.body.style.cursor = "auto";
        }
      }}
    >
      {/* Render appropriate mesh */}
      {isWall ? (
        <WallMesh model={model} />
      ) : isPartition ? (
        <PartitionMesh model={model} />
      ) : isClock ? (
        <DigitalClock
          temperature={sensorData?.temperature ?? undefined}
          humidity={sensorData?.humidity ?? undefined}
        />
      ) : isLight ? (
        <LightMesh model={model} />
      ) : (
        <GltfErrorBoundary key={model.id}>
          <Suspense fallback={null}>
            <GltfMesh url={model.dataUrl} />
          </Suspense>
        </GltfErrorBoundary>
      )}

      {/* Selection highlight box */}
      {isSelected && (
        <group position={hlCenter}>
          <mesh>
            <boxGeometry args={hlArgs} />
            <meshBasicMaterial
              color={highlightColor}
              wireframe
              transparent
              opacity={highlightOpacity}
            />
          </mesh>
        </group>
      )}
      {/* Lock/Unlock status label */}
      {isSelected && isEditMode && (
        <Billboard
          position={[
            0,
            isWall
              ? wp.height + 0.4
              : isPartition
                ? pp.height + 0.4
                : isClock
                  ? 1.25
                  : isLight
                    ? 0.6
                    : 1.4,
            0,
          ]}
        >
          <Html center zIndexRange={[0, 10]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: isMoveEnabled
                  ? "rgba(74, 222, 128, 0.9)"
                  : "rgba(249, 115, 22, 0.9)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "Inter, system-ui, sans-serif",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {isMoveEnabled ? "🔓 Unlocked" : "🔒 Locked"}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );

  return (
    <group userData={{ isModelContainer: true, modelId: model.id }}>
      {shouldTransform ? (
        <PivotControls
          matrix={matrix}
          userData={{ isGizmo: true }}
          anchor={[0, 0, 0]}
          depthTest={false}
          fixed
          scale={75}
          lineWidth={2.5}
          disableSliders={false}
          onDragStart={() => {
            isDragging.current = true;
            // Imperatively disable OrbitControls IMMEDIATELY to prevent
            // camera movement competing with PivotControls drag (XZ slider).
            // React state update (setModelDragging) only takes effect next render,
            // by which time OrbitControls has already captured the pointer.
            if (controls) (controls as any).enabled = false;
            setModelDragging(model.id);
          }}
          onDrag={(m) => {
            // Decompose the matrix and apply directly to group (NO store update here)
            const p = new Vector3();
            const r = new Quaternion();
            const s = new Vector3();
            m.decompose(p, r, s);
            const euler = new Euler().setFromQuaternion(r);

            livePose.current = {
              position: [p.x, p.y, p.z],
              rotation: [euler.x, euler.y, euler.z],
              scale: [s.x, s.y, s.z],
            };
            // PivotControls handles its own rendering; no need to mutate groupRef here
          }}
          onDragEnd={() => {
            isDragging.current = false;
            // Re-enable OrbitControls imperatively before state update
            if (controls) (controls as any).enabled = true;
            setModelDragging(null);
            // Commit final pose to store ONCE on drag end
            updateModel(model.id, {
              position: livePose.current.position,
              rotation: livePose.current.rotation,
              scale: livePose.current.scale,
            });
          }}
        >
          {innerContent}
        </PivotControls>
      ) : (
        <group
          position={model.position}
          rotation={model.rotation}
          scale={model.scale}
        >
          {innerContent}
        </group>
      )}
    </group>
  );
};
