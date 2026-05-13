import { useEffect, useMemo, useRef, useCallback, forwardRef, Suspense, memo } from "react";
import { RoundedBox, useTexture, Billboard, Html } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { type ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, Color, DoubleSide, Euler, Mesh, MeshStandardMaterial, Object3D, Plane, RepeatWrapping, Vector3 } from 'three';
import { useStore } from "../store/useStore";
import type { AppState } from "../store/useStore";
import { useTheme } from "../contexts/ThemeContext";
import type { Rack as RackType, Device } from "../types";
import { ErrorMarker } from "./ErrorMarker";
import { U_HEIGHT, GRID_SPACING, DEVICE_DEPTH } from "./constants";
import { getHighestError } from "../utils/errorHelpers";
import { resolveDeviceImage } from "../utils/deviceAssets";

// ─── Phase 1-A: 모듈 레벨 공유 Geometry (모든 Rack이 재사용) ───
const SHARED_GEO = {
  topBottom:   new BoxGeometry(1, 0.03, 1),
  cornerPost:  new BoxGeometry(0.02, 1, 0.02),
  hBrace:      new BoxGeometry(1, 0.02, 0.02),
  frontRail:   new BoxGeometry(0.03, 1, 0.03),
  backRail:    new BoxGeometry(0.02, 1, 0.02),
  rearBezel:   new BoxGeometry(1, 1, 0.01),
  doorHBar:    new BoxGeometry(1, 0.04, 0.02),
  doorVBar:    new BoxGeometry(0.04, 1, 0.02),
  interactBox: new BoxGeometry(1, 1, 1),
};

// ─── Phase 1-B: perforatedTexture 모듈 레벨 캐시 ───
const _perforatedCache = new Map<number, CanvasTexture>();
function getPerforatedTexture(rackSize: number): CanvasTexture {
  if (_perforatedCache.has(rackSize)) return _perforatedCache.get(rackSize)!;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  const density = 40;
  const panelW = 1.0 - 0.04;
  const panelH = rackSize * U_HEIGHT + 0.1 - 0.06;
  const railV = 0.08;
  const railW = 0.08;
  const innerW = panelW - railV * 2;
  const innerH = panelH - railW * 2;
  tex.repeat.set(innerW * density, innerH * density);
  _perforatedCache.set(rackSize, tex);
  return tex;
}

// Snapshot of selectedRackId captured inside handlePointerDown BEFORE selectRack()
// mutates it. Since the Interaction Layer is geometrically closer to the camera,
// handlePointerDown fires FIRST, then DeviceMesh's onClick fires and reads this.
let selectedRackIdBeforePointerDown: string | null = null;

interface RackProps extends RackType {}

