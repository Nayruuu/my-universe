import * as THREE from 'three';
import { getMilkyWayDustSampleCount, MilkyWayDustField } from './milky-way-dust-field';

describe('MilkyWayDustField', () => {
  it('dépose la densité de la galaxie affichée, sans inventer un catalogue ou un ciel uniforme', () => {
    const source = new THREE.BufferAttribute(new Float32Array(300), 3);
    const field = new MilkyWayDustField(source);
    const { geometry, material, userData } = field.points;
    const texture = material.uniforms['densityTexture']!.value as THREE.Data3DTexture;
    const data = texture.image.data as Uint8Array;
    const center = 40 + 80 * (20 + 40 * 40);

    expect(texture.image.width).toBe(80);
    expect(texture.image.height).toBe(40);
    expect(texture.image.depth).toBe(80);
    expect(texture.format).toBe(THREE.RedFormat);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.generateMipmaps).toBe(false);
    expect(data[center]).toBe(255);
    expect(data[center + 1]).toBe(232);
    expect(data[center + 80]).toBe(232);
    expect(data[center + 3_200]).toBe(232);
    expect(data.filter((value) => value !== 0)).toHaveLength(7);
    expect(geometry.getAttribute('position').count).toBe(221_184);
    expect(field.points.frustumCulled).toBe(false);
    expect(field.points.visible).toBe(false);
    expect(material.glslVersion).toBe(THREE.GLSL3);
    expect(material.depthWrite).toBe(false);
    expect(material.vertexShader).toContain('floor(observerLocal / cellSize)');
    expect(material.vertexShader).toContain('(cell + seed) * cellSize');
    expect(material.vertexShader).toContain('texture(densityTexture, uvw).r * boundary');
    expect(material.vertexShader).toContain('smoothstep(8.0, 10.0, distanceInCells)');
    expect(material.vertexShader).toContain('3.5 * pixelRatio');
    expect(material.vertexShader).toContain('uniform float coarseDetailPresence');
    expect(material.vertexShader).toContain(
      'dustAlpha *= mix(1.0, coarseDetailPresence, coarseLayer)',
    );
    expect(material.vertexShader).not.toContain('cameraDistance');
    expect(material.vertexShader).not.toContain('time');
    expect(userData).toMatchObject({
      scientificConfidence: 'illustrative',
      catalogAssociation: 'none',
      densitySource: 'illustrative-milky-way-point-positions',
      motionModel: 'fixed-galactic-cell-addresses-with-perspective-parallax',
      streamingTreatment: 'cell-replacement-outside-zero-opacity-support',
      resolutionLevels: 3,
      distanceAdaptiveSampleBudget: 'fixed-prefix-samples-preserving-cell-addresses',
      cellSizes: [16, 64, 256],
    });
    field.dispose();
  });

  it('borne le dépôt aux cellules valides et conserve les trous du modèle source', () => {
    const source = new THREE.BufferAttribute(
      new Float32Array([-100_000, -100_000, -100_000, 100_000, 100_000, 100_000]),
      3,
    );
    const field = new MilkyWayDustField(source);
    const texture = field.points.material.uniforms['densityTexture']!.value as THREE.Data3DTexture;
    const data = texture.image.data as Uint8Array;

    expect(data[1 + 80 * (1 + 40)]).toBe(23);
    expect(data[78 + 80 * (38 + 40 * 78)]).toBe(23);
    expect(data[40 + 80 * (20 + 40 * 40)]).toBe(0);
    expect(data.filter((value) => value !== 0)).toHaveLength(14);
    field.dispose();
  });

  it('conserve tous les niveaux et les mêmes cellules à chaque qualité', () => {
    const field = createField();
    const geometry = field.points.geometry;
    const positions = geometry.getAttribute('position');
    const levels = geometry.getAttribute('detailLevel');
    const seeds = geometry.getAttribute('sampleSeed');

    for (const [quality, count, weight] of [
      ['low', 55_296, 2],
      ['medium', 110_592, Math.sqrt(2)],
      ['high', 221_184, 1],
    ] as const) {
      field.setQuality(quality);
      expect(geometry.drawRange.count).toBe(count);
      expect(field.points.material.uniforms['sampleWeight']!.value).toBeCloseTo(weight, 8);
      expect(geometry.getAttribute('position')).toBe(positions);
      expect(Array.from(levels.array.slice(0, 4))).toEqual([0, 1, 2, 3]);
      expect(positions.getX(count - 1)).toBe(23);
      expect(positions.getY(count - 1)).toBe(23);
      expect(positions.getZ(count - 1)).toBe(23);
      expect(seeds.getX(count - 1)).toBe(count / 55_296 - 1);
    }
    field.setPixelRatio(4);
    expect(field.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    field.setPixelRatio(0.1);
    expect(field.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    const renderer = {
      getCurrentViewport: (target: THREE.Vector4) => target.set(0, 0, 2_160, 1_350),
    } as THREE.WebGLRenderer;

    field.points.onBeforeRender(
      renderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      geometry,
      field.points.material,
      new THREE.Group(),
    );
    expect(field.points.material.uniforms['viewportHeight']!.value).toBe(1_350);
    field.dispose();
  });

  it('réduit seulement les suréchantillons indiscernables du nuage lointain', () => {
    const field = createField();
    const geometry = field.points.geometry;

    expect(getMilkyWayDustSampleCount('high', 12_000)).toBe(4);
    expect(getMilkyWayDustSampleCount('high', 12_001)).toBe(2);
    expect(getMilkyWayDustSampleCount('high', 24_001)).toBe(1);
    expect(getMilkyWayDustSampleCount('medium', 24_001)).toBe(1);
    expect(getMilkyWayDustSampleCount('low', Number.POSITIVE_INFINITY)).toBe(1);

    field.setQuality('high');
    field.update(0.96, 2, new THREE.Vector3(), 1, 12_001);
    expect(geometry.drawRange.count).toBe(110_592);
    expect(field.points.material.uniforms['sampleWeight']!.value).toBeCloseTo(Math.sqrt(2), 8);

    field.update(0.96, 2, new THREE.Vector3(), 1, 24_001);
    expect(geometry.drawRange.count).toBe(55_296);
    expect(field.points.material.uniforms['sampleWeight']!.value).toBe(2);
    field.dispose();
  });

  it('résout la position dans le repère galactique sans suivre la rotation ni déplacer les grains', () => {
    const field = createField();
    const root = new THREE.Group();
    const observer = new THREE.Vector3(80, -5, 40);
    const positions = field.points.geometry.getAttribute('position');
    const before = positions.array.slice();

    root.position.set(-1_600, 100, -400);
    root.add(field.points);
    field.update(0.96, 2, observer);
    expect(field.points.position.toArray()).toEqual([0, 0, 0]);
    expect(field.points.scale.toArray()).toEqual([2, 2, 2]);
    expect(field.points.visible).toBe(true);
    expect(
      (field.points.material.uniforms['observerLocal']!.value as THREE.Vector3).toArray(),
    ).toEqual([840, -52.5, 220]);
    expect(observer.toArray()).toEqual([80, -5, 40]);

    for (const distance of [400, 250, 125, 250, 400]) {
      field.update(0.96, 2, { x: distance, y: -5, z: 40 });
      expect(positions.array.every((value, index) => value === before[index])).toBe(true);
      expect(field.points.position.toArray()).toEqual([0, 0, 0]);
      expect(field.points.material.uniforms['opacity']!.value).toBe(0.96);
    }
    field.update(0, 2, observer);
    expect(field.points.visible).toBe(false);
    field.update(0.96, 2);
    expect(field.points.visible).toBe(false);
    field.update(0.96, 2, observer, 0.25);
    expect(field.points.material.uniforms['coarseDetailPresence']!.value).toBe(0.25);
    field.update(0.96, 2, observer, 4);
    expect(field.points.material.uniforms['coarseDetailPresence']!.value).toBe(1);
    field.dispose();
  });

  it('partage seulement la densité CPU et libère ses propres ressources GPU', () => {
    const source = new THREE.BufferAttribute(new Float32Array([100, 200, 300]), 3);
    const first = new MilkyWayDustField(source);
    const second = new MilkyWayDustField(source);
    const firstTexture = first.points.material.uniforms['densityTexture']!
      .value as THREE.Data3DTexture;
    const secondTexture = second.points.material.uniforms['densityTexture']!
      .value as THREE.Data3DTexture;
    const root = new THREE.Group();
    const disposed = { geometry: 0, material: 0, texture: 0, second: 0 };

    root.add(first.points, second.points);
    expect(firstTexture).not.toBe(secondTexture);
    expect(firstTexture.image.data).toBe(secondTexture.image.data);
    expect(first.points.geometry).not.toBe(second.points.geometry);
    first.points.geometry.addEventListener('dispose', () => {
      disposed.geometry += 1;
    });
    first.points.material.addEventListener('dispose', () => {
      disposed.material += 1;
    });
    firstTexture.addEventListener('dispose', () => {
      disposed.texture += 1;
    });
    secondTexture.addEventListener('dispose', () => {
      disposed.second += 1;
    });
    first.dispose();
    expect(root.children).toEqual([second.points]);
    expect(disposed).toEqual({ geometry: 1, material: 1, texture: 1, second: 0 });
    second.dispose();
    expect(disposed.second).toBe(1);
  });
});

function createField(): MilkyWayDustField {
  return new MilkyWayDustField(new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
}
