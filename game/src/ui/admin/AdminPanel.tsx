// ============================================================
// AdminPanel — DEV-only visual builder for composing 3D objects
// from Kenney building-kit + space-station-kit (и др. kit в каталоге).
// Click a part → ghost appears in scene → LMB places it →
// generate JSON to save the composition for later use.
// ============================================================

import { useState, useCallback, type FC } from "react";
import type { BuilderMode } from "../../core/types.ts";
import { BUILDER_MODE_LABELS } from "../../core/types.ts";
import {
  BUILDER_KIT_BASES,
  type BuilderKitId,
  type PartDef,
} from "./builderPartTypes.ts";
import { SPACE_STATION_BUILDER_PARTS } from "./spaceStationKitParts.ts";
import "./AdminPanel.css";

const BASE_BUILDER_PARTS: Record<string, PartDef[]> = {
  Пол: [
    { name: "floor", label: "Пол" },
    { name: "floor-half", label: "Пол ½" },
    { name: "floor-quarter", label: "Пол ¼" },
    { name: "floor-corner-diagonal", label: "Угол диаг." },
    { name: "floor-corner-round", label: "Угол скруг." },
  ],
  Стены: [
    { name: "wall", label: "Стена" },
    { name: "wall-half", label: "Стена ½" },
    { name: "wall-low", label: "Низкая" },
    { name: "wall-corner", label: "Угол" },
    { name: "wall-corner-diagonal", label: "Угол диаг." },
    { name: "wall-corner-round", label: "Угол скруг." },
    { name: "wall-corner-column", label: "Кол. угол" },
    { name: "wall-corner-column-bottom", label: "Кол. угол низ" },
    { name: "wall-corner-column-small", label: "Кол. мал." },
    { name: "wall-corner-column-small-bottom", label: "Кол. мал. низ" },
  ],
  Окна: [
    { name: "wall-window-square", label: "Квадр." },
    { name: "wall-window-square-detailed", label: "Квадр. дет." },
    { name: "wall-window-round", label: "Круглое" },
    { name: "wall-window-round-detailed", label: "Круг. дет." },
    { name: "wall-window-wide-square", label: "Шир. кв." },
    { name: "wall-window-wide-square-detailed", label: "Шир. кв. д." },
    { name: "wall-window-wide-round", label: "Шир. кр." },
    { name: "wall-window-wide-round-detailed", label: "Шир. кр. д." },
  ],
  Двери: [
    { name: "wall-doorway-square", label: "Проём кв." },
    { name: "wall-doorway-wide-square", label: "Проём шир. кв." },
    { name: "wall-doorway-round", label: "Проём кр." },
    { name: "wall-doorway-wide-round", label: "Проём шир. кр." },
    { name: "door-rotate-square-a", label: "Дверь кв. A" },
    { name: "door-rotate-square-b", label: "Дверь кв. B" },
    { name: "door-rotate-square-c", label: "Дверь кв. C" },
    { name: "door-rotate-square-d", label: "Дверь кв. D" },
    { name: "door-rotate-round-a", label: "Дверь кр. A" },
    { name: "door-rotate-round-b", label: "Дверь кр. B" },
    { name: "door-rotate-round-c", label: "Дверь кр. C" },
    { name: "door-rotate-round-d", label: "Дверь кр. D" },
  ],
  Крыша: [
    { name: "roof-flat-center", label: "Центр" },
    { name: "roof-flat-side", label: "Бок" },
    { name: "roof-flat-corner", label: "Угол" },
    { name: "roof-flat-corner-inner", label: "Угол внутр." },
    { name: "roof-flat-patch", label: "Заплатка" },
    { name: "roof-flat-patch-large", label: "Заплатка бол." },
    { name: "roof-flat-square", label: "Квадратная" },
  ],
  Лестницы: [
    { name: "stairs-open", label: "Открытая" },
    { name: "stairs-open-short", label: "Откр. кор." },
    { name: "stairs-closed", label: "Закрытая" },
    { name: "stairs-closed-short", label: "Закр. кор." },
    { name: "stairs-center", label: "Центральная" },
    { name: "stairs-center-short", label: "Центр. кор." },
    { name: "stairs-sides", label: "С боками" },
    { name: "stairs-sides-short", label: "Боков. кор." },
  ],
  Колонны: [
    { name: "column", label: "Колонна" },
    { name: "column-thin", label: "Тонкая" },
    { name: "column-wide", label: "Широкая" },
  ],
  Бордюры: [
    { name: "border", label: "Бордюр" },
    { name: "border-corner", label: "Угол" },
    { name: "border-corner-diagonal", label: "Угол диаг." },
    { name: "border-corner-round", label: "Угол скруг." },
    { name: "border-corner-small", label: "Угол мал." },
    { name: "border-high", label: "Высокий" },
    { name: "border-high-corner", label: "Выс. угол" },
    { name: "border-high-corner-diagonal", label: "Выс. диаг." },
    { name: "border-high-corner-round", label: "Выс. скруг." },
    { name: "border-high-corner-small", label: "Выс. мал." },
  ],
  Детали: [
    { name: "composition-detail_circle", label: "Круг (детализация)" },
    { name: "composition-detail_vertical_pipe", label: "Вертикальная труба" },
    { name: "plating", label: "Обшивка" },
    { name: "plating-wide", label: "Обш. шир." },
    { name: "plating-detailed", label: "Обш. дет." },
    { name: "plating-detailed-wide", label: "Обш. дет. шир." },
    { name: "detail-pipe", label: "Труба" },
    { name: "gutter-vertical", label: "Водосток" },
    { name: "gutter-vertical-bottom", label: "Вод. низ" },
    { name: "gutter-vertical-short", label: "Вод. кор." },
    { name: "gutter-vertical-top", label: "Вод. верх" },
    { name: "gutter-vertical-wall", label: "Вод. стена" },
  ],
  Баррикады: [
    { name: "barricade-doorway-a", label: "Проём A" },
    { name: "barricade-doorway-b", label: "Проём B" },
    { name: "barricade-doorway-c", label: "Проём C" },
    { name: "barricade-window-a", label: "Окно A" },
    { name: "barricade-window-b", label: "Окно B" },
    { name: "barricade-window-c", label: "Окно C" },
  ],
};

