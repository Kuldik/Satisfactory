// ============================================================
// Палитры материалов для отдельных префабов (glb без текстур).
// Раскраска по имени меша + запасной цикл по порядку мешей.
// ============================================================

import * as THREE from "three";
import type { SceneThemeMode } from "../ui/themeSync.ts";

type TintSpec = {
  color: number;
  metalness?: number;
  roughness?: number;
  side?: THREE.Side;
};

/** Сначала проверяется имя меша (регистронезависимо), иначе — цвет из цикла. */
type MeshTintRule = { nameMatch: RegExp } & TintSpec;

function cloneAndTintMaterial(
  mat: THREE.Material,
  spec: TintSpec,
): THREE.Material {
  const next = mat.clone();
  if (next instanceof THREE.MeshStandardMaterial) {
    next.color.set(spec.color);
    if (spec.metalness !== undefined) next.metalness = spec.metalness;
    if (spec.roughness !== undefined) next.roughness = spec.roughness;
    if (spec.side !== undefined) next.side = spec.side;
  } else if (next instanceof THREE.MeshPhysicalMaterial) {
    next.color.set(spec.color);
    if (spec.metalness !== undefined) next.metalness = spec.metalness;
    if (spec.roughness !== undefined) next.roughness = spec.roughness;
    if (spec.side !== undefined) next.side = spec.side;
  } else if (
    next instanceof THREE.MeshLambertMaterial ||
    next instanceof THREE.MeshPhongMaterial
  ) {
    next.color.set(spec.color);
  } else if (next instanceof THREE.MeshBasicMaterial) {
    next.color.set(spec.color);
  }
  return next;
}

function applySpecToMesh(mesh: THREE.Mesh, spec: TintSpec): void {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((m) => cloneAndTintMaterial(m, spec));
  } else {
    mesh.material = cloneAndTintMaterial(mesh.material, spec);
  }
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

function tintMeshesWithRulesAndCycle(
  root: THREE.Object3D,
  rules: MeshTintRule[],
  cycle: TintSpec[],
): void {
  const meshes = collectMeshes(root);
  let cycleIndex = 0;
  for (const mesh of meshes) {
    const matched = rules.find((r) => r.nameMatch.test(mesh.name));
    const spec: TintSpec = matched
      ? {
          color: matched.color,
          metalness: matched.metalness,
          roughness: matched.roughness,
        }
      : cycle[cycleIndex % cycle.length]!;
    if (!matched) cycleIndex += 1;
    applySpecToMesh(mesh, spec);
  }
}

function bodySpecForTheme(theme: SceneThemeMode): TintSpec {
  return theme === "light"
    ? { color: 0x1f5f96, metalness: 0.35, roughness: 0.48 }
    : { color: 0xf2f2f2, metalness: 0.22, roughness: 0.52 };
}

function accentSpecForTheme(theme: SceneThemeMode): TintSpec {
  return theme === "light"
    ? { color: 0xff9933, metalness: 0.42, roughness: 0.45 }
    : { color: 0xffaa44, metalness: 0.4, roughness: 0.46 };
}

function logisticsModulePalette(theme: SceneThemeMode): {
  rules: MeshTintRule[];
  cycle: TintSpec[];
} {
  const body = bodySpecForTheme(theme);
  const accent = accentSpecForTheme(theme);
  return {
    rules: [
      {
        nameMatch: /chute|port|door|frame|trim|detail|stripe|panel/i,
        ...accent,
      },
      { nameMatch: /body|case|main|housing|base|platform|roof|wall/i, ...body },
    ],
    cycle: [body, accent, body, accent],
  };
}

/** Экстрактор: основание / рёбра / башня по ключевым словам в имени. */
const ALIEN_ENERGY_EXTRACTOR_RULES: MeshTintRule[] = [
  {
    nameMatch: /base|plate|floor|bottom|platform|ground|ring|gear|disc/i,
    color: 0x2a3542,
    metalness: 0.45,
    roughness: 0.55,
  },
  {
    nameMatch: /arm|leg|strut|support|beam|column|brace|frame/i,
    color: 0xa67c2d,
    metalness: 0.55,
    roughness: 0.42,
  },
  {
    nameMatch: /core|tower|drill|shaft|spindle|center|body|hub|motor/i,
    color: 0x7d8fa3,
    metalness: 0.5,
    roughness: 0.38,
  },
  {
    nameMatch: /tip|nozzle|cone|cap|sensor|antenna|detail/i,
    color: 0x1abc9c,
    metalness: 0.35,
    roughness: 0.48,
  },
];

