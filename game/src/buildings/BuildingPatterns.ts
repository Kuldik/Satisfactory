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
import extractor from "./waterSupply/extractor.json";

export interface PatternPart {
  partName: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
}

export interface BuildingPattern {
  buildingId: string;
  nameRu: string;
  parts: PatternPart[];
}

const raw: Record<string, { parts: PatternPart[] }> = {
  miner_mk1: diggerlvl1 as { parts: PatternPart[] },
  miner_mk2: diggerlvl2 as { parts: PatternPart[] },
  miner_mk3: diggerlvl3 as { parts: PatternPart[] },
  detail_circle: circleDetail as { parts: PatternPart[] },
  water_extractor: extractor as { parts: PatternPart[] },
};

const registry = new Map<string, BuildingPattern>();

for (const [id, data] of Object.entries(raw)) {
  registry.set(id, {
    buildingId: id,
    nameRu: id,
    parts: data.parts,
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
