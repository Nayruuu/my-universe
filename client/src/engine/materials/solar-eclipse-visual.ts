import * as THREE from 'three';
import { EarthEclipseKind, SolarEclipseAppearance } from '../simulation/earth-eclipse';

const SUN_RADIUS_IN_EARTH_RADII = 696_340 / 6_378.137;
const MOON_RADIUS_IN_EARTH_RADII = 1_737.4 / 6_378.137;

export class SolarEclipseVisual {
  public readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly path: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  private readonly sunPositionUniform: THREE.IUniform<THREE.Vector3> = {
    value: new THREE.Vector3(1, 0, 0),
  };
  private readonly moonPositionUniform: THREE.IUniform<THREE.Vector3> = {
    value: new THREE.Vector3(1, 0, 0),
  };
  private readonly shadowCenterUniform: THREE.IUniform<THREE.Vector3> = {
    value: new THREE.Vector3(1, 0, 0),
  };
  private readonly centralShadowUniform: THREE.IUniform<number> = { value: 0 };
  private readonly visibilityUniform: THREE.IUniform<number> = { value: 0 };
  private active = false;
  private pathConfigured = false;
  private visibilityBlend = 0;

  constructor(geometry: THREE.BufferGeometry, visualRadius: number) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunPosition: this.sunPositionUniform,
        moonPosition: this.moonPositionUniform,
        shadowCenter: this.shadowCenterUniform,
        centralShadow: this.centralShadowUniform,
        sunRadius: { value: SUN_RADIUS_IN_EARTH_RADII },
        moonRadius: { value: MOON_RADIUS_IN_EARTH_RADII },
        visibility: this.visibilityUniform,
      },
      vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 p;
void main(){
p=position;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
#include <logdepthbuf_vertex>
}`,
      fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 sunPosition,moonPosition,shadowCenter;
uniform float sunRadius,moonRadius,centralShadow,visibility;
varying vec3 p;
void main(){
#include <logdepthbuf_fragment>
vec3 surface=normalize(p);
vec3 toSun=sunPosition-surface,toMoon=moonPosition-surface;
float sunDist=length(toSun),moonDist=length(toMoon);
vec3 sunDir=toSun/sunDist,moonDir=toMoon/moonDist;
if(dot(surface,sunDir)<=-0.015){discard;}
float sep=acos(clamp(dot(sunDir,moonDir),-1.0,1.0));
float sunAngle=asin(clamp(sunRadius/sunDist,0.0,0.999));
float moonAngle=asin(clamp(moonRadius/moonDist,0.0,0.999));
float outer=sunAngle+moonAngle;
float inner=abs(moonAngle-sunAngle);
float feather=max(fwidth(sep)*1.8,0.000035);
float overlap=1.0-smoothstep(outer-feather,outer+feather,sep);
float displayDist=acos(clamp(dot(surface,normalize(shadowCenter)),-1.0,1.0));
float displayPenumbra=1.0-smoothstep(0.055,0.28,displayDist);
if(overlap<0.002&&displayPenumbra<0.002){discard;}
float central=1.0-smoothstep(inner-feather,inner+feather,sep);
float eclipseDepth=clamp((outer-sep)/max(2.0*sunAngle,0.00001),0.0,1.0);
float totality=central*step(sunAngle,moonAngle);
float annularity=central*(1.0-step(sunAngle,moonAngle));
float penumbraDensity=pow(smoothstep(0.0,1.0,eclipseDepth),0.72);
float centralDensity=max(totality,annularity);
float displayCore=centralShadow*(1.0-smoothstep(0.0,0.052,displayDist));
float displayRing=centralShadow*(1.0-smoothstep(0.003,0.009,abs(displayDist-0.052)));
float penumbraAlpha=max(overlap*mix(0.16,0.56,penumbraDensity),displayPenumbra*0.3);
float coreAlpha=max(centralDensity*0.68,max(displayCore*0.66,displayRing*0.92));
float layerAlpha=clamp(max(penumbraAlpha,coreAlpha),0.0,0.92);
vec3 penumbraColor=vec3(0.035,0.42,0.95);
vec3 totalityColor=vec3(1.0,0.13,0.045);
vec3 annularityColor=vec3(1.0,0.58,0.035);
vec3 centralColor=mix(annularityColor,totalityColor,step(0.9,centralShadow));
float centralWeight=clamp(max(centralDensity,max(displayCore,displayRing)),0.0,1.0);
vec3 layerColor=mix(penumbraColor,centralColor,centralWeight);
gl_FragColor=vec4(layerColor,layerAlpha*visibility);
}`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'earth-solar-eclipse-shadow';
    this.mesh.userData['eclipsePalette'] = 'penumbra-cyan-totality-coral';
    this.mesh.renderOrder = 4;
    this.mesh.scale.setScalar(visualRadius * 1.012);
    this.mesh.visible = false;

    this.path = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xff6548,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.path.name = 'solar-eclipse-totality-path';
    this.path.renderOrder = 5;
    this.path.scale.setScalar(visualRadius * 1.026);
    this.path.visible = false;
  }

  public updateAppearance(appearance: SolarEclipseAppearance): void {
    this.active = appearance.phase !== 'none';
    this.mesh.userData['eclipsePhase'] = appearance.phase;
    this.sunPositionUniform.value.set(
      appearance.sunPositionInEarthRadii.x,
      appearance.sunPositionInEarthRadii.y,
      appearance.sunPositionInEarthRadii.z,
    );
    this.moonPositionUniform.value.set(
      appearance.moonPositionInEarthRadii.x,
      appearance.moonPositionInEarthRadii.y,
      appearance.moonPositionInEarthRadii.z,
    );
    this.shadowCenterUniform.value.set(
      appearance.shadowDirection.x,
      appearance.shadowDirection.y,
      appearance.shadowDirection.z,
    );
    this.centralShadowUniform.value =
      appearance.phase === 'total' ? 1 : appearance.phase === 'annular' ? 0.72 : 0;
    this.mesh.userData['visualScaleMode'] = 'adaptive';
    this.applyVisibility();
  }

  public setPath(points: readonly THREE.Vector3[], kind: EarthEclipseKind): void {
    this.path.geometry.setFromPoints([...points]);
    this.path.geometry.setDrawRange(0, points.length);
    this.path.material.color.set(kind === 'annular' ? 0xffb347 : 0xff6548);
    this.path.userData['eclipseKind'] = kind;
    this.pathConfigured = points.length >= 2;
    this.applyVisibility();
  }

  public clearPath(): void {
    this.path.geometry.setDrawRange(0, 0);
    this.pathConfigured = false;
    this.applyVisibility();
  }

  public setVisibilityBlend(visibilityBlend: number): void {
    this.visibilityBlend = visibilityBlend;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.visibilityUniform.value = this.visibilityBlend;
    this.mesh.visible = this.active && this.visibilityBlend > 0.008;
    this.path.material.opacity = this.visibilityBlend * 0.86;
    this.path.visible = this.pathConfigured && this.visibilityBlend > 0.008;
  }
}
