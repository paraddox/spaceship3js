import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  persistRunRecords,
  saveRunRecord,
  loadAllRecords,
  loadRecentRuns,
  deleteRunRecord,
  clearChronicle,
  computeLifetimeStats,
  getEarnedTitles,
  getTitleDef,
  getSelectedTitle,
  setSelectedTitle,
  buildRunRecord,
  getChronicleSummary,
  PILOT_TITLES,
  type RunRecord,
  type LifetimeStats,
} from '../src/game/run-chronicle';
import { type RunStats, DEFAULT_RUN_STATS } from '../src/game/run-report';

// ── localStorage mock ────────────────────────────────────────

const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; },
    get length() { return Object.keys(store).length; },
    key(_: number) { return null; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
// Some source files reference window.localStorage in browser contexts
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
} else {
  // Polyfill window for test environments
  (globalThis as Record<string, unknown>).window = { localStorage: localStorageMock };
}

// ── Test helpers ──────────────────────────────────────────────

const STORAGE_KEY = 'spachip3js.chronicle';
const TITLE_KEY = 'spachip3js.pilotTitle';

function mockRun(overrides: Partial<RunStats> = {}): RunStats {
  return { ...DEFAULT_RUN_STATS, ...overrides };
}

function makeRecord(stats: Partial<RunStats> = {}, extra: Partial<RunRecord> = {}): RunRecord {
  const s = mockRun(stats);
  return buildRunRecord({
    stats: s,
    shipName: 'Test Ship',
    sigil: null,
    mutators: [],
    upgrades: [],
    crisisChoices: [],
    nemesisKills: 0,
    riftsSurvived: 0,
    ...extra,
  });
}

beforeEach(() => {
  localStorageMock.clear();
});

// ── Persistence ───────────────────────────────────────────────

describe('saveRunRecord / loadAllRecords', () => {
  it('saves and loads a single run', () => {
    const record = makeRecord({ totalKills: 5, waveReached: 3 });
    saveRunRecord(record);
    const loaded = loadAllRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(record.id);
    expect(loaded[0].stats.totalKills).toBe(5);
    expect(loaded[0].grade.letter).toBeDefined();
  });

  it('orders newest first', () => {
    const r1 = makeRecord({ waveReached: 1 });
    const r2 = makeRecord({ waveReached: 2 });
    saveRunRecord(r1);
    saveRunRecord(r2);
    const loaded = loadAllRecords();
    expect(loaded[0].stats.waveReached).toBe(2);
    expect(loaded[1].stats.waveReached).toBe(1);
  });

  it('caps at 100 stored runs', () => {
    for (let i = 0; i < 105; i++) {
      saveRunRecord(makeRecord({ waveReached: i }));
    }
    const loaded = loadAllRecords();
    expect(loaded).toHaveLength(100);
    // Newest first — highest wave numbers at the front
    expect(loaded[0].stats.waveReached).toBe(104);
  });

  it('persists an imported chronicle list with the same 100-run cap', () => {
    const imported = Array.from({ length: 105 }, (_, index) => makeRecord({ waveReached: index }));
    persistRunRecords(imported);
    const loaded = loadAllRecords();
    expect(loaded).toHaveLength(100);
    expect(loaded[0].stats.waveReached).toBe(0);
    expect(loaded[loaded.length - 1]?.stats.waveReached).toBe(99);
  });
});

describe('buildRunRecord', () => {
  it('preserves chronicle-only metadata fields', () => {
    const record = buildRunRecord({
      stats: mockRun({ totalKills: 12 }),
      shipName: 'Void Spear',
      sigil: { id: 'war_economy', tier: 3 },
      mutators: ['Glass Cannon'],
      upgrades: ['Hull Reinforcement'],
      crisisChoices: ['containment_override', 'volatile_core'],
      nemesisKills: 2,
      riftsSurvived: 3,
    });

    expect(record.shipName).toBe('Void Spear');
    expect(record.crisisChoices).toEqual(['containment_override', 'volatile_core']);
    expect(record.nemesisKills).toBe(2);
    expect(record.riftsSurvived).toBe(3);
    expect(record.sigil).toEqual({ id: 'war_economy', tier: 3 });
  });
});

