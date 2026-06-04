// ============================================================
// Каталог симуляции: menuBuildingId → игровая спецификация.
// Единственный источник правды для тика (производство/энергия).
//
// Фаза 1 (см. ROADMAP «Этап 1»): «вход/выход в контейнер без конвейеров».
// Предметы текут напрямую через глобальный склад игрока, конвейеры пока
// не участвуют в логике. Упрощения помечены TODO.
// ============================================================

import { ResourceType } from "../core/types.ts";

export type SimBuildingKind = "miner" | "producer" | "generator";

export interface SimItemFlow {
  itemId: string;
  /** Предметов в минуту. */
  perMin: number;
}

export interface BuildingSimSpec {
  kind: SimBuildingKind;
  /** Потребление, МВт (майнеры/производители). */
  powerMW?: number;
  /** Выработка, МВт (генераторы). TODO фаза 2: учитывать топливо/воду. */
  generationMW?: number;
  /** Вход — вычитается из глобального склада (производители). */
  inputs?: SimItemFlow[];
  /** Выход — добавляется в глобальный склад. */
  outputs?: SimItemFlow[];
}

/** Производные предметы вне `ResourceType` (слитки/детали) — для отображения. */
export const SIM_ITEM_NAMES: Record<string, string> = {
  [ResourceType.IronOre]: "Железная руда",
  [ResourceType.CopperOre]: "Медная руда",
  [ResourceType.Limestone]: "Известняк",
  [ResourceType.Coal]: "Уголь",
  iron_ingot: "Железный слиток",
  copper_ingot: "Медный слиток",
  steel_ingot: "Стальной слиток",
};

export function simItemName(itemId: string): string {
  return SIM_ITEM_NAMES[itemId] ?? itemId;
}

/**
 * TODO фаза 2: тип руды должен браться с ресурсного узла под майнером, а не
 * фиксироваться железом. Сейчас узлы не отслеживаются — майнер считается
 * стоящим на узле обычной чистоты (×2) по железу.
 */
const SIM_CATALOG: Record<string, BuildingSimSpec> = {
  // — Добыча —
  miner_mk1: {
    kind: "miner",
    powerMW: 5,
    outputs: [{ itemId: ResourceType.IronOre, perMin: 60 }],
  },
  miner_mk2: {
    kind: "miner",
    powerMW: 12,
    outputs: [{ itemId: ResourceType.IronOre, perMin: 120 }],
  },
  miner_mk3: {
    kind: "miner",
    powerMW: 30,
    outputs: [{ itemId: ResourceType.IronOre, perMin: 240 }],
  },

  // — Переплавка (демонстрация цепочки руда → слиток) —
  smelter: {
    kind: "producer",
    powerMW: 4,
    inputs: [{ itemId: ResourceType.IronOre, perMin: 30 }],
    outputs: [{ itemId: "iron_ingot", perMin: 30 }],
  },
  foundry: {
    kind: "producer",
    powerMW: 16,
    inputs: [
      { itemId: ResourceType.IronOre, perMin: 45 },
      { itemId: ResourceType.Coal, perMin: 45 },
    ],
    outputs: [{ itemId: "steel_ingot", perMin: 45 }],
  },

  // — Генераторы (фаза 1: бесплатное топливо) —
  biomass_burner: { kind: "generator", generationMW: 30 },
  // TODO: пассивный бонус +30% к сети инопланетного экстрактора (см. PROJECT_PLAN 3a).
  alien_extractor: { kind: "generator", generationMW: 500 },
};

export function getBuildingSimSpec(
  buildingId: string | undefined,
): BuildingSimSpec | null {
  if (!buildingId) return null;
  return SIM_CATALOG[buildingId] ?? null;
}

export function isSimulatedBuilding(buildingId: string | undefined): boolean {
  return !!buildingId && buildingId in SIM_CATALOG;
}
