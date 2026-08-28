import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import {
  calculateGalacticContextLabelOpacity,
  findLabelHit,
  getMaximumCatalogLabelPoolRank,
  getMaximumCatalogLabelRank,
  getMaximumConstellationLabelRank,
  getMaximumCosmicLabelRank,
  getMaximumExoplanetHostLabelPoolRank,
  getMaximumExoplanetHostLabelRank,
  getMaximumLabelCount,
  getLabelTextColor,
  isLabelVisibleAtLevel,
  LabelManager,
  requiresDynamicLabelVisibility,
  type LabelObject,
  type LabelHitRegion,
  type ScreenRectangle,
} from './label-manager';
import { getMaximumGalaxyLabelRank } from './galaxy-map-policy';
import { moveRectangleToNearbyFreeSlot } from './label-screen-layout';

const regions: LabelHitRegion[] = [
  {
    objectId: 'sirius',
    rectangle: {
      left: 100,
      top: 80,
      right: 180,
      bottom: 104,
    },
  },
];

describe('zones interactives des labels', () => {
  it('reconnaît un clic directement sur le nom', () => {
    expect(findLabelHit(regions, 140, 92)).toBe('sirius');
  });

  it('élargit légèrement la zone de clic sans capter les zones éloignées', () => {
    expect(findLabelHit(regions, 95, 92)).toBe('sirius');
    expect(findLabelHit(regions, 80, 92)).toBeNull();
  });
});

describe('palette des noms astronomiques', () => {
  it.each([
    ['univers', 'universe', '#d7ccff'],
    ['amas de galaxies', 'galaxy-cluster', '#d7ccff'],
    ['galaxie', 'galaxy', '#c9b8ff'],
    ['nébuleuse', 'nebula', '#efb9dc'],
    ['trou noir', 'black-hole', '#ffb274'],
    ['supernova', 'supernova', '#ff9fc9'],
    ['rémanent de supernova', 'supernova-remnant', '#82dcff'],
    ['étoile', 'star', '#ffe7ad'],
    ['planète', 'planet', '#a9d4ff'],
    ['exoplanète', 'exoplanet', '#77e6cf'],
    ['planète naine', 'dwarf-planet', '#b9cfff'],
    ['lune', 'moon', '#d7dee8'],
    ['astéroïde', 'asteroid', '#dbbe93'],
    ['comète', 'comet', '#a8e4d4'],
    ['objet artificiel', 'artificial-object', '#bdcad7'],
    ['région', 'region', '#b9c8dc'],
  ] as const)('attribue une teinte stable à un objet de type %s', (_label, type, color) => {
    expect(getLabelTextColor(createLabelObject(`test-${type}`, type), false)).toBe(color);
  });

  it('distingue une constellation d’une région générique', () => {
    const constellation = createLabelObject('constellation-orion', 'region', {
      constellationLabelRank: 0,
    });

    expect(getLabelTextColor(constellation, false)).toBe('#8edff5');
    expect(getLabelTextColor(createLabelObject('local-group', 'region'), false)).toBe('#b9c8dc');
  });

  it('réserve le cyan lumineux au survol et à la sélection', () => {
    expect(getLabelTextColor(createLabelObject('earth', 'planet'), true)).toBe('#c8efff');
    expect(getLabelTextColor(createLabelObject('sirius', 'star'), true)).toBe('#c8efff');
  });

  it('regroupe les labels du Système solaire par famille cartographique', () => {
    expect(getLabelTextColor(createLabelObject('earth', 'planet'), false, 1)).toBe('#43b4dd');
    expect(getLabelTextColor(createLabelObject('mars', 'planet'), false, 0)).toBe('#d65e48');
    expect(getLabelTextColor(createLabelObject('moon', 'moon'), false, 0)).toBe('#43b4dd');
    expect(getLabelTextColor(createLabelObject('sun', 'star'), false, 2)).toBe('#ffd45c');
    expect(getLabelTextColor(createLabelObject('earth', 'planet'), true, 1)).toBe('#9ae8ff');
    expect(getLabelTextColor(createLabelObject('kepler-b', 'exoplanet'), false, 1)).toBe('#77e6cf');
  });
});

