// ============================================================
// Процедурные сегменты трубопровода (без Kenney GLB): цилиндр по оси
// и плавное 90° в плоскости пола через CatmullRom + TubeGeometry.
// ============================================================

import * as THREE from "three";
import {
  PIPE_PROCEDURAL_ELBOW_PATH,
  PIPE_RUN_ROT_Y_OFFSET,
  isProceduralPipePartPath,
} from "./pipeKitModels.ts";

export { isProceduralPipePartPath };

/** Множитель радиуса (20× — отладка/наглядность; вернуть к `1` для финального вида). */
export const PROCEDURAL_PIPE_VISUAL_RADIUS_MULT = 20;

/** Радиус «трубы» в метрах мира с учётом масштаба меню (как раньше ×18 / ×20). */
export function proceduralPipeTubeRadiusWorld(
  menuBuildingId: string | undefined,
  scale: number,
): number {
  const base = menuBuildingId === "pipe_mk2" ? 0.2 : 0.17;
  return base * (scale / 20) * PROCEDURAL_PIPE_VISUAL_RADIUS_MULT;
}

function newPipeBodyMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xe0ac53,
    metalness: 0.42,
    roughness: 0.44,
    side: THREE.DoubleSide,
  });
}

/**
 * Садим геометрию на пол внутри пивота: у колена пивот в углу — не сдвигаем XZ;
 * у прямого — центрируем по XZ и поднимаем по Y.
 */
export function offsetProceduralPipeRootToSitOnFloor(
  root: THREE.Object3D,
  partPath: string,
): void {
  const box = new THREE.Box3().setFromObject(root);
  if (partPath === PIPE_PROCEDURAL_ELBOW_PATH) {
    root.position.set(0, -box.min.y, 0);
    return;
  }
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
}

export function proceduralPipeArcRadius(segmentStep: number): number {
  return Math.max(segmentStep * 0.52, 0.35);
}

function disposeMeshHierarchy(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

/** Прямой участок: ось вдоль локального +Z, длина `segmentStep`, pivot в центре. */
export function createProceduralStraightPipeObject(
  segmentStep: number,
  tubeRadius: number,
): THREE.Group {
  const half = Math.max(segmentStep * 0.5, 0.08);
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, -half),
    new THREE.Vector3(0, 0, half),
  );
  const tubular = Math.max(2, Math.ceil(8 * (segmentStep / 2)));
  const geo = new THREE.TubeGeometry(
    curve,
    tubular,
    tubeRadius,
    16,
    false,
  );
  const mesh = new THREE.Mesh(geo, newPipeBodyMaterial());
  mesh.name = "pipe_body";
  const g = new THREE.Group();
  g.name = "procedural-pipe-straight";
  g.add(mesh);
  return g;
}

/** Колено 90° в плоскости XZ локально; pivot в углу (0,0,0). */
export function createProceduralElbowPipeObject(
  incomingRotY: number,
  turn: 1 | -1,
  segmentStep: number,
  tubeRadius: number,
): THREE.Group {
  const off = PIPE_RUN_ROT_Y_OFFSET;
  const inX = Math.sin(incomingRotY - off);
  const inZ = Math.cos(incomingRotY - off);
  const inVec = new THREE.Vector3(inX, 0, inZ);
  const outVec = new THREE.Vector3(-turn * inZ, 0, turn * inX);
  const R = proceduralPipeArcRadius(segmentStep);
  const corner = new THREE.Vector3(0, 0, 0);
  const pts = [
    corner.clone().sub(inVec.clone().multiplyScalar(R * 1.15)),
    corner.clone().sub(inVec.clone().multiplyScalar(R * 0.38)),
    corner.clone(),
    corner.clone().add(outVec.clone().multiplyScalar(R * 0.38)),
    corner.clone().add(outVec.clone().multiplyScalar(R * 1.15)),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
  const geo = new THREE.TubeGeometry(curve, 24, tubeRadius, 16, false);
  const mesh = new THREE.Mesh(geo, newPipeBodyMaterial());
  mesh.name = "pipe_body";
  const g = new THREE.Group();
  g.name = "procedural-pipe-elbow";
  g.add(mesh);
  return g;
}

export function replaceProceduralPipeObjectContent(
  root: THREE.Object3D,
  next: THREE.Object3D,
): void {
  while (root.children.length > 0) {
    const c = root.children[0]!;
    root.remove(c);
    disposeMeshHierarchy(c);
  }
  root.add(next);
}
