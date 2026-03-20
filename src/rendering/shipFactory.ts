import * as THREE from 'three';
import type { HexCoord, ModuleCategory, ShipBlueprint } from '../core/types';
import { HEX_HEIGHT, HEX_SIZE, hexToWorld, transformFootprint } from '../core/hex';
import { getModuleDefinition } from '../state/shipBlueprint';

const CATEGORY_HEIGHT: Record<ModuleCategory, number> = {
  bridge: HEX_HEIGHT * 1.25,
  hull: HEX_HEIGHT,
  reactor: HEX_HEIGHT * 1.15,
  engine: HEX_HEIGHT * 0.95,
  weapon: HEX_HEIGHT * 1.35,
};

const hexGeometry = new THREE.CylinderGeometry(HEX_SIZE * 0.96, HEX_SIZE * 0.96, 1, 6);
hexGeometry.rotateY(Math.PI / 6);

const edgeGeometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(HEX_SIZE * 0.98, HEX_SIZE * 0.98, 1, 6));
edgeGeometry.rotateY(Math.PI / 6);

function makeMaterial(color: string, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    emissive: new THREE.Color(color).multiplyScalar(0.08),
    roughness: 0.75,
    metalness: 0.15,
  });
}

export function buildShipGroup(blueprint: ShipBlueprint, opacity = 1): THREE.Group {
  const group = new THREE.Group();

  for (const placed of blueprint.modules) {
    const definition = getModuleDefinition(placed.definitionId);
    const transformed = transformFootprint(definition.footprint, placed.rotation);
    const height = CATEGORY_HEIGHT[definition.category];

    for (const localHex of transformed) {
      const worldHex = { q: placed.position.q + localHex.q, r: placed.position.r + localHex.r };
      const basePosition = hexToWorld(worldHex);
      const mesh = new THREE.Mesh(hexGeometry, makeMaterial(definition.color, opacity));
      mesh.scale.y = height;
      mesh.position.set(basePosition.x, height / 2, basePosition.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const outline = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: opacity < 1, opacity: Math.max(opacity, 0.25) }),
      );
      outline.scale.y = height;
      outline.position.copy(mesh.position);
      group.add(outline);
    }
  }

  return group;
}

export function buildPreviewGroup(definitionId: string, anchor: HexCoord, rotation: number): THREE.Group {
  const definition = getModuleDefinition(definitionId);
  const preview = new THREE.Group();
  const transformed = transformFootprint(definition.footprint, rotation);
  const height = CATEGORY_HEIGHT[definition.category];

  for (const localHex of transformed) {
    const world = hexToWorld({ q: anchor.q + localHex.q, r: anchor.r + localHex.r });
    const mesh = new THREE.Mesh(hexGeometry, new THREE.MeshStandardMaterial({
      color: definition.color,
      transparent: true,
      opacity: 0.45,
      emissive: new THREE.Color(definition.color).multiplyScalar(0.12),
    }));
    mesh.scale.y = height;
    mesh.position.set(world.x, height / 2 + 0.02, world.z);
    preview.add(mesh);
  }

  return preview;
}

export function computeBlueprintRadius(blueprint: ShipBlueprint): number {
  let radius = 0;
  for (const placed of blueprint.modules) {
    const definition = getModuleDefinition(placed.definitionId);
    const transformed = transformFootprint(definition.footprint, placed.rotation);
    for (const localHex of transformed) {
      const pos = hexToWorld({ q: placed.position.q + localHex.q, r: placed.position.r + localHex.r });
      radius = Math.max(radius, Math.hypot(pos.x, pos.z) + HEX_SIZE);
    }
  }
  return Math.max(radius, HEX_SIZE * 1.5);
}
