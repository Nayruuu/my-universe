import * as THREE from 'three';
import { BlackHoleActivity, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createCelestialVisual, type CelestialVisualAssets } from './celestial-visual-factory';

describe('rendu LOD des trous noirs', () => {
  let assets: CelestialVisualAssets;

  beforeEach(() => {
    assets = {
      glowTexture: new THREE.Texture(),
      photonRingTexture: new THREE.Texture(),
      galaxyTextures: {
        spiral: new THREE.Texture(),
        elliptical: new THREE.Texture(),
        irregular: new THREE.Texture(),
      },
      sphereGeometry: new THREE.SphereGeometry(1, 8, 6),
      selectionGeometry: new THREE.SphereGeometry(1, 8, 6),
      ringGeometry: new THREE.RingGeometry(1.35, 2.25, 12),
      selectionMaterial: new THREE.MeshBasicMaterial(),
    };
  });

  afterEach(() => {
    assets.glowTexture.dispose();
    assets.photonRingTexture.dispose();
    Object.values(assets.galaxyTextures).forEach((texture) => texture.dispose());
    assets.sphereGeometry.dispose();
    assets.selectionGeometry.dispose();
    assets.ringGeometry.dispose();
    assets.selectionMaterial.dispose();
  });

  it.each([
    ['dormant', false, false],
    ['quiescent', true, false],
    ['active', true, true],
  ] as const)('compose un profil %s scientifiquement explicite', (activity, hasDisk, hasJets) => {
    const object = blackHole(activity);

    if (activity === 'active') {
      delete object.visual.secondaryColor;
    }
    const visual = createCelestialVisual(object, 'high', assets);
    const core = visual.root.getObjectByName('test-black-hole-event-horizon');
    const lens = visual.root.getObjectByName('test-black-hole-local-lensing-halo');
    const photonRing = visual.root.getObjectByName('test-black-hole-photon-ring');
    const disk = visual.root.getObjectByName('test-black-hole-accretion-disk');
    const jets = visual.root.getObjectByName('test-black-hole-relativistic-jets');
    const farSprite = visual.lod.farSprite;

    expect(core).toBeInstanceOf(THREE.Mesh);
    expect(core?.renderOrder).toBe(10);
    expect((core as THREE.Mesh).material).toMatchObject({
      depthTest: false,
      depthWrite: false,
    });
    expect(lens).toBeInstanceOf(THREE.Sprite);
    expect(lens?.userData['scientificConfidence']).toBe('illustrative');
    expect(lens?.userData['visualStyle']).toBe('local-lensing-cue');
    expect((lens as THREE.Sprite).material.opacity).toBeLessThanOrEqual(0.12);
    expect(photonRing).toBeInstanceOf(THREE.Sprite);
    expect(photonRing?.renderOrder).toBe(9);
    expect(photonRing?.scale.x).toBeCloseTo(5.6);
    expect((photonRing as THREE.Sprite).material.map).toBe(assets.photonRingTexture);
    expect(photonRing?.userData['scientificConfidence']).toBe('illustrative');
    expect(Boolean(disk)).toBe(hasDisk);
    expect(Boolean(jets)).toBe(hasJets);
    expect(farSprite).toBeInstanceOf(THREE.Sprite);
    expect(farSprite?.name).toBe('test-black-hole-black-hole-impostor');
    expect(visual.rotatingBody).toBeNull();
    expect(visual.pickables).toHaveLength(1);
    expect(visual.pickables[0]?.layers.mask & (1 << PICKING_LAYER)).not.toBe(0);
    expect(visual.lod.nearMaterials.length).toBeGreaterThanOrEqual(2);

    const diskMaterial = (disk as THREE.Mesh | undefined)?.material;

    if (diskMaterial instanceof THREE.ShaderMaterial) {
      diskMaterial.opacity = 0.25;
      (diskMaterial.onBeforeRender as () => void)();
      expect(diskMaterial.uniforms['layerOpacity']?.value).toBe(0.25);
    }

    disposeCreatedResources(visual.root, assets);
  });

  it('applique le profil dormant et une inclinaison par défaut si le catalogue les omet', () => {
    const object = blackHole('dormant');

    delete object.visual.blackHoleActivity;
    delete object.visual.accretionDiskInclinationDegrees;
    const visual = createCelestialVisual(object, 'low', assets);

    expect(visual.root.getObjectByName('test-black-hole-accretion-disk')).toBeUndefined();
    expect(visual.root.getObjectByName('test-black-hole-relativistic-jets')).toBeUndefined();
    disposeCreatedResources(visual.root, assets);
  });

  it('applique l’inclinaison et les couleurs de repli à un disque non documenté', () => {
    const object = blackHole('quiescent');

    delete object.visual.color;
    delete object.visual.secondaryColor;
    delete object.visual.accretionDiskInclinationDegrees;
    const visual = createCelestialVisual(object, 'medium', assets);
    const frame = visual.root.getObjectByName('test-black-hole-accretion-frame');

    expect(frame?.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(62));
    expect(visual.root.getObjectByName('test-black-hole-accretion-disk')).toBeInstanceOf(
      THREE.Mesh,
    );
    disposeCreatedResources(visual.root, assets);
  });

  it('conserve un noyau stellaire 3D réel dans le fond capturé par la lentille', () => {
    const object = blackHole('quiescent');

    object.id = 'sagittarius-a-star';
    object.metadata = { lensingEnvironment: 'procedural-nuclear-star-cluster' };
    const first = createCelestialVisual(object, 'high', assets);
    const second = createCelestialVisual(object, 'high', assets);
    const cluster = first.root.getObjectByName(
      'sagittarius-a-star-nuclear-star-cluster',
    ) as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    const secondCluster = second.root.getObjectByName(
      'sagittarius-a-star-nuclear-star-cluster',
    ) as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

    expect(cluster).toBeInstanceOf(THREE.Points);
    expect(cluster.parent).toBe(first.lod.nearRoot);
    expect(first.lensingForeground?.name).toBe('sagittarius-a-star-lensing-foreground');
    expect(first.lensingForeground?.getObjectByName(cluster.name)).toBeUndefined();
    expect(cluster.geometry.getAttribute('position').count).toBe(6_144);
    expect(cluster.geometry.getAttribute('position').array).toEqual(
      secondCluster.geometry.getAttribute('position').array,
    );
    expect(cluster.geometry.getAttribute('color').count).toBe(6_144);
    expect(cluster.material).toMatchObject({
      map: assets.glowTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    expect(cluster.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualStyle: 'procedural-3d-nuclear-star-cluster',
    });
    expect(first.lod.nearMaterials.some(({ material }) => material === cluster.material)).toBe(
      true,
    );

    disposeCreatedResources(first.root, assets);
    disposeCreatedResources(second.root, assets);
  });

  it('réserve le noyau illustratif à Sagittarius A* et adapte son budget à la qualité', () => {
    const object = blackHole('quiescent');

    object.metadata = { lensingEnvironment: 'procedural-nuclear-star-cluster' };
    const medium = createCelestialVisual(object, 'medium', assets);

    expect(medium.root.getObjectByName('test-black-hole-nuclear-star-cluster')).toBeInstanceOf(
      THREE.Points,
    );
    expect(
      (
        medium.root.getObjectByName('test-black-hole-nuclear-star-cluster') as THREE.Points
      ).geometry.getAttribute('position').count,
    ).toBe(3_072);

    delete object.metadata;
    const withoutEnvironment = createCelestialVisual(object, 'high', assets);
    const low = createCelestialVisual(
      {
        ...object,
        metadata: { lensingEnvironment: 'procedural-nuclear-star-cluster' },
      },
      'low',
      assets,
    );

    expect(
      withoutEnvironment.root.getObjectByName('test-black-hole-nuclear-star-cluster'),
    ).toBeUndefined();
    expect(low.root.getObjectByName('test-black-hole-nuclear-star-cluster')).toBeUndefined();

    disposeCreatedResources(medium.root, assets);
    disposeCreatedResources(withoutEnvironment.root, assets);
    disposeCreatedResources(low.root, assets);
  });
});

function blackHole(activity: BlackHoleActivity): SpaceObject {
  return {
    id: 'test-black-hole',
    name: 'Trou noir de test',
    type: 'black-hole',
    parentId: 'milky-way',
    referenceFrame: 'galactic',
    scientificConfidence: 'calculated',
    visual: {
      color: '#f0a05a',
      secondaryColor: '#82a9df',
      visualRadius: 2,
      scaleMode: 'adaptive',
      blackHoleActivity: activity,
      accretionDiskInclinationDegrees: 64,
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'kiloparsec',
    },
  };
}

function disposeCreatedResources(root: THREE.Object3D, assets: CelestialVisualAssets): void {
  const sharedGeometries = new Set<THREE.BufferGeometry>([
    assets.sphereGeometry,
    assets.selectionGeometry,
    assets.ringGeometry,
  ]);

  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      if (!sharedGeometries.has(object.geometry)) {
        object.geometry.dispose();
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      materials.forEach((material) => material.dispose());
    } else if (object instanceof THREE.Sprite) {
      object.material.dispose();
    }
  });
}
