// ============================================================
// ModelGallery — loads ALL GLB models from kits and displays
// them on the map in a grid with labels for identification
// ============================================================

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** One kit definition: name + list of GLB file paths */
interface KitDefinition {
  name: string;
  basePath: string;
  overviewPath: string;
  fallbackModels?: string[];
}

type ModelCategory = 'belts' | 'pipes' | 'trains' | 'buildings' | 'other';

/**
 * Manual per-kit, per-category size control (max bounding dimension in meters).
 * Tune these values to scale categories independently.
 */
const KIT_CATEGORY_MAX_SIZE: Record<string, Record<ModelCategory, number>> = {
  'Conveyor Kit': {
    belts: 6,
    pipes: 6,
    trains: 6,
    buildings: 6,
    other: 6,
  },
  'Train Kit': {
    belts: 25,
    pipes: 25,
    trains: 25,
    buildings: 25,
    other: 25,
  },
  'Modular Space Kit': {
    belts: 10,
    pipes: 10,
    trains: 10,
    buildings: 10,
    other: 10,
  },
  'Space Station Kit': {
    belts: 6,
    pipes: 6,
    trains: 6,
    buildings: 6,
    other: 6,
  },
  'City Kit Industrial': {
    belts: 25,
    pipes: 25,
    trains: 25,
    buildings: 25,
    other: 25,
  },
  'Modular Buildings': {
    belts: 15,
    pipes: 15,
    trains: 15,
    buildings: 15,
    other: 15,
  },
  'City Kit Commercial': {
    belts: 20,
    pipes: 20,
    trains: 20,
    buildings: 20,
    other: 20,
  },
  'Building Kit': {
    belts: 10,
    pipes: 10,
    trains: 10,
    buildings: 10,
    other: 10,
  },
};

/** All available kits with their GLB model files */
const KITS: KitDefinition[] = [
  {
    name: 'Conveyor Kit',
    basePath: '/kits/Conveyor Kit/Models/GLB format/',
    overviewPath: '/kits/Conveyor Kit/Overview.html',
  },
  {
    name: 'Train Kit',
    basePath: '/kits/kenney_train-kit/Models/GLB format/',
    overviewPath: '/kits/kenney_train-kit/Overview.html',
  },
  {
    name: 'Modular Space Kit',
    basePath: '/kits/Modular Space Kit/Models/GLB format/',
    overviewPath: '/kits/Modular Space Kit/Overview.html',
  },
  {
    name: 'Space Station Kit',
    basePath: '/kits/kenney_space-station-kit/Models/GLB format/',
    overviewPath: '/kits/kenney_space-station-kit/Overview.html',
  },
  {
    name: 'City Kit Industrial',
    basePath: '/kits/City Kit Industrial/Models/GLB format/',
    overviewPath: '/kits/City Kit Industrial/Overview.html',
  },
  {
    name: 'Modular Buildings',
    basePath: '/kits/Modular Buildings/Models/GLB format/',
    overviewPath: '/kits/Modular Buildings/Overview.html',
  },
  {
    name: 'City Kit Commercial',
    basePath: '/kits/kenney_city-kit-commercial_2.1/Models/GLB format/',
    overviewPath: '/kits/kenney_city-kit-commercial_2.1/Overview.html',
  },
  {
    name: 'Building Kit',
    basePath: '/kits/kenney_building-kit/Models/GLB format/',
    overviewPath: '/kits/kenney_building-kit/Overview.html',
  },
];

export class ModelGallery {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private galleryGroup: THREE.Group;

  /** Spacing between models in the gallery */
  private readonly SPACING_X = 28;  // 8m between models in a row
  private readonly SPACING_Z = 32; // 12m between rows
  private readonly MODELS_PER_ROW = 12;
  private readonly GALLERY_OFFSET_Z = 50; // Start gallery 50m ahead of center
  private readonly GALLERY_OFFSET_X = -50; // Center the gallery

