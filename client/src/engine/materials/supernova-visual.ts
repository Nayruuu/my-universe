import * as THREE from 'three';
import { GraphicQuality, SpaceObject, UniverseTime } from '../../data/models/universe.models';
import {
  calculateSupernovaAppearance,
  SupernovaPhase,
  SupernovaTemporalProfile,
} from '../simulation/supernova-appearance';

const SHELL_DETAIL_BY_QUALITY: Readonly<Record<GraphicQuality, number>> = {
  low: 0.72,
  medium: 1,
  high: 1.28,
};

const QUALITY_RANK: Readonly<Record<GraphicQuality, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface ShellLayerDefinition {
  readonly suffix: string;
  readonly emissionLayer: 'envelope' | 'filaments' | 'knots';
  readonly scale: number;
  readonly mode: number;
  readonly opacityWeight: number;
  readonly displacement: number;
  readonly minimumQuality: GraphicQuality;
  readonly rotation: readonly [number, number, number];
}

const SHELL_LAYERS: readonly ShellLayerDefinition[] = [
  {
    suffix: 'shell',
    emissionLayer: 'envelope',
    scale: 1,
    mode: 0,
    opacityWeight: 0.58,
    displacement: 0.075,
    minimumQuality: 'low',
    rotation: [0, 0, 0],
  },
  {
    suffix: 'filaments',
    emissionLayer: 'filaments',
    scale: 0.86,
    mode: 1,
    opacityWeight: 1,
    displacement: 0.045,
    minimumQuality: 'low',
    rotation: [0.31, 0.67, 0.14],
  },
  {
    suffix: 'emission-knots',
    emissionLayer: 'knots',
    scale: 0.7,
    mode: 2,
    opacityWeight: 0.88,
    displacement: 0.028,
    minimumQuality: 'medium',
    rotation: [-0.42, 0.28, 0.51],
  },
];

export class SupernovaVisual {
  public readonly nearRoot = new THREE.Group();
  public readonly farSprite: THREE.Sprite;
  public readonly shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  public readonly shellLayers: readonly THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>[];
  public readonly flash: THREE.Sprite;
  public readonly materials: readonly THREE.Material[];
  public phase: SupernovaPhase = 'pre-event';

  private readonly profile: SupernovaTemporalProfile;
  private readonly visualRadius: number;

  constructor(
    object: SpaceObject,
    quality: GraphicQuality,
    sphereGeometry: THREE.SphereGeometry,
    glowTexture: THREE.Texture,
  ) {
    this.visualRadius = object.visual.visualRadius;
    this.profile = createTemporalProfile(object);
    this.nearRoot.name = `${object.id}-near-representation`;
    this.nearRoot.visible = false;

    const seed = visualSeed(object.id);

    this.shellLayers = SHELL_LAYERS.map((layer, index) =>
      createShellLayer(object, quality, sphereGeometry, layer, seed + index * 13.7),
    );
    this.shell = this.shellLayers[0]!;

    const flashMaterial = createFlashMaterial(
      glowTexture,
      object.visual.emissiveColor ?? '#ffffff',
    );

    this.flash = new THREE.Sprite(flashMaterial);
    this.flash.name = `${object.id}-supernova-flash`;
    this.flash.visible = false;
    this.flash.renderOrder = 6;
    this.flash.userData['scientificConfidence'] = 'illustrative';
    this.flash.userData['visualStyle'] = 'illustrative-supernova-light-curve';

    const farMaterial = createFlashMaterial(glowTexture, object.visual.color ?? '#bfe8ff');

    this.farSprite = new THREE.Sprite(farMaterial);
    this.farSprite.name = `${object.id}-supernova-impostor`;
    this.farSprite.visible = false;
    this.farSprite.renderOrder = 5;
    this.farSprite.userData['scientificConfidence'] = 'illustrative';
    this.farSprite.userData['visualStyle'] = 'temporal-supernova-impostor';
    this.farSprite.userData['appearanceOpacity'] = 0;

    this.materials = [...this.shellLayers.map((layer) => layer.material), flashMaterial];
    this.nearRoot.add(...this.shellLayers, this.flash);
  }

