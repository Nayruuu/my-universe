import * as THREE from 'three';
import { GraphicQuality, type SpaceObject } from '../../data/models/universe.models';
import { calculateApparentRadiusPixels } from '../lod/screen-space-lod';

export interface BlackHoleLensingEffect {
  readonly objectId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly coreRadius: number;
  readonly einsteinRadius: number;
  readonly influenceRadius: number;
  readonly foregroundScale: number;
  readonly strength: number;
  readonly scientificConfidence: 'illustrative';
}

export interface BlackHoleLensingDebugState {
  readonly active: boolean;
  readonly objectId: string | null;
  readonly strength: number;
  readonly coreRadius: number;
  readonly einsteinRadius: number;
  readonly distortionModel: 'thin-lens-einstein-ring';
  readonly compositionMode: 'background-lens-foreground';
  readonly backgroundPreservation: 'live-framebuffer-thin-lens';
  readonly foregroundSeparated: boolean;
  readonly foregroundScale: number;
  readonly displayCoreRadius: number;
  readonly displayInfluenceRadius: number;
  readonly scientificConfidence: 'illustrative' | null;
  readonly renderWidth: number;
  readonly renderHeight: number;
}

const MINIMUM_CORE_RADIUS_PIXELS = 12;
const MAXIMUM_CORE_RADIUS = 0.16;
const MAXIMUM_INFLUENCE_RADIUS = 0.48;
const EINSTEIN_RADIUS_SCALE = 1.68;
const MAXIMUM_EINSTEIN_INFLUENCE_RATIO = 0.72;
const LOCAL_LENS_RADIUS = 0.46;
const MINIMUM_INFLUENCE_TO_CORE_RATIO = 3;
const BLACK_HOLE_FOREGROUND_LAYER = 2;
const ACTIVE_STRENGTH_THRESHOLD = 0.001;
const LENSING_RESPONSE = 12;
const STRENGTH_RESPONSE_START = 0.05;
const STRENGTH_RESPONSE_END = 0.85;

const QUALITY_PROFILE = {
  low: { strength: 0, influenceScale: 0, captureSize: 1 },
  medium: {
    strength: 0.78,
    influenceScale: 4.2,
    captureSize: 768,
  },
  high: {
    strength: 0.96,
    influenceScale: 4.8,
    captureSize: 1_024,
  },
} as const satisfies Record<
  GraphicQuality,
  {
    strength: number;
    influenceScale: number;
    captureSize: number;
  }
>;

const VERTEX_SHADER = /* glsl */ `
  uniform vec2 quadCenter;
  uniform vec2 quadScale;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * quadScale + quadCenter, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D sceneTexture;
  uniform vec2 lensCenter;
  uniform float coreRadius;
  uniform float einsteinRadius;
  uniform float influenceRadius;
  uniform float lensStrength;
  uniform float aspectRatio;
  varying vec2 vUv;

  vec2 metricToUv(vec2 metricPosition) {
    metricPosition.x /= aspectRatio;
    return clamp(lensCenter + metricPosition, vec2(0.001), vec2(0.999));
  }

  vec3 sampleSource(vec2 metricPosition) {
    return texture2D(sceneTexture, metricToUv(metricPosition)).rgb;
  }

  void main() {
    vec2 metricDelta = vUv - lensCenter;
    metricDelta.x *= aspectRatio;
    float distanceToLens = length(metricDelta);
    if (
      lensStrength <= 0.001 ||
      distanceToLens <= coreRadius * 0.92 ||
      distanceToLens >= influenceRadius
    ) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 radialDirection = metricDelta / max(distanceToLens, 0.0001);
    vec2 tangentDirection = vec2(-radialDirection.y, radialDirection.x);
    float safeDistance = max(distanceToLens, coreRadius * 0.92);

    // Visually validated thin-lens mapping: beta = theta - theta_E^2 / theta.
    // Its sign change inside theta_E creates the inverted secondary image;
    // tangential samples turn displaced point light into circular arcs.
    float sourceOffset = safeDistance -
      (einsteinRadius * einsteinRadius) / safeDistance;
    float ringProximity = 1.0 - smoothstep(
      coreRadius * 0.025,
      coreRadius * 0.68,
      abs(sourceOffset)
    );
    float effectAmount = smoothstep(
      ${STRENGTH_RESPONSE_START.toFixed(2)},
      ${STRENGTH_RESPONSE_END.toFixed(2)},
      lensStrength
    );
    float tangentialSpread = coreRadius * 0.16 * ringProximity * effectAmount;
    vec2 sourceMetric = radialDirection * sourceOffset;
    vec3 centerImage = sampleSource(sourceMetric);
    vec3 leftImage = sampleSource(
      sourceMetric - tangentDirection * tangentialSpread
    );
    vec3 rightImage = sampleSource(
      sourceMetric + tangentDirection * tangentialSpread
    );
    vec3 lensedColor = centerImage * 0.6 + leftImage * 0.2 + rightImage * 0.2;
    vec3 arcPeak = max(centerImage, max(leftImage, rightImage));
    lensedColor = mix(lensedColor, arcPeak, ringProximity * 0.24);

    float innerMask = smoothstep(coreRadius * 0.98, coreRadius * 1.14, distanceToLens);
    float outerMask = 1.0 - smoothstep(
      influenceRadius * 0.72,
      influenceRadius,
      distanceToLens
    );
    float distortionMask = innerMask * outerMask * effectAmount;

    // The source is the current framebuffer only. Smooth alpha masks return to
    // the direct scene at both edges without restoring the former fixed image.
    gl_FragColor = vec4(lensedColor, distortionMask);
  }
`;

