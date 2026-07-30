import { equatorialJ2000ToGalacticScene } from './galactic-reference-frame';

describe('référentiel galactique J2000', () => {
  it('place la direction du centre galactique vers le centre du disque', () => {
    const galacticCenter = equatorialJ2000ToGalacticScene(
      equatorialUnitVector(266.404_994_8, -28.936_173_96),
    );

    expect(galacticCenter.x).toBeCloseTo(-1, 6);
    expect(galacticCenter.y).toBeCloseTo(0, 6);
    expect(galacticCenter.z).toBeCloseTo(0, 6);
  });

  it('aligne le pôle nord galactique sur la verticale de la scène', () => {
    const northGalacticPole = equatorialJ2000ToGalacticScene(
      equatorialUnitVector(192.859_48, 27.128_25),
    );

    expect(northGalacticPole.x).toBeCloseTo(0, 6);
    expect(northGalacticPole.y).toBeCloseTo(1, 6);
    expect(northGalacticPole.z).toBeCloseTo(0, 6);
  });

  it('préserve les distances, y compris pour le vecteur nul', () => {
    const source = { x: 3, y: -4, z: 12 };
    const transformed = equatorialJ2000ToGalacticScene(source);
    const transformedOrigin = equatorialJ2000ToGalacticScene({ x: 0, y: 0, z: 0 });

    expect(Math.hypot(transformed.x, transformed.y, transformed.z)).toBeCloseTo(13, 8);
    expect(transformedOrigin).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    expect(Object.values(transformedOrigin).some((value) => Object.is(value, -0))).toBe(false);
  });

  it.each([
    {
      name: 'Sirius',
      equatorialParsec: [-0.494_323, 2.476_731, -0.758_485] as const,
      longitudeDegrees: 227.230_291_26,
      latitudeDegrees: -8.890_281_21,
    },
    {
      name: 'Véga',
      equatorialParsec: [0.960_56, -5.908_01, 4.809_73] as const,
      longitudeDegrees: 67.448_208_13,
      latitudeDegrees: 19.237_252_27,
    },
    {
      name: 'Polaris',
      equatorialParsec: [1.343_1, 1.047_629, 132.614_914] as const,
      longitudeDegrees: 123.280_549_67,
      latitudeDegrees: 26.461_395_98,
    },
    {
      name: 'Proxima Centauri',
      equatorialParsec: [-0.472_264, -0.361_451, -1.151_219] as const,
      longitudeDegrees: 313.939_862_05,
      latitudeDegrees: -1.927_149_13,
    },
  ])(
    'retrouve les coordonnées galactiques CDS de $name depuis le vecteur HYG',
    ({ equatorialParsec, longitudeDegrees, latitudeDegrees }) => {
      const scene = equatorialJ2000ToGalacticScene({
        x: equatorialParsec[0],
        y: equatorialParsec[1],
        z: equatorialParsec[2],
      });
      const longitude = normalizeDegrees((Math.atan2(scene.z, -scene.x) * 180) / Math.PI);
      const latitude = (Math.asin(scene.y / Math.hypot(scene.x, scene.y, scene.z)) * 180) / Math.PI;

      expect(longitude).toBeCloseTo(longitudeDegrees, 4);
      expect(latitude).toBeCloseTo(latitudeDegrees, 4);
    },
  );
});

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function equatorialUnitVector(
  rightAscensionDegrees: number,
  declinationDegrees: number,
): { x: number; y: number; z: number } {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const projected = Math.cos(declination);

  return {
    x: projected * Math.cos(rightAscension),
    y: projected * Math.sin(rightAscension),
    z: Math.sin(declination),
  };
}
