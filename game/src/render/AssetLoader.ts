// ============================================================
// AssetLoader — loads GLB/GLTF 3D models from kits
// ============================================================

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  scaleToFitMaxExtent,
  usesConveyorGalleryFitScale,
} from '../buildings/logistics/conveyorFitScale.ts';
import {
  CONVEYOR_KIT_GLB_DIR,
  CONVEYOR_TIER_GLBS,
} from '../buildings/logistics/conveyorKitModels.ts';

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  name: string;
}

/** Mapping from building IDs to model paths */
const MODEL_REGISTRY: Record<string, string> = {
  // Conveyor — Kenney Conveyor Kit (см. CONVEYOR_TIER_GLBS)
  'conveyor_mk1': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk1}`,
  'conveyor_mk2': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk2}`,
  'conveyor_mk3': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk3}`,
  'conveyor_mk4': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk4}`,
  'conveyor_mk5': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk5}`,
  'conveyor_mk6': `${CONVEYOR_KIT_GLB_DIR}${CONVEYOR_TIER_GLBS.conveyor_mk6}`,
  splitter: "/kits/models/splitter.glb",
  merger: "/kits/models/connector.glb",

  // City Kit Industrial mappings for key factory buildings
  'hub':                   '/kits/City Kit Industrial/Models/GLB format/building-a.glb',
  'space_elevator':        '/kits/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-m.glb',
  'resource_sink':         '/kits/City Kit Industrial/Models/GLB format/building-o.glb',
  'constructor':           '/kits/City Kit Industrial/Models/GLB format/building-p.glb',
  'assembler':             '/kits/City Kit Industrial/Models/GLB format/building-q.glb',
  'manufacturer':          '/kits/City Kit Industrial/Models/GLB format/building-t.glb',
  'packager':              '/kits/City Kit Industrial/Models/GLB format/building-r.glb',
  'refinery':              '/kits/City Kit Industrial/Models/GLB format/building-l.glb',
  'blender':               '/kits/City Kit Industrial/Models/GLB format/building-c.glb',
  'particle_accelerator':  '/kits/City Kit Industrial/Models/GLB format/building-g.glb',
  'converter':             '/kits/City Kit Industrial/Models/GLB format/building-e.glb',
  'quantum_encoder':       '/kits/City Kit Industrial/Models/GLB format/building-f.glb',

  // Other placeholders / temporary mappings
  'smelter':        '/assets/models/space/corridorStraight.glb',

  'coal_generator': '/kits/City Kit Industrial/Models/GLB format/building-n.glb',
  'fuel_generator': '/kits/City Kit Industrial/Models/GLB format/building-m.glb',
  'nuclear_power': '/kits/City Kit Industrial/Models/GLB format/chimney-large.glb',
  'power_storage':
    '/kits/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-h.glb',

  // Train Kit
  'locomotive':     '/assets/models/train/locomotive.glb',
  'train_station':  '/assets/models/train/stationPlatform.glb',

  // Pipes (kits/models)
  pipe_mk1:
    "/kits/kenney_space-station-kit/Models/GLB format/pipe.glb",
  pipe_mk2:
    "/kits/kenney_space-station-kit/Models/GLB format/pipe.glb",
  pipe_junction:
    "/kits/kenney_space-station-kit/Models/GLB format/pipe-bend.glb",
  storage_small: "/kits/City Kit Industrial/Models/GLB format/building-s.glb",
  storage_large: "/kits/City Kit Industrial/Models/GLB format/building-i.glb",
  fluid_buffer:
    "/kits/kenney_space-station-kit/Models/GLB format/container-tall.glb",
  fluid_buffer_large:
    "/kits/City Kit Industrial/Models/GLB format/detail-tank.glb",
  loading_module: "/kits/models/module-in.glb",
  unloading_module: "/kits/models/module-out.glb",

  // Power poles (placeholder geometry)
  'power_pole_mk1': '/assets/models/station/computerScreen.glb',
};

/** Optional per-building model scale multiplier */
const MODEL_SCALE_OVERRIDES: Record<string, number> = {
  hub: 20,
  space_elevator: 400,
  resource_sink: 20,
  constructor: 20,
  assembler: 20,
  manufacturer: 20,
  packager: 20,
  refinery: 20,
  blender: 20,
  particle_accelerator: 20,
  converter: 20,
  quantum_encoder: 20,
  coal_generator: 20,
  fuel_generator: 20,
  nuclear_power: 20,
  power_storage: 10,
};

export class AssetLoader {
  private loader: GLTFLoader;
  private modelCache: Map<string, LoadedModel> = new Map();
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /** Load a single GLB model */
  async loadModel(path: string, name: string): Promise<LoadedModel> {
    // Check cache
    const cached = this.modelCache.get(path);
    if (cached) return cached;

    // Check if already loading
    const existing = this.loadingPromises.get(path);
    if (existing) return existing;

    // Start loading
    const promise = new Promise<LoadedModel>((resolve, reject) => {
      this.loader.load(
        path,
        (gltf: GLTF) => {
          const model: LoadedModel = {
            scene: gltf.scene,
            animations: gltf.animations,
            name,
          };

          // Apply default settings to all meshes
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.modelCache.set(path, model);
          this.loadingPromises.delete(path);
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`[AssetLoader] Failed to load ${path}:`, error);
          this.loadingPromises.delete(path);
          reject(error);
        },
      );
    });

    this.loadingPromises.set(path, promise);
    return promise;
  }

  /** Get a model for a building type, creating an instance */
  async getModelInstance(buildingId: string): Promise<THREE.Group | null> {
    const modelPath = MODEL_REGISTRY[buildingId];
    if (!modelPath) {
      console.warn(`[AssetLoader] No model registered for: ${buildingId}`);
      return null;
    }

    try {
      const model = await this.loadModel(modelPath, buildingId);
      const instance = model.scene.clone();
      if (usesConveyorGalleryFitScale(buildingId, modelPath)) {
        instance.scale.setScalar(scaleToFitMaxExtent(model.scene));
      } else {
        const scale = MODEL_SCALE_OVERRIDES[buildingId] ?? 1;
        if (scale !== 1) {
          instance.scale.multiplyScalar(scale);
        }
      }
      return instance;
    } catch {
      return null;
    }
  }

  /** Create a placeholder box for buildings without models */
  createPlaceholder(
    sizeX: number,
    sizeZ: number,
    sizeY: number,
    color: number = 0x4488aa,
  ): THREE.Mesh {
    const CELL = 2; // 2m per grid cell
    const geo = new THREE.BoxGeometry(
      sizeX * CELL - 0.1,
      sizeY * CELL - 0.1,
      sizeZ * CELL - 0.1,
    );
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Create a ghost (translucent preview) for build mode */
  createGhostPreview(
    sizeX: number,
    sizeZ: number,
    sizeY: number,
    canPlace: boolean = true,
  ): THREE.Mesh {
    const CELL = 2;
    const geo = new THREE.BoxGeometry(
      sizeX * CELL - 0.05,
      sizeY * CELL - 0.05,
      sizeZ * CELL - 0.05,
    );
    const mat = new THREE.MeshStandardMaterial({
      color: canPlace ? 0x22d3ee : 0xff4444,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  /** Get all registered building model paths */
  getRegisteredModels(): string[] {
    return Object.values(MODEL_REGISTRY);
  }

  /** Preload all registered models */
  async preloadAll(): Promise<void> {
    const entries = Object.entries(MODEL_REGISTRY);
    const promises = entries.map(([name, path]) =>
      this.loadModel(path, name).catch(() => null),
    );
    await Promise.all(promises);
    console.log(`[AssetLoader] Preloaded ${entries.length} models`);
  }

  /** Get cache stats */
  getCacheStats(): { cached: number; loading: number } {
    return {
      cached: this.modelCache.size,
      loading: this.loadingPromises.size,
    };
  }

  /** Clear the model cache */
  clearCache(): void {
    this.modelCache.clear();
  }
}
