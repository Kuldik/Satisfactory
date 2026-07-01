// ============================================================
// SimulationManager — связывает игровой мир с тиком движка.
//
// Фаза 2 (тест): лесопилка → лента → сжигатель биомассы через граф
// конвейеров. Остальные здания — по-прежнему через глобальный склад.
// ============================================================

import type { SimulationSummary, ItemStack } from "../core/types.ts";
import {
  resolveBuildingPortDefinitions,
  specOutputPortIndex,
} from "../buildings/resolveBuildingPorts.ts";
import {
  getBuildingSimSpec,
  isSimulatedBuilding,
  type BuildingSimSpec,
} from "./buildingCatalog.ts";
import {
  buildConveyorFlowLanes,
  collectBeltLines,
  summarizeLogistics,
} from "./conveyorGraph.ts";
import type {
  BeltLaneVisual,
  ConveyorFlowLane,
  LogisticsSnapshot,
} from "./logisticsTypes.ts";
import { parseBeltChainMemberRef } from "./logisticsTypes.ts";
import { BELT_ITEM_SPACING_M } from "../core/constants.ts";

/** Минимальное описание логического здания из визуального мира. */
export interface PlacedBuildingSnapshot {
  compositeId: string;
  buildingId: string;
  x: number;
  y: number;
  z: number;
}

interface SimEntity {
  compositeId: string;
  buildingId: string;
  spec: BuildingSimSpec;
  active: boolean;
  currentPowerMW: number;
  effectiveGenerationMW: number;
}

/** Один дискретный предмет на полосе: стабильный id + позиция вдоль полосы (м). */
interface BeltLaneItem {
  id: number;
  itemId: string;
  /** Позиция от входа полосы (0) к приёмнику (lengthM), метры. */
  pos: number;
}

/** Полоса = одна цепочка лент (supply-link). Хранит дискретные предметы по позиции. */
interface BeltLane {
  key: string;
  /** compositeId лент по порядку от источника к приёмнику. */
  memberIds: string[];
  /** Приёмник в конце цепочки, если он подключён; иначе null (тупик). */
  sinkCompositeId: string | null;
  /** Полная длина полосы (сумма арк-длин лент), м. */
  lengthM: number;
  /** Пропускная способность ленты, предм./мин (по тиру). */
  speedPerMin: number;
  /** Линейная скорость движения, м/с. */
  speedMps: number;
  /** Предметы, отсортированы по возрастанию pos (items[0] — только что вошёл). */
  items: BeltLaneItem[];
  /** Накопитель дробных единиц на вход по itemId. */
  emitAccum: Map<string, number>;
}

const SIM_SAVE_VERSION = 1;
const SUMMARY_TOP_ITEMS = 16;
const EPSILON = 1e-6;

const EMPTY_LOGISTICS: LogisticsSnapshot = { ports: [], belts: [] };

export class SimulationManager {
  private readonly entities = new Map<string, SimEntity>();
  private readonly inventory = new Map<string, number>();
  /** ключ цепочки (beltChain.join("|")) → полоса с дискретными предметами. */
  private readonly lanes = new Map<string, BeltLane>();
  /** compositeId здания → itemId → кол-во у входных портов с ленты. */
  private readonly buildingInputs = new Map<string, Map<string, number>>();

  private flowLanes: ConveyorFlowLane[] = [];
  private nextItemId = 1;
  private gameTime = 0;
  private generationMW = 0;
  private consumptionMW = 0;
  private blackout = false;

  update(
    dt: number,
    snapshot: PlacedBuildingSnapshot[],
    logistics: LogisticsSnapshot = EMPTY_LOGISTICS,
  ): void {
    this.gameTime += dt;
    this.syncWorld(snapshot);
    this.syncLogistics(logistics);
    this.runProduction(dt);
    this.runBeltFlow(dt);
    this.runFuelGenerators(dt);
    this.computePower();
  }

