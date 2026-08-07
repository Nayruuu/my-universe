import { EarthSkyNavigation } from './earth-sky-navigation';

describe('navigation du ciel terrestre', () => {
  it('déplace librement le regard en respectant les pôles et le bouclage de l’azimut', () => {
    const navigation = new EarthSkyNavigation();

    expect(navigation.pan(20, 20, 1_000, 500)).toBe(false);
    navigation.initialize({
      centerAltitudeDegrees: 20,
      centerAzimuthDegrees: 5,
      verticalFieldOfViewDegrees: 80,
    });

    expect(navigation.pan(100, 50, 1_000, 500)).toBe(true);
    expect(navigation.viewpoint).toEqual({
      centerAltitudeDegrees: 28,
      centerAzimuthDegrees: expect.closeTo(348, 0),
      verticalFieldOfViewDegrees: 80,
    });

    navigation.pan(0, 10_000, 1_000, 500);
    expect(navigation.viewpoint?.centerAltitudeDegrees).toBe(85);
  });

  it('zoome avec la molette et borne un champ de vision exploitable', () => {
    const navigation = new EarthSkyNavigation();

    expect(navigation.zoomByWheel(-200)).toBe(false);
    navigation.initialize({
      centerAltitudeDegrees: 20,
      centerAzimuthDegrees: 180,
      verticalFieldOfViewDegrees: 80,
    });

    expect(navigation.zoomByWheel(-400)).toBe(true);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBeLessThan(80);
    navigation.zoomByWheel(-100_000);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBe(24);
    expect(navigation.zoomByWheel(-100_000)).toBe(false);
    navigation.zoomByWheel(100_000);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBe(110);
  });

  it('combine glisser à un doigt et pincement à deux doigts', () => {
    const navigation = new EarthSkyNavigation();

    navigation.initialize({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 180,
      verticalFieldOfViewDegrees: 80,
    });
    navigation.pointerDown(1, 200, 200);
    expect(navigation.pointerMove(1, 240, 220, 800, 600)).toBe(true);
    const afterDrag = navigation.viewpoint!;

    navigation.pointerDown(2, 400, 200);
    expect(navigation.pointerMove(2, 480, 200, 800, 600)).toBe(true);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBeLessThan(
      afterDrag.verticalFieldOfViewDegrees,
    );
    navigation.pointerUp(2);
    navigation.pointerUp(1);
    expect(navigation.pointerMove(99, 0, 0, 800, 600)).toBe(false);
  });

  it('gère les cas limites du pincement sans produire de saut', () => {
    const navigation = new EarthSkyNavigation();

    navigation.recenter({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 180,
      verticalFieldOfViewDegrees: 24,
    });
    navigation.pointerDown(1, 200, 200);
    navigation.pointerDown(2, 200, 200);
    expect(navigation.pointerMove(2, 240, 200, 800, 600)).toBe(true);

    navigation.pointerUp(1);
    navigation.pointerUp(2);
    navigation.pointerDown(1, 200, 200);
    navigation.pointerDown(2, 400, 200);
    expect(navigation.pointerMove(2, 440, 200, 800, 600)).toBe(true);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBe(24);

    navigation.recenter({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 180,
      verticalFieldOfViewDegrees: 80,
    });
    expect(navigation.pointerMove(2, 520, 200, 0, 0)).toBe(true);
    expect(navigation.viewpoint?.verticalFieldOfViewDegrees).toBeLessThan(80);
  });

  it('recentre explicitement la perspective et refuse un viewport invalide', () => {
    const navigation = new EarthSkyNavigation();
    const initial = {
      centerAltitudeDegrees: 12,
      centerAzimuthDegrees: 45,
      verticalFieldOfViewDegrees: 72,
    };

    navigation.initialize(initial);
    navigation.initialize({ ...initial, centerAzimuthDegrees: 90 });
    expect(navigation.viewpoint?.centerAzimuthDegrees).toBe(45);
    navigation.recenter({ ...initial, centerAzimuthDegrees: 90 });
    expect(navigation.viewpoint?.centerAzimuthDegrees).toBe(90);
    expect(navigation.pan(1, 1, 0, 500)).toBe(false);
  });
});
