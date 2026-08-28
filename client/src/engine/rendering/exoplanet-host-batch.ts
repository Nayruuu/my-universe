import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import {
  calculateStellarNeighborhoodReveal,
  interpolateStellarNeighborhoodLodValue,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
} from '../coordinates/stellar-neighborhood-scale-model';
import { dampValue } from '../lod/screen-space-lod';
import { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { createExoplanetHostVisual } from './exoplanet-host-visual';
import { getHeliocentricCatalogObserverOpacity } from './heliocentric-catalog-visibility';

const LOD_OPACITIES = [0.38, 0.54, 0.68, 0, 0, 0] as const;
const LOD_POINT_SCALES = [0.62, 0.82, 1, 0.72, 0.6, 0.5] as const;
const LOD_SIGNATURE_STRENGTHS = [0, 0.12, 0.38, 0, 0, 0] as const;
const OPACITY_DAMPING = 6;
const POINT_SCALE_DAMPING = 6;
const SIGNATURE_DAMPING = 7;
const MINIMUM_VISIBLE_REVEAL = 0.004;

const QUALITY_DRAW_FRACTIONS = {
  low: 0.45,
  medium: 0.72,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;
const QUALITY_SURFACE_DETAIL = {
  low: 0.32,
  medium: 0.68,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

export function getExoplanetHostDrawFraction(quality: GraphicQuality): number {
  return QUALITY_DRAW_FRACTIONS[quality];
}

export function getExoplanetHostTargetOpacity(lodLevel: number): number {
  const boundedLevel = THREE.MathUtils.clamp(lodLevel, 0, LOD_OPACITIES.length - 1);
  const lowerIndex = Math.floor(boundedLevel);
  const upperIndex = Math.ceil(boundedLevel);

  return THREE.MathUtils.lerp(
    LOD_OPACITIES[lowerIndex]!,
    LOD_OPACITIES[upperIndex]!,
    boundedLevel - lowerIndex,
  );
}

export class ExoplanetHostBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly renderedHostIndices: readonly number[];
  private readonly visibleIndices: Uint8Array;
  private quality: GraphicQuality;
  private drawCount = 0;
  private opacity = 0;
  private pointScale = 1;
  private hostSignatureStrength = 0;
  private selectedObjectId: string | null = null;
  private stellarNeighborhoodVisible = true;
  private readonly observerLocalPosition = new THREE.Vector3();
  private readonly observerWorldInverse = new THREE.Matrix4();

  constructor(
    private readonly registry: ExoplanetCatalogRegistry,
    quality: GraphicQuality = 'high',
  ) {
    const visual = createExoplanetHostVisual(registry);

    this.quality = quality;
    this.renderedHostIndices = visual.renderedHostIndices;
    this.visibleIndices = visual.visibleIndices;
    this.points = visual.points;
    this.selectionPoint = visual.selectionPoint;
    this.root.name = 'nasa-exoplanet-host-catalog-root';
    this.root.add(this.points, this.selectionPoint);
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.drawCount = Math.ceil(
      this.renderedHostIndices.length * getExoplanetHostDrawFraction(this.quality),
    );
    this.points.material.uniforms['surfaceDetail']!.value = QUALITY_SURFACE_DETAIL[quality];
    this.points.geometry.setDrawRange(0, this.drawCount);
    this.refreshVisibleIndices();
  }

  public setPixelRatio(pixelRatio: number): void {
    const boundedRatio = Math.max(0.5, pixelRatio);

    this.points.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.selectionPoint.material.uniforms['pixelRatio']!.value = boundedRatio;
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    observerPosition?: Vector3Like,
    cameraDistance?: number,
  ): void {
    const observerBoundaryOpacity = this.getObserverBoundaryOpacity(observerPosition);
    const stellarTransitionActive = lodLevel >= 1 && lodLevel <= 3;
    const transitionDistance =
      cameraDistance ?? (lodLevel <= 2 ? 0 : STELLAR_NEIGHBORHOOD_REVEAL_END);
    const transitionOpacity = calculateStellarNeighborhoodReveal(transitionDistance);
    const transitionStyleReveal =
      cameraDistance === undefined
        ? lodLevel <= 1
          ? 1
          : lodLevel === 2
            ? 0.5
            : 0
        : transitionOpacity;
    const lodOpacity = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          LOD_OPACITIES[1],
          LOD_OPACITIES[2],
          LOD_OPACITIES[3],
          transitionStyleReveal,
        )
      : getExoplanetHostTargetOpacity(lodLevel);
    const targetOpacity = lodOpacity * observerBoundaryOpacity * transitionOpacity;
    const boundedLevel = Math.round(
      THREE.MathUtils.clamp(lodLevel, 0, LOD_POINT_SCALES.length - 1),
    );
    const targetPointScale = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          LOD_POINT_SCALES[1],
          LOD_POINT_SCALES[2],
          LOD_POINT_SCALES[3],
          transitionStyleReveal,
        )
      : LOD_POINT_SCALES[boundedLevel]!;
    const targetSignatureStrength = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          LOD_SIGNATURE_STRENGTHS[1],
          LOD_SIGNATURE_STRENGTHS[2],
          LOD_SIGNATURE_STRENGTHS[3],
          transitionStyleReveal,
        ) * transitionOpacity
      : LOD_SIGNATURE_STRENGTHS[boundedLevel]!;
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, OPACITY_DAMPING, deltaSeconds);
    this.pointScale = dampValue(
      this.pointScale,
      targetPointScale,
      POINT_SCALE_DAMPING,
      deltaSeconds,
    );
    this.hostSignatureStrength = dampValue(
      this.hostSignatureStrength,
      targetSignatureStrength,
      SIGNATURE_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.userData['observerBoundaryOpacity'] = observerBoundaryOpacity;
    this.points.userData['stellarNeighborhoodReveal'] = transitionOpacity;
    this.points.material.uniforms['pointScale']!.value = this.pointScale;
    this.points.material.uniforms['hostSignatureStrength']!.value = this.hostSignatureStrength;
    this.stellarNeighborhoodVisible = transitionOpacity > MINIMUM_VISIBLE_REVEAL;
    this.refreshSelectionVisibility();
    this.points.visible = this.drawCount > 0 && this.opacity > MINIMUM_VISIBLE_REVEAL;
    if (this.points.visible !== wasVisible) {
      this.refreshVisibleIndices();
    }
  }

  public select(objectId: string | null): void {
    const position = objectId ? this.registry.getLocalPosition(objectId) : null;

    if (!objectId || !position) {
      this.selectedObjectId = null;
      this.selectionPoint.userData['objectId'] = null;
      this.refreshSelectionVisibility();

      return;
    }

    this.selectedObjectId = objectId;
    this.selectionPoint.position.copy(position);
    this.selectionPoint.userData['objectId'] = objectId;
    this.refreshSelectionVisibility();
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const position = this.registry.getLocalPosition(objectId, target);

    if (!position) {
      return null;
    }
    this.root.updateWorldMatrix(true, false);

    return position.applyMatrix4(this.root.matrixWorld);
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [this.selectionPoint, this.points];
  }

  public get visibleCount(): number {
    return this.points.visible ? this.drawCount : 0;
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    return this.registry.has(objectId) ? this.points.visible : null;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.root.clear();
  }

  private refreshSelectionVisibility(): void {
    this.selectionPoint.visible = this.selectedObjectId !== null && this.stellarNeighborhoodVisible;
  }

  private refreshVisibleIndices(): void {
    this.visibleIndices.fill(0);
    if (this.points.visible) {
      this.visibleIndices.fill(1, 0, this.drawCount);
    }
    this.points.userData['activeCount'] = this.points.visible ? this.drawCount : 0;
  }

  private getObserverBoundaryOpacity(observerPosition?: Vector3Like): number {
    const sphere = this.points.geometry.boundingSphere;

    if (!observerPosition || !sphere) {
      return 1;
    }
    this.points.updateWorldMatrix(true, false);
    this.observerWorldInverse.copy(this.points.matrixWorld).invert();
    this.observerLocalPosition
      .set(observerPosition.x, observerPosition.y, observerPosition.z)
      .applyMatrix4(this.observerWorldInverse);

    return getHeliocentricCatalogObserverOpacity(
      this.observerLocalPosition.length(),
      sphere.radius + sphere.center.length(),
    );
  }
}
