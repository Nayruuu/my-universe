import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  createCelestialVisual,
  createCelestialVisualAssets,
  createSelectionMarker,
  createSharedGlowTexture,
  type CelestialVisualAssets,
} from './celestial-visual-factory';

describe('imposteurs galactiques', () => {
  let assets: CelestialVisualAssets;

  beforeEach(() => {
    assets = {
      glowTexture: new THREE.Texture(),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    assets.glowTexture.dispose();
    Object.values(assets.galaxyTextures).forEach((texture) => texture.dispose());
    assets.sphereGeometry.dispose();
    assets.selectionGeometry.dispose();
    assets.ringGeometry.dispose();
    assets.selectionMaterial.dispose();
  });

  it('crée une silhouette orientée, aplatie et directement sélectionnable', () => {
    const visual = createCelestialVisual(createGalaxy(), 'medium', assets);
    const sprite = visual.lod.farSprite;

    expect(sprite).toBeInstanceOf(THREE.Sprite);
    if (!sprite) {
      throw new Error('Imposteur galactique absent.');
    }
    expect(sprite.name).toBe('andromeda-galaxy-impostor');
    expect(sprite.scale.toArray()).toEqual([1_040, 364, 1]);
    expect(sprite.material.map).toBe(assets.galaxyTextures.spiral);
    expect(sprite.material.rotation).toBeCloseTo(THREE.MathUtils.degToRad(35));
    expect(sprite.layers.mask & (1 << PICKING_LAYER)).not.toBe(0);
    expect(sprite.userData['objectId']).toBe('andromeda');
    expect(visual.pickables).toEqual([sprite]);
    expect(visual.lod.farAspectRatio).toBe(0.35);

    sprite.material.dispose();
  });

  it('ne crée aucune géométrie pour la région de navigation', () => {
    const visual = createCelestialVisual(
      {
        ...createGalaxy(),
        id: 'local-group',
        name: 'Groupe local',
        type: 'region',
      },
      'medium',
      assets,
    );

    expect(visual.root.children).toHaveLength(0);
    expect(visual.pickables).toHaveLength(0);
    expect(visual.lod.farSprite).toBeNull();
  });

  it('applique les valeurs galactiques par défaut', () => {
    const galaxy = createGalaxy();

    galaxy.visual = {
      visualRadius: 10,
      scaleMode: 'adaptive',
    };
    const visual = createCelestialVisual(galaxy, 'medium', assets);

    expect(visual.lod.farSprite?.material.map).toBe(assets.galaxyTextures.elliptical);
    expect(visual.lod.farAspectRatio).toBe(0.72);
    visual.lod.farSprite?.material.dispose();
  });

  it('signale chaque contexte Canvas 2D indispensable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => createSharedGlowTexture()).toThrow('halo stellaire');
    expect(() => createSelectionMarker()).toThrow('marqueur de sélection');
    expect(() => createCelestialVisual(createPlanet('mars'), 'medium', assets)).toThrow(
      'texture de mars',
    );
  });

  it('signale aussi un contexte absent pendant la génération galactique', () => {
    const context = visualCanvasContext();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValueOnce(context)
      .mockReturnValueOnce(null);

    expect(() => createCelestialVisualAssets('low')).toThrow('imposteurs galactiques');
  });

  it('active une texture statique après le chargement de son image', () => {
    const visual = createCelestialVisual(createPlanet('earth'), 'high', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;
    const image = texture.image as HTMLImageElement;
    const initialVersion = texture.version;

    image.onload?.(new Event('load'));

    expect(texture.version).toBe(initialVersion + 1);
    body.material.dispose();
    texture.dispose();
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

function createPlanet(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
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

function visualCanvasContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() };

  return {
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}
