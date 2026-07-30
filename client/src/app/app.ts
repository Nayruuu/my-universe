import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { UniverseEngineFacade } from './core/engine/universe-engine.facade';
import { KeyboardShortcutService } from './core/settings/keyboard-shortcut.service';
import { FloatingControlsComponent } from './features/controls/floating-controls.component';
import { DebugPanelComponent } from './features/debug/debug-panel.component';
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
    ScaleNavigatorComponent,
  ],
})
export class App implements OnInit, OnDestroy {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly navigationHintVisible = signal(true);

  private readonly shortcuts = inject(KeyboardShortcutService);
  private hintTimer: number | null = null;

  public ngOnInit(): void {
    this.shortcuts.start();
    this.hintTimer = window.setTimeout(() => this.navigationHintVisible.set(false), 7_000);
  }

  public ngOnDestroy(): void {
    this.shortcuts.stop();
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer);
    }
  }

  protected focus(objectId: string): void {
    void this.facade.focus(objectId);
  }
}