  private syncWorld(snapshot: PlacedBuildingSnapshot[]): void {
    const present = new Set<string>();
    for (const b of snapshot) {
      if (!isSimulatedBuilding(b.buildingId)) continue;
      present.add(b.compositeId);
      if (!this.entities.has(b.compositeId)) {
        const spec = getBuildingSimSpec(b.buildingId);
        if (!spec) continue;
        this.entities.set(b.compositeId, {
          compositeId: b.compositeId,
          buildingId: b.buildingId,
          spec,
          active: false,
          currentPowerMW: 0,
          effectiveGenerationMW: 0,
        });
      }
    }
    for (const compositeId of this.entities.keys()) {
      if (!present.has(compositeId)) {
        this.entities.delete(compositeId);
        this.buildingInputs.delete(compositeId);
      }
    }
  }

  private syncLogistics(logistics: LogisticsSnapshot): void {
    this.flowLanes = buildConveyorFlowLanes(logistics);
    const lines = collectBeltLines(logistics);
    const lenById = new Map<string, number>();
    const speedById = new Map<string, number>();
    for (const l of lines) {
      lenById.set(l.compositeId, l.lengthM);
      speedById.set(l.compositeId, l.speedPerMin);
    }

    // Группируем полосы потока в цепочки по ключу beltChain.
    const chainByKey = new Map<
      string,
      { members: string[]; sink: string | null }
    >();
    for (const lane of this.flowLanes) {
      const key = lane.beltChain.join("|");
      if (key.length === 0) continue;
      const existing = chainByKey.get(key);
      if (!existing) {
        chainByKey.set(key, {
          members: lane.beltChain,
          sink: lane.sinkCompositeId,
        });
      } else if (!existing.sink && lane.sinkCompositeId) {
        existing.sink = lane.sinkCompositeId;
      }
    }

    for (const [key, c] of chainByKey) {
      const lengthM = c.members.reduce(
        (s, id) => s + (lenById.get(parseBeltChainMemberRef(id).compositeId) ?? 0),
        0,
      );
      let speedPerMin = Infinity;
      for (const id of c.members) {
        speedPerMin = Math.min(
          speedPerMin,
          speedById.get(parseBeltChainMemberRef(id).compositeId) ?? Infinity,
        );
      }
      if (!Number.isFinite(speedPerMin) || speedPerMin <= 0) speedPerMin = 60;
      const speedMps = (speedPerMin / 60) * BELT_ITEM_SPACING_M;

      let lane = this.lanes.get(key);
      let transferredFromPrefix = false;
      if (!lane) {
        let bestOldKey: string | null = null;
        let bestOldMembers = 0;
        for (const [oldKey, oldLane] of this.lanes) {
          if (chainByKey.has(oldKey)) continue;
          if (!this.isLanePrefix(oldLane.memberIds, c.members)) continue;
          if (oldLane.memberIds.length > bestOldMembers) {
            bestOldKey = oldKey;
            bestOldMembers = oldLane.memberIds.length;
          }
        }
        if (bestOldKey) {
          lane = this.lanes.get(bestOldKey);
          this.lanes.delete(bestOldKey);
          if (lane) {
            lane.key = key;
            this.lanes.set(key, lane);
            transferredFromPrefix = true;
          }
        }
      }
      if (!lane) {
        this.lanes.set(key, {
          key,
          memberIds: c.members,
          sinkCompositeId: c.sink,
          lengthM,
          speedPerMin,
          speedMps,
          items: [],
          emitAccum: new Map(),
        });
        continue;
      }
      // Геометрия изменилась — масштабируем позиции, чтобы не было скачков.
      if (
        !transferredFromPrefix &&
        lane.lengthM > EPSILON &&
        Math.abs(lane.lengthM - lengthM) > 1e-3
      ) {
        const k = lengthM / lane.lengthM;
        for (const it of lane.items) it.pos *= k;
      }
      lane.memberIds = c.members;
      lane.sinkCompositeId = c.sink;
      lane.lengthM = lengthM;
      lane.speedPerMin = speedPerMin;
      lane.speedMps = speedMps;
      for (const it of lane.items) {
        if (it.pos > lengthM) it.pos = lengthM;
      }
    }

    for (const key of [...this.lanes.keys()]) {
      if (!chainByKey.has(key)) this.lanes.delete(key);
    }
  }

