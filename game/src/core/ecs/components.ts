// ============================================================
// ECS Components — bitECS component definitions
// ============================================================

import { defineComponent, Types } from 'bitecs';

// ---- Transform ----
/** Position on the grid (in grid cells, not world units) */
export const Position = defineComponent({
  x: Types.i32,
  y: Types.i32, // floor/level
  z: Types.i32,
});

/** Rotation (0-3, 90° increments) */
export const Rotation = defineComponent({
  value: Types.ui8, // 0=N, 1=E, 2=S, 3=W
});

// ---- Building ----
/** Building type identifier (index into building registry) */
export const Building = defineComponent({
  typeId: Types.ui16,
  sizeX: Types.ui8,
  sizeZ: Types.ui8,
  sizeY: Types.ui8,
});

// ---- Production ----
/** Machine that produces items from a recipe */
export const Producer = defineComponent({
  recipeId: Types.ui16,       // current recipe index
  progress: Types.f32,        // 0.0 to 1.0
  speedMultiplier: Types.f32, // 1.0 = 100%, up to 2.5
  powerShards: Types.ui8,     // 0-3 inserted power shards
  isActive: Types.ui8,        // 0 = inactive, 1 = active
});

// ---- Conveyor ----
/** A conveyor belt segment */
export const Conveyor = defineComponent({
  tier: Types.ui8,           // 1-6
  speedItemsPerMin: Types.ui16,
  itemSlots: Types.ui8,     // how many items can fit on this segment
});

/** A conveyor lift */
export const ConveyorLift = defineComponent({
  tier: Types.ui8,
  bottomY: Types.i32,
  topY: Types.i32,
});

// ---- Pipes ----
/** A pipe segment for liquids/gases */
export const Pipe = defineComponent({
  tier: Types.ui8,           // 1-2
  flowRate: Types.ui16,      // m³/min max capacity
  currentFlow: Types.f32,   // current flow rate
  contentType: Types.ui16,   // what fluid/gas is inside
});

// ---- Power ----
/** Something that consumes power */
export const PowerConsumer = defineComponent({
  basePowerMW: Types.f32,   // base power consumption
  currentPowerMW: Types.f32, // actual consumption (with clock speed)
  networkId: Types.ui32,     // which power network this belongs to
});

/** Something that generates power */
export const PowerGenerator = defineComponent({
  basePowerMW: Types.f32,    // base power generation
  currentPowerMW: Types.f32, // actual generation
  networkId: Types.ui32,
  fuelType: Types.ui16,      // what fuel it uses
  fuelRemaining: Types.f32,  // fuel time remaining in seconds
});

/** Power pole / distribution */
export const PowerPole = defineComponent({
  tier: Types.ui8,
  maxConnections: Types.ui8,
  currentConnections: Types.ui8,
  networkId: Types.ui32,
  range: Types.f32,
});

/** Power storage (accumulator) */
export const PowerStorage = defineComponent({
  capacity: Types.f32,       // MWh
  stored: Types.f32,         // current stored MWh
  networkId: Types.ui32,
});

// ---- Inventory ----
/** Has an inventory (storage, machine buffer, etc.) */
export const Inventory = defineComponent({
  slotCount: Types.ui16,
  usedSlots: Types.ui16,
});

// ---- Mining ----
/** A miner placed on a resource node */
export const Miner = defineComponent({
  tier: Types.ui8,           // 1-3
  resourceType: Types.ui16,  // what resource it mines
  nodePurity: Types.ui8,     // 0=impure, 1=normal, 2=pure
  outputPerMin: Types.f32,   // calculated output
});

// ---- Resource Node ----
/** A resource node on the map */
export const ResourceNode = defineComponent({
  resourceType: Types.ui16,
  purity: Types.ui8,         // 0=impure, 1=normal, 2=pure
  isOccupied: Types.ui8,     // 0=free, 1=has miner
});

// ---- Fluid Extractor ----
export const FluidExtractor = defineComponent({
  fluidType: Types.ui16,
  outputPerMin: Types.f32,
});

// ---- Splitter/Merger ----
export const Splitter = defineComponent({
  type: Types.ui8, // 0=basic, 1=smart, 2=programmable
  outputCount: Types.ui8,
});

export const Merger = defineComponent({
  inputCount: Types.ui8,
});

// ---- Connection ports ----
/** Defines the I/O connections of a building */
export const ConnectionPorts = defineComponent({
  conveyorInputs: Types.ui8,
  conveyorOutputs: Types.ui8,
  pipeInputs: Types.ui8,
  pipeOutputs: Types.ui8,
});

// ---- Sign ----
export const Sign = defineComponent({
  width: Types.f32,
  height: Types.f32,
  // Text content stored separately in a Map<entityId, SignData>
});

// ---- Alien Energy Extractor ----
export const AlienExtractor = defineComponent({
  basePowerMW: Types.f32,
  bonusPercent: Types.f32,
  networkId: Types.ui32,
});

// ---- Sawmill ----
export const Sawmill = defineComponent({
  woodOutputRate: Types.f32,
  grassOutputRate: Types.f32,
});

// ---- HUB / Space Elevator ----
export const ProgressionBuilding = defineComponent({
  type: Types.ui8, // 0=HUB, 1=SpaceElevator
  currentPhase: Types.ui8,
});

// ---- Render reference ----
/** Links an ECS entity to a Three.js object */
export const RenderObject = defineComponent({
  meshId: Types.ui32, // index into mesh pool
});

// ---- Tags ----
export const NeedsPower = defineComponent();
export const IsPlaced = defineComponent();
export const NeedsUpdate = defineComponent();
