// ============================================================
// Масштаб лент/стоек Kenney — как в ModelGallery (belts → 6 m по max стороне)
// ============================================================

import * as THREE from "three";
import {
  isConveyorBeltMenuId,
  isLogisticsConveyorKitPath,
} from "./conveyorKitModels.ts";

/** Совпадает с KIT_CATEGORY_MAX_SIZE['Conveyor Kit'].belts в ModelGallery */
export const CONVEYOR_BELT_MAX_EXTENT_M = 6;

/** Единый множитель для необработанного GLB: max(x,y,z) → targetMax. */
export function scaleToFitMaxExtent(
  root: THREE.Object3D,
  targetMax = CONVEYOR_BELT_MAX_EXTENT_M,
): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  return targetMax / maxDim;
}

export function usesConveyorGalleryFitScale(
  menuBuildingId?: string,
  partPath?: string,
): boolean {
  if (isConveyorBeltMenuId(menuBuildingId)) return true;
  if (menuBuildingId === "splitter") return true;
  if (partPath && isLogisticsConveyorKitPath(partPath)) return true;
  return false;
}
