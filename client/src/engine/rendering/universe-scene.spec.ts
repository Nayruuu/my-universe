import * as THREE from 'three';
import {
  type ConstellationCatalog,
  type SpaceTileIndex,
  type StarClusterTile,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { StarCatalog } from '../loaders/star-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import { getNavigationScale } from '../camera/navigation-scales';
import { ALL_COSMIC_MAP_LAYERS, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { getCosmicWebVolumeProfile } from './cosmic-web-volume';
import { getPhotographicProfile } from './photographic-profile';
import { UniverseScene } from './universe-scene';

describe('UniverseScene', () => {
  it('sépare le voisinage solaire du centre galactique et réduit son échelle progressivement', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const stellarRoot = scene.spaceRoot.getObjectByName('solar-neighborhood-reference');
    const origin = new THREE.Vector3(2_620, 0, 0);

    expect(stellarRoot).toBeInstanceOf(THREE.Group);
    scene.setStellarOrigin(origin);
    expect(stellarRoot?.position.toArray()).toEqual(origin.toArray());

    scene.updateLod(2, 10, 1_400);
    expect(stellarRoot?.scale.x).toBeCloseTo(1, 4);

    scene.updateLod(3, 10, 9_600);
    expect(stellarRoot?.scale.x).toBeGreaterThanOrEqual(0.14);
    expect(stellarRoot?.scale.x).toBeLessThanOrEqual(0.2);
    expect(scene.spaceRoot.getObjectByName('illustrative-milky-way')?.position.length()).toBe(0);

    scene.dispose();
  });

  it('affiche un disque à quatre bras centré sur le centre galactique, jamais sur le Soleil', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const milkyWay = scene.spaceRoot.getObjectByName('illustrative-milky-way') as THREE.Points<
      THREE.BufferGeometry,
      THREE.PointsMaterial
    >;

    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.opacity).toBe(0);
    expect(milkyWay.userData['scientificConfidence']).toBe('illustrative');
    expect(milkyWay.userData['visualStructure']).toBe('illustrative-galactocentric-four-arm-disk');
    expect(milkyWay.userData['structureOrigin']).toBe('galactic-center');
    expect(milkyWay.userData['spiralArmCount']).toBe(4);
    expect(milkyWay.userData['spiralPitchDegrees']).toBeCloseTo(13, 6);
    expect(milkyWay.position.length()).toBe(0);
    expect(scene.spaceRoot.getObjectByName('illustrative-milky-way-aura')).toBeUndefined();

    scene.updateLod(3, 1, 9_600);
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.opacity).toBeGreaterThan(0.08);
    expect(milkyWay.material.opacity).toBeLessThan(0.14);
    const detailedScale = milkyWay.scale.x;

    scene.updateLod(3, 10, 13_300);
    expect(milkyWay.material.opacity).toBeGreaterThan(0);
    expect(milkyWay.material.opacity).toBeLessThan(0.24);
    expect(milkyWay.scale.x).toBeLessThan(detailedScale);

    scene.updateLod(4, 10, 17_000);
    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.opacity).toBeLessThan(0.004);

    scene.dispose();
  });

  it('superpose un atlas différé sur plusieurs profondeurs au disque galactique', async () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const loadAsync = vi
      .spyOn(THREE.TextureLoader.prototype, 'loadAsync')
      .mockResolvedValue(texture);
    const scene = new UniverseScene(new PerformanceManager());
    const volume = scene.spaceRoot.getObjectByName('illustrative-milky-way-volume');

    expect(volume).toBeInstanceOf(THREE.Group);
    expect(volume?.userData['scientificConfidence']).toBe('illustrative');
    expect(scene.milkyWayAtlasStatus).toBe('idle');

    scene.setQuality('high');
    await expect(scene.ensureMilkyWayAtlas()).resolves.toBe(true);
    scene.updateLod(3, 10, 9_600);

    expect(loadAsync).toHaveBeenCalledOnce();
    expect(scene.milkyWayAtlasStatus).toBe('ready');
    expect(scene.milkyWayVolumeDrawMeshCount).toBe(4);
    expect(volume?.visible).toBe(true);
    expect(volume?.scale.x).toBeCloseTo(1, 4);

    scene.updateLod(4, 10, 17_000);
    expect(scene.milkyWayVolumeDrawMeshCount).toBe(0);
    expect(volume?.visible).toBe(false);

    scene.dispose();
  });

  it('fonctionne sans catalogue dense et adapte la Voie lactée', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const target = new THREE.Vector3();
    const milkyWay = scene.spaceRoot.getObjectByName('illustrative-milky-way') as THREE.Points<
      THREE.BufferGeometry,
      THREE.PointsMaterial
    >;

    milkyWay.geometry.computeBoundingSphere();
    expect(milkyWay.material.sizeAttenuation).toBe(false);
    expect(milkyWay.material.size).toBeLessThanOrEqual(2);
    expect(getNavigationScale('milky-way').distance).toBeGreaterThan(
      milkyWay.geometry.boundingSphere!.radius * 1.4,
    );

    scene.setQuality('low');
    scene.setQuality('medium');
    scene.setQuality('high');
    scene.updateLod(2, 0);
    scene.updateLod(4, 1);
    scene.selectCatalogObject(null);
    expect(scene.getCatalogWorldPosition('unknown')).toBeNull();
    expect(scene.getCatalogWorldPosition('unknown', target)).toBeNull();
    expect(scene.getCatalogPickables()).toEqual([]);
    expect(scene.visibleCatalogStarCount).toBe(0);
    expect(scene.catalogStarCount).toBe(0);
    expect(scene.visibleCosmicGroupCount).toBe(0);
    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(0);
    expect(scene.cosmicGroupCount).toBe(0);
    expect(scene.activeCosmicFilamentCount).toBe(0);
    expect(scene.visibleCosmicFilamentCount).toBe(0);
    expect(scene.cosmicFilamentCount).toBe(0);
    expect(scene.cosmicStructureCount).toBe(0);
    expect(scene.visibleCosmicStructureCount).toBe(0);
    expect(scene.isCatalogObjectVisibleForLabels('unknown')).toBeNull();
    expect(scene.visibleStarClusterCount).toBe(0);
    expect(scene.starClusterRepresentationCount).toBe(0);

    scene.dispose();
    expect(scene.scene.children).toHaveLength(0);
  });

  it('installe, estompe, remplace et détruit l’aperçu observé des galaxies proches', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const index = nearbyGalaxyIndex();

    await scene.setNearbyGalaxyOverview(index, new CoordinateSystem());
    const firstPoints = scene.spaceRoot.getObjectByName('observed-nearby-galaxy-overview') as
      THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | undefined;

    expect(firstPoints).toBeInstanceOf(THREE.Points);
    expect(firstPoints?.geometry.getAttribute('position').count).toBe(2);
    expect(firstPoints?.userData['scientificConfidence']).toBe('observed');
    const firstGeometryDispose = vi.spyOn(firstPoints!.geometry, 'dispose');

    scene.setPixelRatio(1.25);
    scene.setQuality('high');
    scene.updateLod(5, 10, 120_000);

    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(2);
    expect(firstPoints?.material.uniforms['catalogOpacity']!.value).toBeCloseTo(0.42, 5);
    expect(firstPoints?.material.uniforms['radiance']!.value).toBe(
      getPhotographicProfile(5, 'high').galaxyRadiance,
    );

    await scene.setNearbyGalaxyOverview({ ...index, overviewEntries: [] }, new CoordinateSystem());
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    expect(scene.spaceRoot.getObjectByName('observed-nearby-galaxy-overview')).toBeUndefined();
    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(0);

    await scene.setNearbyGalaxyOverview(
      {
        version: index.version,
        tiles: index.tiles,
        searchEntries: index.searchEntries,
      },
      new CoordinateSystem(),
    );
    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(0);

    await scene.setNearbyGalaxyOverview(index, new CoordinateSystem());
    scene.updateLod(6, 10, 300_000);
    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(0);
    scene.dispose();
    expect(scene.visibleNearbyGalaxyOverviewCount).toBe(0);
  });

  it('installe, sélectionne, remplace et détruit le batch Cosmicflows-4', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const first = cosmicGroupRegistry(42);
    const second = cosmicGroupRegistry(84);

    await scene.setCosmicGroupCatalog(first);
    const firstPoints = scene.spaceRoot.getObjectByName('calculated-cosmicflows4-groups');

    expect(firstPoints).toBeInstanceOf(THREE.Points);
    const firstGeometryDispose = vi.spyOn((firstPoints as THREE.Points).geometry, 'dispose');

    await scene.setCosmicGroupCatalog(second);
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    const activePoints = scene.spaceRoot.getObjectByName('calculated-cosmicflows4-groups');

    scene.setQuality('high');
    scene.setPixelRatio(1.25);
    scene.updateLod(6, 10, 420_000);
    scene.selectCatalogObject('cf4-pgc-84');

    expect(scene.cosmicGroupCount).toBe(1);
    expect(scene.visibleCosmicGroupCount).toBe(1);
    expect(
      (activePoints as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>).material.uniforms[
        'pixelRatio'
      ]!.value,
    ).toBe(1.25);
    expect(
      (activePoints as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>).material.uniforms[
        'radiance'
      ]!.value,
    ).toBe(getPhotographicProfile(6, 'high').galaxyRadiance);
    expect(scene.getCatalogWorldPosition('cf4-pgc-84')).toBeInstanceOf(THREE.Vector3);
    expect(scene.getCatalogPickables()).toHaveLength(2);
    expect(scene.isCatalogObjectVisibleForLabels('cf4-pgc-84')).toBe(true);

    scene.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, groups: false });
    expect(scene.visibleCosmicGroupCount).toBe(0);
    expect(scene.isCatalogObjectVisibleForLabels('cf4-pgc-84')).toBe(false);
    scene.setCosmicMapLayers(DEFAULT_COSMIC_MAP_LAYERS);

    scene.updateLod(5, 10, 120_000);
    expect(scene.visibleCosmicGroupCount).toBe(1);

    scene.updateLod(4, 10, 17_000);
    expect(scene.visibleCosmicGroupCount).toBe(0);
    scene.selectCatalogObject(null);
    scene.dispose();
    expect(scene.cosmicGroupCount).toBe(0);
  });

  it('installe, pilote, masque, remplace et détruit le volume simulé du réseau cosmique', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const firstVolume = cosmicWebVolume(72);

    await scene.setCosmicWebVolume(firstVolume, new CoordinateSystem());
    const firstMesh = scene.spaceRoot.getObjectByName('simulated-cosmic-web-volume') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.ShaderMaterial
    >;

    expect(firstMesh).toBeInstanceOf(THREE.Mesh);
    expect(firstMesh.userData['scientificConfidence']).toBe('simulated');
    expect(firstMesh.userData['volumeResolution']).toBe(72);
    const firstGeometryDispose = vi.spyOn(firstMesh.geometry, 'dispose');

    scene.setQuality('high');
    scene.updateLod(6, 10, 420_000);
    expect(firstMesh.visible).toBe(true);
    expect(firstMesh.material.uniforms['stepCount']!.value).toBe(
      getCosmicWebVolumeProfile('high').stepCount,
    );
    expect(firstMesh.material.uniforms['radiance']!.value).toBe(
      getPhotographicProfile(6, 'high').galaxyRadiance,
    );

    scene.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, volume: false });
    expect(firstMesh.visible).toBe(false);
    scene.setCosmicMapLayers(DEFAULT_COSMIC_MAP_LAYERS);
    expect(firstMesh.visible).toBe(true);

    await scene.setCosmicWebVolume(cosmicWebVolume(48), new CoordinateSystem());
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    expect(
      scene.spaceRoot.getObjectByName('simulated-cosmic-web-volume')?.userData['volumeResolution'],
    ).toBe(48);

    scene.dispose();
    expect(scene.spaceRoot.getObjectByName('simulated-cosmic-web-volume')).toBeUndefined();
  });

  it('propage la qualité et le LOD au réseau cosmique dérivé', async () => {
    const scene = new UniverseScene(new PerformanceManager());

    scene.setQuality('low');
    await scene.setCosmicGroupCatalog(connectedCosmicGroupRegistry());
    const filaments = scene.spaceRoot.getObjectByName(
      'illustrative-cosmicflows4-filaments',
    ) as THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;

    scene.updateLod(6, 10, 420_000);
    const lowCount = scene.activeCosmicFilamentCount;

    expect(filaments).toBeInstanceOf(THREE.LineSegments);
    expect(scene.cosmicFilamentCount).toBeGreaterThan(2);
    expect(lowCount).toBeGreaterThan(0);
    expect(lowCount).toBeLessThan(scene.cosmicFilamentCount);

    scene.setQuality('medium');
    expect(scene.activeCosmicFilamentCount).toBeGreaterThanOrEqual(lowCount);
    scene.setQuality('high');

    scene.updateLod(6, 10, 420_000);
    expect(scene.visibleCosmicFilamentCount).toBeGreaterThan(0);
    expect(scene.visibleCosmicFilamentCount).toBeLessThan(scene.cosmicFilamentCount);
    expect(filaments.visible).toBe(true);

    scene.updateLod(6, 10, 170_000);
    expect(scene.visibleCosmicFilamentCount).toBe(scene.cosmicFilamentCount);

    scene.updateLod(4, 10, 17_000);
    expect(scene.visibleCosmicFilamentCount).toBe(0);
    expect(filaments.visible).toBe(false);
    scene.dispose();
    expect(scene.cosmicFilamentCount).toBe(0);
  });

  it('estompe le fond procédural avant les échelles galactiques', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const backdrop = scene.spaceRoot.getObjectByName('distant-star-field') as THREE.Points<
      THREE.BufferGeometry,
      THREE.PointsMaterial
    >;

    expect(backdrop).toBeDefined();
    expect(backdrop.userData['scientificConfidence']).toBe('procedural');
    expect(backdrop.userData['visualRole']).toBe('decorative');

    scene.updateLod(0, 10);
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeGreaterThan(0.25);
    expect(backdrop.material.opacity).toBeLessThan(0.35);

    scene.updateLod(2, 1);
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeGreaterThan(0.04);
    expect(backdrop.material.opacity).toBeLessThan(0.08);

    scene.updateLod(4, 1);
    expect(backdrop.visible).toBe(false);
    expect(backdrop.material.opacity).toBeLessThan(0.004);
    expect(backdrop.scale.toArray()).toEqual([1, 1, 1]);

    scene.updateLod(99, 1);
    expect(backdrop.visible).toBe(false);

    scene.updateLod(1, 1);
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeGreaterThan(0.18);
    expect(backdrop.material.opacity).toBeLessThan(0.24);
    scene.dispose();
  });

  it('installe, sélectionne, remplace et détruit les structures cosmologiques documentées', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const first = cosmicStructureRegistry('239+027+0091');
    const second = cosmicStructureRegistry('170+043+0196');

    await scene.setCosmicStructureCatalog(first);
    const firstPoints = scene.spaceRoot.getObjectByName('calculated-cosmic-structure-symbols');

    expect(firstPoints).toBeInstanceOf(THREE.Points);
    const firstGeometryDispose = vi.spyOn((firstPoints as THREE.Points).geometry, 'dispose');

    await scene.setCosmicStructureCatalog(second);
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    const activePoints = scene.spaceRoot.getObjectByName(
      'calculated-cosmic-structure-symbols',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

    scene.setQuality('high');
    scene.setPixelRatio(1.25);
    scene.updateLod(6, 10, 420_000);
    scene.selectCatalogObject('lss-sdss-main50-170-043-0196');

    expect(scene.cosmicStructureCount).toBe(1);
    expect(scene.visibleCosmicStructureCount).toBe(1);
    expect(activePoints.material.uniforms['pixelRatio']!.value).toBe(1.25);
    expect(activePoints.material.uniforms['detailScale']!.value).toBe(1);
    expect(activePoints.material.uniforms['radiance']!.value).toBe(
      getPhotographicProfile(6, 'high').galaxyRadiance,
    );
    expect(scene.getCatalogWorldPosition('lss-sdss-main50-170-043-0196')).toBeInstanceOf(
      THREE.Vector3,
    );
    expect(scene.getCatalogPickables()).toHaveLength(2);
    expect(scene.isCatalogObjectVisibleForLabels('lss-sdss-main50-170-043-0196')).toBe(true);

    scene.setCosmicMapLayers({ ...ALL_COSMIC_MAP_LAYERS, superclusters: false });
    expect(scene.visibleCosmicStructureCount).toBe(0);
    expect(scene.isCatalogObjectVisibleForLabels('lss-sdss-main50-170-043-0196')).toBe(false);
    scene.setCosmicMapLayers(ALL_COSMIC_MAP_LAYERS);
    expect(scene.visibleCosmicStructureCount).toBe(1);

    scene.updateLod(4, 10, 40_000);
    expect(scene.visibleCosmicStructureCount).toBe(0);
    scene.selectCatalogObject(null);
    scene.dispose();
    expect(scene.cosmicStructureCount).toBe(0);
  });

  it('intègre un fond cosmique illustratif piloté par la distance plutôt que le LOD', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const background = scene.scene.getObjectByName('scale-aware-cosmic-background') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(background).toBeInstanceOf(THREE.Mesh);
    scene.updateLod(2, 10, 2_399);
    const before = (background.material.uniforms['upperColor']!.value as THREE.Color).clone();

    scene.updateLod(3, 1 / 60, 2_401);
    const after = background.material.uniforms['upperColor']!.value as THREE.Color;

    const backgroundDelta = Math.hypot(after.r - before.r, after.g - before.g, after.b - before.b);

    expect(backgroundDelta).toBeGreaterThan(0);
    expect(backgroundDelta).toBeLessThan(0.01);
    expect((scene.scene.fog as THREE.FogExp2).color.getHex()).not.toBe(0x02030a);

    scene.dispose();
  });

  it('installe, remplace, sélectionne et détruit un catalogue stellaire', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const first = catalogRegistry(3_229);
    const second = catalogRegistry(6_960);

    await scene.setStarCatalog(first);
    await scene.setStarClusterTiles(
      [
        {
          ...starClusterTile(),
          sourceStarCount: 1,
          clusterCount: 1,
          cellCoordinates: Int32Array.from([0, 0, 0]),
          positionsParsec: Float32Array.from([1, 2, 3]),
          starCounts: Uint32Array.from([1]),
          apparentMagnitudes: Float32Array.from([0.5]),
          colorIndicesBv: Float32Array.from([0.2]),
        },
      ],
      first,
    );
    await scene.setStarCatalog(second);
    expect(scene.activeStarTileCount).toBe(0);
    scene.setQuality('high');
    scene.updateLod(1, 1);
    scene.selectCatalogObject('hyg-6960');
    const points = scene.spaceRoot.getObjectByName('observed-hyg-star-catalog') as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const stellarRoot = scene.spaceRoot.getObjectByName('solar-neighborhood-reference');

    expect(scene.catalogStarCount).toBe(1);
    expect(scene.visibleCatalogStarCount).toBe(1);
    expect(scene.getCatalogWorldPosition('hyg-6960')).toBeInstanceOf(THREE.Vector3);
    expect(scene.getCatalogWorldPosition('unknown')).toBeNull();
    expect(scene.getCatalogPickables()).toHaveLength(2);
    expect(points.material.uniforms['radiance']!.value).toBe(
      getPhotographicProfile(1, 'high').starRadiance,
    );
    expect(points.parent?.parent).toBe(stellarRoot);

    scene.selectCatalogObject(null);
    scene.dispose();
    expect(scene.catalogStarCount).toBe(0);
  });

  it('garde les cellules stellaires masquées tout en adaptant leur cache à la qualité', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const registry = constellationRegistry();

    await scene.setStarCatalog(registry);
    await scene.setStarClusterTiles([starClusterTile()], registry);
    scene.setQuality('low');
    scene.updateLod(3, 10);
    const clusterPoints = scene.spaceRoot.getObjectByName(
      'calculated-hyg-star-clusters-lod-3',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

    expect(scene.activeStarTileCount).toBe(1);
    expect(scene.visibleStarClusterCount).toBe(0);
    expect(clusterPoints.geometry.drawRange.count).toBe(1);

    scene.setQuality('high');
    expect(scene.visibleStarClusterCount).toBe(0);
    expect(clusterPoints.geometry.drawRange.count).toBe(2);
    scene.updateLod(3, 10);

    expect(clusterPoints.material.uniforms['radiance']!.value).toBe(
      getPhotographicProfile(3, 'high').starRadiance,
    );
    scene.updateLod(4, 10);
    expect(scene.visibleStarClusterCount).toBe(0);
    scene.updateLod(2, 10);
    expect(scene.visibleStarClusterCount).toBe(0);

    scene.dispose();
    expect(scene.activeStarTileCount).toBe(0);
  });

  it('partage le batch lorsque deux niveaux terminent leur chargement simultanément', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const registry = constellationRegistry();

    await scene.setStarCatalog(registry);
    await Promise.all([
      scene.setStarClusterTiles([starClusterTile()], registry),
      scene.setStarClusterTiles(
        [
          {
            ...starClusterTile(),
            id: 'overview',
            parentId: undefined,
            lodLevel: 4,
            cellSizeParsec: 160,
          },
        ],
        registry,
      ),
    ]);
    await scene.setStarClusterTiles(
      [
        starClusterTile(),
        {
          ...starClusterTile(),
          id: 'overview',
          parentId: undefined,
          lodLevel: 4,
          cellSizeParsec: 160,
        },
      ],
      registry,
    );

    expect(scene.activeStarTileCount).toBe(2);
    expect(scene.starClusterRepresentationCount).toBe(2);
    const stellarRoot = scene.spaceRoot.getObjectByName('solar-neighborhood-reference');

    expect(
      stellarRoot?.children.filter((child) => child.name === 'hyg-star-cluster-root'),
    ).toHaveLength(1);
    scene.dispose();
  });

  it('installe, masque, remplace et détruit la couche groupée des constellations', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const registry = constellationRegistry();

    await scene.setStarCatalog(registry);
    await scene.setConstellationCatalog(constellationCatalog(), registry);
    scene.setConstellationsEnabled(true);
    scene.updateLod(2, 10);

    const firstLines = scene.spaceRoot.getObjectByName(
      'illustrative-constellation-lines',
    ) as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

    expect(firstLines).toBeInstanceOf(THREE.LineSegments);
    expect(firstLines.visible).toBe(true);
    expect(firstLines.userData['segmentCount']).toBe(1);
    expect(scene.getCatalogPickables()).toContain(firstLines);
    expect(scene.constellationDefinitions).toHaveLength(1);
    expect(scene.hasConstellation('constellation-orion')).toBe(true);
    expect(scene.getConstellationDefinition('constellation-orion')?.name).toBe('Orion');
    expect(scene.getConstellationWorldPosition('constellation-orion')).toBeInstanceOf(
      THREE.Vector3,
    );
    expect(scene.getConstellationFocusRadius('constellation-orion')).toBeGreaterThan(0);

    scene.selectConstellation('constellation-orion');
    scene.hoverConstellation('constellation-orion');
    const highlight = scene.spaceRoot.getObjectByName(
      'highlighted-constellation-lines',
    ) as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

    expect(highlight.userData['objectId']).toBe('constellation-orion');

    scene.setConstellationsEnabled(false);
    scene.updateLod(2, 10);
    expect(firstLines.visible).toBe(false);
    expect(scene.getCatalogPickables()).not.toContain(firstLines);

    const firstGeometryDispose = vi.spyOn(firstLines.geometry, 'dispose');

    await scene.setConstellationCatalog(constellationCatalog(), registry);
    expect(firstGeometryDispose).toHaveBeenCalledOnce();

    scene.setConstellationsEnabled(true);
    scene.updateLod(4, 10);
    expect(scene.spaceRoot.getObjectByName('illustrative-constellation-lines')?.visible).toBe(
      false,
    );
    expect(scene.getConstellationDefinition('unknown')).toBeUndefined();
    expect(scene.getConstellationWorldPosition('unknown')).toBeNull();
    expect(scene.getConstellationFocusRadius('unknown')).toBeNull();
    scene.dispose();
  });

  it('libère tous les types de ressources Three.js ajoutés à la scène', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const texture = new THREE.Texture();
    const meshMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const secondMaterial = new THREE.MeshBasicMaterial();
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const meshGeometry = new THREE.BoxGeometry();
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial();
    const mesh = new THREE.Mesh(meshGeometry, [meshMaterial, secondMaterial]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    const sprite = new THREE.Sprite(spriteMaterial);
    const textureDispose = vi.spyOn(texture, 'dispose');
    const meshDispose = vi.spyOn(meshGeometry, 'dispose');
    const lineDispose = vi.spyOn(lineGeometry, 'dispose');

    scene.scene.add(mesh, line, sprite);
    scene.dispose();

    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(meshDispose).toHaveBeenCalledOnce();
    expect(lineDispose).toHaveBeenCalledOnce();
  });
});

