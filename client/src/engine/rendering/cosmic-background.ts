import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { NAVIGATION_SCALES } from '../camera/navigation-scales';

export interface CosmicBackgroundSample {
  upperColor: THREE.Color;
  lowerColor: THREE.Color;
  hazeColor: THREE.Color;
  accentColor: THREE.Color;
  fogColor: THREE.Color;
  hazeStrength: number;
  nebulaStrength: number;
  dustStrength: number;
  vignetteStrength: number;
}

interface CosmicBackgroundStop extends CosmicBackgroundSample {
  readonly distance: number;
}

const BACKGROUND_STOPS: readonly CosmicBackgroundStop[] = [
  createStop(0, 0x01030a, 0x020817, 0x0b2440, 0x142846, 0x020713, 0.025, 0.008, 0.015, 0.18),
  createStop(1, 0x02050e, 0x06101d, 0x102a45, 0x18375d, 0x030916, 0.042, 0.014, 0.02, 0.2),
  createStop(2, 0x030714, 0x081323, 0x153354, 0x244c78, 0x040b1a, 0.07, 0.026, 0.03, 0.22),
  createStop(3, 0x050817, 0x0a1023, 0x24264c, 0x4a376d, 0x060b1a, 0.105, 0.05, 0.055, 0.25),
  createStop(4, 0x060715, 0x0b0d1d, 0x261d48, 0x58325f, 0x070914, 0.075, 0.06, 0.07, 0.27),
  createStop(5, 0x050713, 0x0c0b1b, 0x221942, 0x3d2b64, 0x060713, 0.06, 0.05, 0.06, 0.29),
  createStop(6, 0x03050f, 0x090718, 0x171b3e, 0x21385d, 0x040611, 0.05, 0.042, 0.045, 0.31),
];

const QUALITY_DETAIL_STRENGTH: Readonly<Record<GraphicQuality, number>> = {
  low: 0.58,
  medium: 0.82,
  high: 1,
};
const BACKGROUND_DAMPING = 3.2;

export class CosmicBackground {
  public readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly current = sampleCosmicBackground(
    BACKGROUND_STOPS[0]!.distance,
    createCosmicBackgroundSample(),
  );
  private readonly target = createCosmicBackgroundSample();
  private readonly material: THREE.ShaderMaterial;
  private currentDetailStrength = QUALITY_DETAIL_STRENGTH.medium;
  private targetDetailStrength = QUALITY_DETAIL_STRENGTH.medium;

  constructor() {
    const geometry = createFullscreenGeometry();

    this.material = createCosmicBackgroundMaterial(this.current, this.currentDetailStrength);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'scale-aware-cosmic-background';
    this.mesh.renderOrder = -10_000;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.userData['scientificConfidence'] = 'illustrative';
    this.mesh.userData['visualRole'] = 'continuous-cosmic-map-foundation';
    this.mesh.userData['transitionDriver'] = 'continuous-camera-distance';
  }

  public get fogColor(): THREE.Color {
    return this.current.fogColor;
  }

  public get fallbackColor(): THREE.Color {
    return this.current.upperColor;
  }

  public setQuality(quality: GraphicQuality): void {
    this.targetDetailStrength = QUALITY_DETAIL_STRENGTH[quality];
  }

