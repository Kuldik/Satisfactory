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
  models: string[];
}

/** All available kits with their GLB model files */
const KITS: KitDefinition[] = [
  {
    name: 'Conveyor Kit',
    basePath: '/kits/Conveyor Kit/Models/GLB format/',
    models: [
      'conveyor.glb', 'conveyor-stripe.glb', 'conveyor-stripe-sides.glb',
      'conveyor-sides.glb', 'conveyor-long.glb', 'conveyor-long-stripe.glb',
      'conveyor-long-stripe-sides.glb', 'conveyor-long-sides.glb',
      'conveyor-bars.glb', 'conveyor-bars-stripe.glb',
      'conveyor-bars-stripe-side.glb', 'conveyor-bars-stripe-high.glb',
      'conveyor-bars-stripe-fence.glb', 'conveyor-bars-sides.glb',
      'conveyor-bars-high.glb', 'conveyor-bars-fence.glb',
      'robot-arm-a.glb', 'robot-arm-b.glb',
      'scanner-low.glb', 'scanner-high.glb',
      'box-small.glb', 'box-wide.glb', 'box-long.glb', 'box-large.glb',
      'arrow.glb', 'arrow-basic.glb',
      'cover.glb', 'cover-window.glb', 'cover-top.glb',
      'cover-stripe.glb', 'cover-stripe-window.glb', 'cover-stripe-top.glb',
      'cover-stripe-hopper.glb', 'cover-stripe-corner.glb', 'cover-stripe-bar.glb',
      'cover-hopper.glb', 'cover-corner.glb', 'cover-bar.glb',
      'door.glb', 'door-wide-open.glb', 'door-wide-half.glb', 'door-wide-closed.glb',
      'floor.glb', 'floor-large.glb', 'top.glb', 'top-large.glb',
      'structure-tall.glb', 'structure-short.glb', 'structure-medium.glb', 'structure-high.glb',
      'structure-wall.glb', 'structure-window.glb', 'structure-window-wide.glb',
      'structure-doorway.glb', 'structure-doorway-wide.glb',
      'structure-corner-outer.glb', 'structure-corner-inner.glb',
      'structure-yellow-tall.glb', 'structure-yellow-short.glb',
      'structure-yellow-medium.glb', 'structure-yellow-high.glb',
    ],
  },
  {
    name: 'Train Kit',
    basePath: '/kits/kenney_train-kit/Models/GLB format/',
    models: [
      'train-locomotive-a.glb', 'train-locomotive-b.glb', 'train-locomotive-c.glb',
      'train-locomotive-passenger-a.glb', 'train-locomotive-passenger-b.glb',
      'train-diesel-a.glb', 'train-diesel-b.glb', 'train-diesel-c.glb',
      'train-diesel-box-a.glb', 'train-diesel-box-b.glb', 'train-diesel-box-c.glb',
      'train-electric-bullet-a.glb', 'train-electric-bullet-b.glb', 'train-electric-bullet-c.glb',
      'train-electric-city-a.glb', 'train-electric-city-b.glb', 'train-electric-city-c.glb',
      'train-electric-double-a.glb', 'train-electric-double-b.glb', 'train-electric-double-c.glb',
      'train-electric-square-a.glb', 'train-electric-square-b.glb', 'train-electric-square-c.glb',
      'train-electric-subway-a.glb', 'train-electric-subway-b.glb', 'train-electric-subway-c.glb',
      'train-tram-classic.glb', 'train-tram-modern.glb', 'train-tram-round.glb',
      'train-carriage-box.glb', 'train-carriage-coal.glb', 'train-carriage-dirt.glb',
      'train-carriage-container-blue.glb', 'train-carriage-container-green.glb',
      'train-carriage-container-red.glb', 'train-carriage-flatbed.glb',
      'train-carriage-flatbed-wood.glb', 'train-carriage-lumber.glb',
      'train-carriage-tank.glb', 'train-carriage-tank-large.glb', 'train-carriage-wood.glb',
      'train-connector.glb',
      'railroad-straight.glb', 'railroad-straight-bend.glb', 'railroad-straight-bend-large.glb',
      'railroad-straight-skew-left.glb', 'railroad-straight-skew-right.glb',
      'railroad-straight-hill-beginning.glb', 'railroad-straight-hill-complete.glb',
      'railroad-straight-hill-end.glb',
      'railroad-rail-curve.glb', 'railroad-rail-corner-small.glb',
      'railroad-rail-corner-large.glb',
    ],
  },
  {
    name: 'Modular Space Kit',
    basePath: '/kits/Modular Space Kit/Models/GLB format/',
    models: [
      'corridor.glb', 'corridor-wide.glb', 'corridor-wide-junction.glb',
      'corridor-wide-intersection.glb', 'corridor-wide-end.glb', 'corridor-wide-corner.glb',
      'corridor-transition.glb', 'corridor-junction.glb', 'corridor-intersection.glb',
      'corridor-end.glb', 'corridor-corner.glb',
      'room-wide.glb', 'room-wide-variation.glb', 'room-small.glb',
      'room-small-variation.glb', 'room-large.glb', 'room-large-variation.glb', 'room-corner.glb',
      'gate.glb', 'gate-lasers.glb', 'gate-door.glb', 'gate-door-window.glb',
      'stairs.glb', 'stairs-wide.glb', 'cables.glb',
      'template-wall.glb', 'template-wall-top.glb', 'template-wall-stairs.glb',
      'template-wall-half.glb', 'template-wall-detail-a.glb', 'template-wall-corner.glb',
      'template-floor.glb', 'template-floor-layer.glb', 'template-floor-layer-raised.glb',
      'template-floor-layer-hole.glb', 'template-floor-detail.glb',
      'template-floor-detail-a.glb', 'template-floor-big.glb',
      'template-detail.glb', 'template-corner.glb',
    ],
  },
  {
    name: 'Space Station Kit',
    basePath: '/kits/kenney_space-station-kit/Models/GLB format/',
    models: [
      'pipe.glb', 'pipe-ring.glb', 'pipe-ring-colored.glb',
      'pipe-end.glb', 'pipe-end-colored.glb', 'pipe-bend.glb', 'pipe-bend-diagonal.glb',
      'container.glb', 'container-wide.glb', 'container-tall.glb',
      'container-flat.glb', 'container-flat-open.glb',
      'computer.glb', 'computer-wide.glb', 'computer-system.glb', 'computer-screen.glb',
      'table.glb', 'table-large.glb', 'table-inset.glb', 'table-inset-small.glb',
      'table-display.glb', 'table-display-small.glb', 'table-display-planet.glb',
      'display-wall.glb', 'display-wall-wide.glb',
      'wall.glb', 'wall-window.glb', 'wall-window-frame.glb',
      'wall-switch.glb', 'wall-pillar.glb', 'wall-door.glb', 'wall-door-wide.glb',
      'wall-detail.glb', 'wall-corner.glb', 'wall-corner-round.glb',
      'floor.glb', 'floor-panel.glb', 'floor-panel-straight.glb',
      'floor-panel-end.glb', 'floor-panel-corner.glb', 'floor-detail.glb', 'floor-corner.glb',
      'stairs.glb', 'stairs-ramp.glb', 'stairs-corner.glb',
      'structure.glb', 'structure-panel.glb', 'structure-barrier.glb', 'structure-barrier-high.glb',
      'rocks.glb', 'skip.glb', 'skip-rocks.glb',
      'rail.glb', 'rail-narrow.glb',
      'door-single.glb', 'door-single-half.glb', 'door-single-closed.glb',
      'door-double.glb', 'door-double-half.glb', 'door-double-closed.glb',
      'balcony-rail.glb', 'balcony-floor.glb',
    ],
  },
  {
    name: 'City Kit Industrial',
    basePath: '/kits/City Kit Industrial/Models/GLB format/',
    models: [
      'building-a.glb', 'building-b.glb', 'building-c.glb', 'building-d.glb',
      'building-e.glb', 'building-f.glb', 'building-g.glb', 'building-h.glb',
      'building-i.glb', 'building-j.glb', 'building-k.glb', 'building-l.glb',
      'building-m.glb', 'building-n.glb', 'building-o.glb', 'building-p.glb',
      'building-q.glb', 'building-r.glb', 'building-s.glb', 'building-t.glb',
      'chimney-basic.glb', 'chimney-small.glb', 'chimney-medium.glb', 'chimney-large.glb',
      'detail-tank.glb',
    ],
  },
  {
    name: 'Modular Buildings',
    basePath: '/kits/Modular Buildings/Models/GLB format/',
    models: [
      'building-corner.glb', 'building-corner-window.glb',
      'building-door.glb', 'building-door-window.glb',
      'building-window.glb', 'building-window-wide.glb', 'building-window-large.glb',
      'building-windows.glb', 'building-windows-sills.glb',
      'building-edges-door.glb', 'building-steps-wide.glb', 'building-steps-narrow.glb',
      'building-sample-house-a.glb', 'building-sample-house-b.glb', 'building-sample-house-c.glb',
      'building-sample-tower-a.glb', 'building-sample-tower-b.glb',
      'building-sample-tower-c.glb', 'building-sample-tower-d.glb',
      'roof-flat-top.glb', 'roof-flat-center.glb', 'roof-flat-corner.glb',
      'roof-slanted.glb', 'roof-gable.glb', 'roof-gable-end.glb',
      'door-white.glb', 'door-brown.glb',
      'window-white.glb', 'window-brown.glb',
      'detail-ac-a.glb', 'detail-ac-b.glb',
    ],
  },
];

