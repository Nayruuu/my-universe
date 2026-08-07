import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { CAMERA_FAR_DISTANCE } from '../camera/navigation-policy';
import { BlackHoleLensingPass } from '../rendering/black-hole-lensing-pass';
import { getPhotographicProfile } from '../rendering/photographic-profile';

export type WebGlRendererConstructor = new (
  parameters: THREE.WebGLRendererParameters,
) => THREE.WebGLRenderer;

export interface RenderingBootstrapPerformance {
  resetAdaptivePixelRatio(quality: GraphicQuality): number;
}

export interface UniverseRenderingRuntime {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly lensingPass: BlackHoleLensingPass;
  readonly pixelRatio: number;
}

export class UniverseRenderingBootstrap {
  constructor(
    private readonly Renderer: WebGlRendererConstructor,
    private readonly performance: RenderingBootstrapPerformance,
  ) {}

  public create(container: HTMLElement, quality: GraphicQuality): UniverseRenderingRuntime {
    const renderer = new this.Renderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });

    renderer.domElement.className = 'universe-canvas';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = getPhotographicProfile(0, quality).exposure;
    const pixelRatio = this.performance.resetAdaptivePixelRatio(quality);

    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.025, CAMERA_FAR_DISTANCE);

    camera.position.set(39, 8, 20);

    return {
      renderer,
      camera,
      lensingPass: new BlackHoleLensingPass(),
      pixelRatio,
    };
  }
}
