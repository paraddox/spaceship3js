import type { ShipBlueprint } from '../core/types';
import type { HangarEntry } from './hangar';
import { sortHangarEntries } from './hangar';
import { getEncounterPreset } from './encounters';
import {
  DEFAULT_PROGRESSION_STATE,
  type ProgressionState,
} from './progression';
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
} from './onboarding';
import {
  DEFAULT_LEGACY_STATE,
  MAX_ACTIVE_BONUSES,
  STARTING_BONUSES,
  type CompletedMilestone,
  type LegacyState,
  type StartingBonusId,
} from './legacy';
import {
  DEFAULT_SALVAGE_COLLECTION,
  type SalvageCollection,
  type SalvageRarity,
  type SalvagedBlueprint,
} from './salvage';
import type { WingmanConfig } from './wingman';
import {
  createMutagenState,
  getMutationDef,
  MAX_ESSENCE_SLOTS,
  MAX_UNIQUE_MUTATIONS,
  type Essence,
  type MutagenId,
  type MutagenState,
  type Mutation,
} from './mutagen';
import {
  DEFAULT_LINEAGE_LOCKER,
  type CorruptedModule,
  type LineageLocker,
} from './lineage';
import {
  computeRunGrade,
  DEFAULT_RUN_STATS,
  getCauseOfDeath,
  type RunStats,
} from './run-report';
import {
  getTitleDef,
  type RunRecord,
} from './run-chronicle';
import {
  createNemesisState,
  type NemesisProfile,
  type NemesisState,
} from './nemesis';
import {
  cloneBlueprint,
  parseBlueprint,
} from '../state/shipBlueprint';

export const CAREER_PROFILE_VERSION = 1;

export interface CareerProfileData {
  blueprint: ShipBlueprint;
  selectedEncounterId: string;
  hangarEntries: HangarEntry[];
  progression: ProgressionState;
  onboardingState: OnboardingState;
  legacyState: LegacyState;
  salvageCollection: SalvageCollection;
  wingmanConfig: WingmanConfig | null;
  mutagenState: MutagenState;
  lineageLocker: LineageLocker;
  chronicleRecords: RunRecord[];
  selectedTitle: string | null;
  nemesisState: NemesisState;
}

interface CareerProfileEnvelope {
  type: 'spachip3js-career';
  version: number;
  exportedAt: string;
  data: CareerProfileData;
}

export type CareerProfileImportResult =
  | { ok: true; profile: CareerProfileData }
  | { ok: false; error: string };

const VALID_BONUS_IDS = new Set<StartingBonusId>(STARTING_BONUSES.map((bonus) => bonus.id));
const VALID_RARITIES = new Set<SalvageRarity>(['common', 'rare', 'epic', 'legendary']);

