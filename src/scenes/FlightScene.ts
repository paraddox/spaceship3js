import * as THREE from 'three';
import { lerpAngle, HEX_SIZE, transformFootprint } from '../core/hex';
import type { ShipBlueprint, ShipStats, DamageType } from '../core/types';
import { applyCrewModifiers, DEFAULT_CREW_ALLOCATION } from '../game/crew';
import { ENCOUNTER_PRESETS, getEncounterPreset, type EncounterWave } from '../game/encounters';
import { buildShipGroup, computeBlueprintRadius } from '../rendering/shipFactory';
import { cloneBlueprint, computeShipStats, computeStatsFromSurviving, createExampleBlueprint, getModuleDefinition } from '../state/shipBlueprint';
import { buildWeaponLoadout, type WeaponProfile } from '../game/weapons';
import { buildDroneProfiles } from '../game/drones';
import {
  advanceDrone,
  applyDroneDamage,
  chooseDroneTarget,
  createDroneInstances,
  relaunchDrone,
  type DroneRuntimeState,
  type DroneTarget,
} from '../game/drone-runtime';
import { createEncounterReward, type EncounterReward } from '../game/progression';
import { evaluateObjective, type EncounterObjective } from '../game/objectives';
import { computeProjectileSpawnPosition } from '../game/projectiles';
import { buildEncounterDebrief } from '../game/debrief';
import { advanceProtectedAlly, chooseEnemyPriorityTarget, computeEscortProgress } from '../game/escort-ai';
import { advanceEffect, createBeamEffect, createExplosionEffect, createImpactEffect, type CombatEffectState } from '../game/effects';
import { playShoot, playLaser, playHit, playExplosion, playMissile, playBeam, resumeAudio, playComboTier, playOverdriveActivate, playOverdriveDeactivate } from '../game/audio';
import {
  computeFlankSeed,
  computeTacticalDecision,
  evaluateStance,
  type TacticalContext,
  type TacticalDecision,
} from '../game/tactical-ai';
import {
  generateEndlessWave,
  endlessWaveCredits,
  endlessWaveScore,
} from '../game/endless-generator';
import {
  advanceEncounterState,
  computeCoolingPerSecond,
  computePowerFactor,
  damageModules,
  getEffectiveThrust,
  getEffectiveWeaponCadence,
  getRepairTarget,
  isAfterburning,
  isOvercharged,
  isShieldBoosted,
  isOverheated,
  rechargeShield,
  resolveDamage,
  tickAbilities,
  activateAbility,
  buildAbilities,
  type DamageResult,
  type EncounterState,
  type ModuleRuntimeState,
  type AbilityId,
  type AbilityRuntime,
} from '../game/simulation';
import { ParticleSystem, createScreenShake, updateScreenShake, type ScreenShakeState } from '../game/particles';
import {
  createHazardStates,
  updateHazard,
  applyShipHazardCollision,
  damageAsteroid,
  checkProjectileAsteroidCollision,
  checkProjectileNebulaBoost,
  computeHazardSteering,
  type HazardState,
  type HazardSpawn,
} from '../game/hazards';
import {
  createPickup,
  rollPickupDrop,
  updatePickup,
  applyPickupAttraction,
  tryCollectPickup,
  applyRepair,
  updateBuffs,
  getDamageMultiplier,
  getCadenceMultiplier,
  getPickupColor,
  getPickupIcon,
  getPickupLabel,
  type PickupState,
  type PickupKind,
  type ActiveBuff,
} from '../game/pickups';
import {
  generateUpgradeOptions,
  upgradeCost,
  applyUpgrade,
  applyAllUpgrades,
  defaultLiveUpgradeStats,
  getRarityColor,
  getRarityLabel,
  computeRestRepairAmount,
  type UpgradeDef,
  type PurchasedUpgrade,
  type LiveUpgradeStats,
} from '../game/upgrade-shop';
import {
  type MutatorDef,
  type ActiveMutator,
  type MutatorId,
  MUTATOR_CATALOG,
  MAX_MUTATORS,
  hasMutator,
  canAddMutator,
  getShopMutators,
  applyMutatorStatMods,
  momentumDamageMult,
  vampiricHeal,
  thornsReflectFraction,
  lastStandBonuses,
  bountyHunterActive,
  chainReactionActive,
} from '../game/mutators';
import {
  type RunStats,
  DEFAULT_RUN_STATS,
  computeRunGrade,
  formatTime,
  formatBig,
  getCauseOfDeath,
  getNextRunTip,
  getHighlights,
} from '../game/run-report';
import {
  createDashState,
  canDash,
  startDash,
  updateDash,
  isInvulnerable,
  isDashing,
  getDashProgress,
  type DashState,
} from '../game/dash';
import {
  createComboState,
  registerComboKill,
  tickCombo,
  getComboTier,
  getComboCreditMultiplier,
  getComboTimerFraction,
  type ComboState,
} from '../game/combo';
import {
  computeAffixStats,
  isElite,
  getAffixColor,
  eliteCreditsMultiplier,
  affixDisplayLabel,
  type RolledAffix,
} from '../game/elite-affixes';
import {
  createOverdriveState,
  activateOverdrive,
  tickOverdrive,
  addOverdriveCharge,
  isOverdriveActive,
  canActivateOverdrive,
  getOverdriveTimeScale,
  getOverdriveDamageMult,
  getOverdriveFireRateMult,
  getOverdriveChargeFraction,
  getOverdriveProgressFraction,
  OVERDRIVE_DURATION,
  OVERDRIVE_COOLDOWN,
  OVERDRIVE_FULL_CHARGE,
  OVERDRIVE_CHARGE_PER_KILL,
  type OverdriveState,
} from '../game/overdrive';

const REPAIR_HP_FRACTION = 0.75;

interface FlightSceneOptions {
  renderer: THREE.WebGLRenderer;
  mount: HTMLElement;
  uiRoot: HTMLElement;
  blueprint: ShipBlueprint;
  encounterId: string;
  onReward: (encounterId: string, reward: EncounterReward) => void;
  onBack: (blueprint: ShipBlueprint) => void;
}

interface RuntimeShip {
  id: string;
  team: 'player' | 'enemy';
  blueprint: ShipBlueprint;
  stats: ShipStats;
  protectedTarget?: boolean;
  escortOrigin?: THREE.Vector3;
  weapons: WeaponProfile[];
  weaponIndex: number;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  hp: number;
  heat: number;
  cooldown: number;
  shield: number;
  maxShield: number;
  radius: number;
  preferredRange: number;
  fireJitter: number;
  alive: boolean;
  powerFactor: number;
  moduleStates: ModuleRuntimeState[];
  moduleMeshes: Map<string, THREE.Mesh>;
  abilities: AbilityRuntime[];
  /** Affix-based damage multiplier (defaults to 1). */
  affixDamageMult?: number;
  /** Affix-based fire rate multiplier (defaults to 1). */
  affixFireRateMult?: number;
  /** Affix-based thrust multiplier (defaults to 1). */
  affixThrustMult?: number;
  /** Affix-based armor bonus. */
  affixArmorBonus?: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  ttl: number;
  team: 'player' | 'enemy';
  archetype: WeaponProfile['archetype'];
  damageType: DamageType;
  armorPenetration: number;
  turnRate: number;
  target: RuntimeShip | null;
  active: boolean;
}

interface RuntimeDrone {
  ownerId: string;
  mesh: THREE.Mesh;
  state: DroneRuntimeState;
}

interface RuntimeEffect {
  state: CombatEffectState;
  object: THREE.Object3D;
}

const PROJECTILE_POOL_SIZE = 96;
const ARENA_RADIUS = 18;
const MAX_WORLD_RADIUS = 40;
const WAVE_RESPAWN_DELAY = 1.6;
const ESCORT_EXTRACTION_POINT = new THREE.Vector3(0, 0, -14);

