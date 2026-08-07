import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { getPlanetaryVisualProfile } from './planetary-visual-profile';
import {
  createBodyTexture,
  createEarthLayerTexture,
  createLunarReliefTexture,
  createStaticTexture,
  DEFERRED_TEXTURE_SOURCE,
} from './planetary-textures';

describe('planetary textures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['low', 1],
    ['medium', 2],
    ['high', 4],
  ] as const)('prépare une texture statique différée en qualité %s', (quality, anisotropy) => {
    const texture = createStaticTexture('textures/test.jpg', quality);
    const image = texture.image as HTMLImageElement;
    const initialVersion = texture.version;

    expect(image.getAttribute('src')).toBeNull();
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.anisotropy).toBe(anisotropy);
    expect(texture.userData[DEFERRED_TEXTURE_SOURCE]).toBe('textures/test.jpg');
    image.onload?.(new Event('load'));
    expect(texture.version).toBe(initialVersion + 1);
    texture.dispose();
  });

  it('aligne les couches terrestres et le relief lunaire dans le repère du corps', () => {
    const profile = getPlanetaryVisualProfile('high');
    const earth = createEarthLayerTexture('clouds', profile, 'high');
    const relief = createLunarReliefTexture('high');

    expect(earth.userData[DEFERRED_TEXTURE_SOURCE]).toBe('textures/earth-clouds-2048.jpg');
    expect(earth.wrapS).toBe(THREE.RepeatWrapping);
    expect(earth.userData['longitudeConvention']).toBe('east-positive');
    expect(relief.colorSpace).toBe(THREE.NoColorSpace);
    expect(relief.userData['visualStyle']).toBe('observed-lola-elevation');
    expect(relief.userData['scientificConfidence']).toBe('observed');
    earth.dispose();
    relief.dispose();
  });

  it('désactive les textures rocheuses coûteuses en qualité faible', () => {
    expect(createBodyTexture(createPlanet('moon'), 'low')).toBeUndefined();
    expect(createBodyTexture(createPlanet('mars'), 'low')).toBeUndefined();
    expect(createBodyTexture(createPlanet('venus'), 'low')).toBeUndefined();
  });

  it('signale le corps concerné lorsque la génération procédurale est impossible', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => createBodyTexture(createPlanet('saturn'), 'high')).toThrow('texture de saturn');
  });
});

function createPlanet(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      color: '#d7c193',
      secondaryColor: '#9b835f',
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
