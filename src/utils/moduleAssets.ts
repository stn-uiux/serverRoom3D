/**
 * Module Asset Resolver
 *
 * 포트에 삽입 가능한 모듈(Ethernet, SFP) SVG 에셋을 관리.
 * Vite import.meta.glob으로 동적 로드.
 */

import type { ModuleDefinition, ModuleType } from "../types/equipment";

// ── 모듈 SVG: img 태그용 URL (eager) ──────────────────────────────────
const moduleUrlModules = import.meta.glob<{ default: string }>(
  ["../assets/Ethernet.svg", "../assets/sfp.svg"],
  { eager: true },
);

// ── 모듈 SVG: raw text (인라인 렌더링용) ──────────────────────────────
const moduleRawModules = import.meta.glob<{ default: string }>(
  ["../assets/Ethernet.svg", "../assets/sfp.svg"],
  { query: "?raw" },
);

// ── 파일명→URL 맵 빌드 ─────────────────────────────────────────────────
const _moduleUrlMap = new Map<string, string>();
const _moduleRawMap = new Map<string, () => Promise<{ default: string }>>();

for (const [path, mod] of Object.entries(moduleUrlModules)) {
  const fn = path.split("/").pop() ?? "";
  _moduleUrlMap.set(fn, mod.default);
}

for (const [path, importFn] of Object.entries(moduleRawModules)) {
  const fn = path.split("/").pop() ?? "";
  _moduleRawMap.set(fn, importFn);
}

// ── 모듈 정의 ────────────────────────────────────────────────────────────
export const moduleDefinitions: ModuleDefinition[] = [
  {
    moduleType: "ethernet",
    displayName: "Ethernet",
    svgFileName: "Ethernet.svg",
    svgUrl: _moduleUrlMap.get("Ethernet.svg") || "",
  },
  {
    moduleType: "sfp",
    displayName: "SFP",
    svgFileName: "sfp.svg",
    svgUrl: _moduleUrlMap.get("sfp.svg") || "",
  },
];

// ── 모듈 SVG raw 캐시 ─────────────────────────────────────────────────
const _moduleSvgRawCache = new Map<string, string>();

/**
 * 모듈 SVG raw text 비동기 로드
 */
export async function loadModuleSvgRaw(
  svgFileName: string,
): Promise<string | undefined> {
  const cached = _moduleSvgRawCache.get(svgFileName);
  if (cached) return cached;

  const importFn = _moduleRawMap.get(svgFileName);
  if (importFn) {
    try {
      const mod = await importFn();
      _moduleSvgRawCache.set(svgFileName, mod.default);
      return mod.default;
    } catch (err) {
      console.error("Failed to load module SVG:", svgFileName, err);
      return undefined;
    }
  }
  return undefined;
}

/**
 * 모듈 SVG raw text 동기 캐시 조회
 */
export function loadModuleSvgRawSync(
  svgFileName: string,
): string | undefined {
  return _moduleSvgRawCache.get(svgFileName);
}

/**
 * 모듈 타입으로 모듈 정의 조회
 */
export function getModuleDefinition(
  moduleType: ModuleType,
): ModuleDefinition | undefined {
  return moduleDefinitions.find((m) => m.moduleType === moduleType);
}

/**
 * 모듈 SVG URL 조회 (img 태그용)
 */
export function getModuleSvgUrl(svgFileName: string): string | undefined {
  return _moduleUrlMap.get(svgFileName);
}
