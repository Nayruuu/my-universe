import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { dampValue } from '../lod/screen-space-lod';

export interface CosmicWebVolumeProfile {
  readonly stepCount: number;
  readonly emptySpaceLeap: number;
  readonly densityThreshold: number;
  readonly maximumOpacity: number;
  readonly absorption: number;
  readonly noiseStrength: number;
}

const VOLUME_PROFILES = {
  low: {
    stepCount: 16,
    emptySpaceLeap: 2.8,
    densityThreshold: 0.11,
    maximumOpacity: 0.13,
    absorption: 6,
    noiseStrength: 0.08,
  },
  medium: {
    stepCount: 26,
    emptySpaceLeap: 2.1,
    densityThreshold: 0.075,
    maximumOpacity: 0.18,
    absorption: 7.2,
    noiseStrength: 0.12,
  },
  high: {
    stepCount: 40,
    emptySpaceLeap: 1.6,
    densityThreshold: 0.045,
    maximumOpacity: 0.24,
    absorption: 8.5,
    noiseStrength: 0.16,
  },
} as const satisfies Record<GraphicQuality, CosmicWebVolumeProfile>;

const VOLUME_FADE_START_DISTANCE = 140_000;
const VOLUME_FULL_OPACITY_DISTANCE = 320_000;
const VOLUME_OPACITY_DAMPING = 4;

export function getCosmicWebVolumeProfile(quality: GraphicQuality): CosmicWebVolumeProfile {
  return VOLUME_PROFILES[quality];
}

