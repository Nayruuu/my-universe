import {
  circleIntersectsRectangle,
  findLabelHit,
  fitLandmarkRectangle,
  fitRectangleHorizontally,
  moveLandmarkRectangleToFreeSlot,
  moveRectangleToNearbyFreeSlot,
  rectanglesOverlap,
  type LabelHitRegion,
  type ScreenRectangle,
} from './label-screen-layout';

describe('label screen layout', () => {
  it('étend les zones de clic sans capturer les points éloignés', () => {
    const regions: LabelHitRegion[] = [
      { objectId: 'earth', rectangle: rectangle(100, 80, 180, 104) },
    ];

    expect(findLabelHit(regions, 95, 92)).toBe('earth');
    expect(findLabelHit(regions, 80, 92)).toBeNull();
  });

  it('contraint horizontalement les cartouches aux marges sûres', () => {
    const overflowingLeft = rectangle(-12, 20, 68, 44);
    const overflowingRight = rectangle(760, 20, 840, 44);
    const alreadyVisible = rectangle(100, 20, 180, 44);

    fitRectangleHorizontally(overflowingLeft, 800);
    fitRectangleHorizontally(overflowingRight, 800, 8, 72);
    fitRectangleHorizontally(alreadyVisible, 800);

    expect(overflowingLeft).toEqual(rectangle(8, 20, 88, 44));
    expect(overflowingRight).toEqual(rectangle(648, 20, 728, 44));
    expect(alreadyVisible).toEqual(rectangle(100, 20, 180, 44));
  });

  it('contraint verticalement les repères aux marges sûres', () => {
    const overflowingTop = rectangle(760, 4, 840, 28);
    const overflowingBottom = rectangle(100, 280, 180, 304);
    const alreadyVisible = rectangle(100, 100, 180, 124);

    fitLandmarkRectangle(overflowingTop, 800, 300, 76, 88, 8, 72);
    fitLandmarkRectangle(overflowingBottom, 800, 300, 76, 88, 8, 72);
    fitLandmarkRectangle(alreadyVisible, 800, 300, 76, 88, 8, 72);

    expect(overflowingTop).toEqual(rectangle(648, 76, 728, 100));
    expect(overflowingBottom).toEqual(rectangle(100, 188, 180, 212));
    expect(alreadyVisible).toEqual(rectangle(100, 100, 180, 124));
  });

  it('détecte les collisions rectangle-rectangle et cercle-rectangle', () => {
    const occupied = rectangle(100, 100, 180, 124);

    expect(rectanglesOverlap(rectangle(176, 100, 240, 124), [occupied])).toBe(true);
    expect(rectanglesOverlap(rectangle(200, 100, 260, 124), [occupied])).toBe(false);
    expect(rectanglesOverlap(rectangle(20, 100, 80, 124), [occupied])).toBe(false);
    expect(rectanglesOverlap(rectangle(100, 130, 180, 154), [occupied])).toBe(false);
    expect(rectanglesOverlap(rectangle(100, 66, 180, 90), [occupied])).toBe(false);
    expect(circleIntersectsRectangle(92, 112, 9, occupied)).toBe(true);
    expect(circleIntersectsRectangle(80, 112, 9, occupied)).toBe(false);
  });

  it('déplace un label ordinaire vers le premier emplacement voisin disponible', () => {
    const target = rectangle(100, 100, 180, 124);
    const occupied = [rectangle(96, 96, 184, 128)];

    expect(
      moveRectangleToNearbyFreeSlot(target, occupied, {
        viewportWidth: 500,
        viewportHeight: 300,
        safeTop: 60,
        safeBottom: 60,
      }),
    ).toBe(true);
    expect(rectanglesOverlap(target, occupied)).toBe(false);
  });

  it("conserve un label ordinaire quand aucun emplacement voisin n'est disponible", () => {
    const target = rectangle(8, 60, 88, 84);
    const original = { ...target };

    expect(
      moveRectangleToNearbyFreeSlot(target, [], {
        viewportWidth: 96,
        viewportHeight: 152,
        safeTop: 60,
        safeBottom: 68,
      }),
    ).toBe(false);
    expect(target).toEqual(original);
  });

  it('place un repère dans la première cellule sûre libre', () => {
    const target = rectangle(8, 76, 88, 100);
    const occupied = [rectangle(8, 76, 88, 100)];

    moveLandmarkRectangleToFreeSlot(target, occupied, {
      viewportWidth: 800,
      viewportHeight: 300,
      safeTop: 76,
      safeBottom: 88,
      safeLeft: 8,
      safeRight: 72,
    });

    expect(target).toEqual(rectangle(96, 76, 176, 100));
  });

  it("ne déplace pas un repère qui ne chevauche rien ou qui n'a aucune cellule libre", () => {
    const alreadyFree = rectangle(8, 76, 88, 100);
    const blocked = rectangle(8, 76, 88, 100);
    const options = {
      viewportWidth: 160,
      viewportHeight: 188,
      safeTop: 76,
      safeBottom: 88,
      safeLeft: 8,
      safeRight: 72,
    };

    moveLandmarkRectangleToFreeSlot(alreadyFree, [], options);
    moveLandmarkRectangleToFreeSlot(blocked, [rectangle(8, 76, 88, 100)], options);

    expect(alreadyFree).toEqual(rectangle(8, 76, 88, 100));
    expect(blocked).toEqual(rectangle(8, 76, 88, 100));
  });
});

function rectangle(left: number, top: number, right: number, bottom: number): ScreenRectangle {
  return { left, top, right, bottom };
}
