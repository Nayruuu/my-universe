import { expect, type Locator, test } from '@playwright/test';
import { monitorBrowserErrors, openUniverse, universeUrl } from './universe-test-helpers';

interface LegibilityTarget {
  readonly name: string;
  readonly locator: Locator;
  readonly minimumFontSize: number;
  readonly minimumColorAlpha: number;
}

test('les textes structurants conservent une taille et un contraste lisibles', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: 'earth',
      zoom: '4.96',
      quality: 'high',
    }),
  );

  const targets: readonly LegibilityTarget[] = [
    {
      name: "l'indicateur d'échelle",
      locator: page.locator('.scale-indicator'),
      minimumFontSize: 10,
      minimumColorAlpha: 0.68,
    },
    {
      name: "le fil d'Ariane",
      locator: page.locator('.astronomical-breadcrumb button').first(),
      minimumFontSize: 10,
      minimumColorAlpha: 0.62,
    },
    {
      name: "le type d'objet",
      locator: page.locator('.details .eyebrow'),
      minimumFontSize: 11,
      minimumColorAlpha: 0.68,
    },
    {
      name: "la description de l'objet",
      locator: page.locator('.details .description'),
      minimumFontSize: 13,
      minimumColorAlpha: 0.8,
    },
    {
      name: 'un intitulé scientifique',
      locator: page.locator('.details .facts dt').first(),
      minimumFontSize: 10,
      minimumColorAlpha: 0.62,
    },
    {
      name: 'une valeur scientifique',
      locator: page.locator('.details .facts dd').first(),
      minimumFontSize: 12,
      minimumColorAlpha: 0.86,
    },
    {
      name: 'la provenance scientifique',
      locator: page.locator('.details__source strong').first(),
      minimumFontSize: 11,
      minimumColorAlpha: 0.7,
    },
    {
      name: 'la date principale',
      locator: page.locator('.date-heading strong'),
      minimumFontSize: 13,
      minimumColorAlpha: 0.9,
    },
    {
      name: 'le jour julien',
      locator: page.locator('.date-heading span'),
      minimumFontSize: 10,
      minimumColorAlpha: 0.6,
    },
    {
      name: 'le bouton des événements',
      locator: page.locator('.events-button'),
      minimumFontSize: 11,
      minimumColorAlpha: 0.7,
    },
    {
      name: 'un libellé temporel',
      locator: page.locator('.select-control > span').first(),
      minimumFontSize: 10,
      minimumColorAlpha: 0.62,
    },
    {
      name: 'un contrôle temporel',
      locator: page.locator('.select-control select').first(),
      minimumFontSize: 11,
      minimumColorAlpha: 0.82,
    },
    {
      name: 'la recherche',
      locator: page.locator('.search-shell input'),
      minimumFontSize: 15,
      minimumColorAlpha: 0.95,
    },
  ];

  for (const target of targets) {
    await expectLegible(target);
  }

  await page.locator('.events-button').click();
  await expect(page.locator('.eclipse-browser')).toBeVisible();

  const eclipseTargets: readonly LegibilityTarget[] = [
    {
      name: "le titre du navigateur d'éclipses",
      locator: page.locator('.eclipse-browser .eyebrow'),
      minimumFontSize: 10,
      minimumColorAlpha: 0.68,
    },
    {
      name: "l'introduction du navigateur d'éclipses",
      locator: page.locator('.eclipse-browser .introduction'),
      minimumFontSize: 11,
      minimumColorAlpha: 0.62,
    },
    {
      name: "la navigation du catalogue d'éclipses",
      locator: page.locator('.catalog-navigation button').first(),
      minimumFontSize: 11,
      minimumColorAlpha: 0.72,
    },
    {
      name: "le nom d'une éclipse",
      locator: page.locator('.event-card__content strong').first(),
      minimumFontSize: 12,
      minimumColorAlpha: 0.9,
    },
    {
      name: "la date d'une éclipse",
      locator: page.locator('.event-card__content time').first(),
      minimumFontSize: 11,
      minimumColorAlpha: 0.72,
    },
  ];

  for (const target of eclipseTargets) {
    await expectLegible(target);
  }

  expect(browserErrors).toEqual([]);
});

test('la hiérarchie mobile reste lisible sans superposer son échelle à la fiche', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: 'earth',
      zoom: '4.96',
      quality: 'medium',
    }),
  );

  const targets: readonly LegibilityTarget[] = [
    {
      name: 'la recherche mobile',
      locator: page.locator('.search-shell input'),
      minimumFontSize: 16,
      minimumColorAlpha: 0.95,
    },
    {
      name: "l'indicateur d'échelle mobile",
      locator: page.locator('.scale-indicator'),
      minimumFontSize: 10,
      minimumColorAlpha: 0.68,
    },
    {
      name: "le type d'objet mobile",
      locator: page.locator('.details .eyebrow'),
      minimumFontSize: 11,
      minimumColorAlpha: 0.68,
    },
    {
      name: "la description de l'objet mobile",
      locator: page.locator('.details .description'),
      minimumFontSize: 13,
      minimumColorAlpha: 0.8,
    },
    {
      name: 'la date mobile',
      locator: page.locator('.date-heading strong'),
      minimumFontSize: 12,
      minimumColorAlpha: 0.9,
    },
    {
      name: 'un contrôle temporel mobile',
      locator: page.locator('.select-control select').first(),
      minimumFontSize: 12,
      minimumColorAlpha: 0.82,
    },
  ];

  for (const target of targets) {
    await expectLegible(target);
  }

  await expect(page.locator('app-map-scale')).toBeHidden();
  expect(browserErrors).toEqual([]);
});

async function expectLegible(target: LegibilityTarget): Promise<void> {
  await expect(target.locator, target.name).toBeVisible();
  const style = await readLegibilityStyle(target.locator);

  expect(style.fontSize, `${target.name} est trop petit`).toBeGreaterThanOrEqual(
    target.minimumFontSize,
  );
  expect(style.colorAlpha, `${target.name} manque de contraste`).toBeGreaterThanOrEqual(
    target.minimumColorAlpha,
  );
}

async function readLegibilityStyle(locator: Locator): Promise<{
  readonly fontSize: number;
  readonly colorAlpha: number;
}> {
  const style = await locator.evaluate((element) => {
    const computed = getComputedStyle(element);

    return {
      color: computed.color,
      fontSize: Number.parseFloat(computed.fontSize),
    };
  });
  const channels = style.color.match(/[\d.]+/g)?.map(Number) ?? [];

  return {
    fontSize: style.fontSize,
    colorAlpha: channels.length === 4 ? (channels[3] ?? 1) : 1,
  };
}
