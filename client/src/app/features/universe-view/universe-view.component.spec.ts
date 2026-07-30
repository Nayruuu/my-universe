import { TestBed } from '@angular/core/testing';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { UniverseViewComponent } from './universe-view.component';

describe('UniverseViewComponent', () => {
  const facade = {
    initialize: vi.fn(() => Promise.resolve()),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  let observer: ResizeObserverMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observer = new ResizeObserverMock(callback);

          return observer;
        }
      },
    );
    await TestBed.configureTestingModule({
      imports: [UniverseViewComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('initialise le moteur hors Angular et suit les deux sources de resize', () => {
    const fixture = TestBed.createComponent(UniverseViewComponent);
    const host = fixture.nativeElement.querySelector('.universe-host') as HTMLDivElement;

    Object.defineProperties(host, {
      clientWidth: { value: 640 },
      clientHeight: { value: 360 },
    });
    fixture.detectChanges();

    expect(observer.observe).toHaveBeenCalledWith(host);
    expect(facade.initialize).toHaveBeenCalledWith(host);

    observer.emit([]);
    expect(facade.resize).not.toHaveBeenCalled();

    observer.emit([{ contentRect: { width: 800, height: 450 } }]);
    expect(facade.resize).toHaveBeenCalledWith(800, 450);

    window.dispatchEvent(new Event('resize'));
    expect(facade.resize).toHaveBeenCalledWith(640, 360);

    fixture.destroy();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(facade.dispose).toHaveBeenCalledOnce();
  });

  it('accepte une destruction avant la création de l’observateur', () => {
    const component = TestBed.runInInjectionContext(() => new UniverseViewComponent());

    component.ngOnDestroy();

    expect(facade.dispose).toHaveBeenCalledOnce();
  });
});

class ResizeObserverMock {
  public readonly observe = vi.fn();
  public readonly unobserve = vi.fn();
  public readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {}

  public emit(entries: readonly object[]): void {
    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}
