// ── Battle Music Director ─────────────────────────────────────────
//
// Real-time procedural music that adapts to gameplay intensity.
// Uses Web Audio API oscillators and noise — no external audio files.
//
// Architecture:
//   MusicDirector — manages layers, intensity, timing
//   Layer — one musical element (kick, snare, bass, lead, pad)
//   Pattern — rhythmic sequence of notes/hits per layer
//
// Intensity 0–5 is derived from game state each frame:
//   0 = silence (menu, between waves)
//   1 = ambient (exploring, no enemies)
//   2 = light combat (few enemies, low combo)
//   3 = heavy combat (many enemies, mid combo)
//   4 = critical (high combo, overdrive, taking damage)
//   5 = boss fight (boss active, any phase)
//
// Layers fade in/out smoothly based on intensity thresholds.
// Tempo accelerates with intensity. Key shifts on phase transitions.
// No Three.js imports — pure logic + Web Audio.

// ── Types ─────────────────────────────────────────────────────

/** Intensity level 0–5. */
export type MusicIntensity = 0 | 1 | 2 | 3 | 4 | 5;

export interface MusicInput {
  /** Whether the player is currently in a game (vs menu). */
  inGame: boolean;
  /** Whether a wave is currently active. */
  waveActive: boolean;
  /** Number of living enemies. */
  enemyCount: number;
  /** Current kill combo tier (0 = no combo). */
  comboTier: number;
  /** Whether overdrive is active. */
  overdriveActive: boolean;
  /** Whether a boss is currently alive. */
  bossAlive: boolean;
  /** Boss phase index (0, 1, 2) or -1 if no boss. */
  bossPhaseIndex: number;
  /** Whether the player is taking damage recently. */
  playerTakingDamage: boolean;
  /** Player HP fraction (0–1). */
  playerHpFraction: number;
  /** Seconds elapsed in current wave. */
  waveTime: number;
}

export interface MusicDirectorState {
  /** Current intensity level (smoothed). */
  intensity: MusicIntensity;
  /** Raw intensity before smoothing. */
  rawIntensity: MusicIntensity;
  /** Current BPM. */
  bpm: number;
  /** Target BPM (for smooth transitions). */
  targetBpm: number;
  /** Volume 0–1 for master output. */
  masterVolume: number;
  /** Target master volume (for fade in/out). */
  targetMasterVolume: number;
  /** Whether the director is running. */
  running: boolean;
  /** Beat counter (increments per beat). */
  beatCount: number;
  /** Seconds since last beat. */
  beatTimer: number;
  /** Current musical key (MIDI note). */
  keyNote: number;
  /** Target key note (for smooth key shifts). */
  targetKeyNote: number;
  /** Pattern variation seed (changes every few bars). */
  patternSeed: number;
  /** Bars played since last variation change. */
  barsSinceVariation: number;
  /** Current bar within the 4-bar phrase. */
  currentBar: number;
  /** Beat within current bar. */
  currentBeat: number;
  /** Whether in a dramatic moment (boss phase transition, etc.). */
  dramaticMoment: boolean;
  /** Dramatic moment timer (seconds remaining). */
  dramaticTimer: number;
}

// ── Musical Constants ────────────────────────────────────────

/** BPM range by intensity. */
const BPM_BY_INTENSITY: Record<MusicIntensity, number> = {
  0: 70,
  1: 85,
  2: 110,
  3: 128,
  4: 140,
  5: 150,
};

/** Master volume by intensity. */
const VOLUME_BY_INTENSITY: Record<MusicIntensity, number> = {
  0: 0,
  1: 0.15,
  2: 0.25,
  3: 0.35,
  4: 0.42,
  5: 0.5,
};

/** Minor key scales (MIDI offsets from root). */
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** Musical keys for each intensity band. */
const KEY_BY_INTENSITY: Record<MusicIntensity, number> = {
  0: 36, // C2 — deep ambient
  1: 33, // A1 — moody
  2: 38, // D2 — tense
  3: 36, // C2 — driving
  4: 41, // F2 — urgent
  5: 43, // G2 — epic
};

