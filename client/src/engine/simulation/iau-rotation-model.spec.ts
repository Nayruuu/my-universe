import { calculateIauRotationAngles } from './iau-rotation-model';

// Independent fixtures evaluated from NASA/JPL NAIF pck00011.tpc.
// Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
describe('modèles de rotation IAU WGCCRE', () => {
  it.each([
    ['phobos', 318.012874329, 53.94540922, 35.107351721],
    ['deimos', 319.037138435, 52.46338546, 77.448923297],
    ['io', 267.956994934, 64.520579581, 200.474122141],
    ['europa', 268.039806524, 64.961246022, 36.058732961],
    ['ganymede', 268.506836873, 64.436151399, 43.786991579],
    ['callisto', 268.219592373, 64.682095279, 259.961721077],
    ['titan', 39.4827, 83.4279, 186.5855],
    ['mimas', 41.275122119, 85.048424972, 3.749588314],
    ['enceladus', 40.66, 83.52, 6.32],
    ['tethys', 32.294194599, 82.975, 15.727402148],
    ['dione', 40.66, 83.52, 357.6],
    ['rhea', 39.58811815, 83.211611814, 235.946772934],
    ['iapetus', 318.16, 75.03, 355.2],
    ['miranda', 261.756477854, -15.962100289, 32.587004022],
    ['ariel', 257.189607411, -14.943385475, 156.119210146],
    ['umbriel', 257.266132533, -14.974924228, 108.065235107],
    ['titania', 257.334724277, -14.83554249, 77.713717042],
    ['oberon', 257.272865522, -15.130145578, 6.730716381],
    ['triton', 298.450983409, 20.30236126, 297.017803534],
    ['charon', 132.993, -6.163, 122.695],
    ['ceres', 291.418, 66.764, 170.65],
    ['vesta', 309.031, 42.235, 285.39],
    ['pallas', 44, 1, 41.7],
    ['hygiea', 319, -46, 116.5],
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
    ['phobos', 318.99540355, 53.586890333, 321.509914692],
    ['deimos', 314.112115772, 54.561554517, 140.39297981],
    ['io', 268.04591158, 64.469878984, 9.929652383],
    ['europa', 267.373648328, 64.851759983, 23.892465825],
    ['ganymede', 268.049221069, 64.361072929, 300.278982862],
    ['callisto', 268.182376045, 64.757998073, 330.708530797],
    ['titan', 39.4827, 83.4279, 236.3535],
    ['mimas', 27.198891118, 83.712285728, 287.705302298],
    ['enceladus', 40.650143737, 83.51890486, 45.316],
    ['tethys', 48.872839392, 84.090963084, 62.084754914],
    ['dione', 40.650143737, 83.51890486, 266.916],
    ['rhea', 43.222697789, 83.411880369, 92.803849523],
    ['iapetus', 317.078822724, 74.717063655, 14.772],
    ['miranda', 253.019859545, -15.206237563, 122.305810066],
    ['ariel', 257.157126756, -15.005201189, 279.481250941],
    ['umbriel', 257.225549639, -15.054324918, 99.037038237],
    ['titania', 257.244362385, -14.884885281, 203.372789623],
    ['oberon', 257.567246548, -15.182239802, 91.872311637],
    ['triton', 304.473313904, 20.684563532, 81.132771799],
    ['charon', 132.993, -6.163, 347.92],
    ['ceres', 291.418, 66.764, 62.65],
    ['vesta', 309.031, 42.235, 254.818],
    ['pallas', 44, 1, 104.11],
    ['hygiea', 319, -46, 157.19],
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
