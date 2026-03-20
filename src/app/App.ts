import * as THREE from 'three';
import { EditorScene } from '../scenes/EditorScene';
import { FlightScene } from '../scenes/FlightScene';
import type { ShipBlueprint } from '../core/types';
import { ENCOUNTER_PRESETS, getEncounterPreset } from '../game/encounters';
import {
  removeBlueprintFromHangar,
  saveBlueprintToHangar,
  sortHangarEntries,
  type HangarEntry,
} from '../game/hangar';
import {
  DEFAULT_PROGRESSION_STATE,
  applyEncounterReward,
  type EncounterReward,
  type ProgressionState,
} from '../game/progression';
import { cloneBlueprint, createExampleBlueprint, parseBlueprint } from '../state/shipBlueprint';

interface ActiveScene {
  update(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const STORAGE_KEY = 'spachip3js.blueprint';
const ENCOUNTER_KEY = 'spachip3js.encounter';
const HANGAR_KEY = 'spachip3js.hangar';
const PROGRESSION_KEY = 'spachip3js.progression';

export class App {
  private readonly root: HTMLElement;
  private readonly rendererHost = document.createElement('div');
  private readonly uiRoot = document.createElement('div');
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly clock = new THREE.Clock();

  private blueprint: ShipBlueprint;
  private selectedEncounterId = 'gauntlet';
  private hangarEntries: HangarEntry[] = [];
  private progression: ProgressionState = DEFAULT_PROGRESSION_STATE;
  private activeScene: ActiveScene | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app-shell';

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.rendererHost.className = 'renderer-host';
    this.rendererHost.appendChild(this.renderer.domElement);
    this.uiRoot.className = 'ui-root';
    this.root.append(this.rendererHost, this.uiRoot);

    this.blueprint = this.loadBlueprint();
    this.selectedEncounterId = this.loadEncounterId();
    this.hangarEntries = this.loadHangarEntries();
    this.progression = this.loadProgression();
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
    this.showEditor();
    this.tick();
  }

  private loadBlueprint(): ShipBlueprint {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createExampleBlueprint();
    const parsed = parseBlueprint(saved);
    return parsed ?? createExampleBlueprint();
  }

  private persistBlueprint(): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.blueprint));
  }

  private loadEncounterId(): string {
    const saved = window.localStorage.getItem(ENCOUNTER_KEY);
    if (saved && getEncounterPreset(saved)) return saved;
    return ENCOUNTER_PRESETS[0]?.id ?? 'gauntlet';
  }

  private persistEncounterId(): void {
    window.localStorage.setItem(ENCOUNTER_KEY, this.selectedEncounterId);
  }

  private loadHangarEntries(): HangarEntry[] {
    const saved = window.localStorage.getItem(HANGAR_KEY);
    if (!saved) return [];
    try {
      const data = JSON.parse(saved) as Array<{ id: string; name: string; blueprint: unknown; updatedAt: string }>;
      const parsed = data
        .map((entry) => {
          const blueprint = parseBlueprint(JSON.stringify(entry.blueprint));
          if (!blueprint) return null;
          return { id: entry.id, name: entry.name, blueprint, updatedAt: entry.updatedAt } satisfies HangarEntry;
        })
        .filter((entry): entry is HangarEntry => entry !== null);
      return sortHangarEntries(parsed);
    } catch {
      return [];
    }
  }

  private persistHangarEntries(): void {
    window.localStorage.setItem(HANGAR_KEY, JSON.stringify(this.hangarEntries));
  }

  private loadProgression(): ProgressionState {
    const saved = window.localStorage.getItem(PROGRESSION_KEY);
    if (!saved) return DEFAULT_PROGRESSION_STATE;
    try {
      const data = JSON.parse(saved) as Partial<ProgressionState>;
      return {
        credits: Number(data.credits ?? 0),
        completedEncounterIds: Array.isArray(data.completedEncounterIds) ? data.completedEncounterIds.map(String) : [],
        bestEncounterScores: typeof data.bestEncounterScores === 'object' && data.bestEncounterScores
          ? Object.fromEntries(Object.entries(data.bestEncounterScores).map(([key, value]) => [key, Number(value)]))
          : {},
      };
    } catch {
      return DEFAULT_PROGRESSION_STATE;
    }
  }

  private persistProgression(): void {
    window.localStorage.setItem(PROGRESSION_KEY, JSON.stringify(this.progression));
  }

  private showEditor(): void {
    this.activeScene?.dispose();
    this.activeScene = new EditorScene({
      renderer: this.renderer,
      mount: this.rendererHost,
      uiRoot: this.uiRoot,
      blueprint: cloneBlueprint(this.blueprint),
      selectedEncounterId: this.selectedEncounterId,
      hangarEntries: this.hangarEntries,
      progression: this.progression,
      onBlueprintChange: (blueprint) => {
        this.blueprint = cloneBlueprint(blueprint);
        this.persistBlueprint();
      },
      onEncounterChange: (encounterId) => {
        this.selectedEncounterId = encounterId;
        this.persistEncounterId();
      },
      onSaveToHangar: (name, blueprint) => {
        this.hangarEntries = saveBlueprintToHangar(this.hangarEntries, name, blueprint);
        this.persistHangarEntries();
        this.showEditor();
      },
      onLoadFromHangar: (entryId) => {
        const entry = this.hangarEntries.find((candidate) => candidate.id === entryId);
        if (!entry) return;
        this.blueprint = cloneBlueprint(entry.blueprint);
        this.persistBlueprint();
        this.showEditor();
      },
      onDeleteFromHangar: (entryId) => {
        this.hangarEntries = removeBlueprintFromHangar(this.hangarEntries, entryId);
        this.persistHangarEntries();
        this.showEditor();
      },
      onLaunch: (blueprint, encounterId) => {
        this.blueprint = cloneBlueprint(blueprint);
        this.selectedEncounterId = encounterId;
        this.persistBlueprint();
        this.persistEncounterId();
        this.showFlight();
      },
    });
    this.handleResize();
  }

  private showFlight(): void {
    this.activeScene?.dispose();
    this.activeScene = new FlightScene({
      renderer: this.renderer,
      mount: this.rendererHost,
      uiRoot: this.uiRoot,
      blueprint: cloneBlueprint(this.blueprint),
      encounterId: this.selectedEncounterId,
      onReward: (encounterId, reward) => {
        this.progression = applyEncounterReward(this.progression, encounterId, reward);
        this.persistProgression();
      },
      onBack: (blueprint) => {
        this.blueprint = cloneBlueprint(blueprint);
        this.persistBlueprint();
        this.showEditor();
      },
    });
    this.handleResize();
  }

  private handleResize = (): void => {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.activeScene?.resize(width, height);
  };

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.activeScene?.update(dt);
  };
}
