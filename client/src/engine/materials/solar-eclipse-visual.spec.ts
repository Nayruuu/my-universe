import * as THREE from 'three';
import { SolarEclipseAppearance } from '../simulation/earth-eclipse';
import {
  SOLAR_ECLIPSE_EVENT_MAP_SOURCE,
  createSolarEclipseEventMapRenderData,
  type SolarEclipseEventMap,
} from '../simulation/solar-eclipse-event-map';
import { SolarEclipseVisual } from './solar-eclipse-visual';

describe('rendu des éclipses solaires', () => {
  let context: CanvasRenderingContext2D;

  beforeEach(() => {
    context = canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('active l’ombre et le corridor selon la phase et le LOD', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const visual = new SolarEclipseVisual(geometry, 0.62);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('total'));
    setEventMap(visual, eventMap(), 'total');

    expect(visual.mesh.visible).toBe(true);
    expect(visual.path.visible).toBe(true);
    expect(visual.partialEnvelope.visible).toBe(true);
    expect(visual.partialEnvelope.material.opacity).toBeCloseTo(0.065, 4);
    expect(visual.corridor.visible).toBe(true);
    expect(visual.corridorLimits.visible).toBe(true);
    expect(visual.eventMapRoot.userData['scientificConfidence']).toBe('calculated');
    expect(visual.eventMapRoot.userData['source']).toBe(SOLAR_ECLIPSE_EVENT_MAP_SOURCE);
    expect(visual.eventMapRoot.userData['partialFootprintCount']).toBe(1);
    expect(visual.eventMapRoot.userData['corridorSampleCount']).toBe(2);
    const partialTexture = visual.partialEnvelope.material.map as THREE.CanvasTexture;
    const partialCanvas = partialTexture.image as HTMLCanvasElement;

    expect(partialCanvas.width).toBe(1_024);
    expect(partialCanvas.height).toBe(512);
    expect(partialTexture.repeat.x).toBe(1);
    expect(partialTexture.offset.x).toBe(0);
    expect(context.fill).toHaveBeenCalled();
    expect(visual.corridor.geometry.index?.count).toBe(6);
    expect(visual.path.geometry.getAttribute('position').count).toBe(2);
    expect(visual.corridorLimits.geometry.getAttribute('position').count).toBe(4);
    expect(visual.mesh.userData['eclipsePhase']).toBe('total');
    expect(visual.mesh.material.vertexShader).toContain('logdepthbuf_vertex');
    expect(visual.mesh.material.fragmentShader).toContain('logdepthbuf_fragment');
    expect(visual.mesh.material.polygonOffset).toBe(true);
    expect(visual.mesh.material.uniforms['moonPosition']?.value).toEqual(
      new THREE.Vector3(60, 0.4, 0),
    );
    expect(visual.mesh.material.uniforms['shadowCenter']?.value).toEqual(
      new THREE.Vector3(1, 0, 0),
    );
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(1);
    expect(visual.mesh.userData['visualScaleMode']).toBe('adaptive');
    expect(visual.mesh.userData['eclipsePalette']).toBe('penumbra-cyan-totality-coral');
    expect(visual.mesh.material.fragmentShader).toContain('displayRing');
    expect(visual.mesh.material.fragmentShader).toContain('displayPenumbra*0.18');
    expect(visual.mesh.material.fragmentShader).toContain('penumbraColor');
    expect(visual.mesh.material.fragmentShader).toContain('totalityColor');

    visual.updateAppearance(appearance('annular'));
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(0.72);
    setEventMap(visual, eventMap(), 'annular');
    expect(visual.path.userData['eclipseKind']).toBe('annular');
    expect(visual.corridor.userData['eclipseKind']).toBe('annular');
    visual.updateAppearance(appearance('partial'));
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(0);

    visual.setVisibilityBlend(0);
    expect(visual.mesh.visible).toBe(false);
    expect(visual.eventMapRoot.visible).toBe(false);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('none'));
    visual.clearPath();
    expect(visual.mesh.visible).toBe(false);
    expect(visual.eventMapRoot.visible).toBe(false);
    expect(context.clearRect).toHaveBeenCalled();
    expect(visual.corridor.geometry.drawRange.count).toBe(0);
    expect(visual.path.geometry.drawRange.count).toBe(0);
    expect(visual.corridorLimits.geometry.drawRange.count).toBe(0);

    visual.mesh.material.dispose();
    visual.eventMapRoot.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    partialTexture.dispose();
    geometry.dispose();
  });

  it('gère les cartes partielles, les coutures géographiques et les événements vides', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const visual = new SolarEclipseVisual(geometry, 0.62);
    const completeMap = eventMap();

    visual.setVisibilityBlend(1);
    setEventMap(visual, { ...completeMap, partialFootprints: [] }, 'total');
    expect(visual.eventMapRoot.visible).toBe(true);
    expect(visual.partialEnvelope.visible).toBe(false);

    setEventMap(
      visual,
      {
        ...completeMap,
        corridor: [],
        partialFootprints: [
          {
            time: { julianDay: 2_461_625.1 },
            center: mapPoint(0, 180),
            boundary: [mapPoint(-15, -170), mapPoint(0, 170), mapPoint(15, 160)],
          },
          {
            time: { julianDay: 2_461_625.2 },
            center: mapPoint(0, -180),
            boundary: [mapPoint(-15, 170), mapPoint(0, -170), mapPoint(15, -160)],
          },
        ],
      },
      'partial',
    );
    expect(visual.partialEnvelope.visible).toBe(true);
    expect(visual.corridor.visible).toBe(false);
    const fillCount = vi.mocked(context.fill).mock.calls.length;

    setEventMap(
      visual,
      {
        ...completeMap,
        corridor: [],
        partialFootprints: [
          {
            time: { julianDay: 2_461_625.2 },
            center: mapPoint(0, 0),
            boundary: [mapPoint(0, 0), mapPoint(1, 1)],
          },
        ],
      },
      'partial',
    );
    expect(context.fill).toHaveBeenCalledTimes(fillCount);

    setEventMap(visual, { ...completeMap, corridor: [], partialFootprints: [] }, 'partial');
    expect(visual.eventMapRoot.visible).toBe(false);

    visual.partialEnvelope.material.map?.dispose();
    visual.eventMapRoot.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    visual.mesh.material.dispose();
    geometry.dispose();
  });
});

