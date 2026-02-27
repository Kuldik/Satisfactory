// ============================================================
// Command Pattern — for multiplayer-ready action system
// ============================================================

import type { GridPosition, Rotation, EntityId } from '../types.ts';

/** Base command interface */
export interface Command {
  type: string;
  timestamp: number;
  /** Execute the command, return true if successful */
  execute(): boolean;
  /** Undo the command */
  undo(): void;
  /** Serialize for network transmission */
  serialize(): Record<string, unknown>;
}

/** Place a building command */
export class PlaceBuildingCommand implements Command {
  type = 'place_building';
  timestamp: number;

  constructor(
    public buildingId: string,
    public position: GridPosition,
    public rotation: Rotation,
    private onExecute: (cmd: PlaceBuildingCommand) => EntityId | null,
    private onUndo: (entityId: EntityId) => void,
  ) {
    this.timestamp = Date.now();
  }

  private resultEntityId: EntityId | null = null;

  execute(): boolean {
    this.resultEntityId = this.onExecute(this);
    return this.resultEntityId !== null;
  }

  undo(): void {
    if (this.resultEntityId !== null) {
      this.onUndo(this.resultEntityId);
      this.resultEntityId = null;
    }
  }

  getEntityId(): EntityId | null {
    return this.resultEntityId;
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      timestamp: this.timestamp,
      buildingId: this.buildingId,
      position: this.position,
      rotation: this.rotation,
    };
  }
}

/** Remove a building command */
export class RemoveBuildingCommand implements Command {
  type = 'remove_building';
  timestamp: number;

  constructor(
    public entityId: EntityId,
    public position: GridPosition,
    public buildingId: string,
    public rotation: Rotation,
    private onExecute: (cmd: RemoveBuildingCommand) => boolean,
    private onUndo: (cmd: RemoveBuildingCommand) => EntityId | null,
  ) {
    this.timestamp = Date.now();
  }

  execute(): boolean {
    return this.onExecute(this);
  }

  undo(): void {
    this.onUndo(this);
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      timestamp: this.timestamp,
      entityId: this.entityId,
      position: this.position,
      buildingId: this.buildingId,
      rotation: this.rotation,
    };
  }
}

/** Command history for undo/redo */
export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;

  /** Execute a command and add to history */
  execute(command: Command): boolean {
    const success = command.execute();
    if (success) {
      this.undoStack.push(command);
      this.redoStack.length = 0; // Clear redo on new action

      // Trim history
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
    }
    return success;
  }

  /** Undo the last command */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  /** Redo the last undone command */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    const success = command.execute();
    if (success) {
      this.undoStack.push(command);
    }
    return success;
  }

  /** Get recent commands for network sync */
  getRecentCommands(since: number): Command[] {
    return this.undoStack.filter(c => c.timestamp >= since);
  }

  /** Clear all history */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
