import type { BuiltinModelType, WallParams, PartitionParams, LightParams } from "../types";

export interface BuiltinModelDef {
  type: BuiltinModelType;
  label: string;
  emoji: string;
  /** Public URL path to GLB, empty string for procedural models (Wall) */
  assetUrl: string;
  fileName: string;
}

/** Default wall parameters */
export const DEFAULT_WALL_PARAMS: WallParams = {
  height: 3,
  length: 5,
  thickness: 0.15,
  color: "#8a8a8a",
};

/** Default light parameters */
export const DEFAULT_LIGHT_PARAMS: LightParams = {
  intensity: 1.5,
  color: "#ffffff",
  castShadow: true,
  shadowMapSize: 1024,
};

/** Default partition parameters */
export const DEFAULT_PARTITION_PARAMS: PartitionParams = {
  height: 2.2,
  length: 2.5,
  thickness: 0.08,
  color: "#a0aec0", // blue-ish gray
  visibilityMode: "transparent",
};

/** List of all built-in models available in the palette */
export const BUILTIN_MODELS: BuiltinModelDef[] = [
  {
    type: "Wall",
    label: "Wall",
    emoji: "🧱",
    assetUrl: "", // procedural — no GLB
    fileName: "__builtin_wall",
  },
  {
    type: "Chair",
    label: "Chair",
    emoji: "🪑",
    assetUrl: "/assets/3D/Chair.glb",
    fileName: "__builtin_chair.glb",
  },
  {
    type: "Desk",
    label: "Desk",
    emoji: "🖥️",
    assetUrl: "/assets/3D/Desk.glb",
    fileName: "__builtin_desk.glb",
  },
  {
    type: "Desk2",
    label: "Desk 2",
    emoji: "💻",
    assetUrl: "/assets/3D/Desk2.glb",
    fileName: "__builtin_desk2.glb",
  },
  {
    type: "Partition",
    label: "Partition",
    emoji: "🪟",
    assetUrl: "", // procedural
    fileName: "__builtin_partition",
  },
  {
    type: "Clock",
    label: "Clock",
    emoji: "⏰",
    assetUrl: "", // procedural component
    fileName: "__builtin_clock",
  },
  {
    type: "Light",
    label: "Light",
    emoji: "💡",
    assetUrl: "", // procedural — emits directional light
    fileName: "__builtin_light",
  },
];
