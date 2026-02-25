// ============================================================
// InputManager — keyboard and mouse input handling
// ============================================================

import { KEYBINDS } from '../core/constants.ts';
import type { Engine } from '../core/Engine.ts';
import { GameMode } from '../core/types.ts';

export class InputManager {
  private canvas: HTMLCanvasElement;
  private engine: Engine;

  private keysDown = new Set<string>();
  private keysPressed = new Set<string>(); // single-frame press
  private mousePosition = { x: 0, y: 0 };
  private isMouseDown = false;

  constructor(canvas: HTMLCanvasElement, engine: Engine) {
    this.canvas = canvas;
    this.engine = engine;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keysDown.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keysDown.add(e.code);

    // Handle key shortcuts
    this.handleKeyShortcuts(e);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePosition.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePosition.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private onMouseDown = (_e: MouseEvent): void => {
    this.isMouseDown = true;
  };

  private onMouseUp = (_e: MouseEvent): void => {
    this.isMouseDown = false;
  };

  /** Handle key shortcuts for menus etc. */
  private handleKeyShortcuts(e: KeyboardEvent): void {
    const state = this.engine.getState();

    // Q — toggle build menu
    if (e.code === KEYBINDS.buildMenu) {
      if (state.mode === GameMode.BuildMode) {
        this.engine.setMode(GameMode.Playing);
      } else {
        this.engine.setMode(GameMode.BuildMode);
      }
      e.preventDefault();
    }

    // B — toggle inventory
    if (e.code === KEYBINDS.inventory) {
      // TODO: toggle inventory UI
      e.preventDefault();
    }

    // Escape — cancel current action / close menu
    if (e.code === KEYBINDS.escape) {
      if (state.mode !== GameMode.Playing) {
        this.engine.setMode(GameMode.Playing);
      }
      this.engine.selectBuilding(null);
      e.preventDefault();
    }

    // R — rotate building
    if (e.code === KEYBINDS.rotate) {
      // TODO: rotate selected building placement preview
      e.preventDefault();
    }

    // PageUp / PageDown — change floor
    if (e.code === KEYBINDS.floorUp) {
      this.engine.setCurrentFloor(state.currentFloor + 1);
      e.preventDefault();
    }
    if (e.code === KEYBINDS.floorDown) {
      this.engine.setCurrentFloor(Math.max(0, state.currentFloor - 1));
      e.preventDefault();
    }

    // Ctrl+S — manual save
    if (e.code === KEYBINDS.save && e.ctrlKey) {
      // TODO: manual save
      e.preventDefault();
    }
  }

  /** Called every frame — clear single-frame pressed keys */
  update(): void {
    this.keysPressed.clear();
  }

  /** Check if a key is currently held down */
  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** Check if a key was just pressed this frame */
  isKeyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /** Get mouse position in normalized device coords (-1 to 1) */
  getMouseNDC(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  /** Is left mouse button held */
  isMouseHeld(): boolean {
    return this.isMouseDown;
  }

  /** Clean up */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
  }
}
