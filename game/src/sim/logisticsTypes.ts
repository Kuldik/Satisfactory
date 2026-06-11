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
  start: BeltEndpointSnapshot;
  end: BeltEndpointSnapshot;
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
