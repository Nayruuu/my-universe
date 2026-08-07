import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  BlackHoleLensingCompositor,
  type BlackHoleLensingComposition,
} from './black-hole-lensing-compositor';
import {
  calculateFullColorLensingColor,
  calculateThinLensSourceRadius,
  dampLensingStrength,
  projectBlackHoleLensing,
  type BlackHoleLensingEffect,
} from './black-hole-lensing-model';

export {
  calculateFullColorLensingColor,
  calculateThinLensSourceRadius,
  dampLensingStrength,
  projectBlackHoleLensing,
};
export type { BlackHoleLensingEffect };

export interface BlackHoleLensingDebugState {
  readonly active: boolean;
  readonly objectId: string | null;
  readonly strength: number;
  readonly coreRadius: number;
  readonly einsteinRadius: number;
  readonly distortionModel: 'thin-lens-einstein-ring';
  readonly compositionMode: 'background-lens-foreground';
  readonly backgroundPreservation: 'live-framebuffer-thin-lens';
  readonly foregroundSeparated: boolean;
  readonly foregroundScale: number;
  readonly displayCoreRadius: number;
  readonly displayInfluenceRadius: number;
  readonly scientificConfidence: 'illustrative' | null;
  readonly renderWidth: number;
  readonly renderHeight: number;
}

const ACTIVE_STRENGTH_THRESHOLD = 0.001;

export class BlackHoleLensingPass {
  private readonly compositor = new BlackHoleLensingCompositor();
  private currentStrength = 0;
  private objectId: string | null = null;
  private centerX = 0.5;
  private centerY = 0.5;
  private coreRadius = 0.08;
  private einsteinRadius = 0.14;
  private influenceRadius = 0.32;
  private foregroundScale = 1;
  private displayCoreRadius = 0.08;
  private displayInfluenceRadius = 0.32;
  private displayForegroundScale = 1;
  private foregroundRoot: THREE.Object3D | null = null;
  private foregroundSeparated = false;

  public get debugState(): BlackHoleLensingDebugState {
    const active = this.currentStrength > ACTIVE_STRENGTH_THRESHOLD;
    const renderSize = this.compositor.renderSize;

    return {
      active,
      objectId: active ? this.objectId : null,
      strength: this.currentStrength,
      coreRadius: this.coreRadius,
      einsteinRadius: this.einsteinRadius,
      distortionModel: 'thin-lens-einstein-ring',
      compositionMode: 'background-lens-foreground',
      backgroundPreservation: 'live-framebuffer-thin-lens',
      foregroundSeparated: active && this.foregroundSeparated,
      foregroundScale: active ? this.displayForegroundScale : 1,
      displayCoreRadius: active ? this.displayCoreRadius : 0,
      displayInfluenceRadius: active ? this.displayInfluenceRadius : 0,
      scientificConfidence: active ? 'illustrative' : null,
      renderWidth: renderSize.width,
      renderHeight: renderSize.height,
    };
  }

  public setSize(width: number, height: number, pixelRatio: number, quality: GraphicQuality): void {
    this.compositor.setSize(width, height, pixelRatio, quality);
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    effect: BlackHoleLensingEffect | null,
    foregroundRoot: THREE.Object3D | null,
    deltaSeconds: number,
  ): void {
    if (effect) {
      this.applyEffect(effect, foregroundRoot);
    }
    this.currentStrength = dampLensingStrength(
      this.currentStrength,
      effect?.strength ?? 0,
      deltaSeconds,
    );

    if (this.currentStrength <= ACTIVE_STRENGTH_THRESHOLD) {
      this.clearInactiveEffect();
      renderer.render(scene, camera);

      return;
    }

    const separatedForeground = this.foregroundRoot?.visible === true ? this.foregroundRoot : null;

    this.foregroundSeparated = separatedForeground !== null;
    if (separatedForeground) {
      separatedForeground.visible = false;
    }
    try {
      renderer.render(scene, camera);
      this.composeOverlay(renderer);
      if (separatedForeground) {
        separatedForeground.visible = true;
        this.compositor.renderForeground(
          renderer,
          scene,
          camera,
          separatedForeground,
          this.displayForegroundScale,
        );
      }
    } finally {
      if (separatedForeground) {
        separatedForeground.visible = true;
      }
    }
  }

  public dispose(): void {
    this.compositor.dispose();
  }

  private applyEffect(effect: BlackHoleLensingEffect, foregroundRoot: THREE.Object3D | null): void {
    this.objectId = effect.objectId;
    this.centerX = effect.centerX;
    this.centerY = effect.centerY;
    this.coreRadius = effect.coreRadius;
    this.einsteinRadius = effect.einsteinRadius;
    this.influenceRadius = effect.influenceRadius;
    this.foregroundScale = effect.foregroundScale;
    this.foregroundRoot = foregroundRoot;
  }

  private clearInactiveEffect(): void {
    this.objectId = null;
    this.foregroundRoot = null;
    this.foregroundSeparated = false;
  }

  private composeOverlay(renderer: THREE.WebGLRenderer): void {
    const composition: BlackHoleLensingComposition = {
      centerX: this.centerX,
      centerY: this.centerY,
      coreRadius: this.coreRadius,
      einsteinRadius: this.einsteinRadius,
      influenceRadius: this.influenceRadius,
      foregroundScale: this.foregroundScale,
      strength: this.currentStrength,
    };
    const displayState = this.compositor.renderOverlay(renderer, composition);

    this.displayCoreRadius = displayState.coreRadius;
    this.displayInfluenceRadius = displayState.influenceRadius;
    this.displayForegroundScale = displayState.foregroundScale;
  }
}
