import * as THREE from 'three';
import { type GraphicQuality, type SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { getBlackHoleVisualProfile } from './black-hole-visual-profile';
import {
  manageMaterial,
  type CelestialVisual,
  type CelestialVisualAssets,
  type ManagedLodMaterial,
} from './celestial-visual-types';
import { hashString, mulberry32 } from './visual-random';

export function createBlackHoleCelestialVisual(
  root: THREE.Group,
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
  const activity = object.visual.blackHoleActivity ?? 'dormant';
  const profile = getBlackHoleVisualProfile(activity, quality);
  const radius = object.visual.visualRadius;
  const nearRoot = new THREE.Group();
  const lensingForeground = new THREE.Group();

  nearRoot.name = `${object.id}-near-representation`;
  nearRoot.visible = false;
  lensingForeground.name = `${object.id}-lensing-foreground`;
  nearRoot.add(lensingForeground);
  root.add(nearRoot);

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Mesh(assets.sphereGeometry, coreMaterial);

  core.name = `${object.id}-event-horizon`;
  core.scale.setScalar(radius);
  core.renderOrder = 10;
  core.userData['scientificConfidence'] = 'illustrative';
  core.userData['visualStyle'] = 'event-horizon-silhouette';
  lensingForeground.add(core);

  const haloMaterial = new THREE.SpriteMaterial({
    map: assets.glowTexture,
    color: object.visual.secondaryColor ?? '#8fb9e8',
    transparent: true,
    opacity: profile.lensingOpacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMaterial);

  halo.name = `${object.id}-local-lensing-halo`;
  halo.scale.setScalar(radius * profile.lensingScale);
  halo.renderOrder = 7;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['visualStyle'] = 'local-lensing-cue';
  lensingForeground.add(halo);

  const photonRingMaterial = new THREE.SpriteMaterial({
    map: assets.photonRingTexture,
    color: object.visual.color ?? '#f3a45f',
    transparent: true,
    opacity: profile.photonRingOpacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const photonRing = new THREE.Sprite(photonRingMaterial);

  photonRing.name = `${object.id}-photon-ring`;
  photonRing.scale.setScalar(radius * 2.8);
  photonRing.renderOrder = 9;
  photonRing.userData['scientificConfidence'] = 'illustrative';
  photonRing.userData['visualStyle'] = 'stylized-photon-ring';
  lensingForeground.add(photonRing);

  const nearMaterials: ManagedLodMaterial[] = [
    manageMaterial(coreMaterial),
    manageMaterial(haloMaterial),
    manageMaterial(photonRingMaterial),
  ];
  const nuclearCluster = createBlackHoleNuclearStarCluster(object, quality, radius, assets);

  if (nuclearCluster) {
    nearRoot.add(nuclearCluster.points);
    nearMaterials.push(manageMaterial(nuclearCluster.material));
  }

  if (profile.showAccretionDisk) {
    const diskFrame = new THREE.Group();
    const inclination = object.visual.accretionDiskInclinationDegrees ?? 62;
    const diskMaterial = createBlackHoleAccretionMaterial(
      object.visual.color ?? '#f3a45f',
      object.visual.secondaryColor ?? '#8fb9e8',
      profile.diskOpacity,
    );
    const disk = new THREE.Mesh(assets.ringGeometry, diskMaterial);

    diskFrame.name = `${object.id}-accretion-frame`;
    diskFrame.rotation.x = THREE.MathUtils.degToRad(inclination);
    disk.name = `${object.id}-accretion-disk`;
    disk.scale.setScalar(radius * profile.diskScale);
    disk.renderOrder = 8;
    disk.userData['scientificConfidence'] = 'illustrative';
    disk.userData['visualStyle'] = 'stylized-accretion-emission';
    diskFrame.add(disk);
    lensingForeground.add(diskFrame);
    nearMaterials.push(manageMaterial(diskMaterial));

    if (profile.showJets) {
      const jets = createBlackHoleJets(
        object,
        radius,
        profile.jetLength,
        profile.jetOpacity,
        profile.segmentCount,
      );

      diskFrame.add(jets.root);
      nearMaterials.push(manageMaterial(jets.material));
    }
  }

  const hitTarget = new THREE.Mesh(assets.selectionGeometry, assets.selectionMaterial);

  hitTarget.name = `${object.id}-selection-target`;
  hitTarget.scale.setScalar(Math.max(radius * profile.lensingScale * 0.5, 1.2));
  hitTarget.layers.set(PICKING_LAYER);
  hitTarget.userData['objectId'] = object.id;
  root.add(hitTarget);

  const farMaterial = new THREE.SpriteMaterial({
    map: assets.glowTexture,
    color: object.visual.color ?? '#f3a45f',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const farSprite = new THREE.Sprite(farMaterial);
  const farDiameter = radius * profile.farDiameterScale;

  farSprite.name = `${object.id}-black-hole-impostor`;
  farSprite.scale.set(farDiameter, farDiameter, 1);
  farSprite.visible = false;
  farSprite.renderOrder = 6;
  farSprite.userData['scientificConfidence'] = 'illustrative';
  farSprite.userData['visualStyle'] = 'unresolved-black-hole-marker';
  root.add(farSprite);

  return {
    root,
    lensingForeground,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    supernova: null,
    observerCorona: null,
    pickables: [hitTarget],
    lod: {
      nearRoot,
      farSprite,
      nearMaterials,
      deferredTextures: [],
      deferredTexturesRequested: false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: profile.farOpacity,
      farBaseDiameter: farDiameter,
      farAspectRatio: 1,
    },
  };
}

function createBlackHoleNuclearStarCluster(
  object: SpaceObject,
  quality: GraphicQuality,
  radius: number,
  assets: CelestialVisualAssets,
): {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  material: THREE.PointsMaterial;
} | null {
  const pointCount = quality === 'high' ? 6_144 : quality === 'medium' ? 3_072 : 0;

  if (
    pointCount === 0 ||
    object.metadata?.['lensingEnvironment'] !== 'procedural-nuclear-star-cluster'
  ) {
    return null;
  }

  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const random = mulberry32(hashString(object.id));

  for (let index = 0; index < pointCount; index += 1) {
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const radialDistance = radius * (0.12 + random() ** 1.72 * 6.5);
    const positionOffset = index * 3;

    positions[positionOffset] = Math.cos(azimuth) * horizontal * radialDistance;
    positions[positionOffset + 1] = vertical * radialDistance * 0.82;
    positions[positionOffset + 2] = Math.sin(azimuth) * horizontal * radialDistance;

    const brightness = 0.54 + random() ** 3.8 * 0.46;
    const warmth = random() ** 0.42;

    colors[positionOffset] = brightness * (0.94 + warmth * 0.06);
    colors[positionOffset + 1] = brightness * (0.68 + warmth * 0.16);
    colors[positionOffset + 2] = brightness * (0.62 - warmth * 0.28);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: assets.glowTexture,
    size: radius * (quality === 'high' ? 0.032 : 0.038),
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: quality === 'high' ? 0.76 : 0.66,
    alphaTest: 0.015,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);

  points.name = `${object.id}-nuclear-star-cluster`;
  points.renderOrder = 1;
  points.frustumCulled = false;
  points.userData['scientificConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'procedural-3d-nuclear-star-cluster';
  points.userData['pointCount'] = pointCount;

  return { points, material };
}

function createBlackHoleAccretionMaterial(
  hotColor: string,
  coolColor: string,
  opacity: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      hotColor: { value: new THREE.Color(hotColor) },
      coolColor: { value: new THREE.Color(coolColor) },
      layerOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 hotColor;
      uniform vec3 coolColor;
      uniform float layerOpacity;
      varying vec2 vUv;

      void main() {
        vec2 centered = vUv - vec2(0.5);
        float radius = length(centered) * 2.0;
        float innerEdge = smoothstep(0.58, 0.66, radius);
        float outerEdge = 1.0 - smoothstep(0.86, 1.0, radius);
        float ring = innerEdge * outerEdge;
        float heat = 1.0 - smoothstep(0.58, 1.0, radius);
        float turbulence = 0.78 + 0.22 * sin(radius * 92.0 + atan(centered.y, centered.x) * 7.0);
        float doppler = 0.68 + 0.32 * smoothstep(-0.45, 0.45, centered.x);
        vec3 color = mix(coolColor, hotColor, heat) * turbulence * doppler;

        if (ring < 0.005 || layerOpacity < 0.005) {
          discard;
        }
        gl_FragColor = vec4(color, ring * layerOpacity);
      }
    `,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  material.userData['scientificConfidence'] = 'illustrative';
  material.userData['visualStyle'] = 'stylized-accretion-emission';
  material.onBeforeRender = () => {
    material.uniforms['layerOpacity']!.value = material.opacity;
  };

  return material;
}

function createBlackHoleJets(
  object: SpaceObject,
  radius: number,
  lengthScale: number,
  opacity: number,
  segmentCount: number,
): { root: THREE.Group; material: THREE.MeshBasicMaterial } {
  const length = radius * lengthScale;
  const geometry = new THREE.ConeGeometry(
    radius * 0.07,
    length,
    Math.round(segmentCount / 4),
    1,
    true,
  );
  const material = new THREE.MeshBasicMaterial({
    color: object.visual.secondaryColor ?? '#8fb9e8',
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const root = new THREE.Group();
  const forward = new THREE.Mesh(geometry, material);
  const backward = new THREE.Mesh(geometry, material);

  root.name = `${object.id}-relativistic-jets`;
  root.userData['scientificConfidence'] = 'illustrative';
  root.userData['visualStyle'] = 'stylized-relativistic-jets';
  forward.position.z = length * 0.5;
  forward.rotation.x = Math.PI / 2;
  backward.position.z = -length * 0.5;
  backward.rotation.x = -Math.PI / 2;
  root.add(forward, backward);

  return { root, material };
}
