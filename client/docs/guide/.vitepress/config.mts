import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress';

const SITE_ORIGIN = 'https://super-universe.app';
const GUIDE_ORIGIN = `${SITE_ORIGIN}/guide/`;
const GITHUB_EDIT_ROOT = 'https://github.com/Nayruuu/my-universe/edit/main/client/docs/guide/:path';

type GuideLanguage = 'en' | 'fr' | 'es' | 'de' | 'it' | 'ko' | 'ja' | 'zh';
type GuideLocalePrefix = 'root' | Exclude<GuideLanguage, 'en'>;

interface GuideLocaleCopy {
  readonly appLanguage: GuideLanguage;
  readonly label: string;
  readonly lang: string;
  readonly hreflang: string;
  readonly ogLocale: string;
  readonly titleTemplate: string;
  readonly description: string;
  readonly guideTitle: string;
  readonly navGuide: string;
  readonly navScience: string;
  readonly navDevelopers: string;
  readonly openMap: string;
  readonly explore: string;
  readonly introduction: string;
  readonly gettingStarted: string;
  readonly navigation: string;
  readonly timeAndEclipses: string;
  readonly understand: string;
  readonly scientificConfidence: string;
  readonly catalogues: string;
  readonly performance: string;
  readonly contribute: string;
  readonly developers: string;
  readonly faq: string;
  readonly about: string;
  readonly roadmap: string;
  readonly outline: string;
  readonly edit: string;
  readonly footerMessage: string;
  readonly license: string;
  readonly previous: string;
  readonly next: string;
  readonly languageMenu: string;
  readonly search: string;
  readonly searchAria: string;
  readonly noResults: string;
  readonly appearance: string;
  readonly lightTheme: string;
  readonly darkTheme: string;
  readonly sidebarMenu: string;
  readonly returnToTop: string;
  readonly skipToContent: string;
}

