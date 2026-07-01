// ============================================================
// Граф конвейеров: порты зданий ↔ цепочки лент (тестовая фаза).
// ============================================================

import { CONVEYOR_SPEEDS, ConveyorTier } from "../core/types.ts";
import { itemsForConveyorOutputPort } from "../buildings/resolveBuildingPorts.ts";
import type {
  BeltEndpointSnapshot,
  BeltLineInfo,
  BuildingPortSnapshot,
  ConveyorFlowLane,
  ConveyorSupplyLink,
  LogisticsSnapshot,
} from "./logisticsTypes.ts";
import { beltChainMemberRef } from "./logisticsTypes.ts";

/** Радиус стыковки порта/конца ленты (м). Согласован с снапом билдера (~step×1.5–3). */
export const LOGISTICS_SNAP_RADIUS = 4;

const EPS = 1e-4;

function distXZ(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function beltSpeedFromMenuId(beltId: string): number {
  const m = /^conveyor_mk(\d)$/.exec(beltId);
  if (!m) return CONVEYOR_SPEEDS[ConveyorTier.Mk1];
  const tier = Number(m[1]) as ConveyorTier;
  return CONVEYOR_SPEEDS[tier] ?? CONVEYOR_SPEEDS[ConveyorTier.Mk1];
}

/** Собрать пары start/end для каждой линии конвейера. */
export function collectBeltLines(snapshot: LogisticsSnapshot): BeltLineInfo[] {
  const byComposite = new Map<string, BeltEndpointSnapshot[]>();
  for (const ep of snapshot.belts) {
    const list = byComposite.get(ep.compositeId) ?? [];
    list.push(ep);
    byComposite.set(ep.compositeId, list);
  }

  const lines: BeltLineInfo[] = [];
  for (const [compositeId, endpoints] of byComposite) {
    const start = endpoints.find((e) => e.role === "start");
    const end = endpoints.find((e) => e.role === "end");
    if (!start || !end) continue;
    lines.push({
      compositeId,
      beltId: start.beltId,
      speedPerMin: start.speedPerMin,
      lengthM: start.lengthM ?? end.lengthM ?? 0,
      start,
      end,
    });
  }
  return lines;
}

type GraphNode =
  | { kind: "port"; port: BuildingPortSnapshot }
  | { kind: "belt-start"; line: BeltLineInfo }
  | { kind: "belt-end"; line: BeltLineInfo };

function nodePos(node: GraphNode): { x: number; y: number; z: number } {
  if (node.kind === "port") return node.port;
  if (node.kind === "belt-start") return node.line.start;
  return node.line.end;
}

/** Соседи в направлении потока (от источника к приёмнику). */
function flowNeighbors(
  node: GraphNode,
  lines: BeltLineInfo[],
  ports: BuildingPortSnapshot[],
): GraphNode[] {
  const pos = nodePos(node);
  const out: GraphNode[] = [];

  if (node.kind === "port" && node.port.type === "output") {
    for (const line of lines) {
      if (distXZ(pos, line.start) <= LOGISTICS_SNAP_RADIUS) {
        out.push({ kind: "belt-start", line });
      }
    }
  }

  if (node.kind === "belt-start") {
    out.push({ kind: "belt-end", line: node.line });
  }

  if (node.kind === "belt-end") {
    for (const line of lines) {
      if (line.compositeId === node.line.compositeId) continue;
      if (distXZ(pos, line.start) <= LOGISTICS_SNAP_RADIUS) {
        out.push({ kind: "belt-start", line });
      }
    }
    for (const port of ports) {
      if (port.type !== "input") continue;
      if (distXZ(pos, port) <= LOGISTICS_SNAP_RADIUS) {
        out.push({ kind: "port", port });
      }
    }
  }

  return out;
}

/** Найти все цепочки «выход → … ленты … → вход» для одного itemId. */
function findSupplyLinksForItem(
  port: BuildingPortSnapshot,
  itemId: string,
  lines: BeltLineInfo[],
  ports: BuildingPortSnapshot[],
): ConveyorSupplyLink[] {
  const links: ConveyorSupplyLink[] = [];
  const startNode: GraphNode = { kind: "port", port };
  const queue: Array<{
    node: GraphNode;
    beltChain: string[];
    minSpeed: number;
    visitedLines: Set<string>;
  }> = [
    {
      node: startNode,
      beltChain: [],
      minSpeed: Infinity,
      visitedLines: new Set(),
    },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of flowNeighbors(cur.node, lines, ports)) {
      if (next.kind === "belt-start") {
        if (cur.visitedLines.has(next.line.compositeId)) continue;
        const nextVisited = new Set(cur.visitedLines);
        nextVisited.add(next.line.compositeId);
        queue.push({
          node: next,
          beltChain: [...cur.beltChain, next.line.compositeId],
          minSpeed: Math.min(cur.minSpeed, next.line.speedPerMin),
          visitedLines: nextVisited,
        });
      } else if (next.kind === "belt-end") {
        queue.push({
          node: next,
          beltChain: cur.beltChain,
          minSpeed: cur.minSpeed,
          visitedLines: cur.visitedLines,
        });
      } else if (next.kind === "port" && next.port.type === "input") {
        if (cur.beltChain.length === 0) continue;
        links.push({
          sourceCompositeId: port.compositeId,
          sourcePortIndex: port.portIndex,
          sinkCompositeId: next.port.compositeId,
          sinkPortIndex: next.port.portIndex,
          itemId,
          beltSpeedPerMin:
            Number.isFinite(cur.minSpeed) && cur.minSpeed > EPS
              ? cur.minSpeed
              : beltSpeedFromMenuId("conveyor_mk1"),
          beltChain: cur.beltChain,
        });
      }
    }
  }

  return links;
}

