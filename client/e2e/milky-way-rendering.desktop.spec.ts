import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  readCameraInteractionState,
  readFirstStarCatalogWorldPointState,
  readMilkyWayDetailState,
  readMilkyWayPointProjectionState,
  readOrbitVisualState,
  readStarCatalogBatchState,
  readVisibleLabelIds,
  universeUrl,
} from './universe-test-helpers';

test('le Soleil conserve sa distance relative au disque pendant les changements d’échelle', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);

  for (const zoom of ['24000', '13300', '3600', '600']) {
    await openUniverse(
      page,
      universeUrl({ target: 'milky-way', selected: '', quality: 'low', zoom, mode: 'state' }),
    );
    const galaxy = await readMilkyWayDetailState(page);

    expect(galaxy.worldDiameter).toBeCloseTo(galaxy.physicalWorldDiameter, 8);
    expect(galaxy.visualScaleFactor).toBe(1);
    expect(galaxy.stellarOriginDistanceFromGalacticCenter / (galaxy.worldDiameter / 2)).toBeCloseTo(
      0.533461,
      5,
    );
    expect(galaxy.stellarOriginDistanceFromSun).toBeLessThan(0.001);
  }
  expect(errors).toEqual([]);
});

test('les poussières gardent une parallaxe proche sur 360° sans déplacement lors du streaming', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', quality: 'high', zoom: '1600', mode: 'state' }),
  );
  const result = await page.evaluate(() => {
    const root = document.querySelector('app-root')!;
    const debug = (window as unknown as { ng: { getComponent(element: Element): object } }).ng;
    const facade = Reflect.get(debug.getComponent(root), 'facade') as object;
    const client = Reflect.get(facade, 'engine') as object;
    const engine = (Reflect.get(client, 'engine') as object | undefined) ?? client;

    type Attribute = { array: Float32Array; itemSize: number };
    const scene = Reflect.get(engine, 'universeScene') as {
      spaceRoot: {
        getObjectByName(name: string): {
          geometry: { attributes: Record<string, Attribute>; drawRange: { count: number } };
          material: {
            vertexShader: string;
            uniforms: {
              densityTexture: {
                value: {
                  image: { data: Uint8Array; width: number; height: number; depth: number };
                };
              };
            };
          };
        };
      };
    };
    const dust = scene.spaceRoot.getObjectByName('illustrative-milky-way-dust-detail');
    const gl = new OffscreenCanvas(512, 512).getContext('webgl2')!;
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type)!;

      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'GLSL invalide');
      }

      return shader;
    };
    // Capture positions AFTER the production vertex shader, not its nominal grid attributes.
    // This detects dust glued to the observer even if all CPU buffers remain immutable.
    const vertex = compile(
      gl.VERTEX_SHADER,
      `#version 300 es
      precision highp float;
      in vec3 position;
      uniform mat4 modelMatrix;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec3 probePosition;
      out float probeOpacity;
      out float probeLevel;
      out vec4 probeClip;
      ${dust.material.vertexShader.replace(
        'gl_Position = projectionMatrix * viewPosition;',
        `
        gl_Position = projectionMatrix * viewPosition;
        probePosition = galacticPosition;
        probeOpacity = dustAlpha;
        probeLevel = detailLevel;
        probeClip = gl_Position;
      `,
      )}
    `,
    );
    const fragment = compile(
      gl.FRAGMENT_SHADER,
      `#version 300 es
      precision highp float;
      out vec4 color;
      void main() { color = vec4(0); }
    `,
    );
    const program = gl.createProgram()!;
    const buffers: WebGLBuffer[] = [];
    const texture = gl.createTexture()!;
    const feedback = gl.createTransformFeedback()!;
    const count = dust.geometry.drawRange.count;
    const stride = 9;
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    try {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.transformFeedbackVaryings(
        program,
        ['probePosition', 'probeOpacity', 'probeLevel', 'probeClip'],
        gl.INTERLEAVED_ATTRIBS,
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Programme invalide');
      }
      gl.useProgram(program);
      for (const [name, attribute] of Object.entries(dust.geometry.attributes)) {
        const buffer = gl.createBuffer()!;

        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, attribute.array, gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, name);

        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, attribute.itemSize, gl.FLOAT, false, 0, 0);
      }
      const image = dust.material.uniforms.densityTexture.value.image;

      gl.bindTexture(gl.TEXTURE_3D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.R8,
        image.width,
        image.height,
        image.depth,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        image.data,
      );
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'densityTexture'), 0);
      gl.uniform3f(gl.getUniformLocation(program, 'densityHalfExtents'), 7500, 4500, 7500);
      for (const [name, value] of Object.entries({
        pixelRatio: 1,
        viewportHeight: 900,
        sampleWeight: 1,
      })) {
        gl.uniform1f(gl.getUniformLocation(program, name), value);
      }
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelMatrix'), false, identity);
      const projection = identity.slice();

      projection[0] = 1;
      projection[5] = 1;
      projection[10] = -1.00002;
      projection[11] = -1;
      projection[14] = -0.02;
      projection[15] = 0;
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projectionMatrix'), false, projection);
      const output = gl.createBuffer()!;

      buffers.push(output);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
      gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, output);
      gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, count * stride * 4, gl.DYNAMIC_READ);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
      gl.enable(gl.RASTERIZER_DISCARD);

      const sample = (observer: number[], direction: number[]) => {
        const forward = direction;
        const nominalUp = Math.abs(direction[1]!) > 0.9 ? [0, 0, 1] : [0, 1, 0];
        const cross = (a: number[], b: number[]) => [
          a[1]! * b[2]! - a[2]! * b[1]!,
          a[2]! * b[0]! - a[0]! * b[2]!,
          a[0]! * b[1]! - a[1]! * b[0]!,
        ];
        const right = cross(forward, nominalUp);
        const up = cross(right, forward);
        const dot = (a: number[], b: number[]) =>
          a.reduce((sum, value, index) => sum + value * b[index]!, 0);
        const view = new Float32Array([
          right[0]!,
          up[0]!,
          -forward[0]!,
          0,
          right[1]!,
          up[1]!,
          -forward[1]!,
          0,
          right[2]!,
          up[2]!,
          -forward[2]!,
          0,
          -dot(right, observer),
          -dot(up, observer),
          dot(forward, observer),
          1,
        ]);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelViewMatrix'), false, view);
        gl.uniform3fv(gl.getUniformLocation(program, 'observerLocal'), observer);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.endTransformFeedback();
        const data = new Float32Array(count * stride);

        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, data);
        const positions = new Map<
          string,
          { alpha: number; x: number; y: number; distance: number }
        >();

        for (let index = 0; index < count; index += 1) {
          const i = index * stride;

          // Finest grains only: fog and distant points cannot satisfy the foreground test.
          if (data[i + 4] !== 0 || data[i + 3]! < 0.01) {
            continue;
          }
          const w = data[i + 8]!;

          if (w <= 0 || Math.abs(data[i + 5]!) >= w || Math.abs(data[i + 6]!) >= w) {
            continue;
          }
          const xyz = [data[i]!, data[i + 1]!, data[i + 2]!];

          positions.set(xyz.join(','), {
            alpha: data[i + 3]!,
            x: data[i + 5]! / w,
            y: data[i + 6]! / w,
            distance: Math.hypot(...xyz.map((value, axis) => value - observer[axis]!)),
          });
        }

        return positions;
      };
      const observer = [1007.9, 132, 300];
      const initial = sample(observer, [0, 0, -1]);
      const stopped = sample(observer, [0, 0, -1]);
      const crossing = sample([1008.1, 132, 300], [0, 0, -1]); // crosses a 16-unit cell edge
      const returned = sample(observer, [0, 0, -1]);
      const advanced = sample([1007.9, 132, 276], [0, 0, -1]);
      const retained = [...initial.entries()].filter(([key]) => crossing.has(key));
      const moving = [...initial.entries()].filter(([key]) => advanced.has(key));
      const negativeInitial = sample([-1008.1, -132, -300], [0, 0, 1]);
      const negativeCrossing = sample([-1007.9, -132, -300], [0, 0, 1]);
      const negativeRetained = [...negativeInitial.keys()].filter((key) =>
        negativeCrossing.has(key),
      );
      const motion = moving
        .map(([key, value]) => {
          const next = advanced.get(key)!;

          return Math.hypot(next.x - value.x, next.y - value.y) * 256;
        })
        .sort((a, b) => a - b);
      const directions = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
      const coverage = directions.map((direction) => sample(observer, direction).size);
      // Interior approach samples in the canonical authoring metric, from the outer disc toward
      // the local spur (Sun at x ≈ 3041), not the old enlarged envelope's near-central positions.
      const routeCoverage = [
        [5217, 199, 1116],
        [4459, 128, 727],
        [4138, 99, 562],
        [3500, 68, 202],
      ].map((position) => sample(position, [0, 0, -1]).size);

      return {
        initialCount: initial.size,
        stable: JSON.stringify([...initial]) === JSON.stringify([...stopped]),
        reversible: JSON.stringify([...initial]) === JSON.stringify([...returned]),
        retainedFraction: retained.length / initial.size,
        negativeRetainedFraction: negativeRetained.length / negativeInitial.size,
        medianMotionPixels: motion[Math.floor(motion.length / 2)],
        movingCount: moving.length,
        coverage,
        routeCoverage,
      };
    } finally {
      for (const buffer of buffers) {
        gl.deleteBuffer(buffer);
      }
      gl.deleteTexture(texture);
      gl.deleteTransformFeedback(feedback);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    }
  });

  await test.info().attach('dust-world-space-passage', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(result.stable).toBe(true);
  expect(result.reversible).toBe(true);
  expect(result.retainedFraction).toBeGreaterThan(0.98);
  expect(result.negativeRetainedFraction).toBeGreaterThan(0.98);
  expect(result.movingCount).toBeGreaterThan(100);
  expect(result.medianMotionPixels).toBeGreaterThan(12);
  for (const count of result.coverage) {
    expect(count).toBeGreaterThan(100);
  }
  for (const count of result.routeCoverage) {
    expect(count).toBeGreaterThan(30);
  }
  expect(errors).toEqual([]);
});

