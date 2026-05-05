// ============================================================
// Трубопровод: лёгкие детали Kenney Space Station Kit (десятки вершин),
// без тяжёлых кастомных GLB из kits/models.
// ============================================================

const SPACE_GLB = "/kits/kenney_space-station-kit/Models/GLB format";

/** ~36 вершин, горизонтальный прямой участок (только pipe_junction / совместимость). */
export const PIPE_STRAIGHT_MODEL_PATH = `${SPACE_GLB}/pipe.glb`;
/** ~96 вершин, угол 90° — только для `pipe_junction` в single; линии pipe_mk* процедурные. */
export const PIPE_ELBOW_MODEL_PATH = `${SPACE_GLB}/pipe-bend.glb`;

/** Сегменты линии трубопровода mk1/mk2 — без Kenney GLB. */
export const PIPE_PROCEDURAL_STRAIGHT_PATH = "procedural:pipe-straight";
export const PIPE_PROCEDURAL_ELBOW_PATH = "procedural:pipe-elbow";
export const PIPE_PROCEDURAL_FREE_CURVE_PATH = "procedural:pipe-free-curve";

/** После `PIPE_LAY_FLAT_ROT_X` ось трассы Kenney совпадает с rotationY без сдвига как у ленты. */
export const PIPE_RUN_ROT_Y_OFFSET = 0;

/** Kenney `pipe.glb` / `pipe-bend.glb` стоят «столбом» по Y — кладём в плоскость пола. */
export const PIPE_LAY_FLAT_ROT_X = Math.PI / 2;

/**
 * У `pipe-bend` после Rx изгиб всё ещё в вертикальной плоскости; один roll по Z
 * кладёт L в горизонталь (XZ). Константа, не зависит от направления — поворот влево/вправо
 * только через `rotation.y` пивота.
 */
export const PIPE_BEND_LAY_FLAT_EXTRA_ROT_Z = Math.PI / 2;

export function isKenneySpaceStationPipeStraightPath(partPath: string): boolean {
  return (
    partPath.includes("kenney_space-station-kit") &&
    partPath.includes("pipe.glb") &&
    !partPath.includes("pipe-bend")
  );
}

export function isKenneySpaceStationPipeBendPath(partPath: string): boolean {
  return (
    partPath.includes("kenney_space-station-kit") &&
    partPath.includes("pipe-bend.glb")
  );
}

export function isKenneySpaceStationPipeFlangePath(partPath: string): boolean {
  return (
    partPath.includes("kenney_space-station-kit") &&
    partPath.includes("pipe-end.glb")
  );
}

export function isKenneySpaceStationPipeAssetPath(partPath: string): boolean {
  return (
    isKenneySpaceStationPipeStraightPath(partPath) ||
    isKenneySpaceStationPipeBendPath(partPath) ||
    isKenneySpaceStationPipeFlangePath(partPath)
  );
}

export function isProceduralPipePartPath(partPath: string): boolean {
  return (
    partPath === PIPE_PROCEDURAL_STRAIGHT_PATH ||
    partPath === PIPE_PROCEDURAL_ELBOW_PATH ||
    partPath === PIPE_PROCEDURAL_FREE_CURVE_PATH
  );
}

export function isPipeLineMenuId(id: string | null | undefined): boolean {
  return id === "pipe_mk1" || id === "pipe_mk2";
}

export function isPipeJunctionMenuId(id: string | null | undefined): boolean {
  return id === "pipe_junction";
}
