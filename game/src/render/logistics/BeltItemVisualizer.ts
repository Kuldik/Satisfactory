// ============================================================
// BeltItemVisualizer — 3D-предметы на лентах (слоты без наложения).
// ============================================================

import * as THREE from "three";
import type { BeltLaneVisual } from "../../sim/logisticsTypes.ts";
import { allSimItemModelPaths, getSimItemModel } from "../../sim/simItemModels.ts";
import { sampleBeltPath, type BeltPath } from "./beltPath.ts";

/** Порог рассинхрона рендер-позиции с sim (нормир.) — при превышении делаем snap. */
const RESYNC_THRESHOLD_01 = 0.05;

export type LoadModelRootFn = (path: string) => Promise<THREE.Object3D>;

export class BeltItemVisualizer {
  private readonly group = new THREE.Group();
  private readonly templates = new Map<string, THREE.Object3D>();
  /** id предмета → mesh (стабильно на всё время жизни предмета). */
  private readonly active = new Map<number, THREE.Object3D>();
  /** id предмета → отрисованная позиция [0..1] для межкадровой интерполяции. */
  private readonly renderPos = new Map<number, number>();
  private preloadPromise: Promise<void> | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly loadModelRoot: LoadModelRootFn,
  ) {
    this.group.name = "belt-items";
    scene.add(this.group);
  }

  preload(): Promise<void> {
    if (!this.preloadPromise) {
      this.preloadPromise = this.doPreload();
    }
    return this.preloadPromise;
  }

  private async doPreload(): Promise<void> {
    for (const path of allSimItemModelPaths()) {
      await this.ensureTemplate(path);
    }
  }

  private async ensureTemplate(path: string): Promise<THREE.Object3D | null> {
    if (this.templates.has(path)) {
      return this.templates.get(path)!;
    }
    try {
      const root = await this.loadModelRoot(path);
      const normalized = this.normalizeRoot(root);
      this.templates.set(path, normalized);
      return normalized;
    } catch (err) {
      console.warn(`[BeltItemVisualizer] Failed to load ${path}:`, err);
      return null;
    }
  }

  private normalizeRoot(root: THREE.Object3D): THREE.Object3D {
    const clone = root.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    clone.position.y -= box.min.y;
    return clone;
  }

  private applyTint(root: THREE.Object3D, tint: number): void {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const tintMat = (mat: THREE.Material | undefined): THREE.Material | undefined => {
        if (!mat) return mat;
        const next = mat.clone();
        if (
          next instanceof THREE.MeshStandardMaterial ||
          next instanceof THREE.MeshPhysicalMaterial ||
          next instanceof THREE.MeshLambertMaterial ||
          next instanceof THREE.MeshPhongMaterial ||
          next instanceof THREE.MeshBasicMaterial
        ) {
          next.color.set(tint);
        }
        return next;
      };
      if (Array.isArray(child.material)) {
        child.material = child.material.map(tintMat).filter(Boolean) as THREE.Material[];
      } else {
        const next = tintMat(child.material);
        if (next) child.material = next;
      }
    });
  }

  private spawnInstance(
    template: THREE.Object3D,
    targetSize: number,
    tint?: number,
  ): THREE.Object3D {
    const obj = template.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 1e-5) {
      obj.scale.multiplyScalar(targetSize / maxDim);
    }
    if (tint !== undefined) {
      this.applyTint(obj, tint);
    }
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return obj;
  }

  /**
   * Отрисовать дискретные предметы полос: один mesh на предмет (по стабильному id),
   * позиция берётся из sim (pos01) с лёгкой межкадровой интерполяцией вперёд.
   */
  update(
    dt: number,
    lanes: BeltLaneVisual[],
    paths: Map<string, BeltPath>,
  ): void {
    if (this.templates.size === 0) {
      void this.preload();
    }

    const alive = new Set<number>();

    for (const lane of lanes) {
      const path = paths.get(lane.laneKey);
      if (!path || path.totalLength <= 1e-4) continue;
      const total = path.totalLength;
      const itemScale = path.itemScale ?? 1;
      const advance01 = total > 0 ? (lane.speedMps * dt) / total : 0;

      for (const item of lane.items) {
        const model = getSimItemModel(item.itemId);
        if (!model) continue;
        const template = this.templates.get(model.path);
        if (!template) continue;

        alive.add(item.id);
        const target = item.pos01;

        // Межкадровая интерполяция: рендер-позиция движется вперёд, не обгоняя sim.
        let rp = this.renderPos.get(item.id);
        if (rp === undefined) {
          rp = target;
        } else {
          rp += advance01;
          if (rp > target) rp = target;
          if (target - rp > RESYNC_THRESHOLD_01) rp = target;
        }
        this.renderPos.set(item.id, rp);

        const sample = sampleBeltPath(path, rp * total);

        let obj = this.active.get(item.id);
        if (!obj) {
          obj = this.spawnInstance(
            template,
            model.targetSize * itemScale,
            model.tint,
          );
          this.active.set(item.id, obj);
          this.group.add(obj);
        }
        obj.position.set(sample.x, sample.y + model.yOffset, sample.z);
        obj.rotation.y = sample.direction;
      }
    }

    for (const [id, obj] of this.active) {
      if (alive.has(id)) continue;
      this.group.remove(obj);
      this.active.delete(id);
      this.renderPos.delete(id);
    }
  }

  dispose(): void {
    for (const obj of this.active.values()) {
      this.group.remove(obj);
    }
    this.active.clear();
    this.renderPos.clear();
    this.group.parent?.remove(this.group);
  }
}
