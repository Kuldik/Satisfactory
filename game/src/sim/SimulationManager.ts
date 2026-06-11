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
  buildConveyorSupplyLinks,
  collectBeltLines,
  summarizeLogistics,
} from "./conveyorGraph.ts";
import type { ConveyorSupplyLink, LogisticsSnapshot } from "./logisticsTypes.ts";
import type { BeltVisualState } from "./simItemModels.ts";

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

interface BeltBuffer {
  items: Map<string, number>;
  maxAmount: number;
  speedPerMin: number;
}

function beltBufferTotal(buf: BeltBuffer): number {
  let total = 0;
  for (const amount of buf.items.values()) total += amount;
  return total;
}

const SIM_SAVE_VERSION = 1;
const SUMMARY_TOP_ITEMS = 16;
const EPSILON = 1e-6;
/** Сколько «минут» ленты держим в буфере (бэкпрешер). */
const BELT_BUFFER_MINUTES = 2;

const EMPTY_LOGISTICS: LogisticsSnapshot = { ports: [], belts: [] };

export class SimulationManager {
  private readonly entities = new Map<string, SimEntity>();
  private readonly inventory = new Map<string, number>();
  /** compositeId ленты → буфер предметов на ленте. */
  private readonly beltBuffers = new Map<string, BeltBuffer>();
  /** compositeId здания → itemId → кол-во у входных портов с ленты. */
  private readonly buildingInputs = new Map<string, Map<string, number>>();

  private supplyLinks: ConveyorSupplyLink[] = [];
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
    this.supplyLinks = buildConveyorSupplyLinks(logistics);
    const lines = collectBeltLines(logistics);
    const aliveBelts = new Set(lines.map((l) => l.compositeId));

    for (const id of this.beltBuffers.keys()) {
      if (!aliveBelts.has(id)) this.beltBuffers.delete(id);
    }

