import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import {
  findLabelHit,
  getMaximumCatalogLabelPoolRank,
  getMaximumCatalogLabelRank,
  getMaximumConstellationLabelRank,
  getMaximumCosmicLabelRank,
  getMaximumLabelCount,
  getLabelTextColor,
  isLabelVisibleAtLevel,
  LabelManager,
  type LabelObject,
  type LabelHitRegion,
  type ScreenRectangle,
} from './label-manager';
import { getMaximumGalaxyLabelRank } from './galaxy-map-policy';

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
    ['étoile', 'star', '#ffe7ad'],
    ['planète', 'planet', '#a9d4ff'],
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
});

describe('hiérarchie des labels par échelle', () => {
  const star = createLabelObject('sirius', 'star', { galacticLabel: true });
  const secondaryStar = createLabelObject('procyon', 'star');
  const sun = createLabelObject('sun', 'star');
  const blackHole = createLabelObject('sagittarius-a-star', 'black-hole');
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
    constellationLabelRank: 43,
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
    catalogRecordIndex: 2_999,
  });
  const excludedHighQualityCatalogStar = createLabelObject('hyg-3000', 'star', {
    catalogRecordIndex: 3_000,
  });
  const nearestCosmicGroup = createLabelObject('cf4-pgc-35', 'galaxy-cluster', {
    cosmicCatalogRank: 0,
  });
  const mediumCosmicGroup = createLabelObject('cf4-pgc-240', 'galaxy-cluster', {
    cosmicCatalogRank: 239,
  });
  const distantCosmicGroup = createLabelObject('cf4-pgc-500', 'galaxy-cluster', {
    cosmicCatalogRank: 499,
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

  it('réserve les labels PGC au réseau cosmique et les borne par qualité', () => {
    expect(isLabelVisibleAtLevel(nearestCosmicGroup, 5, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(nearestCosmicGroup, 6, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(mediumCosmicGroup, 6, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(mediumCosmicGroup, 6, 'medium')).toBe(true);
    expect(isLabelVisibleAtLevel(distantCosmicGroup, 6, 'medium')).toBe(false);
    expect(isLabelVisibleAtLevel(distantCosmicGroup, 6, 'high', 'dense')).toBe(true);
    expect(getMaximumCosmicLabelRank('low', 6)).toBe(120);
    expect(getMaximumCosmicLabelRank('medium', 6)).toBe(240);
    expect(getMaximumCosmicLabelRank('high', 6)).toBe(480);
    expect(getMaximumCosmicLabelRank('high', 5)).toBe(0);
    expect(getMaximumCosmicLabelRank('high', 6, 'minimal')).toBe(240);
    expect(getMaximumCosmicLabelRank('high', 6, 'dense')).toBe(720);
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
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 2, 'low')).toBe(true);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 3, 'low')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 0, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 3, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 4, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(lastHighQualityCatalogStar, 2, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(excludedHighQualityCatalogStar, 2, 'high')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1, 'medium', 'minimal')).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1, 'medium', 'dense')).toBe(true);
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
    expect(getMaximumConstellationLabelRank('high', 2)).toBe(44);
    expect(getMaximumConstellationLabelRank('high', 3)).toBe(0);
    expect(getMaximumConstellationLabelRank('high', 99)).toBe(0);
    expect(getMaximumConstellationLabelRank('high', 2, 'minimal')).toBe(22);
    expect(getMaximumConstellationLabelRank('high', 2, 'dense')).toBe(66);
  });

  it('borne la densité selon le profil, la qualité et le niveau de détail', () => {
    expect(getMaximumCatalogLabelRank('low', 0)).toBe(400);
    expect(getMaximumCatalogLabelRank('medium', 1)).toBe(1_400);
    expect(getMaximumCatalogLabelRank('high', 2)).toBe(3_000);
    expect(getMaximumCatalogLabelRank('high', 3)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 4)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 5)).toBe(0);
    expect(getMaximumCatalogLabelRank('high', 99)).toBe(0);
    expect(getMaximumLabelCount('low', 2)).toBe(28);
    expect(getMaximumLabelCount('medium', 2)).toBe(56);
    expect(getMaximumLabelCount('high', 2)).toBe(96);
    expect(getMaximumLabelCount('high', 0)).toBe(64);
    expect(getMaximumLabelCount('high', 3)).toBe(72);
    expect(getMaximumLabelCount('high', 4)).toBe(36);
    expect(getMaximumLabelCount('high', 5)).toBe(48);
    expect(getMaximumLabelCount('high', 6)).toBe(72);
    expect(getMaximumLabelCount('high', 99)).toBe(72);
    expect(getMaximumLabelCount('low', 2, 'minimal')).toBe(14);
    expect(getMaximumLabelCount('medium', 2, 'dense')).toBe(84);
    expect(getMaximumLabelCount('high', 2, 'minimal')).toBe(48);
    expect(getMaximumLabelCount('high', 2, 'dense')).toBe(144);
    expect(getMaximumCatalogLabelRank('high', 2, 'minimal')).toBe(1_500);
    expect(getMaximumCatalogLabelRank('high', 2, 'dense')).toBe(4_500);
    expect(getMaximumCatalogLabelPoolRank('low', 'minimal')).toBe(500);
    expect(getMaximumCatalogLabelPoolRank('medium', 'balanced')).toBe(2_200);
    expect(getMaximumCatalogLabelPoolRank('high', 'dense')).toBe(4_500);
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

    manager.setEnabled(true);
    manager.setEnabled(false);
    manager.setEnabled(false);
    expect(manager.hitTest(10, 10)).toBeNull();
    manager.setEnabled(true);

    manager.resize(0, 100);
    manager.resize(100, 0);
    manager.resize(400, 300);
    manager.setQuality('medium');
    manager.setQuality('high');
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
    expect(access.candidates).toEqual([]);
    expect(access.occupiedRectangles).toEqual([]);
    expect(access.hitRegions).toEqual([]);
  });

  it('collecte, classe et complète les candidats visibles', () => {
    installContext();
    const objects: LabelObject[] = [
      createLabelObject('region', 'region'),
      createLabelObject('hidden-planet', 'planet'),
      createLabelObject('near-star', 'star'),
      createLabelObject('catalog-2', 'star', { catalogRecordIndex: 2 }),
      createLabelObject('catalog-1', 'star', { catalogRecordIndex: 1 }),
      createLabelObject('ranked-galaxy', 'galaxy', { mapLabelRank: 2 }),
      createLabelObject('nearby-galaxy', 'galaxy', { nearbyUniverseLabelRank: 3 }),
      createLabelObject('cf4-pgc-35', 'galaxy-cluster', { cosmicCatalogRank: 0 }),
      createLabelObject('unranked-galaxy', 'galaxy'),
      createLabelObject('constellation-orion', 'region', { constellationLabelRank: 0 }),
    ];
    const manager = new LabelManager(document.createElement('div'), objects, 'medium');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['near-star', new THREE.Vector3(0.1, 0, 0)],
      ['catalog-2', new THREE.Vector3(0.2, 0, 0)],
      ['catalog-1', new THREE.Vector3(0.3, 0, 0)],
      ['ranked-galaxy', new THREE.Vector3(0.4, 0, 0)],
      ['nearby-galaxy', new THREE.Vector3(-0.4, 0, 0)],
      ['cf4-pgc-35', new THREE.Vector3(-0.25, 0.25, 0)],
      ['unranked-galaxy', new THREE.Vector3(0.5, 0, 0)],
      ['selected-hidden', new THREE.Vector3(0, 0, 0)],
      ['temporary', new THREE.Vector3(-0.2, 0, 0)],
      ['constellation-orion', new THREE.Vector3(0, 0.4, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    access.collectCandidate(objects[0]!, camera, reader, 1, null);
    access.collectCandidate(objects[1]!, camera, reader, 4, null);
    access.collectCandidate(createLabelObject('missing', 'star'), camera, reader, 1, null);
    access.collectCandidate(
      createLabelObject('selected-hidden', 'planet'),
      camera,
      reader,
      4,
      'selected-hidden',
    );
    expect(access.candidates.map(({ object }) => object.id)).toEqual(['selected-hidden']);

    manager.setTransientObject(objects[2]!);
    access.collectCandidates(camera, reader, 1, null);
    expect(access.candidates.some(({ object }) => object.id === 'near-star')).toBe(true);

    manager.setTransientObject(createLabelObject('temporary', 'star'));
    access.collectCandidates(camera, reader, 1, 'catalog-2');
    expect(access.candidates[0]?.object.id).toBe('catalog-2');
    expect(access.candidates.map(({ object }) => object.id)).toContain('temporary');

    manager.setTransientObject(null);
    access.collectCandidates(camera, reader, 4, null);
    expect(access.candidates.find(({ object }) => object.id === 'ranked-galaxy')?.priority).toBe(
      52,
    );
    expect(access.candidates.find(({ object }) => object.id === 'unranked-galaxy')?.priority).toBe(
      0,
    );

    access.collectCandidates(camera, reader, 2, null);
    expect(
      access.candidates.find(({ object }) => object.id === 'constellation-orion')?.priority,
    ).toBe(400);

    access.collectCandidates(camera, reader, 5, null);
    expect(access.candidates.find(({ object }) => object.id === 'nearby-galaxy')?.priority).toBe(
      28,
    );

    access.collectCandidates(camera, reader, 6, null);
    expect(access.candidates.find(({ object }) => object.id === 'cf4-pgc-35')?.priority).toBe(600);
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
    access.collectCandidate(hidden, camera, reader, 1, 'hidden');
    expect(access.candidates.some(({ object }) => object.id === 'hidden')).toBe(true);
    access.candidates.length = 0;
    access.collectCandidate(hiddenConstellation, camera, reader, 1, 'constellation-hidden');
    expect(access.candidates).toEqual([]);
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
    vi.spyOn(access, 'collectCandidates').mockImplementation(() => undefined);
    const overlaps = vi.spyOn(access, 'overlapsExistingLabel').mockReturnValue(false);

    access.candidates.push(
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
    access.candidates.length = 0;
    for (let index = 0; index < 28; index += 1) {
      access.candidates.push(candidate(`visible-${index}`));
    }
    access.candidates.push(candidate('selected', 'star', true), candidate('never-rendered'));
    manager.render(camera, reader, 1, 'selected', 2_000);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'selected')).toBe(true);

    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    access.candidates.length = 0;
    for (let index = 0; index < 28; index += 1) {
      access.candidates.push(candidate(`budgeted-${index}`));
    }
    access.candidates.push(candidate('sun'));
    manager.render(camera, reader, 1, null, 2_250);
    expect(access.hitRegions).toHaveLength(28);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'sun')).toBe(true);

    manager.resize(1_000, 500);
    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    access.candidates.length = 0;
    access.candidates.push(candidate('center'));
    overlaps.mockReturnValue(true);
    manager.render(camera, reader, 1, null, 2_500);

    manager.setEnabled(false);
    manager.render(camera, reader, 1, null, 3_000);
  });

  it('dessine toutes les variantes de cartouches, ancres et collisions', () => {
    const context = installContext(300);
    const manager = new LabelManager(document.createElement('div'), [], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const planet = createLabelObject('earth', 'planet');
    const galaxy = createLabelObject('andromeda', 'galaxy');
    const star = createLabelObject('sirius', 'star');
    const catalog = createLabelObject('hyg-1', 'star', { catalogRecordIndex: 0 });

    const selectedRectangle = access.measureRectangle(planet, 100, 100, true);
    const galaxyRectangle = access.measureRectangle(galaxy, 100, 100, false);
    const starRectangle = access.measureRectangle(star, 100, 100, false);
    const catalogRectangle = access.measureRectangle(catalog, 100, 100, false);

    access.drawLabel(star, starRectangle, true, false);
    access.drawLabel(catalog, catalogRectangle, false, true);
    access.drawLabel(catalog, catalogRectangle, false, false);
    access.drawLabel(star, starRectangle, false, false);
    access.drawLabel(planet, selectedRectangle, false, false);
    access.drawLabel(galaxy, galaxyRectangle, false, false);
    access.drawAnchor(starRectangle, 100, 120, false, false);
    access.drawAnchor(starRectangle, 100, 120, true, false);
    access.drawAnchor(starRectangle, 100, 120, false, true);

    access.occupiedRectangles.push({ left: 10, top: 10, right: 40, bottom: 40 });
    expect(access.overlapsExistingLabel({ left: 20, top: 20, right: 30, bottom: 30 })).toBe(true);
    expect(access.overlapsExistingLabel({ left: 50, top: 20, right: 60, bottom: 30 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: -20, top: 20, right: 0, bottom: 30 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: 20, top: 50, right: 30, bottom: 60 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: 20, top: -20, right: 30, bottom: 0 })).toBe(false);

    expect(context.stroke).toHaveBeenCalled();
    manager.dispose();
  });

  it('occulte les noms situés derrière le disque apparent d’un corps proche', () => {
    installContext();
    const venus = createLabelObject('venus', 'planet');
    const behindStar: LabelObject = {
      id: 'behind-star',
      name: 'Étoile masquée',
      type: 'star',
    };
    const frontStar: LabelObject = {
      id: 'front-star',
      name: 'Étoile proche',
      type: 'star',
    };
    const missingBody = createLabelObject('missing-body', 'planet');
    const tinyBody = createLabelObject('tiny-body', 'planet');
    const outsideBody = createLabelObject('outside-body', 'planet');
    const manager = new LabelManager(
      document.createElement('div'),
      [venus, behindStar, frontStar, missingBody, tinyBody, outsideBody],
      'high',
    );
    const access = manager as unknown as LabelManagerAccess;
    const camera = new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 100);
    const positions = new Map<string, THREE.Vector3>([
      ['venus', new THREE.Vector3(0, 0, 0)],
      ['behind-star', new THREE.Vector3(0, 0, -10)],
      ['front-star', new THREE.Vector3(0, 0, 5)],
      ['tiny-body', new THREE.Vector3(4, 0, 0)],
      ['outside-body', new THREE.Vector3(0, 0, 20)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };
    const rectangle = { left: 160, top: 120, right: 240, bottom: 145 };

    venus.visual.visualRadius = 2;
    tinyBody.visual.visualRadius = 0.001;
    outsideBody.visual.visualRadius = 2;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    manager.resize(400, 300);
    access.collectScreenOccluders(camera, reader);

    expect(access.screenOccluders).toHaveLength(1);
    manager.render(camera, reader, 1, null, 1_000);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'behind-star')).toBe(false);
    expect(
      access.isOccludedByBody(
        {
          object: behindStar,
          distanceSquared: 400,
          priority: 0,
          selected: false,
        },
        rectangle,
        200,
        150,
      ),
    ).toBe(true);
    expect(
      access.isOccludedByBody(
        {
          object: behindStar,
          distanceSquared: 400,
          priority: 0,
          selected: false,
        },
        { left: 230, top: 130, right: 280, bottom: 150 },
        280,
        150,
      ),
    ).toBe(true);
    expect(
      access.isOccludedByBody(
        {
          object: frontStar,
          distanceSquared: 25,
          priority: 0,
          selected: false,
        },
        rectangle,
        200,
        150,
      ),
    ).toBe(false);
    expect(
      access.isOccludedByBody(
        {
          object: behindStar,
          distanceSquared: 400,
          priority: 0,
          selected: true,
        },
        rectangle,
        200,
        150,
      ),
    ).toBe(false);
    expect(
      access.isOccludedByBody(
        {
          object: venus,
          distanceSquared: 100,
          priority: 0,
          selected: false,
        },
        rectangle,
        200,
        150,
      ),
    ).toBe(false);
    expect(
      access.isOccludedByBody(
        {
          object: behindStar,
          distanceSquared: 400,
          priority: 0,
          selected: false,
        },
        { left: 8, top: 8, right: 40, bottom: 30 },
        24,
        38,
      ),
    ).toBe(false);
    manager.dispose();
  });
});

