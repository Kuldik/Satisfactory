// ============================================================
// Снаппинг призрака к уже поставленным объектам и вертикальная опора.
// Работает только с группой placed + параметрами отпечатка; не знает о меню/конвейерах.
// ============================================================

import * as THREE from "three";
import { GRID_CELL_SIZE } from "../../core/constants.ts";

/**
 * Ctrl: примагничивание к рёбрам/углам ближайших построек (кандидаты вокруг AABB).
 */
export function edgeAlignGhostToPlaced(
  pos: THREE.Vector3,
  placedGroup: THREE.Group,
  rotatedFootprint: THREE.Vector3,
): void {
  if (placedGroup.children.length === 0) return;

  const ghostHalfX = rotatedFootprint.x / 2;
  const ghostHalfZ = rotatedFootprint.z / 2;
  const maxRange = Math.max(rotatedFootprint.x, rotatedFootprint.z) * 6;

  let bestDist = maxRange;
  let bestX = pos.x;
  let bestZ = pos.z;

  for (const placed of placedGroup.children) {
    const box = new THREE.Box3().setFromObject(placed);
    const pc = box.getCenter(new THREE.Vector3());
    const pHalfX = (box.max.x - box.min.x) / 2;
    const pHalfZ = (box.max.z - box.min.z) / 2;

    if (
      Math.abs(pc.x - pos.x) > maxRange &&
      Math.abs(pc.z - pos.z) > maxRange
    ) {
      continue;
    }

    const candidates: Array<{ x: number; z: number }> = [
      { x: box.max.x + ghostHalfX, z: pc.z },
      { x: box.min.x - ghostHalfX, z: pc.z },
      { x: pc.x, z: box.max.z + ghostHalfZ },
      { x: pc.x, z: box.min.z - ghostHalfZ },
      { x: pc.x + pHalfX + ghostHalfX + pHalfX, z: pc.z },
      { x: pc.x - pHalfX - ghostHalfX - pHalfX, z: pc.z },
      { x: pc.x, z: pc.z + pHalfZ + ghostHalfZ + pHalfZ },
      { x: pc.x, z: pc.z - pHalfZ - ghostHalfZ - pHalfZ },
      { x: box.max.x + ghostHalfX, z: box.max.z + ghostHalfZ },
      { x: box.max.x + ghostHalfX, z: box.min.z - ghostHalfZ },
      { x: box.min.x - ghostHalfX, z: box.max.z + ghostHalfZ },
      { x: box.min.x - ghostHalfX, z: box.min.z - ghostHalfZ },
      { x: box.min.x + ghostHalfX, z: box.max.z + ghostHalfZ },
      { x: box.min.x + ghostHalfX, z: box.min.z - ghostHalfZ },
      { x: box.max.x - ghostHalfX, z: box.max.z + ghostHalfZ },
      { x: box.max.x - ghostHalfX, z: box.min.z - ghostHalfZ },
      { x: box.max.x + ghostHalfX, z: box.min.z + ghostHalfZ },
      { x: box.max.x + ghostHalfX, z: box.max.z - ghostHalfZ },
      { x: box.min.x - ghostHalfX, z: box.min.z + ghostHalfZ },
      { x: box.min.x - ghostHalfX, z: box.max.z - ghostHalfZ },
    ];

    for (const c of candidates) {
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        bestX = c.x;
        bestZ = c.z;
      }
    }
  }

  if (bestDist < maxRange) {
    pos.x = bestX;
    pos.z = bestZ;
  }
}

/**
 * Лицо к лицу с ближайшей гранью постройки (без Ctrl), чтобы не уезжать по диагонали.
 */
export function faceSnapGhostToPlaced(
  pos: THREE.Vector3,
  placedGroup: THREE.Group,
  rotatedFootprint: THREE.Vector3,
): void {
  const ghostHalfX = rotatedFootprint.x / 2;
  const ghostHalfZ = rotatedFootprint.z / 2;
  const threshold = Math.max(rotatedFootprint.x, rotatedFootprint.z) * 0.65;

  let bestDist = threshold;
  let snapResult: { x: number; z: number } | null = null;

  for (const placed of placedGroup.children) {
    const box = new THREE.Box3().setFromObject(placed);
    const pc = box.getCenter(new THREE.Vector3());

    const candidates = [
      { x: box.max.x + ghostHalfX, z: pc.z },
      { x: box.min.x - ghostHalfX, z: pc.z },
      { x: pc.x, z: box.max.z + ghostHalfZ },
      { x: pc.x, z: box.min.z - ghostHalfZ },
    ];

    for (const c of candidates) {
      if (
        Math.abs(c.x - pos.x) > threshold ||
        Math.abs(c.z - pos.z) > threshold
      ) {
        continue;
      }
      const dist = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        snapResult = c;
      }
    }
  }

  if (snapResult) {
    pos.x = snapResult.x;
    pos.z = snapResult.z;
  }
}

