/**
 * One-off generator: литейная (foundry) — статические детали из JSON + сетка колонн wall-pillar-banner.
 * Run: node scripts/build-foundry-json.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const B = "/kits/kenney_building-kit/Models/GLB format/";
const S = "/kits/kenney_space-station-kit/Models/GLB format/";

const M = {
  "floor.glb": `${B}floor.glb`,
  "wall.glb": `${B}wall.glb`,
  "wall-half.glb": `${B}wall-half.glb`,
  "wall-doorway-wide-square.glb": `${B}wall-doorway-wide-square.glb`,
  "gutter-vertical-wall.glb": `${B}gutter-vertical-wall.glb`,
  "detail-pipe.glb": `${B}detail-pipe.glb`,
  /* Тот же ключ, что в админке «Пилон баннер» — Kenney space-station kit */
  "wall-pillar-banner.glb": `${S}wall-pillar-banner.glb`,
  "roof-flat-square.glb": `${B}roof-flat-square.glb`,
  "plating-detailed-wide.glb": `${B}plating-detailed-wide.glb`,
  "structure.glb": `${S}structure.glb`,
  "computer.glb": `${S}computer.glb`,
  "computer-wide.glb": `${S}computer-wide.glb`,
  "computer-system.glb": `${S}computer-system.glb`,
};

function mapPart(p) {
  const n = p.partName;
  if (n.includes("/")) return p;
  const path = M[n];
  if (!path) throw new Error(`Unknown partName: ${n}`);
  return { ...p, partName: path };
}

/** 7×4 z-ряда × 3 высоты = 84 колонны (как в экспорте пользователя) */
function pillarParts() {
  const xs = [10.426, 7.426, 4.426, 1.426, -1.574, -4.574, -7.574];
  const zsA = [-7.205, -5.705];
  const zsB = [-4.205, -2.705];
  const ys = [7.08, 10.08, 13.08];
  const out = [];
  for (const y of ys) {
    for (const z of zsA) {
      for (const x of xs) {
        out.push({
          partName: "wall-pillar-banner.glb",
          position: { x, y, z },
          rotationY: 0,
          scale: 3,
        });
      }
    }
    for (const z of zsB) {
      for (const x of xs) {
        out.push({
          partName: "wall-pillar-banner.glb",
          position: { x, y, z },
          rotationY: 0,
          scale: 3,
        });
      }
    }
  }
  return out;
}

