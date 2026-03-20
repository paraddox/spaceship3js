import * as THREE from 'three';
import { HEX_HEIGHT, HEX_SIZE, generateHexRing, hexKey, hexToWorld, normalizeRotation, worldToHex } from '../core/hex';
import type { CrewAllocation, HexCoord, ShipBlueprint } from '../core/types';
import type { ProgressionState } from '../game/progression';
import { DEFAULT_CREW_ALLOCATION, applyCrewModifiers } from '../game/crew';
import { ENCOUNTER_PRESETS } from '../game/encounters';
import type { HangarEntry } from '../game/hangar';
import { MODULE_UNLOCK_COSTS, canUnlockModule, isModuleUnlocked } from '../game/unlocks';
import { PALETTE_GROUPS } from '../data/moduleCatalog';
import { buildPreviewGroup, buildShipGroup } from '../rendering/shipFactory';
import {
  canPlaceModule,
  cloneBlueprint,
  computeShipStats,
  createExampleBlueprint,
  getBlueprintValidation,
  getModuleDefinition,
  isBlueprintLaunchReady,
  parseBlueprint,
  placeModule,
  removeModuleAtHex,
  serializeBlueprint,
  setCrewAllocation,
} from '../state/shipBlueprint';

interface EditorSceneOptions {
  renderer: THREE.WebGLRenderer;
  mount: HTMLElement;
  uiRoot: HTMLElement;
  blueprint: ShipBlueprint;
  selectedEncounterId: string;
  hangarEntries: HangarEntry[];
  progression: ProgressionState;
  onBlueprintChange: (blueprint: ShipBlueprint) => void;
  onEncounterChange: (encounterId: string) => void;
  onSaveToHangar: (name: string, blueprint: ShipBlueprint) => void;
  onLoadFromHangar: (entryId: string) => void;
  onDeleteFromHangar: (entryId: string) => void;
  onUnlockModule: (moduleId: string) => void;
  onLaunch: (blueprint: ShipBlueprint, encounterId: string) => void;
}

