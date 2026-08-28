import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  calculateAdaptedMilkyWayLocalSpurAngle,
  calculateIllustrativeMilkyWayArmAngle,
  MILKY_WAY_ADAPTED_VISUAL_RADIUS,
} from './milky-way-density-model';

export interface MilkyWayProceduralVolumeProfile {
  readonly rayMarchSteps: number;
  readonly absorption: number;
  readonly dustAbsorption: number;
  readonly brightness: number;
}

const VOLUME_WIDTH = 192;
const VOLUME_HEIGHT = 48;
const VOLUME_DEPTH = 192;
const VOLUME_CHANNEL_COUNT = 4;
const MAXIMUM_RAY_MARCH_STEPS = 32;
let densityFieldTemplate: Uint8Array | null = null;

export const MILKY_WAY_PROCEDURAL_MINIMUM_VISIBLE_OPACITY = 0.02;
const VOLUME_PROFILES = {
  low: { rayMarchSteps: 8, absorption: 3.8, dustAbsorption: 6.4, brightness: 1.28 },
  medium: { rayMarchSteps: 16, absorption: 4.3, dustAbsorption: 7.2, brightness: 1.52 },
  high: { rayMarchSteps: 32, absorption: 4.8, dustAbsorption: 8.2, brightness: 1.78 },
} as const satisfies Record<GraphicQuality, MilkyWayProceduralVolumeProfile>;

export function getMilkyWayProceduralVolumeProfile(
  quality: GraphicQuality,
): MilkyWayProceduralVolumeProfile {
  return VOLUME_PROFILES[quality];
}

export class MilkyWayProceduralVolume {
  public readonly material: THREE.ShaderMaterial;
  public readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;

  private readonly densityTexture = createDensityTexture();

