import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

async function readRepositoryFile(relativePath) {
  return readFile(new URL(relativePath, repositoryRoot), 'utf8');
}

test('the production workflow deploys the verified build to the provisioned Azure resource', async () => {
  const workflow = await readRepositoryFile('.github/workflows/deploy.yml');

  assert.match(workflow, /workflows: \[Verify\]/);
  assert.match(workflow, /AZURE_STATIC_WEB_APP: swa-um-web/);
  assert.match(workflow, /AZURE_RESOURCE_GROUP: rg-infra-web/);
  assert.match(workflow, /dist\/universe-map\/browser/);
  assert.match(workflow, /--env production/);
  assert.match(workflow, /@azure\/static-web-apps-cli@2\.0\.10/);
  assert.doesNotMatch(workflow, /@azure\/static-web-apps-cli@latest/);
});

test('ignored workflow events cannot cancel an eligible production deployment', async () => {
  const workflow = await readRepositoryFile('.github/workflows/deploy.yml');
  const jobsOffset = workflow.indexOf('\njobs:');

  assert.notEqual(jobsOffset, -1);
  assert.doesNotMatch(workflow.slice(0, jobsOffset), /\nconcurrency:/);
  assert.match(
    workflow.slice(jobsOffset),
    /jobs:\n  deploy:[\s\S]*?concurrency:\n      group: deploy-production\n      cancel-in-progress: true/,
  );
});

test('the deployment gate stays fast while browser journeys remain independently automated', async () => {
  const workflow = await readRepositoryFile('.github/workflows/verify.yml');
  const browserWorkflow = await readRepositoryFile('.github/workflows/browser-journeys.yml');
  const packageManifest = JSON.parse(await readRepositoryFile('client/package.json'));

  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /npm run verify:ci/);
  assert.doesNotMatch(workflow, /playwright|test:e2e/i);
  assert.equal(
    packageManifest.scripts['audit:science'],
    'node tools/audit-scientific-distances.mjs',
  );
  assert.match(packageManifest.scripts['test:ci'], /npm run audit:science/);
  assert.match(browserWorkflow, /workflow_dispatch:/);
  assert.match(browserWorkflow, /schedule:/);
  assert.match(browserWorkflow, /timeout-minutes: 30/);
  assert.match(browserWorkflow, /npm run test:e2e/);
});

test('the Azure Static Web Apps configuration preserves app and guide routing', async () => {
  const configuration = JSON.parse(
    await readRepositoryFile('client/public/staticwebapp.config.json'),
  );

  assert.equal(configuration.navigationFallback.rewrite, '/index.html');
  assert.ok(configuration.navigationFallback.exclude.includes('/guide/*'));
  for (const language of ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh']) {
    assert.deepEqual(
      configuration.routes.find((route) => route.route === `/${language}/*`)?.headers,
      { 'Cache-Control': 'no-cache' },
    );
  }
  assert.deepEqual(
    configuration.routes.find((route) => route.route === '/guide'),
    {
      route: '/guide',
      redirect: '/guide/',
      statusCode: 301,
    },
  );
});

test('the Azure deployment revalidates manifests and caches stable static payloads', async () => {
  const configuration = JSON.parse(
    await readRepositoryFile('client/public/staticwebapp.config.json'),
  );

  assert.deepEqual(
    configuration.routes.find((entry) => entry.route === '/data/manifest.json')?.headers,
    { 'Cache-Control': 'no-cache' },
  );
  assert.deepEqual(
    configuration.routes.find((entry) => entry.route === '/data/earth-landmarks/manifest.json')
      ?.headers,
    { 'Cache-Control': 'no-cache' },
  );
  assert.deepEqual(configuration.routes.find((entry) => entry.route === '/data/*')?.headers, {
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  });
  assert.deepEqual(configuration.routes.find((entry) => entry.route === '/textures/*')?.headers, {
    'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
  });
});
