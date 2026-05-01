// ============================================================
// SceneManager — Three.js scene, camera, lighting, grid
// ============================================================

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  CAMERA,
  GRID_CELL_SIZE,
  GROUND_PLANE_EXTENT,
  ORE_COLORS,
  ORE_DEMO_MODEL_PATH,
} from "../core/constants.ts";
import {
  createProceduralElbowPipeObject,
  createProceduralFreeCurvePipeObject,
  createProceduralStraightPipeObject,
  offsetProceduralPipeRootToSitOnFloor,
  proceduralPipeTubeRadiusWorld,
} from "../buildings/logistics/proceduralPipeGeometry.ts";
import type { BuilderMode } from "../core/types.ts";
import { CONVEYOR_PLACEMENT_MODES } from "../core/types.ts";
import type { ConveyorPlacementMode } from "../core/types.ts";
import { CameraController } from "./CameraController.ts";
import { GridRenderer } from "./GridRenderer.ts";
import { ModelGallery } from "./ModelGallery.ts";
import type { PatternPart } from "../buildings/BuildingPatterns.ts";
import { getBuildingPrefab } from "../buildings/BuildingPrefabs.ts";
import {
  getBuildingPorts,
  PORT_MODEL_INPUT,
  PORT_MODEL_OUTPUT,
} from "../buildings/BuildingPorts.ts";
import {
  scaleToFitMaxExtent,
  usesConveyorGalleryFitScale,
} from "../buildings/logistics/conveyorFitScale.ts";
import {
  isConveyorBeltMenuId,
  isLogisticsConveyorKitPath,
  isLogisticsMenuBuildingId,
} from "../buildings/logistics/conveyorKitModels.ts";
import {
  isKenneySpaceStationPipeAssetPath,
  isKenneySpaceStationPipeBendPath,
  isKenneySpaceStationPipeStraightPath,
  isPipeLineMenuId,
  isPipeJunctionMenuId,
  isProceduralPipePartPath,
  PIPE_BEND_LAY_FLAT_EXTRA_ROT_Z,
  PIPE_LAY_FLAT_ROT_X,
  PIPE_PROCEDURAL_ELBOW_PATH,
  PIPE_PROCEDURAL_FREE_CURVE_PATH,
  PIPE_PROCEDURAL_STRAIGHT_PATH,
  PIPE_RUN_ROT_Y_OFFSET,
} from "../buildings/logistics/pipeKitModels.ts";
import {
  DECONSTRUCT_HOLD_DEFAULT_MS,
  DECONSTRUCT_HOLD_LOGISTICS_MS,
} from "../core/constants.ts";
import { resolveBuilderModelPath } from "./builderModelPath.ts";
import {
  computeAxisAlignedPathSegments,
  getAxisLinePlacementPositions,
} from "./builder/builderAxisLinePlacement.ts";
import {
  edgeAlignGhostToPlaced,
  faceSnapGhostToPlaced,
  resolveGhostVerticalSupport,
} from "./builder/builderGhostSnapping.ts";
import {
  computeConveyorPathSegments,
  getPlacementSegmentStep,
} from "./builder/conveyorPathSegments.ts";
import {
  assignPipeStraightChordMeters,
  buildPipeFirstLegForPreviewAndPlace,
  computePipeJunctionRotations,
  computePipePathSegments,
  mapConveyorSegmentsToPipeStraights,
  pipeCornerTrimForStep,
  pipeLShapeInfoFromLineEnd,
  pipeStartBackTrimForExistingNeighbor,
  snapPipeGhostXZ,
} from "./builder/pipePathSegments.ts";
import type { PipePathSegment } from "./builder/pipePathSegments.ts";
import {
  computePipeFreeCurvePath,
  pipeFreeCurvePlacementTooSharp,
  PIPE_FREE_CURVE_TENSION,
} from "./builder/pipeFreeCurve.ts";
import { applyPrefabMaterialPalette } from "./buildingMaterialPalettes.ts";

/** Сегменты линии для превью/пакетной постановки (конвейер, труба, ось). */
type BuilderPathPlanSegment = {
  position: THREE.Vector3;
  rotationY: number;
  partPath?: string;
  elbowIncomingRotY?: number;
  elbowTurn?: 1 | -1;
  straightChordMeters?: number;
};

type BuilderPlacedPartRecord = {
  partPath: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  compositeId?: string;
  menuBuildingId?: string;
  segmentStep?: number;
  straightChordMeters?: number;
  elbowIncomingRotY?: number;
  elbowTurn?: 1 | -1;
  freeCurvePoints?: { x: number; y: number; z: number }[];
  tubeRadius?: number;
};

/**
 * Минимальное расстояние между двумя отрезками в XZ (центры + полудлины + оси).
 * Используется для коллизии капсул прямых труб: две точки минимума на каждом
 * отрезке, расстояние между ними. Алгоритм Lumelsky/Eberly, упрощённый для 2D.
 */
function segmentSegmentDistanceXZ(
  ax: number,
  az: number,
  aDirX: number,
  aDirZ: number,
  aHalf: number,
  bx: number,
  bz: number,
  bDirX: number,
  bDirZ: number,
  bHalf: number,
): number {
  const dx0 = ax - bx;
  const dz0 = az - bz;
  const a = aDirX * aDirX + aDirZ * aDirZ;
  const b = aDirX * bDirX + aDirZ * bDirZ;
  const c = bDirX * bDirX + bDirZ * bDirZ;
  const d = aDirX * dx0 + aDirZ * dz0;
  const e = bDirX * dx0 + bDirZ * dz0;
  const denom = a * c - b * b;
  let s: number;
  let t: number;
  if (denom > 1e-9) {
    s = (b * e - c * d) / denom;
    t = (a * e - b * d) / denom;
  } else {
    s = 0;
    t = e / Math.max(c, 1e-9);
  }
  s = Math.max(-aHalf, Math.min(aHalf, s));
  t = Math.max(-bHalf, Math.min(bHalf, t));
  const px = ax + aDirX * s;
  const pz = az + aDirZ * s;
  const qx = bx + bDirX * t;
  const qz = bz + bDirZ * t;
  return Math.hypot(px - qx, pz - qz);
}

