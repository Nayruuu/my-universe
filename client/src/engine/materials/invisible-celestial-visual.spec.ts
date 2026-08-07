import * as THREE from 'three';
import { createInvisibleCelestialVisual } from './invisible-celestial-visual';

describe('invisible celestial visual', () => {
  it('conserve le référentiel logique sans ajouter de géométrie', () => {
    const root = new THREE.Group();
    const visual = createInvisibleCelestialVisual(root);

    expect(visual.root).toBe(root);
    expect(root.children).toHaveLength(0);
    expect(visual.pickables).toHaveLength(0);
    expect(visual.rotatingBody).toBeNull();
    expect(visual.lod).toEqual({
      nearRoot: null,
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
    });
  });
});