// ── Layer Definitions ───────────────────────────────────────

interface LayerDef {
  name: string;
  /** Minimum intensity to be audible. */
  minIntensity: MusicIntensity;
  /** Volume at full intensity (0–1). */
  maxVolume: number;
  /** How quickly this layer fades in (seconds). */
  fadeIn: number;
  /** How quickly this layer fades out (seconds). */
  fadeOut: number;
  /** Current gain (0–1). */
  currentGain: number;
}

const LAYERS: LayerDef[] = [
  { name: 'pad', minIntensity: 1, maxVolume: 0.12, fadeIn: 2.0, fadeOut: 1.5, currentGain: 0 },
  { name: 'bass', minIntensity: 2, maxVolume: 0.18, fadeIn: 1.0, fadeOut: 0.8, currentGain: 0 },
  { name: 'kick', minIntensity: 2, maxVolume: 0.25, fadeIn: 0.5, fadeOut: 0.3, currentGain: 0 },
  { name: 'snare', minIntensity: 3, maxVolume: 0.15, fadeIn: 0.5, fadeOut: 0.3, currentGain: 0 },
  { name: 'lead', minIntensity: 3, maxVolume: 0.10, fadeIn: 1.0, fadeOut: 0.5, currentGain: 0 },
  { name: 'arp', minIntensity: 4, maxVolume: 0.08, fadeIn: 0.8, fadeOut: 0.4, currentGain: 0 },
];

// ── State Creation ───────────────────────────────────────────

export function createMusicDirector(): MusicDirectorState {
  return {
    intensity: 0,
    rawIntensity: 0,
    bpm: 70,
    targetBpm: 70,
    masterVolume: 0,
    targetMasterVolume: 0,
    running: false,
    beatCount: 0,
    beatTimer: 0,
    keyNote: 36,
    targetKeyNote: 36,
    patternSeed: 1,
    barsSinceVariation: 0,
    currentBar: 0,
    currentBeat: 0,
    dramaticMoment: false,
    dramaticTimer: 0,
  };
}

// ── Intensity Computation ────────────────────────────────────

/**
 * Compute raw intensity from game state.
 * This is the "brain" of the music director — maps game events to
 * musical energy levels.
 */
export function computeIntensity(input: MusicInput): MusicIntensity {
  if (!input.inGame) return 0;
  if (!input.waveActive) return 1;

  // Boss fight always drives high intensity
  if (input.bossAlive) {
    if (input.bossPhaseIndex >= 2) return 5; // Desperation = max
    return 5; // Any boss phase = max intensity
  }

  // Overdrive is always intense
  if (input.overdriveActive) return 4;

  // Combo-based intensity
  if (input.comboTier >= 4) return 4; // Massacre+
  if (input.comboTier >= 2) return 3; // Killing Spree+

  // Enemy count + damage pressure
  if (input.enemyCount >= 8) return 3;
  if (input.enemyCount >= 4) return 2;

  // Low HP while enemies exist = tension
  if (input.playerHpFraction < 0.3 && input.enemyCount > 0) return 3;

  return 2;
}

// ── Note Generation ──────────────────────────────────────────

/**
 * Get a note from the minor scale in the current key.
 */
function getScaleNote(octave: number, degree: number, key: number): number {
  const octaveOffset = octave * 12;
  const scaleIndex = ((degree % MINOR_SCALE.length) + MINOR_SCALE.length) % MINOR_SCALE.length;
  return key + octaveOffset + MINOR_SCALE[scaleIndex];
}

/**
 * Pseudo-random with seed.
 */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Audio Rendering ──────────────────────────────────────────
// These functions are called by FlightScene when beats trigger.
// They use the shared AudioContext from audio.ts.

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;

/**
 * Initialize the music audio context. Call once on user interaction.
 */