const LOCALES: Readonly<Record<GuideLocalePrefix, GuideLocaleCopy>> = {
  root: {
    appLanguage: 'en',
    label: 'English',
    lang: 'en-US',
    hreflang: 'en',
    ogLocale: 'en_US',
    titleTemplate: ':title | Universe Map Guide',
    description:
      'Learn how to explore astronomical scales, time, eclipses, catalogues, and scientific confidence in Universe Map.',
    guideTitle: 'Universe Map Guide',
    navGuide: 'Guide',
    navScience: 'Scientific basis',
    navDevelopers: 'Developer guide',
    openMap: 'Open the map ↗',
    explore: 'Explore',
    introduction: 'Introduction',
    gettingStarted: 'Getting started',
    navigation: 'Navigation and scale',
    timeAndEclipses: 'Time and eclipses',
    understand: 'Understand the map',
    scientificConfidence: 'Scientific confidence',
    catalogues: 'Catalogues and sources',
    performance: 'Performance and limits',
    contribute: 'Contribute',
    developers: 'Developer guide',
    faq: 'FAQ',
    about: 'About the project',
    roadmap: 'Roadmap',
    outline: 'On this page',
    edit: 'Edit this page on GitHub',
    footerMessage: 'Scientific data and visual adaptations are identified separately.',
    license: 'Universe Map is created by Nayruuu and released under the MIT License.',
    previous: 'Previous page',
    next: 'Next page',
    languageMenu: 'Change language',
    search: 'Search',
    searchAria: 'Search documentation',
    noResults: 'No results found for',
    appearance: 'Appearance',
    lightTheme: 'Switch to light theme',
    darkTheme: 'Switch to dark theme',
    sidebarMenu: 'Menu',
    returnToTop: 'Return to top',
    skipToContent: 'Skip to content',
  },
  fr: {
    appLanguage: 'fr',
    label: 'Français',
    lang: 'fr-FR',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    titleTemplate: ':title | Guide Universe Map',
    description:
      'Découvrez les échelles astronomiques, le temps, les éclipses, les catalogues et la fiabilité scientifique dans Universe Map.',
    guideTitle: 'Guide Universe Map',
    navGuide: 'Guide',
    navScience: 'Base scientifique',
    navDevelopers: 'Guide développeur',
    openMap: 'Ouvrir la carte ↗',
    explore: 'Explorer',
    introduction: 'Introduction',
    gettingStarted: 'Bien démarrer',
    navigation: 'Navigation et échelles',
    timeAndEclipses: 'Temps et éclipses',
    understand: 'Comprendre la carte',
    scientificConfidence: 'Fiabilité scientifique',
    catalogues: 'Catalogues et sources',
    performance: 'Performances et limites',
    contribute: 'Contribuer',
    developers: 'Guide développeur',
    faq: 'FAQ',
    about: 'À propos du projet',
    roadmap: 'Feuille de route',
    outline: 'Sur cette page',
    edit: 'Modifier cette page sur GitHub',
    footerMessage:
      'Les données scientifiques et les adaptations visuelles sont identifiées séparément.',
    license: 'Universe Map est créé par Nayruuu et publié sous licence MIT.',
    previous: 'Page précédente',
    next: 'Page suivante',
    languageMenu: 'Changer de langue',
    search: 'Rechercher',
    searchAria: 'Rechercher dans la documentation',
    noResults: 'Aucun résultat trouvé pour',
    appearance: 'Apparence',
    lightTheme: 'Passer au thème clair',
    darkTheme: 'Passer au thème sombre',
    sidebarMenu: 'Menu',
    returnToTop: 'Retour en haut',
    skipToContent: 'Aller au contenu',
  },
  es: {
    appLanguage: 'es',
    label: 'Español',
    lang: 'es-ES',
    hreflang: 'es',
    ogLocale: 'es_ES',
    titleTemplate: ':title | Guía de Universe Map',
    description:
      'Aprende a explorar escalas astronómicas, tiempo, eclipses, catálogos y fiabilidad científica en Universe Map.',
    guideTitle: 'Guía de Universe Map',
    navGuide: 'Guía',
    navScience: 'Base científica',
    navDevelopers: 'Guía de desarrollo',
    openMap: 'Abrir el mapa ↗',
    explore: 'Explorar',
    introduction: 'Introducción',
    gettingStarted: 'Primeros pasos',
    navigation: 'Navegación y escalas',
    timeAndEclipses: 'Tiempo y eclipses',
    understand: 'Comprender el mapa',
    scientificConfidence: 'Fiabilidad científica',
    catalogues: 'Catálogos y fuentes',
    performance: 'Rendimiento y límites',
    contribute: 'Contribuir',
    developers: 'Guía de desarrollo',
    faq: 'Preguntas frecuentes',
    about: 'Acerca del proyecto',
    roadmap: 'Hoja de ruta',
    outline: 'En esta página',
    edit: 'Editar esta página en GitHub',
    footerMessage: 'Los datos científicos y las adaptaciones visuales se identifican por separado.',
    license: 'Universe Map ha sido creado por Nayruuu y se publica bajo la licencia MIT.',
    previous: 'Página anterior',
    next: 'Página siguiente',
    languageMenu: 'Cambiar idioma',
    search: 'Buscar',
    searchAria: 'Buscar en la documentación',
    noResults: 'No se encontraron resultados para',
    appearance: 'Apariencia',
    lightTheme: 'Cambiar al tema claro',
    darkTheme: 'Cambiar al tema oscuro',
    sidebarMenu: 'Menú',
    returnToTop: 'Volver arriba',
    skipToContent: 'Ir al contenido',
  },
  de: {
    appLanguage: 'de',
    label: 'Deutsch',
    lang: 'de-DE',
    hreflang: 'de',
    ogLocale: 'de_DE',
    titleTemplate: ':title | Universe-Map-Leitfaden',
    description:
      'Erfahren Sie, wie Sie astronomische Maßstäbe, Zeit, Finsternisse, Kataloge und wissenschaftliche Verlässlichkeit in Universe Map erkunden.',
    guideTitle: 'Universe-Map-Leitfaden',
    navGuide: 'Leitfaden',
    navScience: 'Wissenschaftliche Grundlage',
    navDevelopers: 'Entwicklerleitfaden',
    openMap: 'Karte öffnen ↗',
    explore: 'Erkunden',
    introduction: 'Einführung',
    gettingStarted: 'Erste Schritte',
    navigation: 'Navigation und Maßstäbe',
    timeAndEclipses: 'Zeit und Finsternisse',
    understand: 'Die Karte verstehen',
    scientificConfidence: 'Wissenschaftliche Verlässlichkeit',
    catalogues: 'Kataloge und Quellen',
    performance: 'Leistung und Grenzen',
    contribute: 'Mitwirken',
    developers: 'Entwicklerleitfaden',
    faq: 'Häufige Fragen',
    about: 'Über das Projekt',
    roadmap: 'Projektplan',
    outline: 'Auf dieser Seite',
    edit: 'Diese Seite auf GitHub bearbeiten',
    footerMessage:
      'Wissenschaftliche Daten und visuelle Anpassungen werden getrennt gekennzeichnet.',
    license: 'Universe Map wurde von Nayruuu erstellt und unter der MIT-Lizenz veröffentlicht.',
    previous: 'Vorherige Seite',
    next: 'Nächste Seite',
    languageMenu: 'Sprache ändern',
    search: 'Suchen',
    searchAria: 'Dokumentation durchsuchen',
    noResults: 'Keine Ergebnisse gefunden für',
    appearance: 'Darstellung',
    lightTheme: 'Zum hellen Design wechseln',
    darkTheme: 'Zum dunklen Design wechseln',
    sidebarMenu: 'Menü',
    returnToTop: 'Nach oben',
    skipToContent: 'Zum Inhalt springen',
  },
  it: {
    appLanguage: 'it',
    label: 'Italiano',
    lang: 'it-IT',
    hreflang: 'it',
    ogLocale: 'it_IT',
    titleTemplate: ':title | Guida di Universe Map',
    description:
      'Scopri come esplorare scale astronomiche, tempo, eclissi, cataloghi e affidabilità scientifica in Universe Map.',
    guideTitle: 'Guida di Universe Map',
    navGuide: 'Guida',
    navScience: 'Base scientifica',
    navDevelopers: 'Guida per sviluppatori',
    openMap: 'Apri la mappa ↗',
    explore: 'Esplora',
    introduction: 'Introduzione',
    gettingStarted: 'Primi passi',
    navigation: 'Navigazione e scale',
    timeAndEclipses: 'Tempo ed eclissi',
    understand: 'Comprendere la mappa',
    scientificConfidence: 'Affidabilità scientifica',
    catalogues: 'Cataloghi e fonti',
    performance: 'Prestazioni e limiti',
    contribute: 'Contribuire',
    developers: 'Guida per sviluppatori',
    faq: 'Domande frequenti',
    about: 'Informazioni sul progetto',
    roadmap: 'Roadmap',
    outline: 'In questa pagina',
    edit: 'Modifica questa pagina su GitHub',
    footerMessage: 'I dati scientifici e gli adattamenti visivi sono identificati separatamente.',
    license: 'Universe Map è creato da Nayruuu e distribuito con licenza MIT.',
    previous: 'Pagina precedente',
    next: 'Pagina successiva',
    languageMenu: 'Cambia lingua',
    search: 'Cerca',
    searchAria: 'Cerca nella documentazione',
    noResults: 'Nessun risultato trovato per',
    appearance: 'Aspetto',
    lightTheme: 'Passa al tema chiaro',
    darkTheme: 'Passa al tema scuro',
    sidebarMenu: 'Menu',
    returnToTop: 'Torna in alto',
    skipToContent: 'Vai al contenuto',
  },
  ko: {
    appLanguage: 'ko',
    label: '한국어',
    lang: 'ko-KR',
    hreflang: 'ko',
    ogLocale: 'ko_KR',
    titleTemplate: ':title | Universe Map 가이드',
    description:
      'Universe Map에서 천문학적 규모, 시간, 일식과 월식, 카탈로그, 과학적 신뢰도를 살펴보는 방법을 알아보세요.',
    guideTitle: 'Universe Map 가이드',
    navGuide: '가이드',
    navScience: '과학적 기반',
    navDevelopers: '개발자 가이드',
    openMap: '지도 열기 ↗',
    explore: '탐색',
    introduction: '소개',
    gettingStarted: '시작하기',
    navigation: '탐색과 축척',
    timeAndEclipses: '시간과 식 현상',
    understand: '지도 이해하기',
    scientificConfidence: '과학적 신뢰도',
    catalogues: '카탈로그와 출처',
    performance: '성능과 한계',
    contribute: '기여',
    developers: '개발자 가이드',
    faq: '자주 묻는 질문',
    about: '프로젝트 소개',
    roadmap: '로드맵',
    outline: '이 페이지에서',
    edit: 'GitHub에서 이 페이지 편집',
    footerMessage: '과학 데이터와 시각적 조정은 별도로 표시됩니다.',
    license: 'Universe Map은 Nayruuu가 제작했으며 MIT 라이선스로 배포됩니다.',
    previous: '이전 페이지',
    next: '다음 페이지',
    languageMenu: '언어 변경',
    search: '검색',
    searchAria: '문서 검색',
    noResults: '검색 결과 없음:',
    appearance: '화면 모드',
    lightTheme: '라이트 테마로 전환',
    darkTheme: '다크 테마로 전환',
    sidebarMenu: '메뉴',
    returnToTop: '맨 위로',
    skipToContent: '본문으로 건너뛰기',
  },
  ja: {
    appLanguage: 'ja',
    label: '日本語',
    lang: 'ja-JP',
    hreflang: 'ja',
    ogLocale: 'ja_JP',
    titleTemplate: ':title | Universe Map ガイド',
    description:
      'Universe Mapで天文学的スケール、時間、食、カタログ、科学的信頼度を探索する方法を学びます。',
    guideTitle: 'Universe Map ガイド',
    navGuide: 'ガイド',
    navScience: '科学的根拠',
    navDevelopers: '開発者ガイド',
    openMap: 'マップを開く ↗',
    explore: '探索',
    introduction: 'はじめに',
    gettingStarted: '使い始める',
    navigation: 'ナビゲーションとスケール',
    timeAndEclipses: '時間と食',
    understand: 'マップを理解する',
    scientificConfidence: '科学的信頼度',
    catalogues: 'カタログと出典',
    performance: '性能と制限',
    contribute: '貢献',
    developers: '開発者ガイド',
    faq: 'よくある質問',
    about: 'プロジェクトについて',
    roadmap: 'ロードマップ',
    outline: 'このページの内容',
    edit: 'GitHubでこのページを編集',
    footerMessage: '科学データと視覚的な調整は区別して表示されます。',
    license: 'Universe MapはNayruuuが制作し、MITライセンスで公開しています。',
    previous: '前のページ',
    next: '次のページ',
    languageMenu: '言語を変更',
    search: '検索',
    searchAria: 'ドキュメントを検索',
    noResults: '検索結果がありません：',
    appearance: '外観',
    lightTheme: 'ライトテーマに切り替える',
    darkTheme: 'ダークテーマに切り替える',
    sidebarMenu: 'メニュー',
    returnToTop: 'ページ上部へ戻る',
    skipToContent: '本文へ移動',
  },
  zh: {
    appLanguage: 'zh',
    label: '简体中文',
    lang: 'zh-Hans',
    hreflang: 'zh-Hans',
    ogLocale: 'zh_CN',
    titleTemplate: ':title | Universe Map 指南',
    description: '了解如何在Universe Map中探索天文尺度、时间、日月食、星表和科学可信度。',
    guideTitle: 'Universe Map 指南',
    navGuide: '指南',
    navScience: '科学基础',
    navDevelopers: '开发者指南',
    openMap: '打开地图 ↗',
    explore: '探索',
    introduction: '介绍',
    gettingStarted: '快速开始',
    navigation: '导航与尺度',
    timeAndEclipses: '时间与日月食',
    understand: '理解地图',
    scientificConfidence: '科学可信度',
    catalogues: '星表与数据源',
    performance: '性能与限制',
    contribute: '参与贡献',
    developers: '开发者指南',
    faq: '常见问题',
    about: '关于项目',
    roadmap: '路线图',
    outline: '本页内容',
    edit: '在GitHub上编辑此页',
    footerMessage: '科学数据与视觉适配会分别标注。',
    license: 'Universe Map由Nayruuu创作，并基于MIT许可证发布。',
    previous: '上一页',
    next: '下一页',
    languageMenu: '切换语言',
    search: '搜索',
    searchAria: '搜索文档',
    noResults: '未找到相关结果：',
    appearance: '外观',
    lightTheme: '切换到浅色主题',
    darkTheme: '切换到深色主题',
    sidebarMenu: '菜单',
    returnToTop: '返回顶部',
    skipToContent: '跳转到正文',
  },
};