  public update(cameraDistance: number, deltaSeconds: number): void {
    sampleCosmicBackground(cameraDistance, this.target);
    this.mesh.userData['cameraDistance'] = cameraDistance;
    if (deltaSeconds <= 0) {
      return;
    }
    const blend = 1 - Math.exp(-BACKGROUND_DAMPING * deltaSeconds);

    this.current.upperColor.lerp(this.target.upperColor, blend);
    this.current.lowerColor.lerp(this.target.lowerColor, blend);
    this.current.hazeColor.lerp(this.target.hazeColor, blend);
    this.current.accentColor.lerp(this.target.accentColor, blend);
    this.current.fogColor.lerp(this.target.fogColor, blend);
    this.current.hazeStrength = THREE.MathUtils.lerp(
      this.current.hazeStrength,
      this.target.hazeStrength,
      blend,
    );
    this.current.vignetteStrength = THREE.MathUtils.lerp(
      this.current.vignetteStrength,
      this.target.vignetteStrength,
      blend,
    );
    this.current.nebulaStrength = THREE.MathUtils.lerp(
      this.current.nebulaStrength,
      this.target.nebulaStrength,
      blend,
    );
    this.current.dustStrength = THREE.MathUtils.lerp(
      this.current.dustStrength,
      this.target.dustStrength,
      blend,
    );
    this.currentDetailStrength = THREE.MathUtils.lerp(
      this.currentDetailStrength,
      this.targetDetailStrength,
      blend,
    );
    this.material.uniforms['hazeStrength']!.value = this.current.hazeStrength;
    this.material.uniforms['vignetteStrength']!.value = this.current.vignetteStrength;
    this.material.uniforms['nebulaStrength']!.value = this.current.nebulaStrength;
    this.material.uniforms['dustStrength']!.value = this.current.dustStrength;
    this.material.uniforms['detailStrength']!.value = this.currentDetailStrength;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export function createCosmicBackgroundSample(): CosmicBackgroundSample {
  return {
    upperColor: new THREE.Color(),
    lowerColor: new THREE.Color(),
    hazeColor: new THREE.Color(),
    accentColor: new THREE.Color(),
    fogColor: new THREE.Color(),
    hazeStrength: 0,
    nebulaStrength: 0,
    dustStrength: 0,
    vignetteStrength: 0,
  };
}

export function sampleCosmicBackground(
  cameraDistance: number,
  target: CosmicBackgroundSample,
): CosmicBackgroundSample {
  const first = BACKGROUND_STOPS[0]!;
  const last = BACKGROUND_STOPS.at(-1)!;
  const boundedDistance = normalizeDistance(cameraDistance, first.distance, last.distance);

  if (boundedDistance <= first.distance) {
    return copyStop(first, target);
  }
  if (boundedDistance >= last.distance) {
    return copyStop(last, target);
  }

  const upperIndex = BACKGROUND_STOPS.findIndex((stop) => stop.distance >= boundedDistance);
  const lower = BACKGROUND_STOPS[upperIndex - 1]!;
  const upper = BACKGROUND_STOPS[upperIndex]!;
  const logarithmicProgress =
    (Math.log(boundedDistance) - Math.log(lower.distance)) /
    (Math.log(upper.distance) - Math.log(lower.distance));
  const progress = logarithmicProgress * logarithmicProgress * (3 - 2 * logarithmicProgress);

  target.upperColor.lerpColors(lower.upperColor, upper.upperColor, progress);
  target.lowerColor.lerpColors(lower.lowerColor, upper.lowerColor, progress);
  target.hazeColor.lerpColors(lower.hazeColor, upper.hazeColor, progress);
  target.accentColor.lerpColors(lower.accentColor, upper.accentColor, progress);
  target.fogColor.lerpColors(lower.fogColor, upper.fogColor, progress);
  target.hazeStrength = THREE.MathUtils.lerp(lower.hazeStrength, upper.hazeStrength, progress);
  target.nebulaStrength = THREE.MathUtils.lerp(
    lower.nebulaStrength,
    upper.nebulaStrength,
    progress,
  );
  target.dustStrength = THREE.MathUtils.lerp(lower.dustStrength, upper.dustStrength, progress);
  target.vignetteStrength = THREE.MathUtils.lerp(
    lower.vignetteStrength,
    upper.vignetteStrength,
    progress,
  );

  return target;
}

function createStop(
  navigationScaleIndex: number,
  upperColor: number,
  lowerColor: number,
  hazeColor: number,
  accentColor: number,
  fogColor: number,
  hazeStrength: number,
  nebulaStrength: number,
  dustStrength: number,
  vignetteStrength: number,
): CosmicBackgroundStop {
  return {
    distance: NAVIGATION_SCALES[navigationScaleIndex]!.distance,
    upperColor: new THREE.Color(upperColor),
    lowerColor: new THREE.Color(lowerColor),
    hazeColor: new THREE.Color(hazeColor),
    accentColor: new THREE.Color(accentColor),
    fogColor: new THREE.Color(fogColor),
    hazeStrength,
    nebulaStrength,
    dustStrength,
    vignetteStrength,
  };
}

function normalizeDistance(cameraDistance: number, minimum: number, maximum: number): number {
  if (Number.isNaN(cameraDistance) || cameraDistance <= minimum) {
    return minimum;
  }
  if (!Number.isFinite(cameraDistance) || cameraDistance >= maximum) {
    return maximum;
  }

  return cameraDistance;
}

function copyStop(
  stop: CosmicBackgroundStop,
  target: CosmicBackgroundSample,
): CosmicBackgroundSample {
  target.upperColor.copy(stop.upperColor);
  target.lowerColor.copy(stop.lowerColor);
  target.hazeColor.copy(stop.hazeColor);
  target.accentColor.copy(stop.accentColor);
  target.fogColor.copy(stop.fogColor);
  target.hazeStrength = stop.hazeStrength;
  target.nebulaStrength = stop.nebulaStrength;
  target.dustStrength = stop.dustStrength;
  target.vignetteStrength = stop.vignetteStrength;

  return target;
}

function createFullscreenGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0],
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2),
  );

  return geometry;
}

