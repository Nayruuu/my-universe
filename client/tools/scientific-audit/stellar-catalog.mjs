import { decodeSpatialCatalog } from '../build-star-spatial-index.mjs';
import { addAnomaly, isPositiveFinite, readBinary, readJson } from './shared.mjs';

const HEADER_BYTES = 40;
const RECORD_BYTES = 36;
const ALIAS_SEPARATOR = '\u001f';

export async function auditStellarCatalog(dataRoot, curatedObjects, anomalies) {
  const metadata = await readJson(dataRoot, 'stars/hyg-v41.meta.json');
  const bytes = await readBinary(dataRoot, 'stars/hyg-v41.bin');
  const catalog = decodeSpatialCatalog(bytes);
  const identifiers = decodeIdentifiers(bytes, catalog.count);
  let minimumDistanceParsec = Number.POSITIVE_INFINITY;
  let maximumDistanceParsec = 0;

  for (let index = 0; index < catalog.stars.length; index += 1) {
    const star = catalog.stars[index];
    const distance = Math.hypot(star.x, star.y, star.z);

    if (!isPositiveFinite(distance)) {
      addAnomaly(anomalies, 'hyg', `record-${index}`, 'non-positive Cartesian distance');
    }
    minimumDistanceParsec = Math.min(minimumDistanceParsec, distance);
    maximumDistanceParsec = Math.max(maximumDistanceParsec, distance);
  }
  if (catalog.count !== metadata.selection.emittedCount) {
    addAnomaly(anomalies, 'hyg', 'catalog', 'binary and metadata cardinalities differ');
  }
  auditEditorialLinks(curatedObjects, identifiers, anomalies);

  return { records: catalog.count, minimumDistanceParsec, maximumDistanceParsec };
}

function auditEditorialLinks(objects, identifiers, anomalies) {
  for (const object of objects) {
    const provider = object.positionProvider;

    if (provider.type !== 'catalog') {
      continue;
    }
    if (provider.catalogId !== 'hyg-v41-bright-stars') {
      addAnomaly(anomalies, 'hyg', object.id, `unknown catalogue ${provider.catalogId}`);
    } else if (!identifiers.has(normalizeIdentifier(provider.identifier))) {
      addAnomaly(anomalies, 'hyg', object.id, `missing identifier ${provider.identifier}`);
    }
  }
}

function decodeIdentifiers(bytes, count) {
  const identifiers = new Set();
  const stringTableOffset = bytes.readUInt32LE(28);
  const stringTable = bytes.subarray(stringTableOffset);

  for (let index = 0; index < count; index += 1) {
    const recordOffset = HEADER_BYTES + index * RECORD_BYTES;
    const name = decodeString(stringTable, bytes.readUInt32LE(recordOffset + 24));
    const aliases = decodeString(stringTable, bytes.readUInt32LE(recordOffset + 28));

    identifiers.add(normalizeIdentifier(name));
    for (const alias of aliases.split(ALIAS_SEPARATOR).filter(Boolean)) {
      identifiers.add(normalizeIdentifier(alias));
    }
  }

  return identifiers;
}

function decodeString(stringTable, offset) {
  const end = stringTable.indexOf(0, offset);

  if (end < 0) {
    throw new Error(`Unterminated HYG string at offset ${offset}.`);
  }

  return stringTable.toString('utf8', offset, end);
}

function normalizeIdentifier(value) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en');
}
