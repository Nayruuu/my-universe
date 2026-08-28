import * as THREE from 'three';
import { resolveObjectId, SelectionManager } from './selection-manager';

describe('SelectionManager', () => {
  let canvas: HTMLCanvasElement;
  let manager: SelectionManager;
  const selected = vi.fn();
  const navigationIntent = vi.fn();
  const semanticZoom = vi.fn();
  const labelHovered = vi.fn();
  const getLabelObjectAt = vi.fn((): string | null => 'sirius');

  beforeEach(() => {
    getLabelObjectAt.mockReturnValue('sirius');
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [],
      getLabelObjectAt,
      selected,
      navigationIntent,
      () => 10,
      () => false,
      labelHovered,
      semanticZoom,
    );
  });

  afterEach(() => {
    manager.dispose();
    canvas.remove();
    vi.clearAllMocks();
  });

  it('centre automatiquement l’objet lorsque son label est activé à la souris', () => {
    dispatchPointer(canvas, 'pointerdown', { button: 0 });
    dispatchPointer(canvas, 'pointerup', { button: 0 });

    expect(selected).toHaveBeenCalledWith('sirius', true);
  });

  it('transmet un clic primaire dans le fond comme une désélection', () => {
    getLabelObjectAt.mockReturnValue(null);

    dispatchPointer(canvas, 'pointerdown', { button: 0 });
    dispatchPointer(canvas, 'pointerup', { button: 0 });

    expect(selected).toHaveBeenCalledWith(null, false);
    expect(navigationIntent).not.toHaveBeenCalled();
  });

  it('reconnaît un appui tactile même si pointerup utilise button = -1', () => {
    dispatchPointer(canvas, 'pointerdown', {
      button: 0,
      pointerType: 'touch',
      isPrimary: true,
    });
    dispatchPointer(canvas, 'pointerup', {
      button: -1,
      pointerType: 'touch',
      isPrimary: true,
    });

    expect(selected).toHaveBeenCalledWith('sirius', true);
  });

  it('met visuellement en avant le label survolé', () => {
    dispatchPointer(canvas, 'pointermove', { button: 0 });

    expect(labelHovered).toHaveBeenCalledWith('sirius');
    expect(canvas.style.cursor).toBe('pointer');

    canvas.dispatchEvent(new MouseEvent('pointerleave'));
    expect(labelHovered).toHaveBeenLastCalledWith(null);
  });

  it('ne transforme pas un geste multi-touch en sélection et conserve la cible active', () => {
    dispatchPointer(canvas, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });
    dispatchPointer(canvas, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
    });
    dispatchPointer(canvas, 'pointerup', {
      pointerId: 1,
      button: -1,
      pointerType: 'touch',
      isPrimary: true,
    });

    expect(selected).not.toHaveBeenCalled();
    expect(navigationIntent).not.toHaveBeenCalled();
  });

  it('ignore les activations secondaires, les glissements et annule proprement un pointeur', () => {
    dispatchPointer(canvas, 'pointerup', { button: 0 });
    dispatchPointer(canvas, 'pointerdown', { button: 2 });
    dispatchPointer(canvas, 'pointerdown', {
      pointerType: 'touch',
      isPrimary: false,
    });
    dispatchPointer(canvas, 'pointerdown', { button: 0, clientX: 10, clientY: 10 });
    dispatchPointer(canvas, 'pointerup', { button: 0, clientX: 30, clientY: 30 });
    dispatchPointer(canvas, 'pointerdown', { button: 0 });
    dispatchPointer(canvas, 'pointercancel', { button: 0 });
    dispatchPointer(canvas, 'pointerup', { button: 0 });

    expect(selected).not.toHaveBeenCalled();
    expect(navigationIntent).toHaveBeenCalledWith(null);
  });

  it('efface explicitement le verrou de navigation', () => {
    const access = manager as unknown as SelectionManagerAccess;

    access.navigationLock = { objectId: 'earth', x: 10, y: 10 };
    manager.clearNavigationLock();

    expect(access.navigationLock).toBeNull();
  });

  it('centre aussi sur double-clic et distingue un clic de rayon sans label', () => {
    canvas.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        clientX: 120,
        clientY: 90,
      }),
    );
    expect(selected).toHaveBeenLastCalledWith('sirius', true);

    const access = manager as unknown as SelectionManagerAccess;

    getLabelObjectAt.mockReturnValue(null);
    vi.spyOn(access, 'findRaycastObjectAt').mockReturnValue('earth');
    expect(access.findObjectAt({ clientX: 120, clientY: 90 })).toBe('earth');
    dispatchPointer(canvas, 'pointerdown', { button: 0 });
    dispatchPointer(canvas, 'pointerup', { button: 0 });
    expect(selected).toHaveBeenLastCalledWith('earth', false);
  });

  it('limite le raycast de survol, respecte un geste actif et restaure le curseur', () => {
    const access = manager as unknown as SelectionManagerAccess;
    const findRaycast = vi.spyOn(access, 'findRaycastObjectAt').mockReturnValue('earth');

    getLabelObjectAt.mockReturnValue(null);
    dispatchPointer(canvas, 'pointermove', { timeStamp: 100 });
    expect(canvas.style.cursor).toBe('pointer');
    expect(labelHovered).toHaveBeenLastCalledWith('earth');
    dispatchPointer(canvas, 'pointermove', { timeStamp: 120 });
    expect(findRaycast).toHaveBeenCalledOnce();

    access.lastHoverRaycastTime = Number.NEGATIVE_INFINITY;
    findRaycast.mockReturnValue(null);
    dispatchPointer(canvas, 'pointermove', { timeStamp: 300 });
    expect(canvas.style.cursor).toBe('');
    expect(labelHovered).toHaveBeenLastCalledWith(null);

    dispatchPointer(canvas, 'pointerdown', { button: 0 });
    dispatchPointer(canvas, 'pointermove', { timeStamp: 500 });
    dispatchPointer(canvas, 'pointercancel', { button: 0 });
    expect(findRaycast).toHaveBeenCalledTimes(2);
  });

  it('ne change pas de cible avec la roulette pendant un glissement de caméra', () => {
    const access = manager as unknown as SelectionManagerAccess;
    const findRaycast = vi.spyOn(access, 'findRaycastObjectAt').mockReturnValue('earth');

    dispatchPointer(canvas, 'pointerdown', { button: 0, clientX: 120, clientY: 90 });
    dispatchPointer(canvas, 'pointermove', { button: 0, clientX: 180, clientY: 120 });
    getLabelObjectAt.mockClear();

    const simultaneousWheel = dispatchWheel(canvas, -1, 180, 120, 1_000);

    expect(simultaneousWheel.defaultPrevented).toBe(true);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      -1,
      { x: -0.55, y: 0.6 },
      { rawDeltaY: -1, deltaMode: 0 },
    );
    expect(getLabelObjectAt).not.toHaveBeenCalled();
    expect(findRaycast).not.toHaveBeenCalled();
    expect(access.navigationLock).toBeNull();

    dispatchPointer(canvas, 'pointerup', { button: 0, clientX: 180, clientY: 120 });
    dispatchWheel(canvas, -1, 180, 120, 1_016);

    expect(semanticZoom.mock.lastCall?.[0]).toBe('sirius');
    expect(access.navigationLock).toEqual({ objectId: 'sirius', x: 180, y: 120 });
  });

  it('verrouille l’objet trouvé au début de chaque rafale tout en conservant sa capture', () => {
    const access = manager as unknown as SelectionManagerAccess;
    const intersectObjects = vi.spyOn(access.raycaster, 'intersectObjects');

    getLabelObjectAt.mockReturnValue(null);

    const outward = dispatchWheel(canvas, 1, 120, 90, 100);

    expect(outward.defaultPrevented).toBe(true);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      1,
      {
        x: -0.7,
        y: 0.7,
      },
      { rawDeltaY: 1, deltaMode: 0 },
    );
    expect(access.navigationLock).toEqual({ objectId: null, x: 120, y: 90 });

    dispatchWheel(canvas, 1, 121, 91, 120);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      1,
      {
        x: -0.6975,
        y: 0.6966666666666667,
      },
      {
        rawDeltaY: 1,
        deltaMode: 0,
        continuesWheelAnchor: true,
        continuesWheelGesture: true,
      },
    );
    expect(access.navigationLock).toEqual({ objectId: null, x: 120, y: 90 });

    dispatchWheel(canvas, 0, 121, 91, 130);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      0,
      {
        x: -0.6975,
        y: 0.6966666666666667,
      },
      { rawDeltaY: 0, deltaMode: 0, continuesWheelAnchor: true },
    );

    getLabelObjectAt.mockReturnValue('earth');
    dispatchWheel(canvas, -1, 100, 75, 140);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      -1,
      {
        x: -0.75,
        y: 0.75,
      },
      { rawDeltaY: -1, deltaMode: 0, continuesWheelAnchor: true },
    );
    expect(access.navigationLock).toEqual({ objectId: null, x: 120, y: 90 });

    dispatchPointer(canvas, 'pointermove', { clientX: 160, clientY: 90, timeStamp: 145 });
    expect(access.navigationLock).toBeNull();
    dispatchWheel(canvas, -1, 100, 75, 150);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'earth',
      -1,
      {
        x: -0.75,
        y: 0.75,
      },
      { rawDeltaY: -1, deltaMode: 0, continuesWheelGesture: true },
    );
    expect(access.navigationLock).toEqual({ objectId: 'earth', x: 100, y: 75 });

    getLabelObjectAt.mockReturnValue('mars');
    dispatchWheel(canvas, -1, 100, 75, 160);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'earth',
      -1,
      {
        x: -0.75,
        y: 0.75,
      },
      {
        rawDeltaY: -1,
        deltaMode: 0,
        continuesWheelAnchor: true,
        continuesWheelGesture: true,
      },
    );
    const lockBeforePause = access.navigationLock;

    dispatchWheel(canvas, -1, 100, 75, 2_710);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'mars',
      -1,
      {
        x: -0.75,
        y: 0.75,
      },
      { rawDeltaY: -1, deltaMode: 0 },
    );
    expect(access.navigationLock).not.toBe(lockBeforePause);
    expect(access.navigationLock).toEqual({ objectId: 'mars', x: 100, y: 75 });

    dispatchPointer(canvas, 'pointermove', { clientX: 180, clientY: 60, timeStamp: 2_720 });
    expect(access.navigationLock).toBeNull();

    dispatchWheel(canvas, -1, 180, 60, 2_740);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'mars',
      -1,
      {
        x: -0.55,
        y: 0.8,
      },
      { rawDeltaY: -1, deltaMode: 0, continuesWheelGesture: true },
    );
    const overlay = document.createElement('div');

    document.body.append(overlay);
    const overlayWheel = dispatchWheel(overlay, -1, 180, 60, 2_750);

    expect(overlayWheel.defaultPrevented).toBe(true);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'mars',
      -1,
      {
        x: -0.55,
        y: 0.8,
      },
      {
        rawDeltaY: -1,
        deltaMode: 0,
        continuesWheelAnchor: true,
        continuesWheelGesture: true,
      },
    );

    const delayedOverlayWheel = dispatchWheel(overlay, -1, 180, 60, 4_750);

    expect(delayedOverlayWheel.defaultPrevented).toBe(true);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'mars',
      -1,
      {
        x: -0.55,
        y: 0.8,
      },
      { rawDeltaY: -1, deltaMode: 0, continuesWheelAnchor: true },
    );

    const callsBeforeOutsideWheel = semanticZoom.mock.calls.length;
    const outsideWheel = dispatchWheel(overlay, -1, 700, 500, 4_760);

    expect(outsideWheel.defaultPrevented).toBe(false);
    expect(semanticZoom).toHaveBeenCalledTimes(callsBeforeOutsideWheel);
    expect(access.navigationLock).toBeNull();
    overlay.remove();

    expect(intersectObjects).toHaveBeenCalledOnce();
    expect(navigationIntent).not.toHaveBeenCalled();
  });

  it('réarme la capture du pointeur lorsque la navigation le demande', () => {
    semanticZoom.mockReturnValueOnce('refresh-wheel-anchor').mockReturnValue(undefined);
    getLabelObjectAt.mockReturnValue('jupiter');

    dispatchWheel(canvas, -1, 100, 75, 100);
    const access = manager as unknown as SelectionManagerAccess;

    expect(access.navigationLock).toBeNull();
    getLabelObjectAt.mockReturnValue(null);
    dispatchWheel(canvas, -1, 100, 75, 116);

    expect(semanticZoom.mock.calls[0]?.[0]).toBe('jupiter');
    expect(semanticZoom.mock.calls[1]?.[0]).toBeNull();
    expect(access.navigationLock).toEqual({ objectId: null, x: 100, y: 75 });
  });

  it('transmet des pas bornés et réguliers pour une rafale matérielle élevée', () => {
    getLabelObjectAt.mockReturnValue(null);
    dispatchWheel(canvas, -749, 400, 300, 1_000);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(-57.7622650467, 10),
      { x: 0, y: 0 },
      { rawDeltaY: -749, deltaMode: 0 },
    );

    dispatchWheel(canvas, -375, 400, 300, 1_016);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(-13.3084258668, 10),
      { x: 0, y: 0 },
      {
        rawDeltaY: -375,
        deltaMode: 0,
        continuesWheelAnchor: true,
        continuesWheelGesture: true,
      },
    );

    dispatchWheel(canvas, 3, 400, 300, 1_032, 1);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(42.5835958192, 10),
      { x: 0, y: 0 },
      { rawDeltaY: 3, deltaMode: 1, continuesWheelAnchor: true },
    );
  });

  it('ne réarme pas une forte impulsion quand seule l’ancre change pendant la rafale', () => {
    getLabelObjectAt.mockReturnValue(null);
    dispatchWheel(canvas, -749, 100, 100, 1_000);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(-57.7622650467, 10),
      { x: -0.75, y: 0.6666666666666667 },
      { rawDeltaY: -749, deltaMode: 0 },
    );

    dispatchPointer(canvas, 'pointermove', { clientX: 200, clientY: 100, timeStamp: 1_008 });
    dispatchWheel(canvas, -749, 200, 100, 1_016);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(-13.3084258668, 10),
      { x: -0.5, y: 0.6666666666666667 },
      { rawDeltaY: -749, deltaMode: 0, continuesWheelGesture: true },
    );

    manager.clearNavigationLock();
    dispatchWheel(canvas, -749, 200, 100, 1_032);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      null,
      expect.closeTo(-13.3084258668, 10),
      { x: -0.5, y: 0.6666666666666667 },
      { rawDeltaY: -749, deltaMode: 0, continuesWheelGesture: true },
    );
  });

  it('n’intercepte pas la molette sans gestionnaire de zoom sémantique', () => {
    manager.dispose();
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [],
      () => 'earth',
      selected,
      navigationIntent,
      () => 10,
      () => false,
    );

    const outward = dispatchWheel(canvas, 1, 120, 90);
    const inward = dispatchWheel(canvas, -1, 120, 90);

    expect(outward.defaultPrevented).toBe(false);
    expect(inward.defaultPrevented).toBe(false);
    expect(navigationIntent).not.toHaveBeenCalled();
  });

  it('choisit le premier objet de premier plan et garde un objet de fond en repli', () => {
    manager.dispose();
    const foreground = new THREE.Points();
    const background = new THREE.Points();
    const invalid = new THREE.Points();

    foreground.userData['objectId'] = 'earth';
    background.userData['objectId'] = 'galaxy';
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [foreground, background],
      () => null,
      selected,
      navigationIntent,
      () => 10,
      (id) => id === 'galaxy',
      labelHovered,
    );
    const access = manager as unknown as SelectionManagerAccess;
    const intersect = vi
      .spyOn(access.raycaster, 'intersectObjects')
      .mockImplementation((_objects, _recursive, optionalTarget) => {
        const target = optionalTarget ?? [];

        target.push(intersection(invalid), intersection(background), intersection(foreground));

        return target;
      });

    expect(access.findRaycastObjectAt({ clientX: 100, clientY: 100 })).toBe('earth');

    intersect.mockImplementation((_objects, _recursive, optionalTarget) => {
      const target = optionalTarget ?? [];

      target.push(intersection(background));

      return target;
    });
    expect(access.findRaycastObjectAt({ clientX: 100, clientY: 100 })).toBe('galaxy');

    intersect.mockImplementation((_objects, _recursive, optionalTarget) => optionalTarget ?? []);
    expect(access.findRaycastObjectAt({ clientX: 100, clientY: 100 })).toBeNull();
  });

  it('préfère une étoile ponctuelle à une ligne de constellation superposée', () => {
    manager.dispose();
    const constellation = new THREE.LineSegments();
    const catalogStar = new THREE.Points();
    const distantGalaxy = new THREE.Points();

    constellation.userData['objectId'] = 'constellation-centaurus';
    catalogStar.userData['objectId'] = 'hyg-68483';
    catalogStar.userData['pickingPriority'] = 20;
    distantGalaxy.userData['objectId'] = 'milky-way';
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [catalogStar, constellation, distantGalaxy],
      () => null,
      selected,
      navigationIntent,
      () => 10,
      () => true,
      labelHovered,
    );
    const access = manager as unknown as SelectionManagerAccess;

    vi.spyOn(access.raycaster, 'intersectObjects').mockImplementation(
      (_objects, _recursive, optionalTarget) => {
        const target = optionalTarget ?? [];

        target.push(
          intersection(constellation),
          intersection(catalogStar),
          intersection(distantGalaxy),
        );

        return target;
      },
    );

    expect(access.findRaycastObjectAt({ clientX: 100, clientY: 100 })).toBe('hyg-68483');
  });

  it('filtre les points catalogués denses mais conserve un objet de navigation raycasté', () => {
    manager.dispose();
    const catalogStar = new THREE.Points();
    const galaxy = new THREE.Points();

    catalogStar.userData['objectId'] = 'hyg-98417';
    galaxy.userData['objectId'] = 'milky-way';
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [catalogStar, galaxy],
      () => null,
      selected,
      navigationIntent,
      () => 10,
      () => true,
      labelHovered,
      semanticZoom,
      (objectId) => objectId === 'milky-way',
    );
    const access = manager as unknown as SelectionManagerAccess;

    const intersectObjects = vi
      .spyOn(access.raycaster, 'intersectObjects')
      .mockImplementation((_objects, _recursive, optionalTarget) => {
        const target = optionalTarget ?? [];

        target.push(intersection(catalogStar), intersection(galaxy));

        return target;
      });

    dispatchWheel(canvas, -120, 400, 300);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'milky-way',
      expect.closeTo(-57.1046270096, 10),
      { x: 0, y: 0 },
      { rawDeltaY: -120, deltaMode: 0 },
    );
    expect(intersectObjects).toHaveBeenCalledOnce();
  });

  it('accepte par défaut un objet raycastable comme ancre de zoom', () => {
    manager.dispose();
    const catalogStar = new THREE.Points();

    catalogStar.userData['objectId'] = 'hyg-98417';
    manager = new SelectionManager(
      canvas,
      new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 1_000),
      () => [catalogStar],
      () => null,
      selected,
      navigationIntent,
      () => 10,
      () => false,
      labelHovered,
      semanticZoom,
    );
    const access = manager as unknown as SelectionManagerAccess;

    const intersectObjects = vi
      .spyOn(access.raycaster, 'intersectObjects')
      .mockImplementation((_objects, _recursive, optionalTarget) => {
        const target = optionalTarget ?? [];

        target.push(intersection(catalogStar));

        return target;
      });

    dispatchWheel(canvas, -120, 400, 300);
    expect(semanticZoom).toHaveBeenLastCalledWith(
      'hyg-98417',
      expect.closeTo(-57.1046270096, 10),
      { x: 0, y: 0 },
      { rawDeltaY: -120, deltaMode: 0 },
    );
    expect(intersectObjects).toHaveBeenCalledOnce();
  });

  it('adapte le seuil des points à la caméra et au viewport', () => {
    const access = manager as unknown as SelectionManagerAccess;

    access.updateRaycastThresholds(600);
    expect(access.raycaster.params.Points?.threshold).toBe(0.5);
    expect(access.raycaster.params.Line?.threshold).toBe(0.2);
    access.getReferenceDistance = () => 1_000;
    access.updateRaycastThresholds(600);
    expect(access.raycaster.params.Points?.threshold).toBeGreaterThan(0.5);
    expect(access.raycaster.params.Line?.threshold).toBeGreaterThan(0.2);
    access.getReferenceDistance = () => -10;
    access.updateRaycastThresholds(10_000);
    expect(access.raycaster.params.Points?.threshold).toBe(0.5);
    expect(access.raycaster.params.Line?.threshold).toBe(0.2);
    access.updateRaycastThresholds(0);
    access.camera = new THREE.OrthographicCamera();
    access.updateRaycastThresholds(600);
  });

  it('exécute le callback de survol par défaut lors de la destruction', () => {
    const local = new SelectionManager(
      document.createElement('canvas'),
      new THREE.PerspectiveCamera(),
      () => [],
      () => null,
      vi.fn(),
      vi.fn(),
      () => 1,
      () => false,
    );

    local.dispose();
  });
});

