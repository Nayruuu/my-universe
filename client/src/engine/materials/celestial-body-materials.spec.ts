import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { DEFERRED_PROCEDURAL_TEXTURE_FACTORY, DEFERRED_TEXTURE_SOURCE } from './planetary-textures';
import { manageMaterial } from './celestial-visual-types';
import {
  collectDeferredTextures,
  createAtmosphereMaterial,
  createCelestialBodyMaterial,
  createGlowMaterial,
  createPlanetaryRingMaterial,
} from './celestial-body-materials';

describe('celestial body materials', () => {
  it('configure la photosphère selon la qualité et la radiance de l’étoile', () => {
    const star = createObject('sirius', 'star');

    star.physical = { spectralType: 'A1V', temperatureK: 9_940 };
    star.visual.emissiveIntensity = 1.7;
    const material = createCelestialBodyMaterial(star, 'high') as THREE.ShaderMaterial;

    expect(material.uniforms['granulationStrength']?.value).toBeCloseTo(0.28);
    expect(material.uniforms['surfaceRadiance']?.value).toBeCloseTo(1.7);
    expect(material.userData['visualStyle']).toBe('procedural-stellar-photosphere');
    material.dispose();
  });

  it('synchronise l’opacité du shader atmosphérique avec le LOD', () => {
    const material = createAtmosphereMaterial('#5ca9e6', 0.72);

    expect(material.userData['visualStyle']).toBe('fresnel-atmospheric-scattering');
    material.opacity = 0.21;
    (material.onBeforeRender as () => void)();
    expect(material.uniforms['layerOpacity']?.value).toBeCloseTo(0.21);
    expect(material.uniforms['intensity']?.value).toBeCloseTo(0.72);
    material.dispose();
  });

  it('conserve les anneaux de Saturne en chargement différé', () => {
    const material = createPlanetaryRingMaterial(createObject('saturn', 'planet'), 'medium');

    expect(material.map?.userData[DEFERRED_TEXTURE_SOURCE]).toBe('textures/saturn-rings.svg');
    expect(material.emissiveMap).toBe(material.map);
    expect(material.opacity).toBeCloseTo(0.92);
    material.map?.dispose();
    material.dispose();
  });

  it('teinte les mosaïques monochromes pour éviter un hémisphère surexposé', () => {
    const mercury = createObject('mercury', 'planet');

    mercury.visual.color = '#aaa39a';
    const material = createCelestialBodyMaterial(mercury, 'medium') as THREE.MeshStandardMaterial;

    expect(material.map?.userData['colorTreatment']).toBe('grayscale');
    expect(material.color.getHexString()).toBe('aaa39a');
    material.map?.dispose();
    material.dispose();
  });

  it('déduplique les textures différées référencées par plusieurs propriétés', () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const proceduralTexture = new THREE.Texture();
    const ignored = new THREE.Texture();

    texture.userData[DEFERRED_TEXTURE_SOURCE] = 'textures/shared.jpg';
    proceduralTexture.userData[DEFERRED_PROCEDURAL_TEXTURE_FACTORY] = () =>
      document.createElement('canvas');
    const material = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture });
    const ignoredMaterial = new THREE.MeshBasicMaterial({
      map: ignored,
      alphaMap: proceduralTexture,
    });

    expect(
      collectDeferredTextures([manageMaterial(material), manageMaterial(ignoredMaterial)]),
    ).toEqual([texture, proceduralTexture]);
    texture.dispose();
    proceduralTexture.dispose();
    ignored.dispose();
    material.dispose();
    ignoredMaterial.dispose();
  });

  it('crée un halo photographique transparent à partir de la texture partagée', () => {
    const texture = new THREE.Texture();
    const material = createGlowMaterial('#fff5dc', 0.48, texture);

    expect(material.map).toBe(texture);
    expect(material.opacity).toBeCloseTo(0.48);
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.userData['photographicGlow']).toBe(true);
    material.dispose();
    texture.dispose();
  });
});

function createObject(id: string, type: 'star' | 'planet'): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'star' ? 'stellar' : 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      color: type === 'star' ? '#e8f3ff' : '#d7c193',
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: type === 'star' ? 'light-year' : 'astronomical-unit',
    },
  };
}
