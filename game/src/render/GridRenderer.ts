// ============================================================
// GridRenderer — draws the 2D grid on the current floor
// ============================================================

import * as THREE from 'three';
import { GRID_CELL_SIZE, CHUNK_SIZE } from '../core/constants.ts';

export class GridRenderer {
  private scene: THREE.Scene;
  private gridGroup: THREE.Group;
  private currentFloor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'grid';
    this.scene.add(this.gridGroup);

    this.buildGrid();
  }

  /** Build the visible grid lines */
  private buildGrid(): void {
    // Clear old grid
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const gridExtent = CHUNK_SIZE * GRID_CELL_SIZE * 3; // 3 chunks visible
    const halfExtent = gridExtent / 2;
    const step = GRID_CELL_SIZE;

    const vertices: number[] = [];
    const colors: number[] = [];

    const mainColor = new THREE.Color(0x444466);
    const subColor = new THREE.Color(0x333344);
    const chunkColor = new THREE.Color(0x6666AA);

    for (let i = -halfExtent; i <= halfExtent; i += step) {
      // Determine line color
      let color: THREE.Color;
      if (i % (CHUNK_SIZE * GRID_CELL_SIZE) === 0) {
        color = chunkColor; // chunk boundaries
      } else if (i % (step * 4) === 0) {
        color = mainColor; // every 4th line = 8m
      } else {
        color = subColor;
      }

      // X lines
      vertices.push(-halfExtent, 0, i, halfExtent, 0, i);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      // Z lines
      vertices.push(i, 0, -halfExtent, i, 0, halfExtent);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.position.y = this.currentFloor * GRID_CELL_SIZE + 0.01;
    this.gridGroup.add(lines);
  }

  /** Change the grid's floor level */
  setFloor(floor: number): void {
    this.currentFloor = floor;
    this.gridGroup.position.y = floor * GRID_CELL_SIZE;
  }

  /** Get current floor */
  getFloor(): number {
    return this.currentFloor;
  }

  /** Clean up */
  dispose(): void {
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    this.scene.remove(this.gridGroup);
  }
}
