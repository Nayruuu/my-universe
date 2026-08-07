import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SITE_URL = 'https://super-universe.app/fr/';
const LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh'];
const HREFLANGS = {
  fr: 'fr',
  en: 'en',
  es: 'es',
  de: 'de',
  it: 'it',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh-Hans',
};
const APPLICATION_ICONS = [
  {
    src: '/icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: '/icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
];

test('publishes consistent canonical and social metadata', async () => {
  const html = await readProjectFile('src/index.html');

  assert.match(html, /<html lang="fr">/u);
  assert.match(
    html,
    /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"\s+\/>/u,
  );
  assert.match(html, /<meta name="author" content="Nayruuu" \/>/u);
  assert.match(html, /<link rel="author" href="https:\/\/super-dev\.app" \/>/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/super-universe\.app\/fr\/" \/>/u);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large" \/>/u);
  assert.match(html, /property="og:url" content="https:\/\/super-universe\.app\/fr\/"/u);
  assert.match(html, /property="og:image:width" content="1200"/u);
  assert.match(html, /property="og:image:height" content="630"/u);
  assert.match(html, /name="twitter:card" content="summary_large_image"/u);
  assert.match(html, /href="\/icons\/universe-map-icon\.svg"/u);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180"/u);
  for (const language of LANGUAGES) {
    assert.match(
      html,
      new RegExp(
        `<link rel="alternate" hreflang="${HREFLANGS[language]}" href="https://super-universe\\.app/${language}/" />`,
        'u',
      ),
    );
  }
  assert.match(html, /hreflang="x-default" href="https:\/\/super-universe\.app\/fr\/"/u);
});

test('exposes valid WebApplication structured data', async () => {
  const html = await readProjectFile('src/index.html');
  const script = html.match(
    /<script id="app-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/u,
  );

  assert.ok(script?.[1], 'The JSON-LD script must be present.');
  const structuredData = JSON.parse(script[1]);

  assert.equal(structuredData['@context'], 'https://schema.org');
  const application = structuredData['@graph'][1];

  assert.equal(application['@type'], 'WebApplication');
  assert.equal(application.url, SITE_URL);
  assert.equal(application.isAccessibleForFree, true);
  assert.equal(application.inLanguage, 'fr-FR');
  assert.deepEqual(application.creator, { '@id': 'https://super-dev.app/#creator' });
  assert.deepEqual(application.offers, {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  });
  assert.deepEqual(structuredData['@graph'][2], {
    '@type': 'Person',
    '@id': 'https://super-dev.app/#creator',
    name: 'Nayruuu',
    url: 'https://super-dev.app',
    sameAs: ['https://github.com/Nayruuu', 'https://buymeacoffee.com/nayruuu'],
  });
});

test('keeps crawler and localized install metadata on the production origin', async () => {
  const [robots, sitemap, ...manifestSources] = await Promise.all([
    readProjectFile('public/robots.txt'),
    readProjectFile('public/sitemap.xml'),
    ...LANGUAGES.map((language) => readProjectFile(`public/site.${language}.webmanifest`)),
  ]);

  assert.match(robots, /Allow: \//u);
  assert.match(robots, /Sitemap: https:\/\/super-universe\.app\/sitemap\.xml/u);
  assert.match(robots, /Sitemap: https:\/\/super-universe\.app\/guide\/sitemap\.xml/u);
  for (const language of LANGUAGES) {
    assert.match(sitemap, new RegExp(`<loc>https://super-universe\\.app/${language}/</loc>`, 'u'));
    assert.match(sitemap, new RegExp(`hreflang="${HREFLANGS[language]}"`, 'u'));
  }
  assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/u);
  for (const [index, language] of LANGUAGES.entries()) {
    const manifest = JSON.parse(manifestSources[index]);

    assert.match(manifest.name, /Super Universe/u);
    assert.equal(manifest.start_url, `/${language}/`);
    assert.equal(manifest.scope, '/');
    assert.match(manifest.lang, new RegExp(`^${language}(?:-|$)`, 'u'));
    assert.deepEqual(manifest.icons, APPLICATION_ICONS);
  }
});

test('ships the Universe Map browser, home-screen, and install icons', async () => {
  const [source, icon192, icon512, appleTouchIcon, favicon] = await Promise.all([
    readProjectFile('public/icons/universe-map-icon.svg'),
    readProjectBinary('public/icons/icon-192.png'),
    readProjectBinary('public/icons/icon-512.png'),
    readProjectBinary('public/apple-touch-icon.png'),
    readProjectBinary('public/favicon.ico'),
  ]);

  assert.match(source, /<title id="title">Universe Map<\/title>/u);
  assert.deepEqual(pngDimensions(icon192), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions(icon512), { width: 512, height: 512 });
  assert.deepEqual(pngDimensions(appleTouchIcon), { width: 180, height: 180 });
  assert.deepEqual([...favicon.subarray(0, 4)], [0, 0, 1, 0]);
  assert.equal(favicon.readUInt16LE(4), 1);
});

test('ships the declared 1200 by 630 social preview', async () => {
  const image = await readFile(new URL('../public/og/universe-map-social.png', import.meta.url));

  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(image.readUInt32BE(16), 1_200);
  assert.equal(image.readUInt32BE(20), 630);
});

async function readProjectFile(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function readProjectBinary(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url));
}

function pngDimensions(image) {
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}