export function getCosmicWebVolumeTargetOpacity(
  cameraDistance: number,
  profile: CosmicWebVolumeProfile,
): number {
  const progress = THREE.MathUtils.clamp(
    (cameraDistance - VOLUME_FADE_START_DISTANCE) /
      (VOLUME_FULL_OPACITY_DISTANCE - VOLUME_FADE_START_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return profile.maximumOpacity * easedProgress;
}

export class CosmicWebVolumeRenderer {
  public readonly material: THREE.ShaderMaterial;
  public readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;

  private readonly texture: THREE.Data3DTexture;
  private quality: GraphicQuality;
  private enabled = true;
  private opacity = 0;

  constructor(
    volume: CosmicWebVolume,
    coordinateSystem: CoordinateSystem,
    quality: GraphicQuality = 'medium',
  ) {
    this.quality = quality;
    this.texture = createDensityTexture(volume);
    this.material = createVolumeMaterial(this.texture, getCosmicWebVolumeProfile(quality));
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.material);
    const halfExtentSceneUnits = coordinateSystem.toSceneDistance(
      volume.halfExtentMpc,
      'megaparsec',
      'cosmic-web',
    );

    this.mesh.name = 'simulated-cosmic-web-volume';
    this.mesh.scale.setScalar(halfExtentSceneUnits);
    this.mesh.visible = false;
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.userData['scientificConfidence'] = 'simulated';
    this.mesh.userData['visualRole'] = 'catalogue-aligned-simulated-cellular-density';
    this.mesh.userData['source'] =
      'Cosmicflows-4 groups, derived proximity scaffold, and simulated cellular continuity';
    this.mesh.userData['sourceGroupCount'] = volume.sourceGroupCount;
    this.mesh.userData['sourceEdgeCount'] = volume.sourceEdgeCount;
    this.mesh.userData['volumeResolution'] = volume.resolution;
    this.mesh.userData['halfExtentMpc'] = volume.halfExtentMpc;
    this.mesh.userData['visualPalette'] = 'density-driven-cyan-violet-amber';
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const profile = getCosmicWebVolumeProfile(quality);

    this.material.uniforms['stepCount']!.value = profile.stepCount;
    this.material.uniforms['emptySpaceLeap']!.value = profile.emptySpaceLeap;
    this.material.uniforms['densityThreshold']!.value = profile.densityThreshold;
    this.material.uniforms['absorption']!.value = profile.absorption;
    this.material.uniforms['noiseStrength']!.value = profile.noiseStrength;
    this.mesh.userData['quality'] = quality;
    this.mesh.userData['rayMarchSteps'] = profile.stepCount;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.mesh.visible = enabled && this.opacity > 0.004;
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number, radiance = 1): void {
    const targetOpacity = getCosmicWebVolumeTargetOpacity(
      cameraDistance,
      getCosmicWebVolumeProfile(this.quality),
    );

    this.opacity = dampValue(this.opacity, targetOpacity, VOLUME_OPACITY_DAMPING, deltaSeconds);
    this.material.uniforms['volumeOpacity']!.value = this.opacity;
    this.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    this.mesh.visible = this.enabled && this.opacity > 0.004;
  }

  public dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

function createDensityTexture(volume: CosmicWebVolume): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(
    volume.density,
    volume.resolution,
    volume.resolution,
    volume.resolution,
  );

  texture.name = 'cosmic-web-density-volume';
  texture.format = THREE.RedFormat;
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

function createVolumeMaterial(
  texture: THREE.Data3DTexture,
  profile: CosmicWebVolumeProfile,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      densityTexture: { value: texture },
      volumeOpacity: { value: 0 },
      stepCount: { value: profile.stepCount },
      emptySpaceLeap: { value: profile.emptySpaceLeap },
      densityThreshold: { value: profile.densityThreshold },
      absorption: { value: profile.absorption },
      noiseStrength: { value: profile.noiseStrength },
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
      uniform float stepCount;
      uniform float emptySpaceLeap;
      uniform float densityThreshold;
      uniform float absorption;
      uniform float noiseStrength;
      uniform float radiance;
      in vec3 volumeRayOrigin;
      in vec3 volumeRayDirection;
      out vec4 fragmentColor;
      #define gl_FragColor fragmentColor

      const int MAXIMUM_STEPS = 40;

      float volumeHash(vec2 position) {
        return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float volumeDetail(vec3 position) {
        float primary = sin(dot(position, vec3(17.1, 23.7, 13.4)));
        float secondary = sin(dot(position.zxy, vec3(31.3, 19.9, 27.7)) + primary * 0.8);

        return 0.88 + primary * 0.075 + secondary * 0.045;
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
        vec2 intersection = intersectVolumeBox(volumeRayOrigin, rayDirection);
        float rayStart = max(intersection.x, 0.0);
        float rayEnd = intersection.y;

        if (rayEnd <= rayStart) {
          discard;
        }
        float rayStep = (rayEnd - rayStart) / max(stepCount, 1.0);
        float distanceAlongRay = rayStart + rayStep * volumeHash(gl_FragCoord.xy);
        vec4 accumulated = vec4(0.0);

        for (int index = 0; index < MAXIMUM_STEPS; index += 1) {
          if (
            float(index) >= stepCount ||
            accumulated.a > 0.985 ||
            distanceAlongRay >= rayEnd
          ) {
            break;
          }
          vec3 samplePosition = volumeRayOrigin + rayDirection * distanceAlongRay;
          vec3 texturePosition = samplePosition * 0.5 + 0.5;
          float boundaryDistance = min(
            min(texturePosition.x, 1.0 - texturePosition.x),
            min(
              min(texturePosition.y, 1.0 - texturePosition.y),
              min(texturePosition.z, 1.0 - texturePosition.z)
            )
          );
          float boundaryFade = smoothstep(0.0, 0.065, boundaryDistance);
          float encodedDensity = texture(densityTexture, texturePosition).r;

          if (encodedDensity <= densityThreshold) {
            distanceAlongRay += rayStep * emptySpaceLeap;
            continue;
          }
          float density = smoothstep(densityThreshold, 1.0, encodedDensity);
          float detail = mix(1.0, volumeDetail(texturePosition), noiseStrength);

          density *= detail * boundaryFade;
          float ridgeDensity = pow(density, 1.22);
          float body = smoothstep(0.035, 0.48, ridgeDensity);
          float filamentCore = smoothstep(0.48, 0.78, ridgeDensity);
          float luminousNode = smoothstep(0.9, 0.995, ridgeDensity);
          float opticalDensity = ridgeDensity * 0.18 + filamentCore * 0.68;
          float chromaticVariation = 0.5 + 0.5 * sin(
            dot(texturePosition, vec3(13.7, 19.1, 23.3)) * 6.283 + ridgeDensity * 4.0
          );
          vec3 hazeColor = mix(
            vec3(0.012, 0.035, 0.16),
            vec3(0.025, 0.3, 0.62),
            body
          );
          vec3 coolFilamentColor = mix(
            vec3(0.08, 0.62, 1.0),
            vec3(0.57, 0.3, 0.96),
            chromaticVariation * 0.62
          );
          vec3 filamentColor = mix(hazeColor, coolFilamentColor, filamentCore);
          vec3 warmNodeColor = mix(
            vec3(1.0, 0.5, 0.22),
            vec3(1.0, 0.86, 0.54),
            chromaticVariation
          );
          vec3 sampleColor = mix(filamentColor, warmNodeColor, luminousNode * 0.82);
          float sampleAlpha = 1.0 - exp(-opticalDensity * absorption * rayStep);

          sampleAlpha *= volumeOpacity;
          sampleColor *= radiance * (0.36 + body * 0.48 + filamentCore * 0.42);
          accumulated.rgb += (1.0 - accumulated.a) * sampleColor * sampleAlpha;
          accumulated.a += (1.0 - accumulated.a) * sampleAlpha;
          distanceAlongRay += rayStep;
        }

        if (accumulated.a <= 0.002) {
          discard;
        }
        fragmentColor = accumulated;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
}
