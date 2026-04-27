// ============================================================
// Ортогональные трубы: только 90° — прямые + колено в углу L.
// ============================================================

import * as THREE from "three";
import {
  PIPE_PROCEDURAL_ELBOW_PATH,
  PIPE_PROCEDURAL_STRAIGHT_PATH,
  PIPE_RUN_ROT_Y_OFFSET,
} from "../../buildings/logistics/pipeKitModels.ts";

export type PipePathSegment = {
  position: THREE.Vector3;
  rotationY: number;
  partPath: string;
  /** Только колено: rotationY входящей прямой (с PIPE_RUN_ROT_Y_OFFSET). */
  elbowIncomingRotY?: number;
  elbowTurn?: 1 | -1;
};

/** Привязка конца линии к ортогонали относительно якоря (манхэттен). */
export function snapPipeGhostXZ(
  lineStart: THREE.Vector3,
  raw: THREE.Vector3,
): THREE.Vector3 {
  const y = raw.y;
  const dx = raw.x - lineStart.x;
  const dz = raw.z - lineStart.z;
  if (Math.hypot(dx, dz) < 1e-6) return raw.clone();
  if (Math.abs(dx) >= Math.abs(dz)) {
    return new THREE.Vector3(raw.x, y, lineStart.z);
  }
  return new THREE.Vector3(lineStart.x, y, raw.z);
}

/** Отступ прямых от вершины угла (~половина шага сетки), чтобы торец упирался в колено без щели. */
export function pipeCornerTrimForFullCorner(step: number, legLen: number): number {
  const tol = 0.06;
  const want = Math.max(step * 0.5 - 0.08, tol * 0.5);
  if (legLen < tol) return 0;
  return Math.min(want, legLen * 0.48);
}

export function computePipePathSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  step: number,
): PipePathSegment[] {
  const result: PipePathSegment[] = [];
  const y = start.y;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const tol = 0.06;

  if (Math.hypot(dx, dz) < tol) {
    result.push({
      position: new THREE.Vector3(start.x, y, start.z),
      rotationY: Math.atan2(dx, dz) + PIPE_RUN_ROT_Y_OFFSET,
      partPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
    });
    return result;
  }

  const firstAlongX = Math.abs(dx) >= Math.abs(dz);
  const corner = firstAlongX
    ? new THREE.Vector3(end.x, y, start.z)
    : new THREE.Vector3(start.x, y, end.z);

  const leg1 = new THREE.Vector3(corner.x - start.x, 0, corner.z - start.z);
  const leg2 = new THREE.Vector3(end.x - corner.x, 0, end.z - corner.z);
  const len1 = leg1.length();
  const len2 = leg2.length();

  const needsElbow = len1 >= tol && len2 >= tol;

  function pushStraightRun(
    from: THREE.Vector3,
    legDir: THREE.Vector3,
    runLen: number,
  ): void {
    if (runLen < tol) return;
    const full = legDir.length();
    if (full < tol) return;
    const ux = legDir.x / full;
    const uz = legDir.z / full;
    const rotY = Math.atan2(ux, uz) + PIPE_RUN_ROT_Y_OFFSET;
    const spacing = Math.max(step, 0.12);

    /** Центры сегментов через `spacing` — стык в стык по длине одной трубы. */
    const ts: number[] = [];
    if (runLen <= spacing + 1e-4) {
      ts.push(runLen * 0.5);
    } else {
      ts.push(0);
      let t = spacing;
      while (t < runLen - 1e-4) {
        ts.push(t);
        t += spacing;
      }
      if (Math.abs(ts[ts.length - 1]! - runLen) > 1e-3) {
        ts.push(runLen);
      }
    }

    for (const t of ts) {
      result.push({
        position: new THREE.Vector3(from.x + ux * t, y, from.z + uz * t),
        rotationY: rotY,
        partPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
      });
    }
  }

  const cornerTrim1 = needsElbow ? pipeCornerTrimForFullCorner(step, len1) : 0;
  const cornerTrim2 = needsElbow ? pipeCornerTrimForFullCorner(step, len2) : 0;

  if (len1 >= tol) {
    const dir1 = leg1.clone();
    const run1 = needsElbow ? Math.max(0, len1 - cornerTrim1) : len1;
    pushStraightRun(start, dir1, run1);
  }

  if (needsElbow) {
    const dir1u = leg1.clone().normalize();
    const dir2u = leg2.clone().normalize();
    const cross = dir1u.x * dir2u.z - dir1u.z * dir2u.x;
    const leg1Rot = Math.atan2(dir1u.x, dir1u.z);
    const turn: 1 | -1 = cross >= 0 ? 1 : -1;
    const elbowRot = leg1Rot + turn * (Math.PI / 2) + PIPE_RUN_ROT_Y_OFFSET;
    const incomingStraightRotY = leg1Rot + PIPE_RUN_ROT_Y_OFFSET;
    result.push({
      position: corner.clone(),
      rotationY: elbowRot,
      partPath: PIPE_PROCEDURAL_ELBOW_PATH,
      elbowIncomingRotY: incomingStraightRotY,
      elbowTurn: turn,
    });
  }

  if (len2 >= tol) {
    const dir2 = leg2.clone();
    const run2 = needsElbow ? Math.max(0, len2 - cornerTrim2) : len2;
    const from2 = needsElbow
      ? corner
          .clone()
          .add(dir2.clone().normalize().multiplyScalar(cornerTrim2))
      : corner.clone();
    pushStraightRun(from2, dir2, run2);
  }

  return result;
}

