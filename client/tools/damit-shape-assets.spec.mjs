import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const DAMIT_MODELS = [
  {
    body: 'Pallas',
    file: 'pallas-damit-4395.obj',
    sha256: 'e1ae3cef9a59b7b2482ecfa300bb51ef53c6de8b9e5a4afd8558ee19c8913d77',
  },
  {
    body: 'Hygiea',
    file: 'hygiea-damit-4392.obj',
    sha256: '5e347c946d41a2a335bb746749cd3bc2482b0945fb31d0c9c1c838aeeeb409b1',
  },
];

test('les reconstructions DAMIT conservent les maillages publiés', async () => {
  for (const { body, file, sha256 } of DAMIT_MODELS) {
    const model = await readFile(new URL(`../public/models/${file}`, import.meta.url), 'utf8');

    assert.equal(model.match(/^v\s/gmu)?.length, 1_602, `${body}: sommets inattendus`);
    assert.equal(model.match(/^f\s/gmu)?.length, 3_200, `${body}: faces inattendues`);
    assert.equal(createHash('sha256').update(model).digest('hex'), sha256, body);
  }
});
