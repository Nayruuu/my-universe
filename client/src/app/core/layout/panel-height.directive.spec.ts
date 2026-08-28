import { Component, ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PanelHeightDirective } from './panel-height.directive';

@Component({ imports: [PanelHeightDirective], templateUrl: './panel-height.fixture.html' })
class PanelHost {
  public readonly height = signal(0);
}

describe('PanelHeightDirective', () => {
  let resizeCallback: ResizeObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        public readonly observe = observe;
        public readonly disconnect = disconnect;

        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
      },
    );
    TestBed.configureTestingModule({
      imports: [PanelHost],
      providers: [{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('publie la hauteur du panneau, y compris sa fermeture, et libère son observateur', () => {
    const fixture = TestBed.createComponent(PanelHost);

    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('section') as HTMLElement;
    const bounds = vi.spyOn(panel, 'getBoundingClientRect');

    expect(observe).toHaveBeenCalledWith(panel, { box: 'border-box' });
    for (const height of [62.25, 242, 0]) {
      bounds.mockReturnValue(new DOMRect(0, 0, 320, height));
      resizeCallback([], {} as ResizeObserver);
      expect(fixture.componentInstance.height()).toBe(Math.ceil(height));
    }
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('accepte une destruction avant la création de la vue', () => {
    TestBed.runInInjectionContext(() => new PanelHeightDirective()).ngOnDestroy();

    expect(disconnect).not.toHaveBeenCalled();
  });
});