export class ModelGallery {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private galleryGroup: THREE.Group;

  /** Spacing between models in the gallery */
  private readonly SPACING_X = 160;
  private readonly SPACING_Z = 240;
  private readonly MODELS_PER_ROW = 12;
  private readonly GALLERY_OFFSET_Z = 1000;
  private readonly GALLERY_OFFSET_X = -1000;

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
    // Calculate total count
    this.totalCount = KITS.reduce((sum, kit) => sum + kit.models.length, 0);
    console.log(`[ModelGallery] Loading ${this.totalCount} models from ${KITS.length} kits...`);

    let globalIndex = 0;

    for (const kit of KITS) {
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

    console.log(`[ModelGallery] Loaded ${this.loadedCount}/${this.totalCount} models`);
  }

  /** Load a single model and place it at the correct grid position */
  private async loadAndPlace(
    fullPath: string,
    fileName: string,
    _kitName: string,
    globalIndex: number,
  ): Promise<void> {
    const col = globalIndex % this.MODELS_PER_ROW;
    const row = Math.floor(globalIndex / this.MODELS_PER_ROW);
    const x = this.GALLERY_OFFSET_X + col * this.SPACING_X;
    const z = this.GALLERY_OFFSET_Z + row * this.SPACING_Z;

    try {
      const gltf = await this.loadGLB(fullPath);
      const model = gltf.scene;

      // Normalize model size: fit within an 80m bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 80 / maxDim : 1;
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
      this.addModelLabel(label, x, z);

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

  /** Add a text label under a model */
  private addModelLabel(text: string, x: number, z: number): void {
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
    sprite.position.set(x, -1, z + 60);
    sprite.scale.set(140, 18, 1);
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
    sprite.position.set(x - 120, 100, z);
    sprite.scale.set(240, 40, 1);
    this.galleryGroup.add(sprite);
  }

  /** Place a red error cube when model fails to load */
  private addErrorMarker(fileName: string, x: number, z: number): void {
    const geo = new THREE.BoxGeometry(20, 20, 20);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.5 });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(x, 10, z);
    this.galleryGroup.add(cube);

    // Still add label
    this.addModelLabel(`❌ ${fileName.replace('.glb', '')}`, x, z);
  }
}