function eventMap(): SolarEclipseEventMap {
  return {
    source: SOLAR_ECLIPSE_EVENT_MAP_SOURCE,
    scientificConfidence: 'calculated',
    partialFootprints: [
      {
        time: { julianDay: 2_461_625.2 },
        center: mapPoint(61, -34),
        boundary: [mapPoint(39, -70), mapPoint(72, -64), mapPoint(77, 10), mapPoint(36, 6)],
      },
    ],
    corridor: [
      {
        time: { julianDay: 2_461_625.23 },
        center: mapPoint(66, -28),
        northernLimit: mapPoint(66.8, -27),
        southernLimit: mapPoint(65.2, -29),
        widthKm: 294,
      },
      {
        time: { julianDay: 2_461_625.24 },
        center: mapPoint(58, -22),
        northernLimit: mapPoint(58.6, -19),
        southernLimit: mapPoint(57.9, -24),
        widthKm: 307,
      },
    ],
  };
}

function setEventMap(
  visual: SolarEclipseVisual,
  map: SolarEclipseEventMap,
  kind: 'partial' | 'annular' | 'total',
): void {
  visual.setEventMap(map, createSolarEclipseEventMapRenderData(map), kind);
}

function mapPoint(latitude: number, longitude: number) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);

  return {
    latitude,
    longitude,
    direction: {
      x: Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
      y: Math.sin(latitudeRadians),
      z: -Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
    },
  };
}

function canvasContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    lineTo: vi.fn(),
    moveTo: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function appearance(phase: SolarEclipseAppearance['phase']): SolarEclipseAppearance {
  return {
    phase,
    sunPositionInEarthRadii: { x: 23_400, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 60, y: 0.4, z: 0 },
    shadowDirection: { x: 1, y: 0, z: 0 },
    centralLatitude: 65.2,
    centralLongitude: -25.2,
  };
}
