import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('publie les métadonnées anglaises et toutes les alternatives linguistiques', async () => {
    const document = TestBed.inject(DOCUMENT);
    const i18n = TestBed.inject(I18nService);
    const service = TestBed.inject(SeoService);

    await i18n.setLanguage('en');
    service.update('en', i18n.content().seo);

    expect(document.title).toContain('Interactive 3D Universe Map');
    expect(meta(document, 'name', 'description')).toContain('Explore the Solar System');
    expect(meta(document, 'name', 'author')).toBe('Nayruuu');
    expect(meta(document, 'property', 'og:locale')).toBe('en_US');
    expect(meta(document, 'property', 'og:url')).toBe('https://super-universe.app/en/');
    expect(canonical(document)).toBe('https://super-universe.app/en/');
    expect(
      document.head.querySelector<HTMLLinkElement>("link[rel='manifest']")?.getAttribute('href'),
    ).toBe('/site.en.webmanifest');

    const alternates = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>("link[rel='alternate'][hreflang]"),
    );

    expect(alternates.map((link) => link.hreflang)).toEqual([
      'fr',
      'en',
      'es',
      'de',
      'it',
      'ko',
      'ja',
      'zh-Hans',
      'x-default',
    ]);
    expect(alternates.map((link) => link.href)).toEqual([
      'https://super-universe.app/fr/',
      'https://super-universe.app/en/',
      'https://super-universe.app/es/',
      'https://super-universe.app/de/',
      'https://super-universe.app/it/',
      'https://super-universe.app/ko/',
      'https://super-universe.app/ja/',
      'https://super-universe.app/zh/',
      'https://super-universe.app/fr/',
    ]);

    const jsonLd = JSON.parse(document.getElementById('app-jsonld')?.textContent ?? '{}') as {
      '@graph'?: Array<Record<string, unknown>>;
    };

    expect(jsonLd['@graph']?.[1]).toMatchObject({
      '@type': 'WebApplication',
      inLanguage: 'en-US',
      isAccessibleForFree: true,
      url: 'https://super-universe.app/en/',
      creator: { '@id': 'https://super-dev.app/#creator' },
    });
    expect(jsonLd['@graph']?.[2]).toMatchObject({
      '@type': 'Person',
      '@id': 'https://super-dev.app/#creator',
      name: 'Nayruuu',
      url: 'https://super-dev.app',
      sameAs: ['https://github.com/Nayruuu', 'https://buymeacoffee.com/nayruuu'],
    });
  });

  it('remplace les balises idempotemment lors d’un changement de langue', async () => {
    const document = TestBed.inject(DOCUMENT);
    const i18n = TestBed.inject(I18nService);
    const service = TestBed.inject(SeoService);

    service.update('fr', i18n.content().seo);
    await i18n.setLanguage('de');
    service.update('de', i18n.content().seo);

    expect(canonical(document)).toBe('https://super-universe.app/de/');
    expect(document.head.querySelectorAll("link[rel='canonical']")).toHaveLength(1);
    expect(document.head.querySelectorAll("link[rel='manifest']")).toHaveLength(1);
    expect(document.head.querySelectorAll("link[rel='alternate'][hreflang]")).toHaveLength(9);
    expect(document.head.querySelectorAll("meta[property='og:locale:alternate']")).toHaveLength(7);
    expect(document.head.querySelectorAll('#app-jsonld')).toHaveLength(1);
  });

  it('publie le chinois simplifié avec les balises linguistiques normalisées', async () => {
    const document = TestBed.inject(DOCUMENT);
    const i18n = TestBed.inject(I18nService);
    const service = TestBed.inject(SeoService);

    await i18n.setLanguage('zh');
    service.update('zh', i18n.content().seo);

    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(meta(document, 'property', 'og:locale')).toBe('zh_CN');
    expect(canonical(document)).toBe('https://super-universe.app/zh/');
    expect(
      document.head.querySelector<HTMLLinkElement>("link[rel='manifest']")?.getAttribute('href'),
    ).toBe('/site.zh.webmanifest');
    const jsonLd = JSON.parse(document.getElementById('app-jsonld')?.textContent ?? '{}') as {
      '@graph'?: Array<Record<string, unknown>>;
    };

    expect(jsonLd['@graph']?.[1]).toMatchObject({ inLanguage: 'zh-CN' });
  });
});

function meta(document: Document, attribute: 'name' | 'property', value: string): string | null {
  return (
    document.head
      .querySelector<HTMLMetaElement>(`meta[${attribute}='${value}']`)
      ?.getAttribute('content') ?? null
  );
}

function canonical(document: Document): string | null {
  return document.head.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href ?? null;
}
