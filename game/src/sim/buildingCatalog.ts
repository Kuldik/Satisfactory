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
  [ResourceType.Water]: "Вода",
  [ResourceType.CrudeOil]: "Нефть",
  [ResourceType.NitrogenGas]: "Азот",
  iron_ingot: "Железный слиток",
  iron_plate: "Железная пластина",
  reinforced_iron_plate: "Усиленная железная пластина",
  modular_frame: "Модульная рама",
  copper_ingot: "Медный слиток",
  steel_ingot: "Стальной слиток",
  plastic: "Пластик",
  fuel: "Топливо",
  packaged_water: "Упакованная вода",
  turbo_blend: "Турбо-смесь",
  wood: "Древесина",
  leaves: "Трава",
};

export function simItemName(itemId: string): string {
  return SIM_ITEM_NAMES[itemId] ?? itemId;
}

/**
 * TODO фаза 2: тип руды должен браться с ресурсного узла под майнером, а не
 * фиксироваться железом. Сейчас узлы не отслеживаются — майнер считается
 * стоящим на узле обычной чистоты (×2) по железу.
 */
const SIM_CATALOG: Record<string, BuildingSimSpec> = Object.assign(
  Object.create(null) as Record<string, BuildingSimSpec>,
  {
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
  water_extractor: {
    kind: "producer",
    powerMW: 20,
    outputs: [{ itemId: ResourceType.Water, perMin: 120 }],
  },
  oil_extractor: {
    kind: "producer",
    powerMW: 40,
    outputs: [{ itemId: ResourceType.CrudeOil, perMin: 120 }],
  },
  pressure_booster: {
    kind: "producer",
    powerMW: 150,
    outputs: [{ itemId: ResourceType.NitrogenGas, perMin: 120 }],
  },
  well_extractor: {
    kind: "producer",
    powerMW: 0,
    outputs: [{ itemId: ResourceType.NitrogenGas, perMin: 60 }],
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
  sawmill: {
    kind: "producer",
    powerMW: 10,
    outputs: [
      { itemId: "wood", perMin: 60 },
      { itemId: "leaves", perMin: 60 },
    ],
  },

  // — GLB-производство деталей (упрощённые рецепты фазы 1) —
  "constructor": {
    kind: "producer" as const,
    powerMW: 4,
    inputs: [{ itemId: "iron_ingot", perMin: 30 }],
    outputs: [{ itemId: "iron_plate", perMin: 20 }],
  },
  assembler: {
    kind: "producer",
    powerMW: 15,
    inputs: [
      { itemId: "iron_plate", perMin: 30 },
      { itemId: "iron_ingot", perMin: 30 },
    ],
    outputs: [{ itemId: "reinforced_iron_plate", perMin: 5 }],
  },
  manufacturer: {
    kind: "producer",
    powerMW: 55,
    inputs: [
      { itemId: "reinforced_iron_plate", perMin: 10 },
      { itemId: "iron_plate", perMin: 30 },
    ],
    outputs: [{ itemId: "modular_frame", perMin: 2 }],
  },
  refinery: {
    kind: "producer",
    powerMW: 30,
    inputs: [{ itemId: ResourceType.CrudeOil, perMin: 30 }],
    outputs: [
      { itemId: "plastic", perMin: 20 },
      { itemId: "fuel", perMin: 10 },
    ],
  },
  packager: {
    kind: "producer",
    powerMW: 10,
    inputs: [{ itemId: ResourceType.Water, perMin: 60 }],
    outputs: [{ itemId: "packaged_water", perMin: 60 }],
  },
  blender: {
    kind: "producer",
    powerMW: 75,
    inputs: [
      { itemId: ResourceType.Water, perMin: 60 },
      { itemId: "fuel", perMin: 30 },
    ],
    outputs: [{ itemId: "turbo_blend", perMin: 20 }],
  },

  // — Генераторы (фаза 1: бесплатное топливо) —
  biomass_burner: { kind: "generator", generationMW: 30 },
  coal_generator: { kind: "generator", generationMW: 75 },
  fuel_generator: { kind: "generator", generationMW: 250 },
  nuclear_power: { kind: "generator", generationMW: 2500 },
  // TODO: пассивный бонус +30% к сети инопланетного экстрактора (см. PROJECT_PLAN 3a).
  alien_extractor: { kind: "generator", generationMW: 500 },
  alien_energy_extractor: { kind: "generator", generationMW: 500 },
  },
);

export function getBuildingSimSpec(
  buildingId: string | undefined,
): BuildingSimSpec | null {
  if (!buildingId) return null;
  return SIM_CATALOG[buildingId] ?? null;
}

export function isSimulatedBuilding(buildingId: string | undefined): boolean {
  return !!buildingId && buildingId in SIM_CATALOG;
}