/** Найти все цепочки «выход → … ленты … → вход». */
export function buildConveyorSupplyLinks(
  snapshot: LogisticsSnapshot,
): ConveyorSupplyLink[] {
  const lines = collectBeltLines(snapshot);
  const links: ConveyorSupplyLink[] = [];

  for (const port of snapshot.ports) {
    if (port.type !== "output") continue;
    const itemIds = itemsForConveyorOutputPort(
      port.buildingId,
      port.portIndex,
    );
    for (const itemId of itemIds) {
      links.push(
        ...findSupplyLinksForItem(port, itemId, lines, snapshot.ports),
      );
    }
  }

  return links;
}

/** Построить полосы потока от выхода `port` по itemId (тупик или приёмник). */
function findFlowLanesForItem(
  port: BuildingPortSnapshot,
  itemId: string,
  lines: BeltLineInfo[],
  ports: BuildingPortSnapshot[],
): ConveyorFlowLane[] {
  const lanes: ConveyorFlowLane[] = [];
  const mk1 = beltSpeedFromMenuId("conveyor_mk1");

  type Frame = {
    line: BeltLineInfo;
    reversed: boolean;
    beltChain: string[];
    minSpeed: number;
    visited: Set<string>;
  };

  const directedEnd = (line: BeltLineInfo, reversed: boolean) =>
    reversed ? line.start : line.end;

  const stack: Frame[] = [];
  for (const line of lines) {
    const toStart = distXZ(port, line.start);
    const toEnd = distXZ(port, line.end);
    const best = Math.min(toStart, toEnd);
    if (best <= LOGISTICS_SNAP_RADIUS) {
      const reversed = toEnd < toStart;
      stack.push({
        line,
        reversed,
        beltChain: [beltChainMemberRef(line.compositeId, reversed)],
        minSpeed: line.speedPerMin,
        visited: new Set([line.compositeId]),
      });
    }
  }

  const emit = (
    f: Frame,
    sink: BuildingPortSnapshot | null,
  ): void => {
    lanes.push({
      sourceCompositeId: port.compositeId,
      sourcePortIndex: port.portIndex,
      sinkCompositeId: sink?.compositeId ?? null,
      sinkPortIndex: sink?.portIndex ?? null,
      itemId,
      beltSpeedPerMin:
        Number.isFinite(f.minSpeed) && f.minSpeed > EPS ? f.minSpeed : mk1,
      beltChain: f.beltChain,
    });
  };

  while (stack.length > 0) {
    const f = stack.pop()!;
    const end = directedEnd(f.line, f.reversed);

    let sink: BuildingPortSnapshot | null = null;
    for (const p of ports) {
      if (p.type !== "input" || p.kind !== "conveyor") continue;
      if (distXZ(end, p) <= LOGISTICS_SNAP_RADIUS) {
        sink = p;
        break;
      }
    }
    if (sink) {
      emit(f, sink);
      continue;
    }

    let pushed = 0;
    for (const n of lines) {
      if (n.compositeId === f.line.compositeId || f.visited.has(n.compositeId)) {
        continue;
      }
      const toStart = distXZ(end, n.start);
      const toEnd = distXZ(end, n.end);
      const best = Math.min(toStart, toEnd);
      if (best > LOGISTICS_SNAP_RADIUS) continue;
      const reversed = toEnd < toStart;
      const visited = new Set(f.visited);
      visited.add(n.compositeId);
      stack.push({
        line: n,
        reversed,
        beltChain: [
          ...f.beltChain,
          beltChainMemberRef(n.compositeId, reversed),
        ],
        minSpeed: Math.min(f.minSpeed, n.speedPerMin),
        visited,
      });
      pushed++;
    }
    if (pushed === 0) {
      emit(f, null);
    }
  }

  return lanes;
}

/**
 * Полосы потока для всех выходов: предметы движутся, даже если цепочка ещё
 * не доведена до приёмника (или собрана из нескольких лент).
 */
export function buildConveyorFlowLanes(
  snapshot: LogisticsSnapshot,
): ConveyorFlowLane[] {
  const lines = collectBeltLines(snapshot);
  const lanes: ConveyorFlowLane[] = [];
  for (const port of snapshot.ports) {
    if (port.type !== "output" || port.kind !== "conveyor") continue;
    const itemIds = itemsForConveyorOutputPort(port.buildingId, port.portIndex);
    for (const itemId of itemIds) {
      lanes.push(...findFlowLanesForItem(port, itemId, lines, snapshot.ports));
    }
  }
  return lanes;
}

export function summarizeLogistics(snapshot: LogisticsSnapshot): {
  portCount: number;
  beltLineCount: number;
  linkCount: number;
} {
  return {
    portCount: snapshot.ports.length,
    beltLineCount: collectBeltLines(snapshot).length,
    linkCount: buildConveyorFlowLanes(snapshot).filter((l) => l.sinkCompositeId)
      .length,
  };
}
