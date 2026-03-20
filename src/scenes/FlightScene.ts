import * as THREE from 'three';
import { lerpAngle } from '../core/hex';
import type { ShipBlueprint, ShipStats } from '../core/types';
import { applyCrewModifiers, DEFAULT_CREW_ALLOCATION } from '../game/crew';
import { ENCOUNTER_PRESETS, getEncounterPreset, type EncounterWave } from '../game/encounters';
import { buildShipGroup, computeBlueprintRadius } from '../rendering/shipFactory';
import { cloneBlueprint, computeShipStats, createExampleBlueprint } from '../state/shipBlueprint';
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
import { advanceEffect, createBeamEffect, createExplosionEffect, createImpactEffect, type CombatEffectState } from '../game/effects';
import {
  advanceEncounterState,
  computeCoolingPerSecond,
  computePowerFactor,
  getEffectiveThrust,
  getEffectiveWeaponCadence,
  isOverheated,
  type EncounterState,
} from '../game/simulation';

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
  weapons: WeaponProfile[];
  weaponIndex: number;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  hp: number;
  heat: number;
  cooldown: number;
  radius: number;
  preferredRange: number;
  fireJitter: number;
  alive: boolean;
  powerFactor: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  ttl: number;
  team: 'player' | 'enemy';
  archetype: WeaponProfile['archetype'];
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
  private readonly ships: RuntimeShip[] = [];
  private readonly drones: RuntimeDrone[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly effects: RuntimeEffect[] = [];
  private readonly keys = new Set<string>();
  private readonly waves: EncounterWave[];

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

  private readonly onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onPointerMove = (event: PointerEvent) => this.updateMouseWorld(event);
  private readonly onPointerDown = (event: PointerEvent) => {
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
    const preset = getEncounterPreset(encounterId) ?? ENCOUNTER_PRESETS[0];
    this.waves = preset?.waves ?? [];
    this.encounterObjective = preset?.objective ?? { type: 'eliminate_all', label: 'Destroy all hostile ships' };

    this.camera.position.set(0, 20, 0.001);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = new THREE.Color('#020617');

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const rim = new THREE.DirectionalLight(0xbfe1ff, 1.1);
    rim.position.set(8, 10, 6);
    this.scene.add(ambient, rim, this.arenaGroup, this.projectileGroup, this.effectGroup);

    this.buildArena();
    this.buildProjectiles();
    this.buildUi();
    this.spawnEncounter(cloneBlueprint(blueprint));
    this.attachEvents();
  }

  update(dt: number): void {
    this.elapsedEncounterSeconds += dt;
    this.updateWaveDelay(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateDrones(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.coolShips(dt);
    this.updateEncounterState();
    this.refreshHud();
    this.renderer.render(this.scene, this.camera);
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
        <div class="toolbar-row">
          <button class="primary" data-action="return-editor">Return to Editor</button>
          <button data-action="reset">Reset Encounter</button>
        </div>
      </div>
      <div class="overlay bottom-right panel compact-panel">
        <strong>Controls</strong>
        <ul>
          <li>W/S: thrust forward or reverse</li>
          <li>A/D: strafe and orbit</li>
          <li>Mouse: aim ship</li>
          <li>Hold left click: fire</li>
          <li>Heat and power now affect performance</li>
        </ul>
      </div>
    `;

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
    for (const projectile of this.projectiles) {
      this.deactivateProjectile(projectile);
    }

    this.currentWave = 1;
    this.encounterOutcome = 'continue';
    this.waveDelay = 0;
    this.waveAnnouncement = 'Wave 1 engaged';
    this.hasGrantedReward = false;
    this.elapsedEncounterSeconds = 0;

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
    const wave = this.waves[waveNumber - 1];
    if (!wave) return;
    this.waveAnnouncement = `${wave.name} deployed`;
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
    const group = buildShipGroup(blueprint);
    group.position.copy(position);
    group.rotation.y = rotation;
    this.scene.add(group);
    const stats = applyCrewModifiers(computeShipStats(blueprint), blueprint.crew);
    const weapons = buildWeaponLoadout(blueprint);
    const powerFactor = computePowerFactor(stats.powerOutput, stats.powerDemand);
    return {
      id,
      team,
      blueprint,
      stats,
      protectedTarget,
      weapons,
      weaponIndex: 0,
      group,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation,
      hp: Math.max(stats.maxHp, 60),
      heat: 0,
      cooldown: 0,
      radius: computeBlueprintRadius(blueprint),
      preferredRange,
      fireJitter,
      alive: true,
      powerFactor,
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
    );

    const acceleration = forward
      .multiplyScalar(forwardInput * effectiveThrust)
      .add(right.multiplyScalar(strafeInput * effectiveThrust * 0.75));
    this.player.velocity.addScaledVector(acceleration, dt);
    this.player.velocity.multiplyScalar(0.985);
    this.player.position.addScaledVector(this.player.velocity, dt);
    this.clampToArena(this.player.position);

    if (this.fireHeld) {
      this.tryFire(this.player, this.mouseWorld.clone().sub(this.player.position).normalize());
    }

    this.syncShipTransform(this.player);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.ships.filter((ship) => ship.team === 'enemy' && ship.alive)) {
      const toPlayer = this.player.position.clone().sub(enemy.position);
      const distance = toPlayer.length();
      const direction = toPlayer.normalize();
      const side = new THREE.Vector3(-direction.z, 0, direction.x);
      const targetRotation = Math.atan2(this.player.position.x - enemy.position.x, this.player.position.z - enemy.position.z);
      enemy.rotation = lerpAngle(enemy.rotation, targetRotation, Math.min(1, dt * 4));

      const rangeError = distance - enemy.preferredRange;
      const advance = THREE.MathUtils.clamp(rangeError * 0.6, -3, 3);
      const drift = Math.sin(performance.now() * 0.001 + enemy.fireJitter * 10) * 1.8;
      const effectiveThrust = getEffectiveThrust(
        Math.max(3.5, enemy.stats.thrust / 80),
        enemy.powerFactor,
        enemy.heat,
        enemy.stats.heatCapacity,
      );

      enemy.velocity.addScaledVector(direction, advance * effectiveThrust * dt * 0.35);
      enemy.velocity.addScaledVector(side, drift * dt * 0.8);
      enemy.velocity.multiplyScalar(0.982);
      enemy.position.addScaledVector(enemy.velocity, dt);
      this.clampToArena(enemy.position);

      if (distance <= Math.max(enemy.stats.weaponRange / 32, enemy.preferredRange + 4)) {
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * enemy.fireJitter,
          0,
          (Math.random() - 0.5) * enemy.fireJitter,
        );
        this.tryFire(enemy, this.player.position.clone().add(jitter).sub(enemy.position).normalize());
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

    const effectiveCadence = getEffectiveWeaponCadence(
      Math.max(1 / Math.max(weapon.cooldown, 0.05), 0.25),
      ship.powerFactor,
      ship.heat,
      ship.stats.heatCapacity,
    );
    if (effectiveCadence <= 0.05) return;

    const normalizedDirection = direction.clone().normalize();
    const damage = Math.max(4, weapon.damage * ship.powerFactor);

    if (weapon.archetype === 'beam') {
      this.fireBeam(ship, normalizedDirection, weapon, damage);
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
    projectile.ttl = weapon.archetype === 'missile' ? 3.8 : 2.2;
    projectile.turnRate = weapon.archetype === 'missile' ? 2.8 : 0;
    projectile.target = weapon.archetype === 'missile' ? this.findNearestEnemy(ship) : null;
    projectile.velocity.copy(spreadDirection.multiplyScalar(Math.max(weapon.projectileSpeed, 8)));
    projectile.mesh.visible = true;
    projectile.mesh.position.copy(computeProjectileSpawnPosition(ship.position, spreadDirection, ship.radius));
    projectile.mesh.scale.setScalar(weapon.archetype === 'missile' ? 1.5 : weapon.archetype === 'laser' ? 0.9 : 1.1);
    (projectile.mesh.material as THREE.MeshBasicMaterial).color.set(getProjectileColor(ship.team, weapon.archetype));

    ship.cooldown = 1 / effectiveCadence;
    ship.heat = Math.min(ship.stats.heatCapacity * 1.4, ship.heat + weapon.heat);
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
          this.applyDamage(ship, projectile.damage);
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
          this.applyDamage(victim, drone.state.damage * 0.35);
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
      this.applyDamage(bestTarget, damage * 0.85);
      this.spawnBeamVisual(ship.position, bestTarget.position, ship.team);
      this.spawnImpactVisual(bestTarget.position, ship.team === 'player' ? '#5eead4' : '#fca5a5');
      this.waveAnnouncement = `${ship.team === 'player' ? 'Beam strike' : 'Enemy beam'} connected`;
    }
  }

  private applyDamage(ship: RuntimeShip, damage: number): void {
    ship.hp -= damage;
    ship.heat = Math.min(ship.stats.heatCapacity * 1.25, ship.heat + damage * 0.08);
    this.spawnImpactVisual(ship.position, ship.team === 'player' ? '#f59e0b' : '#fb7185');
    if (ship.hp <= 0) {
      ship.alive = false;
      ship.group.visible = false;
      this.spawnExplosionVisual(ship.position, ship.team === 'player' ? '#fca5a5' : '#fb7185');
    }
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
    }
  }

  private updateEncounterState(): void {
    const remainingEnemies = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive).length;
    const protectedAlive = this.ships.every((ship) => !ship.protectedTarget || ship.alive);

    if (this.encounterObjective.type === 'survive' || this.encounterObjective.type === 'protect_ally') {
      this.encounterOutcome = evaluateObjective(this.encounterObjective, {
        elapsedSeconds: this.elapsedEncounterSeconds,
        remainingEnemies,
        playerAlive: this.player.alive,
        protectedAlive,
      });

      if (this.encounterOutcome === 'victory') {
        this.waveAnnouncement = this.encounterObjective.type === 'survive'
          ? 'Survival objective complete'
          : 'Convoy secured';
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
      } else {
        this.waveAnnouncement = `${this.encounterObjective.label} · hostiles remaining ${remainingEnemies}`;
      }
      return;
    }

    const state: EncounterState = {
      currentWave: this.currentWave,
      totalWaves: this.waves.length,
      remainingEnemies,
      playerAlive: this.player.alive,
    };
    const progress = advanceEncounterState(state);
    this.encounterOutcome = progress.outcome;

    if (progress.shouldSpawnWave && this.waveDelay <= 0) {
      this.currentWave = progress.nextWave;
      this.waveDelay = WAVE_RESPAWN_DELAY;
      this.waveAnnouncement = `Wave ${this.currentWave} incoming...`;
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
      this.waveAnnouncement = 'Player ship disabled';
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

  private clampToArena(position: THREE.Vector3): void {
    if (position.length() <= ARENA_RADIUS - 1) return;
    position.setLength(ARENA_RADIUS - 1);
  }

  private refreshHud(): void {
    const hud = this.uiRoot.querySelector('#flight-hud');
    if (!hud) return;
    const enemiesAlive = this.ships.filter((ship) => ship.team === 'enemy' && ship.alive).length;
    const hpRatio = Math.max(0, this.player.hp) / Math.max(1, this.player.stats.maxHp);
    const heatRatio = this.player.heat / Math.max(1, this.player.stats.heatCapacity * 1.15);
    const overheatState = isOverheated(this.player.heat, this.player.stats.heatCapacity * 1.02);
    const crewSummary = Object.entries(this.player.blueprint.crew)
      .map(([role, value]) => `${role[0].toUpperCase()}:${value}`)
      .join(' ');
    const activeDrones = this.drones.filter((drone) => drone.state.team === 'player' && drone.state.active).length;
    const totalDrones = this.player.stats.droneCapacity;

    hud.innerHTML = `
      <div class="hud-grid">
        <div><span>Ship</span><strong>${this.player.blueprint.name}</strong></div>
        <div><span>Wave</span><strong>${this.currentWave} / ${this.waves.length}</strong></div>
        <div><span>Hull</span><strong>${Math.max(0, this.player.hp).toFixed(0)} / ${this.player.stats.maxHp.toFixed(0)}</strong></div>
        <div><span>Heat</span><strong>${this.player.heat.toFixed(0)} / ${this.player.stats.heatCapacity.toFixed(0)}</strong></div>
        <div><span>Power</span><strong>${this.player.powerFactor.toFixed(2)}x</strong></div>
        <div><span>Velocity</span><strong>${this.player.velocity.length().toFixed(1)}</strong></div>
        <div><span>Enemies</span><strong>${enemiesAlive}</strong></div>
        <div><span>Status</span><strong>${overheatState ? 'Overheated' : 'Nominal'}</strong></div>
        <div><span>Drones</span><strong>${activeDrones} / ${totalDrones}</strong></div>
      </div>
      <p class="muted">Crew ${crewSummary}</p>
      <div class="meter"><span style="width:${hpRatio * 100}%"></span></div>
      <div class="meter heat"><span style="width:${Math.min(100, heatRatio * 100)}%"></span></div>
      <p class="muted">${this.waveAnnouncement}</p>
      ${!this.player.alive ? '<p class="warning">Your ship is disabled. Reset or return to the editor.</p>' : ''}
      ${this.encounterOutcome === 'victory' ? '<p class="success">Encounter cleared. Return to the editor or reset for another run.</p>' : ''}
    `;
  }

  private updateMouseWorld(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.mouseWorld);
  }
}

function getProjectileColor(team: 'player' | 'enemy', archetype: WeaponProfile['archetype']): string {
  if (archetype === 'missile') return team === 'player' ? '#fdba74' : '#fb7185';
  if (archetype === 'laser') return team === 'player' ? '#7dd3fc' : '#f9a8d4';
  if (archetype === 'beam') return team === 'player' ? '#5eead4' : '#fca5a5';
  return team === 'player' ? '#fde68a' : '#fecaca';
}

function createWaveConfigs(): EncounterWave[] {
  const waveOneEnemy = createExampleBlueprint();
  waveOneEnemy.name = 'Red Aggressor';
  waveOneEnemy.modules = waveOneEnemy.modules.map((module, index) =>
    index === waveOneEnemy.modules.length - 1 ? { ...module, definitionId: 'core:cannon_kinetic' } : module,
  );

  const missileEnemy = createExampleBlueprint();
  missileEnemy.name = 'Missile Hunter';
  missileEnemy.modules = missileEnemy.modules.map((module, index) =>
    index === missileEnemy.modules.length - 1 ? { ...module, definitionId: 'core:missile_launcher' } : module,
  );

  const frigateEnemy: ShipBlueprint = {
    name: 'Frigate Spearhead',
    crew: { ...DEFAULT_CREW_ALLOCATION, gunner: 2, tactician: 2 },
    modules: [
      { instanceId: 'bridge-f', definitionId: 'core:bridge_frigate', position: { q: 0, r: 0 }, rotation: 0 },
      { instanceId: 'reactor-f1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
      { instanceId: 'hull-f1', definitionId: 'core:hull_2x1', position: { q: -1, r: 0 }, rotation: 0 },
      { instanceId: 'engine-f1', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
      { instanceId: 'engine-f2', definitionId: 'core:thruster_lateral', position: { q: -2, r: 1 }, rotation: 0 },
      { instanceId: 'weapon-f1', definitionId: 'core:missile_launcher', position: { q: 0, r: -2 }, rotation: 0 },
      { instanceId: 'weapon-f2', definitionId: 'core:laser_light', position: { q: -1, r: -1 }, rotation: 0 },
    ],
  };

  return [
    {
      name: 'Wave 1',
      enemies: [
        { id: 'enemy-1', blueprint: waveOneEnemy, position: new THREE.Vector3(-8, 0, -8), rotation: 0.3, preferredRange: 9, fireJitter: 0.35 },
        { id: 'enemy-2', blueprint: missileEnemy, position: new THREE.Vector3(8, 0, -10), rotation: -0.2, preferredRange: 11, fireJitter: 0.55 },
      ],
    },
    {
      name: 'Wave 2',
      enemies: [
        { id: 'enemy-3', blueprint: waveOneEnemy, position: new THREE.Vector3(-11, 0, -6), rotation: 0.1, preferredRange: 8, fireJitter: 0.3 },
        { id: 'enemy-4', blueprint: waveOneEnemy, position: new THREE.Vector3(0, 0, -12), rotation: 0.0, preferredRange: 8.5, fireJitter: 0.25 },
        { id: 'enemy-5', blueprint: missileEnemy, position: new THREE.Vector3(11, 0, -6), rotation: -0.1, preferredRange: 12, fireJitter: 0.5 },
      ],
    },
    {
      name: 'Wave 3',
      enemies: [
        { id: 'enemy-6', blueprint: frigateEnemy, position: new THREE.Vector3(0, 0, -12), rotation: 0.0, preferredRange: 10, fireJitter: 0.3 },
        { id: 'enemy-7', blueprint: missileEnemy, position: new THREE.Vector3(-10, 0, -11), rotation: 0.2, preferredRange: 12, fireJitter: 0.55 },
      ],
    },
  ];
}
