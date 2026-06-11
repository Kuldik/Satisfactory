// ============================================================
// Полилиния ленты по сегментам builderPlaced (для позиционирования предметов).
// ============================================================

export interface BeltSegmentSnapshot {
  x: number;
  y: number;
  z: number;
  rotY: number;
  segmentStep?: number;
  /** Верхняя поверхность ленты (world Y). Если нет — y + fallback. */
  surfaceY?: number;
}

export interface BeltPathPoint {
  x: number;
  y: number;
  z: number;
}

export interface BeltPath {
  compositeId: string;
  points: BeltPathPoint[];
  /** Длина от начала до points[i], points.length === cumulative.length. */
  cumulative: number[];
  totalLength: number;
}

export interface BeltPathSample {
  x: number;
  y: number;
  z: number;
  /** Направление движения (rotationY). */
  direction: number;
}

function dist(a: BeltPathPoint, b: BeltPathPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function segmentSurfaceY(
  seg: BeltSegmentSnapshot,
  fallbackAbovePivot = 1.05,
): number {
  return seg.surfaceY ?? seg.y + fallbackAbovePivot;
}

/** Центры сегментов + вход/выход за полшага (как в getLogisticsSnapshot). */
export function buildBeltPathFromSegments(
  compositeId: string,
  segments: BeltSegmentSnapshot[],
  defaultStep = 4,
): BeltPath | null {
  if (segments.length === 0) return null;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const step = first.segmentStep ?? defaultStep;
  const y0 = segmentSurfaceY(first);
  const yN = segmentSurfaceY(last);

  const points: BeltPathPoint[] = [
    {
      x: first.x - Math.sin(first.rotY) * step,
      y: y0,
      z: first.z - Math.cos(first.rotY) * step,
    },
  ];
  for (const s of segments) {
    points.push({ x: s.x, y: segmentSurfaceY(s), z: s.z });
  }
  points.push({
    x: last.x + Math.sin(last.rotY) * step,
    y: yN,
    z: last.z + Math.cos(last.rotY) * step,
  });

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1]! + dist(points[i - 1]!, points[i]!));
  }

  return {
    compositeId,
    points,
    cumulative,
    totalLength: cumulative[cumulative.length - 1] ?? 0,
  };
}

/** Склеить несколько линий ленты в один путь (цепочка compositeId). */
export function mergeBeltPaths(paths: BeltPath[]): BeltPath | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) return paths[0]!;

  const points: BeltPathPoint[] = [...paths[0]!.points];
  const cumulative: number[] = [...paths[0]!.cumulative];

  for (let pi = 1; pi < paths.length; pi++) {
    const path = paths[pi]!;
    for (let i = 1; i < path.points.length; i++) {
      const prev = points[points.length - 1]!;
      const next = path.points[i]!;
      points.push(next);
      cumulative.push(cumulative[cumulative.length - 1]! + dist(prev, next));
    }
  }

  return {
    compositeId: paths.map((p) => p.compositeId).join("|"),
    points,
    cumulative,
    totalLength: cumulative[cumulative.length - 1] ?? 0,
  };
}

/** Упорядочить сегменты линии по связности (прямая, L, restore из JSON). */
export function orderBeltSegmentsByConnectivity(
  segments: BeltSegmentSnapshot[],
  defaultStep = 4,
): BeltSegmentSnapshot[] {
  if (segments.length <= 1) return segments;

  const step = segments[0]?.segmentStep ?? defaultStep;
  const linkDist = step * 1.25;

  const distXZ = (a: BeltSegmentSnapshot, b: BeltSegmentSnapshot) =>
    Math.hypot(a.x - b.x, a.z - b.z);

  const neighbors: number[][] = segments.map(() => []);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (distXZ(segments[i]!, segments[j]!) <= linkDist) {
        neighbors[i]!.push(j);
        neighbors[j]!.push(i);
      }
    }
  }

  let startIdx = neighbors.findIndex((n) => n.length === 1);
  if (startIdx < 0) {
    let best = -1;
    let bestI = 0;
    let bestJ = 1;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const d = distXZ(segments[i]!, segments[j]!);
        if (d > best) {
          best = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    startIdx = bestI;
    if (neighbors[startIdx]!.length === 0 && neighbors[bestJ]!.length > 0) {
      startIdx = bestJ;
    }
  }

  const ordered: BeltSegmentSnapshot[] = [];
  const visited = new Set<number>();
  let cur = startIdx;
  let prev = -1;
  while (cur >= 0 && !visited.has(cur)) {
    visited.add(cur);
    ordered.push(segments[cur]!);
    const next = neighbors[cur]!.find((n) => n !== prev && !visited.has(n));
    prev = cur;
    cur = next ?? -1;
  }
  for (let i = 0; i < segments.length; i++) {
    if (!visited.has(i)) ordered.push(segments[i]!);
  }
  return ordered;
}

/** @deprecated Используйте orderBeltSegmentsByConnectivity. */
export function sortBeltSegmentsAlongFlow(
  segments: BeltSegmentSnapshot[],
  defaultStep = 4,
): BeltSegmentSnapshot[] {
  if (segments.length <= 1) return segments;
  const first = segments[0]!;
  const step = first.segmentStep ?? defaultStep;
  const dirX = Math.sin(first.rotY);
  const dirZ = Math.cos(first.rotY);
  const ox = first.x - dirX * step;
  const oz = first.z - dirZ * step;
  return [...segments].sort((a, b) => {
    const pa = (a.x - ox) * dirX + (a.z - oz) * dirZ;
    const pb = (b.x - ox) * dirX + (b.z - oz) * dirZ;
    return pa - pb;
  });
}

/** Точка на пути по дистанции от «входа» ленты (метры). */
export function sampleBeltPath(path: BeltPath, distance: number): BeltPathSample {
  const total = path.totalLength;
  if (total <= 1e-6 || path.points.length < 2) {
    const p = path.points[0] ?? { x: 0, y: 0, z: 0 };
    return { x: p.x, y: p.y, z: p.z, direction: 0 };
  }

  let d = distance % total;
  if (d < 0) d += total;

  for (let i = 1; i < path.points.length; i++) {
    const segLen = path.cumulative[i]! - path.cumulative[i - 1]!;
    if (d > segLen + 1e-6) {
      d -= segLen;
      continue;
    }
    const a = path.points[i - 1]!;
    const b = path.points[i]!;
    const t = segLen > 1e-6 ? d / segLen : 0;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return {
      x: a.x + dx * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + dz * t,
      direction: Math.atan2(dx, dz),
    };
  }

  const last = path.points[path.points.length - 1]!;
  const prev = path.points[path.points.length - 2]!;
  return {
    x: last.x,
    y: last.y,
    z: last.z,
    direction: Math.atan2(last.x - prev.x, last.z - prev.z),
  };
}
