import * as THREE from 'three';
import type {
  CometActivityDefinition,
  GraphicQuality,
  SpaceObject,
} from '../../data/models/universe.models';
import { calculateCometActivity } from '../simulation/comet-activity';
import { manageMaterial, type ManagedLodMaterial } from './celestial-visual-types';

const LOCAL_TAIL_AXIS = new THREE.Vector3(0, 1, 0);
const MINIMUM_VISIBLE_ACTIVITY = 0.002;

interface CometVisualProfile {
  readonly radialSegments: number;
  readonly comaRadius: number;
  readonly dustTailLength: number;
  readonly dustTailWidth: number;
  readonly ionTailLength: number;
  readonly ionTailWidth: number;
}

const PROFILES: Readonly<Record<GraphicQuality, CometVisualProfile>> = {
  low: {
    radialSegments: 8,
    comaRadius: 4.4,
    dustTailLength: 40,
    dustTailWidth: 2.8,
    ionTailLength: 52,
    ionTailWidth: 1.25,
  },
  medium: {
    radialSegments: 12,
    comaRadius: 5.2,
    dustTailLength: 58,
    dustTailWidth: 3.4,
    ionTailLength: 76,
    ionTailWidth: 1.45,
  },
  high: {
    radialSegments: 18,
    comaRadius: 6,
    dustTailLength: 72,
    dustTailWidth: 4,
    ionTailLength: 96,
    ionTailWidth: 1.65,
  },
};

export class CometActivityVisual {
  public readonly root = new THREE.Group();
  private readonly direction = new THREE.Vector3();

  constructor(
    private readonly definition: CometActivityDefinition,
    private readonly coma: THREE.Sprite,
    private readonly dustTail: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>,
    private readonly ionTail: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>,
    private readonly visualRadius: number,
    private readonly comaRadius: number,
  ) {
    this.root.add(coma, dustTail, ionTail);
    this.root.visible = false;
  }

  public updateAppearance(
    heliocentricPosition: THREE.Vector3,
    heliocentricDistanceAu: number,
  ): void {
    const appearance = calculateCometActivity(heliocentricDistanceAu, this.definition);
    const directionDefined = heliocentricPosition.lengthSq() > 0;

    this.root.visible = appearance.intensity > MINIMUM_VISIBLE_ACTIVITY && directionDefined;
    setAppearanceOpacity(this.coma.material, appearance.intensity);
    setAppearanceOpacity(this.dustTail.material, appearance.tailScale * 0.82);
    setAppearanceOpacity(this.ionTail.material, appearance.tailScale * 0.68);
    this.coma.scale.setScalar(
      this.visualRadius * this.comaRadius * (0.45 + appearance.comaScale * 0.55),
    );
    this.dustTail.scale.set(
      Math.sqrt(appearance.tailScale),
      appearance.tailScale,
      Math.sqrt(appearance.tailScale),
    );
    this.ionTail.scale.set(
      Math.sqrt(appearance.tailScale),
      appearance.tailScale,
      Math.sqrt(appearance.tailScale),
    );

    if (directionDefined) {
      this.direction.copy(heliocentricPosition).normalize();
      this.root.quaternion.setFromUnitVectors(LOCAL_TAIL_AXIS, this.direction);
    }
  }
}

export function createCometActivityVisual(
  object: SpaceObject,
  quality: GraphicQuality,
  glowTexture: THREE.Texture,
  nearMaterials: ManagedLodMaterial[],
): CometActivityVisual {
  if (!object.cometActivity) {
    throw new Error(`Activité cométaire absente pour ${object.id}.`);
  }
  const profile = PROFILES[quality];
  const comaMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: object.visual.emissiveColor ?? '#b8eee7',
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    opacity: 0.62,
    transparent: true,
  });
  const coma = new THREE.Sprite(comaMaterial);
  const dustMaterial = createTailMaterial('#f3d4a2', 'dust', 0.42);
  const ionMaterial = createTailMaterial('#75d9ed', 'ion', 0.38);
  const dustTail = createTail(
    object.id,
    'dust',
    object.visual.visualRadius * profile.dustTailLength,
    object.visual.visualRadius * profile.dustTailWidth,
    profile.radialSegments,
    dustMaterial,
  );
  const ionTail = createTail(
    object.id,
    'ion',
    object.visual.visualRadius * profile.ionTailLength,
    object.visual.visualRadius * profile.ionTailWidth,
    profile.radialSegments,
    ionMaterial,
  );

  coma.name = `${object.id}-coma`;
  coma.material.userData['scientificConfidence'] = 'illustrative';
  coma.material.userData['visualStyle'] = 'distance-driven-comet-coma';
  dustTail.rotation.z = THREE.MathUtils.degToRad(object.id.length % 2 === 0 ? 7 : -7);
  nearMaterials.push(
    manageMaterial(comaMaterial),
    manageMaterial(dustMaterial),
    manageMaterial(ionMaterial),
  );

  const visual = new CometActivityVisual(
    object.cometActivity,
    coma,
    dustTail,
    ionTail,
    object.visual.visualRadius,
    profile.comaRadius,
  );

  visual.root.name = `${object.id}-activity`;

  return visual;
}

function createTail(
  objectId: string,
  kind: 'dust' | 'ion',
  length: number,
  width: number,
  radialSegments: number,
  material: THREE.ShaderMaterial,
): THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.ConeGeometry(width, length, radialSegments, 1, true);

  geometry.rotateX(Math.PI);
  geometry.translate(0, length / 2, 0);
  geometry.userData['directionModel'] = 'anti-solar';
  const tail = new THREE.Mesh(geometry, material);

  tail.name = `${objectId}-${kind}-tail`;
  tail.renderOrder = 1;

  return tail;
}

function createTailMaterial(
  color: THREE.ColorRepresentation,
  kind: 'dust' | 'ion',
  opacity: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      layerOpacity: { value: opacity },
    },
    vertexShader: `
      varying float vTailProgress;
      void main() {
        vTailProgress = 1.0 - uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float layerOpacity;
      varying float vTailProgress;
      void main() {
        float headFade = smoothstep(0.0, 0.035, vTailProgress);
        float endFade = 1.0 - smoothstep(0.12, 1.0, vTailProgress);
        gl_FragColor = vec4(color, layerOpacity * headFade * endFade);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });

  material.userData['scientificConfidence'] = 'illustrative';
  material.userData['visualStyle'] = 'distance-driven-comet-tail';
  material.userData['tailKind'] = kind;

  return material;
}

function setAppearanceOpacity(material: THREE.Material, opacity: number): void {
  material.userData['appearanceOpacity'] = opacity;
}
