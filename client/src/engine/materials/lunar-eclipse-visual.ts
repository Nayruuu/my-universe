import * as THREE from 'three';
import { LunarEclipseAppearance } from '../simulation/earth-eclipse';

export class LunarEclipseVisual {
  public readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly shadowAxisUniform: THREE.IUniform<THREE.Vector3> = {
    value: new THREE.Vector3(1, 0, 0),
  };
  private readonly shadowOffsetUniform: THREE.IUniform<THREE.Vector3> = {
    value: new THREE.Vector3(),
  };
  private readonly umbraRadiusUniform: THREE.IUniform<number> = { value: 0 };
  private readonly penumbraRadiusUniform: THREE.IUniform<number> = { value: 0 };
  private readonly visibilityUniform: THREE.IUniform<number> = { value: 0 };
  private active = false;
  private visibilityBlend = 0;

  constructor(geometry: THREE.BufferGeometry, visualRadius: number) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        shadowAxis: this.shadowAxisUniform,
        shadowOffset: this.shadowOffsetUniform,
        umbraRadius: this.umbraRadiusUniform,
        penumbraRadius: this.penumbraRadiusUniform,
        visibility: this.visibilityUniform,
      },
      vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 localSpherePosition;
void main(){
localSpherePosition=position;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 shadowAxis,shadowOffset;
uniform float umbraRadius,penumbraRadius,visibility;
varying vec3 localSpherePosition;
void main(){
#include <logdepthbuf_fragment>
vec3 fragmentOffset=shadowOffset+localSpherePosition;
vec3 perpendicularOffset=fragmentOffset-shadowAxis*dot(fragmentOffset,shadowAxis);
float shadowDistance=length(perpendicularOffset);
float penumbraCoverage=1.0-smoothstep(penumbraRadius-0.18,penumbraRadius+0.08,shadowDistance);
float penumbraDepth=clamp((penumbraRadius-shadowDistance)/max(penumbraRadius-umbraRadius,0.001),0.0,1.0);
float umbraCoverage=1.0-smoothstep(umbraRadius-0.06,umbraRadius+0.06,shadowDistance);
float alpha=(penumbraCoverage*(0.08+0.18*penumbraDepth)+umbraCoverage*0.68)*visibility;
if(alpha<0.002){discard;}
vec3 penumbraColor=vec3(0.025,0.035,0.065);
vec3 umbraColor=vec3(0.22,0.045,0.018);
vec3 shadowColor=mix(penumbraColor,umbraColor,umbraCoverage*0.88);
gl_FragColor=vec4(shadowColor,min(alpha,0.9));
}`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'moon-eclipse-shadow';
    this.mesh.renderOrder = 4;
    this.mesh.scale.setScalar(visualRadius * 1.012);
    this.mesh.visible = false;
  }

  public updateAppearance(appearance: LunarEclipseAppearance): void {
    this.active = appearance.phase !== 'none';
    this.mesh.userData['eclipsePhase'] = appearance.phase;
    this.shadowAxisUniform.value.set(
      appearance.shadowAxis.x,
      appearance.shadowAxis.y,
      appearance.shadowAxis.z,
    );
    this.shadowOffsetUniform.value.set(
      appearance.shadowOffsetInMoonRadii.x,
      appearance.shadowOffsetInMoonRadii.y,
      appearance.shadowOffsetInMoonRadii.z,
    );
    this.umbraRadiusUniform.value = appearance.umbraRadiusInMoonRadii;
    this.penumbraRadiusUniform.value = appearance.penumbraRadiusInMoonRadii;
    this.applyVisibility();
  }

  public setVisibilityBlend(visibilityBlend: number): void {
    this.visibilityBlend = visibilityBlend;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.visibilityUniform.value = this.visibilityBlend;
    this.mesh.visible = this.active && this.visibilityBlend > 0.008;
  }
}
