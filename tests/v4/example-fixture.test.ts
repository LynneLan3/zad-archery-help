import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import generated from '../../src/v4/generated/example-site.json';
import { PLAYER_TASK_LABELS } from '../../src/v4/intent-contract';
import { getNavigationTrail } from '../../src/v4/navigation';

test('Artificial Fixture generates the complete P1-P10 set plus no-map case', () => {
  const prototypes = new Set(generated.pages.map((page) => page.pageData.intent.prototype));
  assert.deepEqual([...prototypes].sort(), ['P1', 'P10', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']);
  assert.equal(generated.pages.length, 11);
  assert.equal(existsSync(path.resolve('src/pages/v4-preview/[...page].astro')), true);
});

test('Artificial Fixture exercises native expansion primitives', () => {
  const ids = new Set(generated.pages.flatMap((page) => page.pageData.primitiveData.map((item) => item.primitiveId)));
  for (const id of ['S02', 'S03', 'S04', 'E02', 'D01', 'D02', 'D03', 'P03', 'N01']) assert.ok(ids.has(id), id);
  assert.ok(generated.pages.find((page) => page.id === 'ashfall-calendar')?.pageData.primitiveData.some((item) => item.primitiveId === 'S03'));
});

test('player-facing labels and generated strings use stable display text', () => {
  assert.deepEqual(PLAYER_TASK_LABELS, {
    'entity-lookup': 'Item', 'collection-browse': 'Collection', 'choice-comparison': 'Comparison',
    procedure: 'Guide', location: 'Location', progression: 'Progression', mechanics: 'Mechanics',
    recommendation: 'Recommendation', 'tool-database': 'Tool', planning: 'Planning',
  });
  const serialized = JSON.stringify(generated.pages);
  assert.equal(/[\uFFFD·•—–−↗→×\u2028\u2029]/.test(serialized), false);
  for (const internal of ['entity-lookup', 'collection-browse', 'choice-comparison', 'tool-database']) assert.equal(serialized.includes(`>${internal}<`), false);
});

test('Artificial Fixture covers no-image and local-data omission cases', () => {
	const noImage = generated.pages.find((page) => page.id === 'ember-core');
	assert.equal(noImage?.pageData.assets.length, 1);
	const noMedia = generated.pages.find((page) => page.id === 'unmapped-location');
	assert.equal(noMedia?.pageData.assets.length, 0);
	const unmapped = generated.pages.find((page) => page.id === 'unmapped-location');
	assert.equal(unmapped?.pageData.primitiveRecipe.find((item) => item.primitiveId === 'L02')?.status, 'omit');
	assert.equal(unmapped?.pageData.primitiveRecipe.find((item) => item.primitiveId === 'L01')?.status, 'include');
});

test('Artificial Fixture exposes navigation hierarchy and page breadcrumbs', () => {
  assert.deepEqual(generated.navigation.primary.map((item) => item.label), ['Home', 'Guide']);
  assert.deepEqual(generated.navigation.utilities?.map((item) => item.label), ['Search']);
  assert.deepEqual(getNavigationTrail(generated.navigation, 'ashfall-calendar'), [
    { label: 'Guide', href: '/v4-preview/category/' },
    { label: 'Operate systems' },
    { label: 'Planning Calendar' },
  ]);
  assert.deepEqual(getNavigationTrail({ primary: [{ id: 'home', label: 'Home', href: '/' }] }, 'missing'), []);
});
