import { describe, expect, it } from 'vitest';
import {
  acceptContract,
  armContract,
  generateContractOffers,
  getContractProgressLabel,
  registerContractHullDamage,
  registerContractKill,
  registerPriorityTargetKill,
  resolveContractOnWaveEnd,
  tickContract,
} from '../src/game/contracts';

describe('contract offer generation', () => {
  it('offers three rotating contracts for normal waves', () => {
    const offers = generateContractOffers(7, false);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((offer) => offer.kind)).size).toBe(3);
  });

  it('offers bounty and blitz only on boss waves', () => {
    const offers = generateContractOffers(10, true);
    expect(offers.map((offer) => offer.kind)).toEqual(['priority_target', 'blink_blitz']);
  });

  it('rotates in the new cull and clean-exit contracts on normal waves', () => {
    const seenKinds = new Set<string>();
    for (let wave = 1; wave <= 5; wave++) {
      for (const offer of generateContractOffers(wave, false)) {
        seenKinds.add(offer.kind);
      }
    }
    expect(seenKinds.has('cull_order')).toBe(true);
    expect(seenKinds.has('clean_exit')).toBe(true);
  });
});

describe('priority target contracts', () => {
  it('arms the highest-value target in the wave', () => {
    const offer = generateContractOffers(5, true).find((entry) => entry.kind === 'priority_target');
    expect(offer).toBeTruthy();
    const armed = armContract(
      acceptContract(offer!),
      [
        { id: 'grunt', label: 'Grunt', maxHp: 120, affixCount: 0, isBoss: false },
        { id: 'elite', label: 'Elite', maxHp: 180, affixCount: 2, isBoss: false },
        { id: 'boss', label: 'Boss', maxHp: 80, affixCount: 0, isBoss: true },
      ],
    );

    expect(armed.status).toBe('active');
    expect(armed.targetShipId).toBe('boss');
    expect(armed.targetLabel).toBe('Boss');
    expect(getContractProgressLabel(armed)).toContain('Boss');
  });

  it('completes when the marked ship dies', () => {
    const offer = generateContractOffers(5, true).find((entry) => entry.kind === 'priority_target');
    const armed = armContract(
      acceptContract(offer!),
      [{ id: 'elite', label: 'Elite', maxHp: 180, affixCount: 2, isBoss: false }],
    );
    const completed = registerPriorityTargetKill(armed, 'elite');
    expect(completed.status).toBe('completed');
    expect(completed.successMessage).toContain('neutralized');
  });

  it('fails on wave end if the target survives', () => {
    const offer = generateContractOffers(5, true).find((entry) => entry.kind === 'priority_target');
    const armed = armContract(
      acceptContract(offer!),
      [{ id: 'elite', label: 'Elite', maxHp: 180, affixCount: 2, isBoss: false }],
    );
    const failed = resolveContractOnWaveEnd(armed, true);
    expect(failed.status).toBe('failed');
  });
});

describe('blitz contracts', () => {
  it('fails once the timer expires', () => {
    const offer = generateContractOffers(6, false).find((entry) => entry.kind === 'blink_blitz');
    const active = armContract(acceptContract(offer!), []);
    const expired = tickContract(active, (active.timeLimitSeconds ?? 0) + 0.1, 0);
    expect(expired.status).toBe('failed');
  });

  it('completes on wave clear if still inside the timer', () => {
    const offer = generateContractOffers(6, false).find((entry) => entry.kind === 'blink_blitz');
    const active = armContract(acceptContract(offer!), []);
    const ticking = tickContract(active, 3, 0);
    const completed = resolveContractOnWaveEnd(ticking, true);
    expect(completed.status).toBe('completed');
  });
});

describe('chain harvest contracts', () => {
  it('completes once the combo goal is reached', () => {
    const offer = generateContractOffers(5, false).find((entry) => entry.kind === 'chain_harvest');
    const active = armContract(acceptContract(offer!), []);
    const completed = tickContract(active, 0.5, active.comboGoal ?? 0);
    expect(completed.status).toBe('completed');
    expect(completed.successMessage).toContain('combo');
  });

  it('reports current combo progress', () => {
    const offer = generateContractOffers(5, false).find((entry) => entry.kind === 'chain_harvest');
    const active = armContract(acceptContract(offer!), []);
    const ticking = tickContract(active, 0.5, 2);
    expect(getContractProgressLabel(ticking)).toContain('2');
  });
});

describe('cull order contracts', () => {
  it('tracks kills and completes once the kill goal is reached', () => {
    const offer = generateContractOffers(6, false).find((entry) => entry.kind === 'cull_order');
    const active = armContract(acceptContract(offer!), []);
    const partial = registerContractKill(active);
    expect(getContractProgressLabel(partial)).toContain('1');
    let current = partial;
    while (current.status === 'active') {
      current = registerContractKill(current);
    }
    expect(current.status).toBe('completed');
    expect(current.successMessage).toContain('kill order');
  });
});

describe('clean exit contracts', () => {
  it('fails immediately when hull damage is taken', () => {
    const offer = generateContractOffers(7, false).find((entry) => entry.kind === 'clean_exit');
    const active = armContract(acceptContract(offer!), []);
    const failed = registerContractHullDamage(active, 12);
    expect(failed.status).toBe('failed');
    expect(getContractProgressLabel(failed)).toContain('breach');
  });

  it('completes on wave clear if hull stays pristine', () => {
    const offer = generateContractOffers(7, false).find((entry) => entry.kind === 'clean_exit');
    const active = armContract(acceptContract(offer!), []);
    const completed = resolveContractOnWaveEnd(active, true);
    expect(completed.status).toBe('completed');
    expect(completed.successMessage).toContain('no hull breaches');
  });
});
