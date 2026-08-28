import * as THREE from 'three';
import { type Mock } from 'vitest';
import { type SpaceObject } from '../../data/models/universe.models';
import { ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER } from '../camera/navigation-policy';
import { LodManager } from '../lod/lod-manager';
import {
  type NavigationCameraController,
  UniverseNavigationRuntime,
} from './universe-navigation-runtime';

describe('UniverseNavigationRuntime', () => {
  it('adopte, suit et libère une cible sans dépendre du moteur principal', () => {
    const harness = createHarness();

    harness.runtime.restoreTarget('earth');
    expect(harness.runtime.targetId).toBe('earth');

    harness.runtime.adoptTarget('earth');
    harness.runtime.follow(harness.controller);
    expect(harness.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(harness.controller.follow).toHaveBeenCalledWith(harness.positions.get('earth'));

    harness.runtime.handleNavigationIntent(harness.controller, 'mars');
    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.adoptZoomTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith('mars');

    harness.emitTargetChanged.mockClear();
    harness.runtime.handleNavigationIntent(harness.controller, 'mars');
    harness.runtime.handleNavigationIntent(harness.controller, 'unknown');
    expect(harness.emitTargetChanged).not.toHaveBeenCalled();

    harness.runtime.handleNavigationIntent(harness.controller, null);
    expect(harness.controller.releaseTarget).toHaveBeenCalledWith();
    expect(harness.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith(null);

    harness.emitTargetChanged.mockClear();
    harness.runtime.releaseTarget(null);
    harness.runtime.follow(null);
    harness.runtime.restoreTarget('unknown');
    harness.runtime.follow(harness.controller);
    expect(harness.emitTargetChanged).not.toHaveBeenCalled();
    expect(harness.controller.follow).toHaveBeenCalledOnce();

    harness.runtime.reset();
    expect(harness.runtime.targetId).toBeNull();
  });

  it('ignore un objet pendant le dézoom et change de référentiel avec la hiérarchie explicite', () => {
    const harness = createHarness();
    const pointer = { x: 0.4, y: -0.2 };

    harness.runtime.adoptTarget('earth');
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', 120, pointer)).toBe(
      'zoom-pointer',
    );
    expect(harness.runtime.targetId).toBe('earth');
    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(pointer.x, pointer.y);
    expect(harness.controller.adoptZoomAnchor).not.toHaveBeenCalled();
    expect(harness.controller.trackTarget).not.toHaveBeenCalled();
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(
      120,
      ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
    );
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'pointer',
      anchorObjectId: null,
    });

    harness.runtime.synchronizeContext(harness.controller, 3);
    expect(harness.runtime.targetId).toBe('milky-way');
    expect(harness.controller.transitionReferenceFrame).toHaveBeenCalledWith(
      harness.positions.get('milky-way'),
      harness.definitions.get('milky-way'),
    );
    expect(harness.runtime.resolveContext(3)).toMatchObject({
      targetId: 'milky-way',
      referenceFrame: 'galactic',
    });

    harness.positions.delete('local-group');
    harness.runtime.synchronizeContext(harness.controller, 4);
    expect(harness.runtime.targetId).toBe('milky-way');

    expect(harness.runtime.handleSemanticZoomIntent(null, 'earth', -120)).toBe('ignored');
  });

  it('synchronise la cible lors d’un changement de niveau produit par le zoom direct', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.zoomBy.mockImplementation(() => {
      harness.controller.distanceToTarget = 3_600;
    });
    harness.runtime.zoomBy(harness.controller, 1.5);

    expect(harness.controller.zoomBy).toHaveBeenCalledWith(1.5);
    expect(harness.runtime.targetId).toBe('milky-way');
    expect(harness.controller.transitionReferenceFrame).toHaveBeenCalledOnce();

    harness.runtime.zoomBy(null, 0.5);
  });

  it('préserve la réciprocité locale pendant un franchissement de référentiel au pointeur', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 3_600;
    harness.controller.semanticZoomActive = true;
    let initialGuidedAnchor: THREE.Vector3 | null = null;

    harness.controller.adoptZoomAnchor.mockImplementationOnce((position: THREE.Vector3) => {
      initialGuidedAnchor = position.clone();
    });
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.distanceToTarget = 1_400;
      harness.controller.inwardZoomActive = true;
    });
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'milky-way', -480)).toBe(
      'bypass-wheel-target',
    );
    expect(harness.runtime.targetId).toBe('sun');
    expect(initialGuidedAnchor).not.toBeNull();
    expect(initialGuidedAnchor!.x).toBeGreaterThan(harness.positions.get('sun')!.x);
    expect(initialGuidedAnchor!.x).toBeLessThan(harness.positions.get('milky-way')!.x);

    harness.controller.inwardZoomActive = true;
    harness.runtime.handleSemanticZoomIntent(harness.controller, 'sun', 120);

    expect(harness.controller.cancelInwardZoom).not.toHaveBeenCalled();
    expect(harness.controller.adoptReferenceFrame).toHaveBeenCalledWith(
      harness.positions.get('sun'),
      harness.definitions.get('sun'),
    );
    expect(harness.controller.transitionReferenceFrame).not.toHaveBeenCalled();
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'target',
      anchorObjectId: 'sun',
    });
  });

  it('utilise le curseur au dézoom puis adopte l’objet visé au zoom avant', () => {
    const harness = createHarness();
    const pointer = { x: 0.35, y: -0.22 };

    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, 480, pointer)).toBe(
      'zoom-pointer',
    );

    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(pointer.x, pointer.y);
    expect(harness.controller.adoptZoomAnchor).not.toHaveBeenCalled();
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'pointer',
      anchorObjectId: null,
    });

    harness.controller.semanticZoomActive = true;
    expect(
      harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -480, pointer),
    ).toBe('adopt-wheel-target');

    expect(harness.controller.adoptZoomAnchor).toHaveBeenCalledWith(harness.positions.get('mars'));
    expect(harness.controller.trackTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.controller.trackTarget.mock.invocationCallOrder[0]).toBeLessThan(
      harness.controller.adoptZoomAnchor.mock.invocationCallOrder[0]!,
    );
    expect(harness.runtime.targetId).toBe('mars');
  });

  it('ignore un objet survolé pendant un dézoom libre', () => {
    const harness = createHarness();
    const pointer = { x: -0.35, y: 0.09 };

    harness.controller.semanticZoomActive = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', 120, pointer)).toBe(
      'zoom-pointer',
    );

    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(pointer.x, pointer.y);
    expect(harness.controller.adoptZoomAnchor).not.toHaveBeenCalled();
    expect(harness.controller.trackTarget).not.toHaveBeenCalled();
    expect(harness.runtime.targetId).toBeNull();
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'pointer',
      anchorObjectId: null,
    });
  });

  it('reprend au pointeur un trajet libre déjà engagé', () => {
    const harness = createHarness();
    const pointer = { x: 0.18, y: -0.27 };

    harness.controller.semanticZoomActive = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120, pointer)).toBe(
      'continue-free-journey',
    );

    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(pointer.x, pointer.y);
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(-120);
    expect(harness.runtime.targetId).toBeNull();
  });

  it('libère la cible lorsqu’un zoom avant dépasse son seuil de proximité', () => {
    const harness = createHarness();
    const pointer = { x: -0.62, y: 0.41 };

    harness.runtime.adoptTarget('earth');
    harness.controller.atMinimumNavigationDistance = true;
    harness.setNavigationTarget.mockClear();
    harness.emitTargetChanged.mockClear();
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120, pointer)).toBe(
      'release-target',
    );

    expect(harness.controller.releaseTarget).toHaveBeenCalledWith(true);
    expect(harness.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(harness.emitTargetChanged).toHaveBeenCalledWith(null);
    expect(harness.runtime.targetId).toBeNull();
    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(pointer.x, pointer.y);
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(-120);
  });

  it('ne restaure pas une cible quittée à la limite de précision locale', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.atMinimumNavigationDistance = true;
    harness.controller.targetApproachReachedPrecisionLimit = true;

    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120)).toBe(
      'release-target',
    );
    expect(harness.controller.releaseTarget).toHaveBeenCalledWith();

    harness.controller.minimumTraversalActive = true;
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = false;
    });
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, 120);

    expect(harness.runtime.targetId).toBeNull();
    expect(harness.controller.adoptReferenceFrame).not.toHaveBeenCalled();
  });

  it('restaure la cible lorsque le retour épuise la traversée minimale', () => {
    const harness = createHarness();
    const pointer = { x: -0.07986111111111116, y: 0.43515850144092216 };

    harness.runtime.adoptTarget('mars');
    harness.controller.atMinimumNavigationDistance = true;
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = true;
    });

    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120, pointer)).toBe(
      'release-target',
    );
    expect(harness.runtime.targetId).toBeNull();

    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = true;
    });
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, 60, pointer)).toBe(
      'zoom-pointer',
    );
    expect(harness.runtime.targetId).toBeNull();
    expect(harness.controller.adoptReferenceFrame).not.toHaveBeenCalled();

    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = false;
      harness.controller.distanceToTarget = 0.53;
    });
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, 120, pointer)).toBe(
      'zoom-pointer',
    );

    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.setNavigationTarget).toHaveBeenLastCalledWith('mars');
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith('mars');
    expect(harness.controller.adoptReferenceFrame).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
  });

  it('abandonne proprement la restauration si la cible libérée a disparu', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('mars');
    harness.controller.atMinimumNavigationDistance = true;
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = true;
    });
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120);
    harness.positions.delete('mars');
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = false;
    });

    harness.runtime.handleSemanticZoomIntent(harness.controller, null, 120);

    expect(harness.runtime.targetId).toBeNull();
    expect(harness.controller.adoptReferenceFrame).not.toHaveBeenCalled();
  });

  it('oublie la cible libérée lorsque la traversée minimale a été interrompue', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('mars');
    harness.controller.atMinimumNavigationDistance = true;
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = true;
    });
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120);
    harness.setNavigationTarget.mockClear();
    harness.controller.adoptReferenceFrame.mockClear();

    harness.controller.minimumTraversalActive = false;
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = true;
    });
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120);
    harness.controller.zoomSemantically.mockImplementationOnce(() => {
      harness.controller.minimumTraversalActive = false;
    });
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, 120);

    expect(harness.runtime.targetId).toBeNull();
    expect(harness.setNavigationTarget).not.toHaveBeenCalledWith('mars');
    expect(harness.controller.adoptReferenceFrame).not.toHaveBeenCalled();
  });

  it('conserve la cible pendant le zoom du ciel observable', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.observerPresentationActive = true;
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120, {
      x: -0.15,
      y: 0.2,
    });

    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
    expect(harness.runtime.targetId).toBe('earth');
    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(-0.15, 0.2);
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(-120);
  });

  it('conserve la cible sans interception puis réoriente un trajet engagé vers l’objet visé', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.semanticZoomActive = true;
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -480, {
      x: 0.25,
      y: -0.35,
    });

    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
    expect(harness.runtime.targetId).toBe('earth');
    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledWith(0.25, -0.35);
    expect(harness.controller.adoptZoomAnchor).not.toHaveBeenCalled();
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'pointer',
      anchorObjectId: null,
    });

    harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120, {
      x: -0.2,
      y: 0.1,
    });
    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.trackTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.controller.adoptZoomAnchor).toHaveBeenLastCalledWith(
      harness.positions.get('mars'),
    );
  });

  it('accélère symétriquement le zoom dans le vide tant que la cible reste active', () => {
    const harness = createHarness();
    const pointer = { x: -0.034_722_222_222_222_21, y: 0.104_707_012_487_992_3 };
    const traceDeltaY = 12.393_471_593_369_597;

    harness.runtime.adoptTarget('hyg-17661');

    expect(
      harness.runtime.handleSemanticZoomIntent(harness.controller, null, -traceDeltaY, pointer),
    ).toBe('zoom-pointer');
    expect(
      harness.runtime.handleSemanticZoomIntent(harness.controller, null, traceDeltaY, pointer),
    ).toBe('zoom-pointer');

    expect(harness.runtime.targetId).toBe('hyg-17661');
    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
    expect(harness.controller.zoomSemantically.mock.calls).toEqual([
      [-traceDeltaY, ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER],
      [traceDeltaY, ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER],
    ]);
  });

  it('raccorde la cadence du pointeur avant de conserver celle de l’objet', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.distanceToTarget = Math.sqrt(8);

    harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120);
    harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120);

    expect(harness.controller.zoomSemantically.mock.calls[0]?.[0]).toBe(-120);
    expect(harness.controller.zoomSemantically.mock.calls[0]?.[1]).toBeCloseTo(2, 12);
    expect(harness.controller.zoomSemantically.mock.calls[1]).toEqual([-120]);
  });

  it('adopte immédiatement un autre objet sous la molette et l’utilise comme pivot', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
      'adopt-wheel-target',
    );

    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.adoptZoomAnchor).toHaveBeenCalledWith(harness.positions.get('mars'));
    expect(harness.controller.trackTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(-120);
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith('mars');
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'object',
      anchorObjectId: 'mars',
    });
  });

  it('atteint la butée de l’objet visé sans le libérer pendant la même rafale', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('mars');
    harness.controller.atMinimumNavigationDistance = true;
    for (let index = 0; index < 3; index += 1) {
      expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
        'zoom-current-target',
      );
    }

    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
    expect(harness.controller.trackTarget).not.toHaveBeenCalled();
    expect(harness.controller.zoomSemantically).toHaveBeenCalledTimes(3);
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'object',
      anchorObjectId: 'mars',
    });
  });

  it('adopte la nouvelle cible avant toute traversée libre depuis la butée précédente', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('sirius');
    harness.controller.atMinimumNavigationDistance = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'sun', -120)).toBe(
      'adopt-wheel-target',
    );

    expect(harness.runtime.targetId).toBe('sun');
    expect(harness.controller.trackTarget).toHaveBeenCalledWith(
      harness.positions.get('sun'),
      harness.definitions.get('sun'),
    );
    expect(harness.controller.releaseTarget).not.toHaveBeenCalled();
  });

  it('ne libère la cible à sa butée que lorsque la molette vise de nouveau l’espace vide', () => {
    const harness = createHarness();
    const pointer = { x: 0.1, y: 0.2 };

    harness.runtime.adoptTarget('mars');
    harness.controller.atMinimumNavigationDistance = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, null, -120, pointer)).toBe(
      'release-target',
    );

    expect(harness.controller.releaseTarget).toHaveBeenCalledWith(true);
    expect(harness.runtime.targetId).toBeNull();
    expect(harness.controller.adoptZoomPointer).toHaveBeenLastCalledWith(pointer.x, pointer.y);
  });

  it('attend une nouvelle rafale avant de traverser la butée atteinte au pointeur', () => {
    const harness = createHarness();
    const pointer = { x: 0.109_375, y: 0.265_384_615_384_615_33 };

    harness.controller.distanceToTarget = 0.752_152_610_959_856_4;
    harness.controller.atMinimumNavigationDistance = false;
    harness.runtime.handleSemanticZoomIntent(
      harness.controller,
      null,
      -12.393_471_667_736_222,
      pointer,
      true,
      true,
    );

    expect(harness.controller.zoomSemantically).toHaveBeenLastCalledWith(
      -12.393_471_667_736_222,
      1,
      false,
    );

    harness.controller.atMinimumNavigationDistance = true;
    harness.runtime.handleSemanticZoomIntent(
      harness.controller,
      null,
      -18.714_973_875_118_524,
      pointer,
      false,
      false,
    );

    expect(harness.controller.zoomSemantically).toHaveBeenLastCalledWith(
      -18.714_973_875_118_524,
      1,
      false,
    );

    harness.runtime.handleSemanticZoomIntent(
      harness.controller,
      null,
      -18.714_973_875_118_524,
      pointer,
      false,
      true,
    );

    expect(harness.controller.zoomSemantically).toHaveBeenLastCalledWith(-18.714_973_875_118_524);
  });

  it('contourne une interception indisponible, en transition ou depuis le ciel observable', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.isTransitioning = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
      'bypass-wheel-target',
    );
    expect(harness.runtime.targetId).toBe('earth');

    harness.controller.isTransitioning = false;
    harness.controller.observerPresentationActive = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
      'bypass-wheel-target',
    );

    harness.controller.observerPresentationActive = false;
    harness.hasPrimaryRegistry.mockReturnValue(false);
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
      'bypass-wheel-target',
    );

    harness.hasPrimaryRegistry.mockReturnValue(true);
    harness.positions.delete('mars');
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120)).toBe(
      'bypass-wheel-target',
    );

    expect(harness.controller.trackTarget).not.toHaveBeenCalled();
    expect(harness.controller.adoptZoomPointer).toHaveBeenCalledTimes(4);
  });

  it('conserve sa cible sous le pointeur pendant une transition déjà engagée', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.isTransitioning = true;
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'earth', -120)).toBe(
      'zoom-current-target',
    );

    expect(harness.controller.adoptZoomAnchor).toHaveBeenCalledWith(harness.positions.get('earth'));
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
  });

  it('fait converger le pivot vers le Soleil sans saut lors du changement de référentiel', () => {
    const harness = createHarness();
    const galaxy = harness.positions.get('milky-way')!;
    const sun = harness.positions.get('sun')!;

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 3_600;
    harness.controller.semanticZoomActive = true;
    harness.runtime.follow(harness.controller);

    const [guidedPosition, viewElevation, viewElevationMode] =
      harness.controller.follow.mock.lastCall!;
    const galaxyToSun = sun.clone().sub(galaxy);
    const arrivalProgress =
      guidedPosition.clone().sub(galaxy).dot(galaxyToSun) / galaxyToSun.lengthSq();

    expect(guidedPosition).not.toBe(galaxy);
    expect(guidedPosition.x).toBeGreaterThan(Math.min(galaxy.x, sun.x));
    expect(guidedPosition.x).toBeLessThan(Math.max(galaxy.x, sun.x));
    expect(arrivalProgress).toBeGreaterThan(0);
    expect(arrivalProgress).toBeLessThan(0.12);
    expect(viewElevation).toBeCloseTo(0.45, 8);
    expect(viewElevationMode).toBe('distance');

    harness.controller.distanceToTarget = 2_300;
    harness.runtime.synchronizeContext(harness.controller, 2, true);
    const [adoptedPosition] = harness.controller.adoptReferenceFrame.mock.lastCall!;

    expect(adoptedPosition).not.toBe(sun);
    expect(adoptedPosition.x).toBeGreaterThan(Math.min(galaxy.x, sun.x));
    expect(adoptedPosition.x).toBeLessThan(Math.max(galaxy.x, sun.x));
  });

  it('termine un centrage sur la Voie lactée sans lancer la chorégraphie avant la molette', () => {
    const harness = createHarness();
    const galaxy = harness.positions.get('milky-way')!;

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 3_600;
    harness.controller.semanticZoomActive = false;
    harness.runtime.follow(harness.controller);

    expect(harness.controller.follow).toHaveBeenCalledWith(galaxy);
  });

  it('active la chorégraphie pendant une plongée continue même hors étape sémantique', () => {
    const harness = createHarness();
    const galaxy = harness.positions.get('milky-way')!;

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 3_600;
    harness.controller.semanticZoomActive = false;
    harness.controller.inwardZoomActive = true;
    harness.runtime.follow(harness.controller);

    const [guidedPosition, viewElevation, viewElevationMode] =
      harness.controller.follow.mock.lastCall!;

    expect(guidedPosition).not.toEqual(galaxy);
    expect(viewElevation).toBeCloseTo(0.45, 8);
    expect(viewElevationMode).toBe('distance');
  });

  it('rafraîchit le guide galactique avant chaque image sans retargeter les autres vues', () => {
    const harness = createHarness();

    harness.runtime.updateCameraGuide(null);
    expect(harness.controller.follow).not.toHaveBeenCalled();

    harness.runtime.adoptTarget('earth');
    harness.controller.inwardZoomActive = true;
    harness.runtime.updateCameraGuide(harness.controller);
    expect(harness.controller.follow).not.toHaveBeenCalled();

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 4_200;
    harness.runtime.updateCameraGuide(harness.controller);

    expect(harness.controller.follow).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      expect.any(Number),
      'distance',
    );
  });

  it('revient au centre galactique si la position du référentiel stellaire manque', () => {
    const harness = createHarness();
    const galaxy = harness.positions.get('milky-way')!;

    harness.runtime.adoptTarget('milky-way');
    harness.positions.delete('sun');
    harness.controller.distanceToTarget = 3_600;
    harness.runtime.follow(harness.controller);

    expect(harness.controller.follow).toHaveBeenCalledOnce();
    expect(harness.controller.follow).toHaveBeenCalledWith(galaxy);
  });

  it('garde la trajectoire galactique à cadence normale quand la molette vise le vide', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 3_600;

    expect(
      harness.runtime.handleSemanticZoomIntent(
        harness.controller,
        null,
        -120,
        { x: -0.6, y: 0.35 },
        true,
      ),
    ).toBe('zoom-pointer');

    const [guidedAnchor] = harness.controller.adoptZoomAnchor.mock.lastCall!;

    expect(guidedAnchor).not.toBe(harness.positions.get('milky-way'));
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
    expect(harness.controller.zoomSemantically).toHaveBeenCalledWith(-120, 1);
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'target',
      anchorObjectId: 'milky-way',
    });
  });

  it('ignore une cible sous le curseur à la borne extérieure arrondie de la plongée', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('milky-way');
    harness.controller.distanceToTarget = 17_000 + 1e-9;

    expect(
      harness.runtime.handleSemanticZoomIntent(
        harness.controller,
        'mars',
        -120,
        { x: 0, y: 0 },
        true,
      ),
    ).toBe('bypass-wheel-target');
    expect(harness.runtime.targetId).toBe('milky-way');
    expect(harness.controller.trackTarget).not.toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.controller.adoptZoomAnchor).toHaveBeenCalled();
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
  });

  it('conserve l’ancre de la rafale sans réadopter l’objet après un changement hiérarchique', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('milky-way');
    expect(harness.runtime.handleSemanticZoomIntent(harness.controller, 'milky-way', -120)).toBe(
      'zoom-current-target',
    );

    harness.runtime.adoptTarget('sun');
    harness.controller.isTransitioning = true;
    harness.controller.trackTarget.mockClear();
    expect(
      harness.runtime.handleSemanticZoomIntent(
        harness.controller,
        'milky-way',
        -120,
        { x: 0.2, y: -0.1 },
        false,
      ),
    ).toBe('zoom-object');

    expect(harness.runtime.targetId).toBe('sun');
    expect(harness.controller.adoptZoomAnchor).toHaveBeenLastCalledWith(
      harness.positions.get('milky-way'),
    );
    expect(harness.controller.trackTarget).not.toHaveBeenCalled();
    expect(harness.controller.adoptZoomPointer).not.toHaveBeenCalled();
  });
});

