import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PositionProviderDefinition,
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { ObjectDetailsComponent } from './object-details.component';

describe('ObjectDetailsComponent', () => {
  const sun = object({ id: 'sun', name: 'Soleil', type: 'star' });
  const objects = signal<readonly SpaceObject[]>([sun]);
  const facade = {
    selectedObject: signal<SpaceObject | null>(null),
    objects,
    closeDetails: vi.fn(),
    focus: vi.fn(() => Promise.resolve()),
    viewOrbit: vi.fn(),
  };

  beforeEach(() => {
    objects.set([sun]);
    facade.selectedObject.set(null);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ObjectDetailsComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('délègue le focus et le cadrage orbital', () => {
    const component = createComponent();
    const earth = object({ id: 'earth', name: 'Terre', parentId: 'sun' });

    component.focus(earth);
    component.viewOrbit(earth);

    expect(facade.focus).toHaveBeenCalledWith('earth');
    expect(facade.viewOrbit).toHaveBeenCalledWith('earth');
  });

  it('détecte les orbites képlériennes et les éphémérides', () => {
    const component = createComponent();
    const withoutParent = object({ positionProvider: staticProvider() });
    const staticChild = object({ parentId: 'sun', positionProvider: staticProvider() });
    const keplerian = object({ parentId: 'sun', positionProvider: keplerianProvider(365.25) });
    const ephemeris = object({ parentId: 'sun', positionProvider: ephemerisProvider(730.5) });

    expect(component.hasOrbit(withoutParent)).toBe(false);
    expect(component.hasOrbit(staticChild)).toBe(false);
    expect(component.hasOrbit(keplerian)).toBe(true);
    expect(component.hasOrbit(ephemeris)).toBe(true);
    expect(component.orbitPeriodLabel(staticChild)).toBeNull();
    expect(component.orbitPeriodLabel(keplerian)).toContain('365,25 jours');
    expect(component.orbitPeriodLabel(ephemeris)).toContain('2 ans');
  });

  it('formate la période et le sens de rotation', () => {
    const component = createComponent();

    expect(component.rotationPeriodLabel(object())).toBeNull();
    expect(component.rotationPeriodLabel(object({ rotationPeriodHours: 23.5 }))).toBe(
      '23 h 30 min',
    );
    expect(component.rotationPeriodLabel(object({ rotationPeriodHours: -48 }))).toContain(
      '2 jours',
    );
    expect(component.rotationDirectionLabel(object({ rotationPeriodHours: -10 }))).toBe(
      'Rétrograde',
    );
    expect(component.rotationDirectionLabel(object({ rotationPeriodHours: 10 }))).toBe('Prograde');
    expect(component.rotationDirectionLabel(object())).toBe('Prograde');
  });

  it('résout le parent et le libellé de l’action orbitale', () => {
    const component = createComponent();
    const earth = object({ parentId: 'sun' });
    const orphan = object({ parentId: 'missing' });

    expect(component.parentName(object())).toBeNull();
    expect(component.parentName(earth)).toBe('Soleil');
    expect(component.parentName(orphan)).toBeNull();
    expect(component.orbitActionLabel(earth)).toBe('Orbite · Soleil');
    expect(component.orbitActionLabel(orphan)).toBe('Orbite · corps parent');
  });

  it('traduit tous les types et niveaux de confiance', () => {
    const component = createComponent();
    const types: readonly [SpaceObjectType, string][] = [
      ['star', 'Étoile'],
      ['planet', 'Planète'],
      ['moon', 'Satellite naturel'],
      ['galaxy', 'Galaxie'],
      ['dwarf-planet', 'Planète naine'],
      ['asteroid', 'Astéroïde'],
      ['comet', 'Comète'],
      ['nebula', 'Nébuleuse'],
      ['black-hole', 'Trou noir'],
      ['region', 'Région cosmique'],
      ['galaxy-cluster', 'Groupe ou amas de galaxies'],
      ['supercluster', 'Superamas de galaxies'],
      ['cosmic-wall', 'Mur cosmique'],
      ['cosmic-filament', 'Filament cosmique'],
      ['cosmic-void', 'Vide cosmique'],
      ['cosmic-basin', 'Bassin d’attraction'],
      ['cosmic-attractor', 'Attracteur cosmique'],
      ['cosmic-repeller', 'Répulseur cosmique'],
      ['universe', 'Univers'],
      ['artificial-object', 'Objet astronomique'],
    ];
    const confidences: readonly ScientificConfidence[] = [
      'observed',
      'calculated',
      'extrapolated',
      'simulated',
      'procedural',
      'illustrative',
    ];

    for (const [type, label] of types) {
      expect(component.typeLabel(type)).toBe(label);
    }
    expect(component.typeLabel('region', { constellationId: 'orion' })).toBe('Constellation');
    for (const confidence of confidences) {
      expect(component.confidenceLabel(confidence)).not.toBe('');
      expect(component.confidenceDescription(confidence)).toMatch(/\.$/);
    }
    expect(component.isApproximate('observed')).toBe(false);
    expect(component.isApproximate('calculated')).toBe(false);
    expect(component.isApproximate('simulated')).toBe(true);
  });

  it('formate les nombres usuels et scientifiques', () => {
    const component = createComponent();

    expect(component.formatNumber(12.345, 2)).toBe('12,35');
    expect(component.formatNumber(1_000_000_000)).toMatch(/1.*E9/i);
  });

  it('présente la masse solaire et l’activité d’un trou noir sans ambiguïté', () => {
    const component = createComponent();
    const blackHole = object({
      type: 'black-hole',
      visual: {
        visualRadius: 2,
        scaleMode: 'adaptive',
        blackHoleActivity: 'quiescent',
      },
      metadata: { massSolar: 4_000_000 },
    });

    expect(component.massSolarLabel(blackHole)).toMatch(/4.000.000 masses solaires/u);
    expect(component.blackHoleActivityLabel(blackHole)).toBe('Quiescent');
    expect(
      component.blackHoleActivityLabel(
        object({
          type: 'black-hole',
          visual: {
            visualRadius: 1,
            scaleMode: 'adaptive',
            blackHoleActivity: 'active',
          },
        }),
      ),
    ).toBe('Actif');
    expect(
      component.blackHoleActivityLabel(
        object({
          type: 'black-hole',
          visual: {
            visualRadius: 1,
            scaleMode: 'adaptive',
            blackHoleActivity: 'dormant',
          },
        }),
      ),
    ).toBe('Dormant');
    expect(component.massSolarLabel(object())).toBeNull();
    expect(component.blackHoleActivityLabel(object())).toBeNull();
    expect(component.blackHoleActivityLabel(object({ type: 'black-hole' }))).toBeNull();
  });

  it('choisit la meilleure distance disponible', () => {
    const component = createComponent();

    expect(
      component.distanceLabel(
        object({ metadata: { distanceMpc: 17.219, distanceLy: 56_000_000 } }),
      ),
    ).toBe('17,219 Mpc');
    expect(component.distanceLabel(object({ metadata: { distanceLy: 4.2465 } }))).toContain('a.l.');
    expect(component.distanceLabel(object({ metadata: { semiMajorAxisAu: 1.5237 } }))).toContain(
      'UA',
    );
    expect(component.distanceLabel(object({ metadata: { semiMajorAxisKm: 421_800 } }))).toMatch(
      /421.800 km/u,
    );
    expect(component.distanceLabel(object({ id: 'sun' }))).toBe('1 UA depuis la Terre');
    expect(component.distanceLabel(object())).toBeNull();
  });

  it('formate les métadonnées stellaires et galactiques lorsqu’elles existent', () => {
    const component = createComponent();
    const documented = object({
      metadata: {
        apparentMagnitude: -1.46,
        colorIndexBv: 0.009,
        hygId: 32_263,
        morphology: 'Sb',
        diameterLy: 120_000,
        subgroup: 'Sous-groupe d’Andromède',
        absoluteMagnitude: -21.5,
        halfLightRadiusPc: 12_300,
      },
    });
    const missing = object({ metadata: { apparentMagnitude: 'inconnue' } });

    expect(component.apparentMagnitudeLabel(documented)).toBe('-1,46');
    expect(component.colorIndexLabel(documented)).toBe('0,009');
    expect(component.catalogIdentifierLabel(documented)).toBe('HYG 32263');
    expect(component.morphologyLabel(documented)).toBe('Sb');
    expect(component.diameterLabel(documented)).toContain('a.l.');
    expect(component.subgroupLabel(documented)).toBe('Sous-groupe d’Andromède');
    expect(component.absoluteMagnitudeLabel(documented)).toBe('−21,5');
    expect(component.halfLightRadiusLabel(documented)).toMatch(/12.300 pc/u);
    expect(component.apparentMagnitudeLabel(missing)).toBeNull();
    expect(component.colorIndexLabel(missing)).toBeNull();
    expect(component.catalogIdentifierLabel(missing)).toBeNull();
    expect(component.morphologyLabel(missing)).toBeNull();
    expect(component.diameterLabel(missing)).toBeNull();
    expect(component.subgroupLabel(missing)).toBeNull();
    expect(component.absoluteMagnitudeLabel(missing)).toBeNull();
    expect(component.halfLightRadiusLabel(missing)).toBeNull();
  });

  it('présente les mesures calculées d’un groupe Cosmicflows-4', () => {
    const component = createComponent();
    const group = object({
      type: 'galaxy-cluster',
      metadata: {
        pgcId: 42,
        distanceMpc: 12.1,
        distanceModulusError: 0.12,
        velocityCmbKmPerSecond: 810,
      },
    });

    expect(component.catalogIdentifierLabel(group)).toBe('PGC 42');
    expect(component.distanceUncertaintyLabel(group)).toBe('± 0,12 mag');
    expect(component.cmbVelocityLabel(group)).toBe('810 km/s');
    expect(component.distanceUncertaintyLabel(object())).toBeNull();
    expect(component.cmbVelocityLabel(object())).toBeNull();
  });

  it('présente la méthode, l’empreinte et les mesures d’une structure cosmologique', () => {
    const component = createComponent();
    const structure = object({
      type: 'cosmic-void',
      metadata: {
        catalogIdentifier: 'CMASS-North-60',
        effectiveRadiusMpc: 46.14,
        memberGalaxyCount: 35,
        catalogConfidence: 0.996,
        densityContrast: -0.717,
        boundaryDistanceMpc: 75.006,
        detectionMethod: 'ZOBOV watershed',
        surveyEdge: false,
      },
    });

    expect(component.catalogIdentifierLabel(structure)).toBe('CMASS-North-60');
    expect(component.effectiveRadiusLabel(structure)).toBe('46,14 Mpc');
    expect(component.memberGalaxyCountLabel(structure)).toBe('35');
    expect(component.catalogConfidenceLabel(structure)).toBe('99,6 %');
    expect(component.densityContrastLabel(structure)).toBe('−71,7 %');
    expect(component.boundaryDistanceLabel(structure)).toBe('75,01 Mpc');
    expect(component.detectionMethodLabel(structure)).toBe('ZOBOV watershed');
    expect(component.surveyEdgeLabel(structure)).toBe('À l’intérieur du relevé');
    expect(component.surveyEdgeLabel(object({ metadata: { surveyEdge: true } }))).toBe(
      'Au contact de la limite',
    );
    expect(component.effectiveRadiusLabel(object())).toBeNull();
    expect(component.memberGalaxyCountLabel(object())).toBeNull();
    expect(component.catalogConfidenceLabel(object())).toBeNull();
    expect(component.densityContrastLabel(object())).toBeNull();
    expect(component.boundaryDistanceLabel(object())).toBeNull();
    expect(component.detectionMethodLabel(object())).toBeNull();
    expect(component.surveyEdgeLabel(object())).toBeNull();

    const filament = object({
      type: 'cosmic-filament',
      metadata: { lengthMpc: 24.8 },
    });

    expect(component.structureLengthLabel(filament)).toBe('24,8 Mpc');
    expect(component.structureLengthLabel(object())).toBeNull();
  });

  it('présente les métadonnées conventionnelles d’une constellation', () => {
    const component = createComponent();
    const constellation = object({
      type: 'region',
      metadata: {
        constellationId: 'orion',
        abbreviation: 'Ori',
        starCount: 8,
        segmentCount: 7,
      },
    });

    expect(component.constellationAbbreviationLabel(constellation)).toBe('Ori');
    expect(component.constellationStarCountLabel(constellation)).toBe('8');
    expect(component.constellationSegmentCountLabel(constellation)).toBe('7');
    expect(component.constellationAbbreviationLabel(object())).toBeNull();
    expect(component.constellationStarCountLabel(object())).toBeNull();
    expect(component.constellationSegmentCountLabel(object())).toBeNull();
  });

  it('rend une fiche complète puis une fiche minimale', () => {
    const fixture = TestBed.createComponent(ObjectDetailsComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.details')).toBeNull();

    facade.selectedObject.set(
      object({
        id: 'documented',
        name: 'Objet documenté',
        aliases: ['Alias A', 'Alias B'],
        parentId: 'sun',
        scientificConfidence: 'simulated',
        description: 'Une description.',
        physical: {
          radiusKm: 1_000,
          massKg: 2e20,
          temperatureK: 300,
          spectralType: 'G2V',
        },
        visual: {
          color: '#abcdef',
          secondaryColor: '#fedcba',
          visualRadius: 2,
          scaleMode: 'physical',
          rotationPeriodHours: -72,
        },
        positionProvider: keplerianProvider(800),
        metadata: {
          distanceLy: 4.2,
          apparentMagnitude: 1,
          colorIndexBv: 0.4,
          hygId: 42,
          morphology: 'Sb',
          diameterLy: 120_000,
          subgroup: 'Sous-groupe d’Andromède',
          absoluteMagnitude: -21.5,
          halfLightRadiusPc: 12_300,
          source: 'Catalogue de test',
          visualSource: 'Mosaïque instrumentale de test',
        },
      }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Objet documenté');
    expect(fixture.nativeElement.textContent).toContain('Sous-groupe d’Andromède');
    expect(fixture.nativeElement.textContent).toContain('−21,5');
    expect(fixture.nativeElement.textContent).toMatch(/12.300 pc/u);
    expect(fixture.nativeElement.textContent).toContain('Apparence');
    expect(fixture.nativeElement.textContent).toContain('Mosaïque instrumentale de test');
    expect(fixture.nativeElement.querySelector('.approximation-note')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.orbit-action')).not.toBeNull();

    facade.selectedObject.set(object({ scientificConfidence: 'calculated' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.approximation-note')).toBeNull();
    expect(fixture.nativeElement.querySelector('.orbit-action')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucune description disponible');
  });
});

interface ObjectDetailsAccess {
  focus(object: SpaceObject): void;
  viewOrbit(object: SpaceObject): void;
  hasOrbit(object: SpaceObject): boolean;
  orbitPeriodLabel(object: SpaceObject): string | null;
  rotationPeriodLabel(object: SpaceObject): string | null;
  rotationDirectionLabel(object: SpaceObject): string;
  orbitActionLabel(object: SpaceObject): string;
  typeLabel(type: SpaceObjectType, metadata?: SpaceObject['metadata']): string;
  parentName(object: SpaceObject): string | null;
  confidenceLabel(confidence: ScientificConfidence): string;
  confidenceDescription(confidence: ScientificConfidence): string;
  isApproximate(confidence: ScientificConfidence): boolean;
  formatNumber(value: number, maximumFractionDigits?: number): string;
  distanceLabel(object: SpaceObject): string | null;
  apparentMagnitudeLabel(object: SpaceObject): string | null;
  colorIndexLabel(object: SpaceObject): string | null;
  catalogIdentifierLabel(object: SpaceObject): string | null;
  effectiveRadiusLabel(object: SpaceObject): string | null;
  structureLengthLabel(object: SpaceObject): string | null;
  memberGalaxyCountLabel(object: SpaceObject): string | null;
  catalogConfidenceLabel(object: SpaceObject): string | null;
  densityContrastLabel(object: SpaceObject): string | null;
  boundaryDistanceLabel(object: SpaceObject): string | null;
  detectionMethodLabel(object: SpaceObject): string | null;
  surveyEdgeLabel(object: SpaceObject): string | null;
  distanceUncertaintyLabel(object: SpaceObject): string | null;
  cmbVelocityLabel(object: SpaceObject): string | null;
  morphologyLabel(object: SpaceObject): string | null;
  diameterLabel(object: SpaceObject): string | null;
  subgroupLabel(object: SpaceObject): string | null;
  absoluteMagnitudeLabel(object: SpaceObject): string | null;
  halfLightRadiusLabel(object: SpaceObject): string | null;
  constellationAbbreviationLabel(object: SpaceObject): string | null;
  constellationStarCountLabel(object: SpaceObject): string | null;
  constellationSegmentCountLabel(object: SpaceObject): string | null;
  massSolarLabel(object: SpaceObject): string | null;
  blackHoleActivityLabel(object: SpaceObject): string | null;
}

function createComponent(): ObjectDetailsAccess {
  return TestBed.createComponent(ObjectDetailsComponent)
    .componentInstance as unknown as ObjectDetailsAccess;
}

function object(
  overrides: Partial<SpaceObject> & { rotationPeriodHours?: number } = {},
): SpaceObject {
  const { rotationPeriodHours, ...objectOverrides } = overrides;

  return {
    id: 'earth',
    name: 'Terre',
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
      ...(rotationPeriodHours === undefined ? {} : { rotationPeriodHours }),
    },
    positionProvider: staticProvider(),
    ...objectOverrides,
  };
}

function staticProvider(): PositionProviderDefinition {
  return {
    type: 'static',
    position: [0, 0, 0],
    unit: 'astronomical-unit',
  };
}

function keplerianProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'keplerian',
    semiMajorAxis: 1,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    epochJulianDay: 2_451_545,
    orbitalPeriodDays,
    unit: 'astronomical-unit',
  };
}

function ephemerisProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'ephemeris',
    body: 'earth',
    origin: 'sun',
    orbitalPeriodDays,
    orbitEpochJulianDay: 2_451_545,
  };
}
