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
    expect(manager.getPixelRatio('medium')).toBe(1.5);
    expect(manager.getPixelRatio('high')).toBe(2);
    expect(manager.getParticleCount('low')).toBe(2_000);
    expect(manager.getParticleCount('medium')).toBe(5_000);
    expect(manager.getParticleCount('high')).toBe(10_000);
  });

  it('réduit progressivement la résolution après deux mesures durablement basses', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 12, pixelRatio: 2 });
    const manager = new PerformanceManager();

    expect(manager.resetAdaptivePixelRatio('high')).toBe(2);
    expect(manager.observeFrameRate('high', 44)).toBeNull();
    expect(manager.observeFrameRate('high', 44)).toBe(1.75);
    expect(manager.observeFrameRate('high', 29)).toBeNull();
    expect(manager.observeFrameRate('high', 29)).toBe(1.25);
    expect(manager.observeFrameRate('high', 29)).toBeNull();
    expect(manager.observeFrameRate('high', 29)).toBe(1);
    expect(manager.observeFrameRate('high', 20)).toBeNull();
    expect(manager.adaptivePixelRatio).toBe(1);
  });

  it('ne remonte la résolution qu’après une longue période fluide', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 12, pixelRatio: 2 });
    const manager = new PerformanceManager();

    manager.resetAdaptivePixelRatio('high');
    for (let index = 0; index < 4; index += 1) {
      manager.observeFrameRate('high', 20);
    }
    expect(manager.adaptivePixelRatio).toBe(1);

    expect(Array.from({ length: 7 }, () => manager.observeFrameRate('high', 60))).toEqual(
      Array.from({ length: 7 }, () => null),
    );
    expect(manager.observeFrameRate('high', 60)).toBe(1.25);
    for (const expectedRatio of [1.5, 1.75, 2]) {
      for (let index = 0; index < 7; index += 1) {
        expect(manager.observeFrameRate('high', 60)).toBeNull();
      }
      expect(manager.observeFrameRate('high', 60)).toBe(expectedRatio);
    }
    expect(manager.observeFrameRate('high', 60)).toBeNull();
  });

  it('réinitialise ses compteurs lors d’un changement de qualité ou d’un FPS neutre', () => {
    configureEnvironment({ narrow: false, reducedMotion: false, processors: 8, pixelRatio: 2 });
    const manager = new PerformanceManager();

    expect(manager.observeFrameRate('medium', 20)).toBeNull();
    expect(manager.adaptivePixelRatio).toBe(1.5);
    expect(manager.observeFrameRate('medium', 44)).toBeNull();
    expect(manager.observeFrameRate('medium', 50)).toBeNull();
    expect(manager.observeFrameRate('medium', 44)).toBeNull();
    expect(manager.observeFrameRate('medium', 44)).toBe(1.25);
    expect(manager.observeFrameRate('low', 20)).toBeNull();
    expect(manager.adaptivePixelRatio).toBe(1);
    expect(manager.observeFrameRate('low', 60)).toBeNull();
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