    for (const line of lines) {
      if (!this.beltBuffers.has(line.compositeId)) {
        this.beltBuffers.set(line.compositeId, {
          items: new Map(),
          maxAmount: line.speedPerMin * BELT_BUFFER_MINUTES,
          speedPerMin: line.speedPerMin,
        });
      } else {
        const buf = this.beltBuffers.get(line.compositeId)!;
        buf.speedPerMin = line.speedPerMin;
        buf.maxAmount = line.speedPerMin * BELT_BUFFER_MINUTES;
      }
    }
  }

  private linksForOutput(
    compositeId: string,
    portIndex: number,
    itemId: string,
  ): ConveyorSupplyLink[] {
    return this.supplyLinks.filter(
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
    return this.supplyLinks.some(
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
    return this.supplyLinks.some((l) => l.sinkCompositeId === compositeId);
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

  /** Общий буфер ленты: лимит по сумме всех выходов на belt, не по каждому отдельно. */
  private applySharedBeltBackpressure(
    compositeId: string,
    buildingId: string,
    outputs: NonNullable<BuildingSimSpec["outputs"]>,
    perMinToTick: number,
    fraction: number,
  ): number {
    const wantPerBelt = new Map<string, number>();
    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      const out = outputs[outIdx]!;
      const links = this.linksForOutput(
        compositeId,
        this.outputPortIndexForOutput(buildingId, outIdx),
        out.itemId,
      );
      if (links.length === 0) continue;
      const beltId = links[0]!.beltChain[0]!;
      wantPerBelt.set(
        beltId,
        (wantPerBelt.get(beltId) ?? 0) + out.perMin * perMinToTick,
      );
    }
    for (const [beltId, totalWant] of wantPerBelt) {
      const buf = this.beltBuffers.get(beltId);
      if (!buf) continue;
      const headroom = buf.maxAmount - beltBufferTotal(buf);
      if (headroom <= EPSILON || totalWant <= EPSILON) {
        fraction = Math.min(fraction, 0);
      } else {
        fraction = Math.min(fraction, headroom / totalWant);
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
    const pendingByBelt = new Map<
      string,
      Array<{ itemId: string; amount: number }>
    >();

    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      const out = outputs[outIdx]!;
      const amount = out.perMin * perMinToTick * fraction;
      if (amount <= EPSILON) continue;
      const links = this.linksForOutput(
        compositeId,
        this.outputPortIndexForOutput(buildingId, outIdx),
        out.itemId,
      );
      if (links.length > 0) {
        const beltId = links[0]!.beltChain[0]!;
        const list = pendingByBelt.get(beltId) ?? [];
        list.push({ itemId: out.itemId, amount });
        pendingByBelt.set(beltId, list);
      } else {
        this.addToPool(this.inventory, out.itemId, amount);
      }
    }

    for (const [beltId, pending] of pendingByBelt) {
      const buf = this.beltBuffers.get(beltId);
      if (!buf) continue;
      const total = pending.reduce((sum, p) => sum + p.amount, 0);
      const headroom = buf.maxAmount - beltBufferTotal(buf);
      const scale = total <= EPSILON ? 0 : Math.min(1, headroom / total);
      for (const { itemId, amount } of pending) {
        this.pushToBelt(beltId, itemId, amount * scale);
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

  private pushToBelt(
    beltCompositeId: string,
    itemId: string,
    amount: number,
  ): void {
    if (amount <= EPSILON) return;
    const buf = this.beltBuffers.get(beltCompositeId);
    if (!buf) return;
    const headroom = buf.maxAmount - beltBufferTotal(buf);
    if (headroom <= EPSILON) return;
    const add = Math.min(amount, headroom);
    buf.items.set(itemId, (buf.items.get(itemId) ?? 0) + add);
  }

  private runBeltFlow(dt: number): void {
    const perMinToTick = dt / 60;
    for (const [beltId, buf] of this.beltBuffers) {
      const total = beltBufferTotal(buf);
      if (total <= EPSILON) continue;
      const budget = buf.speedPerMin * perMinToTick;

      for (const [itemId, amount] of [...buf.items.entries()]) {
        if (amount <= EPSILON) continue;
        const transfer = Math.min(amount, (amount / total) * budget);
        if (transfer <= EPSILON) continue;

        let moved = false;
        for (const link of this.supplyLinks) {
          if (link.itemId !== itemId) continue;
          const segIdx = link.beltChain.indexOf(beltId);
          if (segIdx < 0) continue;

          buf.items.set(itemId, amount - transfer);
          if ((buf.items.get(itemId) ?? 0) <= EPSILON) buf.items.delete(itemId);

          if (segIdx < link.beltChain.length - 1) {
            this.pushToBelt(link.beltChain[segIdx + 1]!, itemId, transfer);
          } else {
            const store = this.getBuildingInputStore(link.sinkCompositeId);
            this.addToPool(store, itemId, transfer);
          }
          moved = true;
          break;
        }
        if (!moved) continue;
      }
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

  /** Состояние лент для 3D-визуализации (каждый кадр). */
  getBeltVisualState(): BeltVisualState[] {
    const out: BeltVisualState[] = [];
    for (const [beltCompositeId, buf] of this.beltBuffers) {
      const items: Array<{ itemId: string; amount: number }> = [];
      for (const [itemId, amount] of buf.items) {
        if (amount > EPSILON) items.push({ itemId, amount });
      }
      if (items.length === 0) continue;
      out.push({
        beltCompositeId,
        speedPerMin: buf.speedPerMin,
        items,
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
    for (const [beltCompositeId, buf] of this.beltBuffers) {
      for (const [itemId, amount] of buf.items) {
        if (amount > EPSILON) {
          beltBuffers.push({
            beltCompositeId,
            itemId,
            amount: Math.floor(amount * 10) / 10,
          });
        }
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
    this.beltBuffers.clear();
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
