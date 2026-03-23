import type { ShipBlueprint } from '../core/types';
import type { EncounterEnemy, EncounterWave } from './encounters';
import { rollAffixes, type RolledAffix } from './elite-affixes';

export interface NemesisProfile {
  id: string;
  callsign: string;
  blueprint: ShipBlueprint;
  level: number;
  killsPlayer: number;
  defeats: number;
  introWave: number;
  lastSeenWave: number;
}

export interface NemesisState {
  active: NemesisProfile | null;
  archiveCount: number;
}

export interface NemesisCandidate {
  blueprint: ShipBlueprint;
  waveNumber: number;
  isBoss: boolean;
}

export const NEMESIS_STORAGE_KEY = 'spachip3js.nemesis';
const EPITHETS = ['Blackstar', 'Grudge', 'Warden', 'Ruin', 'Needle', 'Ash', 'Vanta', 'Hex'];

export function createNemesisState(): NemesisState {
  return {
    active: null,
    archiveCount: 0,
  };
}

export function loadNemesisState(): NemesisState {
  try {
    const saved = window.localStorage.getItem(NEMESIS_STORAGE_KEY);
    if (!saved) return createNemesisState();
    const data = JSON.parse(saved) as Partial<NemesisState>;
    return {
      active: data.active ?? null,
      archiveCount: Number(data.archiveCount ?? 0),
    };
  } catch {
    return createNemesisState();
  }
}

export function persistNemesisState(state: NemesisState): void {
  window.localStorage.setItem(NEMESIS_STORAGE_KEY, JSON.stringify(state));
}

export function shouldSpawnNemesis(state: NemesisState, waveNumber: number): boolean {
  if (!state.active) return false;
  const firstWave = Math.max(6, state.active.introWave + 2);
  return waveNumber >= firstWave && (waveNumber - firstWave) % 4 === 0;
}

export function createNemesisFromCandidate(state: NemesisState, candidate: NemesisCandidate): NemesisState {
  if (state.active) return state;
  const baseName = candidate.blueprint.name.replace(/^the\s+/i, '').trim();
  const callsign = `${baseName} ${EPITHETS[candidate.waveNumber % EPITHETS.length]}`;
  return {
    ...state,
    active: {
      id: `nemesis-${Date.now()}-${candidate.waveNumber}`,
      callsign,
      blueprint: structuredClone(candidate.blueprint),
      level: candidate.isBoss ? 3 : 1,
      killsPlayer: 1,
      defeats: 0,
      introWave: candidate.waveNumber,
      lastSeenWave: candidate.waveNumber,
    },
  };
}

export function recordNemesisVictory(state: NemesisState, waveNumber: number): NemesisState {
  if (!state.active) return state;
  return {
    ...state,
    active: {
      ...state.active,
      killsPlayer: state.active.killsPlayer + 1,
      level: state.active.level + 1,
      lastSeenWave: waveNumber,
    },
  };
}

export function recordNemesisDefeat(state: NemesisState, waveNumber: number): NemesisState {
  if (!state.active) return state;
  const defeats = state.active.defeats + 1;
  if (defeats >= 3) {
    return {
      active: null,
      archiveCount: state.archiveCount + 1,
    };
  }
  return {
    ...state,
    active: {
      ...state.active,
      defeats,
      level: state.active.level + 1,
      lastSeenWave: waveNumber,
    },
  };
}

export function injectNemesisIntoWave(state: NemesisState, wave: EncounterWave, waveNumber: number): EncounterWave {
  if (!state.active || wave.enemies.length === 0) return wave;
  const replaceIndex = pickStrongestEnemyIndex(wave.enemies);
  const replaced = wave.enemies[replaceIndex];
  if (!replaced) return wave;

  const affixes = buildNemesisAffixes(state.active, waveNumber);
  const nemesisEnemy: EncounterEnemy = {
    ...replaced,
    id: `nemesis-${state.active.id}-wave-${waveNumber}`,
    blueprint: {
      ...structuredClone(state.active.blueprint),
      name: state.active.callsign,
    },
    preferredRange: Math.max(7, replaced.preferredRange - 0.5),
    fireJitter: Math.max(0.08, replaced.fireJitter * 0.7),
    affixes,
    nemesisProfileId: state.active.id,
    nemesisLevel: state.active.level,
    nemesisDisplayName: state.active.callsign,
  };

  return {
    ...wave,
    name: `${wave.name} · Nemesis Contact`,
    enemies: wave.enemies.map((enemy, index) => (index === replaceIndex ? nemesisEnemy : enemy)),
  };
}

export function getNemesisReward(level: number): { credits: number; score: number } {
  return {
    credits: 25 + level * 12,
    score: 140 + level * 90,
  };
}

export function getNemesisBanner(profile: NemesisProfile): string {
  return `☠ Nemesis Contact — ${profile.callsign}`;
}

export function getNemesisStatus(profile: NemesisProfile): string {
  return `Level ${profile.level} · Kills ${profile.killsPlayer} · Defeats ${profile.defeats}`;
}

function pickStrongestEnemyIndex(enemies: EncounterEnemy[]): number {
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    const score = enemy.blueprint.modules.length * 10 + (enemy.affixes?.length ?? 0) * 20;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildNemesisAffixes(profile: NemesisProfile, waveNumber: number): RolledAffix[] {
  const affixBudget = Math.min(4, 1 + Math.floor(profile.level / 2));
  const rolled = rollAffixes(waveNumber + profile.level, profile.level >= 3, waveNumber * 17 + profile.level * 31);
  if (rolled.length > 0) return rolled.slice(0, affixBudget);
  return rollAffixes(10 + profile.level, true, waveNumber * 29 + profile.level * 19).slice(0, Math.max(1, affixBudget));
}