  constructor(diameter: number, thickness: number) {
    this.material = createVolumeMaterial(this.densityTexture, VOLUME_PROFILES.medium);
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.material);
    this.mesh.name = 'milky-way-procedural-density-volume';
    this.mesh.scale.set(diameter / 2, thickness / 2, diameter / 2);
    // Composite the integrated-light volume after the additive stellar batch so its near-black
    // extinction can carve coherent lanes through the same luminous structure. The volume remains
    // one transparent draw and never writes depth.
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.userData['scientificConfidence'] = 'illustrative';
    this.mesh.userData['representationTechnique'] = 'procedural-three-dimensional-density-volume';
    this.mesh.userData['densityResolution'] = [VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH];
    this.mesh.userData['spiralStructure'] = 'two-major-and-two-secondary-cloudy-arms';
    this.mesh.userData['dustTreatment'] =
      'leading-edge-rifts-plus-inner-filaments-and-bar-dust-lanes';
    this.mesh.userData['structuralContrastTreatment'] =
      'localized-near-black-dust-extinction-separated-from-emissive-starlight';
    this.mesh.userData['compositingTreatment'] =
      'ray-marched-extinction-over-additive-stellar-detail';
    this.mesh.userData['coreTreatment'] =
      'compact-ivory-nucleus-inside-an-amber-bar-with-paired-dust-lanes';
    this.mesh.userData['colorStructure'] =
      'structured-sapphire-cyan-arms-amber-bar-ivory-nucleus-magenta-hii-and-black-dust';
    this.mesh.userData['densityTreatment'] = 'clustered-branched-starlight-with-dark-interarm-gaps';
    this.mesh.userData['integratedLightTreatment'] =
      'unresolved-stellar-light-structured-into-arms-filaments-and-clumps';
    this.mesh.userData['localSpurTreatment'] =
      'illustrative-branch-anchored-at-the-solar-galactocentric-radius';
    this.mesh.userData['visualReferences'] = [
      'NASA/JPL-Caltech/R. Hurt Milky Way structure',
      'NASA/JPL-Caltech/ESO/R. Hurt VISTA bulge impression',
      'ESO Milky Way central panorama',
    ];
    this.setQuality('medium');
  }

  public setQuality(quality: GraphicQuality): void {
    const profile = getMilkyWayProceduralVolumeProfile(quality);

    this.material.uniforms['rayMarchSteps']!.value = profile.rayMarchSteps;
    this.material.uniforms['absorption']!.value = profile.absorption;
    this.material.uniforms['dustAbsorption']!.value = profile.dustAbsorption;
    this.material.uniforms['brightness']!.value = profile.brightness;
    this.mesh.userData['quality'] = quality;
    this.mesh.userData['rayMarchSteps'] = profile.rayMarchSteps;
  }

  public update(opacity: number, radiance: number): void {
    this.material.uniforms['volumeOpacity']!.value = opacity;
    this.material.uniforms['radiance']!.value = radiance;
    this.mesh.visible = opacity > MILKY_WAY_PROCEDURAL_MINIMUM_VISIBLE_OPACITY;
  }

  public dispose(): void {
    this.densityTexture.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

function createDensityTexture(): THREE.Data3DTexture {
  const density = getDensityFieldTemplate();
  const texture = new THREE.Data3DTexture(density, VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH);

  texture.name = 'illustrative-milky-way-density-volume';
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

function getDensityFieldTemplate(): Uint8Array {
  // Each volume owns and disposes its Data3DTexture. Only its deterministic, immutable CPU data is
  // shared, avoiding the multi-million-sample rebuild performed by every scene construction.
  densityFieldTemplate ??= createDensityField();

  return densityFieldTemplate;
}

function createDensityField(): Uint8Array {
  const density = new Uint8Array(
    VOLUME_WIDTH * VOLUME_HEIGHT * VOLUME_DEPTH * VOLUME_CHANNEL_COUNT,
  );
  const sample: MilkyWayDensitySample = {
    emission: 0,
    dust: 0,
    youngStars: 0,
    warmth: 0,
  };
  let offset = 0;

  for (let zIndex = 0; zIndex < VOLUME_DEPTH; zIndex += 1) {
    const z = normalizedCoordinate(zIndex, VOLUME_DEPTH);

    for (let yIndex = 0; yIndex < VOLUME_HEIGHT; yIndex += 1) {
      const y = normalizedCoordinate(yIndex, VOLUME_HEIGHT);

      for (let xIndex = 0; xIndex < VOLUME_WIDTH; xIndex += 1) {
        const x = normalizedCoordinate(xIndex, VOLUME_WIDTH);

        sampleDensity(sample, x, y, z);
        density[offset] = Math.round(sample.emission * 255);
        density[offset + 1] = Math.round(sample.dust * 255);
        density[offset + 2] = Math.round(sample.youngStars * 255);
        density[offset + 3] = Math.round(sample.warmth * 255);
        offset += VOLUME_CHANNEL_COUNT;
      }
    }
  }

  return density;
}

interface MilkyWayDensitySample {
  emission: number;
  dust: number;
  youngStars: number;
  warmth: number;
}

function sampleDensity(target: MilkyWayDensitySample, x: number, y: number, z: number): void {
  const radius = Math.hypot(x, z);

  if (radius >= 1) {
    target.emission = 0;
    target.dust = 0;
    target.youngStars = 0;
    target.warmth = 0;

    return;
  }
  const angle = Math.atan2(z, x);
  const broadNoise = fractalNoise2d(x * 2.35 + 9.4, z * 2.35 - 5.7, 17);
  const filamentNoise = fractalNoise2d(x * 8.8 - 11.3, z * 8.8 + 7.1, 53);
  const cloudNoise = fractalNoise2d(x * 17.2 + 3.8, z * 17.2 - 13.2, 89);
  const cellNoise = hashVoxel(
    Math.round((x + 1) * 80),
    Math.round((y + 1) * 20),
    Math.round((z + 1) * 80),
  );
  const warpedRadius = radius * (0.95 + broadNoise * 0.105);
  const warpedAngle =
    angle +
    (broadNoise - 0.5) * 0.26 +
    (filamentNoise - 0.5) * 0.07 +
    Math.sin(angle * 3 + warpedRadius * 9.5) * 0.032;
  const armWidth = THREE.MathUtils.lerp(0.16, 0.3, smoothstep(0.16, 0.94, warpedRadius));
  const armGate = smoothstep(0.14, 0.27, warpedRadius) * (1 - smoothstep(0.84, 1, warpedRadius));
  let armDensity = 0;
  let youngStarDensity = 0;
  let dustLane = 0;

  for (let armIndex = 0; armIndex < 4; armIndex += 1) {
    const armAngle = calculateIllustrativeMilkyWayArmAngle(
      warpedRadius * MILKY_WAY_ADAPTED_VISUAL_RADIUS,
      armIndex,
    );
    const majorArm = armIndex % 2 === 0;
    const localArmWidth = armWidth * (majorArm ? 1 : 0.72);
    const armWarp =
      (broadNoise - 0.5) * localArmWidth * 1.45 +
      (filamentNoise - 0.5) * localArmWidth * 0.8 +
      Math.sin(warpedRadius * (11.5 + armIndex * 0.7) + armIndex * 1.37) * localArmWidth * 0.38;
    const warpedArmAngle = armAngle + armWarp;
    const distance = angularDistance(warpedAngle, warpedArmAngle);
    const broadProfile = gaussianProfile(distance, localArmWidth * 1.65);
    const ridgeOffset =
      (cloudNoise - 0.5) * localArmWidth * 0.46 +
      Math.sin(warpedRadius * 23 + armIndex * 1.91) * localArmWidth * 0.18;
    const ridge = gaussianProfile(
      angularDistance(warpedAngle, warpedArmAngle + ridgeOffset),
      localArmWidth * 0.43,
    );
    const splitGate =
      smoothstep(0.32, 0.48, warpedRadius) * (1 - smoothstep(0.72, 0.94, warpedRadius));
    const splitRidge =
      gaussianProfile(
        angularDistance(
          warpedAngle,
          warpedArmAngle + (majorArm ? 1 : -1) * (0.11 + warpedRadius * 0.1),
        ),
        localArmWidth * 0.34,
      ) * splitGate;
    const armWave =
      0.5 +
      Math.sin(
        warpedRadius * (19 + armIndex * 1.7) +
          warpedAngle * (majorArm ? 2.5 : 4.5) +
          armIndex * 2.13,
      ) *
        0.5;
    const cloudSignal =
      broadNoise * 0.22 + filamentNoise * 0.24 + cloudNoise * 0.39 + armWave * 0.15;
    const cloudStrength = smoothstep(0.43, majorArm ? 0.69 : 0.73, cloudSignal);
    const fragmentedStrength = majorArm
      ? 0.12 + cloudStrength * 0.88
      : smoothstep(0.2, 0.82, cloudStrength);
    const radialAsymmetry =
      armIndex === 0
        ? 1 - smoothstep(0.9, 1.01, warpedRadius)
        : armIndex === 1
          ? 1 - smoothstep(0.84, 0.98, warpedRadius)
          : armIndex === 2
            ? 1 - smoothstep(0.91, 1.02, warpedRadius)
            : 1 - smoothstep(0.8, 0.96, warpedRadius);
    const armStrength = (majorArm ? 1 : 0.38) * radialAsymmetry;

    armDensity +=
      armGate *
      (broadProfile * (majorArm ? 0.045 : 0.018) * (0.45 + cloudStrength * 0.55) +
        ridge * (majorArm ? 0.54 : 0.31) * fragmentedStrength +
        splitRidge * cloudStrength * (majorArm ? 0.26 : 0.14)) *
      armStrength;
    youngStarDensity +=
      armGate * ridge * smoothstep(0.57, 0.76, cloudSignal) * armStrength * fragmentedStrength;

    const leadingDustDistance = angularDistance(warpedAngle, warpedArmAngle - 0.06);
    const armDust = gaussianProfile(leadingDustDistance, localArmWidth * 0.14);

    dustLane = Math.max(
      dustLane,
      armGate * armDust * fragmentedStrength * (0.36 + filamentNoise * 0.34 + cloudStrength * 0.42),
    );
  }

  const branchGate =
    smoothstep(0.38, 0.5, warpedRadius) * (1 - smoothstep(0.72, 0.9, warpedRadius));
  const branchAngle =
    calculateIllustrativeMilkyWayArmAngle(
      warpedRadius * MILKY_WAY_ADAPTED_VISUAL_RADIUS,
      warpedRadius < 0.61 ? 0 : 2,
    ) + THREE.MathUtils.lerp(0.08, 0.28, smoothstep(0.38, 0.86, warpedRadius));
  const branchProfile = gaussianProfile(angularDistance(warpedAngle, branchAngle), armWidth * 0.72);
  const branchDensity =
    branchGate * branchProfile * smoothstep(0.48, 0.76, cloudNoise * 0.64 + filamentNoise * 0.36);
  const localSpurAngle = calculateAdaptedMilkyWayLocalSpurAngle(
    warpedRadius * MILKY_WAY_ADAPTED_VISUAL_RADIUS,
  );
  const localSpurDistance = Math.abs(
    Math.atan2(Math.sin(angle - localSpurAngle), Math.cos(angle - localSpurAngle)),
  );
  const localSpurRadialGate =
    smoothstep(0.3, 0.38, warpedRadius) * (1 - smoothstep(0.9, 0.97, warpedRadius));
  const localSpurEnvelope =
    (1 - smoothstep(0.035, 0.14, localSpurDistance)) *
    localSpurRadialGate *
    (0.16 + filamentNoise * 0.34 + cloudNoise * 0.22);

  armDensity += branchDensity * 0.38 + localSpurEnvelope * 0.32;
  youngStarDensity += branchDensity * 0.24 + localSpurEnvelope * 0.42;
  const innerDustDistance = Math.abs(
    Math.sin(warpedAngle * 2.7 + warpedRadius * 8.2 + (filamentNoise - 0.5) * 0.55),
  );
  const innerDustWeb =
    (1 - smoothstep(0.012, 0.055, innerDustDistance)) *
    smoothstep(0.09, 0.22, warpedRadius) *
    (1 - smoothstep(0.55, 0.74, warpedRadius)) *
    (0.26 + filamentNoise * 0.48);
  const barCosine = Math.cos(0.44);
  const barSine = Math.sin(0.44);
  const barX = barCosine * x - barSine * z;
  const barZ = barSine * x + barCosine * z;
  const barDensity = Math.exp(-((Math.abs(barX) / 0.34) ** 4) - (barZ / 0.08) ** 2);
  const boxyBulge = Math.exp(-((Math.abs(barX) / 0.2) ** 3.2) - (barZ / 0.09) ** 2);
  const roundBulge = Math.exp(-((warpedRadius / 0.135) ** 1.8));
  const nucleusDensity = Math.exp(-((warpedRadius / 0.034) ** 2));
  const barDustLane =
    Math.exp(-((Math.abs(barX) / 0.34) ** 5)) *
    Math.exp(-(((Math.abs(barZ) - 0.052) / 0.021) ** 2)) *
    (0.28 + filamentNoise * 0.46);

  dustLane =
    Math.max(dustLane, innerDustWeb) +
    barDustLane * 0.86 +
    localSpurEnvelope *
      (1 - smoothstep(0.018, 0.075, localSpurDistance)) *
      (0.16 + filamentNoise * 0.22);

  const irregularEdgeStart = 0.76 + broadNoise * 0.1 + filamentNoise * 0.025;
  const radialMask = 1 - smoothstep(irregularEdgeStart, 1, warpedRadius);
  const radialGlow = Math.exp(-((warpedRadius / 0.68) ** 1.4));
  const thinDisc = Math.exp(-Math.abs(y) * (8.8 - warpedRadius * 1.8));
  const thickDisc = Math.exp(-Math.abs(y) * 3.4) * 0.055;
  const centralEnvelope = Math.exp(-Math.abs(y) * 5.6);
  const interarmClouds = smoothstep(
    0.28,
    0.74,
    broadNoise * 0.42 + filamentNoise * 0.24 + cloudNoise * 0.24 + cellNoise * 0.1,
  );
  const diffuseDisc =
    radialMask *
    (0.0025 + interarmClouds * 0.019 + filamentNoise * 0.0025) *
    (0.68 + radialGlow * 0.4);
  const discDensity =
    diffuseDisc * (thinDisc + thickDisc) + armDensity * 1.08 * (thinDisc * 1.04 + thickDisc * 0.07);
  const centralDensity =
    (barDensity * 0.34 + boxyBulge * 0.28 + roundBulge * 0.3 + nucleusDensity * 0.78) *
    (0.76 + filamentNoise * 0.24) *
    centralEnvelope;
  const patchiness =
    0.18 +
    smoothstep(0.28, 0.76, broadNoise * 0.36 + cloudNoise * 0.4 + filamentNoise * 0.24) * 0.98;
  const midplaneDust =
    radialMask *
    Math.exp(-Math.abs(y) * 34) *
    (1 - smoothstep(0.72, 0.96, warpedRadius)) *
    (0.03 + filamentNoise * 0.08 + broadNoise * 0.02);
  const combinedDust = Math.max(dustLane, midplaneDust);
  const carvedDensity = (discDensity * patchiness + centralDensity) * (1 - combinedDust * 0.9);
  const smoothFineStructure =
    0.38 + filamentNoise * 0.22 + cloudNoise * 0.14 + broadNoise * 0.08 + cellNoise * 0.14;
  const coherentCore = THREE.MathUtils.clamp(
    nucleusDensity * 1.35 + roundBulge * 0.42 + barDensity * 0.1,
    0,
    1,
  );

  target.emission = THREE.MathUtils.clamp(
    carvedDensity * THREE.MathUtils.lerp(smoothFineStructure, 1.06, coherentCore),
    0,
    1,
  );
  target.dust = THREE.MathUtils.clamp(
    combinedDust *
      (thinDisc * 0.82 + thickDisc * 0.08 + centralEnvelope * 0.18) *
      (0.7 + filamentNoise * 0.3),
    0,
    1,
  );
  target.youngStars = THREE.MathUtils.clamp(
    (youngStarDensity * 0.64 + armDensity * (0.03 + cloudNoise * 0.12)) *
      thinDisc *
      (0.64 + filamentNoise * 0.24 + cloudNoise * 0.12),
    0,
    1,
  );
  target.warmth = THREE.MathUtils.clamp(
    nucleusDensity * 0.82 +
      roundBulge * 0.32 +
      boxyBulge * 0.18 +
      barDensity * 0.26 +
      armDensity * (0.035 + broadNoise * 0.085),
    0,
    1,
  );
}

function gaussianProfile(distance: number, width: number): number {
  const normalizedDistance = distance / Math.max(width, 0.0001);

  return Math.exp(-(normalizedDistance * normalizedDistance));
}

function angularDistance(angle: number, center: number): number {
  return Math.abs(Math.atan2(Math.sin(angle - center), Math.cos(angle - center)));
}

function createVolumeMaterial(
  texture: THREE.Data3DTexture,
  profile: MilkyWayProceduralVolumeProfile,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      densityTexture: { value: texture },
      volumeOpacity: { value: 0 },
      rayMarchSteps: { value: profile.rayMarchSteps },
      absorption: { value: profile.absorption },
      dustAbsorption: { value: profile.dustAbsorption },
      brightness: { value: profile.brightness },
      radiance: { value: 1 },
    },
    vertexShader: `
      out vec3 volumeRayOrigin;
      out vec3 volumeRayDirection;

      void main() {
        vec3 localCameraPosition = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;

        volumeRayOrigin = localCameraPosition;
        volumeRayDirection = position - localCameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      precision highp sampler3D;

      uniform sampler3D densityTexture;
      uniform float volumeOpacity;
      uniform float rayMarchSteps;
      uniform float absorption;
      uniform float dustAbsorption;
      uniform float brightness;
      uniform float radiance;
      in vec3 volumeRayOrigin;
      in vec3 volumeRayDirection;
      out vec4 fragmentColor;
      #define gl_FragColor fragmentColor

      const int MAXIMUM_STEPS = ${MAXIMUM_RAY_MARCH_STEPS};

      float rayJitter(vec2 position) {
        return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
      }

      vec2 intersectVolumeBox(vec3 origin, vec3 direction) {
        vec3 directionSign = mix(vec3(-1.0), vec3(1.0), greaterThanEqual(direction, vec3(0.0)));
        vec3 safeDirection = directionSign * max(abs(direction), vec3(0.00001));
        vec3 inverseDirection = 1.0 / safeDirection;
        vec3 first = (-vec3(1.0) - origin) * inverseDirection;
        vec3 second = (vec3(1.0) - origin) * inverseDirection;
        vec3 nearPlane = min(first, second);
        vec3 farPlane = max(first, second);

        return vec2(
          max(max(nearPlane.x, nearPlane.y), nearPlane.z),
          min(min(farPlane.x, farPlane.y), farPlane.z)
        );
      }

      void main() {
        if (volumeOpacity <= 0.001) {
          discard;
        }
        vec3 rayDirection = normalize(volumeRayDirection);
        float faceOnFactor = smoothstep(0.55, 0.9, abs(rayDirection.y));
        float effectiveSteps = rayMarchSteps;
        float insideVolume = all(lessThanEqual(abs(volumeRayOrigin), vec3(0.995))) ? 1.0 : 0.0;
        effectiveSteps = min(
          effectiveSteps,
          mix(rayMarchSteps, min(rayMarchSteps, 20.0), insideVolume)
        );
        vec2 intersection = intersectVolumeBox(volumeRayOrigin, rayDirection);
        float rayStart = max(intersection.x, 0.0);
        float rayEnd = intersection.y;

        if (rayEnd <= rayStart) {
          discard;
        }
        float rayStep = (rayEnd - rayStart) / max(effectiveSteps, 1.0);
        float distanceAlongRay = rayStart + rayStep * rayJitter(gl_FragCoord.xy);
        vec4 accumulated = vec4(0.0);

        for (int index = 0; index < MAXIMUM_STEPS; index += 1) {
          if (
            float(index) >= effectiveSteps ||
            accumulated.a >= 0.985 ||
            distanceAlongRay >= rayEnd
          ) {
            break;
          }
          vec3 samplePosition = volumeRayOrigin + rayDirection * distanceAlongRay;
          vec3 texturePosition = samplePosition * 0.5 + 0.5;
          vec4 densitySample = texture(densityTexture, texturePosition);
          float emissionDensity = pow(densitySample.r, 1.52);
          float dustDensity = densitySample.g;
          float youngStars = densitySample.b;
          float warmth = densitySample.a;

          if (max(emissionDensity, dustDensity) > 0.006) {
            float luminousCloud = smoothstep(0.006, 0.075, emissionDensity);
            float dustRatio = dustDensity / max(emissionDensity + dustDensity, 0.001);
            float detailNoise = rayJitter(
              floor(texturePosition.xz * 520.0) + floor(texturePosition.y * 173.0)
            );
            float youngStarTint = smoothstep(0.003, 0.1, youngStars);
            float warmTint = smoothstep(0.025, 0.48, warmth);
            float youngArmStrength = youngStarTint * mix(1.0, 0.72, warmTint);
            float sparkle = pow(detailNoise, 42.0) * youngStarTint;
            float cloudGrain = 0.88 + smoothstep(0.18, 0.82, detailNoise) * 0.22;
            float microStar = pow(detailNoise, 62.0)
              * smoothstep(0.018, 0.2, emissionDensity);
            float nebulaNoise = rayJitter(
              floor(texturePosition.xz * 68.0) + floor(texturePosition.y * 29.0)
            );
            float nebula = smoothstep(0.62, 0.86, nebulaNoise)
              * smoothstep(0.015, 0.2, youngStars);
            float hiiStrength = nebula * mix(0.72, 1.0, youngArmStrength);
            float barStrength = warmTint * (1.0 - youngArmStrength * 0.48);
            float compactNucleus = exp(-pow(length(samplePosition.xz) / 0.044, 2.0))
              * exp(-pow(abs(samplePosition.y) / 0.12, 2.0));
            float nucleusGlow = max(pow(warmth, 3.2), compactNucleus);
            float dustShadow = smoothstep(0.012, 0.22, dustDensity)
              * mix(0.7, 1.0, dustRatio);
            vec3 darkDust = vec3(0.0004, 0.0008, 0.002);
            vec3 warmDustEdge = vec3(0.022, 0.008, 0.003);
            vec3 coolCloud = vec3(0.012, 0.032, 0.13);
            vec3 neutralStarlight = vec3(0.72, 0.46, 0.24);
            vec3 sapphireStars = vec3(0.035, 0.24, 1.32);
            vec3 ionizedCyan = vec3(0.025, 0.72, 1.08);
            vec3 pinkNebula = vec3(1.16, 0.035, 0.43);
            vec3 warmCore = vec3(1.34, 0.27, 0.025);
            vec3 ivoryNucleus = vec3(1.42, 0.94, 0.55);
            vec3 sampleColor = mix(
              coolCloud,
              neutralStarlight,
              clamp(luminousCloud * 0.38 + warmTint * 0.18, 0.0, 0.76)
            );
            vec3 youngPopulationColor = mix(
              sapphireStars,
              ionizedCyan,
              smoothstep(0.035, 0.16, youngStars) * 0.54
            );

            sampleColor = mix(
              sampleColor,
              youngPopulationColor,
              clamp(youngArmStrength * 0.9 + sparkle * 0.34, 0.0, 0.92)
            );
            sampleColor = mix(sampleColor, warmCore, barStrength * 0.82);
            sampleColor = mix(sampleColor, pinkNebula, hiiStrength * 0.62);
            vec3 dustColor = mix(
              darkDust,
              warmDustEdge,
              clamp(warmth * 0.15, 0.0, 0.18)
            );
            sampleColor = mix(sampleColor, dustColor, clamp(dustShadow * 1.12, 0.0, 0.985));
            sampleColor *= cloudGrain;
            sampleColor += youngPopulationColor * youngArmStrength * luminousCloud * 0.28;
            sampleColor += mix(sapphireStars, warmCore, warmth) * microStar * 2.05;
            sampleColor += ivoryNucleus * nucleusGlow * (0.46 + compactNucleus * 0.62);
            float chromaticLuminance = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
            float chromaGain = 1.1
              + youngArmStrength * 0.3
              + barStrength * 0.14
              + hiiStrength * 0.34;
            sampleColor = max(
              vec3(0.0),
              mix(vec3(chromaticLuminance), sampleColor, chromaGain)
            );
            sampleColor *= radiance
              * brightness
              * mix(1.0, 1.14, warmth)
              * (
                0.012
                + luminousCloud * 0.84
                + emissionDensity * 2.2
                + youngStars * 0.96
                + warmth * warmth * 0.34
                + nucleusGlow * 1.08
                + compactNucleus * 1.42
                + nebula * 0.82
                + sparkle * 1.24
                + microStar * 1.05
              );
            float stellarEmission =
              youngStars * 1.1 + nebula * 0.62 + sparkle * 1.5 + microStar * 1.1;
            float emissiveOpticalDensity =
              (emissionDensity + stellarEmission * 0.42 + compactNucleus * 0.42) * absorption;
            float dustOpticalDensity = dustDensity * dustAbsorption * mix(1.0, 1.22, dustShadow);
            float opticalDensity = emissiveOpticalDensity + dustOpticalDensity;
            float emissiveShare = emissiveOpticalDensity / max(opticalDensity, 0.001);
            opticalDensity *= mix(0.82, 1.18, detailNoise);
            float sampleAlpha = 1.0 - exp(-opticalDensity * rayStep);

            float inclinationCompensation = mix(1.0, 0.86, faceOnFactor);

            sampleAlpha *= volumeOpacity * inclinationCompensation;
            vec3 sourceColor = sampleColor * mix(0.006, 1.0, emissiveShare);
            accumulated.rgb += (1.0 - accumulated.a) * sourceColor * sampleAlpha;
            accumulated.a += (1.0 - accumulated.a) * sampleAlpha;
          }
          distanceAlongRay += rayStep;
        }

        if (accumulated.a <= 0.002) {
          discard;
        }
        fragmentColor = vec4(accumulated.rgb / max(accumulated.a, 0.001), accumulated.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
}

function normalizedCoordinate(index: number, size: number): number {
  return (index / (size - 1)) * 2 - 1;
}

function fractalNoise2d(x: number, z: number, seed: number): number {
  return (
    valueNoise2d(x, z, seed) * 0.57 +
    valueNoise2d(x * 2.03 + 7.7, z * 2.03 - 3.1, seed + 31) * 0.29 +
    valueNoise2d(x * 4.11 - 5.4, z * 4.11 + 11.8, seed + 67) * 0.14
  );
}

function valueNoise2d(x: number, z: number, seed: number): number {
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  const localX = x - cellX;
  const localZ = z - cellZ;
  const blendX = localX * localX * (3 - 2 * localX);
  const blendZ = localZ * localZ * (3 - 2 * localZ);
  const lower = THREE.MathUtils.lerp(
    hashVoxel(cellX, seed, cellZ),
    hashVoxel(cellX + 1, seed, cellZ),
    blendX,
  );
  const upper = THREE.MathUtils.lerp(
    hashVoxel(cellX, seed, cellZ + 1),
    hashVoxel(cellX + 1, seed, cellZ + 1),
    blendX,
  );

  return THREE.MathUtils.lerp(lower, upper, blendZ);
}

function hashVoxel(x: number, y: number, z: number): number {
  let value =
    Math.imul(x + 1, 73_856_093) ^ Math.imul(y + 1, 19_349_663) ^ Math.imul(z + 1, 83_492_791);

  value ^= value >>> 13;
  value = Math.imul(value, 1_274_126_177);
  value ^= value >>> 16;

  return (value >>> 0) / 4_294_967_295;
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
