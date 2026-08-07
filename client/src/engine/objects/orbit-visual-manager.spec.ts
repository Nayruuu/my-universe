import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import type { TemporalPositionProvider } from '../simulation/position-providers';
import {
  OrbitVisualManager,
  type OrbitObjectEntry,
  type OrbitVisualState,
} from './orbit-visual-manager';

describe('OrbitVisualManager', () => {
  it.each([
    ['low', 96, 48],
    ['medium', 144, 72],
    ['high', 180, 96],
  ] satisfies Array<[GraphicQuality, number, number]>)(
    'échantillonne les trajectoires selon la qualité %s',
    (quality, planetSegments, moonSegments) => {
      const fixture = createFixture();
      const manager = new OrbitVisualManager(fixture.root, fixture.entries, quality);

      expect(manager.getRadius('earth')).toBeCloseTo(2, 10);
      expect(manager.getRadius('moon')).toBeCloseTo(0.5, 10);
      expect(manager.getRadius('candidate')).toBeCloseTo(4, 10);
      expect(manager.getRadius('orphan')).toBeCloseTo(2, 10);
      expect(manager.getRadius('free-orbit')).toBeCloseTo(2, 10);
      expect(orbitLine(fixture.root, 'earth').geometry.getAttribute('position').count).toBe(
        planetSegments,
      );
      expect(orbitLine(fixture.root, 'moon').geometry.getAttribute('position').count).toBe(
        moonSegments,
      );
      expect(orbitLine(fixture.root, 'candidate').geometry.getAttribute('position').count).toBe(
        planetSegments,
      );
      expect(fixture.providers.get('earth')).toHaveBeenCalledWith({ julianDay: 100 });
      expect(fixture.providers.get('moon')).toHaveBeenCalledWith({ julianDay: 200 });
      expect(fixture.providers.get('candidate')).toHaveBeenCalledWith({ julianDay: 300 });
      expect(orbitLine(fixture.root, 'earth').parent?.name).toBe('sun');
      expect(orbitLine(fixture.root, 'orphan').parent).toBe(fixture.root);
      expect(orbitLine(fixture.root, 'free-orbit').parent).toBe(fixture.root);
      expect(manager.getRadius('earth')).toBeCloseTo(2, 10);
      expect(manager.getRadius('static-object')).toBeNull();
      expect(manager.getRadius('unknown')).toBeNull();

      manager.dispose();
    },
  );

  it('applique la hiérarchie visuelle et la palette cartographique des orbites', () => {
    const fixture = createFixture();
    const manager = new OrbitVisualManager(fixture.root, fixture.entries, 'high');

    manager.update(state({ lodLevel: 1, selectedId: 'mars', navigationTargetId: 'sun' }));
    const mars = orbitLine(fixture.root, 'mars');
    const earth = orbitLine(fixture.root, 'earth');
    const candidate = orbitLine(fixture.root, 'candidate');
    const colorlessCandidate = orbitLine(fixture.root, 'colorless-candidate');

    expect(mars.visible).toBe(true);
    expect(mars.userData).toMatchObject({
      active: true,
      overviewEmphasis: true,
      semanticGroup: 'solar-system',
      mapAccent: '#d65e48',
    });
    expect(mars.material.color.getHexString()).toBe('ff9e83');
    expect(mars.material.opacity).toBe(0.92);
    expect(mars.material.linewidth).toBe(1.6);
    expect(mars.renderOrder).toBe(3);
    expect(earth.material.color.getHexString()).toBe('43b4dd');
    expect(earth.material.opacity).toBe(0.62);
    expect(earth.material.linewidth).toBe(1.35);
    expect(earth.renderOrder).toBe(1);
    expect(candidate.material.color.getHexString()).toBe('123456');
    expect(candidate.userData['semanticGroup']).toBeNull();
    expect(candidate.userData['mapAccent']).toBeNull();
    expect(colorlessCandidate.material.color.getHexString()).toBe('8acff4');

    manager.update(state({ lodLevel: 0, selectedId: 'mars', navigationTargetId: 'sun' }));
    expect(candidate.material.color.getHexString()).toBe('465266');
    expect(candidate.material.opacity).toBe(0.34);
    expect(candidate.material.linewidth).toBe(1);
    expect(candidate.renderOrder).toBe(0);

    manager.update(
      state({ lodLevel: 2, selectedId: 'candidate', navigationTargetId: 'host-star' }),
    );
    const activeCandidate = orbitLine(fixture.root, 'candidate');

    expect(activeCandidate.visible).toBe(true);
    expect(activeCandidate.material.color.getHexString()).toBe('123456');
    expect(activeCandidate.userData['active']).toBe(true);

    manager.dispose();
  });

  it('ne conserve que les trajectoires nécessaires au niveau de détail courant', () => {
    const fixture = createFixture();
    const manager = new OrbitVisualManager(fixture.root, fixture.entries, 'low');

    manager.update(state({ lodLevel: 1 }));
    const earth = orbitLine(fixture.root, 'earth');
    const disposeGeometry = vi.spyOn(earth.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(earth.material, 'dispose');

    manager.update(state({ lodLevel: 2, selectedId: 'moon', navigationTargetId: 'earth' }));
    expect(fixture.root.getObjectByName('earth-orbit')).toBeUndefined();
    expect(orbitLine(fixture.root, 'moon').visible).toBe(true);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();

    manager.update(state({ lodLevel: 2, selectedId: 'moon', navigationTargetId: 'sun' }));
    expect(fixture.root.getObjectByName('moon-orbit')).toBeUndefined();
    manager.update(state({ lodLevel: 2, selectedId: 'static-object' }));
    manager.update(state({ lodLevel: 2, selectedId: 'unknown' }));
    manager.update(state({ lodLevel: 3, selectedId: 'mars', navigationTargetId: 'sun' }));
    expect(orbitNames(fixture.root)).toEqual([]);

    manager.dispose();
  });

  it('retire toutes les trajectoires lorsque leur affichage est désactivé ou incompatible', () => {
    const fixture = createFixture();
    const manager = new OrbitVisualManager(fixture.root, fixture.entries, 'low');

    manager.update(state({ lodLevel: 1 }));
    manager.update(state({ lodLevel: 1, showOrbits: false }));
    expect(fixture.root.getObjectByName('earth-orbit')).toBeUndefined();

    manager.update(state({ lodLevel: 1 }));
    manager.update(state({ lodLevel: 1, solarObserverActive: true }));
    expect(fixture.root.getObjectByName('earth-orbit')).toBeUndefined();

    manager.update(state({ lodLevel: 1 }));
    manager.update(state({ lodLevel: 1, earthObserverActive: true }));
    expect(fixture.root.getObjectByName('earth-orbit')).toBeUndefined();

    manager.dispose();
  });
});

function createFixture(): {
  root: THREE.Group;
  entries: Map<string, OrbitObjectEntry>;
  providers: Map<string, ReturnType<typeof vi.fn>>;
} {
  const root = new THREE.Group();
  const entries = new Map<string, OrbitObjectEntry>();
  const providers = new Map<string, ReturnType<typeof vi.fn>>();
  const definitions = [
    staticObject('sun', 'star'),
    staticObject('host-star', 'star'),
    keplerianObject('earth', 'planet', 'sun'),
    ephemerisObject('moon', 'moon', 'earth'),
    keplerianObject('mars', 'planet', 'sun'),
    illustrativeObject('candidate', 'exoplanet', 'host-star', '#123456'),
    illustrativeObject('colorless-candidate', 'exoplanet', 'host-star'),
    illustrativeObject('orphan', 'comet', 'missing-parent'),
    keplerianObject('free-orbit', 'comet'),
    staticObject('static-object', 'asteroid'),
  ];

  for (const definition of definitions) {
    const node = new THREE.Group();
    const radius =
      definition.id === 'moon'
        ? 0.5
        : definition.id === 'candidate' || definition.id === 'colorless-candidate'
          ? 4
          : 2;
    const getPositionAt = vi.fn(({ julianDay }: { julianDay: number }) => {
      const angle = julianDay * Math.PI * 2;

      return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
    });

    node.name = definition.id;
    root.add(node);
    providers.set(definition.id, getPositionAt);
    entries.set(definition.id, {
      definition,
      node,
      provider: { getPositionAt } satisfies TemporalPositionProvider,
    });
  }

  return { root, entries, providers };
}

function state(overrides: Partial<OrbitVisualState>): OrbitVisualState {
  return {
    showOrbits: true,
    solarObserverActive: false,
    earthObserverActive: false,
    lodLevel: 0,
    selectedId: null,
    navigationTargetId: null,
    ...overrides,
  };
}

function orbitLine(
  root: THREE.Object3D,
  objectId: string,
): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const line = root.getObjectByName(`${objectId}-orbit`);

  expect(line).toBeInstanceOf(THREE.LineLoop);

  return line as THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

function orbitNames(root: THREE.Object3D): string[] {
  const names: string[] = [];

  root.traverse((object) => {
    if (object.userData['kind'] === 'orbit') {
      names.push(object.name);
    }
  });

  return names;
}

function baseObject(id: string, type: SpaceObject['type'], parentId?: string): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
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

function staticObject(id: string, type: SpaceObject['type']): SpaceObject {
  return baseObject(id, type);
}

function keplerianObject(id: string, type: SpaceObject['type'], parentId?: string): SpaceObject {
  return {
    ...baseObject(id, type, parentId),
    positionProvider: {
      type: 'keplerian',
      semiMajorAxis: 1,
      eccentricity: 0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epochJulianDay: 100,
      orbitalPeriodDays: 10,
      unit: 'astronomical-unit',
    },
  };
}

function ephemerisObject(id: string, type: SpaceObject['type'], parentId: string): SpaceObject {
  return {
    ...baseObject(id, type, parentId),
    positionProvider: {
      type: 'ephemeris',
      body: 'moon',
      origin: 'earth',
      orbitEpochJulianDay: 200,
      orbitalPeriodDays: 20,
    },
  };
}

function illustrativeObject(
  id: string,
  type: SpaceObject['type'],
  parentId: string,
  color?: string,
): SpaceObject {
  const object = baseObject(id, type, parentId);

  return {
    ...object,
    visual: {
      ...object.visual,
      ...(color ? { color } : {}),
    },
    positionProvider: {
      type: 'illustrative-orbit',
      semiMajorAxis: 1,
      orbitalPeriodDays: 30,
      epochJulianDay: 300,
      visualPhaseAtEpochDegrees: 0,
      visualInclinationDegrees: 0,
      unit: 'astronomical-unit',
    },
  };
}
