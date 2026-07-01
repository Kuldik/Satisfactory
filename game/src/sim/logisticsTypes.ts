// ============================================================
// Типы снапшота логистики (конвейеры ↔ порты зданий).
// ============================================================

/** Мировая позиция порта здания. */
export interface BuildingPortSnapshot {
  compositeId: string;
  buildingId: string;
  portIndex: number;
  portId: string;
  kind: "conveyor" | "pipe";
  type: "input" | "output";
  x: number;
  y: number;
  z: number;
  direction: number;
}

/** Конец линии конвейера (вход/выход потока по ленте). */
export interface BeltEndpointSnapshot {
  compositeId: string;
  beltId: string;
  role: "start" | "end";
  x: number;
  y: number;
  z: number;
  /** Направление движения ленты от этого конца (к центру или от центра). */
  direction: number;
  speedPerMin: number;
  /** Длина линии (арк-длина полилинии по центрам + полшага, м). На обоих концах одинакова. */
  lengthM?: number;
}

export interface LogisticsSnapshot {
  ports: BuildingPortSnapshot[];
  belts: BeltEndpointSnapshot[];
}

/** Одна линия конвейера (может быть в цепочке). */
export interface BeltLineInfo {
  compositeId: string;
  beltId: string;
  speedPerMin: number;
  /** Арк-длина линии (м). */
  lengthM: number;
  start: BeltEndpointSnapshot;
  end: BeltEndpointSnapshot;
}

/** Один дискретный предмет на ленте-«полосе» для визуализации. */
export interface BeltItemVisual {
  /** Стабильный id — визуал держит один mesh на всё время жизни предмета. */
  id: number;
  itemId: string;
  /** Позиция вдоль полосы, нормированная [0..1] (0 = вход, 1 = выход). */
  pos01: number;
}

/** Полоса (цепочка лент) с дискретными предметами для визуализации. */
export interface BeltLaneVisual {
  laneKey: string;
  /** compositeId лент по порядку от источника к приёмнику; обратные секции помечены суффиксом. */
  memberCompositeIds: string[];
  /** Линейная скорость движения, м/с (для межкадровой интерполяции). */
  speedMps: number;
  items: BeltItemVisual[];
}

export const BELT_CHAIN_REVERSED_SUFFIX = "::rev";

export function beltChainMemberRef(
  compositeId: string,
  reversed: boolean,
): string {
  return reversed ? `${compositeId}${BELT_CHAIN_REVERSED_SUFFIX}` : compositeId;
}

export function parseBeltChainMemberRef(ref: string): {
  compositeId: string;
  reversed: boolean;
} {
  if (ref.endsWith(BELT_CHAIN_REVERSED_SUFFIX)) {
    return {
      compositeId: ref.slice(0, -BELT_CHAIN_REVERSED_SUFFIX.length),
      reversed: true,
    };
  }
  return { compositeId: ref, reversed: false };
}

/** Связь «выход здания → вход здания» через цепочку лент. */
export interface ConveyorSupplyLink {
  sourceCompositeId: string;
  sourcePortIndex: number;
  sinkCompositeId: string;
  sinkPortIndex: number;
  itemId: string;
  /** Минимальная скорость по цепочке лент, предм./мин. */
  beltSpeedPerMin: number;
  /** compositeId лент по порядку от источника к приёмнику. */
  beltChain: string[];
}

/**
 * Полоса потока: цепочка лент, начинающаяся от выхода здания. Приёмник
 * (`sink*`) может отсутствовать — предметы всё равно движутся и накапливаются
 * у конца ленты (backpressure). Это позволяет запускать движение по
 * недостроенной / собранной из нескольких частей ленте.
 */
export interface ConveyorFlowLane {
  sourceCompositeId: string;
  sourcePortIndex: number;
  /** Приёмник в конце цепочки, если он есть; иначе null (тупик). */
  sinkCompositeId: string | null;
  sinkPortIndex: number | null;
  itemId: string;
  /** Минимальная скорость по цепочке лент, предм./мин. */
  beltSpeedPerMin: number;
  /** compositeId лент по порядку от источника к концу цепочки. */
  beltChain: string[];
}
