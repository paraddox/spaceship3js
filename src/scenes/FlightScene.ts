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
import {
  getAudioPercentLabel,
  loadAudioSettings,
  persistAudioSettings,
  stepAudioVolume,
  toggleAudioMuted,
  type AudioChannel,
  type AudioSettings,
} from '../game/audio-settings';
import { normalizeVirtualStick, readTouchControlEnvironment, shouldEnableTouchControls } from '../game/touch-controls';
import { advanceProtectedAlly, chooseEnemyPriorityTarget, computeEscortProgress } from '../game/escort-ai';
import { advanceEffect, createBeamEffect, createExplosionEffect, createImpactEffect, type CombatEffectState } from '../game/effects';
import { playShoot, playLaser, playHit, playExplosion, playMissile, playBeam, resumeAudio, playComboTier, playOverdriveActivate, playOverdriveDeactivate, applySfxSettings } from '../game/audio';
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
  createNemesisFromCandidate,
  getNemesisBanner,
  getNemesisReward,
  getNemesisStatus,
  injectNemesisIntoWave,
  loadNemesisState,
  persistNemesisState,
  recordNemesisDefeat,
  recordNemesisVictory,
  shouldSpawnNemesis,
  type NemesisState,
} from '../game/nemesis';
import {
  type ArenaRiftActive,
  type ArenaRiftState,
  type ArenaRiftType,
  type VoidCollapseState,
  type GravityWellState,
  type ShockwaveState,
  type EmpStormState,
  createRiftState,
  getRiftDef,
  getRiftArenaRadius,
  getRiftGravityForce,
  getRiftShockwaveForce,
  isRiftEmpActive,
  isOutsideVoidCollapse,
  isRiftWave,
  shouldTriggerRift,
  updateRift,
  getEmpCountdown,
  rollRiftType,
  getRiftType,
  ARENA_RIFTS,
} from '../game/arena-rift';
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
  spawnDamageNumber,
  flashHit,
  spawnMuzzleFlash,
  spawnDeathExplosion,
  tickFloatingTexts,
  tickMuzzleFlashes,
  tickDeathExplosions,
  disposeCombatFeedback,
  type CombatFeedbackState,
} from '../game/combat-feedback';
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
  createNearMissState,
  checkNearMiss,
  tickNearMiss,
  getNearMissComboBonus,
  getEnemyTimeScale,
  NEAR_MISS_RADIUS,
  HIT_RADIUS,
  type NearMissState,
} from '../game/near-miss';
import {
  generateUpgradeOptions,
  upgradeCost,
  getUpgradeOfferCost,
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
  orbitShieldActive,
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
import { buildRunRecord, saveRunRecord } from '../game/run-chronicle';
import {
  createDashState,
  canDash,
  startDash,
  updateDash,
  isInvulnerable,
  isDashing,
  getDashProgress,
  triggerNebulaBoost,
  triggerConduitRestore,
  type DashState,
} from '../game/dash';
import {
  CREW_ORDER_DEFS,
  activateEngineerReroute,
  activateGunnerFocus,
  activatePilotSurge,
  activateTacticianLink,
  canActivateCrewOrder,
  clearCrewOrderTarget,
  createCrewOrdersState,
  getActiveRemaining,
  getCooldownRemaining,
  getCrewOrderCooldown,
  getCrewOrderDef,
  getCrewOrderDuration,
  getCrewOrderTargetId,
  getCrewOrderTargetLabel,
  getEngineerCoolingMultiplier,
  getEngineerHeatVentFraction,
  getEngineerRepairFraction,
  getEngineerShieldBurst,
  getEngineerShieldRechargeMultiplier,
  getGunnerCadenceMultiplier,
  getGunnerFocusDamageMultiplier,
  getPilotThrustMultiplier,
  getPilotTurnMultiplier,
  getTacticianCadenceMultiplier,
  getTacticianComboDecayMultiplier,
  getTacticianDroneDamageMultiplier,
  isOrderActive,
  tickCrewOrders,
  type CrewOrderId,
  type CrewOrdersState,
} from '../game/crew-orders';
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
  rollAffixes,
  getAvailableAffixes,
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
import {
  type LegacyState,
  type RunSnapshot,
  loadLegacyState,
  persistLegacyState,
  finalizeRun,
  computeLegacyXp,
  getLegacySummary,
  getActiveBonusEffects,
  getRebuildPersistentEffects,
  getCreditPercentBoost,
  STARTING_BONUSES,
  MILESTONES,
  DEFAULT_LEGACY_STATE,
  MAX_ACTIVE_BONUSES,
} from '../game/legacy';
import {
  createAtmosphere,
  tickAtmosphere,
} from '../game/atmosphere';
import {
  createBossAI,
  updateBossAI,
  isBossVulnerable,
  isBossWave,
  isBossAttackActive,
  getActiveBossAttack,
  getBossPhaseMultipliers,
  getBossPhaseAnnouncement,
  getBossWarningText,
  getBossHpMultiplier,
  getBossName,
  isPointInBossAttackArea,
  getPhaseDef,
  type BossAIState,
  type BossTelegraph,
} from '../game/boss-encounters';
import {
  type SalvageResult,
  type SalvagedBlueprint,
  RARITY_CONFIG,
  DEFAULT_SALVAGE_COLLECTION,
  rollSalvage,
  addSalvageEntry,
  recordSalvageAttempt,
  loadSalvageCollection,
  persistSalvageCollection,
} from '../game/salvage';
import {
  extractCorruptedModule,
  loadLineageLocker,
  persistLineageLocker,
  addToLocker,
  type CorruptedModule,
} from '../game/lineage';
import {
  type WingmanState,
  type WingmanConfig,
  createWingmanState,
  startWingmanRun,
  killWingman,
  updateWingmanTimers,
  computeWingmanAI,
  getWingmanSpawnPoint,
  recordWingmanDamage,
  recordWingmanKill,
  WINGMAN_FIRE_RATE_MULT,
  WINGMAN_DAMAGE_MULT,
  loadWingmanConfig,
} from '../game/wingman';
import {
  playBossPhaseTransition,
  playBossTelegraph,
  playBossAttack,
  playBossDefeated,
  playRiftActivate,
  playRiftDeactivate,
  playRiftEmpPulse,
  playRiftShockwaveBurst,
} from '../game/audio';
import {
  createMusicDirector,
  updateMusicDirector,
  triggerBeat,
  triggerDramaticMoment,
  initMusicAudio,
  resetMusicDirector,
  destroyMusicAudio,
  applyMusicSettings,
  type MusicDirectorState,
} from '../game/music-director';
import {
  type MutagenState,
  type MutagenId,
  loadMutagenState,
  persistMutagenState,
  createMutagenState,
  collectEssenceFromKill,
  absorbEssence,
  computeMutagenStats,
  getMutationDef,
  getMutationStacks,
  hasMutations,
  canAbsorbNew,
  hasDeathExplosion,
  getDeathExplosionDamage,
  MAX_ESSENCE_SLOTS,
} from '../game/mutagen';
import {
  type ActiveContract,
  type ContractOffer,
  acceptContract,
  armContract,
  generateContractOffers,
  getContractProgressLabel,
  isTerminalContract,
  registerContractHullDamage,
  registerContractKill,
  registerPriorityTargetKill,
  resolveContractOnWaveEnd,
  tickContract,
} from '../game/contracts';
import {
  type CrisisEffectId,
  type CrisisState,
  type CrisisEventDef,
  createCrisisState,
  shouldTriggerCrisis,
  prepareCrisisEvent,
  resolveCrisisChoice,
  markCrisisResolved,
  isCrisisPending,
  getActiveEffectLabels,
  getOverchargeHpCost,
  getOverchargeDamageMult,
  getOverchargeDurationBonus,
  getOverdriveChargeMult,
  getAbilityCooldownReduction,
  getAbilityShieldBubble,
  getDashCooldownMult,
  getDashGhostDuration,
  getEnemyProjectileSpeedMult,
  getPlayerThrustMult,
  getDamageTakenMult,
  getEliteKillBuffDuration,
  getEliteKillDamageBuff,
  getEliteKillFireRateBuff,
  getExtraEnemyAffixes,
  getComboHpRegen,
  getComboTimerDecayMult,
  getMutagenStatMult,
  getUpgradeCostReduction,
  getUpgradeStatMult,
  shouldClearMutations,
} from '../game/critical-events';
import {
  type SigilState,
  type SigilDef,
  createSigilState,
  activateSigil,
  advanceSigilTier,
  clearTierUpPending,
  resetWaveState,
  registerSigilKill,
  tickSigilTimers,
  consumeDefensiveSave,
  getSigilEffects,
  generateSigilOffers,
  isFreePurchaseWave,
  consumeFreePurchase,
  getShopCostMult,
  SIGIL_CATALOG,
  getSigilDef,
  type SigilId,
} from '../game/sigils';

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
  weaponCooldowns: number[];
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  hp: number;
  heat: number;
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
  /** Whether this ship is a boss (endless mode boss waves). */
  isBoss?: boolean;
  /** Boss HP scaling applied at spawn so rebuilds can preserve it. */
  bossHpMult?: number;
  /** Whether this ship is a recurring nemesis. */
  isNemesis?: boolean;
  /** Persistent nemesis profile ID, if applicable. */
  nemesisProfileId?: string;
  /** Whether this ship is a wingman (AI companion). */
  isWingman?: boolean;
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
  focusTargetId?: string;
  focusDamageMult?: number;
  ownerId?: string;
  ownerIsWingman?: boolean;
  nebulaBoosted?: boolean;
  nearMissChecked?: boolean;
  /** Remaining pierce count for Warp Lance projectiles. */
  pierceRemaining?: number;
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
  private arenaRing!: THREE.LineLoop;
  private arenaStars!: THREE.Points;
  private arenaGrid!: THREE.Group;
  private arenaGridMaterial!: THREE.MeshBasicMaterial;
  private atmosphere = createAtmosphere();
  private nebulaEmitAccum = 0;
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
  private readonly touchControlsEnabled = shouldEnableTouchControls(readTouchControlEnvironment());
  private audioSettings: AudioSettings = loadAudioSettings();
  private mobileMoveInput = { x: 0, y: 0 };
  private mobileAimInput = { x: 0, y: 0, magnitude: 0 };
  private mobileFireHeld = false;
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

  // Boss encounter system
  private bossAI: BossAIState | null = null;
  private bossShip: RuntimeShip | null = null;
  private bossAnnouncement = '';
  private bossAnnouncementTimer = 0;
  private bossWarning = '';
  private bossTelegraphPlayed = false;
  private bossAttackPlayed = false;
  private readonly bossTelegraphGroup = new THREE.Group();

  // Battle music director
  private musicState = createMusicDirector();
  /** Track damage taken for music intensity (resets after no damage for 3s). */
  private recentDamageTime = 0;

  // Run report card stats
  private runStats: RunStats = { ...DEFAULT_RUN_STATS };

  // Upgrade shop
  private upgradeStats: LiveUpgradeStats = defaultLiveUpgradeStats();

  /** Upgrade stats with mutator stat mods applied. Use this for all reads. */
  private get effectiveStats(): LiveUpgradeStats {
    return applyMutatorStatMods(this.upgradeStats, this.activeMutators);
  }
  private purchasedUpgrades: PurchasedUpgrade[] = [];
  private shopOpen = false;
  private shopOptions: UpgradeDef[] = [];
  private shopWaveCleared = 0;
  private shopTargetWave = 1;
  private contractOffers: ContractOffer[] = [];
  private activeContract: ActiveContract | null = null;
  private contractAnnouncement = '';
  private contractAnnouncementTimer = 0;

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
  /** Per-ship nebula shield drain multiplier, written by updateShipHazards and read by shield recharge. */
  private readonly shipNebulaDrain = new Map<string, number>();

  // Pickups
  private readonly pickupGroup = new THREE.Group();
  private readonly pickups: PickupState[] = [];
  private readonly pickupMeshes = new Map<string, THREE.Object3D>();
  private playerBuffs: ActiveBuff[] = [];
  private dashState: DashState = createDashState();
  private comboState: ComboState = createComboState();
  private combatFeedback: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
  private overdriveState: OverdriveState = createOverdriveState();
  private nearMissState: NearMissState = createNearMissState();
  private crewOrdersState: CrewOrdersState = createCrewOrdersState();
  private crewOrderAnnouncement = '';
  private crewOrderAnnouncementTimer = 0;
  private pickupAnnouncement = '';
  private pickupAnnouncementTimer = 0;

  // Legacy Codex (persistent cross-run progression)
  private legacyState: LegacyState = { ...DEFAULT_LEGACY_STATE };
  private legacyFinalized = false;
  private chronicleSaved = false;
  private legacyNewMilestones: typeof MILESTONES = [];

  // Blueprint Scavenging (salvage system)
  private salvageCollection = { ...DEFAULT_SALVAGE_COLLECTION };
  private salvageRunCount = 0;
  private lineageLocker: import('../game/lineage').LineageLocker = { modules: [] };
  private lineageAnnouncement = '';
  private lineageAnnouncementTimer = 0;
  private salvageAnnouncement = '';
  private salvageAnnouncementTimer = 0;
  private runSalvagedEntries: SalvagedBlueprint[] = [];
  private runCorruptedEntries: CorruptedModule[] = [];

  // Persistent rival / nemesis system
  private nemesisState: NemesisState = loadNemesisState();
  private nemesisShip: RuntimeShip | null = null;
  private nemesisAnnouncement = '';
  private nemesisAnnouncementTimer = 0;
  private nemesisKillsThisRun = 0;

  // Wingman system
  private wingmanState: WingmanState = createWingmanState();
  private wingmanShip: RuntimeShip | null = null;
  private wingmanFireTimer = 0;

  // Mutagen system
  private mutagenState: MutagenState = createMutagenState();
  private mutagenStats = computeMutagenStats([]);
  private mutagenAnnouncement = '';
  private mutagenAnnouncementTimer = 0;

  // Critical events (Crisis Protocol)
  private crisisState: CrisisState = createCrisisState();
  /** Timer for neural link elite kill buff (seconds remaining) */
  private crisisEliteKillBuffTimer = 0;
  /** Timer for dash ghost (seconds remaining) */
  private crisisDashGhostTimer = 0;
  /** Dash ghost ship reference (fires player weapons) */
  private crisisDashGhostShip: RuntimeShip | null = null;

  // ── Arena Rift ────────────────────────────────────────────
  private arenaRift: ArenaRiftActive | null = null;
  private lastRiftType: ArenaRiftType | null = null;
  private riftRingMesh: THREE.Mesh | null = null;
  private riftWellMesh: THREE.Mesh | null = null;
  private empFlashTimer = 0;
  private riftEventsSurvived = 0;

  // Pilot Sigil system (run identity)
  private sigilState: SigilState = createSigilState();
  private sigilOffers: SigilDef[] = [];
  private sigilSelectionOpen = false;
  private sigilEffects = getSigilEffects(createSigilState());
  private sigilShotCounter = 0;
  private sigilFocusTarget: string | null = null;
  private sigilFocusHits = 0;
  private sigilAnnouncement = '';
  private sigilAnnouncementTimer = 0;

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
    this.audioSettings = loadAudioSettings();
    applySfxSettings(this.audioSettings);
    applyMusicSettings(this.audioSettings);

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

    // Load legacy state for endless mode
    if (this.isEndlessMode) {
      this.legacyState = loadLegacyState();
      this.salvageCollection = loadSalvageCollection();
      this.salvageRunCount = this.salvageCollection.totalAttempts;
      this.lineageLocker = loadLineageLocker();
      this.mutagenState = loadMutagenState();
      this.mutagenStats = computeMutagenStats(this.mutagenState.mutations);
      // Deploy saved wingman if one is selected
      const savedWingman = loadWingmanConfig();
      if (savedWingman) {
        const entry = this.salvageCollection.entries.find((e) => e.id === savedWingman.blueprintId);
        if (entry) {
          this.wingmanState = startWingmanRun(savedWingman);
        }
      }
    }

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const rim = new THREE.DirectionalLight(0xbfe1ff, 1.1);
    rim.position.set(8, 10, 6);
    this.scene.add(ambient, rim, this.arenaGroup, this.projectileGroup, this.effectGroup, this.healthBarGroup, this.particles.group, this.hazardGroup, this.pickupGroup, this.bossTelegraphGroup);

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
      this.clearMobileInputs();
      // Do NOT rebuild HUD every frame — that destroys DOM elements
      // and prevents click events from landing. The HUD is already built
      // from the call that set shopOpen=true or from refreshHud() below.
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateCameraFollow(dt);
    this.updateWaveDelay(dt);
    this.updateOverdrive(dt);
    this.updateCrewOrders(dt);
    this.updateNearMiss(dt);
    const overdriveScale = getOverdriveTimeScale(this.overdriveState);
    const nearMissResult = tickNearMiss(this.nearMissState, 0);
    const enemyDt = dt * getEnemyTimeScale(overdriveScale, nearMissResult.timeScale);
    this.updatePlayer(dt);
    this.updateProtectedAllies(enemyDt);
    this.updateEnemies(enemyDt);
    this.updateDrones(enemyDt);
    this.updateProjectiles(enemyDt);
    this.updateEffects(enemyDt);
    this.particles.update(dt);
    tickFloatingTexts(this.combatFeedback, dt, this.scene);
    tickMuzzleFlashes(this.combatFeedback, dt, this.scene);
    tickDeathExplosions(this.combatFeedback, dt, this.scene);
    this.updateThrustTrails(dt);
    this.updateScreenShake(dt);
    this.coolShips(dt);
    this.updateHazards(dt);
    this.updateShipHazards(dt);
    this.updatePickups(dt);
    this.updatePlayerBuffs(dt);
    this.updateCombo(dt);
    // Sigil: tick timers (streak countdown)
    this.sigilState = tickSigilTimers(this.sigilState, dt);
    this.updateBoss(dt);
    this.updateMusic(dt);
    this.updateAtmosphere(dt);
    this.updateWingman(dt);
    this.updateContracts(dt);
    this.updateArenaRift(dt);
    // Tick crisis event timers
    if (this.crisisEliteKillBuffTimer > 0) {
      this.crisisEliteKillBuffTimer -= dt;
      if (this.crisisEliteKillBuffTimer <= 0) this.crisisEliteKillBuffTimer = 0;
    }
    if (this.crisisDashGhostTimer > 0) {
      this.crisisDashGhostTimer -= dt;
      // Ghost auto-fires at the nearest enemy
      if (this.crisisDashGhostShip && this.crisisDashGhostShip.alive) {
        const ghost = this.crisisDashGhostShip;
        ghost.weaponCooldowns = ghost.weaponCooldowns.map(c => Math.max(0, c - dt));
        if (ghost.weaponCooldowns.some(c => c <= 0) && ghost.weapons.length > 0) {
          const nearest = this.findNearestEnemy(ghost);
          if (nearest) {
            const dir = new THREE.Vector3().subVectors(nearest.position, ghost.position).normalize();
            this.tryFire(ghost, dir);
            ghost.weaponCooldowns = ghost.weaponCooldowns.map(() => 0.5);
          }
        }
        // Fade ghost opacity as timer runs down
        const fadeFrac = Math.min(1, this.crisisDashGhostTimer);
        ghost.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material instanceof THREE.Material) {
              mesh.material.opacity = 0.35 * fadeFrac;
            }
          }
        });
      }
      if (this.crisisDashGhostTimer <= 0) {
        this.crisisDashGhostTimer = 0;
        if (this.crisisDashGhostShip) {
          this.scene.remove(this.crisisDashGhostShip.group);
          this.crisisDashGhostShip.group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh && mesh.material instanceof THREE.Material) {
              mesh.material.dispose();
            }
          });
        }
        this.crisisDashGhostShip = null;
      }
    }
    // Symbiote bond: combo HP regen
    const hpRegen = getComboHpRegen(this.crisisState.activeEffects);
    if (hpRegen > 0 && this.comboState.kills >= 3 && this.player.alive && this.player.hp < this.player.stats.maxHp) {
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + this.player.stats.maxHp * hpRegen * dt);
    }
    // Fade out elite announcement
    if (this.eliteAnnouncementTimer > 0) {
      this.eliteAnnouncementTimer -= dt;
      if (this.eliteAnnouncementTimer <= 0) this.eliteAnnouncement = '';
    }
    // Fade out salvage announcement
    if (this.salvageAnnouncementTimer > 0) {
      this.salvageAnnouncementTimer -= dt;
      if (this.salvageAnnouncementTimer <= 0) this.salvageAnnouncement = '';
    }
    if (this.lineageAnnouncementTimer > 0) {
      this.lineageAnnouncementTimer -= dt;
      if (this.lineageAnnouncementTimer <= 0) this.lineageAnnouncement = '';
    }
    if (this.mutagenAnnouncementTimer > 0) {
      this.mutagenAnnouncementTimer -= dt;
      if (this.mutagenAnnouncementTimer <= 0) this.mutagenAnnouncement = '';
    }
    if (this.nemesisAnnouncementTimer > 0) {
      this.nemesisAnnouncementTimer -= dt;
      if (this.nemesisAnnouncementTimer <= 0) this.nemesisAnnouncement = '';
    }
    if (this.crewOrderAnnouncementTimer > 0) {
      this.crewOrderAnnouncementTimer -= dt;
      if (this.crewOrderAnnouncementTimer <= 0) this.crewOrderAnnouncement = '';
    }
    if (this.contractAnnouncementTimer > 0) {
      this.contractAnnouncementTimer -= dt;
      if (this.contractAnnouncementTimer <= 0) this.contractAnnouncement = '';
    }
    if (this.sigilAnnouncementTimer > 0) {
      this.sigilAnnouncementTimer -= dt;
      if (this.sigilAnnouncementTimer <= 0) this.sigilAnnouncement = '';
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
    destroyMusicAudio();
    disposeCombatFeedback(this.combatFeedback, this.scene);
    this.uiRoot.innerHTML = '';
  }

  private attachEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    // Delegated event handler for all shop/sigil/crisis UI inside #flight-hud.
    // Runs on the stable parent element — no per-frame re-attachment needed.
    // Listens on both 'click' and 'pointerdown' to cover all input modes.
    const flightHud = this.uiRoot.querySelector('#flight-hud');
    if (flightHud) {
      const handleHudInteraction = (e: Event) => {
        const target = (e.target as HTMLElement).closest('[data-sigil],[data-crisis],[data-contract],[data-upgrade],[data-mutator],[data-absorb],[data-action]') as HTMLElement | null;
        if (!target) return;

        // Sigil selection
        if (target.dataset.sigil) {
          if (!this.sigilSelectionOpen) return;
          const sigilId = target.dataset.sigil as SigilId;
          if (!sigilId) return;
          this.sigilState = activateSigil(this.sigilState, sigilId);
          this.sigilSelectionOpen = false;
          this.sigilOffers = [];
          this.sigilEffects = getSigilEffects(this.sigilState);
          this.applySigilTradeOffs();
          this.shopOpen = false;
          const def = getSigilDef(sigilId);
          this.sigilAnnouncement = `${def?.icon} ${def?.displayName} — ${def?.tagline}`;
          this.sigilAnnouncementTimer = 3;
          this.spawnWave(1);
          return;
        }

        // Crisis choice
        if (target.dataset.crisis) {
          const effectId = target.dataset.crisis as CrisisEffectId;
          if (!effectId) return;
          this.crisisState = resolveCrisisChoice(this.crisisState, effectId);
          this.crisisState = markCrisisResolved(this.crisisState, this.currentWave);

          if (shouldClearMutations(this.crisisState.activeEffects)) {
            this.mutagenState = { ...this.mutagenState, mutations: [] };
            this.mutagenStats = computeMutagenStats([]);
            persistMutagenState(this.mutagenState);
            this.rebuildPlayerWithUpgrades();
          }

          const cdReduction = getAbilityCooldownReduction(this.crisisState.activeEffects);
          if (cdReduction > 0) {
            for (const ability of this.player.abilities) {
              ability.def = { ...ability.def, cooldown: ability.def.cooldown * (1 - cdReduction) };
            }
          }

          this.closeUpgradeShop();
          return;
        }

        // Contract accept
        if (target.dataset.contract !== undefined) {
          const idx = parseInt(target.dataset.contract ?? '0', 10);
          const offer = this.contractOffers[idx];
          if (!offer) return;
          this.activeContract = acceptContract(offer);
          this.contractOffers = [];
          this.contractAnnouncement = `📜 Contract accepted — ${offer.displayName}`;
          this.contractAnnouncementTimer = 2.5;
          this.refreshHud();
          return;
        }

        // Upgrade purchase
        if (target.dataset.upgrade !== undefined) {
          const idx = parseInt(target.dataset.upgrade ?? '0', 10);
          if (this.shopOptions[idx]) this.purchaseUpgrade(this.shopOptions[idx]);
          return;
        }

        // Mutator trait
        if (target.dataset.mutator !== undefined) {
          const idx = parseInt(target.dataset.mutator ?? '0', 10);
          if (this.shopMutatorOptions[idx]) this.purchaseMutator(this.shopMutatorOptions[idx]);
          return;
        }

        // Mutagen essence absorb
        if (target.dataset.absorb !== undefined) {
          const idx = parseInt(target.dataset.absorb ?? '0', 10);
          this.mutagenState = absorbEssence(this.mutagenState, idx);
          persistMutagenState(this.mutagenState);
          this.mutagenStats = computeMutagenStats(this.mutagenState.mutations);
          this.rebuildPlayerWithUpgrades();
          this.refreshHud();
          return;
        }

        // Skip upgrade button
        if (target.dataset.action === 'skip-upgrade') {
          this.closeUpgradeShop();
          return;
        }
      };
      flightHud.addEventListener('click', handleHudInteraction);
    }
  }

  private clearMobileInputs(): void {
    this.mobileMoveInput = { x: 0, y: 0 };
    this.mobileAimInput = { x: 0, y: 0, magnitude: 0 };
    this.mobileFireHeld = false;
    const moveThumb = this.uiRoot.querySelector<HTMLElement>('#mobile-move-thumb');
    if (moveThumb) {
      moveThumb.style.left = '50%';
      moveThumb.style.top = '50%';
    }
    const aimThumb = this.uiRoot.querySelector<HTMLElement>('#mobile-aim-thumb');
    if (aimThumb) {
      aimThumb.style.left = '50%';
      aimThumb.style.top = '50%';
    }
    this.uiRoot.querySelector<HTMLElement>('#mobile-aim-zone')?.classList.remove('active');
  }

  private updateMouseWorldFromClientPoint(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.mouseWorld);
  }

  private updateMobileMoveInput(clientX: number, clientY: number): void {
    const zone = this.uiRoot.querySelector<HTMLElement>('#mobile-move-zone');
    const thumb = this.uiRoot.querySelector<HTMLElement>('#mobile-move-thumb');
    if (!zone || !thumb) return;
    const rect = zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.28;
    const state = normalizeVirtualStick(clientX - centerX, clientY - centerY, radius);
    this.mobileMoveInput = { x: state.x, y: -state.y };
    thumb.style.left = `calc(50% + ${state.thumbX}px)`;
    thumb.style.top = `calc(50% + ${state.thumbY}px)`;
  }

  private syncMobileAimTarget(): void {
    if (this.mobileAimInput.magnitude <= 0.01) return;
    const aimDistance = 14;
    this.mouseWorld.set(
      this.player.position.x + this.mobileAimInput.x * aimDistance,
      0,
      this.player.position.z - this.mobileAimInput.y * aimDistance,
    );
  }

  private updateMobileAimInput(clientX: number, clientY: number): void {
    const zone = this.uiRoot.querySelector<HTMLElement>('#mobile-aim-zone');
    const thumb = this.uiRoot.querySelector<HTMLElement>('#mobile-aim-thumb');
    if (!zone || !thumb) return;
    const rect = zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.32;
    const state = normalizeVirtualStick(clientX - centerX, clientY - centerY, radius, 0.12);
    this.mobileAimInput = { x: state.x, y: -state.y, magnitude: state.magnitude };
    thumb.style.left = `calc(50% + ${state.thumbX}px)`;
    thumb.style.top = `calc(50% + ${state.thumbY}px)`;
    this.syncMobileAimTarget();
  }

  private renderMobileControls(): string {
    if (!this.touchControlsEnabled) return '';
    return `
      <div class="overlay mobile-controls" id="mobile-controls">
        <div class="mobile-stick-zone" id="mobile-move-zone">
          <div class="mobile-stick-base">
            <div class="mobile-stick-thumb" id="mobile-move-thumb"></div>
          </div>
          <div class="mobile-zone-label">Move</div>
        </div>
        <div class="mobile-action-stack">
          <div class="mobile-aim-zone" id="mobile-aim-zone">
            <div class="mobile-stick-thumb mobile-aim-thumb" id="mobile-aim-thumb"></div>
            <span>Aim + Fire</span>
          </div>
          <div class="mobile-action-group">
            <div class="mobile-action-group-label">Ship Systems</div>
            <div class="mobile-button-grid">
              <button class="mobile-action-button" data-touch-action="dash"><span>Dash</span><small>Ready</small></button>
              <button class="mobile-action-button" data-touch-action="overdrive"><span>Drive</span><small>Charge</small></button>
              <button class="mobile-action-button" data-touch-action="ability:shield_boost"><span>Shield</span><small>1</small></button>
              <button class="mobile-action-button" data-touch-action="ability:afterburner"><span>Burn</span><small>2</small></button>
              <button class="mobile-action-button" data-touch-action="ability:overcharge"><span>Charge</span><small>3</small></button>
              <button class="mobile-action-button" data-touch-action="ability:emergency_repair"><span>Repair</span><small>4</small></button>
            </div>
          </div>
          <div class="mobile-action-group">
            <div class="mobile-action-group-label">Crew Orders</div>
            <div class="mobile-button-grid mobile-crew-grid">
              <button class="mobile-action-button mobile-crew-button" data-touch-action="crew:pilot_surge"><span>Pilot</span><small>Z</small></button>
              <button class="mobile-action-button mobile-crew-button" data-touch-action="crew:gunner_focus"><span>Gunner</span><small>X</small></button>
              <button class="mobile-action-button mobile-crew-button" data-touch-action="crew:engineer_reroute"><span>Eng.</span><small>C</small></button>
              <button class="mobile-action-button mobile-crew-button" data-touch-action="crew:tactician_link"><span>Tact.</span><small>B</small></button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachMobileControls(): void {
    if (!this.touchControlsEnabled) return;
    const moveZone = this.uiRoot.querySelector<HTMLElement>('#mobile-move-zone');
    const aimZone = this.uiRoot.querySelector<HTMLElement>('#mobile-aim-zone');
    if (moveZone) {
      let movePointerId: number | null = null;
      const releaseMove = (event?: PointerEvent) => {
        if (event && movePointerId !== event.pointerId) return;
        movePointerId = null;
        this.mobileMoveInput = { x: 0, y: 0 };
        const thumb = this.uiRoot.querySelector<HTMLElement>('#mobile-move-thumb');
        if (thumb) {
          thumb.style.left = '50%';
          thumb.style.top = '50%';
        }
      };
      moveZone.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        resumeAudio();
        movePointerId = event.pointerId;
        moveZone.setPointerCapture(event.pointerId);
        this.updateMobileMoveInput(event.clientX, event.clientY);
      });
      moveZone.addEventListener('pointermove', (event) => {
        if (movePointerId !== event.pointerId) return;
        event.preventDefault();
        this.updateMobileMoveInput(event.clientX, event.clientY);
      });
      moveZone.addEventListener('pointerup', releaseMove);
      moveZone.addEventListener('pointercancel', releaseMove);
    }
    if (aimZone) {
      let aimPointerId: number | null = null;
      const releaseAim = (event?: PointerEvent) => {
        if (event && aimPointerId !== event.pointerId) return;
        aimPointerId = null;
        this.mobileAimInput = { x: 0, y: 0, magnitude: 0 };
        this.mobileFireHeld = false;
        const thumb = this.uiRoot.querySelector<HTMLElement>('#mobile-aim-thumb');
        if (thumb) {
          thumb.style.left = '50%';
          thumb.style.top = '50%';
        }
        aimZone.classList.remove('active');
      };
      aimZone.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        resumeAudio();
        aimPointerId = event.pointerId;
        aimZone.setPointerCapture(event.pointerId);
        this.mobileFireHeld = true;
        aimZone.classList.add('active');
        this.updateMobileAimInput(event.clientX, event.clientY);
      });
      aimZone.addEventListener('pointermove', (event) => {
        if (aimPointerId !== event.pointerId) return;
        event.preventDefault();
        this.updateMobileAimInput(event.clientX, event.clientY);
      });
      aimZone.addEventListener('pointerup', releaseAim);
      aimZone.addEventListener('pointercancel', releaseAim);
    }
    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-touch-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.touchAction;
        if (!action) return;
        resumeAudio();
        if (action === 'dash') {
          this.activatePlayerDash();
          return;
        }
        if (action === 'overdrive') {
          this.activatePlayerOverdrive();
          return;
        }
        if (action.startsWith('ability:')) {
          this.activatePlayerAbility(action.slice('ability:'.length) as AbilityId);
          return;
        }
        if (action.startsWith('crew:')) {
          this.activateCrewOrder(action.slice('crew:'.length) as CrewOrderId);
        }
      });
    });
  }

  private syncMobileButton(action: string, detail: string, disabled: boolean, active = false): void {
    const button = this.uiRoot.querySelector<HTMLButtonElement>(`[data-touch-action="${action}"]`);
    if (!button) return;
    const detailEl = button.querySelector('small');
    if (detailEl) detailEl.textContent = detail;
    button.disabled = disabled;
    button.classList.toggle('active', active);
    button.classList.toggle('cooldown', !active && !disabled && detail !== 'Ready');
    button.classList.toggle('unavailable', disabled);
  }

  private syncMobileControls(): void {
    if (!this.touchControlsEnabled) return;
    this.syncMobileButton(
      'dash',
      isDashing(this.dashState) ? 'Active' : canDash(this.dashState) ? 'Ready' : `${Math.ceil(this.dashState.cooldownRemaining)}s`,
      !this.player.alive || this.shopOpen || (!canDash(this.dashState) && !isDashing(this.dashState)),
      isDashing(this.dashState),
    );

    const overdriveReady = canActivateOverdrive(this.overdriveState);
    const overdriveActive = this.overdriveState.phase === 'active';
    const overdriveDetail = overdriveActive
      ? `${Math.ceil(this.overdriveState.activeTimer)}s`
      : this.overdriveState.phase === 'cooldown'
        ? `${Math.ceil(this.overdriveState.cooldownTimer)}s`
        : overdriveReady
          ? 'Ready'
          : `${Math.floor(this.overdriveState.charge * 100)}%`;
    this.syncMobileButton('overdrive', overdriveDetail, !this.player.alive || this.shopOpen || (!overdriveReady && !overdriveActive), overdriveActive);

    const syncAbility = (id: AbilityId) => {
      const ability = this.player.abilities.find((entry) => entry.def.id === id);
      if (!ability) return;
      const active = ability.activeRemaining > 0;
      const ready = ability.cooldownRemaining <= 0;
      this.syncMobileButton(
        `ability:${id}`,
        active ? `${Math.ceil(ability.activeRemaining)}s` : ready ? 'Ready' : `${Math.ceil(ability.cooldownRemaining)}s`,
        !this.player.alive || this.shopOpen || (!ready && !active),
        active,
      );
    };
    syncAbility('shield_boost');
    syncAbility('afterburner');
    syncAbility('overcharge');
    syncAbility('emergency_repair');

    for (const def of CREW_ORDER_DEFS) {
      const activeRemaining = getActiveRemaining(this.crewOrdersState, def.id);
      const cooldownRemaining = getCooldownRemaining(this.crewOrdersState, def.id);
      const available = this.player.blueprint.crew[def.role] > 0;
      const ready = canActivateCrewOrder(this.crewOrdersState, def.id, this.player.blueprint.crew);
      this.syncMobileButton(
        `crew:${def.id}`,
        !available ? 'Need crew' : activeRemaining > 0 ? `${Math.ceil(activeRemaining)}s` : ready ? 'Ready' : `${Math.ceil(cooldownRemaining)}s`,
        !this.player.alive || this.shopOpen || (!available && activeRemaining <= 0) || (!ready && activeRemaining <= 0),
        activeRemaining > 0,
      );
    }
  }

  private buildUi(): void {
    this.uiRoot.innerHTML = `
      <div class="overlay top-left panel compact-panel" id="flight-hud"></div>
      <div class="overlay top-right panel compact-panel">
        <strong>Flight Test</strong>
        <p class="muted">A reduced Three.js combat slice of the original sandbox plans.</p>
        <div id="flight-debrief" class="muted"></div>
        <div id="flight-audio-controls"></div>
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
          <li>Z/X/C/B: Crew Orders</li>
          ${this.touchControlsEnabled ? '<li>Touch: left stick moves, right aim pad steers fire, buttons trigger dash, abilities, and crew orders</li>' : ''}
        </ul>
      </div>
      ${this.renderMobileControls()}
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
    this.attachMobileControls();
    this.refreshFlightAudioControls();
  }

  private updateAudioSettings(nextSettings: AudioSettings): void {
    this.audioSettings = nextSettings;
    persistAudioSettings(this.audioSettings);
    applySfxSettings(this.audioSettings);
    applyMusicSettings(this.audioSettings);
    this.refreshFlightAudioControls();
  }

  private refreshFlightAudioControls(): void {
    const audioEl = this.uiRoot.querySelector<HTMLElement>('#flight-audio-controls');
    if (!audioEl) return;
    const musicToggle = this.audioSettings.musicMuted ? 'Unmute Music' : 'Mute Music';
    const sfxToggle = this.audioSettings.sfxMuted ? 'Unmute SFX' : 'Mute SFX';
    audioEl.innerHTML = `
      <div class="audio-inline-summary">🎛️ Music ${getAudioPercentLabel(this.audioSettings, 'music')}${this.audioSettings.musicMuted ? ' · muted' : ''} · SFX ${getAudioPercentLabel(this.audioSettings, 'sfx')}${this.audioSettings.sfxMuted ? ' · muted' : ''}</div>
      <div class="toolbar-row compact-toolbar-row">
        <button data-audio-step="-0.1" data-audio-channel="music">Music −</button>
        <button data-audio-step="0.1" data-audio-channel="music">Music +</button>
        <button data-audio-toggle="music">${musicToggle}</button>
      </div>
      <div class="toolbar-row compact-toolbar-row">
        <button data-audio-step="-0.1" data-audio-channel="sfx">SFX −</button>
        <button data-audio-step="0.1" data-audio-channel="sfx">SFX +</button>
        <button data-audio-toggle="sfx">${sfxToggle}</button>
      </div>
    `;
    audioEl.querySelectorAll<HTMLButtonElement>('[data-audio-toggle]').forEach((button) => {
      button.onclick = () => {
        const channel = button.dataset.audioToggle as AudioChannel | undefined;
        if (!channel) return;
        this.updateAudioSettings(toggleAudioMuted(this.audioSettings, channel));
      };
    });
    audioEl.querySelectorAll<HTMLButtonElement>('[data-audio-step]').forEach((button) => {
      button.onclick = () => {
        const channel = button.dataset.audioChannel as AudioChannel | undefined;
        const delta = Number(button.dataset.audioStep ?? 0);
        if (!channel || !delta) return;
        this.updateAudioSettings(stepAudioVolume(this.audioSettings, channel, delta));
      };
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

    // ── Circuit grid lines (reactive to combat intensity) ──
    this.arenaGrid = new THREE.Group();
    this.arenaGridMaterial = new THREE.MeshBasicMaterial({
      color: '#1e3a5f',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    // Concentric rings at radii 3, 6, 9, 12, 15
    for (const radius of [3, 6, 9, 12, 15]) {
      const segments = Math.max(24, Math.floor(radius * 4));
      const ringGeo = new THREE.RingGeometry(radius - 0.02, radius + 0.02, segments);
      const ringMesh = new THREE.Mesh(ringGeo, this.arenaGridMaterial);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.01;
      this.arenaGrid.add(ringMesh);
    }
    // Radial lines: 12 spokes from center
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const geo = new THREE.PlaneGeometry(ARENA_RADIUS * 0.9, 0.04);
      const spoke = new THREE.Mesh(geo, this.arenaGridMaterial);
      spoke.rotation.x = -Math.PI / 2;
      spoke.rotation.z = -angle;
      spoke.position.y = 0.01;
      this.arenaGrid.add(spoke);
    }
    this.arenaGroup.add(this.arenaGrid);

    // ── Arena ring ──
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 64 }, (_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(angle) * ARENA_RADIUS, 0.02, Math.sin(angle) * ARENA_RADIUS);
        }),
      ),
      new THREE.LineBasicMaterial({ color: '#1f3a57' }),
    );
    this.arenaRing = ring;
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

    this.arenaStars = new THREE.Points(
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
      new THREE.PointsMaterial({ color: '#dbeafe', size: 0.05, transparent: true, opacity: 0.7 }),
    );
    this.arenaGroup.add(this.arenaStars);
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
    this.clearMobileInputs();
    this.chronicleSaved = false;
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
    this.bossAI = null;
    this.bossShip = null;
    this.bossAnnouncement = '';
    this.bossAnnouncementTimer = 0;
    this.bossWarning = '';
    this.bossTelegraphPlayed = false;
    this.bossAttackPlayed = false;
    this.clearBossTelegraphs();
    initMusicAudio();
    this.musicState = resetMusicDirector(this.musicState);
    this.runStats = { ...DEFAULT_RUN_STATS };
    this.upgradeStats = defaultLiveUpgradeStats();
    this.purchasedUpgrades = [];
    this.shopOpen = false;
    this.shopOptions = [];
    this.contractOffers = [];
    this.activeContract = null;
    this.contractAnnouncement = '';
    this.contractAnnouncementTimer = 0;
    this.clearContractMarkers();
    this.activeMutators = [];
    this.shopMutatorOptions = [];
    this.dashState = createDashState();
    this.comboState = createComboState();
    this.overdriveState = createOverdriveState();
    this.crewOrdersState = createCrewOrdersState();
    this.crewOrderAnnouncement = '';
    this.crewOrderAnnouncementTimer = 0;
    this.clearCrewOrderMarkers();
    this.shopWaveCleared = 0;
    this.shopTargetWave = 1;
    this.legacyFinalized = false;
    this.legacyNewMilestones = [];
    this.runSalvagedEntries = [];
    this.runCorruptedEntries = [];
    this.nemesisShip = null;
    this.nemesisKillsThisRun = 0;
    this.nemesisAnnouncement = '';
    this.nemesisAnnouncementTimer = 0;
    this.mutagenState = { ...this.mutagenState, pendingEssence: [] };
    this.mutagenStats = computeMutagenStats(this.mutagenState.mutations);
    this.mutagenAnnouncement = '';
    this.mutagenAnnouncementTimer = 0;
    // Reset crisis state for new run
    this.crisisState = createCrisisState();
    this.crisisEliteKillBuffTimer = 0;
    this.crisisDashGhostTimer = 0;
    this.crisisDashGhostShip = null;
    this.arenaRift = null;
    this.lastRiftType = null;
    this.riftEventsSurvived = 0;
    this.clearRiftVisuals();
    // Reset wingman for new run and redeploy immediately if one is assigned.
    if (this.wingmanState.config) {
      this.wingmanState = startWingmanRun(this.wingmanState.config);
      this.wingmanShip = null;
      this.wingmanFireTimer = 0;
    }
    // Reset sigil state for new run
    this.sigilState = createSigilState();
    this.sigilOffers = [];
    this.sigilSelectionOpen = false;
    this.sigilEffects = getSigilEffects(createSigilState());
    this.sigilShotCounter = 0;
    this.sigilFocusTarget = null;
    this.sigilFocusHits = 0;
    this.sigilAnnouncement = '';
    this.sigilAnnouncementTimer = 0;
    this.waveAnnouncement = `${this.currentWave > 0 ? `Wave ${this.currentWave}` : 'Wave 1'} incoming...`;
    this.player = this.createShip('player-1', 'player', playerBlueprint, new THREE.Vector3(0, 0, 8), Math.PI, 0, 0);
    this.ships.push(this.player);

    // Spawn wingman if deployed
    if (this.isEndlessMode && this.wingmanState.active && this.wingmanState.config) {
      this.spawnWingman();
    }

    // Apply legacy starting bonuses in endless mode
    if (this.isEndlessMode) {
      this.applyLegacyBonuses();
      this.comboState.timeoutBonus = this.legacyComboWindowBonus;
    }
    // Apply permanent mutagen stats
    const mutagenMods = computeMutagenStats(this.mutagenState.mutations);
    const mutagenStatMult = getMutagenStatMult(this.crisisState.activeEffects);
    this.player.stats.maxHp = Math.round(this.player.stats.maxHp * mutagenMods.maxHpMultiplier * mutagenStatMult);
    this.player.stats.shieldStrength = Math.round(this.player.stats.shieldStrength * mutagenMods.shieldMultiplier * mutagenStatMult);
    this.player.stats.thrust *= mutagenMods.thrustMultiplier * mutagenStatMult;
    this.player.stats.armorRating += Math.round(mutagenMods.armorBonus * mutagenStatMult);
    this.player.maxShield = this.player.stats.shieldStrength;
    this.player.shield = Math.min(this.player.shield, this.player.maxShield);
    this.player.hp = Math.min(this.player.hp, this.player.stats.maxHp);
    this.mutagenStats = mutagenMods;
    this.spawnDronesForShip(this.player);
    if (this.encounterObjective.type === 'protect_ally') {
      const preset = getEncounterPreset(this.encounterId);
      if (preset?.alliedBlueprint) {
        const ally = this.createShip('ally-escort', 'player', cloneBlueprint(preset.alliedBlueprint), new THREE.Vector3(0, 0, 2), Math.PI, 0, 0, true);
        this.ships.push(ally);
      }
    }
    // Sigil selection: in endless mode, offer sigils before first wave
    if (this.isEndlessMode) {
      this.sigilOffers = generateSigilOffers();
      this.sigilSelectionOpen = true;
      this.shopOpen = true; // pause the game like the shop does
      this.waveAnnouncement = 'Choose your Pilot Sigil — this defines your run identity.';
      this.refreshHud();
    } else {
      this.spawnWave(1);
    }
  }

  private spawnWave(waveNumber: number): void {
    let wave = this.waves[waveNumber - 1];

    // Endless mode: generate wave procedurally
    if (!wave) {
      wave = generateEndlessWave(waveNumber);
      this.waves.push(wave);
    }

    // ── Arena Rift management ──
    if (this.isEndlessMode && shouldTriggerRift(waveNumber, this.arenaRift)) {
      const riftType = rollRiftType(this.lastRiftType, Math.random());
      this.lastRiftType = riftType;
      const riftState = createRiftState(riftType, Math.random());
      this.arenaRift = { rift: riftState, wavesRemaining: 2 };
      const def = getRiftDef(riftType);
      this.waveAnnouncement = `${def.icon} ${def.displayName} — ${def.description}`;
      this.setupRiftVisuals(riftState);
      playRiftActivate();
    } else if (this.arenaRift) {
      this.arenaRift.wavesRemaining -= 1;
      if (this.arenaRift.wavesRemaining <= 0) {
        this.riftEventsSurvived += 1;
        playRiftDeactivate();
        this.clearRiftVisuals();
        this.arenaRift = null;
      }
    }

    if (this.isEndlessMode && shouldSpawnNemesis(this.nemesisState, waveNumber)) {
      wave = injectNemesisIntoWave(this.nemesisState, wave, waveNumber);
      if (this.nemesisState.active) {
        this.nemesisAnnouncement = getNemesisBanner(this.nemesisState.active);
        this.nemesisAnnouncementTimer = 3.5;
      }
    }

    this.waveAnnouncement = `${wave.name} deployed`;

    // Boss wave initialization (endless mode, every 5th wave)
    const bossWave = this.isEndlessMode && isBossWave(waveNumber);
    if (bossWave) {
      this.bossAI = createBossAI(waveNumber);
      this.bossAnnouncement = `⚠ BOSS — ${getBossName(waveNumber)}`;
      this.bossAnnouncementTimer = 3.5;
      this.clearBossTelegraphs();
    } else {
      this.bossAI = null;
      this.bossShip = null;
    }

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
      // Mark boss ships and apply HP scaling
      if (bossWave) {
        runtimeShip.isBoss = true;
        const hpMult = getBossHpMultiplier(waveNumber);
        runtimeShip.bossHpMult = hpMult;
        runtimeShip.hp *= hpMult;
        runtimeShip.stats.maxHp *= hpMult;
        // Scale module HP to match
        for (const mod of runtimeShip.moduleStates) {
          mod.maxHp *= hpMult;
          mod.currentHp *= hpMult;
        }
        if (!this.bossShip) this.bossShip = runtimeShip;
      }
      if (enemy.nemesisProfileId) {
        runtimeShip.isNemesis = true;
        runtimeShip.nemesisProfileId = enemy.nemesisProfileId;
        runtimeShip.hp *= 1 + (enemy.nemesisLevel ?? 1) * 0.16;
        runtimeShip.stats.maxHp *= 1 + (enemy.nemesisLevel ?? 1) * 0.16;
        for (const mod of runtimeShip.moduleStates) {
          mod.maxHp *= 1 + (enemy.nemesisLevel ?? 1) * 0.16;
          mod.currentHp *= 1 + (enemy.nemesisLevel ?? 1) * 0.16;
        }
        this.nemesisShip = runtimeShip;
      }
      this.ships.push(runtimeShip);
      this.spawnDronesForShip(runtimeShip);
      // Apply elite affix stat modifications
      const combinedAffixes = [...(enemy.affixes ?? [])];
      // Crisis: Neural Link — enemies gain +1 extra affix
      const extraCount = getExtraEnemyAffixes(this.crisisState.activeEffects);
      if (extraCount > 0 && this.isEndlessMode) {
        const existingIds = new Set(combinedAffixes.map(a => a.def.id));
        const pool = getAvailableAffixes(this.currentWave).filter(a => !existingIds.has(a.id));
        for (let ei = 0; ei < extraCount && pool.length > 0; ei++) {
          const idx = Math.floor(Math.random() * pool.length);
          combinedAffixes.push({ def: pool[idx] });
          pool.splice(idx, 1);
        }
      }
      if (combinedAffixes.length > 0) {
        this.applyAffixMods(runtimeShip, combinedAffixes);
      }
      // Sigil: apply enemy stat modifiers (Entropy Field trade-off)
      // These are composited into the affix multiplier fields so tryFire picks them up.
      if (this.sigilEffects.enemyDamageMult !== 1) {
        runtimeShip.affixDamageMult = (runtimeShip.affixDamageMult ?? 1) * this.sigilEffects.enemyDamageMult;
      }
      if (this.sigilEffects.enemyFireRateMult !== 1) {
        runtimeShip.affixFireRateMult = (runtimeShip.affixFireRateMult ?? 1) * this.sigilEffects.enemyFireRateMult;
      }
    }

    if (this.activeContract && this.activeContract.waveNumber === waveNumber) {
      const armed = armContract(
        this.activeContract,
        wave.enemies.map((enemy) => ({
          id: enemy.id,
          label: enemy.blueprint.name,
          maxHp: computeShipStats(enemy.blueprint).maxHp,
          affixCount: enemy.affixes?.length ?? 0,
          isBoss: bossWave,
        })),
      );
      if (armed.kind === 'priority_target' && armed.targetShipId) {
        const targetShip = this.ships.find((ship) => ship.id === armed.targetShipId && ship.alive);
        if (targetShip) this.addContractMarker(targetShip);
      }
      if (isTerminalContract(armed)) {
        this.resolveActiveContract(armed);
      } else {
        this.activeContract = armed;
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
      weaponCooldowns: weapons.map(() => 0),
      group,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation,
      hp: Math.max(stats.maxHp, 60),
      heat: 0,
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
    if (this.mobileFireHeld && this.mobileAimInput.magnitude > 0.01) {
      this.syncMobileAimTarget();
    }
    const desiredRotation = Math.atan2(
      this.mouseWorld.x - this.player.position.x,
      this.mouseWorld.z - this.player.position.z,
    );
    this.player.rotation = lerpAngle(
      this.player.rotation,
      desiredRotation,
      Math.min(1, dt * 8 * getPilotTurnMultiplier(this.crewOrdersState, this.player.blueprint.crew)),
    );

    const forward = new THREE.Vector3(Math.sin(this.player.rotation), 0, Math.cos(this.player.rotation));
    const right = new THREE.Vector3(Math.cos(this.player.rotation), 0, -Math.sin(this.player.rotation));

    // ── Dash (Space) — before velocity so the first frame of dash is not wasted ──
    if (this.keys.has('Space') && canDash(this.dashState)) {
      this.activatePlayerDash();
    }
    this.dashState = updateDash(this.dashState, dt);

    const forwardInput = THREE.MathUtils.clamp(Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) + this.mobileMoveInput.y, -1, 1);
    const strafeInput = THREE.MathUtils.clamp(Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.mobileMoveInput.x, -1, 1);
    const crisisThrustMult = getPlayerThrustMult(this.crisisState.activeEffects);
    const effectiveThrust = getEffectiveThrust(
      Math.max(4, this.player.stats.thrust / 70 * crisisThrustMult * getPilotThrustMultiplier(this.crewOrdersState, this.player.blueprint.crew)),
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
      // Sigil: Void Walker tier 3 — dash damage to nearby enemies
      if (this.sigilEffects.dashDamageArmorMult > 0) {
        for (const enemy of this.ships.filter(s => s.team === 'enemy' && s.alive)) {
          const dist = enemy.position.distanceTo(this.player.position);
          if (dist < 2) {
            const dashDmg = this.player.stats.armorRating * this.sigilEffects.dashDamageArmorMult;
            const hitAngle = Math.atan2(
              this.player.position.x - enemy.position.x,
              this.player.position.z - enemy.position.z,
            );
            this.applyDamage(enemy, dashDmg, 'kinetic', 0, hitAngle);
          }
        }
      }
    }

    this.player.position.addScaledVector(this.player.velocity, dt);

    this.clampToArena(this.player.position);

    if (this.fireHeld || (this.mobileFireHeld && this.mobileAimInput.magnitude > 0.08)) {
      this.tryFire(this.player, this.mouseWorld.clone().sub(this.player.position).normalize());
    }

    // ── Ability hotkeys ──
    this.tryPlayerAbility('Digit1', 'shield_boost');
    this.tryPlayerAbility('Digit2', 'afterburner');
    this.tryPlayerAbility('Digit3', 'overcharge');
    this.tryPlayerAbility('Digit4', 'emergency_repair');

    // ── Crew Orders ──
    this.tryCrewOrder('pilot_surge');
    this.tryCrewOrder('gunner_focus');
    this.tryCrewOrder('engineer_reroute');
    this.tryCrewOrder('tactician_link');

    // ── Overdrive (V) ──
    if (this.keys.has('KeyV') && canActivateOverdrive(this.overdriveState)) {
      this.activatePlayerOverdrive();
    }

    this.syncShipTransform(this.player);
  }

  private activatePlayerDash(): void {
    if (!this.player.alive || this.shopOpen || !canDash(this.dashState)) return;
    const forward = new THREE.Vector3(Math.sin(this.player.rotation), 0, Math.cos(this.player.rotation));
    const right = new THREE.Vector3(Math.cos(this.player.rotation), 0, -Math.sin(this.player.rotation));
    const shipRot = this.player.group.rotation.y;
    const crisisDashMult = getDashCooldownMult(this.crisisState.activeEffects);
    const effectiveReduction = 1 - (1 - this.effectiveStats.dashCooldownReduction) * crisisDashMult * this.sigilEffects.dashCooldownMult;
    this.dashState = startDash(
      this.dashState, forward.x, forward.z, right.x, right.z,
      shipRot, effectiveReduction,
    );
    if (this.isEndlessMode) this.runStats.dashCount += 1;
    this.particles.emit(ParticleSystem.dashBurst(this.player.position));
    if (this.sigilEffects.shieldOnDash > 0) {
      this.player.shield = Math.min(
        this.player.maxShield + this.sigilEffects.shieldOnDash,
        this.player.shield + this.sigilEffects.shieldOnDash,
      );
    }
    const ghostDuration = getDashGhostDuration(this.crisisState.activeEffects);
    if (ghostDuration > 0 && !this.crisisDashGhostShip) {
      const ghostGroup = this.player.group.clone();
      ghostGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material instanceof THREE.Material) {
            const mat = mesh.material.clone();
            mat.transparent = true;
            mat.opacity = 0.35;
            if ('color' in mat) (mat as THREE.MeshBasicMaterial).color.set('#a78bfa');
            mesh.material = mat;
          }
        }
      });
      this.scene.add(ghostGroup);
      this.crisisDashGhostShip = {
        id: 'dash-ghost',
        team: 'player',
        alive: true,
        hp: 1,
        position: this.player.position.clone(),
        velocity: new THREE.Vector3(),
        rotation: this.player.rotation,
        group: ghostGroup,
        radius: this.player.radius,
        blueprint: this.player.blueprint,
        weapons: [...this.player.weapons],
        weaponCooldowns: [...this.player.weaponCooldowns],
        abilities: [],
        moduleStates: [],
        moduleMeshes: new Map(),
        stats: { ...this.player.stats },
        maxShield: 0,
        shield: 0,
        heat: 0,
        preferredRange: 15,
        fireJitter: 0.05,
        powerFactor: 1,
      };
      this.crisisDashGhostTimer = ghostDuration;
    }
  }

  private activatePlayerOverdrive(): void {
    if (!this.player.alive || this.shopOpen || !canActivateOverdrive(this.overdriveState)) return;
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

  private activatePlayerAbility(abilityId: AbilityId): void {
    if (!this.player.alive || this.shopOpen) return;
    if (activateAbility(this.player.abilities, abilityId)) {
      this.runStats.abilityActivations += 1;

      // Crisis: Meltdown Protocol — overcharge costs HP and gets enhanced duration/damage
      if (abilityId === 'overcharge') {
        const hpCost = getOverchargeHpCost(this.crisisState.activeEffects);
        if (hpCost > 0) {
          const costAmount = this.player.stats.maxHp * hpCost;
          this.player.hp = Math.max(1, this.player.hp - costAmount);
          this.particles.emit(ParticleSystem.hitSpark(this.player.position, '#f59e0b'));
        }
        // Extend overcharge duration by crisis bonus
        const durationBonus = getOverchargeDurationBonus(this.crisisState.activeEffects);
        if (durationBonus > 0) {
          const ability = this.player.abilities.find((a) => a.def.id === 'overcharge');
          if (ability) {
            ability.activeRemaining += durationBonus;
          }
        }
      }

      // Crisis: Containment Override — shield bubble on ability activation
      const shieldBubble = getAbilityShieldBubble(this.crisisState.activeEffects);
      if (shieldBubble > 0) {
        this.player.shield = Math.min(
          this.player.maxShield + shieldBubble,
          this.player.shield + shieldBubble,
        );
        this.player.maxShield = Math.max(this.player.maxShield, this.player.shield);
        this.particles.emit(ParticleSystem.shieldAbsorb(this.player.position, '#a78bfa'));
      }

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

  private tryPlayerAbility(keyCode: string, abilityId: AbilityId): void {
    if (!this.keys.has(keyCode)) return;
    this.activatePlayerAbility(abilityId);
  }

  private tryCrewOrder(id: CrewOrderId): void {
    const def = getCrewOrderDef(id);
    const keyCode = `Key${def.hotkey}`;
    if (!this.keys.has(keyCode)) return;
    this.activateCrewOrder(id);
  }

  private activateCrewOrder(id: CrewOrderId): void {
    if (!this.player.alive || this.shopOpen) return;
    const def = getCrewOrderDef(id);
    const crew = this.player.blueprint.crew;
    if (!canActivateCrewOrder(this.crewOrdersState, id, crew)) return;

    if (id === 'pilot_surge') {
      this.crewOrdersState = activatePilotSurge(this.crewOrdersState, crew);
      this.dashState = { ...this.dashState, cooldownRemaining: 0 };
      this.crewOrderAnnouncement = `${def.icon} ${def.displayName} — helm surge online`;
      this.crewOrderAnnouncementTimer = 2.4;
      this.particles.emit(ParticleSystem.dashBurst(this.player.position));
      this.runStats.abilityActivations += 1;
      return;
    }

    if (id === 'gunner_focus') {
      const target = this.getCrewOrderTargetCandidate();
      if (!target) return;
      this.crewOrdersState = activateGunnerFocus(this.crewOrdersState, crew, target.id, target.blueprint.name);
      this.crewOrderAnnouncement = `${def.icon} ${def.displayName} — ${target.blueprint.name} designated`;
      this.crewOrderAnnouncementTimer = 2.8;
      this.particles.emit(ParticleSystem.comboBurst(target.position, def.color));
      this.runStats.abilityActivations += 1;
      return;
    }

    if (id === 'engineer_reroute') {
      this.crewOrdersState = activateEngineerReroute(this.crewOrdersState, crew);
      const ventFraction = getEngineerHeatVentFraction(crew);
      this.player.heat = Math.max(0, this.player.heat - this.player.stats.heatCapacity * ventFraction);
      if (this.player.maxShield > 0) {
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + getEngineerShieldBurst(crew));
      }
      const target = getRepairTarget(this.player.moduleStates);
      if (target) {
        const repairAmount = target.maxHp * getEngineerRepairFraction(crew);
        target.currentHp = Math.min(target.maxHp, target.currentHp + repairAmount);
        this.player.hp = this.player.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
        this.restoreModuleMesh(this.player, target.instanceId);
      }
      this.crewOrderAnnouncement = `${def.icon} ${def.displayName} — heat vented and shields rerouted`;
      this.crewOrderAnnouncementTimer = 2.8;
      this.particles.emit(ParticleSystem.shieldAbsorb(this.player.position, def.color));
      this.runStats.abilityActivations += 1;
      return;
    }

    const target = this.getCrewOrderTargetCandidate();
    if (!target) return;
    const preferredTargetId = getCrewOrderTargetId(this.crewOrdersState) ?? target.id;
    const preferredTarget = this.ships.find((ship) => ship.id === preferredTargetId && ship.alive) ?? target;
    this.crewOrdersState = activateTacticianLink(this.crewOrdersState, crew, preferredTarget.id, preferredTarget.blueprint.name);
    this.crewOrderAnnouncement = `${def.icon} ${def.displayName} — network locked on ${preferredTarget.blueprint.name}`;
    this.crewOrderAnnouncementTimer = 2.8;
    this.particles.emit(ParticleSystem.comboBurst(this.player.position, def.color));
    this.runStats.abilityActivations += 1;
  }

  private getCrewOrderTargetCandidate(): RuntimeShip | null {
    const livingEnemies = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive);
    if (livingEnemies.length === 0) return null;

    let best = livingEnemies[0];
    let bestScore = -Infinity;
    for (const enemy of livingEnemies) {
      const mouseDistance = enemy.position.distanceTo(this.mouseWorld);
      const playerDistance = enemy.position.distanceTo(this.player.position);
      const score = 60 - mouseDistance * 8 - playerDistance + (enemy.isBoss ? 50 : 0) + ((this.shipAffixes.get(enemy.id)?.length ?? 0) * 12);
      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
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

      const bossPhaseMult = enemy.isBoss && this.bossShip?.id === enemy.id && this.bossAI
        ? getBossPhaseMultipliers(this.bossAI)
        : null;
      const effectiveThrust = getEffectiveThrust(
        Math.max(3.5, enemy.stats.thrust / 80),
        enemy.powerFactor,
        enemy.heat,
        enemy.stats.heatCapacity,
      ) * (isAfterburning(enemy.abilities) ? 1.8 : 1) * (enemy.affixThrustMult ?? 1) * (bossPhaseMult?.speedMult ?? 1);
      // Sigil: Graviton tier 2 — slow aura around player
      const sigilSlowMult = (this.sigilEffects.slowRadius > 0
        ? (() => {
            const distToPlayer = enemy.position.distanceTo(this.player.position);
            return distToPlayer < this.sigilEffects.slowRadius ? (1 - this.sigilEffects.slowAmount) : 1;
          })()
        : 1);

      // Hazard avoidance steering
      const seekConduit = ctx.ownHpRatio < 0.5 && ctx.ownShieldRatio < 0.3;
      const hazardSteer = computeHazardSteering(enemy.position.x, enemy.position.z, this.hazards, seekConduit, true);

      // Aggressive enemies commit harder to forward movement
      const forwardCommit = stance === 'aggressive' ? 0.45 : stance === 'retreating' ? 0.25 : 0.35;

      enemy.velocity.addScaledVector(direction, advance * effectiveThrust * dt * forwardCommit * sigilSlowMult);
      enemy.velocity.addScaledVector(side, lateralThrust * dt * 0.7 * sigilSlowMult);
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
    if (isOverheated(ship.heat, ship.stats.heatCapacity * 1.02)) return;

    // Mutator: Last Stand fire rate boost
    const playerCrew = this.player.blueprint.crew;
    const focusTargetId = ship.team === 'player' ? getCrewOrderTargetId(this.crewOrdersState) : null;
    const bossPhaseMult = ship.team === 'enemy' && ship.isBoss && this.bossShip?.id === ship.id && this.bossAI
      ? getBossPhaseMultipliers(this.bossAI)
      : null;
    const lastStand = ship.team === 'player' ? lastStandBonuses(this.activeMutators, this.player.hp / Math.max(1, this.player.stats.maxHp)) : { damageMult: 1, fireRateMult: 1 };
    const crisisFireRate = this.crisisEliteKillBuffTimer > 0 ? getEliteKillFireRateBuff(this.crisisState.activeEffects) : 1;
    const crisisMutagenStatMult = getMutagenStatMult(this.crisisState.activeEffects);
    const cadenceBuff = ship.team === 'player'
      ? getCadenceMultiplier(this.playerBuffs)
        * this.effectiveStats.fireRateMultiplier
        * getOverdriveFireRateMult(this.overdriveState)
        * lastStand.fireRateMult
        * this.mutagenStats.fireRateMultiplier
        * crisisMutagenStatMult
        * crisisFireRate
        * getGunnerCadenceMultiplier(this.crewOrdersState, playerCrew)
        * getTacticianCadenceMultiplier(this.crewOrdersState, playerCrew)
        * this.sigilEffects.fireRateMult
      : (ship.affixFireRateMult ?? 1) * (bossPhaseMult?.fireRateMult ?? 1);
    const momentumMult = ship.team === 'player' ? momentumDamageMult(this.activeMutators, ship.velocity.length()) : 1;
    const crisisDamage = this.crisisEliteKillBuffTimer > 0 ? getEliteKillDamageBuff(this.crisisState.activeEffects) : 1;
    const buffMultiplier = ship.team === 'player'
      ? getDamageMultiplier(this.playerBuffs)
        * this.effectiveStats.damageMultiplier
        * getOverdriveDamageMult(this.overdriveState)
        * (isOvercharged(this.player.abilities) ? getOverchargeDamageMult(this.crisisState.activeEffects) : 1)
        * lastStand.damageMult
        * momentumMult
        * this.mutagenStats.damageMultiplier
        * crisisMutagenStatMult
        * crisisDamage
        * this.getEffectiveSigilDamageMult()
      : (ship.affixDamageMult ?? 1) * (bossPhaseMult?.damageMult ?? 1);
    const focusDamageMult = ship.team === 'player'
      ? getGunnerFocusDamageMultiplier(this.crewOrdersState, playerCrew, focusTargetId)
      : 1;
    const wingmanDamageMult = ship.isWingman ? WINGMAN_DAMAGE_MULT : 1;
    const nebulaDashBoost = ship.id === this.player.id && this.dashState.nebulaBoostRemaining > 0 ? 2 : 1;

    const normalizedDirection = direction.clone().normalize();

    // Fire all weapons that are off cooldown. Each weapon has an independent timer.
    for (let wi = 0; wi < ship.weapons.length; wi++) {
      const weapon = ship.weapons[wi];
      if (!weapon) continue;
      if (ship.weaponCooldowns[wi] > 0) continue;

      const effectiveCadence = getEffectiveWeaponCadence(
        Math.max(1 / Math.max(weapon.cooldown, 0.05), 0.25),
        ship.powerFactor,
        ship.heat,
        ship.stats.heatCapacity,
      ) * cadenceBuff;
      if (effectiveCadence <= 0.05) continue;

      let damage = Math.max(4, weapon.damage * ship.powerFactor * buffMultiplier * wingmanDamageMult * nebulaDashBoost);

      // Sigil: Entropy Field — crit chance
      if (ship.id === this.player.id && this.sigilEffects.critChance > 0 && Math.random() < this.sigilEffects.critChance) {
        damage *= 2;
        spawnDamageNumber(this.combatFeedback, ship.position.clone().add(new THREE.Vector3(0, 1, 0)), damage, true);
      }

      // Sigil: Warp Lance — focus damage (consecutive hits on same target)
      if (ship.id === this.player.id && this.sigilEffects.focusDamagePctPerHit > 0) {
        const aimTarget = this.findNearestEnemy(ship);
        if (aimTarget) {
          if (this.sigilFocusTarget !== aimTarget.id) {
            this.sigilFocusTarget = aimTarget.id;
            this.sigilFocusHits = 1;
          } else {
            this.sigilFocusHits++;
          }
          const focusBonus = Math.min(this.sigilEffects.focusDamageMaxPct, this.sigilFocusHits * this.sigilEffects.focusDamagePctPerHit);
          damage *= (1 + focusBonus / 100);
        }
      }

      // Sigil: Warp Lance — warp strike (every Nth shot)
      let isWarpStrike = false;
      if (ship.id === this.player.id && this.sigilEffects.warpStrikeInterval > 0) {
        this.sigilShotCounter++;
        if (this.sigilShotCounter % this.sigilEffects.warpStrikeInterval === 0) {
          damage *= this.sigilEffects.warpStrikeDamageMult;
          isWarpStrike = true;
          const warpTarget = this.findNearestEnemy(ship);
          if (warpTarget) {
            this.player.position.copy(warpTarget.position).add(
              normalizedDirection.clone().multiplyScalar(-3),
            );
            this.syncShipTransform(this.player);
            for (const config of ParticleSystem.deathExplosion(this.player.position)) {
              this.particles.emit(config);
            }
          }
        }
      } else if (ship.id === this.player.id) {
        this.sigilShotCounter++;
      }

      if (weapon.archetype === 'beam') {
        const beamOrigin = ship.position.clone().add(normalizedDirection.clone().multiplyScalar(ship.radius));
        spawnMuzzleFlash(this.combatFeedback, this.scene, beamOrigin, weapon.damageType === 'energy' ? 0x88ccff : 0xffaa33);
        this.fireBeam(ship, normalizedDirection, weapon, damage, focusTargetId, focusDamageMult, {
          ownerId: ship.id,
          isWingman: !!ship.isWingman,
        });
        playBeam();
        ship.weaponCooldowns[wi] = weapon.cooldown;
        ship.heat = Math.min(ship.stats.heatCapacity * 1.4, ship.heat + weapon.heat);
        continue;
      }

      const projectile = this.projectiles.find((candidate) => !candidate.active);
      if (!projectile) continue;

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
      projectile.focusTargetId = focusTargetId ?? undefined;
      projectile.focusDamageMult = focusTargetId ? focusDamageMult : undefined;
      projectile.ownerId = ship.id;
      projectile.ownerIsWingman = !!ship.isWingman;
      // Sigil: pierce count (Warp Lance)
      if (ship.id === this.player.id && this.sigilEffects.pierceCount > 0) {
        projectile.pierceRemaining = this.sigilEffects.pierceCount;
      }
      const crisisEnemyProjMult = getEnemyProjectileSpeedMult(this.crisisState.activeEffects);
      const sigilProjSpeedMult = ship.team === 'player' ? this.sigilEffects.projectileSpeedMult : 1;
      projectile.velocity.copy(spreadDirection.multiplyScalar(Math.max(
        (weapon.projectileSpeed + (ship.team === 'player' ? this.effectiveStats.projectileSpeedBonus : 0))
        * (ship.team === 'enemy' ? crisisEnemyProjMult : 1)
        * sigilProjSpeedMult, 8)));
      projectile.mesh.visible = true;
      projectile.mesh.position.copy(computeProjectileSpawnPosition(ship.position, spreadDirection, ship.radius));
      projectile.mesh.scale.setScalar(weapon.archetype === 'missile' ? 1.5 : weapon.archetype === 'laser' ? 0.9 : 1.1);
      (projectile.mesh.material as THREE.MeshBasicMaterial).color.set(getProjectileColor(ship.team, weapon.archetype));

      spawnMuzzleFlash(this.combatFeedback, this.scene, projectile.mesh.position.clone(),
        weapon.damageType === 'energy' ? 0x88ccff : weapon.archetype === 'missile' ? 0xff6644 : 0xffaa33);

      ship.weaponCooldowns[wi] = 1 / effectiveCadence;
      ship.heat = Math.min(ship.stats.heatCapacity * 1.4, ship.heat + weapon.heat);
      if (weapon.archetype === 'missile') playMissile();
      else if (weapon.archetype === 'laser') playLaser();
      else playShoot();
    }
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

      // Hazard boost: projectiles passing through nebulas get 15% damage boost (once per lifetime)
      if (!projectile.nebulaBoosted) {
        for (const hazard of this.hazards) {
          if (checkProjectileNebulaBoost(projectile.mesh.position.x, projectile.mesh.position.z, hazard)) {
            projectile.damage *= 1.15;
            projectile.nebulaBoosted = true;
            break;
          }
        }
      }

      let hit = false;
      for (const drone of this.drones) {
        if (!drone.state.active || drone.state.team === projectile.team) continue;
        const distance = Math.hypot(projectile.mesh.position.x - drone.state.x, projectile.mesh.position.z - drone.state.z);
        if (distance <= 0.45) {
          // Orbit Shield: player drones absorb interceptions harmlessly
          const isShieldedDrone = drone.state.team === 'player' && orbitShieldActive(this.activeMutators);
          if (!isShieldedDrone) {
            drone.state = applyDroneDamage(drone.state, projectile.damage);
            drone.mesh.visible = drone.state.active;
          }
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
        if (distance <= ship.radius * 0.85) {
          const hitAngle = Math.atan2(
            projectile.mesh.position.x - ship.position.x,
            projectile.mesh.position.z - ship.position.z,
          );
          const impactDamage = projectile.focusTargetId && ship.id === projectile.focusTargetId
            ? projectile.damage * (projectile.focusDamageMult ?? 1)
            : projectile.damage;
          this.applyDamage(ship, impactDamage, projectile.damageType, projectile.armorPenetration, hitAngle, {
            ownerId: projectile.ownerId,
            isWingman: projectile.ownerIsWingman,
          });
          // Sigil: Warp Lance pierce — don't deactivate if pierce remaining
          if (projectile.pierceRemaining !== undefined && projectile.pierceRemaining > 0) {
            projectile.pierceRemaining--;
            hit = true; // mark as hit to skip drone checks
            continue;
          }
          // Sigil: Storm Front chain lightning on hit
          if (projectile.team === 'player' && this.sigilEffects.chainLightningInterval > 0 && this.sigilShotCounter % this.sigilEffects.chainLightningInterval === 0) {
            const nearbyEnemy = this.ships.find(s => s.team === 'enemy' && s.alive && s.id !== ship.id && s.position.distanceTo(ship.position) < 8);
            if (nearbyEnemy) {
              const chainDmg = impactDamage * this.sigilEffects.chainLightningDamagePct / 100;
              const chainAngle = Math.atan2(ship.position.x - nearbyEnemy.position.x, ship.position.z - nearbyEnemy.position.z);
              this.applyDamage(nearbyEnemy, chainDmg, 'energy', 0, chainAngle, { ownerId: projectile.ownerId });
              this.spawnBeamVisual(ship.position, nearbyEnemy.position, 'player');
            }
          }
          this.deactivateProjectile(projectile);
          hit = true;
          break;
        }
      }

      if (hit) continue;

      // Near-miss detection: enemy projectiles that graze the player
      // without hitting trigger bullet-time.
      if (this.isEndlessMode && projectile.team === 'enemy' && !projectile.nearMissChecked) {
        const distToPlayer = projectile.mesh.position.distanceTo(this.player.position);
        if (distToPlayer <= NEAR_MISS_RADIUS && distToPlayer > this.player.radius * 0.45) {
          const result = checkNearMiss(this.nearMissState, distToPlayer);
          if (result.triggered) {
            this.nearMissState = result.newState;
            // Grant combo timer bonus
            this.comboState.timer += getNearMissComboBonus(this.nearMissState.currentStreak);
            // Visual feedback: gold "NEAR MISS" floating text
            spawnDamageNumber(this.combatFeedback,
              this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
              this.nearMissState.currentStreak, true);
          }
          // Mark so we don't re-check this projectile (even if cooldown blocked)
          projectile.nearMissChecked = true;
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

      // Orbit Shield: player drones orbit 40% closer (applied once at drone init,
      // but re-checked here in case mutator was acquired mid-combat)
      if (owner.team === 'player' && orbitShieldActive(this.activeMutators)) {
        const baseRadius = 1.3 + (this.drones.indexOf(drone)) * 0.45;
        drone.state.orbitRadius = baseRadius * 0.6;
      }

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
      const forcedTargetId = owner.team === 'player' ? getCrewOrderTargetId(this.crewOrdersState) : null;
      const forcedTarget = forcedTargetId ? targets.find((target) => target.id === forcedTargetId && target.alive) ?? null : null;
      const target = forcedTarget ?? chooseDroneTarget(drone.state, targets);
      if (target && drone.state.cooldown <= 0) {
        const victim = this.ships.find((ship) => ship.id === target.id && ship.alive);
        if (victim) {
          const hitAngle = Math.atan2(
            this.drones.find((d) => d.ownerId === owner.id)?.state.x ?? 0 - victim.position.x,
            (this.drones.find((d) => d.ownerId === owner.id)?.state.z ?? 0) - victim.position.z,
          );
          const droneDamage = drone.state.damage
            * 0.35
            * (owner.team === 'player'
              ? getTacticianDroneDamageMultiplier(this.crewOrdersState, this.player.blueprint.crew, victim.id)
              : 1);
          this.applyDamage(victim, droneDamage, 'energy', 0, hitAngle, {
            ownerId: owner.id,
            isWingman: !!owner.isWingman,
          });
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

  private fireBeam(
    ship: RuntimeShip,
    direction: THREE.Vector3,
    weapon: WeaponProfile,
    damage: number,
    focusTargetId: string | null,
    focusDamageMult: number,
    source?: { ownerId?: string; isWingman?: boolean },
  ): void {
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
      const beamDamage = focusTargetId && bestTarget.id === focusTargetId
        ? damage * focusDamageMult
        : damage;
      this.applyDamage(bestTarget, beamDamage * 0.85, weapon.damageType as DamageType, weapon.armorPenetration, hitAngle, source);
      this.spawnBeamVisual(ship.position, bestTarget.position, ship.team);
      this.spawnImpactVisual(bestTarget.position, ship.team === 'player' ? '#5eead4' : '#fca5a5');
      this.waveAnnouncement = `${ship.team === 'player' ? 'Beam strike' : 'Enemy beam'} connected`;
    }
  }

  private applyDamage(
    ship: RuntimeShip,
    rawDamage: number,
    damageType: DamageType,
    armorPenetration: number,
    hitAngle: number,
    source?: { ownerId?: string; isWingman?: boolean },
  ): void {
    const isPlayerShip = ship.id === this.player.id;
    // Player is invulnerable during dash
    if (isPlayerShip && isInvulnerable(this.dashState)) return;
    // Crisis: Phase Shift — player takes more damage
    if (isPlayerShip && getDamageTakenMult(this.crisisState.activeEffects) > 1) {
      rawDamage *= getDamageTakenMult(this.crisisState.activeEffects);
    }
    // Boss is invulnerable during phase transitions
    if (ship.isBoss && this.bossAI && !isBossVulnerable(this.bossAI)) return;
    // Track player damage time for music intensity
    if (isPlayerShip && rawDamage > 0) {
      this.recentDamageTime = this.elapsedEncounterSeconds;
    }
    const empActive = isRiftEmpActive(this.arenaRift?.rift ?? null);
    const effectiveShield = empActive ? 0 : ship.shield;
    const result: DamageResult = resolveDamage(
      rawDamage,
      damageType,
      armorPenetration,
      effectiveShield,
      ship.stats.armorRating,
      ship.stats.kineticBypass,
      ship.stats.energyVulnerability,
    );

    ship.shield -= result.shieldAbsorbed;
    ship.heat = Math.min(ship.stats.heatCapacity * 1.25, ship.heat + rawDamage * 0.08);
    playHit();
    // Run stat tracking
    if (this.isEndlessMode) {
      if (isPlayerShip) this.runStats.damageTaken += result.hullDamage;
      else this.runStats.damageDealt += result.hullDamage;
    }
    if (source?.isWingman && ship.team === 'enemy' && result.hullDamage > 0) {
      this.wingmanState = recordWingmanDamage(this.wingmanState, result.hullDamage);
    }

    // Thorns: reflect a fraction of damage taken back to attackers hitting the player
    if (isPlayerShip && result.hullDamage > 0) {
      const reflectFrac = thornsReflectFraction(this.activeMutators);
      if (reflectFrac > 0 && source?.ownerId) {
        const attacker = this.ships.find((s) => s.id === source.ownerId && s.alive);
        if (attacker && attacker.team === 'enemy') {
          const reflected = Math.max(1, Math.round(result.hullDamage * reflectFrac));
          this.applyDamage(attacker, reflected, 'energy', 0, Math.atan2(
            attacker.position.z - ship.position.z,
            attacker.position.x - ship.position.x,
          ));
          this.particles.emit(ParticleSystem.hitSpark(ship.position, '#fb923c'));
        }
      }
    }

    if (result.shieldAbsorbed > 0) {
      this.spawnImpactVisual(ship.position, ship.team === 'player' ? '#38bdf8' : '#f9a8d4');
      this.particles.emit(ParticleSystem.shieldAbsorb(ship.position, ship.team === 'player' ? '#38bdf8' : '#f9a8d4'));
    }

    // Route hull damage through module system
    if (result.hullDamage > 0) {
      // Combat feedback: floating damage number + hit flash
      spawnDamageNumber(
        this.combatFeedback,
        ship.position.clone(),
        result.hullDamage,
        rawDamage > (ship.stats.maxHp * 0.15),
      );
      flashHit(ship.group);

      if (result.shieldAbsorbed <= 0) {
        this.spawnImpactVisual(ship.position, ship.team === 'player' ? '#f59e0b' : '#fb7185');
        this.particles.emit(ParticleSystem.hitSpark(ship.position, ship.team === 'player' ? '#f59e0b' : '#fb7185'));
      }

      // Screen shake when the real player takes hull damage
      if (isPlayerShip && !this.screenShake) {
        const shakeIntensity = Math.min(0.6, result.hullDamage / ship.stats.maxHp * 3);
        if (shakeIntensity > 0.05) {
          this.screenShake = createScreenShake(shakeIntensity, 0.25);
        }
      }

      // Sigil: Ironclad tier 3 — defensive save (survive lethal hit at 1 HP)
      if (isPlayerShip && result.hullDamage > 0 && ship.hp - result.hullDamage <= 0) {
        const { state: sigilNewState, saved } = consumeDefensiveSave(this.sigilState);
        this.sigilState = sigilNewState;
        if (saved) {
          ship.hp = 1;
          result.hullDamage = 0;
          this.sigilAnnouncement = '🛡️ Ironclad — Last Stand activated!';
          this.sigilAnnouncementTimer = 3;
          this.screenShake = createScreenShake(0.5, 0.3);
          this.particles.emit(ParticleSystem.shieldAbsorb(ship.position, '#64748b'));
        }
      }

      this.handleContractHullDamage(result.hullDamage);

      // Sigil: module destruction reduction (Ironclad tier 2)
      const sigilModDmg = isPlayerShip ? this.sigilEffects.moduleDestructionMult : 1;
      const destroyed = damageModules(ship.moduleStates, result.hullDamage * sigilModDmg, hitAngle, 0.6);

      // Recalculate effective stats from surviving modules
      const survivingIds = new Set(ship.moduleStates.filter((m) => !m.destroyed).map((m) => m.instanceId));
      const newRawStats = computeStatsFromSurviving(ship.blueprint, survivingIds);
      ship.stats = applyCrewModifiers(newRawStats, ship.blueprint.crew);
      if (ship.isBoss && ship.bossHpMult) {
        ship.stats.maxHp *= ship.bossHpMult;
      }
      this.reapplyUpgradeBonuses(ship);
      this.reapplyLegacyOnRebuild(ship);
      this.reapplyMutagenOnRebuild(ship);
      this.reapplySigilOnRebuild(ship);
      ship.powerFactor = computePowerFactor(ship.stats.powerOutput, ship.stats.powerDemand);
      ship.maxShield = ship.stats.shieldStrength;
      ship.shield = Math.min(ship.shield, ship.maxShield);

      // Rebuild weapon loadout from surviving modules
      const survivingBlueprint: ShipBlueprint = {
        ...ship.blueprint,
        modules: ship.blueprint.modules.filter((m) => survivingIds.has(m.instanceId)),
      };
      ship.weapons = buildWeaponLoadout(survivingBlueprint);
      ship.weaponCooldowns = ship.weapons.map(() => 0);

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
      this.spawnExplosionVisual(ship.position, ship.team === 'player' ? '#fca5a5' : '#fb923c');
      // Combat feedback: 3D debris explosion
      spawnDeathExplosion(this.combatFeedback, this.scene, ship.position.clone(), ship.isBoss ? 24 : 12);
      // Particle death explosion (skip for player with explosive mutagen — that path has its own emit)
      const playerHasDeathExplosion = isPlayerShip && hasDeathExplosion(this.mutagenState.mutations);
      if (!playerHasDeathExplosion) {
        for (const config of ParticleSystem.deathExplosion(ship.position)) {
          this.particles.emit(config);
        }
      }
      // Affix: death explosion — damages nearby ships
      this.handleAffixExplosion(ship);
      this.handleNemesisKilled(ship);
      // Blueprint scavenging (elite/boss kill)
      this.handleSalvageOnKill(ship);
      this.handleContractEnemyKill(ship);
      // Mutagen: collect essence from elite/boss kills
      if (this.isEndlessMode && ship.team === 'enemy') {
        const killedAffixes = this.shipAffixes.get(ship.id);
        if (killedAffixes && killedAffixes.length >= 2) {
          const affixIds = killedAffixes.map(a => a.def.id as MutagenId);
          this.mutagenState = collectEssenceFromKill(
            this.mutagenState, affixIds, !!ship.isBoss, this.currentWave,
          );
          persistMutagenState(this.mutagenState);
          if (this.mutagenState.pendingEssence.length > 0) {
            this.mutagenAnnouncement = `🧬 Essence collected! (${this.mutagenState.pendingEssence.length}/${MAX_ESSENCE_SLOTS})`;
            this.mutagenAnnouncementTimer = 2;
          }
        }
      }
      // Bigger screen shake for actual player death
      if (isPlayerShip) {
        this.resolveNemesisOnPlayerDeath();
        this.screenShake = createScreenShake(0.8, 0.5);
        // Mutagen: death explosion
        if (hasDeathExplosion(this.mutagenState.mutations)) {
          const dmg = Math.round(getDeathExplosionDamage(this.mutagenState.mutations) * getMutagenStatMult(this.crisisState.activeEffects));
          for (const enemy of this.ships) {
            if (!enemy.alive || enemy.team !== 'enemy') continue;
            const dist = this.player.position.distanceTo(enemy.position);
            if (dist < 5) {
              const falloffDmg = Math.round(dmg * (1 - dist / 5 * 0.5));
              this.applyDamage(enemy, falloffDmg, 'kinetic', 0.5, 0);
            }
          }
          for (const config of ParticleSystem.deathExplosion(this.player.position)) {
            this.particles.emit(config);
          }
          this.screenShake = createScreenShake(0.6, 0.4);
        }
      }

      // Track kills in endless mode
      if (this.isEndlessMode && ship.team === 'enemy') {
        this.endlessTotalKills += 1;
        // Sigil: kill tracking and effects
        if (this.sigilState.activeId) {
          this.sigilState = registerSigilKill(this.sigilState, 0.016);
          const fx = this.sigilEffects;
          // Blood Oath: heal on kill
          if (fx.healOnKillPct > 0 && this.player.alive) {
            const healPct = fx.healOnKillPct + Math.min(this.sigilState.killStreak, fx.healStreakCap === 999 ? 0 : fx.healStreakCap) * fx.healOnKillStreakBonusPct;
            this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + this.player.stats.maxHp * healPct / 100);
          }
          // Entropy Field tier 3: kill pickup chance
          if (fx.killPickupChance > 0 && Math.random() < fx.killPickupChance) {
            const kinds: PickupKind[] = ['repair_kit', 'shield_cell', 'power_surge', 'rapid_fire'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            this.spawnPickup(kind, ship.position.x, ship.position.z);
          }
          // Graviton tier 3: explosion on kill near other enemies
          if (fx.explosionDamagePct > 0) {
            const killedMaxHp = ship.stats.maxHp;
            for (const enemy of this.ships.filter(s => s.team === 'enemy' && s.alive && s.id !== ship.id)) {
              const dist = enemy.position.distanceTo(ship.position);
              if (dist < fx.explosionRadius) {
                const expDmg = killedMaxHp * fx.explosionDamagePct / 100;
                const expAngle = Math.atan2(ship.position.x - enemy.position.x, ship.position.z - enemy.position.z);
                this.applyDamage(enemy, expDmg, 'explosive', 0, expAngle);
              }
            }
            this.particles.emit(ParticleSystem.explosionBurst(ship.position, '#06b6d4', 8));
          }
          // Storm Front tier 3: Tempest — reduce ability cooldowns on streak
          if (fx.tempestCdReduction > 0 && this.sigilState.killStreak >= fx.tempestStreakMin) {
            for (const ability of this.player.abilities) {
              if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - fx.tempestCdReduction);
              }
            }
          }
        }
        if (source?.isWingman) {
          this.wingmanState = recordWingmanKill(this.wingmanState);
        }
        // Boss kill tracking
        if (ship.isBoss) {
          this.runStats.bossKills += 1;
          if (this.bossAI) this.bossAI = { ...this.bossAI, defeated: true };
          this.bossShip = null;
          playBossDefeated();
          this.particles.emit(ParticleSystem.bossDeathExplosion(ship.position));
          this.screenShake = createScreenShake(1.0, 0.8);
          this.bossAnnouncement = '🏆 BOSS DEFEATED';
          this.bossAnnouncementTimer = 3;
          this.bossWarning = '';
          this.clearBossTelegraphs();
        }
        // Elite credit bonus
        const killedAffixes = this.shipAffixes.get(ship.id);
        const killedIsElite = killedAffixes && killedAffixes.length >= 2;
        if (killedAffixes && killedAffixes.length > 0) {
          this.endlessWaveEliteBonus += Math.floor(10 * eliteCreditsMultiplier(killedAffixes));
        }
        this.shipAffixes.delete(ship.id);
        // Crisis: Neural Link — elite kill buff
        if (killedIsElite && getEliteKillBuffDuration(this.crisisState.activeEffects) > 0) {
          this.crisisEliteKillBuffTimer = getEliteKillBuffDuration(this.crisisState.activeEffects);
        }
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
        const odChargeMult = getOverdriveChargeMult(this.crisisState.activeEffects);
        this.overdriveState = addOverdriveCharge(this.overdriveState, OVERDRIVE_CHARGE_PER_KILL * comboTierMult * odChargeMult);
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
      ship.weaponCooldowns = ship.weaponCooldowns.map(c => Math.max(0, c - dt));
      const engineerCooling = ship.team === 'player'
        ? getEngineerCoolingMultiplier(this.crewOrdersState, this.player.blueprint.crew)
        : 1;
      const engineerShieldRecharge = ship.team === 'player'
        ? getEngineerShieldRechargeMultiplier(this.crewOrdersState, this.player.blueprint.crew)
        : 1;
      const cooling = computeCoolingPerSecond(Math.max(2, ship.stats.cooling * 80 * engineerCooling), ship.powerFactor);
      ship.heat = Math.max(0, ship.heat - cooling * dt);
      // Check if ship is inside a nebula — use drain multiplier from hazard system
      const shieldDrainMult = this.shipNebulaDrain.get(ship.id) ?? 1;
      ship.shield = rechargeShield(
        ship.shield,
        ship.maxShield,
        ship.stats.shieldRecharge * (isShieldBoosted(ship.abilities) ? 2 : 1) * engineerShieldRecharge / shieldDrainMult,
        dt,
      );
      // Affix: HP regeneration (5% max HP per second)
      const affixData = this.shipAffixData.get(ship.id);
      if (affixData?.regeneratesHp && ship.alive && ship.hp < ship.stats.maxHp) {
        ship.hp = Math.min(ship.stats.maxHp, ship.hp + ship.stats.maxHp * 0.05 * dt);
      }
      // Mutagen: player HP regeneration (uses cached mutagenStats to stay in sync with mid-run absorption)
      if (ship.id === this.player.id && ship.alive) {
        const regenRate = this.mutagenStats.hpRegenPerSecond * getMutagenStatMult(this.crisisState.activeEffects);
        if (regenRate > 0 && ship.hp < ship.stats.maxHp) {
          ship.hp = Math.min(ship.stats.maxHp, ship.hp + ship.stats.maxHp * regenRate * dt);
        }
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
      if (this.isEndlessMode && this.activeContract && this.activeContract.waveNumber === this.currentWave) {
        const resolvedContract = resolveContractOnWaveEnd(this.activeContract, true);
        if (isTerminalContract(resolvedContract)) {
          this.resolveActiveContract(resolvedContract);
        } else {
          this.activeContract = resolvedContract;
        }
      }

      this.currentWave = progress.nextWave;
      this.waveDelay = WAVE_RESPAWN_DELAY;

      // Track kills from cleared waves in endless mode
      if (this.isEndlessMode) {
        this.endlessBestWave = this.currentWave - 1;
        // Track run stats
        this.runStats.waveReached = this.currentWave - 1;
        this.runStats.score = this.endlessScore;
        this.runStats.timeSeconds = this.elapsedEncounterSeconds;
        this.endlessScore += endlessWaveScore(this.currentWave - 1) + this.comboState.totalComboScore;
        // Grant credits for each wave cleared, multiplied by combo
        const comboMult = getComboCreditMultiplier(this.comboState.kills);
        const creditBoostMult = 1 + getCreditPercentBoost(this.legacyState) / 100;
        const sigilCreditMult = this.sigilEffects.creditMult;
        const waveCredits = Math.floor(endlessWaveCredits(this.currentWave - 1) * comboMult * creditBoostMult * sigilCreditMult) + this.endlessWaveEliteBonus;
        this.endlessWaveEliteBonus = 0;
        this.endlessCredits += waveCredits;
        this.runStats.creditsEarned += waveCredits;
        this.onReward(this.encounterId, { credits: waveCredits, score: this.endlessScore, victory: true });
        // Reset combo score bank after applying (combo streak itself persists across waves)
        this.comboState = { ...this.comboState, totalComboScore: 0 };

        // Sigil: check for tier advancement
        if (this.sigilState.activeId) {
          this.sigilState = advanceSigilTier(this.sigilState, this.currentWave);
          if (this.sigilState.tierUpPending) {
            const sigilDef = getSigilDef(this.sigilState.activeId!);
            const tierDef = sigilDef?.tiers.find(t => t.tier === this.sigilState.currentTier);
            if (tierDef) {
              this.sigilAnnouncement = `${sigilDef?.icon} ${tierDef.name} — ${tierDef.description}`;
              this.sigilAnnouncementTimer = 3.5;
            }
            this.sigilState = clearTierUpPending(this.sigilState);
            this.sigilEffects = getSigilEffects(this.sigilState);
            this.rebuildPlayerWithUpgrades();
          }
          this.sigilState = resetWaveState(this.sigilState);
        }

        // Check for crisis event before opening shop
        if (shouldTriggerCrisis(this.currentWave, this.crisisState)) {
          this.crisisState = prepareCrisisEvent(this.currentWave, this.crisisState, Math.random());
          if (isCrisisPending(this.crisisState)) {
            this.shopOpen = true;
            this.waveAnnouncement = `⚠ Crisis Event — Wave ${this.currentWave}`;
            this.refreshHud();
            return;
          }
        }

        // Open upgrade shop instead of immediately spawning next wave
        this.openUpgradeShop(this.currentWave - 1);
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
      if (this.isEndlessMode && this.activeContract && this.activeContract.waveNumber === this.currentWave) {
        this.resolveActiveContract(resolveContractOnWaveEnd(this.activeContract, false));
      }
      if (this.isEndlessMode) {
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
    projectile.focusTargetId = undefined;
    projectile.focusDamageMult = undefined;
    projectile.ownerId = undefined;
    projectile.ownerIsWingman = undefined;
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
    const maxR = this.getEffectiveArenaRadius() - 1;
    if (position.length() <= maxR) return;
    position.setLength(maxR);
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

    // Boss telegraph indicators on minimap
    if (this.bossAI) {
      for (const telegraph of this.bossAI.telegraphs) {
        const tx = cx + telegraph.position.x * scale;
        const ty = cy + telegraph.position.z * scale;
        const tr = telegraph.radius * scale;
        const progress = 1 - telegraph.timeRemaining / telegraph.duration;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + progress * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(3, tr), 0, Math.PI * 2);
        ctx.stroke();
      }
      // Beam sweep line on minimap
      if (this.bossAI.activeAttack?.id === 'beam_sweep' && this.bossShip) {
        const bx = cx + this.bossShip.position.x * scale;
        const by = cy + this.bossShip.position.z * scale;
        const beamLen = 20 * scale;
        const endX = bx + Math.sin(this.bossAI.beamSweepAngle) * beamLen;
        const endY = cy + Math.cos(this.bossAI.beamSweepAngle) * beamLen;
        ctx.strokeStyle = 'rgba(255, 0, 102, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }

    // Arena rift minimap indicators
    if (this.arenaRift) {
      const rift = this.arenaRift.rift;
      const rDef = getRiftDef(getRiftType(rift));
      const cr = parseInt(rDef.color.slice(1, 3), 16);
      const cg = parseInt(rDef.color.slice(3, 5), 16);
      const cb = parseInt(rDef.color.slice(5, 7), 16);

      if (rift.kind === 'void_collapse') {
        const vr = rift.currentRadius * scale;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, vr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.06)`;
        ctx.beginPath();
        ctx.arc(cx, cy, ARENA_RADIUS * scale, 0, Math.PI * 2);
        ctx.arc(cx, cy, vr, 0, Math.PI * 2, true);
        ctx.fill();
      } else if (rift.kind === 'gravity_well') {
        const wx = cx + rift.wellX * scale;
        const wz = cy + rift.wellZ * scale;
        const wr = 4 + Math.sin(rift.elapsed * 3) * 1.5;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wz, wr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.15)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(wx, wz, rift.influenceRadius * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (rift.kind === 'emp_storm') {
        const pulse = 0.4 + 0.3 * Math.sin(rift.timeSinceLastPulse * 2);
        const empAlpha = rift.shieldsDisabled ? 0.8 : pulse * 0.3;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${empAlpha})`;
        ctx.lineWidth = rift.shieldsDisabled ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ARENA_RADIUS * scale, 0, Math.PI * 2);
        ctx.stroke();
        if (rift.shieldsDisabled) {
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.04)`;
          ctx.beginPath();
          ctx.arc(cx, cy, ARENA_RADIUS * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (rift.kind === 'shockwave') {
        if (rift.waveActive) {
          const swr = rift.currentWaveRadius * scale;
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.5)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, swr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
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
      } else if (ship.isWingman) {
        // Wingman: smaller blue triangle with heading
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-ship.rotation);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.9)';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-3.5, 4);
        ctx.lineTo(3.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (ship.team === 'enemy') {
        // Boss: larger pulsing red diamond
        if (ship.isBoss) {
          const bossPulse = 0.6 + 0.4 * Math.sin(this.elapsedEncounterSeconds * 4);
          const bossR = 7;
          ctx.fillStyle = `rgba(239, 68, 68, ${bossPulse})`;
          ctx.beginPath();
          ctx.moveTo(sx, sy - bossR);
          ctx.lineTo(sx + bossR, sy);
          ctx.lineTo(sx, sy + bossR);
          ctx.lineTo(sx - bossR, sy);
          ctx.closePath();
          ctx.fill();
          // Boss HP ring
          const bossHpRatio = ship.hp / Math.max(1, ship.stats.maxHp);
          ctx.strokeStyle = `rgba(239, 68, 68, 0.6)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, bossR + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bossHpRatio);
          ctx.stroke();
          // Invulnerability indicator
          if (this.bossAI && !isBossVulnerable(this.bossAI)) {
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(sx, sy, bossR + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
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

        if (getCrewOrderTargetId(this.crewOrdersState) === ship.id) {
          const color = this.getCrewOrderMarkerColor();
          const pulse = 0.35 + 0.35 * Math.sin(this.elapsedEncounterSeconds * 7);
          const cr = parseInt(color.slice(1, 3), 16);
          const cg = parseInt(color.slice(3, 5), 16);
          const cb = parseInt(color.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (ship.isNemesis) {
          const pulse = 0.45 + 0.35 * Math.sin(this.elapsedEncounterSeconds * 6);
          ctx.strokeStyle = `rgba(244, 114, 182, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (this.activeContract?.kind === 'priority_target' && this.activeContract.targetShipId === ship.id) {
          const pulse = 0.45 + 0.35 * Math.sin(this.elapsedEncounterSeconds * 7);
          ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx - (r + 7), sy);
          ctx.lineTo(sx - (r + 3), sy);
          ctx.moveTo(sx + (r + 3), sy);
          ctx.lineTo(sx + (r + 7), sy);
          ctx.moveTo(sx, sy - (r + 7));
          ctx.lineTo(sx, sy - (r + 3));
          ctx.moveTo(sx, sy + (r + 3));
          ctx.lineTo(sx, sy + (r + 7));
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
        } // end non-boss enemy
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
    const mobileControls = this.uiRoot.querySelector<HTMLElement>('#mobile-controls');
    if (mobileControls) {
      mobileControls.style.display = this.shopOpen ? 'none' : 'flex';
    }
    this.syncMobileControls();

    // When shop is open, replace HUD with upgrade selection UI
    if (this.shopOpen && hud) {
      // Sigil selection takes priority on first open
      if (this.sigilSelectionOpen) {
        const sigilCards = this.sigilOffers.map((offer) => {
          const t1 = offer.tiers[0];
          return `<div class="upgrade-card" style="border-color:${offer.color};background:rgba(${parseInt(offer.color.slice(1,3),16)},${parseInt(offer.color.slice(3,5),16)},${parseInt(offer.color.slice(5,7),16)},0.1);cursor:pointer" data-sigil="${offer.id}">
            <div style="font-size:2em">${offer.icon}</div>
            <strong style="color:${offer.color}">${offer.displayName}</strong>
            <p style="margin:4px 0;color:${offer.color};font-style:italic;font-size:0.9em">${offer.tagline}</p>
            <p style="margin:4px 0;font-size:0.85em">${t1.name}: ${t1.description}</p>
            <p style="color:#94a3b8;font-size:0.78em;margin-top:4px">Trade-off: ${offer.tradeOff}</p>
            <p style="color:#64748b;font-size:0.72em;font-style:italic">${t1.flavor}</p>
            <button class="primary" style="font-size:0.9em;background:${offer.color};border-color:${offer.color};margin-top:8px">
              Choose ${offer.displayName}
            </button>
          </div>`;
        }).join('');
        hud.innerHTML = `
          <div style="text-align:center;margin-bottom:12px">
            <strong style="font-size:1.2em;color:#e2e8f0">Choose your Pilot Sigil</strong>
            <p style="color:#94a3b8;font-size:0.9em">This defines your run identity. Choose wisely — it cannot be changed.</p>
          </div>
          <div class="upgrade-grid">${sigilCards}</div>
        `;
        
        this.renderer.render(this.scene, this.camera);
        return;
      }
      // Crisis event takes priority over normal shop
      if (isCrisisPending(this.crisisState) && this.crisisState.pendingEvent) {
        const event = this.crisisState.pendingEvent;
        const choiceCards = event.choices.map((c) => {
          return `<div class="crisis-choice-card" style="border-color:${c.color};background:rgba(${parseInt(c.color.slice(1,3),16)},${parseInt(c.color.slice(3,5),16)},${parseInt(c.color.slice(5,7),16)},0.08)">
            <div style="font-size:1.4em">${c.icon}</div>
            <strong style="color:${c.color}">${c.name}</strong>
            <p style="margin:6px 0;color:#e2e8f0;font-size:0.9em">${c.description}</p>
            <small style="color:#94a3b8;font-style:italic">${c.flavor}</small>
            <button class="crisis-choice-btn" data-crisis="${c.id}" style="background:${c.color};border-color:${c.color};margin-top:8px;font-size:0.85em">
              Choose
            </button>
          </div>`;
        }).join('');

        hud.innerHTML = `
          <div style="text-align:center;margin-bottom:12px">
            <div style="font-size:1.8em">${event.icon}</div>
            <strong style="font-size:1.2em;color:#fbbf24;text-shadow:0 0 12px rgba(251,191,36,0.5)">⚠ ${event.name}</strong>
            <p style="color:#94a3b8;margin:6px 0;font-size:0.9em">${event.description}</p>
            <p style="color:#64748b;font-size:0.8em">Crisis effects persist for the rest of this run. Choose wisely.</p>
          </div>
          <div class="crisis-choice-grid">${choiceCards}</div>
          ${this.crisisState.activeEffects.length > 0 ? `<div style="margin-top:10px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">${getActiveEffectLabels(this.crisisState.activeEffects).map((e) => `<span style="background:rgba(${parseInt(e.color.slice(1,3),16)},${parseInt(e.color.slice(3,5),16)},${parseInt(e.color.slice(5,7),16)},0.2);border:1px solid ${e.color};border-radius:4px;padding:2px 6px;font-size:0.75em;color:${e.color}">${e.icon} ${e.name}</span>`).join('')}</div>` : ''}
        `;


        this.renderer.render(this.scene, this.camera);
        return;
      }

      const restRepair = this.shopWaveCleared > 0 && this.shopWaveCleared % 5 === 0;
      const contractCards = this.contractOffers.map((offer, i) => {
        const def = offer.reward.essenceId ? getMutationDef(offer.reward.essenceId) : null;
        const rewardLine = this.renderContractReward(offer);
        return `<div class="contract-card" style="border-color:${offer.color};background:rgba(${parseInt(offer.color.slice(1,3),16)},${parseInt(offer.color.slice(3,5),16)},${parseInt(offer.color.slice(5,7),16)},0.08)">
          <div style="font-size:1.35em">${offer.icon}</div>
          <strong style="color:${offer.color}">${offer.displayName}</strong>
          <p style="margin:4px 0;color:#e2e8f0">${offer.description}</p>
          <small style="color:#94a3b8;font-style:italic">${offer.flavor}</small>
          <div style="margin-top:6px;font-size:0.78em;color:${offer.color}">${rewardLine}</div>
          ${def ? `<div style="font-size:0.76em;color:${def.color};margin-top:2px">Reward cache: ${def.icon} ${def.displayName}</div>` : ''}
          <button class="primary" data-contract="${i}" style="font-size:0.85em;background:${offer.color};border-color:${offer.color};margin-top:8px">
            Accept Contract
          </button>
        </div>`;
      }).join('');
      const acceptedContractHtml = this.activeContract && this.activeContract.waveNumber === this.shopTargetWave
        ? `<div class="contract-status-box" style="margin-bottom:8px;border-color:${this.activeContract.color};background:rgba(${parseInt(this.activeContract.color.slice(1,3),16)},${parseInt(this.activeContract.color.slice(3,5),16)},${parseInt(this.activeContract.color.slice(5,7),16)},0.08)">
            <strong style="color:${this.activeContract.color}">${this.activeContract.icon} Contract locked for Wave ${this.shopTargetWave}</strong>
            <div style="margin-top:4px;color:#e2e8f0">${this.activeContract.displayName} — ${this.activeContract.description}</div>
            <div style="margin-top:4px;font-size:0.8em;color:${this.activeContract.color}">${this.renderContractReward(this.activeContract)}</div>
          </div>`
        : '';
      const upgradeCards = this.shopOptions.map((u, i) => {
        const rarityColor = getRarityColor(u.rarity);
        const offerCost = this.getUpgradePurchaseCost(u);
        const canAfford = this.endlessCredits >= offerCost.cost;
        const priceLabel = offerCost.isFree ? 'Free' : `${offerCost.cost} credits`;
        return `<div class="upgrade-card" style="border-color:${rarityColor};opacity:${canAfford ? 1 : 0.5}">
          <div style="font-size:1.3em">${u.icon}</div>
          <strong style="color:${rarityColor}">${u.displayName}</strong>
          <small style="color:${rarityColor}">${getRarityLabel(u.rarity)}</small>
          <p style="margin:4px 0">${u.description}</p>
          <button class="primary" data-upgrade="${i}" ${canAfford ? '' : 'disabled'} style="font-size:0.85em">
            ${priceLabel}
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

      // Mutagen: essence extraction panel
      const essenceCards = this.mutagenState.pendingEssence.map((e, i) => {
        const def = getMutationDef(e.affixId);
        if (!def) return '';
        const existingStacks = getMutationStacks(this.mutagenState.mutations, e.affixId);
        const isStacking = existingStacks > 0;
        const canAbsorb = isStacking || canAbsorbNew(this.mutagenState);
        return `<div class="upgrade-card" style="border-color:${def.color};background:rgba(${parseInt(def.color.slice(1,3),16)},${parseInt(def.color.slice(3,5),16)},${parseInt(def.color.slice(5,7),16)},0.06);opacity:${canAbsorb ? '1' : '0.65'}">
          <div style="font-size:0.7em;color:${def.color};margin-bottom:2px">🧬 ESSENCE — Free</div>
          <div style="font-size:1.3em">${def.icon}</div>
          <strong style="color:${def.color}">${def.displayName}</strong>
          ${isStacking ? `<small style="color:${def.color}">→ ${existingStacks + 1} stacks</small>` : '<small style="color:#94a3b8">New mutation</small>'}
          <p style="margin:4px 0">${def.description}</p>
          <small style="color:#64748b;font-style:italic">${isStacking ? def.stackDescription : def.flavor}</small>
          ${!canAbsorb ? '<div style="color:#fca5a5;font-size:0.76em;margin-top:4px">Mutation lattice full — stack an existing trait instead.</div>' : ''}
          <button class="primary" data-absorb="${i}" ${canAbsorb ? '' : 'disabled'} style="font-size:0.85em;background:${def.color};border-color:${def.color}">
            ${canAbsorb ? 'Absorb' : 'Locked'}
          </button>
        </div>`;
      }).join('');

      hud.innerHTML = `
        <div style="text-align:center;margin-bottom:8px">
          <strong style="font-size:1.1em;color:#e2e8f0">⚡ Upgrade Shop — Wave ${this.shopWaveCleared} Cleared</strong>
          <p style="color:#94a3b8;font-size:0.85em;margin-top:4px">Prep for Wave ${this.shopTargetWave}</p>
          ${restRepair ? '<p class="success">🔧 Rest stop: hull partially repaired!</p>' : ''}
        </div>
        ${acceptedContractHtml}
        ${contractCards ? `<div style="text-align:center;margin-bottom:6px"><span style="color:#f59e0b;font-size:0.85em;font-weight:600">— Optional Void Contract —</span></div><div class="contract-grid">${contractCards}</div>` : ''}
        ${contractCards && (mutatorCards || essenceCards || upgradeCards.length > 0) ? '<div style="text-align:center;margin:8px 0"><span style="color:#64748b">— and then —</span></div>' : ''}
        ${mutatorCards ? `<div style="text-align:center;margin-bottom:6px"><span style="color:#c084fc;font-size:0.85em;font-weight:600">— Offered Trait —</span></div><div class="upgrade-grid">${mutatorCards}</div>` : ''}
        ${essenceCards ? `<div style="text-align:center;margin-bottom:6px"><span style="color:#34d399;font-size:0.85em;font-weight:600">— Absorb Essence (${this.mutagenState.pendingEssence.length}/${MAX_ESSENCE_SLOTS}) —</span></div><div class="upgrade-grid">${essenceCards}</div>` : ''}
        ${essenceCards && upgradeCards.length > 0 ? '<div style="text-align:center;margin:8px 0"><span style="color:#64748b">— or —</span></div>' : ''}
        ${!essenceCards && mutatorCards && upgradeCards.length > 0 ? '<div style="text-align:center;margin:8px 0"><span style="color:#64748b">— or —</span></div>' : ''}
        ${upgradeCards.length > 0 ? `<div class="upgrade-grid">${upgradeCards}</div>` : '<p class="muted" style="text-align:center">No upgrades available</p>'}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="color:#fbbf24">💰 ${this.endlessCredits} credits</span>
          <button data-action="skip-upgrade" style="font-size:0.85em">Skip →</button>
        </div>
        <p class="muted" style="margin-top:6px">Upgrades: ${this.purchasedUpgrades.length} · ${mutatorSlots} · Score: ${this.endlessScore.toLocaleString()}</p>
      `;


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
        ${this.isEndlessMode ? `<div><span>Credits</span><strong style=\"color:#fbbf24\">💰 ${this.endlessCredits}</strong></div>` : ''}
        ${this.isEndlessMode && this.wingmanState.config ? `<div><span>Wingman</span><strong style="color:${this.wingmanState.active ? '#60a5fa' : '#64748b'}">${this.wingmanState.active ? `${this.wingmanState.config.name} ${(this.wingmanState.hpFraction * 100).toFixed(0)}% · ${this.wingmanState.totalKills} K · ${Math.round(this.wingmanState.totalDamageDealt)} dmg` : `Respawn ${this.wingmanState.respawnTimer.toFixed(0)}s · ${this.wingmanState.totalKills} K · ${Math.round(this.wingmanState.totalDamageDealt)} dmg`}</strong></div>` : ''}
        ${this.isEndlessMode && this.nemesisState.active ? `<div><span>Nemesis</span><strong style="color:#f472b6">${getNemesisStatus(this.nemesisState.active)}</strong></div>` : ''}
        ${this.isEndlessMode && this.nearMissState.active ? `<div><span style="color:#fbbf24">💫 NEAR MISS</span><strong style="color:#fbbf24">${this.nearMissState.currentStreak}x streak</strong></div>` : ''}
        ${this.isEndlessMode && this.purchasedUpgrades.length > 0 ? `<div><span>Upgrades</span><strong>${this.purchasedUpgrades.length}</strong></div>` : ''}
        ${this.arenaRift ? this.renderRiftHud() : ''}
      </div>
      <div class="ability-bar">
        ${this.renderAbilitySlot(this.player.abilities[0], '1', '🛡')}
        ${this.renderAbilitySlot(this.player.abilities[1], '2', '🔥')}
        ${this.renderAbilitySlot(this.player.abilities[2], '3', '⚡')}
        ${this.renderAbilitySlot(this.player.abilities[3], '4', '🔧')}
        ${this.renderDashSlot()}
        ${this.isEndlessMode ? this.renderOverdriveSlot() : ''}
      </div>
      <div class="ability-bar crew-order-bar">
        ${this.renderCrewOrderSlot('pilot_surge')}
        ${this.renderCrewOrderSlot('gunner_focus')}
        ${this.renderCrewOrderSlot('engineer_reroute')}
        ${this.renderCrewOrderSlot('tactician_link')}
      </div>
      <p class="muted">Crew ${crewSummary}</p>
      ${this.isEndlessMode && this.comboState.kills >= 2 ? this.renderComboHud() : ''}
      ${this.activeContract ? `<div class="contract-status-box" style="border-color:${this.activeContract.color};background:rgba(${parseInt(this.activeContract.color.slice(1,3),16)},${parseInt(this.activeContract.color.slice(3,5),16)},${parseInt(this.activeContract.color.slice(5,7),16)},0.08)"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="color:${this.activeContract.color}">${this.activeContract.icon} ${this.activeContract.displayName}</strong><span style="color:${this.activeContract.color};font-size:0.78em">${this.renderContractReward(this.activeContract)}</span></div><div style="margin-top:4px;color:#e2e8f0">${getContractProgressLabel(this.activeContract)}</div></div>` : ''}
      ${this.player.maxShield > 0 ? `<div class="meter shield"><span style="width:${shieldRatio * 100}%"></span></div>` : ''}
      <div class="meter"><span style="width:${hpRatio * 100}%"></span></div>
      <div class="meter heat"><span style="width:${Math.min(100, heatRatio * 100)}%"></span></div>
      ${this.encounterObjective.type === 'protect_ally' ? `<div class="meter"><span style="width:${Math.min(100, convoyProgress * 100)}%; background:linear-gradient(90deg,#67e8f9,#22d3ee)"></span></div>` : ''}
      <p class="muted">${this.encounterObjective.label}</p>
      <p class="muted">${this.waveAnnouncement}</p>
      ${this.pickupAnnouncement ? `<p class="success" style="font-size:0.9em">${this.pickupAnnouncement}</p>` : ''}
      ${this.comboState.tierAnnouncement ? `<p style="font-size:1.1em;color:${getComboTier(this.comboState.kills).color};font-weight:700;text-shadow:0 0 8px ${getComboTier(this.comboState.kills).color}">${this.comboState.tierAnnouncement}</p>` : ''}
      ${this.eliteAnnouncement ? `<p style=\"font-size:1em;color:#fbbf24;font-weight:600;text-shadow:0 0 6px rgba(251,191,36,0.5)\">${this.eliteAnnouncement}</p>` : ''}
      ${this.bossAnnouncement ? `<p style=\"font-size:1.2em;color:#ef4444;font-weight:700;text-shadow:0 0 10px rgba(239,68,68,0.6)\">${this.bossAnnouncement}</p>` : ''}
      ${this.bossWarning ? `<p style=\"font-size:1em;color:#f97316;font-weight:600;text-shadow:0 0 6px rgba(249,115,22,0.5)\">${this.bossWarning}</p>` : ''}
      ${this.salvageAnnouncement ? `<p style=\"font-size:1.05em;color:#c084fc;font-weight:600;text-shadow:0 0 8px rgba(192,132,252,0.5)\">${this.salvageAnnouncement}</p>` : ''}
      ${this.lineageAnnouncement ? `<p style=\\"font-size:1.05em;color:#4ade80;font-weight:600;text-shadow:0 0 8px rgba(74,222,128,0.5)\\">${this.lineageAnnouncement}</p>` : ''}
      ${this.mutagenAnnouncement ? `<div style="color:#34d399;font-size:0.9em;text-align:center;text-shadow:0 0 8px #34d399">${this.mutagenAnnouncement}</div>` : ''}
      ${this.nemesisAnnouncement ? `<div style="color:#f472b6;font-size:0.96em;text-align:center;text-shadow:0 0 8px rgba(244,114,182,0.55)">${this.nemesisAnnouncement}</div>` : ''}
      ${this.crewOrderAnnouncement ? `<div style="color:#93c5fd;font-size:0.92em;text-align:center;text-shadow:0 0 8px rgba(147,197,253,0.55)">${this.crewOrderAnnouncement}</div>` : ''}
      ${this.contractAnnouncement ? `<div style="color:#fbbf24;font-size:0.92em;text-align:center;text-shadow:0 0 8px rgba(251,191,36,0.55)">${this.contractAnnouncement}</div>` : ''}
      ${this.sigilAnnouncement ? `<div style="color:${this.getSigilColor()};font-size:0.95em;text-align:center;font-weight:600;text-shadow:0 0 10px ${this.getSigilColor()}">${this.sigilAnnouncement}</div>` : ''}
      ${this.nemesisShip && this.nemesisShip.alive && this.nemesisState.active ? (() => {
        const nHp = Math.max(0, this.nemesisShip.hp);
        const nMax = this.nemesisShip.stats.maxHp;
        const nRatio = nMax > 0 ? nHp / nMax : 0;
        return `<div style=\"margin:6px 0;padding:4px 8px;border:1px solid #f472b6;border-radius:4px;background:rgba(244,114,182,0.1)\">
          <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:4px\">
            <strong style=\"color:#f472b6;font-size:0.85em\">☠ ${this.nemesisState.active.callsign}</strong>
            <span style=\"color:#f9a8d4;font-size:0.75em\">${getNemesisStatus(this.nemesisState.active)}</span>
          </div>
          <div style=\"height:8px;background:#1e1e1e;border-radius:4px;overflow:hidden\">
            <div style=\"width:${nRatio * 100}%;height:100%;background:linear-gradient(90deg,#f472b6,#fb7185);transition:width 0.3s\"></div>
          </div>
          <span style=\"font-size:0.7em;color:#fbcfe8\">${nHp.toFixed(0)} / ${nMax.toFixed(0)}</span>
        </div>`;
      })() : ''}
      ${this.bossShip && this.bossShip.alive ? (() => {
        const bHp = Math.max(0, this.bossShip.hp);
        const bMax = this.bossShip.stats.maxHp;
        const bRatio = bMax > 0 ? bHp / bMax : 0;
        const bPhase = this.bossAI ? getPhaseDef(this.bossAI.phaseIndex) : null;
        return `<div style=\"margin:6px 0;padding:4px 8px;border:1px solid #ef4444;border-radius:4px;background:rgba(239,68,68,0.1)\">
          <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:4px\">
            <strong style=\"color:#ef4444;font-size:0.85em\">💀 ${getBossName(this.currentWave)}</strong>
            ${bPhase ? `<span style=\"color:#f97316;font-size:0.75em\">${bPhase.displayName}</span>` : ''}
          </div>
          <div style=\"height:8px;background:#1e1e1e;border-radius:4px;overflow:hidden\">
            <div style=\"width:${bRatio * 100}%;height:100%;background:linear-gradient(90deg,#ef4444,#f97316);transition:width 0.3s\"></div>
          </div>
          <span style=\"font-size:0.7em;color:#94a3b8\">${bHp.toFixed(0)} / ${bMax.toFixed(0)}</span>
          ${this.bossAI?.transitioning ? '<span style=\"font-size:0.7em;color:#fbbf24;margin-left:8px">⚡ INVULNERABLE</span>' : ''}
        </div>`;
      })() : ''}
      <!-- Overdrive vignette handled by atmosphere CSS layers -->
      ${this.playerBuffs.length > 0 ? `<div class="ability-bar">${this.playerBuffs.map((b) => `<div class="ability-slot active" title="${b.kind === 'power_surge' ? 'Power Surge' : 'Rapid Fire'} — ${b.remaining.toFixed(1)}s"><span class="ability-icon">${b.kind === 'power_surge' ? '⚡' : '🔥'}</span><span class="ability-fill active-fill" style="width:${(b.remaining / b.duration) * 100}%"></span></div>`).join('')}</div>` : ''}
      ${this.activeMutators.length > 0 ? `<div class="ability-bar" style="justify-content:center;gap:6px">${this.activeMutators.map((m) => `<div class="ability-slot active" title="${m.def.displayName}: ${m.def.description}" style="border-color:#c084fc"><span class="ability-icon">${m.def.icon}</span></div>`).join('')}</div>` : ''}
      ${this.sigilState.activeId ? (() => {
        const def = getSigilDef(this.sigilState.activeId);
        if (!def) return '';
        const tierLabel = ['I', 'II', 'III'][this.sigilState.currentTier - 1] ?? '';
        return `<div class="ability-bar" style="justify-content:center;gap:6px;border-color:${def.color}"><span style="color:${def.color};font-size:0.7em;font-weight:600">SIGIL</span><div class="ability-slot active" title="${def.displayName} Tier ${tierLabel}: ${def.tagline}" style="border-color:${def.color}"><span class="ability-icon">${def.icon}</span></div><span style="color:#e2e8f0;font-size:0.75em">${def.displayName}</span><span style="color:${def.color};font-size:0.7em">T${tierLabel}</span>${this.sigilState.killStreak > 1 ? `<span style="color:#f97316;font-size:0.7em">🔥×${this.sigilState.killStreak}</span>` : ''}</div>`;
      })() : ''}
      ${this.crisisState.activeEffects.length > 0 ? `<div class="ability-bar" style="justify-content:center;gap:6px;border-color:#fbbf24"><span style="color:#fbbf24;font-size:0.7em;font-weight:600">CRISIS</span>${getActiveEffectLabels(this.crisisState.activeEffects).map((effect) => `<div class="ability-slot active" title="${effect.name}" style="border-color:${effect.color}"><span class="ability-icon">${effect.icon}</span></div>`).join('')}</div>` : ''}
      ${hasMutations(this.mutagenState) ? `
        <div class="ability-bar" style="border-color:#34d399;margin-top:2px">
          <span style="color:#34d399;font-size:0.7em;font-weight:600">MUTATIONS</span>
          ${this.mutagenState.mutations.map(m => {
            const def = getMutationDef(m.id);
            if (!def) return '';
            return `<span style="color:${def.color}" title="${def.description} (${m.stacks} stack${m.stacks > 1 ? 's' : ''})">${def.icon}${m.stacks > 1 ? '×' + m.stacks : ''}</span>`;
          }).join('')}
        </div>` : ''}
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
          creditsEarned: this.runStats.creditsEarned,
          timeSeconds: this.elapsedEncounterSeconds,
          hpRemaining: Math.max(0, this.player.hp),
          maxHp: this.player.stats.maxHp,
          nearMissTotal: this.nearMissState.total,
          nearMissBestStreak: this.nearMissState.bestStreak,
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

        // Finalize legacy progression (idempotent)
        this.finalizeLegacyRun(this.buildLegacySnapshot(grade));

        // Save run to pilot chronicle once per run.
        if (!this.chronicleSaved) {
          try {
            saveRunRecord(buildRunRecord({
              stats: s,
              shipName: this.player.blueprint.name,
              sigil: this.sigilState.activeId ? { id: this.sigilState.activeId, tier: this.sigilState.currentTier } : null,
              mutators: s.mutatorsChosen,
              upgrades: s.upgradesPurchased,
              crisisChoices: [...this.crisisState.activeEffects],
              nemesisKills: this.nemesisKillsThisRun,
              riftsSurvived: this.riftEventsSurvived,
            }));
            this.chronicleSaved = true;
          } catch { /* chronicle unavailable — non-critical */ }
        }
        const legacySummary = getLegacySummary(this.legacyState);
        const legacyXpGained = computeLegacyXp(this.buildLegacySnapshot(grade));
        const milestoneTags = this.legacyNewMilestones.length > 0
          ? this.legacyNewMilestones.map((m) =>
              `<span style="display:inline-block;background:#7c3aed20;color:#c084fc;padding:2px 8px;border-radius:4px;font-size:0.8em;margin:2px">${m.icon} ${m.displayName}</span>`
            ).join('')
          : '';
        const wingmanDebrief = this.wingmanState.config
          ? `<div style="background:#0f172a;border-radius:6px;padding:8px;margin-bottom:6px;border:1px solid rgba(96,165,250,0.18)"><div style="font-size:0.8em;color:#93c5fd;font-weight:600;margin-bottom:4px">🛡 Wingman Contribution</div><div style="display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:0.78em;color:#cbd5e1"><span>Escort</span><span>${this.wingmanState.config.name}</span><span>Status</span><span>${this.wingmanState.active ? 'Operational' : this.wingmanState.totalKills > 0 || this.wingmanState.totalDamageDealt > 0 ? 'Shot down' : 'No deployment impact'}</span><span>Kills</span><span>${this.wingmanState.totalKills}</span><span>Damage dealt</span><span>${Math.round(this.wingmanState.totalDamageDealt)}</span></div></div>`
          : '';
        const essenceDebrief = this.mutagenState.pendingEssence.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${this.mutagenState.pendingEssence.map((essence) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#062f24;color:#6ee7b7;border:1px solid rgba(52,211,153,0.28);padding:2px 8px;border-radius:999px;font-size:0.74em">🧬 ${essence.affixId} · W${essence.waveNumber}</span>`).join('')}</div>`
          : '';
        const careerGains = (this.runSalvagedEntries.length > 0 || this.runCorruptedEntries.length > 0 || this.mutagenState.pendingEssence.length > 0)
          ? `<div style="background:#111827;border-radius:6px;padding:8px;margin-bottom:6px;border:1px solid rgba(148,163,184,0.14)"><div style="font-size:0.8em;color:#e2e8f0;font-weight:600;margin-bottom:4px">Career Gains</div><div style="display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:0.78em;color:#cbd5e1"><span>Blueprints salvaged</span><span>${this.runSalvagedEntries.length}</span><span>Corrupted modules extracted</span><span>${this.runCorruptedEntries.length}</span><span>Essence secured</span><span>${this.mutagenState.pendingEssence.length}</span></div>${this.runSalvagedEntries.length > 0 ? `<div style="margin-top:6px">${this.runSalvagedEntries.map((entry) => { const rc = RARITY_CONFIG[entry.rarity]; return `<span style="display:inline-block;margin:2px 6px 0 0;color:${rc.color};font-size:0.76em">🔧 ${entry.name}</span>`; }).join('')}</div>` : ''}${this.runCorruptedEntries.length > 0 ? `<div style="margin-top:6px">${this.runCorruptedEntries.map((entry) => `<span style="display:inline-block;margin:2px 6px 0 0;color:${entry.sourceColor};font-size:0.76em">🧬 ${entry.displayName}</span>`).join('')}</div>` : ''}${essenceDebrief}</div>`
          : '';
        const chronicleDebrief = (this.crisisState.activeEffects.length > 0 || this.nemesisKillsThisRun > 0 || this.riftEventsSurvived > 0)
          ? `<div style="background:#1f2937;border-radius:6px;padding:8px;margin-bottom:6px;border:1px solid rgba(244,114,182,0.16)"><div style="font-size:0.8em;color:#f9a8d4;font-weight:600;margin-bottom:4px">Chronicle Notes</div><div style="display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:0.78em;color:#cbd5e1"><span>Crisis effects carried</span><span>${this.crisisState.activeEffects.length}</span><span>Nemesis kills</span><span>${this.nemesisKillsThisRun}</span><span>Rifts survived</span><span>${this.riftEventsSurvived}</span></div>${this.crisisState.activeEffects.length > 0 ? `<div style="margin-top:6px;color:#fbcfe8;font-size:0.76em">${this.crisisState.activeEffects.join(' · ')}</div>` : ''}</div>`
          : '';
        const xpPct = legacySummary.xpForNext > 0
          ? Math.min(100, Math.floor((legacySummary.currentXp / legacySummary.xpForNext) * 100))
          : 0;

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
              <span style="color:#94a3b8">Near Misses</span><span style="text-align:right;font-weight:600;color:#fbbf24">💫 ${s.nearMissTotal}</span>
              <span style="color:#94a3b8">Best Streak</span><span style="text-align:right;font-weight:600;color:#c084fc">${s.nearMissBestStreak}x</span>
              <span style="color:#94a3b8">Upgrades</span><span style="text-align:right;font-weight:600">${s.upgradesPurchased.length}</span>
            </div>
          </div>
          ${highlights.length > 0 ? `<div style="text-align:center;margin-bottom:6px">${highlights.map((h) => `<span style="display:inline-block;background:#334155;color:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:0.8em;margin:2px">⭐ ${h}</span>`).join('')}</div>` : ''}
          <div style="font-size:0.8em;margin-bottom:4px"><span style="color:#94a3b8">Traits:</span> ${mutatorTags}</div>
          ${this.sigilState.activeId ? (() => {
            const def = getSigilDef(this.sigilState.activeId);
            if (!def) return '';
            const tierLabel = ['I', 'II', 'III'][this.sigilState.currentTier - 1] ?? '';
            return `<div style="font-size:0.8em;margin-bottom:4px"><span style="color:#94a3b8">Sigil:</span> <span style="color:${def.color};font-weight:600">${def.icon} ${def.displayName}</span> <span style="color:#64748b">Tier ${tierLabel}</span></div>`;
          })() : ''}
          <div style="font-size:0.8em;color:#fb7185;margin-bottom:6px">${cause}</div>
          ${wingmanDebrief}
          ${careerGains}
          ${chronicleDebrief}
          <div style="background:#0f172a;border-left:3px solid #38bdf8;padding:6px 8px;border-radius:0 4px 4px 0;font-size:0.8em;color:#94a3b8;margin-bottom:6px">
            <strong style="color:#38bdf8">Next run:</strong> ${tip}
          </div>
          <div style="background:#1e1b4b;border-radius:6px;padding:8px;margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:0.8em;color:#c084fc;font-weight:600">${legacySummary.rank.icon} ${legacySummary.rank.name} Lv.${legacySummary.level}</span>
              <span style="font-size:0.75em;color:#a78bfa">+${legacyXpGained} XP</span>
            </div>
            <div style="background:#312e81;border-radius:3px;height:6px;overflow:hidden;margin-bottom:4px">
              <div style="background:linear-gradient(90deg,#7c3aed,#a78bfa);height:100%;width:${xpPct}%;border-radius:3px"></div>
            </div>
            <div style="font-size:0.7em;color:#6366f1">${legacySummary.currentXp} / ${legacySummary.xpForNext} XP to next level · ${legacySummary.milestonesCompleted}/${legacySummary.milestonesTotal} milestones</div>
            ${milestoneTags ? `<div style="text-align:center;margin-top:4px">${milestoneTags}</div>` : ''}
          </div>
          <button class="primary" id="debrief-restart" style="width:100%;margin-top:4px;font-size:0.85em">↻ Restart</button>
        `;
        this.uiRoot.querySelector('#debrief-restart')?.addEventListener('click', () => {
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
    this.updateMouseWorldFromClientPoint(event.clientX, event.clientY);
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
          nebula.material.opacity = 0.22 + pulse * 0.12;
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
    this.shipNebulaDrain.clear();

    for (const ship of this.ships) {
      if (!ship.alive) continue;

      for (const hazard of this.hazards) {
        const result = applyShipHazardCollision(
          hazard, ship.id, ship.position.x, ship.position.z, ship.radius * 0.45, dt, now,
        );

        // Cache nebula shield drain multiplier for the recharge loop
        if (result.shieldDrainMultiplier > 1) {
          this.shipNebulaDrain.set(ship.id, result.shieldDrainMultiplier);
        }

        // Nebula velocity slow — applies to all ships (skip while dashing for player)
        if (hazard.kind === 'damage_nebula' && result.damageTaken > 0) {
          const isDashingThrough = ship.id === this.player.id && isInvulnerable(this.dashState);
          if (!isDashingThrough) {
            ship.velocity.multiplyScalar(0.92);
          } else if (this.dashState.nebulaBoostRemaining <= 0) {
            // Dash-through interaction: 2x projectile damage boost for 2s
            this.dashState = triggerNebulaBoost(this.dashState);
          }
        }

        // Conduit dash-through interaction: instant full shield recharge (once per dash)
        if (hazard.kind === 'shield_conduit' && result.shieldRestored > 0
            && ship.id === this.player.id && isInvulnerable(this.dashState)
            && !this.dashState.conduitRestoreApplied) {
          this.dashState = triggerConduitRestore(this.dashState);
          this.player.shield = this.player.maxShield;
          this.particles.emit(ParticleSystem.shieldAbsorb(this.player.position, '#38bdf8'));
        }

        // Asteroid push (skip during dash — phase through)
        const isPlayerDashing = ship.id === this.player.id && isDashing(this.dashState);
        if (!isPlayerDashing && (result.pushX !== 0 || result.pushZ !== 0)) {
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
          // Nebula bypasses shields — direct hull damage only, respecting armor
          const isPlayerShip = ship.id === this.player.id;
          if (isPlayerShip && isInvulnerable(this.dashState)) continue;
          const resolved = resolveDamage(
            result.damageTaken, 'energy', 0.5,
            0, ship.stats.armorRating,
            ship.stats.kineticBypass, ship.stats.energyVulnerability,
          );
          if (resolved.hullDamage > 0) {
            const destroyed = damageModules(ship.moduleStates, resolved.hullDamage, Math.random() * Math.PI * 2, 0.6);
            if (destroyed.length > 0) {
              for (const id of destroyed) {
                this.darkenModuleMeshes(ship, id);
              }
              ship.hp = ship.moduleStates.filter((m) => !m.destroyed).reduce((sum, m) => sum + m.currentHp, 0);
              if (ship.id === this.player.id) {
                this.spawnImpactVisual(ship.position, '#c084fc');
                this.recentDamageTime = this.elapsedEncounterSeconds;
              }
            }
            if (this.isEndlessMode) {
              if (isPlayerShip) this.runStats.damageTaken += resolved.hullDamage;
              else this.runStats.damageDealt += resolved.hullDamage;
            }
            this.handleContractHullDamage(isPlayerShip ? resolved.hullDamage : 0);
          }
          if (ship.hp <= 0) {
            ship.alive = false;
            ship.group.visible = false;
            playExplosion();
            this.spawnExplosionVisual(ship.position, ship.team === 'player' ? '#fca5a5' : '#fb7185');
            for (const config of ParticleSystem.deathExplosion(ship.position)) {
              this.particles.emit(config);
            }
            if (ship.id === this.player.id) {
              this.resolveNemesisOnPlayerDeath();
            }
            this.handleAffixExplosion(ship);
            this.handleNemesisKilled(ship);
            // Blueprint scavenging (elite/boss kill — beam death path)
            this.handleSalvageOnKill(ship);
            this.handleContractEnemyKill(ship);
            // Mutagen: collect essence from elite/boss kills (beam path)
            if (this.isEndlessMode && ship.team === 'enemy') {
              const essenceAffixes = this.shipAffixes.get(ship.id);
              if (essenceAffixes && essenceAffixes.length >= 2) {
                const affixIds = essenceAffixes.map(a => a.def.id as MutagenId);
                this.mutagenState = collectEssenceFromKill(
                  this.mutagenState, affixIds, !!ship.isBoss, this.currentWave,
                );
                persistMutagenState(this.mutagenState);
                if (this.mutagenState.pendingEssence.length > 0) {
                  this.mutagenAnnouncement = `🧬 Essence collected! (${this.mutagenState.pendingEssence.length}/${MAX_ESSENCE_SLOTS})`;
                  this.mutagenAnnouncementTimer = 2;
                }
              }
            }
            if (this.isEndlessMode && ship.team === 'enemy') {
              this.endlessTotalKills += 1;
              const killedAffixes = this.shipAffixes.get(ship.id);
              const killedIsElite = killedAffixes && killedAffixes.length >= 2;
              if (killedAffixes && killedAffixes.length > 0) {
                this.endlessWaveEliteBonus += Math.floor(10 * eliteCreditsMultiplier(killedAffixes));
              }
              this.shipAffixes.delete(ship.id);
              // Crisis: Neural Link — elite kill buff
              if (killedIsElite && getEliteKillBuffDuration(this.crisisState.activeEffects) > 0) {
                this.crisisEliteKillBuffTimer = getEliteKillBuffDuration(this.crisisState.activeEffects);
              }
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
              // Boss kill tracking (beam death path)
              if (ship.isBoss) {
                this.runStats.bossKills += 1;
                if (this.bossAI) this.bossAI = { ...this.bossAI, defeated: true };
                this.bossShip = null;
                playBossDefeated();
                this.particles.emit(ParticleSystem.bossDeathExplosion(ship.position));
                this.screenShake = createScreenShake(1.0, 0.8);
                this.bossAnnouncement = '🏆 BOSS DEFEATED';
                this.bossAnnouncementTimer = 3;
                this.bossWarning = '';
                this.clearBossTelegraphs();
              }
              this.runStats.bestCombo = Math.max(this.runStats.bestCombo, this.comboState.kills);
              if (comboResult.tierUp) this.runStats.highestComboTier = getComboTier(this.comboState.kills).label;
              const comboMult2 = getComboTier(this.comboState.kills).multiplier;
              this.overdriveState = addOverdriveCharge(this.overdriveState, OVERDRIVE_CHARGE_PER_KILL * comboMult2 * getOverdriveChargeMult(this.crisisState.activeEffects));
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
      const sigilDespawnDt = this.sigilEffects.pickupDespawnMult < 1 ? dt / this.sigilEffects.pickupDespawnMult : dt;
      const updated = updatePickup(pickup, sigilDespawnDt);

      // Magnetic attraction toward player
      if (updated.active && this.player.alive) {
        const attracted = applyPickupAttraction(
          { ...updated, attractionRange: updated.attractionRange * (1 + this.effectiveStats.pickupRangeBonus) * this.sigilEffects.pickupRangeMult },
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
              buff.remaining *= this.effectiveStats.buffDurationBonus;
              buff.duration *= this.effectiveStats.buffDurationBonus;
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
    this.comboState = tickCombo(
      this.comboState,
      dt
        * getComboTimerDecayMult(this.crisisState.activeEffects)
        * getTacticianComboDecayMultiplier(this.crewOrdersState, this.player.blueprint.crew),
    );
  }

  private updateNearMiss(dt: number): void {
    if (!this.isEndlessMode) return;
    const wasActive = this.nearMissState.active;
    const { state } = tickNearMiss(this.nearMissState, dt);
    this.nearMissState = state;

    // Toggle CSS class for vignette/tint effect
    const canvas = this.renderer.domElement;
    if (this.nearMissState.active && !wasActive) {
      canvas.classList.add('near-miss-active');
    } else if (!this.nearMissState.active && wasActive) {
      canvas.classList.remove('near-miss-active');
    }
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

  // ── Boss Encounter System ──────────────────────────────────

  private updateBoss(dt: number): void {
    if (!this.bossAI || !this.bossShip || !this.bossShip.alive) return;

    const prev = { ...this.bossAI };
    this.bossAI = updateBossAI(
      this.bossAI,
      dt,
      this.bossShip.hp,
      this.bossShip.stats.maxHp,
      { x: this.bossShip.position.x, z: this.bossShip.position.z },
      { x: this.player.position.x, z: this.player.position.z },
    );

    // Phase transition VFX + audio
    if (!prev.transitioning && this.bossAI.transitioning) {
      playBossPhaseTransition();
      this.particles.emit(ParticleSystem.bossPhaseTransition(this.bossShip.position));
      this.musicState = triggerDramaticMoment(this.musicState, 3.0);
      const ann = getBossPhaseAnnouncement(this.bossAI);
      if (ann) {
        this.bossAnnouncement = ann;
        this.bossAnnouncementTimer = 3;
      }
    }

    // Telegraph started
    if (this.bossAI.telegraphing && !prev.telegraphing) {
      this.bossTelegraphPlayed = false;
    }
    // Play telegraph audio once
    if (this.bossAI.telegraphing && !this.bossTelegraphPlayed) {
      playBossTelegraph();
      this.bossTelegraphPlayed = true;
    }

    // Attack went active
    if (this.bossAI.activeAttack && !prev.activeAttack) {
      playBossAttack();
      this.bossAttackPlayed = true;
      this.particles.emit(ParticleSystem.bossShockwaveRing(this.bossShip.position));
    }

    // Boss attack damages player
    if (isBossAttackActive(this.bossAI)) {
      const attack = getActiveBossAttack(this.bossAI);
      if (attack && this.player.alive) {
        const inArea = isPointInBossAttackArea(
          this.bossAI,
          { x: this.player.position.x, z: this.player.position.z },
          { x: this.bossShip.position.x, z: this.bossShip.position.z },
        );
        if (inArea) {
          const mults = getBossPhaseMultipliers(this.bossAI);
          this.applyDamage(this.player, attack.damage * mults.damageMult * dt * 2, 'kinetic', 0.3, 0);
        }
      }
    }

    // Warning text
    const warning = getBossWarningText(this.bossAI);
    this.bossWarning = warning ?? '';

    // Tick announcement
    if (this.bossAnnouncementTimer > 0) {
      this.bossAnnouncementTimer -= dt;
      if (this.bossAnnouncementTimer <= 0) this.bossAnnouncement = '';
    }

    // Update telegraph visuals
    this.updateBossTelegraphVisuals(dt);

    // Override boss movement during charge attacks
    if (this.bossAI.chargeTarget && this.bossAI.activeAttack) {
      const target = this.bossAI.chargeTarget;
      const dir = new THREE.Vector3(target.x - this.bossShip.position.x, 0, target.z - this.bossShip.position.z);
      const dist = dir.length();
      if (dist > 0.5) {
        dir.normalize();
        const chargeSpeed = 12 * getBossPhaseMultipliers(this.bossAI).speedMult;
        this.bossShip.velocity.copy(dir.multiplyScalar(chargeSpeed));
        this.bossShip.position.addScaledVector(this.bossShip.velocity, dt);
        this.clampToArena(this.bossShip.position);
      }
    }
  }

  private updateBossTelegraphVisuals(dt: number): void {
    if (!this.bossAI) return;

    // Clear old telegraph meshes
    while (this.bossTelegraphGroup.children.length > 0) {
      const child = this.bossTelegraphGroup.children[0];
      this.bossTelegraphGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Render active telegraphs as pulsing circles
    for (const telegraph of this.bossAI.telegraphs) {
      const progress = 1 - telegraph.timeRemaining / telegraph.duration;
      const radius = telegraph.radius;

      // Warning ring
      const ringGeo = new THREE.RingGeometry(Math.max(0.1, radius - 0.15), radius + 0.15, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.3 + progress * 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(telegraph.position.x, 0.15, telegraph.position.z);
      this.bossTelegraphGroup.add(ring);

      // Inner fill
      const fillGeo = new THREE.CircleGeometry(radius, 32);
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xff2222,
        transparent: true,
        opacity: progress * 0.15,
        side: THREE.DoubleSide,
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(telegraph.position.x, 0.1, telegraph.position.z);
      this.bossTelegraphGroup.add(fill);
    }

    // Render beam sweep indicator
    if (this.bossAI.activeAttack?.id === 'beam_sweep' && this.bossShip) {
      const beamLen = 20;
      const beamWidth = 0.4;
      const beamGeo = new THREE.PlaneGeometry(beamWidth, beamLen);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff0066,
        transparent: true,
        opacity: 0.6 + Math.sin(performance.now() * 0.01) * 0.2,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.x = -Math.PI / 2;
      beam.position.set(this.bossShip.position.x, 0.2, this.bossShip.position.z);
      beam.rotation.z = this.bossAI.beamSweepAngle;
      this.bossTelegraphGroup.add(beam);
    }

    // Shockwave visual ring
    if (this.bossAI.activeAttack?.id === 'shockwave' && this.bossShip) {
      const swRadius = this.bossAI.shockwaveRadius;
      if (swRadius > 0.5) {
        const swGeo = new THREE.RingGeometry(
          Math.max(0.1, swRadius - 0.8),
          swRadius + 0.2,
          48,
        );
        const swMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.5 * (1 - swRadius / (this.bossAI.shockwaveMaxRadius || 12)),
          side: THREE.DoubleSide,
        });
        const sw = new THREE.Mesh(swGeo, swMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(this.bossShip.position.x, 0.15, this.bossShip.position.z);
        this.bossTelegraphGroup.add(sw);
      }
    }
  }

  private clearBossTelegraphs(): void {
    while (this.bossTelegraphGroup.children.length > 0) {
      const child = this.bossTelegraphGroup.children[0];
      this.bossTelegraphGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  // ── Battle Music Director ──────────────────────────────────

  private updateMusic(dt: number): void {
    const enemyCount = this.ships.filter(s => s.alive && s.team === 'enemy').length;
    const playerHpFraction = this.player.hp / Math.max(1, this.player.stats.maxHp);
    const playerTakingDamage = (this.elapsedEncounterSeconds - this.recentDamageTime) < 3;
    // Map combo kills to a numeric tier (0-5) for music intensity
    const comboTier = this.comboState.kills >= 20 ? 5
      : this.comboState.kills >= 15 ? 4
      : this.comboState.kills >= 10 ? 3
      : this.comboState.kills >= 5 ? 2
      : this.comboState.kills >= 2 ? 1
      : 0;

    const { state: newState, beatTriggered } = updateMusicDirector(
      this.musicState,
      dt,
      {
        inGame: true,
        waveActive: this.currentWave > 0,
        enemyCount,
        comboTier,
        overdriveActive: isOverdriveActive(this.overdriveState),
        bossAlive: this.bossShip !== null && this.bossShip.alive,
        bossPhaseIndex: this.bossAI?.phaseIndex ?? -1,
        playerTakingDamage,
        playerHpFraction,
        waveTime: this.elapsedEncounterSeconds,
      },
    );

    this.musicState = newState;

    if (beatTriggered) {
      triggerBeat(this.musicState);
    }
  }

  private updateAtmosphere(dt: number): void {
    if (!this.isEndlessMode) return;

    const hpFraction = this.player.hp / Math.max(1, this.player.stats.maxHp);
    const nearMissSlowMo = this.nearMissState.active;

    this.atmosphere = tickAtmosphere(this.atmosphere, {
      intensity: this.musicState.intensity,
      hpFraction,
      comboKills: this.comboState.kills,
      overdriveActive: isOverdriveActive(this.overdriveState),
      bossAlive: this.bossShip !== null && this.bossShip.alive,
      nearMissActive: nearMissSlowMo,
      elapsed: this.elapsedEncounterSeconds,
      waveActive: this.currentWave > 0 && this.ships.some(s => s.alive && s.team === 'enemy'),
    }, dt);

    const a = this.atmosphere;

    // ── Grid brightness ──
    this.arenaGridMaterial.opacity = a.gridBrightness;
    // Shift grid color with intensity
    const gridColor = new THREE.Color(a.ringColor);
    this.arenaGridMaterial.color = gridColor;

    // ── Arena ring pulse ──
    const ringMat = this.arenaRing.material as THREE.LineBasicMaterial;
    ringMat.color = new THREE.Color(a.ringColor);
    ringMat.transparent = true;
    ringMat.opacity = 0.3 + a.ringPulse * 0.7;

    // ── Stars ──
    const starMat = this.arenaStars.material as THREE.PointsMaterial;
    starMat.opacity = a.starBrightness;
    starMat.size = 0.03 + a.starTwinkle * 0.06;

    // ── Fog ──
    if (!this.scene.fog) {
      this.scene.fog = new THREE.FogExp2(0x081421, 0.008);
    }
    (this.scene.fog as THREE.FogExp2).density = 0.006 + (1 - a.fogFar / 75) * 0.01;

    // ── Nebula ambient particles ──
    this.nebulaEmitAccum += dt * a.nebulaRate;
    while (this.nebulaEmitAccum >= 1) {
      this.nebulaEmitAccum -= 1;
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * (ARENA_RADIUS - 6);
      this.particles.emit({
        position: new THREE.Vector3(
          Math.cos(angle) * dist,
          0.1 + Math.random() * 1.5,
          Math.sin(angle) * dist,
        ),
        count: 1,
        speed: [a.nebulaDrift * 0.3, a.nebulaDrift * 0.6],
        life: [2, 5],
        startScale: [0.08, 0.2],
        color: a.nebulaColor,
        startOpacity: 0.15 + Math.random() * 0.1,
        endOpacity: 0,
        drag: 0.95,
      });
    }

    // ── CSS vignette layers ──
    const root = document.documentElement;
    root.style.setProperty('--atmo-danger', String(a.dangerVignette));
    root.style.setProperty('--atmo-combo', String(a.comboShimmer));
    root.style.setProperty('--atmo-overdrive', String(a.overdriveVignette));
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

    // Damage other ships in range (player already handled above)
    const chainActive = chainReactionActive(this.activeMutators);
    for (const other of this.ships) {
      if (other.id === ship.id || other.id === this.player.id || !other.alive) continue;
      const dist = ship.position.distanceTo(other.position);
      if (dist < EXPLOSION_RADIUS) {
        if (other.team === 'player') {
          // Explosive enemies also damage player-team allies (wingman, escort)
          const dmg = Math.round(EXPLOSION_DAMAGE * (1 - dist / EXPLOSION_RADIUS * 0.5));
          this.applyDamage(other, dmg, 'kinetic', 0.5, 0);
        } else if (chainActive && other.team === 'enemy') {
          // Chain Reaction: player's mutator makes enemy explosions chain to other enemies
          const dmg = Math.round(EXPLOSION_DAMAGE * (1 - dist / EXPLOSION_RADIUS * 0.5));
          this.applyDamage(other, dmg, 'kinetic', 0.5, 0);
          this.particles.emit(ParticleSystem.hitSpark(other.position, '#fbbf24'));
        }
      }
    }
  }

  private updateContracts(dt: number): void {
    if (!this.activeContract) return;

    if (this.activeContract.status === 'active') {
      const next = tickContract(this.activeContract, dt, this.comboState.kills);
      if (next.kind === 'priority_target') {
        this.animateContractMarker();
      }
      if (isTerminalContract(next)) {
        this.resolveActiveContract(next);
        return;
      }
      this.activeContract = next;
    }
  }

  private handleContractEnemyKill(ship: RuntimeShip): void {
    if (!this.isEndlessMode || ship.team !== 'enemy' || !this.activeContract) return;

    let next = this.activeContract;
    next = registerPriorityTargetKill(next, ship.id);
    next = registerContractKill(next);

    if (next === this.activeContract) return;
    if (isTerminalContract(next)) {
      this.resolveActiveContract(next);
      return;
    }
    this.activeContract = next;
  }

  private handleContractHullDamage(hullDamage: number): void {
    if (!this.isEndlessMode || hullDamage <= 0 || !this.activeContract) return;
    const next = registerContractHullDamage(this.activeContract, hullDamage);
    if (next === this.activeContract) return;
    if (isTerminalContract(next)) {
      this.resolveActiveContract(next);
      return;
    }
    this.activeContract = next;
  }

  private resolveActiveContract(contract: ActiveContract): void {
    this.clearContractMarkers();
    if (contract.status === 'completed') {
      const rewardSummary = this.grantContractReward(contract);
      this.contractAnnouncement = `📜 ${contract.successMessage ?? 'Contract complete.'} ${rewardSummary}`.trim();
      this.contractAnnouncementTimer = 3.5;
    } else {
      this.contractAnnouncement = `📜 ${contract.failureMessage ?? 'Contract failed.'}`;
      this.contractAnnouncementTimer = 3;
    }
    this.activeContract = null;
  }

  private grantContractReward(contract: ActiveContract): string {
    let creditsRewarded = contract.reward.credits;
    const rewardBits = [`+${contract.reward.credits} credits`, `+${contract.reward.score} score`];

    this.endlessCredits += contract.reward.credits;
    this.runStats.creditsEarned += contract.reward.credits;
    this.endlessScore += contract.reward.score;

    if (contract.reward.overdriveCharge) {
      this.overdriveState = addOverdriveCharge(
        this.overdriveState,
        OVERDRIVE_FULL_CHARGE * contract.reward.overdriveCharge,
      );
      rewardBits.push(`+${Math.round(contract.reward.overdriveCharge * 100)}% overdrive`);
    }

    if (contract.reward.essenceId) {
      const beforeEssence = this.mutagenState.pendingEssence.length;
      this.mutagenState = collectEssenceFromKill(
        this.mutagenState,
        [contract.reward.essenceId],
        false,
        this.currentWave,
      );
      if (this.mutagenState.pendingEssence.length > beforeEssence) {
        persistMutagenState(this.mutagenState);
        const def = getMutationDef(contract.reward.essenceId);
        rewardBits.push(`${def?.icon ?? '🧬'} essence secured`);
      } else {
        creditsRewarded += 12;
        this.endlessCredits += 12;
        this.runStats.creditsEarned += 12;
        rewardBits.push('+12 credits (essence bay full)');
      }
    }

    this.onReward(this.encounterId, {
      credits: creditsRewarded,
      score: this.endlessScore,
      victory: true,
    });
    return rewardBits.join(' · ');
  }

  private animateContractMarker(): void {
    if (!this.activeContract || this.activeContract.kind !== 'priority_target') return;
    const target = this.ships.find((ship) => ship.id === this.activeContract?.targetShipId && ship.alive);
    const marker = target?.group.getObjectByName('contract-target-marker');
    if (!marker) return;
    const pulse = 1 + Math.sin(this.elapsedEncounterSeconds * 8) * 0.08;
    marker.scale.setScalar(pulse);
    marker.rotation.z += 0.05;
    marker.position.y = 0.7 + Math.sin(this.elapsedEncounterSeconds * 10) * 0.04;
  }

  private addContractMarker(ship: RuntimeShip): void {
    this.clearContractMarkers();
    const existing = ship.group.getObjectByName('contract-target-marker');
    if (existing) return;
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(0.65, ship.radius * 0.5), 0.08, 8, 24),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.9,
      }),
    );
    marker.name = 'contract-target-marker';
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 0.7;
    ship.group.add(marker);
  }

  private clearContractMarkers(): void {
    for (const ship of this.ships) {
      const marker = ship.group.getObjectByName('contract-target-marker');
      if (!marker) continue;
      ship.group.remove(marker);
      if (marker instanceof THREE.Mesh) {
        marker.geometry.dispose();
        if (marker.material instanceof THREE.Material) marker.material.dispose();
      }
    }
  }

  private renderContractReward(offer: ContractOffer): string {
    const parts = [`+${offer.reward.credits} credits`, `+${offer.reward.score} score`];
    if (offer.reward.overdriveCharge) {
      parts.push(`+${Math.round(offer.reward.overdriveCharge * 100)}% overdrive`);
    }
    if (offer.reward.essenceId) {
      const def = getMutationDef(offer.reward.essenceId);
      parts.push(`${def?.icon ?? '🧬'} essence`);
    }
    return parts.join(' · ');
  }

  // ── Upgrade Shop ──────────────────────────────────────────────

  private openUpgradeShop(waveCleared: number): void {
    this.shopWaveCleared = waveCleared;
    this.shopTargetWave = Math.max(1, waveCleared + 1);
    this.shopOptions = generateUpgradeOptions(this.shopTargetWave, this.purchasedUpgrades);
    this.shopMutatorOptions = this.generateMutatorOptions(this.shopTargetWave);
    this.contractOffers = generateContractOffers(this.shopTargetWave, isBossWave(this.shopTargetWave));

    // Free hull repair every 5 waves
    if (waveCleared > 0 && waveCleared % 5 === 0) {
      const repairAmount = computeRestRepairAmount(this.player.stats.maxHp, waveCleared);
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + repairAmount);
    }

    this.shopOpen = true;
    this.waveAnnouncement = `Wave ${waveCleared} cleared! Choose an upgrade or skip.`;
    this.refreshHud();
  }

  private getUpgradePurchaseCost(upgrade: UpgradeDef) {
    const targetWave = Math.max(1, this.shopTargetWave || this.shopWaveCleared || 1);
    return getUpgradeOfferCost({
      baseCost: upgradeCost(upgrade, targetWave),
      crisisCostReduction: getUpgradeCostReduction(this.crisisState.activeEffects),
      sigilCostMult: getShopCostMult(this.sigilState),
      hasFreePurchase: isFreePurchaseWave(this.sigilState),
    });
  }

  private purchaseUpgrade(upgrade: UpgradeDef): void {
    const offerCost = this.getUpgradePurchaseCost(upgrade);
    if (this.endlessCredits < offerCost.cost) return;

    this.endlessCredits -= offerCost.cost;
    if (offerCost.consumesFreePurchase) {
      this.sigilState = consumeFreePurchase(this.sigilState);
    }
    this.upgradeStats = applyUpgrade(this.upgradeStats, upgrade);
    this.purchasedUpgrades.push({ def: upgrade, wavePurchased: this.shopTargetWave });
    this.runStats.upgradesPurchased.push(upgrade.displayName);

    // Rebuild player stats from base + all upgrade bonuses
    this.rebuildPlayerWithUpgrades();
    this.closeUpgradeShop();
  }

  private closeUpgradeShop(): void {
    this.shopOpen = false;
    this.shopOptions = [];
    this.shopMutatorOptions = [];
    this.contractOffers = [];
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
    // Stat mods are applied on-the-fly via effectiveStats — no need to bake into upgradeStats
    this.rebuildPlayerWithUpgrades();
    this.shopMutatorOptions = []; // Remove mutator option after picking
    this.refreshHud(); // Rebuild shop UI so the card disappears and mutator count updates
  }

  /**
   * Rebuild player stats from surviving modules + all bonus layers.
   * Must follow the same modifier chain as the module-breakage path in applyDamage:
   *   base (surviving modules) → crew → upgrades → legacy → mutagen
   */
  private rebuildPlayerWithUpgrades(): void {
    // Reset to base stats from surviving modules (same as module-breakage path)
    const survivingIds = new Set(this.player.moduleStates.filter((m) => !m.destroyed).map((m) => m.instanceId));
    const newRawStats = computeStatsFromSurviving(this.player.blueprint, survivingIds);
    this.player.stats = applyCrewModifiers(newRawStats, this.player.blueprint.crew);

    // Apply accumulated upgrade bonuses (includes mutator stat mods via effectiveStats)
    this.reapplyUpgradeBonuses(this.player);

    // Re-apply legacy bonuses that survive rebuilds (bonus_hp, shield_seed, heat_sink)
    this.reapplyLegacyOnRebuild(this.player);

    // Apply mutagen multipliers (order matches module-breakage path: legacy before mutagen)
    this.reapplyMutagenOnRebuild(this.player);

    // Re-apply sigil modifiers
    this.reapplySigilOnRebuild(this.player);

    // Recalculate power factor
    this.player.powerFactor = computePowerFactor(this.player.stats.powerOutput, this.player.stats.powerDemand);

    // Clamp HP to at least 1 after stat changes so mutator choices don't instantly kill
    this.player.hp = Math.max(1, Math.min(this.player.hp, this.player.stats.maxHp));
    this.player.maxShield = this.player.stats.shieldStrength;
    this.player.shield = Math.min(this.player.shield, this.player.maxShield);
    this.player.hp = Math.min(this.player.hp, this.player.stats.maxHp);
  }

  /** Apply upgrade shop bonuses to a ship's stats (called after every stat rebuild). */
  private reapplyUpgradeBonuses(ship: RuntimeShip): void {
    if (ship.id !== this.player.id) return;
    const s = this.effectiveStats;
    const upgradeStatMult = getUpgradeStatMult(this.crisisState.activeEffects);
    ship.stats.maxHp += Math.round(s.maxHpBonus * upgradeStatMult);
    ship.stats.shieldStrength += Math.round(s.shieldBonus * upgradeStatMult);
    ship.stats.shieldRecharge *= (1 + s.shieldRechargeBonus);
    ship.stats.armorRating += Math.round(s.armorRatingBonus * upgradeStatMult);
    ship.stats.kineticBypass += s.kineticBypassBonus;
    ship.stats.energyVulnerability = Math.max(0, ship.stats.energyVulnerability - s.energyVulnerabilityReduction);
    ship.stats.powerOutput *= (1 + s.powerOutputBonus);
    ship.stats.heatCapacity += Math.round(s.heatCapacityBonus * upgradeStatMult);
    ship.stats.cooling *= (1 + s.coolingBonus);
    ship.stats.thrust *= (1 + s.thrustBonus);
    ship.stats.droneCapacity += s.droneCapacityBonus;
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

  private renderCrewOrderSlot(id: CrewOrderId): string {
    const def = getCrewOrderDef(id);
    const crewPoints = this.player.blueprint.crew[def.role];
    const available = crewPoints > 0;
    const activeRemaining = getActiveRemaining(this.crewOrdersState, id);
    const cooldownRemaining = getCooldownRemaining(this.crewOrdersState, id);
    const duration = getCrewOrderDuration(id, this.player.blueprint.crew);
    const cooldown = getCrewOrderCooldown(id, this.player.blueprint.crew);
    let stateClass = 'ready';
    let fillHtml = '';

    if (!available) {
      stateClass = 'unavailable';
    } else if (activeRemaining > 0) {
      stateClass = 'active';
      fillHtml = `<span class="ability-fill active-fill" style="width:${(activeRemaining / duration) * 100}%"></span>`;
    } else if (cooldownRemaining > 0) {
      stateClass = 'cooldown';
      fillHtml = `<span class="ability-fill cooldown-fill" style="width:${(1 - cooldownRemaining / cooldown) * 100}%"></span>`;
    }

    return `<div class="ability-slot ${stateClass}" title="${def.displayName} [${def.hotkey}] — ${def.description}${available ? ` · crew ${crewPoints}` : ' · assign crew to unlock'}" style="border-color:${available ? `${def.color}55` : 'rgba(148,163,184,0.18)'};${stateClass === 'active' ? `box-shadow:0 0 12px ${def.color}66;background:${def.color}22;` : ''}">
      <span class="ability-key">${def.hotkey}</span>
      <span class="ability-icon">${def.icon}</span>
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

  private updateCrewOrders(dt: number): void {
    this.crewOrdersState = tickCrewOrders(this.crewOrdersState, dt);
    const targetId = getCrewOrderTargetId(this.crewOrdersState);
    if (targetId && !this.ships.some((ship) => ship.id === targetId && ship.alive)) {
      this.crewOrdersState = clearCrewOrderTarget(this.crewOrdersState, targetId);
    }
    this.syncCrewOrderMarker();
  }

  private syncCrewOrderMarker(): void {
    const activeTargetId = getCrewOrderTargetId(this.crewOrdersState);
    const markerColor = this.getCrewOrderMarkerColor();
    let targetShip: RuntimeShip | null = null;

    for (const ship of this.ships) {
      const marker = ship.group.getObjectByName('crew-order-marker');
      if (marker) {
        if (ship.id !== activeTargetId) {
          ship.group.remove(marker);
          if (marker instanceof THREE.Mesh) {
            marker.geometry.dispose();
            if (marker.material instanceof THREE.Material) marker.material.dispose();
          }
        } else {
          targetShip = ship;
        }
      }
    }

    if (!activeTargetId) return;
    targetShip = targetShip ?? this.ships.find((ship) => ship.id === activeTargetId && ship.alive) ?? null;
    if (!targetShip) return;

    const existing = targetShip.group.getObjectByName('crew-order-marker');
    const pulse = 1 + Math.sin(this.elapsedEncounterSeconds * 7) * 0.08;
    if (existing instanceof THREE.Mesh) {
      existing.scale.setScalar(pulse);
      existing.position.y = 0.95 + Math.sin(this.elapsedEncounterSeconds * 9) * 0.05;
      if (existing.material instanceof THREE.MeshBasicMaterial) {
        existing.material.color.set(markerColor);
      }
      return;
    }

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(0.8, targetShip.radius * 0.55), 0.08, 8, 28),
      new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.92 }),
    );
    marker.name = 'crew-order-marker';
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 0.95;
    targetShip.group.add(marker);
  }

  private clearCrewOrderMarkers(): void {
    for (const ship of this.ships) {
      const marker = ship.group.getObjectByName('crew-order-marker');
      if (!marker) continue;
      ship.group.remove(marker);
      if (marker instanceof THREE.Mesh) {
        marker.geometry.dispose();
        if (marker.material instanceof THREE.Material) marker.material.dispose();
      }
    }
  }

  private getCrewOrderMarkerColor(): string {
    if (isOrderActive(this.crewOrdersState, 'gunner_focus')) return '#fb923c';
    if (isOrderActive(this.crewOrdersState, 'tactician_link')) return '#a78bfa';
    return '#f8fafc';
  }

  private getStrongestLivingEnemy(): RuntimeShip | null {
    const livingEnemies = this.ships.filter((candidate) => candidate.team === 'enemy' && candidate.alive);
    if (livingEnemies.length === 0) return null;
    let best = livingEnemies[0];
    let bestScore = -Infinity;
    for (const enemy of livingEnemies) {
      const score = enemy.blueprint.modules.length * 10 + (this.shipAffixes.get(enemy.id)?.length ?? 0) * 18 + (enemy.isBoss ? 35 : 0);
      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
  }

  private resolveNemesisOnPlayerDeath(): void {
    if (!this.isEndlessMode) return;

    if (this.nemesisShip?.alive && this.nemesisState.active) {
      this.nemesisState = recordNemesisVictory(this.nemesisState, this.currentWave);
      persistNemesisState(this.nemesisState);
      this.nemesisAnnouncement = `☠ ${this.nemesisState.active?.callsign ?? 'Nemesis'} escaped and grew stronger.`;
      this.nemesisAnnouncementTimer = 4;
      return;
    }

    if (!this.nemesisState.active && this.currentWave >= 4) {
      const candidate = this.getStrongestLivingEnemy();
      if (!candidate) return;
      this.nemesisState = createNemesisFromCandidate(this.nemesisState, {
        blueprint: candidate.blueprint,
        waveNumber: this.currentWave,
        isBoss: !!candidate.isBoss,
      });
      persistNemesisState(this.nemesisState);
      this.nemesisAnnouncement = `☠ A new rival rises: ${this.nemesisState.active?.callsign ?? candidate.blueprint.name}`;
      this.nemesisAnnouncementTimer = 4;
    }
  }

  private handleNemesisKilled(ship: RuntimeShip): void {
    if (!ship.isNemesis || !this.nemesisState.active) return;
    this.nemesisKillsThisRun += 1;
    const reward = getNemesisReward(this.nemesisState.active.level);
    const fallenName = this.nemesisState.active.callsign;
    this.endlessCredits += reward.credits;
    this.runStats.creditsEarned += reward.credits;
    this.endlessScore += reward.score;
    this.onReward(this.encounterId, { credits: reward.credits, score: this.endlessScore, victory: true });
    this.nemesisState = recordNemesisDefeat(this.nemesisState, this.currentWave);
    persistNemesisState(this.nemesisState);
    this.nemesisShip = null;
    this.nemesisAnnouncement = this.nemesisState.active
      ? `☠ Nemesis broken: ${fallenName}. It will return harder. +${reward.credits} credits`
      : `☠ Nemesis ended: ${fallenName}. Rivalry closed. +${reward.credits} credits`;
    this.nemesisAnnouncementTimer = 4;
  }

  // ── Legacy Codex Methods ──────────────────────────────────

  private legacyComboWindowBonus = 0;
  private legacyAbilityCdMult = 1;
  /** Fixed HP bonus computed at run start, used for consistent rebuilds. */
  private legacyFlatHpBonus = 0;

  private applyLegacyBonuses(): void {
    const effects = getActiveBonusEffects(this.legacyState);
    this.legacyComboWindowBonus = 0;
    this.legacyAbilityCdMult = 1;
    this.legacyFlatHpBonus = 0;
    for (const effect of effects) {
      switch (effect.kind) {
        case 'bonus_hp': {
          const bonus = Math.round(this.player.stats.maxHp * (effect.value / 100));
          this.legacyFlatHpBonus = bonus;
          this.player.hp += bonus;
          this.player.stats.maxHp += bonus;
          for (const mod of this.player.moduleStates) {
            if (!mod.destroyed) mod.maxHp += bonus / Math.max(1, this.player.moduleStates.filter((m) => !m.destroyed).length);
          }
          break;
        }
        case 'bonus_credits':
          this.endlessCredits += effect.value;
          break;
        case 'bonus_shield':
          // Modify stats.shieldStrength so the downstream mutagen
          // application (`maxShield = shieldStrength`) preserves it.
          this.player.stats.shieldStrength += effect.value;
          this.player.maxShield += effect.value;
          this.player.shield += effect.value;
          break;
        case 'heat_capacity':
          this.player.stats.heatCapacity *= (1 + effect.value / 100);
          break;
        case 'dash_cd_reduction':
          this.upgradeStats.dashCooldownReduction += effect.value / 100;
          break;
        case 'combo_window':
          this.legacyComboWindowBonus = effect.value;
          break;
        case 'ability_cd_reduction':
          // Reduce base cooldowns on ability defs so the effect persists
          // across activation cycles instead of only touching the initial
          // cooldownRemaining (which is 0 at run start and thus a no-op).
          this.legacyAbilityCdMult = Math.max(0.5, this.legacyAbilityCdMult * (1 - effect.value / 100));
          for (const ability of this.player.abilities) {
            ability.def = { ...ability.def, cooldown: ability.def.cooldown * (1 - effect.value / 100) };
          }
          break;
        case 'credit_percent':
          // No-op at run start — applied per-wave in wave-clear credit calculation
          break;
      }
    }
  }

  /** Re-apply legacy bonuses that modify stat baselines after module destruction rebuilds. */
  private reapplyLegacyOnRebuild(ship: RuntimeShip): void {
    if (!this.isEndlessMode || ship.id !== this.player.id) return;
    const persistent = getRebuildPersistentEffects(this.legacyState);
    for (const bonus of persistent) {
      switch (bonus.effect.kind) {
        case 'bonus_hp': {
          const bonusHp = Math.round(ship.stats.maxHp * (bonus.effect.value / 100));
          ship.stats.maxHp += bonusHp;
          break;
        }
        case 'bonus_shield': {
          // Modify stats.shieldStrength so that the caller's
          // `ship.maxShield = ship.stats.shieldStrength` preserves the bonus.
          ship.stats.shieldStrength += bonus.effect.value;
          break;
        }
        case 'heat_capacity':
          ship.stats.heatCapacity *= (1 + bonus.effect.value / 100);
          break;
      }
    }
  }

  /** Re-apply mutagen stat multipliers after module rebuilds so they stay coherent. */
  private reapplyMutagenOnRebuild(ship: RuntimeShip): void {
    if (ship.id !== this.player.id) return;
    const crisisMult = getMutagenStatMult(this.crisisState.activeEffects);
    ship.stats.maxHp = Math.round(ship.stats.maxHp * this.mutagenStats.maxHpMultiplier * crisisMult);
    ship.stats.shieldStrength = Math.round(ship.stats.shieldStrength * this.mutagenStats.shieldMultiplier * crisisMult);
    ship.stats.thrust *= this.mutagenStats.thrustMultiplier * crisisMult;
    ship.stats.armorRating += Math.round(this.mutagenStats.armorBonus * crisisMult);
    ship.hp = Math.min(ship.hp, ship.stats.maxHp);
  }

  private finalizeLegacyRun(snapshot: RunSnapshot): void {
    if (this.legacyFinalized || !this.isEndlessMode) return;
    this.legacyFinalized = true;

    const { updated, newMilestones } = finalizeRun(this.legacyState, snapshot);
    this.legacyState = updated;
    this.legacyNewMilestones = newMilestones;
    persistLegacyState(updated);
  }

  // ── Blueprint Scavenging Methods ────────────────────────────

  /**
   * Attempt to salvage the blueprint of a killed enemy ship.
   * Call from all 3 death paths (projectile, beam, hazard).
   * Only elites/bosses can be salvaged in endless mode.
   */
  private handleSalvageOnKill(ship: RuntimeShip): void {
    if (!this.isEndlessMode || ship.team !== 'enemy') return;

    const affixes = this.shipAffixes.get(ship.id);
    const isElite = affixes != null && affixes.length >= 2;
    if (!isElite && !ship.isBoss) return;

    const affixNames = affixes?.map((a) => a.def.displayName) ?? [];
    const comboTier = this.comboState.kills;

    const result = rollSalvage(
      {
        waveNumber: this.currentWave,
        isElite,
        isBoss: !!ship.isBoss,
        comboTier,
        hasCreditBooster: this.legacyState.activeBonuses.includes('credit_booster'),
      },
      ship.blueprint,
      affixNames,
      this.salvageCollection,
      this.salvageRunCount,
      Math.random(),
    );

    this.salvageCollection = recordSalvageAttempt(this.salvageCollection);

    if (result) {
      this.salvageCollection = addSalvageEntry(this.salvageCollection, result.entry);
      this.runSalvagedEntries.push(result.entry);
      persistSalvageCollection(this.salvageCollection);
      this.runStats.blueprintsSalvaged += 1;

      const rc = RARITY_CONFIG[result.entry.rarity];
      const newTag = result.isNew ? ' ✨ NEW' : '';
      this.salvageAnnouncement = `🔧 Blueprint Salvaged: ${rc.label}${newTag}`;
      this.salvageAnnouncementTimer = 4;
      this.screenShake = createScreenShake(0.3, 0.2);
    }
    // Lineage: extract corrupted module from killed enemy
    if (affixes && affixes.length > 0) {
      const lAffixIds = affixes.map((a) => a.def.id);
      const lAffixColors: Record<string, string> = {};
      const lAffixDisplayNames: Record<string, string> = {};
      for (const a of affixes) {
        lAffixColors[a.def.id] = a.def.color;
        lAffixDisplayNames[a.def.id] = a.def.displayName;
      }
      const corrupted = extractCorruptedModule({
        enemyBlueprint: ship.blueprint,
        getModuleDef: getModuleDefinition,
        affixIds: lAffixIds,
        affixColors: lAffixColors,
        affixDisplayNames: lAffixDisplayNames,
        isBoss: !!ship.isBoss,
        waveNumber: this.currentWave,
        rng: Math.random() * 100000,
      });
      if (corrupted) {
        this.lineageLocker = addToLocker(this.lineageLocker, corrupted);
        this.runCorruptedEntries.push(corrupted);
        persistLineageLocker(this.lineageLocker);
        const bossTag = corrupted.wasBoss ? ' 👑 Boss' : '';
        this.lineageAnnouncement = `🧬 ${corrupted.displayName}${bossTag}`;
        this.lineageAnnouncementTimer = 4;
      }
    }
  }

  // ── Wingman Methods ─────────────────────────────────────────

  private clearShipHealthBar(shipId: string): void {
    const existing = this.shipHealthBars.get(shipId);
    if (!existing) return;
    this.healthBarGroup.remove(existing.bg, existing.fg, existing.shieldBg, existing.shieldFg);
    existing.bg.geometry.dispose();
    existing.fg.geometry.dispose();
    existing.shieldBg.geometry.dispose();
    existing.shieldFg.geometry.dispose();
    this.shipHealthBars.delete(shipId);
  }

  private removeOwnedDrones(ownerId: string): void {
    for (let i = this.drones.length - 1; i >= 0; i -= 1) {
      const drone = this.drones[i];
      if (drone.ownerId !== ownerId) continue;
      this.scene.remove(drone.mesh);
      if ('geometry' in drone.mesh && drone.mesh.geometry) {
        (drone.mesh.geometry as THREE.BufferGeometry).dispose();
      }
      if (drone.mesh.material instanceof THREE.Material) {
        drone.mesh.material.dispose();
      }
      this.drones.splice(i, 1);
    }
  }

  private removeWingmanRuntime(): void {
    if (!this.wingmanShip) return;
    this.clearShipHealthBar(this.wingmanShip.id);
    this.removeOwnedDrones(this.wingmanShip.id);
    this.scene.remove(this.wingmanShip.group);
    const idx = this.ships.indexOf(this.wingmanShip);
    if (idx >= 0) this.ships.splice(idx, 1);
    this.wingmanShip = null;
  }

  private spawnWingman(): void {
    if (!this.wingmanState.config || !this.player) return;
    const entry = this.salvageCollection.entries.find(
      (e) => e.id === this.wingmanState.config!.blueprintId,
    );
    if (!entry) return;

    if (this.wingmanShip) this.removeWingmanRuntime();

    const bp = entry.blueprint;
    const spawn = getWingmanSpawnPoint(this.player.position.x, this.player.position.z, this.player.rotation);
    const ship = this.createShip(
      'wingman-1',
      'player',
      bp,
      new THREE.Vector3(spawn.x, 0, spawn.z),
      spawn.rotation,
      12,
      0.15,
    );
    ship.isWingman = true;
    this.ships.push(ship);
    this.spawnDronesForShip(ship);
    this.wingmanShip = ship;
    this.syncShipTransform(ship);
  }

  private updateWingman(dt: number): void {
    if (!this.isEndlessMode || !this.wingmanState.config) return;

    if (!this.wingmanState.active) {
      this.wingmanState = updateWingmanTimers(this.wingmanState, dt);
      if (this.wingmanState.active && !this.wingmanShip) {
        this.spawnWingman();
      }
      return;
    }

    if (!this.wingmanShip || !this.player) return;

    if (!this.wingmanShip.alive || this.wingmanShip.hp <= 0) {
      this.wingmanState = killWingman(this.wingmanState);
      this.wingmanFireTimer = 0;
      this.removeWingmanRuntime();
      return;
    }

    this.wingmanState.hpFraction = this.wingmanShip.hp / Math.max(1, this.wingmanShip.stats.maxHp);
    this.wingmanFireTimer = Math.max(0, this.wingmanFireTimer - dt);
    this.wingmanState.fireTimer = this.wingmanFireTimer;

    const enemies = this.ships
      .filter((s) => s.team === 'enemy' && s.alive)
      .map((s) => ({
        id: s.id,
        x: s.position.x,
        z: s.position.z,
        alive: s.alive,
      }));

    const baseAi = computeWingmanAI({
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      playerRotation: this.player.rotation,
      wingmanX: this.wingmanShip.position.x,
      wingmanZ: this.wingmanShip.position.z,
      wingmanRotation: this.wingmanShip.rotation,
      enemyPositions: enemies,
      wingmanFireInterval: 0.5 / WINGMAN_FIRE_RATE_MULT,
    });
    const commandedTargetId = getCrewOrderTargetId(this.crewOrdersState);
    const commandedTarget = commandedTargetId
      ? this.ships.find((ship) => ship.id === commandedTargetId && ship.alive && ship.team === 'enemy') ?? null
      : null;
    const ai = commandedTarget
      ? {
          ...baseAi,
          moveX: commandedTarget.position.x,
          moveZ: commandedTarget.position.z,
          targetRotation: Math.atan2(
            commandedTarget.position.x - this.wingmanShip.position.x,
            commandedTarget.position.z - this.wingmanShip.position.z,
          ),
          shouldFire: commandedTarget.position.distanceTo(this.wingmanShip.position) < 18,
          targetId: commandedTarget.id,
        }
      : baseAi;

    const dx = ai.moveX - this.wingmanShip.position.x;
    const dz = ai.moveZ - this.wingmanShip.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      const step = Math.min(8 * dt, dist);
      const moveX = (dx / dist) * step;
      const moveZ = (dz / dist) * step;
      this.wingmanShip.position.x += moveX;
      this.wingmanShip.position.z += moveZ;
      this.wingmanShip.velocity.set(moveX / Math.max(dt, 0.001), 0, moveZ / Math.max(dt, 0.001));
    } else {
      this.wingmanShip.velocity.set(0, 0, 0);
    }

    this.wingmanShip.rotation = lerpAngle(
      this.wingmanShip.rotation,
      ai.targetRotation,
      Math.min(1, dt * 5),
    );

    if (ai.shouldFire && ai.targetId && this.wingmanFireTimer <= 0) {
      this.wingmanFireTimer = 0.5 / WINGMAN_FIRE_RATE_MULT;
      const target = this.ships.find((s) => s.id === ai.targetId);
      if (target && target.alive && this.wingmanShip) {
        const dir = new THREE.Vector3()
          .subVectors(target.position, this.wingmanShip.position)
          .normalize();
        this.tryFire(this.wingmanShip, dir);
      }
    }

    this.wingmanState.fireTimer = this.wingmanFireTimer;
    this.wingmanState.targetId = ai.targetId;
    this.syncShipTransform(this.wingmanShip);
  }

  private buildLegacySnapshot(grade: { letter: string }): RunSnapshot {
    return {
      waveReached: this.endlessBestWave || (this.currentWave - 1),
      totalKills: this.endlessTotalKills,
      eliteKills: this.runStats.eliteKills,
      bossKills: this.runStats.bossKills,
      score: this.endlessScore,
      creditsEarned: this.runStats.creditsEarned,
      timeSeconds: this.elapsedEncounterSeconds,
      bestCombo: this.runStats.bestCombo,
      highestComboTier: this.runStats.highestComboTier,
      damageDealt: this.runStats.damageDealt,
      damageTaken: this.runStats.damageTaken,
      pickupsCollected: this.runStats.pickupsCollected,
      hpRemaining: Math.max(0, this.player.hp),
      maxHp: this.player.stats.maxHp,
      mutatorsChosen: this.runStats.mutatorsChosen,
      upgradesPurchased: this.runStats.upgradesPurchased,
      overdriveActivations: this.runStats.overdriveActivations,
      dashCount: this.runStats.dashCount,
      abilityActivations: this.runStats.abilityActivations,
      blueprintsSalvaged: this.runStats.blueprintsSalvaged,
      nearMissTotal: this.nearMissState.total,
      nearMissBestStreak: this.nearMissState.bestStreak,
      grade: grade.letter,
      sigilId: this.sigilState.activeId ?? undefined,
      sigilTier: this.sigilState.activeId ? this.sigilState.currentTier : undefined,
    };
  }

  // ── Arena Rift Visuals ──────────────────────────────────────

  private setupRiftVisuals(state: ArenaRiftState): void {
    this.clearRiftVisuals();
    if (state.kind === 'void_collapse') {
      const geo = new THREE.RingGeometry(0.9 * state.currentRadius, state.currentRadius, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(getRiftDef('void_collapse').color),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      this.riftRingMesh = new THREE.Mesh(geo, mat);
      this.riftRingMesh.rotation.x = -Math.PI / 2;
      this.riftRingMesh.position.y = 0.1;
      this.scene.add(this.riftRingMesh);
    } else if (state.kind === 'gravity_well') {
      const geo = new THREE.SphereGeometry(0.8, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(getRiftDef('gravity_well').color),
        transparent: true,
        opacity: 0.7,
      });
      this.riftWellMesh = new THREE.Mesh(geo, mat);
      this.riftWellMesh.position.set(state.wellX, 0.5, state.wellZ);
      this.scene.add(this.riftWellMesh);
    }
  }

  private clearRiftVisuals(): void {
    if (this.riftRingMesh) {
      this.scene.remove(this.riftRingMesh);
      this.riftRingMesh.geometry.dispose();
      (this.riftRingMesh.material as THREE.Material).dispose();
      this.riftRingMesh = null;
    }
    if (this.riftWellMesh) {
      this.scene.remove(this.riftWellMesh);
      this.riftWellMesh.geometry.dispose();
      (this.riftWellMesh.material as THREE.Material).dispose();
      this.riftWellMesh = null;
    }
    this.empFlashTimer = 0;
  }

  private updateRiftVisuals(state: ArenaRiftState, dt: number): void {
    // Void collapse: resize the ring
    if (state.kind === 'void_collapse' && this.riftRingMesh) {
      const r = state.currentRadius;
      this.riftRingMesh.geometry.dispose();
      this.riftRingMesh.geometry = new THREE.RingGeometry(0.9 * r, r, 64);
      // Pulse opacity
      const mat = this.riftRingMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(state.elapsed * 3) * 0.15;
    }

    // Gravity well: move with orbit
    if (state.kind === 'gravity_well' && this.riftWellMesh) {
      this.riftWellMesh.position.set(state.wellX, 0.5, state.wellZ);
      const mat = this.riftWellMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(state.elapsed * 4) * 0.2;
    }

    // EMP flash timer
    if (this.empFlashTimer > 0) {
      this.empFlashTimer -= dt;
    }
  }

  // ── Arena Rift Game Logic ───────────────────────────────────

  /** Call once per frame in the main update loop. */
  private updateArenaRift(dt: number): void {
    if (!this.arenaRift) return;
    const prev = this.arenaRift.rift;
    const updated = updateRift(prev, dt);
    this.arenaRift.rift = updated;
    this.updateRiftVisuals(updated, dt);

    // EMP: detect pulse transition for visual flash
    if (updated.kind === 'emp_storm' && updated.shieldsDisabled && prev.kind === 'emp_storm' && !prev.shieldsDisabled) {
      this.empFlashTimer = 0.3;
      playRiftEmpPulse();
    }

    // Void collapse: damage ships outside safe zone
    if (updated.kind === 'void_collapse') {
      this.applyVoidCollapseDamage(updated);
    }

    // Gravity well: apply force to all ships
    if (updated.kind === 'gravity_well') {
      this.applyRiftGravityForces(updated, dt);
    }

    // Shockwave: detect burst + apply force at wave front
    if (updated.kind === 'shockwave') {
      if (updated.waveActive && prev.kind === 'shockwave' && !prev.waveActive) {
        playRiftShockwaveBurst();
      }
      this.applyRiftShockwaveForces(updated, dt);
    }
  }

  private applyVoidCollapseDamage(state: VoidCollapseState): void {
    for (const ship of this.ships) {
      if (ship.alive && isOutsideVoidCollapse(state, ship.position.x, ship.position.z)) {
        this.applyDamage(ship, state.edgeDps / 60, 'energy', 0, 0);
      }
    }
  }

  private applyRiftGravityForces(state: GravityWellState, dt: number): void {
    for (const ship of this.ships) {
      const force = getRiftGravityForce(state, ship.position.x, ship.position.z);
      if (force) {
        ship.position.x += force.fx * dt;
        ship.position.z += force.fz * dt;
        ship.velocity.x += force.fx * dt * 0.3;
        ship.velocity.z += force.fz * dt * 0.3;
      }
    }
    // Deflect projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      const px = proj.mesh.position.x;
      const pz = proj.mesh.position.z;
      const force = getRiftGravityForce(state, px, pz);
      if (force) {
        proj.velocity.x += force.fx * dt * 2;
        proj.velocity.z += force.fz * dt * 2;
      }
    }
  }

  private applyRiftShockwaveForces(state: ShockwaveState, dt: number): void {
    if (!state.waveActive) return;
    for (const ship of this.ships) {
      const force = getRiftShockwaveForce(state, ship.position.x, ship.position.z);
      if (force) {
        ship.velocity.x += force.fx * dt;
        ship.velocity.z += force.fz * dt;
        ship.position.x += force.fx * dt * 0.5;
        ship.position.z += force.fz * dt * 0.5;
      }
    }
    // Push projectiles outward
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      const px = proj.mesh.position.x;
      const pz = proj.mesh.position.z;
      const force = getRiftShockwaveForce(state, px, pz);
      if (force) {
        proj.velocity.x += force.fx * dt * 1.5;
        proj.velocity.z += force.fz * dt * 1.5;
      }
    }
  }

  // ── Sigil Methods ─────────────────────────────────────────

  /** Dynamic damage multiplier accounting for Blood Oath tier 3 streak bonus. */
  private getSigilColor(): string {
    if (!this.sigilState.activeId) return '#e2e8f0';
    const def = getSigilDef(this.sigilState.activeId);
    return def?.color ?? '#e2e8f0';
  }

  private getEffectiveSigilDamageMult(): number {
    if (!this.sigilState.activeId) return 1;
    const fx = this.sigilEffects;
    let mult = fx.damageMult;
    if (fx.damageAtStreakPct > 0 && this.sigilState.killStreak >= fx.healStreakCap) {
      mult *= (1 + fx.damageAtStreakPct / 100);
    }
    return mult;
  }

  /** Apply sigil trade-off stat modifiers to the player at run start. */
  private applySigilTradeOffs(): void {
    const fx = this.sigilEffects;
    if (fx.hpMult !== 1) {
      this.player.stats.maxHp = Math.round(this.player.stats.maxHp * fx.hpMult);
      this.player.hp = Math.round(this.player.hp * fx.hpMult);
      this.player.maxShield = Math.round(this.player.maxShield * fx.hpMult);
      this.player.shield = Math.round(this.player.shield * fx.hpMult);
    }
    if (fx.armorBonus !== 0) {
      this.player.stats.armorRating += fx.armorBonus;
    }
    if (fx.thrustMult !== 1) {
      this.player.stats.thrust *= fx.thrustMult;
    }
  }

  /** Re-apply sigil stat modifiers after module rebuilds. */
  private reapplySigilOnRebuild(ship: RuntimeShip): void {
    if (ship.id !== this.player.id) return;
    const fx = this.sigilEffects;
    if (fx.hpMult !== 1) ship.stats.maxHp = Math.round(ship.stats.maxHp * fx.hpMult);
    if (fx.armorBonus !== 0) ship.stats.armorRating += fx.armorBonus;
    if (fx.thrustMult !== 1) ship.stats.thrust *= fx.thrustMult;
  }

  private renderRiftHud(): string {
    if (!this.arenaRift) return '';
    const rift = this.arenaRift.rift;
    const def = getRiftDef(getRiftType(rift));
    const color = def.color;
    let detail = '';
    switch (rift.kind) {
      case 'void_collapse':
        detail = `Radius: ${rift.currentRadius.toFixed(1)}`;
        break;
      case 'gravity_well':
        detail = `Active`;
        break;
      case 'emp_storm': {
        const cd = getEmpCountdown(rift);
        if (rift.shieldsDisabled) {
          detail = `⚡ SHIELDS DOWN ${Math.abs(cd ?? 0).toFixed(1)}s`;
        } else {
          detail = `Pulse in ${(cd ?? 0).toFixed(1)}s`;
        }
        break;
      }
      case 'shockwave':
        detail = rift.waveActive ? `Expanding ${rift.currentWaveRadius.toFixed(0)}m` : `Next in ${(rift.waveInterval - rift.timeSinceLastWave).toFixed(1)}s`;
        break;
    }
    return `<div><span style="color:${color}">${def.icon} ${def.displayName}</span><strong style="color:${color}">${detail}</strong></div>`;
  }

  /** Override arena clamp radius when void collapse is active. */
  private getEffectiveArenaRadius(): number {
    return getRiftArenaRadius(this.arenaRift?.rift ?? null);
  }
}

function getProjectileColor(team: 'player' | 'enemy', archetype: WeaponProfile['archetype']): string {
  if (archetype === 'missile') return team === 'player' ? '#fdba74' : '#fb7185';
  if (archetype === 'laser') return team === 'player' ? '#7dd3fc' : '#f9a8d4';
  if (archetype === 'beam') return team === 'player' ? '#5eead4' : '#fca5a5';
  return team === 'player' ? '#fde68a' : '#fecaca';
}
