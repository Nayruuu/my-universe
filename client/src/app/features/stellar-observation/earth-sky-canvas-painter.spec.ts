import type { EarthSkyScene } from './earth-sky-scene';
import { paintEarthSky } from './earth-sky-canvas-painter';

describe('rendu groupé du ciel terrestre', () => {
  it('peint les étoiles, réserve un halo aux plus lumineuses et localise leurs noms', () => {
    const probe = canvasContext();
    const scene = skyScene();
    const resolveName = vi.fn((id: string, fallback: string) =>
      id === 'bright' ? 'Étoile brillante' : fallback,
    );

    paintEarthSky(probe.context, scene, resolveName);

    expect(probe.clearRect).toHaveBeenCalledWith(0, 0, 800, 500);
    expect(probe.createRadialGradient).toHaveBeenCalledOnce();
    expect(probe.arc).toHaveBeenCalledTimes(3);
    expect(probe.fillText).toHaveBeenCalledWith('Étoile brillante', 112, 90);
    expect(probe.fillText).toHaveBeenCalledWith('Orion', 180, 140);
    expect(probe.moveTo).toHaveBeenCalledWith(120, 120);
    expect(probe.lineTo).toHaveBeenCalledWith(240, 160);
    expect(probe.stroke).toHaveBeenCalledOnce();
    expect(resolveName).toHaveBeenCalledTimes(2);
    expect(probe.gradient.addColorStop).toHaveBeenCalledWith(1, 'transparent');
    expect(probe.context.globalAlpha).toBe(1);
    expect(probe.context.shadowBlur).toBe(0);
  });

  it('accepte un champ sans étoile visible', () => {
    const probe = canvasContext();

    paintEarthSky(
      probe.context,
      { ...skyScene(), stars: [], constellations: [] },
      (_id, name) => name,
    );

    expect(probe.clearRect).toHaveBeenCalledOnce();
    expect(probe.arc).not.toHaveBeenCalled();
    expect(probe.fillText).not.toHaveBeenCalled();
    expect(probe.stroke).not.toHaveBeenCalled();
  });

  it('dessine discrètement une figure secondaire sans imposer son nom', () => {
    const probe = canvasContext();
    const scene = skyScene();

    paintEarthSky(
      probe.context,
      {
        ...scene,
        stars: [],
        constellations: [
          {
            ...scene.constellations[0]!,
            highlighted: false,
            showLabel: false,
          },
          {
            ...scene.constellations[0]!,
            id: 'constellation-canis-major',
            name: 'Canis Major',
            highlighted: false,
            showLabel: true,
          },
        ],
      },
      (_id, name) => name,
    );

    expect(probe.stroke).toHaveBeenCalledTimes(2);
    expect(probe.context.globalAlpha).toBe(1);
    expect(probe.fillText).toHaveBeenCalledWith('Canis Major', 180, 140);
  });
});

function skyScene(): EarthSkyScene {
  return {
    width: 800,
    height: 500,
    centerAltitudeDegrees: 20,
    centerAzimuthDegrees: 180,
    verticalFieldOfViewDegrees: 80,
    horizonY: 400,
    target: {
      x: 400,
      y: 250,
      altitudeDegrees: 20,
      azimuthDegrees: 180,
      isAboveHorizon: true,
      isInView: true,
    },
    constellations: [
      {
        id: 'constellation-orion',
        name: 'Orion',
        abbreviation: 'Ori',
        segments: [{ fromX: 120, fromY: 120, toX: 240, toY: 160 }],
        labelX: 180,
        labelY: 140,
        highlighted: true,
        showLabel: true,
      },
    ],
    stars: [
      {
        id: 'bright',
        name: 'Bright',
        x: 100,
        y: 100,
        depth: 1,
        radius: 2.5,
        opacity: 0.9,
        haloOpacity: 0.16,
        color: '#aaccee',
        showLabel: true,
      },
      {
        id: 'faint',
        name: 'Faint',
        x: 300,
        y: 200,
        depth: 0.8,
        radius: 1,
        opacity: 0.4,
        haloOpacity: 0,
        color: '#ffffff',
        showLabel: false,
      },
    ],
  };
}

interface CanvasProbe {
  readonly context: CanvasRenderingContext2D;
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly createRadialGradient: ReturnType<typeof vi.fn>;
  readonly arc: ReturnType<typeof vi.fn>;
  readonly fillText: ReturnType<typeof vi.fn>;
  readonly moveTo: ReturnType<typeof vi.fn>;
  readonly lineTo: ReturnType<typeof vi.fn>;
  readonly stroke: ReturnType<typeof vi.fn>;
  readonly gradient: { readonly addColorStop: ReturnType<typeof vi.fn> };
}

function canvasContext(): CanvasProbe {
  const gradient = { addColorStop: vi.fn() };
  const clearRect = vi.fn();
  const createRadialGradient = vi.fn(() => gradient);
  const arc = vi.fn();
  const fillText = vi.fn();
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const stroke = vi.fn();
  const context = {
    clearRect,
    createRadialGradient,
    beginPath: vi.fn(),
    arc,
    fill: vi.fn(),
    fillText,
    moveTo,
    lineTo,
    stroke,
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
    fillStyle: '',
    font: '',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D;

  return {
    context,
    clearRect,
    createRadialGradient,
    arc,
    fillText,
    moveTo,
    lineTo,
    stroke,
    gradient,
  };
}