const BUILDER_PARTS: Record<string, PartDef[]> = {
  ...BASE_BUILDER_PARTS,
  ...SPACE_STATION_BUILDER_PARTS,
};

interface AdminPanelProps {
  isOpen: boolean;
  isBuilderActive: boolean;
  isDeconstructMode: boolean;
  placedCount: number;
  builderScale: number;
  builderMode: BuilderMode;
  onClose: () => void;
  onSelectPart: (partPath: string) => void;
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
  builderScale,
  builderMode,
  onClose,
  onSelectPart,
  onSelectComposition,
  onClearComposition,
  onExportRequest,
  onImportRequest,
  onSetBuilderMode,
  onToggleDeconstructMode,
  onAdjustScale,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("Пол");
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importInfo, setImportInfo] = useState("");
  const [copied, setCopied] = useState(false);

  const categories = Object.keys(BUILDER_PARTS);
  const currentParts = BUILDER_PARTS[selectedCategory] ?? [];

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
      count > 0 ? `Импортировано: ${count}` : "Не удалось импортировать",
    );
  }, [importJson, onImportRequest]);

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <span className="admin-title">👑 Конструктор (DEV)</span>
          {isBuilderActive && (
            <span className="admin-builder-hint">
              ЛКМ — поставить · T — поворот · R — режим · F — деконструкция ·
              +/- масштаб
            </span>
          )}
          <button className="admin-close-btn" onClick={onClose}>
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
                {cat}
              </button>
            ))}
          </div>

          {/* Center: parts grid */}
          <div className="admin-parts-grid">
            {currentParts.map((part) => {
              const isComposition = part.name.startsWith("composition-");
              const compositionId = isComposition
                ? part.name.replace("composition-", "")
                : null;
              const kit: BuilderKitId = part.kit ?? "building";
              const kitBases = BUILDER_KIT_BASES[kit];
              return (
                <button
                  key={`${kit}-${part.name}`}
                  className={`admin-part-item${isComposition ? " admin-part-composition" : ""}`}
                  title={part.name}
                  onClick={() => {
                    if (isComposition && compositionId && onSelectComposition) {
                      onSelectComposition(compositionId);
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
                      title={part.label}
                    >
                      ⭕
                    </span>
                  ) : (
                    <img
                      src={`${kitBases.preview}/${part.name}.png`}
                      alt={part.label}
                      className="admin-part-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.25";
                      }}
                    />
                  )}
                  <span className="admin-part-label">{part.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: composition panel */}
          <div className="admin-composition">
            <div className="admin-comp-title">Сборка</div>

            <div className="admin-comp-stat">
              Деталей: <strong>{placedCount}</strong>
            </div>
            <div className="admin-comp-stat">
              Масштаб: <strong>{builderScale.toFixed(2)}x</strong>
            </div>
            <div className="admin-comp-stat">
              Режим:{" "}
              <strong>{BUILDER_MODE_LABELS[builderMode]}</strong>
            </div>
            <div className="admin-comp-stat">
              Деконстр.: <strong>{isDeconstructMode ? "ON" : "OFF"}</strong>
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
                Single
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("default")}
              >
                L-угол
              </button>
              <button
                className="admin-btn"
                onClick={() => onSetBuilderMode("curve")}
              >
                Кривая
              </button>
            </div>
            <button className="admin-btn" onClick={onToggleDeconstructMode}>
              {isDeconstructMode ? "🟥 Выкл деконстр." : "🛠 Вкл деконстр."}
            </button>

            <div className="admin-comp-hint">
              После размещения всех деталей нажмите
              <br />
              «Сгенерировать JSON» — скопируйте и<br />
              вставьте в код как новое строение.
            </div>

            <button
              className="admin-btn admin-btn-export"
              onClick={handleExport}
              disabled={placedCount === 0}
            >
              📄 Сгенерировать JSON
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
                    {copied ? "✅ Скопировано" : "📋 Копировать"}
                  </button>
                  <button className="admin-btn" onClick={handleDownload}>
                    ⬇ Скачать
                  </button>
                </div>
              </>
            )}

            <textarea
              className="admin-json-area"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={7}
              placeholder='Вставь JSON вида {"parts":[...]}'
              spellCheck={false}
            />
            <button className="admin-btn" onClick={handleImport}>
              📥 Импорт JSON в сцену
            </button>
            {importInfo && <div className="admin-comp-hint">{importInfo}</div>}

            <button
              className="admin-btn admin-btn-danger"
              onClick={handleClear}
              disabled={placedCount === 0}
            >
              🗑 Очистить сборку
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
