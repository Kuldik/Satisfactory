// ============================================================
// BuildingPatterns — registry mapping building IDs to their
// JSON pattern files. When a building from the Build Menu has
// a registered pattern, selecting it will place the entire
// composite structure as a single unit.
// ============================================================

import diggerlvl1 from './diggerlvl1.json';

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
  'miner_mk1': diggerlvl1 as { parts: PatternPart[] },
  // Add more patterns here as they are created:
  // 'miner_mk2': diggerlvl2,
  // 'constructor': constructorPattern,
  // 'smelter': smelterPattern,
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
