// ============================================================
// Конвейерные пути — расчёт сегментов для превью и постановки.
// Не трогает сцену: только геометрия (THREE.Vector3) и углы rotationY.
// Вызывается из SceneManager.computePathSegments при выбранной ленте.
// ============================================================

import * as THREE from "three";
import { isConveyorBeltMenuId } from "../../buildings/logistics/conveyorKitModels.ts";
import { isPipeLineMenuId } from "../../buildings/logistics/pipeKitModels.ts";
import { isRailroadTrackMenuId } from "../../buildings/logistics/railroadKitModels.ts";
import type { BuilderMode } from "../../core/types.ts";

/** Один сегмент ленты: центр pivot и поворот вокруг Y (как у placeSingleAt). */
export type ConveyorPathSegment = {
  position: THREE.Vector3;
  rotationY: number;
};

/** Минимальное смещение от оси, чтобы путь считался «по двум осям» (L) vs прямой в плоскости. */
const CONVEYOR_AXIS_LEAN_EPS = 0.03;
/** Считаем, что идём «прямо вдоль» якоря (без L/Безье), если косинус > этого. */
const CONVEYOR_TANGENT_ALIGN_MIN = 0.92;
const CONVEYOR_DUAL_TANGENT_STRAIGHT_MIN = 0.96;

/** Входные данные, которые SceneManager собирает из состояния призрака и режима. */
export type ConveyorPathComputeInput = {
  /** Для конвейера: "default" | "chord" | "curve". */
  builderMode: BuilderMode;
  step: number;
  conveyorRotOffset: number;
  tangentStart: number | null;
  tangentEnd: number | null;
  /** Fallback rotation, если сегмент вырожденный. */
  ghostRotY: number;
};

/** Шаг укладки: по длине ленты (X модели) для конвейеров, иначе max(X,Z) отпечатка. */
export function getPlacementSegmentStep(
  footprint: THREE.Vector3,
  prefabMenuBuildingId: string | null,
): number {
  if (isConveyorBeltMenuId(prefabMenuBuildingId)) {
    return Math.max(footprint.x, 0.1);
  }
  /** Труба может быть вытянута по X или Z в glb — шаг = длина сегмента в плоскости пола. */
  if (isPipeLineMenuId(prefabMenuBuildingId)) {
    return Math.max(Math.max(footprint.x, footprint.z), 0.1);
  }
  if (isRailroadTrackMenuId(prefabMenuBuildingId)) {
    return Math.max(footprint.z, 0.1);
  }
  return Math.max(Math.max(footprint.x, footprint.z), 0.1);
}

/**
 * Главный вход: режим «по умолчанию» (L + скругление или двойной снап кубик),
 * режим «кривая» (квадратичная или кубическая Безье).
 */
export function computeConveyorPathSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  switch (input.builderMode) {
    case "chord":
      return getChordStraightConveyorPath(start, end, input);
    case "default":
      if (input.tangentStart !== null && input.tangentEnd !== null) {
        return getBiTangentCubicPath(start, end, input);
      }
      return getLShapedPath(start, end, input);
    case "curve":
      return getCurvePath(start, end, input);
    case "free":
      return getCurvePath(start, end, input);
    default:
      return [
        {
          position: start.clone(),
          rotationY: input.ghostRotY,
        },
      ];
  }
}

/**
 * Сегменты вдоль хорды start→end: одна ориентация, без L и дуг.
 * Нужен для «диагоналей» и продолжения вдоль якоря без ложного 90°.
 */
function getChordStraightConveyorPath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  const step = input.step;
  if (dist < 0.01) {
    return [{ position: start.clone(), rotationY: input.ghostRotY }];
  }
  const offset = input.conveyorRotOffset;
  const rotY = Math.atan2(dx, dz) + offset;
  const result: ConveyorPathSegment[] = [];
  const count = Math.max(1, Math.round(dist / step));
  for (let i = 0; i <= count; i++) {
    const t = (i / count) * dist;
    const ux = dx / dist;
    const uz = dz / dist;
    result.push({
      position: new THREE.Vector3(
        start.x + ux * t,
        start.y,
        start.z + uz * t,
      ),
      rotationY: rotY,
    });
  }
  return result;
}

function getBiTangentCubicPath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  const rs = input.tangentStart;
  const re = input.tangentEnd;
  if (rs === null || re === null) {
    return getLShapedPath(start, end, input);
  }
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  const step = input.step;
  if (dist < 0.01) {
    return [{ position: start.clone(), rotationY: input.ghostRotY }];
  }
  const offset = input.conveyorRotOffset;
  const incDir = rs - offset;
  const outDir = re - offset;
  const vin = new THREE.Vector3(Math.sin(incDir), 0, Math.cos(incDir));
  const vout = new THREE.Vector3(Math.sin(outDir), 0, Math.cos(outDir));
  const chordN = new THREE.Vector3(dx / dist, 0, dz / dist);
  if (
    chordN.x * vin.x + chordN.z * vin.z > CONVEYOR_DUAL_TANGENT_STRAIGHT_MIN &&
    chordN.x * vout.x + chordN.z * vout.z > CONVEYOR_DUAL_TANGENT_STRAIGHT_MIN
  ) {
    return getChordStraightConveyorPath(start, end, input);
  }
  const L1 = Math.min(step * 2.5, dist * 0.4);
  const L2 = Math.min(step * 2.5, dist * 0.4);
  const p0 = new THREE.Vector3(start.x, start.y, start.z);
  const p1 = p0.clone().add(vin.clone().multiplyScalar(L1));
  const p3 = new THREE.Vector3(end.x, start.y, end.z);
  const p2 = p3.clone().sub(vout.clone().multiplyScalar(L2));
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  return sampleConveyorAlongCurve(curve, start.y, input);
}

