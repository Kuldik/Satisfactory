// ============================================================
// BuildingPatterns — registry mapping building IDs to their
// JSON pattern files. When a building from the Build Menu has
// a registered pattern, selecting it will place the entire
// composite structure as a single unit.
// ============================================================

import diggerlvl1 from "./miners/diggerlvl1.json";
import diggerlvl2 from "./miners/diggerlvl2.json";
import diggerlvl3 from "./miners/diggerlvl3.json";
import circleDetail from "../scenes/Detailing/circle.json";
import verticalPipeDetail from "../scenes/Detailing/vertical_pipe.json";
import extractor from "./waterSupply/extractor.json";
import oilExtractor from "./waterSupply/oil_extractor.json";
import pressureBooster from "./waterSupply/pressure_booster.json";
import wellExtractor from "./waterSupply/well_extractor.json";
import smelter from "./production/smelter.json";
import sawmill from "./production/sawmill.json";
import foundry from "./production/foundry.json";
import biomassBurner from "./power/biomass_burner.json";
import alienExtractor from "./power/alien_extractor.json";
import powerPoleMk1 from "./power/power_pole_mk1.json";
import powerPoleMk2 from "./power/power_pole_mk2.json";
import powerPoleMk3 from "./power/power_pole_mk3.json";
import powerTower from "./power/power_tower.json";
import type { PatternPort } from "./buildingPortTypes.ts";

export interface PatternPart {
  partName: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
  /** Из экспорта конструктора; при постановке из меню игнорируется (один compositeId на всю сборку). */
  compositeId?: string;
}

export interface PatternJson {
  parts: PatternPart[];
  /** Если ключ есть — единственный источник портов (даже пустой массив). */
  ports?: PatternPort[];
}

export interface BuildingPattern {
  buildingId: string;
  nameRu: string;
  parts: PatternPart[];
  /** undefined = legacy fallback; [] = явно без портов. */
  ports?: PatternPort[];
}

const raw: Record<string, PatternJson> = {
  miner_mk1: diggerlvl1 as PatternJson,
  miner_mk2: diggerlvl2 as PatternJson,
  miner_mk3: diggerlvl3 as PatternJson,
  detail_circle: circleDetail as PatternJson,
  detail_vertical_pipe: verticalPipeDetail as PatternJson,
  water_extractor: extractor as PatternJson,
  oil_extractor: oilExtractor as PatternJson,
  pressure_booster: pressureBooster as PatternJson,
  well_extractor: wellExtractor as PatternJson,
  smelter: smelter as PatternJson,
  sawmill: sawmill as PatternJson,
  foundry: foundry as PatternJson,
  biomass_burner: biomassBurner as PatternJson,
  alien_extractor: alienExtractor as PatternJson,
  power_pole_mk1: powerPoleMk1 as PatternJson,
  power_pole_mk2: powerPoleMk2 as PatternJson,
  power_pole_mk3: powerPoleMk3 as PatternJson,
  power_tower: powerTower as PatternJson,
};

const registry = new Map<string, BuildingPattern>();

for (const [id, data] of Object.entries(raw)) {
  registry.set(id, {
    buildingId: id,
    nameRu: id,
    parts: data.parts,
    ports: data.ports,
  });
}

export function getBuildingPattern(buildingId: string): BuildingPattern | null {
  return registry.get(buildingId) ?? null;
}

export function hasPattern(buildingId: string): boolean {
  return registry.has(buildingId);
}

export function getAllPatternIds(): string[] {
  return Array.from(registry.keys());
}
