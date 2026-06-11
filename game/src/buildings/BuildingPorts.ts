// ============================================================
// BuildingPorts — LEGACY fallback для GLB-префабов без ports[] в JSON.
// Новые composite-здания: ports[] в JSON паттерна (см. buildingPortTypes.ts).
// ============================================================

export interface BuildingPort {
  type: "input" | "output";
  /** Position relative to building pivot (before building rotation/scale). */
  localPos: { x: number; y: number; z: number };
  /** Outward-facing direction angle (radians around Y axis, 0 = +Z). */
  direction: number;
}

/** @deprecated Используй resolveBuildingPortDefinitions(). Оставлено для GLB fallback. */
export const LEGACY_BUILDING_PORTS: Record<string, BuildingPort[]> = {
  // ---- Production ----
  constructor: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  assembler: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: -0.2 }, direction: Math.PI },
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0.2 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  manufacturer: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: -0.25 }, direction: Math.PI },
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0.25 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  packager: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  refinery: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  blender: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  particle_accelerator: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  converter: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  quantum_encoder: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  // ---- Smelting / processing (pattern-based buildings) ----
  smelter: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  foundry: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: -0.2 }, direction: Math.PI },
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0.2 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
  sawmill: [
    { type: "output", localPos: { x: 0.5, y: 0.15, z: -0.2 }, direction: 0 },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0.2 }, direction: 0 },
  ],
  biomass_burner: [
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
  ],
};

/** @deprecated */
export const BUILDING_PORTS = LEGACY_BUILDING_PORTS;

export function getBuildingPorts(buildingId: string): BuildingPort[] | null {
  const ports = LEGACY_BUILDING_PORTS[buildingId];
  return ports && ports.length > 0 ? ports : null;
}
