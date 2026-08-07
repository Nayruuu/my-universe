import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const GUIDE_ROOT = new URL('../docs/guide/', import.meta.url);
const ROOT_README = new URL('../../README.md', import.meta.url);
const PAGES = [
  '',
  'getting-started/',
  'navigation/',
  'time-and-eclipses/',
  'scientific-confidence/',
  'catalogues/',
  'performance-and-limits/',
  'developers/',
  'faq/',
  'about/',
];
const LOCALES = [
  { prefix: '', lang: 'en-US', hreflang: 'en' },
  { prefix: 'fr/', lang: 'fr-FR', hreflang: 'fr' },
  { prefix: 'es/', lang: 'es-ES', hreflang: 'es' },
  { prefix: 'de/', lang: 'de-DE', hreflang: 'de' },
  { prefix: 'it/', lang: 'it-IT', hreflang: 'it' },
  { prefix: 'ko/', lang: 'ko-KR', hreflang: 'ko' },
  { prefix: 'ja/', lang: 'ja-JP', hreflang: 'ja' },
  { prefix: 'zh/', lang: 'zh-Hans', hreflang: 'zh-Hans' },
];

test('ships complete titled guide pages in every supported language', async () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const route = `${locale.prefix}${page}`;
      const source = await readGuidePage(route);
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u);

      assert.ok(frontmatter?.[1], `${route || 'home'} must contain frontmatter.`);
      assert.match(frontmatter[1], /^title: .+$/mu, route || 'home');
      assert.match(frontmatter[1], /^description: .+$/mu, route || 'home');
      assert.ok(source.length > 500, `${route || 'home'} must contain useful documentation.`);
      if (page) {
        assert.match(source, /^# .+$/mu, `${route} must contain one visible H1.`);
      }
    }
  }
});

test('keeps every localized guide link inside a known translated route', async () => {
  const knownRoutes = new Set(
    LOCALES.flatMap(({ prefix }) => PAGES.map((page) => `/${prefix}${page}`)),
  );

  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const route = `${locale.prefix}${page}`;
      const source = await readGuidePage(route);
      const links = [...source.matchAll(/\[[^\]]+\]\((\/[^)#?]*\/?)(?:#[^)]+)?\)/gu)].map(
        (match) => match[1],
      );

      for (const link of links) {
        assert.ok(
          knownRoutes.has(link),
          `${route || 'home'} links to missing guide route ${link}.`,
        );
      }
    }
  }
});

test('credits the creator and exposes the portfolio and support links in every language', async () => {
  for (const locale of LOCALES) {
    const source = await readGuidePage(`${locale.prefix}about/`);

    assert.match(source, /Nayruuu/u);
    assert.match(source, /https:\/\/super-dev\.app/u);
    assert.match(source, /https:\/\/buymeacoffee\.com\/nayruuu/u);
  }
});

test('configures the guide locales, SEO subpath, and local search', async () => {
  const [config, robots, staticWebAppConfigSource] = await Promise.all([
    readFile(new URL('.vitepress/config.mts', GUIDE_ROOT), 'utf8'),
    readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
    readFile(new URL('../public/staticwebapp.config.json', import.meta.url), 'utf8'),
  ]);
  const staticWebAppConfig = JSON.parse(staticWebAppConfigSource);

  assert.match(config, /base: ['"]\/guide\/['"]/u);
  assert.match(config, /provider: ['"]local['"]/u);
  assert.match(config, /hostname: GUIDE_ORIGIN/u);
  assert.match(config, /['"]\/universe-map-mark\.svg['"]/u);
  assert.match(config, /icons\/universe-map-icon\.svg/u);
  assert.match(config, /rel: ['"]apple-touch-icon['"]/u);
  assert.match(config, /name: ['"]author['"], content: ['"]Nayruuu['"]/u);
  assert.match(config, /rel: ['"]author['"], href: ['"]https:\/\/super-dev\.app['"]/u);
  assert.match(config, /path\(['"]about['"]\)/u);
  for (const locale of LOCALES) {
    assert.ok(config.includes(`lang: '${locale.lang}'`), `${locale.lang} must be configured.`);
    assert.ok(
      config.includes(`hreflang: '${locale.hreflang}'`),
      `${locale.hreflang} must be configured.`,
    );
  }
  assert.match(robots, /https:\/\/super-universe\.app\/guide\/sitemap\.xml/u);
  assert.ok(staticWebAppConfig.navigationFallback.exclude.includes('/guide/*'));
  assert.deepEqual(staticWebAppConfig.routes[0], {
    route: '/guide',
    redirect: '/guide/',
    statusCode: 301,
  });
});

test('keeps the VitePress theme entry points versioned', async () => {
  await Promise.all([
    access(new URL('.vitepress/theme/index.ts', GUIDE_ROOT)),
    access(new URL('.vitepress/theme/custom.css', GUIDE_ROOT)),
    access(new URL('public/universe-map-mark.svg', GUIDE_ROOT)),
  ]);
});

test('documents the permanent scientific audit and its current scope', async () => {
  const readme = await readFile(ROOT_README, 'utf8');

  assert.match(readme, /npm run audit:science/);
  assert.match(readme, /361,748 scientific records/);
});

test('starts observable view with an Earth-sky locator use case', async () => {
  const readme = await readFile(ROOT_README, 'utf8');

  assert.match(readme, /locate Sirius from Earth/i);
  assert.match(readme, /altitude, azimuth, local horizon, location, and time/i);
});

function readGuidePage(route) {
  return readFile(new URL(`${route}index.md`, GUIDE_ROOT), 'utf8');
}