export class EditorScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly mount: HTMLElement;
  private readonly uiRoot: HTMLElement;
  private readonly onBlueprintChange: (blueprint: ShipBlueprint) => void;
  private readonly onEncounterChange: (encounterId: string) => void;
  private readonly onSaveToHangar: (name: string, blueprint: ShipBlueprint) => void;
  private readonly onLoadFromHangar: (entryId: string) => void;
  private readonly onDeleteFromHangar: (entryId: string) => void;
  private readonly onUnlockModule: (moduleId: string) => void;
  private readonly onLaunch: (blueprint: ShipBlueprint, encounterId: string) => void;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly gridGroup = new THREE.Group();
  private readonly shipAnchor = new THREE.Group();
  private readonly previewAnchor = new THREE.Group();
  private readonly hoverRing: THREE.Mesh;

  private blueprint: ShipBlueprint;
  private hangarEntries: HangarEntry[];
  private progression: ProgressionState;
  private selectedEncounterId: string;
  private selectedModuleId = 'core:bridge_scout';
  private previewRotation = 0;
  private hoveredHex: HexCoord | null = null;

  private readonly onPointerMove = (event: PointerEvent) => {
    this.hoveredHex = this.pickHex(event);
    this.refreshPreview();
    this.refreshInfo();
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button === 2) {
      if (this.hoveredHex) {
        this.blueprint = removeModuleAtHex(this.blueprint, this.hoveredHex);
        this.onBlueprintChange(cloneBlueprint(this.blueprint));
        this.refreshScene();
      }
      return;
    }

    if (event.button !== 0 || !this.hoveredHex) {
      return;
    }

    if (!canPlaceModule(this.blueprint, this.selectedModuleId, this.hoveredHex, this.previewRotation)) {
      return;
    }

    this.blueprint = placeModule(this.blueprint, this.selectedModuleId, this.hoveredHex, this.previewRotation);
    this.onBlueprintChange(cloneBlueprint(this.blueprint));
    this.refreshScene();
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.6, 2.8);
    this.camera.updateProjectionMatrix();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === 'q') {
      this.previewRotation = normalizeRotation(this.previewRotation - 1);
      this.refreshScene();
    }
    if (event.key.toLowerCase() === 'e') {
      this.previewRotation = normalizeRotation(this.previewRotation + 1);
      this.refreshScene();
    }
  };

  constructor({ renderer, mount, uiRoot, blueprint, selectedEncounterId, hangarEntries, progression, onBlueprintChange, onEncounterChange, onSaveToHangar, onLoadFromHangar, onDeleteFromHangar, onUnlockModule, onLaunch }: EditorSceneOptions) {
    this.renderer = renderer;
    this.mount = mount;
    this.uiRoot = uiRoot;
    this.blueprint = cloneBlueprint(blueprint);
    this.hangarEntries = hangarEntries;
    this.progression = progression;
    this.selectedEncounterId = selectedEncounterId;
    this.onBlueprintChange = onBlueprintChange;
    this.onEncounterChange = onEncounterChange;
    this.onSaveToHangar = onSaveToHangar;
    this.onLoadFromHangar = onLoadFromHangar;
    this.onDeleteFromHangar = onDeleteFromHangar;
    this.onUnlockModule = onUnlockModule;
    this.onLaunch = onLaunch;

    this.camera.position.set(0, 18, 0.001);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = new THREE.Color('#07111f');

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    this.scene.add(ambient, sun);
    this.scene.add(this.gridGroup, this.shipAnchor, this.previewAnchor);

    this.hoverRing = new THREE.Mesh(
      new THREE.CylinderGeometry(HEX_SIZE * 1.02, HEX_SIZE * 1.02, HEX_HEIGHT * 0.25, 6),
      new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.35 }),
    );
    this.hoverRing.rotation.y = Math.PI / 6;
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);

    this.buildGrid();
    this.buildUi();
    this.attachEvents();
    this.refreshScene();
  }

  update(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(height, 1);
    const frustum = 24;
    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    this.uiRoot.innerHTML = '';
  }

  private preventContextMenu = (event: Event) => event.preventDefault();

  private attachEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private buildGrid(): void {
    this.gridGroup.clear();
    for (const hex of generateHexRing(8)) {
      const world = hexToWorld(hex);
      const tile = new THREE.Mesh(
        new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.06, 6),
        new THREE.MeshStandardMaterial({ color: '#12243b', roughness: 0.9, metalness: 0.05 }),
      );
      tile.rotation.y = Math.PI / 6;
      tile.position.set(world.x, -0.03, world.z);
      this.gridGroup.add(tile);

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.08, 6).rotateY(Math.PI / 6)),
        new THREE.LineBasicMaterial({ color: '#24405f' }),
      );
      outline.position.copy(tile.position);
      this.gridGroup.add(outline);
    }
  }

  private buildUi(): void {
    this.uiRoot.innerHTML = `
      <div class="overlay top-left panel editor-panel">
        <h1>Spachip3JS</h1>
        <p class="muted">Godot spaceship plan translated into a browser-friendly editor + flight sandbox.</p>
        <div id="progression-summary" class="progression-summary"></div>
        <div id="editor-stats" class="stats-grid"></div>
        <h2>Crew Assignments</h2>
        <div id="crew-grid" class="crew-grid"></div>
        <div class="toolbar-row">
          <button data-action="rotate-left">Rotate ⟲</button>
          <button data-action="rotate-right">Rotate ⟳</button>
          <button data-action="clear">Clear Ship</button>
          <button data-action="reset-crew">Reset Crew</button>
        </div>
        <div class="toolbar-row">
          <button data-action="load-example">Load Example</button>
          <button data-action="export-json">Copy JSON</button>
          <button data-action="import-json">Import JSON</button>
        </div>
        <h2>Encounter</h2>
        <div class="encounter-grid">
          ${ENCOUNTER_PRESETS.map((preset) => `<button class="encounter-button" data-encounter="${preset.id}" title="${preset.description}">${preset.displayName}</button>`).join('')}
        </div>
        <div id="encounter-briefing" class="muted"></div>
        <h2>Hangar</h2>
        <div class="toolbar-row">
          <button data-action="save-hangar">Save Current Ship</button>
        </div>
        <div id="hangar-grid" class="hangar-grid"></div>
        <h2>Module Palette</h2>
        <div class="module-grid">
          ${PALETTE_GROUPS.flat().map((id) => {
            const def = getModuleDefinition(id);
            const unlocked = isModuleUnlocked(this.progression, id);
            const cost = MODULE_UNLOCK_COSTS[id] ?? 0;
            return unlocked
              ? `<button class="module-button" data-module="${id}">${def.displayName}</button>`
              : `<button class="module-button locked" data-unlock-module="${id}" title="Unlock for ${cost} credits">🔒 ${def.displayName} (${cost})</button>`;
          }).join('')}
        </div>
        <div id="editor-preview" class="muted"></div>
        <div id="editor-validation" class="muted"></div>
        <div class="toolbar-row">
          <button class="primary" data-action="launch">Launch Flight Test</button>
        </div>
      </div>
      <div class="overlay bottom-right panel compact-panel">
        <strong>Controls</strong>
        <ul>
          <li>Left click: place module</li>
          <li>Right click: remove module</li>
          <li>Q / E: rotate selected module</li>
          <li>Mouse wheel: zoom</li>
        </ul>
      </div>
    `;

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-module]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedModuleId = button.dataset.module ?? this.selectedModuleId;
        this.refreshInfo();
      });
    });

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-unlock-module]').forEach((button) => {
      button.addEventListener('click', () => {
        const moduleId = button.dataset.unlockModule;
        if (!moduleId) return;
        if (!canUnlockModule(this.progression, moduleId)) return;
        this.onUnlockModule(moduleId);
      });
    });

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-encounter]').forEach((button) => {
      button.addEventListener('click', () => {
        const encounterId = button.dataset.encounter;
        if (!encounterId) return;
        this.selectedEncounterId = encounterId;
        this.onEncounterChange(encounterId);
        this.refreshInfo();
      });
    });

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        if (action === 'rotate-left') this.previewRotation = normalizeRotation(this.previewRotation - 1);
        if (action === 'rotate-right') this.previewRotation = normalizeRotation(this.previewRotation + 1);
        if (action === 'clear') this.blueprint = { name: this.blueprint.name, crew: { ...this.blueprint.crew }, modules: [] };
        if (action === 'reset-crew') this.blueprint = setCrewAllocation(this.blueprint, DEFAULT_CREW_ALLOCATION);
        if (action === 'load-example') {
          this.blueprint = createExampleBlueprint();
        }
        if (action === 'export-json') {
          const text = serializeBlueprint(this.blueprint);
          await navigator.clipboard?.writeText(text);
          window.alert('Blueprint copied to clipboard.');
        }
        if (action === 'save-hangar') {
          const defaultName = `${this.blueprint.name} ${new Date().toLocaleTimeString()}`;
          const name = window.prompt('Save ship to hangar as:', defaultName);
          if (name) {
            this.onSaveToHangar(name, cloneBlueprint(this.blueprint));
          }
          return;
        }
        if (action === 'import-json') {
          const input = window.prompt('Paste a ship blueprint JSON blob');
          if (input) {
            const parsed = parseBlueprint(input);
            if (parsed) {
              this.blueprint = parsed;
            } else {
              window.alert('That JSON did not parse as a blueprint.');
            }
          }
        }
        if (action === 'launch') {
          if (!isBlueprintLaunchReady(this.blueprint)) {
            this.refreshInfo();
            return;
          }
          this.onLaunch(cloneBlueprint(this.blueprint), this.selectedEncounterId);
          return;
        }
        this.onBlueprintChange(cloneBlueprint(this.blueprint));
        this.refreshScene();
      });
    });

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-crew-role]').forEach((button) => {
      button.addEventListener('click', () => {
        const role = button.dataset.crewRole as keyof CrewAllocation | undefined;
        const delta = Number(button.dataset.crewDelta ?? 0);
        if (!role || !delta) return;
        const nextCrew: CrewAllocation = { ...this.blueprint.crew, [role]: Math.max(0, this.blueprint.crew[role] + delta) };
        this.blueprint = setCrewAllocation(this.blueprint, nextCrew);
        this.onBlueprintChange(cloneBlueprint(this.blueprint));
        this.refreshInfo();
      });
    });
  }

  private refreshScene(): void {
    this.shipAnchor.clear();
    this.shipAnchor.add(buildShipGroup(this.blueprint));
    this.refreshPreview();
    this.refreshInfo();
  }

  private refreshPreview(): void {
    this.previewAnchor.clear();
    const canPlace = this.hoveredHex
      ? canPlaceModule(this.blueprint, this.selectedModuleId, this.hoveredHex, this.previewRotation)
      : false;

    if (this.hoveredHex) {
      const world = hexToWorld(this.hoveredHex);
      this.hoverRing.visible = true;
      this.hoverRing.position.set(world.x, HEX_HEIGHT * 0.12, world.z);
      const ringMaterial = this.hoverRing.material as THREE.MeshBasicMaterial;
      ringMaterial.color.set(canPlace ? '#4ade80' : '#f87171');
    } else {
      this.hoverRing.visible = false;
    }

    if (this.hoveredHex) {
      this.previewAnchor.add(buildPreviewGroup(this.selectedModuleId, this.hoveredHex, this.previewRotation));
    }
  }

  private refreshInfo(): void {
    const baseStats = computeShipStats(this.blueprint);
    const stats = applyCrewModifiers(baseStats, this.blueprint.crew);
    const selected = getModuleDefinition(this.selectedModuleId);
    const totalCrew = Object.values(this.blueprint.crew).reduce((sum, value) => sum + value, 0);
    const validation = getBlueprintValidation(this.blueprint);
    const progressionEl = this.uiRoot.querySelector('#progression-summary');
    const statsEl = this.uiRoot.querySelector('#editor-stats');
    const previewEl = this.uiRoot.querySelector('#editor-preview');
    const encounterBriefingEl = this.uiRoot.querySelector('#encounter-briefing');
    const validationEl = this.uiRoot.querySelector('#editor-validation');
    const crewEl = this.uiRoot.querySelector('#crew-grid');
    const hangarEl = this.uiRoot.querySelector('#hangar-grid');
    if (progressionEl) {
      const bestScore = this.progression.bestEncounterScores[this.selectedEncounterId] ?? 0;
      const completed = this.progression.completedEncounterIds.includes(this.selectedEncounterId);
      progressionEl.innerHTML = `
        <div class="progression-pill"><span>Credits</span><strong>${this.progression.credits}</strong></div>
        <div class="progression-pill"><span>Completed Encounters</span><strong>${this.progression.completedEncounterIds.length}</strong></div>
        <div class="progression-pill"><span>${completed ? 'Best Score' : 'Target Encounter'}</span><strong>${completed ? bestScore : this.selectedEncounterId}</strong></div>
      `;
    }
    if (statsEl) {
      statsEl.innerHTML = [
        ['Modules', String(this.blueprint.modules.length)],
        ['Mass', stats.mass.toFixed(1)],
        ['HP', stats.maxHp.toFixed(0)],
        ['Power', `${stats.powerOutput.toFixed(0)} / ${stats.powerDemand.toFixed(0)}`],
        ['Heat Cap', stats.heatCapacity.toFixed(0)],
        ['Weapons', String(stats.weaponCount)],
        ['Thrust', stats.thrust.toFixed(0)],
        ['Crew', String(totalCrew)],
      ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    }
    if (crewEl) {
      crewEl.innerHTML = (Object.entries(this.blueprint.crew) as [keyof CrewAllocation, number][]).map(([role, value]) => `
        <div class="crew-row">
          <span>${capitalizeRole(role)}</span>
          <div class="crew-controls">
            <button data-crew-role="${role}" data-crew-delta="-1">−</button>
            <strong>${value}</strong>
            <button data-crew-role="${role}" data-crew-delta="1">+</button>
          </div>
        </div>
      `).join('');
      this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-crew-role]').forEach((button) => {
        button.onclick = () => {
          const role = button.dataset.crewRole as keyof CrewAllocation | undefined;
          const delta = Number(button.dataset.crewDelta ?? 0);
          if (!role || !delta) return;
          const nextCrew: CrewAllocation = { ...this.blueprint.crew, [role]: Math.max(0, this.blueprint.crew[role] + delta) };
          this.blueprint = setCrewAllocation(this.blueprint, nextCrew);
          this.onBlueprintChange(cloneBlueprint(this.blueprint));
          this.refreshInfo();
        };
      });
    }
    if (previewEl) {
      previewEl.innerHTML = `${selected.displayName} · rot ${this.previewRotation} · ${this.hoveredHex ? `hover ${hexKey(this.hoveredHex)}` : 'move cursor over grid'} · crew-adjusted thrust ${stats.thrust.toFixed(0)}`;
    }
    if (validationEl) {
      validationEl.innerHTML = validation.valid
        ? '<span class="success">Launch-ready configuration.</span>'
        : `<span class="warning">${validation.issues.join(' ')}</span>`;
    }
    const encounterPreset = ENCOUNTER_PRESETS.find((preset) => preset.id === this.selectedEncounterId);
    if (encounterBriefingEl && encounterPreset) {
      encounterBriefingEl.innerHTML = `<strong>${encounterPreset.objective.label}</strong> · ${encounterPreset.description}`;
    }
    if (hangarEl) {
      hangarEl.innerHTML = this.hangarEntries.length === 0
        ? '<p class="muted">No saved ships yet.</p>'
        : this.hangarEntries.map((entry) => `
            <div class="hangar-row">
              <div>
                <strong>${entry.name}</strong>
                <div class="muted">${entry.blueprint.modules.length} modules · ${new Date(entry.updatedAt).toLocaleString()}</div>
              </div>
              <div class="crew-controls">
                <button data-hangar-action="load" data-hangar-id="${entry.id}">Load</button>
                <button data-hangar-action="delete" data-hangar-id="${entry.id}">Delete</button>
              </div>
            </div>
          `).join('');
      this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-hangar-action]').forEach((button) => {
        button.onclick = () => {
          const id = button.dataset.hangarId;
          const action = button.dataset.hangarAction;
          if (!id || !action) return;
          if (action === 'load') this.onLoadFromHangar(id);
          if (action === 'delete') this.onDeleteFromHangar(id);
        };
      });
    }
    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-module]').forEach((button) => {
      button.classList.toggle('active', button.dataset.module === this.selectedModuleId);
    });
    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-encounter]').forEach((button) => {
      button.classList.toggle('active', button.dataset.encounter === this.selectedEncounterId);
    });
    const launchButton = this.uiRoot.querySelector<HTMLButtonElement>('[data-action="launch"]');
    if (launchButton) {
      launchButton.disabled = !validation.valid;
      launchButton.title = validation.valid ? 'Launch your ship into the sandbox.' : validation.issues.join(' ');
    }
  }

  private pickHex(event: PointerEvent): HexCoord | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      return null;
    }
    return worldToHex(hit.x, hit.z);
  }
}

function capitalizeRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
