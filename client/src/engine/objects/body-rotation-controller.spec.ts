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

  it('oriente tous les corps à la date scientifique demandée, même à grande vitesse', () => {
    const controller = new BodyRotationController();
    const earth = rotatingEntry('earth');
    const mars = rotatingEntry('mars');
    const moon = rotatingEntry('moon');
    const phobos = rotatingEntry('phobos');
    const mercury = rotatingEntry('mercury');
    const venus = rotatingEntry('venus');
    const scientificTime = { julianDay: 2_451_545 };
    const updateEntry = vi.spyOn(controller, 'updateEntry');

    controller.update([earth, mars, moon, phobos, mercury, venus], scientificTime);

    expect(updateEntry).toHaveBeenCalledWith(earth, scientificTime);
    expect(updateEntry).toHaveBeenCalledWith(mars, scientificTime);
    expect(updateEntry).toHaveBeenCalledWith(phobos, scientificTime);
    expect(updateEntry).toHaveBeenCalledWith(moon, scientificTime);
    expect(updateEntry).toHaveBeenCalledWith(mercury, scientificTime);
    expect(updateEntry).toHaveBeenCalledWith(venus, scientificTime);
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
  const periodHours: Readonly<Record<string, number>> = {
    earth: 23.934,
    mars: 24.623,
    moon: 655.72,
    phobos: 7.6538,
    mercury: 1_407.51,
    venus: 5_832.44,
  };

  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    rotation: {
      siderealPeriodHours: periodHours[id] ?? 24,
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
