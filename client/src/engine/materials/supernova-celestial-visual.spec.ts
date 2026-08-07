import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createSupernovaCelestialVisual } from './supernova-celestial-visual';
import type { CelestialVisualAssets } from './celestial-visual-types';

describe('supernova celestial visual', () => {
  it('compose le rendu temporel, la sélection et les valeurs LOD', () => {
    const assets = createAssets();
    const root = new THREE.Group();
    const visual = createSupernovaCelestialVisual(root, createSupernova(), 'high', assets);
    const target = visual.pickables[0];

    expect(visual.root).toBe(root);
    expect(visual.supernova).not.toBeNull();
    expect(target?.name).toBe('sn-1987a-selection-target');
    expect((target?.layers.mask ?? 0) & (1 << PICKING_LAYER)).not.toBe(0);
    expect(target?.scale.x).toBeCloseTo(3.96);
    expect(visual.lod.farSprite?.scale.x).toBeCloseTo(10.8);
    expect(visual.lod.nearMaterials).toHaveLength(4);
    expect(visual.lod.nearMaterials[0]?.baseOpacity).toBeGreaterThan(0);
    expect(visual.lod.farBaseOpacity).toBeCloseTo(0.95);
    disposeAssets(assets);
  });
});

function createSupernova(): SpaceObject {
  return {
    id: 'sn-1987a',
    name: 'SN 1987A',
    type: 'supernova',
    referenceFrame: 'galactic',
    scientificConfidence: 'observed',
    visual: {
      color: '#77d8ff',
      secondaryColor: '#ff6b8f',
      visualRadius: 1.8,
      scaleMode: 'adaptive',
    },
    metadata: {
      visualPeakJulianDay: 2_446_849.5,
      supernovaRiseDays: 20,
      supernovaDecayDays: 650,
      shellFormationDays: 60,
      appearanceReferenceJulianDay: 2_461_257.5,
      appearanceConfidence: 'illustrative',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
  };
}

function createAssets(): CelestialVisualAssets {
  return {
    glowTexture: new THREE.Texture(),
    photonRingTexture: new THREE.Texture(),
    galaxyTextures: {
      spiral: new THREE.Texture(),
      elliptical: new THREE.Texture(),
      irregular: new THREE.Texture(),
    },
    sphereGeometry: new THREE.SphereGeometry(1, 8, 6),
    selectionGeometry: new THREE.SphereGeometry(1, 8, 6),
    ringGeometry: new THREE.RingGeometry(1, 2, 8),
    selectionMaterial: new THREE.MeshBasicMaterial(),
  };
}

function disposeAssets(assets: CelestialVisualAssets): void {
  assets.glowTexture.dispose();
  assets.photonRingTexture.dispose();
  Object.values(assets.galaxyTextures).forEach((texture) => texture.dispose());
  assets.sphereGeometry.dispose();
  assets.selectionGeometry.dispose();
  assets.ringGeometry.dispose();
  assets.selectionMaterial.dispose();
}