export function serializeCareerProfile(data: CareerProfileData): string {
  const envelope: CareerProfileEnvelope = {
    type: 'spachip3js-career',
    version: CAREER_PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      ...data,
      blueprint: cloneBlueprint(data.blueprint),
      hangarEntries: data.hangarEntries.map((entry) => ({
        ...entry,
        blueprint: cloneBlueprint(entry.blueprint),
      })),
      salvageCollection: {
        ...data.salvageCollection,
        entries: data.salvageCollection.entries.map((entry) => ({
          ...entry,
          blueprint: cloneBlueprint(entry.blueprint),
        })),
      },
      lineageLocker: {
        modules: data.lineageLocker.modules.map((module) => structuredClone(module)),
      },
      chronicleRecords: data.chronicleRecords.map((record) => structuredClone(record)),
      nemesisState: structuredClone(data.nemesisState),
    },
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseCareerProfile(raw: string): CareerProfileImportResult {
  try {
    const parsed = JSON.parse(raw) as Partial<CareerProfileEnvelope>;
    if (!isRecord(parsed) || parsed.type !== 'spachip3js-career') {
      return { ok: false, error: 'That backup does not look like a Spachip3JS career export.' };
    }
    if (Number(parsed.version) !== CAREER_PROFILE_VERSION) {
      return { ok: false, error: 'That backup version is not supported by this build.' };
    }
    if (!isRecord(parsed.data)) {
      return { ok: false, error: 'That backup is missing its career data payload.' };
    }

    const blueprint = sanitizeBlueprint(parsed.data.blueprint);
    if (!blueprint) {
      return { ok: false, error: 'That backup contains an invalid current ship blueprint.' };
    }

    return {
      ok: true,
      profile: {
        blueprint,
        selectedEncounterId: sanitizeEncounterId(parsed.data.selectedEncounterId),
        hangarEntries: sanitizeHangarEntries(parsed.data.hangarEntries),
        progression: sanitizeProgression(parsed.data.progression),
        onboardingState: sanitizeOnboardingState(parsed.data.onboardingState),
        legacyState: sanitizeLegacyState(parsed.data.legacyState),
        salvageCollection: sanitizeSalvageCollection(parsed.data.salvageCollection),
        wingmanConfig: sanitizeWingmanConfig(parsed.data.wingmanConfig),
        mutagenState: sanitizeMutagenState(parsed.data.mutagenState),
        lineageLocker: sanitizeLineageLocker(parsed.data.lineageLocker),
        chronicleRecords: sanitizeChronicleRecords(parsed.data.chronicleRecords),
        selectedTitle: sanitizeSelectedTitle(parsed.data.selectedTitle),
        nemesisState: sanitizeNemesisState(parsed.data.nemesisState),
      },
    };
  } catch {
    return { ok: false, error: 'That backup could not be parsed as JSON.' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeBlueprint(value: unknown): ShipBlueprint | null {
  if (!isRecord(value)) return null;
  const parsed = parseBlueprint(JSON.stringify(value));
  return parsed ? cloneBlueprint(parsed) : null;
}

function sanitizeEncounterId(value: unknown): string {
  const id = typeof value === 'string' ? value : '';
  if (id === 'endless' || getEncounterPreset(id)) return id;
  return 'gauntlet';
}

function sanitizeHangarEntries(value: unknown): HangarEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value
    .map((candidate) => {
      if (!isRecord(candidate)) return null;
      const blueprint = sanitizeBlueprint(candidate.blueprint);
      if (!blueprint) return null;
      return {
        id: typeof candidate.id === 'string' ? candidate.id : `hangar-${Math.random().toString(36).slice(2)}`,
        name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : blueprint.name,
        blueprint,
        updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : new Date().toISOString(),
      } satisfies HangarEntry;
    })
    .filter((entry): entry is HangarEntry => entry !== null);
  return sortHangarEntries(entries);
}

function sanitizeProgression(value: unknown): ProgressionState {
  const data = isRecord(value) ? value : {};
  const bestEncounterScores = isRecord(data.bestEncounterScores)
    ? Object.fromEntries(Object.entries(data.bestEncounterScores).map(([key, entryValue]) => [key, Number(entryValue ?? 0)]))
    : {};
  return {
    credits: Number(data.credits ?? 0),
    completedEncounterIds: Array.isArray(data.completedEncounterIds) ? data.completedEncounterIds.map(String) : [],
    bestEncounterScores,
    unlockedModuleIds: Array.isArray(data.unlockedModuleIds)
      ? data.unlockedModuleIds.map(String)
      : [...DEFAULT_PROGRESSION_STATE.unlockedModuleIds],
  };
}

function sanitizeOnboardingState(value: unknown): OnboardingState {
  const data = isRecord(value) ? value : {};
  return {
    hasSeenEditor: Boolean(data.hasSeenEditor ?? DEFAULT_ONBOARDING_STATE.hasSeenEditor),
    hasLaunchedFlight: Boolean(data.hasLaunchedFlight ?? DEFAULT_ONBOARDING_STATE.hasLaunchedFlight),
    hasCompletedEncounter: Boolean(data.hasCompletedEncounter ?? DEFAULT_ONBOARDING_STATE.hasCompletedEncounter),
    editorTipsDismissed: Boolean(data.editorTipsDismissed ?? DEFAULT_ONBOARDING_STATE.editorTipsDismissed),
    postFlightTipsDismissed: Boolean(data.postFlightTipsDismissed ?? DEFAULT_ONBOARDING_STATE.postFlightTipsDismissed),
  };
}

function sanitizeLegacyState(value: unknown): LegacyState {
  const data = isRecord(value) ? value : {};
  const completedMilestones = Array.isArray(data.completedMilestones)
    ? data.completedMilestones
      .map((entry) => sanitizeCompletedMilestone(entry))
      .filter((entry): entry is CompletedMilestone => entry !== null)
    : [];
  const unlockedBonuses = Array.isArray(data.unlockedBonuses)
    ? data.unlockedBonuses.map(String).filter((id): id is StartingBonusId => VALID_BONUS_IDS.has(id as StartingBonusId))
    : [];
  const activeBonuses = Array.isArray(data.activeBonuses)
    ? data.activeBonuses
      .map(String)
      .filter((id): id is StartingBonusId => VALID_BONUS_IDS.has(id as StartingBonusId))
      .slice(0, MAX_ACTIVE_BONUSES)
    : [];
  return {
    totalXp: Number(data.totalXp ?? DEFAULT_LEGACY_STATE.totalXp),
    totalRuns: Number(data.totalRuns ?? DEFAULT_LEGACY_STATE.totalRuns),
    bestWave: Number(data.bestWave ?? DEFAULT_LEGACY_STATE.bestWave),
    bestScore: Number(data.bestScore ?? DEFAULT_LEGACY_STATE.bestScore),
    bestGrade: typeof data.bestGrade === 'string' ? data.bestGrade : DEFAULT_LEGACY_STATE.bestGrade,
    totalKills: Number(data.totalKills ?? DEFAULT_LEGACY_STATE.totalKills),
    totalCreditsEarned: Number(data.totalCreditsEarned ?? DEFAULT_LEGACY_STATE.totalCreditsEarned),
    completedMilestones,
    unlockedBonuses,
    activeBonuses,
    totalSalvaged: Number(data.totalSalvaged ?? DEFAULT_LEGACY_STATE.totalSalvaged),
  };
}

function sanitizeCompletedMilestone(value: unknown): CompletedMilestone | null {
  if (!isRecord(value) || typeof value.milestoneId !== 'string') return null;
  return {
    milestoneId: value.milestoneId,
    completedAt: Number(value.completedAt ?? Date.now()),
    runNumber: Number(value.runNumber ?? 0),
  };
}

function sanitizeSalvageCollection(value: unknown): SalvageCollection {
  const data = isRecord(value) ? value : {};
  return {
    entries: Array.isArray(data.entries)
      ? data.entries
        .map((entry) => sanitizeSalvagedBlueprint(entry))
        .filter((entry): entry is SalvagedBlueprint => entry !== null)
      : [],
    totalAttempts: Number(data.totalAttempts ?? DEFAULT_SALVAGE_COLLECTION.totalAttempts),
    totalSalvaged: Number(data.totalSalvaged ?? DEFAULT_SALVAGE_COLLECTION.totalSalvaged),
  };
}

function sanitizeSalvagedBlueprint(value: unknown): SalvagedBlueprint | null {
  if (!isRecord(value)) return null;
  const blueprint = sanitizeBlueprint(value.blueprint);
  const rarity = typeof value.rarity === 'string' && VALID_RARITIES.has(value.rarity as SalvageRarity)
    ? value.rarity as SalvageRarity
    : 'common';
  if (!blueprint) return null;
  return {
    id: typeof value.id === 'string' ? value.id : `salvage-${Math.random().toString(36).slice(2)}`,
    blueprint,
    rarity,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : blueprint.name,
    waveNumber: Number(value.waveNumber ?? 0),
    wasBoss: Boolean(value.wasBoss),
    affixNames: Array.isArray(value.affixNames) ? value.affixNames.map(String) : [],
    salvagedAt: Number(value.salvagedAt ?? Date.now()),
    runNumber: Number(value.runNumber ?? 0),
  };
}

function sanitizeWingmanConfig(value: unknown): WingmanConfig | null {
  if (!isRecord(value)) return null;
  if (typeof value.blueprintId !== 'string' || typeof value.name !== 'string' || typeof value.color !== 'string') {
    return null;
  }
  return {
    blueprintId: value.blueprintId,
    name: value.name,
    color: value.color,
  };
}

function sanitizeMutagenState(value: unknown): MutagenState {
  const data = isRecord(value) ? value : {};
  return {
    mutations: Array.isArray(data.mutations)
      ? data.mutations
        .map((entry) => sanitizeMutation(entry))
        .filter((entry): entry is Mutation => entry !== null)
        .slice(0, MAX_UNIQUE_MUTATIONS)
      : [],
    pendingEssence: Array.isArray(data.pendingEssence)
      ? data.pendingEssence
        .map((entry) => sanitizeEssence(entry))
        .filter((entry): entry is Essence => entry !== null)
        .slice(0, MAX_ESSENCE_SLOTS)
      : [],
    totalAbsorbed: Number(data.totalAbsorbed ?? createMutagenState().totalAbsorbed),
    totalEssenceCollected: Number(data.totalEssenceCollected ?? createMutagenState().totalEssenceCollected),
  };
}

function sanitizeMutation(value: unknown): Mutation | null {
  if (!isRecord(value)) return null;
  const id = sanitizeMutagenId(value.id);
  if (!id) return null;
  return {
    id,
    stacks: Math.max(1, Number(value.stacks ?? 1)),
  };
}

function sanitizeEssence(value: unknown): Essence | null {
  if (!isRecord(value)) return null;
  const affixId = sanitizeMutagenId(value.affixId);
  if (!affixId) return null;
  return {
    affixId,
    waveNumber: Number(value.waveNumber ?? 0),
  };
}

function sanitizeMutagenId(value: unknown): MutagenId | null {
  const id = typeof value === 'string' ? value as MutagenId : null;
  return id && getMutationDef(id) ? id : null;
}

function sanitizeLineageLocker(value: unknown): LineageLocker {
  const data = isRecord(value) ? value : {};
  return {
    modules: Array.isArray(data.modules)
      ? data.modules
        .map((entry) => sanitizeCorruptedModule(entry))
        .filter((entry): entry is CorruptedModule => entry !== null)
      : [...DEFAULT_LINEAGE_LOCKER.modules],
  };
}

function sanitizeCorruptedModule(value: unknown): CorruptedModule | null {
  if (!isRecord(value) || !isRecord(value.definition)) return null;
  const definition = value.definition as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.baseModuleId !== 'string' || typeof value.displayName !== 'string') return null;
  if (typeof definition.id !== 'string' || typeof definition.displayName !== 'string') return null;
  if (!Array.isArray(value.footprint) || !Array.isArray(definition.footprint)) return null;
  return structuredClone(value as unknown as CorruptedModule);
}

function sanitizeChronicleRecords(value: unknown): RunRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeRunRecord(entry))
    .filter((entry): entry is RunRecord => entry !== null);
}

