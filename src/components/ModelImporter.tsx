import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import type { ImportedModel, WallParams, PartitionParams, LightParams } from "../types";
import {
  BUILTIN_MODELS,
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
  DEFAULT_LIGHT_PARAMS,
} from "../utils/builtinModels";
import type { BuiltinModelDef } from "../utils/builtinModels";
import {
  exportModels,
  readModelExportFile,
  getImportPreview,
  deserializeModels,
  type ModelExportPackage,
  type ImportPreview,
} from "../utils/modelStorage";
import { HierarchyTree } from "./HierarchyTree";
import { PlusIcon } from "./Icons";

/** Read a File as a base64 data URL */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isValidExtension = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.endsWith(".glb") || lower.endsWith(".gltf");
};

import "./ModelImporter.css";

export const ModelImporter = () => {
  const isEditMode = useStore((s) => s.isEditMode);
  const addImportedModel = useStore((s) => s.addImportedModel);
  const importedModels = useStore((s) => s.importedModels);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const selectModel = useStore((s) => s.selectModel);
  const deleteModel = useStore((s) => s.deleteModel);
  const updateModel = useStore((s) => s.updateModel);
  const toggleModelMove = useStore((s) => s.toggleModelMove);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Model export/import state
  const modelImportRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importPkg, setImportPkg] = useState<ModelExportPackage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportModels = useCallback(async () => {
    if (importedModels.length === 0) {
      setError("No models to export.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      await exportModels(importedModels);
      setSuccessMsg(`Exported ${importedModels.length} model(s)`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setError(null), 4000);
    }
  }, [importedModels]);

  const handleModelImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (modelImportRef.current) modelImportRef.current.value = "";
      if (!file) return;
      try {
        setImportError(null);
        const pkg = await readModelExportFile(file);
        const preview = getImportPreview(pkg);
        setImportPkg(pkg);
        setImportPreview(preview);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleConfirmImport = useCallback(() => {
    if (!importPkg) return;
    setIsImporting(true);
    try {
      const models = deserializeModels(importPkg);
      for (const m of models) {
        addImportedModel(m);
      }
      setSuccessMsg(`Imported ${models.length} model(s)`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsImporting(false);
      setImportPkg(null);
      setImportPreview(null);
    }
  }, [importPkg, addImportedModel]);

  const handleCancelImport = useCallback(() => {
    setImportPkg(null);
    setImportPreview(null);
    setImportError(null);
  }, []);

  /** Add a built-in default model to the scene */
  const handleAddBuiltin = useCallback(
    (def: BuiltinModelDef) => {
      if (def.type === "Wall") {
        addImportedModel({
          name: "Wall",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Wall",
          wallParams: { ...DEFAULT_WALL_PARAMS },
        });
      } else if (def.type === "Partition") {
        addImportedModel({
          name: "Partition",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Partition",
          partitionParams: { ...DEFAULT_PARTITION_PARAMS },
        });
      } else if (def.type === "Clock") {
        addImportedModel({
          name: "Clock",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Clock",
        });
      } else if (def.type === "Light") {
        addImportedModel({
          name: "Light",
          fileName: def.fileName,
          dataUrl: "",
          position: [5, 10, 5],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Light",
          lightParams: { ...DEFAULT_LIGHT_PARAMS },
        });
      } else {
        addImportedModel({
          name: def.label,
          fileName: def.fileName,
          dataUrl: def.assetUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: def.type,
        });
      }
    },
    [addImportedModel],
  );

  const selectedModel = importedModels.find((m) => m.id === selectedModelId);

  const handleImport = useCallback(
    async (file: File) => {
      if (!isValidExtension(file.name)) {
        setError("Unsupported format. Use .glb or .gltf only.");
        setTimeout(() => setError(null), 4000);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const dataUrl = await fileToDataUrl(file);
        const baseName = file.name.replace(/\.(glb|gltf)$/i, "");

        addImportedModel({
          name: baseName,
          fileName: file.name,
          dataUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
        });
      } catch {
        setError("Failed to read file.");
        setTimeout(() => setError(null), 4000);
      } finally {
        setIsLoading(false);
      }
    },
    [addImportedModel],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImport(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleImport],
  );

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files") && isEditMode) {
        setIsDragOver(true);
      }
    };
    window.addEventListener("dragenter", handleDragEnter);
    return () => window.removeEventListener("dragenter", handleDragEnter);
  }, [isEditMode]);

  // Use conditional rendering block inside rather than early return
  // so that Hierarchy (which is now docked here) remains visible in normal mode.

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <input
        ref={modelImportRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleModelImportFile}
      />

      <div
        style={{
          position: "absolute",
          top: "76px",
          left: "12px",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "300px",
          maxHeight: "calc(100vh - 90px)",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto", width: "300px", flexShrink: 0 }}>
          <HierarchyTree />
        </div>

        {/* Import Action Card and Other Edit-mode Panels */}
        {isEditMode && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              pointerEvents: "auto",
              width: "300px",
              flexShrink: 0,
            }}
          >
            <div
              className="grafana-panel"
              style={{
                padding: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  style={{ width: "100%" }}
                >
                  {isLoading ? <span className="spinner-mini" /> : <PlusIcon />}
                  Add New Asset
                </button>

                {/* Project Persistence (Save / Load Data) */}
                <div
                  style={{
                    background: "rgba(128, 128, 128, 0.1)",
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-weak)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      display: "block",
                      marginBottom: "10px",
                      opacity: 0.8,
                    }}
                  >
                    Project Data
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="grafana-btn grafana-btn-md grafana-btn-secondary"
                      style={{
                        flex: 1,
                        background:
                          importedModels.length > 0
                            ? "rgba(128, 128, 128, 0.2)"
                            : "transparent",
                        color:
                          importedModels.length > 0
                            ? "var(--text-primary)"
                            : "var(--text-disabled)",
                        borderColor:
                          importedModels.length > 0
                            ? "var(--border-medium)"
                            : "var(--border-weak)",
                      }}
                      disabled={importedModels.length === 0}
                      onClick={handleExportModels}
                    >
                      <span role="img" aria-label="save">
                        💾
                      </span>
                      Save
                    </button>
                    <button
                      className="grafana-btn grafana-btn-md grafana-btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => modelImportRef.current?.click()}
                    >
                      <span role="img" aria-label="load">
                        📂
                      </span>
                      Load
                    </button>
                  </div>

                  {(successMsg || error || importError) && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "10px",
                        color: error || importError ? "#ef4444" : "#22c55e",
                        fontWeight: 500,
                        textAlign: "center",
                        padding: "6px",
                        background:
                          error || importError
                            ? "rgba(239, 68, 68, 0.05)"
                            : "rgba(34, 197, 94, 0.05)",
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor:
                          error || importError
                            ? "rgba(239, 68, 68, 0.1)"
                            : "rgba(34, 197, 94, 0.1)",
                      }}
                    >
                      {(error || importError || successMsg)
                        ?.replace("Exported", "Saved")
                        .replace("Import", "Load")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Default Models Palette */}
            <div
              className="grafana-panel"
              style={{
                padding: "12px 16px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: "10px",
                }}
              >
                Default Models
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {BUILTIN_MODELS.map((def) => (
                  <button
                    key={def.type}
                    className="grafana-btn grafana-btn-md grafana-btn-secondary"
                    style={{ width: "100%" }}
                    onClick={() => handleAddBuiltin(def)}
                  >
                    <span role="img" aria-label={def.label}>
                      {def.emoji}
                    </span>
                    {def.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Models List Section */}
            {importedModels.length > 0 && (
              <div
                className="grafana-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  maxHeight: "260px",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(128, 128, 128, 0.1)",
                    borderBottom: "1px solid var(--border-weak)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Scene Objects ({importedModels.length})
                  </span>
                </div>

                <div
                  style={{
                    padding: "8px",
                    overflowY: "auto",
                  }}
                >
                  {importedModels.map((m) => {
                    const isSelected = selectedModelId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() =>
                          selectModel(selectedModelId === m.id ? null : m.id)
                        }
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--selected-bg)"
                            : "transparent",
                          border: "1px solid",
                          borderColor: isSelected
                            ? "var(--theme-primary)"
                            : "transparent",
                          marginBottom: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: isSelected
                              ? "var(--theme-primary)"
                              : "var(--text-disabled)",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: isSelected ? 600 : 400,
                            color: isSelected
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.name}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            style={{
                              background: m.isMoveEnabled
                                ? "rgba(34, 197, 94, 0.1)"
                                : "rgba(249, 115, 22, 0.08)",
                              color: m.isMoveEnabled ? "#22c55e" : "#f97316",
                              border: "1px solid",
                              borderColor: m.isMoveEnabled
                                ? "rgba(34, 197, 94, 0.2)"
                                : "rgba(249, 115, 22, 0.2)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "10px",
                              cursor: "pointer",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleModelMove(m.id);
                            }}
                          >
                            {m.isMoveEnabled ? "🔓" : "🔒"}
                          </button>
                          <button
                            style={{
                              background: "transparent",
                              color: "var(--text-tertiary)",
                              border: "none",
                              fontSize: "14px",
                              padding: "0 4px",
                              cursor: "pointer",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteModel(m.id);
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.color = "#ef4444")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.color =
                                "var(--text-tertiary)")
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Properties Section — positioned right next to the left panel */}
      {isEditMode && selectedModel && (
        <div
          style={{
            position: "absolute",
            top: "76px",
            left: "324px",
            zIndex: 100,
            width: "300px",
            maxHeight: "calc(100vh - 160px)",
            overflowY: "auto",
          }}
        >
          <ModelProperties
            model={selectedModel}
            onUpdate={(updates) => updateModel(selectedModel.id, updates)}
            onDelete={() => deleteModel(selectedModel.id)}
          />
        </div>
      )}

      {isEditMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: isDragOver ? 1000 : -1,
            pointerEvents: isDragOver ? "auto" : "none",
            background: isDragOver ? "rgba(79, 70, 229, 0.08)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backdropFilter: isDragOver ? "blur(4px)" : "none",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleImport(file);
          }}
        >
          {isDragOver && (
            <div
              style={{
                padding: "48px",
                borderRadius: "24px",
                border: "2px dashed #4f46e5",
                boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
                textAlign: "center",
                transform: "scale(1.05)",
                animation: "pulse 2s infinite",
              }}
            >
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>📦</div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Ready to Import
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginTop: "8px",
                }}
              >
                Drop your GLB or GLTF file to add it
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && importPkg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleCancelImport}
        >
          <div
            className="grafana-panel"
            style={{
              width: "420px",
              maxHeight: "80vh",
              padding: "28px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
              border: "1px solid var(--border-medium)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📥 Import Preview
            </h3>

            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {[
                {
                  label: "Total",
                  value: importPreview.totalCount,
                  color: "#6366f1",
                },
                {
                  label: "Built-in",
                  value: importPreview.builtinCount + importPreview.wallCount,
                  color: "#06b6d4",
                },
                {
                  label: "Imported",
                  value: importPreview.importedCount,
                  color: "#f59e0b",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    padding: "12px",
                    background: "rgba(128, 128, 128, 0.1)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                    border: "1px solid var(--border-weak)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      color: stat.color,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      marginTop: "4px",
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Model list */}
            <div
              style={{
                marginBottom: "20px",
                maxHeight: "200px",
                overflowY: "auto",
                padding: "8px 12px",
                background: "rgba(128, 128, 128, 0.1)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-weak)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Models to import
              </div>
              {importPreview.modelNames.map((name, idx) => {
                const m = importPkg.models[idx];
                const icon =
                  m.builtinType === "Wall"
                    ? "🧱"
                    : m.builtinType === "Partition"
                      ? "🪟"
                      : m.builtinType === "Chair"
                        ? "🪑"
                        : m.builtinType === "Desk"
                          ? "🖥️"
                          : m.builtinType === "Desk2"
                            ? "📐"
                            : m.builtinType === "Light"
                              ? "💡"
                              : "📦";
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "6px 0",
                      borderBottom:
                        idx < importPreview.modelNames.length - 1
                          ? "1px solid var(--border-weak)"
                          : "none",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{icon}</span>
                    <span style={{ flex: 1 }}>{name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: m.isMoveEnabled
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(249,115,22,0.08)",
                        color: m.isMoveEnabled ? "#16a34a" : "#f97316",
                      }}
                    >
                      {m.isMoveEnabled ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Schema info */}
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-tertiary)",
                marginBottom: "20px",
              }}
            >
              Schema v{importPkg.schemaVersion} · exported{" "}
              {new Date(importPkg.exportedAt).toLocaleString()}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="grafana-btn"
                style={{
                  flex: 1,
                  height: "40px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "linear-gradient(to bottom, #4f46e5, #4338ca)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: isImporting ? "wait" : "pointer",
                  boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
                }}
                disabled={isImporting}
                onClick={handleConfirmImport}
              >
                {isImporting
                  ? "Importing..."
                  : `Import ${importPreview.totalCount} Model(s)`}
              </button>
              <button
                className="grafana-btn"
                style={{
                  height: "40px",
                  padding: "0 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "rgba(128, 128, 128, 0.1)",
                  border: "1px solid var(--border-medium)",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-md)",
                }}
                onClick={handleCancelImport}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface ModelPropertiesProps {
  model: ImportedModel;
  onUpdate: (updates: Partial<Omit<ImportedModel, "id">>) => void;
  onDelete: () => void;
}

/** Helper to update a single wall param field */
const updateWallParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof WallParams,
  value: number | string,
) => {
  const current = model.wallParams ?? DEFAULT_WALL_PARAMS;
  onUpdate({ wallParams: { ...current, [field]: value } });
};

/** Helper to update a single partition param field */
const updatePartitionParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof PartitionParams,
  value: any,
) => {
  const current = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
  onUpdate({ partitionParams: { ...current, [field]: value } });
};

/** Helper to update a single light param field */
const updateLightParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof LightParams,
  value: number | string | boolean,
) => {
  const current = model.lightParams ?? DEFAULT_LIGHT_PARAMS;
  onUpdate({ lightParams: { ...current, [field]: value } });
};

const ModelProperties = ({
  model,
  onUpdate,
  onDelete,
}: ModelPropertiesProps) => {

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 0.1,
  ) => (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}
    >
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        {label}
      </span>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: "100%",
          padding: "6px 4px",
          fontSize: "11px",
          background: "rgba(128, 128, 128, 0.1)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          textAlign: "center",
          outline: "none",
        }}
      />
    </div>
  );

  const vec3Block = (
    label: string,
    values: [number, number, number],
    onChange: (v: [number, number, number]) => void,
    step = 0.1,
  ) => (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: "8px",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
        {numInput(
          "X",
          values[0],
          (v) => onChange([v, values[1], values[2]]),
          step,
        )}
        {numInput(
          "Y",
          values[1],
          (v) => onChange([values[0], v, values[2]]),
          step,
        )}
        {numInput(
          "Z",
          values[2],
          (v) => onChange([values[0], values[1], v]),
          step,
        )}
      </div>
    </div>
  );

  return (
    <div
      className="grafana-panel"
      style={{
        padding: "20px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        border: "1px solid var(--border-weak)",
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          value={model.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Model Name"
          style={{
            width: "100%",
            padding: "8px 0",
            fontSize: "18px",
            fontWeight: 700,
            background: "transparent",
            border: "none",
            borderBottom: "2px solid var(--border-weak)",
            color: "var(--text-primary)",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--theme-primary)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--border-weak)")
          }
        />
      </div>

      {vec3Block("Position", model.position, (v) => onUpdate({ position: v }))}
      {vec3Block(
        "Rotation (°)",
        [
          (model.rotation[0] * 180) / Math.PI,
          (model.rotation[1] * 180) / Math.PI,
          (model.rotation[2] * 180) / Math.PI,
        ],
        (v) =>
          onUpdate({
            rotation: [
              (v[0] * Math.PI) / 180,
              (v[1] * Math.PI) / 180,
              (v[2] * Math.PI) / 180,
            ],
          }),
        15,
      )}
      {vec3Block("Scale", model.scale, (v) => onUpdate({ scale: v }), 0.1)}

      {/* Wall-specific parametric controls */}
      {model.builtinType === "Wall" &&
        (() => {
          const wp = model.wallParams ?? DEFAULT_WALL_PARAMS;
          return (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                Wall Parameters
              </label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                {numInput(
                  "Height",
                  wp.height,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "height",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Length",
                  wp.length,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "length",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Thick",
                  wp.thickness,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "thickness",
                      Math.max(0.01, v),
                    ),
                  0.05,
                )}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                  }}
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={wp.color}
                  onChange={(e) =>
                    updateWallParam(model, onUpdate, "color", e.target.value)
                  }
                  style={{
                    width: "32px",
                    height: "24px",
                    padding: 0,
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <span
                  style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
                >
                  {wp.color}
                </span>
              </div>
            </div>
          );
        })()}

      {/* Partition-specific parametric controls */}
      {model.builtinType === "Partition" &&
        (() => {
          const pp = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
          const isTransparent = pp.visibilityMode === "transparent";

          return (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                Partition Parameters
              </label>
              <div
                style={{ display: "flex", gap: "8px", marginBottom: "12px" }}
              >
                {numInput(
                  "Height",
                  pp.height,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "height",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Length",
                  pp.length,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "length",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Thick",
                  pp.thickness,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "thickness",
                      Math.max(0.01, v),
                    ),
                  0.05,
                )}
              </div>

              {/* Transparency Toggle */}
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Transparency
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() =>
                      updatePartitionParam(
                        model,
                        onUpdate,
                        "visibilityMode",
                        "transparent",
                      )
                    }
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: isTransparent
                        ? "var(--selected-bg)"
                        : "rgba(128, 128, 128, 0.1)",
                      color: isTransparent
                        ? "var(--theme-primary)"
                        : "var(--text-secondary)",
                      border: "1px solid",
                      borderColor: isTransparent
                        ? "var(--theme-primary)"
                        : "var(--border-medium)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    반투명
                  </button>
                  <button
                    onClick={() =>
                      updatePartitionParam(
                        model,
                        onUpdate,
                        "visibilityMode",
                        "opaque",
                      )
                    }
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: !isTransparent
                        ? "var(--selected-bg)"
                        : "rgba(128, 128, 128, 0.1)",
                      color: !isTransparent
                        ? "var(--theme-primary)"
                        : "var(--text-secondary)",
                      border: "1px solid",
                      borderColor: !isTransparent
                        ? "var(--theme-primary)"
                        : "var(--border-medium)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    불투명
                  </button>
                </div>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                  }}
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={pp.color}
                  onChange={(e) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "color",
                      e.target.value,
                    )
                  }
                  style={{
                    width: "32px",
                    height: "24px",
                    padding: 0,
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <span
                  style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
                >
                  {pp.color}
                </span>
              </div>
            </div>
          );
        })()}

      {/* Light-specific parametric controls */}
      {model.builtinType === "Light" &&
        (() => {
          const lp = model.lightParams ?? DEFAULT_LIGHT_PARAMS;
          return (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                Light Parameters
              </label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {numInput(
                  "Intensity",
                  lp.intensity,
                  (v) =>
                    updateLightParam(
                      model,
                      onUpdate,
                      "intensity",
                      Math.max(0, v),
                    ),
                  0.1,
                )}
                {numInput(
                  "Shadow Res",
                  lp.shadowMapSize,
                  (v) => {
                    const clamped = Math.min(4096, Math.max(256, v));
                    updateLightParam(
                      model,
                      onUpdate,
                      "shadowMapSize",
                      clamped,
                    );
                  },
                  256,
                )}
              </div>

              {/* Shadow Toggle */}
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Shadow
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() =>
                      updateLightParam(model, onUpdate, "castShadow", true)
                    }
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: lp.castShadow
                        ? "var(--selected-bg)"
                        : "rgba(128, 128, 128, 0.1)",
                      color: lp.castShadow
                        ? "var(--theme-primary)"
                        : "var(--text-secondary)",
                      border: "1px solid",
                      borderColor: lp.castShadow
                        ? "var(--theme-primary)"
                        : "var(--border-medium)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    ON
                  </button>
                  <button
                    onClick={() =>
                      updateLightParam(model, onUpdate, "castShadow", false)
                    }
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: !lp.castShadow
                        ? "var(--selected-bg)"
                        : "rgba(128, 128, 128, 0.1)",
                      color: !lp.castShadow
                        ? "var(--theme-primary)"
                        : "var(--text-secondary)",
                      border: "1px solid",
                      borderColor: !lp.castShadow
                        ? "var(--theme-primary)"
                        : "var(--border-medium)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Color picker */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                  }}
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={lp.color}
                  onChange={(e) =>
                    updateLightParam(model, onUpdate, "color", e.target.value)
                  }
                  style={{
                    width: "32px",
                    height: "24px",
                    padding: 0,
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <span
                  style={{ fontSize: "11px", color: "var(--text-tertiary)" }}
                >
                  {lp.color}
                </span>
              </div>
            </div>
          );
        })()}

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          className="grafana-btn"
          style={{
            width: "100%",
            height: "36px",
            fontSize: "12px",
            fontWeight: 600,
            background: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(249, 115, 22, 0.08)",
            color: model.isMoveEnabled ? "#16a34a" : "#ea580c",
            border: "1px solid",
            borderColor: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(249, 115, 22, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onClick={() => useStore.getState().toggleModelMove(model.id)}
        >
          {model.isMoveEnabled ? "🔓 Move Enabled" : "🔒 Move Locked"}
        </button>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="grafana-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "rgba(128, 128, 128, 0.1)",
              border: "1px solid var(--border-medium)",
              color: "var(--text-primary)",
            }}
            onClick={() => {
              const { addImportedModel } = useStore.getState();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, ...modelData } = model;
              addImportedModel({
                ...modelData,
                name: `${modelData.name} (copy)`,
                position: [
                  modelData.position[0] + 0.5,
                  modelData.position[1],
                  modelData.position[2] + 0.5,
                ],
              });
            }}
          >
            Duplicate
          </button>
          <button
            className="grafana-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
            }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>


      </div>
    </div>
  );
};
