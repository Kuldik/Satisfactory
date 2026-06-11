import fs from "fs";

const items = JSON.parse(
  fs.readFileSync("src/i18n/_extracted-buildings.json", "utf8"),
);

/** English descriptions (base locale). */
const EN_DESC = {
  hub: "Central factory building. Unlocks technologies through Milestones. Has 6 conveyor inputs for automatic resource delivery.",
  space_elevator:
    "Massive structure for global progression. Delivering special parts (Smart Plating, Versatile Framework, etc.) unlocks new tech tiers. 5 phases total.",
  resource_sink:
    "Destroys any items (except nuclear waste) and awards AWESOME Shop coupons. Ideal for disposing of production surplus. Consumes 30 MW.",
  sawmill:
    "First production building. Passively produces wood and leaves — infinite biomass for the biomass burner. One shared conveyor output. No power required.",
  constructor:
    "Basic production machine. Takes one input item type and outputs one item type. Used for simple recipes: iron plates, wire, screws, etc. Consumes 4 MW.",
  assembler:
    "Combines two item types into one. 2 conveyor inputs, 1 output. Produces intermediate parts: reinforced plates, rotors, modular frames, etc. Consumes 15 MW.",
  manufacturer:
    "Advanced machine for complex 3–4 ingredient recipes. 4 conveyor inputs, 1 output. Produces computers, heavy modular frames, turbomotors, etc. Consumes 55 MW.",
  packager:
    "Packages fluids/gases into containers for belt transport, or unpacks them. 1 conveyor in/out + 1 pipe in/out. Consumes 10 MW.",
  refinery:
    "Processes oil into plastic, rubber, fuel; bauxite into aluminum; and more. 1 conveyor + 1 pipe in, 1 conveyor + 1 pipe out. Consumes 30 MW.",
  blender:
    "Mixes solids with fluids/gases for advanced resources. 2 conveyor + 2 pipe inputs, 1 conveyor + 1 pipe output. Consumes 75 MW.",
  particle_accelerator:
    "Powerful facility for nuclear pasta, plutonium rods, and ficsonium. 2 conveyor inputs + 1 pipe, 1 conveyor output. Power draw: 250–1500 MW.",
  converter:
    "Converts one material into another using SAM and other resources. 1 conveyor and 1 pipe in/out. Consumes 100 MW.",
  quantum_encoder:
    "Most complex and expensive production machine. Uses excited photonic energy from the converter for end-game components. 1 conveyor output. Power: 0–2000 MW.",
  miner_mk1:
    "Basic miner. Placed on resource nodes. Rates: impure 30/min, normal 60/min, pure 120/min. 1 conveyor output. Consumes 5 MW.",
  miner_mk2:
    "Improved miner with double extraction rate. Impure 60/min, normal 120/min, pure 240/min. 1 conveyor output. Consumes 12 MW.",
  miner_mk3:
    "Maximum-tier miner with triple extraction rate. Impure 120/min, normal 240/min, pure 480/min. 1 conveyor output. Consumes 30 MW.",
  water_extractor:
    "Extracts water from water bodies and sends it through pipes. Output 120 m³/min. 1 pipe output. Consumes 20 MW.",
  oil_extractor:
    "Placed on oil nodes to extract crude oil. Output depends on node purity. 1 pipe output. Consumes 40 MW.",
  pressure_booster:
    "Placed on resource wells to pressurize water or nitrogen extraction. Activates nearby well extractors. Consumes 150 MW.",
  well_extractor:
    "Placed on activated wells around a pressurizer. Extracts water or nitrogen. 1 pipe output. 0 MW (powered by pressurizer).",
  smelter:
    "Basic smelter for one ore type into ingots. Iron ore → iron ingots, copper ore → copper ingots, etc. 1 in, 1 out. Consumes 4 MW.",
  foundry:
    "Combines two ore/ingot types into alloys. Produces steel (iron + coal), aluminum ingots, etc. 2 inputs, 1 output. Consumes 16 MW.",
  biomass_burner:
    "First generator after the sawmill. Burns wood or leaves (120 leaves/min or 30 wood/min → 30 MW). Stops without fuel. 1 conveyor input.",
  coal_generator:
    "Coal-fired generator. Heats water into steam for power. 1 conveyor input (coal) + 1 pipe input (water). Outputs 75 MW.",
  fuel_generator:
    "Runs on liquid fuel, turbo fuel, or rocket fuel from oil processing. 1 pipe input. Outputs 250 MW.",
  nuclear_power:
    "Massive nuclear plant. Runs on uranium/plutonium/ficsonium rods + water. Produces nuclear waste (except ficsonium). 1 belt + 1 pipe in, waste out. 2500 MW.",
  alien_extractor:
    "Advanced power source. Static 500 MW. Main bonus: +30% to entire connected grid. Multiple extractors stack +30% each from base power.",
  alien_energy_extractor:
    "Same role as the kit extractor, but uses the separate `energy extractor.glb` model. Legacy menu entry kept.",
  power_pole_mk1:
    "Basic power pole. Connect up to 4 devices (including other poles). Connection range 50 m.",
  power_pole_mk2:
    "Improved pole. Connect up to 7 devices. Range 50 m.",
  power_pole_mk3:
    "Maximum pole. Connect up to 10 devices. Range 50 m.",
  power_tower:
    "Power transmission tower. Long-range links: 3 tower connections (150 m) + 4 pole connections.",
  power_storage:
    "Stores surplus power and releases it during peaks. Prevents blackouts from demand spikes. Capacity 100 MW·h.",
  conveyor_mk1:
    "Basic belt. Moves items at 60 items/min. No power. R — placement mode (straight / L-turn / curve).",
  conveyor_mk2: "Improved belt. 120 items/min. No power.",
  conveyor_mk3: "Advanced belt. 270 items/min. No power.",
  conveyor_mk4: "High-speed belt. 480 items/min. No power.",
  conveyor_mk5: "Very high-speed belt. 780 items/min. No power.",
  conveyor_mk6: "Maximum belt speed. 1200 items/min. No power.",
  throughput_monitor:
    "Mounted on a belt. Measures items/min and shows stats. No power. UI-only element.",
  splitter:
    "Splits one belt into 2 or 3 outputs. Items distributed evenly. 1 input, up to 3 outputs.",
  merger:
    "Merges 2–3 belts into one. Up to 3 inputs, 1 output. Items alternate from each input.",
  pipe_mk1:
    "Basic pipeline for fluids and gases. Capacity 300 m³/min. No power.",
  pipe_mk2: "Improved pipeline. 600 m³/min. No power.",
  railroad_track:
    "Railway tracks for train routes. Supports straights, curves, grades.",
  train_station:
    "Train stop platform. Load/unload items via conveyor ports. Schedule configurable.",
  locomotive:
    "Train engine. Powered from grid via rails. Each train needs at least one. Consumes 25 MW.",
  freight_car:
    "Freight car for solid items by rail. Capacity 32 stacks. Couples to locomotive.",
  fluid_freight_car:
    "Tank car for fluids/gases by rail. Capacity 2400 m³. Couples to locomotive.",
  storage_small:
    "Stores up to 24 item stacks. 1 conveyor in/out. Buffer between production lines.",
  storage_large:
    "Stores up to 48 stacks. 2 conveyor inputs and 2 outputs. Mass storage.",
  fluid_buffer:
    "Buffer for fluids/gases. Capacity 400 m³. Pipe ports in and out.",
  fluid_buffer_large:
    "Large fluid buffer. Capacity 2400 m³. For big fluid networks.",
  loading_module:
    "Takes items from belt into infinite player storage. 1 conveyor input. No speed limit.",
  unloading_module:
    "Unloads selected item from infinite storage onto belt. 1 conveyor output. Pick item in UI.",
};

