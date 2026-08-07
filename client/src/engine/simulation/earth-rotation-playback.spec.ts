import { EarthRotationPlayback, MAX_EARTH_VISUAL_DAYS_PER_SECOND } from './earth-rotation-playback';

describe('stabilisation visuelle de la rotation terrestre', () => {
  it('conserve le temps exact jusqu’à une heure simulée par seconde', () => {
    const playback = new EarthRotationPlayback();
    const time = { julianDay: 2_461_250.5 };

    playback.reset(time);

    expect(playback.update(time, true, MAX_EARTH_VISUAL_DAYS_PER_SECOND, 0.5)).toEqual({
      mode: 'exact',
      time,
      forceUpdate: false,
    });
  });

  it('limite la rotation aux vitesses temporelles élevées', () => {
    const playback = new EarthRotationPlayback();
    const start = { julianDay: 2_461_250.5 };

    playback.reset(start);
    const update = playback.update({ julianDay: start.julianDay + 0.5 }, true, 1, 0.5);

    expect(update.mode).toBe('stabilized');
    expect(update.forceUpdate).toBe(false);
    expect(update.time.julianDay).toBeCloseTo(
      start.julianDay + MAX_EARTH_VISUAL_DAYS_PER_SECOND * 0.5,
      10,
    );
  });

  it('retrouve immédiatement le temps exact à la pause', () => {
    const playback = new EarthRotationPlayback();
    const start = { julianDay: 2_461_250.5 };
    const paused = { julianDay: start.julianDay + 1 };

    playback.reset(start);
    playback.update(paused, true, 1, 1);

    expect(playback.update(paused, false, 1, 0.016)).toEqual({
      mode: 'exact',
      time: paused,
      forceUpdate: true,
    });
  });

  it('respecte une lecture temporelle inversée', () => {
    const playback = new EarthRotationPlayback();
    const start = { julianDay: 2_461_250.5 };

    playback.reset(start);
    const update = playback.update({ julianDay: start.julianDay - 1 }, true, -1, 1);

    expect(update.time.julianDay).toBeCloseTo(
      start.julianDay - MAX_EARTH_VISUAL_DAYS_PER_SECOND,
      10,
    );
  });
});
