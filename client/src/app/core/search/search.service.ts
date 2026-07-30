import { Injectable } from '@angular/core';
import { SearchEntry, SpaceObject } from '../../../data/models/universe.models';
import { LocalSearchIndex } from './search-index';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly index = new LocalSearchIndex();

  public setData(
    objects: readonly SpaceObject[],
    catalogEntries: readonly SearchEntry[] = [],
  ): void {
    this.index.build(objects, catalogEntries);
  }

  public search(query: string, limit = 8): SearchEntry[] {
    return this.index.search(query, limit);
  }
}
