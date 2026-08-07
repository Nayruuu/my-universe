import * as THREE from 'three';
import {
  createPhotonRingTexture,
  createSelectionMarker,
  createSharedGlowTexture,
} from './celestial-canvas-assets';

describe('celestial canvas assets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('génère un halo stellaire partagé en espace de couleur sRGB', () => {
    const probe = canvasProbe();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(probe.context);
    const texture = createSharedGlowTexture();

    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture.image).toMatchObject({ width: 128, height: 128 });
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(probe.addColorStop).toHaveBeenCalledTimes(4);
    texture.dispose();
  });

  it('dessine un anneau photonique distinct du cœur noir', () => {
    const probe = canvasProbe();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(probe.context);
    const texture = createPhotonRingTexture();

    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(probe.addColorStop).toHaveBeenCalledTimes(7);
    expect(probe.fillRect).toHaveBeenCalledWith(0, 0, 128, 128);
    texture.dispose();
  });

  it('crée un marqueur de sélection discret avec une texture dédiée', () => {
    const probe = canvasProbe();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(probe.context);
    const marker = createSelectionMarker();

    expect(marker).toBeInstanceOf(THREE.Sprite);
    expect(marker.name).toBe('selection-marker');
    expect(marker.renderOrder).toBe(20);
    expect(marker.material.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(probe.setLineDash).toHaveBeenCalledWith([4, 9]);
    marker.material.map?.dispose();
    marker.material.dispose();
  });

  it('conserve des erreurs explicites lorsque Canvas 2D est indisponible', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => createSharedGlowTexture()).toThrow('halo stellaire');
    expect(() => createPhotonRingTexture()).toThrow('anneau photonique');
    expect(() => createSelectionMarker()).toThrow('marqueur de sélection');
  });
});

function canvasProbe(): {
  context: CanvasRenderingContext2D;
  addColorStop: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
} {
  const addColorStop = vi.fn();
  const fillRect = vi.fn();
  const setLineDash = vi.fn();

  return {
    context: {
      createRadialGradient: vi.fn(() => ({ addColorStop })),
      fillRect,
      clearRect: vi.fn(),
      setLineDash,
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D,
    addColorStop,
    fillRect,
    setLineDash,
  };
}
