import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reportPath = resolve('coverage/universe-map/coverage-summary.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const scientificModules = [
  {
    name: 'coordonnées multi-échelles',
    suffix: '/src/engine/coordinates/coordinate-system.ts',
  },
  {
    name: 'conversion des unités',
    suffix: '/src/engine/coordinates/unit-conversion.ts',
  },
  {
    name: 'coordonnées du Groupe local',
    suffix: '/src/data/validation/local-group-catalog.ts',
  },
  {
    name: 'couleur stellaire',
    suffix: '/src/engine/materials/star-color.ts',
  },
  {
    name: 'catalogue de groupes Cosmicflows-4',
    suffix: '/src/engine/loaders/cosmic-group-catalog.ts',
  },
  {
    name: 'catalogues de structures cosmiques',
    suffix: '/src/engine/loaders/cosmic-structure-catalog.ts',
  },
  {
    name: 'épines publiées des filaments Tempel',
    suffix: '/src/engine/loaders/tempel-filament-spine-catalog.ts',
  },
  {
    name: 'catalogue NASA des exoplanètes',
    suffix: '/src/engine/loaders/exoplanet-catalog.ts',
  },
  {
    name: 'référentiel du catalogue Cosmicflows-4',
    suffix: '/src/engine/objects/cosmic-group-catalog-registry.ts',
  },
  {
    name: 'référentiel des structures cosmiques',
    suffix: '/src/engine/objects/cosmic-structure-catalog-registry.ts',
  },
  {
    name: 'référentiel et orbites des exoplanètes',
    suffix: '/src/engine/objects/exoplanet-catalog-registry.ts',
  },
  {
    name: 'rendu spatial des filaments Tempel',
    suffix: '/src/engine/rendering/tempel-filament-spine-batch.ts',
  },
  {
    name: 'rotation axiale',
    suffix: '/src/engine/simulation/body-rotation.ts',
  },
  {
    name: 'orientation axiale IAU',
    suffix: '/src/engine/simulation/body-orientation.ts',
  },
  {
    name: 'catalogue des éclipses',
    suffix: '/src/engine/simulation/earth-eclipse-catalog.ts',
  },
  {
    name: 'modèle des éclipses',
    suffix: '/src/engine/simulation/earth-eclipse.ts',
  },
  {
    name: 'lecture de la rotation terrestre',
    suffix: '/src/engine/simulation/earth-rotation-playback.ts',
  },
  {
    name: 'éclipse solaire locale',
    suffix: '/src/engine/simulation/local-solar-eclipse-calculator.ts',
  },
  {
    name: 'éclipse lunaire',
    suffix: '/src/engine/simulation/lunar-eclipse-calculator.ts',
  },
  {
    name: 'fournisseurs de position',
    suffix: '/src/engine/simulation/position-providers.ts',
  },
  {
    name: 'évolution visuelle des supernovas',
    suffix: '/src/engine/simulation/supernova-appearance.ts',
  },
  {
    name: 'éclipse solaire',
    suffix: '/src/engine/simulation/solar-eclipse-calculator.ts',
  },
  {
    name: 'lieux d’observation des éclipses',
    suffix: '/src/engine/simulation/solar-eclipse-locations.ts',
  },
  {
    name: 'contrôleur temporel',
    suffix: '/src/engine/simulation/time-controller.ts',
  },
  {
    name: 'conversions temporelles',
    suffix: '/src/engine/simulation/time-utils.ts',
  },
].map(({ name, suffix }) => ({
  name: `science · ${name}`,
  suffix,
  minimums: allMetrics(100),
}));

