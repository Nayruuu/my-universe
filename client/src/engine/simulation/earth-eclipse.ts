import { EclipseKind } from 'astronomy-engine';
import { UniverseTime, Vector3Like } from '../../data/models/universe.models';

export type EarthEclipseFamily = 'solar' | 'lunar';
export type EarthEclipseKind = 'penumbral' | 'partial' | 'annular' | 'total';
export type EarthEclipseScope = 'instant' | 'global' | 'local';
export type LunarEclipsePhase = 'none' | 'penumbral' | 'partial' | 'total';
export type SolarEclipsePhase = 'none' | 'partial' | 'annular' | 'total';

export interface SolarEclipseContact {
  readonly time: UniverseTime;
  readonly sunAltitudeDegrees: number;
  readonly aboveHorizon: boolean;
}

export interface LocalSolarEclipseContacts {
  readonly partialBegin: SolarEclipseContact;
  readonly centralBegin: SolarEclipseContact | null;
  readonly maximum: SolarEclipseContact;
  readonly centralEnd: SolarEclipseContact | null;
  readonly partialEnd: SolarEclipseContact;
}

export interface EarthEclipseEvent {
  id: string;
  family: EarthEclipseFamily;
  kind: EarthEclipseKind;
  scope: EarthEclipseScope;
  peak: UniverseTime;
  obscuration: number | null;
  durationMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  observerName: string | null;
  observerTimeZone: string | null;
  sunAltitudeDegrees: number | null;
  localContacts: LocalSolarEclipseContacts | null;
}

export interface LunarEclipseAppearance {
  phase: LunarEclipsePhase;
  shadowAxis: Vector3Like;
  shadowOffsetInMoonRadii: Vector3Like;
  umbraRadiusInMoonRadii: number;
  penumbraRadiusInMoonRadii: number;
}

export interface SolarEclipseAppearance {
  phase: SolarEclipsePhase;
  sunPositionInEarthRadii: Vector3Like;
  moonPositionInEarthRadii: Vector3Like;
  shadowDirection: Vector3Like;
  centralLatitude: number | null;
  centralLongitude: number | null;
}

export function mapAstronomyEclipseKind(kind: EclipseKind): EarthEclipseKind {
  switch (kind) {
    case EclipseKind.Penumbral:
      return 'penumbral';
    case EclipseKind.Partial:
      return 'partial';
    case EclipseKind.Annular:
      return 'annular';
    case EclipseKind.Total:
      return 'total';
  }
}
