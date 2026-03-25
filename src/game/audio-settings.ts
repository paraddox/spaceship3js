export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

export type AudioChannel = 'music' | 'sfx';

export const AUDIO_SETTINGS_STORAGE_KEY = 'spachip3js.audio-settings';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.85,
  musicMuted: false,
  sfxMuted: false,
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeAudioSettings(value: Partial<AudioSettings> | null | undefined): AudioSettings {
  return {
    musicVolume: clampVolume(Number(value?.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume)),
    sfxVolume: clampVolume(Number(value?.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume)),
    musicMuted: Boolean(value?.musicMuted),
    sfxMuted: Boolean(value?.sfxMuted),
  };
}

export function loadAudioSettings(): AudioSettings {
  try {
    const saved = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_AUDIO_SETTINGS };
    return normalizeAudioSettings(JSON.parse(saved) as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function persistAudioSettings(settings: AudioSettings): void {
  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
}

export function setAudioVolume(settings: AudioSettings, channel: AudioChannel, value: number): AudioSettings {
  if (channel === 'music') {
    return { ...settings, musicVolume: clampVolume(value) };
  }
  return { ...settings, sfxVolume: clampVolume(value) };
}

export function stepAudioVolume(settings: AudioSettings, channel: AudioChannel, delta: number): AudioSettings {
  const current = channel === 'music' ? settings.musicVolume : settings.sfxVolume;
  return setAudioVolume(settings, channel, current + delta);
}

export function toggleAudioMuted(settings: AudioSettings, channel: AudioChannel): AudioSettings {
  if (channel === 'music') {
    return { ...settings, musicMuted: !settings.musicMuted };
  }
  return { ...settings, sfxMuted: !settings.sfxMuted };
}

export function getEffectiveMusicVolume(settings: AudioSettings): number {
  return settings.musicMuted ? 0 : settings.musicVolume;
}

export function getEffectiveSfxVolume(settings: AudioSettings): number {
  return settings.sfxMuted ? 0 : settings.sfxVolume;
}

export function getAudioPercentLabel(settings: AudioSettings, channel: AudioChannel): string {
  const volume = channel === 'music' ? settings.musicVolume : settings.sfxVolume;
  return `${Math.round(volume * 100)}%`;
}
