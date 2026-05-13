/**
 * Device Asset Image Resolver
 *
 * Dynamically maps modelName → image URL using Vite's import.meta.glob.
 * Asset files in src/assets/ have the naming pattern: "[{uSize}U] {modelName}.png"
 *
 * SVG files with port path data are loaded as raw text (?raw) to avoid
 * network fetch and URL encoding issues with special chars in filenames.
 * SVG pattern: "[{uSize}U] {modelName}.svg" with <path id="port-N" ...>
 */

// Eagerly import all PNG images from src/assets/
const assetModules = import.meta.glob<{ default: string }>("../assets/*.png", {
  eager: true,
});

// Lazy import all SVG files from src/assets/ as raw text
// Using ?raw avoids fetch() and URL-encoding issues with special char filenames.
// By NOT specifying eager: true, these huge strings are put in separate chunks and loaded on demand.
const svgRawModules = import.meta.glob<{ default: string }>(
  ["../assets/*.svg", "../assets/card/*.svg"],
  {
    query: "?raw",
  }
);

// ── PNG: modelName → resolved URL ──────────────────────────────────────────
const deviceImageMap = new Map<string, string>();
for (const [path, mod] of Object.entries(assetModules)) {
  const filename = path.split("/").pop() ?? "";
  const modelName = filename.replace(/\.png$/i, "").replace(/^\[\d+U\]\s*/, "");
  if (modelName && mod.default) {
    deviceImageMap.set(modelName, mod.default);
    deviceImageMap.set(modelName.toLowerCase(), mod.default);
  }
}

// ── SVG: modelName → Promise resolving to raw SVG text ─────────────────────
const deviceSvgPromiseMap = new Map<string, () => Promise<{ default: string }>>();

// ── SVG content cache (resolved raw text → 재열기 시 즉시 반환) ──────────────
const svgContentCache = new Map<string, string>();
for (const [path, importFn] of Object.entries(svgRawModules)) {
  const filename = path.split("/").pop() ?? "";
  const modelName = filename.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "");
  if (modelName) {
    deviceSvgPromiseMap.set(modelName, importFn);
    deviceSvgPromiseMap.set(modelName.toLowerCase(), importFn);
  }
}

/**
 * Resolve a device PNG image URL from modelName.
 * Returns the Vite-resolved asset URL or undefined if not found.
 */
export const resolveDeviceImage = (modelName?: string): string | undefined => {
  if (!modelName) return undefined;
  
  // 1. Try to find PNG URL
  return deviceImageMap.get(modelName) ?? deviceImageMap.get(modelName.toLowerCase());
};

/**
 * Resolve a device SVG raw text content from modelName.
 * Returns a Promise that resolves to the inline SVG string, or undefined.
 */
export const resolveDeviceSvgContent = async (modelName?: string): Promise<string | undefined> => {
  if (!modelName) return undefined;

  // 캐시 히트 시 즉시 반환 (동적 import 스킵)
  const cacheKey = modelName.toLowerCase();
  const cached = svgContentCache.get(cacheKey);
  if (cached) return cached;

  const importFn = deviceSvgPromiseMap.get(modelName) ?? deviceSvgPromiseMap.get(cacheKey);
  if (importFn) {
    try {
      const mod = await importFn();
      svgContentCache.set(cacheKey, mod.default);
      return mod.default;
    } catch (err) {
      console.error("Failed to load SVG for model:", modelName, err);
      return undefined;
    }
  }
  return undefined;
};

/**
 * Check if a device SVG asset exists for the given modelName synchronously.
 */
export const hasDeviceSvgAsset = (modelName?: string): boolean => {
  if (!modelName) return false;
  return deviceSvgPromiseMap.has(modelName) || deviceSvgPromiseMap.has(modelName.toLowerCase());
};

/** Get all available model image entries (for debugging) */
export const getAvailableModelImages = (): string[] => {
  const combined = new Set<string>([
    ...Array.from(deviceImageMap.keys()),
    ...Array.from(deviceSvgPromiseMap.keys()),
  ]);
  return Array.from(combined).filter(
    (k) =>
      k !== k.toLowerCase() ||
      !combined.has(k.charAt(0).toUpperCase() + k.slice(1))
  );
};