const thresholds = [
  {
    name: 'global',
    suffix: null,
    minimums: allMetrics(100),
  },
  ...scientificModules,
  {
    name: 'recherche locale',
    suffix: '/src/app/core/search/search-index.ts',
    minimums: { statements: 85, branches: 70, functions: 100, lines: 85 },
  },
  {
    name: 'URL partageable',
    suffix: '/src/app/core/url/navigation-url.service.ts',
    minimums: { statements: 85, branches: 70, functions: 75, lines: 85 },
  },
  {
    name: 'validation des données',
    suffix: '/src/data/validation/dataset-validator.ts',
    minimums: { statements: 70, branches: 65, functions: 100, lines: 70 },
  },
  {
    name: 'contrôleur caméra',
    suffix: '/src/engine/camera/camera-controller.ts',
    minimums: { statements: 70, branches: 50, functions: 75, lines: 70 },
  },
  {
    name: 'politique de navigation',
    suffix: '/src/engine/camera/navigation-policy.ts',
    minimums: { statements: 80, branches: 65, functions: 100, lines: 80 },
  },
  {
    name: 'échelles de navigation',
    suffix: '/src/engine/camera/navigation-scales.ts',
    minimums: { statements: 85, branches: 50, functions: 100, lines: 85 },
  },
  {
    name: 'floating origin',
    suffix: '/src/engine/coordinates/floating-origin-manager.ts',
    minimums: allMetrics(100),
  },
  {
    name: 'boucle de rendu',
    suffix: '/src/engine/core/render-loop.ts',
    minimums: allMetrics(100),
  },
  {
    name: 'chargement statique',
    suffix: '/src/engine/loaders/asset-loader.ts',
    minimums: allMetrics(100),
  },
  {
    name: 'catalogue stellaire binaire',
    suffix: '/src/engine/loaders/star-catalog.ts',
    minimums: { statements: 90, branches: 80, functions: 100, lines: 90 },
  },
  {
    name: 'sélection LOD',
    suffix: '/src/engine/lod/lod-manager.ts',
    minimums: { statements: 85, branches: 85, functions: 65, lines: 85 },
  },
  {
    name: 'LOD écran',
    suffix: '/src/engine/lod/screen-space-lod.ts',
    minimums: { statements: 80, branches: 70, functions: 95, lines: 80 },
  },
  {
    name: 'qualité graphique',
    suffix: '/src/engine/performance/performance-manager.ts',
    minimums: { statements: 100, branches: 90, functions: 100, lines: 100 },
  },
  {
    name: 'registre du catalogue stellaire',
    suffix: '/src/engine/objects/star-catalog-registry.ts',
    minimums: { statements: 95, branches: 65, functions: 100, lines: 95 },
  },
  {
    name: 'rendu groupé du catalogue stellaire',
    suffix: '/src/engine/rendering/star-catalog-batch.ts',
    minimums: { statements: 95, branches: 80, functions: 100, lines: 95 },
  },
  {
    name: 'sélection souris/tactile',
    suffix: '/src/engine/selection/selection-manager.ts',
    minimums: { statements: 60, branches: 45, functions: 50, lines: 60 },
  },
];

const failures = [];
for (const threshold of thresholds) {
  const coverage = findCoverage(report, threshold.suffix);
  if (!coverage) {
    failures.push(`${threshold.name}: entrée absente du rapport`);
    continue;
  }

  const summary = [];
  for (const [metric, minimum] of Object.entries(threshold.minimums)) {
    const actual = coverage[metric]?.pct;
    summary.push(`${metric} ${format(actual)}%`);
    if (typeof actual !== 'number' || actual < minimum) {
      failures.push(`${threshold.name}: ${metric} ${format(actual)}% < seuil ${minimum}%`);
    }
  }
  console.log(`✓ ${threshold.name}: ${summary.join(' · ')}`);
}

if (failures.length > 0) {
  console.error('\nSeuils de couverture non respectés :');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nTous les seuils de couverture sont respectés.');

function allMetrics(minimum) {
  return {
    statements: minimum,
    branches: minimum,
    functions: minimum,
    lines: minimum,
  };
}

function findCoverage(coverageReport, suffix) {
  if (suffix === null) {
    return coverageReport.total;
  }
  const entry = Object.entries(coverageReport).find(([filePath]) =>
    filePath.replaceAll('\\', '/').endsWith(suffix),
  );
  return entry?.[1];
}

function format(value) {
  return typeof value === 'number' ? value.toFixed(2) : 'absent';
}
