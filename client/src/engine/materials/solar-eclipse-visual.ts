import * as THREE from 'three';
import { EarthEclipseKind, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import type {
  SolarEclipseEventMap,
  SolarEclipseEventMapRenderData,
  SolarEclipseProjectedMapPoint,
} from '../simulation/solar-eclipse-event-map';

const SUN_RADIUS_IN_EARTH_RADII = 696_340 / 6_378.137;
const MOON_RADIUS_IN_EARTH_RADII = 1_737.4 / 6_378.137;
const PARTIAL_ENVELOPE_RADIUS = 1.018;
const CORRIDOR_RADIUS = 1.026;
const CORRIDOR_LINE_RADIUS = 1.032;
const PARTIAL_ENVELOPE_OPACITY = 0.065;
const CORRIDOR_OPACITY = 0.58;
const CORRIDOR_LIMIT_OPACITY = 0.72;
const CENTRAL_LINE_OPACITY = 0.95;
const PARTIAL_TEXTURE_WIDTH = 1_024;
const PARTIAL_TEXTURE_HEIGHT = 512;

export class SolarEclipseVisual {
  public readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly eventMapRoot = new THREE.Group();
  public readonly partialEnvelope: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  public readonly corridor: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  public readonly corridorLimits: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
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
  private readonly partialEnvelopeCanvas: HTMLCanvasElement;
  private readonly partialEnvelopeTexture: THREE.CanvasTexture;
  private active = false;
  private eventMapConfigured = false;
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
float penumbraAlpha=max(overlap*mix(0.16,0.56,penumbraDensity),displayPenumbra*0.18);
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

    const partialEnvelopeMap = createPartialEnvelopeTexture();

    this.partialEnvelopeCanvas = partialEnvelopeMap.canvas;
    this.partialEnvelopeTexture = partialEnvelopeMap.texture;
    this.partialEnvelope = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: this.partialEnvelopeTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.partialEnvelope.name = 'solar-eclipse-event-partial-envelope';
    this.partialEnvelope.renderOrder = 5;
    this.partialEnvelope.scale.setScalar(PARTIAL_ENVELOPE_RADIUS);
    this.partialEnvelope.visible = false;

    this.corridor = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xff6548,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.corridor.name = 'solar-eclipse-central-corridor';
    this.corridor.renderOrder = 6;
    this.corridor.scale.setScalar(CORRIDOR_RADIUS);
    this.corridor.visible = false;

    this.corridorLimits = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffd4c8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.corridorLimits.name = 'solar-eclipse-central-corridor-limits';
    this.corridorLimits.renderOrder = 7;
    this.corridorLimits.scale.setScalar(CORRIDOR_LINE_RADIUS);
    this.corridorLimits.visible = false;

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
    this.path.name = 'solar-eclipse-central-line';
    this.path.renderOrder = 8;
    this.path.scale.setScalar(CORRIDOR_LINE_RADIUS);
    this.path.visible = false;

    this.eventMapRoot.name = 'solar-eclipse-event-map';
    this.eventMapRoot.visible = false;
    this.eventMapRoot.add(this.partialEnvelope, this.corridor, this.corridorLimits, this.path);
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

  public setEventMap(
    eventMap: SolarEclipseEventMap,
    renderData: SolarEclipseEventMapRenderData,
    kind: EarthEclipseKind,
  ): void {
    rasterizePartialEnvelope(
      this.partialEnvelopeCanvas,
      this.partialEnvelopeTexture,
      renderData.partialPolygons,
    );
    setIndexedGeometry(
      this.corridor.geometry,
      renderData.corridorPositions,
      renderData.corridorIndices,
    );
    setLineGeometry(this.corridorLimits.geometry, renderData.corridorLimitPositions);
    setLineGeometry(this.path.geometry, renderData.centralLinePositions);

    const centralColor = kind === 'annular' ? 0xffb347 : 0xff6548;

    this.corridor.material.color.setHex(centralColor);
    this.corridorLimits.material.color.setHex(kind === 'annular' ? 0xffe0a3 : 0xffd4c8);
    this.path.material.color.setHex(centralColor);
    this.path.userData['eclipseKind'] = kind;
    this.corridor.userData['eclipseKind'] = kind;
    this.eventMapRoot.userData['scientificConfidence'] = eventMap.scientificConfidence;
    this.eventMapRoot.userData['source'] = eventMap.source;
    this.eventMapRoot.userData['partialFootprintCount'] = eventMap.partialFootprints.length;
    this.eventMapRoot.userData['corridorSampleCount'] = eventMap.corridor.length;
    this.partialEnvelope.visible = eventMap.partialFootprints.length > 0;
    this.corridor.visible = eventMap.corridor.length >= 2;
    this.corridorLimits.visible = eventMap.corridor.length >= 2;
    this.path.visible = eventMap.corridor.length >= 2;
    this.eventMapConfigured =
      eventMap.partialFootprints.length > 0 || eventMap.corridor.length >= 2;
    this.applyVisibility();
  }

  public clearPath(): void {
    clearPartialEnvelope(this.partialEnvelopeCanvas, this.partialEnvelopeTexture);
    clearGeometry(this.corridor.geometry);
    clearGeometry(this.corridorLimits.geometry);
    clearGeometry(this.path.geometry);
    this.partialEnvelope.visible = false;
    this.corridor.visible = false;
    this.corridorLimits.visible = false;
    this.path.visible = false;
    this.eventMapConfigured = false;
    this.applyVisibility();
  }

  public setVisibilityBlend(visibilityBlend: number): void {
    this.visibilityBlend = visibilityBlend;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.visibilityUniform.value = this.visibilityBlend;
    this.mesh.visible = this.active && this.visibilityBlend > 0.008;
    this.partialEnvelope.material.opacity = this.visibilityBlend * PARTIAL_ENVELOPE_OPACITY;
    this.corridor.material.opacity = this.visibilityBlend * CORRIDOR_OPACITY;
    this.corridorLimits.material.opacity = this.visibilityBlend * CORRIDOR_LIMIT_OPACITY;
    this.path.material.opacity = this.visibilityBlend * CENTRAL_LINE_OPACITY;
    this.eventMapRoot.visible = this.eventMapConfigured && this.visibilityBlend > 0.008;
  }
}

function createPartialEnvelopeTexture(): {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');

  canvas.width = PARTIAL_TEXTURE_WIDTH;
  canvas.height = PARTIAL_TEXTURE_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);

  texture.name = 'solar-eclipse-partial-envelope-map';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.userData['longitudeConvention'] = 'east-positive';
  texture.needsUpdate = true;

  return { canvas, texture };
}

