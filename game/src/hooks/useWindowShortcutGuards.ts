// ============================================================
// Блокировка Ctrl+W/S/Q и beforeunload (игра в фокусе)
// ============================================================

import { useEffect } from "react";

export function useWindowShortcutGuards(): void {
  useEffect(() => {
    const interceptBrowserShortcuts = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        (e.code === "KeyW" || e.code === "KeyS" || e.code === "KeyQ")
      ) {
        e.preventDefault();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("keydown", interceptBrowserShortcuts, {
      capture: true,
    });
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", interceptBrowserShortcuts, {
        capture: true,
      });
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
}
