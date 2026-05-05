// ============================================================
// Свободная 3D-кривая трубы: CatmullRom + TubeGeometry + торцевые кольца.
// Большие угол — увеличиваем выпуклое «колено» (по дуге в XZ), без клампа курсора.
// ============================================================

import * as THREE from "three";
import { PIPE_RUN_ROT_Y_OFFSET } from "../../buildings/logistics/pipeKitModels.ts";

const CATMULL_TENSION = 0.38;
export const PIPE_FREE_CURVE_TENSION = CATMULL_TENSION;

const MIN_TAIL_STEPS = 0.52;

/** Минимум длины отрезков прямых у входа/выхода (доля шага). */
const MIN_RUN_IN_STEPS = 0.06;

/** Снап торца фланца вдоль оси от радиуса трубы (мир). */
export function pipeFreeFlangeAlongTangentM(tubeRadius: number): number {
  return Math.max(tubeRadius * 0.13, 0.055);
}

function xzUnitFromRotY(rotY: number): THREE.Vector3 {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  return new THREE.Vector3(
    Math.sin(rotY - off),
    0,
    Math.cos(rotY - off),
  ).normalize();
}

function estimateTurnRadiusMeter(
  dist: number,
  step: number,
  theta: number,
): number {
  const turnMag = theta / Math.PI;
  return THREE.MathUtils.clamp(
    step * (0.34 + 1.82 * Math.pow(turnMag, 1.14)),
    step * 0.36,
    Math.max(step * 0.55, dist * 0.54),
  );
}

function tangentRunFromTheta(R: number, theta: number, dist: number): number {
  const th = THREE.MathUtils.clamp(theta * 0.5, 0.01, Math.PI * 0.495);
  let t = Math.tan(th);
  if (!Number.isFinite(t) || t > 14) t = 14;
  return Math.min(R * t, dist * 0.5);
}

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
  tubeRadius?: number,
): boolean {
  const tr = tubeRadius ?? step * 0.14;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.058) return true;
  if (dist < step * MIN_RUN_IN_STEPS * 2.2 && dist > 0.04) return true;

  const forward = new THREE.Vector3(dx / dist, 0, dz / dist);
  const vin =
    tangentStart !== null
      ? xzUnitFromRotY(tangentStart)
      : xzUnitFromRotY(ghostRotY);
  const c0 = THREE.MathUtils.clamp(vin.dot(forward), -1, 1);
  const theta = Math.acos(c0);

  const R = estimateTurnRadiusMeter(dist, step, theta);
  if (R < tr * 2.15) return true;

  const run = tangentRunFromTheta(R, theta, dist);
  const aLen = Math.min(run, dist * 0.46);
  const bLen = Math.min(run, dist * 0.46);
  const arcApprox = Math.max(0.12, theta * R * 0.72);
  /** Для больших θ сумма «прокси» завышает длину дуги; без поправки L и ~90° часто ошибочно invalid. */
  const spanBudget =
    theta > Math.PI / 3
      ? dist * 1.42 + step * 0.12
      : theta > 0.48
        ? dist * 1.2 + step * 0.08
        : dist * 1.068;
  if (aLen + bLen + arcApprox > spanBudget) return true;

  const tailRoom = dist - aLen - bLen;
  if (
    theta < Math.PI / 3 &&
    tailRoom < step * MIN_TAIL_STEPS * 0.42 &&
    dist > step * 0.88
  )
    return true;

  if (tangentEnd !== null) {
    const vout = xzUnitFromRotY(tangentEnd);
    const c1 = THREE.MathUtils.clamp(vout.dot(forward), -1, 1);
    const thetaOut = Math.acos(c1);
    const Rout = estimateTurnRadiusMeter(dist, step, thetaOut);
    if (Rout < tr * 2.05) return true;
  }

  return false;
}

