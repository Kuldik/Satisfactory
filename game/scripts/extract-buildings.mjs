import fs from "fs";

const src = fs.readFileSync("src/ui/menus/BuildMenu.tsx", "utf8");
const start = src.indexOf("const ALL_BUILDINGS");
const end = src.indexOf("];", start);
const block = src.slice(start, end);

const entryRe = /\{\s*id:\s*'([^']+)'([\s\S]*?)(?=\n\s*\{|\n\s*\];)/g;
const items = [];
let m;
while ((m = entryRe.exec(block))) {
  const body = m[2];
  const id = m[1];
  const pick = (key) => {
    const r = new RegExp(`${key}:\\s*'((?:\\\\'|[^'])*)'`);
    const hit = r.exec(body);
    return hit ? hit[1].replace(/\\'/g, "'") : undefined;
  };
  const cat = /category:\s*BuildingCategory\.(\w+)/.exec(body)?.[1];
  const name = pick("name");
  const nameRu = pick("nameRu");
  const subcategory = pick("subcategory");
  const description = pick("description");
  const modelPath = pick("modelPath");
  const iconPath = pick("iconPath");
  if (!name || !nameRu || !subcategory || !description || !cat) continue;
  items.push({
    id,
    category: cat,
    name,
    nameRu,
    subcategory,
    description,
    ...(modelPath ? { modelPath } : {}),
    ...(iconPath ? { iconPath } : {}),
  });
}

console.log("count", items.length);
fs.writeFileSync(
  "src/i18n/_extracted-buildings.json",
  JSON.stringify(items, null, 2),
);
