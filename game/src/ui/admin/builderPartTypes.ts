// ============================================================
// Общие типы для каталога деталей конструктора (несколько kit)
// ============================================================

export type BuilderKitId = "building" | "space";

export interface PartDef {
  name: string;
  label: string;
  /** По умолчанию kenney_building-kit */
  kit?: BuilderKitId;
}

export const BUILDER_KIT_BASES: Record<
  BuilderKitId,
  { model: string; preview: string }
> = {
  building: {
    model: "/kits/kenney_building-kit/Models/GLB format",
    preview: "/kits/kenney_building-kit/Previews",
  },
  space: {
    model: "/kits/kenney_space-station-kit/Models/GLB format",
    preview: "/kits/kenney_space-station-kit/Previews",
  },
};
