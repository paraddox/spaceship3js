import type { MutagenId } from './mutagen';

export type ContractKind = 'priority_target' | 'blink_blitz' | 'chain_harvest' | 'cull_order' | 'clean_exit';
export type ContractStatus = 'accepted' | 'active' | 'completed' | 'failed';

export interface ContractReward {
  credits: number;
  score: number;
  overdriveCharge?: number;
  essenceId?: MutagenId;
}

export interface ContractOffer {
  kind: ContractKind;
  waveNumber: number;
  displayName: string;
  description: string;
  flavor: string;
  icon: string;
  color: string;
  reward: ContractReward;
  timeLimitSeconds?: number;
  comboGoal?: number;
  killGoal?: number;
}

export interface ActiveContract extends ContractOffer {
  status: ContractStatus;
  elapsedSeconds: number;
  comboPeak: number;
  killsRegistered: number;
  hullDamageTaken: number;
  targetShipId?: string;
  targetLabel?: string;
  successMessage?: string;
  failureMessage?: string;
}

export interface ContractTargetCandidate {
  id: string;
  label: string;
  maxHp: number;
  affixCount: number;
  isBoss: boolean;
}

const CONTRACT_ROTATION: ContractKind[] = ['priority_target', 'blink_blitz', 'chain_harvest', 'cull_order', 'clean_exit'];
const ESSENCE_ROTATION: MutagenId[] = [
  'aggressive',
  'tough',
  'gunner',
  'shielded',
  'swift',
  'overcharged',
  'veteran',
  'regenerating',
  'juggernaut',
  'explosive',
];

export function generateContractOffers(waveNumber: number, bossWave = false): ContractOffer[] {
  const kinds = pickOfferKinds(waveNumber, bossWave);
  return kinds.map((kind) => buildOffer(kind, waveNumber, bossWave));
}

export function acceptContract(offer: ContractOffer): ActiveContract {
  return {
    ...offer,
    status: 'accepted',
    elapsedSeconds: 0,
    comboPeak: 0,
    killsRegistered: 0,
    hullDamageTaken: 0,
  };
}

export function armContract(contract: ActiveContract, targets: ContractTargetCandidate[]): ActiveContract {
  if (contract.status !== 'accepted') return contract;
  if (contract.kind !== 'priority_target') {
    return { ...contract, status: 'active' };
  }

  const target = pickPriorityTarget(targets);
  if (!target) {
    return {
      ...contract,
      status: 'failed',
      failureMessage: 'Contract void — no valid target entered the arena.',
    };
  }

  return {
    ...contract,
    status: 'active',
    targetShipId: target.id,
    targetLabel: target.label,
  };
}

export function tickContract(contract: ActiveContract, dt: number, comboKills: number): ActiveContract {
  if (contract.status !== 'active') return contract;

  const elapsedSeconds = contract.elapsedSeconds + dt;
  const comboPeak = Math.max(contract.comboPeak, comboKills);
  const next: ActiveContract = {
    ...contract,
    elapsedSeconds,
    comboPeak,
  };

  if (next.kind === 'blink_blitz' && next.timeLimitSeconds && elapsedSeconds > next.timeLimitSeconds) {
    return {
      ...next,
      status: 'failed',
      failureMessage: 'Contract failed — blitz window expired.',
    };
  }

  if (next.kind === 'chain_harvest' && next.comboGoal && comboPeak >= next.comboGoal) {
    return {
      ...next,
      status: 'completed',
      successMessage: `Contract complete — combo chain hit ${next.comboGoal}.`,
    };
  }

  return next;
}

export function registerPriorityTargetKill(contract: ActiveContract, shipId: string): ActiveContract {
  if (contract.status !== 'active' || contract.kind !== 'priority_target') return contract;
  if (contract.targetShipId !== shipId) return contract;
  return {
    ...contract,
    status: 'completed',
    successMessage: `Contract complete — ${contract.targetLabel ?? 'priority target'} neutralized.`,
  };
}

export function registerContractKill(contract: ActiveContract): ActiveContract {
  if (contract.status !== 'active' || contract.kind !== 'cull_order') return contract;
  const killsRegistered = contract.killsRegistered + 1;
  if (contract.killGoal && killsRegistered >= contract.killGoal) {
    return {
      ...contract,
      killsRegistered,
      status: 'completed',
      successMessage: `Contract complete — kill order reached ${contract.killGoal} confirmed targets.`,
    };
  }
  return {
    ...contract,
    killsRegistered,
  };
}

