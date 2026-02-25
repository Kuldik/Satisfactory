// ============================================================
// Game constants
// ============================================================

/** Grid cell size in meters */
export const GRID_CELL_SIZE = 2;

/** Chunk size in grid cells */
export const CHUNK_SIZE = 32;

/** Chunk size in world units (meters) */
export const CHUNK_WORLD_SIZE = CHUNK_SIZE * GRID_CELL_SIZE; // 64m

/** Render distance in chunks */
export const RENDER_DISTANCE = 5;

/** Simulation distance in chunks (render + 1 buffer) */
export const SIMULATION_DISTANCE = RENDER_DISTANCE + 1;

/** Auto-save interval in milliseconds */
export const AUTOSAVE_INTERVAL = 10 * 60 * 1000; // 10 minutes

/** Maximum save slots for rotation */
export const MAX_SAVE_SLOTS = 5;

/** Save data version */
export const SAVE_VERSION = 1;

/** Simulation tick rate (ticks per second) */
export const TICK_RATE = 30;

/** Simulation tick interval in milliseconds */
export const TICK_INTERVAL = 1000 / TICK_RATE;

/** Camera settings */
export const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 2000,
  minDistance: 10,
  maxDistance: 500,
  defaultDistance: 100,
  defaultAngle: Math.PI / 4, // 45 degrees
  panSpeed: 1.0,
  rotateSpeed: 0.5,
  zoomSpeed: 1.2,
};

/** Ore node colors (hex) */
export const ORE_COLORS: Record<string, number> = {
  iron_ore:      0x808080, // Grey
  copper_ore:    0xCC6633, // Orange-brown
  limestone:     0xF5F0C0, // Pale yellow
  sulfur:        0xFFFF00, // Yellow
  coal:          0x1A1A1A, // Black
  caterium_ore:  0x9933FF, // Purple
  sam:           0x9933FF, // Purple (same as caterium)
  raw_quartz:    0xFF69B4, // Pink
  bauxite:       0x8B4513, // Red-brown
  uranium:       0x39FF14, // Toxic green
  water:         0x3399FF, // Blue
  crude_oil:     0x111111, // Dark black
  nitrogen_gas:  0xE0E0E0, // White
};

/** Uranium glow intensity */
export const URANIUM_GLOW_INTENSITY = 2.0;

/** Alien Energy Extractor bonus */
export const ALIEN_ENERGY_BONUS = 0.3; // 30%
export const ALIEN_ENERGY_BASE_MW = 500;

/** Sawmill outputs */
export const SAWMILL = {
  woodOutputRate: 30,  // items/min
  grassOutputRate: 30, // items/min
};

/** Keyboard bindings */
export const KEYBINDS = {
  buildMenu: 'KeyQ',
  inventory: 'KeyB',
  interact: 'KeyE',
  rotate: 'KeyR',
  escape: 'Escape',
  save: 'KeyS', // Ctrl+S
  delete: 'Delete',
  floorUp: 'PageUp',
  floorDown: 'PageDown',
};

/** Power pole range in meters */
export const POWER_POLE_RANGE_M = 50;

/** Power line tower range in meters */
export const POWER_LINE_RANGE_M = 150;

/** Pump vertical lift heights (meters) */
export const PUMP_HEIGHTS = {
  mk1: 20,
  mk2: 50,
};
