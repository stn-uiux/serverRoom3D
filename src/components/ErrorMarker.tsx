import { useMemo } from "react";
import { useStore } from "../store/useStore";
import type { Rack } from "../types";
import {
  ERROR_COLORS,
  ERROR_PRIORITY,
  getHighestError,
} from "../utils/errorHelpers";
import type { ErrorLevel } from "../types";
import type { Event as ThreeEvent } from 'three';
import { Html, Billboard } from "@react-three/drei";
import { U_HEIGHT, ERROR_MARKER_HEIGHT } from "./constants";

interface ErrorMarkerProps {
  rack: Rack;
}

export const ErrorMarker = ({ rack }: ErrorMarkerProps) => {
  // Find the highest-severity error across all devices in this rack
  const highestError = useMemo<ErrorLevel | null>(() => {
    let bestLevel: ErrorLevel | null = null;
    let bestPriority = 0;

    for (const d of rack.devices) {
      const err = getHighestError(d.portStates);
      if (err && ERROR_PRIORITY[err.level] > bestPriority) {
        bestPriority = ERROR_PRIORITY[err.level];
        bestLevel = err.level;
      }
    }

    return bestLevel;
  }, [rack.devices]);

  // Early return BEFORE any hooks that would cause issues
  if (!highestError) return null;

  // Calculate position relative to rack center
  const actualRackHeight = rack.rackSize * U_HEIGHT + 0.1;
  const position: [number, number, number] = [
    0,
    ERROR_MARKER_HEIGHT - actualRackHeight / 2,
    0,
  ];

  const color = ERROR_COLORS[highestError];

  const handleClick = (e: React.MouseEvent | ThreeEvent) => {
    // Read drag state only on click (no subscription needed)
    const { isDragging, draggingModelId, selectRack, focusRack } =
      useStore.getState();
    if (isDragging || draggingModelId !== null) return;
    if ("stopPropagation" in e) (e as React.MouseEvent).stopPropagation();
    selectRack(rack.rackId);
    focusRack(rack.rackId);
  };

  return (
    <group position={position}>
      <Billboard follow={true}>
        <group>
          {/* Cone pointing down — CSS-animated bounce via Html wrapper */}
          <mesh
            position={[0, 0, 0]}
            rotation={[Math.PI, 0, 0]}
            renderOrder={1000}
            onClick={(e) => {
              const { isDragging, draggingModelId } = useStore.getState();
              if (isDragging || draggingModelId !== null) return;
              e.stopPropagation();
              useStore.getState().selectRack(rack.rackId);
              useStore.getState().focusRack(rack.rackId);
            }}
          >
            <coneGeometry args={[0.2, 0.4, 32]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1}
              depthTest={false}
              transparent={true}
              opacity={0.9}
            />
          </mesh>

          {/* Error Label UI — bounce via CSS animation instead of useFrame */}
          <Html
            position={[0, 0.5, 0]}
            center
            transform={false}
            style={{
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(0, 0, 0, 0.85)",
                color: color,
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 800,
                border: `2px solid ${color}`,
                whiteSpace: "nowrap",
                boxShadow: `0 0 15px ${color}88`,
                cursor: "pointer",
                pointerEvents: "auto",
                userSelect: "none",
                animation: "errorBounce 1s ease-in-out infinite",
              }}
              onClick={handleClick as React.MouseEventHandler}
            >
              {(highestError as string).toUpperCase()}
            </div>
          </Html>
        </group>
      </Billboard>
    </group>
  );
};
