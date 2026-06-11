// ============================================================
// AdminPanel — DEV-only visual builder for composing 3D objects
// from Kenney building-kit + space-station-kit (и др. kit в каталоге).
// Click a part → ghost appears in scene → LMB places it →
// generate JSON to save the composition for later use.
// ============================================================

import { useState, useCallback, type FC } from "react";
import type { PortPlacementTemplate } from "../../buildings/buildingPortTypes.ts";
import type { BuilderMode } from "../../core/types.ts";
import {
  BUILDER_KIT_BASES,
  type BuilderKitId,
  type PartDef,
} from "./builderPartTypes.ts";
import { SPACE_STATION_BUILDER_PARTS } from "./spaceStationKitParts.ts";
import { useTranslation, type TranslateFn } from "../../i18n/I18nContext.tsx";
import "./AdminPanel.css";

const PORTS_CATEGORY = "ports";
const p = (name: string, label: string): PartDef => ({ name, label });

const BASE_BUILDER_PARTS: Record<string, PartDef[]> = {
  floor: [
    p("floor", "Floor"),
    p("floor-half", "Floor ½"),
    p("floor-quarter", "Floor ¼"),
    p("floor-corner-diagonal", "Corner diag."),
    p("floor-corner-round", "Corner round"),
  ],
  walls: [
    p("wall", "Wall"),
    p("wall-half", "Wall ½"),
    p("wall-low", "Low"),
    p("wall-corner", "Corner"),
    p("wall-corner-diagonal", "Corner diag."),
    p("wall-corner-round", "Corner round"),
    p("wall-corner-column", "Col. corner"),
    p("wall-corner-column-bottom", "Col. corner low"),
    p("wall-corner-column-small", "Col. sm."),
    p("wall-corner-column-small-bottom", "Col. sm. low"),
  ],
  windows: [
    p("wall-window-square", "Sq."),
    p("wall-window-square-detailed", "Sq. det."),
    p("wall-window-round", "Round"),
    p("wall-window-round-detailed", "Round det."),
    p("wall-window-wide-square", "Wide sq."),
    p("wall-window-wide-square-detailed", "Wide sq. det."),
    p("wall-window-wide-round", "Wide rnd."),
    p("wall-window-wide-round-detailed", "Wide rnd. det."),
  ],
  doors: [
    p("wall-doorway-square", "Sq. opening"),
    p("wall-doorway-wide-square", "Wide sq. opening"),
    p("wall-doorway-round", "Round opening"),
    p("wall-doorway-wide-round", "Wide rnd. opening"),
    p("door-rotate-square-a", "Door sq. A"),
    p("door-rotate-square-b", "Door sq. B"),
    p("door-rotate-square-c", "Door sq. C"),
    p("door-rotate-square-d", "Door sq. D"),
    p("door-rotate-round-a", "Door rnd. A"),
    p("door-rotate-round-b", "Door rnd. B"),
    p("door-rotate-round-c", "Door rnd. C"),
    p("door-rotate-round-d", "Door rnd. D"),
  ],
  roof: [
    p("roof-flat-center", "Center"),
    p("roof-flat-side", "Side"),
    p("roof-flat-corner", "Corner"),
    p("roof-flat-corner-inner", "Inner corner"),
    p("roof-flat-patch", "Patch"),
    p("roof-flat-patch-large", "Large patch"),
    p("roof-flat-square", "Square"),
  ],
  stairs: [
    p("stairs-open", "Open"),
    p("stairs-open-short", "Open short"),
    p("stairs-closed", "Closed"),
    p("stairs-closed-short", "Closed short"),
    p("stairs-center", "Center"),
    p("stairs-center-short", "Center short"),
    p("stairs-sides", "With sides"),
    p("stairs-sides-short", "Sides short"),
  ],
  columns: [
    p("column", "Column"),
    p("column-thin", "Thin"),
    p("column-wide", "Wide"),
  ],
  borders: [
    p("border", "Border"),
    p("border-corner", "Corner"),
    p("border-corner-diagonal", "Corner diag."),
    p("border-corner-round", "Corner round"),
    p("border-corner-small", "Corner sm."),
    p("border-high", "High"),
    p("border-high-corner", "High corner"),
    p("border-high-corner-diagonal", "High diag."),
    p("border-high-corner-round", "High round"),
    p("border-high-corner-small", "High sm."),
  ],
  details: [
    p("composition-detail_circle", "Circle (detail)"),
    p("composition-detail_vertical_pipe", "Vertical pipe"),
    p("plating", "Plating"),
    p("plating-wide", "Plating wide"),
    p("plating-detailed", "Plating det."),
    p("plating-detailed-wide", "Plating det. wide"),
    p("detail-pipe", "Pipe"),
    p("gutter-vertical", "Gutter"),
    p("gutter-vertical-bottom", "Gutter low"),
    p("gutter-vertical-short", "Gutter short"),
    p("gutter-vertical-top", "Gutter top"),
    p("gutter-vertical-wall", "Gutter wall"),
  ],
  barricades: [
    p("barricade-doorway-a", "Opening A"),
    p("barricade-doorway-b", "Opening B"),
    p("barricade-doorway-c", "Opening C"),
    p("barricade-window-a", "Window A"),
    p("barricade-window-b", "Window B"),
    p("barricade-window-c", "Window C"),
  ],
};