export function initMusicAudio(): boolean {
  if (audioCtx) return true;
  try {
    audioCtx = new AudioContext();
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.value = 0;
    masterGainNode.connect(audioCtx.destination);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resume the audio context (required after user gesture).
 */
export function resumeMusicAudio(): void {
  audioCtx?.resume();
}

/**
 * Stop all music and clean up audio resources.
 */
export function destroyMusicAudio(): void {
  if (masterGainNode) {
    try {
      masterGainNode.gain.setValueAtTime(0, audioCtx!.currentTime);
      masterGainNode.disconnect();
    } catch { /* already disconnected */ }
    masterGainNode = null;
  }
  audioCtx = null;
}

function getAudioCtx(): AudioContext | null {
  return audioCtx;
}

// ── Sound Synthesis Functions ────────────────────────────────

function playKick(volume: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.15);
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.connect(gain).connect(masterGainNode);
  osc.start();
  osc.stop(c.currentTime + 0.25);
}

function playSnare(volume: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  // Noise component
  const bufferSize = c.sampleRate * 0.1;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.7, c.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;
  noise.connect(filter).connect(noiseGain).connect(masterGainNode);
  noise.start();
  noise.stop(c.currentTime + 0.15);
  // Tone component
  const osc = c.createOscillator();
  const oscGain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 200;
  oscGain.gain.setValueAtTime(volume * 0.5, c.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  osc.connect(oscGain).connect(masterGainNode);
  osc.start();
  osc.stop(c.currentTime + 0.1);
}

function playBass(note: number, volume: number, duration: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.value = note;
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 2;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.setValueAtTime(volume, c.currentTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(filter).connect(gain).connect(masterGainNode);
  osc.start();
  osc.stop(c.currentTime + duration + 0.05);
}

function playPad(notes: number[], volume: number, duration: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  for (const note of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = note;
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.3);
    gain.gain.setValueAtTime(volume, c.currentTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(filter).connect(gain).connect(masterGainNode);
    osc.start();
    osc.stop(c.currentTime + duration + 0.1);
  }
}

function playLead(note: number, volume: number, duration: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.value = note;
  osc2.type = 'sawtooth';
  osc2.frequency.value = note * 1.005; // slight detune for width
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  filter.Q.value = 3;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.setValueAtTime(volume * 0.8, c.currentTime + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(masterGainNode);
  osc.start();
  osc2.start();
  osc.stop(c.currentTime + duration + 0.05);
  osc2.stop(c.currentTime + duration + 0.05);
}

function playArp(note: number, volume: number, duration: number): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = note;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(masterGainNode);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

function playHiHat(volume: number, open = false): void {
  const c = getAudioCtx();
  if (!c || !masterGainNode) return;
  const bufferSize = c.sampleRate * (open ? 0.08 : 0.03);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 5000;
  gain.gain.setValueAtTime(volume * 0.4, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (open ? 0.08 : 0.03));
  noise.connect(filter).connect(gain).connect(masterGainNode);
  noise.start();
  noise.stop(c.currentTime + 0.1);
}

// ── Beat Sequencing ──────────────────────────────────────────

/**
 * Trigger all sounds for the current beat.
 * Called by FlightScene when beatTimer expires.
 */
export function triggerBeat(state: MusicDirectorState): void {
  if (!state.running || state.intensity === 0) return;

  const beat = state.currentBeat;
  const bar = state.currentBar;
  const seed = state.patternSeed;
  const key = Math.round(state.keyNote);
  const beatDuration = 60 / state.bpm;
  const intensity = state.intensity;

  // ── Kick pattern ──
  const kickLayer = LAYERS[2]; // kick
  if (intensity >= kickLayer.minIntensity && kickLayer.currentGain > 0.01) {
    // Four-on-the-floor at high intensity, sparser at lower
    if (intensity >= 4 || beat === 0 || beat === 2 ||
        (intensity >= 3 && (beat === 1 || beat === 3 && seeded(seed + beat + bar) > 0.5))) {
      playKick(kickLayer.currentGain * (beat === 0 ? 1.2 : 1.0));
    }
    // Boss variation: double-time kicks
    if (intensity >= 5 && seeded(seed + state.beatCount * 7) > 0.4) {
      playKick(kickLayer.currentGain * 0.6);
    }
  }

  // ── Snare pattern ──
  const snareLayer = LAYERS[3]; // snare
  if (intensity >= snareLayer.minIntensity && snareLayer.currentGain > 0.01) {
    if (beat === 1 || beat === 3) {
      playSnare(snareLayer.currentGain * (beat === 3 && bar === 3 ? 1.3 : 1.0));
    }
    // Ghost notes at high intensity
    if (intensity >= 4 && (beat === 1.5 || beat === 3.5)) {
      playSnare(snareLayer.currentGain * 0.3);
    }
  }

  // ── Hi-hat (light texture, always on when bass is active) ──
  if (intensity >= 2) {
    const hhVol = 0.08 * (intensity >= 3 ? 1.3 : 1.0);
    playHiHat(hhVol, beat % 1 === 0.5 && intensity >= 4);
  }

  // ── Bass pattern ──
  const bassLayer = LAYERS[1]; // bass
  if (intensity >= bassLayer.minIntensity && bassLayer.currentGain > 0.01) {
    const bassNotes = getBassPattern(bar, beat, seed, key, intensity);
    for (const { note, dur } of bassNotes) {
      playBass(note, bassLayer.currentGain, dur * beatDuration);
    }
  }

  // ── Pad (sustained, triggered on bar changes) ──
  const padLayer = LAYERS[0]; // pad
  if (intensity >= padLayer.minIntensity && padLayer.currentGain > 0.01 && beat === 0) {
    const padChord = getPadChord(bar, seed, key, intensity);
    playPad(padChord, padLayer.currentGain, beatDuration * 4);
  }

  // ── Lead (melodic, varies by bar) ──
  const leadLayer = LAYERS[4]; // lead
  if (intensity >= leadLayer.minIntensity && leadLayer.currentGain > 0.01) {
    const leadNotes = getLeadPattern(bar, beat, seed, key, intensity);
    for (const { note, dur } of leadNotes) {
      playLead(note, leadLayer.currentGain, dur * beatDuration);
    }
  }

  // ── Arpeggio (fast patterns at high intensity) ──
  const arpLayer = LAYERS[5]; // arp
  if (intensity >= arpLayer.minIntensity && arpLayer.currentGain > 0.01) {
    const arpNotes = getArpPattern(bar, beat, seed, key, intensity, state.beatCount);
    for (const { note, dur } of arpNotes) {
      playArp(note, arpLayer.currentGain, dur * beatDuration);
    }
  }
}

// ── Pattern Generators ───────────────────────────────────────

function getBassPattern(
  bar: number, beat: number, seed: number, key: number, intensity: MusicIntensity,
): { note: number; dur: number }[] {
  const notes: { note: number; dur: number }[] = [];
  const octave = 0; // Sub bass

  // Root-based bass lines following minor key
  const degrees = [0, 0, 3, 4, 0, 0, 5, 3]; // i - i - III - IV - i - i - v - III
  const degree = degrees[(bar * 4 + beat) % degrees.length];

  if (beat === 0 || (intensity >= 4 && beat % 2 === 0)) {
    notes.push({ note: getScaleNote(octave, degree, key), dur: intensity >= 4 ? 0.5 : 1.0 });
  }

  // Walking bass variation at intensity 3+
  if (intensity >= 3 && seeded(seed + bar * 11 + beat * 7) > 0.6) {
    const nextDeg = degrees[(bar * 4 + beat + 1) % degrees.length];
    notes.push({ note: getScaleNote(octave, nextDeg, key), dur: 0.5 });
  }

  return notes;
}

function getPadChord(bar: number, seed: number, key: number, intensity: MusicIntensity): number[] {
  const chordProgressions: number[][] = [
    [0, 3, 7],     // i minor
    [0, 3, 7],     // i minor
    [3, 7, 10],    // III major
    [5, 8, 12],    // v minor
  ];
  const progression = intensity >= 5
    ? [[0, 3, 7], [3, 7, 10], [5, 8, 12], [7, 10, 14]] // darker for boss
    : chordProgressions;

  const chord = progression[bar % progression.length];
  return chord.map(d => getScaleNote(1, d, key));
}

function getLeadPattern(
  bar: number, beat: number, seed: number, key: number, intensity: MusicIntensity,
): { note: number; dur: number }[] {
  const notes: { note: number; dur: number }[] = [];
  const octave = 2;

  // Only play on certain beats (melodic, not every beat)
  if (beat !== 0 && beat !== 2 && seeded(seed + bar * 13 + beat * 3) > 0.4) return notes;

  // Simple melodic fragments — pick from scale
  const degreePatterns = [
    [0, 2, 3],    // ascending
    [7, 5, 3],    // descending
    [0, 4, 7],    // leap up
    [7, 4, 0],    // leap down
    [3, 5, 7, 5], // wave
  ];
  const pattern = degreePatterns[Math.floor(seeded(seed + bar) * degreePatterns.length)];
  const idx = Math.floor(beat / 2) % pattern.length;
  const degree = pattern[idx];

  notes.push({
    note: getScaleNote(octave, degree, key),
    dur: intensity >= 4 ? 0.25 : 0.5,
  });

  // Double note at high intensity
  if (intensity >= 4 && seeded(seed + bar * 17 + beat * 11) > 0.6) {
    notes.push({
      note: getScaleNote(octave, degree + 2, key),
      dur: 0.25,
    });
  }

  return notes;
}

function getArpPattern(
  bar: number, beat: number, seed: number, key: number, intensity: MusicIntensity,
  beatCount: number,
): { note: number; dur: number }[] {
  const notes: { note: number; dur: number }[] = [];
  const octave = 2;

  // Fast arpeggios — every 8th note position
  const arpDegs = [0, 3, 5, 7, 5, 3]; // up and down
  const idx = beatCount % arpDegs.length;
  const degree = arpDegs[idx];

  notes.push({
    note: getScaleNote(octave, degree, key),
    dur: 0.25,
  });

  return notes;
}

// ── Director Update ──────────────────────────────────────────

/**
 * Main update tick. Called every frame from FlightScene.
 * Handles beat timing, layer volume smoothing, intensity transitions.
 *
 * @returns true if a beat was triggered this frame (for scheduling sounds)
 */
export function updateMusicDirector(
  state: MusicDirectorState,
  dt: number,
  input: MusicInput,
): { state: MusicDirectorState; beatTriggered: boolean } {
  let s = { ...state };

  // Compute raw intensity from game state
  s.rawIntensity = computeIntensity(input);

  // Start/stop based on game state
  if (input.inGame && !s.running) {
    s.running = true;
  } else if (!input.inGame && s.running) {
    s.running = false;
    s.targetMasterVolume = 0;
  }

  // Dramatic moment trigger (boss phase transitions)
  if (input.bossAlive && input.bossPhaseIndex >= 0 && !s.dramaticMoment) {
    // Don't trigger here — FlightScene handles this via triggerDramaticMoment
  }

  // Smooth intensity transitions (only allow ±1 per update to avoid jarring jumps)
  const intensityDiff = s.rawIntensity - s.intensity;
  if (Math.abs(intensityDiff) >= 1) {
    // Rapid change: allow immediate shift up, delayed shift down
    if (intensityDiff > 0) {
      s.intensity = s.rawIntensity as MusicIntensity;
    } else {
      // Delay intensity decrease by 2 seconds worth of smoothing
      // We'll handle this with a simple rate limit
      s.intensity = Math.max(s.rawIntensity, (s.intensity - 1)) as MusicIntensity;
    }
  }

  // Update target BPM and volume based on intensity
  s.targetBpm = BPM_BY_INTENSITY[s.intensity];
  s.targetMasterVolume = s.running ? VOLUME_BY_INTENSITY[s.intensity] : 0;

  // Dramatic moment boost
  if (s.dramaticMoment) {
    s.targetMasterVolume = Math.min(0.6, s.targetMasterVolume * 1.3);
    s.targetBpm = Math.max(s.targetBpm, BPM_BY_INTENSITY[5]);
    s.dramaticTimer -= dt;
    if (s.dramaticTimer <= 0) {
      s.dramaticMoment = false;
    }
  }

  // Smooth BPM transition
  const bpmRate = 20; // BPM change per second
  if (s.bpm < s.targetBpm) {
    s.bpm = Math.min(s.targetBpm, s.bpm + bpmRate * dt);
  } else if (s.bpm > s.targetBpm) {
    s.bpm = Math.max(s.targetBpm, s.bpm - bpmRate * dt * 0.5); // slower deceleration
  }

  // Smooth key transitions
  s.targetKeyNote = KEY_BY_INTENSITY[s.intensity];
  const keyRate = 2; // semitones per second
  if (s.keyNote < s.targetKeyNote) {
    s.keyNote = Math.min(s.targetKeyNote, s.keyNote + keyRate * dt);
  } else if (s.keyNote > s.targetKeyNote) {
    s.keyNote = Math.max(s.targetKeyNote, s.keyNote - keyRate * dt);
  }

  // Update master volume on audio node
  if (masterGainNode) {
    const volRate = 0.3; // volume change per second
    if (s.masterVolume < s.targetMasterVolume) {
      s.masterVolume = Math.min(s.targetMasterVolume, s.masterVolume + volRate * dt);
    } else if (s.masterVolume > s.targetMasterVolume) {
      s.masterVolume = Math.max(s.targetMasterVolume, s.masterVolume - volRate * dt * 0.5);
    }
    try {
      masterGainNode.gain.setValueAtTime(s.masterVolume, audioCtx!.currentTime);
    } catch { /* context may be closed */ }
  }

  // Update layer gains
  for (const layer of LAYERS) {
    const targetGain = s.intensity >= layer.minIntensity
      ? Math.min(1, (s.intensity - layer.minIntensity + 1) / 3) * layer.maxVolume
      : 0;
    const rate = targetGain > layer.currentGain ? (1 / layer.fadeIn) : (1 / layer.fadeOut);
    if (layer.currentGain < targetGain) {
      layer.currentGain = Math.min(targetGain, layer.currentGain + rate * dt);
    } else if (layer.currentGain > targetGain) {
      layer.currentGain = Math.max(targetGain, layer.currentGain - rate * dt);
    }
  }

  // Beat timing
  if (!s.running || s.intensity === 0) {
    return { state: s, beatTriggered: false };
  }

  const beatDuration = 60 / s.bpm;
  s.beatTimer += dt;

  let beatTriggered = false;

  while (s.beatTimer >= beatDuration) {
    s.beatTimer -= beatDuration;
    s.beatCount++;
    beatTriggered = true;

    // Update bar/beat positions (4 beats per bar)
    s.currentBeat = s.beatCount % 4;
    if (s.currentBeat === 0 && s.beatCount > 0) {
      s.currentBar = (s.currentBar + 1) % 4;
      s.barsSinceVariation++;

      // Change pattern variation every 8 bars
      if (s.barsSinceVariation >= 8) {
        s.patternSeed = s.beatCount;
        s.barsSinceVariation = 0;
      }
    }
  }

  return { state: s, beatTriggered };
}

// ── Dramatic Moments ─────────────────────────────────────────

/**
 * Trigger a dramatic musical moment (boss phase transition, etc.).
 * Boosts intensity and volume temporarily.
 */
export function triggerDramaticMoment(state: MusicDirectorState, duration = 3.0): MusicDirectorState {
  return {
    ...state,
    dramaticMoment: true,
    dramaticTimer: duration,
  };
}

// ── Reset ────────────────────────────────────────────────────

/**
 * Reset the director for a new game session.
 */
export function resetMusicDirector(state: MusicDirectorState): MusicDirectorState {
  return {
    ...createMusicDirector(),
    running: true,
  };
}