function catalogRegistry(id: number): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    catalogIds: new Uint32Array([id]),
    positionsParsec: new Float32Array([1, 2, 3]),
    apparentMagnitudes: new Float32Array([0.5]),
    colorIndicesBv: new Float32Array([0.2]),
    names: [`Étoile ${id}`],
    aliases: [[]],
    spectralTypes: ['G2V'],
  };

  return new StarCatalogRegistry(catalog, new CoordinateSystem());
}

function cosmicWebVolume(resolution: number): CosmicWebVolume {
  return {
    resolution,
    halfExtentMpc: 800,
    referenceEpochJulianDay: 2_451_545,
    sourceGroupCount: 37_730,
    sourceEdgeCount: 49_939,
    density: new Uint8Array(resolution ** 3),
  };
}

function nearbyGalaxyIndex(): SpaceTileIndex {
  return {
    version: '2.0.0',
    tiles: [],
    searchEntries: [],
    overviewEntries: [
      {
        id: 'galaxy-a',
        position: [1, 2, -1],
        unit: 'megaparsec',
        color: '#9fc8ef',
        visualRadius: 18,
      },
      {
        id: 'galaxy-b',
        position: [-2, 0.5, 3],
        unit: 'megaparsec',
        color: '#e4bb91',
        visualRadius: 42,
      },
    ],
  };
}

