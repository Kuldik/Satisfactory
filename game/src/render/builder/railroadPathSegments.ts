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
};

const AXIS_EPS = 0.03;

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
  const count = Math.max(1, Math.round(dist / step));
  const ux = dist > 0.01 ? dx / dist : 0;
  const uz = dist > 0.01 ? dz / dist : 1;
  const result: RailroadPathSegment[] = [];
  for (let i = 0; i <= count; i++) {
    const d = (i / count) * dist;
    result.push({
      position: new THREE.Vector3(start.x + ux * d, start.y, start.z + uz * d),
      rotationY: rotY,
      partPath: RAILROAD_STRAIGHT_MODEL_PATH,
    });
  }
  return result;
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

  const leg1 = getStraightRun(
    start,
    corner,
    input.step,
    input.ghostRotY,
  ).slice(0, -1);
  const leg2 = getStraightRun(corner, end, input.step, input.ghostRotY).slice(1);

  const incoming = leg1.at(-1)?.rotationY ?? Math.atan2(corner.x - start.x, corner.z - start.z);
  const outgoing = leg2[0]?.rotationY ?? Math.atan2(end.x - corner.x, end.z - corner.z);
  const incomingDir = new THREE.Vector3(Math.sin(incoming), 0, Math.cos(incoming));
  const outgoingDir = new THREE.Vector3(Math.sin(outgoing), 0, Math.cos(outgoing));
  const cross = incomingDir.x * outgoingDir.z - incomingDir.z * outgoingDir.x;

  const cornerSegment: RailroadPathSegment = {
    position: corner,
    rotationY: incoming,
    partPath: RAILROAD_CORNER_LARGE_MODEL_PATH,
    mirrorX: cross < 0,
  };

  return [...leg1, cornerSegment, ...leg2];
}
