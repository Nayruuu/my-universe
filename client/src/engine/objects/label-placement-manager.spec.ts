import { SpaceObject } from '../../data/models/universe.models';
import type { LabelCandidate } from './label-candidate-collector';
import { LabelPlacementManager } from './label-placement-manager';
import type { ScreenRectangle } from './label-screen-layout';
import type { LabelObject } from './label-visibility-policy';

describe('LabelPlacementManager', () => {
  it('mesure et contraint un cartouche ordinaire dans la largeur visible', () => {
    const measurer = new RectangleMeasurer();
    const occlusion = new OcclusionReader(false);
    const manager = new LabelPlacementManager(measurer, occlusion);
    const value = manager.place(
      candidate('earth', 'planet'),
      0,
      100,
      placementOptions(),
      false,
      false,
    );

    expect(value).toEqual(rectangle(8, 76, 88, 100));
    expect(measurer.calls).toEqual([{ objectId: 'earth', selected: false, lodLevel: 1 }]);
    expect(occlusion.points).toEqual([{ x: 0, y: 118 }]);
    expect(manager.occupiedRectangles).toHaveLength(1);

    manager.clear();
    expect(manager.occupiedRectangles).toEqual([]);
  });

  it('rejette un cartouche ordinaire occulté', () => {
    const manager = new LabelPlacementManager(new RectangleMeasurer(), new OcclusionReader(true));

    expect(
      manager.place(candidate('behind'), 100, 100, placementOptions(), false, false),
    ).toBeNull();
    expect(manager.occupiedRectangles).toEqual([]);
  });

  it('écarte une collision ordinaire et déplace une planète prioritaire', () => {
    const manager = new LabelPlacementManager(new RectangleMeasurer(), new OcclusionReader(false));
    const options = placementOptions();

    expect(manager.place(candidate('first'), 100, 100, options, false, false)).not.toBeNull();
    expect(manager.place(candidate('collision'), 100, 100, options, false, false)).toBeNull();

    const displaced = manager.place(candidate('mars', 'planet'), 100, 100, options, false, true);

    expect(displaced).toEqual(rectangle(148, 76, 228, 100));
  });

  it('conserve une sélection en collision mais abandonne un déplacement impossible', () => {
    const manager = new LabelPlacementManager(new RectangleMeasurer(), new OcclusionReader(false));
    const options = placementOptions({ viewportWidth: 96, viewportHeight: 152 });

    expect(manager.place(candidate('first'), 48, 100, options, false, false)).not.toBeNull();
    expect(
      manager.place(candidate('selected', 'star', true), 48, 100, options, false, false),
    ).not.toBeNull();
    expect(manager.place(candidate('earth', 'planet'), 48, 100, options, false, true)).toBeNull();
  });

  it('épingle les repères puis les répartit entre les emplacements sûrs', () => {
    const manager = new LabelPlacementManager(new RectangleMeasurer(), new OcclusionReader(true));
    const options = placementOptions({ safeTop: 76, safeBottom: 88 });

    expect(manager.place(candidate('sun'), 0, 0, options, true, false)).toEqual(
      rectangle(8, 76, 88, 100),
    );
    expect(manager.place(candidate('milky-way', 'galaxy'), 0, 0, options, true, false)).toEqual(
      rectangle(96, 76, 176, 100),
    );
  });
});

class RectangleMeasurer {
  public readonly calls: { objectId: string; selected: boolean; lodLevel: number }[] = [];

  public measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
    lodLevel: number,
  ): ScreenRectangle {
    this.calls.push({ objectId: object.id, selected, lodLevel });

    return rectangle(centerX - 40, baselineY - 24, centerX + 40, baselineY);
  }
}

class OcclusionReader {
  public readonly points: { x: number; y: number }[] = [];

  constructor(private readonly occluded: boolean) {}

  public isOccluded(
    _candidate: LabelCandidate,
    _rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
  ): boolean {
    this.points.push({ x: pointX, y: pointY });

    return this.occluded;
  }
}

function placementOptions(
  overrides: Partial<Parameters<LabelPlacementManager['place']>[3]> = {},
): Parameters<LabelPlacementManager['place']>[3] {
  return {
    viewportWidth: 500,
    viewportHeight: 300,
    safeTop: 60,
    safeBottom: 60,
    landmarkSafeLeft: 8,
    landmarkSafeRight: 72,
    lodLevel: 1,
    ...overrides,
  };
}

function candidate(
  id: string,
  type: SpaceObject['type'] = 'star',
  selected = false,
): LabelCandidate {
  return {
    object: createLabelObject(id, type),
    distanceSquared: 1,
    priority: 0,
    selected,
    worldX: 0,
    worldY: 0,
    worldZ: 0,
  };
}

function createLabelObject(id: string, type: SpaceObject['type']): SpaceObject {
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
  };
}

function rectangle(left: number, top: number, right: number, bottom: number): ScreenRectangle {
  return { left, top, right, bottom };
}