function sanitizeRunRecord(value: unknown): RunRecord | null {
  if (!isRecord(value)) return null;
  const stats = sanitizeRunStats(value.stats);
  if (!stats) return null;
  return {
    id: typeof value.id === 'string' ? value.id : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : new Date().toISOString(),
    stats,
    grade: computeRunGrade(stats),
    causeOfDeath: typeof value.causeOfDeath === 'string' && value.causeOfDeath ? value.causeOfDeath : getCauseOfDeath(stats),
    sigil: isRecord(value.sigil) && typeof value.sigil.id === 'string' && typeof value.sigil.tier === 'number'
      ? { id: value.sigil.id, tier: value.sigil.tier }
      : null,
    mutators: Array.isArray(value.mutators) ? value.mutators.map(String) : [],
    upgrades: Array.isArray(value.upgrades) ? value.upgrades.map(String) : [],
    shipName: typeof value.shipName === 'string' && value.shipName.trim() ? value.shipName : 'Unnamed Ship',
    crisisChoices: Array.isArray(value.crisisChoices) ? value.crisisChoices.map(String) : [],
    nemesisKills: Number(value.nemesisKills ?? 0),
    riftsSurvived: Number(value.riftsSurvived ?? 0),
  };
}

function sanitizeRunStats(value: unknown): RunStats | null {
  if (!isRecord(value)) return null;
  return {
    waveReached: Number(value.waveReached ?? DEFAULT_RUN_STATS.waveReached),
    totalKills: Number(value.totalKills ?? DEFAULT_RUN_STATS.totalKills),
    eliteKills: Number(value.eliteKills ?? DEFAULT_RUN_STATS.eliteKills),
    bossKills: Number(value.bossKills ?? DEFAULT_RUN_STATS.bossKills),
    score: Number(value.score ?? DEFAULT_RUN_STATS.score),
    creditsEarned: Number(value.creditsEarned ?? DEFAULT_RUN_STATS.creditsEarned),
    timeSeconds: Number(value.timeSeconds ?? DEFAULT_RUN_STATS.timeSeconds),
    bestCombo: Number(value.bestCombo ?? DEFAULT_RUN_STATS.bestCombo),
    highestComboTier: typeof value.highestComboTier === 'string' ? value.highestComboTier : DEFAULT_RUN_STATS.highestComboTier,
    damageDealt: Number(value.damageDealt ?? DEFAULT_RUN_STATS.damageDealt),
    damageTaken: Number(value.damageTaken ?? DEFAULT_RUN_STATS.damageTaken),
    pickupsCollected: Number(value.pickupsCollected ?? DEFAULT_RUN_STATS.pickupsCollected),
    hpRemaining: Number(value.hpRemaining ?? DEFAULT_RUN_STATS.hpRemaining),
    maxHp: Number(value.maxHp ?? DEFAULT_RUN_STATS.maxHp),
    mutatorsChosen: Array.isArray(value.mutatorsChosen) ? value.mutatorsChosen.map(String) : [],
    upgradesPurchased: Array.isArray(value.upgradesPurchased) ? value.upgradesPurchased.map(String) : [],
    overdriveActivations: Number(value.overdriveActivations ?? DEFAULT_RUN_STATS.overdriveActivations),
    dashCount: Number(value.dashCount ?? DEFAULT_RUN_STATS.dashCount),
    abilityActivations: Number(value.abilityActivations ?? DEFAULT_RUN_STATS.abilityActivations),
    blueprintsSalvaged: Number(value.blueprintsSalvaged ?? DEFAULT_RUN_STATS.blueprintsSalvaged),
    nearMissTotal: Number(value.nearMissTotal ?? DEFAULT_RUN_STATS.nearMissTotal),
    nearMissBestStreak: Number(value.nearMissBestStreak ?? DEFAULT_RUN_STATS.nearMissBestStreak),
  };
}

function sanitizeSelectedTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return getTitleDef(value) ? value : null;
}

function sanitizeNemesisState(value: unknown): NemesisState {
  const data = isRecord(value) ? value : {};
  return {
    active: sanitizeNemesisProfile(data.active),
    archiveCount: Number(data.archiveCount ?? createNemesisState().archiveCount),
  };
}

function sanitizeNemesisProfile(value: unknown): NemesisProfile | null {
  if (!isRecord(value)) return null;
  const blueprint = sanitizeBlueprint(value.blueprint);
  if (!blueprint) return null;
  return {
    id: typeof value.id === 'string' ? value.id : `nemesis-${Math.random().toString(36).slice(2)}`,
    callsign: typeof value.callsign === 'string' && value.callsign.trim() ? value.callsign : blueprint.name,
    blueprint,
    level: Math.max(1, Number(value.level ?? 1)),
    killsPlayer: Number(value.killsPlayer ?? 0),
    defeats: Number(value.defeats ?? 0),
    introWave: Number(value.introWave ?? 0),
    lastSeenWave: Number(value.lastSeenWave ?? 0),
  };
}
