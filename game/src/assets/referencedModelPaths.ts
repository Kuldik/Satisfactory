import { getBuildingPrefabModelPaths } from "../buildings/BuildingPrefabs.ts";
import { getAllRailroadModelPaths } from "../buildings/logistics/railroadKitModels.ts";
import { getAllRollingStockModelPaths } from "../train/trainRollingStockCatalog.ts";

export function getAllReferencedModelPaths(): string[] {
  return Array.from(
    new Set([
      ...getBuildingPrefabModelPaths(),
      ...getAllRailroadModelPaths(),
      ...getAllRollingStockModelPaths(),
      "/kits/models/train-station.glb",
    ]),
  ).sort((a, b) => a.localeCompare(b));
}
