import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_LANGUAGE,
  I18nService,
  SUPPORTED_LANGUAGES,
  languageFromPathname,
  localizedPathname,
  preferredLanguage,
} from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/?target=earth#map');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    window.history.replaceState(null, '', '/fr/');
  });

  it('reconnaît les huit langues portées par les URL', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh']);
    expect(languageFromPathname('/fr/')).toBe('fr');
    expect(languageFromPathname('/en/')).toBe('en');
    expect(languageFromPathname('/es')).toBe('es');
    expect(languageFromPathname('/de/anything')).toBe('de');
    expect(languageFromPathname('/it/')).toBe('it');
    expect(languageFromPathname('/ko/')).toBe('ko');
    expect(languageFromPathname('/ja/')).toBe('ja');
    expect(languageFromPathname('/zh/')).toBe('zh');
    expect(languageFromPathname('/guide/')).toBeNull();
  });

  it('sélectionne une langue de navigateur prise en charge', () => {
    expect(preferredLanguage(['pt-BR', 'it-IT', 'de-DE'])).toBe('it');
    expect(preferredLanguage(['es-MX'])).toBe('es');
    expect(preferredLanguage(['ko-KR'])).toBe('ko');
    expect(preferredLanguage(['ja-JP'])).toBe('ja');
    expect(preferredLanguage(['zh-TW'])).toBe('zh');
    expect(preferredLanguage(['pt-BR'])).toBe(DEFAULT_LANGUAGE);
    expect(preferredLanguage([])).toBe(DEFAULT_LANGUAGE);
  });

  it('remplace uniquement le préfixe de langue', () => {
    expect(localizedPathname('/fr/', 'en')).toBe('/en/');
    expect(localizedPathname('/de/anything', 'es')).toBe('/es/anything');
    expect(localizedPathname('/fr/anything/', 'en')).toBe('/en/anything/');
    expect(localizedPathname('/', 'de')).toBe('/de/');
    expect(localizedPathname('/en/explore/', 'zh')).toBe('/zh/explore/');
  });

  it('détecte la langue du navigateur sur une URL historique sans préfixe', async () => {
    window.history.replaceState(null, '', '/?target=earth#map');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
    const service = TestBed.inject(I18nService);

    service.start();
    service.start();

    expect(service.lang()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(window.location.pathname).toBe('/de/');
    expect(window.location.search).toBe('?target=earth');
    expect(window.location.hash).toBe('#map');
    await vi.waitFor(() => expect(service.content().seo.title).toContain('Interaktive 3D-Karte'));

    service.stop();
  });

  it('change la langue sans perdre les paramètres de navigation', async () => {
    const service = TestBed.inject(I18nService);

    service.start();
    await service.setLanguage('fr');
    await service.setLanguage('en');

    expect(service.lang()).toBe('en');
    expect(service.locale()).toBe('en-US');
    expect(service.content().seo.title).toContain('Interactive 3D Universe Map');
    expect(document.documentElement.lang).toBe('en');
    expect(window.location.pathname).toBe('/en/');
    expect(window.location.search).toBe('?target=earth');
    expect(window.location.hash).toBe('#map');

    service.stop();
  });

  it('synchronise la langue lors de la navigation dans l’historique', async () => {
    const service = TestBed.inject(I18nService);

    service.start();
    window.history.replaceState(null, '', '/es/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(service.lang()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    await vi.waitFor(() => expect(service.content().seo.title).toContain('Mapa 3D'));

    window.history.replaceState(null, '', '/guide/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(service.lang()).toBe('es');

    service.stop();
    window.history.replaceState(null, '', '/de/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(service.lang()).toBe('es');
  });

  it('localise les nombres et les principaux noms astronomiques', async () => {
    const service = TestBed.inject(I18nService);

    await service.setLanguage('de');

    expect(service.formatNumber(12_345.6, 1)).toBe('12.345,6');
    expect(service.objectName('earth', 'Terre')).toBe('Erde');
    expect(service.objectName('enceladus', 'Encelade')).toBe('Enceladus');
    expect(service.objectName('halley', 'Comète de Halley')).toBe('Halleyscher Komet');
    expect(service.localizeKnownObjectName('Voie lactée')).toBe('Milchstraße');
    expect(service.localizeKnownObjectName('Sirius')).toBe('Sirius');
    expect(service.objectSearchNames('earth')).toEqual(['Erde']);
    for (const objectId of Object.keys(service.content().objectNames)) {
      expect(service.objectSearchNames(objectId)).toHaveLength(1);
    }
    expect(service.objectSearchNames('unknown-object')).toEqual([]);
    expect(service.objectName('sirius', 'Sirius')).toBe('Sirius');
    expect(service.interpolate('{value} {unit}', { value: 12, unit: 'AE' })).toBe('12 AE');
    expect(service.interpolate('{missing}', {})).toBe('{missing}');
  });

  it('charge à la demande les catalogues italien, coréen, japonais et chinois', async () => {
    const service = TestBed.inject(I18nService);
    const cases = [
      ['it', 'it-IT', 'Mappa 3D interattiva', 'Terra', 'it'],
      ['ko', 'ko-KR', '인터랙티브 3D 우주 지도', '지구', 'ko'],
      ['ja', 'ja-JP', 'インタラクティブ3D宇宙マップ', '地球', 'ja'],
      ['zh', 'zh-CN', '交互式3D宇宙地图', '地球', 'zh-Hans'],
    ] as const;

    for (const [language, locale, title, earth, documentLanguage] of cases) {
      await service.setLanguage(language);

      expect(service.locale()).toBe(locale);
      expect(service.content().seo.title).toContain(title);
      expect(service.objectName('earth', 'Terre')).toBe(earth);
      expect(service.objectSearchNames('earth')).toEqual([earth]);
      expect(document.documentElement.lang).toBe(documentLanguage);
    }
  });
});
