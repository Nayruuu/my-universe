import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createGalaxyVolumeVisual, getGalaxyParticleBudget } from './galaxy-volume-visual';

describe('galaxy volume visual', () => {
  it.each([
    ['low', 360],
    ['medium', 900],
    ['high', 2_200],
  ] as const)('adapte le budget de particules à la qualité %s', (quality, expected) => {
    expect(getGalaxyParticleBudget(quality)).toBe(expected);
  });

  it.each([
    ['spiral', 0],
    ['elliptical', 1],
    ['irregular', 2],
  ] as const)('crée une morphologie volumique %s identifiable', (shape, profileIndex) => {
    const visual = createGalaxyVolumeVisual(createGalaxy(shape), 'medium');
    const disk = visual.root.getObjectByName(`test-${shape}-galaxy-structured-disk`);
    const stars = visual.root.getObjectByName(`test-${shape}-galaxy-stellar-volume`);

    expect(visual.root.name).toBe(`test-${shape}-galaxy-near-volume`);
    expect(visual.root.scale.toArray()).toEqual([12, 12, 12]);
    expect(visual.root.rotation.x).toBeGreaterThan(0);
    expect(visual.root.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(35));
    expect(disk).toBeInstanceOf(THREE.Mesh);
    expect(stars).toBeInstanceOf(THREE.Points);
    expect(visual.materials).toHaveLength(2);
    expect(visual.pickables).toEqual([disk]);

    if (!(disk instanceof THREE.Mesh) || !(disk.material instanceof THREE.ShaderMaterial)) {
      throw new Error('Disque galactique structuré absent.');
    }
    if (!(stars instanceof THREE.Points) || !(stars.material instanceof THREE.ShaderMaterial)) {
      throw new Error('Volume stellaire galactique absent.');
    }

    expect(disk.material.uniforms['morphology']!.value).toBe(profileIndex);
    expect(disk.material.fragmentShader).toContain('spiralDensity');
    expect(disk.material.fragmentShader).toContain('dustLane');
    expect(disk.material.fragmentShader).toContain('irregularBody');
    expect(disk.material.fragmentShader).toContain('vInteriorFade');
    expect(disk.material.fragmentShader).toContain('layerOpacity');
    expect(disk.material.blending).toBe(THREE.NormalBlending);
    expect(disk.userData['visualStyle']).toBe('procedural-structured-galaxy-disk');
    expect(stars.geometry.getAttribute('position').count).toBe(900);
    expect(stars.geometry.getAttribute('color').count).toBe(900);
    expect(stars.geometry.getAttribute('pointSize').count).toBe(900);
    expect(stars.material.fragmentShader).toContain('stellarCore');
    expect(stars.userData['visualStyle']).toBe('volumetric-galaxy-star-field');
    expect(disk.layers.mask & (1 << PICKING_LAYER)).not.toBe(0);

    disposeVisual(visual.root);
  });

  it('génère une structure stable par identifiant sans cloner toutes les galaxies', () => {
    const first = createGalaxyVolumeVisual(createGalaxy('spiral'), 'low');
    const second = createGalaxyVolumeVisual(createGalaxy('spiral'), 'low');
    const other = createGalaxyVolumeVisual(
      { ...createGalaxy('spiral'), id: 'another-galaxy' },
      'low',
    );
    const firstPositions = positions(first.root);
    const secondPositions = positions(second.root);
    const otherPositions = positions(other.root);

    expect(firstPositions).toEqual(secondPositions);
    expect(firstPositions).not.toEqual(otherPositions);

    disposeVisual(first.root);
    disposeVisual(second.root);
    disposeVisual(other.root);
  });

  it('applique des valeurs sûres lorsque la morphologie visuelle est incomplète', () => {
    const galaxy = createGalaxy('elliptical');

    galaxy.visual = {
      visualRadius: 4,
      scaleMode: 'adaptive',
    };
    const visual = createGalaxyVolumeVisual(galaxy, 'high');

    expect(visual.root.scale.toArray()).toEqual([4, 4, 4]);
    expect(visual.root.rotation.x).toBeGreaterThan(0);
    expect(visual.root.rotation.z).toBe(0);
    expect(positions(visual.root)).toHaveLength(2_200 * 3);
    disposeVisual(visual.root);
  });

  it('dimensionne une galaxie naine avec son rayon de demi-lumière documenté', () => {
    const galaxy = createGalaxy('elliptical');

    galaxy.metadata = { halfLightRadiusPc: 221 };
    const visual = createGalaxyVolumeVisual(galaxy, 'low');

    expect(visual.root.scale.toArray()).toEqual([2.21, 2.21, 2.21]);
    expect(visual.root.userData['renderDiameter']).toBeCloseTo(4.42, 6);
    expect(visual.root.userData['diameterTreatment']).toBe('documented-half-light-diameter');
    disposeVisual(visual.root);
  });
});

function createGalaxy(shape: 'spiral' | 'elliptical' | 'irregular'): SpaceObject {
  return {
    id: `test-${shape}`,
    name: `Test ${shape}`,
    type: 'galaxy',
    referenceFrame: 'local-group',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 12,
      scaleMode: 'adaptive',
      color: '#a9c8ef',
      secondaryColor: '#efc98e',
      galaxyShape: shape,
      galaxyAxisRatio: 0.42,
      galaxyRotationDegrees: 35,
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'kiloparsec',
    },
  };
}

function positions(root: THREE.Group): number[] {
  const points = root.getObjectByName(`${root.name.replace('-near-volume', '')}-stellar-volume`);

  if (!(points instanceof THREE.Points)) {
    throw new Error('Volume stellaire absent.');
  }

  return Array.from(points.geometry.getAttribute('position').array);
}

function disposeVisual(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
}
