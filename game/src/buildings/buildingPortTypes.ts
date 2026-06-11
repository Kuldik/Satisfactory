// ============================================================
// Единый формат портов зданий (JSON паттерны + GLB fallback).
// ============================================================

export type PortKind = "conveyor" | "pipe";
export type PortFlow = "input" | "output";

/** Порт в JSON паттерна / sidecar для GLB. */
export interface PatternPort {
  id: string;
  kind: PortKind;
  type: PortFlow;
  position: { x: number; y: number; z: number };
  /** Направление «наружу», радианы вокруг Y (0 = +Z). */
  direction: number;
  /** @deprecated Универсальный pipe-порт; tier задаётся типом трубы в логистике, не портом. */
  pipeTier?: 1 | 2;
}

/** Разрешённый порт для runtime (sim + snap). */
export interface BuildingPortDefinition extends PatternPort {
  /**
   * Для legacy GLB из BuildingPorts.ts: position умножается на scale здания.
   * JSON-паттерны: 1 (координаты как у parts).
   */
  positionScale: number;
}

export interface PortPlacementTemplate {
  kind: PortKind;
  type: PortFlow;
  pipeTier?: 1 | 2;
}

/** Черновик порта в admin-конструкторе (мировые координаты). */
export interface BuilderPortDraft {
  id: string;
  kind: PortKind;
  type: PortFlow;
  x: number;
  y: number;
  z: number;
  direction: number;
  pipeTier?: 1 | 2;
}

export function defaultPortId(
  kind: PortKind,
  type: PortFlow,
  existing: readonly { id: string }[],
): string {
  const base = `${kind}_${type}`;
  let n = 1;
  while (existing.some((p) => p.id === `${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function transformPortToWorld(
  def: Pick<BuildingPortDefinition, "position" | "direction" | "positionScale">,
  anchor: { x: number; y: number; z: number },
  buildingRotY: number,
): { x: number; y: number; z: number; direction: number } {
  const s = def.positionScale;
  const lx = def.position.x * s;
  const ly = def.position.y * s;
  const lz = def.position.z * s;
  const cosR = Math.cos(buildingRotY);
  const sinR = Math.sin(buildingRotY);
  return {
    x: anchor.x + lx * cosR - lz * sinR,
    y: anchor.y + ly,
    z: anchor.z + lx * sinR + lz * cosR,
    direction: def.direction + buildingRotY,
  };
}