const BUILDER_PARTS: Record<string, PartDef[]> = {
  ...BASE_BUILDER_PARTS,
  ...SPACE_STATION_BUILDER_PARTS,
};

const PORT_BUILDER_PARTS: PartDef[] = [
  p("port:conveyor:input", "Belt input"),
  p("port:conveyor:output", "Belt output"),
  p("port:pipe:input", "Pipe input"),
  p("port:pipe:output", "Pipe output"),
];

function partLabel(t: TranslateFn, part: PartDef): string {
  const key = `admin.parts.${part.name}`;
  const translated = t(key);
  return translated !== key ? translated : part.label;
}

function categoryLabel(t: TranslateFn, catKey: string): string {
  const key = `admin.categories.${catKey}`;
  const translated = t(key);
  return translated !== key ? translated : catKey;
}

function parsePortPartName(name: string): PortPlacementTemplate | null {
  if (!name.startsWith("port:")) return null;
  const seg = name.split(":");
  if (seg.length < 3) return null;
  const kind = seg[1];
  const type = seg[2];
  if (kind !== "conveyor" && kind !== "pipe") return null;
  if (type !== "input" && type !== "output") return null;
  const tierRaw = seg[3];
  const pipeTier =
    kind === "pipe" && (tierRaw === "1" || tierRaw === "2")
      ? (Number(tierRaw) as 1 | 2)
      : undefined;
  return { kind, type, ...(pipeTier !== undefined ? { pipeTier } : {}) };
}

interface AdminPanelProps {
  isOpen: boolean;
  isBuilderActive: boolean;
  isDeconstructMode: boolean;
  placedCount: number;
  portCount: number;
  builderScale: number;
  builderMode: BuilderMode;
  onClose: () => void;
  onSelectPart: (partPath: string) => void;
  onSelectPort: (template: PortPlacementTemplate) => void;
  onSelectComposition?: (compositionId: string) => void | Promise<void>;
  onClearComposition: () => void;
  onExportRequest: () => string;
  onImportRequest: (json: string) => Promise<number>;
  onSetBuilderMode: (mode: BuilderMode) => void;
  onToggleDeconstructMode: () => void;
  onAdjustScale: (delta: number) => void;
}

