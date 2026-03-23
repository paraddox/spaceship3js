import { describe, expect, it } from 'vitest';
import {
  acceptContract,
  armContract,
  generateContractOffers,
  getContractProgressLabel,
  registerPriorityTargetKill,
  resolveContractOnWaveEnd,
  tickContract,
} from '../src/game/contracts';

describe('contract offer generation', () => {
  it('offers two rotating contracts for normal waves', () => {
    const offers = generateContractOffers(7, false);
    expect(offers).toHaveLength(2);
    expect(new Set(offers.map((offer) => offer.kind)).size).toBe(2);
  });

  it('offers bounty and blitz only on boss waves', () => {
    const offers = generateContractOffers(10, true);
    expect(offers.map((offer) => offer.kind)).toEqual(['priority_target', 'blink_blitz']);
  });
});

describe('priority target contracts', () => {
  it('arms the highest-value target in the wave', () => {
    const offer = generateContractOffers(8, false).find((entry) => entry.kind === 'priority_target');
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
    const offer = generateContractOffers(6, false).find((entry) => entry.kind === 'priority_target');
    const armed = armContract(
      acceptContract(offer!),
      [{ id: 'elite', label: 'Elite', maxHp: 180, affixCount: 2, isBoss: false }],
    );
    const completed = registerPriorityTargetKill(armed, 'elite');
    expect(completed.status).toBe('completed');
    expect(completed.successMessage).toContain('neutralized');
  });

  it('fails on wave end if the target survives', () => {
    const offer = generateContractOffers(6, false).find((entry) => entry.kind === 'priority_target');
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
    const offer = generateContractOffers(9, false).find((entry) => entry.kind === 'blink_blitz');
    const active = armContract(acceptContract(offer!), []);
    const expired = tickContract(active, (active.timeLimitSeconds ?? 0) + 0.1, 0);
    expect(expired.status).toBe('failed');
  });

  it('completes on wave clear if still inside the timer', () => {
    const offer = generateContractOffers(9, false).find((entry) => entry.kind === 'blink_blitz');
    const active = armContract(acceptContract(offer!), []);
    const ticking = tickContract(active, 3, 0);
    const completed = resolveContractOnWaveEnd(ticking, true);
    expect(completed.status).toBe('completed');
  });
});

describe('chain harvest contracts', () => {
  it('completes once the combo goal is reached', () => {
    const offer = generateContractOffers(11, false).find((entry) => entry.kind === 'chain_harvest');
    const active = armContract(acceptContract(offer!), []);
    const completed = tickContract(active, 0.5, active.comboGoal ?? 0);
    expect(completed.status).toBe('completed');
    expect(completed.successMessage).toContain('combo');
  });

  it('reports current combo progress', () => {
    const offer = generateContractOffers(11, false).find((entry) => entry.kind === 'chain_harvest');
    const active = armContract(acceptContract(offer!), []);
    const ticking = tickContract(active, 0.5, 2);
    expect(getContractProgressLabel(ticking)).toContain('2');
  });
});
