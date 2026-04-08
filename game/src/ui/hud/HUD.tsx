// ============================================================
// HUD — heads-up display overlay
// ============================================================

import { type FC } from 'react';
import { ENABLE_MULTI_FLOOR } from '../../core/constants.ts';
import type { GameState, BuilderMode } from '../../core/types.ts';
import { GameMode, BUILDER_MODE_LABELS } from '../../core/types.ts';
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
          <span className="hud-hint">
            ЛКМ — поставить | T — повернуть | R — режим | F — деконстр. | Ctrl — выравнивание | Esc — отмена
            {/^conveyor_mk[1-6]$/.test(gameState.selectedBuilding) && (
              <> · R: прямая / L-угол / кривая · 1-й ЛКМ начало, 2-й конец · каждая 6-я — стойка</>
            )}
          </span>
        </div>
      )}

      {/* Controls hint (bottom right) */}
      <div className="hud-controls">
        <div>WASD — перемещение камеры</div>
        <div>ПКМ / СКМ — вращение камеры</div>
        <div>Shift+ЛКМ — перемещение мышью</div>
        <div>Колесо — масштаб</div>
        {ENABLE_MULTI_FLOOR && <div>PgUp/PgDn — этаж ↑↓</div>}
      </div>
    </div>
  );
};
