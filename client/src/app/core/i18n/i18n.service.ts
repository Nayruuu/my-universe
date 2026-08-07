import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import frContent from './locales/content.fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type AppContent = typeof frContent;

export const DEFAULT_LANGUAGE: AppLanguage = 'fr';

const LOCALES: Readonly<Record<AppLanguage, string>> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  ko: 'ko-KR',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

const CONTENT_LOADERS: Readonly<Record<AppLanguage, () => Promise<AppContent>>> = {
  fr: () => Promise.resolve(frContent),
  en: async () => (await import('./locales/content.en.json')).default,
  es: async () => (await import('./locales/content.es.json')).default,
  de: async () => (await import('./locales/content.de.json')).default,
  it: async () => (await import('./locales/content.it.json')).default,
  ko: async () => (await import('./locales/content.ko.json')).default,
  ja: async () => (await import('./locales/content.ja.json')).default,
  zh: async () => (await import('./locales/content.zh.json')).default,
};

const OBJECT_IDS_BY_FRENCH_NAME = new Map(
  Object.entries(frContent.objectNames).map(([objectId, name]) => [name, objectId]),
);

@Injectable({ providedIn: 'root' })
export class I18nService {
  public readonly lang = signal<AppLanguage>(
    languageFromPathname(window.location.pathname) ?? DEFAULT_LANGUAGE,
  );
  public readonly locale = computed(() => localeForLanguage(this.lang()));
  public readonly content: Signal<AppContent>;

  private readonly document = inject(DOCUMENT);
  private readonly activeContent = signal<AppContent>(frContent);
  private listening = false;
  private contentRequest = 0;

  constructor() {
    this.content = this.activeContent.asReadonly();
  }

  public start(): void {
    if (!languageFromPathname(window.location.pathname)) {
      this.lang.set(preferredLanguage(navigator.languages));
      this.syncDocumentLanguage();
      this.writeLocalizedUrl('replace');
    } else {
      this.syncDocumentLanguage();
    }
    void this.loadContent(this.lang());
    if (!this.listening) {
      window.addEventListener('popstate', this.handlePopState);
      this.listening = true;
    }
  }

  public stop(): void {
    if (this.listening) {
      window.removeEventListener('popstate', this.handlePopState);
      this.listening = false;
    }
  }

  public setLanguage(language: AppLanguage): Promise<void> {
    this.lang.set(language);
    this.syncDocumentLanguage();
    this.writeLocalizedUrl('push');

    return this.loadContent(language);
  }

  public formatNumber(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat(this.locale(), {
      maximumFractionDigits,
      notation: Math.abs(value) >= 1e9 ? 'scientific' : 'standard',
    }).format(value);
  }

  public objectName(objectId: string, fallback: string): string {
    const names = this.content().objectNames as Readonly<Record<string, string>>;

    return names[objectId] ?? fallback;
  }

  public localizeKnownObjectName(fallback: string): string {
    const objectId = OBJECT_IDS_BY_FRENCH_NAME.get(fallback);

    return objectId ? this.objectName(objectId, fallback) : fallback;
  }

  public objectSearchNames(objectId: string): readonly string[] {
    const name = this.objectName(objectId, '');

    return name ? [name] : [];
  }

  public interpolate(template: string, values: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, key: string) => {
      const value = values[key];

      return value === undefined ? placeholder : String(value);
    });
  }

  private readonly handlePopState = (): void => {
    const language = languageFromPathname(window.location.pathname);

    if (language) {
      this.lang.set(language);
      this.syncDocumentLanguage();
      void this.loadContent(language);
    }
  };

  private syncDocumentLanguage(): void {
    this.document.documentElement.lang = documentLanguage(this.lang());
  }

  private async loadContent(language: AppLanguage): Promise<void> {
    const request = ++this.contentRequest;
    const content = await CONTENT_LOADERS[language]();

    if (request === this.contentRequest && language === this.lang()) {
      this.activeContent.set(content);
    }
  }

  private writeLocalizedUrl(mode: 'push' | 'replace'): void {
    const url = new URL(window.location.href);
    const pathname = localizedPathname(url.pathname, this.lang());

    if (url.pathname === pathname) {
      return;
    }
    url.pathname = pathname;
    if (mode === 'replace') {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
  }
}

export function languageFromPathname(pathname: string): AppLanguage | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0];

  return isAppLanguage(firstSegment) ? firstSegment : null;
}

export function preferredLanguage(languages: readonly string[]): AppLanguage {
  for (const candidate of languages) {
    const language = candidate.toLocaleLowerCase().split('-')[0];

    if (isAppLanguage(language)) {
      return language;
    }
  }

  return DEFAULT_LANGUAGE;
}

export function localizedPathname(pathname: string, language: AppLanguage): string {
  const segments = pathname.split('/').filter(Boolean);

  if (isAppLanguage(segments[0])) {
    segments.shift();
  }
  const suffix = segments.length
    ? `/${segments.join('/')}${pathname.endsWith('/') ? '/' : ''}`
    : '/';

  return `/${language}${suffix}`;
}

export function isAppLanguage(value: string | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function documentLanguage(language: AppLanguage): string {
  return language === 'zh' ? 'zh-Hans' : language;
}

export function localeForLanguage(language: AppLanguage): string {
  return LOCALES[language];
}
