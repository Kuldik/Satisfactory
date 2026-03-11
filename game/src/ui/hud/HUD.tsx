// ============================================================
// HUD — heads-up display overlay
// ============================================================

import { type FC } from 'react';
import type { GameState } from '../../core/types.ts';
import { GameMode } from '../../core/types.ts';
import './HUD.css';

interface HUDProps {
  gameState: GameState;
  onOpenBuildMenu: () => void;
  onOpenInventory: () => void;
  /** DEV only — shows admin builder button when provided */
  onOpenAdminPanel?: () => void;
  isBuilderActive?: boolean;
}

export const HUD: FC<HUDProps> = ({ gameState, onOpenBuildMenu, onOpenInventory, onOpenAdminPanel, isBuilderActive }) => {
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
        <div className="hud-floor">
          Этаж: {gameState.currentFloor}
          <button className="hud-btn" title="PageUp">▲</button>
          <button className="hud-btn" title="PageDown">▼</button>
        </div>
        <div className="hud-mode">
          {gameState.mode === GameMode.BuildMode && '🔨 Режим строительства'}
          {gameState.mode === GameMode.Playing && '🎮 Игра'}
          {gameState.isPaused && ' ⏸ ПАУЗА'}
        </div>
      </div>

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
      </div>

      {/* Build preview info */}
      {gameState.selectedBuilding && (
        <div className="hud-build-info">
          Размещение: <strong>{gameState.selectedBuilding}</strong>
          <span className="hud-hint">ЛКМ — поставить | T — повернуть | R — режим | F — деконстр. | Ctrl — выравнивание | Esc — отмена</span>
        </div>
      )}

      {/* Controls hint (bottom right) */}
      <div className="hud-controls">
        <div>WASD — перемещение камеры</div>
        <div>ПКМ / СКМ — вращение камеры</div>
        <div>Shift+ЛКМ — перемещение мышью</div>
        <div>Колесо — масштаб</div>
        <div>PgUp/PgDn — этаж ↑↓</div>
      </div>
    </div>
  );
};
