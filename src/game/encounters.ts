import * as THREE from 'three';
import type { ShipBlueprint } from '../core/types';
import type { EncounterObjective } from './objectives';
import { DEFAULT_CREW_ALLOCATION } from './crew';
import { createExampleBlueprint } from '../state/shipBlueprint';

export interface EncounterEnemy {
  id: string;
  blueprint: ShipBlueprint;
  position: THREE.Vector3;
  rotation: number;
  preferredRange: number;
  fireJitter: number;
}

export interface EncounterWave {
  name: string;
  enemies: EncounterEnemy[];
}

export interface EncounterPreset {
  id: string;
  displayName: string;
  description: string;
  objective: EncounterObjective;
  alliedBlueprint?: ShipBlueprint;
  waves: EncounterWave[];
}

const waveOneEnemy = createExampleBlueprint();
waveOneEnemy.name = 'Red Aggressor';
waveOneEnemy.crew = { ...DEFAULT_CREW_ALLOCATION, gunner: 1 };
waveOneEnemy.modules = waveOneEnemy.modules.map((module, index) =>
  index === waveOneEnemy.modules.length - 1 ? { ...module, definitionId: 'core:cannon_kinetic' } : module,
);

const missileEnemy = createExampleBlueprint();
missileEnemy.name = 'Missile Hunter';
missileEnemy.crew = { ...DEFAULT_CREW_ALLOCATION, tactician: 2 };
missileEnemy.modules = missileEnemy.modules.map((module, index) =>
  index === missileEnemy.modules.length - 1 ? { ...module, definitionId: 'core:missile_launcher' } : module,
);

const beamEnemy = createExampleBlueprint();
beamEnemy.name = 'Beam Interdictor';
beamEnemy.crew = { ...DEFAULT_CREW_ALLOCATION, engineer: 2, gunner: 1 };
beamEnemy.modules = beamEnemy.modules.map((module, index) =>
  index === beamEnemy.modules.length - 1 ? { ...module, definitionId: 'core:laser_beam_light' } : module,
);

