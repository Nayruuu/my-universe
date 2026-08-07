import type { SpaceObject } from '../../../data/models/universe.models';
import frContent from '../../core/i18n/locales/content.fr.json';
import { createObjectDetailsCatalogPresentation } from './object-details-catalog-presentation';

describe('object details catalog presentation', () => {
  const presentation = createObjectDetailsCatalogPresentation({
    content: () => frContent,
    formatNumber: (value, maximumFractionDigits = 1) =>
      new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
  });

  it('choisit la mesure de distance la plus précise et un identifiant traçable', () => {
    expect(
      presentation.distanceLabel(
        object({ metadata: { distanceMpc: 17.219, distanceLy: 56_000_000 } }),
      ),
    ).toBe('17,219 Mpc');
    expect(presentation.distanceLabel(object({ metadata: { distanceLy: 4.2465 } }))).toContain(
      'a.l.',
    );
    expect(presentation.distanceLabel(object({ metadata: { semiMajorAxisAu: 1.5237 } }))).toContain(
      'UA',
    );
    expect(presentation.distanceLabel(object({ metadata: { semiMajorAxisKm: 421_800 } }))).toMatch(
      /421.800 km/u,
    );
    expect(presentation.distanceLabel(object({ id: 'sun' }))).toBe('1 UA depuis la Terre');
    expect(presentation.distanceLabel(object())).toBeNull();

    expect(presentation.catalogIdentifierLabel(object({ metadata: { hygId: 42 } }))).toBe('HYG 42');
    expect(presentation.catalogIdentifierLabel(object({ metadata: { pgcId: 51 } }))).toBe('PGC 51');
    expect(
      presentation.catalogIdentifierLabel(
        object({ metadata: { catalogIdentifier: 'CMASS-North-60' } }),
      ),
    ).toBe('CMASS-North-60');
    expect(presentation.catalogIdentifierLabel(object())).toBeNull();
  });

  it('présente les mesures d’un catalogue de structures sans masquer leur sens', () => {
    const structure = object({
      metadata: {
        effectiveRadiusMpc: 46.14,
        lengthMpc: 24.8,
        memberGalaxyCount: 35,
        catalogConfidence: 0.996,
        catalogConfidenceMeaning: 'Probabilité intrinsèque publiée',
        extentMeaning: 'Rayon sphérique visuel équivalent',
        densityContrast: -0.717,
        boundaryDistanceMpc: 75.006,
        detectionMethod: 'ZOBOV watershed',
        surveyEdge: false,
      },
    });

    expect(presentation.effectiveRadiusLabel(structure)).toBe('46,14 Mpc');
    expect(presentation.structureLengthLabel(structure)).toBe('24,8 Mpc');
    expect(presentation.memberGalaxyCountLabel(structure)).toBe('35');
    expect(presentation.catalogConfidenceLabel(structure)).toBe('99,6 %');
    expect(presentation.catalogConfidenceMeaningLabel(structure)).toBe(
      'Probabilité intrinsèque publiée',
    );
    expect(presentation.extentMeaningLabel(structure)).toBe('Rayon sphérique visuel équivalent');
    expect(presentation.densityContrastLabel(structure)).toBe('−71,7 %');
    expect(presentation.boundaryDistanceLabel(structure)).toBe('75,01 Mpc');
    expect(presentation.detectionMethodLabel(structure)).toBe('ZOBOV watershed');
    expect(presentation.surveyEdgeLabel(structure)).toBe('À l’intérieur du relevé');
    expect(presentation.surveyEdgeLabel(object({ metadata: { surveyEdge: true } }))).toBe(
      'Au contact de la limite',
    );
  });

  it('présente les mesures stellaires, galactiques et Cosmicflows disponibles', () => {
    const documented = object({
      metadata: {
        apparentMagnitude: -1.46,
        colorIndexBv: 0.009,
        distanceModulusError: 0.12,
        velocityCmbKmPerSecond: 810,
        morphology: 'Sb',
        diameterLy: 120_000,
        subgroup: 'Sous-groupe d’Andromède',
        absoluteMagnitude: -21.5,
        halfLightRadiusPc: 12_300,
        massSolar: 4_000_000,
      },
    });

    expect(presentation.apparentMagnitudeLabel(documented)).toBe('-1,46');
    expect(presentation.colorIndexLabel(documented)).toBe('0,009');
    expect(presentation.distanceUncertaintyLabel(documented)).toBe('± 0,12 mag');
    expect(presentation.cmbVelocityLabel(documented)).toBe('810 km/s');
    expect(presentation.morphologyLabel(documented)).toBe('Sb');
    expect(presentation.diameterLabel(documented)).toContain('a.l.');
    expect(presentation.subgroupLabel(documented)).toBe('Sous-groupe d’Andromède');
    expect(presentation.absoluteMagnitudeLabel(documented)).toBe('−21,5');
    expect(presentation.halfLightRadiusLabel(documented)).toMatch(/12.300 pc/u);
    expect(presentation.massSolarLabel(documented)).toMatch(/4.000.000 masses solaires/u);
  });

  it('n’invente aucune valeur absente du catalogue', () => {
    const missing = object();

    for (const label of [
      presentation.apparentMagnitudeLabel,
      presentation.colorIndexLabel,
      presentation.effectiveRadiusLabel,
      presentation.structureLengthLabel,
      presentation.memberGalaxyCountLabel,
      presentation.catalogConfidenceLabel,
      presentation.catalogConfidenceMeaningLabel,
      presentation.extentMeaningLabel,
      presentation.densityContrastLabel,
      presentation.boundaryDistanceLabel,
      presentation.detectionMethodLabel,
      presentation.surveyEdgeLabel,
      presentation.distanceUncertaintyLabel,
      presentation.cmbVelocityLabel,
      presentation.morphologyLabel,
      presentation.diameterLabel,
      presentation.subgroupLabel,
      presentation.absoluteMagnitudeLabel,
      presentation.halfLightRadiusLabel,
      presentation.massSolarLabel,
    ]) {
      expect(label(missing)).toBeNull();
    }
  });
});

function object(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return {
    id: 'object',
    name: 'Objet',
    type: 'galaxy',
    referenceFrame: 'local-group',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'megaparsec' },
    ...overrides,
  };
}