function getLShapedPath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const step = input.step;
  if (Math.hypot(dx, dz) < 0.01) {
    return [{ position: start.clone(), rotationY: input.ghostRotY }];
  }
  const result: ConveyorPathSegment[] = [];
  const offset = input.conveyorRotOffset;

  const absDx = Math.abs(dx);
  const absDz = Math.abs(dz);
  const incoming = input.tangentStart;
  const dist = Math.hypot(dx, dz);

  if (incoming !== null && dist > 0.01) {
    const incDir = incoming - offset;
    const uix = Math.sin(incDir);
    const uiz = Math.cos(incDir);
    const chx = dx / dist;
    const chz = dz / dist;
    if (chx * uix + chz * uiz > CONVEYOR_TANGENT_ALIGN_MIN) {
      return getChordStraightConveyorPath(start, end, input);
    }
  }
  if (
    absDx > CONVEYOR_AXIS_LEAN_EPS &&
    absDz > CONVEYOR_AXIS_LEAN_EPS &&
    Math.min(absDx, absDz) / Math.max(absDx, absDz) > 0.35
  ) {
    return getChordStraightConveyorPath(start, end, input);
  }

  let firstAlongX: boolean;
  let corner: THREE.Vector3;
  if (incoming !== null) {
    const incDir = incoming - offset;
    const ux = Math.sin(incDir);
    const uz = Math.cos(incDir);
    firstAlongX = Math.abs(ux) >= Math.abs(uz);
    corner = firstAlongX
      ? new THREE.Vector3(end.x, start.y, start.z)
      : new THREE.Vector3(start.x, start.y, end.z);
    let leg1Dx = corner.x - start.x;
    let leg1Dz = corner.z - start.z;
    if (leg1Dx * ux + leg1Dz * uz < -0.001) {
      firstAlongX = !firstAlongX;
      corner = firstAlongX
        ? new THREE.Vector3(end.x, start.y, start.z)
        : new THREE.Vector3(start.x, start.y, end.z);
      leg1Dx = corner.x - start.x;
      leg1Dz = corner.z - start.z;
      if (leg1Dx * ux + leg1Dz * uz < -0.001) {
        firstAlongX = absDx >= absDz;
        corner = firstAlongX
          ? new THREE.Vector3(end.x, start.y, start.z)
          : new THREE.Vector3(start.x, start.y, end.z);
      }
    }
  } else {
    firstAlongX = absDx >= absDz;
    corner = firstAlongX
      ? new THREE.Vector3(end.x, start.y, start.z)
      : new THREE.Vector3(start.x, start.y, end.z);
  }

  const arcRadius = Math.min(step * 2, absDx, absDz);

  const leg1Dx = corner.x - start.x;
  const leg1Dz = corner.z - start.z;
  const leg1Dist = Math.hypot(leg1Dx, leg1Dz);
  const leg1RotY =
    leg1Dist > 0.01
      ? Math.atan2(leg1Dx, leg1Dz) + offset
      : input.ghostRotY;

  const shortenedLeg1Dist = Math.max(0, leg1Dist - arcRadius);
  if (shortenedLeg1Dist > 0.01) {
    const count1 = Math.max(1, Math.round(shortenedLeg1Dist / step));
    const dirX = leg1Dx / leg1Dist;
    const dirZ = leg1Dz / leg1Dist;
    for (let i = 0; i <= count1; i++) {
      const d = (i / count1) * shortenedLeg1Dist;
      result.push({
        position: new THREE.Vector3(
          start.x + dirX * d,
          start.y,
          start.z + dirZ * d,
        ),
        rotationY: leg1RotY,
      });
    }
  } else {
    result.push({ position: start.clone(), rotationY: leg1RotY });
  }

  const leg2Dx = end.x - corner.x;
  const leg2Dz = end.z - corner.z;
  const leg2Dist = Math.hypot(leg2Dx, leg2Dz);
  const leg2RotY =
    leg2Dist > 0.01 ? Math.atan2(leg2Dx, leg2Dz) + offset : leg1RotY;

  if (arcRadius > 0.01 && leg1Dist > 0.01 && leg2Dist > 0.01) {
    const leg1DirX = leg1Dx / leg1Dist;
    const leg1DirZ = leg1Dz / leg1Dist;
    const leg2DirX = leg2Dx / leg2Dist;
    const leg2DirZ = leg2Dz / leg2Dist;
    const arcStart = new THREE.Vector3(
      corner.x - leg1DirX * arcRadius,
      start.y,
      corner.z - leg1DirZ * arcRadius,
    );
    const arcEnd = new THREE.Vector3(
      corner.x + leg2DirX * arcRadius,
      start.y,
      corner.z + leg2DirZ * arcRadius,
    );
    const ox = corner.x - leg1DirX * arcRadius + leg2DirX * arcRadius;
    const oz = corner.z - leg1DirZ * arcRadius + leg2DirZ * arcRadius;
    const phi0 = Math.atan2(arcStart.x - ox, arcStart.z - oz);
    const phi1 = Math.atan2(arcEnd.x - ox, arcEnd.z - oz);
    let sweep = phi1 - phi0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    if (Math.abs(sweep) > (3 * Math.PI) / 4) {
      sweep = sweep > 0 ? sweep - 2 * Math.PI : sweep + 2 * Math.PI;
    }
    const arcLen = Math.abs(sweep) * arcRadius;
    const arcSegCount = Math.max(
      6,
      Math.min(36, Math.ceil(arcLen / Math.max(step * 0.35, 0.15))),
    );
    for (let i = 1; i <= arcSegCount; i++) {
      const u = i / arcSegCount;
      const phi = phi0 + sweep * u;
      const px = ox + arcRadius * Math.sin(phi);
      const pz = oz + arcRadius * Math.cos(phi);
      const tx = arcRadius * Math.cos(phi);
      const tz = -arcRadius * Math.sin(phi);
      result.push({
        position: new THREE.Vector3(px, start.y, pz),
        rotationY: Math.atan2(tx, tz) + offset,
      });
    }
  }

  const shortenedLeg2Dist = Math.max(0, leg2Dist - arcRadius);
  if (shortenedLeg2Dist > 0.01) {
    const count2 = Math.max(1, Math.round(shortenedLeg2Dist / step));
    const dirX2 = leg2Dx / leg2Dist;
    const dirZ2 = leg2Dz / leg2Dist;
    for (let i = 1; i <= count2; i++) {
      const d = arcRadius + (i / count2) * shortenedLeg2Dist;
      result.push({
        position: new THREE.Vector3(
          corner.x + dirX2 * d,
          start.y,
          corner.z + dirZ2 * d,
        ),
        rotationY: leg2RotY,
      });
    }
  }

  return result;
}

