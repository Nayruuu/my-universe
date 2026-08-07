import * as THREE from 'three';
import { type ReferenceFrame } from '../../data/models/universe.models';
import {
  calculateIntergalacticScale,
  COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
  LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
  LOCAL_GROUP_SCALE_DISTANCE,
  NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
  type IntergalacticScale,
} from './intergalactic-scale-model';

export type IntergalacticReferenceFrame = Extract<
  ReferenceFrame,
  'local-group' | 'nearby-universe' | 'cosmic-web'
>;

/**
 * Scene hierarchy that converts all linear intergalactic catalogues into one shared world metric.
 * The conversion roots are constant; only the outer semantic-scale root changes during navigation.
 */
export class IntergalacticFrameGroup {
  public readonly cosmicWebRoot = new THREE.Group();
  public readonly nearbyUniverseRoot = new THREE.Group();
  public readonly localGroupRoot = new THREE.Group();

  private scale = calculateIntergalacticScale(LOCAL_GROUP_SCALE_DISTANCE);

  constructor(parent: THREE.Group, namePrefix: string) {
    this.cosmicWebRoot.name = `${namePrefix}-cosmic-web-frame`;
    this.nearbyUniverseRoot.name = `${namePrefix}-nearby-universe-frame`;
    this.localGroupRoot.name = `${namePrefix}-local-group-frame`;
    this.cosmicWebRoot.userData['referenceFrame'] = 'cosmic-web';
    this.nearbyUniverseRoot.userData['referenceFrame'] = 'nearby-universe';
    this.localGroupRoot.userData['referenceFrame'] = 'local-group';
    this.cosmicWebRoot.userData['scaleTreatment'] = 'continuous-intergalactic-metric';
    this.nearbyUniverseRoot.scale.setScalar(
      COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC /
        NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
    );
    this.localGroupRoot.scale.setScalar(
      NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC /
        LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
    );
    parent.add(this.cosmicWebRoot);
    this.cosmicWebRoot.add(this.nearbyUniverseRoot);
    this.nearbyUniverseRoot.add(this.localGroupRoot);
    this.apply(this.scale);
  }

  public update(cameraDistance: number): boolean {
    const next = calculateIntergalacticScale(cameraDistance);

    if (
      Math.abs(next.cosmicWebScale - this.scale.cosmicWebScale) <= 1e-12 &&
      next.referenceFrameBlend === this.scale.referenceFrameBlend
    ) {
      return false;
    }
    this.scale = next;
    this.apply(next);

    return true;
  }

  public getRoot(referenceFrame: ReferenceFrame): THREE.Group | null {
    switch (referenceFrame) {
      case 'local-group':
        return this.localGroupRoot;
      case 'nearby-universe':
        return this.nearbyUniverseRoot;
      case 'cosmic-web':
        return this.cosmicWebRoot;
      default:
        return null;
    }
  }

  public get currentScale(): IntergalacticScale {
    return this.scale;
  }

  public dispose(): void {
    this.cosmicWebRoot.removeFromParent();
  }

  private apply(scale: IntergalacticScale): void {
    this.cosmicWebRoot.scale.setScalar(scale.cosmicWebScale);
    for (const root of [this.cosmicWebRoot, this.nearbyUniverseRoot, this.localGroupRoot]) {
      root.userData['sceneUnitsPerMegaparsec'] = scale.sceneUnitsPerMegaparsec;
      root.userData['referenceFrameBlend'] = scale.referenceFrameBlend;
    }
  }
}
