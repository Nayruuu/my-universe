import * as THREE from 'three';
import { STELLAR_PROFILE_TINT_GLSL } from './stellar-surface-shader';
import type { StellarVisualProfile } from './stellar-visual-profile';

export interface StellarPhotosphereAppearance {
  readonly color: THREE.ColorRepresentation;
  readonly profile: StellarVisualProfile;
  readonly surfaceSeed: number;
  readonly opacity: number;
  readonly granulationStrength: number;
  readonly radiance?: number;
}

export function createStellarPhotosphereMaterial(
  appearance: StellarPhotosphereAppearance,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      starColor: { value: new THREE.Color(appearance.color) },
      layerOpacity: { value: appearance.opacity },
      granulationStrength: { value: appearance.granulationStrength },
      surfaceRadiance: { value: appearance.radiance ?? 1 },
      cellScale: { value: appearance.profile.cellScale },
      surfaceContrast: { value: appearance.profile.surfaceContrast },
      faculaStrength: { value: appearance.profile.faculaStrength },
      coronaStrength: { value: appearance.profile.coronaStrength },
      spotStrength: { value: appearance.profile.spotStrength },
      surfaceSeed: { value: appearance.surfaceSeed },
      surfaceProfile: { value: appearance.profile.shaderIndex },
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vViewNormal;
      varying vec3 vSurfacePosition;

      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vSurfacePosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 starColor;
      uniform float layerOpacity;
      uniform float granulationStrength;
      uniform float surfaceRadiance;
      uniform float cellScale;
      uniform float surfaceContrast;
      uniform float faculaStrength;
      uniform float coronaStrength;
      uniform float spotStrength;
      uniform float surfaceSeed;
      uniform float surfaceProfile;
      varying vec3 vViewNormal;
      varying vec3 vSurfacePosition;

      ${STELLAR_PROFILE_TINT_GLSL}

      float stellarHash(vec3 point) {
        point = fract(point * 0.1031);
        point += dot(point, point.yzx + 33.33);
        return fract((point.x + point.y) * point.z);
      }

      float stellarNoise(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(
            mix(stellarHash(cell), stellarHash(cell + vec3(1.0, 0.0, 0.0)), local.x),
            mix(
              stellarHash(cell + vec3(0.0, 1.0, 0.0)),
              stellarHash(cell + vec3(1.0, 1.0, 0.0)),
              local.x
            ),
            local.y
          ),
          mix(
            mix(
              stellarHash(cell + vec3(0.0, 0.0, 1.0)),
              stellarHash(cell + vec3(1.0, 0.0, 1.0)),
              local.x
            ),
            mix(
              stellarHash(cell + vec3(0.0, 1.0, 1.0)),
              stellarHash(cell + vec3(1.0, 1.0, 1.0)),
              local.x
            ),
            local.y
          ),
          local.z
        );
      }

      float stellarFbm(vec3 point) {
        float value = 0.0;
        float amplitude = 0.58;
        for (int octave = 0; octave < 4; octave += 1) {
          value += stellarNoise(point) * amplitude;
          point = point * 2.07 + vec3(5.2, -3.1, 7.4);
          amplitude *= 0.46;
        }
        return value;
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec3 displayColor = mix(starColor, illustrativeStellarTint(surfaceProfile), 0.28);
        float viewFacing = max(0.0, vViewNormal.z);
        float limbDarkening = 0.3 + pow(viewFacing, 0.48) * 0.94;
        vec3 surfacePoint = normalize(vSurfacePosition);
        vec3 seedOffset = vec3(surfaceSeed * 11.3, surfaceSeed * -7.7, surfaceSeed * 17.9);
        float granulation = stellarFbm(surfacePoint * cellScale + seedOffset);
        float fineGranulation = stellarFbm(
          surfacePoint * cellScale * 2.35 - seedOffset * 0.43 + vec3(4.3, -7.1, 2.8)
        );
        float broadCells = stellarFbm(surfacePoint * max(2.0, cellScale * 0.18) + seedOffset * 0.2);
        float darkCells = smoothstep(0.62, 0.9, broadCells) * spotStrength;
        float cellRidges = pow(1.0 - abs(granulation * 2.0 - 1.0), 4.0);
        float faculae = smoothstep(0.66, 0.9, fineGranulation)
          * pow(max(0.0, 1.0 - viewFacing), 0.42) * faculaStrength;
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

        gl_FragColor = vec4(photosphere * brightness * surfaceRadiance, layerOpacity);
      }
    `,
    transparent: true,
    opacity: appearance.opacity,
    blending: THREE.NormalBlending,
    depthWrite: true,
    toneMapped: false,
  });

  material.userData['scientificConfidence'] = 'illustrative';
  material.userData['visualStyle'] = 'procedural-stellar-photosphere';
  applyStellarPhotosphereAppearance(material, appearance);

  return material;
}

export function applyStellarPhotosphereAppearance(
  material: THREE.ShaderMaterial,
  appearance: StellarPhotosphereAppearance,
): void {
  (material.uniforms['starColor']!.value as THREE.Color).set(appearance.color);
  material.uniforms['layerOpacity']!.value = appearance.opacity;
  material.uniforms['granulationStrength']!.value = appearance.granulationStrength;
  const surfaceRadiance = material.uniforms['surfaceRadiance'];

  if (surfaceRadiance) {
    surfaceRadiance.value = appearance.radiance ?? 1;
  }
  material.uniforms['cellScale']!.value = appearance.profile.cellScale;
  material.uniforms['surfaceContrast']!.value = appearance.profile.surfaceContrast;
  material.uniforms['faculaStrength']!.value = appearance.profile.faculaStrength;
  material.uniforms['coronaStrength']!.value = appearance.profile.coronaStrength;
  material.uniforms['spotStrength']!.value = appearance.profile.spotStrength;
  material.uniforms['surfaceSeed']!.value = appearance.surfaceSeed;
  material.uniforms['surfaceProfile']!.value = appearance.profile.shaderIndex;
  material.opacity = appearance.opacity;
  material.userData['visualFamily'] = appearance.profile.family;
}
