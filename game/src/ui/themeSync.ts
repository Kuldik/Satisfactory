// ============================================================
// Общая синхронизация UI-темы и 3D-сцены (localStorage + событие)
// ============================================================

export const UI_THEME_STORAGE_KEY = "satisfactory-ui-theme-v1";

/** Событие после смены `data-theme` (Tab); слушает useGameEngine → SceneManager. */
export const SCENE_THEME_EVENT = "satisfactory-scene-theme";

export type SceneThemeMode = "dark" | "light";

export function getDocumentSceneTheme(): SceneThemeMode {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** Вызвать до `new Engine()`, чтобы CSS и сцена совпали с сохранённой темой. */
export function applyStoredDocumentThemeEarly(): void {
  try {
    if (localStorage.getItem(UI_THEME_STORAGE_KEY) === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {
    /* ignore */
  }
}
