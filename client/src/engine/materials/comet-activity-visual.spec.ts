import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { createCometActivityVisual } from './comet-activity-visual';
import type { ManagedLodMaterial } from './celestial-visual-types';

describe('CometActivityVisual', () => {
  it('compose une coma et deux queues qualitatives orientées à l’opposé du Soleil', () => {
    const materials: ManagedLodMaterial[] = [];
    const definition = comet();

    definition.visual.emissiveColor = '#9bd4ca';
    const visual = createCometActivityVisual(definition, 'high', new THREE.Texture(), materials);

    visual.updateAppearance(new THREE.Vector3(15, 0, 0), 1);

    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(visual.root.quaternion);
    const coma = visual.root.getObjectByName('halley-coma') as THREE.Sprite;
    const dustTail = visual.root.getObjectByName('halley-dust-tail') as THREE.Mesh<
      THREE.ConeGeometry,
      THREE.ShaderMaterial
    >;
    const ionTail = visual.root.getObjectByName('halley-ion-tail') as THREE.Mesh<
      THREE.ConeGeometry,
      THREE.ShaderMaterial
    >;

    expect(visual.root.visible).toBe(true);
    expect(direction.x).toBeCloseTo(1, 6);
    expect(direction.y).toBeCloseTo(0, 6);
    expect(coma).toBeInstanceOf(THREE.Sprite);
    expect(coma.scale.x).toBeGreaterThan(1);
    expect(dustTail).toBeInstanceOf(THREE.Mesh);
    expect(ionTail).toBeInstanceOf(THREE.Mesh);
    expect(dustTail.material.userData['scientificConfidence']).toBe('illustrative');
    expect(ionTail.material.userData['tailKind']).toBe('ion');
    expect(materials).toHaveLength(3);

    visual.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        child.material.dispose();
      }
    });
  });

  it('masque l’activité loin du Soleil et pour une direction indéfinie', () => {
    const visual = createCometActivityVisual(comet(), 'low', new THREE.Texture(), []);

    visual.updateAppearance(new THREE.Vector3(75, 0, 0), 5);
    expect(visual.root.visible).toBe(false);

    visual.updateAppearance(new THREE.Vector3(), 1);
    expect(visual.root.visible).toBe(false);
  });

  it('réduit le maillage sur les niveaux graphiques faibles', () => {
    const low = createCometActivityVisual(comet(), 'low', new THREE.Texture(), []);
    const oddDefinition = comet();

    oddDefinition.id = '67p';
    const high = createCometActivityVisual(oddDefinition, 'high', new THREE.Texture(), []);
    const lowTail = low.root.getObjectByName('halley-dust-tail') as THREE.Mesh<THREE.ConeGeometry>;
    const highTail = high.root.getObjectByName('67p-dust-tail') as THREE.Mesh<THREE.ConeGeometry>;

    expect(lowTail.geometry.parameters.radialSegments).toBeLessThan(
      highTail.geometry.parameters.radialSegments,
    );
    expect(lowTail.rotation.z).toBeGreaterThan(0);
    expect(highTail.rotation.z).toBeLessThan(0);
  });

  it('refuse une comète sans profil d’activité', () => {
    const inactive = comet();

    delete inactive.cometActivity;
    expect(() => createCometActivityVisual(inactive, 'medium', new THREE.Texture(), [])).toThrow(
      'Activité cométaire absente',
    );
  });
});

function comet(): SpaceObject {
  return {
    id: 'halley',
    name: 'Comète de Halley',
    type: 'comet',
    parentId: 'sun',
    referenceFrame: 'solar-system',
    scientificConfidence: 'extrapolated',
    visual: {
      color: '#b8d9d2',
      visualRadius: 0.19,
      scaleMode: 'exaggerated',
    },
    cometActivity: {
      activationDistanceAu: 5,
      saturatedDistanceAu: 0.575,
      scientificConfidence: 'illustrative',
      source: 'NASA comet activity overview',
    },
    positionProvider: {
      type: 'static',
      position: [1, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