export default defineConfig({
  lang: LOCALES.root.lang,
  title: 'Universe Map',
  titleTemplate: LOCALES.root.titleTemplate,
  description: LOCALES.root.description,
  base: '/guide/',
  outDir: '../../dist/universe-map/browser/guide',
  cacheDir: '../../.angular/cache/vitepress',
  appearance: 'dark',
  lastUpdated: false,
  ignoreDeadLinks: false,
  sitemap: {
    hostname: GUIDE_ORIGIN,
  },
  locales: Object.fromEntries(
    Object.entries(LOCALES).map(([prefix, copy]) => [
      prefix,
      {
        label: copy.label,
        lang: copy.lang,
        title: 'Universe Map',
        titleTemplate: copy.titleTemplate,
        description: copy.description,
        themeConfig: localizedTheme(prefix as GuideLocalePrefix, copy),
      },
    ]),
  ),
  head: [
    ['meta', { name: 'theme-color', content: '#030611' }],
    ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large' }],
    ['meta', { name: 'author', content: 'Nayruuu' }],
    ['link', { rel: 'author', href: 'https://super-dev.app' }],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${SITE_ORIGIN}/icons/universe-map-icon.svg`,
      },
    ],
    ['link', { rel: 'alternate icon', type: 'image/x-icon', href: `${SITE_ORIGIN}/favicon.ico` }],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: `${SITE_ORIGIN}/apple-touch-icon.png`,
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Universe Map Guide' }],
    [
      'meta',
      {
        property: 'og:image',
        content: `${SITE_ORIGIN}/og/universe-map-social.png`,
      },
    ],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      {
        name: 'twitter:image',
        content: `${SITE_ORIGIN}/og/universe-map-social.png`,
      },
    ],
  ],
  transformPageData(pageData) {
    const pagePath = pageData.relativePath.replace(/index\.md$/u, '').replace(/\.md$/u, '/');
    const localePrefix = localePrefixFromPagePath(pagePath);
    const locale = LOCALES[localePrefix];
    const unprefixedPath =
      localePrefix === 'root' ? pagePath : pagePath.slice(localePrefix.length + 1);
    const canonicalUrl = `${GUIDE_ORIGIN}${pagePath}`;
    const socialTitle = pageData.title
      ? `${pageData.title} | ${locale.guideTitle}`
      : locale.guideTitle;

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:title', content: socialTitle }],
      ['meta', { property: 'og:description', content: pageData.description }],
      ['meta', { property: 'og:locale', content: locale.ogLocale }],
      ['meta', { name: 'twitter:title', content: socialTitle }],
      ['meta', { name: 'twitter:description', content: pageData.description }],
      ...alternatePageHeads(unprefixedPath, localePrefix),
    );
  },
  themeConfig: {
    logo: {
      light: '/universe-map-mark.svg',
      dark: '/universe-map-mark.svg',
      alt: 'Universe Map',
    },
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Nayruuu/my-universe' }],
  },
});

function localizedTheme(prefix: GuideLocalePrefix, copy: GuideLocaleCopy): DefaultTheme.Config {
  const path = (page = ''): string => {
    const localeRoot = prefix === 'root' ? '/' : `/${prefix}/`;

    return page ? `${localeRoot}${page}/` : localeRoot;
  };

  return {
    siteTitle: copy.guideTitle,
    nav: [
      { text: copy.navGuide, link: path() },
      { text: copy.navScience, link: path('scientific-confidence') },
      { text: copy.roadmap, link: path('roadmap') },
      { text: copy.navDevelopers, link: path('developers') },
      { text: copy.about, link: path('about') },
      { text: copy.openMap, link: `${SITE_ORIGIN}/${copy.appLanguage}/` },
    ],
    sidebar: [
      {
        text: copy.explore,
        items: [
          { text: copy.introduction, link: path() },
          { text: copy.gettingStarted, link: path('getting-started') },
          { text: copy.navigation, link: path('navigation') },
          { text: copy.timeAndEclipses, link: path('time-and-eclipses') },
        ],
      },
      {
        text: copy.understand,
        items: [
          { text: copy.scientificConfidence, link: path('scientific-confidence') },
          { text: copy.catalogues, link: path('catalogues') },
          { text: copy.performance, link: path('performance-and-limits') },
        ],
      },
      {
        text: copy.contribute,
        items: [
          { text: copy.roadmap, link: path('roadmap') },
          { text: copy.about, link: path('about') },
          { text: copy.developers, link: path('developers') },
          { text: copy.faq, link: path('faq') },
        ],
      },
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: copy.search,
            buttonAriaLabel: copy.searchAria,
          },
          modal: {
            noResultsText: copy.noResults,
          },
        },
      },
    },
    outline: {
      level: [2, 3],
      label: copy.outline,
    },
    editLink: {
      pattern: GITHUB_EDIT_ROOT,
      text: copy.edit,
    },
    footer: {
      message: copy.footerMessage,
      copyright: copy.license,
    },
    docFooter: {
      prev: copy.previous,
      next: copy.next,
    },
    langMenuLabel: copy.languageMenu,
    darkModeSwitchLabel: copy.appearance,
    lightModeSwitchTitle: copy.lightTheme,
    darkModeSwitchTitle: copy.darkTheme,
    sidebarMenuLabel: copy.sidebarMenu,
    returnToTopLabel: copy.returnToTop,
    skipToContentLabel: copy.skipToContent,
  };
}

function localePrefixFromPagePath(pagePath: string): GuideLocalePrefix {
  const firstSegment = pagePath.split('/').filter(Boolean)[0];

  return firstSegment && firstSegment in LOCALES && firstSegment !== 'root'
    ? (firstSegment as GuideLocalePrefix)
    : 'root';
}

function alternatePageHeads(unprefixedPath: string, activePrefix: GuideLocalePrefix): HeadConfig[] {
  const heads: HeadConfig[] = [];

  for (const [prefix, locale] of Object.entries(LOCALES) as [
    GuideLocalePrefix,
    GuideLocaleCopy,
  ][]) {
    const localizedPath = prefix === 'root' ? unprefixedPath : `${prefix}/${unprefixedPath}`;

    heads.push([
      'link',
      {
        rel: 'alternate',
        hreflang: locale.hreflang,
        href: `${GUIDE_ORIGIN}${localizedPath}`,
      },
    ]);
    if (prefix !== activePrefix) {
      heads.push(['meta', { property: 'og:locale:alternate', content: locale.ogLocale }]);
    }
  }
  heads.push([
    'link',
    {
      rel: 'alternate',
      hreflang: 'x-default',
      href: `${GUIDE_ORIGIN}${unprefixedPath}`,
    },
  ]);

  return heads;
}
