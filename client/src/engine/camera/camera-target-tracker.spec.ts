import * as THREE from 'three';
import type { Mock } from 'vitest';
import {
  CameraTargetTracker,
  type CameraTargetControls,
  type CameraTransitionRetargeter,
  type CameraZoomAnchorRetargeter,
} from './camera-target-tracker';

describe('CameraTargetTracker', () => {
  let camera: THREE.PerspectiveCamera;
  let controls: CameraTargetControls;
  let transitionRetarget: Mock<(position: THREE.Vector3) => boolean>;
  let zoomRetarget: Mock<(position: THREE.Vector3) => boolean>;
  let tracker: CameraTargetTracker;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 24);
    controls = { target: new THREE.Vector3() };
    transitionRetarget = vi.fn(() => false);
    zoomRetarget = vi.fn(() => false);
    const transition: CameraTransitionRetargeter = { retarget: transitionRetarget };
    const zoom: CameraZoomAnchorRetargeter = { retargetAnchor: zoomRetarget };

    tracker = new CameraTargetTracker(camera, controls, transition, zoom);
  });

  it('donne la priorité à une transition puis à une ancre de zoom', () => {
    const transitionTarget = new THREE.Vector3(4, 1, 0);

    transitionRetarget.mockReturnValueOnce(true);
    tracker.follow(transitionTarget);
    expect(transitionRetarget).toHaveBeenCalledWith(transitionTarget);
    expect(zoomRetarget).not.toHaveBeenCalled();
    expect(controls.target).toEqual(new THREE.Vector3());

    const zoomTarget = new THREE.Vector3(8, 2, 0);

    zoomRetarget.mockReturnValueOnce(true);
    tracker.follow(zoomTarget);
    expect(zoomRetarget).toHaveBeenCalledWith(zoomTarget);
    expect(controls.target).toEqual(new THREE.Vector3());
  });

  it('déplace la caméra et sa cible ensemble en suivi libre', () => {
    const target = new THREE.Vector3(8, 1, -2);
    const cameraOffset = camera.position.clone().sub(controls.target);

    tracker.follow(target);

    expect(controls.target).toEqual(target);
    expect(camera.position).toEqual(target.clone().add(cameraOffset));

    tracker.follow(target);
    expect(camera.position).toEqual(target.clone().add(cameraOffset));
  });

  it('préserve un cadrage décentré pendant le suivi et le floating origin', () => {
    const trackedPosition = new THREE.Vector3(10, 2, -1);

    controls.target.set(3, 0.5, 1);
    camera.position.set(3, 0.5, 15);
    tracker.track(trackedPosition);
    tracker.follow(trackedPosition);
    expect(controls.target).toEqual(new THREE.Vector3(3, 0.5, 1));

    const movement = new THREE.Vector3(1, -0.5, 2);

    tracker.follow(trackedPosition.clone().add(movement));
    expect(controls.target).toEqual(new THREE.Vector3(4, 0, 3));
    expect(camera.position).toEqual(new THREE.Vector3(4, 0, 17));

    const originShift = new THREE.Vector3(6, 1, -3);

    camera.position.sub(originShift);
    controls.target.sub(originShift);
    tracker.shift(originShift);
    tracker.follow(trackedPosition.clone().add(movement).sub(originShift));

    expect(controls.target).toEqual(new THREE.Vector3(-2, -1, 6));
    expect(camera.position).toEqual(new THREE.Vector3(-2, -1, 20));
  });

  it('rebase la cible sans modifier le cadrage et peut libérer le suivi', () => {
    const offset = camera.position.clone().sub(controls.target);
    const position = new THREE.Vector3(20, -3, 5);

    tracker.rebase(position);
    expect(controls.target).toEqual(position);
    expect(camera.position).toEqual(position.clone().add(offset));

    tracker.track(position);
    tracker.release();
    tracker.follow(position.clone().addScalar(1));
    expect(controls.target).toEqual(position.clone().addScalar(1));
  });

  it('réinitialise explicitement la position suivie', () => {
    const position = new THREE.Vector3(3, 4, 5);

    tracker.reset(position);
    tracker.follow(position);

    expect(controls.target).toEqual(position);
    expect(camera.position).toEqual(new THREE.Vector3(3, 4, 29));
  });
});