function createHarness(): {
  readonly runtime: UniverseNavigationRuntime;
  readonly controller: MutableNavigationCameraController;
  readonly definitions: Map<string, SpaceObject>;
  readonly positions: Map<string, THREE.Vector3>;
  readonly hasPrimaryRegistry: ReturnType<typeof vi.fn>;
  readonly setNavigationTarget: ReturnType<typeof vi.fn>;
  readonly emitTargetChanged: ReturnType<typeof vi.fn>;
} {
  const definitions = new Map<string, SpaceObject>([
    ['earth', object('earth', 'Terre', 'planet', 'sun')],
    ['mars', object('mars', 'Mars', 'planet', 'sun')],
    ['sun', object('sun', 'Soleil', 'star', 'milky-way')],
    ['sirius', object('sirius', 'Sirius', 'star', 'milky-way', 'stellar')],
    ['hyg-17661', object('hyg-17661', 'HYG 17661', 'star', 'milky-way', 'stellar')],
    ['milky-way', object('milky-way', 'Voie lactée', 'galaxy', 'local-group')],
    [
      'local-group',
      object('local-group', 'Groupe local', 'region', 'nearby-universe', 'local-group'),
    ],
    [
      'nearby-universe',
      object('nearby-universe', 'Univers proche', 'region', 'cosmic-web', 'nearby-universe'),
    ],
    ['cosmic-web', object('cosmic-web', 'Réseau cosmique', 'universe', undefined, 'cosmic-web')],
  ]);
  const positions = new Map(
    [...definitions.keys()].map((objectId, index) => [
      objectId,
      new THREE.Vector3(index + 1, index * 0.5, -index),
    ]),
  );
  const setNavigationTarget = vi.fn();
  const emitTargetChanged = vi.fn();
  const hasPrimaryRegistry = vi.fn(() => true);
  const lodManager = new LodManager();
  const runtime = new UniverseNavigationRuntime({
    hasPrimaryRegistry,
    getDefinition: (objectId) => definitions.get(objectId),
    getWorldPosition: (objectId, target = new THREE.Vector3()) => {
      const position = positions.get(objectId);

      return position ? target.copy(position) : null;
    },
    setNavigationTarget,
    selectLodLevel: (distance) => lodManager.selectLevel(distance),
    emitTargetChanged,
  });
  const controller: MutableNavigationCameraController = {
    controls: { target: new THREE.Vector3(), minDistance: 1 },
    distanceToTarget: 24,
    isTransitioning: false,
    observerPresentationActive: false,
    semanticZoomActive: false,
    inwardZoomActive: false,
    minimumTraversalActive: false,
    atMinimumNavigationDistance: false,
    targetApproachReachedPrecisionLimit: false,
    cancelInwardZoom: vi.fn<NavigationCameraController['cancelInwardZoom']>(),
    adoptZoomAnchor: vi.fn<NavigationCameraController['adoptZoomAnchor']>(),
    adoptZoomPointer: vi.fn<NavigationCameraController['adoptZoomPointer']>(),
    adoptZoomTarget: vi.fn<NavigationCameraController['adoptZoomTarget']>(),
    trackTarget: vi.fn<NavigationCameraController['trackTarget']>(),
    zoomSemantically: vi.fn<NavigationCameraController['zoomSemantically']>(),
    zoomBy: vi.fn<NavigationCameraController['zoomBy']>(),
    adoptReferenceFrame: vi.fn<NavigationCameraController['adoptReferenceFrame']>(),
    transitionReferenceFrame: vi.fn<NavigationCameraController['transitionReferenceFrame']>(),
    releaseTarget: vi.fn<NavigationCameraController['releaseTarget']>(),
    follow: vi.fn<NavigationCameraController['follow']>(),
  };

  controller.cancelInwardZoom.mockImplementation(() => {
    controller.inwardZoomActive = false;
  });

  return {
    runtime,
    controller,
    definitions,
    positions,
    hasPrimaryRegistry,
    setNavigationTarget,
    emitTargetChanged,
  };
}

