// ============================================================
// portGizmo — dev-маркеры портов (невидимы в prod-сборке игры).
// ============================================================

import * as THREE from "three";
import type { PortFlow, PortKind } from "../../buildings/buildingPortTypes.ts";

const INPUT_COLOR = 0x38bdf8;
const OUTPUT_COLOR = 0x4ade80;

export function createPortGizmo(
  kind: PortKind,
  type: PortFlow,
  ghost = false,
): THREE.Group {
  const group = new THREE.Group();
  const color = type === "input" ? INPUT_COLOR : OUTPUT_COLOR;
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: ghost,
    opacity: ghost ? 0.55 : 0.92,
    emissive: new THREE.Color(color),
    emissiveIntensity: ghost ? 0.35 : 0.55,
    depthWrite: !ghost,
  });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat);
  sphere.position.y = 0.22;
  group.add(sphere);

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.45, 8),
    mat,
  );
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, 0.22, 0.35);
  group.add(arrow);

  if (kind === "pipe") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.04, 8, 16),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
  }

  return group;
}
