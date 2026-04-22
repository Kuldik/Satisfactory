// ============================================================
// Game Engine — main game loop and system orchestration
// ============================================================

import { TICK_INTERVAL, AUTOSAVE_INTERVAL } from './constants.ts';
import type { GameState, BuilderMode } from './types.ts';
import { GameMode } from './types.ts';
import { SceneManager } from '../render/SceneManager.ts';
import { InputManager } from '../input/InputManager.ts';
import { GridManager } from './grid/GridManager.ts';
import { SaveManager } from './save/SaveManager.ts';
import { getBuildingPattern } from '../buildings/BuildingPatterns.ts';
import { getBuildingPrefab } from '../buildings/BuildingPrefabs.ts';
import { isConveyorBeltMenuId } from '../buildings/logistics/conveyorKitModels.ts';
import {
  isPipeJunctionMenuId,
  isPipeLineMenuId,
} from '../buildings/logistics/pipeKitModels.ts';

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

  async selectBuilding(buildingId: string | null): Promise<void> {
    if (!buildingId) {
      this.sceneManager.abortPatternGhostLoad();
      this.sceneManager.clearBuilderGhost();
      this.gameState.selectedBuilding = null;
      this.notifyStateChange();
      return;
    }
    /** Иначе updateBuilderGhostPosition сразу выходит и префаб-призрак не ставится на сетку; ЛКМ не срабатывает */
    this.sceneManager.setBuilderDeconstructMode(false);
    this.gameState.selectedBuilding = buildingId;
    this.gameState.mode = GameMode.BuildMode;
    const pattern = getBuildingPattern(buildingId);
    if (pattern) {
      this.sceneManager.clearBuilderGhost();
      try {
        await this.sceneManager.setPatternGhost(buildingId, pattern.parts);
      } catch (err) {
        console.error("[Engine] Pattern ghost failed:", buildingId, err);
      }
    } else {
      const prefab = getBuildingPrefab(buildingId);
      this.sceneManager.abortPatternGhostLoad();
      if (prefab) {
        try {
          await this.sceneManager.setPrefabBuildingGhost(
            prefab.modelPath,
            prefab.scale,
            buildingId,
          );
        } catch (err) {
          console.error("[Engine] Prefab ghost failed:", buildingId, err);
        }
      } else {
        this.sceneManager.clearBuilderGhost();
      }
      if (isConveyorBeltMenuId(buildingId) || isPipeLineMenuId(buildingId)) {
        this.sceneManager.setBuilderMode("default");
      } else if (isPipeJunctionMenuId(buildingId)) {
        this.sceneManager.setBuilderMode("single");
      }
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

  // ---- Admin Builder API ----

  async enterBuilderPartMode(partPath: string): Promise<void> {
    await this.sceneManager.setBuilderGhost(partPath);
  }

  updateBuilderGhost(ndcX: number, ndcY: number): void {
    this.sceneManager.updateBuilderGhostPosition(ndcX, ndcY);
  }

  placeBuilderPart(): boolean {
    return this.sceneManager.placeBuilderPart();
  }

  rotateBuilderGhost(dir: 1 | -1): void {
    this.sceneManager.rotateBuilderGhost(dir);
  }

  cancelBuilderGhost(): void {
    this.sceneManager.clearBuilderGhost();
  }

  clearBuilderComposition(): void {
    this.sceneManager.clearBuilderComposition();
  }

  exportBuilderComposition(): string {
    return this.sceneManager.exportBuilderComposition();
  }

  async importBuilderComposition(json: string): Promise<number> {
    return this.sceneManager.importBuilderComposition(json);
  }

  adjustBuilderScale(delta: number): number {
    return this.sceneManager.adjustBuilderScale(delta);
  }

  getBuilderScale(): number {
    return this.sceneManager.getBuilderScale();
  }

  setBuilderScale(value: number): number {
    return this.sceneManager.setBuilderScale(value);
  }

  cycleBuilderMode(): BuilderMode {
    return this.sceneManager.cycleBuilderMode();
  }

  setBuilderMode(mode: BuilderMode): void {
    this.sceneManager.setBuilderMode(mode);
  }

  getBuilderMode(): BuilderMode {
    return this.sceneManager.getBuilderMode();
  }

  toggleBuilderDeconstructMode(): boolean {
    return this.sceneManager.toggleBuilderDeconstructMode();
  }

  setBuilderDeconstructMode(enabled: boolean): void {
    this.sceneManager.setBuilderDeconstructMode(enabled);
  }

  isBuilderDeconstructMode(): boolean {
    return this.sceneManager.isBuilderDeconstructMode();
  }

  getDeconstructHoverCompositeId(): string | undefined {
    return this.sceneManager.getDeconstructHoverCompositeId();
  }

  isDeconstructStandaloneLogisticsHover(): boolean {
    return this.sceneManager.isDeconstructStandaloneLogisticsHover();
  }

  getDeconstructHoldMsForCurrentHover(): number {
    return this.sceneManager.getDeconstructHoldMsForCurrentHover();
  }

  removeDeconstructHoveredStandalone(): boolean {
    return this.sceneManager.removeDeconstructHoveredStandalone();
  }

  getDeconstructCompositeHoldScreenPosition(): {
    left: number;
    top: number;
  } | null {
    return this.sceneManager.getDeconstructCompositeHoldScreenPosition();
  }

  removeCompositeBuilding(compositeId: string): number {
    return this.sceneManager.removeCompositeBuilding(compositeId);
  }

  /** After toggling deconstruct without moving the mouse, refresh hover highlight. */
  refreshDeconstructHoverFromPointer(): void {
    this.sceneManager.refreshDeconstructHoverFromPointer();
  }

  getBuilderPlacedCount(): number {
    return this.sceneManager.getBuilderPlacedCount();
  }

  isBuilderGhostActive(): boolean {
    return this.sceneManager.isBuilderGhostActive();
  }

  setBuilderCtrlHeld(held: boolean): void {
    this.sceneManager.setBuilderCtrlHeld(held);
  }

  // ---- Pattern (composite building) API ----

  updatePatternGhost(ndcX: number, ndcY: number): void {
    this.sceneManager.updatePatternGhostPosition(ndcX, ndcY);
  }

  async placePattern(): Promise<boolean> {
    const ok = await this.sceneManager.placePattern();
    if (ok) {
      this.gameState.selectedBuilding = null;
      this.gameState.mode = GameMode.Playing;
      this.notifyStateChange();
    }
    return ok;
  }

  rotatePatternGhost(dir: 1 | -1): void {
    this.sceneManager.rotatePatternGhost(dir);
  }

  clearPatternGhost(): void {
    this.sceneManager.abortPatternGhostLoad();
    this.gameState.selectedBuilding = null;
    this.gameState.mode = GameMode.Playing;
    this.notifyStateChange();
  }

  isPatternGhostActive(): boolean {
    return this.sceneManager.isPatternGhostActive();
  }

  isPrefabPlacementActive(): boolean {
    return this.sceneManager.isPrefabPlacementActive();
  }

  /** ЛКМ после выбора одиночного GLB из меню (особые, производство, генераторы и т.д.) */
  placePrefabFromMenu(): boolean {
    if (!this.sceneManager.isPrefabPlacementActive()) return false;
    const ok = this.sceneManager.placeBuilderPart();
    if (ok && !this.sceneManager.hasActiveConveyorLine()) {
      this.gameState.selectedBuilding = null;
      this.gameState.mode = GameMode.Playing;
      this.notifyStateChange();
    }
    return ok;
  }

  hasActiveConveyorLine(): boolean {
    return this.sceneManager.hasActiveConveyorLine();
  }

  cancelConveyorLine(): void {
    this.sceneManager.cancelConveyorLine();
  }

  cancelPrefabPlacement(): void {
    const id = this.gameState.selectedBuilding;
    if (!id || !getBuildingPrefab(id)) return;
    this.sceneManager.clearBuilderGhost();
    this.gameState.selectedBuilding = null;
    this.gameState.mode = GameMode.Playing;
    this.notifyStateChange();
  }

  // ---- Handle window resize ----

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
