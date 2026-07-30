import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NavigationScaleDefinition,
  NAVIGATION_SCALES,
} from '../../../engine/camera/navigation-scales';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { ScaleNavigatorComponent } from './scale-navigator.component';

describe('ScaleNavigatorComponent', () => {
  const lodLevel = signal(0);
  const facade = {
    lodLevel,
    viewScale: vi.fn(),
  };

  beforeEach(() => {
    lodLevel.set(0);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ScaleNavigatorComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('affiche le niveau courant et ouvre puis ferme le menu', () => {
    const component = createComponent();

    expect(component.scaleLabel()).toBe('Planétaire');
    component.toggleMenu();
    expect(component.menuOpen()).toBe(true);
    component.toggleMenu();
    expect(component.menuOpen()).toBe(false);

    lodLevel.set(4);
    expect(component.scaleLabel()).toBe('Groupe local');
  });

  it('ferme le menu avant de naviguer vers une échelle', () => {
    const component = createComponent();
    const scale = NAVIGATION_SCALES[2]!;

    component.toggleMenu();
    component.viewScale(scale);

    expect(component.menuOpen()).toBe(false);
    expect(facade.viewScale).toHaveBeenCalledWith(scale);
  });

  it('rend le menu et distingue l’échelle active des autres', () => {
    const fixture = TestBed.createComponent(ScaleNavigatorComponent);
    const component = fixture.componentInstance as unknown as ScaleNavigatorAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.scale-menu')).toBeNull();

    component.toggleMenu();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.scale-menu button')).toHaveLength(
      NAVIGATION_SCALES.length,
    );
    expect(fixture.nativeElement.querySelectorAll('.scale-menu button.active')).toHaveLength(1);

    fixture.nativeElement
      .querySelector('.scale-switcher')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.menuOpen()).toBe(false);
  });
});

interface ScaleNavigatorAccess {
  readonly menuOpen: ReturnType<typeof signal<boolean>>;
  scaleLabel(): string;
  toggleMenu(): void;
  viewScale(scale: NavigationScaleDefinition): void;
}

function createComponent(): ScaleNavigatorAccess {
  return TestBed.createComponent(ScaleNavigatorComponent)
    .componentInstance as unknown as ScaleNavigatorAccess;
}