type MutableNavigationCameraController = Omit<
  NavigationCameraController,
  | 'distanceToTarget'
  | 'isTransitioning'
  | 'observerPresentationActive'
  | 'semanticZoomActive'
  | 'inwardZoomActive'
  | 'minimumTraversalActive'
  | 'atMinimumNavigationDistance'
  | 'targetApproachReachedPrecisionLimit'
  | 'cancelInwardZoom'
  | 'adoptZoomAnchor'
  | 'adoptZoomPointer'
  | 'adoptZoomTarget'
  | 'trackTarget'
  | 'zoomSemantically'
  | 'zoomBy'
  | 'adoptReferenceFrame'
  | 'transitionReferenceFrame'
  | 'releaseTarget'
  | 'follow'
> & {
  distanceToTarget: number;
  isTransitioning: boolean;
  observerPresentationActive: boolean;
  semanticZoomActive: boolean;
  inwardZoomActive: boolean;
  minimumTraversalActive: boolean;
  atMinimumNavigationDistance: boolean;
  targetApproachReachedPrecisionLimit: boolean;
  readonly cancelInwardZoom: Mock<NavigationCameraController['cancelInwardZoom']>;
  readonly adoptZoomAnchor: Mock<NavigationCameraController['adoptZoomAnchor']>;
  readonly adoptZoomPointer: Mock<NavigationCameraController['adoptZoomPointer']>;
  readonly adoptZoomTarget: Mock<NavigationCameraController['adoptZoomTarget']>;
  readonly trackTarget: Mock<NavigationCameraController['trackTarget']>;
  readonly zoomSemantically: Mock<NavigationCameraController['zoomSemantically']>;
  readonly zoomBy: Mock<NavigationCameraController['zoomBy']>;
  readonly adoptReferenceFrame: Mock<NavigationCameraController['adoptReferenceFrame']>;
  readonly transitionReferenceFrame: Mock<NavigationCameraController['transitionReferenceFrame']>;
  readonly releaseTarget: Mock<NavigationCameraController['releaseTarget']>;
  readonly follow: Mock<NavigationCameraController['follow']>;
};

function object(
  id: string,
  name: string,
  type: SpaceObject['type'],
  parentId?: string,
  referenceFrame: SpaceObject['referenceFrame'] = 'solar-system',
): SpaceObject {
  return {
    id,
    name,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame,
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
