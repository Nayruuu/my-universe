import * as THREE from 'three';
import { STELLAR_SPRITE_SURFACE_GLSL } from '../materials/stellar-surface-shader';
import { STELLAR_POINT_PROXIMITY_GLSL } from './stellar-point-proximity';

export function createStarCatalogMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      pointScale: { value: 1 },
      radiance: { value: 1 },
      diffractionStrength: { value: 0.5 },
      airyStrength: { value: 0.26 },
      surfaceDetail: { value: 0.72 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float pointIntensity;
      attribute float surfaceProfile;
      attribute float surfaceCellScale;
      attribute float surfaceContrast;
      attribute float surfaceCorona;
      attribute float surfaceSpotStrength;
      attribute float surfaceSeed;
      attribute vec3 color;
      uniform float pixelRatio;
      uniform float pointScale;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vIntensity;
      varying float vSurfaceProfile;
      varying float vSurfaceCellScale;
      varying float vSurfaceContrast;
      varying float vSurfaceCorona;
      varying float vSurfaceSpotStrength;
      varying float vSurfaceSeed;
      varying float vSurfaceReveal;

      ${STELLAR_POINT_PROXIMITY_GLSL}

      void main() {
        vColor = color;
        vAlpha = pointAlpha;
        vIntensity = pointIntensity;
        vSurfaceProfile = surfaceProfile;
        vSurfaceCellScale = surfaceCellScale;
        vSurfaceContrast = surfaceContrast;
        vSurfaceCorona = surfaceCorona;
        vSurfaceSpotStrength = surfaceSpotStrength;
        vSurfaceSeed = surfaceSeed;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        float proximityGrowth = stellarPointProximityGrowth(viewPosition.xyz);
        float projectionGrowth = stellarPointProjectionGrowth();
        float renderedPointSize = max(
          1.0,
          pointSize * pointScale * proximityGrowth * projectionGrowth * pixelRatio
        );
        gl_PointSize = renderedPointSize;
        vSurfaceReveal = smoothstep(8.0, 16.0, renderedPointSize);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      uniform float diffractionStrength;
      uniform float airyStrength;
      uniform float surfaceDetail;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vIntensity;
      varying float vSurfaceProfile;
      varying float vSurfaceCellScale;
      varying float vSurfaceContrast;
      varying float vSurfaceCorona;
      varying float vSurfaceSpotStrength;
      varying float vSurfaceSeed;
      varying float vSurfaceReveal;

      ${STELLAR_SPRITE_SURFACE_GLSL}

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float moffatProfile = pow(1.0 + radius * radius * 18.0, -2.15);
        float temperatureHalo = pow(max(0.0, 1.0 - radius), 1.7);
        float airyRing = exp(-pow((radius - 0.36) * 17.0, 2.0)) * airyStrength;
        float luminousCore = 1.0 - smoothstep(0.0, 0.18, radius);
        float horizontal = 1.0 - smoothstep(0.0, 0.055, abs(point.y));
        float vertical = 1.0 - smoothstep(0.0, 0.055, abs(point.x));
        float diagonalA = 1.0 - smoothstep(0.0, 0.042, abs(point.x - point.y));
        float diagonalB = 1.0 - smoothstep(0.0, 0.042, abs(point.x + point.y));
        float brightStar = smoothstep(0.12, 0.82, vIntensity);
        float diffraction = max(horizontal, vertical) * pow(1.0 - radius, 1.8)
          * brightStar * diffractionStrength;
        diffraction += max(diagonalA, diagonalB) * pow(1.0 - radius, 2.4)
          * brightStar * diffractionStrength * airyStrength * 0.46;
        vec3 coreColor = mix(vColor, vec3(1.0), luminousCore * 0.62);
        vec3 opticalColor = coreColor
          * (0.42 + temperatureHalo * 0.7 + moffatProfile * 1.7 + airyRing + diffraction * 1.3)
          * radiance;
        float opticalAlpha = min(
          1.0,
          temperatureHalo * 0.48 + moffatProfile * 0.9 + airyRing + diffraction
        ) * vAlpha * catalogOpacity;
        vec4 photosphere = proceduralPhotosphere(
          point,
          vColor,
          vSurfaceCellScale,
          vSurfaceContrast,
          vSurfaceCorona,
          vSurfaceSpotStrength,
          vSurfaceSeed,
          vSurfaceProfile
        );
        float surfaceReveal = vSurfaceReveal * surfaceDetail;
        vec3 finalColor = mix(opticalColor, photosphere.rgb * radiance, surfaceReveal);
        float alpha = max(
          opticalAlpha * (1.0 - surfaceReveal * 0.34),
          photosphere.a * surfaceReveal * vAlpha * catalogOpacity
        );
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
