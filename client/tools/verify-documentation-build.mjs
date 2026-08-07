import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SITE_ORIGIN = 'https://super-universe.app';
const OUTPUT_ROOT = new URL('../dist/universe-map/browser/', import.meta.url);
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

const rootIndex = await readOutput('index.html');

assert.match(rootIndex, /<app-root>/u);

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const route = `${locale.prefix}${page}`;
    const html = await readOutput(`guide/${route}index.html`);
    const canonical = `${SITE_ORIGIN}/guide/${route}`;

    assert.ok(
      html.includes(`<html lang="${locale.lang}"`),
      `${route || 'guide home'} must use ${locale.lang}.`,
    );
    assert.ok(
      html.includes(`rel="canonical" href="${canonical}"`),
      `${canonical} is not canonical.`,
    );
    assert.ok(
      html.includes('name="author" content="Nayruuu"'),
      `${canonical} must identify its creator.`,
    );
    assert.ok(
      html.includes('rel="author" href="https://super-dev.app"'),
      `${canonical} must link the creator portfolio.`,
    );
    assert.match(
      html,
      /id="VPContent"/u,
      `${route || 'guide home'} must expose its content region.`,
    );
    assert.match(html, /<h1(?:\s|>)/u, `${route || 'guide home'} must expose a primary heading.`);
    assert.match(
      html,
      /src="\/guide\/universe-map-mark\.svg"/u,
      'The guide logo must use its base path.',
    );
    for (const alternate of LOCALES) {
      assert.ok(
        html.includes(`hreflang="${alternate.hreflang}"`),
        `${route || 'guide home'} must link ${alternate.hreflang}.`,
      );
    }
    assert.ok(html.includes('hreflang="x-default"'), `${route || 'guide home'} needs x-default.`);
  }
}

await readOutput('guide/universe-map-mark.svg');

const sitemap = await readOutput('guide/sitemap.xml');

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const route = `${locale.prefix}${page}`;

    assert.ok(
      sitemap.includes(`<loc>${SITE_ORIGIN}/guide/${route}</loc>`),
      `The guide sitemap is missing ${route || 'its home page'}.`,
    );
  }
}

const pageCount = PAGES.length * LOCALES.length;

console.log(
  `✓ documentation build: ${pageCount} localized pages, canonical URLs, hreflang, and sitemap verified`,
);

function readOutput(relativePath) {
  return readFile(new URL(relativePath, OUTPUT_ROOT), 'utf8');
}