export const AdminPanel: FC<AdminPanelProps> = ({
  isOpen,
  isBuilderActive,
  isDeconstructMode,
  placedCount,
  portCount,
  builderScale,
  builderMode,
  onClose,
  onSelectPart,
  onSelectPort,
  onSelectComposition,
  onClearComposition,
  onExportRequest,
  onImportRequest,
  onSetBuilderMode,
  onToggleDeconstructMode,
  onAdjustScale,
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState("floor");
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importInfo, setImportInfo] = useState("");
  const [copied, setCopied] = useState(false);

  const categories = Object.keys(BUILDER_PARTS);
  const currentParts =
    selectedCategory === PORTS_CATEGORY
      ? PORT_BUILDER_PARTS
      : (BUILDER_PARTS[selectedCategory] ?? []);

  const handleExport = useCallback(() => {
    let raw = "";
    try {
      raw = onExportRequest();
    } catch {
      raw = "";
    }
    // Всегда выставляем валидный JSON: пустая строка или невалидный вывод не должны попадать в файл
    if (!raw || typeof raw !== "string") {
      setExportJson('{\n  "parts": []\n}');
      return;
    }
    try {
      JSON.parse(raw);
      setExportJson(raw);
    } catch {
      setExportJson('{\n  "parts": []\n}');
    }
  }, [onExportRequest]);

  const handleCopy = useCallback(() => {
    if (!exportJson) return;
    navigator.clipboard.writeText(exportJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [exportJson]);

  const handleDownload = useCallback(() => {
    if (!exportJson) return;
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `composition-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJson]);

  const handleClear = useCallback(() => {
    onClearComposition();
    setExportJson("");
  }, [onClearComposition]);

  const handleImport = useCallback(async () => {
    const count = await onImportRequest(importJson);
    setImportInfo(
      count > 0
        ? t("admin.importOk", { count })
        : t("admin.importFail"),
    );
  }, [importJson, onImportRequest]);

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <span className="admin-title">👑 {t("admin.title")}</span>
          {isBuilderActive && (
            <span className="admin-builder-hint">{t("admin.builderHint")}</span>
          )}
          <button className="admin-close-btn" onClick={onClose} aria-label={t("admin.close")}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="admin-body">
          {/* Left: category list */}
          <div className="admin-categories">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`admin-cat-btn${selectedCategory === cat ? " active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {categoryLabel(t, cat)}
              </button>
            ))}
            <button
              className={`admin-cat-btn${selectedCategory === PORTS_CATEGORY ? " active" : ""}`}
              onClick={() => setSelectedCategory(PORTS_CATEGORY)}
            >
              {t("admin.portsCategory")}
            </button>
          </div>

          {/* Center: parts grid */}
          <div className="admin-parts-grid">
            {currentParts.map((part) => {
              const isComposition = part.name.startsWith("composition-");
              const compositionId = isComposition
                ? part.name.replace("composition-", "")
                : null;
              const portTemplate = parsePortPartName(part.name);
              const isPort = portTemplate !== null;
              const kit: BuilderKitId = part.kit ?? "building";
              const kitBases = BUILDER_KIT_BASES[kit];
              return (
                <button
                  key={isPort ? part.name : `${kit}-${part.name}`}
                  className={`admin-part-item${isComposition ? " admin-part-composition" : ""}${isPort ? " admin-part-port" : ""}`}
                  title={part.name}
                  onClick={() => {
                    if (isComposition && compositionId && onSelectComposition) {
                      onSelectComposition(compositionId);
                      onClose();
                    } else if (portTemplate) {
                      onSelectPort(portTemplate);
                      onClose();
                    } else if (!isComposition) {
                      onSelectPart(`${kitBases.model}/${part.name}.glb`);
                      onClose();
                    }
                  }}
                >
                  {isComposition ? (
                    <span
                      className="admin-part-composition-icon"
                      title={partLabel(t, part)}
                    >
                      ⭕
                    </span>
                  ) : isPort ? (
                    <span className="admin-part-port-icon" title={partLabel(t, part)}>
                      {portTemplate.type === "input" ? "⬇" : "⬆"}
                    </span>
                  ) : (
                    <img
                      src={`${kitBases.preview}/${part.name}.png`}
                      alt={partLabel(t, part)}
                      className="admin-part-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.25";
                      }}
                    />
                  )}
                  <span className="admin-part-label">{partLabel(t, part)}</span>
                </button>
              );
            })}
          </div>

          {/* Right: composition panel */}
          <div className="admin-composition">
            <div className="admin-comp-title">{t("admin.composition")}</div>

            <div className="admin-comp-stat">
              {t("admin.partsLabel")}: <strong>{placedCount}</strong>
            </div>
            <div className="admin-comp-stat">
              {t("admin.portsLabel")}: <strong>{portCount}</strong>
            </div>
            <div className="admin-comp-stat">
              {t("admin.scale")}: <strong>{builderScale.toFixed(2)}x</strong>
            </div>
            <div className="admin-comp-stat">
              {t("admin.mode")}:{" "}
              <strong>{t(`builderMode.${builderMode}`)}</strong>
            </div>
            <div className="admin-comp-stat">
              {t("admin.deconstruct")}:{" "}
              <strong>{isDeconstructMode ? t("common.on") : t("common.off")}</strong>
            </div>

            <div className="admin-btn-row">
              <button
                type="button"
                className="admin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustScale(-0.1);
                }}
              >
                −
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustScale(0.1);
                }}
              >
                +
              </button>
            </div>
            <div className="admin-btn-row">
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("single")}
              >
                {t("builderMode.single")}
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("default")}
              >
                {t("builderMode.default")}
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("chord")}
              >
                {t("builderMode.chord")}
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("curve")}
              >
                {t("builderMode.curve")}
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("free")}
              >
                {t("builderMode.free")}
              </button>
            </div>
            <button className="admin-btn" onClick={onToggleDeconstructMode}>
              {isDeconstructMode
                ? `🟥 ${t("admin.deconstructDisable")}`
                : `🛠 ${t("admin.deconstructEnable")}`}
            </button>

            <div className="admin-comp-hint">{t("admin.generateJsonHint")}</div>

            <button
              className="admin-btn admin-btn-export"
              onClick={handleExport}
              disabled={placedCount === 0}
            >
              📄 {t("admin.generateJson")}
            </button>

            {exportJson && (
              <>
                <textarea
                  className="admin-json-area"
                  readOnly
                  value={exportJson}
                  rows={10}
                  spellCheck={false}
                />
                <div className="admin-btn-row">
                  <button className="admin-btn" onClick={handleCopy}>
                    {copied ? `✅ ${t("admin.copied")}` : `📋 ${t("admin.copy")}`}
                  </button>
                  <button className="admin-btn" onClick={handleDownload}>
                    ⬇ {t("admin.download")}
                  </button>
                </div>
              </>
            )}

            <textarea
              className="admin-json-area"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={7}
              placeholder={t("admin.importPlaceholder")}
              spellCheck={false}
            />
            <button className="admin-btn" onClick={handleImport}>
              📥 {t("admin.importToScene")}
            </button>
            {importInfo && <div className="admin-comp-hint">{importInfo}</div>}

            <button
              className="admin-btn admin-btn-danger"
              onClick={handleClear}
              disabled={placedCount === 0}
            >
              🗑 {t("admin.clearComposition")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
