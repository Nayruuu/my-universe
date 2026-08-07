import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';

export const LOCAL_MILKY_WAY_PANORAMA_URL = '/textures/milky-way-eso-band-8k-v3.webp';
export const LOCAL_MILKY_WAY_SOURCE_PAGE_URL = 'https://www.eso.org/public/images/eso0932a/';

export type LocalMilkyWayPanoramaStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type LocalMilkyWayPanoramaLoader = (url: string) => Promise<THREE.Texture>;

export interface LocalSpaceEnvironmentSample {
  galacticBandOpacity: number;
  zodiacalLightOpacity: number;
  solarCoronaOpacity: number;
  solarCoronaDiameter: number;
}

export interface LocalSpaceCinematicProfile {
  readonly galacticDetail: number;
  readonly zodiacalGrain: number;
  readonly coronaRayStrength: number;
}

const MAXIMUM_DISTANCE = 9_600;
const LOCAL_APPEARANCE_START = 120;
const LOCAL_APPEARANCE_END = 420;
const GALACTIC_BAND_PLANETARY_OPACITY = 0.4;
const GALACTIC_BAND_STELLAR_OPACITY = 0.5;
const GALACTIC_BAND_PANORAMA_EXPOSURE = 1.18;
const GALACTIC_BAND_PRESENTATION_PITCH_DEGREES = -32;
const GALACTIC_BAND_PRESENTATION_ROLL_DEGREES = -6.5;
const GALACTIC_BAND_FADE_START = 2_800;
const GALACTIC_BAND_FADE_END = 7_200;
const LOCAL_OBSERVER_FADE_START = 2_400;
const LOCAL_OBSERVER_FADE_END = 7_200;
const ZODIACAL_LIGHT_OPACITY = 0.24;
const ZODIACAL_FADE_START = 850;
const ZODIACAL_FADE_END = 2_600;
const SOLAR_CORONA_OPACITY = 0.82;
const SOLAR_CORONA_FADE_START = 900;
const SOLAR_CORONA_FADE_END = 3_200;
const SOLAR_CORONA_MINIMUM_DIAMETER = 32;
const SOLAR_CORONA_MAXIMUM_DIAMETER = 96;
const SOLAR_CORONA_DIAMETER_FACTOR = 0.085;
const GALACTIC_SKY_RADIUS = 64_000;
const ZODIACAL_LIGHT_RADIUS = 480;
const SOLAR_CORONA_TEXTURE_SIZE = 192;
const PANORAMA_ANISOTROPY = {
  low: 1,
  medium: 2,
  high: 4,
} as const satisfies Record<GraphicQuality, number>;

const CINEMATIC_PROFILES = {
  low: {
    galacticDetail: 0.55,
    zodiacalGrain: 0.42,
    coronaRayStrength: 0.32,
  },
  medium: {
    galacticDetail: 0.78,
    zodiacalGrain: 0.7,
    coronaRayStrength: 0.56,
  },
  high: {
    galacticDetail: 1,
    zodiacalGrain: 1,
    coronaRayStrength: 0.82,
  },
} as const satisfies Record<GraphicQuality, LocalSpaceCinematicProfile>;

export function getLocalSpaceCinematicProfile(quality: GraphicQuality): LocalSpaceCinematicProfile {
  return CINEMATIC_PROFILES[quality];
}

export function createLocalSpaceEnvironmentSample(): LocalSpaceEnvironmentSample {
  return {
    galacticBandOpacity: 0,
    zodiacalLightOpacity: 0,
    solarCoronaOpacity: 0,
    solarCoronaDiameter: 0,
  };
}

export function getLocalSpaceObserverOpacity(observerDistance: number): number {
  return (
    1 -
    smoothstep(
      LOCAL_OBSERVER_FADE_START,
      LOCAL_OBSERVER_FADE_END,
      normalizeDistance(observerDistance),
    )
  );
}

