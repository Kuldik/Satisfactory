// ============================================================
// CameraController — orbital camera with pan, rotate, zoom
// ============================================================

import * as THREE from 'three';
import { CAMERA } from '../core/constants.ts';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Orbital state
  private target = new THREE.Vector3(0, 0, 0);
  private spherical = new THREE.Spherical(
    CAMERA.defaultDistance,
    CAMERA.defaultAngle,
    0,
  );

  // Input state
  private isRotating = false;
  private isPanning = false;
  private previousMouse = new THREE.Vector2();
  private currentMouse = new THREE.Vector2();

  // Smoothing
  private targetSpherical = new THREE.Spherical(
    CAMERA.defaultDistance,
    CAMERA.defaultAngle,
    0,
  );
  private targetTarget = new THREE.Vector3(0, 0, 0);
  private smoothFactor = 0.1;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.bindEvents();
    this.updateCameraPosition();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onMouseDown = (e: MouseEvent): void => {
    // Middle mouse button OR right mouse button = rotate
    if (e.button === 1 || e.button === 2) {
      this.isRotating = true;
      this.previousMouse.set(e.clientX, e.clientY);
    }
    // Shift + left click = pan
    if (e.button === 0 && e.shiftKey) {
      this.isPanning = true;
      this.previousMouse.set(e.clientX, e.clientY);
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.currentMouse.set(e.clientX, e.clientY);
    const deltaX = e.clientX - this.previousMouse.x;
    const deltaY = e.clientY - this.previousMouse.y;

    if (this.isRotating) {
      // Rotate around target
      this.targetSpherical.theta -= deltaX * CAMERA.rotateSpeed * 0.01;
      this.targetSpherical.phi -= deltaY * CAMERA.rotateSpeed * 0.01;

      // Clamp phi (avoid flipping)
      this.targetSpherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.targetSpherical.phi));

      this.previousMouse.set(e.clientX, e.clientY);
    }

    if (this.isPanning) {
      // Pan on the XZ plane
      const panScale = this.spherical.radius * 0.002;

      // Calculate pan direction based on camera orientation
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      right.y = 0;
      right.normalize();

      this.targetTarget.addScaledVector(right, -deltaX * panScale);
      this.targetTarget.addScaledVector(forward, deltaY * panScale);

      this.previousMouse.set(e.clientX, e.clientY);
    }
  };

  private onMouseUp = (_e: MouseEvent): void => {
    this.isRotating = false;
    this.isPanning = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const zoomDelta = e.deltaY > 0 ? CAMERA.zoomSpeed : 1 / CAMERA.zoomSpeed;
    this.targetSpherical.radius *= zoomDelta;

    // Clamp zoom
    this.targetSpherical.radius = Math.max(
      CAMERA.minDistance,
      Math.min(CAMERA.maxDistance, this.targetSpherical.radius),
    );
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  /** Smoothly update camera position */
  update(): void {
    // Lerp spherical coordinates
    this.spherical.radius += (this.targetSpherical.radius - this.spherical.radius) * this.smoothFactor;
    this.spherical.theta += (this.targetSpherical.theta - this.spherical.theta) * this.smoothFactor;
    this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * this.smoothFactor;

    // Lerp target
    this.target.lerp(this.targetTarget, this.smoothFactor);

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  /** Get current camera target */
  getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  /** Set camera target position */
  setTarget(x: number, y: number, z: number): void {
    this.targetTarget.set(x, y, z);
  }

  /** Get normalized mouse position (-1 to 1) for raycasting */
  getNormalizedMouse(): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((this.currentMouse.x - rect.left) / rect.width) * 2 - 1,
      -((this.currentMouse.y - rect.top) / rect.height) * 2 + 1,
    );
  }

  /** Dispose event listeners */
  dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }
}
