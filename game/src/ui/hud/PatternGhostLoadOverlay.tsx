// ============================================================
// Центральный «бесконечный» лоадер на время загрузки GLB паттерна
// ============================================================

import "./PatternGhostLoadOverlay.css";

const R = 36;
const STROKE = 4;

type Props = { visible: boolean };

export function PatternGhostLoadOverlay({ visible }: Props) {
  if (!visible) return null;

  const vb = R * 2 + 8;
  const c = R + 4;
  const arcR = R - STROKE / 2;
  const arcLen = Math.PI * arcR * 1.25;

  return (
    <div
      className="pattern-ghost-load-overlay"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Загрузка голограммы постройки"
    >
      <svg
        className="pattern-ghost-load-overlay__svg"
        width={vb}
        height={vb}
        viewBox={`0 0 ${vb} ${vb}`}
      >
        <circle
          className="pattern-ghost-load-overlay__track"
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          strokeWidth={STROKE}
        />
        <circle
          className="pattern-ghost-load-overlay__arc"
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${arcLen * 0.35} ${arcLen}`}
          strokeDashoffset={arcLen * 0.65}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <span className="pattern-ghost-load-overlay__hint">
        Загрузка голограммы…
      </span>
    </div>
  );
}