export function sampleLocalSpaceEnvironment(
  cameraDistance: number,
  target: LocalSpaceEnvironmentSample,
  observerDistance = 0,
): LocalSpaceEnvironmentSample {
  const distance = normalizeDistance(cameraDistance);
  const appearance = smoothstep(LOCAL_APPEARANCE_START, LOCAL_APPEARANCE_END, distance);

  if (distance >= MAXIMUM_DISTANCE) {
    return resetSample(target);
  }
  const stellarBlend = smoothstep(90, 1_400, distance);
  const galacticFade = 1 - smoothstep(GALACTIC_BAND_FADE_START, GALACTIC_BAND_FADE_END, distance);
  const zodiacalFade = 1 - smoothstep(ZODIACAL_FADE_START, ZODIACAL_FADE_END, distance);
  const coronaFade = 1 - smoothstep(SOLAR_CORONA_FADE_START, SOLAR_CORONA_FADE_END, distance);
  const observerOpacity = getLocalSpaceObserverOpacity(observerDistance);

  target.galacticBandOpacity =
    THREE.MathUtils.lerp(
      GALACTIC_BAND_PLANETARY_OPACITY,
      GALACTIC_BAND_STELLAR_OPACITY,
      stellarBlend,
    ) *
    galacticFade *
    observerOpacity;
  target.zodiacalLightOpacity =
    appearance * ZODIACAL_LIGHT_OPACITY * zodiacalFade * observerOpacity;
  target.solarCoronaOpacity = appearance * SOLAR_CORONA_OPACITY * coronaFade * observerOpacity;
  target.solarCoronaDiameter =
    THREE.MathUtils.clamp(
      distance * SOLAR_CORONA_DIAMETER_FACTOR,
      SOLAR_CORONA_MINIMUM_DIAMETER,
      SOLAR_CORONA_MAXIMUM_DIAMETER,
    ) *
    appearance *
    Math.sqrt(coronaFade) *
    observerOpacity;

  return target;
}

export class LocalSpaceEnvironment {
  public readonly root = new THREE.Group();
  public readonly maximumDrawMeshCount = 3;

  private readonly target = createLocalSpaceEnvironmentSample();
  private readonly galacticBandGeometry = new THREE.SphereGeometry(GALACTIC_SKY_RADIUS, 64, 32);
  private readonly galacticBandMaterial = createGalacticBandMaterial();
  private readonly galacticBand = new THREE.Mesh(
    this.galacticBandGeometry,
    this.galacticBandMaterial,
  );
  private readonly zodiacalGeometry = new THREE.CircleGeometry(1, 96);
  private readonly zodiacalMaterial = createZodiacalLightMaterial();
  private readonly zodiacalLight = new THREE.Mesh(this.zodiacalGeometry, this.zodiacalMaterial);
  private readonly coronaTexture = createSolarCoronaTexture();
  private readonly coronaMaterial = createSolarCoronaMaterial(this.coronaTexture);
  private readonly solarCorona = new THREE.Sprite(this.coronaMaterial);
  private quality: GraphicQuality = 'medium';
  private galacticBandOpacity = 0;
  private zodiacalLightOpacity = 0;
  private solarCoronaOpacity = 0;
  private solarCoronaDiameter = 0;
  private panorama: THREE.Texture | null = null;
  private panoramaPromise: Promise<boolean> | null = null;
  private panoramaLoadStatus: LocalMilkyWayPanoramaStatus = 'idle';
  private elapsedSeconds = 0;
  private disposed = false;

  constructor(private readonly loadPanorama: LocalMilkyWayPanoramaLoader = loadLocalPanorama) {
    this.root.name = 'illustrative-local-space-environment';
    this.root.visible = false;
    this.root.userData['scientificConfidence'] = 'illustrative';
    this.root.userData['visualRole'] = 'local-space-cinematic-environment';
    this.root.userData['drawMeshCount'] = 0;
    this.root.userData['observerDistance'] = 0;
    this.root.userData['observerLocalityOpacity'] = 1;

    this.configureGalacticBand();
    this.configureZodiacalLight();
    this.configureSolarCorona();
    this.root.add(this.galacticBand, this.zodiacalLight, this.solarCorona);
    this.setQuality(this.quality);
  }

  public get drawMeshCount(): number {
    if (!this.root.visible) {
      return 0;
    }

    return this.root.children.filter((child) => child.visible).length;
  }

  public get panoramaStatus(): LocalMilkyWayPanoramaStatus {
    return this.panoramaLoadStatus;
  }

