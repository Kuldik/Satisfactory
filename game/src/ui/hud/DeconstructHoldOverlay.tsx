import { forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslation } from "../../i18n/I18nContext.tsx";
import "./DeconstructHoldOverlay.css";

const R = 36;
const STROKE = 4;
const C = 2 * Math.PI * (R - STROKE / 2);

export type DeconstructHoldOverlayHandle = {
  show: () => void;
  hide: () => void;
  update: (progress: number, left: number, top: number) => void;
};

export const DeconstructHoldOverlay = forwardRef<
  DeconstructHoldOverlayHandle,
  object
>(function DeconstructHoldOverlay(_props, ref) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<SVGCircleElement>(null);

  useImperativeHandle(ref, () => ({
    show: () => {
      const el = rootRef.current;
      if (el) el.style.display = "flex";
    },
    hide: () => {
      const el = rootRef.current;
      if (el) el.style.display = "none";
    },
    update: (progress, left, top) => {
      const root = rootRef.current;
      const fill = fillRef.current;
      if (root) {
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      }
      if (fill) {
        fill.style.strokeDashoffset = String(C * (1 - progress));
      }
    },
  }));

  return (
    <div
      ref={rootRef}
      className="deconstruct-hold-overlay"
      style={{ display: "none" }}
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t("overlays.deconstructHold")}
    >
      <svg
        className="deconstruct-hold-overlay__svg"
        width={R * 2 + 8}
        height={R * 2 + 8}
        viewBox={`0 0 ${R * 2 + 8} ${R * 2 + 8}`}
      >
        <circle
          className="deconstruct-hold-overlay__track"
          cx={R + 4}
          cy={R + 4}
          r={R - STROKE / 2}
          fill="none"
          strokeWidth={STROKE}
        />
        <circle
          ref={fillRef}
          className="deconstruct-hold-overlay__fill"
          cx={R + 4}
          cy={R + 4}
          r={R - STROKE / 2}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={C}
          strokeDashoffset={C}
          transform={`rotate(-90 ${R + 4} ${R + 4})`}
        />
      </svg>
      <span className="deconstruct-hold-overlay__hint">
        {t("overlays.deconstructProgress")}
      </span>
    </div>
  );
});