const ALIEN_ENERGY_EXTRACTOR_CYCLE: TintSpec[] = [
  { color: 0x34495e, metalness: 0.42, roughness: 0.58 },
  { color: 0xc8a050, metalness: 0.52, roughness: 0.45 },
  { color: 0x8fa3b8, metalness: 0.48, roughness: 0.4 },
  { color: 0x1e8c7a, metalness: 0.38, roughness: 0.52 },
  { color: 0x6c5b7b, metalness: 0.44, roughness: 0.5 },
];

const SPLITTER_RULES: MeshTintRule[] = [
  {
    nameMatch: /chute|out|exit|diverge|branch|port|spout|shoot/i,
    color: 0xe67e22,
    metalness: 0.38,
    roughness: 0.52,
  },
  {
    nameMatch: /in|feed|entry|input|funnel|hopper/i,
    color: 0xd35400,
    metalness: 0.4,
    roughness: 0.5,
  },
  {
    nameMatch: /body|case|main|housing|frame|block|core|base/i,
    color: 0x2c3e50,
    metalness: 0.48,
    roughness: 0.48,
  },
  {
    nameMatch: /belt|roller|pipe|tube|rail|track/i,
    color: 0x95a5a6,
    metalness: 0.55,
    roughness: 0.42,
  },
  {
    nameMatch: /panel|lid|cover|door|glass|window/i,
    color: 0xf1c40f,
    metalness: 0.25,
    roughness: 0.35,
  },
];

const SPLITTER_CYCLE: TintSpec[] = [
  { color: 0x34495e, metalness: 0.45, roughness: 0.52 },
  { color: 0xe67e22, metalness: 0.36, roughness: 0.5 },
  { color: 0x7f8c8d, metalness: 0.5, roughness: 0.45 },
  { color: 0xf39c12, metalness: 0.32, roughness: 0.48 },
  { color: 0x16a085, metalness: 0.35, roughness: 0.55 },
  { color: 0xbdc3c7, metalness: 0.28, roughness: 0.4 },
];

const PIPE_BODY_SPEC: TintSpec = {
  color: 0xe0ac53,
  metalness: 0.42,
  roughness: 0.44,
  side: THREE.DoubleSide,
};

const PIPE_MK1_RULES: MeshTintRule[] = [
  { nameMatch: /^pipe_body$/i, ...PIPE_BODY_SPEC },
];
const PIPE_MK1_CYCLE: TintSpec[] = [PIPE_BODY_SPEC];

const PIPE_MK2_RULES: MeshTintRule[] = [
  { nameMatch: /^pipe_body$/i, ...PIPE_BODY_SPEC },
];
const PIPE_MK2_CYCLE: TintSpec[] = [PIPE_BODY_SPEC];

const THEME_PALETTE_BUILDINGS = new Set([
  "alien_energy_extractor",
  "loading_module",
  "unloading_module",
  "train_station",
]);

let activeSceneTheme: SceneThemeMode = "dark";

export function setPrefabPaletteTheme(theme: SceneThemeMode): void {
  activeSceneTheme = theme;
}

export function getPrefabPaletteTheme(): SceneThemeMode {
  return activeSceneTheme;
}

function resolvePalette(
  buildingId: string,
  theme: SceneThemeMode,
): { rules: MeshTintRule[]; cycle: TintSpec[] } | null {
  switch (buildingId) {
    case "train_station":
    case "loading_module":
    case "unloading_module":
      return logisticsModulePalette(theme);
    case "alien_energy_extractor":
      return {
        rules: ALIEN_ENERGY_EXTRACTOR_RULES,
        cycle: ALIEN_ENERGY_EXTRACTOR_CYCLE,
      };
    case "splitter":
    case "merger":
      return { rules: SPLITTER_RULES, cycle: SPLITTER_CYCLE };
    case "pipe_mk1":
    case "pipe_junction":
      return { rules: PIPE_MK1_RULES, cycle: PIPE_MK1_CYCLE };
    case "pipe_mk2":
      return { rules: PIPE_MK2_RULES, cycle: PIPE_MK2_CYCLE };
    default:
      return null;
  }
}

/**
 * Подмена материалов у клона префаба (после `clone(true)`).
 */
export function applyPrefabMaterialPalette(
  buildingId: string,
  root: THREE.Object3D,
  theme: SceneThemeMode = activeSceneTheme,
): void {
  const entry = resolvePalette(buildingId, theme);
  if (!entry) return;
  tintMeshesWithRulesAndCycle(root, entry.rules, entry.cycle);
}

export function hasThemeAwarePrefabPalette(buildingId: string): boolean {
  return THEME_PALETTE_BUILDINGS.has(buildingId);
}
