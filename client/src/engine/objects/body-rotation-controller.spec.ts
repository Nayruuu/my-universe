import * as THREE from 'three';
import { SpaceObject, UniverseTime } from '../../data/models/universe.models';
import { BodyRotationController, type RotatingObjectEntry } from './body-rotation-controller';

describe('BodyRotationController', () => {
  it('oriente un corps connu selon son pôle IAU à la date simulée', () => {
    const controller = new BodyRotationController();
    const uranus = rotatingEntry('uranus');

    controller.updateEntry(uranus, { julianDay: 2_451_545 });
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(uranus.rotatingBody!.quaternion);

    expect(north.x).toBeCloseTo(-0.21199958, 6);
    expect(north.y).toBeCloseTo(0.134363, 6);
    expect(north.z).toBeCloseTo(0.96798903, 6);
  });

  it('emploie une horloge terrestre distincte sans interrompre les autres corps', () => {
    const controller = new BodyRotationController();
    const earth = rotatingEntry('earth');
    const mars = rotatingEntry('mars');
    const time = { julianDay: 2_451_545 };
    const earthTime = { julianDay: 2_451_545.25 };
    const updateEntry = vi.spyOn(controller, 'updateEntry');

    controller.update([earth, mars], time, earthTime);

    expect(updateEntry).toHaveBeenCalledWith(earth, earthTime);
    expect(updateEntry).toHaveBeenCalledWith(mars, time);

    updateEntry.mockClear();
    controller.update([earth, mars], time, null);
    expect(updateEntry).not.toHaveBeenCalledWith(earth, expect.anything());
    expect(updateEntry).toHaveBeenCalledWith(mars, time);
  });

  it('ignore les entrées sans support visuel, définition ou modèle de rotation connu', () => {
    const controller = new BodyRotationController();
    const noVisual = rotatingEntry('mars', null);
    const noDefinition = rotatingEntry('mars');
    const unknownBody = rotatingEntry('unknown-body');

    delete noDefinition.definition.rotation;
    controller.updateEntry(noVisual, time());
    controller.updateEntry(noDefinition, time());
    controller.updateEntry(unknownBody, time());

    expect(noDefinition.rotatingBody?.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(unknownBody.rotatingBody?.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });
});

function rotatingEntry(
  id: string,
  rotatingBody: THREE.Object3D | null = new THREE.Group(),
): RotatingObjectEntry {
  return {
    definition: createObject(id),
    rotatingBody,
  };
}

function createObject(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    rotation: {
      siderealPeriodHours: 24,
      direction: 'prograde',
      bodyFixedFrame: id === 'earth' ? 'EARTH_GEOGRAPHIC' : `IAU_${id.toUpperCase()}`,
      orientationModel: id === 'earth' ? 'earth-geographic' : 'iau-wgccre-2015',
      scientificConfidence: 'calculated',
      source: 'NASA/JPL test fixture',
    },
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function time(): UniverseTime {
  return { julianDay: 2_451_545 };
}
