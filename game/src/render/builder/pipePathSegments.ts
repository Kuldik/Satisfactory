// ============================================================
// Ортогональные трубы: только 90° — прямые + колено в углу L.
// ============================================================

import * as THREE from "three";
import {
  PIPE_PROCEDURAL_ELBOW_PATH,
  PIPE_PROCEDURAL_STRAIGHT_PATH,
  PIPE_RUN_ROT_Y_OFFSET,
} from "../../buildings/logistics/pipeKitModels.ts";
import { proceduralPipeArcRadius } from "../../buildings/logistics/proceduralPipeGeometry.ts";
import type { ConveyorPathSegment } from "./conveyorPathSegments.ts";

export type PipePathSegment = {
  position: THREE.Vector3;
  rotationY: number;
  partPath: string;
  /** Только колено: rotationY входящей прямой (с PIPE_RUN_ROT_Y_OFFSET). */
  elbowIncomingRotY?: number;
  elbowTurn?: 1 | -1;
  /**
   * Длина процедурной прямой (м) по фактической хорде до следующего узла или до pathEnd;
   * иначе берётся `step` при постановке.
   */
  straightChordMeters?: number;
};

const STRAIGHT_CHORD_OVERLAP = 1.018;
const DEFAULT_STRAIGHT_CHORD_FACTOR = STRAIGHT_CHORD_OVERLAP;

/**
 * Узел L от start к end: есть ли угол с двумя плечами (нужен коленный пивот).
 * Совпадает с логикой `computePipePathSegments` / второго клика по ноге.
 */
export function pipeLShapeInfoFromLineEnd(
  start: THREE.Vector3,
  end: THREE.Vector3,
  tol = 0.06,
  preferAxisFlip = false,
): { corner: THREE.Vector3; needsElbow: boolean; len1: number; len2: number } {
  const y = start.y;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  if (Math.hypot(dx, dz) < tol) {
    return { corner: end.clone(), needsElbow: false, len1: 0, len2: 0 };
  }
  const naturalAlongX = Math.abs(dx) >= Math.abs(dz);
  const firstAlongX = preferAxisFlip ? !naturalAlongX : naturalAlongX;
  const corner = firstAlongX
    ? new THREE.Vector3(end.x, y, start.z)
    : new THREE.Vector3(start.x, y, end.z);
  const leg1 = new THREE.Vector3(corner.x - start.x, 0, corner.z - start.z);
  const leg2 = new THREE.Vector3(end.x - corner.x, 0, end.z - corner.z);
  const len1 = leg1.length();
  const len2 = leg2.length();
  return {
    corner,
    needsElbow: len1 >= tol && len2 >= tol,
    len1,
    len2,
  };
}

/**
 * Сегменты **первой** ноги (как `computePipeStraightSegmentsOnly` + `trim`) + хорды
 * в соответствии с постановкой второго клика: «фиктивное» колено только при полном L.
 */
export function buildPipeFirstLegForPreviewAndPlace(
  start: THREE.Vector3,
  end: THREE.Vector3,
  step: number,
  preferAxisFlip = false,
  startBackTrim = 0,
): PipePathSegment[] {
  const { needsElbow, corner } = pipeLShapeInfoFromLineEnd(
    start,
    end,
    0.06,
    preferAxisFlip,
  );
  /**
   * Когда оси L переключены через flip, первая нога идёт start->corner
   * по альтернативной оси, а не вдоль доминирующего dx/dz.
   */
  const firstLegEnd = needsElbow ? corner : end;
  const result = computePipeStraightSegmentsOnly(
    start,
    firstLegEnd,
    step,
    needsElbow,
    startBackTrim,
  );
  for (const s of result) {
    if (s.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH) {
      s.straightChordMeters = step * DEFAULT_STRAIGHT_CHORD_FACTOR;
    }
  }
  /**
   * Последняя прямая в полном L: торец должен сесть точно на вход дуги
   * (corner - R * incomingDir). Иначе виден провал (gap) или «вдавленность»
   * прямой в колено.
   */
  if (needsElbow) {
    fitLastSegmentChordToArcEntry(result, corner, step);
  }
  return result;
}

/**
 * Подгоняет хорду последнего прямого сегмента так, чтобы его передний торец
 * совпал с торцом четверть-круга колена. R = `proceduralPipeArcRadius(step)`.
 */
function fitLastSegmentChordToArcEntry(
  segments: PipePathSegment[],
  corner: THREE.Vector3,
  step: number,
): void {
  let lastStraight: PipePathSegment | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]!;
    if (s.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH) {
      lastStraight = s;
      break;
    }
  }
  if (!lastStraight) return;
  const off = PIPE_RUN_ROT_Y_OFFSET;
  const fx = Math.sin(lastStraight.rotationY - off);
  const fz = Math.cos(lastStraight.rotationY - off);
  const dx = corner.x - lastStraight.position.x;
  const dz = corner.z - lastStraight.position.z;
  const D = dx * fx + dz * fz;
  const R = proceduralPipeArcRadius(step);
  const chord = Math.max(step * 0.18, 2 * (D - R));
  lastStraight.straightChordMeters = chord;
}

export function assignDefaultPipeStraightChordMeters(
  segments: PipePathSegment[],
  step: number,
): void {
  for (const s of segments) {
    if (s.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH) {
      s.straightChordMeters = step * DEFAULT_STRAIGHT_CHORD_FACTOR;
    } else {
      delete s.straightChordMeters;
    }
  }
}

/**
 * Заполняет `straightChordMeters` для каждого прямого сегмента: стык в стык с соседом
 * и корректная длина до колена (пивот колена в углу — длина от центра прямой до пивота).
 */