/**
 * SceneManager — жизненный цикл сцены, камера, сетка, демо-ресурсы.
 *
 * Вынесено в `render/builder/`:
 * - conveyorPathSegments — траектории лент (L, кривая, двойной снап).
 * - builderGhostSnapping — Ctrl-снап, face-снап, вертикальная опора под призраком.
 * - builderAxisLinePlacement — ось-выровненная линия для админ-билдера.
 */
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
  private builderMode: BuilderMode = "single";
  private builderPointerNDC = new THREE.Vector2(0, 0);
  private builderHasPointer = false;
  private builderLineStart: THREE.Vector3 | null = null;
  private builderGhostInvalid = false;
  private builderGhostCurrentPos = new THREE.Vector3();
  private builderGhostFootprint = new THREE.Vector3(1, 1, 1);
  /** Не null — режим «префаб из меню»: фиксированный scale и одна сборка compositeId при установке */
  private prefabPlacementScale: number | null = null;
  /** Id пункта меню (например space_elevator) — в сейв подставляется актуальный scale из BuildingPrefabs */
  private prefabMenuBuildingId: string | null = null;
  /** Rotation offset for conveyor models: -π/2 when belt axis is X, 0 when Z */
  private conveyorRotOffset = 0;
  /** Registry of placed conveyor line endpoints for snapping */
  private readonly conveyorEndpoints: Array<{
    position: THREE.Vector3;
    rotationY: number;
    compositeId: string;
    lineKind: "conveyor" | "pipe";
  }> = [];
  /**
   * Belt rotationY at the current line start (after snap, auto-continue, or first click).
   * Used so L-shaped and curve paths extend along the incoming belt instead of picking
   * a perpendicular world axis from start→end alone.
   */
  private conveyorTangentAtLineStart: number | null = null;
  /** Belt rotationY at line end when cursor snaps to a conveyor endpoint (curve + dual-snap default). */
  private conveyorTangentAtLineEnd: number | null = null;
  /** Default (L) mode: both legs shorter than min turn → red ghost, no place */
  private conveyorDefaultTooTight = false;
  private pipeDefaultTooTight = false;
  private pipeLineEndSnappedToTarget = false;
  /** T в линейной трубе — переключает приоритетную ось L (firstAlongX <-> firstAlongZ). */
  private pipePreferredAxisFlip = false;
  /**
   * Транзитный авто-флип: применяется внутри `updateBuilderGhostPosition`,
   * если L по preferredAxis коллидит с существующей геометрией, а L по
   * альтернативной оси — нет. Используется превью и постановкой через
   * `effectivePipeAxisFlip()`.
   */
  private pipeAutoAxisFlip = false;
  /**
   * Труба в режиме default: leg — одна прямая до клика; junction — колено на углу, крутится за мышью.
   */
  private pipePlacementSubMode: "leg" | "junction" = "leg";
  /** Угол L на полу (второй клик) — та же точка, что `corner` для колена в `computePipePathSegments`. */
  private readonly pipeJunctionManhattanCornerWorld = new THREE.Vector3();
  private pipeIncomingStraightRotY = 0;
  private pipeJunctionOutgoingStraightRotY = 0;
  /** Знак последнего колена (для постановки процедурного elbow). */
  private pipeJunctionLastTurn: 1 | -1 = 1;
  private builderCtrlHeld = false;
  private builderDeconstructMode = false;
  private deconstructHovered: THREE.Object3D | null = null;
  /** Original material(s) per mesh while hover-highlighting for deconstruct */
  private deconstructHoveredMaterials = new Map<
    THREE.Mesh,
    THREE.Material | THREE.Material[]
  >();
  /** Alt + hover: несколько pivot-ов для сноса удержанием ЛКМ. */
  private readonly deconstructMultiRoots = new Set<THREE.Object3D>();
  /** Обычный hover: все сегменты одной линии ленты или вся сборка с одним compositeId. */
  private deconstructRunHighlightRoots: THREE.Object3D[] = [];
  private readonly deconstructMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: new THREE.Color(0x550000),
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private builderPlaced: BuilderPlacedPartRecord[] = [];
  private readonly builderPlacedGroup = new THREE.Group();
  private readonly builderLinePreviewGroup = new THREE.Group();
  private readonly glbCache = new Map<string, THREE.Group>();
  /** World-space port positions from placed buildings — used for conveyor auto-snap. */
  private readonly placedPorts: Array<{
    worldPos: THREE.Vector3;
    worldDir: number;
    type: "input" | "output";
    buildingPivot: THREE.Group;
  }> = [];
  private readonly ghostMaterialOk = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    emissive: new THREE.Color(0x0c4a6e),
    emissiveIntensity: 0.55,
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
  /** Инкремент при отмене / новом выборе: устаревший setPatternGhost не вешает группу на сцену. */
  private patternGhostLoadGeneration = 0;
  /** Согласовано с UI `data-theme` — фон, туман, земля, сетка. */
  private sceneVisualTheme: "dark" | "light" = "dark";
  private groundMesh!: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141018);
    this.scene.fog = new THREE.Fog(0x141018, 300, 1200);

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

    // Demo ore nodes — `kits/models/ore.glb`, тинт по ORE_COLORS
    void this.addDemoOres();

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
    const groundGeo = new THREE.PlaneGeometry(
      GROUND_PLANE_EXTENT,
      GROUND_PLANE_EXTENT,
    );
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2c2620,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;
  }

  /**
   * Тёмная / светлая визуальная тема сцены (небо, туман, платформа, сетка).
   * Вызывается из движка при загрузке и по `SCENE_THEME_EVENT` с UI.
   */
  setVisualTheme(theme: "dark" | "light"): void {
    if (this.sceneVisualTheme === theme) return;
    this.sceneVisualTheme = theme;

    const bg = theme === "light" ? 0xe4e6ea : 0x141018;
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(bg);
    } else {
      this.scene.background = new THREE.Color(bg);
    }

    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.setHex(bg);
      if (theme === "light") {
        fog.near = 260;
        fog.far = 1000;
      } else {
        fog.near = 300;
        fog.far = 1200;
      }
    }

    const gmat = this.groundMesh.material as THREE.MeshStandardMaterial;
    gmat.color.setHex(theme === "light" ? 0xc8c4bc : 0x2c2620);

    this.gridRenderer.setVisualTheme(theme);
    this.renderer.toneMappingExposure = theme === "light" ? 1.28 : 1.2;
  }

  /**
   * Перекрасить клон `ore.glb` под тип ресурса (отдельные клоны материалов на меш).
   */
  private tintOreGltf(root: THREE.Object3D, tintHex: number, uraniumGlow: boolean): void {
    const tint = new THREE.Color(tintHex);
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const applyOne = (m: THREE.Material): THREE.Material => {
        const mat = m.clone();
        if (
          mat instanceof THREE.MeshStandardMaterial ||
          mat instanceof THREE.MeshPhysicalMaterial
        ) {
          mat.color.copy(tint);
          if (uraniumGlow) {
            mat.emissive = new THREE.Color(0x39ff14);
            mat.emissiveIntensity = 0.5;
          }
        } else if (
          mat instanceof THREE.MeshLambertMaterial ||
          mat instanceof THREE.MeshPhongMaterial
        ) {
          mat.color.copy(tint);
          if (uraniumGlow && "emissive" in mat) {
            mat.emissive = new THREE.Color(0x39ff14);
            if ("emissiveIntensity" in mat) {
              (mat as THREE.MeshPhongMaterial).emissiveIntensity = 0.5;
            }
          }
        }
        return mat;
      };
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(applyOne);
      } else {
        obj.material = applyOne(obj.material);
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  }

  /** Резерв: процедурные «камни», если `ore.glb` не загрузился. */
  private addDemoOresProcedural(): void {
    const oreTypes = Object.entries(ORE_COLORS);
    const radius = 1.8;
    const pseudoRock = (
      r: number,
      color: number,
      isEmissive: boolean,
    ): THREE.Mesh => {
      const geo = new THREE.IcosahedronGeometry(r, 2);
      const positions = geo.attributes.position;
      const seed = color * 17 + r * 31;
      const pseudoRandom = (i: number) => {
        const x = Math.sin(seed + i * 127.1) * 43758.5453;
        return x - Math.floor(x);
      };
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        const noise = 0.85 + pseudoRandom(i) * 0.3;
        const yScale = py < 0 ? 0.5 : 0.9;
        positions.setXYZ(i, px * noise, py * noise * yScale, pz * noise);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0.15,
      });
      if (isEmissive) {
        mat.emissive = new THREE.Color(0x39ff14);
        mat.emissiveIntensity = 0.5;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    oreTypes.forEach(([type, color], index) => {
      const x = (index % 5) * 10 - 20;
      const z = Math.floor(index / 5) * 10 - 30;
      const rock = pseudoRock(radius, color, type === "uranium");
      rock.position.set(x, radius * 0.35, z);
      rock.userData = { type: "ore_node", oreType: type };
      const clusterGroup = new THREE.Group();
      clusterGroup.add(rock);
      for (let j = 0; j < 3; j++) {
        const smallR = radius * (0.35 + Math.random() * 0.3);
        const angle = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
        const dist = radius * 0.8 + Math.random() * 0.5;
        const smallRock = pseudoRock(smallR, color, type === "uranium");
        smallRock.position.set(
          Math.cos(angle) * dist,
          smallR * 0.3,
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
      this.addTextSprite(type, x, radius * 2.5, z);
    });
  }

  /** Демо-узлы руды: одна glb-модель на тип, масштаб под сетку, цвет из ORE_COLORS. */
  private async addDemoOres(): Promise<void> {
    let template: THREE.Object3D;
    try {
      const gltf = await this.loadGLB(
        this.buildingKitLoader,
        ORE_DEMO_MODEL_PATH,
      );
      template = gltf.scene;
    } catch (err) {
      console.warn(
        `[SceneManager] Не удалось загрузить ${ORE_DEMO_MODEL_PATH}, процедурный fallback:`,
        err,
      );
      this.addDemoOresProcedural();
      return;
    }

    const oreTypes = Object.entries(ORE_COLORS);
    const unitBox = new THREE.Box3().setFromObject(template);
    const unitSize = unitBox.getSize(new THREE.Vector3());
    const unitMax = Math.max(unitSize.x, unitSize.y, unitSize.z, 0.01);
    /** ~диаметр старого кластера (1.8 * 2) */
    const targetWorldSize = 3.4;
    const unitScale = targetWorldSize / unitMax;

    oreTypes.forEach(([type, color], index) => {
      const x = (index % 5) * 10 - 20;
      const z = Math.floor(index / 5) * 10 - 30;

      const root = template.clone(true);
      root.scale.setScalar(unitScale);
      root.rotation.y = (index * 0.37) % (Math.PI * 2);
      root.updateMatrixWorld(true);

      const bb = new THREE.Box3().setFromObject(root);
      const cx = (bb.min.x + bb.max.x) / 2;
      const cz = (bb.min.z + bb.max.z) / 2;
      root.position.set(-cx, -bb.min.y, -cz);

      this.tintOreGltf(root, color, type === "uranium");

      const clusterGroup = new THREE.Group();
      clusterGroup.name = `ore-demo-${type}`;
      clusterGroup.userData = { type: "ore_node", oreType: type };
      clusterGroup.add(root);
      clusterGroup.position.set(x, 0, z);
      this.scene.add(clusterGroup);

      const topY = new THREE.Box3().setFromObject(clusterGroup).max.y;
      this.addTextSprite(type, x, topY + 0.6, z);
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

  private effectiveGhostScale(): number {
    return this.prefabPlacementScale ?? this.builderScale;
  }

  isPrefabPlacementActive(): boolean {
    return (
      this.prefabPlacementScale !== null && this.builderGhostPivot !== null
    );
  }

  /** Префаб из меню (один GLB, голограмма как у конструктора) */
  async setPrefabBuildingGhost(
    partPath: string,
    scale: number,
    menuBuildingId: string,
  ): Promise<void> {
    this.clearBuilderGhost();
    this.setBuilderDeconstructMode(false);
    this.prefabMenuBuildingId = menuBuildingId;
    this.builderGhostRotY = 0;
    this.builderCurrentPartPath = partPath;
    this.conveyorRotOffset = isConveyorBeltMenuId(menuBuildingId)
      ? -Math.PI / 2
      : 0;

    if (isPipeLineMenuId(menuBuildingId) && isProceduralPipePartPath(partPath)) {
      this.builderMode = "free";
      this.pipePlacementSubMode = "leg";
      this.pipeJunctionLastTurn = 1;
      this.prefabPlacementScale = scale;
      const pivot = new THREE.Group();
      pivot.name = "prefab-menu-ghost";
      const step = GRID_CELL_SIZE;
      const r = proceduralPipeTubeRadiusWorld(
        menuBuildingId,
        this.effectiveGhostScale(),
      );
      const ghost = createProceduralStraightPipeObject(step, r);
      pivot.add(ghost);
      this.scene.add(pivot);
      this.builderGhostPivot = pivot;
      this.builderGhostModelRoot = ghost;
      this.normalizeGhostModel();
      this.applyProceduralPipeGhostMaterials();
      this.updateBuilderGhostPosition(
        this.builderPointerNDC.x,
        this.builderPointerNDC.y,
      );
      return;
    }

    let original = this.glbCache.get(partPath);
    if (!original) {
      const gltf = await this.loadGLB(this.buildingKitLoader, partPath);
      original = gltf.scene;
      this.glbCache.set(partPath, original);
    }

    this.prefabPlacementScale = usesConveyorGalleryFitScale(
      menuBuildingId,
      partPath,
    )
      ? scaleToFitMaxExtent(original)
      : scale;

    const ghost = original.clone(true);
    ghost.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.ghostMaterialOk;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    const pivot = new THREE.Group();
    pivot.name = "prefab-menu-ghost";
    pivot.add(ghost);
    this.scene.add(pivot);
    this.builderGhostPivot = pivot;
    this.builderGhostModelRoot = ghost;

    this.builderGhostModelRoot.scale.setScalar(this.effectiveGhostScale());
    this.normalizeGhostModel();
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
  }

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

    ghost.scale.setScalar(this.effectiveGhostScale());
    this.normalizeGhostModel();
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
  }

  /** Move ghost to ground intersection under NDC mouse coords */
  updateBuilderGhostPosition(
    ndcX: number,
    ndcY: number,
    altDeconstructHeld = false,
  ): void {
    this.builderPointerNDC.set(ndcX, ndcY);
    this.builderHasPointer = true;
    if (this.builderDeconstructMode && this.prefabPlacementScale === null) {
      this.updateDeconstructHover(ndcX, ndcY, altDeconstructHeld);
      return;
    }

    if (!this.builderGhostPivot) return;
    let pos = this.getGridPositionUnderMouse(ndcX, ndcY, this._visibleFloor);
    if (!pos && this.prefabPlacementScale !== null) {
      const floorY = this._visibleFloor * GRID_CELL_SIZE;
      pos = new THREE.Vector3(0, floorY, 0);
    }
    if (!pos) return;

    // Ctrl-held edge alignment: snap to the same line as a nearby building edge
    /** Трубы — только сетка + свои снапы; иначе рельсы/края уводят призрак и превью «в сторону». */
    if (!isPipeLineMenuId(this.prefabMenuBuildingId)) {
      this.edgeAlignToPlaced(pos);
    }

    const isConveyorGhost = isConveyorBeltMenuId(this.prefabMenuBuildingId);
    const isPipeLineGhost = isPipeLineMenuId(this.prefabMenuBuildingId);
    const isLineLogisticsGhost = isConveyorGhost || isPipeLineGhost;

    // Face-snap to nearby placed parts (overrides grid on both axes when close)
    if (!this.builderCtrlHeld && !isLineLogisticsGhost) this.faceSnapToPlaced(pos);

    // After XZ is final: sit on floor or on top of any placed volume under footprint + vertical probe
    if (!isLineLogisticsGhost) {
      this.resolveVerticalSupport(pos);
    } else if (isPipeLineGhost && !this.builderLineStart) {
      /** Труба без якоря: как у обычных префабов — иначе призрак «тонет» под сетку. */
      this.resolveVerticalSupport(pos);
    }

    this.conveyorTangentAtLineEnd = null;
    this.pipeLineEndSnappedToTarget = false;
    if (isConveyorGhost) {
      const snapRadius = this.getSegmentStep() * 1.5;
      const nearestEp = this.findNearestConveyorEndpoint(
        pos,
        snapRadius,
        "conveyor",
      );
      if (nearestEp) {
        pos.copy(nearestEp.position);
        if (this.builderLineStart) {
          this.conveyorTangentAtLineEnd = nearestEp.rotationY;
        }
      } else {
        const nearestPort = this.findNearestPort(pos, snapRadius);
        if (nearestPort) {
          pos.copy(nearestPort.worldPos);
        }
      }
    } else if (isPipeLineGhost) {
      const pipeStagedJunction =
        this.builderMode === "default" &&
        this.pipePlacementSubMode === "junction";
      /**
       * Угол колена от направления мыши: без привязки к сетке — иначе вектор от угла
       * к pos часто остаётся по одну сторону линии трассы, cross не меняет знак.
       * Для первого плеча pos по-прежнему с сеткой.
       */
      const cursorRaw = this.getFloorPositionUnderMouseRaw(
        ndcX,
        ndcY,
        this._visibleFloor,
      );
      const cursorDirForElbow =
        pipeStagedJunction && cursorRaw
          ? cursorRaw
          : pos.clone();
      if (!pipeStagedJunction) {
        const step = this.getSegmentStep();
        if (this.builderLineStart) {
          const snapRadius = step * 4;
          const nearestEp = this.findNearestConveyorEndpoint(
            pos,
            snapRadius,
            "pipe",
          );
          if (nearestEp) {
            pos.copy(nearestEp.position);
            this.builderGhostRotY = nearestEp.rotationY;
            this.conveyorTangentAtLineEnd = nearestEp.rotationY;
            this.pipeLineEndSnappedToTarget = true;
          } else {
            const nearestPort = this.findNearestPort(pos, snapRadius);
            if (nearestPort) {
              pos.copy(nearestPort.worldPos);
              this.builderGhostRotY = nearestPort.worldDir;
              this.conveyorTangentAtLineEnd = nearestPort.worldDir;
              this.pipeLineEndSnappedToTarget = true;
            } else if (this.builderMode === "free") {
              const step = this.getSegmentStep();
              if (!this.snapPipeFreeCursorToPlacedStraightCap(pos, step)) {
                const s = this.builderLineStart;
                pos.y = s.y;
                const ddx = pos.x - s.x;
                const ddz = pos.z - s.z;
                if (Math.hypot(ddx, ddz) > 1e-4) {
                  this.builderGhostRotY =
                    Math.atan2(ddx, ddz) + PIPE_RUN_ROT_Y_OFFSET;
                }
              }
            } else {
              const s = this.builderLineStart;
              pos.copy(snapPipeGhostXZ(s, pos));
              pos.y = s.y;
              const ddx = pos.x - s.x;
              const ddz = pos.z - s.z;
              if (Math.hypot(ddx, ddz) > 1e-4) {
                this.builderGhostRotY =
                  Math.atan2(ddx, ddz) + PIPE_RUN_ROT_Y_OFFSET;
              }
            }
          }
        } else {
          const snapRadius = step * 2.5;
          const nearestEp = this.findNearestConveyorEndpoint(
            pos,
            snapRadius,
            "pipe",
          );
          if (nearestEp) {
            pos.copy(nearestEp.position);
            this.builderGhostRotY = nearestEp.rotationY;
          } else {
            const nearestPort = this.findNearestPort(pos, snapRadius);
            if (nearestPort) {
              pos.copy(nearestPort.worldPos);
              this.builderGhostRotY = nearestPort.worldDir;
            }
          }
        }
      }
      if (pipeStagedJunction) {
        const { elbowRotY, outgoingStraightRotY, turn } =
          computePipeJunctionRotations(
            this.pipeIncomingStraightRotY,
            this.pipeJunctionManhattanCornerWorld,
            cursorDirForElbow,
          );
        this.pipeJunctionLastTurn = turn;
        this.builderGhostRotY = elbowRotY;
        this.pipeJunctionOutgoingStraightRotY = outgoingStraightRotY;
        pos.copy(this.pipeJunctionManhattanCornerWorld);
      }
    }

    this.builderGhostCurrentPos.copy(pos);
    this.builderGhostPivot.position.copy(pos);
    this.builderGhostPivot.rotation.y = this.builderGhostRotY;
    if (
      this.builderGhostModelRoot &&
      isKenneySpaceStationPipeAssetPath(this.builderCurrentPartPath)
    ) {
      this.builderGhostModelRoot.rotation.y = 0;
      if (isKenneySpaceStationPipeStraightPath(this.builderCurrentPartPath)) {
        this.builderGhostModelRoot.rotation.z = 0;
      }
    }

    let conveyorTooTight = false;
    if (
      isConveyorGhost &&
      this.builderMode === "default" &&
      this.builderLineStart
    ) {
      const s = this.builderLineStart;
      const ddx = this.builderGhostCurrentPos.x - s.x;
      const ddz = this.builderGhostCurrentPos.z - s.z;
      const st = this.getSegmentStep();
      if (Math.hypot(ddx, ddz) > 0.04) {
        conveyorTooTight = Math.min(Math.abs(ddx), Math.abs(ddz)) < st * 0.32;
      }
    }
    this.conveyorDefaultTooTight = conveyorTooTight;

    let pipeTooTight = false;
    if (
      isPipeLineGhost &&
      this.builderMode === "default" &&
      this.pipePlacementSubMode === "leg" &&
      this.builderLineStart
    ) {
      const s = this.builderLineStart;
      const ddx = this.builderGhostCurrentPos.x - s.x;
      const ddz = this.builderGhostCurrentPos.z - s.z;
      const st = this.getSegmentStep();
      const runLen = Math.max(Math.abs(ddx), Math.abs(ddz));
      if (runLen > 0.04) {
        pipeTooTight = runLen < st * 0.32;
      }
    }
    this.pipeDefaultTooTight = pipeTooTight;

    let pipeBodyOverlap = false;
    if (
      isPipeLineGhost &&
      this.pipePlacementSubMode === "leg" &&
      isProceduralPipePartPath(this.builderCurrentPartPath) &&
      this.builderCurrentPartPath === PIPE_PROCEDURAL_STRAIGHT_PATH &&
      this.builderLineStart
    ) {
      const st = this.getSegmentStep();
      /**
       * Каждое обновление: начинаем с авто-флип = 0 (используется только preferred).
       * Если коллизия обнаружена — пробуем альтернативную ось (auto = !auto).
       * Если обе плохи — pipeBodyOverlap=true.
       */
      this.pipeAutoAxisFlip = false;
      const lineStart = this.builderLineStart;
      const lineEnd = pos;
      const checkOverlap = (): boolean => {
        const previewSegs = this.getPipeLineBodyCollisionPipeSegments(
          lineStart,
          lineEnd,
        );
        for (const s of previewSegs) {
          if (s.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
          const chord =
            typeof s.straightChordMeters === "number"
              ? s.straightChordMeters
              : st;
          if (
            this.proceduralStraightPipeWouldCollideBody(
              s.position,
              s.rotationY,
              chord,
            )
          ) {
            return true;
          }
        }
        return false;
      };
      const overlapPreferred = checkOverlap();
      if (overlapPreferred) {
        this.pipeAutoAxisFlip = true;
        const overlapAlt = checkOverlap();
        if (overlapAlt) {
          pipeBodyOverlap = true;
          this.pipeAutoAxisFlip = false;
        }
      }
    } else {
      this.pipeAutoAxisFlip = false;
    }

    let pipeFreeOverlap = false;
    if (
      isPipeLineGhost &&
      this.pipePlacementSubMode === "leg" &&
      this.builderMode === "free" &&
      this.builderLineStart &&
      this.builderCurrentPartPath === PIPE_PROCEDURAL_STRAIGHT_PATH
    ) {
      const st = this.getSegmentStep();
      const pts = computePipeFreeCurvePath(
        this.builderLineStart,
        this.builderGhostCurrentPos,
        this.conveyorTangentAtLineStart,
        this.conveyorTangentAtLineEnd,
        this.builderGhostRotY,
        st,
      );
      pipeFreeOverlap = this.pipeFreeCurveSampleCollides(pts, st);
    }

    let pipeFreeTooSharp = false;
    if (
      isPipeLineGhost &&
      this.pipePlacementSubMode === "leg" &&
      this.builderMode === "free" &&
      this.builderLineStart &&
      this.builderCurrentPartPath === PIPE_PROCEDURAL_STRAIGHT_PATH
    ) {
      const st = this.getSegmentStep();
      pipeFreeTooSharp = pipeFreeCurvePlacementTooSharp(
        this.builderLineStart,
        this.builderGhostCurrentPos,
        this.conveyorTangentAtLineStart,
        this.conveyorTangentAtLineEnd,
        this.builderGhostRotY,
        st,
      );
    }

    this.builderGhostInvalid = isConveyorGhost
      ? conveyorTooTight
      : isPipeLineGhost
        ? pipeTooTight ||
          pipeBodyOverlap ||
          pipeFreeOverlap ||
          pipeFreeTooSharp
        : this.computeGhostInvalid(this.builderGhostPivot);
    this.refreshGhostMaterial();

    const isMultiSegmentMode = this.builderMode !== "single";
    const pipeJunctionPreviewBlocksLine =
      isPipeLineGhost &&
      this.builderMode === "default" &&
      this.pipePlacementSubMode === "junction";
    const linePreviewActive =
      isMultiSegmentMode &&
      this.builderLineStart &&
      !pipeJunctionPreviewBlocksLine &&
      (this.prefabPlacementScale === null ||
        isConveyorBeltMenuId(this.prefabMenuBuildingId) ||
        isPipeLineMenuId(this.prefabMenuBuildingId));
    if (this.builderGhostPivot && isPipeLineGhost) {
      this.builderGhostPivot.visible = !linePreviewActive;
    }
    if (linePreviewActive) {
      this.rebuildLinePreview(
        this.builderLineStart!,
        this.builderGhostCurrentPos,
      );
    } else {
      this.builderLinePreviewGroup.clear();
    }

  }

  /** Place the ghost part permanently and record it */
  placeBuilderPart(): boolean {
    if (this.builderDeconstructMode && this.prefabPlacementScale === null) {
      if (this.deconstructHovered) {
        if (this.deconstructHovered.userData.compositeId) {
          return false;
        }
        if (this.isDeconstructStandaloneLogisticsHover()) {
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

    const isConveyorLine =
      this.builderMode !== "single" &&
      this.prefabPlacementScale !== null &&
      isConveyorBeltMenuId(this.prefabMenuBuildingId);

    const isPipeLinePlacement =
      this.builderMode !== "single" &&
      this.prefabPlacementScale !== null &&
      isPipeLineMenuId(this.prefabMenuBuildingId);

    const isMenuLinePlacement = isConveyorLine || isPipeLinePlacement;

    const hasLineAnchor =
      isMenuLinePlacement &&
      (this.builderLineStart !== null ||
        (isPipeLinePlacement &&
          this.builderMode === "default" &&
          this.pipePlacementSubMode === "junction"));

    const lineTooTight = isConveyorLine
      ? this.conveyorDefaultTooTight
      : isPipeLinePlacement
        ? this.pipeDefaultTooTight
        : false;

    if (
      !this.builderGhostPivot ||
      !this.builderCurrentPartPath ||
      (this.builderGhostInvalid &&
        (!hasLineAnchor || lineTooTight || isPipeLinePlacement))
    )
      return false;

    if (isMenuLinePlacement) {
      if (isPipeLinePlacement && this.builderMode === "default") {
        if (this.pipePlacementSubMode === "junction") {
          return this.placePipeJunctionClick();
        }
        if (!this.builderLineStart) {
          this.builderLineStart = this.builderGhostCurrentPos.clone();
          const snapR = this.getSegmentStep() * 3;
          const ep0 = this.findNearestConveyorEndpoint(
            this.builderLineStart,
            snapR,
            "pipe",
          );
          if (ep0) {
            this.builderLineStart.copy(ep0.position);
            this.conveyorTangentAtLineStart = ep0.rotationY;
          } else {
            const port0 = this.findNearestPort(this.builderLineStart, snapR);
            if (port0) {
              this.builderLineStart.copy(port0.worldPos);
              this.conveyorTangentAtLineStart = port0.worldDir;
            } else {
              this.conveyorTangentAtLineStart = null;
            }
          }
          this.rebuildLinePreview(
            this.builderLineStart,
            this.builderGhostCurrentPos,
          );
          return false;
        }
        return this.placePipeStraightLegClick();
      }

      if (!this.builderLineStart) {
        this.builderLineStart = this.builderGhostCurrentPos.clone();
        const snapR = this.getSegmentStep() * (isPipeLinePlacement ? 3 : 1.5);
        if (isConveyorLine) {
          const epAtStart = this.findNearestConveyorEndpoint(
            this.builderLineStart,
            snapR,
            "conveyor",
          );
          this.conveyorTangentAtLineStart =
            epAtStart != null ? epAtStart.rotationY : null;
        } else {
          const ep0 = this.findNearestConveyorEndpoint(
            this.builderLineStart,
            snapR,
            "pipe",
          );
          if (ep0) {
            this.builderLineStart.copy(ep0.position);
            this.conveyorTangentAtLineStart = ep0.rotationY;
            if (this.builderMode === "free") {
              const st = this.getSegmentStep();
              this.builderLineStart.copy(
                this.refinePipeFreeEndpointToPipeOpenFace(
                  this.builderLineStart,
                  ep0.rotationY,
                  st,
                ),
              );
            }
          } else {
            const port0 = this.findNearestPort(this.builderLineStart, snapR);
            if (port0) {
              this.builderLineStart.copy(port0.worldPos);
              this.conveyorTangentAtLineStart = port0.worldDir;
              if (this.builderMode === "free") {
                const st = this.getSegmentStep();
                this.builderLineStart.copy(
                  this.refinePipeFreeEndpointToPipeOpenFace(
                    this.builderLineStart,
                    port0.worldDir,
                    st,
                  ),
                );
              }
            } else {
              this.conveyorTangentAtLineStart = null;
            }
          }
        }
        this.rebuildLinePreview(
          this.builderLineStart,
          this.builderGhostCurrentPos,
        );
        return false;
      }
      const start = this.builderLineStart.clone();
      const end = this.builderGhostCurrentPos.clone();
      this.builderLinePreviewGroup.clear();
      if (
        isPipeLineMenuId(this.prefabMenuBuildingId) &&
        this.builderMode === "free"
      ) {
        return this.placePipeFreeCurveLeg(start, end);
      }
      const segments = this.computePathSegments(start, end);
      const compositeId = this.newCompositeId();
      const segmentScale = this.prefabPlacementScale ?? this.builderScale;
      const stepSeg = this.getSegmentStep();
      if (
        isPipeLineMenuId(this.prefabMenuBuildingId) &&
        this.builderMode !== "default"
      ) {
        assignPipeStraightChordMeters(segments as PipePathSegment[], end, stepSeg);
        for (const seg of segments) {
          const pp =
            "partPath" in seg && typeof seg.partPath === "string"
              ? seg.partPath
              : this.builderCurrentPartPath;
          if (pp !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
          const chord =
            typeof seg.straightChordMeters === "number"
              ? seg.straightChordMeters
              : stepSeg;
          if (
            this.proceduralStraightPipeWouldCollideBody(
              seg.position,
              seg.rotationY,
              chord,
            )
          ) {
            return false;
          }
        }
      }
      let placedAny = false;
      for (const seg of segments) {
        const partPath =
          "partPath" in seg && typeof seg.partPath === "string"
            ? seg.partPath
            : this.builderCurrentPartPath;
        const pipeSeg =
          isPipeLineMenuId(this.prefabMenuBuildingId) &&
          isProceduralPipePartPath(partPath)
            ? {
                segmentStep: stepSeg,
                ...(partPath === PIPE_PROCEDURAL_STRAIGHT_PATH &&
                typeof seg.straightChordMeters === "number"
                  ? { straightChordMeters: seg.straightChordMeters }
                  : {}),
                ...(partPath === PIPE_PROCEDURAL_ELBOW_PATH &&
                seg.elbowIncomingRotY !== undefined &&
                seg.elbowTurn !== undefined
                  ? {
                      elbowIncomingRotY: seg.elbowIncomingRotY,
                      elbowTurn: seg.elbowTurn,
                    }
                  : {}),
              }
            : undefined;
        placedAny =
          this.placeSingleAt(
            seg.position,
            seg.rotationY,
            segmentScale,
            compositeId,
            this.prefabMenuBuildingId ?? undefined,
            partPath,
            pipeSeg,
          ) || placedAny;
      }
      if (placedAny) {
        this.persistBuilderState();
        const step = this.getSegmentStep();
        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];
        if (firstSeg) {
          if (isConveyorLine) {
            const dir = firstSeg.rotationY - this.conveyorRotOffset;
            this.conveyorEndpoints.push({
              position: new THREE.Vector3(
                firstSeg.position.x - Math.sin(dir) * step,
                firstSeg.position.y,
                firstSeg.position.z - Math.cos(dir) * step,
              ),
              rotationY: firstSeg.rotationY,
              compositeId,
              lineKind: "conveyor",
            });
          } else {
            const dir = firstSeg.rotationY - PIPE_RUN_ROT_Y_OFFSET;
            this.conveyorEndpoints.push({
              position: new THREE.Vector3(
                firstSeg.position.x - Math.sin(dir) * step,
                firstSeg.position.y,
                firstSeg.position.z - Math.cos(dir) * step,
              ),
              rotationY: firstSeg.rotationY,
              compositeId,
              lineKind: "pipe",
            });
          }
        }
        if (lastSeg) {
          if (isConveyorLine) {
            const dir = lastSeg.rotationY - this.conveyorRotOffset;
            this.conveyorEndpoints.push({
              position: new THREE.Vector3(
                lastSeg.position.x + Math.sin(dir) * step,
                lastSeg.position.y,
                lastSeg.position.z + Math.cos(dir) * step,
              ),
              rotationY: lastSeg.rotationY,
              compositeId,
              lineKind: "conveyor",
            });
          } else {
            const dir = lastSeg.rotationY - PIPE_RUN_ROT_Y_OFFSET;
            this.conveyorEndpoints.push({
              position: new THREE.Vector3(
                lastSeg.position.x + Math.sin(dir) * step,
                lastSeg.position.y,
                lastSeg.position.z + Math.cos(dir) * step,
              ),
              rotationY: lastSeg.rotationY,
              compositeId,
              lineKind: "pipe",
            });
          }
        }
      }
      const lastSeg = segments[segments.length - 1];
      if (lastSeg) {
        const step = this.getSegmentStep();
        if (isConveyorLine) {
          const dir = lastSeg.rotationY - this.conveyorRotOffset;
          this.builderLineStart = new THREE.Vector3(
            lastSeg.position.x + Math.sin(dir) * step,
            lastSeg.position.y,
            lastSeg.position.z + Math.cos(dir) * step,
          );
          this.conveyorTangentAtLineStart = lastSeg.rotationY;
        } else {
          const dir = lastSeg.rotationY - PIPE_RUN_ROT_Y_OFFSET;
          this.builderLineStart = new THREE.Vector3(
            lastSeg.position.x + Math.sin(dir) * step,
            lastSeg.position.y,
            lastSeg.position.z + Math.cos(dir) * step,
          );
          this.conveyorTangentAtLineStart = null;
        }
      } else {
        this.builderLineStart = end.clone();
        this.conveyorTangentAtLineStart = null;
      }
      return placedAny;
    }

    if (this.builderMode !== "single" && this.prefabPlacementScale === null) {
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
      const records = getAxisLinePlacementPositions(
        start,
        end,
        this.getRotatedFootprint(),
      );
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

    const scale = this.prefabPlacementScale ?? this.builderScale;
    const compositeId =
      this.prefabPlacementScale !== null ? this.newCompositeId() : undefined;
    const placed = this.placeSingleAt(
      this.builderGhostCurrentPos,
      undefined,
      scale,
      compositeId,
      this.prefabMenuBuildingId ?? undefined,
    );
    if (placed) {
      this.persistBuilderState();
      if (this.prefabPlacementScale !== null) {
        this.clearBuilderGhost();
      }
    }
    return placed;
  }

  /** Rotate ghost by 90° */
  rotateBuilderGhost(dir: 1 | -1): void {
    /**
     * В линейной трубе с активным якорем линии rotationY всё равно
     * перезаписывается направлением start->cursor каждый кадр; «сырой» поворот
     * только сдвигает голограмму. Вместо этого тогглим приоритетную ось L —
     * пользователь получает обход вокруг конечной точки.
     */
    const pipeLineAxisToggle =
      isPipeLineMenuId(this.prefabMenuBuildingId) &&
      this.builderMode === "default" &&
      this.builderLineStart !== null;
    if (pipeLineAxisToggle) {
      this.pipePreferredAxisFlip = !this.pipePreferredAxisFlip;
    } else {
      this.builderGhostRotY += dir * (Math.PI / 2);
      if (this.builderGhostPivot) {
        this.builderGhostPivot.rotation.y = this.builderGhostRotY;
      }
      this.normalizeGhostModel();
    }
    /**
     * Голограмма не должна оставаться в старом snap-результате до движения мыши:
     * пересчитываем позицию pivot и превью линии немедленно.
     */
    if (this.builderGhostPivot && this.builderHasPointer) {
      this.updateBuilderGhostPosition(
        this.builderPointerNDC.x,
        this.builderPointerNDC.y,
      );
    }
  }

  /** Якорь линии (конвейер или труба) — ПКМ отменяет только якорь, не весь режим. */
  hasActiveConveyorLine(): boolean {
    const conv = isConveyorBeltMenuId(this.prefabMenuBuildingId);
    const pipe = isPipeLineMenuId(this.prefabMenuBuildingId);
    if (!conv && !pipe) return false;
    if (this.builderLineStart !== null) return true;
    return (
      pipe &&
      this.builderMode === "default" &&
      this.pipePlacementSubMode === "junction"
    );
  }

  /** Снять якорь линии, призрак остаётся. */
  cancelConveyorLine(): void {
    const wasPipeJunction =
      isPipeLineMenuId(this.prefabMenuBuildingId) &&
      this.pipePlacementSubMode === "junction";
    this.builderLineStart = null;
    this.conveyorTangentAtLineStart = null;
    this.conveyorTangentAtLineEnd = null;
    this.conveyorDefaultTooTight = false;
    this.pipeDefaultTooTight = false;
    this.pipePreferredAxisFlip = false;
    this.pipeAutoAxisFlip = false;
    this.pipePlacementSubMode = "leg";
    this.pipeJunctionLastTurn = 1;
    this.pipeJunctionManhattanCornerWorld.set(0, 0, 0);
    this.builderLinePreviewGroup.clear();
    if (wasPipeJunction && this.builderGhostPivot) {
      this.restorePipeMenuStraightGhostModel();
    }
  }

  /** Remove ghost without placing */
  clearBuilderGhost(): void {
    if (this.builderGhostPivot) {
      this.scene.remove(this.builderGhostPivot);
      this.builderGhostPivot = null;
    }
    this.builderGhostModelRoot = null;
    this.builderCurrentPartPath = "";
    this.prefabPlacementScale = null;
    this.prefabMenuBuildingId = null;
    this.builderLineStart = null;
    this.conveyorTangentAtLineStart = null;
    this.conveyorTangentAtLineEnd = null;
    this.conveyorDefaultTooTight = false;
    this.pipeDefaultTooTight = false;
    this.pipePreferredAxisFlip = false;
    this.pipeAutoAxisFlip = false;
    this.pipePlacementSubMode = "leg";
    this.pipeJunctionLastTurn = 1;
    this.pipeJunctionManhattanCornerWorld.set(0, 0, 0);
    this.builderLinePreviewGroup.clear();
    this.builderGhostInvalid = false;
  }

  /** Remove all placed parts from scene and memory */
  clearBuilderComposition(): void {
    this.builderPlacedGroup.clear();
    this.builderPlaced = [];
    this.placedPorts.length = 0;
    this.conveyorEndpoints.length = 0;
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
          if (p.menuBuildingId) row.menuBuildingId = p.menuBuildingId;
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
      const partPath = resolveBuilderModelPath(partName);
      try {
        await this.ensureCached(partPath);
      } catch (err) {
        console.warn(
          `[Import] Skip part (load failed) "${partName}" -> ${partPath}:`,
          err,
        );
        continue;
      }
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

  setBuilderMode(mode: BuilderMode): void {
    this.builderMode = mode;
    if (
      this.prefabPlacementScale !== null &&
      isPipeLineMenuId(this.prefabMenuBuildingId) &&
      this.builderMode !== "single" &&
      this.builderMode !== "free"
    ) {
      this.builderMode = "free";
    }
    this.builderLineStart = null;
    this.builderLinePreviewGroup.clear();
    this.conveyorTangentAtLineStart = null;
    this.conveyorTangentAtLineEnd = null;
    this.conveyorDefaultTooTight = false;
    this.pipeDefaultTooTight = false;
    this.pipePreferredAxisFlip = false;
    this.pipeAutoAxisFlip = false;
    this.pipePlacementSubMode = "leg";
    this.pipeJunctionManhattanCornerWorld.set(0, 0, 0);
    if (
      isPipeLineMenuId(this.prefabMenuBuildingId) &&
      this.builderGhostPivot &&
      this.builderCurrentPartPath === PIPE_PROCEDURAL_ELBOW_PATH
    ) {
      this.restorePipeMenuStraightGhostModel();
    }
    if (this.builderGhostPivot && this.builderHasPointer) {
      this.updateBuilderGhostPosition(
        this.builderPointerNDC.x,
        this.builderPointerNDC.y,
      );
    }
  }

  cycleBuilderMode(): BuilderMode {
    if (
      this.prefabPlacementScale !== null &&
      isPipeLineMenuId(this.prefabMenuBuildingId)
    ) {
      return this.builderMode;
    }
    if (this.builderMode === "single") {
      this.setBuilderMode("default");
    } else {
      const idx = CONVEYOR_PLACEMENT_MODES.indexOf(
        this.builderMode as ConveyorPlacementMode,
      );
      const next =
        idx >= 0
          ? CONVEYOR_PLACEMENT_MODES[
              (idx + 1) % CONVEYOR_PLACEMENT_MODES.length
            ]
          : "default";
      this.setBuilderMode(next);
    }
    return this.builderMode;
  }

  getBuilderMode(): BuilderMode {
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
  refreshDeconstructHoverFromPointer(altHeld = false): void {
    if (!this.builderDeconstructMode || !this.builderHasPointer) return;
    this.updateDeconstructHover(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
      altHeld,
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

  /** Одиночная деталь логистики под курсором (без compositeId) — снос только удержанием ЛКМ. */
  isDeconstructStandaloneLogisticsHover(): boolean {
    const h = this.deconstructHovered;
    if (!h || h.userData?.compositeId) return false;
    const rec = h.userData?.builderRecord as
      | BuilderPlacedPartRecord
      | undefined;
    if (!rec) return false;
    if (isLogisticsMenuBuildingId(rec.menuBuildingId)) return true;
    if (isLogisticsConveyorKitPath(rec.partPath)) return true;
    if (isProceduralPipePartPath(rec.partPath)) return true;
    return false;
  }

  /** Длительность удержания для текущего hover (логистика 0.2 с, остальное 2 с). */
  getDeconstructHoldMsForCurrentHover(): number {
    if (this.deconstructMultiRoots.size > 0) {
      for (const root of this.deconstructMultiRoots) {
        const cid = root.userData?.compositeId;
        if (typeof cid === "string" && !this.isCompositeLogisticsOnly(cid)) {
          return DECONSTRUCT_HOLD_DEFAULT_MS;
        }
      }
      return DECONSTRUCT_HOLD_LOGISTICS_MS;
    }
    const cid = this.getDeconstructHoverCompositeId();
    if (cid) {
      return this.isCompositeLogisticsOnly(cid)
        ? DECONSTRUCT_HOLD_LOGISTICS_MS
        : DECONSTRUCT_HOLD_DEFAULT_MS;
    }
    if (this.isDeconstructStandaloneLogisticsHover()) {
      return DECONSTRUCT_HOLD_LOGISTICS_MS;
    }
    return DECONSTRUCT_HOLD_DEFAULT_MS;
  }

  private isCompositeLogisticsOnly(compositeId: string): boolean {
    const parts = this.builderPlaced.filter(
      (p) => p.compositeId === compositeId,
    );
    if (parts.length === 0) return false;
    return parts.every((p) => {
      if (isLogisticsMenuBuildingId(p.menuBuildingId)) return true;
      if (isLogisticsConveyorKitPath(p.partPath)) return true;
      if (isProceduralPipePartPath(p.partPath)) return true;
      return false;
    });
  }

  removeDeconstructHoveredStandalone(): boolean {
    if (!this.deconstructHovered) return false;
    if (this.deconstructHovered.userData?.compositeId) return false;
    const targets =
      this.deconstructRunHighlightRoots.length > 0
        ? [...this.deconstructRunHighlightRoots]
        : [this.deconstructHovered];
    let removed = false;
    for (const h of targets) {
      if (h.userData?.compositeId) continue;
      const rec = h.userData?.builderRecord as BuilderPlacedPartRecord | undefined;
      if (!rec) continue;
      this.builderPlacedGroup.remove(h);
      this.removePortsForBuilding(h as THREE.Group);
      this.builderPlaced = this.builderPlaced.filter((p) => p !== rec);
      removed = true;
    }
    if (!removed) return false;
    this.clearDeconstructHover();
    this.persistBuilderState();
    return true;
  }

  getDeconstructMultiSelectionCount(): number {
    return this.deconstructMultiRoots.size;
  }

  isDeconstructHoveredInMultiSelection(): boolean {
    const h = this.deconstructHovered;
    return !!h && this.deconstructMultiRoots.has(h);
  }

  /** Снос всех объектов, подсвеченных через Alt+hover (сборки по compositeId дедуплицируются). */
  removeDeconstructMultiSelection(): boolean {
    if (this.deconstructMultiRoots.size === 0) return false;
    const compositeIds = new Set<string>();
    const singleRoots: THREE.Object3D[] = [];
    for (const root of this.deconstructMultiRoots) {
      const cid = root.userData?.compositeId;
      if (typeof cid === "string") compositeIds.add(cid);
      else singleRoots.push(root);
    }
    for (const cid of compositeIds) {
      this.removeCompositeBuilding(cid);
    }
    for (const root of singleRoots) {
      this.builderPlacedGroup.remove(root);
      this.removePortsForBuilding(root as THREE.Group);
      const rec = root.userData?.builderRecord as
        | BuilderPlacedPartRecord
        | undefined;
      if (rec) {
        this.builderPlaced = this.builderPlaced.filter((p) => p !== rec);
      }
    }
    this.clearDeconstructHover();
    this.persistBuilderState();
    return true;
  }

  /**
   * Экранная позиция круга удержания: центр pivot под курсором (дешево, без union bbox по сотням мешей).
   */
  getDeconstructCompositeHoldScreenPosition(): {
    left: number;
    top: number;
  } | null {
    const multi = this.deconstructMultiRoots.size > 0;
    const hovered = this.deconstructHovered;
    const run =
      !multi && this.deconstructRunHighlightRoots.length > 0
        ? this.deconstructRunHighlightRoots
        : null;
    const pivotForRing =
      multi && hovered && this.deconstructMultiRoots.has(hovered)
        ? hovered
        : multi
          ? [...this.deconstructMultiRoots][0]!
          : hovered;
    if (!pivotForRing && (!run || run.length === 0)) return null;
    if (
      !multi &&
      !this.getDeconstructHoverCompositeId() &&
      !this.isDeconstructStandaloneLogisticsHover()
    ) {
      return null;
    }
    const c = new THREE.Vector3();
    if (run && run.length > 0 && !multi) {
      for (const r of run) {
        const p = new THREE.Vector3();
        r.getWorldPosition(p);
        c.add(p);
      }
      c.multiplyScalar(1 / run.length);
    } else if (pivotForRing) {
      pivotForRing.getWorldPosition(c);
    } else {
      return null;
    }
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
      this.removePortsForBuilding(c as THREE.Group);
      const rec = c.userData.builderRecord as
        | BuilderPlacedPartRecord
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
    if (removed > 0) {
      for (let i = this.conveyorEndpoints.length - 1; i >= 0; i--) {
        if (this.conveyorEndpoints[i].compositeId === compositeId) {
          this.conveyorEndpoints.splice(i, 1);
        }
      }
      this.persistBuilderState();
    }
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
    if (isProceduralPipePartPath(partPath)) return;
    if (this.glbCache.has(partPath)) return;
    const gltf = await this.loadGLB(this.buildingKitLoader, partPath);
    this.glbCache.set(partPath, gltf.scene);
  }

  private applyGhostScale(): void {
    if (!this.builderGhostModelRoot || !this.builderGhostPivot) return;
    if (
      isPipeLineMenuId(this.prefabMenuBuildingId) &&
      isProceduralPipePartPath(this.builderCurrentPartPath)
    ) {
      const menuId = this.prefabMenuBuildingId!;
      const step =
        this.builderCurrentPartPath === PIPE_PROCEDURAL_STRAIGHT_PATH
          ? GRID_CELL_SIZE
          : this.getSegmentStep();
      const r = proceduralPipeTubeRadiusWorld(
        menuId,
        this.effectiveGhostScale(),
      );
      while (this.builderGhostPivot.children.length > 0) {
        const c = this.builderGhostPivot.children[0]!;
        this.builderGhostPivot.remove(c);
      }
      const ghost =
        this.builderCurrentPartPath === PIPE_PROCEDURAL_STRAIGHT_PATH
          ? createProceduralStraightPipeObject(step, r)
          : createProceduralElbowPipeObject(
              this.pipeIncomingStraightRotY,
              this.pipeJunctionLastTurn,
              step,
              r,
            );
      this.builderGhostPivot.add(ghost);
      this.builderGhostModelRoot = ghost;
      this.normalizeGhostModel();
      this.applyProceduralPipeGhostMaterials();
      return;
    }
    this.builderGhostModelRoot.scale.setScalar(this.effectiveGhostScale());
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

    if (isProceduralPipePartPath(this.builderCurrentPartPath)) {
      const g = this.builderGhostModelRoot;
      offsetProceduralPipeRootToSitOnFloor(g, this.builderCurrentPartPath);
      const box = new THREE.Box3().setFromObject(g);
      const sz = box.getSize(new THREE.Vector3());
      /** Логический отпечаток на сетке — не диаметр трубы, иначе ломается face/edge snap. */
      this.builderGhostFootprint.set(
        GRID_CELL_SIZE,
        Math.max(sz.y, 0.2),
        GRID_CELL_SIZE,
      );
      return;
    }

    const original = this.glbCache.get(this.builderCurrentPartPath);
    if (!original) return;

    const origBox = new THREE.Box3().setFromObject(original);
    const origCenter = origBox.getCenter(new THREE.Vector3());
    const origSize = origBox.getSize(new THREE.Vector3());
    const s = this.effectiveGhostScale();

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

    if (
      (isPipeLineMenuId(this.prefabMenuBuildingId) ||
        isPipeJunctionMenuId(this.prefabMenuBuildingId)) &&
      isKenneySpaceStationPipeAssetPath(this.builderCurrentPartPath)
    ) {
      this.applyKenneyPipeLayFlatToRoot(
        this.builderGhostModelRoot,
        this.builderCurrentPartPath,
      );
      this.refreshPipeGhostFootprintAfterLayFlat();
    }
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

  private applyProceduralPipeGhostMaterials(): void {
    if (!this.builderGhostModelRoot) return;
    if (!isProceduralPipePartPath(this.builderCurrentPartPath)) return;
    const src = this.builderGhostInvalid
      ? this.ghostMaterialInvalid
      : this.ghostMaterialOk;
    this.builderGhostModelRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = src.clone();
        m.side = THREE.DoubleSide;
        child.material = m;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }

  private refreshGhostMaterial(): void {
    if (!this.builderGhostModelRoot) return;
    if (isProceduralPipePartPath(this.builderCurrentPartPath)) {
      this.applyProceduralPipeGhostMaterials();
      return;
    }
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
    menuBuildingId?: string,
    /** Иначе берётся builderCurrentPartPath (линия конвейера + стойка). */
    sourcePath?: string,
    pipeSeg?: {
      segmentStep: number;
      elbowIncomingRotY?: number;
      elbowTurn?: 1 | -1;
      straightChordMeters?: number;
      freeCurvePoints?: { x: number; y: number; z: number }[];
      tubeRadius?: number;
    },
  ): boolean {
    const path = sourcePath ?? this.builderCurrentPartPath;
    if (!path) return false;

    const rotY =
      typeof forcedRotY === "number" ? forcedRotY : this.builderGhostRotY;
    const baseScale =
      typeof forcedScale === "number" ? forcedScale : this.builderScale;

    if (isProceduralPipePartPath(path)) {
      const scale = baseScale;
      const stepLen = pipeSeg?.segmentStep ?? GRID_CELL_SIZE;
      const chordLen =
        path === PIPE_PROCEDURAL_STRAIGHT_PATH &&
        typeof pipeSeg?.straightChordMeters === "number"
          ? pipeSeg.straightChordMeters
          : stepLen;
      const tubeR = proceduralPipeTubeRadiusWorld(menuBuildingId, scale);
      let placed: THREE.Group;
      if (path === PIPE_PROCEDURAL_STRAIGHT_PATH) {
        placed = createProceduralStraightPipeObject(chordLen, tubeR);
      } else if (path === PIPE_PROCEDURAL_FREE_CURVE_PATH) {
        const raw = pipeSeg?.freeCurvePoints;
        if (!raw || raw.length < 2) return false;
        const wp = raw.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const tr =
          typeof pipeSeg?.tubeRadius === "number" ? pipeSeg.tubeRadius : tubeR;
        placed = createProceduralFreeCurvePipeObject(wp, tr, stepLen);
      } else {
        if (
          pipeSeg?.elbowIncomingRotY === undefined ||
          pipeSeg?.elbowTurn === undefined
        ) {
          return false;
        }
        placed = createProceduralElbowPipeObject(
          pipeSeg.elbowIncomingRotY,
          pipeSeg.elbowTurn,
          stepLen,
          tubeR,
        );
      }
      placed.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      if (menuBuildingId) {
        applyPrefabMaterialPalette(menuBuildingId, placed);
      }
      const pivot = new THREE.Group();
      pivot.add(placed);
      offsetProceduralPipeRootToSitOnFloor(placed, path);
      pivot.position.copy(worldPos);
      pivot.rotation.y =
        path === PIPE_PROCEDURAL_ELBOW_PATH ||
        path === PIPE_PROCEDURAL_FREE_CURVE_PATH
          ? 0
          : rotY;

      if (path === PIPE_PROCEDURAL_STRAIGHT_PATH) {
        if (
          this.proceduralStraightPipeWouldCollideBody(
            worldPos,
            rotY,
            chordLen,
            compositeId,
          )
        ) {
          return false;
        }
      }

      const record: BuilderPlacedPartRecord = {
        partPath: path,
        x: pivot.position.x,
        y: pivot.position.y,
        z: pivot.position.z,
        rotY: pivot.rotation.y,
        scale,
        segmentStep: stepLen,
      };
      if (path === PIPE_PROCEDURAL_STRAIGHT_PATH) {
        record.straightChordMeters = chordLen;
      }
      if (path === PIPE_PROCEDURAL_ELBOW_PATH && pipeSeg) {
        record.elbowIncomingRotY = pipeSeg.elbowIncomingRotY;
        record.elbowTurn = pipeSeg.elbowTurn;
      }
      if (path === PIPE_PROCEDURAL_FREE_CURVE_PATH && pipeSeg?.freeCurvePoints) {
        record.freeCurvePoints = pipeSeg.freeCurvePoints.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        record.tubeRadius =
          typeof pipeSeg.tubeRadius === "number" ? pipeSeg.tubeRadius : tubeR;
      }
      if (compositeId) {
        record.compositeId = compositeId;
        pivot.userData.compositeId = compositeId;
      }
      if (menuBuildingId) {
        record.menuBuildingId = menuBuildingId;
        pivot.userData.menuBuildingId = menuBuildingId;
      }
      pivot.userData.builderRecord = record;
      this.builderPlacedGroup.add(pivot);
      this.builderPlaced.push(record);
      if (path === PIPE_PROCEDURAL_STRAIGHT_PATH) {
        this.consumePipeEndpointsForStraightSegment(
          pivot.position,
          rotY,
          chordLen,
        );
      }
      if (menuBuildingId) {
        this.attachBuildingPorts(pivot, menuBuildingId, scale, rotY);
      }
      return true;
    }

    const original = this.glbCache.get(path);
    if (!original) return false;

    const scale = usesConveyorGalleryFitScale(menuBuildingId, path)
      ? scaleToFitMaxExtent(original)
      : baseScale;

    const placed = original.clone(true);
    placed.scale.setScalar(scale);
    placed.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (menuBuildingId) {
      applyPrefabMaterialPalette(menuBuildingId, placed);
    }

    // Normalize: center on XZ, bottom at y=0 (same formula as normalizeGhostModel)
    const origBox = new THREE.Box3().setFromObject(original);
    const origCenter = origBox.getCenter(new THREE.Vector3());
    placed.position.set(
      -origCenter.x * scale,
      -origBox.min.y * scale,
      -origCenter.z * scale,
    );

    this.applyKenneyPipeLayFlatToRoot(placed, path);

    const pivot = new THREE.Group();
    pivot.add(placed);
    pivot.position.copy(worldPos);
    pivot.rotation.y = rotY;

    const record: BuilderPlacedPartRecord = {
      partPath: path,
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
    if (menuBuildingId) {
      record.menuBuildingId = menuBuildingId;
      pivot.userData.menuBuildingId = menuBuildingId;
    }
    pivot.userData.builderRecord = record;
    this.builderPlacedGroup.add(pivot);
    this.builderPlaced.push(record);

    if (menuBuildingId) {
      this.attachBuildingPorts(pivot, menuBuildingId, scale, rotY);
    }

    return true;
  }

  /**
   * Load and attach I/O port models to a placed building, and register
   * world-space port positions for conveyor auto-snap.
   */
  private async attachBuildingPorts(
    buildingPivot: THREE.Group,
    buildingId: string,
    buildingScale: number,
    buildingRotY: number,
  ): Promise<void> {
    const ports = getBuildingPorts(buildingId);
    if (!ports) return;

    const bx = buildingPivot.position.x;
    const by = buildingPivot.position.y;
    const bz = buildingPivot.position.z;
    const cosR = Math.cos(buildingRotY);
    const sinR = Math.sin(buildingRotY);

    for (const port of ports) {
      const lx = port.localPos.x * buildingScale;
      const ly = port.localPos.y * buildingScale;
      const lz = port.localPos.z * buildingScale;
      const wx = bx + lx * cosR - lz * sinR;
      const wz = bz + lx * sinR + lz * cosR;
      const wy = by + ly;
      const wDir = port.direction + buildingRotY;

      this.placedPorts.push({
        worldPos: new THREE.Vector3(wx, wy, wz),
        worldDir: wDir,
        type: port.type,
        buildingPivot,
      });

      const modelPath =
        port.type === "input" ? PORT_MODEL_INPUT : PORT_MODEL_OUTPUT;
      await this.ensureCached(modelPath);
      const portOriginal = this.glbCache.get(modelPath);
      if (!portOriginal) continue;

      const portModel = portOriginal.clone(true);
      const portScale = 3;
      portModel.scale.setScalar(portScale);
      portModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const portPivot = new THREE.Group();
      portPivot.add(portModel);
      portPivot.position.set(wx, wy, wz);
      portPivot.rotation.y = wDir;
      portPivot.userData.isPort = true;
      portPivot.userData.portType = port.type;
      portPivot.userData.ownerBuilding = buildingPivot;
      this.builderPlacedGroup.add(portPivot);
    }
  }

  /**
   * Find the nearest placed conveyor endpoint within maxRadius of the given world position.
   * Returns null if none found.
   */
  private findNearestConveyorEndpoint(
    worldPos: THREE.Vector3,
    maxRadius: number,
    lineKind: "conveyor" | "pipe",
  ): {
    position: THREE.Vector3;
    rotationY: number;
    compositeId: string;
  } | null {
    let best: (typeof this.conveyorEndpoints)[number] | null = null;
    let bestDist = maxRadius;
    for (const ep of this.conveyorEndpoints) {
      if (ep.lineKind !== lineKind) continue;
      const dx = ep.position.x - worldPos.x;
      const dz = ep.position.z - worldPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = ep;
      }
    }
    return best;
  }

  /**
   * Find the nearest placed building port within maxRadius of the given world position.
   * Returns null if none found.
   */
  findNearestPort(
    worldPos: THREE.Vector3,
    maxRadius: number,
  ): {
    worldPos: THREE.Vector3;
    worldDir: number;
    type: "input" | "output";
  } | null {
    let best: (typeof this.placedPorts)[number] | null = null;
    let bestDist = maxRadius;
    for (const port of this.placedPorts) {
      const dx = port.worldPos.x - worldPos.x;
      const dz = port.worldPos.z - worldPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = port;
      }
    }
    return best;
  }

  /** Remove all port registrations and port scene objects tied to a building. */
  private removePortsForBuilding(buildingPivot: THREE.Group): void {
    for (let i = this.placedPorts.length - 1; i >= 0; i--) {
      if (this.placedPorts[i].buildingPivot === buildingPivot) {
        this.placedPorts.splice(i, 1);
      }
    }
    const portPivots: THREE.Object3D[] = [];
    for (const child of this.builderPlacedGroup.children) {
      if (
        child.userData.isPort &&
        child.userData.ownerBuilding === buildingPivot
      ) {
        portPivots.push(child);
      }
    }
    for (const p of portPivots) this.builderPlacedGroup.remove(p);
  }

  private consumePipeEndpointsNear(pos: THREE.Vector3, radiusXZ: number): void {
    const r2 = radiusXZ * radiusXZ;
    for (let i = this.conveyorEndpoints.length - 1; i >= 0; i--) {
      const ep = this.conveyorEndpoints[i]!;
      if (ep.lineKind !== "pipe") continue;
      const dx = ep.position.x - pos.x;
      const dz = ep.position.z - pos.z;
      if (dx * dx + dz * dz < r2) this.conveyorEndpoints.splice(i, 1);
    }
  }

  private consumePipeEndpointsForStraightSegment(
    center: THREE.Vector3,
    rotY: number,
    stepLen: number,
  ): void {
    const dir = rotY - PIPE_RUN_ROT_Y_OFFSET;
    const hx = Math.sin(dir) * (stepLen * 0.5);
    const hz = Math.cos(dir) * (stepLen * 0.5);
    const eps = stepLen * 0.22;
    this.consumePipeEndpointsNear(
      new THREE.Vector3(center.x - hx, center.y, center.z - hz),
      eps,
    );
    this.consumePipeEndpointsNear(
      new THREE.Vector3(center.x + hx, center.y, center.z + hz),
      eps,
    );
  }

  /** Итоговый флип оси L = preferred XOR авто-флип (для обхода чужой геометрии). */
  private effectivePipeAxisFlip(): boolean {
    return this.pipePreferredAxisFlip !== this.pipeAutoAxisFlip;
  }

  /**
   * Если на старте новой ноги стоит уже размещённое колено или прямая того же
   * meню (продолжение после удаления / стыковка с существующей сборкой),
   * сдвигаем первый центр первой ноги вперёд, чтобы новая прямая не залезала
   * торцом на чужую геометрию.
   */
  private computePipeFirstLegStartBackTrim(
    start: THREE.Vector3,
    end: THREE.Vector3,
    step: number,
    preferAxisFlip: boolean,
  ): number {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const tol = 0.06;
    if (Math.hypot(dx, dz) < tol) return 0;
    const naturalAlongX = Math.abs(dx) >= Math.abs(dz);
    const firstAlongX = preferAxisFlip ? !naturalAlongX : naturalAlongX;
    let fx = 0;
    let fz = 0;
    if (firstAlongX) {
      fx = Math.sign(dx) || 1;
    } else {
      fz = Math.sign(dz) || 1;
    }
    const menuMatch = new Set<string>([
      PIPE_PROCEDURAL_STRAIGHT_PATH,
      PIPE_PROCEDURAL_ELBOW_PATH,
    ]);
    const neighbours: {
      x: number;
      z: number;
      partPath: string;
      rotY: number;
      chord: number;
    }[] = [];
    for (const child of this.builderPlacedGroup.children) {
      const rec = child.userData?.builderRecord as
        | BuilderPlacedPartRecord
        | undefined;
      if (!rec) continue;
      if (!menuMatch.has(rec.partPath)) continue;
      neighbours.push({
        x: child.position.x,
        z: child.position.z,
        partPath: rec.partPath,
        rotY: rec.rotY,
        chord:
          rec.straightChordMeters ?? rec.segmentStep ?? GRID_CELL_SIZE,
      });
    }
    return pipeStartBackTrimForExistingNeighbor(
      start,
      fx,
      fz,
      step,
      neighbours,
      menuMatch,
    );
  }

  /**
   * Коллизия с телом прямой трубы: стабильная длина `step`, без длинных хорд на стыке с коленом
   * (длинные хорды у превью не должны ложно помечать призрак как invalid).
   */
  private getPipeLineBodyCollisionPipeSegments(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): PipePathSegment[] {
    const step = this.getSegmentStep();
    const flip = this.effectivePipeAxisFlip();
    if (this.builderMode === "default") {
      const l = pipeLShapeInfoFromLineEnd(start, end, 0.06, flip);
      if (this.pipeLineEndSnappedToTarget && l.needsElbow) {
        const segments = mapConveyorSegmentsToPipeStraights(
          computeConveyorPathSegments(start, end, {
            builderMode: "default",
            step,
            conveyorRotOffset: this.conveyorRotOffset,
            tangentStart: this.conveyorTangentAtLineStart,
            tangentEnd: this.conveyorTangentAtLineEnd,
            ghostRotY: this.builderGhostRotY,
          }),
          this.conveyorRotOffset,
        );
        assignPipeStraightChordMeters(segments, end, step);
        return segments;
      }
      const backTrim = this.computePipeFirstLegStartBackTrim(
        start,
        end,
        step,
        flip,
      );
      return buildPipeFirstLegForPreviewAndPlace(
        start,
        end,
        step,
        flip,
        backTrim,
      );
    }
    return (this.computePathSegments(start, end) as PipePathSegment[]).filter(
      (s) => s.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH,
    );
  }

  /** Сегменты превью первой ноги в режиме default = то же, что ставит второй клик. */
  private getPipeLinePreviewSegmentsWithChords(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): PipePathSegment[] {
    const step = this.getSegmentStep();
    const flip = this.effectivePipeAxisFlip();
    if (this.builderMode === "default") {
      const l = pipeLShapeInfoFromLineEnd(start, end, 0.06, flip);
      if (this.pipeLineEndSnappedToTarget && l.needsElbow) {
        const segments = mapConveyorSegmentsToPipeStraights(
          computeConveyorPathSegments(start, end, {
            builderMode: "default",
            step,
            conveyorRotOffset: this.conveyorRotOffset,
            tangentStart: this.conveyorTangentAtLineStart,
            tangentEnd: this.conveyorTangentAtLineEnd,
            ghostRotY: this.builderGhostRotY,
          }),
          this.conveyorRotOffset,
        );
        assignPipeStraightChordMeters(segments, end, step);
        return segments;
      }
      const backTrim = this.computePipeFirstLegStartBackTrim(
        start,
        end,
        step,
        flip,
      );
      return buildPipeFirstLegForPreviewAndPlace(
        start,
        end,
        step,
        flip,
        backTrim,
      );
    }
    const segments = this.computePathSegments(
      start,
      end,
    ) as PipePathSegment[];
    assignPipeStraightChordMeters(segments, end, step);
    return segments;
  }

  private clearDeconstructRunHighlights(): void {
    for (const r of this.deconstructRunHighlightRoots) {
      if (!this.deconstructMultiRoots.has(r)) {
        this.restoreDeconstructHighlight(r);
      }
    }
    this.deconstructRunHighlightRoots = [];
  }

  private isConveyorBeltRunSeed(root: THREE.Object3D): boolean {
    const rec = root.userData?.builderRecord as
      | BuilderPlacedPartRecord
      | undefined;
    if (!rec) return false;
    if (!isConveyorBeltMenuId(rec.menuBuildingId)) return false;
    if (!isLogisticsConveyorKitPath(rec.partPath)) return false;
    const pl = rec.partPath.toLowerCase();
    if (pl.includes("splitter") || pl.includes("merger")) return false;
    return true;
  }

  /** Цепочка ленты по сетке (один tier), без compositeId. */
  private collectConnectedConveyorBeltRoots(seed: THREE.Object3D): THREE.Object3D[] {
    if (!this.isConveyorBeltRunSeed(seed)) return [seed];
    const step = GRID_CELL_SIZE;
    const posTol = step * 0.22;
    const alongTol = step * 0.34;
    const visited = new Set<THREE.Object3D>();
    const out: THREE.Object3D[] = [];
    const stack: THREE.Object3D[] = [seed];

    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      out.push(cur);

      const recA = cur.userData.builderRecord as BuilderPlacedPartRecord;
      const ra = recA.rotY - this.conveyorRotOffset;
      const uax = Math.sin(ra);
      const uaz = Math.cos(ra);
      const ax = cur.position.x;
      const az = cur.position.z;

      for (const child of this.builderPlacedGroup.children) {
        if (visited.has(child)) continue;
        if (!this.isConveyorBeltRunSeed(child)) continue;
        const recB = child.userData.builderRecord as BuilderPlacedPartRecord;
        if (recB.menuBuildingId !== recA.menuBuildingId) continue;
        const rb = recB.rotY - this.conveyorRotOffset;
        const dAng = Math.abs(rb - ra);
        if (dAng > 0.11 && Math.abs(dAng - Math.PI * 2) > 0.11) continue;

        const bx = child.position.x;
        const bz = child.position.z;
        const ddx = bx - ax;
        const ddz = bz - az;
        const along = ddx * uax + ddz * uaz;
        const perp = Math.abs(ddx * uaz - ddz * uax);
        if (perp > posTol) continue;
        const ad = Math.abs(along);
        if (ad < 0.035) continue;
        if (Math.abs(ad - step) < alongTol) {
          stack.push(child);
        }
      }
    }
    return out;
  }

  private isProceduralPipeStraightSeed(root: THREE.Object3D): boolean {
    const rec = root.userData?.builderRecord as
      | BuilderPlacedPartRecord
      | undefined;
    return !!rec && rec.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH;
  }

  /** Цепочка процедурных прямых одного tier’а без compositeId (стык торец-в-торец). */
  private collectConnectedProceduralPipeRoots(seed: THREE.Object3D): THREE.Object3D[] {
    if (!this.isProceduralPipeStraightSeed(seed)) return [seed];
    const step = GRID_CELL_SIZE;
    const alongTol = step * 0.38;
    const perpTol = step * 0.26;
    const visited = new Set<THREE.Object3D>();
    const out: THREE.Object3D[] = [];
    const stack: THREE.Object3D[] = [seed];

    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      out.push(cur);

      const recA = cur.userData.builderRecord as BuilderPlacedPartRecord;
      const ra = recA.rotY - PIPE_RUN_ROT_Y_OFFSET;
      const uax = Math.sin(ra);
      const uaz = Math.cos(ra);
      const lenA = recA.straightChordMeters ?? recA.segmentStep ?? step;
      const ax = cur.position.x;
      const az = cur.position.z;

      for (const child of this.builderPlacedGroup.children) {
        if (visited.has(child)) continue;
        const recB = child.userData?.builderRecord as
          | BuilderPlacedPartRecord
          | undefined;
        if (!recB || recB.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
        if (recB.menuBuildingId !== recA.menuBuildingId) continue;
        const rb = recB.rotY - PIPE_RUN_ROT_Y_OFFSET;
        const dAng = Math.abs(rb - ra);
        if (dAng > 0.1 && Math.abs(dAng - Math.PI * 2) > 0.1) continue;

        const lenB = recB.straightChordMeters ?? recB.segmentStep ?? step;
        const need = lenA * 0.5 + lenB * 0.5;
        const bx = child.position.x;
        const bz = child.position.z;
        const ddx = bx - ax;
        const ddz = bz - az;
        const along = ddx * uax + ddz * uaz;
        const perp = Math.abs(ddx * uaz - ddz * uax);
        if (perp > perpTol) continue;
        if (Math.abs(Math.abs(along) - need) < alongTol) {
          stack.push(child);
        }
      }
    }
    return out;
  }

  /** Сборка по compositeId, цепочка ленты или цепочка процедурных прямых труб. */
  private computeDeconstructRunRoots(root: THREE.Object3D | null): THREE.Object3D[] {
    if (!root) return [];
    const cid = root.userData?.compositeId;
    if (typeof cid === "string" && cid.length > 0) {
      const grp: THREE.Object3D[] = [];
      for (const c of this.builderPlacedGroup.children) {
        if (c.userData?.compositeId === cid) grp.push(c);
      }
      return grp.length > 0 ? grp : [root];
    }
    if (this.isConveyorBeltRunSeed(root)) {
      return this.collectConnectedConveyorBeltRoots(root);
    }
    if (this.isProceduralPipeStraightSeed(root)) {
      return this.collectConnectedProceduralPipeRoots(root);
    }
    return [root];
  }

  /** Капсула-капсула в XZ: и параллельные, и перпендикулярные (или косые) прямые трубы. */
  private proceduralStraightPipeWouldCollideBody(
    worldPos: THREE.Vector3,
    rotY: number,
    chordLen: number,
    ignoreCompositeId?: string,
  ): boolean {
    const ux = Math.sin(rotY - PIPE_RUN_ROT_Y_OFFSET);
    const uz = Math.cos(rotY - PIPE_RUN_ROT_Y_OFFSET);
    const halfNew = chordLen * 0.5;
    const scaleNew = this.prefabPlacementScale ?? this.builderScale;
    const radialNew =
      proceduralPipeTubeRadiusWorld(
        this.prefabMenuBuildingId ?? undefined,
        scaleNew,
      ) *
        2.12 +
        GRID_CELL_SIZE * 0.05;

    for (const child of this.builderPlacedGroup.children) {
      const rec = child.userData?.builderRecord as
        | BuilderPlacedPartRecord
        | undefined;
      if (!rec || rec.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
      if (
        ignoreCompositeId &&
        child.userData?.compositeId === ignoreCompositeId
      ) {
        continue;
      }
      const ox = child.position.x;
      const oz = child.position.z;
      const dx = worldPos.x - ox;
      const dz = worldPos.z - oz;
      if (dx * dx + dz * dz < 1e-10) return true;
      const oRot = rec.rotY;
      const oux = Math.sin(oRot - PIPE_RUN_ROT_Y_OFFSET);
      const ouz = Math.cos(oRot - PIPE_RUN_ROT_Y_OFFSET);
      const oLen =
        rec.straightChordMeters ?? rec.segmentStep ?? GRID_CELL_SIZE;
      const halfOld = oLen * 0.5;
      const radialOld =
        proceduralPipeTubeRadiusWorld(
          rec.menuBuildingId ?? undefined,
          rec.scale,
        ) * 2.12 +
        GRID_CELL_SIZE * 0.05;
      const radialTol = Math.max(radialNew, radialOld) + GRID_CELL_SIZE * 0.02;
      const dot = ux * oux + uz * ouz;

      if (Math.abs(dot) > 0.92) {
        const along = dx * ux + dz * uz;
        const perp = Math.abs(dx * uz - dz * ux);
        if (perp > radialTol) continue;
        const axisSep = Math.abs(along);
        const minGap = halfNew + halfOld - GRID_CELL_SIZE * 0.035;
        if (axisSep < minGap) return true;
        continue;
      }

      /**
       * Косые / перпендикулярные: расстояние между двумя XZ-отрезками, каждая
       * капсула радиуса tubeRadius. Если меньше суммы радиусов — коллизия.
       */
      const dist = segmentSegmentDistanceXZ(
        worldPos.x,
        worldPos.z,
        ux,
        uz,
        halfNew,
        ox,
        oz,
        oux,
        ouz,
        halfOld,
      );
      const padCap = radialTol - GRID_CELL_SIZE * 0.04;
      if (dist < padCap) return true;
    }
    return false;
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

  /** Ctrl: магнит к рёбрам/продолжениям стен — см. builderGhostSnapping. */
  private edgeAlignToPlaced(pos: THREE.Vector3): void {
    if (!this.builderCtrlHeld) return;
    edgeAlignGhostToPlaced(
      pos,
      this.builderPlacedGroup,
      this.getRotatedFootprint(),
    );
  }

  /** Прилипание гранью к ближайшей постройке — см. builderGhostSnapping. */
  private faceSnapToPlaced(pos: THREE.Vector3): void {
    faceSnapGhostToPlaced(
      pos,
      this.builderPlacedGroup,
      this.getRotatedFootprint(),
    );
  }

  /** Высота Y под призраком (стек + лучи) — см. builderGhostSnapping. */
  private resolveVerticalSupport(pos: THREE.Vector3): void {
    resolveGhostVerticalSupport(
      pos,
      this.builderPlacedGroup,
      this.getRotatedFootprint(),
      this.builderGhostRotY,
      this._visibleFloor,
    );
  }

  // ---- Сегменты линии: конвейер → conveyorPathSegments; ось → builderAxisLinePlacement ----

  /** Kenney pipe / pipe-bend в файле «стоя» по Y — поворачиваем вдоль пола и садим на опору. */
  private applyKenneyPipeLayFlatToRoot(
    placed: THREE.Object3D,
    partPath: string,
  ): void {
    if (!isKenneySpaceStationPipeAssetPath(partPath)) return;
    placed.rotation.x = PIPE_LAY_FLAT_ROT_X;
    placed.rotation.y = 0;
    if (isKenneySpaceStationPipeBendPath(partPath)) {
      placed.rotation.z = PIPE_BEND_LAY_FLAT_EXTRA_ROT_Z;
    } else {
      placed.rotation.z = 0;
    }
    const b = new THREE.Box3().setFromObject(placed);
    placed.position.y -= b.min.y;
  }

  private refreshPipeGhostFootprintAfterLayFlat(): void {
    if (!this.builderGhostModelRoot) return;
    const b = new THREE.Box3().setFromObject(this.builderGhostModelRoot);
    const sz = b.getSize(new THREE.Vector3());
    this.builderGhostFootprint.set(sz.x, sz.y, sz.z);
  }

  private getPipeMenuStraightModelPath(): string {
    const id = this.prefabMenuBuildingId;
    if (!id) return PIPE_PROCEDURAL_STRAIGHT_PATH;
    return getBuildingPrefab(id)?.modelPath ?? PIPE_PROCEDURAL_STRAIGHT_PATH;
  }

  /** Смена модели призрака трубы из меню (прямая ↔ колено). */
  private replacePipeMenuGhostModelRootFromPath(partPath: string): void {
    if (!this.builderGhostPivot || !this.prefabMenuBuildingId) return;
    while (this.builderGhostPivot.children.length > 0) {
      this.builderGhostPivot.remove(this.builderGhostPivot.children[0]!);
    }
    if (partPath === PIPE_PROCEDURAL_ELBOW_PATH) {
      const step = this.getSegmentStep();
      const r = proceduralPipeTubeRadiusWorld(
        this.prefabMenuBuildingId,
        this.effectiveGhostScale(),
      );
      const ghost = createProceduralElbowPipeObject(
        this.pipeIncomingStraightRotY,
        this.pipeJunctionLastTurn,
        step,
        r,
      );
      this.builderGhostPivot.add(ghost);
      this.builderGhostModelRoot = ghost;
      this.builderCurrentPartPath = partPath;
      this.normalizeGhostModel();
      this.applyProceduralPipeGhostMaterials();
      return;
    }
    if (
      isProceduralPipePartPath(partPath) &&
      partPath === PIPE_PROCEDURAL_STRAIGHT_PATH &&
      this.prefabMenuBuildingId
    ) {
      const step = GRID_CELL_SIZE;
      const r = proceduralPipeTubeRadiusWorld(
        this.prefabMenuBuildingId,
        this.effectiveGhostScale(),
      );
      const ghost = createProceduralStraightPipeObject(step, r);
      this.builderGhostPivot.add(ghost);
      this.builderGhostModelRoot = ghost;
      this.builderCurrentPartPath = partPath;
      this.normalizeGhostModel();
      this.applyProceduralPipeGhostMaterials();
      return;
    }
    const original = this.glbCache.get(partPath);
    if (!original) return;
    const ghost = original.clone(true);
    ghost.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.ghostMaterialOk;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    ghost.scale.setScalar(this.effectiveGhostScale());
    this.builderGhostPivot.add(ghost);
    this.builderGhostModelRoot = ghost;
    this.builderCurrentPartPath = partPath;
    this.normalizeGhostModel();
    this.refreshGhostMaterial();
  }

  private restorePipeMenuStraightGhostModel(): void {
    this.replacePipeMenuGhostModelRootFromPath(this.getPipeMenuStraightModelPath());
  }

  /** Второй клик в default: только прямые до угла, затем режим выбора колена. */
  private placePipeStraightLegClick(): boolean {
    const start = this.builderLineStart!.clone();
    const end = this.builderGhostCurrentPos.clone();
    this.builderLinePreviewGroup.clear();
    if (this.pipeDefaultTooTight) return false;
    const step = this.getSegmentStep();
    const y = start.y;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const tol = 0.06;
    const flip = this.effectivePipeAxisFlip();
    const naturalAlongX = Math.abs(dx) >= Math.abs(dz);
    const firstAlongX = flip ? !naturalAlongX : naturalAlongX;
    const cornerForJunction =
      Math.hypot(dx, dz) < tol
        ? end.clone()
        : firstAlongX
          ? new THREE.Vector3(end.x, y, start.z)
          : new THREE.Vector3(start.x, y, end.z);
    const lShape = pipeLShapeInfoFromLineEnd(start, end, tol, flip);
    const placeFullPathToSnappedTarget =
      this.pipeLineEndSnappedToTarget && lShape.needsElbow;
    const backTrim = placeFullPathToSnappedTarget
      ? 0
      : this.computePipeFirstLegStartBackTrim(start, end, step, flip);
    const forChord = placeFullPathToSnappedTarget
      ? mapConveyorSegmentsToPipeStraights(
          computeConveyorPathSegments(start, end, {
            builderMode: "default",
            step,
            conveyorRotOffset: this.conveyorRotOffset,
            tangentStart: this.conveyorTangentAtLineStart,
            tangentEnd: this.conveyorTangentAtLineEnd,
            ghostRotY: this.builderGhostRotY,
          }),
          this.conveyorRotOffset,
        )
      : buildPipeFirstLegForPreviewAndPlace(
          start,
          end,
          step,
          flip,
          backTrim,
        );
    if (placeFullPathToSnappedTarget) {
      assignPipeStraightChordMeters(forChord, end, step);
    }
    for (const seg of forChord) {
      if (seg.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
      const chord =
        typeof seg.straightChordMeters === "number"
          ? seg.straightChordMeters
          : step;
      if (
        this.proceduralStraightPipeWouldCollideBody(
          seg.position,
          seg.rotationY,
          chord,
        )
      ) {
        return false;
      }
    }
    const compositeId = this.newCompositeId();
    const segmentScale = this.prefabPlacementScale ?? this.builderScale;
    let placedAny = false;
    for (const seg of forChord) {
      const partPath =
        "partPath" in seg && typeof seg.partPath === "string"
          ? seg.partPath
          : this.builderCurrentPartPath;
      placedAny =
        this.placeSingleAt(
          seg.position,
          seg.rotationY,
          segmentScale,
          compositeId,
          this.prefabMenuBuildingId ?? undefined,
          partPath,
          isProceduralPipePartPath(partPath)
            ? {
                segmentStep: step,
                ...(partPath === PIPE_PROCEDURAL_STRAIGHT_PATH &&
                typeof seg.straightChordMeters === "number"
                  ? { straightChordMeters: seg.straightChordMeters }
                  : {}),
              }
            : undefined,
        ) || placedAny;
    }
    if (!placedAny) return false;

    this.consumePipeEndpointsNear(start, step * 0.22);

    this.persistBuilderState();
    const firstSeg = forChord[0];
    const lastSeg = forChord[forChord.length - 1];
    if (firstSeg) {
      const dir = firstSeg.rotationY - PIPE_RUN_ROT_Y_OFFSET;
      this.conveyorEndpoints.push({
        position: new THREE.Vector3(
          firstSeg.position.x - Math.sin(dir) * step,
          firstSeg.position.y,
          firstSeg.position.z - Math.cos(dir) * step,
        ),
        rotationY: firstSeg.rotationY,
        compositeId,
        lineKind: "pipe",
      });
    }
    if (lastSeg) {
      const dir = lastSeg.rotationY - PIPE_RUN_ROT_Y_OFFSET;
      this.conveyorEndpoints.push({
        position: new THREE.Vector3(
          lastSeg.position.x + Math.sin(dir) * step,
          lastSeg.position.y,
          lastSeg.position.z + Math.cos(dir) * step,
        ),
        rotationY: lastSeg.rotationY,
        compositeId,
        lineKind: "pipe",
      });
    }

    if (placeFullPathToSnappedTarget) {
      this.consumePipeEndpointsNear(end, step * 0.3);
      this.builderLineStart = end.clone();
      this.pipePlacementSubMode = "leg";
      this.conveyorTangentAtLineStart = this.conveyorTangentAtLineEnd;
      this.restorePipeMenuStraightGhostModel();
      this.updateBuilderGhostPosition(
        this.builderPointerNDC.x,
        this.builderPointerNDC.y,
      );
      return true;
    }

    const incomingRot = lastSeg?.rotationY ?? PIPE_RUN_ROT_Y_OFFSET;
    this.pipeIncomingStraightRotY = incomingRot;
    this.pipeJunctionManhattanCornerWorld.copy(cornerForJunction);
    this.builderLineStart = null;
    this.pipePlacementSubMode = "junction";
    this.replacePipeMenuGhostModelRootFromPath(PIPE_PROCEDURAL_ELBOW_PATH);
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
    return true;
  }

  /** Третий клик: колено, якорь следующей прямой — от выхода колена. */
  private placePipeJunctionClick(): boolean {
    const compositeId = this.newCompositeId();
    const segmentScale = this.prefabPlacementScale ?? this.builderScale;
    const step = this.getSegmentStep();
    const worldPos = this.pipeJunctionManhattanCornerWorld.clone();
    const placed = this.placeSingleAt(
      worldPos,
      this.builderGhostRotY,
      segmentScale,
      compositeId,
      this.prefabMenuBuildingId ?? undefined,
      PIPE_PROCEDURAL_ELBOW_PATH,
      {
        segmentStep: step,
        elbowIncomingRotY: this.pipeIncomingStraightRotY,
        elbowTurn: this.pipeJunctionLastTurn,
      },
    );
    if (!placed) return false;
    this.consumePipeEndpointsNear(worldPos, step * 0.26);
    this.persistBuilderState();
    const trim = pipeCornerTrimForStep(step);
    const outDir = this.pipeJunctionOutgoingStraightRotY - PIPE_RUN_ROT_Y_OFFSET;
    const outUx = Math.sin(outDir);
    const outUz = Math.cos(outDir);
    // Как `from2` в `computePipePathSegments`: первый центр второго плеча от угла L.
    this.builderLineStart = new THREE.Vector3(
      this.pipeJunctionManhattanCornerWorld.x + outUx * trim,
      this.pipeJunctionManhattanCornerWorld.y,
      this.pipeJunctionManhattanCornerWorld.z + outUz * trim,
    );
    this.pipePlacementSubMode = "leg";
    this.conveyorTangentAtLineStart = null;
    this.restorePipeMenuStraightGhostModel();
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
    return true;
  }

  private getSegmentStep(): number {
    const pipeMenu =
      isPipeLineMenuId(this.prefabMenuBuildingId) ||
      isPipeJunctionMenuId(this.prefabMenuBuildingId);
    if (pipeMenu && this.builderGhostModelRoot) {
      // Procedural tubes can be visually thickened for debugging; bbox max(x,z)
      // would then follow tube diameter and break grid step — keep logical segment length.
      if (isProceduralPipePartPath(this.builderCurrentPartPath)) {
        return GRID_CELL_SIZE;
      }
      const b = new THREE.Box3().setFromObject(this.builderGhostModelRoot);
      const sz = b.getSize(new THREE.Vector3());
      return Math.max(Math.max(sz.x, sz.z), 0.12);
    }
    return getPlacementSegmentStep(
      this.builderGhostFootprint,
      this.prefabMenuBuildingId,
    );
  }

  private computePathSegments(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): BuilderPathPlanSegment[] {
    if (isPipeLineMenuId(this.prefabMenuBuildingId)) {
      const step = this.getSegmentStep();
      if (this.builderMode === "default") {
        const flip = this.effectivePipeAxisFlip();
        const backTrim = this.computePipeFirstLegStartBackTrim(
          start,
          end,
          step,
          flip,
        );
        return computePipePathSegments(
          start,
          end,
          step,
          flip,
          backTrim,
        );
      }
      return mapConveyorSegmentsToPipeStraights(
        computeConveyorPathSegments(start, end, {
          builderMode: this.builderMode,
          step,
          conveyorRotOffset: this.conveyorRotOffset,
          tangentStart: this.conveyorTangentAtLineStart,
          tangentEnd: this.conveyorTangentAtLineEnd,
          ghostRotY: this.builderGhostRotY,
        }),
        this.conveyorRotOffset,
      );
    }
    if (!isConveyorBeltMenuId(this.prefabMenuBuildingId)) {
      return computeAxisAlignedPathSegments(
        start,
        end,
        this.getRotatedFootprint(),
        this.builderGhostRotY,
      );
    }
    return computeConveyorPathSegments(start, end, {
      builderMode: this.builderMode,
      step: this.getSegmentStep(),
      conveyorRotOffset: this.conveyorRotOffset,
      tangentStart: this.conveyorTangentAtLineStart,
      tangentEnd: this.conveyorTangentAtLineEnd,
      ghostRotY: this.builderGhostRotY,
    });
  }

  /** Превью сегмента линии (GLB или процедурная труба). */
  private makeLinePreviewPivotForPath(
    partPath: string,
    worldPos: THREE.Vector3,
    rotY: number,
    scale: number,
    seg?: BuilderPathPlanSegment,
  ): THREE.Group | null {
    if (isProceduralPipePartPath(partPath)) {
      const step = this.getSegmentStep();
      const r = proceduralPipeTubeRadiusWorld(
        this.prefabMenuBuildingId ?? undefined,
        scale,
      );
      let placed: THREE.Group;
      if (partPath === PIPE_PROCEDURAL_STRAIGHT_PATH) {
        const chord =
          typeof seg?.straightChordMeters === "number"
            ? seg.straightChordMeters
            : step;
        placed = createProceduralStraightPipeObject(chord, r);
      } else {
        if (
          seg?.elbowIncomingRotY === undefined ||
          seg?.elbowTurn === undefined
        ) {
          return null;
        }
        placed = createProceduralElbowPipeObject(
          seg.elbowIncomingRotY,
          seg.elbowTurn,
          step,
          r,
        );
      }
      placed.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const m = this.ghostMaterialOk.clone();
          m.side = THREE.DoubleSide;
          child.material = m;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      offsetProceduralPipeRootToSitOnFloor(placed, partPath);
      placed.scale.setScalar(1);
      const pivot = new THREE.Group();
      pivot.add(placed);
      pivot.position.copy(worldPos);
      pivot.rotation.y =
        partPath === PIPE_PROCEDURAL_ELBOW_PATH ? 0 : rotY;
      return pivot;
    }
    const original = this.glbCache.get(partPath);
    if (!original) return null;
    const placed = original.clone(true);
    placed.scale.setScalar(scale);
    placed.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.ghostMaterialOk;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    const origBox = new THREE.Box3().setFromObject(original);
    const origCenter = origBox.getCenter(new THREE.Vector3());
    placed.position.set(
      -origCenter.x * scale,
      -origBox.min.y * scale,
      -origCenter.z * scale,
    );
    this.applyKenneyPipeLayFlatToRoot(placed, partPath);
    const pivot = new THREE.Group();
    pivot.add(placed);
    pivot.position.copy(worldPos);
    pivot.rotation.y = rotY;
    return pivot;
  }

  /**
   * Реестр эндпоинтов ставит точку на `±step` от центра сегмента; торец трубы
   * ближе на `halfChord`. Подтягиваем якорь к открытому торцу — без щели у превью.
   */
  private refinePipeFreeEndpointToPipeOpenFace(
    anchor: THREE.Vector3,
    rotationY: number,
    step: number,
  ): THREE.Vector3 {
    const off = PIPE_RUN_ROT_Y_OFFSET;
    const ux = Math.sin(rotationY - off);
    const uz = Math.cos(rotationY - off);
    const halfChord = step * 0.52;
    const pull = Math.max(0, step - halfChord);
    return new THREE.Vector3(
      anchor.x - ux * pull,
      anchor.y,
      anchor.z - uz * pull,
    );
  }

  /**
   * Магнит к торцу уже стоящей прямой (без зарегистрированного endpoint).
   * Возвращает true, если позиция была подправлена.
   */
  private snapPipeFreeCursorToPlacedStraightCap(
    pos: THREE.Vector3,
    step: number,
  ): boolean {
    const capR = step * 0.38;
    let bestD = capR * 1.25;
    const best = new THREE.Vector3();
    let bestRot: number | null = null;
    for (const child of this.builderPlacedGroup.children) {
      const rec = child.userData?.builderRecord as
        | BuilderPlacedPartRecord
        | undefined;
      if (!rec || rec.partPath !== PIPE_PROCEDURAL_STRAIGHT_PATH) continue;
      const cx = child.position.x;
      const cz = child.position.z;
      const uy = rec.rotY - PIPE_RUN_ROT_Y_OFFSET;
      const ux = Math.sin(uy);
      const uz = Math.cos(uy);
      const half =
        (rec.straightChordMeters ?? rec.segmentStep ?? step) * 0.5;
      for (const sign of [-1, 1] as const) {
        const capAlong = sign * (half + 0.02);
        const capX = cx + ux * capAlong;
        const capZ = cz + uz * capAlong;
        const d = Math.hypot(pos.x - capX, pos.z - capZ);
        if (d < bestD) {
          bestD = d;
          best.set(capX, pos.y, capZ);
          bestRot = rec.rotY;
        }
      }
    }
    if (bestRot !== null && bestD < capR) {
      pos.copy(best);
      this.builderGhostRotY = bestRot;
      this.conveyorTangentAtLineEnd = bestRot;
      this.pipeLineEndSnappedToTarget = true;
      return true;
    }
    return false;
  }

  /** Коллизия свободной кривой: выборка коротких «капсул» вдоль CatmullRom в XZ. */
  private pipeFreeCurveSampleCollides(
    controlPoints: THREE.Vector3[],
    step: number,
    ignoreCompositeId?: string,
  ): boolean {
    if (controlPoints.length < 2) return false;
    const curve = new THREE.CatmullRomCurve3(
      controlPoints,
      false,
      "catmullrom",
      PIPE_FREE_CURVE_TENSION,
    );
    const len = curve.getLength();
    const n = Math.min(
      40,
      Math.max(4, Math.ceil(len / Math.max(step * 0.35, 0.1))),
    );
    const off = PIPE_RUN_ROT_Y_OFFSET;
    const prev = curve.getPointAt(0).clone();
    for (let i = 1; i <= n; i++) {
      const p = curve.getPointAt(i / n);
      const dx = p.x - prev.x;
      const dz = p.z - prev.z;
      const chord = Math.hypot(dx, dz);
      if (chord < 1e-4) {
        prev.copy(p);
        continue;
      }
      const ux = dx / chord;
      const uz = dz / chord;
      const rotY = Math.atan2(ux, uz) + off;
      const mid = new THREE.Vector3(
        (p.x + prev.x) * 0.5,
        (p.y + prev.y) * 0.5,
        (p.z + prev.z) * 0.5,
      );
      if (
        this.proceduralStraightPipeWouldCollideBody(
          mid,
          rotY,
          chord * 1.02,
          ignoreCompositeId,
        )
      ) {
        return true;
      }
      prev.copy(p);
    }
    return false;
  }

  private rebuildPipeFreeCurveLinePreview(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): void {
    const step = this.getSegmentStep();
    const scale = this.prefabPlacementScale ?? this.builderScale;
    const r = proceduralPipeTubeRadiusWorld(
      this.prefabMenuBuildingId ?? undefined,
      scale,
    );
    const pts = computePipeFreeCurvePath(
      start.clone(),
      end.clone(),
      this.conveyorTangentAtLineStart,
      this.conveyorTangentAtLineEnd,
      this.builderGhostRotY,
      step,
    );
    const placed = createProceduralFreeCurvePipeObject(pts, r, step);
    const mat = this.builderGhostInvalid
      ? this.ghostMaterialInvalid
      : this.ghostMaterialOk;
    placed.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = mat.clone();
        m.side = THREE.DoubleSide;
        child.material = m;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    offsetProceduralPipeRootToSitOnFloor(placed, PIPE_PROCEDURAL_FREE_CURVE_PATH);
    const pivot = new THREE.Group();
    pivot.add(placed);
    pivot.position.copy(pts[0]!);
    this.builderLinePreviewGroup.add(pivot);
  }

  /** Второй клик в режиме «free»: одна процедурная труба по сплайну. */
  private placePipeFreeCurveLeg(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const step = this.getSegmentStep();
    if (
      pipeFreeCurvePlacementTooSharp(
        start,
        end,
        this.conveyorTangentAtLineStart,
        this.conveyorTangentAtLineEnd,
        this.builderGhostRotY,
        step,
      )
    ) {
      return false;
    }
    const scale = this.prefabPlacementScale ?? this.builderScale;
    const tubeR = proceduralPipeTubeRadiusWorld(
      this.prefabMenuBuildingId ?? undefined,
      scale,
    );
    const pts = computePipeFreeCurvePath(
      start,
      end,
      this.conveyorTangentAtLineStart,
      this.conveyorTangentAtLineEnd,
      this.builderGhostRotY,
      step,
    );
    if (this.pipeFreeCurveSampleCollides(pts, step)) return false;
    const compositeId = this.newCompositeId();
    const worldStart = pts[0]!.clone();
    const placed = this.placeSingleAt(
      worldStart,
      0,
      scale,
      compositeId,
      this.prefabMenuBuildingId ?? undefined,
      PIPE_PROCEDURAL_FREE_CURVE_PATH,
      {
        segmentStep: step,
        freeCurvePoints: pts.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        tubeRadius: tubeR,
      },
    );
    if (!placed) return false;

    this.consumePipeEndpointsNear(start, step * 0.22);
    this.consumePipeEndpointsNear(end, step * 0.22);

    const curve = new THREE.CatmullRomCurve3(
      pts,
      false,
      "catmullrom",
      PIPE_FREE_CURVE_TENSION,
    );
    const tStart = curve.getTangent(0).normalize();
    const tEnd = curve.getTangent(1).normalize();
    const rotS = Math.atan2(tStart.x, tStart.z) + PIPE_RUN_ROT_Y_OFFSET;
    const rotE = Math.atan2(tEnd.x, tEnd.z) + PIPE_RUN_ROT_Y_OFFSET;
    const dirS = rotS - PIPE_RUN_ROT_Y_OFFSET;
    const dirE = rotE - PIPE_RUN_ROT_Y_OFFSET;
    const p0 = pts[0]!;
    const pLast = pts[pts.length - 1]!;
    this.conveyorEndpoints.push({
      position: new THREE.Vector3(
        p0.x - Math.sin(dirS) * step,
        p0.y,
        p0.z - Math.cos(dirS) * step,
      ),
      rotationY: rotS,
      compositeId,
      lineKind: "pipe",
    });
    this.conveyorEndpoints.push({
      position: new THREE.Vector3(
        pLast.x + Math.sin(dirE) * step,
        pLast.y,
        pLast.z + Math.cos(dirE) * step,
      ),
      rotationY: rotE,
      compositeId,
      lineKind: "pipe",
    });

    this.persistBuilderState();
    this.builderLineStart = end.clone();
    this.conveyorTangentAtLineStart = rotE;
    this.conveyorTangentAtLineEnd = null;
    this.pipeLineEndSnappedToTarget = false;
    this.updateBuilderGhostPosition(
      this.builderPointerNDC.x,
      this.builderPointerNDC.y,
    );
    return true;
  }

  private rebuildLinePreview(start: THREE.Vector3, end: THREE.Vector3): void {
    this.builderLinePreviewGroup.clear();
    if (!this.builderGhostModelRoot || !this.builderCurrentPartPath) return;

    const isConveyorMultiSegment =
      this.builderMode !== "single" &&
      this.prefabPlacementScale !== null &&
      isConveyorBeltMenuId(this.prefabMenuBuildingId);

    const isPipeMultiSegment =
      this.builderMode !== "single" &&
      this.prefabPlacementScale !== null &&
      isPipeLineMenuId(this.prefabMenuBuildingId);

    if (isConveyorMultiSegment) {
      const segments = this.computePathSegments(start, end);
      for (const seg of segments) {
        const clone = this.builderGhostModelRoot!.clone(true);
        const pivot = new THREE.Group();
        pivot.add(clone);
        pivot.position.copy(seg.position);
        pivot.rotation.y = seg.rotationY;
        this.builderLinePreviewGroup.add(pivot);
      }
    } else if (isPipeMultiSegment) {
      if (
        isPipeLineMenuId(this.prefabMenuBuildingId) &&
        this.builderMode === "free"
      ) {
        this.rebuildPipeFreeCurveLinePreview(start, end);
      } else {
        const segments = this.getPipeLinePreviewSegmentsWithChords(start, end);
        const scale = this.prefabPlacementScale ?? this.builderScale;
        for (const seg of segments) {
          const p =
            "partPath" in seg && typeof seg.partPath === "string"
              ? seg.partPath
              : this.builderCurrentPartPath;
          const pivot = this.makeLinePreviewPivotForPath(
            p,
            seg.position,
            seg.rotationY,
            scale,
            seg,
          );
          if (pivot) this.builderLinePreviewGroup.add(pivot);
        }
      }
    } else {
      const positions = getAxisLinePlacementPositions(
        start,
        end,
        this.getRotatedFootprint(),
      );
      for (const p of positions) {
        this.resolveVerticalSupport(p);
        const clone = this.builderGhostModelRoot!.clone(true);
        const pivot = new THREE.Group();
        pivot.add(clone);
        pivot.position.copy(p);
        pivot.rotation.y = this.builderGhostRotY;
        this.builderLinePreviewGroup.add(pivot);
      }
    }
  }

  private updateDeconstructHover(
    ndcX: number,
    ndcY: number,
    altHeld: boolean,
  ): void {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = raycaster.intersectObjects(
      this.builderPlacedGroup.children,
      true,
    );
    const root = hits[0]?.object
      ? this.findPlacedRoot(hits[0].object)
      : null;

    if (altHeld) {
      if (root) {
        const run = this.computeDeconstructRunRoots(root);
        for (const r of run) {
          if (!this.deconstructMultiRoots.has(r)) {
            this.deconstructMultiRoots.add(r);
            this.applyDeconstructHighlight(r);
          }
        }
        this.deconstructHovered = root;
      }
      return;
    }

    if (
      root &&
      this.deconstructMultiRoots.size > 0 &&
      !this.deconstructMultiRoots.has(root)
    ) {
      this.clearDeconstructMultiSelection();
    }
    if (root === this.deconstructHovered) return;
    this.clearDeconstructRunHighlights();
    this.deconstructHovered = root;
    if (!root) return;
    const run = this.computeDeconstructRunRoots(root);
    this.deconstructRunHighlightRoots = run;
    for (const r of run) {
      if (!this.deconstructMultiRoots.has(r)) {
        this.applyDeconstructHighlight(r);
      }
    }
  }

  private clearDeconstructHover(): void {
    this.clearDeconstructRunHighlights();
    this.deconstructHoveredMaterials.forEach((material, mesh) => {
      mesh.material = material;
    });
    this.deconstructHoveredMaterials.clear();
    this.deconstructHovered = null;
    this.deconstructMultiRoots.clear();
  }

  private clearDeconstructMultiSelection(): void {
    for (const r of [...this.deconstructMultiRoots]) {
      this.restoreDeconstructHighlight(r);
    }
    this.deconstructMultiRoots.clear();
  }

  private applyDeconstructHighlight(root: THREE.Object3D): void {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!this.deconstructHoveredMaterials.has(child)) {
        this.deconstructHoveredMaterials.set(child, child.material);
      }
      const prev = child.material;
      child.material = Array.isArray(prev)
        ? prev.map(() => this.deconstructMaterial)
        : this.deconstructMaterial;
    });
  }

  private restoreDeconstructHighlight(root: THREE.Object3D): void {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const orig = this.deconstructHoveredMaterials.get(child);
      if (orig !== undefined) {
        child.material = orig;
        this.deconstructHoveredMaterials.delete(child);
      }
    });
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
        mode?: string;
        parts?: Array<{
          partPath: string;
          x: number;
          y: number;
          z: number;
          rotY: number;
          scale?: number;
          compositeId?: string;
          menuBuildingId?: string;
          segmentStep?: number;
          straightChordMeters?: number;
          elbowIncomingRotY?: number;
          elbowTurn?: 1 | -1;
          freeCurvePoints?: { x: number; y: number; z: number }[];
          tubeRadius?: number;
        }>;
      };
      if (typeof parsed.scale === "number") {
        this.builderScale = THREE.MathUtils.clamp(
          parsed.scale,
          0.2,
          SceneManager.BUILDER_SCALE_MAX,
        );
      }
      const parts = parsed.parts ?? [];
      const elevatorPath = getBuildingPrefab("space_elevator")?.modelPath;
      for (const part of parts) {
        if (!part.partPath) continue;
        await this.ensureCached(part.partPath);
        this.builderCurrentPartPath = part.partPath;
        let menuId =
          typeof part.menuBuildingId === "string"
            ? part.menuBuildingId
            : undefined;
        if (!menuId && elevatorPath && part.partPath === elevatorPath) {
          menuId = "space_elevator";
        }
        const origCached = this.glbCache.get(part.partPath);
        let scaleForPart =
          typeof part.scale === "number" ? part.scale : this.builderScale;
        if (origCached && usesConveyorGalleryFitScale(menuId, part.partPath)) {
          scaleForPart = scaleToFitMaxExtent(origCached);
        } else if (menuId) {
          const def = getBuildingPrefab(menuId);
          if (def) scaleForPart = def.scale;
        }
        const pipeSeg = isProceduralPipePartPath(part.partPath)
          ? {
              segmentStep:
                typeof part.segmentStep === "number"
                  ? part.segmentStep
                  : GRID_CELL_SIZE,
              ...(part.partPath === PIPE_PROCEDURAL_STRAIGHT_PATH &&
              typeof part.straightChordMeters === "number"
                ? { straightChordMeters: part.straightChordMeters }
                : {}),
              ...(part.partPath === PIPE_PROCEDURAL_FREE_CURVE_PATH &&
              part.freeCurvePoints &&
              part.freeCurvePoints.length >= 2
                ? {
                    freeCurvePoints: part.freeCurvePoints,
                    ...(typeof part.tubeRadius === "number"
                      ? { tubeRadius: part.tubeRadius }
                      : {}),
                  }
                : {}),
              elbowIncomingRotY: part.elbowIncomingRotY,
              elbowTurn: part.elbowTurn,
            }
          : undefined;
        this.placeSingleAt(
          new THREE.Vector3(part.x, part.y, part.z),
          part.rotY,
          scaleForPart,
          typeof part.compositeId === "string" ? part.compositeId : undefined,
          menuId,
          part.partPath,
          pipeSeg,
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
    const gen = ++this.patternGhostLoadGeneration;
    this.clearPatternGhost();
    this.clearBuilderGhost();
    this.patternParts = parts;
    this.patternBuildingId = buildingId;
    this.patternRotY = 0;

    const group = new THREE.Group();
    group.name = "pattern-ghost";

    let loaded = 0;

    for (const part of parts) {
      if (gen !== this.patternGhostLoadGeneration) return;
      const partPath = resolveBuilderModelPath(part.partName);

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

    if (gen !== this.patternGhostLoadGeneration) return;

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

    if (gen !== this.patternGhostLoadGeneration) return;

    this.scene.add(group);
    this.patternGhostGroup = group;

    // Place ghost at screen center so it's visible before the user moves the mouse
    this.updatePatternGhostPosition(0, 0);
  }

  /** Отменить фоновую загрузку паттерна и убрать призрак (Escape, смена постройки). */
  abortPatternGhostLoad(): void {
    this.patternGhostLoadGeneration++;
    this.clearPatternGhost();
  }

  /** Update pattern ghost position to follow cursor */
  updatePatternGhostPosition(ndcX: number, ndcY: number): void {
    if (!this.patternGhostGroup) return;
    const pos = this.getGridPositionUnderMouse(ndcX, ndcY, this._visibleFloor);
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
    const savedPath = this.builderCurrentPartPath;
    const patternCompositeId = this.newCompositeId();
    let placed = 0;

    console.log(
      `[Pattern] Placing at anchor=(${anchor.x.toFixed(1)}, ${anchor.z.toFixed(1)}) rot=${((rot * 180) / Math.PI).toFixed(0)}° cos=${cosR.toFixed(4)} sin=${sinR.toFixed(4)}`,
    );

    for (const part of this.patternParts) {
      const partPath = resolveBuilderModelPath(part.partName);
      try {
        await this.ensureCached(partPath);
      } catch (err) {
        console.warn(
          `[Pattern] Skip part (load failed) "${part.partName}" -> ${partPath}:`,
          err,
        );
        continue;
      }
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
      this.builderGhostPivot.position.copy(this.builderGhostCurrentPos);
      if (this.builderGhostInvalid) {
        this.builderGhostPivot.position.x +=
          Math.sin(performance.now() * 0.05) * 0.08;
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
    const p = this.getFloorPositionUnderMouseRaw(mouseX, mouseY, floor);
    if (!p) return null;
    p.x = Math.round(p.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    p.z = Math.round(p.z / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    return p;
  }

  /** Пересечение луча с полом без привязки к сетке (для выбора стороны колена по мыши). */
  getFloorPositionUnderMouseRaw(
    mouseX: number,
    mouseY: number,
    floor: number,
  ): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(mouseX, mouseY);
    raycaster.setFromCamera(mouse, this.camera);
    const planeY = floor * GRID_CELL_SIZE;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersection);
    if (!hit) return null;
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
