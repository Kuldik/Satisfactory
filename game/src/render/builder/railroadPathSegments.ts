// ============================================================
// Railroad paths — straight chains plus one snapped mirrored corner
// ============================================================

import * as THREE from "three";
import {
  RAILROAD_CORNER_LARGE_MODEL_PATH,
  RAILROAD_STRAIGHT_MODEL_PATH,
} from "../../buildings/logistics/railroadKitModels.ts";

export type RailroadPathSegment = {
  position: THREE.Vector3;
  rotationY: number;
  partPath: string;
  mirrorX?: boolean;
  exitPosition?: THREE.Vector3;
  exitRotationY?: number;
};

type RailroadStraightPathInput = {
  step: number;
  tangentStart: number | null;
  ghostRotY: number;
  /** R на прямой: тянуть цепь в обратную сторону вдоль tangent. */
  reverse?: boolean;
};

type RailroadCornerPathInput = {
  incomingRotY: number;
  mirrorX: boolean;
  entryLeg: number;
  exitLeg: number;
  cornerInnerOffset: { x: number; z: number };
};

const RAILROAD_STRAIGHT_OVERLAP = 0;

export function computeRailroadStraightSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: RailroadStraightPathInput,
): RailroadPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;

  if (input.tangentStart !== null) {
    const fx = Math.sin(input.tangentStart);
    const fz = Math.cos(input.tangentStart);
    let along = dx * fx + dz * fz;
    if (input.reverse) along = -along;
    const dirSign = along < 0 ? -1 : 1;
    const rotY = dirSign < 0 ? input.tangentStart + Math.PI : input.tangentStart;
    return getStraightRun(
      start,
      new THREE.Vector3(
        start.x + fx * along,
        start.y,
        start.z + fz * along,
      ),
      input.step,
      rotY,
    );
  }

  const useX = Math.abs(dx) >= Math.abs(dz);
  const axisEnd = useX
    ? new THREE.Vector3(end.x, start.y, start.z)
    : new THREE.Vector3(start.x, start.y, end.z);
  const axisRun = useX ? dx : dz;
  const fallbackRotY =
    Math.abs(axisRun) > 0.01
      ? useX
        ? Math.sign(axisRun) * (Math.PI / 2)
        : axisRun < 0
          ? Math.PI
          : 0
      : input.ghostRotY;
  return getStraightRun(start, axisEnd, input.step, fallbackRotY);
}

export function computeRailroadCornerSegment(
  anchor: THREE.Vector3,
  input: RailroadCornerPathInput,
): RailroadPathSegment {
  const incomingDir = new THREE.Vector3(
    Math.sin(input.incomingRotY),
    0,
    Math.cos(input.incomingRotY),
  );
  const turn = input.mirrorX ? -Math.PI / 2 : Math.PI / 2;
  const outgoingRotY = input.incomingRotY + turn;
  const outgoingDir = new THREE.Vector3(
    Math.sin(outgoingRotY),
    0,
    Math.cos(outgoingRotY),
  );
  // Entry open face sits on anchor; inner vertex is back along incoming leg.
  const innerCorner = anchor
    .clone()
    .sub(incomingDir.clone().multiplyScalar(input.entryLeg));
  const exitPosition = innerCorner
    .clone()
    .add(outgoingDir.clone().multiplyScalar(input.exitLeg));

  return {
    position: cornerPivotForInnerVertex(
      innerCorner,
      input.incomingRotY,
      input.cornerInnerOffset,
      input.mirrorX,
    ),
    rotationY: input.incomingRotY,
    partPath: RAILROAD_CORNER_LARGE_MODEL_PATH,
    mirrorX: input.mirrorX,
    exitPosition,
    exitRotationY: outgoingRotY,
  };
}

export function railroadEndpointFromSegmentCenter(
  center: THREE.Vector3,
  rotY: number,
  step: number,
  sign: 1 | -1,
): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.sin(rotY) * step * 0.5 * sign,
    center.y,
    center.z + Math.cos(rotY) * step * 0.5 * sign,
  );
}

function getStraightRun(
  start: THREE.Vector3,
  end: THREE.Vector3,
  step: number,
  fallbackRotY: number,
): RailroadPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  const rotY = dist > 0.01 ? Math.atan2(dx, dz) : fallbackRotY;
  const result: RailroadPathSegment[] = [];
  if (dist < 0.04) {
    return [
      {
        position: start.clone(),
        rotationY: rotY,
        partPath: RAILROAD_STRAIGHT_MODEL_PATH,
      },
    ];
  }
  pushStraightCentersAlongLeg(
    start,
    new THREE.Vector3(dx, 0, dz),
    dist,
    step,
    rotY,
    result,
  );
  return result;
}

