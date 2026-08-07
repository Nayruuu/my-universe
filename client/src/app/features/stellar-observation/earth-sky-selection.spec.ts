import type { EarthSkySprite } from './earth-sky-scene';
import { EarthSkyPointerSelection, findEarthSkyStarAt } from './earth-sky-selection';

describe('sélection des étoiles du mini-planétarium', () => {
  it('sélectionne le marqueur le plus proche avec une cible confortable', () => {
    const faint = star('faint', 100, 100, 0.8);
    const bright = star('bright', 107, 100, 2.6);

    expect(findEarthSkyStarAt([faint, bright], 105, 100, 10)).toBe(bright);
    expect(findEarthSkyStarAt([bright, faint], 105, 100, 10)).toBe(bright);
    expect(findEarthSkyStarAt([faint], 109, 100, 10)).toBe(faint);
    expect(findEarthSkyStarAt([faint], 111, 100, 10)).toBeNull();
  });

  it('préfère l’étoile la plus lumineuse lorsque deux marqueurs se superposent', () => {
    const faint = star('faint', 100, 100, 0.8);
    const bright = star('bright', 100, 100, 2.6);

    expect(findEarthSkyStarAt([faint, bright], 100, 100, 10)).toBe(bright);
    expect(findEarthSkyStarAt([bright], Number.NaN, 100, 10)).toBeNull();
    expect(findEarthSkyStarAt([bright], 100, 100, 0)).toBeNull();
  });

  it('distingue un clic d’un déplacement ou d’un geste à deux doigts', () => {
    const selection = new EarthSkyPointerSelection();

    selection.begin(1, 30, 40);
    selection.move(1, 34, 43);
    expect(selection.end(1, 34, 43)).toEqual({ x: 34, y: 43 });

    selection.begin(2, 20, 20);
    selection.move(2, 60, 20);
    expect(selection.end(2, 60, 20)).toBeNull();

    selection.begin(3, 10, 10);
    selection.begin(4, 40, 10);
    expect(selection.end(3, 10, 10)).toBeNull();
    expect(selection.end(4, 40, 10)).toBeNull();
    expect(selection.end(99, 0, 0)).toBeNull();
  });

  it('annule proprement un pointeur interrompu', () => {
    const selection = new EarthSkyPointerSelection();

    selection.begin(1, 20, 20);
    selection.cancel(1);
    selection.move(1, 21, 21);

    expect(selection.end(1, 21, 21)).toBeNull();
  });
});

function star(id: string, x: number, y: number, radius: number): EarthSkySprite {
  return {
    id,
    name: id,
    x,
    y,
    depth: 1,
    radius,
    opacity: 0.7,
    haloOpacity: 0,
    color: '#ffffff',
    showLabel: false,
  };
}
