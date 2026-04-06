// ============================================================
// Resolve GLB paths for builder import / patterns. Short names
// from export (basename only) default to the building kit; names
// that only exist in the space-station kit must map there or
// import stops at the first mismatch and most of the building
// never appears.
// ============================================================

const BUILDING = "/kits/kenney_building-kit/Models/GLB format";
const SPACE = "/kits/kenney_space-station-kit/Models/GLB format";

/**
 * Basenames that our compositions take from kenney_space-station-kit.
 * floor.glb defaults to building-kit; литейная и smelter используют
 * wall-pillar-banner из space-station (полный баннер, не «голый» столб).
 */
const SPACE_KIT_BASENAMES = new Set([
  "balcony-rail-center.glb",
  "chair-cushion.glb",
  "computer-screen.glb",
  "computer-system.glb",
  "computer-wide.glb",
  "computer.glb",
  "container-flat-open.glb",
  "container-wide.glb",
  "container.glb",
  "display-wall-wide.glb",
  "display-wall.glb",
  "pipe-bend.glb",
  "pipe-end-colored.glb",
  "pipe-ring-colored.glb",
  "pipe.glb",
  "rail-narrow.glb",
  "rail.glb",
  "stairs-small-edges.glb",
  "table.glb",
  "wall-door-edge-banner.glb",
  "wall-door.glb",
  "structure-barrier-high.glb",
  "structure-barrier.glb",
  "structure-panel.glb",
  "structure.glb",
  "table-inset-small.glb",
  "wall-banner.glb",
  "wall-detail.glb",
  "wall-door-wide-banner.glb",
  "wall-pillar-banner.glb",
]);

export function resolveBuilderModelPath(partName: string): string {
  if (partName.includes("/")) return partName;
  const base = partName.includes("\\")
    ? partName.split("\\").pop()!
    : partName.split("/").pop()!;
  const dir = SPACE_KIT_BASENAMES.has(base) ? SPACE : BUILDING;
  return `${dir}/${base}`;
}
