// ============================================================
// Процедурные сегменты трубопровода (без Kenney GLB): цилиндр по оси
// и плавное 90° в плоскости пола через CatmullRom + TubeGeometry.
// ============================================================

import * as THREE from "three";
import {
  PIPE_PROCEDURAL_ELBOW_PATH,
  PIPE_PROCEDURAL_FREE_CURVE_PATH,
  PIPE_RUN_ROT_Y_OFFSET,
  isProceduralPipePartPath,
} from "./pipeKitModels.ts";
import {
  buildPipeFreeCurveTubeGeometry,
  PIPE_FREE_CURVE_TENSION,
} from "../../render/builder/pipeFreeCurve.ts";

export { isProceduralPipePartPath };

/** Множитель радиуса (крупный вид сегментов на сетке). */
export const PROCEDURAL_PIPE_VISUAL_RADIUS_MULT = 20;

/**
 * «Логический» радиус трубы (~метры трассировки), без множителя толщины меша.
 * Коллизии, «слишком острый поворот» и капсулы между сегментами — только здесь,
 * иначе с визуальным ×20 любой участок ошибочно помечается invalid.
 */
export function proceduralPipeTubeRadiusLogical(
  menuBuildingId: string | undefined,
  scale: number,
): number {
  const base = menuBuildingId === "pipe_mk2" ? 0.2 : 0.17;
  return base * (scale / 20);
}

/** Радиус для процедурного меша (TubeGeometry / кольца) — с учётом визуального множителя. */
export function proceduralPipeTubeRadiusWorld(
  menuBuildingId: string | undefined,
  scale: number,
): number {
  return (
    proceduralPipeTubeRadiusLogical(menuBuildingId, scale) *
    PROCEDURAL_PIPE_VISUAL_RADIUS_MULT
  );
}

function newPipeBodyMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xe0ac53,
    metalness: 0.42,
    roughness: 0.44,
    side: THREE.DoubleSide,
  });
}

function newPipeFlangeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xc9a05a,
    metalness: 0.55,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
}

function attachPipeFreeCurveEndRings(
  group: THREE.Group,
  localPoints: THREE.Vector3[],
  tubeRadius: number,
  opts?: { omitStart?: boolean; omitEnd?: boolean },
): void {
  if (localPoints.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(
    localPoints,
    false,
    "catmullrom",
    PIPE_FREE_CURVE_TENSION,
  );
  /** Вне поверхности тела TubeGeometry — без наложения кольца на трубу. */
  const rIn = Math.max(tubeRadius * 1.012, tubeRadius + 0.008);
  const rOut = Math.max(rIn + tubeRadius * 0.08, tubeRadius * 1.092);
  const segs = Math.max(12, Math.min(26, Math.ceil(rOut * 4.2)));
  const addRing = (u: number, negateTan: boolean) => {
    const geom = new THREE.RingGeometry(rIn, rOut, segs);
    const mesh = new THREE.Mesh(geom, newPipeFlangeMaterial());
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();
    if (negateTan) tan.negate();
    const up =
      Math.abs(tan.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const ax = new THREE.Vector3().crossVectors(up, tan).normalize();
    const ay = new THREE.Vector3().crossVectors(tan, ax).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, tan));
    mesh.position.copy(pt);
    mesh.name = "pipe_flange_ring";
    group.add(mesh);
  };
  if (!opts?.omitStart) addRing(0, true);
  if (!opts?.omitEnd) addRing(1, false);
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
  if (partPath === PIPE_PROCEDURAL_FREE_CURVE_PATH) {
    /**
     * Как у straight/elbow: пивот стоит на плоскости размещения, а меш поднимается так,
     * чтобы низ bbox сел на эту плоскость. XZ не трогаем: первый узел локального сплайна
     * остаётся в (0, 0, 0), а центр трубы визуально поднимается на радиус.
     */
    root.position.set(0, -box.min.y, 0);
    return;
  }
  if (partPath === PIPE_PROCEDURAL_ELBOW_PATH) {
    root.position.set(0, -box.min.y, 0);
    return;
  }
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
}

export function proceduralPipeArcRadius(segmentStep: number): number {
  return Math.max(segmentStep * 0.5, 0.35);
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

/** Прямой участок: ось вдоль локального +Z, длина `segmentLengthMeters`, pivot в центре. */
export function createProceduralStraightPipeObject(
  segmentLengthMeters: number,
  tubeRadius: number,
): THREE.Group {
  const len = Math.max(segmentLengthMeters, 0.1);
  const half = Math.max(len * 0.5, 0.08);
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, -half),
    new THREE.Vector3(0, 0, half),
  );
  const tubular = Math.max(2, Math.ceil(8 * (len / 2)));
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
  /**
   * Concentric четверть круга от corner: торцы дуги ровно в R от угла,
   * чтобы прямая (длиной step/2 от центра ноги) стыковалась стык в стык.
   */
  const pts = [
    corner.clone().sub(inVec.clone().multiplyScalar(R)),
    corner.clone().sub(inVec.clone().multiplyScalar(R * 0.5)),
    corner.clone(),
    corner.clone().add(outVec.clone().multiplyScalar(R * 0.5)),
    corner.clone().add(outVec.clone().multiplyScalar(R)),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const geo = new THREE.TubeGeometry(curve, 24, tubeRadius, 16, false);
  const mesh = new THREE.Mesh(geo, newPipeBodyMaterial());
  mesh.name = "pipe_body";
  const g = new THREE.Group();
  g.name = "procedural-pipe-elbow";
  g.add(mesh);
  return g;
}

/** Одна труба по сплайну; `worldPoints` — абсолютные миры, пивот в `worldPoints[0]`. */
export function createProceduralFreeCurvePipeObject(
  worldPoints: THREE.Vector3[],
  tubeRadius: number,
  segmentStep: number,
  opts?: { omitStartFlange?: boolean },
): THREE.Group {
  const o = worldPoints[0]!.clone();
  const local = worldPoints.map((p) => p.clone().sub(o));
  const geo = buildPipeFreeCurveTubeGeometry(
    local,
    tubeRadius,
    segmentStep,
  );
  const mesh = new THREE.Mesh(geo, newPipeBodyMaterial());
  mesh.name = "pipe_body";
  const g = new THREE.Group();
  g.name = "procedural-pipe-free-curve";
  g.add(mesh);
  attachPipeFreeCurveEndRings(g, local, tubeRadius, {
    omitStart: opts?.omitStartFlange === true,
  });
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