export function registerContractHullDamage(contract: ActiveContract, hullDamage: number): ActiveContract {
  if (contract.status !== 'active' || contract.kind !== 'clean_exit' || hullDamage <= 0) return contract;
  return {
    ...contract,
    hullDamageTaken: contract.hullDamageTaken + hullDamage,
    status: 'failed',
    failureMessage: 'Contract failed — hull breach detected.',
  };
}

export function resolveContractOnWaveEnd(contract: ActiveContract, waveCleared: boolean): ActiveContract {
  if (contract.status === 'completed' || contract.status === 'failed') return contract;

  if (!waveCleared) {
    return {
      ...contract,
      status: 'failed',
      failureMessage: 'Contract failed — you lost the wave before cashing out.',
    };
  }

  if (contract.kind === 'blink_blitz') {
    return contract.timeLimitSeconds && contract.elapsedSeconds <= contract.timeLimitSeconds
      ? {
          ...contract,
          status: 'completed',
          successMessage: 'Contract complete — wave cleared inside the blitz window.',
        }
      : {
          ...contract,
          status: 'failed',
          failureMessage: 'Contract failed — wave clear came too late.',
        };
  }

  if (contract.kind === 'chain_harvest') {
    return contract.comboGoal && contract.comboPeak >= contract.comboGoal
      ? {
          ...contract,
          status: 'completed',
          successMessage: `Contract complete — combo chain hit ${contract.comboGoal}.`,
        }
      : {
          ...contract,
          status: 'failed',
          failureMessage: 'Contract failed — combo threshold not reached.',
        };
  }

  if (contract.kind === 'cull_order') {
    return contract.killGoal && contract.killsRegistered >= contract.killGoal
      ? {
          ...contract,
          status: 'completed',
          successMessage: `Contract complete — kill order reached ${contract.killGoal} confirmed targets.`,
        }
      : {
          ...contract,
          status: 'failed',
          failureMessage: 'Contract failed — not enough confirmed kills.',
        };
  }

  if (contract.kind === 'clean_exit') {
    return contract.hullDamageTaken <= 0
      ? {
          ...contract,
          status: 'completed',
          successMessage: 'Contract complete — no hull breaches recorded.',
        }
      : {
          ...contract,
          status: 'failed',
          failureMessage: 'Contract failed — hull breach detected.',
        };
  }

  return {
    ...contract,
    status: 'failed',
    failureMessage: 'Contract failed — marked target escaped destruction.',
  };
}

export function isTerminalContract(contract: ActiveContract | null): boolean {
  return contract?.status === 'completed' || contract?.status === 'failed';
}

export function getContractProgressLabel(contract: ActiveContract): string {
  if (contract.kind === 'priority_target') {
    return contract.targetLabel ? `Target: ${contract.targetLabel}` : 'Target uplink pending';
  }

  if (contract.kind === 'blink_blitz') {
    const remaining = Math.max(0, (contract.timeLimitSeconds ?? 0) - contract.elapsedSeconds);
    return `${remaining.toFixed(1)}s remaining`;
  }

  if (contract.kind === 'chain_harvest') {
    const goal = contract.comboGoal ?? 0;
    return `${Math.min(contract.comboPeak, goal)} / ${goal} combo`;
  }

  if (contract.kind === 'cull_order') {
    const goal = contract.killGoal ?? 0;
    return `${Math.min(contract.killsRegistered, goal)} / ${goal} kills`;
  }

  return contract.hullDamageTaken > 0 ? 'Hull breach logged' : 'Hull still pristine';
}

function pickOfferKinds(waveNumber: number, bossWave: boolean): ContractKind[] {
  if (bossWave) return ['priority_target', 'blink_blitz'];
  const start = waveNumber % CONTRACT_ROTATION.length;
  return [
    CONTRACT_ROTATION[start],
    CONTRACT_ROTATION[(start + 1) % CONTRACT_ROTATION.length],
    CONTRACT_ROTATION[(start + 2) % CONTRACT_ROTATION.length],
  ];
}

