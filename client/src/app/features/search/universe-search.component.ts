import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SearchEntry, SpaceObjectType } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { SearchService } from '../../core/search/search.service';

@Component({
  selector: 'app-universe-search',
  styleUrl: './universe-search.component.scss',
  templateUrl: './universe-search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSearchComponent {
  protected readonly query = signal('');
  protected readonly active = signal(false);
  protected readonly results = computed(() => this.searchService.search(this.query()));

  private readonly searchService = inject(SearchService);
  private readonly facade = inject(UniverseEngineFacade);

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected choose(result: SearchEntry): void {
    this.query.set('');
    this.active.set(false);
    void this.facade.focus(result.id);
  }

  protected clear(): void {
    this.query.set('');
  }

  protected typeLabel(type: SpaceObjectType): string {
    const labels: Partial<Record<SpaceObjectType, string>> = {
      star: 'Étoile',
      planet: 'Planète',
      moon: 'Lune',
      galaxy: 'Galaxie',
      'dwarf-planet': 'Planète naine',
      asteroid: 'Astéroïde',
      comet: 'Comète',
    };

    return labels[type] ?? 'Objet';
  }
}
