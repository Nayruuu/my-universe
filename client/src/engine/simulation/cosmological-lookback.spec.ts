import {
  calculateFlatLambdaCdmComovingDistanceMpc,
  calculateFlatLambdaCdmLookbackJulianYears,
  calculateFlatLambdaCdmLuminosityDistanceMpc,
  inferFlatLambdaCdmRedshiftFromComovingDistanceMpc,
  inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc,
} from './cosmological-lookback';

describe('temps de regard en arrière ΛCDM', () => {
  it('reproduit une valeur indépendante à z=0,5', () => {
    // Independent Astropy FlatLambdaCDM(H0=70, Om0=0.3) reference values:
    // lookback_time(0.5) = 5.040637929 Gyr and comoving_distance(0.5) = 1888.625396 Mpc.
    // https://docs.astropy.org/en/stable/api/astropy.cosmology.FlatLambdaCDM.html
    expect(calculateFlatLambdaCdmLookbackJulianYears(0.5)).toBeCloseTo(5_040_637_929.310_091, 2);
    expect(calculateFlatLambdaCdmComovingDistanceMpc(0.5)).toBeCloseTo(1_888.625_396, 5);
    expect(calculateFlatLambdaCdmLuminosityDistanceMpc(0.5)).toBeCloseTo(2_832.938_094, 5);
  });

  it('inverse séparément les distances comobile et de luminosité', () => {
    expect(inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(1_888.625_396)).toBeCloseTo(0.5, 8);
    expect(inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc(2_832.938_094)).toBeCloseTo(0.5, 8);
    expect(
      inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(
        calculateFlatLambdaCdmComovingDistanceMpc(2),
      ),
    ).toBeCloseTo(2, 8);
    expect(inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(0)).toBe(0);
    expect(inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc(0)).toBe(0);
  });

  it('valide les entrées et borne explicitement le domaine inversé', () => {
    expect(calculateFlatLambdaCdmLookbackJulianYears(0)).toBe(0);
    expect(calculateFlatLambdaCdmComovingDistanceMpc(0)).toBe(0);
    expect(() => calculateFlatLambdaCdmLookbackJulianYears(Number.NaN)).toThrow('invalide');
    expect(() => calculateFlatLambdaCdmComovingDistanceMpc(-1)).toThrow('invalide');
    expect(() => inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(-1)).toThrow('invalide');
    expect(() =>
      inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(
        calculateFlatLambdaCdmComovingDistanceMpc(10) + 1,
      ),
    ).toThrow('hors du domaine');
    expect(() =>
      inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc(
        calculateFlatLambdaCdmLuminosityDistanceMpc(10) + 1,
      ),
    ).toThrow('hors du domaine');
  });
});