describe('loadRecentRuns', () => {
  it('returns up to N most recent runs', () => {
    for (let i = 0; i < 10; i++) {
      saveRunRecord(makeRecord({ waveReached: i }));
    }
    expect(loadRecentRuns(3)).toHaveLength(3);
    expect(loadRecentRuns(3)[0].stats.waveReached).toBe(9);
  });

  it('returns all if fewer than limit', () => {
    saveRunRecord(makeRecord());
    expect(loadRecentRuns(10)).toHaveLength(1);
  });
});

describe('deleteRunRecord', () => {
  it('removes a specific run by id', () => {
    const r1 = makeRecord({ waveReached: 1 });
    const r2 = makeRecord({ waveReached: 2 });
    saveRunRecord(r1);
    saveRunRecord(r2);
    deleteRunRecord(r1.id);
    const loaded = loadAllRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(r2.id);
  });
});

describe('clearChronicle', () => {
  it('removes all records', () => {
    saveRunRecord(makeRecord());
    saveRunRecord(makeRecord());
    clearChronicle();
    expect(loadAllRecords()).toHaveLength(0);
  });
});

// ── Lifetime Stats ────────────────────────────────────────────

describe('computeLifetimeStats', () => {
  it('computes correct aggregates', () => {
    const records = [
      makeRecord({ totalKills: 10, damageDealt: 500, damageTaken: 100, timeSeconds: 120, waveReached: 3 }),
      makeRecord({ totalKills: 20, damageDealt: 800, damageTaken: 200, timeSeconds: 180, waveReached: 5 }),
    ];
    const lt = computeLifetimeStats(records);
    expect(lt.totalRuns).toBe(2);
    expect(lt.totalKills).toBe(30);
    expect(lt.totalDamageDealt).toBe(1300);
    expect(lt.totalDamageTaken).toBe(300);
    expect(lt.totalTimeSeconds).toBe(300);
    expect(lt.bestWave).toBe(5);
  });

  it('tracks best grade correctly', () => {
    const records = [
      makeRecord({ waveReached: 1, totalKills: 1 }),
      makeRecord({ waveReached: 5, totalKills: 10 }),
    ];
    const lt = computeLifetimeStats(records);
    // bestGrade should be the highest of the two runs' grades
    expect(lt.bestGrade).toBeDefined();
    expect(lt.bestGrade.length).toBe(1);
  });

  it('returns empty stats for no records', () => {
    const lt = computeLifetimeStats([]);
    expect(lt.totalRuns).toBe(0);
    expect(lt.totalKills).toBe(0);
    expect(lt.bestGrade).toBe('');
  });
});

// ── Pilot Titles ──────────────────────────────────────────────

describe('getEarnedTitles', () => {
  it('awards Blooded for 1+ runs', () => {
    const records = [makeRecord()];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('first_blood_title');
  });

  it('awards Centurion for 100+ lifetime kills', () => {
    const records = [makeRecord({ totalKills: 100 })];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('centurion_title');
  });

  it('awards Godslayer for 3+ boss kills in a single run', () => {
    const records = [makeRecord({ bossKills: 3, totalKills: 20 })];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('godslayer_title');
  });

  it('awards Bullet Dancer for 50+ near-misses', () => {
    const records = [makeRecord({ nearMissTotal: 55, totalKills: 5 })];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('bullet_dancer_title');
  });

  it('awards Legendary for an S grade', () => {
    // S grade requires high stats across dimensions
    const records = [makeRecord({
      waveReached: 30,
      totalKills: 100,
      bestCombo: 20,
      damageDealt: 50000,
      damageTaken: 100,
      timeSeconds: 600,
      nearMissTotal: 60,
    })];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('legendary_title');
  });

  it('awards Survivor for 10+ runs', () => {
    const records = Array.from({ length: 10 }, () => makeRecord({ totalKills: 1 }));
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).toContain('survivor_title');
  });

  it('does not award titles for unmet conditions', () => {
    const records = [makeRecord({ totalKills: 1, waveReached: 1 })];
    const lt = computeLifetimeStats(records);
    const earned = getEarnedTitles(records, lt);
    expect(earned.map((t) => t.id)).not.toContain('godslayer_title');
    expect(earned.map((t) => t.id)).not.toContain('legendary_title');
  });
});

