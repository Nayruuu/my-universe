import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { UniverseEngineFacade } from './core/engine/universe-engine.facade';
import { I18nService, isAppLanguage, SUPPORTED_LANGUAGES } from './core/i18n/i18n.service';
import { SeoService } from './core/seo/seo.service';
import { KeyboardShortcutService } from './core/settings/keyboard-shortcut.service';
import { FloatingControlsComponent } from './features/controls/floating-controls.component';
import { DebugPanelComponent } from './features/debug/debug-panel.component';
import { MapScaleComponent } from './features/map-scale/map-scale.component';
import { ObjectDetailsComponent } from './features/object-details/object-details.component';
import { ScaleNavigatorComponent } from './features/scale-navigator/scale-navigator.component';
import { UniverseSearchComponent } from './features/search/universe-search.component';
import { TimelineComponent } from './features/timeline/timeline.component';
import { UniverseViewComponent } from './features/universe-view/universe-view.component';

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UniverseViewComponent,
    UniverseSearchComponent,
    ObjectDetailsComponent,
    TimelineComponent,
    FloatingControlsComponent,
    DebugPanelComponent,
    MapScaleComponent,
    ScaleNavigatorComponent,
  ],
})
export class App implements OnInit, OnDestroy {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly languages = SUPPORTED_LANGUAGES;
  protected readonly navigationHintVisible = signal(true);

  private readonly shortcuts = inject(KeyboardShortcutService);
  private readonly seo = inject(SeoService);
  private hintTimer: number | null = null;

  constructor() {
    effect(() => this.seo.update(this.i18n.lang(), this.i18n.content().seo));
  }

  public ngOnInit(): void {
    this.i18n.start();
    this.shortcuts.start();
    this.hintTimer = window.setTimeout(() => this.navigationHintVisible.set(false), 7_000);
  }

  public ngOnDestroy(): void {
    this.i18n.stop();
    this.shortcuts.stop();
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer);
    }
  }

  protected focus(objectId: string): void {
    void this.facade.focus(objectId);
  }

  protected async changeLanguage(event: Event): Promise<void> {
    const language = (event.target as HTMLSelectElement).value;

    if (isAppLanguage(language)) {
      await this.i18n.setLanguage(language);
    }
  }
}
