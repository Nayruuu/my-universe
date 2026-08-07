import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh'];

const SITE_ORIGIN = 'https://super-universe.app';
const SOCIAL_IMAGE = `${SITE_ORIGIN}/og/universe-map-social.png`;
const CREATOR_NAME = 'Nayruuu';
const CREATOR_URL = 'https://super-dev.app';
const CREATOR_ID = `${CREATOR_URL}/#creator`;
const CREATOR_PROFILES = ['https://github.com/Nayruuu', 'https://buymeacoffee.com/nayruuu'];
const LANGUAGE_TAGS = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  ko: 'ko-KR',
  ja: 'ja-JP',
  zh: 'zh-CN',
};
const DOCUMENT_LANGUAGES = {
  fr: 'fr',
  en: 'en',
  es: 'es',
  de: 'de',
  it: 'it',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh-Hans',
};
const OG_LOCALES = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  ko: 'ko_KR',
  ja: 'ja_JP',
  zh: 'zh_CN',
};

export function renderLocalizedSeo(html, language, seo) {
  assertLanguage(language);
  const localizedUrl = `${SITE_ORIGIN}/${language}/`;
  let output = html.replace(
    /<html\b([^>]*)\blang="[^"]*"([^>]*)>/u,
    `<html$1lang="${DOCUMENT_LANGUAGES[language]}"$2>`,
  );

  output = output.replace(/<title>[\s\S]*?<\/title>/u, `<title>${escapeHtml(seo.title)}</title>`);
  output = replaceMeta(output, 'name', 'description', seo.description);
  output = replaceMeta(output, 'property', 'og:locale', OG_LOCALES[language]);
  output = replaceMeta(output, 'property', 'og:url', localizedUrl);
  output = replaceMeta(output, 'property', 'og:title', seo.title);
  output = replaceMeta(output, 'property', 'og:description', seo.socialDescription);
  output = replaceMeta(output, 'property', 'og:image:alt', seo.imageAlt);
  output = replaceMeta(output, 'name', 'twitter:title', seo.title);
  output = replaceMeta(output, 'name', 'twitter:description', seo.socialDescription);
  output = replaceMeta(output, 'name', 'twitter:image:alt', seo.imageAlt);
  output = replaceElementText(output, 'seo-fallback-title', seo.heading);
  output = replaceElementText(output, 'seo-fallback-description', seo.description);
  output = output.replace(
    /<link\b[^>]*\brel="canonical"[^>]*>/u,
    `<link rel="canonical" href="${localizedUrl}">`,
  );
  output = output.replace(
    /<link\b[^>]*\brel="manifest"[^>]*>/u,
    `<link rel="manifest" href="/site.${language}.webmanifest">`,
  );
  output = replaceOpenGraphAlternates(output, language);
  output = replaceJsonLd(output, createStructuredData(language, seo));

  return output;
}

function replaceElementText(html, id, text) {
  const pattern = new RegExp(`(<[^>]+\\bid="${id}"[^>]*>)[\\s\\S]*?(<\\/[^>]+>)`, 'u');

  if (!pattern.test(html)) {
    throw new Error(`Missing SEO fallback element: ${id}`);
  }

  return html.replace(pattern, `$1${escapeHtml(text)}$2`);
}

function replaceOpenGraphAlternates(html, language) {
  const pattern = /<!-- og-locale-alternates:start -->[\s\S]*?<!-- og-locale-alternates:end -->/u;
  const tags = SUPPORTED_LANGUAGES.filter((alternate) => alternate !== language)
    .map((alternate) => `<meta property="og:locale:alternate" content="${OG_LOCALES[alternate]}">`)
    .join('');

  if (!pattern.test(html)) {
    throw new Error('Missing Open Graph locale alternate block.');
  }

  return html.replace(
    pattern,
    `<!-- og-locale-alternates:start -->${tags}<!-- og-locale-alternates:end -->`,
  );
}

export function createStructuredData(language, seo) {
  assertLanguage(language);
  const localizedUrl = `${SITE_ORIGIN}/${language}/`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: 'Super Universe',
        alternateName: 'Universe Map',
        inLanguage: SUPPORTED_LANGUAGES,
        creator: { '@id': CREATOR_ID },
      },
      {
        '@type': 'WebApplication',
        '@id': `${localizedUrl}#application`,
        url: localizedUrl,
        name: 'Universe Map',
        alternateName: 'Super Universe',
        description: seo.description,
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Astronomy',
        operatingSystem: 'Any',
        browserRequirements: 'JavaScript and WebGL 2',
        inLanguage: LANGUAGE_TAGS[language],
        isAccessibleForFree: true,
        isFamilyFriendly: true,
        image: SOCIAL_IMAGE,
        featureList: seo.features,
        creator: { '@id': CREATOR_ID },
        codeRepository: 'https://github.com/Nayruuu/my-universe',
        license: 'https://opensource.org/licenses/MIT',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
      },
      {
        '@type': 'Person',
        '@id': CREATOR_ID,
        name: CREATOR_NAME,
        url: CREATOR_URL,
        sameAs: CREATOR_PROFILES,
      },
    ],
  };
}

async function generateLocalizedPages() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputRoot = resolve(projectRoot, 'dist/universe-map/browser');
  const html = await readFile(resolve(outputRoot, 'index.html'), 'utf8');

  for (const language of SUPPORTED_LANGUAGES) {
    const source = await readFile(
      resolve(projectRoot, `src/app/core/i18n/locales/content.${language}.json`),
      'utf8',
    );
    const content = JSON.parse(source);
    const destination = resolve(outputRoot, language, 'index.html');

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, renderLocalizedSeo(html, language, content.seo));
  }
}

function replaceMeta(html, attribute, key, content) {
  const tagPattern = /<meta\b[^>]*>/gu;
  const identifier = `${attribute}="${key}"`;
  let found = false;
  const output = html.replace(tagPattern, (tag) => {
    if (!tag.includes(identifier)) {
      return tag;
    }
    found = true;

    return tag.replace(/\bcontent="[^"]*"/u, `content="${escapeHtml(content)}"`);
  });

  if (!found) {
    throw new Error(`Missing SEO meta tag: ${identifier}`);
  }

  return output;
}

function replaceJsonLd(html, value) {
  const scriptPattern = /<script\b[^>]*\bid="app-jsonld"[^>]*>[\s\S]*?<\/script>/u;

  if (!scriptPattern.test(html)) {
    throw new Error('Missing app-jsonld script.');
  }

  return html.replace(
    scriptPattern,
    `<script id="app-jsonld" type="application/ld+json">${JSON.stringify(value)}</script>`,
  );
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function assertLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateLocalizedPages();
}