  public async ensurePanorama(): Promise<boolean> {
    if (this.disposed || this.panoramaLoadStatus === 'failed') {
      return false;
    }
    if (this.panoramaLoadStatus === 'ready') {
      return true;
    }
    if (this.panoramaPromise) {
      return this.panoramaPromise;
    }

    this.panoramaLoadStatus = 'loading';
    this.panoramaPromise = this.loadPanorama(LOCAL_MILKY_WAY_PANORAMA_URL)
      .then((texture) => this.installPanorama(texture))
      .catch(() => {
        this.panoramaLoadStatus = 'failed';

        return false;
      });

    return this.panoramaPromise;
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const profile = getLocalSpaceCinematicProfile(quality);

    if (this.panorama) {
      this.panorama.anisotropy = PANORAMA_ANISOTROPY[quality];
      this.panorama.needsUpdate = true;
    }
    this.galacticBandMaterial.uniforms['detailStrength']!.value = profile.galacticDetail;
    this.zodiacalMaterial.uniforms['grainStrength']!.value = profile.zodiacalGrain;
    this.coronaMaterial.color.setRGB(
      1,
      0.82 + profile.coronaRayStrength * 0.14,
      0.66 + profile.coronaRayStrength * 0.26,
    );
    this.root.userData['cinematicQuality'] = quality;
    this.root.userData['cinematicProfile'] = { ...profile };
  }

  public update(
    cameraDistance: number,
    deltaSeconds: number,
    starRadiance = 1,
    observerDistance = 0,
  ): void {
    sampleLocalSpaceEnvironment(cameraDistance, this.target, observerDistance);
    this.root.userData['observerDistance'] = normalizeDistance(observerDistance);
    this.root.userData['observerLocalityOpacity'] = getLocalSpaceObserverOpacity(observerDistance);
    if (deltaSeconds <= 0) {
      return;
    }
    const radiance = THREE.MathUtils.clamp(starRadiance, 0.5, 1.5);
    const profile = getLocalSpaceCinematicProfile(this.quality);

    this.elapsedSeconds += deltaSeconds;
    this.galacticBandOpacity = dampValue(
      this.galacticBandOpacity,
      this.target.galacticBandOpacity,
      4.8,
      deltaSeconds,
    );
    this.zodiacalLightOpacity = dampValue(
      this.zodiacalLightOpacity,
      this.target.zodiacalLightOpacity,
      5.2,
      deltaSeconds,
    );
    this.solarCoronaOpacity = dampValue(
      this.solarCoronaOpacity,
      this.target.solarCoronaOpacity,
      6,
      deltaSeconds,
    );
    this.solarCoronaDiameter = dampValue(
      this.solarCoronaDiameter,
      this.target.solarCoronaDiameter,
      5,
      deltaSeconds,
    );
    this.applyAppearance(radiance, profile.coronaRayStrength);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.galacticBandGeometry.dispose();
    this.galacticBandMaterial.dispose();
    this.zodiacalGeometry.dispose();
    this.zodiacalMaterial.dispose();
    this.coronaTexture.dispose();
    this.coronaMaterial.dispose();
    this.panorama?.dispose();
    this.panorama = null;
    this.root.clear();
  }

