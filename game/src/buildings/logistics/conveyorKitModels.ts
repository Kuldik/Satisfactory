// ============================================================
// Kenney Conveyor Kit — имена GLB для горизонтальных лент.
// Превью: kits/Conveyor Kit/Overview.html
// ============================================================

export const CONVEYOR_KIT_GLB_DIR = "/kits/Conveyor Kit/Models/GLB format/";

export function isConveyorBeltMenuId(id: string | null | undefined): boolean {
  return !!id && /^conveyor_mk[1-6]$/.test(id);
}

/** Меню строительства: логистика (демонтаж — короткое удержание). */
export const LOGISTICS_MENU_BUILDING_IDS = new Set<string>([
  "conveyor_mk1",
  "conveyor_mk2",
  "conveyor_mk3",
  "conveyor_mk4",
  "conveyor_mk5",
  "conveyor_mk6",
  "splitter",
  "merger",
  "throughput_monitor",
  "pipe_mk1",
  "pipe_mk2",
  "pipe_junction",
  "railroad_track",
  "train_station",
  "locomotive",
  "freight_car",
  "fluid_freight_car",
]);

export function isLogisticsMenuBuildingId(
  id: string | null | undefined,
): boolean {
  return !!id && LOGISTICS_MENU_BUILDING_IDS.has(id);
}

export function isLogisticsConveyorKitPath(partPath: string): boolean {
  return (
    partPath.includes("/Conveyor Kit/") ||
    partPath.includes("\\Conveyor Kit\\") ||
    partPath.includes("/kits/models/splitter.glb") ||
    partPath.includes("/kits/models/connector.glb")
  );
}

/** Номер тира ленты (1..6) из menu id, либо null. */
export function conveyorTierNumber(
  id: string | null | undefined,
): number | null {
  const m = id ? /^conveyor_mk([1-6])$/.exec(id) : null;
  return m ? Number(m[1]) : null;
}

/** Масштаб предметов на ленте: mk1 — 1×, начиная с mk2 — 2×. */
export function beltItemSizeScale(id: string | null | undefined): number {
  const tier = conveyorTierNumber(id);
  return tier !== null && tier >= 2 ? 2 : 1;
}

/**
 * Доля высоты bbox ленты до несущей поверхности (0..1). У mk5/mk6 высокие
 * борта/ограждение, поэтому верх bbox лежит выше настила — опускаем предметы.
 */
export function beltSurfaceHeightFraction(
  id: string | null | undefined,
): number {
  const tier = conveyorTierNumber(id);
  if (tier === 6) return 0.6;
  if (tier === 5) return 0.92;
  return 1;
}

/** Назначенные модели по уровням (имена файлов в GLB format) */
export const CONVEYOR_TIER_GLBS = {
  conveyor_mk1: "conveyor-long-sides.glb",
  conveyor_mk2: "conveyor-bars-stripe.glb",
  conveyor_mk3: "conveyor-bars-sides.glb",
  conveyor_mk4: "conveyor-bars-stripe-side.glb",
  conveyor_mk5: "conveyor-bars-stripe-high.glb",
  conveyor_mk6: "conveyor-bars-stripe-fence.glb",
} as const;

/** Короткий сегмент (один «тайл»), плоская лента / ролики */
export const CONVEYOR_BELT_SHORT_SEGMENT_GLBS = [
  "conveyor.glb",
  "conveyor-bars.glb",
  "conveyor-bars-fence.glb",
  "conveyor-bars-high.glb",
  "conveyor-bars-sides.glb",
  "conveyor-bars-stripe.glb",
  "conveyor-bars-stripe-fence.glb",
  "conveyor-bars-stripe-high.glb",
  "conveyor-bars-stripe-side.glb",
  "conveyor-sides.glb",
  "conveyor-stripe.glb",
  "conveyor-stripe-sides.glb",
] as const;

/** Удлинённые сегменты */
export const CONVEYOR_BELT_LONG_SEGMENT_GLBS = [
  "conveyor-long.glb",
  "conveyor-long-sides.glb",
  "conveyor-long-stripe.glb",
  "conveyor-long-stripe-sides.glb",
] as const;

/** Все варианты именно «ленты» (без cover/door/structure и т.д.) */
export const CONVEYOR_BELT_ALL_GLBS = [
  ...CONVEYOR_BELT_SHORT_SEGMENT_GLBS,
  ...CONVEYOR_BELT_LONG_SEGMENT_GLBS,
] as const;
