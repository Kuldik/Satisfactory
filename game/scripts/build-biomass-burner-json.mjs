/**
 * Генерация biomass_burner.json из коротких имён (экспорт конструктора).
 * Запуск: node scripts/build-biomass-burner-json.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const B = "/kits/kenney_building-kit/Models/GLB format";
const S = "/kits/kenney_space-station-kit/Models/GLB format";

const inBuilding = new Set([
  "floor-corner-diagonal.glb",
  "floor-half.glb",
  "border-corner-diagonal.glb",
  "roof-flat-square.glb",
  "detail-pipe.glb",
  "gutter-vertical-wall.glb",
  "gutter-vertical-top.glb",
]);

/** Данные из экспорта пользователя (как в JSON). */
const rawParts = [
  { partName: "floor-corner-diagonal.glb", position: { x: 5.208, y: 0, z: 6.178 }, rotationY: 0, scale: 3 },
  { partName: "floor-half.glb", position: { x: -6.792, y: 0, z: 4.678 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -0.792, y: 0, z: 4.678 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: 5.208, y: 0, z: 1.678 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -0.792, y: 0, z: 1.678 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -6.792, y: 0, z: 1.678 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-corner-diagonal.glb", position: { x: 5.208, y: 0, z: -2.822 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -0.792, y: 0, z: -4.322 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -0.792, y: 0, z: -1.322 }, rotationY: 1.5708, scale: 3 },
  { partName: "floor-half.glb", position: { x: -6.792, y: 0, z: -4.322 }, rotationY: 1.5708, scale: 3 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 0.3, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 0.3, z: -1.842 }, rotationY: 7.854, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 0.3, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 0.3, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 0.78, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 1.26, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 1.74, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 1.74, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 2.22, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 2.7, z: 1.678 }, rotationY: 0, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 0.78, z: -1.842 }, rotationY: 1.5708, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 1.26, z: -1.842 }, rotationY: 1.5708, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 1.74, z: -1.842 }, rotationY: 1.5708, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 2.22, z: -1.842 }, rotationY: 1.5708, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 3.968, y: 2.7, z: -1.842 }, rotationY: 1.5708, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 0.78, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 1.26, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 1.74, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 1.74, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 2.22, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 2.7, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 0.78, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 0.78, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 1.26, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 1.74, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 2.22, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "border-corner-diagonal.glb", position: { x: 0.448, y: 2.7, z: 1.678 }, rotationY: 4.7124, scale: 1.6 },
  { partName: "floor-corner-diagonal.glb", position: { x: 3.908, y: 3.18, z: 1.678 }, rotationY: 6.2832, scale: 1.7 },
  { partName: "floor-corner-diagonal.glb", position: { x: 0.508, y: 3.18, z: 1.678 }, rotationY: 10.9956, scale: 1.7 },
  { partName: "floor-corner-diagonal.glb", position: { x: 3.908, y: 3.18, z: -1.842 }, rotationY: 1.5708, scale: 1.7 },
  { partName: "floor-corner-diagonal.glb", position: { x: 0.608, y: 3.18, z: -1.842 }, rotationY: 3.1416, scale: 1.6 },
  { partName: "roof-flat-square.glb", position: { x: 3.764, y: 3.35, z: 1.678 }, rotationY: 0, scale: 1.3 },
  { partName: "roof-flat-square.glb", position: { x: 0.651, y: 3.35, z: 1.678 }, rotationY: 0, scale: 1.3 },
  { partName: "roof-flat-square.glb", position: { x: 3.764, y: 3.35, z: -1.842 }, rotationY: 0, scale: 1.3 },
  { partName: "roof-flat-square.glb", position: { x: 0.651, y: 3.34, z: -1.842 }, rotationY: 0, scale: 1.3 },
  { partName: "detail-pipe.glb", position: { x: 0.651, y: 3.86, z: -1.094 }, rotationY: 0, scale: 5.6 },
  { partName: "detail-pipe.glb", position: { x: 3.083, y: 3.87, z: -1.094 }, rotationY: 0, scale: 5.6 },
  { partName: "floor-half.glb", position: { x: -6.792, y: 0, z: -1.322 }, rotationY: 1.5708, scale: 3 },
  { partName: "rail.glb", position: { x: 3.508, y: 0, z: 9.308 }, rotationY: 0, scale: 2.6 },
  { partName: "rail.glb", position: { x: 8.078, y: 0.3, z: 4.478 }, rotationY: 4.7124, scale: 2.6 },
  { partName: "rail.glb", position: { x: 8.078, y: 0.3, z: 1.878 }, rotationY: 4.7124, scale: 2.6 },
  { partName: "rail.glb", position: { x: 8.078, y: 0.3, z: -0.722 }, rotationY: 4.7124, scale: 2.6 },
  { partName: "rail.glb", position: { x: 3.208, y: 0, z: -6.322 }, rotationY: 6.2832, scale: 2.6 },
  { partName: "rail.glb", position: { x: 0.608, y: 0, z: -6.322 }, rotationY: 6.2832, scale: 2.6 },
  { partName: "rail.glb", position: { x: -1.992, y: 0, z: -6.322 }, rotationY: 6.2832, scale: 2.6 },
  { partName: "rail.glb", position: { x: -4.592, y: 0, z: -6.322 }, rotationY: 6.2832, scale: 2.6 },
  { partName: "rail.glb", position: { x: -7.192, y: 0, z: -6.322 }, rotationY: 6.2832, scale: 2.6 },
  { partName: "rail.glb", position: { x: -9.922, y: 0, z: -4.322 }, rotationY: 1.5708, scale: 2.6 },
  { partName: "rail.glb", position: { x: -9.922, y: 0, z: -1.722 }, rotationY: 1.5708, scale: 2.6 },
  { partName: "rail.glb", position: { x: -9.922, y: 0, z: 0.878 }, rotationY: 1.5708, scale: 2.6 },
  { partName: "rail.glb", position: { x: -9.922, y: 0, z: 3.478 }, rotationY: 1.5708, scale: 2.6 },
  { partName: "rail.glb", position: { x: -8.492, y: 0, z: 6.308 }, rotationY: 0, scale: 2.6 },
  { partName: "rail.glb", position: { x: -5.892, y: 0, z: 6.308 }, rotationY: 0, scale: 2.6 },
  { partName: "wall-door-wide-banner.glb", position: { x: -0.792, y: 0, z: 6.853 }, rotationY: 0, scale: 4.5 },
  { partName: "wall-detail.glb", position: { x: -1.912, y: 0.3, z: -4.322 }, rotationY: 0, scale: 9.4 },
  { partName: "container.glb", position: { x: -3.612, y: 0.3, z: 1.678 }, rotationY: 0, scale: 8 },
  { partName: "gutter-vertical-wall.glb", position: { x: -8.955, y: 0, z: -6.322 }, rotationY: 0, scale: 3 },
  { partName: "gutter-vertical-wall.glb", position: { x: 5.208, y: 0, z: -6.284 }, rotationY: 0, scale: 3 },
  { partName: "gutter-vertical-top.glb", position: { x: -8.732, y: 0.3, z: -4.322 }, rotationY: 0, scale: 10 },
  { partName: "gutter-vertical-top.glb", position: { x: -8.732, y: 0.3, z: -1.322 }, rotationY: 3.1416, scale: 10 },
  { partName: "computer-system.glb", position: { x: 3.508, y: 0.3, z: 8.136 }, rotationY: 0, scale: 3 },
  { partName: "computer.glb", position: { x: -8.732, y: 0.3, z: 0.836 }, rotationY: 0, scale: 3 },
  { partName: "display-wall.glb", position: { x: 0.651, y: 3.35, z: 3.811 }, rotationY: 0, scale: 3 },
  { partName: "display-wall.glb", position: { x: 3.764, y: 3.35, z: 3.811 }, rotationY: 0, scale: 3 },
];

const parts = rawParts.map((p) => {
  const dir = inBuilding.has(p.partName) ? B : S;
  return { ...p, partName: `${dir}/${p.partName}` };
});

const outDir = join(root, "src/buildings/power");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "biomass_burner.json");
writeFileSync(out, JSON.stringify({ parts }, null, 2));
console.log("Wrote", out, parts.length, "parts");
