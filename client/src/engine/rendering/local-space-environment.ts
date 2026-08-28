import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import { MILKY_WAY_NAVIGATION_DISTANCE } from '../camera/navigation-scales';
import { dampValue } from '../lod/screen-space-lod';
import {
  applyLocalSpaceVisualProfile,
  configureLocalPanoramaTexture,
  createLocalSpaceEnvironmentVisual,
  LOCAL_MILKY_WAY_PANORAMA_URL,
  LOCAL_MILKY_WAY_SOURCE_PAGE_URL,
  type LocalSpaceCinematicProfile,
  type LocalSpaceEnvironmentVisual,
} from './local-space-environment-visual';
import { prewarmTexture, type TexturePrewarmTarget } from './texture-prewarm-target';

export { LOCAL_MILKY_WAY_PANORAMA_URL, LOCAL_MILKY_WAY_SOURCE_PAGE_URL };
export type { LocalSpaceCinematicProfile };

export type LocalMilkyWayPanoramaStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type LocalMilkyWayPanoramaLoader = (url: string) => Promise<THREE.Texture>;

export interface LocalSpaceEnvironmentSample {
  galacticBandOpacity: number;
  zodiacalLightOpacity: number;
  solarCoronaOpacity: number;
  solarCoronaDiameter: number;
}

const MAXIMUM_DISTANCE = MILKY_WAY_NAVIGATION_DISTANCE;
const LOCAL_APPEARANCE_START = 120;
const LOCAL_APPEARANCE_END = 420;
const GALACTIC_BAND_PLANETARY_OPACITY = 0.4;
const GALACTIC_BAND_STELLAR_OPACITY = 0.5;
// The camera-centred panorama is used only by the Earth-observer presentation. Its distance curve
// is kept separate from the navigable galactocentric volume so map navigation never overlays a
// photographic sky sphere on the same branch being crossed by the camera.
const GALACTIC_BAND_INTERIOR_FADE_START = 650;
const GALACTIC_BAND_INTERIOR_FADE_END = 1_150;
const GALACTIC_BAND_OBSERVER_FADE_START = 1_400;
const GALACTIC_BAND_OBSERVER_FADE_END = 3_600;
const GALACTIC_BAND_PANORAMA_BLEND_START = 600;
const GALACTIC_BAND_PANORAMA_BLEND_END = 900;
const GALACTIC_BAND_DAMPING_RATE = 4.4;
const LOCAL_OBSERVER_FADE_START = 1_400;
const LOCAL_OBSERVER_FADE_END = 2_600;
const ZODIACAL_LIGHT_OPACITY = 0.24;
const ZODIACAL_FADE_START = 850;
const ZODIACAL_FADE_END = 2_600;
const SOLAR_CORONA_OPACITY = 0.82;
const SOLAR_CORONA_FADE_START = 900;
const SOLAR_CORONA_FADE_END = 3_200;
const SOLAR_CORONA_MINIMUM_DIAMETER = 32;
const SOLAR_CORONA_MAXIMUM_DIAMETER = 96;
const SOLAR_CORONA_DIAMETER_FACTOR = 0.085;
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

/**
 * Wider observer envelope used only by the integrated Galactic band in Earth-observer mode.
 * The panorama remains illustrative away from the Solar position. Solar-system-only layers
 * continue to use the stricter local observer envelope.
 */
export function getLocalGalacticBandObserverOpacity(observerDistance: number): number {
  return (
    1 -
    smoothstep(
      GALACTIC_BAND_OBSERVER_FADE_START,
      GALACTIC_BAND_OBSERVER_FADE_END,
      normalizeDistance(observerDistance),
    )
  );
}

export function calculateLocalMilkyWayInteriorReveal(cameraDistance: number): number {
  const distance = Math.max(GALACTIC_BAND_INTERIOR_FADE_START, normalizeDistance(cameraDistance));
  const exteriorProgress = smoothstep(
    Math.log(GALACTIC_BAND_INTERIOR_FADE_START),
    Math.log(GALACTIC_BAND_INTERIOR_FADE_END),
    Math.log(distance),
  );

  return 1 - exteriorProgress;
}

/**
 * Crossfades the procedural component of the Earth-observer sky to the observed ESO panorama.
 * Normal 3D map navigation does not render either component of this camera-centred sphere.
 */
export function calculateLocalMilkyWayPanoramaBlend(cameraDistance: number): number {
  const distance = Math.max(GALACTIC_BAND_PANORAMA_BLEND_START, normalizeDistance(cameraDistance));
  const proceduralProgress = smoothstep(
    Math.log(GALACTIC_BAND_PANORAMA_BLEND_START),
    Math.log(GALACTIC_BAND_PANORAMA_BLEND_END),
    Math.log(distance),
  );

  return 1 - proceduralProgress;
}

