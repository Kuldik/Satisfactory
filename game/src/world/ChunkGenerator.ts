// ============================================================
// ChunkGenerator — procedural resource node placement
// ============================================================

import { CHUNK_SIZE } from '../core/constants.ts';
import { NodePurity, ResourceType } from '../core/types.ts';
import type { GridPosition } from '../core/types.ts';

/** Generated resource node */
export interface GeneratedNode {
  position: GridPosition;
  resourceType: ResourceType;
  purity: NodePurity;
}

/** Simple seeded PRNG (mulberry32) */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash chunk coordinates to a deterministic seed */
function chunkSeed(cx: number, cz: number, worldSeed: number): number {
  let h = worldSeed;
  h = (h ^ (cx * 374761393)) & 0xFFFFFFFF;
  h = (h ^ (cz * 668265263)) & 0xFFFFFFFF;
  h = Math.imul(h, 2654435769);
  h = (h ^ (h >>> 16)) & 0xFFFFFFFF;
  return h;
}

/** Resource generation weights */
const RESOURCE_WEIGHTS: { type: ResourceType; weight: number; minTier: number }[] = [
  { type: ResourceType.IronOre,      weight: 30, minTier: 0 },
  { type: ResourceType.CopperOre,    weight: 20, minTier: 0 },
  { type: ResourceType.Limestone,    weight: 20, minTier: 0 },
  { type: ResourceType.Coal,         weight: 15, minTier: 0 },
  { type: ResourceType.Sulfur,       weight: 8,  minTier: 0 },
  { type: ResourceType.CateriumOre,  weight: 6,  minTier: 0 },
  { type: ResourceType.RawQuartz,    weight: 5,  minTier: 0 },
  { type: ResourceType.SAM,          weight: 5,  minTier: 0 },
  { type: ResourceType.Bauxite,      weight: 4,  minTier: 0 },
  { type: ResourceType.Uranium,      weight: 2,  minTier: 0 },
  { type: ResourceType.CrudeOil,     weight: 6,  minTier: 0 },
  { type: ResourceType.Water,        weight: 10, minTier: 0 },
  { type: ResourceType.NitrogenGas,  weight: 3,  minTier: 0 },
];

/** Purity distribution */
const PURITY_WEIGHTS = [
  { purity: NodePurity.Impure, weight: 30 },
  { purity: NodePurity.Normal, weight: 50 },
  { purity: NodePurity.Pure,   weight: 20 },
];

export class ChunkGenerator {
  private worldSeed: number;
  private generatedChunks: Set<string> = new Set();

  constructor(worldSeed?: number) {
    this.worldSeed = worldSeed ?? Math.floor(Math.random() * 2147483647);
  }

  /** Get the world seed */
  getSeed(): number {
    return this.worldSeed;
  }

  /** Generate resource nodes for a chunk */
  generateChunk(cx: number, cz: number): GeneratedNode[] {
    const key = `${cx},${cz}`;
    if (this.generatedChunks.has(key)) return [];
    this.generatedChunks.add(key);

    const seed = chunkSeed(cx, cz, this.worldSeed);
    const rng = mulberry32(seed);

    const nodes: GeneratedNode[] = [];

    // Determine how many resource nodes in this chunk
    // Base chance: ~2 nodes per chunk, with some chunks having 0-4
    const nodeCount = Math.floor(rng() * 3); // 0-2 nodes per chunk

    // Center area (near spawn) has more iron/copper
    const distFromCenter = Math.sqrt(cx * cx + cz * cz);
    const isStartArea = distFromCenter < 3;

    // Guarantee iron in first chunk at origin
    if (cx === 0 && cz === 0) {
      nodes.push({
        position: { x: 5, y: 0, z: 5 },
        resourceType: ResourceType.IronOre,
        purity: NodePurity.Normal,
      });
      nodes.push({
        position: { x: 20, y: 0, z: 10 },
        resourceType: ResourceType.CopperOre,
        purity: NodePurity.Normal,
      });
      nodes.push({
        position: { x: 15, y: 0, z: 22 },
        resourceType: ResourceType.Limestone,
        purity: NodePurity.Normal,
      });
      return nodes;
    }

    for (let i = 0; i < nodeCount; i++) {
      // Random position within chunk
      const localX = Math.floor(rng() * (CHUNK_SIZE - 4)) + 2;
      const localZ = Math.floor(rng() * (CHUNK_SIZE - 4)) + 2;
      const worldX = cx * CHUNK_SIZE + localX;
      const worldZ = cz * CHUNK_SIZE + localZ;

      // Pick resource type
      let resourceType: ResourceType;
      if (isStartArea && rng() < 0.6) {
        // Start area biased toward basic resources
        const basics = [ResourceType.IronOre, ResourceType.CopperOre, ResourceType.Limestone];
        resourceType = basics[Math.floor(rng() * basics.length)];
      } else {
        resourceType = this.pickWeightedResource(rng);
      }

      // Pick purity
      const purity = this.pickWeightedPurity(rng);

      nodes.push({
        position: { x: worldX, y: 0, z: worldZ },
        resourceType,
        purity,
      });
    }

    return nodes;
  }

  /** Weighted random resource selection */
  private pickWeightedResource(rng: () => number): ResourceType {
    const totalWeight = RESOURCE_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
    let roll = rng() * totalWeight;

    for (const entry of RESOURCE_WEIGHTS) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }

    return ResourceType.IronOre; // fallback
  }

  /** Weighted random purity selection */
  private pickWeightedPurity(rng: () => number): NodePurity {
    const totalWeight = PURITY_WEIGHTS.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng() * totalWeight;

    for (const entry of PURITY_WEIGHTS) {
      roll -= entry.weight;
      if (roll <= 0) return entry.purity;
    }

    return NodePurity.Normal;
  }

  /** Check if a chunk has been generated */
  isGenerated(cx: number, cz: number): boolean {
    return this.generatedChunks.has(`${cx},${cz}`);
  }
}