  private configureGalacticBand(): void {
    this.galacticBand.name = 'illustrative-local-milky-way-sky';
    this.galacticBand.visible = false;
    this.galacticBand.frustumCulled = false;
    this.galacticBand.renderOrder = -9_000;
    this.galacticBand.rotation.x = THREE.MathUtils.degToRad(
      GALACTIC_BAND_PRESENTATION_PITCH_DEGREES,
    );
    this.galacticBand.rotation.z = THREE.MathUtils.degToRad(
      GALACTIC_BAND_PRESENTATION_ROLL_DEGREES,
    );
    this.galacticBand.userData['scientificConfidence'] = 'illustrative';
    this.galacticBand.userData['physicalPhenomenon'] = 'integrated-milky-way-light-and-dust';
    this.galacticBand.userData['referenceFrame'] = 'galactic-heliocentric';
    this.galacticBand.userData['panoramaUrl'] = LOCAL_MILKY_WAY_PANORAMA_URL;
    this.galacticBand.userData['galacticCenterDirection'] = [-1, 0, 0];
    this.galacticBand.userData['visualStyle'] = 'inside-milky-way-panoramic-band';
    this.galacticBand.userData['angularPresentation'] = 'distant-thin-sky-band';
    this.galacticBand.userData['sourceCredit'] = 'ESO/S. Brunier';
    this.galacticBand.userData['sourceImageId'] = 'ESO-ESO0932A';
    this.galacticBand.userData['sourcePageUrl'] = LOCAL_MILKY_WAY_SOURCE_PAGE_URL;
    this.galacticBand.userData['sourcePixelDimensions'] = [6_000, 3_000];
    this.galacticBand.userData['texturePixelDimensions'] = [8_192, 1_024];
    this.galacticBand.userData['sourceAngularLatitudeSpanDegrees'] = 60;
    this.galacticBand.userData['angularLatitudeSpanDegrees'] = 32;
    this.galacticBand.userData['latitudePresentationScale'] = 32 / 60;
    this.galacticBand.userData['visibilityTreatment'] = 'photographic-continuous-light';
    this.galacticBand.userData['displayGrade'] = 'eso-photographic-v3';
    this.galacticBand.userData['sourceProjection'] = 'full-sky-panorama-galactic-plane-horizontal';
    this.galacticBand.userData['presentationPitchDegrees'] =
      GALACTIC_BAND_PRESENTATION_PITCH_DEGREES;
    this.galacticBand.userData['presentationRollDegrees'] = GALACTIC_BAND_PRESENTATION_ROLL_DEGREES;
    this.galacticBand.userData['presentationComposition'] = 'diagonal-cinematic-sky';
    this.galacticBand.userData['orientationConfidence'] = 'illustrative';
    this.galacticBand.userData['photographicSourceConfidence'] = 'observed';
    this.galacticBand.userData['visualLayers'] = [
      'integrated-starlight',
      'central-bulge',
      'dust-rifts',
      'star-forming-clouds',
    ];
  }

  private configureZodiacalLight(): void {
    this.zodiacalLight.name = 'illustrative-zodiacal-light';
    this.zodiacalLight.visible = false;
    this.zodiacalLight.rotation.x = -Math.PI / 2;
    this.zodiacalLight.scale.setScalar(ZODIACAL_LIGHT_RADIUS);
    this.zodiacalLight.renderOrder = 0;
    this.zodiacalLight.userData['scientificConfidence'] = 'illustrative';
    this.zodiacalLight.userData['physicalPhenomenon'] = 'zodiacal-dust-scattering';
    this.zodiacalLight.userData['referencePlane'] = 'ecliptic-approximation';
  }

  private configureSolarCorona(): void {
    this.solarCorona.name = 'illustrative-solar-corona';
    this.solarCorona.visible = false;
    this.solarCorona.renderOrder = 3;
    this.solarCorona.userData['scientificConfidence'] = 'illustrative';
    this.solarCorona.userData['physicalPhenomenon'] = 'solar-corona-and-diffraction';
  }

  private applyAppearance(radiance: number, coronaRayStrength: number): void {
    this.galacticBandMaterial.uniforms['opacity']!.value = this.galacticBandOpacity * radiance;
    this.galacticBandMaterial.uniforms['radiance']!.value = radiance;
    this.zodiacalMaterial.uniforms['opacity']!.value = this.zodiacalLightOpacity * radiance;
    this.zodiacalMaterial.uniforms['radiance']!.value = radiance;
    this.coronaMaterial.opacity = Math.min(
      1,
      this.solarCoronaOpacity * radiance * (0.78 + coronaRayStrength * 0.22),
    );
    this.coronaMaterial.rotation = this.elapsedSeconds * 0.012;
    this.solarCorona.scale.setScalar(this.solarCoronaDiameter);
    this.galacticBand.visible = this.galacticBandOpacity > 0.004;
    this.zodiacalLight.visible = this.zodiacalLightOpacity > 0.004;
    this.solarCorona.visible = this.solarCoronaOpacity > 0.004 && this.solarCoronaDiameter > 0.004;
    this.root.visible =
      this.galacticBand.visible || this.zodiacalLight.visible || this.solarCorona.visible;
    this.root.userData['drawMeshCount'] = this.drawMeshCount;
  }

  private installPanorama(texture: THREE.Texture): boolean {
    if (this.disposed) {
      texture.dispose();
      this.panoramaLoadStatus = 'failed';

      return false;
    }

    this.panorama = texture;
    configurePanoramaTexture(texture, THREE.RepeatWrapping, this.quality);
    this.galacticBandMaterial.uniforms['panorama']!.value = texture;
    this.galacticBandMaterial.uniforms['panoramaReady']!.value = 1;
    this.panoramaLoadStatus = 'ready';

    return true;
  }
}

function createGalacticBandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      radiance: { value: 1 },
      detailStrength: { value: CINEMATIC_PROFILES.medium.galacticDetail },
      panorama: { value: null },
      panoramaReady: { value: 0 },
      panoramaExposure: { value: GALACTIC_BAND_PANORAMA_EXPOSURE },
    },
    vertexShader: `
      varying vec3 galacticDirection;

      void main() {
        galacticDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      uniform float detailStrength;
      uniform sampler2D panorama;
      uniform float panoramaReady;
      uniform float panoramaExposure;
      varying vec3 galacticDirection;

      float layeredCloud(vec2 coordinate) {
        float broad = sin(coordinate.x) * sin(coordinate.y);
        float middle = sin(coordinate.x * 2.13 + coordinate.y * 1.37);
        float fine = sin(coordinate.x * 4.71 - coordinate.y * 3.19);

        return 0.5 + 0.5 * (broad * 0.48 + middle * 0.33 + fine * 0.19);
      }

      void main() {
        vec3 direction = normalize(galacticDirection);
        float galacticLatitude = abs(direction.y);
        float longitude = atan(direction.z, -direction.x);
        float galacticCenter = pow(max(0.0, dot(direction, vec3(-1.0, 0.0, 0.0))), 3.1);
        float antiCenter = pow(max(0.0, dot(direction, vec3(1.0, 0.0, 0.0))), 2.0);
        float latitudeWarp = direction.y
          + sin(longitude * 2.0 + 0.7) * 0.018
          + sin(longitude * 5.0 - 1.2) * 0.007 * detailStrength;
        float warpedLatitude = abs(latitudeWarp);
        float broadBand = exp(-warpedLatitude * 5.6);
        float brightCore = exp(-warpedLatitude * 16.0);
        float cloud = layeredCloud(vec2(longitude * 3.6 + 1.4, latitudeWarp * 31.0));
        float starCloud = smoothstep(0.28, 0.82, cloud)
          * layeredCloud(vec2(longitude * 8.1 - 2.0, latitudeWarp * 67.0));
        float dustLane = exp(-abs(latitudeWarp + sin(longitude * 3.0) * 0.006) * 48.0);
        float dustRift = dustLane
          * smoothstep(0.32, 0.8, layeredCloud(vec2(longitude * 6.7, latitudeWarp * 82.0 + 3.0)));
        float centerBulge = galacticCenter * exp(-warpedLatitude * 8.5);
        float emission = broadBand * (0.17 + starCloud * 0.18 * detailStrength)
          + brightCore * (0.1 + centerBulge * 0.62 + antiCenter * 0.05);

        emission *= 1.0 - dustRift * (0.58 + detailStrength * 0.26);
        vec3 coolColor = vec3(0.2, 0.38, 0.67);
        vec3 neutralColor = vec3(0.58, 0.68, 0.82);
        vec3 warmColor = vec3(1.0, 0.55, 0.28);
        vec3 proceduralColor = mix(coolColor, neutralColor, starCloud * 0.68);
        proceduralColor = mix(proceduralColor, warmColor, centerBulge * 0.82);
        proceduralColor += vec3(0.13, 0.3, 0.38) * starCloud * brightCore * detailStrength;
        float proceduralAlpha = clamp(emission * opacity * 1.65, 0.0, 0.72);
        float latitudeAngle = asin(clamp(direction.y, -1.0, 1.0));
        float bandLatitudeWindow = 1.0 - smoothstep(0.26179938780, 0.27925268032, abs(latitudeAngle));
        vec2 panoramaUv = vec2(
          fract(0.5 - longitude / 6.28318530718),
          clamp(0.5 + latitudeAngle / 0.55850536064, 0.001, 0.999)
        );
        vec2 atlasUv = panoramaUv;
        vec3 panoramaColor = texture2D(panorama, atlasUv).rgb;
        float panoramaLuminance = dot(panoramaColor, vec3(0.2126, 0.7152, 0.0722));
        float panoramaSignal = smoothstep(0.006, 0.22, panoramaLuminance);
        float photographicCoverage = smoothstep(0.0025, 0.12, panoramaLuminance);
        float panoramaAlpha = opacity
          * clamp(photographicCoverage * 0.88 + panoramaSignal * 0.18, 0.0, 0.96)
          * bandLatitudeWindow;

        panoramaColor = pow(max(panoramaColor, vec3(0.0)), vec3(0.94));
        vec3 panoramaGray = vec3(dot(panoramaColor, vec3(0.2126, 0.7152, 0.0722)));
        panoramaColor = max(mix(panoramaGray, panoramaColor, 1.32), vec3(0.0));
        panoramaColor *= mix(1.0, panoramaExposure, panoramaSignal);
        vec3 color = mix(proceduralColor, panoramaColor, panoramaReady);
        float alpha = mix(proceduralAlpha, panoramaAlpha, panoramaReady);

        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * radiance * (0.88 + emission * 0.32), alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
}

function createZodiacalLightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      radiance: { value: 1 },
      grainStrength: { value: CINEMATIC_PROFILES.medium.zodiacalGrain },
    },
    vertexShader: `
      varying vec2 localPosition;

      void main() {
        localPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      uniform float grainStrength;
      varying vec2 localPosition;

      void main() {
        float radius = length(localPosition);
        if (radius > 1.0) {
          discard;
        }
        float angle = atan(localPosition.y, localPosition.x);
        float radialFade = pow(max(0.0, 1.0 - radius), 2.45);
        float innerGlow = exp(-radius * 7.5);
        float grain = 0.72 + 0.28 * sin(angle * 19.0 + radius * 54.0);
        grain = mix(1.0, grain, grainStrength);
        float alpha = (radialFade * 0.42 + innerGlow * 0.58) * grain * opacity;
        vec3 color = mix(vec3(0.36, 0.2, 0.1), vec3(1.0, 0.64, 0.28), innerGlow);

        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * radiance, alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSolarCoronaMaterial(texture: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    color: 0xffe1a8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSolarCoronaTexture(): THREE.DataTexture {
  const size = SOLAR_CORONA_TEXTURE_SIZE;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      writeCoronaPixel(pixels, size, x, y);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);

  texture.name = 'procedural-solar-corona';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData['scientificConfidence'] = 'illustrative';
  texture.userData['visualLayers'] = ['warmCore', 'softHalo', 'coronaRays'];

  return texture;
}

function loadLocalPanorama(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url);
}

function configurePanoramaTexture(
  texture: THREE.Texture,
  wrapS: THREE.Wrapping,
  quality: GraphicQuality,
): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = wrapS;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.anisotropy = PANORAMA_ANISOTROPY[quality];
  texture.needsUpdate = true;
}