interface LabelCandidateTest {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
}

interface LabelManagerAccess {
  readonly canvas: HTMLCanvasElement;
  readonly hitRegions: LabelHitRegion[];
  readonly candidates: LabelCandidateTest[];
  readonly occupiedRectangles: ScreenRectangle[];
  readonly screenOccluders: ScreenOccluderTest[];
  lastRenderTime: number;
  collectCandidates(
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
    lodLevel: number,
    selectedId: string | null,
  ): void;
  collectCandidate(
    object: LabelObject,
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
    lodLevel: number,
    selectedId: string | null,
  ): void;
  measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
  ): ScreenRectangle;
  drawLabel(
    object: LabelObject,
    rectangle: ScreenRectangle,
    selected: boolean,
    hovered: boolean,
  ): void;
  drawAnchor(
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
    selected: boolean,
    hovered: boolean,
  ): void;
  overlapsExistingLabel(rectangle: ScreenRectangle): boolean;
  collectScreenOccluders(
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
  ): void;
  isOccludedByBody(
    candidate: LabelCandidateTest,
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
  ): boolean;
}

interface ScreenOccluderTest {
  readonly objectId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly distanceSquared: number;
}

interface ContextSpies {
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly fillText: ReturnType<typeof vi.fn>;
  readonly stroke: ReturnType<typeof vi.fn>;
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
): LabelCandidateTest {
  return {
    object: createLabelObject(id, type),
    distanceSquared: 1,
    priority: 0,
    selected,
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