describe('hiérarchie des labels par échelle', () => {
  const star = createLabelObject('sirius', 'star', { galacticLabel: true });
  const secondaryStar = createLabelObject('procyon', 'star');
  const sun = createLabelObject('sun', 'star');
  const blackHole = createLabelObject('sagittarius-a-star', 'black-hole');
  const supernova = createLabelObject('sn-1987a', 'supernova');
  const remnant = createLabelObject('cassiopeia-a', 'supernova-remnant');
  const galaxy = createLabelObject('milky-way', 'galaxy');
  const neighboringGalaxy = createLabelObject('andromeda', 'galaxy', { mapLabelRank: 0 });
  const secondaryGalaxy = createLabelObject('fornax-dwarf', 'galaxy', { mapLabelRank: 18 });
  const faintGalaxy = createLabelObject('ugc-4879', 'galaxy', { mapLabelRank: 30 });
  const nearbyGalaxy = createLabelObject('bodes-galaxy', 'galaxy', {
    nearbyUniverseLabelRank: 3,
  });
  const region = createLabelObject('local-group', 'region');
  const constellation = createLabelObject('constellation-orion', 'region', {
    constellationLabelRank: 7,
  });
  const faintConstellation = createLabelObject('constellation-hydra', 'region', {
    constellationLabelRank: 31,
  });
  const brightestCatalogStar = createLabelObject('hyg-1', 'star', {
    catalogRecordIndex: 0,
  });
  const secondaryCatalogStar = createLabelObject('hyg-120', 'star', {
    catalogRecordIndex: 800,
  });
  const galacticCatalogStar = createLabelObject('hyg-50', 'star', {
    catalogRecordIndex: 50,
  });
  const lastHighQualityCatalogStar = createLabelObject('hyg-2999', 'star', {
    catalogRecordIndex: 2_399,
  });
  const excludedHighQualityCatalogStar = createLabelObject('hyg-3000', 'star', {
    catalogRecordIndex: 2_400,
  });
  const nearestExoplanetHost = createLabelObject('nea-host-nearby', 'star', {
    exoplanetHost: true,
    exoplanetHostRank: 0,
  });
  const ninthExoplanetHost = createLabelObject('nea-host-ninth', 'star', {
    exoplanetHost: true,
    exoplanetHostRank: 8,
  });
  const nearestCosmicGroup = createLabelObject('cf4-pgc-35', 'galaxy-cluster', {
    cosmicCatalogRank: 0,
  });
  const mediumCosmicGroup = createLabelObject('cf4-pgc-48', 'galaxy-cluster', {
    cosmicCatalogRank: 47,
  });
  const distantCosmicGroup = createLabelObject('cf4-pgc-72', 'galaxy-cluster', {
    cosmicCatalogRank: 71,
  });
  const documentedSupercluster = createLabelObject('lss-supercluster-1', 'supercluster', {
    cosmicStructureRank: 0,
  });
  const documentedVoidOutsideBudget = createLabelObject('lss-void-721', 'cosmic-void', {
    cosmicStructureRank: 720,
  });

  it('réserve tous les noms stellaires au voisinage', () => {
    expect(isLabelVisibleAtLevel(star, 0)).toBe(false);
    expect(isLabelVisibleAtLevel(star, 1)).toBe(true);
    expect(isLabelVisibleAtLevel(star, 2)).toBe(true);
    expect(isLabelVisibleAtLevel(star, 3)).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryStar, 3)).toBe(false);
    expect(isLabelVisibleAtLevel(star, 4)).toBe(false);
  });

  it('relaie le repère permanent du Soleil vers la Voie lactée', () => {
    for (const lodLevel of [0, 1, 2]) {
      expect(isLabelVisibleAtLevel(sun, lodLevel)).toBe(true);
      expect(isLabelVisibleAtLevel(galaxy, lodLevel)).toBe(false);
    }
    for (const lodLevel of [3, 4, 5, 6]) {
      expect(isLabelVisibleAtLevel(sun, lodLevel)).toBe(false);
      expect(isLabelVisibleAtLevel(galaxy, lodLevel)).toBe(true);
    }
  });

  it('révèle les trous noirs aux échelles stellaire et galactique', () => {
    expect(isLabelVisibleAtLevel(blackHole, 0)).toBe(false);
    expect(isLabelVisibleAtLevel(blackHole, 1)).toBe(true);
    expect(isLabelVisibleAtLevel(blackHole, 2)).toBe(true);
    expect(isLabelVisibleAtLevel(blackHole, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(blackHole, 4)).toBe(false);
  });

  it('révèle les supernovas et leurs rémanents du voisinage à la Voie lactée', () => {
    for (const object of [supernova, remnant]) {
      expect(isLabelVisibleAtLevel(object, 0)).toBe(false);
      expect(isLabelVisibleAtLevel(object, 1)).toBe(true);
      expect(isLabelVisibleAtLevel(object, 2)).toBe(true);
      expect(isLabelVisibleAtLevel(object, 3)).toBe(true);
      expect(isLabelVisibleAtLevel(object, 4)).toBe(false);
    }
  });

  it('réserve les labels PGC au réseau cosmique et les borne par qualité', () => {
    expect(isLabelVisibleAtLevel(nearestCosmicGroup, 5, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(nearestCosmicGroup, 6, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(mediumCosmicGroup, 6, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(mediumCosmicGroup, 6, 'medium')).toBe(true);
    expect(isLabelVisibleAtLevel(distantCosmicGroup, 6, 'medium')).toBe(false);
    expect(isLabelVisibleAtLevel(distantCosmicGroup, 6, 'high', 'dense')).toBe(true);
    expect(getMaximumCosmicLabelRank('low', 6)).toBe(24);
    expect(getMaximumCosmicLabelRank('medium', 6)).toBe(48);
    expect(getMaximumCosmicLabelRank('high', 6)).toBe(72);
    expect(getMaximumCosmicLabelRank('high', 5)).toBe(0);
    expect(getMaximumCosmicLabelRank('high', 6, 'minimal')).toBe(36);
    expect(getMaximumCosmicLabelRank('high', 6, 'dense')).toBe(108);
  });

  it('applique la même politique aux structures documentées sans les confondre avec les groupes', () => {
    expect(isLabelVisibleAtLevel(documentedSupercluster, 5, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(documentedSupercluster, 6, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(documentedVoidOutsideBudget, 6, 'high', 'balanced')).toBe(false);
    expect(isLabelVisibleAtLevel(documentedVoidOutsideBudget, 6, 'high', 'dense')).toBe(false);
  });

  it('révèle les galaxies visibles dans leur contexte et adapte leur densité', () => {
    expect(isLabelVisibleAtLevel(galaxy, 2)).toBe(false);
    expect(isLabelVisibleAtLevel(galaxy, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(neighboringGalaxy, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(neighboringGalaxy, 4)).toBe(true);
    expect(isLabelVisibleAtLevel(secondaryGalaxy, 4, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryGalaxy, 4, 'medium', 'minimal')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryGalaxy, 4, 'medium', 'balanced')).toBe(true);
    expect(isLabelVisibleAtLevel(faintGalaxy, 4, 'medium')).toBe(false);
    expect(isLabelVisibleAtLevel(faintGalaxy, 4, 'high', 'dense')).toBe(true);
    expect(isLabelVisibleAtLevel(nearbyGalaxy, 4, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(nearbyGalaxy, 5, 'high')).toBe(true);
    expect(getMaximumGalaxyLabelRank('low')).toBe(12);
    expect(getMaximumGalaxyLabelRank('medium')).toBe(24);
    expect(getMaximumGalaxyLabelRank('high')).toBe(40);
    expect(getMaximumGalaxyLabelRank('high', 'minimal')).toBe(20);
    expect(getMaximumGalaxyLabelRank('high', 'dense')).toBe(60);
  });

  it('révèle progressivement les noms HYG selon l’échelle', () => {
    expect(isLabelVisibleAtLevel(brightestCatalogStar, 0, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(brightestCatalogStar, 3, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 0, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 2, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 3, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 0, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 3, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 4, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(lastHighQualityCatalogStar, 2, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(excludedHighQualityCatalogStar, 2, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1, 'medium', 'minimal')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1, 'medium', 'dense')).toBe(true);
  });

  it('réserve une part bornée de la carte aux étoiles hôtes d’exoplanètes', () => {
    expect(isLabelVisibleAtLevel(nearestExoplanetHost, 0, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(nearestExoplanetHost, 1, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(nearestExoplanetHost, 2, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(nearestExoplanetHost, 3, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(ninthExoplanetHost, 1, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(ninthExoplanetHost, 1, 'high', 'dense')).toBe(true);
    expect(getMaximumExoplanetHostLabelRank('low', 1)).toBe(2);
    expect(getMaximumExoplanetHostLabelRank('medium', 2)).toBe(4);
    expect(getMaximumExoplanetHostLabelRank('high', 0)).toBe(4);
    expect(getMaximumExoplanetHostLabelRank('high', 1, 'minimal')).toBe(4);
    expect(getMaximumExoplanetHostLabelRank('high', 1, 'dense')).toBe(12);
    expect(getMaximumExoplanetHostLabelRank('high', 99)).toBe(0);
    expect(getMaximumExoplanetHostLabelPoolRank('low', 'minimal')).toBe(1);
    expect(getMaximumExoplanetHostLabelPoolRank('medium', 'balanced')).toBe(4);
    expect(getMaximumExoplanetHostLabelPoolRank('high', 'dense')).toBe(12);
  });

  it('réserve la visibilité dynamique aux objets liés à une couche ou à un disque', () => {
    expect(requiresDynamicLabelVisibility(brightestCatalogStar)).toBe(true);
    expect(requiresDynamicLabelVisibility(nearestExoplanetHost)).toBe(true);
    expect(requiresDynamicLabelVisibility(nearestCosmicGroup)).toBe(true);
    expect(requiresDynamicLabelVisibility(constellation)).toBe(true);
    expect(requiresDynamicLabelVisibility(createLabelObject('earth', 'planet'))).toBe(true);
  });

  it('ne transforme pas une région de navigation en objet cartographique', () => {
    expect(isLabelVisibleAtLevel(region, 4)).toBe(false);
  });

  it('affiche un nombre borné de constellations selon la qualité et l’échelle', () => {
    expect(isLabelVisibleAtLevel(constellation, 0, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(constellation, 2, 'medium')).toBe(true);
    expect(isLabelVisibleAtLevel(constellation, 3, 'medium')).toBe(false);
    expect(isLabelVisibleAtLevel(faintConstellation, 2, 'medium')).toBe(false);
    expect(isLabelVisibleAtLevel(faintConstellation, 2, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(constellation, 4, 'high')).toBe(false);
    expect(getMaximumConstellationLabelRank('low', 0)).toBe(8);
    expect(getMaximumConstellationLabelRank('medium', 1)).toBe(22);
    expect(getMaximumConstellationLabelRank('high', 2)).toBe(32);
    expect(getMaximumConstellationLabelRank('high', 3)).toBe(0);
    expect(getMaximumConstellationLabelRank('high', 99)).toBe(0);
    expect(getMaximumConstellationLabelRank('high', 2, 'minimal')).toBe(16);
    expect(getMaximumConstellationLabelRank('high', 2, 'dense')).toBe(48);
  });

  it('borne la densité selon le profil, la qualité et le niveau de détail', () => {
    expect(getMaximumCatalogLabelRank('low', 0)).toBe(400);
    expect(getMaximumCatalogLabelRank('medium', 1)).toBe(1_400);
    expect(getMaximumCatalogLabelRank('high', 2)).toBe(2_400);
    expect(getMaximumCatalogLabelRank('high', 3)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 4)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 5)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 99)).toBe(0);
    expect(getMaximumLabelCount('low', 2)).toBe(28);
    expect(getMaximumLabelCount('medium', 2)).toBe(56);
    expect(getMaximumLabelCount('high', 2)).toBe(80);
    expect(getMaximumLabelCount('high', 0)).toBe(64);
    expect(getMaximumLabelCount('high', 3)).toBe(72);
    expect(getMaximumLabelCount('high', 4)).toBe(36);
    expect(getMaximumLabelCount('high', 5)).toBe(48);
    expect(getMaximumLabelCount('high', 6)).toBe(24);
    expect(getMaximumLabelCount('high', 99)).toBe(72);
    expect(getMaximumLabelCount('low', 2, 'minimal')).toBe(14);
    expect(getMaximumLabelCount('medium', 2, 'dense')).toBe(84);
    expect(getMaximumLabelCount('high', 2, 'minimal')).toBe(40);
    expect(getMaximumLabelCount('high', 2, 'dense')).toBe(120);
    expect(getMaximumCatalogLabelRank('high', 2, 'minimal')).toBe(1_200);
    expect(getMaximumCatalogLabelRank('high', 2, 'dense')).toBe(3_600);
    expect(getMaximumCatalogLabelPoolRank('low', 'minimal')).toBe(350);
    expect(getMaximumCatalogLabelPoolRank('medium', 'balanced')).toBe(1_400);
    expect(getMaximumCatalogLabelPoolRank('high', 'dense')).toBe(3_600);
  });
});

describe('LabelManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signale explicitement l’absence de Canvas 2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => new LabelManager(document.createElement('div'), [], 'medium')).toThrow(
      'Canvas 2D indisponible',
    );
  });

  it('gère son cycle de vie, ses dimensions, sa qualité et ses zones de clic', () => {
    const context = installContext();
    const container = document.createElement('div');
    const manager = new LabelManager(container, [], 'medium');
    const access = manager as unknown as LabelManagerAccess;

    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);

    manager.setEnabled(true);
    manager.setEnabled(false);
    manager.setEnabled(false);
    expect(manager.hitTest(10, 10)).toBeNull();
    manager.setEnabled(true);

    manager.resize(0, 100);
    manager.resize(100, 0);
    manager.resize(400, 300);
    expect(access.canvas.width).toBe(500);
    expect(access.canvas.height).toBe(375);
    manager.resize(400, 300);
    manager.setQuality('medium');
    expect(access.canvas.width).toBe(500);
    expect(access.canvas.height).toBe(375);
    manager.setQuality('high');
    expect(access.canvas.width).toBe(600);
    expect(access.canvas.height).toBe(450);
    manager.setQuality('low');
    manager.setQuality('medium');
    manager.setDensity('balanced');
    manager.setDensity('dense');
    manager.setDensity('dense');
    manager.setDensity('minimal');
    manager.setTransientObject(createLabelObject('temporary', 'star'));
    manager.setHoveredObject('temporary');
    manager.setHoveredObject('temporary');
    manager.setHoveredObject(null);
    manager.setTransitioning(true);
    manager.setTransitioning(false);

    Object.defineProperty(access.canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 400, height: 300 }),
    });
    access.hitRegions.push({
      objectId: 'earth',
      rectangle: { left: 90, top: 70, right: 130, bottom: 100 },
    });
    expect(manager.hitTest(120, 115)).toBe('earth');
    expect(manager.hitTest(300, 200)).toBeNull();

    manager.clear();
    expect(context.clearRect).toHaveBeenCalled();
    manager.dispose();
    expect(container.childElementCount).toBe(0);
    expect(access.hitRegions).toEqual([]);
  });

  it('résout les noms affichés sans coupler le moteur à une langue', () => {
    const context = installContext();
    const earth = createLabelObject('earth', 'planet');
    const manager = new LabelManager(
      document.createElement('div'),
      [earth],
      'high',
      'balanced',
      () => true,
      (objectId, fallback) => (objectId === 'earth' ? 'Earth' : fallback),
    );
    const camera = cameraForLabels();
    const reader = (_id: string, target: THREE.Vector3): THREE.Vector3 => target.set(0, 0, 0);

    manager.resize(400, 300);
    manager.render(camera, reader, 1, null, 1_000);
    expect(context.measureText).toHaveBeenCalledWith('Earth');
    expect(context.fillText).toHaveBeenCalledWith(
      'Earth',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );

    manager.setNameResolver((objectId, fallback) => (objectId === 'earth' ? 'Erde' : fallback));
    manager.render(camera, reader, 1, null, 1_500);
    expect(context.fillText).toHaveBeenLastCalledWith(
      'Erde',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    manager.dispose();
  });

  it('fond les labels du voisinage local tout en conservant les repères actifs', () => {
    const context = installContext();
    const earth = createLabelObject('earth', 'planet');
    const exoplanet = createLabelObject('kepler-b', 'exoplanet');
    const sirius = createLabelObject('sirius', 'star');
    const sun = createLabelObject('sun', 'star');
    const manager = new LabelManager(
      document.createElement('div'),
      [earth, exoplanet, sirius, sun],
      'high',
    );
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['earth', new THREE.Vector3(-0.7, -0.2, 0)],
      ['kepler-b', new THREE.Vector3(0, 0.2, 0)],
      ['sirius', new THREE.Vector3(0.35, -0.45, 0)],
      ['sun', new THREE.Vector3(0.7, -0.2, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };
    const painted = new Map<string, number>();

    context.fillText.mockImplementation((text: string) => {
      painted.set(text, context.globalAlpha);
    });
    manager.resize(800, 400);
    manager.render(camera, reader, 2, null, 1_000, 0);

    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['sun']);
    expect(painted).toEqual(new Map([['sun', 1]]));

    painted.clear();
    manager.render(camera, reader, 2, null, 1_500, 0.5);
    expect(painted.get('earth')).toBe(0.5);
    expect(painted.get('kepler-b')).toBe(0.5);
    expect(painted.get('sirius')).toBe(0.5);
    expect(painted.get('sun')).toBe(1);

    painted.clear();
    manager.render(camera, reader, 2, 'earth', 2_000, 0);
    expect(painted.get('earth')).toBe(1);
    expect(painted.has('kepler-b')).toBe(false);

    painted.clear();
    manager.setHoveredObject('kepler-b');
    manager.render(camera, reader, 2, null, 2_500, 0);
    expect(painted.get('kepler-b')).toBe(1);
    manager.dispose();
  });

  it('efface les galaxies de contexte pendant la plongée sans masquer le repère actif', () => {
    const context = installContext();
    const draco = createLabelObject('draco-dwarf', 'galaxy', { mapLabelRank: 0 });
    const sun = createLabelObject('sun', 'star');
    const manager = new LabelManager(document.createElement('div'), [draco, sun], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['draco-dwarf', new THREE.Vector3(-0.5, 0, 0)],
      ['sun', new THREE.Vector3(0.5, 0, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };
    const painted = new Map<string, number>();

    context.fillText.mockImplementation((text: string) => {
      painted.set(text, context.globalAlpha);
    });
    manager.resize(800, 400);
    manager.render(camera, reader, 3, 'sun', 1_000, 1, 0);

    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['sun']);
    expect(painted).toEqual(new Map([['sun', 1]]));

    painted.clear();
    manager.render(camera, reader, 3, 'sun', 1_500, 1, 0.5);
    expect(painted.get('draco-dwarf')).toBe(0.5);
    expect(painted.get('sun')).toBe(1);

    painted.clear();
    manager.render(camera, reader, 3, 'draco-dwarf', 2_000, 1, 0);
    expect(painted.get('draco-dwarf')).toBe(1);
    manager.dispose();
  });

  it('calcule un fondu doux et borné des annotations galactiques', () => {
    expect(calculateGalacticContextLabelOpacity(7_000)).toBe(1);
    expect(calculateGalacticContextLabelOpacity(6_000)).toBe(0.5);
    expect(calculateGalacticContextLabelOpacity(5_000)).toBe(0);
    expect(calculateGalacticContextLabelOpacity(0)).toBe(0);
    expect(calculateGalacticContextLabelOpacity(Number.POSITIVE_INFINITY)).toBe(1);
    expect(calculateGalacticContextLabelOpacity(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(calculateGalacticContextLabelOpacity(Number.NaN)).toBe(1);
  });

  it('réduit uniquement la cadence des labels pendant une transition caméra', () => {
    const context = installContext();
    const manager = new LabelManager(
      document.createElement('div'),
      [createLabelObject('earth', 'planet')],
      'high',
    );
    const camera = cameraForLabels();
    const reader = (_id: string, target: THREE.Vector3): THREE.Vector3 => target.set(0, 0, 0);

    manager.resize(400, 300);
    manager.setTransitioning(true);
    manager.render(camera, reader, 1, null, 1_000);
    manager.render(camera, reader, 1, null, 1_050);
    expect(context.fillText).toHaveBeenCalledTimes(1);

    manager.setTransitioning(false);
    manager.render(camera, reader, 1, null, 1_050);
    expect(context.fillText).toHaveBeenCalledTimes(2);
    manager.dispose();
  });

  it('borne le travail de placement lorsque trop de candidats se chevauchent', () => {
    const context = installContext();
    const objects = Array.from({ length: 900 }, (_, index) =>
      createLabelObject(`hyg-${index}`, 'star', { catalogRecordIndex: index }),
    );
    const manager = new LabelManager(document.createElement('div'), objects, 'high');
    const camera = cameraForLabels();
    const reader = (_id: string, target: THREE.Vector3): THREE.Vector3 => target.set(0, 0, 0);

    manager.resize(400, 300);
    manager.render(camera, reader, 0, null, 1_000);

    expect(context.measureText).toHaveBeenCalledTimes(64 * 8);
    manager.dispose();
  });

  it('ne crée aucun label pour un objet masqué par la carte courante', () => {
    installContext();
    const visible = createLabelObject('visible', 'planet');
    const hidden = createLabelObject('hidden', 'planet');
    const hiddenConstellation = createLabelObject('constellation-hidden', 'region', {
      constellationLabelRank: 0,
    });
    const manager = new LabelManager(
      document.createElement('div'),
      [visible, hidden, hiddenConstellation],
      'high',
      'balanced',
      (objectId) => objectId !== 'hidden' && objectId !== 'constellation-hidden',
    );
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['visible', new THREE.Vector3(-0.4, 0, 0)],
      ['hidden', new THREE.Vector3(0.4, 0, 0)],
      ['constellation-hidden', new THREE.Vector3(0, 0.4, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    manager.resize(400, 300);
    manager.render(camera, reader, 1, null, 1_000);

    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['visible']);
    manager.dispose();
  });

  it('épingle le repère d’échelle au bord de l’écran lorsqu’il est hors champ', () => {
    installContext();
    const sun = createLabelObject('sun', 'star');
    const milkyWay = createLabelObject('milky-way', 'galaxy');
    const manager = new LabelManager(
      document.createElement('div'),
      [sun, milkyWay],
      'high',
      'balanced',
      () => false,
    );
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['sun', new THREE.Vector3(0, 0, 20)],
      ['milky-way', new THREE.Vector3(-3, -3, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    manager.resize(800, 300);
    manager.render(camera, reader, 0, null, 1_000);
    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['sun']);
    expect(access.hitRegions[0]?.rectangle).toMatchObject({ top: 76 });

    positions.get('sun')!.x = 1;
    manager.render(camera, reader, 0, null, 1_500);
    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['sun']);

    manager.render(camera, reader, 5, null, 2_000);
    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['milky-way']);
    expect(access.hitRegions[0]!.rectangle.left).toBeGreaterThanOrEqual(8);
    expect(access.hitRegions[0]!.rectangle.right).toBeLessThanOrEqual(792);
    expect(access.hitRegions[0]!.rectangle.bottom).toBeLessThanOrEqual(212);

    positions.get('milky-way')!.y = 0;
    manager.render(camera, reader, 5, null, 3_000);
    expect(access.hitRegions[0]!.rectangle.top).toBeGreaterThan(76);
    expect(access.hitRegions[0]!.rectangle.bottom).toBeLessThan(212);
    manager.dispose();
  });

  it('écarte le Soleil de la fiche ouverte sans modifier sa direction cartographique', () => {
    installContext();
    const sun = createLabelObject('sun', 'star');
    const manager = new LabelManager(document.createElement('div'), [sun], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const reader = (_id: string, target: THREE.Vector3): THREE.Vector3 => target.set(-3, 0, 0);

    manager.resize(1_440, 900);
    manager.setDetailsPanelVisible(true);
    manager.render(camera, reader, 0, 'mars', 1_000);

    expect(access.hitRegions).toHaveLength(1);
    expect(access.hitRegions[0]?.objectId).toBe('sun');
    expect(access.hitRegions[0]!.rectangle.left).toBeGreaterThanOrEqual(390);
    expect(access.hitRegions[0]!.rectangle.right).toBeLessThan(1_368);

    manager.setDetailsPanelVisible(false);
    manager.render(camera, reader, 0, null, 1_500);
    expect(access.hitRegions[0]!.rectangle.left).toBe(8);
    manager.dispose();
  });

  it('conserve le repère d’échelle sans recouvrir les autres labels', () => {
    installContext();
    const earth = createLabelObject('earth', 'planet');
    const sun = createLabelObject('sun', 'star');
    const manager = new LabelManager(document.createElement('div'), [earth, sun], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const position = new THREE.Vector3(-0.9, 0.25, 0);
    const reader = (_id: string, target: THREE.Vector3): THREE.Vector3 => target.copy(position);

    manager.resize(800, 300);
    manager.render(camera, reader, 0, null, 1_000);

    expect(access.hitRegions.map(({ objectId }) => objectId)).toEqual(['earth', 'sun']);
    expect(
      rectanglesOverlap(access.hitRegions[0]!.rectangle, access.hitRegions[1]!.rectangle),
    ).toBe(false);
    manager.dispose();
  });

  it('rend les candidats, applique les exclusions écran et respecte le plafond', () => {
    const context = installContext();
    const manager = new LabelManager(document.createElement('div'), [], 'low');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const center = new THREE.Vector3(0, 0, 0);
    const positions = new Map<string, THREE.Vector3 | null>([
      ['null', null],
      ['behind', new THREE.Vector3(0, 0, 20)],
      ['outside', new THREE.Vector3(3, 0, 0)],
      ['left', new THREE.Vector3(-0.98, 0, 0)],
      ['right', new THREE.Vector3(0.98, 0, 0)],
      ['center', center],
      ['black-hole', new THREE.Vector3(0.2, 0.2, 0)],
      ['selected', center],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.has(id) ? positions.get(id)! : center;

      return position ? target.copy(position) : null;
    };

    manager.resize(400, 300);
    const candidates: LabelCandidateTest[] = [];

    vi.spyOn(access, 'collectCandidates').mockImplementation(() => candidates);

    candidates.push(
      candidate('null'),
      candidate('behind'),
      candidate('outside'),
      candidate('left'),
      candidate('right'),
      candidate('center', 'planet'),
      candidate('black-hole', 'black-hole'),
    );
    manager.render(camera, reader, 1, null, 1_000);
    manager.render(camera, reader, 1, null, 1_001);

    expect(context.fillText).toHaveBeenCalled();
    expect(access.hitRegions.length).toBeGreaterThan(0);

    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    candidates.length = 0;
    for (let index = 0; index < 28; index += 1) {
      candidates.push(candidate(`visible-${index}`));
    }
    candidates.push(candidate('selected', 'star', true), candidate('never-rendered'));
    manager.render(camera, reader, 1, 'selected', 2_000);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'selected')).toBe(true);

    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    candidates.length = 0;
    for (let index = 0; index < 28; index += 1) {
      candidates.push(candidate(`budgeted-${index}`));
    }
    candidates.push(candidate('sun'));
    manager.render(camera, reader, 1, null, 2_250);
    expect(access.hitRegions.length).toBeGreaterThan(0);
    expect(access.hitRegions.length).toBeLessThanOrEqual(28);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'sun')).toBe(true);

    manager.resize(1_000, 500);
    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    candidates.length = 0;
    const budgetPositions = [
      [-0.8, 0.5],
      [-0.4, 0.5],
      [0, 0.5],
      [0.4, 0.5],
      [0.8, 0.5],
      [-0.8, -0.5],
      [-0.4, -0.5],
      [0, -0.5],
      [0.4, -0.5],
      [0.8, -0.5],
    ] as const;

    for (const [index, [x, y]] of budgetPositions.entries()) {
      const id = `cosmic-budget-${index}`;
      const worldPosition = new THREE.Vector3(x, y, 0);

      positions.set(id, worldPosition);
      candidates.push(candidate(id, 'star', false, worldPosition));
    }
    positions.set('over-budget', new THREE.Vector3(0, 0, 0));
    candidates.push(candidate('over-budget'));
    manager.render(camera, reader, 6, null, 2_400);
    expect(access.hitRegions).toHaveLength(10);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'over-budget')).toBe(false);

    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    candidates.length = 0;
    candidates.push(candidate('center'), candidate('center-collision'));
    manager.render(camera, reader, 1, null, 2_500);

    manager.setEnabled(false);
    manager.render(camera, reader, 1, null, 3_000);
  });

  it('décale les noms planétaires en collision dans la vue du Système solaire', () => {
    installContext();
    const earth = createLabelObject('earth', 'planet');
    const mars = createLabelObject('mars', 'planet');
    const manager = new LabelManager(document.createElement('div'), [earth, mars], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['earth', new THREE.Vector3(0, 0, 0)],
      ['mars', new THREE.Vector3(0.015, 0, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    manager.resize(800, 500);
    manager.render(camera, reader, 1, null, 1_000);

    expect(access.hitRegions.map(({ objectId }) => objectId).sort()).toEqual(['earth', 'mars']);
    expect(
      rectanglesOverlap(access.hitRegions[0]!.rectangle, access.hitRegions[1]!.rectangle),
    ).toBe(false);
    manager.dispose();
  });

  it('abandonne proprement le décalage lorsqu’aucun emplacement sûr n’existe', () => {
    installContext();
    const manager = new LabelManager(document.createElement('div'), [], 'high');
    const rectangle = { left: 20, top: 40, right: 60, bottom: 67 };

    manager.resize(80, 100);

    expect(
      moveRectangleToNearbyFreeSlot(rectangle, [], {
        viewportWidth: 80,
        viewportHeight: 100,
        safeTop: 76,
        safeBottom: 88,
      }),
    ).toBe(false);
    expect(rectangle).toEqual({ left: 20, top: 40, right: 60, bottom: 67 });
    manager.dispose();
  });

  it('occulte les noms situés derrière le disque apparent d’un corps proche', () => {
    installContext();
    const venus = createLabelObject('venus', 'planet');
    const behindStar: LabelObject = {
      id: 'behind-star',
      name: 'Étoile masquée',
      type: 'star',
      visual: { visualRadius: 0.08 },
    };
    const frontStar: LabelObject = {
      id: 'front-star',
      name: 'Étoile proche',
      type: 'star',
      visual: { visualRadius: 0.08 },
    };
    const manager = new LabelManager(
      document.createElement('div'),
      [venus, behindStar, frontStar],
      'high',
    );
    const access = manager as unknown as LabelManagerAccess;
    const camera = new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 100);
    const positions = new Map<string, THREE.Vector3>([
      ['venus', new THREE.Vector3(0, 0, 0)],
      ['behind-star', new THREE.Vector3(0, 0, -10)],
      ['front-star', new THREE.Vector3(0, 0, 5)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    venus.visual.visualRadius = 2;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    manager.resize(400, 300);
    manager.render(camera, reader, 1, null, 1_000);

    expect(access.hitRegions.some(({ objectId }) => objectId === 'behind-star')).toBe(false);
    expect(access.hitRegions.length).toBeGreaterThan(0);
    manager.dispose();
  });

  it('occulte aussi le nom sélectionné lorsqu’il passe derrière une étoile', () => {
    installContext();
    const sun = createLabelObject('sun', 'star');
    const selectedPlanet = createLabelObject('earth', 'planet');
    const manager = new LabelManager(document.createElement('div'), [sun, selectedPlanet], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const camera = new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 100);
    const positions = new Map<string, THREE.Vector3>([
      ['sun', new THREE.Vector3(0, 0, 0)],
      ['earth', new THREE.Vector3(0, 0, -10)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    sun.visual.visualRadius = 2;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    manager.resize(400, 300);
    manager.render(camera, reader, 1, 'earth', 1_000);

    expect(access.hitRegions.some(({ objectId }) => objectId === 'earth')).toBe(false);
    manager.dispose();
  });
});

interface LabelCandidateTest {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
  worldX: number;
  worldY: number;
  worldZ: number;
}

interface LabelManagerAccess {
  readonly canvas: HTMLCanvasElement;
  readonly hitRegions: LabelHitRegion[];
  lastRenderTime: number;
  collectCandidates(
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
    lodLevel: number,
    selectedId: string | null,
  ): readonly LabelCandidateTest[];
}

interface ContextSpies {
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly fillText: ReturnType<typeof vi.fn>;
  readonly measureText: ReturnType<typeof vi.fn>;
  readonly stroke: ReturnType<typeof vi.fn>;
  readonly font: string;
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly globalAlpha: number;
}

function installContext(measuredWidth = 80): ContextSpies {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn(() => ({ width: measuredWidth })),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );

  return context;
}

function cameraForLabels(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}

function candidate(
  id: string,
  type: SpaceObject['type'] = 'star',
  selected = false,
  worldPosition = new THREE.Vector3(),
): LabelCandidateTest {
  return {
    object: createLabelObject(id, type),
    distanceSquared: 1,
    priority: 0,
    selected,
    worldX: worldPosition.x,
    worldY: worldPosition.y,
    worldZ: worldPosition.z,
  };
}

function createLabelObject(
  id: string,
  type: SpaceObject['type'],
  metadata?: SpaceObject['metadata'],
): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'galaxy' ? 'galactic' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
    ...(metadata ? { metadata } : {}),
  };
}

function rectanglesOverlap(left: ScreenRectangle, right: ScreenRectangle): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}
