import { expect, test } from '@playwright/test';
import { readCometActivityVisualState } from './support/comet-activity-helpers';
import { monitorBrowserErrors, openUniverse, universeUrl } from './universe-test-helpers';

const COMET_ID = '67p-churyumov-gerasimenko';

test('67P active sa coma et ses queues près du périhélie, à l’opposé du Soleil', async ({
  page,
}) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: COMET_ID,
      selected: COMET_ID,
      time: '2015-08-13T12:00:00.000Z',
      quality: 'high',
      zoom: '3.2',
    }),
  );

  await expect(
    page.getByRole('complementary', { name: 'Informations sur l’objet sélectionné' }),
  ).toContainText('coma et queues illustratives');
  await expect
    .poll(() => readCometActivityVisualState(page, COMET_ID))
    .toMatchObject({ present: true, active: true, rendered: true });
  const active = await readCometActivityVisualState(page, COMET_ID);

  expect(active.antiSolarAlignment).toBeGreaterThan(0.999);
  expect(active.comaOpacity).toBeGreaterThan(0.3);
  expect(active.dustTailOpacity).toBeGreaterThan(0.15);
  expect(active.ionTailOpacity).toBeGreaterThan(0.1);
  expect(browserErrors).toEqual([]);
});

test('67P redevient un noyau sans queue près de l’aphélie', async ({ page }) => {
  await openUniverse(
    page,
    universeUrl({
      target: COMET_ID,
      selected: COMET_ID,
      time: '2019-02-02T12:00:00.000Z',
      quality: 'low',
      zoom: '3.2',
    }),
  );

  await expect
    .poll(() => readCometActivityVisualState(page, COMET_ID))
    .toMatchObject({ present: true, active: false, rendered: false });
});
