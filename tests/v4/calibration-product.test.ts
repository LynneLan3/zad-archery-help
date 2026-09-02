import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import generated from '../../src/v4/generated/example-site.json';

const productRoute = readFileSync(path.resolve('src/pages/v4-preview/[...page].astro'), 'utf8');
const productPrimitive = readFileSync(path.resolve('src/components/v4/SemanticPrimitive.astro'), 'utf8');

test('calibration product surface contains no raw payload renderer', () => {
  assert.equal(productRoute.includes('JSON.stringify'), false);
  assert.equal(productRoute.includes('<pre'), false);
  assert.equal(productPrimitive.includes('JSON.stringify'), false);
  assert.equal(productPrimitive.includes('<pre'), false);
});

test('calibration fixture has six product surfaces and a complete no-map case', () => {
  const ids = ['ember-core', 'forge-guide', 'marsh-map', 'heat-system', 'armory-db', 'unmapped-location'];
  for (const id of ids) assert.ok(generated.pages.some((page) => page.id === id));
  const noMap = generated.pages.find((page) => page.id === 'unmapped-location');
  assert.ok(noMap?.pageData.primitiveData.some((instance) => instance.primitiveId === 'L01'));
  assert.equal(noMap?.pageData.primitiveData.some((instance) => instance.primitiveId === 'L02'), false);
});

test('calibration media refs resolve to real local assets', () => {
  for (const page of generated.pages) {
    for (const instance of page.pageData.primitiveData) {
      for (const mediaRef of instance.mediaRefs) {
        const media = page.pageData.media.find((item) => item.mediaId === mediaRef);
        assert.ok(media, `${page.id}/${instance.instanceId} has missing ${mediaRef}`);
        assert.ok(media?.localRef?.startsWith('/v4/'));
        assert.ok(existsSync(path.resolve(`public${media?.localRef}`)));
      }
    }
  }
});

test('calibration revision keeps semantic labels and evidence placement', () => {
  const entity = generated.pages.find((page) => page.id === 'ember-core');
  const entityHeader = entity?.pageData.primitiveData.find((instance) => instance.primitiveId === 'A01');
  const entityFacts = entity?.pageData.primitiveData.find((instance) => instance.primitiveId === 'E01');
  assert.deepEqual(entityHeader?.mediaRefs, ['media-1']);
  assert.deepEqual(entityFacts?.mediaRefs, []);

  const guide = generated.pages.find((page) => page.id === 'forge-guide');
  const steps = guide?.pageData.primitiveData.find((instance) => instance.primitiveId === 'P02');
  const stepPayload = steps?.payload as { steps?: Array<{ evidenceRefs?: string[]; mediaRefs?: string[] }> };
  assert.deepEqual(stepPayload.steps?.[1].evidenceRefs, ['e2']);
  assert.deepEqual(stepPayload.steps?.[1].mediaRefs, ['media-1']);

  const planner = generated.pages.find((page) => page.id === 'armory-db');
  assert.deepEqual(planner?.composition.primitives.map((primitive) => primitive.id), ['A01', 'X05', 'X01', 'X02', 'E03']);
});