export const Rack = memo(({
  rackId,
  rackTitle,
  rackSize,
  width: rackWidth,
  position,
  devices,
  mapId,
  orientation: orientationProp,
}: RackProps) => {
  // Boolean selectors: only re-render when THIS rack's selection state changes
  const isSelected = useStore((state: AppState) => state.selectedRackId === rackId);
  const isHovered = useStore((state: AppState) => state.hoveredRackId === rackId);
  const isFocused = useStore((state: AppState) => state.focusedRackId === rackId);
  const isEditMode = useStore((state: AppState) => state.isEditMode);
  const { theme } = useTheme();

  const isInternalFocused = isSelected || isFocused;
  
  // Local subscription for drag state to prevent global re-renders
  const isInternalDragging = useStore((state: AppState) => state.draggingRackId === rackId);
  const dragPosition = useStore((state: AppState) => state.draggingRackId === rackId ? state.dragPosition : null);
  
  const isDarkMode = theme === "dark";
  // Use orientation from props directly instead of searching store.racks
  const orientation = orientationProp ?? 180;

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new Vector3(), []);

  // Phase 1-B: 캐시된 perforatedTexture 사용
  const perforatedTexture = useMemo(() => getPerforatedTexture(rackSize), [rackSize]);

  const height = rackSize * U_HEIGHT + 0.1;
  const width = rackWidth;
  const depth = 1.0;

  // Theme-based colors
  const frameColor = isSelected
    ? isDarkMode
      ? "#FFFFFF" // White highlight for dark mode
      : "#1a73e8"
    : isDarkMode
      ? "#2e313b" // Darker than background
      : "#333333";
  const railColor = isDarkMode ? "#aab0be" : "#888";
  const rearPanelColor = isDarkMode ? "#24272e" : "#111";

  // Convert orientation to radians with proper mapping:
  // North (0°) should face -Z world (180° rotation)
  // East (90°) should face +X world (90° rotation)
  // South (180°) should face +Z world (0° rotation)
  // West (270°) should face -X world (270° rotation)
  // Formula: (180 - orientation)
  const rotationRad = ((180 - (orientation ?? 0)) * Math.PI) / 180;

  // Declarative animation - Purely reactive to props/state
  const currentTargetPos =
    isInternalDragging && dragPosition
      ? [dragPosition[0], height / 2 + 0.1, dragPosition[1]]
      : [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING];

  // Phase 3: Spring config 참조 안정화 — 매 렌더마다 새 객체 생성 방지
  const springConfig = useMemo(() => ({ mass: 1, tension: 280, friction: 30 }), []);
  const { pos, rot, scale, doorRotation } = useSpring({
    pos: currentTargetPos,
    rot: [0, rotationRad, 0],
    scale: isInternalDragging ? 1.05 : 1,
    doorRotation: isInternalFocused ? -Math.PI / 2 : 0,
    config: springConfig,
    immediate: isInternalDragging,
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Ignore pointer events if the user is interacting with the dashboard Gizmo
    if (useStore.getState().isGizmoHovered) return;

    // 1. GIZMO PRIORITY: Because PivotControls has depthTest={false}, it's visually always on top.
    // If the ray hits a Gizmo anywhere, the user intended to click it.
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

    if (hitGizmo) return; // Yield to gizmo immediately

    // 2. MODEL PRIORITY: Determine if the raycaster intersected an ImportedModel BEFORE hitting a solid rack part
    let hitModel = false;
    for (const hit of e.intersections) {
      let isModel = false;
      let obj: Object3D | null = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.isModelContainer) {
          isModel = true;
          break;
        }
        obj = obj.parent;
      }

      if (isModel) {
        hitModel = true;
        break;
      }

      // If we hit a SOLID part of a Rack or Device BEFORE hitting a model,
      // it means the model is hidden behind the rack.
      // We skip SHARED_GEO.interactBox because it is an invisible bounding box.
      if ((hit.object as Mesh).geometry !== SHARED_GEO.interactBox) {
        break;
      }
    }

    if (hitModel) {
      // Do not stop propagation and do not select rack; let the model handle it.
      return;
    }

    e.stopPropagation();
    const { selectRack, setDragging, updateDragPosition, isEditMode } =
      useStore.getState();

    // Snapshot BEFORE mutation — DeviceMesh onClick reads this for two-step gate
    selectedRackIdBeforePointerDown = useStore.getState().selectedRackId;

    selectRack(rackId);

    if (!isEditMode) return;

    // Use the camera we already have from the top-level useThree() hook
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
      const rackWorldX = position[0] * GRID_SPACING;
      const rackWorldZ = position[1] * GRID_SPACING;

      // Offset = ClickedFloorPoint - RackCenter
      const offset: [number, number] = [
        tempPoint.x - rackWorldX,
        tempPoint.z - rackWorldZ,
      ];

      setDragging(true, rackId, offset);
      updateDragPosition([rackWorldX, rackWorldZ]);
      document.body.style.cursor = "grabbing";
    }
  };

  const setHoveredRack = useStore((state: AppState) => state.setHoveredRack);
  const isGlobalDragging = useStore((state: AppState) => state.isDragging);
  useEffect(() => {
    const { isEditMode } = useStore.getState();
    if (isHovered && !isGlobalDragging && isEditMode) {
      document.body.style.cursor = "grab";
    } else if (!isHovered && !isGlobalDragging) {
      if (document.body.style.cursor === "grab")
        document.body.style.cursor = "auto";
    }
  }, [isHovered, isGlobalDragging]);

  return (
    <animated.group
      position={pos as unknown as Vector3}
      rotation={rot as unknown as Euler}
      scale={scale as unknown as Vector3}
    >
      {/* 1. STRUCTURAL FRAME (Main Skeleton) */}
      <group>
        {/* Main Enclosure (Solid frame with better corner joins) */}
        {/* Top */}
        <mesh position={[0, height / 2 - 0.015, 0]} geometry={SHARED_GEO.topBottom} scale={[width, 1, depth]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Bottom */}
        <mesh position={[0, -height / 2 + 0.015, 0]} geometry={SHARED_GEO.topBottom} scale={[width, 1, depth]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Left Side – corner posts only (no full-depth wall, so perforated holes reveal interior) */}
        <mesh position={[-width / 2 + 0.01, 0, depth / 2 - 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        <mesh position={[-width / 2 + 0.01, 0, -depth / 2 + 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Right Side – corner posts only */}
        <mesh position={[width / 2 - 0.01, 0, depth / 2 - 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        <mesh position={[width / 2 - 0.01, 0, -depth / 2 + 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>

        {/* ── LEFT SIDE PANEL ── */}
        <PerforatedPanel xOff={-width / 2} rotY={-Math.PI / 2} panelW={depth - 0.04} panelH={height - 0.06} color={frameColor} texture={perforatedTexture} />

        {/* ── RIGHT SIDE PANEL ── */}
        <PerforatedPanel xOff={width / 2} rotY={Math.PI / 2} panelW={depth - 0.04} panelH={height - 0.06} color={frameColor} texture={perforatedTexture} />

        <group position={[0, 0, 0]}>
          {/* Internal Structural Bracing - Horizontal rails at the back */}
          <mesh position={[0, height / 2 - 0.15, -depth / 2 + 0.1]} geometry={SHARED_GEO.hBrace} scale={[width - 0.04, 1, 1]}>
            <meshStandardMaterial color={frameColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, -height / 2 + 0.15, -depth / 2 + 0.1]} geometry={SHARED_GEO.hBrace} scale={[width - 0.04, 1, 1]}>
            <meshStandardMaterial color={frameColor} roughness={0.8} />
          </mesh>

          {/* Vertical Mounting Rails (Front) */}
          <mesh position={[-width / 2 + 0.06, 0, depth / 2 - 0.12]} geometry={SHARED_GEO.frontRail} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[width / 2 - 0.06, 0, depth / 2 - 0.12]} geometry={SHARED_GEO.frontRail} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>

          {/* Vertical Support Rails (Back) */}
          <mesh position={[-width / 2 + 0.06, 0, -depth / 2 + 0.12]} geometry={SHARED_GEO.backRail} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial color={railColor} roughness={0.5} />
          </mesh>
          <mesh position={[width / 2 - 0.06, 0, -depth / 2 + 0.12]} geometry={SHARED_GEO.backRail} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial color={railColor} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* 2. REAR PANEL (Solid opaque plate – no perforation) */}
      <group position={[0, 0, -depth / 2 + 0.02]}>
        {/* Panel Bezel / Frame */}
        <mesh position={[0, 0, -0.005]} geometry={SHARED_GEO.rearBezel} scale={[width - 0.02, height - 0.04, 1]}>
          <meshStandardMaterial color={frameColor} roughness={0.7} />
        </mesh>
        {/* Solid Rear Plate */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[width - 0.08, height - 0.1]} />
          <meshStandardMaterial
            color={rearPanelColor}
            roughness={0.9}
            metalness={0.6}
            side={DoubleSide}
          />
        </mesh>
      </group>

      {/* 3. FRONT HINGED DOOR (Hollow Frame + Glass) */}
      <animated.group
        position={[-width / 2, 0, depth / 2]} // Pivot at exact left edge
        rotation-y={doorRotation as unknown as number}
      >
        {/* Door Frame Border - Top */}
        <mesh position={[width / 2, height / 2 - 0.02, 0.01]} geometry={SHARED_GEO.doorHBar} scale={[width, 1, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Bottom */}
        <mesh position={[width / 2, -height / 2 + 0.02, 0.01]} geometry={SHARED_GEO.doorHBar} scale={[width, 1, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Left */}
        <mesh position={[0.02, 0, 0.01]} geometry={SHARED_GEO.doorVBar} scale={[1, height - 0.08, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Right */}
        <mesh position={[width - 0.02, 0, 0.01]} geometry={SHARED_GEO.doorVBar} scale={[1, height - 0.08, 1]}>
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>

        {/* Glass Center Panel - Optimized to MeshStandardMaterial */}
        <mesh position={[width / 2, 0, 0.01]}>
          <planeGeometry args={[width - 0.08, height - 0.08]} />
          <meshStandardMaterial
            transparent
            opacity={0.2}
            color="#ffffff"
            roughness={0}
            metalness={0.5}
          />
        </mesh>
      </animated.group>

      <mesh
        geometry={SHARED_GEO.interactBox}
        scale={[width + 0.1, height + 0.1, depth + 0.1]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          if (useStore.getState().isGizmoHovered) return;
          e.stopPropagation();
          setHoveredRack(rackId);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredRack(null);
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Phase 1: 호버 태그 항상 마운트 — DOM 마운트/언마운트 비용 제거 */}
      <Billboard position={[0, height / 2 + 0.4, 0]} visible={isHovered}>
        <Html center zIndexRange={[0, 10]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: isDarkMode
                ? "rgba(23, 24, 28, 0.85)"
                : "rgba(255, 255, 255, 0.9)",
              color: isDarkMode ? "#ebedef" : "#202226",
              padding: "4px 12px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 600,
              border: isDarkMode
                ? isSelected
                  ? "1px solid #FFFFFF"
                  : "1px solid rgba(255, 255, 255, 0.1)"
                : isSelected
                  ? "1px solid #1a73e8"
                  : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: isDarkMode
                ? "0 4px 15px rgba(0, 0, 0, 0.4)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              whiteSpace: "nowrap",
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
              userSelect: "none",
              display: isHovered ? "flex" : "none",
              alignItems: "center",
              gap: "6px",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isDarkMode
                  ? isSelected
                    ? "#FFFFFF"
                    : "#4d5261"
                  : "#1a73e8",
                display: "inline-block",
              }}
            />
            <span>{`${rackSize}U`}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>
              {rackTitle || `Rack ${rackId.slice(0, 4).toUpperCase()}`}
            </span>
          </div>
        </Html>
      </Billboard>

      <group position={[0, 0, depth / 2 - 0.07]}>
        {/* Removed per-rack pointLight for performance */}
        {devices.map((device) => (
          <MemoDeviceMesh
            key={device.itemId}
            device={device}
            rackHeight={height}
            rackWidth={width}
            rackId={rackId}
          />
        ))}
      </group>
      {/* Only mount ErrorMarker when rack has error devices and NOT in edit mode */}
      {!isEditMode && devices.some((d) => d.portStates?.some((p) => p.status === "error")) && (
        <ErrorMarker
          rack={{
            rackId,
            rackSize,
            position,
            devices,
            width,
            mapId,
          }}
        />
      )}
    </animated.group>
  );
});

// Phase 1: PerforatedPanel — IIFE 제거, memo 컴포넌트로 분리
const PerforatedPanel = memo(({ xOff, rotY, panelW, panelH, color, texture }: {
  xOff: number; rotY: number; panelW: number; panelH: number; color: string; texture: CanvasTexture;
}) => (
  <group position={[xOff, 0, 0]} rotation={[0, rotY, 0]}>
    <mesh>
      <planeGeometry args={[panelW, panelH]} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.8}
        alphaMap={texture}
        transparent
        alphaTest={0.5}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  </group>
));

// Phase 1: MemoDeviceMesh — onSelect를 내부에서 안정화
const MemoDeviceMesh = memo(({ device, rackHeight, rackWidth, rackId }: {
  device: Device; rackHeight: number; rackWidth: number; rackId: string;
}) => {
  const onSelect = useCallback(() => {
    const { focusRack, selectDevice, isEditMode } = useStore.getState();
    if (isEditMode) return;
    if (selectedRackIdBeforePointerDown === rackId) {
      selectDevice(device.itemId);
    } else {
      focusRack(rackId);
    }
  }, [rackId, device.itemId]);

  return (
    <DeviceMesh
      device={device}
      rackHeight={rackHeight}
      rackWidth={rackWidth}
      onSelect={onSelect}
    />
  );
});

const DeviceMesh = ({
  device,
  rackHeight,
  rackWidth,
  onSelect,
}: {
  device: Device;
  rackHeight: number;
  rackWidth: number;
  onSelect: () => void;
}) => {
  const meshRef = useRef<Mesh>(null);
  const faceplateRef = useRef<Mesh>(null);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const isHighlighted = highlightedDeviceId === device.itemId || (device.deviceId && highlightedDeviceId === device.deviceId);

  const deviceH = device.size * U_HEIGHT;
  const bottomY = -rackHeight / 2;
  const yOffset = (device.position - 1) * U_HEIGHT;
  const centerY = bottomY + yOffset + deviceH / 2 + 0.05;
  const deviceWidth = rackWidth - 0.06;

  const { hasError, errorColor } = useMemo(() => {
    const err = getHighestError(device.portStates);
    return {
      hasError: err !== null,
      errorColor: err?.color ?? null,
    };
  }, [device.portStates]);

  // 에러 + 선택 모두 애니메이션 필요
  const needsAnimation = isHighlighted || (hasError && !!errorColor);

  // Cache Color objects to avoid per-frame allocation
  const highlightColor = useMemo(() => new Color("#4dabf7"), []);
  const blackColor = useMemo(() => new Color("#000000"), []);

  // Reset emissive once when animation stops (instead of every frame)
  useEffect(() => {
    if (!needsAnimation) {
      const bodyMat = meshRef.current?.material;
      const faceMat = faceplateRef.current?.material;
      if (bodyMat instanceof MeshStandardMaterial) {
        bodyMat.emissive.copy(blackColor);
        bodyMat.emissiveIntensity = 0;
        bodyMat.opacity = 1.0;
      }
      if (faceMat instanceof MeshStandardMaterial) {
        faceMat.emissive.copy(blackColor);
        faceMat.emissiveIntensity = 0;
        faceMat.opacity = 1.0;
      }
    }
  }, [needsAnimation, blackColor]);

  // Phase 1-C: early return 패턴으로 빈 함수 호출 오버헤드 제거
  useFrame(({ clock }) => {
    if (!needsAnimation) return;

    const bodyMat = meshRef.current?.material;
    const faceMat = faceplateRef.current?.material;

    if (isHighlighted) {
      const pulse =
        0.5 + Math.sin(clock.getElapsedTime() * Math.PI * 1.6) * 0.5;

      if (bodyMat instanceof MeshStandardMaterial) {
        bodyMat.emissive.copy(highlightColor);
        bodyMat.emissiveIntensity = pulse * 4;
      }
      if (faceMat instanceof MeshStandardMaterial) {
        faceMat.emissive.copy(highlightColor);
        faceMat.emissiveIntensity = pulse * 4;
      }
    } else if (hasError && errorColor) {
      const intensity =
        0.5 + Math.sin(clock.getElapsedTime() * Math.PI * 3) * 0.5;

      if (bodyMat instanceof MeshStandardMaterial) {
        bodyMat.emissive.set(errorColor);
        bodyMat.emissiveIntensity = intensity;
      }
      if (faceMat instanceof MeshStandardMaterial) {
        faceMat.emissive.set(errorColor);
        faceMat.emissiveIntensity = intensity;
      }
    }
  });

  const resolvedUrl = useMemo(
    () => device.dashboardThumbnailUrl || resolveDeviceImage(device.modelName),
    [device.dashboardThumbnailUrl, device.modelName],
  );

  return (
    <group
      position={[0, centerY, -0.41]}
      onClick={(e) => {
        if (useStore.getState().isGizmoHovered) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      {(() => {
        const content = (
          <>
            <RoundedBox
              ref={meshRef}
              args={[deviceWidth, deviceH - 0.005, DEVICE_DEPTH]}
              radius={0.005}
              smoothness={2}
            >
              <meshStandardMaterial
                color="#222222"
                roughness={0.4}
                metalness={0.7}
                transparent={hasError}
              />
            </RoundedBox>

            <group position={[0, 0, DEVICE_DEPTH / 2 + 0.001]}>
              {resolvedUrl ? (
                <ImageFaceplate
                  url={resolvedUrl}
                  width={deviceWidth}
                  height={deviceH - 0.005}
                  ref={faceplateRef}
                  hasError={hasError}
                />
              ) : (
                <DeviceFaceplate
                  type={device.type}
                  width={deviceWidth}
                  height={deviceH - 0.005}
                  ref={faceplateRef}
                  hasError={hasError}
                  errorColor={errorColor}
                />
              )}
            </group>
          </>
        );

        if (resolvedUrl) {
          return <Suspense fallback={null}>{content}</Suspense>;
        }
        return content;
      })()}
    </group>
  );
};

// Phase 3: memo로 래핑하여 동일 url/size에 대한 불필요한 텍스처 리렌더 방지
const ImageFaceplate = memo(forwardRef<
  Mesh,
  {
    url: string;
    width: number;
    height: number;
    hasError?: boolean;
  }
>(({ url, width, height, hasError }, ref) => {
  const texture = useTexture(url);
  return (
    <mesh position={[0, 0, 0]} ref={ref}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent={hasError} />
    </mesh>
  );
}));

const DeviceFaceplate = forwardRef<
  Mesh,
  {
    type: Device["type"];
    width: number;
    height: number;
    hasError?: boolean;
    errorColor?: string | null;
  }
>(({ type, width, height, hasError, errorColor }, ref) => {
  const isServer = type === "Server";
  const isRouter = type === "Router";
  const isSwitch = type === "Switch";

  return (
    <group>
      <mesh ref={ref}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.8}
          transparent={hasError}
        />
      </mesh>

      <mesh position={[-width / 2 + 0.04, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={hasError && errorColor ? errorColor : "#00ff00"}
        />
      </mesh>
      <mesh position={[-width / 2 + 0.06, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={
            hasError && errorColor
              ? errorColor
              : isServer
                ? "#00ff00"
                : "#ffaa00"
          }
        />
      </mesh>

      {isSwitch && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh
              key={i}
              position={[-0.15 + (i % 6) * 0.06, i < 6 ? 0.01 : -0.01, 0]}
            >
              <planeGeometry args={[0.04, 0.015]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          ))}
        </group>
      )}
      {isRouter && (
        <group position={[0.05, 0, 0.001]}>
          <mesh position={[-0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}
      {isServer && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.15 + i * 0.1, 0, 0]}>
              <boxGeometry args={[0.08, height * 0.8, 0.005]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});
