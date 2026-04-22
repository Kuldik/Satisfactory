// ============================================================
// Смена темы UI: Tab (без модификаторов вне полей ввода). Сохранение в LS.
// ============================================================

import { useEffect } from "react";
import {
  SCENE_THEME_EVENT,
  UI_THEME_STORAGE_KEY,
  type SceneThemeMode,
} from "../ui/themeSync.ts";

function readStoredTheme(): SceneThemeMode {
  try {
    const v = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(mode: SceneThemeMode): void {
  if (mode === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  window.dispatchEvent(
    new CustomEvent(SCENE_THEME_EVENT, { detail: { mode } }),
  );
}

export function useThemeHotkey(): void {
  useEffect(() => {
    applyTheme(readStoredTheme());

    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)
        return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      const next =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "dark"
          : "light";
      applyTheme(next);
      try {
        localStorage.setItem(UI_THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
