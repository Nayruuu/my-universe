import { AfterViewInit, Directive, ElementRef, inject, OnDestroy, output } from '@angular/core';

/** Reports layout height without coupling the canvas or camera to interface panels. */
@Directive({ selector: '[appPanelHeight]' })
export class PanelHeightDirective implements AfterViewInit, OnDestroy {
  public readonly panelHeightChange = output<number>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private resizeObserver: ResizeObserver | null = null;

  public ngAfterViewInit(): void {
    const element = this.host.nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      this.panelHeightChange.emit(Math.ceil(element.getBoundingClientRect().height));
    });
    this.resizeObserver.observe(element, { box: 'border-box' });
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
