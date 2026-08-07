import * as THREE from 'three';
import {
  STELLAR_PROFILE_TINT_GLSL,
  STELLAR_SPRITE_SURFACE_GLSL,
} from '../materials/stellar-surface-shader';
import { CATALOG_STAR_VISUAL_RADIUS } from '../objects/star-catalog-registry';
import { getStarCatalogOpticalProfile } from './star-catalog-optical-profile';

export interface StarCatalogActiveDetail {
  readonly activeDetail: THREE.Group;
  readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
}

export function createStarCatalogActiveDetail(): StarCatalogActiveDetail {
  const activeDetail = new THREE.Group();
  const activeHalo = createActiveHalo();
  const activeCore = createActiveCore();

  activeDetail.name = 'active-hyg-star-detail';
  activeDetail.visible = false;
  activeDetail.userData['objectId'] = null;
  activeDetail.userData['kind'] = 'adaptive-catalog-star';
  activeDetail.add(activeHalo, activeCore);

  return { activeDetail, activeHalo, activeCore };
}

function createActiveHalo(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      pointSize: { value: 17 },
      starColor: { value: new THREE.Color(0xdce8ff) },
      coronaStrength: { value: 0.86 },
      cellScale: { value: 24 },
      surfaceContrast: { value: 0.24 },
      faculaStrength: { value: 0.46 },
      spotStrength: { value: 0.12 },
      surfaceSeed: { value: 0.5 },
      surfaceProfile: { value: 2 },
    },
    vertexShader: `
      uniform float pixelRatio;
      uniform float pointSize;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform vec3 starColor;
      uniform float coronaStrength;
      uniform float cellScale;
      uniform float surfaceContrast;
      uniform float faculaStrength;
      uniform float spotStrength;
      uniform float surfaceSeed;
      uniform float surfaceProfile;

      ${STELLAR_SPRITE_SURFACE_GLSL}

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float angle = atan(point.y, point.x);
        float angularNoise = stellarSurfaceFbm(
          vec2(cos(angle), sin(angle)) * 3.2 + surfaceSeed * 7.0 + radius * 1.7
        );
        float coronaRays = smoothstep(0.52, 0.66, radius)
          * (1.0 - smoothstep(0.72, 1.0, radius))
          * (0.24 + angularNoise * 0.76)
          * coronaStrength;
        vec4 photosphere = proceduralPhotosphere(
          point * 0.82,
          starColor,
          cellScale,
          surfaceContrast,
          coronaStrength,
          spotStrength,
          surfaceSeed,
          surfaceProfile
        );
        float faculae = smoothstep(
          0.7,
          0.92,
          stellarSurfaceFbm(point * cellScale * 0.34 + surfaceSeed * 9.1)
        ) * faculaStrength;
        vec3 finalColor = photosphere.rgb + starColor * coronaRays * 0.24;
        finalColor = mix(finalColor, vec3(1.0), faculae * photosphere.a * 0.18);
        float alpha = min(1.0, max(photosphere.a, coronaRays * 0.18));
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Points(geometry, material);

  halo.name = 'active-hyg-star-halo';
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  halo.userData['representation'] = 'halo';
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['visualStyle'] = 'procedural-spectral-photosphere-impostor';

  return halo;
}

function createActiveCore(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      starColor: { value: new THREE.Color(0xdce8ff) },
      layerOpacity: { value: 0 },
      granulationStrength: { value: getStarCatalogOpticalProfile('medium').granulationStrength },
      cellScale: { value: 24 },
      surfaceContrast: { value: 0.24 },
      faculaStrength: { value: 0.46 },
      coronaStrength: { value: 0.86 },
      spotStrength: { value: 0.12 },
      surfaceSeed: { value: 0.5 },
      surfaceProfile: { value: 2 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 starColor;
      uniform float layerOpacity;
      uniform float granulationStrength;
      uniform float cellScale;
      uniform float surfaceContrast;
      uniform float faculaStrength;
      uniform float coronaStrength;
      uniform float spotStrength;
      uniform float surfaceSeed;
      uniform float surfaceProfile;
      varying vec3 vNormal;
      varying vec3 vPosition;

      ${STELLAR_PROFILE_TINT_GLSL}

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
        float amplitude = 0.58;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise3(point) * amplitude;
          point = point * 2.07 + vec3(5.2, -3.1, 7.4);
          amplitude *= 0.46;
        }
        return value;
      }

      void main() {
        vec3 displayColor = mix(starColor, illustrativeStellarTint(surfaceProfile), 0.28);
        float viewFacing = max(0.0, vNormal.z);
        float limbDarkening = 0.34 + pow(viewFacing, 0.52) * 0.88;
        vec3 surfacePoint = normalize(vPosition);
        vec3 seedOffset = vec3(surfaceSeed * 11.3, surfaceSeed * -7.7, surfaceSeed * 17.9);
        float granulation = fbm(surfacePoint * cellScale + seedOffset);
        float fineGranulation = fbm(
          surfacePoint * cellScale * 2.35 - seedOffset * 0.43 + vec3(4.3, -7.1, 2.8)
        );
        float broadCells = fbm(surfacePoint * max(2.0, cellScale * 0.18) + seedOffset * 0.2);
        float darkCells = smoothstep(0.62, 0.9, broadCells) * spotStrength;
        float cellRidges = pow(1.0 - abs(granulation * 2.0 - 1.0), 4.0);
        float faculae = smoothstep(0.68, 0.9, fineGranulation)
          * pow(max(0.0, 1.0 - viewFacing), 0.45) * faculaStrength;
        float convection = (granulation - 0.5) * surfaceContrast * 2.0
          + cellRidges * granulationStrength * 0.45
          + (fineGranulation - 0.5) * surfaceContrast * 0.34
          - darkCells;
        vec3 photosphere = mix(
          displayColor * 0.34,
          displayColor,
          0.42 + granulation * 0.58
        );
        photosphere = mix(photosphere, vec3(1.0), 0.04 + faculae * 0.28);
        float rimEmission = pow(max(0.0, 1.0 - viewFacing), 2.2) * coronaStrength * 0.13;
        float brightness = clamp(
          limbDarkening * (0.84 + convection + faculae * 0.5) + rimEmission,
          0.18,
          1.24
        );

        gl_FragColor = vec4(photosphere * brightness, layerOpacity);
      }
    `,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);

  core.name = 'active-hyg-star-core';
  core.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS);
  core.visible = false;
  core.renderOrder = 3;
  core.userData['representation'] = 'volume';
  core.userData['scientificConfidence'] = 'illustrative';
  core.userData['visualStyle'] = 'procedural-selected-star-photosphere';

  return core;
}
