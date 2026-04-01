// ============================================================
// SceneManager — Three.js scene, camera, lighting, grid
// ============================================================

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { CAMERA, GRID_CELL_SIZE, ORE_COLORS } from "../core/constants.ts";
import { CameraController } from "./CameraController.ts";
import { GridRenderer } from "./GridRenderer.ts";
import { ModelGallery } from "./ModelGallery.ts";
import type { PatternPart } from "../buildings/BuildingPatterns.ts";

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
  private builderCtrlHeld = false;
  private builderDeconstructMode = false;
  private deconstructHovered: THREE.Object3D | null = null;
  /** Original material(s) per mesh while hover-highlighting for deconstruct */
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
    /** Один id на сборку (паттерн из меню, импорт, экспорт с группой) — снос удержанием ЛКМ целиком */
    compositeId?: string;
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

  // ---- Pattern placement (composite building ghosts) ----
  private patternGhostGroup: THREE.Group | null = null;
  private patternParts: PatternPart[] = [];
  private patternBuildingId = "";
  private patternRotY = 0;
  private patternCurrentPos = new THREE.Vector3();
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

    ghost.scale.setScalar(this.builderScale);
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
    const pos = this.getGridPositionUnderMouse(ndcX, ndcY, this._visibleFloor);
    if (!pos) return;

    // Ctrl-held edge alignment: snap to the same line as a nearby building edge
    this.edgeAlignToPlaced(pos);

    // Face-snap to nearby placed parts (overrides grid on both axes when close)
    if (!this.builderCtrlHeld) this.faceSnapToPlaced(pos);

    // After XZ is final: sit on floor or on top of any placed volume under footprint + vertical probe
    this.resolveVerticalSupport(pos);

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
        if (this.deconstructHovered.userData.compositeId) {
          return false;
        }
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
        this.resolveVerticalSupport(pos);
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
        parts: this.builderPlaced.map((p) => {
          const row: Record<string, unknown> = {
            partName: p.partPath.split("/").pop() ?? p.partPath,
            position: {
              x: +(p.x - cx).toFixed(3),
              y: +p.y.toFixed(3),
              z: +(p.z - cz).toFixed(3),
            },
            rotationY: +p.rotY.toFixed(4),
            scale: +p.scale.toFixed(4),
          };
          if (p.compositeId) row.compositeId = p.compositeId;
          return row;
        }),
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
        compositeId?: string;
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
          this._visibleFloor,
        ) ?? new THREE.Vector3())
      : new THREE.Vector3();

    const idRemap = new Map<string, string>();
    const remapCompositeId = (old?: string): string | undefined => {
      if (!old || typeof old !== "string") return undefined;
      let next = idRemap.get(old);
      if (!next) {
        next = this.newCompositeId();
        idRemap.set(old, next);
      }
      return next;
    };

    const anyCompositeInFile = parts.some(
      (p) => typeof p.compositeId === "string" && p.compositeId.length > 0,
    );
    /** Старые JSON без compositeId — вся вставка одна сборка (удержание ЛКМ). */
    const importAsOneBatchId = anyCompositeInFile
      ? undefined
      : this.newCompositeId();

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
      const compositeId =
        typeof p.compositeId === "string" && p.compositeId.length > 0
          ? remapCompositeId(p.compositeId)
          : importAsOneBatchId;
      const ok = this.placeSingleAt(pos, rot, this.builderScale, compositeId);
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
      this.refreshDeconstructHoverFromPointer();
    } else {
      this.clearDeconstructHover();
    }
  }

  /** Re-run hover pick after toggling deconstruct (pointer may not have moved). */
  refreshDeconstructHoverFromPointer(): void {
    if (!this.builderDeconstructMode || !this.builderHasPointer) return;
    this.updateDeconstructHover(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
  }

  toggleBuilderDeconstructMode(): boolean {
    this.setBuilderDeconstructMode(!this.builderDeconstructMode);
    return this.builderDeconstructMode;
  }

  isBuilderDeconstructMode(): boolean {
    return this.builderDeconstructMode;
  }

  /** Id сборки под курсором в режиме демонтажа (если есть — снос только удержанием ЛКМ из UI). */
  getDeconstructHoverCompositeId(): string | undefined {
    const id = this.deconstructHovered?.userData?.compositeId;
    return typeof id === "string" ? id : undefined;
  }

  /**
   * Экранная позиция круга удержания: центр pivot под курсором (дешево, без union bbox по сотням мешей).
   */
  getDeconstructCompositeHoldScreenPosition(): {
    left: number;
    top: number;
  } | null {
    const hovered = this.deconstructHovered;
    if (!hovered || !this.getDeconstructHoverCompositeId()) return null;
    const c = new THREE.Vector3();
    hovered.getWorldPosition(c);
    c.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const left = (c.x * 0.5 + 0.5) * rect.width + rect.left;
    const top = (-c.y * 0.5 + 0.5) * rect.height + rect.top;
    return { left, top };
  }

  /** Удалить все части с данным compositeId. Возвращает число снятых pivot-ов. */
  removeCompositeBuilding(compositeId: string): number {
    const toRemove: THREE.Object3D[] = [];
    for (const child of this.builderPlacedGroup.children) {
      if (child.userData.compositeId === compositeId) {
        toRemove.push(child);
      }
    }
    let removed = 0;
    for (const c of toRemove) {
      this.builderPlacedGroup.remove(c);
      const rec = c.userData.builderRecord as
        | (typeof this.builderPlaced)[number]
        | undefined;
      if (rec) {
        this.builderPlaced = this.builderPlaced.filter((p) => p !== rec);
      }
      removed += 1;
    }
    if (
      this.deconstructHovered &&
      this.deconstructHovered.userData.compositeId === compositeId
    ) {
      this.clearDeconstructHover();
    }
    if (removed > 0) this.persistBuilderState();
    return removed;
  }

  setBuilderCtrlHeld(held: boolean): void {
    this.builderCtrlHeld = held;
  }

  private static readonly BUILDER_SCALE_MAX = 25;

  adjustBuilderScale(delta: number): number {
    const next = THREE.MathUtils.clamp(
      this.builderScale + delta,
      0.2,
      SceneManager.BUILDER_SCALE_MAX,
    );
    this.builderScale = Number(next.toFixed(2));
    this.applyGhostScale();
    this.persistBuilderState();
    return this.builderScale;
  }

  setBuilderScale(value: number): number {
    this.builderScale = Number(
      THREE.MathUtils.clamp(value, 0.2, SceneManager.BUILDER_SCALE_MAX).toFixed(
        2,
      ),
    );
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

  private newCompositeId(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    );
  }

  private placeSingleAt(
    worldPos: THREE.Vector3,
    forcedRotY?: number,
    forcedScale?: number,
    compositeId?: string,
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

    const record: (typeof this.builderPlaced)[number] = {
      partPath: this.builderCurrentPartPath,
      x: pivot.position.x,
      y: pivot.position.y,
      z: pivot.position.z,
      rotY: pivot.rotation.y,
      scale,
    };
    if (compositeId) {
      record.compositeId = compositeId;
      pivot.userData.compositeId = compositeId;
    }
    pivot.userData.builderRecord = record;
    this.builderPlacedGroup.add(pivot);
    this.builderPlaced.push(record);
    return true;
  }

  private computeGhostInvalid(candidatePivot: THREE.Group): boolean {
    const candidateBox = new THREE.Box3().setFromObject(candidatePivot);
    const epsXZ = 0.12;
    /** Ignore sub-centimeter Y touch so stacks flush on top are not "invalid". */
    const yPenetrationTol = 0.06;
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
      if (overlapX <= epsXZ || overlapZ <= epsXZ) return;
      // Stacking: ghost bottom on or above placed top — not an intersection
      if (candidateBox.min.y >= placedBox.max.y - yPenetrationTol) return;
      invalid = overlapY > yPenetrationTol;
    });
    return invalid;
  }

  /** When Ctrl is held, magnetically snap the ghost to the nearest attachment point
   *  on any placed building. Generates all 4 face-adjacent positions for every placed
   *  part, plus 4 inline-continuation positions (extending the wall), and picks the
   *  closest complete (x, z) candidate to the cursor. */
  private edgeAlignToPlaced(pos: THREE.Vector3): void {
    if (!this.builderCtrlHeld) return;
    if (this.builderPlacedGroup.children.length === 0) return;

    const fp = this.getRotatedFootprint();
    const ghostHalfX = fp.x / 2;
    const ghostHalfZ = fp.z / 2;
    const maxRange = Math.max(fp.x, fp.z) * 6;

    let bestDist = maxRange;
    let bestX = pos.x;
    let bestZ = pos.z;

    for (const placed of this.builderPlacedGroup.children) {
      const box = new THREE.Box3().setFromObject(placed);
      const pc = box.getCenter(new THREE.Vector3());
      const pHalfX = (box.max.x - box.min.x) / 2;
      const pHalfZ = (box.max.z - box.min.z) / 2;

      if (
        Math.abs(pc.x - pos.x) > maxRange &&
        Math.abs(pc.z - pos.z) > maxRange
      )
        continue;

      // 4 face-adjacent positions: ghost touching each face, centered on that face
      // Plus 4 inline-continuation positions: ghost extending the wall in its direction
      const candidates: Array<{ x: number; z: number }> = [
        // Flush against +X face, aligned on Z
        { x: box.max.x + ghostHalfX, z: pc.z },
        // Flush against -X face, aligned on Z
        { x: box.min.x - ghostHalfX, z: pc.z },
        // Flush against +Z face, aligned on X
        { x: pc.x, z: box.max.z + ghostHalfZ },
        // Flush against -Z face, aligned on X
        { x: pc.x, z: box.min.z - ghostHalfZ },

        // Inline continuation along +X (same Z-line, extending right)
        { x: pc.x + pHalfX + ghostHalfX + pHalfX, z: pc.z },
        // Inline continuation along -X (same Z-line, extending left)
        { x: pc.x - pHalfX - ghostHalfX - pHalfX, z: pc.z },
        // Inline continuation along +Z
        { x: pc.x, z: pc.z + pHalfZ + ghostHalfZ + pHalfZ },
        // Inline continuation along -Z
        { x: pc.x, z: pc.z - pHalfZ - ghostHalfZ - pHalfZ },

        // Corner attachments: ghost at each corner of the placed part
        { x: box.max.x + ghostHalfX, z: box.max.z + ghostHalfZ },
        { x: box.max.x + ghostHalfX, z: box.min.z - ghostHalfZ },
        { x: box.min.x - ghostHalfX, z: box.max.z + ghostHalfZ },
        { x: box.min.x - ghostHalfX, z: box.min.z - ghostHalfZ },

        // Edge-aligned: ghost shares the same min/max X or Z edge as the placed part
        // (for continuing a line of different-sized pieces)
        { x: box.min.x + ghostHalfX, z: box.max.z + ghostHalfZ },
        { x: box.min.x + ghostHalfX, z: box.min.z - ghostHalfZ },
        { x: box.max.x - ghostHalfX, z: box.max.z + ghostHalfZ },
        { x: box.max.x - ghostHalfX, z: box.min.z - ghostHalfZ },
        { x: box.max.x + ghostHalfX, z: box.min.z + ghostHalfZ },
        { x: box.max.x + ghostHalfX, z: box.max.z - ghostHalfZ },
        { x: box.min.x - ghostHalfX, z: box.min.z + ghostHalfZ },
        { x: box.min.x - ghostHalfX, z: box.max.z - ghostHalfZ },
      ];

      for (const c of candidates) {
        const d = Math.hypot(c.x - pos.x, c.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          bestX = c.x;
          bestZ = c.z;
        }
      }
    }

    if (bestDist < maxRange) {
      pos.x = bestX;
      pos.z = bestZ;
    }
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

  /**
   * Углы и середины рёбер отпечатка (с учётом поворота призрака) — для лучей вниз.
   */
  private getFootprintSamplePointsXZ(
    pos: THREE.Vector3,
    hx: number,
    hz: number,
    rotY: number,
    includeEdgeMids: boolean,
  ): Array<{ x: number; z: number }> {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const toWorld = (lx: number, lz: number) => ({
      x: pos.x + lx * c - lz * s,
      z: pos.z + lx * s + lz * c,
    });
    const corners = [
      toWorld(-hx, -hz),
      toWorld(hx, -hz),
      toWorld(hx, hz),
      toWorld(-hx, hz),
    ];
    if (!includeEdgeMids) return corners;
    return [
      ...corners,
      toWorld(0, -hz),
      toWorld(hx, 0),
      toWorld(0, hz),
      toWorld(-hx, 0),
    ];
  }

  /**
   * Вертикальная опора: сохраняем стек (AABB + луч из центра), но если под периметром
   * лучи находят заметно **ниже** опору, чем «стек» по всему прямоугольнику (типично
   * высокий объект в центре при опоре по углам на колоннах), берём высоту по периметру.
   */
  private resolveVerticalSupport(pos: THREE.Vector3): void {
    const floorY = this._visibleFloor * GRID_CELL_SIZE;
    const fp = this.getRotatedFootprint();
    const hx = fp.x / 2;
    const hz = fp.z / 2;
    const gMinX = pos.x - hx;
    const gMaxX = pos.x + hx;
    const gMinZ = pos.z - hz;
    const gMaxZ = pos.z + hz;

    let yAabb = floorY;
    for (const placed of this.builderPlacedGroup.children) {
      const box = new THREE.Box3().setFromObject(placed);
      const ox = Math.min(gMaxX, box.max.x) - Math.max(gMinX, box.min.x);
      const oz = Math.min(gMaxZ, box.max.z) - Math.max(gMinZ, box.min.z);
      if (ox > 0.04 && oz > 0.04) {
        yAabb = Math.max(yAabb, box.max.y);
      }
    }

    const centerRay = this.sampleVerticalSupportRay(pos.x, pos.z);
    const yStack = Math.max(yAabb, centerRay ?? floorY);

    const span = Math.max(fp.x, fp.z);
    const includeMids = span > 1.15;
    const samples = this.getFootprintSamplePointsXZ(
      pos,
      hx,
      hz,
      this.builderGhostRotY,
      includeMids,
    );
    let yPerimeter = floorY;
    for (const p of samples) {
      const t = this.sampleVerticalSupportRay(p.x, p.z);
      if (t !== null) yPerimeter = Math.max(yPerimeter, t);
    }

    /** Насколько выше «периметр» должен быть ниже стека, чтобы считать центр артефактом */
    const perimeterVsStackClearance = 0.12;
    const perimeterMustExceedFloor = 0.02;

    if (
      yPerimeter > floorY + perimeterMustExceedFloor &&
      yStack > yPerimeter + perimeterVsStackClearance
    ) {
      pos.y = yPerimeter;
    } else {
      pos.y = yStack;
    }
  }

  /** Topmost hit along a downward ray through (x,z); ignores horizontal grazes. */
  private sampleVerticalSupportRay(x: number, z: number): number | null {
    if (this.builderPlacedGroup.children.length === 0) return null;
    const origin = new THREE.Vector3(x, 5000, z);
    const dir = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster(origin, dir);
    raycaster.far = 10000;
    const hits = raycaster.intersectObjects(
      this.builderPlacedGroup.children,
      true,
    );
    for (const hit of hits) {
      const n = hit.face?.normal;
      if (n) {
        const worldN = n.clone().transformDirection(hit.object.matrixWorld);
        if (worldN.y < 0.22) continue;
      }
      return hit.point.y;
    }
    return hits[0]?.point.y ?? null;
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
      this.resolveVerticalSupport(p);
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
      if (!(child instanceof THREE.Mesh)) return;
      const prev = child.material;
      this.deconstructHoveredMaterials.set(child, prev);
      child.material = Array.isArray(prev)
        ? prev.map(() => this.deconstructMaterial)
        : this.deconstructMaterial;
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
          compositeId?: string;
        }>;
      };
      if (typeof parsed.scale === "number") {
        this.builderScale = THREE.MathUtils.clamp(
          parsed.scale,
          0.2,
          SceneManager.BUILDER_SCALE_MAX,
        );
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
          typeof part.compositeId === "string" ? part.compositeId : undefined,
        );
      }
      this.builderCurrentPartPath = "";
    } catch {
      // Ignore corrupted JSON.
    }
  }

  // ================================================================
  // Pattern placement — place an entire building (composite JSON)
  // as a single ghost that follows the cursor.
  // ================================================================

  /** Load a building pattern as a composite ghost.
   *  All parts are assembled into one group that follows the cursor.
   *  If a part fails to load, it is skipped and a warning is logged. */
  async setPatternGhost(
    buildingId: string,
    parts: PatternPart[],
  ): Promise<void> {
    this.clearPatternGhost();
    this.clearBuilderGhost();
    this.patternParts = parts;
    this.patternBuildingId = buildingId;
    this.patternRotY = 0;

    const group = new THREE.Group();
    group.name = "pattern-ghost";

    const KIT_BASE = "/kits/kenney_building-kit/Models/GLB format";
    let loaded = 0;

    for (const part of parts) {
      const partPath = part.partName.includes("/")
        ? part.partName
        : `${KIT_BASE}/${part.partName}`;

      try {
        await this.ensureCached(partPath);
      } catch (err) {
        console.warn(
          `[Pattern] Failed to load part "${part.partName}" for ${buildingId}:`,
          err,
        );
        continue;
      }

      const original = this.glbCache.get(partPath);
      if (!original) continue;

      const clone = original.clone(true);
      const s = part.scale;
      clone.scale.setScalar(s);
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = this.ghostMaterialOk;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      const origBox = new THREE.Box3().setFromObject(original);
      const origCenter = origBox.getCenter(new THREE.Vector3());
      clone.position.set(
        -origCenter.x * s,
        -origBox.min.y * s,
        -origCenter.z * s,
      );

      const pivot = new THREE.Group();
      pivot.add(clone);
      pivot.position.set(part.position.x, part.position.y, part.position.z);
      pivot.rotation.y = part.rotationY;
      group.add(pivot);
      loaded++;
    }

    if (loaded === 0) {
      console.error(
        `[Pattern] No parts loaded for ${buildingId}. Check part names and kit path.`,
      );
      return;
    }
    if (loaded < parts.length) {
      console.warn(
        `[Pattern] ${buildingId}: loaded ${loaded}/${parts.length} parts.`,
      );
    }

    this.scene.add(group);
    this.patternGhostGroup = group;

    // Place ghost at screen center so it's visible before the user moves the mouse
    this.updatePatternGhostPosition(0, 0);
  }

  /** Update pattern ghost position to follow cursor */
  updatePatternGhostPosition(ndcX: number, ndcY: number): void {
    if (!this.patternGhostGroup) return;
    const pos = this.getGridPositionUnderMouse(ndcX, ndcY, 0);
    if (!pos) return;
    this.patternCurrentPos.copy(pos);
    this.patternGhostGroup.position.copy(pos);
    this.patternGhostGroup.rotation.y = this.patternRotY;
  }

  /** Place the pattern permanently at the current ghost position and rotation. */
  async placePattern(): Promise<boolean> {
    if (!this.patternGhostGroup || this.patternParts.length === 0) {
      console.warn("[Pattern] No ghost or parts to place");
      return false;
    }

    const anchor = this.patternCurrentPos.clone();
    const rot = this.patternRotY;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const KIT_BASE = "/kits/kenney_building-kit/Models/GLB format";
    const savedPath = this.builderCurrentPartPath;
    const patternCompositeId = this.newCompositeId();
    let placed = 0;

    console.log(
      `[Pattern] Placing at anchor=(${anchor.x.toFixed(1)}, ${anchor.z.toFixed(1)}) rot=${((rot * 180) / Math.PI).toFixed(0)}° cos=${cosR.toFixed(4)} sin=${sinR.toFixed(4)}`,
    );

    for (const part of this.patternParts) {
      const partPath = part.partName.includes("/")
        ? part.partName
        : `${KIT_BASE}/${part.partName}`;
      await this.ensureCached(partPath);
      this.builderCurrentPartPath = partPath;

      const rx = part.position.x * cosR - part.position.z * sinR;
      const rz = part.position.x * sinR + part.position.z * cosR;

      const ok = this.placeSingleAt(
        new THREE.Vector3(
          anchor.x + rx,
          anchor.y + part.position.y,
          anchor.z + rz,
        ),
        part.rotationY + rot,
        part.scale,
        patternCompositeId,
      );
      if (ok) placed++;
    }

    this.builderCurrentPartPath = savedPath;
    if (placed > 0) {
      this.persistBuilderState();
      // Убрать композитный призрак — иначе мышь продолжит двигать паттерн, а не демонтаж/hover по поставленным частям
      this.clearPatternGhost();
    }
    console.log(
      `[Pattern] Done: ${placed}/${this.patternParts.length} parts placed`,
    );
    return placed > 0;
  }

  /** Rotate pattern ghost by 90 degrees */
  rotatePatternGhost(dir: 1 | -1): void {
    this.patternRotY += dir * (Math.PI / 2);
    if (this.patternGhostGroup) {
      this.patternGhostGroup.rotation.y = this.patternRotY;
    }
    console.log(
      `[Pattern] Rotated → patternRotY = ${this.patternRotY.toFixed(4)} (${((this.patternRotY * 180) / Math.PI).toFixed(0)}°)`,
    );
  }

  /** Remove pattern ghost */
  clearPatternGhost(): void {
    if (this.patternGhostGroup) {
      this.scene.remove(this.patternGhostGroup);
      this.patternGhostGroup = null;
    }
    this.patternParts = [];
    this.patternBuildingId = "";
    this.patternRotY = 0;
  }

  isPatternGhostActive(): boolean {
    return this.patternGhostGroup !== null;
  }

  getPatternBuildingId(): string {
    return this.patternBuildingId;
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
