// IAU J2000 equatorial-to-galactic rotation. Its transpose converts a
// published Galactic direction back to the renderer's equatorial frame.
const EQUATORIAL_TO_GALACTIC_ROTATION = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

export function galacticToEquatorialSkyPosition(galacticLongitudeDegrees, galacticLatitudeDegrees) {
  assertGalacticPosition(galacticLongitudeDegrees, galacticLatitudeDegrees);
  const longitude = degreesToRadians(galacticLongitudeDegrees);
  const latitude = degreesToRadians(galacticLatitudeDegrees);
  const projected = Math.cos(latitude);
  const galactic = [
    projected * Math.cos(longitude),
    projected * Math.sin(longitude),
    Math.sin(latitude),
  ];
  const equatorial = EQUATORIAL_TO_GALACTIC_ROTATION.map((_, axis) =>
    EQUATORIAL_TO_GALACTIC_ROTATION.reduce(
      (sum, row, rowIndex) => sum + row[axis] * galactic[rowIndex],
      0,
    ),
  );

  return {
    rightAscensionDegrees: normalizeDegrees(
      radiansToDegrees(Math.atan2(equatorial[1], equatorial[0])),
    ),
    declinationDegrees: radiansToDegrees(Math.asin(Math.max(-1, Math.min(1, equatorial[2])))),
  };
}

export function equatorialToCartesian(rightAscensionDegrees, declinationDegrees, distance) {
  const rightAscension = degreesToRadians(rightAscensionDegrees);
  const declination = degreesToRadians(declinationDegrees);
  const projectedDistance = distance * Math.cos(declination);

  return [
    projectedDistance * Math.cos(rightAscension),
    distance * Math.sin(declination),
    projectedDistance * Math.sin(rightAscension),
  ];
}

function assertGalacticPosition(longitude, latitude) {
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) {
    throw new Error(`Invalid galactic longitude: ${longitude}.`);
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid galactic latitude: ${latitude}.`);
  }
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}