function writeCoronaPixel(pixels: Uint8Array, size: number, x: number, y: number): void {
  const normalizedX = ((x + 0.5) / size) * 2 - 1;
  const normalizedY = ((y + 0.5) / size) * 2 - 1;
  const radius = Math.hypot(normalizedX, normalizedY);
  const angle = Math.atan2(normalizedY, normalizedX);
  const core = Math.max(0, 1 - radius / 0.2);
  const halo = Math.max(0, 1 - radius);
  const primaryRays = Math.pow(Math.max(0, Math.cos(angle * 6)), 12);
  const secondaryRays = Math.pow(Math.max(0, Math.cos(angle * 11 + 0.7)), 18);
  const rayEnvelope = Math.max(0, 1 - radius) * smoothstep(0.12, 0.74, radius);
  const alpha = THREE.MathUtils.clamp(
    Math.pow(halo, 2.35) * 0.72 +
      core * 0.9 +
      (primaryRays * 0.2 + secondaryRays * 0.1) * rayEnvelope,
    0,
    1,
  );
  const offset = (y * size + x) * 4;

  pixels[offset] = 255;
  pixels[offset + 1] = Math.round(225 + core * 30);
  pixels[offset + 2] = Math.round(165 + core * 80);
  pixels[offset + 3] = Math.round(alpha * 255);
}

function resetSample(target: LocalSpaceEnvironmentSample): LocalSpaceEnvironmentSample {
  target.galacticBandOpacity = 0;
  target.zodiacalLightOpacity = 0;
  target.solarCoronaOpacity = 0;
  target.solarCoronaDiameter = 0;

  return target;
}

function normalizeDistance(cameraDistance: number): number {
  if (Number.isNaN(cameraDistance) || cameraDistance <= 0) {
    return 0;
  }
  if (!Number.isFinite(cameraDistance) || cameraDistance >= MAXIMUM_DISTANCE) {
    return MAXIMUM_DISTANCE;
  }

  return cameraDistance;
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
