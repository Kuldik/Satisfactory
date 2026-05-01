// ============================================================
// Свободная 3D-кривая трубы: CatmullRom + TubeGeometry (один меш).
// S-плавность у старта/финиша + коллинеарный прямой хвост до курсора.
// ============================================================

import * as THREE from "three";
import { PIPE_RUN_ROT_Y_OFFSET } from "../../buildings/logistics/pipeKitModels.ts";

const CATMULL_TENSION = 0.38;
export const PIPE_FREE_CURVE_TENSION = CATMULL_TENSION;

/** Макс. угол (рад) между входной касательной и хордой start→end: выше — конфиг «ломается». */
const MAX_START_TURN_VS_CHORD = 1.36;
/** Мин. длина прямого хвоста (доля шага), иначе считаем слишком жёстким. */
const MIN_TAIL_STEPS = 0.52;

function xzUnitFromRotY(rotY: number): THREE.Vector3 {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  return new THREE.Vector3(
    Math.sin(rotY - off),
    0,
    Math.cos(rotY - off),
  ).normalize();
}

/**
 * Угол между входом в трубу и направлением к курсору (0 … π).
 * Большой угол → слишком крутой старт для одного сегмента CatmullRom.
 */
export function pipeFreeCurveStartChordAngleRad(
  start: THREE.Vector3,
  end: THREE.Vector3,
  tangentStart: number | null,
  ghostRotY: number,
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-5) return 0;
  const forward = new THREE.Vector3(dx / dist, 0, dz / dist);
  const vin =
    tangentStart !== null
      ? xzUnitFromRotY(tangentStart)
      : xzUnitFromRotY(ghostRotY);
  if (vin.dot(forward) < 0.15) return 0;
  const c = THREE.MathUtils.clamp(vin.dot(forward), -1, 1);
  return Math.acos(c);
}

export function pipeFreeCurvePlacementTooSharp(
  start: THREE.Vector3,
  end: THREE.Vector3,
  tangentStart: number | null,
  tangentEnd: number | null,
  ghostRotY: number,
  step: number,
): boolean {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.07) return false;
  const a0 = pipeFreeCurveStartChordAngleRad(start, end, tangentStart, ghostRotY);
  if (a0 > MAX_START_TURN_VS_CHORD) return true;
  const forward = new THREE.Vector3(dx / dist, 0, dz / dist);
  if (tangentEnd !== null) {
    const vout = xzUnitFromRotY(tangentEnd);
    const c = THREE.MathUtils.clamp(vout.dot(forward), -1, 1);
    const a1 = Math.acos(c);
    if (a1 > MAX_START_TURN_VS_CHORD) return true;
  }
  const bendBudget = Math.min(step * 3.8, dist * 0.38);
  const L1 = Math.min(step * 1.6, bendBudget * 0.5);
  const L2 = Math.min(step * 1.6, bendBudget * 0.5);
  const tailLen = dist - L1 - L2;
  if (tailLen < step * MIN_TAIL_STEPS && dist > step * 0.95) return true;
  return false;
}

/**
 * Контрольные точки: короткий S у старта, затем коллинеарные точки
 * на прямой до end (последний участок визуально ровный).
 */
export function computePipeFreeCurvePath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  tangentStart: number | null,
  tangentEnd: number | null,
  ghostRotY: number,
  step: number,
): THREE.Vector3[] {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  const tol = 0.06;
  if (dist < tol) {
    return [start.clone(), end.clone()];
  }

  const forward = new THREE.Vector3(dx / dist, 0, dz / dist);
  const vin =
    tangentStart !== null
      ? new THREE.Vector3(
          Math.sin(tangentStart - off),
          0,
          Math.cos(tangentStart - off),
        ).normalize()
      : new THREE.Vector3(
          Math.sin(ghostRotY - off),
          0,
          Math.cos(ghostRotY - off),
        ).normalize();
  if (vin.dot(forward) < 0.2) {
    vin.copy(forward);
  }

  const bendBudget = Math.min(step * 3.8, dist * 0.38);
  let L1 = Math.min(step * 1.55, bendBudget * 0.5, dist * 0.22);
  let L2 = Math.min(step * 1.55, bendBudget * 0.5, dist * 0.22);
  let tailLen = dist - L1 - L2 - step * 0.08;
  if (tailLen < step * MIN_TAIL_STEPS) {
    const need = step * MIN_TAIL_STEPS + step * 0.08;
    const shrink = Math.max(
      0.22,
      (dist - need) / (L1 + L2 + 1e-6),
    );
    L1 *= shrink;
    L2 *= shrink;
    tailLen = dist - L1 - L2 - step * 0.08;
    tailLen = Math.max(tailLen, step * MIN_TAIL_STEPS * 0.85);
  }

  const bendExit = end.clone().sub(forward.clone().multiplyScalar(tailLen));

  const p0 = start.clone();
  const p1 = p0.clone().add(vin.clone().multiplyScalar(L1));

  const dxB = bendExit.x - p1.x;
  const dzB = bendExit.z - p1.z;
  const yMid = THREE.MathUtils.lerp(p1.y, bendExit.y, 0.52);
  const sag = Math.min(step * 0.07, Math.hypot(dxB, dzB) * 0.028);
  const midXZx = (p1.x + bendExit.x) * 0.5;
  const midXZz = (p1.z + bendExit.z) * 0.5;
  const p2 = new THREE.Vector3(midXZx, yMid - sag, midXZz);

  const p3 = bendExit.clone();
  if (tangentEnd !== null) {
    let vEnd = xzUnitFromRotY(tangentEnd);
    if (vEnd.dot(forward) < -0.1) {
      vEnd = vEnd.clone().multiplyScalar(-1);
    }
    const blend = Math.min(step * 0.55, tailLen * 0.22);
    const pBlend = end.clone().sub(forward.clone().multiplyScalar(blend));
    pBlend.add(
      vEnd.clone().multiplyScalar(
        Math.min(step * 0.35, blend * 0.4) * (1 - Math.max(0, vEnd.dot(forward))),
      ),
    );
    pBlend.y = THREE.MathUtils.lerp(bendExit.y, end.y, 0.65);
    const midT = end
      .clone()
      .sub(forward.clone().multiplyScalar(tailLen * 0.5));
    midT.y = THREE.MathUtils.lerp(bendExit.y, end.y, 0.82);
    return [p0, p1, p2, p3, pBlend, midT, end.clone()];
  }

  const midTail = end
    .clone()
    .sub(forward.clone().multiplyScalar(tailLen * 0.5));
  midTail.y = THREE.MathUtils.lerp(bendExit.y, end.y, 0.88);
  return [p0, p1, p2, p3, midTail, end.clone()];
}

/** Точки в локальных координатах (первый узел в начале координат). */
export function buildPipeFreeCurveTubeGeometry(
  localPoints: THREE.Vector3[],
  tubeRadius: number,
  stepHint: number,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(
    localPoints,
    false,
    "catmullrom",
    CATMULL_TENSION,
  );
  const arcLen = Math.max(curve.getLength(), 0.2);
  const tubular = Math.min(
    200,
    Math.max(24, Math.ceil(arcLen / Math.max(stepHint, 0.25)) * 12),
  );
  return new THREE.TubeGeometry(
    curve,
    tubular,
    tubeRadius,
    12,
    false,
  );
}