export function assignPipeStraightChordMeters(
  segments: PipePathSegment[],
  pathEnd: THREE.Vector3,
  step: number,
): void {
  const minL = Math.max(0.1, step * 0.12);
  const off = PIPE_RUN_ROT_Y_OFFSET;
  const R = proceduralPipeArcRadius(step);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) {
      delete s.straightChordMeters;
      continue;
    }
    const next = segments[i + 1];
    if (next) {
      if (next.partPath === PIPE_PROCEDURAL_ELBOW_PATH) {
        /**
         * Стык прямой с коленом: передний торец прямой ровно на входе дуги
         * (corner - R * incomingDir). Без этого либо щель, либо колено
         * выглядит «вдавленным» в трубу.
         */
        const fx = Math.sin(s.rotationY - off);
        const fz = Math.cos(s.rotationY - off);
        const dx = next.position.x - s.position.x;
        const dz = next.position.z - s.position.z;
        const D = dx * fx + dz * fz;
        s.straightChordMeters = Math.max(minL, 2 * (D - R));
      } else {
        const d = s.position.distanceTo(next.position);
        s.straightChordMeters = Math.max(minL, d * STRAIGHT_CHORD_OVERLAP);
      }
      continue;
    }
    const e = s.position.distanceTo(pathEnd);
    /** Хвост к углу / к курсору: одна клетка или короткий одиночный прогон. */
    if (e < step * 0.52) {
      s.straightChordMeters = step;
    } else {
      s.straightChordMeters = Math.max(
        minL,
        Math.min(step * 8, 2 * e * STRAIGHT_CHORD_OVERLAP),
      );
    }
  }
}

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

/**
 * Отступ от вершины угла, при котором последний прямой сегмент имеет
 * центр в R + chord/2 от corner. Для chord ≈ step и R = step*0.5 → trim = step.
 * Это гарантирует, что центр прямой НЕ попадает на торец дуги (chord не уходит в 0).
 */
export function pipeCornerTrimForFullCorner(step: number, legLen: number): number {
  const tol = 0.06;
  const R = proceduralPipeArcRadius(step);
  const want = Math.max(R + step * 0.5, tol * 0.5);
  if (legLen < tol) return 0;
  return Math.min(want, legLen * 0.48);
}

export function computePipePathSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  step: number,
  preferAxisFlip = false,
  startBackTrim = 0,
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

  const naturalAlongX = Math.abs(dx) >= Math.abs(dz);
  const firstAlongX = preferAxisFlip ? !naturalAlongX : naturalAlongX;
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
    backTrim = 0,
  ): void {
    if (runLen < tol) return;
    const full = legDir.length();
    if (full < tol) return;
    const ux = legDir.x / full;
    const uz = legDir.z / full;
    const rotY = Math.atan2(ux, uz) + PIPE_RUN_ROT_Y_OFFSET;
    const spacing = Math.max(step, 0.12);
    const t0 = Math.min(Math.max(0, backTrim), Math.max(0, runLen));

    /** Центры сегментов через `spacing` — стык в стык по длине одной трубы. */
    const ts: number[] = [];
    if (runLen <= spacing + 1e-4) {
      ts.push(Math.max(runLen * 0.5, t0));
    } else {
      ts.push(t0);
      let t = Math.max(spacing, t0 + spacing * 0.5);
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
    pushStraightRun(start, dir1, run1, startBackTrim);
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

/** Траектория как у конвейера → только прямые процедурные сегменты трубы (смещение поворота как у ленты). */
export function mapConveyorSegmentsToPipeStraights(
  segments: ConveyorPathSegment[],
  conveyorRotOffset: number,
): PipePathSegment[] {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  return segments.map((s) => ({
    position: s.position.clone(),
    rotationY: s.rotationY - conveyorRotOffset + off,
    partPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
  }));
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
  /** Сдвиг первого центра вперёд по направлению (для back-trim у существующего соседа). */
  startBackTrim = 0,
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
  const t0 = Math.min(Math.max(0, startBackTrim), Math.max(0, runLen));
  const ts: number[] = [];
  if (runLen <= spacing + 1e-4) {
    ts.push(Math.max(runLen * 0.5, t0));
  } else {
    ts.push(t0);
    let t = Math.max(spacing, t0 + spacing * 0.5);
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

/**
 * Когда новая нога стартует вплотную к уже стоящему колену/прямой того же типа,
 * сместить первый центр первой ноги на (R + step/2) вперёд, чтобы новая прямая не
 * залезала торцом внутрь существующей геометрии. Возвращает 0, если сосед не найден.
 */
export function pipeStartBackTrimForExistingNeighbor(
  start: THREE.Vector3,
  forwardDirX: number,
  forwardDirZ: number,
  step: number,
  neighbors: Iterable<{
    x: number;
    z: number;
    partPath: string;
    rotY: number;
    chord: number;
  }>,
  menuMatchPartPaths: ReadonlySet<string>,
): number {
  const R = proceduralPipeArcRadius(step);
  const probeR = step * 0.55;
  let any = false;
  for (const n of neighbors) {
    if (!menuMatchPartPaths.has(n.partPath)) continue;
    const dx = n.x - start.x;
    const dz = n.z - start.z;
    const distXZ = Math.hypot(dx, dz);
    if (distXZ > probeR) continue;
    /** Только сосед с задней полусферы относительно forward dir. */
    const back = -(dx * forwardDirX + dz * forwardDirZ);
    if (back < -step * 0.05) continue;
    any = true;
    break;
  }
  return any ? R + step * 0.5 : 0;
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
