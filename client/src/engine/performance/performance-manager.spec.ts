import { PerformanceManager } from './performance-manager';

describe('PerformanceManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('recommande une qualité faible sur petit écran', () => {
    configureEnvironment({ narrow: true, reducedMotion: false, processors: 12, pixelRatio: 2 });
    expect(new PerformanceManager().recommendQuality()).toBe('low');
  });

  it('recommande une qualité élevée sur une machine adaptée', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 12, pixelRatio: 2 });
    expect(new PerformanceManager().recommendQuality()).toBe('high');
  });

  it('réduit la qualité pour le mouvement réduit, un petit CPU ou une valeur absente', () => {
    configureEnvironment({ narrow: false, reducedMotion: true, processors: 12, pixelRatio: 2 });
    expect(new PerformanceManager().recommendQuality()).toBe('low');
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 4, pixelRatio: 2 });
    expect(new PerformanceManager().recommendQuality()).toBe('low');
    configureEnvironment({
      narrow: false,
      reducedMotion: false,
      processors: undefined,
      pixelRatio: 2,
    });
    expect(new PerformanceManager().recommendQuality()).toBe('low');
  });

  it('borne le ratio de pixels et adapte le nombre de particules', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 8, pixelRatio: 3 });
    const manager = new PerformanceManager();

    expect(manager.recommendQuality()).toBe('medium');
    expect(manager.getPixelRatio('low')).toBe(1);
    expect(manager.getPixelRatio('medium')).toBe(1.25);
    expect(manager.getPixelRatio('high')).toBe(1.5);
    expect(manager.getParticleCount('low')).toBe(2_000);
    expect(manager.getParticleCount('medium')).toBe(5_000);
    expect(manager.getParticleCount('high')).toBe(10_000);
  });

  it('délègue les frames et expose le diagnostic de résolution adaptative', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 12, pixelRatio: 2 });
    const manager = new PerformanceManager();

    expect(manager.resetAdaptivePixelRatio('high')).toBe(1.5);
    expect(manager.observeFrame('high', 0.016, false)).toBeNull();
    expect(manager.adaptiveRenderingStats).toMatchObject({
      status: 'warming',
      targetPixelRatio: 1.5,
      currentPixelRatio: 1.5,
    });
  });

  it('réinitialise l’adaptation lors d’un changement de qualité', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 12, pixelRatio: 2 });
    const manager = new PerformanceManager();

    manager.resetAdaptivePixelRatio('high');
    expect(manager.observeFrame('medium', 0.04, false)).toBeNull();
    expect(manager.adaptivePixelRatio).toBe(1.25);
    expect(manager.adaptiveRenderingStats).toMatchObject({
      status: 'warming',
      targetPixelRatio: 1.25,
    });
  });
});

interface EnvironmentOptions {
  narrow: boolean;
  reducedMotion: boolean;
  processors: number | undefined;
  pixelRatio: number;
}

function configureEnvironment(options: EnvironmentOptions): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width') ? options.narrow : options.reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockImplementation(
    () => options.processors as number,
  );
  vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(options.pixelRatio);
}
