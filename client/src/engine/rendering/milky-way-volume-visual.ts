import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  type MilkyWaySceneScale,
  MILKY_WAY_DIAMETER_LIGHT_YEARS,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
  MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS,
} from '../coordinates/galaxy-scale-model';
import {
  MILKY_WAY_PROCEDURAL_MINIMUM_VISIBLE_OPACITY,
  MilkyWayProceduralVolume,
} from './milky-way-procedural-volume';

/**
 * The ray-marched density provides the large-scale silhouette while the batched particles provide
 * the stellar structure seen during entry. Both representations sample the same galactocentric
 * morphology, but the density veil recedes before nearby point tracers become dominant.
 */
const PROCEDURAL_VOLUME_OPACITY_FACTOR = 0.46;

export class MilkyWayVolumeVisual {
  public readonly root = new THREE.Group();

  private readonly proceduralVolume = new MilkyWayProceduralVolume(
    MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
    MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS,
  );
  private proceduralOpacity = 0;
  private immersionOpacity = 0;

  constructor() {
    this.root.name = 'illustrative-milky-way-volume';
    this.root.visible = false;
    this.root.userData['scientificConfidence'] = 'illustrative';
    this.root.userData['visualStructure'] = 'asymmetric-continuous-four-arm-galactic-disc';
    this.root.userData['structureOrigin'] = 'galactic-center';
    this.root.userData['rasterAtlas'] = 'none';
    this.root.userData['depthTechnique'] = 'procedural-ray-marched-density-volume';
    this.root.userData['proceduralTechnique'] =
      'deterministic-three-dimensional-density-field-with-dust-rifts';
    this.root.userData['morphologyModel'] = 'barred-spiral-with-two-major-and-two-minor-arms';
    this.root.userData['verticalStructure'] = 'thin-disc-with-illustrative-luminous-envelope';
    this.root.userData['visualThicknessTreatment'] =
      'readable-ray-marched-envelope-around-physical-stellar-containment';
    this.root.userData['apparentScaleTreatment'] =
      'illustrative-immersive-envelope-over-canonical-reference-frame';
    this.root.userData['physicalDiameterLightYears'] = MILKY_WAY_DIAMETER_LIGHT_YEARS;
    this.root.userData['authoringDiameter'] = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER;
    this.root.userData['nearRepresentation'] =
      'fading-density-envelope-with-crisp-batched-stellar-structure';
    this.root.userData['transitionRepresentation'] =
      'continuous-three-dimensional-density-and-stellar-volume';
    this.root.userData['proceduralVolumeOpacityFactor'] = PROCEDURAL_VOLUME_OPACITY_FACTOR;
    this.root.userData['proceduralVolumeThickness'] = MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS;
    this.root.userData['interiorContinuity'] =
      'restrained-density-floor-through-stellar-neighborhood-navigation';
    this.root.userData['interiorClarityTreatment'] =
      'dark-interarm-integrated-light-without-an-interior-handoff-gap';
    this.root.userData['integratedLightTreatment'] =
      'illustrative-unresolved-starlight-clustered-into-arms-filaments-and-clumps';

    this.root.add(this.proceduralVolume.mesh);
    this.applyVisibility();
  }

  public get visibleDiscLayerCount(): number {
    return 0;
  }

  public get drawMeshCount(): number {
    if (!this.root.visible) {
      return 0;
    }

    return this.root.children.filter((child) => child.visible).length;
  }

  public get proceduralVolumeVisible(): boolean {
    return this.proceduralVolume.mesh.visible;
  }

  public setQuality(quality: GraphicQuality): void {
    this.proceduralVolume.setQuality(quality);
    this.root.userData['quality'] = quality;
  }

  public update(
    opacity: number,
    immersionOpacity: number,
    galaxyRadiance: number,
    sceneScale: MilkyWaySceneScale,
  ): void {
    this.proceduralOpacity = opacity;
    this.immersionOpacity = immersionOpacity;
    const volumeOpacity = Math.max(
      this.proceduralOpacity * PROCEDURAL_VOLUME_OPACITY_FACTOR,
      immersionOpacity,
    );

    this.root.userData['volumeOpacity'] = opacity;
    this.root.userData['atlasOpacity'] = 0;
    this.root.userData['proceduralOpacity'] = this.proceduralOpacity;
    this.root.userData['immersionOpacity'] = immersionOpacity;
    this.root.userData['volumeLayerOpacity'] = volumeOpacity;
    this.root.userData['modelScale'] = sceneScale.modelScale;
    this.root.userData['worldDiameter'] = sceneScale.worldDiameter;
    this.root.userData['physicalWorldDiameter'] = sceneScale.physicalWorldDiameter;
    this.root.userData['visualScaleFactor'] = sceneScale.visualScaleFactor;
    this.root.userData['visualSceneUnitsPerKiloparsec'] = sceneScale.visualSceneUnitsPerKiloparsec;
    this.root.userData['referenceFrameSceneUnitsPerKiloparsec'] =
      sceneScale.referenceFrameSceneUnitsPerKiloparsec;
    this.root.userData['referenceFrameBlend'] = sceneScale.referenceFrameBlend;
    this.root.scale.setScalar(sceneScale.modelScale);
    this.proceduralVolume.update(volumeOpacity, galaxyRadiance);
    this.root.visible = volumeOpacity > MILKY_WAY_PROCEDURAL_MINIMUM_VISIBLE_OPACITY;
    this.applyVisibility();
  }

  public dispose(): void {
    this.proceduralVolume.dispose();
    this.root.clear();
  }

  private applyVisibility(): void {
    if (!this.root.visible) {
      this.proceduralVolume.mesh.visible = false;
    }
  }
}
