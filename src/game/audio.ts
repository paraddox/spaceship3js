let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  return ctx;
}

export function resumeAudio(): void {
  getCtx()?.resume();
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'square'): void {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export function playShoot(): void { tone(900, 0.06, 0.05, 'square'); }
export function playLaser(): void { tone(1100, 0.08, 0.04, 'sine'); }
export function playMissile(): void { tone(300, 0.2, 0.05, 'triangle'); }
export function playBeam(): void { tone(1400, 0.1, 0.03, 'sine'); }
export function playHit(): void { tone(180, 0.12, 0.06, 'sawtooth'); }
export function playExplosion(): void {
  tone(60, 0.35, 0.1, 'sawtooth');
  tone(120, 0.25, 0.06, 'square');
}

export function playComboTier(): void {
  tone(880, 0.08, 0.06, 'sine');
  tone(1100, 0.12, 0.05, 'sine');
  tone(1320, 0.15, 0.04, 'sine');
}

export function playOverdriveActivate(): void {
  // Ascending power chord — dramatic activation feel
  tone(220, 0.4, 0.08, 'sawtooth');
  tone(330, 0.35, 0.06, 'sine');
  tone(440, 0.3, 0.07, 'sine');
  tone(660, 0.25, 0.05, 'sine');
}

export function playOverdriveDeactivate(): void {
  // Descending fade — energy dissipating
  tone(440, 0.3, 0.05, 'sine');
  tone(330, 0.35, 0.04, 'sine');
  tone(220, 0.4, 0.03, 'sawtooth');
}

// ── Boss Encounter Audio ──────────────────────────────────────

export function playBossPhaseTransition(): void {
  // Dramatic power surge — shields shifting, weapons cycling
  tone(80, 0.5, 0.1, 'sawtooth');
  tone(160, 0.4, 0.07, 'square');
  tone(320, 0.3, 0.06, 'sine');
  tone(640, 0.25, 0.05, 'sine');
}

export function playBossTelegraph(): void {
  // Rising tension — warning incoming
  tone(200, 0.15, 0.05, 'triangle');
  tone(300, 0.2, 0.04, 'triangle');
}

export function playBossAttack(): void {
  // Heavy impact — attack unleashed
  tone(100, 0.3, 0.08, 'sawtooth');
  tone(150, 0.2, 0.06, 'square');
}

export function playBossDefeated(): void {
  // Triumphant destruction — boss explodes
  tone(60, 0.6, 0.12, 'sawtooth');
  tone(120, 0.5, 0.1, 'square');
  tone(240, 0.4, 0.07, 'sine');
  tone(480, 0.35, 0.06, 'sine');
  tone(720, 0.3, 0.05, 'sine');
}

// ── Arena Rift Audio ──────────────────────────────────────────

export function playRiftActivate(): void { tone(220, 0.3, 0.06, 'sine'); tone(330, 0.25, 0.05, 'sine'); }
export function playRiftDeactivate(): void { tone(330, 0.2, 0.04, 'sine'); tone(165, 0.3, 0.05, 'sine'); }
export function playRiftEmpPulse(): void { tone(80, 0.4, 0.08, 'sawtooth'); tone(120, 0.3, 0.06, 'square'); }
export function playRiftShockwaveBurst(): void { tone(60, 0.5, 0.07, 'sine'); tone(100, 0.35, 0.05, 'triangle'); }
