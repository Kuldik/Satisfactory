// ============================================================
// DEV: открыть админку по ` или ~
// ============================================================

import { useEffect, type Dispatch, type SetStateAction } from "react";

export function useAdminPanelHotkey(
  isDev: boolean,
  setIsAdminOpen: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (!isDev) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "~") setIsAdminOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDev, setIsAdminOpen]);
}