export function projectBlackHoleLensing(
  object: SpaceObject | undefined,
  worldPosition: THREE.Vector3 | null,
  camera: THREE.PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
  quality: GraphicQuality,
): BlackHoleLensingEffect | null {
  if (
    object?.type !== 'black-hole' ||
    worldPosition === null ||
    quality === 'low' ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return null;
  }

  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
  const cameraToObject = worldPosition.clone().sub(camera.position);

  if (cameraToObject.dot(cameraDirection) <= 0) {
    return null;
  }
  const distance = cameraToObject.length();
  const apparentRadiusPixels = calculateApparentRadiusPixels(
    object.visual.visualRadius,
    distance,
    viewportHeight,
    camera.fov,
  );

  if (apparentRadiusPixels < MINIMUM_CORE_RADIUS_PIXELS) {
    return null;
  }

  const projected = worldPosition.clone().project(camera);
  const profile = QUALITY_PROFILE[quality];
  const apparentCoreRadius = apparentRadiusPixels / viewportHeight;
  const coreRadius = Math.min(apparentCoreRadius, MAXIMUM_CORE_RADIUS);
  const influenceRadius = Math.min(
    (apparentRadiusPixels * profile.influenceScale) / viewportHeight,
    MAXIMUM_INFLUENCE_RADIUS,
  );
  const einsteinRadius = Math.min(
    coreRadius * EINSTEIN_RADIUS_SCALE,
    influenceRadius * MAXIMUM_EINSTEIN_INFLUENCE_RATIO,
  );
  const centerX = (projected.x + 1) * 0.5;
  const centerY = (projected.y + 1) * 0.5;

  if (
    projected.z < -1 ||
    projected.z > 1 ||
    centerX < -influenceRadius ||
    centerX > 1 + influenceRadius ||
    centerY < -influenceRadius ||
    centerY > 1 + influenceRadius
  ) {
    return null;
  }

  return {
    objectId: object.id,
    centerX,
    centerY,
    coreRadius,
    einsteinRadius,
    influenceRadius,
    foregroundScale: Math.min(1, coreRadius / apparentCoreRadius),
    strength: profile.strength,
    scientificConfidence: 'illustrative',
  };
}

export function dampLensingStrength(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-LENSING_RESPONSE * deltaSeconds));
}

export function calculateThinLensSourceRadius(
  distanceToLens: number,
  coreRadius: number,
  einsteinRadius: number,
): number {
  const safeDistance = Math.max(distanceToLens, coreRadius * 0.92);

  return safeDistance - (einsteinRadius * einsteinRadius) / Math.max(safeDistance, 0.0001);
}

export function calculateFullColorLensingColor(
  originalColor: readonly [number, number, number],
  lensedColor: readonly [number, number, number],
  distortionMask: number,
): [number, number, number] {
  const mask = THREE.MathUtils.clamp(distortionMask, 0, 1);

  return originalColor.map((channel, index) => {
    return THREE.MathUtils.clamp(THREE.MathUtils.lerp(channel, lensedColor[index]!, mask), 0, 1);
  }) as [number, number, number];
}

