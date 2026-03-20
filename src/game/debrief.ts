export interface EncounterDebriefInput {
  encounterName: string;
  objectiveLabel: string;
  outcome: 'victory' | 'defeat';
  creditsEarned: number;
  bestScore: number;
  elapsedSeconds: number;
}

export interface EncounterDebrief {
  title: string;
  lines: string[];
}

export function buildEncounterDebrief(input: EncounterDebriefInput): EncounterDebrief {
  const title = input.outcome === 'victory' ? `${input.encounterName} — Victory` : `${input.encounterName} — Defeat`;
  const lines = [
    `Objective: ${input.objectiveLabel}`,
    `Time: ${formatDuration(input.elapsedSeconds)}`,
    `Best score: ${input.bestScore}`,
  ];

  if (input.outcome === 'victory' && input.creditsEarned > 0) {
    lines.splice(2, 0, `Credits earned: ${input.creditsEarned}`);
  }

  return { title, lines };
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
