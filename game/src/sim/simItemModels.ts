// ============================================================
// 3D-модели предметов симуляции (конвейер, UI, превью).
// ============================================================

export interface SimItemModelDef {
  path: string;
  /** Целевой размер по max-оси bbox (м). */
  targetSize: number;
  /** Подъём над центром сегмента ленты (м). */
  yOffset: number;
  /** Цвет материала (hex), если модель без текстур. */
  tint: number;
}

/** itemId → GLB/OBJ в /kits. */
export const SIM_ITEM_MODELS: Record<string, SimItemModelDef> = {
  wood: {
    path: "/kits/models/wood-obj.glb",
    targetSize: 2.1,
    yOffset: 0.38,
    tint: 0x867f6c,
  },
  leaves: {
    path: "/kits/models/grass.glb",
    targetSize: 1.9,
    yOffset: 0.34,
    tint: 0x4e6048,
  },
};

export function getSimItemModel(itemId: string): SimItemModelDef | null {
  return SIM_ITEM_MODELS[itemId] ?? null;
}

export function allSimItemModelPaths(): string[] {
  return [...new Set(Object.values(SIM_ITEM_MODELS).map((d) => d.path))];
}
