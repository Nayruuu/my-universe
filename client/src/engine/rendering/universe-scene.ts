import * as THREE from 'three';
import {
  type ConstellationCatalog,
  GraphicQuality,
  type SpaceObject,
  type StarClusterTile,
  type Vector3Like,
} from '../../data/models/universe.models';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';
import type { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import { getNavigationScaleForLod } from '../camera/navigation-scales';
import { calculateMilkyWayTransition } from '../lod/milky-way-transition';
import type { ConstellationBatch as ConstellationBatchInstance } from './constellation-batch';
import type { CosmicGroupCatalogBatch as CosmicGroupCatalogBatchInstance } from './cosmic-group-catalog-batch';
import { CosmicBackground } from './cosmic-background';
import {
  calculateGalactocentricSpiralAngle,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_ARM_REFERENCE_RADIUS,
} from './milky-way-density-model';
import { MilkyWayVolume, type MilkyWayAtlasStatus } from './milky-way-volume';
import { getPhotographicProfile } from './photographic-profile';
import type { StarCatalogBatch as StarCatalogBatchInstance } from './star-catalog-batch';
import type { StarClusterBatch as StarClusterBatchInstance } from './star-cluster-batch';

export class UniverseScene {
  public readonly scene = new THREE.Scene();
  public readonly spaceRoot = new THREE.Group();

  private readonly backdropGeometry: THREE.BufferGeometry;
  private readonly backdropMaterial: THREE.PointsMaterial;
  private readonly milkyWayGeometry: THREE.BufferGeometry;
  private readonly milkyWayMaterial: THREE.PointsMaterial;
  private readonly backdrop: THREE.Points;
  private readonly milkyWay: THREE.Points;
  private readonly stellarNeighborhoodRoot = new THREE.Group();
  private readonly cosmicBackground = new CosmicBackground();
  private readonly milkyWayVolume = new MilkyWayVolume();
  private starCatalogBatch: StarCatalogBatchInstance | null = null;
  private starClusterBatch: StarClusterBatchInstance | null = null;
  private constellationBatch: ConstellationBatchInstance | null = null;
  private cosmicGroupCatalogBatch: CosmicGroupCatalogBatchInstance | null = null;
  private quality: GraphicQuality = 'medium';
  private milkyWayScale = 1;
  private stellarNeighborhoodScale = 1;

  constructor(private readonly performanceManager: PerformanceManager) {
    this.scene.background = new THREE.Color(0x010208);
    this.scene.fog = new THREE.FogExp2(0x02030a, 0.000_045);
    this.scene.add(this.cosmicBackground.mesh);
    this.spaceRoot.name = 'floating-space-root';
    this.scene.add(this.spaceRoot);
    this.stellarNeighborhoodRoot.name = 'solar-neighborhood-reference';
    this.stellarNeighborhoodRoot.userData['referenceFrame'] = 'galactocentric-visual';
    this.stellarNeighborhoodRoot.userData['scientificConfidence'] = 'calculated';
    this.stellarNeighborhoodRoot.userData['visualScale'] = 'adaptive-heliocentric-neighborhood';
    this.spaceRoot.add(this.stellarNeighborhoodRoot);
    this.spaceRoot.add(this.milkyWayVolume.root);

    this.scene.add(new THREE.AmbientLight(0x5b6b8f, 0.12));

    this.backdropGeometry = createBackdropGeometry(10_000);
    this.backdropMaterial = new THREE.PointsMaterial({
      color: 0xdce8ff,
      size: 1.3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      fog: false,
    });
    this.backdrop = new THREE.Points(this.backdropGeometry, this.backdropMaterial);
    this.backdrop.name = 'distant-star-field';
    this.backdrop.userData['scientificConfidence'] = 'procedural';
    this.backdrop.userData['visualRole'] = 'decorative';
    this.spaceRoot.add(this.backdrop);

    this.milkyWayGeometry = createMilkyWayGeometry(10_000);
    this.milkyWayMaterial = new THREE.PointsMaterial({
      size: 1.65,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this.milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
    this.milkyWay.name = 'illustrative-milky-way';
    this.milkyWay.visible = false;
    this.milkyWay.userData['scientificConfidence'] = 'illustrative';
    this.milkyWay.userData['visualStructure'] = 'illustrative-galactocentric-four-arm-disk';
    this.milkyWay.userData['structureOrigin'] = 'galactic-center';
    this.milkyWay.userData['spiralArmCount'] = MILKY_WAY_ARM_COUNT;
    this.milkyWay.userData['spiralPitchDegrees'] = MILKY_WAY_ARM_PITCH_DEGREES;
    this.milkyWay.userData['visualRole'] = 'galactic-scale-transition';
    this.spaceRoot.add(this.milkyWay);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const count = this.performanceManager.getParticleCount(quality);

    this.backdropGeometry.setDrawRange(0, Math.min(count, 10_000));
    this.milkyWayGeometry.setDrawRange(0, Math.min(count, 10_000));
    this.setPixelRatio(this.performanceManager.getPixelRatio(quality));
    this.cosmicBackground.setQuality(quality);
    this.milkyWayVolume.setQuality(quality);
    this.starClusterBatch?.setQuality(quality);
  }

  public get milkyWayAtlasStatus(): MilkyWayAtlasStatus {
    return this.milkyWayVolume.atlasStatus;
  }

  public get milkyWayVolumeDrawMeshCount(): number {
    return this.milkyWayVolume.drawMeshCount;
  }

  public ensureMilkyWayAtlas(): Promise<boolean> {
    return this.milkyWayVolume.ensureAtlas();
  }

  public setPixelRatio(pixelRatio: number): void {
    this.starCatalogBatch?.setPixelRatio(pixelRatio);
    this.starClusterBatch?.setPixelRatio(pixelRatio);
    this.cosmicGroupCatalogBatch?.setPixelRatio(pixelRatio);
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.stellarNeighborhoodRoot.position.set(position.x, position.y, position.z);
  }

  public async setCosmicGroupCatalog(registry: CosmicGroupCatalogRegistry): Promise<void> {
    if (this.cosmicGroupCatalogBatch) {
      this.spaceRoot.remove(this.cosmicGroupCatalogBatch.root);
      this.cosmicGroupCatalogBatch.dispose();
    }

    const { CosmicGroupCatalogBatch } = await import('./cosmic-group-catalog-batch');

    this.cosmicGroupCatalogBatch = new CosmicGroupCatalogBatch(registry);
    this.spaceRoot.add(this.cosmicGroupCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public async setStarCatalog(registry: StarCatalogRegistry): Promise<void> {
    if (this.starClusterBatch) {
      this.stellarNeighborhoodRoot.remove(this.starClusterBatch.root);
      this.starClusterBatch.dispose();
      this.starClusterBatch = null;
    }
    if (this.starCatalogBatch) {
      this.stellarNeighborhoodRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
    }

    const { StarCatalogBatch } = await import('./star-catalog-batch');

    this.starCatalogBatch = new StarCatalogBatch(registry);
    this.stellarNeighborhoodRoot.add(this.starCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public async setStarClusterTiles(
    tiles: readonly StarClusterTile[],
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (!this.starClusterBatch) {
      const { StarClusterBatch } = await import('./star-cluster-batch');

      if (!this.starClusterBatch) {
        this.starClusterBatch = new StarClusterBatch(registry);
        this.stellarNeighborhoodRoot.add(this.starClusterBatch.root);
        this.setQuality(this.quality);
      }
    }
    this.starClusterBatch.synchronizeTiles(tiles);
  }

  public async setConstellationCatalog(
    catalog: ConstellationCatalog,
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (this.constellationBatch) {
      this.stellarNeighborhoodRoot.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
    }

    const { ConstellationBatch } = await import('./constellation-batch');

    this.constellationBatch = new ConstellationBatch(catalog, registry);
    this.stellarNeighborhoodRoot.add(this.constellationBatch.root);
  }

  public setConstellationsEnabled(enabled: boolean): void {
    this.constellationBatch?.setEnabled(enabled);
  }

  public get constellationDefinitions(): readonly SpaceObject[] {
    return this.constellationBatch?.definitions ?? [];
  }

  public hasConstellation(objectId: string): boolean {
    return this.constellationBatch?.has(objectId) ?? false;
  }

  public getConstellationDefinition(objectId: string): SpaceObject | undefined {
    return this.constellationBatch?.getDefinition(objectId);
  }

  public getConstellationWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return this.constellationBatch?.getWorldPosition(objectId, target) ?? null;
  }

  public getConstellationFocusRadius(objectId: string): number | null {
    return this.constellationBatch?.getFocusRadius(objectId) ?? null;
  }

  public selectConstellation(objectId: string | null): void {
    this.constellationBatch?.select(objectId);
  }

  public hoverConstellation(objectId: string | null): void {
    this.constellationBatch?.hover(objectId);
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance = getNavigationScaleForLod(lodLevel).distance,
  ): void {
    const photographicProfile = getPhotographicProfile(lodLevel, this.quality);

    this.cosmicBackground.update(cameraDistance, deltaSeconds);
    this.milkyWayVolume.update(cameraDistance, deltaSeconds, photographicProfile.galaxyRadiance);
    (this.scene.background as THREE.Color).copy(this.cosmicBackground.fallbackColor);
    (this.scene.fog as THREE.FogExp2).color.copy(this.cosmicBackground.fogColor);

    this.starCatalogBatch?.setPhotographicRadiance(photographicProfile.starRadiance);
    this.starClusterBatch?.setPhotographicRadiance(photographicProfile.starRadiance);
    this.cosmicGroupCatalogBatch?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.starCatalogBatch?.updateLod(lodLevel, deltaSeconds);
    this.starClusterBatch?.updateLod(lodLevel, deltaSeconds);
    this.constellationBatch?.updateLod(lodLevel, deltaSeconds);
    this.cosmicGroupCatalogBatch?.updateDistance(cameraDistance, deltaSeconds);
    const transition = calculateMilkyWayTransition(cameraDistance);
    const transitionVisible = lodLevel === 3 || lodLevel === 4;
    const targetOpacity = transitionVisible
      ? transition.detailOpacity * 0.1 * photographicProfile.galaxyRadiance
      : 0;
    const targetMilkyWayScale = transitionVisible ? transition.detailScale : 1;
    const targetStellarNeighborhoodScale = calculateStellarNeighborhoodScale(cameraDistance);
    const targetBackdropOpacity =
      (BACKDROP_OPACITIES[lodLevel] ?? 0) * photographicProfile.starRadiance;

    this.milkyWayMaterial.opacity = dampOpacity(
      this.milkyWayMaterial.opacity,
      targetOpacity,
      deltaSeconds,
    );
    this.milkyWay.visible = this.milkyWayMaterial.opacity > 0.004;
    this.milkyWayScale = dampOpacity(this.milkyWayScale, targetMilkyWayScale, deltaSeconds);
    this.milkyWay.scale.setScalar(this.milkyWayScale);
    this.stellarNeighborhoodScale = dampOpacity(
      this.stellarNeighborhoodScale,
      targetStellarNeighborhoodScale,
      deltaSeconds,
    );
    this.stellarNeighborhoodRoot.scale.setScalar(this.stellarNeighborhoodScale);
    this.backdropMaterial.opacity = dampOpacity(
      this.backdropMaterial.opacity,
      targetBackdropOpacity,
      deltaSeconds,
    );
    this.backdrop.visible = this.backdropMaterial.opacity > 0.004;
  }

  public selectCatalogObject(objectId: string | null): void {
    this.starCatalogBatch?.select(objectId);
    this.cosmicGroupCatalogBatch?.select(objectId);
  }

  public getCatalogWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return (
      this.starCatalogBatch?.getWorldPosition(objectId, target) ??
      this.cosmicGroupCatalogBatch?.getWorldPosition(objectId, target) ??
      null
    );
  }

  public getCatalogPickables(): readonly THREE.Object3D[] {
    return [
      ...(this.starCatalogBatch?.getPickables() ?? []),
      ...(this.constellationBatch?.getPickables() ?? []),
      ...(this.cosmicGroupCatalogBatch?.getPickables() ?? []),
    ];
  }

  public get visibleCatalogStarCount(): number {
    return this.starCatalogBatch?.visibleCount ?? 0;
  }

  public get catalogStarCount(): number {
    return this.starCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get visibleCosmicGroupCount(): number {
    return this.cosmicGroupCatalogBatch?.visibleCount ?? 0;
  }

  public get cosmicGroupCount(): number {
    return this.cosmicGroupCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get activeStarTileCount(): number {
    return this.starClusterBatch?.activeTileCount ?? 0;
  }

  public get starClusterRepresentationCount(): number {
    return this.starClusterBatch?.representationCount ?? 0;
  }

  public get visibleStarClusterCount(): number {
    return this.starClusterBatch?.visibleClusterCount ?? 0;
  }

  public dispose(): void {
    if (this.constellationBatch) {
      this.stellarNeighborhoodRoot.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
      this.constellationBatch = null;
    }
    if (this.starCatalogBatch) {
      this.stellarNeighborhoodRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
      this.starCatalogBatch = null;
    }
    if (this.starClusterBatch) {
      this.stellarNeighborhoodRoot.remove(this.starClusterBatch.root);
      this.starClusterBatch.dispose();
      this.starClusterBatch = null;
    }
    if (this.cosmicGroupCatalogBatch) {
      this.spaceRoot.remove(this.cosmicGroupCatalogBatch.root);
      this.cosmicGroupCatalogBatch.dispose();
      this.cosmicGroupCatalogBatch = null;
    }
    this.spaceRoot.remove(this.milkyWayVolume.root);
    this.milkyWayVolume.dispose();
    this.scene.remove(this.cosmicBackground.mesh);
    this.cosmicBackground.dispose();
    disposeObjectTree(this.scene);
    this.scene.clear();
  }
}

const BACKDROP_OPACITIES = [0.32, 0.22, 0.06, 0, 0, 0, 0] as const;
const STELLAR_NEIGHBORHOOD_SCALE_START = 1_400;
const STELLAR_NEIGHBORHOOD_SCALE_END = 9_600;
const GALACTIC_STELLAR_NEIGHBORHOOD_SCALE = 0.16;

function dampOpacity(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-6 * deltaSeconds));
}

function calculateStellarNeighborhoodScale(cameraDistance: number): number {
  const progress = smoothstep(
    STELLAR_NEIGHBORHOOD_SCALE_START,
    STELLAR_NEIGHBORHOOD_SCALE_END,
    cameraDistance,
  );

  return 1 - progress * (1 - GALACTIC_STELLAR_NEIGHBORHOOD_SCALE);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}

function createBackdropGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const random = mulberry32(0x0c05_105);

  for (let index = 0; index < count; index += 1) {
    const radius = 7_500 + random() * 1_500;
    const theta = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const offset = index * 3;

    positions[offset] = radius * sine * Math.cos(theta);
    positions[offset + 1] = radius * cosine;
    positions[offset + 2] = radius * sine * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return geometry;
}

function createMilkyWayGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = mulberry32(0x51a7_f13d);
  const cool = new THREE.Color(0x7195d0);
  const warm = new THREE.Color(0xe1bc82);
  const sample: MilkyWayParticle = { x: 0, y: 0, z: 0, warmth: 0 };

  for (let index = 0; index < count; index += 1) {
    sampleMilkyWayParticle(random, sample);
    const offset = index * 3;

    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
    colors[offset] = cool.r + (warm.r - cool.r) * sample.warmth;
    colors[offset + 1] = cool.g + (warm.g - cool.g) * sample.warmth;
    colors[offset + 2] = cool.b + (warm.b - cool.b) * sample.warmth;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

interface MilkyWayParticle {
  x: number;
  y: number;
  z: number;
  warmth: number;
}

function sampleMilkyWayParticle(random: () => number, target: MilkyWayParticle): void {
  const component = random();

  if (component < 0.17) {
    sampleGalacticBar(random, target);

    return;
  }
  if (component < 0.62) {
    sampleSpiralArm(random, target);

    return;
  }
  sampleDiffuseDisk(random, target);
}

function sampleGalacticBar(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 1.65);
  const angle = random() * Math.PI * 2;
  const barX = Math.cos(angle) * radialProgress * 1_420;
  const barZ = Math.sin(angle) * radialProgress * 520;
  const barRotation = Math.PI * 0.14;

  target.x = Math.cos(barRotation) * barX - Math.sin(barRotation) * barZ;
  target.y = centeredNoise(random) * 330 * (1 - radialProgress * 0.65);
  target.z = Math.sin(barRotation) * barX + Math.cos(barRotation) * barZ;
  target.warmth = 0.52 + (1 - radialProgress) * 0.28 + random() * 0.08;
}

function sampleSpiralArm(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 0.78);
  const armIndex = Math.floor(random() * MILKY_WAY_ARM_COUNT);
  const armWidth = 75 + radialProgress * 185;
  const radius =
    MILKY_WAY_ARM_REFERENCE_RADIUS + radialProgress * 4_550 + centeredNoise(random) * armWidth;
  const angle =
    calculateGalactocentricSpiralAngle(radius, armIndex) +
    centeredNoise(random) * (0.08 + radialProgress * 0.075);

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (75 + radialProgress * 155);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.08 + (1 - radialProgress) * 0.18 + random() * 0.12;
}

function sampleDiffuseDisk(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.sqrt(random());
  const radius = 620 + radialProgress * 5_180;
  const angle = random() * Math.PI * 2;

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (65 + radialProgress * 220);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.16 + (1 - radialProgress) * 0.3 + random() * 0.1;
}

function centeredNoise(random: () => number): number {
  return random() + random() + random() - 1.5;
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.Line
    ) {
      object.geometry.dispose();
      disposeMaterial(object.material);
    }
    if (object instanceof THREE.Sprite) {
      disposeMaterial(object.material);
    }
  });
}

function disposeMaterial(materialOrMaterials: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(materialOrMaterials)
    ? materialOrMaterials
    : [materialOrMaterials];

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    }
    material.dispose();
  }
}

function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b_79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
