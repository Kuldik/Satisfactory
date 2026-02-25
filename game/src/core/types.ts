// ============================================================
// Core type definitions for the Satisfactory-like factory game
// ============================================================

/** 3D position in the game world (grid coordinates, 2m per unit) */
export interface GridPosition {
  x: number;
  y: number; // vertical (floor level)
  z: number;
}

/** Rotation: 0=North, 1=East, 2=South, 3=West (90° increments) */
export type Rotation = 0 | 1 | 2 | 3;

/** Unique entity identifier */
export type EntityId = number;

/** Chunk coordinate */
export interface ChunkCoord {
  cx: number;
  cz: number;
}

// ---- Resources & Items ----

export enum ResourceType {
  // Ores
  IronOre = 'iron_ore',
  CopperOre = 'copper_ore',
  Limestone = 'limestone',
  Sulfur = 'sulfur',
  Coal = 'coal',
  CateriumOre = 'caterium_ore',
  RawQuartz = 'raw_quartz',
  Bauxite = 'bauxite',
  Uranium = 'uranium',
  SAM = 'sam',
  // Liquids
  Water = 'water',
  CrudeOil = 'crude_oil',
  // Gas
  NitrogenGas = 'nitrogen_gas',
}

/** Node richness levels */
export enum NodePurity {
  Impure = 'impure',   // 1x
  Normal = 'normal',   // 2x
  Pure = 'pure',       // 3x
}

/** Item stack in inventory/container */
export interface ItemStack {
  itemId: string;
  amount: number;
}

// ---- Buildings ----

export enum BuildingCategory {
  Special = 'special',
  Production = 'production',
  Power = 'power',
  Logistics = 'logistics',
  Organization = 'organization',
}

export enum ConveyorTier {
  Mk1 = 1, // 60/min
  Mk2 = 2, // 120/min
  Mk3 = 3, // 270/min
  Mk4 = 4, // 480/min
  Mk5 = 5, // 780/min
  Mk6 = 6, // 1200/min
}

export const CONVEYOR_SPEEDS: Record<ConveyorTier, number> = {
  [ConveyorTier.Mk1]: 60,
  [ConveyorTier.Mk2]: 120,
  [ConveyorTier.Mk3]: 270,
  [ConveyorTier.Mk4]: 480,
  [ConveyorTier.Mk5]: 780,
  [ConveyorTier.Mk6]: 1200,
};

export enum PipeTier {
  Mk1 = 1, // 300 m³/min
  Mk2 = 2, // 600 m³/min
}

export const PIPE_FLOW_RATES: Record<PipeTier, number> = {
  [PipeTier.Mk1]: 300,
  [PipeTier.Mk2]: 600,
};

export enum MinerTier {
  Mk1 = 1,
  Mk2 = 2,
  Mk3 = 3,
}

export enum PowerPoleTier {
  Mk1 = 1, // 4 connections
  Mk2 = 2, // 7 connections
  Mk3 = 3, // 10 connections
}

export const POWER_POLE_CONNECTIONS: Record<PowerPoleTier, number> = {
  [PowerPoleTier.Mk1]: 4,
  [PowerPoleTier.Mk2]: 7,
  [PowerPoleTier.Mk3]: 10,
};

// Power line tower: 3 tower-to-tower + 4 pole connections, range 150m
export const POWER_LINE_TOWER = {
  towerConnections: 3,
  poleConnections: 4,
  range: 150, // meters
};

export const POWER_POLE_RANGE = 50; // meters

// ---- Power Shards (Energy Modules) ----

export const POWER_SHARD = {
  maxSlots: 3,
  bonusPerSlot: 0.5,  // +50%
  maxMultiplier: 2.5,  // 250%
};

// ---- Building Definition ----

export interface BuildingDefinition {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  category: BuildingCategory;
  /** Size in grid blocks (2m each) */
  sizeX: number;
  sizeZ: number;
  sizeY: number; // height in blocks
  /** Power consumption in MW (negative = produces power) */
  powerConsumption: number;
  /** Conveyor input ports */
  conveyorInputs: number;
  /** Conveyor output ports */
  conveyorOutputs: number;
  /** Pipe input ports */
  pipeInputs: number;
  /** Pipe output ports */
  pipeOutputs: number;
  /** 3D model asset path */
  modelPath?: string;
  /** Icon path */
  iconPath?: string;
  /** Whether it requires power to operate */
  requiresPower: boolean;
  /** Unlocked by milestone ID */
  unlockedBy?: string;
}

// ---- Recipes ----

export interface RecipeIngredient {
  itemId: string;
  amount: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  nameRu: string;
  /** Manufacturing duration in seconds */
  duration: number;
  /** Which building produces this */
  producedIn: string;
  ingredients: RecipeIngredient[];
  products: RecipeIngredient[];
  /** Is this an alternate recipe */
  isAlternate: boolean;
}

// ---- Milestones ----

export interface MilestoneDefinition {
  id: string;
  name: string;
  nameRu: string;
  tier: number;
  /** Cost to unlock */
  cost: RecipeIngredient[];
  /** Time to complete in seconds */
  timeToComplete: number;
  /** Recipes unlocked */
  unlockedRecipes: string[];
  /** Buildings unlocked */
  unlockedBuildings: string[];
  /** Schematics/scanners unlocked */
  unlockedScanners: string[];
}

// ---- Save Data ----

export interface SaveData {
  version: number;
  timestamp: number;
  checksum: string;
  gameTime: number;
  /** All placed entities */
  entities: SavedEntity[];
  /** Player inventory */
  inventory: Record<string, number>;
  /** Unlocked milestones */
  unlockedMilestones: string[];
  /** Unlocked recipes */
  unlockedRecipes: string[];
  /** Current milestone progress */
  milestoneProgress: Record<string, number>;
  /** Camera position */
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
}

export interface SavedEntity {
  id: EntityId;
  type: string;
  position: GridPosition;
  rotation: Rotation;
  /** Building-specific state */
  state?: Record<string, unknown>;
}

// ---- Game State ----

export enum GameMode {
  Playing = 'playing',
  BuildMode = 'build_mode',
  Menu = 'menu',
  Tutorial = 'tutorial',
}

export interface GameState {
  mode: GameMode;
  selectedBuilding: string | null;
  selectedEntity: EntityId | null;
  currentFloor: number;
  isPaused: boolean;
  gameTime: number; // seconds since game start
}