function cosmicGroupRegistry(pgcId: number): CosmicGroupCatalogRegistry {
  const catalog: CosmicGroupCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12.1,
    maximumDistanceMpc: 12.1,
    positionsMpc: new Float32Array([12.1, 0, 0]),
    distancesMpc: new Float32Array([12.1]),
    distanceModulusErrors: new Float32Array([0.1]),
    velocitiesCmbKmPerSecond: new Int32Array([810]),
    pgcIds: new Uint32Array([pgcId]),
    distanceModuli: new Float32Array([30.413]),
    filamentPairs: new Uint32Array(),
  };

  return new CosmicGroupCatalogRegistry(catalog, new CoordinateSystem());
}

function cosmicStructureRegistry(identifier: string): CosmicStructureCatalogRegistry {
  const metadata: CosmicStructureCatalogMetadata = {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-main50',
        name: 'SDSS superclusters',
        citation: 'Liivamägi et al. (2012)',
        sourceUrl: 'https://example.test/superclusters',
        structureType: 'supercluster',
        method: 'Luminosity density field',
        objectNamePrefix: 'Superamas SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
  const distanceMpc = Math.hypot(-176.1, 163.7, -287.8);
  const catalog: CosmicStructureCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: distanceMpc,
    maximumDistanceMpc: distanceMpc,
    positionsMpc: new Float32Array([-176.1, 163.7, -287.8]),
    distancesMpc: new Float32Array([distanceMpc]),
    radiiMpc: new Float32Array([35.9]),
    confidences: new Float32Array([0.98]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array([1_038]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([1]),
    flags: new Uint8Array([0]),
    identifiers: [identifier],
    structureTypes: ['supercluster'],
    metadata,
  };

  return new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
}

function connectedCosmicGroupRegistry(): CosmicGroupCatalogRegistry {
  const positions = new Float32Array([
    12, 0, 0, 18, 1, 0, 24, -1, 1, 24, 7, 0, 30, 1, -1, 36, 0, 0,
  ]);
  const distances = Float32Array.from({ length: positions.length / 3 }, (_, index) =>
    Math.hypot(positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!),
  );
  const catalog: CosmicGroupCatalog = {
    count: distances.length,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: distances[0]!,
    maximumDistanceMpc: distances.at(-1)!,
    positionsMpc: positions,
    distancesMpc: distances,
    distanceModulusErrors: Float32Array.from(distances, (_, index) => 0.1 + index * 0.05),
    velocitiesCmbKmPerSecond: Int32Array.from(distances, (distance) => distance * 70),
    pgcIds: Uint32Array.from(distances, (_, index) => 100 + index),
    distanceModuli: Float32Array.from(distances, (distance) => 5 * Math.log10(distance) + 25),
    filamentPairs: new Uint32Array([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]),
  };

  return new CosmicGroupCatalogRegistry(catalog, new CoordinateSystem());
}

function starClusterTile(): StarClusterTile {
  return {
    id: 'detail',
    parentId: 'root',
    version: '2.0.0',
    sourceCatalog: 'hyg-v41-bright-stars',
    sourceStarCount: 2,
    referenceEpochJulianDay: 2_451_545,
    lodLevel: 3,
    cellSizeParsec: 40,
    clusterCount: 2,
    cellCoordinates: Int32Array.from([0, 0, 0, 1, 1, 1]),
    positionsParsec: Float32Array.from([1, 2, 3, 4, 5, 6]),
    starCounts: Uint32Array.from([1, 1]),
    apparentMagnitudes: Float32Array.from([0.5, 1]),
    colorIndicesBv: Float32Array.from([0.2, 0.6]),
  };
}

function constellationRegistry(): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    catalogIds: new Uint32Array([3_229, 6_960]),
    positionsParsec: new Float32Array([1, 2, 3, -2, 1, 4]),
    apparentMagnitudes: new Float32Array([0.5, 1.2]),
    colorIndicesBv: new Float32Array([0.2, 0.6]),
    names: ['Alpha', 'Beta'],
    aliases: [[], []],
    spectralTypes: ['A0', 'G0'],
  };

  return new StarCatalogRegistry(catalog, new CoordinateSystem());
}

function constellationCatalog(): ConstellationCatalog {
  return {
    version: '1.0.0',
    source: {
      name: 'Stellarium Modern sky culture',
      url: 'https://github.com/Stellarium/stellarium/tree/master/skycultures/modern',
      license: 'CC BY-SA 4.0',
    },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: 'HYG v4.1',
    figures: [
      {
        id: 'orion',
        name: 'Orion',
        abbreviation: 'Ori',
        segments: [[3_229, 6_960]],
      },
    ],
  };
}
