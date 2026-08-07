import { measureTempelFilamentInstallation } from './tempel-filament-installation-performance';

describe('measureTempelFilamentInstallation', () => {
  it('sépare la préparation des géométries de leur insertion dans la scène', () => {
    const events: string[] = [];
    const batch = { id: 'tempel-batch' };
    const result = measureTempelFilamentInstallation(
      () => {
        events.push('prepare');

        return batch;
      },
      (preparedBatch) => {
        events.push(`install:${preparedBatch.id}`);
      },
      clock(10, 26, 29),
    );

    expect(result).toEqual({
      value: batch,
      metrics: {
        geometryPreparationMs: 16,
        sceneInstallationMs: 3,
      },
    });
    expect(events).toEqual(['prepare', 'install:tempel-batch']);
  });
});

function clock(...values: number[]): () => number {
  return () => values.shift()!;
}
