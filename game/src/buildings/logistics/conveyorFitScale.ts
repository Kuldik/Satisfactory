// ============================================================
// Масштаб лент/стоек Kenney — как в ModelGallery (belts → 6 m по max стороне)
// ============================================================

import * as THREE from "three";
import {
  isConveyorBeltMenuId,
  isLogisticsConveyorKitPath,
} from "./conveyorKitModels.ts";
import {
  isRailroadModelPath,
  RAILROAD_CORNER_ENTRY_LEG_UNITS,
  RAILROAD_CORNER_EXIT_LEG_UNITS,
  RAILROAD_CORNER_INNER_OFFSET_UNITS,
  RAILROAD_STRAIGHT_LENGTH_UNITS,
} from "./railroadKitModels.ts";
import { isRollingStockModelPath } from "../../train/trainRollingStockCatalog.ts";

/** Совпадает с KIT_CATEGORY_MAX_SIZE['Conveyor Kit'].belts в ModelGallery */
export const CONVEYOR_BELT_MAX_EXTENT_M = 6;

/**
 * Train Kit scale targets in world meters. Rails are sized to the 2 m grid,
 * while rolling stock and stations are scaled as gameplay buildings, not toys.
 */
/** Shared Train Kit forward length — rails and rolling stock use the same scale. */
export const RAILROAD_STRAIGHT_WORLD_LENGTH_M = 28;
export const ROLLING_STOCK_WORLD_LENGTH_M = 28;
export const TRAIN_STATION_MAX_EXTENT_M = 24;

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

/** Fit a Train Kit model by its local Z length, the kit's forward axis. */
export function scaleToFitLengthZ(
  root: THREE.Object3D,
  targetLength: number,
): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return targetLength / Math.max(size.z, 1e-6);
}

export function resolveTrainKitUniformScale(): number {
  return RAILROAD_STRAIGHT_WORLD_LENGTH_M / RAILROAD_STRAIGHT_LENGTH_UNITS;
}

/** Длины плеч corner-large в world meters (из OBJ + uniform scale). */
export function resolveRailroadCornerLegLengthsWorld(): {
  entryLeg: number;
  exitLeg: number;
  innerOffset: { x: number; z: number };
} {
  const uniform = resolveTrainKitUniformScale();
  return {
    entryLeg: RAILROAD_CORNER_ENTRY_LEG_UNITS * uniform,
    exitLeg: RAILROAD_CORNER_EXIT_LEG_UNITS * uniform,
    innerOffset: {
      x: RAILROAD_CORNER_INNER_OFFSET_UNITS.x * uniform,
      z: RAILROAD_CORNER_INNER_OFFSET_UNITS.z * uniform,
    },
  };
}

export function measureScaledTrainMetrics(
  root: THREE.Object3D,
  scale = 1,
): { lengthZ: number; widthX: number; heightY: number } {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return {
    lengthZ: Math.max(size.z * scale, 0.1),
    widthX: Math.max(size.x * scale, 0.1),
    heightY: Math.max(size.y * scale, 0.1),
  };
}

export function usesConveyorGalleryFitScale(
  menuBuildingId?: string,
  partPath?: string,
): boolean {
  if (isConveyorBeltMenuId(menuBuildingId)) return true;
  if (menuBuildingId === "splitter" || menuBuildingId === "merger") return true;
  if (partPath && isLogisticsConveyorKitPath(partPath)) return true;
  return false;
}

export function usesTrainGalleryFitScale(
  menuBuildingId?: string,
  partPath?: string,
): boolean {
  if (
    menuBuildingId === "locomotive" ||
    menuBuildingId === "freight_car" ||
    menuBuildingId === "fluid_freight_car" ||
    menuBuildingId === "railroad_track" ||
    menuBuildingId === "train_station"
  ) {
    return true;
  }
  if (partPath && isRailroadModelPath(partPath)) return true;
  if (partPath && isRollingStockModelPath(partPath)) return true;
  return false;
}

export function resolvePrefabFitScale(
  root: THREE.Object3D,
  menuBuildingId?: string,
  partPath?: string,
  prefabScale = 1,
): number {
  if (usesConveyorGalleryFitScale(menuBuildingId, partPath)) {
    return scaleToFitMaxExtent(root, CONVEYOR_BELT_MAX_EXTENT_M);
  }
  if (usesTrainGalleryFitScale(menuBuildingId, partPath)) {
    if (menuBuildingId === "train_station") {
      return scaleToFitMaxExtent(root, TRAIN_STATION_MAX_EXTENT_M);
    }
    if (
      partPath &&
      (isRailroadModelPath(partPath) || isRollingStockModelPath(partPath))
    ) {
      return resolveTrainKitUniformScale();
    }
    return scaleToFitLengthZ(root, ROLLING_STOCK_WORLD_LENGTH_M);
  }
  return prefabScale;
}
