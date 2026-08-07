import * as THREE from 'three';
import { CAMERA_FAR_DISTANCE } from '../camera/navigation-policy';
import { BlackHoleLensingPass } from '../rendering/black-hole-lensing-pass';
import { getPhotographicProfile } from '../rendering/photographic-profile';
import {
  UniverseRenderingBootstrap,
  type WebGlRendererConstructor,
} from './universe-rendering-bootstrap';

describe('UniverseRenderingBootstrap', () => {
  it('crée un renderer photographique, une caméra et la lentille sur le conteneur', () => {
    const instances: FakeRenderer[] = [];
    const Renderer = class {
      public readonly domElement = document.createElement('canvas');
      public readonly setPixelRatio = vi.fn();
      public outputColorSpace = '';
      public toneMapping = 0;
      public toneMappingExposure = 0;

      constructor(public readonly options: THREE.WebGLRendererParameters) {
        instances.push(this);
      }
    } as unknown as WebGlRendererConstructor;
    const performance = {
      resetAdaptivePixelRatio: vi.fn(() => 1.25),
    };
    const container = document.createElement('div');
    const bootstrap = new UniverseRenderingBootstrap(Renderer, performance);

    const runtime = bootstrap.create(container, 'high');
    const renderer = instances[0]!;

    expect(renderer.options).toMatchObject({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    expect(renderer.domElement.className).toBe('universe-canvas');
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(getPhotographicProfile(0, 'high').exposure);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(container.contains(renderer.domElement)).toBe(true);
    expect(performance.resetAdaptivePixelRatio).toHaveBeenCalledWith('high');
    expect(runtime.renderer).toBe(renderer);
    expect(runtime.pixelRatio).toBe(1.25);
    expect(runtime.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(runtime.camera.fov).toBe(48);
    expect(runtime.camera.near).toBe(0.025);
    expect(runtime.camera.far).toBe(CAMERA_FAR_DISTANCE);
    expect(runtime.camera.position.toArray()).toEqual([39, 8, 20]);
    expect(runtime.lensingPass).toBeInstanceOf(BlackHoleLensingPass);

    runtime.lensingPass.dispose();
  });
});

interface FakeRenderer {
  readonly options: THREE.WebGLRendererParameters;
  readonly domElement: HTMLCanvasElement;
  readonly setPixelRatio: ReturnType<typeof vi.fn>;
  outputColorSpace: string;
  toneMapping: number;
  toneMappingExposure: number;
}
