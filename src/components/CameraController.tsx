import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from "three-stdlib";
import { U_HEIGHT, GRID_SPACING } from "./constants";

export const CameraController = () => {
  const { camera, controls } = useThree();
  const selectedRackId = useStore((state) => state.selectedRackId);
  const focusedRackId = useStore((state) => state.focusedRackId);

  const isEditMode = useStore((state) => state.isEditMode);
  const setPreFocusCameraState = useStore(
    (state) => state.setPreFocusCameraState,
  );

  const lastProcessedRackId = useRef<string | null>(null);
  const lastWasFocused = useRef<boolean>(false);
  const isInteracting = useRef<boolean>(false);

  const vTargetPos = useRef(new Vector3());
  const vTargetLookAt = useRef(new Vector3());
  const vTargetZoom = useRef(1);

  // Use ref for animation flag to avoid React re-renders during interpolation
  const isAnimating = useRef(false);

  // Common function to set up animation to a rack
  const setupFocus = (
    targetRackId: string | null,
    isExplicitFocus: boolean,
  ) => {
    const currentState = useStore.getState();
    const storedSnapshot = currentState.preFocusCameraState;

    // If focus is specifically cleared (from non-null to null), and we have a snapshot, trigger restoration
    // BUT only if we're not about to focus a new rack (rack-to-rack transition)
    if (!isExplicitFocus && lastWasFocused.current && storedSnapshot) {
      // Check if a new focusedRackId is about to be set (rack-to-rack transition)
      // In that case, skip restoration — the next setupFocus call will handle direct transition
      if (!targetRackId) {
        vTargetPos.current.set(...storedSnapshot.position);
        vTargetLookAt.current.set(...storedSnapshot.target);
        vTargetZoom.current = storedSnapshot.zoom;
        isAnimating.current = true;
        lastProcessedRackId.current = null;
        lastWasFocused.current = false;
        return;
      }
      // Rack-to-rack: don't restore, just update tracking and fall through to focus new rack
      lastWasFocused.current = false;
    }

    // Only process if the target rack or focus state actually changes
    if (
      targetRackId === lastProcessedRackId.current &&
      isExplicitFocus === lastWasFocused.current
    )
      return;

    lastProcessedRackId.current = targetRackId;
    lastWasFocused.current = isExplicitFocus;

    if (!targetRackId) {
      // General return to base if focus is lost and we weren't just in explicit focus
      if (storedSnapshot) {
        vTargetPos.current.set(...storedSnapshot.position);
        vTargetLookAt.current.set(...storedSnapshot.target);
        vTargetZoom.current = storedSnapshot.zoom;
        isAnimating.current = true;
      }
      return;
    }

    const currentRacks = useStore.getState().racks;
    const rack = currentRacks.find((r) => r.rackId === targetRackId);
    if (!rack || !controls) return;

    const perspectiveCamera = camera as PerspectiveCamera;

    // Capture state ONLY if not already focused/selected
    if (!storedSnapshot && controls) {
      const orbitControls = controls as unknown as OrbitControls;
      setPreFocusCameraState({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          orbitControls.target.x,
          orbitControls.target.y,
          orbitControls.target.z,
        ],
        zoom: camera.zoom,
      });
    }

    const rackX = rack.position[0] * GRID_SPACING;
    const rackZ = rack.position[1] * GRID_SPACING;
    const rackHeight = rack.rackSize * U_HEIGHT + 0.1;
    const rackWidth = 0.6;

    const fov = perspectiveCamera.fov;
    const aspect = window.innerWidth / window.innerHeight;
    const vFovRad = (fov * Math.PI) / 180;
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    const distHeight = rackHeight / 2 / Math.tan(vFovRad / 2);
    const distWidth = rackWidth / 2 / Math.tan(hFovRad / 2);
    const baseDistance = Math.max(distHeight, distWidth) * 1.1;
    const distance = Math.max(baseDistance, 2.0);

    const targetCenterY = rackHeight * 0.5;
    vTargetLookAt.current.set(rackX, targetCenterY, rackZ);

    const orientation = rack.orientation ?? 180;
    const orientationRad = ((180 - orientation) * Math.PI) / 180;

    const camDirX = Math.sin(orientationRad);
    const camDirZ = Math.cos(orientationRad);

    // 맞은편 랙(장애물) 탐색
    let obstructionDist = Infinity;
    const activeNodeId = useStore.getState().activeNodeId;
    const allRacks = currentRacks.filter(
      (r) => r.mapId === activeNodeId && r.rackId !== rack.rackId,
    );

    for (const other of allRacks) {
      const otherX = other.position[0] * GRID_SPACING;
      const otherZ = other.position[1] * GRID_SPACING;

      const dx = otherX - rackX;
      const dz = otherZ - rackZ;

      // 카메라가 바라보는 방향으로의 투영 거리 (상대방 랙의 중심점까지 거리)
      const proj = dx * camDirX + dz * camDirZ;

      if (proj <= 0.1) continue; // 뒤에 있거나 같은 위치

      // 카메라 시야 폭 검사
      const perpDist = Math.abs(dx * camDirZ - dz * camDirX);
      if (perpDist > 1.2) continue; // 시야를 명확히 벗어남

      if (proj < obstructionDist) {
        obstructionDist = proj; // 가장 가까운 맞은편 랙
      }
    }

    // 카메라 유효 거리 설정
    // 랙이 다 보이도록 하는 최소 거리에 0.2의 여유를 둠
    let effectiveDistance = Math.max(distance, 1.8);

    if (obstructionDist !== Infinity) {
      const safeMaxDistance = obstructionDist - 0.7;
      if (effectiveDistance > safeMaxDistance) {
        effectiveDistance = Math.max(safeMaxDistance, 1.2);
      }
    }

    // 첨부해주신 이미지(목표 시점)처럼 항상 랙 윗부분(지붕)이 살짝 보이면서
    // 위에서 아래로 내려다보는 구도를 만들기 위해 카메라 기준 높이를 랙보다 높게 고정합니다.
    const cameraHeight = rackHeight + 0.6; // 랙 지붕보다 항상 0.6m 높게

    // 시선 중심점(LookAt)을 랙의 중앙보다 살짝 아래로 두어,
    // 위에서 아래로 향하는 각도를 자연스럽게 형성하고 전면 장비들이 모두 뷰에 꽉 차게 합니다.
    vTargetLookAt.current.set(rackX, rackHeight * 0.4, rackZ);

    let targetZoom = 1.0;
    const requiredBaseDistance = Math.max(distHeight, distWidth) * 1.1;
    if (effectiveDistance < requiredBaseDistance) {
      targetZoom = effectiveDistance / requiredBaseDistance;
    }

    const offsetX = camDirX * effectiveDistance;
    const offsetZ = camDirZ * effectiveDistance;

    vTargetPos.current.set(rackX + offsetX, cameraHeight, rackZ + offsetZ);
    vTargetZoom.current = targetZoom;

    isAnimating.current = true;
  };

  // Detect user interaction to stop fighting controls
  useEffect(() => {
    if (!controls) return;
    const orbit = controls as any;
    const onStart = () => {
      isInteracting.current = true;
      isAnimating.current = false;
    };
    const onEnd = () => {
      isInteracting.current = false;
    };

    orbit.addEventListener("start", onStart);
    orbit.addEventListener("end", onEnd);
    return () => {
      orbit.removeEventListener("start", onStart);
      orbit.removeEventListener("end", onEnd);
    };
  }, [controls]);

  const triggerFitToScene = useStore((state) => state.triggerFitToScene);

  // Fit to scene logic
  useEffect(() => {
    if (triggerFitToScene === 0) return;

    const { racks, importedModels } = useStore.getState();
    if (racks.length === 0 && importedModels.length === 0) return;

    const bbox = new Box3();

    // Include Racks
    racks.forEach((rack) => {
      const rackX = rack.position[0] * GRID_SPACING;
      const rackZ = rack.position[1] * GRID_SPACING;
      const rackHeight = rack.rackSize * U_HEIGHT;
      const hw = (rack.width || 0.6) / 2;
      const hd = 0.3; // depth/2

      bbox.expandByPoint(new Vector3(rackX - hw, 0, rackZ - hd));
      bbox.expandByPoint(new Vector3(rackX + hw, rackHeight, rackZ + hd));
    });

    // Include Imported Models (exclude Light — they are above the scene and would skew framing)
    importedModels
      .filter((m) => m.builtinType !== "Light")
      .forEach((model) => {
        // Basic position inclusion.
        // Note: Ideally we would calculate actual mesh bounds, but position + some padding is a good start.
        // If the model is a builtin one like DigitalClock, we know its height is ~2m
        const pos = new Vector3(...model.position);
        bbox.expandByPoint(pos);
        bbox.expandByPoint(pos.clone().add(new Vector3(0, 2, 0))); // Add some height
      });

    if (bbox.isEmpty()) return;

    const center = new Vector3();
    bbox.getCenter(center);
    const size = new Vector3();
    bbox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const perspectiveCamera = camera as PerspectiveCamera;
    const fov = perspectiveCamera.fov;

    // Fit calculation
    const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
    const padding = 2.0; // Comfortable margin
    const finalDistance = Math.max(distance * padding, 8); // Minimum distance

    vTargetLookAt.current.copy(center);
    // Position camera at a nice 45-degree angle
    vTargetPos.current.set(
      center.x + finalDistance * 0.7,
      center.y + finalDistance * 0.8,
      center.z + finalDistance * 0.7,
    );
    vTargetZoom.current = 1;

    isAnimating.current = true;
    lastProcessedRackId.current = null; // Ensure we can re-select models if needed
  }, [triggerFitToScene, camera]);

  // Main interaction effect
  useEffect(() => {
    const targetId = focusedRackId || selectedRackId;
    const { isDragging } = useStore.getState();

    if (targetId && (focusedRackId || !isEditMode) && !isDragging) {
      setupFocus(targetId, !!focusedRackId);
    } else if (!targetId) {
      setupFocus(null, false);
    }
  }, [selectedRackId, focusedRackId, isEditMode]);

  useFrame((state, delta) => {
    if (!isAnimating.current || !controls || isInteracting.current) return;

    const orbitControls = controls as unknown as OrbitControls;
    const alpha = 1 - Math.exp(-10 * delta);

    camera.position.lerp(vTargetPos.current, alpha);
    orbitControls.target.lerp(vTargetLookAt.current, alpha);

    if (Math.abs(state.camera.zoom - vTargetZoom.current) > 0.001) {
      state.camera.zoom = MathUtils.lerp(
        state.camera.zoom,
        vTargetZoom.current,
        alpha,
      );
      state.camera.updateProjectionMatrix();
    }

    orbitControls.update();

    const posDist = camera.position.distanceTo(vTargetPos.current);
    const targetDist = orbitControls.target.distanceTo(vTargetLookAt.current);

    if (posDist < 0.01 && targetDist < 0.01) {
      camera.position.copy(vTargetPos.current);
      orbitControls.target.copy(vTargetLookAt.current);
      state.camera.zoom = vTargetZoom.current;
      state.camera.updateProjectionMatrix();
      orbitControls.update();

      isAnimating.current = false;

      // Only clear snapshot if we are truly back at base (no selection, no focus)
      const freshState = useStore.getState();
      if (!freshState.selectedRackId && !freshState.focusedRackId) {
        setPreFocusCameraState(null);
      }
    }
  });

  return null;
};