describe('résolution des objets batchés', () => {
  it('retrouve une étoile HYG visible par son index de vertex', () => {
    const points = new THREE.Points();

    points.userData['objectIds'] = ['hyg-1', 'hyg-2'];
    points.userData['visibleIndices'] = new Uint8Array([1, 0]);

    expect(resolveObjectId({ object: points, index: 0 } as unknown as THREE.Intersection)).toBe(
      'hyg-1',
    );
    expect(
      resolveObjectId({ object: points, index: 1 } as unknown as THREE.Intersection),
    ).toBeNull();
  });

  it('donne la priorité à l’identifiant direct du marqueur réutilisable', () => {
    const marker = new THREE.Points();

    marker.userData['objectId'] = 'hyg-32263';

    expect(resolveObjectId({ object: marker } as unknown as THREE.Intersection)).toBe('hyg-32263');
  });

  it('retrouve une constellation par l’index de vertex du segment groupé', () => {
    const lines = new THREE.LineSegments();

    lines.userData['objectIds'] = [
      'constellation-orion',
      'constellation-orion',
      'constellation-lyra',
      'constellation-lyra',
    ];
    lines.userData['visibleIndices'] = new Uint8Array([1, 1, 1, 1]);

    expect(resolveObjectId(intersection(lines, 0))).toBe('constellation-orion');
    expect(resolveObjectId(intersection(lines, 2))).toBe('constellation-lyra');
  });

  it('résout un segment volumineux via un index typé sans dupliquer ses identifiants', () => {
    const lines = new THREE.LineSegments();

    lines.userData['objectIds'] = ['filament-1', 'filament-2'];
    lines.userData['objectIndices'] = new Uint16Array([1, 1, 0, 0]);
    lines.userData['visibleIndices'] = new Uint8Array([1, 1, 1, 1]);

    expect(resolveObjectId(intersection(lines, 0))).toBe('filament-2');
    expect(resolveObjectId(intersection(lines, 2))).toBe('filament-1');
    lines.userData['objectIndices'] = new Uint32Array([0, 0, 1, 1]);
    expect(resolveObjectId(intersection(lines, 0))).toBe('filament-1');
    lines.userData['objectIndices'] = new Uint16Array();
    expect(resolveObjectId(intersection(lines, 0))).toBeNull();
  });

  it('rejette toutes les métadonnées batchées incomplètes ou invalides', () => {
    const points = new THREE.Points();

    expect(resolveObjectId(intersection(points))).toBeNull();
    points.userData['objectIds'] = ['hyg-1'];
    expect(resolveObjectId(intersection(points, 0))).toBeNull();
    points.userData['visibleIndices'] = [1];
    expect(resolveObjectId(intersection(points, 0))).toBeNull();
    points.userData['visibleIndices'] = new Uint8Array([1]);
    points.userData['objectIds'] = [42];
    expect(resolveObjectId(intersection(points, 0))).toBeNull();
  });
});

