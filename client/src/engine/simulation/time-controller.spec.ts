import { TimeController } from './time-controller';

describe('TimeController', () => {
  it('avance selon la vitesse uniquement pendant la lecture', () => {
    const controller = new TimeController();

    expect(controller.speed).toBe(1);

    controller.setTime({ julianDay: 2_451_545 });
    controller.setSpeed(10);

    expect(controller.update(2)).toBe(false);
    controller.setPlaying(true);
    expect(controller.update(2)).toBe(true);
    expect(controller.currentTime.julianDay).toBe(2_451_565);
    expect(controller.speed).toBe(10);
    expect(controller.isPlaying).toBe(true);
  });

  it('renvoie une copie de l’état temporel', () => {
    const controller = new TimeController();

    controller.setTime({ julianDay: 123 });
    const snapshot = controller.currentTime;

    snapshot.julianDay = 456;

    expect(controller.currentTime.julianDay).toBe(123);
  });

  it('rejette les dates et vitesses non finies', () => {
    const controller = new TimeController();

    expect(() => controller.setTime({ julianDay: Number.NaN })).toThrow(
      'Le jour julien doit être un nombre fini.',
    );
    expect(() => controller.setSpeed(Number.POSITIVE_INFINITY)).toThrow(
      'La vitesse temporelle doit être un nombre fini.',
    );
  });
});
