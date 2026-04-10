// ============================================================
// BuildingPorts — per-building I/O port definitions.
// Ports are placed as visual connectors (wall-doorway models)
// and used for auto-snapping conveyor endpoints.
// ============================================================

const BUILDING_KIT_DIR = "/kits/kenney_building-kit/Models/GLB format/";
export const PORT_MODEL_INPUT = `${BUILDING_KIT_DIR}wall-doorway-square.glb`;
export const PORT_MODEL_OUTPUT = `${BUILDING_KIT_DIR}wall-doorway-round.glb`;

export interface BuildingPort {
  type: "input" | "output";
  /** Position relative to building pivot (before building rotation/scale). */
  localPos: { x: number; y: number; z: number };
  /** Outward-facing direction angle (radians around Y axis, 0 = +Z). */
  direction: number;
}

/**
 * Port definitions keyed by buildingId.
 * Coordinates are in the model's local space — they get transformed
 * by the building's world rotation and scale at placement time.
 * The user fills in exact coordinates per building as they tune layouts.
 */
export const BUILDING_PORTS: Record<string, BuildingPort[]> = {
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
    { type: "input", localPos: { x: -0.5, y: 0.15, z: 0 }, direction: Math.PI },
    { type: "output", localPos: { x: 0.5, y: 0.15, z: 0 }, direction: 0 },
  ],
};

export function getBuildingPorts(buildingId: string): BuildingPort[] | null {
  const ports = BUILDING_PORTS[buildingId];
  return ports && ports.length > 0 ? ports : null;
}