/**
 * Только один прямой участок по доминирующей оси (как первое плечо L), без колена.
 * `runToCornerTrim` — как у `computePipePathSegments`: прямые не заходят в вершину угла,
 * чтобы колено в точке `end` стояло стык в стык, а не внутри последнего сегмента.
 */
export function computePipeStraightSegmentsOnly(
  start: THREE.Vector3,
  end: THREE.Vector3,
  step: number,
  /** Если true — длина прогона уменьшается на cornerTrim до точки end (под колено в end). */
  trimRunForUpcomingElbow = false,
): PipePathSegment[] {
  const result: PipePathSegment[] = [];
  const y = start.y;
  const leg = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
  const runLenFull = leg.length();
  const tol = 0.06;
  const smallTrim = Math.max(step * 0.12, tol * 0.5);
  const trimForElbow = pipeCornerTrimForFullCorner(step, runLenFull);
  const cornerTrim =
    trimRunForUpcomingElbow && runLenFull > tol ? trimForElbow : smallTrim;
  const runLen =
    trimRunForUpcomingElbow && runLenFull > tol
      ? Math.max(0, runLenFull - cornerTrim)
      : runLenFull;
  if (runLenFull < tol) {
    result.push({
      position: new THREE.Vector3(start.x, y, start.z),
      rotationY: Math.atan2(leg.x, leg.z) + PIPE_RUN_ROT_Y_OFFSET,
      partPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
    });
    return result;
  }
  const ux = leg.x / runLenFull;
  const uz = leg.z / runLenFull;
  const rotY = Math.atan2(ux, uz) + PIPE_RUN_ROT_Y_OFFSET;
  const spacing = Math.max(step, 0.12);
  const ts: number[] = [];
  if (runLen <= spacing + 1e-4) {
    ts.push(Math.max(runLen * 0.5, tol * 0.25));
  } else {
    ts.push(0);
    let t = spacing;
    while (t < runLen - 1e-4) {
      ts.push(t);
      t += spacing;
    }
    if (Math.abs(ts[ts.length - 1]! - runLen) > 1e-3) {
      ts.push(runLen);
    }
  }
  for (const t of ts) {
    result.push({
      position: new THREE.Vector3(start.x + ux * t, y, start.z + uz * t),
      rotationY: rotY,
      partPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
    });
  }
  return result;
}

/** Минимальный зазор вдоль исходящего плеча после колена (как `from2` в полном L). */
export function pipeCornerTrimForStep(step: number): number {
  const tol = 0.06;
  return Math.max(step * 0.12, tol * 0.5);
}

/** Поворот колена и следующей прямой относительно курсора (90°). `turn`: +1 / −1 от cross(incoming, mouse). */
export function computePipeJunctionRotations(
  incomingStraightRotY: number,
  corner: THREE.Vector3,
  cursor: THREE.Vector3,
): { elbowRotY: number; outgoingStraightRotY: number; turn: 1 | -1 } {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  const inX = Math.sin(incomingStraightRotY - off);
  const inZ = Math.cos(incomingStraightRotY - off);
  const mx = cursor.x - corner.x;
  const mz = cursor.z - corner.z;
  const cross = inX * mz - inZ * mx;
  const turn: 1 | -1 =
    Math.hypot(mx, mz) < 1e-5 ? 1 : cross >= 0 ? 1 : -1;
  const leg1Rot = Math.atan2(inX, inZ);
  const elbowRotY = leg1Rot + turn * (Math.PI / 2) + off;
  const outX = -turn * inZ;
  const outZ = turn * inX;
  const outgoingStraightRotY = Math.atan2(outX, outZ) + off;
  return { elbowRotY, outgoingStraightRotY, turn };
}
