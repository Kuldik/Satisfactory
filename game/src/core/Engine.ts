// ============================================================
// Game Engine — main game loop and system orchestration
// ============================================================

import { TICK_INTERVAL, AUTOSAVE_INTERVAL } from './constants.ts';
import type { GameState } from './types.ts';
import { GameMode } from './types.ts';
import { SceneManager } from '../render/SceneManager.ts';
import { InputManager } from '../input/InputManager.ts';
import { GridManager } from './grid/GridManager.ts';
import { SaveManager } from './save/SaveManager.ts';

export class Engine {
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private gridManager: GridManager;
  private saveManager: SaveManager;

  private gameState: GameState;
  private lastTickTime = 0;
  private tickAccumulator = 0;
  private animationFrameId: number | null = null;
  private autoSaveTimerId: number | null = null;
  private isRunning = false;

  // Callbacks for React UI updates
  private onStateChange: ((state: GameState) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.gameState = {
      mode: GameMode.Playing,
      selectedBuilding: null,
      selectedEntity: null,
      currentFloor: 0,
      isPaused: false,
      gameTime: 0,
    };

    this.sceneManager = new SceneManager(canvas);
    this.inputManager = new InputManager(canvas, this);
    this.gridManager = new GridManager();
    this.saveManager = new SaveManager();
  }

  /** Start the game loop */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = performance.now();

    // Start render loop
    this.animationFrameId = requestAnimationFrame(this.loop);

    // Start auto-save
    this.autoSaveTimerId = window.setInterval(() => {
      this.autoSave();
    }, AUTOSAVE_INTERVAL);

    console.log('[Engine] Game started');
  }

  /** Stop the game loop */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.autoSaveTimerId !== null) {
      clearInterval(this.autoSaveTimerId);
      this.autoSaveTimerId = null;
    }
    console.log('[Engine] Game stopped');
  }

  /** Main game loop (called every frame via requestAnimationFrame) */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTickTime;
    this.lastTickTime = currentTime;

    // Accumulate time for fixed-step simulation
    if (!this.gameState.isPaused) {
      this.tickAccumulator += deltaTime;

      // Run simulation ticks at fixed rate
      while (this.tickAccumulator >= TICK_INTERVAL) {
        this.tick(TICK_INTERVAL / 1000); // pass delta in seconds
        this.tickAccumulator -= TICK_INTERVAL;
      }
    }

    // Process input (every frame)
    this.inputManager.update();

    // Render (every frame, interpolated)
    this.sceneManager.render();

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /** Fixed-rate simulation tick */
  private tick(dt: number): void {
    this.gameState.gameTime += dt;

    // TODO: Run ECS systems here
    // - ProductionSystem
    // - ConveyorSystem
    // - PipeSystem
    // - PowerGridSystem
    // - etc.
  }

  /** Auto-save the game */
  private async autoSave(): Promise<void> {
    if (this.gameState.isPaused) return;
    try {
      await this.saveManager.save(this.createSaveData());
      console.log('[Engine] Auto-saved');
    } catch (err) {
      console.error('[Engine] Auto-save failed:', err);
    }
  }

  /** Create save data snapshot from current state */
  private createSaveData() {
    return {
      version: 1,
      timestamp: Date.now(),
      checksum: '', // Will be computed by SaveManager
      gameTime: this.gameState.gameTime,
      entities: [], // TODO: serialize from ECS
      inventory: {},
      unlockedMilestones: [],
      unlockedRecipes: [],
      milestoneProgress: {},
      cameraPosition: this.sceneManager.getCameraPosition(),
      cameraTarget: this.sceneManager.getCameraTarget(),
    };
  }

  // ---- Public API for UI ----

  getState(): GameState {
    return { ...this.gameState };
  }

  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.getState());
  }

  setMode(mode: GameMode): void {
    this.gameState.mode = mode;
    this.notifyStateChange();
  }

  selectBuilding(buildingId: string | null): void {
    this.gameState.selectedBuilding = buildingId;
    if (buildingId) {
      this.gameState.mode = GameMode.BuildMode;
    }
    this.notifyStateChange();
  }

  setCurrentFloor(floor: number): void {
    this.gameState.currentFloor = floor;
    this.sceneManager.setVisibleFloor(floor);
    this.notifyStateChange();
  }

  togglePause(): void {
    this.gameState.isPaused = !this.gameState.isPaused;
    this.notifyStateChange();
  }

  getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  getGridManager(): GridManager {
    return this.gridManager;
  }

  /** Handle window resize */
  resize(width: number, height: number): void {
    this.sceneManager.resize(width, height);
  }

  /** Clean up resources */
  dispose(): void {
    this.stop();
    this.sceneManager.dispose();
    this.inputManager.dispose();
  }
}
