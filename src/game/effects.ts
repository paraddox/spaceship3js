import * as THREE from 'three';

export type CombatEffectKind = 'beam' | 'impact' | 'explosion';

export interface CombatEffectState {
  kind: CombatEffectKind;
  start: THREE.Vector3;
  end?: THREE.Vector3;
  color: string;
  ttl: number;
  age: number;
  opacity: number;
  scale: number;
}

export function createBeamEffect(start: THREE.Vector3, end: THREE.Vector3, color: string): CombatEffectState {
  return {
    kind: 'beam',
    start: start.clone(),
    end: end.clone(),
    color,
    ttl: 0.18,
    age: 0,
    opacity: 0.95,
    scale: 1,
  };
}

export function createImpactEffect(position: THREE.Vector3, color: string): CombatEffectState {
  return {
    kind: 'impact',
    start: position.clone(),
    color,
    ttl: 0.35,
    age: 0,
    opacity: 0.9,
    scale: 0.55,
  };
}

export function createExplosionEffect(position: THREE.Vector3, color: string): CombatEffectState {
  return {
    kind: 'explosion',
    start: position.clone(),
    color,
    ttl: 0.7,
    age: 0,
    opacity: 1,
    scale: 1.4,
  };
}

export function advanceEffect(effect: CombatEffectState, dt: number): CombatEffectState {
  const age = Math.min(effect.ttl, effect.age + dt);
  const progress = effect.ttl <= 0 ? 1 : age / effect.ttl;
  return {
    ...effect,
    age,
    opacity: Math.max(0, 1 - progress),
    scale: effect.scale * (1 + progress * 0.35),
  };
}
