import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { blackHoleLensingCaptureSize } from './black-hole-lensing-model';

export interface BlackHoleLensingComposition {
  readonly centerX: number;
  readonly centerY: number;
  readonly coreRadius: number;
  readonly einsteinRadius: number;
  readonly influenceRadius: number;
  readonly foregroundScale: number;
  readonly strength: number;
}

export interface BlackHoleLensingDisplayState {
  readonly coreRadius: number;
  readonly influenceRadius: number;
  readonly foregroundScale: number;
  readonly renderWidth: number;
  readonly renderHeight: number;
}

const LOCAL_LENS_RADIUS = 0.46;
const MINIMUM_INFLUENCE_TO_CORE_RATIO = 3;
const BLACK_HOLE_FOREGROUND_LAYER = 2;
const STRENGTH_RESPONSE_START = 0.05;
const STRENGTH_RESPONSE_END = 0.85;

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

export class BlackHoleLensingCompositor {
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
  private framebufferWidth = 1;
  private framebufferHeight = 1;
  private renderWidth = 1;
  private renderHeight = 1;

  constructor() {
    this.mesh.name = 'black-hole-lensing-screen-pass';
    this.mesh.frustumCulled = false;
    this.mesh.userData['scientificConfidence'] = 'illustrative';
    this.mesh.userData['visualStyle'] = 'screen-space-einstein-ring-lensing';
    this.mesh.userData['distortionModel'] = 'thin-lens-einstein-ring';
    this.postScene.add(this.mesh);
  }

  public get renderSize(): Readonly<{ width: number; height: number }> {
    return { width: this.renderWidth, height: this.renderHeight };
  }

  public setSize(width: number, height: number, pixelRatio: number, quality: GraphicQuality): void {
    this.framebufferWidth = Math.max(1, Math.round(width * pixelRatio));
    this.framebufferHeight = Math.max(1, Math.round(height * pixelRatio));
    const captureSize = blackHoleLensingCaptureSize(quality);
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

  public renderOverlay(
    renderer: THREE.WebGLRenderer,
    composition: BlackHoleLensingComposition,
  ): BlackHoleLensingDisplayState {
    const copyX = THREE.MathUtils.clamp(
      Math.round(composition.centerX * this.framebufferWidth - this.renderWidth * 0.5),
      0,
      this.framebufferWidth - this.renderWidth,
    );
    const copyY = THREE.MathUtils.clamp(
      Math.round(composition.centerY * this.framebufferHeight - this.renderHeight * 0.5),
      0,
      this.framebufferHeight - this.renderHeight,
    );
    const localCenterX = (composition.centerX * this.framebufferWidth - copyX) / this.renderWidth;
    const localCenterY = (composition.centerY * this.framebufferHeight - copyY) / this.renderHeight;
    const displayInfluenceRadius = composition.influenceRadius;
    const displayCoreRadius = Math.min(
      composition.coreRadius,
      displayInfluenceRadius / MINIMUM_INFLUENCE_TO_CORE_RATIO,
    );
    const displayForegroundScale =
      composition.foregroundScale * (displayCoreRadius / composition.coreRadius);
    const localScale = LOCAL_LENS_RADIUS / displayInfluenceRadius;
    const localCoreRadius = displayCoreRadius * localScale;
    const localEinsteinRadius = composition.einsteinRadius * localScale;
    const textureAspect = this.renderWidth / this.renderHeight;
    const framebufferAspect = this.framebufferWidth / this.framebufferHeight;
    const quadScaleY = displayInfluenceRadius / LOCAL_LENS_RADIUS;
    const quadScaleX = (quadScaleY * textureAspect) / framebufferAspect;
    const quadCenterX = composition.centerX * 2 - 1 - (localCenterX * 2 - 1) * quadScaleX;
    const quadCenterY = composition.centerY * 2 - 1 - (localCenterY * 2 - 1) * quadScaleY;

    this.copyPosition.set(copyX, copyY);
    this.material.uniforms['lensStrength']!.value = composition.strength;
    (this.material.uniforms['lensCenter']!.value as THREE.Vector2).set(localCenterX, localCenterY);
    this.material.uniforms['coreRadius']!.value = localCoreRadius;
    this.material.uniforms['einsteinRadius']!.value = localEinsteinRadius;
    this.material.uniforms['influenceRadius']!.value = LOCAL_LENS_RADIUS;
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

    return {
      coreRadius: displayCoreRadius,
      influenceRadius: displayInfluenceRadius,
      foregroundScale: displayForegroundScale,
      renderWidth: this.renderWidth,
      renderHeight: this.renderHeight,
    };
  }

  public renderForeground(
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

  public dispose(): void {
    this.postScene.clear();
    this.framebufferTexture.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createFramebufferTexture(width: number, height: number): THREE.FramebufferTexture {
  const texture = new THREE.FramebufferTexture(width, height);

  texture.name = 'black-hole-lensing-scene-region';
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}
