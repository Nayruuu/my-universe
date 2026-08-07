import * as THREE from 'three';
import type { GalaxyVisualShape, SpaceObject } from '../../data/models/universe.models';
import { disposeObjectRegistryTree } from '../objects/object-registry-disposer';
import { createGalaxyVolumeVisual, getGalaxyParticleBudget } from './galaxy-volume-visual';

describe('galaxy volume visual', () => {
  it.each([
    ['low', 16_384],
    ['medium', 65_536],
    ['high', 131_072],
  ] as const)('borne le budget progressif à la qualité %s', (quality, expected) => {
    const visual = createGalaxyVolumeVisual(createGalaxy('spiral'), quality);
    const grains = points(visual.root);

    expect(getGalaxyParticleBudget(quality)).toBe(expected);
    expect(grains.geometry.getAttribute('position').count).toBe(1_024);
    visual.updateDetail(10_000, 12, Infinity);
    expect(grains.geometry.getAttribute('position').count).toBe(expected);
    expect(grains.geometry.drawRange.count).toBe(expected);
    disposeObjectRegistryTree(visual.root);
  });

  it.each(['spiral', 'elliptical', 'irregular'] as const)(
    'crée une morphologie %s volumique sans disque ni image',
    (shape) => {
      const visual = createGalaxyVolumeVisual(createGalaxy(shape), 'medium');
      const grains = points(visual.root);
      const positions = grains.geometry.getAttribute('position');

      expect(visual.root.name).toBe(`test-${shape}-galaxy-near-volume`);
      expect(visual.root.children).toEqual([grains]);
      expect(visual.root.scale.toArray()).toEqual([12, 12, 12]);
      expect(visual.root.rotation.x).toBeCloseTo(Math.acos(0.42));
      expect(visual.root.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(35));
      expect(visual.materials).toEqual([grains.material]);
      expect(grains.userData).toMatchObject({
        morphology: shape,
        visualStyle: 'continuous-galaxy-grain-volume',
        scientificConfidence: 'illustrative',
        appearanceConfidence: 'illustrative',
        sourceTreatment: 'seeded-density-samples-not-individual-observed-stars',
      });
      expect(positions.count).toBe(1_024);
      for (const name of ['color', 'pointSize', 'pointAlpha', 'sampleIndex']) {
        expect(grains.geometry.getAttribute(name).count).toBe(positions.count);
      }
      let positiveDepth = 0;
      let negativeDepth = 0;

      for (let index = 0; index < positions.count; index += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, index);

        expect(point.length()).toBeLessThan(1.1);
        positiveDepth += Number(point.z > 0.005);
        negativeDepth += Number(point.z < -0.005);
      }
      expect(positiveDepth).toBeGreaterThan(100);
      expect(negativeDepth).toBeGreaterThan(100);
      expect(grains.material.vertexShader).toContain('length(viewPosition.xyz) / worldScale');
      expect(grains.material.vertexShader).toContain('float coverage');
      expect(grains.material.vertexShader).toContain('sampleWeight');
      expect(grains.material.vertexShader).toContain('densityCompensation');
      expect(grains.material.vertexShader).toContain('gl_PointSize = rasterDiameter');
      expect(grains.material.fragmentShader).toContain('exp(-radiusSquared * 5.0)');
      expect(grains.material.depthWrite).toBe(false);
      expect(grains.material.blending).toBe(THREE.AdditiveBlending);
      expect(grains.material.userData['visualStyle']).toBe('continuous-galaxy-grain-volume');
      disposeObjectRegistryTree(visual.root);
    },
  );

  it('conserve positions, couleurs et tailles entre les budgets, les qualités et les visites', () => {
    const first = createGalaxyVolumeVisual(createGalaxy('spiral'), 'low');
    const second = createGalaxyVolumeVisual(createGalaxy('spiral'), 'high');
    const other = createGalaxyVolumeVisual(
      { ...createGalaxy('spiral'), id: 'another-galaxy' },
      'low',
    );
    const original = points(first.root).geometry;

    first.updateDetail(100, 12, Infinity);
    second.updateDetail(100, 12, Infinity);
    for (const name of ['position', 'color', 'pointSize', 'pointAlpha', 'sampleIndex']) {
      const initial = Array.from(original.getAttribute(name).array);
      const low = Array.from(points(first.root).geometry.getAttribute(name).array);
      const high = Array.from(points(second.root).geometry.getAttribute(name).array);

      expect(low.slice(0, initial.length)).toEqual(initial);
      expect(high.slice(0, low.length)).toEqual(low);
    }
    expect(Array.from(points(other.root).geometry.getAttribute('position').array)).not.toEqual(
      Array.from(original.getAttribute('position').array),
    );
    for (const visual of [first, second, other]) {
      disposeObjectRegistryTree(visual.root);
    }
  });

  it('fait apparaître le détail progressivement et libère les buffers remplacés avec hystérésis', () => {
    const visual = createGalaxyVolumeVisual(createGalaxy('spiral'), 'high');
    const grains = points(visual.root);
    const original = grains.geometry;
    const releaseOriginal = vi.spyOn(original, 'dispose');

    visual.updateDetail(100, 12, -1);
    expect(grains.geometry).toBe(original);
    visual.updateDetail(100, 12, 1 / 60);
    expect(grains.material.uniforms['activeCount']!.value).toBeGreaterThan(1_024);
    expect(grains.material.uniforms['activeCount']!.value).toBeLessThan(40_000);
    expect(releaseOriginal).toHaveBeenCalledOnce();
    visual.updateDetail(100, 12, Infinity);
    const detailed = grains.geometry;
    const releaseDetailed = vi.spyOn(detailed, 'dispose');

    expect(detailed.getAttribute('position').count).toBe(65_536);
    expect(detailed.drawRange.count).toBe(40_000);
    visual.updateDetail(64, 12, Infinity);
    expect(grains.geometry).toBe(detailed);
    visual.updateDetail(0, 20, Infinity);
    expect(releaseDetailed).toHaveBeenCalledOnce();
    expect(grains.geometry.getAttribute('position').count).toBe(1_024);
    expect(grains.geometry.drawRange.count).toBe(1_024);
    expect(visual.root.scale.toArray()).toEqual([20, 20, 20]);
    const releaseFinal = vi.spyOn(grains.geometry, 'dispose');
    const releaseMaterial = vi.spyOn(grains.material, 'dispose');

    disposeObjectRegistryTree(visual.root);
    expect(releaseFinal).toHaveBeenCalledOnce();
    expect(releaseMaterial).toHaveBeenCalledOnce();
  });

  it('actualise le raster depuis le vrai viewport sans reconstruire le nuage pendant le rendu', () => {
    const visual = createGalaxyVolumeVisual(createGalaxy('spiral'), 'low');
    const grains = points(visual.root);
    const geometry = grains.geometry;
    const renderer = {
      getCurrentViewport: vi.fn((viewport: THREE.Vector4) => viewport.set(0, 0, 2_880, 1_800)),
      getPixelRatio: vi.fn(() => 3),
    };

    grains.onBeforeRender(
      renderer as unknown as THREE.WebGLRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      grains.geometry,
      grains.material,
      null!,
    );
    expect(grains.material.uniforms['viewportHeight']!.value).toBe(1_800);
    expect(grains.material.uniforms['pixelRatio']!.value).toBe(2);
    renderer.getPixelRatio.mockReturnValue(1);
    grains.onBeforeRender(
      renderer as unknown as THREE.WebGLRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      grains.geometry,
      grains.material,
      null!,
    );
    expect(grains.material.uniforms['pixelRatio']!.value).toBe(1);
    expect(grains.geometry).toBe(geometry);
    disposeObjectRegistryTree(visual.root);
  });

  it('garde le centre spiralé plus chaud que les bras sans couleurs aléatoires saturées', () => {
    const visual = createGalaxyVolumeVisual(createGalaxy('spiral'), 'low');
    const geometry = points(visual.root).geometry;
    const positions = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    const core: number[] = [];
    const disk: number[] = [];

    for (let index = 0; index < positions.count; index += 1) {
      const radius = new THREE.Vector3().fromBufferAttribute(positions, index).length();
      const warmth = colors.getX(index) / colors.getZ(index);

      if (radius < 0.15) {
        core.push(warmth);
      }
      if (radius > 0.6) {
        disk.push(warmth);
      }
    }
    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(mean(core)).toBeGreaterThan(mean(disk) * 1.5);
    disposeObjectRegistryTree(visual.root);
  });

  it('applique les valeurs visuelles par défaut sans inventer de diamètre observé', () => {
    const galaxy = createGalaxy('elliptical');

    galaxy.visual = { visualRadius: 4, scaleMode: 'adaptive' };
    const visual = createGalaxyVolumeVisual(galaxy, 'high');

    expect(visual.root.scale.toArray()).toEqual([4, 4, 4]);
    expect(visual.root.rotation.x).toBeCloseTo(Math.acos(0.72));
    expect(visual.root.rotation.z).toBe(0);
    expect(points(visual.root).userData['morphology']).toBe('elliptical');
    disposeObjectRegistryTree(visual.root);
  });

  it('dimensionne une galaxie naine avec son rayon de demi-lumière documenté', () => {
    const galaxy = createGalaxy('elliptical');

    galaxy.metadata = { halfLightRadiusPc: 221 };
    const visual = createGalaxyVolumeVisual(galaxy, 'low');

    expect(visual.root.scale.toArray()).toEqual([2.21, 2.21, 2.21]);
    expect(visual.root.userData['renderDiameter']).toBeCloseTo(4.42, 6);
    expect(visual.root.userData['diameterTreatment']).toBe('documented-half-light-diameter');
    disposeObjectRegistryTree(visual.root);
  });
});

function createGalaxy(shape: GalaxyVisualShape): SpaceObject {
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
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'kiloparsec' },
  };
}

function points(root: THREE.Group): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  return root.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
}
