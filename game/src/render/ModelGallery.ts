// ============================================================
// ModelGallery — выставка на карте отключена (Train Kit убран с карты).
// ============================================================

import * as THREE from "three";

export class ModelGallery {
  private scene: THREE.Scene;
  private galleryGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.galleryGroup = new THREE.Group();
    this.galleryGroup.name = "model-gallery";
    this.scene.add(this.galleryGroup);
  }

  /** Train kit gallery removed from map — no-op. */
  async loadAll(): Promise<void> {
    console.log("[ModelGallery] On-map gallery disabled");
  }
}
