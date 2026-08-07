import type { SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { SolarEclipseStatePublisher } from './solar-eclipse-state-publisher';

describe('SolarEclipseStatePublisher', () => {
  it('publie uniquement les changements de phase avec les coordonnées centrales', () => {
    const emit = vi.fn();
    const publisher = new SolarEclipseStatePublisher(emit);
    const partial = appearance('partial', 42.3, -8.7);

    publisher.publish(partial, false);
    publisher.publish(partial, false);
    publisher.publish(appearance('total', null, null), false);

    expect(emit.mock.calls).toEqual([
      [{ phase: 'partial', centralLatitude: 42.3, centralLongitude: -8.7 }],
      [{ phase: 'total', centralLatitude: null, centralLongitude: null }],
    ]);
  });

  it('peut forcer une republication puis oublier la phase précédente', () => {
    const emit = vi.fn();
    const publisher = new SolarEclipseStatePublisher(emit);
    const none = appearance('none', null, null);

    publisher.publish(none, false);
    publisher.publish(none, true);
    publisher.reset();
    publisher.publish(none, false);

    expect(emit).toHaveBeenCalledTimes(3);
  });
});

function appearance(
  phase: SolarEclipseAppearance['phase'],
  centralLatitude: number | null,
  centralLongitude: number | null,
): SolarEclipseAppearance {
  return {
    phase,
    sunPositionInEarthRadii: { x: 100, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 10, y: 0, z: 0 },
    shadowDirection: { x: -1, y: 0, z: 0 },
    centralLatitude,
    centralLongitude,
  };
}