  private loadedCount = 0;
  private totalCount = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.galleryGroup = new THREE.Group();
    this.galleryGroup.name = 'model-gallery';
    this.scene.add(this.galleryGroup);
  }

  /** Load all models from all kits and place them on the map */
  async loadAll(): Promise<void> {
    const kitsWithModels = await Promise.all(
      KITS.map(async (kit) => ({
        ...kit,
        models: await this.discoverModelsFromOverview(kit),
      })),
    );

    // Calculate total count
    this.totalCount = kitsWithModels.reduce((sum, kit) => sum + kit.models.length, 0);
    console.log(`[ModelGallery] Loading ${this.totalCount} models from ${kitsWithModels.length} kits...`);

    let globalIndex = 0;

    for (const kit of kitsWithModels) {
      // Add kit title banner
      const kitStartRow = Math.floor(globalIndex / this.MODELS_PER_ROW);
      this.addKitBanner(
        kit.name,
        this.GALLERY_OFFSET_X - 2,
        this.GALLERY_OFFSET_Z + kitStartRow * this.SPACING_Z,
      );

      // Load each model in the kit
      const promises = kit.models.map((modelFile, localIndex) => {
        const currentGlobalIndex = globalIndex + localIndex;
        return this.loadAndPlace(kit.basePath + modelFile, modelFile, kit.name, currentGlobalIndex);
      });

      // Load in batches of 8 to avoid overwhelming the browser
      const batchSize = 8;
      for (let i = 0; i < promises.length; i += batchSize) {
        const batch = promises.slice(i, i + batchSize);
        await Promise.allSettled(batch);
      }

      globalIndex += kit.models.length;
    }

    await this.addBuildingKitExamples();
    console.log(`[ModelGallery] Loaded ${this.loadedCount}/${this.totalCount} models`);
  }

  /** Parse kit Overview.html and extract all model names as *.glb */
  private async discoverModelsFromOverview(kit: KitDefinition): Promise<string[]> {
    try {
      const response = await fetch(kit.overviewPath, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const modelNameRegex = /<br>([^<]+)<\/div>/g;
      const discoveredNames: string[] = [];

      for (const match of html.matchAll(modelNameRegex)) {
        const modelName = match[1]?.trim();
        if (modelName) {
          discoveredNames.push(`${modelName}.glb`);
        }
      }

      const uniqueModels = Array.from(new Set(discoveredNames));
      if (uniqueModels.length > 0) {
        console.log(`[ModelGallery] ${kit.name}: discovered ${uniqueModels.length} models from Overview.html`);
        return uniqueModels;
      }
    } catch (err) {
      console.warn(`[ModelGallery] ${kit.name}: failed to parse ${kit.overviewPath}`, err);
    }

    const fallback = kit.fallbackModels ?? [];
    console.warn(`[ModelGallery] ${kit.name}: using fallback list (${fallback.length})`);
    return fallback;
  }

  /** Load a single model and place it at the correct grid position */
  private async loadAndPlace(
    fullPath: string,
    fileName: string,
    kitName: string,
    globalIndex: number,
  ): Promise<void> {
    const col = globalIndex % this.MODELS_PER_ROW;
    const row = Math.floor(globalIndex / this.MODELS_PER_ROW);
    const x = this.GALLERY_OFFSET_X + col * this.SPACING_X;
    const z = this.GALLERY_OFFSET_Z + row * this.SPACING_Z;

    try {
      const gltf = await this.loadGLB(fullPath);
      const model = gltf.scene;
      const category = this.resolveCategory(kitName, fileName);
      const targetMaxSize = KIT_CATEGORY_MAX_SIZE[kitName]?.[category] ?? 4;

      // Normalize model size: fit configured category size
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? targetMaxSize / maxDim : 1;
      model.scale.setScalar(scale);

      // Recompute bounding box after scaling
      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());

      // Position: center on X/Z, sit on ground
      model.position.set(
        x - center.x,
        -box.min.y,
        z - center.z,
      );

      // Enable shadows
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Store metadata
      model.userData = {
        type: 'gallery_model',
        fileName,
        fullPath,
        globalIndex,
      };

      this.galleryGroup.add(model);

      // Add label below
      const label = fileName.replace('.glb', '');
      const labelY = category === 'buildings' ? box.max.y + 1.5 : -0.5;
      this.addModelLabel(label, x, labelY, z);

      this.loadedCount++;
    } catch (err) {
      // Place a red error marker
      this.addErrorMarker(fileName, x, z);
      console.warn(`[ModelGallery] Failed: ${fullPath}`, err);
    }
  }

  /** Load a GLB file */
  private loadGLB(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(path, resolve, undefined, reject);
    });
  }

  /** Resolve manual scale category for model */
  private resolveCategory(kitName: string, fileName: string): ModelCategory {
    const name = fileName.toLowerCase();

    if (kitName === 'Train Kit') return 'trains';
    if (name.startsWith('pipe')) return 'pipes';
    if (name.startsWith('conveyor')) return 'belts';

    if (
      kitName === 'City Kit Industrial' ||
      kitName === 'Modular Buildings' ||
      name.startsWith('building') ||
      name.startsWith('structure') ||
      name.startsWith('wall') ||
      name.startsWith('room') ||
      name.startsWith('corridor') ||
      name.startsWith('roof') ||
      name.startsWith('floor') ||
      name.startsWith('stairs') ||
      name.startsWith('column') ||
      name.startsWith('border') ||
      name.startsWith('plating') ||
      name.startsWith('gutter')
    ) {
      return 'buildings';
    }

    return 'other';
  }

  /** Add a text label under a model */
  private addModelLabel(text: string, x: number, y: number, z: number): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 64;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 512, 64, 6);
    ctx.fill();

    // Text
    ctx.fillStyle = '#ccddff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Truncate long names
    const displayText = text.length > 30 ? text.substring(0, 28) + '…' : text;
    ctx.fillText(displayText, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z + 3);
    sprite.scale.set(7, 0.9, 1);
    this.galleryGroup.add(sprite);
  }

  /** Add a kit name banner */
  private addKitBanner(name: string, x: number, z: number): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 80;

    // Background
    ctx.fillStyle = 'rgba(50, 60, 130, 0.85)';
    ctx.roundRect(0, 0, 512, 80, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 140, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.roundRect(0, 0, 512, 80, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📦 ${name}`, 256, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x - 6, 5, z);
    sprite.scale.set(12, 2, 1);
    this.galleryGroup.add(sprite);
  }

  /** Place a red error cube when model fails to load */
  private addErrorMarker(fileName: string, x: number, z: number): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.5 });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(x, 0.5, z);
    this.galleryGroup.add(cube);

    // Still add label
    this.addModelLabel(`❌ ${fileName.replace('.glb', '')}`, x, -0.5, z);
  }

  /** Add 2 hand-made examples assembled from Building Kit parts */
  private async addBuildingKitExamples(): Promise<void> {
    const buildingKitBase = '/kits/kenney_building-kit/Models/GLB format/';
    const anchorX = this.GALLERY_OFFSET_X - 220;
    const anchorZ = this.GALLERY_OFFSET_Z - 35;
    const moduleSize = 4;

    const parts = [
      'wall.glb',
      'wall-window-square.glb',
      'wall-doorway-square.glb',
      'floor.glb',
      'roof-flat-center.glb',
      'stairs-open.glb',
    ];

    const loaded = await Promise.all(
      parts.map(async (part) => {
        const gltf = await this.loadGLB(buildingKitBase + part);
        return [part, gltf.scene] as const;
      }),
    );
    const partMap = new Map<string, THREE.Group>(loaded);

    // Derive one common scale so modular pieces still fit each other.
    const wallRef = partMap.get('wall.glb')?.clone();
    if (!wallRef) return;
    const wallBox = new THREE.Box3().setFromObject(wallRef);
    const wallSize = wallBox.getSize(new THREE.Vector3());
    const wallMaxHorizontal = Math.max(wallSize.x, wallSize.z);
    const commonScale = wallMaxHorizontal > 0 ? moduleSize / wallMaxHorizontal : 1;

    const spawnPart = (name: string, x: number, z: number, rotY = 0): THREE.Group => {
      const src = partMap.get(name);
      if (!src) return new THREE.Group();
      const model = src.clone();
      model.scale.setScalar(commonScale);

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(x - center.x, -box.min.y, z - center.z);
      model.rotation.y = rotY;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      return model;
    };

    const machineHall = new THREE.Group();
    machineHall.name = 'building-kit-example-machine-hall';
    machineHall.add(spawnPart('floor.glb', anchorX, anchorZ));
    machineHall.add(spawnPart('roof-flat-center.glb', anchorX, anchorZ));
    machineHall.add(spawnPart('wall.glb', anchorX, anchorZ - moduleSize / 2));
    machineHall.add(spawnPart('wall-window-square.glb', anchorX + moduleSize / 2, anchorZ, Math.PI / 2));
    machineHall.add(spawnPart('wall-window-square.glb', anchorX - moduleSize / 2, anchorZ, Math.PI / 2));
    machineHall.add(spawnPart('wall-doorway-square.glb', anchorX, anchorZ + moduleSize / 2, Math.PI));
    this.galleryGroup.add(machineHall);
    this.addModelLabel('Building Kit Example: Hall', anchorX, moduleSize + 1.5, anchorZ);

    const centerX = 120;
    const centerZ = 80;
    const g = new THREE.Group();

    g.add(spawnPart('floor.glb', centerX, centerZ));
    g.add(spawnPart('wall.glb', centerX, centerZ - moduleSize / 2));
    g.add(spawnPart('wall-window-square.glb', centerX + moduleSize / 2, centerZ, Math.PI / 2));
    g.add(spawnPart('wall-window-square.glb', centerX - moduleSize / 2, centerZ, Math.PI / 2));
    g.add(spawnPart('wall-doorway-square.glb', centerX, centerZ + moduleSize / 2, Math.PI));
    g.add(spawnPart('roof-flat-center.glb', centerX, centerZ));

    this.galleryGroup.add(g);
    this.addModelLabel('Custom Module', centerX, moduleSize + 1.5, centerZ);

    const stairTowerX = anchorX + 28;
    const stairTowerZ = anchorZ;
    const stairTower = new THREE.Group();
    stairTower.name = 'building-kit-example-stair-tower';
    stairTower.add(spawnPart('floor.glb', stairTowerX, stairTowerZ));
    stairTower.add(spawnPart('wall-window-square.glb', stairTowerX, stairTowerZ - moduleSize / 2));
    stairTower.add(spawnPart('wall.glb', stairTowerX + moduleSize / 2, stairTowerZ, Math.PI / 2));
    stairTower.add(spawnPart('stairs-open.glb', stairTowerX - 0.4, stairTowerZ + 0.4, Math.PI / 2));
    stairTower.add(spawnPart('roof-flat-center.glb', stairTowerX, stairTowerZ));
    this.galleryGroup.add(stairTower);
    this.addModelLabel('Building Kit Example: Stair Tower', stairTowerX, moduleSize + 1.5, stairTowerZ);

    this.addKitBanner('Building Kit Examples', anchorX - 10, anchorZ - 18);
  }
}
