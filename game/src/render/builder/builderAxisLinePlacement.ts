// ============================================================
// Ось-выровненная линия для админ-билдера (не конвейерные ленты).
// Сетка шага по доминирующей оси X или Z от отпечатка призрака.
// ============================================================

import * as THREE from "three";
import type { ConveyorPathSegment } from "./conveyorPathSegments.ts";

/** Точки для линии без поворота сегментов — все с rotationY призрака. */
export function getAxisLinePlacementPositions(
  start: THREE.Vector3,
  end: THREE.Vector3,
  /** Уже повёрнутый отпечаток (как getRotatedFootprint в SceneManager). */
  rotatedFootprint: THREE.Vector3,
): THREE.Vector3[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const step = alongX
    ? Math.max(rotatedFootprint.x, 0.1)
    : Math.max(rotatedFootprint.z, 0.1);
  const result: THREE.Vector3[] = [];
  if (alongX) {
    const dir = Math.sign(dx) || 1;
    const dist = Math.abs(dx);
    const count = Math.max(1, Math.round(dist / step));
    for (let i = 0; i <= count; i++) {
      result.push(
        new THREE.Vector3(start.x + dir * i * step, start.y, start.z),
      );
    }
  } else {
    const dir = Math.sign(dz) || 1;
    const dist = Math.abs(dz);
    const count = Math.max(1, Math.round(dist / step));
    for (let i = 0; i <= count; i++) {
      result.push(
        new THREE.Vector3(start.x, start.y, start.z + dir * i * step),
      );
    }
  }
  return result;
}

export function computeAxisAlignedPathSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  rotatedFootprint: THREE.Vector3,
  builderGhostRotY: number,
): ConveyorPathSegment[] {
  const positions = getAxisLinePlacementPositions(
    start,
    end,
    rotatedFootprint,
  );
  return positions.map((p) => ({
    position: p,
    rotationY: builderGhostRotY,
  }));
}
