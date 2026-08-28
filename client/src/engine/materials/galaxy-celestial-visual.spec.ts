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
    expect(halo?.scale.x).toBeCloseTo(797.164, 3);
    expect(halo?.scale.y).toBeCloseTo(279.007, 3);
    expect(halo?.scale.z).toBe(1);
    expect((halo?.layers.mask ?? 0) & (1 << PICKING_LAYER)).toBe(0);
    expect(visual.pickables[0]?.name).toBe('andromeda-selection-target');
    expect(visual.pickables[0]?.scale.x).toBeCloseTo(797.164 * 0.575, 3);
    expect(visual.pickables[0]?.layers.isEnabled(PICKING_LAYER)).toBe(true);
    expect(visual.pickables[0]?.userData).toMatchObject({
      visualRole: 'selection-proxy',
      sizeTreatment: 'screen-synchronized-margin-around-rendered-galaxy',
      renderDiameterRadiusMultiplier: 0.575,
    });
    expect(visual.lod.nearRoot?.name).toBe('andromeda-galaxy-near-volume');
    expect(visual.lod.nearMaterials).toHaveLength(2);
    expect(visual.lod.nearRoot?.scale.x).toBeCloseTo(797.164 / 2, 3);
    expect(visual.lod.nearMaterials[0]?.baseOpacity).toBeGreaterThan(0);
    expect(visual.lod.farBaseOpacity).toBeCloseTo(0.72);
    disposeRoot(root);
  });

  it('sépare la taille observée d’une galaxie naine de sa zone de sélection', () => {
    const root = new THREE.Group();
    const dwarf = createGalaxy();

    dwarf.id = 'draco-dwarf';
    dwarf.visual.visualRadius = 64;
    dwarf.metadata = { halfLightRadiusPc: 221 };
    const visual = createGalaxyCelestialVisual(root, dwarf, 'low', assets);

    expect(visual.lod.farSprite?.scale.x).toBeCloseTo(4.42, 6);
    expect(visual.lod.farSprite?.userData).toMatchObject({
      renderDiameter: 4.42,
      physicalSceneDiameter: 4.42,
      diameterTreatment: 'documented-half-light-diameter',
    });
    expect(visual.lod.nearRoot?.scale.x).toBeCloseTo(2.21, 6);
    expect(visual.lod.nearRoot?.userData['diameterTreatment']).toBe(
      'documented-half-light-diameter',
    );
    expect(visual.pickables[0]?.name).toBe('draco-dwarf-selection-target');
    expect(visual.pickables[0]?.scale.x).toBeCloseTo(4.42 * 0.575, 6);
    expect(visual.pickables[0]?.layers.isEnabled(PICKING_LAYER)).toBe(true);
    disposeRoot(root);
  });

  it('réserve le volume spécialisé de la Voie lactée et un proxy de sélection invisible', () => {
    const root = new THREE.Group();
    const galaxy = createGalaxy();

    galaxy.id = 'milky-way';
    galaxy.metadata = { diameterLy: 100_000 };
    const visual = createGalaxyCelestialVisual(root, galaxy, 'high', assets);

    expect(visual.lod.nearRoot).toBeNull();
    expect(visual.lod.nearMaterials).toHaveLength(0);
    expect(visual.pickables).toEqual([visual.lod.farSprite]);
    expect(visual.lod.farSprite?.name).toBe('milky-way-galaxy-picking-proxy');
    expect(visual.lod.farBaseDiameter).toBeCloseTo(306.601, 3);
    expect(visual.lod.farSprite?.scale.x).toBeCloseTo(306.601, 3);
    expect(visual.lod.farSprite?.scale.y).toBeCloseTo(306.601, 3);
    expect(visual.lod.farSprite?.scale.z).toBe(1);
    expect(visual.lod.farAspectRatio).toBe(1);
    expect(visual.lod.farSprite?.material.opacity).toBe(0);
    expect(visual.lod.farSprite?.material.colorWrite).toBe(false);
    expect(visual.lod.farSprite?.userData).toMatchObject({
      pickingProxyOnly: true,
      apparentScaleTreatment: 'single-procedural-galaxy-with-invisible-pick-proxy',
      scientificConfidence: 'illustrative',
    });
    expect(visual.lod.farSprite?.material.userData['visualStyle']).toBe(
      'transparent-procedural-galaxy-picking-proxy',
    );
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
    metadata: { diameterLy: 260_000 },
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
