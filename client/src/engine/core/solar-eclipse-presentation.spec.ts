import { describe, expect, it, vi } from 'vitest';
import { type EarthEclipseEvent } from '../simulation/earth-eclipse';
import {
  SolarEclipsePresentationController,
  type SolarEclipsePresentationRegistry,
} from './solar-eclipse-presentation';

describe('SolarEclipsePresentationController', () => {
  it('démarre sans présentation active et autorise les labels', () => {
    const presentation = new SolarEclipsePresentationController();

    expect(presentation.activeEvent).toBeNull();
    expect(presentation.pathVisible).toBe(false);
    expect(presentation.observerActive).toBe(false);
    expect(presentation.observerMoonScale).toBe(1);
    expect(presentation.labelsAllowed).toBe(true);
  });

  it('active la vue orbitale en retirant la trajectoire et l’observateur', () => {
    const presentation = new SolarEclipsePresentationController();
    const registry = createRegistry();

    presentation.showOrbitalView(SOLAR_ECLIPSE, registry);

    expect(presentation.activeEvent).toBe(SOLAR_ECLIPSE);
    expect(presentation.pathVisible).toBe(false);
    expect(presentation.observerActive).toBe(false);
    expect(presentation.labelsAllowed).toBe(false);
    expect(registry.setSolarObserverActive).toHaveBeenCalledWith(false);
    expect(registry.clearSolarEclipsePath).toHaveBeenCalledOnce();
  });

  it('active la vue depuis le sol avec son échelle lunaire adaptée', () => {
    const presentation = new SolarEclipsePresentationController();
    const registry = createRegistry();

    presentation.showObserverView(SOLAR_ECLIPSE, 1.18, registry);

    expect(presentation.activeEvent).toBe(SOLAR_ECLIPSE);
    expect(presentation.observerActive).toBe(true);
    expect(presentation.observerMoonScale).toBe(1.18);
    expect(presentation.labelsAllowed).toBe(false);
    expect(registry.clearSolarEclipsePath).toHaveBeenCalledOnce();
    expect(registry.setSolarObserverActive).toHaveBeenCalledWith(true, 1.18);
  });

  it('affiche et masque la trajectoire même lorsque le registre est absent', () => {
    const presentation = new SolarEclipsePresentationController();
    const registry = createRegistry();

    presentation.setPathVisible(SOLAR_ECLIPSE, true, registry);
    expect(registry.showSolarEclipsePath).toHaveBeenCalledWith(
      SOLAR_ECLIPSE.peak,
      SOLAR_ECLIPSE.kind,
    );

    presentation.setPathVisible(SOLAR_ECLIPSE, false, registry);
    expect(registry.clearSolarEclipsePath).toHaveBeenCalledOnce();

    presentation.setPathVisible(SOLAR_ECLIPSE, true, null);
    presentation.setPathVisible(SOLAR_ECLIPSE, false, null);
    expect(presentation.activeEvent).toBe(SOLAR_ECLIPSE);
    expect(presentation.pathVisible).toBe(false);
  });

  it('restaure uniquement la trajectoire compatible avec le mode orbital', () => {
    const presentation = new SolarEclipsePresentationController();
    const orbitalRegistry = createRegistry();

    presentation.setPathVisible(SOLAR_ECLIPSE, true, null);
    presentation.restore(orbitalRegistry);
    expect(orbitalRegistry.setSolarObserverActive).toHaveBeenCalledWith(false, 1);
    expect(orbitalRegistry.showSolarEclipsePath).toHaveBeenCalledWith(
      SOLAR_ECLIPSE.peak,
      SOLAR_ECLIPSE.kind,
    );

    const observerRegistry = createRegistry();

    presentation.showObserverView(SOLAR_ECLIPSE, 0.84, observerRegistry);
    presentation.setPathVisible(SOLAR_ECLIPSE, true, null);
    presentation.restore(observerRegistry);
    expect(observerRegistry.setSolarObserverActive).toHaveBeenLastCalledWith(true, 0.84);
    expect(observerRegistry.showSolarEclipsePath).not.toHaveBeenCalled();
  });

  it('efface complètement la présentation avec ou sans registre', () => {
    const presentation = new SolarEclipsePresentationController();
    const registry = createRegistry();

    presentation.showObserverView(SOLAR_ECLIPSE, 1.12, registry);
    presentation.clear(registry);

    expect(presentation.activeEvent).toBeNull();
    expect(presentation.pathVisible).toBe(false);
    expect(presentation.observerActive).toBe(false);
    expect(presentation.observerMoonScale).toBe(1);
    expect(presentation.labelsAllowed).toBe(true);
    expect(registry.setSolarObserverActive).toHaveBeenLastCalledWith(false);
    expect(registry.clearSolarEclipsePath).toHaveBeenCalledTimes(2);

    presentation.showOrbitalView(SOLAR_ECLIPSE, registry);
    presentation.clear(null);
    expect(presentation.activeEvent).toBeNull();
  });
});

const SOLAR_ECLIPSE: EarthEclipseEvent = {
  id: 'solar-total-2026-08-12',
  family: 'solar',
  kind: 'total',
  scope: 'global',
  peak: { julianDay: 2_461_265.24 },
  obscuration: 1,
  durationMinutes: 2.3,
  latitude: 65.2,
  longitude: -25.2,
  observerName: null,
  observerTimeZone: null,
  sunAltitudeDegrees: null,
  localContacts: null,
};

function createRegistry(): SolarEclipsePresentationRegistry {
  return {
    setSolarObserverActive: vi.fn(),
    clearSolarEclipsePath: vi.fn(),
    showSolarEclipsePath: vi.fn(async () => undefined),
  };
}
