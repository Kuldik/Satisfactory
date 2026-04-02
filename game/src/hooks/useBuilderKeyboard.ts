// ============================================================
// Горячие клавиши конструктора, паттерна, демонтажа (F), Ctrl
// ============================================================

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Engine } from "../core/Engine.ts";

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useBuilderKeyboard(
  engineRef: RefObject<Engine | null>,
  isDev: boolean,
  isBuilderActive: boolean,
  isDeconstructMode: boolean,
  isAdminOpen: boolean,
  setIsDeconstructMode: Dispatch<SetStateAction<boolean>>,
  setIsBuilderActive: Dispatch<SetStateAction<boolean>>,
  setBuilderMode: Dispatch<SetStateAction<"single" | "line">>,
  setBuilderScale: Dispatch<SetStateAction<number>>,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        engineRef.current.setBuilderCtrlHeld(true);
      }

      if (engineRef.current.isPatternGhostActive()) {
        if (e.code === "KeyT") {
          engineRef.current.rotatePatternGhost(1);
          e.preventDefault();
        }
        if (e.key === "Escape") {
          engineRef.current.clearPatternGhost();
          e.preventDefault();
        }
        return;
      }

      if (engineRef.current.isPrefabPlacementActive()) {
        if (e.code === "KeyT") {
          engineRef.current.rotateBuilderGhost(1);
          e.preventDefault();
        }
        if (e.key === "Escape") {
          engineRef.current.cancelPrefabPlacement();
          e.preventDefault();
        }
        return;
      }

      if (
        isDev &&
        e.code === "KeyF" &&
        !e.repeat &&
        !isKeyboardTypingTarget(e.target)
      ) {
        const enabled = engineRef.current.toggleBuilderDeconstructMode();
        setIsDeconstructMode(enabled);
        if (enabled) {
          engineRef.current.cancelBuilderGhost();
          setIsBuilderActive(false);
        }
        e.preventDefault();
        return;
      }

      const inBuilderContext =
        isBuilderActive || isDeconstructMode || isAdminOpen;
      if (!inBuilderContext) return;

      if (e.code === "KeyT") {
        if (!isDeconstructMode) {
          engineRef.current.rotateBuilderGhost(1);
          e.preventDefault();
        }
      }
      if (e.code === "KeyR") {
        const nextMode = engineRef.current.cycleBuilderMode();
        setBuilderMode(nextMode);
        e.preventDefault();
      }
      if (e.code === "Equal" || e.code === "NumpadAdd") {
        const nextScale = engineRef.current.adjustBuilderScale(0.1);
        setBuilderScale(nextScale);
        e.preventDefault();
      }
      if (e.code === "Minus" || e.code === "NumpadSubtract") {
        const nextScale = engineRef.current.adjustBuilderScale(-0.1);
        setBuilderScale(nextScale);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        if (isDeconstructMode) {
          engineRef.current.setBuilderDeconstructMode(false);
          setIsDeconstructMode(false);
        }
        engineRef.current.cancelBuilderGhost();
        setIsBuilderActive(false);
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        engineRef.current.setBuilderCtrlHeld(false);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    engineRef,
    isDev,
    isBuilderActive,
    isDeconstructMode,
    isAdminOpen,
    setIsDeconstructMode,
    setIsBuilderActive,
    setBuilderMode,
    setBuilderScale,
  ]);
}
