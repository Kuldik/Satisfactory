// ============================================================
// SceneManager — Three.js scene, camera, lighting, grid
// ============================================================

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { CAMERA, GRID_CELL_SIZE, ORE_COLORS } from "../core/constants.ts";
import { CameraController } from "./CameraController.ts";
import { GridRenderer } from "./GridRenderer.ts";
import { ModelGallery } from "./ModelGallery.ts";

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraController: CameraController;
  readonly gridRenderer: GridRenderer;

  private modelGallery: ModelGallery | null = null;
  private buildingKitLoader = new GLTFLoader();
  private clock = new THREE.Clock();
  private _visibleFloor = 0;

  // ---- Admin Builder system ----
  private builderGhostPivot: THREE.Group | null = null;
  private builderGhostModelRoot: THREE.Group | null = null;
  private builderGhostRotY = 0;
  private builderCurrentPartPath = "";
  private builderScale = 1;
  private builderMode: "single" | "line" = "single";
  private builderPointerNDC = new THREE.Vector2(0, 0);
  private builderHasPointer = false;
  private builderLineStart: THREE.Vector3 | null = null;
  private builderGhostInvalid = false;
  private builderGhostCurrentPos = new THREE.Vector3();
  private builderGhostFootprint = new THREE.Vector3(1, 1, 1);
  private builderDeconstructMode = false;
  private deconstructHovered: THREE.Object3D | null = null;
  private deconstructHoveredMaterials = new Map<
    THREE.Mesh,
    THREE.Material | THREE.Material[]
  >();
  private readonly deconstructMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: new THREE.Color(0x550000),
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private builderPlaced: Array<{
    partPath: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    scale: number;
  }> = [];
  private readonly builderPlacedGroup = new THREE.Group();
  private readonly builderLinePreviewGroup = new THREE.Group();
  private readonly glbCache = new Map<string, THREE.Group>();
  private readonly ghostMaterialOk = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    emissive: new THREE.Color(0x112244),
    emissiveIntensity: 0.6,
  });
  private readonly ghostMaterialInvalid = new THREE.MeshStandardMaterial({
    color: 0xff4455,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    emissive: new THREE.Color(0x551122),
    emissiveIntensity: 0.8,
  });
  private readonly builderStateKey = "satisfactory-dev-builder-state-v1";
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
      powerPreference: "high-performance",
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

    // Builder placed parts group (always in scene, starts empty)
    this.builderPlacedGroup.name = "builder-placed";
    this.scene.add(this.builderPlacedGroup);
    this.builderLinePreviewGroup.name = "builder-line-preview";
    this.scene.add(this.builderLinePreviewGroup);

    // Demo ore nodes (improved rocks)
    this.addDemoOres();

    // Load model gallery from all kits
    this.loadModelGallery();

    // Restore persisted builder state (DEV helper)
    void this.restoreBuilderState();
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
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1b, 0.4);
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
  private createRockMesh(
    radius: number,
    color: number,
    isEmissive = false,
  ): THREE.Mesh {
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

      positions.setXYZ(i, px * noise, py * noise * yScale, pz * noise);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.15,
      flatShading: false, // smooth shading for natural look
    });

    if (isEmissive) {
      mat.emissive = new THREE.Color(0x39ff14);
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
      const rock = this.createRockMesh(radius, color, type === "uranium");
      rock.position.set(x, radius * 0.35, z);
      rock.userData = { type: "ore_node", oreType: type };

      // Add 2-3 smaller rocks around the main one for cluster look
      const clusterGroup = new THREE.Group();
      clusterGroup.add(rock);

      for (let j = 0; j < 3; j++) {
        const smallRadius = radius * (0.35 + Math.random() * 0.3);
        const angle = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
        const dist = radius * 0.8 + Math.random() * 0.5;

        const smallRock = this.createRockMesh(
          smallRadius,
          color,
          type === "uranium",
        );
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

  private loadGLB(loader: GLTFLoader, path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject);
    });
  }

  /** Create a text sprite label */
  private addTextSprite(text: string, x: number, y: number, z: number): void {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.replace(/_/g, " "), 128, 32);

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

  // ================================================================
  // Admin Builder — ghost placement system
  // ================================================================

  /** Load a part as ghost (translucent blue hologram) and track it */
  async setBuilderGhost(partPath: string): Promise<void> {
    this.clearBuilderGhost();
    this.builderGhostRotY = 0;
    this.builderCurrentPartPath = partPath;

    let original = this.glbCache.get(partPath);
    if (!original) {
      const gltf = await this.loadGLB(this.buildingKitLoader, partPath);
      original = gltf.scene;
      this.glbCache.set(partPath, original);
    }

    const ghost = original.clone(true);
    ghost.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.ghostMaterialOk;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    const pivot = new THREE.Group();
    pivot.name = "builder-ghost";
    pivot.add(ghost);
    this.scene.add(pivot);
    this.builderGhostPivot = pivot;
    this.builderGhostModelRoot = ghost;

    this.normalizeGhostModel();
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
  }

  /** Move ghost to ground intersection under NDC mouse coords */
  updateBuilderGhostPosition(ndcX: number, ndcY: number): void {
    this.builderPointerNDC.set(ndcX, ndcY);
    this.builderHasPointer = true;
    if (this.builderDeconstructMode) {
      this.updateDeconstructHover(ndcX, ndcY);
      return;
    }

    if (!this.builderGhostPivot) return;
    const pos = this.getGridPositionUnderMouse(ndcX, ndcY, 0);
    if (!pos) return;

    // Detect stacking: place on top of the part under the cursor
    const stackY = this.detectStackLevel(ndcX, ndcY);
    if (stackY > 0.01) pos.y = stackY;

    // Face-snap to nearby placed parts (overrides grid on both axes when close)
    this.faceSnapToPlaced(pos);

    this.builderGhostCurrentPos.copy(pos);
    this.builderGhostPivot.position.copy(pos);
    this.builderGhostPivot.rotation.y = this.builderGhostRotY;

    this.builderGhostInvalid = this.computeGhostInvalid(this.builderGhostPivot);
    this.refreshGhostMaterial();

    if (this.builderMode === "line" && this.builderLineStart) {
      this.rebuildLinePreview(
        this.builderLineStart,
        this.builderGhostCurrentPos,
      );
    } else {
      this.builderLinePreviewGroup.clear();
    }
  }

  /** Place the ghost part permanently and record it */
  placeBuilderPart(): boolean {
    if (this.builderDeconstructMode) {
      if (this.deconstructHovered) {
        this.builderPlacedGroup.remove(this.deconstructHovered);
        this.builderPlaced = this.builderPlaced.filter(
          (p) => p !== this.deconstructHovered?.userData.builderRecord,
        );
        this.clearDeconstructHover();
        this.persistBuilderState();
        return true;
      }
      return false;
    }

    if (
      !this.builderGhostPivot ||
      !this.builderCurrentPartPath ||
      this.builderGhostInvalid
    )
      return false;

    if (this.builderMode === "line") {
      if (!this.builderLineStart) {
        this.builderLineStart = this.builderGhostCurrentPos.clone();
        this.rebuildLinePreview(
          this.builderLineStart,
          this.builderGhostCurrentPos,
        );
        return false;
      }
      const start = this.builderLineStart.clone();
      const end = this.builderGhostCurrentPos.clone();
      this.builderLineStart = null;
      this.builderLinePreviewGroup.clear();
      const records = this.getLinePlacementPositions(start, end);
      let placedAny = false;
      for (const pos of records) {
        placedAny = this.placeSingleAt(pos) || placedAny;
      }
      if (placedAny) {
        this.persistBuilderState();
      }
      return placedAny;
    }

    const placed = this.placeSingleAt(this.builderGhostCurrentPos);
    if (placed) {
      this.persistBuilderState();
    }
    return placed;
  }

  /** Rotate ghost by 90° */
  rotateBuilderGhost(dir: 1 | -1): void {
    this.builderGhostRotY += dir * (Math.PI / 2);
    if (this.builderGhostPivot) {
      this.builderGhostPivot.rotation.y = this.builderGhostRotY;
    }
    this.normalizeGhostModel();
  }

  /** Remove ghost without placing */
  clearBuilderGhost(): void {
    if (this.builderGhostPivot) {
      this.scene.remove(this.builderGhostPivot);
      this.builderGhostPivot = null;
    }
    this.builderGhostModelRoot = null;
    this.builderCurrentPartPath = "";
    this.builderLineStart = null;
    this.builderLinePreviewGroup.clear();
    this.builderGhostInvalid = false;
  }

  /** Remove all placed parts from scene and memory */
  clearBuilderComposition(): void {
    this.builderPlacedGroup.clear();
    this.builderPlaced = [];
    this.builderLineStart = null;
    this.builderLinePreviewGroup.clear();
    this.persistBuilderState();
  }

  /** Serialize current composition to JSON (positions relative to centroid) */
  exportBuilderComposition(): string {
    if (this.builderPlaced.length === 0) return '{ "parts": [] }';

    const cx =
      this.builderPlaced.reduce((s, p) => s + p.x, 0) /
      this.builderPlaced.length;
    const cz =
      this.builderPlaced.reduce((s, p) => s + p.z, 0) /
      this.builderPlaced.length;

    return JSON.stringify(
      {
        parts: this.builderPlaced.map((p) => ({
          partName: p.partPath.split("/").pop() ?? p.partPath,
          position: {
            x: +(p.x - cx).toFixed(3),
            y: +p.y.toFixed(3),
            z: +(p.z - cz).toFixed(3),
          },
          rotationY: +p.rotY.toFixed(4),
          scale: +p.scale.toFixed(4),
        })),
      },
      null,
      2,
    );
  }

  async importBuilderComposition(json: string): Promise<number> {
    let parsed: {
      parts?: Array<{
        partName?: string;
        position?: { x?: number; y?: number; z?: number };
        rotationY?: number;
        scale?: number;
      }>;
    };
    try {
      parsed = JSON.parse(json);
    } catch {
      return 0;
    }
    const parts = parsed.parts ?? [];
    if (!Array.isArray(parts) || parts.length === 0) return 0;

    // Import near the current pointer position if available.
    const anchor = this.builderHasPointer
      ? (this.getGridPositionUnderMouse(
          this.builderPointerNDC.x,
          this.builderPointerNDC.y,
          0,
        ) ?? new THREE.Vector3())
      : new THREE.Vector3();

    let count = 0;
    for (const p of parts) {
      const partName = p.partName ?? "";
      if (!partName) continue;
      const partPath = partName.includes("/")
        ? partName
        : `/kits/kenney_building-kit/Models/GLB format/${partName}`;
      await this.ensureCached(partPath);
      const previousPath = this.builderCurrentPartPath;
      const previousScale = this.builderScale;
      this.builderCurrentPartPath = partPath;
      this.builderScale = typeof p.scale === "number" ? p.scale : previousScale;
      const pos = new THREE.Vector3(
        anchor.x + (p.position?.x ?? 0),
        anchor.y + (p.position?.y ?? 0),
        anchor.z + (p.position?.z ?? 0),
      );
      const rot = typeof p.rotationY === "number" ? p.rotationY : 0;
      const ok = this.placeSingleAt(pos, rot, this.builderScale);
      this.builderCurrentPartPath = previousPath;
      this.builderScale = previousScale;
      if (ok) count += 1;
    }
    if (count > 0) this.persistBuilderState();
    return count;
  }

  setBuilderMode(mode: "single" | "line"): void {
    this.builderMode = mode;
    this.builderLineStart = null;
    this.builderLinePreviewGroup.clear();
  }

  cycleBuilderMode(): "single" | "line" {
    this.setBuilderMode(this.builderMode === "single" ? "line" : "single");
    return this.builderMode;
  }

  getBuilderMode(): "single" | "line" {
    return this.builderMode;
  }

  setBuilderDeconstructMode(enabled: boolean): void {
    this.builderDeconstructMode = enabled;
    if (enabled) {
      this.builderLineStart = null;
      this.builderLinePreviewGroup.clear();
      this.refreshGhostMaterial();
    } else {
      this.clearDeconstructHover();
    }
  }

  toggleBuilderDeconstructMode(): boolean {
    this.setBuilderDeconstructMode(!this.builderDeconstructMode);
    return this.builderDeconstructMode;
  }

  isBuilderDeconstructMode(): boolean {
    return this.builderDeconstructMode;
  }

  adjustBuilderScale(delta: number): number {
    const next = THREE.MathUtils.clamp(this.builderScale + delta, 0.2, 6);
    this.builderScale = Number(next.toFixed(2));
    this.applyGhostScale();
    this.persistBuilderState();
    return this.builderScale;
  }

  getBuilderScale(): number {
    return this.builderScale;
  }

  getBuilderPlacedCount(): number {
    return this.builderPlaced.length;
  }
  isBuilderGhostActive(): boolean {
    return this.builderGhostPivot !== null;
  }

  private async ensureCached(partPath: string): Promise<void> {
    if (this.glbCache.has(partPath)) return;
    const gltf = await this.loadGLB(this.buildingKitLoader, partPath);
    this.glbCache.set(partPath, gltf.scene);
  }

  private applyGhostScale(): void {
    if (!this.builderGhostModelRoot) return;
    this.builderGhostModelRoot.scale.setScalar(this.builderScale);
    this.normalizeGhostModel();
  }

  /** Recalculate ghost model position offset so bottom-center sits at pivot origin,
   *  and cache the world-space footprint for snap/line calculations. */
  private normalizeGhostModel(): void {
    if (
      !this.builderGhostModelRoot ||
      !this.builderGhostPivot ||
      !this.builderCurrentPartPath
    )
      return;

    const original = this.glbCache.get(this.builderCurrentPartPath);
    if (!original) return;

    const origBox = new THREE.Box3().setFromObject(original);
    const origCenter = origBox.getCenter(new THREE.Vector3());
    const origSize = origBox.getSize(new THREE.Vector3());
    const s = this.builderScale;

    this.builderGhostModelRoot.position.set(
      -origCenter.x * s,
      -origBox.min.y * s,
      -origCenter.z * s,
    );

    this.builderGhostFootprint.set(
      origSize.x * s,
      origSize.y * s,
      origSize.z * s,
    );
  }

  /** Ghost footprint rotated by current ghost rotation (X and Z may swap). */
  private getRotatedFootprint(): THREE.Vector3 {
    const c = Math.abs(Math.cos(this.builderGhostRotY));
    const sn = Math.abs(Math.sin(this.builderGhostRotY));
    return new THREE.Vector3(
      this.builderGhostFootprint.x * c + this.builderGhostFootprint.z * sn,
      this.builderGhostFootprint.y,
      this.builderGhostFootprint.x * sn + this.builderGhostFootprint.z * c,
    );
  }

  private refreshGhostMaterial(): void {
    if (!this.builderGhostModelRoot) return;
    const material = this.builderGhostInvalid
      ? this.ghostMaterialInvalid
      : this.ghostMaterialOk;
    this.builderGhostModelRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
  }

  private placeSingleAt(
    worldPos: THREE.Vector3,
    forcedRotY?: number,
    forcedScale?: number,
  ): boolean {
    if (!this.builderCurrentPartPath) return false;
    const original = this.glbCache.get(this.builderCurrentPartPath);
    if (!original) return false;

    const rotY =
      typeof forcedRotY === "number" ? forcedRotY : this.builderGhostRotY;
    const scale =
      typeof forcedScale === "number" ? forcedScale : this.builderScale;

    const placed = original.clone(true);
    placed.scale.setScalar(scale);
    placed.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Normalize: center on XZ, bottom at y=0 (same formula as normalizeGhostModel)
    const origBox = new THREE.Box3().setFromObject(original);
    const origCenter = origBox.getCenter(new THREE.Vector3());
    placed.position.set(
      -origCenter.x * scale,
      -origBox.min.y * scale,
      -origCenter.z * scale,
    );

    const pivot = new THREE.Group();
    pivot.add(placed);
    pivot.position.copy(worldPos);
    pivot.rotation.y = rotY;

    const record = {
      partPath: this.builderCurrentPartPath,
      x: pivot.position.x,
      y: pivot.position.y,
      z: pivot.position.z,
      rotY: pivot.rotation.y,
      scale,
    };
    pivot.userData.builderRecord = record;
    this.builderPlacedGroup.add(pivot);
    this.builderPlaced.push(record);
    return true;
  }

  private computeGhostInvalid(candidatePivot: THREE.Group): boolean {
    const candidateBox = new THREE.Box3().setFromObject(candidatePivot);
    const eps = 0.15;
    let invalid = false;
    this.builderPlacedGroup.children.forEach((placed) => {
      if (invalid) return;
      const placedBox = new THREE.Box3().setFromObject(placed);
      const overlapX =
        Math.min(candidateBox.max.x, placedBox.max.x) -
        Math.max(candidateBox.min.x, placedBox.min.x);
      const overlapY =
        Math.min(candidateBox.max.y, placedBox.max.y) -
        Math.max(candidateBox.min.y, placedBox.min.y);
      const overlapZ =
        Math.min(candidateBox.max.z, placedBox.max.z) -
        Math.max(candidateBox.min.z, placedBox.min.z);
      invalid = overlapX > eps && overlapY > eps && overlapZ > eps;
    });
    return invalid;
  }

  /** Snap pos so the ghost's face is flush against the nearest placed part face.
   *  Both X and Z are aligned when snapping to avoid staircase drift. */
  private faceSnapToPlaced(pos: THREE.Vector3): void {
    const fp = this.getRotatedFootprint();
    const ghostHalfX = fp.x / 2;
    const ghostHalfZ = fp.z / 2;
    const threshold = Math.max(fp.x, fp.z) * 0.65;

    let bestDist = threshold;
    let snapResult: { x: number; z: number } | null = null;

    for (const placed of this.builderPlacedGroup.children) {
      const box = new THREE.Box3().setFromObject(placed);
      const pc = box.getCenter(new THREE.Vector3());

      // 4 candidate snap positions: one for each face of the placed part
      const candidates = [
        { x: box.max.x + ghostHalfX, z: pc.z }, // right face
        { x: box.min.x - ghostHalfX, z: pc.z }, // left face
        { x: pc.x, z: box.max.z + ghostHalfZ }, // front face (+Z)
        { x: pc.x, z: box.min.z - ghostHalfZ }, // back face (-Z)
      ];

      for (const c of candidates) {
        if (
          Math.abs(c.x - pos.x) > threshold ||
          Math.abs(c.z - pos.z) > threshold
        )
          continue;
        const dist = Math.hypot(c.x - pos.x, c.z - pos.z);
        if (dist < bestDist) {
          bestDist = dist;
          snapResult = c;
        }
      }
    }

    if (snapResult) {
      pos.x = snapResult.x;
      pos.z = snapResult.z;
    }
  }

  /** Raycast against placed parts — return the top Y of the part under cursor, or 0. */
  private detectStackLevel(ndcX: number, ndcY: number): number {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = raycaster.intersectObjects(
      this.builderPlacedGroup.children,
      true,
    );
    if (hits.length === 0) return 0;
    const root = this.findPlacedRoot(hits[0].object);
    if (!root) return 0;
    const box = new THREE.Box3().setFromObject(root);
    return box.max.y;
  }

  private getLinePlacementPositions(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): THREE.Vector3[] {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const fp = this.getRotatedFootprint();
    const step = alongX ? Math.max(fp.x, 0.1) : Math.max(fp.z, 0.1);
    const result: THREE.Vector3[] = [];
    if (alongX) {
      const dir = Math.sign(dx) || 1;
      const dist = Math.abs(dx);
      const count = Math.max(1, Math.round(dist / step));
      for (let i = 0; i <= count; i++) {
        result.push(
          new THREE.Vector3(start.x + dir * i * step, start.y, start.z),
        );
      }
    } else {
      const dir = Math.sign(dz) || 1;
      const dist = Math.abs(dz);
      const count = Math.max(1, Math.round(dist / step));
      for (let i = 0; i <= count; i++) {
        result.push(
          new THREE.Vector3(start.x, start.y, start.z + dir * i * step),
        );
      }
    }
    return result;
  }

  private rebuildLinePreview(start: THREE.Vector3, end: THREE.Vector3): void {
    this.builderLinePreviewGroup.clear();
    if (!this.builderGhostModelRoot || !this.builderCurrentPartPath) return;
    const positions = this.getLinePlacementPositions(start, end);
    positions.forEach((p) => {
      const clone = this.builderGhostModelRoot!.clone(true);
      const pivot = new THREE.Group();
      pivot.add(clone);
      pivot.position.copy(p);
      pivot.rotation.y = this.builderGhostRotY;
      this.builderLinePreviewGroup.add(pivot);
    });
  }

  private updateDeconstructHover(ndcX: number, ndcY: number): void {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = raycaster.intersectObjects(
      this.builderPlacedGroup.children,
      true,
    );
    const hovered = hits[0]?.object
      ? this.findPlacedRoot(hits[0].object)
      : null;
    if (hovered === this.deconstructHovered) return;
    this.clearDeconstructHover();
    if (!hovered) return;
    this.deconstructHovered = hovered;
    hovered.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.deconstructHoveredMaterials.set(child, child.material);
        child.material = this.deconstructMaterial;
      }
    });
  }

  private clearDeconstructHover(): void {
    this.deconstructHoveredMaterials.forEach((material, mesh) => {
      mesh.material = material;
    });
    this.deconstructHoveredMaterials.clear();
    this.deconstructHovered = null;
  }

  private findPlacedRoot(object: THREE.Object3D): THREE.Object3D | null {
    let node: THREE.Object3D | null = object;
    while (node) {
      if (node.parent === this.builderPlacedGroup) return node;
      node = node.parent;
    }
    return null;
  }

  private persistBuilderState(): void {
    const payload = {
      scale: this.builderScale,
      mode: this.builderMode,
      parts: this.builderPlaced,
    };
    try {
      localStorage.setItem(this.builderStateKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures in dev helper.
    }
  }

  private async restoreBuilderState(): Promise<void> {
    let raw = "";
    try {
      raw = localStorage.getItem(this.builderStateKey) ?? "";
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        scale?: number;
        mode?: "single" | "line";
        parts?: Array<{
          partPath: string;
          x: number;
          y: number;
          z: number;
          rotY: number;
          scale?: number;
        }>;
      };
      if (typeof parsed.scale === "number") {
        this.builderScale = THREE.MathUtils.clamp(parsed.scale, 0.2, 6);
      }
      if (parsed.mode === "single" || parsed.mode === "line") {
        this.builderMode = parsed.mode;
      }
      const parts = parsed.parts ?? [];
      for (const part of parts) {
        if (!part.partPath) continue;
        await this.ensureCached(part.partPath);
        this.builderCurrentPartPath = part.partPath;
        this.placeSingleAt(
          new THREE.Vector3(part.x, part.y, part.z),
          part.rotY,
          typeof part.scale === "number" ? part.scale : this.builderScale,
        );
      }
      this.builderCurrentPartPath = "";
    } catch {
      // Ignore corrupted JSON.
    }
  }

  // ================================================================

  /** Render the scene */
  render(): void {
    this.clock.getDelta();

    if (
      this.builderGhostPivot &&
      this.builderHasPointer &&
      !this.builderDeconstructMode
    ) {
      if (this.builderGhostInvalid) {
        const shake = Math.sin(performance.now() * 0.05) * 0.08;
        this.builderGhostPivot.position.x =
          this.builderGhostCurrentPos.x + shake;
      } else {
        this.builderGhostPivot.position.x = this.builderGhostCurrentPos.x;
      }
    }

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
  getGridPositionUnderMouse(
    mouseX: number,
    mouseY: number,
    floor: number,
  ): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(mouseX, mouseY);
    raycaster.setFromCamera(mouse, this.camera);

    // Intersect with floor plane at given Y level
    const planeY = floor * GRID_CELL_SIZE;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersection);
    if (!hit) return null;

    // Snap to grid intersections (crosses), not inside cells.
    intersection.x =
      Math.round(intersection.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    intersection.z =
      Math.round(intersection.z / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    intersection.y = planeY;

    return intersection;
  }

  /** Clean up Three.js resources */
  dispose(): void {
    this.renderer.dispose();
    this.cameraController.dispose();
    this.gridRenderer.dispose();
    this.ghostMaterialOk.dispose();
    this.ghostMaterialInvalid.dispose();
    this.deconstructMaterial.dispose();

    // Traverse and dispose all geometries/materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