export class FlightScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly uiRoot: HTMLElement;
  private readonly onReward: (encounterId: string, reward: EncounterReward) => void;
  private readonly onBack: (blueprint: ShipBlueprint) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 120);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly arenaGroup = new THREE.Group();
  private readonly projectileGroup = new THREE.Group();
  private readonly effectGroup = new THREE.Group();
  private readonly healthBarGroup = new THREE.Group();
  private readonly shipHealthBars = new Map<string, { bg: THREE.Mesh; fg: THREE.Mesh; shieldBg: THREE.Mesh; shieldFg: THREE.Mesh }>();
  private readonly ships: RuntimeShip[] = [];
  private readonly drones: RuntimeDrone[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly effects: RuntimeEffect[] = [];
  private readonly keys = new Set<string>();
  private waves: EncounterWave[];

  private player!: RuntimeShip;
  private fireHeld = false;
  private mouseWorld = new THREE.Vector3(0, 0, -10);
  private currentWave = 1;
  private encounterOutcome: 'continue' | 'victory' | 'defeat' = 'continue';
  private waveDelay = 0;
  private waveAnnouncement = 'Wave 1 engaged';
  private hasGrantedReward = false;
  private encounterId: string;
  private encounterObjective!: EncounterObjective;
  private elapsedEncounterSeconds = 0;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  // Endless mode tracking
  private isEndlessMode = false;
  private endlessTotalKills = 0;
  private endlessScore = 0;
  private endlessBestWave = 0;
  private endlessCredits = 0;
  /** Accumulated elite credit bonus for the current wave, applied on wave clear. */
  private endlessWaveEliteBonus = 0;

  // Run report card stats
  private runStats: RunStats = { ...DEFAULT_RUN_STATS };

  // Upgrade shop
  private upgradeStats: LiveUpgradeStats = defaultLiveUpgradeStats();
  private purchasedUpgrades: PurchasedUpgrade[] = [];
  private shopOpen = false;
  private shopOptions: UpgradeDef[] = [];
  private shopWaveCleared = 0;

  // Mutator traits
  private activeMutators: ActiveMutator[] = [];
  private shopMutatorOptions: MutatorDef[] = [];
  /** Timed announcement shown in HUD for elite enemy spawns. */
  private eliteAnnouncement = '';
  /** Timer to fade out elite announcement (seconds remaining). */
  private eliteAnnouncementTimer = 0;

  // VFX
  private readonly particles = new ParticleSystem();
  private screenShake: ScreenShakeState | null = null;
  private thrustTimer = 0;

  // Hazards
  private readonly hazardGroup = new THREE.Group();
  private readonly hazards: HazardState[] = [];
  private readonly hazardMeshes = new Map<string, THREE.Object3D>();

  // Pickups
  private readonly pickupGroup = new THREE.Group();
  private readonly pickups: PickupState[] = [];
  private readonly pickupMeshes = new Map<string, THREE.Object3D>();
  private playerBuffs: ActiveBuff[] = [];
  private dashState: DashState = createDashState();
  private comboState: ComboState = createComboState();
  private overdriveState: OverdriveState = createOverdriveState();
  private pickupAnnouncement = '';
  private pickupAnnouncementTimer = 0;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    resumeAudio();
    this.keys.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onPointerMove = (event: PointerEvent) => this.updateMouseWorld(event);
  private readonly onPointerDown = (event: PointerEvent) => {
    resumeAudio();
    if (event.button === 0) this.fireHeld = true;
    this.updateMouseWorld(event);
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.fireHeld = false;
  };

  constructor({ renderer, uiRoot, blueprint, encounterId, onReward, onBack }: FlightSceneOptions) {
    this.renderer = renderer;
    this.uiRoot = uiRoot;
    this.onReward = onReward;
    this.onBack = onBack;
    this.encounterId = encounterId;
    this.isEndlessMode = encounterId === 'endless';

    if (this.isEndlessMode) {
      // Endless mode: waves are generated procedurally
      this.waves = [];
      this.encounterObjective = { type: 'eliminate_all', label: 'Endless Gauntlet — survive as long as you can' };
    } else {
      const preset = getEncounterPreset(encounterId) ?? ENCOUNTER_PRESETS[0];
      this.waves = preset?.waves ?? [];
      this.encounterObjective = preset?.objective ?? { type: 'eliminate_all', label: 'Destroy all hostile ships' };
    }

    this.camera.position.set(0, 20, 0.001);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = new THREE.Color('#020617');

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const rim = new THREE.DirectionalLight(0xbfe1ff, 1.1);
    rim.position.set(8, 10, 6);
    this.scene.add(ambient, rim, this.arenaGroup, this.projectileGroup, this.effectGroup, this.healthBarGroup, this.particles.group, this.hazardGroup, this.pickupGroup);

    this.buildArena();
    this.buildProjectiles();
    this.buildUi();
    this.spawnEncounter(cloneBlueprint(blueprint));
    this.attachEvents();
  }

  update(dt: number): void {
    this.elapsedEncounterSeconds += dt;

    // If shop is open, only render — don't update game state
    if (this.shopOpen) {
      this.refreshHud();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateCameraFollow(dt);
    this.updateWaveDelay(dt);
    this.updateOverdrive(dt);
    const enemyDt = dt * getOverdriveTimeScale(this.overdriveState);
    this.updatePlayer(dt);
    this.updateProtectedAllies(enemyDt);
    this.updateEnemies(enemyDt);
    this.updateDrones(enemyDt);
    this.updateProjectiles(enemyDt);
    this.updateEffects(enemyDt);
    this.particles.update(dt);
    this.updateThrustTrails(dt);
    this.updateScreenShake(dt);
    this.coolShips(dt);
    this.updateHazards(enemyDt);
    this.updateShipHazards(enemyDt);
    this.updatePickups(dt);
    this.updatePlayerBuffs(dt);
    this.updateCombo(dt);
    // Fade out elite announcement
    if (this.eliteAnnouncementTimer > 0) {
      this.eliteAnnouncementTimer -= dt;
      if (this.eliteAnnouncementTimer <= 0) this.eliteAnnouncement = '';
    }
    this.updateAbilities(dt);
    this.updateHealthBars();
    this.updateEncounterState();
    this.refreshHud();
    this.renderer.render(this.scene, this.camera);
  }

  private updateAbilities(dt: number): void {
    for (const ship of this.ships) {
      tickAbilities(ship.abilities, dt);

      // Apply enemy emergency repair on activation frame
      // (duration=0, so activeRemaining is 0 after tick — detect via fresh cooldown)
      if (ship.team === 'enemy') {
        const repairAbility = ship.abilities.find((a) => a.def.id === 'emergency_repair');
        if (repairAbility && repairAbility.cooldownRemaining > 0 &&
            repairAbility.activeRemaining <= 0 &&
            repairAbility.cooldownRemaining > repairAbility.def.cooldown - 0.1) {
          const repairTarget = getRepairTarget(ship.moduleStates);
          if (repairTarget) {
            repairTarget.currentHp = Math.min(repairTarget.maxHp, repairTarget.currentHp + repairTarget.maxHp * 0.25);
            ship.hp = ship.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
          }
        }
      }
    }
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(height, 1);
    const frustum = 28;
    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.uiRoot.innerHTML = '';
  }

  private attachEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  private buildUi(): void {
    this.uiRoot.innerHTML = `
      <div class="overlay top-left panel compact-panel" id="flight-hud"></div>
      <div class="overlay top-right panel compact-panel">
        <strong>Flight Test</strong>
        <p class="muted">A reduced Three.js combat slice of the original sandbox plans.</p>
        <div id="flight-debrief" class="muted"></div>
        <div class="toolbar-row">
          <button class="primary" data-action="return-editor">Return to Editor</button>
          <button data-action="reset">Reset Encounter</button>
        </div>
      </div>
      <div class="overlay bottom-left" style="pointer-events:none;">
        <div class="minimap-container">
          <canvas id="minimap-canvas" width="360" height="360"></canvas>
        </div>
      </div>
      <div class="overlay bottom-right panel compact-panel">
        <strong>Controls</strong>
        <ul>
          <li>W/S: thrust forward or reverse</li>
          <li>A/D: strafe and orbit</li>
          <li>Mouse: aim ship</li>
          <li>Hold left click: fire</li>
          <li>Space: dash</li>
          <li>V: overdrive (when charged)</li>
          <li>1: Shield Boost · 2: Afterburner</li>
          <li>3: Overcharge · 4: Emergency Repair</li>
        </ul>
      </div>
    `;

    const canvas = this.uiRoot.querySelector('#minimap-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      this.minimapCanvas = canvas;
      this.minimapCtx = canvas.getContext('2d');
    }

    this.uiRoot.querySelector('[data-action="return-editor"]')?.addEventListener('click', () => {
      this.onBack(cloneBlueprint(this.player.blueprint));
    });
    this.uiRoot.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      this.spawnEncounter(cloneBlueprint(this.player.blueprint));
    });
  }

  private buildArena(): void {
    this.arenaGroup.clear();
    const plane = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS, 64),
      new THREE.MeshStandardMaterial({ color: '#081421', roughness: 1, metalness: 0.05 }),
    );
    plane.rotation.x = -Math.PI / 2;
    this.arenaGroup.add(plane);

    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 64 }, (_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(angle) * ARENA_RADIUS, 0.02, Math.sin(angle) * ARENA_RADIUS);
        }),
      ),
      new THREE.LineBasicMaterial({ color: '#1f3a57' }),
    );
    this.arenaGroup.add(ring);

    if (this.encounterObjective.type === 'protect_ally') {
      const extractionRing = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 32 }, (_, i) => {
            const angle = (i / 32) * Math.PI * 2;
            return new THREE.Vector3(
              ESCORT_EXTRACTION_POINT.x + Math.cos(angle) * 1.35,
              0.03,
              ESCORT_EXTRACTION_POINT.z + Math.sin(angle) * 1.35,
            );
          }),
        ),
        new THREE.LineBasicMaterial({ color: '#67e8f9' }),
      );
      const extractionPad = new THREE.Mesh(
        new THREE.CircleGeometry(1.1, 24),
        new THREE.MeshBasicMaterial({ color: '#155e75', transparent: true, opacity: 0.28 }),
      );
      extractionPad.rotation.x = -Math.PI / 2;
      extractionPad.position.copy(ESCORT_EXTRACTION_POINT).setY(0.02);
      this.arenaGroup.add(extractionPad, extractionRing);
    }

    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          Array.from({ length: 250 }, () => [
            (Math.random() - 0.5) * 60,
            Math.random() * 6 + 2,
            (Math.random() - 0.5) * 60,
          ]).flat(),
          3,
        ),
      ),
      new THREE.PointsMaterial({ color: '#dbeafe', size: 0.05 }),
    );
    this.arenaGroup.add(stars);
  }

  private buildProjectiles(): void {
    this.projectileGroup.clear();
    this.projectiles.length = 0;
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      );
      mesh.visible = false;
      this.projectileGroup.add(mesh);
      this.projectiles.push({
        mesh,
        velocity: new THREE.Vector3(),
        damage: 0,
        ttl: 0,
        team: 'player',
        archetype: 'projectile',
        damageType: 'kinetic',
        armorPenetration: 0,
        turnRate: 0,
        target: null,
        active: false,
      });
    }
  }

  private spawnEncounter(playerBlueprint: ShipBlueprint): void {
    for (const ship of this.ships) {
      this.scene.remove(ship.group);
    }
    for (const drone of this.drones) {
      this.scene.remove(drone.mesh);
    }
    for (const effect of this.effects) {
      this.effectGroup.remove(effect.object);
    }
    this.ships.length = 0;
    this.drones.length = 0;
    this.effects.length = 0;
    this.clearHealthBars();
    this.clearHazards();
    this.clearPickups();
    this.playerBuffs = [];
    for (const projectile of this.projectiles) {
      this.deactivateProjectile(projectile);
    }

    this.currentWave = 1;
    this.encounterOutcome = 'continue';
    this.waveDelay = 0;
    this.waveAnnouncement = 'Wave 1 engaged';
    this.hasGrantedReward = false;
    this.screenShake = null;
    this.particles.clear();
    this.elapsedEncounterSeconds = 0;
    this.endlessTotalKills = 0;
    this.endlessScore = 0;
    this.endlessBestWave = 0;
    this.endlessCredits = 0;
    this.endlessWaveEliteBonus = 0;
    this.eliteAnnouncement = '';
    this.eliteAnnouncementTimer = 0;
    this.shipAffixData.clear();
    this.shipAffixes.clear();
    this.runStats = { ...DEFAULT_RUN_STATS };
    this.upgradeStats = defaultLiveUpgradeStats();
    this.purchasedUpgrades = [];
    this.shopOpen = false;
    this.shopOptions = [];
    this.activeMutators = [];
    this.shopMutatorOptions = [];
    this.dashState = createDashState();
    this.comboState = createComboState();
    this.overdriveState = createOverdriveState();
    this.shopWaveCleared = 0;
    this.waveAnnouncement = `${this.currentWave > 0 ? `Wave ${this.currentWave}` : 'Wave 1'} incoming...`;
    this.player = this.createShip('player-1', 'player', playerBlueprint, new THREE.Vector3(0, 0, 8), Math.PI, 0, 0);
    this.ships.push(this.player);
    this.spawnDronesForShip(this.player);
    if (this.encounterObjective.type === 'protect_ally') {
      const preset = getEncounterPreset(this.encounterId);
      if (preset?.alliedBlueprint) {
        const ally = this.createShip('ally-escort', 'player', cloneBlueprint(preset.alliedBlueprint), new THREE.Vector3(0, 0, 2), Math.PI, 0, 0, true);
        this.ships.push(ally);
      }
    }
    this.spawnWave(1);
  }

  private spawnWave(waveNumber: number): void {
    let wave = this.waves[waveNumber - 1];

    // Endless mode: generate wave procedurally
    if (!wave) {
      wave = generateEndlessWave(waveNumber);
      this.waves.push(wave);
    }

    this.waveAnnouncement = `${wave.name} deployed`;

    // Spawn hazards for this wave (replacing previous wave's hazards)
    this.clearHazards();
    if (wave.hazards && wave.hazards.length > 0) {
      this.spawnHazards(wave.hazards);
    }

    for (const enemy of wave.enemies) {
      const runtimeShip = this.createShip(
        enemy.id,
        'enemy',
        cloneBlueprint(enemy.blueprint),
        enemy.position.clone(),
        enemy.rotation,
        enemy.preferredRange,
        enemy.fireJitter,
      );
      this.ships.push(runtimeShip);
      this.spawnDronesForShip(runtimeShip);
      // Apply elite affix stat modifications
      if (enemy.affixes && enemy.affixes.length > 0) {
        this.applyAffixMods(runtimeShip, enemy.affixes);
      }
    }
  }

  private createShip(
    id: string,
    team: 'player' | 'enemy',
    blueprint: ShipBlueprint,
    position: THREE.Vector3,
    rotation: number,
    preferredRange: number,
    fireJitter: number,
    protectedTarget = false,
  ): RuntimeShip {
    const group = buildShipGroup(blueprint, 1, team);
    group.position.copy(position);
    group.rotation.y = rotation;
    this.scene.add(group);
    const stats = applyCrewModifiers(computeShipStats(blueprint), blueprint.crew);
    const weapons = buildWeaponLoadout(blueprint);
    const powerFactor = computePowerFactor(stats.powerOutput, stats.powerDemand);
    const maxShield = stats.shieldStrength;

    // Build per-module runtime state and mesh mapping
    const moduleStates: ModuleRuntimeState[] = [];
    const moduleMeshes = new Map<string, THREE.Mesh>();
    let meshIndex = 0;
    for (const placed of blueprint.modules) {
      const def = getModuleDefinition(placed.definitionId);
      const transformed = transformFootprint(def.footprint, placed.rotation);
      // Store state for the first hex of each multi-hex module (the "anchor")
      const anchorHex = { q: placed.position.q + transformed[0].q, r: placed.position.r + transformed[0].r };
      moduleStates.push({
        instanceId: placed.instanceId,
        definitionId: placed.definitionId,
        hex: anchorHex,
        currentHp: def.maxHp,
        maxHp: def.maxHp,
        destroyed: false,
        category: def.category,
      });
      // Map each hex's mesh to the instanceId
      for (let h = 0; h < transformed.length; h += 1) {
        const mesh = group.children[meshIndex * 2]; // mesh + outline alternating
        if (mesh instanceof THREE.Mesh) {
          moduleMeshes.set(`${placed.instanceId}:${h}`, mesh);
        }
        meshIndex += 1;
      }
    }

    const abilities = buildAbilities(
      new Set(blueprint.modules.map((m) => getModuleDefinition(m.definitionId).category)),
    );

    return {
      id,
      team,
      blueprint,
      stats,
      protectedTarget,
      escortOrigin: protectedTarget ? position.clone() : undefined,
      weapons,
      weaponIndex: 0,
      group,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation,
      hp: Math.max(stats.maxHp, 60),
      heat: 0,
      cooldown: 0,
      shield: maxShield,
      maxShield,
      radius: computeBlueprintRadius(blueprint),
      preferredRange,
      fireJitter,
      alive: true,
      powerFactor,
      moduleStates,
      moduleMeshes,
      abilities,
    };
  }

  private updatePlayer(dt: number): void {
    if (!this.player.alive) return;
    const desiredRotation = Math.atan2(
      this.mouseWorld.x - this.player.position.x,
      this.mouseWorld.z - this.player.position.z,
    );
    this.player.rotation = lerpAngle(this.player.rotation, desiredRotation, Math.min(1, dt * 8));

    const forward = new THREE.Vector3(Math.sin(this.player.rotation), 0, Math.cos(this.player.rotation));
    const right = new THREE.Vector3(Math.cos(this.player.rotation), 0, -Math.sin(this.player.rotation));
    const forwardInput = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const strafeInput = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const effectiveThrust = getEffectiveThrust(
      Math.max(4, this.player.stats.thrust / 70),
      this.player.powerFactor,
      this.player.heat,
      this.player.stats.heatCapacity,
    ) * (isAfterburning(this.player.abilities) ? 2.5 : 1);

    const acceleration = forward
      .multiplyScalar(forwardInput * effectiveThrust)
      .add(right.multiplyScalar(strafeInput * effectiveThrust * 0.75));
    this.player.velocity.addScaledVector(acceleration, dt);
    this.player.velocity.multiplyScalar(0.985);

    // Apply dash burst movement
    if (isDashing(this.dashState)) {
      this.player.velocity.x = this.dashState.dashDirX * this.player.stats.thrust * this.dashState.speedMultiplier / 50;
      this.player.velocity.z = this.dashState.dashDirZ * this.player.stats.thrust * this.dashState.speedMultiplier / 50;
    }

    this.player.position.addScaledVector(this.player.velocity, dt);
    this.clampToArena(this.player.position);

    if (this.fireHeld) {
      this.tryFire(this.player, this.mouseWorld.clone().sub(this.player.position).normalize());
    }

    // ── Ability hotkeys ──
    this.tryPlayerAbility('Digit1', 'shield_boost');
    this.tryPlayerAbility('Digit2', 'afterburner');
    this.tryPlayerAbility('Digit3', 'overcharge');
    this.tryPlayerAbility('Digit4', 'emergency_repair');

    // ── Dash (Space) ──
    this.dashState = updateDash(this.dashState, dt);
    if (this.keys.has('Space') && canDash(this.dashState)) {
      const shipRot = this.player.group.rotation.y;
      this.dashState = startDash(
        this.dashState, forward.x, forward.z, right.x, right.z,
        shipRot, this.upgradeStats.dashCooldownReduction,
      );
      if (this.isEndlessMode) this.runStats.dashCount += 1;
      this.particles.emit(ParticleSystem.dashBurst(this.player.position));
    }

    // ── Overdrive (V) ──
    if (this.keys.has('KeyV') && canActivateOverdrive(this.overdriveState)) {
      const wasActive = isOverdriveActive(this.overdriveState);
      this.overdriveState = activateOverdrive(this.overdriveState);
      if (!wasActive && isOverdriveActive(this.overdriveState)) {
        if (this.isEndlessMode) this.runStats.overdriveActivations += 1;
        this.screenShake = createScreenShake(0.4, 0.35);
        for (const config of ParticleSystem.deathExplosion(this.player.position)) {
          this.particles.emit(config);
        }
        playOverdriveActivate();
      }
    }

    this.syncShipTransform(this.player);
  }

  private tryPlayerAbility(keyCode: string, abilityId: AbilityId): void {
    if (!this.keys.has(keyCode)) return;
    if (activateAbility(this.player.abilities, abilityId)) {
      // Handle emergency repair immediately
      if (abilityId === 'emergency_repair') {
        const target = getRepairTarget(this.player.moduleStates);
        if (target) {
          const repairAmount = target.maxHp * 0.25;
          target.currentHp = Math.min(target.maxHp, target.currentHp + repairAmount);
          this.player.hp = this.player.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
          // Restore the module mesh color
          this.restoreModuleMesh(this.player, target.instanceId);
          this.waveAnnouncement = `Repairing ${getModuleDefinition(target.definitionId).displayName}`;
        }
      }
    }
  }

  private restoreModuleMesh(ship: RuntimeShip, instanceId: string): void {
    for (const key of Array.from(ship.moduleMeshes.keys())) {
      if (key.startsWith(instanceId + ':')) {
        const mesh = ship.moduleMeshes.get(key);
        if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          const def = getModuleDefinition(
            ship.moduleStates.find((m) => m.instanceId === instanceId)?.definitionId ?? '',
          );
          mesh.material.color.set(def.color);
          mesh.material.emissive.set(def.color);
          mesh.material.emissiveIntensity = 0.08;
          mesh.material.opacity = 1;
          mesh.material.transparent = false;
        }
      }
    }
  }

  private updateProtectedAllies(dt: number): void {
    for (const ally of this.ships.filter((ship) => ship.protectedTarget && ship.alive)) {
      const next = advanceProtectedAlly(
        {
          x: ally.position.x,
          z: ally.position.z,
          speed: Math.max(1.8, ally.stats.thrust / 120),
        },
        {
          x: ESCORT_EXTRACTION_POINT.x,
          z: ESCORT_EXTRACTION_POINT.z,
        },
        dt,
      );

      const movement = new THREE.Vector3(next.x - ally.position.x, 0, next.z - ally.position.z);
      ally.position.set(next.x, ally.position.y, next.z);
      ally.velocity.copy(movement.multiplyScalar(1 / Math.max(dt, 0.001)));
      if (ally.velocity.lengthSq() > 0.0001) {
        ally.rotation = lerpAngle(ally.rotation, Math.atan2(ally.velocity.x, ally.velocity.z), Math.min(1, dt * 4));
      }
      this.clampToArena(ally.position);
      this.syncShipTransform(ally);
    }
  }

  private updateEnemies(dt: number): void {
    const livingEnemies = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive);
    const totalLiving = livingEnemies.length;

    for (let ei = 0; ei < livingEnemies.length; ei++) {
      const enemy = livingEnemies[ei];
      const target = this.getEnemyPriorityTarget(enemy);
      const toTarget = target.position.clone().sub(enemy.position);
      const distance = toTarget.length();
      const direction = toTarget.clone().normalize();
      const side = new THREE.Vector3(-direction.z, 0, direction.x);

      // ── Tactical AI evaluation ──
      const totalModules = enemy.blueprint.modules.length;
      const destroyedModules = enemy.moduleStates.filter((m) => m.destroyed).length;
      const ctx: TacticalContext = {
        ownHpRatio: enemy.hp / Math.max(1, enemy.stats.maxHp),
        ownShieldRatio: enemy.maxShield > 0 ? enemy.shield / enemy.maxShield : 0,
        ownShieldMax: enemy.maxShield,
        moduleLossRatio: totalModules > 0 ? destroyedModules / totalModules : 0,
        distanceToTarget: distance,
        preferredRange: enemy.preferredRange,
        hasMissiles: enemy.weapons.some((w) => w.archetype === 'missile'),
        hasBeam: enemy.weapons.some((w) => w.archetype === 'beam'),
        allyCount: totalLiving - 1,
        engineIntact: enemy.moduleStates.some((m) => m.category === 'engine' && !m.destroyed),
        targetHpRatio: target.hp / Math.max(1, target.stats.maxHp),
        weaponCount: enemy.weapons.length,
      };

      const stance = evaluateStance(ctx);
      const flankSeed = computeFlankSeed(ei, totalLiving);
      const decision: TacticalDecision = computeTacticalDecision(stance, ctx, flankSeed);

      // ── Ability usage (enemies) ──
      if (decision.abilityToUse) {
        activateAbility(enemy.abilities, decision.abilityToUse);
      }

      // ── Movement based on stance ──
      const targetRotation = Math.atan2(target.position.x - enemy.position.x, target.position.z - enemy.position.z);

      // Retreating enemies face AWAY from target
      const faceTarget = stance === 'retreating' ? targetRotation + Math.PI : targetRotation;
      const rotationSpeed = stance === 'retreating' ? 6 : 4;
      enemy.rotation = lerpAngle(enemy.rotation, faceTarget, Math.min(1, dt * rotationSpeed));

      const rangeError = distance - decision.desiredDistance;
      const advance = THREE.MathUtils.clamp(rangeError * 0.5, -3.5, 3.5);

      // Lateral movement: flank spread + organic drift
      const baseDrift = Math.sin(performance.now() * 0.0008 + ei * 2.7) * 1.2;
      const lateralThrust = (decision.lateralBias * 2.5 + baseDrift);

      const effectiveThrust = getEffectiveThrust(
        Math.max(3.5, enemy.stats.thrust / 80),
        enemy.powerFactor,
        enemy.heat,
        enemy.stats.heatCapacity,
      ) * (isAfterburning(enemy.abilities) ? 1.8 : 1) * (enemy.affixThrustMult ?? 1);

      // Hazard avoidance steering
      const seekConduit = ctx.ownHpRatio < 0.5 && ctx.ownShieldRatio < 0.3;
      const hazardSteer = computeHazardSteering(enemy.position.x, enemy.position.z, this.hazards, seekConduit, true);

      // Aggressive enemies commit harder to forward movement
      const forwardCommit = stance === 'aggressive' ? 0.45 : stance === 'retreating' ? 0.25 : 0.35;

      enemy.velocity.addScaledVector(direction, advance * effectiveThrust * dt * forwardCommit);
      enemy.velocity.addScaledVector(side, lateralThrust * dt * 0.7);
      enemy.velocity.x += hazardSteer.x * dt;
      enemy.velocity.z += hazardSteer.z * dt;
      enemy.velocity.multiplyScalar(stance === 'retreating' ? 0.988 : 0.982);
      enemy.position.addScaledVector(enemy.velocity, dt);
      this.clampToArena(enemy.position);

      // ── Firing based on urgency ──
      const effectiveRange = Math.max(enemy.stats.weaponRange / 32, enemy.preferredRange + 4);
      if (distance <= effectiveRange && Math.random() < decision.fireUrgency) {
        // Cautious/retreating enemies have more aim jitter
        const jitterScale = stance === 'cautious' || stance === 'retreating'
          ? enemy.fireJitter * 1.6
          : enemy.fireJitter;
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * jitterScale,
          0,
          (Math.random() - 0.5) * jitterScale,
        );
        this.tryFire(enemy, target.position.clone().add(jitter).sub(enemy.position).normalize());
      }

      this.syncShipTransform(enemy);
    }
  }

  private tryFire(ship: RuntimeShip, direction: THREE.Vector3): void {
    if (!ship.alive || ship.weapons.length === 0) return;
    if (ship.cooldown > 0) return;
    if (isOverheated(ship.heat, ship.stats.heatCapacity * 1.02)) return;

    const weapon = ship.weapons[ship.weaponIndex % ship.weapons.length];
    if (!weapon) return;
    ship.weaponIndex = (ship.weaponIndex + 1) % ship.weapons.length;

    // Mutator: Last Stand fire rate boost
    const lastStand = ship.team === 'player' ? lastStandBonuses(this.activeMutators, this.player.hp / Math.max(1, this.player.stats.maxHp)) : { damageMult: 1, fireRateMult: 1 };
    const cadenceBuff = ship.team === 'player' ? getCadenceMultiplier(this.playerBuffs) * this.upgradeStats.fireRateMultiplier * getOverdriveFireRateMult(this.overdriveState) * lastStand.fireRateMult : (ship.affixFireRateMult ?? 1);
    const effectiveCadence = getEffectiveWeaponCadence(
      Math.max(1 / Math.max(weapon.cooldown, 0.05), 0.25),
      ship.powerFactor,
      ship.heat,
      ship.stats.heatCapacity,
    ) * cadenceBuff;
    if (effectiveCadence <= 0.05) return;

    const normalizedDirection = direction.clone().normalize();
    const momentumMult = ship.team === 'player' ? momentumDamageMult(this.activeMutators, ship.velocity.length()) : 1;
    const buffMultiplier = ship.team === 'player' ? getDamageMultiplier(this.playerBuffs) * this.upgradeStats.damageMultiplier * getOverdriveDamageMult(this.overdriveState) * lastStand.damageMult * momentumMult : (ship.affixDamageMult ?? 1);
    const damage = Math.max(4, weapon.damage * ship.powerFactor * buffMultiplier);

    if (weapon.archetype === 'beam') {
      this.fireBeam(ship, normalizedDirection, weapon, damage);
      playBeam();
      ship.cooldown = weapon.cooldown;
      ship.heat = Math.min(ship.stats.heatCapacity * 1.4, ship.heat + weapon.heat);
      return;
    }

    const projectile = this.projectiles.find((candidate) => !candidate.active);
    if (!projectile) return;

    const spread = weapon.spread;
    const spreadDirection = normalizedDirection
      .add(new THREE.Vector3((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread))
      .normalize();

    projectile.active = true;
    projectile.team = ship.team;
    projectile.archetype = weapon.archetype;
    projectile.damage = damage;
    projectile.damageType = weapon.damageType as DamageType;
    projectile.armorPenetration = weapon.armorPenetration;
    projectile.ttl = weapon.archetype === 'missile' ? 3.8 : 2.2;
    projectile.turnRate = weapon.archetype === 'missile' ? 2.8 : 0;
    projectile.target = weapon.archetype === 'missile' ? this.findNearestEnemy(ship) : null;
    projectile.velocity.copy(spreadDirection.multiplyScalar(Math.max(weapon.projectileSpeed + (ship.team === 'player' ? this.upgradeStats.projectileSpeedBonus : 0), 8)));
    projectile.mesh.visible = true;
    projectile.mesh.position.copy(computeProjectileSpawnPosition(ship.position, spreadDirection, ship.radius));
    projectile.mesh.scale.setScalar(weapon.archetype === 'missile' ? 1.5 : weapon.archetype === 'laser' ? 0.9 : 1.1);
    (projectile.mesh.material as THREE.MeshBasicMaterial).color.set(getProjectileColor(ship.team, weapon.archetype));

    ship.cooldown = 1 / effectiveCadence;
    ship.heat = Math.min(ship.stats.heatCapacity * 1.4, ship.heat + weapon.heat);
    if (weapon.archetype === 'missile') playMissile();
    else if (weapon.archetype === 'laser') playLaser();
    else playShoot();
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        this.deactivateProjectile(projectile);
        continue;
      }

      if (projectile.archetype === 'missile' && projectile.target?.alive) {
        const desired = projectile.target.position.clone().sub(projectile.mesh.position).normalize();
        const speed = projectile.velocity.length();
        const current = projectile.velocity.clone().normalize();
        current.lerp(desired, Math.min(1, dt * projectile.turnRate));
        projectile.velocity.copy(current.normalize().multiplyScalar(speed));
      }

      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      if (projectile.mesh.position.length() > MAX_WORLD_RADIUS) {
        this.deactivateProjectile(projectile);
        continue;
      }

      // Hazard collision: asteroids absorb projectiles
      let hitAsteroid = false;
      for (let hi = 0; hi < this.hazards.length; hi++) {
        if (checkProjectileAsteroidCollision(projectile.mesh.position.x, projectile.mesh.position.z, this.hazards[hi])) {
          this.hazards[hi] = damageAsteroid(this.hazards[hi], projectile.damage);
          this.deactivateProjectile(projectile);
          hitAsteroid = true;
          break;
        }
      }
      if (hitAsteroid) continue;

      // Hazard boost: projectiles passing through nebulas get 15% damage boost
      for (const hazard of this.hazards) {
        if (checkProjectileNebulaBoost(projectile.mesh.position.x, projectile.mesh.position.z, hazard)) {
          projectile.damage *= 1.15;
          break; // only apply once
        }
      }

      let hit = false;
      for (const drone of this.drones) {
        if (!drone.state.active || drone.state.team === projectile.team) continue;
        const distance = Math.hypot(projectile.mesh.position.x - drone.state.x, projectile.mesh.position.z - drone.state.z);
        if (distance <= 0.45) {
          drone.state = applyDroneDamage(drone.state, projectile.damage);
          drone.mesh.visible = drone.state.active;
          this.deactivateProjectile(projectile);
          this.waveAnnouncement = `${projectile.team === 'player' ? 'Enemy drone hit' : 'Support drone hit'}`;
          hit = true;
          break;
        }
      }
      if (hit) continue;

      for (const ship of this.ships) {
        if (!ship.alive || ship.team === projectile.team) continue;
        const distance = projectile.mesh.position.distanceTo(ship.position);
        if (distance <= ship.radius * 0.45) {
          const hitAngle = Math.atan2(
            projectile.mesh.position.x - ship.position.x,
            projectile.mesh.position.z - ship.position.z,
          );
          this.applyDamage(ship, projectile.damage, projectile.damageType, projectile.armorPenetration, hitAngle);
          this.deactivateProjectile(projectile);
          break;
        }
      }
    }
  }

  private updateDrones(dt: number): void {
    const targets: DroneTarget[] = this.ships.map((ship) => ({
      id: ship.id,
      x: ship.position.x,
      z: ship.position.z,
      team: ship.team,
      alive: ship.alive,
    }));

    for (const drone of this.drones) {
      const owner = this.ships.find((ship) => ship.id === drone.ownerId);
      if (!owner || !owner.alive) {
        drone.mesh.visible = false;
        drone.state.active = false;
        continue;
      }

      drone.state = advanceDrone(drone.state, { x: owner.position.x, z: owner.position.z }, dt);

      if (!drone.state.active) {
        drone.mesh.visible = false;
        if (drone.state.respawnRemaining <= 0) {
          drone.state = relaunchDrone(drone.state, { x: owner.position.x, z: owner.position.z });
          drone.mesh.visible = true;
          this.waveAnnouncement = `${owner.team === 'player' ? 'Support drone relaunched' : 'Enemy drone relaunched'}`;
        }
        continue;
      }

      drone.mesh.visible = true;
      drone.mesh.position.set(drone.state.x, 0.35, drone.state.z);
      const target = chooseDroneTarget(drone.state, targets);
      if (target && drone.state.cooldown <= 0) {
        const victim = this.ships.find((ship) => ship.id === target.id && ship.alive);
        if (victim) {
          const hitAngle = Math.atan2(
            this.drones.find((d) => d.ownerId === owner.id)?.state.x ?? 0 - victim.position.x,
            (this.drones.find((d) => d.ownerId === owner.id)?.state.z ?? 0) - victim.position.z,
          );
          this.applyDamage(victim, drone.state.damage * 0.35, 'energy', 0, hitAngle);
          drone.state.cooldown = 1 / drone.state.fireRate;
          this.waveAnnouncement = `${owner.team === 'player' ? 'Support drones engaging' : 'Enemy drones attacking'}`;
        }
      }
    }
  }

  private spawnDronesForShip(ship: RuntimeShip): void {
    const profiles = buildDroneProfiles(ship.blueprint);
    const instances = createDroneInstances(profiles, { x: ship.position.x, z: ship.position.z }, ship.team);
    const droneTexture = new THREE.TextureLoader().load('/generated/drone-support-topdown.jpg');
    droneTexture.colorSpace = THREE.SRGBColorSpace;
    for (const instance of instances) {
      const material = new THREE.SpriteMaterial({
        map: droneTexture,
        color: ship.team === 'player' ? '#ffffff' : '#ffb3dc',
        transparent: true,
      });
      const mesh = new THREE.Sprite(material);
      mesh.scale.set(1.35, 1.35, 1.35);
      mesh.position.set(ship.position.x, 0.45, ship.position.z);
      this.scene.add(mesh);
      this.drones.push({ ownerId: ship.id, mesh: mesh as unknown as THREE.Mesh, state: instance });
    }
  }

  private fireBeam(ship: RuntimeShip, direction: THREE.Vector3, weapon: WeaponProfile, damage: number): void {
    let bestTarget: RuntimeShip | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.ships) {
      if (!candidate.alive || candidate.team === ship.team) continue;
      const toTarget = candidate.position.clone().sub(ship.position);
      const distance = toTarget.length();
      if (distance > weapon.range / 30) continue;
      const alignment = direction.dot(toTarget.normalize());
      if (alignment < 0.96) continue;
      if (distance < bestDistance) {
        bestTarget = candidate;
        bestDistance = distance;
      }
    }

    if (bestTarget) {
      const hitAngle = Math.atan2(
        ship.position.x - bestTarget.position.x,
        ship.position.z - bestTarget.position.z,
      );
      this.applyDamage(bestTarget, damage * 0.85, weapon.damageType as DamageType, weapon.armorPenetration, hitAngle);
      this.spawnBeamVisual(ship.position, bestTarget.position, ship.team);
      this.spawnImpactVisual(bestTarget.position, ship.team === 'player' ? '#5eead4' : '#fca5a5');
      this.waveAnnouncement = `${ship.team === 'player' ? 'Beam strike' : 'Enemy beam'} connected`;
    }
  }

  private applyDamage(ship: RuntimeShip, rawDamage: number, damageType: DamageType, armorPenetration: number, hitAngle: number): void {
    // Player is invulnerable during dash
    if (ship.team === 'player' && isInvulnerable(this.dashState)) return;
    const result: DamageResult = resolveDamage(
      rawDamage,
      damageType,
      armorPenetration,
      ship.shield,
      ship.stats.armorRating,
      ship.stats.kineticBypass,
      ship.stats.energyVulnerability,
    );

    ship.shield -= result.shieldAbsorbed;
    ship.heat = Math.min(ship.stats.heatCapacity * 1.25, ship.heat + rawDamage * 0.08);
    playHit();
    // Run stat tracking
    if (this.isEndlessMode) {
      if (ship.team === 'player') this.runStats.damageTaken += result.hullDamage;
      else this.runStats.damageDealt += result.hullDamage;
    }

    if (result.shieldAbsorbed > 0) {
      this.spawnImpactVisual(ship.position, ship.team === 'player' ? '#38bdf8' : '#f9a8d4');
      this.particles.emit(ParticleSystem.shieldAbsorb(ship.position, ship.team === 'player' ? '#38bdf8' : '#f9a8d4'));
    }

    // Route hull damage through module system
    if (result.hullDamage > 0) {
      if (result.shieldAbsorbed <= 0) {
        this.spawnImpactVisual(ship.position, ship.team === 'player' ? '#f59e0b' : '#fb7185');
        this.particles.emit(ParticleSystem.hitSpark(ship.position, ship.team === 'player' ? '#f59e0b' : '#fb7185'));
      }

      // Screen shake when player takes hull damage
      if (ship.team === 'player' && !this.screenShake) {
        const shakeIntensity = Math.min(0.6, result.hullDamage / ship.stats.maxHp * 3);
        if (shakeIntensity > 0.05) {
          this.screenShake = createScreenShake(shakeIntensity, 0.25);
        }
      }

      const destroyed = damageModules(ship.moduleStates, result.hullDamage, hitAngle, 0.6);

      // Recalculate effective stats from surviving modules
      const survivingIds = new Set(ship.moduleStates.filter((m) => !m.destroyed).map((m) => m.instanceId));
      const newRawStats = computeStatsFromSurviving(ship.blueprint, survivingIds);
      ship.stats = applyCrewModifiers(newRawStats, ship.blueprint.crew);
      ship.powerFactor = computePowerFactor(ship.stats.powerOutput, ship.stats.powerDemand);
      ship.maxShield = ship.stats.shieldStrength;
      ship.shield = Math.min(ship.shield, ship.maxShield);

      // Rebuild weapon loadout from surviving modules
      const survivingBlueprint: ShipBlueprint = {
        ...ship.blueprint,
        modules: ship.blueprint.modules.filter((m) => survivingIds.has(m.instanceId)),
      };
      ship.weapons = buildWeaponLoadout(survivingBlueprint);
      ship.weaponIndex = 0;

      // Darken destroyed module meshes
      for (const id of destroyed) {
        this.darkenModuleMeshes(ship, id);
        const mod = ship.moduleStates.find((m) => m.instanceId === id);
        if (mod) {
          const def = getModuleDefinition(mod.definitionId);
          this.waveAnnouncement = `${def.displayName} destroyed!`;
          this.particles.emit(ParticleSystem.explosionBurst(ship.position, '#ef4444', 10));
        }
      }

      // Recalculate HP from surviving module HP
      ship.hp = ship.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
    }

    if (ship.hp <= 0) {
      ship.alive = false;
      ship.group.visible = false;
      playExplosion();
      this.spawnExplosionVisual(ship.position, ship.team === 'player' ? '#fca5a5' : '#fb7185');
      // Particle death explosion
      for (const config of ParticleSystem.deathExplosion(ship.position)) {
        this.particles.emit(config);
      }
      // Affix: death explosion — damages nearby ships
      this.handleAffixExplosion(ship);
      // Bigger screen shake for player death
      if (ship.team === 'player') {
        this.screenShake = createScreenShake(0.8, 0.5);
      }

      // Track kills in endless mode
      if (this.isEndlessMode && ship.team === 'enemy') {
        this.endlessTotalKills += 1;
        // Elite credit bonus
        const killedAffixes = this.shipAffixes.get(ship.id);
        const killedIsElite = killedAffixes && killedAffixes.length >= 2;
        if (killedAffixes && killedAffixes.length > 0) {
          this.endlessWaveEliteBonus += Math.floor(10 * eliteCreditsMultiplier(killedAffixes));
        }
        this.shipAffixes.delete(ship.id);
        // Mutator: Vampiric heal
        const heal = vampiricHeal(this.activeMutators, this.player.stats.maxHp);
        if (heal > 0 && this.player.alive) {
          this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + heal);
        }
        // Mutator: Bounty Hunter — refresh ability cooldowns on elite kill
        if (killedIsElite && bountyHunterActive(this.activeMutators)) {
          for (const ability of this.player.abilities) {
            if (ability.cooldownRemaining > 0) ability.cooldownRemaining = 0;
          }
          this.eliteAnnouncement = '🎯 Bounty Hunter — abilities refreshed!';
          this.eliteAnnouncementTimer = 2;
        }
        // Combo system
        const result = registerComboKill(this.comboState);
        this.comboState = result.state;
        // Track run stats
        this.runStats.totalKills += 1;
        if (killedIsElite) this.runStats.eliteKills += 1;
        this.runStats.bestCombo = Math.max(this.runStats.bestCombo, this.comboState.kills);
        if (result.tierUp) this.runStats.highestComboTier = getComboTier(this.comboState.kills).label;
        // Charge overdrive from combo kills (higher tier = more charge)
        const comboTierMult = getComboTier(this.comboState.kills).multiplier;
        this.overdriveState = addOverdriveCharge(this.overdriveState, OVERDRIVE_CHARGE_PER_KILL * comboTierMult);
        if (result.tierUp) {
          this.particles.emit(ParticleSystem.comboBurst(this.player.position, getComboTier(this.comboState.kills).color));
          this.screenShake = createScreenShake(0.25, 0.2);
          playComboTier();
        }
      }

      // Drop pickup on enemy kill
      if (ship.team === 'enemy') {
        const pickupKind = rollPickupDrop(ship.radius, this.currentWave);
        if (pickupKind) {
          this.spawnPickup(pickupKind, ship.position.x, ship.position.z);
        }
      }
    }
  }

  private darkenModuleMeshes(ship: RuntimeShip, instanceId: string): void {
    const destroyedColor = new THREE.Color('#1e1e1e');
    for (const key of Array.from(ship.moduleMeshes.keys())) {
      if (key.startsWith(instanceId + ':')) {
        const mesh = ship.moduleMeshes.get(key);
        if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.copy(destroyedColor);
          mesh.material.emissive.set(0x000000);
          mesh.material.opacity = 0.5;
          mesh.material.transparent = true;
        }
      }
    }
  }

  private getProtectedAlly(): RuntimeShip | null {
    return this.ships.find((ship) => ship.protectedTarget && ship.alive) ?? null;
  }

  private getProtectedEscortProgress(): number {
    const ally = this.getProtectedAlly();
    if (!ally?.escortOrigin) {
      return 0;
    }

    return computeEscortProgress(
      { x: ally.escortOrigin.x, z: ally.escortOrigin.z },
      { x: ally.position.x, z: ally.position.z },
      { x: ESCORT_EXTRACTION_POINT.x, z: ESCORT_EXTRACTION_POINT.z },
    );
  }

  private getEnemyPriorityTarget(enemy: RuntimeShip): RuntimeShip {
    const protectedAlly = this.getProtectedAlly();
    const target = chooseEnemyPriorityTarget(
      { x: enemy.position.x, z: enemy.position.z },
      { id: this.player.id, x: this.player.position.x, z: this.player.position.z },
      protectedAlly ? { id: protectedAlly.id, x: protectedAlly.position.x, z: protectedAlly.position.z } : null,
    );
    return target.id === this.player.id ? this.player : protectedAlly ?? this.player;
  }

  private findNearestEnemy(source: RuntimeShip): RuntimeShip | null {
    let best: RuntimeShip | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.ships) {
      if (!candidate.alive || candidate.team === source.team) continue;
      const distance = candidate.position.distanceTo(source.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  }

  private spawnBeamVisual(start: THREE.Vector3, end: THREE.Vector3, team: 'player' | 'enemy'): void {
    const effect = createBeamEffect(start.clone().setY(0.42), end.clone().setY(0.42), team === 'player' ? '#5eead4' : '#fca5a5');
    const points = [effect.start, effect.end ?? effect.start.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: effect.color, transparent: true, opacity: effect.opacity });
    const line = new THREE.Line(geometry, material);
    this.effectGroup.add(line);
    this.effects.push({ state: effect, object: line });
  }

  private spawnImpactVisual(position: THREE.Vector3, color: string): void {
    const effect = createImpactEffect(position.clone().setY(0.35), color);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: effect.color, transparent: true, opacity: effect.opacity }));
    sprite.position.copy(effect.start);
    sprite.scale.set(effect.scale, effect.scale, effect.scale);
    this.effectGroup.add(sprite);
    this.effects.push({ state: effect, object: sprite });
  }

  private spawnExplosionVisual(position: THREE.Vector3, color: string): void {
    const effect = createExplosionEffect(position.clone().setY(0.45), color);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: effect.color, transparent: true, opacity: effect.opacity }));
    sprite.position.copy(effect.start);
    sprite.scale.set(effect.scale, effect.scale, effect.scale);
    this.effectGroup.add(sprite);
    this.effects.push({ state: effect, object: sprite });
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const runtime = this.effects[i];
      runtime.state = advanceEffect(runtime.state, dt);
      const progress = runtime.state.ttl <= 0 ? 1 : runtime.state.age / runtime.state.ttl;

      if ('material' in runtime.object && runtime.object.material) {
        const material = runtime.object.material as THREE.Material & { opacity?: number };
        if ('opacity' in material && typeof material.opacity === 'number') {
          material.opacity = runtime.state.opacity;
        }
      }

      runtime.object.position.copy(runtime.state.start);
      runtime.object.scale.set(runtime.state.scale, runtime.state.scale, runtime.state.scale);

      if (runtime.state.kind === 'beam' && runtime.object instanceof THREE.Line) {
        const points = [runtime.state.start, runtime.state.end ?? runtime.state.start.clone()];
        runtime.object.geometry.dispose();
        runtime.object.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }

      if (progress >= 1 || runtime.state.opacity <= 0) {
        this.effectGroup.remove(runtime.object);
        if ('geometry' in runtime.object && runtime.object.geometry) {
          (runtime.object.geometry as THREE.BufferGeometry).dispose();
        }
        if ('material' in runtime.object && runtime.object.material) {
          const material = runtime.object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach((entry: THREE.Material) => entry.dispose());
          else material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }

  private coolShips(dt: number): void {
    for (const ship of this.ships) {
      ship.cooldown = Math.max(0, ship.cooldown - dt);
      const cooling = computeCoolingPerSecond(Math.max(2, ship.stats.cooling * 80), ship.powerFactor);
      ship.heat = Math.max(0, ship.heat - cooling * dt);
      ship.shield = rechargeShield(
        ship.shield,
        ship.maxShield,
        ship.stats.shieldRecharge * (isShieldBoosted(ship.abilities) ? 2 : 1),
        dt,
      );
      // Affix: HP regeneration (5% max HP per second)
      const affixData = this.shipAffixData.get(ship.id);
      if (affixData?.regeneratesHp && ship.alive && ship.hp < ship.stats.maxHp) {
        ship.hp = Math.min(ship.stats.maxHp, ship.hp + ship.stats.maxHp * 0.05 * dt);
      }
    }
  }

  private updateEncounterState(): void {
    const remainingEnemies = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive).length;
    const protectedAlive = this.ships.every((ship) => !ship.protectedTarget || ship.alive);
    const convoyProgress = this.getProtectedEscortProgress();

    if (this.encounterObjective.type === 'survive' || this.encounterObjective.type === 'protect_ally') {
      this.encounterOutcome = evaluateObjective(this.encounterObjective, {
        elapsedSeconds: this.elapsedEncounterSeconds,
        remainingEnemies,
        playerAlive: this.player.alive,
        protectedAlive,
        extractionProgress: convoyProgress,
      });

      if (this.encounterOutcome === 'victory') {
        this.waveAnnouncement = this.encounterObjective.type === 'survive'
          ? 'Survival objective complete'
          : `Convoy secured · extraction ${(convoyProgress * 100).toFixed(0)}%`;
        if (!this.hasGrantedReward) {
          const totalEnemies = this.waves.reduce((sum, wave) => sum + wave.enemies.length, 0);
          this.onReward(this.encounterId, createEncounterReward(this.waves.length, totalEnemies, true));
          this.hasGrantedReward = true;
        }
      } else if (this.encounterOutcome === 'defeat') {
        this.waveAnnouncement = this.encounterObjective.type === 'protect_ally'
          ? 'Protected ship lost'
          : 'Player ship disabled';
      } else if (this.encounterObjective.type === 'survive') {
        const remaining = Math.max(0, Math.ceil((this.encounterObjective.durationSeconds ?? 0) - this.elapsedEncounterSeconds));
        this.waveAnnouncement = `${this.encounterObjective.label} (${remaining}s)`;
      } else if (this.encounterObjective.type === 'protect_ally') {
        if (remainingEnemies <= 0) {
          this.waveAnnouncement = `Hostiles cleared · escort the convoy to extraction (${(convoyProgress * 100).toFixed(0)}%)`;
        } else {
          this.waveAnnouncement = `${this.encounterObjective.label} · convoy ${(convoyProgress * 100).toFixed(0)}% · hostiles ${remainingEnemies}`;
        }
      }

      if (this.encounterObjective.type === 'protect_ally' && this.encounterOutcome === 'continue') {
        const waveState: EncounterState = {
          currentWave: this.currentWave,
          totalWaves: this.waves.length,
          remainingEnemies,
          playerAlive: this.player.alive,
        };
        const waveProgress = advanceEncounterState(waveState);
        if (waveProgress.shouldSpawnWave && this.waveDelay <= 0) {
          this.currentWave = waveProgress.nextWave;
          this.waveDelay = WAVE_RESPAWN_DELAY;
          this.waveAnnouncement = `${this.waves[this.currentWave - 1]?.name ?? 'Wave'} incoming...`;
        }
      }
      return;
    }

    const state: EncounterState = {
      currentWave: this.currentWave,
      totalWaves: this.isEndlessMode ? this.currentWave + 1 : this.waves.length,
      remainingEnemies,
      playerAlive: this.player.alive,
    };
    const progress = advanceEncounterState(state);
    this.encounterOutcome = progress.outcome;

    if (progress.shouldSpawnWave && this.waveDelay <= 0) {
      this.currentWave = progress.nextWave;
      this.waveDelay = WAVE_RESPAWN_DELAY;

      // Track kills from cleared waves in endless mode
      if (this.isEndlessMode) {
        this.endlessBestWave = this.currentWave - 1;
        // Track run stats
        this.runStats.waveReached = this.currentWave - 1;
        this.runStats.score = this.endlessScore;
        this.runStats.creditsEarned = this.endlessCredits;
        this.runStats.timeSeconds = this.elapsedEncounterSeconds;
        this.endlessScore += endlessWaveScore(this.currentWave - 1) + this.comboState.totalComboScore;
        // Grant credits for each wave cleared, multiplied by combo
        const comboMult = getComboCreditMultiplier(this.comboState.kills);
        const waveCredits = Math.floor(endlessWaveCredits(this.currentWave - 1) * comboMult) + this.endlessWaveEliteBonus;
        this.endlessWaveEliteBonus = 0;
        this.endlessCredits += waveCredits;
        this.onReward(this.encounterId, { credits: waveCredits, score: this.endlessScore, victory: true });
        // Reset combo score bank after applying (combo streak itself persists across waves)
        this.comboState = { ...this.comboState, totalComboScore: 0 };
        // Open upgrade shop instead of immediately spawning next wave
        this.openUpgradeShop(this.currentWave);
      }

      this.waveAnnouncement = this.isEndlessMode
        ? `Wave ${this.currentWave} incoming...`
        : `Wave ${this.currentWave} incoming...`;
    }

    // Endless mode: never declare victory, just keep going
    if (progress.outcome === 'victory' && this.isEndlessMode) {
      // This means all preset waves cleared (shouldn't happen in endless, but guard)
      this.encounterOutcome = 'continue';
      return;
    }

    if (progress.outcome === 'victory') {
      this.waveAnnouncement = 'All waves cleared';
      if (!this.hasGrantedReward) {
        const totalEnemies = this.waves.reduce((sum, wave) => sum + wave.enemies.length, 0);
        this.onReward(this.encounterId, createEncounterReward(this.waves.length, totalEnemies, true));
        this.hasGrantedReward = true;
      }
    }
    if (progress.outcome === 'defeat') {
      if (this.isEndlessMode) {
        // Count enemies killed this wave
        const waveEnemies = this.waves[this.currentWave - 1]?.enemies.length ?? 0;
        this.endlessScore += endlessWaveScore(this.currentWave);
        this.waveAnnouncement = `Wave ${this.currentWave} · defeated after ${this.endlessTotalKills} kills`;
      } else {
        this.waveAnnouncement = 'Player ship disabled';
      }
    }
  }

  private updateWaveDelay(dt: number): void {
    if (this.waveDelay <= 0) return;
    this.waveDelay = Math.max(0, this.waveDelay - dt);
    if (this.waveDelay === 0) {
      this.spawnWave(this.currentWave);
    }
  }

  private deactivateProjectile(projectile: Projectile): void {
    projectile.active = false;
    projectile.mesh.visible = false;
    projectile.ttl = 0;
  }

  private syncShipTransform(ship: RuntimeShip): void {
    ship.group.position.copy(ship.position);
    ship.group.rotation.y = ship.rotation;
  }

  private updateCameraFollow(dt: number): void {
    const target = new THREE.Vector3(
      this.player.position.x,
      20,
      this.player.position.z + 0.001,
    );
    this.camera.position.lerp(target, Math.min(1, dt * 5));
    const lookTarget = new THREE.Vector3(
      this.player.position.x,
      0,
      this.player.position.z,
    );
    this.camera.lookAt(lookTarget);
  }

  private ensureHealthBar(ship: RuntimeShip): { bg: THREE.Mesh; fg: THREE.Mesh; shieldBg: THREE.Mesh; shieldFg: THREE.Mesh } {
    let bar = this.shipHealthBars.get(ship.id);
    if (bar) return bar;
    const barWidth = ship.radius * 1.6;
    const barHeight = 0.22;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight),
      new THREE.MeshBasicMaterial({ color: '#1e293b', transparent: true, opacity: 0.85 }),
    );
    bg.rotation.x = -Math.PI / 2;
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight),
      new THREE.MeshBasicMaterial({ color: ship.team === 'player' ? '#4ade80' : '#f87171' }),
    );
    fg.rotation.x = -Math.PI / 2;
    const shieldBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight * 0.7),
      new THREE.MeshBasicMaterial({ color: '#0c2d48', transparent: true, opacity: 0.7 }),
    );
    shieldBg.rotation.x = -Math.PI / 2;
    const shieldFg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight * 0.7),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.85 }),
    );
    shieldFg.rotation.x = -Math.PI / 2;
    this.healthBarGroup.add(bg, fg, shieldBg, shieldFg);
    bar = { bg, fg, shieldBg, shieldFg };
    this.shipHealthBars.set(ship.id, bar);
    return bar;
  }

  private updateHealthBars(): void {
    for (const ship of this.ships) {
      if (!ship.alive) {
        const existing = this.shipHealthBars.get(ship.id);
        if (existing) {
          this.healthBarGroup.remove(existing.bg, existing.fg, existing.shieldBg, existing.shieldFg);
          existing.bg.geometry.dispose();
          existing.fg.geometry.dispose();
          existing.shieldBg.geometry.dispose();
          existing.shieldFg.geometry.dispose();
          this.shipHealthBars.delete(ship.id);
        }
        continue;
      }
      const bar = this.ensureHealthBar(ship);
      const barWidth = ship.radius * 1.6;
      const y = ship.position.y + ship.radius + 0.8;

      // Shield bar (above hull bar)
      const shieldY = y + 0.28;
      bar.shieldBg.position.set(ship.position.x, shieldY, ship.position.z);
      const shieldRatio = ship.maxShield > 0 ? Math.max(0, ship.shield) / ship.maxShield : 0;
      const shieldHalfFilled = (barWidth * shieldRatio) / 2;
      bar.shieldFg.position.set(
        ship.position.x - barWidth / 2 + shieldHalfFilled,
        shieldY + 0.01,
        ship.position.z,
      );
      bar.shieldFg.scale.x = shieldRatio;
      bar.shieldFg.visible = ship.maxShield > 0;
      bar.shieldBg.visible = ship.maxShield > 0;

      // Hull bar
      bar.bg.position.set(ship.position.x, y, ship.position.z);
      const hpRatio = Math.max(0, ship.hp) / Math.max(1, ship.stats.maxHp);
      const halfFilled = (barWidth * hpRatio) / 2;
      bar.fg.position.set(
        ship.position.x - barWidth / 2 + halfFilled,
        y + 0.01,
        ship.position.z,
      );
      bar.fg.scale.x = hpRatio;
    }
  }

  private clearHealthBars(): void {
    for (const pair of Array.from(this.shipHealthBars.entries())) {
      const bar = pair[1];
      this.healthBarGroup.remove(bar.bg, bar.fg, bar.shieldBg, bar.shieldFg);
      bar.bg.geometry.dispose();
      bar.fg.geometry.dispose();
      bar.shieldBg.geometry.dispose();
      bar.shieldFg.geometry.dispose();
    }
    this.shipHealthBars.clear();
  }

  private clampToArena(position: THREE.Vector3): void {
    if (position.length() <= ARENA_RADIUS - 1) return;
    position.setLength(ARENA_RADIUS - 1);
  }

  private updateMinimap(): void {
    const ctx = this.minimapCtx;
    const canvas = this.minimapCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (w / 2 - 8) / ARENA_RADIUS;

    ctx.clearRect(0, 0, w, h);

    // Dark background with subtle radial gradient
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    bg.addColorStop(0, 'rgba(8, 20, 36, 0.6)');
    bg.addColorStop(1, 'rgba(2, 6, 23, 0.9)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    // Arena boundary ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, ARENA_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ARENA_RADIUS * scale);
    ctx.lineTo(cx, cy + ARENA_RADIUS * scale);
    ctx.moveTo(cx - ARENA_RADIUS * scale, cy);
    ctx.lineTo(cx + ARENA_RADIUS * scale, cy);
    ctx.stroke();

    // Weapon range circle
    if (this.player.alive) {
      const rangeRadius = Math.max(1, this.player.stats.weaponRange / 32) * scale;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, rangeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Extraction point for escort missions
    if (this.encounterObjective.type === 'protect_ally') {
      const ex = cx + ESCORT_EXTRACTION_POINT.x * scale;
      const ey = cy + ESCORT_EXTRACTION_POINT.z * scale;
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.15)';
      ctx.fill();
    }

    // Drones
    for (const drone of this.drones) {
      if (!drone.state.active) continue;
      const dx = cx + drone.state.x * scale;
      const dy = cy + drone.state.z * scale;
      ctx.fillStyle = drone.state.team === 'player' ? 'rgba(147, 197, 253, 0.7)' : 'rgba(251, 113, 133, 0.7)';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hazards
    for (const hazard of this.hazards) {
      if (!hazard.active) continue;
      const hx = cx + hazard.x * scale;
      const hy = cy + hazard.z * scale;
      const hr = hazard.radius * scale;

      if (hazard.kind === 'asteroid') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(2, hr), 0, Math.PI * 2);
        ctx.fill();
        // HP indicator
        const hpRatio = hazard.hp / hazard.maxHp;
        if (hpRatio < 1) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hx, hy, hr + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
          ctx.stroke();
        }
      } else if (hazard.kind === 'shield_conduit') {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.2 + hazard.charge * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(3, hr), 0, Math.PI * 2);
        ctx.stroke();
        // Cross marker
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.3 + hazard.charge * 0.3})`;
        ctx.lineWidth = 1;
        const cr = Math.max(2, hr * 0.4);
        ctx.beginPath();
        ctx.moveTo(hx - cr, hy); ctx.lineTo(hx + cr, hy);
        ctx.moveTo(hx, hy - cr); ctx.lineTo(hx, hy + cr);
        ctx.stroke();
      } else if (hazard.kind === 'damage_nebula') {
        const pulse = 0.7 + 0.3 * Math.sin(hazard.pulsePhase);
        ctx.fillStyle = `rgba(168, 85, 247, ${0.08 * pulse})`;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(3, hr), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.2 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(3, hr), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Pickups
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      const px = cx + pickup.x * scale;
      const py = cy + pickup.z * scale;
      const fadeAlpha = pickup.ttl < 3 ? pickup.ttl / 3 : 1;
      // Parse hex color to rgba for canvas
      const hex = getPickupColor(pickup.kind);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.6 * fadeAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 * fadeAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ships
    for (const ship of this.ships) {
      if (!ship.alive) continue;
      const sx = cx + ship.position.x * scale;
      const sy = cy + ship.position.z * scale;

      if (ship.id === this.player.id) {
        // Player: white triangle with heading
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-ship.rotation);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(-5, 5);
        ctx.lineTo(5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Shield ring around player
        if (ship.maxShield > 0 && ship.shield > 0) {
          const shieldRatio = ship.shield / ship.maxShield;
          const shieldR = ship.radius * scale * 0.6;
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.3 + shieldRatio * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, shieldR, 0, Math.PI * 2 * shieldRatio);
          ctx.stroke();
        }
      } else if (ship.team === 'enemy') {
        // Enemy: dot with HP ring, colored for affixes
        const hpRatio = ship.hp / Math.max(1, ship.stats.maxHp);
        const shipAffixes = this.shipAffixes.get(ship.id);
        const hasAffixes = shipAffixes && shipAffixes.length > 0;
        const elite = hasAffixes && isElite(shipAffixes!);
        const affixColor = hasAffixes ? getAffixColor(shipAffixes!) : null;

        // Parse affix color for canvas
        let affixR = 248, affixG = 113, affixB = 113;
        if (affixColor) {
          affixR = parseInt(affixColor.slice(1, 3), 16);
          affixG = parseInt(affixColor.slice(3, 5), 16);
          affixB = parseInt(affixColor.slice(5, 7), 16);
        }

        const r = elite ? 5 : 4;
        ctx.fillStyle = `rgba(${affixR}, ${affixG}, ${affixB}, ${0.5 + hpRatio * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Elite pulsing outer ring
        if (elite) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
          ctx.strokeStyle = `rgba(${affixR}, ${affixG}, ${affixB}, ${0.2 + pulse * 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // HP ring
        if (hpRatio < 1) {
          ctx.strokeStyle = hpRatio > 0.5
            ? `rgba(${affixR}, ${affixG}, ${affixB}, 0.4)`
            : `rgba(239, 68, 68, 0.6)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
          ctx.stroke();
        }
      } else if (ship.protectedTarget) {
        // Protected ally: cyan diamond
        ctx.fillStyle = 'rgba(103, 232, 249, 0.9)';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();

        // HP indicator
        const hpRatio = ship.hp / Math.max(1, ship.stats.maxHp);
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.4 + hpRatio * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
        ctx.stroke();
      }
    }

    // Outer rim overlay (vignette)
    const rim = ctx.createRadialGradient(cx, cy, w / 2 - 20, cx, cy, w / 2);
    rim.addColorStop(0, 'rgba(2, 6, 23, 0)');
    rim.addColorStop(1, 'rgba(2, 6, 23, 0.7)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private refreshHud(): void {
    const hud = this.uiRoot.querySelector('#flight-hud');

    // When shop is open, replace HUD with upgrade selection UI
    if (this.shopOpen && hud) {
      const restRepair = this.shopWaveCleared > 0 && this.shopWaveCleared % 5 === 0;
      const upgradeCards = this.shopOptions.map((u, i) => {
        const cost = upgradeCost(u, this.shopWaveCleared);
        const canAfford = this.endlessCredits >= cost;
        const rarityColor = getRarityColor(u.rarity);
        return `<div class="upgrade-card" style="border-color:${rarityColor};opacity:${canAfford ? 1 : 0.5}">
          <div style="font-size:1.3em">${u.icon}</div>
          <strong style="color:${rarityColor}">${u.displayName}</strong>
          <small style="color:${rarityColor}">${getRarityLabel(u.rarity)}</small>
          <p style="margin:4px 0">${u.description}</p>
          <button class="primary" data-upgrade="${i}" ${canAfford ? '' : 'disabled'} style="font-size:0.85em">
            ${cost} credits
          </button>
        </div>`;
      }).join('');

      const mutatorCards = this.shopMutatorOptions.map((m, i) => {
        const conflicts = m.conflictsWith?.filter((cid) => hasMutator(this.activeMutators, cid as MutatorId)) ?? [];
        return `<div class="upgrade-card" style="border-color:#c084fc;background:rgba(192,132,252,0.06)">
          <div style="font-size:0.7em;color:#c084fc;margin-bottom:2px">⚠ TRAIT — Free</div>
          <div style="font-size:1.3em">${m.icon}</div>
          <strong style="color:#c084fc">${m.displayName}</strong>
          <p style="margin:4px 0">${m.description}</p>
          <small style="color:#94a3b8;font-style:italic">${m.flavor}</small>
          ${conflicts.length > 0 ? `<p style="color:#f87171;font-size:0.8em;margin-top:4px">⚠ Conflicts with active trait</p>` : ''}
          <button class="primary" data-mutator="${i}" ${conflicts.length > 0 ? 'disabled' : ''} style="font-size:0.85em;background:#7c3aed;border-color:#7c3aed">
            ${conflicts.length > 0 ? 'Unavailable' : 'Take Trait'}
          </button>
        </div>`;
      }).join('');

      const mutatorSlots = `Mutators: ${this.activeMutators.length}/${MAX_MUTATORS}`;

      hud.innerHTML = `
        <div style="text-align:center;margin-bottom:8px">
          <strong style="font-size:1.1em;color:#e2e8f0">⚡ Upgrade Shop — Wave ${this.shopWaveCleared} Cleared</strong>
          ${restRepair ? '<p class="success">🔧 Rest stop: hull partially repaired!</p>' : ''}
        </div>
        ${mutatorCards ? `<div style="text-align:center;margin-bottom:6px"><span style="color:#c084fc;font-size:0.85em;font-weight:600">— Offered Trait —</span></div><div class="upgrade-grid">${mutatorCards}</div>` : ''}
        ${mutatorCards && upgradeCards.length > 0 ? '<div style="text-align:center;margin:8px 0"><span style="color:#64748b">— or —</span></div>' : ''}
        ${upgradeCards.length > 0 ? `<div class="upgrade-grid">${upgradeCards}</div>` : '<p class="muted" style="text-align:center">No upgrades available</p>'}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="color:#fbbf24">💰 ${this.endlessCredits} credits</span>
          <button data-action="skip-upgrade" style="font-size:0.85em">Skip →</button>
        </div>
        <p class="muted" style="margin-top:6px">Upgrades: ${this.purchasedUpgrades.length} · ${mutatorSlots} · Score: ${this.endlessScore.toLocaleString()}</p>
      `;

      // Bind upgrade card buttons
      hud.querySelectorAll('[data-upgrade]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.upgrade ?? '0', 10);
          if (this.shopOptions[idx]) this.purchaseUpgrade(this.shopOptions[idx]);
        });
      });
      hud.querySelector('[data-action="skip-upgrade"]')?.addEventListener('click', () => {
        this.closeUpgradeShop();
      });
      // Bind mutator trait buttons
      hud.querySelectorAll('[data-mutator]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.mutator ?? '0', 10);
          if (this.shopMutatorOptions[idx]) this.purchaseMutator(this.shopMutatorOptions[idx]);
        });
      });
      return;
    }

    const debrief = this.uiRoot.querySelector('#flight-debrief');
    if (!hud) return;
    const enemiesAlive = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive).length;
    const protectedAlly = this.getProtectedAlly();
    const convoyProgress = this.getProtectedEscortProgress();
    const hpRatio = Math.max(0, this.player.hp) / Math.max(1, this.player.stats.maxHp);
    const shieldRatio = this.player.maxShield > 0 ? Math.max(0, this.player.shield) / this.player.maxShield : 0;
    const heatRatio = this.player.heat / Math.max(1, this.player.stats.heatCapacity * 1.15);
    const overheatState = isOverheated(this.player.heat, this.player.stats.heatCapacity * 1.02);
    const crewSummary = Object.entries(this.player.blueprint.crew)
      .map(([role, value]) => `${role[0].toUpperCase()}:${value}`)
      .join(' ');
    const activeDrones = this.drones.filter((drone) => drone.state.team === 'player' && drone.state.active).length;
    const totalDrones = this.player.stats.droneCapacity;
    const convoyStatus = protectedAlly
      ? `${Math.max(0, protectedAlly.hp).toFixed(0)} / ${protectedAlly.stats.maxHp.toFixed(0)}`
      : 'N/A';

    hud.innerHTML = `
      <div class="hud-grid">
        <div><span>Ship</span><strong>${this.player.blueprint.name}</strong></div>
        <div><span>Wave</span><strong>${this.currentWave}${this.isEndlessMode ? '' : ` / ${this.waves.length}`}</strong></div>
        <div><span>Hull</span><strong>${Math.max(0, this.player.hp).toFixed(0)} / ${this.player.stats.maxHp.toFixed(0)}</strong></div>
        ${this.player.maxShield > 0 ? `<div><span>Shield</span><strong>${Math.max(0, this.player.shield).toFixed(0)} / ${this.player.maxShield.toFixed(0)}</strong></div>` : ''}
        <div><span>Heat</span><strong>${this.player.heat.toFixed(0)} / ${this.player.stats.heatCapacity.toFixed(0)}</strong></div>
        <div><span>Power</span><strong>${this.player.powerFactor.toFixed(2)}x</strong></div>
        <div><span>Velocity</span><strong>${this.player.velocity.length().toFixed(1)}</strong></div>
        <div><span>Enemies</span><strong>${enemiesAlive}</strong></div>
        <div><span>Status</span><strong>${overheatState ? 'Overheated' : 'Nominal'}</strong></div>
        <div><span>Drones</span><strong>${activeDrones} / ${totalDrones}</strong></div>
        ${this.encounterObjective.type === 'protect_ally' ? `<div><span>Convoy Hull</span><strong>${convoyStatus}</strong></div>` : ''}
        ${this.encounterObjective.type === 'protect_ally' ? `<div><span>Convoy Progress</span><strong>${(convoyProgress * 100).toFixed(0)}%</strong></div>` : ''}
        ${this.isEndlessMode ? `<div><span>Kills</span><strong>${this.endlessTotalKills}</strong></div>` : ''}
        ${this.isEndlessMode ? `<div><span>Score</span><strong>${this.endlessScore.toLocaleString()}</strong></div>` : ''}
        ${this.isEndlessMode ? `<div><span>Credits</span><strong style="color:#fbbf24">💰 ${this.endlessCredits}</strong></div>` : ''}
        ${this.isEndlessMode && this.purchasedUpgrades.length > 0 ? `<div><span>Upgrades</span><strong>${this.purchasedUpgrades.length}</strong></div>` : ''}
      </div>
      <div class="ability-bar">
        ${this.renderAbilitySlot(this.player.abilities[0], '1', '🛡')}
        ${this.renderAbilitySlot(this.player.abilities[1], '2', '🔥')}
        ${this.renderAbilitySlot(this.player.abilities[2], '3', '⚡')}
        ${this.renderAbilitySlot(this.player.abilities[3], '4', '🔧')}
        ${this.renderDashSlot()}
        ${this.isEndlessMode ? this.renderOverdriveSlot() : ''}
      </div>
      <p class="muted">Crew ${crewSummary}</p>
      ${this.isEndlessMode && this.comboState.kills >= 2 ? this.renderComboHud() : ''}
      ${this.player.maxShield > 0 ? `<div class="meter shield"><span style="width:${shieldRatio * 100}%"></span></div>` : ''}
      <div class="meter"><span style="width:${hpRatio * 100}%"></span></div>
      <div class="meter heat"><span style="width:${Math.min(100, heatRatio * 100)}%"></span></div>
      ${this.encounterObjective.type === 'protect_ally' ? `<div class="meter"><span style="width:${Math.min(100, convoyProgress * 100)}%; background:linear-gradient(90deg,#67e8f9,#22d3ee)"></span></div>` : ''}
      <p class="muted">${this.encounterObjective.label}</p>
      <p class="muted">${this.waveAnnouncement}</p>
      ${this.pickupAnnouncement ? `<p class="success" style="font-size:0.9em">${this.pickupAnnouncement}</p>` : ''}
      ${this.comboState.tierAnnouncement ? `<p style="font-size:1.1em;color:${getComboTier(this.comboState.kills).color};font-weight:700;text-shadow:0 0 8px ${getComboTier(this.comboState.kills).color}">${this.comboState.tierAnnouncement}</p>` : ''}
      ${this.eliteAnnouncement ? `<p style=\"font-size:1em;color:#fbbf24;font-weight:600;text-shadow:0 0 6px rgba(251,191,36,0.5)\">${this.eliteAnnouncement}</p>` : ''}
      ${isOverdriveActive(this.overdriveState) ? `<div class=\"overdrive-vignette\" style=\"opacity:${0.3 + 0.2 * Math.sin(this.elapsedEncounterSeconds * 8)}\"></div>` : ''}
      ${this.playerBuffs.length > 0 ? `<div class="ability-bar">${this.playerBuffs.map((b) => `<div class="ability-slot active" title="${b.kind === 'power_surge' ? 'Power Surge' : 'Rapid Fire'} — ${b.remaining.toFixed(1)}s"><span class="ability-icon">${b.kind === 'power_surge' ? '⚡' : '🔥'}</span><span class="ability-fill active-fill" style="width:${(b.remaining / b.duration) * 100}%"></span></div>`).join('')}</div>` : ''}
      ${this.activeMutators.length > 0 ? `<div class="ability-bar" style="justify-content:center;gap:6px">${this.activeMutators.map((m) => `<div class="ability-slot active" title="${m.def.displayName}: ${m.def.description}" style="border-color:#c084fc"><span class="ability-icon">${m.def.icon}</span></div>`).join('')}</div>` : ''}
      ${!this.player.alive
        ? this.isEndlessMode
          ? `<p class="warning">Ship disabled · Wave ${this.currentWave} · ${this.endlessTotalKills} kills · Score: ${this.endlessScore.toLocaleString()}</p>`
          : '<p class="warning">Your ship is disabled. Reset or return to the editor.</p>'
        : ''}
      ${this.encounterOutcome === 'victory' && !this.isEndlessMode ? '<p class="success">Encounter cleared. Return to the editor or reset for another run.</p>' : ''}
    `;

    if (debrief) {
      if (this.encounterOutcome === 'continue' && !this.isEndlessMode) {
        debrief.innerHTML = '';
      } else if (this.isEndlessMode && (this.encounterOutcome === 'defeat' || !this.player.alive)) {
        // Finalize run stats
        const s: RunStats = {
          ...this.runStats,
          waveReached: this.endlessBestWave || (this.currentWave - 1),
          totalKills: this.endlessTotalKills,
          score: this.endlessScore,
          creditsEarned: this.endlessCredits,
          timeSeconds: this.elapsedEncounterSeconds,
          hpRemaining: Math.max(0, this.player.hp),
          maxHp: this.player.stats.maxHp,
        };
        const grade = computeRunGrade(s);
        const highlights = getHighlights(s);
        const tip = getNextRunTip(grade, s);
        const cause = getCauseOfDeath(s);
        const dmgRatio = s.damageTaken > 0 ? (s.damageDealt / s.damageTaken).toFixed(1) : '∞';
        const kpm = s.timeSeconds > 0 ? (s.totalKills / (s.timeSeconds / 60)).toFixed(1) : '—';
        const mutatorTags = s.mutatorsChosen.length > 0
          ? s.mutatorsChosen.map((m) => `<span style="color:#c084fc">${m}</span>`).join(' · ')
          : '<span style="color:#64748b">None</span>';

        debrief.innerHTML = `
          <div style="text-align:center;margin-bottom:8px">
            <div style="font-size:2.4em;font-weight:900;color:${grade.color};line-height:1;text-shadow:0 0 12px ${grade.color}40">${grade.letter}</div>
            <div style="font-size:0.85em;color:${grade.color};font-weight:600;margin-top:2px">${grade.label}</div>
          </div>
          <div style="background:#1e293b;border-radius:6px;padding:8px;margin-bottom:6px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:0.85em">
              <span style="color:#94a3b8">Wave Reached</span><span style="text-align:right;font-weight:600">${s.waveReached}</span>
              <span style="color:#94a3b8">Total Kills</span><span style="text-align:right;font-weight:600">${formatBig(s.totalKills)}</span>
              <span style="color:#94a3b8">Score</span><span style="text-align:right;font-weight:600;color:#fbbf24">${s.score.toLocaleString()}</span>
              <span style="color:#94a3b8">Credits Earned</span><span style="text-align:right;font-weight:600">${s.creditsEarned.toLocaleString()}</span>
              <span style="color:#94a3b8">Time Survived</span><span style="text-align:right;font-weight:600">${formatTime(s.timeSeconds)}</span>
              <span style="color:#94a3b8">Best Combo</span><span style="text-align:right;font-weight:600">${s.bestCombo}x ${s.highestComboTier}</span>
              <span style="color:#94a3b8">Damage Efficiency</span><span style="text-align:right;font-weight:600">${dmgRatio}x</span>
              <span style="color:#94a3b8">Kills/Min</span><span style="text-align:right;font-weight:600">${kpm}</span>
              <span style="color:#94a3b8">Pickups</span><span style="text-align:right;font-weight:600">${s.pickupsCollected}</span>
              <span style="color:#94a3b8">Elites Slain</span><span style="text-align:right;font-weight:600">${s.eliteKills}</span>
              <span style="color:#94a3b8">Dashes</span><span style="text-align:right;font-weight:600">${s.dashCount}</span>
              <span style="color:#94a3b8">Overdrives</span><span style="text-align:right;font-weight:600">${s.overdriveActivations}</span>
              <span style="color:#94a3b8">Upgrades</span><span style="text-align:right;font-weight:600">${s.upgradesPurchased.length}</span>
            </div>
          </div>
          ${highlights.length > 0 ? `<div style="text-align:center;margin-bottom:6px">${highlights.map((h) => `<span style="display:inline-block;background:#334155;color:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:0.8em;margin:2px">⭐ ${h}</span>`).join('')}</div>` : ''}
          <div style="font-size:0.8em;margin-bottom:4px"><span style="color:#94a3b8">Traits:</span> ${mutatorTags}</div>
          <div style="font-size:0.8em;color:#fb7185;margin-bottom:6px">${cause}</div>
          <div style="background:#0f172a;border-left:3px solid #38bdf8;padding:6px 8px;border-radius:0 4px 4px 0;font-size:0.8em;color:#94a3b8;margin-bottom:4px">
            <strong style="color:#38bdf8">Next run:</strong> ${tip}
          </div>
          <button class="primary" id="debrief-restart" style="width:100%;margin-top:4px;font-size:0.85em">↻ Restart</button>
        `;
        document.getElementById('debrief-restart')?.addEventListener('click', () => {
          this.spawnEncounter(cloneBlueprint(this.player.blueprint));
        });
      } else if (this.encounterOutcome !== 'continue') {
        const report = buildEncounterDebrief({
          encounterName: this.encounterId,
          objectiveLabel: this.encounterObjective.label,
          outcome: this.encounterOutcome,
          creditsEarned: this.encounterOutcome === 'victory' ? createEncounterReward(this.waves.length, this.waves.reduce((sum, wave) => sum + wave.enemies.length, 0), true).credits : 0,
          bestScore: this.waves.reduce((sum, wave) => sum + wave.enemies.length, 0) * 100,
          elapsedSeconds: this.elapsedEncounterSeconds,
        });
        debrief.innerHTML = `<strong>${report.title}</strong><br>${report.lines.join('<br>')}`;
      }
    }
  }

  private updateThrustTrails(dt: number): void {
    this.thrustTimer -= dt;
    if (this.thrustTimer > 0) return;
    this.thrustTimer = 0.04; // emit every 40ms

    for (const ship of this.ships) {
      if (!ship.alive) continue;

      // Only emit if the ship has velocity (is moving)
      const speed = ship.velocity.length();
      if (speed < 0.5) continue;

      const isThrusting = ship === this.player
        ? (this.keys.has('KeyW') || this.keys.has('KeyS') || this.keys.has('KeyA') || this.keys.has('KeyD'))
        : speed > 2;

      if (!isThrusting) continue;

      const backDirection = new THREE.Vector3(
        -Math.sin(ship.rotation),
        0,
        -Math.cos(ship.rotation),
      );
      const afterburning = isAfterburning(ship.abilities);
      this.particles.emit(ParticleSystem.thrustTrail(ship.position, backDirection, afterburning));
    }
  }

  private updateScreenShake(dt: number): void {
    if (!this.screenShake) return;

    const basePos = new THREE.Vector3(
      this.player.position.x,
      20,
      this.player.position.z + 0.001,
    );

    updateScreenShake(this.screenShake, this.camera, basePos, dt);

    if (this.screenShake.remaining <= 0) {
      this.screenShake = null;
    }
  }

  private updateMouseWorld(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.mouseWorld);
  }

  // ── Hazard System ──────────────────────────────────────────────

  private spawnHazards(spawns: HazardSpawn[]): void {
    const states = createHazardStates(spawns);
    for (const state of states) {
      const mesh = this.buildHazardMesh(state);
      this.hazardGroup.add(mesh);
      this.hazardMeshes.set(state.id, mesh);
      this.hazards.push(state);
    }
  }

  private buildHazardMesh(state: HazardState): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(state.x, 0, state.z);

    if (state.kind === 'asteroid') {
      // Irregular rocky shape using icosahedron with vertex jitter
      const geo = new THREE.IcosahedronGeometry(state.radius, 1);
      const positions = geo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const jitter = 0.75 + Math.random() * 0.5;
        positions.setXYZ(i, x * jitter, y * jitter * 0.4, z * jitter);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: '#4a5568',
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      group.add(mesh);
    } else if (state.kind === 'shield_conduit') {
      // Glowing ring on ground plane
      const ringGeo = new THREE.RingGeometry(state.radius * 0.3, state.radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      // Inner glow
      const glowGeo = new THREE.CircleGeometry(state.radius * 0.5, 24);
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.12,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.04;
      group.add(glow);
    } else if (state.kind === 'damage_nebula') {
      // Semi-transparent cloud disc
      const nebulaGeo = new THREE.CircleGeometry(state.radius, 32);
      const nebulaMat = new THREE.MeshBasicMaterial({
        color: '#a855f7',
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      });
      const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
      nebula.rotation.x = -Math.PI / 2;
      nebula.position.y = 0.08;
      group.add(nebula);

      // Outer ring
      const ringGeo = new THREE.RingGeometry(state.radius * 0.85, state.radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#7c3aed',
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);
    }

    return group;
  }

  private clearHazards(): void {
    for (const mesh of Array.from(this.hazardMeshes.values())) {
      this.hazardGroup.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
    }
    this.hazardMeshes.clear();
    this.hazards.length = 0;
  }

  private updateHazards(dt: number): void {
    const now = performance.now() / 1000;

    for (let i = 0; i < this.hazards.length; i++) {
      const hazard = this.hazards[i];
      const updated = updateHazard(hazard, dt);
      this.hazards[i] = updated;

      // Update mesh visuals
      const mesh = this.hazardMeshes.get(updated.id);
      if (!mesh) continue;

      if (updated.kind === 'asteroid') {
        // Fade destroyed asteroids
        if (!updated.active) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.opacity = Math.max(0, (child.material.opacity ?? 1) - dt * 2);
              child.material.transparent = true;
            }
          });
          if (!mesh.visible) continue;
          const firstChild = mesh.children[0] as THREE.Mesh | undefined;
          if (firstChild?.material instanceof THREE.MeshStandardMaterial && firstChild.material.opacity <= 0) {
            mesh.visible = false;
            this.particles.emit(ParticleSystem.explosionBurst(
              new THREE.Vector3(updated.x, 0.3, updated.z), '#94a3b8', 12,
            ));
          }
        }
      } else if (updated.kind === 'shield_conduit') {
        // Pulse opacity based on charge level
        const charge = updated.charge;
        const ring = mesh.children[0] as THREE.Mesh | undefined;
        const glow = mesh.children[1] as THREE.Mesh | undefined;
        if (ring?.material instanceof THREE.MeshBasicMaterial) {
          ring.material.opacity = 0.15 + charge * 0.25;
          ring.material.color.set(charge > 0.3 ? '#38bdf8' : '#334155');
        }
        if (glow?.material instanceof THREE.MeshBasicMaterial) {
          glow.material.opacity = 0.05 + charge * 0.1;
        }
      } else if (updated.kind === 'damage_nebula') {
        // Pulse size and opacity
        const pulse = 0.85 + 0.15 * Math.sin(updated.pulsePhase);
        const nebula = mesh.children[0] as THREE.Mesh | undefined;
        const ring = mesh.children[1] as THREE.Mesh | undefined;
        if (nebula?.material instanceof THREE.MeshBasicMaterial) {
          nebula.material.opacity = 0.1 + pulse * 0.08;
        }
        if (ring?.material instanceof THREE.MeshBasicMaterial) {
          ring.material.opacity = 0.2 + pulse * 0.1;
        }
        // Rotate ring slowly
        if (ring) ring.rotation.z += dt * 0.3;
      }
    }
  }

  private updateShipHazards(dt: number): void {
    const now = performance.now() / 1000;

    for (const ship of this.ships) {
      if (!ship.alive) continue;

      for (const hazard of this.hazards) {
        const result = applyShipHazardCollision(
          hazard, ship.id, ship.position.x, ship.position.z, ship.radius * 0.4, dt, now,
        );

        // Asteroid push
        if (result.pushX !== 0 || result.pushZ !== 0) {
          ship.position.x += result.pushX;
          ship.position.z += result.pushZ;
          // Kill velocity component into the asteroid
          const pushAngle = Math.atan2(result.pushX, result.pushZ);
          const velAngle = Math.atan2(ship.velocity.x, ship.velocity.z);
          const angleDiff = Math.abs(Math.atan2(Math.sin(velAngle - pushAngle), Math.cos(velAngle - pushAngle)));
          if (angleDiff < Math.PI / 2) {
            ship.velocity.multiplyScalar(0.6);
          }
        }

        // Shield conduit restore
        if (result.shieldRestored > 0 && ship.maxShield > 0) {
          ship.shield = Math.min(ship.maxShield, ship.shield + result.shieldRestored);
          if (ship.team === 'player') {
            this.particles.emit(ParticleSystem.shieldAbsorb(ship.position, '#38bdf8'));
          }
        }

        // Damage nebula
        if (result.damageTaken > 0) {
          // Nebula does raw energy damage — bypass shields but respects armor
          const resolved = resolveDamage(
            result.damageTaken, 'energy', 0.5,
            ship.shield, ship.stats.armorRating,
            ship.stats.kineticBypass, ship.stats.energyVulnerability,
          );
          ship.shield -= resolved.shieldAbsorbed;
          ship.shield = Math.max(0, ship.shield);
          if (resolved.hullDamage > 0) {
            const destroyed = damageModules(ship.moduleStates, resolved.hullDamage, Math.random() * Math.PI * 2, 0.6);
            if (destroyed.length > 0) {
              for (const id of destroyed) {
                this.darkenModuleMeshes(ship, id);
              }
              ship.hp = ship.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
            }
          }
          if (ship.hp <= 0) {
            ship.alive = false;
            ship.group.visible = false;
            playExplosion();
            this.spawnExplosionVisual(ship.position, ship.team === 'player' ? '#fca5a5' : '#fb7185');
            for (const config of ParticleSystem.deathExplosion(ship.position)) {
              this.particles.emit(config);
            }
            this.handleAffixExplosion(ship);
            if (this.isEndlessMode && ship.team === 'enemy') {
              this.endlessTotalKills += 1;
              const killedAffixes = this.shipAffixes.get(ship.id);
              const killedIsElite = killedAffixes && killedAffixes.length >= 2;
              if (killedAffixes && killedAffixes.length > 0) {
                this.endlessWaveEliteBonus += Math.floor(10 * eliteCreditsMultiplier(killedAffixes));
              }
              this.shipAffixes.delete(ship.id);
              // Mutator: Vampiric heal
              const heal2 = vampiricHeal(this.activeMutators, this.player.stats.maxHp);
              if (heal2 > 0 && this.player.alive) {
                this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + heal2);
              }
              // Mutator: Bounty Hunter
              if (killedIsElite && bountyHunterActive(this.activeMutators)) {
                for (const ability of this.player.abilities) {
                  if (ability.cooldownRemaining > 0) ability.cooldownRemaining = 0;
                }
                this.eliteAnnouncement = '🎯 Bounty Hunter — abilities refreshed!';
                this.eliteAnnouncementTimer = 2;
              }
              const comboResult = registerComboKill(this.comboState);
              this.comboState = comboResult.state;
              // Track run stats (beam kill path)
              this.runStats.totalKills += 1;
              if (killedIsElite) this.runStats.eliteKills += 1;
              this.runStats.bestCombo = Math.max(this.runStats.bestCombo, this.comboState.kills);
              if (comboResult.tierUp) this.runStats.highestComboTier = getComboTier(this.comboState.kills).label;
              const comboMult2 = getComboTier(this.comboState.kills).multiplier;
              this.overdriveState = addOverdriveCharge(this.overdriveState, OVERDRIVE_CHARGE_PER_KILL * comboMult2);
              if (comboResult.tierUp) {
                this.particles.emit(ParticleSystem.comboBurst(this.player.position, getComboTier(this.comboState.kills).color));
                this.screenShake = createScreenShake(0.25, 0.2);
                playComboTier();
              }
            }
          }
          // Shield drain multiplier handled via reduced recharge in coolShips
        }
      }
    }
  }

  // ── Pickup System ──────────────────────────────────────────────

  private spawnPickup(kind: PickupKind, x: number, z: number): void {
    const state = createPickup(kind, x, z);
    const mesh = this.buildPickupMesh(state);
    this.pickupGroup.add(mesh);
    this.pickupMeshes.set(state.id, mesh);
    this.pickups.push(state);
  }

  private buildPickupMesh(state: PickupState): THREE.Object3D {
    const group = new THREE.Group();
    const color = getPickupColor(state.kind);

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(0.25, 0.45, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);

    // Inner core
    const coreGeo = new THREE.CircleGeometry(0.2, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.16;
    group.add(core);

    // Vertical beam
    const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 0.6;
    group.add(beam);

    return group;
  }

  private clearPickups(): void {
    for (const mesh of Array.from(this.pickupMeshes.values())) {
      this.pickupGroup.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
    }
    this.pickupMeshes.clear();
    this.pickups.length = 0;
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      const updated = updatePickup(pickup, dt);

      // Magnetic attraction toward player
      if (updated.active && this.player.alive) {
        const attracted = applyPickupAttraction(
          { ...updated, attractionRange: updated.attractionRange * (1 + this.upgradeStats.pickupRangeBonus) },
          this.player.position.x, this.player.position.z, dt,
        );
        updated.x = attracted.newX;
        updated.z = attracted.newZ;
      }

      this.pickups[i] = updated;

      // Update mesh position and animation
      const mesh = this.pickupMeshes.get(updated.id);
      if (mesh) {
        mesh.position.set(updated.x, 0, updated.z);
        // Bob animation
        mesh.position.y = Math.sin(updated.bobPhase) * 0.15 + 0.05;
        // Fade when TTL is low
        if (updated.ttl < 3) {
          const fade = updated.ttl / 3;
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
              child.material.opacity = fade * (child.material.userData?.baseOpacity ?? child.material.opacity);
            }
          });
        }

        // Remove expired
        if (!updated.active) {
          mesh.visible = false;
          this.pickupGroup.remove(mesh);
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material instanceof THREE.Material) child.material.dispose();
            }
          });
          this.pickupMeshes.delete(updated.id);
          this.pickups.splice(i, 1);
          continue;
        }

        // Try collection
        if (this.player.alive) {
          const result = tryCollectPickup(updated, this.player.position.x, this.player.position.z, this.player.maxShield, this.player.moduleStates);
          if (result.collected) {
            // Apply effects
            if (result.shieldRestore > 0) {
              this.player.shield = Math.min(this.player.maxShield, this.player.shield + result.shieldRestore);
              this.particles.emit(ParticleSystem.shieldAbsorb(this.player.position, '#38bdf8'));
            }
            if (result.repairTarget) {
              const repaired = applyRepair(result.repairTarget, result.kind === 'salvage' ? 1.0 : REPAIR_HP_FRACTION);
              const idx = this.player.moduleStates.findIndex((m) => m.instanceId === result.repairTarget!.instanceId);
              if (idx >= 0) this.player.moduleStates[idx] = repaired;
              this.player.hp = this.player.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
              this.restoreModuleMesh(this.player, result.repairTarget.instanceId);
              this.particles.emit(ParticleSystem.shieldAbsorb(this.player.position, '#4ade80'));
            }
            if (result.buffGained) {
              // Apply buff duration bonus from upgrades
              const buff = result.buffGained;
              buff.remaining *= this.upgradeStats.buffDurationBonus;
              buff.duration *= this.upgradeStats.buffDurationBonus;
              this.playerBuffs.push(buff);
            }

            this.pickupAnnouncement = `${getPickupIcon(result.kind ?? 'shield_cell')} ${getPickupLabel(result.kind ?? 'shield_cell')} collected!`;
            this.pickupAnnouncementTimer = 2.0;
            if (this.isEndlessMode) this.runStats.pickupsCollected += 1;

            // Remove pickup
            this.pickupGroup.remove(mesh);
            mesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (child.material instanceof THREE.Material) child.material.dispose();
              }
            });
            this.pickupMeshes.delete(updated.id);
            this.pickups.splice(i, 1);
          }
        }
      }
    }

    // Decay pickup announcement
    if (this.pickupAnnouncementTimer > 0) {
      this.pickupAnnouncementTimer -= dt;
      if (this.pickupAnnouncementTimer <= 0) {
        this.pickupAnnouncement = '';
      }
    }
  }

  private updatePlayerBuffs(dt: number): void {
    this.playerBuffs = updateBuffs(this.playerBuffs, dt);
  }

  private updateCombo(dt: number): void {
    if (!this.isEndlessMode) return;
    this.comboState = tickCombo(this.comboState, dt);
  }

  private updateOverdrive(dt: number): void {
    if (!this.isEndlessMode) return;
    const prev = this.overdriveState.phase;
    this.overdriveState = tickOverdrive(this.overdriveState, dt);
    // Deactivation VFX
    if (prev === 'active' && this.overdriveState.phase !== 'active') {
      this.screenShake = createScreenShake(0.3, 0.2);
      playOverdriveDeactivate();
    }
  }

  /** Map of ship ID → affix mods for tracking regeneration/explode. */
  private shipAffixData = new Map<string, { regeneratesHp: boolean; explodesOnDeath: boolean }>();
  /** Map of ship ID → rolled affixes for credit bonus calculation. */
  private shipAffixes = new Map<string, RolledAffix[]>();

  private applyAffixMods(ship: RuntimeShip, affixes: RolledAffix[]): void {
    const mods = computeAffixStats(affixes);

    // Scale HP
    const newMaxHp = Math.round(ship.stats.maxHp * mods.hpMultiplier);
    ship.stats.maxHp = newMaxHp;
    ship.hp = newMaxHp;

    // Scale shield
    if (ship.maxShield > 0) {
      const newMaxShield = Math.round(ship.maxShield * mods.shieldMultiplier);
      ship.maxShield = newMaxShield;
      ship.shield = newMaxShield;
    }

    // Armor bonus
    ship.stats.armorRating = Math.min(100, ship.stats.armorRating + mods.armorBonus);

    // Store multipliers for use in combat/fire/thrust calculations
    if (mods.damageMultiplier !== 1) ship.affixDamageMult = mods.damageMultiplier;
    if (mods.fireRateMultiplier !== 1) ship.affixFireRateMult = mods.fireRateMultiplier;
    if (mods.speedMultiplier !== 1) ship.affixThrustMult = mods.speedMultiplier;
    if (mods.armorBonus > 0) ship.affixArmorBonus = mods.armorBonus;

    // Track special affix behaviors
    this.shipAffixData.set(ship.id, {
      regeneratesHp: mods.regeneratesHp,
      explodesOnDeath: mods.explodesOnDeath,
    });
    this.shipAffixes.set(ship.id, affixes);

    // Announce elite enemies
    if (isElite(affixes)) {
      this.eliteAnnouncement = `⚡ Elite: ${ship.blueprint.name} — ${affixDisplayLabel(affixes)}`;
      this.eliteAnnouncementTimer = 3;
    }

    // Visual: tint enemy modules for affix color
    const color = getAffixColor(affixes);
    if (color) {
      ship.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            mat.emissive.set(color);
            mat.emissiveIntensity = isElite(affixes) ? 0.5 : 0.25;
          }
        }
      });
    }
  }

  /**
   * Handle the "Explosive" affix death effect.
   * Deals 30 flat damage to all ships within 5 units of the dying ship.
   */
  private handleAffixExplosion(ship: RuntimeShip): void {
    const affixData = this.shipAffixData.get(ship.id);
    if (!affixData?.explodesOnDeath) return;
    this.shipAffixData.delete(ship.id);

    const EXPLOSION_RADIUS = 5;
    const EXPLOSION_DAMAGE = 30;

    // Visual feedback
    this.spawnExplosionVisual(ship.position, '#ff6600');
    this.screenShake = createScreenShake(0.2, 0.15);

    // Damage the player
    const playerDist = ship.position.distanceTo(this.player.position);
    if (playerDist < EXPLOSION_RADIUS && this.player.alive) {
      const dmg = Math.round(EXPLOSION_DAMAGE * (1 - playerDist / EXPLOSION_RADIUS * 0.5));
      this.applyDamage(this.player, dmg, 'kinetic', 0.5, 0);
    }

    // Damage other enemies (friendly fire)
    for (const other of this.ships) {
      if (other.id === ship.id || !other.alive) continue;
      const dist = ship.position.distanceTo(other.position);
      if (dist < EXPLOSION_RADIUS) {
        const dmg = Math.round(EXPLOSION_DAMAGE * (1 - dist / EXPLOSION_RADIUS * 0.5));
        this.applyDamage(other, dmg, 'kinetic', 0.5, 0);
      }
    }
  }

  // ── Upgrade Shop ──────────────────────────────────────────────

  private openUpgradeShop(waveCleared: number): void {
    this.shopWaveCleared = waveCleared;
    this.shopOptions = generateUpgradeOptions(waveCleared, this.purchasedUpgrades);
    this.shopMutatorOptions = this.generateMutatorOptions(waveCleared);

    // Free hull repair every 5 waves
    if (waveCleared > 0 && waveCleared % 5 === 0) {
      const repairAmount = computeRestRepairAmount(this.player.stats.maxHp, waveCleared);
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + repairAmount);
    }

    this.shopOpen = true;
    this.waveAnnouncement = `Wave ${waveCleared} cleared! Choose an upgrade or skip.`;
  }

  private purchaseUpgrade(upgrade: UpgradeDef): void {
    const cost = upgradeCost(upgrade, this.shopWaveCleared);
    if (this.endlessCredits < cost) return;

    this.endlessCredits -= cost;
    this.upgradeStats = applyUpgrade(this.upgradeStats, upgrade);
    this.purchasedUpgrades.push({ def: upgrade, wavePurchased: this.shopWaveCleared });
    this.runStats.upgradesPurchased.push(upgrade.displayName);

    // Rebuild player stats from base + all upgrade bonuses
    this.rebuildPlayerWithUpgrades();
    this.closeUpgradeShop();
  }

  private closeUpgradeShop(): void {
    this.shopOpen = false;
    this.shopOptions = [];
    this.shopMutatorOptions = [];
    // Resume wave spawn — the wave delay handles the timing
    this.waveDelay = 0.5; // Brief delay before next wave spawns
    this.waveAnnouncement = `Wave ${this.currentWave} incoming...`;
  }

  /** Generate 1 mutator option for the shop (free, replaces one upgrade slot if available). */
  private generateMutatorOptions(waveNumber: number): MutatorDef[] {
    const available = getShopMutators(waveNumber, this.activeMutators);
    if (available.length === 0) return [];
    // Offer at most 1 mutator per shop visit, weighted random
    const weights = available.map((m) => {
      let w = 1;
      if (m.waveMin >= 7) w = 0.6;
      if (m.waveMin >= 9) w = 0.4;
      return { def: m, weight: w };
    });
    const totalW = weights.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalW;
    for (const entry of weights) {
      roll -= entry.weight;
      if (roll <= 0) return [entry.def];
    }
    return [weights[0].def];
  }

  /** Take a mutator (free — mutators are always offered at no cost). */
  private purchaseMutator(mutator: MutatorDef): void {
    if (!canAddMutator(this.activeMutators, mutator)) return;
    this.activeMutators.push({ def: mutator, acquiredWave: this.shopWaveCleared });
    this.runStats.mutatorsChosen.push(mutator.displayName);
    // Apply stat modifications immediately
    this.upgradeStats = applyMutatorStatMods(this.upgradeStats, this.activeMutators);
    this.rebuildPlayerWithUpgrades();
    this.shopMutatorOptions = []; // Remove mutator option after picking
  }

  /**
   * Rebuild player stats by recomputing base stats from blueprint
   * and applying all accumulated upgrade bonuses on top.
   */
  private rebuildPlayerWithUpgrades(): void {
    const s = this.upgradeStats;
    const baseStats = applyCrewModifiers(computeShipStats(this.player.blueprint), this.player.blueprint.crew);

    // Start from base stats
    this.player.stats = { ...baseStats };

    // Apply additive bonuses
    this.player.stats.maxHp += s.maxHpBonus;
    this.player.stats.shieldStrength += s.shieldBonus;
    this.player.stats.shieldRecharge *= (1 + s.shieldRechargeBonus);
    this.player.stats.armorRating += s.armorRatingBonus;
    this.player.stats.kineticBypass += s.kineticBypassBonus;
    this.player.stats.energyVulnerability = Math.max(0, this.player.stats.energyVulnerability - s.energyVulnerabilityReduction);
    this.player.stats.powerOutput *= (1 + s.powerOutputBonus);
    this.player.stats.heatCapacity += s.heatCapacityBonus;
    this.player.stats.cooling *= (1 + s.coolingBonus);
    this.player.stats.thrust *= (1 + s.thrustBonus);
    this.player.stats.droneCapacity += s.droneCapacityBonus;

    // Recalculate power factor
    this.player.powerFactor = computePowerFactor(this.player.stats.powerOutput, this.player.stats.powerDemand);

    // Update runtime values
    this.player.maxShield += s.shieldBonus;
    this.player.shield = Math.min(this.player.shield + s.shieldBonus, this.player.maxShield);
    this.player.hp = Math.min(this.player.hp + s.maxHpBonus, this.player.stats.maxHp);
  }

  private renderComboHud(): string {
    const tier = getComboTier(this.comboState.kills);
    const timerFrac = getComboTimerFraction(this.comboState);
    const timerColor = timerFrac < 0.3 ? '#ef4444' : tier.color;
    return `
      <div class="combo-display">
        <div class="combo-counter" style="color:${tier.color};text-shadow:0 0 10px ${tier.color}">
          <span class="combo-icon">${tier.icon}</span>
          <span class="combo-kills">${this.comboState.kills}</span>
          <span class="combo-x">x</span>
          <span class="combo-mult">${tier.multiplier}</span>
        </div>
        <div class="combo-label">${tier.label}</div>
        <div class="combo-timer"><span style="width:${timerFrac * 100}%;background:${timerColor}"></span></div>
      </div>
    `;
  }

  private renderAbilitySlot(ability: AbilityRuntime, key: string, icon: string): string {
    if (!ability) return '';
    const onCooldown = ability.cooldownRemaining > 0;
    const isActive = ability.activeRemaining > 0;
    const isUnavailable = !ability.available;
    let stateClass = 'ready';
    let cooldownPct = '';
    if (isUnavailable) {
      stateClass = 'unavailable';
    } else if (isActive) {
      stateClass = 'active';
      const pct = Math.max(0, (ability.activeRemaining / ability.def.duration) * 100);
      cooldownPct = `<span class="ability-fill active-fill" style="width:${pct}%"></span>`;
    } else if (onCooldown) {
      stateClass = 'cooldown';
      const totalCd = ability.def.duration + ability.def.cooldown;
      const pct = Math.max(0, (ability.cooldownRemaining / totalCd) * 100);
      cooldownPct = `<span class="ability-fill cooldown-fill" style="width:${100 - (ability.cooldownRemaining / totalCd) * 100}%"></span>`;
    }
    return `<div class="ability-slot ${stateClass}" title="${ability.def.displayName} [${key}]${isUnavailable ? ' — no module' : ''}">
      <span class="ability-key">${key}</span>
      <span class="ability-icon">${icon}</span>
      ${cooldownPct}
    </div>`;
  }

  private renderDashSlot(): string {
    const progress = getDashProgress(this.dashState);
    const isReady = progress >= 1;
    const stateClass = isDashing(this.dashState) ? 'active' : isReady ? 'ready' : 'cooldown';
    const fillHtml = !isReady
      ? `<span class="ability-fill cooldown-fill" style="width:${progress * 100}%"></span>`
      : '';
    return `<div class="ability-slot ${stateClass}" title="Dash [Space]">
      <span class="ability-key">⎵</span>
      <span class="ability-icon">💨</span>
      ${fillHtml}
    </div>`;
  }

  private renderOverdriveSlot(): string {
    const { phase, charge, activeTimer, cooldownTimer } = this.overdriveState;
    let stateClass: string;
    let fillHtml = '';
    switch (phase) {
      case 'active':
        stateClass = 'active overdrive-active';
        fillHtml = `<span class="ability-fill active-fill" style="width:${(activeTimer / OVERDRIVE_DURATION) * 100}%"></span>`;
        break;
      case 'cooldown':
        stateClass = 'cooldown';
        fillHtml = `<span class="ability-fill cooldown-fill" style="width:${(1 - cooldownTimer / OVERDRIVE_COOLDOWN) * 100}%"></span>`;
        break;
      default:
        stateClass = charge >= OVERDRIVE_FULL_CHARGE ? 'ready overdrive-ready' : 'cooldown';
        fillHtml = charge > 0 && charge < OVERDRIVE_FULL_CHARGE
          ? `<span class="ability-fill cooldown-fill" style="width:${charge * 100}%"></span>`
          : '';
    }
    return `<div class="ability-slot ${stateClass}" title="Overdrive [V]${phase === 'active' ? ` — ${activeTimer.toFixed(1)}s` : phase === 'cooldown' ? ` — recharging ${cooldownTimer.toFixed(0)}s` : charge >= OVERDRIVE_FULL_CHARGE ? ' — READY' : ` — ${Math.floor(charge * 100)}%`}" style="${stateClass.includes('overdrive-ready') ? 'box-shadow:0 0 12px rgba(168,85,247,0.6);border-color:#a855f7' : ''}">
      <span class="ability-key">V</span>
      <span class="ability-icon">${phase === 'active' ? '⚡' : '🔮'}</span>
      ${fillHtml}
    </div>`;
  }
}

function getProjectileColor(team: 'player' | 'enemy', archetype: WeaponProfile['archetype']): string {
  if (archetype === 'missile') return team === 'player' ? '#fdba74' : '#fb7185';
  if (archetype === 'laser') return team === 'player' ? '#7dd3fc' : '#f9a8d4';
  if (archetype === 'beam') return team === 'player' ? '#5eead4' : '#fca5a5';
  return team === 'player' ? '#fde68a' : '#fecaca';
}
