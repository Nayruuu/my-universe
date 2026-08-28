import {
  finishCatalogPreparation,
  prepareCatalogIncrementally,
  yieldCatalogPreparation,
  sortCatalogRecords,
  CATALOG_PREPARATION_CHUNK_SIZE,
} from './catalog-preparation';

describe('préparation coopérative des catalogues', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exécute les mêmes étapes synchrones ou espacées par des tâches navigateur', async () => {
    const order: string[] = [];

    function* prepare(): Generator<void, number> {
      order.push('first');
      yield;
      order.push('second');
      yield;
      order.push('done');

      return 42;
    }

    expect(finishCatalogPreparation(prepare())).toBe(42);
    expect(order).toEqual(['first', 'second', 'done']);
    order.length = 0;
    expect(
      await prepareCatalogIncrementally(prepare(), async () => {
        order.push('yield');
      }),
    ).toBe(42);
    expect(order).toEqual(['first', 'yield', 'second', 'yield', 'done']);
  });

  it('cesse de calculer lorsque la tâche est annulée pendant une pause', async () => {
    const resumed = vi.fn();

    function* prepare(): Generator<void, number> {
      yield;
      resumed();

      return 42;
    }
    const error = new Error('cancelled');

    await expect(prepareCatalogIncrementally(prepare(), () => Promise.reject(error))).rejects.toBe(
      error,
    );
    expect(resumed).not.toHaveBeenCalled();
  });

  it('garde un repli sans MessageChannel', async () => {
    vi.stubGlobal('MessageChannel', undefined);
    await yieldCatalogPreparation();
  });

  it('ferme les deux ports du repli MessageChannel sans temporisateur imbriqué', async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();

    class TestChannel {
      public readonly port1 = { onmessage: () => undefined, close: closeFirst };
      public readonly port2 = {
        postMessage: () => queueMicrotask(() => this.port1.onmessage()),
        close: closeSecond,
      };
    }

    vi.stubGlobal('MessageChannel', TestChannel);
    await yieldCatalogPreparation();
    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).toHaveBeenCalledOnce();
  });

  it.each([0, 7, 512, 513, 1024, 1025, 4097])(
    'trie %i entrées exactement comme le tri stable natif, avec des pauses bornées',
    async (count) => {
      const records = Array.from({ length: count }, (_, index) => ({
        index,
        rank: (index * 17) % 13,
      }));
      const compare = (left: { rank: number }, right: { rank: number }) => left.rank - right.rank;
      const expected = records.slice().sort(compare);
      const pause = vi.fn(async () => undefined);

      expect(finishCatalogPreparation(sortCatalogRecords(records.slice(), compare))).toEqual(
        expected,
      );
      expect(
        await prepareCatalogIncrementally(sortCatalogRecords(records.slice(), compare), pause),
      ).toEqual(expected);
      expect(pause.mock.calls.length > 0).toBe(count >= CATALOG_PREPARATION_CHUNK_SIZE);
    },
  );
});
