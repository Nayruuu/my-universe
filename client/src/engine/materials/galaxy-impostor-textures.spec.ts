import * as THREE from 'three';
import {
  createGalaxyImpostorTextures,
  getGalaxyTextureResolution,
} from './galaxy-impostor-textures';

describe('galaxy impostor textures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['low', 256],
    ['medium', 384],
    ['high', 512],
  ] as const)('adapte la résolution à la qualité %s', (quality, expected) => {
    expect(getGalaxyTextureResolution(quality)).toBe(expected);
  });

  it('génère les trois morphologies avec les paramètres de la qualité demandée', () => {
    const context = galaxyCanvasContext();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const textures = createGalaxyImpostorTextures('medium');

    expect(Object.keys(textures)).toEqual(['spiral', 'elliptical', 'irregular']);
    for (const texture of Object.values(textures)) {
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.image).toMatchObject({ width: 384, height: 384 });
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(texture.anisotropy).toBe(2);
      texture.dispose();
    }
    expect(context.save).toHaveBeenCalledTimes(4);
    expect(context.restore).toHaveBeenCalledTimes(4);
  });

  it('signale explicitement un Canvas 2D indisponible', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => createGalaxyImpostorTextures('low')).toThrow('imposteurs galactiques');
  });
});

function galaxyCanvasContext(): CanvasRenderingContext2D {
  return {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}
