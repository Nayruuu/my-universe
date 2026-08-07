export const STELLAR_PROFILE_TINT_GLSL = `
  float stellarProfileWeight(float profile, float expectedProfile) {
    return 1.0 - step(0.5, abs(profile - expectedProfile));
  }

  vec3 illustrativeStellarTint(float profile) {
    vec3 tint = vec3(0.0);
    tint += vec3(0.38, 0.67, 1.0) * stellarProfileWeight(profile, 0.0);
    tint += vec3(0.68, 0.88, 1.0) * stellarProfileWeight(profile, 1.0);
    tint += vec3(1.0, 0.56, 0.12) * stellarProfileWeight(profile, 2.0);
    tint += vec3(1.0, 0.3, 0.06) * stellarProfileWeight(profile, 3.0);
    tint += vec3(0.95, 0.12, 0.05) * stellarProfileWeight(profile, 4.0);
    tint += vec3(1.0, 0.16, 0.06) * stellarProfileWeight(profile, 5.0);
    tint += vec3(1.0, 0.1, 0.04) * stellarProfileWeight(profile, 6.0);
    tint += vec3(0.58, 0.12, 0.18) * stellarProfileWeight(profile, 7.0);
    return tint;
  }
`;

/** Shared, branch-light GLSL used by the batched stellar impostors. */
export const STELLAR_SPRITE_SURFACE_GLSL = `
  ${STELLAR_PROFILE_TINT_GLSL}

  float stellarSurfaceHash(vec2 point) {
    vec3 hashPoint = fract(vec3(point.xyx) * 0.1031);
    hashPoint += dot(hashPoint, hashPoint.yzx + 33.33);
    return fract((hashPoint.x + hashPoint.y) * hashPoint.z);
  }

  float stellarSurfaceNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(stellarSurfaceHash(cell), stellarSurfaceHash(cell + vec2(1.0, 0.0)), local.x),
      mix(
        stellarSurfaceHash(cell + vec2(0.0, 1.0)),
        stellarSurfaceHash(cell + vec2(1.0, 1.0)),
        local.x
      ),
      local.y
    );
  }

  float stellarSurfaceFbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.58;
    for (int octave = 0; octave < 3; octave += 1) {
      value += stellarSurfaceNoise(point) * amplitude;
      point = point * 2.07 + vec2(5.2, -3.1);
      amplitude *= 0.46;
    }
    return value;
  }

  vec4 proceduralPhotosphere(
    vec2 point,
    vec3 starColor,
    float cellScale,
    float surfaceContrast,
    float coronaStrength,
    float spotStrength,
    float surfaceSeed,
    float surfaceProfile
  ) {
    float radius = length(point);
    vec3 displayColor = mix(starColor, illustrativeStellarTint(surfaceProfile), 0.28);
    float photosphereDisc = 1.0 - smoothstep(0.44, 0.52, radius);
    float normalizedRadius = radius / 0.52;
    float limb = sqrt(max(0.0, 1.0 - normalizedRadius * normalizedRadius));
    vec2 seedOffset = vec2(surfaceSeed * 19.17, surfaceSeed * -13.73);
    float profileOffset = surfaceProfile * 0.37;
    float granulation = stellarSurfaceFbm(
      point * max(3.0, cellScale * 0.34) + seedOffset + profileOffset
    );
    float fineCells = stellarSurfaceFbm(
      point * max(5.0, cellScale * 0.71) - seedOffset * 0.63 + 7.1
    );
    float darkCells = smoothstep(
      0.61,
      0.91,
      stellarSurfaceFbm(point * max(2.5, cellScale * 0.13) + seedOffset * 0.21)
    ) * spotStrength;
    float cellRidges = pow(1.0 - abs(granulation * 2.0 - 1.0), 4.0);
    float surfaceLight = 0.62
      + (granulation - 0.5) * surfaceContrast * 1.7
      + cellRidges * surfaceContrast * 0.38
      + (fineCells - 0.5) * surfaceContrast * 0.34
      - darkCells;
    vec3 photosphere = mix(
      displayColor * 0.34,
      displayColor,
      clamp(surfaceLight, 0.0, 1.0)
    );
    photosphere = mix(photosphere, vec3(1.0), clamp(fineCells * 0.13 + limb * 0.07, 0.0, 0.22));
    photosphere *= 0.5 + limb * 0.58;
    float halo = pow(max(0.0, 1.0 - radius), 2.1) * coronaStrength;
    float rim = exp(-pow((radius - 0.49) * 16.0, 2.0)) * coronaStrength;
    vec3 finalColor = mix(
      displayColor * (0.54 + halo * 0.32),
      photosphere,
      photosphereDisc
    );
    finalColor += displayColor * rim * 0.28;
    float surfaceAlpha = photosphereDisc * (0.88 + limb * 0.12);
    float coronaAlpha = pow(max(0.0, 1.0 - radius), 2.7) * coronaStrength * 0.38;
    return vec4(finalColor, min(1.0, max(surfaceAlpha, coronaAlpha + rim * 0.24)));
  }
`;
