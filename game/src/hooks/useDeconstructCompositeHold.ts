// ============================================================
// Удержание ЛКМ для полного сноса сборки (compositeId) + оверлей
// ============================================================

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Engine } from "../core/Engine.ts";
import type { DeconstructHoldOverlayHandle } from "../ui/hud/DeconstructHoldOverlay.tsx";

export function useDeconstructCompositeHold(
  engineRef: RefObject<Engine | null>,
  isDeconstructMode: boolean,
  setPlacedCount: Dispatch<SetStateAction<number>>,
  holdMs: number,
): {
  overlayRef: RefObject<DeconstructHoldOverlayHandle | null>;
  resetHoldGesture: () => void;
  handleCompositeMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** true — прервать обработку canvas mouseup (отпустили удержание сноса) */
  handleCompositeMouseUpPhase: () => boolean;
} {
  const overlayRef = useRef<DeconstructHoldOverlayHandle | null>(null);
  const rafRef = useRef(0);
  const targetIdRef = useRef<string | null>(null);
  const startRef = useRef(0);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    targetIdRef.current = null;
    startedRef.current = false;
    overlayRef.current?.hide();
  }, []);

  useEffect(() => {
    if (!isDeconstructMode) return;
    const overlay = overlayRef;
    const onWindowMouseUp = () => {
      if (!rafRef.current && !startedRef.current) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (startedRef.current && !completedRef.current) {
        startedRef.current = false;
        targetIdRef.current = null;
        overlay.current?.hide();
      }
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      targetIdRef.current = null;
      startedRef.current = false;
      queueMicrotask(() => overlay.current?.hide());
    };
  }, [isDeconstructMode]);

  const resetHoldGesture = useCallback(() => {
    completedRef.current = false;
  }, []);

  const handleCompositeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const eng = engineRef.current;
      if (
        !eng ||
        e.button !== 0 ||
        !isDeconstructMode ||
        eng.isPatternGhostActive()
      ) {
        startedRef.current = false;
        return;
      }

      const cid = eng.getDeconstructHoverCompositeId();
      if (!cid) {
        startedRef.current = false;
        return;
      }

      startedRef.current = true;
      targetIdRef.current = cid;
      startRef.current = performance.now();
      overlayRef.current?.show();

      const tick = () => {
        const engine = engineRef.current;
        const tid = targetIdRef.current;
        if (!engine || !tid) {
          cancelHold();
          return;
        }
        if (engine.getDeconstructHoverCompositeId() !== tid) {
          cancelHold();
          return;
        }
        const screenPos = engine.getDeconstructCompositeHoldScreenPosition();
        if (!screenPos) {
          cancelHold();
          return;
        }

        const elapsed = performance.now() - startRef.current;
        const progress = Math.min(1, elapsed / holdMs);
        overlayRef.current?.update(
          progress,
          screenPos.left,
          screenPos.top,
        );

        if (progress >= 1) {
          completedRef.current = true;
          targetIdRef.current = null;
          rafRef.current = 0;
          startedRef.current = false;
          overlayRef.current?.hide();
          engine.removeCompositeBuilding(tid);
          setPlacedCount(engine.getBuilderPlacedCount());
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [isDeconstructMode, cancelHold, engineRef, holdMs, setPlacedCount],
  );

  const handleCompositeMouseUpPhase = useCallback(() => {
    const earlyRelease = startedRef.current && !completedRef.current;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (earlyRelease) {
      startedRef.current = false;
      targetIdRef.current = null;
      overlayRef.current?.hide();
      completedRef.current = false;
      return true;
    }
    completedRef.current = false;
    return false;
  }, []);

  return {
    overlayRef,
    resetHoldGesture,
    handleCompositeMouseDown,
    handleCompositeMouseUpPhase,
  };
}