export function sampleLocalSpaceEnvironment(
  cameraDistance: number,
  target: LocalSpaceEnvironmentSample,
  observerDistance = 0,
  earthObserverActive = false,
): LocalSpaceEnvironmentSample {
  const distance = normalizeDistance(cameraDistance);
  const appearance = smoothstep(LOCAL_APPEARANCE_START, LOCAL_APPEARANCE_END, distance);

  if (distance >= MAXIMUM_DISTANCE) {
    return resetSample(target);
  }
  const stellarBlend = smoothstep(90, 1_400, distance);
  const galacticInteriorReveal = calculateLocalMilkyWayInteriorReveal(distance);
  const zodiacalFade = 1 - smoothstep(ZODIACAL_FADE_START, ZODIACAL_FADE_END, distance);
  const coronaFade = 1 - smoothstep(SOLAR_CORONA_FADE_START, SOLAR_CORONA_FADE_END, distance);
  const observerOpacity = getLocalSpaceObserverOpacity(observerDistance);
  const galacticBandObserverOpacity = getLocalGalacticBandObserverOpacity(observerDistance);

  // In the navigable 3D map the galactocentric density volume now remains present through the
  // local branch, so a camera-centred photograph would reintroduce the very reference-frame cut
  // this journey is designed to remove. The observed panorama is reserved for Earth observation,
  // where a distant celestial sphere is the physically meaningful presentation.
  target.galacticBandOpacity = earthObserverActive
    ? THREE.MathUtils.lerp(
        GALACTIC_BAND_PLANETARY_OPACITY,
        GALACTIC_BAND_STELLAR_OPACITY,
        stellarBlend,
      ) *
      galacticInteriorReveal *
      galacticBandObserverOpacity
    : 0;
  target.zodiacalLightOpacity = earthObserverActive
    ? 0
    : appearance * ZODIACAL_LIGHT_OPACITY * zodiacalFade * observerOpacity;
  target.solarCoronaOpacity = earthObserverActive
    ? 0
    : appearance * SOLAR_CORONA_OPACITY * coronaFade * observerOpacity;
  target.solarCoronaDiameter = earthObserverActive
    ? 0
    : THREE.MathUtils.clamp(
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
  private readonly visual: LocalSpaceEnvironmentVisual;
  private readonly galacticBandGeometry: THREE.SphereGeometry;
  private readonly galacticBandMaterial: THREE.ShaderMaterial;
  private readonly galacticBand: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly zodiacalGeometry: THREE.CircleGeometry;
  private readonly zodiacalMaterial: THREE.ShaderMaterial;
  private readonly zodiacalLight: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private readonly coronaTexture: THREE.DataTexture;
  private readonly coronaMaterial: THREE.SpriteMaterial;
  private readonly solarCorona: THREE.Sprite;
  private quality: GraphicQuality = 'medium';
  private galacticBandOpacity = 0;
  private zodiacalLightOpacity = 0;
  private solarCoronaOpacity = 0;
  private solarCoronaDiameter = 0;
  private panorama: THREE.Texture | null = null;
  private panoramaPromise: Promise<boolean> | null = null;
  private panoramaLoadStatus: LocalMilkyWayPanoramaStatus = 'idle';
  private readonly observerWorldPosition = new THREE.Vector3();
  private elapsedSeconds = 0;
  private disposed = false;

  constructor(private readonly loadPanorama: LocalMilkyWayPanoramaLoader = loadLocalPanorama) {
    this.visual = createLocalSpaceEnvironmentVisual(getLocalSpaceCinematicProfile(this.quality));
    this.galacticBandGeometry = this.visual.galacticBandGeometry;
    this.galacticBandMaterial = this.visual.galacticBandMaterial;
    this.galacticBand = this.visual.galacticBand;
    this.zodiacalGeometry = this.visual.zodiacalGeometry;
    this.zodiacalMaterial = this.visual.zodiacalMaterial;
    this.zodiacalLight = this.visual.zodiacalLight;
    this.coronaTexture = this.visual.coronaTexture;
    this.coronaMaterial = this.visual.coronaMaterial;
    this.solarCorona = this.visual.solarCorona;
    this.root.name = 'illustrative-local-space-environment';
    this.root.visible = false;
    this.root.userData['scientificConfidence'] = 'illustrative';
    this.root.userData['visualRole'] = 'local-space-cinematic-environment';
    this.root.userData['drawMeshCount'] = 0;
    this.root.userData['observerDistance'] = 0;
    this.root.userData['observerLocalityOpacity'] = 1;
    this.root.userData['galacticBandTransitionDistanceRange'] = [
      GALACTIC_BAND_INTERIOR_FADE_START,
      GALACTIC_BAND_INTERIOR_FADE_END,
    ];
    this.root.userData['galacticBandTransitionCurve'] = 'log-distance-smoothstep';
    this.root.userData['galacticBandObserverDistanceRange'] = [
      GALACTIC_BAND_OBSERVER_FADE_START,
      GALACTIC_BAND_OBSERVER_FADE_END,
    ];
    this.root.userData['galacticBandPanoramaBlendDistanceRange'] = [
      GALACTIC_BAND_PANORAMA_BLEND_START,
      GALACTIC_BAND_PANORAMA_BLEND_END,
    ];
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

  public async prewarmPanorama(target: TexturePrewarmTarget): Promise<boolean> {
    if (!(await this.ensurePanorama())) {
      return false;
    }

    return prewarmTexture(target, this.panorama!);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const profile = getLocalSpaceCinematicProfile(quality);

    if (this.panorama) {
      this.panorama.anisotropy = PANORAMA_ANISOTROPY[quality];
      this.panorama.needsUpdate = true;
    }
    applyLocalSpaceVisualProfile(this.visual, profile);
    this.root.userData['cinematicQuality'] = quality;
    this.root.userData['cinematicProfile'] = { ...profile };
  }

  public update(
    cameraDistance: number,
    deltaSeconds: number,
    starRadiance = 1,
    observerDistance = 0,
    earthObserverActive = false,
    observerPosition?: Vector3Like,
  ): void {
    this.synchronizeGalacticBandWithObserver(observerPosition);
    sampleLocalSpaceEnvironment(cameraDistance, this.target, observerDistance, earthObserverActive);
    this.root.userData['observerDistance'] = normalizeDistance(observerDistance);
    this.root.userData['observerLocalityOpacity'] = getLocalSpaceObserverOpacity(observerDistance);
    const panoramaBlend = calculateLocalMilkyWayPanoramaBlend(cameraDistance);

    this.galacticBandMaterial.uniforms['panoramaBlend']!.value = panoramaBlend;
    this.root.userData['galacticBandPanoramaBlend'] = panoramaBlend;
    if (deltaSeconds <= 0) {
      return;
    }
    const radiance = THREE.MathUtils.clamp(starRadiance, 0.5, 1.5);
    const profile = getLocalSpaceCinematicProfile(this.quality);

    this.elapsedSeconds += deltaSeconds;
    this.galacticBandOpacity = dampValue(
      this.galacticBandOpacity,
      this.target.galacticBandOpacity,
      GALACTIC_BAND_DAMPING_RATE,
      deltaSeconds,
    );
    this.zodiacalLightOpacity = earthObserverActive
      ? 0
      : dampValue(this.zodiacalLightOpacity, this.target.zodiacalLightOpacity, 5.2, deltaSeconds);
    this.solarCoronaOpacity = earthObserverActive
      ? 0
      : dampValue(this.solarCoronaOpacity, this.target.solarCoronaOpacity, 6, deltaSeconds);
    this.solarCoronaDiameter = earthObserverActive
      ? 0
      : dampValue(this.solarCoronaDiameter, this.target.solarCoronaDiameter, 5, deltaSeconds);
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

  private synchronizeGalacticBandWithObserver(observerPosition?: Vector3Like): void {
    if (!observerPosition) {
      return;
    }
    this.observerWorldPosition.set(observerPosition.x, observerPosition.y, observerPosition.z);
    this.galacticBand.position.copy(this.root.worldToLocal(this.observerWorldPosition));
  }

  private installPanorama(texture: THREE.Texture): boolean {
    if (this.disposed) {
      texture.dispose();
      this.panoramaLoadStatus = 'failed';

      return false;
    }

    this.panorama = texture;
    configureLocalPanoramaTexture(texture, THREE.RepeatWrapping, PANORAMA_ANISOTROPY[this.quality]);
    this.galacticBandMaterial.uniforms['panorama']!.value = texture;
    this.galacticBandMaterial.uniforms['panoramaReady']!.value = 1;
    this.panoramaLoadStatus = 'ready';

    return true;
  }
}

function loadLocalPanorama(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url);
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
  if (!Number.isFinite(cameraDistance)) {
    return MAXIMUM_DISTANCE;
  }

  return cameraDistance;
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