const ROLLING_STOCK_MENU_IDS = new Set([
  "locomotive",
  "freight_car",
  "fluid_freight_car",
]);

function measureCouplerExtents(
  object: THREE.Object3D,
  rotY: number,
): { front: number; rear: number; length: number } {
  const box = new THREE.Box3().setFromObject(object);
  const origin = object.getWorldPosition(new THREE.Vector3());
  const fx = Math.sin(rotY);
  const fz = Math.cos(rotY);
  const corners = [
    new THREE.Vector3(box.min.x, 0, box.min.z),
    new THREE.Vector3(box.min.x, 0, box.max.z),
    new THREE.Vector3(box.max.x, 0, box.min.z),
    new THREE.Vector3(box.max.x, 0, box.max.z),
  ];
  let minP = Infinity;
  let maxP = -Infinity;
  for (const c of corners) {
    const p = (c.x - origin.x) * fx + (c.z - origin.z) * fz;
    minP = Math.min(minP, p);
    maxP = Math.max(maxP, p);
  }
  const front = Math.max(0.05, maxP);
  const rear = Math.max(0.05, -minP);
  return { front, rear, length: front + rear };
}

/**
 * Сцепка вагонов вдоль оси состава (не AABB face-snap по миру).
 * Возвращает true, если позиция/поворот были подстроены.
 */
export function snapRollingStockCoupling(
  pos: THREE.Vector3,
  rotYRef: { value: number },
  placedGroup: THREE.Group,
  ghostRoot: THREE.Object3D | null,
): boolean {
  if (!ghostRoot) return false;

  const ghostExt = measureCouplerExtents(ghostRoot, rotYRef.value);
  const threshold = ghostExt.length * 1.8;
  let bestDist = threshold;
  let bestCenter: THREE.Vector3 | null = null;
  let bestRotY = rotYRef.value;

  for (const placed of placedGroup.children) {
    const menuId = placed.userData?.menuBuildingId as string | undefined;
    if (!menuId || !ROLLING_STOCK_MENU_IDS.has(menuId)) continue;

    const rot = placed.rotation.y;
    const placedExt = measureCouplerExtents(placed, rot);
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    const rearX = placed.position.x - fx * placedExt.rear;
    const rearZ = placed.position.z - fz * placedExt.rear;
    const d = Math.hypot(pos.x - rearX, pos.z - rearZ);
    if (d < bestDist) {
      bestDist = d;
      bestCenter = new THREE.Vector3(
        rearX - fx * ghostExt.front,
        pos.y,
        rearZ - fz * ghostExt.front,
      );
      bestRotY = rot;
    }
  }

  if (!bestCenter) return false;
  pos.copy(bestCenter);
  rotYRef.value = bestRotY;
  return true;
}

export function snapRollingStockToRail(
  pos: THREE.Vector3,
  rotYRef: { value: number },
  placedGroup: THREE.Group,
  ghostRoot: THREE.Object3D | null,
): boolean {
  if (!ghostRoot) return false;

  const ghostExt = measureCouplerExtents(ghostRoot, rotYRef.value);
  const threshold = Math.max(2.5, ghostExt.length * 0.3);
  let bestDist = threshold;
  let bestPos: THREE.Vector3 | null = null;
  let bestRotY = rotYRef.value;

  for (const placed of placedGroup.children) {
    const menuId = placed.userData?.menuBuildingId as string | undefined;
    const record = placed.userData?.builderRecord as
      | { partPath?: string }
      | undefined;
    if (
      menuId !== "railroad_track" ||
      !record?.partPath?.endsWith("railroad-straight.obj")
    ) {
      continue;
    }

    const rot = placed.rotation.y;
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    const placedExt = measureCouplerExtents(placed, rot);
    const dx = pos.x - placed.position.x;
    const dz = pos.z - placed.position.z;
    const along = dx * fx + dz * fz;
    const clamped = THREE.MathUtils.clamp(
      along,
      -placedExt.rear,
      placedExt.front,
    );
    const sx = placed.position.x + fx * clamped;
    const sz = placed.position.z + fz * clamped;
    const d = Math.hypot(pos.x - sx, pos.z - sz);
    if (d < bestDist) {
      bestDist = d;
      bestPos = new THREE.Vector3(sx, pos.y, sz);
      bestRotY = rot;
    }
  }

  if (!bestPos) return false;
  pos.copy(bestPos);
  rotYRef.value = bestRotY;
  return true;
}

