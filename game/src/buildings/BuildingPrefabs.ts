// ============================================================
// Одиночные GLB из меню строительства (без JSON-паттерна).
// Голограмма и постановка — через общий путь конструктора.
// ============================================================

const CITY = "/kits/City Kit Industrial/Models/GLB format";
const COMMERCIAL = "/kits/kenney_city-kit-commercial_2.1/Models/GLB format";

export interface BuildingPrefabDef {
  modelPath: string;
  /** Масштаб призрака и установленной модели */
  scale: number;
}

const RAW: Record<string, BuildingPrefabDef> = {
  // Особые строения
  hub: { modelPath: `${CITY}/building-a.glb`, scale: 20 },
  space_elevator: {
    modelPath: `${COMMERCIAL}/low-detail-building-m.glb`,
    scale: 60,
  },
  resource_sink: { modelPath: `${CITY}/building-o.glb`, scale: 20 },
  // Производство деталей
  constructor: { modelPath: `${CITY}/building-p.glb`, scale: 20 },
  assembler: { modelPath: `${CITY}/building-q.glb`, scale: 20 },
  manufacturer: { modelPath: `${CITY}/building-t.glb`, scale: 20 },
  packager: { modelPath: `${CITY}/building-r.glb`, scale: 20 },
  refinery: { modelPath: `${CITY}/building-l.glb`, scale: 20 },
  blender: { modelPath: `${CITY}/building-c.glb`, scale: 20 },
  particle_accelerator: { modelPath: `${CITY}/building-g.glb`, scale: 20 },
  converter: { modelPath: `${CITY}/building-e.glb`, scale: 20 },
  quantum_encoder: { modelPath: `${CITY}/building-f.glb`, scale: 20 },
  // Генераторы
  coal_generator: { modelPath: `${CITY}/building-n.glb`, scale: 20 },
  fuel_generator: { modelPath: `${CITY}/building-m.glb`, scale: 20 },
  nuclear_power: { modelPath: `${CITY}/chimney-large.glb`, scale: 20 },
  power_storage: {
    modelPath: `${COMMERCIAL}/low-detail-building-h.glb`,
    scale: 15,
  },
};

export function getBuildingPrefab(
  buildingId: string,
): BuildingPrefabDef | null {
  return RAW[buildingId] ?? null;
}

export function hasPrefabBuilding(buildingId: string): boolean {
  return buildingId in RAW;
}
