export const STELLAR_POINT_PROXIMITY_GLSL = `
  const float stellarPointReferenceDistance = 520.0;
  const float stellarPointMaximumGrowth = 2.8;
  const float stellarPointReferenceProjectionScale = 2.2460368;
  const float stellarPointMaximumProjectionGrowth = 3.2;

  float stellarPointProximityGrowth(vec3 viewPosition) {
    float distanceToCamera = max(length(viewPosition), 1.0);

    return clamp(
      sqrt(stellarPointReferenceDistance / distanceToCamera),
      1.0,
      stellarPointMaximumGrowth
    );
  }

  float stellarPointProjectionGrowth() {
    float projectionScale = max(projectionMatrix[1][1], stellarPointReferenceProjectionScale);

    return clamp(
      pow(projectionScale / stellarPointReferenceProjectionScale, 0.35),
      1.0,
      stellarPointMaximumProjectionGrowth
    );
  }
`;
