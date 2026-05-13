import type { Orientation } from "../types";
import { RACK_DEPTH } from "../components/constants";

/**
 * Get the front-facing direction vector for a given rack orientation.
 * Returns unit vector { x, z } indicating which direction the front door faces.
 *
 * Orientation mapping:
 *   0°   (North) → front faces -Z → { x: 0, z: -1 }
 *   90°  (East)  → front faces +X → { x: 1, z:  0 }
 *   180° (South) → front faces +Z → { x: 0, z:  1 }
 *   270° (West)  → front faces -X → { x:-1, z:  0 }
 */
export const getFrontDirection = (
  orientation: Orientation,
): { x: number; z: number } => {
  switch (orientation) {
    case 0:
      return { x: 0, z: -1 };
    case 90:
      return { x: 1, z: 0 };
    case 180:
      return { x: 0, z: 1 };
    case 270:
      return { x: -1, z: 0 };
    default:
      return { x: 0, z: 1 };
  }
};

/**
 * Get the effective width and depth of a rack considering its rotation.
 * When rotated 90° or 270°, width and depth swap.
 */
export const getEffectiveDimensions = (
  width: number,
  orientation: Orientation,
): { effectiveWidth: number; effectiveDepth: number } => {
  const isRotated = orientation === 90 || orientation === 270;
  return {
    effectiveWidth: isRotated ? RACK_DEPTH : width,
    effectiveDepth: isRotated ? width : RACK_DEPTH,
  };
};
