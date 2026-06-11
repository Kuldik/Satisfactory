// ============================================================
// BuildMenu — building selection menu (Q key) with subcategories
// ============================================================

import { useState, type FC } from "react";
import { BuildingCategory } from "../../core/types.ts";
import { hasPattern } from "../../buildings/BuildingPatterns.ts";
import { hasPrefabBuilding } from "../../buildings/BuildingPrefabs.ts";
import { PIPE_PROCEDURAL_STRAIGHT_PATH } from "../../buildings/logistics/pipeKitModels.ts";
import {
  getRollingStockVariant,
  isRollingStockMenuId,
  type RollingStockKind,
  type RollingStockVariant,
} from "../../train/trainRollingStockCatalog.ts";
import {
  getRollingStockDefaultId,
  setRollingStockDefaultId,
} from "../../train/rollingStockDefaults.ts";
import { BUILDING_META } from "../../i18n/buildings.generated.ts";
import { useTranslation } from "../../i18n/I18nContext.tsx";
import { RollingStockModelPicker } from "./train/RollingStockModelPicker.tsx";
import "./BuildMenu.css";

interface BuildMenuItem {
  id: string;
  category: BuildingCategory;
  subcategoryKey: string;
  modelPath?: string;
  iconPath?: string;
}

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBuilding: (
    buildingId: string,
    variant?: { modelPath: string; variantId: string },
  ) => void | Promise<void>;
}

const CATEGORY_ICONS: Record<BuildingCategory, string> = {
  [BuildingCategory.Special]: "⭐",
  [BuildingCategory.Production]: "⚙️",
  [BuildingCategory.Power]: "⚡",
  [BuildingCategory.Logistics]: "🔄",
  [BuildingCategory.Organization]: "📦",
};

const ALL_BUILDINGS: BuildMenuItem[] = BUILDING_META.map((m) => ({
  id: m.id,
  category: BuildingCategory[m.category as keyof typeof BuildingCategory],
  subcategoryKey: m.subcategoryKey,
  modelPath: "modelPath" in m ? m.modelPath : undefined,
  iconPath: "iconPath" in m ? m.iconPath : undefined,
}));

/** Paths not stored in BUILDING_META (procedural / dynamic). */
const EXTRA_PATHS: Record<string, Partial<Pick<BuildMenuItem, "modelPath" | "iconPath">>> = {
  pipe_mk1: { modelPath: PIPE_PROCEDURAL_STRAIGHT_PATH },
  pipe_mk2: { modelPath: PIPE_PROCEDURAL_STRAIGHT_PATH },
};

for (const b of ALL_BUILDINGS) {
  const extra = EXTRA_PATHS[b.id];
  if (extra) Object.assign(b, extra);
}

function groupBySubcategory(
  buildings: BuildMenuItem[],
): Map<string, BuildMenuItem[]> {
  const map = new Map<string, BuildMenuItem[]>();
  for (const b of buildings) {
    const list = map.get(b.subcategoryKey) ?? [];
    list.push(b);
    map.set(b.subcategoryKey, list);
  }
  return map;
}

function readRollingStockDefaults(): Partial<Record<RollingStockKind, string>> {
  return {
    locomotive: getRollingStockDefaultId("locomotive") ?? undefined,
    freight_car: getRollingStockDefaultId("freight_car") ?? undefined,
    fluid_freight_car: getRollingStockDefaultId("fluid_freight_car") ?? undefined,
  };
}

