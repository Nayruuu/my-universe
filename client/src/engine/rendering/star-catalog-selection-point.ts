import * as THREE from 'three';
import { PICKING_LAYER } from '../selection/selection-layers';

const SELECTED_STAR_PICKING_PRIORITY = 30;

export function createStarCatalogSelectionPoint(): THREE.Points<
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
        gl_PointSize = 17.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.08, 0.2, abs(radius - 0.68));
        float core = (1.0 - smoothstep(0.0, 0.22, radius)) * 0.72;
        float alpha = max(ring * 0.92, core);
        gl_FragColor = vec4(0.48, 0.82, 1.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-hyg-star';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.layers.enable(PICKING_LAYER);
  point.userData['objectId'] = null;
  point.userData['pickingPriority'] = SELECTED_STAR_PICKING_PRIORITY;

  return point;
}
