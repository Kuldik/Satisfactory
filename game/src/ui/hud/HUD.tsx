// ============================================================
// HUD — heads-up display overlay
// ============================================================

import { type FC } from 'react';
import { ENABLE_MULTI_FLOOR } from '../../core/constants.ts';
import type {
  GameState,
  BuilderMode,
  RailroadPlacementSubMode,
} from '../../core/types.ts';
import { GameMode, BUILDER_MODE_LABELS } from '../../core/types.ts';
import { simItemName } from '../../sim/buildingCatalog.ts';
import './HUD.css';

interface HUDProps {
  gameState: GameState;
  onOpenBuildMenu: () => void;
  onOpenInventory: () => void;
  /** DEV only — shows admin builder button when provided */
  onOpenAdminPanel?: () => void;
  isBuilderActive?: boolean;
  /** DEV — режим снятия деталей конструктора */
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
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hud">
      {/* Top bar */}
      <div className="hud-top">
        <div className="hud-time">
          ⏱ {formatTime(gameState.gameTime)}
        </div>
        {ENABLE_MULTI_FLOOR && (
          <div className="hud-floor">
            Этаж: {gameState.currentFloor}
            <button type="button" className="hud-btn" title="PageUp">
              ▲
            </button>
            <button type="button" className="hud-btn" title="PageDown">
              ▼
            </button>
          </div>
        )}
        <div className="hud-mode">
          {gameState.mode === GameMode.BuildMode && '🔨 Режим строительства'}
          {gameState.mode === GameMode.Playing && '🎮 Игра'}
          {gameState.isPaused && ' ⏸ ПАУЗА'}
        </div>
      </div>

      {gameState.sim &&
        (gameState.sim.buildingCount > 0 ||
          gameState.sim.inventory.length > 0) && (
          <div
            className="hud-sim"
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              minWidth: 196,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(12, 16, 24, 0.82)",
              border: "1px solid rgba(120, 150, 200, 0.35)",
              color: "#e6edf6",
              font: "12px/1.5 system-ui, sans-serif",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                color: gameState.sim.power.blackout ? "#ff7a7a" : "#9fe0a0",
              }}
            >
              <span>⚡ {Math.round(gameState.sim.power.generationMW)} МВт</span>
              <span style={{ opacity: 0.85 }}>
                / {Math.round(gameState.sim.power.consumptionMW)} МВт
              </span>
            </div>
            {gameState.sim.power.blackout && (
              <div style={{ color: "#ff7a7a", fontWeight: 700 }}>
                ⚠ БЛЭКАУТ — производство остановлено
              </div>
            )}
            {gameState.sim.power.generationMW < 1 &&
              gameState.sim.logistics &&
              gameState.sim.logistics.linkCount > 0 &&
              gameState.sim.logistics.buildingInputs.length === 0 && (
                <div style={{ opacity: 0.65, fontSize: 11, marginTop: 2 }}>
                  Генерация ждёт доставку топлива по лентам
                </div>
              )}
            <div style={{ opacity: 0.7, marginTop: 2 }}>
              Зданий в симуляции: {gameState.sim.buildingCount}
            </div>
            {gameState.sim.logistics && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px solid rgba(120, 150, 200, 0.25)",
                  fontSize: 11,
                }}
              >
                <div style={{ opacity: 0.7, marginBottom: 2 }}>
                  🔗 Логистика (тест)
                </div>
                <div>
                  Порты: {gameState.sim.logistics.portCount} · Ленты:{" "}
                  {gameState.sim.logistics.beltLineCount} · Связи:{" "}
                  {gameState.sim.logistics.linkCount}
                </div>
                {gameState.sim.logistics.beltBuffers.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ opacity: 0.65 }}>На лентах:</div>
                    {gameState.sim.logistics.beltBuffers.map((b) => (
                      <div key={b.beltCompositeId}>
                        {simItemName(b.itemId)}: {b.amount}
                      </div>
                    ))}
                  </div>
                )}
                {gameState.sim.logistics.buildingInputs.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ opacity: 0.65 }}>У входов зданий:</div>
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
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px solid rgba(120, 150, 200, 0.25)",
                }}
              >
                <div style={{ opacity: 0.7, marginBottom: 2 }}>📦 Склад</div>
                {gameState.sim.inventory.map((s) => (
                  <div
                    key={s.itemId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span>{simItemName(s.itemId)}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {s.amount.toLocaleString("ru-RU")}
                    </span>
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
            <strong>Демонтаж</strong>
            <span>Логистика (ленты, стойки, конвейерный kit): удерживай <strong>ЛКМ</strong> ~0,2 с. Прочие сборки из меню: ~2 с. Одиночная деталь конструктора (не логистика): <strong>ЛКМ</strong> сразу. Выкл: <strong>F</strong>, <strong>Esc</strong> или кнопка. ПКМ — камера.</span>
          </div>
          {onToggleDeconstruct && (
            <button
              type="button"
              className="hud-deconstruct-banner__btn"
              onClick={onToggleDeconstruct}
            >
              Выкл
            </button>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="hud-bottom">
        <button className="hud-action-btn" onClick={onOpenBuildMenu} title="Q">
          🏗️ Строительство (Q)
        </button>
        <button className="hud-action-btn" onClick={onOpenInventory} title="B">
          📦 Инвентарь (B)
        </button>
        {onOpenAdminPanel && (
          <button
            className={`hud-action-btn hud-action-btn-admin${isBuilderActive ? ' active' : ''}`}
            onClick={onOpenAdminPanel}
            title="~ — Конструктор (DEV)"
          >
            👑 Конструктор
          </button>
        )}
        {onToggleDeconstruct && (
          <button
            type="button"
            className={`hud-action-btn hud-action-btn-deconstruct${isDeconstructMode ? ' active' : ''}`}
            onClick={onToggleDeconstruct}
            title="Снять детали конструктора (F)"
          >
            🧹 Демонтаж (F)
          </button>
        )}
      </div>

      {/* Build preview info */}
      {gameState.selectedBuilding && (
        <div className="hud-build-info">
          Размещение: <strong>{gameState.selectedBuilding}</strong>
          {/^conveyor_mk[1-6]$/.test(gameState.selectedBuilding) && (
            <span className="hud-mode-badge">
              {BUILDER_MODE_LABELS[builderMode]}
            </span>
          )}
          {gameState.selectedBuilding === "railroad_track" && (
            <span className="hud-mode-badge">
              {railroadPlacementSubMode === "corner" ? "Колено" : "Прямая"} · geo8
            </span>
          )}
          <span className="hud-hint">
            {gameState.selectedBuilding === "railroad_track"
              ? "ЛКМ — поставить | T — прямая/колено | R — разворот / сторона колена | F — деконстр. | Esc — отмена"
              : "ЛКМ — поставить | T — повернуть | R — режим | F — деконстр. | Ctrl — выравнивание | Esc — отмена"}
            {/^conveyor_mk[1-6]$/.test(gameState.selectedBuilding) && (
              <> · R: L-угол / кривая · 1-й ЛКМ начало, 2-й конец</>
            )}
          </span>
        </div>
      )}

      {/* Controls hint (bottom right) */}
      <div className="hud-controls">
        <div>Tab — тёмная / светлая тема</div>
        <div>WASD — перемещение камеры</div>
        <div>ПКМ / СКМ — вращение камеры</div>
        <div>Shift+ЛКМ — перемещение мышью</div>
        <div>Колесо — масштаб</div>
        {ENABLE_MULTI_FLOOR && <div>PgUp/PgDn — этаж ↑↓</div>}
      </div>
    </div>
  );
};