function buildOffer(kind: ContractKind, waveNumber: number, bossWave: boolean): ContractOffer {
  switch (kind) {
    case 'priority_target':
      return {
        kind,
        waveNumber,
        displayName: bossWave ? 'Flagship Bounty' : 'Priority Bounty',
        description: bossWave
          ? 'The next boss wave designates a flagship. Destroy it to cash out immediately.'
          : 'The next wave marks a high-value target. Eliminate it before the wave ends.',
        flavor: bossWave
          ? 'Someone out there wants that flagship gone badly enough to pay in advance.'
          : 'A clean kill, a fast transfer, and no questions asked.',
        icon: '🎯',
        color: '#f59e0b',
        reward: {
          credits: Math.round(26 + waveNumber * 9 + (bossWave ? 24 : 0)),
          score: Math.round(140 + waveNumber * 36 + (bossWave ? 180 : 0)),
        },
      };
    case 'blink_blitz':
      return {
        kind,
        waveNumber,
        displayName: 'Blink Blitz',
        description: `Clear the next wave within ${getBlitzTimeLimit(waveNumber, bossWave)} seconds.`,
        flavor: 'Move like the contract is closing around you, because it is.',
        icon: '⏱️',
        color: '#22c55e',
        reward: {
          credits: Math.round(22 + waveNumber * 8 + (bossWave ? 18 : 0)),
          score: Math.round(120 + waveNumber * 32 + (bossWave ? 120 : 0)),
          overdriveCharge: bossWave ? 0.35 : 0.22,
        },
        timeLimitSeconds: getBlitzTimeLimit(waveNumber, bossWave),
      };
    case 'chain_harvest':
      return {
        kind,
        waveNumber,
        displayName: 'Chain Harvest',
        description: `Reach a ${getComboGoal(waveNumber)} kill combo during the next wave.`,
        flavor: 'The underwriters only pay if you make the whole kill-chain sing.',
        icon: '⚡',
        color: '#a855f7',
        reward: {
          credits: Math.round(18 + waveNumber * 7),
          score: Math.round(110 + waveNumber * 28),
          essenceId: ESSENCE_ROTATION[(waveNumber + 2) % ESSENCE_ROTATION.length],
        },
        comboGoal: getComboGoal(waveNumber),
      };
    case 'cull_order':
      return {
        kind,
        waveNumber,
        displayName: 'Cull Order',
        description: `Confirm ${getCullGoal(waveNumber)} kills during the next wave.`,
        flavor: 'The brief is simple: make the wave thinner before it reaches you.',
        icon: '☠️',
        color: '#ef4444',
        reward: {
          credits: Math.round(20 + waveNumber * 7),
          score: Math.round(120 + waveNumber * 30),
          overdriveCharge: 0.18,
        },
        killGoal: getCullGoal(waveNumber),
      };
    case 'clean_exit':
      return {
        kind,
        waveNumber,
        displayName: 'Clean Exit',
        description: 'Clear the next wave without taking hull damage.',
        flavor: 'The payout is for pilots who can make the battlefield miss entirely.',
        icon: '🛡️',
        color: '#14b8a6',
        reward: {
          credits: Math.round(24 + waveNumber * 8 + (bossWave ? 12 : 0)),
          score: Math.round(135 + waveNumber * 32 + (bossWave ? 80 : 0)),
          overdriveCharge: bossWave ? 0.28 : 0.2,
        },
      };
  }
}

function pickPriorityTarget(targets: ContractTargetCandidate[]): ContractTargetCandidate | null {
  if (targets.length === 0) return null;
  let best = targets[0];
  let bestScore = scoreTarget(best);
  for (const target of targets.slice(1)) {
    const score = scoreTarget(target);
    if (score > bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}

function scoreTarget(target: ContractTargetCandidate): number {
  return target.maxHp + target.affixCount * 180 + (target.isBoss ? 800 : 0);
}

function getBlitzTimeLimit(waveNumber: number, bossWave: boolean): number {
  if (bossWave) return Math.max(24, 38 - Math.floor(waveNumber / 2));
  return Math.max(12, 24 - Math.floor(waveNumber / 4));
}

function getComboGoal(waveNumber: number): number {
  return Math.min(6, Math.max(2, 2 + Math.floor(waveNumber / 5)));
}

function getCullGoal(waveNumber: number): number {
  return Math.min(8, Math.max(2, 2 + Math.floor(waveNumber / 4)));
}
