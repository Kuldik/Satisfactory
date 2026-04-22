// ============================================================
// GridRenderer — draws the 2D grid on the current floor
// ============================================================

import * as THREE from "three";
import {
  CHUNK_SIZE,
  GRID_CELL_SIZE,
  GROUND_PLANE_EXTENT,
} from "../core/constants.ts";

export type GridVisualTheme = "dark" | "light";

export class GridRenderer {
  private scene: THREE.Scene;
  private gridGroup: THREE.Group;
  private currentFloor = 0;
  private visualTheme: GridVisualTheme = "dark";

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = "grid";
    this.scene.add(this.gridGroup);

    this.buildGrid();
  }

  /** Светлая / тёмная палитра линий сетки (согласовано с SceneManager). */
  setVisualTheme(theme: GridVisualTheme): void {
    this.visualTheme = theme;
    this.buildGrid();
    this.setFloor(this.currentFloor);
  }

  private buildGrid(): void {
    while (this.gridGroup.children.length > 0) {
      const child = this.gridGroup.children[0];
      this.gridGroup.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const halfExtent = GROUND_PLANE_EXTENT / 2;
    const step = GRID_CELL_SIZE;

    const vertices: number[] = [];
    const colors: number[] = [];

    const isLight = this.visualTheme === "light";
    const mainColor = new THREE.Color(isLight ? 0x64748b : 0x4a4558);
    const subColor = new THREE.Color(isLight ? 0x94a3b8 : 0x353040);
    const chunkColor = new THREE.Color(isLight ? 0x475569 : 0x7c6b4a);

    for (let i = -halfExtent; i <= halfExtent; i += step) {
      let color: THREE.Color;
      if (i % (CHUNK_SIZE * GRID_CELL_SIZE) === 0) {
        color = chunkColor;
      } else if (i % (step * 4) === 0) {
        color = mainColor;
      } else {
        color = subColor;
      }

      vertices.push(-halfExtent, 0, i, halfExtent, 0, i);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      vertices.push(i, 0, -halfExtent, i, 0, halfExtent);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: isLight ? 0.55 : 0.4,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.position.y = this.currentFloor * GRID_CELL_SIZE + 0.01;
    this.gridGroup.add(lines);
  }

  setFloor(floor: number): void {
    this.currentFloor = floor;
    this.gridGroup.position.y = floor * GRID_CELL_SIZE;
  }

  getFloor(): number {
    return this.currentFloor;
  }

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
