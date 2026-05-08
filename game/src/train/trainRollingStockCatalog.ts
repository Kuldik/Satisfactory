// ============================================================
// Train Kit — rolling stock variants and default selection
// ============================================================

export type RollingStockKind = "locomotive" | "freight_car" | "fluid_freight_car";

export interface RollingStockVariant {
  id: string;
  label: string;
  modelPath: string;
  previewPath: string;
  kind: RollingStockKind;
  capacityLabel?: string;
}

export const TRAIN_KIT_OBJ_DIR =
  "/kits/kenney_train-kit/Models/OBJ format/";
export const TRAIN_KIT_PREVIEW_DIR = "/kits/kenney_train-kit/Previews/";

export function trainObjPath(id: string): string {
  return `${TRAIN_KIT_OBJ_DIR}${id}.obj`;
}

export function trainPreviewPath(id: string): string {
  return `${TRAIN_KIT_PREVIEW_DIR}${id}.png`;
}

function variant(
  kind: RollingStockKind,
  id: string,
  label: string,
  capacityLabel?: string,
): RollingStockVariant {
  return {
    id,
    label,
    kind,
    modelPath: trainObjPath(id),
    previewPath: trainPreviewPath(id),
    ...(capacityLabel ? { capacityLabel } : {}),
  };
}

export const LOCOMOTIVE_VARIANTS: RollingStockVariant[] = [
  variant("locomotive", "train-electric-double-a", "Electric Double A"),
  variant("locomotive", "train-diesel-a", "Diesel A"),
  variant("locomotive", "train-diesel-box-a", "Diesel Box A"),
  variant("locomotive", "train-diesel-b", "Diesel B"),
  variant("locomotive", "train-locomotive-a", "Locomotive A"),
  variant("locomotive", "train-locomotive-b", "Locomotive B"),
  variant("locomotive", "train-locomotive-c", "Locomotive C"),
  variant("locomotive", "train-electric-city-a", "Electric City A"),
  variant("locomotive", "train-electric-bullet-a", "Electric Bullet A"),
  variant("locomotive", "train-diesel-c", "Diesel C"),
  variant("locomotive", "train-electric-subway-a", "Electric Subway A"),
  variant("locomotive", "train-tram-modern", "Modern Tram"),
];

export const FREIGHT_CAR_VARIANTS: RollingStockVariant[] = [
  variant("freight_car", "train-carriage-container-red", "Container Red"),
  variant("freight_car", "train-carriage-container-green", "Container Green"),
  variant("freight_car", "train-carriage-container-blue", "Container Blue"),
  variant("freight_car", "train-carriage-coal", "Coal Car"),
  variant("freight_car", "train-carriage-box", "Box Car"),
  variant("freight_car", "train-carriage-wood", "Wood Car"),
  // Matching cars for the electric-double visual family.
  variant("freight_car", "train-electric-double-c", "Electric Double C"),
  variant("freight_car", "train-carriage-lumber", "Lumber Car"),
  variant("freight_car", "train-carriage-flatbed-wood", "Flatbed Wood"),
  variant("freight_car", "train-carriage-flatbed", "Flatbed"),
  variant("freight_car", "train-carriage-dirt", "Dirt Car"),
  variant("freight_car", "train-electric-bullet-c", "Electric Bullet C"),
];

export const FLUID_FREIGHT_CAR_VARIANTS: RollingStockVariant[] = [
  variant(
    "fluid_freight_car",
    "train-carriage-tank",
    "Tank Car",
    "400 м³, как обычная цистерна",
  ),
  variant(
    "fluid_freight_car",
    "train-carriage-tank-large",
    "Large Tank Car",
    "2400 м³, как промышленная цистерна",
  ),
];

export const ROLLING_STOCK_VARIANTS: Record<
  RollingStockKind,
  RollingStockVariant[]
> = {
  locomotive: LOCOMOTIVE_VARIANTS,
  freight_car: FREIGHT_CAR_VARIANTS,
  fluid_freight_car: FLUID_FREIGHT_CAR_VARIANTS,
};

export const DEFAULT_ROLLING_STOCK_VARIANT_IDS: Record<
  RollingStockKind,
  string
> = {
  locomotive: LOCOMOTIVE_VARIANTS[0]!.id,
  freight_car: FREIGHT_CAR_VARIANTS[0]!.id,
  fluid_freight_car: FLUID_FREIGHT_CAR_VARIANTS[0]!.id,
};

export function isRollingStockMenuId(
  id: string | null | undefined,
): id is RollingStockKind {
  return (
    id === "locomotive" ||
    id === "freight_car" ||
    id === "fluid_freight_car"
  );
}

export function getRollingStockVariant(
  kind: RollingStockKind,
  variantId: string,
): RollingStockVariant | null {
  return ROLLING_STOCK_VARIANTS[kind].find((v) => v.id === variantId) ?? null;
}

export function getDefaultRollingStockVariant(
  kind: RollingStockKind,
): RollingStockVariant {
  return getRollingStockVariant(
    kind,
    DEFAULT_ROLLING_STOCK_VARIANT_IDS[kind],
  )!;
}

export function getAllRollingStockModelPaths(): string[] {
  return Object.values(ROLLING_STOCK_VARIANTS)
    .flat()
    .map((variant) => variant.modelPath);
}
