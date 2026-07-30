import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

@Component({
  selector: 'app-universe-view',
  styleUrl: './universe-view.component.scss',
  templateUrl: './universe-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseViewComponent implements AfterViewInit, OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly facade = inject(UniverseEngineFacade);
  private readonly zone = inject(NgZone);
  private resizeObserver: ResizeObserver | null = null;

  public ngAfterViewInit(): void {
    const element = this.host().nativeElement;

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        const { width, height } = entry.contentRect;

        this.facade.resize(width, height);
      }
    });
    this.resizeObserver.observe(element);

    this.zone.runOutsideAngular(() => {
      void this.facade.initialize(element);
    });

    window.addEventListener('resize', this.handleWindowResize);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleWindowResize);
    this.resizeObserver?.disconnect();
    this.facade.dispose();
  }

  private readonly handleWindowResize = (): void => {
    const host = this.host().nativeElement;

    this.facade.resize(host.clientWidth, host.clientHeight);
  };
}