  private laneForChain(beltChain: string[]): BeltLane | undefined {
    return this.lanes.get(beltChain.join("|"));
  }

  private isLanePrefix(prefix: string[], members: string[]): boolean {
    if (prefix.length === 0 || prefix.length > members.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      if (prefix[i] !== members[i]) return false;
    }
    return true;
  }

  private linksForOutput(
    compositeId: string,
    portIndex: number,
    itemId: string,
  ): ConveyorFlowLane[] {
    return this.flowLanes.filter(
      (l) =>
        l.sourceCompositeId === compositeId &&
        l.sourcePortIndex === portIndex &&
        l.itemId === itemId,
    );
  }

  private getBuildingInputStore(compositeId: string): Map<string, number> {
    let store = this.buildingInputs.get(compositeId);
    if (!store) {
      store = new Map();
      this.buildingInputs.set(compositeId, store);
    }
    return store;
  }

  private readItemPool(
    compositeId: string,
    spec: BuildingSimSpec,
  ): Map<string, number> {
    void compositeId;
    void spec;
    return this.inventory;
  }

  private hasInputSupplyLink(compositeId: string, itemId: string): boolean {
    return this.flowLanes.some(
      (l) => l.sinkCompositeId === compositeId && l.itemId === itemId,
    );
  }

  /** Здание с conveyor-input — только доставленное на вход, не глобальный склад. */
  private usesDeliveredFuelOnly(
    compositeId: string,
    buildingId: string,
  ): boolean {
    const defs = resolveBuildingPortDefinitions(buildingId);
    if (defs.some((d) => d.kind === "conveyor" && d.type === "input")) {
      return true;
    }
    return this.flowLanes.some((l) => l.sinkCompositeId === compositeId);
  }

  /** Топливо: при conveyor-input / ленте — только buildingInputs; иначе — склад. */
  private getFuelAvailability(
    itemId: string,
    compositeId: string,
    buildingId: string,
  ): number {
    const local = this.buildingInputs.get(compositeId)?.get(itemId) ?? 0;
    if (this.usesDeliveredFuelOnly(compositeId, buildingId)) return local;
    if (this.hasInputSupplyLink(compositeId, itemId)) return local;
    return local + (this.inventory.get(itemId) ?? 0);
  }

  private consumeFuel(
    compositeId: string,
    itemId: string,
    amount: number,
  ): void {
    let left = amount;
    const local = this.getBuildingInputStore(compositeId);
    const fromLocal = Math.min(local.get(itemId) ?? 0, left);
    if (fromLocal > 0) {
      this.addToPool(local, itemId, -fromLocal);
      left -= fromLocal;
    }
    const entity = this.entities.get(compositeId);
    const buildingId = entity?.buildingId ?? "";
    if (
      left > EPSILON &&
      !this.usesDeliveredFuelOnly(compositeId, buildingId) &&
      !this.hasInputSupplyLink(compositeId, itemId)
    ) {
      this.addToPool(this.inventory, itemId, -left);
    }
  }

  private runFuelGenerators(dt: number): void {
    const perMinToTick = dt / 60;
    for (const e of this.entities.values()) {
      e.effectiveGenerationMW = 0;
      if (e.spec.kind !== "generator") continue;

      const maxGen = e.spec.generationMW ?? 0;
      const inputs = e.spec.inputs ?? [];
      if (inputs.length === 0) {
        e.effectiveGenerationMW = maxGen;
        e.active = maxGen > EPSILON;
        continue;
      }

      const pool = this.readItemPool(e.compositeId, e.spec);
      const { fraction, consumed } = this.resolveFuelUse(
        inputs,
        perMinToTick,
        e.spec.inputMode ?? "all",
        pool,
        (itemId) =>
          this.getFuelAvailability(itemId, e.compositeId, e.buildingId),
      );
      e.effectiveGenerationMW = maxGen * fraction;
      e.active = fraction > EPSILON;
      if (!e.active) continue;

      for (const use of consumed) {
        this.consumeFuel(e.compositeId, use.itemId, use.amount);
      }
    }
  }

