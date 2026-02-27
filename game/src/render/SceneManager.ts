// ============================================================
// SceneManager — Three.js scene, camera, lighting, grid
// ============================================================

import * as THREE from 'three';
import { CAMERA, GRID_CELL_SIZE, ORE_COLORS } from '../core/constants.ts';
import { CameraController } from './CameraController.ts';
import { GridRenderer } from './GridRenderer.ts';
import { ModelGallery } from './ModelGallery.ts';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraController: CameraController;
  readonly gridRenderer: GridRenderer;

  private modelGallery: ModelGallery | null = null;
  private clock = new THREE.Clock();
  private _visibleFloor = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 300, 1200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      canvas.clientWidth / canvas.clientHeight,
      CAMERA.near,
      CAMERA.far,
    );
    this.camera.position.set(50, 80, 50);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Camera Controller
    this.cameraController = new CameraController(this.camera, canvas);

    // Grid
    this.gridRenderer = new GridRenderer(this.scene);

    // Lighting
    this.setupLighting();

    // Ground plane
    this.setupGround();

    // Demo ore nodes (improved rocks)
    this.addDemoOres();

    // Load model gallery from all kits
    this.loadModelGallery();
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    this.scene.add(sun);

    // Hemisphere light for softer shadows
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x362D1B, 0.4);
    this.scene.add(hemi);
  }

  private setupGround(): void {
    const groundGeo = new THREE.PlaneGeometry(4000, 4000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Create a natural-looking rock mesh for ore nodes */
  private createRockMesh(radius: number, color: number, isEmissive = false): THREE.Mesh {
    // Use IcosahedronGeometry with detail=2 for smoother base
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const positions = geo.attributes.position;

    // Seed-based pseudo-random for consistent deformation
    const seed = color * 17 + radius * 31;
    const pseudoRandom = (i: number) => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    // Gentle vertex displacement for natural rock look
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);

      // Noise factor: gentle displacement (0.85–1.15)
      const noise = 0.85 + pseudoRandom(i) * 0.3;
      // Flatten bottom slightly
      const yScale = py < 0 ? 0.5 : 0.9;

      positions.setXYZ(
        i,
        px * noise,
        py * noise * yScale,
        pz * noise,
      );
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.15,
      flatShading: false, // smooth shading for natural look
    });

    if (isEmissive) {
      mat.emissive = new THREE.Color(0x39FF14);
      mat.emissiveIntensity = 0.5;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /** Add demo ore nodes to visualize the color scheme */
  private addDemoOres(): void {
    const oreTypes = Object.entries(ORE_COLORS);
    const radius = 1.8;

    oreTypes.forEach(([type, color], index) => {
      const x = (index % 5) * 10 - 20;
      const z = Math.floor(index / 5) * 10 - 30;

      // Create main rock
      const rock = this.createRockMesh(radius, color, type === 'uranium');
      rock.position.set(x, radius * 0.35, z);
      rock.userData = { type: 'ore_node', oreType: type };

      // Add 2-3 smaller rocks around the main one for cluster look
      const clusterGroup = new THREE.Group();
      clusterGroup.add(rock);

      for (let j = 0; j < 3; j++) {
        const smallRadius = radius * (0.35 + Math.random() * 0.3);
        const angle = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
        const dist = radius * 0.8 + Math.random() * 0.5;

        const smallRock = this.createRockMesh(smallRadius, color, type === 'uranium');
        smallRock.position.set(
          Math.cos(angle) * dist,
          smallRadius * 0.3,
          Math.sin(angle) * dist,
        );
        smallRock.rotation.set(
          Math.random() * 0.3,
          Math.random() * Math.PI * 2,
          Math.random() * 0.3,
        );
        clusterGroup.add(smallRock);
      }

      clusterGroup.position.set(x, 0, z);
      rock.position.set(0, radius * 0.35, 0);
      this.scene.add(clusterGroup);

      // Add text label as a sprite
      this.addTextSprite(type, x, radius * 2.5, z);
    });
  }

  /** Create a text sprite label */
  private addTextSprite(text: string, x: number, y: number, z: number): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.replace(/_/g, ' '), 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(6, 1.5, 1);
    this.scene.add(sprite);
  }

  /** Load and display all 3D models from kits on the map */
  private async loadModelGallery(): Promise<void> {
    this.modelGallery = new ModelGallery(this.scene);
    await this.modelGallery.loadAll();
  }

  /** Render the scene */
  render(): void {
    const _delta = this.clock.getDelta();
    this.cameraController.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Handle window resize */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Set which floor level is visible */
  setVisibleFloor(floor: number): void {
    this._visibleFloor = floor;
    this.gridRenderer.setFloor(floor);
    // TODO: update building visibility based on floor
  }

  get visibleFloor(): number {
    return this._visibleFloor;
  }

  /** Get camera position for save data */
  getCameraPosition(): { x: number; y: number; z: number } {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Get camera target for save data */
  getCameraTarget(): { x: number; y: number; z: number } {
    const t = this.cameraController.getTarget();
    return { x: t.x, y: t.y, z: t.z };
  }

  /** Get the raycasted grid position under the mouse */
  getGridPositionUnderMouse(mouseX: number, mouseY: number, floor: number): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(mouseX, mouseY);
    raycaster.setFromCamera(mouse, this.camera);

    // Intersect with floor plane at given Y level
    const planeY = floor * GRID_CELL_SIZE;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersection);
    if (!hit) return null;

    // Snap to grid
    intersection.x = Math.floor(intersection.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    intersection.z = Math.floor(intersection.z / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    intersection.y = planeY;

    return intersection;
  }

  /** Clean up Three.js resources */
  dispose(): void {
    this.renderer.dispose();
    this.cameraController.dispose();
    this.gridRenderer.dispose();

    // Traverse and dispose all geometries/materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
