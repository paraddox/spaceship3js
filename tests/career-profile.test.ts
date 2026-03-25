import { describe, expect, it } from 'vitest';
import {
  CAREER_PROFILE_VERSION,
  parseCareerProfile,
  serializeCareerProfile,
  type CareerProfileData,
} from '../src/game/career-profile';
import { DEFAULT_PROGRESSION_STATE } from '../src/game/progression';
import { DEFAULT_ONBOARDING_STATE } from '../src/game/onboarding';
import { DEFAULT_LEGACY_STATE } from '../src/game/legacy';
import { createMutagenState } from '../src/game/mutagen';
import { DEFAULT_LINEAGE_LOCKER } from '../src/game/lineage';
import { buildRunRecord } from '../src/game/run-chronicle';
import { DEFAULT_RUN_STATS } from '../src/game/run-report';
import { createNemesisState } from '../src/game/nemesis';
import { createExampleBlueprint, getModuleDefinition } from '../src/state/shipBlueprint';

function buildProfile(): CareerProfileData {
  const blueprint = createExampleBlueprint();
  const baseWeapon = getModuleDefinition('core:laser_light');
  return {
    blueprint,
    selectedEncounterId: 'endless',
    hangarEntries: [{
      id: 'hangar-1',
      name: 'Stored Alpha',
      blueprint,
      updatedAt: '2026-03-25T12:00:00.000Z',
    }],
    progression: {
      ...DEFAULT_PROGRESSION_STATE,
      credits: 420,
      completedEncounterIds: ['gauntlet'],
      bestEncounterScores: { gauntlet: 1337 },
    },
    onboardingState: {
      ...DEFAULT_ONBOARDING_STATE,
      hasSeenEditor: true,
      hasLaunchedFlight: true,
      hasCompletedEncounter: true,
    },
    legacyState: {
      ...DEFAULT_LEGACY_STATE,
      totalXp: 90,
      totalRuns: 4,
      bestWave: 11,
      unlockedBonuses: ['quick_start'],
      activeBonuses: ['quick_start'],
      completedMilestones: [{ milestoneId: 'first_blood', completedAt: 1, runNumber: 1 }],
    },
    salvageCollection: {
      entries: [{
        id: 'salvage-1',
        blueprint,
        rarity: 'rare',
        name: 'Recovered Scout',
        waveNumber: 7,
        wasBoss: false,
        affixNames: ['Aggressive'],
        salvagedAt: 100,
        runNumber: 2,
      }],
      totalAttempts: 5,
      totalSalvaged: 1,
    },
    wingmanConfig: {
      blueprintId: 'salvage-1',
      name: 'Recovered Scout',
      color: '#60a5fa',
    },
    mutagenState: {
      ...createMutagenState(),
      mutations: [{ id: 'tough', stacks: 2 }],
      pendingEssence: [{ affixId: 'swift', waveNumber: 7 }],
      totalAbsorbed: 2,
      totalEssenceCollected: 3,
    },
    lineageLocker: {
      ...DEFAULT_LINEAGE_LOCKER,
      modules: [{
        id: 'lineage:test',
        baseModuleId: baseWeapon.id,
        displayName: 'Aggressive Light Laser',
        category: baseWeapon.category,
        footprint: baseWeapon.footprint,
        definition: {
          ...baseWeapon,
          id: 'lineage:test',
          displayName: 'Aggressive Light Laser',
        },
        sourceAffix: 'Aggressive',
        sourceColor: '#f97316',
        wasBoss: false,
        waveNumber: 7,
        extractedAt: 123,
      }],
    },
    chronicleRecords: [buildRunRecord({
      stats: {
        ...DEFAULT_RUN_STATS,
        totalKills: 12,
        waveReached: 8,
        damageDealt: 800,
        damageTaken: 100,
        creditsEarned: 220,
      },
      shipName: blueprint.name,
      sigil: { id: 'war_economy', tier: 2 },
      mutators: ['Glass Cannon'],
      upgrades: ['Hull Reinforcement'],
      crisisChoices: ['volatile_core'],
      nemesisKills: 1,
      riftsSurvived: 2,
    })],
    selectedTitle: 'first_blood_title',
    nemesisState: {
      ...createNemesisState(),
      active: {
        id: 'nemesis-1',
        callsign: 'Scout Ruin',
        blueprint,
        level: 2,
        killsPlayer: 1,
        defeats: 0,
        introWave: 6,
        lastSeenWave: 10,
      },
    },
  };
}

describe('career profile import/export', () => {
  it('round-trips a full career backup', () => {
    const profile = buildProfile();
    const raw = serializeCareerProfile(profile);
    const parsed = parseCareerProfile(raw);

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) throw new Error(parsed.error);

    expect(parsed.profile.selectedEncounterId).toBe('endless');
    expect(parsed.profile.progression.credits).toBe(420);
    expect(parsed.profile.hangarEntries[0]?.name).toBe('Stored Alpha');
    expect(parsed.profile.salvageCollection.entries[0]?.name).toBe('Recovered Scout');
    expect(parsed.profile.mutagenState.mutations[0]).toEqual({ id: 'tough', stacks: 2 });
    expect(parsed.profile.lineageLocker.modules[0]?.displayName).toBe('Aggressive Light Laser');
    expect(parsed.profile.chronicleRecords[0]?.nemesisKills).toBe(1);
    expect(parsed.profile.selectedTitle).toBe('first_blood_title');
    expect(parsed.profile.nemesisState.active?.callsign).toBe('Scout Ruin');
  });

  it('rejects backups with an invalid current blueprint', () => {
    const raw = JSON.stringify({
      type: 'spachip3js-career',
      version: CAREER_PROFILE_VERSION,
      exportedAt: '2026-03-25T12:00:00.000Z',
      data: {
        blueprint: { bad: true },
      },
    });

    expect(parseCareerProfile(raw)).toEqual({
      ok: false,
      error: 'That backup contains an invalid current ship blueprint.',
    });
  });

  it('falls back to a valid encounter id when the backup contains junk', () => {
    const profile = buildProfile();
    const raw = JSON.stringify({
      type: 'spachip3js-career',
      version: CAREER_PROFILE_VERSION,
      exportedAt: '2026-03-25T12:00:00.000Z',
      data: {
        ...profile,
        selectedEncounterId: 'unknown-mode',
      },
    });

    const parsed = parseCareerProfile(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) throw new Error(parsed.error);
    expect(parsed.profile.selectedEncounterId).toBe('gauntlet');
  });
});
