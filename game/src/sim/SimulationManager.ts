// ============================================================
// SimulationManager — связывает игровой мир с тиком движка.
//
// Источник правды визуального мира — SceneManager (размещённые модели).
// SimulationManager держит ПАРАЛЛЕЛЬНУЮ модель игровой логики (ECS-стиль:
// сущности + компоненты + системы) и каждый тик синхронизирует её со
// «снапшотом» логических зданий, затем прогоняет системы фиксированным
// шагом dt: энергия → производство.
//
// Почему не bitECS: в установленной версии 0.4 основной экспорт — новый
// API (нет defineComponent/Types/defineQuery), а подпакет `bitecs/legacy`
// в дистрибутиве отсутствует. Чтобы не зависеть от нестабильного API,
// используем самодостаточную типизированную модель (это тоже ECS).
//
// Фаза 1: предметы текут через глобальный склад игрока (без конвейеров),
// энергосеть одна общая (без отдельных сетей/столбов).
// ============================================================

import type { SimulationSummary, ItemStack } from "../core/types.ts";
import {
  getBuildingSimSpec,
  isSimulatedBuilding,
  type BuildingSimSpec,
} from "./buildingCatalog.ts";

/** Минимальное описание логического здания из визуального мира. */
export interface PlacedBuildingSnapshot {
  compositeId: string;
  buildingId: string;
  x: number;
  y: number;
  z: number;
}

/** Сущность симуляции (ECS-стиль: компоненты как поля). */
interface SimEntity {
  compositeId: string;
  buildingId: string;
  spec: BuildingSimSpec;
  /** Производитель сейчас работает (для UI/отладки). */
  active: boolean;
  /** Фактическое потребление с учётом работы, МВт. */
  currentPowerMW: number;
}

const SIM_SAVE_VERSION = 1;
/** Сколько позиций склада отдавать в HUD-сводку. */
const SUMMARY_TOP_ITEMS = 8;
/** Порог «не считаем дробные крохи» (предметов). */
const EPSILON = 1e-6;

export class SimulationManager {
  /** compositeId → сущность. */
  private readonly entities = new Map<string, SimEntity>();

  /** Глобальный («бесконечный») склад игрока: itemId → количество. */
  private readonly inventory = new Map<string, number>();

  private gameTime = 0;
  private generationMW = 0;
  private consumptionMW = 0;
  private blackout = false;

  /** Один шаг симуляции. `dt` — секунды. */
  update(dt: number, snapshot: PlacedBuildingSnapshot[]): void {
    this.gameTime += dt;
    this.syncWorld(snapshot);
    this.computePower();
    this.runProduction(dt);
  }

  // ---- Системы ----

  /** Сверка модели со снапшотом: спавн новых, удаление исчезнувших. */
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
        });
      }
    }
    for (const compositeId of this.entities.keys()) {
      if (!present.has(compositeId)) this.entities.delete(compositeId);
    }
  }

  /** Энергобаланс одной общей сети. */
  private computePower(): void {
    let gen = 0;
    let cons = 0;
    for (const e of this.entities.values()) {
      if (e.spec.kind === "generator") {
        gen += e.spec.generationMW ?? 0;
      } else {
        cons += e.spec.powerMW ?? 0;
      }
    }
    this.generationMW = gen;
    this.consumptionMW = cons;
    // «Полное отключение сети» при дефиците (см. PROJECT_PLAN 3b).
    this.blackout = cons > gen + EPSILON;
  }

  /** Производство: майнеры/станки → глобальный склад (вход/выход без конвейеров). */
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

      // Доля выполнения за тик: ограничена доступностью входов.
      let fraction = 1;
      const inputs = spec.inputs ?? [];
      for (const inp of inputs) {
        const need = inp.perMin * perMinToTick;
        if (need <= EPSILON) continue;
        const have = this.inventory.get(inp.itemId) ?? 0;
        fraction = Math.min(fraction, have / need);
      }
      fraction = Math.max(0, Math.min(1, fraction));

      e.active = fraction > EPSILON;
      e.currentPowerMW = e.active ? (spec.powerMW ?? 0) : 0;
      if (!e.active) continue;

      for (const inp of inputs) {
        this.addItem(inp.itemId, -inp.perMin * perMinToTick * fraction);
      }
      for (const out of spec.outputs ?? []) {
        this.addItem(out.itemId, out.perMin * perMinToTick * fraction);
      }
    }
  }

  // ---- Склад ----

  private addItem(itemId: string, delta: number): void {
    const next = (this.inventory.get(itemId) ?? 0) + delta;
    if (next <= EPSILON) this.inventory.delete(itemId);
    else this.inventory.set(itemId, next);
  }

  getInventoryCount(itemId: string): number {
    return this.inventory.get(itemId) ?? 0;
  }

  // ---- UI / прочее ----

  getGameTime(): number {
    return this.gameTime;
  }

  getSummary(): SimulationSummary {
    const inventory: ItemStack[] = Array.from(this.inventory.entries())
      .map(([itemId, amount]) => ({ itemId, amount: Math.floor(amount) }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, SUMMARY_TOP_ITEMS);

    const satisfiedRatio =
      this.consumptionMW > EPSILON
        ? Math.min(1, this.generationMW / this.consumptionMW)
        : 1;

    return {
      gameTime: this.gameTime,
      power: {
        generationMW: this.generationMW,
        consumptionMW: this.consumptionMW,
        satisfiedRatio,
        blackout: this.blackout,
      },
      inventory,
      buildingCount: this.entities.size,
    };
  }

  // ---- Сериализация (в SaveData) ----

  serializeInventory(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [itemId, amount] of this.inventory) {
      const floored = Math.floor(amount);
      if (floored > 0) out[itemId] = floored;
    }
    return out;
  }

  /** Восстановление из сейва. Здания пересоздаются из снапшота при следующем тике. */
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