/** Углы и середины рёбер отпечатка в мировых XZ — для лучей вертикальной опоры. */
export function getFootprintSamplePointsXZ(
  pos: THREE.Vector3,
  hx: number,
  hz: number,
  rotY: number,
  includeEdgeMids: boolean,
): Array<{ x: number; z: number }> {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const toWorld = (lx: number, lz: number) => ({
    x: pos.x + lx * c - lz * s,
    z: pos.z + lx * s + lz * c,
  });
  const corners = [
    toWorld(-hx, -hz),
    toWorld(hx, -hz),
    toWorld(hx, hz),
    toWorld(-hx, hz),
  ];
  if (!includeEdgeMids) return corners;
  return [
    ...corners,
    toWorld(0, -hz),
    toWorld(hx, 0),
    toWorld(0, hz),
    toWorld(-hx, 0),
  ];
}

/** Высота Y под (x,z): луч вниз по placedGroup, игнор почти горизонтальных нормалей. */
export function sampleVerticalSupportRay(
  x: number,
  z: number,
  placedGroup: THREE.Group,
): number | null {
  if (placedGroup.children.length === 0) return null;
  const origin = new THREE.Vector3(x, 5000, z);
  const dir = new THREE.Vector3(0, -1, 0);
  const raycaster = new THREE.Raycaster(origin, dir);
  raycaster.far = 10000;
  const hits = raycaster.intersectObjects(placedGroup.children, true);
  for (const hit of hits) {
    const n = hit.face?.normal;
    if (n) {
      const worldN = n.clone().transformDirection(hit.object.matrixWorld);
      if (worldN.y < 0.22) continue;
    }
    return hit.point.y;
  }
  return hits[0]?.point.y ?? null;
}

/**
 * Ставит pos.y на «пол» под отпечатком: пересечения с постройками + эвристика периметра
 * (когда в центре высокий объект, а опора по углам ниже).
 */
export function resolveGhostVerticalSupport(
  pos: THREE.Vector3,
  placedGroup: THREE.Group,
  rotatedFootprint: THREE.Vector3,
  ghostRotY: number,
  visibleFloor: number,
): void {
  const floorY = visibleFloor * GRID_CELL_SIZE;
  const hx = rotatedFootprint.x / 2;
  const hz = rotatedFootprint.z / 2;
  const gMinX = pos.x - hx;
  const gMaxX = pos.x + hx;
  const gMinZ = pos.z - hz;
  const gMaxZ = pos.z + hz;

  let yAabb = floorY;
  for (const placed of placedGroup.children) {
    const box = new THREE.Box3().setFromObject(placed);
    const ox = Math.min(gMaxX, box.max.x) - Math.max(gMinX, box.min.x);
    const oz = Math.min(gMaxZ, box.max.z) - Math.max(gMinZ, box.min.z);
    if (ox > 0.04 && oz > 0.04) {
      yAabb = Math.max(yAabb, box.max.y);
    }
  }

  const centerRay = sampleVerticalSupportRay(pos.x, pos.z, placedGroup);
  const yStack = Math.max(yAabb, centerRay ?? floorY);

  const span = Math.max(rotatedFootprint.x, rotatedFootprint.z);
  const includeMids = span > 1.15;
  const samples = getFootprintSamplePointsXZ(
    pos,
    hx,
    hz,
    ghostRotY,
    includeMids,
  );
  let yPerimeter = floorY;
  for (const p of samples) {
    const t = sampleVerticalSupportRay(p.x, p.z, placedGroup);
    if (t !== null) yPerimeter = Math.max(yPerimeter, t);
  }

  const perimeterVsStackClearance = 0.12;
  const perimeterMustExceedFloor = 0.02;

  if (
    yPerimeter > floorY + perimeterMustExceedFloor &&
    yStack > yPerimeter + perimeterVsStackClearance
  ) {
    pos.y = yPerimeter;
  } else {
    pos.y = yStack;
  }
}