const beforePillars = [
  { partName: "floor.glb", position: { x: -13.574, y: 0, z: -5.205 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: -13.574, y: 0, z: 2.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: -13.574, y: 0, z: 10.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: -5.574, y: 0, z: -5.205 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 2.426, y: 0, z: -5.205 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 10.426, y: 0, z: -5.205 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 10.426, y: 0, z: 10.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 2.426, y: 0, z: 10.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: -5.574, y: 0, z: 10.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 10.426, y: 0, z: 2.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: 2.426, y: 0, z: 2.795 }, rotationY: 0, scale: 4 },
  { partName: "floor.glb", position: { x: -5.574, y: 0, z: 2.795 }, rotationY: 0, scale: 4 },
  {
    partName: "wall-doorway-wide-square.glb",
    position: { x: -17.874, y: 0, z: -3.205 },
    rotationY: 0,
    scale: 3,
  },
  {
    partName: "wall-doorway-wide-square.glb",
    position: { x: -17.874, y: 0, z: 8.795 },
    rotationY: 0,
    scale: 3,
  },
  { partName: "wall.glb", position: { x: -15.174, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: -9.174, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: -3.174, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: 2.826, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: 8.826, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall-half.glb", position: { x: 13.326, y: 0, z: 14.945 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: 14.976, y: 0, z: 12.095 }, rotationY: 0, scale: 3 },
  { partName: "wall.glb", position: { x: 14.976, y: 0, z: 6.095 }, rotationY: 0, scale: 3 },
  {
    partName: "wall-doorway-wide-square.glb",
    position: { x: 14.976, y: 0, z: -2.905 },
    rotationY: 0,
    scale: 3,
  },
  { partName: "wall.glb", position: { x: -15.174, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: -9.174, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: -3.174, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: 2.826, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall.glb", position: { x: 8.826, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "wall-half.glb", position: { x: 13.326, y: 0, z: -9.355 }, rotationY: 1.5708, scale: 3 },
  { partName: "gutter-vertical-wall.glb", position: { x: 15.289, y: 0, z: -9.968 }, rotationY: 0, scale: 3 },
  { partName: "gutter-vertical-wall.glb", position: { x: 16.213, y: 0, z: -9.043 }, rotationY: 0, scale: 3 },
  { partName: "structure.glb", position: { x: 8.826, y: 0.4, z: -6.255 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 8.826, y: 0.4, z: -0.355 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 8.826, y: 0.4, z: 5.545 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 8.826, y: 0.4, z: 11.445 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 2.826, y: 0.4, z: -6.255 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 2.826, y: 0.4, z: -0.355 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 2.826, y: 0.4, z: 5.545 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: 2.826, y: 0.4, z: 11.445 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -3.074, y: 0.4, z: -6.255 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -3.074, y: 0.4, z: -0.355 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -3.074, y: 0.4, z: 5.545 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -3.074, y: 0.4, z: 11.445 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -8.974, y: 0.4, z: -6.255 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -8.974, y: 0.4, z: -0.355 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -8.974, y: 0.4, z: 5.545 }, rotationY: 0, scale: 5.9 },
  { partName: "structure.glb", position: { x: -8.974, y: 0.4, z: 11.445 }, rotationY: 0, scale: 5.9 },
  { partName: "floor.glb", position: { x: 10.426, y: 6.3, z: -5.105 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.626, y: 6.3, z: -5.105 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.174, y: 6.3, z: -5.105 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -12.974, y: 6.3, z: -5.105 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 10.426, y: 6.3, z: 2.695 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.626, y: 6.3, z: 2.695 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.174, y: 6.3, z: 2.695 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -12.974, y: 6.3, z: 2.695 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 10.426, y: 6.3, z: 10.495 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.626, y: 6.3, z: 10.495 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.174, y: 6.3, z: 10.495 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -12.974, y: 6.3, z: 10.495 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -13.474, y: 6.69, z: 10.795 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.674, y: 6.69, z: 10.795 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.126, y: 6.69, z: 10.795 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 9.926, y: 6.69, z: 10.795 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 9.926, y: 6.69, z: 2.995 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 9.926, y: 6.69, z: -4.805 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.126, y: 6.69, z: 2.995 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.674, y: 6.69, z: 2.995 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -13.474, y: 6.69, z: 2.995 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: 2.126, y: 6.69, z: -4.805 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -5.674, y: 6.69, z: -4.805 }, rotationY: 0, scale: 3.9 },
  { partName: "floor.glb", position: { x: -13.474, y: 6.69, z: -4.805 }, rotationY: 0, scale: 3.9 },
  {
    partName: "detail-pipe.glb",
    position: { x: -15.574, y: 7.08, z: -7.205 },
    rotationY: 0,
    scale: 7.8,
  },
  {
    partName: "gutter-vertical-wall.glb",
    position: { x: 14.426, y: 7.2, z: 14.795 },
    rotationY: 0,
    scale: 3,
  },
];

const afterPillars = [
  {
    partName: "roof-flat-square.glb",
    position: { x: -13.474, y: 7.08, z: 10.726 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: -5.811, y: 7.08, z: 10.726 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: 1.851, y: 7.08, z: 10.726 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: 9.514, y: 7.08, z: 10.726 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: -13.542, y: 7.08, z: 2.926 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: -5.88, y: 7.08, z: 2.926 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: 1.783, y: 7.08, z: 2.926 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "roof-flat-square.glb",
    position: { x: 9.445, y: 7.08, z: 2.926 },
    rotationY: 0,
    scale: 3.2,
  },
  {
    partName: "plating-detailed-wide.glb",
    position: { x: 17.826, y: 14.4, z: 14.945 },
    rotationY: 1.5708,
    scale: 3,
  },
  { partName: "floor.glb", position: { x: -15.174, y: 0, z: 18.095 }, rotationY: 0, scale: 3 },
  { partName: "floor.glb", position: { x: -9.174, y: 0, z: 18.095 }, rotationY: 0, scale: 3 },
  { partName: "computer.glb", position: { x: -15.174, y: 0.3, z: 16.256 }, rotationY: 0, scale: 5.3 },
  {
    partName: "computer-wide.glb",
    position: { x: -12.474, y: 0.3, z: 16.256 },
    rotationY: 6.2832,
    scale: 4.1,
  },
  { partName: "computer.glb", position: { x: -9.714, y: 0.3, z: 16.389 }, rotationY: 0, scale: 5.6 },
  {
    partName: "computer-system.glb",
    position: { x: -17.276, y: 0.3, z: 16.445 },
    rotationY: 4.7124,
    scale: 3,
  },
];

const merged = [
  ...beforePillars.map(mapPart),
  ...pillarParts().map(mapPart),
  ...afterPillars.map(mapPart),
];

const out = join(root, "src/buildings/production/foundry.json");
writeFileSync(out, JSON.stringify({ parts: merged }, null, 2));
console.log("Wrote", out, merged.length, "parts");
