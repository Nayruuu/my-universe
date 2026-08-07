import * as THREE from 'three';
import type { CelestialLodRepresentation } from '../materials/celestial-visual-types';
import { DEFERRED_TEXTURE_SOURCE } from '../materials/planetary-textures';
import { createObjectVisualDiagnostics } from './object-visual-diagnostics';

describe('createObjectVisualDiagnostics', () => {
  it('décrit une représentation sans corps ni texture', () => {
    const visualRoot = new THREE.Group();
    const lod = createLod();

    visualRoot.visible = false;
    lod.nearRoot!.visible = false;

    expect(
      createObjectVisualDiagnostics({
        objectId: 'region',
        visualRoot,
        rotatingBody: null,
        lod,
      }),
    ).toEqual({
      objectId: 'region',
      bodyPresent: false,
      bodyVisible: false,
      visualVisible: false,
      nearVisible: false,
      nearBlend: 0,
      visibilityBlend: 0,
      opacity: 0,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      surfaceTexture: {
        requested: false,
        loaded: false,
        source: null,
        width: 0,
        height: 0,
      },
    });
  });

  it('lit la première matière et les dimensions de sa texture chargée', () => {
    const image = document.createElement('img');
    const texture = new THREE.Texture(image);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      opacity: 0.72,
      transparent: true,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(), [material]);
    const visualRoot = new THREE.Group();
    const lod = createLod();

    texture.userData[DEFERRED_TEXTURE_SOURCE] = 'textures/earth.jpg';
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 2048 },
      naturalHeight: { configurable: true, value: 1024 },
    });
    visualRoot.add(lod.nearRoot!, body);
    lod.nearRoot!.visible = true;
    lod.nearBlend = 0.8;
    lod.visibilityBlend = 0.9;
    lod.deferredTexturesRequested = true;

    expect(
      createObjectVisualDiagnostics({ objectId: 'earth', visualRoot, rotatingBody: body, lod }),
    ).toMatchObject({
      bodyPresent: true,
      bodyVisible: true,
      visualVisible: true,
      nearVisible: true,
      nearBlend: 0.8,
      visibilityBlend: 0.9,
      opacity: 0.72,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      surfaceTexture: {
        requested: true,
        loaded: true,
        source: 'textures/earth.jpg',
        width: 2048,
        height: 1024,
      },
    });
  });

  it('accepte une matière sans texture et une texture déjà demandée par son image', () => {
    const noTextureBody = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.ShaderMaterial());
    const image = document.createElement('img');
    const texture = new THREE.Texture(image);
    const texturedBody = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    const lod = createLod();

    expect(
      createObjectVisualDiagnostics({
        objectId: 'sun',
        visualRoot: new THREE.Group(),
        rotatingBody: noTextureBody,
        lod,
      }).surfaceTexture,
    ).toEqual({ requested: false, loaded: false, source: null, width: 0, height: 0 });

    image.setAttribute('src', 'textures/fallback.jpg');
    expect(
      createObjectVisualDiagnostics({
        objectId: 'fallback',
        visualRoot: new THREE.Group(),
        rotatingBody: texturedBody,
        lod,
      }).surfaceTexture,
    ).toMatchObject({
      requested: true,
      loaded: false,
      source: expect.stringContaining('textures/fallback.jpg'),
    });
  });

  it('tolère un tableau de matières vide', () => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(), []);

    expect(
      createObjectVisualDiagnostics({
        objectId: 'empty',
        visualRoot: new THREE.Group(),
        rotatingBody: body,
        lod: createLod(),
      }).opacity,
    ).toBe(0);
  });

  it('tolère une texture sans image et une représentation proche absente', () => {
    const texture = new THREE.Texture();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    const lod = createLod();

    lod.nearRoot = null;

    expect(
      createObjectVisualDiagnostics({
        objectId: 'texture-without-image',
        visualRoot: new THREE.Group(),
        rotatingBody: body,
        lod,
      }),
    ).toMatchObject({
      nearVisible: false,
      surfaceTexture: {
        requested: false,
        loaded: false,
        source: null,
        width: 0,
        height: 0,
      },
    });
  });
});

function createLod(): CelestialLodRepresentation {
  return {
    nearRoot: new THREE.Group(),
    farSprite: null,
    nearMaterials: [],
    deferredTextures: [],
    deferredTexturesRequested: false,
    nearBlend: 0,
    visibilityBlend: 0,
    farAlpha: 0,
    farBaseOpacity: 0,
    farBaseDiameter: 0,
    farAspectRatio: 1,
  };
}