test('le fondu HYG prolongé garde les étoiles fixes et le Soleil à sa place dans le disque', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);
  let reference: { x: number; y: number; z: number } | undefined;
  let previousOpacity = -1;

  for (const { zoom, reveal, cloudOpacity } of [
    { zoom: '900', reveal: 0, cloudOpacity: 0.96 },
    { zoom: '600', reveal: 0.082, cloudOpacity: 0.96 },
    { zoom: '300', reveal: 0.466, cloudOpacity: 0.96 },
    { zoom: '90', reveal: 1, cloudOpacity: 0.04665 },
  ]) {
    await openUniverse(
      page,
      universeUrl({
        target: 'sun',
        selected: '',
        quality: 'low',
        zoom,
        mode: 'state',
        time: '2026-07-27T12:00:00.000Z',
      }),
    );
    await expect
      .poll(async () => (await readStarCatalogBatchState(page)).catalogCount)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readFirstStarCatalogWorldPointState(page)).reveal)
      .toBeCloseTo(reveal, 2);
    await expect
      .poll(async () => (await readMilkyWayDetailState(page)).opacity)
      .toBeCloseTo(cloudOpacity, 3);
    const star = await readFirstStarCatalogWorldPointState(page);
    const galaxy = await readMilkyWayDetailState(page);

    expect(galaxy.worldDiameter).toBeCloseTo(2_759.413, 2);
    expect(galaxy.visualScaleFactor).toBe(1);
    expect(galaxy.stellarOriginDistanceFromGalacticCenter / (galaxy.worldDiameter / 2)).toBeCloseTo(
      0.533461,
      5,
    );
    expect(star.opacity).toBeGreaterThan(previousOpacity);
    if (reference) {
      expect(star.referencePosition.x).toBeCloseTo(reference.x, 5);
      expect(star.referencePosition.y).toBeCloseTo(reference.y, 5);
      expect(star.referencePosition.z).toBeCloseTo(reference.z, 5);
    }
    reference = star.referencePosition;
    previousOpacity = star.opacity;
  }
  expect(errors).toEqual([]);
});

