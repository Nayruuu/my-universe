import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  extractFeaturedCatalogIdentifiers,
  HYG_STAR_CATALOG_ID,
  selectBrightestIncludingIdentifiers,
} from './hyg-star-selection.mjs';

test('extracts unique identifiers from catalogue-backed featured stars', () => {
  assert.deepEqual(
    extractFeaturedCatalogIdentifiers({
      objects: [featured('sirius', 'HIP 32349'), featured('wolf', 'Wolf 359')],
    }),
    new Set(['HIP 32349', 'WOLF 359']),
  );
});

test('keeps faint featured stars without increasing the requested catalogue size', () => {
  const selected = selectBrightestIncludingIdentifiers(
    [star(1, 'One', -1), star(2, 'Two', 0), star(3, 'Three', 1), star(4, 'Wolf 359', 12)],
    3,
    new Set(['WOLF 359']),
  );

  assert.deepEqual(
    selected.map(({ id }) => id),
    [1, 2, 4],
  );
});

test('rejects malformed, duplicate, missing, and oversized featured selections', () => {
  assert.throws(() => extractFeaturedCatalogIdentifiers(null), /objects array/);
  assert.throws(
    () =>
      extractFeaturedCatalogIdentifiers({
        objects: [{ id: 'manual', positionProvider: { type: 'static' } }],
      }),
    /no valid HYG link/,
  );
  assert.throws(
    () =>
      extractFeaturedCatalogIdentifiers({
        objects: [featured('one', 'HIP 1'), featured('two', 'hip   1')],
      }),
    /Duplicate featured HYG/,
  );
  assert.throws(
    () => selectBrightestIncludingIdentifiers([star(1, 'One', 0)], 1, new Set(['MISSING'])),
    /absent from HYG: MISSING/,
  );
  assert.throws(
    () => selectBrightestIncludingIdentifiers([star(1, 'One', 0)], 0, new Set()),
    /cannot contain/,
  );
  assert.throws(
    () => selectBrightestIncludingIdentifiers([star(1, 'One', 0)], 1, new Set(['ONE', 'TWO'])),
    /cannot contain/,
  );
});

test('ships every featured identifier in the compact 10,000-star catalogue', async () => {
  const dataset = JSON.parse(
    await readFile(resolve('public/data/stars/nearby-stars.json'), 'utf8'),
  );
  const buffer = await readFile(resolve('public/data/stars/hyg-v41.bin'));
  const required = extractFeaturedCatalogIdentifiers(dataset);
  const available = decodeBinaryIdentifiers(buffer);

  assert.equal(buffer.readUInt32LE(12), 10_000);
  assert.deepEqual(
    [...required].filter((identifier) => !available.has(identifier)),
    [],
  );
});

function featured(id, identifier) {
  return {
    id,
    positionProvider: {
      type: 'catalog',
      catalogId: HYG_STAR_CATALOG_ID,
      identifier,
    },
  };
}

function star(id, name, magnitude) {
  return { id, name, aliases: [], magnitude };
}

function decodeBinaryIdentifiers(buffer) {
  const headerBytes = buffer.readUInt16LE(6);
  const recordBytes = buffer.readUInt16LE(8);
  const count = buffer.readUInt32LE(12);
  const stringTableOffset = buffer.readUInt32LE(28);
  const stringTableBytes = buffer.readUInt32LE(32);
  const stringTableEnd = stringTableOffset + stringTableBytes;
  const identifiers = new Set();
  const decodeString = (offset) => {
    const start = stringTableOffset + offset;
    let stringEnd = start;

    assert.ok(start >= stringTableOffset && start < stringTableEnd, 'invalid string offset');
    while (stringEnd < stringTableEnd && buffer[stringEnd] !== 0) {
      stringEnd += 1;
    }
    assert.ok(stringEnd < stringTableEnd, 'unterminated string');

    return buffer.toString('utf8', start, stringEnd);
  };

  assert.equal(headerBytes, 40);
  assert.equal(recordBytes, 48);
  assert.equal(stringTableOffset, headerBytes + count * recordBytes);
  assert.equal(stringTableEnd, buffer.length);

  for (let index = 0; index < count; index += 1) {
    const offset = headerBytes + index * recordBytes;
    const values = [
      decodeString(buffer.readUInt32LE(offset + 24)),
      ...decodeString(buffer.readUInt32LE(offset + 28)).split('\u001f'),
    ];

    for (const value of values) {
      identifiers.add(value.trim().replace(/\s+/gu, ' ').toUpperCase());
    }
  }

  return identifiers;
}
