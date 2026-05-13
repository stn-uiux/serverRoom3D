/**
 * 3D Model Export / Import utilities
 *
 * Export format (JSON):
 * {
 *   schemaVersion: 1,
 *   exportedAt: ISO string,
 *   models: SerializedModel[]
 * }
 *
 * For built-in models, dataUrl is omitted (reconstructed on import).
 * For imported GLBs, the full base64 dataUrl is included.
 */

import type {
  ImportedModel,
  BuiltinModelType,
  WallParams,
  PartitionParams,
  LightParams,
} from "../types";
import {
  BUILTIN_MODELS,
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
  DEFAULT_LIGHT_PARAMS,
} from "./builtinModels";

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

/** Serialized model in export file */
export interface SerializedModel {
  /** Original model ID (may be re-assigned on import) */
  originalId: string;
  name: string;
  fileName: string;
  /** base64 data URL — only for user-imported models; empty for built-in */
  dataUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  isMoveEnabled: boolean;
  builtinType?: BuiltinModelType;
  wallParams?: WallParams;
  partitionParams?: PartitionParams;
  lightParams?: LightParams;
}

export interface ModelExportPackage {
  schemaVersion: number;
  exportedAt: string;
  models: SerializedModel[];
}

export interface ImportPreview {
  totalCount: number;
  builtinCount: number;
  importedCount: number;
  wallCount: number;
  partitionCount: number;
  modelNames: string[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

/** Serialize ImportedModel[] → downloadable JSON */
export async function exportModels(models: ImportedModel[]): Promise<void> {
  if (models.length === 0) return;

  const serialized: SerializedModel[] = models.map((m) => {
    const isBuiltin = !!m.builtinType;
    return {
      originalId: m.id,
      name: m.name,
      fileName: m.fileName,
      // Skip large base64 payloads for built-in models
      dataUrl: isBuiltin ? "" : m.dataUrl,
      position: [...m.position] as [number, number, number],
      rotation: [...m.rotation] as [number, number, number],
      scale: [...m.scale] as [number, number, number],
      isMoveEnabled: m.isMoveEnabled ?? false,
      builtinType: m.builtinType,
      wallParams: m.wallParams ? { ...m.wallParams } : undefined,
      partitionParams: m.partitionParams ? { ...m.partitionParams } : undefined,
      lightParams: m.lightParams ? { ...m.lightParams } : undefined,
    };
  });

  const pkg: ModelExportPackage = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    models: serialized,
  };

  const json = JSON.stringify(pkg, null, 2);
  const fileName = `3d-models-${Date.now()}.json`;
  const blob = new Blob([json], { type: "application/json" });

  // Try File System Access API first (shows native save dialog)
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "JSON Files",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      // User cancelled the dialog — don't fall through to anchor
      if (e?.name === "AbortError") return;
      // Other error — fall through to anchor method
    }
  }

  // Fallback: anchor download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 3000);
}

// ─── Import ──────────────────────────────────────────────────────────────────

/** Read and validate a JSON file, returning the parsed package */
export function readModelExportFile(file: File): Promise<ModelExportPackage> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      reject(new Error("Only .json files are supported."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const validated = validatePackage(raw);
        resolve(validated);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

/** Validate and migrate the export package */
function validatePackage(raw: unknown): ModelExportPackage {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid export file: not a JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  // Schema version check
  const version = Number(obj.schemaVersion);
  if (!version || version < 1) {
    throw new Error("Invalid export file: missing or invalid schemaVersion.");
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Export file uses schema v${version}, but this app only supports up to v${SCHEMA_VERSION}. Please update the app.`,
    );
  }

  // Models array check
  if (!Array.isArray(obj.models)) {
    throw new Error("Invalid export file: 'models' array not found.");
  }
  if (obj.models.length === 0) {
    throw new Error("Export file contains no models.");
  }

  // Validate each model
  for (let i = 0; i < obj.models.length; i++) {
    const m = obj.models[i] as Record<string, unknown>;
    if (!m.name || typeof m.name !== "string") {
      throw new Error(`Model at index ${i} has an invalid name.`);
    }
    if (!Array.isArray(m.position) || m.position.length !== 3) {
      throw new Error(`Model "${m.name}" has an invalid position.`);
    }
    if (!Array.isArray(m.rotation) || m.rotation.length !== 3) {
      throw new Error(`Model "${m.name}" has an invalid rotation.`);
    }
    if (!Array.isArray(m.scale) || m.scale.length !== 3) {
      throw new Error(`Model "${m.name}" has an invalid scale.`);
    }
    // For non-built-in models, dataUrl is required
    if (!m.builtinType && (!m.dataUrl || typeof m.dataUrl !== "string")) {
      throw new Error(
        `Model "${m.name}" is not built-in but has no asset data (dataUrl). The export may be corrupted.`,
      );
    }
  }

  // v1 → current: no migration needed (v1 is current)
  return obj as unknown as ModelExportPackage;
}

/** Generate a preview summary from the parsed package */
export function getImportPreview(pkg: ModelExportPackage): ImportPreview {
  const models = pkg.models;
  return {
    totalCount: models.length,
    builtinCount: models.filter(
      (m) =>
        m.builtinType &&
        m.builtinType !== "Wall" &&
        m.builtinType !== "Partition",
    ).length,
    importedCount: models.filter((m) => !m.builtinType).length,
    wallCount: models.filter((m) => m.builtinType === "Wall").length,
    partitionCount: models.filter((m) => m.builtinType === "Partition").length,
    modelNames: models.map((m) => m.name),
  };
}

/** Convert serialized models → Omit<ImportedModel, 'id'>[] ready for addImportedModel */
export function deserializeModels(
  pkg: ModelExportPackage,
): Omit<ImportedModel, "id">[] {
  return pkg.models.map((m) => {
    // For built-in GLB models, reconstruct the public asset URL
    let dataUrl = m.dataUrl;
    if (m.builtinType && m.builtinType !== "Wall") {
      const def = BUILTIN_MODELS.find((b) => b.type === m.builtinType);
      if (def) {
        dataUrl = def.assetUrl;
      }
    }

    return {
      name: m.name,
      fileName: m.fileName,
      dataUrl,
      position: m.position,
      rotation: m.rotation,
      scale: m.scale,
      isMoveEnabled: m.isMoveEnabled,
      builtinType: m.builtinType,
      wallParams: m.wallParams
        ? { ...DEFAULT_WALL_PARAMS, ...m.wallParams }
        : undefined,
      partitionParams: m.partitionParams
        ? { ...DEFAULT_PARTITION_PARAMS, ...m.partitionParams }
        : undefined,
      lightParams: m.lightParams
        ? { ...DEFAULT_LIGHT_PARAMS, ...m.lightParams }
        : undefined,
    };
  });
}