test('la traversée conserve une étape stellaire avant les planètes et leurs orbites', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);
  const planetIds = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn'];

  for (const { zoom, orbitOpacity, cloudOpacity } of [
    { zoom: '600', orbitOpacity: 0, cloudOpacity: 0.96 },
    { zoom: '400', orbitOpacity: 0, cloudOpacity: 0.96 },
    { zoom: '240', orbitOpacity: 0, cloudOpacity: 0.96 },
    { zoom: '220', orbitOpacity: 0.0332, cloudOpacity: 0.96 },
    { zoom: '150', orbitOpacity: 0.4679, cloudOpacity: 0.52793 },
    { zoom: '90', orbitOpacity: 0.62, cloudOpacity: 0.04665 },
    { zoom: '400', orbitOpacity: 0, cloudOpacity: 0.96 },
  ]) {
    await openUniverse(
      page,
      universeUrl({
        target: 'sun',
        selected: '',
        quality: 'low',
        labels: '1',
        orbits: '1',
        zoom,
        mode: 'state',
        time: '2026-07-27T12:00:00.000Z',
      }),
    );
    await expect
      .poll(async () => (await readFirstStarCatalogWorldPointState(page)).reveal)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readMilkyWayDetailState(page)).opacity)
      .toBeCloseTo(cloudOpacity, 3);
    await expect
      .poll(async () => (await readOrbitVisualState(page, 'earth')).opacity)
      .toBeCloseTo(orbitOpacity, 2);

    if (orbitOpacity === 0) {
      expect((await readOrbitVisualState(page, 'earth')).visible).toBe(false);
      expect((await readVisibleLabelIds(page)).filter((id) => planetIds.includes(id))).toEqual([]);
    } else {
      expect((await readOrbitVisualState(page, 'earth')).visible).toBe(true);
      await expect.poll(async () => (await readVisibleLabelIds(page)).includes('earth')).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('la molette traverse le nuage avant les annotations, dans les deux sens sans déplacer les étoiles', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', zoom: '6000', quality: 'low', mode: 'state' }),
  );
  await expect
    .poll(async () => (await readStarCatalogBatchState(page)).catalogCount)
    .toBeGreaterThan(0);
  await page.mouse.move(950, 450);
  const cloudReference = await readMilkyWayPointProjectionState(page);
  const samples = [];
  let starReference: { x: number; y: number; z: number } | undefined;

  for (const stop of [1400, 600, 400, 150, 400, 1000]) {
    const outward = (await readCameraInteractionState(page)).distance < stop;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const { distance } = await readCameraInteractionState(page);

      if (outward ? distance >= stop : distance <= stop) {
        break;
      }
      const remainingRatio = outward ? stop / distance : distance / stop;
      const step = remainingRatio < 1.5 ? 20 : 80;

      await page.mouse.wheel(0, outward ? step : -step);
      await page.waitForTimeout(85);
    }
    await page.waitForTimeout(500);
    const camera = await readCameraInteractionState(page);
    const cloud = await readMilkyWayDetailState(page);
    const point = await readMilkyWayPointProjectionState(page, cloudReference.pointIndex);
    const star = await readFirstStarCatalogWorldPointState(page);
    const orbit = await readOrbitVisualState(page, 'earth');
    const labels = await readVisibleLabelIds(page);
    // Inspect the actual cloud relative to the production camera after real input. The isolated
    // shader test alone cannot tell whether the navigation route ever enters that cloud.
    const nearbyCloud = await page.evaluate(() => {
      type Vector = { x: number; y: number; z: number; clone(): Vector };
      const root = document.querySelector('app-root')!;
      const debug = (window as unknown as { ng: { getComponent(element: Element): object } }).ng;
      const facade = Reflect.get(debug.getComponent(root), 'facade') as object;
      const client = Reflect.get(facade, 'engine') as object;
      const engine = (Reflect.get(client, 'engine') as object | undefined) ?? client;
      const camera = Reflect.get(engine, 'camera') as { position: Vector };
      const scene = Reflect.get(engine, 'universeScene') as {
        spaceRoot: {
          getObjectByName(name: string): {
            scale: { x: number };
            worldToLocal(vector: Vector): Vector;
            geometry: {
              drawRange: { count: number };
              attributes: {
                position: {
                  getX(index: number): number;
                  getY(index: number): number;
                  getZ(index: number): number;
                };
              };
            };
          };
        };
      };
      const cloud = scene.spaceRoot.getObjectByName('illustrative-milky-way');
      const local = cloud.worldToLocal(camera.position.clone());
      const positions = cloud.geometry.attributes.position;
      let nearest = Number.POSITIVE_INFINITY;
      let countWithin100 = 0;

      for (let index = 0; index < cloud.geometry.drawRange.count; index += 1) {
        const distance =
          Math.hypot(
            positions.getX(index) - local.x,
            positions.getY(index) - local.y,
            positions.getZ(index) - local.z,
          ) * cloud.scale.x;

        nearest = Math.min(nearest, distance);
        if (distance < 100) {
          countWithin100 += 1;
        }
      }

      return { nearest, countWithin100 };
    });

    expect(camera.distance).toBeGreaterThan(stop * 0.8);
    expect(camera.distance).toBeLessThan(stop * 1.2);
    expect(cloud.worldDiameter).toBeCloseTo(2759.413, 2);
    expect(cloud.visualScaleFactor).toBe(1);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(point.worldPosition[axis]).toBeCloseTo(cloudReference.worldPosition[axis], 5);
      if (starReference) {
        expect(star.referencePosition[axis]).toBeCloseTo(starReference[axis], 5);
      }
    }
    starReference = star.referencePosition;
    expect(labels).not.toContain('cosmic-web');
    expect(labels.filter((id) => ['moon', 'titan', 'europa', 'phobos'].includes(id))).toEqual([]);
    if (stop >= 1000) {
      expect(star.reveal).toBe(0);
      expect(star.opacity).toBeLessThan(0.001);
    } else if (stop >= 400) {
      expect(nearbyCloud.countWithin100).toBeGreaterThan(100);
      expect(nearbyCloud.nearest).toBeLessThan(15);
      expect(cloud.opacity).toBeCloseTo(0.96, 3);
      expect(star.reveal).toBeGreaterThan(0);
      expect(star.reveal).toBeLessThan(0.5);
    } else {
      expect(star.reveal).toBeGreaterThan(0.85);
      expect(orbit.opacity).toBeGreaterThan(0.45);
      expect(labels).toContain('earth');
    }
    if (stop >= 400) {
      expect(orbit.visible).toBe(false);
      expect(labels).not.toContain('earth');
    }
    samples.push({ stop, camera, star, orbit, nearbyCloud, labels });
  }
  await test.info().attach('actual-wheel-cloud-to-stars', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});

