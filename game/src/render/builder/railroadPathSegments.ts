// ============================================================
// Railroad paths — straight segments plus one mirrored corner
// ============================================================

import * as THREE from "three";
import type { BuilderMode } from "../../core/types.ts";
import {
  RAILROAD_CORNER_LARGE_MODEL_PATH,
  RAILROAD_STRAIGHT_MODEL_PATH,
} from "../../buildings/logistics/railroadKitModels.ts";

export type RailroadPathSegment = {
  position: THREE.Vector3;
  rotationY: number;
  partPath: string;
  mirrorX?: boolean;
};

type RailroadPathInput = {
  builderMode: BuilderMode;
  step: number;
  tangentStart: number | null;
  ghostRotY: number;
  cornerInnerOffset?: { x: number; z: number };
  cornerTrim?: number;
};

const AXIS_EPS = 0.03;
const RAILROAD_STRAIGHT_OVERLAP = 0;

export function computeRailroadPathSegments(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: RailroadPathInput,
): RailroadPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) {
    return [
      {
        position: start.clone(),
        rotationY: input.ghostRotY,
        partPath: RAILROAD_STRAIGHT_MODEL_PATH,
      },
    ];
  }

  if (
    input.builderMode === "chord" ||
    input.builderMode === "curve" ||
    input.builderMode === "free" ||
    Math.abs(dx) < AXIS_EPS ||
    Math.abs(dz) < AXIS_EPS
  ) {
    return getStraightRun(start, end, input.step, input.ghostRotY);
  }

  return getLRun(start, end, input);
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
    if (ts.length === 0 || Math.abs(ts[ts.length - 1]! - lastCenter) > 1e-3) {
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
    result.push({
      position: start.clone(),
      rotationY: rotY,
      partPath: RAILROAD_STRAIGHT_MODEL_PATH,
    });
    return result;
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

function getLRun(
  start: THREE.Vector3,
  end: THREE.Vector3,
  input: RailroadPathInput,
): RailroadPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const absDx = Math.abs(dx);
  const absDz = Math.abs(dz);
  let firstAlongX = absDx >= absDz;

  if (input.tangentStart !== null) {
    const ux = Math.sin(input.tangentStart);
    const uz = Math.cos(input.tangentStart);
    firstAlongX = Math.abs(ux) >= Math.abs(uz);
  }

  const corner = firstAlongX
    ? new THREE.Vector3(end.x, start.y, start.z)
    : new THREE.Vector3(start.x, start.y, end.z);

  const leg1Dir = new THREE.Vector3(corner.x - start.x, 0, corner.z - start.z);
  const leg2Dir = new THREE.Vector3(end.x - corner.x, 0, end.z - corner.z);
  const len1 = leg1Dir.length();
  const len2 = leg2Dir.length();
  const step = input.step;
  const cornerTrim = input.cornerTrim ?? step * 0.5;

  const incoming =
    len1 > 0.01 ? Math.atan2(leg1Dir.x, leg1Dir.z) : input.ghostRotY;
  const outgoing =
    len2 > 0.01 ? Math.atan2(leg2Dir.x, leg2Dir.z) : incoming;

  const incomingDir = new THREE.Vector3(Math.sin(incoming), 0, Math.cos(incoming));
  const outgoingDir = new THREE.Vector3(Math.sin(outgoing), 0, Math.cos(outgoing));
  const cross = incomingDir.x * outgoingDir.z - incomingDir.z * outgoingDir.x;
  const mirrorX = cross < 0;

  const result: RailroadPathSegment[] = [];

  if (len1 >= 0.04) {
    const run1 = Math.max(0, len1 - cornerTrim);
    pushStraightCentersAlongLeg(start, leg1Dir, run1, step, incoming, result);
  }

  const cornerSegment: RailroadPathSegment = {
    position: cornerPivotForInnerVertex(
      corner,
      incoming,
      input.cornerInnerOffset ?? { x: step * 0.44, z: -step * 0.56 },
      mirrorX,
    ),
    rotationY: incoming,
    partPath: RAILROAD_CORNER_LARGE_MODEL_PATH,
    mirrorX,
  };
  result.push(cornerSegment);

  if (len2 >= 0.04) {
    const run2 = Math.max(0, len2 - cornerTrim);
    const leg2Start = corner
      .clone()
      .add(outgoingDir.clone().multiplyScalar(cornerTrim));
    pushStraightCentersAlongLeg(leg2Start, leg2Dir, run2, step, outgoing, result);
  }

  return result;
}
