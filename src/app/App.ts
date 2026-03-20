import * as THREE from 'three';
import { EditorScene } from '../scenes/EditorScene';
import { FlightScene } from '../scenes/FlightScene';
import type { ShipBlueprint } from '../core/types';
import { ENCOUNTER_PRESETS, getEncounterPreset } from '../game/encounters';
import { cloneBlueprint, createExampleBlueprint, parseBlueprint } from '../state/shipBlueprint';

interface ActiveScene {
  update(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const STORAGE_KEY = 'spachip3js.blueprint';
const ENCOUNTER_KEY = 'spachip3js.encounter';

export class App {
  private readonly root: HTMLElement;
  private readonly rendererHost = document.createElement('div');
  private readonly uiRoot = document.createElement('div');
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly clock = new THREE.Clock();

  private blueprint: ShipBlueprint;
  private selectedEncounterId = 'gauntlet';
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

  private showEditor(): void {
    this.activeScene?.dispose();
    this.activeScene = new EditorScene({
      renderer: this.renderer,
      mount: this.rendererHost,
      uiRoot: this.uiRoot,
      blueprint: cloneBlueprint(this.blueprint),
      selectedEncounterId: this.selectedEncounterId,
      onBlueprintChange: (blueprint) => {
        this.blueprint = cloneBlueprint(blueprint);
        this.persistBlueprint();
      },
      onEncounterChange: (encounterId) => {
        this.selectedEncounterId = encounterId;
        this.persistEncounterId();
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