const frigateEnemy: ShipBlueprint = {
  name: 'Frigate Spearhead',
  crew: { ...DEFAULT_CREW_ALLOCATION, gunner: 2, tactician: 2 },
  modules: [
    { instanceId: 'bridge-f', definitionId: 'core:bridge_frigate', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor-f1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'hull-f1', definitionId: 'core:hull_2x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine-f1', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'engine-f2', definitionId: 'core:thruster_lateral', position: { q: -2, r: 1 }, rotation: 0 },
    { instanceId: 'drone-f1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 1 }, rotation: 0 },
    { instanceId: 'weapon-f1', definitionId: 'core:missile_launcher', position: { q: 0, r: -2 }, rotation: 0 },
    { instanceId: 'weapon-f2', definitionId: 'core:laser_light', position: { q: -1, r: -1 }, rotation: 0 },
  ],
};

const convoyAlly: ShipBlueprint = {
  name: 'Civilian Convoy',
  crew: { ...DEFAULT_CREW_ALLOCATION, engineer: 2 },
  modules: [
    { instanceId: 'ally-bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'ally-reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'ally-hull', definitionId: 'core:hull_2x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'ally-engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
  ],
};

export const ENCOUNTER_PRESETS: EncounterPreset[] = [
  {
    id: 'gauntlet',
    displayName: 'Frontier Gauntlet',
    description: 'Three escalating combat waves that showcase core sandbox combat.',
    objective: { type: 'eliminate_all', label: 'Destroy all hostile ships' },
    waves: [
      {
        name: 'Wave 1',
        enemies: [
          { id: 'enemy-1', blueprint: waveOneEnemy, position: new THREE.Vector3(-8, 0, -8), rotation: 0.3, preferredRange: 9, fireJitter: 0.35 },
          { id: 'enemy-2', blueprint: missileEnemy, position: new THREE.Vector3(8, 0, -10), rotation: -0.2, preferredRange: 11, fireJitter: 0.55 },
        ],
      },
      {
        name: 'Wave 2',
        enemies: [
          { id: 'enemy-3', blueprint: waveOneEnemy, position: new THREE.Vector3(-11, 0, -6), rotation: 0.1, preferredRange: 8, fireJitter: 0.3 },
          { id: 'enemy-4', blueprint: beamEnemy, position: new THREE.Vector3(0, 0, -12), rotation: 0.0, preferredRange: 8.5, fireJitter: 0.2 },
          { id: 'enemy-5', blueprint: missileEnemy, position: new THREE.Vector3(11, 0, -6), rotation: -0.1, preferredRange: 12, fireJitter: 0.5 },
        ],
      },
      {
        name: 'Wave 3',
        enemies: [
          { id: 'enemy-6', blueprint: frigateEnemy, position: new THREE.Vector3(0, 0, -12), rotation: 0.0, preferredRange: 10, fireJitter: 0.3 },
          { id: 'enemy-7', blueprint: beamEnemy, position: new THREE.Vector3(-10, 0, -11), rotation: 0.2, preferredRange: 9.5, fireJitter: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'duel',
    displayName: 'Captain\'s Duel',
    description: 'A focused one-wave duel against a frigate-class opponent.',
    objective: { type: 'eliminate_all', label: 'Defeat the enemy flagship' },
    waves: [
      {
        name: 'Duel',
        enemies: [
          { id: 'duel-1', blueprint: frigateEnemy, position: new THREE.Vector3(0, 0, -11), rotation: 0, preferredRange: 10, fireJitter: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'survival',
    displayName: 'Survival Scramble',
    description: 'Fast-moving skirmishers with beam and missile pressure.',
    objective: { type: 'survive', label: 'Survive until rescue arrives', durationSeconds: 45 },
    waves: [
      {
        name: 'Scramble',
        enemies: [
          { id: 'survival-1', blueprint: waveOneEnemy, position: new THREE.Vector3(-12, 0, -8), rotation: 0.15, preferredRange: 7.5, fireJitter: 0.35 },
          { id: 'survival-2', blueprint: beamEnemy, position: new THREE.Vector3(0, 0, -12), rotation: 0, preferredRange: 7.5, fireJitter: 0.1 },
          { id: 'survival-3', blueprint: missileEnemy, position: new THREE.Vector3(12, 0, -8), rotation: -0.15, preferredRange: 11.5, fireJitter: 0.45 },
        ],
      },
    ],
  },
  {
    id: 'escort',
    displayName: 'Convoy Escort',
    description: 'Protect a fragile civilian convoy ship while clearing raiders.',
    objective: { type: 'protect_ally', label: 'Protect the convoy ship' },
    alliedBlueprint: convoyAlly,
    waves: [
      {
        name: 'Raiders',
        enemies: [
          { id: 'escort-1', blueprint: waveOneEnemy, position: new THREE.Vector3(-10, 0, -7), rotation: 0.15, preferredRange: 7.5, fireJitter: 0.3 },
          { id: 'escort-2', blueprint: beamEnemy, position: new THREE.Vector3(10, 0, -7), rotation: -0.15, preferredRange: 8.5, fireJitter: 0.2 },
        ],
      },
      {
        name: 'Reinforcements',
        enemies: [
          { id: 'escort-3', blueprint: missileEnemy, position: new THREE.Vector3(-6, 0, -12), rotation: 0.1, preferredRange: 10, fireJitter: 0.4 },
          { id: 'escort-4', blueprint: waveOneEnemy, position: new THREE.Vector3(8, 0, -11), rotation: -0.1, preferredRange: 8, fireJitter: 0.3 },
          { id: 'escort-5', blueprint: beamEnemy, position: new THREE.Vector3(0, 0, -13), rotation: 0.0, preferredRange: 7.5, fireJitter: 0.15 },
        ],
      },
    ],
  },
];

export function getEncounterPreset(id: string): EncounterPreset | undefined {
  return ENCOUNTER_PRESETS.find((preset) => preset.id === id);
}
