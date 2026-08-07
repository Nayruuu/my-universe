import type { DisplayOptions, GraphicQuality } from '../../data/models/universe.models';
import type { LabelNameResolver, LabelObject } from '../objects/label-manager';

export interface UniverseDisplayBindings {
  recommendQuality(): GraphicQuality;
  setSceneQuality(quality: GraphicQuality): void;
  setConstellationsEnabled(enabled: boolean): void;
  setLabelsEnabled(enabled: boolean): void;
  setLabelDensity(density: DisplayOptions['labelDensity']): void;
  resetPixelRatio(quality: GraphicQuality): number;
  setScenePixelRatio(pixelRatio: number): void;
  invalidateStreamingViews(): void;
  shouldRebuildRegistry(): boolean;
  rebuildRegistry(): void;
  setLabelQuality(quality: GraphicQuality): void;
  applyRenderPixelRatio(pixelRatio: number): void;
  getLabelObjects(): LabelObject[];
  setLabelObjects(objects: LabelObject[]): void;
  setObjectDisplayOptions(options: DisplayOptions): void;
  applyLabelNameResolver(resolver: LabelNameResolver): void;
}

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showOrbits: true,
  showConstellations: true,
  showLabels: true,
  quality: 'medium',
  labelDensity: 'balanced',
  temporalMode: 'state',
};
const DEFAULT_LABEL_NAME_RESOLVER: LabelNameResolver = (_objectId, fallback) => fallback;

export class UniverseDisplayRuntime {
  private currentOptions: DisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
  private currentPixelRatio = 1;
  private currentLabelNameResolver: LabelNameResolver;

  constructor(private readonly bindings: UniverseDisplayBindings) {
    this.currentLabelNameResolver = DEFAULT_LABEL_NAME_RESOLVER;
  }

  public get options(): DisplayOptions {
    return this.currentOptions;
  }

  public get pixelRatio(): number {
    return this.currentPixelRatio;
  }

  public get labelNameResolver(): LabelNameResolver {
    return this.currentLabelNameResolver;
  }

  public configureInitial(initialOptions?: Partial<DisplayOptions>): DisplayOptions {
    this.currentOptions = {
      ...this.currentOptions,
      ...initialOptions,
      quality: initialOptions?.quality ?? this.bindings.recommendQuality(),
    };

    return this.currentOptions;
  }

  public restorePixelRatio(pixelRatio: number): void {
    this.currentPixelRatio = pixelRatio;
  }

  public apply(options: DisplayOptions): void {
    const qualityChanged = options.quality !== this.currentOptions.quality;
    const labelDensityChanged = options.labelDensity !== this.currentOptions.labelDensity;

    this.currentOptions = { ...options };
    this.bindings.setSceneQuality(options.quality);
    this.bindings.setConstellationsEnabled(options.showConstellations);
    this.bindings.setLabelsEnabled(options.showLabels);
    this.bindings.setLabelDensity(options.labelDensity);

    if (qualityChanged) {
      this.currentPixelRatio = this.bindings.resetPixelRatio(options.quality);
      this.bindings.setScenePixelRatio(this.currentPixelRatio);
      this.bindings.invalidateStreamingViews();
      if (this.bindings.shouldRebuildRegistry()) {
        this.bindings.rebuildRegistry();
      }
      this.bindings.setLabelQuality(options.quality);
      this.bindings.applyRenderPixelRatio(this.currentPixelRatio);
    } else {
      this.bindings.setScenePixelRatio(this.currentPixelRatio);
    }
    if (qualityChanged || labelDensityChanged) {
      this.bindings.setLabelObjects(this.bindings.getLabelObjects());
    }
    this.bindings.setObjectDisplayOptions(this.currentOptions);
  }

  public setLabelNameResolver(resolver: LabelNameResolver): void {
    this.currentLabelNameResolver = resolver;
    this.bindings.applyLabelNameResolver(resolver);
  }
}