interface PointerOptions {
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
  button?: number;
  clientX?: number;
  clientY?: number;
  timeStamp?: number;
}

function dispatchPointer(
  target: HTMLCanvasElement,
  type: 'pointercancel' | 'pointerdown' | 'pointermove' | 'pointerup',
  options: PointerOptions,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 120,
    clientY: options.clientY ?? 90,
  });

  Object.defineProperties(event, {
    pointerId: { value: options.pointerId ?? 1 },
    pointerType: { value: options.pointerType ?? 'mouse' },
    isPrimary: { value: options.isPrimary ?? true },
    ...(options.timeStamp === undefined ? {} : { timeStamp: { value: options.timeStamp } }),
  });
  target.dispatchEvent(event);
}

function dispatchWheel(
  target: HTMLElement,
  deltaY: number,
  clientX: number,
  clientY: number,
  timeStamp?: number,
  deltaMode = 0,
): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY,
    deltaMode,
    clientX,
    clientY,
  });

  if (timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  }

  target.dispatchEvent(event);

  return event;
}

interface SelectionManagerAccess {
  camera: THREE.Camera;
  getReferenceDistance: () => number;
  navigationLock: { objectId: string | null; x: number; y: number } | null;
  lastHoverRaycastTime: number;
  readonly raycaster: THREE.Raycaster;
  findObjectAt(event: { clientX: number; clientY: number }): string | null;
  findRaycastObjectAt(event: { clientX: number; clientY: number }): string | null;
  updateRaycastThresholds(viewportHeight: number): void;
}

function intersection(object: THREE.Object3D, index?: number): THREE.Intersection {
  return {
    object,
    distance: 0,
    point: new THREE.Vector3(),
    ...(index === undefined ? {} : { index }),
  };
}
