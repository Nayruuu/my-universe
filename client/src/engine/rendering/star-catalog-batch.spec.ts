import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { StarCatalog } from '../loaders/star-catalog';
import { colorIndexToRgb } from '../materials/star-color';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { StarCatalogBatch } from './star-catalog-batch';

describe('StarCatalogBatch', () => {
  it('convertit le repère équatorial HYG vers le plan galactique Three.js', () => {
    const batch = createBatch(1);
    const position = batch.points.geometry.getAttribute('position') as THREE.BufferAttribute;

    expect(position.getX(0)).toBeGreaterThan(0);
    expect(position.getY(0)).toBeGreaterThan(0);
    expect(position.getZ(0)).toBeGreaterThan(0);
    expect(batch.points.userData['scientificConfidence']).toBe('observed');
    expect(batch.points.userData['pickingPriority']).toBeGreaterThan(0);
    expect(batch.selectionPoint.userData['pickingPriority']).toBeGreaterThan(
      batch.points.userData['pickingPriority'] as number,
    );
    expect(batch.visibleCount).toBe(0);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.dispose();
  });

  it('garde le batch visible aux échelles stellaires et permet une limite explicite', () => {
    const batch = createBatch(6_000);

    batch.setDrawLimit(2_000);
    batch.setPixelRatio(1.5);
    batch.updateLod(2, 1);

    expect(batch.points.geometry.drawRange.count).toBe(2_000);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(batch.visibleCount).toBe(2_000);
    expect(
      (batch.points.userData['visibleIndices'] as Uint8Array).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(2_000);

    batch.setDrawLimit(10_000);
    expect(batch.points.geometry.drawRange.count).toBe(6_000);

    batch.updateLod(0, 2);
    batch.updateLod(0, 0.1);
    batch.updateLod(4, 0.1);
    expect(batch.visibleCount).toBe(6_000);
    expect(
      (batch.points.userData['visibleIndices'] as Uint8Array).every((value) => value === 1),
    ).toBe(true);
    batch.setDrawLimit(-2);
    expect(batch.visibleCount).toBe(0);
    batch.setDrawLimit(2.9);
    expect(batch.points.geometry.drawRange.count).toBe(2);
    batch.setPixelRatio(0.1);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    batch.dispose();
  });

  it('retire le catalogue exact avant la représentation galactique', () => {
    const batch = createBatch(6_000);

    batch.updateLod(3, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.material.uniforms['catalogOpacity']!.value).toBeLessThan(0.004);

    batch.updateLod(4, 10);

    expect(batch.visibleCount).toBe(0);
    expect(
      (batch.points.userData['visibleIndices'] as Uint8Array).every((value) => value === 0),
    ).toBe(true);

    batch.updateLod(5, 10);
    expect(batch.visibleCount).toBe(0);

    batch.updateLod(99, 10);
    expect(batch.visibleCount).toBe(0);

    batch.select('hyg-6000');
    expect(batch.activeDetail.visible).toBe(true);
    batch.dispose();
  });

  it('rend les étoiles brillantes plus grandes et chaudes ou froides selon B−V', () => {
    const batch = createBatch(2);
    const sizes = batch.points.geometry.getAttribute('pointSize') as THREE.BufferAttribute;
    const blue = colorIndexToRgb(-0.2);
    const red = colorIndexToRgb(1.7);

    expect(sizes.getX(0)).toBeGreaterThan(sizes.getX(1));
    expect(sizes.getX(0)).toBeGreaterThan(8);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red[0]).toBeGreaterThan(red[2]);
    expect(batch.points.material.uniforms['diffractionStrength']!.value).toBeGreaterThan(0);
    expect(batch.points.userData['visualStyle']).toBe('photographic-temperature-and-diffraction');
    batch.dispose();
  });

  it('adapte la radiance photographique sans changer le nombre de draw calls', () => {
    const batch = createBatch(2);

    batch.setPhotographicRadiance(1.18);
    expect(batch.points.material.uniforms['radiance']!.value).toBeCloseTo(1.18);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);
    expect(batch.root.children).toHaveLength(3);
    batch.dispose();
  });

  it('réutilise un unique marqueur pour cibler même une étoile hors du draw range', () => {
    const batch = createBatch(6_000);

    batch.setDrawLimit(2_000);
    batch.select('hyg-6000');

    expect(batch.selectionPoint.visible).toBe(true);
    expect(batch.selectionPoint.userData['objectId']).toBe('hyg-6000');
    expect(batch.getPickables()).toEqual([batch.selectionPoint, batch.points]);
    expect(batch.getWorldPosition('hyg-6000')).not.toBeNull();

    batch.select(null);
    expect(batch.selectionPoint.visible).toBe(false);
    batch.select('missing');
    expect(batch.selectionPoint.visible).toBe(false);
    expect(batch.getWorldPosition('missing')).toBeNull();
    batch.dispose();
  });

  it('fait évoluer une étoile active du halo vers un volume sans sortir le catalogue du batch', () => {
    const batch = createBatch(2);
    const detail = batch.root.getObjectByName('active-hyg-star-detail');
    const halo = batch.root.getObjectByName('active-hyg-star-halo');
    const core = batch.root.getObjectByName('active-hyg-star-core');

    expect(detail).toBeInstanceOf(THREE.Group);
    expect(halo).toBeInstanceOf(THREE.Points);
    expect(core).toBeInstanceOf(THREE.Mesh);
    if (
      !(detail instanceof THREE.Group) ||
      !(halo instanceof THREE.Points) ||
      !(core instanceof THREE.Mesh)
    ) {
      throw new Error('Représentation détaillée HYG absente.');
    }

    batch.select('hyg-1');
    batch.setPixelRatio(1.5);
    batch.updateLod(2, 10);
    const haloMaterial = halo.material as THREE.ShaderMaterial;
    const coreMaterial = core.material as THREE.MeshBasicMaterial;
    const fieldScaleAtStellarLevel = batch.points.material.uniforms['pointScale']?.value as number;

    expect(detail.visible).toBe(true);
    expect(detail.userData['objectId']).toBe('hyg-1');
    expect(detail.position.toArray()).toEqual(batch.selectionPoint.position.toArray());
    expect(halo.visible).toBe(true);
    expect(haloMaterial.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(haloMaterial.uniforms['pointSize']!.value).toBeGreaterThan(24);
    expect(core.visible).toBe(false);

    batch.updateLod(0, 10);
    const fieldScaleNearStar = batch.points.material.uniforms['pointScale']?.value as number;

    expect(fieldScaleNearStar).toBeGreaterThan(fieldScaleAtStellarLevel);
    expect(haloMaterial.uniforms['pointSize']!.value).toBeGreaterThan(100);
    expect(core.visible).toBe(true);
    expect(coreMaterial.opacity).toBeGreaterThan(0.95);
    expect(core.scale.x).toBeLessThanOrEqual(0.1);
    expect(core.scale.y).toBe(core.scale.x);
    expect(core.scale.z).toBe(core.scale.x);

    batch.select(null);
    expect(detail.visible).toBe(false);
    batch.dispose();
  });

  it('utilise l’identifiant éditorial du point HYG lié sans créer de second point', () => {
    const catalog = createCatalog(1);

    catalog.catalogIds[0] = 32_263;
    (catalog.names as string[])[0] = 'Sirius';
    (catalog.aliases as string[][])[0] = ['HIP 32349'];
    const registry = new StarCatalogRegistry(catalog, new CoordinateSystem(), [
      {
        id: 'sirius',
        name: 'Sirius',
        type: 'star',
        parentId: 'milky-way',
        referenceFrame: 'stellar',
        scientificConfidence: 'observed',
        visual: { visualRadius: 1.6, scaleMode: 'adaptive' },
        positionProvider: {
          type: 'catalog',
          catalogId: 'hyg-v41-bright-stars',
          identifier: 'HIP 32349',
        },
      },
    ]);
    const batch = new StarCatalogBatch(registry);

    expect(batch.points.userData['objectIds']).toEqual(['sirius']);
    expect(batch.points.geometry.getAttribute('position').count).toBe(1);
    batch.select('sirius');
    expect(batch.activeDetail.visible).toBe(true);
    batch.dispose();
  });
});

function createBatch(count: number): StarCatalogBatch {
  return new StarCatalogBatch(
    new StarCatalogRegistry(createCatalog(count), new CoordinateSystem()),
  );
}

function createCatalog(count: number): StarCatalog {
  const positionsParsec = new Float32Array(count * 3);
  const apparentMagnitudes = new Float32Array(count);
  const colorIndicesBv = new Float32Array(count);
  const catalogIds = new Uint32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;

    positionsParsec[offset] = 1 + index * 0.001;
    positionsParsec[offset + 1] = 2;
    positionsParsec[offset + 2] = 3;
    apparentMagnitudes[index] = index === 0 ? -1.4 : 6.5;
    colorIndicesBv[index] = index === 0 ? -0.2 : 1.7;
    catalogIds[index] = index + 1;
  }

  return {
    count,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec,
    apparentMagnitudes,
    colorIndicesBv,
    catalogIds,
    names: Array.from({ length: count }, (_, index) => `Étoile ${index + 1}`),
    aliases: Array.from({ length: count }, () => []),
    spectralTypes: Array.from({ length: count }, () => null),
  };
}
