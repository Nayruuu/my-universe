import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PositionProviderDefinition,
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { EarthSkyJourney } from '../stellar-observation/earth-sky-journey';
import { EarthSkyViewState } from '../stellar-observation/earth-sky-view-state';
import { ObjectDetailsComponent } from './object-details.component';
import type { ObjectDetailsPresenter } from './object-details.presenter';

describe('ObjectDetailsComponent', () => {
  const sun = object({ id: 'sun', name: 'Soleil', type: 'star' });
  const objects = signal<readonly SpaceObject[]>([sun]);
  const currentTime = signal({ julianDay: 2_461_056.416_666_666_5 });
  const displayOptions = signal({
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium' as const,
    labelDensity: 'balanced' as const,
    temporalMode: 'state' as 'state' | 'observable',
  });
  const facade = {
    selectedObject: signal<SpaceObject | null>(null),
    objects,
    currentTime,
    displayOptions,
    closeDetails: vi.fn(),
    focus: vi.fn(() => Promise.resolve()),
    viewRotation: vi.fn(() => Promise.resolve()),
    viewOrbit: vi.fn(),
    exitEarthObservation: vi.fn(),
    setTime: vi.fn(),
    setTemporalMode: vi.fn((temporalMode: 'state' | 'observable') =>
      displayOptions.update((options) => ({ ...options, temporalMode })),
    ),
  };
  const earthSkyJourney = {
    start: vi.fn(() => Promise.resolve()),
    retarget: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/');
    objects.set([sun]);
    facade.selectedObject.set(null);
    displayOptions.update((options) => ({ ...options, temporalMode: 'state' }));
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ObjectDetailsComponent],
      providers: [
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: EarthSkyJourney, useValue: earthSkyJourney },
      ],
    });
    TestBed.inject(EarthSkyViewState).close();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('délègue le focus, la rotation et le cadrage orbital', () => {
    const component = createComponent();
    const earth = object({ id: 'earth', name: 'Terre', parentId: 'sun' });

    component.focus(earth);
    component.viewRotation(earth);
    component.viewOrbit(earth);

    expect(facade.focus).toHaveBeenCalledWith('earth');
    expect(facade.viewRotation).toHaveBeenCalledWith('earth');
    expect(facade.viewOrbit).toHaveBeenCalledWith('earth');
  });

  it('recentre une autre étoile sans quitter le planétarium', () => {
    const component = createComponent();
    const sirius = observableStar('sirius', 'Sirius', 101.287_155, -16.716_116);
    const betelgeuse = observableStar('betelgeuse', 'Bételgeuse', 88.792_939, 7.407_064);

    TestBed.inject(EarthSkyViewState).open('sirius', 'Sirius', sirius);
    component.focus(betelgeuse);

    expect(earthSkyJourney.retarget).toHaveBeenCalledWith(betelgeuse);
    expect(facade.focus).not.toHaveBeenCalled();

    component.focus(object({ id: 'earth', name: 'Terre' }));
    expect(facade.focus).toHaveBeenCalledWith('earth');
    expect(facade.exitEarthObservation).toHaveBeenCalledOnce();
    expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    expect(TestBed.inject(EarthSkyViewState).phase()).toBe('closed');
    expect(new URL(window.location.href).searchParams.get('view')).toBe('map');
  });

  it('quitte le planétarium avant d’activer une caméra spatiale', () => {
    const component = createComponent();
    const earth = object({ id: 'earth', name: 'Terre', parentId: 'sun' });
    const viewState = TestBed.inject(EarthSkyViewState);

    viewState.open('sun', 'Soleil', sun);
    component.viewRotation(earth);

    expect(facade.exitEarthObservation).toHaveBeenCalledOnce();
    expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    expect(facade.viewRotation).toHaveBeenCalledWith('earth');
    expect(viewState.phase()).toBe('closed');
    expect(new URL(window.location.href).searchParams.get('view')).toBe('map');

    viewState.open('sun', 'Soleil', sun);
    component.viewOrbit(earth);

    expect(facade.exitEarthObservation).toHaveBeenCalledTimes(2);
    expect(facade.setTemporalMode).toHaveBeenCalledTimes(2);
    expect(facade.viewOrbit).toHaveBeenCalledWith('earth');
    expect(viewState.phase()).toBe('closed');
    expect(new URL(window.location.href).searchParams.get('view')).toBe('map');
  });

  it('ouvre le localisateur terrestre pour les étoiles, planètes et satellites pris en charge', () => {
    const component = createComponent();
    const sirius = object({
      id: 'sirius',
      name: 'Sirius',
      type: 'star',
      metadata: {
        rightAscensionDegrees: 101.287_161_3,
        declinationDegrees: -16.716_122,
        skyCoordinateEpoch: 'J2000',
      },
    });

    expect(component.canObserveFromEarth(sirius)).toBe(true);
    expect(component.canObserveFromEarth(object({ type: 'star' }))).toBe(false);
    expect(
      component.canObserveFromEarth(
        object({
          type: 'star',
          metadata: {
            rightAscensionDegrees: 101.287_161_3,
            declinationDegrees: -16.716_122,
            skyCoordinateEpoch: 'B1950',
          },
        }),
      ),
    ).toBe(false);
    expect(
      component.canObserveFromEarth(object({ type: 'planet', metadata: sirius.metadata })),
    ).toBe(false);
    expect(component.canObserveFromEarth(object({ id: 'mars', name: 'Mars' }))).toBe(true);
    expect(component.canObserveFromEarth(titan())).toBe(true);

    component.observeFromEarth(sirius);
    expect(earthSkyJourney.start).toHaveBeenCalledWith(sirius);
    expect(facade.setTemporalMode).not.toHaveBeenCalled();

    const fixture = TestBed.createComponent(ObjectDetailsComponent);

    facade.selectedObject.set(sirius);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-stellar-observation')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.observation-action')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Localiser Sirius');

    const earthSkyViewState = TestBed.inject(EarthSkyViewState);

    earthSkyViewState.open('sirius', 'Sirius', sirius);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.observation-action')).toBeNull();

    earthSkyViewState.close();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.observation-action')).not.toBeNull();
  });

  it('détecte les orbites képlériennes et les éphémérides', () => {
    const component = createComponent();
    const withoutParent = object({ positionProvider: staticProvider() });
    const staticChild = object({ parentId: 'sun', positionProvider: staticProvider() });
    const keplerian = object({ parentId: 'sun', positionProvider: keplerianProvider(365.25) });
    const ephemeris = object({ parentId: 'sun', positionProvider: ephemerisProvider(730.5) });
    const illustrative = object({
      parentId: 'sun',
      positionProvider: illustrativeOrbitProvider(384.843),
    });

    expect(component.hasOrbit(withoutParent)).toBe(false);
    expect(component.hasOrbit(staticChild)).toBe(false);
    expect(component.hasOrbit(keplerian)).toBe(true);
    expect(component.hasOrbit(ephemeris)).toBe(true);
    expect(component.hasOrbit(illustrative)).toBe(true);
    expect(component.orbitPeriodLabel(staticChild)).toBeNull();
    expect(component.orbitPeriodLabel(keplerian)).toContain('365,25 jours');
    expect(component.orbitPeriodLabel(ephemeris)).toContain('2 ans');
    expect(component.orbitPeriodLabel(illustrative)).toContain('384,84 jours');
  });

  it('présente et ouvre l’époque historique d’une supernova sans la déclarer exacte', () => {
    const component = createComponent();
    const supernova = object({
      id: 'sn-1987a',
      type: 'supernova',
      metadata: {
        eventDateLabel: '23 février 1987 · découverte',
        visualPeakJulianDay: 2_446_849.5,
        visualDateConfidence: 'discovery-anchor',
        supernovaType: 'II-pec',
        appearanceConfidence: 'illustrative',
      },
    });
    const undatedRemnant = object({
      id: 'cassiopeia-a',
      type: 'supernova-remnant',
      metadata: { eventDateLabel: 'Vers 1680 · date incertaine' },
    });

    expect(component.supernovaEventLabel(supernova)).toBe('23 février 1987 · découverte');
    expect(component.supernovaTypeLabel(supernova)).toBe('II-pec');
    expect(component.hasIllustrativeAppearance(supernova)).toBe(true);
    expect(component.hasSupernovaEvent(supernova)).toBe(true);
    expect(component.hasSupernovaEvent(undatedRemnant)).toBe(false);
    expect(component.supernovaTypeLabel(undatedRemnant)).toBeNull();
    expect(component.hasIllustrativeAppearance(undatedRemnant)).toBe(false);

    component.viewSupernovaEvent(supernova);
    component.viewSupernovaEvent(undatedRemnant);

    expect(facade.setTime).toHaveBeenCalledOnce();
    expect(facade.setTime).toHaveBeenCalledWith({ julianDay: 2_446_849.5 });
    expect(facade.focus).toHaveBeenCalledWith('sn-1987a');
  });

  it('affiche le retard lumineux et l’époque d’émission uniquement en mode observable', () => {
    const fixture = TestBed.createComponent(ObjectDetailsComponent);

    facade.selectedObject.set(sun);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Temps de trajet lumineux');

    facade.setTemporalMode('observable');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Temps de trajet lumineux');
    expect(fixture.nativeElement.textContent).toContain('Époque d’émission');
    expect(fixture.nativeElement.textContent).toMatch(/8[,.]\d+ min/u);
    expect(fixture.nativeElement.textContent).toContain('2026');
  });

  it('identifie le redshift cosmologique inféré sans déplacer la structure', () => {
    const fixture = TestBed.createComponent(ObjectDetailsComponent);
    const structure = object({
      type: 'supercluster',
      referenceFrame: 'cosmic-web',
      metadata: {
        receivedLightDistanceModel: 'flat-lambda-cdm-comoving-distance',
        cosmologicalRedshift: 0.5,
        cosmologicalRedshiftOrigin: 'inferred-from-comoving-distance',
      },
    });

    facade.selectedObject.set(structure);
    facade.setTemporalMode('observable');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Redshift du modèle');
    expect(fixture.nativeElement.textContent).toContain('z ≈ 0,5');
    expect(fixture.nativeElement.textContent).toContain('distance comobile');
    expect(structure.positionProvider).toEqual(staticProvider());
  });

  it('explique les paramètres spécifiques d’une exoplanète sans confondre mesure et rendu', () => {
    const component = createComponent();
    const exoplanet = object({
      type: 'exoplanet',
      positionProvider: illustrativeOrbitProvider(384.843),
      metadata: {
        equilibriumTemperatureK: 265,
        discoveryYear: 2015,
        massProvenance: 'M-R relationship',
      },
    });

    expect(component.hasIllustrativeOrbit(exoplanet)).toBe(true);
    expect(component.hasIllustrativeOrbit(object())).toBe(false);
    expect(component.equilibriumTemperatureLabel(exoplanet)).toBe('265 K');
    expect(component.equilibriumTemperatureLabel(object())).toBeNull();
    expect(component.discoveryYearLabel(exoplanet)).toBe('2 015');
    expect(component.discoveryYearLabel(object())).toBeNull();
    expect(component.massProvenanceLabel(exoplanet)).toBe('Estimée par relation masse–rayon');
    expect(component.massProvenanceLabel(object({ metadata: { massProvenance: 'Mass' } }))).toBe(
      'Masse mesurée',
    );
    expect(component.massProvenanceLabel(object())).toBeNull();
    expect(
      component.semiMajorAxisLabel(
        object({ metadata: { semiMajorAxisAu: 1.046, distanceLy: 1799.49 } }),
      ),
    ).toBe('1,046 UA');
    expect(component.semiMajorAxisLabel(object())).toBeNull();
    expect(
      component.orbitApproximationNote(
        object({
          type: 'exoplanet',
          positionProvider: illustrativeOrbitProvider(20),
          metadata: {
            semiMajorAxisSource: 'NASA Exoplanet Archive',
            orbitalPeriodSource: 'NASA Exoplanet Archive',
          },
        }),
      ),
    ).toContain('proviennent du catalogue');
    expect(
      component.orbitApproximationNote(
        object({
          type: 'exoplanet',
          positionProvider: illustrativeOrbitProvider(20),
          metadata: {
            semiMajorAxisSource: 'Illustrative map spacing',
            orbitalPeriodSource: 'Illustrative map timing',
          },
        }),
      ),
    ).toContain('espacement et la période sont illustratifs');
    expect(
      component.orbitApproximationNote(
        object({
          type: 'exoplanet',
          positionProvider: illustrativeOrbitProvider(20),
          metadata: {
            semiMajorAxisSource: 'Calculated from Kepler’s third law',
            orbitalPeriodSource: 'NASA Exoplanet Archive',
          },
        }),
      ),
    ).toContain('troisième loi de Kepler');
    expect(
      component.orbitApproximationNote(
        object({
          type: 'exoplanet',
          positionProvider: illustrativeOrbitProvider(20),
          metadata: {
            semiMajorAxisSource: 'Illustrative map spacing',
            orbitalPeriodSource: 'NASA Exoplanet Archive',
          },
        }),
      ),
    ).toContain('Un paramètre orbital absent');
    expect(
      component.mapDistanceNotice(
        object({
          metadata: {
            mapDistanceUnavailable: true,
            mapDistanceFallbackPc: 1_000,
          },
        }),
      ),
    ).toContain('1 000 pc');
    expect(
      component.mapDistanceNotice(object({ metadata: { mapDistanceUnavailable: true } })),
    ).toContain('profondeur illustrative de inconnue pc');
    expect(component.mapDistanceNotice(object())).toBeNull();
  });

  it('formate la période et le sens de rotation', () => {
    const component = createComponent();

    expect(component.rotationPeriodLabel(object())).toBeNull();
    expect(component.rotationPeriodLabel(object({ rotationHours: 23.5 }))).toBe('23 h 30 min');
    expect(component.rotationPeriodLabel(object({ rotationHours: -48 }))).toContain('2 jours');
    expect(component.rotationDirectionLabel(object({ rotationHours: -10 }))).toBe('Rétrograde');
    expect(component.rotationDirectionLabel(object({ rotationHours: 10 }))).toBe('Prograde');
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
      ['exoplanet', 'Exoplanète confirmée'],
      ['moon', 'Satellite naturel'],
      ['galaxy', 'Galaxie'],
      ['dwarf-planet', 'Planète naine'],
      ['asteroid', 'Astéroïde'],
      ['comet', 'Comète'],
      ['nebula', 'Nébuleuse'],
      ['black-hole', 'Trou noir'],
      ['supernova', 'Supernova'],
      ['supernova-remnant', 'Rémanent de supernova'],
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
    expect(component.typeLabel('unknown' as SpaceObjectType)).toBe('Objet astronomique');
    expect(component.typeLabel('region', { constellationId: 'orion' })).toBe('Constellation');
    for (const confidence of confidences) {
      expect(component.confidenceLabel(confidence)).not.toBe('');
      expect(component.confidenceDescription(confidence)).toMatch(/\.$/);
    }
    expect(component.isApproximate('observed')).toBe(false);
    expect(component.isApproximate('calculated')).toBe(false);
    expect(component.isApproximate('simulated')).toBe(true);
  });

  it('localise les descriptions éditoriales sans traduire les données de catalogue', async () => {
    const component = createComponent();
    const i18n = TestBed.inject(I18nService);
    const documented = object({
      description: 'Description française détaillée.',
      metadata: {
        source: 'Scientific catalogue',
        visualSource: 'Mosaïque instrumentale',
      },
    });

    expect(component.description(documented)).toBe('Description française détaillée.');
    expect(component.appearanceDescription(documented)).toBe('Mosaïque instrumentale');

    await i18n.setLanguage('en');

    expect(component.description(documented)).toContain('Scientific catalogue');
    expect(component.description(object())).toContain('Prototype static data');
    expect(component.appearanceDescription(documented)).toContain(
      'Scientific appearance adapted for visualization',
    );
    expect(component.appearanceDescription(object())).toBeNull();
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
        catalogConfidenceMeaning: 'Probabilité intrinsèque publiée',
        extentMeaning: 'Rayon sphérique visuel équivalent',
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
    expect(component.catalogConfidenceMeaningLabel(structure)).toBe(
      'Probabilité intrinsèque publiée',
    );
    expect(component.extentMeaningLabel(structure)).toBe('Rayon sphérique visuel équivalent');
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
    expect(component.catalogConfidenceMeaningLabel(object())).toBeNull();
    expect(component.extentMeaningLabel(object())).toBeNull();
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
          shape: {
            type: 'triaxial-ellipsoid',
            dimensionsKm: [26.06, 22.8, 18.28],
            scientificConfidence: 'observed',
            source: 'NASA Planetary Data System',
          },
        },
        visual: {
          color: '#abcdef',
          secondaryColor: '#fedcba',
          visualRadius: 2,
          scaleMode: 'physical',
        },
        rotation: rotation(-72),
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
    expect(fixture.nativeElement.textContent).toContain('26,06 × 22,8 × 18,28 km');
    expect(fixture.nativeElement.textContent).toContain('NASA Planetary Data System');
    expect(fixture.nativeElement.querySelector('.approximation-note')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.orbit-action')).not.toBeNull();

    facade.selectedObject.set(object({ scientificConfidence: 'calculated' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.approximation-note')).toBeNull();
    expect(fixture.nativeElement.querySelector('.orbit-action')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucune description disponible');
  });
});

type ObjectDetailsAccess = ObjectDetailsPresenter & {
  canObserveFromEarth(object: SpaceObject): boolean;
  focus(object: SpaceObject): void;
  observeFromEarth(object: SpaceObject): void;
  viewRotation(object: SpaceObject): void;
  viewOrbit(object: SpaceObject): void;
  viewSupernovaEvent(object: SpaceObject): void;
};

function createComponent(): ObjectDetailsAccess {
  const component = TestBed.createComponent(ObjectDetailsComponent).componentInstance;
  const presenter = Reflect.get(component, 'presenter') as ObjectDetailsPresenter;

  return new Proxy(component as unknown as ObjectDetailsAccess, {
    get(target, property, receiver) {
      const source = property in target ? target : presenter;
      const value = Reflect.get(source, property, source === target ? receiver : source) as unknown;

      return typeof value === 'function' ? value.bind(source) : value;
    },
  });
}

function titan(): SpaceObject {
  return object({
    id: 'titan',
    name: 'Titan',
    type: 'moon',
    parentId: 'saturn',
    scientificConfidence: 'extrapolated',
    physical: { radiusKm: 2_574.76 },
    positionProvider: {
      type: 'keplerian',
      semiMajorAxis: 1_221_900,
      eccentricity: 0.029,
      inclination: 0.3,
      longitudeOfAscendingNode: 78.6,
      argumentOfPeriapsis: 78.3,
      meanAnomalyAtEpoch: 11.7,
      epochJulianDay: 2_451_545,
      orbitalPeriodDays: 15.945448,
      unit: 'kilometer',
      referencePlanePole: { rightAscensionDegrees: 40.6, declinationDegrees: 83.5 },
    },
  });
}

function object(overrides: Partial<SpaceObject> & { rotationHours?: number } = {}): SpaceObject {
  const { rotationHours, ...objectOverrides } = overrides;

  return {
    id: 'earth',
    name: 'Terre',
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    ...(rotationHours === undefined ? {} : { rotation: rotation(rotationHours) }),
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: staticProvider(),
    ...objectOverrides,
  };
}

function observableStar(
  id: string,
  name: string,
  rightAscensionDegrees: number,
  declinationDegrees: number,
): SpaceObject {
  return object({
    id,
    name,
    type: 'star',
    referenceFrame: 'stellar',
    metadata: {
      rightAscensionDegrees,
      declinationDegrees,
      skyCoordinateEpoch: 'J2000',
    },
  });
}

function rotation(periodHours: number): NonNullable<SpaceObject['rotation']> {
  return {
    siderealPeriodHours: Math.abs(periodHours),
    direction: periodHours < 0 ? 'retrograde' : 'prograde',
    bodyFixedFrame: 'IAU_TEST',
    orientationModel: 'iau-wgccre-2015',
    scientificConfidence: 'calculated',
    source: 'NASA/JPL test fixture',
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

function illustrativeOrbitProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'illustrative-orbit',
    semiMajorAxis: 1,
    orbitalPeriodDays,
    epochJulianDay: 2_451_545,
    visualPhaseAtEpochDegrees: 0,
    visualInclinationDegrees: 0,
    unit: 'astronomical-unit',
  };
}
