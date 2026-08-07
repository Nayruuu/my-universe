import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createStructuredData,
  renderLocalizedSeo,
  SUPPORTED_LANGUAGES,
} from './generate-localized-seo.mjs';

const fixture = `<!doctype html>
<html lang="fr"><head>
<title>French title</title>
<meta name="description" content="French description">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="https://super-universe.app/fr/">
<meta property="og:title" content="French title">
<meta property="og:description" content="French social description">
<meta property="og:image:alt" content="French image">
<meta name="twitter:title" content="French title">
<meta name="twitter:description" content="French social description">
<meta name="twitter:image:alt" content="French image">
<link rel="canonical" href="https://super-universe.app/fr/">
<link rel="manifest" href="/site.fr.webmanifest">
<!-- og-locale-alternates:start --><meta property="og:locale:alternate" content="en_US"><!-- og-locale-alternates:end -->
<script id="app-jsonld" type="application/ld+json">{}</script>
</head><body><h1 id="seo-fallback-title">French heading</h1><p id="seo-fallback-description">French fallback</p></body></html>`;

const englishSeo = {
  title: 'Super Universe — Interactive 3D Universe Map',
  description: 'Explore stars & galaxies.',
  socialDescription: 'Explore the Universe in 3D.',
  imageAlt: '3D view of the Milky Way',
  heading: 'Super Universe, an interactive 3D map of the Universe',
  features: ['Continuous navigation', 'Scientific data'],
};

test('renders one crawlable document per supported language', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh']);
  const html = renderLocalizedSeo(fixture, 'en', englishSeo);

  assert.match(html, /<html lang="en">/u);
  assert.match(html, /<title>Super Universe — Interactive 3D Universe Map<\/title>/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/super-universe\.app\/en\/">/u);
  assert.match(html, /content="Explore stars &amp; galaxies\."/u);
  assert.match(html, /property="og:locale" content="en_US"/u);
  assert.match(html, /property="og:url" content="https:\/\/super-universe\.app\/en\/"/u);
  assert.match(html, /rel="manifest" href="\/site\.en\.webmanifest"/u);
  assert.match(html, /id="seo-fallback-title">Super Universe, an interactive 3D map/u);
  assert.match(html, /id="seo-fallback-description">Explore stars &amp; galaxies\./u);
  assert.doesNotMatch(html, /og:locale:alternate" content="en_US"/u);
  assert.match(html, /og:locale:alternate" content="fr_FR"/u);
});

test('embeds localized WebSite and WebApplication structured data', () => {
  const html = renderLocalizedSeo(fixture, 'en', englishSeo);
  const json = html.match(/<script id="app-jsonld" type="application\/ld\+json">(.*?)<\/script>/u);

  assert.ok(json?.[1]);
  const structuredData = JSON.parse(json[1]);
  const application = structuredData['@graph'][1];

  assert.equal(application.url, 'https://super-universe.app/en/');
  assert.equal(application.inLanguage, 'en-US');
  assert.equal(application.isAccessibleForFree, true);
  assert.deepEqual(application.featureList, englishSeo.features);
  assert.deepEqual(application.creator, { '@id': 'https://super-dev.app/#creator' });
  assert.equal(application.offers.price, '0');
  assert.deepEqual(structuredData['@graph'][2], {
    '@type': 'Person',
    '@id': 'https://super-dev.app/#creator',
    name: 'Nayruuu',
    url: 'https://super-dev.app',
    sameAs: ['https://github.com/Nayruuu', 'https://buymeacoffee.com/nayruuu'],
  });
});

test('uses the Simplified Chinese SEO language tags on the Chinese route', () => {
  const html = renderLocalizedSeo(fixture, 'zh', englishSeo);
  const json = html.match(/<script id="app-jsonld" type="application\/ld\+json">(.*?)<\/script>/u);

  assert.match(html, /<html lang="zh-Hans">/u);
  assert.match(html, /property="og:locale" content="zh_CN"/u);
  assert.ok(json?.[1]);
  assert.equal(JSON.parse(json[1])['@graph'][1].inLanguage, 'zh-CN');
});

test('rejects unknown languages and incomplete build documents', () => {
  assert.throws(() => createStructuredData('pt', englishSeo), /Unsupported language/u);
  assert.throws(() => renderLocalizedSeo('<html lang="fr"></html>', 'fr', englishSeo));
});

test('keeps every locale catalog structurally aligned', async () => {
  const catalogs = await Promise.all(
    SUPPORTED_LANGUAGES.map(async (language) =>
      JSON.parse(
        await readFile(
          new URL(`../src/app/core/i18n/locales/content.${language}.json`, import.meta.url),
          'utf8',
        ),
      ),
    ),
  );
  const reference = flattenKeys(catalogs[0]);

  for (const catalog of catalogs.slice(1)) {
    assert.deepEqual(flattenKeys(catalog), reference);
  }
});

function flattenKeys(value, prefix = '') {
  if (Array.isArray(value)) {
    return [prefix];
  }
  if (value === null || typeof value !== 'object') {
    return [prefix];
  }

  return Object.keys(value)
    .sort()
    .flatMap((key) => flattenKeys(value[key], prefix ? `${prefix}.${key}` : key));
}
