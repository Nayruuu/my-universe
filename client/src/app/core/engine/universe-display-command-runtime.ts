import {
  type DisplayOptions,
  type GraphicQuality,
  type LabelDensity,
  type TemporalMode,
} from '../../../data/models/universe.models';
import {
  type CosmicMapLayer,
  type CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
} from '../../../engine/rendering/cosmic-map-policy';

export interface UniverseDisplayCommandRuntimeEngine {
  setDisplayOptions(options: DisplayOptions): void;
  setCosmicMapLayers(layers: CosmicMapLayers): void;
}

export interface UniverseDisplayCommandRuntimeBindings {
  getDisplayOptions(): DisplayOptions;
  setDisplayOptions(options: DisplayOptions): void;
  getCosmicMapLayers(): CosmicMapLayers;
  setCosmicMapLayers(layers: CosmicMapLayers): void;
  scheduleUrlUpdate(): void;
  setPerformanceWarning(message: string): void;
  getObservableWarning(): string;
}

export class UniverseDisplayCommandRuntime {
  constructor(
    private readonly engine: UniverseDisplayCommandRuntimeEngine,
    private readonly bindings: UniverseDisplayCommandRuntimeBindings,
  ) {}

  public updateDisplayOptions(changes: Partial<DisplayOptions>): void {
    const options = { ...this.bindings.getDisplayOptions(), ...changes };

    this.bindings.setDisplayOptions(options);
    this.engine.setDisplayOptions(options);
    this.bindings.scheduleUrlUpdate();
  }

  public toggleOrbits(): void {
    this.updateDisplayOptions({ showOrbits: !this.bindings.getDisplayOptions().showOrbits });
  }

  public toggleLabels(): void {
    this.updateDisplayOptions({ showLabels: !this.bindings.getDisplayOptions().showLabels });
  }

  public toggleConstellations(): void {
    this.updateDisplayOptions({
      showConstellations: !this.bindings.getDisplayOptions().showConstellations,
    });
  }

  public setQuality(quality: GraphicQuality): void {
    this.updateDisplayOptions({ quality });
  }

  public setLabelDensity(labelDensity: LabelDensity): void {
    this.updateDisplayOptions({ labelDensity });
  }

  public setTemporalMode(temporalMode: TemporalMode): void {
    this.updateDisplayOptions({ temporalMode });
    if (temporalMode === 'observable') {
      this.bindings.setPerformanceWarning(this.bindings.getObservableWarning());
    }
  }

  public toggleCosmicMapLayer(layer: CosmicMapLayer): void {
    const current = this.bindings.getCosmicMapLayers();
    const layers: CosmicMapLayers = { ...current, [layer]: !current[layer] };

    this.bindings.setCosmicMapLayers(layers);
    this.engine.setCosmicMapLayers(layers);
  }

  public resetCosmicMapLayers(): void {
    const layers = { ...DEFAULT_COSMIC_MAP_LAYERS };

    this.bindings.setCosmicMapLayers(layers);
    this.engine.setCosmicMapLayers(layers);
  }
}
