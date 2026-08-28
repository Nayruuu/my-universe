import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  type MilkyWaySceneScale,
  MILKY_WAY_DIAMETER_LIGHT_YEARS,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
} from '../coordinates/galaxy-scale-model';

export class MilkyWayVolumeVisual {
  public readonly root = new THREE.Group();

  constructor() {
    this.root.name = 'illustrative-milky-way-volume';
    this.root.visible = false;
    this.root.userData['scientificConfidence'] = 'illustrative';
    this.root.userData['visualStructure'] = 'retired-volume-placeholder-for-point-built-galaxy';
    this.root.userData['structureOrigin'] = 'galactic-center';
    this.root.userData['rasterAtlas'] = 'none';
    this.root.userData['surfaceGeometry'] = 'none';
    this.root.userData['primaryRepresentation'] =
      'deterministic-galactocentric-batched-point-cloud';
    this.root.userData['depthTechnique'] = 'point-cloud-only';
    this.root.userData['proceduralTechnique'] = 'none';
    this.root.userData['morphologyModel'] = 'barred-spiral-with-two-major-and-two-minor-arms';
    this.root.userData['verticalStructure'] = 'thin-and-thick-disc-point-distribution';
    this.root.userData['visualThicknessTreatment'] = 'point-density-envelope-only';
    this.root.userData['apparentScaleTreatment'] =
      'shared-canonical-galactic-metric-for-disc-and-solar-position';
    this.root.userData['physicalDiameterLightYears'] = MILKY_WAY_DIAMETER_LIGHT_YEARS;
    this.root.userData['authoringDiameter'] = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER;
    this.root.userData['nearRepresentation'] =
      'same-fixed-galactocentric-points-resolved-by-perspective-and-proximity';
    this.root.userData['transitionRepresentation'] =
      'one-galactocentric-point-population-from-exterior-silhouette-to-stellar-traversal';
    this.root.userData['proceduralVolumeOpacityFactor'] = 0;
    this.root.userData['interiorContinuity'] =
      'fixed-point-cloud-through-galactic-and-stellar-catalogue-overlay';
    this.root.userData['interiorClarityTreatment'] = 'same-points-resolve-by-local-proximity';
    this.root.userData['integratedLightTreatment'] = 'none-separate-volume-retired';
    this.root.userData['exteriorReadabilityTreatment'] =
      'point-density-arms-and-bulge-with-dark-interarm-separation';
  }

  public get visibleSurfaceLayerCount(): number {
    return 0;
  }

  public get drawMeshCount(): number {
    return 0;
  }

  public get proceduralVolumeVisible(): boolean {
    return false;
  }

  public setQuality(quality: GraphicQuality): void {
    this.root.userData['quality'] = quality;
  }

  public update(galaxyRadiance: number, sceneScale: MilkyWaySceneScale, active: boolean): void {
    this.root.userData['volumeOpacity'] = 0;
    this.root.userData['atlasOpacity'] = 0;
    this.root.userData['proceduralOpacity'] = 0;
    this.root.userData['surfaceLayerCount'] = 0;
    this.root.userData['volumeLayerOpacity'] = 0;
    this.root.userData['requestedGalaxyRadiance'] = galaxyRadiance;
    this.root.userData['requestedActive'] = active;
    this.root.userData['modelScale'] = sceneScale.modelScale;
    this.root.userData['worldDiameter'] = sceneScale.worldDiameter;
    this.root.userData['physicalWorldDiameter'] = sceneScale.physicalWorldDiameter;
    this.root.userData['visualScaleFactor'] = sceneScale.visualScaleFactor;
    this.root.userData['visualSceneUnitsPerKiloparsec'] = sceneScale.visualSceneUnitsPerKiloparsec;
    this.root.userData['referenceFrameSceneUnitsPerKiloparsec'] =
      sceneScale.referenceFrameSceneUnitsPerKiloparsec;
    this.root.userData['referenceFrameBlend'] = sceneScale.referenceFrameBlend;
    this.root.scale.setScalar(sceneScale.modelScale);
    this.root.visible = false;
  }

  public dispose(): void {
    this.root.clear();
  }
}
