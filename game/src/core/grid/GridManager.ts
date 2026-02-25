// ============================================================
// GridManager — manages the infinite 3D grid (2×2m cells)
// ============================================================

import { CHUNK_SIZE } from '../constants.ts';
import type { GridPosition, ChunkCoord, EntityId, Rotation } from '../types.ts';

/** Data stored per grid cell */
export interface GridCell {
  entityId: EntityId;
  buildingType: string;
  rotation: Rotation;
}

/** A single chunk (CHUNK_SIZE × CHUNK_SIZE cells, multiple Y levels) */
export class Chunk {
  readonly cx: number;
  readonly cz: number;
  /** cells[y][localZ * CHUNK_SIZE + localX] */
  private cells: Map<number, (GridCell | null)[]> = new Map();

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
  }

  private getFloor(y: number): (GridCell | null)[] {
    let floor = this.cells.get(y);
    if (!floor) {
      floor = new Array<GridCell | null>(CHUNK_SIZE * CHUNK_SIZE).fill(null);
      this.cells.set(y, floor);
    }
    return floor;
  }

  private localIndex(localX: number, localZ: number): number {
    return localZ * CHUNK_SIZE + localX;
  }

  getCell(localX: number, localZ: number, y: number): GridCell | null {
    const floor = this.cells.get(y);
    if (!floor) return null;
    return floor[this.localIndex(localX, localZ)] ?? null;
  }

  setCell(localX: number, localZ: number, y: number, cell: GridCell | null): void {
    const floor = this.getFloor(y);
    floor[this.localIndex(localX, localZ)] = cell;
  }

  /** Get all Y levels that have content */
  getActiveLevels(): number[] {
    return Array.from(this.cells.keys()).sort((a, b) => a - b);
  }

  /** Check if chunk has any placed entities */
  isEmpty(): boolean {
    for (const floor of this.cells.values()) {
      if (floor.some(cell => cell !== null)) return false;
    }
    return true;
  }
}

export class GridManager {
  private chunks: Map<string, Chunk> = new Map();

  /** Convert world grid position to chunk coordinate */
  static positionToChunk(pos: GridPosition): ChunkCoord {
    return {
      cx: Math.floor(pos.x / CHUNK_SIZE),
      cz: Math.floor(pos.z / CHUNK_SIZE),
    };
  }

  /** Convert world grid position to local chunk position */
  static positionToLocal(pos: GridPosition): { localX: number; localZ: number } {
    let localX = pos.x % CHUNK_SIZE;
    let localZ = pos.z % CHUNK_SIZE;
    if (localX < 0) localX += CHUNK_SIZE;
    if (localZ < 0) localZ += CHUNK_SIZE;
    return { localX, localZ };
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /** Get or create a chunk */
  getChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Check if a grid cell is occupied */
  isOccupied(pos: GridPosition): boolean {
    const { cx, cz } = GridManager.positionToChunk(pos);
    const { localX, localZ } = GridManager.positionToLocal(pos);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return false;
    return chunk.getCell(localX, localZ, pos.y) !== null;
  }

  /** Place a building on the grid (checks multi-cell buildings) */
  canPlace(pos: GridPosition, sizeX: number, sizeZ: number): boolean {
    for (let dx = 0; dx < sizeX; dx++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        if (this.isOccupied({ x: pos.x + dx, y: pos.y, z: pos.z + dz })) {
          return false;
        }
      }
    }
    return true;
  }

  /** Place an entity on the grid */
  placeEntity(
    pos: GridPosition,
    sizeX: number,
    sizeZ: number,
    entityId: EntityId,
    buildingType: string,
    rotation: Rotation,
  ): boolean {
    if (!this.canPlace(pos, sizeX, sizeZ)) return false;

    for (let dx = 0; dx < sizeX; dx++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const cellPos = { x: pos.x + dx, y: pos.y, z: pos.z + dz };
        const { cx, cz } = GridManager.positionToChunk(cellPos);
        const { localX, localZ } = GridManager.positionToLocal(cellPos);
        this.getChunk(cx, cz).setCell(localX, localZ, pos.y, {
          entityId,
          buildingType,
          rotation,
        });
      }
    }

    return true;
  }

  /** Remove an entity from the grid */
  removeEntity(pos: GridPosition, sizeX: number, sizeZ: number): void {
    for (let dx = 0; dx < sizeX; dx++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const cellPos = { x: pos.x + dx, y: pos.y, z: pos.z + dz };
        const { cx, cz } = GridManager.positionToChunk(cellPos);
        const { localX, localZ } = GridManager.positionToLocal(cellPos);
        const chunk = this.chunks.get(this.chunkKey(cx, cz));
        if (chunk) {
          chunk.setCell(localX, localZ, pos.y, null);
        }
      }
    }
  }

  /** Get cell data at a position */
  getCellAt(pos: GridPosition): GridCell | null {
    const { cx, cz } = GridManager.positionToChunk(pos);
    const { localX, localZ } = GridManager.positionToLocal(pos);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return null;
    return chunk.getCell(localX, localZ, pos.y);
  }

  /** Get all loaded chunks */
  getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /** Get chunks within a range of a center chunk coord */
  getChunksInRange(centerCx: number, centerCz: number, range: number): Chunk[] {
    const result: Chunk[] = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dz = -range; dz <= range; dz++) {
        result.push(this.getChunk(centerCx + dx, centerCz + dz));
      }
    }
    return result;
  }
}
