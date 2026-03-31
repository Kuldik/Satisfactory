// ============================================================
// App — React root component, game canvas + UI overlay
// ============================================================

import { useCallback, useRef, useState, type MouseEvent } from "react";
import { GameMode } from "./core/types.ts";
import type { GameState } from "./core/types.ts";
import { HUD } from "./ui/hud/HUD.tsx";
import { DeconstructHoldOverlay } from "./ui/hud/DeconstructHoldOverlay.tsx";
import { BuildMenu } from "./ui/menus/BuildMenu.tsx";
import { AdminPanel } from "./ui/admin/AdminPanel.tsx";
import { useGameEngine } from "./hooks/useGameEngine.ts";
import { useDeconstructCompositeHold } from "./hooks/useDeconstructCompositeHold.ts";
import { useBuilderKeyboard } from "./hooks/useBuilderKeyboard.ts";
import { useWindowShortcutGuards } from "./hooks/useWindowShortcutGuards.ts";
import { useAdminPanelHotkey } from "./hooks/useAdminPanelHotkey.ts";
import "./App.css";

const IS_DEV = true; // TODO: revert to `import.meta.env.DEV !== false` for dev-only access

const DECONSTRUCT_COMPOSITE_HOLD_MS = 2000;

function App() {
  const [gameState, setGameState] = useState<GameState>({
    mode: GameMode.Playing,
    selectedBuilding: null,
    selectedEntity: null,
    currentFloor: 0,
    isPaused: false,
    gameTime: 0,
  });
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isBuilderActive, setIsBuilderActive] = useState(false);
  const [isDeconstructMode, setIsDeconstructMode] = useState(false);
  const [builderMode, setBuilderMode] = useState<"single" | "line">("single");
  const [builderScale, setBuilderScale] = useState(1);
  const [placedCount, setPlacedCount] = useState(0);

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const lastBuilderPartPathRef = useRef<string | null>(null);

  const { canvasRef, engineRef } = useGameEngine(
    setGameState,
    setIsBuildMenuOpen,
    setPlacedCount,
    setBuilderScale,
    setBuilderMode,
    setIsDeconstructMode,
  );

  const {
    overlayRef: deconstructHoldOverlayRef,
    resetHoldGesture,
    handleCompositeMouseDown,
    handleCompositeMouseUpPhase,
  } = useDeconstructCompositeHold(
    engineRef,
    isDeconstructMode,
    setPlacedCount,
    DECONSTRUCT_COMPOSITE_HOLD_MS,
  );

  useBuilderKeyboard(
    engineRef,
    IS_DEV,
    isBuilderActive,
    isDeconstructMode,
    isAdminOpen,
    setIsDeconstructMode,
    setIsBuilderActive,
    setBuilderMode,
    setBuilderScale,
  );
  useWindowShortcutGuards();
  useAdminPanelHotkey(IS_DEV, setIsAdminOpen);

  const handleOpenBuildMenu = useCallback(() => {
    setIsBuildMenuOpen(true);
    engineRef.current?.setMode(GameMode.BuildMode);
  }, [engineRef]);

  const handleCloseBuildMenu = useCallback(() => {
    setIsBuildMenuOpen(false);
    if (!gameState.selectedBuilding) {
      engineRef.current?.setMode(GameMode.Playing);
    }
  }, [engineRef, gameState.selectedBuilding]);

  const handleSelectBuilding = useCallback(
    (buildingId: string) => {
      engineRef.current?.selectBuilding(buildingId);
      setIsBuildMenuOpen(false);
    },
    [engineRef],
  );

  const handleOpenAdminPanel = useCallback(() => setIsAdminOpen(true), []);

  const handleSelectComposition = useCallback(
    (compositionId: string) => {
      if (!engineRef.current) return;
      engineRef.current.selectBuilding(compositionId);
      setIsAdminOpen(false);
    },
    [engineRef],
  );

  const handleSelectBuilderPart = useCallback(
    async (partPath: string) => {
      if (!engineRef.current) return;
      if (engineRef.current.isBuilderDeconstructMode()) {
        engineRef.current.setBuilderDeconstructMode(false);
        setIsDeconstructMode(false);
      }
      setIsBuilderActive(true);
      await engineRef.current.enterBuilderPartMode(partPath);

      const partChanged = lastBuilderPartPathRef.current !== partPath;
      lastBuilderPartPathRef.current = partPath;

      if (partChanged) {
        if (
          partPath.includes("gutter-vertical-bottom") ||
          partPath.includes("gutter-vertical-top")
        ) {
          setBuilderScale(engineRef.current.setBuilderScale(20));
        } else {
          setBuilderScale(engineRef.current.setBuilderScale(3));
        }
      } else {
        setBuilderScale(engineRef.current.getBuilderScale());
      }
    },
    [engineRef],
  );

  const handleClearComposition = useCallback(() => {
    engineRef.current?.clearBuilderComposition();
    setPlacedCount(engineRef.current?.getBuilderPlacedCount() ?? 0);
  }, [engineRef]);

  const handleExportRequest = useCallback(
    () => engineRef.current?.exportBuilderComposition() ?? '{"parts":[]}',
    [engineRef],
  );

  const handleImportRequest = useCallback(
    async (json: string): Promise<number> => {
      if (!engineRef.current) return 0;
      const count = await engineRef.current.importBuilderComposition(json);
      setPlacedCount(engineRef.current.getBuilderPlacedCount());
      return count;
    },
    [engineRef],
  );

  const handleSetBuilderMode = useCallback(
    (mode: "single" | "line") => {
      if (!engineRef.current) return;
      engineRef.current.setBuilderMode(mode);
      setBuilderMode(engineRef.current.getBuilderMode());
    },
    [engineRef],
  );

  const handleToggleDeconstruct = useCallback(() => {
    if (!engineRef.current) return;
    const enabled = engineRef.current.toggleBuilderDeconstructMode();
    setIsDeconstructMode(enabled);
    if (enabled) {
      setIsBuilderActive(false);
      engineRef.current.cancelBuilderGhost();
    }
  }, [engineRef]);

  const handleAdjustScale = useCallback(
    (delta: number) => {
      if (!engineRef.current) return;
      setBuilderScale(engineRef.current.adjustBuilderScale(delta));
    },
    [engineRef],
  );

  const handleOpenInventory = useCallback(() => {
    console.log("Open inventory (B)");
  }, []);

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!engineRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (engineRef.current.isPatternGhostActive()) {
        engineRef.current.updatePatternGhost(ndcX, ndcY);
      }
      if (isDeconstructMode) {
        engineRef.current.updateBuilderGhost(ndcX, ndcY);
      } else if (isBuilderActive) {
        engineRef.current.updateBuilderGhost(ndcX, ndcY);
      }
    },
    [engineRef, isBuilderActive, isDeconstructMode],
  );

  const handleCanvasMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      resetHoldGesture();
      handleCompositeMouseDown(e);
    },
    [resetHoldGesture, handleCompositeMouseDown],
  );

  const handleCanvasMouseUp = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!engineRef.current || !mouseDownPos.current) return;

      if (handleCompositeMouseUpPhase()) return;

      const dx = Math.abs(e.clientX - mouseDownPos.current.x);
      const dy = Math.abs(e.clientY - mouseDownPos.current.y);
      const maxDrift = isDeconstructMode ? 20 : 5;
      if (dx >= maxDrift || dy >= maxDrift) return;

      if (engineRef.current.isPatternGhostActive()) {
        if (e.button === 0) {
          engineRef.current
            .placePattern()
            .then((ok) => {
              if (ok) setPlacedCount(engineRef.current!.getBuilderPlacedCount());
            })
            .catch((err) => console.error("[Pattern] place failed:", err));
        } else if (e.button === 2) {
          engineRef.current.clearPatternGhost();
        }
        return;
      }

      if (!isBuilderActive && !isDeconstructMode) return;
      if (e.button === 0) {
        engineRef.current.placeBuilderPart();
        setPlacedCount(engineRef.current.getBuilderPlacedCount());
      } else if (e.button === 2) {
        if (!isDeconstructMode) {
          engineRef.current.cancelBuilderGhost();
          setIsBuilderActive(false);
        }
      }
    },
    [
      engineRef,
      isBuilderActive,
      isDeconstructMode,
      handleCompositeMouseUpPhase,
    ],
  );

  const handleCanvasContextMenu = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (
        isBuilderActive ||
        isDeconstructMode ||
        engineRef.current?.isPatternGhostActive()
      ) {
        e.preventDefault();
      }
    },
    [engineRef, isBuilderActive, isDeconstructMode],
  );

  return (
    <div
      className={`game-container${IS_DEV && isDeconstructMode ? " game-container--deconstruct" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={handleCanvasContextMenu}
      />

      <HUD
        gameState={gameState}
        onOpenBuildMenu={handleOpenBuildMenu}
        onOpenInventory={handleOpenInventory}
        onOpenAdminPanel={IS_DEV ? handleOpenAdminPanel : undefined}
        isBuilderActive={isBuilderActive || isDeconstructMode}
        isDeconstructMode={IS_DEV ? isDeconstructMode : false}
        onToggleDeconstruct={IS_DEV ? handleToggleDeconstruct : undefined}
      />

      <BuildMenu
        isOpen={isBuildMenuOpen}
        onClose={handleCloseBuildMenu}
        onSelectBuilding={handleSelectBuilding}
      />

      {IS_DEV && isDeconstructMode && (
        <DeconstructHoldOverlay ref={deconstructHoldOverlayRef} />
      )}

      {IS_DEV && (
        <AdminPanel
          isOpen={isAdminOpen}
          isBuilderActive={isBuilderActive}
          isDeconstructMode={isDeconstructMode}
          placedCount={placedCount}
          builderScale={builderScale}
          builderMode={builderMode}
          onClose={() => setIsAdminOpen(false)}
          onSelectPart={handleSelectBuilderPart}
          onSelectComposition={handleSelectComposition}
          onClearComposition={handleClearComposition}
          onExportRequest={handleExportRequest}
          onImportRequest={handleImportRequest}
          onSetBuilderMode={handleSetBuilderMode}
          onToggleDeconstructMode={handleToggleDeconstruct}
          onAdjustScale={handleAdjustScale}
        />
      )}
    </div>
  );
}

export default App;