  public updateAppearance(time: UniverseTime): void {
    const appearance = calculateSupernovaAppearance(time, this.profile);
    const shellScale = this.visualRadius * appearance.shellScale;
    const flashScale = this.visualRadius * (3.5 + Math.sqrt(appearance.flashIntensity) * 8.5);

    this.phase = appearance.phase;
    for (let index = 0; index < this.shellLayers.length; index += 1) {
      const layer = this.shellLayers[index]!;
      const definition = SHELL_LAYERS[index]!;
      const qualityEnabled = layer.userData['qualityEnabled'] === true;

      layer.scale.setScalar(shellScale * definition.scale);
      layer.visible = qualityEnabled && appearance.shellOpacity > 0.004;
      layer.material.userData['appearanceOpacity'] = qualityEnabled
        ? appearance.shellOpacity * definition.opacityWeight
        : 0;
    }
    this.flash.scale.setScalar(flashScale);
    this.flash.visible = appearance.flashIntensity > 0.004;
    this.flash.material.userData['appearanceOpacity'] = appearance.flashIntensity;
    this.farSprite.userData['appearanceOpacity'] = Math.max(
      appearance.flashIntensity,
      appearance.shellOpacity,
    );
    this.nearRoot.userData['phase'] = appearance.phase;
  }
}

function createTemporalProfile(object: SpaceObject): SupernovaTemporalProfile {
  return {
    peakJulianDay: metadataNumber(object, 'visualPeakJulianDay', null),
    riseDays: metadataNumber(object, 'supernovaRiseDays', 0),
    decayDays: metadataNumber(object, 'supernovaDecayDays', 0),
    shellFormationDays: metadataNumber(object, 'shellFormationDays', 0),
    referenceJulianDay: metadataNumber(object, 'appearanceReferenceJulianDay', 2_451_545),
  };
}

