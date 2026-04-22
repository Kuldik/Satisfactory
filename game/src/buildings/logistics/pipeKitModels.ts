// ============================================================
// Трубопровод: лёгкие детали Kenney Space Station Kit (десятки вершин),
// без тяжёлых кастомных GLB из kits/models.
// ============================================================

const SPACE_GLB = "/kits/kenney_space-station-kit/Models/GLB format";

/** ~36 вершин, горизонтальный прямой участок */
export const PIPE_STRAIGHT_MODEL_PATH = `${SPACE_GLB}/pipe.glb`;
/** ~96 вершин, угол 90° */
export const PIPE_ELBOW_MODEL_PATH = `${SPACE_GLB}/pipe-bend.glb`;

/** После `PIPE_LAY_FLAT_ROT_X` ось трассы Kenney совпадает с rotationY без сдвига как у ленты. */
export const PIPE_RUN_ROT_Y_OFFSET = 0;

/** Kenney `pipe.glb` / `pipe-bend.glb` стоят «столбом» по Y — кладём в плоскость пола. */
export const PIPE_LAY_FLAT_ROT_X = Math.PI / 2;

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

export function isKenneySpaceStationPipeAssetPath(partPath: string): boolean {
  return (
    isKenneySpaceStationPipeStraightPath(partPath) ||
    isKenneySpaceStationPipeBendPath(partPath)
  );
}

export function isPipeLineMenuId(id: string | null | undefined): boolean {
  return id === "pipe_mk1" || id === "pipe_mk2";
}

export function isPipeJunctionMenuId(id: string | null | undefined): boolean {
  return id === "pipe_junction";
}
