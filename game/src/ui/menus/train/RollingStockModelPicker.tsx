import { useMemo, useState, type FC } from "react";
import type {
  RollingStockKind,
  RollingStockVariant,
} from "../../../train/trainRollingStockCatalog.ts";
import { ROLLING_STOCK_VARIANTS } from "../../../train/trainRollingStockCatalog.ts";
import {
  getRollingStockDefaultId,
  setRollingStockDefaultId,
} from "../../../train/rollingStockDefaults.ts";
import { useTranslation } from "../../../i18n/I18nContext.tsx";
import "../BuildMenu.css";

export type RollingStockPickResult = {
  kind: RollingStockKind;
  variant: RollingStockVariant;
  isDefault: boolean;
};

type Props = {
  kind: RollingStockKind;
  onCancel: () => void;
  onPick: (result: RollingStockPickResult) => void;
};

export const RollingStockModelPicker: FC<Props> = ({
  kind,
  onCancel,
  onPick,
}) => {
  const { t } = useTranslation();
  const variants = ROLLING_STOCK_VARIANTS[kind];
  const initialDefaultId = useMemo(() => getRollingStockDefaultId(kind), [kind]);
  const [defaultId, setDefaultId] = useState<string | null>(initialDefaultId);

  const title =
    kind === "locomotive"
      ? t("rollingStock.locomotiveTitle")
      : kind === "freight_car"
        ? t("rollingStock.freightTitle")
        : t("rollingStock.fluidTitle");

  const applyDefault = (variantId: string): void => {
    const nextDefault = defaultId === variantId ? null : variantId;
    setDefaultId(nextDefault);
    setRollingStockDefaultId(kind, nextDefault);
  };

  return (
    <div className="rolling-picker-overlay" onClick={onCancel}>
      <div className="rolling-picker" onClick={(e) => e.stopPropagation()}>
        <div className="rolling-picker-header">
          <div>
            <h3>{title}</h3>
            <p>{t("rollingStock.hint")}</p>
          </div>
          <button className="rolling-picker-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="rolling-picker-grid">
          {variants.map((variant) => (
            <button
              key={variant.id}
              className={`rolling-picker-card ${
                defaultId === variant.id ? "active" : ""
              }`}
              onClick={() =>
                onPick({ kind, variant, isDefault: defaultId === variant.id })
              }
            >
              <label
                className="rolling-default-toggle"
                title={t("rollingStock.default")}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={defaultId === variant.id}
                  onChange={() => applyDefault(variant.id)}
                />
              </label>
              <img
                className="rolling-picker-preview"
                src={variant.previewPath}
                alt={variant.label}
              />
              <div className="rolling-picker-name">{variant.label}</div>
              <div className="rolling-picker-file">{variant.id}</div>
              {variant.capacityLabel && (
                <div className="rolling-picker-capacity">
                  {variant.capacityLabel}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="rolling-picker-actions">
          <button className="rolling-picker-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};