function metadataNumber<T extends number | null>(
  object: SpaceObject,
  key: string,
  fallback: T,
): number | T {
  const value = object.metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function createShellLayer(
  object: SpaceObject,
  quality: GraphicQuality,
  geometry: THREE.SphereGeometry,
  definition: ShellLayerDefinition,
  seed: number,
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = createShellMaterial(object, quality, definition, seed);
  const layer = new THREE.Mesh(geometry, material);

  layer.name = `${object.id}-supernova-${definition.suffix}`;
  layer.visible = false;
  layer.renderOrder = 4 + definition.mode;
  layer.rotation.set(...definition.rotation);
  layer.userData['scientificConfidence'] = 'illustrative';
  layer.userData['visualStyle'] = 'procedural-volumetric-supernova-remnant';
  layer.userData['emissionLayer'] = definition.emissionLayer;
  layer.userData['quality'] = quality;
  layer.userData['qualityEnabled'] =
    QUALITY_RANK[quality] >= QUALITY_RANK[definition.minimumQuality];

  return layer;
}

function createShellMaterial(
  object: SpaceObject,
  quality: GraphicQuality,
  definition: ShellLayerDefinition,
  seed: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      primaryColor: { value: new THREE.Color(object.visual.color ?? '#79d8ff') },
      secondaryColor: { value: new THREE.Color(object.visual.secondaryColor ?? '#ff806d') },
      accentColor: { value: new THREE.Color('#62efbd') },
      hotColor: { value: new THREE.Color(object.visual.emissiveColor ?? '#fff4cf') },
      layerOpacity: { value: 0 },
      shellDetail: { value: SHELL_DETAIL_BY_QUALITY[quality] },
      shellMode: { value: definition.mode },
      shellSeed: { value: seed },
      shellDisplacement: { value: definition.displacement },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float shellSeed;
      uniform float shellDisplacement;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = normalize(position);
        float irregularity = sin(dot(position, vec3(3.7, 5.9, 4.3)) + shellSeed)
          + sin(dot(position, vec3(-7.1, 4.1, 6.7)) - shellSeed * 0.73)
          + sin(dot(position, vec3(11.3, -8.9, 5.1)) + shellSeed * 0.37);
        vec3 displacedPosition = position * (1.0 + irregularity * shellDisplacement / 3.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 primaryColor;
      uniform vec3 secondaryColor;
      uniform vec3 accentColor;
      uniform vec3 hotColor;
      uniform float layerOpacity;
      uniform float shellDetail;
      uniform float shellMode;
      uniform float shellSeed;
      varying vec3 vNormal;
      varying vec3 vPosition;

      float hash31(vec3 point) {
        point = fract(point * 0.1031);
        point += dot(point, point.yzx + 33.33);
        return fract((point.x + point.y) * point.z);
      }

      float noise3(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);

        return mix(
          mix(
            mix(hash31(cell), hash31(cell + vec3(1.0, 0.0, 0.0)), local.x),
            mix(
              hash31(cell + vec3(0.0, 1.0, 0.0)),
              hash31(cell + vec3(1.0, 1.0, 0.0)),
              local.x
            ),
            local.y
          ),
          mix(
            mix(
              hash31(cell + vec3(0.0, 0.0, 1.0)),
              hash31(cell + vec3(1.0, 0.0, 1.0)),
              local.x
            ),
            mix(
              hash31(cell + vec3(0.0, 1.0, 1.0)),
              hash31(cell + vec3(1.0, 1.0, 1.0)),
              local.x
            ),
            local.y
          ),
          local.z
        );
      }

      float fbm(vec3 point) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise3(point) * amplitude;
          point = point * 2.03 + vec3(7.1, -3.7, 5.3);
          amplitude *= 0.48;
        }
        return value;
      }

      void main() {
        vec3 point = vPosition * (2.8 + shellDetail * 1.35)
          + vec3(shellSeed * 0.17, shellSeed * -0.11, shellSeed * 0.07);
        float broadCloud = fbm(point * 0.68);
        float braidedCloud = fbm(point * 1.43 + vec3(11.3, -4.7, 8.1));
        float fineCloud = fbm(point * 2.35 + vec3(-6.7, 9.1, 3.4));
        float facing = abs(normalize(vNormal).z);
        float rim = pow(max(0.0, 1.0 - facing), 1.32);
        float brokenEnvelope = smoothstep(0.31, 0.79, broadCloud + braidedCloud * 0.2);
        float ridgedFilaments = pow(1.0 - abs(braidedCloud * 2.0 - 1.0), 6.0);
        float fineFilaments = pow(1.0 - abs(fineCloud * 2.0 - 1.0), 9.0);
        float density;
        vec3 shellColor;

        if (shellMode < 0.5) {
          density = rim * (brokenEnvelope * 0.72 + fineFilaments * 0.18)
            + ridgedFilaments * brokenEnvelope * (0.08 + rim * 0.22);
          shellColor = mix(primaryColor, secondaryColor, braidedCloud * 0.38);
        } else if (shellMode < 1.5) {
          float interior = 0.22 + pow(facing, 0.42) * 0.78;
          density = (ridgedFilaments * 0.72 + fineFilaments * 0.46)
            * brokenEnvelope * interior;
          shellColor = mix(primaryColor, accentColor, smoothstep(0.31, 0.69, broadCloud));
          shellColor = mix(shellColor, secondaryColor, smoothstep(0.46, 0.84, fineCloud) * 0.72);
          shellColor = mix(shellColor, hotColor, fineFilaments * 0.32);
        } else {
          float knots = smoothstep(0.68, 0.91, broadCloud * 0.54 + fineCloud * 0.62);
          density = knots * (fineFilaments * 0.68 + ridgedFilaments * 0.54)
            * (0.35 + facing * 0.65);
          shellColor = mix(secondaryColor, hotColor, fineFilaments * 0.82);
        }

        float alpha = density * layerOpacity;

        if (alpha < 0.012) {
          discard;
        }
        gl_FragColor = vec4(shellColor * (0.68 + density * 1.55 + rim * 0.45), alpha);
      }
    `,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  material.userData['appearanceOpacity'] = 0;
  material.userData['visualStyle'] = 'procedural-volumetric-supernova-remnant';

  return material;
}

function visualSeed(id: string): number {
  let hash = 2_166_136_261;

  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_295;
}

function createFlashMaterial(texture: THREE.Texture, color: string): THREE.SpriteMaterial {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  material.userData['appearanceOpacity'] = 0;
  material.userData['photographicGlow'] = true;

  return material;
}