/**
 * Контрольные точки: прямой въезд по vin, выпуклый узел через дугу по XZ,
 * прямой хвост вдоль направления к end.
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
  const tol = 0.05;
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

  const c0 = THREE.MathUtils.clamp(vin.dot(forward), -1, 1);
  const theta = Math.acos(c0);

  if (theta < 0.032) {
    const mid = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.36),
      THREE.MathUtils.lerp(start.y, end.y, 0.42),
      THREE.MathUtils.lerp(start.z, end.z, 0.36),
    );
    return [start.clone(), mid, end.clone()];
  }

  const R = estimateTurnRadiusMeter(dist, step, theta);
  const runFull = tangentRunFromTheta(R, theta, dist);
  let aLen = Math.max(step * MIN_RUN_IN_STEPS, Math.min(runFull, dist * 0.48));
  let bLen = Math.max(step * MIN_RUN_IN_STEPS, Math.min(runFull, dist * 0.48));

  const midChord = dist - aLen - bLen;
  if (midChord < step * 0.055) {
    const shrink =
      Math.max(
        step * MIN_RUN_IN_STEPS * 1.95 / (dist + 1e-6),
        (dist - step * MIN_TAIL_STEPS * 0.35) /
          Math.max(aLen + bLen, 1e-6),
      );
    const s = Math.min(shrink, 0.96);
    aLen *= s;
    bLen *= s;
  }

  let A = start.clone().add(vin.clone().multiplyScalar(aLen));
  let vEnd = forward.clone();
  if (tangentEnd !== null) {
    vEnd = xzUnitFromRotY(tangentEnd);
    if (vEnd.dot(forward) < 0) vEnd.negate();
  }
  const B = end.clone().sub(vEnd.clone().multiplyScalar(bLen));

  const chordMid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
  let chordAB = new THREE.Vector3().subVectors(B, A);
  chordAB.y = 0;
  const chordLenXZ = chordAB.length();
  if (chordLenXZ < step * 0.038) {
    A = start.clone().lerp(end, THREE.MathUtils.clamp(aLen / dist, 0.12, 0.42));
    chordMid.addVectors(A, B).multiplyScalar(0.5);
  }

  chordAB.set(B.x - A.x, 0, B.z - A.z);
  const cdXZ = chordAB.length();
  if (theta >= Math.PI / 4 && cdXZ < Math.max(step * 0.068, dist * 0.034)) {
    const push = Math.min(
      step * 0.05,
      (Math.max(step * 0.068, dist * 0.034) - cdXZ) * 0.85,
    );
    if (push > 1e-4) {
      const half = push * 0.5;
      A.addScaledVector(vin, half);
      B.addScaledVector(forward, half);
      chordMid.addVectors(A, B).multiplyScalar(0.5);
      chordAB.set(B.x - A.x, 0, B.z - A.z);
    }
  }

  const chordLenRef = chordAB.length();
  const chordHat =
    chordLenRef >= 1e-5
      ? chordAB.clone().multiplyScalar(1 / chordLenRef)
      : forward.clone();

  const crossY = vin.x * forward.z - vin.z * forward.x;
  const sign = crossY >= 0 ? 1 : -1;
  const perpOut = new THREE.Vector3(
    -chordHat.z * sign,
    0,
    chordHat.x * sign,
  ).normalize();

  const chordOpen = Math.max(
    chordLenRef,
    chordLenXZ * 0.92,
    dist * 0.08,
    step * 0.07,
  );
  const sagFactor = THREE.MathUtils.clamp(
    R * Math.sin(theta * 0.48) * 1.62,
    step * 0.07,
    Math.min(dist * 0.26, chordOpen * 0.52, R * 0.9),
  );
  const M = chordMid
    .clone()
    .add(perpOut.clone().multiplyScalar(sagFactor));
  M.y = THREE.MathUtils.lerp(A.y, B.y, 0.54);

  const p0 = start.clone();
  const pLead = start.clone().lerp(A, 0.34);
  pLead.y = THREE.MathUtils.lerp(start.y, A.y, 0.38);
  const pTrail = B.clone().lerp(end, 0.36);
  pTrail.y = THREE.MathUtils.lerp(B.y, end.y, 0.42);

  return [
    p0,
    pLead,
    A,
    M,
    B,
    pTrail,
    end.clone(),
  ];
}

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
  const segLenTarget = Math.max(stepHint * 0.065, tubeRadius * 0.52, 0.07);
  const baseTubular = Math.min(
    224,
    Math.max(56, Math.ceil(arcLen / segLenTarget) * 12),
  );
  const ku = 96;
  let maxTurn = 0;
  let prevT = curve.getTangentAt(0).normalize();
  for (let i = 1; i <= ku; i++) {
    const t = curve.getTangentAt(i / ku).normalize();
    maxTurn = Math.max(maxTurn, prevT.angleTo(t));
    prevT.copy(t);
  }
  const kinkBoost = Math.min(144, Math.ceil(maxTurn / (Math.PI / 90)) * 18);
  const tubular = Math.min(224, Math.max(baseTubular, kinkBoost));
  const radialSegments = THREE.MathUtils.clamp(
    Math.round((tubeRadius / Math.max(stepHint, 1)) * 8 + 6),
    10,
    16,
  );
  return new THREE.TubeGeometry(
    curve,
    tubular,
    tubeRadius,
    radialSegments,
    false,
  );
}
