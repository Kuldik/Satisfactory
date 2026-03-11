// ============================================================
// App — React root component, game canvas + UI overlay
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from './core/Engine.ts';
import { GameMode } from './core/types.ts';
import type { GameState } from './core/types.ts';
import { HUD } from './ui/hud/HUD.tsx';
import { BuildMenu } from './ui/menus/BuildMenu.tsx';
import { AdminPanel } from './ui/admin/AdminPanel.tsx';
import './App.css';

const IS_DEV = true; // TODO: revert to `import.meta.env.DEV !== false` for dev-only access

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    mode: GameMode.Playing,
    selectedBuilding: null,
    selectedEntity: null,
    currentFloor: 0,
    isPaused: false,
    gameTime: 0,
  });
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);

  // Admin builder state (DEV only)
  const [isAdminOpen, setIsAdminOpen]       = useState(false);
  const [isBuilderActive, setIsBuilderActive] = useState(false);
  const [isDeconstructMode, setIsDeconstructMode] = useState(false);
  const [builderMode, setBuilderMode] = useState<'single' | 'line'>('single');
  const [builderScale, setBuilderScale] = useState(1);
  const [placedCount, setPlacedCount]       = useState(0);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new Engine(canvas);
    engineRef.current = engine;
    setPlacedCount(engine.getBuilderPlacedCount());
    setBuilderScale(engine.getBuilderScale());
    setBuilderMode(engine.getBuilderMode());
    setIsDeconstructMode(engine.isBuilderDeconstructMode());

    // Listen for state changes
    engine.setOnStateChange((state) => {
      setGameState(state);

      // Open build menu when entering build mode via keyboard
      if (state.mode === GameMode.BuildMode && !state.selectedBuilding) {
        setIsBuildMenuOpen(true);
      }
    });

    engine.start();
    const syncBuilderStateTimer = window.setTimeout(() => {
      setPlacedCount(engine.getBuilderPlacedCount());
      setBuilderScale(engine.getBuilderScale());
      setBuilderMode(engine.getBuilderMode());
      setIsDeconstructMode(engine.isBuilderDeconstructMode());
    }, 400);

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      engine.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(syncBuilderStateTimer);
      engine.dispose();
    };
  }, []);

  // Build menu handlers
  const handleOpenBuildMenu = useCallback(() => {
    setIsBuildMenuOpen(true);
    engineRef.current?.setMode(GameMode.BuildMode);
  }, []);

  const handleCloseBuildMenu = useCallback(() => {
    setIsBuildMenuOpen(false);
    if (!gameState.selectedBuilding) {
      engineRef.current?.setMode(GameMode.Playing);
    }
  }, [gameState.selectedBuilding]);

  const handleSelectBuilding = useCallback((buildingId: string) => {
    engineRef.current?.selectBuilding(buildingId);
    setIsBuildMenuOpen(false);
  }, []);

  // ---- Admin builder handlers ----
  const handleOpenAdminPanel = useCallback(() => setIsAdminOpen(true), []);

  const handleSelectBuilderPart = useCallback(async (partPath: string) => {
    if (!engineRef.current) return;
    if (engineRef.current.isBuilderDeconstructMode()) {
      engineRef.current.setBuilderDeconstructMode(false);
      setIsDeconstructMode(false);
    }
    setIsBuilderActive(true);
    await engineRef.current.enterBuilderPartMode(partPath);
    setBuilderScale(engineRef.current.getBuilderScale());
  }, []);

  const handleClearComposition = useCallback(() => {
    engineRef.current?.clearBuilderComposition();
    setPlacedCount(engineRef.current?.getBuilderPlacedCount() ?? 0);
  }, []);

  const handleExportRequest = useCallback((): string => {
    return engineRef.current?.exportBuilderComposition() ?? '{}';
  }, []);

  const handleImportRequest = useCallback(async (json: string): Promise<number> => {
    if (!engineRef.current) return 0;
    const count = await engineRef.current.importBuilderComposition(json);
    setPlacedCount(engineRef.current.getBuilderPlacedCount());
    return count;
  }, []);

  const handleSetBuilderMode = useCallback((mode: 'single' | 'line') => {
    if (!engineRef.current) return;
    engineRef.current.setBuilderMode(mode);
    setBuilderMode(engineRef.current.getBuilderMode());
  }, []);

  const handleToggleDeconstruct = useCallback(() => {
    if (!engineRef.current) return;
    const enabled = engineRef.current.toggleBuilderDeconstructMode();
    setIsDeconstructMode(enabled);
    if (enabled) {
      setIsBuilderActive(false);
      engineRef.current.cancelBuilderGhost();
    }
  }, []);

  const handleAdjustScale = useCallback((delta: number) => {
    if (!engineRef.current) return;
    const next = engineRef.current.adjustBuilderScale(delta);
    setBuilderScale(next);
  }, []);

  // Builder hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      // Track Ctrl for edge-alignment snap (always, not just in builder context)
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        engineRef.current.setBuilderCtrlHeld(true);
      }

      // Pattern ghost hotkeys (building placement from Build Menu)
      if (engineRef.current.isPatternGhostActive()) {
        if (e.code === 'KeyT') {
          engineRef.current.rotatePatternGhost(1);
          e.preventDefault();
        }
        if (e.key === 'Escape') {
          engineRef.current.clearPatternGhost();
          e.preventDefault();
        }
        return;
      }

      const inBuilderContext = isBuilderActive || isDeconstructMode || isAdminOpen;
      if (!inBuilderContext) return;

      if (e.code === 'KeyT') {
        if (!isDeconstructMode) {
          engineRef.current.rotateBuilderGhost(1);
          e.preventDefault();
        }
      }
      if (e.code === 'KeyR') {
        const nextMode = engineRef.current.cycleBuilderMode();
        setBuilderMode(nextMode);
        e.preventDefault();
      }
      if (e.code === 'KeyF') {
        const enabled = engineRef.current.toggleBuilderDeconstructMode();
        setIsDeconstructMode(enabled);
        if (enabled) {
          engineRef.current.cancelBuilderGhost();
          setIsBuilderActive(false);
        }
        e.preventDefault();
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        const nextScale = engineRef.current.adjustBuilderScale(0.1);
        setBuilderScale(nextScale);
        e.preventDefault();
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        const nextScale = engineRef.current.adjustBuilderScale(-0.1);
        setBuilderScale(nextScale);
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        if (isDeconstructMode) {
          engineRef.current.setBuilderDeconstructMode(false);
          setIsDeconstructMode(false);
        }
        engineRef.current?.cancelBuilderGhost();
        setIsBuilderActive(false);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        engineRef.current.setBuilderCtrlHeld(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isBuilderActive, isDeconstructMode, isAdminOpen]);

  // Prevent accidental browser shortcuts (Ctrl+W, Ctrl+S, Ctrl+Q, etc.) while in game
  useEffect(() => {
    const interceptBrowserShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyQ')) {
        e.preventDefault();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('keydown', interceptBrowserShortcuts, { capture: true });
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('keydown', interceptBrowserShortcuts, { capture: true });
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  // Open admin panel on backtick / tilde (DEV shortcut)
  useEffect(() => {
    if (!IS_DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') setIsAdminOpen(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleOpenInventory = useCallback(() => {
    // TODO: open inventory modal
    console.log('Open inventory (B)');
  }, []);

  // Mouse handlers for builder ghost AND pattern ghost
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ndcX =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    if (engineRef.current.isPatternGhostActive()) {
      engineRef.current.updatePatternGhost(ndcX, ndcY);
    } else if (isBuilderActive || isDeconstructMode) {
      engineRef.current.updateBuilderGhost(ndcX, ndcY);
    }
  }, [isBuilderActive, isDeconstructMode]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx >= 5 || dy >= 5) return;

    // Pattern ghost mode (building from Build Menu)
    if (engineRef.current.isPatternGhostActive()) {
      if (e.button === 0) {
        void engineRef.current.placePattern().then(() => {
          setPlacedCount(engineRef.current!.getBuilderPlacedCount());
        });
      } else if (e.button === 2) {
        engineRef.current.clearPatternGhost();
      }
      return;
    }

    // Admin builder mode
    if (!isBuilderActive && !isDeconstructMode) return;
    if (e.button === 0) {
      engineRef.current.placeBuilderPart();
      setPlacedCount(engineRef.current.getBuilderPlacedCount());
    } else if (e.button === 2) {
      if (isDeconstructMode) {
        engineRef.current.setBuilderDeconstructMode(false);
        setIsDeconstructMode(false);
      } else {
        engineRef.current.cancelBuilderGhost();
        setIsBuilderActive(false);
      }
    }
  }, [isBuilderActive, isDeconstructMode]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBuilderActive || isDeconstructMode || engineRef.current?.isPatternGhostActive()) {
      e.preventDefault();
    }
  }, [isBuilderActive, isDeconstructMode]);

  return (
    <div className="game-container">
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
      />

      <BuildMenu
        isOpen={isBuildMenuOpen}
        onClose={handleCloseBuildMenu}
        onSelectBuilding={handleSelectBuilding}
      />

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