function createCosmicBackgroundMaterial(
  sample: CosmicBackgroundSample,
  detailStrength: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      upperColor: { value: sample.upperColor },
      lowerColor: { value: sample.lowerColor },
      hazeColor: { value: sample.hazeColor },
      accentColor: { value: sample.accentColor },
      hazeStrength: { value: sample.hazeStrength },
      nebulaStrength: { value: sample.nebulaStrength },
      dustStrength: { value: sample.dustStrength },
      vignetteStrength: { value: sample.vignetteStrength },
      detailStrength: { value: detailStrength },
    },
    vertexShader: `
      varying vec2 backgroundUv;

      void main() {
        backgroundUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 upperColor;
      uniform vec3 lowerColor;
      uniform vec3 hazeColor;
      uniform vec3 accentColor;
      uniform float hazeStrength;
      uniform float nebulaStrength;
      uniform float dustStrength;
      uniform float vignetteStrength;
      uniform float detailStrength;
      varying vec2 backgroundUv;

      float backgroundHash(vec2 position) {
        return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 centered = backgroundUv * 2.0 - 1.0;
        float verticalBlend = smoothstep(0.02, 0.98, backgroundUv.y);
        vec3 color = mix(lowerColor, upperColor, verticalBlend);
        float hazeBand = exp(-pow((backgroundUv.y - 0.47) * 3.9, 2.0));
        float wisps = 0.72 + 0.28 * sin(backgroundUv.x * 11.0 + sin(backgroundUv.y * 8.0));
        float cloudA = 0.5 + 0.5 * sin(
          centered.x * 5.7 + sin(centered.y * 4.3) * 1.8
        );
        float cloudB = 0.5 + 0.5 * sin(
          (centered.x + centered.y) * 8.1 - cos(centered.x * 3.2)
        );
        float nebula = pow(clamp(cloudA * 0.68 + cloudB * 0.32, 0.0, 1.0), 2.2);
        float dustRift = hazeBand * smoothstep(0.42, 0.82, 1.0 - cloudB) * wisps;
        float vignette = smoothstep(0.28, 1.18, length(centered * vec2(0.82, 1.0)));
        float grain = backgroundHash(floor(gl_FragCoord.xy * 0.5)) - 0.5;

        color += hazeColor * hazeStrength * hazeBand * wisps * detailStrength;
        color += accentColor * nebulaStrength * nebula * hazeBand * detailStrength;
        color *= 1.0 - dustRift * dustStrength * detailStrength;
        color *= 1.0 - vignette * vignetteStrength;
        color += grain * 0.0018 * detailStrength;
        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  });
}
