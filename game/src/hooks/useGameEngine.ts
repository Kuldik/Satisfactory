// ============================================================
// Инициализация Engine, resize, dispose, синхронизация builder state
// ============================================================

import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { Engine } from "../core/Engine.ts";
import { GameMode } from "../core/types.ts";
import type { GameState, BuilderMode } from "../core/types.ts";
import {
  applyStoredDocumentThemeEarly,
  getDocumentSceneTheme,
  SCENE_THEME_EVENT,
} from "../ui/themeSync.ts";

export function useGameEngine(
  setGameState: Dispatch<SetStateAction<GameState>>,
  setIsBuildMenuOpen: Dispatch<SetStateAction<boolean>>,
  setPlacedCount: Dispatch<SetStateAction<number>>,
  setBuilderScale: Dispatch<SetStateAction<number>>,
  setBuilderMode: Dispatch<SetStateAction<BuilderMode>>,
  setIsDeconstructMode: Dispatch<SetStateAction<boolean>>,
): {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engineRef: RefObject<Engine | null>;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    applyStoredDocumentThemeEarly();

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new Engine(canvas);
    engineRef.current = engine;
    setPlacedCount(engine.getBuilderPlacedCount());
    setBuilderScale(engine.getBuilderScale());
    setBuilderMode(engine.getBuilderMode());
    setIsDeconstructMode(engine.isBuilderDeconstructMode());

    engine.setOnStateChange((state) => {
      setGameState(state);
      if (state.mode === GameMode.BuildMode && !state.selectedBuilding) {
        setIsBuildMenuOpen(true);
      }
    });

    engine.start();
    engine.getSceneManager().setVisualTheme(getDocumentSceneTheme());
    void engine
      .getSceneManager()
      .whenBuilderReady()
      .then(() => engine.loadPersisted());

    const onSceneTheme = (e: Event): void => {
      const mode = (e as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode === "light" || mode === "dark") {
        engine.getSceneManager().setVisualTheme(mode);
      }
    };
    window.addEventListener(SCENE_THEME_EVENT, onSceneTheme);

    const syncBuilderStateTimer = window.setTimeout(() => {
      setPlacedCount(engine.getBuilderPlacedCount());
      setBuilderScale(engine.getBuilderScale());
      setBuilderMode(engine.getBuilderMode());
      setIsDeconstructMode(engine.isBuilderDeconstructMode());
    }, 400);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      engine.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener(SCENE_THEME_EVENT, onSceneTheme);
      window.clearTimeout(syncBuilderStateTimer);
      engine.dispose();
    };
  }, [
    setGameState,
    setIsBuildMenuOpen,
    setPlacedCount,
    setBuilderScale,
    setBuilderMode,
    setIsDeconstructMode,
  ]);

  return { canvasRef, engineRef };
}
