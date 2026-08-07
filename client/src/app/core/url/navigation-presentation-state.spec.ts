import { TestBed } from '@angular/core/testing';
import type { NavigationState } from '../../../data/models/universe.models';
import { NavigationPresentationState } from './navigation-presentation-state';
import { NavigationUrlService } from './navigation-url.service';

describe('NavigationPresentationState', () => {
  const urlService = {
    read: vi.fn<() => Partial<NavigationState>>(() => ({})),
    updateViewContext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    urlService.read.mockReturnValue({});
    TestBed.configureTestingModule({
      providers: [
        NavigationPresentationState,
        { provide: NavigationUrlService, useValue: urlService },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('utilise la carte sans observateur en l’absence de paramètres', () => {
    const state = TestBed.inject(NavigationPresentationState);

    expect(state.viewMode()).toBe('map');
    expect(state.observerLocationId()).toBeNull();
  });

  it('restaure puis synchronise la vue et le lieu avec l’URL', () => {
    urlService.read.mockReturnValue({
      view: 'planetarium',
      observerLocationId: 'geonames-1850147',
    });
    const state = TestBed.inject(NavigationPresentationState);

    expect(state.viewMode()).toBe('planetarium');
    expect(state.observerLocationId()).toBe('geonames-1850147');

    state.setObserverLocationId('paris');
    expect(urlService.updateViewContext).toHaveBeenLastCalledWith('planetarium', 'paris');

    state.setViewMode('map');
    expect(urlService.updateViewContext).toHaveBeenLastCalledWith('map', 'paris');
  });
});
