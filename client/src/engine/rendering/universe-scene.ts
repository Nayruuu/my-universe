import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import type { StarCatalogBatch as StarCatalogBatchInstance } from './star-catalog-batch';

export class UniverseScene {
  public readonly scene = new THREE.Scene();
  public readonly spaceRoot = new THREE.Group();

  private readonly backdropGeometry: THREE.BufferGeometry;
  private readonly milkyWayGeometry: THREE.BufferGeometry;
  private readonly milkyWayMaterial: THREE.PointsMaterial;
  private readonly backdrop: THREE.Points;
  private readonly milkyWay: THREE.Points;
  private starCatalogBatch: StarCatalogBatchInstance | null = null;
  private quality: GraphicQuality = 'medium';

  constructor(private readonly performanceManager: PerformanceManager) {
    this.scene.background = new THREE.Color(0x010208);
    this.scene.fog = new THREE.FogExp2(0x02030a, 0.000_045);
    this.spaceRoot.name = 'floating-space-root';
    this.scene.add(this.spaceRoot);

    this.scene.add(new THREE.AmbientLight(0x5b6b8f, 0.12));

    this.backdropGeometry = createBackdropGeometry(10_000);
    this.backdrop = new THREE.Points(
      this.backdropGeometry,
      new THREE.PointsMaterial({
        color: 0xdce8ff,
        size: 1.45,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        fog: false,
      }),
    );
    this.backdrop.name = 'distant-star-field';
    this.spaceRoot.add(this.backdrop);

    this.milkyWayGeometry = createMilkyWayGeometry(10_000);
    this.milkyWayMaterial = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this.milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
    this.milkyWay.name = 'illustrative-milky-way';
    this.spaceRoot.add(this.milkyWay);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const count = this.performanceManager.getParticleCount(quality);

    this.backdropGeometry.setDrawRange(0, Math.min(count, 10_000));
    this.milkyWayGeometry.setDrawRange(0, Math.min(count, 10_000));
    this.starCatalogBatch?.setPixelRatio(this.performanceManager.getPixelRatio(quality));
  }

  public async setStarCatalog(registry: StarCatalogRegistry): Promise<void> {
    if (this.starCatalogBatch) {
      this.spaceRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
    }

    const { StarCatalogBatch } = await import('./star-catalog-batch');

    this.starCatalogBatch = new StarCatalogBatch(registry);
    this.spaceRoot.add(this.starCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public updateLod(lodLevel: number, deltaSeconds: number): void {
    this.starCatalogBatch?.updateLod(lodLevel, deltaSeconds);
    const targetOpacity = lodLevel >= 4 ? 0 : 0.24;

    this.milkyWayMaterial.opacity = dampOpacity(
      this.milkyWayMaterial.opacity,
      targetOpacity,
      deltaSeconds,
    );
    this.milkyWay.visible = this.milkyWayMaterial.opacity > 0.004;
  }

  public selectCatalogObject(objectId: string | null): void {
    this.starCatalogBatch?.select(objectId);
  }

  public getCatalogWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return this.starCatalogBatch?.getWorldPosition(objectId, target) ?? null;
  }

  public getCatalogPickables(): readonly THREE.Object3D[] {
    return this.starCatalogBatch?.getPickables() ?? [];
  }

  public get visibleCatalogStarCount(): number {
    return this.starCatalogBatch?.visibleCount ?? 0;
  }

  public get catalogStarCount(): number {
    return this.starCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public dispose(): void {
    if (this.starCatalogBatch) {
      this.spaceRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
      this.starCatalogBatch = null;
    }
    disposeObjectTree(this.scene);
    this.scene.clear();
  }
}

function dampOpacity(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-6 * deltaSeconds));
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
  const cool = new THREE.Color(0x819ac9);
  const warm = new THREE.Color(0xd6bd94);

  for (let index = 0; index < count; index += 1) {
    const arm = index % 4;
    const radialProgress = Math.pow(random(), 0.58);
    const radius = 260 + radialProgress * 5_700;
    const armAngle = arm * (Math.PI / 2) + radialProgress * Math.PI * 3.2;
    const spread = (random() - 0.5) * (0.32 + radialProgress * 0.38);
    const angle = armAngle + spread;
    const thickness = (random() - 0.5) * (60 + radialProgress * 290);
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = thickness;
    positions[offset + 2] = Math.sin(angle) * radius;

    const mix = random() * 0.56;

    colors[offset] = cool.r + (warm.r - cool.r) * mix;
    colors[offset + 1] = cool.g + (warm.g - cool.g) * mix;
    colors[offset + 2] = cool.b + (warm.b - cool.b) * mix;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
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