test('le grain galactique garde la profondeur sans halos ni éclat au passage de la caméra', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'milky-way', quality: 'low', zoom: '3600' }));
  const samples = await page.evaluate(() => {
    const root = document.querySelector('app-root');
    const debug = (
      window as unknown as {
        ng: { getComponent(element: Element): object };
      }
    ).ng;

    if (!root) {
      throw new Error('Application absente');
    }
    const component = debug.getComponent(root);
    const facade = Reflect.get(component, 'facade') as object;
    const client = Reflect.get(facade, 'engine') as object;
    const engine = (Reflect.get(client, 'engine') as object | undefined) ?? client;
    const scene = Reflect.get(engine, 'universeScene') as {
      spaceRoot: {
        getObjectByName(name: string): {
          material: { vertexShader: string; fragmentShader: string };
        };
      };
    };
    const material = scene.spaceRoot.getObjectByName('illustrative-milky-way').material;
    // Run the actual production shaders on an isolated GPU target. This catches screen-sized
    // sprites and missing perspective even when metadata, point counts and positions all pass.
    const canvas = new OffscreenCanvas(384, 384);
    const gl = canvas.getContext('webgl2', { antialias: false });

    if (!gl) {
      throw new Error('WebGL2 indisponible');
    }
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);

      if (!shader) {
        throw new Error('Shader indisponible');
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'Compilation GLSL échouée');
      }

      return shader;
    };
    const vertex = compile(
      gl.VERTEX_SHADER,
      `
      precision highp float;
      attribute vec3 position;
      uniform mat4 modelMatrix;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      ${material.vertexShader}
    `,
    );
    // Output conversion belongs to Three's pipeline, not the point projection under test.
    const fragment = compile(
      gl.FRAGMENT_SHADER,
      'precision highp float;\n' + material.fragmentShader.replace(/#include <[^>]+>/g, ''),
    );
    const program = gl.createProgram();
    const buffer = gl.createBuffer();

    if (!program || !buffer) {
      throw new Error('Allocation GPU échouée');
    }
    try {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Édition de liens GLSL échouée');
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');

      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
      gl.vertexAttrib3f(gl.getAttribLocation(program, 'color'), 1, 1, 1);
      gl.vertexAttrib1f(gl.getAttribLocation(program, 'pointSize'), 16);
      // Keep the reference signal above a few 8-bit quantization steps when testing the flux law.
      gl.vertexAttrib1f(gl.getAttribLocation(program, 'pointAlpha'), 0.5);
      for (const [name, value] of Object.entries({
        viewportHeight: 256,
        pixelRatio: 1,
        opacity: 1,
        qualityDensityCompensation: 1,
      })) {
        gl.uniform1f(gl.getUniformLocation(program, name), value);
      }
      const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const projection = new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.0002, -1, 0, 0, -2.0002, 0,
      ]);

      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelMatrix'), false, identity);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projectionMatrix'), false, projection);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      return [1, 1.5].map((pixelRatio) => {
        const viewportSize = 256 * pixelRatio;
        const pixels = new Uint8Array(viewportSize * viewportSize * 4);

        gl.viewport(0, 0, viewportSize, viewportSize);
        gl.uniform1f(gl.getUniformLocation(program, 'viewportHeight'), viewportSize);
        gl.uniform1f(gl.getUniformLocation(program, 'pixelRatio'), pixelRatio);

        return [1536, 768, 512, 2560, 128, 44, 8, 44, 128].map((distance) => {
          const view = identity.slice();

          view[14] = -distance;
          gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelViewMatrix'), false, view);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.POINTS, 0, 1);
          gl.readPixels(0, 0, viewportSize, viewportSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let energy = 0;
          let minX = viewportSize;
          let maxX = -1;

          for (let index = 0; index < viewportSize * viewportSize; index += 1) {
            const red = pixels[index * 4]!;

            energy += red;
            if (red > 0) {
              minX = Math.min(minX, index % viewportSize);
              maxX = Math.max(maxX, index % viewportSize);
            }
          }

          return { distance, energy, width: Math.max(0, maxX - minX + 1) / pixelRatio };
        });
      });
    } finally {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    }
  });

  await test.info().attach('grain-depth-samples', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json',
  });
  for (const ratioSamples of samples) {
    const [far, near, resolved, subpixel, passing, fading, crossed, returning, receding] =
      ratioSamples;

    expect(far!.energy).toBeGreaterThan(0);
    expect(near!.energy / far!.energy).toBeGreaterThan(2.8);
    expect(near!.energy / far!.energy).toBeLessThan(5.2);
    expect(resolved!.energy).toBeGreaterThan(near!.energy);
    expect(subpixel!.energy).toBeGreaterThan(0);
    expect(subpixel!.energy).toBeLessThanOrEqual(far!.energy);
    // Depth still controls subpixel energy; resolved grains stop growing or brightening.
    expect(passing!.energy).toBe(resolved!.energy);
    expect(fading!.energy).toBeGreaterThan(0);
    expect(fading!.energy / passing!.energy).toBeCloseTo(0.5, 1);
    expect(crossed!.energy).toBe(0);
    expect(returning).toEqual(fading);
    expect(receding).toEqual(passing);
    for (const sample of ratioSamples) {
      expect(sample.width).toBeLessThanOrEqual(3);
    }
  }
  expect(errors).toEqual([]);
});