function rasterizePartialEnvelope(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  polygons: readonly SolarEclipseProjectedMapPoint[][],
): void {
  const context = canvas.getContext('2d')!;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#2f91ff';
  for (const polygon of polygons) {
    if (polygon.length < 3) {
      continue;
    }
    for (let shift = -2; shift <= 2; shift += 1) {
      context.beginPath();
      for (let index = 0; index < polygon.length; index += 1) {
        const point = polygon[index]!;
        const x = (point.x + shift) * PARTIAL_TEXTURE_WIDTH;

        if (index === 0) {
          context.moveTo(x, point.y * PARTIAL_TEXTURE_HEIGHT);
        } else {
          context.lineTo(x, point.y * PARTIAL_TEXTURE_HEIGHT);
        }
      }
      context.closePath();
      context.fill();
    }
  }
  texture.needsUpdate = true;
}

function clearPartialEnvelope(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture): void {
  canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;
}

function setIndexedGeometry(
  geometry: THREE.BufferGeometry,
  positions: number[],
  indices: number[],
): void {
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setDrawRange(0, indices.length);
  if (positions.length > 0) {
    geometry.computeBoundingSphere();
  }
}

function setLineGeometry(geometry: THREE.BufferGeometry, positions: number[]): void {
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(null);
  geometry.setDrawRange(0, positions.length / 3);
  if (positions.length > 0) {
    geometry.computeBoundingSphere();
  }
}

function clearGeometry(geometry: THREE.BufferGeometry): void {
  geometry.setDrawRange(0, 0);
}
