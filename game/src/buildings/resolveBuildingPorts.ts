// ============================================================
// resolveBuildingPorts — единый источник портов для здания.
// JSON паттерн (ports[]) → legacy BuildingPorts.ts → пусто.
// ============================================================

import { getBuildingPattern, type PatternJson } from "./BuildingPatterns.ts";
import { LEGACY_BUILDING_PORTS } from "./BuildingPorts.ts";
import type { BuildingPortDefinition } from "./buildingPortTypes.ts";
import { getBuildingSimSpec } from "../sim/buildingCatalog.ts";

/** Порты из JSON файла паттерна (если ключ `ports` присутствует). */
export function portsFromPatternJson(
  data: PatternJson,
): BuildingPortDefinition[] | null {
  if (!Array.isArray(data.ports)) return null;
  return data.ports.map((p) => ({
    ...p,
    positionScale: 1,
  }));
}

export function resolveBuildingPortDefinitions(
  buildingId: string,
): BuildingPortDefinition[] {
  const pattern = getBuildingPattern(buildingId);
  if (pattern && pattern.ports !== undefined) {
    return pattern.ports.map((p) => ({ ...p, positionScale: 1 }));
  }

  const legacy = LEGACY_BUILDING_PORTS[buildingId];
  if (!legacy) return [];

  return legacy.map((p, i) => ({
    id: `${p.type}_${i}`,
    kind: "conveyor" as const,
    type: p.type,
    position: { ...p.localPos },
    direction: p.direction,
    positionScale: 1,
  }));
}

/** Масштаб legacy-портов для одиночных GLB-префабов. */
export function resolveBuildingPortDefinitionsForPrefab(
  buildingId: string,
  buildingScale: number,
): BuildingPortDefinition[] {
  const pattern = getBuildingPattern(buildingId);
  if (pattern && pattern.ports !== undefined) {
    return pattern.ports.map((p) => ({ ...p, positionScale: 1 }));
  }

  const legacy = LEGACY_BUILDING_PORTS[buildingId];
  if (!legacy) return [];

  return legacy.map((p, i) => ({
    id: `${p.type}_${i}`,
    kind: "conveyor" as const,
    type: p.type,
    position: { ...p.localPos },
    direction: p.direction,
    positionScale: buildingScale,
  }));
}

/** Индексы conveyor-output портов в resolveBuildingPortDefinitions. */
export function conveyorOutputPortIndices(buildingId: string): number[] {
  const defs = resolveBuildingPortDefinitions(buildingId);
  const indices: number[] = [];
  for (let i = 0; i < defs.length; i++) {
    const p = defs[i]!;
    if (p.type === "output" && p.kind === "conveyor") indices.push(i);
  }
  return indices;
}

/** К какому физическому порту привязан n-й выход spec.outputs. */
export function specOutputPortIndex(
  buildingId: string,
  outputIdx: number,
): number {
  const spec = getBuildingSimSpec(buildingId);
  const outputs = spec?.outputs ?? [];
  const portIndices = conveyorOutputPortIndices(buildingId);
  if (portIndices.length === 0) return outputIdx;
  if (portIndices.length >= outputs.length) {
    return portIndices[outputIdx] ?? portIndices[portIndices.length - 1]!;
  }
  return portIndices[0]!;
}

/** Какие itemId идут через данный conveyor-output порт (общий порт → все выходы). */
export function itemsForConveyorOutputPort(
  buildingId: string,
  portIndex: number,
): string[] {
  const spec = getBuildingSimSpec(buildingId);
  const outputs = spec?.outputs ?? [];
  if (outputs.length === 0) return [];
  const portIndices = conveyorOutputPortIndices(buildingId);
  if (portIndices.length === 0) return [];
  if (portIndices.indexOf(portIndex) < 0) return [];
  if (portIndices.length < outputs.length) {
    return portIndex === portIndices[0]!
      ? outputs.map((o) => o.itemId)
      : [];
  }
  const portPos = portIndices.indexOf(portIndex);
  const item = outputs[portPos]?.itemId;
  return item ? [item] : [];
}