const SUBCATEGORY_KEYS = {
  "Особые строения": "specialStructures",
  "Автоматическая добыча": "autoMining",
  "Производство деталей": "partsProduction",
  "Добыча ресурсов": "resourceMining",
  Экстракторы: "extractors",
  Переплавка: "smelting",
  Генераторы: "generators",
  "Подача энергии": "powerDistribution",
  "Накопление энергии": "powerStorage",
  Конвейеры: "conveyors",
  "Управление конвейерами": "conveyorManagement",
  Трубопроводы: "pipelines",
  "Железнодорожное сообщение": "railroad",
  "Складирование предметов": "itemStorage",
  "Хранение жидкостей": "fluidStorage",
  "Модули склада": "storageModules",
};

const en = {};
const ru = {};
const meta = [];

for (const item of items) {
  const subKey = SUBCATEGORY_KEYS[item.subcategory] ?? item.subcategory;
  meta.push({
    id: item.id,
    category: item.category,
    subcategoryKey: subKey,
    ...(item.modelPath ? { modelPath: item.modelPath } : {}),
    ...(item.iconPath ? { iconPath: item.iconPath } : {}),
  });
  en[item.id] = {
    name: item.name,
    description:
      EN_DESC[item.id] ??
      `${item.name}. Factory building.`,
  };
  ru[item.id] = { name: item.nameRu, description: item.description };
}

const out = `// Auto-generated — do not edit by hand. Run: node scripts/generate-building-locales.mjs
export const BUILDING_META = ${JSON.stringify(meta, null, 2)} as const;

export const BUILDINGS_EN = ${JSON.stringify(en, null, 2)} as const;

export const BUILDINGS_RU = ${JSON.stringify(ru, null, 2)} as const;
`;

fs.writeFileSync("src/i18n/buildings.generated.ts", out);
console.log("Wrote buildings.generated.ts", items.length, "buildings");
