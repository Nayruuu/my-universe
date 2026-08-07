import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { getPlanetaryVisualProfile } from './planetary-visual-profile';
import {
  createBodyTexture,
  createEarthLayerTexture,
  createLunarReliefTexture,
  createStaticTexture,
  DEFERRED_PROCEDURAL_TEXTURE_FACTORY,
  DEFERRED_TEXTURE_SOURCE,
} from './planetary-textures';

describe('planetary textures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['low', 1],
    ['medium', 4],
    ['high', 8],
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
    expect(createBodyTexture(createPlanet('enceladus'), 'low')).toBeUndefined();
  });

  it.each([
    ['enceladus', 'textures/enceladus-jpl-voyager-1440.jpg', 'Voyager'],
    ['titan', 'textures/titan-cassini-1024.jpg', 'Cassini ISS'],
    ['pluto', 'textures/pluto-new-horizons-1024.jpg', 'New Horizons'],
    ['ceres', 'textures/ceres-dawn-1024.jpg', 'Dawn'],
  ] as const)('prépare la mosaïque observée de %s', (id, source, mission) => {
    const texture = createBodyTexture(createPlanet(id), 'high')!;

    expect(texture.userData[DEFERRED_TEXTURE_SOURCE]).toBe(source);
    expect(texture.userData['scientificConfidence']).toBe('observed');
    expect(texture.userData['mission']).toBe(mission);
    expect(texture.userData['longitudeConvention']).toBe('east-positive');
    expect(texture.userData['bodyFixedAlignment']).toBe('source-cartographic-grid');
    texture.dispose();
  });

  it('conserve un rendu procédural clairement identifié pour un corps non cartographié', () => {
    const texture = createBodyTexture(createPlanet('eris'), 'medium')!;

    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture.userData['visualStyle']).toBe('procedural-planetary-surface');
    expect(texture.userData['scientificConfidence']).toBe('procedural');
    texture.dispose();
  });

  it.each([
    ['saturn', 'textures/saturn-nasa-vtad-2048.jpg', 'cubemap-to-equirectangular'],
    ['uranus', 'textures/uranus-nasa-vtad-1024.jpg', 'source-equirectangular'],
    ['neptune', 'textures/neptune-nasa-vtad-1024.jpg', 'source-equirectangular'],
  ] as const)(
    'prépare l’atlas atmosphérique représentatif de %s',
    (id, source, projectionTreatment) => {
      const texture = createBodyTexture(createPlanet(id), 'high')!;

      expect(texture).not.toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData[DEFERRED_TEXTURE_SOURCE]).toBe(source);
      expect(texture.userData['visualStyle']).toBe('illustrative-nasa-vtad-atmosphere-map');
      expect(texture.userData['scientificConfidence']).toBe('illustrative');
      expect(texture.userData['projectionTreatment']).toBe(projectionTreatment);
      expect(texture.userData['bodyFixedAlignment']).toBe('illustrative-source-epoch');
      expect(texture.userData['sourceUrl']).toMatch(/^https:\/\/science\.nasa\.gov/u);
      texture.dispose();
    },
  );

  it.each(['jupiter', 'saturn', 'uranus', 'neptune'])(
    'conserve l’image atmosphérique différée de %s en qualité faible',
    (id) => {
      const texture = createBodyTexture(createPlanet(id), 'low')!;

      expect(texture.userData[DEFERRED_TEXTURE_SOURCE]).toMatch(/^textures\//u);
      texture.dispose();
    },
  );

  it('diffère la génération procédurale coûteuse jusqu’au LOD proche', () => {
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const texture = createBodyTexture(createPlanet('eris'), 'high') as THREE.CanvasTexture;

    expect(contextSpy).not.toHaveBeenCalled();
    expect(texture.image.width).toBe(1);
    expect(texture.image.height).toBe(1);
    expect(typeof texture.userData[DEFERRED_PROCEDURAL_TEXTURE_FACTORY]).toBe('function');
    expect(texture.userData['visualStyle']).toBe('procedural-planetary-surface');
    texture.dispose();
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