function sampleConveyorAlongCurve(
  curve: THREE.Curve<THREE.Vector3>,
  startY: number,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  const step = input.step;
  const arcLength = curve.getLength();
  const count = Math.max(2, Math.round(arcLength / step));
  const offset = input.conveyorRotOffset;
  const result: ConveyorPathSegment[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    result.push({
      position: new THREE.Vector3(pt.x, startY, pt.z),
      rotationY: Math.atan2(tangent.x, tangent.z) + offset,
    });
  }
  return result;
}

function getCurvePath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: ConveyorPathComputeInput,
): ConveyorPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  const step = input.step;
  if (dist < 0.01) {
    return [{ position: start.clone(), rotationY: input.ghostRotY }];
  }

  const roff = input.conveyorRotOffset;
  const incoming = input.tangentStart;
  const outgoing = input.tangentEnd;

  let curve: THREE.Curve<THREE.Vector3>;
  if (incoming !== null || outgoing !== null) {
    const L1 = Math.min(step * 2.5, dist * 0.4);
    const L2 = Math.min(step * 2.5, dist * 0.4);
    const p0 = new THREE.Vector3(start.x, start.y, start.z);
    const p3 = new THREE.Vector3(end.x, start.y, end.z);
    const chordN = new THREE.Vector3(dx, 0, dz).normalize();
    const p1 =
      incoming !== null
        ? p0
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(incoming - roff),
                0,
                Math.cos(incoming - roff),
              ).multiplyScalar(L1),
            )
        : p0.clone().add(chordN.clone().multiplyScalar(L1 * 0.65));
    const p2 =
      outgoing !== null
        ? p3
            .clone()
            .sub(
              new THREE.Vector3(
                Math.sin(outgoing - roff),
                0,
                Math.cos(outgoing - roff),
              ).multiplyScalar(L2),
            )
        : p3.clone().sub(chordN.clone().multiplyScalar(L2 * 0.65));
    curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  } else {
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      start.y,
      (start.z + end.z) / 2,
    );
    const perpX = -dz;
    const perpZ = dx;
    const bulge = dist * 0.35;
    const control = new THREE.Vector3(
      mid.x + (perpX / dist) * bulge,
      start.y,
      mid.z + (perpZ / dist) * bulge,
    );
    curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, start.y, start.z),
      control,
      new THREE.Vector3(end.x, start.y, end.z),
    );
  }

  return sampleConveyorAlongCurve(curve, start.y, input);
}
