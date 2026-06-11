// ============================================================
// BeltItemVisualizer — 3D-предметы на лентах (слоты без наложения).
// ============================================================

import * as THREE from "three";
import type { BeltVisualState } from "../../sim/simItemModels.ts";
import {
  allSimItemModelPaths,
  getSimItemModel,
} from "../../sim/simItemModels.ts";
import {
  buildBeltPathFromSegments,
  sampleBeltPath,
  type BeltPath,
  type BeltSegmentSnapshot,
} from "./beltPath.ts";

/** Расстояние между центрами соседних предметов на ленте (м). */
const ITEM_SLOT_SPACING_M = 2.35;
const MAX_SLOTS_PER_BELT = 96;
const MIN_AMOUNT_FOR_ONE = 0.08;

export type LoadModelRootFn = (path: string) => Promise<THREE.Object3D>;

export class BeltItemVisualizer {
  private readonly group = new THREE.Group();
  private readonly templates = new Map<string, THREE.Object3D>();
  private readonly active = new Map<string, THREE.Object3D>();
  private readonly phases = new Map<string, number>();
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

  /** Слоты с фиксированным шагом — wood/leaves в одной очереди, без наслоения. */
  private buildSlotItemIds(
    items: Array<{ itemId: string; amount: number }>,
    maxSlots: number,
  ): string[] {
    const total = items.reduce((s, i) => s + i.amount, 0);
    if (total < MIN_AMOUNT_FOR_ONE || maxSlots <= 0) return [];

    let slotCount = Math.min(
      maxSlots,
      Math.max(1, Math.ceil(total)),
    );

    const queues: string[][] = [];
    let assigned = 0;
    for (let t = 0; t < items.length; t++) {
      const { itemId, amount } = items[t]!;
      const isLast = t === items.length - 1;
      const n = isLast
        ? slotCount - assigned
        : Math.min(
            slotCount - assigned,
            Math.max(0, Math.round((slotCount * amount) / total)),
          );
      if (n > 0) {
        queues.push(Array.from({ length: n }, () => itemId));
        assigned += n;
      }
    }

    const out: string[] = [];
    let hasAny = true;
    while (hasAny && out.length < slotCount) {
      hasAny = false;
      for (const q of queues) {
        const next = q.shift();
        if (next) {
          out.push(next);
          hasAny = true;
        }
      }
    }
    return out;
  }

  update(
    dt: number,
    belts: BeltVisualState[],
    segmentPaths: Map<string, BeltSegmentSnapshot[]>,
    prebuiltPaths?: Map<string, BeltPath>,
  ): void {
    if (this.templates.size === 0) {
      void this.preload();
    }

    const alive = new Set<string>();
    const paths = new Map<string, BeltPath>(prebuiltPaths);

    for (const [compositeId, segments] of segmentPaths) {
      if (paths.has(compositeId)) continue;
      const path = buildBeltPathFromSegments(compositeId, segments);
      if (path && path.totalLength > 1e-4) {
        paths.set(compositeId, path);
      }
    }

    for (const belt of belts) {
      const path = paths.get(belt.beltCompositeId);
      if (!path) continue;

      const maxByLength = Math.max(
        1,
        Math.floor(path.totalLength / ITEM_SLOT_SPACING_M),
      );
      const slotIds = this.buildSlotItemIds(
        belt.items,
        Math.min(MAX_SLOTS_PER_BELT, maxByLength),
      );
      if (slotIds.length === 0) continue;

      const metersPerSec =
        Number.isFinite(belt.speedPerMin) && belt.speedPerMin > 0
          ? belt.speedPerMin / 60
          : 1;
      const prev = this.phases.get(belt.beltCompositeId) ?? 0;
      const next = prev + metersPerSec * dt;
      this.phases.set(belt.beltCompositeId, next);

      const totalLen = Math.max(path.totalLength, 1e-4);

      for (let i = 0; i < slotIds.length; i++) {
        const itemId = slotIds[i]!;
        const model = getSimItemModel(itemId);
        if (!model) continue;
        const template = this.templates.get(model.path);
        if (!template) continue;

        const id = `${belt.beltCompositeId}:slot:${i}:${itemId}`;
        alive.add(id);

        // i = последний слот — сзади (у источника); новые предметы попадают туда.
        const backOffset =
          (slotIds.length - 1 - i) * ITEM_SLOT_SPACING_M;
        const dist =
          ((next - backOffset) % totalLen + totalLen) % totalLen;
        const sample = sampleBeltPath(path, dist);

        let obj = this.active.get(id);
        if (!obj) {
          obj = this.spawnInstance(template, model.targetSize, model.tint);
          this.active.set(id, obj);
          this.group.add(obj);
        }

        obj.position.set(
          sample.x,
          sample.y + model.yOffset,
          sample.z,
        );
        obj.rotation.y = sample.direction;
      }
    }

    for (const [id, obj] of this.active) {
      if (alive.has(id)) continue;
      this.group.remove(obj);
      this.active.delete(id);
    }
  }

  dispose(): void {
    for (const obj of this.active.values()) {
      this.group.remove(obj);
    }
    this.active.clear();
    this.group.parent?.remove(this.group);
  }
}
