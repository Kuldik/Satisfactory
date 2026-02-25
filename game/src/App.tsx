// ============================================================
// App — React root component, game canvas + UI overlay
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from './core/Engine.ts';
import { GameMode } from './core/types.ts';
import type { GameState } from './core/types.ts';
import { HUD } from './ui/hud/HUD.tsx';
import { BuildMenu } from './ui/menus/BuildMenu.tsx';
import './App.css';

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

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new Engine(canvas);
    engineRef.current = engine;

    // Listen for state changes
    engine.setOnStateChange((state) => {
      setGameState(state);

      // Open build menu when entering build mode via keyboard
      if (state.mode === GameMode.BuildMode && !state.selectedBuilding) {
        setIsBuildMenuOpen(true);
      }
    });

    engine.start();

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      engine.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
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

  const handleOpenInventory = useCallback(() => {
    // TODO: open inventory modal
    console.log('Open inventory (B)');
  }, []);

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" />

      <HUD
        gameState={gameState}
        onOpenBuildMenu={handleOpenBuildMenu}
        onOpenInventory={handleOpenInventory}
      />

      <BuildMenu
        isOpen={isBuildMenuOpen}
        onClose={handleCloseBuildMenu}
        onSelectBuilding={handleSelectBuilding}
      />
    </div>
  );
}

export default App;