describe('getTitleDef', () => {
  it('returns the title definition by id', () => {
    const title = getTitleDef('centurion_title');
    expect(title).toBeDefined();
    expect(title!.displayName).toBe('Centurion');
  });

  it('returns undefined for unknown id', () => {
    expect(getTitleDef('nonexistent')).toBeUndefined();
  });
});

// ── Title Selection ───────────────────────────────────────────

describe('getSelectedTitle / setSelectedTitle', () => {
  it('persists and retrieves selected title', () => {
    setSelectedTitle('centurion_title');
    expect(getSelectedTitle()).toBe('centurion_title');
  });

  it('clears title with null', () => {
    setSelectedTitle('centurion_title');
    setSelectedTitle(null);
    expect(getSelectedTitle()).toBeNull();
  });
});

// ── Build Run Record ─────────────────────────────────────────

describe('buildRunRecord', () => {
  it('creates a valid record with correct grade', () => {
    const record = buildRunRecord({
      stats: mockRun({ waveReached: 15, totalKills: 50, damageDealt: 3000, damageTaken: 500 }),
      shipName: 'Destroyer',
      sigil: { id: 'blood_oath', tier: 2 },
      mutators: ['Glass Cannon'],
      upgrades: ['Hull Reinforcement'],
      crisisChoices: ['meltdown_yes'],
      nemesisKills: 1,
      riftsSurvived: 3,
    });
    expect(record.id).toMatch(/^run-/);
    expect(record.shipName).toBe('Destroyer');
    expect(record.sigil).toEqual({ id: 'blood_oath', tier: 2 });
    expect(record.mutators).toEqual(['Glass Cannon']);
    expect(record.nemesisKills).toBe(1);
    expect(record.grade.letter).toBeDefined();
    expect(record.causeOfDeath).toBeDefined();
  });
});

// ── Chronicle Summary ────────────────────────────────────────

describe('getChronicleSummary', () => {
  it('returns correct summary for empty history', () => {
    const summary = getChronicleSummary([]);
    expect(summary.totalRuns).toBe(0);
    expect(summary.recentGrade).toBeNull();
    expect(summary.bestGrade).toBe('');
  });

  it('returns correct summary with runs', () => {
    const records = [
      makeRecord({ waveReached: 5, totalKills: 15 }),
      makeRecord({ waveReached: 10, totalKills: 30 }),
    ];
    const summary = getChronicleSummary(records);
    expect(summary.totalRuns).toBe(2);
    expect(summary.bestWave).toBe(10);
    expect(summary.recentGrade).toBeDefined();
    expect(summary.earnedTitles).toBeGreaterThanOrEqual(1); // at least Blooded
    expect(summary.totalTitles).toBe(PILOT_TITLES.length);
  });
});

// ── Catalog Completeness ─────────────────────────────────────

describe('PILOT_TITLES catalog', () => {
  it('has no duplicate ids', () => {
    const ids = PILOT_TITLES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate display names', () => {
    const names = PILOT_TITLES.map((t) => t.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every title has an icon', () => {
    for (const t of PILOT_TITLES) {
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  it('every title has a non-empty description', () => {
    for (const t of PILOT_TITLES) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});
