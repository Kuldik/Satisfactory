// ============================================================
// HUD — heads-up display overlay
// ============================================================

import { type FC } from "react";
import { ENABLE_MULTI_FLOOR } from "../../core/constants.ts";
import type {
  GameState,
  BuilderMode,
  RailroadPlacementSubMode,
} from "../../core/types.ts";
import { GameMode } from "../../core/types.ts";
import { simItemName } from "../../sim/buildingCatalog.ts";
import { useTranslation } from "../../i18n/I18nContext.tsx";
import { getActiveLocale } from "../../i18n/translate.ts";
import "./HUD.css";

interface HUDProps {
  gameState: GameState;
  onOpenBuildMenu: () => void;
  onOpenInventory: () => void;
  onOpenAdminPanel?: () => void;
  isBuilderActive?: boolean;
  isDeconstructMode?: boolean;
  onToggleDeconstruct?: () => void;
  builderMode?: BuilderMode;
  railroadPlacementSubMode?: RailroadPlacementSubMode;
}

export const HUD: FC<HUDProps> = ({
  gameState,
  onOpenBuildMenu,
  onOpenInventory,
  onOpenAdminPanel,
  isBuilderActive,
  isDeconstructMode = false,
  onToggleDeconstruct,
  builderMode = "single",
  railroadPlacementSubMode = "straight",
}) => {
  const { t } = useTranslation();
  const numberLocale = getActiveLocale() === "ru" ? "ru-RU" : "en-US";

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-time">⏱ {formatTime(gameState.gameTime)}</div>
        {ENABLE_MULTI_FLOOR && (
          <div className="hud-floor">
            {t("hud.floor")}: {gameState.currentFloor}
            <button type="button" className="hud-btn" title={t("hud.pageUp")}>
              ▲
            </button>
            <button type="button" className="hud-btn" title={t("hud.pageDown")}>
              ▼
            </button>
          </div>
        )}
        <div className="hud-mode">
          {gameState.mode === GameMode.BuildMode && `🔨 ${t("hud.modeBuild")}`}
          {gameState.mode === GameMode.Playing && `🎮 ${t("hud.modePlaying")}`}
          {gameState.isPaused && ` ⏸ ${t("hud.paused")}`}
        </div>
      </div>

      {gameState.sim &&
        (gameState.sim.buildingCount > 0 ||
          gameState.sim.inventory.length > 0) && (
          <div className="hud-sim">
            <div className="hud-sim-power">
              <span>
                ⚡ {Math.round(gameState.sim.power.generationMW)}{" "}
                {t("common.mw")}
              </span>
              <span>
                / {Math.round(gameState.sim.power.consumptionMW)}{" "}
                {t("common.mw")}
              </span>
            </div>
            {gameState.sim.power.blackout && (
              <div className="hud-sim-blackout">⚠ {t("hud.blackout")}</div>
            )}
            {gameState.sim.power.generationMW < 1 &&
              gameState.sim.logistics &&
              gameState.sim.logistics.linkCount > 0 &&
              gameState.sim.logistics.buildingInputs.length === 0 && (
                <div className="hud-sim-waiting">{t("hud.waitingFuel")}</div>
              )}
            <div className="hud-sim-buildings">
              {t("hud.buildingsInSim")}: {gameState.sim.buildingCount}
            </div>
            {gameState.sim.logistics && (
              <div className="hud-sim-logistics">
                <div className="hud-sim-logistics-title">
                  🔗 {t("hud.logisticsTest")}
                </div>
                <div>
                  {t("hud.ports")}: {gameState.sim.logistics.portCount} ·{" "}
                  {t("hud.belts")}: {gameState.sim.logistics.beltLineCount} ·{" "}
                  {t("hud.links")}: {gameState.sim.logistics.linkCount}
                </div>
                {gameState.sim.logistics.beltBuffers.length > 0 && (
                  <div className="hud-sim-section">
                    <div>{t("hud.onBelts")}:</div>
                    {gameState.sim.logistics.beltBuffers.map((b) => (
                      <div key={b.beltCompositeId}>
                        {simItemName(b.itemId)}: {b.amount}
                      </div>
                    ))}
                  </div>
                )}
                {gameState.sim.logistics.buildingInputs.length > 0 && (
                  <div className="hud-sim-section">
                    <div>{t("hud.atBuildingInputs")}:</div>
                    {gameState.sim.logistics.buildingInputs.map((b, i) => (
                      <div key={`${b.compositeId}-${b.itemId}-${i}`}>
                        {simItemName(b.itemId)}: {b.amount}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {gameState.sim.inventory.length > 0 && (
              <div className="hud-sim-inventory">
                <div>📦 {t("hud.warehouse")}</div>
                {gameState.sim.inventory.map((s) => (
                  <div key={s.itemId} className="hud-sim-inventory-row">
                    <span>{simItemName(s.itemId)}</span>
                    <span>{s.amount.toLocaleString(numberLocale)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {isDeconstructMode && (
        <div className="hud-deconstruct-banner" role="status">
          <span className="hud-deconstruct-banner__icon" aria-hidden />
          <div className="hud-deconstruct-banner__text">
            <strong>{t("hud.deconstructTitle")}</strong>
            <span>{t("hud.deconstructHint")}</span>
          </div>
          {onToggleDeconstruct && (
            <button
              type="button"
              className="hud-deconstruct-banner__btn"
              onClick={onToggleDeconstruct}
            >
              {t("hud.deconstructOff")}
            </button>
          )}
        </div>
      )}

      <div className="hud-bottom">
        <button className="hud-action-btn" onClick={onOpenBuildMenu} title="Q">
          🏗️ {t("hud.build")}
        </button>
        <button className="hud-action-btn" onClick={onOpenInventory} title="B">
          📦 {t("hud.inventory")}
        </button>
        {onOpenAdminPanel && (
          <button
            className={`hud-action-btn hud-action-btn-admin${isBuilderActive ? " active" : ""}`}
            onClick={onOpenAdminPanel}
            title={t("hud.constructorTitle")}
          >
            👑 {t("hud.constructor")}
          </button>
        )}
        {onToggleDeconstruct && (
          <button
            type="button"
            className={`hud-action-btn hud-action-btn-deconstruct${isDeconstructMode ? " active" : ""}`}
            onClick={onToggleDeconstruct}
            title={t("hud.deconstructTitleBtn")}
          >
            🧹 {t("hud.deconstruct")}
          </button>
        )}
      </div>

      {gameState.selectedBuilding && (
        <div className="hud-build-info">
          {t("hud.placement")}: <strong>{gameState.selectedBuilding}</strong>
          {/^conveyor_mk[1-6]$/.test(gameState.selectedBuilding) && (
            <span className="hud-mode-badge">
              {t(`builderMode.${builderMode}`)}
            </span>
          )}
          {gameState.selectedBuilding === "railroad_track" && (
            <span className="hud-mode-badge">
              {railroadPlacementSubMode === "corner"
                ? t("hud.railroadCorner")
                : t("hud.railroadStraight")}{" "}
              · geo8
            </span>
          )}
          <span className="hud-hint">
            {gameState.selectedBuilding === "railroad_track"
              ? t("hud.hintRailroad")
              : t("hud.hintDefault")}
            {/^conveyor_mk[1-6]$/.test(gameState.selectedBuilding) &&
              t("hud.hintConveyorExtra")}
          </span>
        </div>
      )}

      <div className="hud-controls">
        <div>{t("hud.controlsTheme")}</div>
        <div>{t("hud.controlsMove")}</div>
        <div>{t("hud.controlsRotate")}</div>
        <div>{t("hud.controlsPan")}</div>
        <div>{t("hud.controlsZoom")}</div>
        {ENABLE_MULTI_FLOOR && <div>{t("hud.controlsFloor")}</div>}
      </div>
    </div>
  );
};
