// ============================================================
// AssetLoader — loads GLB/GLTF 3D models from kits
// ============================================================

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  name: string;
}

/** Mapping from building IDs to model paths */
const MODEL_REGISTRY: Record<string, string> = {
  // Conveyor Kit models
  'conveyor_mk1':   '/assets/models/conveyor/conveyorBelt.glb',
  'conveyor_mk2':   '/assets/models/conveyor/conveyorBelt.glb',
  'conveyor_mk3':   '/assets/models/conveyor/conveyorBelt.glb',
  'splitter':       '/assets/models/conveyor/conveyorSplitter.glb',
  'merger':         '/assets/models/conveyor/conveyorMerger.glb',

  // Modular Space Kit models (factories)
  'constructor':    '/assets/models/space/corridorCross.glb',
  'assembler':      '/assets/models/space/room.glb',
  'smelter':        '/assets/models/space/corridorStraight.glb',

  // City Kit Industrial
  'refinery':       '/assets/models/industrial/buildingE.glb',
  'coal_generator': '/assets/models/industrial/chimney.glb',

  // Train Kit
  'locomotive':     '/assets/models/train/locomotive.glb',
  'train_station':  '/assets/models/train/stationPlatform.glb',

  // Space Station Kit
  'pipe_mk1':       '/assets/models/station/pipeCorner.glb',
  'pipe_mk2':       '/assets/models/station/pipeStraight.glb',
  'storage_small':  '/assets/models/station/container.glb',
  'storage_large':  '/assets/models/station/containerLarge.glb',

  // Power poles (placeholder geometry)
  'power_pole_mk1': '/assets/models/station/computerScreen.glb',
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
      // Clone the scene for instancing
      return model.scene.clone();
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
      color: canPlace ? 0x44ff44 : 0xff4444,
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