export class BlackHoleLensingPass {
  private framebufferTexture = createFramebufferTexture(1, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      sceneTexture: { value: this.framebufferTexture },
      lensCenter: { value: new THREE.Vector2(0.5, 0.5) },
      coreRadius: { value: 0.08 },
      einsteinRadius: { value: 0.14 },
      influenceRadius: { value: 0.32 },
      lensStrength: { value: 0 },
      aspectRatio: { value: 1 },
      quadCenter: { value: new THREE.Vector2() },
      quadScale: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh = new THREE.Mesh(this.geometry, this.material);
  private readonly copyPosition = new THREE.Vector2();
  private currentStrength = 0;
  private objectId: string | null = null;
  private centerX = 0.5;
  private centerY = 0.5;
  private coreRadius = 0.08;
  private einsteinRadius = 0.14;
  private influenceRadius = 0.32;
  private foregroundScale = 1;
  private displayCoreRadius = 0.08;
  private displayInfluenceRadius = 0.32;
  private displayForegroundScale = 1;
  private framebufferWidth = 1;
  private framebufferHeight = 1;
  private renderWidth = 1;
  private renderHeight = 1;
  private foregroundRoot: THREE.Object3D | null = null;
  private foregroundSeparated = false;

  constructor() {
    this.mesh.name = 'black-hole-lensing-screen-pass';
    this.mesh.frustumCulled = false;
    this.mesh.userData['scientificConfidence'] = 'illustrative';
    this.mesh.userData['visualStyle'] = 'screen-space-einstein-ring-lensing';
    this.mesh.userData['distortionModel'] = 'thin-lens-einstein-ring';
    this.postScene.add(this.mesh);
  }

  public get debugState(): BlackHoleLensingDebugState {
    const active = this.currentStrength > ACTIVE_STRENGTH_THRESHOLD;

    return {
      active,
      objectId: active ? this.objectId : null,
      strength: this.currentStrength,
      coreRadius: this.coreRadius,
      einsteinRadius: this.einsteinRadius,
      distortionModel: 'thin-lens-einstein-ring',
      compositionMode: 'background-lens-foreground',
      backgroundPreservation: 'live-framebuffer-thin-lens',
      foregroundSeparated: active && this.foregroundSeparated,
      foregroundScale: active ? this.displayForegroundScale : 1,
      displayCoreRadius: active ? this.displayCoreRadius : 0,
      displayInfluenceRadius: active ? this.displayInfluenceRadius : 0,
      scientificConfidence: active ? 'illustrative' : null,
      renderWidth: this.renderWidth,
      renderHeight: this.renderHeight,
    };
  }

  public setSize(width: number, height: number, pixelRatio: number, quality: GraphicQuality): void {
    this.framebufferWidth = Math.max(1, Math.round(width * pixelRatio));
    this.framebufferHeight = Math.max(1, Math.round(height * pixelRatio));
    const captureSize = QUALITY_PROFILE[quality].captureSize;
    const nextWidth = Math.min(captureSize, this.framebufferWidth);
    const nextHeight = Math.min(captureSize, this.framebufferHeight);

    if (nextWidth === this.renderWidth && nextHeight === this.renderHeight) {
      return;
    }
    this.framebufferTexture.dispose();
    this.framebufferTexture = createFramebufferTexture(nextWidth, nextHeight);
    this.material.uniforms['sceneTexture']!.value = this.framebufferTexture;
    this.renderWidth = nextWidth;
    this.renderHeight = nextHeight;
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    effect: BlackHoleLensingEffect | null,
    foregroundRoot: THREE.Object3D | null,
    deltaSeconds: number,
  ): void {
    if (effect) {
      this.objectId = effect.objectId;
      this.centerX = effect.centerX;
      this.centerY = effect.centerY;
      this.coreRadius = effect.coreRadius;
      this.einsteinRadius = effect.einsteinRadius;
      this.influenceRadius = effect.influenceRadius;
      this.foregroundScale = effect.foregroundScale;
      this.foregroundRoot = foregroundRoot;
    }
    this.currentStrength = dampLensingStrength(
      this.currentStrength,
      effect?.strength ?? 0,
      deltaSeconds,
    );
    this.material.uniforms['lensStrength']!.value = this.currentStrength;

    if (this.currentStrength <= ACTIVE_STRENGTH_THRESHOLD) {
      this.objectId = null;
      this.foregroundRoot = null;
      this.foregroundSeparated = false;
      renderer.render(scene, camera);

      return;
    }

    const separatedForeground = this.foregroundRoot?.visible === true ? this.foregroundRoot : null;

    this.foregroundSeparated = separatedForeground !== null;
    if (separatedForeground) {
      separatedForeground.visible = false;
    }
    try {
      renderer.render(scene, camera);
      this.renderLensingOverlay(renderer);
      if (separatedForeground) {
        separatedForeground.visible = true;
        this.renderForeground(
          renderer,
          scene,
          camera,
          separatedForeground,
          this.displayForegroundScale,
        );
      }
    } finally {
      if (separatedForeground) {
        separatedForeground.visible = true;
      }
    }
  }

  public dispose(): void {
    this.postScene.clear();
    this.framebufferTexture.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private renderLensingOverlay(renderer: THREE.WebGLRenderer): void {
    const copyX = THREE.MathUtils.clamp(
      Math.round(this.centerX * this.framebufferWidth - this.renderWidth * 0.5),
      0,
      this.framebufferWidth - this.renderWidth,
    );
    const copyY = THREE.MathUtils.clamp(
      Math.round(this.centerY * this.framebufferHeight - this.renderHeight * 0.5),
      0,
      this.framebufferHeight - this.renderHeight,
    );
    const localCenterX = (this.centerX * this.framebufferWidth - copyX) / this.renderWidth;
    const localCenterY = (this.centerY * this.framebufferHeight - copyY) / this.renderHeight;

    this.displayInfluenceRadius = this.influenceRadius;
    this.displayCoreRadius = Math.min(
      this.coreRadius,
      this.displayInfluenceRadius / MINIMUM_INFLUENCE_TO_CORE_RATIO,
    );
    this.displayForegroundScale = this.foregroundScale * (this.displayCoreRadius / this.coreRadius);
    const displayEinsteinRadius = Math.min(
      this.einsteinRadius,
      this.displayInfluenceRadius * MAXIMUM_EINSTEIN_INFLUENCE_RATIO,
    );
    const localScale = LOCAL_LENS_RADIUS / this.displayInfluenceRadius;
    const localInfluenceRadius = LOCAL_LENS_RADIUS;
    const localCoreRadius = this.displayCoreRadius * localScale;
    const localEinsteinRadius = displayEinsteinRadius * localScale;
    const textureAspect = this.renderWidth / this.renderHeight;
    const framebufferAspect = this.framebufferWidth / this.framebufferHeight;
    const quadScaleY = this.displayInfluenceRadius / LOCAL_LENS_RADIUS;
    const quadScaleX = (quadScaleY * textureAspect) / framebufferAspect;
    const quadCenterX = this.centerX * 2 - 1 - (localCenterX * 2 - 1) * quadScaleX;
    const quadCenterY = this.centerY * 2 - 1 - (localCenterY * 2 - 1) * quadScaleY;

    this.copyPosition.set(copyX, copyY);
    (this.material.uniforms['lensCenter']!.value as THREE.Vector2).set(localCenterX, localCenterY);
    this.material.uniforms['coreRadius']!.value = localCoreRadius;
    this.material.uniforms['einsteinRadius']!.value = localEinsteinRadius;
    this.material.uniforms['influenceRadius']!.value = localInfluenceRadius;
    this.material.uniforms['aspectRatio']!.value = textureAspect;
    (this.material.uniforms['quadCenter']!.value as THREE.Vector2).set(quadCenterX, quadCenterY);
    (this.material.uniforms['quadScale']!.value as THREE.Vector2).set(quadScaleX, quadScaleY);
    renderer.copyFramebufferToTexture(this.framebufferTexture, this.copyPosition);

    const autoReset = renderer.info.autoReset;
    const autoClear = renderer.autoClear;

    if (autoReset) {
      renderer.info.autoReset = false;
    }
    renderer.autoClear = false;
    try {
      renderer.render(this.postScene, this.postCamera);
    } finally {
      renderer.autoClear = autoClear;
      renderer.info.autoReset = autoReset;
    }
  }

  private renderForeground(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    foregroundRoot: THREE.Object3D,
    foregroundScale: number,
  ): void {
    const originalCameraMask = camera.layers.mask;
    const originalAutoReset = renderer.info.autoReset;
    const originalAutoClear = renderer.autoClear;
    const originalBackground = scene.background;
    const originalForegroundScale = foregroundRoot.scale.clone();
    const layerMasks: Array<{ object: THREE.Object3D; mask: number }> = [];

    try {
      foregroundRoot.scale.multiplyScalar(foregroundScale);
      foregroundRoot.traverse((object) => {
        if ((object.layers.mask & originalCameraMask) === 0) {
          return;
        }
        layerMasks.push({ object, mask: object.layers.mask });
        object.layers.set(BLACK_HOLE_FOREGROUND_LAYER);
      });
      camera.layers.set(BLACK_HOLE_FOREGROUND_LAYER);
      renderer.autoClear = false;
      scene.background = null;
      if (originalAutoReset) {
        renderer.info.autoReset = false;
      }
      renderer.render(scene, camera);
    } finally {
      for (const { object, mask } of layerMasks) {
        object.layers.mask = mask;
      }
      camera.layers.mask = originalCameraMask;
      renderer.autoClear = originalAutoClear;
      renderer.info.autoReset = originalAutoReset;
      scene.background = originalBackground;
      foregroundRoot.scale.copy(originalForegroundScale);
    }
  }
}

function createFramebufferTexture(width: number, height: number): THREE.FramebufferTexture {
  const texture = new THREE.FramebufferTexture(width, height);

  texture.name = 'black-hole-lensing-scene-region';
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}