  private computePower(): void {
    let gen = 0;
    let cons = 0;
    for (const e of this.entities.values()) {
      if (e.spec.kind === "generator") {
        gen += e.effectiveGenerationMW;
      } else {
        cons += e.spec.powerMW ?? 0;
      }
    }
    this.generationMW = gen;
    this.consumptionMW = cons;
    this.blackout = cons > gen + EPSILON;
  }

  private runProduction(dt: number): void {
    const perMinToTick = dt / 60;
    for (const e of this.entities.values()) {
      if (e.spec.kind === "generator") continue;
      const spec = e.spec;

      if (this.blackout && (spec.powerMW ?? 0) > 0) {
        e.active = false;
        e.currentPowerMW = 0;
        continue;
      }

      const pool = this.readItemPool(e.compositeId, spec);
      let fraction = 1;
      const inputs = spec.inputs ?? [];
      for (const inp of inputs) {
        const need = inp.perMin * perMinToTick;
        if (need <= EPSILON) continue;
        const have = pool.get(inp.itemId) ?? 0;
        fraction = Math.min(fraction, have / need);
      }

      const outputs = spec.outputs ?? [];
      fraction = this.applySharedBeltBackpressure(
        e.compositeId,
        e.buildingId,
        outputs,
        perMinToTick,
        fraction,
      );

      fraction = Math.max(0, Math.min(1, fraction));
      e.active = fraction > EPSILON;
      e.currentPowerMW = e.active ? (spec.powerMW ?? 0) : 0;
      if (!e.active) continue;

      for (const inp of inputs) {
        this.addToPool(pool, inp.itemId, -inp.perMin * perMinToTick * fraction);
      }

      this.emitOutputs(e.compositeId, e.buildingId, outputs, perMinToTick, fraction);
    }
  }

