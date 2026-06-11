// ============================================================
// 3D-модели предметов симуляции (конвейер, UI, превью).
// ============================================================

export interface SimItemModelDef {
  path: string;
  /** Целевой размер по max-оси bbox (м). */
  targetSize: number;
  /** Подъём над центром сегмента ленты (м). */
  yOffset: number;
}

/** itemId → GLB/OBJ в /kits. */
export const SIM_ITEM_MODELS: Record<string, SimItemModelDef> = {
  wood: {
    path: "/kits/models/wood-obj.glb",
    targetSize: 2.1,
    yOffset: 0.38,
  },
  leaves: {
    path: "/kits/models/grass.glb",
    targetSize: 1.9,
    yOffset: 0.34,
  },
};

export function getSimItemModel(itemId: string): SimItemModelDef | null {
  return SIM_ITEM_MODELS[itemId] ?? null;
}

export function allSimItemModelPaths(): string[] {
  return [...new Set(Object.values(SIM_ITEM_MODELS).map((d) => d.path))];
}

/** Состояние ленты для 3D-визуализации (читается каждый кадр). */
export interface BeltVisualState {
  beltCompositeId: string;
  speedPerMin: number;
  items: Array<{ itemId: string; amount: number }>;
}