export const BuildMenu: FC<BuildMenuProps> = ({
  isOpen,
  onClose,
  onSelectBuilding,
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory>(
    BuildingCategory.Special,
  );
  const [hoveredItem, setHoveredItem] = useState<BuildMenuItem | null>(null);
  const [rollingStockPickerKind, setRollingStockPickerKind] =
    useState<RollingStockKind | null>(null);
  const [rollingStockDefaults, setRollingStockDefaults] =
    useState<Partial<Record<RollingStockKind, string>>>(readRollingStockDefaults);

  if (!isOpen) return null;

  const buildingName = (id: string) =>
    t(`buildMenu.buildings.${id}.name`);
  const buildingDesc = (id: string) =>
    t(`buildMenu.buildings.${id}.description`);
  const subcategoryLabel = (key: string) =>
    t(`buildMenu.subcategories.${key}`);

  const filteredBuildings = ALL_BUILDINGS.filter(
    (b) => b.category === selectedCategory,
  );
  const grouped = groupBySubcategory(filteredBuildings);
  const isSpecial = selectedCategory === BuildingCategory.Special;

  return (
    <div className="build-menu-overlay" onClick={onClose}>
      <div className="build-menu" onClick={(e) => e.stopPropagation()}>
        <div className="build-menu-categories">
          <div className="build-menu-title">{t("buildMenu.title")}</div>
          {(Object.values(BuildingCategory) as BuildingCategory[]).map(
            (cat) => (
              <button
                key={cat}
                className={`build-menu-cat-btn ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span className="cat-icon">{CATEGORY_ICONS[cat]}</span>
                <span className="cat-name">{t(`buildMenu.categories.${cat}`)}</span>
              </button>
            ),
          )}
        </div>

        <div className="build-menu-list">
          {Array.from(grouped.entries()).map(([subKey, buildings]) => (
            <div key={subKey} className="build-subcategory">
              <div className="subcategory-header">
                {subcategoryLabel(subKey)}
              </div>
              <div className={`subcategory-grid ${isSpecial ? "special-grid" : ""}`}>
                {buildings.map((building) => {
                  const rollingKind = isRollingStockMenuId(building.id)
                    ? building.id
                    : null;
                  const defaultVariant =
                    rollingKind && rollingStockDefaults[rollingKind]
                      ? getRollingStockVariant(
                          rollingKind,
                          rollingStockDefaults[rollingKind]!,
                        )
                      : null;
                  const iconPath =
                    defaultVariant?.previewPath ?? building.iconPath;
                  const displayName = buildingName(building.id);

                  return (
                    <button
                      key={building.id}
                      className={`build-menu-item ${isSpecial ? "build-menu-item-special" : ""}${hasPattern(building.id) || hasPrefabBuilding(building.id) ? " has-pattern" : ""}`}
                      onClick={() => {
                        if (rollingKind) {
                          if (defaultVariant) {
                            onSelectBuilding(rollingKind, {
                              modelPath: defaultVariant.modelPath,
                              variantId: defaultVariant.id,
                            });
                            onClose();
                            return;
                          }
                          setRollingStockPickerKind(rollingKind);
                          return;
                        }
                        onSelectBuilding(building.id);
                        onClose();
                      }}
                      onMouseEnter={() => setHoveredItem(building)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {defaultVariant && (
                        <label
                          className="build-menu-default-toggle"
                          title={t("buildMenu.resetDefaultModel")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked
                            onChange={() => {
                              setRollingStockDefaultId(rollingKind!, null);
                              setRollingStockDefaults(readRollingStockDefaults());
                            }}
                          />
                        </label>
                      )}
                      {iconPath ? (
                        <img
                          className="item-icon-preview"
                          src={iconPath}
                          alt={displayName}
                        />
                      ) : (
                        <div className="item-icon">{isSpecial ? "🏛️" : "🏭"}</div>
                      )}
                      <div className="item-name">{displayName}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="build-menu-details">
          {hoveredItem ? (
            <>
              {hoveredItem.iconPath ? (
                <img
                  className="detail-icon-preview"
                  src={hoveredItem.iconPath}
                  alt={buildingName(hoveredItem.id)}
                />
              ) : (
                <div className="detail-icon">🏭</div>
              )}
              <h3>{buildingName(hoveredItem.id)}</h3>
              {hoveredItem.modelPath && (
                <p className="detail-name-en">
                  {t("common.model")}: {hoveredItem.modelPath}
                </p>
              )}
              <p className="detail-desc">{buildingDesc(hoveredItem.id)}</p>
            </>
          ) : (
            <p className="detail-hint">{t("buildMenu.hint")}</p>
          )}
        </div>
      </div>
      {rollingStockPickerKind && (
        <RollingStockModelPicker
          kind={rollingStockPickerKind}
          onCancel={() => {
            setRollingStockDefaults(readRollingStockDefaults());
            setRollingStockPickerKind(null);
          }}
          onPick={(result: { variant: RollingStockVariant }) => {
            onSelectBuilding(rollingStockPickerKind, {
              modelPath: result.variant.modelPath,
              variantId: result.variant.id,
            });
            setRollingStockDefaults(readRollingStockDefaults());
            setRollingStockPickerKind(null);
            onClose();
          }}
        />
      )}
    </div>
  );
};