  /** Бэкпрешер: пауза машины, если у выхода уже ждёт неразмещённая единица (accum ≥ 1). */
  private applySharedBeltBackpressure(
    compositeId: string,
    buildingId: string,
    outputs: NonNullable<BuildingSimSpec["outputs"]>,
    _perMinToTick: number,
    fraction: number,
  ): number {
    void _perMinToTick;
    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      const out = outputs[outIdx]!;
      const links = this.linksForOutput(
        compositeId,
        this.outputPortIndexForOutput(buildingId, outIdx),
        out.itemId,
      );
      if (links.length === 0) continue;
      const lane = this.laneForChain(links[0]!.beltChain);
      if (!lane) {
        fraction = 0;
        continue;
      }
      if ((lane.emitAccum.get(out.itemId) ?? 0) >= 1 - EPSILON) {
        fraction = 0;
      }
    }
    return fraction;
  }

  private emitOutputs(
    compositeId: string,
    buildingId: string,
    outputs: NonNullable<BuildingSimSpec["outputs"]>,
    perMinToTick: number,
    fraction: number,
  ): void {
    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      const out = outputs[outIdx]!;
      const amount = out.perMin * perMinToTick * fraction;
      if (amount <= EPSILON) continue;
      const links = this.linksForOutput(
        compositeId,
        this.outputPortIndexForOutput(buildingId, outIdx),
        out.itemId,
      );
      const lane = links.length > 0 ? this.laneForChain(links[0]!.beltChain) : undefined;
      if (lane) {
        lane.emitAccum.set(
          out.itemId,
          (lane.emitAccum.get(out.itemId) ?? 0) + amount,
        );
      } else {
        this.addToPool(this.inventory, out.itemId, amount);
      }
    }
  }

  /** Индекс conveyor-output порта для n-го выхода spec.outputs. */
  private outputPortIndexForOutput(
    buildingId: string,
    outputIdx: number,
  ): number {
    return specOutputPortIndex(buildingId, outputIdx);
  }

  /** Дискретное движение: сдвиг предметов, доставка в приёмник, спавн на входе. */
  private runBeltFlow(dt: number): void {
    const spacing = BELT_ITEM_SPACING_M;
    for (const lane of this.lanes.values()) {
      const len = lane.lengthM;
      if (len <= EPSILON) continue;
      const v = lane.speedMps;
      // Без приёмника головной предмет упирается в конец ленты (backpressure).
      const headCap = lane.sinkCompositeId ? Infinity : len;

      // Сдвиг с головы (наибольший pos) к хвосту: нельзя обгонять предмет впереди.
      for (let i = lane.items.length - 1; i >= 0; i--) {
        const it = lane.items[i]!;
        let target = it.pos + v * dt;
        const cap =
          i < lane.items.length - 1
            ? lane.items[i + 1]!.pos - spacing
            : headCap;
        target = Math.min(target, cap);
        if (target < it.pos) target = it.pos;
        it.pos = target;
      }

      // Доставка: головные предметы, дошедшие до конца, — по 1 единице в приёмник.
      if (lane.sinkCompositeId) {
        const sink = lane.sinkCompositeId;
        while (
          lane.items.length > 0 &&
          lane.items[lane.items.length - 1]!.pos >= len - EPSILON
        ) {
          const done = lane.items.pop()!;
          const store = this.getBuildingInputStore(sink);
          this.addToPool(store, done.itemId, 1);
        }
      }

      this.spawnLaneItems(lane, spacing);
    }
  }

  /** Спавн целых единиц на входе полосы (pos=0), пока вход свободен и есть накопленное. */
  private spawnLaneItems(lane: BeltLane, spacing: number): void {
    let guard = 128;
    while (guard-- > 0) {
      const entryBlocked =
        lane.items.length > 0 && lane.items[0]!.pos < spacing - EPSILON;
      if (entryBlocked) break;

      let bestItem: string | null = null;
      let bestAccum = 1 - EPSILON;
      for (const [itemId, acc] of lane.emitAccum) {
        if (acc >= 1 - EPSILON && acc > bestAccum) {
          bestAccum = acc;
          bestItem = itemId;
        }
      }
      if (!bestItem) break;

      lane.emitAccum.set(bestItem, (lane.emitAccum.get(bestItem) ?? 0) - 1);
      lane.items.unshift({ id: this.nextItemId++, itemId: bestItem, pos: 0 });
    }
  }

  private addToPool(
    pool: Map<string, number>,
    itemId: string,
    delta: number,
  ): void {
    const next = (pool.get(itemId) ?? 0) + delta;
    if (next <= EPSILON) pool.delete(itemId);
    else pool.set(itemId, next);
  }

  private resolveFuelUse(
    inputs: NonNullable<BuildingSimSpec["inputs"]>,
    perMinToTick: number,
    mode: "all" | "any",
    pool: Map<string, number>,
    getHave: (itemId: string) => number = (id) => pool.get(id) ?? 0,
  ): { fraction: number; consumed: { itemId: string; amount: number }[] } {
    if (mode === "any") {
      let bestInput = inputs[0];
      let bestFraction = 0;
      for (const inp of inputs) {
        const need = inp.perMin * perMinToTick;
        if (need <= EPSILON) continue;
        const have = getHave(inp.itemId);
        const fraction = Math.min(1, have / need);
        if (fraction > bestFraction) {
          bestFraction = fraction;
          bestInput = inp;
        }
      }
      if (bestFraction <= EPSILON) return { fraction: 0, consumed: [] };
      return {
        fraction: bestFraction,
        consumed: [
          {
            itemId: bestInput!.itemId,
            amount: bestInput!.perMin * perMinToTick * bestFraction,
          },
        ],
      };
    }

    let fraction = 1;
    for (const inp of inputs) {
      const need = inp.perMin * perMinToTick;
      if (need <= EPSILON) continue;
      const have = getHave(inp.itemId);
      fraction = Math.min(fraction, have / need);
    }
    fraction = Math.max(0, Math.min(1, fraction));
    if (fraction <= EPSILON) return { fraction: 0, consumed: [] };

    return {
      fraction,
      consumed: inputs.map((inp) => ({
        itemId: inp.itemId,
        amount: inp.perMin * perMinToTick * fraction,
      })),
    };
  }

  getGameTime(): number {
    return this.gameTime;
  }

  /** Полосы с дискретными предметами для 3D-визуализации (каждый кадр). */
  getBeltVisualState(): BeltLaneVisual[] {
    const out: BeltLaneVisual[] = [];
    for (const lane of this.lanes.values()) {
      if (lane.items.length === 0 || lane.lengthM <= EPSILON) continue;
      out.push({
        laneKey: lane.key,
        memberCompositeIds: lane.memberIds,
        speedMps: lane.speedMps,
        items: lane.items.map((it) => ({
          id: it.id,
          itemId: it.itemId,
          pos01: Math.min(1, Math.max(0, it.pos / lane.lengthM)),
        })),
      });
    }
    return out;
  }

  getSummary(logistics: LogisticsSnapshot = EMPTY_LOGISTICS): SimulationSummary {
    const inventory: ItemStack[] = Array.from(this.inventory.entries())
      .map(([itemId, amount]) => ({ itemId, amount: Math.floor(amount) }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, SUMMARY_TOP_ITEMS);

    const beltBuffers: NonNullable<
      SimulationSummary["logistics"]
    >["beltBuffers"] = [];
    for (const lane of this.lanes.values()) {
      const counts = new Map<string, number>();
      for (const it of lane.items) {
        counts.set(it.itemId, (counts.get(it.itemId) ?? 0) + 1);
      }
      for (const [itemId, amount] of counts) {
        beltBuffers.push({
          beltCompositeId: `${lane.key}:${itemId}`,
          itemId,
          amount,
        });
      }
    }

    const buildingInputs: NonNullable<
      SimulationSummary["logistics"]
    >["buildingInputs"] = [];
    for (const [compositeId, store] of this.buildingInputs) {
      for (const [itemId, amount] of store) {
        if (amount > EPSILON) {
          buildingInputs.push({
            compositeId,
            itemId,
            amount: Math.floor(amount * 10) / 10,
          });
        }
      }
    }

    const logSummary = summarizeLogistics(logistics);

    return {
      gameTime: this.gameTime,
      power: {
        generationMW: this.generationMW,
        consumptionMW: this.consumptionMW,
        satisfiedRatio:
          this.consumptionMW > EPSILON
            ? Math.min(1, this.generationMW / this.consumptionMW)
            : 1,
        blackout: this.blackout,
      },
      inventory,
      buildingCount: this.entities.size,
      logistics: {
        ...logSummary,
        beltBuffers,
        buildingInputs,
      },
    };
  }

  serializeInventory(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [itemId, amount] of this.inventory) {
      const floored = Math.floor(amount);
      if (floored > 0) out[itemId] = floored;
    }
    return out;
  }

  restore(data: {
    version?: number;
    gameTime?: number;
    inventory?: Record<string, number>;
  }): void {
    if (data.version !== undefined && data.version !== SIM_SAVE_VERSION) {
      console.warn(
        `[Sim] save version ${data.version} != ${SIM_SAVE_VERSION}, всё равно пробую загрузить`,
      );
    }
    if (typeof data.gameTime === "number") this.gameTime = data.gameTime;
    this.inventory.clear();
    this.lanes.clear();
    this.buildingInputs.clear();
    if (data.inventory) {
      for (const [itemId, amount] of Object.entries(data.inventory)) {
        if (typeof amount === "number" && amount > 0) {
          this.inventory.set(itemId, amount);
        }
      }
    }
  }

  static readonly SAVE_VERSION = SIM_SAVE_VERSION;
}
