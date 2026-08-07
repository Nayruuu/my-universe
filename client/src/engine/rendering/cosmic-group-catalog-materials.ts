import * as THREE from 'three';

export function createCosmicGroupFilamentMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      filamentOpacity: { value: 0 },
      filamentDetail: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float lineAlpha;
      attribute float detailThreshold;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        vAlpha = lineAlpha;
        vDetailThreshold = detailThreshold;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float filamentOpacity;
      uniform float filamentDetail;
      uniform float radiance;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        float detailFade = smoothstep(
          vDetailThreshold - 0.025,
          vDetailThreshold + 0.005,
          filamentDetail
        );
        vec3 color = mix(vec3(0.04, 0.34, 0.72), vec3(0.48, 0.93, 1.0), vAlpha);
        gl_FragColor = vec4(color * radiance, filamentOpacity * vAlpha * detailFade);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createCosmicGroupPointMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
      detailLevel: { value: 0 },
      impostorBlend: { value: 0 },
      qualityScale: { value: 1 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute vec3 pointColor;
      attribute float revealThreshold;
      attribute float galaxyAngle;
      attribute float galaxyAxisRatio;
      attribute float galaxyProfile;
      attribute float galaxyProminence;
      attribute float galaxySeed;
      uniform float pixelRatio;
      uniform float detailLevel;
      uniform float impostorBlend;
      uniform float qualityScale;
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vGalaxyOrientation;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;
      varying float vImpostorBlend;

      void main() {
        float reveal = smoothstep(
          revealThreshold - 0.018,
          revealThreshold + 0.004,
          detailLevel
        );
        vAlpha = pointAlpha * reveal;
        vColor = pointColor;
        vGalaxyOrientation = vec2(cos(galaxyAngle), sin(galaxyAngle));
        vGalaxyAxisRatio = galaxyAxisRatio;
        vGalaxyProfile = galaxyProfile;
        vGalaxyProminence = galaxyProminence;
        vGalaxySeed = galaxySeed;
        vImpostorBlend = impostorBlend;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float prominenceScale = 1.0 + galaxyProminence * 1.5;
        float visualScale = mix(1.0, 2.05 * prominenceScale, impostorBlend) * qualityScale;
        gl_PointSize = max(1.0, pointSize * visualScale * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vGalaxyOrientation;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;
      varying float vImpostorBlend;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float circularRadius = length(point);
        if (circularRadius > 1.0) {
          discard;
        }

        vec2 orientedPoint = mat2(
          vGalaxyOrientation.x,
          -vGalaxyOrientation.y,
          vGalaxyOrientation.y,
          vGalaxyOrientation.x
        ) * point;
        float axisRatio = mix(1.0, vGalaxyAxisRatio, vImpostorBlend);
        float galaxyRadius = length(vec2(orientedPoint.x, orientedPoint.y / axisRatio));
        if (vImpostorBlend > 0.99 && galaxyRadius > 1.0) {
          discard;
        }

        float pointHalo = pow(1.0 - circularRadius, 1.35);
        float pointCore = 1.0 - smoothstep(0.0, 0.24, circularRadius);
        float pointGlow = pointHalo * 0.62 + pointCore;

        float softEdge = 1.0 - smoothstep(0.72, 1.0, galaxyRadius);
        float diffuseLight = exp(-3.35 * galaxyRadius);
        float ellipticalLight = exp(-2.45 * pow(max(galaxyRadius, 0.0001), 0.72));
        float profileMix = smoothstep(0.34, 0.72, vGalaxyProfile);
        float unresolvedGroupLight = mix(ellipticalLight, diffuseLight, profileMix);
        float luminousCore = exp(-16.0 * galaxyRadius) *
          (1.0 + vGalaxyProminence * 0.8);
        vec2 groupLobeOffset = vec2(mix(0.2, 0.38, vGalaxySeed), -0.12);
        float groupLobe = exp(-18.0 * length(
          vec2(orientedPoint.x - groupLobeOffset.x, orientedPoint.y - groupLobeOffset.y)
        ));
        float galaxyGlow = softEdge *
          (unresolvedGroupLight * 0.78 + luminousCore * 1.55 + groupLobe * 0.2) *
          (1.12 + vGalaxyProminence * 0.38);
        float glow = mix(pointGlow, galaxyGlow, vImpostorBlend);

        vec3 coolStarlight = vec3(0.52, 0.7, 1.0);
        vec3 warmStarlight = vec3(1.0, 0.56, 0.3);
        vec3 galaxyColor = mix(coolStarlight, warmStarlight, vGalaxySeed);
        galaxyColor = mix(vColor, galaxyColor, 0.72);
        galaxyColor = mix(galaxyColor, vec3(1.0, 0.92, 0.78), luminousCore * 0.58);
        vec3 pointColor = mix(vColor, vec3(1.0, 0.97, 0.9), pointCore * 0.88);
        vec3 color = mix(pointColor, galaxyColor, vImpostorBlend);
        float brightness = mix(
          0.72 + pointCore * 0.58,
          0.82 + luminousCore * 0.72 + vGalaxyProminence * 0.16,
          vImpostorBlend
        );
        gl_FragColor = vec4(
          color * radiance * brightness,
          vAlpha * catalogOpacity * glow
        );
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createCosmicGroupSelectionPoint(): THREE.Points<
  THREE.BufferGeometry,
  THREE.ShaderMaterial
> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
    },
    vertexShader: `
      uniform float pixelRatio;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 24.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.07, 0.18, abs(radius - 0.68));
        float halo = pow(1.0 - radius, 1.5) * 0.38;
        gl_FragColor = vec4(0.52, 0.82, 1.0, max(ring, halo));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-cosmicflows4-group';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.userData['objectId'] = null;

  return point;
}
