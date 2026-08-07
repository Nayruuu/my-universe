import { calculateIauRotationAngles } from './iau-rotation-model';

// Independent fixtures evaluated from NASA/JPL NAIF pck00011.tpc.
// Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
describe('modèles de rotation IAU WGCCRE', () => {
  it.each([
    ['io', 267.956994934, 64.520579581, 200.474122141],
    ['europa', 268.039806524, 64.961246022, 36.058732961],
    ['ganymede', 268.506836873, 64.436151399, 43.786991579],
    ['callisto', 268.219592373, 64.682095279, 259.961721077],
    ['titan', 39.4827, 83.4279, 186.5855],
    ['ceres', 291.418, 66.764, 170.65],
    ['vesta', 309.031, 42.235, 285.39],
  ] as const)(
    'reproduit les angles publiés de %s à J2000 TDB',
    (body, rightAscensionDegrees, declinationDegrees, primeMeridianDegrees) => {
      expect(calculateIauRotationAngles(body, 0)).toEqual({
        rightAscensionDegrees: expect.closeTo(rightAscensionDegrees, 8),
        declinationDegrees: expect.closeTo(declinationDegrees, 8),
        primeMeridianDegrees: expect.closeTo(primeMeridianDegrees, 8),
      });
    },
  );

  it.each([
    ['io', 268.04591158, 64.469878984, 9.929652383],
    ['europa', 267.373648328, 64.851759983, 23.892465825],
    ['ganymede', 268.049221069, 64.361072929, 300.278982862],
    ['callisto', 268.182376045, 64.757998073, 330.708530797],
    ['titan', 39.4827, 83.4279, 236.3535],
    ['ceres', 291.418, 66.764, 62.65],
    ['vesta', 309.031, 42.235, 254.818],
  ] as const)(
    'reste conforme au kernel pour %s dix mille jours après J2000',
    (body, rightAscensionDegrees, declinationDegrees, primeMeridianDegrees) => {
      expect(calculateIauRotationAngles(body, 10_000)).toEqual({
        rightAscensionDegrees: expect.closeTo(rightAscensionDegrees, 8),
        declinationDegrees: expect.closeTo(declinationDegrees, 8),
        primeMeridianDegrees: expect.closeTo(primeMeridianDegrees, 8),
      });
    },
  );
});
