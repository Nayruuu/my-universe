import { Injectable } from '@angular/core';
import {
  GraphicQuality,
  LabelDensity,
  NavigationState,
  TemporalMode,
} from '../../../data/models/universe.models';
import { dateToJulianDay, julianDayToDate } from '../../../engine/simulation/time-utils';

@Injectable({ providedIn: 'root' })
export class NavigationUrlService {
  private debounceId: number | null = null;
  private maximumWaitId: number | null = null;
  private pendingState: NavigationState | null = null;

  public read(): Partial<NavigationState> {
    return parseNavigationState(new URL(window.location.href));
  }

  public scheduleWrite(state: NavigationState): void {
    this.pendingState = { ...state };
    if (this.debounceId !== null) {
      window.clearTimeout(this.debounceId);
    }
    this.debounceId = window.setTimeout(() => this.flushScheduledWrite(), 350);
    this.maximumWaitId ??= window.setTimeout(() => this.flushScheduledWrite(), 1_000);
  }

  public createShareUrl(state: NavigationState): string {
    return serializeNavigationState(state, new URL(window.location.href)).toString();
  }

  private flushScheduledWrite(): void {
    if (this.debounceId !== null) {
      window.clearTimeout(this.debounceId);
      this.debounceId = null;
    }
    if (this.maximumWaitId !== null) {
      window.clearTimeout(this.maximumWaitId);
      this.maximumWaitId = null;
    }
    if (!this.pendingState) {
      return;
    }

    const url = serializeNavigationState(this.pendingState, new URL(window.location.href));

    window.history.replaceState(null, '', url);
    this.pendingState = null;
  }
}

export function parseNavigationState(url: URL): Partial<NavigationState> {
  const params = url.searchParams;
  const mode = parseMode(params.get('mode'));
  const quality = parseQuality(params.get('quality'));
  const labelDensity = parseLabelDensity(params.get('density'));
  const time = parseTime(params.get('time'));
  const zoom = parseFiniteNumber(params.get('zoom'));

  return {
    ...(params.has('target') ? { targetId: params.get('target') || null } : {}),
    ...(params.has('selected') ? { selectedId: params.get('selected') || null } : {}),
    ...(time !== null ? { julianDay: time } : {}),
    ...(zoom !== null && zoom > 0 ? { zoom } : {}),
    ...(mode ? { mode } : {}),
    ...(quality ? { quality } : {}),
    ...(labelDensity ? { labelDensity } : {}),
    ...(params.has('orbits') ? { showOrbits: params.get('orbits') !== '0' } : {}),
    ...(params.has('constellations')
      ? { showConstellations: params.get('constellations') !== '0' }
      : {}),
    ...(params.has('labels') ? { showLabels: params.get('labels') !== '0' } : {}),
  };
}

export function serializeNavigationState(state: NavigationState, baseUrl: URL): URL {
  const url = new URL(baseUrl);
  const params = url.searchParams;
  const date = julianDayToDate(state.julianDay);

  setNullable(params, 'target', state.targetId);
  setNullable(params, 'selected', state.selectedId);
  params.set(
    'time',
    Number.isNaN(date.getTime()) ? state.julianDay.toFixed(5) : date.toISOString(),
  );
  params.set('zoom', state.zoom.toFixed(2));
  params.set('mode', state.mode);
  params.set('quality', state.quality);
  params.set('density', state.labelDensity);
  params.set('orbits', state.showOrbits ? '1' : '0');
  params.set('constellations', state.showConstellations ? '1' : '0');
  params.set('labels', state.showLabels ? '1' : '0');

  return url;
}

function parseTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 1_000_000) {
    return numeric;
  }
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : dateToJulianDay(date);
}

function parseMode(value: string | null): TemporalMode | null {
  return value === 'state' || value === 'observable' ? value : null;
}

function parseQuality(value: string | null): GraphicQuality | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function parseLabelDensity(value: string | null): LabelDensity | null {
  return value === 'minimal' || value === 'balanced' || value === 'dense' ? value : null;
}

function parseFiniteNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function setNullable(params: URLSearchParams, key: string, value: string | null): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}
