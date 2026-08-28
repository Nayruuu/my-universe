import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type {
  SearchEntry,
  SpaceObjectType,
  UniverseTime,
} from '../../../data/models/universe.models';
import { formatUniverseClock, julianDayToDate } from '../../../engine/simulation/time-utils';
import { I18nService } from '../../core/i18n/i18n.service';
import { UniverseSearchComponent } from '../search/universe-search.component';
import type {
  EarthObservationPlan,
  EarthObservationPlannerItem,
} from './earth-observation-planner';
import {
  EARTH_OBSERVATION_TIMELINE_CHART_HEIGHT,
  EARTH_OBSERVATION_TIMELINE_CHART_WIDTH,
  type EarthObservationTimeline,
} from './earth-observation-timeline';

@Component({
  selector: 'app-earth-observation-planner',
  styleUrl: './earth-observation-planner.component.scss',
  templateUrl: './earth-observation-planner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UniverseSearchComponent],
})
export class EarthObservationPlannerComponent {
  public readonly plan = input.required<EarthObservationPlan>();
  public readonly timeline = input<EarthObservationTimeline | null>(null);
  public readonly timeZone = input.required<string>();
  public readonly closeRequested = output<void>();
  public readonly itemSelected = output<EarthObservationPlannerItem>();
  public readonly targetSelected = output<SearchEntry>();
  public readonly timelineSelected = output<EarthObservationTimeline>();
  protected readonly i18n = inject(I18nService);
  protected readonly chartWidth = EARTH_OBSERVATION_TIMELINE_CHART_WIDTH;
  protected readonly chartHeight = EARTH_OBSERVATION_TIMELINE_CHART_HEIGHT;
  protected readonly targetSearchTypes: readonly SpaceObjectType[] = ['star', 'planet', 'moon'];
  protected readonly excludedTargetIds: readonly string[] = ['sun', 'earth'];

  protected formatTime(time: UniverseTime): string {
    return formatUniverseClock(time, this.timeZone(), this.i18n.locale());
  }

  protected formatShortTime(time: UniverseTime | null): string {
    return time
      ? new Intl.DateTimeFormat(this.i18n.locale(), {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: this.timeZone(),
        }).format(julianDayToDate(time.julianDay))
      : this.i18n.content().stellarObservation.plannerUnavailable;
  }
}
