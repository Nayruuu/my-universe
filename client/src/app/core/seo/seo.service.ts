import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  documentLanguage,
  localeForLanguage,
  type AppContent,
  type AppLanguage,
} from '../i18n/i18n.service';

const SITE_ORIGIN = 'https://super-universe.app';
const SITE_NAME = 'Super Universe';
const APPLICATION_NAME = 'Universe Map';
const SOCIAL_IMAGE = `${SITE_ORIGIN}/og/universe-map-social.png`;
const CREATOR_NAME = 'Nayruuu';
const CREATOR_URL = 'https://super-dev.app';
const CREATOR_ID = `${CREATOR_URL}/#creator`;
const CREATOR_PROFILES = [
  'https://github.com/Nayruuu',
  'https://buymeacoffee.com/nayruuu',
] as const;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private static readonly JSON_LD_ID = 'app-jsonld';

  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  public update(language: AppLanguage, seo: AppContent['seo']): void {
    const url = localizedUrl(language);

    this.document.documentElement.lang = documentLanguage(language);
    this.title.setTitle(seo.title);
    this.setName('description', seo.description);
    this.setName('author', CREATOR_NAME);
    this.setName('robots', 'index, follow, max-image-preview:large');

    this.setProperty('og:type', 'website');
    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:locale', openGraphLocale(language));
    this.setProperty('og:url', url);
    this.setProperty('og:title', seo.title);
    this.setProperty('og:description', seo.socialDescription);
    this.setProperty('og:image', SOCIAL_IMAGE);
    this.setProperty('og:image:alt', seo.imageAlt);

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', seo.title);
    this.setName('twitter:description', seo.socialDescription);
    this.setName('twitter:image', SOCIAL_IMAGE);
    this.setName('twitter:image:alt', seo.imageAlt);

    this.setCanonical(url);
    this.setManifest(language);
    this.setLanguageAlternates();
    this.setOpenGraphLocaleAlternates(language);
    this.setJsonLd(language, seo);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>("link[rel='canonical']");

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = href;
  }

  private setManifest(language: AppLanguage): void {
    let link = this.document.head.querySelector<HTMLLinkElement>("link[rel='manifest']");

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'manifest';
      this.document.head.appendChild(link);
    }
    link.href = `/site.${language}.webmanifest`;
  }

  private setLanguageAlternates(): void {
    this.document.head
      .querySelectorAll("link[rel='alternate'][hreflang]")
      .forEach((element) => element.remove());

    for (const language of SUPPORTED_LANGUAGES) {
      this.addLanguageAlternate(documentLanguage(language), localizedUrl(language));
    }
    this.addLanguageAlternate('x-default', localizedUrl(DEFAULT_LANGUAGE));
  }

  private addLanguageAlternate(hreflang: string, href: string): void {
    const link = this.document.createElement('link');

    link.rel = 'alternate';
    link.hreflang = hreflang;
    link.href = href;
    this.document.head.appendChild(link);
  }

  private setOpenGraphLocaleAlternates(language: AppLanguage): void {
    this.document.head
      .querySelectorAll("meta[property='og:locale:alternate']")
      .forEach((element) => element.remove());

    for (const alternate of SUPPORTED_LANGUAGES) {
      if (alternate !== language) {
        const meta = this.document.createElement('meta');

        meta.setAttribute('property', 'og:locale:alternate');
        meta.content = openGraphLocale(alternate);
        this.document.head.appendChild(meta);
      }
    }
  }

  private setJsonLd(language: AppLanguage, seo: AppContent['seo']): void {
    let script = this.document.getElementById(SeoService.JSON_LD_ID) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.id = SeoService.JSON_LD_ID;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${SITE_ORIGIN}/#website`,
          url: SITE_ORIGIN,
          name: SITE_NAME,
          alternateName: APPLICATION_NAME,
          inLanguage: [...SUPPORTED_LANGUAGES],
          creator: { '@id': CREATOR_ID },
        },
        {
          '@type': 'WebApplication',
          '@id': `${localizedUrl(language)}#application`,
          url: localizedUrl(language),
          name: APPLICATION_NAME,
          alternateName: SITE_NAME,
          description: seo.description,
          applicationCategory: 'EducationalApplication',
          applicationSubCategory: 'Astronomy',
          operatingSystem: 'Any',
          browserRequirements: 'JavaScript and WebGL 2',
          inLanguage: localeForLanguage(language),
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
          sameAs: [...CREATOR_PROFILES],
        },
      ],
    });
  }
}

function localizedUrl(language: AppLanguage): string {
  return `${SITE_ORIGIN}/${language}/`;
}

function openGraphLocale(language: AppLanguage): string {
  return localeForLanguage(language).replace('-', '_');
}
