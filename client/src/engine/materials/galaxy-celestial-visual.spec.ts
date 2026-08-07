import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createGalaxyCelestialVisual } from './galaxy-celestial-visual';
import type { CelestialVisualAssets } from './celestial-visual-types';

describe('galaxy celestial visual', () => {
  let assets: CelestialVisualAssets;

  beforeEach(() => {
    assets = createAssets();
  });

  afterEach(() => {
    disposeAssets(assets);
  });

  it('compose l’imposteur lointain et le volume proche dans le même contrat LOD', () => {
    const root = new THREE.Group();
    const visual = createGalaxyCelestialVisual(root, createGalaxy(), 'low', assets);
    const halo = visual.lod.farSprite;

    expect(visual.root).toBe(root);
    expect(halo?.name).toBe('andromeda-galaxy-impostor');
    expect(halo?.scale.toArray()).toEqual([1_040, 364, 1]);
    expect((halo?.layers.mask ?? 0) & (1 << PICKING_LAYER)).not.toBe(0);
    expect(visual.lod.nearRoot?.name).toBe('andromeda-galaxy-near-volume');
    expect(visual.lod.nearMaterials).toHaveLength(2);
    expect(visual.lod.nearMaterials[0]?.baseOpacity).toBeGreaterThan(0);
    expect(visual.lod.farBaseOpacity).toBeCloseTo(0.72);
    disposeRoot(root);
  });

  it('réserve le volume spécialisé de la Voie lactée sans dupliquer sa géométrie', () => {
    const root = new THREE.Group();
    const galaxy = createGalaxy();

    galaxy.id = 'milky-way';
    const visual = createGalaxyCelestialVisual(root, galaxy, 'high', assets);

    expect(visual.lod.nearRoot).toBeNull();
    expect(visual.lod.nearMaterials).toHaveLength(0);
    expect(visual.pickables).toEqual([visual.lod.farSprite]);
    disposeRoot(root);
  });
});

function createGalaxy(): SpaceObject {
  return {
    id: 'andromeda',
    name: 'Andromède',
    type: 'galaxy',
    referenceFrame: 'local-group',
    scientificConfidence: 'observed',
    visual: {
      color: '#b7c9e5',
      visualRadius: 520,
      scaleMode: 'adaptive',
      galaxyShape: 'spiral',
      galaxyAxisRatio: 0.35,
      galaxyRotationDegrees: 35,
    },
    positionProvider: {
      type: 'static',
      position: [-377, -288, 623],
      unit: 'kiloparsec',
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

function disposeRoot(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose();
    }
    if (
      child instanceof THREE.Sprite ||
      child instanceof THREE.Mesh ||
      child instanceof THREE.Points
    ) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((material) => material.dispose());
    }
  });
}
