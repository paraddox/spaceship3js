import * as THREE from 'three';
import type { HexCoord } from './types';

export const SQRT3 = Math.sqrt(3);
export const HEX_SIZE = 1.2;
export const HEX_HEIGHT = 0.42;

const DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

export function normalizeRotation(rotation: number): number {
  return ((rotation % 6) + 6) % 6;
}

export function rotateHexCW(hex: HexCoord, steps: number): HexCoord {
  let current = { ...hex };
  for (let i = 0; i < normalizeRotation(steps); i += 1) {
    current = { q: -current.r, r: current.q + current.r };
  }
  return current;
}

export function transformFootprint(footprint: HexCoord[], rotation: number): HexCoord[] {
  return footprint.map((hex) => rotateHexCW(hex, rotation));
}

export function addHex(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function getNeighbors(hex: HexCoord): HexCoord[] {
  return DIRECTIONS.map((dir) => addHex(hex, dir));
}

export function hexToWorld(hex: HexCoord, size = HEX_SIZE): THREE.Vector3 {
  const x = size * (1.5 * hex.q);
  const z = size * ((SQRT3 / 2) * hex.q + SQRT3 * hex.r);
  return new THREE.Vector3(x, 0, z);
}

export function worldToHex(x: number, z: number, size = HEX_SIZE): HexCoord {
  const q = (2 / 3 * x) / size;
  const r = ((-1 / 3) * x + (SQRT3 / 3) * z) / size;
  return roundHex(q, r);
}

export function roundHex(q: number, r: number): HexCoord {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

export function generateHexRing(radius: number): HexCoord[] {
  const result: HexCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) <= radius) {
        result.push({ q, r });
      }
    }
  }
  return result;
}

export function lerpAngle(current: number, target: number, t: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * t;
}