function pushStraightCentersAlongLeg(
  from: THREE.Vector3,
  legDir: THREE.Vector3,
  runLen: number,
  step: number,
  rotY: number,
  out: RailroadPathSegment[],
  backTrim = 0,
): void {
  if (runLen < 0.04) return;
  const full = legDir.length();
  if (full < 1e-4) return;
  const ux = legDir.x / full;
  const uz = legDir.z / full;
  const spacing = Math.max(step * (1 - RAILROAD_STRAIGHT_OVERLAP), 0.12);
  const half = step * 0.5;
  const t0 = Math.min(Math.max(0, backTrim), Math.max(0, runLen));

  const ts: number[] = [];
  if (runLen <= step + 1e-4) {
    ts.push(Math.max(runLen * 0.5, t0));
  } else {
    let t = Math.max(t0 + half, half);
    const lastCenter = runLen - half;
    while (t < lastCenter - 1e-4) {
      ts.push(t);
      t += spacing;
    }
    const prev = ts[ts.length - 1];
    if (
      prev === undefined ||
      (lastCenter - prev >= step - 1e-3 &&
        Math.abs(prev - lastCenter) > 1e-3)
    ) {
      ts.push(lastCenter);
    }
  }

  for (const t of ts) {
    out.push({
      position: new THREE.Vector3(
        from.x + ux * t,
        from.y,
        from.z + uz * t,
      ),
      rotationY: rotY,
      partPath: RAILROAD_STRAIGHT_MODEL_PATH,
    });
  }
}

function cornerPivotForInnerVertex(
  innerCorner: THREE.Vector3,
  incomingRotY: number,
  innerOffset: { x: number; z: number },
  mirrorX: boolean,
): THREE.Vector3 {
  const signX = mirrorX ? -1 : 1;
  const localX = innerOffset.x * signX;
  const localZ = innerOffset.z;
  const c = Math.cos(incomingRotY);
  const s = Math.sin(incomingRotY);
  const worldX = localX * c - localZ * s;
  const worldZ = localX * s + localZ * c;
  return new THREE.Vector3(
    innerCorner.x - worldX,
    innerCorner.y,
    innerCorner.z - worldZ,
  );
}

/** Inverse of cornerPivotForInnerVertex — inner L vertex from placed pivot. */
export function railroadInnerVertexFromPivot(
  pivot: THREE.Vector3,
  incomingRotY: number,
  innerOffset: { x: number; z: number },
  mirrorX: boolean,
): THREE.Vector3 {
  const signX = mirrorX ? -1 : 1;
  const localX = innerOffset.x * signX;
  const localZ = innerOffset.z;
  const c = Math.cos(incomingRotY);
  const s = Math.sin(incomingRotY);
  const worldX = localX * c - localZ * s;
  const worldZ = localX * s + localZ * c;
  return new THREE.Vector3(
    pivot.x + worldX,
    pivot.y,
    pivot.z + worldZ,
  );
}

/** Recompute entry/exit for a placed corner from pivot + rotation (F5 / old saves). */
export function recomputeRailroadCornerEndpoints(
  pivot: THREE.Vector3,
  incomingRotY: number,
  mirrorX: boolean,
  legs: {
    entryLeg: number;
    exitLeg: number;
    innerOffset: { x: number; z: number };
  },
): { entryAnchor: THREE.Vector3; exitPosition: THREE.Vector3; exitRotationY: number } {
  const innerCorner = railroadInnerVertexFromPivot(
    pivot,
    incomingRotY,
    legs.innerOffset,
    mirrorX,
  );
  const incomingDir = new THREE.Vector3(
    Math.sin(incomingRotY),
    0,
    Math.cos(incomingRotY),
  );
  const turn = mirrorX ? -Math.PI / 2 : Math.PI / 2;
  const exitRotationY = incomingRotY + turn;
  const outgoingDir = new THREE.Vector3(
    Math.sin(exitRotationY),
    0,
    Math.cos(exitRotationY),
  );
  const entryAnchor = innerCorner
    .clone()
    .add(incomingDir.clone().multiplyScalar(legs.entryLeg));
  const exitPosition = innerCorner
    .clone()
    .add(outgoingDir.clone().multiplyScalar(legs.exitLeg));
  return { entryAnchor, exitPosition, exitRotationY };
}
